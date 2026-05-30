import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createAuditTriadExecutionPlan,
  type AuditTriadExecutionPlan,
  type AuditTriadRoundReceipt,
  writeAuditTriadExecutionPlan,
} from '../../scripts/audit-triad-orchestrator';
import { mainAuditReviewGate } from '../../scripts/main-agent-audit-review-gate';
import { resolveSixModelRuntimeDecision } from '../../scripts/six-model-runtime-decision';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function cleanRound(plan: AuditTriadExecutionPlan, roundId: string): AuditTriadRoundReceipt {
  return {
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
  };
}

describe('main agent audit review gate', () => {
  it('records audit_review pass only after current execution closure and three no-gap receipt rounds', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
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
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'audit-triad',
        'audit-current',
        'rounds.json'
      );
      writeJson(roundsPath, [cleanRound(plan, 'r1'), cleanRound(plan, 'r2'), cleanRound(plan, 'r3')]);

      const code = mainAuditReviewGate([
        '--requirement-record',
        fixture.recordPath,
        '--attempt-id',
        'audit-current',
        '--plan',
        planPath,
        '--rounds',
        roundsPath,
        '--evaluated-at',
        '2026-05-30T12:00:00.000Z',
        '--evaluated-by',
        'test-agent',
        '--json',
      ]);

      expect(code).toBe(0);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.currentMentalModel).toBe('audit_review');
      expect(record.lastEventType).toBe('audit_review_result_recorded');
      expect(record.sixModelResults.audit_review).toMatchObject({
        model: 'audit_review',
        status: 'pass',
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        blockingReasons: [],
      });
      expect(record.mentalModelTransitions.at(-1)).toMatchObject({
        fromModel: 'execution_closure',
        toModel: 'audit_review',
      });
      expect(
        resolveSixModelRuntimeDecision({
          record,
          attemptId: 'audit-current',
        }).nextAction
      ).toBe('run_closeout');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('fails closed without score and runAuditorHost receipts', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
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
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'audit-triad',
        'audit-current',
        'rounds.json'
      );
      const withoutReceipts = (roundId: string): AuditTriadRoundReceipt => {
        const round = cleanRound(plan, roundId);
        delete round.scoreReceiptRefs;
        delete round.runAuditorHostReceiptRefs;
        return round;
      };
      writeJson(roundsPath, [withoutReceipts('r1'), withoutReceipts('r2'), withoutReceipts('r3')]);

      const code = mainAuditReviewGate([
        '--requirement-record',
        fixture.recordPath,
        '--attempt-id',
        'audit-current',
        '--plan',
        planPath,
        '--rounds',
        roundsPath,
        '--evaluated-at',
        '2026-05-30T12:00:00.000Z',
        '--json',
      ]);

      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.sixModelResults.audit_review.status).toBe('blocked');
      expect(record.sixModelResults.audit_review.blockingReasons).toEqual(
        expect.arrayContaining([
          'round_1_score_receipt_missing',
          'round_1_run_auditor_host_receipt_missing',
        ])
      );
      expect(
        resolveSixModelRuntimeDecision({
          record,
          attemptId: 'audit-current',
        }).nextAction
      ).toBe('dispatch_remediation');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('fails closed when the triad plan uses placeholder current evidence', () => {
    const fixture = materializeRequirementFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
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
      });
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'audit-triad',
        'audit-current',
        'rounds.json'
      );
      writeJson(roundsPath, [cleanRound(plan, 'r1'), cleanRound(plan, 'r2'), cleanRound(plan, 'r3')]);

      const code = mainAuditReviewGate([
        '--requirement-record',
        fixture.recordPath,
        '--attempt-id',
        'audit-current',
        '--plan',
        planPath,
        '--rounds',
        roundsPath,
        '--evaluated-at',
        '2026-05-30T12:00:00.000Z',
        '--json',
      ]);

      expect(code).toBe(1);
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8'));
      expect(record.sixModelResults.audit_review.blockingReasons).toContain(
        'audit_triad_plan_current_evidence_hash_placeholder'
      );
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
