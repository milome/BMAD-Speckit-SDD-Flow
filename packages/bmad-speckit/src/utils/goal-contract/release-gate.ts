const fs = require('node:fs');
const path = require('node:path');
const {
  normalizePath,
  sha256File,
  stableStringify,
} = require(
  __filename.endsWith('.ts')
    ? '../large-document-writer/receipts.ts'
    : '../large-document-writer/receipts'
);
const {
  readValidatedPartitionReceipt,
  writeValidatedPartitionReceipt,
} = require(
  __filename.endsWith('.ts')
    ? './partition-receipts.ts'
    : './partition-receipts'
);
const {
  buildGlobalPartitionCoverageReceipt,
  selectPartitionScope,
} = require(
  __filename.endsWith('.ts')
    ? './partition-selector.ts'
    : './partition-selector'
);

export type GoalContractReleaseGateModule = never;

const ZERO_HASH = `sha256:${'0'.repeat(64)}`;

function take(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('-')) return undefined;
  return value;
}

function has(args, name) {
  return args.includes(name);
}

function normalize(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function parseFrontMatterValue(rawValue) {
  const value = rawValue.trim();
  if (
    (value.startsWith('[') && value.endsWith(']')) ||
    (value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/u.test(value)) return Number(value);
  return value;
}

function parseGoalContractBinding(goalPath) {
  if (!goalPath || !fs.existsSync(goalPath)) {
    return Object.freeze({
      mode: 'whole_source',
      goalPath: goalPath ? normalize(goalPath) : null,
      fields: {},
    });
  }
  const text = fs.readFileSync(goalPath, 'utf8');
  const lines = text.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === '---');
  if (start < 0) {
    return Object.freeze({
      mode: 'whole_source',
      goalPath: normalize(goalPath),
      fields: {},
    });
  }
  const fields: Record<string, any> = {};
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index] === '---') break;
    const separator = lines[index].indexOf(':');
    if (separator <= 0) continue;
    const key = lines[index].slice(0, separator).trim();
    fields[key] = parseFrontMatterValue(
      lines[index].slice(separator + 1)
    );
  }
  return Object.freeze({
    mode:
      typeof fields.partitionId === 'string'
        ? 'partition'
        : 'whole_source',
    goalPath: normalize(goalPath),
    fields: Object.freeze(fields),
  });
}

function resolveBoundPath(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  return path.resolve(value);
}

function readJsonIfExists(filePath, blockingReasons, missingCode, invalidCode) {
  if (!filePath || !fs.existsSync(filePath)) {
    blockingReasons.push(missingCode);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    blockingReasons.push(invalidCode);
    return null;
  }
}

function checkArrayField(value, fieldName, blockingReasons) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) {
    blockingReasons.push(`${fieldName}_missing`);
    return [];
  }
  blockingReasons.push(`${fieldName}_not_array`);
  return [];
}

