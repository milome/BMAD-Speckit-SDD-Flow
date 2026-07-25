const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  decideSequenceApplicability,
  validateSequenceConstraintInput,
} = require('../src/utils/goal-contract/sequence-applicability.ts');

const HASHES = {
  sourceSnapshotHash: `sha256:${'a'.repeat(64)}`,
  semanticModelHash: `sha256:${'b'.repeat(64)}`,
  traceGraphHash: `sha256:${'c'.repeat(64)}`,
};
const CURRENT_ROOTS = {
  currentSourceSnapshotHash: HASHES.sourceSnapshotHash,
  currentSemanticModelHash: HASHES.semanticModelHash,
  currentTraceGraphHash: HASHES.traceGraphHash,
  currentPolicyVersion: '1.0.0',
};
const REQUIRED_SIGNALS = {
  crossParticipantInteraction: false,
  interfaceBoundary: false,
  observableOrdering: false,
  stateTransition: false,
  branchCoverage: false,
  boundedRetry: false,
  compensation: false,
  temporalConstraint: false,
  integrationFanIn: false,
};

function decide(architectureFacts) {
  return decideSequenceApplicability({
    ...HASHES,
    architectureFacts,
    policyVersion: '1.0.0',
  });
}

function validate(input) {
  return validateSequenceConstraintInput({
    ...CURRENT_ROOTS,
    ...input,
  });
}

describe('goal-contract Sequence applicability', () => {
  it('derives the three applicability states from typed architecture facts', () => {
    const cases = [
      [{ crossParticipantInteraction: true }, 'required'],
      [{ interfaceBoundary: true }, 'required'],
      [{ boundedRetry: true }, 'required'],
      [{ integrationFanIn: true }, 'required'],
      [
        { ...REQUIRED_SIGNALS, evidenceRefs: ['SOURCE-SECTION-1'] },
        'not_applicable_with_proof',
      ],
      [{ crossParticipantInteraction: false }, 'unresolved'],
    ];

    for (const [architectureFacts, expected] of cases) {
      const receipt = decide(architectureFacts);
      assert.equal(receipt.decision, expected);
      assert.match(receipt.receiptHash, /^sha256:[0-9a-f]{64}$/u);
      assert.equal(Object.isFrozen(receipt), true);
    }
  });

  it('keeps receipt identity stable when required signal input order changes', () => {
    const first = decide({
      boundedRetry: true,
      interfaceBoundary: true,
    });
    const second = decide({
      interfaceBoundary: true,
      boundedRetry: true,
    });

    assert.deepEqual(first.reasonCodes, [
      'required:boundedRetry',
      'required:interfaceBoundary',
    ]);
    assert.equal(first.receiptHash, second.receiptHash);
  });

  it('fails closed when required constraints have no canonical producer', () => {
    const applicabilityReceipt = decide({ interfaceBoundary: true });

    assert.throws(
      () =>
        validate({
          applicabilityReceipt,
          producerAvailable: false,
          sequenceConstraintInput: null,
        }),
      (error) => error.failureClass === 'sequence_closure_required_unavailable'
    );
  });

  it('rejects stale hashes and a second task universe', () => {
    const applicabilityReceipt = decide({ interfaceBoundary: true });
    const validInput = {
      ...HASHES,
      sequenceContractHash: `sha256:${'d'.repeat(64)}`,
      sequenceClosureBundle: {
        interfaceConstraints: [],
      },
    };

    assert.throws(
      () =>
        validate({
          applicabilityReceipt,
          producerAvailable: true,
          sequenceConstraintInput: validInput,
          expectedSequenceContractHash: `sha256:${'e'.repeat(64)}`,
        }),
      (error) => error.failureClass === 'sequence_constraint_hash_mismatch'
    );

    for (const forbidden of ['atomicTasks', 'taskDag', 'partitionCount', 'partitions']) {
      assert.throws(
        () =>
          validate({
            applicabilityReceipt,
            producerAvailable: true,
            sequenceConstraintInput: {
              ...validInput,
              sequenceClosureBundle: { [forbidden]: [] },
            },
            expectedSequenceContractHash: validInput.sequenceContractHash,
          }),
        (error) => error.failureClass === 'sequence_second_task_universe_forbidden'
      );
    }
  });

  it('rejects a non-applicability decision without proof references', () => {
    const applicabilityReceipt = {
      ...decide({ ...REQUIRED_SIGNALS, evidenceRefs: ['SOURCE-SECTION-1'] }),
      evidenceRefs: [],
    };

    assert.throws(
      () =>
        validate({
          applicabilityReceipt,
          producerAvailable: false,
          sequenceConstraintInput: null,
        }),
      (error) => error.failureClass === 'sequence_non_applicability_proof_incomplete'
    );
  });

  it('rejects receipt mutations that retain the original self-hash', () => {
    const applicabilityReceipt = {
      ...decide({
        interfaceBoundary: true,
        evidenceRefs: ['SOURCE-SECTION-1'],
      }),
      decision: 'not_applicable_with_proof',
    };

    assert.throws(
      () =>
        validate({
          applicabilityReceipt,
          producerAvailable: false,
          sequenceConstraintInput: null,
        }),
      (error) =>
        error.failureClass === 'sequence_applicability_receipt_hash_mismatch'
    );
  });

  it('rejects self-consistent receipts that do not match the current roots', () => {
    const applicabilityReceipt = decide({ interfaceBoundary: true });
    const sequenceConstraintInput = {
      ...HASHES,
      sequenceContractHash: `sha256:${'d'.repeat(64)}`,
      sequenceClosureBundle: {
        interfaceConstraints: [],
      },
    };

    assert.throws(
      () =>
        validateSequenceConstraintInput({
          applicabilityReceipt,
          producerAvailable: true,
          sequenceConstraintInput,
          expectedSequenceContractHash:
            sequenceConstraintInput.sequenceContractHash,
          currentSourceSnapshotHash: `sha256:${'e'.repeat(64)}`,
          currentSemanticModelHash: `sha256:${'f'.repeat(64)}`,
          currentTraceGraphHash: `sha256:${'0'.repeat(64)}`,
          currentPolicyVersion: '2.0.0',
        }),
      (error) =>
        error.failureClass === 'sequence_applicability_receipt_root_mismatch' &&
        error.staleFields.join(',') ===
          'policyVersion,semanticModelHash,sourceSnapshotHash,traceGraphHash'
    );
  });

  it('rejects applicability receipts outside the strict schema shape', () => {
    const applicabilityReceipt = {
      ...decide({ interfaceBoundary: true }),
      partitionCount: 2,
    };

    assert.throws(
      () =>
        validate({
          applicabilityReceipt,
          producerAvailable: false,
          sequenceConstraintInput: null,
        }),
      (error) =>
        error.failureClass === 'sequence_applicability_receipt_schema_invalid'
    );
  });
});
