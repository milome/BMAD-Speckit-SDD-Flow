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
import { readGovernanceRemediationConfig } from './governance-remediation-config';
import {
  buildCriticalAuditorJudgeRuntimeBinding,
  type CriticalAuditorIndependentProviderEvidence,
  type CriticalAuditorIndependentProviderExpectation,
  type CriticalAuditorJudgeRuntimeBinding,
  validateCriticalAuditorIndependentProviderEvidence,
} from './requirements-contract-critical-auditor-independence';

export const AUDIT_PROJECTION_QUALITY_RULE_CODES = [
  'projection_per_must_acceptance_not_independent',
  'projection_shared_evidence_without_per_must_oracle',
  'required_command_all_cover_all_without_per_must_assertions',
  'target_modification_path_all_cover_all',
  'current_target_map_not_product_specific',
  'business_visual_generic_or_compressed',
] as const;

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
  auditEpochId: string;
  auditTargetBundleHash: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  implementationConfirmationHash: string;
  projectionSetHash: string;
  checkedProjectionQualityRuleCodes: string[];
  qualityRuleSetHash: string;
  modelPacketHash?: string | null;
  auditReceiptHash?: string | null;
  goalExecutionHash?: string | null;
  currentAttemptHash: string;
  currentEvidenceHash: string;
  criticalAuditorProfileHash: string;
  criticalAuditorStageProfileHash: string;
  requiredCheckItemSetHash: string;
  vetoItemIds: string[];
  priorRepairReceiptRefs: Array<{ path: string; contentHash: string }>;
  independentProviderBinding: CriticalAuditorJudgeRuntimeBinding;
  subagents: AuditTriadSubagentPlan[];
  roundPolicy: { consecutiveNoGapRoundsRequired: 3 };
  repairPolicy: {
    repairOwner: 'main_agent';
    repairReceiptRequired: true;
    feedbackDispatchRequired: true;
  };
  convergencePolicy: { resetOnHashChange: string[]; staleConvergenceForbidden: true };
}

export type AuditTriadJudgeVerdict =
  | 'no_new_valid_gap'
  | 'no_new_confirmation_blocking_gap'
  | 'new_valid_gap'
  | 'insufficient_audit'
  | 'blocked';

export interface AuditTriadBoundReceiptRef {
  path: string;
  contentHash: string;
  receiptHash: string;
}

export interface AuditTriadRoundReceipt {
  schemaVersion: 'audit-triad-round-receipt/v1';
  roundId: string;
  verdict: AuditTriadJudgeVerdict;
  stageProfileId: CriticalAuditorStageProfileId;
  auditEpochId: string;
  auditTargetBundleHash: string;
  perspectiveResults: Record<
    CriticalAuditorPerspectiveId,
    { agentId: string; validGaps: string[] }
  >;
  coveredCheckItemIds: string[];
  vetoItemResults: Array<{ itemId: string; passed: boolean }>;
  validatedGapRefs: string[];
  invalidGapRefs: string[];
  sourceDocumentHash: string;
  semanticModelHash: string;
  implementationConfirmationHash: string;
  projectionSetHash: string;
  checkedProjectionQualityRuleCodes: string[];
  qualityRuleSetHash: string;
  modelPacketHash?: string | null;
  auditReceiptHash?: string | null;
  goalExecutionHash?: string | null;
  criticalAuditorProfileHash: string;
  criticalAuditorStageProfileHash: string;
  requiredCheckItemSetHash: string;
  currentAttemptHash: string;
  currentEvidenceHash: string;
  criticalAuditorRequestHash: string;
  independentProviderEvidence?: CriticalAuditorIndependentProviderEvidence;
  judgeExecutionReceiptRef?: AuditTriadBoundReceiptRef;
  readonlyAuditorHostInvocationReceiptRef?: AuditTriadBoundReceiptRef;
  scoreReceiptRefs?: string[];
  runAuditorHostReceiptRefs?: string[];
}

