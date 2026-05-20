/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveArchitectureConfirmationHashRecipe } from './architecture-confirmation-hash-recipe';

type JsonObject = Record<string, unknown>;
type CloseoutDecision = 'pass' | 'fail' | 'blocked';
const RERUN_AUTHORITY_SOURCE_TYPES = new Set([
  'gate_check',
  'contract_check',
  'audit_iteration',
  'execution_iteration',
  'requirement_closure',
]);

interface ParsedArgs {
  requirementRecord?: string;
  attemptId?: string;
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

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
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

function appendJsonl(file: string, value: JsonObject): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function deliveryEvidence(record: JsonObject): JsonObject {
  return record.deliveryEvidence && typeof record.deliveryEvidence === 'object' && !Array.isArray(record.deliveryEvidence)
    ? (record.deliveryEvidence as JsonObject)
    : {};
}

function commandRunsForAttempt(record: JsonObject, attemptId: string): JsonObject[] {
  return objects(record.executionIterations).flatMap((iteration) =>
    objects(iteration.commandRunRefs)
      .filter((run) => text(run.closeoutAttemptId) === attemptId)
      .map((run) => ({ ...run, executionIterationId: iteration.executionIterationId }))
  );
}

function commandSelectedForAttempt(command: JsonObject, attemptId: string): boolean {
  if (text(command.closeoutAttemptId) === attemptId) return true;
  const lastRunRef = command.lastRunRef;
  if (lastRunRef && typeof lastRunRef === 'object' && !Array.isArray(lastRunRef)) {
    return text((lastRunRef as JsonObject).closeoutAttemptId) === attemptId;
  }
  return false;
}

function requiredCommandsForAttempt(record: JsonObject, attemptId: string): JsonObject[] {
  return objects(deliveryEvidence(record).requiredCommands).filter((command) => commandSelectedForAttempt(command, attemptId));
}

function latestRequirementClosures(record: JsonObject): JsonObject[] {
  const latestByRequirementId = new Map<string, JsonObject>();
  for (const closure of objects(record.requirementClosures)) {
    const requirementId = text(closure.requirementId);
    if (requirementId) latestByRequirementId.set(requirementId, closure);
  }
  return [...latestByRequirementId.values()];
}

function latestFailureRecords(record: JsonObject): JsonObject[] {
  const latestByFailureId = new Map<string, JsonObject>();
  for (const failure of objects(record.failureRecords)) {
    const failureId = text(failure.failureId);
    if (failureId) latestByFailureId.set(failureId, failure);
  }
  return [...latestByFailureId.values()];
}

function latestRcaRecords(record: JsonObject): JsonObject[] {
  const latestByRcaId = new Map<string, JsonObject>();
  for (const rca of objects(record.rcaRecords)) {
    const rcaId = text(rca.rcaId);
    if (rcaId) latestByRcaId.set(rcaId, rca);
  }
  return [...latestByRcaId.values()];
}

function artifactCompletenessIssues(artifactRef: unknown): string[] {
  if (!artifactRef || typeof artifactRef !== 'object' || Array.isArray(artifactRef)) return ['artifact_ref_missing'];
  const ref = artifactRef as JsonObject;
  const issues: string[] = [];
  if (!text(ref.path)) issues.push('path_missing');
  if (!text(ref.hash ?? ref.contentHash)) issues.push('hash_missing');
  if (!text(ref.producer)) issues.push('producer_missing');
  if (!text(ref.purpose)) issues.push('purpose_missing');
  if (strings(ref.relatedRequirementIds).length === 0) issues.push('related_requirement_ids_missing');
  if (!text(ref.status)) issues.push('status_missing');
  if (!text(ref.inputVersion)) issues.push('input_version_missing');
  if (!text(ref.outputVersion)) issues.push('output_version_missing');
  if (text(ref.sourceOfTruthRole) !== 'evidence') issues.push('source_of_truth_role_not_evidence');
  return issues;
}

function artifactIndexed(record: JsonObject, artifactRef: unknown): boolean {
  if (!artifactRef || typeof artifactRef !== 'object' || Array.isArray(artifactRef)) return false;
  const ref = artifactRef as JsonObject;
  if (artifactCompletenessIssues(ref).length > 0) return false;
  const refPath = normalizePathForRecord(text(ref.path));
  const refHash = text(ref.hash ?? ref.contentHash);
  return objects(record.artifactIndex).some(
    (item) => {
      if (artifactCompletenessIssues(item).length > 0) return false;
      return (
        normalizePathForRecord(text(item.path)) === refPath &&
        text(item.contentHash ?? item.hash) === refHash &&
        text(item.sourceOfTruthRole) === 'evidence'
      );
    }
  );
}

function latestFailureCaseCoverageArtifact(record: JsonObject): JsonObject | null {
  const artifacts = objects(record.artifactIndex).filter(
    (artifact) =>
      text(artifact.artifactType) === 'failure_case_coverage' &&
      text(artifact.sourceOfTruthRole) === 'evidence' &&
      text(artifact.status) === 'active'
  );
  return artifacts.at(-1) ?? null;
}

function failureCaseCoverageIssues(record: JsonObject): string[] {
  const artifact = latestFailureCaseCoverageArtifact(record);
  if (!artifact) return ['failure_case_coverage_artifact_missing'];
  if (artifactCompletenessIssues(artifact).length > 0) return ['failure_case_coverage_artifact_incomplete'];
  const artifactPath = text(artifact.path);
  const absolute = path.isAbsolute(artifactPath) ? artifactPath : path.resolve(process.cwd(), artifactPath);
  if (!fs.existsSync(absolute)) return [`failure_case_coverage_artifact_not_found:${normalizePathForRecord(artifactPath)}`];
  const report = readJson(absolute);
  const coverage = report.resumeFailureCaseRegistryCoverage as JsonObject | undefined;
  const total = Number(coverage?.failureCases ?? report.failureCaseTotalCount ?? 0);
  const exercised = Number(coverage?.failureCaseExercisedCount ?? report.failureCaseExercisedCount ?? 0);
  const unexercised = strings(coverage?.unexercisedCases ?? report.unexercisedCases);
  const issues = strings(coverage?.issues ?? report.issues);
  const blockingIssues = strings(report.blockingIssues);
  const out: string[] = [];
  if (!total) out.push('failure_case_coverage_total_missing');
  if (total !== exercised) out.push(`failure_case_coverage_incomplete:${exercised}/${total}`);
  for (const caseId of unexercised) out.push(`failure_case_unexercised:${caseId}`);
  if (issues.length > 0) out.push('failure_case_coverage_registry_issues');
  if (blockingIssues.length > 0) out.push('failure_case_coverage_blocking_issues');
  return [...new Set(out)];
}

function hasImplementationReadinessPass(record: JsonObject): boolean {
  return objects(record.gateChecks).some(
    (check) =>
      text(check.gate) === 'Implementation Readiness Gate' &&
      text(check.decision) === 'pass'
  );
}

function latestArchitectureStateCheck(record: JsonObject): JsonObject | null {
  const checks = objects(record.architectureConfirmationStateChecks);
  return checks.length > 0 ? checks[checks.length - 1] : null;
}

function architectureConfirmationIssues(record: JsonObject): string[] {
  const state =
    record.architectureConfirmationState &&
    typeof record.architectureConfirmationState === 'object' &&
    !Array.isArray(record.architectureConfirmationState)
      ? (record.architectureConfirmationState as JsonObject)
      : {};
  const issues: string[] = [];
  let resolvedRecipeHash = '';
  try {
    resolvedRecipeHash = resolveArchitectureConfirmationHashRecipe().resolvedRecipeHash;
  } catch {
    issues.push('architecture_hash_recipe_unresolved');
  }
  if (text(state.status) !== 'active' || !text(state.currentArchitectureConfirmationHash)) {
    issues.push('architecture_confirmation_not_active');
  }
  if (!resolvedRecipeHash || text(state.resolvedRecipeHash) !== resolvedRecipeHash) {
    issues.push('architecture_confirmation_resolved_recipe_hash_not_current');
  }
  const stateCheck = latestArchitectureStateCheck(record);
  const transition =
    stateCheck?.stateTransition &&
    typeof stateCheck.stateTransition === 'object' &&
    !Array.isArray(stateCheck.stateTransition)
      ? (stateCheck.stateTransition as JsonObject)
      : {};
  if (
    !stateCheck ||
    text(stateCheck.decision) !== 'pass' ||
    text(transition.toStatus) !== 'active' ||
    text(stateCheck.resolvedRecipeHash) !== resolvedRecipeHash
  ) {
    issues.push('architecture_confirmation_state_check_not_current');
  }
  return [...new Set(issues)];
}

function hasBlockingScoringState(record: JsonObject): boolean {
  const gates = objects(record.gateChecks);
  const latestMaterialization = gates.filter((check) => text(check.gate) === 'score_materialization').at(-1);
  const latestEvaluation = gates.filter((check) => text(check.gate) === 'score_evaluation').at(-1);
  const materializationDecision = text(latestMaterialization?.decision);
  const evaluationDecision = text(latestEvaluation?.decision);
  const openScoreFailures = objects(record.failureRecords).filter(
    (failure) =>
      ['score_write_failed', 'score_threshold_or_dimension_failed'].includes(text(failure.type)) &&
      ['open', 'in_progress', 'blocked'].includes(text(failure.status))
  );
  return (
    ['fail', 'blocked'].includes(materializationDecision) ||
    ['fail', 'blocked'].includes(evaluationDecision) ||
    openScoreFailures.length > 0
  );
}

function rerunLoopSourceIssues(loop: JsonObject): string[] {
  const issues: string[] = [];
  const loopId = text(loop.rerunLoopId) || '<missing>';
  const sourceRefs = objects(loop.sourceRefs);
  if (sourceRefs.length === 0) issues.push(`rerun_loop_source_refs_missing:${loopId}`);
  for (const sourceRef of sourceRefs) {
    const sourceType = text(sourceRef.sourceType);
    if (!RERUN_AUTHORITY_SOURCE_TYPES.has(sourceType)) {
      issues.push(`rerun_loop_source_ref_type_invalid:${loopId}:${sourceType || '<missing>'}`);
    }
    if (!text(sourceRef.id)) issues.push(`rerun_loop_source_ref_id_missing:${loopId}`);
  }
  if (Object.prototype.hasOwnProperty.call(loop, 'result')) issues.push(`rerun_loop_result_forbidden:${loopId}`);
  if (Object.prototype.hasOwnProperty.call(loop, 'decision')) issues.push(`rerun_loop_decision_forbidden:${loopId}`);
  if (Object.prototype.hasOwnProperty.call(loop, 'trigger') && sourceRefs.length === 0) {
    issues.push(`rerun_loop_trigger_without_source_refs:${loopId}`);
  }
  return issues;
}

function hookReconciliationIssues(record: JsonObject): string[] {
  const reconciliation =
    record.hookReconciliation &&
    typeof record.hookReconciliation === 'object' &&
    !Array.isArray(record.hookReconciliation)
      ? (record.hookReconciliation as JsonObject)
      : null;
  if (!reconciliation) return [];
  const issues: string[] = [];
  const hookTrust = text(reconciliation.hookTrust);
  const fallbackMode = text(reconciliation.fallbackMode);
  const missingReceipts = objects(reconciliation.missingReceipts);
  const hashMismatches = objects(reconciliation.hashMismatches);
  const noHookFallbackRefs = objects(reconciliation.noHookFallbackRefs);
  const sequenceLedger =
    reconciliation.sequenceLedger &&
    typeof reconciliation.sequenceLedger === 'object' &&
    !Array.isArray(reconciliation.sequenceLedger)
      ? (reconciliation.sequenceLedger as JsonObject)
      : null;
  const sequenceStatus = text(sequenceLedger?.status);
  const fallbackModeAllowed = ['no_hooks', 'bounded_replay', 'blocked'].includes(fallbackMode);
  const fallbackEvidenceRequired = ['no_hooks', 'bounded_replay'].includes(fallbackMode);
  const hookTrustReconciled =
    fallbackModeAllowed &&
    (!fallbackEvidenceRequired || noHookFallbackRefs.length > 0) &&
    (sequenceStatus === '' || sequenceStatus === 'clean' || sequenceStatus === 'reconciled') &&
    missingReceipts.length === 0 &&
    hashMismatches.length === 0 &&
    reconciliation.closeoutReconciled === true;

  if (['degraded', 'untrusted'].includes(hookTrust)) {
    if (!hookTrustReconciled) {
      issues.push(`hook_trust_not_trusted:${hookTrust}`);
    }
    if (!fallbackModeAllowed) {
      issues.push('hook_fallback_mode_missing_for_untrusted:no_hooks_or_bounded_replay_required');
    }
    if (fallbackEvidenceRequired && noHookFallbackRefs.length === 0) {
      issues.push('hook_no_hook_fallback_refs_missing');
    }
  }
  if (sequenceStatus && sequenceStatus !== 'clean' && sequenceStatus !== 'reconciled') {
    issues.push(`hook_sequence_ledger_${sequenceStatus}`);
  }
  for (const receipt of missingReceipts) {
    issues.push(
      `hook_missing_receipt:${text(receipt.receiptType) || '<missing>'}:${text(receipt.expectedEventId) || '<missing>'}`
    );
  }
  for (const mismatch of hashMismatches) {
    issues.push(`hook_hash_mismatch:${text(mismatch.field) || '<missing>'}`);
  }
  if (reconciliation.closeoutReconciled !== true) {
    issues.push('hook_closeout_not_reconciled');
  }
  return [...new Set(issues)];
}

function evaluate(record: JsonObject, attemptId: string): { decision: CloseoutDecision; blockingReasons: string[]; checks: JsonObject[] } {
  const checks: JsonObject[] = [];
  const blockingReasons: string[] = [];
  const readinessPassed = hasImplementationReadinessPass(record);
  checks.push({ id: 'implementation-readiness-gate-passed', passed: readinessPassed });
  if (!readinessPassed) blockingReasons.push('implementation_readiness_gate_not_passed');

  const architectureIssues = architectureConfirmationIssues(record);
  checks.push({
    id: 'architecture-confirmation-current',
    passed: architectureIssues.length === 0,
    issueCount: architectureIssues.length,
  });
  blockingReasons.push(...architectureIssues);

  const allRequiredCommands = objects(deliveryEvidence(record).requiredCommands);
  const requiredCommands = requiredCommandsForAttempt(record, attemptId);
  checks.push({
    id: 'delivery-required-commands-present',
    passed: allRequiredCommands.length > 0,
    count: allRequiredCommands.length,
    currentAttemptCount: requiredCommands.length,
  });
  if (allRequiredCommands.length === 0) blockingReasons.push('deliveryEvidence.requiredCommands_missing');
  if (allRequiredCommands.length > 0 && requiredCommands.length === 0) {
    blockingReasons.push('deliveryEvidence.requiredCommands_current_attempt_missing');
  }

  const scoringBlocked = hasBlockingScoringState(record);
  checks.push({ id: 'score-gates-not-blocking-closeout', passed: !scoringBlocked });
  if (scoringBlocked) blockingReasons.push('score_gate_failure_unresolved');

  const hookIssues = hookReconciliationIssues(record);
  checks.push({
    id: 'hook-reconciliation-valid',
    passed: hookIssues.length === 0,
    issueCount: hookIssues.length,
  });
  blockingReasons.push(...hookIssues);

  const failureCaseIssues = failureCaseCoverageIssues(record);
  checks.push({
    id: 'failure-case-coverage-complete',
    passed: failureCaseIssues.length === 0,
    issueCount: failureCaseIssues.length,
  });
  blockingReasons.push(...failureCaseIssues);

  const attemptRuns = commandRunsForAttempt(record, attemptId);
  for (const command of requiredCommands) {
    const commandId = text(command.commandId);
    const run = attemptRuns.find((candidate) => text(candidate.commandId) === commandId);
    const artifactRefs = objects(command.artifactRefs);
    const artifactIssues = artifactRefs.flatMap((ref) =>
      artifactCompletenessIssues(ref).map((issue) => `required_command_artifact_incomplete:${commandId}:${issue}`)
    );
    const artifactsPresent =
      artifactRefs.length > 0 &&
      artifactIssues.length === 0 &&
      artifactRefs.every((ref) => artifactIndexed(record, ref));
    const passed = Boolean(run) && run?.exitCode === 0 && artifactsPresent && command.blockingIfMissing === true;
    checks.push({
      id: `required-command:${commandId || '<missing>'}`,
      passed,
      runPresent: Boolean(run),
      exitCode: run?.exitCode ?? null,
      artifactsPresent,
      artifactIssues,
      negativeOrRegression: command.negativeOrRegression === true,
    });
    blockingReasons.push(...artifactIssues);
    if (!passed) blockingReasons.push(`required_command_not_satisfied:${commandId || '<missing>'}`);
  }

  const hasNegative = requiredCommands.some((command) => command.negativeOrRegression === true);
  checks.push({ id: 'negative-or-regression-required', passed: hasNegative });
  if (!hasNegative) blockingReasons.push('negative_or_regression_command_missing');

  const openClosures = latestRequirementClosures(record).filter((closure) =>
    ['open', 'fail', 'blocked'].includes(text(closure.status))
  );
  checks.push({ id: 'requirement-closures-terminal', passed: openClosures.length === 0, openCount: openClosures.length });
  if (openClosures.length > 0) blockingReasons.push('requirement_closures_not_terminal');

  const openReruns = objects(record.rerunLoops).filter((loop) =>
    ['open', 'in_progress', 'no_progress', 'blocked'].includes(text(loop.status))
  );
  checks.push({ id: 'rerun-loops-closed', passed: openReruns.length === 0, openCount: openReruns.length });
  if (openReruns.length > 0) blockingReasons.push('pending_rerun_exists');

  const rerunSourceIssues = objects(record.rerunLoops).flatMap(rerunLoopSourceIssues);
  checks.push({
    id: 'rerun-loops-source-authority-valid',
    passed: rerunSourceIssues.length === 0,
    invalidCount: rerunSourceIssues.length,
  });
  blockingReasons.push(...rerunSourceIssues);

  const openFailureRecords = latestFailureRecords(record).filter((record) =>
    ['open', 'in_progress', 'blocked'].includes(text(record.status))
  );
  checks.push({ id: 'failure-records-closed', passed: openFailureRecords.length === 0, openCount: openFailureRecords.length });
  if (openFailureRecords.length > 0) blockingReasons.push('open_failure_record_exists');

  const openRcaRecords = latestRcaRecords(record).filter((record) =>
    ['open', 'in_progress', 'blocked'].includes(text(record.status))
  );
  checks.push({ id: 'rca-actions-closed', passed: openRcaRecords.length === 0, openCount: openRcaRecords.length });
  if (openRcaRecords.length > 0) blockingReasons.push('open_rca_action_exists');

  const decision: CloseoutDecision = blockingReasons.length === 0 ? 'pass' : 'blocked';
  return { decision, blockingReasons, checks };
}

function closeoutFailureSourceRefs(record: JsonObject, attemptId: string, gateCheckId: string): JsonObject[] {
  const refs: JsonObject[] = [
    { sourceType: 'closeout_attempt', id: attemptId },
    { sourceType: 'gate_check', id: gateCheckId },
  ];
  for (const loop of objects(record.rerunLoops)) {
    if (['open', 'in_progress', 'no_progress', 'blocked'].includes(text(loop.status))) {
      refs.push({ sourceType: 'rerun_loop', id: text(loop.rerunLoopId) });
    }
  }
  for (const rca of objects(record.rcaRecords)) {
    if (['open', 'in_progress', 'blocked'].includes(text(rca.status))) {
      refs.push({ sourceType: 'rca_record', id: text(rca.rcaId) });
    }
  }
  return refs.filter((ref) => text(ref.id));
}

function failureRecordsForCloseout(
  record: JsonObject,
  input: {
    attemptId: string;
    gateCheckId: string;
    decision: CloseoutDecision;
    blockingReasons: string[];
    evaluatedAt: string;
    evaluatedBy: string;
  }
): JsonObject[] {
  if (input.decision === 'pass') return objects(record.failureRecords);
  const existing = objects(record.failureRecords);
  const failureId = `failure:${input.attemptId}`;
  if (existing.some((failure) => text(failure.failureId) === failureId)) return existing;
  const sourceRefs = closeoutFailureSourceRefs(record, input.attemptId, input.gateCheckId);
  return [
    ...existing,
    {
      eventType: 'failure_recorded',
      failureId,
      type: 'delivery_closeout_blocked',
      status: 'open',
      closeoutAttemptId: input.attemptId,
      blockingReasons: uniqueStrings(input.blockingReasons),
      sourceRefs,
      recordedAt: input.evaluatedAt,
      recordedBy: input.evaluatedBy,
    },
  ];
}

function rcaRecordsForCloseout(
  record: JsonObject,
  input: {
    attemptId: string;
    decision: CloseoutDecision;
    evaluatedAt: string;
    evaluatedBy: string;
  }
): JsonObject[] {
  if (input.decision === 'pass') return objects(record.rcaRecords);
  const existing = objects(record.rcaRecords);
  const openExisting = existing.some((rca) => ['open', 'in_progress', 'blocked'].includes(text(rca.status)));
  if (openExisting) return existing;
  const rcaId = `rca:${input.attemptId}`;
  if (existing.some((rca) => text(rca.rcaId) === rcaId)) return existing;
  return [
    ...existing,
    {
      eventType: 'rca_created',
      rcaId,
      type: 'closeout_blocker',
      status: 'open',
      sourceRefs: [
        { sourceType: 'failure_record', id: `failure:${input.attemptId}` },
        { sourceType: 'closeout_attempt', id: input.attemptId },
      ],
      recordedAt: input.evaluatedAt,
      recordedBy: input.evaluatedBy,
    },
  ];
}

function updateRecord(record: JsonObject, input: { attemptId: string; decision: CloseoutDecision; blockingReasons: string[]; checks: JsonObject[]; reportPath: string; evaluatedAt: string; evaluatedBy: string }): JsonObject {
  const closeout = record.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
    ? { ...(record.closeout as JsonObject) }
    : {};
  const attempts = objects(closeout.attempts);
  if (attempts.some((attempt) => text(attempt.closeoutAttemptId) === input.attemptId)) {
    throw new Error(`closeout attempt already exists: ${input.attemptId}`);
  }
  const attempt = {
    eventType: 'closeout_check_recorded',
    closeoutAttemptId: input.attemptId,
    decision: input.decision,
    blockingReasons: input.blockingReasons,
    checks: input.checks,
    reportPath: normalizePathForRecord(input.reportPath),
    evaluatedAt: input.evaluatedAt,
    evaluatedBy: input.evaluatedBy,
  };
  const gateCheckId = `delivery-closeout:${input.attemptId}`;
  const gateCheck = {
    eventType: 'gate_check_recorded',
    checkId: gateCheckId,
    gate: 'Delivery Closeout Gate',
    decision: input.decision,
    sourceRefs: [{ sourceType: 'closeout_attempt', id: input.attemptId }],
    recordedAt: input.evaluatedAt,
    recordedBy: input.evaluatedBy,
  };
  const failureRecords = failureRecordsForCloseout(record, {
    ...input,
    gateCheckId,
  });
  const rcaRecords = rcaRecordsForCloseout(record, input);
  return {
    ...record,
    closeout: {
      ...closeout,
      currentAttemptId: input.attemptId,
      attempts: [...attempts, attempt],
      decision: input.decision,
      updatedAt: input.evaluatedAt,
    },
    gateChecks: [...objects(record.gateChecks), gateCheck],
    failureRecords,
    rcaRecords,
    lastEventType: 'closeout_check_recorded',
    updatedAt: input.evaluatedAt,
  };
}

export function mainDeliveryCloseoutGate(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: main-agent-delivery-closeout-gate --requirement-record <json> [--attempt-id <id>] [--json]');
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = args.evaluatedBy ?? 'agent';
  const attemptId = args.attemptId ?? `closeout-${Date.now()}`;
  const existingCloseout =
    record.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
      ? (record.closeout as JsonObject)
      : {};
  if (objects(existingCloseout.attempts).some((attempt) => text(attempt.closeoutAttemptId) === attemptId)) {
    console.error(JSON.stringify({ ok: false, error: `closeout attempt already exists: ${attemptId}` }, null, 2));
    return 2;
  }
  const reportPath = path.resolve(args.reportPath ?? path.join(path.dirname(recordPath), 'delivery-closeout-report.json'));
  const evaluation = evaluate(record, attemptId);
  const report = {
    reportType: 'delivery_closeout_report',
    generatedAt: evaluatedAt,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    currentAttemptId: attemptId,
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const nextRecord = updateRecord(record, {
    attemptId,
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
    reportPath,
    evaluatedAt,
    evaluatedBy,
  });
  fs.writeFileSync(recordPath, `${JSON.stringify(nextRecord, null, 2)}\n`, 'utf8');
  appendJsonl(path.join(path.dirname(recordPath), 'data', 'mentor-events.jsonl'), nextRecord.closeout as JsonObject);
  const output = { ok: true, reportPath: normalizePathForRecord(reportPath), decision: evaluation.decision, blockingReasons: evaluation.blockingReasons };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `delivery_closeout=${evaluation.decision}\n`);
  return evaluation.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainDeliveryCloseoutGate(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
