import { describe, expect, it } from 'vitest';
import { buildReviewerRouteExplainability as buildScriptRoute } from '../../scripts/reviewer-registry';
import { buildReviewerRouteExplainability as buildDashboardRoute } from '../../packages/scoring/dashboard/reviewer-projection';

describe('reviewer projection parity', () => {
  it('keeps dashboard Codex rollout truth no more optimistic than registry truth', () => {
    const script = buildScriptRoute({ requestedSkillId: 'code-reviewer', auditEntryStage: 'implement' });
    const dashboard = buildDashboardRoute({ requestedSkillId: 'code-reviewer', auditEntryStage: 'implement' });

    expect(dashboard.remainingBlocker).toBe(script.remainingBlocker);
    expect(dashboard.rolloutGate.status).toBe(script.rolloutGate.status);
    expect(dashboard.rolloutGate.canClaimFullIsomorphism).toBe(
      script.rolloutGate.canClaimFullIsomorphism
    );
    expect(dashboard.rolloutGate.blockingProofs).toEqual(script.rolloutGate.blockingProofs);
    expect(dashboard.requiredRolloutProofs).toEqual(script.requiredRolloutProofs);
  });
});
