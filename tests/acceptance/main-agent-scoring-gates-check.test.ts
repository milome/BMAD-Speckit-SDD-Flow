import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveScoringPolicy } from '../../packages/scoring/policy';
import { mainDeliveryCloseoutGate } from '../../scripts/main-agent-delivery-closeout-gate';
import { mainIngestImplementationEvidence } from '../../scripts/ingest-implementation-evidence';
import { mainScoringGatesCheck } from '../../scripts/main-agent-scoring-gates-check';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH =
  'sha256:2222222222222222222222222222222222222222222222222222222222222222';
const ARCHITECTURE_HASH = 'sha256:3333333333333333333333333333333333333333333333333333333333333333';

const globalContractTraceabilityPolicy = {
  schemaVersion: 'global-contract-traceability-policy/v1',
  appliesToEntryFlows: ['bugfix', 'standalone_tasks', 'story'],
  contractAuthoringRequired: true,
  taskBindingRequired: true,
  taskBindingDimensions: ['MUST', 'NEG', 'OUT', 'EVD', 'TRACE'],
  missingBindingBehavior: 'fail_closed',
  sourceDocumentHashRequired: true,
  implementationConfirmationHashRequired: true,
  reconfirmOnTraceSemanticChange: true,
  allowUnboundImplementationTask: false,
};

