const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const { buildEvidenceGraph } = require('../src/utils/goal-contract/evidence-graph.ts');
const {
  projectAcceptanceTraceability,
  projectCompletionEvidence,
  projectManualScenarios,
  projectSourceCoverage,
  projectStopConditions,
  projectStrictAcceptance,
  projectTraceSlices,
} = require('../src/utils/goal-contract/evidence-projections.ts');
const {
  projectionIssueCodes,
  validateEvidenceGraph,
  validateExecutionProjection,
  validateGoalContractProjections,
} = require('../src/utils/goal-contract/projection-validator.ts');
const { buildProjectionSlotData } = require('../src/utils/goal-contract/slot-data-builder.ts');
const {
  renderGoalContract,
} = require('../../../_bmad/shared/goal-contract/scripts/render-goal-contract.js');

function hash(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function makeId(prefix, index) {
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

function makeGraph() {
  const sourceId = makeId('S', 1);
  const goalId = makeId('G', 1);
  const traceId = makeId('TRACE', 1);
  const acceptanceId = makeId('AC', 1);
  const evidenceId = makeId('EVD', 1);
  const manualId = makeId('MV', 1);
  const stopId = makeId('STOP', 1);
  const commandId = makeId('CMD', 1);
  const commandLiteral = `${JSON.stringify(process.execPath)} --version`;
  const sourceSnapshotHash = hash(Buffer.from('projection source', 'utf8'));
  const graphInput = {
    schemaVersion: 'goal-contract-reconciled-graph-input/v1',
    sourceSnapshotHash,
    sourceObligations: [{ id: sourceId, summary: 'Project one source.' }],
    tasks: [{ id: goalId, title: 'Project the graph.', sourceIds: [sourceId] }],
    traceSlices: [
      {
        id: traceId,
        goalIds: [goalId],
        sourceIds: [sourceId],
        acceptanceIds: [acceptanceId],
        evidenceIds: [evidenceId],
        productionSymbols: ['goalContractCommand'],
        allowedPaths: ['packages/example/source.ts'],
        directCommands: [commandId],
        impactedCommands: [commandId],
        dependencies: [],
        commitPolicy: 'exactly_one_atomic_commit',
        closeCondition: 'All projections preserve graph literals.',
        stopConditionIds: [stopId],
      },
    ],
    productionSymbols: ['goalContractCommand'],
    allowedPaths: ['packages/example/source.ts'],
    commands: {
      direct: [
        {
          id: commandId,
          literal: commandLiteral,
          expectedExitCode: 0,
          expectedExitBehavior: 'exits zero',
          productionEntryPoint: 'goalContractCommand',
          evidenceType: 'behavior',
          provenanceFields: ['argv', 'cwd', 'exitCode'],
          freshnessRule: 'current graph input',
        },
      ],
      impacted: [],
      integration: [],
      regression: [],
    },
    dependencies: [],
    commitPolicy: 'exactly_one_atomic_commit',
    closeConditions: ['All projections preserve graph literals.'],
    synchronizationObligations: ['package-source'],
    acceptanceItems: [
      {
        id: acceptanceId,
        statement: 'Every projection uses graph-owned literals.',
        sourceIds: [sourceId],
        goalIds: [goalId],
        traceIds: [traceId],
        requiredCommands: [commandId],
        expectedEvidenceIds: [evidenceId],
        requiredEvidenceStrength: 'behavior',
        passCondition: 'Shared literals are identical.',
      },
    ],
    negativeControls: ['Literal drift must fail closed.'],
    productionEntryPoints: ['goalContractCommand'],
    manualScenarios: [
      {
        id: manualId,
        title: 'Invoke the production entry.',
        steps: ['Run the graph-owned command literal.'],
        commandIds: [commandId],
        evidenceIds: [evidenceId],
        productionEntryPoints: ['goalContractCommand'],
        expectedResult: 'The command exits zero.',
      },
    ],
    expectedEvidence: [
      {
        id: evidenceId,
        producer: commandId,
        admissibleTypes: ['behavior'],
        requiredProvenanceFields: ['argv', 'cwd', 'exitCode'],
        freshnessRule: 'current graph input',
        expectedResult: 'The command exits zero.',
      },
    ],
    antiCheatRules: ['Projection output cannot create runtime PASS.'],
    stopConditions: [
      {
        id: stopId,
        condition: 'A graph-owned binding is missing.',
        failureClass: 'CONTRACT_BINDING_MISSING',
        sourceIds: [sourceId],
        traceIds: [traceId],
      },
    ],
  };
  return buildEvidenceGraph({
    graphInput,
    graphInputHash: hash(Buffer.from(JSON.stringify(graphInput), 'utf8')),
    metrics: { reconciliationCount: 1 },
  });
}

function projectionFunctions() {
  return [
    projectTraceSlices,
    projectStrictAcceptance,
    projectAcceptanceTraceability,
    projectSourceCoverage,
    projectManualScenarios,
    projectCompletionEvidence,
    projectStopConditions,
  ];
}

function makeProjections(graph) {
  return projectionFunctions().map((project) => project(graph));
}

describe('goal-contract evidence projections', () => {
  it('renders seven distinct semantic dimensions from one graph', () => {
    const graph = makeGraph();
    const projections = makeProjections(graph);
    const commandLiteral = graph.nodes.find((node) => node.nodeType === 'command').literal;

    assert.equal(projections.length, graph.projectionRegistry.length);
    assert.equal(
      new Set(projections.map((projection) => projection.projectionId)).size,
      graph.projectionRegistry.length
    );
    assert.equal(
      new Set(projections.map((projection) => projection.semanticRole)).size,
      graph.projectionRegistry.length
    );
    assert.ok(
      projections.every(
        (projection) =>
          projection.runtimeEvidenceAuthority === false && projection.markdown.trim().length > 0
      )
    );
    assert.ok(
      projections
        .filter((projection) => projection.sharedLiterals.commands.length > 0)
        .every((projection) => projection.sharedLiterals.commands.includes(commandLiteral))
    );
    assert.ok(
      projections.every(
        (projection) => !/\bObserved(?: Evidence)?:\s*PASS\b/u.test(projection.markdown)
      )
    );
  });

  it('renders all graph projection sections into the shared Markdown template', () => {
    const graph = makeGraph();
    const root = path.resolve(__dirname, '..', '..', '..');
    const templateText = fs.readFileSync(
      path.join(root, '_bmad', 'shared', 'goal-contract', 'goal-execution-contract-template.md'),
      'utf8'
    );
    const profile = JSON.parse(
      fs.readFileSync(
        path.join(root, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json'),
        'utf8'
      )
    );
    const projectionSlots = buildProjectionSlotData(graph);
    const slotData = Object.fromEntries(
      profile.requiredSlots.map((slotName) => [slotName, `${slotName} content`])
    );
    Object.assign(slotData, projectionSlots, {
      authorityModel: [
        'model_packet.json is the machine-readable execution authority',
        'goal_execution.md is not execution authority',
        '/goal completion is not closeout proof',
      ].join('\n'),
      frontMatter: [
        'sourcePlanHash: test',
        'coverageReceiptPath: test',
        'unmappedSourceObligations: 0',
      ].join('\n'),
    });

    const rendered = renderGoalContract({
      templateText,
      profile,
      slotData,
      validateHashes: true,
    });

    for (const projection of graph.projectionRegistry) {
      assert.match(rendered.document, new RegExp(`^## ${projection.sectionTitle}$`, 'mu'));
    }
    assert.equal(projectionSlots.projectionReceipt.requiredSectionCount, 7);
    assert.equal(projectionSlots.projectionReceipt.runtimeEvidenceAuthority, false);
  });

  it('validates a complete graph and seven independent projections', () => {
    const graph = makeGraph();
    const projections = makeProjections(graph);

    assert.deepEqual(validateEvidenceGraph(graph), {
      decision: 'pass',
      evidenceClassification: 'projection_only',
      runtimeEvidenceAuthority: false,
      issues: [],
    });
    assert.deepEqual(validateGoalContractProjections({ graph, projections }), {
      decision: 'pass',
      evidenceClassification: 'projection_only',
      runtimeEvidenceAuthority: false,
      issues: [],
    });
  });

  it('returns exact typed blockers for malformed graph and projection fixtures', () => {
    const graphCases = [
      {
        expected: projectionIssueCodes.sourceDuplicate,
        mutate(graph) {
          const edge = graph.edges.find((candidate) => candidate.edgeType === 'source_to_trace');
          graph.edges.push({ ...edge, id: `${edge.id}-duplicate` });
        },
      },
      {
        expected: projectionIssueCodes.sourceUnmapped,
        mutate(graph) {
          graph.edges = graph.edges.filter((edge) => edge.edgeType !== 'source_to_trace');
        },
      },
      {
        expected: projectionIssueCodes.evidenceUnclosed,
        mutate(graph) {
          graph.edges = graph.edges.filter((edge) => edge.edgeType !== 'acceptance_to_evidence');
        },
      },
      {
        expected: projectionIssueCodes.dependencyInvalid,
        mutate(graph) {
          const trace = graph.nodes.find((node) => node.nodeType === 'trace');
          trace.dependencies = [trace.id];
        },
      },
      {
        expected: projectionIssueCodes.allowedPathMissing,
        mutate(graph) {
          graph.edges = graph.edges.filter((edge) => edge.edgeType !== 'trace_to_path');
        },
      },
      {
        expected: projectionIssueCodes.commitPolicyInvalid,
        mutate(graph) {
          const trace = graph.nodes.find((node) => node.nodeType === 'trace');
          trace.commitPolicy = 'commit_when_convenient';
        },
      },
    ];

    for (const testCase of graphCases) {
      const graph = structuredClone(makeGraph());
      testCase.mutate(graph);
      const result = validateEvidenceGraph(graph);
      assert.equal(result.decision, 'block');
      assert.ok(
        result.issues.some((issue) => issue.code === testCase.expected),
        `${testCase.expected} was not emitted`
      );
    }

    const projectionCases = [
      {
        expected: projectionIssueCodes.columnMissing,
        mutate({ projections }) {
          const row = projections.find(
            (projection) => projection.projectionId === 'projection.trace_slices'
          ).rows[0];
          delete row.closeCondition;
        },
      },
      {
        expected: projectionIssueCodes.fieldEmpty,
        mutate({ projections }) {
          const row = projections.find(
            (projection) => projection.projectionId === 'projection.trace_slices'
          ).rows[0];
          row.allowedPathIds = [];
        },
      },
      {
        expected: projectionIssueCodes.acceptanceUndefined,
        mutate({ graph, projections }) {
          const row = projections.find(
            (projection) => projection.projectionId === 'projection.trace_slices'
          ).rows[0];
          row.acceptanceIds = [
            makeId('AC', graph.nodes.filter((node) => node.nodeType === 'acceptance').length + 1),
          ];
        },
      },
      {
        expected: projectionIssueCodes.commandUndefined,
        mutate({ graph, projections }) {
          const row = projections.find(
            (projection) => projection.projectionId === 'projection.trace_slices'
          ).rows[0];
          row.directCommands = [
            makeId('CMD', graph.nodes.filter((node) => node.nodeType === 'command').length + 1),
          ];
        },
      },
      {
        expected: projectionIssueCodes.rangeMismatch,
        mutate({ projections }) {
          const projection = projections.find(
            (candidate) => candidate.projectionId === 'projection.trace_slices'
          );
          projection.declaredRanges.trace.count += 1;
        },
      },
      {
        expected: projectionIssueCodes.literalDrift,
        mutate({ projections }) {
          const projection = projections.find(
            (candidate) => candidate.sharedLiterals.commands.length > 0
          );
          projection.sharedLiterals.commands[0] += ' --drift';
        },
      },
    ];

    for (const testCase of projectionCases) {
      const graph = structuredClone(makeGraph());
      const projections = structuredClone(makeProjections(graph));
      testCase.mutate({ graph, projections });
      const result = validateGoalContractProjections({ graph, projections });
      assert.equal(result.decision, 'block');
      assert.ok(
        result.issues.some((issue) => issue.code === testCase.expected),
        `${testCase.expected} was not emitted`
      );
    }
  });

  it('rejects a Task DAG node outside the execution projection task universe', () => {
    const projection = {
      atomicTasks: [{ taskId: 'task-one', ownerSliceId: 'slice-one' }],
      traceSlices: [
        {
          sliceId: 'slice-one',
          taskIds: ['task-one'],
          observableOutcome: 'One task completes.',
          completionPredicateIds: ['predicate-one'],
        },
      ],
      completionPredicates: [
        {
          predicateId: 'predicate-one',
          positive: true,
          evidenceContractIds: ['evidence-one'],
        },
      ],
      evidenceContracts: [
        {
          evidenceContractId: 'evidence-one',
          producerTaskIds: ['task-one'],
          freshnessRule: 'current source roots',
        },
      ],
      taskDag: {
        nodes: [{ taskId: 'task-one' }, { taskId: 'task-extra' }],
        edges: [],
      },
      integrationJoinGraph: { joins: [] },
    };

    const validation = validateExecutionProjection(projection);
    assert.equal(validation.decision, 'block');
    assert.ok(
      validation.issues.some(
        (issue) => issue.code === projectionIssueCodes.executionSecondTaskUniverse
      )
    );
  });

  it('rejects a helper-only Slice without source-authorized verification outcome', () => {
    const projection = {
      atomicTasks: [{ taskId: 'task-one', ownerSliceId: 'slice-one' }],
      traceSlices: [
        {
          sliceId: 'slice-one',
          sourceIds: [],
          taskIds: ['task-one'],
          observableOutcome: 'A helper check completes.',
          completionPredicateIds: ['predicate-one'],
          classification: 'helper_only',
          verificationOnly: true,
        },
      ],
      completionPredicates: [
        {
          predicateId: 'predicate-one',
          sliceId: 'slice-one',
          positive: true,
          evidenceContractIds: ['evidence-one'],
        },
      ],
      evidenceContracts: [
        {
          evidenceContractId: 'evidence-one',
          producerTaskIds: ['task-one'],
          freshnessRule: 'current source roots',
        },
      ],
      taskDag: {
        nodes: [
          {
            taskId: 'task-one',
            ownerSliceId: 'slice-one',
            topologicalIndex: 0,
          },
        ],
        edges: [],
      },
      integrationJoinGraph: { joins: [] },
    };

    const validation = validateExecutionProjection(projection);
    assert.equal(validation.decision, 'block');
    assert.ok(
      validation.issues.some(
        (issue) => issue.code === projectionIssueCodes.executionHelperOutcomeMissing
      )
    );
  });
});
