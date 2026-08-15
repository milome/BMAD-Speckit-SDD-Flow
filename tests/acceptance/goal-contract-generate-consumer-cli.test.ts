import { exec, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  materializeStandaloneGoalJudgeHttpFixture,
  type StandaloneGoalJudgeHttpFixture,
} from '../helpers/standalone-goal-judge-http-fixture';

const ROOT = process.cwd();
const execAsync = promisify(exec);

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
      '- Modify `packages/bmad-speckit/src/commands/goal-contract.ts`.',
      '',
      '## Implementation Task Breakdown',
      '',
      '- Generate a source-covered goal contract.',
      '',
      '```powershell',
      'npx --no-install bmad-speckit goal-contract generate --entry standalone_goal_contract --source fixtures/goal-contract/source-plan.md --out generated/goal-execution-plan.md --json',
      '```',
      '',
      '## Completion Criteria',
      '',
      '- Coverage and generation receipts must exist.',
      '',
    ].join('\n'),
    'utf8'
  );
  return source;
}

describe('goal-contract generate consumer CLI', () => {
  it('runs from an installed consumer without consumer root scripts', async () => {
    const target = mkdtempSync(join(tmpdir(), 'goal-contract-consumer-'));
    let judge: StandaloneGoalJudgeHttpFixture | undefined;
    try {
      writeFileSync(
        join(target, 'package.json'),
        JSON.stringify({ name: 'goal-contract-consumer', version: '1.0.0', private: true }),
        'utf8'
      );
      run(`npm install --save-dev "file:${ROOT.replace(/\\/g, '/')}"`, target);
      rmSync(join(target, 'scripts'), { recursive: true, force: true });
      judge = await materializeStandaloneGoalJudgeHttpFixture(target);
      const source = writeSourcePlan(target);
      const out = join(target, 'generated', 'goal-execution-plan.md');

      const { stdout } = await execAsync(
        `npx --no-install bmad-speckit goal-contract generate --entry standalone_goal_contract --source "${source}" --out "${out}" --json`,
        {
          cwd: target,
          encoding: 'utf8',
          env: { ...process.env, BMAD_SKIP_CONSUMER_MCP_INSTALL: '1' },
          maxBuffer: 20 * 1024 * 1024,
        }
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
      expect(payload.goalJudgeDispatchCount).toBe(1);
      expect(judge.requests).toBe(1);

      const replay = await execAsync(
        `npx --no-install bmad-speckit goal-contract generate --entry standalone_goal_contract --source "${source}" --out "${out}" --json`,
        {
          cwd: target,
          encoding: 'utf8',
          env: { ...process.env, BMAD_SKIP_CONSUMER_MCP_INSTALL: '1' },
          maxBuffer: 20 * 1024 * 1024,
        }
      );
      expect(JSON.parse(replay.stdout)).toMatchObject({
        goalJudgeDispatchCount: 0,
        publicationStatus: 'reused',
        writeCount: 0,
      });
      expect(judge.requests).toBe(1);
    } finally {
      if (judge) await judge.close();
      rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }, 180_000);
});
