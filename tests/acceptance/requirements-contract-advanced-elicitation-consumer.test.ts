import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const orchestratorPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bmad-consumer-orchestrator.ts'
);

it('publishes the Advanced Elicitation consumer production owner', () => {
  expect(existsSync(orchestratorPath)).toBe(true);
});

describe.runIf(existsSync(orchestratorPath))('BMAD Advanced Elicitation consumer', () => {
  it('keeps every advisory finding unresolved and non-authoritative', async () => {
    const { createRequirementsContractDiscoverySession } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-discovery-session'
    );
    const { createAdvancedElicitationCandidateBatch } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bmad-consumer-orchestrator'
    );
    const content = 'Checkout must recover from a transient payment timeout.';
    const discoverySession = createRequirementsContractDiscoverySession({
      sessionId: 'SESSION-ELICITATION',
      workflowId: 'bmad-create-prd',
      startedAt: '2026-07-18T02:00:00.000Z',
      turns: [
        {
          turnId: 'TURN-ELICITATION',
          messageId: 'MSG-ELICITATION',
          actorIdentityClass: 'human_requester',
          capturedAt: '2026-07-18T02:00:00.000Z',
          content,
        },
      ],
      excerpts: [
        {
          excerptId: 'EXCERPT-ELICITATION',
          turnId: 'TURN-ELICITATION',
          messageId: 'MSG-ELICITATION',
          startUtf8Byte: 0,
          endUtf8ByteExclusive: Buffer.byteLength(content, 'utf8'),
        },
      ],
    });
    const result = createAdvancedElicitationCandidateBatch({
      requirementSetId: 'REQ-CHECKOUT',
      discoverySession,
      findings: [
        {
          findingId: 'FINDING-001',
          findingKind: 'boundary',
          statement: 'The timeout duration is unresolved.',
          sourceExcerptIds: ['EXCERPT-ELICITATION'],
        },
        {
          findingId: 'FINDING-002',
          findingKind: 'question',
          statement: 'Should recovery retry or compensate?',
          sourceExcerptIds: ['EXCERPT-ELICITATION'],
        },
      ],
    });

    expect(result.consumer).toMatchObject({
      consumerId: 'bmad-advanced-elicitation-requirements',
      role: 'advisory_analysis',
      recommendationSelection: false,
      decisionReceiptCreation: false,
      semanticAuthorityMutation: false,
    });
    expect(result.batch.candidates).toHaveLength(2);
    expect(result.batch.candidates.every((row) => row.authorityClass === 'model_hypothesis')).toBe(
      true
    );
    expect(result.batch.candidates.every((row) => row.resolutionStatus === 'unresolved')).toBe(true);
  });
});
