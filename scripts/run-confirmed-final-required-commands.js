/* eslint-disable no-console */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const DEFAULT_SOURCE =
  'docs/requirements/2026-05-24-main-agent-six-mental-model-control-plane-completion.md';
const DEFAULT_RECORD =
  '_bmad-output/runtime/requirement-records/REQ-MAIN-AGENT-SIX-MENTAL-MODEL-CONTROL-PLANE/requirement-record.json';
const DEFAULT_COMMAND_ORDER = [
  'CMD-CONTRACT-001',
  ...Array.from({ length: 16 }, (_, index) => `CMD-DELIVERY-${String(index + 1).padStart(3, '0')}`),
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--')) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      args[arg.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return args;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function objects(value) {
  return Array.isArray(value)
    ? value.filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function strings(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function normalizePath(value) {
  return value.replace(/\\/gu, '/');
}

function readJson(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function extractImplementationConfirmation(sourceText) {
  const fence = sourceText.match(/```yaml\s*\n([\s\S]*?)\n```/u);
  if (!fence) throw new Error('missing yaml fenced implementationConfirmation block');
  const parsed = yaml.load(fence[1]);
  const confirmation = parsed && parsed.implementationConfirmation;
  if (!confirmation || typeof confirmation !== 'object' || Array.isArray(confirmation)) {
    throw new Error('implementationConfirmation block is not a YAML object');
  }
  return confirmation;
}

function commandMap(confirmation) {
  return new Map(objects(confirmation.requiredCommands).map((command) => [text(command.id || command.commandId), command]));
}

function compactOutput(value, maxLength = 8000) {
  const normalized = value
    .replace(/\r\n/gu, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .join(' | ');
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)} ...<truncated>` : normalized;
}

function runCommand(input) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(input.command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
    maxBuffer: 128 * 1024 * 1024,
  });
  const completedAt = new Date().toISOString();
  const exitCode = typeof result.status === 'number' ? result.status : result.error ? 2 : 0;
  const output = [
    `COMMAND_ID: ${input.commandId}`,
    `COMMAND: ${input.command}`,
    `RUN_ID: ${input.runId}`,
    `CLOSEOUT_ATTEMPT_ID: ${input.closeoutAttemptId}`,
    `STARTED_AT: ${startedAt}`,
    `COMPLETED_AT: ${completedAt}`,
    `EXIT_CODE: ${exitCode}`,
    'STDOUT:',
    result.stdout || '',
    'STDERR:',
    result.stderr || '',
    result.error ? `SPAWN_ERROR: ${result.error.message}` : '',
  ]
    .join('\n')
    .replace(/[ \t\r\n]+$/u, '\n');
  writeText(input.outputFile, output);
  return {
    commandId: input.commandId,
    command: input.command,
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    exitCode,
    startedAt,
    completedAt,
    outputPath: normalizePath(input.outputFile),
    outputHash: sha256File(input.outputFile),
    outputSummary: compactOutput(output),
  };
}

function traceRows(confirmation) {
  return objects(confirmation.traceRows).filter((traceRow) => /^TRACE-\d{3}$/u.test(text(traceRow.id)));
}

function allConfirmableIds(confirmation) {
  return [
    ...new Set(
      traceRows(confirmation).flatMap((traceRow) => [
        text(traceRow.id),
        ...strings(traceRow.covers),
        ...strings(traceRow.evidenceRefs),
      ])
    ),
  ].filter(Boolean).sort();
}

function latestClosureById(record) {
  const out = new Map();
  for (const closure of objects(record.requirementClosures)) {
    const id = text(closure.requirementId);
    if (id) out.set(id, closure);
  }
  return out;
}

function traceCommandCoverage(confirmation) {
  const coverage = {};
  for (const traceRow of traceRows(confirmation)) {
    const traceId = text(traceRow.id);
    for (const commandId of [
      ...strings(traceRow.contractValidationCommandRefs),
      ...strings(traceRow.deliveryEvidenceCommandRefs),
    ]) {
      if (!coverage[commandId]) coverage[commandId] = [];
      coverage[commandId].push(traceId);
    }
  }
  return coverage;
}

function extractReverseAuditWarnings(commandRun) {
  if (commandRun.commandId !== 'CMD-CONTRACT-001') return [];
  const content = fs.readFileSync(commandRun.outputPath, 'utf8');
  const jsonStart = content.indexOf('STDOUT:\n');
  if (jsonStart < 0) return [];
  const stdoutAndAfter = content.slice(jsonStart + 'STDOUT:\n'.length);
  const stdout = stdoutAndAfter.split(/\nSTDERR:\n/u)[0];
  try {
    const parsed = JSON.parse(stdout);
    return objects(parsed.findings)
      .filter((finding) => text(finding.severity) === 'warning')
      .map((finding) => ({
        code: text(finding.code),
        message: text(finding.message),
        refs: strings(finding.refs),
      }));
  } catch {
    return [];
  }
}

function buildPacket(input) {
  const closureMap = latestClosureById(input.record);
  const allIds = allConfirmableIds(input.confirmation);
  const closedIds = allIds.filter((id) => text(closureMap.get(id)?.status) === 'pass');
  const openIds = allIds.filter((id) => text(closureMap.get(id)?.status) !== 'pass');
  const coverage = traceCommandCoverage(input.confirmation);
  const residualRisks = input.commandRuns.flatMap(extractReverseAuditWarnings);
  const commandResults = input.commandRuns.map((run) => ({
    commandId: run.commandId,
    command: run.command,
    exitCode: run.exitCode,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    outputPath: run.outputPath,
    outputHash: run.outputHash,
    traceRows: coverage[run.commandId] || [],
    outputSummary: run.outputSummary,
  }));
  const packet = {
    packetType: 'completion_evidence_packet',
    schemaVersion: 'completion-evidence-packet/v1',
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId) || text(input.record.recordId),
    generatedAt: new Date().toISOString(),
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    eventCount: input.record.eventCount,
    eventChainHead: input.record.eventChainHead,
    closedIds,
    openIds,
    commandResults,
    e2eEvidence: commandResults.filter((run) => run.commandId.startsWith('CMD-DELIVERY')),
    auditEvidence: commandResults.filter((run) => run.commandId.startsWith('CMD-CONTRACT')),
    residualRisks,
    scopeChanges: [],
    allRequiredCommandsPassed: input.commandRuns.every((run) => run.exitCode === 0),
    allTraceRowsClosed: traceRows(input.confirmation).every((traceRow) => closedIds.includes(text(traceRow.id))),
  };
  writeJson(input.packetPath, packet);
  return packet;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: node scripts/run-confirmed-final-required-commands.js [--source <md>] [--record <json>] [--json]');
    return 0;
  }
  const sourcePath = path.resolve(args.source || DEFAULT_SOURCE);
  const recordPath = path.resolve(args.record || DEFAULT_RECORD);
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const confirmation = extractImplementationConfirmation(sourceText);
  const record = readJson(recordPath);
  const sourceDocumentHash = text(confirmation.sourceDocumentHash);
  const implementationConfirmationHash = text(confirmation.implementationConfirmationHash);
  if (sourceDocumentHash !== text(record.sourceDocumentHash)) throw new Error('sourceDocumentHash mismatch');
  if (implementationConfirmationHash !== text(record.implementationConfirmationHash)) {
    throw new Error('implementationConfirmationHash mismatch');
  }
  const commands = commandMap(confirmation);
  const missingCommands = DEFAULT_COMMAND_ORDER.filter((commandId) => !commands.has(commandId));
  if (missingCommands.length > 0) throw new Error(`missing required commands: ${missingCommands.join(', ')}`);
  const timestamp = new Date().toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z');
  const runId = args.runId || `run-FINAL-REQUIRED-COMMANDS-${timestamp}`;
  const closeoutAttemptId = args.attemptId || `attempt-FINAL-REQUIRED-COMMANDS-${timestamp}`;
  const evidenceDir = normalizePath(
    args.evidenceDir ||
      path.join(
        '_bmad-output',
        'runtime',
        'requirement-records',
        text(record.recordId),
        'evidence',
        'FINAL-REQUIRED-COMMANDS',
        runId
      )
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  const commandRuns = [];
  for (const commandId of DEFAULT_COMMAND_ORDER) {
    const commandText = text(commands.get(commandId).command);
    const run = runCommand({
      commandId,
      command: commandText,
      runId,
      closeoutAttemptId,
      outputFile: path.join(evidenceDir, `${commandId}.output.txt`),
    });
    commandRuns.push(run);
    if (run.exitCode !== 0) {
      const failurePacketPath = path.join(evidenceDir, 'completion-evidence-packet.failed.json');
      const packet = buildPacket({
        record,
        confirmation,
        commandRuns,
        runId,
        closeoutAttemptId,
        sourceDocumentHash,
        implementationConfirmationHash,
        packetPath: failurePacketPath,
      });
      const failure = {
        ok: false,
        failedCommand: commandId,
        outputPath: run.outputPath,
        packetPath: normalizePath(failurePacketPath),
        packetHash: sha256File(failurePacketPath),
        openIds: packet.openIds,
      };
      process.stdout.write(args.json ? `${JSON.stringify(failure, null, 2)}\n` : `final_required_commands_failed=${commandId}\n`);
      return run.exitCode || 1;
    }
  }
  const packetPath = path.join(evidenceDir, 'completion-evidence-packet.json');
  const packet = buildPacket({
    record,
    confirmation,
    commandRuns,
    runId,
    closeoutAttemptId,
    sourceDocumentHash,
    implementationConfirmationHash,
    packetPath,
  });
  const output = {
    ok: packet.allRequiredCommandsPassed && packet.allTraceRowsClosed && packet.openIds.length === 0,
    runId,
    closeoutAttemptId,
    evidenceDir,
    packetPath: normalizePath(packetPath),
    packetHash: sha256File(packetPath),
    closedIdCount: packet.closedIds.length,
    openIds: packet.openIds,
    commandCount: commandRuns.length,
    residualRisks: packet.residualRisks,
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `final_required_commands=${output.ok ? 'pass' : 'incomplete'}\n`);
  return output.ok ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 2;
}
