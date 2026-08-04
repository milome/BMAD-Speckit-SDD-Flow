const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020');
const {
  assertCanonicalExecutionProjection,
  canonicalizeCandidateForSelection,
  compareCandidates,
  derivePartitionId,
  optimizePartitions,
  validatePartitionCandidate,
} = require(
  __filename.endsWith('.ts') ? './partition-optimizer.ts' : './partition-optimizer'
);
const { deriveEffectiveComponentDependencies } = require(
  __filename.endsWith('.ts')
    ? './partition-components.ts'
    : './partition-components'
);
const { hashSourceObligationGraph } = require(
  __filename.endsWith('.ts')
    ? './source-obligation-extractor.ts'
    : './source-obligation-extractor'
);
const { hashControlPlaneValue } = require(
  __filename.endsWith('.ts')
    ? './control-plane/canonical-hash.ts'
    : './control-plane/canonical-hash'
);
const { stableStringify: stableReceiptStringify } = require(
  __filename.endsWith('.ts')
    ? '../large-document-writer/receipts.ts'
    : '../large-document-writer/receipts'
);

export type GoalContractPartitionManifestModule = never;

type PartitionSemanticOverrides = {
  acceptanceIds?: unknown[];
  blockedConditions?: unknown[];
  commandIds?: unknown[];
  compatibilityReceiptRequirements?: unknown[];
  completionPredicateIds?: unknown[];
  evidenceContractIds?: unknown[];
  failureClasses?: unknown[];
  governedPaths?: unknown[];
  inheritedConstraintIds?: unknown[];
  outcome?: string;
  ownedArtifactPaths?: unknown[];
  primaryEpicIds?: unknown[];
  primarySourceObligationIds?: unknown[];
  sharedArtifactDependencies?: unknown[];
};

type PartitionManifestCandidate = {
  dependencyPartitionIds: string[];
  partitionId: string;
  partitionRole: string;
  primaryTaskIds: string[];
  primaryTraceSliceIds: string[];
};

function resolveAssetRoot({
  filename = __filename,
  dirname = __dirname,
} = {}) {
  return filename.endsWith('.ts')
    ? path.resolve(dirname, '..', '..', '..', '..', '..')
    : path.resolve(dirname, '..', '..', '..');
}

const ASSET_ROOT = resolveAssetRoot();
const SCHEMA_ROOT = path.join(ASSET_ROOT, '_bmad', 'shared', 'goal-contract');
const validators = new Map();

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
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

function unique(values) {
  return [...new Set(values || [])].sort();
}

function canonicalText(value) {
  return `${stableStringify(value)}\n`;
}

function schemaValidator(name) {
  if (!validators.has(name)) {
    const schema = JSON.parse(
      fs.readFileSync(path.join(SCHEMA_ROOT, name), 'utf8')
    );
    validators.set(
      name,
      new Ajv2020({ allErrors: true, strict: false }).compile(schema)
    );
  }
  return validators.get(name);
}

function validateSchema(name, value, failureClass) {
  const validate = schemaValidator(name);
  if (!validate(value)) {
    throw failure(failureClass, {
      validationErrors: validate.errors || [],
    });
  }
}

function buildFinalPartitionRunReceiptPaths({
  partitionRunId,
  partitionIds,
}) {
  const root = `partition-runs/${partitionRunId}`;
  return Object.freeze({
    partitionAnalysisReceiptPath: `${root}/partition-analysis.receipt.json`,
    partitionManifestPath: `${root}/partition-manifest.json`,
    globalCoverageReceiptPath: `${root}/global-coverage.receipt.json`,
    selectionReceiptPaths: Object.freeze(
      Object.fromEntries(
        partitionIds.map((partitionId) => [
          partitionId,
          `${root}/partitions/${partitionId}/selection.receipt.json`,
        ])
      )
    ),
  });
}

function intersects(values, selected) {
  return (values || []).some((value) => selected.has(value));
}

function validateExactCoverage({ actualIds, expectedIds, reason }) {
  const actual = unique(actualIds);
  const expected = unique(expectedIds);
  if (
    actual.length !== actualIds.length ||
    expected.length !== expectedIds.length ||
    stableStringify(actual) !== stableStringify(expected)
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason,
      expectedIds: expected,
      actualIds: actual,
    });
  }
}

function assertManifestInputAuthorityBindings(input) {
  const projection = input.executionProjection || {};
  const requiresProjectionAuthority = Object.hasOwn(
    projection,
    'traceGraphHash'
  );
  if (requiresProjectionAuthority && !input.projectionAuthority) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'execution_projection_authority_missing',
    });
  }
  if (input.projectionAuthority) {
    try {
      assertCanonicalExecutionProjection({
        executionProjection: projection,
        projectionAuthority: input.projectionAuthority,
      });
    } catch (error) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'execution_projection_currentness_mismatch',
        causeFailureClass: error.failureClass,
      });
    }
  }
  const actualSourceObligationGraphHash = hashSourceObligationGraph(
    input.sourceObligationGraph
  );
  const actualReconciledGraphHash = sha256Text(
    stableStringify(input.reconciledGraph)
  );
  const mismatchedFields = [];
  for (const [field, expected, actual] of [
    [
      'sourceSnapshotHash',
      input.sourceSnapshot?.aggregateHash,
      projection.sourceSnapshotHash,
    ],
    [
      'sourceObligationGraphHash',
      input.sourceObligationGraphHash,
      projection.sourceObligationGraphHash,
    ],
    [
      'methodologyProfileHash',
      input.methodologyProfileHash,
      projection.methodologyProfileHash,
    ],
    [
      'reconciledGraphHash',
      input.reconciledGraphHash,
      projection.reconciledGraphHash,
    ],
    [
      'sourceObligationGraphPayloadHash',
      input.sourceObligationGraphHash,
      actualSourceObligationGraphHash,
    ],
    [
      'reconciledGraphPayloadHash',
      input.reconciledGraphHash,
      actualReconciledGraphHash,
    ],
  ]) {
    if (expected !== actual) mismatchedFields.push(field);
  }
  if (mismatchedFields.length > 0) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'manifest_input_authority_mismatch',
      mismatchedFields,
    });
  }
}

function validateOptimizationDependencies(input) {
  const partitions = input.optimization.partitions || [];
  const topologicalOrder = input.optimization.topologicalOrder || [];
  if (input.optimization.partitionCount !== partitions.length) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'optimizer_partition_count_mismatch',
      expectedPartitionCount: partitions.length,
      actualPartitionCount: input.optimization.partitionCount,
    });
  }
  const partitionById = new Map(
    partitions.map((partition) => [partition.partitionId, partition])
  );
  if (
    partitionById.size !== partitions.length ||
    topologicalOrder.length !== partitions.length ||
    new Set(topologicalOrder).size !== partitions.length ||
    topologicalOrder.some((partitionId) => !partitionById.has(partitionId))
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'optimizer_topological_order_mismatch',
    });
  }
  const partitionIndex = new Map<string, number>(
    topologicalOrder.map(
      (partitionId, index) => [partitionId, index] as [string, number]
    )
  );
  const partitionByComponent = new Map<string, string>();
  for (const partition of partitions) {
    for (const componentId of partition.primaryComponentIds || []) {
      if (partitionByComponent.has(componentId)) {
        throw failure('partition_manifest_currentness_mismatch', {
          reason: 'duplicate_component_partition_owner',
          componentId,
        });
      }
      partitionByComponent.set(componentId, partition.partitionId);
    }
  }
  validateExactCoverage({
    expectedIds: (input.componentGraph.components || []).map(
      (component) => component.componentId
    ),
    actualIds: partitions.flatMap(
      (partition) => partition.primaryComponentIds || []
    ),
    reason: 'component_partition_coverage_mismatch',
  });
  validateExactCoverage({
    expectedIds: (input.executionProjection.traceSlices || []).map(
      (slice) => slice.sliceId
    ),
    actualIds: partitions.flatMap(
      (partition) => partition.primaryTraceSliceIds || []
    ),
    reason: 'trace_slice_partition_coverage_mismatch',
  });
  validateExactCoverage({
    expectedIds: (input.executionProjection.atomicTasks || []).map(
      (task) => task.taskId
    ),
    actualIds: partitions.flatMap((partition) => partition.primaryTaskIds || []),
    reason: 'atomic_task_partition_coverage_mismatch',
  });

  let effectiveDependencies;
  try {
    effectiveDependencies = deriveEffectiveComponentDependencies(
      input.componentGraph
    );
  } catch (error) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: error.reason || error.failureClass,
      causeFailureClass: error.failureClass,
    });
  }
  const expectedByPartition = new Map<string, Set<string>>(
    partitions.map(
      (partition) =>
        [partition.partitionId, new Set<string>()] as [string, Set<string>]
    )
  );
  for (const edge of effectiveDependencies) {
    const predecessorPartitionId = partitionByComponent.get(edge.fromComponentId);
    const dependentPartitionId = partitionByComponent.get(edge.toComponentId);
    if (!predecessorPartitionId || !dependentPartitionId) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'component_partition_missing',
        fromComponentId: edge.fromComponentId,
        toComponentId: edge.toComponentId,
      });
    }
    if (predecessorPartitionId === dependentPartitionId) continue;
    if (
      partitionIndex.get(predecessorPartitionId) >=
      partitionIndex.get(dependentPartitionId)
    ) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: edge.authorityCodes.includes('shared_artifact_owner')
          ? 'shared_artifact_owner_after_consumer'
          : 'partition_future_dependency',
        predecessorPartitionId,
        dependentPartitionId,
      });
    }
    expectedByPartition
      .get(dependentPartitionId)
      .add(predecessorPartitionId);
  }
  for (const partition of partitions) {
    const expected = unique([...expectedByPartition.get(partition.partitionId)]);
    const actual = unique(partition.dependencyPartitionIds || []);
    if (stableStringify(actual) !== stableStringify(expected)) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'partition_dependency_set_mismatch',
        partitionId: partition.partitionId,
        expectedDependencyPartitionIds: expected,
        actualDependencyPartitionIds: actual,
      });
    }
  }
  return Object.freeze({
    effectiveDependencies,
    partitionByComponent,
    partitionIndex,
  });
}

