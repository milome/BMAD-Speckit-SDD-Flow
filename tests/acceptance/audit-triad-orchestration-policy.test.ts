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

function makeRound(
  plan: ReturnType<typeof createAuditTriadExecutionPlan>,
  roundId: string,
  overrides: Partial<AuditTriadRoundReceipt> = {}
): AuditTriadRoundReceipt {
  return {
    schemaVersion: 'audit-triad-round-receipt/v1',
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
    ...overrides,
  };
}

describe('Audit triad closed-loop orchestration policy', () => {
  it('rejects duplicate perspectives, duplicate agents, and fewer than three independent rounds', () => {
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
      expect(plan.subagents.map((agent) => agent.perspectiveId)).toEqual([
        'product_intent',
        'model_projection',
        'main_agent_execution',
      ]);
      expect(new Set(plan.subagents.map((agent) => agent.agentId)).size).toBe(3);

      const duplicateAgentRound = makeRound(plan, 'r1', {
        perspectiveResults: {
          product_intent: { agentId: 'same-agent', validGaps: [] },
          model_projection: { agentId: 'same-agent', validGaps: [] },
          main_agent_execution: { agentId: 'same-agent', validGaps: [] },
        },
      });
      const duplicateAgentDecision = evaluateAuditTriadConvergence({
        plan,
        rounds: [duplicateAgentRound, makeRound(plan, 'r2'), makeRound(plan, 'r3')],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(duplicateAgentDecision.ok).toBe(false);
      expect(duplicateAgentDecision.blockingReasons).toContain('round_1_duplicate_agent');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
