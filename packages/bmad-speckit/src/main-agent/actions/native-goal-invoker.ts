import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  normalizeRuntimeHost,
  writeNativeGoalInvocationReceipt,
} from '../runtime/host-runtime-mode';
import {
  projectGovernedSkillCampaignTaskReport,
  runMainAgentGoalSubcontractCampaign,
} from '../source-authority/scripts/main-agent-governed-goal-integration';
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
  executionStrategy?: {
    strategyId?: string;
    availability?: string;
  } | null;
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
  campaignPromptPath?: string;
  campaignPromptHash?: string;
  packageManifestPath?: string;
  packageManifestHash?: string;
  packageCompileReceiptPath?: string;
  packageCompileReceiptHash?: string;
  children?: Array<Record<string, unknown>>;
  reportChildResult?: (invocation: Record<string, unknown>) => boolean;
}

export interface NativeGoalControlledExecutorResult {
  exitCode: number;
  stdout?: string | Buffer | null;
  stderr?: string | Buffer | null;
  startedAt?: string;
  endedAt?: string;
  childInvocations?: Array<Record<string, unknown>>;
}

export type NativeGoalControlledExecutor = (
  input: NativeGoalControlledExecutorInput
) => NativeGoalControlledExecutorResult;

type CampaignDependency = (input: Record<string, unknown>) => unknown;

export interface NativeGoalGovernedCampaignInput {
  children: Array<Record<string, unknown>>;
  requirementRecordBinding?: Record<string, unknown>;
  packageRequestRef?: { path: string; hash: string };
  partitionManifestRef?: { path: string; hash: string };
  dependencies: {
    compileExecutionPackage: CampaignDependency;
    auditExecutionPackage: CampaignDependency;
    auditCompletedChild: CampaignDependency;
    auditCompletedCampaign: CampaignDependency;
  };
}

