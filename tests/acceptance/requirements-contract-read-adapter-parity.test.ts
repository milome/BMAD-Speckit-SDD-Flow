import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { readRequirementsContractV2Bundle } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-v2-read-adapter';

const v2AdapterPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-v2-read-adapter.ts'
);

it('publishes the canonical V2 read adapter production entry', () => {
  expect(existsSync(v2AdapterPath)).toBe(true);
});

const HASH = `sha256:${'a'.repeat(64)}`;
const members = [
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

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

it('reads only the manifest-declared V2 Bundle members after byte-hash verification', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-v2-adapter-'));
  try {
    const revisionRoot = path.join(
      root,
      '_bmad-output/runtime/requirement-records/adapter-fixture/authoring/revisions/BUNDLE-REV-001'
    );
    mkdirSync(revisionRoot, { recursive: true });
    const memberRows = members.map(([fileName, schemaVersion, role]) => {
      const value =
        role === 'semantic_ir'
          ? { schemaVersion, semanticModelHash: HASH, nodes: {} }
          : role === 'trace_graph'
            ? { schemaVersion, traceGraphHash: HASH, edges: {} }
            : { schemaVersion, role, entries: [] };
      const text = `${JSON.stringify(value, null, 2)}\n`;
      const memberPath = path.join(revisionRoot, fileName);
      writeFileSync(memberPath, text, 'utf8');
      return {
        path: path.relative(root, memberPath).replaceAll('\\', '/'),
        schemaVersion,
        role,
        hash: sha256(text),
        safeWriteReceiptRef: `SAFE-WRITE-${role}`,
      };
    });
    const manifest = {
      schemaVersion: 'requirements-contract-runtime-bundle-manifest/v1',
      canonicalByteDomain: 'requirements-contract-runtime-bundle-manifest/v1',
      requirementSetId: 'adapter-fixture',
      sourceAuthorityHash: HASH,
      semanticModelHash: HASH,
      traceGraphHash: HASH,
      baseRevision: 0,
      bundleRevision: 'BUNDLE-REV-001',
      expectedCommittedRecordRevision: 1,
      atomicCommitId: 'ATOMIC-COMMIT-001',
      controlEventId: 'CONTROL-EVENT-001',
      authority: 'none',
      sourcePrdBackReferences: {
        sourceDocumentPath: 'docs/requirements/adapter-fixture.md',
        implementationConfirmationBundleManifestPath: `${path
          .relative(root, revisionRoot)
          .replaceAll('\\', '/')}/bundle-manifest.json`,
        acceptanceContractsPath: memberRows[6].path,
      },
      upstreamProofs: {
        intakeReceipt: { path: 'docs/evidence/intake.json', hash: HASH },
        intentLineageLedger: { path: 'docs/evidence/lineage.json', hash: HASH },
        semanticConservationManifest: { path: 'docs/evidence/conservation.json', hash: HASH },
      },
      members: memberRows,
    };
    const manifestPath = path.join(revisionRoot, 'bundle-manifest.json');
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const result = readRequirementsContractV2Bundle({
      projectRoot: root,
      bundleManifestPath: manifestPath,
      expectedRequirementSetId: 'adapter-fixture',
      expectedSemanticModelHash: HASH,
      expectedTraceGraphHash: HASH,
    });

    expect(result).toMatchObject({
      ok: true,
      decision: 'pass',
      manifest: { bundleRevision: 'BUNDLE-REV-001' },
      logicalModel: { semanticModelHash: HASH },
      traceGraph: { traceGraphHash: HASH },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