const traceStatusPolicy = {
  schemaVersion: 'trace-status-policy/v1',
  allowedStatuses: [
    'PENDING',
    'PASS',
    'FAIL',
    'BLOCKED',
    'LINKED_DOWNSTREAM',
    'USER_APPROVED_DEFERRED',
    'USER_APPROVED_OUT_OF_SCOPE',
  ],
  terminalFullCloseoutStatuses: ['PASS', 'FAIL', 'BLOCKED'],
  linkedDownstreamRequiredFields: [
    'downstreamRecordId',
    'downstreamStoryRef',
    'downstreamSourceDocumentPath',
    'downstreamSourceDocumentHash',
    'downstreamScopeSummary',
    'downstreamRequirementIds',
    'downstreamAuditEvidenceRefs',
  ],
  userApprovedDeferredRequiredFields: [
    'userApprovalRef',
    'approvedAt',
    'approvedBy',
    'impactSummary',
    'followUpRecordId',
  ],
  userApprovedOutOfScopeRequiredFields: [
    'userApprovalRef',
    'approvedAt',
    'approvedBy',
    'impactSummary',
  ],
  bareDeferredForbidden: true,
  bareOutOfScopeForbidden: true,
  fullCloseoutForUserScopedStatusesForbidden: true,
};

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(readFileSync(file)).digest('hex')}`;
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function artifactRef(root: string, file: string, artifactType: string, role = 'evidence') {
  return {
    eventType: 'artifact_indexed',
    artifactType,
    sourceOfTruthRole: role,
    path: path.relative(root, file).replace(/\\/g, '/'),
    contentHash: sha256File(file),
    producer: 'main-agent-scoring-gates-check.test',
    purpose: 'prove score materialization/evaluation gate behavior',
    relatedRequirementIds: ['MUST-027', 'NEG-015', 'OUT-013', 'EVD-027', 'TRACE-020'],
    status: 'active',
    inputVersion: `source=${SOURCE_HASH};implementation=${IMPLEMENTATION_HASH};architecture=${ARCHITECTURE_HASH}`,
    outputVersion: `${artifactType}/v1`,
    traceRows: ['TRACE-020'],
    evidenceRefs: ['EVD-027'],
  };
}

function writeFixture(root: string, overrides: Record<string, unknown> = {}) {
  fs.mkdirSync(path.join(root, '_bmad', '_config'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages', 'scoring', 'rules'), { recursive: true });
  fs.cpSync(
    path.join(process.cwd(), '_bmad', '_config', 'scoring-policy.contract.yaml'),
    path.join(root, '_bmad', '_config', 'scoring-policy.contract.yaml')
  );
  fs.cpSync(
    path.join(process.cwd(), 'packages', 'scoring', 'rules'),
    path.join(root, 'packages', 'scoring', 'rules'),
    {
      recursive: true,
    }
  );
  const resolvedScoringPolicy = resolveScoringPolicy({ root });
  const base = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-SCORING-GATES'
  );
  const recoveryDir = path.join(base, 'recovery');
  const scoringDir = path.join(base, 'scoring');
  mkdirSync(recoveryDir, { recursive: true });
  mkdirSync(scoringDir, { recursive: true });
  const runtimePolicySnapshotPath = path.join(recoveryDir, 'runtime-policy-snapshot.json');
  writeJson(runtimePolicySnapshotPath, {
    kind: 'runtime-policy-snapshot',
    schemaVersion: 'runtime-policy-snapshot/v1',
    recordId: 'REQ-SCORING-GATES',
    requirementSetId: 'REQ-SCORING-GATES',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    architectureConfirmationHash: ARCHITECTURE_HASH,
    policyHash: SOURCE_HASH,
    policy: {
      flow: 'standalone_tasks',
      stage: 'implement',
      strictness: 'strict',
      scoringEnabled: true,
    },
    resolvedScoringPolicy,
    locale: 'zh-CN',
    host: 'codex',
    stage: 'implement',
    strictness: 'strict',
    mandatoryGates: [],
    localeIsolation: {
      localeAffectsConfirmationLanguage: false,
      localeAffectsRequirementSemantics: false,
      localeAffectsPassEvidence: false,
      localeAffectsCloseout: false,
    },
  });
  const scoreRecordPath = path.join(scoringDir, 'score-record.json');
  const scoringGateReportPath = path.join(scoringDir, 'scoring-gate-report.json');
  writeJson(scoreRecordPath, {
    eventType: 'score_written',
    scoreWriteResult: 'ok',
    scoringPolicyHash: resolvedScoringPolicy.scoringPolicyHash,
    display: { visible: true },
    evaluation: { decision: 'pass', thresholdPassed: true, dimensionVetoes: [] },
  });
  writeJson(scoringGateReportPath, {
    reportType: 'scoring_gates_report',
    decision: 'pass',
    checks: [
      { id: 'score-materialization-gate-pass', passed: true },
      { id: 'score-evaluation-gate-pass', passed: true },
    ],
  });
  const scoreRef = artifactRef(root, scoreRecordPath, 'score_record', 'evidence');
  const scoringGateReportRef = artifactRef(
    root,
    scoringGateReportPath,
    'scoring_gate_report',
    'evidence'
  );
  const runtimeRef = artifactRef(
    root,
    runtimePolicySnapshotPath,
    'runtime_policy_snapshot',
    'projection'
  );
  const recordPath = path.join(base, 'requirement-record.json');
  const record = {
    recordId: 'REQ-SCORING-GATES',
    requirementSetId: 'REQ-SCORING-GATES',
    status: 'user_confirmed',
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-SCORING-GATES',
        requirementSetId: 'REQ-SCORING-GATES',
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'docs/design/contract.md',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        confirmationPageHash:
          'sha256:4444444444444444444444444444444444444444444444444444444444444444',
        confirmationText: 'confirmed',
        renderReportPath: 'confirmation-render-report.json',
        htmlPath: 'confirmation.html',
      },
    ],
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash: ARCHITECTURE_HASH,
    },
    runtimePolicySnapshotRef: runtimeRef,
    globalContractTraceabilityPolicy,
    traceStatusPolicy,
    artifactIndex: [runtimeRef, scoreRef, scoringGateReportRef],
    gateChecks: [
      {
        eventType: 'gate_check_recorded',
        checkId: 'score-materialization:001',
        gate: 'score_materialization',
        decision: 'pass',
      },
      {
        eventType: 'gate_check_recorded',
        checkId: 'score-evaluation:001',
        gate: 'score_evaluation',
        decision: 'pass',
      },
    ],
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-SCORING-GATES-CHECK',
          command:
            'npx ts-node --project tsconfig.node.json --transpile-only scripts/main-agent-scoring-gates-check.ts',
          commandType: 'delivery_evidence',
          blockingIfMissing: true,
          negativeOrRegression: true,
          artifactRefs: [scoreRef],
        },
      ],
    },
    executionIterations: [
      {
        eventType: 'execution_iteration_recorded',
        recordId: 'REQ-SCORING-GATES',
        requirementSetId: 'REQ-SCORING-GATES',
        executionIterationId: 'exec-scoring-001',
        runId: 'run-scoring-001',
        status: 'done',
        traceRows: ['TRACE-020'],
        evidenceRefs: ['EVD-027'],
        commandRunRefs: [
          {
            commandId: 'CMD-SCORING-GATES-CHECK',
            command:
              'npx ts-node --project tsconfig.node.json --transpile-only scripts/main-agent-scoring-gates-check.ts',
            runId: 'run-scoring-001',
            closeoutAttemptId: 'closeout-scoring-001',
            exitCode: 0,
            startedAt: '2026-05-19T00:00:00.000Z',
            completedAt: '2026-05-19T00:00:05.000Z',
          },
        ],
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        architectureConfirmationHash: ARCHITECTURE_HASH,
        recordedAt: '2026-05-19T00:00:05.000Z',
        recordedBy: 'test-agent',
      },
    ],
    requirementClosures: [
      {
        eventType: 'requirement_closure_recorded',
        recordId: 'REQ-SCORING-GATES',
        requirementSetId: 'REQ-SCORING-GATES',
        requirementId: 'MUST-027',
        status: 'pass',
        recordedAt: '2026-05-19T00:00:05.000Z',
        recordedBy: 'test-agent',
      },
    ],
    ...overrides,
  };
  writeJson(recordPath, record);
  return { recordPath, scoreRecordPath, scoreRef };
}

describe('main-agent scoring gates check', () => {
  it('passes only through score_materialization and score_evaluation gateChecks', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'scoring-gates-pass-'));
    try {
      const { recordPath } = writeFixture(root);
      const prev = process.cwd();
      process.chdir(root);
      try {
        const code = mainScoringGatesCheck(['--requirement-record', recordPath, '--json']);
        expect(code).toBe(0);
      } finally {
        process.chdir(prev);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when scoring.required=true but gateChecks are missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'scoring-gates-missing-'));
    try {
      const { recordPath } = writeFixture(root, { gateChecks: [] });
      const prev = process.cwd();
      process.chdir(root);
      try {
        const code = mainScoringGatesCheck(['--requirement-record', recordPath, '--json']);
        expect(code).toBe(1);
      } finally {
        process.chdir(prev);
      }
      const report = JSON.parse(
        readFileSync(path.join(path.dirname(recordPath), 'scoring-gates-report.json'), 'utf8')
      );
      expect(report.blockingReasons).toContain('score_materialization_gate_missing');
      expect(report.blockingReasons).toContain('score_evaluation_gate_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks when runtime snapshot does not carry ResolvedScoringPolicy', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'scoring-gates-no-policy-'));
    try {
      const { recordPath } = writeFixture(root);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const snapshotPath = path.resolve(root, record.runtimePolicySnapshotRef.path);
      const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
      delete snapshot.resolvedScoringPolicy;
      writeJson(snapshotPath, snapshot);
      record.runtimePolicySnapshotRef.contentHash = sha256File(snapshotPath);
      record.artifactIndex[0].contentHash = record.runtimePolicySnapshotRef.contentHash;
      writeJson(recordPath, record);
      const prev = process.cwd();
      process.chdir(root);
      try {
        expect(mainScoringGatesCheck(['--requirement-record', recordPath, '--json'])).toBe(1);
      } finally {
        process.chdir(prev);
      }
      const report = JSON.parse(
        readFileSync(path.join(path.dirname(recordPath), 'scoring-gates-report.json'), 'utf8')
      );
      expect(report.blockingReasons).toContain('runtime_snapshot_resolved_scoring_policy_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks score records produced with a policy hash that bypasses resolveScoringPolicy', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'scoring-gates-policy-mismatch-'));
    try {
      const { recordPath, scoreRecordPath } = writeFixture(root);
      const score = JSON.parse(readFileSync(scoreRecordPath, 'utf8'));
      score.scoringPolicyHash = SOURCE_HASH;
      writeJson(scoreRecordPath, score);
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      const scoreRef = record.artifactIndex.find(
        (artifact: { artifactType: string }) => artifact.artifactType === 'score_record'
      );
      scoreRef.contentHash = sha256File(scoreRecordPath);
      writeJson(recordPath, record);
      const prev = process.cwd();
      process.chdir(root);
      try {
        expect(mainScoringGatesCheck(['--requirement-record', recordPath, '--json'])).toBe(1);
      } finally {
        process.chdir(prev);
      }
      const report = JSON.parse(
        readFileSync(path.join(path.dirname(recordPath), 'scoring-gates-report.json'), 'utf8')
      );
      expect(report.blockingReasons).toContain('score_policy_hash_mismatch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires score_write_failed failure record when materialization fails', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'scoring-gates-write-fail-'));
    try {
      const { recordPath } = writeFixture(root, {
        gateChecks: [
          {
            eventType: 'gate_check_recorded',
            checkId: 'score-materialization:fail',
            gate: 'score_materialization',
            decision: 'fail',
          },
        ],
      });
      const prev = process.cwd();
      process.chdir(root);
      try {
        expect(mainScoringGatesCheck(['--requirement-record', recordPath, '--json'])).toBe(1);
      } finally {
        process.chdir(prev);
      }
      const report = JSON.parse(
        readFileSync(path.join(path.dirname(recordPath), 'scoring-gates-report.json'), 'utf8')
      );
      expect(report.blockingReasons).toContain('score_write_failed_failure_record_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires failure record and rerun loop when score evaluation fails', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'scoring-gates-eval-fail-'));
    try {
      const { recordPath } = writeFixture(root, {
        gateChecks: [
          {
            eventType: 'gate_check_recorded',
            checkId: 'score-materialization:pass',
            gate: 'score_materialization',
            decision: 'pass',
          },
          {
            eventType: 'gate_check_recorded',
            checkId: 'score-evaluation:fail',
            gate: 'score_evaluation',
            decision: 'fail',
          },
        ],
        failureRecords: [
          {
            eventType: 'failure_recorded',
            failureId: 'failure-score-evaluation',
            type: 'score_threshold_or_dimension_failed',
            status: 'open',
            sourceRefs: [{ sourceType: 'gate_check', id: 'score-evaluation:fail' }],
            recordedAt: '2026-05-19T00:00:00.000Z',
            recordedBy: 'test-agent',
          },
        ],
        rerunLoops: [
          {
            rerunLoopId: 'rerun-score-evaluation',
            status: 'open',
            sourceRefs: [{ sourceType: 'gate_check', id: 'score-evaluation:fail' }],
          },
        ],
      });
      const prev = process.cwd();
      process.chdir(root);
      try {
        expect(mainScoringGatesCheck(['--requirement-record', recordPath, '--json'])).toBe(1);
      } finally {
        process.chdir(prev);
      }
      const report = JSON.parse(
        readFileSync(path.join(path.dirname(recordPath), 'scoring-gates-report.json'), 'utf8')
      );
      expect(report.blockingReasons).toContain('score_evaluation_gate_failed');
      expect(report.blockingReasons).toContain('open_score_failure_record_exists');
      expect(report.blockingReasons).not.toContain('score_evaluation_rerun_loop_missing');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('controlled ingest can record score gates, score failures, and rerun loop sourceRefs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'scoring-gates-ingest-'));
    try {
      const { recordPath, scoreRecordPath, scoreRef } = writeFixture(root, {
        gateChecks: [],
        failureRecords: [],
        rerunLoops: [],
      });
      const packetPath = path.join(path.dirname(scoreRecordPath), 'packet.json');
      writeJson(packetPath, {
        eventType: 'execution_iteration_recorded',
        recordId: 'REQ-SCORING-GATES',
        requirementSetId: 'REQ-SCORING-GATES',
        executionIterationId: 'exec-score-failed-001',
        runId: 'run-score-failed-001',
        status: 'rerun_required',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        architectureConfirmationHash: ARCHITECTURE_HASH,
        traceRows: ['TRACE-020'],
        taskRefs: ['TASK-SCORING-POLICY-GATES'],
        evidenceRefs: ['EVD-027'],
        filesChanged: [
          'scripts/ingest-implementation-evidence.ts',
          'scripts/main-agent-scoring-gates-check.ts',
        ],
        implementationDelta: {
          filesChanged: [
            'scripts/ingest-implementation-evidence.ts',
            'scripts/main-agent-scoring-gates-check.ts',
          ],
          diffSummaryRef: 'scoring/score-record.json',
          behaviorAffecting: true,
          negativeAssertionArtifactRefs: [scoreRef],
        },
        commandRuns: [
          {
            commandId: 'CMD-SCORING-GATES-INGEST',
            command: 'npx vitest run tests/acceptance/main-agent-scoring-gates-check.test.ts',
            runId: 'run-score-failed-001',
            closeoutAttemptId: 'closeout-score-failed-001',
            exitCode: 0,
            startedAt: '2026-05-19T00:00:00.000Z',
            completedAt: '2026-05-19T00:00:05.000Z',
          },
        ],
        artifactRefs: [scoreRef],
        deliveryEvidence: {
          requiredCommands: [
            {
              commandId: 'CMD-SCORING-GATES-INGEST',
              command: 'npx vitest run tests/acceptance/main-agent-scoring-gates-check.test.ts',
              commandType: 'delivery_evidence',
              blockingIfMissing: true,
              negativeOrRegression: true,
              artifactRefs: [scoreRef],
            },
          ],
        },
        gateChecks: [
          {
            gate: 'score_materialization',
            decision: 'pass',
            checkId: 'score-materialization:ingest',
          },
          { gate: 'score_evaluation', decision: 'fail', checkId: 'score-evaluation:ingest' },
        ],
        failureRecords: [
          {
            failureId: 'failure-score-evaluation-ingest',
            type: 'score_threshold_or_dimension_failed',
            status: 'open',
            sourceRefs: [{ sourceType: 'gate_check', id: 'score-evaluation:ingest' }],
          },
        ],
        rerunLoops: [
          {
            rerunLoopId: 'rerun-score-evaluation-ingest',
            status: 'open',
            sourceRefs: [{ sourceType: 'gate_check', id: 'score-evaluation:ingest' }],
            blockerRefs: [{ sourceType: 'failure_record', id: 'failure-score-evaluation-ingest' }],
          },
        ],
        closeoutAttemptId: 'closeout-score-failed-001',
      });
      const prev = process.cwd();
      process.chdir(root);
      try {
        expect(
          mainIngestImplementationEvidence([
            '--evidence',
            packetPath,
            '--requirement-record',
            recordPath,
          ])
        ).toBe(0);
      } finally {
        process.chdir(prev);
      }
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.gateChecks.at(-1)).toMatchObject({
        gate: 'score_evaluation',
        decision: 'fail',
      });
      expect(record.failureRecords.at(-1)).toMatchObject({
        type: 'score_threshold_or_dimension_failed',
        status: 'open',
      });
      expect(record.rerunLoops.at(-1)).toMatchObject({
        rerunLoopId: 'rerun-score-evaluation-ingest',
        status: 'open',
      });
      expect(record.rerunLoops.at(-1)).not.toHaveProperty('result');
      expect(record.rerunLoops.at(-1)).not.toHaveProperty('decision');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('delivery closeout blocks unresolved score gate failures without reading score file as control', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'scoring-gates-closeout-'));
    try {
      const { recordPath } = writeFixture(root, {
        gateChecks: [
          {
            eventType: 'gate_check_recorded',
            gate: 'Implementation Readiness Gate',
            decision: 'pass',
          },
          {
            eventType: 'gate_check_recorded',
            checkId: 'score-materialization:pass',
            gate: 'score_materialization',
            decision: 'pass',
          },
          {
            eventType: 'gate_check_recorded',
            checkId: 'score-evaluation:fail',
            gate: 'score_evaluation',
            decision: 'fail',
          },
        ],
        failureRecords: [
          {
            eventType: 'failure_recorded',
            failureId: 'failure-score-evaluation-closeout',
            type: 'score_threshold_or_dimension_failed',
            status: 'open',
            sourceRefs: [{ sourceType: 'gate_check', id: 'score-evaluation:fail' }],
            recordedAt: '2026-05-19T00:00:00.000Z',
            recordedBy: 'test-agent',
          },
        ],
      });
      const prev = process.cwd();
      process.chdir(root);
      try {
        expect(
          mainDeliveryCloseoutGate([
            '--requirement-record',
            recordPath,
            '--attempt-id',
            'closeout-scoring-fail-001',
            '--json',
          ])
        ).toBe(1);
      } finally {
        process.chdir(prev);
      }
      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.closeout.attempts.at(-1).blockingReasons).toContain(
        'score_gate_failure_unresolved'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
