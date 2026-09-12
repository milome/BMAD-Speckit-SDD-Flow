const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const SOURCE = path.resolve(
  __dirname,
  '../src/utils/goal-contract/control-plane/standalone-goal-internal-semantic-gate.ts'
);

describe('standalone Goal internal semantic gate contract', () => {
  it('does not reject source-authorized relations through an arbitrary edge budget', () => {
    const source = fs.readFileSync(SOURCE, 'utf8');

    assert.doesNotMatch(source, /\bedgeBudget\b/u);
    assert.doesNotMatch(source, /semantic_relation_edge_budget_exceeded/u);
  });
});
