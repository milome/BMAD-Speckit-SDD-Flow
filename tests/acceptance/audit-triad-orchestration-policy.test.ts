import { describe, expect, it } from 'vitest';
import {
  createAuditTriadExecutionPlan,
  evaluateAuditTriadConvergence,
  sha256Json,
  type AuditTriadRoundReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/audit-triad-orchestrator';
import {
  criticalAuditorIndependentProviderRunHash,
  type CriticalAuditorIndependentProviderEvidence,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-critical-auditor-independence';
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
  const criticalAuditorRequestHash = sha256Json({
    auditEpochId: plan.auditEpochId,
    roundId,
    role: 'llm_as_judge',
  });
  const evidenceWithoutRunHash: Omit<CriticalAuditorIndependentProviderEvidence, 'runHash'> = {
    ...plan.independentProviderBinding,
    transactionId: plan.auditEpochId,
    auditAttemptId: plan.attemptId,
    providerRunId: `provider-${roundId}`,
    requestHash: criticalAuditorRequestHash,
    responseHash: sha256Json({ roundId, verdict: 'no_new_valid_gap' }),
    sourceDocumentHash: plan.sourceDocumentHash,
    semanticModelHash: plan.semanticModelHash,
    projectionSetHash: plan.projectionSetHash,
  };
  return {
    schemaVersion: 'audit-triad-round-receipt/v1',
    roundId,
    verdict: 'no_new_valid_gap',
    stageProfileId: plan.stageProfileId,
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
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
    semanticModelHash: plan.semanticModelHash,
    implementationConfirmationHash: plan.implementationConfirmationHash,
    projectionSetHash: plan.projectionSetHash,
    checkedProjectionQualityRuleCodes: plan.checkedProjectionQualityRuleCodes,
    qualityRuleSetHash: plan.qualityRuleSetHash,
    modelPacketHash: plan.modelPacketHash,
    auditReceiptHash: plan.auditReceiptHash,
    goalExecutionHash: plan.goalExecutionHash,
    criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    currentAttemptHash: plan.currentAttemptHash,
    currentEvidenceHash: plan.currentEvidenceHash,
    criticalAuditorRequestHash,
    independentProviderEvidence: {
      ...evidenceWithoutRunHash,
      runHash: criticalAuditorIndependentProviderRunHash(evidenceWithoutRunHash),
    },
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
        semanticModelHash: fixture.semanticModelHash,
        projectionSetHash: sha256Json({
          modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        }),
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

  it('rejects round receipts from different audit epochs', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: 'audit-current',
        semanticModelHash: fixture.semanticModelHash,
        projectionSetHash: sha256Json({
          modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        }),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const roundWithEpoch = (roundId: string, auditEpochId: string) =>
        makeRound(plan, roundId, { auditEpochId });

      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [
          roundWithEpoch('r1', plan.auditEpochId),
          roundWithEpoch('r2', sha256Json({ staleEpoch: plan.auditEpochId })),
          roundWithEpoch('r3', plan.auditEpochId),
        ],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });

      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain('round_2_audit_epoch_mismatch');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('rejects convergence when any required veto item result is missing', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: 'audit-veto-coverage',
        semanticModelHash: fixture.semanticModelHash,
        projectionSetHash: sha256Json({
          modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        }),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const requiredVetoItemId = plan.subagents[0].requiredCheckItemIds.find((itemId) =>
        itemId.startsWith('veto_')
      );
      expect(requiredVetoItemId).toBeTruthy();

      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [makeRound(plan, 'r1'), makeRound(plan, 'r2'), makeRound(plan, 'r3')],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });

      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain(
        `round_1_veto_item_missing:${requiredVetoItemId}`
      );
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('rejects blocked and insufficient Judge verdicts even when no validated gaps are present', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: 'audit-non-convergent-verdicts',
        semanticModelHash: fixture.semanticModelHash,
        projectionSetHash: sha256Json({
          modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        }),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const completeVetoResults = plan.vetoItemIds.map((itemId) => ({
        itemId,
        passed: true,
      }));
      const rounds: AuditTriadRoundReceipt[] = [
        {
          ...makeRound(plan, 'r1', { vetoItemResults: completeVetoResults }),
          verdict: 'blocked',
        },
        {
          ...makeRound(plan, 'r2', { vetoItemResults: completeVetoResults }),
          verdict: 'insufficient_audit',
        },
        {
          ...makeRound(plan, 'r3', { vetoItemResults: completeVetoResults }),
          verdict: 'no_new_valid_gap',
        },
      ];

      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds,
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });

      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain(
        'round_1_judge_verdict_not_convergent:blocked'
      );
      expect(decision.blockingReasons).toContain(
        'round_2_judge_verdict_not_convergent:insufficient_audit'
      );
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('rejects replayed provider runs and producer receipt hashes across audit rounds', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: 'audit-cross-round-replay',
        semanticModelHash: fixture.semanticModelHash,
        projectionSetHash: sha256Json({
          modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        }),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const completeVetoResults = plan.vetoItemIds.map((itemId) => ({
        itemId,
        passed: true,
      }));
      const makeBoundRound = (roundId: string) => {
        const round = makeRound(plan, roundId, { vetoItemResults: completeVetoResults });
        return {
          ...round,
          judgeExecutionReceiptRef: {
            path: `rounds/${roundId}/judge-execution-receipt.json`,
            contentHash: sha256Json({ roundId, role: 'judge-execution-receipt' }),
            receiptHash: sha256Json({ roundId, role: 'judge-execution-receipt-self-hash' }),
          },
          readonlyAuditorHostInvocationReceiptRef: {
            path: `rounds/${roundId}/readonly-auditor-host-invocation-receipt.json`,
            contentHash: sha256Json({
              roundId,
              role: 'readonly-auditor-host-invocation-receipt',
            }),
            receiptHash: sha256Json({
              roundId,
              role: 'readonly-auditor-host-invocation-receipt-self-hash',
            }),
          },
        };
      };
      const roundOne = makeBoundRound('r1');
      const roundTwoBase = makeBoundRound('r2');
      const roundTwoEvidenceWithoutRunHash = {
        ...roundTwoBase.independentProviderEvidence!,
        providerRunId: roundOne.independentProviderEvidence!.providerRunId,
      };
      delete (roundTwoEvidenceWithoutRunHash as { runHash?: string }).runHash;
      const roundTwo = {
        ...roundTwoBase,
        independentProviderEvidence: {
          ...roundTwoEvidenceWithoutRunHash,
          runHash: criticalAuditorIndependentProviderRunHash(roundTwoEvidenceWithoutRunHash),
        },
        judgeExecutionReceiptRef: roundOne.judgeExecutionReceiptRef,
        readonlyAuditorHostInvocationReceiptRef:
          roundOne.readonlyAuditorHostInvocationReceiptRef,
      };
      const roundThree = makeBoundRound('r3');

      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [roundOne, roundTwo, roundThree],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });

      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain('round_2_provider_run_id_replayed');
      expect(decision.blockingReasons).toContain('round_2_judge_receipt_hash_replayed');
      expect(decision.blockingReasons).toContain(
        'round_2_readonly_host_receipt_hash_replayed'
      );
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('rejects Judge and readonly invocation receipts substituted for score and host closeout receipts', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: 'audit-receipt-role-substitution',
        semanticModelHash: fixture.semanticModelHash,
        projectionSetHash: sha256Json({
          modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        }),
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const completeVetoResults = plan.vetoItemIds.map((itemId) => ({
        itemId,
        passed: true,
      }));
      const makeSubstitutedRound = (roundId: string): AuditTriadRoundReceipt => {
        const judgeReceiptRef = {
          path: `rounds/${roundId}/judge-execution-receipt.json`,
          contentHash: sha256Json({ roundId, role: 'judge-execution-receipt' }),
          receiptHash: sha256Json({ roundId, role: 'judge-execution-receipt-self-hash' }),
        };
        const readonlyHostReceiptRef = {
          path: `rounds/${roundId}/readonly-auditor-host-invocation-receipt.json`,
          contentHash: sha256Json({
            roundId,
            role: 'readonly-auditor-host-invocation-receipt',
          }),
          receiptHash: sha256Json({
            roundId,
            role: 'readonly-auditor-host-invocation-receipt-self-hash',
          }),
        };
        return {
          ...makeRound(plan, roundId, { vetoItemResults: completeVetoResults }),
          judgeExecutionReceiptRef: judgeReceiptRef,
          readonlyAuditorHostInvocationReceiptRef: readonlyHostReceiptRef,
          scoreReceiptRefs: [judgeReceiptRef.path],
          runAuditorHostReceiptRefs: [readonlyHostReceiptRef.path],
        };
      };

      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [
          makeSubstitutedRound('r1'),
          makeSubstitutedRound('r2'),
          makeSubstitutedRound('r3'),
        ],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });

      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain('round_1_score_receipt_role_invalid');
      expect(decision.blockingReasons).toContain(
        'round_1_run_auditor_host_receipt_role_invalid'
      );
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
