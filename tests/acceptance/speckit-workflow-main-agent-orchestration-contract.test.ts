import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES = [
  '.cursor/skills/speckit-workflow/SKILL.md',
  '.cursor/skills/speckit-workflow/SKILL.en.md',
  '.claude/skills/speckit-workflow/SKILL.md',
  '.claude/skills/speckit-workflow/SKILL.en.md',
  '_bmad/cursor/skills/speckit-workflow/SKILL.md',
  '_bmad/cursor/skills/speckit-workflow/SKILL.zh.md',
  '_bmad/claude/skills/speckit-workflow/SKILL.md',
  '_bmad/claude/skills/speckit-workflow/SKILL.zh.md',
] as const;

describe('speckit-workflow main-agent orchestration contract', () => {
  it('requires every active skill surface to route dispatch through main-agent-orchestration', () => {
    for (const file of FILES) {
      const content = readFileSync(file, 'utf8');
      expect(content).toContain('main-agent-orchestration');
      expect(content).toContain('dispatch-plan');
      expect(content).toContain('pendingPacketStatus');
      expect(content).toContain('mainAgentNextAction');
      expect(content).toContain('mainAgentReady');
      expect(content).toMatch(/runAuditorHost/);
      expect(content).toMatch(/compatibility summary fields only|兼容汇总字段|兼容字段/);
    }
  });
});
