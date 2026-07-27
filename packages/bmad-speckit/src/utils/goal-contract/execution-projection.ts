const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020');
const { stableStringify } = require(
  __filename.endsWith('.ts') ? './evidence-graph.ts' : './evidence-graph'
);
const { validateExecutionProjection } = require(
  __filename.endsWith('.ts') ? './projection-validator.ts' : './projection-validator'
);
const { deriveSequenceExecutionState } = require(
  __filename.endsWith('.ts') ? './sequence-mode.ts' : './sequence-mode'
);

export type GoalContractExecutionProjectionModule = never;

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const FORBIDDEN_SEQUENCE_FIELDS = new Set([
  'atomicTasks',
  'taskDag',
  'partitionCount',
  'partitions',
]);
const NON_SEMANTIC_FIELDS = new Set([
  'diagram',
  'diagramHash',
  'layout',
  'mermaid',
  'observedProviderIdentity',
  'providerCandidateId',
  'providerRunId',
  'runtimeId',
  'timestamp',
]);
let executionProjectionSchemaValidator = null;

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function hashValue(value) {
  return sha256(Buffer.from(stableStringify(value), 'utf8'));
}

function compareIds(left, right) {
  return String(left).localeCompare(String(right), 'en', {
    numeric: true,
    sensitivity: 'base',
  });
}

function unique(values: unknown[] = []): string[] {
  return [...new Set((values || []).filter(Boolean).map(String))].sort(compareIds);
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value
      .map(canonicalize)
      .sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !NON_SEMANTIC_FIELDS.has(key))
      .sort(compareIds)
      .map((key) => [key, canonicalize(value[key])])
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireHash(value, field) {
  if (!HASH_PATTERN.test(value || '')) {
    throw failure('execution_projection_identity_hash_invalid', { field, value });
  }
  return value;
}

function deriveId(explicitId, prefix, semanticPayload) {
  const normalized = String(explicitId || '').trim();
  if (normalized) {
    if (!ID_PATTERN.test(normalized)) {
      throw failure('execution_projection_id_invalid', { id: normalized, prefix });
    }
    return normalized;
  }
  return `${prefix}-${hashValue(semanticPayload).slice('sha256:'.length, 23)}`;
}

function assertUniqueIds(records, field, failureClass) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record[field])) throw failure(failureClass, { duplicateId: record[field] });
    seen.add(record[field]);
  }
}

function findForbiddenSequenceFields(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SEQUENCE_FIELDS.has(key)) found.push(key);
    findForbiddenSequenceFields(child, found);
  }
  return unique(found);
}

function normalizedTasks(graph) {
  const tasks = (graph.tasks || []).map((task) => {
    const sourceIds = unique(task.sourceIds);
    const taskId = deriveId(task.id || task.taskId, 'task', {
      sourceIds,
      title: task.title || task.summary || 'Untitled task',
    });
    return {
      taskId,
      title: String(task.title || task.summary || taskId),
      sourceIds,
      dependencyIds: unique(task.dependencies || task.dependencyIds),
      sequenceConstraintIds: [],
    };
  });
  assertUniqueIds(tasks, 'taskId', 'execution_projection_task_id_duplicate');
  const taskMap = new Map<string, (typeof tasks)[number]>(tasks.map((task) => [task.taskId, task]));
  for (const dependency of graph.dependencies || []) {
    if (!dependency || typeof dependency !== 'object') continue;
    const dependent = taskMap.get(dependency.from || dependency.taskId);
    if (dependent && (dependency.to || dependency.dependsOn)) {
      dependent.dependencyIds = unique([
        ...dependent.dependencyIds,
        dependency.to || dependency.dependsOn,
      ]);
    }
  }
  for (const task of tasks) {
    for (const dependencyId of task.dependencyIds) {
      if (!taskMap.has(dependencyId)) {
        throw failure('execution_projection_dependency_unknown', {
          taskId: task.taskId,
          dependencyId,
        });
      }
    }
  }
  return tasks.sort((left, right) => compareIds(left.taskId, right.taskId));
}

