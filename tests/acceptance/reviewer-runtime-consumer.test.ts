import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf8' });
}

describe('reviewer runtime consumer integration', () => {
  it('fresh consumer install materializes cursor reviewer runtime carrier', () => {
    const target = mkdtempSync(join(tmpdir(), 'reviewer-consumer-'));
    try {
      run(`node scripts/init-to-root.js --full --agent cursor "${target}"`, repoRoot);
      const runtimePath = join(target, '.cursor', 'agents', 'code-reviewer.md');
      expect(existsSync(runtimePath)).toBe(true);
      const runtime = readFileSync(runtimePath, 'utf8');
      expect(runtime).toContain('## Shared Core Adapter');
      expect(runtime).toContain('_bmad/cursor/agents/code-reviewer.md');
      expect(runtime).toContain('_bmad/core/agents/code-reviewer/profiles.json');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 120000);
});
