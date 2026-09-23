import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startOpenAICompatibleJudgeProvider } from './helpers/openai-compatible-judge-provider';
import { createRequirementsContractBuildManifestV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-manifest';
import { artifactBytesHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-hash-domains';
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

function rewriteAuthoritySemantics(consumerRoot: string): void {
  const authorityPath = path.join(consumerRoot, 'policy', 'refund-approval-policy.json');
  const authority = JSON.parse(fs.readFileSync(authorityPath, 'utf8'));
  authority.semanticBody.text = `${authority.semanticBody.text} The decision is recorded durably.`;
  fs.writeFileSync(authorityPath, `${JSON.stringify(authority, null, 2)}\n`, 'utf8');
}

function replacePromotionTarget(input: {
  recordRoot: string;
  recordPath: string;
  targetPath: string;
}): void {
  const record = JSON.parse(fs.readFileSync(input.recordPath, 'utf8'));
  const promotionPath = path.join(
    input.recordRoot,
    ...record.currentPromotionEvidence.path.split('/')
  );
  const promotion = JSON.parse(fs.readFileSync(promotionPath, 'utf8'));
  promotion.targetPath = input.targetPath;
  fs.writeFileSync(promotionPath, `${JSON.stringify(promotion, null, 2)}\n`, 'utf8');
  record.currentPromotionEvidence.artifactBytesHash = artifactBytesHash({
    role: 'promotion_receipt',
    mediaType: 'application/json',
    bytes: fs.readFileSync(promotionPath),
  });
  fs.writeFileSync(input.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
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
        activeBuildHash: expect.any(String),
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
      const resumed = await spawnMainAgent(
        consumerRoot,
        'resume-author-confirmation-ready-source',
        ['--request-id', requestId, '--authoring-attempt-id', attemptId]
      );
      expect(resumed.status).toBe('user_confirmed');
      expect(provider.requests).toHaveLength(1);
      const replayed = await spawnMainAgent(
        consumerRoot,
        'resume-author-confirmation-ready-source',
        ['--request-id', requestId, '--authoring-attempt-id', attemptId]
      );
      expect(replayed.status).toBe('user_confirmed');
      expect(provider.requests).toHaveLength(1);

      rewriteAuthoritySemantics(consumerRoot);
      const semanticSuccessor = await spawnMainAgent(
        consumerRoot,
        'resume-author-confirmation-ready-source',
        ['--request-id', requestId, '--authoring-attempt-id', attemptId]
      );
      expect(semanticSuccessor.data.authoringAttemptId).toMatch(/^ATTEMPT-/u);
      expect(provider.requests).toHaveLength(2);
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
      fs.mkdirSync(path.dirname(targetMarkdownPath), { recursive: true });
      fs.writeFileSync(targetMarkdownPath, '# Existing target\n', 'utf8');
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
      fs.mkdirSync(path.dirname(refreshReceiptPath), { recursive: true });
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
      expect(promotedMarkdown).toEqual(originalMarkdown.toString('utf8'));
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

  it('rejects confirmation reuse after an unrelated active build replaces the audited build', async () => {
    const consumerRoot = createRequirementsConsumerRoot();
    temporaryRoots.push(consumerRoot);
    const provider = await startOpenAICompatibleJudgeProvider();
    installJudgeRuntime(consumerRoot, provider.baseUrl);
    try {
      const first = await advanceToUserConfirmable(consumerRoot, provider);
      const requestId = first.data.requestId as string;
      const recordRoot = recordRootFor(consumerRoot, requestId);
      const recordPath = path.join(recordRoot, 'record', 'requirement-record.json');
      await spawnMainAgent(consumerRoot, 'confirm-scope', [
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        first.data.confirmation.exactConfirmationText,
      ]);

      const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
      const previousAuthority = record.activeAuthority;
      const previousManifest = JSON.parse(
        fs.readFileSync(
          path.join(recordRoot, ...previousAuthority.activeBuildManifestPath.split('/')),
          'utf8'
        )
      );
      const unrelatedManifest = createRequirementsContractBuildManifestV2({
        ...previousManifest,
        compilerIdentity: `${previousManifest.compilerIdentity}:unrelated`,
        checkpointSummary: previousManifest.checkpointSummary,
        validationSummary: previousManifest.validationSummary,
      });
      const unrelatedManifestPath = path.join(
        recordRoot,
        'authoring',
        'builds',
        unrelatedManifest.buildHash.slice('sha256:'.length),
        'manifest.json'
      );
      fs.mkdirSync(path.dirname(unrelatedManifestPath), { recursive: true });
      fs.writeFileSync(unrelatedManifestPath, `${JSON.stringify(unrelatedManifest, null, 2)}\n`, 'utf8');
      record.activeAuthority = {
        ...previousAuthority,
        activeBuildHash: unrelatedManifest.buildHash,
        activeBuildManifestPath: path
          .relative(recordRoot, unrelatedManifestPath)
          .replace(/\\/gu, '/'),
        previousBuildHash: previousAuthority.activeBuildHash,
        previousBuildManifestPath: previousAuthority.activeBuildManifestPath,
      };
      fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const replay = await spawnMainAgentResult(consumerRoot, 'confirm-scope', [
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        first.data.confirmation.exactConfirmationText,
      ]);
      expect(replay.code).toBe(2);
      expect(`${replay.stdout}\n${replay.stderr}`).toContain(
        'requirements_confirmation_promotion_stale'
      );
      expect(provider.requests).toHaveLength(1);
    } finally {
      await provider.close();
    }
  });

  it('confines confirmed binding-refresh promotion targets after evidence rehash', async () => {
    const consumerRoot = createRequirementsConsumerRoot();
    temporaryRoots.push(consumerRoot);
    const provider = await startOpenAICompatibleJudgeProvider();
    const externalRoot = fs.mkdtempSync(path.join(process.cwd(), '.tmp-binding-escape-'));
    installJudgeRuntime(consumerRoot, provider.baseUrl);
    try {
      const first = await advanceToUserConfirmable(consumerRoot, provider);
      const requestId = first.data.requestId as string;
      const attemptId = first.data.authoringAttemptId as string;
      const recordRoot = recordRootFor(consumerRoot, requestId);
      const recordPath = path.join(recordRoot, 'record', 'requirement-record.json');
      await spawnMainAgent(consumerRoot, 'confirm-scope', [
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        first.data.confirmation.exactConfirmationText,
      ]);
      rewriteAuthorityFormatting(consumerRoot);

      const absoluteVictim = path.join(externalRoot, 'absolute-victim.md');
      fs.writeFileSync(absoluteVictim, 'unchanged\n', 'utf8');
      replacePromotionTarget({ recordRoot, recordPath, targetPath: absoluteVictim });
      const absoluteAttempt = await spawnMainAgentResult(
        consumerRoot,
        'resume-author-confirmation-ready-source',
        ['--request-id', requestId, '--authoring-attempt-id', attemptId]
      );
      expect(absoluteAttempt.code).not.toBe(0);
      expect(fs.readFileSync(absoluteVictim, 'utf8')).toBe('unchanged\n');

      const symlinkTarget = path.join(externalRoot, 'symlink-victim.md');
      fs.writeFileSync(symlinkTarget, 'unchanged\n', 'utf8');
      const symlinkParent = path.join(consumerRoot, 'linked-outside');
      fs.symlinkSync(externalRoot, symlinkParent, process.platform === 'win32' ? 'junction' : 'dir');
      replacePromotionTarget({
        recordRoot,
        recordPath,
        targetPath: 'linked-outside/symlink-victim.md',
      });
      const symlinkAttempt = await spawnMainAgentResult(
        consumerRoot,
        'resume-author-confirmation-ready-source',
        ['--request-id', requestId, '--authoring-attempt-id', attemptId]
      );
      expect(symlinkAttempt.code).not.toBe(0);
      expect(fs.readFileSync(symlinkTarget, 'utf8')).toBe('unchanged\n');
    } finally {
      await provider.close();
      fs.rmSync(externalRoot, { recursive: true, force: true });
    }
  });
});