function checkGoalContractReleaseGate({ source, goal, coverage, generation }) {
  const blockingReasons = [];
  if (!source || !fs.existsSync(source)) blockingReasons.push('source_plan_missing');
  if (!goal || !fs.existsSync(goal)) blockingReasons.push('goal_contract_missing');
  const coverageReceipt = readJsonIfExists(
    coverage,
    blockingReasons,
    'coverage_receipt_missing',
    'coverage_receipt_invalid_json'
  );
  const generationReceipt = readJsonIfExists(
    generation,
    blockingReasons,
    'generation_receipt_missing',
    'generation_receipt_invalid_json'
  );

  const sourceHash = source && fs.existsSync(source) ? sha256File(source) : null;
  const goalHash = goal && fs.existsSync(goal) ? sha256File(goal) : null;

  if (coverageReceipt) {
    if (sourceHash && coverageReceipt.sourcePlanHash !== sourceHash) blockingReasons.push('source_hash_mismatch');
    if (goalHash && coverageReceipt.goalContractHash !== goalHash) blockingReasons.push('goal_contract_hash_mismatch');
    const unmappedSourceObligations = checkArrayField(
      coverageReceipt.unmappedSourceObligations,
      'coverage_unmapped_source_obligations',
      blockingReasons
    );
    const orphanGeneratedRefs = checkArrayField(
      coverageReceipt.orphanGeneratedRefs,
      'coverage_orphan_generated_refs',
      blockingReasons
    );
    const coverageBlockingReasons = checkArrayField(
      coverageReceipt.blockingReasons,
      'coverage_blocking_reasons',
      blockingReasons
    );
    if (unmappedSourceObligations.length > 0) {
      blockingReasons.push('unmapped_source_obligations');
    }
    if (orphanGeneratedRefs.length > 0) {
      blockingReasons.push('orphan_generated_refs');
    }
    if (coverageBlockingReasons.length > 0) {
      blockingReasons.push('coverage_blocking_reasons');
    }
    if (coverageReceipt.decision !== 'pass') blockingReasons.push('coverage_decision_not_pass');
  }

  if (generationReceipt) {
    if (generationReceipt.ok !== true) blockingReasons.push('generation_receipt_not_ok');
    if (sourceHash && generationReceipt.sourcePlanHash !== sourceHash) blockingReasons.push('generation_source_hash_mismatch');
    if (goalHash && generationReceipt.goalContractHash !== goalHash) blockingReasons.push('generation_goal_hash_mismatch');
    if (generationReceipt.unmappedSourceObligations !== 0) {
      blockingReasons.push('generation_unmapped_source_obligations');
    }
    if (!generationReceipt.coverageReceiptPath) blockingReasons.push('generation_coverage_receipt_path_missing');
  }

  return {
    ok: blockingReasons.length === 0,
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    sourcePlanPath: source ? normalize(source) : null,
    goalContractPath: goal ? normalize(goal) : null,
    coverageReceiptPath: coverage ? normalize(coverage) : null,
    generationReceiptPath: generation ? normalize(generation) : null,
    sourcePlanHash: sourceHash,
    goalContractHash: goalHash,
    unmappedSourceObligations: Array.isArray(coverageReceipt?.unmappedSourceObligations)
      ? coverageReceipt.unmappedSourceObligations.length
      : null,
  };
}

function readStrictReceipt({
  targetPath,
  schemaId,
  blockingReasons,
  missingCode,
  invalidCode,
}) {
  if (!targetPath || !fs.existsSync(targetPath)) {
    blockingReasons.push(missingCode);
    return null;
  }
  try {
    return readValidatedPartitionReceipt(targetPath, schemaId);
  } catch {
    blockingReasons.push(invalidCode);
    return null;
  }
}

function inferReceiptsDir({
  explicitReceiptsDir,
  selectionReceiptPath,
  selectionReceiptRelativePath,
  manifestPath,
}) {
  if (explicitReceiptsDir) return path.resolve(explicitReceiptsDir);
  const absoluteSelection = normalize(selectionReceiptPath || '');
  const relativeSelection = String(selectionReceiptRelativePath || '');
  const suffix = relativeSelection ? `/${relativeSelection}` : '';
  if (suffix && absoluteSelection.endsWith(suffix)) {
    return path.resolve(absoluteSelection.slice(0, -suffix.length));
  }
  return path.join(
    path.dirname(path.resolve(manifestPath)),
    '.goal-contract-receipts'
  );
}

