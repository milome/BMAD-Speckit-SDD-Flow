import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCodexCliJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-codex-cli-judge-adapter';
import { createClaudeCodeCliJudgeAdapter } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-claude-code-cli-judge-adapter';
import { canonicalJson } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-governed-write';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function fixture(kind: 'codex' | 'claude') {
  const root = mkdtempSync(path.join(tmpdir(), 'judge-preflight-test-only-'));
  roots.push(root);
  const executeCommand = vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' }));
  const readCredentialSecret = vi.fn(() => { throw new Error('test-only-secret-must-not-be-read'); });
  const adapter = kind === 'codex'
    ? createCodexCliJudgeAdapter({ executeCommand, readCredentialSecret })
    : createClaudeCodeCliJudgeAdapter({ executeCommand });
  const request = { judgeRequestHash: `sha256:${'a'.repeat(64)}`, text: '\u4e2d\u6587\ud83d\ude00"\\\n'.repeat(32) };
  const input = {
    providerRef: 'test-only-provider', credential: {},
    provider: {
      transport: 'cli', apiStyle: 'cli',
      adapterRef: kind === 'codex' ? 'CodexCliJudgeAdapter' : 'ClaudeCodeCliJudgeAdapter',
      model: null,
      endpoint: {
        command: kind, baseUrl: 'https://test-only.invalid',
        resolutionMode: 'path_search', routingOwnership: 'transport_adapter',
        upstreamVersioning: 'gateway_managed', explicitOperationPath: null,
      },
      authentication: { type: 'bearer', sensitivity: 'secret', arbitraryNonEmptyValueAllowed: false },
      auditPolicy: {
        blindReview: true, allowPassAuthority: false, toolsAllowed: true,
        allowedTools: ['Read'], implementationWritesAllowed: false,
      },
      requestPolicy: { timeoutMs: 1000, maximumAttempts: 1, transportByteLimit: 1048576 },
    },
    payload: {
      systemPrompt: 'Test-only complete source review.', request,
      executionContext: {
        projectRoot: root, requestPath: 'request.json', outputDir: 'transport',
        requestFileContent: `${canonicalJson(request)}\n`,
      },
      structuredOutputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
  };
  return { root, input, adapter, executeCommand, readCredentialSecret };
}

describe.each(['codex', 'claude'] as const)('%s CLI pure payload preflight', (kind) => {
  it('plans the not-yet-published request without filesystem, credential or process side effects', () => {
    const test = fixture(kind);
    const before = test.adapter.preflight(test.input);
    expect(before.serializedPayloadBytes).toBeGreaterThan(Buffer.byteLength(JSON.stringify(test.input.payload.request)));
    expect(before.auxiliaryPayloadBytes).toBeGreaterThan(0);
    expect(before.contextWindowCheck).toBe('not_measured');
    expect(before.externalLengthUnit).toBe('unknown');
    expect(readdirSync(test.root)).toEqual([]);
    expect(test.executeCommand).not.toHaveBeenCalled();
    expect(test.readCredentialSecret).not.toHaveBeenCalled();
    writeFileSync(path.join(test.root, 'request.json'), test.input.payload.executionContext.requestFileContent, 'utf8');
    expect(test.adapter.preflight(test.input)).toEqual(before);
    expect(readdirSync(test.root)).toEqual(['request.json']);
  });

  it.each([-1, 0, 1])('checks final prompt plus schema/argv at capacity delta %i', async (delta) => {
    const test = fixture(kind);
    const before = test.adapter.preflight(test.input);
    test.input.provider.requestPolicy.transportByteLimit = before.totalBytes + delta;
    if (delta < 0) {
      expect(() => test.adapter.preflight(test.input)).toThrow('judge_provider_capacity_exceeded');
      await expect(test.adapter.judge(test.input)).rejects.toMatchObject({
        failureClass: 'judge_provider_capacity_exceeded', dispatchState: 'not_dispatched', goalJudgeDispatchCount: 0,
      });
    } else {
      expect(test.adapter.preflight(test.input).totalBytes).toBe(before.totalBytes);
    }
    expect(readdirSync(test.root)).toEqual([]);
    expect(test.executeCommand).not.toHaveBeenCalled();
    expect(test.readCredentialSecret).not.toHaveBeenCalled();
  });

  it('rejects a changed payload after planning without materializing transport artifacts', async () => {
    const test = fixture(kind);
    const expectedPreflight = test.adapter.preflight(test.input);
    test.input.payload.systemPrompt += ' changed';
    await expect(test.adapter.judge({ ...test.input, expectedPreflight })).rejects.toMatchObject({
      failureClass: 'judge_preflight_payload_changed', dispatchState: 'not_dispatched',
    });
    expect(readdirSync(test.root)).toEqual([]);
    expect(test.executeCommand).not.toHaveBeenCalled();
    expect(expectedPreflight.serializedPayloadHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(expectedPreflight.auxiliaryPayloadHash).not.toBe(`sha256:${createHash('sha256').update('').digest('hex')}`);
  });
});
