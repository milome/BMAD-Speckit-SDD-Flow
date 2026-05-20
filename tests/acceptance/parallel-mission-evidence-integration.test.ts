import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainDeliveryCloseoutGate } from '../../scripts/main-agent-delivery-closeout-gate';
import {
  buildParallelMissionPlan,
  buildPrTopology,
  evaluateParallelMissionEvidenceIntegration,
} from '../../scripts/parallel-mission-control';
import { sha256Object } from '../../scripts/subagent-evidence-envelope';

const SOURCE_HASH = 'sha256:043bd30ee5975f75196fa688964f7373a087eeca2464cd04cf725ecc8bc0e570';
const IMPLEMENTATION_HASH = 'sha256:837f69a7551c36022df0c4f76647b8f66d49c5f914a37074657d21a821bb6d9a';
const ARCHITECTURE_HASH = 'sha256:a3de7e8c4d97e8befc507e5edbb640ae706ccd418df9b2b6e047d7967cb8f9da';

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function artifact(root: string, artifactPath: string, relatedRequirementIds: string[] = ['MUST-048', 'NEG-037', 'EVD-047']) {
  return {
    artifactType: 'parallel_mission_node_evidence',
    sourceOfTruthRole: 'evidence',
    path: artifactPath.replace(/\\/gu, '/'),
    hash: sha256File(path.resolve(root, artifactPath)),
    producer: 'parallel-mission-evidence-integration.test',
    purpose: 'prove parallel mission node evidence integration',
    relatedRequirementIds,
    status: 'active',
    inputVersion: 'trace-037',
    outputVersion: 'parallel-mission-evidence-integration-v1',
  };
}

function plan() {
  return buildParallelMissionPlan({
    batchId: 'parallel-batch',
    nodes: [
      {
        node_id: 'node-a',
        story_key: 'S1',
        packet_id: 'packet-a',
        write_scope: ['src/a.ts'],
        depends_on: [],
        assigned_agent: 'worker-a',
        target_branch: 'task/a',
        target_pr: 'PR-A',
      },
      {
        node_id: 'node-b',
        story_key: 'S2',
        packet_id: 'packet-b',
        write_scope: ['src/b.ts'],
        depends_on: ['node-a'],
        assigned_agent: 'worker-b',
        target_branch: 'task/b',
        target_pr: 'PR-B',
      },
    ],
  });
}

function record(root: string, reportArtifactRefs: Record<string, unknown>[] = []) {
  return {
    recordId: 'REQ-CLOSED-LOOP-DESIGN',
    requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
    status: 'user_confirmed',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
      resolvedRecipeHash: 'sha256:da10b7ad044a705fb04be14c32a0062e9dc5e91012e5d267a435b83c3ba86b75',
    },
    closeout: { currentAttemptId: 'closeout-current', attempts: [] },
    implementationEntryGate: { decision: 'pass' },
    architectureConfirmationStateChecks: [
      {
        decision: 'pass',
        resolvedRecipeHash: 'sha256:da10b7ad044a705fb04be14c32a0062e9dc5e91012e5d267a435b83c3ba86b75',
        stateTransition: { toStatus: 'active' },
      },
    ],
    gateChecks: [{ gate: 'Implementation Readiness Gate', decision: 'pass' }],
    requirementClosures: [
      { requirementId: 'MUST-048', status: 'pass' },
      { requirementId: 'NEG-037', status: 'pass' },
      { requirementId: 'TRACE-037', status: 'pass' },
    ],
    artifactIndex: reportArtifactRefs,
    failureRecords: [],
    rcaRecords: [],
    rerunLoops: [],
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-PARALLEL-MISSION-EVIDENCE-INTEGRATION',
          command: 'npx vitest run tests/acceptance/parallel-mission-evidence-integration.test.ts',
          blockingIfMissing: true,
          negativeOrRegression: true,
          closeoutAttemptId: 'closeout-current',
          artifactRefs: reportArtifactRefs,
        },
      ],
    },
    executionIterations: [
      {
        executionIterationId: 'exec-parallel-mission',
        commandRunRefs: [
          {
            commandId: 'CMD-PARALLEL-MISSION-EVIDENCE-INTEGRATION',
            closeoutAttemptId: 'closeout-current',
            exitCode: 0,
          },
        ],
      },
    ],
  };
}

