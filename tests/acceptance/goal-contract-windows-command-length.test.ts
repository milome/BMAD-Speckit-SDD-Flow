import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  materializeStandaloneGoalJudgeHttpFixture,
  type StandaloneGoalJudgeHttpFixture,
} from '../helpers/standalone-goal-judge-http-fixture';

const ROOT = process.cwd();
const CLI = join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
const execFileAsync = promisify(execFile);

function largeSourcePlan(): string {
  const sections = Array.from({ length: 180 }, (_, index) =>
    [
      `## Execution Segment ${String(index + 1).padStart(3, '0')}`,
      '',
      `- Requirement ${index + 1}: write source-covered execution contract content without inline command payloads.`,
      '',
      '```powershell',
      `node scripts/check-${String(index + 1).padStart(3, '0')}.js --json`,
      '```',
      '',
    ].join('\n')
  );
  return [
    '# Large Source Plan',
    '',
    '## File Map',
    '',
    '- Modify `packages/bmad-speckit/src/generated/large-source-plan.ts`.',
    '',
    ...sections,
    '## Completion Criteria',
    '',
    '- Receipts must store paths and hashes only.',
    '',
  ].join('\n');
}

describe('goal-contract generate Windows command length regression', () => {
  it('uses path-only CLI arguments for large source documents', async () => {
    const root = mkdtempSync(join(tmpdir(), 'goal-contract-long-command-'));
    let judge: StandaloneGoalJudgeHttpFixture | undefined;
    try {
      judge = await materializeStandaloneGoalJudgeHttpFixture(root);
      const source = join(root, 'large-source-plan.md');
      const out = join(root, 'large-goal-execution-plan.md');
      writeFileSync(source, largeSourcePlan(), 'utf8');

      const { stdout } = await execFileAsync(
        process.execPath,
        [
          CLI,
          'goal-contract',
          'generate',
          '--entry',
          'standalone_goal_contract',
          '--source',
          source,
          '--out',
          out,
          '--json',
        ],
        { cwd: root, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
      );
      const payload = JSON.parse(stdout);
      const generationReceipt = JSON.parse(readFileSync(payload.generationReceiptPath, 'utf8'));

      expect(payload.ok).toBe(true);
      expect(existsSync(out)).toBe(true);
      expect(readFileSync(source, 'utf8').length).toBeGreaterThan(20_000);
      expect(JSON.stringify(generationReceipt)).not.toContain('node -e');
      expect(JSON.stringify(generationReceipt)).not.toContain('.tmp/*.cjs');
      expect(JSON.stringify(generationReceipt)).not.toContain(
        'write source-covered execution contract content without inline command payloads'.repeat(5)
      );
      expect(generationReceipt.sourcePlanPath).toBe(source.replace(/\\/g, '/'));
      expect(generationReceipt.goalContractHash).toMatch(/^sha256:/);
      expect(generationReceipt.writeReceipt.finalHash).toBe(
        generationReceipt.goalContractDocumentHash
      );
      expect(payload.goalJudgeDispatchCount).toBe(1);
      expect(judge.requests).toBe(1);
    } finally {
      if (judge) await judge.close();
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }, 120_000);
});
