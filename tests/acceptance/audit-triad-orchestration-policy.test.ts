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
  const readonlyAuditorInvocationId = `readonly-${sha256Json({
    auditEpochId: plan.auditEpochId,
    roundId,
  }).slice('sha256:'.length, 'sha256:'.length + 16)}`;
  const criticalAuditorRequestHash = sha256Json({
    auditEpochId: plan.auditEpochId,
    roundId,
    role: 'llm_as_judge',
  });
  const evidenceWithoutRunHash: Omit<CriticalAuditorIndependentProviderEvidence, 'runHash'> = {
    ...plan.independentProviderBinding,
    requestedModel: plan.independentProviderBinding.model,
    model: `gateway-selected-${sha256Json({
      providerId: plan.independentProviderBinding.providerId,
      roundId,
    }).slice('sha256:'.length, 'sha256:'.length + 16)}`,
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
    readonlyAuditorInvocationId,
    perspectiveResults: {
      product_intent: { agentId: readonlyAuditorInvocationId, validGaps: [] },
      model_projection: { agentId: readonlyAuditorInvocationId, validGaps: [] },
      main_agent_execution: { agentId: readonlyAuditorInvocationId, validGaps: [] },
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

type FullyBoundRound = AuditTriadRoundReceipt & {
  providerInvocationReceiptRef: {
    path: string;
    contentHash: string;
    receiptHash: string;
  };
  receiptHash: string;
};

function makeFullyBoundRound(
  plan: ReturnType<typeof createAuditTriadExecutionPlan>,
  roundId: string
): FullyBoundRound {
  const judgeReceiptWithoutHash = {
    schemaVersion: 'audit-judge-execution-receipt/v1',
    auditEpochId: plan.auditEpochId,
    roundId,
  };
  const readonlyHostReceiptWithoutHash = {
    schemaVersion: 'audit-readonly-auditor-host-invocation-receipt/v1',
    auditEpochId: plan.auditEpochId,
    roundId,
  };
  const scoreWriterReceiptWithoutHash = {
    schemaVersion: 'run-auditor-host-score-writer-invocation-receipt/v1',
    auditEpochId: plan.auditEpochId,
    roundId,
  };
  const providerReceiptWithoutHash = {
    schemaVersion: 'critical-auditor-judge-invocation-receipt/v1',
    auditEpochId: plan.auditEpochId,
    roundId,
  };
  const roundWithoutHash = {
    ...makeRound(plan, roundId, {
      vetoItemResults: plan.vetoItemIds.map((itemId) => ({ itemId, passed: true })),
      judgeExecutionReceiptRef: {
        path: `rounds/${roundId}/judge-execution-receipt.json`,
        contentHash: sha256Json(judgeReceiptWithoutHash),
        receiptHash: sha256Json(judgeReceiptWithoutHash),
      },
      readonlyAuditorHostInvocationReceiptRef: {
        path: `rounds/${roundId}/readonly-auditor-host-invocation-receipt.json`,
        contentHash: sha256Json(readonlyHostReceiptWithoutHash),
        receiptHash: sha256Json(readonlyHostReceiptWithoutHash),
      },
      scoreWriterInvocationReceiptRef: {
        path: `rounds/${roundId}/score-writer-invocation-receipt.json`,
        contentHash: sha256Json(scoreWriterReceiptWithoutHash),
        receiptHash: sha256Json(scoreWriterReceiptWithoutHash),
      },
    }),
    providerInvocationReceiptRef: {
      path: `rounds/${roundId}/judge-provider-invocation-receipt.json`,
      contentHash: sha256Json(providerReceiptWithoutHash),
      receiptHash: sha256Json(providerReceiptWithoutHash),
    },
  };
  return {
    ...roundWithoutHash,
    receiptHash: sha256Json(roundWithoutHash),
  };
}

describe('Audit triad closed-loop orchestration policy', () => {
  it('binds all perspectives to one readonly invocation and rejects a mismatched producer', () => {
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
      expect(plan.readonlyAuditorExecution).toMatchObject({
        producerMode: 'codex_exec_readonly',
        producerCount: 1,
        perspectiveIds: ['product_intent', 'model_projection', 'main_agent_execution'],
      });
      expect(plan.subagents.map((agent) => agent.perspectiveId)).toEqual([
        'product_intent',
        'model_projection',
        'main_agent_execution',
      ]);
      expect(new Set(plan.subagents.map((agent) => agent.agentId)).size).toBe(1);

      const duplicateAgentRound = makeRound(plan, 'r1', {
        readonlyAuditorInvocationId: 'readonly-invocation-r1',
        perspectiveResults: {
          product_intent: { agentId: 'readonly-invocation-r1', validGaps: [] },
          model_projection: { agentId: 'different-invocation', validGaps: [] },
          main_agent_execution: { agentId: 'readonly-invocation-r1', validGaps: [] },
        },
      });
      const duplicateAgentDecision = evaluateAuditTriadConvergence({
        plan,
        rounds: [duplicateAgentRound, makeRound(plan, 'r2'), makeRound(plan, 'r3')],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(duplicateAgentDecision.ok).toBe(false);
      expect(duplicateAgentDecision.blockingReasons).toContain(
        'round_1_readonly_auditor_invocation_binding_mismatch'
      );
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

  it('rejects replayed provider invocation receipts and readonly invocation identities', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: `audit-${fixture.runId}`,
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
      const roundOne = makeFullyBoundRound(plan, 'r1');
      const roundTwoBase = makeFullyBoundRound(plan, 'r2');
      const roundTwoWithoutHash = {
        ...roundTwoBase,
        readonlyAuditorInvocationId: roundOne.readonlyAuditorInvocationId,
        perspectiveResults: {
          product_intent: {
            agentId: roundOne.readonlyAuditorInvocationId,
            validGaps: [],
          },
          model_projection: {
            agentId: roundOne.readonlyAuditorInvocationId,
            validGaps: [],
          },
          main_agent_execution: {
            agentId: roundOne.readonlyAuditorInvocationId,
            validGaps: [],
          },
        },
        providerInvocationReceiptRef: roundOne.providerInvocationReceiptRef,
      };
      delete (roundTwoWithoutHash as { receiptHash?: string }).receiptHash;
      const roundTwo: FullyBoundRound = {
        ...roundTwoWithoutHash,
        receiptHash: sha256Json(roundTwoWithoutHash),
      };

      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [roundOne, roundTwo, makeFullyBoundRound(plan, 'r3')],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });

      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain(
        'round_2_readonly_auditor_invocation_id_replayed'
      );
      expect(decision.blockingReasons).toContain(
        'round_2_provider_invocation_receipt_hash_replayed'
      );
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('rejects a replayed round receipt identity even when round fields differ', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: `audit-${fixture.runId}`,
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
      const roundOne = makeFullyBoundRound(plan, 'r1');
      const roundTwo = {
        ...makeFullyBoundRound(plan, 'r2'),
        receiptHash: roundOne.receiptHash,
      };

      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [roundOne, roundTwo, makeFullyBoundRound(plan, 'r3')],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });

      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain(
        'round_2_round_receipt_self_hash_replayed'
      );
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('rejects replay against a round outside the final convergence window', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: 'audit-replay-outside-window',
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
      const makeBoundRound = (roundId: string): AuditTriadRoundReceipt => {
        const readonlyAuditorInvocationId = `readonly-${roundId}`;
        return {
          ...makeRound(plan, roundId, {
            readonlyAuditorInvocationId,
            vetoItemResults: completeVetoResults,
            perspectiveResults: {
              product_intent: { agentId: readonlyAuditorInvocationId, validGaps: [] },
              model_projection: { agentId: readonlyAuditorInvocationId, validGaps: [] },
              main_agent_execution: { agentId: readonlyAuditorInvocationId, validGaps: [] },
            },
          }),
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
      const roundFourBase = makeBoundRound('r4');
      const replayedEvidenceWithoutRunHash = {
        ...roundFourBase.independentProviderEvidence!,
        providerRunId: roundOne.independentProviderEvidence!.providerRunId,
      };
      delete (replayedEvidenceWithoutRunHash as { runHash?: string }).runHash;
      const roundFour: AuditTriadRoundReceipt = {
        ...roundFourBase,
        independentProviderEvidence: {
          ...replayedEvidenceWithoutRunHash,
          runHash: criticalAuditorIndependentProviderRunHash(replayedEvidenceWithoutRunHash),
        },
        judgeExecutionReceiptRef: roundOne.judgeExecutionReceiptRef,
        readonlyAuditorHostInvocationReceiptRef:
          roundOne.readonlyAuditorHostInvocationReceiptRef,
      };

      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds: [
          roundOne,
          makeBoundRound('r2'),
          makeBoundRound('r3'),
          roundFour,
        ],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });

      expect(decision.ok).toBe(false);
      expect(decision.blockingReasons).toContain('round_4_provider_run_id_replayed');
      expect(decision.blockingReasons).toContain('round_4_judge_receipt_hash_replayed');
      expect(decision.blockingReasons).toContain(
        'round_4_readonly_host_receipt_hash_replayed'
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
