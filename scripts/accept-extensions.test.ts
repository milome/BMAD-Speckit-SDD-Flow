import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('extension agents', () => {
  it('all agents follow protocol', () => {
    const standalone = readFileSync('.claude/agents/layers/bmad-standalone-tasks.md', 'utf8');
    const bugAgent = readFileSync('.claude/agents/layers/bmad-bug-agent.md', 'utf8');
    const reviewer = readFileSync('.claude/agents/layers/bmad-code-reviewer-lifecycle.md', 'utf8');

    for (const content of [standalone, bugAgent, reviewer]) {
      expect(content).toContain('bmad-progress.yaml');
      expect(content).toContain('audit-result-schema.md');
      expect(content).toContain('禁止自行 commit');
    }
  });

  it('requires standalone tasks and bug flows to match the final adaptation standard', () => {
    expect(existsSync('.claude/agents/auditors/auditor-tasks-doc.md')).toBe(true);
    expect(existsSync('.claude/agents/auditors/auditor-bugfix.md')).toBe(true);

    const standalone = readFileSync('.claude/agents/layers/bmad-standalone-tasks.md', 'utf8');
    const bugAgent = readFileSync('.claude/agents/layers/bmad-bug-agent.md', 'utf8');
    const reviewer = readFileSync('.claude/agents/layers/bmad-code-reviewer-lifecycle.md', 'utf8');
    const tasksDocAuditor = readFileSync('.claude/agents/auditors/auditor-tasks-doc.md', 'utf8');
    const bugfixAuditor = readFileSync('.claude/agents/auditors/auditor-bugfix.md', 'utf8');

    for (const content of [standalone, bugAgent]) {
      expect(content).toContain('Cursor Canonical Base');
      expect(content).toContain('Claude/OMC Runtime Adapter');
      expect(content).toContain('Repo Add-ons');
      expect(content).toContain('Primary Executor');
      expect(content).toContain('Fallback Strategy');
      expect(content).toContain('Runtime Contracts');
      expect(content).toContain('execution_summary');
      expect(content).toContain('handoff');
      expect(content).toContain('next_action');
      expect(content).toContain('ready');
    }

    expect(standalone).toContain('auditor-tasks-doc');
    expect(standalone).toContain('每批任务完成后进行实施审计');
    expect(standalone).toContain('Master 门控');
    expect(standalone).toContain('party-mode');
    expect(standalone).toMatch(/100\s*轮|至少\s*100\s*轮/);
    expect(standalone).toContain('完整复制 Cursor');
    expect(standalone).toContain('commit_request');
    expect(standalone).toContain('prd.{stem}.json');
    expect(standalone).toContain('progress.{stem}.txt');

    expect(bugAgent).toContain('根因分析');
    expect(bugAgent).toContain('BUGFIX');
    expect(bugAgent).toContain('auditor-bugfix');
    expect(bugAgent).toContain('先写复现测试');
    expect(bugAgent).toContain('实施后审计');
    expect(bugAgent).toContain('Master 门控');
    expect(bugAgent).toContain('party-mode');
    expect(bugAgent).toMatch(/100\s*轮|至少\s*100\s*轮/);
    expect(bugAgent).toContain('完整复制');
    expect(bugAgent).toContain('commit_request');

    expect(reviewer).toContain('Cursor Canonical Base');
    expect(reviewer).toContain('Claude/OMC Runtime Adapter');
    expect(reviewer).toContain('Repo Add-ons');
    expect(reviewer).toContain('Primary Executor');
    expect(reviewer).toContain('Fallback Strategy');
    expect(reviewer).toContain('Runtime Contracts');
    expect(reviewer).toContain('Pre-Audit');
    expect(reviewer).toContain('Audit Execution');
    expect(reviewer).toContain('Report Generation');
    expect(reviewer).toContain('Scoring Trigger');
    expect(reviewer).toContain('Iteration Tracking');
    expect(reviewer).toContain('Convergence Check');
    expect(reviewer).toContain('code-reviewer-config.yaml');
    expect(reviewer).toContain('stage-mapping.yaml');
    expect(reviewer).toContain('eval-lifecycle-report-paths.yaml');
    expect(reviewer).toContain('parse-and-write-score');

    for (const content of [tasksDocAuditor, bugfixAuditor]) {
      expect(content).toContain('## 批判审计员结论');
      expect(content).toContain('>70%');
      expect(content).toContain('完全覆盖、验证通过');
      expect(content).toMatch(/3\s*轮无\s*gap|连续\s*3\s*轮无\s*gap/);
      expect(content).toContain('直接修改被审文档');
      expect(content).toContain('reportPath');
      expect(content).toContain('convergence_status');
    }
  });
});
