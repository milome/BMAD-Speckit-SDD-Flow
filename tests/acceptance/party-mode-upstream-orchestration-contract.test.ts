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
  it('keeps batch-window semantics on Claude entrypoints only and removes them from Cursor entrypoints', () => {
    const claudeFiles = [
      '_bmad/claude/skills/bmad-bug-assistant/SKILL.md',
      '_bmad/claude/skills/bmad-story-assistant/SKILL.md',
      '_bmad/claude/rules/bmad-bug-auto-party-mode-rule.md',
    ] as const;
    const cursorFiles = [
      '_bmad/cursor/skills/bmad-bug-assistant/SKILL.md',
      '_bmad/cursor/skills/bmad-story-assistant/SKILL.md',
      '_bmad/cursor/rules/bmad-bug-auto-party-mode-rule.mdc',
    ] as const;

    for (const file of claudeFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content).toContain('20 / 50 / 100');
      expect(content).toContain('checkpoint_window_ms = 15000');
      expect(content).toContain('S / F / C');
      expect(content).toContain('普通业务补充文本');
      expect(content).toContain('立即继续下一批');
      expect(content).toMatch(/heartbeat .*facilitator|facilitator .*heartbeat/u);
    }

    for (const file of cursorFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content).toContain('20 / 50 / 100');
      expect(content).not.toContain('checkpoint_window_ms = 15000');
      expect(content).not.toContain('S / F / C');
      expect(content).not.toContain('普通业务补充文本');
      expect(content).not.toContain('立即继续下一批');
      expect(content).not.toMatch(/heartbeat .*facilitator|facilitator .*heartbeat/u);
      expect(content).not.toMatch(/checkpoint 窗口|checkpoint window/iu);
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

  it('requires Claude upstream callers to compile explicit user selection into facilitator prompts', () => {
    const zhFiles = [
      '_bmad/claude/skills/bmad-bug-assistant/SKILL.md',
      '_bmad/claude/skills/bmad-bug-assistant/SKILL.zh.md',
      '_bmad/claude/skills/bmad-story-assistant/SKILL.md',
      '_bmad/claude/skills/bmad-story-assistant/SKILL.zh.md',
      '_bmad/claude/rules/bmad-bug-auto-party-mode-rule.md',
    ] as const;

    for (const file of zhFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content).toContain('## 用户选择');
      expect(content).toContain('强度:');
      expect(content).toMatch(/用户选择确认块|用户明确回复/u);
      expect(content).toContain('自动编译');
    }

    const enFile = '_bmad/claude/skills/bmad-story-assistant/SKILL.en.md';
    const enContent = readFileSync(enFile, 'utf8');
    expect(enContent).toContain('## 用户选择');
    expect(enContent).toContain('强度:');
    expect(enContent).toContain('compile');
  });
});
