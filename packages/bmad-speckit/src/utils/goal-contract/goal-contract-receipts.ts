const fs = require('node:fs');
const path = require('node:path');
const { safeWriteJson, sha256File } = require(
  __filename.endsWith('.ts')
    ? path.join(__dirname, '..', '..', '..', 'dist', 'utils', 'large-document-writer')
    : '../large-document-writer'
);
const { writeValidatedPartitionReceipt } = require(
  __filename.endsWith('.ts')
    ? './partition-receipts.ts'
    : './partition-receipts'
);

export type GoalContractReceiptsModule = never;

function failure(failureClass, details = {}) {
  const error = new Error(failureClass);
  Object.assign(error, { failureClass, ...details });
  return error;
}

function defaultReceiptPaths(outPath) {
  const resolved = path.resolve(outPath);
  const dir = path.dirname(resolved);
  const base = path.basename(resolved, path.extname(resolved));
  return {
    coverageReceiptPath: path.join(dir, `.${base}.coverage.json`),
    generationReceiptPath: path.join(dir, `.${base}.generation.json`),
  };
}

function writeCoverageReceipt(filePath, receipt) {
  safeWriteJson(filePath, receipt, { mode: 'upsert' });
  return filePath;
}

function writeGenerationReceipt(filePath, receipt) {
  if (
    receipt?.evidenceTerminalState === 'FINAL_PASS' &&
    receipt?.evidenceClosure?.decision !== 'pass'
  ) {
    throw failure('generation_receipt_final_pass_unproven');
  }
  safeWriteJson(filePath, receipt, { mode: 'upsert' });
  return filePath;
}

function fileHashIfExists(filePath) {
  return fs.existsSync(filePath) ? sha256File(filePath) : null;
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function writePartitionChildCoverageReceipt({
  targetPath,
  partitionId,
  partitionManifestHash,
  selectionReceiptHash,
  globalCoverageReceiptHash,
  selectedPrimaryObligationIds,
  inheritedConstraintIds,
  excludedObligationIds,
  unmappedSelectedObligations,
  orphanGeneratedTaskIds,
  orphanGeneratedAcceptanceIds,
}) {
  const unmapped = uniqueStrings(unmappedSelectedObligations);
  const orphanTasks = uniqueStrings(orphanGeneratedTaskIds);
  const orphanAcceptance = uniqueStrings(orphanGeneratedAcceptanceIds);
  const blockingReasons = [
    ...(unmapped.length > 0 ? ['partition_child_selected_obligation_unmapped'] : []),
    ...(orphanTasks.length > 0 ? ['partition_child_generated_task_orphaned'] : []),
    ...(orphanAcceptance.length > 0
      ? ['partition_child_generated_acceptance_orphaned']
      : []),
  ];
  return writeValidatedPartitionReceipt({
    schemaId: 'goal-contract-partition-child-coverage-receipt/v1',
    targetPath,
    payload: {
      schemaVersion: 'goal-contract-partition-child-coverage-receipt/v1',
      partitionId,
      partitionManifestHash,
      selectionReceiptHash,
      globalCoverageReceiptHash,
      selectedPrimaryObligationIds: uniqueStrings(selectedPrimaryObligationIds),
      inheritedConstraintIds: uniqueStrings(inheritedConstraintIds),
      excludedObligationIds: uniqueStrings(excludedObligationIds),
      unmappedSelectedObligations: unmapped,
      orphanGeneratedTaskIds: orphanTasks,
      orphanGeneratedAcceptanceIds: orphanAcceptance,
      decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
      blockingReasons,
    },
  });
}

function writePartitionChildGenerationReceipt({
  targetPath,
  masterSourcePath,
  masterSourceHash,
  sourceSnapshotHash,
  methodologyProfileHash,
  methodologyProfileArtifactHash,
  executionProjectionHash,
  taskDagHash,
  sequenceMode,
  sequenceApplicability,
  sequenceCoverage,
  sequenceClosureStatus,
  childContractAuthority,
  partitionPolicyHash,
  partitionPolicyArtifactHash,
  partitionManifestPath,
  partitionManifestHash,
  partitionAnalysisReceiptHash,
  partitionSetHash,
  partitionId,
  partitionRole,
  selectionReceiptPath,
  selectionReceiptHash,
  selectionSetHash,
  globalCoverageReceiptPath,
  globalCoverageReceiptHash,
  goalContractPath,
  goalContractHash,
  coverageReceiptPath,
  coverageReceiptHash,
  selectedAtomicTaskCount,
  inheritedConstraintCount,
  rendererAudit,
  deterministicPreflight,
  commandPortabilityAudit,
  writeReceipt,
}) {
  for (const [field, value] of Object.entries({
    sequenceMode,
    sequenceApplicability,
    sequenceCoverage,
    sequenceClosureStatus,
    childContractAuthority,
  })) {
    if (typeof value !== 'string' || value.length === 0) {
      throw failure('partition_child_generation_sequence_state_missing', {
        field,
      });
    }
  }
  const blockingReasons = [];
  if (
    rendererAudit?.requiredSlotsPassed !== true ||
    rendererAudit?.requiredSectionsPassed !== true ||
    rendererAudit?.invariantFragmentsPassed !== true
  ) {
    blockingReasons.push('partition_child_renderer_audit_failed');
  }
  if (deterministicPreflight?.decision !== 'pass') {
    blockingReasons.push('partition_child_deterministic_preflight_failed');
  }
  if (commandPortabilityAudit?.status !== 'PASS') {
    blockingReasons.push('partition_child_command_portability_failed');
  }
  if (!Number.isInteger(selectedAtomicTaskCount) || selectedAtomicTaskCount < 1) {
    blockingReasons.push('partition_child_selected_task_count_invalid');
  }
  if (writeReceipt?.finalHash !== goalContractHash) {
    blockingReasons.push('partition_child_safe_write_hash_mismatch');
  }
  return writeValidatedPartitionReceipt({
    schemaId: 'goal-contract-partition-child-generation-receipt/v1',
    targetPath,
    payload: {
      schemaVersion: 'goal-contract-partition-child-generation-receipt/v1',
      masterSourcePath,
      masterSourceHash,
      sourceSnapshotHash,
      methodologyProfileHash,
      methodologyProfileArtifactHash,
      executionProjectionHash,
      taskDagHash,
      sequenceMode,
      sequenceApplicability,
      sequenceCoverage,
      sequenceClosureStatus,
      childContractAuthority,
      partitionPolicyHash,
      partitionPolicyArtifactHash,
      partitionManifestPath,
      partitionManifestHash,
      partitionAnalysisReceiptHash,
      partitionSetHash,
      partitionId,
      partitionRole,
      selectionReceiptPath,
      selectionReceiptHash,
      selectionSetHash,
      globalCoverageReceiptPath,
      globalCoverageReceiptHash,
      goalContractPath,
      goalContractHash,
      coverageReceiptPath,
      coverageReceiptHash,
      selectedAtomicTaskCount,
      inheritedConstraintCount,
      rendererAudit,
      deterministicPreflight,
      commandPortabilityAudit,
      writeReceipt,
      decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
      blockingReasons,
    },
  });
}

module.exports = {
  defaultReceiptPaths,
  fileHashIfExists,
  writePartitionChildCoverageReceipt,
  writePartitionChildGenerationReceipt,
  writeCoverageReceipt,
  writeGenerationReceipt,
};
