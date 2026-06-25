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

function strings(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function objects(value) {
  return Array.isArray(value)
    ? value.filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
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

function traceMap(confirmation) {
  return new Map(objects(confirmation.traceRows).map((traceRow) => [text(traceRow.id), traceRow]));
}

function compactOutput(value, maxLength = 5000) {
  const normalized = value
    .replace(/\r\n/gu, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .join(' | ');
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)} ...<truncated>` : normalized;
}

function runCommand(commandId, command, outputFile, runId, closeoutAttemptId) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const completedAt = new Date().toISOString();
  const exitCode = typeof result.status === 'number' ? result.status : result.error ? 2 : 0;
  const output = [
    `COMMAND_ID: ${commandId}`,
    `COMMAND: ${command}`,
    `RUN_ID: ${runId}`,
    `CLOSEOUT_ATTEMPT_ID: ${closeoutAttemptId}`,
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
  writeText(outputFile, output);
  return {
    commandId,
    command,
    runId,
    closeoutAttemptId,
    exitCode,
    startedAt,
    completedAt,
    outputPath: normalizePath(outputFile),
    outputSummary: compactOutput(output),
  };
}

function artifactRef(input) {
  return {
    artifactType: input.artifactType,
    sourceOfTruthRole: 'evidence',
    path: normalizePath(input.file),
    hash: sha256File(input.file),
    producer: 'run-confirmed-trace-slice',
    purpose: input.purpose,
    relatedRequirementIds: input.relatedRequirementIds,
    status: 'active',
    inputVersion: `source=${input.sourceDocumentHash};implementation=${input.implementationConfirmationHash}`,
    outputVersion: input.outputVersion,
  };
}

function commandType(commandId) {
  return commandId.startsWith('CMD-CONTRACT') ? 'contract' : 'delivery_evidence';
}

function buildPacket(input) {
  const coveredIds = [
    input.traceId,
    ...strings(input.traceRow.covers),
    ...strings(input.traceRow.evidenceRefs),
  ];
  const taskRefs = strings(input.traceRow.taskRefs);
  const evidenceRefs = strings(input.traceRow.evidenceRefs);
  const completionPacketPath = path.join(input.evidenceDir, `${input.traceId.toLowerCase()}-completion-evidence-packet.json`);
  const receiptPath = path.join(input.evidenceDir, `${input.traceId.toLowerCase()}-command-receipt.json`);
  const diffSummaryPath = path.join(input.evidenceDir, `${input.traceId.toLowerCase()}-diff-summary.md`);
  const commandReceipt = {
    schemaVersion: 'confirmed-trace-command-receipt/v1',
    recordId: input.record.recordId,
    requirementSetId: input.record.requirementSetId || input.record.recordId,
    traceId: input.traceId,
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    commandRuns: input.commandRuns,
  };
  writeJson(receiptPath, commandReceipt);
  writeText(
    diffSummaryPath,
    [
      `# ${input.traceId} Runtime Closure Evidence`,
      '',
      `- Closed IDs: ${coveredIds.join(', ')}`,
      `- Commands: ${input.commandRuns.map((run) => run.commandId).join(', ')}`,
      '- Source traceRows remain unchanged; runtime status is recorded through requirement record/control-store evidence.',
      '',
    ].join('\n')
  );
  const commandArtifacts = input.commandRuns.map((run) =>
    artifactRef({
      file: run.outputPath,
      artifactType: 'command_run_output',
      purpose: `fresh current-attempt output for ${run.commandId} covering ${input.traceId}`,
      relatedRequirementIds: [run.commandId, ...coveredIds],
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      outputVersion: `${run.commandId.toLowerCase()}-${input.traceId.toLowerCase()}-current-attempt-output-v1`,
    })
  );
  const receiptArtifact = artifactRef({
    file: receiptPath,
    artifactType: 'command_run_receipt',
    purpose: `current-attempt command receipt bundle for ${input.traceId}`,
    relatedRequirementIds: coveredIds,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    outputVersion: `${input.traceId.toLowerCase()}-command-receipt-v1`,
  });
  const completionPacket = {
    packetType: 'completion_evidence_packet',
    schemaVersion: 'completion-evidence-packet/v1',
    recordId: input.record.recordId,
    requirementSetId: input.record.requirementSetId || input.record.recordId,
    generatedAt: new Date().toISOString(),
    traceId: input.traceId,
    closedIds: coveredIds,
    openIds: [],
    commandResults: input.commandRuns.map((run) => ({
      commandId: run.commandId,
      command: run.command,
      exitCode: run.exitCode,
      outputPath: run.outputPath,
      outputSummary: run.outputSummary,
    })),
    e2eEvidence: commandArtifacts,
    auditEvidence: input.commandRuns.filter((run) => run.commandId.startsWith('CMD-CONTRACT')).map((run) => run.commandId),
    residualRisks: [],
    scopeChanges: [],
  };
  writeJson(completionPacketPath, completionPacket);
  const completionArtifact = artifactRef({
    file: completionPacketPath,
    artifactType: 'completion_evidence_packet',
    purpose: `current-attempt completion evidence packet for ${input.traceId}`,
    relatedRequirementIds: coveredIds,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    outputVersion: `${input.traceId.toLowerCase()}-completion-evidence-packet-v1`,
  });
  const diffArtifact = artifactRef({
    file: diffSummaryPath,
    artifactType: 'diff_summary',
    purpose: `runtime closure diff summary for ${input.traceId}`,
    relatedRequirementIds: coveredIds,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    outputVersion: `${input.traceId.toLowerCase()}-diff-summary-v1`,
  });
  const allArtifactRefs = [...commandArtifacts, receiptArtifact, completionArtifact, diffArtifact];
  return {
    eventType: 'execution_iteration_recorded',
    recordId: input.record.recordId,
    requirementSetId: input.record.requirementSetId || input.record.recordId,
    executionIterationId: `execution-${input.traceId}-${input.runId}`,
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    status: 'done',
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    traceRows: [input.traceId],
    taskRefs,
    evidenceRefs,
    filesChanged: ['scripts/run-confirmed-trace-slice.js'],
    implementationDelta: {
      filesChanged: ['scripts/run-confirmed-trace-slice.js'],
      diffSummaryRef: normalizePath(diffSummaryPath),
      behaviorAffecting: true,
      negativeAssertionArtifactRefs: allArtifactRefs,
    },
    diffSummary: `Recorded current-attempt runtime closure evidence for ${input.traceId} from confirmed implementationConfirmation IDs.`,
    commandRuns: input.commandRuns,
    artifactRefs: allArtifactRefs,
    contractChecks: input.commandRuns
      .filter((run) => run.commandId.startsWith('CMD-CONTRACT'))
      .map((run) => ({
        contract: run.commandId,
        decision: 'pass',
        checkId: `${input.traceId}:${run.commandId}:${input.runId}`,
      })),
    gateChecks: input.commandRuns
      .filter((run) => !run.commandId.startsWith('CMD-CONTRACT'))
      .map((run) => ({
        gate: run.commandId,
        decision: 'pass',
        checkId: `${input.traceId}:${run.commandId}:${input.runId}`,
      })),
    deliveryEvidence: {
      requiredCommands: input.commandRuns.map((run) => ({
        commandId: run.commandId,
        command: run.command,
        commandType: commandType(run.commandId),
        blockingIfMissing: true,
        negativeOrRegression: !run.commandId.startsWith('CMD-CONTRACT'),
        closeoutAttemptId: input.closeoutAttemptId,
        lastRunRef: {
          commandId: run.commandId,
          runId: input.runId,
          closeoutAttemptId: input.closeoutAttemptId,
        },
        traceRows: [input.traceId],
        evidenceRefs,
        artifactRefs: allArtifactRefs.filter((artifact) => strings(artifact.relatedRequirementIds).includes(run.commandId)),
      })),
      historicalRunRefs: input.commandRuns.map((run) => ({
        commandId: run.commandId,
        runId: input.runId,
        closeoutAttemptId: input.closeoutAttemptId,
      })),
    },
    requirementClosures: coveredIds.map((requirementId) => ({
      requirementId,
      status: 'pass',
      closureSource: 'confirmed_trace_runtime_current_attempt',
    })),
  };
}

