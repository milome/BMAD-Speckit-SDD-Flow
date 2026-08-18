import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');
const RUNTIME = path.join(ROOT, 'packages/bmad-speckit/src/main-agent/runtime.ts');
const RUNNER = [
  'const {mainAgentRuntimeCommand}=require(process.argv[1]);',
  'Promise.resolve(mainAgentRuntimeCommand(process.argv.slice(2)))',
  '.then(code=>{process.exitCode=code;})',
  '.catch(error=>{console.error(error);process.exitCode=2;});',
].join('');

function invoke(root: string, action: string, args: string[]) {
  return spawnSync(process.execPath, [TSX, '-e', RUNNER, RUNTIME, action, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function parseJson(completed: ReturnType<typeof spawnSync>) {
  expect(completed.stderr, completed.stderr || completed.stdout).toBe('');
  expect(completed.stdout).not.toBe('');
  return JSON.parse(completed.stdout) as Record<string, any>;
}

function issueCode(envelope: Record<string, any>): string | undefined {
  return (
    envelope.issueCode ??
    envelope.data?.issueCode ??
    envelope.data?.result?.issueCode ??
    envelope.errors?.[0]?.code
  );
}

describe('main-agent controlled-closeout CLI contract', () => {
  it('publishes the request-id-only controlled closeout command', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'controlled-closeout-cli-'));
    try {
      const completed = invoke(root, 'controlled-closeout', ['--cwd', root, '--help', '--json']);

      expect(completed.status, completed.stderr || completed.stdout).toBe(0);
      expect(completed.stdout).toContain(
        'main-agent controlled-closeout --cwd <path> --request-id <requestId> --exact-confirmation-text <text> --json'
      );
      expect(existsSync(path.join(root, '_bmad-output'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['missing_cwd', ['--request-id', 'REQ-CLI', '--exact-confirmation-text', 'accept', '--json']],
    ['missing_request_id', ['--cwd', '.', '--exact-confirmation-text', 'accept', '--json']],
    ['missing_exact_text', ['--cwd', '.', '--request-id', 'REQ-CLI', '--json']],
  ])('fails closed for %s before reading or writing a record', (_name, args) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'controlled-closeout-cli-'));
    try {
      const completed = invoke(root, 'controlled-closeout', args);
      const envelope = parseJson(completed);
      expect(completed.status).toBe(2);
      expect(issueCode(envelope)).toMatch(/^controlled_closeout_.+_required$/u);
      expect(existsSync(path.join(root, '_bmad-output'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['confirm-closeout-acceptance', 'closeout-acceptance-ingest'])(
    'removes the legacy public alias %s',
    (action) => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'controlled-closeout-cli-'));
      try {
        const completed = invoke(root, action, ['--cwd', root, '--json']);
        const envelope = parseJson(completed);
        expect(completed.status).toBe(2);
        expect(issueCode(envelope)).toBe('unsupported_main_agent_action');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it.each(['--request', '--requirement-record', '--closeout-attempt-id', '--decision'])(
    'rejects caller-derived input %s',
    (flag) => {
      const root = mkdtempSync(path.join(os.tmpdir(), 'controlled-closeout-cli-'));
      try {
        const completed = invoke(root, 'controlled-closeout', [
          '--cwd',
          root,
          '--request-id',
          'REQ-CLI',
          '--exact-confirmation-text',
          'accept',
          flag,
          'caller-owned',
          '--json',
        ]);
        const envelope = parseJson(completed);
        expect(completed.status).toBe(2);
        expect(issueCode(envelope)).toBe('caller_derived_input_forbidden');
        expect(existsSync(path.join(root, '_bmad-output'))).toBe(false);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
