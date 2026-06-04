import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const WAVE_ID = 'main-agent-runtime-migration-wave-3.2';
const WAVE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE_ID);
const VALIDATOR_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'validate-main-agent-wave-3-2.cjs'
);

describe('main-agent runtime migration wave 3.2 contract', () => {
  it('creates the Wave 3.2 executable governance assets', () => {
    expect(fs.existsSync(path.join(ROOT, 'tools', 'script-migration', 'analyze-main-agent-wave-3-2.cjs'))).toBe(true);
    expect(fs.existsSync(VALIDATOR_PATH)).toBe(true);
    expect(fs.existsSync(path.join(WAVE_DIR, 'caller-inventory.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE_DIR, 'classification-matrix.md'))).toBe(true);
  });

  it('runs the Wave 3.2 validator successfully', () => {
    const result = spawnSync(process.execPath, [VALIDATOR_PATH], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      maxBuffer: 20 * 1024 * 1024,
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('main-agent-runtime-migration-wave-3.2');
    expect(result.stdout).toContain('targetEntries');
    expect(result.stdout).toContain('25');
    expect(result.stdout).toContain('deletionAllowedCount');
    expect(result.stdout).toContain('0');
  }, 60_000);
});
