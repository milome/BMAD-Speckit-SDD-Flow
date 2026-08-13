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
  spawnMainAgentResult,
} from './helpers/requirements-contract-production-harness';

const temporaryRoots: string[] = [];

function recordRootFor(consumerRoot: string, requestId: string): string {
  return path.join(consumerRoot, '_bmad-output', 'runtime', 'requirement-records', requestId);
}

function rewriteAuthorityFormatting(consumerRoot: string): void {
  const authorityPath = path.join(consumerRoot, 'policy', 'refund-approval-policy.json');
  const unchangedAuthority = JSON.parse(fs.readFileSync(authorityPath, 'utf8'));
  fs.writeFileSync(authorityPath, `${JSON.stringify(unchangedAuthority, null, 4)}\n`, 'utf8');
}

describe('Requirements production-entry binding refresh', () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) removeRequirementsConsumerRoot(root);
  });

  it('refreshes locator-only evidence without rerunning Judge before exact-text confirmation', async () => {
    const consumerRoot = createRequirementsConsumerRoot();
    temporaryRoots.push(consumerRoot);
    const provider = await startOpenAICompatibleJudgeProvider();
    installJudgeRuntime(consumerRoot, provider.baseUrl);
    try {
      const first = await advanceToUserConfirmable(consumerRoot, provider);
      const requestId = first.data.requestId as string;
      const attemptId = first.data.authoringAttemptId as string;
      const recordRoot = recordRootFor(consumerRoot, requestId);
      const recordPath = path.join(recordRoot, 'record', 'requirement-record.json');
      const beforeRecord = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
      const beforeAuthority = beforeRecord.activeAuthority;
      const beforePass = fs.readFileSync(
        path.join(recordRoot, 'quality', 'requirements-effective-pass-receipt.json')
      );
      rewriteAuthorityFormatting(consumerRoot);

      const refreshed = await spawnMainAgent(
        consumerRoot,
        'resume-author-confirmation-ready-source',
        ['--request-id', requestId, '--authoring-attempt-id', attemptId]
      );

      expect(refreshed.status).toBe('user_confirmable');
      expect(refreshed.data.confirmation.exactConfirmationText).not.toBe(
        first.data.confirmation.exactConfirmationText
      );
      expect(provider.requests).toHaveLength(1);
      const afterRecord = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
      expect(afterRecord.activeAuthority).toMatchObject({
        activeSemanticRevisionId: beforeAuthority.activeSemanticRevisionId,
        activeScopeSemanticHash: beforeAuthority.activeScopeSemanticHash,
        activeBuildManifestHash: beforeAuthority.activeBuildManifestHash,
      });
      expect(afterRecord.activeAuthority.activeBindingRevisionId).not.toBe(
        beforeAuthority.activeBindingRevisionId
      );
      expect(
        fs.readFileSync(
          path.join(recordRoot, 'quality', 'requirements-effective-pass-receipt.json')
        )
      ).toEqual(beforePass);
      const confirmed = await spawnMainAgent(consumerRoot, 'confirm-scope', [
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        refreshed.data.confirmation.exactConfirmationText,
      ]);
      expect(confirmed.status).toBe('user_confirmed');
    } finally {
      await provider.close();
    }
  });

  it('resumes both post-CAS crash windows from the fixed staged pages', async () => {
    const consumerRoot = createRequirementsConsumerRoot();
    temporaryRoots.push(consumerRoot);
    const provider = await startOpenAICompatibleJudgeProvider();
    installJudgeRuntime(consumerRoot, provider.baseUrl);
    try {
      const first = await advanceToUserConfirmable(consumerRoot, provider);
      const requestId = first.data.requestId as string;
      const attemptId = first.data.authoringAttemptId as string;
      const recordRoot = recordRootFor(consumerRoot, requestId);
      const recordPath = path.join(recordRoot, 'record', 'requirement-record.json');
      const targetMarkdownPath = path.join(
        consumerRoot,
        first.data.confirmation.markdownPath as string
      );
      const originalMarkdown = fs.readFileSync(targetMarkdownPath);
      rewriteAuthorityFormatting(consumerRoot);

      fs.rmSync(targetMarkdownPath);
      fs.mkdirSync(targetMarkdownPath);
      const promotionCrash = await spawnMainAgentResult(
        consumerRoot,
        'resume-author-confirmation-ready-source',
        ['--request-id', requestId, '--authoring-attempt-id', attemptId]
      );
      expect(promotionCrash.code).not.toBe(0);
      const postCasRecord = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
      const refreshedBindingRevisionId = postCasRecord.activeAuthority
        .activeBindingRevisionId as string;
      const stagingRoot = path.join(
        recordRoot,
        'confirmation',
        'staging',
        'binding-refresh',
        refreshedBindingRevisionId
      );
      const stagedMarkdownPath = path.join(stagingRoot, 'requirements.md');
      const stagedHtmlPath = path.join(stagingRoot, 'requirements.html');
      expect(fs.existsSync(stagedMarkdownPath)).toBe(true);
      expect(fs.existsSync(stagedHtmlPath)).toBe(true);
      const stagedMarkdown = fs.readFileSync(stagedMarkdownPath);
      const stagedHtml = fs.readFileSync(stagedHtmlPath);
      const staleConfirmation = await spawnMainAgentResult(consumerRoot, 'confirm-scope', [
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        first.data.confirmation.exactConfirmationText,
      ]);
      expect(staleConfirmation.code).toBe(2);

      fs.rmSync(targetMarkdownPath, { recursive: true });
      fs.writeFileSync(targetMarkdownPath, originalMarkdown);
      const refreshReceiptPath = path.join(
        recordRoot,
        'authoring',
        'source-bindings',
        refreshedBindingRevisionId,
        'source-binding-refresh-receipt.json'
      );
      fs.mkdirSync(refreshReceiptPath);
      const receiptCrash = await spawnMainAgentResult(
        consumerRoot,
        'resume-author-confirmation-ready-source',
        ['--request-id', requestId, '--authoring-attempt-id', attemptId]
      );
      expect(receiptCrash.code).not.toBe(0);
      expect(fs.readFileSync(stagedMarkdownPath)).toEqual(stagedMarkdown);
      expect(fs.readFileSync(stagedHtmlPath)).toEqual(stagedHtml);
      const promotedMarkdown = fs.readFileSync(targetMarkdownPath, 'utf8');
      expect(promotedMarkdown).toContain('## Confirmation');
      expect(
        await spawnMainAgentResult(consumerRoot, 'confirm-scope', [
          '--request-id',
          requestId,
          '--exact-confirmation-text',
          first.data.confirmation.exactConfirmationText,
        ])
      ).toMatchObject({ code: 2 });

      fs.rmSync(refreshReceiptPath, { recursive: true });
      const recovered = await spawnMainAgent(
        consumerRoot,
        'resume-author-confirmation-ready-source',
        ['--request-id', requestId, '--authoring-attempt-id', attemptId]
      );
      expect(recovered.status).toBe('user_confirmable');
      expect(fs.readFileSync(stagedMarkdownPath)).toEqual(stagedMarkdown);
      expect(fs.readFileSync(stagedHtmlPath)).toEqual(stagedHtml);
      expect(provider.requests).toHaveLength(1);
      expect(
        await spawnMainAgent(consumerRoot, 'confirm-scope', [
          '--request-id',
          requestId,
          '--exact-confirmation-text',
          recovered.data.confirmation.exactConfirmationText,
        ])
      ).toMatchObject({ status: 'user_confirmed' });
    } finally {
      await provider.close();
    }
  });

  it('preserves an existing confirmation across locator-only refresh', async () => {
    const consumerRoot = createRequirementsConsumerRoot();
    temporaryRoots.push(consumerRoot);
    const provider = await startOpenAICompatibleJudgeProvider();
    installJudgeRuntime(consumerRoot, provider.baseUrl);
    try {
      const first = await advanceToUserConfirmable(consumerRoot, provider);
      const requestId = first.data.requestId as string;
      const attemptId = first.data.authoringAttemptId as string;
      const recordRoot = recordRootFor(consumerRoot, requestId);
      const confirmationEventPath = path.join(
        recordRoot,
        'confirmation',
        'confirmation-event.json'
      );
      await spawnMainAgent(consumerRoot, 'confirm-scope', [
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        first.data.confirmation.exactConfirmationText,
      ]);
      const confirmationEvent = fs.readFileSync(confirmationEventPath);
      rewriteAuthorityFormatting(consumerRoot);

      const refreshed = await spawnMainAgent(
        consumerRoot,
        'resume-author-confirmation-ready-source',
        ['--request-id', requestId, '--authoring-attempt-id', attemptId]
      );
      expect(refreshed.status).toBe('user_confirmed');
      expect(fs.readFileSync(confirmationEventPath)).toEqual(confirmationEvent);
      expect(provider.requests).toHaveLength(1);
      const record = JSON.parse(
        fs.readFileSync(path.join(recordRoot, 'record', 'requirement-record.json'), 'utf8')
      );
      expect(record.lifecycle).toBe('user_confirmed');
      expect(record.confirmedScopeSemanticHash).toBe(
        record.activeAuthority.activeScopeSemanticHash
      );
      const reused = await spawnMainAgent(consumerRoot, 'confirm-scope', [
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        refreshed.data.confirmation.exactConfirmationText,
      ]);
      expect(reused.status).toBe('confirmation_reused');
      expect(fs.readFileSync(confirmationEventPath)).toEqual(confirmationEvent);
    } finally {
      await provider.close();
    }
  });
});
