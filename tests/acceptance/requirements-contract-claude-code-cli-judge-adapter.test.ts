import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
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
import { afterEach, describe, expect, it } from 'vitest';
import { createClaudeCodeCliJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-claude-code-cli-judge-adapter';

type JsonRecord = Record<string, unknown>;

interface CommandInvocation {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const ROOTS: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'claude-code-cli-judge-'));
  ROOTS.push(root);
  return root;
}

function provider(): JsonRecord {
  return {
    enabled: true,
    transport: 'claude-code-cli',
    apiStyle: 'cli',
    model: 'claude-sonnet-5',
    credentialRef: 'claude-code-session',
    endpoint: {
      command: 'claude',
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

function runNodeChild(invocation: CommandInvocation): Promise<CommandResult> {
  const childProgram = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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
  const result = {
    type: 'result',
    subtype: 'success',
    is_error: false,
    session_id: crypto.randomUUID(),
    modelUsage: { 'claude-sonnet-5': { inputTokens: 1, outputTokens: 1 } },
    permission_denials: [],
    structured_output: {
      decision: 'block',
      findings: [assessment],
      challengeRequests: [],
      evidenceRefs: [request.sourceDocument]
    }
  };
  process.stdout.write(JSON.stringify({ type: 'assistant', message: 'evidence inspected' }) + '\n');
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
    rmSync(root, { recursive: true, force: true });
  }
});

describe('Claude Code CLI Judge adapter', () => {
  it('runs an isolated readonly child process against a frozen local evidence snapshot', async () => {
    const root = createRoot();
    const outputDir = path.join(root, 'runtime', randomUUID());
    const sourceDocument = path.join('evidence', `${randomUUID()}.txt`);
    const sourcePath = path.join(root, sourceDocument);
    const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    mkdirSync(path.dirname(requestPath), { recursive: true });
    writeFileSync(sourcePath, 'required receipt is missing', 'utf8');
    writeFileSync(requestPath, '{}', 'utf8');
    let captured: CommandInvocation | null = null;
    const adapter = createClaudeCodeCliJudgeAdapter({
      executeCommand: async (invocation) => {
        captured = invocation;
        return runNodeChild(invocation);
      },
    });
    const mustRef = `must/${randomUUID()}`;

    const normalized = (await adapter.judge({
      providerRef: 'local-sonnet-judge',
      provider: provider(),
      payload: {
        systemPrompt: 'Audit the frozen evidence without mutating it.',
        request: {
          sourceDocument,
          mustRefs: [mustRef],
        },
        executionContext: {
          projectRoot: root,
          requestPath,
          outputDir,
        },
      },
    })) as JsonRecord;

    expect(captured).not.toBeNull();
    expect(captured?.command).toBe('claude');
    expect(captured?.cwd).not.toBe(root);
    expect(captured?.args).toEqual(
      expect.arrayContaining([
        '--model',
        'claude-sonnet-5',
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
    expect(captured?.args.join(' ')).not.toMatch(/\bWrite\b|\bEdit\b|\bBash\b|\bWeb\b/u);
    const readAllowlistMatch =
      /<judge-read-allowlist-json>\r?\n([\s\S]*?)\r?\n<\/judge-read-allowlist-json>/u.exec(
        captured?.stdin ?? ''
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
    expect(captured?.stdin).toContain(
      'Do not call Read with any value that is absent from this allowlist.'
    );
    expect(captured?.stdin).toContain(
      'Pass each allowlisted path to Read exactly as written; do not prepend a working directory or convert it to an absolute path.'
    );
    expect(captured?.stdin).toContain(
      'Treat requirement refs, projection refs, group IDs, rule codes, hashes, and receipt IDs as opaque data, not file paths.'
    );
    expect(captured?.stdin).toContain(
      'Assessment verdict must be exactly one of: no_new_valid_gap, no_new_confirmation_blocking_gap, new_valid_gap, insufficient_audit, blocked.'
    );
    const jsonSchemaIndex = captured?.args.indexOf('--json-schema') ?? -1;
    expect(jsonSchemaIndex).toBeGreaterThanOrEqual(0);
    const structuredOutputSchema = JSON.parse(captured?.args[jsonSchemaIndex + 1] ?? '{}') as {
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
    expect(
      structuredOutputSchema.properties?.findings?.items?.properties?.verdict?.enum
    ).toEqual([
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
      configuredModel: 'claude-sonnet-5',
      returnedModel: 'claude-sonnet-5',
      decision: 'block',
    });
    expect(String(normalized.providerRequestId)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
    );
    const evidence = normalized.transportEvidence as JsonRecord;
    expect(evidence).toMatchObject({
      schemaVersion: 'requirements-contract-claude-code-cli-execution/v1',
      command: 'claude',
      requestedModel: 'claude-sonnet-5',
      exitCode: 0,
      executorKind: 'injected_test_transport',
    });
    expect(existsSync(path.join(outputDir, 'claude-code-cli-stdout.jsonl'))).toBe(true);
    expect(existsSync(path.join(outputDir, 'claude-code-cli-stderr.log'))).toBe(true);
    expect(existsSync(path.join(outputDir, 'claude-code-cli-transcript.jsonl'))).toBe(true);
    expect(existsSync(path.join(outputDir, 'evidence-snapshot', 'snapshot-manifest.json'))).toBe(
      true
    );
    expect(
      readFileSync(path.join(outputDir, 'evidence-snapshot', sourceDocument), 'utf8')
    ).toBe('required receipt is missing');
  });

  it.skipIf(process.platform !== 'win32')(
    'fails closed before spawning when the frozen snapshot cwd exceeds the Windows path limit',
    async () => {
      const root = createRoot();
      const requestPath = path.join(root, 'requests', `${randomUUID()}.json`);
      mkdirSync(path.dirname(requestPath), { recursive: true });
      writeFileSync(requestPath, '{}', 'utf8');
      const outputDir = path.join(
        root,
        'runtime',
        ...Array.from({ length: 6 }, () => randomUUID())
      );
      expect(path.join(outputDir, 'evidence-snapshot').length).toBeGreaterThanOrEqual(260);
      const adapter = createClaudeCodeCliJudgeAdapter();

      await expect(
        adapter.judge({
          providerRef: 'local-sonnet-judge',
          provider: provider(),
          payload: {
            systemPrompt: 'Audit only.',
            request: {},
            executionContext: {
              projectRoot: root,
              requestPath,
              outputDir,
            },
          },
        })
      ).rejects.toThrow('claude_code_cli_judge_cwd_path_too_long');
    }
  );

  it('fails closed when the CLI reports a denied tool request', async () => {
    const root = createRoot();
    const requestPath = path.join(root, `${randomUUID()}.json`);
    writeFileSync(requestPath, '{}', 'utf8');
    const adapter = createClaudeCodeCliJudgeAdapter({
      executeCommand: async () => ({
        exitCode: 0,
        stderr: '',
        stdout: `${JSON.stringify({
          type: 'result',
          subtype: 'success',
          is_error: false,
          session_id: randomUUID(),
          modelUsage: { 'claude-sonnet-5': {} },
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
        provider: provider(),
        payload: {
          systemPrompt: 'Audit only.',
          request: {},
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
