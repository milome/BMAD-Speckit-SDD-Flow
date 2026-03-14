import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('layer4 agents', () => {
  describe('bmad-layer4-speckit-specify.md', () => {
    const content = readFileSync('.claude/agents/layers/bmad-layer4-speckit-specify.md', 'utf8');

    it('outputs to specs/ (Cursor speckit format)', () => {
      expect(content).toContain('specs/');
      expect(content).toContain('epic-{epic}-{epic-slug}');
      expect(content).toContain('story-{story}-{story-slug}');
      expect(content).toContain('spec-E{epic}-S{story}.md');
    });

    it('has state file distinction table', () => {
      expect(content).toContain('状态文件区分');
      expect(content).toContain('bmad-progress.yaml');
      expect(content).toContain('五层架构状态控制');
    });

    it('has audit report path in specs/', () => {
      expect(content).toContain('AUDIT_spec-E{epic}-S{story}.md');
      expect(content).toMatch(/specs.*AUDIT_spec/);
    });

    it('mentions Cursor speckit format', () => {
      expect(content).toContain('Cursor speckit format');
    });
  });

  describe('bmad-layer4-speckit-plan.md', () => {
    const content = readFileSync('.claude/agents/layers/bmad-layer4-speckit-plan.md', 'utf8');

    it('outputs to specs/ (Cursor speckit format)', () => {
      expect(content).toContain('specs/');
      expect(content).toContain('plan-E{epic}-S{story}.md');
    });

    it('has state file distinction table', () => {
      expect(content).toContain('状态文件区分');
      expect(content).toContain('bmad-progress.yaml');
    });

    it('has audit report path in specs/', () => {
      expect(content).toContain('AUDIT_plan-E{epic}-S{story}.md');
      expect(content).toMatch(/specs.*AUDIT_plan/);
    });

    it('mentions Cursor speckit format', () => {
      expect(content).toContain('Cursor speckit format');
    });
  });

  describe('bmad-layer4-speckit-tasks.md', () => {
    const content = readFileSync('.claude/agents/layers/bmad-layer4-speckit-tasks.md', 'utf8');

    it('outputs tasks.md to specs/ (Cursor speckit format)', () => {
      expect(content).toContain('specs/');
      expect(content).toContain('tasks-E{epic}-S{story}.md');
    });

    it('outputs ralph files to _bmad-output/implementation-artifacts/', () => {
      expect(content).toContain('_bmad-output/implementation-artifacts/');
      expect(content).toContain('prd.tasks-E{epic}-S{story}.json');
      expect(content).toContain('progress.tasks-E{epic}-S{story}.txt');
    });

    it('creates ralph-method prd.json', () => {
      expect(content).toContain('prd.{stem}.json');
      expect(content).toContain('userStories');
      expect(content).toContain('"passes": false');
    });

    it('creates ralph-method progress.txt', () => {
      expect(content).toContain('progress.{stem}.txt');
      expect(content).toContain('[TDD-RED]');
      expect(content).toContain('[TDD-GREEN]');
      expect(content).toContain('[TDD-REFACTOR]');
    });

    it('has state file distinction table', () => {
      expect(content).toContain('重要区分');
      expect(content).toContain('ralph-method');
    });

    it('maps tasks to US', () => {
      expect(content).toContain('US-001');
      expect(content).toContain('involvesProductionCode');
    });

    it('mentions Cursor speckit format', () => {
      expect(content).toContain('Cursor speckit format');
    });
  });

  describe('bmad-layer4-speckit-implement.md', () => {
    const content = readFileSync('.claude/agents/layers/bmad-layer4-speckit-implement.md', 'utf8');

    it('reads tasks.md from specs/ (Cursor speckit format)', () => {
      expect(content).toContain('specs/');
      expect(content).toContain('tasks-E{epic}-S{story}.md');
    });

    it('outputs ralph files to _bmad-output/implementation-artifacts/', () => {
      expect(content).toContain('_bmad-output/implementation-artifacts/');
      expect(content).toContain('prd.tasks-E{epic}-S{story}.json');
      expect(content).toContain('progress.tasks-E{epic}-S{story}.txt');
    });

    it('outputs audit to specs/', () => {
      expect(content).toContain('AUDIT_implement-E{epic}-S{story}.md');
      expect(content).toMatch(/specs.*AUDIT_implement/);
    });

    it('requires prd.json before coding', () => {
      expect(content).toContain('必须存在');
      expect(content).toContain('prd.tasks-E{epic}-S{story}.json');
      expect(content).toContain('停止执行');
    });

    it('requires progress.txt before coding', () => {
      expect(content).toContain('progress.tasks-E{epic}-S{story}.txt');
      expect(content).toContain('停止');
      expect(content).toContain('rollback_to_tasks');
    });

    it('enforces TDD red-green-refactor', () => {
      expect(content).toContain('TDD 红绿灯');
      expect(content).toContain('RED → GREEN → REFACTOR');
      expect(content).toContain('禁止先写代码再补测试');
      expect(content).toContain('禁止跳过重构');
    });

    it('extracts TDD evidence from progress.txt', () => {
      expect(content).toContain('从 progress.txt 提取');
      expect(content).toContain('[TDD-RED]');
      expect(content).toContain('[TDD-GREEN]');
      expect(content).toContain('[TDD-REFACTOR]');
    });

    it('has state file distinction table', () => {
      expect(content).toContain('重要区分');
      expect(content).toContain('五层架构状态控制');
      expect(content).toContain('ralph-method US 追踪');
    });

    it('delegates to speckit-implement', () => {
      expect(content).toContain('speckit-implement');
      expect(content).toContain('delegate_to');
    });

    it('mentions Cursor speckit format', () => {
      expect(content).toContain('Cursor speckit format');
    });
  });
});
