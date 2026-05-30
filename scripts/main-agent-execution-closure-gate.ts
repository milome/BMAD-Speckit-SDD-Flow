/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildPerMustClosureEvidenceIndex } from './per-must-closure-evidence-index';
import { appendControlEventAndReplay, sha256Text } from './requirement-record-control-store';
import { openReconfirmationRequests } from './reconfirmation-runtime';

type JsonObject = Record<string, unknown>;
type ExecutionClosureDecision = 'pass' | 'blocked';

interface ParsedArgs {
  requirementRecord?: string;
  modelPacket?: string;
  implementationEvidence?: string;
  commandSummary?: string;
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
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
  if (!Array.isArray(parsed)) throw new Error(`JSON array expected: ${file}`);
  return parsed.filter(
    (item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  );
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function resolveTraceExecutionDir(recordPath: string, attemptId: string): string {
  return path.join(path.dirname(recordPath), 'trace-execution', attemptId);
}

function defaultModelPacketPath(recordPath: string, attemptId: string): string {
  return path.join(resolveTraceExecutionDir(recordPath, attemptId), 'model_packet.json');
}

function defaultImplementationEvidencePath(recordPath: string, attemptId: string): string {
  return path.join(
    resolveTraceExecutionDir(recordPath, attemptId),
    'implementation-evidence',
    'implementation-evidence-packet.json'
  );
}

function defaultCommandSummaryPath(recordPath: string, attemptId: string): string {
  return path.join(
    resolveTraceExecutionDir(recordPath, attemptId),
    'command-results',
    'summary.json'
  );
}

function defaultReportPath(recordPath: string, attemptId: string): string {
  return path.join(
    resolveTraceExecutionDir(recordPath, attemptId),
    'execution-closure-report.json'
  );
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

function currentHashes(record: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries({
      sourceDocumentHash: text(record.sourceDocumentHash),
      implementationConfirmationHash: text(record.implementationConfirmationHash),
      architectureConfirmationHash: text(
        nested(record.architectureConfirmationState).currentArchitectureConfirmationHash
      ),
    }).filter(([, value]) => text(value))
  );
}

function commandSummaryCheck(
  summaryPath: string,
  modelPacket: JsonObject
): {
  check: JsonObject;
  blockingReasons: string[];
  commandRuns: JsonObject[];
} {
  if (!fs.existsSync(summaryPath)) {
    return {
      check: {
        id: 'required-command-summary-present',
        passed: false,
        path: normalizePathForRecord(summaryPath),
        blockingReasons: ['command_summary_missing'],
      },
      blockingReasons: ['command_summary_missing'],
      commandRuns: [],
    };
  }
  const commandRuns = readJsonArray(summaryPath);
  const requiredCommands = objects(modelPacket.requiredCommands);
  const failedCommands = commandRuns
    .filter((run) => run.exitCode !== 0)
    .map((run) => text(run.commandId) || '<missing>');
  const commandIds = new Set(commandRuns.map((run) => text(run.commandId)).filter(Boolean));
  const missingCommands = requiredCommands
    .map((command) => text(command.id ?? command.commandId))
    .filter((commandId) => commandId && !commandIds.has(commandId));
  const blockingReasons = uniqueStrings([
    ...(commandRuns.length === 0 ? ['command_summary_empty'] : []),
    ...failedCommands.map((commandId) => `required_command_failed:${commandId}`),
    ...missingCommands.map((commandId) => `required_command_missing_from_summary:${commandId}`),
  ]);
  return {
    check: {
      id: 'required-command-summary-complete',
      passed: blockingReasons.length === 0,
      path: normalizePathForRecord(summaryPath),
      hash: sha256File(summaryPath),
      expectedCount: requiredCommands.length,
      actualCount: commandRuns.length,
      failedCommandIds: failedCommands,
      missingCommandIds: missingCommands,
      blockingReasons,
    },
    blockingReasons,
    commandRuns,
  };
}

function implementationEvidenceCheck(
  evidencePath: string,
  input: {
    record: JsonObject;
    attemptId: string;
    commandCount: number;
  }
): { check: JsonObject; blockingReasons: string[] } {
  if (!fs.existsSync(evidencePath)) {
    return {
      check: {
        id: 'implementation-evidence-packet-present',
        passed: false,
        path: normalizePathForRecord(evidencePath),
        blockingReasons: ['implementation_evidence_packet_missing'],
      },
      blockingReasons: ['implementation_evidence_packet_missing'],
    };
  }
  const evidence = readJson(evidencePath);
  const evidenceCommands = objects(evidence.commandRuns);
  const evidenceClosures = objects(evidence.requirementClosures);
  const evidenceArtifacts = objects(evidence.artifactRefs);
  const blockingReasons = uniqueStrings([
    text(evidence.status) === 'done' ? '' : 'implementation_evidence_status_not_done',
    text(evidence.runId) === input.attemptId ? '' : 'implementation_evidence_run_id_mismatch',
    text(evidence.closeoutAttemptId) === input.attemptId
      ? ''
      : 'implementation_evidence_attempt_id_mismatch',
    text(evidence.sourceDocumentHash) === text(input.record.sourceDocumentHash)
      ? ''
      : 'implementation_evidence_source_hash_mismatch',
    text(evidence.implementationConfirmationHash) ===
    text(input.record.implementationConfirmationHash)
      ? ''
      : 'implementation_evidence_confirmation_hash_mismatch',
    evidenceCommands.length >= input.commandCount
      ? ''
      : 'implementation_evidence_command_runs_incomplete',
    evidenceClosures.length > 0 ? '' : 'implementation_evidence_requirement_closures_missing',
    evidenceArtifacts.length > 0 ? '' : 'implementation_evidence_artifact_refs_missing',
  ]);
  return {
    check: {
      id: 'implementation-evidence-packet-current',
      passed: blockingReasons.length === 0,
      path: normalizePathForRecord(evidencePath),
      hash: sha256File(evidencePath),
      status: text(evidence.status),
      runId: text(evidence.runId),
      closeoutAttemptId: text(evidence.closeoutAttemptId),
      commandRunCount: evidenceCommands.length,
      requirementClosureCount: evidenceClosures.length,
      artifactRefCount: evidenceArtifacts.length,
      blockingReasons,
    },
    blockingReasons,
  };
}

function executionEvidenceInRecordCheck(
  record: JsonObject,
  attemptId: string
): {
  check: JsonObject;
  blockingReasons: string[];
} {
  const iterations = objects(record.executionIterations).filter(
    (iteration) =>
      text(iteration.runId) === attemptId || text(iteration.executionIterationId) === attemptId
  );
  const latestIteration = iterations.at(-1);
  const closures = objects(record.requirementClosures).filter(
    (closure) => text(closure.status) === 'pass'
  );
  const blockingReasons = uniqueStrings([
    iterations.length > 0 ? '' : 'execution_iteration_not_ingested',
    text(latestIteration?.status) === 'done' ? '' : 'execution_iteration_status_not_done',
    closures.length > 0 ? '' : 'requirement_closures_not_ingested',
    objects(record.artifactIndex).length > 0 ? '' : 'artifact_index_not_ingested',
  ]);
  return {
    check: {
      id: 'runtime-record-execution-evidence-ingested',
      passed: blockingReasons.length === 0,
      executionIterationCount: iterations.length,
      latestExecutionIterationId: text(latestIteration?.executionIterationId) || null,
      latestStatus: text(latestIteration?.status) || null,
      passClosureCount: closures.length,
      artifactIndexCount: objects(record.artifactIndex).length,
      blockingReasons,
    },
    blockingReasons,
  };
}

function evaluate(input: {
  record: JsonObject;
  recordPath: string;
  modelPacketPath: string;
  evidencePath: string;
  commandSummaryPath: string;
  attemptId: string;
  evaluatedAt: string;
}): {
  decision: ExecutionClosureDecision;
  blockingReasons: string[];
  checks: JsonObject[];
  perMustIndex: JsonObject;
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
  const modelPacket = fs.existsSync(input.modelPacketPath) ? readJson(input.modelPacketPath) : null;
  if (!modelPacket) {
    checks.push({
      id: 'model-packet-present',
      passed: false,
      path: normalizePathForRecord(input.modelPacketPath),
      blockingReasons: ['model_packet_missing'],
    });
    const perMustIndex = {
      decision: 'blocked',
      counts: { total: 0, pass: 0, blocked: 0 },
      blockingReasons: ['model_packet_missing'],
      rows: [],
    };
    return {
      decision: 'blocked',
      blockingReasons: ['model_packet_missing'],
      checks,
      perMustIndex,
    };
  }

  checks.push({
    id: 'model-packet-current',
    passed:
      text(modelPacket.sourceDocumentHash) === text(input.record.sourceDocumentHash) &&
      text(modelPacket.implementationConfirmationHash) ===
        text(input.record.implementationConfirmationHash),
    path: normalizePathForRecord(input.modelPacketPath),
    hash: sha256File(input.modelPacketPath),
    sourceDocumentHash: text(modelPacket.sourceDocumentHash),
    implementationConfirmationHash: text(modelPacket.implementationConfirmationHash),
  });
  if (text(modelPacket.sourceDocumentHash) !== text(input.record.sourceDocumentHash)) {
    blockingReasons.push('model_packet_source_hash_mismatch');
  }
  if (
    text(modelPacket.implementationConfirmationHash) !==
    text(input.record.implementationConfirmationHash)
  ) {
    blockingReasons.push('model_packet_confirmation_hash_mismatch');
  }

  const summary = commandSummaryCheck(input.commandSummaryPath, modelPacket);
  checks.push(summary.check);
  blockingReasons.push(...summary.blockingReasons);

  const evidence = implementationEvidenceCheck(input.evidencePath, {
    record: input.record,
    attemptId: input.attemptId,
    commandCount: objects(modelPacket.requiredCommands).length,
  });
  checks.push(evidence.check);
  blockingReasons.push(...evidence.blockingReasons);

  const recordEvidence = executionEvidenceInRecordCheck(input.record, input.attemptId);
  checks.push(recordEvidence.check);
  blockingReasons.push(...recordEvidence.blockingReasons);

  const perMustIndex = buildPerMustClosureEvidenceIndex({
    modelPacket,
    record: input.record,
    attemptId: input.attemptId,
    modelPacketPath: input.modelPacketPath,
    requirementRecordPath: input.recordPath,
    generatedAt: input.evaluatedAt,
  });
  checks.push({
    id: 'per-must-closure-evidence-index',
    passed: text(perMustIndex.decision) === 'pass',
    counts: perMustIndex.counts,
    blockingReasons: strings(perMustIndex.blockingReasons),
  });
  if (text(perMustIndex.decision) !== 'pass') {
    blockingReasons.push(
      'per_must_closure_evidence_index_not_passed',
      ...strings(perMustIndex.blockingReasons)
    );
  }

  return {
    decision: blockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons: uniqueStrings(blockingReasons),
    checks,
    perMustIndex,
  };
}

function updateRecord(
  record: JsonObject,
  input: {
    attemptId: string;
    decision: ExecutionClosureDecision;
    blockingReasons: string[];
    checks: JsonObject[];
    reportPath: string;
    reportHash: string;
    evaluatedAt: string;
    evaluatedBy: string;
  }
): JsonObject {
  const previousSixModelResults = nested(record.sixModelResults);
  const gateCheckId = `execution-closure:${input.attemptId}`;
  const gateCheck = {
    eventType: 'gate_check_recorded',
    checkId: gateCheckId,
    gate: 'Execution Closure Gate',
    decision: input.decision,
    blockingReasons: input.blockingReasons,
    checks: input.checks,
    reportPath: normalizePathForRecord(input.reportPath),
    sourceRefs: [
      { sourceType: 'execution_iteration', id: input.attemptId },
      {
        sourceType: 'per_must_closure_evidence_index',
        id: normalizePathForRecord(input.reportPath),
      },
    ],
    recordedAt: input.evaluatedAt,
    recordedBy: input.evaluatedBy,
  };
  const resultPayload = {
    payloadKind: 'model_result',
    model: 'execution_closure',
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
      { sourceType: 'execution_closure_report', id: normalizePathForRecord(input.reportPath) },
    ],
    currentHashes: {
      ...currentHashes(record),
      executionClosureReportHash: input.reportHash,
    },
  };
  const transition =
    input.decision === 'pass'
      ? {
          eventType: 'mental_model_transition_recorded',
          fromModel: 'implementation_readiness',
          toModel: 'execution_closure',
          sourceRefs: [{ sourceType: 'model_result', id: 'implementation_readiness' }],
          recordedAt: input.evaluatedAt,
          recordedBy: input.evaluatedBy,
        }
      : null;
  return {
    ...record,
    gateChecks: [...objects(record.gateChecks), gateCheck],
    sixModelResults: {
      ...previousSixModelResults,
      execution_closure: resultPayload,
    },
    currentMentalModel: 'execution_closure',
    currentStage: 'execution_closure',
    stage: text(record.stage) || 'execution_closure',
    mentalModelTransitions: [
      ...objects(record.mentalModelTransitions),
      ...(transition ? [transition] : []),
    ],
    lastEventType: 'execution_closure_result_recorded',
    updatedAt: input.evaluatedAt,
  };
}

export function mainExecutionClosureGate(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: main-agent-execution-closure-gate --requirement-record <json> [--attempt-id <id>] [--model-packet <json>] [--implementation-evidence <json>] [--command-summary <json>] [--json]'
    );
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const attemptId = resolveAttemptId(args, record);
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = args.evaluatedBy ?? 'agent';
  const modelPacketPath = path.resolve(
    args.modelPacket ?? defaultModelPacketPath(recordPath, attemptId)
  );
  const evidencePath = path.resolve(
    args.implementationEvidence ?? defaultImplementationEvidencePath(recordPath, attemptId)
  );
  const commandSummaryPath = path.resolve(
    args.commandSummary ?? defaultCommandSummaryPath(recordPath, attemptId)
  );
  const reportPath = path.resolve(args.reportPath ?? defaultReportPath(recordPath, attemptId));
  const evaluation = evaluate({
    record,
    recordPath,
    modelPacketPath,
    evidencePath,
    commandSummaryPath,
    attemptId,
    evaluatedAt,
  });
  const report = {
    reportType: 'execution_closure_report',
    generatedAt: evaluatedAt,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    attemptId,
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
    perMustClosureEvidenceIndex: evaluation.perMustIndex,
  };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const reportHash = sha256File(reportPath);
  const commit = appendControlEventAndReplay({
    recordPath,
    writerId: 'execution-closure-gate-writer',
    eventType: 'execution_closure_result_recorded',
    recordedAt: evaluatedAt,
    payload: {
      attemptId,
      decision: evaluation.decision,
      blockingReasons: evaluation.blockingReasons,
      checks: evaluation.checks,
      reportPath: normalizePathForRecord(reportPath),
      reportHash,
      evaluatedAt,
      evaluatedBy,
      recordHashBeforeClosure: sha256Text(JSON.stringify(record)),
    },
    reduce: (currentRecord) =>
      updateRecord(currentRecord, {
        attemptId,
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
    counts: nested(evaluation.perMustIndex.counts),
    controlEventId: commit.event.eventId,
    controlEventHash: commit.event.eventHash,
    eventLogPath: normalizePathForRecord(commit.eventLogPath),
    receiptPath: normalizePathForRecord(commit.receiptPath),
  };
  process.stdout.write(
    args.json
      ? `${JSON.stringify(output, null, 2)}\n`
      : `execution_closure=${evaluation.decision}\n`
  );
  return evaluation.decision === 'pass' ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainExecutionClosureGate(process.argv.slice(2));
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
