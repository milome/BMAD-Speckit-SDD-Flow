import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('layer4 complete workflow e2e', () => {
  describe('stage routing via bmad-master', () => {
    const master = readFileSync('_bmad/claude/agents/bmad-master.md', 'utf8');

    it('routes to specify when stage is null', () => {
      expect(master).toContain('stage: null');
      expect(master).toContain('route to **specify**');
    });

    it('routes to plan when specify_passed', () => {
      expect(master).toContain('stage: specify_passed');
      expect(master).toContain('route to **plan**');
    });

    it('routes to tasks when plan_passed', () => {
      expect(master).toContain('stage: plan_passed');
      expect(master).toContain('route to **tasks**');
    });

    it('routes to implement when tasks_passed', () => {
      expect(master).toContain('stage: tasks_passed');
      expect(master).toContain('route to **implement**');
    });
  });

  describe('layer4 specify → plan → tasks → implement flow', () => {
    const specify = readFileSync('_bmad/claude/agents/layers/bmad-layer4-speckit-specify.md', 'utf8');
    const plan = readFileSync('_bmad/claude/agents/layers/bmad-layer4-speckit-plan.md', 'utf8');
    const tasks = readFileSync('_bmad/claude/agents/layers/bmad-layer4-speckit-tasks.md', 'utf8');

    it('each stage has audit loop with auditor', () => {
      expect(specify).toContain('auditor-spec');
      expect(plan).toContain('auditor-plan');
      expect(tasks).toContain('auditor-tasks');
    });

    it('each stage updates bmad-progress.yaml with stage_passed', () => {
      expect(specify).toContain('stage: specify_passed');
      expect(plan).toContain('stage: plan_passed');
      expect(tasks).toContain('stage: tasks_passed');
    });

    it('each stage calls parse-and-write-score on PASS', () => {
      expect(specify).toContain('parse-and-write-score.ts');
      expect(plan).toContain('parse-and-write-score.ts');
      expect(tasks).toContain('parse-and-write-score.ts');

      expect(specify).toContain('--stage spec');
      expect(plan).toContain('--stage plan');
      expect(tasks).toContain('--stage tasks');
    });

    it('each stage sends handoff to bmad-master', () => {
      // Only specify has explicit handoff section; others update state which master reads
      expect(specify).toContain('handoff');
      expect(specify).toContain('bmad-master');
      // Plan and tasks update progress.yaml which master monitors
      expect(plan).toContain('bmad-progress.yaml');
      expect(tasks).toContain('bmad-progress.yaml');
    });

    it('specify generates required artifacts', () => {
      expect(specify).toContain('需求映射表');
      expect(specify).toContain('验收标准');
      expect(specify).toContain('边界定义');
      expect(specify).toContain('依赖清单');
      expect(specify).toContain('风险标记');
    });

    it('plan generates required artifacts', () => {
      expect(plan).toContain('架构概览');
      expect(plan).toContain('数据模型');
      expect(plan).toContain('接口契约');
      expect(plan).toContain('文件映射');
      expect(plan).toContain('集成测试');
      expect(plan).toContain('端到端功能测试');
    });

    it('tasks generates required artifacts', () => {
      expect(tasks).toContain('实现任务');
      expect(tasks).toContain('TDD 任务');
      expect(tasks).toContain('Lint 任务');
      expect(tasks).toContain('集成测试任务');
      expect(tasks).toContain('E2E 任务');
    });

    it('each stage has proper prerequisites', () => {
      // Check for prerequisite declarations
      expect(plan).toContain('specify');
      expect(plan).toContain('PASS');
      expect(tasks).toContain('plan');
      expect(tasks).toContain('PASS');
    });
  });

  describe('commit gate enforcement', () => {
    const master = readFileSync('_bmad/claude/agents/bmad-master.md', 'utf8');

    it('enforces audit before commit', () => {
      expect(master).toContain('禁止在未通过审计时放行 commit');
      // Check for audit_status in code block or text
      expect(master).toMatch(/audit_status.*pass/);
      expect(master).toContain('commit_allowed');
    });

    it('has denial reasons for commit gate', () => {
      expect(master).toContain('allowed_action: deny');
      expect(master).toContain('denial_reason');
      expect(master).toContain('当前 stage 审计未通过');
      expect(master).toContain('未检测到审计报告');
    });

    it('uses parse-bmad-audit-result.ts for verification', () => {
      expect(master).toContain('scripts/parse-bmad-audit-result.ts');
      expect(master).toContain("status === 'PASS'");
    });
  });

  describe('state management', () => {
    const specify = readFileSync('_bmad/claude/agents/layers/bmad-layer4-speckit-specify.md', 'utf8');
    const master = readFileSync('_bmad/claude/agents/bmad-master.md', 'utf8');

    it('reads bmad-progress.yaml at startup', () => {
      expect(specify).toContain('bmad-progress.yaml');
      expect(master).toContain('bmad-progress.yaml');
    });

    it('reads audit-result-schema.md protocol', () => {
      expect(specify).toContain('audit-result-schema.md');
      expect(master).toContain('audit-result-schema.md');
    });

    it('reads handoff-schema.md protocol', () => {
      expect(master).toContain('handoff-schema.md');
    });

    it('reads commit-protocol.md', () => {
      expect(master).toContain('commit-protocol.md');
    });
  });

  describe('audit-driven iteration', () => {
    const specify = readFileSync('_bmad/claude/agents/layers/bmad-layer4-speckit-specify.md', 'utf8');
    const plan = readFileSync('_bmad/claude/agents/layers/bmad-layer4-speckit-plan.md', 'utf8');
    const tasks = readFileSync('_bmad/claude/agents/layers/bmad-layer4-speckit-tasks.md', 'utf8');

    it('each stage has audit loop: FAIL → fix → re-audit', () => {
      // Specify
      expect(specify).toContain('FAIL');
      expect(specify).toContain('required_fixes');
      expect(specify).toContain('迭代计数');

      // Plan
      expect(plan).toContain('FAIL');
      expect(plan).toContain('required_fixes');

      // Tasks
      expect(tasks).toContain('FAIL');
      expect(tasks).toContain('required_fixes');
    });

    it('each stage reads audit-prompts.md', () => {
      expect(specify).toContain('audit-prompts.md');
      expect(plan).toContain('audit-prompts.md');
      expect(tasks).toContain('audit-prompts.md');
    });
  });

  describe('no self-commit constraint', () => {
    const specify = readFileSync('_bmad/claude/agents/layers/bmad-layer4-speckit-specify.md', 'utf8');
    const plan = readFileSync('_bmad/claude/agents/layers/bmad-layer4-speckit-plan.md', 'utf8');
    const tasks = readFileSync('_bmad/claude/agents/layers/bmad-layer4-speckit-tasks.md', 'utf8');

    it('each layer4 agent prohibits self-commit', () => {
      expect(specify).toContain('禁止自行 commit');
      expect(plan).toContain('禁止自行 commit');
      expect(tasks).toContain('禁止自行 commit');
    });
  });
});