function derivedPartitionFields(
  partition,
  input,
  receiptPaths,
  dependencyState
) {
  const taskIds = new Set(partition.primaryTaskIds || []);
  const traceSliceIds = new Set(partition.primaryTraceSliceIds || []);
  const componentIds = new Set(partition.primaryComponentIds || []);
  const slices = (input.executionProjection.traceSlices || []).filter(
    (slice) =>
      traceSliceIds.has(slice.sliceId) || intersects(slice.taskIds, taskIds)
  );
  const reconciledSlices = (input.reconciledGraph?.traceSlices || []).filter(
    (slice) =>
      traceSliceIds.has(slice.id || slice.sliceId) ||
      intersects(slice.taskIds || slice.goalIds, taskIds)
  );
  const sourceObligationIds = unique([
    ...slices.flatMap((slice) => slice.sourceIds || []),
    ...(input.executionProjection.atomicTasks || [])
      .filter((task) => taskIds.has(task.taskId))
      .flatMap((task) => task.sourceIds || []),
  ]);
  const sharedOwnership = input.componentGraph?.sharedArtifactOwnership;
  const partitionByComponent = dependencyState.partitionByComponent;
  const ownedArtifactPaths = Array.isArray(sharedOwnership)
    ? unique(
        sharedOwnership
          .filter((ownership) => componentIds.has(ownership.ownerComponentId))
          .map((ownership) => ownership.path)
      )
    : unique(
        (input.executionProjection.fileScopeIndex || [])
          .filter((scope) => intersects(scope.taskIds, taskIds))
          .map((scope) => scope.path)
      );
  const governedPaths = unique(
    (input.executionProjection.fileScopeIndex || [])
      .filter((scope) => intersects(scope.taskIds, taskIds))
      .map((scope) => scope.path)
  );
  const sharedArtifactDependencies = [];
  const compatibilityReceiptRequirements = [];
  for (const ownership of sharedOwnership || []) {
    if (
      !ownership.participatingComponentIds?.some((componentId) =>
        componentIds.has(componentId)
      ) ||
      componentIds.has(ownership.ownerComponentId)
    ) {
      continue;
    }
    const predecessorPartitionId = partitionByComponent.get(
      ownership.ownerComponentId
    );
    if (!predecessorPartitionId) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'shared_artifact_owner_partition_missing',
        path: ownership.path,
      });
    }
    if (
      dependencyState.partitionIndex.get(predecessorPartitionId) >=
      dependencyState.partitionIndex.get(partition.partitionId)
    ) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'shared_artifact_owner_after_consumer',
        path: ownership.path,
        predecessorPartitionId,
        dependentPartitionId: partition.partitionId,
      });
    }
    if (
      !(partition.dependencyPartitionIds || []).includes(
        predecessorPartitionId
      )
    ) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'partition_dependency_set_mismatch',
        path: ownership.path,
        predecessorPartitionId,
        dependentPartitionId: partition.partitionId,
      });
    }
    sharedArtifactDependencies.push({
      path: ownership.path,
      dependencyPartitionIds: [predecessorPartitionId],
    });
    compatibilityReceiptRequirements.push({
      artifactPath: ownership.path,
      predecessorPartitionId,
      receiptPath: `${path.posix.dirname(
        receiptPaths.selectionReceiptPaths[partition.partitionId]
      )}/compatibility/${sha256Text(ownership.path).slice(
        'sha256:'.length,
        'sha256:'.length + 16
      )}.receipt.json`,
    });
  }
  return {
    outcome:
      unique(slices.map((slice) => slice.observableOutcome).filter(Boolean)).join(
        ' | '
      ) || `Complete ${unique(partition.primaryTraceSliceIds).join(', ')}`,
    primaryEpicIds: unique(
      (input.executionProjection.executionEpics || [])
        .filter(
          (epic) =>
            intersects(epic.taskIds, taskIds) ||
            intersects(epic.traceSliceIds, traceSliceIds)
        )
        .map((epic) => epic.epicId)
    ),
    primarySourceObligationIds: sourceObligationIds,
    inheritedConstraintIds: unique(
      slices.flatMap((slice) => slice.sequenceConstraintIds || [])
    ),
    acceptanceIds: unique(
      slices.flatMap((slice) => slice.completionPredicateIds || [])
    ),
    commandIds: unique(
      reconciledSlices.flatMap((slice) => [
        ...(slice.directCommands || []),
        ...(slice.impactedCommands || []),
        ...(slice.integrationCommands || []),
        ...(slice.regressionCommands || []),
      ])
    ),
    evidenceContractIds: unique(
      slices.flatMap((slice) => slice.evidenceContractIds || [])
    ),
    completionPredicateIds: unique(
      slices.flatMap((slice) => slice.completionPredicateIds || [])
    ),
    ownedArtifactPaths,
    governedPaths,
    sharedArtifactDependencies,
    compatibilityReceiptRequirements,
    blockedConditions: [],
    failureClasses: [],
  };
}

function partitionSemanticRecord(
  partition,
  derived: PartitionSemanticOverrides = {}
) {
  return {
    partitionId: partition.partitionId,
    primaryComponentIds: unique(partition.primaryComponentIds),
    primaryTraceSliceIds: unique(partition.primaryTraceSliceIds),
    primaryTaskIds: unique(partition.primaryTaskIds),
    outcome: derived.outcome ?? partition.outcome,
    primaryEpicIds: unique(derived.primaryEpicIds ?? partition.primaryEpicIds),
    primarySourceObligationIds: unique(
      derived.primarySourceObligationIds ??
        partition.primarySourceObligationIds
    ),
    inheritedConstraintIds: unique(
      derived.inheritedConstraintIds ?? partition.inheritedConstraintIds
    ),
    acceptanceIds: unique(derived.acceptanceIds ?? partition.acceptanceIds),
    commandIds: unique(derived.commandIds ?? partition.commandIds),
    evidenceContractIds: unique(
      derived.evidenceContractIds ?? partition.evidenceContractIds
    ),
    completionPredicateIds: unique(
      derived.completionPredicateIds ?? partition.completionPredicateIds
    ),
    dependencyPartitionIds: unique(partition.dependencyPartitionIds),
    partitionRole: partition.partitionRole,
    partitionRoleDerived: partition.partitionRoleDerived === true,
    ownedArtifactPaths: unique(
      derived.ownedArtifactPaths ?? partition.ownedArtifactPaths
    ),
    governedPaths: unique(
      derived.governedPaths ??
        partition.governedPaths ??
        partition.ownedArtifactPaths
    ),
    sharedArtifactDependencies: [
      ...(derived.sharedArtifactDependencies ??
        partition.sharedArtifactDependencies ??
        []),
    ],
    compatibilityReceiptRequirements: [
      ...(derived.compatibilityReceiptRequirements ??
        partition.compatibilityReceiptRequirements ??
        []),
    ],
    blockedConditions: unique(
      derived.blockedConditions ?? partition.blockedConditions
    ),
    failureClasses: unique(
      derived.failureClasses ?? partition.failureClasses
    ),
    estimatedClosureCost: {
      unit: 'minutes',
      total: partition.estimatedClosureMinutes,
      breakdown: {
        declaredTaskMinutes:
          partition.closureMinuteBreakdown.declaredTaskMinutes || 0,
        derivedTaskMinutes:
          partition.closureMinuteBreakdown.derivedTaskMinutes || 0,
        verificationMinutes:
          partition.closureMinuteBreakdown.verificationMinutes || 0,
        coordinationMinutes:
          partition.closureMinuteBreakdown.coordinationMinutes || 0,
        totalMinutes: partition.closureMinuteBreakdown.totalMinutes,
      },
    },
    estimatedClosureMinutes: partition.estimatedClosureMinutes,
    closureMinuteBreakdown: {
      declaredTaskMinutes:
        partition.closureMinuteBreakdown.declaredTaskMinutes || 0,
      derivedTaskMinutes:
        partition.closureMinuteBreakdown.derivedTaskMinutes || 0,
      verificationMinutes:
        partition.closureMinuteBreakdown.verificationMinutes || 0,
      coordinationMinutes:
        partition.closureMinuteBreakdown.coordinationMinutes || 0,
      totalMinutes: partition.closureMinuteBreakdown.totalMinutes,
    },
    primaryWriteScopeOwnerCount: partition.primaryWriteScopeOwnerCount,
  };
}

function selectionSetHash(partition) {
  return sha256Text(stableStringify(partitionSemanticRecord(partition)));
}

function canonicalPartitions({
  input,
  optimization,
  dependencyState,
  receiptPaths,
  displayTitles = {},
}) {
  const byId = new Map<string, PartitionManifestCandidate>(
    optimization.partitions.map(
      (partition) =>
        [partition.partitionId, partition] as [string, PartitionManifestCandidate]
    )
  );
  if (
    optimization.topologicalOrder.length !== byId.size ||
    optimization.topologicalOrder.some((partitionId) => !byId.has(partitionId))
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'optimizer_topological_order_mismatch',
    });
  }
  return optimization.topologicalOrder.map((partitionId, index) => {
    const partition = byId.get(partitionId);
    const expectedPartitionId = derivePartitionId({
      sourceSnapshotHash: input.sourceSnapshot.aggregateHash,
      executionProjectionHash:
        input.executionProjection.executionProjectionHash,
      partitionPolicyHash: input.policyBinding.partitionPolicyHash,
      primaryTraceSliceIds: partition.primaryTraceSliceIds,
      primaryTaskIds: partition.primaryTaskIds,
      dependencyPartitionIds: partition.dependencyPartitionIds,
      partitionRole: partition.partitionRole,
    });
    if (partition.partitionId !== expectedPartitionId) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'partition_id_mismatch',
        partitionId: partition.partitionId,
        expectedPartitionId,
      });
    }
    const semantic = partitionSemanticRecord(
      partition,
      derivedPartitionFields(partition, input, receiptPaths, dependencyState)
    );
    return Object.freeze({
      ...semantic,
      displayOrdinal: index + 1,
      displayTitle:
        displayTitles[partitionId] ||
        `Partition ${index + 1}: ${semantic.partitionRole}`,
      selectionSetHash: sha256Text(stableStringify(semantic)),
      selectionReceiptPath: receiptPaths.selectionReceiptPaths[partitionId],
    });
  });
}

function canonicalPartitionMembership(partitions) {
  return (partitions || [])
    .map((partition) => ({
      ...partition,
      partitionId: partition.partitionId,
      primaryComponentIds: [...(partition.primaryComponentIds || [])].sort(),
      primaryTraceSliceIds: [...(partition.primaryTraceSliceIds || [])].sort(),
      primaryTaskIds: [...(partition.primaryTaskIds || [])].sort(),
      dependencyPartitionIds: [
        ...(partition.dependencyPartitionIds || []),
      ].sort(),
    }))
    .sort((left, right) => left.partitionId.localeCompare(right.partitionId));
}

