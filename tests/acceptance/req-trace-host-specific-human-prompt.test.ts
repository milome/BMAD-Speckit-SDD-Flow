import { execFileSync, spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
let tempDir: string;
let fixture: ReturnType<typeof materializeAiTddManifestCloseoutRunnerFixture>;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-trace-host-'));
  fixture = materializeAiTddManifestCloseoutRunnerFixture({
    root: path.join(tempDir, 'workspace'),
  });
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

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
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
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

const BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => {
      const record = value as Record<string, unknown>;
      return `${JSON.stringify(key)}:${stableStringify(record[key])}`;
    })
    .join(',')}}`;
}

function sha256(content: string): string {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function extractConfirmationBlock(sourceText: string): string {
  const lines = sourceText.replace(/\r\n/gu, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) throw new Error('missing implementationConfirmation block');
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line)) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function semanticHashes(sourceText: string, confirmation: Record<string, unknown>) {
  const semantic: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(confirmation)) {
    if (!BOOKKEEPING_FIELDS.has(key)) semantic[key] = value;
  }
  const blockText = extractConfirmationBlock(sourceText);
  const normalizedBlock = `implementationConfirmation:${stableStringify(semantic)}`;
  return {
    sourceDocumentHash: sha256(sourceText.replace(blockText, normalizedBlock)),
    implementationConfirmationHash: sha256(stableStringify(semantic)),
  };
}

function writeLongGoalFixture(): { source: string; record: string } {
  const longObjective = `Execute long-goal fixture ${'with strict evidence and no truncation '.repeat(160)}until final pass or reconfirm_required.`;
  const original = fs.readFileSync(fixture.sourcePath, 'utf8');
  const originalBlockText = extractConfirmationBlock(original);
  const parsedOriginal = yaml.load(originalBlockText) as {
    implementationConfirmation?: Record<string, any>;
  };
  const confirmation = parsedOriginal.implementationConfirmation;
  if (!confirmation) throw new Error('missing parsed implementationConfirmation');
  const hostExecutionHints =
    confirmation.aiTddContractExecutionManifestProjection.hostExecutionHints;
  hostExecutionHints.codexCapable.goalObjectiveTemplate = longObjective;
  hostExecutionHints.codex.goalObjectiveTemplate = longObjective;
  hostExecutionHints.claudeCode.goalObjectiveTemplate = longObjective;
  const replacementBlock = yaml.dump(
    { implementationConfirmation: confirmation },
    { lineWidth: 120 }
  );
  const sourceText = original.replace(originalBlockText, replacementBlock.trimEnd());
  const blockText = extractConfirmationBlock(sourceText);
  const parsed = yaml.load(blockText) as { implementationConfirmation?: Record<string, unknown> };
  const reparsedConfirmation = parsed.implementationConfirmation;
  if (!reparsedConfirmation) throw new Error('missing reparsed implementationConfirmation');
  const source = path.join(tempDir, 'long-goal-source.md');
  fs.writeFileSync(source, sourceText, 'utf8');
  const hashes = semanticHashes(sourceText, reparsedConfirmation);
  const record = path.join(tempDir, 'long-goal-requirement-record.json');
  fs.writeFileSync(
    record,
    `${JSON.stringify(
      {
        recordId: 'REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER',
        controlStore: { eventLogPath: path.join(tempDir, 'events.jsonl') },
        ...hashes,
        confirmationHistory: [
          {
            eventType: 'confirmation_recorded',
            ...hashes,
            confirmationPageHash:
              'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { source, record };
}

function runLongGoal(extraArgs: string[] = []): {
  prompt: string;
  receipt: Record<string, any>;
  goalDocument: string;
  outDir: string;
} {
  const fixture = writeLongGoalFixture();
  const outDir = path.join(tempDir, 'long-goal-out');
  execFileSync(
    process.execPath,
    [
      SCRIPT,
      '--source-document',
      fixture.source,
      '--requirement-record',
      fixture.record,
      '--out-dir',
      outDir,
      '--execution-host',
      'codex',
      '--goal-command-available',
      'true',
      '--json',
      ...extraArgs,
    ],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
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
    const goal = runHost('codex', ['--goal-command-available', 'true']);

    expect(fallback.prompt).toContain('continue nonstop');
    expect(fallback.prompt).not.toContain('/goal ');
    expect(fallback.receipt.continuationDirective.nativeGoalCommandUsed).toBe(false);

    expect(goal.prompt).toContain('/goal ');
    expect(goal.prompt).toContain('goal_execution.md');
    expect(goal.prompt).toContain(
      'The /goal command is an entry pointer only, not the full task scope.'
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
    expect(goal.goalDocument).toContain(
      'model_packet.json is the machine-readable execution authority'
    );
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
    const goal = runHost('claude-code', ['--goal-command-available', 'true']);

    expect(fallback.prompt).toContain('Continue autonomously until all final gates pass');
    expect(fallback.prompt).not.toContain('/goal ');
    expect(fallback.receipt.continuationDirective.nativeGoalCommandUsed).toBe(false);

    expect(goal.prompt).toContain('/goal ');
    expect(goal.prompt).toContain('goal_execution.md');
    expect(goal.prompt).toContain(
      'The /goal command is an entry pointer only, not the full task scope.'
    );
    expect(goal.prompt).toContain('claude -p --permission-mode auto --output-format stream-json');
    expect(goal.receipt.continuationDirective.nativeGoalCommandUsed).toBe(true);
    expect(goal.receipt.goalCommand.mode).toBe('native_goal_document_ref');
    expect(goal.receipt.goalCommand.mode).not.toBe('native_goal_inline');
  });

  it('fails closed for unsupported execution hosts', () => {
    expect(() => runHost('cursor-headless')).toThrow(
      /Unsupported --execution-host: cursor-headless/
    );
  });

  it('writes a goal execution document when native /goal payload exceeds safe length', () => {
    const result = runLongGoal();

    expect(result.receipt.goalCommand).toMatchObject({
      mode: 'native_goal_document_ref',
      maxChars: 4000,
      safeMaxChars: 3800,
      documentHash: expect.stringMatching(/^sha256:/),
    });
    expect(result.receipt.goalCommand.chars).toBeLessThan(4000);
    expect(result.receipt.goalCommand.originalInlineChars).toBeGreaterThan(3800);
    expect(result.receipt.outputs.goalDocument).toContain('goal_execution.md');
    expect(result.receipt.goalDocumentRequiredFragmentsPassed).toBe(true);
    expect(result.receipt.goalDocumentMissingRequiredFragments).toEqual([]);
    expect(result.prompt).toContain(
      '/goal Execute REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER by following'
    );
    expect(result.prompt).toContain('goal_execution.md');
    expect(result.prompt).not.toContain('with strict evidence and no truncation '.repeat(20));
    expect(result.goalDocument).toContain('$executing-plans $verification-before-completion');
    expect(result.goalDocument).toContain('goal_execution.md is not execution authority');
    expect(result.goalDocument).toContain(
      'model_packet.json is the machine-readable execution authority'
    );
    expect(result.goalDocument).toContain('AI-TDD protocol:');
    expect(result.goalDocument).toContain('Runtime write policy:');
    expect(result.goalDocument).toContain('Strict final acceptance checklist:');
    expect(result.goalDocument).toContain('Completion Evidence Packet');
  });

  it('blocks native /goal without --out-dir because no goal document can be written', () => {
    let stdout = '';
    let status = 0;
    try {
      execFileSync(
        process.execPath,
        [
          SCRIPT,
          '--source-document',
          fixture.sourcePath,
          '--requirement-record',
          fixture.recordPath,
          '--execution-host',
          'codex',
          '--goal-command-available',
          'true',
        ],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
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
