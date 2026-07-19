import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { readRequirementsContract } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-read-facade';
import { requirementsContractTraceEdgeTypeRegistryHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-trace-edge-type-registry';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const readFacadePath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-read-facade.ts'
);

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function write(root: string, relativePath: string, value: string): string {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
  return sha256(readFileSync(target));
}

function validLogicalModel(input: {
  recordId: string;
  requirementSetId: string;
  sourcePath: string;
  sourceHash: string;
}) {
  const ordinal = String(
    (Number.parseInt(input.requirementSetId.replaceAll('-', '').slice(0, 6), 16) % 999) + 1
  ).padStart(3, '0');
  const requirement = {
    id: `MUST-FR-${ordinal}`,
    kind: 'functional',
    schemaVersion: 'requirement-contract-requirement/v2',
    text: `Read facade requirement ${input.requirementSetId}.`,
    source: {
      sourcePath: input.sourcePath,
      sourceSpan: { startLine: 1, endLine: 1 },
      sourceHash: input.sourceHash,
      sourceRequirementId: `FR-${ordinal}`,
      headingPath: ['Requirements'],
    },
    semantics: {
      actor: 'registered_consumer',
      trigger: 'the semantic contract is requested',
      preconditions: [],
      action: 'read the normalized logical model through the facade',
      postconditions: [],
      invariants: [],
      thresholds: [],
    },
    authority: {
      authorityState: 'source_grounded',
      derivation: 'source_requirement',
      decisionReceiptRef: null,
    },
    applicability: {
      state: 'applicable',
      reasonCode: 'source_authorized',
    },
    unresolved: [],
    verification: {
      method: 'behavior_test',
      oracleRef: null,
      commandRefs: [],
      expectedObservationRefs: [],
    },
    bindings: {
      targetRefs: [],
      artifactRefs: [],
      traceEdgeRefs: [],
    },
  };
  const bodyHash = sha256Stable(requirement);
  const proofRef = `SOURCE-PROOF-${ordinal}`;
  const preimage = {
    schemaVersion: 'requirement-contract-model/v2',
    activationState: 'inactive_schema_boundary',
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    sourceAuthorityHash: input.sourceHash,
    edgeTypeRegistryHash: requirementsContractTraceEdgeTypeRegistryHash(),
    authority: 'none',
    semanticBodies: { [bodyHash]: requirement },
    nodes: {
      [requirement.id]: {
        nodeType: 'requirement',
        bodySchemaVersion: requirement.schemaVersion,
        bodyHash,
        applicability: {
          decision: 'applicable',
          reasonCode: 'source_authorized',
          proofRefs: [proofRef],
        },
        proofBindings: [proofRef],
      },
    },
    edges: {},
  };
  return {
    ...preimage,
    semanticModelHash: sha256Stable(preimage),
  };
}

