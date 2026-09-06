import { exec, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const execAsync = promisify(exec);

async function runAsync(command: string, cwd: string) {
  try {
    return await execAsync(command, {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, BMAD_SKIP_CONSUMER_MCP_INSTALL: '1' },
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    const failure = error as { message?: string; stdout?: string; stderr?: string };
    throw new Error([
      failure.message,
      failure.stdout?.slice(0, 1600),
      failure.stderr?.slice(0, 1600),
    ].filter(Boolean).join('\n'));
  }
}

function run(command: string, cwd: string): string {
  return execSync(command, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      BMAD_SKIP_CONSUMER_MCP_INSTALL: '1',
    },
    maxBuffer: 20 * 1024 * 1024,
  });
}

function writeSourcePlan(root: string): string {
  const source = join(root, 'fixtures', 'goal-contract', 'source-plan.md');
  mkdirSync(join(root, 'fixtures', 'goal-contract'), { recursive: true });
  writeFileSync(
    source,
    [
      '# Consumer Source Plan',
      '',
      '## File Map',
      '',
      '- Create `generated/goal-execution-plan.md`.',
      '',
      '## Implementation Task Breakdown',
      '',
      '### Task CONSUMER-T01: Generate a source-covered goal contract',
      '',
      '- Acceptance: AC-CONSUMER.',
      '- EVD-CONSUMER-T01-01: Preserve the installed CLI proof output.',
      '- CMD-CONSUMER-T01-01: Run `node --version`.',
      '',
      '- [ ] TASK-CONSUMER: MUST generate a source-covered goal contract.',
      '',
      '```powershell',
      'npx --no-install bmad-speckit goal-contract generate --entry standalone_goal_contract --source fixtures/goal-contract/source-plan.md --out generated/goal-execution-plan.md --json',
      '```',
      '',
      '## Acceptance Criteria',
      '',
      '- [ ] AC-CONSUMER: MUST prove that coverage and generation receipts exist.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

describe('goal-contract generate consumer CLI', () => {
  it('runs from an installed consumer without consumer root scripts', async () => {
    const target = mkdtempSync(join(tmpdir(), 'goal-contract-consumer-'));
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'goal-contract-consumer', version: '1.0.0', private: true }),
        'utf8'
      );
      run(`npm install --save-dev "file:${ROOT.replace(/\\/g, '/')}"`, target);
      rmSync(join(target, 'scripts'), { recursive: true, force: true });
      const source = writeSourcePlan(target);
      const out = join(target, 'generated', 'goal-execution-plan.md');

      const { stdout } = await runAsync(
        `npx --no-install bmad-speckit goal-contract generate --entry standalone_goal_contract --source "${source}" --out "${out}" --json`,
        target
      );
      const payload = JSON.parse(stdout);

      expect(payload.ok).toBe(true);
      expect(payload.unmappedSourceObligations).toBe(0);
      expect(payload.sourceObligationCount).toBeGreaterThan(0);
      expect(existsSync(join(target, 'scripts'))).toBe(false);
      expect(existsSync(out)).toBe(true);
      expect(existsSync(payload.coverageReceiptPath)).toBe(true);
      expect(existsSync(payload.generationReceiptPath)).toBe(true);
      expect(readFileSync(out, 'utf8')).toContain('## Source Coverage Matrix');
      expect(readFileSync(out, 'utf8')).toContain('unmappedSourceObligations: 0');
      const coverage = JSON.parse(readFileSync(payload.coverageReceiptPath, 'utf8'));
      const generation = JSON.parse(readFileSync(payload.generationReceiptPath, 'utf8'));
      expect(coverage.sourcePlanHash).toBe(payload.sourcePlanHash);
      expect(coverage.goalContractHash).toBe(payload.goalContractHash);
      expect(generation.goalContractHash).toBe(payload.goalContractHash);
      expect(payload.goalJudgeDispatchCount).toBe(0);
      expect(existsSync(payload.internalSemanticGateRef.path)).toBe(true);

      const replay = await runAsync(
        `npx --no-install bmad-speckit goal-contract generate --entry standalone_goal_contract --source "${source}" --out "${out}" --json`,
        target
      );
      expect(JSON.parse(replay.stdout)).toMatchObject({
        goalJudgeDispatchCount: 0,
        publicationStatus: 'reused',
        writeCount: 0,
      });
    } finally {
      rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }, 180_000);
});
