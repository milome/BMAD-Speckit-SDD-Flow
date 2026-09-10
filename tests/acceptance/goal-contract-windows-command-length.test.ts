import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const CLI = join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
const execFileAsync = promisify(execFile);
const CANONICAL_FULL_SOURCE = join(
  ROOT,
  'packages',
  'bmad-speckit',
  'tests',
  'fixtures',
  'standalone-goal',
  'canonical-source-plan-v1-full.md'
);
const CANONICAL_LONG_IDENTIFIER = 'CORRESPONDING_AC_BEFORE_EACH_BYPASS_REMOVAL';
const CANONICAL_BODY_SENTINEL =
  '红灯命令：每条旁路删除前运行对应AC，确认测试能在旁路重新启用时失败；禁止源码字符串搜索作为唯一红灯。';

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('goal-contract generate Windows command length regression', () => {
  it('uses path-only CLI arguments for large source documents', async () => {
    const root = mkdtempSync(join(tmpdir(), 'goal-contract-long-command-'));
    try {
      const source = join(root, 'large-source-plan.md');
      const out = join(root, 'large-goal-execution-plan.md');
      const canonicalSourceBytes = readFileSync(CANONICAL_FULL_SOURCE);
      expect(canonicalSourceBytes.byteLength).toBeGreaterThanOrEqual(2_500_000);
      copyFileSync(CANONICAL_FULL_SOURCE, source);
      const copiedSourceBytes = readFileSync(source);
      expect(copiedSourceBytes).toEqual(canonicalSourceBytes);
      expect(sha256(copiedSourceBytes)).toBe(sha256(canonicalSourceBytes));
      expect(copiedSourceBytes.toString('utf8')).toContain(CANONICAL_LONG_IDENTIFIER);
      expect(copiedSourceBytes.toString('utf8')).toContain(CANONICAL_BODY_SENTINEL);

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
      const serializedGenerationReceipt = JSON.stringify(generationReceipt);

      expect(payload.ok).toBe(true);
      expect(existsSync(out)).toBe(true);
      expect(serializedGenerationReceipt).not.toContain('node -e');
      expect(serializedGenerationReceipt).not.toContain('.tmp/*.cjs');
      expect(serializedGenerationReceipt).not.toContain(CANONICAL_LONG_IDENTIFIER);
      expect(serializedGenerationReceipt).not.toContain(CANONICAL_BODY_SENTINEL);
      expect(generationReceipt.sourcePlanPath).toBe(source.replace(/\\/g, '/'));
      expect(generationReceipt.goalContractHash).toMatch(/^sha256:/);
      expect(generationReceipt.writeReceipt.finalHash).toBe(
        generationReceipt.goalContractDocumentHash
      );
      expect(payload.goalJudgeDispatchCount).toBe(0);
      expect(existsSync(payload.internalSemanticGateRef.path)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }, 120_000);
});
