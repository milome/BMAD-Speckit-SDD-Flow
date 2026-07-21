import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createAuditTriadExecutionPlan,
  type AuditTriadExecutionPlan,
  type AuditTriadRoundReceipt,
  writeAuditTriadExecutionPlan,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/audit-triad-orchestrator';
import { mainAuditReviewGate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-audit-review-gate';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionRecordPatch,
  validateRuntimeStatusDecisionReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-runtime-status-decision-receipt';
import { sha256Text } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirement-record-control-store';
import { resolveSixModelRuntimeDecision } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/six-model-runtime-decision';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function establishExecutionClosureAuthority(
  fixture: ReturnType<typeof materializeRequirementFixture>,
  compiled: ReturnType<typeof writeCompiledImplementPacket>
): void {
  const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8')) as Record<string, unknown>;
  const sixModelResults = record.sixModelResults as Record<
    string,
    Record<string, unknown>
  >;
  const update = createRuntimeStatusProjectionUpdate({
    recordId: fixture.recordId,
    requirementSetId: fixture.requirementSetId,
    modelId: 'execution_closure',
    implementationAttemptId: fixture.runId,
    sourceDocumentHash: fixture.sourceDocumentHash,
    implementationConfirmationHash: fixture.implementationConfirmationHash,
    semanticModelHash: String(record.semanticModelHash),
    stageInputs: [
      {
        role: 'model_packet',
        path: compiled.compiledPromptRef.modelPacketPath,
        hash: compiled.compiledPromptRef.modelPacketHash,
      },
    ],
    deterministicGateOutputs: [
      {
        role: 'audit_receipt',
        path: compiled.compiledPromptRef.auditReceiptPath,
        hash: compiled.compiledPromptRef.auditReceiptHash,
      },
    ],
    blockerRefs: [],
    evidenceRefs: [compiled.compiledPromptRef.auditReceiptPath],
    authorityClass: 'controlled_closeout',
    decision: 'pass',
    effectiveStatus: 'pass',
    createdAt: '2026-05-30T11:59:59.000Z',
    receiptPath: path.join(
      fixture.root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      fixture.recordId,
      'runtime-status',
      fixture.runId,
      'execution-closure.json'
    ),
    projection: {
      ...sixModelResults.execution_closure,
      status: 'pass',
    },
  });
  writeJson(fixture.recordPath, {
    ...record,
    ...runtimeStatusProjectionRecordPatch({
      record,
      modelId: 'execution_closure',
      update,
    }),
  });
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
      establishExecutionClosureAuthority(fixture, compiled);
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: fixture.runId,
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
        fixture.runId,
        'rounds.json'
      );
      writeJson(roundsPath, [
        cleanRound(plan, 'r1'),
        cleanRound(plan, 'r2'),
        cleanRound(plan, 'r3'),
      ]);

      const code = mainAuditReviewGate([
        '--requirement-record',
        fixture.recordPath,
        '--attempt-id',
        fixture.runId,
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
      const reportPath = path.join(
        path.dirname(fixture.recordPath),
        'audit-triad',
        fixture.runId,
        'audit-review-report.json'
      );
      const receiptRef = record.runtimeStatusDecisionReceipts.find(
        (entry: { receipt?: { modelId?: string } }) =>
          entry.receipt?.modelId === 'audit_review'
      );
      expect(receiptRef).toBeTruthy();
      const runtimeReceiptPath = path.resolve(
        path.dirname(fixture.recordPath),
        receiptRef.path
      );
      expect(existsSync(reportPath)).toBe(true);
      expect(existsSync(runtimeReceiptPath)).toBe(true);
      const runtimeReceipt = JSON.parse(readFileSync(runtimeReceiptPath, 'utf8'));
      expect(validateRuntimeStatusDecisionReceipt(runtimeReceipt)).toBe(true);
      expect(runtimeReceipt).toMatchObject({
        modelId: 'audit_review',
        implementationAttemptId: fixture.runId,
        stageInputs: [
          {
            role: 'audit_triad_execution_plan',
            path: planPath.replace(/\\/gu, '/'),
            hash: sha256Text(readFileSync(planPath, 'utf8')),
          },
        ],
        deterministicGateOutputs: [
          {
            role: 'audit_review_report',
            path: reportPath.replace(/\\/gu, '/'),
            hash: sha256Text(readFileSync(reportPath, 'utf8')),
          },
        ],
      });
      expect(record.artifactIndex).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            artifactType: 'runtime_status_decision_receipt',
            path: receiptRef.path,
            contentHash: runtimeReceipt.receiptHash,
          }),
          expect.objectContaining({
            artifactType: 'runtime_status_stage_input',
            path: planPath.replace(/\\/gu, '/'),
            contentHash: sha256Text(readFileSync(planPath, 'utf8')),
          }),
          expect.objectContaining({
            artifactType: 'runtime_status_deterministic_gate_output',
            path: reportPath.replace(/\\/gu, '/'),
            contentHash: sha256Text(readFileSync(reportPath, 'utf8')),
          }),
        ])
      );
      const runtimeDecision = resolveSixModelRuntimeDecision({
        record,
        attemptId: fixture.runId,
      });
      expect(
        runtimeDecision.blockingReasonRefs,
        JSON.stringify(runtimeDecision, null, 2)
      ).toEqual([]);
      expect(runtimeDecision.currentModelStatus).toBe('pass');
      expect(runtimeDecision.nextAction).toBe('run_closeout');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('fails closed when the audit report path aliases the execution plan input', () => {
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
      establishExecutionClosureAuthority(fixture, compiled);
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: fixture.runId,
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(
        path.dirname(planPath),
        'rounds.json'
      );
      writeJson(roundsPath, [
        cleanRound(plan, 'r1'),
        cleanRound(plan, 'r2'),
        cleanRound(plan, 'r3'),
      ]);
      const recordBefore = readFileSync(fixture.recordPath, 'utf8');
      const planBefore = readFileSync(planPath, 'utf8');

      expect(() =>
        mainAuditReviewGate([
          '--requirement-record',
          fixture.recordPath,
          '--attempt-id',
          fixture.runId,
          '--plan',
          planPath,
          '--rounds',
          roundsPath,
          '--report-path',
          planPath,
          '--evaluated-at',
          '2026-05-30T12:00:00.000Z',
        ])
      ).toThrow('audit_review_artifact_path_conflict');

      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(recordBefore);
      expect(readFileSync(planPath, 'utf8')).toBe(planBefore);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('fails closed when the execution plan changes before the control commit', () => {
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
      establishExecutionClosureAuthority(fixture, compiled);
      const plan = createAuditTriadExecutionPlan({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        stage: 'implement',
        callPoint: 'audit_review',
        attemptId: fixture.runId,
        sourceDocumentHash: fixture.sourceDocumentHash,
        implementationConfirmationHash: fixture.implementationConfirmationHash,
        modelPacketHash: compiled.compiledPromptRef.modelPacketHash,
        auditReceiptHash: compiled.compiledPromptRef.auditReceiptHash,
        goalExecutionHash: compiled.compiledPromptRef.goalExecutionHash,
      });
      const planPath = writeAuditTriadExecutionPlan(fixture.root, plan);
      const roundsPath = path.join(path.dirname(planPath), 'rounds.json');
      const reportPath = path.join(path.dirname(planPath), 'audit-review-report.json');
      writeJson(roundsPath, [
        cleanRound(plan, 'r1'),
        cleanRound(plan, 'r2'),
        cleanRound(plan, 'r3'),
      ]);
      const recordBefore = readFileSync(fixture.recordPath, 'utf8');

      expect(() =>
        mainAuditReviewGate(
          [
            '--requirement-record',
            fixture.recordPath,
            '--attempt-id',
            fixture.runId,
            '--plan',
            planPath,
            '--rounds',
            roundsPath,
            '--report-path',
            reportPath,
            '--evaluated-at',
            '2026-05-30T12:00:00.000Z',
          ],
          {
            beforeControlCommit: () =>
              writeJson(planPath, {
                ...plan,
                currentEvidenceHash: `sha256:${'9'.repeat(64)}`,
              }),
          }
        )
      ).toThrow('audit_review_input_changed:plan');

      expect(readFileSync(fixture.recordPath, 'utf8')).toBe(recordBefore);
      expect(existsSync(reportPath)).toBe(false);
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
      writeJson(roundsPath, [
        cleanRound(plan, 'r1'),
        cleanRound(plan, 'r2'),
        cleanRound(plan, 'r3'),
      ]);

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
