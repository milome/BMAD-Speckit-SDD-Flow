import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('cursor skill continuation contract', () => {
  it('requires cursor standalone-tasks to keep executing remaining scoped work and to resume instead of stopping for manual continuation', () => {
    const content = readFileSync('.cursor/skills/bmad-standalone-tasks/SKILL.md', 'utf8');
    const mirror = readFileSync('_bmad/cursor/skills/bmad-standalone-tasks/SKILL.md', 'utf8');

    expect(content).toContain('resume');
    expect(content).toContain('Repeat audit until three consecutive no-gap rounds');
    expect(content).toContain('不中断执行 contract');
    expect(content).toContain('连续完成当前作用域内的全部剩余 US/任务');

    expect(mirror).toContain('resume');
    expect(mirror).toContain('重新发起审计直至连续 3 轮无 gap 收敛');
    expect(mirror).toContain('不中断执行 contract');
    expect(mirror).toContain('连续完成当前作用域内的全部剩余 US/任务');
  });

  it('requires cursor bug-assistant to keep rerunning post-audit until pass instead of stopping after one failed audit', () => {
    const content = readFileSync('.cursor/skills/bmad-bug-assistant/SKILL.md', 'utf8');
    const mirror = readFileSync('_bmad/cursor/skills/bmad-bug-assistant/SKILL.md', 'utf8');

    expect(content).toContain('Must be done when it fails');
    expect(content).toContain('Re-audit');
    expect(content).toContain('runAuditorHost');
    expect(content).toContain('不中断执行 contract');

    expect(mirror).toContain('未通过时必做（禁止只跑一轮即结束）');
    expect(mirror).toContain('再次发起');
    expect(mirror).toContain('runAuditorHost');
    expect(mirror).toContain('不中断执行 contract');
  });

  it('requires cursor story-assistant to keep the implementation subagent running until post-audit boundary', () => {
    const content = readFileSync('.cursor/skills/bmad-story-assistant/SKILL.md', 'utf8');
    const mirror = readFileSync('_bmad/cursor/skills/bmad-story-assistant/SKILL.md', 'utf8');

    expect(content).toContain('runAuditorHost');
    expect(content).toContain('If the audit conclusion is **failed**');
    expect(content).toContain('不中断执行 contract');
    expect(content).toContain('post-audit');

    expect(mirror).toContain('runAuditorHost');
    expect(mirror).toContain('若审计结论为**未通过**');
    expect(mirror).toContain('不中断执行 contract');
    expect(mirror).toContain('post-audit');
  });

  it('requires cursor speckit-workflow to iterate failed audits and keep task execution scoped until audit boundary', () => {
    const content = readFileSync('.cursor/skills/speckit-workflow/SKILL.md', 'utf8');
    const mirror = readFileSync('_bmad/cursor/skills/speckit-workflow/SKILL.md', 'utf8');

    expect(content).toContain('runAuditorHost');
    expect(content).toContain('main-agent-orchestration');
    expect(content).toContain('dispatch-plan');
    expect(content).toContain('pendingPacketStatus');
    expect(content).toContain('If it fails: **Iteratively execute the tasks in tasks.md');
    expect(content).toContain('不中断执行 contract');
    expect(content).toContain('当前作用域内全部剩余任务/User Stories');

    expect(mirror).toContain('runAuditorHost');
    expect(mirror).toContain('main-agent-orchestration');
    expect(mirror).toContain('dispatch-plan');
    expect(mirror).toContain('pendingPacketStatus');
    expect(mirror).toContain('若未通过：根据审计报告 **迭代执行 tasks.md 中审计未通过的任务**');
    expect(mirror).toContain('不中断执行 contract');
    expect(mirror).toContain('当前作用域内全部剩余任务/User Stories');
  });
});
