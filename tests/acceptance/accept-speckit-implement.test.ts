/**
 * Acceptance Test: Speckit Implement Agent Definition
 *
 * Validates that speckit-implement agent definition exists and follows
 * the expected structure according to speckit-workflow SKILL.md §5.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('Speckit Implement Agent Definition', () => {
  const agentPath = resolve('.claude/agents/speckit-implement.md');

  it('should exist at .claude/agents/speckit-implement.md', () => {
    expect(existsSync(agentPath)).toBe(true);
  });

  describe('Header and Role', () => {
    it('should have valid markdown header', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/^# Agent: Speckit Implement/);
    });

    it('should define TDD红绿灯模式 role', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/TDD 红绿灯模式/);
      expect(content).toMatch(/15 条铁律/);
    });
  });

  describe('Required Inputs', () => {
    it('should define tasksPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/tasksPath/);
    });

    it('should define epic/story inputs', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/epic/);
      expect(content).toMatch(/story/);
    });

    it('should define mode input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/mode/);
    });
  });

  describe('Mandatory Startup', () => {
    it('should read tasks.md', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/读取任务文档/);
    });

    it('should read plan.md and IMPLEMENTATION_GAPS.md', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/plan\.md/);
      expect(content).toMatch(/IMPLEMENTATION_GAPS\.md/);
    });

    it('should check ralph-method files', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/prd\./);
      expect(content).toMatch(/progress\./);
    });
  });

  describe('Step 1: Ralph-Method Pre-check', () => {
    it('should define prd.json schema', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/userStories/);
      expect(content).toMatch(/involvesProductionCode/);
      expect(content).toMatch(/passes/);
    });

    it('should define progress.txt format', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/\[TDD-RED\]/);
      expect(content).toMatch(/\[TDD-GREEN\]/);
      expect(content).toMatch(/\[TDD-REFACTOR\]/);
    });

    it('should pre-fill TDD slots with _pending_', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/_pending_/);
    });

    it('should use TodoWrite for tracking', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/TodoWrite/);
    });
  });

  describe('Step 3: TDD Cycle', () => {
    it('should define RED phase', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/红灯阶段/);
      expect(content).toMatch(/\[TDD-RED\]/);
    });

    it('should define GREEN phase', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/绿灯阶段/);
      expect(content).toMatch(/\[TDD-GREEN\]/);
    });

    it('should define REFACTOR phase', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/重构阶段/);
      expect(content).toMatch(/\[TDD-REFACTOR\]/);
    });

    it('should require REFACTOR cannot be skipped', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止省略/);
      expect(content).toMatch(/无论是否有具体重构动作/);
    });

    it('should update prd.json passes=true after each US', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/passes.*true/);
    });

    it('should update tasks.md checkbox [ ] to [x]', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/\[ \].*\[x\]/);
    });
  });

  describe('Lint Enforcement', () => {
    it('should require lint check', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Lint/);
    });

    it('should require zero errors and warnings', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/无错误.*无警告/);
    });
  });

  describe('Step 5: Final Audit §5.2', () => {
    it('should call code-review for final audit', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/code-review/);
      expect(content).toMatch(/§5\.2/);
    });

    it('should enforce strict convergence (3 rounds)', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/strict/);
      expect(content).toMatch(/连续.*3.*轮/);
    });

    it('should trigger bmad-speckit score', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/bmad-speckit score/);
      expect(content).toMatch(/stage implement/);
    });
  });

  describe('15 Rules Enforcement', () => {
    it('should reference all 15 rules', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/15 条铁律/);
    });

    it('should prohibit starting without prd/progress', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止.*prd.*progress.*开始/);
    });

    it('should prohibit writing code before tests', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止.*先写生产代码/);
    });

    it('should prohibit skipping REFACTOR', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止.*跳过.*重构/);
    });

    it('should prohibit batch TDD records', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止.*集中补写/);
    });
  });

  describe('Handoff', () => {
    it('should define handoff to bmad-master', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/handoff.*bmad-master/);
    });

    it('should include tddSummary in handoff', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/tddSummary/);
    });
  });

  describe('Example Section', () => {
    it('should include progress example', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/## Example/);
      expect(content).toMatch(/Progress:/);
    });
  });
});
