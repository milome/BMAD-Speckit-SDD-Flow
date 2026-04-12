import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf8' });
}

describe('reviewer carrier consumer integration', () => {
  it('fresh consumer install exposes reviewer carriers for both cursor and claude hosts', () => {
    const target = mkdtempSync(join(tmpdir(), 'reviewer-carrier-consumer-'));
    try {
      run(`node scripts/init-to-root.js --full --agent cursor "${target}"`, repoRoot);
      run(`node scripts/init-to-root.js --full --agent claude-code "${target}"`, repoRoot);

      const cursorPath = join(target, '.cursor', 'agents', 'code-reviewer.md');
      const claudePath = join(target, '.claude', 'agents', 'code-reviewer.md');

      expect(existsSync(cursorPath)).toBe(true);
      expect(existsSync(claudePath)).toBe(true);
      expect(readFileSync(cursorPath, 'utf8')).toContain('## Shared Core Adapter');
      expect(readFileSync(claudePath, 'utf8')).toContain('## Shared Core Adapter');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 120000);
});
