import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

type JsonRecord = Record<string, unknown>;

export interface RequiredCommandExecutionDescriptor {
  id: string;
  command: string;
  normalizedCommand: string;
  argv: string[];
  cwd: string;
  receiptPath: string;
  requirementRefs: string[];
  acceptanceRefs: string[];
  traceRefs: string[];
}

export interface CommandExecutionContext {
  requirementSetId: string;
  transactionId: string;
  implementationAttemptId: string;
  architectureAuditAttemptId: string;
  activePhaseAuditAttemptId: string;
  contractHash: string;
  inputSnapshotHash: string;
}

export interface RequirementsContractCommandExecutionReceipt {
  schemaVersion: 'requirements-contract-command-execution-receipt/v1';
  commandRunId: string;
  commandId: string;
  command: string;
  normalizedCommand: string;
  argv: string[];
  argvHash: string;
  cwd: string;
  executorIdentity: {
    class: 'controlled_detached_executor' | 'goal_controlled_executor';
    id: string;
  };
  hostIdentity: {
    platform: string;
    architecture: string;
    nodeVersion: string;
  };
  requirementSetId: string;
  requirementRefs: string[];
  transactionId: string;
  implementationAttemptId: string;
  architectureAuditAttemptId: string;
  activePhaseAuditAttemptId: string;
  contractHash: string;
  inputSnapshotHash: string;
  startedAt: string;
  endedAt: string;
  exitCode: number;
  signal: string | null;
  stdoutPath: string;
  stdoutHash: string;
  stderrPath: string;
  stderrHash: string;
  acceptanceRefs: string[];
  traceRefs: string[];
  publication: {
    writer: string;
    targetPath: string;
    publishedAt: string;
    readbackAt: string;
    explicitUtf8: true;
    createOnly: true;
    readbackVerified: true;
  };
  decision: 'pass' | 'block';
  receiptHash: string;
}

export interface RequirementsContractCommandExecutionProducerOptions {
  cwd?: string;
  projectRoot: string;
  request: string;
  json?: boolean;
}

export interface CommandExecutionReceiptValidationResult {
  decision: 'pass' | 'block';
  commandIds: string[];
  issueCodes: string[];
  acceptedReceipts: Array<{
    commandId: string;
    receiptPath: string;
    receiptHash: string;
    commandRunRef: {
      commandId: string;
      command: string;
      normalizedCommand: string;
      cwd: string;
      executorIdentity: RequirementsContractCommandExecutionReceipt['executorIdentity'];
      runtimeVersions: {
        node: string;
      };
      environment: {
        platform: string;
        architecture: string;
      };
      transactionId: string;
      implementationAttemptId: string;
      runId: string;
      exitCode: number;
      startedAt: string;
      completedAt: string;
      coveredRequirementIds: string[];
    };
  }>;
}

const SCHEMA_FILE = 'requirements-contract-command-execution-receipt.schema.json';
const PRODUCER_INPUT_SCHEMA_FILE =
  'requirements-contract-command-execution-producer-input.schema.json';
let receiptValidator: ValidateFunction | null = null;
let producerInputValidator: ValidateFunction | null = null;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as JsonRecord;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256Stable(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function normalizeCommand(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

function normalizedPath(value: string): string {
  return path.resolve(value).replace(/\\/gu, '/');
}

function sameStrings(left: string[], right: string[]): boolean {
  const normalizedLeft = [...new Set(left)].sort();
  const normalizedRight = [...new Set(right)].sort();
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function schemaValidator(): ValidateFunction {
  if (receiptValidator) return receiptValidator;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  receiptValidator = ajv.compile(
    JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE), 'utf8'))
  );
  return receiptValidator;
}

function producerSchemaValidator(): ValidateFunction {
  if (producerInputValidator) return producerInputValidator;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  producerInputValidator = ajv.compile(
    JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '..', 'schemas', PRODUCER_INPUT_SCHEMA_FILE),
        'utf8'
      )
    )
  );
  return producerInputValidator;
}

