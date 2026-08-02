import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sha256Stable, sha256Text } from './requirements-contract-semantic-resolver';

export type IntakeBoundary =
  | { kind: 'message'; messageId: string }
  | {
      kind: 'span';
      messageId: string;
      startUtf8Byte: number;
      endUtf8ByteExclusive: number;
    };

export interface IntakeMessage {
  messageId: string;
  turnId: string;
  actorIdentityClass: string;
  content: string;
}

export interface IntakeExcerptRequest {
  order: number;
  excerptId: string;
  turnId: string;
  boundary: IntakeBoundary;
}

export interface RequirementsContractIntakeReceipt {
  schemaVersion: 'requirements-contract-intake-receipt/v1';
  requirementSetId: string;
  sessionId: string;
  branch: string;
  entrySource: 'session_requirements';
  requestedArtifactRole: 'product_prd' | 'requirement_source_prd' | 'discovery_envelope';
  sourceContentHash: string;
  excerpts: Array<IntakeExcerptRequest & {
    actorIdentityClass: string;
    content: string;
    contentHash: string;
  }>;
  capturedAt: string;
  receiptHash: string;
}

export interface CreateRequirementsContractIntakeReceiptInput {
  requirementSetId: string;
  sessionId: string;
  branch: string;
  requestedArtifactRole: RequirementsContractIntakeReceipt['requestedArtifactRole'];
  capturedAt: string;
  messages: IntakeMessage[];
  excerpts: IntakeExcerptRequest[];
}

const SCHEMA_FILE = 'requirements-contract-intake-receipt.schema.json';
let receiptValidator: ValidateFunction | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function nonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function schemaValidator(): ValidateFunction {
  if (receiptValidator) return receiptValidator;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  receiptValidator = ajv.compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE), 'utf8'))
  );
  return receiptValidator;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => keys.includes(key));
}

function spanContent(message: IntakeMessage, boundary: Extract<IntakeBoundary, { kind: 'span' }>): string {
  const bytes = Buffer.from(message.content, 'utf8');
  if (
    !Number.isSafeInteger(boundary.startUtf8Byte) ||
    !Number.isSafeInteger(boundary.endUtf8ByteExclusive) ||
    boundary.startUtf8Byte < 0 ||
    boundary.endUtf8ByteExclusive <= boundary.startUtf8Byte ||
    boundary.endUtf8ByteExclusive > bytes.length
  ) {
    throw new Error('UTF-8 span boundary is outside the source message');
  }
  const selected = bytes
    .subarray(boundary.startUtf8Byte, boundary.endUtf8ByteExclusive)
    .toString('utf8');
  if (
    selected.length === 0 ||
    Buffer.byteLength(selected, 'utf8') !==
      boundary.endUtf8ByteExclusive - boundary.startUtf8Byte
  ) {
    throw new Error('UTF-8 span boundary splits a code point');
  }
  return selected;
}

function parsedInput(value: unknown): CreateRequirementsContractIntakeReceiptInput {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'requirementSetId',
      'sessionId',
      'branch',
      'requestedArtifactRole',
      'capturedAt',
      'messages',
      'excerpts',
    ]) ||
    !Array.isArray(value.messages) ||
    !Array.isArray(value.excerpts)
  ) {
    throw new Error('Malformed Intake Receipt input');
  }
  nonEmpty(value.requirementSetId, 'requirementSetId');
  nonEmpty(value.sessionId, 'sessionId');
  nonEmpty(value.branch, 'branch');
  nonEmpty(value.capturedAt, 'capturedAt');
  if (!['product_prd', 'requirement_source_prd', 'discovery_envelope'].includes(
    String(value.requestedArtifactRole)
  )) {
    throw new Error('requestedArtifactRole is not registered');
  }
  return value as unknown as CreateRequirementsContractIntakeReceiptInput;
}

