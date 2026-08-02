import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import {
  type RequirementsContractDiscoverySession,
  validateRequirementsContractDiscoverySession,
} from './requirements-contract-discovery-session';
import {
  sha256Stable,
  sha256Text,
} from './requirements-contract-semantic-resolver';

export type SemanticCandidateKind =
  | 'requirement'
  | 'negative_requirement'
  | 'boundary'
  | 'ambiguity'
  | 'conflict'
  | 'counterexample'
  | 'option'
  | 'oracle'
  | 'question';

export interface SemanticCandidateInput {
  candidateId: string;
  candidateKind: SemanticCandidateKind;
  statement: string;
  sourceExcerptIds: string[];
}

export interface RequirementsContractSemanticCandidateBatch {
  schemaVersion: 'requirements-contract-semantic-candidate-batch/v1';
  requirementSetId: string;
  discoverySessionId: string;
  discoverySessionHash: string;
  producedByConsumerId: string;
  candidates: Array<{
    candidateId: string;
    candidateKind: SemanticCandidateKind;
    statement: string;
    statementHash: string;
    authorityClass: 'model_hypothesis';
    resolutionStatus: 'unresolved';
    sourceBindings: Array<{
      excerptId: string;
      turnId: string;
      messageId: string;
      startUtf8Byte: number;
      endUtf8ByteExclusive: number;
      excerptHash: string;
    }>;
  }>;
  candidateBatchHash: string;
}

export interface CreateSemanticCandidateBatchInput {
  requirementSetId: string;
  discoverySession: RequirementsContractDiscoverySession;
  producedByConsumerId: string;
  candidates: SemanticCandidateInput[];
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

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} values must be unique`);
}

function validator(): ValidateFunction {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-semantic-candidate-batch.schema.json'
  );
  return new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(readFileSync(schemaPath, 'utf8')) as object
  );
}

export function createRequirementsContractSemanticCandidateBatch(
  input: CreateSemanticCandidateBatchInput
): RequirementsContractSemanticCandidateBatch {
  if (!validateRequirementsContractDiscoverySession(input.discoverySession)) {
    throw new Error('semantic candidate batch requires a valid discovery session');
  }
  if (input.candidates.length === 0) {
    throw new Error('semantic candidate batch requires at least one candidate');
  }
  unique(input.candidates.map((candidate) => candidate.candidateId), 'candidateId');
  const excerptById = new Map(
    input.discoverySession.excerpts.map((excerpt) => [excerpt.excerptId, excerpt])
  );
  const candidates = input.candidates.map((candidate) => {
    unique(candidate.sourceExcerptIds, `sourceExcerptIds for ${candidate.candidateId}`);
    if (candidate.sourceExcerptIds.length === 0) {
      throw new Error(`candidate ${candidate.candidateId} requires source excerpt bindings`);
    }
    const statement = preservedText(candidate.statement, 'statement');
    return {
      candidateId: nonEmpty(candidate.candidateId, 'candidateId'),
      candidateKind: candidate.candidateKind,
      statement,
      statementHash: sha256Text(statement),
      authorityClass: 'model_hypothesis' as const,
      resolutionStatus: 'unresolved' as const,
      sourceBindings: candidate.sourceExcerptIds.map((excerptId) => {
        const excerpt = excerptById.get(excerptId);
        if (!excerpt) throw new Error(`candidate references unknown excerpt: ${excerptId}`);
        return {
          excerptId: excerpt.excerptId,
          turnId: excerpt.turnId,
          messageId: excerpt.messageId,
          startUtf8Byte: excerpt.startUtf8Byte,
          endUtf8ByteExclusive: excerpt.endUtf8ByteExclusive,
          excerptHash: excerpt.contentHash,
        };
      }),
    };
  });
  const preimage = {
    schemaVersion: 'requirements-contract-semantic-candidate-batch/v1' as const,
    requirementSetId: nonEmpty(input.requirementSetId, 'requirementSetId'),
    discoverySessionId: input.discoverySession.sessionId,
    discoverySessionHash: input.discoverySession.sessionHash,
    producedByConsumerId: nonEmpty(input.producedByConsumerId, 'producedByConsumerId'),
    candidates,
  };
  const batch = { ...preimage, candidateBatchHash: sha256Stable(preimage) };
  if (!validateRequirementsContractSemanticCandidateBatch(batch)) {
    throw new Error('semantic candidate batch failed schema or hash validation');
  }
  return batch;
}

export function validateRequirementsContractSemanticCandidateBatch(value: unknown): boolean {
  const validate = validator();
  if (!validate(value) || !value || typeof value !== 'object') return false;
  const batch = value as RequirementsContractSemanticCandidateBatch;
  const { candidateBatchHash, ...preimage } = batch;
  if (candidateBatchHash !== sha256Stable(preimage)) return false;
  if (new Set(batch.candidates.map((row) => row.candidateId)).size !== batch.candidates.length) {
    return false;
  }
  return batch.candidates.every(
    (candidate) =>
      candidate.statementHash === sha256Text(candidate.statement) &&
      new Set(candidate.sourceBindings.map((binding) => binding.excerptId)).size ===
        candidate.sourceBindings.length
  );
}
