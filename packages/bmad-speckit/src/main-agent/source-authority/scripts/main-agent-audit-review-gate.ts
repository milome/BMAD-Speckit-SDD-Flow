/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  evaluateAuditTriadConvergence,
  type AuditTriadExecutionPlan,
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
  const wrapped = nested(parsed);
  return objects(wrapped.rounds);
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
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
  plan: AuditTriadExecutionPlan
): JsonObject {
  return {
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    auditReviewReportHash: reportHash,
    criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    currentAttemptHash: plan.currentAttemptHash,
    currentEvidenceHash: plan.currentEvidenceHash,
    ...(plan.modelPacketHash ? { modelPacketHash: plan.modelPacketHash } : {}),
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
  plan: AuditTriadExecutionPlan;
  rounds: AuditTriadRoundReceipt[];
  repairReceiptRefs: string[];
  repairFeedbackDispatchRefs: string[];
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
    input.attemptId
  );
  checks.push({
    id: 'execution-closure-current-pass',
    passed: executionIssues.length === 0,
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
    plan: AuditTriadExecutionPlan;
    planPath: string;
    planHash: string;
    decision: AuditReviewDecision;
    blockingReasons: string[];
    reportPath: string;
    reportHash: string;
    evaluatedAt: string;
    evaluatedBy: string;
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
      { sourceType: 'execution_iteration', id: input.attemptId },
      { sourceType: 'gate_check', id: gateCheckId },
      { sourceType: 'audit_review_report', id: normalizePathForRecord(input.reportPath) },
    ],
    currentHashes: currentHashes(record, input.reportHash, input.plan),
  };
  return createRuntimeStatusProjectionUpdate({
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    modelId: 'audit_review',
    implementationAttemptId: input.attemptId,
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    semanticModelHash: text(record.semanticModelHash),
    stageInputs: [
      {
        role: 'audit_triad_execution_plan',
        path: normalizePathForRecord(input.planPath),
        hash: input.planHash,
      },
    ],
    deterministicGateOutputs: [
      {
        role: 'audit_review_report',
        path: normalizePathForRecord(input.reportPath),
        hash: input.reportHash,
      },
    ],
    blockerRefs: input.blockingReasons,
    evidenceRefs: [normalizePathForRecord(input.reportPath)],
    authorityClass: 'deterministic_gate',
    decision: input.decision === 'pass' ? 'pass' : 'block',
    effectiveStatus: input.decision === 'pass' ? 'pass' : 'blocked',
    createdAt: input.evaluatedAt,
    receiptPath: `runtime/status-decisions/${input.attemptId}/audit_review.json`,
    projection: resultPayload,
  });
}

function updateRecord(
  record: JsonObject,
  input: {
    attemptId: string;
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
    currentAttemptId: input.attemptId,
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
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = args.evaluatedBy ?? 'agent';
  const planPath = path.resolve(args.plan ?? defaultPlanPath(recordPath, attemptId));
  const roundPaths = resolveRoundPaths(args, recordPath, attemptId);
  const reportPath = path.resolve(args.reportPath ?? defaultReportPath(recordPath, attemptId));
  const runtimeStatusReceiptPath = path.resolve(
    path.dirname(recordPath),
    'runtime',
    'status-decisions',
    attemptId,
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
  const sourcePrdLintTransition = validateSourcePrdLintTransitionFromFiles({
    transition: 'audit-review',
    requirementRecordPath: recordPath,
    currentSourcePath: text(record.sourcePath),
  });
  const baseEvaluation = evaluate({
    record,
    attemptId,
    plan,
    rounds,
    repairReceiptRefs: args.repairReceipt ?? [],
    repairFeedbackDispatchRefs: args.repairFeedbackDispatch ?? [],
  });
  const evaluation =
    sourcePrdLintTransition.decision === 'pass'
      ? baseEvaluation
      : {
          ...baseEvaluation,
          decision: 'blocked' as const,
          blockingReasons: [
            ...new Set([
              ...baseEvaluation.blockingReasons,
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
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
    auditTriadExecutionPlanRef: {
      path: normalizePathForRecord(planPath),
      contentHash: planHash,
      stageProfileId: plan.stageProfileId,
      criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
      criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
      requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    },
    roundCount: rounds.length,
    convergenceReceipt: evaluation.convergenceReceipt ?? null,
  };
  const reportText = `${JSON.stringify(report, null, 2)}\n`;
  const reportHash = sha256Text(reportText);
  const runtimeStatus = createAuditReviewRuntimeStatus(record, {
    attemptId,
    plan,
    planPath,
    planHash,
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    reportPath,
    reportHash,
    evaluatedAt,
    evaluatedBy,
  });
  const payload = {
    attemptId,
    planPath: normalizePathForRecord(planPath),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
    reportPath: normalizePathForRecord(reportPath),
    reportHash,
    evaluatedAt,
    evaluatedBy,
  };
  deps.beforeControlCommit?.();
  if (sha256File(planPath) !== planHash) {
    throw new Error('audit_review_input_changed:plan');
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
  process.stdout.write(
    args.json ? `${JSON.stringify(output, null, 2)}\n` : `audit_review=${evaluation.decision}\n`
  );
  return evaluation.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
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