function selectedCandidate(
  optimization,
  componentGraph,
  executionProjection,
  sourceSnapshotHash,
  policyBinding,
  effectiveDependencies
) {
  const candidates = optimization.candidates || [];
  const rejectedCandidateSummaries =
    optimization.rejectedCandidateSummaries || [];
  const searchReceipt = optimization.searchReceipt;
  if (
    !searchReceipt ||
    searchReceipt.validCandidateCount !== candidates.length ||
    searchReceipt.rejectedCandidateCount !==
      rejectedCandidateSummaries.length ||
    searchReceipt.candidateCount !==
      candidates.length + rejectedCandidateSummaries.length
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'candidate_search_receipt_mismatch',
    });
  }
  if (candidates.some((candidate) => typeof candidate.selected !== 'boolean')) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'candidate_selection_marker_invalid',
    });
  }
  const candidateIds = candidates.map((candidate) => candidate.candidateId);
  const rejectedCandidateIds = rejectedCandidateSummaries.map(
    (candidate) => candidate.candidateId
  );
  if (
    new Set([...candidateIds, ...rejectedCandidateIds]).size !==
    candidateIds.length + rejectedCandidateIds.length
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'candidate_id_duplicate',
    });
  }
  const selectedCandidates = candidates.filter(
    (candidate) => candidate.selected === true
  );
  if (selectedCandidates.length !== 1) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'selected_candidate_cardinality_mismatch',
      selectedCandidateCount: selectedCandidates.length,
    });
  }
  const [selected] = selectedCandidates;
  if (selected.candidateId !== optimization.selectedCandidateId) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'selected_candidate_id_mismatch',
      expectedCandidateId: optimization.selectedCandidateId,
      actualCandidateId: selected.candidateId,
    });
  }
  if (!selected?.score) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'selected_candidate_missing',
    });
  }
  if (
    stableStringify(canonicalPartitionMembership(selected.partitions)) !==
    stableStringify(canonicalPartitionMembership(optimization.partitions))
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'selected_candidate_partition_mismatch',
    });
  }

  const canonicalCandidates = candidates.map((candidate) => {
    let canonical;
    try {
      validatePartitionCandidate({
        candidate,
        componentGraph,
        executionProjection,
        policy: policyBinding.policy,
        sourceSnapshotHash,
        partitionPolicyHash: policyBinding.partitionPolicyHash,
        effectiveDependencies,
      });
      canonical = canonicalizeCandidateForSelection({
        candidate,
        componentGraph,
        policy: policyBinding.policy,
        effectiveDependencies,
      });
    } catch (error) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'candidate_hard_constraint_mismatch',
        candidateId: candidate.candidateId,
        causeFailureClass: error.failureClass,
        causeReason: error.reason || error.failureClass,
      });
    }
    if (stableStringify(candidate.score) !== stableStringify(canonical.score)) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'candidate_score_mismatch',
        candidateId: candidate.candidateId,
        expectedScore: canonical.score,
        actualScore: candidate.score,
      });
    }
    return canonical;
  });
  canonicalCandidates.sort(compareCandidates);
  if (
    canonicalCandidates.length > 1 &&
    compareCandidates(canonicalCandidates[0], canonicalCandidates[1]) === 0
  ) {
    const withoutSelection = (candidate) => {
      const { selected: _selected, ...rest } = candidate;
      return rest;
    };
    if (
      stableStringify(withoutSelection(canonicalCandidates[0])) !==
      stableStringify(withoutSelection(canonicalCandidates[1]))
    ) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'candidate_selection_nondeterministic',
      });
    }
  }
  if (canonicalCandidates[0]?.candidateId !== selected.candidateId) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'selected_candidate_not_optimal',
      expectedCandidateId: canonicalCandidates[0]?.candidateId,
      actualCandidateId: selected.candidateId,
    });
  }
  return selected;
}

function providerReceiptSummary(receipt, viewType) {
  if (!receipt || typeof receipt !== 'object') {
    throw failure('partition_analysis_receipt_schema_invalid', {
      reason: `${viewType}_provider_receipt_missing`,
    });
  }
  return Object.freeze({
    state: 'current',
    authorityReason: 'semantic_provider_receipt',
    viewType,
    receiptHash: sha256Text(stableStringify(receipt)),
  });
}

function deriveCanonicalOptimization(input) {
  try {
    return optimizePartitions({
      componentGraph: input.componentGraph,
      executionProjection: input.executionProjection,
      policyBinding: input.policyBinding,
      projectionAuthority: input.projectionAuthority,
    });
  } catch (error) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'optimization_input_currentness_mismatch',
      causeFailureClass: error.failureClass,
      causeReason: error.reason || error.failureClass,
    });
  }
}

function validateCanonicalOptimizationReceipt(
  input,
  canonicalOptimization = deriveCanonicalOptimization(input)
) {
  if (
    stableStringify(input.optimization) !==
    stableStringify(canonicalOptimization)
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'optimization_receipt_mismatch',
      expectedSelectedCandidateId: canonicalOptimization.selectedCandidateId,
      actualSelectedCandidateId: input.optimization.selectedCandidateId,
    });
  }
  return canonicalOptimization;
}

const SEQUENCE_STATE_FIELDS = Object.freeze([
  'sequenceMode',
  'sequenceApplicability',
  'sequenceCoverage',
  'sequenceClosureStatus',
  'childContractAuthority',
]);

function manifestSequenceState(executionProjection) {
  const binding = executionProjection?.sequenceConstraintBinding || {};
  const applicabilityDecision =
    binding.applicabilityDecision || 'not_applicable_with_proof';
  return Object.freeze({
    sequenceMode: binding.sequenceMode || 'auto',
    sequenceApplicability: applicabilityDecision,
    sequenceCoverage:
      binding.sequenceCoverage ||
      (applicabilityDecision === 'not_applicable_with_proof'
        ? 'not_applicable'
        : 'complete'),
    sequenceClosureStatus:
      binding.sequenceClosureStatus ||
      (binding.sequenceContractHash ? 'compiled' : 'not_required'),
    childContractAuthority: binding.childContractAuthority || 'full',
  });
}

function validateManifestSequenceState(manifest, expectedState = null) {
  if (
    manifest.childContractAuthority === 'full' &&
    ['excluded', 'unresolved'].includes(manifest.sequenceCoverage)
  ) {
    throw failure('partition_manifest_sequence_authority_invalid');
  }
  if (
    manifest.sequenceMode === 'disabled' &&
    manifest.sequenceClosureStatus === 'compiled'
  ) {
    throw failure('partition_manifest_sequence_status_invalid');
  }
  if (
    expectedState &&
    SEQUENCE_STATE_FIELDS.some(
      (field) => manifest[field] !== expectedState[field]
    )
  ) {
    throw failure('partition_manifest_sequence_state_mismatch');
  }
}

