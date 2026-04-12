import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ADAPTER_EXPECTATIONS = [
  ['_bmad/claude/agents/bmad-story-audit.md', 'story_audit'],
  ['_bmad/claude/agents/auditors/auditor-spec.md', 'spec_audit'],
  ['_bmad/claude/agents/auditors/auditor-plan.md', 'plan_audit'],
  ['_bmad/claude/agents/auditors/auditor-gaps.md', 'tasks_audit'],
  ['_bmad/claude/agents/auditors/auditor-tasks.md', 'tasks_audit'],
  ['_bmad/claude/agents/auditors/auditor-implement.md', 'implement_audit'],
  ['_bmad/claude/agents/auditors/auditor-bugfix.md', 'bugfix_doc_audit'],
  ['_bmad/claude/agents/auditors/auditor-tasks-doc.md', 'tasks_doc_audit'],
] as const;

describe('reviewer adapter alignment', () => {
  it('marks Claude reviewer executors as shared profile adapters instead of canonical truth', () => {
    for (const [file, profile] of ADAPTER_EXPECTATIONS) {
      const content = readFileSync(file, 'utf8');
      expect(content).toContain('SHARED-REVIEWER-ADAPTER');
      expect(content).toContain(`profile=${profile}`);
      expect(content).toContain('_bmad/core/agents/code-reviewer/metadata.json');
      expect(content).toContain('_bmad/core/agents/code-reviewer/profiles.json');
    }
  });

  it('marks cursor and claude reviewer carriers as shared core adapters', () => {
    const cursorCarrier = readFileSync('_bmad/cursor/agents/code-reviewer.md', 'utf8');
    const claudeCarrier = readFileSync('_bmad/claude/agents/code-reviewer.md', 'utf8');

    for (const content of [cursorCarrier, claudeCarrier]) {
      expect(content).toContain('## Shared Core Adapter');
      expect(content).toContain('bmad_code_reviewer');
      expect(content).toContain('_bmad/core/agents/code-reviewer/metadata.json');
      expect(content).toContain('_bmad/core/agents/code-reviewer/profiles.json');
      expect(content).toContain('_bmad/core/agents/code-reviewer/base-prompt.md');
      expect(content).toContain('must not redefine stage semantics');
    }
  });
});
