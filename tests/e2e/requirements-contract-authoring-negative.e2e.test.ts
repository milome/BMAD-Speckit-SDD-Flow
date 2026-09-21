import fs from 'node:fs';
import os from 'node:os';
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

function trackedRoot(root: string): string {
  temporaryRoots.push(root);
  return root;
}

function writeSingleRequirementConsumer(input: {
  executionConstraints: boolean;
}): string {
  const root = trackedRoot(fs.mkdtempSync(path.join(os.tmpdir(), 'requirements-negative-')));
  fs.mkdirSync(path.join(root, 'authority'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'requirements.md'),
    [
      '---',
      'authoritySources:',
      '  - path: authority/functional.json',
      '    rootClass: functional_requirement',
      '    proposedAuthorityClass: source_authority',
      '    bodySchemaVersion: requirement-contract-requirement/v2',
      '---',
      '# Requirements',
      '',
    ].join('\n'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'authority', 'functional.json'),
    JSON.stringify({
      schemaVersion: 'requirements-contract-authority-source/v1',
      sourceRootId: 'MUST-FR-NEGATIVE-001',
      semanticBody: {
        text: 'The service must preserve the approved refund request.',
        oracle: 'The contract test proves the approved refund request is preserved.',
        ...(input.executionConstraints
          ? {
              executionConstraints: [
                { kind: 'CMD', id: 'negative-test', value: 'npm test -- negative.test.ts' },
                { kind: 'PATH', id: 'negative-owner', value: 'src/refund.ts' },
              ],
              executionConstraintRefs: ['CMD:negative-test', 'PATH:negative-owner'],
            }
          : {}),
      },
    }),
    'utf8'
  );
  return root;
}

function authorArgs(): string[] {
  return [
    '--intake-source',
    'requirements.md',
    '--target-source',
    'docs/requirements.md',
    '--confirmation-language',
    'en-US',
  ];
}

