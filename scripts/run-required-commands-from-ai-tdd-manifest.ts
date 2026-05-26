/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { evaluateAiTddContractGate } from './ai-tdd-contract-gate';
import { mainIngestImplementationEvidence } from './ingest-implementation-evidence';

type JsonObject = Record<string, unknown>;
type Decision = 'pass' | 'blocked';

interface ParsedArgs {
  source?: string;
  requirementRecord?: string;
  mode?: string;
  attemptId?: string;
  runId?: string;
  evidenceDir?: string;
  json?: boolean;
  help?: boolean;
}

interface CommandRun {
  commandId: string;
  command: string;
  runId: string;
  closeoutAttemptId: string;
  startedAt: string;
  completedAt: string;
  exitCode: number | null;
  stdoutPath: string;
  stderrPath: string;
  outputPath: string;
  outputHash: string;
  artifactRefs: JsonObject[];
}

const REQUIRED_PRE_RUN_SECTIONS = [
  'commandTargetCollection',
  'traceClosureAssertions',
  'currentTargetMap',
  'targetModificationPathCoverage',
  'canonicalSurfaceReconciliation',
  'legacyDenial',
  'closeoutProof',
  'evidenceTrustStates',
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

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256Bytes(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function sha256File(file: string): string {
  return sha256Bytes(fs.readFileSync(file));
}

function commandId(row: JsonObject): string {
  return text(row.id) || text(row.commandId);
}

function checkPreRunSections(manifest: JsonObject): string[] {
  return REQUIRED_PRE_RUN_SECTIONS.flatMap((sectionName) => {
    const section = nested(manifest[sectionName]);
    if (section.ready === true) return [];
    const reasons = strings(section.blockingReasons);
    return [
      `${sectionName}_not_ready`,
      ...reasons.map((reason) => `${sectionName}:${reason}`),
    ];
  });
}

function checkRequiredCommandDefinitions(manifest: JsonObject): string[] {
  const ids = strings(nested(manifest.closeoutProof).requiredCommands);
  const commands = objects(manifest.requiredCommands);
  const byId = new Map<string, JsonObject[]>();
  for (const command of commands) {
    const id = commandId(command);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push(command);
  }
  const failures: string[] = [];
  if (ids.length === 0) failures.push('closeoutProof.requiredCommands_missing');
  for (const [id, rows] of byId) {
    if (id && rows.length > 1) failures.push(`manifest.requiredCommands_duplicate:${id}`);
  }
  for (const id of ids) {
    const matches = byId.get(id) ?? [];
    if (matches.length === 0) {
      failures.push(`closeoutProof.requiredCommand_undefined:${id}`);
      continue;
    }
    if (matches.length > 1) continue;
    const command = matches[0];
    if (!text(command.command)) failures.push(`manifest.requiredCommand.command_missing:${id}`);
    if (strings(command.files).length === 0) failures.push(`manifest.requiredCommand.files_missing:${id}`);
    if (strings(command.traceRefs).length === 0) failures.push(`manifest.requiredCommand.traceRefs_missing:${id}`);
    if (strings(command.evidenceRefs).length === 0) failures.push(`manifest.requiredCommand.evidenceRefs_missing:${id}`);
    for (const file of strings(command.files)) {
      const absolute = path.isAbsolute(file) ? file : path.resolve(file);
      if (!fs.existsSync(absolute)) failures.push(`manifest.requiredCommand.file_missing:${id}:${normalizePath(file)}`);
    }
  }
  return failures;
}

function commandDefinitions(manifest: JsonObject): JsonObject[] {
  const ids = strings(nested(manifest.closeoutProof).requiredCommands);
  const commands = objects(manifest.requiredCommands);
  return ids.map((id) => commands.find((command) => commandId(command) === id)).filter(Boolean) as JsonObject[];
}

function artifactRefForOutput(input: {
  commandId: string;
  outputPath: string;
  traceRefs: string[];
  evidenceRefs: string[];
  closeoutAttemptId: string;
}): JsonObject {
  return {
    artifactType: 'command_output',
    path: normalizePath(input.outputPath),
    hash: sha256File(input.outputPath),
    contentHash: sha256File(input.outputPath),
    producer: 'scripts/run-required-commands-from-ai-tdd-manifest.ts',
    purpose: `required command output for ${input.commandId}`,
    relatedRequirementIds: unique([...input.traceRefs, ...input.evidenceRefs]),
    closeoutAttemptId: input.closeoutAttemptId,
    status: 'active',
    inputVersion: input.commandId,
    outputVersion: input.closeoutAttemptId,
    sourceOfTruthRole: 'evidence',
    traceRows: input.traceRefs,
    evidenceRefs: input.evidenceRefs,
  };
}

function runCommand(input: {
  command: JsonObject;
  runId: string;
  closeoutAttemptId: string;
  evidenceDir: string;
}): CommandRun {
  const commandIdValue = commandId(input.command);
  const commandText = text(input.command.command);
  const startedAt = new Date().toISOString();
  const result = spawnSync(commandText, {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
    windowsHide: true,
  });
  const completedAt = new Date().toISOString();
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const safeId = commandIdValue.replace(/[^A-Za-z0-9_.-]/gu, '_');
  const commandDir = path.join(input.evidenceDir, 'command-outputs');
  fs.mkdirSync(commandDir, { recursive: true });
  const stdoutPath = path.join(commandDir, `${safeId}.stdout.txt`);
  const stderrPath = path.join(commandDir, `${safeId}.stderr.txt`);
  const outputPath = path.join(commandDir, `${safeId}.combined.txt`);
  fs.writeFileSync(stdoutPath, stdout, 'utf8');
  fs.writeFileSync(stderrPath, stderr, 'utf8');
  fs.writeFileSync(outputPath, `${stdout}\n${stderr}`, 'utf8');
  const artifactRefs =
    result.status === 0
      ? [
          artifactRefForOutput({
            commandId: commandIdValue,
            outputPath,
            traceRefs: strings(input.command.traceRefs),
            evidenceRefs: strings(input.command.evidenceRefs),
            closeoutAttemptId: input.closeoutAttemptId,
          }),
        ]
      : [];
  return {
    commandId: commandIdValue,
    command: commandText,
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    startedAt,
    completedAt,
    exitCode: result.status,
    stdoutPath: normalizePath(stdoutPath),
    stderrPath: normalizePath(stderrPath),
    outputPath: normalizePath(outputPath),
    outputHash: sha256File(outputPath),
    artifactRefs,
  };
}

function manifestRefs(manifest: JsonObject): { traceRows: string[]; evidenceRefs: string[] } {
  const commands = commandDefinitions(manifest);
  return {
    traceRows: unique(commands.flatMap((command) => strings(command.traceRefs))),
    evidenceRefs: unique(commands.flatMap((command) => strings(command.evidenceRefs))),
  };
}

function buildImplementationEvidencePacket(input: {
  record: JsonObject;
  sourcePath: string;
  recordPath: string;
  manifest: JsonObject;
  runId: string;
  closeoutAttemptId: string;
  commandRuns: CommandRun[];
  status: string;
}): JsonObject {
  const refs = manifestRefs(input.manifest);
  const artifactRefs = input.commandRuns.flatMap((run) => run.artifactRefs);
  return {
    eventType: 'execution_iteration_recorded',
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId) || text(input.record.recordId),
    executionIterationId: `${input.runId}:${input.closeoutAttemptId}`,
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    status: input.status,
    sourceDocumentHash: text(input.record.sourceDocumentHash) || sha256File(input.sourcePath),
    implementationConfirmationHash: text(input.record.implementationConfirmationHash),
    architectureConfirmationHash:
      text(input.record.architectureConfirmationHash) ||
      text(nested(input.record.architectureConfirmationState).currentArchitectureConfirmationHash) ||
      text(input.record.implementationConfirmationHash),
    traceRows: refs.traceRows,
    evidenceRefs: refs.evidenceRefs,
    taskRefs: [],
    filesChanged: strings(input.manifest.targetModificationPaths).filter(Boolean),
    diffSummary: 'AI TDD manifest required commands executed by dynamic runner.',
    implementationDelta: {
      filesChanged: objects(input.manifest.targetModificationPaths).map((row) => text(row.path)).filter(Boolean),
      diffSummaryRef: 'command-evidence-bundle.json',
      negativeAssertionArtifactRefs: artifactRefs,
      behaviorAffecting: true,
    },
    commandRuns: input.commandRuns,
    artifactRefs,
    gateChecks: [
      {
        gate: 'AI TDD Manifest Required Command Runner',
        decision: input.status === 'done' ? 'pass' : ('blocked' as Decision),
      },
    ],
    contractChecks: [
      {
        contract: 'ai_tdd_contract_gate_pre_rerun_manifest',
        decision: 'pass',
      },
    ],
    deliveryEvidence: {
      requiredCommands: input.commandRuns.map((run) => {
        const command = objects(input.manifest.requiredCommands).find((row) => commandId(row) === run.commandId) ?? {};
        return {
          commandId: run.commandId,
          command: run.command,
          blockingIfMissing: true,
          negativeOrRegression: true,
          traceRows: strings(command.traceRefs),
          evidenceRefs: strings(command.evidenceRefs),
          closeoutAttemptId: input.closeoutAttemptId,
          lastRunRef: {
            commandId: run.commandId,
            runId: input.runId,
            closeoutAttemptId: input.closeoutAttemptId,
          },
          artifactRefs: run.artifactRefs,
        };
      }),
    },
  };
}

function failedEvidencePacket(input: {
  record: JsonObject;
  runId: string;
  closeoutAttemptId: string;
  status: string;
  blockingReasons: string[];
  commandRuns?: CommandRun[];
}): JsonObject {
  return {
    eventType: 'required_command_execution_failed',
    not_allowed_through_implementation_evidence_ingested: true,
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId) || text(input.record.recordId),
    executionIterationId: `${input.runId}:${input.closeoutAttemptId}:failed`,
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    status: input.status,
    blockingReasons: unique(input.blockingReasons),
    commandRuns: input.commandRuns ?? [],
    deliveryEvidence: {
      requiredCommands: [],
    },
    message: 'failed evidence packet; not success implementation evidence ingest path',
  };
}

