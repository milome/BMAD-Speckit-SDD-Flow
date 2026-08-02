import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requirementsContractTraceEdgeTypeRegistryHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-trace-edge-type-registry';
import {
  readRequirementsContractForRequirementRecord,
  type RequirementsContractLogicalReadInput,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-read-facade';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { readConfirmedTraceSliceContract } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/run-confirmed-trace-slice';
import { readFunctionalResumeContract } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-functional-resume-check';
import {
  evaluateAiTddContractGate,
  readAiTddContract,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/ai-tdd-contract-gate';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;

function logicalRead(
  root: string,
  consumerId: string,
  hashes: { semanticModelHash?: string; traceGraphHash?: string } = {}
): RequirementsContractLogicalReadInput {
  return {
    projectRoot: root,
    consumerId,
    mode: 'execution',
    requirementSetId: 'req-cmd-18c1',
    expectedSemanticModelHash: hashes.semanticModelHash ?? HASH_A,
    expectedTraceGraphHash: hashes.traceGraphHash ?? HASH_B,
  };
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function writeText(root: string, relativePath: string, value: string): string {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
  return sha256(readFileSync(target));
}

function writeJson(root: string, relativePath: string, value: unknown): string {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(target, serialized, 'utf8');
  return sha256(serialized);
}

function writeCanonicalV2Fixture(root: string): {
  semanticModelHash: string;
  traceGraphHash: string;
  sourceDocumentHash: string;
  record: Record<string, unknown>;
  recordPath: string;
  sourcePath: string;
} {
  const requirementSetId = 'req-cmd-18c1';
  const sourceRequirementId = 'FR-001';
  const requirementId = `MUST-${sourceRequirementId}`;
  const recordId = 'RECORD-CMD-18C1';
  const sourcePath = 'docs/requirements/REQ-CMD-18C1.md';
  const sourceHash = writeText(root, sourcePath, '# CMD-18C1\n');
  const requirement = {
    id: requirementId,
    kind: 'functional',
    schemaVersion: 'requirement-contract-requirement/v2',
    text: 'Production semantic consumers read through the canonical facade.',
    source: {
      sourcePath,
      sourceSpan: { startLine: 1, endLine: 1 },
      sourceHash,
      sourceRequirementId,
      headingPath: ['Requirements'],
    },
    semantics: {
      actor: 'registered_consumer',
      trigger: 'a production semantic read is requested',
      preconditions: [],
      action: 'resolve the canonical Requirement Record Bundle',
      postconditions: [],
      invariants: [],
      thresholds: [],
    },
    authority: {
      authorityState: 'source_grounded',
      derivation: 'source_requirement',
      decisionReceiptRef: null,
    },
    applicability: { state: 'applicable', reasonCode: 'source_authorized' },
    unresolved: [],
    verification: {
      method: 'behavior_test',
      oracleRef: null,
      commandRefs: [],
      expectedObservationRefs: [],
    },
    bindings: { targetRefs: [], artifactRefs: [], traceEdgeRefs: [] },
  };
  const bodyHash = sha256Stable(requirement);
  const semanticPreimage = {
    schemaVersion: 'requirement-contract-model/v2',
    activationState: 'inactive_schema_boundary',
    recordId,
    requirementSetId,
    sourceAuthorityHash: sourceHash,
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
          proofRefs: ['PROOF-001'],
        },
        proofBindings: ['PROOF-001'],
      },
    },
    edges: {},
  };
  const semanticModelHash = sha256Stable(semanticPreimage);
  const tracePreimage = {
    schemaVersion: 'requirements-contract-trace-graph/v1',
    requirementSetId,
    edges: {},
    traceRows: [
      {
        id: 'TRACE-001',
        contractValidationCommandRefs: ['CMD-TRACE-001'],
        deliveryEvidenceCommandRefs: [],
      },
    ],
  };
  const traceGraphHash = sha256Stable(tracePreimage);
  const logicalModel = { ...semanticPreimage, semanticModelHash };
  const traceGraph = { ...tracePreimage, traceGraphHash };
  const revision = 'BUNDLE-REV-001';
  const revisionRoot = `_bmad-output/runtime/requirement-records/${requirementSetId}/authoring/revisions/${revision}`;
  const command = { id: 'CMD-TRACE-001', command: 'node -e "process.exit(0)"' };
  const projectionValues: Record<string, unknown> = {
    target_bindings: {
      traceGraphHash,
      targetModificationPaths: [],
      artifactAutomationPlan: [],
    },
    task_graph: { traceGraphHash, requiredCommands: [command] },
    red_contracts: { traceGraphHash, negativeControls: [] },
    oracle_registry: { traceGraphHash, oracles: [] },
    acceptance_manifest: {
      traceGraphHash,
      requiredCommands: [command],
      acceptance: [],
      acceptanceTests: [],
      e2eSuites: [],
    },
    evidence_requirements: {
      traceGraphHash,
      functionalResumeFailureCaseRegistry: { status: 'pass', groups: [] },
    },
    business_behavior_delta: { traceGraphHash, entries: [] },
    implementation_impact_map: { traceGraphHash, entries: [] },
  };
  const projectionSchemas: Record<string, string> = {
    target_bindings: 'requirements-contract-target-bindings/v1',
    task_graph: 'requirements-contract-task-graph/v1',
    red_contracts: 'requirements-contract-red-contracts/v1',
    oracle_registry: 'requirements-contract-oracle-registry/v1',
    acceptance_manifest: 'requirements-contract-acceptance-manifest/v1',
    evidence_requirements: 'requirements-contract-evidence-requirements/v1',
    business_behavior_delta: 'requirements-contract-business-behavior-delta/v1',
    implementation_impact_map: 'requirements-contract-implementation-impact-map/v1',
  };
  const projectionFileNames: Record<string, string> = {
    target_bindings: 'target-bindings',
    task_graph: 'task-graph',
    red_contracts: 'red-contracts',
    oracle_registry: 'oracle-registry',
    acceptance_manifest: 'acceptance-contracts',
    evidence_requirements: 'evidence-requirements',
    business_behavior_delta: 'business-behavior-delta',
    implementation_impact_map: 'implementation-impact-map',
  };
  const memberRows = [
    ['semantic-ir.json', 'requirement-contract-model/v2', 'semantic_ir', logicalModel],
    ['trace-graph.json', 'requirements-contract-trace-graph/v1', 'trace_graph', traceGraph],
    ...Object.entries(projectionValues).map(([role, value]) => [
      `${projectionFileNames[role]}.json`,
      projectionSchemas[role],
      role,
      value,
    ]),
  ].map(([fileName, schemaVersion, role, value]) => ({
    path: `${revisionRoot}/${String(fileName)}`,
    schemaVersion: String(schemaVersion),
    role: String(role),
    hash: writeJson(root, `${revisionRoot}/${String(fileName)}`, value),
    safeWriteReceiptRef: `SAFE-WRITE-${String(role)}`,
  }));
  writeJson(root, `${revisionRoot}/bundle-manifest.json`, {
    schemaVersion: 'requirements-contract-runtime-bundle-manifest/v1',
    canonicalByteDomain: 'requirements-contract-runtime-bundle-manifest/v1',
    requirementSetId,
    sourceAuthorityHash: sourceHash,
    semanticModelHash,
    traceGraphHash,
    baseRevision: 0,
    bundleRevision: revision,
    expectedCommittedRecordRevision: 1,
    atomicCommitId: 'ATOMIC-COMMIT-CMD-18C1',
    controlEventId: 'CONTROL-EVENT-CMD-18C1',
    authority: 'none',
    sourcePrdBackReferences: {
      sourceDocumentPath: sourcePath,
      implementationConfirmationBundleManifestPath: `${revisionRoot}/bundle-manifest.json`,
      acceptanceContractsPath: `${revisionRoot}/acceptance-contracts.json`,
    },
    upstreamProofs: {
      intakeReceipt: { path: 'proofs/intake.json', hash: HASH_A },
      intentLineageLedger: { path: 'proofs/lineage.json', hash: HASH_A },
      semanticConservationManifest: { path: 'proofs/conservation.json', hash: HASH_A },
    },
    members: memberRows,
  });
  const record = {
    schemaVersion: 'requirement-record/v1',
    recordId,
    requirementSetId,
    sourcePath,
    status: 'user_confirmed',
    sourceDocumentHash: sourceHash,
    semanticModelHash,
    traceGraphHash,
    activeBundleRevision: revision,
  };
  const recordPath = `_bmad-output/runtime/requirement-records/${requirementSetId}/requirement-record.json`;
  writeJson(root, recordPath, record);
  writeJson(
    root,
    '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json',
    {
      schemaVersion: 'requirements-contract-consumer-registry/v1',
      activation: {
        shadowOutputEnabled: false,
        v1OutputEnabled: false,
        productionReadModelVersion: 'v2',
      },
      consumers: [
        'run-confirmed-trace-slice',
        'main-agent-functional-resume-check',
        'ai-tdd-contract-gate',
      ].map((consumerId) => ({
        consumerId,
        readFacadeRef: 'requirements-contract-read-facade/v1',
        adapterRef: 'requirements-contract-v2-read-adapter/v1',
        sourceFormatVersion: 'requirement-contract-model/v2',
        validationModes: ['draft', 'execution', 'closeout'],
      })),
    }
  );
  return {
    semanticModelHash,
    traceGraphHash,
    sourceDocumentHash: sourceHash,
    record,
    recordPath,
    sourcePath,
  };
}

