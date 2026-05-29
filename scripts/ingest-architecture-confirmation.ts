/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  architectureConfirmationHashFor,
  resolveArchitectureConfirmationHashRecipe,
} from './architecture-confirmation-hash-recipe';
import { appendControlEventAndReplay, type ControlCommitResult } from './requirement-record-control-store';

type JsonObject = Record<string, unknown>;

const NEXT_MODEL: Record<string, string> = {
  requirement_confirmation: 'architecture_confirmation',
  architecture_confirmation: 'implementation_readiness',
  implementation_readiness: 'execution_closure',
  execution_closure: 'audit_review',
  audit_review: 'delivery_confirmation',
};

interface ParsedArgs {
  architectureConfirmation?: string;
  renderReport?: string;
  requirementRecord?: string;
  confirmationText?: string;
  confirmationTextFile?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  eventLog?: string;
  artifactIndex?: string;
  action?: string;
  json?: boolean;
  help?: boolean;
}

function isDirectArchitectureConfirmationIngestCli(entry: string | undefined): boolean {
  return /(^|[\\/])ingest-architecture-confirmation(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    if (arg === '--json') {
      out.json = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    (out as Record<string, string | boolean | undefined>)[key] = value;
    index += 1;
  }
  return out;
}

function requireArgs(args: ParsedArgs): void {
  const required: Array<keyof ParsedArgs> = [
    'architectureConfirmation',
    'renderReport',
    'requirementRecord',
    'confirmedBy',
  ];
  const missing = required.filter((key) => !args[key]);
  if (missing.length > 0) {
    throw new Error(`missing required args: ${missing.join(', ')}`);
  }
  if (!args.confirmationText && !args.confirmationTextFile) {
    throw new Error('missing required args: confirmationText or confirmationTextFile');
  }
  if (args.confirmationText && args.confirmationTextFile) {
    throw new Error('provide only one of confirmationText or confirmationTextFile');
  }
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readRenderEvidence(reportPath: string): JsonObject {
  const report = readJson(reportPath);
  const summaryPath = refPath(report.summaryPath);
  if (!summaryPath) {
    return report;
  }
  const candidates = path.isAbsolute(summaryPath)
    ? [summaryPath]
    : [path.resolve(process.cwd(), summaryPath), path.resolve(path.dirname(reportPath), summaryPath)];
  const absoluteSummaryPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!absoluteSummaryPath) {
    return report;
  }
  const summary = readJson(absoluteSummaryPath);
  return {
    ...summary,
    ...report,
    confirmability: report.confirmability ?? summary.confirmability,
    resolvedRecipeHash: report.resolvedRecipeHash ?? summary.resolvedRecipeHash,
    sourcePath: report.sourcePath ?? summary.sourcePath,
  };
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function parseConfirmationText(text: string): JsonObject {
  const values: JsonObject = {};
  for (const key of [
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'resolvedRecipeHash',
    'architectureConfirmationArtifactHash',
  ]) {
    const match = text.match(new RegExp(`${key}=(sha256:[a-f0-9]{64})`, 'iu'));
    if (!match) {
      throw new Error(`confirmation text missing ${key}`);
    }
    values[key] = match[1];
  }
  return values;
}

function confirmationTextFromArgs(args: ParsedArgs): string {
  if (args.confirmationTextFile) {
    return fs.readFileSync(path.resolve(args.confirmationTextFile), 'utf8');
  }
  return String(args.confirmationText ?? '');
}

function ensureString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`missing ${field}`);
  }
  return value;
}

function refPath(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidate = (value as JsonObject).path;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return null;
}

function appendJsonl(file: string, value: JsonObject): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function hasSixModelRuntime(record: JsonObject): boolean {
  return (
    typeof record.currentMentalModel === 'string' &&
    object(record.sixModelResults).requirement_confirmation !== undefined
  );
}

function sameArchitectureConfirmationAlreadyRecorded(record: JsonObject, event: JsonObject): boolean {
  const state = object(record.architectureConfirmationState);
  return (
    text(state.status) === 'active' &&
    text(state.currentArchitectureConfirmationRunId) === text(event.runId) &&
    text(state.currentArchitectureConfirmationHash) === text(event.architectureConfirmationArtifactHash)
  );
}

