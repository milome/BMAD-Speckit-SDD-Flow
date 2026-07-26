const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  compilePartitionManifest,
  resolveAssetRoot,
  stagePartitionSolution,
  validatePartitionManifest,
} = require('../src/utils/goal-contract/partition-manifest.ts');
const {
  buildPartitionComponents,
} = require('../src/utils/goal-contract/partition-components.ts');
const {
  optimizePartitions,
} = require('../src/utils/goal-contract/partition-optimizer.ts');
const {
  compileExecutionProjection,
} = require('../src/utils/goal-contract/execution-projection.ts');
const {
  hashSourceObligationGraph,
} = require('../src/utils/goal-contract/source-obligation-extractor.ts');

const hash = (value) =>
  `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
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

const SOURCE_HASH = hash('source');
const SOURCE_SEMANTIC_HASH = hash('source-semantic');
const PROJECTION_HASH = hash('projection');
const PARTITION_POLICY = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '_bmad',
      'shared',
      'goal-contract',
      'goal-contract-partition-policy.json'
    ),
    'utf8'
  )
);
const POLICY_HASH = hash(stableStringify(PARTITION_POLICY));

function canonicalIntegrationProjectionAuthority() {
  const roots = {
    sourceSnapshotHash: SOURCE_HASH,
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
      ],
      tasks: ['a', 'b'].map((id) => ({
        id: `task-${id}`,
        title: `Task ${id}`,
        sourceIds: ['source-a'],
        estimatedClosureMinutes: 30,
      })),
      traceSlices: ['a', 'b'].map((id) => ({
        id: `slice-${id}`,
        goalIds: [`task-${id}`],
        sourceIds: ['source-a'],
        acceptanceIds: [`acceptance-${id}`],
        evidenceIds: [`evidence-${id}`],
        productionSymbols: [`entry-${id}`],
        allowedPaths: [`src/${id}.ts`],
        dependencies: [],
        closeCondition: `${id} closes.`,
      })),
      dependencies: [],
      acceptanceItems: ['a', 'b'].map((id) => ({
        id: `acceptance-${id}`,
        traceIds: [`slice-${id}`],
        goalIds: [`task-${id}`],
        sourceIds: ['source-a'],
        passCondition: `${id} passes.`,
        expectedEvidenceIds: [`evidence-${id}`],
      })),
      expectedEvidence: ['a', 'b'].map((id) => ({
        id: `evidence-${id}`,
        producerTaskIds: [`task-${id}`],
        admissibleTypes: ['behavior'],
        freshnessRule: 'current',
      })),
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

function expectedPartitionId(partition, executionProjectionHash = PROJECTION_HASH) {
  return hash(
    stableStringify({
      sourceSnapshotHash: SOURCE_HASH,
      executionProjectionHash,
      partitionPolicyHash: POLICY_HASH,
      primaryTraceSliceIds: [...partition.primaryTraceSliceIds].sort(),
      primaryTaskIds: [...partition.primaryTaskIds].sort(),
      dependencyPartitionIds: [...partition.dependencyPartitionIds].sort(),
      partitionRole: partition.partitionRole,
    })
  ).replace('sha256:', 'partition-');
}

function partition(suffix, overrides = {}) {
  const value = {
    partitionId: '',
    primaryComponentIds: [`component-${suffix}`],
    primaryTraceSliceIds: [`slice-${suffix}`],
    primaryTaskIds: [`task-${suffix}`],
    dependencyPartitionIds: [],
    partitionRole: 'implementation',
    partitionRoleDerived: true,
    estimatedClosureMinutes: 150,
    closureMinuteBreakdown: {
      declaredTaskMinutes: 150,
      derivedTaskMinutes: 0,
      verificationMinutes: 0,
      coordinationMinutes: 0,
      totalMinutes: 150,
    },
    primaryWriteScopeOwnerCount: 1,
    ...overrides,
  };
  value.partitionId = expectedPartitionId(value);
  return value;
}

function input(overrides = {}) {
  const first = partition('a');
  const second = partition('b', {
    dependencyPartitionIds: [first.partitionId],
    partitionRole: 'final_integration',
  });
  const sourceObligationGraph = {
    obligations: [
      { id: 'source-a', applicabilityState: 'applicable' },
      { id: 'source-b', applicabilityState: 'applicable' },
    ],
  };
  const reconciledGraph = {
    traceSlices: [
      {
        id: 'slice-a',
        taskIds: ['task-a'],
        directCommands: ['command-a'],
        impactedCommands: ['command-a'],
      },
      {
        id: 'slice-b',
        taskIds: ['task-b'],
        directCommands: ['command-b'],
        impactedCommands: ['command-b'],
      },
    ],
  };
  const sourceObligationGraphHash = hashSourceObligationGraph(
    sourceObligationGraph
  );
  const methodologyProfileHash = hash('methodology');
  const reconciledGraphHash = hash(stableStringify(reconciledGraph));
  const semanticModelHash = hash('semantic');
  const value = {
    sourceSnapshot: {
      sourcePath: 'docs/source-plan.md',
      aggregateHash: SOURCE_HASH,
      exactByteHash: SOURCE_HASH,
      sourcePlanSemanticHash: SOURCE_SEMANTIC_HASH,
    },
    sourceObligationGraph,
    sourceObligationGraphHash,
    methodologyProfileHash,
    reconciledGraphHash,
    reconciliationReceiptHash: hash('reconciliation-receipt'),
    reconciledGraph,
      executionProjection: {
        schemaVersion: 'goal-contract-execution-projection/v1',
        sourceSnapshotHash: SOURCE_HASH,
        sourceObligationGraphHash,
        methodologyProfileHash,
        semanticModelHash,
        reconciledGraphHash,
        executionEpics: [
        {
          epicId: 'epic-a',
          sourceIds: ['source-a'],
          taskIds: ['task-a'],
          traceSliceIds: ['slice-a'],
        },
        {
          epicId: 'epic-b',
          sourceIds: ['source-b'],
          taskIds: ['task-b'],
          traceSliceIds: ['slice-b'],
        },
      ],
      traceSlices: [
          {
            sliceId: 'slice-a',
          sourceIds: ['source-a'],
          taskIds: ['task-a'],
          observableOutcome: 'Alpha closes.',
          completionPredicateIds: ['acceptance-a'],
            evidenceContractIds: ['evidence-a'],
            sequenceConstraintIds: [],
            verificationOnly: false,
          },
        {
          sliceId: 'slice-b',
          sourceIds: ['source-b'],
          taskIds: ['task-b'],
          observableOutcome: 'Beta closes.',
          completionPredicateIds: ['acceptance-b'],
            evidenceContractIds: ['evidence-b'],
            sequenceConstraintIds: ['constraint-b'],
            verificationOnly: false,
          },
        ],
        atomicTasks: [
          {
            taskId: 'task-a',
            sourceIds: ['source-a'],
            ownerSliceId: 'slice-a',
            estimatedClosureMinutes: 150,
            dependencyIds: [],
            sequenceConstraintIds: [],
          },
          {
            taskId: 'task-b',
            sourceIds: ['source-b'],
            ownerSliceId: 'slice-b',
            estimatedClosureMinutes: 150,
            dependencyIds: ['task-a'],
            sequenceConstraintIds: ['constraint-b'],
          },
        ],
      completionPredicates: [
        { predicateId: 'acceptance-a', sliceId: 'slice-a' },
        { predicateId: 'acceptance-b', sliceId: 'slice-b' },
      ],
      evidenceContracts: [
        { evidenceContractId: 'evidence-a', producerTaskIds: ['task-a'] },
        { evidenceContractId: 'evidence-b', producerTaskIds: ['task-b'] },
      ],
        fileScopeIndex: [
          { fileScopeId: 'file-a', path: 'src/a.ts', taskIds: ['task-a'] },
          { fileScopeId: 'file-b', path: 'src/b.ts', taskIds: ['task-b'] },
        ],
        taskDag: {
          nodes: [
            { taskId: 'task-a', ownerSliceId: 'slice-a', topologicalIndex: 0 },
            { taskId: 'task-b', ownerSliceId: 'slice-b', topologicalIndex: 1 },
          ],
          edges: [
            {
              fromTaskId: 'task-a',
              toTaskId: 'task-b',
              reason: 'integration_join',
              joinId: 'join-b',
            },
          ],
        },
        integrationJoinGraph: {
          joins: [
            {
              joinId: 'join-b',
              ownerTaskId: 'task-b',
              inputTaskIds: ['task-a'],
            },
          ],
        },
      },
    componentGraph: {
      executionProjectionHash: PROJECTION_HASH,
      components: [
        {
          componentId: 'component-a',
          traceSliceIds: ['slice-a'],
          atomicTaskIds: ['task-a'],
          sourceIds: ['source-a'],
          estimatedClosureMinutes: 150,
          closureMinuteBreakdown: {
            declaredTaskMinutes: 150,
            derivedTaskMinutes: 0,
            verificationMinutes: 0,
            coordinationMinutes: 0,
            totalMinutes: 150,
          },
          completionPredicateIds: ['acceptance-a'],
          evidenceContractIds: ['evidence-a'],
          sequenceConstraintIds: [],
          productionEntryIds: [],
          fileScopeIds: ['file-a'],
          verificationOnly: false,
          mustLinkReasonCodes: ['trace_slice_atomicity'],
        },
        {
          componentId: 'component-b',
          traceSliceIds: ['slice-b'],
          atomicTaskIds: ['task-b'],
          sourceIds: ['source-b'],
          estimatedClosureMinutes: 150,
          closureMinuteBreakdown: {
            declaredTaskMinutes: 150,
            derivedTaskMinutes: 0,
            verificationMinutes: 0,
            coordinationMinutes: 0,
            totalMinutes: 150,
          },
          completionPredicateIds: ['acceptance-b'],
          evidenceContractIds: ['evidence-b'],
          sequenceConstraintIds: ['constraint-b'],
          productionEntryIds: [],
          fileScopeIds: ['file-b'],
          verificationOnly: false,
          mustLinkReasonCodes: ['trace_slice_atomicity'],
        },
      ],
      dependencyEdges: [
        {
          edgeId: 'edge-a-b',
          fromComponentId: 'component-a',
          toComponentId: 'component-b',
          reasonCodes: ['integration_join'],
          taskEdges: [
            {
              fromTaskId: 'task-a',
              toTaskId: 'task-b',
              reason: 'integration_join',
              joinId: 'join-b',
            },
          ],
        },
      ],
      topologicalOrder: ['component-a', 'component-b'],
      sharedArtifactOwnership: [
        {
          fileScopeId: 'file-a',
          path: 'src/a.ts',
          ownerComponentId: 'component-a',
          participatingComponentIds: ['component-a'],
        },
        {
          fileScopeId: 'file-b',
          path: 'src/b.ts',
          ownerComponentId: 'component-b',
          participatingComponentIds: ['component-b'],
        },
      ],
      integrationFanInOwnership: [
        {
          joinId: 'join-b',
          ownerComponentId: 'component-b',
          inputComponentIds: ['component-a'],
        },
      ],
    },
    policyBinding: {
      policy: structuredClone(PARTITION_POLICY),
      partitionPolicyHash: POLICY_HASH,
      sourceSnapshotHash: SOURCE_HASH,
      semanticModelHash,
      executionProjectionHash: PROJECTION_HASH,
    },
    semanticDerivationMode: 'structured_fast_path',
    optimization: {
      optimizerVersion: 'goal-contract-partition-optimizer/v1',
      selectedCandidateId: 'candidate-current',
      candidates: [
        {
          candidateId: 'candidate-current',
          selected: true,
          partitions: [first, second],
          score: {
            total: 420,
            breakdown: {
              dependencyCutCost: 120,
              sharedFileChurnCost: 0,
              auditOverheadCost: 200,
              closureFragmentationCost: 0,
              effortImbalanceCost: 0,
              sourceBoundaryViolationCost: 0,
              finalIntegrationCost: 100,
              semanticCohesionBenefit: 0,
              evidenceLocalityBenefit: 0,
            },
          },
        },
      ],
      rejectedCandidateSummaries: [
        {
          candidateId: 'candidate-rejected',
          failureClass: 'partition_no_valid_solution',
          reason: 'primary_write_scope_owner_limit_exceeded',
          partitionCount: 1,
          partitionIds: [first.partitionId],
        },
      ],
      searchReceipt: {
        candidateCount: 2,
        validCandidateCount: 1,
        rejectedCandidateCount: 1,
      },
      partitionCount: 2,
      partitions: [first, second],
      topologicalOrder: [first.partitionId, second.partitionId],
    },
    ...overrides,
  };
  if (!Object.hasOwn(overrides, 'executionProjection')) {
    sealExecutionProjection(value.executionProjection);
  }
  if (!Object.hasOwn(overrides, 'componentGraph')) {
    value.componentGraph = structuredClone(
      buildPartitionComponents({
        executionProjection: value.executionProjection,
        policy: value.policyBinding.policy,
      })
    );
  } else {
    value.componentGraph.executionProjectionHash =
      value.executionProjection.executionProjectionHash;
  }
  value.policyBinding.sourceSnapshotHash =
    value.executionProjection.sourceSnapshotHash;
  value.policyBinding.semanticModelHash =
    value.executionProjection.semanticModelHash;
  value.policyBinding.executionProjectionHash =
    value.executionProjection.executionProjectionHash;
  if (!Object.hasOwn(overrides, 'optimization')) {
    value.optimization = structuredClone(
      optimizePartitions({
        componentGraph: value.componentGraph,
        executionProjection: value.executionProjection,
        policyBinding: value.policyBinding,
        projectionAuthority: value.projectionAuthority,
      })
    );
  }
  return value;
}

function inputWithMultipleCandidates() {
  const current = input();
  const policy = JSON.parse(
    fs.readFileSync(
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '_bmad',
        'shared',
        'goal-contract',
        'goal-contract-partition-policy.json'
      ),
      'utf8'
    )
  );
  policy.limits.targetClosureMinutesPerPartition = { min: 100, max: 100 };
  current.executionProjection.sourceSnapshotHash = SOURCE_HASH;
  current.executionProjection.atomicTasks[0].estimatedClosureMinutes = 100;
  current.executionProjection.atomicTasks[1].estimatedClosureMinutes = 100;
  current.executionProjection.integrationJoinGraph = { joins: [] };
  current.executionProjection.taskDag.edges = [];
  current.executionProjection.atomicTasks[1].dependencyIds = [];
  sealExecutionProjection(current.executionProjection);
  current.policyBinding = {
    policy,
    partitionPolicyHash: hash(stableStringify(policy)),
    sourceSnapshotHash: current.executionProjection.sourceSnapshotHash,
    semanticModelHash: current.executionProjection.semanticModelHash,
    executionProjectionHash: current.executionProjection.executionProjectionHash,
  };
  current.componentGraph = structuredClone(
    buildPartitionComponents({
      executionProjection: current.executionProjection,
      policy,
    })
  );
  current.optimization = structuredClone(
    optimizePartitions({
      componentGraph: current.componentGraph,
      executionProjection: current.executionProjection,
      policyBinding: current.policyBinding,
    })
  );
  return current;
}

describe('goal-contract partition manifest', () => {
  it('derives shared ownership and compatibility obligations through the production chain', () => {
    const authority = input();
    const executionProjection = {
      schemaVersion: 'goal-contract-execution-projection/v1',
      sourceSnapshotHash: SOURCE_HASH,
      sourceObligationGraphHash: authority.sourceObligationGraphHash,
      methodologyProfileHash: authority.methodologyProfileHash,
      semanticModelHash: hash('semantic-shared'),
      reconciledGraphHash: authority.reconciledGraphHash,
      executionProjectionHash: hash('projection-shared'),
      taskDagHash: hash('task-dag-shared'),
      traceSlices: [
        {
          sliceId: 'slice-0',
          sourceIds: ['source-0'],
          taskIds: ['task-0'],
          observableOutcome: 'Predecessor closes.',
          completionPredicateIds: ['acceptance-0'],
          evidenceContractIds: ['evidence-0'],
          sequenceConstraintIds: [],
        },
        {
          sliceId: 'slice-14',
          sourceIds: ['source-14'],
          taskIds: ['task-14'],
          observableOutcome: 'Dependent closes.',
          completionPredicateIds: ['acceptance-14'],
          evidenceContractIds: ['evidence-14'],
          sequenceConstraintIds: [],
        },
      ],
      atomicTasks: [
        {
          taskId: 'task-0',
          ownerSliceId: 'slice-0',
          sourceIds: ['source-0'],
          estimatedClosureMinutes: 30,
          dependencyIds: [],
        },
        {
          taskId: 'task-14',
          ownerSliceId: 'slice-14',
          sourceIds: ['source-14'],
          estimatedClosureMinutes: 30,
          dependencyIds: ['task-0'],
        },
      ],
      taskDag: {
        nodes: [
          { taskId: 'task-0', ownerSliceId: 'slice-0', topologicalIndex: 0 },
          { taskId: 'task-14', ownerSliceId: 'slice-14', topologicalIndex: 1 },
        ],
        edges: [
          {
            fromTaskId: 'task-0',
            toTaskId: 'task-14',
            reason: 'implementation_dependency',
            joinId: null,
          },
        ],
      },
      executionEpics: [
        {
          epicId: 'epic-0',
          sourceIds: ['source-0'],
          taskIds: ['task-0'],
          traceSliceIds: ['slice-0'],
        },
        {
          epicId: 'epic-14',
          sourceIds: ['source-14'],
          taskIds: ['task-14'],
          traceSliceIds: ['slice-14'],
        },
      ],
      completionPredicates: [
        { predicateId: 'acceptance-0', sliceId: 'slice-0' },
        { predicateId: 'acceptance-14', sliceId: 'slice-14' },
      ],
      evidenceContracts: [
        { evidenceContractId: 'evidence-0', producerTaskIds: ['task-0'] },
        { evidenceContractId: 'evidence-14', producerTaskIds: ['task-14'] },
      ],
      sequenceConstraintBinding: { constraints: [] },
      productionEntryIndex: [],
      fileScopeIndex: [
        {
          fileScopeId: 'file-shared',
          path: 'src/shared.ts',
          taskIds: ['task-14', 'task-0'],
        },
      ],
      integrationJoinGraph: { joins: [] },
    };
    sealExecutionProjection(executionProjection);
    const policy = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '..',
          '..',
          '..',
          '_bmad',
          'shared',
          'goal-contract',
          'goal-contract-partition-policy.json'
        ),
        'utf8'
      )
    );
    policy.limits.maxClosureMinutesPerPartition = 30;
    policy.limits.targetClosureMinutesPerPartition = { min: 30, max: 30 };
    const policyBinding = {
      policy,
      partitionPolicyHash: hash(stableStringify(policy)),
      sourceSnapshotHash: executionProjection.sourceSnapshotHash,
      semanticModelHash: executionProjection.semanticModelHash,
      executionProjectionHash: executionProjection.executionProjectionHash,
    };
    const componentGraph = buildPartitionComponents({
      executionProjection,
      policy,
    });
    const optimization = optimizePartitions({
      componentGraph,
      executionProjection,
      policyBinding,
    });
    const compiled = compilePartitionManifest({
      ...authority,
      componentGraph,
      executionProjection,
      optimization,
      policyBinding,
    });
    const ownership = componentGraph.sharedArtifactOwnership[0];
    const ownerPartition = compiled.manifest.partitions.find((item) =>
      item.primaryComponentIds.includes(ownership.ownerComponentId)
    );
    const dependentPartition = compiled.manifest.partitions.find(
      (item) => item.partitionId !== ownerPartition.partitionId
    );
    const selected = optimization.candidates.find((candidate) => candidate.selected);
    const predecessorComponent = componentGraph.components.find((component) =>
      component.traceSliceIds.includes('slice-0')
    );
    const dependentComponent = componentGraph.components.find((component) =>
      component.traceSliceIds.includes('slice-14')
    );

    assert.deepEqual(ownership.participatingComponentIds.length, 2);
    assert.ok(predecessorComponent.componentId > dependentComponent.componentId);
    assert.equal(ownership.ownerComponentId, predecessorComponent.componentId);
    assert.ok(selected.score.breakdown.sharedFileChurnCost > 0);
    assert.equal(selected.compatibilityReceiptRequirementCount, 1);
    assert.deepEqual(ownerPartition.ownedArtifactPaths, ['src/shared.ts']);
    assert.deepEqual(dependentPartition.ownedArtifactPaths, []);
    assert.ok(
      dependentPartition.dependencyPartitionIds.includes(ownerPartition.partitionId)
    );
    assert.deepEqual(dependentPartition.sharedArtifactDependencies, [
      {
        path: 'src/shared.ts',
        dependencyPartitionIds: [ownerPartition.partitionId],
      },
    ]);
    assert.equal(
      dependentPartition.compatibilityReceiptRequirements[0]
        .predecessorPartitionId,
      ownerPartition.partitionId
    );
    assert.equal(
      dependentPartition.compatibilityReceiptRequirements[0].artifactPath,
      'src/shared.ts'
    );
  });

  it('omits compatibility requirements when owner and consumer share a partition', () => {
    const current = input();
    for (const [index, component] of current.componentGraph.components.entries()) {
      component.estimatedClosureMinutes = 90;
      component.closureMinuteBreakdown.declaredTaskMinutes = 90;
      component.closureMinuteBreakdown.totalMinutes = 90;
      current.executionProjection.atomicTasks[index].estimatedClosureMinutes = 90;
    }
    sealExecutionProjection(current.executionProjection);
    current.componentGraph.executionProjectionHash =
      current.executionProjection.executionProjectionHash;
    current.policyBinding.executionProjectionHash =
      current.executionProjection.executionProjectionHash;
    current.executionProjection.fileScopeIndex = [
      {
        fileScopeId: 'file-shared',
        path: 'src/shared.ts',
        taskIds: ['task-a', 'task-b'],
      },
    ];
    for (const component of current.componentGraph.components) {
      component.fileScopeIds = ['file-shared'];
    }
    current.componentGraph.sharedArtifactOwnership = [
      {
        fileScopeId: 'file-shared',
        path: 'src/shared.ts',
        ownerComponentId: current.componentGraph.components[0].componentId,
        participatingComponentIds: current.componentGraph.components.map(
          (component) => component.componentId
        ),
      },
    ];
    sealExecutionProjection(current.executionProjection);
    current.componentGraph.executionProjectionHash =
      current.executionProjection.executionProjectionHash;
    current.policyBinding.executionProjectionHash =
      current.executionProjection.executionProjectionHash;
    current.optimization = structuredClone(
      optimizePartitions({
        componentGraph: current.componentGraph,
        executionProjection: current.executionProjection,
        policyBinding: current.policyBinding,
      })
    );

    const compiled = compilePartitionManifest(current);

    assert.equal(compiled.manifest.partitions.length, 1);
    assert.deepEqual(compiled.manifest.partitions[0].ownedArtifactPaths, [
      'src/shared.ts',
    ]);
    assert.deepEqual(compiled.manifest.partitions[0].sharedArtifactDependencies, []);
    assert.deepEqual(
      compiled.manifest.partitions[0].compatibilityReceiptRequirements,
      []
    );
  });

  it('rejects a shared owner that resolves to a future partition', () => {
    const current = input();
    current.componentGraph.sharedArtifactOwnership = [
      {
        fileScopeId: 'file-shared',
        path: 'src/shared.ts',
        ownerComponentId: current.componentGraph.components[1].componentId,
        participatingComponentIds: current.componentGraph.components.map(
          (component) => component.componentId
        ),
      },
    ];

    assert.throws(
      () => compilePartitionManifest(current),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'optimization_input_currentness_mismatch' &&
        error.causeReason === 'component_graph_canonical_mismatch'
    );
  });

  it('rejects optimizer dependency sets that omit a shared predecessor', () => {
    const current = input();
    const dependent = current.optimization.partitions[1];
    dependent.dependencyPartitionIds = [];
    dependent.partitionId = expectedPartitionId(
      dependent,
      current.executionProjection.executionProjectionHash
    );
    current.optimization.topologicalOrder[1] = dependent.partitionId;

    assert.throws(
      () => compilePartitionManifest(current),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'partition_dependency_set_mismatch'
    );
  });

  it('compiles a strict current manifest and analysis receipt', () => {
    const compiled = compilePartitionManifest(input());

    assert.equal(
      compiled.manifest.schemaVersion,
      'goal-contract-partition-manifest/v1'
    );
    assert.equal(compiled.manifest.partitionCount, 2);
    assert.match(compiled.manifest.manifestId, /^partition-manifest-[0-9a-f]{64}$/u);
    assert.equal(compiled.manifest.masterSourcePath, 'docs/source-plan.md');
    assert.equal(compiled.manifest.masterSourceHash, SOURCE_HASH);
    assert.equal(compiled.manifest.masterSourceSemanticHash, SOURCE_SEMANTIC_HASH);
    assert.equal(
      compiled.manifest.taskDagHash,
      input().executionProjection.taskDagHash
    );
    assert.match(compiled.partitionRunId, /^partition-run-[0-9a-f]{64}$/u);
    assert.match(compiled.manifest.partitionSetHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(compiled.partitionManifestHash, /^sha256:[0-9a-f]{64}$/u);
    assert.deepEqual(
      compiled.manifest.topologicalOrder,
      input().optimization.topologicalOrder
    );
    assert.equal(
      compiled.analysisReceipt.implementationViewReceipt.state,
      'not_applicable'
    );
    assert.equal(
      compiled.analysisReceipt.acceptanceEvidenceViewReceipt.state,
      'not_applicable'
    );
    assert.equal(compiled.analysisReceipt.runId, compiled.partitionRunId);
    assert.equal(compiled.analysisReceipt.semanticDerivationMode, 'structured_fast_path');
    assert.equal(
      compiled.analysisReceipt.candidateCount,
      compiled.analysisReceipt.validCandidateCount +
        compiled.analysisReceipt.rejectedCandidateSummaries.length
    );
    assert.equal(
      compiled.analysisReceipt.validCandidateCount,
      input().optimization.candidates.length
    );
    assert.equal(compiled.analysisReceipt.selectedCandidateScore, 420);
    assert.deepEqual(
      compiled.analysisReceipt.selectedCandidateScoreBreakdown,
      input().optimization.candidates[0].score.breakdown
    );
    assert.match(compiled.analysisReceipt.completedAt, /^\d{4}-\d{2}-\d{2}T/u);
    assert.deepEqual(compiled.manifest.partitions[0].primaryEpicIds, ['epic-a']);
    assert.deepEqual(compiled.manifest.partitions[0].primarySourceObligationIds, [
      'source-a',
    ]);
    assert.deepEqual(compiled.manifest.partitions[0].acceptanceIds, ['acceptance-a']);
    assert.deepEqual(compiled.manifest.partitions[0].commandIds, ['command-a']);
    assert.deepEqual(compiled.manifest.partitions[0].ownedArtifactPaths, ['src/a.ts']);
    assert.equal(compiled.manifest.partitions[0].estimatedClosureCost.unit, 'minutes');
    assert.equal(
      compiled.partitionAnalysisReceiptHash,
      hash(compiled.analysisReceiptBytes)
    );
    assert.equal(validatePartitionManifest(compiled).decision, 'pass');
  });

  it('rejects execution projection payload drift during manifest compilation', () => {
    const changed = input();
    changed.executionProjection.traceSlices[0].observableOutcome =
      'Tampered outcome.';

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'optimization_input_currentness_mismatch' &&
        error.causeReason === 'execution_projection_hash_mismatch'
    );
  });

  it('rejects synchronized removal of a mandatory projection graph authority pair', () => {
    const changed = input();
    delete changed.executionProjection.integrationJoinGraph;
    delete changed.executionProjection.integrationJoinGraphHash;
    resealExecutionProjectionIdentity(changed.executionProjection);
    changed.componentGraph.executionProjectionHash =
      changed.executionProjection.executionProjectionHash;
    changed.policyBinding.executionProjectionHash =
      changed.executionProjection.executionProjectionHash;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'optimization_input_currentness_mismatch' &&
        error.causeReason === 'integrationJoinGraph_authority_invalid'
    );
  });

  it('rejects synchronized integration semantic deletion before manifest derivation', () => {
    const projectionAuthority = canonicalIntegrationProjectionAuthority();
    const executionProjection = structuredClone(
      compileExecutionProjection(projectionAuthority)
    );
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
    const changed = input({
      executionProjection,
      projectionAuthority,
      optimization: input().optimization,
    });

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'execution_projection_currentness_mismatch' &&
        error.causeFailureClass ===
          'execution_projection_currentness_mismatch'
    );
  });

  it('requires canonical projection authority before manifest derivation', () => {
    const projectionAuthority = canonicalIntegrationProjectionAuthority();
    const executionProjection =
      compileExecutionProjection(projectionAuthority);
    const changed = input({
      executionProjection,
      optimization: input().optimization,
    });

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'execution_projection_authority_missing'
    );
  });

  it('rejects upstream authority payloads and hashes that diverge from the projection', () => {
    const mutations = [
      (changed) => {
        changed.sourceObligationGraph.obligations[0].id = 'source-tampered';
      },
      (changed) => {
        changed.sourceObligationGraphHash = hash('obligations-tampered');
      },
      (changed) => {
        changed.methodologyProfileHash = hash('methodology-tampered');
      },
      (changed) => {
        changed.reconciledGraph.traceSlices[0].directCommands = [
          'command-tampered',
        ];
      },
      (changed) => {
        changed.reconciledGraphHash = hash('reconciled-tampered');
      },
    ];

    for (const mutate of mutations) {
      const changed = input();
      mutate(changed);
      assert.throws(
        () => compilePartitionManifest(changed),
        (error) =>
          error.failureClass === 'partition_manifest_currentness_mismatch' &&
          error.reason === 'manifest_input_authority_mismatch'
      );
    }
  });

  it('rejects a non-canonical component graph before consuming optimization', () => {
    const changed = input();
    changed.executionProjection.productionEntryIndex = [
      {
        productionEntryId: 'entry-shared',
        literal: 'public action',
        taskIds: ['task-a', 'task-b'],
      },
    ];
    changed.executionProjection.integrationJoinGraph = { joins: [] };
    changed.executionProjection.taskDag.edges = [];
    changed.executionProjection.atomicTasks[1].dependencyIds = [];
    changed.componentGraph.integrationFanInOwnership = [];
    for (const component of changed.componentGraph.components) {
      component.productionEntryIds = ['entry-shared'];
      component.estimatedClosureMinutes = 115;
      component.closureMinuteBreakdown = {
        declaredTaskMinutes: 115,
        derivedTaskMinutes: 0,
        verificationMinutes: 0,
        coordinationMinutes: 0,
        totalMinutes: 115,
      };
    }
    for (const task of changed.executionProjection.atomicTasks) {
      task.estimatedClosureMinutes = 115;
    }
    sealExecutionProjection(changed.executionProjection);
    changed.componentGraph.executionProjectionHash =
      changed.executionProjection.executionProjectionHash;
    changed.policyBinding.executionProjectionHash =
      changed.executionProjection.executionProjectionHash;

    assert.equal(
      buildPartitionComponents({
        executionProjection: changed.executionProjection,
        policy: changed.policyBinding.policy,
      }).components.length,
      1
    );
    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'optimization_input_currentness_mismatch' &&
        error.causeReason === 'component_graph_canonical_mismatch'
    );
  });

  it('rejects non-canonical optimizer arrays while keeping display metadata non-authoritative', () => {
    const baseline = compilePartitionManifest(input());
    const reorderedInput = input();
    reorderedInput.optimization.partitions.reverse();
    for (const item of reorderedInput.optimization.partitions) {
      item.primaryComponentIds.reverse();
      item.primaryTraceSliceIds.reverse();
      item.primaryTaskIds.reverse();
      item.dependencyPartitionIds.reverse();
    }
    assert.throws(
      () => compilePartitionManifest(reorderedInput),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'optimization_receipt_mismatch'
    );

    const renamed = compilePartitionManifest({
      ...input(),
      displayTitles: {
        [baseline.manifest.partitions[0].partitionId]: 'Small closure slice',
      },
    });
    assert.equal(
      renamed.manifest.partitions[0].partitionId,
      baseline.manifest.partitions[0].partitionId
    );
    assert.notEqual(renamed.partitionManifestHash, baseline.partitionManifestHash);
  });

  it('rejects score, membership and topological tampering', () => {
    const compiled = compilePartitionManifest(input());
    const mutations = [
      (value) => {
        value.analysisReceipt.selectedCandidateScore += 1;
      },
      (value) => {
        value.manifest.partitions[0].primaryTaskIds.push('task-tampered');
      },
      (value) => {
        value.manifest.topologicalOrder.reverse();
      },
    ];

    for (const mutate of mutations) {
      const changed = structuredClone(compiled);
      mutate(changed);
      assert.throws(
        () => validatePartitionManifest(changed),
        (error) =>
          error.failureClass === 'partition_manifest_currentness_mismatch' ||
          error.failureClass === 'partition_manifest_hash_mismatch'
      );
    }
  });

  it('rejects semantic membership that does not match partitionId', () => {
    const changed = input();
    changed.optimization.partitions[0].partitionRole = 'authority_transition';

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'partition_id_mismatch'
    );
  });

  it('rejects an optimization that omits an isolated component', () => {
    const changed = input();
    const [firstPartition] = changed.optimization.partitions;
    changed.optimization.partitionCount = 1;
    changed.optimization.partitions = [firstPartition];
    changed.optimization.topologicalOrder = [firstPartition.partitionId];
    changed.optimization.candidates[0].partitions = [firstPartition];

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'component_partition_coverage_mismatch'
    );
  });

  it('rejects selected candidate membership drift', () => {
    const changed = input();
    changed.optimization.candidates[0].partitions = [
      changed.optimization.partitions[0],
    ];

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'selected_candidate_partition_mismatch'
    );
  });

  it('rejects duplicate membership inside the selected candidate', () => {
    const changed = input();
    changed.optimization.candidates[0].partitions = structuredClone(
      changed.optimization.partitions
    );
    changed.optimization.candidates[0].partitions[0].primaryComponentIds.push(
      'component-a'
    );

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'selected_candidate_partition_mismatch'
    );
  });

  it('rejects selected candidate partition semantic drift', () => {
    const changed = input();
    changed.optimization.candidates[0].partitions = structuredClone(
      changed.optimization.partitions
    );
    changed.optimization.candidates[0].partitions[0].estimatedClosureMinutes += 1;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'selected_candidate_partition_mismatch'
    );
  });

  it('rejects multiple selected candidates with divergent semantics', () => {
    const changed = input();
    const divergent = structuredClone(changed.optimization.candidates[0]);
    divergent.candidateId = 'candidate-divergent';
    divergent.partitions = [changed.optimization.partitions[0]];
    divergent.score.total += 1;
    changed.optimization.candidates.push(divergent);
    changed.optimization.searchReceipt.candidateCount += 1;
    changed.optimization.searchReceipt.validCandidateCount += 1;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'selected_candidate_cardinality_mismatch'
    );
  });

  it('rejects duplicate candidate IDs', () => {
    const changed = input();
    const duplicate = structuredClone(changed.optimization.candidates[0]);
    duplicate.selected = false;
    duplicate.score.total += 1;
    changed.optimization.candidates.push(duplicate);
    changed.optimization.searchReceipt.candidateCount += 1;
    changed.optimization.searchReceipt.validCandidateCount += 1;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_id_duplicate'
    );
  });

  it('rejects selected candidate ID drift', () => {
    const changed = input();
    changed.optimization.selectedCandidateId = 'candidate-other';

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'selected_candidate_id_mismatch'
    );
  });

  it('rejects selected candidate score total drift', () => {
    const changed = inputWithMultipleCandidates();
    const selected = changed.optimization.candidates.find(
      (candidate) => candidate.selected
    );
    selected.score.total += 1;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_score_mismatch'
    );
  });

  it('rejects unselected candidate score breakdown drift', () => {
    const changed = inputWithMultipleCandidates();
    const unselected = changed.optimization.candidates.find(
      (candidate) => !candidate.selected
    );
    assert.ok(unselected);
    unselected.score.breakdown.dependencyCutCost += 1;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_score_mismatch'
    );
  });

  it('rejects a selected candidate that is not canonically optimal', () => {
    const changed = inputWithMultipleCandidates();
    const worse = changed.optimization.candidates.find(
      (candidate) => !candidate.selected
    );
    assert.ok(worse);
    for (const candidate of changed.optimization.candidates) {
      candidate.selected = candidate.candidateId === worse.candidateId;
    }
    changed.optimization.selectedCandidateId = worse.candidateId;
    changed.optimization.partitionCount = worse.partitions.length;
    changed.optimization.partitions = structuredClone(worse.partitions);
    changed.optimization.topologicalOrder = worse.partitions.map(
      (partition) => partition.partitionId
    );

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'selected_candidate_not_optimal'
    );
  });

  it('rejects removal of the canonical best candidate', () => {
    const changed = inputWithMultipleCandidates();
    const worse = structuredClone(
      changed.optimization.candidates.find((candidate) => !candidate.selected)
    );
    assert.ok(worse);
    worse.selected = true;
    changed.optimization.candidates = [worse];
    changed.optimization.selectedCandidateId = worse.candidateId;
    changed.optimization.partitionCount = worse.partitions.length;
    changed.optimization.partitions = structuredClone(worse.partitions);
    changed.optimization.topologicalOrder = worse.partitions.map(
      (partition) => partition.partitionId
    );
    changed.optimization.searchReceipt.validCandidateCount = 1;
    changed.optimization.searchReceipt.candidateCount =
      1 + changed.optimization.rejectedCandidateSummaries.length;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'optimization_receipt_mismatch'
    );
  });

  it('rejects an oversized unselected candidate', () => {
    const changed = inputWithMultipleCandidates();
    const unselected = changed.optimization.candidates.find(
      (candidate) => !candidate.selected
    );
    assert.ok(unselected);
    unselected.partitions[0].estimatedClosureMinutes =
      changed.policyBinding.policy.limits.maxClosureMinutesPerPartition + 1;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_hard_constraint_mismatch'
    );
  });

  it('rejects a future dependency in an unselected candidate', () => {
    const changed = inputWithMultipleCandidates();
    const selected = changed.optimization.candidates.find(
      (candidate) => candidate.selected
    );
    const future = structuredClone(selected);
    future.candidateId = 'candidate-future-dependency';
    future.selected = false;
    future.partitions.reverse();
    changed.optimization.candidates.push(future);
    changed.optimization.searchReceipt.candidateCount += 1;
    changed.optimization.searchReceipt.validCandidateCount += 1;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_hard_constraint_mismatch'
    );
  });

  it('rejects write-scope ownership overflow in an unselected candidate', () => {
    const changed = inputWithMultipleCandidates();
    const unselected = changed.optimization.candidates.find(
      (candidate) => !candidate.selected
    );
    assert.ok(unselected);
    unselected.partitions[0].primaryWriteScopeOwnerCount =
      changed.policyBinding.policy.limits
        .maxPrimaryWriteScopeOwnersPerPartition + 1;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_hard_constraint_mismatch'
    );
  });

  it('rejects an unknown trace slice in an unselected candidate', () => {
    const changed = inputWithMultipleCandidates();
    const unselected = changed.optimization.candidates.find(
      (candidate) => !candidate.selected
    );
    assert.ok(unselected);
    unselected.partitions.at(-1).primaryTraceSliceIds = ['slice-nonexistent'];

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_hard_constraint_mismatch'
    );
  });

  it('rejects an unknown atomic task in an unselected candidate', () => {
    const changed = inputWithMultipleCandidates();
    const unselected = changed.optimization.candidates.find(
      (candidate) => !candidate.selected
    );
    assert.ok(unselected);
    unselected.partitions.at(-1).primaryTaskIds = ['task-nonexistent'];

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_hard_constraint_mismatch'
    );
  });

  it('rejects a non-canonical partition ID in an unselected candidate', () => {
    const changed = inputWithMultipleCandidates();
    const unselected = changed.optimization.candidates.find(
      (candidate) => !candidate.selected
    );
    assert.ok(unselected);
    unselected.partitions.at(-1).partitionId = 'partition-tampered';

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_hard_constraint_mismatch'
    );
  });

  it('rejects a non-canonical candidate ID', () => {
    const changed = inputWithMultipleCandidates();
    const unselected = changed.optimization.candidates.find(
      (candidate) => !candidate.selected
    );
    assert.ok(unselected);
    unselected.candidateId = 'candidate-tampered';

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_hard_constraint_mismatch'
    );
  });

  it('rejects canonical manifest seed drift', () => {
    const changed = inputWithMultipleCandidates();
    const unselected = changed.optimization.candidates.find(
      (candidate) => !candidate.selected
    );
    assert.ok(unselected);
    unselected.canonicalManifestSeed.graphSeed.components[0].traceSliceIds = [
      'slice-nonexistent',
    ];

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_hard_constraint_mismatch'
    );
  });

  it('rejects compatibility requirement count drift', () => {
    const changed = inputWithMultipleCandidates();
    const unselected = changed.optimization.candidates.find(
      (candidate) => !candidate.selected
    );
    assert.ok(unselected);
    unselected.compatibilityReceiptRequirementCount += 1;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_hard_constraint_mismatch'
    );
  });

  it('rejects a missing cross-partition dependency count', () => {
    const changed = inputWithMultipleCandidates();
    const unselected = changed.optimization.candidates.find(
      (candidate) => !candidate.selected
    );
    assert.ok(unselected);
    delete unselected.crossPartitionDependencyCount;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_hard_constraint_mismatch'
    );
  });

  it('rejects search receipt counts that do not match candidate arrays', () => {
    const changed = inputWithMultipleCandidates();
    changed.optimization.searchReceipt.candidateCount += 1;
    changed.optimization.searchReceipt.validCandidateCount += 1;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_search_receipt_mismatch'
    );
  });

  it('rejects missing trace slice coverage after partition IDs are recomputed', () => {
    const changed = input();
    const target = changed.optimization.partitions[1];
    target.primaryTraceSliceIds = ['slice-a'];
    target.partitionId = expectedPartitionId(
      target,
      changed.executionProjection.executionProjectionHash
    );
    changed.optimization.topologicalOrder[1] = target.partitionId;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'trace_slice_partition_coverage_mismatch'
    );
  });

  it('rejects missing atomic task coverage after partition IDs are recomputed', () => {
    const changed = input();
    const target = changed.optimization.partitions[1];
    target.primaryTaskIds = ['task-a'];
    target.partitionId = expectedPartitionId(
      target,
      changed.executionProjection.executionProjectionHash
    );
    changed.optimization.topologicalOrder[1] = target.partitionId;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'atomic_task_partition_coverage_mismatch'
    );
  });

  it('rejects optimizer partition count drift', () => {
    const changed = input();
    changed.optimization.partitionCount = 1;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'optimizer_partition_count_mismatch'
    );
  });

  it('rejects a caller-authored governed partition role', () => {
    const changed = input();
    changed.optimization.partitions[0].partitionRole = 'authority_transition';
    changed.optimization.partitions[0].partitionId = expectedPartitionId(
      changed.optimization.partitions[0],
      changed.executionProjection.executionProjectionHash
    );
    changed.optimization.topologicalOrder[0] =
      changed.optimization.partitions[0].partitionId;
    changed.optimization.partitions[1].dependencyPartitionIds = [
      changed.optimization.partitions[0].partitionId,
    ];
    changed.optimization.partitions[1].partitionId = expectedPartitionId(
      changed.optimization.partitions[1],
      changed.executionProjection.executionProjectionHash
    );
    changed.optimization.topologicalOrder[1] =
      changed.optimization.partitions[1].partitionId;

    assert.throws(
      () => compilePartitionManifest(changed),
      (error) =>
        error.failureClass === 'partition_manifest_currentness_mismatch' &&
        error.reason === 'candidate_hard_constraint_mismatch'
    );
  });

  it('resolves source and dist schema roots to the correct asset owner', () => {
    assert.equal(
      resolveAssetRoot({
        filename: 'D:/repo/packages/bmad-speckit/src/utils/goal-contract/partition-manifest.ts',
        dirname: 'D:/repo/packages/bmad-speckit/src/utils/goal-contract',
      }),
      path.normalize('D:/repo')
    );
    assert.equal(
      resolveAssetRoot({
        filename: 'D:/repo/packages/bmad-speckit/dist/utils/goal-contract/partition-manifest.js',
        dirname: 'D:/repo/packages/bmad-speckit/dist/utils/goal-contract',
      }),
      path.normalize('D:/repo/packages/bmad-speckit')
    );
  });

  it('stages analysis and manifest atomically without promoting the active output', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partition-stage-'));
    const activeOut = path.join(root, 'active-manifest.json');
    fs.writeFileSync(activeOut, 'previous-active\n', 'utf8');
    const compiled = compilePartitionManifest(input());
    const staged = stagePartitionSolution({
      compiled,
      receiptsDir: path.join(root, 'receipts'),
      activeManifestPath: activeOut,
    });

    assert.equal(fs.readFileSync(activeOut, 'utf8'), 'previous-active\n');
    assert.equal(fs.existsSync(staged.analysisReceiptPath), true);
    assert.equal(fs.existsSync(staged.manifestPath), true);
    assert.equal(fs.existsSync(staged.stageReceiptPath), true);
    assert.equal(
      hash(fs.readFileSync(staged.analysisReceiptPath)),
      staged.analysisReceiptHash
    );
    assert.equal(
      hash(fs.readFileSync(staged.manifestPath)),
      staged.partitionManifestHash
    );
    assert.equal(
      stagePartitionSolution({
        compiled,
        receiptsDir: path.join(root, 'receipts'),
        activeManifestPath: activeOut,
      }).stageReceiptHash,
      staged.stageReceiptHash
    );
  });

  it('rejects receipts directories that overlap the active output path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partition-stage-overlap-'));
    const activeOut = path.join(root, 'active-manifest.json');
    const compiled = compilePartitionManifest(input());

    for (const receiptsDir of [
      activeOut,
      path.join(activeOut, 'receipts'),
      root,
    ]) {
      assert.throws(
        () =>
          stagePartitionSolution({
            compiled,
            receiptsDir,
            activeManifestPath: activeOut,
          }),
        (error) => error.failureClass === 'partition_output_path_overlap'
      );
    }
    assert.equal(fs.existsSync(activeOut), false);
  });

  it('does not publish a stage receipt when writing crashes before completion', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partition-stage-crash-'));
    const compiled = compilePartitionManifest(input());
    let writes = 0;

    assert.throws(
      () =>
        stagePartitionSolution({
          compiled,
          receiptsDir: path.join(root, 'receipts'),
          writeText(filePath, text) {
            writes += 1;
            if (writes === 2) throw new Error('simulated_crash');
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, text, 'utf8');
          },
        }),
      /simulated_crash/u
    );
    const stageDir = path.join(
      root,
      'receipts',
      '.partition-staging',
      compiled.partitionRunId
    );
    assert.equal(fs.existsSync(path.join(stageDir, 'stage.receipt.json')), false);
  });
});