export interface NativeGoalInvocationInput {
  projectRoot: string;
  host: string;
  packet: ExecutionPacketLike;
  compiledPromptRef: CompiledPromptRefLike;
  taskReportPath: string;
  attemptBundle: NativeGoalAttemptBundle;
  timeoutMs?: number;
  executor?: NativeGoalControlledExecutor;
  governedCampaign?: NativeGoalGovernedCampaignInput;
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

function readTaskReport(
  filePath: string,
  packetId: string
): {
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

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requirePackageBinding(packageResult: Record<string, unknown>, field: string): string {
  const value = optionalString(packageResult[field]);
  if (!value) throw new Error(`governed_campaign_package_provenance_missing:${field}`);
  return value;
}

function governedCommandText(
  baseCommandText: string,
  packageResult: Record<string, unknown>
): string {
  const bindings = [
    ['campaignPromptPath', packageResult.campaignPromptPath],
    ['campaignPromptHash', packageResult.campaignPromptHash],
    ['packageManifestPath', packageResult.packageManifestPath],
    ['packageManifestHash', packageResult.packageManifestHash],
    ['packageCompileReceiptPath', packageResult.packageCompileReceiptPath],
    ['packageCompileReceiptHash', packageResult.packageCompileReceiptHash],
  ]
    .filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0
    )
    .map(([key, value]) => `${key}=${value}`);
  return [
    baseCommandText,
    ...bindings,
    'Consume child prompts in frozen topological order within this single host invocation.',
  ].join('\n');
}

function childInvocationsFromExecution(
  execution: NativeGoalControlledExecutorResult
): Array<Record<string, unknown>> {
  if (Array.isArray(execution.childInvocations)) return execution.childInvocations;
  try {
    const parsed = JSON.parse(outputText(execution.stdout)) as Record<string, unknown>;
    return Array.isArray(parsed.childInvocations)
      ? parsed.childInvocations.filter(
          (value): value is Record<string, unknown> =>
            value !== null && typeof value === 'object' && !Array.isArray(value)
        )
      : [];
  } catch {
    return [];
  }
}

export function runNativeGoalInvocation(
  input: NativeGoalInvocationInput
): NativeGoalInvocationResult {
  const logsDir = path.join(input.projectRoot, '_bmad-output', 'runtime', 'native-goal', 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const stdoutPath = path.join(logsDir, `${input.packet.packetId}.stdout.log`);
  const stderrPath = path.join(logsDir, `${input.packet.packetId}.stderr.log`);
  const strategyId = input.packet.executionStrategy?.strategyId ?? 'compiled_trace_direct';
  const governedStrategy = strategyId === 'governed_skill_adapter';
  if (
    strategyId !== 'compiled_trace_direct' &&
    (!governedStrategy || input.packet.executionStrategy?.availability !== 'available')
  ) {
    writeLog(stdoutPath, '');
    writeLog(stderrPath, `native_goal_execution_strategy_invalid:${strategyId}`);
    return {
      status: 'blocked',
      validationErrors: ['native_goal_execution_strategy_invalid'],
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
      validationErrors: governedStrategy ? ['governed_campaign_executor_unavailable'] : [],
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

  if (governedStrategy) {
    if (!input.governedCampaign) {
      writeLog(stdoutPath, '');
      writeLog(stderrPath, 'governed_campaign_binding_missing');
      return {
        status: 'blocked',
        validationErrors: ['governed_campaign_binding_missing'],
        command: 'host-native-goal',
        args,
        exitCode: 1,
        stdoutPath,
        stderrPath,
        receiptPath: null,
        taskReportPath: input.taskReportPath,
        taskReport: null,
      };
    }
    const command = 'host-native-goal';
    const startedAt = new Date().toISOString();
    let governedExecution: NativeGoalControlledExecutorResult | null = null;
    let exactCommandText = resolvedCommand.commandText;
    try {
      const campaignResult = record(
        runMainAgentGoalSubcontractCampaign({
          projectRoot: input.projectRoot,
          packetId: input.packet.packetId,
          host: canonicalHost,
          taskReportPath: input.taskReportPath,
          children: input.governedCampaign.children,
          requirementRecordBinding: input.governedCampaign.requirementRecordBinding,
          dependencies: {
            ...input.governedCampaign.dependencies,
            invokeCampaign: (campaignInput: Record<string, unknown>) => {
              const packageResult = {
                ...record(campaignInput.packageResult),
                packageRequestPath: input.governedCampaign!.packageRequestRef?.path,
                packageRequestHash: input.governedCampaign!.packageRequestRef?.hash,
                partitionManifestPath: input.governedCampaign!.partitionManifestRef?.path,
                partitionManifestHash: input.governedCampaign!.partitionManifestRef?.hash,
              };
              for (const field of [
                'campaignPromptPath',
                'campaignPromptHash',
                'packageManifestPath',
                'packageManifestHash',
                'packageCompileReceiptPath',
                'packageCompileReceiptHash',
                'packageRequestPath',
                'packageRequestHash',
                'partitionManifestPath',
                'partitionManifestHash',
              ]) {
                requirePackageBinding(packageResult, field);
              }
              const onChildInvocation = campaignInput.onChildInvocation;
              if (typeof onChildInvocation !== 'function') {
                throw new Error('governed_campaign_child_authorization_protocol_missing');
              }
              const authorizedChildInvocations: Array<Record<string, unknown>> = [];
              exactCommandText = governedCommandText(resolvedCommand.commandText, packageResult);
              governedExecution = input.executor!({
                projectRoot: input.projectRoot,
                host: canonicalHost,
                commandText: exactCommandText,
                goalExecutionPath: resolvedCommand.goalExecutionPath,
                goalExecutionHash: resolvedCommand.goalExecutionHash,
                packetId: input.packet.packetId,
                taskReportPath: input.taskReportPath,
                timeoutMs,
                campaignPromptPath: optionalString(packageResult.campaignPromptPath),
                campaignPromptHash: optionalString(packageResult.campaignPromptHash),
                packageManifestPath: optionalString(packageResult.packageManifestPath),
                packageManifestHash: optionalString(packageResult.packageManifestHash),
                packageCompileReceiptPath: optionalString(packageResult.packageCompileReceiptPath),
                packageCompileReceiptHash: optionalString(packageResult.packageCompileReceiptHash),
                children: input.governedCampaign!.children,
                reportChildResult: (invocation: Record<string, unknown>) => {
                  const decision = record(
                    (onChildInvocation as (value: Record<string, unknown>) => unknown)(invocation)
                  );
                  authorizedChildInvocations.push(invocation);
                  return decision.authorized === true;
                },
              });
              if (governedExecution.exitCode !== 0) {
                throw new Error('governed_campaign_executor_failed');
              }
              const returnedInvocations = childInvocationsFromExecution(governedExecution);
              if (
                returnedInvocations.length > 0 &&
                (returnedInvocations.length !== authorizedChildInvocations.length ||
                  returnedInvocations.some(
                    (invocation, index) =>
                      invocation.partitionId !==
                      authorizedChildInvocations[index]?.partitionId
                  ))
              ) {
                throw new Error('governed_campaign_child_authorization_protocol_invalid');
              }
              return {
                hostInvocationCount: 1,
                childInvocations: authorizedChildInvocations,
              };
            },
            persistTaskReport: () => undefined,
          },
        })
      );
      const provenance = {
        packageManifestHash: campaignResult.packageManifestHash,
        ...(typeof campaignResult.campaignReportHash === 'string'
          ? { campaignReportHash: campaignResult.campaignReportHash }
          : {}),
      };
      const projected = projectGovernedSkillCampaignTaskReport({
        packetId: input.packet.packetId,
        campaignResult,
        provenance,
      }) as NativeGoalTaskReport;
      fs.mkdirSync(path.dirname(input.taskReportPath), { recursive: true });
      fs.writeFileSync(input.taskReportPath, `${JSON.stringify(projected, null, 2)}\n`, 'utf8');
      if (!governedExecution) {
        writeLog(stdoutPath, '');
        writeLog(stderrPath, 'governed_campaign_not_invoked');
        return {
          status: 'blocked',
          validationErrors: ['governed_campaign_not_invoked'],
          command,
          args: [exactCommandText],
          exitCode: 1,
          stdoutPath,
          stderrPath,
          receiptPath: null,
          taskReportPath: input.taskReportPath,
          taskReport: projected,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const execution = governedExecution ?? { exitCode: 1, stdout: '', stderr: message };
      writeLog(stdoutPath, outputText(execution.stdout));
      writeLog(stderrPath, [outputText(execution.stderr), message].filter(Boolean).join('\n'));
      const taskReportRead = readTaskReport(input.taskReportPath, input.packet.packetId);
      const receipt = governedExecution
        ? writeNativeGoalInvocationReceipt({
            projectRoot: input.projectRoot,
            recordId,
            attemptId,
            packetId: input.packet.packetId,
            host: canonicalHost,
            goalExecutionPath: resolvedCommand.goalExecutionPath,
            goalCommandTextHash: sha256Text(exactCommandText),
            invokedCommandKind: command,
            executionSurface: command,
            command,
            args: [exactCommandText],
            taskReportPath: input.taskReportPath,
            taskReportHash: taskReportRead.taskReport
              ? sha256File(input.taskReportPath)
              : null,
            nativeGoalCommandPrepared: true,
            nativeGoalCommandUsed: true,
            stdoutRef: stdoutPath,
            stderrRef: stderrPath,
            exitCode: execution.exitCode,
            startedAt: execution.startedAt ?? startedAt,
            endedAt: execution.endedAt ?? new Date().toISOString(),
            ...input.attemptBundle,
          }).path
        : null;
      return {
        status: 'blocked',
        validationErrors: [message || 'governed_campaign_failed'],
        command,
        args: [exactCommandText],
        exitCode: execution.exitCode,
        stdoutPath,
        stderrPath,
        receiptPath: receipt,
        taskReportPath: input.taskReportPath,
        taskReport: null,
      };
    }
    const execution = governedExecution!;
    writeLog(stdoutPath, outputText(execution.stdout));
    writeLog(stderrPath, outputText(execution.stderr));
    const taskReportRead = readTaskReport(input.taskReportPath, input.packet.packetId);
    const taskReportHash = taskReportRead.taskReport ? sha256File(input.taskReportPath) : null;
    const receipt = writeNativeGoalInvocationReceipt({
      projectRoot: input.projectRoot,
      recordId,
      attemptId,
      packetId: input.packet.packetId,
      host: canonicalHost,
      goalExecutionPath: resolvedCommand.goalExecutionPath,
      goalCommandTextHash: sha256Text(exactCommandText),
      invokedCommandKind: 'host_native_goal',
      executionSurface: 'host_native_goal',
      command,
      args: [exactCommandText],
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
      status: taskReportRead.validationErrors.length === 0 ? 'executed' : 'blocked',
      validationErrors: taskReportRead.validationErrors,
      command,
      args: [exactCommandText],
      exitCode: execution.exitCode,
      stdoutPath,
      stderrPath,
      receiptPath: receipt.path,
      taskReportPath: input.taskReportPath,
      taskReport: taskReportRead.taskReport,
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
