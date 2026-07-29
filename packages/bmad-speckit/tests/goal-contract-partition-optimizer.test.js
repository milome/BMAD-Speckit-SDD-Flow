const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  optimizePartitions,
  validatePartitionCandidate,
} = require('../src/utils/goal-contract/partition-optimizer.ts');
const {
  buildPartitionComponents,
} = require('../src/utils/goal-contract/partition-components.ts');
const {
  compileExecutionProjection,
} = require('../src/utils/goal-contract/execution-projection.ts');
const {
  assertCurrentPartitionPolicyBinding,
  loadPartitionPolicy,
} = require('../src/utils/goal-contract/partition-policy.ts');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ASSET_DIR = path.join('_bmad', 'shared', 'goal-contract');
const POLICY_NAME = 'goal-contract-partition-policy.json';
const POLICY_SCHEMA_NAME = 'goal-contract-partition-policy.schema.json';
const hash = (value) => `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function compareIds(left, right) {
  return String(left).localeCompare(String(right), 'en', {
    numeric: true,
    sensitivity: 'base',
  });
}

function sealExecutionProjection(projection) {
  if (projection.taskDag) {
    projection.taskDagHash = hash(stableStringify(projection.taskDag));
  }
  if (projection.integrationJoinGraph) {
    projection.integrationJoinGraphHash = hash(
      stableStringify(projection.integrationJoinGraph)
    );
  }
  const { executionProjectionHash: _ignored, ...semanticProjection } = projection;
  projection.executionProjectionHash = hash(stableStringify(semanticProjection));
  return projection;
}

function resealExecutionProjectionIdentity(projection) {
  const { executionProjectionHash: _ignored, ...semanticProjection } = projection;
  projection.executionProjectionHash = hash(stableStringify(semanticProjection));
  return projection;
}

function makeComponent(id, overrides = {}) {
  const component = {
    traceSliceIds: [`slice-${id}`],
    atomicTaskIds: [`task-${id}`],
    sourceIds: [`source-${id}`],
    completionPredicateIds: [`predicate-${id}`],
    evidenceContractIds: [`evidence-${id}`],
    sequenceConstraintIds: [],
    productionEntryIds: [`entry-${id}`],
    fileScopeIds: [`file-${id}`],
    verificationOnly: false,
    mustLinkReasonCodes: ['trace_slice_atomicity'],
    estimatedClosureMinutes: 30,
    closureMinuteBreakdown: {
      declaredTaskMinutes: 30,
      derivedTaskMinutes: 0,
      verificationMinutes: 0,
      coordinationMinutes: 0,
      totalMinutes: 30,
    },
    ...overrides,
  };
  component.componentId = `component-${hash(
    stableStringify({
      traceSliceIds: [...component.traceSliceIds].sort(),
      mustLinkReasonCodes: [...component.mustLinkReasonCodes].sort(),
    })
  ).slice('sha256:'.length, 23)}`;
  return component;
}

function componentIdFor(graph, alias) {
  return graph.components.find((component) =>
    component.traceSliceIds.includes(`slice-${alias}`)
  )?.componentId;
}

function canonicalTopologicalOrder(components, dependencyEdges) {
  const indegree = new Map(
    components.map((component) => [component.componentId, 0])
  );
  const outgoing = new Map(
    components.map((component) => [component.componentId, []])
  );
  for (const edge of dependencyEdges) {
    indegree.set(edge.toComponentId, indegree.get(edge.toComponentId) + 1);
    outgoing.get(edge.fromComponentId).push(edge.toComponentId);
  }
  const ready = [...indegree.entries()]
    .filter(([, count]) => count === 0)
    .map(([componentId]) => componentId)
    .sort(compareIds);
  const order = [];
  while (ready.length > 0) {
    const componentId = ready.shift();
    order.push(componentId);
    for (const dependentId of [
      ...new Set(outgoing.get(componentId)),
    ].sort(compareIds)) {
      indegree.set(dependentId, indegree.get(dependentId) - 1);
      if (indegree.get(dependentId) === 0) {
        ready.push(dependentId);
        ready.sort(compareIds);
      }
    }
  }
  return order;
}

function synchronizeSharedArtifactOwnership(componentGraph) {
  const componentById = new Map(
    componentGraph.components.map((component) => [
      component.componentId,
      component,
    ])
  );
  const ownerships = [...(componentGraph.sharedArtifactOwnership || [])];
  for (const ownership of ownerships) {
    for (const componentId of ownership.participatingComponentIds || []) {
      const component = componentById.get(componentId);
      if (
        component &&
        !component.fileScopeIds.includes(ownership.fileScopeId)
      ) {
        component.fileScopeIds.push(ownership.fileScopeId);
      }
    }
  }
  const ownedScopeIds = new Set(
    ownerships.map((ownership) => ownership.fileScopeId)
  );
  for (const component of componentGraph.components) {
    for (const fileScopeId of component.fileScopeIds) {
      if (ownedScopeIds.has(fileScopeId)) continue;
      ownerships.push({
        fileScopeId,
        path: `src/${fileScopeId}.ts`,
        ownerComponentId: component.componentId,
        participatingComponentIds: [component.componentId],
      });
      ownedScopeIds.add(fileScopeId);
    }
  }
  const position = new Map(
    componentGraph.topologicalOrder.map((componentId, index) => [
      componentId,
      index,
    ])
  );
  for (const ownership of ownerships) {
    ownership.participatingComponentIds.sort(
      (left, right) =>
        position.get(left) - position.get(right) || compareIds(left, right)
    );
  }
  componentGraph.sharedArtifactOwnership = ownerships;
  return componentGraph;
}

function makeGraph({
  ids = ['a'],
  edges = [],
  components = null,
  sharedArtifactOwnership = null,
  integrationFanInOwnership = [],
  topologicalOrder = null,
} = {}) {
  const resolvedComponents = components || ids.map((id) => makeComponent(id));
  const resolveComponentId = (value) => {
    if (resolvedComponents.some((component) => component.componentId === value)) {
      return value;
    }
    const alias = String(value).replace(/^component-/u, '');
    return componentIdFor({ components: resolvedComponents }, alias) || value;
  };
  const resolvedIntegrationFanInOwnership = integrationFanInOwnership.map(
    (ownership) => ({
      ...ownership,
      ownerComponentId: resolveComponentId(ownership.ownerComponentId),
      inputComponentIds: ownership.inputComponentIds.map(resolveComponentId),
    })
  );
  const resolvedSharedArtifactOwnership = sharedArtifactOwnership?.map(
    (ownership) => ({
      ...ownership,
      ownerComponentId: resolveComponentId(ownership.ownerComponentId),
      participatingComponentIds:
        ownership.participatingComponentIds.map(resolveComponentId),
    })
  );
  const dependencyEdges = edges.map(
    ([from, to, reason = 'implementation_dependency']) => {
      const fromComponentId = resolveComponentId(from);
      const toComponentId = resolveComponentId(to);
      const join =
        reason === 'integration_join'
          ? resolvedIntegrationFanInOwnership.find(
              (ownership) =>
                ownership.ownerComponentId === toComponentId &&
                ownership.inputComponentIds.includes(fromComponentId)
            )
          : null;
      const taskEdges = [
        {
          fromTaskId: `task-${from}`,
          toTaskId: `task-${to}`,
          reason,
          joinId: join?.joinId || null,
        },
      ];
      return {
        edgeId: `component-edge-${hash(
          stableStringify({
            fromComponentId,
            toComponentId,
            reasonCodes: [reason],
            taskEdges,
          })
        ).slice('sha256:'.length, 23)}`,
        fromComponentId,
        toComponentId,
        reasonCodes: [reason],
        taskEdges,
      };
    }
  );
  return synchronizeSharedArtifactOwnership({
    schemaVersion: 'goal-contract-partition-components/v1',
    primaryUnitType: 'trace_slice',
    executionProjectionHash: hash(`projection:${ids.join(',')}`),
    components: resolvedComponents,
    dependencyEdges,
    topologicalOrder:
      topologicalOrder?.map(resolveComponentId) ||
      canonicalTopologicalOrder(resolvedComponents, dependencyEdges),
    sharedArtifactOwnership: resolvedSharedArtifactOwnership || [],
    integrationFanInOwnership: resolvedIntegrationFanInOwnership,
  });
}

function makeExecutionProjection(componentGraph, suffix = 'current') {
  synchronizeSharedArtifactOwnership(componentGraph);
  const executionProjection = {
    schemaVersion: 'goal-contract-execution-projection/v1',
    sourceSnapshotHash: hash(`source:${suffix}`),
    semanticModelHash: hash(`semantic:${suffix}`),
    traceSlices: componentGraph.components.flatMap((component) =>
      component.traceSliceIds.map((sliceId) => ({
        sliceId,
        sourceIds: [...component.sourceIds],
        taskIds: [...component.atomicTaskIds],
        observableOutcome: `${sliceId} closes`,
        completionPredicateIds: [...component.completionPredicateIds],
        evidenceContractIds: [...component.evidenceContractIds],
        sequenceConstraintIds: [...component.sequenceConstraintIds],
        verificationOnly: component.verificationOnly,
      }))
    ),
    atomicTasks: componentGraph.components.flatMap((component) => {
      const taskCount = component.atomicTaskIds.length;
      const baseMinutes = Math.floor(
        component.estimatedClosureMinutes / taskCount
      );
      const remainder = component.estimatedClosureMinutes % taskCount;
      return component.atomicTaskIds.map((taskId, index) => ({
        taskId,
        sourceIds: [...component.sourceIds],
        ownerSliceId: component.traceSliceIds[0],
        estimatedClosureMinutes: baseMinutes + (index < remainder ? 1 : 0),
        dependencyIds: [
          ...new Set(
            componentGraph.dependencyEdges.flatMap((edge) =>
              edge.taskEdges
                .filter((taskEdge) => taskEdge.toTaskId === taskId)
                .map((taskEdge) => taskEdge.fromTaskId)
            )
          ),
        ].sort(),
        sequenceConstraintIds: [...component.sequenceConstraintIds],
      }));
    }),
    productionEntryIndex: componentGraph.components.flatMap((component) =>
      component.productionEntryIds.map((productionEntryId) => ({
        productionEntryId,
        literal: `entry:${productionEntryId}`,
        taskIds: [...component.atomicTaskIds],
      }))
    ),
    fileScopeIndex: componentGraph.sharedArtifactOwnership.map((ownership) => ({
      fileScopeId: ownership.fileScopeId,
      path: ownership.path,
      taskIds: ownership.participatingComponentIds.flatMap(
        (componentId) =>
          componentGraph.components.find(
            (component) => component.componentId === componentId
          ).atomicTaskIds
      ),
    })),
    taskDag: {
      nodes: componentGraph.topologicalOrder.flatMap(
        (componentId, componentIndex) => {
          const component = componentGraph.components.find(
            (candidate) => candidate.componentId === componentId
          );
          return component.atomicTaskIds.map((taskId, taskIndex) => ({
            taskId,
            ownerSliceId: component.traceSliceIds[0],
            topologicalIndex: componentIndex * 100 + taskIndex,
          }));
        }
      ),
      edges: componentGraph.dependencyEdges.flatMap((edge) =>
        edge.taskEdges.map((taskEdge) => ({ ...taskEdge }))
      ),
    },
    integrationJoinGraph: {
      joins: componentGraph.integrationFanInOwnership.map((ownership) => ({
        joinId: ownership.joinId,
        inputTaskIds: ownership.inputComponentIds.map(
          (componentId) =>
            componentGraph.components.find(
              (component) => component.componentId === componentId
            ).atomicTaskIds[0]
        ),
        ownerTaskId: componentGraph.components.find(
          (component) => component.componentId === ownership.ownerComponentId
        ).atomicTaskIds[0],
        interfaceId: ownership.interfaceId,
      })),
    },
  };
  sealExecutionProjection(executionProjection);
  componentGraph.executionProjectionHash =
    executionProjection.executionProjectionHash;
  return executionProjection;
}

function policyBindingFor(executionProjection, mutate = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partition-optimizer-policy-'));
  const directory = path.join(root, ASSET_DIR);
  fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(
    path.join(REPO_ROOT, ASSET_DIR, POLICY_SCHEMA_NAME),
    path.join(directory, POLICY_SCHEMA_NAME)
  );
  const policy = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, ASSET_DIR, POLICY_NAME), 'utf8')
  );
  if (mutate) mutate(policy);
  fs.writeFileSync(
    path.join(directory, POLICY_NAME),
    `${JSON.stringify(policy, null, 2)}\n`,
    'utf8'
  );
  const loaded = loadPartitionPolicy({ packageRoot: root });
  return assertCurrentPartitionPolicyBinding({
    policyBinding: loaded,
    sourceSnapshotHash: executionProjection.sourceSnapshotHash,
    semanticModelHash: executionProjection.semanticModelHash,
    executionProjectionHash: executionProjection.executionProjectionHash,
  });
}

function optimizeScenario({ graph, suffix, mutatePolicy = null }) {
  const executionProjection = makeExecutionProjection(graph, suffix);
  const policyBinding = policyBindingFor(executionProjection, mutatePolicy);
  return {
    executionProjection,
    policyBinding,
    result: optimizePartitions({
      componentGraph: graph,
      executionProjection,
      policyBinding,
    }),
  };
}

function clone(value) {
  return structuredClone(value);
}

function canonicalIntegrationProjectionAuthority() {
  const roots = {
    sourceSnapshotHash: hash('canonical-source'),
    sourceObligationGraphHash: hash('canonical-obligations'),
    methodologyProfileHash: hash('canonical-methodology'),
    semanticModelHash: hash('canonical-semantic'),
    traceGraphHash: hash('canonical-trace'),
  };
  return {
    ...roots,
    reconciledGraph: {
      schemaVersion: 'goal-contract-reconciled-graph-input/v2',
      sourceObligations: [
        {
          id: 'source-a',
          applicabilityState: 'applicable',
          summary: 'Source A',
        },
        {
          id: 'source-b',
          applicabilityState: 'applicable',
          summary: 'Source B',
        },
      ],
      tasks: [
        {
          id: 'task-a',
          title: 'Task A',
          sourceIds: ['source-a'],
          estimatedClosureMinutes: 30,
        },
        {
          id: 'task-b',
          title: 'Task B',
          sourceIds: ['source-b'],
          estimatedClosureMinutes: 30,
        },
      ],
      traceSlices: [
        {
          id: 'slice-a',
          goalIds: ['task-a'],
          sourceIds: ['source-a'],
          acceptanceIds: ['acceptance-a'],
          evidenceIds: ['evidence-a'],
          productionSymbols: ['entry-a'],
          allowedPaths: ['src/a.ts'],
          dependencies: [],
          closeCondition: 'A closes.',
        },
        {
          id: 'slice-b',
          goalIds: ['task-b'],
          sourceIds: ['source-b'],
          acceptanceIds: ['acceptance-b'],
          evidenceIds: ['evidence-b'],
          productionSymbols: ['entry-b'],
          allowedPaths: ['src/b.ts'],
          dependencies: [],
          closeCondition: 'B closes.',
        },
      ],
      dependencies: [],
      acceptanceItems: [
        {
          id: 'acceptance-a',
          traceIds: ['slice-a'],
          goalIds: ['task-a'],
          sourceIds: ['source-a'],
          passCondition: 'A passes.',
          expectedEvidenceIds: ['evidence-a'],
        },
        {
          id: 'acceptance-b',
          traceIds: ['slice-b'],
          goalIds: ['task-b'],
          sourceIds: ['source-b'],
          passCondition: 'B passes.',
          expectedEvidenceIds: ['evidence-b'],
        },
      ],
      expectedEvidence: [
        {
          id: 'evidence-a',
          producerTaskIds: ['task-a'],
          admissibleTypes: ['behavior'],
          freshnessRule: 'current',
        },
        {
          id: 'evidence-b',
          producerTaskIds: ['task-b'],
          admissibleTypes: ['behavior'],
          freshnessRule: 'current',
        },
      ],
      productionEntryPoints: ['entry-a', 'entry-b'],
    },
    sequenceApplicabilityReceipt: {
      decision: 'required',
      receiptHash: hash('canonical-required'),
    },
    sequenceConstraintInput: {
      ...roots,
      sequenceContractHash: hash('canonical-sequence-contract'),
      sequenceClosureBundle: {
        integrationJoins: [
          {
            joinId: 'join-b',
            inputTaskIds: ['task-a'],
            ownerTaskId: 'task-b',
            interfaceId: 'interface-b',
          },
        ],
      },
    },
  };
}

describe('goal-contract partition optimizer', () => {
  it('derives dynamic partition counts for distinct source shapes', () => {
    const corpus = [
      {
        suffix: 'cohesive',
        graph: makeGraph({ ids: ['a'] }),
      },
      {
        suffix: 'serial',
        graph: makeGraph({
          ids: ['a', 'b', 'c', 'd'],
          edges: [
            ['a', 'b'],
            ['b', 'c'],
            ['c', 'd'],
          ],
        }),
        mutatePolicy: (policy) => {
          policy.limits.maxClosureMinutesPerPartition = 60;
          policy.limits.targetClosureMinutesPerPartition = { min: 30, max: 60 };
        },
      },
      {
        suffix: 'parallel',
        graph: makeGraph({ ids: ['a', 'b', 'c', 'd'] }),
        mutatePolicy: (policy) => {
          policy.limits.maxClosureMinutesPerPartition = 30;
          policy.limits.targetClosureMinutesPerPartition = { min: 30, max: 30 };
        },
      },
      {
        suffix: 'integration',
        graph: makeGraph({
          ids: ['a', 'b', 'join'],
          edges: [
            ['a', 'join', 'integration_join'],
            ['b', 'join', 'integration_join'],
          ],
          integrationFanInOwnership: [
            {
              joinId: 'join-fan-in',
              ownerComponentId: 'component-join',
              inputComponentIds: ['component-a', 'component-b'],
              interfaceId: 'interface-current',
            },
          ],
        }),
        mutatePolicy: (policy) => {
          policy.limits.maxClosureMinutesPerPartition = 60;
          policy.limits.targetClosureMinutesPerPartition = { min: 30, max: 60 };
        },
      },
    ];
    const results = corpus.map((scenario) => optimizeScenario(scenario));

    assert.ok(new Set(results.map(({ result }) => result.partitionCount)).size > 1);
    for (const { executionProjection, policyBinding, result } of results) {
      assert.equal(result.decision, 'selected');
      assert.equal(result.partitionCount, result.partitions.length);
      assert.equal(
        result.selectedCandidateId,
        result.candidates.find((candidate) => candidate.selected).candidateId
      );
      assert.deepEqual(
        result.partitions.flatMap((partition) => partition.primaryTraceSliceIds).sort(),
        executionProjection.traceSlices.map((slice) => slice.sliceId).sort()
      );
      assert.equal(
        result.partitions.every((partition) => partition.partitionRoleDerived === true),
        true
      );
      assert.equal(result.sourceSnapshotHash, executionProjection.sourceSnapshotHash);
      assert.equal(result.partitionPolicyHash, policyBinding.partitionPolicyHash);
    }
  });

  it('derives a terminal verification-only zero-write partition as final integration', () => {
    const implementation = makeComponent('implementation');
    const verification = makeComponent('verification', {
      fileScopeIds: [],
      productionEntryIds: [],
      verificationOnly: true,
    });
    const graph = makeGraph({
      components: [implementation, verification],
      edges: [['implementation', 'verification']],
    });
    const executionProjection = makeExecutionProjection(
      graph,
      'terminal-verification-only'
    );
    const result = optimizePartitions({
      componentGraph: graph,
      executionProjection,
      policyBinding: policyBindingFor(executionProjection, (policy) => {
        policy.limits.maxClosureMinutesPerPartition = 30;
        policy.limits.targetClosureMinutesPerPartition = {
          min: 30,
          max: 30,
        };
      }),
    });
    const verificationPartition = result.partitions.find((partition) =>
      partition.primaryTaskIds.includes('task-verification')
    );

    assert.equal(verificationPartition.partitionRole, 'final_integration');
    assert.equal(verificationPartition.primaryWriteScopeOwnerCount, 0);
    assert.equal(verificationPartition.dependencyPartitionIds.length, 1);
  });

  it('rejects split atomic components and duplicate primary owners', () => {
    const splitGraph = makeGraph({ ids: ['a', 'b'] });
    const splitProjection = makeExecutionProjection(splitGraph, 'split');
    splitGraph.components[1].traceSliceIds = ['slice-a'];
    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: splitGraph,
          executionProjection: splitProjection,
          policyBinding: policyBindingFor(splitProjection),
        }),
      (error) =>
        error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'component_graph_canonical_mismatch'
    );

    const ownerGraph = makeGraph({ ids: ['a', 'b'] });
    const ownerProjection = makeExecutionProjection(ownerGraph, 'owner');
    ownerGraph.components[1].atomicTaskIds = ['task-a'];
    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: ownerGraph,
          executionProjection: ownerProjection,
          policyBinding: policyBindingFor(ownerProjection),
        }),
      (error) =>
        error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'component_graph_canonical_mismatch'
    );
  });

  it('rejects missing closure and future implementation dependencies', () => {
    const closureGraph = makeGraph({
      components: [
        makeComponent('a', {
          completionPredicateIds: [],
          evidenceContractIds: [],
        }),
      ],
    });
    const closureProjection = makeExecutionProjection(closureGraph, 'closure');
    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: closureGraph,
          executionProjection: closureProjection,
          policyBinding: policyBindingFor(closureProjection),
        }),
      (error) => error.failureClass === 'partition_no_independent_closure'
    );

    const futureGraph = makeGraph({
      ids: ['a', 'b'],
      edges: [['a', 'b']],
      topologicalOrder: ['component-b', 'component-a'],
    });
    const futureProjection = makeExecutionProjection(futureGraph, 'future');
    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: futureGraph,
          executionProjection: futureProjection,
          policyBinding: policyBindingFor(futureProjection),
        }),
      (error) =>
        error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'component_graph_canonical_mismatch'
    );
  });

  it('fails closed when no valid candidate exists or the search bound is exhausted', () => {
    const invalidGraph = makeGraph({
      components: [
        makeComponent('a', {
          fileScopeIds: Array.from({ length: 9 }, (_, index) => `file-${index}`),
        }),
      ],
      sharedArtifactOwnership: [],
    });
    const invalidProjection = makeExecutionProjection(invalidGraph, 'invalid');
    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: invalidGraph,
          executionProjection: invalidProjection,
          policyBinding: policyBindingFor(invalidProjection),
        }),
      (error) => error.failureClass === 'partition_no_valid_solution'
    );

    const boundedGraph = makeGraph({ ids: ['a', 'b', 'c', 'd'] });
    const boundedProjection = makeExecutionProjection(boundedGraph, 'bounded');
    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: boundedGraph,
          executionProjection: boundedProjection,
          policyBinding: policyBindingFor(boundedProjection, (policy) => {
            policy.limits.maxSearchStates = 2;
          }),
        }),
      (error) => error.failureClass === 'partition_policy_unsatisfied'
    );
  });

  it('prunes hard-invalid prefixes and bounds all candidate frontiers', () => {
    const graph = makeGraph({
      components: [
        makeComponent('a', {
          fileScopeIds: Array.from({ length: 5 }, (_, index) => `file-a-${index}`),
        }),
        makeComponent('b', {
          fileScopeIds: Array.from({ length: 5 }, (_, index) => `file-b-${index}`),
        }),
      ],
      sharedArtifactOwnership: [],
    });
    const executionProjection = makeExecutionProjection(graph, 'rejected-summary');
    const result = optimizePartitions({
      componentGraph: graph,
      executionProjection,
      policyBinding: policyBindingFor(executionProjection),
    });

    assert.equal(result.searchReceipt.candidateCount, 1);
    assert.equal(result.searchReceipt.validCandidateCount, 1);
    assert.equal(result.rejectedCandidateSummaries.length, 0);
    assert.equal(result.searchReceipt.hardRejectedGroupCount, 1);

    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: graph,
          executionProjection,
          policyBinding: policyBindingFor(executionProjection, (policy) => {
            policy.limits.maxCandidateFrontiers = 1;
          }),
        }),
      (error) =>
        error.failureClass === 'partition_policy_unsatisfied' &&
        error.reason === 'candidate_frontier_limit_exceeded'
    );
  });

  it('counts unique DAG frontiers instead of repeated partition histories', () => {
    const graph = makeGraph({
      ids: ['a', 'b', 'c', 'd'],
      edges: [
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'd'],
      ],
    });
    const executionProjection = makeExecutionProjection(
      graph,
      'unique-frontier-count'
    );
    const result = optimizePartitions({
      componentGraph: graph,
      executionProjection,
      policyBinding: policyBindingFor(executionProjection, (policy) => {
        policy.limits.maxCandidateFrontiers = 5;
        policy.limits.maxClosureMinutesPerPartition = 120;
        policy.limits.targetClosureMinutesPerPartition = {
          min: 60,
          max: 120,
        };
      }),
    });

    assert.equal(result.decision, 'selected');
    assert.equal(result.searchReceipt.frontierCount, 5);
  });

  it('bounds search for fifty-one independent components without pre-enumerating every frontier', () => {
    const ids = Array.from(
      { length: 51 },
      (_, index) => `wide-${String(index + 1).padStart(2, '0')}`
    );
    const graph = makeGraph({ ids });
    const executionProjection = makeExecutionProjection(
      graph,
      'bounded-wide-frontier'
    );
    const result = optimizePartitions({
      componentGraph: graph,
      executionProjection,
      policyBinding: policyBindingFor(executionProjection),
    });

    assert.equal(result.decision, 'selected');
    assert.equal(result.partitions.flatMap(
      (partition) => partition.primaryComponentIds
    ).length, ids.length);
    assert.ok(result.searchReceipt.frontierCount <= 256);
    assert.ok(result.searchReceipt.searchStates <= 4096);
  });

  it('reports bounded search exhaustion instead of claiming a complete no-solution proof', () => {
    const ids = Array.from(
      { length: 9 },
      (_, index) => `budget-${String(index + 1).padStart(2, '0')}`
    );
    const ordered = ids
      .map((id) => ({ id, component: makeComponent(id) }))
      .sort((left, right) =>
        left.component.componentId.localeCompare(right.component.componentId)
      );
    ordered.at(-1).component.estimatedClosureMinutes = 60;
    ordered.at(-1).component.closureMinuteBreakdown = {
      declaredTaskMinutes: 60,
      derivedTaskMinutes: 0,
      verificationMinutes: 0,
      coordinationMinutes: 0,
      totalMinutes: 60,
    };
    const graph = makeGraph({
      ids: ordered.map((entry) => entry.id),
      components: ordered.map((entry) => entry.component),
      edges: [
        [ordered[0].id, ordered[1].id],
        ...ordered
          .slice(0, -1)
          .map((entry) => [entry.id, ordered.at(-1).id]),
      ],
    });
    const executionProjection = makeExecutionProjection(
      graph,
      'search-budget-exhaustion'
    );

    let caught = null;
    let unexpectedResult = null;
    try {
      unexpectedResult = optimizePartitions({
          componentGraph: graph,
          executionProjection,
          policyBinding: policyBindingFor(executionProjection, (policy) => {
            policy.limits.maxClosureMinutesPerPartition = 60;
            policy.limits.targetClosureMinutesPerPartition = {
              min: 60,
              max: 60,
            };
            policy.limits.maxCrossPartitionDependencies = 1;
            policy.limits.maxSearchStates = 10;
            policy.limits.maxCandidateFrontiers = 10;
          }),
        });
    } catch (error) {
      caught = error;
    }
    assert.ok(
      caught,
      stableStringify({
        partitions: unexpectedResult?.partitions.map((partition) => ({
          primaryComponentIds: partition.primaryComponentIds,
          dependencyPartitionIds: partition.dependencyPartitionIds,
        })),
        searchReceipt: unexpectedResult?.searchReceipt,
      })
    );
    assert.equal(caught.failureClass, 'partition_policy_unsatisfied');
    assert.equal(caught.reason, 'search_budget_exhausted');
  });

  it('limits cross-partition dependency fan-in per partition, not manifest total', () => {
    const ids = Array.from({ length: 34 }, (_, index) => `chain-${index + 1}`);
    const graph = makeGraph({
      ids,
      edges: ids.slice(1).map((id, index) => [ids[index], id]),
    });
    const executionProjection = makeExecutionProjection(
      graph,
      'per-partition-dependency-limit'
    );
    const result = optimizePartitions({
      componentGraph: graph,
      executionProjection,
      policyBinding: policyBindingFor(executionProjection, (policy) => {
        policy.limits.maxClosureMinutesPerPartition = 30;
        policy.limits.targetClosureMinutesPerPartition = {
          min: 30,
          max: 30,
        };
        policy.limits.maxCrossPartitionDependencies = 1;
      }),
    });

    assert.equal(result.partitionCount, 34);
    assert.equal(result.partitions.slice(1).every(
      (partition) => partition.dependencyPartitionIds.length === 1
    ), true);
    assert.equal(result.candidates[0].crossPartitionDependencyCount, 33);
  });

  it('searches dependency-closed DAG frontiers beyond contiguous topological segments', () => {
    const graph = makeGraph({
      components: [
        makeComponent('a', { sourceIds: ['source-shared'] }),
        makeComponent('b', { sourceIds: ['source-other'] }),
        makeComponent('c', { sourceIds: ['source-shared'] }),
      ],
      edges: [['a', 'c']],
    });
    const executionProjection = makeExecutionProjection(graph, 'dag-frontier');
    const result = optimizePartitions({
      componentGraph: graph,
      executionProjection,
      policyBinding: policyBindingFor(executionProjection, (policy) => {
        policy.limits.maxClosureMinutesPerPartition = 60;
        policy.limits.targetClosureMinutesPerPartition = { min: 30, max: 60 };
        for (const key of Object.keys(policy.weights)) policy.weights[key] = 0;
        policy.weights.sourceBoundaryViolation = 1000;
      }),
    });

    assert.ok(
      result.partitions.some(
        (partition) =>
          stableStringify(partition.primaryComponentIds) ===
          stableStringify([
            componentIdFor(graph, 'a'),
            componentIdFor(graph, 'c'),
          ])
      )
    );
  });

  it('derives nonzero shared churn, source boundary and compatibility costs', () => {
    const graph = makeGraph({
      components: [
        makeComponent('a', { sourceIds: ['source-a'] }),
        makeComponent('b', { sourceIds: ['source-b'] }),
      ],
      sharedArtifactOwnership: [
        {
          fileScopeId: 'file-shared',
          path: 'src/shared.ts',
          ownerComponentId: 'component-a',
          participatingComponentIds: ['component-a', 'component-b'],
        },
      ],
    });
    const executionProjection = makeExecutionProjection(graph, 'score-breakdown');
    const result = optimizePartitions({
      componentGraph: graph,
      executionProjection,
      policyBinding: policyBindingFor(executionProjection, (policy) => {
        policy.limits.maxClosureMinutesPerPartition = 30;
        policy.limits.targetClosureMinutesPerPartition = { min: 30, max: 30 };
      }),
    });
    const selected = result.candidates.find((candidate) => candidate.selected);

    assert.ok(selected.score.breakdown.sharedFileChurnCost > 0);
    assert.equal(selected.score.breakdown.sourceBoundaryViolationCost, 0);
    assert.equal(selected.compatibilityReceiptRequirementCount, 1);

    const combined = optimizeScenario({
      graph: makeGraph({
        components: [
          makeComponent('a', { sourceIds: ['source-a'] }),
          makeComponent('b', { sourceIds: ['source-b'] }),
        ],
      }),
      suffix: 'source-boundary',
      mutatePolicy: (policy) => {
        policy.limits.maxClosureMinutesPerPartition = 60;
        policy.limits.targetClosureMinutesPerPartition = { min: 60, max: 60 };
        policy.weights.auditOverhead = 10000;
      },
    }).result.candidates.find((candidate) => candidate.partitions.length === 1);

    assert.ok(combined.score.breakdown.sourceBoundaryViolationCost > 0);
  });

  it('keeps shared-artifact consumers in the owner partition or a later partition', () => {
    const graph = makeGraph({
      components: [
        makeComponent('anchor', { fileScopeIds: ['file-anchor'] }),
        makeComponent('owner', {
          fileScopeIds: Array.from(
            { length: 7 },
            (_, index) => `file-owner-${index}`
          ),
        }),
        makeComponent('consumer', { fileScopeIds: ['file-consumer'] }),
      ],
      edges: [['owner', 'consumer']],
      sharedArtifactOwnership: [
        {
          fileScopeId: 'file-shared',
          path: 'src/shared.ts',
          ownerComponentId: 'component-owner',
          participatingComponentIds: ['component-consumer', 'component-owner'],
        },
      ],
    });
    const { result } = optimizeScenario({
      graph,
      suffix: 'shared-owner-frontier',
      mutatePolicy: (policy) => {
        policy.limits.maxClosureMinutesPerPartition = 60;
        policy.limits.targetClosureMinutesPerPartition = { min: 60, max: 60 };
      },
    });
    const selected = result.candidates.find((candidate) => candidate.selected);
    const ownerComponentId = componentIdFor(graph, 'owner');
    const consumerComponentId = componentIdFor(graph, 'consumer');
    const ownerIndex = selected.partitions.findIndex((partition) =>
      partition.primaryComponentIds.includes(ownerComponentId)
    );
    const consumerIndex = selected.partitions.findIndex((partition) =>
      partition.primaryComponentIds.includes(consumerComponentId)
    );
    const ownerPartition = selected.partitions[ownerIndex];
    const consumerPartition = selected.partitions[consumerIndex];

    assert.ok(ownerIndex <= consumerIndex);
    assert.equal(
      result.candidates.some((candidate) => {
        const candidateOwnerIndex = candidate.partitions.findIndex((partition) =>
          partition.primaryComponentIds.includes(ownerComponentId)
        );
        const candidateConsumerIndex = candidate.partitions.findIndex((partition) =>
          partition.primaryComponentIds.includes(consumerComponentId)
        );
        return candidateOwnerIndex > candidateConsumerIndex;
      }),
      false
    );
    if (ownerIndex !== consumerIndex) {
      assert.ok(
        consumerPartition.dependencyPartitionIds.includes(ownerPartition.partitionId)
      );
    }
  });

  it('rejects a candidate that places a shared-artifact owner after its consumer', () => {
    const graph = makeGraph({
      ids: ['owner', 'consumer'],
      sharedArtifactOwnership: [
        {
          fileScopeId: 'file-shared',
          path: 'src/shared.ts',
          ownerComponentId: 'component-owner',
          participatingComponentIds: ['component-owner', 'component-consumer'],
        },
      ],
    });
    const executionProjection = makeExecutionProjection(
      graph,
      'shared-owner-candidate'
    );
    const ownerComponentId = componentIdFor(graph, 'owner');
    const consumerComponentId = componentIdFor(graph, 'consumer');

    assert.throws(
      () =>
        validatePartitionCandidate({
          candidate: {
            candidateId: 'candidate-shared-owner-after-consumer',
            crossPartitionDependencyCount: 0,
            partitions: [
              {
                partitionId: 'partition-consumer',
                primaryComponentIds: [consumerComponentId],
                dependencyPartitionIds: [],
                partitionRole: 'implementation',
                estimatedClosureMinutes: 30,
                primaryWriteScopeOwnerCount: 1,
              },
              {
                partitionId: 'partition-owner',
                primaryComponentIds: [ownerComponentId],
                dependencyPartitionIds: [],
                partitionRole: 'implementation',
                estimatedClosureMinutes: 30,
                primaryWriteScopeOwnerCount: 1,
              },
            ],
          },
          componentGraph: graph,
          executionProjection,
          policy: policyBindingFor(executionProjection).policy,
        }),
      (error) =>
        error.failureClass === 'partition_future_dependency' &&
        error.reason === 'shared_artifact_owner_after_consumer'
    );
  });

  it('counts one compatibility requirement per non-owner participant partition', () => {
    const graph = makeGraph({
      ids: ['owner', 'consumer-a', 'consumer-b'],
      edges: [
        ['owner', 'consumer-a'],
        ['owner', 'consumer-b'],
      ],
      sharedArtifactOwnership: [
        {
          fileScopeId: 'file-shared',
          path: 'src/shared.ts',
          ownerComponentId: 'component-owner',
          participatingComponentIds: [
            'component-owner',
            'component-consumer-a',
            'component-consumer-b',
          ],
        },
      ],
    });
    const { result } = optimizeScenario({
      graph,
      suffix: 'shared-owner-receipt-count',
      mutatePolicy: (policy) => {
        policy.limits.maxClosureMinutesPerPartition = 30;
        policy.limits.targetClosureMinutesPerPartition = { min: 30, max: 30 };
      },
    });
    const selected = result.candidates.find((candidate) => candidate.selected);

    assert.equal(selected.partitions.length, 3);
    assert.equal(selected.compatibilityReceiptRequirementCount, 2);
  });

  it('rejects caller-authored roles and unjustified final integration', () => {
    const overrideGraph = makeGraph({ ids: ['a'] });
    overrideGraph.components[0].partitionRole = 'final_integration';
    const overrideProjection = makeExecutionProjection(overrideGraph, 'override');
    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: overrideGraph,
          executionProjection: overrideProjection,
          policyBinding: policyBindingFor(overrideProjection),
        }),
      (error) => error.failureClass === 'partition_role_authority_override_forbidden'
    );

    const graph = makeGraph({ ids: ['a'] });
    const executionProjection = makeExecutionProjection(graph, 'no-final');
    const policyBinding = policyBindingFor(executionProjection);
    assert.throws(
      () =>
        validatePartitionCandidate({
          candidate: {
            candidateId: 'candidate-manual',
            partitions: [
              {
                partitionId: 'partition-manual',
                primaryComponentIds: [graph.components[0].componentId],
                primaryTraceSliceIds: ['slice-a'],
                primaryTaskIds: ['task-a'],
                dependencyPartitionIds: [],
                partitionRole: 'final_integration',
                partitionRoleDerived: true,
                estimatedClosureMinutes: 30,
                primaryWriteScopeOwnerCount: 1,
              },
            ],
          },
          componentGraph: graph,
          executionProjection,
          policy: policyBinding.policy,
        }),
      (error) => error.failureClass === 'partition_final_integration_not_required'
    );
  });

  it('rejects policy content that does not match its identity hash', () => {
    const graph = makeGraph({ ids: ['a'] });
    const executionProjection = makeExecutionProjection(graph, 'policy-tamper');
    const policyBinding = clone(policyBindingFor(executionProjection));
    policyBinding.policy.weights.auditOverhead += 1;

    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: graph,
          executionProjection,
          policyBinding,
        }),
      (error) =>
        error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'partition_policy_hash_mismatch'
    );
  });

  it('rejects component file scopes that do not match the projection', () => {
    const graph = makeGraph({ ids: ['a'] });
    const executionProjection = makeExecutionProjection(graph, 'scope-tamper');
    graph.components[0].fileScopeIds = [];

    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: graph,
          executionProjection,
          policyBinding: policyBindingFor(executionProjection),
        }),
      (error) =>
        error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'component_file_scope_projection_mismatch'
    );
  });

  it('rejects execution projection payload drift against its identity hash', () => {
    const graph = makeGraph({ ids: ['a'] });
    const executionProjection = makeExecutionProjection(
      graph,
      'projection-payload-tamper'
    );
    executionProjection.traceSlices[0].observableOutcome = 'Tampered outcome.';

    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: graph,
          executionProjection,
          policyBinding: policyBindingFor(executionProjection),
        }),
      (error) =>
        error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'execution_projection_hash_mismatch'
    );
  });

  it('rejects missing or malformed mandatory projection graph authority pairs', () => {
    for (const [valueField, hashField] of [
      ['taskDag', 'taskDagHash'],
      ['integrationJoinGraph', 'integrationJoinGraphHash'],
    ]) {
      for (const mutation of ['value-only', 'hash-only', 'both', 'invalid-value', 'invalid-hash']) {
        const graph = makeGraph({ ids: ['a'] });
        const executionProjection = makeExecutionProjection(
          graph,
          `${valueField}-${mutation}`
        );
        if (mutation === 'value-only' || mutation === 'both') {
          delete executionProjection[valueField];
        }
        if (mutation === 'hash-only' || mutation === 'both') {
          delete executionProjection[hashField];
        }
        if (mutation === 'invalid-value') {
          executionProjection[valueField] = null;
        }
        if (mutation === 'invalid-hash') {
          executionProjection[hashField] = 42;
        }
        resealExecutionProjectionIdentity(executionProjection);
        graph.executionProjectionHash =
          executionProjection.executionProjectionHash;

        assert.throws(
          () =>
            optimizePartitions({
              componentGraph: graph,
              executionProjection,
              policyBinding: policyBindingFor(executionProjection),
            }),
          (error) =>
            error.failureClass ===
              'partition_policy_compilation_identity_mismatch' &&
            error.reason === `${valueField}_authority_invalid`,
          `${valueField}:${mutation}`
        );
      }
    }
  });

  it('rejects synchronized integration semantic deletion against canonical projection authority', () => {
    const projectionAuthority = canonicalIntegrationProjectionAuthority();
    const canonicalProjection = compileExecutionProjection(projectionAuthority);
    const executionProjection = clone(canonicalProjection);
    executionProjection.integrationJoinGraph = { joins: [] };
    executionProjection.taskDag.edges = [];
    executionProjection.atomicTasks.find(
      (task) => task.taskId === 'task-b'
    ).dependencyIds = [];
    executionProjection.sequenceConstraintBinding.semanticConstraintHash = hash(
      stableStringify({
        constraints: executionProjection.sequenceConstraintBinding.constraints,
        joins: [],
      })
    );
    sealExecutionProjection(executionProjection);
    const componentGraph = clone(
      buildPartitionComponents({
        executionProjection,
        policy: policyBindingFor(executionProjection).policy,
      })
    );

    assert.throws(
      () =>
        optimizePartitions({
          componentGraph,
          executionProjection,
          policyBinding: policyBindingFor(executionProjection),
          projectionAuthority,
        }),
      (error) =>
        error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'execution_projection_currentness_mismatch'
    );
  });

  it('requires canonical projection authority for producer-shaped projections', () => {
    const projectionAuthority = canonicalIntegrationProjectionAuthority();
    const executionProjection = compileExecutionProjection(projectionAuthority);
    const policyBinding = policyBindingFor(executionProjection);
    const componentGraph = buildPartitionComponents({
      executionProjection,
      policy: policyBinding.policy,
    });

    assert.throws(
      () =>
        optimizePartitions({
          componentGraph,
          executionProjection,
          policyBinding,
        }),
      (error) =>
        error.failureClass ===
          'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'execution_projection_authority_missing'
    );
  });

  it('rejects component semantic metadata that does not match the projection', () => {
    const graph = makeGraph({ ids: ['a'] });
    const executionProjection = makeExecutionProjection(
      graph,
      'component-semantic-tamper'
    );
    graph.components[0].sourceIds = ['source-tampered'];

    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: graph,
          executionProjection,
          policyBinding: policyBindingFor(executionProjection),
        }),
      (error) =>
        error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'component_projection_semantic_mismatch'
    );
  });

  it('rejects component grouping that diverges from canonical must-link replay', () => {
    const graph = makeGraph({ ids: ['a', 'b'] });
    const executionProjection = makeExecutionProjection(
      graph,
      'component-grouping-drift'
    );
    executionProjection.productionEntryIndex = [
      {
        productionEntryId: 'entry-shared',
        literal: 'public action',
        taskIds: ['task-a', 'task-b'],
      },
    ];
    executionProjection.taskDag = {
      nodes: [
        { taskId: 'task-a', ownerSliceId: 'slice-a', topologicalIndex: 0 },
        { taskId: 'task-b', ownerSliceId: 'slice-b', topologicalIndex: 1 },
      ],
      edges: [],
    };
    for (const component of graph.components) {
      component.productionEntryIds = ['entry-shared'];
    }
    for (const task of executionProjection.atomicTasks) {
      task.atomicGroupRefs = ['atomic-source-group'];
    }
    sealExecutionProjection(executionProjection);
    graph.executionProjectionHash = executionProjection.executionProjectionHash;
    const policyBinding = policyBindingFor(executionProjection);

    assert.equal(
      buildPartitionComponents({
        executionProjection,
        policy: policyBinding.policy,
      }).components.length,
      1
    );
    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: graph,
          executionProjection,
          policyBinding,
        }),
      (error) =>
        error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'component_graph_canonical_mismatch'
    );
  });

  it('rejects consistently renamed component IDs and forged canonical edge IDs', () => {
    const sourceGraph = makeGraph({
      ids: ['a', 'b'],
      edges: [['a', 'b']],
    });
    const executionProjection = makeExecutionProjection(
      sourceGraph,
      'canonical-identity-tamper'
    );
    const policyBinding = policyBindingFor(executionProjection);
    const canonicalGraph = buildPartitionComponents({
      executionProjection,
      policy: policyBinding.policy,
    });

    const renamed = clone(canonicalGraph);
    const originalId = renamed.components[0].componentId;
    const renamedId = 'component-forged';
    renamed.components[0].componentId = renamedId;
    renamed.topologicalOrder = renamed.topologicalOrder.map((componentId) =>
      componentId === originalId ? renamedId : componentId
    );
    for (const edge of renamed.dependencyEdges) {
      if (edge.fromComponentId === originalId) edge.fromComponentId = renamedId;
      if (edge.toComponentId === originalId) edge.toComponentId = renamedId;
    }
    for (const ownership of renamed.sharedArtifactOwnership) {
      if (ownership.ownerComponentId === originalId) {
        ownership.ownerComponentId = renamedId;
      }
      ownership.participatingComponentIds =
        ownership.participatingComponentIds.map((componentId) =>
          componentId === originalId ? renamedId : componentId
        );
    }
    for (const ownership of renamed.integrationFanInOwnership) {
      if (ownership.ownerComponentId === originalId) {
        ownership.ownerComponentId = renamedId;
      }
      ownership.inputComponentIds = ownership.inputComponentIds.map(
        (componentId) => (componentId === originalId ? renamedId : componentId)
      );
    }
    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: renamed,
          executionProjection,
          policyBinding,
        }),
      (error) =>
        error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'component_graph_canonical_mismatch'
    );

    const forgedEdge = clone(canonicalGraph);
    forgedEdge.dependencyEdges[0].edgeId = 'component-edge-forged';
    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: forgedEdge,
          executionProjection,
          policyBinding,
        }),
      (error) =>
        error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
        error.reason === 'component_graph_canonical_mismatch'
    );
  });

  it('rejects policy bindings for another source or semantic model', () => {
    const graph = makeGraph({ ids: ['a'] });
    const executionProjection = makeExecutionProjection(
      graph,
      'policy-compilation-identity'
    );
    const baseline = policyBindingFor(executionProjection);

    for (const field of ['sourceSnapshotHash', 'semanticModelHash']) {
      const changed = clone(baseline);
      changed[field] = hash(`${field}:other`);
      assert.throws(
        () =>
          optimizePartitions({
            componentGraph: graph,
            executionProjection,
            policyBinding: changed,
          }),
        (error) =>
          error.failureClass ===
            'partition_policy_compilation_identity_mismatch' &&
          error.mismatchedFields?.includes(field),
        field
      );
    }
  });

  it('rejects inconsistent component closure minute breakdowns', () => {
    const graph = makeGraph({ ids: ['a'] });
    graph.components[0].closureMinuteBreakdown.totalMinutes += 1;
    const executionProjection = makeExecutionProjection(
      graph,
      'closure-breakdown-tamper'
    );

    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: graph,
          executionProjection,
          policyBinding: policyBindingFor(executionProjection),
        }),
      (error) =>
        error.failureClass === 'partition_no_independent_closure' &&
        error.reason === 'closure_minute_breakdown_mismatch'
    );
  });

  it('allows more than four small tasks when total closure minutes fit', () => {
    const taskIds = Array.from({ length: 6 }, (_, index) => `task-${index}`);
    const graph = makeGraph({
      components: [
        makeComponent('small', {
          atomicTaskIds: taskIds,
          estimatedClosureMinutes: 120,
          closureMinuteBreakdown: {
            declaredTaskMinutes: 120,
            derivedTaskMinutes: 0,
            verificationMinutes: 0,
            coordinationMinutes: 0,
            totalMinutes: 120,
          },
        }),
      ],
    });
    const executionProjection = makeExecutionProjection(graph, 'small-many');
    const result = optimizePartitions({
      componentGraph: graph,
      executionProjection,
      policyBinding: policyBindingFor(executionProjection),
    });

    assert.equal(result.partitionCount, 1);
    assert.equal(result.partitions[0].primaryTaskIds.length, 6);
    assert.equal(result.partitions[0].estimatedClosureMinutes, 120);
  });

  it('rejects an oversized atomic group without inventing a split', () => {
    const graph = makeGraph({
      components: [
        makeComponent('oversized', {
          estimatedClosureMinutes: 241,
          closureMinuteBreakdown: {
            declaredTaskMinutes: 241,
            derivedTaskMinutes: 0,
            verificationMinutes: 0,
            coordinationMinutes: 0,
            totalMinutes: 241,
          },
        }),
      ],
    });
    const executionProjection = makeExecutionProjection(graph, 'oversized');
    assert.throws(
      () =>
        optimizePartitions({
          componentGraph: graph,
          executionProjection,
          policyBinding: policyBindingFor(executionProjection),
        }),
      (error) => error.failureClass === 'partition_atomic_component_exceeds_policy'
    );
  });

  it('is byte-stable across at least 100 deterministic input permutations', () => {
    const graph = makeGraph({
      ids: ['a', 'b', 'c', 'd', 'e'],
      edges: [
        ['a', 'c'],
        ['b', 'c'],
        ['c', 'e'],
        ['d', 'e'],
      ],
    });
    const executionProjection = makeExecutionProjection(graph, 'permutation');
    const policyBinding = policyBindingFor(executionProjection, (policy) => {
      policy.limits.maxClosureMinutesPerPartition = 60;
      policy.limits.targetClosureMinutesPerPartition = { min: 30, max: 60 };
    });
    const baseline = stableStringify(
      optimizePartitions({
        componentGraph: graph,
        executionProjection,
        policyBinding,
      })
    );

    for (let index = 0; index < 100; index += 1) {
      const permuted = clone(graph);
      const offset = index % permuted.components.length;
      permuted.components = [
        ...permuted.components.slice(offset),
        ...permuted.components.slice(0, offset),
      ];
      if (index % 2 === 1) permuted.components.reverse();
      permuted.dependencyEdges =
        index % 3 === 0
          ? [...permuted.dependencyEdges].reverse()
          : [
              ...permuted.dependencyEdges.slice(index % permuted.dependencyEdges.length),
              ...permuted.dependencyEdges.slice(0, index % permuted.dependencyEdges.length),
            ];
      permuted.sharedArtifactOwnership.reverse();
      for (const ownership of permuted.sharedArtifactOwnership) {
        ownership.participatingComponentIds.reverse();
      }

      assert.equal(
        stableStringify(
          optimizePartitions({
            componentGraph: permuted,
            executionProjection,
            policyBinding,
          })
        ),
        baseline
      );
    }
  });

  it('changes candidate identity for semantic graph and policy mutations', () => {
    const graph = makeGraph({
      ids: ['a', 'b', 'c'],
      edges: [['a', 'c']],
    });
    const executionProjection = makeExecutionProjection(graph, 'mutations');
    const policyBinding = policyBindingFor(executionProjection);
    const baseline = optimizePartitions({
      componentGraph: graph,
      executionProjection,
      policyBinding,
    });
    const mutations = [];

    const membershipProjection = clone(executionProjection);
    membershipProjection.traceSlices[0].sliceId = 'slice-a-mutated';
    membershipProjection.atomicTasks[0].ownerSliceId = 'slice-a-mutated';
    membershipProjection.taskDag.nodes[0].ownerSliceId = 'slice-a-mutated';
    sealExecutionProjection(membershipProjection);
    const membershipBinding = policyBindingFor(membershipProjection);
    const membership = buildPartitionComponents({
      executionProjection: membershipProjection,
      policy: membershipBinding.policy,
    });
    mutations.push(
      optimizePartitions({
        componentGraph: membership,
        executionProjection: membershipProjection,
        policyBinding: membershipBinding,
      })
    );

    const dependencyProjection = clone(executionProjection);
    dependencyProjection.taskDag.edges.push({
      fromTaskId: 'task-b',
      toTaskId: 'task-c',
      reason: 'implementation_dependency',
      joinId: null,
    });
    dependencyProjection.atomicTasks.find(
      (task) => task.taskId === 'task-c'
    ).dependencyIds.push('task-b');
    for (const [index, taskId] of ['task-a', 'task-b', 'task-c'].entries()) {
      dependencyProjection.taskDag.nodes.find(
        (node) => node.taskId === taskId
      ).topologicalIndex = index;
    }
    sealExecutionProjection(dependencyProjection);
    const dependencyBinding = policyBindingFor(dependencyProjection);
    const dependency = buildPartitionComponents({
      executionProjection: dependencyProjection,
      policy: dependencyBinding.policy,
    });
    mutations.push(
      optimizePartitions({
        componentGraph: dependency,
        executionProjection: dependencyProjection,
        policyBinding: dependencyBinding,
      })
    );

    mutations.push(
      optimizePartitions({
        componentGraph: graph,
        executionProjection,
        policyBinding: policyBindingFor(executionProjection, (policy) => {
          policy.weights.dependencyCut += 1;
        }),
      })
    );

    const ownershipProjection = clone(executionProjection);
    ownershipProjection.fileScopeIndex.push({
      fileScopeId: 'file-shared',
      path: 'src/shared.ts',
      taskIds: ['task-a', 'task-b'],
    });
    sealExecutionProjection(ownershipProjection);
    const ownershipBinding = policyBindingFor(ownershipProjection);
    const ownership = buildPartitionComponents({
      executionProjection: ownershipProjection,
      policy: ownershipBinding.policy,
    });
    mutations.push(
      optimizePartitions({
        componentGraph: ownership,
        executionProjection: ownershipProjection,
        policyBinding: ownershipBinding,
      })
    );

    for (const mutated of mutations) {
      assert.notEqual(mutated.selectedCandidateId, baseline.selectedCandidateId);
    }
  });
});