export interface AuditTriadConvergenceDecision {
  ok: boolean;
  blockingReasons: string[];
  convergenceReceipt?: Record<string, unknown>;
}

export interface AuditTriadRepairEvidenceBinding {
  schemaVersion: 'audit-triad-repair-evidence-binding/v1';
  repairReceiptRefs: Array<{
    path: string;
    contentHash: string;
    receiptHash: string;
    remediationPacketId: string;
    feedbackDispatchRef: {
      path: string;
      contentHash: string;
      dispatchHash: string;
    };
  }>;
  repairFeedbackDispatchRefs: Array<{
    path: string;
    contentHash: string;
    dispatchHash: string;
  }>;
  evidenceSetHash: string;
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
  semanticModelHash: string;
  implementationConfirmationHash: string;
  projectionSetHash: string;
  modelPacketHash?: string | null;
  auditReceiptHash?: string | null;
  goalExecutionHash?: string | null;
  currentAttemptHash?: string | null;
  currentEvidenceHash?: string | null;
  priorRepairReceiptRefs?: Array<{ path: string; contentHash: string }>;
}): AuditTriadExecutionPlan {
  const profile = resolveCriticalAuditorProfile(input.projectRoot);
  const stageProfileId = stageProfileForCallPoint(input.callPoint);
  const validation = validateCriticalAuditorProfileForStage({ profile, stageProfileId });
  if (!validation.ok || !validation.stageProfile) {
    throw new Error(`audit_triad_profile_invalid:${validation.blockingReasons.join(',')}`);
  }
  const requiredCheckItemSetHash = sha256Json(validation.stageProfile.requiredCheckItemIds);
  const vetoItemIds = [...validation.stageProfile.vetoItemIds].sort();
  const qualityRuleCodes = [...AUDIT_PROJECTION_QUALITY_RULE_CODES].sort();
  const qualityRuleSetHash = sha256Json(qualityRuleCodes);
  const priorRepairReceiptRefs = [...(input.priorRepairReceiptRefs ?? [])];
  const judgeRuntime = readGovernanceRemediationConfig(input.projectRoot).judgeRuntime;
  const providerBinding = buildCriticalAuditorJudgeRuntimeBinding(judgeRuntime);
  if (!providerBinding.binding || providerBinding.issueCodes.length > 0) {
    throw new Error(
      `audit_triad_judge_binding_invalid:${providerBinding.issueCodes.join(',') || 'judge_runtime_missing'}`
    );
  }
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
    semanticModelHash: input.semanticModelHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    projectionSetHash: input.projectionSetHash,
    qualityRuleSetHash,
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
    priorRepairReceiptSetHash: sha256Json(priorRepairReceiptRefs),
  };
  const auditTargetBundleHash = sha256Json({
    sourceDocumentHash: input.sourceDocumentHash,
    semanticModelHash: input.semanticModelHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    projectionSetHash: input.projectionSetHash,
    checkedProjectionQualityRuleCodes: qualityRuleCodes,
    qualityRuleSetHash,
    modelPacketHash: input.modelPacketHash ?? null,
    auditReceiptHash: input.auditReceiptHash ?? null,
    goalExecutionHash: input.goalExecutionHash ?? null,
    vetoItemIds,
    priorRepairReceiptRefs,
  });
  const auditEpochId = sha256Json({
    recordId: input.recordId,
    stage: input.stage,
    stageProfileId,
    attemptId: input.attemptId,
    auditTargetBundleHash,
    criticalAuditorProfileHash: profile.profileHash,
    criticalAuditorStageProfileHash: validation.stageProfile.stageProfileHash,
    requiredCheckItemSetHash,
    vetoItemIds,
    priorRepairReceiptRefs,
    independentProviderBinding: providerBinding.binding,
  });
  Object.assign(hashBinding, { auditEpochId, auditTargetBundleHash });
  return {
    schemaVersion: 'audit-triad-execution-plan/v1',
    recordId: input.recordId,
    stage: input.stage,
    stageProfileId,
    attemptId: input.attemptId,
    auditEpochId,
    auditTargetBundleHash,
    sourceDocumentHash: input.sourceDocumentHash,
    semanticModelHash: input.semanticModelHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    projectionSetHash: input.projectionSetHash,
    checkedProjectionQualityRuleCodes: qualityRuleCodes,
    qualityRuleSetHash,
    modelPacketHash: input.modelPacketHash ?? null,
    auditReceiptHash: input.auditReceiptHash ?? null,
    goalExecutionHash: input.goalExecutionHash ?? null,
    currentAttemptHash: hashBinding.currentAttemptHash,
    currentEvidenceHash: hashBinding.currentEvidenceHash,
    criticalAuditorProfileHash: profile.profileHash,
    criticalAuditorStageProfileHash: validation.stageProfile.stageProfileHash,
    requiredCheckItemSetHash,
    vetoItemIds,
    priorRepairReceiptRefs,
    independentProviderBinding: providerBinding.binding,
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
        'semanticModelHash',
        'implementationConfirmationHash',
        'projectionSetHash',
        'qualityRuleSetHash',
        'modelPacketHash',
        'auditReceiptHash',
        'goalExecutionHash',
        'criticalAuditorProfileHash',
        'criticalAuditorStageProfileHash',
        'requiredCheckItemSetHash',
        'attemptId',
        'currentAttemptHash',
        'currentEvidenceHash',
        'auditTargetBundleHash',
        'auditEpochId',
      ],
      staleConvergenceForbidden: true,
    },
  };
}