function normalizedSlices(graph, taskMap) {
  const slices = (graph.traceSlices || []).map((slice) => {
    const taskIds = unique(slice.taskIds || slice.goalIds);
    for (const taskId of taskIds) {
      if (!taskMap.has(taskId)) {
        throw failure('execution_projection_slice_task_unknown', {
          sliceId: slice.id || slice.sliceId || null,
          taskId,
        });
      }
    }
    const sourceIds = unique(
      asArray(slice.sourceIds).length > 0
        ? slice.sourceIds
        : taskIds.flatMap((taskId) => taskMap.get(taskId).sourceIds)
    );
    const sliceId = deriveId(slice.id || slice.sliceId, 'slice', {
      sourceIds,
      taskIds,
      outcome: slice.observableOutcome || slice.closeCondition || slice.title,
    });
    const evidenceOnly = slice.classification === 'evidence_only' || slice.codeBearing === false;
    const helperOnly = slice.classification === 'helper_only';
    return {
      sliceId,
      sourceIds,
      taskIds,
      observableOutcome: String(
        slice.observableOutcome || slice.closeCondition || slice.title || ''
      ),
      completionPredicateIds: [],
      evidenceContractIds: unique(slice.evidenceIds),
      sequenceConstraintIds: [],
      classification: helperOnly ? 'helper_only' : evidenceOnly ? 'evidence_only' : 'code_bearing',
      verificationOnly: slice.verificationOnly === true || evidenceOnly || helperOnly,
      productionEntries: asArray(slice.productionSymbols),
      allowedPaths: asArray(slice.allowedPaths),
    };
  });
  assertUniqueIds(slices, 'sliceId', 'execution_projection_slice_id_duplicate');
  return slices.sort((left, right) => compareIds(left.sliceId, right.sliceId));
}

function bindTaskOwners(tasks, slices) {
  const owners = new Map<string, string[]>(tasks.map((task) => [task.taskId, []]));
  for (const slice of slices) {
    for (const taskId of slice.taskIds) owners.get(taskId)?.push(slice.sliceId);
  }
  for (const task of tasks) {
    const ownerSliceIds = unique(owners.get(task.taskId));
    if (ownerSliceIds.length !== 1) {
      throw failure('execution_projection_task_ownership_unresolved', {
        taskId: task.taskId,
        ownerSliceIds,
      });
    }
    task.ownerSliceId = ownerSliceIds[0];
  }
}

function normalizedPredicates(graph, tasks, slices) {
  const taskMap = new Map<string, (typeof tasks)[number]>(tasks.map((task) => [task.taskId, task]));
  const sliceMap = new Map<string, (typeof slices)[number]>(
    slices.map((slice) => [slice.sliceId, slice])
  );
  const predicates = (graph.acceptanceItems || []).map((acceptance) => {
    const taskIds = unique(acceptance.taskIds || acceptance.goalIds);
    const referencedSliceIds = unique(acceptance.traceIds || acceptance.sliceIds);
    const candidateSliceIds =
      referencedSliceIds.length > 0
        ? referencedSliceIds
        : unique(taskIds.map((taskId) => taskMap.get(taskId)?.ownerSliceId));
    if (candidateSliceIds.length !== 1 || !sliceMap.has(candidateSliceIds[0])) {
      throw failure('execution_projection_predicate_ownership_unresolved', {
        acceptanceId: acceptance.id || null,
        candidateSliceIds,
      });
    }
    const slice = sliceMap.get(candidateSliceIds[0]);
    const predicateId = deriveId(acceptance.id || acceptance.predicateId, 'predicate', {
      sliceId: slice.sliceId,
      statement: acceptance.passCondition || acceptance.statement,
    });
    const predicate = {
      predicateId,
      sliceId: slice.sliceId,
      sourceIds: unique(
        asArray(acceptance.sourceIds).length > 0 ? acceptance.sourceIds : slice.sourceIds
      ),
      statement: String(
        acceptance.passCondition || acceptance.statement || acceptance.expectedResult || ''
      ),
      positive: acceptance.positive !== false,
      evidenceContractIds: unique(acceptance.expectedEvidenceIds),
    };
    slice.completionPredicateIds.push(predicateId);
    slice.evidenceContractIds.push(...predicate.evidenceContractIds);
    return predicate;
  });
  for (const slice of slices) {
    if (slice.completionPredicateIds.length > 0 || !slice.observableOutcome) continue;
    const predicateId = deriveId(null, 'predicate', {
      sliceId: slice.sliceId,
      statement: slice.observableOutcome,
    });
    predicates.push({
      predicateId,
      sliceId: slice.sliceId,
      sourceIds: [...slice.sourceIds],
      statement: slice.observableOutcome,
      positive: true,
      evidenceContractIds: unique(slice.evidenceContractIds),
    });
    slice.completionPredicateIds.push(predicateId);
  }
  for (const slice of slices) {
    slice.completionPredicateIds = unique(slice.completionPredicateIds);
    slice.evidenceContractIds = unique(slice.evidenceContractIds);
  }
  assertUniqueIds(predicates, 'predicateId', 'execution_projection_predicate_id_duplicate');
  return predicates.sort((left, right) => compareIds(left.predicateId, right.predicateId));
}