function modelResultForArchitectureConfirmation(
  record: JsonObject,
  event: JsonObject,
  recordedAt: string,
  recordedBy: string
): JsonObject {
  return {
    payloadKind: 'model_result',
    model: 'architecture_confirmation',
    recordId: text(event.recordId) || text(record.recordId),
    requirementSetId: text(event.requirementSetId) || text(record.requirementSetId) || text(record.recordId),
    sourceDocumentHash: text(event.sourceDocumentHash) || text(record.sourceDocumentHash),
    implementationConfirmationHash:
      text(event.implementationConfirmationHash) || text(record.implementationConfirmationHash),
    status: 'pass',
    resultRecordedAt: recordedAt,
    resultRecordedBy: recordedBy,
    blockingReasons: [],
    sourceRefs: [
      {
        sourceType: 'architecture_confirmation',
        id: text(event.architectureConfirmationArtifactHash),
      },
    ],
    currentHashes: {
      sourceDocumentHash: text(event.sourceDocumentHash) || text(record.sourceDocumentHash),
      implementationConfirmationHash:
        text(event.implementationConfirmationHash) || text(record.implementationConfirmationHash),
      resolvedRecipeHash: text(event.resolvedRecipeHash),
      architectureConfirmationArtifactHash: text(event.architectureConfirmationArtifactHash),
      targetPathsHash: text(event.targetPathsHash),
      consumerImpactScanHash: text(event.consumerImpactScanHash),
      governanceImpactScanHash: text(event.governanceImpactScanHash),
    },
  };
}

function hasOpenBlockingReconfirmation(record: JsonObject): boolean {
  return objects(record.reconfirmationRequests).some((request) =>
    ['blocking_open', 'open', 'in_progress'].includes(text(request.status))
  );
}

function hasOpenRerun(record: JsonObject): boolean {
  return objects(record.rerunLoops).some((loop) =>
    ['open', 'in_progress', 'no_progress', 'blocked'].includes(text(loop.status))
  );
}

function hasPendingBlockerIntake(record: JsonObject): boolean {
  if (objects(record.pendingBlockerIntake).length > 0) return true;
  return objects(record.blockerIntakeRuns).some((run) => !['closed', 'resolved', 'pass'].includes(text(run.status)));
}

function appendMentalModelTransition(input: {
  recordPath: string;
  fromModel: string;
  toModel: string;
  recordedAt: string;
  recordedBy: string;
  sourceRefs: JsonObject[];
}): ControlCommitResult | null {
  const current = readJson(input.recordPath);
  if (!hasSixModelRuntime(current) || text(current.currentMentalModel) !== input.fromModel) {
    return null;
  }
  return appendControlEventAndReplay({
    recordPath: input.recordPath,
    writerId: 'architecture-confirmation-ingest',
    eventType: 'mental_model_transition_recorded',
    recordedAt: input.recordedAt,
    payload: {
      eventType: 'mental_model_transition_recorded',
      recordId: text(current.recordId),
      requirementSetId: text(current.requirementSetId) || text(current.recordId),
      fromModel: input.fromModel,
      toModel: input.toModel,
      sourceDocumentHash: text(current.sourceDocumentHash),
      implementationConfirmationHash: text(current.implementationConfirmationHash),
      recordedAt: input.recordedAt,
      recordedBy: input.recordedBy,
      sourceRefs: input.sourceRefs,
    },
    reduce: (record, payload) => {
      if (record.currentMentalModel !== payload.fromModel) {
        throw new Error('mental_model_transition_from_model_mismatch');
      }
      if (NEXT_MODEL[String(payload.fromModel)] !== payload.toModel) {
        throw new Error('mental_model_transition_order_violation');
      }
      if (hasOpenBlockingReconfirmation(record)) {
        throw new Error('mental_model_transition_blocked_by_open_reconfirmation');
      }
      if (hasOpenRerun(record)) {
        throw new Error('mental_model_transition_blocked_by_open_rerun');
      }
      if (hasPendingBlockerIntake(record)) {
        throw new Error('mental_model_transition_blocked_by_pending_blocker_intake');
      }
      const results = object(record.sixModelResults);
      const currentResult = object(results[String(payload.fromModel)]);
      if (text(currentResult.status) !== 'pass') {
        throw new Error('mental_model_transition_requires_current_model_pass');
      }
      return {
        ...record,
        currentMentalModel: payload.toModel,
        stage: payload.toModel,
        currentStage: payload.toModel,
        mentalModelTransitions: [...objects(record.mentalModelTransitions), payload],
        lastEventType: 'mental_model_transition_recorded',
        updatedAt: input.recordedAt,
      };
    },
  });
}

