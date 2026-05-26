/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveArchitectureConfirmationHashRecipe } from './architecture-confirmation-hash-recipe';
import {
  evaluateAiTddContractGate,
} from './ai-tdd-contract-gate';
import { appendControlEventAndReplay, sha256Text } from './requirement-record-control-store';

type JsonObject = Record<string, unknown>;
type ReadinessDecision = 'pass' | 'blocked';
type ImplementationRunKind = 'first-implementation' | 'rerun';

interface ParsedArgs {
  requirementRecord?: string;
  source?: string;
  implementationRunKind?: string;
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

function nested(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function unique(values: string[]): string[] {
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

function normalizeImplementationRunKind(value: unknown): ImplementationRunKind | '' {
  const raw = text(value);
  if (raw === 'first-implementation' || raw === 'first_implementation' || raw === 'first') {
    return 'first-implementation';
  }
  if (raw === 'rerun' || raw === 're-run' || raw === 'resume') return 'rerun';
  return '';
}

function inferImplementationRunKind(record: JsonObject): {
  kind: ImplementationRunKind | '';
  inferred: boolean;
  evidence: string[];
  blockingReasons: string[];
} {
  const controlledHints = unique([
    normalizeImplementationRunKind(record.implementationRunKind),
    normalizeImplementationRunKind(nested(record.implementationEntryGate).implementationRunKind),
  ]);
  if (controlledHints.length > 1) {
    return {
      kind: '',
      inferred: false,
      evidence: controlledHints,
      blockingReasons: ['implementation_run_kind_conflict'],
    };
  }
  if (controlledHints.length === 1) {
    return { kind: controlledHints[0] as ImplementationRunKind, inferred: false, evidence: controlledHints, blockingReasons: [] };
  }
  const evidence = [
    objects(record.executionIterations).length > 0 ? 'executionIterations' : '',
    objects(record.requirementClosures).length > 0 ? 'requirementClosures' : '',
    objects(record.rerunLoops).length > 0 ? 'rerunLoops' : '',
    objects(nested(record.closeout).attempts).length > 0 ? 'closeout.attempts' : '',
    objects(nested(record.deliveryEvidence).requiredCommands).length > 0 ? 'deliveryEvidence.requiredCommands' : '',
    objects(record.artifactIndex).length > 0 ? 'artifactIndex' : '',
  ].filter(Boolean);
  return {
    kind: evidence.length > 0 ? 'rerun' : 'first-implementation',
    inferred: true,
    evidence,
    blockingReasons: [],
  };
}

function resolveImplementationRunKind(
  record: JsonObject,
  explicit?: string
): ReturnType<typeof inferImplementationRunKind> {
  const explicitKind = normalizeImplementationRunKind(explicit);
  if (explicit && !explicitKind) {
    return {
      kind: '',
      inferred: false,
      evidence: [explicit],
      blockingReasons: ['implementation_run_kind_invalid'],
    };
  }
  if (explicitKind) return { kind: explicitKind, inferred: false, evidence: ['cli'], blockingReasons: [] };
  return inferImplementationRunKind(record);
}

function resolveSourcePath(record: JsonObject, explicit?: string): string {
  const candidate = text(explicit) || text(record.sourcePath) || text(latestConfirmation(record)?.sourcePath);
  if (!candidate) return '';
  const resolved = path.resolve(candidate);
  return fs.existsSync(resolved) ? resolved : '';
}

function resolveRenderReportPath(record: JsonObject): string {
  const confirmation = latestConfirmation(record);
  const candidates = [
    text(confirmation?.renderReportPath),
    text(nested(record.confirmationRender).reportPath),
    text(record.renderReportPath),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved)) return resolved;
  }
  return '';
}

function resolveRequirementsContractAuthoringScript(cwd: string, relativeScript: string): string {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const packageRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.join(cwd, '.codex', 'skills', 'requirements-contract-authoring'),
    path.join(cwd, '.cursor', 'skills', 'requirements-contract-authoring'),
    path.join(cwd, '.claude', 'skills', 'requirements-contract-authoring'),
    path.join(cwd, '_bmad', 'skills', 'requirements-contract-authoring'),
    path.join(cwd, '.agents', 'skills', 'requirements-contract-authoring'),
    path.join(packageRoot, '.codex', 'skills', 'requirements-contract-authoring'),
    path.join(packageRoot, '.cursor', 'skills', 'requirements-contract-authoring'),
    path.join(packageRoot, '.claude', 'skills', 'requirements-contract-authoring'),
    path.join(packageRoot, '_bmad', 'skills', 'requirements-contract-authoring'),
    ...(home
      ? [
          path.join(home, '.codex', 'skills', 'requirements-contract-authoring'),
          path.join(home, '.cursor', 'skills', 'requirements-contract-authoring'),
          path.join(home, '.claude', 'skills', 'requirements-contract-authoring'),
          path.join(home, '.agents', 'skills', 'requirements-contract-authoring'),
        ]
      : []),
  ];
  for (const skillDir of candidates) {
    if (!fs.existsSync(path.join(skillDir, 'SKILL.md'))) continue;
    const scriptPath = path.join(skillDir, 'scripts', relativeScript);
    if (fs.existsSync(scriptPath)) return scriptPath;
  }
  return path.join(candidates[0], 'scripts', relativeScript);
}

