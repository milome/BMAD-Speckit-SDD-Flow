/**
 * Acceptance Test: GAPS Agent Definition
 *
 * Validates that GAPS agent definition exists and follows the expected structure.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('GAPS Agent Definition', () => {
  const gapsAgentPath = resolve('.claude/agents/gaps.md');
  let content: string;

  it('should exist at .claude/agents/gaps.md', () => {
    expect(existsSync(gapsAgentPath)).toBe(true);
    content = readFileSync(gapsAgentPath, 'utf8');
  });

  it('should have valid markdown structure with header', () => {
    content = readFileSync(gapsAgentPath, 'utf8');
    expect(content).toMatch(/^# Agent: GAPS/);
  });

  it('should define Required Inputs section', () => {
    content = readFileSync(gapsAgentPath, 'utf8');
    expect(content).toMatch(/## Required Inputs/);
    expect(content).toMatch(/auditReportPath/);
    expect(content).toMatch(/stage/);
    expect(content).toMatch(/iterationCount/);
  });

  it('should define Process section with 4 steps', () => {
    content = readFileSync(gapsAgentPath, 'utf8');
    expect(content).toMatch(/## Process/);
    expect(content).toMatch(/1\. 解析审计报告/);
    expect(content).toMatch(/2\. Gap 分析/);
    expect(content).toMatch(/3\. 生成 GAPS 文档/);
    expect(content).toMatch(/4\. 更新 BMAD 状态/);
  });

  it('should define Output Format section', () => {
    content = readFileSync(gapsAgentPath, 'utf8');
    expect(content).toMatch(/## Output Format/);
    expect(content).toMatch(/gaps-\{stage\}-i\{iteration\}\.md/);
  });

  it('should define Integration section', () => {
    content = readFileSync(gapsAgentPath, 'utf8');
    expect(content).toMatch(/## Integration/);
    expect(content).toMatch(/被 BMAD Master 调用/);
  });

  it('should define Rules section', () => {
    content = readFileSync(gapsAgentPath, 'utf8');
    expect(content).toMatch(/## Rules/);
    expect(content).toMatch(/每个 finding 必须生成至少一个 fix/);
    expect(content).toMatch(/连续 3 轮/);
  });

  it('should include convergence tracking', () => {
    content = readFileSync(gapsAgentPath, 'utf8');
    expect(content).toMatch(/consecutive_no_gap_rounds/);
    expect(content).toMatch(/convergence_status/);
    expect(content).toMatch(/convergence_trend/);
  });

  it('should include escalation rules', () => {
    content = readFileSync(gapsAgentPath, 'utf8');
    expect(content).toMatch(/escalation_needed/);
    expect(content).toMatch(/重复出现超过 3 轮/);
  });
});
