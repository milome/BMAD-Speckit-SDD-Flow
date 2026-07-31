import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  parseRequirementsContractJudgeRunArgv,
  requirementsContractJudgeRunCommand,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-command';
import { evaluateRequirementsContractJudgeInvocationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-invocation-readiness-gate';
import type { RequirementsContractJudgeRole } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-role';
import { sha256 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;

const roots: string[] = [];

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

function createRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'requirements-judge-command-'));
  roots.push(root);
  return root;
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function judgeRuntime(transport: string, adapterRef: string, command?: string): JsonRecord {
  const providerRef = `provider-${transport}-${randomUUID()}`;
  return {
    schemaVersion: 'requirements-contract-judge-runtime/v1',
    enabled: true,
    activeProviderRef: providerRef,
    selectionPolicy: {
      mode: 'contract_locked',
      runtimeFallbackAllowed: false,
      runtimeAutoDiscoveryAllowed: false,
      environmentOverrideAllowed: false,
      cliTransportAllowed: transport === 'cli' || transport === 'claude-code-cli',
      selectionReceiptRequired: true,
    },
    credentialConfig: {
      source: 'config_file',
      path: 'private/credentials.yaml',
      schemaVersion: 'requirements-contract-judge-credentials/v1',
      allowedRoot: 'private',
      environmentFallbackAllowed: false,
    },
    providers: {
      [providerRef]: {
        enabled: true,
        transport,
        adapterRef,
        apiStyle:
          transport === 'openai-compatible'
            ? 'chat_completions'
            : transport === 'anthropic-compatible'
              ? 'messages'
              : 'cli',
        model:
          transport === 'cli' || transport === 'claude-code-cli' ? null : `model-${randomUUID()}`,
        credentialRef: providerRef,
        endpoint: {
          ...(command ? { command } : {}),
          baseUrl: `https://${randomUUID()}.example.test`,
          resolutionMode:
            transport === 'cli' || transport === 'claude-code-cli'
              ? 'path_search'
              : 'transport_managed',
          routingOwnership: 'transport_adapter',
          upstreamVersioning: 'gateway_managed',
          explicitOperationPath: null,
        },
        authentication: {
          type: transport === 'anthropic-compatible' ? 'api_key' : 'bearer',
          sensitivity: 'secret',
          arbitraryNonEmptyValueAllowed: false,
        },
        auditPolicy: {
          independenceClass: 'different_provider_different_model',
          blindReview: true,
          allowPassAuthority: false,
          toolsAllowed: transport === 'cli' || transport === 'claude-code-cli',
          ...(transport === 'cli' || transport === 'claude-code-cli'
            ? { allowedTools: ['Read'] }
            : {}),
          implementationWritesAllowed: false,
        },
        requestPolicy: {
          timeoutMs: 10000,
          maximumAttempts: 1,
          structuredResponseRequired: true,
        },
      },
    },
  };
}