function normalizedEvidenceContracts(graph, predicates, slices, taskMap) {
  const sliceMap = new Map<string, (typeof slices)[number]>(
    slices.map((slice) => [slice.sliceId, slice])
  );
  const contracts = (graph.expectedEvidence || []).map((evidence) => {
    const evidenceContractId = deriveId(
      evidence.id || evidence.evidenceContractId,
      'evidence',
      evidence
    );
    const predicateProducers = predicates
      .filter((predicate) => predicate.evidenceContractIds.includes(evidenceContractId))
      .flatMap((predicate) => sliceMap.get(predicate.sliceId)?.taskIds || []);
    const explicitProducers = unique([
      ...asArray(evidence.producerTaskIds),
      ...(taskMap.has(evidence.producer) ? [evidence.producer] : []),
    ]);
    return {
      evidenceContractId,
      producerTaskIds: unique(
        explicitProducers.length > 0 ? explicitProducers : predicateProducers
      ),
      admissibleTypes: unique(
        evidence.admissibleTypes || evidence.evidenceTypes || evidence.evidenceType || ['behavior']
      ),
      freshnessRule: String(evidence.freshnessRule || ''),
    };
  });
  assertUniqueIds(contracts, 'evidenceContractId', 'execution_projection_evidence_id_duplicate');
  return contracts.sort((left, right) =>
    compareIds(left.evidenceContractId, right.evidenceContractId)
  );
}