function appendArchitectureConfirmationResult(input: {
  recordPath: string;
  event: JsonObject;
  recordedAt: string;
  recordedBy: string;
}): ControlCommitResult | null {
  const current = readJson(input.recordPath);
  if (!hasSixModelRuntime(current)) return null;
  const existingResult = object(object(current.sixModelResults).architecture_confirmation);
  if (
    text(existingResult.status) === 'pass' &&
    text(object(existingResult.currentHashes).architectureConfirmationArtifactHash) ===
      text(input.event.architectureConfirmationArtifactHash)
  ) {
    return null;
  }
  const result = modelResultForArchitectureConfirmation(
    current,
    input.event,
    input.recordedAt,
    input.recordedBy
  );
  return appendControlEventAndReplay({
    recordPath: input.recordPath,
    writerId: 'architecture-confirmation-ingest',
    eventType: 'six_model_results_recorded',
    recordedAt: input.recordedAt,
    payload: {
      eventType: 'six_model_results_recorded',
      ...result,
    },
    reduce: (record, payload) => ({
      ...record,
      sixModelResults: {
        ...object(record.sixModelResults),
        architecture_confirmation: modelResultForArchitectureConfirmation(
          record,
          input.event,
          input.recordedAt,
          input.recordedBy
        ),
      },
      lastEventType: 'six_model_results_recorded',
      updatedAt: input.recordedAt,
    }),
  });
}

function appendArchitectureConfirmationModelProgression(input: {
  recordPath: string;
  event: JsonObject;
  recordedAt: string;
  recordedBy: string;
}): ControlCommitResult[] {
  const initial = readJson(input.recordPath);
  if (!hasSixModelRuntime(initial)) return [];
  const sourceRefs = [
    {
      sourceType: 'architecture_confirmation',
      id: text(input.event.architectureConfirmationArtifactHash),
    },
  ];
  const commits: ControlCommitResult[] = [];
  const firstTransition = appendMentalModelTransition({
    recordPath: input.recordPath,
    fromModel: 'requirement_confirmation',
    toModel: 'architecture_confirmation',
    recordedAt: input.recordedAt,
    recordedBy: input.recordedBy,
    sourceRefs,
  });
  if (firstTransition) commits.push(firstTransition);
  const resultCommit = appendArchitectureConfirmationResult(input);
  if (resultCommit) commits.push(resultCommit);
  const secondTransition = appendMentalModelTransition({
    recordPath: input.recordPath,
    fromModel: 'architecture_confirmation',
    toModel: 'implementation_readiness',
    recordedAt: input.recordedAt,
    recordedBy: input.recordedBy,
    sourceRefs,
  });
  if (secondTransition) commits.push(secondTransition);
  return commits;
}