function compilePartitionManifest(input) {
  assertManifestInputAuthorityBindings(input);
  const canonicalOptimization = deriveCanonicalOptimization(input);
  const dependencyState = validateOptimizationDependencies(input);
  const sequenceState = manifestSequenceState(input.executionProjection);
  const partitionRunId = `partition-run-${sha256Text(
    stableStringify({
      sourceSnapshotHash: input.sourceSnapshot.aggregateHash,
      executionProjectionHash:
        input.executionProjection.executionProjectionHash,
      partitionPolicyHash: input.policyBinding.partitionPolicyHash,
      optimizerVersion: input.optimization.optimizerVersion,
      selectedCandidateId: input.optimization.selectedCandidateId,
    })
  ).slice('sha256:'.length)}`;
  const receiptPaths = buildFinalPartitionRunReceiptPaths({
    partitionRunId,
    partitionIds: input.optimization.topologicalOrder,
  });
  const partitions = canonicalPartitions({
    input,
    optimization: input.optimization,
    dependencyState,
    receiptPaths,
    displayTitles: input.displayTitles,
  });
  const partitionSetHash = sha256Text(
    stableStringify(
      partitions.map(
        ({
          partitionId,
          selectionSetHash: currentSelectionSetHash,
          dependencyPartitionIds,
        }) => ({
          partitionId,
          selectionSetHash: currentSelectionSetHash,
          dependencyPartitionIds,
        })
      )
    )
  );
  const notApplicable = Object.freeze({
    state: 'not_applicable',
    authorityReason: 'structured_fast_path',
  });
  const selected = selectedCandidate(
    input.optimization,
    input.componentGraph,
    input.executionProjection,
    input.sourceSnapshot.aggregateHash,
    input.policyBinding,
    dependencyState.effectiveDependencies
  );
  validateCanonicalOptimizationReceipt(input, canonicalOptimization);
  const implementationViewReceiptHash =
    input.semanticDerivationMode === 'structured_fast_path'
      ? notApplicable
      : sha256Text(stableStringify(input.implementationViewReceipt));
  const acceptanceEvidenceViewReceiptHash =
    input.semanticDerivationMode === 'structured_fast_path'
      ? notApplicable
      : sha256Text(stableStringify(input.acceptanceEvidenceViewReceipt));
  const analysisReceipt = {
    schemaVersion: 'goal-contract-partition-analysis-receipt/v1',
    runId: partitionRunId,
    partitionRunId,
    masterSourcePath: input.sourceSnapshot.sourcePath,
    masterSourceHash:
      input.sourceSnapshot.exactByteHash || input.sourceSnapshot.aggregateHash,
    masterSourceSemanticHash:
      input.sourceSnapshot.sourcePlanSemanticHash ||
      input.sourceSnapshot.aggregateHash,
    sourceSnapshotHash: input.sourceSnapshot.aggregateHash,
    sourceObligationGraphHash: input.sourceObligationGraphHash,
    methodologyProfileHash: input.methodologyProfileHash,
    semanticDerivationMode: input.semanticDerivationMode,
    implementationViewReceiptHash,
    acceptanceEvidenceViewReceiptHash,
    reconciliationReceiptHash: input.reconciliationReceiptHash,
    reconciledGraphHash: input.reconciledGraphHash,
    semanticModelHash: input.executionProjection.semanticModelHash,
    executionProjectionHash:
      input.executionProjection.executionProjectionHash,
    taskDagHash: input.executionProjection.taskDagHash,
    partitionPolicyHash: input.policyBinding.partitionPolicyHash,
    optimizerVersion: input.optimization.optimizerVersion,
    selectedCandidateId: input.optimization.selectedCandidateId,
    selectedCandidateScore: selected.score.total,
    selectedCandidateScoreBreakdown: structuredClone(selected.score.breakdown),
    candidateCount: input.optimization.searchReceipt.candidateCount,
    validCandidateCount: input.optimization.searchReceipt.validCandidateCount,
    rejectedCandidateSummaries: structuredClone(
      input.optimization.rejectedCandidateSummaries || []
    ),
    partitionCount: partitions.length,
    partitionIds: partitions.map((partition) => partition.partitionId),
    partitionSetHash,
    partitionManifestPath: receiptPaths.partitionManifestPath,
    globalCoverageReceiptPath: receiptPaths.globalCoverageReceiptPath,
    completedAt: input.completedAt || '1970-01-01T00:00:00.000Z',
    implementationViewReceipt:
      input.semanticDerivationMode === 'structured_fast_path'
        ? notApplicable
        : providerReceiptSummary(
            input.implementationViewReceipt,
            'implementation'
          ),
    acceptanceEvidenceViewReceipt:
      input.semanticDerivationMode === 'structured_fast_path'
        ? notApplicable
        : providerReceiptSummary(
            input.acceptanceEvidenceViewReceipt,
            'acceptance_evidence'
          ),
  };
  validateSchema(
    'goal-contract-partition-analysis-receipt.schema.json',
    analysisReceipt,
    'partition_analysis_receipt_schema_invalid'
  );
  const analysisReceiptBytes = canonicalText(analysisReceipt);
  const partitionAnalysisReceiptHash = sha256Text(analysisReceiptBytes);
  const manifestId = `partition-manifest-${sha256Text(
    stableStringify({
      partitionRunId,
      partitionSetHash,
    })
  ).slice('sha256:'.length)}`;
  const manifest = {
    schemaVersion: 'goal-contract-partition-manifest/v1',
    manifestId,
    partitionRunId,
    masterSourcePath: input.sourceSnapshot.sourcePath,
    masterSourceHash:
      input.sourceSnapshot.exactByteHash || input.sourceSnapshot.aggregateHash,
    masterSourceSemanticHash:
      input.sourceSnapshot.sourcePlanSemanticHash ||
      input.sourceSnapshot.aggregateHash,
    sourceSnapshotHash: input.sourceSnapshot.aggregateHash,
    sourceObligationGraphHash: input.sourceObligationGraphHash,
    methodologyProfileHash: input.methodologyProfileHash,
    reconciledGraphHash: input.reconciledGraphHash,
    semanticModelHash: input.executionProjection.semanticModelHash,
    ...sequenceState,
    executionProjectionHash:
      input.executionProjection.executionProjectionHash,
    taskDagHash: input.executionProjection.taskDagHash,
    partitionPolicyHash: input.policyBinding.partitionPolicyHash,
    optimizerVersion: input.optimization.optimizerVersion,
    selectedCandidateId: input.optimization.selectedCandidateId,
    partitionAnalysisReceiptPath:
      receiptPaths.partitionAnalysisReceiptPath,
    partitionAnalysisReceiptHash,
    partitionSetHash,
    partitionCount: partitions.length,
    topologicalOrder: partitions.map((partition) => partition.partitionId),
    globalCoverageReceiptPath: receiptPaths.globalCoverageReceiptPath,
    partitions,
  };
  validateManifestSequenceState(manifest, sequenceState);
  validateSchema(
    'goal-contract-partition-manifest.schema.json',
    manifest,
    'partition_manifest_schema_invalid'
  );
  const partitionManifestBytes = canonicalText(manifest);
  const compiled = {
    analysisReceipt,
    analysisReceiptBytes,
    partitionRunId,
    receiptPaths,
    partitionAnalysisReceiptHash,
    manifest,
    partitionManifestBytes,
    partitionManifestHash: sha256Text(partitionManifestBytes),
    sequenceState,
  };
  validatePartitionManifest(compiled);
  return Object.freeze(compiled);
}

function validateManifestDependencySemantics(manifest) {
  const partitions = manifest.partitions || [];
  const partitionById = new Map(
    partitions.map((partition) => [partition.partitionId, partition])
  );
  const topologicalOrder = manifest.topologicalOrder || [];
  if (
    partitionById.size !== partitions.length ||
    topologicalOrder.length !== partitions.length ||
    new Set(topologicalOrder).size !== partitions.length ||
    topologicalOrder.some((partitionId) => !partitionById.has(partitionId))
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'topological_order_mismatch',
    });
  }
  const partitionIndex = new Map(
    topologicalOrder.map((partitionId, index) => [partitionId, index])
  );
  const artifactOwnerByPath = new Map();
  for (const partition of partitions) {
    for (const artifactPath of partition.ownedArtifactPaths || []) {
      if (artifactOwnerByPath.has(artifactPath)) {
        throw failure('partition_manifest_currentness_mismatch', {
          reason: 'duplicate_shared_artifact_owner',
          artifactPath,
        });
      }
      artifactOwnerByPath.set(artifactPath, partition.partitionId);
    }
  }

  for (const partition of partitions) {
    const dependencyIds = new Set(partition.dependencyPartitionIds || []);
    for (const dependencyPartitionId of dependencyIds) {
      if (
        !partitionById.has(dependencyPartitionId) ||
        partitionIndex.get(dependencyPartitionId) >=
          partitionIndex.get(partition.partitionId)
      ) {
        throw failure('partition_manifest_currentness_mismatch', {
          reason: 'partition_future_dependency',
          partitionId: partition.partitionId,
          dependencyPartitionId,
        });
      }
    }

    const sharedDependencies = new Map();
    for (const sharedDependency of partition.sharedArtifactDependencies || []) {
      const dependencyPartitionIds = unique(
        sharedDependency.dependencyPartitionIds || []
      );
      if (
        sharedDependencies.has(sharedDependency.path) ||
        dependencyPartitionIds.length !== 1
      ) {
        throw failure('partition_manifest_currentness_mismatch', {
          reason: 'shared_artifact_dependency_invalid',
          partitionId: partition.partitionId,
          path: sharedDependency.path,
        });
      }
      const [predecessorPartitionId] = dependencyPartitionIds;
      if (
        !dependencyIds.has(predecessorPartitionId) ||
        artifactOwnerByPath.get(sharedDependency.path) !==
          predecessorPartitionId ||
        partitionIndex.get(predecessorPartitionId) >=
          partitionIndex.get(partition.partitionId)
      ) {
        throw failure('partition_manifest_currentness_mismatch', {
          reason: 'shared_artifact_owner_mismatch',
          partitionId: partition.partitionId,
          path: sharedDependency.path,
          predecessorPartitionId,
        });
      }
      sharedDependencies.set(sharedDependency.path, predecessorPartitionId);
    }

    const compatibilityRequirements = new Map();
    for (const requirement of partition.compatibilityReceiptRequirements || []) {
      if (
        compatibilityRequirements.has(requirement.artifactPath) ||
        sharedDependencies.get(requirement.artifactPath) !==
          requirement.predecessorPartitionId
      ) {
        throw failure('partition_manifest_currentness_mismatch', {
          reason: 'compatibility_predecessor_mismatch',
          partitionId: partition.partitionId,
          artifactPath: requirement.artifactPath,
          predecessorPartitionId: requirement.predecessorPartitionId,
        });
      }
      compatibilityRequirements.set(
        requirement.artifactPath,
        requirement.predecessorPartitionId
      );
    }
    if (
      stableStringify([...compatibilityRequirements.entries()].sort()) !==
      stableStringify([...sharedDependencies.entries()].sort())
    ) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'compatibility_requirement_set_mismatch',
        partitionId: partition.partitionId,
      });
    }
  }
}

// Finalized plan records have already passed their closed JSON Schema boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinalizedPlanRecord = Record<string, any>;

function partitionPlanSelections(partitionPlan) {
  const selections = new Map<string, FinalizedPlanRecord>(
    partitionPlan.selections.map((selection) => [
      selection.partitionId,
      selection,
    ])
  );
  const projections = new Map<string, FinalizedPlanRecord>(
    partitionPlan.childProjectionInputs.map((projection) => [
      projection.partitionId,
      projection,
    ])
  );
  return { projections, selections };
}

function validateFinalizationPartitionPlan(partitionPlan) {
  if (!partitionPlan || typeof partitionPlan !== 'object') {
    throw failure('partition_plan_invalid');
  }
  validateSchema(
    'goal-contract-partition-plan.schema.json',
    partitionPlan,
    'partition_plan_schema_invalid'
  );
  const { partitionPlanHash, ...semanticPlan } = partitionPlan;
  if (
    partitionPlanHash !== hashControlPlaneValue(semanticPlan)
  ) {
    throw failure('partition_plan_hash_mismatch');
  }
  const order = partitionPlan.topologicalOrder;
  const partitionIds = partitionPlan.partitions.map(
    ({ partitionId }) => partitionId
  );
  const selectionIds = partitionPlan.selections.map(
    ({ partitionId }) => partitionId
  );
  const projectionIds = partitionPlan.childProjectionInputs.map(
    ({ partitionId }) => partitionId
  );
  for (const actual of [partitionIds, selectionIds, projectionIds]) {
    if (stableStringify(actual) !== stableStringify(order)) {
      throw failure('partition_plan_order_mismatch');
    }
  }
  for (let index = 0; index < order.length; index += 1) {
    const partition = partitionPlan.partitions[index];
    const selection = partitionPlan.selections[index];
    const projection = partitionPlan.childProjectionInputs[index];
    const selectionSemantic = structuredClone(selection);
    delete selectionSemantic.selectionHash;
    if (
      selection.selectionHash !==
      hashControlPlaneValue(selectionSemantic)
    ) {
      throw failure('partition_selection_hash_mismatch', {
        partitionId: selection.partitionId,
      });
    }
    const expectedProjection = {
      ...structuredClone(selection),
      goalContractHash: partitionPlan.goalContractHash,
      orderedSourceSnapshotSetHash:
        partitionPlan.orderedSourceSnapshotSetHash,
      sourceAuthorityBundleHash:
        partitionPlan.sourceAuthorityBundleHash,
      partitionSetHash: partitionPlan.partitionSetHash,
      ...(partitionPlan.partitionImpactGraphHash
        ? {
            partitionClosureFeasibilityHash:
              partition.partitionClosureFeasibilityHash,
            closureRelevantArtifactIds:
              partition.closureRelevantArtifactIds,
            closureRelevantCommandIds:
              partition.closureRelevantCommandIds,
          }
        : {}),
    };
    if (
      stableStringify(projection) !==
      stableStringify(expectedProjection)
    ) {
      throw failure('partition_child_projection_mismatch', {
        partitionId: selection.partitionId,
      });
    }
  }
  const expectedPartitionSetHash = hashControlPlaneValue(
    partitionPlan.selections.map(
      ({ partitionId, selectionHash, dependencyPartitionIds }) => ({
        partitionId,
        selectionHash,
        dependencyPartitionIds,
      })
    )
  );
  if (partitionPlan.partitionSetHash !== expectedPartitionSetHash) {
    throw failure('partition_set_hash_mismatch');
  }
  return partitionPlanSelections(partitionPlan);
}

