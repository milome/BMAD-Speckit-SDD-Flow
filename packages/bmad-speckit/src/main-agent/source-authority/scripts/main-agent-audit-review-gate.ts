/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  evaluateAuditTriadConvergence,
  sha256Json as sha256AuditTriadJson,
  type AuditTriadExecutionPlan,
  type AuditTriadRepairEvidenceBinding,
  type AuditTriadRoundReceipt,
} from './audit-triad-orchestrator';
import {
  appendControlEventAndReplay,
  canonicalizeRequirementRecord,
  sha256Json,
  sha256Text,
} from './requirement-record-control-store';
import { openReconfirmationRequests } from './reconfirmation-runtime';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionArtifactWrites,
  runtimeStatusProjectionRecordPatch,
  type RuntimeStatusProjectionUpdate,
} from './requirements-contract-runtime-status-decision-receipt';
import { resolveVerifiedSixModelStatus } from './verified-six-model-status-facade';
import { validateSourcePrdLintTransitionFromFiles } from './requirements-contract-validation-facade';

type JsonObject = Record<string, unknown>;
type AuditReviewDecision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  attemptId?: string;
  plan?: string;
  rounds?: string;
  round?: string[];
  repairReceipt?: string[];
  repairFeedbackDispatch?: string[];
  reportPath?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  json?: boolean;
  help?: boolean;
}

interface MainAuditReviewGateDeps {
  beforeControlCommit?: () => void;
  writeOutput?: (value: string) => void;
}

