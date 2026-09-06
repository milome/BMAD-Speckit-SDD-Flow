const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateSourceCoverage } = require('../src/utils/goal-contract/source-coverage-matrix.ts');

function input(role = 'boundary') {
  return { registries: { projectionMode: 'semantic', tasks: [], acceptance: [], commands: [], evidence: [] },
    sourceObligations: [{ id: 'NEG-1', sourcePlanHash: `sha256:${'1'.repeat(64)}`, executionRole: role,
      normativeStrength: 'must', polarity: 'forbidden', sourceBlockRefs: ['block-1'], clauseRefs: ['clause-1'],
      normativeClauses: [{ id: 'clause-1', polarity: 'forbidden' }], provenanceRefs: ['block-1', 'section-1'],
      conditions: [], applicability: { scope: 'source_scope', sourceRefs: ['block-1'],
        sourceScope: { kind: 'source_section', ownerId: null, ownerBlockRefs: ['section-1'] } },
      goalTaskRefs: [], acceptanceRefs: [], commandRefs: [], evidenceRefs: [] }] };
}

describe('typed source coverage preserves non-action authority', () => {
  it('accepts a source-backed boundary without inventing a task, command, or observed proof', () => {
    const result = validateSourceCoverage(input());
    assert.equal(result.decision, 'pass');
    assert.equal(result.runtimeEvidenceAuthority, false);
  });

  it('rejects a non-action row after its source clause is removed', () => {
    const value = input();
    value.sourceObligations[0].normativeClauses = [];
    assert.equal(validateSourceCoverage(value).decision, 'blocked');
  });

  it('rejects a condition that was marked satisfied without a controlled proof', () => {
    const value = input();
    value.sourceObligations[0].conditions = [{ text: 'Only after confirmation', state: 'satisfied', sourceRefs: ['block-1'] }];
    assert.equal(validateSourceCoverage(value).decision, 'blocked');
  });

  it('still rejects invented references even for a non-action role', () => {
    const value = input();
    value.sourceObligations[0].commandRefs = ['invented-command'];
    assert.equal(validateSourceCoverage(value).decision, 'blocked');
  });

  it('still requires actual task, acceptance, and command bindings for an action', () => {
    const value = input('action');
    value.sourceObligations[0].polarity = 'required';
    assert.equal(validateSourceCoverage(value).decision, 'blocked');
  });

  it('rejects source-scope widening through a dangling parent or missing typed role', () => {
    const value = input();
    value.sourceObligations[0].provenanceRefs = ['block-1'];
    assert.equal(validateSourceCoverage(value).decision, 'blocked');
    delete value.sourceObligations[0].executionRole;
    assert.equal(validateSourceCoverage(value).decision, 'blocked');
  });
});