function materializeCommandFixture(
  transport: string,
  adapterRef: string,
  command?: string,
  role: RequirementsContractJudgeRole = 'requirements_critical_auditor'
) {
  const root = createRoot();
  const runtime = judgeRuntime(transport, adapterRef, command);
  const providerRef = String(runtime.activeProviderRef);
  const scopeHash = sha256(`scope-${randomUUID()}`);
  const request = {
    schemaVersion: 'requirements-contract-canonical-judge-request/v1',
    role,
    attemptKey: {
      schemaVersion: 'requirements-contract-judge-attempt-key/v1',
      role,
      attemptId: `attempt-${randomUUID()}`,
      sourceDocumentHash: sha256(`source-${randomUUID()}`),
      semanticModelHash: sha256(`semantic-${randomUUID()}`),
      projectionSetHash: sha256(`projection-${randomUUID()}`),
      scopeHash,
      requestHash: sha256(`request-${randomUUID()}`),
    },
    systemPrompt: 'Return one JSON object.',
    payload: { requirementSetId: `REQ-${randomUUID()}` },
    structuredOutputSchema: {
      type: 'object',
      required: ['decision'],
      properties: {
        decision: { enum: ['pass', 'block', 'inconclusive'] },
      },
    },
    readinessReceipt: {
      schemaVersion: 'requirements-contract-judge-invocation-readiness-receipt/v1',
      role: 'requirements',
      attemptId: 'filled-later',
      requestHash: 'filled-later',
      sourceDocumentHash: 'filled-later',
      semanticModelHash: 'filled-later',
      projectionSetHash: 'filled-later',
      scopeHash: 'filled-later',
      providerRegistryHash: 'filled-later',
      credentialBindingHash: 'filled-later',
      promptHash: 'filled-later',
      schemaHash: 'filled-later',
      policyHash: 'filled-later',
      ledgerHash: 'filled-later',
      auditUnitSetHash: 'filled-later',
      vetoSetHash: 'filled-later',
      readinessHash: 'filled-later',
      providerInvocationCount: 0,
      decision: 'pass',
    },
  };
  request.readinessReceipt.attemptId = request.attemptKey.attemptId;
  request.readinessReceipt.requestHash = request.attemptKey.requestHash;
  request.readinessReceipt.sourceDocumentHash = request.attemptKey.sourceDocumentHash;
  request.readinessReceipt.semanticModelHash = request.attemptKey.semanticModelHash;
  request.readinessReceipt.projectionSetHash = request.attemptKey.projectionSetHash;
  request.readinessReceipt.scopeHash = request.attemptKey.scopeHash;
  const hashFields = [
    'providerRegistryHash',
    'credentialBindingHash',
    'promptHash',
    'schemaHash',
    'policyHash',
    'ledgerHash',
    'auditUnitSetHash',
    'vetoSetHash',
    'readinessHash',
  ];
  for (const field of hashFields) {
    request.readinessReceipt[field as keyof typeof request.readinessReceipt] = sha256(
      `${field}-${randomUUID()}`
    );
  }
  request.readinessReceipt = evaluateRequirementsContractJudgeInvocationReadiness({
    role: 'requirements',
    attemptId: request.attemptKey.attemptId,
    scope: {
      requestHash: request.attemptKey.requestHash,
      sourceDocumentHash: request.attemptKey.sourceDocumentHash,
      semanticModelHash: request.attemptKey.semanticModelHash,
      projectionSetHash: request.attemptKey.projectionSetHash,
      scopeHash: request.attemptKey.scopeHash,
    },
    providerRegistryHash: request.readinessReceipt.providerRegistryHash,
    credentialBindingHash: request.readinessReceipt.credentialBindingHash,
    promptHash: request.readinessReceipt.promptHash,
    schemaHash: request.readinessReceipt.schemaHash,
    policyHash: request.readinessReceipt.policyHash,
    ledgerHash: request.readinessReceipt.ledgerHash,
    auditUnitSetHash: request.readinessReceipt.auditUnitSetHash,
    vetoSetHash: request.readinessReceipt.vetoSetHash,
  }) as typeof request.readinessReceipt;
  mkdirSync(path.join(root, 'private'), { recursive: true });
  writeFileSync(
    path.join(root, 'config.yaml'),
    [
      'judgeRuntime:',
      `  schemaVersion: ${runtime.schemaVersion}`,
      '  enabled: true',
      `  activeProviderRef: ${providerRef}`,
      '  selectionPolicy:',
      '    mode: contract_locked',
      '    runtimeFallbackAllowed: false',
      '    runtimeAutoDiscoveryAllowed: false',
      '    environmentOverrideAllowed: false',
      `    cliTransportAllowed: ${transport === 'cli' || transport === 'claude-code-cli'}`,
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
      `      transport: ${transport}`,
      `      adapterRef: ${adapterRef}`,
      `      apiStyle: ${transport === 'openai-compatible' ? 'chat_completions' : transport === 'anthropic-compatible' ? 'messages' : 'cli'}`,
      `      model: ${transport === 'cli' || transport === 'claude-code-cli' ? 'null' : `model-${randomUUID()}`}`,
      `      credentialRef: ${providerRef}`,
      '      endpoint:',
      ...(command ? [`        command: ${command}`] : []),
      `        baseUrl: "https://${randomUUID()}.example.test"`,
      `        resolutionMode: ${transport === 'cli' || transport === 'claude-code-cli' ? 'path_search' : 'transport_managed'}`,
      '        routingOwnership: transport_adapter',
      '        upstreamVersioning: gateway_managed',
      '        explicitOperationPath: null',
      '      authentication:',
      `        type: ${transport === 'anthropic-compatible' ? 'api_key' : 'bearer'}`,
      '        sensitivity: secret',
      '        arbitraryNonEmptyValueAllowed: false',
      '      auditPolicy:',
      '        independenceClass: different_provider_different_model',
      '        blindReview: true',
      '        allowPassAuthority: false',
      `        toolsAllowed: ${transport === 'cli' || transport === 'claude-code-cli'}`,
      ...(transport === 'cli' || transport === 'claude-code-cli'
        ? ['        allowedTools:', '          - Read']
        : []),
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
      `    authenticationType: ${transport === 'anthropic-compatible' ? 'api_key' : 'bearer'}`,
      `    apiKey: secret-${randomUUID()}`,
      '',
    ].join('\n'),
    'utf8'
  );
  writeJson(path.join(root, 'request.json'), request);
  return {
    root,
    providerRef,
    request,
  };
}

