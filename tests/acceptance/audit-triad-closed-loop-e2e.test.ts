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

describe('Audit triad closed-loop e2e', () => {
  it('passes only after three current all-perspective no-gap rounds with receipts', () => {
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
      const round = (roundId: string) => ({
        schemaVersion: 'audit-triad-round-receipt/v1' as const,
        roundId,
        stageProfileId: plan.stageProfileId,
        perspectiveResults: {
          product_intent: { agentId: `${roundId}-p`, validGaps: [] },
          model_projection: { agentId: `${roundId}-m`, validGaps: [] },
          main_agent_execution: { agentId: `${roundId}-e`, validGaps: [] },
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
        requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
        currentAttemptHash: plan.currentAttemptHash,
        currentEvidenceHash: plan.currentEvidenceHash,
        scoreReceiptRefs: [`score-${roundId}.json`],
        runAuditorHostReceiptRefs: [`host-${roundId}.json`],
      });
      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [round('r1'), round('r2'), round('r3')],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(decision.ok).toBe(true);
      expect(decision.convergenceReceipt).toMatchObject({
        validNoGapRounds: 3,
      });
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