function normalizeSequence({ input, tasks, slices }) {
  const receipt = input.sequenceApplicabilityReceipt || {};
  requireHash(receipt.receiptHash, 'sequenceApplicabilityReceipt.receiptHash');
  const sequenceInput = input.sequenceConstraintInput;
  const executionState =
    input.sequenceExecutionState ||
    deriveSequenceExecutionState({
      sequenceMode: receipt.sequenceMode || 'auto',
      sequenceApplicability: receipt.decision,
      producerAvailable: Boolean(sequenceInput),
    });
  if (
    ![
      'required',
      'not_applicable_with_proof',
      'unresolved',
    ].includes(receipt.decision)
  ) {
    throw failure('execution_projection_sequence_applicability_invalid', {
      decision: receipt.decision || null,
    });
  }
  if (
    receipt.decision === 'unresolved' &&
    executionState.sequenceMode !== 'disabled'
  ) {
    throw failure('execution_projection_sequence_applicability_invalid', {
      decision: receipt.decision,
    });
  }
  if (
    executionState.sequenceMode !== 'disabled' &&
    receipt.decision === 'required' &&
    !sequenceInput
  ) {
    throw failure('execution_projection_sequence_constraints_missing');
  }
  if (executionState.sequenceMode === 'disabled' && sequenceInput) {
    throw failure('execution_projection_sequence_constraints_unexpected');
  }
  if (receipt.decision === 'not_applicable_with_proof' && sequenceInput) {
    throw failure('execution_projection_sequence_constraints_unexpected');
  }
  if (sequenceInput) {
    const forbiddenFields = findForbiddenSequenceFields(sequenceInput);
    if (forbiddenFields.length > 0) {
      throw failure('execution_projection_sequence_second_task_universe', {
        forbiddenFields,
      });
    }
    for (const [field, expected] of [
      ['sourceSnapshotHash', input.sourceSnapshotHash],
      ['semanticModelHash', input.semanticModelHash],
      ['traceGraphHash', input.traceGraphHash],
    ]) {
      if (sequenceInput[field] !== expected) {
        throw failure('execution_projection_sequence_hash_mismatch', { field });
      }
    }
  }
  const taskMap = new Map<string, (typeof tasks)[number]>(tasks.map((task) => [task.taskId, task]));
  const sliceMap = new Map<string, (typeof slices)[number]>(
    slices.map((slice) => [slice.sliceId, slice])
  );
  const bundle = sequenceInput?.sequenceClosureBundle || {};
  const constraints = [];
  for (const key of Object.keys(bundle).sort(compareIds)) {
    if (key === 'integrationJoins' || !key.endsWith('Constraints')) continue;
    for (const raw of asArray(bundle[key])) {
      const taskIds = unique(raw.taskIds);
      for (const taskId of taskIds) {
        if (!taskMap.has(taskId)) {
          throw failure('execution_projection_sequence_task_unknown', {
            constraintType: key,
            taskId,
          });
        }
      }
      const constraintType = key.slice(0, -'Constraints'.length);
      const constraintId = deriveId(raw.constraintId, 'constraint', {
        constraintType,
        semantic: canonicalize(raw),
        taskIds,
      });
      const semantic = canonicalize(
        Object.fromEntries(
          Object.entries(raw).filter(
            ([field]) => !['constraintId', 'sliceIds', 'taskIds'].includes(field)
          )
        )
      );
      constraints.push({ constraintId, constraintType, taskIds, semantic });
      const affectedSliceIds = unique([
        ...asArray(raw.sliceIds),
        ...taskIds.map((taskId) => taskMap.get(taskId).ownerSliceId),
      ]);
      for (const sliceId of affectedSliceIds) {
        if (!sliceMap.has(sliceId)) {
          throw failure('execution_projection_sequence_slice_unknown', {
            constraintId,
            sliceId,
          });
        }
        sliceMap.get(sliceId).sequenceConstraintIds.push(constraintId);
      }
      for (const taskId of taskIds) {
        taskMap.get(taskId).sequenceConstraintIds.push(constraintId);
      }
    }
  }
  assertUniqueIds(
    constraints,
    'constraintId',
    'execution_projection_sequence_constraint_id_duplicate'
  );
  const joins = asArray(bundle.integrationJoins).map((raw) => {
    const inputTaskIds = unique(raw.inputTaskIds || raw.producerTaskIds);
    const ownerTaskId = String(raw.ownerTaskId || '');
    const interfaceId = deriveId(raw.interfaceId, 'interface', canonicalize(raw));
    const joinId = deriveId(raw.joinId, 'join', {
      inputTaskIds,
      interfaceId,
      ownerTaskId,
    });
    for (const taskId of [...inputTaskIds, ownerTaskId]) {
      if (!taskMap.has(taskId)) {
        throw failure('execution_projection_sequence_task_unknown', { joinId, taskId });
      }
    }
    return { joinId, inputTaskIds, ownerTaskId, interfaceId };
  });
  assertUniqueIds(joins, 'joinId', 'execution_projection_join_id_duplicate');
  for (const task of tasks) task.sequenceConstraintIds = unique(task.sequenceConstraintIds);
  for (const slice of slices) {
    slice.sequenceConstraintIds = unique(slice.sequenceConstraintIds);
  }
  const normalizedConstraints = constraints.sort((left, right) =>
    compareIds(left.constraintId, right.constraintId)
  );
  const normalizedJoins = joins.sort((left, right) => compareIds(left.joinId, right.joinId));
  return {
    binding: {
      sequenceMode: executionState.sequenceMode,
      applicabilityDecision: receipt.decision,
      applicabilityReceiptHash: receipt.receiptHash,
      sequenceCoverage: executionState.sequenceCoverage,
      sequenceClosureStatus: executionState.sequenceClosureStatus,
      childContractAuthority: executionState.childContractAuthority,
      sequenceContractHash: sequenceInput
        ? requireHash(sequenceInput.sequenceContractHash, 'sequenceContractHash')
        : null,
      semanticConstraintHash: hashValue({
        constraints: normalizedConstraints,
        joins: normalizedJoins,
      }),
      constraints: normalizedConstraints,
    },
    joins: normalizedJoins,
  };
}

