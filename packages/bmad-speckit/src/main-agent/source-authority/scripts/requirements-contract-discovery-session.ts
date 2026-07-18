import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import {
  sha256Stable,
  sha256Text,
} from './requirements-contract-semantic-resolver';

export interface DiscoveryTurnInput {
  turnId: string;
  messageId: string;
  actorIdentityClass: string;
  capturedAt: string;
  content: string;
}

export interface DiscoveryExcerptInput {
  excerptId: string;
  turnId: string;
  messageId: string;
  startUtf8Byte: number;
  endUtf8ByteExclusive: number;
}

export interface RequirementsContractDiscoverySession {
  schemaVersion: 'requirements-contract-discovery-session/v1';
  sessionId: string;
  workflowId: string;
  authorityClass: 'none';
  startedAt: string;
  turns: Array<DiscoveryTurnInput & { contentHash: string }>;
  excerpts: Array<DiscoveryExcerptInput & { content: string; contentHash: string }>;
  sessionHash: string;
}

export interface CreateRequirementsContractDiscoverySessionInput {
  sessionId: string;
  workflowId: string;
  startedAt: string;
  turns: DiscoveryTurnInput[];
  excerpts: DiscoveryExcerptInput[];
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be non-empty`);
  return normalized;
}

function preservedText(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} must be non-empty`);
  return value;
}

function isoTimestamp(value: string, label: string): string {
  const normalized = nonEmpty(value, label);
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${label} must be an ISO-8601 timestamp`);
  return normalized;
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} values must be unique`);
}

function excerptContent(turn: DiscoveryTurnInput, excerpt: DiscoveryExcerptInput): string {
  const bytes = Buffer.from(turn.content, 'utf8');
  if (
    !Number.isInteger(excerpt.startUtf8Byte) ||
    !Number.isInteger(excerpt.endUtf8ByteExclusive) ||
    excerpt.startUtf8Byte < 0 ||
    excerpt.endUtf8ByteExclusive <= excerpt.startUtf8Byte ||
    excerpt.endUtf8ByteExclusive > bytes.length
  ) {
    throw new Error(`excerpt ${excerpt.excerptId} has an invalid UTF-8 byte span`);
  }
  const selected = bytes.subarray(excerpt.startUtf8Byte, excerpt.endUtf8ByteExclusive);
  const content = new TextDecoder('utf-8', { fatal: true }).decode(selected);
  if (!content || !Buffer.from(content, 'utf8').equals(selected)) {
    throw new Error(`excerpt ${excerpt.excerptId} must align to UTF-8 boundaries`);
  }
  return content;
}

function validator(): ValidateFunction {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-discovery-session.schema.json'
  );
  return new Ajv2020({ allErrors: true, strict: false, formats: { 'date-time': true } }).compile(
    JSON.parse(readFileSync(schemaPath, 'utf8')) as object
  );
}

export function createRequirementsContractDiscoverySession(
  input: CreateRequirementsContractDiscoverySessionInput
): RequirementsContractDiscoverySession {
  if (input.turns.length === 0) throw new Error('discovery session requires at least one turn');
  if (input.excerpts.length === 0) {
    throw new Error('discovery session requires at least one source excerpt');
  }
  unique(input.turns.map((turn) => turn.turnId), 'turnId');
  unique(input.turns.map((turn) => turn.messageId), 'messageId');
  unique(input.excerpts.map((excerpt) => excerpt.excerptId), 'excerptId');

  const turns = input.turns.map((turn) => {
    const content = preservedText(turn.content, 'content');
    return {
      turnId: nonEmpty(turn.turnId, 'turnId'),
      messageId: nonEmpty(turn.messageId, 'messageId'),
      actorIdentityClass: nonEmpty(turn.actorIdentityClass, 'actorIdentityClass'),
      capturedAt: isoTimestamp(turn.capturedAt, 'capturedAt'),
      content,
      contentHash: sha256Text(content),
    };
  });
  const turnById = new Map(turns.map((turn) => [turn.turnId, turn]));
  const excerpts = input.excerpts.map((excerpt) => {
    const turn = turnById.get(excerpt.turnId);
    if (!turn || turn.messageId !== excerpt.messageId) {
      throw new Error(`excerpt ${excerpt.excerptId} references an unknown turn/message pair`);
    }
    const content = excerptContent(turn, excerpt);
    return {
      excerptId: nonEmpty(excerpt.excerptId, 'excerptId'),
      turnId: turn.turnId,
      messageId: turn.messageId,
      startUtf8Byte: excerpt.startUtf8Byte,
      endUtf8ByteExclusive: excerpt.endUtf8ByteExclusive,
      content,
      contentHash: sha256Text(content),
    };
  });
  const preimage = {
    schemaVersion: 'requirements-contract-discovery-session/v1' as const,
    sessionId: nonEmpty(input.sessionId, 'sessionId'),
    workflowId: nonEmpty(input.workflowId, 'workflowId'),
    authorityClass: 'none' as const,
    startedAt: isoTimestamp(input.startedAt, 'startedAt'),
    turns,
    excerpts,
  };
  const session = { ...preimage, sessionHash: sha256Stable(preimage) };
  if (!validateRequirementsContractDiscoverySession(session)) {
    throw new Error('requirements-contract discovery session failed schema or hash validation');
  }
  return session;
}

export function validateRequirementsContractDiscoverySession(value: unknown): boolean {
  const validate = validator();
  if (!validate(value) || !value || typeof value !== 'object') return false;
  const session = value as RequirementsContractDiscoverySession;
  const { sessionHash, ...preimage } = session;
  if (sessionHash !== sha256Stable(preimage)) return false;
  if (new Set(session.turns.map((turn) => turn.turnId)).size !== session.turns.length) return false;
  if (new Set(session.turns.map((turn) => turn.messageId)).size !== session.turns.length) return false;
  if (new Set(session.excerpts.map((excerpt) => excerpt.excerptId)).size !== session.excerpts.length) {
    return false;
  }
  const turnById = new Map(session.turns.map((turn) => [turn.turnId, turn]));
  return (
    session.turns.every((turn) => turn.contentHash === sha256Text(turn.content)) &&
    session.excerpts.every((excerpt) => {
      const turn = turnById.get(excerpt.turnId);
      return (
        turn?.messageId === excerpt.messageId &&
        excerpt.contentHash === sha256Text(excerpt.content) &&
        excerptContent(turn, excerpt) === excerpt.content
      );
    })
  );
}
