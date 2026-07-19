import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateBmadDiscoveryCases,
  type BmadDiscoveryEvaluationCase,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';
import { getRequirementsContractBmadConsumer } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bmad-consumer-registry';
import {
  createRequirementsContractDiscoverySession,
  validateRequirementsContractDiscoverySession,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-discovery-session';
import {
  createRequirementsContractSemanticCandidateBatch,
  validateRequirementsContractSemanticCandidateBatch,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-candidate-batch';

function productionDiscoveryCase(): BmadDiscoveryEvaluationCase {
  const identity = randomUUID();
  const turnId = `turn-${identity}`;
  const messageId = `message-${identity}`;
  const excerptId = `excerpt-${identity}`;
  const consumerId = 'bmad-create-prd-source-authoring';
  const content = `Requirement ${identity} preserves exact discovery intent.`;
  const capturedAt = new Date().toISOString();
  const session = createRequirementsContractDiscoverySession({
    sessionId: `session-${identity}`,
    workflowId: 'bmad-create-prd',
    startedAt: capturedAt,
    turns: [
      {
        turnId,
        messageId,
        actorIdentityClass: 'human_requester',
        capturedAt,
        content,
      },
    ],
    excerpts: [
      {
        excerptId,
        turnId,
        messageId,
        startUtf8Byte: 0,
        endUtf8ByteExclusive: Buffer.byteLength(content, 'utf8'),
      },
    ],
  });
  const batch = createRequirementsContractSemanticCandidateBatch({
    requirementSetId: `requirements-${identity}`,
    discoverySession: session,
    producedByConsumerId: consumerId,
    candidates: [
      {
        candidateId: `candidate-${identity}`,
        candidateKind: 'requirement',
        statement: content,
        sourceExcerptIds: [excerptId],
      },
    ],
  });
  const consumer = getRequirementsContractBmadConsumer(consumerId);
  return {
    caseRef: session.sessionId,
    transcriptValid: validateRequirementsContractDiscoverySession(session),
    candidateBatchValid: validateRequirementsContractSemanticCandidateBatch(batch),
    unboundCandidateCount: batch.candidates.filter(
      (candidate) =>
        candidate.sourceBindings.length === 0 ||
        candidate.sourceBindings.some(
          (binding) =>
            !binding.excerptId ||
            !binding.turnId ||
            !binding.messageId ||
            !binding.excerptHash
        )
    ).length,
    advisoryAuthorityPromotionCount:
      (session.authorityClass === 'none' ? 0 : 1) +
      batch.candidates.filter(
        (candidate) =>
          candidate.authorityClass !== 'model_hypothesis' ||
          candidate.resolutionStatus !== 'unresolved'
      ).length,
    directPrdWriteCount: consumer?.directPrdWrite === false ? 0 : 1,
  };
}

describe('requirements contract BMAD discovery evaluation', () => {
  it('keeps discovery transcripts and candidate batches bound but non-authoritative', () => {
    const productionCase = productionDiscoveryCase();

    const result = evaluateBmadDiscoveryCases([productionCase]);

    expect(result.caseCount).toBe(1);
    expect(result.invalidTranscriptCount).toBe(0);
    expect(result.invalidCandidateBatchCount).toBe(0);
    expect(result.unboundCandidateCount).toBe(0);
    expect(result.advisoryAuthorityPromotionCount).toBe(0);
    expect(result.directPrdWriteCount).toBe(0);
    expect(result.decision).toBe('pass');
  });

  it('blocks any advisory authority promotion or direct PRD write', () => {
    const invalid: BmadDiscoveryEvaluationCase = {
      ...productionDiscoveryCase(),
      advisoryAuthorityPromotionCount: 1,
      directPrdWriteCount: 1,
    };

    const result = evaluateBmadDiscoveryCases([invalid]);

    expect(result.advisoryAuthorityPromotionCount).toBe(1);
    expect(result.directPrdWriteCount).toBe(1);
    expect(result.decision).toBe('block');
  });
});
