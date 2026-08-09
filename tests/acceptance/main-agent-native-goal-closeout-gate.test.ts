import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveArchitectureConfirmationHashRecipe } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/architecture-confirmation-hash-recipe';
import {
  evaluateControlledGoalCloseoutGate,
  mainDeliveryCloseoutGate,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-delivery-closeout-gate';
import { writeNativeGoalInvocationReceipt } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/host-runtime-mode';
import { createRecordedConfirmationHistory } from './helpers/requirement-record-confirmation-fixture';

const HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const RECORD_ID = 'REQ-NATIVE-CLOSEOUT';
const CLOSEOUT_ATTEMPT_ID = 'closeout-native';
const PACKET_ID = 'implement-native-codex';
const NATIVE_ATTEMPT_ID = 'implement-native-codex';
const GOAL_TEXT = '/goal Execute native closeout fixture';

describe('controlled goal delivery closeout binding', () => {
  it('publishes only awaiting_user_acceptance for current matching receipts', () => {
    const result = evaluateControlledGoalCloseoutGate({
      closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
      contextHash: HASH,
      closureReceipt: {
        status: 'campaign_closed',
        closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
        contextHash: HASH,
        taskReportArtifactHash: HASH,
        receiptHash: HASH,
      },
      taskReportArtifactHash: HASH,
      judgeReviewCampaign: {
        closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
        decision: 'pass',
        aggregateHash: HASH,
      },
      effectivePassReceipt: {
        effectivePass: true,
        effectivePassReceiptHash: HASH,
      },
    });
    expect(result).toMatchObject({
      status: 'awaiting_user_acceptance',
      closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
    });
    expect(result).not.toHaveProperty('completionReceipt');
    expect(() =>
      evaluateControlledGoalCloseoutGate({
        closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
        contextHash: HASH,
        closureReceipt: {
          status: 'campaign_closed',
          closeoutAttemptId: 'stale-attempt',
          contextHash: HASH,
          taskReportArtifactHash: HASH,
          receiptHash: HASH,
        },
        taskReportArtifactHash: HASH,
        judgeReviewCampaign: { decision: 'pass', aggregateHash: HASH },
        effectivePassReceipt: { effectivePass: true, effectivePassReceiptHash: HASH },
      })
    ).toThrow('main_agent_goal_task_report_provenance_mismatch');
  });
});

function sha256Buffer(value: Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath: string, value: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, 'utf8');
}

function modelResult(model: string) {
  return {
    payloadKind: 'model_result',
    model,
    recordId: RECORD_ID,
    requirementSetId: RECORD_ID,
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    status: 'pass',
    resultRecordedAt: '2026-06-19T00:00:00.000Z',
    resultRecordedBy: 'test-agent',
    blockingReasons: [],
    sourceRefs: [{ sourceType: 'fixture', id: model }],
    currentHashes: {
      sourceDocumentHash: HASH,
      implementationConfirmationHash: HASH,
    },
  };
}

function taskReportPath(root: string): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'governance',
    'task-reports',
    RECORD_ID,
    `${PACKET_ID}.json`
  );
}

function writeTaskReport(root: string): string {
  const filePath = taskReportPath(root);
  writeJson(filePath, {
    packetId: PACKET_ID,
    status: 'done',
    filesChanged: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-delivery-closeout-gate.ts'],
    validationsRun: ['native-closeout-fixture'],
    evidence: ['native closeout fixture TaskReport'],
    downstreamContext: ['native goal closeout fixture complete'],
  });
  return filePath;
}

function writeNativeReceipt(root: string, overrides: Record<string, unknown> = {}): string {
  const goalExecutionPath = path.join(root, 'goal_execution.md');
  writeText(goalExecutionPath, GOAL_TEXT);
  const stdoutRef = path.join(root, '_bmad-output', 'runtime', 'native-goal', 'logs', 'stdout.log');
  const stderrRef = path.join(root, '_bmad-output', 'runtime', 'native-goal', 'logs', 'stderr.log');
  writeText(stdoutRef, 'ok');
  writeText(stderrRef, '');
  const written = writeNativeGoalInvocationReceipt({
    projectRoot: root,
    recordId: RECORD_ID,
    attemptId: NATIVE_ATTEMPT_ID,
    packetId: PACKET_ID,
    host: 'codex',
    goalExecutionPath,
    goalCommandTextHash: sha256Text(GOAL_TEXT),
    command: 'codex',
    args: ['exec', GOAL_TEXT],
    taskReportPath: taskReportPath(root),
    nativeGoalCommandUsed: true,
    stdoutRef,
    stderrRef,
    exitCode: 0,
    startedAt: '2026-06-19T00:00:00.000Z',
    endedAt: '2026-06-19T00:00:01.000Z',
  });
  if (Object.keys(overrides).length > 0) {
    writeJson(written.path, { ...written.receipt, ...overrides });
  }
  return written.path;
}

function evidenceArtifactRef(root: string) {
  const evidencePath = path.join(root, 'delivery-evidence.json');
  writeJson(evidencePath, { ok: true });
  return {
    artifactType: 'implementation_evidence',
    sourceOfTruthRole: 'evidence',
    path: evidencePath,
    hash: sha256Buffer(readFileSync(evidencePath)),
    producer: 'main-agent-native-goal-closeout-gate.test',
    purpose: 'prove current closeout attempt delivery evidence',
    relatedRequirementIds: ['MUST-NATIVE-CLOSEOUT'],
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: 'artifact-v1',
  };
}

