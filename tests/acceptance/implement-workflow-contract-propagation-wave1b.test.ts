import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('implement/workflow contract propagation wave 1B', () => {
  it('requires speckit implement to load journey-level smoke, closure, unlock, and gap contracts before execution', () => {
    const root = process.cwd();
    const implementCommand = readFileSync(
      path.join(root, '_bmad', 'speckit', 'commands', 'speckit.implement.md'),
      'utf8'
    );

    expect(implementCommand).toContain('Smoke Task Chain');
    expect(implementCommand).toContain('Closure Task ID');
    expect(implementCommand).toContain('Journey Unlock');
    expect(implementCommand).toContain('Smoke Path Unlock');
    expect(implementCommand).toContain('Definition Gap Handling');
    expect(implementCommand).toContain('Implementation Gap Handling');
  });

  it('requires speckit implement to preserve shared ledger and trace-map path references for multi-agent execution', () => {
    const root = process.cwd();
    const implementCommand = readFileSync(
      path.join(root, '_bmad', 'speckit', 'commands', 'speckit.implement.md'),
      'utf8'
    );

    expect(implementCommand).toContain('Shared Journey Ledger Path');
    expect(implementCommand).toContain('Shared Invariant Ledger Path');
    expect(implementCommand).toContain('Shared Trace Map Path');
    expect(implementCommand).toContain('same path reference');
  });

  it('requires both speckit workflow variants to propagate the same journey contracts in tasks generation and task execution rules', () => {
    const root = process.cwd();
    const workflowFiles = [
      '_bmad/cursor/skills/speckit-workflow/SKILL.md',
      '_bmad/claude/skills/speckit-workflow/SKILL.md',
    ] as const;

    for (const relPath of workflowFiles) {
      const workflow = readFileSync(path.join(root, relPath), 'utf8');

      expect(workflow).toContain('Smoke Task Chain');
      expect(workflow).toContain('Closure Task ID');
      expect(workflow).toContain('Journey Unlock');
      expect(workflow).toContain('Smoke Path Unlock');
      expect(workflow).toContain('Definition Gap Handling');
      expect(workflow).toContain('Implementation Gap Handling');
      expect(workflow).toContain('Shared Journey Ledger Path');
      expect(workflow).toContain('Shared Invariant Ledger Path');
      expect(workflow).toContain('Shared Trace Map Path');
      expect(workflow).toContain('same path reference');
    }
  });
});
