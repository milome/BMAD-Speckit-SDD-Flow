const { createHash } = require('node:crypto');

export type GoalContractPartitionComponentsModule = never;

const ALLOWED_DEPENDENCY_REASONS = new Set([
  'architecture_dependency',
  'implementation_dependency',
  'integration_join',
  'repository_dependency',
  'sequence_constraint',
  'source_dependency',
]);

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
}

function compareIds(left, right) {
  return String(left).localeCompare(String(right), 'en', {
    numeric: true,
    sensitivity: 'base',
  });
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(String))].sort(compareIds);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort(compareIds)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function hashValue(value) {
  return `sha256:${createHash('sha256')
    .update(Buffer.from(stableStringify(value), 'utf8'))
    .digest('hex')}`;
}

function deriveId(prefix, value) {
  return `${prefix}-${hashValue(value).slice('sha256:'.length, 23)}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function createStableUnionFind(ids) {
  const parent = new Map(ids.map((id) => [id, id]));

  function find(id) {
    if (!parent.has(id)) {
      throw failure('partition_unknown_dependency', { traceSliceId: id });
    }
    const current = parent.get(id);
    if (current !== id) parent.set(id, find(current));
    return parent.get(id);
  }

  function merge(left, right) {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    const [root, child] = [leftRoot, rightRoot].sort(compareIds);
    parent.set(child, root);
  }

  return { find, merge };
}

function validateExecutionProjectionForPartitioning(executionProjection) {
  if (
    executionProjection?.schemaVersion !== 'goal-contract-execution-projection/v1' ||
    !Array.isArray(executionProjection.traceSlices) ||
    !Array.isArray(executionProjection.atomicTasks) ||
    !Array.isArray(executionProjection.taskDag?.nodes) ||
    !Array.isArray(executionProjection.taskDag?.edges)
  ) {
    throw failure('partition_execution_projection_invalid');
  }
  const sliceMap = new Map();
  for (const slice of executionProjection.traceSlices) {
    if (!slice?.sliceId || sliceMap.has(slice.sliceId)) {
      throw failure('partition_execution_projection_invalid', {
        duplicateSliceId: slice?.sliceId || null,
      });
    }
    sliceMap.set(slice.sliceId, slice);
  }
  const taskMap = new Map();
  for (const task of executionProjection.atomicTasks) {
    if (!task?.taskId || taskMap.has(task.taskId) || !sliceMap.has(task.ownerSliceId)) {
      throw failure('partition_unknown_dependency', {
        taskId: task?.taskId || null,
        ownerSliceId: task?.ownerSliceId || null,
      });
    }
    taskMap.set(task.taskId, task);
  }
  const taskSliceOwners = new Map(
    [...taskMap.keys()].map((taskId) => [taskId, []])
  );
  for (const slice of sliceMap.values()) {
    for (const taskId of slice.taskIds || []) {
      if (!taskMap.has(taskId) || taskMap.get(taskId).ownerSliceId !== slice.sliceId) {
        throw failure('partition_unknown_dependency', {
          sliceId: slice.sliceId,
          taskId,
        });
      }
      taskSliceOwners.get(taskId).push(slice.sliceId);
    }
  }
  for (const task of taskMap.values()) {
    const owners = unique(taskSliceOwners.get(task.taskId) || []);
    if (owners.length !== 1 || owners[0] !== task.ownerSliceId) {
      throw failure('partition_unknown_dependency', {
        reason: 'task_owner_slice_mismatch',
        taskId: task.taskId,
        ownerSliceId: task.ownerSliceId,
        traceSliceIds: owners,
      });
    }
  }
  const dagNodeTaskIds = [];
  for (const node of executionProjection.taskDag.nodes) {
    const task = taskMap.get(node.taskId);
    if (!task || !sliceMap.has(node.ownerSliceId) || task.ownerSliceId !== node.ownerSliceId) {
      throw failure('partition_unknown_dependency', {
        taskId: node.taskId,
        ownerSliceId: node.ownerSliceId,
      });
    }
    dagNodeTaskIds.push(node.taskId);
  }
  if (
    new Set(dagNodeTaskIds).size !== dagNodeTaskIds.length ||
    stableStringify(unique(dagNodeTaskIds)) !==
      stableStringify(unique([...taskMap.keys()]))
  ) {
    throw failure('partition_dependency_authority_invalid', {
      reason: 'task_dag_node_coverage_mismatch',
      atomicTaskIds: unique([...taskMap.keys()]),
      taskDagNodeIds: unique(dagNodeTaskIds),
    });
  }
  const incomingDependencies = new Map(
    [...taskMap.keys()].map((taskId) => [taskId, []])
  );
  const edgeKeys = new Set();
  for (const edge of executionProjection.taskDag.edges) {
    if (!taskMap.has(edge.fromTaskId) || !taskMap.has(edge.toTaskId)) {
      throw failure('partition_unknown_dependency', { edge });
    }
    if (!ALLOWED_DEPENDENCY_REASONS.has(edge.reason)) {
      throw failure('partition_dependency_authority_invalid', { edge });
    }
    const edgeKey = stableStringify({
      fromTaskId: edge.fromTaskId,
      toTaskId: edge.toTaskId,
      reason: edge.reason,
      joinId: edge.joinId || null,
    });
    if (edgeKeys.has(edgeKey)) {
      throw failure('partition_dependency_authority_invalid', {
        reason: 'duplicate_task_dependency_edge',
        edge,
      });
    }
    edgeKeys.add(edgeKey);
    if (incomingDependencies.has(edge.toTaskId)) {
      incomingDependencies.get(edge.toTaskId).push(edge.fromTaskId);
    }
  }
  for (const task of taskMap.values()) {
    const actual = task.dependencyIds || [];
    const expected = unique(incomingDependencies.get(task.taskId) || []);
    if (
      new Set(actual).size !== actual.length ||
      stableStringify(unique(actual)) !== stableStringify(expected)
    ) {
      throw failure('partition_dependency_authority_invalid', {
        reason: 'task_dependency_projection_mismatch',
        taskId: task.taskId,
        expectedDependencyIds: expected,
        actualDependencyIds: actual,
      });
    }
  }
  const expectedIntegrationEdges = (
    executionProjection.integrationJoinGraph?.joins || []
  ).flatMap((join) =>
    (join.inputTaskIds || []).map((inputTaskId) => ({
      fromTaskId: inputTaskId,
      toTaskId: join.ownerTaskId,
      reason: 'integration_join',
      joinId: join.joinId,
    }))
  );
  const actualIntegrationEdges = executionProjection.taskDag.edges
    .filter((edge) => edge.reason === 'integration_join')
    .map((edge) => ({
      fromTaskId: edge.fromTaskId,
      toTaskId: edge.toTaskId,
      reason: edge.reason,
      joinId: edge.joinId || null,
    }));
  const canonicalEdges = (edges) =>
    edges.map((edge) => stableStringify(edge)).sort(compareIds);
  const joins = executionProjection.integrationJoinGraph?.joins || [];
  const joinIds = joins.map((join) => join.joinId);
  const invalidJoinShape = joins.some(
    (join) =>
      new Set(join.inputTaskIds || []).size !==
        (join.inputTaskIds || []).length ||
      (join.inputTaskIds || []).includes(join.ownerTaskId)
  );
  if (
    invalidJoinShape ||
    new Set(joinIds).size !== joinIds.length ||
    new Set(canonicalEdges(expectedIntegrationEdges)).size !==
      expectedIntegrationEdges.length ||
    new Set(canonicalEdges(actualIntegrationEdges)).size !==
      actualIntegrationEdges.length ||
    stableStringify(canonicalEdges(actualIntegrationEdges)) !==
      stableStringify(canonicalEdges(expectedIntegrationEdges))
  ) {
    throw failure('partition_dependency_authority_invalid', {
      reason: 'integration_join_mapping_mismatch',
      expectedIntegrationEdges,
      actualIntegrationEdges,
    });
  }
  return { sliceMap, taskMap };
}

function relationForTasks(taskIds, reasonCode, taskMap) {
  const traceSliceIds = unique(
    taskIds.map((taskId) => {
      const task = taskMap.get(taskId);
      if (!task) throw failure('partition_unknown_dependency', { taskId });
      return task.ownerSliceId;
    })
  );
  return traceSliceIds.length > 1 ? { traceSliceIds, reasonCode } : null;
}

function constraintReason(constraint) {
  const type = String(constraint.constraintType || '').toLowerCase();
  if (/crash|transaction|compensation/u.test(type)) return 'crash_safe_transaction';
  if (
    /atomic|co[-_]?change/u.test(type) ||
    constraint.semantic?.atomic === true ||
    constraint.semantic?.atomicCoChangeGroup
  ) {
    return 'source_atomic_co_change';
  }
  return null;
}

function deriveMustLinkRelations(executionProjection, taskMap) {
  const relations = [];
  for (const constraint of executionProjection.sequenceConstraintBinding?.constraints || []) {
    const reasonCode = constraintReason(constraint);
    if (!reasonCode) continue;
    const relation = relationForTasks(constraint.taskIds || [], reasonCode, taskMap);
    if (relation) relations.push(relation);
  }
  for (const entry of executionProjection.productionEntryIndex || []) {
    const reasonCode = /writer|write|promote|stage|atomic/iu.test(entry.literal || '')
      ? 'controlled_writer_callers'
      : 'public_action_registry';
    const relation = relationForTasks(entry.taskIds || [], reasonCode, taskMap);
    if (relation) relations.push(relation);
  }
  for (const fileScope of executionProjection.fileScopeIndex || []) {
    if (!/\.schema\.json$/iu.test(fileScope.path || '')) continue;
    const relation = relationForTasks(
      fileScope.taskIds || [],
      'schema_migration',
      taskMap
    );
    if (relation) relations.push(relation);
  }
  const slicesByEvidence = new Map();
  for (const slice of executionProjection.traceSlices) {
    for (const evidenceContractId of slice.evidenceContractIds || []) {
      const values = slicesByEvidence.get(evidenceContractId) || [];
      values.push(...(slice.taskIds || []));
      slicesByEvidence.set(evidenceContractId, values);
    }
  }
  for (const contract of executionProjection.evidenceContracts || []) {
    const receiptBound =
      /receipt/iu.test(contract.evidenceContractId || '') ||
      (contract.admissibleTypes || []).some((type) => /receipt/iu.test(type));
    if (!receiptBound) continue;
    const relation = relationForTasks(
      [
        ...(contract.producerTaskIds || []),
        ...(slicesByEvidence.get(contract.evidenceContractId) || []),
      ],
      'receipt_schema_producer',
      taskMap
    );
    if (relation) relations.push(relation);
  }
  return relations.sort((left, right) =>
    stableStringify(left).localeCompare(stableStringify(right))
  );
}

function estimateClosureMinutes(component, taskMap) {
  let declaredTaskMinutes = 0;
  let derivedTaskMinutes = 0;
  let derivedTaskCount = 0;
  for (const taskId of component.atomicTaskIds) {
    const task = taskMap.get(taskId);
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
      : component.completionPredicateIds.length * 5 +
        component.evidenceContractIds.length * 5;
  const coordinationMinutes =
    derivedTaskCount === 0
      ? 0
      : component.fileScopeIds.length * 3 +
        component.productionEntryIds.length * 5 +
        component.sequenceConstraintIds.length * 5;
  const totalMinutes =
    declaredTaskMinutes +
    derivedTaskMinutes +
    verificationMinutes +
    coordinationMinutes;
  return Object.freeze({
    declaredTaskMinutes,
    derivedTaskMinutes,
    verificationMinutes,
    coordinationMinutes,
    totalMinutes,
  });
}

function materializeComponents({
  executionProjection,
  relations,
  union,
  policy,
  sliceMap,
  taskMap,
}) {
  const groupedSlices = new Map();
  for (const sliceId of [...sliceMap.keys()].sort(compareIds)) {
    const root = union.find(sliceId);
    const values = groupedSlices.get(root) || [];
    values.push(sliceId);
    groupedSlices.set(root, values);
  }
  const components = [...groupedSlices.values()].map((traceSliceIds) => {
    const sliceSet = new Set(traceSliceIds);
    const atomicTaskIds = unique(
      traceSliceIds.flatMap((sliceId) => sliceMap.get(sliceId).taskIds || [])
    );
    const mustLinkReasonCodes = unique([
      'trace_slice_atomicity',
      ...relations
        .filter((relation) =>
          relation.traceSliceIds.every((traceSliceId) => sliceSet.has(traceSliceId))
        )
        .map((relation) => relation.reasonCode),
    ]);
    const component = {
      componentId: deriveId('component', {
        traceSliceIds,
        mustLinkReasonCodes,
      }),
      traceSliceIds,
      atomicTaskIds,
      sourceIds: unique(
        traceSliceIds.flatMap((sliceId) => sliceMap.get(sliceId).sourceIds || [])
      ),
      completionPredicateIds: unique(
        traceSliceIds.flatMap(
          (sliceId) => sliceMap.get(sliceId).completionPredicateIds || []
        )
      ),
      evidenceContractIds: unique(
        traceSliceIds.flatMap(
          (sliceId) => sliceMap.get(sliceId).evidenceContractIds || []
        )
      ),
      sequenceConstraintIds: unique(
        traceSliceIds.flatMap(
          (sliceId) => sliceMap.get(sliceId).sequenceConstraintIds || []
        )
      ),
      productionEntryIds: unique(
        (executionProjection.productionEntryIndex || [])
          .filter((entry) => entry.taskIds?.some((taskId) => atomicTaskIds.includes(taskId)))
          .map((entry) => entry.productionEntryId)
      ),
      fileScopeIds: unique(
        (executionProjection.fileScopeIndex || [])
          .filter((entry) => entry.taskIds?.some((taskId) => atomicTaskIds.includes(taskId)))
          .map((entry) => entry.fileScopeId)
      ),
      verificationOnly: traceSliceIds.every(
        (sliceId) => sliceMap.get(sliceId).verificationOnly === true
      ),
      mustLinkReasonCodes,
    };
    const closureMinuteBreakdown = estimateClosureMinutes(component, taskMap);
    const boundedComponent = {
      ...component,
      closureMinuteBreakdown,
      estimatedClosureMinutes: closureMinuteBreakdown.totalMinutes,
    };
    if (
      boundedComponent.estimatedClosureMinutes >
      policy.limits.maxClosureMinutesPerPartition
    ) {
      throw failure('partition_atomic_component_exceeds_policy', {
        componentId: boundedComponent.componentId,
        traceSliceIds,
        estimatedClosureMinutes: boundedComponent.estimatedClosureMinutes,
        closureMinuteBreakdown: boundedComponent.closureMinuteBreakdown,
        taskCount: boundedComponent.atomicTaskIds.length,
      });
    }
    for (const taskId of atomicTaskIds) {
      if (!taskMap.has(taskId)) throw failure('partition_unknown_dependency', { taskId });
    }
    return boundedComponent;
  });
  return components.sort((left, right) => compareIds(left.componentId, right.componentId));
}

function deriveComponentDependencies({ executionProjection, taskToComponent }) {
  const grouped = new Map();
  for (const edge of executionProjection.taskDag.edges) {
    if (!ALLOWED_DEPENDENCY_REASONS.has(edge.reason)) {
      throw failure('partition_dependency_authority_invalid', { edge });
    }
    const fromComponentId = taskToComponent.get(edge.fromTaskId);
    const toComponentId = taskToComponent.get(edge.toTaskId);
    if (!fromComponentId || !toComponentId) {
      throw failure('partition_unknown_dependency', { edge });
    }
    if (fromComponentId === toComponentId) continue;
    const key = `${fromComponentId}->${toComponentId}`;
    const current = grouped.get(key) || {
      fromComponentId,
      toComponentId,
      reasonCodes: [],
      taskEdges: [],
    };
    current.reasonCodes.push(edge.reason);
    current.taskEdges.push({
      fromTaskId: edge.fromTaskId,
      toTaskId: edge.toTaskId,
      reason: edge.reason,
      joinId: edge.joinId || null,
    });
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .map((edge) => ({
      edgeId: deriveId('component-edge', {
        fromComponentId: edge.fromComponentId,
        toComponentId: edge.toComponentId,
        reasonCodes: unique(edge.reasonCodes),
        taskEdges: edge.taskEdges.sort((left, right) =>
          stableStringify(left).localeCompare(stableStringify(right))
        ),
      }),
      fromComponentId: edge.fromComponentId,
      toComponentId: edge.toComponentId,
      reasonCodes: unique(edge.reasonCodes),
      taskEdges: edge.taskEdges,
    }))
    .sort((left, right) => compareIds(left.edgeId, right.edgeId));
}

function validateAcyclic(components, dependencyEdges) {
  const indegree = new Map<string, number>(
    components.map((component) => [component.componentId, 0])
  );
  const outgoing = new Map<string, string[]>(
    components.map((component) => [component.componentId, []])
  );
  for (const edge of dependencyEdges) {
    if (!indegree.has(edge.fromComponentId) || !indegree.has(edge.toComponentId)) {
      throw failure('partition_unknown_dependency', { edge });
    }
    outgoing.get(edge.fromComponentId)!.push(edge.toComponentId);
    indegree.set(
      edge.toComponentId,
      (indegree.get(edge.toComponentId) ?? 0) + 1
    );
  }
  const ready = [...indegree.entries()]
    .filter(([, count]) => count === 0)
    .map(([componentId]) => componentId)
    .sort(compareIds);
  const topologicalOrder: string[] = [];
  while (ready.length > 0) {
    const componentId = ready.shift()!;
    topologicalOrder.push(componentId);
    for (const dependentId of unique(outgoing.get(componentId) || [])) {
      indegree.set(dependentId, (indegree.get(dependentId) ?? 0) - 1);
      if (indegree.get(dependentId) === 0) {
        ready.push(dependentId);
        ready.sort(compareIds);
      }
    }
  }
  if (topologicalOrder.length !== components.length) {
    throw failure('partition_dependency_cycle', {
      componentIds: components.map((component) => component.componentId),
    });
  }
  return topologicalOrder;
}

function validateNoFutureImplementationDependency({
  executionProjection,
  taskToComponent,
}) {
  const indexes = new Map(
    executionProjection.taskDag.nodes.map((node) => [node.taskId, node.topologicalIndex])
  );
  for (const edge of executionProjection.taskDag.edges) {
    if (taskToComponent.get(edge.fromTaskId) === taskToComponent.get(edge.toTaskId)) {
      continue;
    }
    if (
      !indexes.has(edge.fromTaskId) ||
      !indexes.has(edge.toTaskId) ||
      indexes.get(edge.fromTaskId) >= indexes.get(edge.toTaskId)
    ) {
      throw failure('partition_dependency_authority_invalid', {
        edge,
        reason: 'future_implementation_dependency',
      });
    }
  }
}

function deriveSharedArtifactOwnership(
  executionProjection,
  taskToComponent,
  topologicalOrder
) {
  const position = new Map<string, number>(
    topologicalOrder.map(
      (componentId, index) => [componentId, index] as [string, number]
    )
  );
  return (executionProjection.fileScopeIndex || [])
    .map((fileScope) => {
      const participatingComponentIds = unique(
        (fileScope.taskIds || []).map((taskId) => {
          const componentId = taskToComponent.get(taskId);
          if (!componentId) throw failure('partition_unknown_dependency', { taskId });
          return componentId;
        })
      ).sort(
        (left, right) =>
          position.get(left)! - position.get(right)! || compareIds(left, right)
      );
      if (participatingComponentIds.length === 0) {
        throw failure('partition_unowned_shared_artifact', {
          fileScopeId: fileScope.fileScopeId,
          path: fileScope.path,
          participatingComponentIds,
        });
      }
      return {
        fileScopeId: fileScope.fileScopeId,
        path: fileScope.path,
        ownerComponentId: participatingComponentIds[0],
        participatingComponentIds,
      };
    })
    .sort((left, right) => compareIds(left.fileScopeId, right.fileScopeId));
}

function deriveEffectiveComponentDependencies(componentGraph) {
  const componentIds = new Set(
    (componentGraph.components || []).map((component) => component.componentId)
  );
  const topologicalOrder = componentGraph.topologicalOrder || [];
  const position = new Map(
    topologicalOrder.map((componentId, index) => [componentId, index])
  );
  if (
    topologicalOrder.length !== componentIds.size ||
    position.size !== componentIds.size ||
    topologicalOrder.some((componentId) => !componentIds.has(componentId))
  ) {
    throw failure('partition_future_dependency', {
      reason: 'component_topological_order_invalid',
    });
  }

  const grouped = new Map();
  const addDependency = ({
    fromComponentId,
    toComponentId,
    authorityCode,
    sharedArtifactPath = null,
  }) => {
    if (
      !componentIds.has(fromComponentId) ||
      !componentIds.has(toComponentId)
    ) {
      throw failure('partition_unknown_dependency', {
        fromComponentId,
        toComponentId,
      });
    }
    if (position.get(fromComponentId) >= position.get(toComponentId)) {
      throw failure('partition_future_dependency', {
        reason:
          authorityCode === 'shared_artifact_owner'
            ? 'shared_artifact_owner_after_consumer'
            : 'future_implementation_dependency',
        fromComponentId,
        toComponentId,
        sharedArtifactPath,
      });
    }
    const key = `${fromComponentId}->${toComponentId}`;
    const current = grouped.get(key) || {
      fromComponentId,
      toComponentId,
      authorityCodes: [],
      sharedArtifactPaths: [],
    };
    current.authorityCodes.push(authorityCode);
    if (sharedArtifactPath) current.sharedArtifactPaths.push(sharedArtifactPath);
    grouped.set(key, current);
  };

  for (const edge of componentGraph.dependencyEdges || []) {
    addDependency({
      fromComponentId: edge.fromComponentId,
      toComponentId: edge.toComponentId,
      authorityCode: 'task_dag',
    });
  }
  for (const ownership of componentGraph.sharedArtifactOwnership || []) {
    const participants = unique(ownership.participatingComponentIds || []);
    if (
      participants.length === 0 ||
      !participants.includes(ownership.ownerComponentId)
    ) {
      throw failure('partition_unowned_shared_artifact', {
        fileScopeId: ownership.fileScopeId,
        path: ownership.path,
        ownerComponentId: ownership.ownerComponentId,
        participatingComponentIds: participants,
      });
    }
    for (const participantId of participants) {
      if (participantId === ownership.ownerComponentId) continue;
      addDependency({
        fromComponentId: ownership.ownerComponentId,
        toComponentId: participantId,
        authorityCode: 'shared_artifact_owner',
        sharedArtifactPath: ownership.path,
      });
    }
  }
  return [...grouped.values()]
    .map((edge) =>
      Object.freeze({
        fromComponentId: edge.fromComponentId,
        toComponentId: edge.toComponentId,
        authorityCodes: unique(edge.authorityCodes),
        sharedArtifactPaths: unique(edge.sharedArtifactPaths),
      })
    )
    .sort((left, right) =>
      stableStringify(left).localeCompare(stableStringify(right))
    );
}

function deriveIntegrationFanInOwnership(executionProjection, taskToComponent) {
  const taskEdges = executionProjection.taskDag.edges;
  return (executionProjection.integrationJoinGraph?.joins || [])
    .map((join) => {
      const ownerComponentId = taskToComponent.get(join.ownerTaskId);
      if (!ownerComponentId) {
        throw failure('partition_unknown_dependency', {
          joinId: join.joinId,
          taskId: join.ownerTaskId,
        });
      }
      const inputComponentIds = unique(
        join.inputTaskIds.map((taskId) => {
          const componentId = taskToComponent.get(taskId);
          if (!componentId) {
            throw failure('partition_unknown_dependency', {
              joinId: join.joinId,
              taskId,
            });
          }
          const edgeExists = taskEdges.some(
            (edge) =>
              edge.fromTaskId === taskId &&
              edge.toTaskId === join.ownerTaskId &&
              edge.reason === 'integration_join' &&
              edge.joinId === join.joinId
          );
          if (!edgeExists) {
            throw failure('partition_dependency_authority_invalid', {
              joinId: join.joinId,
              taskId,
            });
          }
          return componentId;
        })
      );
      return {
        joinId: join.joinId,
        ownerComponentId,
        inputComponentIds,
        interfaceId: join.interfaceId,
      };
    })
    .sort((left, right) => compareIds(left.joinId, right.joinId));
}

function normalizeDependencyEdges(edges) {
  return [...(edges || [])]
    .map((edge) => ({
      edgeId: edge.edgeId,
      fromComponentId: edge.fromComponentId,
      toComponentId: edge.toComponentId,
      reasonCodes: unique(edge.reasonCodes || []),
      taskEdges: [...(edge.taskEdges || [])]
        .map((taskEdge) => ({
          fromTaskId: taskEdge.fromTaskId,
          toTaskId: taskEdge.toTaskId,
          reason: taskEdge.reason,
          joinId: taskEdge.joinId || null,
        }))
        .sort((left, right) =>
          stableStringify(left).localeCompare(stableStringify(right))
        ),
    }))
    .sort((left, right) =>
      stableStringify(left).localeCompare(stableStringify(right))
    );
}

function normalizeSharedArtifactOwnership(ownerships) {
  return [...(ownerships || [])]
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
    );
}

function normalizeIntegrationFanInOwnership(ownerships) {
  return [...(ownerships || [])]
    .map((ownership) => ({
      joinId: ownership.joinId,
      ownerComponentId: ownership.ownerComponentId,
      inputComponentIds: unique(ownership.inputComponentIds || []),
      interfaceId: ownership.interfaceId || null,
    }))
    .sort((left, right) =>
      stableStringify(left).localeCompare(stableStringify(right))
    );
}

function canonicalMismatch(extra = {}) {
  throw failure('partition_policy_compilation_identity_mismatch', {
    reason: 'component_graph_canonical_mismatch',
    ...extra,
  });
}

function assertCanonicalComponentGraph({
  componentGraph,
  executionProjection,
  policy,
}) {
  if (
    componentGraph?.schemaVersion !== 'goal-contract-partition-components/v1' ||
    componentGraph?.primaryUnitType !== 'trace_slice'
  ) {
    canonicalMismatch({ detail: 'component_graph_contract_mismatch' });
  }
  const { sliceMap, taskMap } =
    validateExecutionProjectionForPartitioning(executionProjection);
  const actualComponents = componentGraph?.components || [];
  const componentIds = new Set();
  const actualByTraceSlices = new Map();
  for (const component of actualComponents) {
    const traceSliceKey = stableStringify(unique(component.traceSliceIds || []));
    if (
      !component?.componentId ||
      componentIds.has(component.componentId) ||
      actualByTraceSlices.has(traceSliceKey)
    ) {
      canonicalMismatch({
        detail: 'component_identity_or_membership_duplicate',
        componentId: component?.componentId || null,
      });
    }
    componentIds.add(component.componentId);
    actualByTraceSlices.set(traceSliceKey, component);
  }

  const relations = deriveMustLinkRelations(executionProjection, taskMap);
  const union = createStableUnionFind([...sliceMap.keys()]);
  for (const relation of relations) {
    const [first, ...rest] = relation.traceSliceIds;
    for (const traceSliceId of rest) union.merge(first, traceSliceId);
  }
  const canonicalComponents = materializeComponents({
    executionProjection,
    relations,
    union,
    policy,
    sliceMap,
    taskMap,
  });
  if (canonicalComponents.length !== actualComponents.length) {
    canonicalMismatch({
      detail: 'component_count_mismatch',
      expectedComponentCount: canonicalComponents.length,
      actualComponentCount: actualComponents.length,
    });
  }
  for (const canonicalComponent of canonicalComponents) {
    const traceSliceKey = stableStringify(
      unique(canonicalComponent.traceSliceIds || [])
    );
    const actualComponent = actualByTraceSlices.get(traceSliceKey);
    if (
      !actualComponent ||
      actualComponent.componentId !== canonicalComponent.componentId ||
      stableStringify(unique(actualComponent.atomicTaskIds || [])) !==
        stableStringify(unique(canonicalComponent.atomicTaskIds || [])) ||
      stableStringify(unique(actualComponent.mustLinkReasonCodes || [])) !==
        stableStringify(unique(canonicalComponent.mustLinkReasonCodes || []))
    ) {
      canonicalMismatch({
        detail: 'component_membership_mismatch',
        traceSliceIds: canonicalComponent.traceSliceIds,
        componentId: actualComponent?.componentId || null,
      });
    }
  }

  const taskToComponent = new Map();
  for (const component of actualComponents) {
    for (const taskId of component.atomicTaskIds || []) {
      if (taskToComponent.has(taskId)) {
        canonicalMismatch({
          detail: 'duplicate_task_component_owner',
          taskId,
        });
      }
      taskToComponent.set(taskId, component.componentId);
    }
  }
  const expectedDependencyEdges = deriveComponentDependencies({
    executionProjection,
    taskToComponent,
  });
  const expectedTopologicalOrder = validateAcyclic(
    actualComponents,
    expectedDependencyEdges
  );
  const expectedSharedArtifactOwnership = deriveSharedArtifactOwnership(
    executionProjection,
    taskToComponent,
    expectedTopologicalOrder
  );
  const expectedIntegrationFanInOwnership = deriveIntegrationFanInOwnership(
    executionProjection,
    taskToComponent
  );
  const comparisons = [
    [
      'dependency_edges',
      normalizeDependencyEdges(componentGraph.dependencyEdges),
      normalizeDependencyEdges(expectedDependencyEdges),
    ],
    [
      'topological_order',
      componentGraph.topologicalOrder || [],
      expectedTopologicalOrder,
    ],
    [
      'shared_artifact_ownership',
      normalizeSharedArtifactOwnership(componentGraph.sharedArtifactOwnership),
      normalizeSharedArtifactOwnership(expectedSharedArtifactOwnership),
    ],
    [
      'integration_fan_in_ownership',
      normalizeIntegrationFanInOwnership(
        componentGraph.integrationFanInOwnership
      ),
      normalizeIntegrationFanInOwnership(expectedIntegrationFanInOwnership),
    ],
  ];
  for (const [detail, actual, expected] of comparisons) {
    if (stableStringify(actual) !== stableStringify(expected)) {
      canonicalMismatch({ detail, expected, actual });
    }
  }
  return Object.freeze({
    dependencyEdges: expectedDependencyEdges,
    topologicalOrder: expectedTopologicalOrder,
    sharedArtifactOwnership: expectedSharedArtifactOwnership,
    integrationFanInOwnership: expectedIntegrationFanInOwnership,
  });
}

function buildPartitionComponents({ executionProjection, policy }) {
  const { sliceMap, taskMap } =
    validateExecutionProjectionForPartitioning(executionProjection);
  if (
    !Number.isInteger(policy?.limits?.maxClosureMinutesPerPartition) ||
    policy.limits.maxClosureMinutesPerPartition < 1 ||
    policy.limits.maxClosureMinutesPerPartition > 240
  ) {
    throw failure('partition_policy_binding_mismatch');
  }
  const relations = deriveMustLinkRelations(executionProjection, taskMap);
  const union = createStableUnionFind([...sliceMap.keys()]);
  for (const relation of relations) {
    const [first, ...rest] = relation.traceSliceIds;
    for (const traceSliceId of rest) union.merge(first, traceSliceId);
  }
  const components = materializeComponents({
    executionProjection,
    relations,
    union,
    policy,
    sliceMap,
    taskMap,
  });
  const sliceToComponent = new Map(
    components.flatMap((component) =>
      component.traceSliceIds.map((sliceId) => [sliceId, component.componentId])
    )
  );
  const taskToComponent = new Map(
    [...taskMap.values()].map((task) => [
      task.taskId,
      sliceToComponent.get(task.ownerSliceId),
    ])
  );
  const dependencyEdges = deriveComponentDependencies({
    executionProjection,
    taskToComponent,
  });
  const topologicalOrder = validateAcyclic(components, dependencyEdges);
  validateNoFutureImplementationDependency({
    executionProjection,
    taskToComponent,
  });
  const sharedArtifactOwnership = deriveSharedArtifactOwnership(
    executionProjection,
    taskToComponent,
    topologicalOrder
  );
  const integrationFanInOwnership = deriveIntegrationFanInOwnership(
    executionProjection,
    taskToComponent
  );
  const componentGraph = {
    schemaVersion: 'goal-contract-partition-components/v1',
    primaryUnitType: 'trace_slice',
    executionProjectionHash: executionProjection.executionProjectionHash,
    components,
    dependencyEdges,
    topologicalOrder,
    sharedArtifactOwnership,
    integrationFanInOwnership,
  };
  deriveEffectiveComponentDependencies(componentGraph);
  return deepFreeze(componentGraph);
}

module.exports = {
  assertCanonicalComponentGraph,
  buildPartitionComponents,
  deriveEffectiveComponentDependencies,
};