function validate(input: {
  architectureConfirmation: JsonObject;
  renderReport: JsonObject;
  requirementRecord: JsonObject;
  confirmationText: string;
  architecturePath: string;
  reportPath: string;
}): { event: JsonObject; mismatches: string[] } {
  const confirmation = input.architectureConfirmation;
  const report = input.renderReport;
  const record = input.requirementRecord;
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const provided = parseConfirmationText(input.confirmationText);
  const computedArtifactHash = architectureConfirmationHashFor(confirmation, recipe);
  const declaredArtifactHash = ensureString(
    confirmation.architectureConfirmationArtifactHash ?? confirmation.artifactHash,
    'architectureConfirmationArtifactHash'
  );
  const mismatches: string[] = [];

  if (confirmation.architectureConfirmationHashRecipe && typeof confirmation.architectureConfirmationHashRecipe === 'object') {
    const snapshot = confirmation.architectureConfirmationHashRecipe as JsonObject;
    if (snapshot.recipeVersion !== recipe.recipeVersion) {
      mismatches.push('architecture_confirmation_recipe_version_mismatch');
    }
  } else {
    mismatches.push('architecture_confirmation_recipe_snapshot_missing');
  }
  if (confirmation.resolvedRecipeHash !== recipe.resolvedRecipeHash) {
    mismatches.push('architecture_confirmation_resolved_recipe_hash_mismatch');
  }
  if (report.resolvedRecipeHash !== recipe.resolvedRecipeHash) {
    mismatches.push('render_report_current_resolved_recipe_hash_mismatch');
  }
  if (report.confirmability !== 'confirmable') {
    mismatches.push('render_report_not_confirmable');
  }
  if (computedArtifactHash !== declaredArtifactHash) {
    mismatches.push('architecture_confirmation_artifact_hash_mismatch');
  }
  if (report.architectureConfirmationArtifactHash !== declaredArtifactHash) {
    mismatches.push('render_report_architecture_confirmation_artifact_hash_mismatch');
  }
  if (provided.architectureConfirmationArtifactHash !== declaredArtifactHash) {
    mismatches.push('confirmation_text_architecture_confirmation_artifact_hash_mismatch');
  }
  for (const field of [
    'sourceDocumentHash',
    'implementationConfirmationHash',
  ]) {
    if (record[field] !== confirmation[field]) {
      mismatches.push(`record_${field}_mismatch`);
    }
    if (report[field] !== confirmation[field]) {
      mismatches.push(`render_report_${field}_mismatch`);
    }
    if (provided[field] !== confirmation[field]) {
      mismatches.push(`confirmation_text_${field}_mismatch`);
    }
  }
  if (provided.resolvedRecipeHash !== confirmation.resolvedRecipeHash) {
    mismatches.push('confirmation_text_resolved_recipe_hash_mismatch');
  }
  if (report.resolvedRecipeHash !== confirmation.resolvedRecipeHash) {
    mismatches.push('render_report_resolved_recipe_hash_mismatch');
  }

  const recordId = ensureString(confirmation.recordId, 'recordId');
  const requirementSetId = ensureString(
    confirmation.requirementSetId ?? record.requirementSetId,
    'requirementSetId'
  );
  if (record.recordId && record.recordId !== recordId) {
    mismatches.push('record_id_mismatch');
  }
  if (record.requirementSetId && record.requirementSetId !== requirementSetId) {
    mismatches.push('requirement_set_id_mismatch');
  }
  const staleInputs = {
    ...object(confirmation.staleInputs),
    sourceDocumentHash: confirmation.sourceDocumentHash,
    implementationConfirmationHash: confirmation.implementationConfirmationHash,
    targetPathsHash: confirmation.targetPathsHash,
    consumerImpactScanHash: confirmation.consumerImpactScanHash,
    governanceImpactScanHash: confirmation.governanceImpactScanHash,
    currentArtifactHash: declaredArtifactHash,
    resolvedRecipeHash: confirmation.resolvedRecipeHash,
  };

  return {
    mismatches,
    event: {
      eventType: 'architecture_confirmation_recorded',
      recordId,
      requirementSetId,
      runId: confirmation.runId ?? null,
      decision: confirmation.decision ?? 'full_architecture_confirmed',
      sourceDocumentHash: confirmation.sourceDocumentHash,
      implementationConfirmationHash: confirmation.implementationConfirmationHash,
      resolvedRecipeHash: confirmation.resolvedRecipeHash,
      architectureConfirmationHashRecipe: confirmation.architectureConfirmationHashRecipe,
      architectureConfirmationArtifactHash: declaredArtifactHash,
      targetPathsHash: confirmation.targetPathsHash,
      consumerImpactScanHash: confirmation.consumerImpactScanHash,
      governanceImpactScanHash: confirmation.governanceImpactScanHash,
      staleInputs,
      artifactRef: confirmation.architectureConfirmationArtifactRef,
      architectureConfirmationPath: normalizePathForRecord(input.architecturePath),
      renderReportPath: normalizePathForRecord(input.reportPath),
      htmlPath: refPath(report.htmlRef),
      confirmationText: input.confirmationText,
    },
  };
}

function updateRecord(record: JsonObject, event: JsonObject, confirmedAt: string, confirmedBy: string): JsonObject {
  const architectureConfirmations = Array.isArray(record.architectureConfirmations)
    ? [...record.architectureConfirmations]
    : [];
  const architectureConfirmationState =
    record.architectureConfirmationState &&
    typeof record.architectureConfirmationState === 'object' &&
    !Array.isArray(record.architectureConfirmationState)
      ? { ...(record.architectureConfirmationState as JsonObject) }
      : {};
  const entry = {
    ...event,
    confirmedAt,
    confirmedBy,
  };
  architectureConfirmations.push(entry);
  return {
    ...record,
    architectureConfirmations,
    architectureConfirmationState: {
      ...architectureConfirmationState,
      status: 'active',
      currentArchitectureConfirmationRunId: event.runId,
      currentArchitectureConfirmationHash: event.architectureConfirmationArtifactHash,
      currentArchitectureConfirmationPath: event.architectureConfirmationPath,
      resolvedRecipeHash: event.resolvedRecipeHash,
      staleInputs: event.staleInputs,
      lastEventType: 'architecture_confirmation_recorded',
      updatedAt: confirmedAt,
    },
    lastEventType: 'architecture_confirmation_recorded',
    updatedAt: confirmedAt,
  };
}

