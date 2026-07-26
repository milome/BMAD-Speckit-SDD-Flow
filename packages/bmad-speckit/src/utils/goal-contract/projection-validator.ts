const { PROJECTION_REGISTRY, stableStringify } = require(
  __filename.endsWith('.ts') ? './evidence-graph.ts' : './evidence-graph'
);

const projectionIssueCodes = Object.freeze({
  columnMissing: 'trace_binding_column_missing',
  fieldEmpty: 'trace_binding_field_empty',
  sourceDuplicate: 'trace_binding_source_duplicate',
  sourceUnmapped: 'trace_binding_source_unmapped',
  acceptanceUndefined: 'trace_binding_acceptance_undefined',
  commandUndefined: 'trace_binding_command_undefined',
  evidenceUnclosed: 'trace_binding_evidence_unclosed',
  dependencyInvalid: 'trace_binding_dependency_invalid',
  allowedPathMissing: 'trace_binding_allowed_path_missing',
  commitPolicyInvalid: 'trace_binding_commit_policy_invalid',
  rangeMismatch: 'trace_binding_range_mismatch',
  literalDrift: 'trace_binding_literal_drift',
  projectionMissing: 'goal_contract_projection_missing',
  runtimePassForbidden: 'goal_contract_projection_runtime_pass_forbidden',
  executionSecondTaskUniverse: 'execution_projection_second_task_universe',
  executionTaskOwnerInvalid: 'execution_projection_task_owner_invalid',
  executionSliceOutcomeMissing: 'execution_projection_slice_outcome_missing',
  executionSlicePredicateMissing: 'execution_projection_slice_predicate_missing',
  executionDependencyInvalid: 'execution_projection_dependency_invalid',
  executionTaskCycle: 'execution_projection_task_cycle',
  executionEvidenceProducerMissing: 'execution_projection_evidence_producer_missing',
  executionEvidenceFreshnessMissing: 'execution_projection_evidence_freshness_missing',
  executionEvidenceReferenceMissing: 'execution_projection_evidence_reference_missing',
  executionHelperOutcomeMissing: 'execution_projection_helper_outcome_missing',
});

const TRACE_COLUMNS = Object.freeze([
  'traceId',
  'goalIds',
  'sourceIds',
  'acceptanceIds',
  'productionSymbolIds',
  'allowedPathIds',
  'directCommands',
  'impactedCommands',
  'dependencies',
  'commitPolicy',
  'closeCondition',
]);

function compareIds(left, right) {
  return String(left).localeCompare(String(right), 'en', {
    numeric: true,
    sensitivity: 'base',
  });
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean).map(String))].sort(compareIds);
}

function nodesOf(graph, nodeType) {
  return (graph.nodes || [])
    .filter((node) => node.nodeType === nodeType)
    .sort((left, right) => compareIds(left.id, right.id));
}

function idsOf(graph, nodeType) {
  return new Set(nodesOf(graph, nodeType).map((node) => node.id));
}

function edgesOf(graph, edgeType, from = null, to = null) {
  return (graph.edges || []).filter(
    (edge) =>
      edge.edgeType === edgeType &&
      (from === null || edge.from === from) &&
      (to === null || edge.to === to)
  );
}

function issue(code, location, details = {}) {
  return { code, location, ...details };
}

function result(issues) {
  return {
    decision: issues.length === 0 ? 'pass' : 'block',
    evidenceClassification: 'projection_only',
    runtimeEvidenceAuthority: false,
    issues,
  };
}