export function createRequirementsContractIntakeReceipt(
  inputValue: unknown
): RequirementsContractIntakeReceipt {
  const input = parsedInput(inputValue);
  if (input.messages.length === 0 || input.excerpts.length === 0) {
    throw new Error('Intake Receipt requires messages and excerpts');
  }
  const messageById = new Map<string, IntakeMessage>();
  for (const message of input.messages) {
    if (!isRecord(message) || !exactKeys(message, [
      'messageId',
      'turnId',
      'actorIdentityClass',
      'content',
    ])) {
      throw new Error('Malformed Intake message');
    }
    nonEmpty(message.messageId, 'messageId');
    nonEmpty(message.turnId, 'turnId');
    nonEmpty(message.actorIdentityClass, 'actorIdentityClass');
    nonEmpty(message.content, 'message content');
    if (messageById.has(message.messageId)) throw new Error('Duplicate messageId');
    messageById.set(message.messageId, message);
  }
  const orders = new Set<number>();
  const excerptIds = new Set<string>();
  const excerpts = [...input.excerpts]
    .sort((left, right) => left.order - right.order)
    .map((request) => {
      if (!isRecord(request) || !exactKeys(request, ['order', 'excerptId', 'turnId', 'boundary'])) {
        throw new Error('Malformed Intake excerpt request');
      }
      if (!Number.isSafeInteger(request.order) || request.order < 1 || orders.has(request.order)) {
        throw new Error('Each excerpt order must be a unique positive integer');
      }
      nonEmpty(request.excerptId, 'excerptId');
      nonEmpty(request.turnId, 'turnId');
      if (excerptIds.has(request.excerptId)) throw new Error('Duplicate excerptId');
      orders.add(request.order);
      excerptIds.add(request.excerptId);
      const boundary = request.boundary;
      if (!isRecord(boundary) || !['message', 'span'].includes(String(boundary.kind))) {
        throw new Error('Malformed Intake boundary');
      }
      const expectedBoundaryKeys =
        boundary.kind === 'message'
          ? ['kind', 'messageId']
          : ['kind', 'messageId', 'startUtf8Byte', 'endUtf8ByteExclusive'];
      if (!exactKeys(boundary, expectedBoundaryKeys)) throw new Error('Ambiguous Intake boundary');
      nonEmpty(boundary.messageId, 'boundary.messageId');
      const message = messageById.get(boundary.messageId);
      if (!message) throw new Error('Boundary references an unknown messageId');
      if (message.turnId !== request.turnId) throw new Error('Boundary turnId mismatch');
      const content =
        boundary.kind === 'message'
          ? message.content
          : spanContent(message, boundary as Extract<IntakeBoundary, { kind: 'span' }>);
      return {
        order: request.order,
        excerptId: request.excerptId,
        turnId: request.turnId,
        actorIdentityClass: message.actorIdentityClass,
        content,
        contentHash: sha256Text(content),
        boundary: request.boundary,
      };
    });
  const payload = {
    schemaVersion: 'requirements-contract-intake-receipt/v1' as const,
    requirementSetId: input.requirementSetId,
    sessionId: input.sessionId,
    branch: input.branch,
    entrySource: 'session_requirements' as const,
    requestedArtifactRole: input.requestedArtifactRole,
    sourceContentHash: sha256Stable(input.messages),
    excerpts,
    capturedAt: input.capturedAt,
  };
  const receipt = { ...payload, receiptHash: sha256Stable(payload) };
  if (!validateRequirementsContractIntakeReceipt(receipt)) {
    throw new Error('Generated Intake Receipt failed schema or hash validation');
  }
  return receipt;
}

export function validateRequirementsContractIntakeReceipt(value: unknown): boolean {
  if (!schemaValidator()(value) || !isRecord(value) || !Array.isArray(value.excerpts)) return false;
  if (
    value.excerpts.some(
      (excerpt) =>
        !isRecord(excerpt) ||
        typeof excerpt.content !== 'string' ||
        excerpt.contentHash !== sha256Text(excerpt.content) ||
        (
          isRecord(excerpt.boundary) &&
          excerpt.boundary.kind === 'span' &&
          (
            !Number.isSafeInteger(excerpt.boundary.startUtf8Byte) ||
            !Number.isSafeInteger(excerpt.boundary.endUtf8ByteExclusive) ||
            Number(excerpt.boundary.endUtf8ByteExclusive) <= Number(excerpt.boundary.startUtf8Byte)
          )
        )
    )
  ) {
    return false;
  }
  const { receiptHash, ...payload } = value;
  return receiptHash === sha256Stable(payload);
}
