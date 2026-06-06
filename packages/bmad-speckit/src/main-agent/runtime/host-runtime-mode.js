const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function sha256File(filePath) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function safeSegment(value) {
  return String(value || '').replace(/[^A-Za-z0-9._-]+/g, '-') || 'unknown';
}

function normalizeRuntimeHost(host) {
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

function selectExecutionRuntimeMode(host) {
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

function runtimeModeDir(projectRoot, recordId, attemptId) {
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeExecutionRuntimeModeSelection(input) {
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

function buildRuntimeBlocker(input, reasonCode, invalidFields, receiptHash, exitCode) {
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

function validateNativeGoalReadiness(input) {
  const selected = selectExecutionRuntimeMode(input.host);
  if (selected.executionRuntimeMode !== 'native_goal') return null;
  const invalidFields = [];
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
    const receipt = JSON.parse(fs.readFileSync(ref.auditReceiptPath, 'utf8'));
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

function writeRuntimeBlocker(projectRoot, recordId, attemptId, blocker) {
  const filePath = path.join(runtimeModeDir(projectRoot, recordId, attemptId), 'runtime-blocker.json');
  writeJson(filePath, blocker);
  return filePath;
}

function writeNativeGoalInvocationReceipt(input) {
  const receipt = {
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
  writeJson(filePath, receipt);
  return { receipt, path: filePath };
}

function validateNativeGoalInvocationReceipt(input) {
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
  const receipt = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const invalidFields = [];
  if (receipt.packetId !== input.packetId) invalidFields.push('packetId');
  if (receipt.attemptId !== input.attemptId) invalidFields.push('attemptId');
  if (receipt.invokedCommandKind !== 'host_native_goal') invalidFields.push('invokedCommandKind');
  if (receipt.goalExecutionHash !== input.goalExecutionHash) invalidFields.push('goalExecutionHash');
  if (!receipt.stdoutRef) invalidFields.push('stdoutRef');
  if (!receipt.stderrRef) invalidFields.push('stderrRef');
  if (receipt.exitCode !== 0) invalidFields.push('exitCode');
  if (invalidFields.length === 0) return null;
  return buildRuntimeBlocker(
    { ...input, compiledPromptRef: { goalExecutionHash: input.goalExecutionHash } },
    'native_goal_receipt_invalid',
    invalidFields,
    sha256File(filePath),
    receipt.exitCode ?? 'not_available'
  );
}

module.exports = {
  normalizeRuntimeHost,
  selectExecutionRuntimeMode,
  runtimeModeDir,
  writeExecutionRuntimeModeSelection,
  validateNativeGoalReadiness,
  writeRuntimeBlocker,
  writeNativeGoalInvocationReceipt,
  validateNativeGoalInvocationReceipt,
};