function stateHashMap(value: unknown): JsonObject {
  return object(value);
}

function architectureStateCheck(record: JsonObject, checkedAt: string, checkedBy: string): {
  nextRecord: JsonObject;
  event: JsonObject;
  mismatches: string[];
  decision: 'pass' | 'fail' | 'blocked';
} {
  const recipe = resolveArchitectureConfirmationHashRecipe();
  const state = object(record.architectureConfirmationState);
  const staleInputs = stateHashMap(state.staleInputs);
  const currentHashes = {
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    targetPathsHash: text(staleInputs.targetPathsHash),
    consumerImpactScanHash: text(staleInputs.consumerImpactScanHash),
    governanceImpactScanHash: text(staleInputs.governanceImpactScanHash),
    currentArtifactHash: text(state.currentArchitectureConfirmationHash),
    resolvedRecipeHash: recipe.resolvedRecipeHash,
  };
  const previousHashes = {
    sourceDocumentHash: text(staleInputs.sourceDocumentHash),
    implementationConfirmationHash: text(staleInputs.implementationConfirmationHash),
    targetPathsHash: text(staleInputs.targetPathsHash),
    consumerImpactScanHash: text(staleInputs.consumerImpactScanHash),
    governanceImpactScanHash: text(staleInputs.governanceImpactScanHash),
    currentArtifactHash: text(state.currentArchitectureConfirmationHash),
    resolvedRecipeHash: text(state.resolvedRecipeHash),
  };
  const mismatchFields = Object.keys(currentHashes).filter(
    (field) => text(previousHashes[field as keyof typeof previousHashes]) !== text(currentHashes[field as keyof typeof currentHashes])
  );
  const missingState = !text(state.currentArchitectureConfirmationHash) || !text(state.currentArchitectureConfirmationRunId);
  const fromStatus = text(state.status) || 'missing';
  const toStatus = missingState ? 'missing' : mismatchFields.length > 0 ? 'stale' : 'active';
  const decision: 'pass' | 'fail' | 'blocked' = missingState ? 'blocked' : mismatchFields.length > 0 ? 'fail' : 'pass';
  const event = {
    eventType: 'architecture_confirmation_state_checked',
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    checkId: `architecture-state:${checkedAt}`,
    decision,
    resolvedRecipeHash: recipe.resolvedRecipeHash,
    stateTransition: {
      fromStatus,
      toStatus,
      reasonCode: missingState ? 'current_confirmation_missing' : mismatchFields.length > 0 ? 'hash_mismatch' : 'hash_match',
      previousHashes,
      currentHashes,
      mismatchFields,
      recipeVersion: recipe.recipeVersion,
    },
    checkedAt,
    checkedBy,
  };
  const nextState = {
    ...state,
    status: toStatus,
    resolvedRecipeHash: recipe.resolvedRecipeHash,
    lastEventType: 'architecture_confirmation_state_checked',
    updatedAt: checkedAt,
  };
  return {
    decision,
    event,
    mismatches: strings(event.stateTransition.mismatchFields),
    nextRecord: {
      ...record,
      architectureConfirmationState: nextState,
      architectureConfirmationStateChecks: [
        ...objects(record.architectureConfirmationStateChecks),
        event,
      ],
      gateChecks: [
        ...objects(record.gateChecks),
        {
          eventType: 'gate_check_recorded',
          checkId: event.checkId,
          gate: 'architecture_confirmation_state',
          decision,
          sourceRefs: [{ sourceType: 'architecture_confirmation', id: text(state.currentArchitectureConfirmationRunId) }],
          recordedAt: checkedAt,
          recordedBy: checkedBy,
        },
      ],
      lastEventType: 'architecture_confirmation_state_checked',
      updatedAt: checkedAt,
    },
  };
}

