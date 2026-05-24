/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  template?: string;
  requirementRecord?: string;
  runDir?: string;
  attemptId?: string;
  out?: string;
  json?: boolean;
  help?: boolean;
}

const RELATED_REQUIREMENT_IDS = [
  'TRACE-040',
  'MUST-053',
  'MUST-054',
  'MUST-055',
  'MUST-056',
  'NEG-041',
  'NEG-042',
  'NEG-043',
  'EVD-052',
  'EVD-053',
  'EVD-054',
];

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

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`JSON object expected: ${file}`);
  return parsed as JsonObject;
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function timestampToken(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/u);
  if (!match) return new Date().toISOString().replace(/[-:]/gu, '').replace(/\.\d+Z$/u, 'Z');
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}${match[6]}Z`;
}

function extractLine(content: string, label: string): string {
  return content.match(new RegExp(`^${label}: (.+)$`, 'mu'))?.[1]?.trim() ?? '';
}

function deepReplace(value: unknown, replacements: Array<[string, string]>): unknown {
  if (typeof value === 'string') {
    return replacements.reduce((current, [from, to]) => current.split(from).join(to), value);
  }
  if (Array.isArray(value)) return value.map((item) => deepReplace(item, replacements));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as JsonObject).map(([key, item]) => [key, deepReplace(item, replacements)])
  );
}

function updateArtifact(ref: JsonObject, input: { reportPath: string; outputPath: string; inputVersion: string }): void {
  const artifactType = String(ref.artifactType ?? '');
  if (artifactType === 'strict_closeout_proof_report') {
    ref.path = normalizePath(input.reportPath);
    ref.hash = sha256File(input.reportPath);
  }
  if (artifactType === 'command_output') {
    ref.path = normalizePath(input.outputPath);
    ref.hash = sha256File(input.outputPath);
  }
  ref.relatedRequirementIds = RELATED_REQUIREMENT_IDS;
  ref.inputVersion = input.inputVersion;
  ref.traceRows = ['TRACE-040'];
  ref.evidenceRefs = ['EVD-052', 'EVD-053', 'EVD-054'];
}

function objectArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object') : [];
}

function updateAllArtifacts(packet: JsonObject, input: { reportPath: string; outputPath: string; inputVersion: string }): void {
  objectArray(packet.artifactRefs).forEach((ref) => updateArtifact(ref, input));
  objectArray((packet.implementationDelta as JsonObject | undefined)?.negativeAssertionArtifactRefs).forEach((ref) =>
    updateArtifact(ref, input)
  );
  for (const run of objectArray(packet.commandRuns)) objectArray(run.artifactRefs).forEach((ref) => updateArtifact(ref, input));
  for (const command of objectArray((packet.deliveryEvidence as JsonObject | undefined)?.requiredCommands)) {
    objectArray(command.artifactRefs).forEach((ref) => updateArtifact(ref, input));
  }
}

function updatePacket(args: ParsedArgs): JsonObject {
  const templateInput = normalizePath(args.template!);
  const templatePath = path.resolve(args.template!);
  const runDir = normalizePath(args.runDir!);
  const oldRunDir = normalizePath(path.dirname(templateInput));
  const reportPath = normalizePath(path.join(runDir, 'strict-closeout-proof-report.json'));
  const outputPath = normalizePath(path.join(runDir, 'CMD-STRICT-CLOSEOUT-PROOF-GATE.output.txt'));
  const output = fs.readFileSync(outputPath, 'utf8');
  const startedAt = extractLine(output, 'STARTED_AT');
  const completedAt = extractLine(output, 'COMPLETED_AT');
  const exitCode = Number(extractLine(output, 'EXIT_CODE'));
  if (exitCode !== 0) throw new Error(`strict closeout proof command did not pass: ${exitCode}`);
  const command = extractLine(output, 'COMMAND');
  const record = readJson(path.resolve(args.requirementRecord!));
  const architectureHash = String((record.architectureConfirmationState as JsonObject).currentArchitectureConfirmationHash);
  const token = timestampToken(startedAt);
  const runId = `run-TRACE-040-CLOSEOUT-PROOF-${token}`;
  const oldPacket = readJson(templatePath);
  const packet = deepReplace(oldPacket, [
    [oldRunDir, runDir],
    [oldRunDir.replace(/\//gu, '\\'), runDir.replace(/\//gu, '\\')],
    ['closeout-attempt-REQ-CLOSED-LOOP-DESIGN-final-20260521T050436Z', args.attemptId!],
    ['run-TRACE-040-CLOSEOUT-PROOF-20260521T050524Z', runId],
  ]) as JsonObject;
  const inputVersion = `source=${record.sourceDocumentHash};implementation=${record.implementationConfirmationHash};architecture=${architectureHash};attempt=${args.attemptId}`;
  packet.runId = runId;
  packet.closeoutAttemptId = args.attemptId;
  packet.executionIterationId = `execution-iteration-TRACE-040-strict-closeout-proof-current-${token}`;
  packet.filesChanged = [
    'scripts/strict-closeout-proof-gate.ts',
    'scripts/control-event-log-rebaseline.ts',
    'scripts/main-agent-delivery-closeout-gate.ts',
    'scripts/final-closeout-evidence-runner.ts',
    'scripts/controlled-ingest-atomic-committer.ts',
    'scripts/requirement-record-event-reducer.ts',
    'scripts/requirement-record-schema-evolution.ts',
    'tests/acceptance/strict-closeout-proof-gate.test.ts',
  ];
  packet.diffSummary =
    'TRACE-040 strict closeout proof gate implementation, controlled rebaseline proof, and current-attempt proof evidence.';
  packet.architectureConfirmationHash = architectureHash;
  const delta = packet.implementationDelta as JsonObject;
  delta.filesChanged = packet.filesChanged;
  delta.diffSummaryRef = normalizePath(path.join(runDir, 'trace-040-diff-summary.md'));
  const run = objectArray(packet.commandRuns)[0];
  run.command = command;
  run.runId = runId;
  run.closeoutAttemptId = args.attemptId;
  run.exitCode = exitCode;
  run.startedAt = startedAt;
  run.completedAt = completedAt;
  run.outputSummary = output.trim().split(/\r?\n/u).join(' | ');
  for (const commandRef of objectArray((packet.deliveryEvidence as JsonObject).requiredCommands)) {
    commandRef.command = command;
    commandRef.closeoutAttemptId = args.attemptId;
    commandRef.lastRunRef = { commandId: 'CMD-STRICT-CLOSEOUT-PROOF-GATE', runId, closeoutAttemptId: args.attemptId, exitCode, startedAt, completedAt };
  }
  updateAllArtifacts(packet, { reportPath, outputPath, inputVersion });
  return packet;
}

export function mainTrace040EvidencePacketGenerator(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: trace-040-evidence-packet-generator --template <json> --requirement-record <json> --run-dir <dir> --attempt-id <id> --out <json> [--json]');
    return 0;
  }
  for (const key of ['template', 'requirementRecord', 'runDir', 'attemptId', 'out'] as const) {
    if (!args[key]) throw new Error(`missing required arg: ${key}`);
  }
  const packet = updatePacket(args);
  const outPath = path.resolve(args.out!);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(String((packet.implementationDelta as JsonObject).diffSummaryRef), `${packet.diffSummary}\n`, 'utf8');
  fs.writeFileSync(outPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  process.stdout.write(
    JSON.stringify({ ok: true, out: normalizePath(outPath), runId: packet.runId, attemptId: packet.closeoutAttemptId }, null, 2)
  );
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = mainTrace040EvidencePacketGenerator(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
