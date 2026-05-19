/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  evidence?: string;
  requirementRecord?: string;
  eventLog?: string;
  artifactIndex?: string;
  confirmedAt?: string;
  recordedBy?: string;
  json?: boolean;
  help?: boolean;
}

const EXECUTION_STATUSES = new Set([
  'pending',
  'running',
  'done',
  'partial',
  'blocked',
  'failed',
  'timeout',
  'cancelled',
  'rerun_required',
]);
const CLOSURE_STATUSES = new Set(['open', 'pass', 'fail', 'blocked']);
const GATE_DECISIONS = new Set(['pass', 'fail', 'blocked', 'not_applicable', 'skipped_by_policy']);

function isDirectImplementationEvidenceIngestCli(entry: string | undefined): boolean {
  return /(^|[\\/])ingest-implementation-evidence(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
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

function requireArgs(args: ParsedArgs): void {
  const missing = ['evidence', 'requirementRecord'].filter((key) => !args[key as keyof ParsedArgs]);
  if (missing.length > 0) throw new Error(`missing required args: ${missing.join(', ')}`);
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

function arrayOfObjects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function appendJsonl(file: string, value: JsonObject): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function containsForbiddenField(value: unknown, field: string): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => containsForbiddenField(item, field));
  const obj = value as JsonObject;
  return Object.prototype.hasOwnProperty.call(obj, field) || Object.values(obj).some((item) => containsForbiddenField(item, field));
}

function requireHashMatch(packet: JsonObject, record: JsonObject): string[] {
  const mismatches: string[] = [];
  for (const field of ['sourceDocumentHash', 'implementationConfirmationHash']) {
    if (text(packet[field]) !== text(record[field])) mismatches.push(`${field}_mismatch`);
  }
  const state = record.architectureConfirmationState as JsonObject | undefined;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    mismatches.push('architecture_confirmation_state_missing');
  } else {
    if (text(state.status) !== 'active') mismatches.push('architecture_confirmation_not_active');
    if (text(packet.architectureConfirmationHash) !== text(state.currentArchitectureConfirmationHash)) {
      mismatches.push('architecture_confirmation_hash_mismatch');
    }
  }
  return mismatches;
}

function sourceRefs(packet: JsonObject): JsonObject[] {
  const refs: JsonObject[] = [];
  for (const id of arrayOfStrings(packet.traceRows)) refs.push({ sourceType: 'trace_row', id });
  for (const id of arrayOfStrings(packet.evidenceRefs)) refs.push({ sourceType: 'evidence', id });
  for (const run of arrayOfObjects(packet.commandRuns)) refs.push({ sourceType: 'command_run', id: text(run.commandId) });
  return refs.filter((ref) => text(ref.id));
}

function validateCommands(packet: JsonObject): string[] {
  const mismatches: string[] = [];
  const runId = text(packet.runId);
  const closeoutAttemptId = text(packet.closeoutAttemptId);
  const commandRuns = arrayOfObjects(packet.commandRuns);
  if (!runId) mismatches.push('run_id_missing');
  if (commandRuns.length === 0) mismatches.push('command_runs_missing');
  for (const run of commandRuns) {
    if (!text(run.commandId)) mismatches.push('command_id_missing');
    if (!text(run.command)) mismatches.push('command_missing');
    if (typeof run.exitCode !== 'number') mismatches.push('command_exit_code_missing');
    if (!text(run.startedAt) || !text(run.completedAt)) mismatches.push('command_time_missing');
    if (text(run.runId) !== runId) mismatches.push('command_run_id_mismatch');
    if (closeoutAttemptId && text(run.closeoutAttemptId) !== closeoutAttemptId) {
      mismatches.push('command_closeout_attempt_id_mismatch');
    }
  }
  return mismatches;
}

function validateArtifacts(packet: JsonObject): string[] {
  const mismatches: string[] = [];
  for (const artifact of arrayOfObjects(packet.artifactRefs)) {
    const artifactPath = text(artifact.path);
    const hash = text(artifact.hash ?? artifact.contentHash);
    if (!artifactPath) mismatches.push('artifact_path_missing');
    if (!hash) mismatches.push('artifact_hash_missing');
    const absolute = path.isAbsolute(artifactPath) ? artifactPath : path.resolve(process.cwd(), artifactPath);
    if (artifactPath && fs.existsSync(absolute) && hash && sha256File(absolute) !== hash) {
      mismatches.push(`artifact_hash_mismatch:${artifactPath}`);
    }
  }
  return mismatches;
}

function validateImplementationDelta(packet: JsonObject): string[] {
  const mismatches: string[] = [];
  const delta = packet.implementationDelta as JsonObject | undefined;
  if (!delta || typeof delta !== 'object' || Array.isArray(delta)) {
    mismatches.push('implementation_delta_missing');
    return mismatches;
  }
  if (arrayOfStrings(delta.filesChanged).length === 0) mismatches.push('implementation_delta_files_changed_missing');
  if (!text(delta.diffSummaryRef)) mismatches.push('implementation_delta_diff_summary_ref_missing');
  if (arrayOfObjects(delta.negativeAssertionArtifactRefs).length === 0) {
    mismatches.push('implementation_delta_negative_assertion_artifact_refs_missing');
  }
  if (delta.behaviorAffecting !== true) mismatches.push('implementation_delta_not_behavior_affecting');
  return mismatches;
}