function dependencyIssues(graph) {
  const issues = [];
  const traces = nodesOf(graph, 'trace');
  const traceIds = new Set(traces.map((trace) => trace.id));
  const dependencyMap = new Map(traces.map((trace) => [trace.id, unique(trace.dependencies)]));

  for (const trace of traces) {
    for (const dependencyId of dependencyMap.get(trace.id)) {
      if (dependencyId === trace.id || !traceIds.has(dependencyId)) {
        issues.push(
          issue(projectionIssueCodes.dependencyInvalid, trace.id, {
            dependencyId,
          })
        );
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(traceId, trail) {
    if (visiting.has(traceId)) {
      issues.push(
        issue(projectionIssueCodes.dependencyInvalid, traceId, {
          dependencyCycle: [...trail, traceId],
        })
      );
      return;
    }
    if (visited.has(traceId)) return;
    visiting.add(traceId);
    for (const dependencyId of dependencyMap.get(traceId) || []) {
      if (traceIds.has(dependencyId)) {
        visit(dependencyId, [...trail, traceId]);
      }
    }
    visiting.delete(traceId);
    visited.add(traceId);
  }
  for (const trace of traces) visit(trace.id, []);
  return issues;
}

function validateEvidenceGraph(graph) {
  const issues = [];
  const sourceIds = idsOf(graph, 'source');
  const acceptanceIds = idsOf(graph, 'acceptance');
  const commandIds = idsOf(graph, 'command');
  const evidenceIds = idsOf(graph, 'evidence');

  for (const sourceId of sourceIds) {
    const traceBindings = edgesOf(graph, 'source_to_trace', sourceId);
    if (traceBindings.length === 0) {
      issues.push(issue(projectionIssueCodes.sourceUnmapped, sourceId));
    } else if (traceBindings.length > 1) {
      issues.push(
        issue(projectionIssueCodes.sourceDuplicate, sourceId, {
          traceIds: traceBindings.map((edge) => edge.to),
        })
      );
    }
  }

  for (const edge of graph.edges || []) {
    if (
      ['trace_to_acceptance', 'source_to_acceptance'].includes(edge.edgeType) &&
      !acceptanceIds.has(edge.to)
    ) {
      issues.push(
        issue(projectionIssueCodes.acceptanceUndefined, edge.from, {
          acceptanceId: edge.to,
        })
      );
    }
    if (
      [
        'trace_to_command',
        'source_to_command',
        'acceptance_to_command',
        'manual_to_command',
        'evidence_to_command',
      ].includes(edge.edgeType) &&
      !commandIds.has(edge.to)
    ) {
      issues.push(
        issue(projectionIssueCodes.commandUndefined, edge.from, {
          commandId: edge.to,
        })
      );
    }
  }

  for (const acceptanceId of acceptanceIds) {
    const evidenceBindings = edgesOf(graph, 'acceptance_to_evidence', acceptanceId).filter((edge) =>
      evidenceIds.has(edge.to)
    );
    if (evidenceBindings.length === 0) {
      issues.push(issue(projectionIssueCodes.evidenceUnclosed, acceptanceId));
    }
  }

  issues.push(...dependencyIssues(graph));
  for (const trace of nodesOf(graph, 'trace')) {
    const evidenceOnly = trace.classification === 'evidence_only' || trace.codeBearing === false;
    if (!evidenceOnly && edgesOf(graph, 'trace_to_path', trace.id).length === 0) {
      issues.push(issue(projectionIssueCodes.allowedPathMissing, trace.id));
    }
    const validCommitPolicy = evidenceOnly
      ? /noCodeChangeReceipt|evidence[_-]only/iu.test(String(trace.commitPolicy || ''))
      : trace.commitPolicy === 'exactly_one_atomic_commit';
    if (!validCommitPolicy) {
      issues.push(
        issue(projectionIssueCodes.commitPolicyInvalid, trace.id, {
          commitPolicy: trace.commitPolicy || null,
          classification: evidenceOnly ? 'evidence_only' : 'code_bearing',
        })
      );
    }
  }
  if (graph.runtimeEvidencePolicy !== 'runtime_only' || Object.hasOwn(graph, 'observedEvidence')) {
    issues.push(issue(projectionIssueCodes.runtimePassForbidden, 'evidence_graph'));
  }
  return result(issues);
}

function rowReferenceIds(rows, keys) {
  return unique(
    rows.flatMap((row) => keys.flatMap((key) => (Array.isArray(row[key]) ? row[key] : [])))
  );
}

function literalValues(graph, nodeType, ids) {
  const values = new Map(nodesOf(graph, nodeType).map((node) => [node.id, node.literal]));
  return unique(ids.map((id) => values.get(id)));
}

function literalIssue(graph, projection) {
  const rows = projection.rows || [];
  const expected = {
    commands: literalValues(
      graph,
      'command',
      rowReferenceIds(rows, ['commandIds', 'directCommands', 'impactedCommands', 'producerIds'])
    ),
    paths: literalValues(graph, 'path', rowReferenceIds(rows, ['allowedPathIds', 'pathIds'])),
    symbols: literalValues(graph, 'symbol', rowReferenceIds(rows, ['productionSymbolIds'])),
  };
  for (const kind of Object.keys(expected)) {
    const actual = unique(projection.sharedLiterals?.[kind]);
    if (
      stableStringify(actual) !== stableStringify(expected[kind]) ||
      expected[kind].some((literal) => !String(projection.markdown || '').includes(literal))
    ) {
      return issue(projectionIssueCodes.literalDrift, projection.projectionId, {
        literalKind: kind,
        expected: expected[kind],
        actual,
      });
    }
  }
  return null;
}

function validateTraceRows(graph, projection) {
  const issues = [];
  const acceptanceIds = idsOf(graph, 'acceptance');
  const commandIds = idsOf(graph, 'command');
  for (const row of projection.rows || []) {
    for (const column of TRACE_COLUMNS) {
      if (!Object.hasOwn(row, column)) {
        issues.push(
          issue(projectionIssueCodes.columnMissing, row.traceId || 'trace', {
            column,
          })
        );
      }
    }
    for (const column of TRACE_COLUMNS.filter((column) => column !== 'dependencies')) {
      const value = row[column];
      if (
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        issues.push(
          issue(projectionIssueCodes.fieldEmpty, row.traceId || 'trace', {
            column,
          })
        );
      }
    }
    for (const acceptanceId of row.acceptanceIds || []) {
      if (!acceptanceIds.has(acceptanceId)) {
        issues.push(
          issue(projectionIssueCodes.acceptanceUndefined, row.traceId || 'trace', { acceptanceId })
        );
      }
    }
    for (const commandId of [...(row.directCommands || []), ...(row.impactedCommands || [])]) {
      if (!commandIds.has(commandId)) {
        issues.push(
          issue(projectionIssueCodes.commandUndefined, row.traceId || 'trace', { commandId })
        );
      }
    }
  }
  return issues;
}

function validateGoalContractProjections({ graph, projections }) {
  const issues = [];
  const projectionMap = new Map(
    (projections || []).map((projection) => [projection.projectionId, projection])
  );
  for (const definition of PROJECTION_REGISTRY) {
    if (!projectionMap.has(definition.id)) {
      issues.push(issue(projectionIssueCodes.projectionMissing, definition.id));
    }
  }

  const traceProjection = projectionMap.get('projection.trace_slices');
  if (traceProjection) {
    issues.push(...validateTraceRows(graph, traceProjection));
  }
  for (const projection of projectionMap.values()) {
    if (stableStringify(projection.declaredRanges) !== stableStringify(graph.ranges)) {
      issues.push(issue(projectionIssueCodes.rangeMismatch, projection.projectionId));
    }
    const drift = literalIssue(graph, projection);
    if (drift) issues.push(drift);
    if (
      projection.runtimeEvidenceAuthority !== false ||
      projection.evidenceClassification !== 'projection_only' ||
      /\bObserved(?: Evidence)?:\s*PASS\b/u.test(String(projection.markdown || ''))
    ) {
      issues.push(issue(projectionIssueCodes.runtimePassForbidden, projection.projectionId));
    }
  }
  return result(issues);
}

function executionCycleIssues(taskIds, edges) {
  const issues = [];
  const outgoing = new Map([...taskIds].map((taskId) => [taskId, []]));
  for (const edge of edges) {
    if (outgoing.has(edge.fromTaskId) && taskIds.has(edge.toTaskId)) {
      outgoing.get(edge.fromTaskId).push(edge.toTaskId);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(taskId, trail) {
    if (visiting.has(taskId)) {
      issues.push(
        issue(projectionIssueCodes.executionTaskCycle, taskId, {
          dependencyCycle: [...trail, taskId],
        })
      );
      return;
    }
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    for (const dependentId of unique(outgoing.get(taskId))) {
      visit(dependentId, [...trail, taskId]);
    }
    visiting.delete(taskId);
    visited.add(taskId);
  }
  for (const taskId of [...taskIds].sort(compareIds)) visit(taskId, []);
  return issues;
}

function validateExecutionProjection(projection) {
  const issues = [];
  const atomicTasks = projection?.atomicTasks || [];
  const traceSlices = projection?.traceSlices || [];
  const completionPredicates = projection?.completionPredicates || [];
  const evidenceContracts = projection?.evidenceContracts || [];
  const dagNodes = projection?.taskDag?.nodes || [];
  const dagEdges = projection?.taskDag?.edges || [];
  const taskIds = new Set(atomicTasks.map((task) => task.taskId));
  const dagNodeIds = dagNodes.map((node) => node.taskId);
  const predicateMap = new Map(
    completionPredicates.map((predicate) => [predicate.predicateId, predicate])
  );
  const evidenceMap = new Map(
    evidenceContracts.map((contract) => [contract.evidenceContractId, contract])
  );
  const sliceOwners = new Map([...taskIds].map((taskId) => [taskId, []]));

  for (const slice of traceSlices) {
    for (const taskId of slice.taskIds || []) {
      if (sliceOwners.has(taskId)) {
        sliceOwners.get(taskId).push(slice.sliceId);
      } else {
        issues.push(
          issue(projectionIssueCodes.executionSecondTaskUniverse, slice.sliceId, { taskId })
        );
      }
    }
    if (!String(slice.observableOutcome || '').trim()) {
      issues.push(issue(projectionIssueCodes.executionSliceOutcomeMissing, slice.sliceId));
    }
    const positivePredicates = (slice.completionPredicateIds || [])
      .map((predicateId) => predicateMap.get(predicateId))
      .filter((predicate) => predicate?.positive === true && predicate.sliceId === slice.sliceId);
    if (positivePredicates.length === 0) {
      issues.push(issue(projectionIssueCodes.executionSlicePredicateMissing, slice.sliceId));
    }
    if (
      ['evidence_only', 'helper_only'].includes(slice.classification) &&
      (slice.verificationOnly !== true || unique(slice.sourceIds).length === 0)
    ) {
      issues.push(issue(projectionIssueCodes.executionHelperOutcomeMissing, slice.sliceId));
    }
  }

  for (const task of atomicTasks) {
    const owners = unique(sliceOwners.get(task.taskId));
    if (owners.length !== 1 || task.ownerSliceId !== owners[0]) {
      issues.push(
        issue(projectionIssueCodes.executionTaskOwnerInvalid, task.taskId, {
          declaredOwner: task.ownerSliceId || null,
          sliceOwners: owners,
        })
      );
    }
  }

  if (
    new Set(dagNodeIds).size !== dagNodeIds.length ||
    stableStringify(unique(dagNodeIds)) !== stableStringify(unique([...taskIds]))
  ) {
    issues.push(
      issue(projectionIssueCodes.executionSecondTaskUniverse, 'taskDag.nodes', {
        atomicTaskIds: unique([...taskIds]),
        taskDagNodeIds: unique(dagNodeIds),
      })
    );
  }

  const topologicalIndex = new Map(dagNodes.map((node) => [node.taskId, node.topologicalIndex]));
  for (const edge of dagEdges) {
    if (!taskIds.has(edge.fromTaskId) || !taskIds.has(edge.toTaskId)) {
      issues.push(
        issue(projectionIssueCodes.executionDependencyInvalid, edge.toTaskId || 'taskDag.edges', {
          edge,
          reason: 'unknown_task',
        })
      );
      continue;
    }
    const fromIndex = topologicalIndex.get(edge.fromTaskId);
    const toIndex = topologicalIndex.get(edge.toTaskId);
    if (
      edge.fromTaskId === edge.toTaskId ||
      (Number.isInteger(fromIndex) && Number.isInteger(toIndex) && fromIndex >= toIndex)
    ) {
      issues.push(
        issue(projectionIssueCodes.executionDependencyInvalid, edge.toTaskId, {
          edge,
          reason: 'future_or_self_dependency',
        })
      );
    }
  }
  issues.push(...executionCycleIssues(taskIds, dagEdges));

  for (const predicate of completionPredicates) {
    for (const evidenceContractId of predicate.evidenceContractIds || []) {
      if (!evidenceMap.has(evidenceContractId)) {
        issues.push(
          issue(projectionIssueCodes.executionEvidenceReferenceMissing, predicate.predicateId, {
            evidenceContractId,
          })
        );
      }
    }
  }
  for (const contract of evidenceContracts) {
    const producerTaskIds = unique(contract.producerTaskIds);
    if (producerTaskIds.length === 0 || producerTaskIds.some((taskId) => !taskIds.has(taskId))) {
      issues.push(
        issue(projectionIssueCodes.executionEvidenceProducerMissing, contract.evidenceContractId, {
          producerTaskIds,
        })
      );
    }
    if (!String(contract.freshnessRule || '').trim()) {
      issues.push(
        issue(projectionIssueCodes.executionEvidenceFreshnessMissing, contract.evidenceContractId)
      );
    }
  }

  for (const join of projection?.integrationJoinGraph?.joins || []) {
    if (
      !taskIds.has(join.ownerTaskId) ||
      (join.inputTaskIds || []).some((taskId) => !taskIds.has(taskId))
    ) {
      issues.push(
        issue(projectionIssueCodes.executionSecondTaskUniverse, join.joinId, {
          inputTaskIds: unique(join.inputTaskIds),
          ownerTaskId: join.ownerTaskId,
        })
      );
    }
  }
  for (const constraint of projection?.sequenceConstraintBinding?.constraints || []) {
    if ((constraint.taskIds || []).some((taskId) => !taskIds.has(taskId))) {
      issues.push(
        issue(projectionIssueCodes.executionSecondTaskUniverse, constraint.constraintId, {
          taskIds: unique(constraint.taskIds),
        })
      );
    }
  }
  return result(issues);
}

module.exports = {
  projectionIssueCodes,
  validateEvidenceGraph,
  validateExecutionProjection,
  validateGoalContractProjections,
};
