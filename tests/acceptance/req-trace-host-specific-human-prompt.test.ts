import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { materializeAiTddManifestCloseoutRunnerFixture } from '../helpers/requirement-fixture-runtime';

const ROOT = process.cwd();
const SCRIPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'req-trace-matrix-prompt-generator',
  'scripts',
  'generate_prompt.js'
);
const DIRECT_ENTRY_ARGS = ['--entry', 'req_trace_direct'] as const;
let tempDir: string;
let fixture: ReturnType<typeof materializeAiTddManifestCloseoutRunnerFixture>;
vi.setConfig({ testTimeout: 120_000, hookTimeout: 30_000 });

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-trace-host-'));
  fixture = materializeAiTddManifestCloseoutRunnerFixture({
    root: path.join(tempDir, 'workspace'),
  });
}, 30_000);

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
}, 30_000);

function runHost(
  host: string,
  extraArgs: string[] = []
): { prompt: string; receipt: Record<string, any>; goalDocument?: string } {
  const argFingerprint =
    extraArgs.length > 0 ? extraArgs.join('-').replace(/[^a-z0-9-]/gi, '-') : 'default';
  const outDir = path.join(tempDir, `${host.replace(/[^a-z0-9-]/gi, '-')}-${argFingerprint}`);
  const result = spawnSync(
    process.execPath,
    [
      SCRIPT,
      ...DIRECT_ENTRY_ARGS,
      '--source-document',
      fixture.sourcePath,
      '--requirement-record',
      fixture.recordPath,
      '--out-dir',
      outDir,
      '--execution-host',
      host,
      '--json',
      ...extraArgs,
    ],
    { cwd: fixture.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  if (result.status !== 0) {
    throw new Error(
      [
        `generate_prompt.js failed for ${host}`,
        `status=${result.status}`,
        `stdout=${result.stdout}`,
        `stderr=${result.stderr}`,
      ].join('\n')
    );
  }
  const goalDocumentPath = path.join(outDir, 'goal_execution.md');
  return {
    prompt: fs.readFileSync(path.join(outDir, 'human_prompt.txt'), 'utf8'),
    receipt: JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8')),
    goalDocument: fs.existsSync(goalDocumentPath)
      ? fs.readFileSync(goalDocumentPath, 'utf8')
      : undefined,
  };
}

function normalizePathForAssert(value: string): string {
  return value.replace(/\\/gu, '/');
}

function runLongGoal(extraArgs: string[] = []): {
  prompt: string;
  receipt: Record<string, any>;
  goalDocument: string;
  outDir: string;
} {
  const outDir = path.join(tempDir, 'long-goal-out');
  execFileSync(
    process.execPath,
    [
      SCRIPT,
      ...DIRECT_ENTRY_ARGS,
      '--source-document',
      fixture.sourcePath,
      '--requirement-record',
      fixture.recordPath,
      '--out-dir',
      outDir,
      '--execution-host',
      'codex',
      '--goal-command-available',
      'true',
      '--task-report-path',
      path.join(tempDir, 'long-goal-task-report.json'),
      '--json',
      ...extraArgs,
    ],
    { cwd: fixture.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return {
    outDir,
    prompt: fs.readFileSync(path.join(outDir, 'human_prompt.txt'), 'utf8'),
    receipt: JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8')),
    goalDocument: fs.readFileSync(path.join(outDir, 'goal_execution.md'), 'utf8'),
  };
}

describe('req trace host-specific human prompt generation', () => {
  it('uses /goal document-reference mode for Codex only when explicitly available', () => {
    const fallback = runHost('codex');
    const taskReportPath = path.join(tempDir, 'codex-native-task-report.json');
    const goal = runHost('codex', [
      '--goal-command-available',
      'true',
      '--packet-id',
      'implement-host-codex',
      '--task-report-path',
      taskReportPath,
    ]);

    expect(fallback.prompt).toContain('continue nonstop');
    expect(fallback.prompt).not.toContain('/goal ');
    expect(fallback.receipt.continuationDirective.nativeGoalCommandUsed).toBe(false);

    expect(goal.prompt).toContain('/goal ');
    expect(goal.prompt).toContain('goal_execution.md');
    expect(goal.prompt).toContain(
      'The /goal command is an entry pointer only, not the full task scope.'
    );
    expect(goal.prompt).toContain(
      'The /goal command is the execution entrypoint for Codex and Claude Code CLI native goal mode.'
    );
    expect(goal.prompt).toContain('Execution scope is goal_execution.md + model_packet.json.');
    expect(goal.prompt).not.toContain('\ncontinue nonstop\n');
    expect(goal.receipt.continuationDirective.nativeGoalCommandUsed).toBe(true);
    expect(goal.receipt.goalCommand).toMatchObject({
      mode: 'native_goal_document_ref',
      documentHash: expect.stringMatching(/^sha256:/),
    });
    expect(goal.receipt.goalCommand.mode).not.toBe('native_goal_inline');
    expect(goal.receipt.outputs.goalDocument).toContain('goal_execution.md');
    expect(goal.goalDocument).toContain('goal-execution-projection-envelope/v1');
    expect(goal.goalDocument).toContain('# Goal Execution Contract');
    expect(goal.goalDocument).toContain(normalizePathForAssert(taskReportPath));
    expect(goal.goalDocument).toContain('model_packet.json');
    expect(goal.goalDocument).toContain('## Obligations');
    expect(goal.goalDocument).toContain('## Atomic Tasks');
  });

  it('keeps Cursor IDE and Cursor CLI as separate surfaces', () => {
    const ide = runHost('cursor');
    const cli = runHost('cursor-cli');

    expect(ide.receipt.executionHost).toBe('cursor-ide');
    expect(ide.receipt.executionHostAliasUsed).toBe('cursor');
    expect(ide.prompt).toContain('Cursor IDE Agent mode');
    expect(ide.prompt).not.toContain('cursor-agent -p');

    expect(cli.receipt.executionHost).toBe('cursor-cli');
    expect(cli.prompt).toContain('cursor-agent -p --force --output-format stream-json');
    expect(cli.prompt).toContain('External supervisor loop:');
  });

  it('maps Claude alias to claude-code and avoids goal commands unless available', () => {
    const claude = runHost('claude');

    expect(claude.receipt.executionHost).toBe('claude-code');
    expect(claude.receipt.executionHostAliasUsed).toBe('claude');
    expect(claude.prompt).toContain('Continue autonomously until all final gates pass');
    expect(claude.prompt).not.toContain('/goal ');
  });

  it('uses Claude Code /goal document-reference mode only when explicitly available', () => {
    const fallback = runHost('claude-code');
    const taskReportPath = path.join(tempDir, 'claude-native-task-report.json');
    const goal = runHost('claude-code', [
      '--goal-command-available',
      'true',
      '--packet-id',
      'implement-host-claude',
      '--task-report-path',
      taskReportPath,
    ]);

    expect(fallback.prompt).toContain('Continue autonomously until all final gates pass');
    expect(fallback.prompt).not.toContain('/goal ');
    expect(fallback.receipt.continuationDirective.nativeGoalCommandUsed).toBe(false);

    expect(goal.prompt).toContain('/goal ');
    expect(goal.prompt).toContain('goal_execution.md');
    expect(goal.prompt).toContain(
      'The /goal command is an entry pointer only, not the full task scope.'
    );
    expect(goal.prompt).toContain(
      'The /goal command is the execution entrypoint for Codex and Claude Code CLI native goal mode.'
    );
    expect(goal.prompt).toContain('claude -p --permission-mode auto --output-format stream-json');
    expect(goal.receipt.continuationDirective.nativeGoalCommandUsed).toBe(true);
    expect(goal.receipt.goalCommand.mode).toBe('native_goal_document_ref');
    expect(goal.receipt.goalCommand.mode).not.toBe('native_goal_inline');
    expect(goal.goalDocument).toContain('goal-execution-projection-envelope/v1');
    expect(goal.goalDocument).toContain(normalizePathForAssert(taskReportPath));
  });

  it('fails closed for unsupported execution hosts', () => {
    expect(() => runHost('cursor-headless')).toThrow(
      /Unsupported --execution-host: cursor-headless/
    );
  });

  it('writes the canonical Goal contract as a document-reference payload', () => {
    const result = runLongGoal();

    expect(result.receipt.goalCommand).toMatchObject({
      mode: 'native_goal_document_ref',
      maxChars: 4000,
      safeMaxChars: 3800,
      documentHash: expect.stringMatching(/^sha256:/),
    });
    expect(result.receipt.goalCommand.chars).toBeLessThan(4000);
    expect(result.receipt.goalCommand.originalInlineChars).toBeGreaterThan(0);
    expect(result.receipt.outputs.goalDocument).toContain('goal_execution.md');
    expect(result.receipt.goalDocumentRequiredFragmentsPassed).toBe(true);
    expect(result.receipt.goalDocumentMissingRequiredFragments).toEqual([]);
    expect(result.prompt).toContain(
      '/goal Execute REQ-GOAL-SOURCE-NORMALIZATION-FULL-20260908-05 by following'
    );
    expect(result.prompt).toContain('goal_execution.md');
    expect(result.prompt).not.toContain('with strict evidence and no truncation '.repeat(20));
    expect(result.goalDocument).toContain('goal-execution-projection-envelope/v1');
    expect(result.goalDocument).toContain('# Goal Execution Contract');
    expect(result.goalDocument).toContain('## Obligations');
    expect(result.goalDocument).toContain('## Atomic Tasks');
  });

  it('blocks native /goal without --out-dir because no goal document can be written', () => {
    let stdout = '';
    let status = 0;
    try {
      execFileSync(
        process.execPath,
        [
          SCRIPT,
          ...DIRECT_ENTRY_ARGS,
          '--source-document',
          fixture.sourcePath,
          '--requirement-record',
          fixture.recordPath,
          '--execution-host',
          'codex',
          '--goal-command-available',
          'true',
        ],
        { cwd: fixture.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      );
    } catch (error: any) {
      stdout = String(error.stdout ?? '');
      status = error.status ?? 1;
    }

    expect(status).toBe(3);
    expect(stdout).toContain('BLOCK: GOAL_DOCUMENT_REQUIRED');
    expect(stdout).toContain('goal_execution.md');
  });
});