function resolveWithinRoot(projectRoot: string, candidate: string): string | null {
  const root = path.resolve(projectRoot);
  const resolved = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(root, candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function renderCommand(argv: string[]): string {
  return argv.map((argument) => JSON.stringify(argument)).join(' ');
}

function writeCreateOnly(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

export async function requirementsContractCommandExecutionProducerCommand(
  options: RequirementsContractCommandExecutionProducerOptions
): Promise<RequirementsContractCommandExecutionReceipt> {
  const projectRoot = path.resolve(options.projectRoot || options.cwd || process.cwd());
  const requestPath = resolveWithinRoot(projectRoot, options.request);
  if (!requestPath || !fs.existsSync(requestPath) || !fs.statSync(requestPath).isFile()) {
    throw new Error('command_execution_producer_request_missing_or_outside_root');
  }
  const request = JSON.parse(fs.readFileSync(requestPath, 'utf8')) as unknown;
  const validateRequest = producerSchemaValidator();
  if (!validateRequest(request) || !isRecord(request)) {
    throw new Error(
      `command_execution_producer_request_schema_invalid:${JSON.stringify(
        validateRequest.errors ?? []
      )}`
    );
  }
  const argv = strings(request.argv);
  const commandCwd = resolveWithinRoot(projectRoot, text(request.cwd));
  const stdoutPath = resolveWithinRoot(projectRoot, text(request.stdoutPath));
  const stderrPath = resolveWithinRoot(projectRoot, text(request.stderrPath));
  const receiptPath = resolveWithinRoot(projectRoot, text(request.receiptPath));
  if (
    !commandCwd ||
    !fs.existsSync(commandCwd) ||
    !fs.statSync(commandCwd).isDirectory()
  ) {
    throw new Error('command_execution_producer_cwd_invalid');
  }
  if (!stdoutPath || !stderrPath || !receiptPath) {
    throw new Error('command_execution_producer_output_path_escape');
  }
  const outputPaths = [stdoutPath, stderrPath, receiptPath];
  if (new Set(outputPaths.map(normalizedPath)).size !== outputPaths.length) {
    throw new Error('command_execution_producer_output_path_collision');
  }
  if (outputPaths.some((outputPath) => fs.existsSync(outputPath))) {
    throw new Error('command_execution_producer_output_exists');
  }

  const startedAt = new Date().toISOString();
  const execution = spawnSync(argv[0], argv.slice(1), {
    cwd: commandCwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const endedAt = new Date().toISOString();
  const stdout = execution.stdout ?? '';
  const stderr = `${execution.stderr ?? ''}${execution.error?.message ?? ''}`;
  writeCreateOnly(stdoutPath, stdout);
  writeCreateOnly(stderrPath, stderr);
  const exitCode = execution.status ?? (execution.error ? 1 : 0);
  const command = renderCommand(argv);
  const publicationTimestamp = new Date().toISOString();
  const payload = {
    schemaVersion: 'requirements-contract-command-execution-receipt/v1' as const,
    commandRunId: text(request.commandRunId),
    commandId: text(request.commandId),
    command,
    normalizedCommand: normalizeCommand(command),
    argv,
    argvHash: sha256Stable(argv),
    cwd: commandCwd,
    executorIdentity: {
      class: 'controlled_detached_executor' as const,
      id: 'requirements-contract-command-execution-producer/v1',
    },
    hostIdentity: {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
    },
    requirementSetId: text(request.requirementSetId),
    requirementRefs: strings(request.requirementRefs),
    transactionId: text(request.transactionId),
    implementationAttemptId: text(request.implementationAttemptId),
    architectureAuditAttemptId: text(request.architectureAuditAttemptId),
    activePhaseAuditAttemptId: text(request.activePhaseAuditAttemptId),
    contractHash: text(request.contractHash),
    inputSnapshotHash: text(request.inputSnapshotHash),
    startedAt,
    endedAt,
    exitCode,
    signal: execution.signal ?? null,
    stdoutPath,
    stdoutHash: fileHash(stdoutPath),
    stderrPath,
    stderrHash: fileHash(stderrPath),
    acceptanceRefs: strings(request.acceptanceRefs),
    traceRefs: strings(request.traceRefs),
    publication: {
      writer: 'requirements-contract-command-execution-producer/v1',
      targetPath: receiptPath,
      publishedAt: publicationTimestamp,
      readbackAt: publicationTimestamp,
      explicitUtf8: true as const,
      createOnly: true as const,
      readbackVerified: true as const,
    },
    decision: exitCode === 0 ? ('pass' as const) : ('block' as const),
  };
  const receipt: RequirementsContractCommandExecutionReceipt = {
    ...payload,
    receiptHash: sha256Stable(payload),
  };
  if (!schemaValidator()(receipt)) {
    throw new Error(
      `command_execution_producer_receipt_schema_invalid:${JSON.stringify(
        schemaValidator().errors ?? []
      )}`
    );
  }
  writeCreateOnly(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  const readback = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as unknown;
  if (
    !schemaValidator()(readback) ||
    !isRecord(readback) ||
    text(readback.receiptHash) !== receipt.receiptHash
  ) {
    throw new Error('command_execution_producer_receipt_readback_invalid');
  }
  if (options.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return receipt;
}

function directOrDerivedRequirementRefs(command: JsonRecord): string[] {
  const direct = strings(command.requirementRefs);
  if (direct.length > 0) return direct;
  const perMust = records(command.perMustRows)
    .map((row) => text(row.mustRef))
    .filter(Boolean);
  if (perMust.length > 0) return [...new Set(perMust)];
  return strings(command.covers);
}

function directOrDerivedAcceptanceRefs(
  command: JsonRecord,
  modelPacket: JsonRecord,
  requirementRefs: string[]
): string[] {
  const direct = strings(command.acceptanceRefs);
  if (direct.length > 0) return direct;
  const requirementSet = new Set(requirementRefs);
  return [
    ...new Set(
      records(modelPacket.traceClosureAssertions)
        .filter((row) => requirementSet.has(text(row.mustRef)))
        .flatMap((row) => strings(row.acceptanceRefs))
    ),
  ];
}

function descriptorFromCommand(
  command: JsonRecord,
  modelPacket: JsonRecord
): { descriptor: RequiredCommandExecutionDescriptor | null; issueCodes: string[] } {
  const id = text(command.id || command.commandId);
  const label = id || 'unknown';
  const commandText = text(command.command);
  const argv = strings(command.argv);
  const cwd = text(command.cwd);
  const receiptPath = text(command.receiptPath);
  const requirementRefs = directOrDerivedRequirementRefs(command);
  const acceptanceRefs = directOrDerivedAcceptanceRefs(command, modelPacket, requirementRefs);
  const traceRefs =
    strings(command.traceRefs).length > 0 ? strings(command.traceRefs) : strings(command.traceRows);
  const missing = [
    ...(!id ? ['id'] : []),
    ...(!commandText ? ['command'] : []),
    ...(argv.length === 0 ? ['argv'] : []),
    ...(!cwd ? ['cwd'] : []),
    ...(!receiptPath ? ['receiptPath'] : []),
    ...(requirementRefs.length === 0 ? ['requirementRefs'] : []),
    ...(acceptanceRefs.length === 0 ? ['acceptanceRefs'] : []),
    ...(traceRefs.length === 0 ? ['traceRefs'] : []),
  ];
  if (missing.length > 0) {
    return {
      descriptor: null,
      issueCodes: missing.map((field) => `required_command_descriptor_invalid:${label}:${field}`),
    };
  }
  return {
    descriptor: {
      id,
      command: commandText,
      normalizedCommand: normalizeCommand(commandText),
      argv,
      cwd,
      receiptPath,
      requirementRefs,
      acceptanceRefs,
      traceRefs,
    },
    issueCodes: [],
  };
}

function requiredCommandRowsAndValidationRefs(modelPacket: JsonRecord): {
  commandRows: JsonRecord[];
  validationRefs: string[];
} {
  const executionHandoff = isRecord(modelPacket.executionHandoff)
    ? modelPacket.executionHandoff
    : {};
  return {
    commandRows: [
      ...records(modelPacket.requiredCommands),
      ...records(executionHandoff.requiredValidationCommands),
    ],
    validationRefs: strings(executionHandoff.requiredValidationCommandRefs),
  };
}

export function requiredCommandExecutionDescriptorsFromModelPacket(
  modelPacket: JsonRecord | null
): {
  descriptors: RequiredCommandExecutionDescriptor[];
  issueCodes: string[];
} {
  if (!modelPacket) return { descriptors: [], issueCodes: [] };
  const { commandRows, validationRefs } = requiredCommandRowsAndValidationRefs(modelPacket);
  const descriptors: RequiredCommandExecutionDescriptor[] = [];
  const issueCodes: string[] = [];
  const commandIds = new Set(
    commandRows.map((command) => text(command.id || command.commandId)).filter(Boolean)
  );
  const seenRefs = new Set<string>();
  for (const ref of validationRefs) {
    if (seenRefs.has(ref)) {
      issueCodes.push(`required_command_reference_duplicate:${ref}`);
      continue;
    }
    seenRefs.add(ref);
    if (!commandIds.has(ref)) {
      issueCodes.push(`required_command_reference_unresolved:${ref}`);
    }
  }
  const seen = new Set<string>();
  for (const command of commandRows) {
    const parsed = descriptorFromCommand(command, modelPacket);
    issueCodes.push(...parsed.issueCodes);
    if (!parsed.descriptor) continue;
    if (seen.has(parsed.descriptor.id)) {
      issueCodes.push(`required_command_descriptor_duplicate:${parsed.descriptor.id}`);
      continue;
    }
    seen.add(parsed.descriptor.id);
    descriptors.push(parsed.descriptor);
  }
  return { descriptors, issueCodes };
}

export function requiredCommandIdsFromModelPacket(modelPacket: JsonRecord | null): string[] {
  if (!modelPacket) return [];
  const { commandRows, validationRefs } = requiredCommandRowsAndValidationRefs(modelPacket);
  return [
    ...new Set(
      [
        ...commandRows.map((command) => text(command.id || command.commandId || command.command)),
        ...validationRefs,
      ].filter(Boolean)
    ),
  ];
}

function contextFromModelPacket(modelPacket: JsonRecord | null): {
  context: CommandExecutionContext | null;
  issueCodes: string[];
} {
  const raw = isRecord(modelPacket?.controlledExecutionContext)
    ? modelPacket.controlledExecutionContext
    : {};
  const context: CommandExecutionContext = {
    requirementSetId: text(raw.requirementSetId),
    transactionId: text(raw.transactionId),
    implementationAttemptId: text(raw.implementationAttemptId),
    architectureAuditAttemptId: text(raw.architectureAuditAttemptId),
    activePhaseAuditAttemptId: text(raw.activePhaseAuditAttemptId),
    contractHash: text(raw.contractHash),
    inputSnapshotHash: text(raw.inputSnapshotHash),
  };
  const missing = Object.entries(context)
    .filter(([, value]) => !value)
    .map(([field]) => `required_command_receipt_context_missing:${field}`);
  return {
    context: missing.length === 0 ? context : null,
    issueCodes: missing,
  };
}

function bindingMismatch(commandId: string, field: string): string {
  return `required_command_receipt_binding_mismatch:${commandId}:${field}`;
}

export function validateRequirementsContractCommandExecutionReceiptArtifact(input: {
  projectRoot: string;
  receiptPath: string;
  expectedProducer?: {
    executorClass: RequirementsContractCommandExecutionReceipt['executorIdentity']['class'];
    executorId: string;
    writer: string;
  };
}): {
  receipt: RequirementsContractCommandExecutionReceipt | null;
  receiptPath: string | null;
  receiptHash: string | null;
  issueCodes: string[];
} {
  const receiptPath = resolveWithinRoot(input.projectRoot, input.receiptPath);
  if (!receiptPath || !fs.existsSync(receiptPath) || !fs.statSync(receiptPath).isFile()) {
    return {
      receipt: null,
      receiptPath,
      receiptHash: null,
      issueCodes: ['command_execution_receipt_missing'],
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as unknown;
  } catch {
    return {
      receipt: null,
      receiptPath,
      receiptHash: fileHash(receiptPath),
      issueCodes: ['command_execution_receipt_schema_invalid'],
    };
  }
  if (!schemaValidator()(parsed) || !isRecord(parsed)) {
    return {
      receipt: null,
      receiptPath,
      receiptHash: fileHash(receiptPath),
      issueCodes: ['command_execution_receipt_schema_invalid'],
    };
  }
  const receipt = parsed as unknown as RequirementsContractCommandExecutionReceipt;
  const issueCodes: string[] = [];
  const { receiptHash, ...payload } = receipt;
  if (receiptHash !== sha256Stable(payload)) {
    issueCodes.push('command_execution_receipt_hash_mismatch');
  }
  if (receipt.argvHash !== sha256Stable(receipt.argv)) {
    issueCodes.push('command_execution_receipt_argv_hash_mismatch');
  }
  if (normalizeCommand(receipt.command) !== receipt.normalizedCommand) {
    issueCodes.push('command_execution_receipt_normalized_command_mismatch');
  }
  if (normalizedPath(receipt.publication.targetPath) !== normalizedPath(receiptPath)) {
    issueCodes.push('command_execution_receipt_publication_target_mismatch');
  }
  const timestampOrder = [
    receipt.startedAt,
    receipt.endedAt,
    receipt.publication.publishedAt,
    receipt.publication.readbackAt,
  ].map((value) => Date.parse(value));
  if (
    timestampOrder.some(Number.isNaN) ||
    timestampOrder.some((value, index) => index > 0 && value < timestampOrder[index - 1])
  ) {
    issueCodes.push('command_execution_receipt_timestamp_order_invalid');
  }
  for (const stream of ['stdout', 'stderr'] as const) {
    const streamPath = resolveWithinRoot(input.projectRoot, receipt[`${stream}Path`]);
    if (
      !streamPath ||
      !fs.existsSync(streamPath) ||
      !fs.statSync(streamPath).isFile() ||
      fileHash(streamPath) !== receipt[`${stream}Hash`]
    ) {
      issueCodes.push(`command_execution_receipt_${stream}_invalid`);
    }
  }
  if (
    (receipt.exitCode === 0 && receipt.decision !== 'pass') ||
    (receipt.exitCode !== 0 && receipt.decision !== 'block')
  ) {
    issueCodes.push('command_execution_receipt_decision_mismatch');
  }
  if (
    input.expectedProducer &&
    (receipt.executorIdentity.class !== input.expectedProducer.executorClass ||
      receipt.executorIdentity.id !== input.expectedProducer.executorId ||
      receipt.publication.writer !== input.expectedProducer.writer ||
      receipt.command !== renderCommand(receipt.argv))
  ) {
    issueCodes.push('command_execution_receipt_producer_binding_mismatch');
  }
  return {
    receipt,
    receiptPath,
    receiptHash: fileHash(receiptPath),
    issueCodes: [...new Set(issueCodes)],
  };
}

function validateReceiptForDescriptor(input: {
  projectRoot: string;
  descriptor: RequiredCommandExecutionDescriptor;
  context: CommandExecutionContext;
}): {
  issueCodes: string[];
  acceptedReceipt: CommandExecutionReceiptValidationResult['acceptedReceipts'][number] | null;
} {
  const commandId = input.descriptor.id;
  const receiptPath = resolveWithinRoot(input.projectRoot, input.descriptor.receiptPath);
  if (!receiptPath || !fs.existsSync(receiptPath) || !fs.statSync(receiptPath).isFile()) {
    return {
      issueCodes: [`required_command_receipt_missing:${commandId}`],
      acceptedReceipt: null,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as unknown;
  } catch {
    return {
      issueCodes: [`required_command_receipt_schema_invalid:${commandId}`],
      acceptedReceipt: null,
    };
  }
  if (!schemaValidator()(parsed) || !isRecord(parsed)) {
    return {
      issueCodes: [`required_command_receipt_schema_invalid:${commandId}`],
      acceptedReceipt: null,
    };
  }
  const receipt = parsed as unknown as RequirementsContractCommandExecutionReceipt;
  const { receiptHash, ...payload } = receipt;
  if (receiptHash !== sha256Stable(payload)) {
    return {
      issueCodes: [`required_command_receipt_hash_mismatch:${commandId}`],
      acceptedReceipt: null,
    };
  }
  const bindingChecks: Array<[string, boolean]> = [
    ['commandId', receipt.commandId === commandId],
    ['normalizedCommand', receipt.normalizedCommand === input.descriptor.normalizedCommand],
    ['argv', stableStringify(receipt.argv) === stableStringify(input.descriptor.argv)],
    ['cwd', normalizedPath(receipt.cwd) === normalizedPath(input.descriptor.cwd)],
    ['requirementSetId', receipt.requirementSetId === input.context.requirementSetId],
    ['requirementRefs', sameStrings(receipt.requirementRefs, input.descriptor.requirementRefs)],
    ['transactionId', receipt.transactionId === input.context.transactionId],
    [
      'implementationAttemptId',
      receipt.implementationAttemptId === input.context.implementationAttemptId,
    ],
    [
      'architectureAuditAttemptId',
      receipt.architectureAuditAttemptId === input.context.architectureAuditAttemptId,
    ],
    [
      'activePhaseAuditAttemptId',
      receipt.activePhaseAuditAttemptId === input.context.activePhaseAuditAttemptId,
    ],
    ['contractHash', receipt.contractHash === input.context.contractHash],
    ['inputSnapshotHash', receipt.inputSnapshotHash === input.context.inputSnapshotHash],
    ['acceptanceRefs', sameStrings(receipt.acceptanceRefs, input.descriptor.acceptanceRefs)],
    ['traceRefs', sameStrings(receipt.traceRefs, input.descriptor.traceRefs)],
  ];
  const failedBinding = bindingChecks.find(([, valid]) => !valid);
  if (failedBinding) {
    return {
      issueCodes: [bindingMismatch(commandId, failedBinding[0])],
      acceptedReceipt: null,
    };
  }
  if (receipt.argvHash !== sha256Stable(receipt.argv)) {
    return {
      issueCodes: [`required_command_receipt_integrity_mismatch:${commandId}:argvHash`],
      acceptedReceipt: null,
    };
  }
  if (normalizeCommand(receipt.command) !== receipt.normalizedCommand) {
    return {
      issueCodes: [`required_command_receipt_integrity_mismatch:${commandId}:normalizedCommand`],
      acceptedReceipt: null,
    };
  }
  if (normalizedPath(receipt.publication.targetPath) !== normalizedPath(receiptPath)) {
    return {
      issueCodes: [`required_command_receipt_publication_invalid:${commandId}:targetPath`],
      acceptedReceipt: null,
    };
  }
  const timestampOrder = [
    receipt.startedAt,
    receipt.endedAt,
    receipt.publication.publishedAt,
    receipt.publication.readbackAt,
  ].map((value) => Date.parse(value));
  if (
    timestampOrder.some(Number.isNaN) ||
    timestampOrder.some((value, index) => index > 0 && value < timestampOrder[index - 1])
  ) {
    return {
      issueCodes: [`required_command_receipt_integrity_mismatch:${commandId}:timestampOrder`],
      acceptedReceipt: null,
    };
  }
  for (const stream of ['stdout', 'stderr'] as const) {
    const streamPath = resolveWithinRoot(input.projectRoot, receipt[`${stream}Path`]);
    if (
      !streamPath ||
      !fs.existsSync(streamPath) ||
      !fs.statSync(streamPath).isFile() ||
      fileHash(streamPath) !== receipt[`${stream}Hash`]
    ) {
      return {
        issueCodes: [`required_command_receipt_output_hash_mismatch:${commandId}:${stream}`],
        acceptedReceipt: null,
      };
    }
  }
  if (receipt.exitCode !== 0 || receipt.decision !== 'pass') {
    return {
      issueCodes: [`required_command_receipt_non_pass:${commandId}`],
      acceptedReceipt: null,
    };
  }
  return {
    issueCodes: [],
    acceptedReceipt: {
      commandId,
      receiptPath,
      receiptHash,
      commandRunRef: {
        commandId: receipt.commandId,
        command: receipt.command,
        normalizedCommand: receipt.normalizedCommand,
        cwd: receipt.cwd,
        executorIdentity: receipt.executorIdentity,
        runtimeVersions: {
          node: receipt.hostIdentity.nodeVersion,
        },
        environment: {
          platform: receipt.hostIdentity.platform,
          architecture: receipt.hostIdentity.architecture,
        },
        transactionId: receipt.transactionId,
        implementationAttemptId: receipt.implementationAttemptId,
        runId: receipt.commandRunId,
        exitCode: receipt.exitCode,
        startedAt: receipt.startedAt,
        completedAt: receipt.endedAt,
        coveredRequirementIds: receipt.requirementRefs,
      },
    },
  };
}

export function validateModelPacketCommandExecutionReceipts(input: {
  projectRoot: string;
  modelPacket: JsonRecord | null;
  requireCommandDescriptors?: boolean;
}): CommandExecutionReceiptValidationResult {
  const descriptorResult = requiredCommandExecutionDescriptorsFromModelPacket(input.modelPacket);
  const commandIds = requiredCommandIdsFromModelPacket(input.modelPacket);
  if (commandIds.length === 0) {
    if (input.requireCommandDescriptors ?? true) {
      return {
        decision: 'block',
        commandIds: [],
        issueCodes: ['required_command_descriptor_missing'],
        acceptedReceipts: [],
      };
    }
    return {
      decision: 'pass',
      commandIds: [],
      issueCodes: [],
      acceptedReceipts: [],
    };
  }
  const contextResult = contextFromModelPacket(input.modelPacket);
  const issueCodes = [...descriptorResult.issueCodes, ...contextResult.issueCodes];
  const acceptedReceipts: CommandExecutionReceiptValidationResult['acceptedReceipts'] = [];
  if (contextResult.context) {
    for (const descriptor of descriptorResult.descriptors) {
      const result = validateReceiptForDescriptor({
        projectRoot: input.projectRoot,
        descriptor,
        context: contextResult.context,
      });
      issueCodes.push(...result.issueCodes);
      if (result.acceptedReceipt) acceptedReceipts.push(result.acceptedReceipt);
    }
  }
  return {
    decision:
      issueCodes.length === 0 &&
      descriptorResult.descriptors.length === commandIds.length &&
      acceptedReceipts.length === commandIds.length
        ? 'pass'
        : 'block',
    commandIds,
    issueCodes: [...new Set(issueCodes)],
    acceptedReceipts,
  };
}
