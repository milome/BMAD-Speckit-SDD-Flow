import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CompiledPromptRef } from './orchestration-dispatch-contract';

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

export interface ExecutionRuntimeModeSelection {
  schemaVersion: 'execution-runtime-mode-selection/v1';
  recordId: string;
  packetId: string;
  attemptId: string;
  host: string;
  canonicalHost: CanonicalRuntimeHost;
  executionRuntimeMode: ExecutionRuntimeMode;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  modelPacketHash: string;
  goalExecutionHash: string | null;
  selectedAt: string;
  selectionReason: string;
  blocked: false;
}

export interface RuntimeBlocker {
  schemaVersion: 'runtime-blocker/v1';
  reasonCode: string;
  host: string;
  executionRuntimeMode: ExecutionRuntimeMode;
  attemptId: string;
  packetId: string;
  goalExecutionHash: string | null;
  receiptHash: string;
  exitCode: string | number;
  blockedActions: string[];
  recordHash: string;
  reasonDetails: Record<string, unknown>;
}

export interface NativeGoalInvocationReceipt {
  schemaVersion: 'native-goal-invocation-receipt/v1';
  host: string;
  executionRuntimeMode: 'native_goal';
  goalExecutionPath: string;
  goalExecutionHash: string;
  invokedCommandKind: 'host_native_goal';
  startedAt: string;
  endedAt: string;
  exitCode: number;
  stdoutRef: string;
  stderrRef: string;
  packetId: string;
  attemptId: string;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-') || 'unknown';
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

export function selectExecutionRuntimeMode(host: string | null | undefined): {
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

export function writeExecutionRuntimeModeSelection(input: {
  projectRoot: string;
  recordId: string;
  packetId: string;
  attemptId: string;
  host: string;
  compiledPromptRef: CompiledPromptRef;
}): { selection: ExecutionRuntimeModeSelection; path: string } {
  const selected = selectExecutionRuntimeMode(input.host);
  const selection: ExecutionRuntimeModeSelection = {
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
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(selection, null, 2)}\n`, 'utf8');
  return { selection, path: filePath };
}

export function validateNativeGoalReadiness(input: {
  projectRoot: string;
  recordId: string;
  packetId: string;
  attemptId: string;
  host: string;
  compiledPromptRef: CompiledPromptRef;
}): RuntimeBlocker | null {
  const selected = selectExecutionRuntimeMode(input.host);
  if (selected.executionRuntimeMode !== 'native_goal') return null;
  const invalidFields: string[] = [];
  if (!input.compiledPromptRef.goalExecutionPath) invalidFields.push('goalExecutionPath');
  if (!input.compiledPromptRef.goalExecutionHash) invalidFields.push('goalExecutionHash');
  if (
    input.compiledPromptRef.goalExecutionPath &&
    (!fs.existsSync(input.compiledPromptRef.goalExecutionPath) ||
      sha256File(input.compiledPromptRef.goalExecutionPath) !==
        input.compiledPromptRef.goalExecutionHash)
  ) {
    invalidFields.push('goalExecutionHash');
  }
  if (!fs.existsSync(input.compiledPromptRef.auditReceiptPath)) {
    invalidFields.push('auditReceiptPath');
  } else {
    const receipt = JSON.parse(
      fs.readFileSync(input.compiledPromptRef.auditReceiptPath, 'utf8')
    ) as Record<string, unknown>;
    const goalCommand = receipt.goalCommand as Record<string, unknown> | undefined;
    if (goalCommand?.mode !== 'native_goal_document_ref')
      invalidFields.push('audit_receipt.goalCommand.mode');
    if (goalCommand?.documentHash !== input.compiledPromptRef.goalExecutionHash) {
      invalidFields.push('audit_receipt.goalCommand.documentHash');
    }
  }
  if (invalidFields.length === 0) return null;
  return {
    schemaVersion: 'runtime-blocker/v1',
    reasonCode: 'native_goal_readiness_invalid',
    host: input.host,
    executionRuntimeMode: 'native_goal',
    attemptId: input.attemptId,
    packetId: input.packetId,
    goalExecutionHash: input.compiledPromptRef.goalExecutionHash ?? null,
    receiptHash: fs.existsSync(input.compiledPromptRef.auditReceiptPath)
      ? sha256File(input.compiledPromptRef.auditReceiptPath)
      : 'missing',
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
    reasonDetails: { invalidFields },
  };
}

export function writeRuntimeBlocker(
  projectRoot: string,
  recordId: string,
  attemptId: string,
  blocker: RuntimeBlocker
): string {
  const filePath = path.join(
    runtimeModeDir(projectRoot, recordId, attemptId),
    'runtime-blocker.json'
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(blocker, null, 2)}\n`, 'utf8');
  return filePath;
}

export function writeNativeGoalInvocationReceipt(input: {
  projectRoot: string;
  recordId: string;
  attemptId: string;
  packetId: string;
  host: string;
  goalExecutionPath: string;
  stdoutRef: string;
  stderrRef: string;
  exitCode: number;
  startedAt?: string;
  endedAt?: string;
}): { receipt: NativeGoalInvocationReceipt; path: string } {
  const receipt: NativeGoalInvocationReceipt = {
    schemaVersion: 'native-goal-invocation-receipt/v1',
    host: input.host,
    executionRuntimeMode: 'native_goal',
    goalExecutionPath: input.goalExecutionPath,
    goalExecutionHash: sha256File(input.goalExecutionPath),
    invokedCommandKind: 'host_native_goal',
    startedAt: input.startedAt ?? new Date().toISOString(),
    endedAt: input.endedAt ?? new Date().toISOString(),
    exitCode: input.exitCode,
    stdoutRef: input.stdoutRef,
    stderrRef: input.stderrRef,
    packetId: input.packetId,
    attemptId: input.attemptId,
  };
  const filePath = path.join(
    runtimeModeDir(input.projectRoot, input.recordId, input.attemptId),
    'native-goal-invocation-receipt.json'
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return { receipt, path: filePath };
}

export function validateNativeGoalInvocationReceipt(input: {
  projectRoot: string;
  recordId: string;
  attemptId: string;
  packetId: string;
  host: string;
  goalExecutionHash: string;
}): RuntimeBlocker | null {
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
  const receipt = JSON.parse(fs.readFileSync(filePath, 'utf8')) as NativeGoalInvocationReceipt;
  const invalidFields: string[] = [];
  if (receipt.packetId !== input.packetId) invalidFields.push('packetId');
  if (receipt.attemptId !== input.attemptId) invalidFields.push('attemptId');
  if (receipt.invokedCommandKind !== 'host_native_goal') invalidFields.push('invokedCommandKind');
  if (receipt.goalExecutionHash !== input.goalExecutionHash)
    invalidFields.push('goalExecutionHash');
  if (!receipt.stdoutRef) invalidFields.push('stdoutRef');
  if (!receipt.stderrRef) invalidFields.push('stderrRef');
  if (receipt.exitCode !== 0) invalidFields.push('exitCode');
  if (invalidFields.length === 0) return null;
  return {
    schemaVersion: 'runtime-blocker/v1',
    reasonCode: 'native_goal_receipt_invalid',
    host: input.host,
    executionRuntimeMode: 'native_goal',
    attemptId: input.attemptId,
    packetId: input.packetId,
    goalExecutionHash: input.goalExecutionHash,
    receiptHash: sha256File(filePath),
    exitCode: receipt.exitCode ?? 'not_available',
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
