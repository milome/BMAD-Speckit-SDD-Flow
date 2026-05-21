/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  requirementRecord?: string;
  out?: string;
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

function latestClosure(record: JsonObject, id: string): JsonObject | null {
  const matches = objects(record.requirementClosures).filter((closure) => text(closure.requirementId) === id);
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

function sourceRefsContain(sourceRefs: unknown, sourceType: string, id: string): boolean {
  return objects(sourceRefs).some((ref) => text(ref.sourceType) === sourceType && text(ref.id) === id);
}

function executionsFor(record: JsonObject, id: string): JsonObject[] {
  return objects(record.executionIterations).filter(
    (iteration) =>
      strings(iteration.traceRows).includes(id) ||
      strings(iteration.evidenceRefs).includes(id) ||
      sourceRefsContain(iteration.sourceRefs, 'trace_row', id) ||
      sourceRefsContain(iteration.sourceRefs, 'evidence', id)
  );
}

function requiredCommandsFor(record: JsonObject, id: string): JsonObject[] {
  const deliveryEvidence = record.deliveryEvidence as JsonObject | undefined;
  return objects(deliveryEvidence?.requiredCommands).filter(
    (command) => strings(command.traceRows).includes(id) || strings(command.evidenceRefs).includes(id)
  );
}

function matrixRow(record: JsonObject, id: string): JsonObject {
  const closure = latestClosure(record, id);
  const executions = executionsFor(record, id);
  const commands = requiredCommandsFor(record, id);
  const latestExecution = executions.length > 0 ? executions[executions.length - 1] : null;
  const supportingArtifacts = [
    ...objects(latestExecution?.evidenceArtifactRefs),
    ...commands.flatMap((command) => objects(command.artifactRefs)),
  ];
  const status = text(closure?.status) || 'open';
  return {
    id,
    status,
    closed: status === 'pass',
    latestClosureRecordedAt: text(closure?.recordedAt) || null,
    executionIterationIds: executions.map((iteration) => text(iteration.executionIterationId)).filter(Boolean),
    commandIds: commands.map((command) => text(command.commandId)).filter(Boolean),
    artifactRefs: supportingArtifacts.map((artifact) => ({
      artifactType: text(artifact.artifactType),
      sourceOfTruthRole: text(artifact.sourceOfTruthRole),
      path: normalizePathForRecord(text(artifact.path)),
      hash: text(artifact.hash ?? artifact.contentHash),
    })),
    blockingReason:
      status === 'pass'
        ? null
        : executions.length === 0
          ? 'missing_execution_iteration'
          : commands.length === 0
            ? 'missing_delivery_required_command'
            : 'latest_closure_not_pass',
  };
}

function referencedIds(record: JsonObject): string[] {
  const ids = new Set<string>();
  for (const closure of objects(record.requirementClosures)) {
    const id = text(closure.requirementId);
    if (id) ids.add(id);
  }
  for (const iteration of objects(record.executionIterations)) {
    for (const id of strings(iteration.traceRows)) ids.add(id);
    for (const id of strings(iteration.evidenceRefs)) ids.add(id);
  }
  return [...ids].sort();
}

export function buildTraceClosureMatrix(record: JsonObject): JsonObject {
  const rows = referencedIds(record).map((id) => matrixRow(record, id));
  return {
    reportType: 'trace_closure_matrix',
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId),
    generatedAt: new Date().toISOString(),
    sourceOfTruth: 'requirement-record.json',
    projectionClosurePolicy: {
      sourceDocumentTraceStatusRole: 'confirmed_contract_projection',
      runtimeClosureAuthority: 'requirement-record.requirementClosures',
      pendingSourceStatusMeaning:
        'PENDING in the confirmed source document preserves the user-confirmed implementationConfirmation projection and does not represent runtime delivery closure.',
      passCriteria:
        'Runtime PASS requires latest requirementClosures status=pass plus current deliveryEvidence.requiredCommands and supporting evidence artifacts.',
      semanticMutationPolicy:
        'Changing source traceRows status from PENDING to PASS would mutate the confirmed contract and requires reconfirmation; closeout records projection evidence instead.',
    },
    readModelBoundary:
      'TaskReport done, agent said done, smoke passed, quality gate passed, release gate passed, delivery truth passed, and tests passed are evidence inputs only; they cannot close a requirement without requirementClosures plus deliveryEvidence.requiredCommands.',
    counts: {
      rows: rows.length,
      closed: rows.filter((row) => row.closed === true).length,
      open: rows.filter((row) => row.closed !== true).length,
    },
    rows,
  };
}

export function mainTraceClosureMatrix(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: trace-closure-matrix --requirement-record <json> --out <json> [--json]');
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const matrix = buildTraceClosureMatrix(record);
  const outPath = path.resolve(args.out ?? path.join(path.dirname(recordPath), 'trace-closure-matrix.json'));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
  const output = { ok: true, outPath: normalizePathForRecord(outPath), counts: matrix.counts };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `trace_closure_matrix=${normalizePathForRecord(outPath)}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = mainTraceClosureMatrix(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