export function mainIngestArchitectureConfirmation(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: node ingest-architecture-confirmation.ts --architecture-confirmation <json> --render-report <json> --requirement-record <json> --confirmation-text <text> --confirmed-by <user> [--json]'
    );
    return 0;
  }
  if (args.action === 'check-state') {
    if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
    const recordPath = path.resolve(args.requirementRecord);
    if (!fs.existsSync(recordPath)) throw new Error(`requirement record missing: ${recordPath}`);
    const record = readJson(recordPath);
    const checkedAt = args.confirmedAt ?? new Date().toISOString();
    const checkedBy = args.confirmedBy ?? 'agent';
    const result = architectureStateCheck(record, checkedAt, checkedBy);
    const output = {
      ok: result.decision === 'pass',
      event: result.event,
      mismatches: result.mismatches,
      requirementRecordPath: normalizePathForRecord(recordPath),
      diagnosticOnly: true,
      eventLogPath: null,
      controlEventId: null,
      controlEventHash: null,
      receiptPath: null,
    };
    process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `architecture_confirmation_state=${result.decision}\n`);
    return result.decision === 'pass' ? 0 : 1;
  }
  requireArgs(args);

  const architecturePath = path.resolve(args.architectureConfirmation!);
  const reportPath = path.resolve(args.renderReport!);
  const recordPath = path.resolve(args.requirementRecord!);
  if (!fs.existsSync(recordPath)) throw new Error(`requirement record missing: ${recordPath}`);
  const confirmation = readJson(architecturePath);
  const report = readRenderEvidence(reportPath);
  const record = readJson(recordPath);
  const confirmedAt = args.confirmedAt ?? new Date().toISOString();
  const confirmationText = confirmationTextFromArgs(args);
  const { event, mismatches } = validate({
    architectureConfirmation: confirmation,
    renderReport: report,
    requirementRecord: record,
    confirmationText,
    architecturePath,
    reportPath,
  });

  if (mismatches.length > 0) {
    console.error(JSON.stringify({ ok: false, mismatches }, null, 2));
    return 3;
  }

  const eventWithActor = {
    ...event,
    confirmedAt,
    confirmedBy: args.confirmedBy,
  };
  const baseDir = path.dirname(recordPath);
  const currentRecord = readJson(recordPath);
  const alreadyRecorded = sameArchitectureConfirmationAlreadyRecorded(currentRecord, event);
  const commit = alreadyRecorded
    ? null
    : appendControlEventAndReplay({
        recordPath,
        writerId: 'architecture-confirmation-ingest',
        eventType: 'architecture_confirmation_recorded',
        recordedAt: confirmedAt,
        payload: {
          event: eventWithActor,
          architecturePath: normalizePathForRecord(architecturePath),
          renderReportPath: normalizePathForRecord(reportPath),
        },
        reduce: (currentRecord) => updateRecord(currentRecord, event, confirmedAt, args.confirmedBy!),
      });
  const progressionCommits = appendArchitectureConfirmationModelProgression({
    recordPath,
    event,
    recordedAt: confirmedAt,
    recordedBy: args.confirmedBy!,
  });
  const artifactIndex = path.resolve(args.artifactIndex ?? path.join(baseDir, 'artifact-index.jsonl'));
  if (!alreadyRecorded) {
    appendJsonl(artifactIndex, {
      artifactType: 'architecture_confirmation',
      sourceOfTruthRole: 'evidence',
      recordId: event.recordId,
      requirementSetId: event.requirementSetId,
      path: normalizePathForRecord(architecturePath),
      eventType: 'architecture_confirmation_recorded',
      contentHash: event.architectureConfirmationArtifactHash,
    });
  }
  const primaryCommit = commit ?? progressionCommits.at(-1);

  const result = {
    ok: true,
    event: eventWithActor,
    architectureConfirmationAlreadyRecorded: alreadyRecorded,
    requirementRecordPath: normalizePathForRecord(recordPath),
    eventLogPath: primaryCommit ? normalizePathForRecord(primaryCommit.eventLogPath) : null,
    controlEventId: primaryCommit?.event.eventId ?? null,
    controlEventHash: primaryCommit?.event.eventHash ?? null,
    receiptPath: primaryCommit ? normalizePathForRecord(primaryCommit.receiptPath) : null,
    modelProgressionEvents: progressionCommits.map((progressionCommit) => ({
      eventType: progressionCommit.event.eventType,
      eventId: progressionCommit.event.eventId,
      eventHash: progressionCommit.event.eventHash,
      receiptPath: normalizePathForRecord(progressionCommit.receiptPath),
    })),
    artifactIndexPath: normalizePathForRecord(artifactIndex),
  };
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    console.log(`architecture_confirmation_recorded=${event.recordId}`);
    console.log(`requirement-record.json=${normalizePathForRecord(recordPath)}`);
  }
  return 0;
}

if (require.main === module && isDirectArchitectureConfirmationIngestCli(process.argv[1])) {
  try {
    process.exitCode = mainIngestArchitectureConfirmation(process.argv.slice(2));
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
