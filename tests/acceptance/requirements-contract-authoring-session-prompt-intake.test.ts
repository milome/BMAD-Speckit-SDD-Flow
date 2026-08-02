import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();
const TSX_CLI = path.join(PROJECT_ROOT, 'node_modules', 'tsx', 'dist', 'cli.cjs');
const MAIN_AGENT_INDEX = path.join(
  PROJECT_ROOT,
  'packages',
  'bmad-speckit',
  'src',
  'main-agent',
  'index.ts'
);

function createRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'requirements-source-intake-'));
}

function runIntake(root: string, args: string[], input?: string) {
  const result = spawnSync(
    process.execPath,
    [TSX_CLI, MAIN_AGENT_INDEX, 'requirements-contract-source-intake', '--cwd', root, '--json', ...args],
    {
      cwd: PROJECT_ROOT,
      input,
      encoding: 'utf8',
    }
  );
  const stdout = result.stdout.trim();
  return {
    ...result,
    json: stdout ? JSON.parse(stdout) : null,
  };
}

function allFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else files.push(path.relative(root, full).replace(/\\/g, '/'));
    }
  };
  visit(root);
  return files.sort();
}

const PROMPT = [
  '# Session Prompt Requirement',
  '',
  'FR-1: Build from a session prompt without creating consumer markdown generators.',
  '目标文件：`src/session-widget.ts`',
  'Validation command: npx vitest run tests/acceptance/session-widget.test.ts',
  '',
].join('\n');

describe('requirements contract authoring session prompt intake', () => {
  it('compiles a session-prompt file through the package runtime and writes a JSON receipt only', () => {
    const root = createRoot();
    try {
      const inputDir = path.join(root, 'input');
      mkdirSync(inputDir, { recursive: true });
      const promptPath = path.join(inputDir, 'session-prompt.md');
      const receiptPath = path.join(root, '_bmad-output', 'runtime', 'source-intake.json');
      writeFileSync(promptPath, PROMPT, 'utf8');

      const result = runIntake(root, [
        '--session-prompt-file',
        promptPath,
        '--out',
        receiptPath,
      ]);

      expect(result.status).toBe(0);
      expect(result.json.status).toBe('requirements_source_intake_compiled');
      expect(result.json.data.receipt.inputKind).toBe('session_prompt');
      expect(result.json.data.receipt.inputChannel).toBe('file');
      expect(result.json.data.receipt.ast.paths.posix).toContain('src/session-widget.ts');
      expect(result.json.data.receipt.ast.commands.all).toContain(
        'npx vitest run tests/acceptance/session-widget.test.ts'
      );
      expect(existsSync(receiptPath)).toBe(true);
      expect(JSON.parse(readFileSync(receiptPath, 'utf8')).schemaVersion).toBe(
        'requirements-contract-source-intake-receipt/v1'
      );
      expect(allFiles(root).filter((file) => file.endsWith('.md'))).toEqual(['input/session-prompt.md']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('compiles a session-prompt stdin input through the package runtime', () => {
    const root = createRoot();
    try {
      const result = runIntake(root, ['--session-prompt-stdin'], PROMPT);

      expect(result.status).toBe(0);
      expect(result.json.status).toBe('requirements_source_intake_compiled');
      expect(result.json.data.receipt.inputKind).toBe('session_prompt');
      expect(result.json.data.receipt.inputChannel).toBe('stdin');
      expect(result.json.data.receipt.sourcePath).toBe(null);
      expect(result.json.data.receipt.sourceHash).toMatch(/^sha256:/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails deterministically when simultaneous source inputs are provided', () => {
    const root = createRoot();
    try {
      const inputDir = path.join(root, 'input');
      mkdirSync(inputDir, { recursive: true });
      const promptPath = path.join(inputDir, 'session-prompt.md');
      const prdPath = path.join(inputDir, 'prd.md');
      writeFileSync(promptPath, PROMPT, 'utf8');
      writeFileSync(prdPath, PROMPT, 'utf8');

      const result = runIntake(root, ['--session-prompt-file', promptPath, '--prd-draft', prdPath]);

      expect(result.status).toBe(2);
      expect(result.json.status).toBe('requirements_source_input_conflict');
      expect(result.json.errors[0].code).toBe('requirements_source_input_conflict');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