function envelope(root: string, nodeId: string, packetId: string, artifactRefs: Record<string, unknown>[]) {
  return {
    envelopeVersion: 'subagent-evidence-envelope/v1',
    recordId: 'REQ-CLOSED-LOOP-DESIGN',
    requirementSetId: 'REQ-CLOSED-LOOP-DESIGN',
    parentRunId: 'parallel-run',
    parentCloseoutAttemptId: 'closeout-current',
    subtaskId: nodeId,
    packetId,
    packetKind: 'parallel_node',
    executorKind: 'parallel_mission_node',
    executorRole: 'implementation-worker',
    decisionAuthority: 'none',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_HASH,
    traceRows: ['TRACE-037'],
    coveredRequirementIds: ['MUST-048', 'NEG-037'],
    taskRefs: ['TASK-PARALLEL-MISSION-EVIDENCE-INTEGRATION'],
    allowedWriteScope: ['src/**'],
    actualFilesChanged: [nodeId === 'node-a' ? 'src/a.ts' : 'src/b.ts'],
    diffHash: sha256Object({ nodeId }),
    workspaceRef: { kind: 'worktree', path: root, commitBefore: 'before', commitAfter: 'after' },
    commandRuns: [
      {
        commandId: `CMD-${nodeId}`,
        command: 'node verify-node.js',
        exitCode: 0,
        startedAt: '2026-05-21T00:00:00.000Z',
        completedAt: '2026-05-21T00:00:01.000Z',
        outputSummary: 'node verification passed',
        artifactRefs,
        closeoutAttemptId: 'closeout-current',
      },
    ],
    artifactRefs,
    hookReceipts: [],
    transportRefs: [],
    status: 'accepted',
    failureRecords: [],
  };
}