function isDirectMainAgentAuditReviewGateCli(entry: string | undefined): boolean {
  return /(^|[\\/])main-agent-audit-review-gate(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { round: [], repairReceipt: [], repairFeedbackDispatch: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const key = arg
        .slice(2)
        .replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase()) as keyof ParsedArgs;
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (key === 'round' || key === 'repairReceipt' || key === 'repairFeedbackDispatch') {
        (out[key] as string[]).push(value);
      } else {
        (out as Record<string, string | string[] | boolean | undefined>)[key] = value;
      }
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nested(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function readJsonSnapshot(file: string): {
  value: JsonObject;
  contentHash: string;
} {
  const content = fs.readFileSync(file);
  const parsed = JSON.parse(content.toString('utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return {
    value: parsed as JsonObject,
    contentHash: `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`,
  };
}

function readJsonArray(file: string): JsonObject[] {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (Array.isArray(parsed)) return parsed as JsonObject[];
  if (parsed && typeof parsed === 'object') {
    const wrapped = parsed as JsonObject;
    const rounds = objects(wrapped.rounds);
    return rounds.length > 0 ? rounds : [wrapped];
  }
  throw new Error(`JSON object or array expected: ${file}`);
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

interface FrozenAuditRepairInput {
  role: string;
  path: string;
  contentHash: string;
}

interface AuditRepairEvidenceValidation {
  binding: AuditTriadRepairEvidenceBinding | null;
  issueCodes: string[];
  frozenInputs: FrozenAuditRepairInput[];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function artifactRefs(value: unknown): Array<{ path: string; contentHash: string }> {
  return objects(value)
    .map((item) => ({
      path: text(item.path),
      contentHash: text(item.contentHash),
    }))
    .filter((ref) => ref.path || ref.contentHash);
}

function projectRootFromRecordPath(recordPath: string): string {
  let current = path.dirname(path.resolve(recordPath));
  for (;;) {
    if (path.basename(current) === '_bmad-output') {
      return path.dirname(current);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('audit_review_project_root_not_derivable');
    }
    current = parent;
  }
}

function resolveProjectArtifactPath(projectRoot: string, artifactPath: string): string {
  const resolved = path.isAbsolute(artifactPath)
    ? path.resolve(artifactPath)
    : path.resolve(projectRoot, artifactPath);
  const relative = path.relative(projectRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('audit_review_repair_artifact_outside_project');
  }
  return resolved;
}

function projectRelativeArtifactPath(projectRoot: string, artifactPath: string): string {
  return normalizePathForRecord(path.relative(projectRoot, artifactPath));
}

function sameJson(left: unknown, right: unknown): boolean {
  return sha256AuditTriadJson(left) === sha256AuditTriadJson(right);
}

function validateAuditRepairEvidence(input: {
  recordPath: string;
  record: JsonObject;
  plan: AuditTriadExecutionPlan;
  repairReceiptPaths: string[];
  repairFeedbackDispatchPaths: string[];
}): AuditRepairEvidenceValidation {
  const projectRoot = projectRootFromRecordPath(input.recordPath);
  if (
    input.plan.priorRepairReceiptRefs.length === 0 &&
    input.repairReceiptPaths.length === 0 &&
    input.repairFeedbackDispatchPaths.length === 0
  ) {
    return { binding: null, issueCodes: [], frozenInputs: [] };
  }
  const issueCodes: string[] = [];
  const frozenInputs: FrozenAuditRepairInput[] = [];
  const resolvedReceiptPaths = input.repairReceiptPaths.map((item) => path.resolve(item));
  const resolvedFeedbackPaths = input.repairFeedbackDispatchPaths.map((item) =>
    path.resolve(item)
  );
  const suppliedReceiptByIdentity = new Map(
    resolvedReceiptPaths.map((item) => [physicalPathIdentity(item), item])
  );
  const suppliedFeedbackByIdentity = new Map(
    resolvedFeedbackPaths.map((item) => [physicalPathIdentity(item), item])
  );
  if (suppliedReceiptByIdentity.size !== resolvedReceiptPaths.length) {
    issueCodes.push('audit_repair_receipt_path_duplicate');
  }
  if (suppliedFeedbackByIdentity.size !== resolvedFeedbackPaths.length) {
    issueCodes.push('audit_repair_feedback_path_duplicate');
  }
  if (resolvedReceiptPaths.length !== input.plan.priorRepairReceiptRefs.length) {
    issueCodes.push('audit_repair_receipt_set_mismatch');
  }

  const receiptBindings: AuditTriadRepairEvidenceBinding['repairReceiptRefs'] = [];
  for (const [index, planRef] of input.plan.priorRepairReceiptRefs.entries()) {
    let expectedPath: string;
    try {
      expectedPath = resolveProjectArtifactPath(projectRoot, planRef.path);
    } catch {
      issueCodes.push(`audit_repair_receipt_${index + 1}_outside_project`);
      continue;
    }
    const suppliedPath = suppliedReceiptByIdentity.get(physicalPathIdentity(expectedPath));
    if (!suppliedPath || !fs.existsSync(suppliedPath)) {
      issueCodes.push(`audit_repair_receipt_${index + 1}_missing`);
      continue;
    }
    let snapshot: ReturnType<typeof readJsonSnapshot>;
    try {
      snapshot = readJsonSnapshot(suppliedPath);
    } catch {
      issueCodes.push(`audit_repair_receipt_${index + 1}_invalid_json`);
      continue;
    }
    frozenInputs.push({
      role: `repair_receipt_${index + 1}`,
      path: suppliedPath,
      contentHash: snapshot.contentHash,
    });
    const receipt = snapshot.value;
    const receiptHash = text(receipt.receiptHash);
    const { receiptHash: _ignoredReceiptHash, ...receiptWithoutHash } = receipt;
    const receiptPriorRefs = artifactRefs(receipt.priorRepairReceiptRefs);
    const feedbackRef = nested(receipt.feedbackDispatchRef);
    const feedbackPath = text(feedbackRef.path);
    let resolvedFeedbackPath = '';
    try {
      resolvedFeedbackPath = resolveProjectArtifactPath(projectRoot, feedbackPath);
    } catch {
      issueCodes.push(`audit_repair_receipt_${index + 1}_feedback_outside_project`);
    }
    const expectedRepairedTargetBundleHash = sha256AuditTriadJson({
      sourceDocumentHash: input.plan.sourceDocumentHash,
      semanticModelHash: input.plan.semanticModelHash,
      implementationConfirmationHash: input.plan.implementationConfirmationHash,
      projectionSetHash: input.plan.projectionSetHash,
      checkedProjectionQualityRuleCodes: input.plan.checkedProjectionQualityRuleCodes,
      qualityRuleSetHash: input.plan.qualityRuleSetHash,
      modelPacketHash: input.plan.modelPacketHash ?? null,
      auditReceiptHash: input.plan.auditReceiptHash ?? null,
      goalExecutionHash: input.plan.goalExecutionHash ?? null,
      vetoItemIds: input.plan.vetoItemIds,
      priorRepairReceiptRefs: receiptPriorRefs,
    });
    const receiptIssues = [
      text(receipt.schemaVersion) === 'audit-main-agent-repair-receipt/v1'
        ? ''
        : 'schema_invalid',
      snapshot.contentHash === planRef.contentHash ? '' : 'content_hash_mismatch',
      receiptHash === sha256AuditTriadJson(receiptWithoutHash) ? '' : 'self_hash_mismatch',
      text(receipt.recordId) === text(input.plan.recordId) ? '' : 'record_mismatch',
      text(receipt.requirementSetId) ===
      (text(input.record.requirementSetId) || text(input.record.recordId))
        ? ''
        : 'requirement_set_mismatch',
      text(receipt.remediationPacketId) ? '' : 'remediation_packet_missing',
      text(receipt.repairedSemanticModelHash) === input.plan.semanticModelHash
        ? ''
        : 'semantic_model_hash_mismatch',
      text(receipt.repairedProjectionSetHash) === input.plan.projectionSetHash
        ? ''
        : 'projection_set_hash_mismatch',
      text(receipt.qualityRuleSetHash) === input.plan.qualityRuleSetHash
        ? ''
        : 'quality_rule_set_hash_mismatch',
      text(receipt.repairedModelPacketHash) === text(input.plan.modelPacketHash)
        ? ''
        : 'model_packet_hash_mismatch',
      text(receipt.repairedAuditReceiptHash) === text(input.plan.auditReceiptHash)
        ? ''
        : 'audit_receipt_hash_mismatch',
      text(receipt.repairedGoalExecutionHash) === text(input.plan.goalExecutionHash)
        ? ''
        : 'goal_execution_hash_mismatch',
      text(receipt.repairedAuditTargetBundleHash) === expectedRepairedTargetBundleHash
        ? ''
        : 'target_bundle_hash_mismatch',
      strings(receipt.changedHashFields).length > 0 ? '' : 'changed_hash_fields_missing',
      feedbackPath ? '' : 'feedback_path_missing',
      text(feedbackRef.contentHash) ? '' : 'feedback_content_hash_missing',
      text(feedbackRef.dispatchHash) ? '' : 'feedback_dispatch_hash_missing',
    ].filter(Boolean);
    issueCodes.push(
      ...receiptIssues.map((issue) => `audit_repair_receipt_${index + 1}_${issue}`)
    );
    if (receiptIssues.length === 0 && resolvedFeedbackPath) {
      receiptBindings.push({
        path: projectRelativeArtifactPath(projectRoot, expectedPath),
        contentHash: snapshot.contentHash,
        receiptHash,
        remediationPacketId: text(receipt.remediationPacketId),
        feedbackDispatchRef: {
          path: projectRelativeArtifactPath(projectRoot, resolvedFeedbackPath),
          contentHash: text(feedbackRef.contentHash),
          dispatchHash: text(feedbackRef.dispatchHash),
        },
      });
    }
  }

  const expectedFeedbackRefs = receiptBindings.map((binding) => binding.feedbackDispatchRef);
  if (resolvedFeedbackPaths.length !== expectedFeedbackRefs.length) {
    issueCodes.push('audit_repair_feedback_set_mismatch');
  }
  const feedbackBindings: AuditTriadRepairEvidenceBinding['repairFeedbackDispatchRefs'] = [];
  for (const [index, expectedRef] of expectedFeedbackRefs.entries()) {
    let expectedPath: string;
    try {
      expectedPath = resolveProjectArtifactPath(projectRoot, expectedRef.path);
    } catch {
      issueCodes.push(`audit_repair_feedback_${index + 1}_outside_project`);
      continue;
    }
    const suppliedPath = suppliedFeedbackByIdentity.get(physicalPathIdentity(expectedPath));
    if (!suppliedPath || !fs.existsSync(suppliedPath)) {
      issueCodes.push(`audit_repair_feedback_${index + 1}_missing`);
      continue;
    }
    let snapshot: ReturnType<typeof readJsonSnapshot>;
    try {
      snapshot = readJsonSnapshot(suppliedPath);
    } catch {
      issueCodes.push(`audit_repair_feedback_${index + 1}_invalid_json`);
      continue;
    }
    frozenInputs.push({
      role: `repair_feedback_dispatch_${index + 1}`,
      path: suppliedPath,
      contentHash: snapshot.contentHash,
    });
    const dispatch = snapshot.value;
    const dispatchHash = text(dispatch.dispatchHash);
    const { dispatchHash: _ignoredDispatchHash, ...dispatchWithoutHash } = dispatch;
    const receiptBinding = receiptBindings[index];
    const receiptPath = resolveProjectArtifactPath(projectRoot, receiptBinding.path);
    const receipt = readJson(receiptPath);
    const feedbackRef = nested(receipt.feedbackDispatchRef);
    const dispatchIssues = [
      text(dispatch.schemaVersion) === 'audit-repair-feedback-dispatch/v1'
        ? ''
        : 'schema_invalid',
      snapshot.contentHash === expectedRef.contentHash ? '' : 'content_hash_mismatch',
      dispatchHash === expectedRef.dispatchHash ? '' : 'dispatch_hash_ref_mismatch',
      dispatchHash === sha256AuditTriadJson(dispatchWithoutHash) ? '' : 'self_hash_mismatch',
      text(dispatch.recordId) === text(input.plan.recordId) ? '' : 'record_mismatch',
      text(dispatch.auditEpochId) === text(receipt.sourceAuditEpochId)
        ? ''
        : 'audit_epoch_mismatch',
      text(dispatch.auditTargetBundleHash) === text(receipt.sourceAuditTargetBundleHash)
        ? ''
        : 'audit_target_bundle_mismatch',
      text(dispatch.semanticModelHash) === text(receipt.sourceSemanticModelHash)
        ? ''
        : 'semantic_model_hash_mismatch',
      text(dispatch.projectionSetHash) === text(receipt.sourceProjectionSetHash)
        ? ''
        : 'projection_set_hash_mismatch',
      text(dispatch.qualityRuleSetHash) === text(receipt.qualityRuleSetHash)
        ? ''
        : 'quality_rule_set_hash_mismatch',
      sameJson(artifactRefs(dispatch.priorRepairReceiptRefs), artifactRefs(receipt.priorRepairReceiptRefs))
        ? ''
        : 'prior_receipt_refs_mismatch',
      sameJson(strings(dispatch.validatedGapRefs), strings(receipt.validatedGapRefs))
        ? ''
        : 'validated_gap_refs_mismatch',
      sameJson(nested(dispatch.roundReceiptRef), nested(receipt.sourceRoundReceiptRef))
        ? ''
        : 'round_receipt_ref_mismatch',
      sameJson(nested(dispatch.judgeReceiptRef), nested(receipt.sourceJudgeReceiptRef))
        ? ''
        : 'judge_receipt_ref_mismatch',
      text(feedbackRef.contentHash) === snapshot.contentHash ? '' : 'receipt_content_hash_mismatch',
      text(feedbackRef.dispatchHash) === dispatchHash ? '' : 'receipt_dispatch_hash_mismatch',
    ].filter(Boolean);
    issueCodes.push(
      ...dispatchIssues.map((issue) => `audit_repair_feedback_${index + 1}_${issue}`)
    );
    if (dispatchIssues.length === 0) {
      feedbackBindings.push({
        path: projectRelativeArtifactPath(projectRoot, expectedPath),
        contentHash: snapshot.contentHash,
        dispatchHash,
      });
    }
  }

  if (
    suppliedReceiptByIdentity.size !== input.plan.priorRepairReceiptRefs.length ||
    suppliedFeedbackByIdentity.size !== expectedFeedbackRefs.length
  ) {
    issueCodes.push('audit_repair_evidence_contains_unexpected_paths');
  }
  const uniqueIssueCodes = Array.from(new Set(issueCodes));
  if (
    uniqueIssueCodes.length > 0 ||
    receiptBindings.length !== input.plan.priorRepairReceiptRefs.length ||
    feedbackBindings.length !== expectedFeedbackRefs.length
  ) {
    return { binding: null, issueCodes: uniqueIssueCodes, frozenInputs };
  }
  const bindingWithoutHash = {
    schemaVersion: 'audit-triad-repair-evidence-binding/v1' as const,
    repairReceiptRefs: receiptBindings,
    repairFeedbackDispatchRefs: feedbackBindings,
  };
  return {
    binding: {
      ...bindingWithoutHash,
      evidenceSetHash: sha256AuditTriadJson(bindingWithoutHash),
    },
    issueCodes: [],
    frozenInputs,
  };
}

function physicalPathIdentity(value: string): string {
  let existing = path.resolve(value);
  const missingSegments: string[] = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return path.resolve(value);
    missingSegments.unshift(path.basename(existing));
    existing = parent;
  }
  return path.resolve(fs.realpathSync.native(existing), ...missingSegments);
}

function assertUniqueAuditPaths(
  entries: Array<{ role: string; path: string }>
): void {
  const seen = new Map<string, string>();
  for (const entry of entries.filter((item) => text(item.path))) {
    const identity = physicalPathIdentity(entry.path);
    const existingRole = seen.get(identity);
    if (existingRole) {
      throw new Error(
        `audit_review_artifact_path_conflict:${existingRole}:${entry.role}:${normalizePathForRecord(
          identity
        )}`
      );
    }
    seen.set(identity, entry.role);
  }
}

function defaultAuditTriadDir(recordPath: string, attemptId: string): string {
  return path.join(path.dirname(recordPath), 'audit-triad', attemptId);
}

function defaultPlanPath(recordPath: string, attemptId: string): string {
  return path.join(defaultAuditTriadDir(recordPath, attemptId), 'audit-triad-execution-plan.json');
}

function defaultRoundsPath(recordPath: string, attemptId: string): string {
  return path.join(defaultAuditTriadDir(recordPath, attemptId), 'rounds.json');
}

function defaultReportPath(recordPath: string, attemptId: string): string {
  return path.join(defaultAuditTriadDir(recordPath, attemptId), 'audit-review-report.json');
}

function resolveAttemptId(args: ParsedArgs, record: JsonObject): string {
  if (args.attemptId) return args.attemptId;
  const latestIteration = objects(record.executionIterations).at(-1);
  const fromIteration =
    text(latestIteration?.runId) ||
    text(latestIteration?.executionIterationId) ||
    text(nested(record.closeout).currentAttemptId);
  if (fromIteration) return fromIteration;
  throw new Error('missing required args: attemptId');
}

function currentModelPassIssues(
  record: JsonObject,
  model: 'execution_closure',
  attemptId: string
): string[] {
  const verified = resolveVerifiedSixModelStatus({
    record,
    modelId: model,
    currentImplementationAttemptId: attemptId,
  });
  return verified.effectiveStatus === 'pass'
    ? []
    : [`${model}_not_passed:${verified.effectiveStatus}`, ...verified.blockerRefs];
}

function currentHashes(
  record: JsonObject,
  reportHash: string,
  plan: AuditTriadExecutionPlan,
  repairEvidence: AuditTriadRepairEvidenceBinding | null
): JsonObject {
  return {
    sourceDocumentHash: text(record.sourceDocumentHash),
    semanticModelHash: text(record.semanticModelHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    auditReviewReportHash: reportHash,
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    projectionSetHash: plan.projectionSetHash,
    qualityRuleSetHash: plan.qualityRuleSetHash,
    criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    currentAttemptHash: plan.currentAttemptHash,
    currentEvidenceHash: plan.currentEvidenceHash,
    ...(plan.modelPacketHash ? { modelPacketHash: plan.modelPacketHash } : {}),
    ...(repairEvidence ? { repairEvidenceSetHash: repairEvidence.evidenceSetHash } : {}),
  };
}

function resolveRoundPaths(
  args: ParsedArgs,
  recordPath: string,
  attemptId: string
): string[] {
  return [
    ...(args.round ?? []),
    ...(args.rounds ? [args.rounds] : []),
    ...(!args.rounds && (args.round ?? []).length === 0
      ? [defaultRoundsPath(recordPath, attemptId)]
      : []),
  ].map((item) => path.resolve(item));
}

function readRounds(paths: string[]): AuditTriadRoundReceipt[] {
  return paths.flatMap(
    (item) => readJsonArray(item) as unknown as AuditTriadRoundReceipt[]
  );
}

function evaluate(input: {
  record: JsonObject;
  attemptId: string;
  implementationAttemptId: string;
  plan: AuditTriadExecutionPlan;
  rounds: AuditTriadRoundReceipt[];
  repairReceiptRefs: string[];
  repairFeedbackDispatchRefs: string[];
  repairEvidence: AuditTriadRepairEvidenceBinding | null;
}): {
  decision: AuditReviewDecision;
  blockingReasons: string[];
  checks: JsonObject[];
  convergenceReceipt?: JsonObject;
} {
  const checks: JsonObject[] = [];
  const blockingReasons: string[] = [];
  const openReconfirmations = openReconfirmationRequests(input.record);
  checks.push({
    id: 'no-open-reconfirmation-request',
    passed: openReconfirmations.length === 0,
    openRequestIds: openReconfirmations.map((request) => text(request.requestId)).filter(Boolean),
  });
  if (openReconfirmations.length > 0) {
    blockingReasons.push('open_reconfirmation_request_exists');
  }
  const executionIssues = currentModelPassIssues(
    input.record,
    'execution_closure',
    input.implementationAttemptId
  );
  checks.push({
    id: 'execution-closure-current-pass',
    passed: executionIssues.length === 0,
    implementationAttemptId: input.implementationAttemptId,
    blockingReasons: executionIssues,
  });
  blockingReasons.push(...executionIssues);

  const allowedCurrentModels = new Set(['execution_closure', 'audit_review']);
  const currentMentalModel = text(input.record.currentMentalModel);
  if (!allowedCurrentModels.has(currentMentalModel)) {
    blockingReasons.push(`audit_review_entry_model_invalid:${currentMentalModel || '<missing>'}`);
  }
  checks.push({
    id: 'audit-review-entry-model-valid',
    passed: allowedCurrentModels.has(currentMentalModel),
    currentMentalModel,
  });

  const planIssues = [
    text(input.plan.recordId) === text(input.record.recordId)
      ? ''
      : 'audit_triad_plan_record_mismatch',
    text(input.plan.attemptId) === input.attemptId ? '' : 'audit_triad_plan_attempt_mismatch',
    text(input.plan.sourceDocumentHash) === text(input.record.sourceDocumentHash)
      ? ''
      : 'audit_triad_plan_source_hash_mismatch',
    text(input.plan.implementationConfirmationHash) ===
    text(input.record.implementationConfirmationHash)
      ? ''
      : 'audit_triad_plan_confirmation_hash_mismatch',
    text(input.plan.semanticModelHash) === text(input.record.semanticModelHash)
      ? ''
      : 'audit_triad_plan_semantic_model_hash_mismatch',
  ].filter(Boolean);
  checks.push({
    id: 'audit-triad-plan-current',
    passed: planIssues.length === 0,
    stageProfileId: input.plan.stageProfileId,
    blockingReasons: planIssues,
  });
  blockingReasons.push(...planIssues);

  const convergence = evaluateAuditTriadConvergence({
    plan: input.plan,
    rounds: input.rounds,
    repairReceiptRefs: input.repairReceiptRefs,
    repairFeedbackDispatchRefs: input.repairFeedbackDispatchRefs,
    ...(input.repairEvidence ? { repairEvidence: input.repairEvidence } : {}),
    scoreReceiptRequired: true,
    runAuditorHostReceiptRequired: true,
  });
  checks.push({
    id: 'audit-triad-convergence-current',
    passed: convergence.ok,
    roundCount: input.rounds.length,
    blockingReasons: convergence.blockingReasons,
  });
  blockingReasons.push(...convergence.blockingReasons);

  const uniqueBlockingReasons = [...new Set(blockingReasons.filter(Boolean))];
  return {
    decision: uniqueBlockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons: uniqueBlockingReasons,
    checks,
    convergenceReceipt: convergence.convergenceReceipt,
  };
}

function createAuditReviewRuntimeStatus(
  record: JsonObject,
  input: {
    attemptId: string;
    implementationAttemptId: string;
    plan: AuditTriadExecutionPlan;
    planPath: string;
    planHash: string;
    decision: AuditReviewDecision;
    blockingReasons: string[];
    reportPath: string;
    reportHash: string;
    evaluatedAt: string;
    evaluatedBy: string;
    repairEvidence: AuditTriadRepairEvidenceBinding | null;
  }
): RuntimeStatusProjectionUpdate {
  const gateCheckId = `audit-review:${input.attemptId}`;
  const resultPayload = {
    payloadKind: 'model_result',
    model: 'audit_review',
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    status: input.decision,
    resultRecordedAt: input.evaluatedAt,
    resultRecordedBy: input.evaluatedBy,
    blockingReasons: input.blockingReasons,
    sourceRefs: [
      { sourceType: 'execution_iteration', id: input.implementationAttemptId },
      { sourceType: 'gate_check', id: gateCheckId },
      { sourceType: 'audit_review_report', id: normalizePathForRecord(input.reportPath) },
    ],
    currentHashes: currentHashes(record, input.reportHash, input.plan, input.repairEvidence),
  };
  return createRuntimeStatusProjectionUpdate({
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    modelId: 'audit_review',
    implementationAttemptId: input.implementationAttemptId,
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    semanticModelHash: text(record.semanticModelHash),
    stageInputs: [
      {
        role: 'audit_triad_execution_plan',
        path: normalizePathForRecord(input.planPath),
        hash: input.planHash,
      },
      ...(input.repairEvidence?.repairReceiptRefs ?? []).map((ref) => ({
        role: 'audit_main_agent_repair_receipt',
        path: ref.path,
        hash: ref.contentHash,
      })),
      ...(input.repairEvidence?.repairFeedbackDispatchRefs ?? []).map((ref) => ({
        role: 'audit_repair_feedback_dispatch',
        path: ref.path,
        hash: ref.contentHash,
      })),
    ],
    deterministicGateOutputs: [
      {
        role: 'audit_review_report',
        path: normalizePathForRecord(input.reportPath),
        hash: input.reportHash,
      },
    ],
    blockerRefs: input.blockingReasons,
    evidenceRefs: [
      normalizePathForRecord(input.reportPath),
      ...(input.repairEvidence?.repairReceiptRefs ?? []).map((ref) => ref.path),
      ...(input.repairEvidence?.repairFeedbackDispatchRefs ?? []).map((ref) => ref.path),
    ],
    authorityClass: 'deterministic_gate',
    decision: input.decision === 'pass' ? 'pass' : 'block',
    effectiveStatus: input.decision === 'pass' ? 'pass' : 'blocked',
    createdAt: input.evaluatedAt,
    receiptPath: `runtime/status-decisions/${input.implementationAttemptId}/audit_review.json`,
    projection: resultPayload,
  });
}

function updateRecord(
  record: JsonObject,
  input: {
    attemptId: string;
    implementationAttemptId: string;
    decision: AuditReviewDecision;
    blockingReasons: string[];
    checks: JsonObject[];
    reportPath: string;
    evaluatedAt: string;
    evaluatedBy: string;
    runtimeStatus: RuntimeStatusProjectionUpdate;
  }
): JsonObject {
  const gateCheckId = `audit-review:${input.attemptId}`;
  const gateCheck = {
    eventType: 'gate_check_recorded',
    checkId: gateCheckId,
    gate: 'Audit Review Gate',
    decision: input.decision,
    blockingReasons: input.blockingReasons,
    checks: input.checks,
    reportPath: normalizePathForRecord(input.reportPath),
    sourceRefs: [
      { sourceType: 'execution_iteration', id: input.attemptId },
      { sourceType: 'audit_triad_execution_plan', id: input.attemptId },
    ],
    recordedAt: input.evaluatedAt,
    recordedBy: input.evaluatedBy,
  };
  const transition =
    input.decision === 'pass'
      ? {
          eventType: 'mental_model_transition_recorded',
          fromModel: 'execution_closure',
          toModel: 'audit_review',
          sourceRefs: [{ sourceType: 'model_result', id: 'execution_closure' }],
          recordedAt: input.evaluatedAt,
          recordedBy: input.evaluatedBy,
        }
      : null;
  return {
    ...record,
    gateChecks: [...objects(record.gateChecks), gateCheck],
    ...runtimeStatusProjectionRecordPatch({
      record,
      modelId: 'audit_review',
      update: input.runtimeStatus,
    }),
    currentAttemptId: input.implementationAttemptId,
    currentMentalModel: 'audit_review',
    currentStage: 'audit_review',
    stage: text(record.stage) || 'audit_review',
    mentalModelTransitions: [
      ...objects(record.mentalModelTransitions),
      ...(transition ? [transition] : []),
    ],
    lastEventType: 'audit_review_result_recorded',
    updatedAt: input.evaluatedAt,
  };
}

export function mainAuditReviewGate(
  argv: string[],
  deps: MainAuditReviewGateDeps = {}
): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: main-agent-audit-review-gate --requirement-record <json> --attempt-id <id> [--plan <json>] [--rounds <json-array>] [--round <json>] [--json]'
    );
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const attemptId = resolveAttemptId(args, record);
  const implementationAttemptId =
    text(record.currentAttemptId) ||
    text(record.implementationAttemptId) ||
    text(record.runId);
  if (!implementationAttemptId) {
    throw new Error('audit_review_implementation_attempt_missing');
  }
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = args.evaluatedBy ?? 'agent';
  const planPath = path.resolve(args.plan ?? defaultPlanPath(recordPath, attemptId));
  const roundPaths = resolveRoundPaths(args, recordPath, attemptId);
  const reportPath = path.resolve(args.reportPath ?? defaultReportPath(recordPath, attemptId));
  const runtimeStatusReceiptPath = path.resolve(
    path.dirname(recordPath),
    'runtime',
    'status-decisions',
    implementationAttemptId,
    'audit_review.json'
  );
  assertUniqueAuditPaths([
    { role: 'requirement_record', path: recordPath },
    ...(text(record.sourcePath)
      ? [{ role: 'requirement_source', path: path.resolve(text(record.sourcePath)) }]
      : []),
    { role: 'audit_triad_execution_plan', path: planPath },
    ...roundPaths.map((roundPath, index) => ({
      role: `audit_triad_round_${index + 1}`,
      path: roundPath,
    })),
    ...(args.repairReceipt ?? []).map((repairPath, index) => ({
      role: `repair_receipt_${index + 1}`,
      path: path.resolve(repairPath),
    })),
    ...(args.repairFeedbackDispatch ?? []).map((dispatchPath, index) => ({
      role: `repair_feedback_dispatch_${index + 1}`,
      path: path.resolve(dispatchPath),
    })),
    { role: 'audit_review_report', path: reportPath },
    { role: 'audit_review_runtime_status_receipt', path: runtimeStatusReceiptPath },
  ]);
  const planSnapshot = readJsonSnapshot(planPath);
  const plan = planSnapshot.value as unknown as AuditTriadExecutionPlan;
  const planHash = planSnapshot.contentHash;
  const rounds = readRounds(roundPaths);
  const repairEvidenceValidation = validateAuditRepairEvidence({
    recordPath,
    record,
    plan,
    repairReceiptPaths: args.repairReceipt ?? [],
    repairFeedbackDispatchPaths: args.repairFeedbackDispatch ?? [],
  });
  const sourcePrdLintTransition = validateSourcePrdLintTransitionFromFiles({
    transition: 'audit-review',
    requirementRecordPath: recordPath,
    currentSourcePath: text(record.sourcePath),
  });
  const baseEvaluation = evaluate({
    record,
    attemptId,
    implementationAttemptId,
    plan,
    rounds,
    repairReceiptRefs: args.repairReceipt ?? [],
    repairFeedbackDispatchRefs: args.repairFeedbackDispatch ?? [],
    repairEvidence: repairEvidenceValidation.binding,
  });
  const repairEvidenceEvaluation =
    repairEvidenceValidation.issueCodes.length === 0
      ? baseEvaluation
      : {
          ...baseEvaluation,
          decision: 'blocked' as const,
          blockingReasons: [
            ...new Set([
              ...baseEvaluation.blockingReasons,
              ...repairEvidenceValidation.issueCodes,
            ]),
          ],
          checks: [
            ...baseEvaluation.checks,
            {
              id: 'audit-repair-evidence-valid',
              passed: false,
              blockingReasons: repairEvidenceValidation.issueCodes,
            },
          ],
        };
  const evaluation =
    sourcePrdLintTransition.decision === 'pass'
      ? repairEvidenceEvaluation
      : {
          ...repairEvidenceEvaluation,
          decision: 'blocked' as const,
          blockingReasons: [
            ...new Set([
              ...repairEvidenceEvaluation.blockingReasons,
              ...sourcePrdLintTransition.issueCodes,
            ]),
          ],
        };
  const report = {
    reportType: 'audit_review_report',
    generatedAt: evaluatedAt,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    attemptId,
    implementationAttemptId,
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
    auditTriadExecutionPlanRef: {
      path: normalizePathForRecord(planPath),
      contentHash: planHash,
      stageProfileId: plan.stageProfileId,
      auditEpochId: plan.auditEpochId,
      auditTargetBundleHash: plan.auditTargetBundleHash,
      semanticModelHash: plan.semanticModelHash,
      projectionSetHash: plan.projectionSetHash,
      checkedProjectionQualityRuleCodes: plan.checkedProjectionQualityRuleCodes,
      qualityRuleSetHash: plan.qualityRuleSetHash,
      criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
      criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
      requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    },
    roundCount: rounds.length,
    repairEvidence: repairEvidenceValidation.binding,
    convergenceReceipt: evaluation.convergenceReceipt ?? null,
  };
  const reportText = `${JSON.stringify(report, null, 2)}\n`;
  const reportHash = sha256Text(reportText);
  const runtimeStatus = createAuditReviewRuntimeStatus(record, {
    attemptId,
    implementationAttemptId,
    plan,
    planPath,
    planHash,
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    reportPath,
    reportHash,
    evaluatedAt,
    evaluatedBy,
    repairEvidence: repairEvidenceValidation.binding,
  });
  const payload = {
    attemptId,
    implementationAttemptId,
    planPath: normalizePathForRecord(planPath),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
    repairEvidence: repairEvidenceValidation.binding,
    reportPath: normalizePathForRecord(reportPath),
    reportHash,
    evaluatedAt,
    evaluatedBy,
  };
  deps.beforeControlCommit?.();
  if (sha256File(planPath) !== planHash) {
    throw new Error('audit_review_input_changed:plan');
  }
  for (const input of repairEvidenceValidation.frozenInputs) {
    if (!fs.existsSync(input.path) || sha256File(input.path) !== input.contentHash) {
      throw new Error(`audit_review_input_changed:${input.role}`);
    }
  }
  const commit = appendControlEventAndReplay({
    recordPath,
    writerId: 'audit-review-gate-writer',
    eventType: 'audit_review_result_recorded',
    recordedAt: evaluatedAt,
    expectedBeforeRecordHash: sha256Json(canonicalizeRequirementRecord(record)),
    payload,
    artifactWrites: [
      {
        path: reportPath,
        content: reportText,
        contentHash: reportHash,
      },
      ...runtimeStatusProjectionArtifactWrites(runtimeStatus),
    ],
    reduce: (currentRecord) =>
      updateRecord(currentRecord, {
        attemptId,
        implementationAttemptId,
        decision: evaluation.decision,
        blockingReasons: evaluation.blockingReasons,
        checks: evaluation.checks,
        reportPath,
        evaluatedAt,
        evaluatedBy,
        runtimeStatus,
      }),
  });
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(reportPath),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    controlEventId: commit.event.eventId,
    controlEventHash: commit.event.eventHash,
    eventLogPath: normalizePathForRecord(commit.eventLogPath),
    receiptPath: normalizePathForRecord(commit.receiptPath),
  };
  (deps.writeOutput ?? process.stdout.write.bind(process.stdout))(
    args.json ? `${JSON.stringify(output, null, 2)}\n` : `audit_review=${evaluation.decision}\n`
  );
  return evaluation.decision === 'pass' ? 0 : 1;
}

if (require.main === module && isDirectMainAgentAuditReviewGateCli(process.argv[1])) {
  try {
    process.exitCode = mainAuditReviewGate(process.argv.slice(2));
  } catch (error) {
    console.error(
      JSON.stringify(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );
    process.exitCode = 2;
  }
}
