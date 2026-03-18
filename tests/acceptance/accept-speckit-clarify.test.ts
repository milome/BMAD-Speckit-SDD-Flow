/**
 * Acceptance Test: Speckit Clarify Agent Definition
 *
 * Validates that speckit-clarify agent definition exists and follows
 * the expected structure according to speckit-workflow SKILL.md §1.2.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('Speckit Clarify Agent Definition', () => {
  const agentPath = resolve('.claude/agents/speckit-clarify.md');

  it('should exist at .claude/agents/speckit-clarify.md', () => {
    expect(existsSync(agentPath)).toBe(true);
  });

  describe('Header and Role', () => {
    it('should have valid markdown header', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/^# Agent: Speckit Clarify/);
    });

    it('should define clarification role', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/澄清/);
      expect(content).toMatch(/模糊表述/);
    });

    it('should mention embed in §1.2', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/§1\.2/);
    });
  });

  describe('Required Inputs', () => {
    it('should define specPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/specPath/);
    });

    it('should define auditReportPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/auditReportPath/);
    });

    it('should define originalRequirementsPath input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/originalRequirementsPath/);
    });
  });

  describe('Mandatory Startup', () => {
    it('should read audit report', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/读取审计报告/);
    });

    it('should read current spec.md', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/读取当前 spec/);
    });

    it('should read constitution', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/constitution/);
    });
  });

  describe('Step 1: Analyze Ambiguities', () => {
    it('should extract 模糊表述标记', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/模糊表述/);
    });

    it('should categorize ambiguity types', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/需求模糊/);
      expect(content).toMatch(/技术模糊/);
      expect(content).toMatch(/术语模糊/);
    });

    it('should include range ambiguity', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/范围模糊/);
    });

    it('should include flow ambiguity', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/流程模糊/);
    });
  });

  describe('Step 2: Clarification Strategy', () => {
    it('should analyze original requirements', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/分析原始需求/);
    });

    it('should analyze technical feasibility', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/技术选项/);
    });

    it('should establish terminology', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/术语表/);
    });

    it('should draw flow diagrams', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/流程图/);
    });
  });

  describe('Step 3: Update spec.md', () => {
    it('should modify spec directly', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/直接修改/);
    });

    it('should add clarification comments', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/澄清注释/);
      expect(content).toMatch(/CLARIFIED/);
    });

    it('should update requirement mapping', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/需求映射/);
    });

    it('should show modification example', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/修改前/);
      expect(content).toMatch(/修改后/);
    });
  });

  describe('Step 4: Clarification Report', () => {
    it('should create clarification report', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/Clarification Report/);
    });

    it('should include clarification items summary', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/澄清项汇总/);
    });

    it('should include detailed clarifications', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/详细澄清/);
    });

    it('should include impact analysis', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/影响分析/);
    });
  });

  describe('Step 5: Trigger Re-audit', () => {
    it('should mark clarification complete', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/CLARIFICATION: COMPLETED/);
    });

    it('should trigger new audit', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/触发新一轮/);
    });

    it('should continue audit cycle', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/审计循环/);
    });
  });

  describe('Clarification Rules', () => {
    it('should prohibit expanding scope', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止.*扩大/);
    });

    it('should prohibit conflicting with constitution', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止.*constitution.*冲突/);
    });

    it('should prohibit vague clarification words', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/禁止.*可能.*大概/);
    });

    it('should prohibit over 3 rounds', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/最多.*3.*轮/);
    });

    it('should require clear result', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/明确.*无二义/);
    });
  });

  describe('Escalation Conditions', () => {
    it('should escalate if need to modify original requirements', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/修改原始需求文档/);
      expect(content).toMatch(/escalate/);
    });

    it('should escalate if architectural change', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/架构重大变更/);
    });

    it('should escalate after 3 rounds', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/连续.*3.*轮/);
    });
  });

  describe('Handoff', () => {
    it('should handoff to speckit-specify', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/handoff.*speckit-specify/);
    });

    it('should include clarificationCount', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/clarificationCount/);
    });

    it('should include updatedSections', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/updatedSections/);
    });
  });

  describe('Example Section', () => {
    it('should include example', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/## Example/);
    });

    it('should show audit report input', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/审计报告片段/);
    });

    it('should show process steps', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/处理过程/);
    });

    it('should show updated spec output', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/更新后的 spec/);
    });
  });

  describe('Trigger Condition', () => {
    it('should only trigger on 模糊表述标记', () => {
      const content = readFileSync(agentPath, 'utf8');
      expect(content).toMatch(/触发条件.*模糊表述/);
    });
  });
});
