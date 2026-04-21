import { describe, expect, it } from 'vitest';
import { REVIEWER_COMPATIBILITY_GUARDS } from '../../scripts/reviewer-contract';
import { buildReviewerContractProjection, buildReviewerRouteExplainability } from '../../scripts/reviewer-registry';

describe('reviewer codex noop guard', () => {
  it('keeps codex behind a no-op compatibility guard in reviewer contract outputs', () => {
    expect(REVIEWER_COMPATIBILITY_GUARDS).toStrictEqual({
      codexNoopRequired: true,
      codexBehaviorChangeAllowed: false,
    });
    const projection = buildReviewerContractProjection();
    const explainability = buildReviewerRouteExplainability();

    expect(Object.keys(projection)).not.toContain('codex');
    expect(Object.keys(explainability.hosts)).toStrictEqual(['cursor', 'claude']);
    expect(projection.compatibilityGuards.codexNoopRequired).toBe(true);
    expect(explainability.compatibilityGuards.codexBehaviorChangeAllowed).toBe(false);
  });
});
