import { describe, expect, it } from 'vitest';
import {
  evaluateAuditTriadConvergence,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/audit-triad-orchestrator';
import {
  resolveCriticalAuditorProfile,
  stageProfileForCallPoint,
  validateCriticalAuditorProfileForStage,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/critical-auditor-profile';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';
import {
  createFixtureAuditTriadPlan,
  createFixtureAuditTriadRound,
} from '../helpers/audit-triad-fixture-runtime';

describe('Main Agent CriticalAuditorProfile consumption', () => {
  it('blocks stale stage profile hashes and binds triad convergence to current check item hash', () => {
    const fixture = materializeRequirementFixture();
    try {
      const profile = resolveCriticalAuditorProfile(fixture.root);
      const stageProfileId = stageProfileForCallPoint('audit_review');
      expect(stageProfileId).toBe('post_implementation_code_audit');
      const stale = validateCriticalAuditorProfileForStage({
        profile,
        stageProfileId,
        expectedProfileHash: profile.profileHash,
        expectedStageProfileHash:
          'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      });
      expect(stale.ok).toBe(false);
      expect(stale.blockingReasons).toContain('critical_auditor_stage_profile_hash_stale');

      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createFixtureAuditTriadPlan({
        fixture,
        compiled,
        attemptId: 'audit-current',
      });
      expect(plan.stageProfileId).toBe('post_implementation_code_audit');
      expect(plan.subagents.every((agent) => agent.requiredCheckItemIds.length > 0)).toBe(true);
      const round = createFixtureAuditTriadRound(plan, 'r1', {
        perspectiveResults: {
          product_intent: { agentId: 'a1', validGaps: [] },
          model_projection: { agentId: 'a2', validGaps: [] },
          main_agent_execution: { agentId: 'a3', validGaps: [] },
        },
        requiredCheckItemSetHash: 'sha256:stale-check-items',
        scoreReceiptRefs: ['score.json'],
        runAuditorHostReceiptRefs: ['host.json'],
      });
      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [round, { ...round, roundId: 'r2' }, { ...round, roundId: 'r3' }],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain('round_1_check_item_set_hash_mismatch');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
