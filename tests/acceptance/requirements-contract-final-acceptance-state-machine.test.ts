import { describe, expect, it } from 'vitest';
import { reduceRequirementsContractFinalAcceptanceState } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-final-acceptance-state-machine';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function ledger(overrides = {}) {
  return {
    campaignId: 'goal-campaign-001',
    closureHashes: [hash('closure-a'), hash('closure-b')],
    reviewerGateHash: hash('reviewer-gate'),
    finalJudgeValidationHash: hash('final-judge'),
    unresolvedIssueHashes: [],
    ...overrides,
  };
}

describe('requirements contract final acceptance state machine', () => {
  it.each(['clean', 'remediated'] as const)(
    'passes %s truth table only with complete current authority',
    (mode) => {
      const state = reduceRequirementsContractFinalAcceptanceState({
        mode,
        requiredClosureCount: 2,
        observedClosureCount: 2,
        ledger: ledger(),
        replayedAttempt: false,
        partialAuthority: false,
      });

      expect(state.mode).toBe(mode);
      expect(state.observedClosureCount).toBe(2);
      expect(state.decision).toBe('pass');
    }
  );

  it('fails closed for stale, unresolved, partial, replayed, and count-invalid states', () => {
    expect(() =>
      reduceRequirementsContractFinalAcceptanceState({
        mode: 'clean',
        requiredClosureCount: 2,
        observedClosureCount: 1,
        ledger: ledger(),
      })
    ).toThrow('final_acceptance_state_count_invalid');

    expect(() =>
      reduceRequirementsContractFinalAcceptanceState({
        mode: 'clean',
        requiredClosureCount: 2,
        observedClosureCount: 2,
        ledger: ledger({ unresolvedIssueHashes: [hash('issue')] }),
      })
    ).toThrow('final_acceptance_ledger_unresolved');

    expect(() =>
      reduceRequirementsContractFinalAcceptanceState({
        mode: 'clean',
        requiredClosureCount: 2,
        observedClosureCount: 2,
        ledger: ledger(),
        partialAuthority: true,
      })
    ).toThrow('final_acceptance_state_partial');

    expect(() =>
      reduceRequirementsContractFinalAcceptanceState({
        mode: 'clean',
        requiredClosureCount: 2,
        observedClosureCount: 2,
        ledger: ledger(),
        replayedAttempt: true,
      })
    ).toThrow('final_acceptance_state_replay');

    const current = reduceRequirementsContractFinalAcceptanceState({
      mode: 'clean',
      requiredClosureCount: 2,
      observedClosureCount: 2,
      ledger: ledger(),
    });
    expect(() =>
      reduceRequirementsContractFinalAcceptanceState({
        mode: 'clean',
        requiredClosureCount: 2,
        observedClosureCount: 2,
        ledger: ledger(),
        currentAuthorityHash: current.authorityStateHash,
      })
    ).not.toThrow();
    expect(() =>
      reduceRequirementsContractFinalAcceptanceState({
        mode: 'clean',
        requiredClosureCount: 2,
        observedClosureCount: 2,
        ledger: ledger(),
        currentAuthorityHash: hash('stale-authority'),
      })
    ).toThrow('final_acceptance_state_stale');
  });
});