function baseRecord(root: string, extra: Record<string, unknown> = {}) {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const artifact = evidenceArtifactRef(root);
  const sourcePath = path.join(root, 'source.md');
  return {
    recordId: RECORD_ID,
    requirementSetId: RECORD_ID,
    status: 'user_confirmed',
    sourcePath,
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    confirmationHistory: createRecordedConfirmationHistory({
      recordId: RECORD_ID,
      sourcePath,
      sourceDocumentHash: HASH,
      implementationConfirmationHash: HASH,
    }),
    currentMentalModel: 'audit_review',
    sixModelResults: {
      requirement_confirmation: modelResult('requirement_confirmation'),
      architecture_confirmation: modelResult('architecture_confirmation'),
      implementation_readiness: modelResult('implementation_readiness'),
      execution_closure: modelResult('execution_closure'),
      audit_review: modelResult('audit_review'),
    },
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationRunId: 'arch-run-native',
      currentArchitectureConfirmationHash: HASH,
      resolvedRecipeHash: recipe.resolvedRecipeHash,
    },
    architectureConfirmationStateChecks: [
      {
        eventType: 'architecture_confirmation_recorded',
        decision: 'pass',
        resolvedRecipeHash: recipe.resolvedRecipeHash,
        stateTransition: { toStatus: 'active' },
      },
    ],
    gateChecks: [
      {
        eventType: 'gate_check_recorded',
        gate: 'Implementation Readiness Gate',
        decision: 'pass',
      },
    ],
    artifactIndex: [artifact],
    deliveryEvidence: {
      requiredCommands: [
        {
          commandId: 'CMD-NATIVE-CLOSEOUT',
          command: 'npx vitest run tests/acceptance/main-agent-native-goal-closeout-gate.test.ts',
          blockingIfMissing: true,
          negativeOrRegression: true,
          closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
          artifactRefs: [artifact],
        },
      ],
    },
    executionIterations: [
      {
        executionIterationId: 'exec-native-goal',
        executionRuntimeMode: 'native_goal',
        host: 'codex',
        packetId: PACKET_ID,
        attemptId: NATIVE_ATTEMPT_ID,
        goalExecutionHash: sha256Text(GOAL_TEXT),
        taskReportPath: taskReportPath(root),
        commandRunRefs: [
          {
            commandId: 'CMD-NATIVE-CLOSEOUT',
            closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
            exitCode: 0,
          },
        ],
      },
    ],
    requirementClosures: [{ requirementId: 'MUST-NATIVE-CLOSEOUT', status: 'pass' }],
    ...extra,
  };
}

function writeRecord(root: string, record: Record<string, unknown>): string {
  const recordPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    RECORD_ID,
    'requirement-record.json'
  );
  writeJson(recordPath, record);
  return recordPath;
}

function runCloseout(root: string, record: Record<string, unknown>) {
  const recordPath = writeRecord(root, record);
  const code = mainDeliveryCloseoutGate([
    '--requirement-record',
    recordPath,
    '--attempt-id',
    CLOSEOUT_ATTEMPT_ID,
    '--evaluated-at',
    '2026-06-19T00:00:00.000Z',
    '--json',
  ]);
  const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
  return { code, updated };
}

function cleanup(root: string): void {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

describe('main-agent native goal delivery closeout gate', () => {
  it('blocks native goal closeout when invocation receipt is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'native-closeout-missing-receipt-'));
    try {
      writeTaskReport(root);
      const { code, updated } = runCloseout(root, baseRecord(root));
      expect(code).toBe(1);
      expect(updated.closeout.attempts[0].blockingReasons).toContain(
        'native_goal_receipt_missing'
      );
    } finally {
      cleanup(root);
    }
  });

  it('blocks native goal closeout when invocation receipt is invalid', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'native-closeout-invalid-receipt-'));
    try {
      writeNativeReceipt(root, { packetId: 'stale-packet', stdoutRef: '' });
      writeTaskReport(root);
      const { code, updated } = runCloseout(root, baseRecord(root));
      expect(code).toBe(1);
      expect(updated.closeout.attempts[0].blockingReasons).toContain(
        'native_goal_receipt_invalid'
      );
      expect(updated.closeout.attempts[0].checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'native-goal-invocation-receipt',
            passed: false,
            reasonCode: 'native_goal_receipt_invalid',
          }),
        ])
      );
    } finally {
      cleanup(root);
    }
  });

  it('blocks native goal closeout when receipt exists but TaskReport is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'native-closeout-missing-task-report-'));
    try {
      writeNativeReceipt(root);
      const { code, updated } = runCloseout(root, baseRecord(root));
      expect(code).toBe(1);
      expect(updated.closeout.attempts[0].blockingReasons).toContain(
        'task_report_missing_after_native_goal'
      );
    } finally {
      cleanup(root);
    }
  });

  it('keeps pending rerun blocking while adding native goal receipt enforcement', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'native-closeout-pending-rerun-'));
    try {
      writeTaskReport(root);
      const { code, updated } = runCloseout(
        root,
        baseRecord(root, {
          rerunLoops: [
            {
              rerunLoopId: 'rerun-native-001',
              status: 'open',
              sourceRefs: [{ sourceType: 'execution_iteration', id: 'exec-native-goal' }],
              blockerRefs: [{ sourceType: 'failure_record', id: 'failure-native-001' }],
            },
          ],
        })
      );
      expect(code).toBe(1);
      expect(updated.closeout.attempts[0].blockingReasons).toEqual(
        expect.arrayContaining(['native_goal_receipt_missing', 'pending_rerun_exists'])
      );
    } finally {
      cleanup(root);
    }
  });
});
