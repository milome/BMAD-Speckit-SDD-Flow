const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  deriveSequenceExecutionState,
  resolveSequenceMode,
} = require('../src/utils/goal-contract/sequence-mode.ts');

describe('goal-contract sequence mode', () => {
  it('defaults to auto and rejects unknown values', () => {
    assert.equal(resolveSequenceMode(undefined), 'auto');
    assert.equal(resolveSequenceMode('auto'), 'auto');
    assert.equal(resolveSequenceMode('required'), 'required');
    assert.equal(resolveSequenceMode('disabled'), 'disabled');
    assert.throws(
      () => resolveSequenceMode('skip'),
      (error) => error.failureClass === 'sequence_mode_invalid'
    );
  });

  it('derives the complete behavior matrix', () => {
    const cases = [
      ['auto', 'not_applicable_with_proof', false, 'not_applicable', 'not_required', 'full', false],
      ['auto', 'required', true, 'complete', 'compiled', 'full', true],
      ['auto', 'required', false, 'complete', 'unavailable', 'full', true],
      ['required', 'not_applicable_with_proof', true, 'complete', 'compiled', 'full', true],
      ['required', 'not_applicable_with_proof', false, 'complete', 'unavailable', 'full', true],
      ['required', 'required', true, 'complete', 'compiled', 'full', true],
      ['required', 'required', false, 'complete', 'unavailable', 'full', true],
      ['required', 'unresolved', false, 'complete', 'unavailable', 'full', true],
      ['disabled', 'not_applicable_with_proof', false, 'excluded', 'not_requested', 'core_only', false],
      ['disabled', 'required', false, 'excluded', 'not_requested', 'core_only', false],
      ['disabled', 'unresolved', false, 'excluded', 'not_requested', 'core_only', false],
    ];

    for (const [
      sequenceMode,
      sequenceApplicability,
      producerAvailable,
      sequenceCoverage,
      sequenceClosureStatus,
      childContractAuthority,
      shouldResolveProducer,
    ] of cases) {
      assert.deepEqual(
        deriveSequenceExecutionState({
          sequenceMode,
          sequenceApplicability,
          producerAvailable,
        }),
        {
          sequenceMode,
          sequenceApplicability,
          sequenceCoverage,
          sequenceClosureStatus,
          childContractAuthority,
          shouldResolveProducer,
        }
      );
    }
  });

  it('fails closed for unresolved auto mode', () => {
    assert.throws(
      () =>
        deriveSequenceExecutionState({
          sequenceMode: 'auto',
          sequenceApplicability: 'unresolved',
          producerAvailable: false,
        }),
      (error) => error.failureClass === 'sequence_applicability_unresolved'
    );
  });
});
