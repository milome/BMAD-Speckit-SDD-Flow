/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  evaluateAuditTriadConvergence,
  type AuditTriadExecutionPlan,
  type AuditTriadRoundReceipt,
} from './audit-triad-orchestrator';
import { appendControlEventAndReplay } from './requirement-record-control-store';

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

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { round: [], repairReceipt: [], repairFeedbackDispatch: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) =>
        letter.toUpperCase()
      ) as keyof ParsedArgs;
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

function readJsonArray(file: string): JsonObject[] {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (Array.isArray(parsed)) return parsed as JsonObject[];
  const wrapped = nested(parsed);
  return objects(wrapped.rounds);
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
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

function modelResult(record: JsonObject, model: string): JsonObject {
  return nested(nested(record.sixModelResults)[model]);
}

function currentModelPassIssues(record: JsonObject, model: string): string[] {
  const result = modelResult(record, model);
  const status = text(result.status);
  const issues: string[] = [];
  if (!status) issues.push(`${model}_result_missing`);
  else if (status !== 'pass') issues.push(`${model}_not_passed:${status}`);
  if (text(result.sourceDocumentHash) !== text(record.sourceDocumentHash)) {
    issues.push(`${model}_source_hash_mismatch`);
  }
  if (text(result.implementationConfirmationHash) !== text(record.implementationConfirmationHash)) {
    issues.push(`${model}_confirmation_hash_mismatch`);
  }
  return issues;
}

function currentHashes(record: JsonObject, reportHash: string, plan: AuditTriadExecutionPlan): JsonObject {
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

function readRounds(args: ParsedArgs, recordPath: string, attemptId: string): AuditTriadRoundReceipt[] {
  const paths = [
    ...(args.round ?? []),
    ...(args.rounds ? [args.rounds] : []),
    ...(!args.rounds && (args.round ?? []).length === 0
      ? [defaultRoundsPath(recordPath, attemptId)]
      : []),
  ];
  return paths.flatMap(
    (item) => readJsonArray(path.resolve(item)) as unknown as AuditTriadRoundReceipt[]
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
  const executionIssues = currentModelPassIssues(input.record, 'execution_closure');
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
    text(input.plan.recordId) === text(input.record.recordId) ? '' : 'audit_triad_plan_record_mismatch',
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

function updateRecord(
  record: JsonObject,
  input: {
    attemptId: string;
    plan: AuditTriadExecutionPlan;
    decision: AuditReviewDecision;
    blockingReasons: string[];
    checks: JsonObject[];
    reportPath: string;
    reportHash: string;
    evaluatedAt: string;
    evaluatedBy: string;
  }
): JsonObject {
  const gateCheckId = `audit-review:${input.attemptId}`;
  const previousSixModelResults = nested(record.sixModelResults);
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
    sixModelResults: {
      ...previousSixModelResults,
      audit_review: resultPayload,
    },
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

export function mainAuditReviewGate(argv: string[]): number {
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
  const plan = readJson(planPath) as unknown as AuditTriadExecutionPlan;
  const rounds = readRounds(args, recordPath, attemptId);
  const reportPath = path.resolve(args.reportPath ?? defaultReportPath(recordPath, attemptId));
  const evaluation = evaluate({
    record,
    attemptId,
    plan,
    rounds,
    repairReceiptRefs: args.repairReceipt ?? [],
    repairFeedbackDispatchRefs: args.repairFeedbackDispatch ?? [],
  });
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
      contentHash: sha256File(planPath),
      stageProfileId: plan.stageProfileId,
      criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
      criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
      requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    },
    roundCount: rounds.length,
    convergenceReceipt: evaluation.convergenceReceipt ?? null,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const reportHash = sha256File(reportPath);
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
  const commit = appendControlEventAndReplay({
    recordPath,
    writerId: 'audit-review-gate-writer',
    eventType: 'audit_review_result_recorded',
    recordedAt: evaluatedAt,
    payload,
    reduce: (currentRecord) =>
      updateRecord(currentRecord, {
        attemptId,
        plan,
        decision: evaluation.decision,
        blockingReasons: evaluation.blockingReasons,
        checks: evaluation.checks,
        reportPath,
        reportHash,
        evaluatedAt,
        evaluatedBy,
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
