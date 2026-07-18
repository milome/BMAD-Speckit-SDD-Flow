import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import {
  createRequirementsContractDiscoverySession,
  type RequirementsContractDiscoverySession,
  validateRequirementsContractDiscoverySession,
} from './requirements-contract-discovery-session';
import {
  createRequirementsContractIntakeReceipt,
  type IntakeExcerptRequest,
  type IntakeMessage,
  type RequirementsContractIntakeReceipt,
  validateRequirementsContractIntakeReceipt,
} from './requirements-contract-intake-receipt';
import {
  createRequirementsContractSemanticCandidateBatch,
  type RequirementsContractSemanticCandidateBatch,
  type SemanticCandidateInput,
  validateRequirementsContractSemanticCandidateBatch,
} from './requirements-contract-semantic-candidate-batch';
import { sha256Stable } from './requirements-contract-semantic-resolver';

interface EntrySourceSessionMessage extends IntakeMessage {
  capturedAt: string;
}

export interface CreateRequirementsContractEntrySourceSessionInput {
  requirementSetId: string;
  sessionId: string;
  workflowId: string;
  branch: string;
  requestedArtifactRole: RequirementsContractIntakeReceipt['requestedArtifactRole'];
  startedAt: string;
  messages: EntrySourceSessionMessage[];
  excerpts: IntakeExcerptRequest[];
  producedByConsumerId: string;
  candidates: SemanticCandidateInput[];
}

export interface RequirementsContractEntrySourceSession {
  schemaVersion: 'requirements-contract-entry-source-session/v1';
  entrySource: 'session_requirements';
  requirementSetId: string;
  authority: 'none';
  compilationOrder: [
    'intake_receipt',
    'discovery_session',
    'semantic_candidate_batch',
  ];
  intakeReceiptHash: string;
  discoverySessionHash: string;
  candidateBatchHash: string;
  intakeReceipt: RequirementsContractIntakeReceipt;
  discoverySession: RequirementsContractDiscoverySession;
  semanticCandidateBatch: RequirementsContractSemanticCandidateBatch;
  entrySourceSessionHash: string;
}

let entrySourceSessionValidator: ValidateFunction | null = null;

function validator(): ValidateFunction {
  if (entrySourceSessionValidator) return entrySourceSessionValidator;
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-entry-source-session.schema.json'
  );
  entrySourceSessionValidator = new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(readFileSync(schemaPath, 'utf8')) as object
  );
  return entrySourceSessionValidator;
}

function discoveryExcerptBounds(
  message: EntrySourceSessionMessage,
  excerpt: RequirementsContractIntakeReceipt['excerpts'][number]
) {
  if (excerpt.boundary.kind === 'span') {
    return {
      startUtf8Byte: excerpt.boundary.startUtf8Byte,
      endUtf8ByteExclusive: excerpt.boundary.endUtf8ByteExclusive,
    };
  }
  return {
    startUtf8Byte: 0,
    endUtf8ByteExclusive: Buffer.byteLength(message.content, 'utf8'),
  };
}

export function createRequirementsContractEntrySourceSession(
  input: CreateRequirementsContractEntrySourceSessionInput
): RequirementsContractEntrySourceSession {
  const intakeReceipt = createRequirementsContractIntakeReceipt({
    requirementSetId: input.requirementSetId,
    sessionId: input.sessionId,
    branch: input.branch,
    requestedArtifactRole: input.requestedArtifactRole,
    capturedAt: input.startedAt,
    messages: input.messages.map(({ capturedAt: _capturedAt, ...message }) => message),
    excerpts: input.excerpts,
  });
  const messageById = new Map(input.messages.map((message) => [message.messageId, message]));
  const discoverySession = createRequirementsContractDiscoverySession({
    sessionId: intakeReceipt.sessionId,
    workflowId: input.workflowId,
    startedAt: input.startedAt,
    turns: input.messages.map((message) => ({
      turnId: message.turnId,
      messageId: message.messageId,
      actorIdentityClass: message.actorIdentityClass,
      capturedAt: message.capturedAt,
      content: message.content,
    })),
    excerpts: intakeReceipt.excerpts.map((excerpt) => {
      const message = messageById.get(excerpt.boundary.messageId);
      if (!message) throw new Error(`Intake excerpt references unknown message: ${excerpt.excerptId}`);
      return {
        excerptId: excerpt.excerptId,
        turnId: excerpt.turnId,
        messageId: message.messageId,
        ...discoveryExcerptBounds(message, excerpt),
      };
    }),
  });
  const semanticCandidateBatch = createRequirementsContractSemanticCandidateBatch({
    requirementSetId: intakeReceipt.requirementSetId,
    discoverySession,
    producedByConsumerId: input.producedByConsumerId,
    candidates: input.candidates,
  });
  const preimage = {
    schemaVersion: 'requirements-contract-entry-source-session/v1' as const,
    entrySource: 'session_requirements' as const,
    requirementSetId: intakeReceipt.requirementSetId,
    authority: 'none' as const,
    compilationOrder: [
      'intake_receipt',
      'discovery_session',
      'semantic_candidate_batch',
    ] as const,
    intakeReceiptHash: intakeReceipt.receiptHash,
    discoverySessionHash: discoverySession.sessionHash,
    candidateBatchHash: semanticCandidateBatch.candidateBatchHash,
    intakeReceipt,
    discoverySession,
    semanticCandidateBatch,
  };
  const result = { ...preimage, entrySourceSessionHash: sha256Stable(preimage) };
  if (!validateRequirementsContractEntrySourceSession(result)) {
    throw new Error('requirements-contract entry-source session failed validation');
  }
  return result;
}

export function validateRequirementsContractEntrySourceSession(value: unknown): boolean {
  if (!validator()(value) || !value || typeof value !== 'object') return false;
  const result = value as RequirementsContractEntrySourceSession;
  if (
    !validateRequirementsContractIntakeReceipt(result.intakeReceipt) ||
    !validateRequirementsContractDiscoverySession(result.discoverySession) ||
    !validateRequirementsContractSemanticCandidateBatch(result.semanticCandidateBatch)
  ) {
    return false;
  }
  if (
    result.requirementSetId !== result.intakeReceipt.requirementSetId ||
    result.requirementSetId !== result.semanticCandidateBatch.requirementSetId ||
    result.intakeReceipt.sessionId !== result.discoverySession.sessionId ||
    result.intakeReceiptHash !== result.intakeReceipt.receiptHash ||
    result.discoverySessionHash !== result.discoverySession.sessionHash ||
    result.candidateBatchHash !== result.semanticCandidateBatch.candidateBatchHash
  ) {
    return false;
  }
  const intakeExcerptById = new Map(
    result.intakeReceipt.excerpts.map((excerpt) => [excerpt.excerptId, excerpt])
  );
  if (
    result.discoverySession.excerpts.length !== result.intakeReceipt.excerpts.length ||
    result.discoverySession.excerpts.some((excerpt) => {
      const intakeExcerpt = intakeExcerptById.get(excerpt.excerptId);
      return (
        !intakeExcerpt ||
        intakeExcerpt.turnId !== excerpt.turnId ||
        intakeExcerpt.content !== excerpt.content ||
        intakeExcerpt.contentHash !== excerpt.contentHash
      );
    })
  ) {
    return false;
  }
  const { entrySourceSessionHash, ...preimage } = result;
  return entrySourceSessionHash === sha256Stable(preimage);
}
