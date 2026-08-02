import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGET_FILES = ['src/script-entry.ts'] as const;
const TARGET_PAIRS = [['src/workflow-entry.ts', 'workflow']] as const;
const TARGET_MAP = {
  array: 'src/array-target.ts',
} as const;
const UI_TARGET = 'src/ui.jsx';
const EACH_TARGETS = ['each-target.ts'] as const;

function readSourceFile(fileName: string): string {
  const sourcePath = path.join(ROOT, 'src', fileName);
  return readFileSync(sourcePath, 'utf8');
}

function runCommand(command: string): string {
  return execSync(command, { cwd: ROOT, encoding: 'utf8' });
}

it('extracts iterable, dynamic import, and script targets', async () => {
  for (const targetPath of TARGET_FILES) {
    const absolutePath = path.join(ROOT, targetPath);
    expect(readFileSync(absolutePath, 'utf8')).not.toHaveLength(0);
  }
  for (const [targetPath] of TARGET_PAIRS) {
    expect(existsSync(path.join(ROOT, targetPath))).toBe(true);
  }
  expect(
    Object.values(TARGET_MAP).every((targetPath) =>
      existsSync(path.join(ROOT, targetPath))
    )
  ).toBe(true);
  expect(readFileSync(path.join(ROOT, 'scripts/setup.ps1'), 'utf8')).not.toHaveLength(0);
  expect(readFileSync(path.join(ROOT, 'scripts/setup.sh'), 'utf8')).not.toHaveLength(0);
  expect(readFileSync(path.join(ROOT, UI_TARGET), 'utf8')).not.toHaveLength(0);
  expect(readSourceFile('helper-target.ts')).not.toHaveLength(0);
  expect(await import('../src/registry-active')).toHaveProperty('registryActive');
});

it.each(EACH_TARGETS)('extracts %s through a Vitest table', (fileName) => {
  expect(readSourceFile(fileName)).not.toHaveLength(0);
});

it('extracts the source side of copyFileSync', () => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'target-validity-copy-'));
  try {
    const destinationPath = path.join(temporaryRoot, 'copy-target.ts');
    copyFileSync(path.join(ROOT, 'src', 'copy-target.ts'), destinationPath);
    expect(readFileSync(destinationPath, 'utf8')).toContain('copyTarget');
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

it('extracts a static command target through a local wrapper', () => {
  const commandTarget = path.join(ROOT, 'src', 'command-target.js');
  const dynamicArgument = mkdtempSync(path.join(tmpdir(), 'target-validity-command-'));
  try {
    expect(runCommand(`node "${commandTarget}" "${dynamicArgument}"`)).toContain(
      'command target'
    );
  } finally {
    rmSync(dynamicArgument, { recursive: true, force: true });
  }
});
