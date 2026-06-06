import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const VALIDATOR_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'validate-main-agent-runtime-migration-wave-3-7.cjs'
);
const WAVE_DIR = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  'main-agent-runtime-migration-wave-3.7'
);

const REQUIRED_ARTIFACTS = [
  'candidate-manifest.json',
  'evidence.json',
  'summary.md',
];

describe('main-agent runtime migration wave 3.7 contract', () => {
  it('creates required Wave 3.7 governance artifacts', () => {
    expect(fs.existsSync(VALIDATOR_PATH)).toBe(true);
    for (const artifact of REQUIRED_ARTIFACTS) {
      expect(fs.existsSync(path.join(WAVE_DIR, artifact)), artifact).toBe(true);
    }
  });

  it('runs the Wave 3.7 migration validator successfully', () => {
    const result = spawnSync(process.execPath, [VALIDATOR_PATH], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      maxBuffer: 20 * 1024 * 1024,
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('"status": "passed"');
  });
});
