import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startOpenAICompatibleJudgeProvider } from './helpers/openai-compatible-judge-provider';
import {
  advanceToUserConfirmable,
  createRequirementsConsumerRoot,
  installJudgeRuntime,
  removeRequirementsConsumerRoot,
  spawnMainAgent,
} from './helpers/requirements-contract-production-harness';

const temporaryRoots: string[] = [];

function createConsumerRoot(): string {
  const root = createRequirementsConsumerRoot();
  temporaryRoots.push(root);
  return root;
}

describe('Requirements production-entry confirmation', () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) {
      removeRequirementsConsumerRoot(root);
    }
  });

  it('reaches confirmation through the Requirements-only production CLI chain', async () => {
    const consumerRoot = createConsumerRoot();
    const provider = await startOpenAICompatibleJudgeProvider();
    installJudgeRuntime(consumerRoot, provider.baseUrl);
    try {
      const envelope = await advanceToUserConfirmable(consumerRoot, provider);

      expect(provider.requests).toHaveLength(1);
      expect(envelope.status).toBe('user_confirmable');
      expect(envelope.data.unresolvedDecisionCount).toBe(0);
      const requestId = envelope.data.requestId as string;
      const exactConfirmationText = envelope.data.confirmation.exactConfirmationText as string;
      const recordRoot = path.join(
        consumerRoot,
        '_bmad-output',
        'runtime',
        'requirement-records',
        requestId
      );
      const record = JSON.parse(
        fs.readFileSync(path.join(recordRoot, 'record', 'requirement-record.json'), 'utf8')
      );
      const semanticIr = JSON.parse(
        fs.readFileSync(
          path.join(recordRoot, ...record.activeAuthority.activeSemanticIrPath.split('/')),
          'utf8'
        )
      );
      const markdown = fs.readFileSync(
        path.join(consumerRoot, envelope.data.confirmation.markdownPath),
        'utf8'
      );
      for (const requirement of semanticIr.semanticPayload.semantics.requirements) {
        expect(markdown).toContain(requirement.id);
        expect(markdown).toContain(requirement.text);
        expect(markdown).toContain(requirement.oracle);
      }
      for (const decision of semanticIr.semanticPayload.semantics.decisions) {
        expect(markdown).toContain(decision.questionId);
        expect(markdown).toContain(
          typeof decision.answerValue === 'string'
            ? decision.answerValue
            : JSON.stringify(decision.answerValue)
        );
      }
      expect(fs.existsSync(path.join(recordRoot, 'goal'))).toBe(false);
      expect(fs.existsSync(path.join(recordRoot, 'partition'))).toBe(false);
      expect(fs.existsSync(path.join(recordRoot, 'child-workloads'))).toBe(false);
      const confirmed = await spawnMainAgent(consumerRoot, 'confirm-scope', [
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        exactConfirmationText,
      ]);

      expect(confirmed).toMatchObject({
        schemaVersion: 'main-agent-package-runtime/v1',
        action: 'confirm-scope',
        status: 'user_confirmed',
        exitCode: 0,
        errors: [],
        data: {
          requestId,
          semanticRevisionId: expect.any(String),
          confirmationEventId: expect.any(String),
        },
      });
      expect(provider.requests).toHaveLength(1);
    } finally {
      await provider.close();
    }
  });
});