describe('parallel mission evidence integration', () => {
  it('passes only with accepted node envelopes, dependency merge order, closed topology, and main workspace verification', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'parallel-mission-pass-'));
    try {
      writeJson(path.join(root, 'node-a.json'), { node: 'a' });
      writeJson(path.join(root, 'node-b.json'), { node: 'b' });
      writeJson(path.join(root, 'integrated.json'), { integrated: true });
      const nodeArtifactA = artifact(root, 'node-a.json');
      const nodeArtifactB = artifact(root, 'node-b.json');
      const integratedArtifact = artifact(root, 'integrated.json');
      const missionPlan = plan();
      const topology = buildPrTopology({
        plan: missionPlan,
        states: { 'node-a': 'merged', 'node-b': 'closed_not_needed' },
        evidence_provenance: { runId: 'run-1', storyKey: 'S1', evidenceBundleId: 'bundle-1' },
      });
      const report = evaluateParallelMissionEvidenceIntegration({
        plan: missionPlan,
        prTopology: topology,
        currentCloseoutAttemptId: 'closeout-current',
        projectRoot: root,
        record: record(root),
        nodeEvidence: [
          { node_id: 'node-a', envelope: envelope(root, 'node-a', 'packet-a', [nodeArtifactA]) },
          { node_id: 'node-b', envelope: envelope(root, 'node-b', 'packet-b', [nodeArtifactB]) },
        ],
        integratedVerification: {
          closeoutAttemptId: 'closeout-current',
          workspaceRef: { kind: 'main_workspace', path: root },
          commandRuns: [
            {
              commandId: 'CMD-INTEGRATED',
              closeoutAttemptId: 'closeout-current',
              exitCode: 0,
              artifactRefs: [integratedArtifact],
            },
          ],
          artifactRefs: [integratedArtifact],
        },
        generatedAt: '2026-05-21T00:00:02.000Z',
      });
      expect(report.decision).toBe('pass');
      expect(report.blockingReasons).toEqual([]);
      expect(report.nodeResults.every((node) => node.envelopeHash && node.passed)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks missing node envelope, merge order gaps, PR green without closed nodes, and missing integrated verification', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'parallel-mission-block-'));
    try {
      const missionPlan = plan();
      missionPlan.merge_order = ['node-b'];
      const topology = buildPrTopology({ plan: missionPlan, states: { 'node-a': 'open', 'node-b': 'merged' } });
      topology.all_affected_stories_passed = true;
      const report = evaluateParallelMissionEvidenceIntegration({
        plan: missionPlan,
        prTopology: topology,
        currentCloseoutAttemptId: 'closeout-current',
        projectRoot: root,
        record: record(root),
        nodeEvidence: [],
      });
      expect(report.decision).toBe('blocked');
      expect(report.blockingReasons).toEqual(
        expect.arrayContaining([
          'node_envelope_missing:node-a',
          'node_envelope_missing:node-b',
          'merge_order_missing_node:node-a',
          'merge_order_dependency_not_before_node:node-a->node-b',
          'pr_topology_green_with_open_nodes:node-a',
          'integrated_verification_missing',
        ])
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks overlapping write scopes without serialization proof', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'parallel-mission-conflict-'));
    try {
      const missionPlan = buildParallelMissionPlan({
        batchId: 'conflict-batch',
        nodes: [
          {
            node_id: 'node-a',
            story_key: 'S1',
            packet_id: 'packet-a',
            write_scope: ['src/shared.ts'],
            depends_on: [],
            assigned_agent: 'worker-a',
            target_branch: 'task/a',
            target_pr: 'PR-A',
          },
          {
            node_id: 'node-b',
            story_key: 'S2',
            packet_id: 'packet-b',
            write_scope: ['src/shared.ts'],
            depends_on: [],
            assigned_agent: 'worker-b',
            target_branch: 'task/b',
            target_pr: 'PR-B',
          },
        ],
      });
      missionPlan.conflicts = [];
      const topology = buildPrTopology({
        plan: missionPlan,
        states: { 'node-a': 'merged', 'node-b': 'closed_not_needed' },
        evidence_provenance: { runId: 'run-1', storyKey: 'S1', evidenceBundleId: 'bundle-1' },
      });
      const report = evaluateParallelMissionEvidenceIntegration({
        plan: missionPlan,
        prTopology: topology,
        currentCloseoutAttemptId: 'closeout-current',
        projectRoot: root,
        record: record(root),
        nodeEvidence: [],
        integratedVerification: {
          closeoutAttemptId: 'closeout-current',
          workspaceRef: { kind: 'main_workspace', path: root },
          commandRuns: [{ commandId: 'CMD-INTEGRATED', closeoutAttemptId: 'closeout-current', exitCode: 0, artifactRefs: [{}] }],
          artifactRefs: [{}],
        },
      });
      expect(report.blockingReasons).toContain('write_scope_conflict_unresolved:src/shared.ts:node-a,node-b');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks Delivery Closeout Gate when current parallel mission integration report is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'parallel-mission-closeout-missing-'));
    try {
      const recordPath = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-CLOSEOUT', 'requirement-record.json');
      writeJson(recordPath, record(root));
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-current',
        '--evaluated-at',
        '2026-05-21T00:00:00.000Z',
      ]);
      expect(code).toBe(1);
      const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(updated.closeout.decision).toBe('blocked');
      expect(updated.closeout.attempts[0].blockingReasons).toContain('parallel_mission_evidence_integration_report_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows Delivery Closeout Gate to consume a current pass integration report artifact', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'parallel-mission-closeout-pass-'));
    try {
      const reportPath = path.join(root, 'parallel-report.json');
      const report = {
        reportType: 'parallel_mission_evidence_integration_report',
        schemaVersion: 'parallel-mission-evidence-integration/v1',
        decision: 'pass',
        currentCloseoutAttemptId: 'closeout-current',
        blockingReasons: [],
        checks: [
          { id: 'node-envelopes-accepted', passed: true, issues: [] },
          { id: 'write-scope-proof', passed: true, issues: [] },
          { id: 'merge-order-proof', passed: true, issues: [] },
          { id: 'pr-topology-reconciliation', passed: true, issues: [] },
          { id: 'main-workspace-integrated-verification', passed: true, issues: [] },
        ],
        nodeResults: [{ node_id: 'node-a', passed: true, envelopeHash: 'sha256:'.concat('a'.repeat(64)) }],
        integratedVerification: { passed: true, commandCount: 1, artifactCount: 1 },
      };
      writeJson(reportPath, report);
      const reportArtifact = {
        artifactType: 'parallel_mission_evidence_integration_report',
        sourceOfTruthRole: 'evidence',
        path: reportPath,
        contentHash: sha256File(reportPath),
        producer: 'parallel-mission-evidence-integration.test',
        purpose: 'current attempt parallel mission evidence integration report',
        relatedRequirementIds: ['MUST-048', 'NEG-037', 'EVD-047'],
        status: 'active',
        inputVersion: 'trace-037',
        outputVersion: 'parallel-mission-evidence-integration-v1',
      };
      const recordPath = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-CLOSEOUT', 'requirement-record.json');
      writeJson(recordPath, record(root, [reportArtifact]));
      const code = mainDeliveryCloseoutGate([
        '--requirement-record',
        recordPath,
        '--attempt-id',
        'closeout-current',
        '--evaluated-at',
        '2026-05-21T00:00:00.000Z',
      ]);
      const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(updated.closeout.attempts[0].blockingReasons).not.toContain('parallel_mission_evidence_integration_report_missing');
      expect(updated.closeout.attempts[0].blockingReasons).not.toContain('parallel_mission_evidence_integration_current_report_missing');
      expect(code).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