function validateFinalizationDependencies(
  partitionPlan,
  selections
) {
  const order = partitionPlan.topologicalOrder;
  const partitionIndex = new Map(
    order.map((partitionId, index) => [partitionId, index])
  );
  const expectedEdges = [];
  for (const partition of partitionPlan.partitions) {
    const currentIndex = partitionIndex.get(partition.partitionId);
    for (const dependencyPartitionId of
      partition.dependencyPartitionIds || []) {
      const dependencyIndex = partitionIndex.get(
        dependencyPartitionId
      );
      if (
        dependencyPartitionId === partition.partitionId ||
        dependencyIndex === undefined ||
        dependencyIndex >= currentIndex
      ) {
        throw failure('partition_dependency_order_invalid', {
          partitionId: partition.partitionId,
          dependencyPartitionId,
        });
      }
      expectedEdges.push({
        fromPartitionId: dependencyPartitionId,
        toPartitionId: partition.partitionId,
      });
    }
  }
  if (
    stableStringify(
      expectedEdges.sort((left, right) =>
        stableStringify(left).localeCompare(stableStringify(right))
      )
    ) !==
    stableStringify(
      [...partitionPlan.dependencyEdges].sort((left, right) =>
        stableStringify(left).localeCompare(stableStringify(right))
      )
    )
  ) {
    throw failure('partition_dependency_edge_mismatch');
  }
  const ownerRecords = new Map();
  for (const record of partitionPlan.ownerConsumerRecords || []) {
    if (ownerRecords.has(record.artifactPath)) {
      throw failure('partition_artifact_owner_duplicate', {
        artifactPath: record.artifactPath,
      });
    }
    const ownerIndex = partitionIndex.get(record.ownerPartitionId);
    const ownerSelection = selections.get(record.ownerPartitionId);
    if (
      ownerIndex === undefined ||
      !ownerSelection?.ownedArtifactPaths.includes(record.artifactPath)
    ) {
      throw failure('partition_artifact_owner_missing', {
        artifactPath: record.artifactPath,
      });
    }
    for (const consumerPartitionId of record.consumerPartitionIds) {
      const consumerIndex = partitionIndex.get(consumerPartitionId);
      if (
        consumerPartitionId === record.ownerPartitionId ||
        consumerIndex === undefined ||
        ownerIndex >= consumerIndex
      ) {
        throw failure('partition_owner_order_invalid', {
          artifactPath: record.artifactPath,
          ownerPartitionId: record.ownerPartitionId,
          consumerPartitionId,
        });
      }
      const consumerSelection = selections.get(consumerPartitionId);
      if (
        !consumerSelection?.dependencyPartitionIds.includes(
          record.ownerPartitionId
        )
      ) {
        throw failure('partition_shared_predecessor_missing', {
          artifactPath: record.artifactPath,
          ownerPartitionId: record.ownerPartitionId,
          consumerPartitionId,
        });
      }
    }
    ownerRecords.set(record.artifactPath, record);
  }
  return ownerRecords;
}

function childFrontMatter(childContractBytes) {
  const lines = String(childContractBytes).split(/\r?\n/u);
  if (lines[0] !== '---') {
    throw failure('partition_child_authority_mismatch', {
      reason: 'front_matter_missing',
    });
  }
  const closingIndex = lines.indexOf('---', 1);
  if (closingIndex < 1) {
    throw failure('partition_child_authority_mismatch', {
      reason: 'front_matter_unclosed',
    });
  }
  return Object.fromEntries(
    lines.slice(1, closingIndex).map((line) => {
      const separator = line.indexOf(':');
      if (separator < 1) {
        throw failure('partition_child_authority_mismatch', {
          reason: 'front_matter_field_invalid',
        });
      }
      return [
        line.slice(0, separator),
        line.slice(separator + 1).trim(),
      ];
    })
  );
}

function parseChildArrayBinding(fields, name) {
  try {
    const value = JSON.parse(fields[name]);
    if (!Array.isArray(value)) throw new Error(name);
    return value;
  } catch {
    throw failure('partition_child_authority_mismatch', {
      field: name,
    });
  }
}

function pendingChildReceiptPayload(receipt) {
  const payload = structuredClone(receipt);
  delete payload.receiptHash;
  delete payload.childContractBytes;
  return payload;
}

function projectionGovernedPaths(projection) {
  return projection.governedPaths ?? projection.ownedArtifactPaths ?? [];
}

function validatePendingChildReceipt({
  partitionPlan,
  projection,
  receipt,
  displayOrdinal,
  expectedCompatibilityCount,
}) {
  if (receipt.partitionId !== projection.partitionId) {
    throw failure('partition_child_order_mismatch');
  }
  if (
    receipt.partitionPlanHash !== partitionPlan.partitionPlanHash
  ) {
    throw failure('partition_child_plan_stale', {
      partitionId: projection.partitionId,
    });
  }
  const currentChildHash = sha256Text(
    Buffer.from(receipt.childContractBytes || '', 'utf8')
  );
  if (receipt.childContractHash !== currentChildHash) {
    throw failure('partition_child_hash_mismatch', {
      partitionId: projection.partitionId,
    });
  }
  if (
    receipt.compatibilityRequirementCount !==
    expectedCompatibilityCount
  ) {
    throw failure('partition_compatibility_count_mismatch', {
      partitionId: projection.partitionId,
      expectedCompatibilityCount,
      actualCompatibilityCount:
        receipt.compatibilityRequirementCount,
    });
  }
  const authorityFields = {
    displayOrdinal,
    partitionId: projection.partitionId,
    partitionSetHash: partitionPlan.partitionSetHash,
    ...(partitionPlan.partitionImpactGraphHash
      ? {
          partitionImpactGraphHash:
            partitionPlan.partitionImpactGraphHash,
          partitionClosureFeasibilityHash:
            projection.partitionClosureFeasibilityHash,
          closureRelevantArtifactIds:
            projection.closureRelevantArtifactIds,
          closureRelevantCommandIds:
            projection.closureRelevantCommandIds,
          driftHash: partitionPlan.driftHash,
        }
      : {}),
    selectionHash: projection.selectionHash,
    goalContractHash: partitionPlan.goalContractHash,
    sourceCompositionPolicyHash:
      partitionPlan.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      partitionPlan.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      partitionPlan.sourceAuthorityBundleHash,
    subordinateCoverageReceiptHashes:
      projection.subordinateCoverageReceiptHashes,
    namespacedObligations: projection.namespacedObligations,
    namespaceRefs: projection.namespaceRefs,
    sourceArtifactRefs: projection.sourceArtifactRefs,
    specSpanRefs: projection.specSpanRefs,
    obligationRefs: unique([
      ...projection.primarySourceObligationIds,
      ...projection.namespacedObligations.map(
        ({ declaredSourceId }) => declaredSourceId
      ),
    ]),
    governedPaths: projectionGovernedPaths(projection),
    dependencyPartitionIds: projection.dependencyPartitionIds,
  };
  for (const [field, expected] of Object.entries(authorityFields)) {
    if (
      stableStringify(receipt[field]) !== stableStringify(expected)
    ) {
      throw failure('partition_child_authority_mismatch', {
        partitionId: projection.partitionId,
        field,
      });
    }
  }
  const fields = childFrontMatter(receipt.childContractBytes);
  const scalarBindings = {
    sourceCompositionPolicyHash:
      partitionPlan.sourceCompositionPolicyHash,
    partitionPlanHash: partitionPlan.partitionPlanHash,
    goalContractHash: partitionPlan.goalContractHash,
    partitionSetHash: partitionPlan.partitionSetHash,
    selectionSetHash: projection.selectionHash,
    orderedSourceSnapshotSetHash:
      partitionPlan.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      partitionPlan.sourceAuthorityBundleHash,
    partitionId: projection.partitionId,
    displayOrdinal: String(displayOrdinal),
  };
  for (const [field, expected] of Object.entries(scalarBindings)) {
    if (fields[field] !== expected) {
      throw failure('partition_child_authority_mismatch', {
        partitionId: projection.partitionId,
        field,
      });
    }
  }
  for (const [field, expected] of Object.entries({
    subordinateCoverageReceiptHashes:
      projection.subordinateCoverageReceiptHashes,
    obligationRefs: authorityFields.obligationRefs,
    namespaceRefs: projection.namespaceRefs,
    sourceArtifactRefs: projection.sourceArtifactRefs,
    specSpanRefs: projection.specSpanRefs,
    governedPaths: projectionGovernedPaths(projection),
  })) {
    if (
      stableStringify(parseChildArrayBinding(fields, field)) !==
      stableStringify(expected)
    ) {
      throw failure('partition_child_authority_mismatch', {
        partitionId: projection.partitionId,
        field,
      });
    }
  }
  const expectedReceiptHash = sha256Text(
    stableReceiptStringify(pendingChildReceiptPayload(receipt))
  );
  if (receipt.receiptHash !== expectedReceiptHash) {
    throw failure('partition_child_compilation_receipt_hash_mismatch', {
      partitionId: projection.partitionId,
    });
  }
}

