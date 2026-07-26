const { createHash } = require('node:crypto');

export type GoalContractPartitionSelectorModule = never;

function failure(failureClass, details = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...details });
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function difference(expected, actual) {
  const actualSet = new Set(actual);
  return unique(expected.filter((item) => !actualSet.has(item)));
}

function duplicateValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

function manifestHash(manifest) {
  return sha256Text(`${stableStringify(manifest)}\n`);
}

function allSourceIds(executionProjection) {
  return unique([
    ...(executionProjection.traceSlices || []).flatMap(
      (slice) => slice.sourceIds || []
    ),
    ...(executionProjection.atomicTasks || []).flatMap(
      (task) => task.sourceIds || []
    ),
    ...(executionProjection.completionPredicates || []).flatMap(
      (predicate) => predicate.sourceIds || []
    ),
  ]);
}

function ownershipInventory(partitions, field) {
  const values = partitions.flatMap((partition) => partition[field] || []);
  return {
    values,
    uniqueValues: unique(values),
    duplicates: duplicateValues(values),
  };
}

function dependencyFindings(manifest, executionProjection) {
  const reasons = [];
  const unresolvedDependencies = [];
  const partitions: any[] = manifest.partitions || [];
  const partitionById = new Map<string, any>(
    partitions.map((partition) => [partition.partitionId, partition])
  );
  const order = manifest.topologicalOrder || [];
  const index = new Map(order.map((partitionId, position) => [partitionId, position]));
  if (
    partitionById.size !== partitions.length ||
    order.length !== partitions.length ||
    new Set(order).size !== order.length ||
    order.some((partitionId) => !partitionById.has(partitionId))
  ) {
    reasons.push('partition_topological_order_invalid');
  }
  for (const partition of partitions) {
    for (const predecessorId of partition.dependencyPartitionIds || []) {
      if (!partitionById.has(predecessorId)) {
        reasons.push('partition_dependency_unknown');
        unresolvedDependencies.push(
          `${partition.partitionId}->${predecessorId}`
        );
      } else if (
        (index.get(predecessorId) ?? Number.MAX_SAFE_INTEGER) >=
        (index.get(partition.partitionId) ?? -1)
      ) {
        reasons.push('partition_dependency_future');
      }
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(partitionId) {
    if (visiting.has(partitionId)) {
      reasons.push('partition_dependency_cycle');
      return;
    }
    if (visited.has(partitionId) || !partitionById.has(partitionId)) return;
    visiting.add(partitionId);
    for (const predecessorId of
      partitionById.get(partitionId).dependencyPartitionIds || []) {
      visit(predecessorId);
    }
    visiting.delete(partitionId);
    visited.add(partitionId);
  }
  for (const partitionId of partitionById.keys()) visit(partitionId);

  const partitionByTask = new Map<string, string[]>();
  for (const partition of partitions) {
    for (const taskId of partition.primaryTaskIds || []) {
      if (!partitionByTask.has(taskId)) partitionByTask.set(taskId, []);
      partitionByTask.get(taskId).push(partition.partitionId);
    }
  }
  for (const task of executionProjection.atomicTasks || []) {
    const owners = partitionByTask.get(task.taskId) || [];
    if (owners.length !== 1) continue;
    const dependentPartition = partitionById.get(owners[0]);
    for (const dependencyTaskId of task.dependencyIds || []) {
      const dependencyOwners = partitionByTask.get(dependencyTaskId) || [];
      if (
        dependencyOwners.length === 1 &&
        dependencyOwners[0] !== dependentPartition.partitionId &&
        !(dependentPartition.dependencyPartitionIds || []).includes(
          dependencyOwners[0]
        )
      ) {
        reasons.push('task_dependency_partition_missing');
        unresolvedDependencies.push(
          `${task.taskId}->${dependencyTaskId}`
        );
      }
    }
  }
  return {
    blockingReasons: unique(reasons),
    unresolvedDependencies: unique(unresolvedDependencies),
    partitionById,
    index,
  };
}

function sharedArtifactFindings(manifest, dependencyState) {
  const reasons = [];
  const unownedSharedArtifacts = [];
  const owners = new Map();
  for (const partition of manifest.partitions || []) {
    for (const artifactPath of partition.ownedArtifactPaths || []) {
      if (!owners.has(artifactPath)) owners.set(artifactPath, []);
      owners.get(artifactPath).push(partition.partitionId);
    }
  }
  for (const [artifactPath, partitionIds] of owners.entries()) {
    if (partitionIds.length > 1) reasons.push('shared_artifact_duplicate_owner');
  }
  for (const partition of manifest.partitions || []) {
    for (const dependency of partition.sharedArtifactDependencies || []) {
      const artifactOwners = owners.get(dependency.path) || [];
      if (artifactOwners.length !== 1) {
        reasons.push('shared_artifact_owner_missing');
        unownedSharedArtifacts.push(dependency.path);
        continue;
      }
      const ownerId = artifactOwners[0];
      if (
        !(dependency.dependencyPartitionIds || []).includes(ownerId) ||
        !(partition.dependencyPartitionIds || []).includes(ownerId) ||
        (dependencyState.index.get(ownerId) ?? Number.MAX_SAFE_INTEGER) >=
          (dependencyState.index.get(partition.partitionId) ?? -1)
      ) {
        reasons.push('shared_artifact_dependency_invalid');
      }
    }
  }
  return {
    blockingReasons: unique(reasons),
    unownedSharedArtifacts: unique(unownedSharedArtifacts),
  };
}

function finalIntegrationFindings(manifest, executionProjection) {
  if ((executionProjection.integrationJoinGraph?.joins || []).length === 0) {
    return { blockingReasons: [], partitionIds: [] };
  }
  const partitions = (manifest.partitions || []).filter(
    (partition) => partition.partitionRole === 'final_integration'
  );
  const reasons = [];
  if (partitions.length === 0) {
    reasons.push('final_integration_partition_missing');
  } else if (partitions.length > 1) {
    reasons.push('final_integration_partition_duplicate');
  } else {
    const ownerTasks = unique(
      executionProjection.integrationJoinGraph.joins.map(
        (join) => join.ownerTaskId
      )
    );
    if (
      ownerTasks.some(
        (taskId) => !(partitions[0].primaryTaskIds || []).includes(taskId)
      )
    ) {
      reasons.push('final_integration_ownership_mismatch');
    }
  }
  return {
    blockingReasons: reasons,
    partitionIds: partitions.map((partition) => partition.partitionId).sort(),
  };
}

function buildGlobalPartitionCoverageReceipt({
  executionProjection,
  candidateManifest,
}) {
  const partitions = candidateManifest.partitions || [];
  const expectedSources = allSourceIds(executionProjection);
  const expectedSlices = unique(
    (executionProjection.traceSlices || []).map((slice) => slice.sliceId)
  );
  const expectedTasks = unique(
    (executionProjection.atomicTasks || []).map((task) => task.taskId)
  );
  const sourceOwnership = ownershipInventory(
    partitions,
    'primarySourceObligationIds'
  );
  const sliceOwnership = ownershipInventory(
    partitions,
    'primaryTraceSliceIds'
  );
  const taskOwnership = ownershipInventory(partitions, 'primaryTaskIds');
  const unmappedSourceObligations = difference(
    expectedSources,
    sourceOwnership.uniqueValues
  );
  const unmappedTraceSlices = difference(
    expectedSlices,
    sliceOwnership.uniqueValues
  );
  const unmappedAtomicTasks = difference(
    expectedTasks,
    taskOwnership.uniqueValues
  );
  const blockingReasons = [];
  if (unmappedSourceObligations.length) {
    blockingReasons.push('unmapped_source_obligation');
  }
  if (sourceOwnership.duplicates.length) {
    blockingReasons.push('duplicate_primary_source_obligation');
  }
  if (unmappedTraceSlices.length) {
    blockingReasons.push('unmapped_trace_slice');
  }
  if (sliceOwnership.duplicates.length) {
    blockingReasons.push('duplicate_primary_trace_slice');
  }
  if (unmappedAtomicTasks.length) {
    blockingReasons.push('unmapped_atomic_task');
  }
  if (taskOwnership.duplicates.length) {
    blockingReasons.push('duplicate_primary_atomic_task');
  }
  if (difference(sourceOwnership.uniqueValues, expectedSources).length) {
    blockingReasons.push('unknown_primary_source_obligation');
  }
  if (difference(sliceOwnership.uniqueValues, expectedSlices).length) {
    blockingReasons.push('unknown_primary_trace_slice');
  }
  if (difference(taskOwnership.uniqueValues, expectedTasks).length) {
    blockingReasons.push('unknown_primary_atomic_task');
  }
  const dependency = dependencyFindings(
    candidateManifest,
    executionProjection
  );
  const shared = sharedArtifactFindings(candidateManifest, dependency);
  const integration = finalIntegrationFindings(
    candidateManifest,
    executionProjection
  );
  blockingReasons.push(
    ...dependency.blockingReasons,
    ...shared.blockingReasons,
    ...integration.blockingReasons
  );
  const reasons = unique(blockingReasons);
  return Object.freeze({
    schemaVersion:
      'goal-contract-partition-global-coverage-receipt/v1',
    masterSourceHash: candidateManifest.masterSourceHash,
    sourceSnapshotHash: candidateManifest.sourceSnapshotHash,
    methodologyProfileHash: candidateManifest.methodologyProfileHash,
    executionProjectionHash: candidateManifest.executionProjectionHash,
    partitionManifestHash: manifestHash(candidateManifest),
    partitionIds: unique(candidateManifest.topologicalOrder || []),
    unmappedSourceObligations,
    duplicatePrimarySourceObligations: sourceOwnership.duplicates,
    unmappedTraceSlices,
    duplicatePrimaryTraceSlices: sliceOwnership.duplicates,
    unmappedAtomicTasks,
    duplicatePrimaryAtomicTasks: taskOwnership.duplicates,
    unresolvedDependencies: dependency.unresolvedDependencies,
    unownedSharedArtifacts: shared.unownedSharedArtifacts,
    finalIntegrationPartitionIds: integration.partitionIds,
    decision: reasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons: reasons,
  });
}

function selectRecords(records, field, ids, failureClass) {
  const byId = new Map((records || []).map((record) => [record[field], record]));
  return (ids || []).map((id) => {
    const record = byId.get(id);
    if (!record) throw failure(failureClass, { id });
    return structuredClone(record);
  });
}

function expectedSelectionSetHash(partition) {
  const {
    displayOrdinal: _displayOrdinal,
    displayTitle: _displayTitle,
    selectionSetHash: _selectionSetHash,
    selectionReceiptPath: _selectionReceiptPath,
    ...semantic
  } = partition;
  return sha256Text(stableStringify(semantic));
}

function selectPartitionScope({
  executionProjection,
  partitionManifest,
  partitionId,
}) {
  const partition = (partitionManifest.partitions || []).find(
    (item) => item.partitionId === partitionId
  );
  if (!partition) throw failure('partition_id_unknown', { partitionId });
  const expectedSetHash = expectedSelectionSetHash(partition);
  if (partition.selectionSetHash !== expectedSetHash) {
    throw failure('partition_selection_set_hash_mismatch', {
      partitionId,
      expectedSelectionSetHash: expectedSetHash,
      actualSelectionSetHash: partition.selectionSetHash,
    });
  }
  const primaryAtomicTasks = selectRecords(
    executionProjection.atomicTasks,
    'taskId',
    partition.primaryTaskIds,
    'partition_selection_task_unknown'
  );
  const primaryTraceSlices = selectRecords(
    executionProjection.traceSlices,
    'sliceId',
    partition.primaryTraceSliceIds,
    'partition_selection_trace_slice_unknown'
  );
  const completionPredicates = selectRecords(
    executionProjection.completionPredicates,
    'predicateId',
    partition.completionPredicateIds || partition.acceptanceIds,
    'partition_selection_acceptance_unknown'
  );
  const evidenceContracts = selectRecords(
    executionProjection.evidenceContracts,
    'evidenceContractId',
    partition.evidenceContractIds,
    'partition_selection_evidence_unknown'
  );
  const inheritedConstraints = selectRecords(
    executionProjection.sequenceConstraintBinding?.constraints || [],
    'constraintId',
    partition.inheritedConstraintIds,
    'partition_selection_constraint_unknown'
  ).map((constraint) => Object.freeze({ ...constraint, executable: false }));
  const allPartitionCommandIds = unique(
    (partitionManifest.partitions || []).flatMap(
      (item) => item.commandIds || []
    )
  );
  const excludedSourceObligationIds = difference(
    allSourceIds(executionProjection),
    partition.primarySourceObligationIds
  );
  const excludedTraceSliceIds = difference(
    (executionProjection.traceSlices || []).map((slice) => slice.sliceId),
    partition.primaryTraceSliceIds
  );
  const excludedAtomicTaskIds = difference(
    (executionProjection.atomicTasks || []).map((task) => task.taskId),
    partition.primaryTaskIds
  );
  const excludedAcceptanceIds = difference(
    (executionProjection.completionPredicates || []).map(
      (predicate) => predicate.predicateId
    ),
    partition.acceptanceIds
  );
  const excludedCommandIds = difference(
    allPartitionCommandIds,
    partition.commandIds
  );
  const excludedEvidenceContractIds = difference(
    (executionProjection.evidenceContracts || []).map(
      (evidence) => evidence.evidenceContractId
    ),
    partition.evidenceContractIds
  );
  const selectionReceipt = Object.freeze({
    schemaVersion: 'goal-contract-partition-selection-receipt/v1',
    masterSourceHash: partitionManifest.masterSourceHash,
    sourceSnapshotHash: partitionManifest.sourceSnapshotHash,
    methodologyProfileHash: partitionManifest.methodologyProfileHash,
    executionProjectionHash: partitionManifest.executionProjectionHash,
    partitionPolicyHash: partitionManifest.partitionPolicyHash,
    partitionManifestHash: manifestHash(partitionManifest),
    partitionSetHash: partitionManifest.partitionSetHash,
    partitionId,
    partitionRole: partition.partitionRole,
    selectionSetHash: partition.selectionSetHash,
    selectedPrimarySourceObligationIds: unique(
      partition.primarySourceObligationIds
    ),
    selectedPrimaryTraceSliceIds: unique(partition.primaryTraceSliceIds),
    selectedPrimaryAtomicTaskIds: unique(partition.primaryTaskIds),
    selectedAcceptanceIds: unique(partition.acceptanceIds),
    selectedCommandIds: unique(partition.commandIds),
    selectedEvidenceContractIds: unique(partition.evidenceContractIds),
    inheritedConstraintIds: unique(partition.inheritedConstraintIds),
    excludedSourceObligationIds,
    excludedTraceSliceIds,
    excludedAtomicTaskIds,
    excludedAcceptanceIds,
    excludedCommandIds,
    excludedEvidenceContractIds,
    dependencyPartitionIds: unique(partition.dependencyPartitionIds),
    decision: 'pass',
    blockingReasons: [],
  });
  return Object.freeze({
    partition: structuredClone(partition),
    primaryAtomicTasks,
    primaryTraceSlices,
    completionPredicates,
    evidenceContracts,
    commands: unique(partition.commandIds).map((commandId) => ({
      commandId,
    })),
    inheritedConstraints,
    excludedSourceObligationIds,
    excludedTraceSliceIds,
    excludedAtomicTaskIds,
    excludedAcceptanceIds,
    excludedCommandIds,
    excludedEvidenceContractIds,
    excluded: Object.freeze({
      sourceObligationIds: excludedSourceObligationIds,
      traceSliceIds: excludedTraceSliceIds,
      atomicTaskIds: excludedAtomicTaskIds,
      acceptanceIds: excludedAcceptanceIds,
      commandIds: excludedCommandIds,
      evidenceContractIds: excludedEvidenceContractIds,
    }),
    selectionReceipt,
  });
}

module.exports = {
  buildGlobalPartitionCoverageReceipt,
  selectPartitionScope,
};
