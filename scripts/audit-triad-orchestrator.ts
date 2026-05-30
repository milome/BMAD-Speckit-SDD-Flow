import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type CriticalAuditorPerspectiveId,
  type CriticalAuditorStageProfileId,
  resolveCriticalAuditorProfile,
  stageProfileForCallPoint,
  validateCriticalAuditorProfileForStage,
} from './critical-auditor-profile';

export interface AuditTriadSubagentPlan {
  agentId: string;
  perspectiveId: CriticalAuditorPerspectiveId;
  model: string;
  reasoningEffort: 'high' | 'xhigh';
  readScope: string[];
  writeScope: string[];
  forbiddenActions: string[];
  reportPath: string;
  requiredCheckItemIds: string[];
  currentHashBinding: Record<string, string>;
}

export interface AuditTriadExecutionPlan {
  schemaVersion: 'audit-triad-execution-plan/v1';
  recordId: string;
  stage: string;
  stageProfileId: CriticalAuditorStageProfileId;
  attemptId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  modelPacketHash?: string | null;
  auditReceiptHash?: string | null;
  goalExecutionHash?: string | null;
  currentAttemptHash: string;
  currentEvidenceHash: string;
  criticalAuditorProfileHash: string;
  criticalAuditorStageProfileHash: string;
  requiredCheckItemSetHash: string;
  subagents: AuditTriadSubagentPlan[];
  roundPolicy: { consecutiveNoGapRoundsRequired: 3 };
  repairPolicy: {
    repairOwner: 'main_agent';
    repairReceiptRequired: true;
    feedbackDispatchRequired: true;
  };
  convergencePolicy: { resetOnHashChange: string[]; staleConvergenceForbidden: true };
}

export interface AuditTriadRoundReceipt {
  schemaVersion: 'audit-triad-round-receipt/v1';
  roundId: string;
  stageProfileId: CriticalAuditorStageProfileId;
  perspectiveResults: Record<
    CriticalAuditorPerspectiveId,
    { agentId: string; validGaps: string[] }
  >;
  coveredCheckItemIds: string[];
  vetoItemResults: Array<{ itemId: string; passed: boolean }>;
  validatedGapRefs: string[];
  invalidGapRefs: string[];
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  modelPacketHash?: string | null;
  auditReceiptHash?: string | null;
  goalExecutionHash?: string | null;
  criticalAuditorProfileHash: string;
  criticalAuditorStageProfileHash: string;
  requiredCheckItemSetHash: string;
  currentAttemptHash: string;
  currentEvidenceHash: string;
  scoreReceiptRefs?: string[];
  runAuditorHostReceiptRefs?: string[];
}

export interface AuditTriadConvergenceDecision {
  ok: boolean;
  blockingReasons: string[];
  convergenceReceipt?: Record<string, unknown>;
}

export const DEFAULT_AUDIT_CURRENT_EVIDENCE_HASH =
  'sha256:c8ed309d65d96bc2341ebb69cb0ab61499f75f4b526ccb79b1c5afe59727e408';

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function sha256Json(value: unknown): string {
  return sha256Text(stableStringify(value));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-') || 'unknown';
}

