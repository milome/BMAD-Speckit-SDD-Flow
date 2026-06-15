import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const CLI = join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
const SOURCE = join(ROOT, 'docs', 'plans', '2026-06-14-large-document-writer-skill-plan.md');
const GOAL = join(ROOT, 'docs', 'plans', '2026-06-14-large-document-writer-goal-execution-plan.md');
const COVERAGE = join(ROOT, 'docs', 'plans', '.2026-06-14-large-document-writer-goal-execution-plan.coverage.json');
const GENERATION = join(ROOT, 'docs', 'plans', '.2026-06-14-large-document-writer-goal-execution-plan.generation.json');

function runGate(args: string[]) {
  return spawnSync(process.execPath, [CLI, 'goal-contract', 'release-gate', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

describe('goal contract public release gate', () => {
  it('passes when source-plan goal contract receipts are current and mapped', () => {
    const stdout = execFileSync(
      process.execPath,
      [
        CLI,
        'goal-contract',
        'release-gate',
        '--source',
        SOURCE,
        '--goal',
        GOAL,
        '--coverage',
        COVERAGE,
        '--generation',
        GENERATION,
        '--json',
      ],
      { cwd: ROOT, encoding: 'utf8' }
    );
    const payload = JSON.parse(stdout);

    expect(payload.ok).toBe(true);
    expect(payload.decision).toBe('pass');
    expect(payload.unmappedSourceObligations).toBe(0);
    expect(payload.coverageReceiptPath).toContain('coverage.json');
  });

  it('blocks missing, stale, or unmapped source-plan proof', () => {
    const temp = mkdtempSync(join(tmpdir(), 'goal-contract-release-gate-'));
    try {
      const coverage = join(temp, basename(COVERAGE));
      const generation = join(temp, basename(GENERATION));
      copyFileSync(COVERAGE, coverage);
      copyFileSync(GENERATION, generation);

      const missing = runGate([
        '--source',
        SOURCE,
        '--goal',
        GOAL,
        '--coverage',
        join(temp, 'missing.coverage.json'),
        '--generation',
        generation,
        '--json',
      ]);
      expect(missing.status).toBe(1);
      expect(JSON.parse(missing.stdout).blockingReasons).toContain('coverage_receipt_missing');

      const stale = JSON.parse(readFileSync(coverage, 'utf8'));
      stale.sourcePlanHash = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
      writeFileSync(coverage, `${JSON.stringify(stale, null, 2)}\n`, 'utf8');
      const staleResult = runGate([
        '--source',
        SOURCE,
        '--goal',
        GOAL,
        '--coverage',
        coverage,
        '--generation',
        generation,
        '--json',
      ]);
      expect(staleResult.status).toBe(1);
      expect(JSON.parse(staleResult.stdout).blockingReasons).toContain('source_hash_mismatch');

      stale.sourcePlanHash = JSON.parse(readFileSync(COVERAGE, 'utf8')).sourcePlanHash;
      stale.unmappedSourceObligations = ['SRC001'];
      writeFileSync(coverage, `${JSON.stringify(stale, null, 2)}\n`, 'utf8');
      const unmapped = runGate([
        '--source',
        SOURCE,
        '--goal',
        GOAL,
        '--coverage',
        coverage,
        '--generation',
        generation,
        '--json',
      ]);
      expect(unmapped.status).toBe(1);
      expect(JSON.parse(unmapped.stdout).blockingReasons).toContain('unmapped_source_obligations');
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
