import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { createClaudeCodeCliJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-claude-code-cli-judge-adapter';
import { prepareRequirementsContractJudgeInvocation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-invocation';

type JsonRecord = Record<string, unknown>;

interface CommandInvocation {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const ROOTS: string[] = [];
const INVOCATION_RECEIPT_SCHEMA_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-invocation-receipt.schema.json'
);

function createRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'claude-code-cli-judge-'));
  ROOTS.push(root);
  return root;
}

function provider(
  model = `route-${randomUUID()}`,
  options: {
    transport?: string;
    adapterRef?: string;
    command?: string;
  } = {}
): JsonRecord {
  return {
    enabled: true,
    transport: options.transport ?? 'claude-code-cli',
    ...(options.adapterRef ? { adapterRef: options.adapterRef } : {}),
    apiStyle: 'cli',
    model,
    credentialRef: 'claude-code-session',
    endpoint: {
      command: options.command ?? 'claude',
      resolutionMode: 'path_search',
      routingOwnership: 'transport_adapter',
      upstreamVersioning: 'cli_managed',
      explicitOperationPath: null,
    },
    authentication: {
      type: 'claude_code_session',
      sensitivity: 'host_managed',
      arbitraryNonEmptyValueAllowed: false,
      sessionRevision: 1,
    },
    auditPolicy: {
      independenceClass: 'different_provider_different_model',
      blindReview: true,
      allowPassAuthority: false,
      toolsAllowed: true,
      allowedTools: ['Read'],
      implementationWritesAllowed: false,
    },
    requestPolicy: {
      timeoutMs: 30_000,
      maximumAttempts: 1,
      structuredResponseRequired: true,
      maxBudgetUsd: 1,
    },
  };
}

function requireCommandInvocation(invocation: CommandInvocation | null): CommandInvocation {
  if (!invocation) {
    throw new Error('test_command_invocation_missing');
  }
  return invocation;
}

function boundRequest(root: string, extra: JsonRecord = {}): JsonRecord {
  const seed = randomUUID();
  const hash = (role: string) =>
    `sha256:${createHash('sha256').update(`${seed}:${role}`, 'utf8').digest('hex')}`;
  const sourceDocument =
    typeof extra.sourceDocument === 'string' && extra.sourceDocument.trim()
      ? extra.sourceDocument
      : path.join('evidence', `${randomUUID()}.md`);
  const sourcePath = path.join(root, sourceDocument);
  if (!existsSync(sourcePath)) {
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, `${randomUUID()}\n`, 'utf8');
  }
  return {
    requestHash: hash('request'),
    sourceDocumentHash: hash('source-document'),
    semanticModelHash: hash('semantic-model'),
    projectionSetHash: hash('projection-set'),
    ...extra,
    sourceDocument,
    sourceBytesHash: `sha256:${createHash('sha256')
      .update(readFileSync(sourcePath))
      .digest('hex')}`,
  };
}

