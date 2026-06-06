import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const WAVE_DIR = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  'main-agent-runtime-migration-wave-3.12'
);
const VALIDATOR_PATH = path.join(
  ROOT,
  'tools',
  'script-migration',
  'validate-main-agent-runtime-migration-wave-3-12.cjs'
);
const REQUIRED_SURFACES = [
  VALIDATOR_PATH,
  path.join(ROOT, 'tools', 'script-migration', 'run-main-agent-wave-3-12-install-matrix.cjs'),
  path.join(ROOT, 'tools', 'script-migration', 'run-main-agent-wave-3-12-package-command.cjs'),
  path.join(ROOT, 'tools', 'script-migration', 'safe-write-main-agent-wave-3-12-artifact.cjs'),
  path.join(ROOT, 'tests', 'acceptance', 'main-agent-runtime-migration-wave-3-12-contract.test.ts'),
];

function runValidator(phase: string) {
  return spawnSync(process.execPath, [VALIDATOR_PATH, '--phase', phase], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 120 * 1024 * 1024,
  });
}

describe('main-agent runtime migration wave 3.12 contract', () => {
  it('creates required deterministic validation and writer surfaces', () => {
    for (const surface of REQUIRED_SURFACES) {
      expect(fs.existsSync(surface), surface).toBe(true);
    }
    expect(fs.existsSync(path.join(WAVE_DIR, 'migration-ledger.json'))).toBe(true);
  });

  it('runs the selected Wave 3.12 validator phase successfully', () => {
    const phase = process.env.BMAD_WAVE_3_12_CONTRACT_TEST_PHASE || 'bootstrap';
    expect(['bootstrap', 'final']).toContain(phase);
    const result = runValidator(phase);
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain('"status": "passed"');
  });

  it('keeps bootstrap independent from final evidence artifacts', () => {
    const phase = process.env.BMAD_WAVE_3_12_CONTRACT_TEST_PHASE || 'bootstrap';
    if (phase !== 'bootstrap') return;
    const validator = fs.readFileSync(VALIDATOR_PATH, 'utf8');
    const bootstrapStart = validator.indexOf("phase === 'bootstrap'");
    expect(bootstrapStart).toBeGreaterThanOrEqual(0);
    const bootstrapBody = validator.slice(bootstrapStart, validator.indexOf('\n  }', bootstrapStart));
    expect(bootstrapBody).not.toContain('install-matrix.json');
    expect(bootstrapBody).not.toContain('evidence.json');
    expect(bootstrapBody).not.toContain('validateRegistryFinal');
  });
});
