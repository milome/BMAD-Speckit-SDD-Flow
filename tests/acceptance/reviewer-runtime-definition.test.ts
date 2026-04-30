import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cpSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ensureReviewerRuntimeDefinition,
  materializeReviewerDefinition,
} from '../../scripts/reviewer-runtime-definition';

function createFixtureRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'reviewer-runtime-definition-'));
  const repoRoot = process.cwd();
  cpSync(path.join(repoRoot, '_bmad'), path.join(root, '_bmad'), { recursive: true });
  mkdirSync(path.join(root, '.cursor', 'agents'), { recursive: true });
  mkdirSync(path.join(root, '.claude', 'agents'), { recursive: true });
  mkdirSync(path.join(root, '.codex', 'agents'), { recursive: true });
  return root;
}

describe('reviewer runtime definition', () => {
  it('materializes cursor runtime reviewer carrier from canonical source', () => {
    const root = createFixtureRoot();
    try {
      const receipt = materializeReviewerDefinition(root, 'cursor');
      expect(receipt.updated).toBe(true);
      const runtime = readFileSync(path.join(root, '.cursor', 'agents', 'code-reviewer.md'), 'utf8');
      expect(runtime).toContain('RUNTIME-MATERIALIZED reviewer');
      expect(runtime).toContain('source=_bmad/cursor/agents/code-reviewer.md');
      expect(runtime).toContain('_bmad/core/agents/code-reviewer/metadata.json');
      expect(runtime).toContain('_bmad/core/agents/code-reviewer/profiles.json');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ensures cursor, claude, and codex runtime reviewer carriers when runtime dirs exist', () => {
    const root = createFixtureRoot();
    try {
      const receipts = ensureReviewerRuntimeDefinition(root);
      expect(receipts.map((entry) => entry.host)).toStrictEqual(['cursor', 'claude', 'codex']);
      const cursorRuntime = readFileSync(path.join(root, '.cursor', 'agents', 'code-reviewer.md'), 'utf8');
      const claudeRuntime = readFileSync(path.join(root, '.claude', 'agents', 'code-reviewer.md'), 'utf8');
      const codexRuntime = readFileSync(path.join(root, '.codex', 'agents', 'code-reviewer.toml'), 'utf8');
      expect(cursorRuntime).toContain('source=_bmad/cursor/agents/code-reviewer.md');
      expect(claudeRuntime).toContain('source=_bmad/claude/agents/code-reviewer.md');
      expect(codexRuntime).toContain('source=_bmad/codex/agents/code-reviewer.toml');
      expect(codexRuntime).toMatch(/^# RUNTIME-MATERIALIZED reviewer/mu);
      expect(codexRuntime).not.toMatch(/^<!-- RUNTIME-MATERIALIZED reviewer/mu);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
