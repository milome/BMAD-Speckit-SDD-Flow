import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import * as hashDomains from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';
import {
  createRequirementsContractSemanticIr,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import * as identityModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-identity';

function semanticInput() {
  return {
    recordId: 'REQ-HASH-BOUNDARY',
    requestId: 'AUTHORING-HASH-BOUNDARY',
    parentSemanticRevisionId: null,
    compilerVersion: 'compiler/v1',
    semantics: {
      requirements: [{
        id: 'MUST-FR-001',
        action: 'Persist the accepted order.',
        oracle: 'The committed order is readable byte-for-byte.',
        dependencies: ['MUST-FR-000'],
        coverageRefs: ['TRACE-001'],
      }],
    },
    evidenceClaims: [],
    specSpanRegistry: [],
    executionConstraints: [],
    semanticProvenance: {
      compilerIdentity: 'compiler/v1',
      receiptRef: 'quality/receipts/receipt-a.json',
    },
  };
}

describe('requirements contract semantic hash boundaries', () => {
  it('excludes provenance while preserving semantic mutations', () => {
    const baselineInput = semanticInput();
    const baseline = createRequirementsContractSemanticIr(baselineInput);
    const provenanceOnly = createRequirementsContractSemanticIr({
      ...baselineInput,
      semanticProvenance: {
        compilerIdentity: 'compiler/v2',
        receiptRef: 'quality/receipts/receipt-b.json',
      },
    });

    expect(provenanceOnly.scopeSemanticHash).toBe(baseline.scopeSemanticHash);

    for (const requirements of [
      [{ ...baselineInput.semantics.requirements[0], action: 'Persist the settled order.' }],
      [{ ...baselineInput.semantics.requirements[0], oracle: 'The readback matches the canonical order.' }],
      [{ ...baselineInput.semantics.requirements[0], dependencies: ['MUST-FR-000', 'MUST-FR-099'] }],
    ]) {
      const changed = createRequirementsContractSemanticIr({
        ...baselineInput,
        semantics: { requirements },
      });
      expect(changed.scopeSemanticHash).not.toBe(baseline.scopeSemanticHash);
    }
  });

  it('hashes canonical semantics instead of retired packet bookkeeping', () => {
    const payload = semanticInput();
    const baseline = hashDomains.scopeSemanticHash(payload);
    const bookkeepingOnly = hashDomains.scopeSemanticHash({
      ...payload,
      sourcePath: 'authoring/.staging/source-b.md',
      createdAt: '2026-09-21T00:00:00.000Z',
      language: 'zh-CN',
      renderer: 'renderer/v99',
      receiptRefs: ['receipt-b.json'],
    });

    expect(bookkeepingOnly).toBe(baseline);
    expect(Reflect.get(hashDomains, 'packetSemanticHash')).toBeUndefined();
  });

  it('separates stable build and authoring identities from operation metadata', () => {
    const buildHash = Reflect.get(hashDomains, 'buildHash') as
      | ((value: unknown) => string)
      | undefined;
    const createIdentity = Reflect.get(
      identityModule,
      'createRequirementsContractAuthoringIdentityV2'
    ) as ((value: Record<string, string>) => Record<string, string>) | undefined;
    expect(buildHash).toBeTypeOf('function');
    expect(createIdentity).toBeTypeOf('function');
    if (!buildHash || !createIdentity) return;

    const build = {
      scopeSemanticHash: `sha256:${'1'.repeat(64)}`,
      sourceBindingHash: `sha256:${'2'.repeat(64)}`,
      compilerIdentity: 'requirements-compiler/v3',
      artifacts: [{
        role: 'semantic_ir',
        schemaVersion: 'requirements-contract-semantic-ir/v2',
        semanticHash: `sha256:${'8'.repeat(64)}`,
        blobHash: `sha256:${'3'.repeat(64)}`,
      }, {
        role: 'trace_matrix',
        schemaVersion: 'requirements-contract-trace-matrix/v1',
        semanticHash: `sha256:${'9'.repeat(64)}`,
        blobHash: `sha256:${'4'.repeat(64)}`,
      }],
      attemptId: 'ATTEMPT-A',
      outputPath: 'authoring/staging/ATTEMPT-A',
      createdAt: '2026-09-20T00:00:00.000Z',
    };
    const baseline = buildHash(build);
    expect(buildHash({
      ...build,
      artifacts: [...build.artifacts].reverse(),
      attemptId: 'ATTEMPT-B',
      outputPath: 'authoring/staging/ATTEMPT-B',
      createdAt: '2026-09-21T00:00:00.000Z',
    })).toBe(baseline);
    expect(buildHash({
      ...build,
      artifacts: [{ ...build.artifacts[0], blobHash: `sha256:${'5'.repeat(64)}` }, build.artifacts[1]],
    })).not.toBe(baseline);

    const hashes = {
      scopeSemanticHash: `sha256:${'1'.repeat(64)}`,
      sourceBindingHash: `sha256:${'2'.repeat(64)}`,
      projectionSetHash: `sha256:${'3'.repeat(64)}`,
      buildHash: baseline,
      judgeInputSemanticHash: `sha256:${'5'.repeat(64)}`,
      auditPolicyHash: `sha256:${'6'.repeat(64)}`,
      auditBindingHash: `sha256:${'7'.repeat(64)}`,
    };
    expect(createIdentity(hashes)).toEqual({
      schemaVersion: 'requirements-contract-authoring-identity/v2',
      ...hashes,
    });
  });

  it('validates exact v2 identity fields while retaining legacy reads', () => {
    const createIdentity = Reflect.get(
      identityModule,
      'createRequirementsContractAuthoringIdentityV2'
    ) as (value: Record<string, string>) => Record<string, string>;
    const schema = JSON.parse(readFileSync(path.resolve(
      'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-authoring-identity.schema.json'
    ), 'utf8'));
    const validate = new Ajv2020({ strict: false }).compile(schema);
    const identity = createIdentity({
      scopeSemanticHash: `sha256:${'1'.repeat(64)}`,
      sourceBindingHash: `sha256:${'2'.repeat(64)}`,
      projectionSetHash: `sha256:${'3'.repeat(64)}`,
      buildHash: `sha256:${'4'.repeat(64)}`,
      judgeInputSemanticHash: `sha256:${'5'.repeat(64)}`,
      auditPolicyHash: `sha256:${'6'.repeat(64)}`,
      auditBindingHash: `sha256:${'7'.repeat(64)}`,
    });

    expect(validate(identity), validate.errors?.map((error) => error.message).join(', ')).toBe(true);
    expect(validate({ ...identity, createdAt: '2026-09-20T00:00:00.000Z' })).toBe(false);
    expect(validate({
      authoringRequestId: 'AUTHORING-1',
      requestId: 'AUTHORING-1',
      grillSessionId: 'GRILL-1',
      authoringAttemptId: 'ATTEMPT-1',
      semanticRevisionId: 'SEMREV-1',
      judgeRequestHash: `sha256:${'1'.repeat(64)}`,
      remediationPlanHash: `sha256:${'2'.repeat(64)}`,
      remediationDeltaHash: `sha256:${'3'.repeat(64)}`,
    })).toBe(true);
  });
});
