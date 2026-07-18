const { createHash } = require('node:crypto');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  buildEvidenceGraph,
} = require('../src/utils/goal-contract/evidence-graph.ts');

function hash(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function makeId(prefix, index) {
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

function makeReconciliation() {
  const ids = {
    source: makeId('S', 1),
    goal: makeId('G', 1),
    trace: makeId('TRACE', 1),
    acceptance: makeId('AC', 1),
    evidence: makeId('EVD', 1),
    manual: makeId('MV', 1),
    stop: makeId('STOP', 1),
  };
  const commandKinds = ['direct', 'impacted', 'integration', 'regression'];
  const commands = Object.fromEntries(
    commandKinds.map((kind, index) => {
      const commandId = makeId('CMD', index + 1);
      return [
        kind,
        [
          {
            id: commandId,
            literal: `${JSON.stringify(process.execPath)} --version`,
            expectedExitCode: 0,
            expectedExitBehavior: 'exits zero',
            productionEntryPoint: process.execPath,
            evidenceType: 'behavior',
            provenanceFields: ['argv', 'cwd', 'exitCode'],
            freshnessRule: 'current graph input',
          },
        ],
      ];
    })
  );
  const commandIds = Object.values(commands).flat().map((command) => command.id);
  const symbol = 'goalContractCommand';
  const allowedPath = 'packages/example/source.ts';
  const sourceSnapshotHash = hash(Buffer.from('canonical source snapshot', 'utf8'));
  const graphInput = {
    schemaVersion: 'goal-contract-reconciled-graph-input/v1',
    sourceSnapshotHash,
    sourceObligations: [
      {
        id: ids.source,
        summary: 'Preserve the generated source obligation.',
      },
    ],
    tasks: [
      {
        id: ids.goal,
        title: 'Build one evidence graph.',
        sourceIds: [ids.source],
      },
    ],
    traceSlices: [
      {
        id: ids.trace,
        goalIds: [ids.goal],
        sourceIds: [ids.source],
        acceptanceIds: [ids.acceptance],
        evidenceIds: [ids.evidence],
        productionSymbols: [symbol],
        allowedPaths: [allowedPath],
        directCommands: commands.direct.map((command) => command.id),
        impactedCommands: commands.impacted.map((command) => command.id),
        dependencies: [],
        commitPolicy: 'exactly_one_atomic_commit',
        closeCondition: 'All graph-owned bindings remain exact.',
        stopConditionIds: [ids.stop],
      },
    ],
    productionSymbols: [symbol],
    allowedPaths: [allowedPath],
    commands,
    dependencies: [],
    commitPolicy: 'exactly_one_atomic_commit',
    closeConditions: ['All graph-owned bindings remain exact.'],
    synchronizationObligations: ['package-source'],
    acceptanceItems: [
      {
        id: ids.acceptance,
        statement: 'The graph preserves every source binding.',
        sourceIds: [ids.source],
        goalIds: [ids.goal],
        traceIds: [ids.trace],
        requiredCommands: commandIds,
        expectedEvidenceIds: [ids.evidence],
        requiredEvidenceStrength: 'behavior',
        passCondition: 'Every required edge resolves.',
      },
    ],
    negativeControls: ['A missing edge must fail closed.'],
    productionEntryPoints: [symbol],
    manualScenarios: [
      {
        id: ids.manual,
        title: 'Run the real entry.',
        steps: ['Invoke the production command.'],
        commandIds: [commands.direct[0].id],
        evidenceIds: [ids.evidence],
        productionEntryPoints: [symbol],
        expectedResult: 'The command exits zero.',
      },
    ],
    expectedEvidence: [
      {
        id: ids.evidence,
        producer: commands.direct[0].id,
        admissibleTypes: ['behavior'],
        requiredProvenanceFields: ['argv', 'cwd', 'exitCode'],
        freshnessRule: 'current graph input',
        expectedResult: 'The command exits zero.',
      },
    ],
    antiCheatRules: ['Generated prose cannot close runtime evidence.'],
    stopConditions: [
      {
        id: ids.stop,
        condition: 'A required capability is unavailable.',
        failureClass: 'BLOCKED_ENVIRONMENT',
        sourceIds: [ids.source],
        traceIds: [ids.trace],
      },
    ],
  };
  return {
    graphInput,
    graphInputHash: hash(Buffer.from(JSON.stringify(graphInput), 'utf8')),
    metrics: { reconciliationCount: 1 },
  };
}

describe('goal-contract canonical evidence graph', () => {
  it('derives complete graph-owned nodes, edges, literals, and projection metadata', () => {
    const reconciliation = makeReconciliation();
    const graph = buildEvidenceGraph(reconciliation);
    const input = reconciliation.graphInput;
    const sourceId = input.sourceObligations[0].id;
    const commandInput = input.commands.direct[0];
    const commandNode = graph.nodes.find(
      (node) => node.nodeType === 'command' && node.id === commandInput.id
    );
    const sourceEdgeTypes = new Set(
      graph.edges
        .filter((edge) => edge.from === sourceId)
        .map((edge) => edge.edgeType)
    );

    assert.deepEqual(
      [...new Set(graph.nodes.map((node) => node.nodeType))].sort(),
      [
        'acceptance',
        'command',
        'evidence',
        'goal',
        'manualScenario',
        'path',
        'source',
        'stopCondition',
        'symbol',
        'trace',
      ]
    );
    assert.deepEqual(
      [...sourceEdgeTypes].sort(),
      [
        'source_to_acceptance',
        'source_to_command',
        'source_to_evidence',
        'source_to_goal',
        'source_to_stop',
        'source_to_trace',
      ]
    );
    assert.equal(commandNode.literal, commandInput.literal);
    assert.equal(commandNode.expectedExitBehavior, commandInput.expectedExitBehavior);
    assert.equal(commandNode.productionEntryPoint, commandInput.productionEntryPoint);
    assert.deepEqual(commandNode.provenanceFields, commandInput.provenanceFields);
    assert.equal(commandNode.freshnessRule, commandInput.freshnessRule);
    assert.equal(graph.projectionRegistry.length, 7);
    assert.ok(
      graph.nodes.every(
        (node) =>
          node.projectionIds.length > 0 &&
          node.projectionIds.every((projectionId) =>
            graph.projectionRegistry.some(
              (projection) => projection.id === projectionId
            )
          )
      )
    );
    assert.equal(graph.runtimeEvidencePolicy, 'runtime_only');
    assert.equal(Object.hasOwn(graph, 'observedEvidence'), false);
    assert.match(graph.graphHash, /^sha256:[0-9a-f]{64}$/u);
  });

  it('produces the same canonical graph for equivalent input ordering', () => {
    const first = makeReconciliation();
    const second = structuredClone(first);
    second.graphInput.tasks.reverse();
    second.graphInput.traceSlices.reverse();
    second.graphInput.acceptanceItems.reverse();
    for (const commands of Object.values(second.graphInput.commands)) {
      commands.reverse();
    }

    assert.deepEqual(
      buildEvidenceGraph(first),
      buildEvidenceGraph(second)
    );
  });
});
