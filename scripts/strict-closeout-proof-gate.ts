/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  evaluateTargetArtifactRealization,
  readImplementationConfirmation,
} from './target-artifact-realization-gate';

type JsonObject = Record<string, unknown>;
type Decision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  source?: string;
  attemptId?: string;
  reportPath?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  json?: boolean;
  help?: boolean;
}

const ZERO_HASH = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
const REBASELINE_EVENT_TYPES = new Set([
  'control_log_rebaseline_recorded',
  'controlled_migration_recorded',
]);
const REQUIRED_SUBSYSTEM_IDS = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'main_agent_orchestration',
  'execution_tracking',
  'audit_review',
  'delivery_closeout',
  'observability',
  'rca_improvement',
  'data_production',
  'eval_sft',
  'governance',
  'coach',
  'dashboard_read_model',
  'scoring',
  'prompt_packet_generation',
];

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[
        arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase())
      ] = value;
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
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function nested(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function boolAt(root: JsonObject, pathSegments: string[]): boolean | null {
  let current: unknown = root;
  for (const segment of pathSegments) current = nested(current)[segment];
  return typeof current === 'boolean' ? current : null;
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error(`JSON object expected: ${file}`);
  return parsed as JsonObject;
}

function readJsonl(file: string): JsonObject[] {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8').trim();
  return content ? content.split(/\r?\n/u).map((line) => JSON.parse(line) as JsonObject) : [];
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function isSha256(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function resolveArtifact(recordPath: string, artifactPath: string): string {
  if (path.isAbsolute(artifactPath)) return artifactPath;
  return path.resolve(path.dirname(recordPath), '..', '..', '..', '..', artifactPath);
}

function eventLogPath(recordPath: string, record: JsonObject): string {
  const fromStore = text(nested(record.controlStore).eventLogPath);
  return fromStore
    ? resolveArtifact(recordPath, fromStore)
    : path.join(path.dirname(recordPath), 'events', 'control-events.jsonl');
}

function currentAttempt(record: JsonObject, explicit?: string): string {
  if (explicit) return explicit;
  const commands = objects(nested(record.deliveryEvidence).requiredCommands);
  const strict = commands.find(
    (command) => text(command.commandId) === 'CMD-STRICT-CLOSEOUT-PROOF-GATE'
  );
  return (
    text(nested(strict?.lastRunRef).closeoutAttemptId) ||
    text(strict?.closeoutAttemptId) ||
    text(nested(record.closeout).currentAttemptId)
  );
}

function commandRunsForAttempt(record: JsonObject, attemptId: string): JsonObject[] {
  return objects(record.executionIterations).flatMap((iteration) =>
    objects(iteration.commandRunRefs)
      .filter((run) => text(run.closeoutAttemptId) === attemptId)
      .map((run) => ({ ...run, executionIterationId: text(iteration.executionIterationId) }))
  );
}

function artifactRefComplete(ref: JsonObject): boolean {
  return Boolean(
    text(ref.path) &&
    isSha256(text(ref.hash ?? ref.contentHash)) &&
    text(ref.sourceOfTruthRole) === 'evidence' &&
    text(ref.status) === 'active' &&
    text(ref.producer) &&
    text(ref.purpose) &&
    text(ref.inputVersion) &&
    text(ref.outputVersion)
  );
}

function artifactIndexed(record: JsonObject, artifact: JsonObject): JsonObject | null {
  const wantedPath = normalizePath(text(artifact.path));
  const wantedHash = text(artifact.hash ?? artifact.contentHash);
  return (
    objects(record.artifactIndex).find(
      (item) =>
        normalizePath(text(item.path)) === wantedPath &&
        text(item.contentHash ?? item.hash) === wantedHash &&
        text(item.sourceOfTruthRole) === 'evidence'
    ) ?? null
  );
}

function latestArtifact(record: JsonObject, artifactType: string): JsonObject | null {
  return (
    objects(record.artifactIndex)
      .filter(
        (item) =>
          text(item.artifactType) === artifactType &&
          text(item.sourceOfTruthRole) === 'evidence' &&
          text(item.status) === 'active'
      )
      .at(-1) ?? null
  );
}

function defaultDatasetId(record: JsonObject): string {
  return `${text(record.recordId)}-governed-sft`.toLowerCase();
}

function runtimeDirFromRecord(recordPath: string): string {
  return path.dirname(path.dirname(path.dirname(recordPath)));
}

function defaultDatasetReleaseArtifact(
  record: JsonObject,
  recordPath: string,
  artifactType: string
): JsonObject | null {
  const fileName =
    artifactType === 'dataset_release_manifest'
      ? 'dataset-manifest.json'
      : artifactType === 'dataset_release_gate_report'
        ? 'dataset-release-gate-report.json'
        : '';
  if (!fileName) return null;
  const artifactPath = path.join(
    runtimeDirFromRecord(recordPath),
    'datasets',
    defaultDatasetId(record),
    'v1',
    fileName
  );
  if (!fs.existsSync(artifactPath)) return null;
  return {
    artifactType,
    sourceOfTruthRole: 'evidence',
    status: 'active',
    path: artifactPath,
    contentHash: sha256File(artifactPath),
  };
}

function latestOrDefaultDatasetReleaseArtifact(
  record: JsonObject,
  recordPath: string,
  artifactType: string
): JsonObject | null {
  return (
    latestArtifact(record, artifactType) ??
    defaultDatasetReleaseArtifact(record, recordPath, artifactType)
  );
}

function contractApplicability(sourcePath?: string): JsonObject {
  if (!sourcePath) return {};
  try {
    return nested(readImplementationConfirmation(sourcePath).confirmation.applicability);
  } catch {
    return {};
  }
}

function eventForArtifact(events: JsonObject[], artifact: JsonObject): JsonObject | null {
  const artifactPath = normalizePath(text(artifact.path));
  const artifactHash = text(artifact.contentHash ?? artifact.hash);
  return (
    events.find((event) => {
      const packet = nested(nested(event.payload).packet);
      const refs = [...objects(packet.artifactRefs), ...objects(packet.extensionRefs)];
      return refs.some(
        (ref) =>
          normalizePath(text(ref.path)) === artifactPath &&
          text(ref.hash ?? ref.contentHash) === artifactHash
      );
    }) ?? null
  );
}

function controlledRebaseline(event: JsonObject): JsonObject {
  if (!REBASELINE_EVENT_TYPES.has(text(event.eventType))) return {};
  const rebaseline = nested(nested(event.payload).rebaseline);
  const mode = text(rebaseline.mode);
  const priorEventHash = text(rebaseline.priorEventHash);
  const valid =
    rebaseline.controlled === true &&
    ['event-log-chain-rebaseline', 'controlled-migration'].includes(mode) &&
    priorEventHash === text(event.previousEventHash);
  return valid
    ? {
        ok: true,
        eventId: text(event.eventId),
        eventType: text(event.eventType),
        mode,
        priorEventHash,
        detectedBreaks: objects(rebaseline.detectedBreaks),
      }
    : {};
}

function replayProof(record: JsonObject, events: JsonObject[]): JsonObject {
  const reasons: string[] = [];
  if (events.length === 0) reasons.push('control_events_missing');
  let rebaselineIndex = -1;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (controlledRebaseline(events[index]).ok) {
      rebaselineIndex = index;
      break;
    }
  }
  const replayStartIndex = rebaselineIndex >= 0 ? rebaselineIndex : 0;
  const rebaseline = replayStartIndex > 0 ? controlledRebaseline(events[replayStartIndex]) : null;
  if (replayStartIndex === 0 && text(events[0]?.previousEventHash) !== ZERO_HASH) {
    reasons.push('event_log_missing_genesis_or_rebaseline');
  }
  if (replayStartIndex > 0 && !rebaseline?.ok)
    reasons.push(`event_log_rebaseline_invalid:${replayStartIndex}`);
  for (let index = replayStartIndex + 1; index < events.length; index += 1) {
    if (text(events[index].previousEventHash) !== text(events[index - 1].eventHash))
      reasons.push(`event_chain_broken:${index}`);
  }
  const last = events.at(-1);
  if (last && text(record.eventChainHead) && text(record.eventChainHead) !== text(last.eventHash))
    reasons.push('record_event_chain_head_mismatch');
  if (
    last &&
    text(record.lastAppliedEventHash) &&
    text(record.lastAppliedEventHash) !== text(last.eventHash)
  )
    reasons.push('record_last_applied_event_hash_mismatch');
  if (Number.isInteger(record.eventCount) && record.eventCount !== events.length)
    reasons.push('record_event_count_mismatch');
  return {
    ok: reasons.length === 0,
    mode: replayStartIndex > 0 ? 'event-log-chain-from-rebaseline' : 'event-log-chain',
    replayStartIndex,
    ...(rebaseline?.ok ? { rebaseline } : {}),
    reasons,
  };
}

function writerRegistryProof(events: JsonObject[], attemptId: string): JsonObject {
  const allowed = new Set([
    'main-agent-orchestration-control-writer',
    'implementation-evidence-ingest',
    'delivery-closeout-gate-writer',
    'implementation-readiness-gate-writer',
    'execution-closure-gate-writer',
    'architecture-confirmation-ingest',
  ]);
  const attemptEvents = events.filter(
    (event) =>
      text(nested(nested(event.payload).packet).closeoutAttemptId) === attemptId ||
      text(nested(event.payload).attemptId) === attemptId
  );
  const unauthorized = attemptEvents
    .filter((event) => !allowed.has(text(event.writerId)))
    .map((event) => text(event.writerId) || '<missing>');
  return {
    ok: attemptEvents.length > 0 && unauthorized.length === 0,
    checkedEvents: attemptEvents.length,
    unauthorized,
  };
}

function receiptProof(recordPath: string, events: JsonObject[]): JsonObject {
  const receiptDir = path.join(path.dirname(recordPath), 'events', 'receipts');
  const missing = events
    .map((event) => text(event.eventId).replace(/[^a-z0-9_.-]/giu, '_'))
    .filter((id) => id && !fs.existsSync(path.join(receiptDir, `${id}.json`)));
  return { ok: missing.length === 0, receiptDir: normalizePath(receiptDir), missing };
}

function schemaEvolutionProof(record: JsonObject): JsonObject {
  const store = nested(record.controlStore);
  const scriptsExist = [
    'scripts/requirement-record-event-reducer.ts',
    'scripts/controlled-ingest-atomic-committer.ts',
    'scripts/requirement-record-schema-evolution.ts',
  ].every((file) => fs.existsSync(file));
  return {
    ok:
      scriptsExist &&
      text(store.reducer) === 'canonical-requirement-record-reducer/v1' &&
      text(store.atomicCommitter) === 'requirement-record-control-store/v1',
    reducer: text(store.reducer),
    atomicCommitter: text(store.atomicCommitter),
    scriptsExist,
  };
}

function commandProof(runs: JsonObject[], commandId: string): JsonObject | null {
  const run = runs.find((item) => text(item.commandId) === commandId && item.exitCode === 0);
  return run
    ? {
        commandId,
        runId: text(run.runId),
        executionIterationRef: text(run.executionIterationId),
        exitCode: run.exitCode,
      }
    : null;
}

function productionSubsystemProofApplies(input: {
  record: JsonObject;
  attemptRuns: JsonObject[];
  applicability: JsonObject;
}): boolean {
  const explicit = boolAt(input.applicability, ['productionSubsystems', 'applies']);
  if (explicit !== null) return explicit;
  return Boolean(
    latestArtifact(input.record, 'observability_extension') ||
    commandProof(input.attemptRuns, 'CMD-PRODUCTION-SUBSYSTEM-ACCEPTANCE')
  );
}

function failureCaseProofApplies(input: {
  record: JsonObject;
  attemptRuns: JsonObject[];
  applicability: JsonObject;
}): boolean {
  const explicit = boolAt(input.applicability, [
    'runtimeRecovery',
    'requiresFunctionalResumeFailureCaseRegistry',
  ]);
  if (explicit !== null) return explicit;
  return Boolean(
    latestArtifact(input.record, 'failure_case_coverage') ||
    commandProof(input.attemptRuns, 'CMD-FULL-FAILURE-CASE-COVERAGE')
  );
}

function sftProjectionProofApplies(input: {
  record: JsonObject;
  recordPath: string;
  applicability: JsonObject;
}): boolean {
  const explicit = boolAt(input.applicability, ['scoringDashboardSft', 'applies']);
  if (explicit !== null) return explicit;
  return Boolean(
    latestOrDefaultDatasetReleaseArtifact(
      input.record,
      input.recordPath,
      'dataset_release_manifest'
    ) ||
    latestOrDefaultDatasetReleaseArtifact(
      input.record,
      input.recordPath,
      'dataset_release_gate_report'
    )
  );
}

function proveSubsystems(input: {
  record: JsonObject;
  recordPath: string;
  events: JsonObject[];
  attemptRuns: JsonObject[];
}): JsonObject[] {
  const extensionRef = latestArtifact(input.record, 'observability_extension');
  const commandRunRef = commandProof(input.attemptRuns, 'CMD-PRODUCTION-SUBSYSTEM-ACCEPTANCE');
  if (!extensionRef)
    return REQUIRED_SUBSYSTEM_IDS.map((subsystemId) => ({
      subsystemId,
      ok: false,
      issues: ['extension_artifact_missing'],
    }));
  const extensionPath = resolveArtifact(input.recordPath, text(extensionRef.path));
  const extension = fs.existsSync(extensionPath) ? readJson(extensionPath) : {};
  const event = eventForArtifact(input.events, extensionRef);
  const byId = new Map(
    objects(extension.subsystemReadiness).map((item) => [text(item.subsystemId), item])
  );
  return REQUIRED_SUBSYSTEM_IDS.map((subsystemId) => {
    const item = byId.get(subsystemId);
    const issues = [
      ...(!commandRunRef ? ['current_attempt_command_run_missing'] : []),
      ...(!artifactRefComplete(extensionRef) ||
      !fs.existsSync(extensionPath) ||
      sha256File(extensionPath) !== text(extensionRef.hash ?? extensionRef.contentHash)
        ? ['artifact_ref_invalid']
        : []),
      ...(!artifactIndexed(input.record, extensionRef) ? ['artifact_index_ref_missing'] : []),
      ...(!event ? ['controlled_event_ref_missing'] : []),
      ...(!item ? ['subsystem_item_missing'] : []),
      ...(item && strings(item.evidenceRefs).length === 0 ? ['source_refs_missing'] : []),
      ...(item && strings(nested(item.failureHandling).recoveryActions).length === 0
        ? ['recovery_action_evidence_missing']
        : []),
    ];
    return {
      subsystemId,
      ok: issues.length === 0,
      issues,
      currentAttemptCommandRunRef: commandRunRef,
      artifactRef: extensionRef,
      controlledEventRef: event ? { eventId: text(event.eventId), exists: true } : null,
    };
  });
}

function proveFailureCases(input: {
  record: JsonObject;
  recordPath: string;
  events: JsonObject[];
  attemptRuns: JsonObject[];
}): JsonObject[] {
  const ref = latestArtifact(input.record, 'failure_case_coverage');
  const commandRunRef = commandProof(input.attemptRuns, 'CMD-FULL-FAILURE-CASE-COVERAGE');
  if (!ref)
    return [
      { failureCaseId: '<missing>', ok: false, issues: ['failure_case_coverage_artifact_missing'] },
    ];
  const file = resolveArtifact(input.recordPath, text(ref.path));
  const report = fs.existsSync(file) ? readJson(file) : {};
  const event = eventForArtifact(input.events, ref);
  const cases = objects(nested(report.resumeFailureCaseRegistryCoverage).caseEvidence);
  return cases.map((item) => {
    const failureCaseId = text(item.caseId) || text(item.id) || '<missing>';
    const issues = [
      ...(!commandRunRef ? ['current_attempt_command_run_missing'] : []),
      ...(!artifactRefComplete(ref) ||
      !fs.existsSync(file) ||
      sha256File(file) !== text(ref.hash ?? ref.contentHash)
        ? ['artifact_ref_invalid']
        : []),
      ...(!artifactIndexed(input.record, ref) ? ['artifact_index_ref_missing'] : []),
      ...(!event ? ['controlled_event_ref_missing'] : []),
      ...(strings(item.sourceRefs).length === 0 && objects(item.sourceRefs).length === 0
        ? ['source_refs_missing']
        : []),
      ...(strings(item.expectedRecoveryActions).length === 0 &&
      objects(item.recoveryActionEvidence).length === 0
        ? ['recovery_action_evidence_missing']
        : []),
    ];
    return {
      failureCaseId,
      ok: issues.length === 0,
      issues,
      currentAttemptCommandRunRef: commandRunRef,
      artifactRef: ref,
      controlledEventRef: event ? { eventId: text(event.eventId), exists: true } : null,
    };
  });
}

function sftProjectionProof(record: JsonObject, recordPath: string): JsonObject {
  const manifestRef = latestOrDefaultDatasetReleaseArtifact(
    record,
    recordPath,
    'dataset_release_manifest'
  );
  const releaseRef = latestOrDefaultDatasetReleaseArtifact(
    record,
    recordPath,
    'dataset_release_gate_report'
  );
  const reasons: string[] = [];
  if (!manifestRef) reasons.push('dataset_manifest_artifact_missing');
  if (!releaseRef) reasons.push('dataset_release_report_artifact_missing');
  const manifestPath = manifestRef ? resolveArtifact(recordPath, text(manifestRef.path)) : '';
  const manifest = manifestPath && fs.existsSync(manifestPath) ? readJson(manifestPath) : {};
  const refs = [
    nested(nested(manifest.exports).train),
    nested(nested(manifest.exports).validation),
    nested(nested(manifest.exports).test),
    nested(nested(manifest.reports).qualityReport),
    nested(nested(manifest.reports).redactionReport),
    nested(nested(manifest.reports).contaminationReport),
    nested(nested(manifest.reports).lineageReport),
    nested(nested(manifest.reports).postTrainingEvalReport),
    nested(nested(manifest.training).trainingRun),
    nested(nested(manifest.training).evalReport),
    nested(nested(manifest.projections).openai),
    nested(nested(manifest.projections).huggingface),
  ];
  refs.forEach((ref, index) => {
    const file = text(ref.path);
    if (!file || !fs.existsSync(file) || sha256File(file) !== text(ref.hash ?? ref.contentHash))
      reasons.push(`dataset_projection_ref_invalid:${index}`);
  });
  return { ok: reasons.length === 0, manifestPath: normalizePath(manifestPath), reasons };
}

function missingSourceTargetArtifactProof(input: {
  record: JsonObject;
  evaluatedAt: string;
  evaluatedBy: string;
  attemptId: string;
}): JsonObject {
  const required = Boolean(text(input.record.implementationConfirmationHash));
  return {
    reportType: 'target_artifact_realization_report',
    generatedAt: input.evaluatedAt,
    generatedBy: input.evaluatedBy,
    currentAttemptId: input.attemptId,
    decision: required ? 'blocked' : 'pass',
    blockingReasons: required ? ['target_artifact_source_missing'] : [],
    issues: required
      ? [
          {
            code: 'target_artifact_source_missing',
            message:
              'strict closeout proof requires --source when implementationConfirmationHash is present',
            refs: ['implementationConfirmationHash'],
          },
        ]
      : [],
  };
}

export function evaluateStrictCloseoutProof(input: {
  record: JsonObject;
  recordPath: string;
  attemptId: string;
  evaluatedAt: string;
  evaluatedBy: string;
  sourcePath?: string;
}): JsonObject {
  const events = readJsonl(eventLogPath(input.recordPath, input.record));
  const attemptRuns = commandRunsForAttempt(input.record, input.attemptId);
  const applicability = contractApplicability(input.sourcePath);
  const subsystemProofRequired = productionSubsystemProofApplies({
    record: input.record,
    attemptRuns,
    applicability,
  });
  const failureCaseProofRequired = failureCaseProofApplies({
    record: input.record,
    attemptRuns,
    applicability,
  });
  const sftProjectionProofRequired = sftProjectionProofApplies({
    record: input.record,
    recordPath: input.recordPath,
    applicability,
  });
  const subsystemEvidence = subsystemProofRequired
    ? proveSubsystems({
        record: input.record,
        recordPath: input.recordPath,
        events,
        attemptRuns,
      })
    : [];
  const failureCaseEvidence = failureCaseProofRequired
    ? proveFailureCases({
        record: input.record,
        recordPath: input.recordPath,
        events,
        attemptRuns,
      })
    : [];
  const replayFromEventLog = replayProof(input.record, events);
  const writerRegistryAuthorization = writerRegistryProof(events, input.attemptId);
  const atomicCommitRecovery = receiptProof(input.recordPath, events);
  const schemaEvolutionCompatibility = schemaEvolutionProof(input.record);
  const closeoutAttemptInvalidationPolicy = {
    ok: events.some(
      (event) =>
        text(event.eventType) === 'closeout_recorded' ||
        text(event.eventType) === 'record_closed' ||
        text(event.eventType) === 'implementation_evidence_ingested'
    ),
  };
  const sftProjectionLineage = sftProjectionProofRequired
    ? sftProjectionProof(input.record, input.recordPath)
    : { ok: true, skipped: true, reason: 'scoringDashboardSft_not_applicable' };
  const targetArtifactRealization = input.sourcePath
    ? evaluateTargetArtifactRealization({
        sourcePath: input.sourcePath,
        record: input.record,
        recordPath: input.recordPath,
        attemptId: input.attemptId,
        evaluatedAt: input.evaluatedAt,
        evaluatedBy: input.evaluatedBy,
      })
    : missingSourceTargetArtifactProof(input);
  const blockingReasons = [
    ...(!replayFromEventLog.ok ? ['event_log_replay_failed'] : []),
    ...(!writerRegistryAuthorization.ok ? ['writer_registry_authorization_failed'] : []),
    ...(!atomicCommitRecovery.ok ? ['atomic_commit_receipt_missing'] : []),
    ...(!schemaEvolutionCompatibility.ok ? ['schema_evolution_compatibility_failed'] : []),
    ...(!closeoutAttemptInvalidationPolicy.ok
      ? ['closeout_attempt_invalidation_policy_missing']
      : []),
    ...subsystemEvidence.flatMap((item) =>
      item.ok ? [] : [`subsystem_join_failed:${text(item.subsystemId)}`]
    ),
    ...failureCaseEvidence.flatMap((item) =>
      item.ok ? [] : [`failure_case_join_failed:${text(item.failureCaseId)}`]
    ),
    ...(!sftProjectionLineage.ok ? ['sft_projection_lineage_failed'] : []),
    ...(text(targetArtifactRealization.decision) === 'pass'
      ? []
      : [
          'target_artifact_realization_failed',
          ...strings(targetArtifactRealization.blockingReasons),
        ]),
  ];
  const decision: Decision = blockingReasons.length === 0 ? 'pass' : 'blocked';
  return {
    reportType: 'strict_closeout_proof_report',
    generatedAt: input.evaluatedAt,
    generatedBy: input.evaluatedBy,
    currentAttemptId: input.attemptId,
    decision,
    blockingReasons: [...new Set(blockingReasons)],
    applicability: {
      productionSubsystemProofRequired: subsystemProofRequired,
      failureCaseProofRequired,
      sftProjectionProofRequired,
    },
    replayFromEventLog,
    writerRegistryAuthorization,
    atomicCommitRecovery,
    schemaEvolutionCompatibility,
    closeoutAttemptInvalidationPolicy,
    subsystemEvidence,
    failureCaseEvidence,
    sftProjectionLineage,
    targetArtifactRealization,
  };
}

export function mainStrictCloseoutProofGate(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: strict-closeout-proof-gate --requirement-record <json> --source <requirement.md> [--attempt-id <id>] [--report-path <json>] [--json]'
    );
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const attemptId = currentAttempt(record, args.attemptId);
  if (!attemptId) throw new Error('closeout attempt id missing');
  const reportPath = path.resolve(
    args.reportPath ?? path.join(path.dirname(recordPath), 'strict-closeout-proof-report.json')
  );
  const report = evaluateStrictCloseoutProof({
    record,
    recordPath,
    attemptId,
    evaluatedAt: args.evaluatedAt ?? new Date().toISOString(),
    evaluatedBy: args.evaluatedBy ?? 'agent',
    sourcePath: args.source ? path.resolve(args.source) : undefined,
  });
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const output = {
    ok: true,
    reportPath: normalizePath(reportPath),
    decision: report.decision,
    blockingReasons: report.blockingReasons,
  };
  process.stdout.write(
    args.json
      ? `${JSON.stringify(output, null, 2)}\n`
      : `strict_closeout_proof=${report.decision}\n`
  );
  return report.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainStrictCloseoutProofGate(process.argv.slice(2));
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
