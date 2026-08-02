const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const Ajv2020 = require('ajv/dist/2020');

const {
  compilePartitionManifest,
  finalizePartitionManifest,
  resolveAssetRoot,
  stagePartitionSolution,
  validatePartitionManifest,
} = require('../src/utils/goal-contract/partition-manifest.ts');
const {
  createPendingChildCompilationReceipt,
} = require('../src/utils/goal-contract/partition-receipts.ts');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  projectExecutionArtifacts,
} = require('../src/utils/goal-contract/control-plane/partition-compiler.ts');
const {
  evaluateGoalContractRelease,
  validateFinalManifestChildMembership,
} = require('../src/utils/goal-contract/release-gate.ts');
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
const PARTITION_MANIFEST_SCHEMA = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '_bmad',
      'shared',
      'goal-contract',
      'goal-contract-partition-manifest.schema.json'
    ),
    'utf8'
  )
);

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

function disabledRequiredInput() {
  const current = input();
  const projection = current.executionProjection;
  projection.sequenceConstraintBinding = {
    sequenceMode: 'disabled',
    applicabilityDecision: 'required',
    applicabilityReceiptHash: hash('disabled-required'),
    sequenceCoverage: 'excluded',
    sequenceClosureStatus: 'not_requested',
    childContractAuthority: 'core_only',
    sequenceContractHash: null,
    semanticConstraintHash: hash(
      stableStringify({ constraints: [], joins: [] })
    ),
    constraints: [],
  };
  projection.integrationJoinGraph = { joins: [] };
  projection.taskDag.edges = [];
  for (const task of projection.atomicTasks) {
    task.dependencyIds = [];
    task.sequenceConstraintIds = [];
  }
  for (const slice of projection.traceSlices) {
    slice.sequenceConstraintIds = [];
  }
  sealExecutionProjection(projection);
  current.policyBinding.executionProjectionHash =
    projection.executionProjectionHash;
  current.componentGraph = structuredClone(
    buildPartitionComponents({
      executionProjection: projection,
      policy: current.policyBinding.policy,
    })
  );
  current.optimization = structuredClone(
    optimizePartitions({
      componentGraph: current.componentGraph,
      executionProjection: projection,
      policyBinding: current.policyBinding,
    })
  );
  return current;
}

