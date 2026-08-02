import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'b'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-runtime-bundle-manifest.schema.json'
);

const memberDefinitions = [
  ['semantic-ir.json', 'requirement-contract-model/v2', 'semantic_ir'],
  ['trace-graph.json', 'requirements-contract-trace-graph/v1', 'trace_graph'],
  ['target-bindings.json', 'requirements-contract-target-bindings/v1', 'target_bindings'],
  ['task-graph.json', 'requirements-contract-task-graph/v1', 'task_graph'],
  ['red-contracts.json', 'requirements-contract-red-contracts/v1', 'red_contracts'],
  ['oracle-registry.json', 'requirements-contract-oracle-registry/v1', 'oracle_registry'],
  [
    'acceptance-contracts.json',
    'requirements-contract-acceptance-manifest/v1',
    'acceptance_manifest',
  ],
  [
    'evidence-requirements.json',
    'requirements-contract-evidence-requirements/v1',
    'evidence_requirements',
  ],
  [
    'business-behavior-delta.json',
    'requirements-contract-business-behavior-delta/v1',
    'business_behavior_delta',
  ],
  [
    'implementation-impact-map.json',
    'requirements-contract-implementation-impact-map/v1',
    'implementation_impact_map',
  ],
] as const;

function manifest() {
  const revisionRoot =
    '_bmad-output/runtime/requirement-records/order-flow/authoring/revisions/BUNDLE-REV-001';
  return {
    schemaVersion: 'requirements-contract-runtime-bundle-manifest/v1',
    canonicalByteDomain: 'requirements-contract-runtime-bundle-manifest/v1',
    requirementSetId: 'order-flow',
    sourceAuthorityHash: HASH,
    semanticModelHash: HASH,
    traceGraphHash: HASH,
    baseRevision: 7,
    bundleRevision: 'BUNDLE-REV-001',
    expectedCommittedRecordRevision: 8,
    atomicCommitId: 'ATOMIC-COMMIT-001',
    controlEventId: 'CONTROL-EVENT-001',
    authority: 'none',
    sourcePrdBackReferences: {
      sourceDocumentPath: 'docs/requirements/order-flow.md',
      implementationConfirmationBundleManifestPath: `${revisionRoot}/bundle-manifest.json`,
      acceptanceContractsPath: `${revisionRoot}/acceptance-contracts.json`,
    },
    upstreamProofs: {
      intakeReceipt: {
        path: 'docs/plans/evidence/loop-engineering-remediation/intake-receipt.json',
        hash: HASH,
      },
      intentLineageLedger: {
        path: 'docs/plans/evidence/loop-engineering-remediation/intent-lineage-ledger.json',
        hash: HASH,
      },
      semanticConservationManifest: {
        path: 'docs/plans/evidence/loop-engineering-remediation/semantic-conservation-manifest.json',
        hash: HASH,
      },
    },
    members: memberDefinitions.map(([fileName, schemaVersion, role]) => ({
      path: `${revisionRoot}/${fileName}`,
      schemaVersion,
      role,
      hash: HASH,
      safeWriteReceiptRef: `SAFE-WRITE-${fileName}`,
    })),
  };
}

function schemaValidator() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

it('publishes the G01 runtime Bundle manifest schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))('requirements-contract-runtime-bundle-manifest/v1', () => {
  it('accepts one inactive manifest with exactly ten canonical members', () => {
    const validate = schemaValidator();
    const value = manifest();

    expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
    expect(value.members).toHaveLength(10);
    expect(value.members.map((member) => path.basename(member.path))).toEqual(
      memberDefinitions.map(([fileName]) => fileName)
    );
  });

  it('rejects missing, extra, reordered, or duplicated Bundle members', () => {
    const validate = schemaValidator();
    const missing = manifest();
    missing.members.pop();
    const extra = manifest();
    (extra.members as Array<Record<string, unknown>>).push({
      path: '_bmad-output/runtime/requirement-records/order-flow/authoring/revisions/BUNDLE-REV-001/extra.json',
      schemaVersion: 'requirements-contract-extra/v1',
      role: 'semantic_ir',
      hash: HASH,
      safeWriteReceiptRef: 'SAFE-WRITE-extra.json',
    });
    const reordered = manifest();
    [reordered.members[0], reordered.members[1]] = [reordered.members[1], reordered.members[0]];
    const duplicated = manifest();
    duplicated.members[9] = { ...duplicated.members[0] };

    expect(validate(missing)).toBe(false);
    expect(validate(extra)).toBe(false);
    expect(validate(reordered)).toBe(false);
    expect(validate(duplicated)).toBe(false);
  });

  it('keeps the three upstream proof artifacts outside the ten-member inventory', () => {
    const validate = schemaValidator();
    const invalid = manifest();
    (invalid.members as Array<Record<string, unknown>>)[9] = {
      path: invalid.upstreamProofs.semanticConservationManifest.path,
      schemaVersion: 'requirements-contract-semantic-conservation-manifest/v1',
      role: 'semantic_conservation_manifest',
      hash: HASH,
      safeWriteReceiptRef: 'SAFE-WRITE-semantic-conservation-manifest.json',
    };

    expect(validate(invalid)).toBe(false);
  });

  it('rejects downstream, self-hash, and premature commit claims', () => {
    const validate = schemaValidator();
    for (const forbiddenProperty of [
      'manifestHash',
      'manifestWriteReceipt',
      'manifestPromotionReceiptHash',
      'observedCommittedRecordRevision',
      'eventCommitted',
      'sourceDocumentHash',
      'confirmationProjectionHash',
    ]) {
      const invalid = {
        ...manifest(),
        [forbiddenProperty]: forbiddenProperty === 'eventCommitted' ? true : HASH,
      };

      expect(validate(invalid), forbiddenProperty).toBe(false);
    }
  });

  it('rejects invalid authority, hashes, revision identities, and extra nested fields', () => {
    const validate = schemaValidator();
    const invalidAuthority = manifest();
    invalidAuthority.authority = 'semantic_authority' as never;
    const invalidHash = manifest();
    invalidHash.sourceAuthorityHash = 'sha256:short';
    const invalidRevision = manifest();
    invalidRevision.bundleRevision = 'latest';
    const extraNested = manifest();
    extraNested.members[0] = {
      ...extraNested.members[0],
      copiedSemanticBody: 'The consumer submits an order.',
    } as never;

    expect(validate(invalidAuthority)).toBe(false);
    expect(validate(invalidHash)).toBe(false);
    expect(validate(invalidRevision)).toBe(false);
    expect(validate(extraNested)).toBe(false);
  });
});