function runIngest(packetPath, recordPath, recordedBy) {
  const command = [
    'npx',
    'ts-node',
    '--project',
    'tsconfig.node.json',
    '--transpile-only',
    'scripts/ingest-implementation-evidence.ts',
    '--evidence',
    packetPath,
    '--requirement-record',
    recordPath,
    '--recorded-by',
    recordedBy,
    '--json',
  ].join(' ');
  const result = spawnSync(command, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    command,
    exitCode: typeof result.status === 'number' ? result.status : result.error ? 2 : 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : undefined,
  };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: node scripts/run-confirmed-trace-slice.js --trace TRACE-001 [--record <json>] [--source <md>] [--json]');
    return 0;
  }
  const traceId = text(args.trace);
  if (!/^TRACE-\d{3}$/u.test(traceId)) throw new Error('--trace TRACE-### is required');
  const sourcePath = path.resolve(args.source || DEFAULT_SOURCE);
  const recordPath = path.resolve(args.record || DEFAULT_RECORD);
  const record = readJson(recordPath);
  const confirmation = extractImplementationConfirmation(fs.readFileSync(sourcePath, 'utf8'));
  if (text(confirmation.status) !== 'user_confirmed') {
    throw new Error(`implementationConfirmation not user_confirmed: ${text(confirmation.status)}`);
  }
  const sourceDocumentHash = text(confirmation.sourceDocumentHash);
  const implementationConfirmationHash = text(confirmation.implementationConfirmationHash);
  if (sourceDocumentHash !== text(record.sourceDocumentHash)) throw new Error('sourceDocumentHash mismatch');
  if (implementationConfirmationHash !== text(record.implementationConfirmationHash)) {
    throw new Error('implementationConfirmationHash mismatch');
  }
  const traceRow = traceMap(confirmation).get(traceId);
  if (!traceRow) throw new Error(`missing trace row: ${traceId}`);
  const commands = commandMap(confirmation);
  const commandIds = [
    ...strings(traceRow.contractValidationCommandRefs),
    ...strings(traceRow.deliveryEvidenceCommandRefs),
  ];
  if (commandIds.length === 0) throw new Error(`trace has no required commands: ${traceId}`);
  const timestamp = new Date().toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z');
  const runId = args.runId || `run-${traceId}-${timestamp}`;
  const closeoutAttemptId = args.attemptId || `attempt-${traceId}-${timestamp}`;
  const evidenceDir = normalizePath(
    args.evidenceDir ||
      path.join(
        '_bmad-output',
        'runtime',
        'requirement-records',
        text(record.recordId),
        'evidence',
        traceId,
        runId
      )
  );
  fs.mkdirSync(evidenceDir, { recursive: true });
  const commandRuns = [];
  for (const commandId of commandIds) {
    const command = commands.get(commandId);
    if (!command) throw new Error(`missing required command declaration: ${commandId}`);
    const commandText = text(command.command);
    if (!commandText) throw new Error(`missing command text: ${commandId}`);
    const run = runCommand(commandId, commandText, path.join(evidenceDir, `${commandId}.output.txt`), runId, closeoutAttemptId);
    commandRuns.push(run);
    if (run.exitCode !== 0) {
      const failure = {
        ok: false,
        traceId,
        failedCommand: commandId,
        outputPath: run.outputPath,
        exitCode: run.exitCode,
      };
      process.stdout.write(args.json ? `${JSON.stringify(failure, null, 2)}\n` : `${traceId} failed at ${commandId}\n`);
      return run.exitCode || 1;
    }
  }
  const packet = buildPacket({
    record,
    traceId,
    traceRow,
    runId,
    closeoutAttemptId,
    evidenceDir,
    sourceDocumentHash,
    implementationConfirmationHash,
    commandRuns,
  });
  const packetPath = path.join(evidenceDir, `${traceId.toLowerCase()}-implementation-evidence-packet.json`);
  writeJson(packetPath, packet);
  const ingest = runIngest(packetPath, recordPath, args.recordedBy || 'codex');
  const ingestReceiptPath = path.join(evidenceDir, `${traceId.toLowerCase()}-ingest-receipt.json`);
  writeJson(ingestReceiptPath, ingest);
  const output = {
    ok: ingest.exitCode === 0,
    traceId,
    runId,
    closeoutAttemptId,
    evidenceDir,
    packetPath: normalizePath(packetPath),
    ingestReceiptPath: normalizePath(ingestReceiptPath),
    ingestExitCode: ingest.exitCode,
    ingestStdout: compactOutput(ingest.stdout),
    ingestStderr: compactOutput(ingest.stderr),
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `${traceId} ${output.ok ? 'closed' : 'ingest_failed'}\n`);
  return ingest.exitCode;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 2;
}
