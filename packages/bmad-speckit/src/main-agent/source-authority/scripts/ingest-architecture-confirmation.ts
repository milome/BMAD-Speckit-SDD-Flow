/* eslint-disable no-console */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  architectureConfirmationHashFor,
  resolveArchitectureConfirmationHashRecipe,
} from './architecture-confirmation-hash-recipe';
import {
  appendControlEventAndReplay,
  canonicalizeRequirementRecord,
  sha256Json,
  type ControlCommitResult,
} from './requirement-record-control-store';
import {
  artifactBytesHash,
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionArtifactWrites,
  runtimeStatusProjectionRecordPatch,
  type RequirementsContractSixModelId,
  type RuntimeStatusProjectionUpdate,
} from './requirements-contract-runtime-status-decision-receipt';
import {
  ArchitectureConfirmationBlock,
  architectureConfirmationProjection,
  classifyArchitectureConfirmationError,
  deriveArchitectureConfirmationCandidate,
  readCurrentArchitectureConfirmationAcceptance,
  resolveArchitectureConfirmationContext,
  type ArchitectureConfirmationContext,
} from './prepare-architecture-confirmation';
import { hasOpenReconfirmationRequest } from './reconfirmation-runtime';
import { validateSourcePrdLintTransitionFromFiles } from './requirements-contract-validation-facade';
import { resolveVerifiedSixModelStatus } from './verified-six-model-status-facade';

type JsonObject = Record<string, unknown>;

const NEXT_MODEL: Record<string, string> = {
  requirement_confirmation: 'architecture_confirmation',
  architecture_confirmation: 'implementation_readiness',
  implementation_readiness: 'execution_closure',
  execution_closure: 'audit_review',
  audit_review: 'delivery_confirmation',
};

