import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createJudgeRuntimeBindingsFixture } from './helpers/requirements-contract-judge-runtime-bindings-fixture';
import { requirementsContractJudgeProviderSmokeCommand } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-provider-smoke';
import {
  canonicalJson,
  sha256,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';

const roots: string[] = [];

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

describe('requirements contract Judge Provider smoke', () => {
  it('publishes current-attempt capability and selection receipts without credential leakage', async () => {
    const token = `token-${randomUUID()}`;
    const providerRef = 'local-sonnet-judge';
    const phaseAuditAttemptId = `AUD-${randomUUID()}`;
    const transactionId = `TX-${randomUUID()}`;
    const hash = `sha256:${'6'.repeat(64)}`;
    const server = createServer((request, response) => {
      expect(request.url).toBe('/chat/completions');
      expect(request.headers.authorization).toBe(`Bearer ${token}`);
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          model: 'claude-sonnet-5',
          choices: [{ message: { content: '{"decision":"pass"}' } }],
        })
      );
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server_address_missing');
    const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-smoke-'));
    roots.push(root);
    try {
      mkdirSync(path.join(root, 'private'), { recursive: true });
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
          'credentialRevision: 3',
          'providers:',
          `  ${providerRef}:`,
          '    authenticationType: bearer',
          `    apiKey: ${token}`,
          '',
        ].join('\n')
      );
      const phaseRoot = path.join(root, 'audit', phaseAuditAttemptId);
      const { judgeAuditUnitSet, judgeRuntimeBindings, stageEvidence } =
        createJudgeRuntimeBindingsFixture({
          root,
          phaseRoot,
          phaseAuditAttemptId,
        });
      expect(judgeAuditUnitSet.decision).toBe('pass');
      const implementationAttemptId = `IMP-${randomUUID()}`;
      const auditContext = {
        schemaVersion: 'requirements-contract-stage-audit-context/v1',
        phase: 'pre-candidate',
        phaseAuditAttemptId,
        requirementSetId: judgeAuditUnitSet.requirementSetId,
        transactionId,
        implementationAttemptId,
        frozenUniverseHash: judgeAuditUnitSet.judgeAuditUniverseHash,
        sourceHashes: { source: judgeRuntimeBindings.sourceRef.hash },
        semanticModelHashes: {
          semantic: judgeAuditUnitSet.semanticModelHash,
        },
        consumerIdentityHash: hash,
        stageEvidence,
        judgeRuntimeBindings,
      };
      writeFileSync(
        path.join(phaseRoot, 'audit-context.json'),
        `${JSON.stringify(auditContext)}\n`
      );
      const result = await requirementsContractJudgeProviderSmokeCommand({
        cwd: root,
        config: 'config.yaml',
        phase: 'pre-candidate',
        phaseRoot,
        phaseAuditAttemptId,
        auditContext: path.join(phaseRoot, 'audit-context.json'),
        capabilityReceipt: path.join(phaseRoot, 'capability.json'),
        selectionReceipt: path.join(phaseRoot, 'selection.json'),
        securityParity: path.join(phaseRoot, 'security.json'),
        projectionMode: 'final-only',
        json: false,
      });

      expect(result.decision).toBe('pass');
      expect(result.providerRef).toBe(providerRef);
      expect(result.phaseAuditAttemptId).toBe(phaseAuditAttemptId);
      expect(readFileSync(path.join(phaseRoot, 'selection.json'), 'utf8')).not.toContain(token);
      const selection = JSON.parse(
        readFileSync(path.join(phaseRoot, 'selection.json'), 'utf8')
      );
      const expectedBaseJudgeInputBundleHash = sha256(
        canonicalJson({
          schemaVersion: 'requirements-contract-base-judge-input-bundle/v1',
          phase: auditContext.phase,
          phaseAuditAttemptId,
          requirementSetId: auditContext.requirementSetId,
          transactionId,
          implementationAttemptId,
          judgeAuditUnitSetRef: judgeRuntimeBindings.judgeAuditUnitSetRef,
          judgeAuditUniverseHash: judgeAuditUnitSet.judgeAuditUniverseHash,
          judgeAuditUnitSetHash: judgeAuditUnitSet.judgeAuditUnitSetHash,
          rubricRef: judgeRuntimeBindings.rubricRef,
          systemPromptRef: judgeRuntimeBindings.systemPromptRef,
          sourceRef: judgeRuntimeBindings.sourceRef,
          traceRef: judgeRuntimeBindings.traceRef,
          redRef: judgeRuntimeBindings.redRef,
          baseEvidenceRef: judgeRuntimeBindings.baseEvidenceRef,
          authorizedChallengeDerivationProtocolRef:
            judgeRuntimeBindings.authorizedChallengeDerivationProtocolRef,
        })
      );
      expect(selection).toMatchObject({
        rubricHash: judgeRuntimeBindings.rubricRef.hash,
        systemPromptHash: judgeRuntimeBindings.systemPromptRef.hash,
        sourceHash: judgeRuntimeBindings.sourceRef.hash,
        traceHash: judgeRuntimeBindings.traceRef.hash,
        redHash: judgeRuntimeBindings.redRef.hash,
        baseEvidenceHash: judgeRuntimeBindings.baseEvidenceRef.hash,
        auditUniverseHash: judgeAuditUnitSet.judgeAuditUniverseHash,
        judgeAuditUnitSetRef: judgeRuntimeBindings.judgeAuditUnitSetRef,
        judgeAuditUnitSetHash: judgeAuditUnitSet.judgeAuditUnitSetHash,
        baseJudgeInputBundleHash: expectedBaseJudgeInputBundleHash,
        authorizedChallengeDerivationProtocolHash:
          judgeRuntimeBindings.authorizedChallengeDerivationProtocolRef.hash,
      });
      expect(JSON.parse(readFileSync(path.join(phaseRoot, 'capability.json'), 'utf8'))).toMatchObject({
        transactionId,
        auditAttemptId: phaseAuditAttemptId,
        transportSuccess: true,
        configuredModel: 'claude-sonnet-5',
        decision: 'pass',
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
