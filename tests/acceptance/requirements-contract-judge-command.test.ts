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
import { createRequirementsContractJudgeProviderRegistry } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-provider-registry';
import { buildRequirementsContractJudgeRequest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-request-identity';
import {
  createRequirementsContractJudgeSelectionReceipt,
  resolveRequirementsContractJudgeAdapterRef,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-selection';
import { sha256 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;

const roots: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  roots.splice(0).forEach((root) =>
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );
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
  command?: string
) {
  const root = createRoot();
  const runtime = judgeRuntime(transport, adapterRef, command);
  const providerRef = String(runtime.activeProviderRef);
  const provider = record(record(runtime.providers)[providerRef]);
  const registry = createRequirementsContractJudgeProviderRegistry({
    judgeRuntime: runtime,
    runtime,
  });
  const systemPrompt = 'Return one JSON object.';
  const structuredOutputSchema = {
    type: 'object',
    additionalProperties: false,
    required: [
      'schemaVersion',
      'judgeRequestHash',
      'verdict',
      'findings',
      'advisoryObservations',
      'checkedDimensionIds',
      'dimensionResults',
      'reviewedArtifactRefs',
      'reviewedMustRefs',
      'insufficientAuditReasons',
    ],
    properties: {
      schemaVersion: { const: 'requirements-contract-judge-response/v2' },
      judgeRequestHash: { type: 'string' },
      verdict: { enum: ['pass', 'fail'] },
      findings: { type: 'array' },
      advisoryObservations: { type: 'array' },
      checkedDimensionIds: { type: 'array' },
      dimensionResults: { type: 'array' },
      reviewedArtifactRefs: { type: 'array' },
      reviewedMustRefs: { type: 'array' },
      insufficientAuditReasons: { type: 'array' },
    },
  };
  const providerSelection = createRequirementsContractJudgeSelectionReceipt({
    providerRef,
    provider,
    adapterRef,
    providerRegistryHash: String(registry.registryHash),
  });
  const request = buildRequirementsContractJudgeRequest({
    authority: {
      semanticRevisionId: `SEM-${randomUUID()}`,
      scopeSemanticHash: sha256(`scope-${randomUUID()}`),
      bindingRevisionId: `BIND-${randomUUID()}`,
      sourceBindingHash: sha256(`binding-${randomUUID()}`),
      authoringAttemptId: `AUTHOR-${randomUUID()}`,
      buildManifestHash: sha256(`build-${randomUUID()}`),
    },
    providerSelection,
    prompt: {
      systemPrompt,
      rubric: { mandatoryDimensionIds: ['business-rule-completeness'] },
      structuredOutputSchema,
      outputTokenReserve: 2048,
    },
    auditPacket: {
      schemaVersion: 'requirements-contract-judge-audit-packet/v1',
      body: {
        artifactIds: ['final-markdown'],
        requirementIds: ['MUST-001'],
        mandatoryDimensionIds: ['business-rule-completeness'],
      },
    },
    auditPacketArtifactManifest: [
      {
        artifactId: 'final-markdown',
        path: 'artifacts/final.md',
        hash: sha256('final-markdown'),
      },
    ],
    remediation: null,
  });
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
    providerSelection,
    attemptId: `attempt-${randomUUID()}`,
  };
}

function normalizedJudgeResponse(
  request: JsonRecord,
  verdict: 'pass' | 'fail' = 'pass'
): JsonRecord {
  const body = record(record(request.auditPacket).body);
  const dimensionIds = body.mandatoryDimensionIds as string[];
  return {
    schemaVersion: 'requirements-contract-judge-response/v2',
    judgeRequestHash: request.judgeRequestHash,
    verdict,
    findings:
      verdict === 'pass'
        ? []
        : [
            {
              findingId: 'F-001',
              severity: 'Major',
              summary: 'Required rule is missing from the projection.',
              affectedMustRefs: ['MUST-001'],
              affectedArtifactRefs: ['final-markdown'],
              logicalEvidenceRefs: ['MUST-001'],
            },
          ],
    advisoryObservations: [],
    checkedDimensionIds: dimensionIds,
    dimensionResults: dimensionIds.map((dimensionId) => ({
      dimensionId,
      decision: verdict === 'pass' ? 'pass' : 'fail',
      findingRefs: verdict === 'pass' ? [] : ['F-001'],
    })),
    reviewedArtifactRefs: body.artifactIds,
    reviewedMustRefs: body.requirementIds,
    insufficientAuditReasons: [],
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function resealRequest(request: JsonRecord): JsonRecord {
  return buildRequirementsContractJudgeRequest({
    authority: record(request.authority),
    providerSelection: record(request.providerSelection),
    prompt: record(request.prompt),
    auditPacket: record(request.auditPacket),
    auditPacketArtifactManifest: request.auditPacketArtifactManifest as JsonRecord[],
    remediation: request.remediation as JsonRecord | null,
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
                    ...normalizedJudgeResponse(fixture.request),
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
                ...normalizedJudgeResponse(fixture.request),
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
        attemptId: fixture.attemptId,
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
                structured_output: normalizedJudgeResponse(fixture.request),
              }),
            ].join('\n'),
            stderr: '',
            processId: 101,
          };
        },
        executeCodexCliCommand: async (invocation) => {
          invocationCount += 1;
          writeJson(invocation.outputPath, normalizedJudgeResponse(fixture.request));
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
        schemaVersion: 'requirements-contract-judge-command-result/v2',
        command: 'bmad-speckit judge run',
        role: 'requirements_critical_auditor',
        processExitCode: 0,
        verdict: 'pass',
        processStatusParity: true,
        providerRef: fixture.providerRef,
        adapterRef,
        judgeRequestHash: fixture.request.judgeRequestHash,
      });
      const receipt = JSON.parse(
        readFileSync(path.join(outputDir, 'judge-run-result.json'), 'utf8')
      );
      expect(receipt).toMatchObject({
        command: 'bmad-speckit judge run',
        processExitCode: 0,
        processStatusParity: true,
        judgeRequestHash: fixture.request.judgeRequestHash,
        verdict: 'pass',
      });
    }
  );

  it('rejects the removed Final Acceptance role before provider invocation', async () => {
    const fixture = materializeCommandFixture('cli', 'CodexCliJudgeAdapter', 'codex');
    let invocationCount = 0;

    await expect(
      requirementsContractJudgeRunCommand({
        projectRoot: fixture.root,
        config: 'config.yaml',
        request: 'request.json',
        role: 'final_acceptance_judge',
        attemptId: fixture.attemptId,
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
        attemptId: fixture.attemptId,
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
        attemptId: fixture.attemptId,
        outputDir: 'out',
        provider: 'attacker',
        executeCodexCliCommand: async () => {
          throw new Error('provider_must_not_be_invoked');
        },
      } as Parameters<typeof requirementsContractJudgeRunCommand>[0] & { provider: string })
    ).rejects.toThrow('requirements_contract_judge_command_authority_override:provider');
  });

  it('blocks mutated request content and frozen provider selection before provider invocation', async () => {
    const fixture = materializeCommandFixture('cli', 'CodexCliJudgeAdapter', 'codex');
    const cases: Array<[string, (request: JsonRecord) => void, RegExp]> = [
      [
        'self hash',
        (request) => {
          request.judgeRequestHash = sha256(`tampered-request-${randomUUID()}`);
        },
        /requirements_contract_judge_request_hash_mismatch/,
      ],
      [
        'prompt',
        (request) => {
          record(request.prompt).systemPrompt = 'Tampered prompt.';
        },
        /requirements_contract_judge_request_hash_mismatch/,
      ],
      [
        'schema',
        (request) => {
          (record(record(request.prompt).structuredOutputSchema).properties as JsonRecord).unexpected = {
            type: 'string',
          };
        },
        /requirements_contract_judge_request_hash_mismatch/,
      ],
      [
        'provider selection content',
        (request) => {
          record(request.providerSelection).providerConfigurationHash = sha256(
            `stale-provider-${randomUUID()}`
          );
        },
        /requirements_contract_judge_request_hash_mismatch/,
      ],
      [
        'frozen provider selection',
        (request) => {
          const selection = record(request.providerSelection);
          selection.providerConfigurationHash = sha256(`stale-provider-${randomUUID()}`);
          Object.assign(request, resealRequest(request));
        },
        /requirements_contract_judge_frozen_selection_mismatch/,
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
          attemptId: fixture.attemptId,
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

  it('maps fail verdicts to nonzero JSON/process parity', async () => {
    const fixture = materializeCommandFixture('cli', 'CodexCliJudgeAdapter', 'codex');
    const result = await requirementsContractJudgeRunCommand({
      projectRoot: fixture.root,
      config: 'config.yaml',
      request: 'request.json',
      role: 'requirements_critical_auditor',
      attemptId: fixture.attemptId,
      outputDir: 'out',
      executeCodexCliCommand: async (invocation) => {
        writeJson(invocation.outputPath, normalizedJudgeResponse(fixture.request, 'fail'));
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
      verdict: 'fail',
      processExitCode: 1,
      processStatusParity: true,
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

  it('preserves an explicit Claude adapter identity for the generic CLI transport', () => {
    expect(
      resolveRequirementsContractJudgeAdapterRef({
        transport: 'cli',
        adapterRef: 'ClaudeCodeCliJudgeAdapter',
      })
    ).toBe('ClaudeCodeCliJudgeAdapter');
  });
});