export function createAuditTriadExecutionPlan(input: {
  projectRoot: string;
  recordId: string;
  stage: string;
  callPoint: string;
  attemptId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  modelPacketHash?: string | null;
  auditReceiptHash?: string | null;
  goalExecutionHash?: string | null;
  currentAttemptHash?: string | null;
  currentEvidenceHash?: string | null;
}): AuditTriadExecutionPlan {
  const profile = resolveCriticalAuditorProfile(input.projectRoot);
  const stageProfileId = stageProfileForCallPoint(input.callPoint);
  const validation = validateCriticalAuditorProfileForStage({ profile, stageProfileId });
  if (!validation.ok || !validation.stageProfile) {
    throw new Error(`audit_triad_profile_invalid:${validation.blockingReasons.join(',')}`);
  }
  const requiredCheckItemSetHash = sha256Json(validation.stageProfile.requiredCheckItemIds);
  const planDir = path.join(
    input.projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    safeSegment(input.recordId),
    'audit-triad',
    safeSegment(input.attemptId)
  );
  const derivedCurrentEvidenceHash =
    input.modelPacketHash && input.auditReceiptHash
      ? sha256Text(
          [
            input.modelPacketHash,
            input.auditReceiptHash,
            input.goalExecutionHash ?? 'no-goal',
          ].join('|')
        )
      : null;
  const hashBinding = {
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    ...(input.modelPacketHash ? { modelPacketHash: input.modelPacketHash } : {}),
    ...(input.auditReceiptHash ? { auditReceiptHash: input.auditReceiptHash } : {}),
    ...(input.goalExecutionHash ? { goalExecutionHash: input.goalExecutionHash } : {}),
    criticalAuditorProfileHash: profile.profileHash,
    criticalAuditorStageProfileHash: validation.stageProfile.stageProfileHash,
    requiredCheckItemSetHash,
    currentAttemptHash: input.currentAttemptHash ?? sha256Text(input.attemptId),
    currentEvidenceHash:
      input.currentEvidenceHash ??
      derivedCurrentEvidenceHash ??
      DEFAULT_AUDIT_CURRENT_EVIDENCE_HASH,
  };
  return {
    schemaVersion: 'audit-triad-execution-plan/v1',
    recordId: input.recordId,
    stage: input.stage,
    stageProfileId,
    attemptId: input.attemptId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    modelPacketHash: input.modelPacketHash ?? null,
    auditReceiptHash: input.auditReceiptHash ?? null,
    goalExecutionHash: input.goalExecutionHash ?? null,
    currentAttemptHash: hashBinding.currentAttemptHash,
    currentEvidenceHash: hashBinding.currentEvidenceHash,
    criticalAuditorProfileHash: profile.profileHash,
    criticalAuditorStageProfileHash: validation.stageProfile.stageProfileHash,
    requiredCheckItemSetHash,
    subagents: (
      [
        'product_intent',
        'model_projection',
        'main_agent_execution',
      ] as CriticalAuditorPerspectiveId[]
    ).map((perspectiveId) => ({
      agentId: `${perspectiveId}-${safeSegment(input.attemptId)}`,
      perspectiveId,
      model: 'gpt-5.4',
      reasoningEffort: 'xhigh',
      readScope: ['docs/**', 'scripts/**', 'tests/**', '_bmad-output/**'],
      writeScope: [
        `_bmad-output/runtime/requirement-records/${safeSegment(input.recordId)}/audit-triad/${safeSegment(input.attemptId)}/reports/**`,
      ],
      forbiddenActions: ['modify_source', 'modify_runtime_state', 'modify_generated_surface'],
      reportPath: path.join(planDir, 'reports', `${perspectiveId}.json`),
      requiredCheckItemIds: validation.stageProfile!.requiredCheckItemIds,
      currentHashBinding: hashBinding,
    })),
    roundPolicy: { consecutiveNoGapRoundsRequired: 3 },
    repairPolicy: {
      repairOwner: 'main_agent',
      repairReceiptRequired: true,
      feedbackDispatchRequired: true,
    },
    convergencePolicy: {
      resetOnHashChange: [
        'sourceDocumentHash',
        'implementationConfirmationHash',
        'modelPacketHash',
        'auditReceiptHash',
        'goalExecutionHash',
        'criticalAuditorProfileHash',
        'criticalAuditorStageProfileHash',
        'requiredCheckItemSetHash',
        'attemptId',
        'currentAttemptHash',
        'currentEvidenceHash',
      ],
      staleConvergenceForbidden: true,
    },
  };
}

export function writeAuditTriadExecutionPlan(
  projectRoot: string,
  plan: AuditTriadExecutionPlan
): string {
  const filePath = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    safeSegment(plan.recordId),
    'audit-triad',
    safeSegment(plan.attemptId),
    'audit-triad-execution-plan.json'
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  return filePath;
}

