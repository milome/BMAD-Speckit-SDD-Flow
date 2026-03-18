/**
 * Acceptance Test: Speckit Checklist Agent Definition
 *
 * Validates that speckit-checklist agent definition exists and follows
 * the expected structure according to speckit-workflow SKILL.md §2.2.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('Speckit Checklist Agent Definition', () => {
  const agentPath = resolve('.claude/agents/speckit-checklist.md');

  it('should exist at .claude/agents/speckit-checklist.md', () => {
    expect(existsSync(agentPath)).toBe(true);
  });

  describe('Header and Role', () => {
    it('should have valid markdown header', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/^# Agent: Speckit Checklist/);
    });

    it('should define quality checklist role', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/质量检查清单/);
    });

    it('should mention embed in §2.2', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/§2\.2/);
    });
  });

  describe('Required Inputs', () => {
    it('should define planPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/planPath/);
    });

    it('should define specPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/specPath/);
    });

    it('should define constitutionPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/constitutionPath/);
    });
  });

  describe('Mandatory Startup', () => {
    it('should read plan.md', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/读取 plan/);
    });

    it('should read spec.md', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/读取 spec/);
    });

    it('should detect complexity indicators', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/复杂度指标/);
    });

    it('should check module count', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/模块数量/);
    });

    it('should check dependency count', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/外部依赖/);
    });
  });

  describe('Step 1: Generate Checklist', () => {
    it('should include complexity assessment', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/复杂度评估/);
    });

    it('should have threshold evaluation', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/阈值/);
    });

    it('should generate dynamic checklist', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Quality Checklist/);
    });
  });

  describe('Checklist Categories', () => {
    it('should include requirement completeness', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/需求完整性/);
    });

    it('should include architecture clarity', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/架构清晰度/);
    });

    it('should include consistency checks', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/一致性/);
    });

    it('should include feasibility checks', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/可行性/);
    });

    it('should include test plan checks', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/测试计划/);
    });

    it('should include complexity specific checks', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/复杂度专项/);
    });
  });

  describe('Step 2: Execute Checklist', () => {
    it('should check item by item', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/逐项检查/);
    });

    it('should have status indicators', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/通过/);
      expect(content).toMatch(/警告/);
    });

    it('should identify issues with location', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/位置.*plan/);
    });
  });

  describe('Step 3: Generate Report', () => {
    it('should create checklist report', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Checklist Report/);
    });

    it('should have execution summary', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/执行摘要/);
    });

    it('should categorize issues', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/P0/);
      expect(content).toMatch(/P1/);
      expect(content).toMatch(/P2/);
    });

    it('should include impact analysis', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/影响分析/);
    });

    it('should have conclusion', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/结论/);
    });
  });

  describe('Step 4: Decision', () => {
    it('should have decision logic', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/决策/);
    });

    it('should trigger re-audit if issues found', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/重新执行/);
    });

    it('should proceed if no issues', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/进入.*GAPS/);
    });
  });

  describe('Checklist Rules', () => {
    it('should prohibit execution before plan audit', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止.*审计未通过/);
    });

    it('should prohibit ignoring P0 issues', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/忽略.*P0.*必须修复/);
    });

    it('should require dynamic checklist', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/动态生成/);
    });

    it('should require issue grading', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/问题分级/);
    });
  });

  describe('Trigger Conditions', () => {
    it('should trigger on multi-module', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/多模块/);
    });

    it('should trigger on complex dependencies', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/复杂依赖/);
    });

    it('should skip for simple plans', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/单模块简单功能/);
    });
  });

  describe('Handoff', () => {
    it('should handoff to speckit-plan', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/handoff.*speckit-plan/);
    });

    it('should include checklistResult', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/checklistResult/);
    });

    it('should include issuesFound count', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/issuesFound/);
    });
  });

  describe('Example Section', () => {
    it('should include example', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/## Example/);
    });

    it('should show complexity detection', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/复杂度检测/);
    });

    it('should show checklist report output', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Checklist Report 摘要/);
    });
  });
});
