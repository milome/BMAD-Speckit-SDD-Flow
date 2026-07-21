import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type CanonicalRuntimeHost =
  | 'codex'
  | 'claude-code-cli'
  | 'cursor-ide'
  | 'cursor-cli'
  | 'unknown';

export type ExecutionRuntimeMode =
  | 'native_goal'
  | 'cursor_ide_subagent_ralph_tdd_loop'
  | 'main_session_direct';

interface CompiledPromptRefLike {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  modelPacketHash: string;
  auditReceiptPath: string;
  goalExecutionPath?: string | null;
  goalExecutionHash?: string | null;
}

interface RuntimeBlockerInput {
  host: string;
  attemptId: string;
  packetId: string;
  recordId: string;
  compiledPromptRef?: Pick<CompiledPromptRefLike, 'goalExecutionHash'>;
  goalExecutionHash?: string | null;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function safeSegment(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9._-]+/g, '-') || 'unknown';
}

export function normalizeRuntimeHost(host: string | null | undefined): CanonicalRuntimeHost {
  switch (String(host ?? '').trim()) {
    case 'codex':
    case 'codex-no-hooks':
      return 'codex';
    case 'claude':
    case 'claude-code':
    case 'claude-code-cli':
      return 'claude-code-cli';
    case 'cursor':
    case 'cursor-ide':
      return 'cursor-ide';
    case 'cursor-cli':
      return 'cursor-cli';
    default:
      return 'unknown';
  }
}

export function selectExecutionRuntimeMode(host: string): {
  canonicalHost: CanonicalRuntimeHost;
  executionRuntimeMode: ExecutionRuntimeMode;
  selectionReason: string;
} {
  const canonicalHost = normalizeRuntimeHost(host);
  switch (canonicalHost) {
    case 'codex':
    case 'claude-code-cli':
      return {
        canonicalHost,
        executionRuntimeMode: 'native_goal',
        selectionReason: `${canonicalHost} supports host native /goal document-reference execution`,
      };
    case 'cursor-ide':
      return {
        canonicalHost,
        executionRuntimeMode: 'cursor_ide_subagent_ralph_tdd_loop',
        selectionReason: 'Cursor IDE requires Ralph Method TDD subagent execution',
      };
    case 'cursor-cli':
      return {
        canonicalHost,
        executionRuntimeMode: 'main_session_direct',
        selectionReason: 'Cursor CLI capability is not contracted for native goal or subagents',
      };
    default:
      return {
        canonicalHost,
        executionRuntimeMode: 'main_session_direct',
        selectionReason: 'Unknown host capability defaults to main-session direct execution',
      };
  }
}

export function runtimeModeDir(projectRoot: string, recordId: string, attemptId: string): string {
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    safeSegment(recordId),
    'runtime-mode',
    safeSegment(attemptId)
  );
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function writeExecutionRuntimeModeSelection(input: {
  projectRoot: string;
  recordId: string;
  packetId: string;
  attemptId: string;
  host: string;
  compiledPromptRef: CompiledPromptRefLike;
}): { selection: Record<string, unknown>; path: string } {
  const selected = selectExecutionRuntimeMode(input.host);
  const selection = {
    schemaVersion: 'execution-runtime-mode-selection/v1',
    recordId: input.recordId,
    packetId: input.packetId,
    attemptId: input.attemptId,
    host: input.host,
    canonicalHost: selected.canonicalHost,
    executionRuntimeMode: selected.executionRuntimeMode,
    sourceDocumentHash: input.compiledPromptRef.sourceDocumentHash,
    implementationConfirmationHash: input.compiledPromptRef.implementationConfirmationHash,
    modelPacketHash: input.compiledPromptRef.modelPacketHash,
    goalExecutionHash: input.compiledPromptRef.goalExecutionHash ?? null,
    selectedAt: new Date().toISOString(),
    selectionReason: selected.selectionReason,
    blocked: false,
  };
  const filePath = path.join(
    runtimeModeDir(input.projectRoot, input.recordId, input.attemptId),
    'execution-runtime-mode-selection.json'
  );
  writeJson(filePath, selection);
  return { selection, path: filePath };
}

