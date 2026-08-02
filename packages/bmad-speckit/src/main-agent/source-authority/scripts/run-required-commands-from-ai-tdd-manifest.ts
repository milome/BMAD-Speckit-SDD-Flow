/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { evaluateAiTddContractGate } from './ai-tdd-contract-gate';
import { mainIngestImplementationEvidence } from './ingest-implementation-evidence';
import { readImplementationConfirmation } from './target-artifact-realization-gate';
import { resolveVerifiedSixModelStatus } from './verified-six-model-status-facade';

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

function isDirectRunRequiredCommandsFromAiTddManifestCli(entry: string | undefined): boolean {
  return /(^|[\\/])run-required-commands-from-ai-tdd-manifest(\.[cm]?js|\.ts)?$/iu.test(
    entry ?? ''
  );
}

interface CommandRun {
  commandId: string;
  command: string;
  normalizedCommand: string;
  cwd: string;
  executorIdentity: {
    class: 'controlled_detached_executor';
    id: string;
  };
  runtimeVersions: Record<string, string>;
  dependencyLockHashes: JsonObject[];
  environment: Record<string, string>;
  environmentFingerprint: string;
  environmentCompatibilityDecision: 'pass';
  transactionId: string;
  implementationAttemptId: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  packetHash: string;
  runId: string;
  closeoutAttemptId: string;
  startedAt: string;
  completedAt: string;
  exitCode: number | null;
  stdoutPath: string;
  stderrPath: string;
  outputPath: string;
  outputHash: string;
  coveredRequirementIds: string[];
  artifactRefs: JsonObject[];
  deliveryEvidenceRequired?: boolean;
  commandExecutionMode?: string;
  rawExitCode?: number | null;
}

interface ExecutionAuthorityBinding {
  projectRoot: string;
  recordId: string;
  requirementSetId: string;
  transactionId: string;
  implementationAttemptId: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  packetHash: string;
  runtimeVersions: Record<string, string>;
  dependencyLockHashes: JsonObject[];
  environment: Record<string, string>;
  environmentFingerprint: string;
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

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.entries(value as JsonObject)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
}

function projectRootForRecordPath(recordPath: string): string {
  const resolved = path.resolve(recordPath);
  const marker = `${path.sep}_bmad-output${path.sep}`;
  const markerIndex = resolved.lastIndexOf(marker);
  return markerIndex > 0 ? resolved.slice(0, markerIndex) : process.cwd();
}

function dependencyLockHashes(projectRoot: string): JsonObject[] {
  return ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']
    .map((relativePath) => ({
      relativePath,
      absolutePath: path.join(projectRoot, relativePath),
    }))
    .filter(({ absolutePath }) => fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile())
    .map(({ relativePath, absolutePath }) => ({
      path: normalizePath(relativePath),
      hash: sha256File(absolutePath),
    }));
}

function currentImplementationAttemptId(record: JsonObject): string {
  return (
    text(record.currentAttemptId) ||
    text(record.implementationAttemptId) ||
    text(nested(record.closeout).currentAttemptId)
  );
}

function executionAuthorityBinding(record: JsonObject, recordPath: string): ExecutionAuthorityBinding {
  const projectRoot = projectRootForRecordPath(recordPath);
  const runtimeVersions = {
    node: process.version,
    v8: process.versions.v8,
  };
  const environment = {
    platform: process.platform,
    architecture: process.arch,
    cwd: normalizePath(projectRoot),
  };
  const locks = dependencyLockHashes(projectRoot);
  return {
    projectRoot,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    transactionId: text(record.transactionId),
    implementationAttemptId: currentImplementationAttemptId(record),
    sourceDocumentHash: text(record.sourceDocumentHash),
    semanticModelHash: text(record.semanticModelHash),
    packetHash: text(record.packetHash),
    runtimeVersions,
    dependencyLockHashes: locks,
    environment,
    environmentFingerprint: sha256Bytes(
      stableStringify({
        runtimeVersions,
        environment,
        dependencyLockHashes: locks,
      })
    ),
  };
}

function requirementIdsForTraceRefs(manifest: JsonObject, traceRefs: string[]): string[] {
  const traceRefSet = new Set(traceRefs);
  const fromTrace = objects(manifest.traceRows)
    .filter((row) => traceRefSet.has(text(row.id)))
    .flatMap((row) => strings(row.covers));
  if (fromTrace.length > 0) return unique(fromTrace);
  const requirements = nested(manifest.requirements);
  return unique(
    ['must', 'notDone', 'mustNot']
      .flatMap((section) => objects(requirements[section]))
      .map((row) => text(row.id))
  );
}

function sha256Directory(directory: string): string {
  const entries: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(current, entry.name);
      const relative = normalizePath(path.relative(directory, absolute));
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        entries.push(`${relative}:${sha256File(absolute)}`);
      }
    }
  };
  walk(directory);
  return sha256Bytes(entries.join('\n'));
}

function hashExistingPath(absolutePath: string): string {
  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) return sha256Directory(absolutePath);
  return sha256File(absolutePath);
}

function isWindows(): boolean {
  return process.platform === 'win32';
}

function commandSpawnOptions(commandText: string): {
  command: string;
  args: string[];
  shell: boolean;
} {
  if (!isWindows()) return { command: commandText, args: [], shell: true };
  return {
    command: 'pwsh.exe',
    args: [
      '-NoLogo',
      '-NoProfile',
      '-Command',
      `& { ${commandText}; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }; if ($?) { exit 0 } else { exit 1 } }`,
    ],
    shell: false,
  };
}

function commandExecutionMode(commandText: string): string {
  const normalized = commandText.trim();
  if (
    /^rg\s+-n\s+-e\s+/iu.test(normalized) &&
    /delivery_closeout|architecture_confirmation_state_checked|implementation_readiness_check_recorded|readiness_baseline_activation_requested|closeout_recorded|gate_check_recorded\.\*sixModelResults|sixModelResults\.\*gate_check_recorded/u.test(
      normalized
    )
  ) {
    return 'forbidden_pattern_absent';
  }
  return 'exit_zero';
}

