/**
 * T2: Layer 1 arch 审计报告解析器单元测试
 * T4.2: AC-B05-7 LLM fallback integration
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { parseArchReport } from '../audit-arch';
import { ParseError } from '../audit-prd';
import { validateRunScoreRecord } from '../../writer/validate';

const FIXTURES = path.join(__dirname, 'fixtures');

describe('parseArchReport', () => {
  it('parses sample arch report and returns schema-compatible RunScoreRecord', async () => {
    const reportPath = path.join(FIXTURES, 'sample-arch-report.md');
    const content = fs.readFileSync(reportPath, 'utf-8');

    const result = await parseArchReport({
      content,
      runId: 'test-run-002',
      scenario: 'real_dev',
    });

    expect(result).toBeDefined();
    expect(result.run_id).toBe('test-run-002');
    expect(result.stage).toBe('arch');
    expect(result.phase_score).toBe(100); // A => 100
    expect(result.phase_weight).toBe(0.2);
    expect(result.check_items).toBeInstanceOf(Array);
    expect(result.iteration_count).toBe(0);
    expect(result.iteration_records).toEqual([]);
    expect(result.first_pass).toBe(true);

    validateRunScoreRecord(result);
  });

  it('throws when report file does not exist', async () => {
    await expect(
      parseArchReport({
        reportPath: path.join(FIXTURES, 'nonexistent.md'),
        runId: 'r1',
        scenario: 'real_dev',
      })
    ).rejects.toThrow();
  });

  it('BUGFIX: maps problem descriptions to standard item_id when pattern matches', async () => {
    const content = `
Architecture审计报告
====================
总体评级: B
问题清单:
1. [严重程度:低] 可补充更多ADR示例
通过标准: -
`;
    const result = await parseArchReport({ content, runId: 'r1', scenario: 'real_dev' });
    expect(result.check_items.length).toBe(1);
    expect(result.check_items[0].item_id).toBe('arch_security_threat_model');
  });

  it('BUGFIX: falls back to arch-issue-N when no mapping matches', async () => {
    const content = `
Architecture审计报告
====================
总体评级: C
问题清单:
1. [严重程度:中] 某未知问题xyz
通过标准: -
`;
    const result = await parseArchReport({ content, runId: 'r1', scenario: 'real_dev' });
    expect(result.check_items.length).toBe(1);
    expect(result.check_items[0].item_id).toBe('arch-issue-1');
  });

  it('BUGFIX: uses arch_overall when no problem section', async () => {
    const content = `
Architecture审计报告
====================
总体评级: A
维度评分: -
下一步行动: -
`;
    const result = await parseArchReport({ content, runId: 'r1', scenario: 'real_dev' });
    expect(result.check_items.length).toBe(1);
    expect(result.check_items[0].item_id).toBe('arch_overall');
  });

  describe('AC-B05-7: LLM fallback integration', () => {
    const contentWithoutGrade = `
Architecture审计报告
====================
（无总体评级）
`;
    const originalEnv = process.env;

    afterEach(() => {
      vi.unstubAllGlobals();
      process.env = { ...originalEnv };
    });

    it('正则失败 + 有 key + LLM 成功 → 返回 RunScoreRecord', async () => {
      process.env.SCORING_LLM_API_KEY = 'test-key';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                grade: 'B',
                issues: [],
                veto_items: [],
              }),
            },
          }],
        }),
      }));

      const result = await parseArchReport({
        content: contentWithoutGrade,
        runId: 'llm-arch',
        scenario: 'real_dev',
      });
      expect(result.stage).toBe('arch');
      expect(result.phase_score).toBe(80);
      validateRunScoreRecord(result);
    });

    it('正则失败 + 无 key → 抛 ParseError', async () => {
      delete process.env.SCORING_LLM_API_KEY;
      await expect(
        parseArchReport({ content: contentWithoutGrade, runId: 'r1', scenario: 'real_dev' })
      ).rejects.toThrow(ParseError);
    });
  });
});
