import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ownerPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-entry-source-session.ts'
);
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-entry-source-session.schema.json'
);

it('publishes the direct-session entry-source owner and schema', () => {
  expect([ownerPath, schemaPath].filter((candidate) => !existsSync(candidate))).toEqual([]);
});

describe.runIf(existsSync(ownerPath) && existsSync(schemaPath))(
  'requirements contract direct-session entry source',
  () => {
    it('creates Intake before discovery candidates and binds one stable requirement identity', async () => {
      const {
        createRequirementsContractEntrySourceSession,
        validateRequirementsContractEntrySourceSession,
      } = await import(
        '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-entry-source-session'
      );
      const content = 'Checkout retries exactly three times.';
      const result = createRequirementsContractEntrySourceSession({
        requirementSetId: 'checkout',
        sessionId: 'SESSION-001',
        workflowId: 'bmad-create-prd',
        branch: 'dev',
        requestedArtifactRole: 'requirement_source_prd',
        startedAt: '2026-07-18T05:00:00.000Z',
        messages: [
          {
            messageId: 'MESSAGE-001',
            turnId: 'TURN-001',
            actorIdentityClass: 'human_requester',
            capturedAt: '2026-07-18T05:00:00.000Z',
            content,
          },
        ],
        excerpts: [
          {
            order: 1,
            excerptId: 'EXCERPT-001',
            turnId: 'TURN-001',
            boundary: { kind: 'message', messageId: 'MESSAGE-001' },
          },
        ],
        producedByConsumerId: 'bmad-create-prd-source-authoring',
        candidates: [
          {
            candidateId: 'CANDIDATE-001',
            candidateKind: 'requirement',
            statement: content,
            sourceExcerptIds: ['EXCERPT-001'],
          },
        ],
      });

      expect(result).toMatchObject({
        entrySource: 'session_requirements',
        requirementSetId: 'checkout',
        authority: 'none',
        compilationOrder: [
          'intake_receipt',
          'discovery_session',
          'semantic_candidate_batch',
        ],
      });
      expect(result.intakeReceipt.requirementSetId).toBe('checkout');
      expect(result.semanticCandidateBatch.requirementSetId).toBe('checkout');
      expect(result.intakeReceiptHash).toBe(result.intakeReceipt.receiptHash);
      expect(result.discoverySessionHash).toBe(result.discoverySession.sessionHash);
      expect(result.candidateBatchHash).toBe(
        result.semanticCandidateBatch.candidateBatchHash
      );
      expect(validateRequirementsContractEntrySourceSession(result)).toBe(true);
    });
  }
);
