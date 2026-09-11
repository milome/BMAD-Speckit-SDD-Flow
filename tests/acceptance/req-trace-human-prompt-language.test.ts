import { execFileSync } from 'node:child_process';
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

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-trace-language-'));
  fixture = materializeAiTddManifestCloseoutRunnerFixture({
    root: path.join(tempDir, 'workspace'),
  });
}, 120_000);

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
}, 120_000);

function runPrompt(
  language: string,
  profile = 'full'
): { prompt: string; receipt: Record<string, any> } {
  const outDir = path.join(tempDir, `${language}-${profile}`.replace(/[^a-z0-9-]/gi, '-'));
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
      'generic',
      '--prompt-language',
      language,
      '--human-prompt-profile',
      profile,
      '--json',
    ],
    { cwd: fixture.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return {
    prompt: fs.readFileSync(path.join(outDir, 'human_prompt.txt'), 'utf8'),
    receipt: JSON.parse(fs.readFileSync(path.join(outDir, 'audit_receipt.json'), 'utf8')),
  };
}

describe('req trace human prompt language and profile', () => {
  it('resolves auto language from confirmationLanguage and records it', () => {
    const result = runPrompt('auto');

    expect(result.receipt.humanPromptLanguage).toBe('zh-CN');
    expect(result.prompt).toContain('任务:');
    expect(result.prompt).toContain('范围与意图锁定:');
  });

  it('lets an explicit prompt language override the canonical confirmation language', () => {
    const result = runPrompt('en-US');
    expect(result.receipt.humanPromptLanguage).toBe('en-US');
    expect(result.prompt).toContain('Task:');
    expect(result.prompt).not.toContain('任务:');
  });

  it('supports English section labels without changing packet IDs', () => {
    const result = runPrompt('en-US');

    expect(result.receipt.humanPromptLanguage).toBe('en-US');
    expect(result.prompt).toContain('Task:');
    expect(result.prompt).toContain('Scope and intent lock:');
    expect(result.prompt).toContain('TRACE-TASK-DATASERVICE-001');
  });

  it('supports bilingual labels without changing packet IDs', () => {
    const result = runPrompt('bilingual');

    expect(result.receipt.humanPromptLanguage).toBe('bilingual');
    expect(result.prompt).toContain('任务 / Task:');
    expect(result.prompt).toContain('范围与意图锁定 / Scope and intent lock:');
    expect(result.prompt).toContain('强制执行规则 / Mandatory execution rules:');
    expect(result.prompt).toContain('TRACE-TASK-DATASERVICE-001');
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
