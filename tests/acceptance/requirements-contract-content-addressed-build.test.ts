import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { publishRequirementsContentObject } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-content-store';
import * as checkpointModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-checkpoint-store';
import * as manifestModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import * as resolverModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-artifact-resolver';
import { requirementsContractDomainHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';

const roots: string[] = [];

function recordRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-content-build-'));
  roots.push(root);
  return root;
}

function requiredFunction<T>(module: object, name: string): T {
  const value = Reflect.get(module, name) as T | undefined;
  expect(value, `${name} must be exported`).toBeTypeOf('function');
  if (!value) throw new Error(`${name} missing`);
  return value;
}

describe('requirements content-addressed builds', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it('atomically replaces one fixed checkpoint state and resumes pending units', () => {
    const root = recordRoot();
    const save = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      checkpointModule,
      'saveRequirementsSemanticCheckpoint'
    );
    const read = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      checkpointModule,
      'readRequirementsSemanticCheckpoint'
    );
    const initial = save({
      recordRoot: root,
      expectedStateHash: null,
      nextState: {
        operationId: 'OP-A', checkpointId: 'cp01', semanticInputHash: `sha256:${'1'.repeat(64)}`,
        planHash: `sha256:${'2'.repeat(64)}`, completedUnits: [], pendingUnitIds: ['ROOT-1', 'ROOT-2'],
        validatorVersion: 'validator/v1', decision: 'in_progress',
      },
    });
    const outputRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'semantic_root',
      mediaType: 'application/json',
      bytes: Buffer.from('{"id":"ROOT-1"}', 'utf8'),
    });
    const updated = save({
      recordRoot: root,
      expectedStateHash: initial.stateHash,
      nextState: {
        ...initial,
        completedUnits: [{ unitId: 'ROOT-1', unitInputHash: `sha256:${'3'.repeat(64)}`, compilerVersion: 'compiler/v1', outputRefs: [outputRef] }],
        pendingUnitIds: ['ROOT-2'],
      },
    });

    expect(read({ recordRoot: root, operationId: 'OP-A', checkpointId: 'cp01' })).toEqual(updated);
    const directory = path.join(root, 'authoring', 'operations', 'OP-A', 'checkpoints');
    expect(readdirSync(directory)).toEqual(['cp01.json']);
    expect(JSON.stringify(updated)).not.toContain('{"id":"ROOT-1"}');
    expect(() => save({ recordRoot: root, expectedStateHash: initial.stateHash, nextState: updated }))
      .toThrow('requirements_checkpoint_state_cas_mismatch');
    const otherOperation = save({
      recordRoot: root,
      expectedStateHash: null,
      nextState: { ...updated, operationId: 'OP-B' },
    });
    expect(otherOperation.stateHash).toBe(updated.stateHash);
  });

  it('builds one path-free manifest from unique content refs', () => {
    const root = recordRoot();
    const bytes = Buffer.from('{"sentinel":"only once"}', 'utf8');
    const first = publishRequirementsContentObject({ recordRoot: root, role: 'semantic_ir', mediaType: 'application/json', bytes });
    const second = publishRequirementsContentObject({ recordRoot: root, role: 'review_candidate', mediaType: 'application/json', bytes });
    const create = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      manifestModule,
      'createRequirementsContractBuildManifestV2'
    );
    const semanticHash = requirementsContractDomainHash('requirements-projection:semantic_ir/v1', { sentinel: 'only once' });
    const manifest = create({
      scopeSemanticHash: `sha256:${'1'.repeat(64)}`,
      sourceBindingHash: `sha256:${'2'.repeat(64)}`,
      compilerIdentity: 'compiler/v1',
      projectionSetHash: `sha256:${'3'.repeat(64)}`,
      checkpointSummary: { checkpointIds: ['cp00', 'cp01'], terminalStateHashes: [`sha256:${'4'.repeat(64)}`, `sha256:${'5'.repeat(64)}`] },
      validationSummary: { decision: 'pass', checkIds: ['schema', 'lint'] },
      artifactEntries: [{ role: 'semantic_ir', schemaVersion: 'semantic/v1', semanticHash, contentRef: first }],
    });

    expect(first.recordRelativePath).toBe(second.recordRelativePath);
    expect(manifest).not.toHaveProperty('authoringAttemptId');
    expect(JSON.stringify(manifest)).not.toContain('staging');
    expect(manifest.buildHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('resumes keyed units and invalidates only the mismatched suffix', () => {
    const root = recordRoot();
    const run = requiredFunction<(input: Record<string, any>) => Record<string, any>>(
      checkpointModule,
      'runRequirementsSemanticCheckpointUnits'
    );
    const refs = ['A', 'B', 'C'].map((id) => publishRequirementsContentObject({
      recordRoot: root, role: 'semantic_root', mediaType: 'application/json',
      bytes: Buffer.from(JSON.stringify({ id }), 'utf8'),
    }));
    const calls: string[] = [];
    const units = refs.map((ref, index) => ({
      unitId: `ROOT-${index}`, unitInputHash: `sha256:${String(index + 1).repeat(64)}`,
      compilerVersion: 'compiler/v1', execute: () => { calls.push(`ROOT-${index}`); return [ref]; },
    }));
    expect(() => run({
      recordRoot: root, operationId: 'OP-RESUME', checkpointId: 'cp01',
      semanticInputHash: `sha256:${'a'.repeat(64)}`, planHash: `sha256:${'b'.repeat(64)}`,
      validatorVersion: 'validator/v1',
      units: units.map((unit, index) => ({
        ...unit,
        execute: () => {
          if (index === 1) throw new Error('injected interruption');
          return unit.execute();
        },
      })),
    })).toThrow('injected interruption');
    calls.length = 0;
    const resumed = run({
      recordRoot: root, operationId: 'OP-RESUME', checkpointId: 'cp01',
      semanticInputHash: `sha256:${'a'.repeat(64)}`, planHash: `sha256:${'b'.repeat(64)}`,
      validatorVersion: 'validator/v1', units,
    });
    expect(resumed.reusedUnitIds).toEqual(['ROOT-0']);
    expect(calls).toEqual(['ROOT-1', 'ROOT-2']);
    calls.length = 0;
    const changed = run({
      recordRoot: root, operationId: 'OP-RESUME', checkpointId: 'cp01',
      semanticInputHash: `sha256:${'a'.repeat(64)}`, planHash: `sha256:${'b'.repeat(64)}`,
      validatorVersion: 'validator/v1',
      units: units.map((unit, index) => index === 1 ? { ...unit, unitInputHash: `sha256:${'f'.repeat(64)}` } : unit),
    });
    expect(changed.reusedUnitIds).toEqual(['ROOT-0']);
    expect(calls).toEqual(['ROOT-1', 'ROOT-2']);
  });

  it('hydrates a completed JSON phase without executing it again', () => {
    const root = recordRoot();
    const run = requiredFunction<(input: Record<string, any>) => Record<string, any>>(
      checkpointModule,
      'runRequirementsSemanticCheckpointJsonUnit'
    );
    let calls = 0;
    const input = {
      recordRoot: root,
      operationId: 'OP-PHASE',
      checkpointId: 'cp02',
      semanticInputHash: `sha256:${'a'.repeat(64)}`,
      planHash: `sha256:${'b'.repeat(64)}`,
      validatorVersion: 'validator/v1',
      unitId: 'cp02:decomposition',
      unitInputHash: `sha256:${'c'.repeat(64)}`,
      compilerVersion: 'compiler/v1',
      role: 'must_decomposition_packet',
      execute: () => {
        calls += 1;
        return { schemaVersion: 'decomposition/v1', sentinel: 'persisted phase value' };
      },
    };
    const first = run(input);
    const resumed = run({
      ...input,
      execute: () => {
        throw new Error('completed phase executed twice');
      },
    });

    expect(first.value).toEqual(resumed.value);
    expect(first.executed).toBe(true);
    expect(resumed.reused).toBe(true);
    expect(calls).toBe(1);
  });

  it('does not rewrite a fully reusable checkpoint state', () => {
    const root = recordRoot();
    const run = requiredFunction<(input: Record<string, any>) => Record<string, any>>(
      checkpointModule,
      'runRequirementsSemanticCheckpointJsonUnit'
    );
    const input = {
      recordRoot: root, operationId: 'OP-NO-REFRESH', checkpointId: 'cp02',
      semanticInputHash: `sha256:${'a'.repeat(64)}`, planHash: `sha256:${'b'.repeat(64)}`,
      validatorVersion: 'validator/v1', unitId: 'cp02:unit',
      unitInputHash: `sha256:${'c'.repeat(64)}`, compilerVersion: 'compiler/v1', role: 'semantic_root',
      execute: () => ({ schemaVersion: 'value/v1', id: 'ROOT-1' }),
    };
    run(input);
    const checkpointPath = path.join(
      root, 'authoring', 'operations', 'OP-NO-REFRESH', 'checkpoints', 'cp02.json'
    );
    const oldTime = new Date('2000-01-01T00:00:00.000Z');
    utimesSync(checkpointPath, oldTime, oldTime);

    run({ ...input, execute: () => { throw new Error('reused checkpoint executed'); } });

    expect(statSync(checkpointPath).mtimeMs).toBe(oldTime.getTime());
  });

  it('rejects a legacy semantic schema alias instead of activating it', () => {
    const root = recordRoot();
    const value = { schemaVersion: 'semantic/v1', id: 'ROOT-1', action: 'Persist exactly once.' };
    const contentRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'semantic_ir',
      mediaType: 'application/json',
      bytes: Buffer.from(JSON.stringify(value), 'utf8'),
    });
    const semanticHash = requirementsContractDomainHash('requirements-projection:semantic_ir/v1', value);
    const resolve = requiredFunction<(input: Record<string, unknown>) => unknown>(
      resolverModule,
      'resolveRequirementsAuthoringArtifact'
    );
    expect(() => resolve({ recordRoot: root, entry: { role: 'semantic_ir', schemaVersion: 'semantic/v1', semanticHash, contentRef } }))
      .toThrow('requirements_authoring_artifact_schema_invalid');
  });

  it('rejects incomplete checkpoint state instead of inventing empty progress', () => {
    const root = recordRoot();
    const save = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      checkpointModule,
      'saveRequirementsSemanticCheckpoint'
    );
    expect(() => save({
      recordRoot: root,
      expectedStateHash: null,
      nextState: {
        operationId: 'OP-A', checkpointId: 'cp01', semanticInputHash: `sha256:${'1'.repeat(64)}`,
        planHash: `sha256:${'2'.repeat(64)}`, validatorVersion: 'validator/v1', decision: 'in_progress',
      },
    })).toThrow('requirements_checkpoint_state_invalid');
    expect(() => save({
      recordRoot: root,
      expectedStateHash: null,
      nextState: {
        operationId: 'OP-A', checkpointId: 'cp01', semanticInputHash: `sha256:${'1'.repeat(64)}`,
        planHash: `sha256:${'2'.repeat(64)}`, completedUnits: [{
          unitId: 'ROOT-1', unitInputHash: `sha256:${'3'.repeat(64)}`, compilerVersion: 'compiler/v1', outputRefs: [],
        }, {
          unitId: 'ROOT-1', unitInputHash: `sha256:${'4'.repeat(64)}`, compilerVersion: 'compiler/v1', outputRefs: [],
        }], pendingUnitIds: [null], validatorVersion: 'validator/v1', decision: 'in_progress',
      },
    })).toThrow('requirements_checkpoint_state_invalid');
  });

  it('preserves an active checkpoint lock when another writer is in progress', () => {
    const root = recordRoot();
    const save = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      checkpointModule,
      'saveRequirementsSemanticCheckpoint'
    );
    const lockPath = path.join(root, 'authoring', 'operations', 'OP-A', 'checkpoints', 'cp01.json.lock');
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, 'owner', 'utf8');
    expect(() => save({
      recordRoot: root,
      expectedStateHash: null,
      nextState: {
        operationId: 'OP-A', checkpointId: 'cp01', semanticInputHash: `sha256:${'1'.repeat(64)}`,
        planHash: `sha256:${'2'.repeat(64)}`, completedUnits: [], pendingUnitIds: [],
        validatorVersion: 'validator/v1', decision: 'passed',
      },
    })).toThrow('requirements_checkpoint_state_busy');
    expect(existsSync(lockPath)).toBe(true);
  });

  it('recovers an abandoned checkpoint lock and rejects unknown state fields', () => {
    const root = recordRoot();
    const save = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      checkpointModule,
      'saveRequirementsSemanticCheckpoint'
    );
    const lockPath = path.join(root, 'authoring', 'operations', 'OP-STALE', 'checkpoints', 'cp01.json.lock');
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, JSON.stringify({ pid: 2_147_483_647, createdAt: '2000-01-01T00:00:00.000Z', token: 'abandoned' }), 'utf8');
    const nextState = {
      operationId: 'OP-STALE', checkpointId: 'cp01', semanticInputHash: `sha256:${'1'.repeat(64)}`,
      planHash: `sha256:${'2'.repeat(64)}`, completedUnits: [], pendingUnitIds: [],
      validatorVersion: 'validator/v1', decision: 'passed',
    };
    expect(save({ recordRoot: root, expectedStateHash: null, nextState })).toMatchObject({ decision: 'passed' });
    expect(() => save({ recordRoot: root, expectedStateHash: null, nextState: { ...nextState, unexpected: true } }))
      .toThrow('requirements_checkpoint_state_invalid');
  });

  it('recovers an old empty lock left between exclusive create and owner write', () => {
    const root = recordRoot();
    const save = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      checkpointModule,
      'saveRequirementsSemanticCheckpoint'
    );
    const lockPath = path.join(root, 'authoring', 'operations', 'OP-EMPTY', 'checkpoints', 'cp01.json.lock');
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, '', 'utf8');
    utimesSync(lockPath, new Date('2000-01-01T00:00:00.000Z'), new Date('2000-01-01T00:00:00.000Z'));
    expect(save({
      recordRoot: root,
      expectedStateHash: null,
      nextState: {
        operationId: 'OP-EMPTY', checkpointId: 'cp01', semanticInputHash: `sha256:${'1'.repeat(64)}`,
        planHash: `sha256:${'2'.repeat(64)}`, completedUnits: [], pendingUnitIds: [],
        validatorVersion: 'validator/v1', decision: 'passed',
      },
    })).toMatchObject({ decision: 'passed' });
  });

  it('rejects artifact role and schema combinations outside the registry', () => {
    const root = recordRoot();
    const value = { schemaVersion: 'semantic/v1', id: 'ROOT-1' };
    const contentRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'semantic_ir',
      mediaType: 'application/json',
      bytes: Buffer.from(JSON.stringify(value), 'utf8'),
    });
    const resolve = requiredFunction<(input: Record<string, unknown>) => unknown>(
      resolverModule,
      'resolveRequirementsAuthoringArtifact'
    );
    const semanticHash = requirementsContractDomainHash('requirements-projection:semantic_ir/semantic/v1', value);
    expect(() => resolve({ recordRoot: root, entry: {
      role: 'unknown_role', schemaVersion: 'semantic/v1', semanticHash, contentRef,
    } })).toThrow('requirements_authoring_artifact_role_invalid');
    expect(() => resolve({ recordRoot: root, entry: {
      role: 'semantic_ir', schemaVersion: 'other/v1', semanticHash, contentRef,
    } })).toThrow('requirements_authoring_artifact_schema_invalid');
  });

  it('rejects a structurally invalid semantic authority artifact', () => {
    const root = recordRoot();
    const value = { schemaVersion: 'requirements-contract-semantic-ir/v2' };
    const contentRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'semantic_ir',
      mediaType: 'application/json',
      bytes: Buffer.from(JSON.stringify(value), 'utf8'),
    });
    const semanticHash = requirementsContractDomainHash('requirements-projection:semantic_ir/v1', value);
    const resolve = requiredFunction<(input: Record<string, unknown>) => unknown>(
      resolverModule,
      'resolveRequirementsAuthoringArtifact'
    );

    expect(() => resolve({
      recordRoot: root,
      entry: {
        role: 'semantic_ir',
        schemaVersion: 'requirements-contract-semantic-ir/v2',
        semanticHash,
        contentRef,
      },
    })).toThrow('requirements_authoring_artifact_schema_invalid');
  });

  it('rejects a structurally invalid source binding authority artifact', () => {
    const root = recordRoot();
    const value = { schemaVersion: 'requirements-contract-source-binding/v2' };
    const contentRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'source_binding',
      mediaType: 'application/json',
      bytes: Buffer.from(JSON.stringify(value), 'utf8'),
    });
    const semanticHash = requirementsContractDomainHash('requirements-projection:source_binding/v1', value);
    const resolve = requiredFunction<(input: Record<string, unknown>) => unknown>(
      resolverModule,
      'resolveRequirementsAuthoringArtifact'
    );

    expect(() => resolve({
      recordRoot: root,
      entry: {
        role: 'source_binding',
        schemaVersion: 'requirements-contract-source-binding/v2',
        semanticHash,
        contentRef,
      },
    })).toThrow('requirements_authoring_artifact_schema_invalid');
  });

  it('rejects a structurally invalid resolved evidence authority artifact', () => {
    const root = recordRoot();
    const value = { schemaVersion: 'requirements-contract-resolved-evidence-index/v1' };
    const contentRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'resolved_evidence_index',
      mediaType: 'application/json',
      bytes: Buffer.from(JSON.stringify(value), 'utf8'),
    });
    const semanticHash = requirementsContractDomainHash(
      'requirements-projection:resolved_evidence_index/v1',
      value
    );
    const resolve = requiredFunction<(input: Record<string, unknown>) => unknown>(
      resolverModule,
      'resolveRequirementsAuthoringArtifact'
    );

    expect(() => resolve({
      recordRoot: root,
      entry: {
        role: 'resolved_evidence_index',
        schemaVersion: 'requirements-contract-resolved-evidence-index/v1',
        semanticHash,
        contentRef,
      },
    })).toThrow('requirements_authoring_artifact_schema_invalid');
  });

  it('rejects a structurally invalid execution manifest artifact', () => {
    const root = recordRoot();
    const value = { schemaVersion: 'requirements-contract-execution-manifest/v2' };
    const contentRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'execution_manifest',
      mediaType: 'application/json',
      bytes: Buffer.from(JSON.stringify(value), 'utf8'),
    });
    const semanticHash = requirementsContractDomainHash('requirements-projection:execution_manifest/v1', value);
    const resolve = requiredFunction<(input: Record<string, unknown>) => unknown>(
      resolverModule,
      'resolveRequirementsAuthoringArtifact'
    );

    expect(() => resolve({
      recordRoot: root,
      entry: {
        role: 'execution_manifest',
        schemaVersion: 'requirements-contract-execution-manifest/v2',
        semanticHash,
        contentRef,
      },
    })).toThrow('requirements_authoring_artifact_schema_invalid');
  });

  it('rejects an empty per-MUST bundle artifact', () => {
    const root = recordRoot();
    const value = { schemaVersion: 'requirements-contract-per-must-bundle/v1' };
    const contentRef = publishRequirementsContentObject({
      recordRoot: root, role: 'per_must_bundle', mediaType: 'application/json',
      bytes: Buffer.from(JSON.stringify(value), 'utf8'),
    });
    const resolve = requiredFunction<(input: Record<string, unknown>) => unknown>(
      resolverModule, 'resolveRequirementsAuthoringArtifact'
    );
    expect(() => resolve({
      recordRoot: root,
      entry: {
        role: 'per_must_bundle', schemaVersion: 'requirements-contract-per-must-bundle/v1',
        semanticHash: requirementsContractDomainHash('requirements-projection:per_must_bundle/v1', value),
        contentRef,
      },
    })).toThrow('requirements_authoring_artifact_schema_invalid');
  });

  it('rejects a structurally invalid Judge packet descriptor artifact', () => {
    const root = recordRoot();
    const value = { schemaVersion: 'requirements-contract-judge-audit-packet/v3' };
    const contentRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'judge_audit_packet',
      mediaType: 'application/json',
      bytes: Buffer.from(JSON.stringify(value), 'utf8'),
    });
    const semanticHash = requirementsContractDomainHash('requirements-projection:judge_audit_packet/v1', value);
    const resolve = requiredFunction<(input: Record<string, unknown>) => unknown>(
      resolverModule,
      'resolveRequirementsAuthoringArtifact'
    );

    expect(() => resolve({
      recordRoot: root,
      entry: {
        role: 'judge_audit_packet',
        schemaVersion: 'requirements-contract-judge-audit-packet/v3',
        semanticHash,
        contentRef,
      },
    })).toThrow('requirements_authoring_artifact_schema_invalid');
  });

  it('validates sorted manifest hashes and canonical content object paths', () => {
    const create = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      manifestModule,
      'createRequirementsContractBuildManifestV2'
    );
    const validate = requiredFunction<(value: unknown) => boolean>(
      manifestModule,
      'validateRequirementsContractBuildManifestV2'
    );
    const hex = '7'.repeat(64);
    const manifest = create({
      scopeSemanticHash: `sha256:${'1'.repeat(64)}`,
      sourceBindingHash: `sha256:${'2'.repeat(64)}`,
      compilerIdentity: 'compiler/v1',
      projectionSetHash: `sha256:${'3'.repeat(64)}`,
      checkpointSummary: { checkpointIds: ['cp02', 'cp01'], terminalStateHashes: [`sha256:${'5'.repeat(64)}`, `sha256:${'4'.repeat(64)}`] },
      validationSummary: { decision: 'pass', checkIds: ['z-check', 'a-check'] },
      artifactEntries: [{
        role: 'semantic_ir', schemaVersion: 'semantic/v1', semanticHash: `sha256:${'6'.repeat(64)}`,
        contentRef: {
          schemaVersion: 'requirements-content-ref/v1', contentHash: `sha256:${hex}`, byteLength: 1, mediaType: 'application/json',
          recordRelativePath: `authoring/objects/sha256/${hex.slice(0, 2)}/${hex.slice(2)}`,
        },
      }],
    });
    expect(validate(manifest)).toBe(true);
    expect(validate({ ...manifest, artifactEntries: [{ ...manifest.artifactEntries[0], role: 'not-registered' }] })).toBe(false);
    expect(validate({ ...manifest, artifactEntries: [{ ...manifest.artifactEntries[0], contentRef: { ...manifest.artifactEntries[0].contentRef, recordRelativePath: 'authoring/objects/sha256/not-canonical' } }] })).toBe(false);
  });

  it('binds artifact semantic hashes into the build identity', () => {
    const create = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      manifestModule,
      'createRequirementsContractBuildManifestV2'
    );
    const root = recordRoot();
    const contentRef = publishRequirementsContentObject({
      recordRoot: root, role: 'semantic_ir', mediaType: 'application/json', bytes: Buffer.from('{"id":"ROOT-1"}', 'utf8'),
    });
    const base = {
      scopeSemanticHash: `sha256:${'1'.repeat(64)}`, sourceBindingHash: `sha256:${'2'.repeat(64)}`,
      compilerIdentity: 'compiler/v1', projectionSetHash: `sha256:${'3'.repeat(64)}`,
      checkpointSummary: { checkpointIds: [], terminalStateHashes: [] },
      validationSummary: { decision: 'pass', checkIds: [] },
    };
    const first = create({ ...base, artifactEntries: [{ role: 'semantic_ir', schemaVersion: 'semantic/v1', semanticHash: `sha256:${'4'.repeat(64)}`, contentRef }] });
    const second = create({ ...base, artifactEntries: [{ role: 'semantic_ir', schemaVersion: 'semantic/v1', semanticHash: `sha256:${'5'.repeat(64)}`, contentRef }] });
    expect(first.buildHash).not.toBe(second.buildHash);
    const metadataChange = create({ ...base, artifactEntries: [{
      role: 'semantic_ir', schemaVersion: 'semantic/v1', semanticHash: `sha256:${'4'.repeat(64)}`,
      contentRef: { ...contentRef, mediaType: 'application/problem+json' },
    }] });
    expect(first.buildHash).not.toBe(metadataChange.buildHash);
  });
});