function compatibilityRecordsForPartition({
  partitionId,
  ownerRecords,
  partitionRunId: _partitionRunId,
  artifactPaths,
}) {
  const sharedArtifactDependencies = [];
  const compatibilityReceiptRequirements = [];
  for (const record of ownerRecords.values()) {
    if (!record.consumerPartitionIds.includes(partitionId)) continue;
    sharedArtifactDependencies.push({
      path: record.artifactPath,
      dependencyPartitionIds: [record.ownerPartitionId],
    });
    compatibilityReceiptRequirements.push({
      artifactPath: record.artifactPath,
      predecessorPartitionId: record.ownerPartitionId,
      receiptPath: artifactPaths.compatibilityReceiptPath({
        partitionId,
        artifactPath: record.artifactPath,
        predecessorPartitionId: record.ownerPartitionId,
      }),
    });
  }
  return {
    sharedArtifactDependencies: sharedArtifactDependencies.sort(
      (left, right) => left.path.localeCompare(right.path)
    ),
    compatibilityReceiptRequirements:
      compatibilityReceiptRequirements.sort((left, right) =>
        left.artifactPath.localeCompare(right.artifactPath)
      ),
  };
}

function finalizationArtifactPaths({ partitionRunId, layout }) {
  if (layout === 'authority_unit') {
    return Object.freeze({
      partitionPlanPath: 'partition-plan.json',
      partitionManifestPath: 'partition-manifest.json',
      partitionAnalysisReceiptPath:
        'receipts/partition-analysis.receipt.json',
      globalCoverageReceiptPath: 'receipts/global-coverage.receipt.json',
      selectionReceiptPath(partitionId) {
        return `receipts/partitions/${partitionId}/selection.receipt.json`;
      },
      compatibilityReceiptPath({
        partitionId,
        artifactPath,
        predecessorPartitionId,
      }) {
        return (
          `receipts/partitions/${partitionId}/compatibility/` +
          `${sha256Text(
            `${artifactPath}|${predecessorPartitionId}`
          ).slice('sha256:'.length, 'sha256:'.length + 16)}.receipt.json`
        );
      },
    });
  }
  const root = `partition-runs/${partitionRunId}`;
  return Object.freeze({
    partitionPlanPath: `${root}/partition-plan.json`,
    partitionManifestPath: `${root}/partition-manifest.json`,
    partitionAnalysisReceiptPath:
      `${root}/partition-analysis.receipt.json`,
    globalCoverageReceiptPath: `${root}/global-coverage.receipt.json`,
    selectionReceiptPath(partitionId) {
      return `${root}/partitions/${partitionId}/selection.receipt.json`;
    },
    compatibilityReceiptPath({
      partitionId,
      artifactPath,
      predecessorPartitionId,
    }) {
      return (
        `${root}/partitions/${partitionId}/compatibility/` +
        `${sha256Text(
          `${artifactPath}|${predecessorPartitionId}`
        ).slice('sha256:'.length, 'sha256:'.length + 16)}.receipt.json`
      );
    },
  });
}

function validatePartitionImpactFinalizationInput({
  partitionPlan,
  partitionImpactAuthority,
}) {
  const hardened = Boolean(
    partitionPlan.partitionImpactGraphHash
  );
  if (!hardened) return null;
  if (
    !partitionImpactAuthority ||
    typeof partitionImpactAuthority !== 'object'
  ) {
    throw failure('partition_impact_authority_missing');
  }
  const bindings = {
    repositoryTreeHash:
      partitionImpactAuthority.impactGraph?.repositoryTreeHash,
    partitionPlanBasisHash:
      partitionImpactAuthority.impactGraph
        ?.partitionPlanBasisHash,
    partitionImpactPolicyHash:
      partitionImpactAuthority.impactGraph
        ?.partitionImpactPolicyHash,
    partitionImpactAnalyzerIdentityHash:
      partitionImpactAuthority.impactGraph?.analyzerIdentityHash,
    partitionImpactGraphHash:
      partitionImpactAuthority.impactGraph?.impactGraphHash,
    partitionImpactGraphDocumentHash:
      sha256Text(partitionImpactAuthority.impactGraphBytes || ''),
    partitionClosureFeasibilityReceiptHash:
      sha256Text(
        partitionImpactAuthority.closureFeasibilityBytes || ''
      ),
    partitionClosureFeasibilityDecision:
      partitionImpactAuthority.closureFeasibility?.decision,
    partitionImpactDriftReceiptHash:
      sha256Text(partitionImpactAuthority.impactDriftBytes || ''),
    driftHash:
      partitionImpactAuthority.impactDrift?.driftHash,
  };
  const mismatchedFields = Object.entries(bindings)
    .filter(
      ([field, value]) => partitionPlan[field] !== value
    )
    .map(([field]) => field)
    .sort();
  if (
    mismatchedFields.length > 0 ||
    partitionPlan.partitionClosureFeasibilityDecision !== 'pass'
  ) {
    throw failure('partition_impact_authority_binding_mismatch', {
      mismatchedFields,
    });
  }
  return partitionImpactAuthority;
}

function buildFinalPartitionAnalysisReceipt({
  partitionAnalysisReceipt,
  partitionPlan,
  partitionRunId,
  artifactPaths,
}) {
  if (
    !partitionAnalysisReceipt ||
    typeof partitionAnalysisReceipt !== 'object'
  ) {
    throw failure('partition_analysis_receipt_missing');
  }
  const receipt = {
    ...structuredClone(partitionAnalysisReceipt),
    runId: partitionRunId,
    partitionRunId,
    partitionCount: partitionPlan.topologicalOrder.length,
    partitionIds: [...partitionPlan.topologicalOrder],
    partitionSetHash: partitionPlan.partitionSetHash,
    partitionManifestPath: artifactPaths.partitionManifestPath,
    globalCoverageReceiptPath:
      artifactPaths.globalCoverageReceiptPath,
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionPlanBasisHash:
      partitionPlan.partitionPlanBasisHash,
    repositoryTreeHash: partitionPlan.repositoryTreeHash,
    partitionImpactPolicyHash:
      partitionPlan.partitionImpactPolicyHash,
    partitionImpactAnalyzerIdentityHash:
      partitionPlan.partitionImpactAnalyzerIdentityHash,
    partitionImpactGraphHash:
      partitionPlan.partitionImpactGraphHash,
    partitionImpactGraphDocumentHash:
      partitionPlan.partitionImpactGraphDocumentHash,
    partitionClosureFeasibilityReceiptHash:
      partitionPlan.partitionClosureFeasibilityReceiptHash,
    partitionClosureFeasibilityDecision:
      partitionPlan.partitionClosureFeasibilityDecision,
    partitionImpactDriftReceiptHash:
      partitionPlan.partitionImpactDriftReceiptHash,
    driftHash: partitionPlan.driftHash,
  };
  validateSchema(
    'goal-contract-partition-analysis-receipt.schema.json',
    receipt,
    'partition_analysis_receipt_schema_invalid'
  );
  const receiptBytes = canonicalText(receipt);
  return Object.freeze({
    receipt: Object.freeze(receipt),
    receiptBytes,
    receiptHash: sha256Text(receiptBytes),
  });
}

