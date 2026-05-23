/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveArchitectureConfirmationHashRecipe } from './architecture-confirmation-hash-recipe';
import { appendControlEventAndReplay, sha256Text } from './requirement-record-control-store';

type JsonObject = Record<string, unknown>;
type ReadinessDecision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  reportPath?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  json?: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[key] = value;
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

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function latestConfirmation(record: JsonObject): JsonObject | null {
  const history = objects(record.confirmationHistory);
  return history.length > 0 ? history[history.length - 1] : null;
}

function hasBlockingOpenQuestion(record: JsonObject): boolean {
  const summary = record.contractSummary;
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return false;
  return objects((summary as JsonObject).openQuestions).some(
    (question) => question.blocksImplementation === true
  );
}

function latestArchitectureStateCheck(record: JsonObject): JsonObject | null {
  const checks = objects(record.architectureConfirmationStateChecks);
  return checks.length > 0 ? checks[checks.length - 1] : null;
}

function architectureConfirmationRequired(record: JsonObject): boolean {
  if (record.architectureConfirmationRequired === true) return true;
  const state = record.architectureConfirmationState;
  if (state && typeof state === 'object' && !Array.isArray(state)) return true;
  return (
    objects(record.architectureConfirmations).length > 0 ||
    objects(record.architectureConfirmationStateChecks).length > 0
  );
}

function evaluate(record: JsonObject): {
  decision: ReadinessDecision;
  blockingReasons: string[];
  checks: JsonObject[];
} {
  const checks: JsonObject[] = [];
  const blockingReasons: string[] = [];
  const confirmation = latestConfirmation(record);
  const confirmed = text(record.status) === 'user_confirmed';
  checks.push({ id: 'record-status-user-confirmed', passed: confirmed });
  if (!confirmed) blockingReasons.push('record_not_user_confirmed');

  const confirmationPresent = Boolean(confirmation);
  checks.push({ id: 'latest-confirmation-history-present', passed: confirmationPresent });
  if (!confirmationPresent) blockingReasons.push('confirmation_history_missing');

  const sourceHashMatches =
    confirmationPresent && text(confirmation?.sourceDocumentHash) === text(record.sourceDocumentHash);
  checks.push({ id: 'source-document-hash-current', passed: sourceHashMatches });
  if (!sourceHashMatches) blockingReasons.push('source_document_hash_not_current');

  const implementationHashMatches =
    confirmationPresent &&
    text(confirmation?.implementationConfirmationHash) === text(record.implementationConfirmationHash);
  checks.push({ id: 'implementation-confirmation-hash-current', passed: implementationHashMatches });
  if (!implementationHashMatches) blockingReasons.push('implementation_confirmation_hash_not_current');

  const confirmationPageHashPresent = confirmationPresent && Boolean(text(confirmation?.confirmationPageHash));
  checks.push({ id: 'confirmation-page-hash-present', passed: confirmationPageHashPresent });
  if (!confirmationPageHashPresent) blockingReasons.push('confirmation_page_hash_missing');

  const requiresArchitecture = architectureConfirmationRequired(record);
  checks.push({ id: 'architecture-confirmation-required', passed: true, required: requiresArchitecture });
  const architectureState = record.architectureConfirmationState as JsonObject | undefined;
  const architectureActive =
    !requiresArchitecture ||
    (architectureState &&
      typeof architectureState === 'object' &&
      !Array.isArray(architectureState) &&
      text(architectureState.status) === 'active' &&
      Boolean(text(architectureState.currentArchitectureConfirmationHash)));
  checks.push({ id: 'architecture-confirmation-current', passed: Boolean(architectureActive) });
  if (!architectureActive) blockingReasons.push('architecture_confirmation_not_active');

  let resolvedRecipeHash = '';
  try {
    resolvedRecipeHash = resolveArchitectureConfirmationHashRecipe().resolvedRecipeHash;
  } catch {
    blockingReasons.push('architecture_hash_recipe_unresolved');
  }
  const architectureRecipeCurrent =
    !requiresArchitecture ||
    (Boolean(resolvedRecipeHash) && text(architectureState?.resolvedRecipeHash) === resolvedRecipeHash);
  checks.push({ id: 'architecture-confirmation-recipe-current', passed: architectureRecipeCurrent });
  if (!architectureRecipeCurrent) blockingReasons.push('architecture_confirmation_resolved_recipe_hash_not_current');

  const stateCheck = latestArchitectureStateCheck(record);
  const stateCheckPassed =
    !requiresArchitecture ||
    (Boolean(stateCheck) &&
      text(stateCheck?.decision) === 'pass' &&
      text((stateCheck?.stateTransition as JsonObject | undefined)?.toStatus) === 'active' &&
      text(stateCheck?.resolvedRecipeHash) === resolvedRecipeHash);
  checks.push({ id: 'architecture-confirmation-state-check-current', passed: stateCheckPassed });
  if (!stateCheckPassed) blockingReasons.push('architecture_confirmation_state_check_not_current');

  const blockingQuestion = hasBlockingOpenQuestion(record);
  checks.push({ id: 'no-blocking-open-questions', passed: !blockingQuestion });
  if (blockingQuestion) blockingReasons.push('blocking_open_question_exists');

  return {
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons,
    checks,
  };
}

