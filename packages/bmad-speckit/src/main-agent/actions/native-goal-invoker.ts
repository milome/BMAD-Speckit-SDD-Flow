import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  normalizeRuntimeHost,
  writeNativeGoalInvocationReceipt,
} from '../runtime/host-runtime-mode';
import { resolveNativeGoalCommand } from './native-goal-command';

export interface NativeGoalTaskReport {
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

export interface NativeGoalAttemptBundle {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  modelPacketHash: string;
  auditReceiptHash: string;
  goalExecutionHash: string;
  transactionManifestPath: string;
  transactionManifestHash: string;
  currentDispatchPointerPath: string;
  currentDispatchPointerHash: string;
}

export interface NativeGoalControlledExecutorInput {
  projectRoot: string;
  host: 'codex' | 'claude-code-cli';
  commandText: string;
  goalExecutionPath: string;
  goalExecutionHash: string;
  packetId: string;
  taskReportPath: string;
  timeoutMs: number;
}

export interface NativeGoalControlledExecutorResult {
  exitCode: number;
  stdout?: string | Buffer | null;
  stderr?: string | Buffer | null;
  startedAt?: string;
  endedAt?: string;
}

export type NativeGoalControlledExecutor = (
  input: NativeGoalControlledExecutorInput
) => NativeGoalControlledExecutorResult;

export interface NativeGoalInvocationInput {
  projectRoot: string;
  host: string;
  packet: ExecutionPacketLike;
  compiledPromptRef: CompiledPromptRefLike;
  taskReportPath: string;
  attemptBundle: NativeGoalAttemptBundle;
  timeoutMs?: number;
  executor?: NativeGoalControlledExecutor;
  recordId?: string;
  attemptId?: string;
}

export interface NativeGoalInvocationResult {
  status: 'executed' | 'awaiting_task_report' | 'blocked';
  validationErrors: string[];
  command: string;
  args: string[];
  exitCode: number;
  stdoutPath: string;
  stderrPath: string;
  receiptPath: string | null;
  taskReportPath: string;
  taskReport: NativeGoalTaskReport | null;
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function outputText(value: string | Buffer | null | undefined): string {
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return typeof value === 'string' ? value : '';
}

function readTaskReport(filePath: string, packetId: string): {
  taskReport: NativeGoalTaskReport | null;
  validationErrors: string[];
} {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return { taskReport: null, validationErrors: ['native_goal_task_report_missing'] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<NativeGoalTaskReport>;
    const valid =
      parsed.packetId === packetId &&
      ['done', 'blocked', 'partial'].includes(String(parsed.status)) &&
      Array.isArray(parsed.filesChanged) &&
      Array.isArray(parsed.validationsRun) &&
      Array.isArray(parsed.evidence) &&
      Array.isArray(parsed.downstreamContext);
    return valid
      ? { taskReport: parsed as NativeGoalTaskReport, validationErrors: [] }
      : { taskReport: null, validationErrors: ['native_goal_task_report_invalid'] };
  } catch {
    return { taskReport: null, validationErrors: ['native_goal_task_report_invalid'] };
  }
}

function writeLog(filePath: string, value: string): void {
  fs.writeFileSync(filePath, value, 'utf8');
}

export function runNativeGoalInvocation(
  input: NativeGoalInvocationInput
): NativeGoalInvocationResult {
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
    writeLog(stdoutPath, '');
    writeLog(stderrPath, resolvedCommand.evidence.join('\n'));
    return {
      status: 'blocked',
      validationErrors: resolvedCommand.driftFlags,
      command: input.host,
      args: [],
      exitCode: 1,
      stdoutPath,
      stderrPath,
      receiptPath: null,
      taskReportPath: input.taskReportPath,
      taskReport: null,
    };
  }

  const canonicalHost = normalizeRuntimeHost(input.host);
  if (canonicalHost !== 'codex' && canonicalHost !== 'claude-code-cli') {
    throw new Error(`native_goal_incompatible_host:${input.host}`);
  }
  const args = [resolvedCommand.commandText];
  const recordId = input.recordId ?? input.packet.parentSessionId ?? input.packet.packetId;
  const attemptId = input.attemptId ?? input.packet.packetId;
  const timeoutMs =
    Number.isFinite(input.timeoutMs) && Number(input.timeoutMs) > 0
      ? Number(input.timeoutMs)
      : 30 * 60 * 1000;