function finalizePartitionManifest({
  partitionPlan,
  displayTitles = {},
  childCompilationReceipts,
  artifactLayout,
  partitionAnalysisReceipt,
  partitionImpactAuthority,
}) {
  const impactAuthority =
    validatePartitionImpactFinalizationInput({
      partitionPlan,
      partitionImpactAuthority,
    });
  const { projections, selections } =
    validateFinalizationPartitionPlan(partitionPlan);
  if (!Array.isArray(childCompilationReceipts)) {
    throw failure('partition_child_set_incomplete');
  }
  if (
    childCompilationReceipts.length !==
    partitionPlan.topologicalOrder.length
  ) {
    throw failure('partition_child_set_incomplete', {
      expected: partitionPlan.topologicalOrder.length,
      actual: childCompilationReceipts.length,
    });
  }
  const childIds = childCompilationReceipts.map(
    ({ partitionId }) => partitionId
  );
  if (new Set(childIds).size !== childIds.length) {
    throw failure('partition_child_set_duplicate');
  }
  if (
    stableStringify(childIds) !==
    stableStringify(partitionPlan.topologicalOrder)
  ) {
    const unknownIds = childIds.filter(
      (partitionId) =>
        !partitionPlan.topologicalOrder.includes(partitionId)
    );
    throw failure(
      unknownIds.length > 0
        ? 'partition_child_set_unknown'
        : 'partition_child_order_mismatch',
      { unknownIds }
    );
  }
  const ownerRecords = validateFinalizationDependencies(
    partitionPlan,
    selections
  );
  for (let index = 0; index < childCompilationReceipts.length; index += 1) {
    const partitionId = partitionPlan.topologicalOrder[index];
    const expectedCompatibilityCount = [
      ...ownerRecords.values(),
    ].filter((record) =>
      record.consumerPartitionIds.includes(partitionId)
    ).length;
    validatePendingChildReceipt({
      partitionPlan,
      projection: projections.get(partitionId),
      receipt: childCompilationReceipts[index],
      displayOrdinal: index + 1,
      expectedCompatibilityCount,
    });
  }
  const orderedChildContractHashes = childCompilationReceipts.map(
    ({ childContractHash }) => childContractHash
  );
  const partitionManifestHash = hashControlPlaneValue({
    goalContractHash: partitionPlan.goalContractHash,
    sourceCompositionPolicyHash:
      partitionPlan.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash:
      partitionPlan.sourceAuthorityBundleHash,
    partitionPolicyHash: partitionPlan.partitionPolicyHash,
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionSetHash: partitionPlan.partitionSetHash,
    ...(partitionPlan.aggregateValidation
      ? {
          taskExecutionRoleAuthorityHash:
            partitionPlan.taskExecutionRoleAuthorityHash,
          aggregateValidation:
            partitionPlan.aggregateValidation,
        }
      : {}),
    ...(impactAuthority
      ? {
          repositoryTreeHash:
            partitionPlan.repositoryTreeHash,
          partitionImpactPolicyHash:
            partitionPlan.partitionImpactPolicyHash,
          partitionImpactAnalyzerIdentityHash:
            partitionPlan.partitionImpactAnalyzerIdentityHash,
          partitionImpactGraphHash:
            partitionPlan.partitionImpactGraphHash,
          partitionImpactGraphDocumentHash:
            partitionPlan.partitionImpactGraphDocumentHash,
          partitionClosureFeasibilityReceiptHash:
            partitionPlan.partitionClosureFeasibilityReceiptHash,
          partitionImpactDriftReceiptHash:
            partitionPlan.partitionImpactDriftReceiptHash,
          driftHash: partitionPlan.driftHash,
        }
      : {}),
    orderedChildContractHashes,
  });
  const partitionRunId = `partition-run-${hashControlPlaneValue({
    partitionPlanHash: partitionPlan.partitionPlanHash,
    orderedChildContractHashes,
  }).slice('sha256:'.length)}`;
  const artifactPaths = finalizationArtifactPaths({
    partitionRunId,
    layout: artifactLayout,
  });
  const finalAnalysis = impactAuthority
    ? buildFinalPartitionAnalysisReceipt({
        partitionAnalysisReceipt,
        partitionPlan,
        partitionRunId,
        artifactPaths,
      })
    : null;
  const partitions = partitionPlan.topologicalOrder.map(
    (partitionId, index) => {
      const basePartition = partitionPlan.partitions[index];
      const selection = selections.get(partitionId);
      const receipt = childCompilationReceipts[index];
      const compatibility = compatibilityRecordsForPartition({
        partitionId,
        ownerRecords,
        partitionRunId,
        artifactPaths,
      });
      const ownerConsumerRecords = (
        partitionPlan.ownerConsumerRecords || []
      ).filter(
        (record) =>
          record.ownerPartitionId === partitionId ||
          record.consumerPartitionIds.includes(partitionId)
      );
      const membership = {
        ...structuredClone(basePartition),
        displayOrdinal: index + 1,
        displayTitle:
          displayTitles[partitionId] ||
          basePartition.displayTitle ||
          `Partition ${index + 1}`,
        sourceCompositionPolicyHash:
          partitionPlan.sourceCompositionPolicyHash,
        partitionPlanHash: partitionPlan.partitionPlanHash,
        goalContractHash: partitionPlan.goalContractHash,
        orderedSourceSnapshotSetHash:
          partitionPlan.orderedSourceSnapshotSetHash,
        sourceAuthorityBundleHash:
          partitionPlan.sourceAuthorityBundleHash,
        subordinateCoverageReceiptHashes:
          selection.subordinateCoverageReceiptHashes,
        childContractPath: receipt.childContractPath,
        childContractHash: receipt.childContractHash,
        childCompilationReceiptHash: receipt.receiptHash,
        obligationRefs: receipt.obligationRefs,
        namespacedObligations: selection.namespacedObligations,
        namespaceRefs: selection.namespaceRefs,
        sourceArtifactRefs: selection.sourceArtifactRefs,
        specSpanRefs: selection.specSpanRefs,
        governedPaths: projectionGovernedPaths(selection),
        dependencyPartitionIds: selection.dependencyPartitionIds,
        ownedArtifactPaths: selection.ownedArtifactPaths,
        sharedArtifactDependencies:
          compatibility.sharedArtifactDependencies,
        compatibilityReceiptRequirements:
          compatibility.compatibilityReceiptRequirements,
        ownerConsumerRecords,
        executionLeaseRequired: true,
        selectionSetHash: selection.selectionHash,
        selectionReceiptPath:
          artifactPaths.selectionReceiptPath(partitionId),
      };
      return {
        ...membership,
        childMembershipHash: hashControlPlaneValue(membership),
      };
    }
  );
  const primaryBinding = partitionPlan.orderedSourceBindings[0];
  const requiredObligationIds = unique([
    ...partitionPlan.coverageObligations.sourceObligationIds,
    ...(partitionPlan.aggregateValidation?.tasks || []).flatMap(
      ({ sourceObligationIds }) => sourceObligationIds || []
    ),
    ...partitionPlan.coverageObligations.subordinateDeclaredSourceIds,
  ]);
  const coveredObligationIds = unique([
    ...partitions.flatMap(({ obligationRefs }) => obligationRefs),
    ...(partitionPlan.aggregateValidation?.tasks || []).flatMap(
      ({ sourceObligationIds }) => sourceObligationIds || []
    ),
  ]);
  if (
    stableStringify(requiredObligationIds) !==
    stableStringify(coveredObligationIds)
  ) {
    throw failure('partition_final_coverage_incomplete', {
      requiredObligationIds,
      coveredObligationIds,
    });
  }
  const manifest = {
    schemaVersion: 'goal-contract-partition-manifest/v2',
    manifestAuthorityMode: 'final_child_membership',
    manifestId: `partition-manifest-${partitionManifestHash.slice(
      'sha256:'.length
    )}`,
    partitionRunId,
    masterSourcePath: primaryBinding.sourceArtifactId,
    masterSourceHash: primaryBinding.sourceSnapshotHash,
    masterSourceSemanticHash:
      partitionPlan.canonicalIntentSemanticHash,
    sourceSnapshotHash:
      partitionPlan.orderedSourceSnapshotSetHash,
    sourceObligationGraphHash:
      partitionPlan.canonicalIntentSemanticHash,
    methodologyProfileHash:
      partitionPlan.methodologyProfileHash,
    reconciledGraphHash:
      partitionPlan.canonicalIntentSemanticHash,
    semanticModelHash: partitionPlan.goalContractSemanticHash,
    sourceCompositionMode: partitionPlan.sourceCompositionMode,
    sourceCompositionPolicyHash:
      partitionPlan.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      partitionPlan.orderedSourceSnapshotSetHash,
    orderedSourceBindings:
      structuredClone(partitionPlan.orderedSourceBindings),
    sourceAuthorityBundleHash:
      partitionPlan.sourceAuthorityBundleHash,
    canonicalIntentSemanticHash:
      partitionPlan.canonicalIntentSemanticHash,
    canonicalIntentBundleHash:
      partitionPlan.canonicalIntentBundleHash,
    specSpanRegistryHash: partitionPlan.specSpanRegistryHash,
    intentAuthorityAttestationHash:
      partitionPlan.intentAuthorityAttestationHash,
    subordinateCoverageReceiptHashes:
      partitionPlan.subordinateCoverageReceiptHashes,
    goalContractSemanticHash:
      partitionPlan.goalContractSemanticHash,
    goalContractHash: partitionPlan.goalContractHash,
    sequenceMode: partitionPlan.sequenceMode,
    sequenceApplicability: partitionPlan.sequenceApplicability,
    sequenceCoverage: partitionPlan.sequenceCoverage,
    sequenceClosureStatus: partitionPlan.sequenceClosureStatus,
    childContractAuthority: partitionPlan.childContractAuthority,
    ...(partitionPlan.aggregateValidation
      ? {
          taskExecutionRoleAuthorityHash:
            partitionPlan.taskExecutionRoleAuthorityHash,
          aggregateValidation:
            structuredClone(partitionPlan.aggregateValidation),
        }
      : {}),
    executionProjectionHash:
      partitionPlan.executionProjectionHash,
    taskDagHash: partitionPlan.taskDagHash,
    partitionPolicyHash: partitionPlan.partitionPolicyHash,
    optimizerVersion: partitionPlan.optimizerVersion,
    selectedCandidateId: partitionPlan.selectedCandidateId,
    partitionPlanPath:
      artifactPaths.partitionPlanPath,
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionAnalysisReceiptPath:
      artifactPaths.partitionAnalysisReceiptPath,
    partitionAnalysisReceiptHash:
      finalAnalysis
        ? finalAnalysis.receiptHash
        : partitionPlan.partitionPlanHash,
    partitionSetHash: partitionPlan.partitionSetHash,
    partitionCount: partitions.length,
    topologicalOrder: partitionPlan.topologicalOrder,
    dependencyGraphHash: hashControlPlaneValue(
      partitionPlan.dependencyEdges
    ),
    orderedChildContractHashes,
    partitionManifestHash,
    ...(impactAuthority
      ? {
          repositoryTreeHash:
            partitionPlan.repositoryTreeHash,
          partitionPlanBasisHash:
            partitionPlan.partitionPlanBasisHash,
          partitionImpactPolicyHash:
            partitionPlan.partitionImpactPolicyHash,
          partitionImpactAnalyzerIdentityHash:
            partitionPlan.partitionImpactAnalyzerIdentityHash,
          partitionImpactGraphPath:
            partitionPlan.partitionImpactGraphPath,
          partitionImpactGraphHash:
            partitionPlan.partitionImpactGraphHash,
          partitionImpactGraphDocumentHash:
            partitionPlan.partitionImpactGraphDocumentHash,
          partitionClosureFeasibilityReceiptPath:
            partitionPlan
              .partitionClosureFeasibilityReceiptPath,
          partitionClosureFeasibilityReceiptHash:
            partitionPlan
              .partitionClosureFeasibilityReceiptHash,
          partitionClosureFeasibilityDecision:
            partitionPlan
              .partitionClosureFeasibilityDecision,
          partitionImpactDriftReceiptPath:
            partitionPlan.partitionImpactDriftReceiptPath,
          partitionImpactDriftReceiptHash:
            partitionPlan.partitionImpactDriftReceiptHash,
          driftHash: partitionPlan.driftHash,
        }
      : {}),
    namespaceOwnership:
      structuredClone(partitionPlan.namespaceOwnership),
    subordinateTaskMappings:
      structuredClone(partitionPlan.subordinateTaskMappings),
    coverage: {
      requiredObligationIds,
      coveredObligationIds,
      uncoveredObligationIds: [],
      duplicateObligationIds: [],
      unmappedObligationIds: [],
      scopeEscapeObligationIds: [],
    },
    globalCoverageReceiptPath:
      artifactPaths.globalCoverageReceiptPath,
    partitions,
  };
  validateManifestSequenceState(manifest, {
    sequenceMode: partitionPlan.sequenceMode,
    sequenceApplicability: partitionPlan.sequenceApplicability,
    sequenceCoverage: partitionPlan.sequenceCoverage,
    sequenceClosureStatus: partitionPlan.sequenceClosureStatus,
    childContractAuthority: partitionPlan.childContractAuthority,
  });
  validateSchema(
    'goal-contract-partition-manifest.schema.json',
    manifest,
    'partition_manifest_schema_invalid'
  );
  const childMembershipReceipts = childCompilationReceipts.map(
    (receipt) => {
      const payload = {
        schemaVersion:
          'goal-contract-child-manifest-membership-receipt/v1',
        membershipStatus: 'final',
        partitionId: receipt.partitionId,
        childContractPath: receipt.childContractPath,
        childContractHash: receipt.childContractHash,
        childCompilationReceiptHash: receipt.receiptHash,
        partitionPlanHash: partitionPlan.partitionPlanHash,
        partitionManifestHash,
      };
      return Object.freeze({
        ...payload,
        receiptHash: hashControlPlaneValue(payload),
      });
    }
  );
  const partitionManifestBytes = canonicalText(manifest);
  return Object.freeze({
    manifest: Object.freeze(manifest),
    analysisReceipt: finalAnalysis?.receipt,
    analysisReceiptBytes: finalAnalysis?.receiptBytes,
    partitionAnalysisReceiptHash:
      finalAnalysis?.receiptHash,
    partitionManifestBytes,
    partitionManifestHash,
    partitionManifestDocumentHash: sha256Text(
      partitionManifestBytes
    ),
    orderedChildContractHashes,
    childMembershipReceipts,
  });
}

