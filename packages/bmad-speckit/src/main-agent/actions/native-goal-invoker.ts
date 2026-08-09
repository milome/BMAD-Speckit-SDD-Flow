import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
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
  closeoutStatus?: 'awaiting_user_acceptance';
  closeoutAttemptId?: string;
  taskReportCandidatePath?: string;
  taskReportArtifactHash?: string;
  closeoutContextHash?: string;
  producerReceipt?: Record<string, unknown>;
  judgeReviewCampaign?: Record<string, unknown>;
  effectivePassReceipt?: Record<string, unknown>;
  deliveryGateReceipt?: Record<string, unknown>;
}

export type NativeGoalControlledExecutor = (
  input: NativeGoalControlledExecutorInput
) => NativeGoalControlledExecutorResult;

export interface NativeGoalHostBridgeOptions {
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

function nativeGoalBridgeHostKey(host: NativeGoalControlledExecutorInput['host']): string {
  return host === 'codex' ? 'CODEX' : 'CLAUDE';
}

function nativeGoalBridgeArgs(
  raw: string | undefined,
  host: NativeGoalControlledExecutorInput['host']
): string[] {
  if (!raw || raw.trim() === '') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new Error('invalid');
    }
    return parsed;
  } catch {
    throw new Error(`native_goal_host_bridge_args_invalid:${host}`);
  }
}