describe('CMD-18C1 Read Facade production migration', () => {
  it('blocks a record-bound semantic read before a caller can inspect raw source fields', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'cmd-18c1-read-facade-'));
    try {
      const result = readRequirementsContractForRequirementRecord(
        logicalRead(root, 'run-confirmed-trace-slice')
      );

      expect(result).toMatchObject({
        ok: false,
        decision: 'block',
        adapterInvoked: false,
      });
      expect(result.issues.map((issue) => issue.code)).toEqual(['requirement_record_missing']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks V2 callers at the facade before reading a poisoned source document', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'cmd-18c1-poisoned-source-'));
    try {
      writeFileSync(
        path.join(root, 'poison.md'),
        '```yaml\nimplementationConfirmation: [\n',
        'utf8'
      );
      writeJson(
        root,
        '_bmad-output/runtime/requirement-records/req-cmd-18c1/requirement-record.json',
        {
          schemaVersion: 'requirement-record/v1',
          requirementSetId: 'req-cmd-18c1',
          sourcePath: 'poison.md',
          sourceDocumentHash: HASH_A,
          semanticModelHash: HASH_A,
          traceGraphHash: HASH_B,
          activeBundleRevision: 'BUNDLE-REV-001',
        }
      );

      for (const readConsumer of [
        readConfirmedTraceSliceContract,
        readFunctionalResumeContract,
        readAiTddContract,
      ]) {
        const result = readConsumer({
          ...logicalRead(root, 'ignored-by-consumer-helper'),
          traceId: 'TRACE-001',
        });
        expect(result.issues.map((issue: { code: string }) => issue.code)).toEqual([
          'consumer_registry_missing',
        ]);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['run-confirmed-trace-slice', readConfirmedTraceSliceContract],
    ['main-agent-functional-resume-check', readFunctionalResumeContract],
    ['ai-tdd-contract-gate', readAiTddContract],
  ])('routes %s through the record-bound facade', (_consumerId, readConsumer) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'cmd-18c1-consumer-'));
    try {
      const result = readConsumer({
        ...logicalRead(root, _consumerId),
        traceId: 'TRACE-001',
      });

      expect(result).toMatchObject({
        ok: false,
        decision: 'block',
        adapterInvoked: false,
      });
      expect(result.issues.map((issue: { code: string }) => issue.code)).toContain(
        'requirement_record_missing'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads the three production consumers from one active Bundle and one Trace Graph', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'cmd-18c1-v2-positive-'));
    try {
      const hashes = writeCanonicalV2Fixture(root);
      const run = readConfirmedTraceSliceContract({
        ...logicalRead(root, 'run-confirmed-trace-slice', hashes),
        traceId: 'TRACE-001',
      });
      const functional = readFunctionalResumeContract({
        ...logicalRead(root, 'main-agent-functional-resume-check', hashes),
        traceId: 'TRACE-001',
      });
      const aiTdd = readAiTddContract({
        ...logicalRead(root, 'ai-tdd-contract-gate', hashes),
        traceId: 'TRACE-001',
      });

      expect(run).toMatchObject({
        ok: true,
        decision: 'pass',
        traceGraph: { traceGraphHash: hashes.traceGraphHash },
        traceRow: { id: 'TRACE-001' },
        requiredCommands: [{ id: 'CMD-TRACE-001' }],
      });
      expect(functional).toMatchObject({
        ok: true,
        decision: 'pass',
        traceGraph: { traceGraphHash: hashes.traceGraphHash },
        projections: {
          evidence_requirements: {
            traceGraphHash: hashes.traceGraphHash,
          },
        },
      });
      expect(aiTdd).toMatchObject({
        ok: true,
        decision: 'pass',
        traceGraph: { traceGraphHash: hashes.traceGraphHash },
        projections: {
          target_bindings: {
            traceGraphHash: hashes.traceGraphHash,
            targetModificationPaths: [],
            artifactAutomationPlan: [],
          },
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not reconstruct a legacy currentTargetMap in an active V2 AI-TDD manifest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'cmd-18c1-v2-ai-tdd-hard-cut-'));
    try {
      const fixture = writeCanonicalV2Fixture(root);

      const result = evaluateAiTddContractGate({
        sourcePath: path.join(root, fixture.sourcePath),
        record: fixture.record,
        recordPath: path.join(root, fixture.recordPath),
        mode: 'pre-implementation',
        evaluatedAt: '2026-07-19T06:30:00.000Z',
        evaluatedBy: 'cmd-18c1-qualified-red',
      });
      expect(result.reportType).toBe('ai_tdd_contract_gate_report');
      expect(String(result.sourcePath)).toContain('cmd-18c1-v2-ai-tdd-hard-cut-');
      expect(String(result.recordPath)).toContain('cmd-18c1-v2-ai-tdd-hard-cut-');
      const manifest = result.contractExecutionManifest as Record<string, unknown>;

      expect(manifest).toBeDefined();
      expect(manifest.sourceDocumentHash).toBe(fixture.sourceDocumentHash);
      expect(Object.prototype.hasOwnProperty.call(manifest, 'currentTargetMap')).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
