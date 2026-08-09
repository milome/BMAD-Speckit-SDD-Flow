import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createNativeReviewerHostBridge,
  createNativeReviewerTransport,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-native-reviewer-transport';

const HASH = `sha256:${'1'.repeat(64)}`;

describe('Native Reviewer production transport', () => {
  it('dispatches through the registry route and normalizes a reviewer receipt', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-reviewer-transport-'));
    try {
      let observedRequest: Record<string, unknown> | null = null;
      const transport = createNativeReviewerTransport({
        projectRoot: root,
        outputRoot: path.join(root, 'closeout'),
        host: 'codex',
        evidencePaths: ['context.json', 'closure.json'],
        dispatch: async (request) => {
          observedRequest = request as unknown as Record<string, unknown>;
          return { sourceLedgerHash: HASH, terminalOutcome: 'clean', findingIds: [] };
        },
      });

      const result = await transport.invoke({
        intent: {
          actorClass: 'bounded_code_reviewer',
          dispatchMode: 'parallel',
          invocationMode: 'native',
          dispatchGroupId: HASH,
          preparedBeforeDispatch: true,
          blindInput: { campaignId: 'campaign-001' },
          blindInputHash: HASH,
          invocationIntentHash: HASH,
        },
      });

      expect(result).toEqual({
        sourceLedgerHash: HASH,
        terminalOutcome: 'clean',
        findingIds: [],
      });
      expect(observedRequest).toMatchObject({
        schemaVersion: 'main-agent-native-reviewer-dispatch/v1',
        role: 'bounded_code_reviewer',
        host: 'codex',
        route: { tool: 'codex', subtypeOrExecutor: 'main-session:audit' },
        evidencePaths: ['context.json', 'closure.json'],
      });
      expect(fs.existsSync(path.join(root, 'closeout', 'native-reviewer-request.json'))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the host bridge is missing or returns an invalid result', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-reviewer-transport-'));
    try {
      const missing = createNativeReviewerTransport({
        projectRoot: root,
        outputRoot: path.join(root, 'missing'),
        host: 'codex',
      });
      const intent = {
        actorClass: 'bounded_code_reviewer' as const,
        dispatchMode: 'parallel' as const,
        invocationMode: 'native' as const,
        dispatchGroupId: HASH,
        preparedBeforeDispatch: true as const,
        blindInput: {},
        blindInputHash: HASH,
        invocationIntentHash: HASH,
      };
      await expect(missing.invoke({ intent })).rejects.toThrow(
        'native_reviewer_transport_not_configured'
      );

      const invalid = createNativeReviewerTransport({
        projectRoot: root,
        outputRoot: path.join(root, 'invalid'),
        host: 'claude-code-cli',
        dispatch: async () => ({ terminalOutcome: 'clean' }),
      });
      await expect(invalid.invoke({ intent })).rejects.toThrow(
        'native_reviewer_transport_response_invalid'
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses the Claude host route when the native reviewer host is Claude Code CLI', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-reviewer-transport-'));
    try {
      let route: unknown;
      const transport = createNativeReviewerTransport({
        projectRoot: root,
        outputRoot: path.join(root, 'claude'),
        host: 'claude-code-cli',
        dispatch: async (request) => {
          route = request.route;
          return { sourceLedgerHash: HASH, terminalOutcome: 'blocked', findingIds: ['provider'] };
        },
      });

      const result = await transport.invoke({
        intent: {
          actorClass: 'bounded_code_reviewer',
          dispatchMode: 'parallel',
          invocationMode: 'native',
          dispatchGroupId: HASH,
          preparedBeforeDispatch: true,
          blindInput: { campaignId: 'campaign-claude' },
          blindInputHash: HASH,
          invocationIntentHash: HASH,
        },
      });

      expect(route).toEqual({ tool: 'Agent', subtypeOrExecutor: 'code-reviewer' });
      expect(result.terminalOutcome).toBe('blocked');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when the formal host bridge has no configured command', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-reviewer-bridge-'));
    try {
      const bridge = createNativeReviewerHostBridge({ env: {} });
      const transport = createNativeReviewerTransport({
        projectRoot: root,
        outputRoot: path.join(root, 'closeout'),
        host: 'cursor',
        dispatch: bridge,
      });
      await expect(
        transport.invoke({
          intent: {
            actorClass: 'bounded_code_reviewer',
            dispatchMode: 'parallel',
            invocationMode: 'native',
            dispatchGroupId: HASH,
            preparedBeforeDispatch: true,
            blindInput: {},
            blindInputHash: HASH,
            invocationIntentHash: HASH,
          },
        })
      ).rejects.toThrow('native_reviewer_transport_not_configured');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs the built-in Codex review route when no external bridge is configured', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-reviewer-codex-cli-'));
    try {
      fs.writeFileSync(path.join(root, 'reviewer.prompt.md'), 'Review without editing.\n', 'utf8');
      let observedArgs: string[] = [];
      let observedPrompt = '';
      const bridge = createNativeReviewerHostBridge({
        env: { BMAD_NATIVE_REVIEWER_PROMPT_PATH: 'reviewer.prompt.md' },
        executeCodexCliCommand: async (invocation) => {
          observedArgs = invocation.args;
          observedPrompt = invocation.stdin;
          fs.writeFileSync(
            invocation.outputPath,
            JSON.stringify({ terminalOutcome: 'clean', findingIds: [] }),
            'utf8'
          );
          return {
            exitCode: 0,
            stdout: `${JSON.stringify({ type: 'thread.started', thread_id: 'review-thread' })}\n`,
            stderr: '',
          };
        },
      });
      const request = {
        schemaVersion: 'main-agent-native-reviewer-dispatch/v1' as const,
        role: 'bounded_code_reviewer' as const,
        host: 'codex' as const,
        route: { tool: 'codex' as const, subtypeOrExecutor: 'main-session:audit' },
        projectRoot: root,
        requestPath: path.join(root, 'native-reviewer-request.json'),
        outputRoot: path.join(root, 'closeout'),
        evidencePaths: ['context.json', 'closure.json'],
        intent: {
          actorClass: 'bounded_code_reviewer' as const,
          dispatchMode: 'parallel' as const,
          invocationMode: 'native' as const,
          dispatchGroupId: HASH,
          preparedBeforeDispatch: true as const,
          blindInput: { campaignId: 'campaign-codex' },
          blindInputHash: HASH,
          invocationIntentHash: HASH,
        },
      };

      const result = await bridge(request);

      expect(observedArgs.slice(0, 3)).toEqual(['--ask-for-approval', 'never', 'exec']);
      expect(observedArgs).not.toContain('review');
      expect(observedArgs).not.toContain('--uncommitted');
      expect(observedArgs).toEqual(expect.arrayContaining(['--sandbox', 'read-only']));
      expect(observedArgs.at(-1)).toBe('-');
      expect(observedArgs).toContain('--output-schema');
      expect(observedPrompt).toContain('context.json');
      expect(observedPrompt).toContain('Do not perform an unbounded review of the worktree');
      expect(result).toMatchObject({ terminalOutcome: 'clean', findingIds: [] });
      expect((result as Record<string, unknown>).sourceLedgerHash).toMatch(
        /^sha256:[a-f0-9]{64}$/u
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('runs the built-in Claude code-reviewer route when no external bridge is configured', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-reviewer-claude-cli-'));
    try {
      fs.writeFileSync(path.join(root, 'reviewer.prompt.md'), 'Review without editing.\n', 'utf8');
      let observedArgs: string[] = [];
      const bridge = createNativeReviewerHostBridge({
        env: { BMAD_NATIVE_REVIEWER_PROMPT_PATH: 'reviewer.prompt.md' },
        executeClaudeCodeCliCommand: async (invocation) => {
          observedArgs = invocation.args;
          return {
            exitCode: 0,
            stdout: JSON.stringify({
              structured_output: { terminalOutcome: 'blocked', findingIds: ['finding-1'] },
            }),
            stderr: '',
          };
        },
      });
      const result = await bridge({
        schemaVersion: 'main-agent-native-reviewer-dispatch/v1',
        role: 'bounded_code_reviewer',
        host: 'claude',
        route: { tool: 'Agent', subtypeOrExecutor: 'code-reviewer' },
        projectRoot: root,
        requestPath: path.join(root, 'native-reviewer-request.json'),
        outputRoot: path.join(root, 'closeout'),
        evidencePaths: ['context.json'],
        intent: {
          actorClass: 'bounded_code_reviewer',
          dispatchMode: 'parallel',
          invocationMode: 'native',
          dispatchGroupId: HASH,
          preparedBeforeDispatch: true,
          blindInput: { campaignId: 'campaign-claude' },
          blindInputHash: HASH,
          invocationIntentHash: HASH,
        },
      });

      expect(observedArgs).toEqual(
        expect.arrayContaining(['--print', '--agent', 'code-reviewer', '--json-schema'])
      );
      expect(result).toMatchObject({ terminalOutcome: 'blocked', findingIds: ['finding-1'] });
      expect((result as Record<string, unknown>).sourceLedgerHash).toMatch(
        /^sha256:[a-f0-9]{64}$/u
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
