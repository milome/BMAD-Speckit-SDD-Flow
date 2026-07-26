const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  compileExecutionProjection,
} = require('../src/utils/goal-contract/execution-projection.ts');

const hash = (value) => `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
const ROOTS = Object.freeze({
  sourceSnapshotHash: hash('source'),
  sourceObligationGraphHash: hash('obligations'),
  methodologyProfileHash: hash('methodology'),
  semanticModelHash: hash('semantic'),
  traceGraphHash: hash('trace'),
});

function makeGraph() {
  const ids = ['alpha', 'beta', 'join'];
  return {
    schemaVersion: 'goal-contract-reconciled-graph-input/v2',
    sourceObligations: ['alpha', 'beta'].map((id) => ({
      id: `source-${id}`,
      applicabilityState: 'applicable',
      summary: `${id} source`,
    })),
    tasks: ids.map((id, index) => ({
      id: `task-${id}`,
      providerCandidateId: `candidate-${id}`,
      title: `${id} task`,
      sourceIds: [`source-${index === 1 ? 'beta' : 'alpha'}`],
      businessRuntimeOrder: ids.length - index,
    })),
    traceSlices: ids.map((id, index) => ({
      id: `slice-${id}`,
      goalIds: [`task-${id}`],
      sourceIds: index === 2 ? ['source-alpha', 'source-beta'] : [`source-${id}`],
      acceptanceIds: [`accept-${id}`],
      evidenceIds: [`evidence-${id}`],
      productionSymbols: [`entry-${id}`],
      allowedPaths: [`src/${id}.ts`],
      dependencies: [],
      closeCondition: `${id} is observable`,
    })),
    dependencies: [],
    acceptanceItems: ids.map((id, index) => ({
      id: `accept-${id}`,
      traceIds: [`slice-${id}`],
      goalIds: [`task-${id}`],
      sourceIds: index === 2 ? ['source-alpha', 'source-beta'] : [`source-${id}`],
      passCondition: `${id} passes`,
      expectedEvidenceIds: [`evidence-${id}`],
    })),
    expectedEvidence: ids.map((id) => ({
      id: `evidence-${id}`,
      producerTaskIds: [`task-${id}`],
      admissibleTypes: ['behavior'],
      freshnessRule: 'current source roots',
    })),
    productionEntryPoints: ids.map((id) => `entry-${id}`),
  };
}

function makeInput(overrides = {}) {
  return {
    ...ROOTS,
    reconciledGraph: makeGraph(),
    sequenceApplicabilityReceipt: {
      decision: 'not_applicable_with_proof',
      receiptHash: hash('applicability'),
    },
    sequenceConstraintInput: null,
    ...overrides,
  };
}

function requiredSequenceInput() {
  return {
    ...ROOTS,
    sequenceContractHash: hash('sequence-contract'),
    sequenceClosureBundle: {
      integrationJoins: [
        {
          joinId: 'join-fan-in',
          inputTaskIds: ['task-alpha', 'task-beta'],
          ownerTaskId: 'task-join',
          interfaceId: 'frozen-interface',
        },
      ],
      branchConstraints: [{ constraintId: 'branch-alpha', taskIds: ['task-alpha'] }],
      retryConstraints: [
        { constraintId: 'retry-alpha', taskIds: ['task-alpha'], maximumAttempts: 3 },
      ],
      compensationConstraints: [{ constraintId: 'compensate-join', taskIds: ['task-join'] }],
    },
  };
}

describe('goal-contract Execution Projection', () => {
  it('compiles one deterministic task universe with complete source coverage', () => {
    const projection = compileExecutionProjection(makeInput());
    assert.equal(projection.schemaVersion, 'goal-contract-execution-projection/v1');
    for (const field of ['executionProjectionHash', 'taskDagHash', 'integrationJoinGraphHash']) {
      assert.match(projection[field], /^sha256:[0-9a-f]{64}$/u);
    }
    assert.deepEqual(
      projection.atomicTasks.map((task) => task.taskId),
      ['task-alpha', 'task-beta', 'task-join']
    );
    assert.deepEqual(
      projection.traceSlices.map((slice) => slice.sliceId),
      ['slice-alpha', 'slice-beta', 'slice-join']
    );
    assert.equal(
      new Set(projection.taskDag.nodes.map((node) => node.taskId)).size,
      projection.atomicTasks.length
    );
    for (const sourceId of ['source-alpha', 'source-beta']) {
      assert.ok(projection.traceSlices.some((slice) => slice.sourceIds.includes(sourceId)));
      assert.ok(projection.completionPredicates.some((item) => item.sourceIds.includes(sourceId)));
    }
  });

  it('ignores provider-local IDs and business runtime order as task dependencies', () => {
    const projection = compileExecutionProjection(makeInput());
    assert.equal(JSON.stringify(projection).includes('candidate-alpha'), false);
    assert.deepEqual(projection.taskDag.edges, []);
  });

  it('keeps parallel consumers and binds fan-in plus branch, retry and compensation closure', () => {
    const sequenceConstraintInput = requiredSequenceInput();
    const projection = compileExecutionProjection(
      makeInput({
        sequenceApplicabilityReceipt: { decision: 'required', receiptHash: hash('required') },
        sequenceConstraintInput,
      })
    );
    assert.deepEqual(
      projection.taskDag.edges.map((edge) => `${edge.fromTaskId}->${edge.toTaskId}`),
      ['task-alpha->task-join', 'task-beta->task-join']
    );
    assert.equal(projection.integrationJoinGraph.joins[0].joinId, 'join-fan-in');
    assert.deepEqual(
      projection.traceSlices.find((slice) => slice.sliceId === 'slice-alpha').sequenceConstraintIds,
      ['branch-alpha', 'retry-alpha']
    );
    const changed = structuredClone(sequenceConstraintInput);
    changed.sequenceClosureBundle.integrationJoins[0].interfaceId = 'changed-interface';
    assert.notEqual(
      compileExecutionProjection(
        makeInput({
          sequenceApplicabilityReceipt: { decision: 'required', receiptHash: hash('required') },
          sequenceConstraintInput: changed,
        })
      ).integrationJoinGraphHash,
      projection.integrationJoinGraphHash
    );
  });

  it('fails closed for unknown dependencies, cycles and unresolved ownership', () => {
    const cases = [
      [
        'execution_projection_dependency_unknown',
        (graph) => {
          graph.tasks[0].dependencies = ['task-missing'];
        },
      ],
      [
        'execution_projection_task_cycle',
        (graph) => {
          graph.tasks[0].dependencies = ['task-beta'];
          graph.tasks[1].dependencies = ['task-alpha'];
        },
      ],
      [
        'execution_projection_task_ownership_unresolved',
        (graph) => {
          graph.traceSlices[1].goalIds.push('task-alpha');
        },
      ],
    ];
    for (const [failureClass, mutate] of cases) {
      const input = makeInput();
      mutate(input.reconciledGraph);
      assert.throws(
        () => compileExecutionProjection(input),
        (error) => error.failureClass === failureClass
      );
    }
  });

  it('excludes diagrams and provenance-only assets while semantic roots change identity', () => {
    const baseline = compileExecutionProjection(makeInput());
    const decorated = makeInput({ methodologyProfileArtifactHash: hash('artifact') });
    decorated.reconciledGraph.mermaid = 'graph TD; A-->B';
    decorated.reconciledGraph.layout = { rank: 2 };
    assert.equal(
      compileExecutionProjection(decorated).executionProjectionHash,
      baseline.executionProjectionHash
    );
    assert.notEqual(
      compileExecutionProjection(
        makeInput({
          methodologyProfileHash: hash('changed-rule'),
        })
      ).executionProjectionHash,
      baseline.executionProjectionHash
    );
  });

  it('publishes a generic schema without bootstrap-local identities', () => {
    const schemaText = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../_bmad/shared/goal-contract/goal-contract-execution-projection.schema.json'
      ),
      'utf8'
    );
    assert.doesNotMatch(schemaText, /\b(?:P0[1-5]|C00|J0[1-6])\b/u);
    const schema = JSON.parse(schemaText);
    assert.equal(schema.additionalProperties, false);
    assert.ok(
      ['executionEpics', 'traceSlices', 'atomicTasks', 'taskDag'].every((field) =>
        schema.required.includes(field)
      )
    );
  });
});