function buildTaskDag(tasks, joins) {
  const edges = [];
  for (const task of tasks) {
    for (const dependencyId of task.dependencyIds) {
      edges.push({
        fromTaskId: dependencyId,
        toTaskId: task.taskId,
        reason: 'implementation_dependency',
        joinId: null,
      });
    }
  }
  for (const join of joins) {
    for (const inputTaskId of join.inputTaskIds) {
      edges.push({
        fromTaskId: inputTaskId,
        toTaskId: join.ownerTaskId,
        reason: 'integration_join',
        joinId: join.joinId,
      });
      const owner = tasks.find((task) => task.taskId === join.ownerTaskId);
      owner.dependencyIds = unique([...owner.dependencyIds, inputTaskId]);
    }
  }
  const uniqueEdges = [
    ...new Map<string, (typeof edges)[number]>(
      edges.map((edge) => [
        `${edge.fromTaskId}->${edge.toTaskId}:${edge.reason}:${edge.joinId || ''}`,
        edge,
      ])
    ).values(),
  ].sort((left, right) =>
    compareIds(
      `${left.fromTaskId}:${left.toTaskId}:${left.reason}:${left.joinId || ''}`,
      `${right.fromTaskId}:${right.toTaskId}:${right.reason}:${right.joinId || ''}`
    )
  );
  const outgoing = new Map<string, string[]>(tasks.map((task) => [task.taskId, []]));
  const indegree = new Map<string, number>(tasks.map((task) => [task.taskId, 0]));
  for (const edge of uniqueEdges) {
    if (!outgoing.has(edge.fromTaskId) || !indegree.has(edge.toTaskId)) {
      throw failure('execution_projection_dependency_unknown', { edge });
    }
    outgoing.get(edge.fromTaskId).push(edge.toTaskId);
    indegree.set(edge.toTaskId, indegree.get(edge.toTaskId) + 1);
  }
  const ready = [...indegree.entries()]
    .filter(([, count]) => count === 0)
    .map(([taskId]) => taskId)
    .sort(compareIds);
  const topologicalOrder: string[] = [];
  while (ready.length > 0) {
    const taskId = ready.shift();
    topologicalOrder.push(taskId);
    for (const dependentId of unique(outgoing.get(taskId))) {
      indegree.set(dependentId, indegree.get(dependentId) - 1);
      if (indegree.get(dependentId) === 0) {
        ready.push(dependentId);
        ready.sort(compareIds);
      }
    }
  }
  if (topologicalOrder.length !== tasks.length) {
    throw failure('execution_projection_task_cycle', {
      taskIds: tasks.map((task) => task.taskId),
    });
  }
  const taskMap = new Map<string, (typeof tasks)[number]>(tasks.map((task) => [task.taskId, task]));
  return {
    nodes: topologicalOrder.map((taskId, topologicalIndex) => ({
      taskId,
      ownerSliceId: taskMap.get(taskId).ownerSliceId,
      topologicalIndex,
    })),
    edges: uniqueEdges,
  };
}

function buildLiteralIndex(slices, field, idField, prefix) {
  const index = new Map<
    string,
    { [key: string]: string | string[]; literal: string; taskIds: string[] }
  >();
  for (const slice of slices) {
    for (const raw of slice[field]) {
      const literal = typeof raw === 'string' ? raw : raw?.literal || raw?.path || raw?.id;
      if (!literal) continue;
      const id = deriveId(typeof raw === 'object' ? raw.id : null, prefix, String(literal));
      const existing = index.get(id) || {
        [idField]: id,
        literal: String(literal),
        taskIds: [],
      };
      existing.taskIds = unique([...existing.taskIds, ...slice.taskIds]);
      index.set(id, existing);
    }
  }
  return [...index.values()].sort((left, right) => compareIds(left[idField], right[idField]));
}

function buildExecutionEpics(graph, tasks, slices) {
  const applicableSources = (graph.sourceObligations || []).filter(
    (source) => source.applicabilityState !== 'not_applicable'
  );
  return applicableSources
    .map((source) => {
      const sourceId = String(source.id);
      const taskIds = tasks
        .filter((task) => task.sourceIds.includes(sourceId))
        .map((task) => task.taskId);
      const traceSliceIds = slices
        .filter((slice) => slice.sourceIds.includes(sourceId))
        .map((slice) => slice.sliceId);
      return {
        epicId: deriveId(source.epicId, 'epic', sourceId),
        title: String(source.summary || source.title || sourceId),
        sourceIds: [sourceId],
        taskIds: unique(taskIds),
        traceSliceIds: unique(traceSliceIds),
      };
    })
    .filter((epic) => epic.taskIds.length > 0 || epic.traceSliceIds.length > 0)
    .sort((left, right) => compareIds(left.epicId, right.epicId));
}

function assertSourceCoverage(graph, slices, predicates) {
  const sourceIds = (graph.sourceObligations || [])
    .filter((source) => source.applicabilityState !== 'not_applicable')
    .map((source) => String(source.id));
  for (const sourceId of sourceIds) {
    if (
      !slices.some((slice) => slice.sourceIds.includes(sourceId)) ||
      !predicates.some((predicate) => predicate.sourceIds.includes(sourceId))
    ) {
      throw failure('execution_projection_source_coverage_missing', { sourceId });
    }
  }
}