function writeFailureAndReturn(input: {
  args: ParsedArgs;
  record: JsonObject;
  evidenceDir: string;
  runId: string;
  closeoutAttemptId: string;
  blockingReasons: string[];
  commandRuns?: CommandRun[];
}): number {
  const failedPath = path.join(input.evidenceDir, 'implementation-evidence-packet.failed.json');
  writeJson(
    failedPath,
    failedEvidencePacket({
      record: input.record,
      runId: input.runId,
      closeoutAttemptId: input.closeoutAttemptId,
      status: 'failed',
      blockingReasons: input.blockingReasons,
      commandRuns: input.commandRuns,
    })
  );
  const output = {
    ok: false,
    failedEvidencePath: normalizePath(failedPath),
    blockingReasons: input.blockingReasons,
  };
  process.stdout.write(input.args.json ? `${JSON.stringify(output, null, 2)}\n` : `required_commands=blocked\n`);
  return 1;
}

export function mainRunRequiredCommandsFromAiTddManifest(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: run-required-commands-from-ai-tdd-manifest --source <source-document.md> --requirement-record <requirement-record.json> --mode closeout --attempt-id <closeoutAttemptId> --run-id <runId> --evidence-dir <dir> [--json]'
    );
    return 0;
  }
  if (!args.source || !args.requirementRecord || !args.mode || !args.attemptId || !args.runId || !args.evidenceDir) {
    throw new Error('missing required args: source, requirementRecord, mode, attemptId, runId, evidenceDir');
  }
  if (args.mode !== 'closeout') throw new Error('only --mode closeout is supported');

  const sourcePath = path.resolve(args.source);
  const recordPath = path.resolve(args.requirementRecord);
  const evidenceDir = path.resolve(args.evidenceDir);
  fs.mkdirSync(evidenceDir, { recursive: true });

  const record = readJson(recordPath);
  const preRunReport = evaluateAiTddContractGate({
    sourcePath,
    record,
    recordPath,
    mode: 'pre-rerun',
    attemptId: args.attemptId,
    evaluatedBy: 'scripts/run-required-commands-from-ai-tdd-manifest.ts',
  });
  const preRunReportPath = path.join(evidenceDir, 'ai-tdd-pre-run-report.json');
  writeJson(preRunReportPath, preRunReport);
  const manifest = nested(preRunReport.contractExecutionManifest);
  const preRunFailures = [
    ...checkPreRunSections(manifest),
    ...checkRequiredCommandDefinitions(manifest),
  ];
  if (preRunFailures.length > 0) {
    return writeFailureAndReturn({
      args,
      record,
      evidenceDir,
      runId: args.runId,
      closeoutAttemptId: args.attemptId,
      blockingReasons: unique(preRunFailures),
    });
  }

  const commandRuns: CommandRun[] = [];
  for (const command of commandDefinitions(manifest)) {
    const run = runCommand({
      command,
      runId: args.runId,
      closeoutAttemptId: args.attemptId,
      evidenceDir,
    });
    commandRuns.push(run);
    if (run.exitCode !== 0) {
      return writeFailureAndReturn({
        args,
        record,
        evidenceDir,
        runId: args.runId,
        closeoutAttemptId: args.attemptId,
        blockingReasons: [`required_command_failed:${run.commandId}`],
        commandRuns,
      });
    }
    if (run.artifactRefs.length === 0) {
      return writeFailureAndReturn({
        args,
        record,
        evidenceDir,
        runId: args.runId,
        closeoutAttemptId: args.attemptId,
        blockingReasons: [`required_command_artifactRefs_missing:${run.commandId}`],
        commandRuns,
      });
    }
  }

  const commandEvidenceBundlePath = path.join(evidenceDir, 'command-evidence-bundle.json');
  writeJson(commandEvidenceBundlePath, {
    runId: args.runId,
    closeoutAttemptId: args.attemptId,
    commandRuns,
  });
  const packet = buildImplementationEvidencePacket({
    record,
    sourcePath,
    recordPath,
    manifest,
    runId: args.runId,
    closeoutAttemptId: args.attemptId,
    commandRuns,
    status: 'done',
  });
  const packetPath = path.join(evidenceDir, 'implementation-evidence-packet.json');
  writeJson(packetPath, packet);
  const ingestCode = mainIngestImplementationEvidence([
    '--evidence',
    packetPath,
    '--requirement-record',
    recordPath,
    '--json',
  ]);
  if (ingestCode !== 0) {
    return writeFailureAndReturn({
      args,
      record,
      evidenceDir,
      runId: args.runId,
      closeoutAttemptId: args.attemptId,
      blockingReasons: [`implementation_evidence_ingest_failed:${ingestCode}`],
      commandRuns,
    });
  }

  const updatedRecord = readJson(recordPath);
  const closeoutReport = evaluateAiTddContractGate({
    sourcePath,
    record: updatedRecord,
    recordPath,
    mode: 'closeout',
    attemptId: args.attemptId,
    evaluatedBy: 'scripts/run-required-commands-from-ai-tdd-manifest.ts',
  });
  const closeoutReportPath = path.join(evidenceDir, 'ai-tdd-closeout-report.json');
  writeJson(closeoutReportPath, closeoutReport);
  const closeoutReady = nested(closeoutReport.closeoutReadinessReport).ready === true;
  if (text(closeoutReport.decision) !== 'pass' || !closeoutReady) {
    return writeFailureAndReturn({
      args,
      record: updatedRecord,
      evidenceDir,
      runId: args.runId,
      closeoutAttemptId: args.attemptId,
      blockingReasons: unique([
        ...(text(closeoutReport.decision) === 'pass' ? [] : ['ai_tdd_contract_gate_not_passed']),
        ...(closeoutReady ? [] : ['ai_tdd_closeout_readiness_not_ready']),
        ...strings(closeoutReport.blockingReasons),
      ]),
      commandRuns,
    });
  }

  const output = {
    ok: true,
    commandEvidenceBundlePath: normalizePath(commandEvidenceBundlePath),
    implementationEvidencePacketPath: normalizePath(packetPath),
    preRunReportPath: normalizePath(preRunReportPath),
    closeoutReportPath: normalizePath(closeoutReportPath),
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `required_commands=pass\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = mainRunRequiredCommandsFromAiTddManifest(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
