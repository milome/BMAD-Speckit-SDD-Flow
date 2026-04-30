import { describe, expect, it } from 'vitest';
import { REVIEWER_COMPATIBILITY_GUARDS } from '../../scripts/reviewer-contract';
import { buildReviewerContractProjection, buildReviewerRouteExplainability } from '../../scripts/reviewer-registry';

describe('reviewer codex parity guard', () => {
  it('exposes codex as a real reviewer host instead of a no-op compatibility guard', () => {
    expect(REVIEWER_COMPATIBILITY_GUARDS).toStrictEqual({
      codexNoopRequired: false,
      codexBehaviorChangeAllowed: true,
    });
    const projection = buildReviewerContractProjection();
    const explainability = buildReviewerRouteExplainability();

    expect(Object.keys(explainability.hosts)).toStrictEqual(['cursor', 'claude', 'codex']);
    expect(explainability.hosts.codex.preferredRoute).toStrictEqual({
      tool: 'codex',
      subtypeOrExecutor: 'worker:audit',
    });
    expect(projection.compatibilityGuards.codexNoopRequired).toBe(false);
    expect(explainability.compatibilityGuards.codexBehaviorChangeAllowed).toBe(true);
    expect(explainability.requiredRolloutProofs).toEqual(
      expect.arrayContaining(['codex_parity_proof', 'codex_closeout_proof', 'codex_scoring_proof'])
    );
  });
});