function same(value: unknown, expected: unknown): boolean {
  return String(value ?? '') === String(expected ?? '');
}

function isSha256Hash(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function currentHashBindingIssues(plan: AuditTriadExecutionPlan): string[] {
  const issues: string[] = [];
  if (!plan.currentAttemptHash) issues.push('audit_triad_plan_current_attempt_hash_missing');
  else if (!isSha256Hash(plan.currentAttemptHash)) {
    issues.push('audit_triad_plan_current_attempt_hash_not_sha256');
  } else if (plan.currentAttemptHash !== sha256Text(plan.attemptId)) {
    issues.push('audit_triad_plan_current_attempt_hash_not_derived');
  }
  if (!plan.currentEvidenceHash) issues.push('audit_triad_plan_current_evidence_hash_missing');
  else if (!isSha256Hash(plan.currentEvidenceHash)) {
    issues.push('audit_triad_plan_current_evidence_hash_not_sha256');
  } else if (plan.currentEvidenceHash === DEFAULT_AUDIT_CURRENT_EVIDENCE_HASH) {
    issues.push('audit_triad_plan_current_evidence_hash_placeholder');
  }
  if (plan.stageProfileId === 'post_implementation_code_audit') {
    if (!plan.modelPacketHash) issues.push('audit_triad_plan_model_packet_hash_missing');
    else if (!isSha256Hash(plan.modelPacketHash)) {
      issues.push('audit_triad_plan_model_packet_hash_not_sha256');
    }
    if (!plan.auditReceiptHash) issues.push('audit_triad_plan_audit_receipt_hash_missing');
    else if (!isSha256Hash(plan.auditReceiptHash)) {
      issues.push('audit_triad_plan_audit_receipt_hash_not_sha256');
    }
    if (plan.goalExecutionHash && !isSha256Hash(plan.goalExecutionHash)) {
      issues.push('audit_triad_plan_goal_execution_hash_not_sha256');
    }
    if (plan.modelPacketHash && plan.auditReceiptHash) {
      const expectedEvidenceHash = sha256Text(
        [plan.modelPacketHash, plan.auditReceiptHash, plan.goalExecutionHash ?? 'no-goal'].join('|')
      );
      if (plan.currentEvidenceHash !== expectedEvidenceHash) {
        issues.push('audit_triad_plan_current_evidence_hash_not_derived');
      }
    }
  }
  return issues;
}

export function evaluateAuditTriadConvergence(input: {
  plan: AuditTriadExecutionPlan;
  rounds: AuditTriadRoundReceipt[];
  repairReceiptRefs?: string[];
  repairFeedbackDispatchRefs?: string[];
  scoreReceiptRequired?: boolean;
  runAuditorHostReceiptRequired?: boolean;
}): AuditTriadConvergenceDecision {
  const blockers: string[] = [];
  blockers.push(...currentHashBindingIssues(input.plan));
  const rounds = input.rounds.slice(-input.plan.roundPolicy.consecutiveNoGapRoundsRequired);
  if (rounds.length !== input.plan.roundPolicy.consecutiveNoGapRoundsRequired) {
    blockers.push('audit_triad_three_rounds_missing');
  }
  for (const [index, round] of rounds.entries()) {
    const prefix = `round_${index + 1}`;
    if (round.stageProfileId !== input.plan.stageProfileId)
      blockers.push(`${prefix}_stage_profile_mismatch`);
    for (const perspective of [
      'product_intent',
      'model_projection',
      'main_agent_execution',
    ] as CriticalAuditorPerspectiveId[]) {
      if (!round.perspectiveResults[perspective])
        blockers.push(`${prefix}_perspective_missing:${perspective}`);
    }
    const agentIds = Object.values(round.perspectiveResults).map((result) => result.agentId);
    if (new Set(agentIds).size !== agentIds.length) blockers.push(`${prefix}_duplicate_agent`);
    for (const item of input.plan.subagents[0]?.requiredCheckItemIds ?? []) {
      if (!round.coveredCheckItemIds.includes(item))
        blockers.push(`${prefix}_check_item_missing:${item}`);
    }
    if (round.validatedGapRefs.length > 0) blockers.push(`${prefix}_validated_gap_unresolved`);
    if (round.vetoItemResults.some((item) => item.passed !== true))
      blockers.push(`${prefix}_veto_failed`);
    if (!same(round.sourceDocumentHash, input.plan.sourceDocumentHash))
      blockers.push(`${prefix}_source_hash_mismatch`);
    if (!same(round.implementationConfirmationHash, input.plan.implementationConfirmationHash))
      blockers.push(`${prefix}_confirmation_hash_mismatch`);
    if (!same(round.modelPacketHash ?? null, input.plan.modelPacketHash ?? null))
      blockers.push(`${prefix}_model_packet_hash_mismatch`);
    if (!same(round.auditReceiptHash ?? null, input.plan.auditReceiptHash ?? null))
      blockers.push(`${prefix}_audit_receipt_hash_mismatch`);
    if (!same(round.goalExecutionHash ?? null, input.plan.goalExecutionHash ?? null))
      blockers.push(`${prefix}_goal_execution_hash_mismatch`);
    if (!same(round.currentAttemptHash, input.plan.currentAttemptHash))
      blockers.push(`${prefix}_current_attempt_hash_mismatch`);
    if (!same(round.currentEvidenceHash, input.plan.currentEvidenceHash))
      blockers.push(`${prefix}_current_evidence_hash_mismatch`);
    if (!same(round.criticalAuditorProfileHash, input.plan.criticalAuditorProfileHash))
      blockers.push(`${prefix}_profile_hash_mismatch`);
    if (!same(round.criticalAuditorStageProfileHash, input.plan.criticalAuditorStageProfileHash))
      blockers.push(`${prefix}_stage_profile_hash_mismatch`);
    if (!same(round.requiredCheckItemSetHash, input.plan.requiredCheckItemSetHash))
      blockers.push(`${prefix}_check_item_set_hash_mismatch`);
    if (
      input.scoreReceiptRequired &&
      (!round.scoreReceiptRefs || round.scoreReceiptRefs.length === 0)
    ) {
      blockers.push(`${prefix}_score_receipt_missing`);
    }
    if (
      input.runAuditorHostReceiptRequired &&
      (!round.runAuditorHostReceiptRefs || round.runAuditorHostReceiptRefs.length === 0)
    ) {
      blockers.push(`${prefix}_run_auditor_host_receipt_missing`);
    }
  }
  const allValidatedGaps = input.rounds.flatMap((round) => round.validatedGapRefs);
  if (allValidatedGaps.length > 0) {
    if ((input.repairReceiptRefs ?? []).length === 0)
      blockers.push('main_agent_repair_receipt_missing');
    if ((input.repairFeedbackDispatchRefs ?? []).length === 0)
      blockers.push('repair_feedback_dispatch_missing');
  }
  if (blockers.length > 0) {
    return { ok: false, blockingReasons: Array.from(new Set(blockers)) };
  }
  return {
    ok: true,
    blockingReasons: [],
    convergenceReceipt: {
      schemaVersion: 'audit-triad-convergence-receipt/v1',
      recordId: input.plan.recordId,
      attemptId: input.plan.attemptId,
      stageProfileId: input.plan.stageProfileId,
      roundIds: rounds.map((round) => round.roundId),
      criticalAuditorProfileHash: input.plan.criticalAuditorProfileHash,
      criticalAuditorStageProfileHash: input.plan.criticalAuditorStageProfileHash,
      requiredCheckItemSetHash: input.plan.requiredCheckItemSetHash,
      auditReceiptHash: input.plan.auditReceiptHash ?? null,
      goalExecutionHash: input.plan.goalExecutionHash ?? null,
      currentAttemptHash: input.plan.currentAttemptHash,
      currentEvidenceHash: input.plan.currentEvidenceHash,
      validNoGapRounds: rounds.length,
    },
  };
}
