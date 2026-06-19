const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeRuntimeHost } = require('../runtime/host-runtime-mode.js');

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

function resolveProjectPath(projectRoot, filePath) {
  return path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(projectRoot, filePath);
}

function blocked(reasonCode, driftFlags, evidence) {
  return { ok: false, reasonCode, driftFlags, evidence };
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readReceipt(filePath) {
  try {
    return object(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return null;
  }
}

function resolveNativeGoalCommand(input) {
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

  const goalCommand = object(receipt.goalCommand);
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

  const continuationDirective = object(receipt.continuationDirective);
  const commandText = text(goalCommand.commandText) || text(continuationDirective.directive);
  if (!commandText.startsWith('/goal ')) {
    return blocked('native_goal_command_missing', ['native-goal-command-missing'], [
      `native /goal command text missing for packet ${input.packetId}`,
    ]);
  }

  const documentPath = text(goalCommand.documentPath)
    ? resolveProjectPath(input.projectRoot, text(goalCommand.documentPath))
    : goalExecutionPath;
  const metadata = {
    mode: 'native_goal_document_ref',
    commandText,
    documentPath,
    documentHash: actualGoalExecutionHash,
    chars:
      typeof goalCommand.chars === 'number' && Number.isFinite(goalCommand.chars)
        ? goalCommand.chars
        : Array.from(commandText).length,
    nativeGoalCommandUsed: true,
  };

  return {
    ok: true,
    commandText,
    goalExecutionPath,
    goalExecutionHash: actualGoalExecutionHash,
    auditReceiptPath,
    goalCommand: metadata,
  };
}

module.exports = {
  resolveNativeGoalCommand,
};
