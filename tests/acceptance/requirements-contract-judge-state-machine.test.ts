import { describe, expect, it } from 'vitest';
import {
  applyRequirementsJudgeTransition,
  createRequirementsJudgeState,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-state-machine';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const h = (label: string) => sha256Stable({ label });

describe('requirements judge state machine', () => {
  it('accepts only declared legal transitions', () => {
    let state = createRequirementsJudgeState({
      attemptKeyHash: h('attempt'),
      authoritySnapshotHash: h('authority'),
    });

    state = applyRequirementsJudgeTransition(state, {
      transition: 'lease_issued',
      authoritySnapshotHash: h('authority'),
      receiptHash: h('lease'),
    });
    state = applyRequirementsJudgeTransition(state, {
      transition: 'assessment_recorded',
      authoritySnapshotHash: h('authority'),
      receiptHash: h('assessment'),
    });
    state = applyRequirementsJudgeTransition(state, {
      transition: 'remediation_recorded',
      authoritySnapshotHash: h('authority'),
      receiptHash: h('remediation'),
    });
    state = applyRequirementsJudgeTransition(state, {
      transition: 'effective_pass_recorded',
      authoritySnapshotHash: h('authority'),
      receiptHash: h('effective-pass'),
    });

    expect(state.status).toBe('effective_pass_recorded');
    expect(state.transitionReceipts).toHaveLength(4);
  });

  it('rejects undeclared transitions and stale authority snapshots', () => {
    const state = createRequirementsJudgeState({
      attemptKeyHash: h('attempt'),
      authoritySnapshotHash: h('authority'),
    });

    expect(() =>
      applyRequirementsJudgeTransition(state, {
        transition: 'effective_pass_recorded',
        authoritySnapshotHash: h('authority'),
        receiptHash: h('effective-pass'),
      })
    ).toThrow('requirements_judge_transition_undeclared');

    expect(() =>
      applyRequirementsJudgeTransition(state, {
        transition: 'lease_issued',
        authoritySnapshotHash: h('stale-authority'),
        receiptHash: h('lease'),
      })
    ).toThrow('requirements_judge_transition_stale_authority');
  });

  it('reuses committed provider result after crash and blocks unknown invocation outcome', () => {
    const leased = applyRequirementsJudgeTransition(
      createRequirementsJudgeState({
        attemptKeyHash: h('attempt'),
        authoritySnapshotHash: h('authority'),
        providerInvocationOutcome: 'committed',
        providerInvocationReceiptHash: h('provider'),
      }),
      {
        transition: 'lease_issued',
        authoritySnapshotHash: h('authority'),
        receiptHash: h('lease'),
      }
    );

    const recovered = applyRequirementsJudgeTransition(leased, {
      transition: 'assessment_recorded',
      authoritySnapshotHash: h('authority'),
      receiptHash: h('assessment'),
      recovery: true,
      providerInvocationReceiptHash: h('provider'),
    });
    expect(recovered.reusedProviderInvocationReceiptHash).toBe(h('provider'));

    const unknownLeased = applyRequirementsJudgeTransition(
      createRequirementsJudgeState({
        attemptKeyHash: h('attempt'),
        authoritySnapshotHash: h('authority'),
        providerInvocationOutcome: 'unknown',
      }),
      {
        transition: 'lease_issued',
        authoritySnapshotHash: h('authority'),
        receiptHash: h('lease'),
      }
    );

    expect(() =>
      applyRequirementsJudgeTransition(unknownLeased, {
        transition: 'assessment_recorded',
        authoritySnapshotHash: h('authority'),
        receiptHash: h('assessment'),
        recovery: true,
      })
    ).toThrow('requirements_judge_provider_invocation_unknown');
  });
});
