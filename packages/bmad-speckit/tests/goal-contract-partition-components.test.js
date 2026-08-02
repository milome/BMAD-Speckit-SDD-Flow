const { createHash } = require('node:crypto');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  buildPartitionComponents,
} = require('../src/utils/goal-contract/partition-components.ts');

const hash = (value) => `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;

function makePolicy(overrides = {}) {
  return {
    limits: {
      targetClosureMinutesPerPartition: {
        min: 120,
        max: 180,
      },
      maxClosureMinutesPerPartition: 240,
      ...overrides,
    },
  };
}

function makeProjection({
  slices = [
    { sliceId: 'slice-a', taskIds: ['task-a'] },
    { sliceId: 'slice-b', taskIds: ['task-b'] },
    { sliceId: 'slice-c', taskIds: ['task-c'] },
  ],
  edges = [
    {
      fromTaskId: 'task-a',
      toTaskId: 'task-c',
      reason: 'implementation_dependency',
      joinId: null,
    },
    {
      fromTaskId: 'task-b',
      toTaskId: 'task-c',
      reason: 'implementation_dependency',
      joinId: null,
    },
  ],
  constraints = [],
  productionEntryIndex = [],
  fileScopeIndex = [],
  evidenceContracts = null,
  joins = [],
} = {}) {
  const traceSlices = slices.map((slice) => ({
    sourceIds: [`source-${slice.sliceId}`],
    observableOutcome: `${slice.sliceId} closes`,
    completionPredicateIds: [`predicate-${slice.sliceId}`],
    evidenceContractIds:
      slice.evidenceContractIds ||
      slice.taskIds.map((taskId) => `evidence-${taskId}`),
    sequenceConstraintIds: constraints
      .filter((constraint) =>
        constraint.taskIds.some((taskId) => slice.taskIds.includes(taskId))
      )
      .map((constraint) => constraint.constraintId),
    classification: 'code_bearing',
    verificationOnly: false,
    ...slice,
  }));
  const atomicTasks = traceSlices.flatMap((slice) =>
    slice.taskIds.map((taskId) => ({
      taskId,
      title: `${taskId} title`,
      sourceIds: [...slice.sourceIds],
      ownerSliceId: slice.sliceId,
      dependencyIds: edges
        .filter((edge) => edge.toTaskId === taskId)
        .map((edge) => edge.fromTaskId),
      atomicGroupRefs: slice.atomicGroupRefs || [],
      estimatedClosureMinutes: slice.taskMinutes?.[taskId] ?? 30,
      sequenceConstraintIds: constraints
        .filter((constraint) => constraint.taskIds.includes(taskId))
        .map((constraint) => constraint.constraintId),
    }))
  );
  const completionPredicates = traceSlices.map((slice) => ({
    predicateId: slice.completionPredicateIds[0],
    sliceId: slice.sliceId,
    sourceIds: [...slice.sourceIds],
    statement: `${slice.sliceId} passes`,
    positive: true,
    evidenceContractIds: [...slice.evidenceContractIds],
  }));
  const resolvedEvidenceContracts =
    evidenceContracts ||
    atomicTasks.map((task) => ({
      evidenceContractId: `evidence-${task.taskId}`,
      producerTaskIds: [task.taskId],
      admissibleTypes: ['behavior'],
      freshnessRule: 'current source roots',
    }));
  return {
    schemaVersion: 'goal-contract-execution-projection/v1',
    sourceSnapshotHash: hash('source'),
    sourceObligationGraphHash: hash('obligations'),
    methodologyProfileHash: hash('methodology'),
    semanticModelHash: hash('semantic'),
    traceGraphHash: hash('trace'),
    reconciledGraphHash: hash('reconciled'),
    sequenceApplicabilityReceiptHash: hash('sequence-applicability'),
    sequenceConstraintBinding: {
      applicabilityDecision: constraints.length > 0 ? 'required' : 'not_applicable_with_proof',
      applicabilityReceiptHash: hash('sequence-applicability'),
      sequenceContractHash: constraints.length > 0 ? hash('sequence-contract') : null,
      semanticConstraintHash: hash(JSON.stringify(constraints)),
      constraints,
    },
    executionEpics: [],
    traceSlices,
    atomicTasks,
    completionPredicates,
    evidenceContracts: resolvedEvidenceContracts,
    productionEntryIndex,
    fileScopeIndex,
    taskDag: {
      nodes: atomicTasks.map((task, topologicalIndex) => ({
        taskId: task.taskId,
        ownerSliceId: task.ownerSliceId,
        topologicalIndex,
      })),
      edges,
    },
    integrationJoinGraph: { joins },
    executionProjectionHash: hash('projection'),
    taskDagHash: hash(JSON.stringify(edges)),
    integrationJoinGraphHash: hash(JSON.stringify(joins)),
  };
}

function topologicallySorted(componentGraph) {
  const indegree = new Map(
    componentGraph.components.map((component) => [component.componentId, 0])
  );
  const outgoing = new Map(
    componentGraph.components.map((component) => [component.componentId, []])
  );
  for (const edge of componentGraph.dependencyEdges) {
    indegree.set(edge.toComponentId, indegree.get(edge.toComponentId) + 1);
    outgoing.get(edge.fromComponentId).push(edge.toComponentId);
  }
  const ready = [...indegree.entries()]
    .filter(([, count]) => count === 0)
    .map(([componentId]) => componentId)
    .sort();
  const order = [];
  while (ready.length > 0) {
    const componentId = ready.shift();
    order.push(componentId);
    for (const dependentId of outgoing.get(componentId).sort()) {
      indegree.set(dependentId, indegree.get(dependentId) - 1);
      if (indegree.get(dependentId) === 0) {
        ready.push(dependentId);
        ready.sort();
      }
    }
  }
  return order;
}

function twoSliceProjection() {
  return makeProjection({
    slices: [
      { sliceId: 'slice-a', taskIds: ['task-a'] },
      { sliceId: 'slice-b', taskIds: ['task-b'] },
    ],
    edges: [],
  });
}

it('rejects orphan integration joins and integration edges', () => {
  const integrationEdge = {
    fromTaskId: 'task-a',
    toTaskId: 'task-b',
    reason: 'integration_join',
    joinId: 'join-b',
  };
  const join = {
    joinId: 'join-b',
    inputTaskIds: ['task-a'],
    ownerTaskId: 'task-b',
    interfaceId: 'interface-b',
  };
  const orphanEdge = makeProjection({
    slices: [
      { sliceId: 'slice-a', taskIds: ['task-a'] },
      { sliceId: 'slice-b', taskIds: ['task-b'] },
    ],
    edges: [integrationEdge],
    joins: [],
  });
  const orphanJoin = makeProjection({
    slices: [
      { sliceId: 'slice-a', taskIds: ['task-a'] },
      { sliceId: 'slice-b', taskIds: ['task-b'] },
    ],
    edges: [],
    joins: [join],
  });

  for (const projection of [orphanEdge, orphanJoin]) {
    assert.throws(
      () =>
        buildPartitionComponents({
          executionProjection: projection,
          policy: makePolicy(),
        }),
      (error) =>
        error.failureClass === 'partition_dependency_authority_invalid' &&
        error.reason === 'integration_join_mapping_mismatch'
    );
  }
});

describe('goal-contract partition components', () => {
  it('covers every Trace Slice exactly once and publishes a deterministic DAG', () => {
    const executionProjection = makeProjection();
    const result = buildPartitionComponents({
      executionProjection,
      policy: makePolicy(),
    });

    assert.equal(result.schemaVersion, 'goal-contract-partition-components/v1');
    assert.equal(result.primaryUnitType, 'trace_slice');
    assert.equal(
      new Set(result.components.flatMap((item) => item.traceSliceIds)).size,
      executionProjection.traceSlices.length
    );
    assert.deepEqual(result.topologicalOrder, topologicallySorted(result));
    assert.equal(
      result.components.every((component) =>
        component.mustLinkReasonCodes.includes('trace_slice_atomicity')
      ),
      true
    );
  });

  it('collapses only explicit atomic must-link authority', () => {
    const cases = [
      [
        'crash_safe_transaction',
        (projection) => {
          const constraint = {
            constraintId: 'constraint-transaction',
            constraintType: 'crash_safe_transaction',
            taskIds: ['task-a', 'task-b'],
            semantic: { atomic: true },
          };
          projection.sequenceConstraintBinding.constraints.push(constraint);
        },
      ],
      [
        'source_atomic_co_change',
        (projection) => {
          for (const task of projection.atomicTasks) {
            task.atomicGroupRefs = ['atomic-source-group'];
          }
        },
      ],
    ];

    for (const [reasonCode, mutate] of cases) {
      const executionProjection = twoSliceProjection();
      mutate(executionProjection);
      const result = buildPartitionComponents({
        executionProjection,
        policy: makePolicy(),
      });
      assert.equal(result.components.length, 1, reasonCode);
      assert.equal(
        result.components[0].mustLinkReasonCodes.includes(reasonCode),
        true,
        reasonCode
      );
    }
  });

  it('keeps shared references decomposable and delegates them to ownership', () => {
    const executionProjection = twoSliceProjection();
    executionProjection.productionEntryIndex.push({
      productionEntryId: 'entry-public-action',
      literal: 'goalContractCommand',
      taskIds: ['task-a', 'task-b'],
    });
    executionProjection.fileScopeIndex.push({
      fileScopeId: 'file-shared-schema',
      path: '_bmad/shared/example.schema.json',
      taskIds: ['task-a', 'task-b'],
    });
    executionProjection.evidenceContracts = [
      {
        evidenceContractId: 'receipt-current',
        producerTaskIds: ['task-a'],
        admissibleTypes: ['receipt'],
        freshnessRule: 'current source roots',
      },
    ];
    for (const slice of executionProjection.traceSlices) {
      slice.evidenceContractIds = ['receipt-current'];
    }
    for (const predicate of executionProjection.completionPredicates) {
      predicate.evidenceContractIds = ['receipt-current'];
    }

    const result = buildPartitionComponents({
      executionProjection,
      policy: makePolicy(),
    });

    assert.equal(result.components.length, 2);
    assert.equal(result.sharedArtifactOwnership.length, 1);
    assert.equal(
      result.sharedArtifactOwnership[0].participatingComponentIds.length,
      2
    );
  });

  it('keeps all tasks in one non-decomposable Trace Slice', () => {
    const executionProjection = makeProjection({
      slices: [{ sliceId: 'slice-atomic', taskIds: ['task-a', 'task-b'] }],
      edges: [],
    });
    const result = buildPartitionComponents({
      executionProjection,
      policy: makePolicy(),
    });

    assert.equal(result.components.length, 1);
    assert.deepEqual(result.components[0].traceSliceIds, ['slice-atomic']);
    assert.deepEqual(result.components[0].atomicTaskIds, ['task-a', 'task-b']);
  });

  it('allows more than four small tasks when closure minutes remain within policy', () => {
    const taskIds = Array.from({ length: 6 }, (_, index) => `task-${index}`);
    const executionProjection = makeProjection({
      slices: [
        {
          sliceId: 'slice-small-tasks',
          taskIds,
          taskMinutes: Object.fromEntries(taskIds.map((taskId) => [taskId, 20])),
        },
      ],
      edges: [],
    });

    const result = buildPartitionComponents({
      executionProjection,
      policy: makePolicy(),
    });

    assert.equal(result.components[0].atomicTaskIds.length, 6);
    assert.equal(result.components[0].estimatedClosureMinutes, 120);
  });

  it('rejects an atomic component that exceeds the four-hour closure policy', () => {
    const executionProjection = twoSliceProjection();
    for (const task of executionProjection.atomicTasks) {
      task.estimatedClosureMinutes = 121;
    }
    executionProjection.sequenceConstraintBinding.constraints.push({
      constraintId: 'constraint-transaction',
      constraintType: 'crash_safe_transaction',
      taskIds: ['task-a', 'task-b'],
      semantic: { atomic: true },
    });

    assert.throws(
      () =>
        buildPartitionComponents({
          executionProjection,
          policy: makePolicy(),
        }),
      (error) =>
        error.failureClass === 'partition_atomic_component_exceeds_policy' &&
        error.estimatedClosureMinutes === 242
    );
  });

  it('rejects unknown task and Slice dependencies', () => {
    const unknownTask = makeProjection();
    unknownTask.taskDag.edges.push({
      fromTaskId: 'task-missing',
      toTaskId: 'task-c',
      reason: 'implementation_dependency',
      joinId: null,
    });
    assert.throws(
      () =>
        buildPartitionComponents({
          executionProjection: unknownTask,
          policy: makePolicy(),
        }),
      (error) => error.failureClass === 'partition_unknown_dependency'
    );

    const unknownSlice = makeProjection();
    unknownSlice.taskDag.nodes[0].ownerSliceId = 'slice-missing';
    assert.throws(
      () =>
        buildPartitionComponents({
          executionProjection: unknownSlice,
          policy: makePolicy(),
        }),
      (error) => error.failureClass === 'partition_unknown_dependency'
    );
  });

  it('rejects task ownership and DAG node universes that diverge from Atomic Tasks', () => {
    const missingOwnerMembership = twoSliceProjection();
    missingOwnerMembership.traceSlices[0].taskIds = [];
    assert.throws(
      () =>
        buildPartitionComponents({
          executionProjection: missingOwnerMembership,
          policy: makePolicy(),
        }),
      (error) =>
        error.failureClass === 'partition_unknown_dependency' &&
        error.reason === 'task_owner_slice_mismatch'
    );

    const missingDagNode = twoSliceProjection();
    missingDagNode.taskDag.nodes.pop();
    assert.throws(
      () =>
        buildPartitionComponents({
          executionProjection: missingDagNode,
          policy: makePolicy(),
        }),
      (error) =>
        error.failureClass === 'partition_dependency_authority_invalid' &&
        error.reason === 'task_dag_node_coverage_mismatch'
    );
  });

  it('rejects task dependency declarations that diverge from typed DAG edges', () => {
    const executionProjection = twoSliceProjection();
    executionProjection.atomicTasks[1].dependencyIds = ['task-a'];

    assert.throws(
      () =>
        buildPartitionComponents({
          executionProjection,
          policy: makePolicy(),
        }),
      (error) =>
        error.failureClass === 'partition_dependency_authority_invalid' &&
        error.reason === 'task_dependency_projection_mismatch'
    );
  });

  it('rejects a dependency cycle after component collapse', () => {
    const executionProjection = twoSliceProjection();
    executionProjection.taskDag.edges = [
      {
        fromTaskId: 'task-a',
        toTaskId: 'task-b',
        reason: 'implementation_dependency',
        joinId: null,
      },
      {
        fromTaskId: 'task-b',
        toTaskId: 'task-a',
        reason: 'implementation_dependency',
        joinId: null,
      },
    ];
    executionProjection.atomicTasks.find(
      (task) => task.taskId === 'task-a'
    ).dependencyIds = ['task-b'];
    executionProjection.atomicTasks.find(
      (task) => task.taskId === 'task-b'
    ).dependencyIds = ['task-a'];

    assert.throws(
      () =>
        buildPartitionComponents({
          executionProjection,
          policy: makePolicy(),
        }),
      (error) => error.failureClass === 'partition_dependency_cycle'
    );
  });

  it('selects the earliest DAG participant as the shared-artifact owner', () => {
    const executionProjection = makeProjection({
      slices: [
        { sliceId: 'slice-0', taskIds: ['task-0'] },
        { sliceId: 'slice-14', taskIds: ['task-14'] },
      ],
      edges: [
        {
          fromTaskId: 'task-0',
          toTaskId: 'task-14',
          reason: 'implementation_dependency',
          joinId: null,
        },
      ],
      fileScopeIndex: [
        {
          fileScopeId: 'file-shared-source',
          path: 'packages/shared/source.ts',
          taskIds: ['task-14', 'task-0'],
        },
      ],
    });

    const result = buildPartitionComponents({
      executionProjection,
      policy: makePolicy(),
    });
    const ownership = result.sharedArtifactOwnership.find(
      (item) => item.fileScopeId === 'file-shared-source'
    );
    const predecessor = result.components.find((component) =>
      component.traceSliceIds.includes('slice-0')
    );
    const dependent = result.components.find((component) =>
      component.traceSliceIds.includes('slice-14')
    );

    assert.equal(ownership.participatingComponentIds.length, 2);
    assert.ok(predecessor.componentId > dependent.componentId);
    assert.deepEqual(ownership.participatingComponentIds, [
      predecessor.componentId,
      dependent.componentId,
    ]);
    assert.equal(ownership.ownerComponentId, predecessor.componentId);
  });

  it('rejects display-order edges as dependency authority', () => {
    const executionProjection = twoSliceProjection();
    executionProjection.taskDag.edges.push({
      fromTaskId: 'task-a',
      toTaskId: 'task-b',
      reason: 'runtime_display_order',
      joinId: null,
    });

    assert.throws(
      () =>
        buildPartitionComponents({
          executionProjection,
          policy: makePolicy(),
        }),
      (error) => error.failureClass === 'partition_dependency_authority_invalid'
    );
  });
});
