import { describe, expect, it } from 'vitest';
import {
  createAuditTriadExecutionPlan,
  evaluateAuditTriadConvergence,
} from '../../scripts/audit-triad-orchestrator';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

describe('Audit triad reset on reconfirmation', () => {
  it('rejects stale convergence receipts after source or confirmation hash changes', () => {
    const fixture = materializeRequirementFixture();
    try {
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
      const staleSourceRound = {
        schemaVersion: 'audit-triad-round-receipt/v1' as const,
        roundId: 'r1',
        stageProfileId: plan.stageProfileId,
        perspectiveResults: {
          product_intent: { agentId: 'p1', validGaps: [] },
          model_projection: { agentId: 'm1', validGaps: [] },
          main_agent_execution: { agentId: 'e1', validGaps: [] },
        },
        coveredCheckItemIds: plan.subagents[0].requiredCheckItemIds,
        vetoItemResults: [],
        validatedGapRefs: [],
        invalidGapRefs: [],
        sourceDocumentHash: 'sha256:stale-source',
        implementationConfirmationHash: plan.implementationConfirmationHash,
        modelPacketHash: plan.modelPacketHash,
        auditReceiptHash: plan.auditReceiptHash,
        goalExecutionHash: plan.goalExecutionHash,
        criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
        criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
        requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
        currentAttemptHash: plan.currentAttemptHash,
        currentEvidenceHash: plan.currentEvidenceHash,
        scoreReceiptRefs: ['score.json'],
        runAuditorHostReceiptRefs: ['host.json'],
      };
      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [staleSourceRound, { ...staleSourceRound, roundId: 'r2' }, { ...staleSourceRound, roundId: 'r3' }],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain('round_1_source_hash_mismatch');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