function buildRuntimeBlocker(
  input: RuntimeBlockerInput,
  reasonCode: string,
  invalidFields: string[],
  receiptHash: string,
  exitCode: string | number
): Record<string, unknown> {
  return {
    schemaVersion: 'runtime-blocker/v1',
    reasonCode,
    host: input.host,
    executionRuntimeMode: 'native_goal',
    attemptId: input.attemptId,
    packetId: input.packetId,
    goalExecutionHash: input.compiledPromptRef?.goalExecutionHash ?? input.goalExecutionHash ?? null,
    receiptHash,
    exitCode,
    blockedActions: [
      'task_report_acceptance',
      'execution_closure_result_recorded',
      'dispatch_review',
      'run_closeout',
      'delivery_confirmation_result_recorded',
      'record_closed',
    ],
    recordHash: sha256Text(input.recordId),
    reasonDetails: { invalidFields },
  };
}

export function validateNativeGoalReadiness(input: {
  projectRoot: string;
  recordId: string;
  packetId: string;
  attemptId: string;
  host: string;
  compiledPromptRef: CompiledPromptRefLike;
}): Record<string, unknown> | null {
  const selected = selectExecutionRuntimeMode(input.host);
  if (selected.executionRuntimeMode !== 'native_goal') return null;
  const invalidFields: string[] = [];
  const ref = input.compiledPromptRef;
  if (!ref.goalExecutionPath) invalidFields.push('goalExecutionPath');
  if (!ref.goalExecutionHash) invalidFields.push('goalExecutionHash');
  if (
    ref.goalExecutionPath &&
    (!fs.existsSync(ref.goalExecutionPath) || sha256File(ref.goalExecutionPath) !== ref.goalExecutionHash)
  ) {
    invalidFields.push('goalExecutionHash');
  }
  if (!fs.existsSync(ref.auditReceiptPath)) {
    invalidFields.push('auditReceiptPath');
  } else {
    const receipt = JSON.parse(fs.readFileSync(ref.auditReceiptPath, 'utf8')) as {
      goalCommand?: { mode?: string; documentHash?: string };
    };
    const goalCommand = receipt.goalCommand;
    if (goalCommand?.mode !== 'native_goal_document_ref') {
      invalidFields.push('audit_receipt.goalCommand.mode');
    }
    if (goalCommand?.documentHash !== ref.goalExecutionHash) {
      invalidFields.push('audit_receipt.goalCommand.documentHash');
    }
  }
  if (invalidFields.length === 0) return null;
  return buildRuntimeBlocker(
    input,
    'native_goal_readiness_invalid',
    invalidFields,
    fs.existsSync(ref.auditReceiptPath) ? sha256File(ref.auditReceiptPath) : 'missing',
    'not_available'
  );
}

export function writeRuntimeBlocker(
  projectRoot: string,
  recordId: string,
  attemptId: string,
  blocker: unknown
): string {
  const filePath = path.join(runtimeModeDir(projectRoot, recordId, attemptId), 'runtime-blocker.json');
  writeJson(filePath, blocker);
  return filePath;
}

