import { describe, expect, it } from 'vitest';
import { buildReviewerRolloutGate } from '../../scripts/reviewer-rollout-gate';
import { suggestRollback } from '../../packages/scoring/gate/rollback';

describe('reviewer rollout rollback proof', () => {
  it('blocks rollout until all required proofs are complete', () => {
    const gate = buildReviewerRolloutGate();
    expect(gate.status).toBe('blocked');
    expect(gate.cleanupAllowed).toBe(false);
    expect(gate.blockingProofs).toStrictEqual([
      'parity_proof',
      'consumer_install_proof',
      'rollback_proof',
      'codex_noop_proof',
    ]);
  });

  it('can transition to ready only when all rollout proofs are marked complete', () => {
    const gate = buildReviewerRolloutGate({
      completeProofs: [
        'parity_proof',
        'consumer_install_proof',
        'rollback_proof',
        'codex_noop_proof',
      ],
    });
    expect(gate.status).toBe('ready');
    expect(gate.cleanupAllowed).toBe(true);
    expect(gate.canClaimFullIsomorphism).toBe(true);
  });

  it('keeps rollback proof tied to a concrete rollback suggestion instead of a narrative-only promise', () => {
    const suggestion = suggestRollback('reviewer_rollout', 'abc123');
    expect(suggestion.action).toBe('suggest_rollback');
    expect(suggestion.commands).toEqual(['git stash', 'git reset --hard abc123']);
  });
});