describe('Requirements production-entry negative gates', () => {
  afterEach(() => {
    for (const root of temporaryRoots.splice(0)) removeRequirementsConsumerRoot(root);
  });

  it('does not call Judge while a business decision is unresolved', async () => {
    const root = trackedRoot(createRequirementsConsumerRoot());
    const provider = await startOpenAICompatibleJudgeProvider();
    installJudgeRuntime(root, provider.baseUrl);
    try {
      const envelope = await spawnMainAgent(root, 'author-confirmation-ready-source', [
        '--intake-source',
        'requirements.md',
        '--target-source',
        'docs/refund-batch-requirements.md',
        '--confirmation-language',
        'zh-CN',
      ]);
      expect(envelope.status).toBe('business_decision_required');
      expect(provider.requests).toHaveLength(0);
    } finally {
      await provider.close();
    }
  });

  it('returns an idempotent technical planning halt without calling Judge', async () => {
    const root = writeSingleRequirementConsumer({ executionConstraints: false });
    const provider = await startOpenAICompatibleJudgeProvider();
    installJudgeRuntime(root, provider.baseUrl);
    try {
      const first = await spawnMainAgent(root, 'author-confirmation-ready-source', authorArgs());
      expect(first.data.status).toBe('technical_planning_pending');
      const repeated = await spawnMainAgent(root, 'resume-author-confirmation-ready-source', [
        '--request-id',
        first.data.requestId,
        '--authoring-attempt-id',
        first.data.authoringAttemptId,
      ]);
      expect(repeated.data).toEqual(first.data);
      expect(provider.requests).toHaveLength(0);
    } finally {
      await provider.close();
    }
  });

  it('does not synthesize a pass when the configured provider is unavailable', async () => {
    const root = writeSingleRequirementConsumer({ executionConstraints: true });
    const envelope = await spawnMainAgent(root, 'author-confirmation-ready-source', authorArgs());
    expect(envelope.data.status).toBe('audit_pending');
    expect(
      fs.existsSync(
        path.join(
          root,
          '_bmad-output',
          'runtime',
          'requirement-records',
          envelope.data.requestId,
          'quality',
          'requirements-effective-pass-receipt.json'
        )
      )
    ).toBe(false);
  });

  it('halts an accepted fail that produces no validated semantic delta', async () => {
    const root = writeSingleRequirementConsumer({ executionConstraints: true });
    const provider = await startOpenAICompatibleJudgeProvider({ verdict: 'fail' });
    installJudgeRuntime(root, provider.baseUrl);
    try {
      const first = await spawnMainAgent(root, 'author-confirmation-ready-source', authorArgs());
      expect(first.data.status).toBe('audit_pending');
      expect(provider.requests).toHaveLength(1);
      const recordRoot = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        first.data.requestId
      );
      const beforeFiles = fs.readdirSync(recordRoot, { recursive: true }).sort();
      const activeRequestPath = path.join(recordRoot, 'quality', 'active-request.json');
      const beforeActiveRequest = fs.readFileSync(activeRequestPath);
      const haltedResult = await spawnMainAgentResult(root, 'resume-author-confirmation-ready-source', [
        '--request-id',
        first.data.requestId,
        '--authoring-attempt-id',
        first.data.authoringAttemptId,
      ]);
      const halted = haltedResult.envelope;
      expect(halted.data).toMatchObject({
        status: 'authoring_blocked',
        issueCode: 'requirements_remediation_not_materializable',
        resumable: false,
      });
      expect(provider.requests).toHaveLength(1);
      const afterFiles = fs.readdirSync(recordRoot, { recursive: true }).sort();
      expect(afterFiles.filter((file) => !beforeFiles.includes(file)).map((file) => file.replaceAll('\\', '/'))).toEqual([
        'quality/failures',
        'quality/failures/latest.json',
      ]);
      expect(fs.readFileSync(activeRequestPath)).toEqual(beforeActiveRequest);
      expect(
        fs.existsSync(
          path.join(
            root,
            '_bmad-output',
            'runtime',
            'requirement-records',
            first.data.requestId,
            'quality',
            'failures',
            'latest.json'
          )
        )
      ).toBe(true);
      const failureSummary = JSON.parse(
        fs.readFileSync(path.join(recordRoot, 'quality', 'failures', 'latest.json'), 'utf8')
      );
      expect(failureSummary).toMatchObject({
        schemaVersion: 'requirements-contract-failure-summary/v1',
        issueCodes: ['requirements_remediation_not_materializable'],
        remediationDecision: 'not_materializable',
      });
      const request = JSON.parse(
        fs.readFileSync(
          path.join(recordRoot, ...String(JSON.parse(fs.readFileSync(activeRequestPath, 'utf8')).requestPath).split('/')),
          'utf8'
        )
      );
      const decision = JSON.parse(
        fs.readFileSync(
          path.join(
            recordRoot,
            'quality',
            'semantic-decisions',
            request.auditBinding.auditBindingHash.slice('sha256:'.length),
            'decision.json'
          ),
          'utf8'
        )
      );
      expect(failureSummary.judgeDecisionHash).toBe(decision.decisionHash);
      const failureSummaryPath = path.join(recordRoot, 'quality', 'failures', 'latest.json');
      const failureSummaryMtime = fs.statSync(failureSummaryPath).mtimeMs;
      const terminalResume = await spawnMainAgentResult(root, 'resume-author-confirmation-ready-source', [
        '--request-id',
        first.data.requestId,
        '--authoring-attempt-id',
        first.data.authoringAttemptId,
      ]);
      expect(terminalResume.envelope).toMatchObject({
        status: 'authoring_blocked',
        data: { issueCode: 'requirements_remediation_not_materializable', resumable: false },
      });
      expect(provider.requests).toHaveLength(1);
      expect(fs.statSync(failureSummaryPath).mtimeMs).toBe(failureSummaryMtime);
    } finally {
      await provider.close();
    }
  });

  it('rejects stale confirmation text without writing a confirmation event', async () => {
    const root = trackedRoot(createRequirementsConsumerRoot());
    const provider = await startOpenAICompatibleJudgeProvider();
    installJudgeRuntime(root, provider.baseUrl);
    try {
      const confirmable = await advanceToUserConfirmable(root, provider);
      const requestId = confirmable.data.requestId as string;
      const result = await spawnMainAgentResult(root, 'confirm-scope', [
        '--request-id',
        requestId,
        '--exact-confirmation-text',
        `${confirmable.data.confirmation.exactConfirmationText}\nstale`,
      ]);
      expect(result.code).toBe(2);
      expect(result.envelope).toMatchObject({
        status: 'confirmation_blocked',
        exitCode: 2,
        errors: [{ code: 'requirements_confirmation_exact_text_mismatch' }],
      });
      expect(
        fs.existsSync(
          path.join(
            root,
            '_bmad-output',
            'runtime',
            'requirement-records',
            requestId,
            'confirmation',
            'confirmation-event.json'
          )
        )
      ).toBe(false);
    } finally {
      await provider.close();
    }
  });
});