function runImplementationReadinessStageAudit(
  record: JsonObject,
  input: { sourcePath?: string; cwd?: string }
): { check: JsonObject; blockingReasons: string[] } {
  const cwd = input.cwd ? path.resolve(input.cwd) : process.cwd();
  const scriptPath = resolveRequirementsContractAuthoringScript(cwd, 'audit_implementation_readiness.js');
  const sourcePath = resolveSourcePath(record, input.sourcePath);
  const renderReportPath = resolveRenderReportPath(record);
  const missingReasons = [
    fs.existsSync(scriptPath) ? '' : 'implementation_readiness_stage_audit_script_missing',
    sourcePath ? '' : 'implementation_readiness_stage_audit_source_missing',
    renderReportPath ? '' : 'implementation_readiness_stage_audit_render_report_missing',
  ].filter(Boolean);
  if (missingReasons.length > 0) {
    return {
      check: {
        id: 'implementation-readiness-stage-audit',
        passed: false,
        scriptPath: normalizePathForRecord(scriptPath),
        sourcePath: sourcePath ? normalizePathForRecord(sourcePath) : null,
        renderReportPath: renderReportPath ? normalizePathForRecord(renderReportPath) : null,
        blockingReasons: missingReasons,
      },
      blockingReasons: missingReasons,
    };
  }

  const result = spawnSync(
    process.execPath,
    [scriptPath, sourcePath, '--render-report', renderReportPath, '--json'],
    {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        BMAD_SPECKIT_PACKAGE_ROOT: path.resolve(__dirname, '..'),
        NODE_PATH: [path.join(path.resolve(__dirname, '..'), 'node_modules'), process.env.NODE_PATH]
          .filter(Boolean)
          .join(path.delimiter),
      },
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  let report: JsonObject | null = null;
  try {
    const parsed = JSON.parse(result.stdout || '{}') as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      report = parsed as JsonObject;
    }
  } catch {
    report = null;
  }
  const failedChecks = strings(report?.failedChecks);
  const currentHashes = nested(report?.currentHashes);
  const hashMismatchReasons = [
    text(currentHashes.sourceDocumentHash) === text(record.sourceDocumentHash)
      ? ''
      : 'implementation_readiness_stage_audit_source_hash_mismatch',
    text(currentHashes.implementationConfirmationHash) === text(record.implementationConfirmationHash)
      ? ''
      : 'implementation_readiness_stage_audit_implementation_hash_mismatch',
    text(currentHashes.reportConfirmationPageHash) === text(record.confirmationPageHash)
      ? ''
      : 'implementation_readiness_stage_audit_confirmation_page_hash_mismatch',
  ].filter(Boolean);
  const passed = result.status === 0 && text(report?.verdict) === 'PASS' && hashMismatchReasons.length === 0;
  const blockingReasons = passed
    ? []
    : unique([
        'implementation_readiness_stage_audit_failed',
        ...failedChecks.map((check) => `stage_audit_${check}`),
        ...hashMismatchReasons,
      ]);
  return {
    check: {
      id: 'implementation-readiness-stage-audit',
      passed,
      scriptPath: normalizePathForRecord(scriptPath),
      sourcePath: normalizePathForRecord(sourcePath),
      renderReportPath: normalizePathForRecord(renderReportPath),
      exitCode: result.status ?? 2,
      verdict: text(report?.verdict) || null,
      failedChecks,
      currentHashes,
      stageAudit: nested(report?.stageAudit),
      blockingReasons,
      stderr: text(result.stderr) || undefined,
    },
    blockingReasons,
  };
}

