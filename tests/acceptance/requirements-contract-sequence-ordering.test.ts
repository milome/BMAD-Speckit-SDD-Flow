import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractSequenceTraceMatrix,
  validateRequirementsContractSequenceOrdering,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-sequence-trace-matrix';

const HASH = `sha256:${'a'.repeat(64)}`;

function matrix() {
  return createRequirementsContractSequenceTraceMatrix({
    requirementSetId: 'payments',
    sequenceContractHash: HASH,
    semanticModelHash: HASH,
    steps: [
      {
        stepId: 'STEP-001',
        order: 1,
        participantRef: 'PARTICIPANT-API',
        critical: true,
        sideEffect: 'none',
      },
      {
        stepId: 'STEP-002',
        order: 2,
        participantRef: 'PARTICIPANT-LEDGER',
        critical: true,
        sideEffect: 'ledger_write',
      },
    ],
    bindings: [
      {
        stepId: 'STEP-001',
        requirementRefs: ['MUST-FR-001'],
        scenarioRefs: ['SCN-001'],
        branchRefs: ['BR-001'],
        targetRefs: ['TARGET-API'],
        symbolRefs: ['payments.authorize'],
        taskRefs: ['TASK-API'],
        redRefs: ['RED-API'],
        oracleRefs: ['ORACLE-API'],
        commandRefs: ['CMD-API'],
        evidenceRefs: ['EVD-API'],
        proofRefs: ['PROOF-API'],
      },
      {
        stepId: 'STEP-002',
        requirementRefs: ['MUST-FR-001'],
        scenarioRefs: ['SCN-001'],
        branchRefs: ['BR-001'],
        targetRefs: ['TARGET-LEDGER'],
        symbolRefs: ['ledger.write'],
        taskRefs: ['TASK-LEDGER'],
        redRefs: ['RED-LEDGER'],
        oracleRefs: ['ORACLE-LEDGER'],
        commandRefs: ['CMD-LEDGER'],
        evidenceRefs: ['EVD-LEDGER'],
        proofRefs: ['PROOF-LEDGER'],
      },
    ],
  });
}

describe('requirements contract Sequence ordering', () => {
  it('accepts observed order, temporal window, and idempotent side effects', () => {
    expect(
      validateRequirementsContractSequenceOrdering({
        matrix: matrix(),
        observedStepIds: ['STEP-001', 'STEP-002'],
        constraints: [
          {
            beforeStepId: 'STEP-001',
            afterStepId: 'STEP-002',
            maximumDelayMs: 1000,
            observedDelayMs: 250,
          },
        ],
        sideEffectCounts: { 'STEP-002': 1 },
      })
    ).toEqual({ ok: true, issues: [] });
  });

  it('rejects reversed order, early success, temporal breach, and duplicate side effects', () => {
    const result = validateRequirementsContractSequenceOrdering({
      matrix: matrix(),
      observedStepIds: ['STEP-002', 'STEP-001'],
      constraints: [
        {
          beforeStepId: 'STEP-001',
          afterStepId: 'STEP-002',
          maximumDelayMs: 1000,
          observedDelayMs: 1500,
        },
      ],
      sideEffectCounts: { 'STEP-002': 2 },
      successObservedAfterStepId: 'STEP-001',
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        'sequence_order_violation:STEP-001:STEP-002',
        'sequence_temporal_violation:STEP-001:STEP-002',
        'sequence_duplicate_side_effect:STEP-002',
        'sequence_early_success:STEP-001',
      ])
    );
  });
});
