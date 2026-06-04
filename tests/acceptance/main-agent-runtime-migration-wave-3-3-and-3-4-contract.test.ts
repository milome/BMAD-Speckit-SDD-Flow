import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const VALIDATOR_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'validate-main-agent-runtime-migration-wave-3-3-and-3-4.cjs'
);
const WAVE33_DIR = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  'main-agent-runtime-migration-wave-3.3'
);
const WAVE34_DIR = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  'main-agent-runtime-migration-wave-3.4'
);

describe('main-agent runtime migration wave 3.3 and 3.4 contract', () => {
  it('creates required governance assets for both waves', () => {
    expect(fs.existsSync(VALIDATOR_PATH)).toBe(true);
    expect(fs.existsSync(path.join(WAVE33_DIR, 'evidence.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE33_DIR, 'summary.md'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE33_DIR, 'install-matrix', 'save-dev.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE33_DIR, 'install-matrix', 'npx-package.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE33_DIR, 'install-matrix', 'no-save.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE33_DIR, 'install-matrix', 'init-codex.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE34_DIR, 'installed-surface-touchpoints.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE34_DIR, 'evidence.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE34_DIR, 'summary.md'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE34_DIR, 'install-matrix', 'save-dev.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE34_DIR, 'install-matrix', 'npx-package.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE34_DIR, 'install-matrix', 'no-save.json'))).toBe(true);
    expect(fs.existsSync(path.join(WAVE34_DIR, 'install-matrix', 'init-codex.json'))).toBe(true);
  });

  it('runs the Wave 3.3 and 3.4 migration validator successfully', () => {
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
