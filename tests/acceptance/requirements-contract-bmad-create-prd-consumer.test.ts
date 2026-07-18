import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptRoot = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts'
);
const schemaRoot = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas'
);
const requiredPaths = [
  path.join(scriptRoot, 'requirements-contract-discovery-session.ts'),
  path.join(scriptRoot, 'requirements-contract-semantic-candidate-batch.ts'),
  path.join(scriptRoot, 'requirements-contract-bmad-consumer-registry.ts'),
  path.join(schemaRoot, 'requirements-contract-discovery-session.schema.json'),
  path.join(schemaRoot, 'requirements-contract-semantic-candidate-batch.schema.json'),
];

it('publishes the BMAD Create PRD discovery and consumer production owners', () => {
  expect(requiredPaths.filter((filePath) => !existsSync(filePath))).toEqual([]);
});

describe.runIf(requiredPaths.every(existsSync))('BMAD Create PRD consumer', () => {
  it('binds semantic candidates to immutable discovery excerpts without authority promotion', async () => {
    const { createRequirementsContractDiscoverySession } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-discovery-session'
    );
    const { createRequirementsContractSemanticCandidateBatch } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-candidate-batch'
    );
    const { getRequirementsContractBmadConsumer } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-bmad-consumer-registry'
    );
    const content = 'Checkout retries exactly three times.';
    const session = createRequirementsContractDiscoverySession({
      sessionId: 'SESSION-001',
      workflowId: 'bmad-create-prd',
      startedAt: '2026-07-18T01:00:00.000Z',
      turns: [
        {
          turnId: 'TURN-001',
          messageId: 'MSG-001',
          actorIdentityClass: 'human_requester',
          capturedAt: '2026-07-18T01:00:00.000Z',
          content,
        },
      ],
      excerpts: [
        {
          excerptId: 'EXCERPT-001',
          turnId: 'TURN-001',
          messageId: 'MSG-001',
          startUtf8Byte: 0,
          endUtf8ByteExclusive: Buffer.byteLength(content, 'utf8'),
        },
      ],
    });
    const batch = createRequirementsContractSemanticCandidateBatch({
      requirementSetId: 'REQ-CHECKOUT',
      discoverySession: session,
      producedByConsumerId: 'bmad-create-prd-source-authoring',
      candidates: [
        {
          candidateId: 'CANDIDATE-001',
          candidateKind: 'requirement',
          statement: 'The checkout flow retries exactly three times.',
          sourceExcerptIds: ['EXCERPT-001'],
        },
      ],
    });

    expect(session).toMatchObject({
      schemaVersion: 'requirements-contract-discovery-session/v1',
      authorityClass: 'none',
    });
    expect(batch.candidates[0]).toMatchObject({
      authorityClass: 'model_hypothesis',
      resolutionStatus: 'unresolved',
      sourceBindings: [
        expect.objectContaining({
          excerptId: 'EXCERPT-001',
          turnId: 'TURN-001',
          messageId: 'MSG-001',
        }),
      ],
    });
    expect(getRequirementsContractBmadConsumer('bmad-create-prd-source-authoring')).toMatchObject({
      role: 'authoring_orchestrator',
      directPrdWrite: false,
      semanticAuthorityMutation: false,
      readinessGrant: false,
      passGrant: false,
    });
  });

  it('preserves exact source and candidate text while hashing the same bytes', async () => {
    const { createRequirementsContractDiscoverySession } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-discovery-session'
    );
    const { createRequirementsContractSemanticCandidateBatch } = await import(
      '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-candidate-batch'
    );
    const content = '  Preserve source whitespace.  ';
    const statement = '  Preserve candidate whitespace.  ';
    const session = createRequirementsContractDiscoverySession({
      sessionId: 'SESSION-WHITESPACE',
      workflowId: 'bmad-create-prd',
      startedAt: '2026-07-18T01:30:00.000Z',
      turns: [
        {
          turnId: 'TURN-WHITESPACE',
          messageId: 'MSG-WHITESPACE',
          actorIdentityClass: 'human_requester',
          capturedAt: '2026-07-18T01:30:00.000Z',
          content,
        },
      ],
      excerpts: [
        {
          excerptId: 'EXCERPT-WHITESPACE',
          turnId: 'TURN-WHITESPACE',
          messageId: 'MSG-WHITESPACE',
          startUtf8Byte: 0,
          endUtf8ByteExclusive: Buffer.byteLength(content, 'utf8'),
        },
      ],
    });
    const batch = createRequirementsContractSemanticCandidateBatch({
      requirementSetId: 'REQ-WHITESPACE',
      discoverySession: session,
      producedByConsumerId: 'bmad-create-prd-source-authoring',
      candidates: [
        {
          candidateId: 'CANDIDATE-WHITESPACE',
          candidateKind: 'requirement',
          statement,
          sourceExcerptIds: ['EXCERPT-WHITESPACE'],
        },
      ],
    });

    expect(session.turns[0].content).toBe(content);
    expect(session.excerpts[0].content).toBe(content);
    expect(batch.candidates[0].statement).toBe(statement);
  });
});
