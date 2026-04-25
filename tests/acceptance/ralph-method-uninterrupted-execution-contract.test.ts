import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ralph-method uninterrupted execution contract', () => {
  it('requires standalone-tasks to keep executing remaining scoped work until blocker or audit boundary', () => {
    const content = readFileSync('.claude/skills/bmad-standalone-tasks/SKILL.md', 'utf8');

    expect(content).toContain('不中断执行 contract');
    expect(content).toContain('连续完成当前作用域内的全部剩余 US/任务');
    expect(content).toContain('resume');
  });

  it('requires bug-assistant to keep executing remaining scoped work until blocker or post-audit boundary', () => {
    const content = readFileSync('.claude/skills/bmad-bug-assistant/SKILL.md', 'utf8');

    expect(content).toContain('不中断执行 contract');
    expect(content).toContain('连续完成当前作用域内的全部剩余 US/任务');
    expect(content).toContain('post-audit');
  });

  it('requires story-assistant to keep executing remaining scoped work until blocker or post-audit boundary', () => {
    const content = readFileSync('.claude/skills/bmad-story-assistant/SKILL.md', 'utf8');

    expect(content).toContain('continue through all remaining scoped User Stories/tasks');
    expect(content).toContain('post-audit is ready');
    expect(content).toContain('ralph-method tracking files');
  });

  it('requires speckit-workflow task execution to keep running remaining scoped tasks without milestone pauses', () => {
    const content = readFileSync('.claude/skills/speckit-workflow/SKILL.md', 'utf8');

    expect(content).toContain('不中断执行 contract');
    expect(content).toContain('continue through all remaining scoped tasks/User Stories in sequence');
    expect(content).toContain('ralph-method forced prefix');
    expect(content).toContain('main-agent-orchestration');
    expect(content).toContain('dispatch-plan');
    expect(content).toContain('pendingPacketStatus');
  });
});