function updateRecord(
  record: JsonObject,
  input: {
    decision: ReadinessDecision;
    blockingReasons: string[];
    checks: JsonObject[];
    reportPath: string;
    evaluatedAt: string;
    evaluatedBy: string;
  }
): JsonObject {
  const checkId = `implementation-readiness:${input.evaluatedAt}`;
  const gateCheck = {
    eventType: 'gate_check_recorded',
    checkId,
    gate: 'Implementation Readiness Gate',
    decision: input.decision,
    blockingReasons: input.blockingReasons,
    checks: input.checks,
    reportPath: normalizePathForRecord(input.reportPath),
    sourceRefs: [
      { sourceType: 'requirement_record', id: text(record.recordId) },
      { sourceType: 'confirmation_history', id: text(latestConfirmation(record)?.confirmedAt) },
    ].filter((item) => text(item.id)),
    recordedAt: input.evaluatedAt,
    recordedBy: input.evaluatedBy,
  };
  return {
    ...record,
    gateChecks: [...objects(record.gateChecks), gateCheck],
    lastEventType: 'implementation_readiness_check_recorded',
    updatedAt: input.evaluatedAt,
  };
}

function currentArchitectureHash(record: JsonObject): string {
  const state = record.architectureConfirmationState;
  return state && typeof state === 'object' && !Array.isArray(state)
    ? text((state as JsonObject).currentArchitectureConfirmationHash)
    : '';
}

function requestReadinessBaselineActivation(
  recordPath: string,
  input: {
    record: JsonObject;
    gateCommit: ReturnType<typeof appendControlEventAndReplay>;
    sourceReportPath: string;
    evaluatedAt: string;
    evaluatedBy: string;
  }
): ReturnType<typeof appendControlEventAndReplay> {
  const sourceReportHash = sha256Text(fs.readFileSync(input.sourceReportPath, 'utf8'));
  const activationId = `readiness-baseline:${text(input.record.requirementSetId) || text(input.record.recordId)}:${input.evaluatedAt}`;
  const payload = {
    activationId,
    requirementSetId: text(input.record.requirementSetId) || text(input.record.recordId),
    recordId: text(input.record.recordId),
    status: 'audit_required',
    sourceGateCheckId: `implementation-readiness:${input.evaluatedAt}`,
    sourceReportPath: normalizePathForRecord(input.sourceReportPath),
    sourceReportHash,
    sourceControlEventId: input.gateCommit.event.eventId,
    sourceControlEventHash: input.gateCommit.event.eventHash,
    readinessGateRecipeVersion: 'implementation-readiness-gate/v1',
    sourceDocumentHash: text(input.record.sourceDocumentHash),
    implementationConfirmationHash: text(input.record.implementationConfirmationHash),
    architectureConfirmationHash: currentArchitectureHash(input.record),
    requestedAt: input.evaluatedAt,
    requestedBy: input.evaluatedBy,
  };
  return appendControlEventAndReplay({
    recordPath,
    writerId: 'readiness-baseline-activation-writer',
    eventType: 'readiness_baseline_activation_requested',
    recordedAt: input.evaluatedAt,
    payload,
    reduce: (currentRecord) => ({
      ...currentRecord,
      readinessBaselineActivation: payload,
      lastEventType: 'readiness_baseline_activation_requested',
      updatedAt: input.evaluatedAt,
    }),
  });
}

export function mainImplementationReadinessGate(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: main-agent-implementation-readiness-gate --requirement-record <json> [--json]');
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = args.evaluatedBy ?? 'agent';
  const reportPath = path.resolve(
    args.reportPath ?? path.join(path.dirname(recordPath), 'implementation-readiness-report.json')
  );
  const evaluation = evaluate(record);
  const report = {
    reportType: 'implementation_readiness_report',
    generatedAt: evaluatedAt,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const readinessPayload = {
    ...evaluation,
    reportPath,
    evaluatedAt,
    evaluatedBy,
  };
  const commit = appendControlEventAndReplay({
    recordPath,
    writerId: 'implementation-readiness-gate-writer',
    eventType: 'implementation_readiness_check_recorded',
    recordedAt: evaluatedAt,
    payload: readinessPayload,
    reduce: (currentRecord) => updateRecord(currentRecord, readinessPayload),
  });
  const activationCommit =
    evaluation.decision === 'pass'
      ? requestReadinessBaselineActivation(recordPath, {
          record,
          gateCommit: commit,
          sourceReportPath: reportPath,
          evaluatedAt,
          evaluatedBy,
        })
      : null;
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(reportPath),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    controlEventId: commit.event.eventId,
    controlEventHash: commit.event.eventHash,
    eventLogPath: normalizePathForRecord(commit.eventLogPath),
    receiptPath: normalizePathForRecord(commit.receiptPath),
    ...(activationCommit
      ? {
          readinessBaselineActivation: {
            status: 'audit_required',
            controlEventId: activationCommit.event.eventId,
            controlEventHash: activationCommit.event.eventHash,
            receiptPath: normalizePathForRecord(activationCommit.receiptPath),
          },
        }
      : {}),
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `implementation_readiness=${evaluation.decision}\n`);
  return evaluation.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainImplementationReadinessGate(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