function permutationAuthority(sequenceMode, reverse) {
  const graph = {
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
      },
      {
        id: 'task-b',
        title: 'Task B',
        sourceIds: ['source-b', 'source-a'],
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
        closeCondition: 'A closes.',
      },
      {
        id: 'slice-b',
        goalIds: ['task-b'],
        sourceIds: ['source-b', 'source-a'],
        acceptanceIds: ['acceptance-b'],
        evidenceIds: ['evidence-b'],
        productionSymbols: ['entry-b'],
        allowedPaths: ['src/b.ts'],
        closeCondition: 'B closes.',
      },
    ],
    dependencies: [
      { from: 'task-b', to: 'task-a' },
    ],
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
        sourceIds: ['source-b', 'source-a'],
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
  };
  if (reverse) {
    for (const field of [
      'sourceObligations',
      'tasks',
      'traceSlices',
      'dependencies',
      'acceptanceItems',
      'expectedEvidence',
      'productionEntryPoints',
    ]) {
      graph[field].reverse();
    }
    for (const task of graph.tasks) task.sourceIds.reverse();
    for (const slice of graph.traceSlices) {
      for (const field of [
        'goalIds',
        'sourceIds',
        'acceptanceIds',
        'evidenceIds',
        'productionSymbols',
        'allowedPaths',
      ]) {
        slice[field].reverse();
      }
    }
    for (const acceptance of graph.acceptanceItems) {
      for (const field of [
        'traceIds',
        'goalIds',
        'sourceIds',
        'expectedEvidenceIds',
      ]) {
        acceptance[field].reverse();
      }
    }
    for (const evidence of graph.expectedEvidence) {
      evidence.producerTaskIds.reverse();
      evidence.admissibleTypes.reverse();
    }
  }
  const sourceObligationGraph = {
    obligations: [...graph.sourceObligations]
      .map(({ id, applicabilityState }) => ({ id, applicabilityState }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
  return {
    sourceObligationGraph,
    projectionAuthority: {
      sourceSnapshotHash: SOURCE_HASH,
      sourceObligationGraphHash:
        hashSourceObligationGraph(sourceObligationGraph),
      methodologyProfileHash: hash('permutation-methodology'),
      semanticModelHash: hash('permutation-semantic'),
      traceGraphHash: hash('permutation-trace'),
      reconciledGraph: graph,
      sequenceApplicabilityReceipt: {
        decision: 'not_applicable_with_proof',
        receiptHash: hash('permutation-applicability'),
      },
      sequenceConstraintInput: null,
      sequenceExecutionState: {
        sequenceMode,
        sequenceApplicability: 'not_applicable_with_proof',
        sequenceCoverage: 'not_applicable',
        sequenceClosureStatus: 'not_required',
        childContractAuthority: 'full',
        shouldResolveProducer: false,
      },
    },
  };
}

function compilePermutationManifest(sequenceMode, reverse) {
  const {
    sourceObligationGraph,
    projectionAuthority,
  } = permutationAuthority(sequenceMode, reverse);
  const initialExecutionProjection =
    compileExecutionProjection(projectionAuthority);
  const reconciledGraph = {
    schemaVersion: projectionAuthority.reconciledGraph.schemaVersion,
    executionEpics: initialExecutionProjection.executionEpics,
    traceSlices: initialExecutionProjection.traceSlices.map((slice) => ({
      ...slice,
      directCommands: [`command-${slice.sliceId}`],
    })),
    atomicTasks: initialExecutionProjection.atomicTasks,
    completionPredicates: initialExecutionProjection.completionPredicates,
    evidenceContracts: initialExecutionProjection.evidenceContracts,
  };
  const reconciledGraphHash = hash(stableStringify(reconciledGraph));
  const currentProjectionAuthority = {
    ...projectionAuthority,
    reconciledGraphHash,
  };
  const executionProjection = compileExecutionProjection(
    currentProjectionAuthority
  );
  assert.equal(
    reconciledGraphHash,
    executionProjection.reconciledGraphHash
  );
  const policy = structuredClone(PARTITION_POLICY);
  const policyBinding = {
    policy,
    partitionPolicyHash: hash(stableStringify(policy)),
    sourceSnapshotHash: SOURCE_HASH,
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
    projectionAuthority: currentProjectionAuthority,
  });
  return compilePartitionManifest({
    sourceSnapshot: {
      sourcePath: 'docs/permutation-source.md',
      aggregateHash: SOURCE_HASH,
      exactByteHash: SOURCE_HASH,
      sourcePlanSemanticHash: SOURCE_SEMANTIC_HASH,
    },
    sourceObligationGraph,
    sourceObligationGraphHash:
      currentProjectionAuthority.sourceObligationGraphHash,
    methodologyProfileHash:
      currentProjectionAuthority.methodologyProfileHash,
    reconciledGraph,
    reconciledGraphHash,
    reconciliationReceiptHash: hash('permutation-reconciliation'),
    executionProjection,
    projectionAuthority: currentProjectionAuthority,
    policyBinding,
    semanticDerivationMode: 'structured_fast_path',
    componentGraph,
    optimization,
  });
}

describe('goal-contract partition manifest', () => {
  it('derives shared ownership and compatibility obligations through the production chain', () => {
    const authority = input();
    const reconciledGraph = {
      schemaVersion: 'goal-contract-reconciled-graph-input/v2',
      traceSlices: [
        {
          id: 'slice-0',
          taskIds: ['task-0'],
          directCommands: ['command-0'],
        },
        {
          id: 'slice-14',
          taskIds: ['task-14'],
          directCommands: ['command-14'],
        },
      ],
    };
    const reconciledGraphHash = hash(stableStringify(reconciledGraph));
    const executionProjection = {
      schemaVersion: 'goal-contract-execution-projection/v1',
      sourceSnapshotHash: SOURCE_HASH,
      sourceObligationGraphHash: authority.sourceObligationGraphHash,
      methodologyProfileHash: authority.methodologyProfileHash,
      semanticModelHash: hash('semantic-shared'),
      reconciledGraphHash,
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
      reconciledGraph,
      reconciledGraphHash,
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

    const missingCommands = structuredClone(compiled);
    missingCommands.manifest.partitions[0].commandIds = [];
    assert.throws(
      () => validatePartitionManifest(missingCommands),
      (error) =>
        error.failureClass === 'partition_manifest_schema_invalid'
    );
  });

  it('binds disabled Sequence authority and rejects authority tampering', () => {
    const compiled = compilePartitionManifest(disabledRequiredInput());
    const manifest = compiled.manifest;

    assert.equal(manifest.sequenceMode, 'disabled');
    assert.equal(manifest.sequenceApplicability, 'required');
    assert.equal(manifest.sequenceCoverage, 'excluded');
    assert.equal(manifest.sequenceClosureStatus, 'not_requested');
    assert.equal(manifest.childContractAuthority, 'core_only');
    assert.equal(
      manifest.partitions.every(
        (partition) => partition.inheritedConstraintIds.length === 0
      ),
      true
    );

    const tampered = structuredClone(compiled);
    tampered.manifest.childContractAuthority = 'full';
    assert.throws(
      () => validatePartitionManifest(tampered),
      (error) =>
        error.failureClass ===
        'partition_manifest_sequence_authority_invalid'
    );
  });

  it('is byte-stable under projection input permutation for every mode', () => {
    for (const sequenceMode of ['auto', 'required', 'disabled']) {
      const canonical = compilePermutationManifest(sequenceMode, false);
      const permuted = compilePermutationManifest(sequenceMode, true);

      assert.equal(
        permuted.partitionManifestBytes,
        canonical.partitionManifestBytes
      );
      assert.equal(
        permuted.partitionManifestHash,
        canonical.partitionManifestHash
      );
    }
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
      2
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
    const repositoryRoot = path.join(path.parse(process.cwd()).root, 'repo');
    const packageRoot = path.join(repositoryRoot, 'packages', 'bmad-speckit');
    assert.equal(
      resolveAssetRoot({
        filename: path.join(
          packageRoot,
          'src',
          'utils',
          'goal-contract',
          'partition-manifest.ts'
        ),
        dirname: path.join(packageRoot, 'src', 'utils', 'goal-contract'),
      }),
      repositoryRoot
    );
    assert.equal(
      resolveAssetRoot({
        filename: path.join(
          packageRoot,
          'dist',
          'utils',
          'goal-contract',
          'partition-manifest.js'
        ),
        dirname: path.join(packageRoot, 'dist', 'utils', 'goal-contract'),
      }),
      packageRoot
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

function finalizationPlan() {
  const policyHash = hash('composition-policy');
  const snapshotSetHash = hash('ordered-source-set');
  const authorityBundleHash = hash('source-authority-bundle');
  const parentGoalHash = hash('parent-goal');
  const partitionPolicyHash = hash('partition-policy');
  const partitionA = {
    partitionId: `partition-${'1'.repeat(64)}`,
    primaryComponentIds: ['component-a'],
    primaryTraceSliceIds: ['slice-a'],
    primaryTaskIds: ['task-a'],
    dependencyPartitionIds: [],
    partitionRole: 'implementation',
    partitionRoleDerived: true,
    outcome: 'Complete child A.',
    primaryEpicIds: ['epic-a'],
    primarySourceObligationIds: ['source-a'],
    inheritedConstraintIds: [],
    acceptanceIds: ['acceptance-a'],
    commandIds: ['command-a'],
    evidenceContractIds: ['evidence-a'],
    completionPredicateIds: ['acceptance-a'],
    ownedArtifactPaths: ['src/a.ts', 'src/shared.ts'],
    sharedArtifactDependencies: [],
    compatibilityReceiptRequirements: [],
    blockedConditions: [],
    failureClasses: [],
    estimatedClosureCost: {
      unit: 'minutes',
      total: 30,
      breakdown: {
        declaredTaskMinutes: 20,
        derivedTaskMinutes: 0,
        verificationMinutes: 10,
        coordinationMinutes: 0,
        totalMinutes: 30,
      },
    },
    estimatedClosureMinutes: 30,
    closureMinuteBreakdown: {
      declaredTaskMinutes: 20,
      derivedTaskMinutes: 0,
      verificationMinutes: 10,
      coordinationMinutes: 0,
      totalMinutes: 30,
    },
    primaryWriteScopeOwnerCount: 2,
  };
  const partitionB = {
    partitionId: `partition-${'2'.repeat(64)}`,
    primaryComponentIds: ['component-b'],
    primaryTraceSliceIds: ['slice-b'],
    primaryTaskIds: ['task-b'],
    dependencyPartitionIds: [partitionA.partitionId],
    partitionRole: 'final_integration',
    partitionRoleDerived: true,
    outcome: 'Complete child B.',
    primaryEpicIds: ['epic-b'],
    primarySourceObligationIds: ['source-b'],
    inheritedConstraintIds: [],
    acceptanceIds: ['acceptance-b'],
    commandIds: ['command-b'],
    evidenceContractIds: ['evidence-b'],
    completionPredicateIds: ['acceptance-b'],
    ownedArtifactPaths: ['src/b.ts'],
    sharedArtifactDependencies: [
      {
        path: 'src/shared.ts',
        dependencyPartitionIds: [partitionA.partitionId],
      },
    ],
    compatibilityReceiptRequirements: [
      {
        artifactPath: 'src/shared.ts',
        predecessorPartitionId: partitionA.partitionId,
        receiptPath: 'pending',
      },
    ],
    blockedConditions: [],
    failureClasses: [],
    estimatedClosureCost: {
      unit: 'minutes',
      total: 40,
      breakdown: {
        declaredTaskMinutes: 20,
        derivedTaskMinutes: 0,
        verificationMinutes: 10,
        coordinationMinutes: 10,
        totalMinutes: 40,
      },
    },
    estimatedClosureMinutes: 40,
    closureMinuteBreakdown: {
      declaredTaskMinutes: 20,
      derivedTaskMinutes: 0,
      verificationMinutes: 10,
      coordinationMinutes: 10,
      totalMinutes: 40,
    },
    primaryWriteScopeOwnerCount: 1,
  };
  const subordinateObligation = {
    intentRecordId: 'intent-subordinate',
    declaredSourceId: 'SUB-REQ-01',
    semanticOwnershipKey: hash('subordinate-owner'),
    namespace: 'SUB',
    sourceArtifactId: 'subordinate-component',
    sourceSnapshotHash: hash('subordinate-source'),
    sourceRole: 'subordinate_component_specification',
    parentTaskRefs: ['task-a'],
    specSpanRefs: ['span-subordinate'],
  };
  const selectionA = {
    partitionId: partitionA.partitionId,
    sourceCompositionPolicyHash: policyHash,
    primaryComponentIds: partitionA.primaryComponentIds,
    primaryTraceSliceIds: partitionA.primaryTraceSliceIds,
    primaryTaskIds: partitionA.primaryTaskIds,
    dependencyPartitionIds: [],
    primarySourceObligationIds: ['source-a'],
    completionPredicateIds: ['acceptance-a'],
    evidenceContractIds: ['evidence-a'],
    ownedArtifactPaths: ['src/a.ts', 'src/shared.ts'],
    namespacedObligations: [subordinateObligation],
    namespaceRefs: ['SUB'],
    sourceArtifactRefs: ['subordinate-component'],
    specSpanRefs: ['span-subordinate'],
    subordinateCoverageReceiptHashes: [hash('subordinate-coverage')],
  };
  selectionA.selectionHash = hashControlPlaneValue(selectionA);
  const selectionB = {
    partitionId: partitionB.partitionId,
    sourceCompositionPolicyHash: policyHash,
    primaryComponentIds: partitionB.primaryComponentIds,
    primaryTraceSliceIds: partitionB.primaryTraceSliceIds,
    primaryTaskIds: partitionB.primaryTaskIds,
    dependencyPartitionIds: [partitionA.partitionId],
    primarySourceObligationIds: ['source-b'],
    completionPredicateIds: ['acceptance-b'],
    evidenceContractIds: ['evidence-b'],
    ownedArtifactPaths: ['src/b.ts'],
    namespacedObligations: [],
    namespaceRefs: [],
    sourceArtifactRefs: [],
    specSpanRefs: [],
    subordinateCoverageReceiptHashes: [],
  };
  selectionB.selectionHash = hashControlPlaneValue(selectionB);
  const partitionSetHash = hashControlPlaneValue(
    [selectionA, selectionB].map(
      ({ partitionId, selectionHash, dependencyPartitionIds }) => ({
        partitionId,
        selectionHash,
        dependencyPartitionIds,
      })
    )
  );
  const childProjectionInputs = [selectionA, selectionB].map((selection) => ({
    ...structuredClone(selection),
    goalContractHash: parentGoalHash,
    orderedSourceSnapshotSetHash: snapshotSetHash,
    sourceAuthorityBundleHash: authorityBundleHash,
    partitionSetHash,
  }));
  const plan = {
    schemaVersion: 'goal-contract-partition-plan/v1',
    sourceCompositionMode: 'composite_required',
    sourceCompositionPolicyHash: policyHash,
    orderedSourceSnapshotSetHash: snapshotSetHash,
    orderedSourceBindings: [
      {
        sourceOrder: 0,
        sourceArtifactId: 'primary-plan',
        sourceRole: 'primary_implementation_authority',
        namespace: 'PRIMARY',
        sourceSnapshotHash: hash('primary-source'),
      },
      {
        sourceOrder: 1,
        sourceArtifactId: 'subordinate-component',
        sourceRole: 'subordinate_component_specification',
        namespace: 'SUB',
        sourceSnapshotHash: hash('subordinate-source'),
      },
    ],
    sourceAuthorityBundleHash: authorityBundleHash,
    canonicalIntentSemanticHash: hash('canonical-intent'),
    canonicalIntentBundleHash: hash('canonical-intent-bundle'),
    specSpanRegistryHash: hash('spec-span-registry'),
    intentAuthorityAttestationHash: hash('intent-attestation'),
    subordinateCoverageReceiptHashes: [hash('subordinate-coverage')],
    goalContractSemanticHash: hash('parent-goal-semantics'),
    goalContractHash: parentGoalHash,
    methodologyProfileHash: hash('methodology'),
    executionProjectionHash: hash('execution-projection'),
    taskDagHash: hash('task-dag'),
    integrationJoinGraphHash: hash('integration-join-graph'),
    partitionPolicyHash,
    optimizerVersion: 'partition-optimizer/v1',
    selectedCandidateId: 'candidate-selected',
    sequenceMode: 'disabled',
    sequenceApplicability: 'not_applicable_with_proof',
    sequenceCoverage: 'excluded',
    sequenceClosureStatus: 'not_requested',
    childContractAuthority: 'core_only',
    namespaceOwnership: [
      {
        namespace: 'PRIMARY',
        sourceArtifactId: 'primary-plan',
        sourceRole: 'primary_implementation_authority',
        sourceSnapshotHash: hash('primary-source'),
        parentTaskRefs: [],
      },
      {
        namespace: 'SUB',
        sourceArtifactId: 'subordinate-component',
        sourceRole: 'subordinate_component_specification',
        sourceSnapshotHash: hash('subordinate-source'),
        parentTaskRefs: ['task-a'],
      },
    ],
    subordinateTaskMappings: [
      {
        namespace: 'SUB',
        sourceArtifactId: 'subordinate-component',
        parentTaskRefs: ['task-a'],
        declaredSourceIds: ['SUB-REQ-01'],
        coverageReceiptHash: hash('subordinate-coverage'),
        partitionId: partitionA.partitionId,
      },
    ],
    partitionCandidates: [
      {
        candidateId: 'candidate-selected',
        selected: true,
        partitionCount: 2,
        partitionIds: [partitionA.partitionId, partitionB.partitionId],
        score: 100,
      },
    ],
    topologicalOrder: [partitionA.partitionId, partitionB.partitionId],
    partitions: [partitionA, partitionB],
    selections: [selectionA, selectionB],
    coverageObligations: {
      sourceObligationIds: ['source-a', 'source-b'],
      traceSliceIds: ['slice-a', 'slice-b'],
      atomicTaskIds: ['task-a', 'task-b'],
      completionPredicateIds: ['acceptance-a', 'acceptance-b'],
      commandIds: [
        ...new Set(
          [partitionA, partitionB].flatMap(
            ({ commandIds }) => commandIds
          )
        ),
      ].sort(),
      evidenceContractIds: ['evidence-a', 'evidence-b'],
      subordinateDeclaredSourceIds: ['SUB-REQ-01'],
    },
    dependencyEdges: [
      {
        fromPartitionId: partitionA.partitionId,
        toPartitionId: partitionB.partitionId,
      },
    ],
    ownerConsumerRecords: [
      {
        artifactPath: 'src/shared.ts',
        ownerPartitionId: partitionA.partitionId,
        consumerPartitionIds: [partitionB.partitionId],
      },
    ],
    childProjectionInputs,
    partitionSetHash,
  };
  plan.partitionPlanHash = hashControlPlaneValue(plan);
  return plan;
}

function finalizationChildBytes(plan, projection, ordinal) {
  const obligationRefs = [
    ...projection.primarySourceObligationIds,
    ...projection.namespacedObligations.map(
      ({ declaredSourceId }) => declaredSourceId
    ),
  ].sort();
  return [
    '---',
    `sourceCompositionPolicyHash: ${plan.sourceCompositionPolicyHash}`,
    `partitionPlanHash: ${plan.partitionPlanHash}`,
    `goalContractHash: ${plan.goalContractHash}`,
    `partitionSetHash: ${plan.partitionSetHash}`,
    `selectionSetHash: ${projection.selectionHash}`,
    `orderedSourceSnapshotSetHash: ${plan.orderedSourceSnapshotSetHash}`,
    `sourceAuthorityBundleHash: ${plan.sourceAuthorityBundleHash}`,
    `subordinateCoverageReceiptHashes: ${JSON.stringify(
      projection.subordinateCoverageReceiptHashes
    )}`,
    `partitionId: ${projection.partitionId}`,
    `displayOrdinal: ${ordinal}`,
    `obligationRefs: ${JSON.stringify(obligationRefs)}`,
    `namespaceRefs: ${JSON.stringify(projection.namespaceRefs)}`,
    `sourceArtifactRefs: ${JSON.stringify(projection.sourceArtifactRefs)}`,
    `specSpanRefs: ${JSON.stringify(projection.specSpanRefs)}`,
    `governedPaths: ${JSON.stringify(projection.ownedArtifactPaths)}`,
    '---',
    '',
    `# Child ${ordinal}`,
    '',
  ].join('\n');
}

function finalizationChildren(plan) {
  return plan.childProjectionInputs.map((projection, index) =>
    createPendingChildCompilationReceipt({
      partitionPlan: plan,
      childProjectionInput: projection,
      displayOrdinal: index + 1,
      childContractPath: `children/p${index + 1}.md`,
      childContractBytes: finalizationChildBytes(
        plan,
        projection,
        index + 1
      ),
    })
  );
}

function resealPartitionPlan(plan) {
  const copy = structuredClone(plan);
  copy.selections = copy.selections.map((selection) => {
    const semantic = structuredClone(selection);
    delete semantic.selectionHash;
    return {
      ...semantic,
      selectionHash: hashControlPlaneValue(semantic),
    };
  });
  copy.partitionSetHash = hashControlPlaneValue(
    copy.selections.map(
      ({ partitionId, selectionHash, dependencyPartitionIds }) => ({
        partitionId,
        selectionHash,
        dependencyPartitionIds,
      })
    )
  );
  copy.childProjectionInputs = copy.childProjectionInputs.map(
    (projection, index) => ({
      ...structuredClone(copy.selections[index]),
      goalContractHash: projection.goalContractHash,
      orderedSourceSnapshotSetHash:
        projection.orderedSourceSnapshotSetHash,
      sourceAuthorityBundleHash: projection.sourceAuthorityBundleHash,
      partitionSetHash: copy.partitionSetHash,
    })
  );
  delete copy.partitionPlanHash;
  copy.partitionPlanHash = hashControlPlaneValue(copy);
  return copy;
}

function resealPendingChildReceipt(receipt) {
  const copy = structuredClone(receipt);
  copy.childContractHash = hash(
    Buffer.from(copy.childContractBytes, 'utf8')
  );
  const payload = structuredClone(copy);
  delete payload.receiptHash;
  delete payload.childContractBytes;
  copy.receiptHash = hash(stableStringify(payload));
  return copy;
}

describe('final child-hash-bound partition manifest', () => {
  it('projects every ordered child before freezing the final manifest', () => {
    const plan = finalizationPlan();
    const renderedPartitionIds = [];
    const projected = projectExecutionArtifacts({
      partitionPlan: plan,
      renderChildContract({
        childProjectionInput,
        displayOrdinal,
      }) {
        renderedPartitionIds.push(childProjectionInput.partitionId);
        return {
          childContractPath: `children/p${displayOrdinal}.md`,
          childContractBytes: finalizationChildBytes(
            plan,
            childProjectionInput,
            displayOrdinal
          ),
        };
      },
    });

    assert.deepEqual(
      renderedPartitionIds,
      plan.topologicalOrder
    );
    assert.deepEqual(
      projected.orderedChildContractHashes,
      projected.childCompilationReceipts.map(
        ({ childContractHash }) => childContractHash
      )
    );
    assert.equal(
      projected.partitionManifest.partitionPlanHash,
      plan.partitionPlanHash
    );
    assert.equal(
      projected.childMembershipReceipts.length,
      plan.topologicalOrder.length
    );
  });

  it('requires v2 root and child membership authority without breaking v1', () => {
    const validate = new Ajv2020({
      allErrors: true,
      strict: false,
    }).compile(PARTITION_MANIFEST_SCHEMA);
    const legacy = compilePartitionManifest(input()).manifest;
    assert.equal(validate(legacy), true, JSON.stringify(validate.errors));

    const plan = finalizationPlan();
    const finalized = finalizePartitionManifest({
      partitionPlan: plan,
      childCompilationReceipts: finalizationChildren(plan),
    });
    assert.equal(
      validate(finalized.manifest),
      true,
      JSON.stringify(validate.errors)
    );

    const missingRoot = structuredClone(finalized.manifest);
    delete missingRoot.namespaceOwnership;
    assert.equal(validate(missingRoot), false);

    const missingMembership = structuredClone(finalized.manifest);
    delete missingMembership.partitions[0].childMembershipHash;
    assert.equal(validate(missingMembership), false);
  });

  it('creates pending child receipts bound to the plan instead of a final manifest', () => {
    const plan = finalizationPlan();
    const [receipt] = finalizationChildren(plan);
    assert.equal(receipt.membershipStatus, 'pending');
    assert.equal(receipt.partitionPlanHash, plan.partitionPlanHash);
    assert.equal(receipt.sourceCompositionPolicyHash, plan.sourceCompositionPolicyHash);
    assert.equal(receipt.goalContractHash, plan.goalContractHash);
    assert.equal(receipt.partitionManifestHash, undefined);
    assert.equal(
      receipt.childContractHash,
      hash(Buffer.from(receipt.childContractBytes, 'utf8'))
    );
  });

  it('freezes one final manifest from all ordered current child bytes', () => {
    const plan = finalizationPlan();
    const children = finalizationChildren(plan);
    const finalized = finalizePartitionManifest({
      partitionPlan: plan,
      childCompilationReceipts: children,
    });
    const orderedChildContractHashes = children.map(
      ({ childContractHash }) => childContractHash
    );
    const expectedManifestHash = hashControlPlaneValue({
      goalContractHash: plan.goalContractHash,
      sourceCompositionPolicyHash: plan.sourceCompositionPolicyHash,
      sourceAuthorityBundleHash: plan.sourceAuthorityBundleHash,
      partitionPolicyHash: plan.partitionPolicyHash,
      partitionPlanHash: plan.partitionPlanHash,
      partitionSetHash: plan.partitionSetHash,
      orderedChildContractHashes,
    });
    assert.equal(finalized.partitionManifestHash, expectedManifestHash);
    assert.deepEqual(
      finalized.manifest.orderedChildContractHashes,
      orderedChildContractHashes
    );
    assert.equal(
      finalized.manifest.sourceCompositionPolicyHash,
      plan.sourceCompositionPolicyHash
    );
    assert.equal(finalized.manifest.partitionPlanHash, plan.partitionPlanHash);
    assert.equal(finalized.manifest.partitions[0].namespacedObligations.length, 1);
    assert.equal(finalized.manifest.partitions[0].specSpanRefs[0], 'span-subordinate');
    assert.equal(finalized.manifest.partitions[0].executionLeaseRequired, true);
    assert.equal(
      finalized.manifest.partitions[1].compatibilityReceiptRequirements.length,
      1
    );
    assert.equal(
      finalized.childMembershipReceipts.every(
        (receipt) =>
          receipt.membershipStatus === 'final' &&
          receipt.partitionManifestHash === expectedManifestHash
      ),
      true
    );
  });

  it('rejects incomplete, reordered, stale, tampered, or reduced child authority', () => {
    const plan = finalizationPlan();
    const children = finalizationChildren(plan);
    const cases = [
      {
        expected: 'partition_child_set_incomplete',
        children: children.slice(0, 1),
      },
      {
        expected: 'partition_child_order_mismatch',
        children: [...children].reverse(),
      },
      {
        expected: 'partition_child_set_duplicate',
        children: [children[0], children[0]],
      },
      {
        expected: 'partition_child_set_unknown',
        children: [
          children[0],
          {
            ...children[1],
            partitionId: `partition-${'3'.repeat(64)}`,
          },
        ],
      },
      {
        expected: 'partition_child_hash_mismatch',
        children: [
          {
            ...children[0],
            childContractBytes: `${children[0].childContractBytes}tampered`,
          },
          children[1],
        ],
      },
      {
        expected: 'partition_child_plan_stale',
        children: [
          {
            ...children[0],
            partitionPlanHash: hash('stale-plan'),
          },
          children[1],
        ],
      },
      {
        expected: 'partition_child_authority_mismatch',
        children: [
          {
            ...children[0],
            selectionHash: hash('wrong-selection'),
          },
          children[1],
        ],
      },
      {
        expected: 'partition_child_authority_mismatch',
        children: [
          {
            ...children[0],
            goalContractHash: hash('wrong-parent-goal'),
          },
          children[1],
        ],
      },
      {
        expected: 'partition_child_authority_mismatch',
        children: [
          {
            ...children[0],
            sourceCompositionPolicyHash: hash('wrong-policy'),
          },
          children[1],
        ],
      },
      {
        expected: 'partition_child_authority_mismatch',
        children: [
          {
            ...children[0],
            sourceAuthorityBundleHash: hash('wrong-source-authority'),
          },
          children[1],
        ],
      },
      {
        expected: 'partition_child_authority_mismatch',
        children: [
          {
            ...children[0],
            subordinateCoverageReceiptHashes: [],
          },
          children[1],
        ],
      },
      {
        expected: 'partition_child_authority_mismatch',
        children: [
          resealPendingChildReceipt({
            ...children[0],
            childContractBytes: children[0].childContractBytes.replace(
              /^sourceCompositionPolicyHash:.*\r?\n/mu,
              ''
            ),
          }),
          children[1],
        ],
      },
    ];
    for (const testCase of cases) {
      assert.throws(
        () =>
          finalizePartitionManifest({
            partitionPlan: plan,
            childCompilationReceipts: testCase.children,
          }),
        (error) => error.failureClass === testCase.expected
      );
    }
  });

  it('rejects future owners, missing dependency closure, and compatibility count drift', () => {
    const validPlan = finalizationPlan();
    const futureOwnerPlan = structuredClone(validPlan);
    futureOwnerPlan.ownerConsumerRecords[0] = {
      artifactPath: 'src/shared.ts',
      ownerPartitionId: futureOwnerPlan.topologicalOrder[1],
      consumerPartitionIds: [futureOwnerPlan.topologicalOrder[0]],
    };
    futureOwnerPlan.selections[1].ownedArtifactPaths.push(
      'src/shared.ts'
    );
    futureOwnerPlan.childProjectionInputs[1].ownedArtifactPaths.push(
      'src/shared.ts'
    );
    const missingDependencyPlan = structuredClone(validPlan);
    missingDependencyPlan.partitions[1].dependencyPartitionIds = [];
    missingDependencyPlan.selections[1].dependencyPartitionIds = [];
    missingDependencyPlan.childProjectionInputs[1].dependencyPartitionIds = [];
    missingDependencyPlan.dependencyEdges = [];
    for (const [plan, expected] of [
      [resealPartitionPlan(futureOwnerPlan), 'partition_owner_order_invalid'],
      [
        resealPartitionPlan(missingDependencyPlan),
        'partition_shared_predecessor_missing',
      ],
    ]) {
      assert.throws(
        () =>
          finalizePartitionManifest({
            partitionPlan: plan,
            childCompilationReceipts: finalizationChildren(plan),
          }),
        (error) => error.failureClass === expected
      );
    }

    const children = finalizationChildren(validPlan);
    children[1] = {
      ...children[1],
      compatibilityRequirementCount: 0,
    };
    assert.throws(
      () =>
        finalizePartitionManifest({
          partitionPlan: validPlan,
          childCompilationReceipts: children,
        }),
      (error) => error.failureClass === 'partition_compatibility_count_mismatch'
    );
  });

  it('requires current final manifest membership before releasing a child', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'final-membership-')
    );
    const plan = finalizationPlan();
    const children = finalizationChildren(plan);
    const finalized = finalizePartitionManifest({
      partitionPlan: plan,
      childCompilationReceipts: children,
    });
    const childPath = path.join(root, children[0].childContractPath);
    const manifestPath = path.join(root, 'partition-manifest.json');
    fs.mkdirSync(path.dirname(childPath), { recursive: true });
    fs.writeFileSync(childPath, children[0].childContractBytes, 'utf8');
    fs.writeFileSync(
      manifestPath,
      finalized.partitionManifestBytes,
      'utf8'
    );
    const binding = {
      partitionId: children[0].partitionId,
      partitionPlanHash: plan.partitionPlanHash,
      sourceCompositionPolicyHash: plan.sourceCompositionPolicyHash,
      goalContractHash: plan.goalContractHash,
      partitionSetHash: plan.partitionSetHash,
      selectionSetHash: plan.selections[0].selectionHash,
      orderedSourceSnapshotSetHash:
        plan.orderedSourceSnapshotSetHash,
      sourceAuthorityBundleHash: plan.sourceAuthorityBundleHash,
      subordinateCoverageReceiptHashes:
        finalized.manifest.partitions[0]
          .subordinateCoverageReceiptHashes,
      obligationRefs:
        finalized.manifest.partitions[0].obligationRefs,
      namespaceRefs:
        finalized.manifest.partitions[0].namespaceRefs,
      sourceArtifactRefs:
        finalized.manifest.partitions[0].sourceArtifactRefs,
      specSpanRefs:
        finalized.manifest.partitions[0].specSpanRefs,
      governedPaths:
        finalized.manifest.partitions[0].governedPaths,
      dependencyPartitionIds:
        finalized.manifest.partitions[0].dependencyPartitionIds,
    };
    const pass = validateFinalManifestChildMembership({
      goalPath: childPath,
      partitionManifestPath: manifestPath,
      binding,
      currentPartitionPlan: plan,
    });
    assert.equal(pass.decision, 'pass');
    assert.deepEqual(pass.blockingReasons, []);

    fs.appendFileSync(childPath, 'tampered', 'utf8');
    const childTamper = validateFinalManifestChildMembership({
      goalPath: childPath,
      partitionManifestPath: manifestPath,
      binding,
    });
    assert.equal(childTamper.decision, 'blocked');
    assert.ok(
      childTamper.blockingReasons.includes(
        'partition_child_goal_hash_mismatch'
      )
    );

    fs.writeFileSync(childPath, children[0].childContractBytes, 'utf8');
    const manifestTamper = structuredClone(finalized.manifest);
    manifestTamper.partitions[0].childContractHash = hash(
      'wrong-child'
    );
    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify(manifestTamper)}\n`,
      'utf8'
    );
    const membershipTamper =
      validateFinalManifestChildMembership({
        goalPath: childPath,
        partitionManifestPath: manifestPath,
        binding,
      });
    assert.equal(membershipTamper.decision, 'blocked');
    assert.ok(
      membershipTamper.blockingReasons.includes(
        'partition_child_membership_not_current'
      )
    );

    fs.writeFileSync(
      manifestPath,
      finalized.partitionManifestBytes,
      'utf8'
    );
    const childBindingTamper =
      validateFinalManifestChildMembership({
        goalPath: childPath,
        partitionManifestPath: manifestPath,
        binding: {
          ...binding,
          specSpanRefs: [],
        },
        currentPartitionPlan: plan,
      });
    assert.ok(
      childBindingTamper.blockingReasons.includes(
        'partition_child_membership_not_current'
      )
    );

    const namespaceTamper = structuredClone(finalized.manifest);
    namespaceTamper.namespaceOwnership = [];
    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify(namespaceTamper)}\n`,
      'utf8'
    );
    const authorityTamper =
      validateFinalManifestChildMembership({
        goalPath: childPath,
        partitionManifestPath: manifestPath,
        binding,
        currentPartitionPlan: plan,
      });
    assert.ok(
      authorityTamper.blockingReasons.includes(
        'partition_child_authority_mismatch'
      )
    );
  });

  it('routes plan-bound child release through final manifest membership', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'final-membership-release-')
    );
    const plan = finalizationPlan();
    const children = finalizationChildren(plan);
    const finalized = finalizePartitionManifest({
      partitionPlan: plan,
      childCompilationReceipts: children,
    });
    const childPath = path.join(root, children[0].childContractPath);
    const manifestPath = path.join(root, 'partition-manifest.json');
    const releaseReceipt = path.join(root, 'release.json');
    fs.mkdirSync(path.dirname(childPath), { recursive: true });
    fs.writeFileSync(childPath, children[0].childContractBytes, 'utf8');
    fs.writeFileSync(
      manifestPath,
      finalized.partitionManifestBytes,
      'utf8'
    );
    const binding = {
      mode: 'partition',
      fields: {
        partitionId: children[0].partitionId,
        partitionPlanHash: plan.partitionPlanHash,
        sourceCompositionPolicyHash:
          plan.sourceCompositionPolicyHash,
        goalContractHash: plan.goalContractHash,
        partitionSetHash: plan.partitionSetHash,
        selectionSetHash: plan.selections[0].selectionHash,
        orderedSourceSnapshotSetHash:
          plan.orderedSourceSnapshotSetHash,
        sourceAuthorityBundleHash:
          plan.sourceAuthorityBundleHash,
        subordinateCoverageReceiptHashes:
          finalized.manifest.partitions[0]
            .subordinateCoverageReceiptHashes,
        obligationRefs:
          finalized.manifest.partitions[0].obligationRefs,
        namespaceRefs:
          finalized.manifest.partitions[0].namespaceRefs,
        sourceArtifactRefs:
          finalized.manifest.partitions[0].sourceArtifactRefs,
        specSpanRefs:
          finalized.manifest.partitions[0].specSpanRefs,
        governedPaths:
          finalized.manifest.partitions[0].governedPaths,
        dependencyPartitionIds:
          finalized.manifest.partitions[0].dependencyPartitionIds,
        sequenceMode: plan.sequenceMode,
        sequenceApplicability: plan.sequenceApplicability,
        sequenceCoverage: plan.sequenceCoverage,
        sequenceClosureStatus: plan.sequenceClosureStatus,
        childContractAuthority: plan.childContractAuthority,
      },
    };
    const evaluate = (partitionManifest = manifestPath) =>
      evaluateGoalContractRelease({
        goal: childPath,
        partitionManifest,
        binding,
        partitionAuthority: null,
        releaseReceipt,
      });

    const current = evaluate();
    assert.equal(current.decision, 'blocked');
    assert.equal(
      current.blockingReasons.includes(
        'partition_final_manifest_required'
      ),
      false
    );
    assert.equal(
      current.blockingReasons.includes(
        'partition_manifest_binding_not_current'
      ),
      false
    );

    fs.appendFileSync(childPath, 'tampered', 'utf8');
    const childTamper = evaluate();
    assert.ok(
      childTamper.blockingReasons.includes(
        'partition_child_goal_hash_mismatch'
      )
    );

    fs.writeFileSync(childPath, children[0].childContractBytes, 'utf8');
    const missing = evaluate(path.join(root, 'missing-manifest.json'));
    assert.ok(
      missing.blockingReasons.includes(
        'partition_final_manifest_required'
      )
    );

    const legacyManifestPath = path.join(
      root,
      'legacy-partition-manifest.json'
    );
    fs.writeFileSync(
      legacyManifestPath,
      `${JSON.stringify({
        schemaVersion: 'goal-contract-partition-manifest/v1',
        partitions: [
          {
            partitionId: children[0].partitionId,
          },
        ],
      })}\n`,
      'utf8'
    );
    const legacy = evaluateGoalContractRelease({
      goal: childPath,
      partitionManifest: legacyManifestPath,
      binding: {
        mode: 'partition',
        fields: {
          partitionId: children[0].partitionId,
        },
      },
      partitionAuthority: null,
      releaseReceipt: path.join(root, 'legacy-release.json'),
    });
    assert.ok(
      legacy.blockingReasons.includes(
        'partition_final_manifest_required'
      )
    );
  });

  it('does not consume runtime dependency receipts during plan-bound pre-activation release', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'pre-activation-release-')
    );
    const plan = finalizationPlan();
    const children = finalizationChildren(plan);
    const finalized = finalizePartitionManifest({
      partitionPlan: plan,
      childCompilationReceipts: children,
    });
    const dependent = children[1];
    const childPath = path.join(root, dependent.childContractPath);
    const manifestPath = path.join(root, 'partition-manifest.json');
    fs.mkdirSync(path.dirname(childPath), { recursive: true });
    fs.writeFileSync(childPath, dependent.childContractBytes, 'utf8');
    fs.writeFileSync(
      manifestPath,
      finalized.partitionManifestBytes,
      'utf8'
    );

    const result = evaluateGoalContractRelease({
      goal: childPath,
      partitionManifest: manifestPath,
      partitionAuthority: null,
      releaseReceipt: path.join(root, 'release.json'),
    });

    assert.equal(result.componentDecisions.dependencies, 'not_applicable');
    assert.equal(result.componentDecisions.compatibility, 'not_applicable');
    assert.deepEqual(result.predecessorCompletionReceiptHashes, []);
    assert.deepEqual(result.compatibilityReceiptHashes, []);
    assert.equal(
      result.blockingReasons.includes(
        'partition_predecessor_completion_missing'
      ),
      false
    );
    assert.equal(
      result.blockingReasons.includes(
        'partition_compatibility_receipt_missing'
      ),
      false
    );
  });
});
