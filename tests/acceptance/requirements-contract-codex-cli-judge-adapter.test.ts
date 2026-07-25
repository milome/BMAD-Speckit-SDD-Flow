import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { afterEach, describe, expect, it } from 'vitest';

type JsonRecord = Record<string, unknown>;
type CodexArgsBuilder = (input: {
  cwd: string;
  outputSchemaPath: string;
  outputLastMessagePath: string;
  configuredModel: string | null;
}) => string[];
type CodexCommandInvocation = {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
  outputPath: string;
};
type CodexAdapterFactory = (dependencies?: {
  executeCommand?: (
    invocation: CodexCommandInvocation
  ) => Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    processId?: number;
  }>;
  readCredentialSecret?: (credential: unknown) => string;
}) => {
  judge(input: JsonRecord): Promise<JsonRecord>;
};

const ADAPTER_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-codex-cli-judge-adapter.ts'
);
const CLI_EXECUTION_RECEIPT_SCHEMA_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-cli-judge-execution-receipt.schema.json'
);
const NORMALIZED_RESPONSE_SCHEMA_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-normalized-judge-response.schema.json'
);
const ROOTS: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'codex-cli-judge-adapter-'));
  ROOTS.push(root);
  return root;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function provider(): JsonRecord {
  return {
    enabled: true,
    transport: 'cli',
    adapterRef: 'CodexCliJudgeAdapter',
    apiStyle: 'cli',
    model: null,
    credentialRef: `credential-${randomUUID()}`,
    endpoint: {
      command: 'codex',
      baseUrl: `https://${randomUUID()}.example.test`,
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
      independenceClass: 'different_provider_different_model',
      blindReview: true,
      allowPassAuthority: false,
      toolsAllowed: true,
      allowedTools: ['Read'],
      implementationWritesAllowed: false,
    },
    requestPolicy: {
      timeoutMs: 10_000,
      maximumAttempts: 1,
      structuredResponseRequired: true,
    },
  };
}

async function loadAdapter(): Promise<JsonRecord | null> {
  expect(existsSync(ADAPTER_PATH), `Codex CLI Judge adapter is missing: ${ADAPTER_PATH}`).toBe(
    true
  );
  if (!existsSync(ADAPTER_PATH)) return null;
  return (await import(pathToFileURL(ADAPTER_PATH).href)) as JsonRecord;
}

