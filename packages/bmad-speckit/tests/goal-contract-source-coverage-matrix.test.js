const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  buildSourceCoverageMatrix,
  validateSourceCoverage,
} = require('../src/utils/goal-contract/source-coverage-matrix.ts');
const {
  buildEvidenceGraph,
} = require('../src/utils/goal-contract/evidence-graph.ts');

const baseObligation = {
  id: 'SRC001',
  kind: 'heading_execution_segment',
  sourcePlanPath: 'docs/plans/source.md',
  sourcePlanHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  lineStart: 1,
  lineEnd: 3,
  headingPath: ['Task 1'],
  textHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  summary: 'Task 1 requires a CLI.',
  required: true,
};

const registries = {
  tasks: ['G001'],
  acceptance: ['ACC001'],
  commands: ['CMD001'],
  evidence: ['EVD001'],
};

describe('goal-contract source coverage matrix', () => {
  it('fails when a source obligation has no goal task mapping', () => {
    const receipt = validateSourceCoverage({
      sourceObligations: [{ ...baseObligation, goalTaskRefs: [], acceptanceRefs: ['ACC001'], commandRefs: ['CMD001'] }],
      registries,
    });

    assert.equal(receipt.decision, 'blocked');
    assert.deepEqual(receipt.unmappedSourceObligations, ['SRC001']);
    assert.ok(receipt.blockingReasons.some((reason) => reason.includes('goalTaskRefs')));
  });

  it('fails when a source obligation has no acceptance mapping', () => {
    const receipt = validateSourceCoverage({
      sourceObligations: [{ ...baseObligation, goalTaskRefs: ['G001'], acceptanceRefs: [], commandRefs: ['CMD001'] }],
      registries,
    });

    assert.equal(receipt.decision, 'blocked');
    assert.deepEqual(receipt.unmappedSourceObligations, ['SRC001']);
    assert.ok(receipt.blockingReasons.some((reason) => reason.includes('acceptanceRefs')));
  });

  it('fails when a source obligation has no command mapping', () => {
    const receipt = validateSourceCoverage({
      sourceObligations: [{ ...baseObligation, goalTaskRefs: ['G001'], acceptanceRefs: ['ACC001'], commandRefs: [] }],
      registries,
    });

    assert.equal(receipt.decision, 'blocked');
    assert.deepEqual(receipt.unmappedSourceObligations, ['SRC001']);
    assert.ok(receipt.blockingReasons.some((reason) => reason.includes('commandRefs')));
  });

  it('builds a Markdown matrix and pass receipt when all refs resolve', () => {
    const sourceObligations = [
      {
        ...baseObligation,
        goalTaskRefs: ['G001'],
        acceptanceRefs: ['ACC001'],
        commandRefs: ['CMD001'],
        evidenceRefs: ['EVD001'],
      },
    ];
    const receipt = validateSourceCoverage({ sourceObligations, registries });
    const markdown = buildSourceCoverageMatrix({ sourceObligations });

    assert.equal(receipt.decision, 'pass');
    assert.deepEqual(receipt.unmappedSourceObligations, []);
    assert.equal(receipt.orphanGeneratedRefs.length, 0);
    assert.match(markdown, /\| SRC001 \| heading_execution_segment \| docs\/plans\/source\.md:1-3 \| G001 \| ACC001 \| CMD001 \| EVD001 \|/u);
  });

  it('classifies graph coverage as non-runtime evidence', () => {
    const command = {
      id: 'CMD001',
      literal: `${JSON.stringify(process.execPath)} --version`,
      expectedExitBehavior: 'exits zero',
      productionEntryPoint: process.execPath,
      evidenceType: 'behavior',
      provenanceFields: ['argv', 'cwd', 'exitCode'],
      freshnessRule: 'current graph input',
    };
    const graph = buildEvidenceGraph({
      metrics: { reconciliationCount: 1 },
      graphInputHash: baseObligation.sourcePlanHash,
      graphInput: {
        schemaVersion: 'goal-contract-reconciled-graph-input/v1',
        sourceSnapshotHash: baseObligation.sourcePlanHash,
        sourceObligations: [{ id: baseObligation.id }],
        tasks: [
          {
            id: registries.tasks[0],
            sourceIds: [baseObligation.id],
          },
        ],
        traceSlices: [
          {
            id: 'TRACE001',
            goalIds: [registries.tasks[0]],
            sourceIds: [baseObligation.id],
            acceptanceIds: [registries.acceptance[0]],
            evidenceIds: [registries.evidence[0]],
            productionSymbols: [process.execPath],
            allowedPaths: [baseObligation.sourcePlanPath],
            directCommands: [command.id],
            impactedCommands: [command.id],
            dependencies: [],
            commitPolicy: 'exactly_one_atomic_commit',
            closeCondition: 'Coverage is complete.',
            stopConditionIds: ['STOP001'],
          },
        ],
        productionSymbols: [process.execPath],
        allowedPaths: [baseObligation.sourcePlanPath],
        commands: {
          direct: [command],
          impacted: [],
          integration: [],
          regression: [],
        },
        acceptanceItems: [
          {
            id: registries.acceptance[0],
            sourceIds: [baseObligation.id],
            goalIds: [registries.tasks[0]],
            traceIds: ['TRACE001'],
            requiredCommands: [command.id],
            expectedEvidenceIds: [registries.evidence[0]],
          },
        ],
        manualScenarios: [
          {
            id: 'MV001',
            commandIds: [command.id],
            evidenceIds: [registries.evidence[0]],
            productionEntryPoints: [process.execPath],
          },
        ],
        expectedEvidence: [
          {
            id: registries.evidence[0],
            producer: command.id,
          },
        ],
        stopConditions: [
          {
            id: 'STOP001',
            sourceIds: [baseObligation.id],
            traceIds: ['TRACE001'],
          },
        ],
      },
    });

    const receipt = validateSourceCoverage({ graph });

    assert.equal(receipt.decision, 'pass');
    assert.equal(receipt.evidenceClassification, 'coverage_only');
    assert.equal(receipt.runtimeEvidenceAuthority, false);
    assert.deepEqual(receipt.unmappedSourceObligations, []);
  });
});