function validatePacket(packet: JsonObject, record: JsonObject): string[] {
  const mismatches = [
    ...requireHashMatch(packet, record),
    ...validateCommands(packet),
    ...validateArtifacts(packet),
    ...validateImplementationDelta(packet),
  ];
  if (containsForbiddenField(packet, 'result')) mismatches.push('forbidden_result_field');
  if (text(packet.eventType) && text(packet.eventType) !== 'execution_iteration_recorded') {
    mismatches.push('unsupported_event_type');
  }
  if (!EXECUTION_STATUSES.has(text(packet.status))) mismatches.push('execution_status_invalid');
  if (!text(packet.executionIterationId)) mismatches.push('execution_iteration_id_missing');
  if (sourceRefs(packet).length === 0) mismatches.push('source_refs_missing');
  for (const closure of arrayOfObjects(packet.requirementClosures)) {
    if (!text(closure.requirementId)) mismatches.push('closure_requirement_id_missing');
    if (!CLOSURE_STATUSES.has(text(closure.status))) mismatches.push('closure_status_invalid');
  }
  for (const gate of arrayOfObjects(packet.gateChecks)) {
    if (!text(gate.gate)) mismatches.push('gate_missing');
    if (!GATE_DECISIONS.has(text(gate.decision))) mismatches.push('gate_decision_invalid');
  }
  const deliveryEvidence = packet.deliveryEvidence as JsonObject | undefined;
  for (const command of arrayOfObjects(deliveryEvidence?.requiredCommands)) {
    if (!text(command.commandId)) mismatches.push('required_command_id_missing');
    if (!text(command.command)) mismatches.push('required_command_missing');
    if (command.blockingIfMissing !== true) mismatches.push('required_command_not_blocking');
    if (arrayOfObjects(command.artifactRefs).length === 0) mismatches.push('required_command_artifact_refs_missing');
  }
  return [...new Set(mismatches)];
}

function commandRunRefs(packet: JsonObject): JsonObject[] {
  return arrayOfObjects(packet.commandRuns).map((run) => ({
    commandId: text(run.commandId),
    command: text(run.command),
    runId: text(run.runId),
    closeoutAttemptId: text(run.closeoutAttemptId),
    exitCode: run.exitCode,
    startedAt: text(run.startedAt),
    completedAt: text(run.completedAt),
    outputSummary: text(run.outputSummary),
  }));
}

function artifactEvents(packet: JsonObject, recordId: string, requirementSetId: string): JsonObject[] {
  return arrayOfObjects(packet.artifactRefs).map((artifact) => ({
    eventType: 'artifact_indexed',
    artifactType: text(artifact.artifactType) || 'implementation_evidence',
    sourceOfTruthRole: text(artifact.sourceOfTruthRole) || 'evidence',
    recordId,
    requirementSetId,
    path: normalizePathForRecord(text(artifact.path)),
    contentHash: text(artifact.hash ?? artifact.contentHash),
    producer: text(artifact.producer) || 'ingest-implementation-evidence',
    traceRows: arrayOfStrings(packet.traceRows),
    evidenceRefs: arrayOfStrings(packet.evidenceRefs),
  }));
}

