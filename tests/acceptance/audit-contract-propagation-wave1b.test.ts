import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('audit contract propagation wave 1B', () => {
  it('requires both workflow audit prompts to check journey smoke, unlock, gap split, and shared path reference contracts', () => {
    const root = process.cwd();
    const promptFiles = [
      '_bmad/cursor/skills/speckit-workflow/references/audit-prompts.md',
      '_bmad/claude/skills/speckit-workflow/references/audit-prompts.md',
    ] as const;

    for (const relPath of promptFiles) {
      const prompts = readFileSync(path.join(root, relPath), 'utf8');

      expect(prompts).toContain('Smoke Task Chain');
      expect(prompts).toContain('Closure Task ID');
      expect(prompts).toContain('Journey Unlock');
      expect(prompts).toContain('Smoke Path Unlock');
      expect(prompts).toContain('Definition Gap Handling');
      expect(prompts).toContain('Implementation Gap Handling');
      expect(prompts).toContain('Shared Journey Ledger Path');
      expect(prompts).toContain('Shared Invariant Ledger Path');
      expect(prompts).toContain('Shared Trace Map Path');
      expect(prompts).toContain('same path reference');
    }
  });

  it('requires both post-implement audit rule files to treat the wave 1B journey contracts as strict convergence preconditions', () => {
    const root = process.cwd();
    const ruleFiles = [
      '_bmad/cursor/skills/speckit-workflow/references/audit-post-impl-rules.md',
      '_bmad/claude/skills/speckit-workflow/references/audit-post-impl-rules.md',
    ] as const;

    for (const relPath of ruleFiles) {
      const rules = readFileSync(path.join(root, relPath), 'utf8');

      expect(rules).toContain('Smoke Task Chain');
      expect(rules).toContain('Closure Task ID');
      expect(rules).toContain('Journey Unlock');
      expect(rules).toContain('Smoke Path Unlock');
      expect(rules).toContain('Definition Gap Handling');
      expect(rules).toContain('Implementation Gap Handling');
      expect(rules).toContain('Shared Journey Ledger Path');
      expect(rules).toContain('Shared Invariant Ledger Path');
      expect(rules).toContain('Shared Trace Map Path');
      expect(rules).toContain('same path reference');
    }
  });
});
