import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES = [
  '.claude/skills/bmad-rca-helper/SKILL.en.md',
  '.claude/skills/bmad-rca-helper/SKILL.zh.md',
  '.claude/skills/bmad-standalone-tasks-doc-review/SKILL.en.md',
  '.claude/skills/bmad-standalone-tasks-doc-review/SKILL.zh.md',
  '.claude/skills/bmad-code-reviewer-lifecycle/SKILL.en.md',
  '.claude/skills/bmad-code-reviewer-lifecycle/SKILL.zh.md',
  '.cursor/skills/bmad-rca-helper/SKILL.en.md',
  '.cursor/skills/bmad-rca-helper/SKILL.zh.md',
  '.cursor/skills/bmad-standalone-tasks-doc-review/SKILL.en.md',
  '.cursor/skills/bmad-standalone-tasks-doc-review/SKILL.zh.md',
  '.cursor/skills/bmad-code-reviewer-lifecycle/SKILL.en.md',
  '.cursor/skills/bmad-code-reviewer-lifecycle/SKILL.zh.md',
  '_bmad/claude/skills/bmad-rca-helper/SKILL.en.md',
  '_bmad/claude/skills/bmad-rca-helper/SKILL.zh.md',
  '_bmad/claude/skills/bmad-standalone-tasks-doc-review/SKILL.en.md',
  '_bmad/claude/skills/bmad-standalone-tasks-doc-review/SKILL.zh.md',
  '_bmad/claude/skills/bmad-code-reviewer-lifecycle/SKILL.en.md',
  '_bmad/claude/skills/bmad-code-reviewer-lifecycle/SKILL.zh.md',
  '_bmad/cursor/skills/bmad-rca-helper/SKILL.en.md',
  '_bmad/cursor/skills/bmad-rca-helper/SKILL.zh.md',
  '_bmad/cursor/skills/bmad-standalone-tasks-doc-review/SKILL.en.md',
  '_bmad/cursor/skills/bmad-standalone-tasks-doc-review/SKILL.zh.md',
  '_bmad/cursor/skills/bmad-code-reviewer-lifecycle/SKILL.en.md',
  '_bmad/cursor/skills/bmad-code-reviewer-lifecycle/SKILL.zh.md',
] as const;

describe('helper skill language variants keep main-agent orchestration contract', () => {
  it('requires every active en/zh variant to mention the canonical main-agent dispatch surface', () => {
    for (const file of FILES) {
      const content = readFileSync(file, 'utf8');
      expect(content).toContain('main-agent-orchestration');
      expect(content).toContain('dispatch-plan');
      expect(content).toContain('mainAgentNextAction');
      expect(content).toContain('mainAgentReady');
    }
  });
});
