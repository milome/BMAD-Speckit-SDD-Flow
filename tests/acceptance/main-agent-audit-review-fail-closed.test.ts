import { describe, expect, it } from 'vitest';
import {
  createExecutionPacket,
  type AuditExecutionProfile,
  type AuditTriadExecutionPlanRef,
  type CompiledPromptRef,
} from '../../scripts/orchestration-dispatch-contract';
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

function baseAuditInput(fixture: ReturnType<typeof materializeRequirementFixture>): {
  compiledPromptRef: CompiledPromptRef;
  auditExecutionProfile: AuditExecutionProfile;
  auditTriadExecutionPlanRef: AuditTriadExecutionPlanRef;
} {
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
  const auditExecutionProfile: AuditExecutionProfile = {
    schemaVersion: 'audit-execution-profile/v1',
    profileId: 'main-agent-audit-review-execution',
    profileHash: plan.criticalAuditorProfileHash,
    stageProfileId: plan.stageProfileId,
    stageProfileHash: plan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    perspectives: ['product_intent', 'model_projection', 'main_agent_execution'],
    auditScoringConvergencePolicy: {
      auditPassRequired: true,
      criticalAuditorNoNewGapRequired: true,
      scoreReceiptRequired: true,
      dimensionContractMatchRequired: true,
      thresholdPassRequired: true,
      vetoForbidden: true,
      iterationCountRequired: true,
      freshHashesRequired: true,
    },
    runAuditorHostArgs: {
      projectRoot: fixture.root,
      stage: 'implement',
      artifactPath: compiled.compiledPromptRef.modelPacketPath,
      reportPath: 'AUDIT_current_attempt.md',
    },
    currentAttemptBinding: {
      recordId: fixture.recordId,
      requirementSetId: fixture.requirementSetId,
      attemptId: 'audit-current',
      sourceDocumentHash: fixture.sourceDocumentHash,
      implementationConfirmationHash: fixture.implementationConfirmationHash,
      modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
      currentAttemptHash: plan.currentAttemptHash,
      currentEvidenceHash: plan.currentEvidenceHash,
    },
    selfReviewDenied: true,
  };
  return {
    compiledPromptRef: compiled.compiledPromptRef,
    auditExecutionProfile,
    auditTriadExecutionPlanRef: {
      path: 'audit-triad-execution-plan.json',
      contentHash: 'sha256:plan',
      attemptId: 'audit-current',
      stageProfileId: plan.stageProfileId,
      criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
      criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
      requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
      auditReceiptHash: plan.auditReceiptHash,
      goalExecutionHash: plan.goalExecutionHash,
      currentAttemptHash: plan.currentAttemptHash,
      currentEvidenceHash: plan.currentEvidenceHash,
    },
  };
}

describe('Main Agent audit review fail-closed contract', () => {
  it('rejects audit packets that use legacy prompt, missing compiled prompt, missing profile, or missing triad plan', () => {
    const fixture = materializeRequirementFixture();
    try {
      const base = baseAuditInput(fixture);
      const packetBase = {
        packetId: 'audit-current',
        parentSessionId: fixture.requirementSetId,
        flow: 'standalone_tasks' as const,
        phase: 'implement',
        taskType: 'audit' as const,
        role: 'code-reviewer',
        inputArtifacts: [fixture.recordPath],
        allowedWriteScope: ['_bmad-output/**'],
        expectedDelta: 'audit current attempt',
        successCriteria: ['triad audit converged'],
        stopConditions: ['true blocker'],
      };

      expect(() =>
        createExecutionPacket({
          ...packetBase,
          authorityMode: 'legacy_generic_prompt',
          legacyPromptFallbackReason: 'no_confirmed_source',
          ...base,
        })
      ).toThrow(/audit packets cannot use legacy_generic_prompt/u);
      expect(() =>
        createExecutionPacket({
          ...packetBase,
          authorityMode: 'compiled_implementation_confirmation',
          compiledPromptRef: null,
          auditExecutionProfile: base.auditExecutionProfile,
          auditTriadExecutionPlanRef: base.auditTriadExecutionPlanRef,
          compilerBlock: ['audit_current_attempt_compiledPromptRef_missing'],
        })
      ).toThrow(/audit packets require compiledPromptRef/u);
      expect(() =>
        createExecutionPacket({
          ...packetBase,
          authorityMode: 'compiled_implementation_confirmation',
          compiledPromptRef: base.compiledPromptRef,
          auditTriadExecutionPlanRef: base.auditTriadExecutionPlanRef,
        })
      ).toThrow(/auditExecutionProfile is required/u);
      expect(() =>
        createExecutionPacket({
          ...packetBase,
          authorityMode: 'compiled_implementation_confirmation',
          compiledPromptRef: base.compiledPromptRef,
          auditExecutionProfile: base.auditExecutionProfile,
        })
      ).toThrow(/auditTriadExecutionPlanRef is required/u);
      expect(() =>
        createExecutionPacket({
          ...packetBase,
          authorityMode: 'compiled_implementation_confirmation',
          compiledPromptRef: base.compiledPromptRef,
          auditExecutionProfile: {
            ...base.auditExecutionProfile,
            selfReviewDenied: false as never,
          },
          auditTriadExecutionPlanRef: base.auditTriadExecutionPlanRef,
        })
      ).toThrow(/deny self review/u);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('blocks audit convergence without three current no-gap rounds, score receipts, and runAuditorHost receipts', () => {
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
      const cleanRound = (roundId: string): AuditTriadRoundReceipt => ({
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
      });

      expect(
        evaluateAuditTriadConvergence({
          plan,
          rounds: [cleanRound('r1'), cleanRound('r2')],
          scoreReceiptRequired: true,
          runAuditorHostReceiptRequired: true,
        }).blockingReasons
      ).toEqual(expect.arrayContaining(['audit_triad_three_rounds_missing']));

      const withoutReceipts = evaluateAuditTriadConvergence({
        plan,
        rounds: [cleanRound('r1'), cleanRound('r2'), cleanRound('r3')],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(withoutReceipts.ok).toBe(false);
      expect(withoutReceipts.blockingReasons).toEqual(
        expect.arrayContaining(['round_1_score_receipt_missing', 'round_1_run_auditor_host_receipt_missing'])
      );
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