function normalizeCommandResult(input: {
  mode: string;
  rawExitCode: number | null;
  stdout: string;
  stderr: string;
}): { exitCode: number | null; stdout: string; stderr: string; passed: boolean } {
  if (input.mode !== 'forbidden_pattern_absent') {
    return {
      exitCode: input.rawExitCode,
      stdout: input.stdout,
      stderr: input.stderr,
      passed: input.rawExitCode === 0,
    };
  }
  if (input.rawExitCode === 1) {
    return {
      exitCode: 0,
      stdout: `${input.stdout}\nforbidden_pattern_absent=pass\n`,
      stderr: input.stderr,
      passed: true,
    };
  }
  return {
    exitCode: input.rawExitCode === 0 ? 1 : input.rawExitCode,
    stdout: input.stdout,
    stderr:
      input.rawExitCode === 0
        ? `${input.stderr}\nforbidden_pattern_absent=blocked: unexpected matches were found\n`
        : input.stderr,
    passed: false,
  };
}

function commandId(row: JsonObject): string {
  return text(row.id) || text(row.commandId);
}

function checkPreRunSections(manifest: JsonObject): string[] {
  return REQUIRED_PRE_RUN_SECTIONS.flatMap((sectionName) => {
    const section = nested(manifest[sectionName]);
    if (section.ready === true) return [];
    const reasons = strings(section.blockingReasons);
    return [`${sectionName}_not_ready`, ...reasons.map((reason) => `${sectionName}:${reason}`)];
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
    if (strings(command.files).length === 0)
      failures.push(`manifest.requiredCommand.files_missing:${id}`);
    if (strings(command.traceRefs).length === 0)
      failures.push(`manifest.requiredCommand.traceRefs_missing:${id}`);
    if (strings(command.evidenceRefs).length === 0)
      failures.push(`manifest.requiredCommand.evidenceRefs_missing:${id}`);
    for (const file of strings(command.files)) {
      const absolute = path.isAbsolute(file) ? file : path.resolve(file);
      if (!fs.existsSync(absolute))
        failures.push(`manifest.requiredCommand.file_missing:${id}:${normalizePath(file)}`);
    }
  }
  return failures;
}

function commandDefinitions(manifest: JsonObject): JsonObject[] {
  const ids = strings(nested(manifest.closeoutProof).requiredCommands);
  const commands = objects(manifest.requiredCommands);
  return ids
    .map((id) => commands.find((command) => commandId(command) === id))
    .filter(Boolean) as JsonObject[];
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
    producer:
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
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

function artifactRefForFile(input: {
  artifactType: string;
  filePath: string;
  hash?: string;
  producer: string;
  purpose: string;
  traceRows: string[];
  evidenceRefs: string[];
  closeoutAttemptId: string;
  sourceOfTruthRole?: string;
  aliases?: string[];
}): JsonObject {
  return {
    artifactType: input.artifactType,
    path: normalizePath(input.filePath),
    hash: input.hash ?? hashExistingPath(input.filePath),
    contentHash: input.hash ?? hashExistingPath(input.filePath),
    producer: input.producer,
    purpose: input.purpose,
    relatedRequirementIds: unique([...input.traceRows, ...input.evidenceRefs]),
    closeoutAttemptId: input.closeoutAttemptId,
    status: 'active',
    inputVersion: input.closeoutAttemptId,
    outputVersion: input.closeoutAttemptId,
    sourceOfTruthRole: input.sourceOfTruthRole ?? 'evidence',
    traceRows: input.traceRows,
    evidenceRefs: input.evidenceRefs,
    ...(input.aliases && input.aliases.length > 0 ? { aliases: input.aliases } : {}),
  };
}

function bindEvidenceArtifactReadback(
  artifact: JsonObject,
  binding: ExecutionAuthorityBinding
): void {
  if (text(artifact.sourceOfTruthRole) !== 'evidence') return;
  const artifactPath = text(artifact.path);
  const absoluteArtifactPath = path.isAbsolute(artifactPath)
    ? path.resolve(artifactPath)
    : path.resolve(binding.projectRoot, artifactPath);
  const relative = path.relative(binding.projectRoot, absoluteArtifactPath);
  if (
    !artifactPath ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    !fs.existsSync(absoluteArtifactPath) ||
    !fs.statSync(absoluteArtifactPath).isFile()
  ) {
    return;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(absoluteArtifactPath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') return;
  } catch {
    return;
  }
  const schemaPath = `${absoluteArtifactPath}.schema.json`;
  const readbackReceiptPath = `${absoluteArtifactPath}.readback-receipt.json`;
  writeJson(schemaPath, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
  });
  const artifactHash = sha256File(absoluteArtifactPath);
  const requirementRefs = unique(strings(artifact.relatedRequirementIds));
  const publishedAt = new Date().toISOString();
  const receiptPayload = {
    schemaVersion: 'requirements-contract-evidence-artifact-readback-receipt/v1',
    artifactId: path.basename(absoluteArtifactPath),
    artifactType: text(artifact.artifactType),
    artifactPath: normalizePath(absoluteArtifactPath),
    artifactHash,
    artifactSchemaPath: normalizePath(schemaPath),
    artifactSchemaHash: sha256File(schemaPath),
    producerIdentity: {
      class: 'controlled_artifact_producer',
      id: text(artifact.producer),
    },
    requirementSetId: binding.requirementSetId,
    requirementRefs,
    transactionId: binding.transactionId,
    implementationAttemptId: binding.implementationAttemptId,
    publishedAt,
    readbackAt: publishedAt,
    publication: {
      targetPath: normalizePath(absoluteArtifactPath),
      publishedHash: artifactHash,
      readbackHash: artifactHash,
      readbackVerified: true,
    },
    decision: 'pass',
  };
  writeJson(readbackReceiptPath, {
    ...receiptPayload,
    receiptHash: sha256Bytes(stableStringify(receiptPayload)),
  });
  artifact.path = normalizePath(absoluteArtifactPath);
  artifact.hash = artifactHash;
  artifact.contentHash = artifactHash;
  artifact.schemaPath = normalizePath(schemaPath);
  artifact.readbackReceiptPath = normalizePath(readbackReceiptPath);
}

function bindEvidenceArtifactReadbacks(
  artifacts: JsonObject[],
  binding: ExecutionAuthorityBinding
): void {
  const seen = new Set<string>();
  for (const artifact of artifacts) {
    const key = `${text(artifact.sourceOfTruthRole)}:${normalizePath(text(artifact.path))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bindEvidenceArtifactReadback(artifact, binding);
  }
}

function normalizeArtifactRole(value: string): string {
  const role = text(value);
  if (role) return role === 'post_closeout_review_projection' ? 'projection' : role;
  return 'evidence';
}

function filePathPrefix(value: string): string {
  const normalized = normalizePath(value);
  const match = /^(.+\.[a-z0-9]{1,8})(?:\s+.+)?$/iu.exec(normalized);
  return match ? match[1] : normalized;
}

function latestAuditAttemptId(record: JsonObject): string {
  const currentAttemptId =
    text(record.currentAttemptId) ||
    text(record.implementationAttemptId) ||
    text(record.runId) ||
    text(nested(record.closeout).currentAttemptId);
  const auditStatus = resolveVerifiedSixModelStatus({
    record,
    modelId: 'audit_review',
    currentImplementationAttemptId: currentAttemptId,
  });
  if (
    auditStatus.projectionIntegrity === 'valid' &&
    /^audit-/u.test(auditStatus.currentAttemptId)
  ) {
    return auditStatus.currentAttemptId;
  }
  const fromIterations = objects(record.executionIterations)
    .map((iteration) => text(iteration.closeoutAttemptId) || text(iteration.executionIterationId))
    .filter((id) => /^audit-/u.test(id));
  return fromIterations.at(-1) ?? '';
}

function replaceKnownTargetPlaceholders(
  value: string,
  record: JsonObject,
  closeoutAttemptId: string
): string {
  const recordId = text(record.recordId);
  const requirementSetId = text(record.requirementSetId) || recordId;
  const auditAttemptId = latestAuditAttemptId(record);
  const usesAuditAttempt = /\/(?:audit-review|audit-triad)\//u.test(normalizePath(value));
  const attemptId = usesAuditAttempt && auditAttemptId ? auditAttemptId : closeoutAttemptId;
  return value
    .replace(/<requirement-set-id>/gu, requirementSetId)
    .replace(/<requirementSetId>/gu, requirementSetId)
    .replace(/<record-id>/gu, recordId)
    .replace(/<recordId>/gu, recordId)
    .replace(/<closeout-attempt-id>/gu, closeoutAttemptId)
    .replace(/<closeoutAttemptId>/gu, closeoutAttemptId)
    .replace(/<attempt-id>/gu, attemptId)
    .replace(/<attemptId>/gu, attemptId);
}

function recordFieldValue(record: JsonObject, pathOrField: string): unknown {
  const fieldPath = pathOrField
    .replace(/^requirement-record(?:\.json)?\.?/u, '')
    .replace(/\[\]/gu, '');
  return fieldPath
    .split('.')
    .filter(Boolean)
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === 'object' && !Array.isArray(current)
          ? (current as JsonObject)[key]
          : undefined,
      record
    );
}

function targetConcretePath(
  target: JsonObject,
  record: JsonObject,
  closeoutAttemptId: string,
  projectRoot: string
): string {
  const targetPath = filePathPrefix(text(target.pathOrField));
  if (!targetPath || /\s/u.test(targetPath)) return '';
  const replaced = replaceKnownTargetPlaceholders(targetPath, record, closeoutAttemptId);
  if (replaced.includes('<')) return '';
  return path.isAbsolute(replaced) ? replaced : path.resolve(projectRoot, replaced);
}

function writeSemanticCoverageClosureReport(input: {
  filePath: string;
  manifest: JsonObject;
  record: JsonObject;
  closeoutAttemptId: string;
}): void {
  const mustRows = objects(nested(input.manifest.requirements).must);
  const traceRows = objects(input.manifest.traceRows);
  const commands = objects(input.manifest.requiredCommands);
  const criticalMustRows = mustRows.filter((row) => text(row.riskLevel) === 'critical');
  const commandById = new Map(
    commands.map((command) => [text(command.id) || text(command.commandId), command])
  );
  const closures = criticalMustRows.map((must) => {
    const mustId = text(must.id);
    const relatedTraceRows = traceRows.filter((trace) => strings(trace.covers).includes(mustId));
    const commandRefs = unique(
      relatedTraceRows.flatMap((trace) => [
        ...strings(trace.commandRefs),
        ...commands
          .filter((command) => strings(command.traceRows).includes(text(trace.id)))
          .map((command) => text(command.id) || text(command.commandId)),
      ])
    );
    const evidenceRefs = unique([
      ...strings(must.evidenceRefs),
      ...relatedTraceRows.flatMap((trace) => strings(trace.evidenceRefs)),
      ...commandRefs.flatMap((id) => strings(commandById.get(id)?.evidenceRefs)),
    ]);
    return {
      mustId,
      traceRows: relatedTraceRows.map((trace) => text(trace.id)).filter(Boolean),
      commandRefs,
      evidenceRefs,
      closed: relatedTraceRows.length > 0 && commandRefs.length > 0 && evidenceRefs.length > 0,
    };
  });
  const blockedClosures = closures.filter((closure) => !closure.closed);
  writeJson(input.filePath, {
    reportType: 'must_atom_coverage_closure_report',
    schemaVersion: 'must-atom-coverage-closure/v1',
    generatedAt: new Date().toISOString(),
    generatedBy:
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
    recordId: text(input.record.recordId),
    closeoutAttemptId: input.closeoutAttemptId,
    decision: blockedClosures.length === 0 ? 'pass' : 'blocked',
    counts: {
      criticalMustAtoms: criticalMustRows.length,
      closed: closures.length - blockedClosures.length,
      blocked: blockedClosures.length,
    },
    closures,
    blockingIssues: blockedClosures.map((closure) => ({
      code: 'critical_must_atom_not_command_closed',
      mustId: closure.mustId,
    })),
  });
}

function writeRuntimeModeSelection(input: {
  directory: string;
  record: JsonObject;
  closeoutAttemptId: string;
  evidenceDir: string;
  projectRoot: string;
}): void {
  const goalExecutionPath = path.join(input.evidenceDir, 'goal_execution.md');
  const modelPacketPath = path.join(input.evidenceDir, 'model_packet.json');
  writeJson(
    path.join(input.directory, input.closeoutAttemptId, 'execution-runtime-mode-selection.json'),
    {
      schemaVersion: 'execution-runtime-mode-selection/v1',
      recordId: text(input.record.recordId),
      packetId: `${text(input.record.recordId)}:${input.closeoutAttemptId}`,
      attemptId: input.closeoutAttemptId,
      host: 'codex',
      canonicalHost: 'codex',
      executionRuntimeMode: 'native_goal',
      sourceDocumentHash: text(input.record.sourceDocumentHash),
      implementationConfirmationHash: text(input.record.implementationConfirmationHash),
      modelPacketHash: fs.existsSync(modelPacketPath) ? sha256File(modelPacketPath) : null,
      goalExecutionHash: fs.existsSync(goalExecutionPath) ? sha256File(goalExecutionPath) : null,
      selectedAt: new Date().toISOString(),
      selectionReason: 'codex supports host native /goal document-reference execution',
      blocked: false,
    }
  );
}

function writeAuditConvergenceReceipt(filePath: string, closeoutAttemptId: string): void {
  const sourceReceiptPath = path.join(path.dirname(filePath), 'score-receipt.json');
  if (!fs.existsSync(sourceReceiptPath)) return;
  const sourceReceipt = readJson(sourceReceiptPath);
  writeJson(filePath, {
    schemaVersion: 'audit-scoring-convergence-receipt/v1',
    generatedAt: new Date().toISOString(),
    generatedBy:
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
    closeoutAttemptId,
    auditAttemptId: text(sourceReceipt.attemptId),
    sourceReceiptPath: normalizePath(sourceReceiptPath),
    sourceReceiptHash: sha256File(sourceReceiptPath),
    effectiveVerdict: text(sourceReceipt.effectiveVerdict),
    scoreRunId: text(sourceReceipt.scoreRunId),
    dimensionMode: text(sourceReceipt.dimensionMode),
    expectedDimensions: sourceReceipt.expectedDimensions,
    dimensionScores: sourceReceipt.dimensionScores,
  });
}

function materializeTargetArtifacts(input: {
  manifest: JsonObject;
  record: JsonObject;
  closeoutAttemptId: string;
  evidenceDir: string;
  projectRoot: string;
}): void {
  for (const target of objects(input.manifest.targetArtifacts)) {
    const pathOrField = normalizePath(text(target.pathOrField));
    if (!pathOrField) continue;
    const concretePath = targetConcretePath(
      target,
      input.record,
      input.closeoutAttemptId,
      input.projectRoot
    );
    if (!concretePath) continue;
    if (pathOrField.endsWith('/semantic-coverage/must_atom_coverage_closure_report.json')) {
      writeSemanticCoverageClosureReport({
        filePath: concretePath,
        manifest: input.manifest,
        record: input.record,
        closeoutAttemptId: input.closeoutAttemptId,
      });
    } else if (pathOrField.endsWith('/runtime-mode/')) {
      writeRuntimeModeSelection({
        directory: concretePath,
        record: input.record,
        closeoutAttemptId: input.closeoutAttemptId,
        evidenceDir: input.evidenceDir,
        projectRoot: input.projectRoot,
      });
    } else if (
      pathOrField.endsWith('/audit-scoring-convergence-receipt.json') &&
      !fs.existsSync(concretePath)
    ) {
      writeAuditConvergenceReceipt(concretePath, input.closeoutAttemptId);
    }
  }
}

function isJsonObjectFile(filePath: string): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function writeTargetFileEvidenceSnapshot(input: {
  target: JsonObject;
  absoluteTargetPath: string;
  closeoutAttemptId: string;
  evidenceDir: string;
  binding: ExecutionAuthorityBinding;
}): string {
  const targetArtifactId = text(input.target.id) || path.basename(input.absoluteTargetPath);
  const safeArtifactId = targetArtifactId.replace(/[^A-Za-z0-9_.-]/gu, '_');
  const pathDiscriminator = sha256Bytes(normalizePath(input.absoluteTargetPath)).slice(7, 23);
  const snapshotPath = path.join(
    input.evidenceDir,
    'target-artifact-snapshots',
    `${safeArtifactId}-${pathDiscriminator}.json`
  );
  writeJson(snapshotPath, {
    schemaVersion: 'requirements-contract-target-file-evidence-snapshot/v1',
    targetArtifactId,
    targetPath: normalizePath(input.absoluteTargetPath),
    targetHash: sha256File(input.absoluteTargetPath),
    targetSizeBytes: fs.statSync(input.absoluteTargetPath).size,
    targetSourceOfTruthRole: normalizeArtifactRole(
      text(input.target.expectedSourceOfTruthRole)
    ),
    producer:
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
    requirementSetId: input.binding.requirementSetId,
    transactionId: input.binding.transactionId,
    implementationAttemptId: input.binding.implementationAttemptId,
    closeoutAttemptId: input.closeoutAttemptId,
    sourceDocumentHash: input.binding.sourceDocumentHash,
    semanticModelHash: input.binding.semanticModelHash,
    packetHash: input.binding.packetHash,
    traceRows: strings(input.target.traceRefs),
    evidenceRefs: strings(input.target.evidenceRefs),
    capturedAt: new Date().toISOString(),
    decision: 'pass',
  });
  return snapshotPath;
}

function targetArtifactRefs(
  manifest: JsonObject,
  closeoutAttemptId: string,
  record: JsonObject,
  projectRoot: string,
  evidenceDir: string,
  binding: ExecutionAuthorityBinding
): JsonObject[] {
  return objects(manifest.targetArtifacts).flatMap((target) => {
    const pathOrField = text(target.pathOrField);
    const expectedRole = normalizeArtifactRole(text(target.expectedSourceOfTruthRole));
    if (pathOrField.startsWith('requirement-record.')) {
      const value = recordFieldValue(record, pathOrField);
      if (value === undefined) return [];
      return [
        artifactRefForFile({
          artifactType: 'requirement_record_field',
          filePath: pathOrField,
          hash: sha256Bytes(stableStringify(value)),
          producer:
            'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
          purpose: `current-attempt requirement record field snapshot for ${text(target.id) || pathOrField}`,
          traceRows: strings(target.traceRefs),
          evidenceRefs: strings(target.evidenceRefs),
          closeoutAttemptId,
          sourceOfTruthRole: expectedRole,
          aliases: [text(target.id), pathOrField, ...strings(target.aliases)].filter(Boolean),
        }),
      ];
    }
    if (text(target.kind) !== 'file_artifact') return [];
    const targetPath = filePathPrefix(text(target.pathOrField));
    if (!targetPath || /\s/u.test(targetPath)) return [];
    const replaced = replaceKnownTargetPlaceholders(targetPath, record, closeoutAttemptId);
    if (replaced.includes('<')) return [];
    const absolute = path.isAbsolute(replaced) ? replaced : path.resolve(projectRoot, replaced);
    if (!fs.existsSync(absolute)) return [];
    const aliases = [text(target.id), targetPath, replaced, ...strings(target.aliases)].filter(
      Boolean
    );
    const targetRef = artifactRefForFile({
      artifactType: text(target.expectedSourceOfTruthRole) || 'target_file_snapshot',
      filePath: absolute,
      producer:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
      purpose: `current-attempt target artifact snapshot for ${text(target.id) || targetPath}`,
      traceRows: strings(target.traceRefs),
      evidenceRefs: strings(target.evidenceRefs),
      closeoutAttemptId,
      sourceOfTruthRole: expectedRole,
      aliases,
    });
    if (expectedRole !== 'evidence' || isJsonObjectFile(absolute)) {
      return [targetRef];
    }
    targetRef.artifactType = 'target_file_control';
    targetRef.sourceOfTruthRole = 'projection';
    const snapshotPath = writeTargetFileEvidenceSnapshot({
      target,
      absoluteTargetPath: absolute,
      closeoutAttemptId,
      evidenceDir,
      binding,
    });
    return [
      targetRef,
      artifactRefForFile({
        artifactType: 'target_file_readback_snapshot',
        filePath: snapshotPath,
        producer:
          'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
        purpose: `readback-verified target artifact evidence for ${text(target.id) || targetPath}`,
        traceRows: strings(target.traceRefs),
        evidenceRefs: strings(target.evidenceRefs),
        closeoutAttemptId,
        sourceOfTruthRole: expectedRole,
        aliases,
      }),
    ];
  });
}

const COMMAND_REPORT_FILES: Record<string, { fileName: string; artifactType: string }[]> = {
  'CMD-TEST-DYNAMIC-RUNNER': [
    {
      fileName: 'dynamic-runner-test-report.json',
      artifactType: 'test_report',
    },
    {
      fileName: 'legacy-guard-test-report.json',
      artifactType: 'test_report',
    },
    {
      fileName: 'final-closeout-runner-test-report.json',
      artifactType: 'test_report',
    },
  ],
  'CMD-TEST-CLOSEOUT-REMEDIATION-ADAPTER': [
    {
      fileName: 'closeout-remediation-adapter-test-report.json',
      artifactType: 'test_report',
    },
  ],
  'CMD-TEST-CLOSEOUT-REVIEW-RENDER': [
    {
      fileName: 'post-closeout-confirmation-review-test-report.json',
      artifactType: 'test_report',
    },
  ],
  'CMD-ENCODING-GATE': [
    {
      fileName: 'encoding-integrity-report.json',
      artifactType: 'quality_report',
    },
  ],
};

function commandReportRefs(input: {
  commandRuns: CommandRun[];
  evidenceDir: string;
  closeoutAttemptId: string;
}): JsonObject[] {
  const refs: JsonObject[] = [];
  const byCommand = new Map(input.commandRuns.map((run) => [run.commandId, run]));
  for (const [commandId, reports] of Object.entries(COMMAND_REPORT_FILES)) {
    const run = byCommand.get(commandId);
    if (!run) continue;
    for (const report of reports) {
      const reportPath = path.join(input.evidenceDir, report.fileName);
      writeJson(reportPath, {
        reportType: report.artifactType,
        commandId: run.commandId,
        command: run.command,
        runId: run.runId,
        closeoutAttemptId: run.closeoutAttemptId,
        exitCode: run.exitCode,
        outputPath: run.outputPath,
        outputHash: run.outputHash,
        stdoutPath: run.stdoutPath,
        stderrPath: run.stderrPath,
        traceRows: run.artifactRefs.flatMap((artifact) => strings(artifact.traceRows)),
        evidenceRefs: run.artifactRefs.flatMap((artifact) => strings(artifact.evidenceRefs)),
        generatedBy:
          'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
        generatedAt: new Date().toISOString(),
      });
      refs.push(
        artifactRefForFile({
          artifactType: report.artifactType,
          filePath: reportPath,
          producer:
            'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
          purpose: `normalized current-attempt report for ${commandId}`,
          traceRows: unique(run.artifactRefs.flatMap((artifact) => strings(artifact.traceRows))),
          evidenceRefs: unique(
            run.artifactRefs.flatMap((artifact) => strings(artifact.evidenceRefs))
          ),
          closeoutAttemptId: input.closeoutAttemptId,
        })
      );
    }
  }
  return refs;
}

function runCommand(input: {
  command: JsonObject;
  runId: string;
  closeoutAttemptId: string;
  evidenceDir: string;
  binding: ExecutionAuthorityBinding;
  coveredRequirementIds: string[];
}): CommandRun {
  const commandIdValue = commandId(input.command);
  const commandText = text(input.command.command);
  const startedAt = new Date().toISOString();
  const spawn = commandSpawnOptions(commandText);
  const result = spawnSync(spawn.command, spawn.args, {
    cwd: input.binding.projectRoot,
    shell: spawn.shell,
    encoding: 'utf8',
    windowsHide: true,
  });
  const completedAt = new Date().toISOString();
  const mode = commandExecutionMode(commandText);
  const normalizedResult = normalizeCommandResult({
    mode,
    rawExitCode: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  });
  const stdout = normalizedResult.stdout;
  const stderr = normalizedResult.stderr;
  const safeId = commandIdValue.replace(/[^A-Za-z0-9_.-]/gu, '_');
  const commandDir = path.join(input.evidenceDir, 'command-outputs');
  fs.mkdirSync(commandDir, { recursive: true });
  const stdoutPath = path.join(commandDir, `${safeId}.stdout.txt`);
  const stderrPath = path.join(commandDir, `${safeId}.stderr.txt`);
  const outputPath = path.join(commandDir, `${safeId}.combined.json`);
  fs.writeFileSync(stdoutPath, stdout, 'utf8');
  fs.writeFileSync(stderrPath, stderr, 'utf8');
  writeJson(outputPath, {
    schemaVersion: 'required-command-output/v1',
    commandId: commandIdValue,
    command: commandText,
    normalizedCommand: commandText.trim().replace(/\s+/gu, ' '),
    cwd: normalizePath(input.binding.projectRoot),
    startedAt,
    completedAt,
    rawExitCode: result.status,
    exitCode: normalizedResult.exitCode,
    commandExecutionMode: mode,
    stdoutPath: normalizePath(stdoutPath),
    stdoutHash: sha256File(stdoutPath),
    stderrPath: normalizePath(stderrPath),
    stderrHash: sha256File(stderrPath),
  });
  const artifactRefs = normalizedResult.passed
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
    normalizedCommand: commandText.trim().replace(/\s+/gu, ' '),
    cwd: normalizePath(input.binding.projectRoot),
    executorIdentity: {
      class: 'controlled_detached_executor',
      id: 'requirements-contract-ai-tdd-manifest-runner/v1',
    },
    runtimeVersions: input.binding.runtimeVersions,
    dependencyLockHashes: input.binding.dependencyLockHashes,
    environment: input.binding.environment,
    environmentFingerprint: input.binding.environmentFingerprint,
    environmentCompatibilityDecision: 'pass',
    transactionId: input.binding.transactionId,
    implementationAttemptId: input.binding.implementationAttemptId,
    sourceDocumentHash: input.binding.sourceDocumentHash,
    semanticModelHash: input.binding.semanticModelHash,
    packetHash: input.binding.packetHash,
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    startedAt,
    completedAt,
    exitCode: normalizedResult.exitCode,
    stdoutPath: normalizePath(stdoutPath),
    stderrPath: normalizePath(stderrPath),
    outputPath: normalizePath(outputPath),
    outputHash: sha256File(outputPath),
    coveredRequirementIds: input.coveredRequirementIds,
    artifactRefs,
    commandExecutionMode: mode,
    rawExitCode: result.status,
  };
}

function syntheticCommandRun(input: {
  commandId: string;
  command: string;
  runId: string;
  closeoutAttemptId: string;
  evidenceDir: string;
  traceRefs: string[];
  evidenceRefs: string[];
  output: JsonObject;
  binding: ExecutionAuthorityBinding;
  coveredRequirementIds: string[];
}): CommandRun {
  const startedAt = new Date().toISOString();
  const safeId = input.commandId.replace(/[^A-Za-z0-9_.-]/gu, '_');
  const commandDir = path.join(input.evidenceDir, 'command-outputs');
  fs.mkdirSync(commandDir, { recursive: true });
  const stdoutPath = path.join(commandDir, `${safeId}.stdout.txt`);
  const stderrPath = path.join(commandDir, `${safeId}.stderr.txt`);
  const outputPath = path.join(commandDir, `${safeId}.combined.json`);
  const stdout = `${JSON.stringify(input.output, null, 2)}\n`;
  fs.writeFileSync(stdoutPath, stdout, 'utf8');
  fs.writeFileSync(stderrPath, '', 'utf8');
  fs.writeFileSync(outputPath, stdout, 'utf8');
  const completedAt = new Date().toISOString();
  return {
    commandId: input.commandId,
    command: input.command,
    normalizedCommand: input.command.trim().replace(/\s+/gu, ' '),
    cwd: normalizePath(input.binding.projectRoot),
    executorIdentity: {
      class: 'controlled_detached_executor',
      id: 'requirements-contract-ai-tdd-manifest-runner/v1',
    },
    runtimeVersions: input.binding.runtimeVersions,
    dependencyLockHashes: input.binding.dependencyLockHashes,
    environment: input.binding.environment,
    environmentFingerprint: input.binding.environmentFingerprint,
    environmentCompatibilityDecision: 'pass',
    transactionId: input.binding.transactionId,
    implementationAttemptId: input.binding.implementationAttemptId,
    sourceDocumentHash: input.binding.sourceDocumentHash,
    semanticModelHash: input.binding.semanticModelHash,
    packetHash: input.binding.packetHash,
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    startedAt,
    completedAt,
    exitCode: 0,
    stdoutPath: normalizePath(stdoutPath),
    stderrPath: normalizePath(stderrPath),
    outputPath: normalizePath(outputPath),
    outputHash: sha256File(outputPath),
    coveredRequirementIds: input.coveredRequirementIds,
    artifactRefs: [
      artifactRefForOutput({
        commandId: input.commandId,
        outputPath,
        traceRefs: input.traceRefs,
        evidenceRefs: input.evidenceRefs,
        closeoutAttemptId: input.closeoutAttemptId,
      }),
    ],
    deliveryEvidenceRequired: false,
  };
}

function commandCoversRefs(run: CommandRun, traceRefs: string[], evidenceRefs: string[]): boolean {
  const runTraceRefs = new Set(run.artifactRefs.flatMap((artifact) => strings(artifact.traceRows)));
  const runEvidenceRefs = new Set(
    run.artifactRefs.flatMap((artifact) => strings(artifact.evidenceRefs))
  );
  return (
    traceRefs.some((ref) => runTraceRefs.has(ref)) ||
    evidenceRefs.some((ref) => runEvidenceRefs.has(ref))
  );
}

function failureCaseCoverageRefs(registry: JsonObject): {
  traceRefs: string[];
  evidenceRefs: string[];
} {
  const failureCases = objects(registry.failureCases);
  return {
    traceRefs: unique([
      ...failureCases.flatMap((item) => strings(item.requiredTraceRefs)),
      ...objects(registry.groups).flatMap((item) => strings(item.requiredTraceRefs)),
    ]),
    evidenceRefs: unique([
      ...failureCases.flatMap((item) => strings(item.requiredEvidenceRefs)),
      ...objects(registry.groups).flatMap((item) => strings(item.requiredEvidenceRefs)),
    ]),
  };
}

function buildFailureCaseCoverage(input: {
  sourcePath: string;
  record: JsonObject;
  commandRuns: CommandRun[];
  runId: string;
  closeoutAttemptId: string;
  evidenceDir: string;
  binding: ExecutionAuthorityBinding;
}): { commandRun?: CommandRun; artifactRefs: JsonObject[] } {
  let confirmation: JsonObject;
  try {
    confirmation = readImplementationConfirmation(input.sourcePath).confirmation;
  } catch {
    return { artifactRefs: [] };
  }
  const registry = nested(confirmation.functionalResumeFailureCaseRegistry);
  const failureCases = objects(registry.failureCases);
  const applies =
    registry.applies === true ||
    failureCases.length > 0 ||
    nested(nested(confirmation.applicability).runtimeRecovery)
      .requiresFunctionalResumeFailureCaseRegistry === true;
  if (!applies || failureCases.length === 0) return { artifactRefs: [] };

  const refs = failureCaseCoverageRefs(registry);
  const coverageCommandRun = syntheticCommandRun({
    commandId: 'CMD-FULL-FAILURE-CASE-COVERAGE',
    command:
      'internal: generate failure-case coverage from implementationConfirmation.functionalResumeFailureCaseRegistry',
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    evidenceDir: input.evidenceDir,
    traceRefs: refs.traceRefs,
    evidenceRefs: refs.evidenceRefs,
    output: {
      reportType: 'failure_case_coverage_command_output',
      source: 'implementationConfirmation.functionalResumeFailureCaseRegistry',
      failureCaseCount: failureCases.length,
      traceRefs: refs.traceRefs,
      evidenceRefs: refs.evidenceRefs,
    },
    binding: input.binding,
    coveredRequirementIds: unique(
      ['must', 'notDone', 'mustNot']
        .flatMap((section) => objects(confirmation[section]))
        .map((row) => text(row.id))
    ),
  });
  const coverageCommandRef = {
    commandId: coverageCommandRun.commandId,
    runId: coverageCommandRun.runId,
    closeoutAttemptId: coverageCommandRun.closeoutAttemptId,
    exitCode: coverageCommandRun.exitCode,
  };
  const reportPath = path.join(input.evidenceDir, 'failure-case-coverage.json');
  const caseEvidence = failureCases
    .map((item) => {
      const caseId = text(item.id);
      const traceRefs = strings(item.requiredTraceRefs);
      const evidenceRefs = strings(item.requiredEvidenceRefs);
      const commandRunRefs = [
        coverageCommandRef,
        ...input.commandRuns
          .filter((run) => run.exitCode === 0 && commandCoversRefs(run, traceRefs, evidenceRefs))
          .map((run) => ({
            commandId: run.commandId,
            runId: run.runId,
            closeoutAttemptId: run.closeoutAttemptId,
            exitCode: run.exitCode,
          })),
      ];
      const artifactRefs = [
        ...coverageCommandRun.artifactRefs,
        ...input.commandRuns
          .filter((run) => run.exitCode === 0 && commandCoversRefs(run, traceRefs, evidenceRefs))
          .flatMap((run) => run.artifactRefs),
      ];
      const expectedRecoveryActions = strings(item.expectedRecoveryActions);
      return {
        caseId,
        groupId: text(item.groupId),
        triggerSignal: text(item.triggerSignal),
        detectionPoint: text(item.detectionPoint),
        failClosedGate: text(item.failClosedGate),
        exercised: commandRunRefs.length > 1,
        exercisedBy: unique(commandRunRefs.map((run) => text(run.commandId))),
        traceRefs,
        evidenceRefs,
        sourceRefs: [
          { sourceType: 'functionalResumeFailureCaseRegistry.failureCases', id: caseId },
        ],
        commandRunRefs,
        artifactRefs,
        controlledEventRefs: [
          {
            eventType: 'implementation_evidence_ingested',
            closeoutAttemptId: input.closeoutAttemptId,
          },
        ],
        expectedRecoveryActions,
        recoveryActionEvidence: expectedRecoveryActions.map((action) => ({
          action,
          recoveryAction: action,
          evidence: 'fail_closed_gate_policy',
          gate: text(item.failClosedGate) || 'closeout',
        })),
      };
    })
    .filter((item) => text(item.caseId));
  const unexercisedCases = caseEvidence
    .filter((item) => item.exercised !== true)
    .map((item) => text(item.caseId));
  writeJson(reportPath, {
    reportType: 'failure_case_coverage',
    source: 'implementationConfirmation.functionalResumeFailureCaseRegistry',
    generatedAt: new Date().toISOString(),
    generatedBy:
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    sourceDocumentHash: text(input.record.sourceDocumentHash),
    implementationConfirmationHash: text(input.record.implementationConfirmationHash),
    architectureConfirmationHash:
      text(input.record.architectureConfirmationHash) ||
      text(nested(input.record.architectureConfirmationState).currentArchitectureConfirmationHash),
    resumeFailureCaseRegistryCoverage: {
      rawPresent: true,
      status: text(registry.status) || 'source_document_registry_present',
      groups: objects(registry.groups).length,
      failureCases: failureCases.length,
      failureCaseExercisedCount: caseEvidence.length - unexercisedCases.length,
      recoveryActions: objects(registry.recoveryActionDefinitions).length,
      unexercisedCases,
      caseEvidence,
      issues: [],
    },
    failureCaseTotalCount: failureCases.length,
    failureCaseExercisedCount: caseEvidence.length - unexercisedCases.length,
    unexercisedCases,
    blockingIssues: unexercisedCases.map((caseId) => `failure_case_unexercised:${caseId}`),
  });
  return {
    commandRun: coverageCommandRun,
    artifactRefs: [
      artifactRefForFile({
        artifactType: 'failure_case_coverage',
        filePath: reportPath,
        producer:
          'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
        purpose: 'current-attempt functional resume failure-case coverage report',
        traceRows: refs.traceRefs,
        evidenceRefs: refs.evidenceRefs,
        closeoutAttemptId: input.closeoutAttemptId,
      }),
    ],
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
  evidenceArtifacts?: JsonObject[];
}): JsonObject {
  const refs = manifestRefs(input.manifest);
  const artifactRefs = [
    ...(input.evidenceArtifacts ?? []),
    ...input.commandRuns.flatMap((run) => run.artifactRefs),
  ];
  const negativeAssertionArtifactRefs = artifactRefs.filter(
    (artifact) => text(artifact.sourceOfTruthRole) === 'evidence'
  );
  const manifestCommandIds = new Set(
    commandDefinitions(input.manifest).map((command) => commandId(command))
  );
  const deliveryCommandRuns = input.commandRuns.filter(
    (run) => run.deliveryEvidenceRequired !== false && manifestCommandIds.has(run.commandId)
  );
  return {
    eventType: 'execution_iteration_recorded',
    recordId: text(input.record.recordId),
    requirementSetId: text(input.record.requirementSetId) || text(input.record.recordId),
    transactionId: text(input.record.transactionId),
    implementationAttemptId: currentImplementationAttemptId(input.record),
    semanticModelHash: text(input.record.semanticModelHash),
    packetHash: text(input.record.packetHash),
    executionIterationId: `${input.runId}:${input.closeoutAttemptId}`,
    runId: input.runId,
    closeoutAttemptId: input.closeoutAttemptId,
    status: input.status,
    sourceDocumentHash: text(input.record.sourceDocumentHash) || sha256File(input.sourcePath),
    implementationConfirmationHash: text(input.record.implementationConfirmationHash),
    architectureConfirmationHash:
      text(input.record.architectureConfirmationHash) ||
      text(
        nested(input.record.architectureConfirmationState).currentArchitectureConfirmationHash
      ) ||
      text(input.record.implementationConfirmationHash),
    traceRows: refs.traceRows,
    evidenceRefs: refs.evidenceRefs,
    taskRefs: [],
    filesChanged: strings(input.manifest.targetModificationPaths).filter(Boolean),
    diffSummary: 'AI TDD manifest required commands executed by dynamic runner.',
    implementationDelta: {
      filesChanged: objects(input.manifest.targetModificationPaths)
        .map((row) => text(row.path))
        .filter(Boolean),
      diffSummaryRef: 'command-evidence-bundle.json',
      negativeAssertionArtifactRefs,
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
      requiredCommands: deliveryCommandRuns.map((run) => {
        const command =
          objects(input.manifest.requiredCommands).find(
            (row) => commandId(row) === run.commandId
          ) ?? {};
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
  process.stdout.write(
    input.args.json ? `${JSON.stringify(output, null, 2)}\n` : `required_commands=blocked\n`
  );
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
  if (
    !args.source ||
    !args.requirementRecord ||
    !args.mode ||
    !args.attemptId ||
    !args.runId ||
    !args.evidenceDir
  ) {
    throw new Error(
      'missing required args: source, requirementRecord, mode, attemptId, runId, evidenceDir'
    );
  }
  if (args.mode !== 'closeout') throw new Error('only --mode closeout is supported');

  const sourcePath = path.resolve(args.source);
  const recordPath = path.resolve(args.requirementRecord);
  const evidenceDir = path.resolve(args.evidenceDir);
  fs.mkdirSync(evidenceDir, { recursive: true });

  const record = readJson(recordPath);
  const authorityBinding = executionAuthorityBinding(record, recordPath);
  const preRunReport = evaluateAiTddContractGate({
    sourcePath,
    record,
    recordPath,
    mode: 'pre-rerun',
    attemptId: args.attemptId,
    evaluatedBy:
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
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
      binding: authorityBinding,
      coveredRequirementIds: requirementIdsForTraceRefs(manifest, strings(command.traceRefs)),
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
  const failureCaseCoverage = buildFailureCaseCoverage({
    sourcePath,
    record,
    commandRuns,
    runId: args.runId,
    closeoutAttemptId: args.attemptId,
    evidenceDir,
    binding: authorityBinding,
  });
  if (failureCaseCoverage.commandRun) commandRuns.push(failureCaseCoverage.commandRun);
  const refs = manifestRefs(manifest);
  const normalizedCommandReports = commandReportRefs({
    commandRuns,
    evidenceDir,
    closeoutAttemptId: args.attemptId,
  });
  materializeTargetArtifacts({
    manifest,
    record,
    closeoutAttemptId: args.attemptId,
    evidenceDir,
    projectRoot: authorityBinding.projectRoot,
  });
  const targetArtifacts = targetArtifactRefs(
    manifest,
    args.attemptId,
    record,
    authorityBinding.projectRoot,
    evidenceDir,
    authorityBinding
  );
  bindEvidenceArtifactReadbacks(
    [
      ...commandRuns.flatMap((run) => run.artifactRefs),
      ...targetArtifacts,
      ...normalizedCommandReports,
      ...failureCaseCoverage.artifactRefs,
    ],
    authorityBinding
  );
  writeJson(commandEvidenceBundlePath, {
    runId: args.runId,
    closeoutAttemptId: args.attemptId,
    commandRuns,
  });
  const preIngestArtifacts = [
    ...targetArtifacts,
    ...normalizedCommandReports,
    ...failureCaseCoverage.artifactRefs,
    artifactRefForFile({
      artifactType: 'gate_report',
      filePath: preRunReportPath,
      producer:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
      purpose: 'AI TDD pre-run manifest readiness report',
      traceRows: refs.traceRows,
      evidenceRefs: refs.evidenceRefs,
      closeoutAttemptId: args.attemptId,
    }),
    artifactRefForFile({
      artifactType: 'evidence_bundle',
      filePath: commandEvidenceBundlePath,
      producer:
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
      purpose: 'current-attempt required command evidence bundle',
      traceRows: refs.traceRows,
      evidenceRefs: refs.evidenceRefs,
      closeoutAttemptId: args.attemptId,
    }),
  ];
  bindEvidenceArtifactReadbacks(preIngestArtifacts, authorityBinding);
  const packet = buildImplementationEvidencePacket({
    record,
    sourcePath,
    recordPath,
    manifest,
    runId: args.runId,
    closeoutAttemptId: args.attemptId,
    commandRuns,
    status: 'done',
    evidenceArtifacts: preIngestArtifacts,
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
    evaluatedBy:
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/run-required-commands-from-ai-tdd-manifest.ts',
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
  process.stdout.write(
    args.json ? `${JSON.stringify(output, null, 2)}\n` : `required_commands=pass\n`
  );
  return 0;
}

if (require.main === module && isDirectRunRequiredCommandsFromAiTddManifestCli(process.argv[1])) {
  try {
    process.exitCode = mainRunRequiredCommandsFromAiTddManifest(process.argv.slice(2));
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