function validateAgainstSchema(projection) {
  if (!executionProjectionSchemaValidator) {
    const repositoryRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
    const schemaPath = path.join(
      repositoryRoot,
      '_bmad',
      'shared',
      'goal-contract',
      'goal-contract-execution-projection.schema.json'
    );
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    executionProjectionSchemaValidator = new Ajv2020({
      allErrors: true,
      strict: false,
    }).compile(schema);
  }
  if (!executionProjectionSchemaValidator(projection)) {
    throw failure('execution_projection_schema_invalid', {
      validationErrors: executionProjectionSchemaValidator.errors || [],
    });
  }
}

function compileExecutionProjection(input) {
  for (const field of [
    'sourceSnapshotHash',
    'sourceObligationGraphHash',
    'methodologyProfileHash',
    'semanticModelHash',
    'traceGraphHash',
  ]) {
    requireHash(input?.[field], field);
  }
  const graph = input?.reconciledGraph;
  if (!graph || typeof graph !== 'object') {
    throw failure('execution_projection_reconciled_graph_missing');
  }
  const tasks = normalizedTasks(graph);
  const taskMap = new Map<string, (typeof tasks)[number]>(tasks.map((task) => [task.taskId, task]));
  const slices = normalizedSlices(graph, taskMap);
  bindTaskOwners(tasks, slices);
  const predicates = normalizedPredicates(graph, tasks, slices);
  const evidenceContracts = normalizedEvidenceContracts(graph, predicates, slices, taskMap);
  const sequence = normalizeSequence({ input, tasks, slices });
  const taskDag = buildTaskDag(tasks, sequence.joins);
  const integrationJoinGraph = { joins: sequence.joins };
  const executionEpics = buildExecutionEpics(graph, tasks, slices);
  assertSourceCoverage(graph, slices, predicates);
  const atomicTasks = tasks
    .map((task) => ({
      ...task,
      dependencyIds: unique(task.dependencyIds),
      sequenceConstraintIds: unique(task.sequenceConstraintIds),
    }))
    .sort((left, right) => compareIds(left.taskId, right.taskId));
  const traceSlices = slices
    .map(({ productionEntries: _entries, allowedPaths: _paths, ...slice }) => ({
      ...slice,
      completionPredicateIds: unique(slice.completionPredicateIds),
      evidenceContractIds: unique(slice.evidenceContractIds),
      sequenceConstraintIds: unique(slice.sequenceConstraintIds),
    }))
    .sort((left, right) => compareIds(left.sliceId, right.sliceId));
  const productionEntryIndex = buildLiteralIndex(
    slices,
    'productionEntries',
    'productionEntryId',
    'entry'
  );
  const fileScopeIndex = buildLiteralIndex(slices, 'allowedPaths', 'fileScopeId', 'file').map(
    ({ literal, ...entry }) => ({ ...entry, path: literal })
  );
  const reconciledGraphHash =
    input.reconciledGraphHash ||
    graph.reconciledGraphHash ||
    graph.graphInputHash ||
    hashValue({
      schemaVersion: graph.schemaVersion,
      executionEpics,
      traceSlices,
      atomicTasks,
      completionPredicates: predicates,
      evidenceContracts,
    });
  requireHash(reconciledGraphHash, 'reconciledGraphHash');
  const taskDagHash = hashValue(taskDag);
  const integrationJoinGraphHash = hashValue(integrationJoinGraph);
  const semanticProjection = {
    schemaVersion: 'goal-contract-execution-projection/v1',
    sourceSnapshotHash: input.sourceSnapshotHash,
    sourceObligationGraphHash: input.sourceObligationGraphHash,
    methodologyProfileHash: input.methodologyProfileHash,
    semanticModelHash: input.semanticModelHash,
    traceGraphHash: input.traceGraphHash,
    reconciledGraphHash,
    sequenceApplicabilityReceiptHash: input.sequenceApplicabilityReceipt.receiptHash,
    sequenceConstraintBinding: sequence.binding,
    executionEpics,
    traceSlices,
    atomicTasks,
    completionPredicates: predicates,
    evidenceContracts,
    productionEntryIndex,
    fileScopeIndex,
    taskDag,
    integrationJoinGraph,
    taskDagHash,
    integrationJoinGraphHash,
  };
  const projection = {
    ...semanticProjection,
    executionProjectionHash: hashValue(semanticProjection),
  };
  const semanticValidation = validateExecutionProjection(projection);
  if (semanticValidation.decision !== 'pass') {
    throw failure(semanticValidation.issues[0].code, {
      issues: semanticValidation.issues,
    });
  }
  validateAgainstSchema(projection);
  return deepFreeze(projection);
}

module.exports = {
  compileExecutionProjection,
};