function runNodeChild(invocation: CommandInvocation): Promise<CommandResult> {
  const modelArgIndex = invocation.args.indexOf('--model');
  const requestedModel = modelArgIndex >= 0 ? invocation.args[modelArgIndex + 1]?.trim() : '';
  if (!requestedModel) {
    throw new Error('test_requested_model_missing');
  }
  const childProgram = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const requestedModel = ${JSON.stringify(requestedModel)};
let prompt = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { prompt += chunk; });
process.stdin.on('end', () => {
  const match = /<judge-request-json>\r?\n([\s\S]*?)\r?\n<\/judge-request-json>/u.exec(prompt);
  if (!match) {
    process.stderr.write('request envelope missing');
    process.exitCode = 2;
    return;
  }
  const request = JSON.parse(match[1]);
  const evidence = fs.readFileSync(path.resolve(process.cwd(), request.sourceDocument), 'utf8');
  const assessment = {
    schemaVersion: 'critical-auditor-judge-assessment/v1',
    verdict: evidence.includes('required receipt is missing') ? 'new_valid_gap' : 'insufficient_audit',
    gapCandidates: [{ evidenceObserved: evidence.trim() }],
    validatedGaps: [{ evidenceObserved: evidence.trim() }],
    rejectedGapCandidates: [],
    mutationPressureFindings: [],
    overBroadTaskFindings: [],
    missingProjectionFindings: [],
    invalidProofFindings: [],
    legacyBypassFindings: [],
    sourceMaterializationFindings: [],
    reviewedMustRefs: request.mustRefs,
    reviewedProjectionRefs: ['projection-' + crypto.randomUUID()],
    checkedProjectionGroups: ['source'],
    checkedProjectionQualityRuleCodes: ['quality-' + crypto.randomUUID()],
    priorFindingsDisposition: [],
    falsePositiveProofs: [],
    rationale: 'The isolated child process read the frozen local evidence snapshot.'
  };
  const sessionId = crypto.randomUUID();
  const auxiliaryModel = 'auxiliary-' + crypto.randomUUID();
  const result = {
    type: 'result',
    subtype: 'success',
    is_error: false,
    session_id: sessionId,
    modelUsage: {
      [auxiliaryModel]: { inputTokens: 1, outputTokens: 1 },
      [requestedModel]: { inputTokens: 1, outputTokens: 1 }
    },
    permission_denials: [],
    structured_output: {
      decision: 'block',
      findings: [assessment],
      challengeRequests: [],
      evidenceRefs: [request.sourceDocument]
    }
  };
  process.stdout.write(JSON.stringify({
    type: 'system',
    subtype: 'init',
    model: requestedModel,
    tools: ['Read', 'StructuredOutput'],
    session_id: sessionId
  }) + '\n');
  process.stdout.write(JSON.stringify({
    type: 'assistant',
    message: {
      model: requestedModel,
      content: [{ type: 'text', text: 'evidence inspected' }]
    },
    session_id: sessionId
  }) + '\n');
  process.stdout.write(JSON.stringify(result) + '\n');
});
`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', childProgram], {
      cwd: invocation.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('test_child_timeout'));
    }, invocation.timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (exitCode) => {
      clearTimeout(timeout);
      resolve({ exitCode: exitCode ?? -1, stdout, stderr });
    });
    child.stdin.end(invocation.stdin);
  });
}

afterEach(() => {
  for (const root of ROOTS.splice(0)) {
    rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 50,
    });
  }
});

describe('Claude Code CLI Judge adapter', () => {
  it('uses the configured CLI command and binds the selected adapter into transport evidence', async () => {
    const root = createRoot();
    const outputDir = path.join(root, 'runtime', randomUUID());
    const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
    const mustRef = `must/${randomUUID()}`;
    const request = boundRequest(root, { mustRefs: [mustRef] });
    mkdirSync(path.dirname(requestPath), { recursive: true });
    writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
    const configuredModel = `route-${randomUUID()}`;
    const configuredCommand = `judge-cli-${randomUUID()}`;
    let capturedInvocation: CommandInvocation | null = null;
    const adapter = createClaudeCodeCliJudgeAdapter({
      executeCommand: async (invocation) => {
        capturedInvocation = invocation;
        return runNodeChild(invocation);
      },
    });

    const normalized = (await adapter.judge({
      providerRef: `provider-${randomUUID()}`,
      provider: provider(configuredModel, {
        transport: 'cli',
        adapterRef: 'ClaudeCodeCliJudgeAdapter',
        command: configuredCommand,
      }),
      payload: {
        systemPrompt: 'Inspect the frozen evidence and return the schema-bound decision.',
        request,
        executionContext: {
          projectRoot: root,
          requestPath,
          outputDir,
        },
      },
    })) as JsonRecord;

    const invocation = requireCommandInvocation(capturedInvocation);
    expect(invocation.command).toBe(configuredCommand);
    expect(normalized.transport).toBe('cli');
    expect(normalized.transportEvidence).toMatchObject({
      adapterRef: 'ClaudeCodeCliJudgeAdapter',
      command: configuredCommand,
    });
  });

  it('runs an isolated readonly child process against a frozen local evidence snapshot', async () => {
    const root = createRoot();
    const outputDir = path.join(root, 'runtime', randomUUID());
    const sourceDocument = path.join('evidence', `${randomUUID()}.txt`);
    const sourcePath = path.join(root, sourceDocument);
    const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    mkdirSync(path.dirname(requestPath), { recursive: true });
    writeFileSync(sourcePath, 'required receipt is missing', 'utf8');
    const mustRef = `must/${randomUUID()}`;
    const request = boundRequest(root, {
      sourceDocument,
      mustRefs: [mustRef],
    });
    writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
    const configuredModel = `route-${randomUUID()}`;
    let captured: CommandInvocation | null = null;
    const adapter = createClaudeCodeCliJudgeAdapter({
      executeCommand: async (invocation) => {
        captured = invocation;
        return runNodeChild(invocation);
      },
    });
    const normalized = (await adapter.judge({
      providerRef: 'local-sonnet-judge',
      provider: provider(configuredModel),
      payload: {
        systemPrompt: 'Audit the frozen evidence without mutating it.',
        request,
        executionContext: {
          projectRoot: root,
          requestPath,
          outputDir,
        },
      },
    })) as JsonRecord;

    const capturedInvocation = requireCommandInvocation(captured);
    expect(capturedInvocation.command).toBe('claude');
    expect(capturedInvocation.cwd).not.toBe(root);
    expect(capturedInvocation.args).toEqual(
      expect.arrayContaining([
        '--model',
        configuredModel,
        '--effort',
        'xhigh',
        '--tools',
        'Read',
        '--permission-mode',
        'dontAsk',
        '--output-format',
        'stream-json',
        '--no-session-persistence',
        '--strict-mcp-config',
      ])
    );
    expect(capturedInvocation.args.join(' ')).not.toMatch(/\bWrite\b|\bEdit\b|\bBash\b|\bWeb\b/u);
    const readAllowlistMatch =
      /<judge-read-allowlist-json>\r?\n([\s\S]*?)\r?\n<\/judge-read-allowlist-json>/u.exec(
        capturedInvocation.stdin
      );
    expect(readAllowlistMatch).not.toBeNull();
    const readAllowlist = JSON.parse(readAllowlistMatch?.[1] ?? '[]') as string[];
    expect(readAllowlist).toEqual(
      [
        sourceDocument.replace(/\\/gu, '/'),
        path.relative(root, requestPath).replace(/\\/gu, '/'),
      ].sort()
    );
    expect(readAllowlist).not.toContain(mustRef);
    expect(capturedInvocation.stdin).toContain(
      'Do not call Read with any value that is absent from this allowlist.'
    );
    expect(capturedInvocation.stdin).toContain(
      'Pass each allowlisted path to Read exactly as written; do not prepend a working directory or convert it to an absolute path.'
    );
    expect(capturedInvocation.stdin).toContain(
      'Read every allowlisted file completely before producing a decision.'
    );
    expect(capturedInvocation.stdin).toContain(
      'If Read reports a partial or truncated view, continue reading the same path from the first unread line until EOF.'
    );
    expect(capturedInvocation.stdin).toContain(
      'Do not call StructuredOutput while any allowlisted file still has unread lines.'
    );
    expect(capturedInvocation.stdin).toContain(
      `Before calling StructuredOutput, verify that the set of successfully and completely read paths equals the ${readAllowlist.length}-entry allowlist.`
    );
    expect(capturedInvocation.stdin).toContain(
      'Never pass readPlan.sourcePath or a path found inside judge-request-json to Read unless that exact string is also present in judge-read-allowlist-json.'
    );
    expect(capturedInvocation.stdin).toContain(
      'No allowlisted path is optional, including stdout logs, stderr logs, receipts, prior-round artifacts, and evidence that appears redundant.'
    );
    expect(capturedInvocation.stdin).toContain(
      'Treat requirement refs, projection refs, group IDs, rule codes, hashes, and receipt IDs as opaque data, not file paths.'
    );
    expect(capturedInvocation.stdin).toContain(
      'After reading the evidence, call the system-provided StructuredOutput tool exactly once to return the final schema-bound decision.'
    );
    expect(capturedInvocation.stdin).not.toContain('Use only Read inside that directory.');
    expect(capturedInvocation.stdin).toContain(
      'Assessment verdict must be exactly one of: no_new_valid_gap, no_new_confirmation_blocking_gap, new_valid_gap, insufficient_audit, blocked.'
    );
    const jsonSchemaIndex = capturedInvocation.args.indexOf('--json-schema');
    expect(jsonSchemaIndex).toBeGreaterThanOrEqual(0);
    const structuredOutputSchema = JSON.parse(
      capturedInvocation.args[jsonSchemaIndex + 1] ?? '{}'
    ) as {
      properties?: {
        findings?: {
          items?: {
            properties?: {
              verdict?: {
                enum?: string[];
              };
            };
          };
        };
      };
    };
    expect(structuredOutputSchema.properties?.findings?.items?.properties?.verdict?.enum).toEqual([
      'no_new_valid_gap',
      'no_new_confirmation_blocking_gap',
      'new_valid_gap',
      'insufficient_audit',
      'blocked',
    ]);
    expect(normalized).toMatchObject({
      schemaVersion: 'requirements-contract-normalized-judge-response/v1',
      providerRef: 'local-sonnet-judge',
      transport: 'claude-code-cli',
      configuredModel,
      returnedModel: configuredModel,
      decision: 'block',
    });
    expect(String(normalized.providerRequestId)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
    );
    const evidence = normalized.transportEvidence as JsonRecord;
    expect(evidence).toMatchObject({
      schemaVersion: 'requirements-contract-cli-judge-execution-receipt/v1',
      adapterRef: 'ClaudeCodeCliJudgeAdapter',
      protocol: 'claude_stream_json',
      command: 'claude',
      providerRequestId: normalized.providerRequestId,
      requestedModel: configuredModel,
      observedModel: configuredModel,
      modelObservationSource: 'cli_event',
      decisionBearingModelEvidence: true,
      exitCode: 0,
      executorKind: 'injected_test_transport',
    });
    const receiptSchema = JSON.parse(
      readFileSync(
        path.resolve(
          process.cwd(),
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-cli-judge-execution-receipt.schema.json'
        ),
        'utf8'
      )
    );
    const validateReceipt = new Ajv2020({ allErrors: true, strict: false }).compile(receiptSchema);
    expect(validateReceipt(evidence), JSON.stringify(validateReceipt.errors, null, 2)).toBe(true);
    const invocationReceipt = JSON.parse(
      readFileSync(path.join(outputDir, 'judge-invocation-receipt.json'), 'utf8')
    ) as JsonRecord;
    const validateInvocationReceipt = new Ajv2020({
      allErrors: true,
      strict: false,
    }).compile(JSON.parse(readFileSync(INVOCATION_RECEIPT_SCHEMA_PATH, 'utf8')));
    expect(
      validateInvocationReceipt(invocationReceipt),
      JSON.stringify(validateInvocationReceipt.errors ?? [])
    ).toBe(true);
    expect(invocationReceipt).toMatchObject({
      schemaVersion: 'requirements-contract-judge-invocation-receipt/v1',
      providerRef: 'local-sonnet-judge',
      transport: 'claude-code-cli',
      adapterRef: 'ClaudeCodeCliJudgeAdapter',
      providerRequestId: normalized.providerRequestId,
      outcome: 'decided',
      decision: 'block',
      unknownOutcomeReason: null,
      automaticSemanticRetry: false,
      maximumAttempts: 1,
      attemptOrdinal: 1,
    });
    expect(existsSync(path.join(outputDir, 'claude-code-cli-stdout.jsonl'))).toBe(true);
    expect(existsSync(path.join(outputDir, 'claude-code-cli-stderr.log'))).toBe(true);
    expect(existsSync(path.join(outputDir, 'claude-code-cli-transcript.jsonl'))).toBe(true);
    expect(existsSync(path.join(outputDir, 's', 'snapshot-manifest.json'))).toBe(true);
    expect(readFileSync(path.join(outputDir, 's', sourceDocument), 'utf8')).toBe(
      'required receipt is missing'
    );
  });

  it('records the gateway-selected decision model without treating the request model as provider identity', async () => {
    const root = createRoot();
    const requestPath = path.join(root, `${randomUUID()}.json`);
    const request = boundRequest(root);
    writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
    const sessionId = randomUUID();
    const configuredModel = `route-${randomUUID()}`;
    const decisionModel = `gateway-selected-${randomUUID()}`;
    const structuredOutputId = `structured-${randomUUID()}`;
    const structuredOutput = {
      decision: 'block',
      findings: [{ verdict: 'blocked' }],
      challengeRequests: [],
      evidenceRefs: [],
    };
    const adapter = createClaudeCodeCliJudgeAdapter({
      executeCommand: async () => ({
        exitCode: 0,
        stderr: '',
        stdout: [
          {
            type: 'system',
            subtype: 'init',
            model: configuredModel,
            tools: ['Read', 'StructuredOutput'],
            session_id: sessionId,
          },
          {
            type: 'assistant',
            message: {
              model: decisionModel,
              content: [
                {
                  type: 'tool_use',
                  id: structuredOutputId,
                  name: 'StructuredOutput',
                  input: structuredOutput,
                },
              ],
            },
            session_id: sessionId,
          },
          {
            type: 'result',
            subtype: 'success',
            is_error: false,
            session_id: sessionId,
            modelUsage: {
              [configuredModel]: {},
              [decisionModel]: {},
            },
            permission_denials: [],
            structured_output: structuredOutput,
          },
        ]
          .map((event) => JSON.stringify(event))
          .join('\n')
          .concat('\n'),
      }),
    });

    const normalized = (await adapter.judge({
      providerRef: `gateway-${randomUUID()}`,
      provider: provider(configuredModel),
      payload: {
        systemPrompt: 'Audit only.',
        request,
        executionContext: {
          projectRoot: root,
          requestPath,
          outputDir: path.join(root, 'output'),
        },
      },
    })) as JsonRecord;

    expect(normalized).toMatchObject({
      configuredModel,
      returnedModel: decisionModel,
      decision: 'block',
    });
  });

  it('binds a gateway-routed decision model even when CLI modelUsage retains route labels', async () => {
    const root = createRoot();
    const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
    const request = boundRequest(root);
    mkdirSync(path.dirname(requestPath), { recursive: true });
    writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
    const requestedModel = `route-${randomUUID()}`;
    const decisionModel = `decision-${randomUUID()}`;
    const auxiliaryModel = `auxiliary-${randomUUID()}`;
    const sessionId = randomUUID();
    const structuredOutput = {
      decision: 'block',
      findings: [{ verdict: 'insufficient_audit' }],
      challengeRequests: [],
      evidenceRefs: [],
    };
    const adapter = createClaudeCodeCliJudgeAdapter({
      executeCommand: async () => ({
        exitCode: 0,
        stderr: '',
        stdout: [
          {
            type: 'system',
            subtype: 'init',
            model: requestedModel,
            tools: ['Read', 'StructuredOutput'],
            session_id: sessionId,
          },
          ...Array.from({ length: 3 }, () => ({
            type: 'assistant',
            message: {
              model: decisionModel,
              content: [
                {
                  type: 'tool_use',
                  id: randomUUID(),
                  name: 'StructuredOutput',
                  input: structuredOutput,
                },
              ],
            },
            session_id: sessionId,
          })),
          {
            type: 'result',
            subtype: 'success',
            is_error: false,
            session_id: sessionId,
            modelUsage: {
              [requestedModel]: {},
              [auxiliaryModel]: {},
            },
            permission_denials: [],
            structured_output: structuredOutput,
          },
        ]
          .map((event) => JSON.stringify(event))
          .join('\n')
          .concat('\n'),
      }),
    });
    const routedProvider = {
      ...provider(),
      model: requestedModel,
    };

    const normalized = (await adapter.judge({
      providerRef: `gateway-${randomUUID()}`,
      provider: routedProvider,
      payload: {
        systemPrompt: 'Audit only.',
        request,
        executionContext: {
          projectRoot: root,
          requestPath,
          outputDir: path.join(root, 'output'),
        },
      },
    })) as JsonRecord;

    expect(normalized).toMatchObject({
      configuredModel: requestedModel,
      returnedModel: decisionModel,
      decision: 'block',
    });
  });

  it('resolves gateway credentials into the child environment without exposing them as Judge evidence', async () => {
    const root = createRoot();
    const providerRef = `gateway-${randomUUID()}`;
    const credentialRef = `credential-${randomUUID()}`;
    const decisionModel = `decision-${randomUUID()}`;
    const baseUrl = `https://${randomUUID()}.example.test`;
    const secret = `secret-${randomUUID()}`;
    const credentialRevision = 7;
    const configPath = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
    const credentialPath = path.join(
      root,
      '_bmad-output',
      'config',
      'private',
      'judge-provider.credentials.yaml'
    );
    const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
    const outputDir = path.join(root, 'runtime', randomUUID());
    mkdirSync(path.dirname(configPath), { recursive: true });
    mkdirSync(path.dirname(credentialPath), { recursive: true });
    mkdirSync(path.dirname(requestPath), { recursive: true });
    const request = boundRequest(root);
    writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
    writeFileSync(
      configPath,
      yaml.dump({
        judgeRuntime: {
          schemaVersion: 'requirements-contract-judge-runtime/v1',
          enabled: true,
          activeProviderRef: providerRef,
          selectionPolicy: {
            mode: 'contract_locked',
            runtimeFallbackAllowed: false,
            runtimeAutoDiscoveryAllowed: false,
            environmentOverrideAllowed: false,
            cliTransportAllowed: true,
            selectionReceiptRequired: true,
          },
          credentialConfig: {
            source: 'config_file',
            path: '_bmad-output/config/private/judge-provider.credentials.yaml',
            schemaVersion: 'requirements-contract-judge-credentials/v1',
            allowedRoot: '_bmad-output/config/private',
            environmentFallbackAllowed: false,
          },
          providers: {
            [providerRef]: {
              enabled: true,
              transport: 'claude-code-cli',
              apiStyle: 'cli',
              credentialRef,
              endpoint: {
                command: 'claude',
                baseUrl,
                resolutionMode: 'path_search',
                routingOwnership: 'transport_adapter',
                upstreamVersioning: 'gateway_managed',
                explicitOperationPath: null,
              },
              authentication: {
                type: 'bearer',
                sensitivity: 'secret',
                arbitraryNonEmptyValueAllowed: false,
              },
              auditPolicy: {
                independenceClass: `independent-${randomUUID()}`,
                blindReview: true,
                allowPassAuthority: false,
                toolsAllowed: true,
                allowedTools: ['Read'],
                implementationWritesAllowed: false,
              },
              requestPolicy: {
                timeoutMs: 30_000,
                maximumAttempts: 1,
                structuredResponseRequired: true,
              },
            },
          },
        },
      }),
      'utf8'
    );
    writeFileSync(
      credentialPath,
      yaml.dump({
        schemaVersion: 'requirements-contract-judge-credentials/v1',
        credentialRevision,
        providers: {
          [credentialRef]: {
            authenticationType: 'bearer',
            apiKey: secret,
          },
        },
      }),
      'utf8'
    );
    let captured: CommandInvocation | null = null;
    const sessionId = randomUUID();
    const structuredOutput = {
      decision: 'block',
      findings: [{ verdict: 'blocked' }],
      challengeRequests: [],
      evidenceRefs: [],
    };
    const prepared = await prepareRequirementsContractJudgeInvocation({
      projectRoot: root,
      config: path.relative(root, configPath),
      executeClaudeCodeCliCommand: async (invocation) => {
        captured = invocation;
        return {
          exitCode: 0,
          stderr: '',
          stdout: [
            {
              type: 'assistant',
              message: {
                model: decisionModel,
                content: [
                  {
                    type: 'tool_use',
                    id: randomUUID(),
                    name: 'StructuredOutput',
                    input: structuredOutput,
                  },
                ],
              },
              session_id: sessionId,
            },
            {
              type: 'result',
              subtype: 'success',
              is_error: false,
              session_id: sessionId,
              modelUsage: { [decisionModel]: {} },
              permission_denials: [],
              structured_output: structuredOutput,
            },
          ]
            .map((event) => JSON.stringify(event))
            .join('\n')
            .concat('\n'),
        };
      },
    });
    const normalized = await prepared.invoke({
      systemPrompt: 'Audit only.',
      request,
      executionContext: { projectRoot: root, requestPath, outputDir },
    });
    const capturedInvocation = requireCommandInvocation(captured);

    expect(prepared).toMatchObject({ providerRef, credentialProviderRef: providerRef });
    expect(prepared.credentialRevision).toBe(credentialRevision);
    expect(capturedInvocation.env).toMatchObject({
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_AUTH_TOKEN: secret,
    });
    expect(JSON.stringify(capturedInvocation.args)).not.toContain(secret);
    expect(capturedInvocation.stdin).not.toContain(secret);
    expect(JSON.stringify(normalized)).not.toContain(secret);
    expect(capturedInvocation.args).not.toContain('--model');
    expect(normalized).toMatchObject({
      providerRef,
      configuredModel: null,
      returnedModel: decisionModel,
      transportEvidence: {
        requestedModel: null,
        credentialRevision,
        credentialEnvironmentVariable: 'ANTHROPIC_AUTH_TOKEN',
      },
    });
  });

  it('rejects a cli-managed provider when its requested model is absent', async () => {
    const root = createRoot();
    const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
    const request = boundRequest(root);
    mkdirSync(path.dirname(requestPath), { recursive: true });
    writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
    const cliManagedProvider = provider();
    delete cliManagedProvider.model;
    const adapter = createClaudeCodeCliJudgeAdapter({
      executeCommand: async () => {
        throw new Error('test_cli_managed_provider_must_not_spawn');
      },
    });

    await expect(
      adapter.judge({
        providerRef: `cli-${randomUUID()}`,
        provider: cliManagedProvider,
        payload: {
          systemPrompt: 'Audit only.',
          request,
          executionContext: {
            projectRoot: root,
            requestPath,
            outputDir: path.join(root, 'output'),
          },
        },
      })
    ).rejects.toThrow('claude_code_cli_judge_model_missing');
  });

  it('materializes oversized evidence as complete hash-bound read segments', async () => {
    const root = createRoot();
    const outputDir = path.join(root, 'runtime', randomUUID());
    const sourceDocument = path.join('evidence', `${randomUUID()}.md`);
    const sourcePath = path.join(root, sourceDocument);
    const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    mkdirSync(path.dirname(requestPath), { recursive: true });
    const sourceText = `${Array.from(
      { length: 4_096 },
      (_value, index) => `line-${index}:${'evidence'.repeat(8)}`
    ).join('\n')}\n`;
    const sourceBytes = Buffer.from(sourceText, 'utf8');
    writeFileSync(sourcePath, sourceBytes);
    const request = boundRequest(root, {
      sourceDocument,
      mustRefs: [`must/${randomUUID()}`],
    });
    writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
    const configuredModel = `route-${randomUUID()}`;

    let observedReadPlan: JsonRecord[] = [];
    const adapter = createClaudeCodeCliJudgeAdapter({
      executeCommand: async (invocation) => {
        const allowlistMatch =
          /<judge-read-allowlist-json>\r?\n([\s\S]*?)\r?\n<\/judge-read-allowlist-json>/u.exec(
            invocation.stdin
          );
        const readPlanMatch =
          /<judge-read-plan-json>\r?\n([\s\S]*?)\r?\n<\/judge-read-plan-json>/u.exec(
            invocation.stdin
          );
        if (!allowlistMatch || !readPlanMatch) {
          throw new Error('test_judge_read_plan_missing');
        }
        const allowlist = JSON.parse(allowlistMatch[1]) as string[];
        observedReadPlan = JSON.parse(readPlanMatch[1]) as JsonRecord[];
        const sourceRelativePath = sourceDocument.replace(/\\/gu, '/');
        const sourcePlan = observedReadPlan.find(
          (candidate) => candidate.sourcePath === sourceRelativePath
        );
        expect(sourcePlan).toBeDefined();
        const segments = sourcePlan?.segments as JsonRecord[];
        expect(segments.length).toBeGreaterThan(1);
        expect(allowlist).not.toContain(sourceRelativePath);
        expect(allowlist).toEqual(
          observedReadPlan
            .flatMap((candidate) =>
              (candidate.segments as JsonRecord[]).map((segment) => String(segment.path))
            )
            .sort()
        );

        let nextByte = 0;
        const reconstructed = Buffer.concat(
          segments.map((segment) => {
            expect(segment.startByte).toBe(nextByte);
            const content = readFileSync(path.join(invocation.cwd, String(segment.path)));
            expect(segment.bytes).toBe(content.byteLength);
            expect(segment.hash).toBe(
              `sha256:${createHash('sha256').update(content).digest('hex')}`
            );
            nextByte = Number(segment.endByteExclusive);
            return content;
          })
        );
        expect(nextByte).toBe(sourceBytes.byteLength);
        expect(reconstructed.equals(sourceBytes)).toBe(true);
        expect(sourcePlan?.sourceBytes).toBe(sourceBytes.byteLength);
        expect(sourcePlan?.sourceHash).toBe(
          `sha256:${createHash('sha256').update(sourceBytes).digest('hex')}`
        );

        const sessionId = randomUUID();
        return {
          exitCode: 0,
          stderr: '',
          stdout: `${JSON.stringify({
            type: 'result',
            subtype: 'success',
            is_error: false,
            session_id: sessionId,
            modelUsage: {
              [configuredModel]: { inputTokens: 1, outputTokens: 1 },
            },
            permission_denials: [],
            structured_output: {
              decision: 'block',
              findings: [
                {
                  schemaVersion: 'critical-auditor-judge-assessment/v1',
                  verdict: 'blocked',
                },
              ],
              challengeRequests: [],
              evidenceRefs: [sourceRelativePath],
            },
          })}\n`,
        };
      },
    });

    const normalized = await adapter.judge({
      providerRef: 'local-sonnet-judge',
      provider: provider(configuredModel),
      payload: {
        systemPrompt: 'Audit only.',
        request,
        executionContext: {
          projectRoot: root,
          requestPath,
          outputDir,
        },
      },
    });
    const manifest = JSON.parse(
      readFileSync(path.join(outputDir, 's', 'snapshot-manifest.json'), 'utf8')
    ) as JsonRecord;
    expect(manifest.schemaVersion).toBe('requirements-contract-judge-evidence-snapshot/v2');
    expect(manifest.readPlan).toEqual(observedReadPlan);
    expect(normalized).toMatchObject({
      schemaVersion: 'requirements-contract-normalized-judge-response/v1',
      decision: 'block',
    });
  });

  it.skipIf(process.platform !== 'win32')(
    'runs from a bounded ephemeral snapshot when the canonical snapshot exceeds the Windows path limit',
    async () => {
      const root = createRoot();
      const sourceDocument = path.join(
        '_bmad-output',
        'runtime',
        'requirement-records',
        `REQ-${randomUUID()}`.toUpperCase(),
        'authoring',
        'staging',
        `CATX-${randomUUID().replaceAll('-', '')}`,
        'pre-render-must-decomposition-gate-dry-run-round-1-reconciliation.json'
      );
      const sourcePath = path.join(root, sourceDocument);
      const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
      mkdirSync(path.dirname(sourcePath), { recursive: true });
      mkdirSync(path.dirname(requestPath), { recursive: true });
      writeFileSync(sourcePath, 'required receipt is missing', 'utf8');
      const request = boundRequest(root, {
        sourceDocument,
        mustRefs: [`must/${randomUUID()}`],
      });
      writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
      const outputDir = path.join(
        root,
        'runtime',
        ...Array.from({ length: 6 }, () => randomUUID())
      );
      expect(path.join(outputDir, 's').length).toBeGreaterThanOrEqual(260);
      expect(sourceDocument.length).toBeGreaterThan(200);
      let captured: CommandInvocation | null = null;
      const adapter = createClaudeCodeCliJudgeAdapter({
        executeCommand: async (invocation) => {
          captured = invocation;
          return runNodeChild(invocation);
        },
      });

      const normalized = await adapter.judge({
        providerRef: 'local-sonnet-judge',
        provider: provider(),
        payload: {
          systemPrompt: 'Audit only.',
          request,
          executionContext: {
            projectRoot: root,
            requestPath,
            outputDir,
          },
        },
      });

      const capturedInvocation = requireCommandInvocation(captured);
      expect(capturedInvocation.cwd.length).toBeLessThan(260);
      expect(capturedInvocation.cwd).not.toBe(path.join(outputDir, 's'));
      expect(existsSync(capturedInvocation.cwd)).toBe(false);
      expect(existsSync(path.join(outputDir, 's', 'snapshot-manifest.json'))).toBe(true);
      expect(readFileSync(path.join(outputDir, 's', sourceDocument), 'utf8')).toBe(
        'required receipt is missing'
      );
      expect(normalized).toMatchObject({
        schemaVersion: 'requirements-contract-normalized-judge-response/v1',
        decision: 'block',
      });
    }
  );

  it.skipIf(process.platform !== 'win32')(
    'remaps deeply nested prior-round evidence into bounded hash-bound snapshot segments',
    async () => {
      const root = createRoot();
      const sourceDocument = path.join('evidence', `${randomUUID()}.md`);
      const sourcePath = path.join(root, sourceDocument);
      const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
      const outputDir = path.join(root, 'runtime', randomUUID());
      const priorRoundPathParts = [
        '_bmad-output',
        'runtime',
        'requirement-records',
        `REQ-${randomUUID()}`.toUpperCase(),
        'authoring',
        'staging',
        `CATX-${randomUUID().replaceAll('-', '')}`,
        'j',
        '1',
        'r',
        randomUUID().replaceAll('-', ''),
        's',
      ];
      while (
        path.join(tmpdir(), 'j-XXXXXX', ...priorRoundPathParts, 'prior-round-evidence.json')
          .length < 280
      ) {
        priorRoundPathParts.push(randomUUID().replaceAll('-', ''));
      }
      const priorRoundEvidence = path.join(...priorRoundPathParts, 'prior-round-evidence.json');
      const priorRoundEvidencePath = path.join(root, priorRoundEvidence);
      mkdirSync(path.dirname(sourcePath), { recursive: true });
      mkdirSync(path.dirname(requestPath), { recursive: true });
      mkdirSync(path.dirname(priorRoundEvidencePath), { recursive: true });
      writeFileSync(sourcePath, 'required receipt is missing', 'utf8');
      writeFileSync(
        priorRoundEvidencePath,
        `${JSON.stringify({ observed: randomUUID() })}\n`,
        'utf8'
      );
      const request = boundRequest(root, {
        sourceDocument,
        previousRoundEvidence: [{ evidencePath: priorRoundEvidence }],
      });
      writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
      expect(path.join(tmpdir(), 'j-XXXXXX', priorRoundEvidence).length).toBeGreaterThanOrEqual(
        260
      );

      let captured: CommandInvocation | null = null;
      const adapter = createClaudeCodeCliJudgeAdapter({
        executeCommand: async (invocation) => {
          captured = invocation;
          return runNodeChild(invocation);
        },
      });

      const normalized = await adapter.judge({
        providerRef: `provider-${randomUUID()}`,
        provider: provider(),
        payload: {
          systemPrompt: 'Audit only.',
          request,
          executionContext: {
            projectRoot: root,
            requestPath,
            outputDir,
          },
        },
      });
      const capturedInvocation = requireCommandInvocation(captured);

      const manifest = JSON.parse(
        readFileSync(path.join(outputDir, 's', 'snapshot-manifest.json'), 'utf8')
      ) as JsonRecord;
      const priorRoundPlan = (manifest.readPlan as JsonRecord[]).find(
        (entry) => entry.sourcePath === priorRoundEvidence.replace(/\\/gu, '/')
      );
      expect(priorRoundPlan).toBeDefined();
      expect((priorRoundPlan?.segments as JsonRecord[]).map((segment) => segment.path)).toEqual([
        expect.stringMatching(/^_judge-read-segments\/[a-f0-9]{64}\/0001\.part$/u),
      ]);
      expect(capturedInvocation.cwd.length).toBeLessThan(260);
      expect(normalized).toMatchObject({
        schemaVersion: 'requirements-contract-normalized-judge-response/v1',
        decision: 'block',
      });
    }
  );

  it('fails closed when the CLI reports a denied tool request', async () => {
    const root = createRoot();
    const requestPath = path.join(root, `${randomUUID()}.json`);
    const request = boundRequest(root);
    writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
    const configuredModel = `route-${randomUUID()}`;
    const adapter = createClaudeCodeCliJudgeAdapter({
      executeCommand: async () => ({
        exitCode: 0,
        stderr: '',
        stdout: `${JSON.stringify({
          type: 'result',
          subtype: 'success',
          is_error: false,
          session_id: randomUUID(),
          modelUsage: { [configuredModel]: {} },
          permission_denials: [{ tool_name: 'Write' }],
          structured_output: {
            decision: 'pass',
            findings: [],
            challengeRequests: [],
            evidenceRefs: [],
          },
        })}\n`,
      }),
    });

    await expect(
      adapter.judge({
        providerRef: 'local-sonnet-judge',
        provider: provider(configuredModel),
        payload: {
          systemPrompt: 'Audit only.',
          request,
          executionContext: {
            projectRoot: root,
            requestPath,
            outputDir: path.join(root, 'runtime', randomUUID()),
          },
        },
      })
    ).rejects.toThrow(/claude_code_cli_judge_permission_denied/u);
  });
});
