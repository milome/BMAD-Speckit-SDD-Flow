import { describe, expect, it } from 'vitest';
import {
  createAuditTriadExecutionPlan,
  evaluateAuditTriadConvergence,
  type AuditTriadRoundReceipt,
} from '../../scripts/audit-triad-orchestrator';
import {
  resolveCriticalAuditorProfile,
  stageProfileForCallPoint,
  validateCriticalAuditorProfileForStage,
} from '../../scripts/critical-auditor-profile';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

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
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: 'audit-current',
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      expect(plan.stageProfileId).toBe('post_implementation_code_audit');
      expect(plan.subagents.every((agent) => agent.requiredCheckItemIds.length > 0)).toBe(true);
      const round: AuditTriadRoundReceipt = {
        schemaVersion: 'audit-triad-round-receipt/v1',
        roundId: 'r1',
        stageProfileId: plan.stageProfileId,
        perspectiveResults: {
          product_intent: { agentId: 'a1', validGaps: [] },
          model_projection: { agentId: 'a2', validGaps: [] },
          main_agent_execution: { agentId: 'a3', validGaps: [] },
        },
        coveredCheckItemIds: plan.subagents[0].requiredCheckItemIds,
        vetoItemResults: [],
        validatedGapRefs: [],
        invalidGapRefs: [],
        sourceDocumentHash: plan.sourceDocumentHash,
        implementationConfirmationHash: plan.implementationConfirmationHash,
        modelPacketHash: plan.modelPacketHash,
        auditReceiptHash: plan.auditReceiptHash,
        goalExecutionHash: plan.goalExecutionHash,
        criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
        criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
        requiredCheckItemSetHash: 'sha256:stale-check-items',
        currentAttemptHash: plan.currentAttemptHash,
        currentEvidenceHash: plan.currentEvidenceHash,
        scoreReceiptRefs: ['score.json'],
        runAuditorHostReceiptRefs: ['host.json'],
      };
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