interface ParsedArgs {
  requestId?: string;
  architectureConfirmationCandidateHash?: string;
  architectureConfirmation?: string;
  renderReport?: string;
  requirementRecord?: string;
  confirmationText?: string;
  exactConfirmationText?: string;
  confirmationTextFile?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  eventLog?: string;
  artifactIndex?: string;
  action?: string;
  persistStateCheck?: boolean;
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
    if (arg === '--persist-state-check') {
      out.persistStateCheck = true;
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
    : [
        path.resolve(process.cwd(), summaryPath),
        path.resolve(path.dirname(reportPath), summaryPath),
      ];
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

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function hasSixModelRuntime(record: JsonObject): boolean {
  return (
    typeof record.currentMentalModel === 'string' &&
    object(record.sixModelResults).requirement_confirmation !== undefined
  );
}

function verifiedModelStatus(record: JsonObject, modelId: RequirementsContractSixModelId) {
  return resolveVerifiedSixModelStatus({
    record,
    modelId,
    currentImplementationAttemptId:
      text(record.currentAttemptId) || text(record.implementationAttemptId) || text(record.runId),
  });
}

function sameArchitectureConfirmationAlreadyRecorded(
  record: JsonObject,
  event: JsonObject
): boolean {
  const state = object(record.architectureConfirmationState);
  return (
    text(state.status) === 'active' &&
    text(state.currentArchitectureConfirmationRunId) === text(event.runId) &&
    text(state.currentArchitectureConfirmationHash) ===
      text(event.architectureConfirmationArtifactHash)
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
    requirementSetId:
      text(event.requirementSetId) || text(record.requirementSetId) || text(record.recordId),
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

function hasOpenRerun(record: JsonObject): boolean {
  return objects(record.rerunLoops).some((loop) =>
    ['open', 'in_progress', 'no_progress', 'blocked'].includes(text(loop.status))
  );
}

function hasPendingBlockerIntake(record: JsonObject): boolean {
  if (objects(record.pendingBlockerIntake).length > 0) return true;
  return objects(record.blockerIntakeRuns).some(
    (run) => !['closed', 'resolved', 'pass'].includes(text(run.status))
  );
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
      if (hasOpenReconfirmationRequest(record)) {
        throw new Error('mental_model_transition_blocked_by_open_reconfirmation');
      }
      if (hasOpenRerun(record)) {
        throw new Error('mental_model_transition_blocked_by_open_rerun');
      }
      if (hasPendingBlockerIntake(record)) {
        throw new Error('mental_model_transition_blocked_by_pending_blocker_intake');
      }
      const currentStatus = verifiedModelStatus(
        record,
        String(payload.fromModel) as RequirementsContractSixModelId
      );
      if (currentStatus.effectiveStatus !== 'pass') {
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
  const existingStatus = verifiedModelStatus(current, 'architecture_confirmation');
  if (
    existingStatus.effectiveStatus === 'pass' &&
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
  const attemptId = text(current.currentAttemptId) || text(current.runId);
  const architecturePath = text(input.event.architectureConfirmationPath);
  const architectureHash = text(input.event.architectureConfirmationArtifactHash);
  const runtimeStatus = createRuntimeStatusProjectionUpdate({
    recordId: text(current.recordId),
    requirementSetId: text(current.requirementSetId) || text(current.recordId),
    modelId: 'architecture_confirmation',
    implementationAttemptId: attemptId,
    sourceDocumentHash: text(current.sourceDocumentHash),
    implementationConfirmationHash: text(current.implementationConfirmationHash),
    semanticModelHash: text(current.semanticModelHash),
    stageInputs: [
      {
        role: 'requirement_source',
        path: text(current.sourcePath),
        hash: text(current.sourceDocumentHash),
      },
    ],
    deterministicGateOutputs: [
      {
        role: 'architecture_confirmation',
        path: architecturePath,
        hash: architectureHash,
      },
    ],
    blockerRefs: [],
    evidenceRefs: [architecturePath, text(input.event.renderReportPath)].filter(Boolean),
    authorityClass: 'deterministic_gate',
    decision: 'pass',
    effectiveStatus: 'pass',
    createdAt: input.recordedAt,
    receiptPath: `runtime/status-decisions/${attemptId}/architecture_confirmation.json`,
    projection: result,
  });
  return appendControlEventAndReplay({
    recordPath: input.recordPath,
    writerId: 'architecture-confirmation-ingest',
    eventType: 'six_model_results_recorded',
    recordedAt: input.recordedAt,
    expectedBeforeRecordHash: sha256Json(canonicalizeRequirementRecord(current)),
    payload: {
      eventType: 'six_model_results_recorded',
      ...runtimeStatus.projection,
    },
    artifactWrites: runtimeStatusProjectionArtifactWrites(runtimeStatus),
    reduce: (record) => ({
      ...record,
      ...runtimeStatusProjectionRecordPatch({
        record,
        modelId: 'architecture_confirmation',
        update: runtimeStatus,
      }),
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

  if (
    confirmation.architectureConfirmationHashRecipe &&
    typeof confirmation.architectureConfirmationHashRecipe === 'object'
  ) {
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
  for (const field of ['sourceDocumentHash', 'implementationConfirmationHash']) {
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

function updateRecord(
  record: JsonObject,
  event: JsonObject,
  confirmedAt: string,
  confirmedBy: string
): JsonObject {
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

function architectureStateCheck(
  record: JsonObject,
  checkedAt: string,
  checkedBy: string
): {
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
    (field) =>
      text(previousHashes[field as keyof typeof previousHashes]) !==
      text(currentHashes[field as keyof typeof currentHashes])
  );
  const missingState =
    !text(state.currentArchitectureConfirmationHash) ||
    !text(state.currentArchitectureConfirmationRunId);
  const fromStatus = text(state.status) || 'missing';
  const toStatus = missingState ? 'missing' : mismatchFields.length > 0 ? 'stale' : 'active';
  const decision: 'pass' | 'fail' | 'blocked' = missingState
    ? 'blocked'
    : mismatchFields.length > 0
      ? 'fail'
      : 'pass';
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
      reasonCode: missingState
        ? 'current_confirmation_missing'
        : mismatchFields.length > 0
          ? 'hash_mismatch'
          : 'hash_match',
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
          sourceRefs: [
            {
              sourceType: 'architecture_confirmation',
              id: text(state.currentArchitectureConfirmationRunId),
            },
          ],
          recordedAt: checkedAt,
          recordedBy: checkedBy,
        },
      ],
      lastEventType: 'architecture_confirmation_state_checked',
      updatedAt: checkedAt,
    },
  };
}

function publicArchitectureConfirmationArgs(args: ParsedArgs): boolean {
  return Boolean(args.requestId || args.architectureConfirmationCandidateHash);
}

function emitArchitectureConfirmationResult(
  args: ParsedArgs,
  stream: NodeJS.WriteStream,
  value: JsonObject
): void {
  if (args.json) stream.write(`${JSON.stringify(value, null, 2)}\n`);
  else stream.write(`${text(value.status) || 'architecture_confirmation_blocked'}\n`);
}

function projectRelative(root: string, target: string): string {
  const relative = path.relative(root, target).replace(/\\/gu, '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error('architecture_confirmation_projection_path_invalid');
  }
  return relative;
}

function writeDurableFile(targetPath: string, bytes: Buffer): void {
  const handle = fs.openSync(targetPath, 'wx', 0o600);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      offset += fs.writeSync(handle, bytes, offset, bytes.length - offset, null);
    }
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  if (!fs.readFileSync(targetPath).equals(bytes)) {
    throw new Error('architecture_confirmation_acceptance_staging_readback_mismatch');
  }
}

export function publishArchitectureConfirmationAcceptance(input: {
  acceptanceDirectory: string;
  eventBytes: Buffer;
  runtimeReceiptBytes: Buffer;
  assertCurrentAuthority?: () => void;
}): 'published' | 'reused' {
  const acceptanceDirectory = path.resolve(input.acceptanceDirectory);
  const parent = path.dirname(acceptanceDirectory);
  input.assertCurrentAuthority?.();
  fs.mkdirSync(parent, { recursive: true });
  const existingBundleMatches = (): boolean => {
    const eventPath = path.join(acceptanceDirectory, 'architecture-confirmation-event.json');
    const receiptPath = path.join(acceptanceDirectory, 'runtime-status-decision-receipt.json');
    return (
      fs.existsSync(eventPath) &&
      fs.existsSync(receiptPath) &&
      fs.readFileSync(eventPath).equals(input.eventBytes) &&
      fs.readFileSync(receiptPath).equals(input.runtimeReceiptBytes)
    );
  };
  if (fs.existsSync(acceptanceDirectory)) {
    input.assertCurrentAuthority?.();
    if (existingBundleMatches()) return 'reused';
    throw new Error('architecture_confirmation_acceptance_conflict');
  }
  const stagingDirectory = path.join(
    parent,
    `.${path.basename(acceptanceDirectory)}.staging.${process.pid}.${randomUUID()}`
  );
  fs.mkdirSync(stagingDirectory);
  try {
    writeDurableFile(
      path.join(stagingDirectory, 'architecture-confirmation-event.json'),
      input.eventBytes
    );
    writeDurableFile(
      path.join(stagingDirectory, 'runtime-status-decision-receipt.json'),
      input.runtimeReceiptBytes
    );
    try {
      input.assertCurrentAuthority?.();
      fs.renameSync(stagingDirectory, acceptanceDirectory);
      try {
        input.assertCurrentAuthority?.();
        return 'published';
      } catch (error) {
        fs.rmSync(acceptanceDirectory, { recursive: true, force: true });
        throw error;
      }
    } catch (error) {
      if (fs.existsSync(acceptanceDirectory)) {
        input.assertCurrentAuthority?.();
        if (existingBundleMatches()) return 'reused';
        throw new Error('architecture_confirmation_acceptance_conflict');
      }
      throw error;
    }
  } finally {
    if (fs.existsSync(stagingDirectory)) {
      fs.rmSync(stagingDirectory, { recursive: true, force: true });
    }
  }
}

function preparedIngestIssue(args: ParsedArgs): string | null {
  const allowed = new Set([
    'requestId',
    'architectureConfirmationCandidateHash',
    'exactConfirmationText',
    'json',
    'help',
  ]);
  const forbidden = Object.keys(args).filter(
    (key) => args[key as keyof ParsedArgs] !== undefined && !allowed.has(key)
  );
  if (forbidden.length > 0) return 'caller_derived_input_forbidden';
  if (!text(args.requestId)) return 'request_id_missing';
  if (!/^sha256:[a-f0-9]{64}$/u.test(text(args.architectureConfirmationCandidateHash))) {
    return 'architecture_confirmation_candidate_hash_invalid';
  }
  if (typeof args.exactConfirmationText !== 'string' || args.exactConfirmationText.length === 0) {
    return 'exact_confirmation_text_missing';
  }
  return null;
}

const SIX_MODELS = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
] as const;

function requirementsRuntimeProjection(
  context: ArchitectureConfirmationContext,
  model: (typeof SIX_MODELS)[number],
  status: 'pass' | 'not_established',
  recordedAt: string
): JsonObject {
  return {
    payloadKind: 'model_result',
    model,
    recordId: text(context.record.recordId),
    requirementSetId: text(context.record.requirementSetId) || text(context.record.recordId),
    sourceDocumentHash: context.semanticIr.scopeSemanticHash,
    implementationConfirmationHash: context.semanticIr.scopeSemanticHash,
    status,
    resultRecordedAt: recordedAt,
    resultRecordedBy: 'requirements-contract-six-model-bridge',
    blockingReasons: status === 'pass' ? [] : [`${model}_not_established`],
    sourceRefs: [
      {
        sourceType:
          model === 'requirement_confirmation'
            ? 'requirements_confirmation_event'
            : 'six_model_initialization',
        id:
          model === 'requirement_confirmation'
            ? context.confirmationEventHash
            : `${model}:not_established`,
      },
    ],
    currentHashes: {
      semanticModelHash: context.semanticIr.scopeSemanticHash,
    },
  };
}

function requirementsConfirmationRuntimeInput(
  context: ArchitectureConfirmationContext,
  recordedAt: string
): {
  recordPath: string;
  baseRecord: JsonObject;
  runtimeStatus: RuntimeStatusProjectionUpdate;
} {
  const promotionRef = object(context.record.currentPromotionEvidence);
  const promotionPath = path.resolve(context.recordRoot, text(promotionRef.path));
  const promotionRelative = path.relative(context.recordRoot, promotionPath);
  if (
    !text(promotionRef.path) ||
    promotionRelative.startsWith('..') ||
    path.isAbsolute(promotionRelative) ||
    !fs.existsSync(promotionPath)
  ) {
    throw new Error('requirements_confirmation_runtime_promotion_missing');
  }
  const promotion = readJson(promotionPath);
  const artifacts = objects(promotion.artifacts);
  const markdown = artifacts.find((entry) => text(entry.role) === 'final_markdown');
  const html = artifacts.find((entry) => text(entry.role) === 'confirmation_html');
  const sourcePath =
    text(markdown?.targetPath) || text(context.activeAuthority.activeSemanticIrPath);
  const htmlPath = text(html?.targetPath);
  const confirmationPageHash = text(html?.artifactBytesHash);
  if (!sourcePath || !htmlPath || !/^sha256:[a-f0-9]{64}$/u.test(confirmationPageHash)) {
    throw new Error('requirements_confirmation_runtime_projection_missing');
  }
  const recordId = text(context.record.recordId);
  const requirementSetId = text(context.record.requirementSetId) || recordId;
  const attemptId = text(context.activeAuthority.activeAuthoringAttemptId);
  const confirmationText = text(context.confirmationEvent.exactConfirmationText);
  const confirmation = {
    eventType: 'confirmation_recorded',
    recordId,
    requirementSetId,
    confirmedAt: recordedAt,
    confirmedBy: 'requirements-contract-confirmation',
    sourcePath,
    sourceDocumentHash: context.semanticIr.scopeSemanticHash,
    implementationConfirmationHash: context.semanticIr.scopeSemanticHash,
    confirmationPageHash,
    confirmationText: confirmationText || 'requirements scope confirmed',
    renderReportPath: text(promotionRef.path),
    htmlPath,
  };
  const sixModelResults = Object.fromEntries(
    SIX_MODELS.map((model) => [
      model,
      requirementsRuntimeProjection(
        context,
        model,
        model === 'requirement_confirmation' ? 'pass' : 'not_established',
        recordedAt
      ),
    ])
  );
  const baseRecord = {
    schemaVersion: 'requirement-record/v1',
    recordId,
    requirementSetId,
    status: 'user_confirmed',
    flow: 'standalone_tasks',
    entryFlow: 'standalone_tasks',
    sourcePath,
    sourceDocumentHash: context.semanticIr.scopeSemanticHash,
    implementationConfirmationHash: context.semanticIr.scopeSemanticHash,
    semanticModelHash: context.semanticIr.scopeSemanticHash,
    confirmationPageHash,
    currentAttemptId: attemptId,
    confirmationHistory: [confirmation],
    currentMentalModel: 'requirement_confirmation',
    mentalModelTransitions: [],
    reconfirmationRequests: [],
    pendingBlockerIntake: [],
    blockerIntakeRuns: [],
    rerunLoops: [],
    sixModelResults,
    artifactIndex: [],
    updatedAt: recordedAt,
  };
  const requirementProjection = object(sixModelResults.requirement_confirmation);
  const runtimeStatus = createRuntimeStatusProjectionUpdate({
    recordId,
    requirementSetId,
    modelId: 'requirement_confirmation',
    implementationAttemptId: attemptId,
    sourceDocumentHash: context.semanticIr.scopeSemanticHash,
    implementationConfirmationHash: context.semanticIr.scopeSemanticHash,
    semanticModelHash: context.semanticIr.scopeSemanticHash,
    stageInputs: [
      {
        role: 'requirements_semantic_ir',
        path: text(context.activeAuthority.activeSemanticIrPath),
        hash: context.semanticIr.scopeSemanticHash,
      },
    ],
    deterministicGateOutputs: [
      {
        role: 'requirements_confirmation_event',
        path: text(object(context.record.confirmationEventRef).path),
        hash: context.confirmationEventHash,
      },
    ],
    blockerRefs: [],
    evidenceRefs: [text(object(context.record.confirmationEventRef).path), text(promotionRef.path)],
    authorityClass: 'controlled_confirmation',
    decision: 'pass',
    effectiveStatus: 'pass',
    createdAt: recordedAt,
    receiptPath: `runtime/status-decisions/${attemptId}/requirement_confirmation.json`,
    projection: requirementProjection,
  });
  if (!runtimeStatus.authorityEstablished) {
    throw new Error('requirements_confirmation_runtime_status_invalid');
  }
  return {
    recordPath: path.join(context.recordRoot, 'requirement-record.json'),
    baseRecord,
    runtimeStatus,
  };
}

function ensureRequirementsConfirmationRuntime(
  context: ArchitectureConfirmationContext,
  recordedAt: string
): string {
  const input = requirementsConfirmationRuntimeInput(context, recordedAt);
  if (fs.existsSync(input.recordPath)) {
    const current = readJson(input.recordPath);
    const verified = verifiedModelStatus(current, 'requirement_confirmation');
    if (
      verified.effectiveStatus === 'pass' &&
      text(current.semanticModelHash) === context.semanticIr.scopeSemanticHash &&
      text(current.currentAttemptId) === text(context.activeAuthority.activeAuthoringAttemptId)
    ) {
      return input.recordPath;
    }
    throw new Error('requirements_confirmation_runtime_lineage_conflict');
  }
  appendControlEventAndReplay({
    recordPath: input.recordPath,
    writerId: 'main-agent-six-model-initializer',
    eventType: 'requirement_confirmation_result_recorded',
    recordedAt,
    bootstrapConfirmation: true,
    bootstrapRecord: input.baseRecord,
    payload: {
      model: 'requirement_confirmation',
      status: 'pass',
      recordedAt,
      sourceRefs: [
        { sourceType: 'requirements_confirmation_event', id: context.confirmationEventHash },
      ],
    },
    artifactWrites: runtimeStatusProjectionArtifactWrites(input.runtimeStatus),
    reduce: (record) => ({
      ...record,
      ...runtimeStatusProjectionRecordPatch({
        record,
        modelId: 'requirement_confirmation',
        update: input.runtimeStatus,
      }),
      currentMentalModel: 'requirement_confirmation',
      lastEventType: 'requirement_confirmation_result_recorded',
      updatedAt: recordedAt,
    }),
  });
  return input.recordPath;
}

function ensureArchitectureRuntimeStatus(input: {
  context: ArchitectureConfirmationContext;
  accepted: NonNullable<ReturnType<typeof readCurrentArchitectureConfirmationAcceptance>>;
  recordedAt: string;
}): void {
  const recordPath = ensureRequirementsConfirmationRuntime(input.context, input.recordedAt);
  const current = readJson(recordPath);
  const existing = object(object(current.sixModelResults).architecture_confirmation);
  if (
    verifiedModelStatus(current, 'architecture_confirmation').effectiveStatus === 'pass' &&
    text(object(existing.currentHashes).architectureConfirmationCandidateHash) ===
      text(input.accepted.event.architectureConfirmationCandidateHash)
  ) {
    return;
  }
  const receiptPath = path.resolve(
    input.context.recordRoot,
    input.accepted.runtimeStatusDecisionRef.path
  );
  const receipt = readJson(receiptPath);
  const projection = {
    payloadKind: 'model_result',
    model: 'architecture_confirmation',
    recordId: text(current.recordId),
    requirementSetId: text(current.requirementSetId) || text(current.recordId),
    sourceDocumentHash: input.context.semanticIr.scopeSemanticHash,
    implementationConfirmationHash: input.context.semanticIr.scopeSemanticHash,
    status: 'pass',
    resultRecordedAt: text(receipt.createdAt) || input.recordedAt,
    resultRecordedBy: 'architecture-confirmation-ingest',
    blockingReasons: [],
    sourceRefs: [
      {
        sourceType: 'architecture_confirmation_candidate',
        id: text(input.accepted.event.architectureConfirmationCandidateHash),
      },
      {
        sourceType: 'architecture_confirmation_event',
        id: input.accepted.eventRef.artifactBytesHash,
      },
    ],
    currentHashes: {
      semanticModelHash: input.context.semanticIr.scopeSemanticHash,
      architectureConfirmationCandidateHash: text(
        input.accepted.event.architectureConfirmationCandidateHash
      ),
    },
    currentAttemptId: text(receipt.implementationAttemptId),
    semanticModelHash: text(receipt.semanticModelHash),
    decisionReceiptRef: input.accepted.runtimeStatusDecisionRef.path,
    decisionReceiptHash: text(receipt.receiptHash),
  };
  const runtimeStatus = {
    projection,
    receiptRef: { path: input.accepted.runtimeStatusDecisionRef.path, receipt },
    authorityEstablished: true,
    missingAuthorityBindings: [],
  } satisfies RuntimeStatusProjectionUpdate;
  appendControlEventAndReplay({
    recordPath,
    writerId: 'architecture-confirmation-ingest',
    eventType: 'six_model_results_recorded',
    recordedAt: text(receipt.createdAt) || input.recordedAt,
    expectedBeforeRecordHash: sha256Json(canonicalizeRequirementRecord(current)),
    payload: { eventType: 'six_model_results_recorded', ...projection },
    reduce: (record) => ({
      ...record,
      ...runtimeStatusProjectionRecordPatch({
        record,
        modelId: 'architecture_confirmation',
        update: runtimeStatus,
      }),
      currentMentalModel: 'architecture_confirmation',
      lastEventType: 'six_model_results_recorded',
      updatedAt: text(receipt.createdAt) || input.recordedAt,
    }),
  });
}

function ingestPreparedArchitectureConfirmation(args: ParsedArgs): {
  exitCode: number;
  result: JsonObject;
} {
  const issue = preparedIngestIssue(args);
  if (issue) {
    return {
      exitCode: 2,
      result: { ok: false, status: 'architecture_confirmation_blocked', issueCodes: [issue] },
    };
  }
  const requestId = text(args.requestId);
  const context = resolveArchitectureConfirmationContext({
    projectRoot: process.cwd(),
    requestId,
  });
  const candidate = deriveArchitectureConfirmationCandidate(context);
  const projection = architectureConfirmationProjection({ context, candidate });
  const candidateHash = text(args.architectureConfirmationCandidateHash);
  if (candidateHash !== candidate.architectureConfirmationCandidateHash) {
    return {
      exitCode: 1,
      result: {
        ok: false,
        status: 'architecture_confirmation_blocked',
        issueCodes: ['architecture_confirmation_candidate_stale'],
      },
    };
  }
  if (args.exactConfirmationText !== projection.exactConfirmationText) {
    return {
      exitCode: 1,
      result: {
        ok: false,
        status: 'architecture_confirmation_blocked',
        issueCodes: ['architecture_confirmation_exact_text_mismatch'],
      },
    };
  }
  const currentAcceptance = readCurrentArchitectureConfirmationAcceptance({ context, candidate });
  if (currentAcceptance) {
    const receipt = readJson(
      path.resolve(context.recordRoot, currentAcceptance.runtimeStatusDecisionRef.path)
    );
    ensureArchitectureRuntimeStatus({
      context,
      accepted: currentAcceptance,
      recordedAt: text(receipt.createdAt) || new Date().toISOString(),
    });
    return {
      exitCode: 0,
      result: {
        ok: true,
        status: 'architecture_confirmation_reused',
        event: currentAcceptance.event,
        eventRef: currentAcceptance.eventRef,
        runtimeStatusDecisionRef: currentAcceptance.runtimeStatusDecisionRef,
        architectureConfirmationCandidateHash: candidateHash,
      },
    };
  }
  if (!fs.existsSync(projection.candidatePath) || !fs.existsSync(projection.pagePath)) {
    return {
      exitCode: 1,
      result: {
        ok: false,
        status: 'architecture_confirmation_blocked',
        issueCodes: ['architecture_confirmation_projection_missing'],
      },
    };
  }
  const candidateBytes = fs.readFileSync(projection.candidatePath);
  const pageBytes = fs.readFileSync(projection.pagePath);
  let candidateReadback: unknown;
  try {
    candidateReadback = JSON.parse(candidateBytes.toString('utf8'));
  } catch {
    candidateReadback = null;
  }
  if (
    canonicalRequirementsJson(candidateReadback) !== canonicalRequirementsJson(candidate) ||
    !pageBytes.equals(Buffer.from(projection.pageBytes, 'utf8'))
  ) {
    return {
      exitCode: 1,
      result: {
        ok: false,
        status: 'architecture_confirmation_blocked',
        issueCodes: ['architecture_confirmation_projection_stale'],
      },
    };
  }
  const candidateRef = {
    path: projectRelative(context.recordRoot, projection.candidatePath),
    artifactBytesHash: artifactBytesHash({
      role: 'architecture_confirmation_candidate',
      mediaType: 'application/json',
      bytes: candidateBytes,
    }),
  };
  const pageRef = {
    path: projectRelative(context.recordRoot, projection.pagePath),
    artifactBytesHash: artifactBytesHash({
      role: 'architecture_confirmation_page',
      mediaType: 'text/html',
      bytes: pageBytes,
    }),
  };
  const exactConfirmationTextHash = requirementsContractDomainHash(
    'architecture-confirmation-exact-text/v1',
    projection.exactConfirmationText
  );
  const attemptId = text(context.activeAuthority.activeAuthoringAttemptId);
  const event = {
    schemaVersion: 'architecture-confirmation-event/v1',
    eventType: 'architecture_confirmation_recorded',
    requestId,
    semanticRevisionId: context.semanticIr.semanticRevisionId,
    scopeSemanticHash: context.semanticIr.scopeSemanticHash,
    architectureConfirmationCandidateHash: candidateHash,
    requirementsAuthoringAttemptId: attemptId,
    requirementsBindingRevisionId: context.sourceBinding.bindingRevisionId,
    requirementsSourceBindingHash: context.sourceBinding.sourceBindingHash,
    requirementsConfirmationEventRef: {
      path: text(object(context.record.confirmationEventRef).path),
      artifactBytesHash: context.confirmationEventHash,
    },
    requirementsEffectivePassRef: {
      path: 'quality/requirements-effective-pass-receipt.json',
      hash: text(context.effectivePass.requirementsEffectivePassHash),
    },
    candidateRef,
    pageRef,
    exactConfirmationTextHash,
    decision: 'pass',
  };
  const eventPath = projection.eventPath;
  const eventBytes = Buffer.from(canonicalRequirementsJson(event), 'utf8');
  const eventRef = {
    path: projectRelative(context.recordRoot, eventPath),
    artifactBytesHash: artifactBytesHash({
      role: 'architecture_confirmation_event',
      mediaType: 'application/json',
      bytes: eventBytes,
    }),
  };
  const runtimeReceiptRelativePath = projectRelative(
    context.recordRoot,
    projection.runtimeReceiptPath
  );
  const runtimeReceiptPath = projection.runtimeReceiptPath;
  const existingRuntimeReceipt = fs.existsSync(runtimeReceiptPath)
    ? readJson(runtimeReceiptPath)
    : null;
  const recordedAt = text(existingRuntimeReceipt?.createdAt) || new Date().toISOString();
  const projectionRecord = {
    payloadKind: 'model_result',
    model: 'architecture_confirmation',
    recordId: requestId,
    requirementSetId: text(context.record.requirementSetId) || requestId,
    sourceDocumentHash: context.semanticIr.scopeSemanticHash,
    implementationConfirmationHash: context.semanticIr.scopeSemanticHash,
    status: 'pass',
    resultRecordedAt: recordedAt,
    resultRecordedBy: 'architecture-confirmation-ingest',
    blockingReasons: [],
    sourceRefs: [
      { sourceType: 'architecture_confirmation_candidate', id: candidateHash },
      { sourceType: 'architecture_confirmation_event', id: eventRef.artifactBytesHash },
    ],
    currentHashes: {
      semanticModelHash: context.semanticIr.scopeSemanticHash,
      architectureConfirmationCandidateHash: candidateHash,
    },
  };
  const runtimeStatus = createRuntimeStatusProjectionUpdate({
    recordId: requestId,
    requirementSetId: text(context.record.requirementSetId) || requestId,
    modelId: 'architecture_confirmation',
    implementationAttemptId: attemptId,
    sourceDocumentHash: context.semanticIr.scopeSemanticHash,
    implementationConfirmationHash: context.semanticIr.scopeSemanticHash,
    semanticModelHash: context.semanticIr.scopeSemanticHash,
    stageInputs: [
      {
        role: 'requirements_semantic_ir',
        path: text(context.activeAuthority.activeSemanticIrPath),
        hash: context.semanticIr.scopeSemanticHash,
      },
      {
        role: 'requirements_confirmation_event',
        path: text(object(context.record.confirmationEventRef).path),
        hash: context.confirmationEventHash,
      },
      {
        role: 'requirements_effective_pass',
        path: 'quality/requirements-effective-pass-receipt.json',
        hash: text(context.effectivePass.requirementsEffectivePassHash),
      },
      { role: 'architecture_confirmation_candidate', path: candidateRef.path, hash: candidateHash },
    ],
    deterministicGateOutputs: [
      {
        role: 'architecture_confirmation_event',
        path: eventRef.path,
        hash: eventRef.artifactBytesHash,
      },
    ],
    blockerRefs: [],
    evidenceRefs: [
      text(object(context.record.confirmationEventRef).path),
      'quality/requirements-effective-pass-receipt.json',
      candidateRef.path,
      pageRef.path,
      eventRef.path,
    ],
    authorityClass: 'controlled_confirmation',
    decision: 'pass',
    effectiveStatus: 'pass',
    createdAt: recordedAt,
    receiptPath: runtimeReceiptRelativePath,
    projection: projectionRecord,
  });
  if (!runtimeStatus.authorityEstablished || !runtimeStatus.receiptRef) {
    throw new Error(
      `architecture_confirmation_runtime_status_invalid:${runtimeStatus.missingAuthorityBindings.join(',')}`
    );
  }
  let committedContext = context;
  const assertCurrentAuthority = (): void => {
    const currentContext = resolveArchitectureConfirmationContext({
      projectRoot: context.projectRoot,
      requestId,
    });
    const currentCandidate = deriveArchitectureConfirmationCandidate(currentContext);
    if (currentCandidate.architectureConfirmationCandidateHash !== candidateHash) {
      throw new ArchitectureConfirmationBlock('architecture_confirmation_candidate_stale');
    }
    committedContext = currentContext;
  };
  const publicationDisposition = publishArchitectureConfirmationAcceptance({
    acceptanceDirectory: projection.acceptanceDirectory,
    eventBytes,
    runtimeReceiptBytes: Buffer.from(
      canonicalRequirementsJson(runtimeStatus.receiptRef.receipt),
      'utf8'
    ),
    assertCurrentAuthority,
  });
  const accepted = readCurrentArchitectureConfirmationAcceptance({
    context: committedContext,
    candidate: deriveArchitectureConfirmationCandidate(committedContext),
  });
  if (!accepted) throw new Error('architecture_confirmation_acceptance_readback_invalid');
  ensureArchitectureRuntimeStatus({ context: committedContext, accepted, recordedAt });
  return {
    exitCode: 0,
    result: {
      ok: true,
      status:
        publicationDisposition === 'published'
          ? 'architecture_confirmation_recorded'
          : 'architecture_confirmation_reused',
      event: accepted.event,
      eventRef: accepted.eventRef,
      runtimeStatusDecisionRef: accepted.runtimeStatusDecisionRef,
      architectureConfirmationCandidateHash: candidateHash,
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
  if (publicArchitectureConfirmationArgs(args)) {
    try {
      const prepared = ingestPreparedArchitectureConfirmation(args);
      emitArchitectureConfirmationResult(
        args,
        prepared.exitCode === 0 ? process.stdout : process.stderr,
        prepared.result
      );
      return prepared.exitCode;
    } catch (error) {
      const failure = classifyArchitectureConfirmationError(error);
      emitArchitectureConfirmationResult(args, process.stderr, {
        ok: false,
        status: 'architecture_confirmation_blocked',
        issueCodes: [failure.issueCode],
      });
      return failure.exitCode;
    }
  }
  if (args.action === 'check-state') {
    if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
    const recordPath = path.resolve(args.requirementRecord);
    if (!fs.existsSync(recordPath)) throw new Error(`requirement record missing: ${recordPath}`);
    const record = readJson(recordPath);
    const checkedAt = args.confirmedAt ?? new Date().toISOString();
    const checkedBy = args.confirmedBy ?? 'agent';
    const result = architectureStateCheck(record, checkedAt, checkedBy);
    const commit = args.persistStateCheck
      ? appendControlEventAndReplay({
          recordPath,
          writerId: 'architecture-confirmation-ingest',
          eventType: 'architecture_confirmation_state_checked',
          recordedAt: checkedAt,
          payload: { event: result.event },
          reduce: () => result.nextRecord,
        })
      : null;
    const output = {
      ok: result.decision === 'pass',
      event: result.event,
      mismatches: result.mismatches,
      requirementRecordPath: normalizePathForRecord(recordPath),
      diagnosticOnly: !args.persistStateCheck,
      eventLogPath: commit ? normalizePathForRecord(commit.eventLogPath) : null,
      controlEventId: commit?.event.eventId ?? null,
      controlEventHash: commit?.event.eventHash ?? null,
      receiptPath: commit ? normalizePathForRecord(commit.receiptPath) : null,
    };
    process.stdout.write(
      args.json
        ? `${JSON.stringify(output, null, 2)}\n`
        : `architecture_confirmation_state=${result.decision}\n`
    );
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
  const sourcePrdLintTransition = validateSourcePrdLintTransitionFromFiles({
    transition: 'architecture-confirmation',
    requirementRecordPath: recordPath,
    currentSourcePath: text(report.sourcePath),
  });
  if (sourcePrdLintTransition.decision === 'block') {
    console.error(JSON.stringify({ ok: false, sourcePrdLintTransition }, null, 2));
    return 3;
  }
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
  const artifactIndex = path.resolve(
    args.artifactIndex ?? path.join(baseDir, 'artifact-index.jsonl')
  );
  const architectureArtifactIndexEntry = {
    artifactType: 'architecture_confirmation',
    sourceOfTruthRole: 'evidence',
    recordId: event.recordId,
    requirementSetId: event.requirementSetId,
    path: normalizePathForRecord(architecturePath),
    eventType: 'architecture_confirmation_recorded',
    contentHash: event.architectureConfirmationArtifactHash,
  };
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
        artifactIndexUpdates: [
          {
            path: artifactIndex,
            entries: [architectureArtifactIndexEntry],
          },
        ],
        reduce: (currentRecord) =>
          updateRecord(currentRecord, event, confirmedAt, args.confirmedBy!),
      });
  const progressionCommits = appendArchitectureConfirmationModelProgression({
    recordPath,
    event,
    recordedAt: confirmedAt,
    recordedBy: args.confirmedBy!,
  });
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
