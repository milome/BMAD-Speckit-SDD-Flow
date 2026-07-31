import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { afterEach, describe, expect, it } from 'vitest';

type JsonRecord = Record<string, unknown>;
type CommandInvocation = {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
  outputPath: string;
};
type CodexAdapterFactory = (dependencies?: {
  executeCommand?: (invocation: CommandInvocation) => Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    processId?: number;
  }>;
  readCredentialSecret?: (credential: unknown) => string;
}) => {
  judge(input: JsonRecord): Promise<JsonRecord>;
};

const INVOCATION_RECEIPT_SCHEMA_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-invocation-receipt.schema.json'
);
const CODEX_ADAPTER_PATH = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-codex-cli-judge-adapter.ts'
);
const ROOTS: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'judge-invocation-receipt-'));
  ROOTS.push(root);
  return root;
}

function hash(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function freshHash(label: string): string {
  return hash(`${label}:${randomUUID()}`);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value as JsonRecord)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as JsonRecord)[key])}`)
    .join(',')}}`;
}

function withReceiptHash(receipt: JsonRecord): JsonRecord {
  const unsigned = { ...receipt };
  delete unsigned.receiptHash;
  return {
    ...unsigned,
    receiptHash: hash(stableStringify(unsigned)),
  };
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

async function loadCodexAdapter(): Promise<CodexAdapterFactory> {
  const loaded = (await import(pathToFileURL(CODEX_ADAPTER_PATH).href)) as JsonRecord;
  const factory = loaded.createCodexCliJudgeAdapter as CodexAdapterFactory | undefined;
  expect(factory).toBeTypeOf('function');
  if (!factory) throw new Error('codex_adapter_factory_missing');
  return factory;
}

afterEach(() => {
  for (const root of ROOTS.splice(0)) {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

describe('Judge invocation receipt', () => {
  it('defines the shared decision-bearing invocation receipt schema', () => {
    expect(
      existsSync(INVOCATION_RECEIPT_SCHEMA_PATH),
      `invocation receipt schema is missing: ${INVOCATION_RECEIPT_SCHEMA_PATH}`
    ).toBe(true);
    if (!existsSync(INVOCATION_RECEIPT_SCHEMA_PATH)) return;

    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      JSON.parse(readFileSync(INVOCATION_RECEIPT_SCHEMA_PATH, 'utf8'))
    );
    const receipt = withReceiptHash({
      schemaVersion: 'requirements-contract-judge-invocation-receipt/v1',
      invocationId: randomUUID(),
      providerRef: `provider-${randomUUID()}`,
      transport: 'cli',
      adapterRef: 'CodexCliJudgeAdapter',
      providerRequestId: randomUUID(),
      outcome: 'decided',
      decision: 'block',
      unknownOutcomeReason: null,
      automaticSemanticRetry: false,
      maximumAttempts: 1,
      attemptOrdinal: 1,
      normalizedResponseHash: freshHash('normalized-response'),
      transportEvidenceHash: freshHash('transport-evidence'),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    expect(validate(receipt), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(
      validate(
        withReceiptHash({
          ...receipt,
          outcome: 'unknown',
          decision: 'inconclusive',
          unknownOutcomeReason: 'codex_cli_judge_model_observation_missing',
        })
      ),
      JSON.stringify(validate.errors ?? [])
    ).toBe(true);
    expect(
      validate(
        withReceiptHash({
          ...receipt,
          outcome: 'unknown',
          automaticSemanticRetry: true,
        })
      ),
      'unknown outcomes must not schedule automatic semantic retry'
    ).toBe(false);
  });

  it('persists an unknown-outcome receipt before failing closed without model evidence', async () => {
    const createAdapter = await loadCodexAdapter();
    const root = createRoot();
    const outputDir = path.join(root, 'runtime', randomUUID());
    const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
    const evidencePath = path.join(root, 'evidence', `${randomUUID()}.txt`);
    mkdirSync(path.dirname(requestPath), { recursive: true });
    mkdirSync(path.dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, 'Independent local evidence.', 'utf8');
    const request = {
      requestHash: freshHash('request'),
      evidenceRef: path.relative(root, evidencePath).replace(/\\/gu, '/'),
    };
    writeFileSync(requestPath, `${JSON.stringify(request)}\n`, 'utf8');
    const selectedProvider = provider();
    const providerRef = `provider-${randomUUID()}`;
    const adapter = createAdapter({
      readCredentialSecret: () => `secret-${randomUUID()}`,
      executeCommand: async (invocation) => {
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

    const receiptPath = path.join(outputDir, 'judge-invocation-receipt.json');
    expect(existsSync(receiptPath)).toBe(true);
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as JsonRecord;
    expect(receipt).toMatchObject({
      schemaVersion: 'requirements-contract-judge-invocation-receipt/v1',
      providerRef,
      transport: 'cli',
      adapterRef: 'CodexCliJudgeAdapter',
      outcome: 'unknown',
      decision: 'inconclusive',
      unknownOutcomeReason: 'codex_cli_judge_model_observation_missing',
      automaticSemanticRetry: false,
      maximumAttempts: 1,
      attemptOrdinal: 1,
    });
    const receiptHash = String(receipt.receiptHash);
    const unsigned = { ...receipt };
    delete unsigned.receiptHash;
    expect(receiptHash).toBe(hash(stableStringify(unsigned)));
  });
});