  if (!input.executor) {
    const command = 'main-session-native-goal';
    const startedAt = new Date().toISOString();
    writeLog(stdoutPath, '');
    writeLog(
      stderrPath,
      [
        'Main session native /goal execution required.',
        `host=${canonicalHost}`,
        `goalExecutionPath=${resolvedCommand.goalExecutionPath}`,
        `taskReportPath=${input.taskReportPath}`,
      ].join('\n')
    );
    const receipt = writeNativeGoalInvocationReceipt({
      projectRoot: input.projectRoot,
      recordId,
      attemptId,
      packetId: input.packet.packetId,
      host: canonicalHost,
      goalExecutionPath: resolvedCommand.goalExecutionPath,
      goalCommandTextHash: sha256Text(resolvedCommand.commandText),
      invokedCommandKind: 'main_session_native_goal_required',
      executionSurface: 'main_session_native_goal_required',
      command,
      args,
      taskReportPath: input.taskReportPath,
      taskReportHash: null,
      nativeGoalCommandPrepared: true,
      nativeGoalCommandUsed: false,
      stdoutRef: stdoutPath,
      stderrRef: stderrPath,
      exitCode: 1,
      startedAt,
      endedAt: new Date().toISOString(),
      ...input.attemptBundle,
    });
    return {
      status: 'awaiting_task_report',
      validationErrors: [],
      command,
      args,
      exitCode: 1,
      stdoutPath,
      stderrPath,
      receiptPath: receipt.path,
      taskReportPath: input.taskReportPath,
      taskReport: null,
    };
  }

  const command = 'host-native-goal';
  const startedAt = new Date().toISOString();
  let execution: NativeGoalControlledExecutorResult;
  try {
    execution = input.executor({
      projectRoot: input.projectRoot,
      host: canonicalHost,
      commandText: resolvedCommand.commandText,
      goalExecutionPath: resolvedCommand.goalExecutionPath,
      goalExecutionHash: resolvedCommand.goalExecutionHash,
      packetId: input.packet.packetId,
      taskReportPath: input.taskReportPath,
      timeoutMs,
    });
  } catch (error) {
    execution = {
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
  writeLog(stdoutPath, outputText(execution.stdout));
  writeLog(stderrPath, outputText(execution.stderr));
  const taskReportRead = readTaskReport(input.taskReportPath, input.packet.packetId);
  const validationErrors = [...taskReportRead.validationErrors];
  if (execution.exitCode !== 0) validationErrors.push('native_goal_executor_failed');
  const taskReportHash = taskReportRead.taskReport ? sha256File(input.taskReportPath) : null;
  const receipt = writeNativeGoalInvocationReceipt({
    projectRoot: input.projectRoot,
    recordId,
    attemptId,
    packetId: input.packet.packetId,
    host: canonicalHost,
    goalExecutionPath: resolvedCommand.goalExecutionPath,
    goalCommandTextHash: sha256Text(resolvedCommand.commandText),
    invokedCommandKind: 'host_native_goal',
    executionSurface: 'host_native_goal',
    command,
    args,
    taskReportPath: input.taskReportPath,
    taskReportHash,
    nativeGoalCommandPrepared: true,
    nativeGoalCommandUsed: true,
    stdoutRef: stdoutPath,
    stderrRef: stderrPath,
    exitCode: execution.exitCode,
    startedAt: execution.startedAt ?? startedAt,
    endedAt: execution.endedAt ?? new Date().toISOString(),
    ...input.attemptBundle,
  });
  return {
    status: validationErrors.length === 0 ? 'executed' : 'blocked',
    validationErrors,
    command,
    args,
    exitCode: execution.exitCode,
    stdoutPath,
    stderrPath,
    receiptPath: receipt.path,
    taskReportPath: input.taskReportPath,
    taskReport: taskReportRead.taskReport,
  };
}
