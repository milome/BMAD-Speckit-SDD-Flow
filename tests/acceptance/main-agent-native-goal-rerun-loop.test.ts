import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  importNativeGoalTaskReport,
  resolveMainAgentOrchestrationSurface,
  runMainAgentAutomaticLoop,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { writeNativeGoalInvocationReceipt } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/host-runtime-mode';
import {
  canonicalCurrentDispatchPointerPath,
  executeRequiredCommandsForPublishedFixture,
  publishImplementationPromptFixture,
} from './helpers/prompt-transaction-implementation-publication-fixture';

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function runLoopArgs(fixture: Awaited<ReturnType<typeof publishImplementationPromptFixture>>['fixture']) {
  return {
    projectRoot: fixture.root,
    recordId: fixture.authority.recordId,
    requirementSetId: fixture.identity.requirementSetId,
    runId: fixture.identity.implementationAttemptId,
    flow: 'standalone_tasks' as const,
    stage: 'implement',
    host: 'codex' as const,
  };
}

function writeDoneTaskReport(reportPath: string, packetId: string): string {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        packetId,
        status: 'done',
        filesChanged: [],
        validationsRun: ['native-goal-rerun-loop-success'],
        evidence: ['native goal rerun loop success TaskReport'],
        downstreamContext: ['native goal progress restored'],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return reportPath;
}

function writeSuccessfulInvocationReceipt(input: {
  fixture: Awaited<ReturnType<typeof publishImplementationPromptFixture>>['fixture'];
  pointer: Record<string, unknown>;
  goalCommandText: string;
  packetId: string;
}): void {
  const { fixture, pointer } = input;
  const packetId = input.packetId;
  executeRequiredCommandsForPublishedFixture({ fixture, pointer });
  const modelPacketRef = pointer.modelPacketRef as Record<string, unknown>;
  const auditReceiptRef = pointer.auditReceiptRef as Record<string, unknown>;
  const goalExecutionRef = pointer.goalExecutionRef as Record<string, unknown>;
  const transactionManifestRef = pointer.transactionManifestRef as Record<string, unknown>;
  const modelPacket = JSON.parse(fs.readFileSync(String(modelPacketRef.path), 'utf8'));
  const logsDir = path.join(fixture.root, '_bmad-output', 'runtime', 'native-goal', 'logs');
  const stdoutRef = path.join(logsDir, `${packetId}.stdout.log`);
  const stderrRef = path.join(logsDir, `${packetId}.stderr.log`);
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(stdoutRef, 'native goal completed after restart', 'utf8');
  fs.writeFileSync(stderrRef, '', 'utf8');
  writeNativeGoalInvocationReceipt({
    projectRoot: fixture.root,
    recordId: fixture.authority.recordId,
    attemptId: packetId,
    packetId,
    host: 'codex',
    goalExecutionPath: String(goalExecutionRef.path),
    goalCommandTextHash: sha256Text(input.goalCommandText),
    invokedCommandKind: 'host_native_goal',
    executionSurface: 'host_native_goal',
    command: 'host-native-goal',
    args: [input.goalCommandText],
    taskReportPath: fixture.options.taskReportPath,
    taskReportHash: sha256File(fixture.options.taskReportPath),
    nativeGoalCommandPrepared: true,
    nativeGoalCommandUsed: true,
    stdoutRef,
    stderrRef,
    exitCode: 0,
    sourceDocumentHash: String(pointer.sourceDocumentHash),
    implementationConfirmationHash: String(modelPacket.implementationConfirmationHash),
    modelPacketHash: String(modelPacketRef.hash),
    auditReceiptHash: String(auditReceiptRef.hash),
    transactionManifestPath: String(transactionManifestRef.path),
    transactionManifestHash: String(transactionManifestRef.hash),
    currentDispatchPointerPath: canonicalCurrentDispatchPointerPath(fixture.root),
    currentDispatchPointerHash: sha256File(canonicalCurrentDispatchPointerPath(fixture.root)),
  });
}