function updateRecord(record: JsonObject, packet: JsonObject, recordedAt: string, recordedBy: string): JsonObject {
  const recordId = text(packet.recordId) || text(record.recordId);
  const requirementSetId = text(packet.requirementSetId) || text(record.requirementSetId);
  const refs = sourceRefs(packet);
  const commandRefs = commandRunRefs(packet);
  const artifactRefs = artifactEvents(packet, recordId, requirementSetId);
  const executionEvent = {
    eventType: 'execution_iteration_recorded',
    recordId,
    requirementSetId,
    executionIterationId: text(packet.executionIterationId),
    runId: text(packet.runId),
    status: text(packet.status),
    traceRows: arrayOfStrings(packet.traceRows),
    taskRefs: arrayOfStrings(packet.taskRefs),
    evidenceRefs: arrayOfStrings(packet.evidenceRefs),
    filesChanged: arrayOfStrings(packet.filesChanged),
    implementationDelta: packet.implementationDelta,
    diffSummary: text(packet.diffSummary),
    commandRunRefs: commandRefs,
    evidenceArtifactRefs: artifactRefs,
    sourceRefs: refs,
    sourceDocumentHash: text(packet.sourceDocumentHash),
    implementationConfirmationHash: text(packet.implementationConfirmationHash),
    architectureConfirmationHash: text(packet.architectureConfirmationHash),
    recordedAt,
    recordedBy,
  };
  const closureEvents = arrayOfObjects(packet.requirementClosures).map((closure) => ({
    eventType: 'requirement_closure_recorded',
    recordId,
    requirementSetId,
    requirementId: text(closure.requirementId),
    status: text(closure.status),
    traceRows: arrayOfStrings(packet.traceRows),
    evidenceRefs: arrayOfStrings(packet.evidenceRefs),
    commandRunRefs: commandRefs,
    evidenceArtifactRefs: artifactRefs,
    sourceRefs: refs,
    recordedAt,
    recordedBy,
  }));
  const gateEvents = arrayOfObjects(packet.gateChecks).map((gate) => ({
    eventType: 'gate_check_recorded',
    recordId,
    requirementSetId,
    checkId: text(gate.checkId) || `${text(packet.executionIterationId)}:${text(gate.gate)}`,
    gate: text(gate.gate),
    decision: text(gate.decision),
    sourceRefs: refs,
    commandRunRefs: commandRefs,
    recordedAt,
    recordedBy,
  }));
  const existingDeliveryEvidence =
    record.deliveryEvidence && typeof record.deliveryEvidence === 'object' && !Array.isArray(record.deliveryEvidence)
      ? (record.deliveryEvidence as JsonObject)
      : {};
  const packetDeliveryEvidence =
    packet.deliveryEvidence && typeof packet.deliveryEvidence === 'object' && !Array.isArray(packet.deliveryEvidence)
      ? (packet.deliveryEvidence as JsonObject)
      : {};
  const existingRequiredCommands = arrayOfObjects(existingDeliveryEvidence.requiredCommands);
  const packetRequiredCommands = arrayOfObjects(packetDeliveryEvidence.requiredCommands);
  const requiredCommandsById = new Map<string, JsonObject>();
  for (const command of existingRequiredCommands) requiredCommandsById.set(text(command.commandId), command);
  for (const command of packetRequiredCommands) requiredCommandsById.set(text(command.commandId), command);
  return {
    ...record,
    executionIterations: [...arrayOfObjects(record.executionIterations), executionEvent],
    requirementClosures: [...arrayOfObjects(record.requirementClosures), ...closureEvents],
    gateChecks: [...arrayOfObjects(record.gateChecks), ...gateEvents],
    artifactIndex: [...arrayOfObjects(record.artifactIndex), ...artifactRefs],
    deliveryEvidence: {
      ...existingDeliveryEvidence,
      ...packetDeliveryEvidence,
      requiredCommands: [...requiredCommandsById.values()].filter((command) => text(command.commandId)),
      historicalRunRefs: [
        ...arrayOfObjects(existingDeliveryEvidence.historicalRunRefs),
        ...arrayOfObjects(packetDeliveryEvidence.historicalRunRefs),
      ],
    },
    lastEventType: 'execution_iteration_recorded',
    updatedAt: recordedAt,
  };
}

export function mainIngestImplementationEvidence(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: ingest-implementation-evidence --evidence <json> --requirement-record <json> [--json]');
    return 0;
  }
  requireArgs(args);
  const evidencePath = path.resolve(args.evidence!);
  const recordPath = path.resolve(args.requirementRecord!);
  const packet = readJson(evidencePath);
  const record = readJson(recordPath);
  const mismatches = validatePacket(packet, record);
  if (mismatches.length > 0) {
    console.error(JSON.stringify({ ok: false, mismatches }, null, 2));
    return 3;
  }
  const recordedAt = args.confirmedAt ?? new Date().toISOString();
  const recordedBy = args.recordedBy ?? 'agent';
  const nextRecord = updateRecord(record, packet, recordedAt, recordedBy);
  fs.writeFileSync(recordPath, `${JSON.stringify(nextRecord, null, 2)}\n`, 'utf8');
  const baseDir = path.dirname(recordPath);
  const eventLog = path.resolve(args.eventLog ?? path.join(baseDir, 'data', 'mentor-events.jsonl'));
  const artifactIndex = path.resolve(args.artifactIndex ?? path.join(baseDir, 'artifact-index.jsonl'));
  appendJsonl(eventLog, nextRecord.executionIterations.at(-1) as JsonObject);
  for (const item of arrayOfObjects(packet.requirementClosures)) {
    appendJsonl(eventLog, {
      eventType: 'requirement_closure_recorded',
      recordId: text(packet.recordId) || text(record.recordId),
      requirementId: text(item.requirementId),
      status: text(item.status),
      sourceRefs: sourceRefs(packet),
      recordedAt,
      recordedBy,
    });
  }
  for (const artifact of artifactEvents(packet, text(packet.recordId) || text(record.recordId), text(packet.requirementSetId) || text(record.requirementSetId))) {
    appendJsonl(artifactIndex, artifact);
  }
  const result = { ok: true, requirementRecordPath: normalizePathForRecord(recordPath), eventLogPath: normalizePathForRecord(eventLog), artifactIndexPath: normalizePathForRecord(artifactIndex) };
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `execution_iteration_recorded=${text(packet.executionIterationId)}\n`);
  return 0;
}

if (require.main === module && isDirectImplementationEvidenceIngestCli(process.argv[1])) {
  try {
    process.exitCode = mainIngestImplementationEvidence(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
