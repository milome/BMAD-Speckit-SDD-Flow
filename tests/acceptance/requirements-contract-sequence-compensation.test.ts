import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractSequenceTraceMatrix,
  validateRequirementsContractSequenceCompensation,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-trace-matrix';

const HASH = `sha256:${'b'.repeat(64)}`;

function matrix() {
  return createRequirementsContractSequenceTraceMatrix({
    requirementSetId: 'payments',
    sequenceContractHash: HASH,
    semanticModelHash: HASH,
    steps: [
      {
        stepId: 'STEP-WRITE',
        order: 1,
        participantRef: 'PARTICIPANT-LEDGER',
        critical: true,
        sideEffect: 'ledger_write',
      },
      {
        stepId: 'STEP-COMPENSATE',
        order: 2,
        participantRef: 'PARTICIPANT-LEDGER',
        critical: true,
        sideEffect: 'ledger_reversal',
        compensationForStepRef: 'STEP-WRITE',
      },
    ],
    bindings: [
      {
        stepId: 'STEP-WRITE',
        requirementRefs: ['MUST-FR-001'],
        scenarioRefs: ['SCN-001'],
        branchRefs: ['BR-FAIL'],
        targetRefs: ['TARGET-LEDGER'],
        symbolRefs: ['ledger.write'],
        taskRefs: ['TASK-WRITE'],
        redRefs: ['RED-WRITE'],
        oracleRefs: ['ORACLE-WRITE'],
        commandRefs: ['CMD-WRITE'],
        evidenceRefs: ['EVD-WRITE'],
        proofRefs: ['PROOF-WRITE'],
      },
      {
        stepId: 'STEP-COMPENSATE',
        requirementRefs: ['MUST-FR-001'],
        scenarioRefs: ['SCN-001'],
        branchRefs: ['BR-FAIL'],
        targetRefs: ['TARGET-LEDGER'],
        symbolRefs: ['ledger.reverse'],
        taskRefs: ['TASK-COMPENSATE'],
        redRefs: ['RED-COMPENSATE'],
        oracleRefs: ['ORACLE-COMPENSATE'],
        commandRefs: ['CMD-COMPENSATE'],
        evidenceRefs: ['EVD-COMPENSATE'],
        proofRefs: ['PROOF-COMPENSATE'],
      },
    ],
  });
}

describe('requirements contract Sequence compensation', () => {
  it('accepts exactly one post-failure compensation with positive and duplicate assertions', () => {
    expect(
      validateRequirementsContractSequenceCompensation({
        matrix: matrix(),
        failedStepId: 'STEP-WRITE',
        observedStepIds: ['STEP-WRITE', 'STEP-COMPENSATE'],
        compensationCounts: { 'STEP-COMPENSATE': 1 },
        positiveAssertionStepIds: ['STEP-COMPENSATE'],
        duplicateAbsenceAssertionStepIds: ['STEP-COMPENSATE'],
      })
    ).toEqual({ ok: true, issues: [] });
  });

  it('rejects missing, duplicate, early, and weakly asserted compensation', () => {
    const result = validateRequirementsContractSequenceCompensation({
      matrix: matrix(),
      failedStepId: 'STEP-WRITE',
      observedStepIds: ['STEP-COMPENSATE', 'STEP-WRITE'],
      compensationCounts: { 'STEP-COMPENSATE': 2 },
      positiveAssertionStepIds: [],
      duplicateAbsenceAssertionStepIds: [],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        'sequence_compensation_order_violation:STEP-COMPENSATE',
        'sequence_compensation_duplicate:STEP-COMPENSATE',
        'sequence_compensation_positive_assertion_missing:STEP-COMPENSATE',
        'sequence_compensation_duplicate_assertion_missing:STEP-COMPENSATE',
      ])
    );
  });
});
