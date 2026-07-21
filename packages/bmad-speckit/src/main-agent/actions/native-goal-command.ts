import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { normalizeRuntimeHost } from '../runtime/host-runtime-mode';

interface CompiledPromptRefLike {
  auditReceiptPath: string;
  goalExecutionPath?: string | null;
  goalExecutionHash?: string | null;
}

interface NativeGoalCommandInput {
  projectRoot: string;
  host: string;
  compiledPromptRef: CompiledPromptRefLike;
  packetId: string;
}

interface NativeGoalBlockedResult {
  ok: false;
  reasonCode: string;
  driftFlags: string[];
  evidence: string[];
}

interface NativeGoalResolvedResult {
  ok: true;
  commandText: string;
  goalExecutionPath: string;
  goalExecutionHash: string;
  auditReceiptPath: string;
  goalCommand: {
    mode: 'native_goal_document_ref';
    commandText: string;
    documentPath: string;
    documentHash: string;
    chars: number;
    nativeGoalCommandUsed: true;
  };
}

type NativeGoalCommandResult = NativeGoalResolvedResult | NativeGoalBlockedResult;

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function resolveProjectPath(projectRoot: string, filePath: string): string {
  return path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(projectRoot, filePath);
}

function blocked(
  reasonCode: string,
  driftFlags: string[],
  evidence: string[]
): NativeGoalBlockedResult {
  return { ok: false, reasonCode, driftFlags, evidence };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function generatorAuditReceipt(receipt: Record<string, unknown>): Record<string, unknown> {
  const generatorAudit = receipt.generatorAudit;
  return generatorAudit &&
    typeof generatorAudit === 'object' &&
    !Array.isArray(generatorAudit)
    ? (generatorAudit as Record<string, unknown>)
    : receipt;
}

function readReceipt(filePath: string): Record<string, unknown> | null {
  try {
    return object(JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown);
  } catch {
    return null;
  }
}

export function resolveNativeGoalCommand(input: NativeGoalCommandInput): NativeGoalCommandResult {
  const host = normalizeRuntimeHost(input.host);
  if (host !== 'codex' && host !== 'claude-code-cli') {
    return blocked('native_goal_incompatible_host', ['native-goal-incompatible-host'], [
      `host ${input.host} is not contracted for host-native /goal invocation`,
    ]);
  }

  const auditReceiptPath = resolveProjectPath(
    input.projectRoot,
    input.compiledPromptRef.auditReceiptPath
  );
  if (!fs.existsSync(auditReceiptPath)) {
    return blocked('native_goal_audit_receipt_missing', ['native-goal-audit-receipt-missing'], [
      `audit_receipt.json missing: ${auditReceiptPath}`,
    ]);
  }

  const receipt = readReceipt(auditReceiptPath);
  if (!receipt) {
    return blocked('native_goal_audit_receipt_invalid', ['native-goal-audit-receipt-invalid'], [
      `audit_receipt.json is not strict JSON: ${auditReceiptPath}`,
    ]);
  }

  const generatorReceipt = generatorAuditReceipt(receipt);
  const goalCommand = object(generatorReceipt.goalCommand);
  if (text(goalCommand.mode) !== 'native_goal_document_ref') {
    return blocked('native_goal_command_missing', ['native-goal-command-missing'], [
      `packet ${input.packetId} audit_receipt.json goalCommand.mode is ${text(goalCommand.mode) || 'missing'}`,
    ]);
  }

  const goalExecutionPath = input.compiledPromptRef.goalExecutionPath
    ? resolveProjectPath(input.projectRoot, input.compiledPromptRef.goalExecutionPath)
    : '';
  if (!goalExecutionPath || !fs.existsSync(goalExecutionPath)) {
    return blocked('native_goal_document_missing', ['native-goal-document-missing'], [
      `goal_execution.md missing for packet ${input.packetId}`,
    ]);
  }

  const goalExecutionText = fs.readFileSync(goalExecutionPath, 'utf8');
  const actualGoalExecutionHash = sha256Text(goalExecutionText);
  const expectedDocumentHash = text(goalCommand.documentHash);
  if (
    expectedDocumentHash !== actualGoalExecutionHash ||
    input.compiledPromptRef.goalExecutionHash !== actualGoalExecutionHash
  ) {
    return blocked('native_goal_document_hash_mismatch', ['native-goal-document-hash-mismatch'], [
      `goal_execution.md hash mismatch for packet ${input.packetId}`,
      `expected=${expectedDocumentHash || 'missing'}`,
      `actual=${actualGoalExecutionHash}`,
    ]);
  }

  const continuationDirective = object(generatorReceipt.continuationDirective);
  const commandText = text(goalCommand.commandText) || text(continuationDirective.directive);
  if (!commandText.startsWith('/goal ')) {
    return blocked('native_goal_command_missing', ['native-goal-command-missing'], [
      `native /goal command text missing for packet ${input.packetId}`,
    ]);
  }

  const documentPath = text(goalCommand.documentPath)
    ? resolveProjectPath(input.projectRoot, text(goalCommand.documentPath))
    : goalExecutionPath;
  return {
    ok: true,
    commandText,
    goalExecutionPath,
    goalExecutionHash: actualGoalExecutionHash,
    auditReceiptPath,
    goalCommand: {
      mode: 'native_goal_document_ref',
      commandText,
      documentPath,
      documentHash: actualGoalExecutionHash,
      chars:
        typeof goalCommand.chars === 'number' && Number.isFinite(goalCommand.chars)
          ? goalCommand.chars
          : Array.from(commandText).length,
      nativeGoalCommandUsed: true,
    },
  };
}
