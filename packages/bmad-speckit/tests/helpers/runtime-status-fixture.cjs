const { createHash } = require('node:crypto');
const {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionRecordPatch,
} = require('../../dist/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt');

function sha256(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function withVerifiedModelStatus(
  inputRecord,
  {
    modelId,
    authorityClass,
    createdAt = '2026-07-15T00:00:00.000Z',
  }
) {
  const record = {
    ...inputRecord,
    requirementSetId: inputRecord.requirementSetId || `${inputRecord.recordId}-SET`,
    currentAttemptId: inputRecord.currentAttemptId || `${inputRecord.recordId}-ATTEMPT`,
    semanticModelHash:
      inputRecord.semanticModelHash || sha256(`${inputRecord.recordId}:semantic-model`),
  };
  const stageInputPath = `runtime/status/${modelId}-input.json`;
  const gateOutputPath = `runtime/status/${modelId}-gate.json`;
  const receiptPath = `runtime/status/${modelId}-decision.json`;
  const stageInputHash = sha256(`${record.recordId}:${modelId}:input`);
  const gateOutputHash = sha256(`${record.recordId}:${modelId}:gate`);
  const update = createRuntimeStatusProjectionUpdate({
    recordId: record.recordId,
    requirementSetId: record.requirementSetId,
    modelId,
    implementationAttemptId: record.currentAttemptId,
    sourceDocumentHash: record.sourceDocumentHash,
    implementationConfirmationHash: record.implementationConfirmationHash,
    semanticModelHash: record.semanticModelHash,
    stageInputs: [{ role: `${modelId}_input`, path: stageInputPath, hash: stageInputHash }],
    deterministicGateOutputs: [
      { role: `${modelId}_gate`, path: gateOutputPath, hash: gateOutputHash },
    ],
    blockerRefs: [],
    evidenceRefs: [gateOutputPath],
    authorityClass,
    decision: 'pass',
    effectiveStatus: 'pass',
    createdAt,
    receiptPath,
    projection: { status: 'pass' },
  });
  if (!update.receiptRef) {
    throw new Error(
      `runtime status fixture authority missing: ${update.missingAuthorityBindings.join(',')}`
    );
  }
  return {
    ...record,
    ...runtimeStatusProjectionRecordPatch({
      record,
      modelId,
      update,
    }),
  };
}

module.exports = {
  sha256,
  withVerifiedModelStatus,
};