afterEach(() => {
  for (const root of ROOTS.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

describe('Codex CLI Judge adapter', () => {
  it('builds the real Codex non-interactive argv without Claude CLI flags', async () => {
    const loaded = await loadAdapter();
    if (!loaded) return;
    const buildArgs = loaded.buildCodexCliJudgeArgs as CodexArgsBuilder | undefined;
    expect(buildArgs).toBeTypeOf('function');
    if (!buildArgs) return;

    const cwd = path.resolve('.codex-tmp', randomUUID());
    const outputSchemaPath = path.join(cwd, `${randomUUID()}.schema.json`);
    const outputLastMessagePath = path.join(cwd, `${randomUUID()}.response.json`);
    const args = buildArgs({
      cwd,
      outputSchemaPath,
      outputLastMessagePath,
      configuredModel: null,
    });

    expect(args.slice(0, 3)).toEqual(['--ask-for-approval', 'never', 'exec']);
    expect(args).toEqual(
      expect.arrayContaining([
        '--sandbox',
        'read-only',
        '--ephemeral',
        '--skip-git-repo-check',
        '--output-schema',
        outputSchemaPath,
        '--output-last-message',
        outputLastMessagePath,
        '--json',
        '--cd',
        cwd,
        '-',
      ])
    );
    expect(args.at(-1)).toBe('-');
    expect(args).not.toEqual(
      expect.arrayContaining([
        '--print',
        '--effort',
        '--tools',
        '--permission-mode',
        '--output-format',
        '--json-schema',
        '--no-session-persistence',
      ])
    );
  });

  it('defines an adapter-neutral CLI execution receipt schema', () => {
    expect(
      existsSync(CLI_EXECUTION_RECEIPT_SCHEMA_PATH),
      `CLI execution receipt schema is missing: ${CLI_EXECUTION_RECEIPT_SCHEMA_PATH}`
    ).toBe(true);
    if (!existsSync(CLI_EXECUTION_RECEIPT_SCHEMA_PATH)) return;

    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      JSON.parse(readFileSync(CLI_EXECUTION_RECEIPT_SCHEMA_PATH, 'utf8'))
    );
    const token = randomUUID();
    const hash = `sha256:${token.replace(/-/gu, '').padEnd(64, '0').slice(0, 64)}`;
    const receipt = {
      schemaVersion: 'requirements-contract-cli-judge-execution-receipt/v1',
      adapterRef: 'CodexCliJudgeAdapter',
      protocol: 'codex_exec_jsonl',
      command: 'codex',
      argv: ['--ask-for-approval', 'never', 'exec', '--json', '-'],
      commandResolution: 'injected_test_transport',
      launchCommand: null,
      launchCommandHash: null,
      launchArgv: null,
      launchEntryPath: null,
      launchEntryHash: null,
      cwd: path.resolve('.codex-tmp', token),
      executorKind: 'injected_test_transport',
      processId: null,
      providerRequestId: token,
      requestedModel: null,
      observedModel: null,
      modelObservationSource: 'unavailable',
      decisionBearingModelEvidence: false,
      credentialRevision: 1,
      credentialEnvironmentVariable: 'OPENAI_API_KEY',
      runtimeHomePath: `${token}.runtime-home`,
      runtimeConfigHash: hash,
      exitCode: 0,
      stdoutPath: `${token}.stdout.jsonl`,
      stdoutHash: hash,
      stderrPath: `${token}.stderr.log`,
      stderrHash: hash,
      transcriptPath: `${token}.transcript.jsonl`,
      transcriptHash: hash,
      outputPath: `${token}.response.json`,
      outputHash: hash,
      structuredOutputSchemaPath: `${token}.schema.json`,
      structuredOutputSchemaHash: hash,
      snapshotManifestPath: `${token}.snapshot.json`,
      snapshotHash: hash,
      sessionId: null,
      initModel: null,
      modelUsageModels: [],
    };

    expect(validate(receipt), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(
      validate({
        ...receipt,
        adapterRef: 'ClaudeCodeCliJudgeAdapter',
      }),
      'Codex protocol receipts must not be accepted under the Claude adapter identity'
    ).toBe(false);
  });

  it('keeps the normalized response receipt projection aligned with the shared schema', () => {
    const sharedSchema = JSON.parse(
      readFileSync(CLI_EXECUTION_RECEIPT_SCHEMA_PATH, 'utf8')
    ) as JsonRecord;
    const normalizedSchema = JSON.parse(
      readFileSync(NORMALIZED_RESPONSE_SCHEMA_PATH, 'utf8')
    ) as JsonRecord;
    const projectedSharedSchema = { ...sharedSchema };
    delete projectedSharedSchema.$schema;
    delete projectedSharedSchema.$id;
    delete projectedSharedSchema.$defs;
    const normalizedDefinitions = normalizedSchema.$defs as JsonRecord;

    expect(normalizedDefinitions.cliJudgeExecutionReceipt).toEqual(projectedSharedSchema);
  });

  it('does not import or invoke the Claude CLI Judge adapter', () => {
    const source = readFileSync(ADAPTER_PATH, 'utf8');

    expect(source).not.toContain('requirements-contract-claude-code-cli-judge-adapter');
    expect(source).not.toContain('ClaudeCodeCliJudgeAdapter');
  });

  it('executes through Codex transport, persists the common receipt, and fails closed without observed model evidence', async () => {
    const loaded = await loadAdapter();
    if (!loaded) return;
    const createAdapter = loaded.createCodexCliJudgeAdapter as
      | CodexAdapterFactory
      | undefined;
    expect(createAdapter).toBeTypeOf('function');
    if (!createAdapter) return;

    const root = createRoot();
    const outputDir = path.join(root, 'runtime', randomUUID());
    const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
    const evidencePath = path.join(root, 'evidence', `${randomUUID()}.txt`);
    mkdirSync(path.dirname(requestPath), { recursive: true });
    mkdirSync(path.dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, 'Independent local evidence.', 'utf8');
    const request = {
      requestHash: `sha256:${randomUUID().replace(/-/gu, '').padEnd(64, '0').slice(0, 64)}`,
      evidenceRef: path.relative(root, evidencePath).replace(/\\/gu, '/'),
    };
    writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
    let captured: CodexCommandInvocation | null = null;
    const adapter = createAdapter({
      readCredentialSecret: () => `secret-${randomUUID()}`,
      executeCommand: async (invocation) => {
        captured = invocation;
        mkdirSync(path.dirname(invocation.outputPath), { recursive: true });
        writeFileSync(
          invocation.outputPath,
          `${JSON.stringify({
            decision: 'block',
            findings: [],
            challengeRequests: [],
            evidenceRefs: [request.evidenceRef],
          })}\n`,
          'utf8'
        );
        return {
          exitCode: 0,
          stdout: `${JSON.stringify({
            type: 'thread.started',
            thread_id: randomUUID(),
          })}\n${JSON.stringify({
            type: 'turn.completed',
            usage: { input_tokens: 1, output_tokens: 1 },
          })}\n`,
          stderr: '',
        };
      },
    });
    const selectedProvider = provider();
    const providerRef = `provider-${randomUUID()}`;

    await expect(
      adapter.judge({
        providerRef,
        provider: selectedProvider,
        credential: {
          providerRef,
          credentialRef: selectedProvider.credentialRef,
          authenticationType: 'bearer',
          credentialRevision: 1,
        },
        payload: {
          systemPrompt: 'Audit the frozen evidence and return only the structured decision.',
          request,
          executionContext: {
            projectRoot: root,
            requestPath,
            outputDir,
          },
        },
      })
    ).rejects.toThrow('codex_cli_judge_model_observation_missing');

    const invocation = captured as CodexCommandInvocation | null;
    expect(invocation).not.toBeNull();
    expect(invocation?.command).toBe('codex');
    expect(invocation?.args).toContain('exec');
    expect(invocation?.args).not.toEqual(
      expect.arrayContaining(['--print', '--effort', '--permission-mode'])
    );
    expect(path.resolve(String(invocation?.env.CODEX_HOME))).toBe(
      path.resolve(outputDir, 'codex-home')
    );

    const receiptPath = path.join(outputDir, 'cli-judge-execution-receipt.json');
    expect(existsSync(receiptPath)).toBe(true);
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as JsonRecord;
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      JSON.parse(readFileSync(CLI_EXECUTION_RECEIPT_SCHEMA_PATH, 'utf8'))
    );
    expect(validate(receipt), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(receipt).toMatchObject({
      adapterRef: 'CodexCliJudgeAdapter',
      protocol: 'codex_exec_jsonl',
      command: 'codex',
      executorKind: 'injected_test_transport',
      commandResolution: 'injected_test_transport',
      launchCommand: null,
      launchCommandHash: null,
      launchArgv: null,
      launchEntryPath: null,
      launchEntryHash: null,
      observedModel: null,
      modelObservationSource: 'unavailable',
      decisionBearingModelEvidence: false,
      exitCode: 0,
    });
  });

  it.skipIf(process.platform !== 'win32')(
    'resolves a Windows npm Codex shim to its JavaScript entry without shell execution',
    async () => {
      const loaded = await loadAdapter();
      if (!loaded) return;
      const createAdapter = loaded.createCodexCliJudgeAdapter as
        | CodexAdapterFactory
        | undefined;
      expect(createAdapter).toBeTypeOf('function');
      if (!createAdapter) return;

      const root = createRoot();
      const binRoot = path.join(root, 'bin');
      const codexEntry = path.join(
        binRoot,
        'node_modules',
        '@openai',
        'codex',
        'bin',
        'codex.js'
      );
      const outputDir = path.join(root, 'runtime', randomUUID());
      const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
      const evidencePath = path.join(root, 'evidence', `${randomUUID()}.txt`);
      const observedModel = `gateway-model-${randomUUID()}`;
      mkdirSync(path.dirname(codexEntry), { recursive: true });
      mkdirSync(path.dirname(requestPath), { recursive: true });
      mkdirSync(path.dirname(evidencePath), { recursive: true });
      writeFileSync(path.join(binRoot, 'codex.cmd'), '@exit /b 0\r\n', 'utf8');
      writeFileSync(
        codexEntry,
        [
          "const fs = require('node:fs');",
          "const path = require('node:path');",
          'const args = process.argv.slice(2);',
          "const outputIndex = args.indexOf('--output-last-message');",
          'if (outputIndex < 0 || !args[outputIndex + 1]) process.exit(64);',
          'const outputPath = path.resolve(process.cwd(), args[outputIndex + 1]);',
          'fs.mkdirSync(path.dirname(outputPath), { recursive: true });',
          `fs.writeFileSync(outputPath, ${JSON.stringify(
            `${JSON.stringify({
              decision: 'block',
              findings: [],
              challengeRequests: [],
              evidenceRefs: [],
            })}\n`
          )}, 'utf8');`,
          `process.stdout.write(${JSON.stringify(
            `${JSON.stringify({
              type: 'thread.started',
              thread_id: randomUUID(),
              model: observedModel,
            })}\n${JSON.stringify({
              type: 'turn.completed',
              model: observedModel,
              usage: { input_tokens: 1, output_tokens: 1 },
            })}\n`
          )});`,
        ].join('\n'),
        'utf8'
      );
      writeFileSync(evidencePath, 'Independent local evidence.', 'utf8');
      const request = {
        requestHash: `sha256:${randomUUID().replace(/-/gu, '').padEnd(64, '0').slice(0, 64)}`,
        evidenceRef: path.relative(root, evidencePath).replace(/\\/gu, '/'),
      };
      writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
      const selectedProvider = provider();
      const providerRef = `provider-${randomUUID()}`;
      const pathEnvironmentKey =
        Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
      const previousPath = process.env[pathEnvironmentKey];
      process.env[pathEnvironmentKey] = [binRoot, previousPath ?? ''].join(path.delimiter);

      try {
        const result = await createAdapter({
          readCredentialSecret: () => `secret-${randomUUID()}`,
        }).judge({
          providerRef,
          provider: selectedProvider,
          credential: {
            providerRef,
            credentialRef: selectedProvider.credentialRef,
            authenticationType: 'bearer',
            credentialRevision: 1,
          },
          payload: {
            systemPrompt: 'Audit the frozen evidence and return only the structured decision.',
            request,
            executionContext: {
              projectRoot: root,
              requestPath,
              outputDir,
            },
          },
        });

        expect(result).toMatchObject({
          returnedModel: observedModel,
          decision: 'block',
        });
        const receipt = JSON.parse(
          readFileSync(path.join(outputDir, 'cli-judge-execution-receipt.json'), 'utf8')
        ) as JsonRecord;
        expect(receipt).toMatchObject({
          adapterRef: 'CodexCliJudgeAdapter',
          command: 'codex',
          executorKind: 'native_spawn',
          commandResolution: 'windows_npm_shim',
          launchCommand: path.resolve(process.execPath),
          launchCommandHash: sha256File(process.execPath),
          launchEntryPath: path.resolve(codexEntry),
          launchEntryHash: sha256File(codexEntry),
          observedModel,
          modelObservationSource: 'cli_event',
          decisionBearingModelEvidence: true,
          exitCode: 0,
        });
        expect(receipt.launchArgv).toEqual([
          path.resolve(codexEntry),
          ...((receipt.argv as unknown[]) ?? []).map(String),
        ]);
        expect(receipt.processId).toEqual(expect.any(Number));
      } finally {
        if (previousPath === undefined) delete process.env[pathEnvironmentKey];
        else process.env[pathEnvironmentKey] = previousPath;
      }
    }
  );
});
