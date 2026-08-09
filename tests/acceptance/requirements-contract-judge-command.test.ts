import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseRequirementsContractJudgeRunArgv,
  requirementsContractJudgeRunCommand,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-command';
import { evaluateRequirementsContractJudgeInvocationReadiness } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-invocation-readiness-gate';
import { createRequirementsContractJudgeProviderRegistry } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-provider-registry';
import type { RequirementsContractJudgeRole } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-role';
import {
  canonicalJson,
  sha256,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;

const roots: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
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

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('test_record_expected');
  }
  return value as JsonRecord;
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
        model: transport === 'cli' ? null : `model-${randomUUID()}`,
        credentialRef: providerRef,
        endpoint: {
          ...(command ? { command } : {}),
          ...(transport === 'claude-code-cli'
            ? {}
            : { baseUrl: `https://${randomUUID()}.example.test` }),
          resolutionMode:
            transport === 'cli' || transport === 'claude-code-cli'
              ? 'path_search'
              : 'transport_managed',
          routingOwnership: 'transport_adapter',
          upstreamVersioning: transport === 'claude-code-cli' ? 'cli_managed' : 'gateway_managed',
          explicitOperationPath: null,
        },
        authentication: {
          type:
            transport === 'claude-code-cli'
              ? 'claude_code_session'
              : transport === 'anthropic-compatible'
                ? 'api_key'
                : 'bearer',
          sensitivity: transport === 'claude-code-cli' ? 'host_managed' : 'secret',
          arbitraryNonEmptyValueAllowed: false,
          ...(transport === 'claude-code-cli' ? { sessionRevision: 1 } : {}),
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
  const provider = record(record(runtime.providers)[providerRef]);
  const registry = createRequirementsContractJudgeProviderRegistry({
    judgeRuntime: runtime,
    runtime,
  });
  const sourceAuthorityHash = sha256(`source-authority-${randomUUID()}`);
  const sourceContent = '# Requirement Source\n\n- MUST pass.\n';
  const sourceDocumentHash = sha256(sourceContent);
  const sourceBytesHash = sha256(sourceContent);
  const semanticModelHash = sha256(`semantic-${randomUUID()}`);
  const projectionSetHash = sha256(`projection-${randomUUID()}`);
  const scopeManifestHash = sha256(`scope-${randomUUID()}`);
  const systemPrompt = 'Return one JSON object.';
  const structuredOutputSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['decision'],
    properties: {
      decision: { enum: ['pass', 'block', 'inconclusive'] },
    },
  };
  const promptTemplateHash = sha256(systemPrompt);
  const assessmentSchemaHash = sha256(canonicalJson(structuredOutputSchema));
  const attemptKey = {
    schemaVersion: 'requirements-contract-judge-attempt-key/v1',
    attemptId: `attempt-${randomUUID()}`,
    actorClass:
      role === 'requirements_critical_auditor'
        ? 'requirements_critical_auditor_judge'
        : 'final_acceptance_judge',
    judgeRole: role,
    sourceAuthorityHash,
    scopeManifestHash,
    promptTemplateHash,
    assessmentSchemaHash,
    providerRegistryHash: registry.registryHash,
    providerConfigurationHash: sha256Stable(provider),
    ledgerNamespace: role === 'requirements_critical_auditor' ? 'requirements' : 'final_acceptance',
    previousAttemptKeyHash: null,
    attemptOrdinal: 1,
    attemptKeyHash: sha256(`attempt-key-${randomUUID()}`),
  };
  const requestAuthority = {
    schemaVersion: 'requirements-contract-canonical-judge-request/v1',
    role,
    sourceDocument: 'source.md',
    sourceAuthorityHash,
    sourceDocumentHash,
    sourceBytesHash,
    semanticModelHash,
    projectionSetHash,
    scopeManifestHash,
    attemptKey,
    systemPrompt,
    payload: { requirementSetId: `REQ-${randomUUID()}` },
    structuredOutputSchema,
  };
  writeFileSync(path.join(root, 'source.md'), sourceContent, 'utf8');
  const requestHash = sha256(canonicalJson(requestAuthority));
  const readinessReceipt = evaluateRequirementsContractJudgeInvocationReadiness({
    role: 'requirements',
    attemptId: attemptKey.attemptId,
    scope: {
      requestHash,
      sourceDocumentHash,
      semanticModelHash,
      projectionSetHash,
      scopeHash: scopeManifestHash,
    },
    providerRegistryHash: registry.registryHash,
    credentialBindingHash: sha256(`credential-${randomUUID()}`),
    promptHash: promptTemplateHash,
    schemaHash: assessmentSchemaHash,
    policyHash: sha256(`policy-${randomUUID()}`),
    ledgerHash: sha256(`ledger-${randomUUID()}`),
    auditUnitSetHash: sha256(`audit-units-${randomUUID()}`),
    vetoSetHash: sha256(`veto-${randomUUID()}`),
  });
  const request = {
    ...requestAuthority,
    requestHash,
    readinessReceipt,
  };
  mkdirSync(path.join(root, 'private'), { recursive: true });
  writeFileSync(
    path.join(root, 'config.yaml'),
    yaml.dump({ judgeRuntime: runtime }, { lineWidth: 120 }),
    'utf8'
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

function normalizedJudgeResponse(decision: 'pass' | 'block' | 'inconclusive'): JsonRecord {
  return {
    decision,
    findings: [],
    challengeRequests: [],
    evidenceRefs: [],
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function resealRequestEnvelope(request: JsonRecord): void {
  const readinessReceipt = record(request.readinessReceipt);
  delete request.requestHash;
  delete request.readinessReceipt;
  const requestHash = sha256(canonicalJson(request));
  request.requestHash = requestHash;
  request.readinessReceipt = evaluateRequirementsContractJudgeInvocationReadiness({
    role: 'requirements',
    attemptId: String(record(request.attemptKey).attemptId),
    scope: {
      requestHash,
      sourceDocumentHash: request.sourceDocumentHash,
      semanticModelHash: request.semanticModelHash,
      projectionSetHash: request.projectionSetHash,
      scopeHash: request.scopeManifestHash,
    },
    providerRegistryHash: String(readinessReceipt.providerRegistryHash),
    credentialBindingHash: String(readinessReceipt.credentialBindingHash),
    promptHash: String(readinessReceipt.promptHash),
    schemaHash: String(readinessReceipt.schemaHash),
    policyHash: String(readinessReceipt.policyHash),
    ledgerHash: String(readinessReceipt.ledgerHash),
    auditUnitSetHash: String(readinessReceipt.auditUnitSetHash),
    vetoSetHash: String(readinessReceipt.vetoSetHash),
  });
}

describe('canonical requirements contract judge run command', () => {
  it.each([
    ['openai-compatible', 'OpenAICompatibleJudgeAdapter', undefined],
    ['anthropic-compatible', 'AnthropicCompatibleJudgeAdapter', undefined],
    ['claude-code-cli', 'ClaudeCodeCliJudgeAdapter', 'claude'],
    ['cli', 'CodexCliJudgeAdapter', 'codex'],
  ])(
    'routes %s through the real provider-registry adapter with JSON/process status parity',
    async (transport, adapterRef, command) => {
      const fixture = materializeCommandFixture(transport, adapterRef, command);
      const outputDir = path.join(fixture.root, 'out');
      let invocationCount = 0;
      vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
        invocationCount += 1;
        const body = JSON.parse(String(init.body));
        if (transport === 'openai-compatible') {
          return jsonResponse({
            id: `openai-${randomUUID()}`,
            model: body.model,
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
          });
        }
        return jsonResponse({
          id: `anthropic-${randomUUID()}`,
          model: body.model,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                decision: 'pass',
                findings: [],
                challengeRequests: [],
                evidenceRefs: [],
              }),
            },
          ],
        });
      });
      const result = await requirementsContractJudgeRunCommand({
        projectRoot: fixture.root,
        config: 'config.yaml',
        request: 'request.json',
        role: 'requirements_critical_auditor',
        attemptId: String((fixture.request.attemptKey as JsonRecord).attemptId),
        outputDir,
        json: true,
        executeClaudeCodeCliCommand: async () => {
          invocationCount += 1;
          return {
            exitCode: 0,
            stdout: [
              JSON.stringify({ type: 'system', subtype: 'init', model: 'model-test' }),
              JSON.stringify({
                type: 'assistant',
                message: {
                  model: 'model-test',
                  content: [{ type: 'tool_use', name: 'StructuredOutput' }],
                },
              }),
              JSON.stringify({
                type: 'result',
                subtype: 'success',
                is_error: false,
                session_id: randomUUID(),
                permission_denials: [],
                modelUsage: { 'model-test': { input_tokens: 1, output_tokens: 1 } },
                structured_output: normalizedJudgeResponse('pass'),
              }),
            ].join('\n'),
            stderr: '',
            processId: 101,
          };
        },
        executeCodexCliCommand: async (invocation) => {
          invocationCount += 1;
          writeJson(invocation.outputPath, normalizedJudgeResponse('pass'));
          return {
            exitCode: 0,
            stdout: [
              JSON.stringify({
                type: 'thread.started',
                thread_id: `thread-${randomUUID()}`,
                model: 'model-test',
              }),
              JSON.stringify({ type: 'turn.completed', model: 'model-test' }),
            ].join('\n'),
            stderr: '',
            processId: 202,
            commandResolution: 'injected_test_transport',
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
        requestHash: fixture.request.requestHash,
        decision: 'pass',
      });
      const receipt = JSON.parse(
        readFileSync(path.join(outputDir, 'judge-run-result.json'), 'utf8')
      );
      expect(receipt).toMatchObject({
        command: 'bmad-speckit judge run',
        processExitCode: 0,
        processStatusParity: true,
        requestHash: fixture.request.requestHash,
        decision: 'pass',
      });
    }
  );

  it('runs Final Acceptance when the expected-role pin matches the request authority', async () => {
      const fixture = materializeCommandFixture(
        'claude-code-cli',
        'ClaudeCodeCliJudgeAdapter',
        'claude',
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
        executeClaudeCodeCliCommand: async () => {
          invocationCount += 1;
          return {
            exitCode: 0,
            stdout: [
              JSON.stringify({ type: 'system', subtype: 'init', model: 'model-test' }),
              JSON.stringify({
                type: 'assistant',
                message: {
                  model: 'model-test',
                  content: [{ type: 'tool_use', name: 'StructuredOutput' }],
                },
              }),
              JSON.stringify({
                type: 'result',
                subtype: 'success',
                is_error: false,
                session_id: randomUUID(),
                permission_denials: [],
                modelUsage: { 'model-test': { input_tokens: 1, output_tokens: 1 } },
                structured_output: normalizedJudgeResponse('pass'),
              }),
            ].join('\n'),
            stderr: '',
            processId: 303,
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
        executeCodexCliCommand: async () => {
          invocationCount += 1;
          throw new Error('provider_must_not_be_invoked');
        },
      })
    ).rejects.toThrow('requirements_contract_judge_command_role_pin_mismatch');
    expect(invocationCount).toBe(0);
  });

  it('rejects request paths whose real path escapes the project root', async () => {
    const fixture = materializeCommandFixture('cli', 'CodexCliJudgeAdapter', 'codex');
    const externalRoot = createRoot();
    writeJson(path.join(externalRoot, 'request.json'), fixture.request);
    symlinkSync(
      externalRoot,
      path.join(fixture.root, 'linked-request-root'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    let invocationCount = 0;

    await expect(
      requirementsContractJudgeRunCommand({
        projectRoot: fixture.root,
        config: 'config.yaml',
        request: 'linked-request-root/request.json',
        role: 'requirements_critical_auditor',
        attemptId: String((fixture.request.attemptKey as JsonRecord).attemptId),
        outputDir: 'out',
        executeCodexCliCommand: async () => {
          invocationCount += 1;
          throw new Error('provider_must_not_be_invoked');
        },
      })
    ).rejects.toThrow('requirements_contract_judge_command_request_path_escape');
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
        executeCodexCliCommand: async () => {
          throw new Error('provider_must_not_be_invoked');
        },
      } as Parameters<typeof requirementsContractJudgeRunCommand>[0] & { provider: string })
    ).rejects.toThrow('requirements_contract_judge_command_authority_override:provider');
  });

  it('blocks stale request, prompt, schema, provider, and scope bindings before provider invocation', async () => {
    const fixture = materializeCommandFixture('cli', 'CodexCliJudgeAdapter', 'codex');
    const cases: Array<[string, (request: JsonRecord) => void, RegExp]> = [
      [
        'request',
        (request) => {
          request.requestHash = sha256(`tampered-request-${randomUUID()}`);
        },
        /requirements_contract_judge_(?:command_request_hash_mismatch|readiness_stale:requestHash)/,
      ],
      [
        'prompt',
        (request) => {
          request.systemPrompt = 'Tampered prompt.';
          resealRequestEnvelope(request);
        },
        /requirements_contract_judge_command_prompt_hash_mismatch/,
      ],
      [
        'schema',
        (request) => {
          (record(request.structuredOutputSchema).properties as JsonRecord).unexpected = {
            type: 'string',
          };
          resealRequestEnvelope(request);
        },
        /requirements_contract_judge_command_schema_hash_mismatch/,
      ],
      [
        'provider registry',
        (request) => {
          record(request.attemptKey).providerRegistryHash = sha256(`stale-registry-${randomUUID()}`);
          resealRequestEnvelope(request);
        },
        /requirements_contract_judge_command_provider_registry_hash_mismatch/,
      ],
      [
        'scope',
        (request) => {
          request.scopeManifestHash = sha256(`stale-scope-${randomUUID()}`);
          resealRequestEnvelope(request);
        },
        /requirements_contract_judge_command_scope_mismatch/,
      ],
    ];

    for (const [name, tamper, error] of cases) {
      const caseRoot = createRoot();
      const caseRequest = JSON.parse(JSON.stringify(fixture.request)) as JsonRecord;
      tamper(caseRequest);
      writeFileSync(path.join(caseRoot, 'config.yaml'), readFileSync(path.join(fixture.root, 'config.yaml')));
      mkdirSync(path.join(caseRoot, 'private'), { recursive: true });
      writeFileSync(
        path.join(caseRoot, 'private/credentials.yaml'),
        readFileSync(path.join(fixture.root, 'private/credentials.yaml'))
      );
      writeJson(path.join(caseRoot, 'request.json'), caseRequest);
      let invocationCount = 0;
      await expect(
        requirementsContractJudgeRunCommand({
          projectRoot: caseRoot,
          config: 'config.yaml',
          request: 'request.json',
          role: 'requirements_critical_auditor',
          attemptId: String(record(caseRequest.attemptKey).attemptId),
          outputDir: 'out',
          executeCodexCliCommand: async () => {
            invocationCount += 1;
            throw new Error(`provider_must_not_be_invoked:${name}`);
          },
        })
      ).rejects.toThrow(error);
      expect(invocationCount).toBe(0);
    }
  });

  it('maps non-pass adapter decisions to nonzero JSON/process parity', async () => {
    const fixture = materializeCommandFixture('cli', 'CodexCliJudgeAdapter', 'codex');
    const result = await requirementsContractJudgeRunCommand({
      projectRoot: fixture.root,
      config: 'config.yaml',
      request: 'request.json',
      role: 'requirements_critical_auditor',
      attemptId: String((fixture.request.attemptKey as JsonRecord).attemptId),
      outputDir: 'out',
      executeCodexCliCommand: async (invocation) => {
        writeJson(invocation.outputPath, normalizedJudgeResponse('block'));
        return {
          exitCode: 0,
          stdout: [
            JSON.stringify({
              type: 'thread.started',
              thread_id: `thread-${randomUUID()}`,
              model: 'model-test',
            }),
            JSON.stringify({ type: 'turn.completed', model: 'model-test' }),
          ].join('\n'),
          stderr: '',
          processId: 404,
          commandResolution: 'injected_test_transport',
        };
      },
    });

    expect(result).toMatchObject({
      jsonDecision: 'block',
      processExitCode: 1,
      processStatusParity: true,
      decision: 'block',
    });
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
    for (const flag of [
      '--provider-ref',
      '--api-key',
      '--system-prompt',
      '--structured-output-schema',
      '--unexpected',
    ]) {
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
          flag,
          'attacker',
        ])
      ).toThrow(`requirements_contract_judge_command_arg_forbidden:${flag.slice(2)}`);
    }
  });
});
