import { describe, expect, it } from 'vitest';
import {
  createAuditTriadExecutionPlan,
  evaluateAuditTriadConvergence,
  type AuditTriadRoundReceipt,
} from '../../scripts/audit-triad-orchestrator';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

describe('Main Agent audit review convergence', () => {
  it('requires exactly three current no-gap rounds and closes only with score and runAuditorHost receipts', () => {
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
      const round = (roundId: string): AuditTriadRoundReceipt => ({
        schemaVersion: 'audit-triad-round-receipt/v1',
        roundId,
        stageProfileId: plan.stageProfileId,
        perspectiveResults: {
          product_intent: { agentId: `product-${roundId}`, validGaps: [] },
          model_projection: { agentId: `model-${roundId}`, validGaps: [] },
          main_agent_execution: { agentId: `main-${roundId}`, validGaps: [] },
        },
        coveredCheckItemIds: plan.subagents[0].requiredCheckItemIds,
        vetoItemResults: plan.subagents[0].requiredCheckItemIds
          .filter((id) => id.startsWith('veto_'))
          .map((itemId) => ({ itemId, passed: true })),
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
        runAuditorHostReceiptRefs: [`auditor-host-${roundId}.json`],
      });

      const pass = evaluateAuditTriadConvergence({
        plan,
        rounds: [round('r1'), round('r2'), round('r3')],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(pass.ok).toBe(true);
      expect(pass.convergenceReceipt).toMatchObject({
        schemaVersion: 'audit-triad-convergence-receipt/v1',
        recordId: fixture.recordId,
        attemptId: 'audit-current',
        validNoGapRounds: 3,
      });

      const gapRound = { ...round('r4'), validatedGapRefs: ['GAP-001'] };
      const unresolvedGap = evaluateAuditTriadConvergence({
        plan,
        rounds: [round('r2'), round('r3'), gapRound],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(unresolvedGap.ok).toBe(false);
      expect(unresolvedGap.blockingReasons).toEqual(
        expect.arrayContaining([
          'round_3_validated_gap_unresolved',
          'main_agent_repair_receipt_missing',
        ])
      );
      const repairedButNotFedBack = evaluateAuditTriadConvergence({
        plan,
        rounds: [round('r2'), round('r3'), gapRound],
        repairReceiptRefs: ['repair-receipt.json'],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(repairedButNotFedBack.blockingReasons).toContain('repair_feedback_dispatch_missing');

      const staleAttempt = evaluateAuditTriadConvergence({
        plan,
        rounds: [
          round('r1'),
          { ...round('r2'), currentAttemptHash: 'sha256:stale-attempt' },
          round('r3'),
        ],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(staleAttempt.ok).toBe(false);
      expect(staleAttempt.blockingReasons).toContain('round_2_current_attempt_hash_mismatch');

      const staleEvidence = evaluateAuditTriadConvergence({
        plan,
        rounds: [
          round('r1'),
          round('r2'),
          { ...round('r3'), currentEvidenceHash: 'sha256:stale-evidence' },
        ],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(staleEvidence.ok).toBe(false);
      expect(staleEvidence.blockingReasons).toContain('round_3_current_evidence_hash_mismatch');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