const bundleMembers = [
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

it('publishes RequirementsContractReadFacade as the canonical production semantic read entry', () => {
  expect(existsSync(readFacadePath)).toBe(true);
});

it('blocks before adapter selection when the canonical Consumer Registry is missing', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-read-facade-'));
  try {
    const result = readRequirementsContract({
      projectRoot: root,
      consumerId: 'fixture-consumer',
      mode: 'draft',
      envelope: {
        requirementSetId: 'read-facade-fixture',
        sourcePath: 'docs/requirements/read-facade-fixture.md',
        sourceHash: `sha256:${'a'.repeat(64)}`,
        sourceFormatVersion: 'requirement-contract-model/v2',
        activeBundleRevision: 'BUNDLE-REV-001',
        semanticModelHash: `sha256:${'b'.repeat(64)}`,
        traceGraphHash: `sha256:${'c'.repeat(64)}`,
        cutoverId: 'CUTOVER-001',
      },
    });

    expect(result).toMatchObject({
      ok: false,
      decision: 'block',
      adapterInvoked: false,
    });
    expect(result.issues.map((issue) => issue.code)).toEqual(['consumer_registry_missing']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('blocks an unregistered consumer before adapter selection', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-read-facade-'));
  try {
    const registryPath = path.join(
      root,
      '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json'
    );
    mkdirSync(path.dirname(registryPath), { recursive: true });
    writeFileSync(
      registryPath,
      `${JSON.stringify({
        schemaVersion: 'requirements-contract-consumer-registry/v1',
        activation: {
          shadowOutputEnabled: false,
          v1OutputEnabled: false,
          productionReadModelVersion: 'v2',
          activationReceiptId: 'ACT-RECEIPT-001',
        },
        consumers: [],
      })}\n`,
      'utf8'
    );

    const result = readRequirementsContract({
      projectRoot: root,
      consumerId: 'unregistered-consumer',
      mode: 'draft',
      envelope: {
        requirementSetId: 'read-facade-fixture',
        sourcePath: 'docs/requirements/read-facade-fixture.md',
        sourceHash: `sha256:${'a'.repeat(64)}`,
        sourceFormatVersion: 'requirement-contract-model/v2',
        activeBundleRevision: 'BUNDLE-REV-001',
        semanticModelHash: `sha256:${'b'.repeat(64)}`,
        traceGraphHash: `sha256:${'c'.repeat(64)}`,
        cutoverId: 'CUTOVER-001',
      },
    });

    expect(result.adapterInvoked).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(['consumer_not_registered']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('selects the registered V2 adapter and lifecycle-validates the normalized model', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-contract-read-facade-'));
  try {
    const requirementSetId = randomUUID();
    const recordId = randomUUID();
    const consumerId = `consumer-${randomUUID()}`;
    const sourcePath = `docs/requirements/${requirementSetId}.md`;
    const sourceHash = write(root, sourcePath, `# Requirement ${requirementSetId}\n`);
    const logicalModel = validLogicalModel({
      recordId,
      requirementSetId,
      sourcePath,
      sourceHash,
    });
    const traceGraphPreimage = {
      schemaVersion: 'requirements-contract-trace-graph/v1',
      requirementSetId,
      edges: {},
    };
    const traceGraph = {
      ...traceGraphPreimage,
      traceGraphHash: sha256Stable(traceGraphPreimage),
    };
    const revision = `BUNDLE-REV-${randomUUID().toUpperCase()}`;
    const revisionRoot =
      `_bmad-output/runtime/requirement-records/${requirementSetId}/authoring/revisions/${revision}`;
    const memberRows = bundleMembers.map(([fileName, schemaVersion, role]) => {
      const value =
        role === 'semantic_ir'
          ? logicalModel
          : role === 'trace_graph'
            ? traceGraph
            : { schemaVersion, role, entries: [] };
      const memberPath = `${revisionRoot}/${fileName}`;
      return {
        path: memberPath,
        schemaVersion,
        role,
        hash: write(root, memberPath, `${JSON.stringify(value, null, 2)}\n`),
        safeWriteReceiptRef: `SAFE-WRITE-${role}-${requirementSetId}`,
      };
    });
    const manifestPath = `${revisionRoot}/bundle-manifest.json`;
    const manifest = {
      schemaVersion: 'requirements-contract-runtime-bundle-manifest/v1',
      canonicalByteDomain: 'requirements-contract-runtime-bundle-manifest/v1',
      requirementSetId,
      sourceAuthorityHash: sourceHash,
      semanticModelHash: logicalModel.semanticModelHash,
      traceGraphHash: traceGraph.traceGraphHash,
      baseRevision: 0,
      bundleRevision: revision,
      expectedCommittedRecordRevision: 1,
      atomicCommitId: `ATOMIC-COMMIT-${randomUUID().toUpperCase()}`,
      controlEventId: `CONTROL-EVENT-${randomUUID().toUpperCase()}`,
      authority: 'none',
      sourcePrdBackReferences: {
        sourceDocumentPath: sourcePath,
        implementationConfirmationBundleManifestPath: manifestPath,
        acceptanceContractsPath: memberRows.find(
          (member) => member.role === 'acceptance_manifest'
        )?.path,
      },
      upstreamProofs: {
        intakeReceipt: {
          path: `docs/evidence/${requirementSetId}/intake.json`,
          hash: sha256Stable({ requirementSetId, proof: 'intake' }),
        },
        intentLineageLedger: {
          path: `docs/evidence/${requirementSetId}/lineage.json`,
          hash: sha256Stable({ requirementSetId, proof: 'lineage' }),
        },
        semanticConservationManifest: {
          path: `docs/evidence/${requirementSetId}/conservation.json`,
          hash: sha256Stable({ requirementSetId, proof: 'conservation' }),
        },
      },
      members: memberRows,
    };
    write(root, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const registryPath =
      '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json';
    write(
      root,
      registryPath,
      `${JSON.stringify(
        {
          schemaVersion: 'requirements-contract-consumer-registry/v1',
          activation: {
            shadowOutputEnabled: false,
            v1OutputEnabled: false,
            productionReadModelVersion: 'v2',
            activationReceiptId: `ACTIVATION-${randomUUID().toUpperCase()}`,
          },
          consumers: [
            {
              consumerId,
              readFacadeRef: 'requirements-contract-read-facade/v1',
              adapterRef: 'requirements-contract-v2-read-adapter/v1',
              sourceFormatVersion: 'requirement-contract-model/v2',
              validationModes: ['draft'],
              inputRole: 'requirement_source_prd',
            },
          ],
        },
        null,
        2
      )}\n`
    );

    const result = readRequirementsContract({
      projectRoot: root,
      consumerId,
      mode: 'draft',
      envelope: {
        requirementSetId,
        sourcePath,
        sourceHash,
        sourceFormatVersion: 'requirement-contract-model/v2',
        activeBundleRevision: revision,
        bundleManifestPath: manifestPath,
        semanticModelHash: logicalModel.semanticModelHash,
        traceGraphHash: traceGraph.traceGraphHash,
        cutoverId: `V2-CUTOVER-${randomUUID().toUpperCase()}`,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      decision: 'pass',
      adapterInvoked: true,
      logicalModel: {
        recordId,
        requirementSetId,
        semanticModelHash: logicalModel.semanticModelHash,
      },
      traceGraph: {
        traceGraphHash: traceGraph.traceGraphHash,
      },
    });
    expect(result.issues).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
