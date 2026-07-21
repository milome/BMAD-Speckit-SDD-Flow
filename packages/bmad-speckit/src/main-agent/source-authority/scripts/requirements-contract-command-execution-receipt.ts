import { createHash } from 'node:crypto';
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
let receiptValidator: ValidateFunction | null = null;

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
