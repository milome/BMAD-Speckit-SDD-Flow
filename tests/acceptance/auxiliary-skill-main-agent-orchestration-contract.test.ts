import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES = [
  '.claude/skills/bmad-rca-helper/SKILL.md',
  '.claude/skills/bmad-standalone-tasks-doc-review/SKILL.md',
  '.claude/skills/bmad-code-reviewer-lifecycle/SKILL.md',
  '.cursor/skills/bmad-rca-helper/SKILL.md',
  '.cursor/skills/bmad-standalone-tasks-doc-review/SKILL.md',
  '.cursor/skills/bmad-code-reviewer-lifecycle/SKILL.md',
  '_bmad/claude/skills/bmad-rca-helper/SKILL.md',
  '_bmad/claude/skills/bmad-standalone-tasks-doc-review/SKILL.md',
  '_bmad/claude/skills/bmad-code-reviewer-lifecycle/SKILL.md',
  '_bmad/cursor/skills/bmad-rca-helper/SKILL.md',
  '_bmad/cursor/skills/bmad-standalone-tasks-doc-review/SKILL.md',
  '_bmad/cursor/skills/bmad-code-reviewer-lifecycle/SKILL.md',
] as const;

describe('auxiliary skill main-agent orchestration contract', () => {
  it('requires auxiliary governed skills to route interactive dispatch through main-agent-orchestration', () => {
    for (const file of FILES) {
      const content = readFileSync(file, 'utf8');
      expect(content).toContain('main-agent-orchestration');
      expect(content).toContain('dispatch-plan');
      expect(content).toContain('pendingPacketStatus');
      expect(content).toContain('mainAgentNextAction');
      expect(content).toContain('mainAgentReady');
    }
  });
});
