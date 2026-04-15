import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILES = [
  '_bmad/claude/skills/bmad-bug-assistant/SKILL.md',
  '_bmad/cursor/skills/bmad-bug-assistant/SKILL.md',
  '_bmad/claude/skills/bmad-story-assistant/SKILL.md',
  '_bmad/cursor/skills/bmad-story-assistant/SKILL.md',
  '_bmad/claude/rules/bmad-bug-auto-party-mode-rule.md',
  '_bmad/cursor/rules/bmad-bug-auto-party-mode-rule.mdc',
] as const;

describe('party-mode upstream orchestration contract', () => {
  it('freezes Wave 4 intensity selection and checkpoint-window semantics in upstream entrypoints', () => {
    for (const file of FILES) {
      const content = readFileSync(file, 'utf8');

      expect(content).toContain('20 / 50 / 100');
      expect(content).toContain('checkpoint_window_ms = 15000');
      expect(content).toContain('S / F / C');
      expect(content).toContain('普通业务补充文本');
      expect(content).toContain('立即继续下一批');
      expect(content).toMatch(/heartbeat .*facilitator|facilitator .*heartbeat/u);
    }
  });

  it('requires low-tier final-output requests to upgrade to final_solution_task_list_100', () => {
    for (const file of FILES) {
      const content = readFileSync(file, 'utf8');

      expect(content).toContain('quick_probe_20');
      expect(content).toContain('decision_root_cause_50');
      expect(content).toContain('final_solution_task_list_100');
      expect(content).toContain('拒绝当前档位');
      expect(content).toContain('升级到 `final_solution_task_list_100`');
    }
  });
});