export function writeNativeGoalInvocationReceipt(input: {
  projectRoot: string;
  recordId: string;
  attemptId: string;
  packetId: string;
  host: string;
  goalExecutionPath: string;
  goalCommandTextHash?: string;
  invokedCommandKind?: 'host_native_goal' | 'main_session_native_goal_required';
  executionSurface?: 'host_native_goal' | 'main_session_native_goal_required';
  command?: string;
  args?: string[];
  taskReportPath?: string;
  taskReportHash?: string | null;
  nativeGoalCommandPrepared?: boolean;
  nativeGoalCommandUsed?: boolean;
  stdoutRef: string;
  stderrRef: string;
  exitCode: number;
  startedAt?: string;
  endedAt?: string;
  sourceDocumentHash?: string;
  implementationConfirmationHash?: string;
  modelPacketHash?: string;
  auditReceiptHash?: string;
  transactionManifestPath?: string;
  transactionManifestHash?: string;
  currentDispatchPointerPath?: string;
  currentDispatchPointerHash?: string;
}): { receipt: Record<string, unknown>; path: string } {
  const receipt = {
    schemaVersion: 'native-goal-invocation-receipt/v1',
    host: input.host,
    executionRuntimeMode: 'native_goal',
    executionSurface: input.executionSurface ?? 'host_native_goal',
    goalExecutionPath: input.goalExecutionPath,
    goalExecutionHash: sha256File(input.goalExecutionPath),
    goalCommandTextHash: input.goalCommandTextHash ?? 'not_available',
    invokedCommandKind: input.invokedCommandKind ?? 'host_native_goal',
    command: input.command ?? 'not_available',
    args: input.args ?? [],
    taskReportPath: input.taskReportPath ?? 'not_available',
    taskReportHash: input.taskReportHash ?? null,
    nativeGoalCommandPrepared: input.nativeGoalCommandPrepared !== false,
    nativeGoalCommandUsed: input.nativeGoalCommandUsed !== false,
    startedAt: input.startedAt ?? new Date().toISOString(),
    endedAt: input.endedAt ?? new Date().toISOString(),
    exitCode: input.exitCode,
    stdoutRef: input.stdoutRef,
    stdoutHash: fs.existsSync(input.stdoutRef) ? sha256File(input.stdoutRef) : 'missing',
    stderrRef: input.stderrRef,
    stderrHash: fs.existsSync(input.stderrRef) ? sha256File(input.stderrRef) : 'missing',
    packetId: input.packetId,
    attemptId: input.attemptId,
    recordId: input.recordId,
    sourceDocumentHash: input.sourceDocumentHash ?? 'not_available',
    implementationConfirmationHash: input.implementationConfirmationHash ?? 'not_available',
    modelPacketHash: input.modelPacketHash ?? 'not_available',
    auditReceiptHash: input.auditReceiptHash ?? 'not_available',
    transactionManifestPath: input.transactionManifestPath ?? 'not_available',
    transactionManifestHash: input.transactionManifestHash ?? 'not_available',
    currentDispatchPointerPath: input.currentDispatchPointerPath ?? 'not_available',
    currentDispatchPointerHash: input.currentDispatchPointerHash ?? 'not_available',
  };
  const filePath = path.join(
    runtimeModeDir(input.projectRoot, input.recordId, input.attemptId),
    'native-goal-invocation-receipt.json'
  );
  writeJson(filePath, receipt);
  return { receipt, path: filePath };
}

export function validateNativeGoalInvocationReceipt(input: {
  projectRoot: string;
  recordId: string;
  attemptId: string;
  packetId: string;
  host: string;
  goalExecutionHash: string;
}): Record<string, unknown> | null {
  const filePath = path.join(
    runtimeModeDir(input.projectRoot, input.recordId, input.attemptId),
    'native-goal-invocation-receipt.json'
  );
  if (!fs.existsSync(filePath)) {
    return {
      schemaVersion: 'runtime-blocker/v1',
      reasonCode: 'native_goal_receipt_missing',
      host: input.host,
      executionRuntimeMode: 'native_goal',
      attemptId: input.attemptId,
      packetId: input.packetId,
      goalExecutionHash: input.goalExecutionHash,
      receiptHash: 'missing',
      exitCode: 'not_available',
      blockedActions: [
        'task_report_acceptance',
        'execution_closure_result_recorded',
        'dispatch_review',
        'run_closeout',
        'delivery_confirmation_result_recorded',
        'record_closed',
      ],
      recordHash: sha256Text(input.recordId),
      reasonDetails: { missingPath: filePath.replace(/\\/g, '/') },
    };
  }
  const receipt = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  const invalidFields: string[] = [];
  if (receipt.packetId !== input.packetId) invalidFields.push('packetId');
  if (receipt.attemptId !== input.attemptId) invalidFields.push('attemptId');
  if (receipt.invokedCommandKind !== 'host_native_goal') invalidFields.push('invokedCommandKind');
  if (receipt.goalExecutionHash !== input.goalExecutionHash) invalidFields.push('goalExecutionHash');
  if (!receipt.goalCommandTextHash) invalidFields.push('goalCommandTextHash');
  if (!receipt.command) invalidFields.push('command');
  if (!Array.isArray(receipt.args) || receipt.args.length === 0) invalidFields.push('args');
  if (!receipt.taskReportPath) invalidFields.push('taskReportPath');
  if (receipt.nativeGoalCommandUsed !== true) invalidFields.push('nativeGoalCommandUsed');
  if (!receipt.stdoutRef) invalidFields.push('stdoutRef');
  if (!receipt.stderrRef) invalidFields.push('stderrRef');
  if (receipt.exitCode !== 0) invalidFields.push('exitCode');
  if (invalidFields.length === 0) return null;
  return buildRuntimeBlocker(
    { ...input, compiledPromptRef: { goalExecutionHash: input.goalExecutionHash } },
    'native_goal_receipt_invalid',
    invalidFields,
    sha256File(filePath),
    typeof receipt.exitCode === 'number' ? receipt.exitCode : 'not_available'
  );
}
