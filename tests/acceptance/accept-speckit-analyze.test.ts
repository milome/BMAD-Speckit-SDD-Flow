/**
 * Acceptance Test: Speckit Analyze Agent Definition
 *
 * Validates that speckit-analyze agent definition exists and follows
 * the expected structure according to speckit-workflow SKILL.md §4.2.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('Speckit Analyze Agent Definition', () => {
  const agentPath = resolve('.claude/agents/speckit-analyze.md');

  it('should exist at .claude/agents/speckit-analyze.md', () => {
    expect(existsSync(agentPath)).toBe(true);
  });

  describe('Header and Role', () => {
    it('should have valid markdown header', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/^# Agent: Speckit Analyze/);
    });

    it('should define cross-artifact analysis role', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/跨 artifact/);
      expect(content).toMatch(/一致性/);
    });

    it('should mention embed in §4.2', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/§4\.2/);
    });
  });

  describe('Required Inputs', () => {
    it('should define tasksPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/tasksPath/);
    });

    it('should define planPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/planPath/);
    });

    it('should define specPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/specPath/);
    });

    it('should define gapsPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/gapsPath/);
    });
  });

  describe('Mandatory Startup', () => {
    it('should read tasks.md', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/读取 tasks/);
    });

    it('should read plan.md', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/读取 plan/);
    });

    it('should read spec.md', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/读取 spec/);
    });

    it('should detect artifact count', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/artifact.*数量/);
    });
  });

  describe('Step 1: Artifact Analysis', () => {
    it('should parse key information from artifacts', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Artifact 解析/);
    });

    it('should extract requirements from spec', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/需求条目/);
    });

    it('should extract phases from plan', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/实现阶段/);
    });

    it('should extract tasks count', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/任务数量/);
    });
  });

  describe('Step 2: Consistency Analysis', () => {
    it('should analyze requirement traceability', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/需求追溯/);
    });

    it('should check spec to plan alignment', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Spec.*Plan.*对齐/);
    });

    it('should check plan to tasks alignment', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Plan.*Tasks.*对齐/);
    });

    it('should check GAPS to tasks alignment', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/GAPS.*Tasks.*对齐/);
    });

    it('should analyze terminology consistency', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/术语/);
    });

    it('should analyze architecture consistency', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/架构/);
    });

    it('should analyze tech stack consistency', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/技术栈/);
    });

    it('should analyze acceptance criteria alignment', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/验收标准/);
    });
  });

  describe('Step 3: Generate Analysis Report', () => {
    it('should create analysis report', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Analysis Report/);
    });

    it('should have execution summary', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/执行摘要/);
    });

    it('should calculate consistency score', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/一致性评分/);
    });

    it('should categorize conflicts', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/P0.*阻断/);
    });

    it('should include impact analysis', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/影响分析/);
    });
  });

  describe('Step 4: Decision', () => {
    it('should have decision logic', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/决策/);
    });

    it('should trigger re-audit if P0 conflicts', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/重新执行.*审计/);
    });
  });

  describe('Analyze Rules', () => {
    it('should prohibit execution before tasks audit', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止.*审计未通过/);
    });

    it('should prohibit ignoring P0 conflicts', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/忽略.*P0/);
    });

    it('should require dynamic analysis depth', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/动态/);
    });

    it('should require term comparison table', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/术语对照表/);
    });

    it('should require dependency graph', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/依赖关系图/);
    });
  });

  describe('Trigger Conditions', () => {
    it('should trigger on tasks >= 10', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/tasks.*≥.*10/);
    });

    it('should trigger on multi-artifact', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/多个.*artifact/);
    });

    it('should skip for simple tasks', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/简单/);
    });
  });

  describe('Handoff', () => {
    it('should handoff to speckit-tasks', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/handoff.*speckit-tasks/);
    });

    it('should include analysisResult', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/analysisResult/);
    });

    it('should include consistencyScore', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/consistencyScore/);
    });

    it('should include conflictsFound', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/conflictsFound/);
    });
  });

  describe('Example Section', () => {
    it('should include example', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/## Example/);
    });

    it('should show artifact parsing', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/解析 Artifact/);
    });

    it('should show analysis report output', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Analysis Report 摘要/);
    });
  });

  describe('Appendix Generation', () => {
    it('should generate dependency graph', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/依赖图/);
    });

    it('should generate term table', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/术语对照表/);
    });

    it('should generate traceability matrix', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/追溯矩阵/);
    });
  });
});