function nativeGoalBridgeTimeout(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nativeGoalBridgeRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nativeGoalBridgeResult(value: unknown): NativeGoalControlledExecutorResult {
  const record = nativeGoalBridgeRecord(value);
  if (!record || !Number.isInteger(record.exitCode)) {
    throw new Error('native_goal_host_bridge_response_invalid');
  }
  const childInvocations = record.childInvocations;
  if (
    childInvocations !== undefined &&
    (!Array.isArray(childInvocations) || !childInvocations.every(nativeGoalBridgeRecord))
  ) {
    throw new Error('native_goal_host_bridge_response_invalid');
  }
  return {
    exitCode: record.exitCode as number,
    ...(typeof record.stdout === 'string' || Buffer.isBuffer(record.stdout)
      ? { stdout: record.stdout as string | Buffer }
      : {}),
    ...(typeof record.stderr === 'string' || Buffer.isBuffer(record.stderr)
      ? { stderr: record.stderr as string | Buffer }
      : {}),
    ...(typeof record.startedAt === 'string' ? { startedAt: record.startedAt } : {}),
    ...(typeof record.endedAt === 'string' ? { endedAt: record.endedAt } : {}),
    ...(Array.isArray(childInvocations)
      ? { childInvocations: childInvocations as Array<Record<string, unknown>> }
      : {}),
    ...(record.closeoutStatus === 'awaiting_user_acceptance'
      ? { closeoutStatus: 'awaiting_user_acceptance' as const }
      : {}),
    ...(typeof record.closeoutAttemptId === 'string'
      ? { closeoutAttemptId: record.closeoutAttemptId }
      : {}),
    ...(typeof record.taskReportCandidatePath === 'string'
      ? { taskReportCandidatePath: record.taskReportCandidatePath }
      : {}),
    ...(typeof record.taskReportArtifactHash === 'string'
      ? { taskReportArtifactHash: record.taskReportArtifactHash }
      : {}),
    ...(typeof record.closeoutContextHash === 'string'
      ? { closeoutContextHash: record.closeoutContextHash }
      : {}),
    ...(nativeGoalBridgeRecord(record.producerReceipt)
      ? { producerReceipt: record.producerReceipt }
      : {}),
    ...(nativeGoalBridgeRecord(record.judgeReviewCampaign)
      ? { judgeReviewCampaign: record.judgeReviewCampaign }
      : {}),
    ...(nativeGoalBridgeRecord(record.effectivePassReceipt)
      ? { effectivePassReceipt: record.effectivePassReceipt }
      : {}),
    ...(nativeGoalBridgeRecord(record.deliveryGateReceipt)
      ? { deliveryGateReceipt: record.deliveryGateReceipt }
      : {}),
  };
}

/**
 * Formal host entry for CLI run-loop. The host-specific bridge is configured by
 * environment, while the request and child authorization protocol stay shared.
 */
export function createNativeGoalHostExecutor(
  options: NativeGoalHostBridgeOptions = {}
): NativeGoalControlledExecutor {
  const env = options.env ?? process.env;
  return (input) => {
    const hostKey = nativeGoalBridgeHostKey(input.host);
    const command = String(
      env[`BMAD_NATIVE_GOAL_${hostKey}_BRIDGE_COMMAND`] ?? ''
    ).trim();
    const startedAt = new Date().toISOString();
    const fail = (message: string): NativeGoalControlledExecutorResult => ({
      exitCode: 1,
      stdout: '',
      stderr: message,
      startedAt,
      endedAt: new Date().toISOString(),
    });
    if (!command) return fail('native_goal_host_bridge_not_configured');

    let args: string[];
    try {
      args = nativeGoalBridgeArgs(
        env[`BMAD_NATIVE_GOAL_${hostKey}_BRIDGE_ARGS_JSON`],
        input.host
      );
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }

    const request = {
      schemaVersion: 'main-agent-native-goal-bridge/v1' as const,
      projectRoot: input.projectRoot,
      host: input.host,
      commandText: input.commandText,
      goalExecutionPath: input.goalExecutionPath,
      goalExecutionHash: input.goalExecutionHash,
      packetId: input.packetId,
      taskReportPath: input.taskReportPath,
      timeoutMs: input.timeoutMs,
      ...(input.campaignPromptPath
        ? { campaignPromptPath: input.campaignPromptPath }
        : {}),
      ...(input.campaignPromptHash ? { campaignPromptHash: input.campaignPromptHash } : {}),
      ...(input.packageManifestPath
        ? { packageManifestPath: input.packageManifestPath }
        : {}),
      ...(input.packageManifestHash
        ? { packageManifestHash: input.packageManifestHash }
        : {}),
      ...(input.packageCompileReceiptPath
        ? { packageCompileReceiptPath: input.packageCompileReceiptPath }
        : {}),
      ...(input.packageCompileReceiptHash
        ? { packageCompileReceiptHash: input.packageCompileReceiptHash }
        : {}),
      children: input.children ?? [],
    };

    const execution = spawnSync(command, args, {
      cwd: input.projectRoot,
      input: `${JSON.stringify(request)}\n`,
      encoding: 'utf8',
      timeout: nativeGoalBridgeTimeout(
        env[`BMAD_NATIVE_GOAL_${hostKey}_BRIDGE_TIMEOUT_MS`],
        options.timeoutMs ?? input.timeoutMs
      ),
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (execution.error) {
      const code = (execution.error as NodeJS.ErrnoException).code;
      return fail(
        code === 'ETIMEDOUT'
          ? 'native_goal_host_bridge_timeout'
          : `native_goal_host_bridge_failed:${code ?? 'unknown'}`
      );
    }
    if (execution.status !== 0) {
      return {
        ...fail(`native_goal_host_bridge_failed:${execution.status ?? 'unknown'}`),
        stdout: String(execution.stdout ?? ''),
        stderr: String(execution.stderr ?? ''),
      };
    }
    const stdout = String(execution.stdout ?? '').trim();
    if (!stdout) return fail('native_goal_host_bridge_response_invalid');

    let result: NativeGoalControlledExecutorResult;
    try {
      result = nativeGoalBridgeResult(JSON.parse(stdout));
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
    const childInvocations = result.childInvocations ?? [];
    if (childInvocations.length !== (input.children?.length ?? 0)) {
      return fail('native_goal_host_bridge_child_invocations_mismatch');
    }
    for (const invocation of childInvocations) {
      if (input.reportChildResult && !input.reportChildResult(invocation)) {
        return fail('native_goal_host_bridge_child_invocation_rejected');
      }
    }
    return {
      ...result,
      startedAt: result.startedAt ?? startedAt,
      endedAt: result.endedAt ?? new Date().toISOString(),
    };
  };
}

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
  status: 'executed' | 'awaiting_task_report' | 'awaiting_user_acceptance' | 'blocked';
  validationErrors: string[];
  command: string;
  args: string[];
  exitCode: number;
  stdoutPath: string;
  stderrPath: string;
  receiptPath: string | null;
  taskReportPath: string;
  taskReport: NativeGoalTaskReport | null;
  closeoutAttemptId?: string;
  taskReportCandidatePath?: string;
  taskReportArtifactHash?: string;
  controlledCloseoutIngested?: boolean;
  controlledCloseout?: {
    schemaVersion: 'main-agent-controlled-closeout-handoff/v1';
    closeoutAttemptId: string;
    contextHash: string;
    compileReceiptHash: string;
    childClosureSetHash: string;
    campaignReportHash: string;
    closureReceiptHash: string;
    judgeReviewCampaignHash: string;
    effectivePassReceiptHash: string;
    deliveryCloseoutGateReceiptHash: string;
  };
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

function requiredSha256(value: unknown): string {
  const normalized = optionalString(value);
  if (!normalized || !/^sha256:[a-f0-9]{64}$/u.test(normalized)) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  return normalized;
}

function validateControlledCloseoutIngest(input: {
  execution: NativeGoalControlledExecutorResult;
  candidatePath: string;
  candidateHash: string;
  closeoutAttemptId: string;
}): NonNullable<NativeGoalInvocationResult['controlledCloseout']> {
  const contextHash = optionalString(input.execution.closeoutContextHash);
  const producerReceipt = record(input.execution.producerReceipt);
  const judgeReviewCampaign = record(input.execution.judgeReviewCampaign);
  const effectivePassReceipt = record(input.execution.effectivePassReceipt);
  const deliveryGateReceipt = record(input.execution.deliveryGateReceipt);
  const producerAttemptId = optionalString(producerReceipt.closeoutAttemptId);
  const campaignAttemptId = optionalString(judgeReviewCampaign.closeoutAttemptId);
  const producerContextHash = optionalString(producerReceipt.contextHash);
  const campaignCandidateHash = optionalString(judgeReviewCampaign.candidateBytesHash);
  const effectivePass = effectivePassReceipt.effectivePass === true;
  const deliveryAwaitingAcceptance =
    deliveryGateReceipt.status === 'awaiting_user_acceptance' &&
    optionalString(deliveryGateReceipt.closeoutAttemptId) === input.closeoutAttemptId;
  if (
    !contextHash ||
    producerReceipt.status !== 'campaign_closed' ||
    producerAttemptId !== input.closeoutAttemptId ||
    campaignAttemptId !== input.closeoutAttemptId ||
    producerContextHash !== contextHash ||
    campaignCandidateHash !== input.candidateHash ||
    !effectivePass ||
    !deliveryAwaitingAcceptance ||
    !/^sha256:[a-f0-9]{64}$/u.test(input.candidateHash) ||
    sha256File(input.candidatePath) !== input.candidateHash
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  return Object.freeze({
    schemaVersion: 'main-agent-controlled-closeout-handoff/v1' as const,
    closeoutAttemptId: input.closeoutAttemptId,
    contextHash: requiredSha256(contextHash),
    compileReceiptHash: requiredSha256(producerReceipt.compileReceiptHash),
    childClosureSetHash: requiredSha256(producerReceipt.childClosureSetHash),
    campaignReportHash: requiredSha256(producerReceipt.campaignReportHash),
    closureReceiptHash: requiredSha256(producerReceipt.receiptHash),
    judgeReviewCampaignHash: requiredSha256(judgeReviewCampaign.aggregateHash),
    effectivePassReceiptHash: requiredSha256(
      effectivePassReceipt.effectivePassReceiptHash
    ),
    deliveryCloseoutGateReceiptHash: requiredSha256(deliveryGateReceipt.receiptHash),
  });
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
                ...(governedExecution.closeoutStatus === 'awaiting_user_acceptance'
                  ? {
                      controlledCloseout: {
                        status: governedExecution.closeoutStatus,
                        closeoutAttemptId: governedExecution.closeoutAttemptId,
                        taskReportCandidatePath: governedExecution.taskReportCandidatePath,
                        taskReportArtifactHash: governedExecution.taskReportArtifactHash,
                      },
                    }
                  : {}),
              };
            },
            persistTaskReport: () => undefined,
          },
        })
      );
      if (campaignResult.status === 'awaiting_user_acceptance') {
        const controlledCloseoutCandidate = record(campaignResult.controlledCloseout);
        const candidatePath = optionalString(controlledCloseoutCandidate.taskReportCandidatePath);
        const candidateHash = optionalString(controlledCloseoutCandidate.taskReportArtifactHash);
        const candidateValid =
          Boolean(governedExecution) &&
          governedExecution!.exitCode === 0 &&
          Boolean(candidatePath) &&
          path.isAbsolute(candidatePath) &&
          fs.existsSync(candidatePath) &&
          fs.statSync(candidatePath).isFile() &&
          Boolean(candidateHash) &&
          sha256File(candidatePath) === candidateHash;
        if (!candidateValid) {
          throw new Error('main_agent_goal_task_report_provenance_mismatch');
        }
        const execution = governedExecution!;
        const closeoutAttemptId = optionalString(controlledCloseoutCandidate.closeoutAttemptId);
        if (!closeoutAttemptId || !candidatePath || !candidateHash) {
          throw new Error('main_agent_goal_task_report_provenance_mismatch');
        }
        const controlledCloseout = validateControlledCloseoutIngest({
          execution,
          candidatePath,
          candidateHash,
          closeoutAttemptId,
        });
        writeLog(stdoutPath, outputText(execution.stdout));
        writeLog(stderrPath, outputText(execution.stderr));
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
          taskReportHash: null,
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
          status: 'awaiting_user_acceptance',
          validationErrors: [],
          command,
          args: [exactCommandText],
          exitCode: execution.exitCode,
          stdoutPath,
          stderrPath,
          receiptPath: receipt.path,
          taskReportPath: input.taskReportPath,
          taskReport: null,
          closeoutAttemptId,
          taskReportCandidatePath: candidatePath,
          taskReportArtifactHash: candidateHash,
          controlledCloseoutIngested: true,
          controlledCloseout,
        };
      }
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
  if (execution.closeoutStatus === 'awaiting_user_acceptance') {
    const candidatePath = execution.taskReportCandidatePath;
    const candidateHash = execution.taskReportArtifactHash;
    const candidateValid =
      execution.exitCode === 0 &&
      typeof candidatePath === 'string' &&
      path.isAbsolute(candidatePath) &&
      fs.existsSync(candidatePath) &&
      fs.statSync(candidatePath).isFile() &&
      typeof candidateHash === 'string' &&
      sha256File(candidatePath) === candidateHash;
    if (!candidateValid) {
      return {
        status: 'blocked',
        validationErrors: ['main_agent_goal_task_report_provenance_mismatch'],
        command,
        args,
        exitCode: 1,
        stdoutPath,
        stderrPath,
        receiptPath: null,
        taskReportPath: input.taskReportPath,
        taskReport: null,
      };
    }
    const closeoutAttemptId = execution.closeoutAttemptId ?? attemptId;
    if (!closeoutAttemptId || !candidatePath || !candidateHash) {
      return {
        status: 'blocked',
        validationErrors: ['main_agent_goal_task_report_provenance_mismatch'],
        command,
        args,
        exitCode: 1,
        stdoutPath,
        stderrPath,
        receiptPath: null,
        taskReportPath: input.taskReportPath,
        taskReport: null,
      };
    }
    let controlledCloseout: NonNullable<NativeGoalInvocationResult['controlledCloseout']>;
    try {
      controlledCloseout = validateControlledCloseoutIngest({
        execution,
        candidatePath,
        candidateHash,
        closeoutAttemptId,
      });
    } catch {
      return {
        status: 'blocked',
        validationErrors: ['main_agent_goal_task_report_provenance_mismatch'],
        command,
        args,
        exitCode: 1,
        stdoutPath,
        stderrPath,
        receiptPath: null,
        taskReportPath: input.taskReportPath,
        taskReport: null,
      };
    }
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
      taskReportHash: null,
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
      status: 'awaiting_user_acceptance',
      validationErrors: [],
      command,
      args,
      exitCode: execution.exitCode,
      stdoutPath,
      stderrPath,
      receiptPath: receipt.path,
      taskReportPath: input.taskReportPath,
      taskReport: null,
      closeoutAttemptId,
      taskReportCandidatePath: candidatePath,
      taskReportArtifactHash: candidateHash,
      controlledCloseoutIngested: true,
      controlledCloseout,
    };
  }
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
