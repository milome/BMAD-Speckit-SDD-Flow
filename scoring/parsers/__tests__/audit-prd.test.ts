/**
 * T1: Layer 1 prd 审计报告解析器单元测试
 * AC-1: 注入样本 prd 报告，断言输出 schema 兼容
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { parsePrdReport } from '../audit-prd';
import type { RunScoreRecord } from '../../writer/types';
import { validateRunScoreRecord } from '../../writer/validate';

const FIXTURES = path.join(__dirname, 'fixtures');

describe('parsePrdReport', () => {
  it('parses sample prd report and returns schema-compatible RunScoreRecord', async () => {
    const reportPath = path.join(FIXTURES, 'sample-prd-report.md');
    const content = fs.readFileSync(reportPath, 'utf-8');

    const result = await parsePrdReport({
      content,
      runId: 'test-run-001',
      scenario: 'real_dev',
    });

    expect(result).toBeDefined();
    expect(result.run_id).toBe('test-run-001');
    expect(result.scenario).toBe('real_dev');
    expect(result.stage).toBe('prd');
    expect(result.phase_score).toBe(80); // B => 80
    expect(result.phase_weight).toBe(0.2); // 环节 1
    expect(result.check_items).toBeInstanceOf(Array);
    expect(result.check_items.length).toBeGreaterThan(0);
    expect(result.iteration_count).toBe(0);
    expect(result.iteration_records).toEqual([]);
    expect(result.first_pass).toBe(true);
    expect(result.timestamp).toBeDefined();
    expect(typeof result.timestamp).toBe('string');

    for (const item of result.check_items) {
      expect(item).toHaveProperty('item_id');
      expect(item).toHaveProperty('passed');
      expect(item).toHaveProperty('score_delta');
    }

    validateRunScoreRecord(result);
  });

  it('maps grade A to phase_score 100', async () => {
    const content = `
PRD审计报告
============
审计对象: test
审计日期: 2026-03-04
总体评级: A
维度评分:
1. 需求完整性: A (40/40)
2. 可测试性: A (30/30)
3. 一致性: A (30/30)
问题清单:
(无)
`;
    const result = await parsePrdReport({
      content,
      runId: 'r1',
      scenario: 'real_dev',
    });
    expect(result.phase_score).toBe(100);
  });

  it('throws when report file does not exist', async () => {
    await expect(
      parsePrdReport({
        reportPath: path.join(FIXTURES, 'nonexistent.md'),
        runId: 'r1',
        scenario: 'real_dev',
      })
    ).rejects.toThrow();
  });

  it('BUGFIX: maps problem descriptions to standard item_id when pattern matches', async () => {
    const content = `
PRD审计报告
============
总体评级: B
问题清单:
1. [严重程度:中] 部分需求缺少唯一ID 建议补充REQ-ID
2. [严重程度:低] 边界条件可进一步细化
通过标准: -
`;
    const result = await parsePrdReport({ content, runId: 'r1', scenario: 'real_dev' });
    expect(result.check_items.length).toBe(2);
    // "唯一ID" / "REQ-ID" -> prd_traceability_req_id
    expect(result.check_items[0].item_id).toBe('prd_traceability_req_id');
    // "边界条件" -> prd_req_completeness_boundary
    expect(result.check_items[1].item_id).toBe('prd_req_completeness_boundary');
  });

  it('BUGFIX: falls back to prd-issue-N when no mapping matches', async () => {
    const content = `
PRD审计报告
============
总体评级: C
问题清单:
1. [严重程度:高] 某未知问题描述xyz
通过标准: -
`;
    const result = await parsePrdReport({ content, runId: 'r1', scenario: 'real_dev' });
    expect(result.check_items.length).toBe(1);
    expect(result.check_items[0].item_id).toBe('prd-issue-1');
  });

  it('BUGFIX: uses prd_overall when 问题清单为空', async () => {
    const content = `
PRD审计报告
============
总体评级: A
问题清单:
(无)
通过标准: -
`;
    const result = await parsePrdReport({ content, runId: 'r1', scenario: 'real_dev' });
    expect(result.check_items.length).toBe(1);
    expect(result.check_items[0].item_id).toBe('prd_overall');
  });
});
