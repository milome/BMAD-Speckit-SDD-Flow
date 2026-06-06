import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const WAVE_ID = 'main-agent-runtime-closure-wave-3';
const WAVE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE_ID);
const INVENTORY_PATH = path.join(WAVE_DIR, 'closure-inventory.json');
const PRIORITY_PATH = path.join(WAVE_DIR, 'priority-matrix.md');
const EVIDENCE_PATH = path.join(WAVE_DIR, 'evidence.json');
const SUMMARY_PATH = path.join(WAVE_DIR, 'summary.md');
const VALIDATOR_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'validate-main-agent-runtime-closure.cjs'
);

function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

describe('main-agent runtime closure wave 3 contract', () => {
  it('creates the required Wave 3 governance artifacts', () => {
    expect(fs.existsSync(INVENTORY_PATH)).toBe(true);
    expect(fs.existsSync(PRIORITY_PATH)).toBe(true);
    expect(fs.existsSync(EVIDENCE_PATH)).toBe(true);
    expect(fs.existsSync(SUMMARY_PATH)).toBe(true);
    expect(fs.existsSync(VALIDATOR_PATH)).toBe(true);
  });

  it('runs the closure validator successfully', () => {
    const result = spawnSync(process.execPath, [VALIDATOR_PATH], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('"status": "passed"');
  });

  it('records every next-wave candidate as non-deletable', () => {
    const inventory = readJson(INVENTORY_PATH);
    expect(inventory.waveId).toBe(WAVE_ID);
    expect(inventory.nextWaveCandidates.length).toBeGreaterThan(0);
    expect(inventory.nextWaveCandidates.length).toBeLessThanOrEqual(12);
    for (const candidate of inventory.nextWaveCandidates) {
      expect(candidate.deletionAllowed).toBe(false);
      const entry = inventory.closureEntries.find(
        (closureEntry: any) => closureEntry.scriptPath === candidate.scriptPath
      );
      expect(entry).toBeTruthy();
      expect(entry.deletionAllowed).toBe(false);
    }
  });

  it('does not let package consumer runtime read repo-governance artifacts', () => {
    const runtimeFiles = [
      ...walkFiles(path.join(ROOT, 'packages', 'bmad-speckit', 'bin')),
      ...walkFiles(path.join(ROOT, 'packages', 'bmad-speckit', 'src')),
      ...walkFiles(path.join(ROOT, 'packages', 'bmad-speckit', 'dist')),
    ].filter((filePath) => /\.(cjs|mjs|js|json)$/u.test(filePath));

    const offenders = runtimeFiles.filter((filePath) =>
      fs.readFileSync(filePath, 'utf8').includes('repo-governance')
    );
    expect(offenders.map((filePath) => path.relative(ROOT, filePath))).toEqual([]);
  });

  it('records final evidence and explicit no-migration boundaries', () => {
    const evidence = readJson(EVIDENCE_PATH);
    const summary = fs.readFileSync(SUMMARY_PATH, 'utf8');
    const entry = evidence.entries.find(
      (candidate: any) => candidate.entryId === 'main-agent-runtime-closure-inventory'
    );

    expect(evidence.waveId).toBe(WAVE_ID);
    expect(entry.result).toBe('passed');
    for (const commandId of ['CMD-03', 'CMD-04', 'CMD-05', 'CMD-06', 'CMD-08', 'CMD-09']) {
      expect(entry.commands.some((row: any) => String(row.command).includes(commandId))).toBe(true);
    }
    expect(summary).toContain('No runtime migration was performed in Wave 3');
    expect(summary).toContain('No public CLI dispatch was changed in Wave 3');
    expect(summary).toContain('No root scripts deletion was performed or approved in Wave 3');
  });
});
