import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  normalizeRuntimeHost,
  writeNativeGoalInvocationReceipt,
} from '../runtime/host-runtime-mode.js';
import { resolveNativeGoalCommand } from './native-goal-command.js';

interface TaskReport {
  packetId: string;
  status: 'done' | 'blocked' | 'partial';
  filesChanged: string[];
  validationsRun: string[];
  evidence: string[];
  downstreamContext: string[];
  driftFlags?: string[];
}

interface ExecutionPacketLike {
  packetId: string;
  parentSessionId?: string;
  expectedDelta: string;
}

interface CompiledPromptRefLike {
  auditReceiptPath: string;
  goalExecutionPath?: string | null;
  goalExecutionHash?: string | null;
}

interface NativeGoalInvocationInput {
  projectRoot: string;
  host: string;
  packet: ExecutionPacketLike;
  compiledPromptRef: CompiledPromptRefLike;
  taskReportPath: string;
  timeoutMs?: number;
  spawnSyncFn?: unknown;
  recordId?: string;
  attemptId?: string;
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function blockedTaskReport(input: {
  packet: ExecutionPacketLike;
  validationsRun: string[];
  evidence: string[];
  driftFlags: string[];
}): TaskReport {
  return {
    packetId: input.packet.packetId,
    status: 'blocked',
    filesChanged: [],
    validationsRun: input.validationsRun,
    evidence: input.evidence,
    downstreamContext: [input.packet.expectedDelta],
    driftFlags: input.driftFlags,
  };
}

export function runNativeGoalInvocation(input: NativeGoalInvocationInput): {
  command: string;
  args: string[];
  exitCode: number;
  stdoutPath: string;
  stderrPath: string;
  receiptPath: string | null;
  taskReportPath: string;
  taskReport: TaskReport;
} {
  const logsDir = path.join(input.projectRoot, '_bmad-output', 'runtime', 'native-goal', 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const stdoutPath = path.join(logsDir, `${input.packet.packetId}.stdout.log`);
  const stderrPath = path.join(logsDir, `${input.packet.packetId}.stderr.log`);
  const resolvedCommand = resolveNativeGoalCommand({
    projectRoot: input.projectRoot,
    host: input.host,
    packetId: input.packet.packetId,
    compiledPromptRef: input.compiledPromptRef,
  });

  if (!resolvedCommand.ok) {
    const taskReport = blockedTaskReport({
      packet: input.packet,
      validationsRun: ['native-goal-command-resolution'],
      evidence: resolvedCommand.evidence,
      driftFlags: resolvedCommand.driftFlags,
    });
    writeJson(input.taskReportPath, taskReport);
    fs.writeFileSync(stdoutPath, '', 'utf8');
    fs.writeFileSync(stderrPath, resolvedCommand.evidence.join('\n'), 'utf8');
    return {
      command: input.host,
      args: [],
      exitCode: 1,
      stdoutPath,
      stderrPath,
      receiptPath: null,
      taskReportPath: input.taskReportPath,
      taskReport,
    };
  }

  const startedAt = new Date().toISOString();
  const endedAt = new Date().toISOString();
  const command = 'main-session-native-goal';
  const args = [resolvedCommand.commandText];
  const exitCode = 1;
  fs.writeFileSync(stdoutPath, '', 'utf8');
  fs.writeFileSync(
    stderrPath,
    [
      'Main session native /goal execution required.',
      `host=${normalizeRuntimeHost(input.host)}`,
      `goalExecutionPath=${resolvedCommand.goalExecutionPath}`,
      `taskReportPath=${input.taskReportPath}`,
    ].join('\n'),
    'utf8'
  );

  const receipt = writeNativeGoalInvocationReceipt({
    projectRoot: input.projectRoot,
    recordId: input.recordId ?? input.packet.parentSessionId ?? input.packet.packetId,
    attemptId: input.attemptId ?? input.packet.packetId,
    packetId: input.packet.packetId,
    host: input.host,
    goalExecutionPath: resolvedCommand.goalExecutionPath,
    goalCommandTextHash: sha256Text(resolvedCommand.commandText),
    invokedCommandKind: 'main_session_native_goal_required',
    executionSurface: 'main_session_native_goal_required',
    command,
    args,
    taskReportPath: input.taskReportPath,
    nativeGoalCommandPrepared: true,
    nativeGoalCommandUsed: false,
    stdoutRef: stdoutPath,
    stderrRef: stderrPath,
    exitCode,
    startedAt,
    endedAt,
  });

  const taskReport = blockedTaskReport({
    packet: input.packet,
    validationsRun: ['main-session-native-goal-preparation'],
    evidence: [
      `Native /goal prepared for main-session execution: ${resolvedCommand.goalExecutionPath}`,
      `Command text hash: ${sha256Text(resolvedCommand.commandText)}`,
      `TaskReport must be written by the active main session: ${input.taskReportPath}`,
    ],
    driftFlags: ['main-session-native-goal-required'],
  });
  writeJson(input.taskReportPath, taskReport);
  return {
    command,
    args,
    exitCode,
    stdoutPath,
    stderrPath,
    receiptPath: receipt.path,
    taskReportPath: input.taskReportPath,
    taskReport,
  };
}