function validatePartitionManifest(compiled) {
  validateManifestSequenceState(
    compiled.manifest,
    compiled.sequenceState || null
  );
  validateSchema(
    'goal-contract-partition-analysis-receipt.schema.json',
    compiled.analysisReceipt,
    'partition_analysis_receipt_schema_invalid'
  );
  validateSchema(
    'goal-contract-partition-manifest.schema.json',
    compiled.manifest,
    'partition_manifest_schema_invalid'
  );
  validateManifestDependencySemantics(compiled.manifest);
  const analysisBytes = canonicalText(compiled.analysisReceipt);
  const analysisHash = sha256Text(analysisBytes);
  if (
    compiled.partitionAnalysisReceiptHash !== analysisHash ||
    compiled.manifest.partitionAnalysisReceiptHash !== analysisHash ||
    compiled.analysisReceiptBytes !== analysisBytes
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'analysis_receipt_hash_mismatch',
    });
  }
  for (const partition of compiled.manifest.partitions) {
    const expectedPartitionId = derivePartitionId({
      sourceSnapshotHash: compiled.manifest.sourceSnapshotHash,
      executionProjectionHash: compiled.manifest.executionProjectionHash,
      partitionPolicyHash: compiled.manifest.partitionPolicyHash,
      primaryTraceSliceIds: partition.primaryTraceSliceIds,
      primaryTaskIds: partition.primaryTaskIds,
      dependencyPartitionIds: partition.dependencyPartitionIds,
      partitionRole: partition.partitionRole,
    });
    if (partition.partitionId !== expectedPartitionId) {
      throw failure('partition_manifest_currentness_mismatch', {
        reason: 'partition_id_mismatch',
        partitionId: partition.partitionId,
        expectedPartitionId,
      });
    }
  }
  const expectedPartitions = compiled.manifest.partitions.map(
    (partition, index) => ({
      ...partition,
      displayOrdinal: index + 1,
      selectionSetHash: selectionSetHash(partition),
    })
  );
  if (
    stableStringify(expectedPartitions) !==
    stableStringify(compiled.manifest.partitions)
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'partition_selection_set_mismatch',
    });
  }
  const expectedOrder = compiled.manifest.partitions.map(
    (partition) => partition.partitionId
  );
  if (
    stableStringify(expectedOrder) !==
    stableStringify(compiled.manifest.topologicalOrder)
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'topological_order_mismatch',
    });
  }
  const expectedPartitionSetHash = sha256Text(
    stableStringify(
      compiled.manifest.partitions.map(
        ({ partitionId, selectionSetHash: setHash, dependencyPartitionIds }) => ({
          partitionId,
          selectionSetHash: setHash,
          dependencyPartitionIds,
        })
      )
    )
  );
  if (compiled.manifest.partitionSetHash !== expectedPartitionSetHash) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'partition_set_hash_mismatch',
    });
  }
  const expectedManifestId = `partition-manifest-${sha256Text(
    stableStringify({
      partitionRunId: compiled.manifest.partitionRunId,
      partitionSetHash: compiled.manifest.partitionSetHash,
    })
  ).slice('sha256:'.length)}`;
  if (compiled.manifest.manifestId !== expectedManifestId) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'manifest_id_mismatch',
    });
  }
  if (
    compiled.analysisReceipt.partitionSetHash !==
      compiled.manifest.partitionSetHash ||
    stableStringify(compiled.analysisReceipt.partitionIds) !==
      stableStringify(compiled.manifest.topologicalOrder) ||
    compiled.analysisReceipt.candidateCount !==
      compiled.analysisReceipt.validCandidateCount +
        compiled.analysisReceipt.rejectedCandidateSummaries.length
  ) {
    throw failure('partition_manifest_currentness_mismatch', {
      reason: 'analysis_manifest_binding_mismatch',
    });
  }
  const manifestBytes = canonicalText(compiled.manifest);
  const manifestHash = sha256Text(manifestBytes);
  if (
    compiled.partitionManifestHash !== manifestHash ||
    compiled.partitionManifestBytes !== manifestBytes
  ) {
    throw failure('partition_manifest_hash_mismatch');
  }
  return Object.freeze({ decision: 'pass' });
}

function defaultWriteText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    if (fs.readFileSync(filePath, 'utf8') !== text) {
      throw failure('partition_candidate_selection_nondeterministic', {
        filePath,
      });
    }
    return;
  }
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, text, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temporaryPath, filePath);
}

function isSameOrAncestor(ancestorPath, descendantPath) {
  const relative = path.relative(ancestorPath, descendantPath);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

function assertOutputPathIsolation(receiptsDir, activeManifestPath) {
  if (!activeManifestPath) return;
  const receiptsRoot = path.resolve(receiptsDir);
  const activePath = path.resolve(activeManifestPath);
  if (
    isSameOrAncestor(receiptsRoot, activePath) ||
    isSameOrAncestor(activePath, receiptsRoot)
  ) {
    throw failure('partition_output_path_overlap', {
      receiptsDir: receiptsRoot.replace(/\\/gu, '/'),
      activeManifestPath: activePath.replace(/\\/gu, '/'),
    });
  }
}

function activeOutputSnapshot(activeManifestPath) {
  if (!activeManifestPath) return null;
  const resolved = path.resolve(activeManifestPath);
  if (!fs.existsSync(resolved)) {
    return { path: resolved, state: 'absent' };
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw failure('partition_active_output_invalid', {
      activeManifestPath: resolved.replace(/\\/gu, '/'),
    });
  }
  return {
    path: resolved,
    state: 'file',
    bytes: fs.readFileSync(resolved),
  };
}

function assertActiveOutputUnchanged(snapshot) {
  if (!snapshot) return;
  if (snapshot.state === 'absent') {
    if (fs.existsSync(snapshot.path)) {
      throw failure('partition_active_output_changed');
    }
    return;
  }
  if (
    !fs.existsSync(snapshot.path) ||
    !fs.statSync(snapshot.path).isFile() ||
    !fs.readFileSync(snapshot.path).equals(snapshot.bytes)
  ) {
    throw failure('partition_active_output_changed');
  }
}

function stagePartitionSolution({
  compiled,
  receiptsDir,
  activeManifestPath = null,
  writeText = defaultWriteText,
}) {
  validatePartitionManifest(compiled);
  assertOutputPathIsolation(receiptsDir, activeManifestPath);
  const activeSnapshot = activeOutputSnapshot(activeManifestPath);
  const stageRoot = path.join(
    path.resolve(receiptsDir),
    '.partition-staging',
    compiled.partitionRunId
  );
  const analysisReceiptPath = path.join(
    stageRoot,
    'partition-analysis.receipt.json'
  );
  const manifestPath = path.join(stageRoot, 'partition-manifest.json');
  const stageReceiptPath = path.join(stageRoot, 'stage.receipt.json');
  writeText(analysisReceiptPath, compiled.analysisReceiptBytes);
  writeText(manifestPath, compiled.partitionManifestBytes);
  const analysisReceiptBytes = fs.readFileSync(analysisReceiptPath);
  const partitionManifestBytes = fs.readFileSync(manifestPath);
  if (
    !analysisReceiptBytes.equals(Buffer.from(compiled.analysisReceiptBytes)) ||
    !partitionManifestBytes.equals(Buffer.from(compiled.partitionManifestBytes))
  ) {
    throw failure('partition_stage_reread_mismatch');
  }
  let analysisReceipt;
  let manifest;
  try {
    analysisReceipt = JSON.parse(analysisReceiptBytes.toString('utf8'));
    manifest = JSON.parse(partitionManifestBytes.toString('utf8'));
  } catch {
    throw failure('partition_stage_reread_mismatch', {
      reason: 'staged_json_invalid',
    });
  }
  validateSchema(
    'goal-contract-partition-analysis-receipt.schema.json',
    analysisReceipt,
    'partition_analysis_receipt_schema_invalid'
  );
  validateSchema(
    'goal-contract-partition-manifest.schema.json',
    manifest,
    'partition_manifest_schema_invalid'
  );
  const analysisReceiptHash = sha256Text(analysisReceiptBytes);
  const partitionManifestHash = sha256Text(partitionManifestBytes);
  validatePartitionManifest({
    ...compiled,
    analysisReceipt,
    analysisReceiptBytes: analysisReceiptBytes.toString('utf8'),
    partitionAnalysisReceiptHash: analysisReceiptHash,
    manifest,
    partitionManifestBytes: partitionManifestBytes.toString('utf8'),
    partitionManifestHash,
  });
  const stageReceipt = {
    schemaVersion: 'goal-contract-partition-stage-receipt/v1',
    partitionRunId: compiled.partitionRunId,
    analysisReceiptPath: analysisReceiptPath.replace(/\\/gu, '/'),
    analysisReceiptHash,
    manifestPath: manifestPath.replace(/\\/gu, '/'),
    partitionManifestHash,
  };
  const stageReceiptBytes = canonicalText(stageReceipt);
  writeText(stageReceiptPath, stageReceiptBytes);
  if (fs.readFileSync(stageReceiptPath, 'utf8') !== stageReceiptBytes) {
    throw failure('partition_stage_reread_mismatch');
  }
  assertActiveOutputUnchanged(activeSnapshot);
  return Object.freeze({
    runId: compiled.partitionRunId,
    partitionRunId: compiled.partitionRunId,
    analysisReceiptPath: analysisReceiptPath.replace(/\\/gu, '/'),
    analysisReceiptHash,
    manifestPath: manifestPath.replace(/\\/gu, '/'),
    partitionManifestHash,
    stageReceiptPath: stageReceiptPath.replace(/\\/gu, '/'),
    stageReceiptHash: sha256Text(stageReceiptBytes),
    manifest,
  });
}

module.exports = {
  assertOutputPathIsolation,
  buildFinalPartitionRunReceiptPaths,
  compilePartitionManifest,
  finalizePartitionManifest,
  resolveAssetRoot,
  stagePartitionSolution,
  validatePartitionManifest,
};