describe('canonical requirements contract judge run command', () => {
  it.each([
    ['openai-compatible', 'OpenAICompatibleJudgeAdapter', undefined],
    ['anthropic-compatible', 'AnthropicCompatibleJudgeAdapter', undefined],
    ['claude-code-cli', 'ClaudeCodeCliJudgeAdapter', 'claude'],
    ['cli', 'CodexCliJudgeAdapter', 'codex'],
  ])(
    'routes %s through the provider registry with JSON/process status parity',
    async (transport, adapterRef, command) => {
      const fixture = materializeCommandFixture(transport, adapterRef, command);
      const outputDir = path.join(fixture.root, 'out');
      let invocationCount = 0;
      const result = await requirementsContractJudgeRunCommand({
        projectRoot: fixture.root,
        config: 'config.yaml',
        request: 'request.json',
        role: 'requirements_critical_auditor',
        attemptId: String((fixture.request.attemptKey as JsonRecord).attemptId),
        outputDir,
        json: true,
        invokeJudge: async ({ providerRef, provider, payload }) => {
          invocationCount += 1;
          expect(providerRef).toBe(fixture.providerRef);
          expect((provider as JsonRecord).transport).toBe(transport);
          expect((payload.request as JsonRecord).payload).toEqual(fixture.request.payload);
          return {
            schemaVersion: 'requirements-contract-normalized-judge-response/v1',
            decision: 'pass',
            findings: [],
            challengeRequests: [],
            evidenceRefs: [],
          };
        },
      });

      expect(invocationCount).toBe(1);
      expect(result).toMatchObject({
        schemaVersion: 'requirements-contract-judge-command-result/v1',
        command: 'bmad-speckit judge run',
        role: 'requirements_critical_auditor',
        processExitCode: 0,
        jsonDecision: 'pass',
        processStatusParity: true,
        providerRef: fixture.providerRef,
        adapterRef,
        decision: 'pass',
      });
      const receipt = JSON.parse(
        readFileSync(path.join(outputDir, 'judge-run-result.json'), 'utf8')
      );
      expect(receipt).toMatchObject({
        command: 'bmad-speckit judge run',
        processExitCode: 0,
        processStatusParity: true,
        decision: 'pass',
      });
    }
  );

  it('runs Final Acceptance when the expected-role pin matches the request authority', async () => {
    const fixture = materializeCommandFixture(
      'cli',
      'CodexCliJudgeAdapter',
      'codex',
      'final_acceptance_judge'
    );
    let invocationCount = 0;
    const result = await requirementsContractJudgeRunCommand({
      projectRoot: fixture.root,
      config: 'config.yaml',
      request: 'request.json',
      role: 'final_acceptance_judge',
      attemptId: String((fixture.request.attemptKey as JsonRecord).attemptId),
      outputDir: 'out',
      invokeJudge: async ({ payload }) => {
        invocationCount += 1;
        expect(payload.request.role).toBe('final_acceptance_judge');
        return {
          schemaVersion: 'requirements-contract-normalized-judge-response/v1',
          decision: 'pass',
          findings: [],
          challengeRequests: [],
          evidenceRefs: [],
        };
      },
    });

    expect(invocationCount).toBe(1);
    expect(result).toMatchObject({
      role: 'final_acceptance_judge',
      processExitCode: 0,
      jsonDecision: 'pass',
      processStatusParity: true,
    });
  });

  it('fails closed before provider invocation when the expected-role pin mismatches', async () => {
    const fixture = materializeCommandFixture(
      'cli',
      'CodexCliJudgeAdapter',
      'codex',
      'final_acceptance_judge'
    );
    let invocationCount = 0;

    await expect(
      requirementsContractJudgeRunCommand({
        projectRoot: fixture.root,
        config: 'config.yaml',
        request: 'request.json',
        role: 'requirements_critical_auditor',
        attemptId: String((fixture.request.attemptKey as JsonRecord).attemptId),
        outputDir: 'out',
        invokeJudge: async () => {
          invocationCount += 1;
          throw new Error('provider_must_not_be_invoked');
        },
      })
    ).rejects.toThrow('requirements_contract_judge_command_role_pin_mismatch');
    expect(invocationCount).toBe(0);
  });

  it('rejects every authority override before provider invocation', async () => {
    const fixture = materializeCommandFixture('cli', 'CodexCliJudgeAdapter', 'codex');
    await expect(
      requirementsContractJudgeRunCommand({
        projectRoot: fixture.root,
        config: 'config.yaml',
        request: 'request.json',
        role: 'requirements_critical_auditor',
        attemptId: String((fixture.request.attemptKey as JsonRecord).attemptId),
        outputDir: 'out',
        provider: 'attacker',
        invokeJudge: async () => {
          throw new Error('provider_must_not_be_invoked');
        },
      } as Parameters<typeof requirementsContractJudgeRunCommand>[0] & { provider: string })
    ).rejects.toThrow('requirements_contract_judge_command_authority_override:provider');
  });

  it('parses the public argv contract without accepting authority-bearing flags', () => {
    expect(
      parseRequirementsContractJudgeRunArgv([
        '--project-root',
        'repo',
        '--config',
        'config.yaml',
        '--request',
        'request.json',
        '--role',
        'requirements_critical_auditor',
        '--attempt-id',
        'attempt-1',
        '--output-dir',
        'out',
        '--json',
      ])
    ).toEqual({
      projectRoot: 'repo',
      config: 'config.yaml',
      request: 'request.json',
      role: 'requirements_critical_auditor',
      attemptId: 'attempt-1',
      outputDir: 'out',
      json: true,
    });
    expect(() =>
      parseRequirementsContractJudgeRunArgv([
        '--project-root',
        'repo',
        '--config',
        'config.yaml',
        '--request',
        'request.json',
        '--role',
        'requirements_critical_auditor',
        '--attempt-id',
        'attempt-1',
        '--output-dir',
        'out',
        '--expected-verdict',
        'pass',
      ])
    ).toThrow('requirements_contract_judge_command_authority_override:expected-verdict');
  });
});