export function writeAuditTriadExecutionPlan(
  projectRoot: string,
  plan: AuditTriadExecutionPlan,
  options: { recordPath?: string } = {}
): string {
  const recordRoot = options.recordPath
    ? path.dirname(path.resolve(options.recordPath))
    : path.join(
        projectRoot,
        '_bmad-output',
        'runtime',
        'requirement-records',
        safeSegment(plan.recordId)
      );
  const filePath = path.join(
    recordRoot,
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
  for (const [field, value] of [
    ['semantic_model', plan.semanticModelHash],
    ['projection_set', plan.projectionSetHash],
    ['quality_rule_set', plan.qualityRuleSetHash],
    ['audit_target_bundle', plan.auditTargetBundleHash],
    ['audit_epoch', plan.auditEpochId],
  ] as const) {
    if (!isSha256Hash(value)) issues.push(`audit_triad_plan_${field}_hash_invalid`);
  }
  const expectedQualityRuleCodes = [...AUDIT_PROJECTION_QUALITY_RULE_CODES].sort();
  if (
    stableStringify(plan.checkedProjectionQualityRuleCodes) !==
    stableStringify(expectedQualityRuleCodes)
  ) {
    issues.push('audit_triad_plan_projection_quality_rule_codes_mismatch');
  }
  if (plan.qualityRuleSetHash !== sha256Json(expectedQualityRuleCodes)) {
    issues.push('audit_triad_plan_quality_rule_set_hash_not_derived');
  }
  const expectedTargetBundleHash = sha256Json({
    sourceDocumentHash: plan.sourceDocumentHash,
    semanticModelHash: plan.semanticModelHash,
    implementationConfirmationHash: plan.implementationConfirmationHash,
    projectionSetHash: plan.projectionSetHash,
    checkedProjectionQualityRuleCodes: plan.checkedProjectionQualityRuleCodes,
    qualityRuleSetHash: plan.qualityRuleSetHash,
    modelPacketHash: plan.modelPacketHash ?? null,
    auditReceiptHash: plan.auditReceiptHash ?? null,
    goalExecutionHash: plan.goalExecutionHash ?? null,
    vetoItemIds: plan.vetoItemIds,
    priorRepairReceiptRefs: plan.priorRepairReceiptRefs,
  });
  if (plan.auditTargetBundleHash !== expectedTargetBundleHash) {
    issues.push('audit_triad_plan_audit_target_bundle_hash_not_derived');
  }
  const expectedAuditEpochId = sha256Json({
    recordId: plan.recordId,
    stage: plan.stage,
    stageProfileId: plan.stageProfileId,
    attemptId: plan.attemptId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    vetoItemIds: plan.vetoItemIds,
    priorRepairReceiptRefs: plan.priorRepairReceiptRefs,
    independentProviderBinding: plan.independentProviderBinding,
  });
  if (plan.auditEpochId !== expectedAuditEpochId) {
    issues.push('audit_triad_plan_audit_epoch_id_not_derived');
  }
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

function repairEvidenceBindingIssues(
  plan: AuditTriadExecutionPlan,
  evidence: AuditTriadRepairEvidenceBinding
): string[] {
  const issues: string[] = [];
  const { evidenceSetHash, ...evidenceWithoutHash } = evidence;
  if (evidence.schemaVersion !== 'audit-triad-repair-evidence-binding/v1') {
    issues.push('audit_repair_evidence_schema_invalid');
  }
  if (evidenceSetHash !== sha256Json(evidenceWithoutHash)) {
    issues.push('audit_repair_evidence_set_hash_mismatch');
  }
  const receiptPaths = evidence.repairReceiptRefs.map((ref) => ref.path);
  const dispatchPaths = evidence.repairFeedbackDispatchRefs.map((ref) => ref.path);
  if (new Set(receiptPaths).size !== receiptPaths.length) {
    issues.push('audit_repair_evidence_receipt_path_duplicate');
  }
  if (new Set(dispatchPaths).size !== dispatchPaths.length) {
    issues.push('audit_repair_evidence_feedback_path_duplicate');
  }
  for (const ref of evidence.repairReceiptRefs) {
    if (
      !ref.path ||
      !ref.remediationPacketId ||
      !isSha256Hash(ref.contentHash) ||
      !isSha256Hash(ref.receiptHash) ||
      !ref.feedbackDispatchRef.path ||
      !isSha256Hash(ref.feedbackDispatchRef.contentHash) ||
      !isSha256Hash(ref.feedbackDispatchRef.dispatchHash)
    ) {
      issues.push('audit_repair_evidence_receipt_ref_invalid');
    }
  }
  for (const ref of evidence.repairFeedbackDispatchRefs) {
    if (
      !ref.path ||
      !isSha256Hash(ref.contentHash) ||
      !isSha256Hash(ref.dispatchHash)
    ) {
      issues.push('audit_repair_evidence_feedback_ref_invalid');
    }
  }
  const planReceiptRefs = plan.priorRepairReceiptRefs.map((ref) => ({
    path: ref.path,
    contentHash: ref.contentHash,
  }));
  const evidenceReceiptRefs = evidence.repairReceiptRefs.map((ref) => ({
    path: ref.path,
    contentHash: ref.contentHash,
  }));
  if (stableStringify(evidenceReceiptRefs) !== stableStringify(planReceiptRefs)) {
    issues.push('audit_repair_evidence_plan_receipt_refs_mismatch');
  }
  const receiptFeedbackRefs = evidence.repairReceiptRefs.map((ref) => ref.feedbackDispatchRef);
  if (
    stableStringify(evidence.repairFeedbackDispatchRefs) !==
    stableStringify(receiptFeedbackRefs)
  ) {
    issues.push('audit_repair_evidence_feedback_refs_mismatch');
  }
  return Array.from(new Set(issues));
}

export function evaluateAuditTriadConvergence(input: {
  plan: AuditTriadExecutionPlan;
  rounds: AuditTriadRoundReceipt[];
  repairReceiptRefs?: string[];
  repairFeedbackDispatchRefs?: string[];
  repairEvidence?: AuditTriadRepairEvidenceBinding;
  scoreReceiptRequired?: boolean;
  runAuditorHostReceiptRequired?: boolean;
}): AuditTriadConvergenceDecision {
  const blockers: string[] = [];
  blockers.push(...currentHashBindingIssues(input.plan));
  const rounds = input.rounds.slice(-input.plan.roundPolicy.consecutiveNoGapRoundsRequired);
  const seenRoundIds = new Set<string>();
  const seenRequestHashes = new Set<string>();
  const seenProviderRunIds = new Set<string>();
  const seenJudgeReceiptHashes = new Set<string>();
  const seenReadonlyHostReceiptHashes = new Set<string>();
  if (rounds.length !== input.plan.roundPolicy.consecutiveNoGapRoundsRequired) {
    blockers.push('audit_triad_three_rounds_missing');
  }
  for (const [index, round] of rounds.entries()) {
    const prefix = `round_${index + 1}`;
    const roundId = typeof round.roundId === 'string' ? round.roundId.trim() : '';
    if (!roundId) {
      blockers.push(`${prefix}_round_id_missing`);
    } else if (seenRoundIds.has(roundId)) {
      blockers.push(`${prefix}_round_id_replayed`);
    } else {
      seenRoundIds.add(roundId);
    }
    const verdict = typeof round.verdict === 'string' ? round.verdict.trim() : '';
    if (!verdict) {
      blockers.push(`${prefix}_judge_verdict_missing`);
    } else if (
      verdict !== 'no_new_valid_gap' &&
      verdict !== 'no_new_confirmation_blocking_gap' &&
      verdict !== 'new_valid_gap' &&
      verdict !== 'insufficient_audit' &&
      verdict !== 'blocked'
    ) {
      blockers.push(`${prefix}_judge_verdict_unknown:${verdict}`);
    } else if (
      verdict !== 'no_new_valid_gap' &&
      verdict !== 'no_new_confirmation_blocking_gap'
    ) {
      blockers.push(`${prefix}_judge_verdict_not_convergent:${verdict}`);
    }
    if (round.stageProfileId !== input.plan.stageProfileId)
      blockers.push(`${prefix}_stage_profile_mismatch`);
    if (!same(round.auditEpochId, input.plan.auditEpochId))
      blockers.push(`${prefix}_audit_epoch_mismatch`);
    if (!same(round.auditTargetBundleHash, input.plan.auditTargetBundleHash))
      blockers.push(`${prefix}_audit_target_bundle_hash_mismatch`);
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
    const vetoItemResults = Array.isArray(round.vetoItemResults)
      ? round.vetoItemResults
      : [];
    const seenVetoItemIds = new Set<string>();
    for (const result of vetoItemResults) {
      const itemId = typeof result?.itemId === 'string' ? result.itemId.trim() : '';
      if (!itemId) {
        blockers.push(`${prefix}_veto_item_id_missing`);
        continue;
      }
      if (seenVetoItemIds.has(itemId)) {
        blockers.push(`${prefix}_veto_item_duplicate:${itemId}`);
        continue;
      }
      seenVetoItemIds.add(itemId);
      if (!input.plan.vetoItemIds.includes(itemId)) {
        blockers.push(`${prefix}_veto_item_unknown:${itemId}`);
      }
      if (result.passed !== true) {
        blockers.push(`${prefix}_veto_item_failed:${itemId}`);
      }
    }
    for (const itemId of input.plan.vetoItemIds) {
      if (!seenVetoItemIds.has(itemId)) {
        blockers.push(`${prefix}_veto_item_missing:${itemId}`);
      }
    }
    if (!same(round.sourceDocumentHash, input.plan.sourceDocumentHash))
      blockers.push(`${prefix}_source_hash_mismatch`);
    if (!same(round.semanticModelHash, input.plan.semanticModelHash))
      blockers.push(`${prefix}_semantic_model_hash_mismatch`);
    if (!same(round.implementationConfirmationHash, input.plan.implementationConfirmationHash))
      blockers.push(`${prefix}_confirmation_hash_mismatch`);
    if (!same(round.projectionSetHash, input.plan.projectionSetHash))
      blockers.push(`${prefix}_projection_set_hash_mismatch`);
    if (!same(round.qualityRuleSetHash, input.plan.qualityRuleSetHash))
      blockers.push(`${prefix}_quality_rule_set_hash_mismatch`);
    if (
      stableStringify(round.checkedProjectionQualityRuleCodes) !==
      stableStringify(input.plan.checkedProjectionQualityRuleCodes)
    ) {
      blockers.push(`${prefix}_projection_quality_rule_codes_mismatch`);
    }
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
    if (!isSha256Hash(round.criticalAuditorRequestHash)) {
      blockers.push(`${prefix}_critical_auditor_request_hash_invalid`);
    } else if (seenRequestHashes.has(round.criticalAuditorRequestHash)) {
      blockers.push(`${prefix}_critical_auditor_request_hash_replayed`);
    } else {
      seenRequestHashes.add(round.criticalAuditorRequestHash);
    }
    if (!round.independentProviderEvidence) {
      blockers.push(`${prefix}_independent_provider_evidence_missing`);
    } else if (isSha256Hash(round.criticalAuditorRequestHash)) {
      const providerRunId =
        typeof round.independentProviderEvidence.providerRunId === 'string'
          ? round.independentProviderEvidence.providerRunId.trim()
          : '';
      if (!providerRunId) {
        blockers.push(`${prefix}_provider_run_id_missing`);
      } else if (seenProviderRunIds.has(providerRunId)) {
        blockers.push(`${prefix}_provider_run_id_replayed`);
      } else {
        seenProviderRunIds.add(providerRunId);
      }
      const expectedProviderEvidence: CriticalAuditorIndependentProviderExpectation = {
        ...input.plan.independentProviderBinding,
        transactionId: input.plan.auditEpochId,
        auditAttemptId: input.plan.attemptId,
        requestHash: round.criticalAuditorRequestHash,
        sourceDocumentHash: input.plan.sourceDocumentHash,
        semanticModelHash: input.plan.semanticModelHash,
        projectionSetHash: input.plan.projectionSetHash,
      };
      const providerValidation = validateCriticalAuditorIndependentProviderEvidence({
        expected: expectedProviderEvidence,
        evidence: round.independentProviderEvidence,
      });
      for (const issueCode of providerValidation.issueCodes) {
        blockers.push(`${prefix}_independent_provider_evidence_invalid:${issueCode}`);
      }
    }
    const judgeReceiptRef = round.judgeExecutionReceiptRef;
    if (input.scoreReceiptRequired) {
      if (!judgeReceiptRef) {
        blockers.push(`${prefix}_judge_execution_receipt_ref_missing`);
      } else {
        if (!judgeReceiptRef.path?.trim()) {
          blockers.push(`${prefix}_judge_execution_receipt_path_missing`);
        }
        if (!isSha256Hash(judgeReceiptRef.contentHash)) {
          blockers.push(`${prefix}_judge_execution_receipt_content_hash_invalid`);
        } else if (seenJudgeReceiptHashes.has(judgeReceiptRef.contentHash)) {
          blockers.push(`${prefix}_judge_receipt_hash_replayed`);
        } else {
          seenJudgeReceiptHashes.add(judgeReceiptRef.contentHash);
        }
        if (!isSha256Hash(judgeReceiptRef.receiptHash)) {
          blockers.push(`${prefix}_judge_execution_receipt_self_hash_invalid`);
        }
      }
      const scoreReceiptRefs = (round.scoreReceiptRefs ?? [])
        .map((receiptPath) => receiptPath.trim())
        .filter(Boolean);
      if (scoreReceiptRefs.length === 0) {
        blockers.push(`${prefix}_score_receipt_ref_missing`);
      }
      if (
        judgeReceiptRef?.path?.trim() &&
        scoreReceiptRefs.includes(judgeReceiptRef.path.trim())
      ) {
        blockers.push(`${prefix}_score_receipt_role_invalid`);
      }
    }
    const readonlyHostReceiptRef = round.readonlyAuditorHostInvocationReceiptRef;
    if (input.runAuditorHostReceiptRequired) {
      if (!readonlyHostReceiptRef) {
        blockers.push(`${prefix}_readonly_host_invocation_receipt_ref_missing`);
      } else {
        if (!readonlyHostReceiptRef.path?.trim()) {
          blockers.push(`${prefix}_readonly_host_invocation_receipt_path_missing`);
        }
        if (!isSha256Hash(readonlyHostReceiptRef.contentHash)) {
          blockers.push(`${prefix}_readonly_host_invocation_receipt_content_hash_invalid`);
        } else if (seenReadonlyHostReceiptHashes.has(readonlyHostReceiptRef.contentHash)) {
          blockers.push(`${prefix}_readonly_host_receipt_hash_replayed`);
        } else {
          seenReadonlyHostReceiptHashes.add(readonlyHostReceiptRef.contentHash);
        }
        if (!isSha256Hash(readonlyHostReceiptRef.receiptHash)) {
          blockers.push(`${prefix}_readonly_host_invocation_receipt_self_hash_invalid`);
        }
      }
      const runAuditorHostReceiptRefs = (round.runAuditorHostReceiptRefs ?? [])
        .map((receiptPath) => receiptPath.trim())
        .filter(Boolean);
      if (runAuditorHostReceiptRefs.length === 0) {
        blockers.push(`${prefix}_run_auditor_host_receipt_ref_missing`);
      }
      if (
        readonlyHostReceiptRef?.path?.trim() &&
        runAuditorHostReceiptRefs.includes(readonlyHostReceiptRef.path.trim())
      ) {
        blockers.push(`${prefix}_run_auditor_host_receipt_role_invalid`);
      }
    }
  }
  const allValidatedGaps = input.rounds.flatMap((round) => round.validatedGapRefs);
  const repairEvidenceRequired =
    allValidatedGaps.length > 0 || input.plan.priorRepairReceiptRefs.length > 0;
  if (repairEvidenceRequired) {
    const receiptRefsSupplied =
      (input.repairReceiptRefs ?? []).length > 0 ||
      (input.repairEvidence?.repairReceiptRefs.length ?? 0) > 0;
    const feedbackRefsSupplied =
      (input.repairFeedbackDispatchRefs ?? []).length > 0 ||
      (input.repairEvidence?.repairFeedbackDispatchRefs.length ?? 0) > 0;
    if (!receiptRefsSupplied)
      blockers.push('main_agent_repair_receipt_missing');
    if (!feedbackRefsSupplied)
      blockers.push('repair_feedback_dispatch_missing');
    if (!input.repairEvidence) {
      blockers.push('audit_repair_evidence_not_validated');
    } else {
      blockers.push(...repairEvidenceBindingIssues(input.plan, input.repairEvidence));
    }
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
      auditEpochId: input.plan.auditEpochId,
      auditTargetBundleHash: input.plan.auditTargetBundleHash,
      stageProfileId: input.plan.stageProfileId,
      semanticModelHash: input.plan.semanticModelHash,
      projectionSetHash: input.plan.projectionSetHash,
      qualityRuleSetHash: input.plan.qualityRuleSetHash,
      roundIds: rounds.map((round) => round.roundId),
      criticalAuditorProfileHash: input.plan.criticalAuditorProfileHash,
      criticalAuditorStageProfileHash: input.plan.criticalAuditorStageProfileHash,
      requiredCheckItemSetHash: input.plan.requiredCheckItemSetHash,
      auditReceiptHash: input.plan.auditReceiptHash ?? null,
      goalExecutionHash: input.plan.goalExecutionHash ?? null,
      currentAttemptHash: input.plan.currentAttemptHash,
      currentEvidenceHash: input.plan.currentEvidenceHash,
      validNoGapRounds: rounds.length,
      repairEvidence:
        input.repairEvidence && repairEvidenceRequired
          ? {
              repairReceiptRefs: input.repairEvidence.repairReceiptRefs,
              repairFeedbackDispatchRefs: input.repairEvidence.repairFeedbackDispatchRefs,
              evidenceSetHash: input.repairEvidence.evidenceSetHash,
            }
          : null,
    },
  };
}
