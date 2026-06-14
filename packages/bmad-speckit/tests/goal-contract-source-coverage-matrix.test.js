const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  buildSourceCoverageMatrix,
  validateSourceCoverage,
} = require('../src/utils/goal-contract/source-coverage-matrix');

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
});
