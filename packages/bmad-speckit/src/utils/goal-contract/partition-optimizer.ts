const { createHash } = require('node:crypto');
const {
  assertCanonicalComponentGraph,
  deriveEffectiveComponentDependencies,
} = require('./partition-components.ts');
const {
  compileExecutionProjection,
} = require('./execution-projection.ts');

export type GoalContractPartitionOptimizerModule = never;

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

function sha256(value) {
  return `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
}

function assertCanonicalExecutionProjection({
  executionProjection,
  projectionAuthority,
}) {
  if (!projectionAuthority || typeof projectionAuthority !== 'object') {
    throw failure('execution_projection_authority_missing');
  }
  const canonicalProjection = compileExecutionProjection(projectionAuthority);
  if (
    stableStringify(executionProjection) !==
    stableStringify(canonicalProjection)
  ) {
    throw failure('execution_projection_currentness_mismatch', {
      expectedExecutionProjectionHash:
        canonicalProjection.executionProjectionHash,
      actualExecutionProjectionHash:
        executionProjection?.executionProjectionHash || null,
    });
  }
  return canonicalProjection;
}

function derivePartitionId({
  sourceSnapshotHash,
  executionProjectionHash,
  partitionPolicyHash,
  primaryTraceSliceIds,
  primaryTaskIds,
  dependencyPartitionIds,
  partitionRole,
}) {
  return sha256(
    stableStringify({
      sourceSnapshotHash,
      executionProjectionHash,
      partitionPolicyHash,
      primaryTraceSliceIds: unique(primaryTraceSliceIds || []),
      primaryTaskIds: unique(primaryTaskIds || []),
      dependencyPartitionIds: unique(dependencyPartitionIds || []),
      partitionRole,
    })
  ).replace('sha256:', 'partition-');
}

function deriveCandidateId({ partitionPolicyHash, canonicalManifestSeed }) {
  return sha256(
    stableStringify({
      policyHash: partitionPolicyHash,
      seed: canonicalManifestSeed,
    })
  ).replace('sha256:', 'candidate-');
}

function unique(values) {
  return [...new Set(values)].sort();
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function canonicalGraphSeed(componentGraph) {
  return {
    components: [...componentGraph.components]
      .map((component) => ({
        componentId: component.componentId,
        traceSliceIds: unique(component.traceSliceIds || []),
        atomicTaskIds: unique(component.atomicTaskIds || []),
        sourceIds: unique(component.sourceIds || []),
        estimatedClosureMinutes: component.estimatedClosureMinutes,
        fileScopeIds: unique(component.fileScopeIds || []),
      }))
      .sort((left, right) => left.componentId.localeCompare(right.componentId)),
    dependencyEdges: [...(componentGraph.dependencyEdges || [])]
      .map((edge) => ({
        fromComponentId: edge.fromComponentId,
        toComponentId: edge.toComponentId,
        reasonCodes: unique(edge.reasonCodes || []),
      }))
      .sort((left, right) =>
        stableStringify(left).localeCompare(stableStringify(right))
      ),
    sharedArtifactOwnership: [...(componentGraph.sharedArtifactOwnership || [])]
      .map((ownership) => ({
        fileScopeId: ownership.fileScopeId,
        path: ownership.path,
        ownerComponentId: ownership.ownerComponentId,
        participatingComponentIds: unique(
          ownership.participatingComponentIds || []
        ),
      }))
      .sort((left, right) =>
        stableStringify(left).localeCompare(stableStringify(right))
      ),
    integrationFanInOwnership: [
      ...(componentGraph.integrationFanInOwnership || []),
    ]
      .map((ownership) => ({
        joinId: ownership.joinId,
        ownerComponentId: ownership.ownerComponentId,
        inputComponentIds: unique(ownership.inputComponentIds || []),
      }))
      .sort((left, right) =>
        stableStringify(left).localeCompare(stableStringify(right))
      ),
  };
}

function assertExecutionProjectionIdentity(executionProjection) {
  if (!executionProjection || typeof executionProjection !== 'object') {
    throw failure('partition_policy_compilation_identity_mismatch', {
      reason: 'execution_projection_missing',
    });
  }
  const {
    executionProjectionHash: actualExecutionProjectionHash,
    ...semanticProjection
  } = executionProjection;
  const expectedExecutionProjectionHash = sha256(
    stableStringify(semanticProjection)
  );
  if (actualExecutionProjectionHash !== expectedExecutionProjectionHash) {
    throw failure('partition_policy_compilation_identity_mismatch', {
      reason: 'execution_projection_hash_mismatch',
      expectedExecutionProjectionHash,
      actualExecutionProjectionHash,
    });
  }
  for (const [hashField, valueField] of [
    ['taskDagHash', 'taskDag'],
    ['integrationJoinGraphHash', 'integrationJoinGraph'],
  ]) {
    const value = executionProjection[valueField];
    const actualHash = executionProjection[hashField];
    if (
      !Object.hasOwn(executionProjection, hashField) ||
      !Object.hasOwn(executionProjection, valueField) ||
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      typeof actualHash !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/u.test(actualHash)
    ) {
      throw failure('partition_policy_compilation_identity_mismatch', {
        reason: `${valueField}_authority_invalid`,
        hashField,
        valueField,
      });
    }
    const expectedHash = sha256(stableStringify(value));
    if (actualHash !== expectedHash) {
      throw failure('partition_policy_compilation_identity_mismatch', {
        reason: `${hashField}_mismatch`,
        expectedHash,
        actualHash,
      });
    }
  }
}

function expectedComponentProjectionSemantic({
  component,
  executionProjection,
  sliceById,
  taskById,
}) {
  const traceSliceIds = unique(component.traceSliceIds || []);
  const slices = traceSliceIds.map((sliceId) => sliceById.get(sliceId));
  const atomicTaskIds = unique(
    slices.flatMap((slice) => slice?.taskIds || [])
  );
  const taskIdSet = new Set(atomicTaskIds);
  const sourceIds = unique(slices.flatMap((slice) => slice?.sourceIds || []));
  const completionPredicateIds = unique(
    slices.flatMap((slice) => slice?.completionPredicateIds || [])
  );
  const evidenceContractIds = unique(
    slices.flatMap((slice) => slice?.evidenceContractIds || [])
  );
  const sequenceConstraintIds = unique(
    slices.flatMap((slice) => slice?.sequenceConstraintIds || [])
  );
  const productionEntryIds = unique(
    (executionProjection.productionEntryIndex || [])
      .filter((entry) =>
        (entry.taskIds || []).some((taskId) => taskIdSet.has(taskId))
      )
      .map((entry) => entry.productionEntryId)
  );
  const fileScopeIds = unique(
    (executionProjection.fileScopeIndex || [])
      .filter((entry) =>
        (entry.taskIds || []).some((taskId) => taskIdSet.has(taskId))
      )
      .map((entry) => entry.fileScopeId)
  );
  let declaredTaskMinutes = 0;
  let derivedTaskMinutes = 0;
  let derivedTaskCount = 0;
  for (const taskId of atomicTaskIds) {
    const task = taskById.get(taskId);
    if (
      Number.isInteger(task?.estimatedClosureMinutes) &&
      task.estimatedClosureMinutes > 0
    ) {
      declaredTaskMinutes += task.estimatedClosureMinutes;
      continue;
    }
    derivedTaskCount += 1;
    derivedTaskMinutes +=
      30 +
      (task?.dependencyIds?.length || 0) * 5 +
      (task?.sequenceConstraintIds?.length || 0) * 5;
  }
  const verificationMinutes =
    derivedTaskCount === 0
      ? 0
      : completionPredicateIds.length * 5 +
        evidenceContractIds.length * 5;
  const coordinationMinutes =
    derivedTaskCount === 0
      ? 0
      : fileScopeIds.length * 3 +
        productionEntryIds.length * 5 +
        sequenceConstraintIds.length * 5;
  const totalMinutes =
    declaredTaskMinutes +
    derivedTaskMinutes +
    verificationMinutes +
    coordinationMinutes;
  return {
    atomicTaskIds,
    sourceIds,
    completionPredicateIds,
    evidenceContractIds,
    sequenceConstraintIds,
    productionEntryIds,
    fileScopeIds,
    verificationOnly: slices.every(
      (slice) => slice?.verificationOnly === true
    ),
    estimatedClosureMinutes: totalMinutes,
    closureMinuteBreakdown: {
      declaredTaskMinutes,
      derivedTaskMinutes,
      verificationMinutes,
      coordinationMinutes,
      totalMinutes,
    },
  };
}

function assertComponentProjectionSemantics({
  componentGraph,
  executionProjection,
}) {
  const slices = executionProjection.traceSlices || [];
  const tasks = executionProjection.atomicTasks || [];
  const sliceById = new Map(
    slices.map((slice) => [slice.sliceId, slice] as const)
  );
  const taskById = new Map(
    tasks.map((task) => [task.taskId, task] as const)
  );
  for (const component of componentGraph.components || []) {
    const expected = expectedComponentProjectionSemantic({
      component,
      executionProjection,
      sliceById,
      taskById,
    });
    const actual = {
      atomicTaskIds: unique(component.atomicTaskIds || []),
      sourceIds: unique(component.sourceIds || []),
      completionPredicateIds: unique(
        component.completionPredicateIds || []
      ),
      evidenceContractIds: unique(component.evidenceContractIds || []),
      sequenceConstraintIds: unique(
        component.sequenceConstraintIds || []
      ),
      productionEntryIds: unique(component.productionEntryIds || []),
      fileScopeIds: unique(component.fileScopeIds || []),
      verificationOnly: component.verificationOnly === true,
      estimatedClosureMinutes: component.estimatedClosureMinutes,
      closureMinuteBreakdown: component.closureMinuteBreakdown,
    };
    const hasDuplicateSemanticIds = [
      'atomicTaskIds',
      'sourceIds',
      'completionPredicateIds',
      'evidenceContractIds',
      'sequenceConstraintIds',
      'productionEntryIds',
      'fileScopeIds',
    ].some(
      (field) =>
        (component[field] || []).length !== actual[field].length
    );
    if (
      hasDuplicateSemanticIds ||
      stableStringify(actual) !== stableStringify(expected)
    ) {
      throw failure('partition_policy_compilation_identity_mismatch', {
        reason: 'component_projection_semantic_mismatch',
        componentId: component.componentId,
        expected,
        actual,
      });
    }
  }
}

function assertOptimizerInputs({
  componentGraph,
  executionProjection,
  policyBinding,
  projectionAuthority,
}) {
  assertExecutionProjectionIdentity(executionProjection);
  const requiresProjectionAuthority = Object.hasOwn(
    executionProjection,
    'traceGraphHash'
  );
  if (requiresProjectionAuthority && !projectionAuthority) {
    throw failure('partition_policy_compilation_identity_mismatch', {
      reason: 'execution_projection_authority_missing',
    });
  }
  if (projectionAuthority) {
    try {
      assertCanonicalExecutionProjection({
        executionProjection,
        projectionAuthority,
      });
    } catch (error) {
      throw failure('partition_policy_compilation_identity_mismatch', {
        reason: error.failureClass,
        causeFailureClass: error.failureClass,
      });
    }
  }
  const mismatchedFields = [
    'sourceSnapshotHash',
    'semanticModelHash',
    'executionProjectionHash',
  ].filter(
    (field) => policyBinding?.[field] !== executionProjection?.[field]
  );
  if (
    componentGraph?.executionProjectionHash !==
    executionProjection?.executionProjectionHash
  ) {
    mismatchedFields.push('componentGraph.executionProjectionHash');
  }
  if (mismatchedFields.length > 0) {
    throw failure('partition_policy_compilation_identity_mismatch', {
      mismatchedFields,
      expected: Object.fromEntries(
        ['sourceSnapshotHash', 'semanticModelHash', 'executionProjectionHash'].map(
          (field) => [field, executionProjection?.[field]]
        )
      ),
      actual: Object.fromEntries(
        ['sourceSnapshotHash', 'semanticModelHash', 'executionProjectionHash'].map(
          (field) => [field, policyBinding?.[field]]
        )
      ),
    });
  }
  const policy = policyBinding.policy;
  const expectedPartitionPolicyHash = sha256(stableStringify(policy));
  if (policyBinding.partitionPolicyHash !== expectedPartitionPolicyHash) {
    throw failure('partition_policy_compilation_identity_mismatch', {
      reason: 'partition_policy_hash_mismatch',
      expectedPartitionPolicyHash,
      actualPartitionPolicyHash: policyBinding.partitionPolicyHash,
    });
  }
  const target = policy?.limits?.targetClosureMinutesPerPartition;
  const maximum = policy?.limits?.maxClosureMinutesPerPartition;
  if (
    !Number.isInteger(target?.min) ||
    !Number.isInteger(target?.max) ||
    !Number.isInteger(maximum) ||
    target.min > target.max ||
    target.max > maximum ||
    maximum > 240
  ) {
    throw failure('partition_policy_binding_mismatch');
  }
  assertCanonicalComponentGraph({
    componentGraph,
    executionProjection,
    policy,
  });

  const sliceOwners = new Map();
  const taskOwners = new Map();
  for (const component of componentGraph.components || []) {
    if (
      Object.hasOwn(component, 'partitionRole') ||
      Object.hasOwn(component, 'finalIntegration')
    ) {
      throw failure('partition_role_authority_override_forbidden');
    }
    if (
      !Number.isInteger(component.estimatedClosureMinutes) ||
      component.estimatedClosureMinutes < 1
    ) {
      throw failure('partition_no_independent_closure', {
        componentId: component.componentId,
      });
    }
    if (component.closureMinuteBreakdown) {
      const breakdown = component.closureMinuteBreakdown;
      const minuteFields = [
        'declaredTaskMinutes',
        'derivedTaskMinutes',
        'verificationMinutes',
        'coordinationMinutes',
        'totalMinutes',
      ];
      const validMinutes = minuteFields.every(
        (field) => Number.isInteger(breakdown[field]) && breakdown[field] >= 0
      );
      const expectedTotal =
        breakdown.declaredTaskMinutes +
        breakdown.derivedTaskMinutes +
        breakdown.verificationMinutes +
        breakdown.coordinationMinutes;
      if (
        !validMinutes ||
        breakdown.totalMinutes !== expectedTotal ||
        component.estimatedClosureMinutes !== breakdown.totalMinutes
      ) {
        throw failure('partition_no_independent_closure', {
          reason: 'closure_minute_breakdown_mismatch',
          componentId: component.componentId,
          estimatedClosureMinutes: component.estimatedClosureMinutes,
          closureMinuteBreakdown: breakdown,
        });
      }
    }
    if (
      (component.completionPredicateIds || []).length === 0 ||
      (component.evidenceContractIds || []).length === 0
    ) {
      throw failure('partition_no_independent_closure', {
        componentId: component.componentId,
      });
    }
    for (const sliceId of component.traceSliceIds || []) {
      if (sliceOwners.has(sliceId)) {
        throw failure('partition_atomic_component_split', {
          sliceId,
          componentIds: [sliceOwners.get(sliceId), component.componentId],
        });
      }
      sliceOwners.set(sliceId, component.componentId);
    }
    for (const taskId of component.atomicTaskIds || []) {
      if (taskOwners.has(taskId)) {
        throw failure('partition_duplicate_primary_owner', {
          taskId,
          componentIds: [taskOwners.get(taskId), component.componentId],
        });
      }
      taskOwners.set(taskId, component.componentId);
    }
  }
  for (const component of componentGraph.components || []) {
    const componentTaskIds = new Set(component.atomicTaskIds || []);
    const expectedFileScopeIds = unique(
      (executionProjection.fileScopeIndex || [])
        .filter((entry) =>
          (entry.taskIds || []).some((taskId) => componentTaskIds.has(taskId))
        )
        .map((entry) => entry.fileScopeId)
    );
    const actualFileScopeIds = component.fileScopeIds || [];
    if (
      new Set(actualFileScopeIds).size !== actualFileScopeIds.length ||
      stableStringify(unique(actualFileScopeIds)) !==
        stableStringify(expectedFileScopeIds)
    ) {
      throw failure('partition_policy_compilation_identity_mismatch', {
        reason: 'component_file_scope_projection_mismatch',
        componentId: component.componentId,
        expectedFileScopeIds,
        actualFileScopeIds,
      });
    }
  }
  assertComponentProjectionSemantics({
    componentGraph,
    executionProjection,
  });

  return Object.freeze({
    policy,
    effectiveDependencies: deriveEffectiveComponentDependencies(componentGraph),
  });
}

function aggregateMinuteBreakdown(components) {
  const breakdown = {
    declaredTaskMinutes: 0,
    derivedTaskMinutes: 0,
    verificationMinutes: 0,
    coordinationMinutes: 0,
    totalMinutes: 0,
  };
  for (const component of components) {
    const source = component.closureMinuteBreakdown || {
      declaredTaskMinutes: component.estimatedClosureMinutes,
      derivedTaskMinutes: 0,
      verificationMinutes: 0,
      coordinationMinutes: 0,
      totalMinutes: component.estimatedClosureMinutes,
    };
    for (const key of Object.keys(breakdown)) {
      breakdown[key] += source[key] || 0;
    }
  }
  return Object.freeze(breakdown);
}

function deriveRole(componentIds, componentGraph) {
  const finalOwners = new Set(
    (componentGraph.integrationFanInOwnership || []).map(
      (ownership) => ownership.ownerComponentId
    )
  );
  return componentIds.some((componentId) => finalOwners.has(componentId))
    ? 'final_integration'
    : 'implementation';
}

function buildCandidate({
  groups,
  orderedComponents,
  componentGraph,
  effectiveDependencies,
  executionProjection,
  policyBinding,
}) {
  const componentById = new Map(
    orderedComponents.map(
      (component) => [component.componentId, component] as const
    )
  );
  const componentToPartition = new Map();
  const partitions = groups.map((componentIds, index) => {
    for (const componentId of componentIds) {
      componentToPartition.set(componentId, index);
    }
    const components = componentIds.map((componentId) =>
      componentById.get(componentId)
    );
    const estimatedClosureMinutes = sum(
      components.map((component) => component.estimatedClosureMinutes)
    );
    const partitionRole = deriveRole(componentIds, componentGraph);
    return {
      componentIds,
      components,
      estimatedClosureMinutes,
      closureMinuteBreakdown: aggregateMinuteBreakdown(components),
      partitionRole,
    };
  });

  const partitionDependencies = partitions.map(() => new Set());
  for (const edge of effectiveDependencies) {
    const from = componentToPartition.get(edge.fromComponentId);
    const to = componentToPartition.get(edge.toComponentId);
    if (from !== to) {
      partitionDependencies[to].add(from);
    }
  }
  const crossPartitionDependencyCount = sum(
    partitionDependencies.map((dependencies) => dependencies.size)
  );

  const graphSeed = canonicalGraphSeed(componentGraph);
  const records = [];
  for (let index = 0; index < partitions.length; index += 1) {
    const partition = partitions[index];
    const predecessorIndexes = [...partitionDependencies[index]].sort(
      (left, right) => left - right
    );
    const dependencyPartitionIds = predecessorIndexes.map(
      (predecessorIndex) => records[predecessorIndex].partitionId
    );
    const primaryTraceSliceIds = unique(
      partition.components.flatMap((component) => component.traceSliceIds || [])
    );
    const primaryTaskIds = unique(
      partition.components.flatMap((component) => component.atomicTaskIds || [])
    );
    const partitionId = derivePartitionId({
      sourceSnapshotHash: executionProjection.sourceSnapshotHash,
      executionProjectionHash: executionProjection.executionProjectionHash,
      partitionPolicyHash: policyBinding.partitionPolicyHash,
      primaryTraceSliceIds,
      primaryTaskIds,
      dependencyPartitionIds,
      partitionRole: partition.partitionRole,
    });
    records.push({
      partitionId,
      primaryComponentIds: [...partition.componentIds],
      primaryTraceSliceIds,
      primaryTaskIds,
      dependencyPartitionIds,
      partitionRole: partition.partitionRole,
      partitionRoleDerived: true,
      estimatedClosureMinutes: partition.estimatedClosureMinutes,
      closureMinuteBreakdown: partition.closureMinuteBreakdown,
      primaryWriteScopeOwnerCount: unique(
        partition.components.flatMap((component) => component.fileScopeIds || [])
      ).length,
    });
  }
  return {
    partitions: records,
    crossPartitionDependencyCount,
    canonicalManifestSeed: {
      graphSeed,
      partitions: records.map((record) => ({
        primaryComponentIds: record.primaryComponentIds,
        dependencyPartitionIds: record.dependencyPartitionIds,
        partitionRole: record.partitionRole,
      })),
    },
  };
}

function deriveCandidateMembershipState({
  candidate,
  componentGraph,
  executionProjection,
}) {
  const components = componentGraph.components || [];
  const componentById = new Map(
    components.map((component) => [component.componentId, component] as const)
  );
  const projectionSlices = executionProjection?.traceSlices || [];
  const projectionTasks = executionProjection?.atomicTasks || [];
  const projectionSliceById = new Map<
    string,
    { taskIds?: string[] }
  >(
    projectionSlices.map(
      (slice) =>
        [slice.sliceId, slice] as [string, { taskIds?: string[] }]
    )
  );
  const projectionTaskById = new Map<
    string,
    { ownerSliceId?: string }
  >(
    projectionTasks.map(
      (task) =>
        [task.taskId, task] as [string, { ownerSliceId?: string }]
    )
  );
  const graphTraceSliceIds = unique(
    components.flatMap((component) => component.traceSliceIds || [])
  );
  const graphTaskIds = unique(
    components.flatMap((component) => component.atomicTaskIds || [])
  );
  if (
    projectionSliceById.size !== projectionSlices.length ||
    stableStringify(graphTraceSliceIds) !==
      stableStringify(unique(projectionSliceById.keys()))
  ) {
    throw failure('partition_no_valid_solution', {
      reason: 'candidate_trace_slice_projection_mismatch',
    });
  }
  if (
    projectionTaskById.size !== projectionTasks.length ||
    stableStringify(graphTaskIds) !==
      stableStringify(unique(projectionTaskById.keys()))
  ) {
    throw failure('partition_no_valid_solution', {
      reason: 'candidate_atomic_task_projection_mismatch',
    });
  }

  for (const component of components) {
    const componentTraceSliceIds = new Set<string>(
      (component.traceSliceIds || []) as string[]
    );
    const componentTaskIds = new Set<string>(
      (component.atomicTaskIds || []) as string[]
    );
    for (const traceSliceId of componentTraceSliceIds) {
      const traceSlice = projectionSliceById.get(traceSliceId);
      if (
        !traceSlice ||
        (traceSlice.taskIds || []).some((taskId) => !componentTaskIds.has(taskId))
      ) {
        throw failure('partition_no_valid_solution', {
          reason: 'candidate_component_projection_mismatch',
          componentId: component.componentId,
          traceSliceId,
        });
      }
    }
    for (const taskId of componentTaskIds) {
      const task = projectionTaskById.get(taskId);
      if (
        !task ||
        (task.ownerSliceId && !componentTraceSliceIds.has(task.ownerSliceId))
      ) {
        throw failure('partition_no_valid_solution', {
          reason: 'candidate_component_projection_mismatch',
          componentId: component.componentId,
          taskId,
        });
      }
    }
  }

  if (!Array.isArray(candidate.partitions) || candidate.partitions.length === 0) {
    throw failure('partition_no_valid_solution', {
      reason: 'candidate_component_coverage_mismatch',
    });
  }
  const partitionByComponent = new Map<string, number>();
  for (let index = 0; index < candidate.partitions.length; index += 1) {
    const componentIds = candidate.partitions[index].primaryComponentIds;
    if (
      !Array.isArray(componentIds) ||
      componentIds.length === 0 ||
      new Set(componentIds).size !== componentIds.length
    ) {
      throw failure('partition_no_valid_solution', {
        reason: 'candidate_component_coverage_mismatch',
      });
    }
    for (const componentId of componentIds) {
      if (
        !componentById.has(componentId) ||
        partitionByComponent.has(componentId)
      ) {
        throw failure('partition_no_valid_solution', {
          reason: 'candidate_component_coverage_mismatch',
          componentId,
        });
      }
      partitionByComponent.set(componentId, index);
    }
  }
  if (partitionByComponent.size !== componentById.size) {
    throw failure('partition_no_valid_solution', {
      reason: 'candidate_component_coverage_mismatch',
    });
  }

  const expectedPartitions = candidate.partitions.map((_partition, index) => {
    const primaryComponentIds = componentGraph.topologicalOrder.filter(
      (componentId) => partitionByComponent.get(componentId) === index
    );
    const partitionComponents = primaryComponentIds.map((componentId) =>
      componentById.get(componentId)
    );
    return {
      primaryComponentIds,
      primaryTraceSliceIds: unique(
        partitionComponents.flatMap((component) => component.traceSliceIds || [])
      ),
      primaryTaskIds: unique(
        partitionComponents.flatMap((component) => component.atomicTaskIds || [])
      ),
      partitionRole: deriveRole(primaryComponentIds, componentGraph),
      partitionRoleDerived: true,
      estimatedClosureMinutes: sum(
        partitionComponents.map(
          (component) => component.estimatedClosureMinutes
        )
      ),
      closureMinuteBreakdown: aggregateMinuteBreakdown(partitionComponents),
      primaryWriteScopeOwnerCount: unique(
        partitionComponents.flatMap((component) => component.fileScopeIds || [])
      ).length,
    };
  });
  return Object.freeze({ expectedPartitions, partitionByComponent });
}

function validatePartitionCandidate({
  candidate,
  componentGraph,
  executionProjection,
  policy,
  sourceSnapshotHash = executionProjection?.sourceSnapshotHash,
  partitionPolicyHash,
  effectiveDependencies = deriveEffectiveComponentDependencies(componentGraph),
}) {
  const { expectedPartitions, partitionByComponent } =
    deriveCandidateMembershipState({
      candidate,
      componentGraph,
      executionProjection,
    });
  const maximum = policy.limits.maxClosureMinutesPerPartition;
  const validFinalOwners = new Set(
    (componentGraph.integrationFanInOwnership || []).map(
      (ownership) => ownership.ownerComponentId
    )
  );
  for (const partition of candidate.partitions || []) {
    if (partition.estimatedClosureMinutes > maximum) {
      throw failure('partition_no_valid_solution', {
        partitionId: partition.partitionId,
        estimatedClosureMinutes: partition.estimatedClosureMinutes,
        maximum,
      });
    }
    if (
      partition.primaryWriteScopeOwnerCount >
      policy.limits.maxPrimaryWriteScopeOwnersPerPartition
    ) {
      throw failure('partition_no_valid_solution', {
        partitionId: partition.partitionId,
        reason: 'primary_write_scope_owner_limit_exceeded',
      });
    }
    if (partition.partitionRole === 'final_integration') {
      const justified = (partition.primaryComponentIds || []).some(
        (componentId) => validFinalOwners.has(componentId)
      );
      if (!justified) {
        throw failure('partition_final_integration_not_required', {
          partitionId: partition.partitionId,
        });
      }
    }
  }
  const expectedDependencyIndexes: Set<number>[] = candidate.partitions.map(
    () => new Set<number>()
  );
  for (const edge of effectiveDependencies) {
    const predecessorIndex = partitionByComponent.get(edge.fromComponentId);
    const dependentIndex = partitionByComponent.get(edge.toComponentId);
    if (
      !Number.isInteger(predecessorIndex) ||
      !Number.isInteger(dependentIndex)
    ) {
      throw failure('partition_atomic_component_split', {
        fromComponentId: edge.fromComponentId,
        toComponentId: edge.toComponentId,
      });
    }
    if (predecessorIndex > dependentIndex) {
      throw failure('partition_future_dependency', {
        reason: edge.authorityCodes.includes('shared_artifact_owner')
          ? 'shared_artifact_owner_after_consumer'
          : 'future_implementation_dependency',
        fromComponentId: edge.fromComponentId,
        toComponentId: edge.toComponentId,
      });
    }
    if (predecessorIndex !== dependentIndex) {
      expectedDependencyIndexes[dependentIndex].add(predecessorIndex);
    }
  }
  for (let index = 0; index < candidate.partitions.length; index += 1) {
    const actual = candidate.partitions[index];
    const expected = expectedPartitions[index];
    for (const field of [
      'primaryComponentIds',
      'primaryTraceSliceIds',
      'primaryTaskIds',
      'partitionRole',
      'partitionRoleDerived',
      'estimatedClosureMinutes',
      'closureMinuteBreakdown',
      'primaryWriteScopeOwnerCount',
    ]) {
      if (stableStringify(actual[field]) !== stableStringify(expected[field])) {
        throw failure('partition_no_valid_solution', {
          reason: 'candidate_partition_membership_mismatch',
          partitionId: actual.partitionId,
          field,
          expected: expected[field],
          actual: actual[field],
        });
      }
    }
  }
  const expectedPartitionIds = [];
  const expectedDependencyPartitionIdsByPartition = [];
  for (let index = 0; index < candidate.partitions.length; index += 1) {
    const expectedDependencyPartitionIds = [
      ...expectedDependencyIndexes[index],
    ]
      .sort((left, right) => left - right)
      .map((predecessorIndex) => expectedPartitionIds[predecessorIndex]);
    expectedDependencyPartitionIdsByPartition.push(
      expectedDependencyPartitionIds
    );
    const actualDependencyPartitionIds =
      candidate.partitions[index].dependencyPartitionIds;
    if (
      !Array.isArray(actualDependencyPartitionIds) ||
      stableStringify(actualDependencyPartitionIds) !==
        stableStringify(expectedDependencyPartitionIds)
    ) {
      throw failure('partition_no_valid_solution', {
        partitionId: candidate.partitions[index].partitionId,
        reason: 'partition_dependency_set_mismatch',
        expectedDependencyPartitionIds,
        actualDependencyPartitionIds,
      });
    }
    const expectedPartitionId = derivePartitionId({
      sourceSnapshotHash,
      executionProjectionHash: executionProjection.executionProjectionHash,
      partitionPolicyHash,
      primaryTraceSliceIds: expectedPartitions[index].primaryTraceSliceIds,
      primaryTaskIds: expectedPartitions[index].primaryTaskIds,
      dependencyPartitionIds: expectedDependencyPartitionIds,
      partitionRole: expectedPartitions[index].partitionRole,
    });
    expectedPartitionIds.push(expectedPartitionId);
    if (candidate.partitions[index].partitionId !== expectedPartitionId) {
      throw failure('partition_no_valid_solution', {
        partitionId: candidate.partitions[index].partitionId,
        reason: 'partition_id_mismatch',
        expectedPartitionId,
      });
    }
  }
  const expectedCanonicalManifestSeed = {
    graphSeed: canonicalGraphSeed(componentGraph),
    partitions: expectedPartitions.map((partition, index) => ({
      primaryComponentIds: partition.primaryComponentIds,
      dependencyPartitionIds:
        expectedDependencyPartitionIdsByPartition[index],
      partitionRole: partition.partitionRole,
    })),
  };
  if (
    stableStringify(candidate.canonicalManifestSeed) !==
    stableStringify(expectedCanonicalManifestSeed)
  ) {
    throw failure('partition_no_valid_solution', {
      reason: 'candidate_manifest_seed_mismatch',
    });
  }
  const expectedCandidateId = deriveCandidateId({
    partitionPolicyHash,
    canonicalManifestSeed: expectedCanonicalManifestSeed,
  });
  if (candidate.candidateId !== expectedCandidateId) {
    throw failure('partition_no_valid_solution', {
      reason: 'candidate_id_mismatch',
      expectedCandidateId,
      actualCandidateId: candidate.candidateId,
    });
  }
  const expectedCrossPartitionDependencyCount = sum(
    expectedDependencyIndexes.map((dependencies) => dependencies.size)
  );
  if (
    candidate.crossPartitionDependencyCount !==
    expectedCrossPartitionDependencyCount
  ) {
    throw failure('partition_no_valid_solution', {
      reason: 'cross_partition_dependency_count_mismatch',
      expectedCrossPartitionDependencyCount,
      actualCrossPartitionDependencyCount:
        candidate.crossPartitionDependencyCount,
    });
  }
  if (
    expectedCrossPartitionDependencyCount >
    policy.limits.maxCrossPartitionDependencies
  ) {
    throw failure('partition_no_valid_solution', {
      reason: 'cross_partition_dependency_limit_exceeded',
    });
  }
  const metrics = deriveCandidateMetrics(
    candidate,
    componentGraph,
    effectiveDependencies
  );
  if (
    candidate.compatibilityReceiptRequirementCount !==
    metrics.compatibilityReceiptRequirementCount
  ) {
    throw failure('partition_no_valid_solution', {
      reason: 'compatibility_requirement_count_mismatch',
      expectedCompatibilityReceiptRequirementCount:
        metrics.compatibilityReceiptRequirementCount,
      actualCompatibilityReceiptRequirementCount:
        candidate.compatibilityReceiptRequirementCount,
    });
  }
  return Object.freeze({ decision: 'pass' });
}

function deriveCandidateMetrics(
  candidate,
  componentGraph,
  effectiveDependencies = deriveEffectiveComponentDependencies(componentGraph)
) {
  const componentById = new Map<
    string,
    { estimatedClosureMinutes: number; sourceIds?: unknown[] }
  >(
    componentGraph.components.map(
      (component) =>
        [component.componentId, component] as [
          string,
          { estimatedClosureMinutes: number; sourceIds?: unknown[] },
        ]
    )
  );
  const partitionByComponent = new Map<string, number>();
  for (let index = 0; index < candidate.partitions.length; index += 1) {
    for (const componentId of candidate.partitions[index].primaryComponentIds) {
      if (
        !componentById.has(componentId) ||
        partitionByComponent.has(componentId)
      ) {
        throw failure('partition_no_valid_solution', {
          reason: 'candidate_component_coverage_mismatch',
          componentId,
        });
      }
      partitionByComponent.set(componentId, index);
    }
  }
  if (partitionByComponent.size !== componentById.size) {
    throw failure('partition_no_valid_solution', {
      reason: 'candidate_component_coverage_mismatch',
    });
  }

  const partitionDependencies = candidate.partitions.map(() => new Set());
  for (const edge of effectiveDependencies) {
    const predecessorIndex = partitionByComponent.get(edge.fromComponentId);
    const dependentIndex = partitionByComponent.get(edge.toComponentId);
    if (
      !Number.isInteger(predecessorIndex) ||
      !Number.isInteger(dependentIndex)
    ) {
      throw failure('partition_no_valid_solution', {
        reason: 'candidate_component_coverage_mismatch',
      });
    }
    if (predecessorIndex !== dependentIndex) {
      partitionDependencies[dependentIndex].add(predecessorIndex);
    }
  }

  let sharedFileChurnUnits = 0;
  let compatibilityReceiptRequirementCount = 0;
  for (const ownership of componentGraph.sharedArtifactOwnership || []) {
    const partitionIndexes = unique(
      (ownership.participatingComponentIds || [])
        .map((componentId) => partitionByComponent.get(componentId))
        .filter((index) => Number.isInteger(index))
    );
    if (partitionIndexes.length > 1) {
      sharedFileChurnUnits += partitionIndexes.length - 1;
      compatibilityReceiptRequirementCount += partitionIndexes.length - 1;
    }
  }
  const partitionMinutes = candidate.partitions.map((partition) =>
    sum(
      partition.primaryComponentIds.map(
        (componentId) => componentById.get(componentId).estimatedClosureMinutes
      )
    )
  );
  const sourceBoundaryViolationUnits = sum(
    candidate.partitions.map((partition) => {
      const sourceIds = unique(
        partition.primaryComponentIds.flatMap(
          (componentId) => componentById.get(componentId)?.sourceIds || []
        )
      );
      return Math.max(0, sourceIds.length - 1);
    })
  );
  const finalOwners = new Set(
    (componentGraph.integrationFanInOwnership || []).map(
      (ownership) => ownership.ownerComponentId
    )
  );
  return {
    compatibilityReceiptRequirementCount,
    crossPartitionDependencyCount: sum(
      partitionDependencies.map((dependencies) => dependencies.size)
    ),
    cohesionUnits: sum(
      candidate.partitions.map((partition) =>
        Math.max(0, partition.primaryComponentIds.length - 1)
      )
    ),
    finalIntegrationCount: candidate.partitions.filter((partition) =>
      partition.primaryComponentIds.some((componentId) =>
        finalOwners.has(componentId)
      )
    ).length,
    partitionMinutes,
    sharedFileChurnUnits,
    sourceBoundaryViolationUnits,
  };
}

function scoreCandidate(
  candidate,
  componentGraph,
  policy,
  effectiveDependencies = deriveEffectiveComponentDependencies(componentGraph),
  metrics = deriveCandidateMetrics(
    candidate,
    componentGraph,
    effectiveDependencies
  )
) {
  const target = policy.limits.targetClosureMinutesPerPartition;
  const closureDistance = sum(
    metrics.partitionMinutes.map((minutes) => {
      if (minutes < target.min) return target.min - minutes;
      if (minutes > target.max) return minutes - target.max;
      return 0;
    })
  );
  const imbalance =
    metrics.partitionMinutes.length < 2
      ? 0
      : Math.max(...metrics.partitionMinutes) -
        Math.min(...metrics.partitionMinutes);
  const breakdown = {
    dependencyCutCost:
      metrics.crossPartitionDependencyCount * policy.weights.dependencyCut,
    sharedFileChurnCost:
      metrics.sharedFileChurnUnits * policy.weights.sharedFileChurn,
    auditOverheadCost:
      candidate.partitions.length * policy.weights.auditOverhead,
    closureFragmentationCost:
      closureDistance * policy.weights.closureFragmentation,
    effortImbalanceCost: imbalance * policy.weights.effortImbalance,
    sourceBoundaryViolationCost:
      metrics.sourceBoundaryViolationUnits *
      policy.weights.sourceBoundaryViolation,
    finalIntegrationCost:
      metrics.finalIntegrationCount * policy.weights.finalIntegration,
    semanticCohesionBenefit:
      metrics.cohesionUnits * policy.weights.semanticCohesionBenefit,
    evidenceLocalityBenefit:
      metrics.cohesionUnits * policy.weights.evidenceLocalityBenefit,
  };
  const total =
    breakdown.dependencyCutCost +
    breakdown.sharedFileChurnCost +
    breakdown.auditOverheadCost +
    breakdown.closureFragmentationCost +
    breakdown.effortImbalanceCost +
    breakdown.sourceBoundaryViolationCost +
    breakdown.finalIntegrationCost -
    breakdown.semanticCohesionBenefit -
    breakdown.evidenceLocalityBenefit;
  return Object.freeze({ total, breakdown: Object.freeze(breakdown) });
}

function canonicalizeCandidateForSelection({
  candidate,
  componentGraph,
  policy,
  effectiveDependencies = deriveEffectiveComponentDependencies(componentGraph),
}) {
  const metrics = deriveCandidateMetrics(
    candidate,
    componentGraph,
    effectiveDependencies
  );
  return Object.freeze({
    ...candidate,
    crossPartitionDependencyCount: metrics.crossPartitionDependencyCount,
    compatibilityReceiptRequirementCount:
      metrics.compatibilityReceiptRequirementCount,
    score: scoreCandidate(
      candidate,
      componentGraph,
      policy,
      effectiveDependencies,
      metrics
    ),
  });
}

function predecessorMap(componentGraph, effectiveDependencies) {
  const predecessors: Map<string, Set<string>> = new Map(
    componentGraph.components.map((component) => [
      component.componentId,
      new Set(),
    ])
  );
  for (const edge of effectiveDependencies) {
    predecessors.get(edge.toComponentId)!.add(edge.fromComponentId);
  }
  return predecessors;
}

function enumerateNextClosedGroups({
  assignedComponentIds,
  componentGraph,
  effectiveDependencies,
  maximumClosureMinutes,
}) {
  const assigned = new Set(assignedComponentIds);
  const orderedIds: string[] = componentGraph.topologicalOrder;
  const components = new Map<string, { estimatedClosureMinutes: number }>(
    componentGraph.components.map(
      (component) =>
        [component.componentId, component] as [
          string,
          { estimatedClosureMinutes: number },
        ]
    )
  );
  const predecessors = predecessorMap(componentGraph, effectiveDependencies);
  const anchor = orderedIds.find(
    (componentId) =>
      !assigned.has(componentId) &&
      [...predecessors.get(componentId)!].every((dependencyId) =>
        assigned.has(dependencyId)
      )
  );
  if (!anchor) return [];
  const groups = [];

  function visit(index, selected, closureMinutes) {
    if (index === orderedIds.length) {
      if (selected.has(anchor)) {
        groups.push(orderedIds.filter((componentId) => selected.has(componentId)));
      }
      return;
    }
    const componentId = orderedIds[index];
    if (assigned.has(componentId)) {
      visit(index + 1, selected, closureMinutes);
      return;
    }
    if (componentId !== anchor) {
      visit(index + 1, selected, closureMinutes);
    }
    const component = components.get(componentId)!;
    const nextMinutes = closureMinutes + component.estimatedClosureMinutes;
    const dependenciesClosed = [...predecessors.get(componentId)!].every(
      (dependencyId) => assigned.has(dependencyId) || selected.has(dependencyId)
    );
    if (dependenciesClosed && nextMinutes <= maximumClosureMinutes) {
      const nextSelected = new Set(selected);
      nextSelected.add(componentId);
      visit(index + 1, nextSelected, nextMinutes);
    }
  }

  visit(0, new Set(), 0);
  return groups.sort((left, right) =>
    stableStringify(left).localeCompare(stableStringify(right))
  );
}

function compareCandidates(left, right) {
  const keys = [
    [left.score.total, right.score.total],
    [left.partitions.length, right.partitions.length],
    [left.crossPartitionDependencyCount, right.crossPartitionDependencyCount],
    [
      left.compatibilityReceiptRequirementCount,
      right.compatibilityReceiptRequirementCount,
    ],
    [
      stableStringify(
        left.partitions.map((partition) => partition.primaryTraceSliceIds)
      ),
      stableStringify(
        right.partitions.map((partition) => partition.primaryTraceSliceIds)
      ),
    ],
    [
      stableStringify(left.canonicalManifestSeed),
      stableStringify(right.canonicalManifestSeed),
    ],
  ];
  for (const [leftValue, rightValue] of keys) {
    if (leftValue < rightValue) return -1;
    if (leftValue > rightValue) return 1;
  }
  return 0;
}

function optimizePartitions({
  componentGraph,
  executionProjection,
  policyBinding,
  projectionAuthority,
}) {
  const { policy, effectiveDependencies } = assertOptimizerInputs({
    componentGraph,
    executionProjection,
    policyBinding,
    projectionAuthority,
  });
  const componentById = new Map(
    componentGraph.components.map(
      (component) => [component.componentId, component] as const
    )
  );
  const orderedComponents = componentGraph.topologicalOrder.map((componentId) =>
    componentById.get(componentId)
  );
  const maximum = policy.limits.maxClosureMinutesPerPartition;
  const validCandidates = [];
  const rejectedCandidateSummaries = [];
  let candidateCount = 0;
  let frontierCount = 0;
  let searchStates = 0;

  function visit(assignedComponentIds, groups) {
    searchStates += 1;
    if (searchStates > policy.limits.maxSearchStates) {
      throw failure('partition_policy_unsatisfied', {
        reason: 'search_state_limit_exceeded',
        searchStates,
        maximum: policy.limits.maxSearchStates,
      });
    }
    if (assignedComponentIds.size === orderedComponents.length) {
      candidateCount += 1;
      const baseCandidate = buildCandidate({
        groups,
        orderedComponents,
        componentGraph,
        effectiveDependencies,
        executionProjection,
        policyBinding,
      });
      const candidate = {
        ...baseCandidate,
        compatibilityReceiptRequirementCount: deriveCandidateMetrics(
          baseCandidate,
          componentGraph
        ).compatibilityReceiptRequirementCount,
        candidateId: deriveCandidateId({
          partitionPolicyHash: policyBinding.partitionPolicyHash,
          canonicalManifestSeed: baseCandidate.canonicalManifestSeed,
        }),
      };
      try {
        validatePartitionCandidate({
          candidate,
          componentGraph,
          executionProjection,
          policy,
          sourceSnapshotHash: executionProjection.sourceSnapshotHash,
          partitionPolicyHash: policyBinding.partitionPolicyHash,
          effectiveDependencies,
        });
        validCandidates.push(
          canonicalizeCandidateForSelection({
            candidate,
            componentGraph,
            policy,
            effectiveDependencies,
          })
        );
      } catch (error) {
        if (
          error.failureClass !== 'partition_no_valid_solution' &&
          error.failureClass !== 'partition_final_integration_not_required'
        ) {
          throw error;
        }
        rejectedCandidateSummaries.push(
          Object.freeze({
            candidateId: candidate.candidateId,
            failureClass: error.failureClass,
            reason: error.reason || error.failureClass,
            partitionCount: candidate.partitions.length,
            partitionIds: candidate.partitions.map(
              (partition) => partition.partitionId
            ),
          })
        );
      }
      return;
    }

    const nextGroups = enumerateNextClosedGroups({
      assignedComponentIds,
      componentGraph,
      effectiveDependencies,
      maximumClosureMinutes: maximum,
    });
    for (const nextGroup of nextGroups) {
      frontierCount += 1;
      if (frontierCount > policy.limits.maxCandidateFrontiers) {
        throw failure('partition_policy_unsatisfied', {
          reason: 'candidate_frontier_limit_exceeded',
          frontierCount,
          maximum: policy.limits.maxCandidateFrontiers,
        });
      }
      visit(
        new Set([...assignedComponentIds, ...nextGroup]),
        [...groups, nextGroup]
      );
    }
  }

  visit(new Set(), []);
  if (validCandidates.length === 0) {
    throw failure('partition_no_valid_solution', {
      candidateCount,
      rejectedCandidateSummaries,
    });
  }
  validCandidates.sort(compareCandidates);
  if (
    validCandidates.length > 1 &&
    compareCandidates(validCandidates[0], validCandidates[1]) === 0 &&
    stableStringify(validCandidates[0]) !== stableStringify(validCandidates[1])
  ) {
    throw failure('partition_candidate_selection_nondeterministic');
  }
  const selected = validCandidates[0];
  const candidates = validCandidates.map((candidate, index) =>
    Object.freeze({
      ...candidate,
      selected: index === 0,
    })
  );
  return Object.freeze({
    schemaVersion: 'goal-contract-partition-optimization/v1',
    optimizerVersion: 'goal-contract-partition-optimizer/v1',
    decision: 'selected',
    sourceSnapshotHash: executionProjection.sourceSnapshotHash,
    semanticModelHash: executionProjection.semanticModelHash,
    executionProjectionHash: executionProjection.executionProjectionHash,
    partitionPolicyHash: policyBinding.partitionPolicyHash,
    selectedCandidateId: selected.candidateId,
    partitionCount: selected.partitions.length,
    partitions: selected.partitions.map((partition) => Object.freeze(partition)),
    topologicalOrder: selected.partitions.map(
      (partition) => partition.partitionId
    ),
    candidates,
    rejectedCandidateSummaries: Object.freeze(rejectedCandidateSummaries),
    searchReceipt: Object.freeze({
      searchStates,
      frontierCount,
      candidateCount,
      validCandidateCount: candidates.length,
      rejectedCandidateCount: rejectedCandidateSummaries.length,
      maxSearchStates: policy.limits.maxSearchStates,
      maxCandidateFrontiers: policy.limits.maxCandidateFrontiers,
    }),
  });
}

module.exports = {
  assertCanonicalExecutionProjection,
  canonicalizeCandidateForSelection,
  compareCandidates,
  deriveCandidateId,
  derivePartitionId,
  enumerateNextClosedGroups,
  optimizePartitions,
  validatePartitionCandidate,
};
