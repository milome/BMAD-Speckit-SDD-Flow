import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('auditor agents', () => {
  describe('auditor-spec.md', () => {
    const content = readFileSync('_bmad/claude/agents/auditors/auditor-spec.md', 'utf8');

    it('contains model selection info section', () => {
      expect(content).toContain('## 模型选择信息');
      expect(content).toContain('auditor-spec.md');
    });

    it('has all required sections (§1-§5)', () => {
      expect(content).toContain('## §1 逐条对照验证');
      expect(content).toContain('§2');
      expect(content).toContain('§3');
      expect(content).toContain('## §5 结论');
    });

    it('contains critical auditor conclusion section', () => {
      expect(content).toContain('批判审计员结论');
      expect(content).toContain('50%');
      expect(content).toContain('已检查维');
    });

    it('includes all 10 critical auditor dimensions', () => {
      const dimensions = [
        '遗漏需求点',
        '边界未定义',
        '验收不可执行',
        '与前置文档矛盾',
        '孤岛模块',
        '伪实现/占位',
        'TDD 未执行',
        '路径漂移',
        '验收一致性',
        'lint 未通过或未配置',
      ];
      dimensions.forEach((dim) => {
        expect(content).toContain(dim);
      });
    });

    it('has correct document-phase dimensions in scoring block (4 dimensions)', () => {
      // Find the scoring block
      const scoringBlockMatch = content.match(/维度评分:[\s\S]*?(?=```)/);
      expect(scoringBlockMatch).toBeTruthy();
      const scoringBlock = scoringBlockMatch![0];

      // Should have document-phase dimensions (use prefix to avoid encoding issues with 性)
      expect(scoringBlock).toContain('需求完整');
      expect(scoringBlock).toContain('可测试');
      expect(scoringBlock).toContain('一致');
      expect(scoringBlock).toContain('可追溯');

      // Should NOT have code-mode dimensions
      expect(scoringBlock).not.toContain('功能');
      expect(scoringBlock).not.toContain('代码质量');
    });

    it('contains parseable scoring block format', () => {
      expect(content).toContain('总体评级:');
      expect(content).toContain('维度评分:');
      // Dimension suffix + separator may vary due to encoding; use flexible match
      expect(content).toMatch(/- 需求完整.{1,3}\[?(?:XX|\d{2,3})\]?\/100/);
      expect(content).toMatch(/- 可测试.{1,3}\[?(?:XX|\d{2,3})\]?\/100/);
      expect(content).toMatch(/- 一致.{1,3}\[?(?:XX|\d{2,3})\]?\/100/);
      expect(content).toMatch(/- 可追溯.{1,3}\[?(?:XX|\d{2,3})\]?\/100/);
    });

    it('requires direct document modification for gaps', () => {
      expect(content).toContain('直接修改');
      expect(content).toContain('禁止仅输出建议');
    });

    it('contains bmad-speckit score integration', () => {
      expect(content).toContain('bmad-speckit score');
      expect(content).toContain('--stage spec');
      expect(content).toContain('--event stage_audit_complete');
    });

    it('has AUDIT PASSED marker format', () => {
      expect(content).toContain('AUDIT: PASSED');
    });
  });

  describe('auditor-plan.md', () => {
    const content = readFileSync('_bmad/claude/agents/auditors/auditor-plan.md', 'utf8');

    it('contains model selection info section', () => {
      expect(content).toContain('## 模型选择信息');
      expect(content).toContain('auditor-plan.md');
    });

    it('has all required sections (§1-§5)', () => {
      expect(content).toContain('Step 2: §1');
      expect(content).toContain('Step 3: §2');
      expect(content).toContain('Step 4: §3');
      expect(content).toContain('## §5 结论');
    });

    it('contains critical auditor conclusion section', () => {
      expect(content).toContain('批判审计员结论');
      expect(content).toContain('50%');
    });

    it('has plan-specific checks (integration/E2E testing)', () => {
      expect(content).toContain('集成测试');
      expect(content).toContain('端到端');
      expect(content).toContain('E2E');
    });

    it('has correct document-phase dimensions (4 dimensions)', () => {
      expect(content).toContain('需求完整');
      expect(content).toContain('可测试');
      expect(content).toContain('一致性');
      expect(content).toContain('可追溯性');
    });

    it('contains parseable scoring block format', () => {
      expect(content).toContain('总体评级:');
      // Dimension suffix + separator may vary due to encoding; use flexible match
      expect(content).toMatch(/- 需求完整.{1,3}\[?(?:XX|\d{2,3})\]?\/100/);
    });

    it('contains bmad-speckit score integration', () => {
      expect(content).toContain('bmad-speckit score');
      expect(content).toContain('--stage plan');
    });
  });

  describe('auditor-tasks.md', () => {
    const content = readFileSync('_bmad/claude/agents/auditors/auditor-tasks.md', 'utf8');

    it('contains model selection info section', () => {
      expect(content).toContain('## 模型选择信息');
      expect(content).toContain('auditor-tasks.md');
    });

    it('has all required sections', () => {
      expect(content).toContain('Step 1:');
      expect(content).toContain('Step 2:');
      expect(content).toContain('Step 3:');
      expect(content).toContain('Step 5: §5');
      expect(content).toContain('## §5 结论');
    });

    it('contains critical auditor conclusion section', () => {
      expect(content).toContain('批判审计员结论');
      expect(content).toContain('50%');
    });

    it('has tasks-specific checks (test tasks)', () => {
      expect(content).toContain('集成测试任务');
      expect(content).toContain('E2E 测试任务');
      expect(content).toContain('Lint');
    });

    it('has correct document-phase dimensions (4 dimensions)', () => {
      expect(content).toContain('需求完整');
      expect(content).toContain('可测试');
      expect(content).toContain('一致性');
      expect(content).toContain('可追溯');
    });

    it('contains bmad-speckit score integration', () => {
      expect(content).toContain('bmad-speckit score');
      expect(content).toContain('--stage tasks');
    });
  });

  describe('auditor-implement.md', () => {
    const content = readFileSync('_bmad/claude/agents/auditors/auditor-implement.md', 'utf8');

    it('contains model selection info section', () => {
      expect(content).toContain('## 模型选择信息');
      expect(content).toContain('auditor-implement.md');
    });

    it('has TDD RED/GREEN/REFACTOR checks', () => {
      expect(content).toContain('[TDD-RED]');
      expect(content).toContain('[TDD-GREEN]');
      expect(content).toContain('[TDD-REFACTOR]');
      expect(content).toContain('US 检查');
    });

    it('has ralph-method tracking file checks', () => {
      expect(content).toContain('prd.json');
      expect(content).toContain('progress.txt');
    });

    it('contains critical auditor conclusion section', () => {
      expect(content).toContain('批判审计员结论');
      expect(content).toContain('50%');
    });

    it('has CODE MODE dimensions in scoring block (4 different dimensions)', () => {
      // Find the scoring block and verify it uses code mode dimensions
      const scoringBlockMatch = content.match(/维度评分:[\s\S]*?(?=```)/);
      expect(scoringBlockMatch).toBeTruthy();
      const scoringBlock = scoringBlockMatch![0];

      // Should have code mode dimensions (use prefix to avoid encoding issues with 性)
      expect(scoringBlock).toContain('功能');
      expect(scoringBlock).toContain('代码质量');
      expect(scoringBlock).toContain('测试覆盖');
      expect(scoringBlock).toContain('安全');

      // Should NOT have document-phase dimensions in the scoring block
      expect(scoringBlock).not.toContain('需求完整');
      expect(scoringBlock).not.toContain('可测试');
    });

    it('contains parseable scoring block with code dimensions', () => {
      expect(content).toContain('总体评级:');
      // Dimension suffix + separator may vary due to encoding; use flexible match
      expect(content).toMatch(/- 功能.{1,3}\[?(?:XX|\d{2,3})\]?\/100/);
      expect(content).toMatch(/- 代码质量.{1,3}\[?(?:XX|\d{2,3})\]?\/100/);
      expect(content).toMatch(/- 测试覆盖.{1,3}\[?(?:XX|\d{2,3})\]?\/100/);
      expect(content).toMatch(/- 安全.{1,3}\[?(?:XX|\d{2,3})\]?\/100/);
    });

    it('does NOT modify code directly (implement phase difference)', () => {
      expect(content).toContain('不直接修改');
      expect(content).toContain('主 Agent 委托');
    });

    it('contains bmad-speckit score integration', () => {
      expect(content).toContain('bmad-speckit score');
      expect(content).toContain('--stage implement');
    });

    it('notes difference from document audit', () => {
      expect(content).toContain('与文档审计的区别');
      expect(content).toContain('被审对象');
      expect(content).toContain('代码实现');
    });
  });
});