function resolveReceiptPath(receiptsDir, receiptPath) {
  const root = path.resolve(receiptsDir);
  const resolved = path.resolve(root, receiptPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function compareField({
  actual,
  expected,
  reason,
  blockingReasons,
}) {
  if (actual !== expected) blockingReasons.push(reason);
}

function expectedCoverageExclusions(selection) {
  return unique([
    ...(selection.excludedSourceObligationIds || []),
    ...(selection.excludedTraceSliceIds || []),
    ...(selection.excludedAtomicTaskIds || []),
    ...(selection.excludedAcceptanceIds || []),
    ...(selection.excludedCommandIds || []),
    ...(selection.excludedEvidenceContractIds || []),
  ]);
}

function currentChildRecords(goalText, expectedSelection, blockingReasons) {
  for (const taskId of expectedSelection.selectedPrimaryAtomicTaskIds || []) {
    if (!goalText.includes(taskId)) {
      blockingReasons.push('partition_child_selected_task_missing');
      break;
    }
  }
  for (const acceptanceId of expectedSelection.selectedAcceptanceIds || []) {
    if (!goalText.includes(acceptanceId)) {
      blockingReasons.push('partition_child_selected_acceptance_missing');
      break;
    }
  }
}

function readPredecessorCompletions(paths, blockingReasons) {
  const byPartitionId = new Map();
  const hashes = [];
  for (const receiptPath of paths || []) {
    if (!fs.existsSync(receiptPath)) {
      blockingReasons.push('partition_predecessor_completion_missing');
      continue;
    }
    let receipt;
    try {
      receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    } catch {
      blockingReasons.push('partition_predecessor_completion_invalid');
      continue;
    }
    if (
      typeof receipt.partitionId !== 'string' ||
      byPartitionId.has(receipt.partitionId)
    ) {
      blockingReasons.push('partition_predecessor_completion_ambiguous');
      continue;
    }
    const receiptHash = sha256File(receiptPath);
    byPartitionId.set(receipt.partitionId, {
      receipt,
      receiptHash,
    });
    hashes.push(receiptHash);
  }
  return { byPartitionId, hashes: unique(hashes) };
}

function validateCompatibilityRequirements({
  partition,
  manifest,
  receiptsDir,
  predecessorCompletionPaths,
  blockingReasons,
}) {
  const predecessorState = readPredecessorCompletions(
    predecessorCompletionPaths,
    blockingReasons
  );
  const compatibilityHashes = [];
  for (const predecessorPartitionId of partition.dependencyPartitionIds || []) {
    const predecessor = predecessorState.byPartitionId.get(
      predecessorPartitionId
    );
    if (!predecessor) {
      blockingReasons.push('partition_predecessor_completion_missing');
      continue;
    }
    const completion = predecessor.receipt;
    if (completion.partitionId !== predecessorPartitionId) {
      blockingReasons.push('partition_predecessor_partition_mismatch');
    }
    if (completion.masterSourceHash !== manifest.masterSourceHash) {
      blockingReasons.push('partition_predecessor_source_mismatch');
    }
    if (completion.sourceSnapshotHash !== manifest.sourceSnapshotHash) {
      blockingReasons.push('partition_predecessor_snapshot_mismatch');
    }
    if (completion.partitionManifestHash !== sha256File(
      path.resolve(manifest.activeManifestPath)
    )) {
      blockingReasons.push('partition_predecessor_manifest_mismatch');
    }
    if (completion.decision !== 'pass') {
      blockingReasons.push('partition_predecessor_completion_blocked');
    }
  }
  for (const requirement of partition.compatibilityReceiptRequirements || []) {
    const targetPath = resolveReceiptPath(receiptsDir, requirement.receiptPath);
    const receipt = readStrictReceipt({
      targetPath,
      schemaId: 'goal-contract-dependency-compatibility-receipt/v1',
      blockingReasons,
      missingCode: 'partition_compatibility_receipt_missing',
      invalidCode: 'partition_compatibility_receipt_invalid',
    });
    if (!receipt) continue;
    compatibilityHashes.push(sha256File(targetPath));
    const predecessor = predecessorState.byPartitionId.get(
      requirement.predecessorPartitionId
    );
    const currentArtifactPath = path.resolve(requirement.artifactPath);
    const currentArtifactHash = fs.existsSync(currentArtifactPath)
      ? sha256File(currentArtifactPath)
      : null;
    if (
      receipt.dependentPartitionId !== partition.partitionId ||
      receipt.predecessorPartitionId !==
        requirement.predecessorPartitionId
    ) {
      blockingReasons.push('partition_compatibility_partition_mismatch');
    }
    if (
      receipt.predecessorOwnedArtifactPath !== requirement.artifactPath ||
      !currentArtifactHash ||
      receipt.currentArtifactHash !== currentArtifactHash
    ) {
      blockingReasons.push('partition_compatibility_artifact_mismatch');
    }
    if (
      !predecessor ||
      receipt.predecessorCompletionReceiptHash !==
        predecessor.receiptHash ||
      receipt.predecessorArtifactHash !==
        predecessor.receipt.artifactHashes?.[requirement.artifactPath]
    ) {
      blockingReasons.push('partition_compatibility_predecessor_mismatch');
    }
    if (
      receipt.masterSourceHash !== manifest.masterSourceHash ||
      receipt.sourceSnapshotHash !== manifest.sourceSnapshotHash ||
      receipt.partitionManifestHash !== manifest.partitionManifestHash
    ) {
      blockingReasons.push('partition_compatibility_authority_mismatch');
    }
    if (
      receipt.decision !== 'pass' ||
      receipt.invalidatedAcceptanceIds.length > 0 ||
      receipt.compatibilityCommands.some(
        (command) =>
          command.exitCode !== 0 ||
          command.artifactHashes?.[requirement.artifactPath] !==
            currentArtifactHash
      )
    ) {
      blockingReasons.push('partition_compatibility_blocked');
    }
  }
  return {
    predecessorCompletionReceiptHashes: predecessorState.hashes,
    compatibilityReceiptHashes: unique(compatibilityHashes),
  };
}

const PARTITION_SEQUENCE_STATE_FIELDS = Object.freeze([
  'sequenceMode',
  'sequenceApplicability',
  'sequenceCoverage',
  'sequenceClosureStatus',
  'childContractAuthority',
]);

function evaluatePartitionSequenceRelease({
  binding = {},
  childGeneration = {},
  currentManifest = {},
  projectionBinding = {},
}) {
  const blockingReasons = [];
  const expectedSequenceState = {
    sequenceMode: currentManifest?.sequenceMode || 'auto',
    sequenceApplicability:
      currentManifest?.sequenceApplicability || 'unresolved',
    sequenceCoverage:
      currentManifest?.sequenceCoverage || 'unresolved',
    sequenceClosureStatus:
      currentManifest?.sequenceClosureStatus || 'unresolved',
    childContractAuthority:
      currentManifest?.childContractAuthority || 'core_only',
  };
  const projectionState = {
    sequenceMode: projectionBinding?.sequenceMode,
    sequenceApplicability:
      projectionBinding?.applicabilityDecision,
    sequenceCoverage: projectionBinding?.sequenceCoverage,
    sequenceClosureStatus:
      projectionBinding?.sequenceClosureStatus,
    childContractAuthority:
      projectionBinding?.childContractAuthority,
  };
  if (
    PARTITION_SEQUENCE_STATE_FIELDS.some(
      (field) =>
        binding?.[field] !== expectedSequenceState[field] ||
        childGeneration?.[field] !== expectedSequenceState[field] ||
        projectionState[field] !== expectedSequenceState[field]
    )
  ) {
    blockingReasons.push('partition_sequence_state_not_current');
  }
  if (expectedSequenceState.childContractAuthority !== 'full') {
    blockingReasons.push(
      expectedSequenceState.sequenceApplicability === 'unresolved'
        ? 'partition_sequence_applicability_unresolved'
        : 'partition_sequence_coverage_excluded'
    );
  }
  if (
    expectedSequenceState.sequenceApplicability === 'required' &&
    expectedSequenceState.sequenceCoverage === 'complete' &&
    expectedSequenceState.sequenceClosureStatus !== 'compiled'
  ) {
    blockingReasons.push('partition_sequence_closure_not_compiled');
  }
  const canonicalBlockingReasons = unique(blockingReasons);
  return Object.freeze({
    ...expectedSequenceState,
    decision:
      canonicalBlockingReasons.length === 0 ? 'pass' : 'blocked',
    componentDecision:
      canonicalBlockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons: canonicalBlockingReasons,
  });
}

function evaluatePartitionRelease(input) {
  const blockingReasons = [];
  const binding = input.binding.fields;
  const authority = input.partitionAuthority;
  const componentDecisions = {
    source: 'pass',
    methodology: 'pass',
    policy: 'pass',
    projection: 'pass',
    manifest: 'pass',
    sequence: 'pass',
    globalCoverage: 'pass',
    selection: 'pass',
    childCoverage: 'pass',
    childGeneration: 'pass',
    dependencies: 'not_applicable',
    compatibility: 'not_applicable',
  };
  const goalPath = path.resolve(input.goal);
  const goalText = fs.existsSync(goalPath)
    ? fs.readFileSync(goalPath, 'utf8')
    : '';
  if (!authority) {
    blockingReasons.push('partition_authority_not_current');
  }
  const currentManifest = authority?.compiled?.manifest || null;
  const currentManifestHash =
    authority?.compiled?.partitionManifestHash || ZERO_HASH;
  const currentMasterSourceHash =
    currentManifest?.masterSourceHash ||
    (input.source && fs.existsSync(input.source)
      ? sha256File(input.source)
      : ZERO_HASH);
  const currentSourceSnapshotHash =
    currentManifest?.sourceSnapshotHash || ZERO_HASH;
  const currentMethodologyHash =
    authority?.methodology?.methodologyProfileHash || ZERO_HASH;
  const currentMethodologyArtifactHash =
    authority?.methodology?.methodologyProfileArtifactHash || ZERO_HASH;
  const currentProjectionHash =
    authority?.projection?.executionProjectionHash || ZERO_HASH;
  const currentPolicyHash =
    authority?.optimizerPolicyBinding?.partitionPolicyHash || ZERO_HASH;
  const currentPolicyArtifactHash =
    authority?.optimizerPolicyBinding?.partitionPolicyArtifactHash ||
    ZERO_HASH;
  const currentAnalysisHash =
    authority?.compiled?.partitionAnalysisReceiptHash || ZERO_HASH;

  compareField({
    actual: binding.masterSourceHash,
    expected: currentMasterSourceHash,
    reason: 'partition_master_source_not_current',
    blockingReasons,
  });
  compareField({
    actual: binding.sourceSnapshotHash,
    expected: currentSourceSnapshotHash,
    reason: 'partition_source_snapshot_not_current',
    blockingReasons,
  });
  compareField({
    actual: binding.methodologyProfileHash,
    expected: currentMethodologyHash,
    reason: 'partition_methodology_profile_not_current',
    blockingReasons,
  });
  compareField({
    actual: binding.methodologyProfileArtifactHash,
    expected: currentMethodologyArtifactHash,
    reason: 'partition_methodology_profile_artifact_not_current',
    blockingReasons,
  });
  compareField({
    actual: binding.executionProjectionHash,
    expected: currentProjectionHash,
    reason: 'partition_execution_projection_not_current',
    blockingReasons,
  });
  compareField({
    actual: binding.partitionPolicyHash,
    expected: currentPolicyHash,
    reason: 'partition_policy_not_current',
    blockingReasons,
  });
  compareField({
    actual: binding.partitionPolicyArtifactHash,
    expected: currentPolicyArtifactHash,
    reason: 'partition_policy_artifact_not_current',
    blockingReasons,
  });
  if (
    blockingReasons.some((reason) =>
      reason.includes('source')
    )
  ) componentDecisions.source = 'blocked';
  if (
    blockingReasons.some((reason) =>
      reason.includes('methodology')
    )
  ) componentDecisions.methodology = 'blocked';
  if (
    blockingReasons.some((reason) =>
      reason.includes('policy')
    )
  ) componentDecisions.policy = 'blocked';
  if (
    blockingReasons.some((reason) =>
      reason.includes('projection')
    )
  ) componentDecisions.projection = 'blocked';

  const manifestPath =
    resolveBoundPath(binding.partitionManifestPath) ||
    resolveBoundPath(input.partitionManifest);
  let activeManifestHash = ZERO_HASH;
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    blockingReasons.push('partition_manifest_missing');
  } else {
    activeManifestHash = sha256File(manifestPath);
    if (activeManifestHash !== binding.partitionManifestHash) {
      blockingReasons.push('partition_manifest_hash_mismatch');
    }
    if (
      authority &&
      fs.readFileSync(manifestPath, 'utf8') !==
        authority.compiled.partitionManifestBytes
    ) {
      blockingReasons.push('partition_manifest_not_current');
    }
  }
  if (
    input.partitionManifest &&
    manifestPath !== path.resolve(input.partitionManifest)
  ) {
    blockingReasons.push('partition_manifest_path_mismatch');
  }
  if (binding.partitionManifestHash !== currentManifestHash) {
    blockingReasons.push('partition_manifest_binding_not_current');
  }
  if (binding.partitionAnalysisReceiptHash !== currentAnalysisHash) {
    blockingReasons.push('partition_analysis_receipt_not_current');
  }
  const partition = currentManifest?.partitions?.find(
    (item) => item.partitionId === binding.partitionId
  );
  if (!partition) {
    blockingReasons.push('partition_id_not_current');
  }
  if (
    input.partitionId &&
    input.partitionId !== binding.partitionId
  ) {
    blockingReasons.push('partition_id_argument_mismatch');
  }
  if (
    blockingReasons.some((reason) =>
      reason.includes('manifest') || reason === 'partition_id_not_current'
    )
  ) componentDecisions.manifest = 'blocked';

  const selectionPath = resolveBoundPath(binding.selectionReceiptPath);
  const receiptsDir =
    partition && manifestPath
      ? inferReceiptsDir({
          explicitReceiptsDir: input.receiptsDir,
          selectionReceiptPath: selectionPath,
          selectionReceiptRelativePath: partition.selectionReceiptPath,
          manifestPath,
        })
      : null;
  const globalCoveragePath = resolveBoundPath(
    binding.globalCoverageReceiptPath
  );
  const coveragePath =
    resolveBoundPath(input.coverage) ||
    resolveBoundPath(binding.coverageReceiptPath);
  const generationPath =
    resolveBoundPath(input.generation) ||
    resolveBoundPath(binding.generationReceiptPath);
  const globalCoverage = readStrictReceipt({
    targetPath: globalCoveragePath,
    schemaId: 'goal-contract-partition-global-coverage-receipt/v1',
    blockingReasons,
    missingCode: 'partition_global_coverage_missing',
    invalidCode: 'partition_global_coverage_invalid',
  });
  const selection = readStrictReceipt({
    targetPath: selectionPath,
    schemaId: 'goal-contract-partition-selection-receipt/v1',
    blockingReasons,
    missingCode: 'partition_selection_missing',
    invalidCode: 'partition_selection_invalid',
  });
  const childCoverage = readStrictReceipt({
    targetPath: coveragePath,
    schemaId: 'goal-contract-partition-child-coverage-receipt/v1',
    blockingReasons,
    missingCode: 'partition_child_coverage_missing',
    invalidCode: 'partition_child_coverage_invalid',
  });
  const childGeneration = readStrictReceipt({
    targetPath: generationPath,
    schemaId: 'goal-contract-partition-child-generation-receipt/v1',
    blockingReasons,
    missingCode: 'partition_child_generation_missing',
    invalidCode: 'partition_child_generation_invalid',
  });
  const globalCoverageHash =
    globalCoveragePath && fs.existsSync(globalCoveragePath)
      ? sha256File(globalCoveragePath)
      : ZERO_HASH;
  const selectionHash =
    selectionPath && fs.existsSync(selectionPath)
      ? sha256File(selectionPath)
      : ZERO_HASH;
  const childCoverageHash =
    coveragePath && fs.existsSync(coveragePath)
      ? sha256File(coveragePath)
      : ZERO_HASH;
  const childGenerationHash =
    generationPath && fs.existsSync(generationPath)
      ? sha256File(generationPath)
      : ZERO_HASH;
  const goalContractHash = fs.existsSync(goalPath)
    ? sha256File(goalPath)
    : ZERO_HASH;

  let expectedGlobalCoverage = null;
  let expectedSelection = null;
  if (authority && currentManifest && partition) {
    try {
      expectedGlobalCoverage = buildGlobalPartitionCoverageReceipt({
        executionProjection: authority.projection,
        candidateManifest: currentManifest,
      });
      expectedSelection = selectPartitionScope({
        executionProjection: authority.projection,
        partitionManifest: currentManifest,
        partitionId: partition.partitionId,
      }).selectionReceipt;
    } catch {
      blockingReasons.push('partition_selection_recompute_failed');
    }
  }
  if (
    !globalCoverage ||
    !expectedGlobalCoverage ||
    stableStringify(globalCoverage) !==
      stableStringify(expectedGlobalCoverage) ||
    globalCoverage.decision !== 'pass' ||
    globalCoverageHash !== binding.globalCoverageReceiptHash
  ) {
    blockingReasons.push('partition_global_coverage_not_current');
    componentDecisions.globalCoverage = 'blocked';
  }
  if (selection) {
    if (selection.partitionId !== binding.partitionId) {
      blockingReasons.push('partition_selection_partition_mismatch');
    }
    if (
      !expectedSelection ||
      stableStringify(selection) !== stableStringify(expectedSelection) ||
      selectionHash !== binding.selectionReceiptHash
    ) {
      blockingReasons.push('partition_selection_not_current');
    }
  }
  if (
    !selection ||
    blockingReasons.some((reason) => reason.includes('selection'))
  ) componentDecisions.selection = 'blocked';

  if (childCoverage && expectedSelection) {
    if (childCoverage.partitionId !== binding.partitionId) {
      blockingReasons.push('partition_child_coverage_partition_mismatch');
    }
    if (
      childCoverage.partitionManifestHash !== currentManifestHash ||
      childCoverage.selectionReceiptHash !== selectionHash ||
      childCoverage.globalCoverageReceiptHash !== globalCoverageHash ||
      childCoverage.decision !== 'pass' ||
      stableStringify(childCoverage.selectedPrimaryObligationIds) !==
        stableStringify(
          expectedSelection.selectedPrimarySourceObligationIds
        ) ||
      stableStringify(childCoverage.inheritedConstraintIds) !==
        stableStringify(expectedSelection.inheritedConstraintIds) ||
      stableStringify(childCoverage.excludedObligationIds) !==
        stableStringify(expectedCoverageExclusions(expectedSelection))
    ) {
      blockingReasons.push('partition_child_coverage_not_current');
    }
  }
  if (
    !childCoverage ||
    blockingReasons.some((reason) => reason.includes('child_coverage'))
  ) componentDecisions.childCoverage = 'blocked';

  if (childGeneration && partition) {
    const expectedGenerationFields = {
      masterSourceHash: currentMasterSourceHash,
      sourceSnapshotHash: currentSourceSnapshotHash,
      methodologyProfileHash: currentMethodologyHash,
      methodologyProfileArtifactHash: currentMethodologyArtifactHash,
      executionProjectionHash: currentProjectionHash,
      taskDagHash: currentManifest.taskDagHash,
      partitionPolicyHash: currentPolicyHash,
      partitionPolicyArtifactHash: currentPolicyArtifactHash,
      partitionManifestHash: currentManifestHash,
      partitionAnalysisReceiptHash: currentAnalysisHash,
      partitionSetHash: currentManifest.partitionSetHash,
      partitionId: partition.partitionId,
      partitionRole: partition.partitionRole,
      selectionReceiptHash: selectionHash,
      selectionSetHash: partition.selectionSetHash,
      globalCoverageReceiptHash: globalCoverageHash,
      goalContractHash,
      coverageReceiptHash: childCoverageHash,
    };
    for (const [field, expected] of Object.entries(
      expectedGenerationFields
    )) {
      if (childGeneration[field] !== expected) {
        blockingReasons.push(
          field === 'partitionId'
            ? 'partition_child_generation_partition_mismatch'
            : 'partition_child_generation_not_current'
        );
      }
    }
    if (
      childGeneration.decision !== 'pass' ||
      childGeneration.selectedAtomicTaskCount !==
        partition.primaryTaskIds.length ||
      childGeneration.inheritedConstraintCount !==
        partition.inheritedConstraintIds.length
    ) {
      blockingReasons.push('partition_child_generation_not_current');
    }
  }
  if (
    !childGeneration ||
    blockingReasons.some((reason) =>
      reason.includes('child_generation')
    )
  ) componentDecisions.childGeneration = 'blocked';
  if (
    childGeneration &&
    childGeneration.goalContractHash !== goalContractHash
  ) {
    blockingReasons.push('partition_child_goal_hash_mismatch');
  }
  if (expectedSelection) {
    currentChildRecords(goalText, expectedSelection, blockingReasons);
  }
  const sequenceRelease = evaluatePartitionSequenceRelease({
    binding,
    childGeneration,
    currentManifest,
    projectionBinding:
      authority?.projection?.sequenceConstraintBinding || {},
  });
  blockingReasons.push(...sequenceRelease.blockingReasons);
  componentDecisions.sequence = sequenceRelease.componentDecision;

  let dependencyHashes = {
    predecessorCompletionReceiptHashes: [],
    compatibilityReceiptHashes: [],
  };
  if (
    partition &&
    ((partition.dependencyPartitionIds || []).length > 0 ||
      (partition.compatibilityReceiptRequirements || []).length > 0)
  ) {
    componentDecisions.dependencies = 'pass';
    componentDecisions.compatibility = 'pass';
    dependencyHashes = validateCompatibilityRequirements({
      partition,
      manifest: {
        ...currentManifest,
        partitionManifestHash: currentManifestHash,
        activeManifestPath: manifestPath,
      },
      receiptsDir,
      predecessorCompletionPaths: input.predecessorCompletionPaths,
      blockingReasons,
    });
    if (
      blockingReasons.some((reason) =>
        reason.includes('predecessor')
      )
    ) componentDecisions.dependencies = 'blocked';
    if (
      blockingReasons.some((reason) =>
        reason.includes('compatibility')
      )
    ) componentDecisions.compatibility = 'blocked';
  }

  const canonicalBlockingReasons = unique(blockingReasons);
  const decision =
    canonicalBlockingReasons.length === 0 ? 'pass' : 'blocked';
  const releaseReceiptPath =
    resolveBoundPath(input.releaseReceipt) ||
    path.join(
      path.dirname(goalPath),
      `.${path.basename(goalPath, path.extname(goalPath))}.release.json`
    );
  const written = writeValidatedPartitionReceipt({
    schemaId: 'goal-contract-partition-release-gate-receipt/v1',
    targetPath: releaseReceiptPath,
    payload: {
      schemaVersion: 'goal-contract-partition-release-gate-receipt/v1',
      partitionId:
        typeof binding.partitionId === 'string'
          ? binding.partitionId
          : `partition-${'0'.repeat(64)}`,
      masterSourceHash: currentMasterSourceHash,
      sourceSnapshotHash: currentSourceSnapshotHash,
      methodologyProfileHash: currentMethodologyHash,
      methodologyProfileArtifactHash:
        currentMethodologyArtifactHash,
      executionProjectionHash: currentProjectionHash,
      partitionAnalysisReceiptHash: currentAnalysisHash,
      partitionManifestHash: activeManifestHash,
      globalCoverageReceiptHash: globalCoverageHash,
      selectionReceiptHash: selectionHash,
      childCoverageReceiptHash: childCoverageHash,
      childGenerationReceiptHash: childGenerationHash,
      goalContractHash,
      sequenceMode: sequenceRelease.sequenceMode,
      sequenceApplicability:
        sequenceRelease.sequenceApplicability,
      sequenceCoverage: sequenceRelease.sequenceCoverage,
      sequenceClosureStatus:
        sequenceRelease.sequenceClosureStatus,
      childContractAuthority:
        sequenceRelease.childContractAuthority,
      predecessorCompletionReceiptHashes:
        dependencyHashes.predecessorCompletionReceiptHashes,
      compatibilityReceiptHashes:
        dependencyHashes.compatibilityReceiptHashes,
      componentDecisions,
      completedAt: new Date().toISOString(),
      decision,
      blockingReasons: canonicalBlockingReasons,
    },
  });
  return {
    ok: decision === 'pass',
    ...written.payload,
    releaseReceiptPath: written.path,
    releaseReceiptHash: written.receiptHash,
  };
}

function evaluateGoalContractRelease(input) {
  const binding =
    input.binding || parseGoalContractBinding(input.goal);
  if (binding.mode === 'whole_source') {
    return checkGoalContractReleaseGate(input);
  }
  return evaluatePartitionRelease({ ...input, binding });
}

function goalContractReleaseGateCommand(
  _opts: { json?: boolean } = {},
  forwardedArgs: string[] = [],
  context: { partitionAuthority?: any } = {}
) {
  const args = [...forwardedArgs];
  const goal = take(args, '--goal');
  const binding = parseGoalContractBinding(goal);
  const result = evaluateGoalContractRelease({
    source: take(args, '--source'),
    goal,
    coverage: take(args, '--coverage'),
    generation: take(args, '--generation'),
    partitionManifest: take(args, '--partition-manifest'),
    partitionId: take(args, '--partition-id'),
    receiptsDir: take(args, '--receipts-dir'),
    releaseReceipt: take(args, '--release-receipt'),
    predecessorCompletionPaths: args
      .map((value, index) =>
        value === '--predecessor-completion' ? args[index + 1] : null
      )
      .filter(Boolean),
    binding,
    partitionAuthority: context.partitionAuthority || null,
  });
  const json = has(args, '--json') || _opts.json;
  const output = json
    ? JSON.stringify(result, null, 2)
    : `${result.decision.toUpperCase()}: ${result.blockingReasons.join(', ') || 'goal contract coverage proof current'}`;
  process.stdout.write(`${output}\n`);
  return result.ok ? 0 : 1;
}

module.exports = {
  checkGoalContractReleaseGate,
  evaluateGoalContractRelease,
  evaluatePartitionSequenceRelease,
  goalContractReleaseGateCommand,
  parseGoalContractBinding,
};
