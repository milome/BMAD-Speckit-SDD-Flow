import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createJudgeRuntimeBindingsFixture } from './helpers/requirements-contract-judge-runtime-bindings-fixture';
import { requirementsContractJudgeProviderSmokeCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-provider-smoke';
import { requirementsContractReverseAuditCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-reverse-audit';

const REVERSE_AUDIT_SOURCE = path.resolve(
  process.cwd(),
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-reverse-audit.ts'
);

describe('requirements contract reverse audit', () => {
  it('routes Judge calls through resolver, registry, and the selected Adapter only', () => {
    const source = readFileSync(REVERSE_AUDIT_SOURCE, 'utf8');

    expect(source).toContain('resolveRequirementsContractJudgeCredential');
    expect(source).toContain('resolveRequirementsContractJudgeProvider');
    expect(source).toContain('adapter.judge');
    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toContain("new URL('/chat/completions'");
    expect(source).not.toContain('authorization:');
    expect(source).not.toMatch(/credentials\?*\.credentials/u);
  });

  it('runs the two-round blind protocol and publishes challenge evidence first', async () => {
    let requestCount = 0;
    const judgeRequests: Array<Record<string, unknown>> = [];
    const server = createServer((request, response) => {
      requestCount += 1;
      const chunks: Buffer[] = [];
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      request.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          messages?: Array<{ role?: string; content?: string }>;
        };
        const userMessage = body.messages?.find((message) => message.role === 'user');
        if (userMessage?.content) {
          const payload = JSON.parse(userMessage.content) as Record<string, unknown>;
          if (payload.phaseAuditAttemptId) judgeRequests.push(payload);
        }
      });
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          id: `provider-request-${requestCount}`,
          model: 'claude-sonnet-5',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  decision: 'pass',
                  findings: [],
                  challengeRequests: [],
                  evidenceRefs: [],
                }),
              },
            },
          ],
        })
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server_address_missing');
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-reverse-audit-'));
    try {
      const providerRef = 'local-sonnet-judge';
      const phaseAuditAttemptId = `AUD-${randomUUID()}`;
      const transactionId = `TX-${randomUUID()}`;
      const implementationAttemptId = `IMP-${randomUUID()}`;
      const phaseRoot = path.join(root, 'phase', phaseAuditAttemptId);
      mkdirSync(path.join(root, 'private'), { recursive: true });
      mkdirSync(phaseRoot, { recursive: true });
      writeFileSync(path.join(root, 'contract.md'), '# Contract\n');
      writeFileSync(
        path.join(root, 'config.yaml'),
        [
          'judgeRuntime:',
          '  schemaVersion: requirements-contract-judge-runtime/v1',
          '  enabled: true',
          `  activeProviderRef: ${providerRef}`,
          '  selectionPolicy:',
          '    mode: contract_locked',
          '    runtimeFallbackAllowed: false',
          '    runtimeAutoDiscoveryAllowed: false',
          '    environmentOverrideAllowed: false',
          '    cliTransportAllowed: false',
          '    selectionReceiptRequired: true',
          '  credentialConfig:',
          '    source: config_file',
          '    path: private/credentials.yaml',
          '    schemaVersion: requirements-contract-judge-credentials/v1',
          '    allowedRoot: private',
          '    environmentFallbackAllowed: false',
          '  providers:',
          `    ${providerRef}:`,
          '      enabled: true',
          '      transport: openai-compatible',
          '      apiStyle: chat_completions',
          '      model: claude-sonnet-5',
          `      credentialRef: ${providerRef}`,
          '      endpoint:',
          `        baseUrl: "http://127.0.0.1:${address.port}"`,
          '        resolutionMode: transport_managed',
          '        routingOwnership: transport_adapter',
          '        upstreamVersioning: gateway_managed',
          '        explicitOperationPath: null',
          '      authentication:',
          '        type: bearer',
          '        sensitivity: secret',
          '        arbitraryNonEmptyValueAllowed: false',
          '      auditPolicy:',
          '        independenceClass: different_provider_different_model',
          '        blindReview: true',
          '        allowPassAuthority: false',
          '        toolsAllowed: false',
          '        implementationWritesAllowed: false',
          '      requestPolicy:',
          '        timeoutMs: 10000',
          '        maximumAttempts: 1',
          '        structuredResponseRequired: true',
          '',
        ].join('\n')
      );
      writeFileSync(
        path.join(root, 'private/credentials.yaml'),
        [
          'schemaVersion: requirements-contract-judge-credentials/v1',
          'credentialRevision: 1',
          'providers:',
          `  ${providerRef}:`,
          '    authenticationType: bearer',
          '    apiKey: fixture-private-token',
          '',
        ].join('\n')
      );
      const { judgeAuditUnitSet, judgeRuntimeBindings, stageEvidence } =
        createJudgeRuntimeBindingsFixture({
          root,
          phaseRoot,
          phaseAuditAttemptId,
        });
      writeFileSync(
        path.join(phaseRoot, 'context.json'),
        `${JSON.stringify({
          schemaVersion: 'requirements-contract-stage-audit-context/v1',
          phase: 'pre-candidate',
          phaseAuditAttemptId,
          requirementSetId: judgeAuditUnitSet.requirementSetId,
          transactionId,
          implementationAttemptId,
          frozenUniverseHash: judgeAuditUnitSet.judgeAuditUniverseHash,
          sourceHashes: { source: judgeRuntimeBindings.sourceRef.hash },
          semanticModelHashes: { semantic: judgeAuditUnitSet.semanticModelHash },
          consumerIdentityHash: judgeRuntimeBindings.baseEvidenceRef.hash,
          stageEvidence,
          judgeRuntimeBindings,
        })}\n`
      );
      await requirementsContractJudgeProviderSmokeCommand({
        cwd: root,
        config: 'config.yaml',
        phase: 'pre-candidate',
        phaseRoot,
        phaseAuditAttemptId,
        auditContext: path.join(phaseRoot, 'context.json'),
        capabilityReceipt: path.join(phaseRoot, 'capability.json'),
        selectionReceipt: path.join(phaseRoot, 'selection.json'),
        securityParity: path.join(phaseRoot, 'security.json'),
        projectionMode: 'final-only',
        json: false,
      });

      const result = await requirementsContractReverseAuditCommand({
        cwd: root,
        contract: 'contract.md',
        judgeConfig: 'config.yaml',
        phase: 'pre-candidate',
        phaseRoot,
        phaseAuditAttemptId,
        auditContext: path.join(phaseRoot, 'context.json'),
        capabilityReceipt: path.join(phaseRoot, 'capability.json'),
        selectionReceipt: path.join(phaseRoot, 'selection.json'),
        outTestSourceAudit: path.join(phaseRoot, 'test-source-audit.json'),
        outChallengeTests: path.join(phaseRoot, 'challenge-tests.json'),
        outInitialJudge: path.join(phaseRoot, 'initial-judge.json'),
        outFinalJudge: path.join(phaseRoot, 'final-judge.json'),
        projectionMode: 'final-only',
        json: false,
      });

      expect(requestCount).toBe(3);
      expect(judgeRequests).toHaveLength(2);
      for (const request of judgeRequests) {
        expect(request).toMatchObject({
          judgeAuditUnitSetRef: judgeRuntimeBindings.judgeAuditUnitSetRef,
          judgeAuditUnitSetHash: judgeAuditUnitSet.judgeAuditUnitSetHash,
          auditUniverseHash: judgeAuditUnitSet.judgeAuditUniverseHash,
        });
      }
      expect(result.decision).toBe('pass');
      expect(
        JSON.parse(readFileSync(path.join(phaseRoot, 'challenge-tests.json'), 'utf8'))
      ).toMatchObject({
        writeSequence: 2,
        decision: 'not_requested',
      });
      expect(
        JSON.parse(readFileSync(path.join(phaseRoot, 'test-source-audit.json'), 'utf8'))
      ).toMatchObject({
        writeSequence: 4,
        judgeDecision: 'pass',
        blockerCount: 0,
        inconclusiveCount: 0,
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(root, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 50,
      });
    }
  });
});
