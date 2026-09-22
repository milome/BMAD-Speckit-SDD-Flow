import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import * as buildModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-durable-build-store';
import { createRequirementsContractBuildManifestV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import { publishRequirementsContentObject } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-content-store';
import { requirementsContractDomainHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';

const roots: string[] = [];
function recordRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-durable-build-'));
  roots.push(root);
  return root;
}
function requiredFunction<T>(module: object, name: string): T {
  const value = Reflect.get(module, name) as T | undefined;
  expect(value, `${name} must be exported`).toBeTypeOf('function');
  if (!value) throw new Error(`${name} missing`);
  return value;
}

function authority(manifest: ReturnType<typeof createRequirementsContractBuildManifestV2>) {
  return {
    activeSemanticRevisionId: 'SEM-001',
    activeScopeSemanticHash: manifest.scopeSemanticHash,
    activeBindingRevisionId: 'BIND-001',
    activeSourceBindingHash: manifest.sourceBindingHash,
    activeBuildHash: manifest.buildHash,
    activeBuildManifestPath: `authoring/builds/${manifest.buildHash.slice('sha256:'.length)}/manifest.json`,
    previousBuildHash: null,
    previousBuildManifestPath: null,
  };
}

describe('requirements durable build promotion', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it.each(['before_build_rename', 'after_build_rename_before_authority_cas', 'after_authority_cas'])(
    'recovers %s without an active staging path',
    (failurePoint) => {
      const root = recordRoot();
      const publish = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
        buildModule,
        'publishRequirementsContractDurableBuild'
      );
      const manifest = createRequirementsContractBuildManifestV2({
        scopeSemanticHash: `sha256:${'1'.repeat(64)}`,
        sourceBindingHash: `sha256:${'2'.repeat(64)}`,
        compilerIdentity: 'compiler/v1',
        projectionSetHash: `sha256:${'3'.repeat(64)}`,
        checkpointSummary: { checkpointIds: [], terminalStateHashes: [] },
        validationSummary: { decision: 'pass', checkIds: [] },
        artifactEntries: [],
      });
      expect(() => publish({ recordRoot: root, operationId: 'OP-1', manifest, nextAuthority: authority(manifest), expectedActiveAuthorityHash: `sha256:${'0'.repeat(64)}`, failurePoint }))
        .toThrow();
      const resumed = publish({ recordRoot: root, operationId: 'OP-1', manifest, nextAuthority: authority(manifest), expectedActiveAuthorityHash: `sha256:${'0'.repeat(64)}` });
      expect(resumed.manifestPath).toMatch(/^authoring[\\/]builds[\\/][a-f0-9]{64}[\\/]manifest\.json$/u);
      expect(resumed.manifestPath).not.toContain('staging');
      expect(JSON.parse(readFileSync(path.join(root, resumed.manifestPath), 'utf8')).buildHash).toBe(manifest.buildHash);
      expect(JSON.parse(readFileSync(path.join(root, 'authoring', 'active-authority.json'), 'utf8')).activeBuildHash).toBe(manifest.buildHash);
    }
  );

  it('rejects operation ids that escape the record root', () => {
    const root = recordRoot();
    const publish = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      buildModule,
      'publishRequirementsContractDurableBuild'
    );
    expect(() => publish({ recordRoot: root, operationId: '../escape', manifest: {} as any, nextAuthority: {}, expectedActiveAuthorityHash: `sha256:${'0'.repeat(64)}` }))
      .toThrow('requirements_durable_build_operation_id_invalid');
  });

  it('does not delete another writer lock when authority is busy', () => {
    const root = recordRoot();
    const publish = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      buildModule,
      'publishRequirementsContractDurableBuild'
    );
    const manifest = createRequirementsContractBuildManifestV2({
      scopeSemanticHash: `sha256:${'1'.repeat(64)}`,
      sourceBindingHash: `sha256:${'2'.repeat(64)}`,
      compilerIdentity: 'compiler/v1',
      projectionSetHash: `sha256:${'3'.repeat(64)}`,
      checkpointSummary: { checkpointIds: [], terminalStateHashes: [] },
      validationSummary: { decision: 'pass', checkIds: [] },
      artifactEntries: [],
    });
    const lockPath = path.join(root, 'authoring', 'active-authority.json.lock');
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, 'other-writer', 'utf8');
    expect(() => publish({ recordRoot: root, operationId: 'OP-BUSY', manifest, nextAuthority: authority(manifest), expectedActiveAuthorityHash: `sha256:${'0'.repeat(64)}` }))
      .toThrow('requirements_durable_build_authority_busy');
    expect(existsSync(lockPath)).toBe(true);
  });

  it('recovers an abandoned authority lock after its owner exits', () => {
    const root = recordRoot();
    const publish = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      buildModule,
      'publishRequirementsContractDurableBuild'
    );
    const manifest = createRequirementsContractBuildManifestV2({
      scopeSemanticHash: `sha256:${'1'.repeat(64)}`,
      sourceBindingHash: `sha256:${'2'.repeat(64)}`,
      compilerIdentity: 'compiler/v1', projectionSetHash: `sha256:${'3'.repeat(64)}`,
      checkpointSummary: { checkpointIds: [], terminalStateHashes: [] },
      validationSummary: { decision: 'pass', checkIds: [] }, artifactEntries: [],
    });
    const lockPath = path.join(root, 'authoring', 'active-authority.json.lock');
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, JSON.stringify({ pid: 2_147_483_647, createdAt: '2000-01-01T00:00:00.000Z', token: 'abandoned' }), 'utf8');
    expect(publish({ recordRoot: root, operationId: 'OP-RECOVER', manifest, nextAuthority: authority(manifest), expectedActiveAuthorityHash: `sha256:${'0'.repeat(64)}` }))
      .toMatchObject({ reused: false });
  });

  it('reports first publication as new and identical publication as reused', () => {
    const root = recordRoot();
    const publish = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      buildModule,
      'publishRequirementsContractDurableBuild'
    );
    const manifest = createRequirementsContractBuildManifestV2({
      scopeSemanticHash: `sha256:${'4'.repeat(64)}`,
      sourceBindingHash: `sha256:${'5'.repeat(64)}`,
      compilerIdentity: 'compiler/v1',
      projectionSetHash: `sha256:${'6'.repeat(64)}`,
      checkpointSummary: { checkpointIds: [], terminalStateHashes: [] },
      validationSummary: { decision: 'pass', checkIds: [] },
      artifactEntries: [],
    });
    const first = publish({ recordRoot: root, operationId: 'OP-FIRST', manifest, nextAuthority: authority(manifest), expectedActiveAuthorityHash: `sha256:${'0'.repeat(64)}` });
    const second = publish({ recordRoot: root, operationId: 'OP-SECOND', manifest, nextAuthority: authority(manifest), expectedActiveAuthorityHash: `sha256:${'0'.repeat(64)}` });
    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
  });

  it('reuses the current authority tuple when another operation produces the same build', () => {
    const manifest = createRequirementsContractBuildManifestV2({
      scopeSemanticHash: `sha256:${'4'.repeat(64)}`,
      sourceBindingHash: `sha256:${'5'.repeat(64)}`,
      compilerIdentity: 'compiler/v1',
      projectionSetHash: `sha256:${'6'.repeat(64)}`,
      checkpointSummary: { checkpointIds: [], terminalStateHashes: [] },
      validationSummary: { decision: 'pass', checkIds: [] },
      artifactEntries: [],
    });
    const current = authority(manifest);
    const derive = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      buildModule,
      'deriveRequirementsContractActiveAuthority'
    );

    expect(derive({
      manifest,
      semanticRevisionId: current.activeSemanticRevisionId,
      bindingRevisionId: current.activeBindingRevisionId,
      currentAuthority: current,
    })).toEqual(current);
  });

  it('resolves an active artifact only through the durable manifest role and content ref', () => {
    const root = recordRoot();
    const markdown = '# Canonical requirements\n';
    const contentRef = publishRequirementsContentObject({
      recordRoot: root,
      role: 'final_markdown',
      mediaType: 'text/markdown; charset=utf-8',
      bytes: Buffer.from(markdown, 'utf8'),
    });
    const manifest = createRequirementsContractBuildManifestV2({
      scopeSemanticHash: `sha256:${'4'.repeat(64)}`,
      sourceBindingHash: `sha256:${'5'.repeat(64)}`,
      compilerIdentity: 'compiler/v1',
      projectionSetHash: `sha256:${'6'.repeat(64)}`,
      checkpointSummary: { checkpointIds: [], terminalStateHashes: [] },
      validationSummary: { decision: 'pass', checkIds: [] },
      artifactEntries: [{
        role: 'final_markdown',
        schemaVersion: 'markdown/v1',
        semanticHash: requirementsContractDomainHash(
          'requirements-projection:final_markdown/v1',
          markdown
        ),
        contentRef,
      }],
    });
    const activeAuthority = authority(manifest);
    const publish = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      buildModule,
      'publishRequirementsContractDurableBuild'
    );
    publish({
      recordRoot: root,
      operationId: 'OP-RESOLVE',
      manifest,
      nextAuthority: activeAuthority,
      expectedActiveAuthorityHash: `sha256:${'0'.repeat(64)}`,
    });
    const resolve = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      buildModule,
      'resolveRequirementsActiveArtifact'
    );

    expect(resolve({ recordRoot: root, activeAuthority, role: 'final_markdown' }))
      .toMatchObject({ value: markdown, entry: { role: 'final_markdown', contentRef } });
    expect(() => resolve({ recordRoot: root, activeAuthority, role: 'semantic_ir' }))
      .toThrow('requirements_active_artifact_missing');
  });

  it('requires a new build to retain the current active build as predecessor', () => {
    const root = recordRoot();
    const publish = requiredFunction<(input: Record<string, unknown>) => Record<string, unknown>>(
      buildModule,
      'publishRequirementsContractDurableBuild'
    );
    const firstManifest = createRequirementsContractBuildManifestV2({
      scopeSemanticHash: `sha256:${'1'.repeat(64)}`, sourceBindingHash: `sha256:${'2'.repeat(64)}`,
      compilerIdentity: 'compiler/v1', projectionSetHash: `sha256:${'3'.repeat(64)}`,
      checkpointSummary: { checkpointIds: [], terminalStateHashes: [] },
      validationSummary: { decision: 'pass', checkIds: [] }, artifactEntries: [],
    });
    publish({ recordRoot: root, operationId: 'OP-1', manifest: firstManifest, nextAuthority: authority(firstManifest), expectedActiveAuthorityHash: `sha256:${'0'.repeat(64)}` });
    const secondManifest = createRequirementsContractBuildManifestV2({
      scopeSemanticHash: `sha256:${'4'.repeat(64)}`, sourceBindingHash: `sha256:${'5'.repeat(64)}`,
      compilerIdentity: 'compiler/v1', projectionSetHash: `sha256:${'6'.repeat(64)}`,
      checkpointSummary: { checkpointIds: [], terminalStateHashes: [] },
      validationSummary: { decision: 'pass', checkIds: [] }, artifactEntries: [],
    });
    expect(() => publish({
      recordRoot: root, operationId: 'OP-2', manifest: secondManifest,
      nextAuthority: authority(secondManifest), expectedActiveAuthorityHash: `sha256:${'0'.repeat(64)}`,
    })).toThrow('requirements_durable_build_predecessor_invalid');
  });
});
