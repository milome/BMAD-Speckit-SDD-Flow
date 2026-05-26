import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, '_bmad', 'skills', 'req-trace-matrix-prompt-generator', 'scripts', 'generate_prompt.js');
const SOURCE = path.join(ROOT, 'docs', 'requirements', '2026-05-25-ai-tdd-manifest-closeout-runner.md');
const RECORD = path.join(
  ROOT,
  '_bmad-output',
  'runtime',
  'requirement-records',
  'REQ-AI-TDD-MANIFEST-CLOSEOUT-RUNNER',
  'requirement-record.json'
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-trace-language-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function runPrompt(language: string, profile = 'full'): { prompt: string; receipt: Record<string, any> } {
  const outDir = path.join(tempDir, `${language}-${profile}`.replace(/[^a-z0-9-]/gi, '-'));
  execFileSync(
    process.execPath,
    [
      SCRIPT,
      '--source-document',
      SOURCE,
      '--requirement-record',
      RECORD,
      '--out-dir',
      outDir,
      '--execution-host',
      'generic',
      '--prompt-language',
      language,
      '--human-prompt-profile',
      profile,
      '--json',
    ],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return {
    prompt: fs.readFileSync(path.join(outDir, 'human_prompt.txt'), 'utf8'),
    receipt: JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8')),
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

function hashSourceAndConfirmation(sourceText: string, confirmation: Record<string, unknown>) {
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

function writePromptLanguagePriorityFixture(): { source: string; record: string } {
  const original = fs.readFileSync(SOURCE, 'utf8');
  const sourceText = original.replace('  confirmationLanguage: zh-CN', '  confirmationLanguage: zh-CN\n  promptLanguage: en-US');
  const blockText = extractConfirmationBlock(sourceText);
  const parsed = yaml.load(blockText) as { implementationConfirmation?: Record<string, unknown> };
  const confirmation = parsed.implementationConfirmation;
  if (!confirmation) throw new Error('missing parsed implementationConfirmation');
  const source = path.join(tempDir, 'prompt-language-priority.md');
  fs.writeFileSync(source, sourceText, 'utf8');
  const hashes = hashSourceAndConfirmation(sourceText, confirmation);
  const record = path.join(tempDir, 'requirement-record.json');
  fs.writeFileSync(
    record,
    `${JSON.stringify(
      {
        recordId: 'REQ-LANG-PRIORITY',
        controlStore: { eventLogPath: path.join(tempDir, 'events.jsonl') },
        ...hashes,
        confirmationHistory: [
          {
            eventType: 'confirmation_recorded',
            ...hashes,
            confirmationPageHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
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

describe('req trace human prompt language and profile', () => {
  it('resolves auto language from confirmationLanguage and records it', () => {
    const result = runPrompt('auto');

    expect(result.receipt.humanPromptLanguage).toBe('zh-CN');
    expect(result.prompt).toContain('任务:');
    expect(result.prompt).toContain('范围与意图锁定:');
  });

  it('resolves auto language from promptLanguage before confirmationLanguage', () => {
    const fixture = writePromptLanguagePriorityFixture();
    const outDir = path.join(tempDir, 'auto-prefers-prompt-language');
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
        'generic',
        '--prompt-language',
        'auto',
        '--json',
      ],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const prompt = fs.readFileSync(path.join(outDir, 'human_prompt.txt'), 'utf8');
    const receipt = JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8'));

    expect(receipt.humanPromptLanguage).toBe('en-US');
    expect(prompt).toContain('Task:');
    expect(prompt).not.toContain('任务:');
  });

  it('supports English section labels without changing packet IDs', () => {
    const result = runPrompt('en-US');

    expect(result.receipt.humanPromptLanguage).toBe('en-US');
    expect(result.prompt).toContain('Task:');
    expect(result.prompt).toContain('Scope and intent lock:');
    expect(result.prompt).toContain('TRACE-001');
  });

  it('supports bilingual labels without changing packet IDs', () => {
    const result = runPrompt('bilingual');

    expect(result.receipt.humanPromptLanguage).toBe('bilingual');
    expect(result.prompt).toContain('任务 / Task:');
    expect(result.prompt).toContain('范围与意图锁定 / Scope and intent lock:');
    expect(result.prompt).toContain('强制执行规则 / Mandatory execution rules:');
    expect(result.prompt).toContain('TRACE-001');
  });

  it('compact profile remains authority-safe and records the selected profile', () => {
    const result = runPrompt('zh-CN', 'compact');

    expect(result.receipt.humanPromptProfile).toBe('compact');
    expect(result.prompt).toContain('Full details are in model_packet.json');
    expect(result.prompt).toContain('Only ');
    expect(result.prompt).toContain('Required commands:');
  });

  it('fails closed for unsupported prompt languages', () => {
    expect(() => runPrompt('fr-FR')).toThrow(/Unsupported --prompt-language: fr-FR/);
  });
});
