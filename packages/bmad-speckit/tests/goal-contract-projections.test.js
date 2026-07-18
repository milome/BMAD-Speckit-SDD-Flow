const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  buildEvidenceGraph,
} = require('../src/utils/goal-contract/evidence-graph.ts');
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
  buildProjectionSlotData,
} = require('../src/utils/goal-contract/slot-data-builder.ts');
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

describe('goal-contract evidence projections', () => {
  it('renders seven distinct semantic dimensions from one graph', () => {
    const graph = makeGraph();
    const projections = projectionFunctions().map((project) => project(graph));
    const commandLiteral = graph.nodes.find(
      (node) => node.nodeType === 'command'
    ).literal;

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
          projection.runtimeEvidenceAuthority === false &&
          projection.markdown.trim().length > 0
      )
    );
    assert.ok(
      projections
        .filter((projection) => projection.sharedLiterals.commands.length > 0)
        .every((projection) =>
          projection.sharedLiterals.commands.includes(commandLiteral)
        )
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
      path.join(
        root,
        '_bmad',
        'shared',
        'goal-contract',
        'goal-execution-contract-template.md'
      ),
      'utf8'
    );
    const profile = JSON.parse(
      fs.readFileSync(
        path.join(
          root,
          '_bmad',
          'shared',
          'goal-contract',
          'goal-contract-profile.json'
        ),
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
      assert.match(
        rendered.document,
        new RegExp(`^## ${projection.sectionTitle}$`, 'mu')
      );
    }
    assert.equal(projectionSlots.projectionReceipt.requiredSectionCount, 7);
    assert.equal(projectionSlots.projectionReceipt.runtimeEvidenceAuthority, false);
  });
});