function evaluate(record: JsonObject, input: {
  recordPath: string;
  sourcePath?: string;
  implementationRunKind?: string;
  evaluatedAt: string;
  evaluatedBy: string;
}): {
  decision: ReadinessDecision;
  blockingReasons: string[];
  checks: JsonObject[];
} {
  const checks: JsonObject[] = [];
  const blockingReasons: string[] = [];
  const runKind = resolveImplementationRunKind(record, input.implementationRunKind);
  checks.push({
    id: 'implementation-run-kind-resolved',
    passed: runKind.blockingReasons.length === 0,
    implementationRunKind: runKind.kind,
    inferred: runKind.inferred,
    evidence: runKind.evidence,
    blockingReasons: runKind.blockingReasons,
  });
  blockingReasons.push(...runKind.blockingReasons);

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

  const resolvedSourcePath = resolveSourcePath(record, input.sourcePath);
  const stageAudit = runImplementationReadinessStageAudit(record, {
    sourcePath: input.sourcePath,
  });
  checks.push(stageAudit.check);
  blockingReasons.push(...stageAudit.blockingReasons);

  if (!resolvedSourcePath) {
    checks.push({
      id: 'ai-tdd-contract-gate-source',
      passed: false,
      blockingReasons: ['ai_tdd_contract_gate_source_missing'],
    });
    blockingReasons.push('ai_tdd_contract_gate_source_missing');
  } else if (!runKind.kind || runKind.blockingReasons.length > 0) {
    checks.push({
      id: 'ai-tdd-contract-gate-run-kind',
      passed: false,
      blockingReasons: ['ai_tdd_contract_gate_run_kind_unresolved', ...runKind.blockingReasons],
    });
    blockingReasons.push('ai_tdd_contract_gate_run_kind_unresolved');
  } else {
    const mode = runKind.kind === 'first-implementation' ? 'pre-implementation' : 'pre-rerun';
    try {
      const aiTddGate = evaluateAiTddContractGate({
        sourcePath: resolvedSourcePath,
        record,
        recordPath: input.recordPath,
        mode,
        attemptId: `implementation-readiness:${input.evaluatedAt}`,
        evaluatedAt: input.evaluatedAt,
        evaluatedBy: input.evaluatedBy,
      });
      const preImplementationReadiness = nested(aiTddGate.preImplementationReadinessReport);
      const closeoutReadiness = nested(aiTddGate.closeoutReadinessReport);
      const passed =
        runKind.kind === 'first-implementation'
          ? preImplementationReadiness.ready === true
          : text(aiTddGate.decision) === 'pass';
      const aiTddBlockers =
        runKind.kind === 'first-implementation'
          ? strings(preImplementationReadiness.blockingReasons)
          : strings(aiTddGate.blockingReasons);
      checks.push({
        id: `ai-tdd-contract-gate-${mode}`,
        passed,
        implementationRunKind: runKind.kind,
        mode,
        decision: text(aiTddGate.decision),
        closeoutReady: closeoutReadiness.ready === true,
        preImplementationReady: preImplementationReadiness.ready === true,
        blockingReasons: aiTddBlockers,
      });
      if (!passed) {
        blockingReasons.push(
          runKind.kind === 'first-implementation'
            ? 'ai_tdd_pre_implementation_readiness_not_ready'
            : 'ai_tdd_pre_rerun_gate_not_passed',
          ...aiTddBlockers
        );
      }
    } catch (error) {
      checks.push({
        id: 'ai-tdd-contract-gate-evaluation',
        passed: false,
        blockingReasons: ['ai_tdd_contract_gate_evaluation_failed'],
        error: error instanceof Error ? error.message : String(error),
      });
      blockingReasons.push('ai_tdd_contract_gate_evaluation_failed');
    }
  }

  return {
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons: unique(blockingReasons),
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
      readinessBaselineActivationEventType: 'readiness_baseline_activation_requested',
      updatedAt: input.evaluatedAt,
    }),
  });
}

export function mainImplementationReadinessGate(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: main-agent-implementation-readiness-gate --requirement-record <json> [--source <requirement.md>] [--implementation-run-kind <first-implementation|rerun>] [--json]'
    );
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
  const evaluation = evaluate(record, {
    recordPath,
    sourcePath: args.source,
    implementationRunKind: args.implementationRunKind,
    evaluatedAt,
    evaluatedBy,
  });
  const report = {
    reportType: 'implementation_readiness_report',
    generatedAt: evaluatedAt,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    implementationRunKind: normalizeImplementationRunKind(args.implementationRunKind) || inferImplementationRunKind(record).kind,
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
