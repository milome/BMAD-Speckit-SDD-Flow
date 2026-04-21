import { describe, expect, it } from 'vitest';
import { ensureReviewerRuntimeDefinition } from '../../scripts/reviewer-runtime-definition';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { cpSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function createFixtureRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'reviewer-carrier-runtime-definition-'));
  cpSync(path.join(process.cwd(), '_bmad'), path.join(root, '_bmad'), { recursive: true });
  mkdirSync(path.join(root, '.cursor', 'agents'), { recursive: true });
  mkdirSync(path.join(root, '.claude', 'agents'), { recursive: true });
  return root;
}

describe('reviewer carrier runtime definition', () => {
  it('materializes both host runtime carriers from canonical sources with shared core markers', () => {
    const root = createFixtureRoot();
    try {
      const receipts = ensureReviewerRuntimeDefinition(root);
      expect(receipts.map((entry) => entry.host)).toStrictEqual(['cursor', 'claude']);

      const cursorRuntime = readFileSync(path.join(root, '.cursor', 'agents', 'code-reviewer.md'), 'utf8');
      const claudeRuntime = readFileSync(path.join(root, '.claude', 'agents', 'code-reviewer.md'), 'utf8');

      expect(cursorRuntime).toContain('RUNTIME-MATERIALIZED reviewer');
      expect(cursorRuntime).toContain('source=_bmad/cursor/agents/code-reviewer.md');
      expect(claudeRuntime).toContain('RUNTIME-MATERIALIZED reviewer');
      expect(claudeRuntime).toContain('source=_bmad/claude/agents/code-reviewer.md');
      expect(cursorRuntime).toContain('_bmad/core/agents/code-reviewer/profiles.json');
      expect(claudeRuntime).toContain('_bmad/core/agents/code-reviewer/profiles.json');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