describe('main-agent native goal rerun loop behavior', () => {
  it('recovers awaiting_task_report from persistent authority without redispatching', async () => {
    const { fixture } = await publishImplementationPromptFixture();
    try {
      const first = runMainAgentAutomaticLoop(runLoopArgs(fixture));
      const afterFirst = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      expect(afterFirst.nativeGoalHandoff).toMatchObject({
        invoked: true,
        imported: false,
        importStatus: 'awaiting_task_report',
      });
      const recoveredSurface = resolveMainAgentOrchestrationSurface(runLoopArgs(fixture));
      expect(recoveredSurface.mainAgentNextAction).toBe('await_native_goal_task_report');
      const second = runMainAgentAutomaticLoop(runLoopArgs(fixture));

      expect(first.status).toBe('blocked');
      expect(first.taskReport).toBeNull();
      expect(second.status).toBe('blocked');
      expect(second.dispatchInstruction).toBeNull();
      expect(second.taskReport).toBeNull();
      expect(second.finalSurface.mainAgentNextAction).toBe('await_native_goal_task_report');
      const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      expect(record.nativeGoalHandoff).toMatchObject({
        importStatus: 'awaiting_task_report',
        orchestrationStatePath: first.finalSurface.orchestrationStatePath,
        sessionId: first.finalSurface.sessionId,
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('imports a successful host-produced TaskReport after process restart', async () => {
    const { fixture, pointer, goalCommandText } = await publishImplementationPromptFixture();
    try {
      const prepared = runMainAgentAutomaticLoop(runLoopArgs(fixture));
      expect(prepared.status).toBe('blocked');
      const packetId = prepared.dispatchInstruction!.packetId;
      writeDoneTaskReport(
        fixture.options.taskReportPath,
        packetId
      );
      writeSuccessfulInvocationReceipt({
        fixture,
        pointer,
        goalCommandText,
        packetId,
      });

      const imported = importNativeGoalTaskReport({
        projectRoot: fixture.root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        taskReportPath: fixture.options.taskReportPath,
      });

      expect(imported.validationErrors).toEqual([]);
      expect(imported).toMatchObject({
        status: 'imported',
        controlledIngested: true,
        packetId,
      });
      const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      expect(record.nativeGoalHandoff).toMatchObject({
        imported: true,
        importStatus: 'task_report_done',
      });
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a manually written TaskReport while the invocation receipt is only a handoff', async () => {
    const { fixture } = await publishImplementationPromptFixture();
    try {
      const prepared = runMainAgentAutomaticLoop(runLoopArgs(fixture));
      const packetId = prepared.dispatchInstruction!.packetId;
      writeDoneTaskReport(
        fixture.options.taskReportPath,
        packetId
      );

      const imported = importNativeGoalTaskReport({
        projectRoot: fixture.root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        taskReportPath: fixture.options.taskReportPath,
      });

      expect(imported).toMatchObject({
        status: 'invalid',
        controlledIngested: false,
      });
      expect(imported.validationErrors).toContain('native_goal_receipt_invalid');
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a TaskReport whose bytes changed after the successful invocation receipt was written', async () => {
    const { fixture, pointer, goalCommandText } = await publishImplementationPromptFixture();
    try {
      const prepared = runMainAgentAutomaticLoop(runLoopArgs(fixture));
      const packetId = prepared.dispatchInstruction!.packetId;
      writeDoneTaskReport(
        fixture.options.taskReportPath,
        packetId
      );
      writeSuccessfulInvocationReceipt({
        fixture,
        pointer,
        goalCommandText,
        packetId,
      });
      const report = JSON.parse(fs.readFileSync(fixture.options.taskReportPath, 'utf8'));
      report.evidence.push('tampered after receipt');
      fs.writeFileSync(
        fixture.options.taskReportPath,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8'
      );

      const imported = importNativeGoalTaskReport({
        projectRoot: fixture.root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        taskReportPath: fixture.options.taskReportPath,
      });

      expect(imported.status).toBe('invalid');
      expect(imported.validationErrors).toContain('native_goal_task_report_hash_mismatch');
    } finally {
      fixture.cleanup();
    }
  });

  it('rejects a successful receipt bound to a stale prompt transaction manifest', async () => {
    const { fixture, pointer, goalCommandText } = await publishImplementationPromptFixture();
    try {
      const prepared = runMainAgentAutomaticLoop(runLoopArgs(fixture));
      const packetId = prepared.dispatchInstruction!.packetId;
      writeDoneTaskReport(
        fixture.options.taskReportPath,
        packetId
      );
      writeSuccessfulInvocationReceipt({
        fixture,
        pointer,
        goalCommandText,
        packetId,
      });
      const receiptFile = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.authority.recordId,
        'runtime-mode',
        packetId,
        'native-goal-invocation-receipt.json'
      );
      const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
      receipt.transactionManifestHash = `sha256:${'0'.repeat(64)}`;
      fs.writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

      const imported = importNativeGoalTaskReport({
        projectRoot: fixture.root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        taskReportPath: fixture.options.taskReportPath,
      });

      expect(imported.status).toBe('invalid');
      expect(imported.validationErrors).toContain(
        'native_goal_attempt_bundle_mismatch:transactionManifestHash'
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('does not advance no-progress or open the circuit while awaiting an external TaskReport', async () => {
    const { fixture } = await publishImplementationPromptFixture();
    try {
      const first = runMainAgentAutomaticLoop(runLoopArgs(fixture));
      const second = runMainAgentAutomaticLoop(runLoopArgs(fixture));
      const firstNoProgress =
        first.finalSurface.orchestrationState?.gatesLoop?.noProgressCount ?? 0;
      expect(
        second.finalSurface.orchestrationState?.gatesLoop?.noProgressCount ?? 0
      ).toBe(firstNoProgress);
      expect(second.finalSurface.orchestrationState?.gatesLoop?.circuitOpen ?? false).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });
});
