/**
 * T3: Layer 3 story 审计报告解析器单元测试
 * T4.2: AC-B05-7 LLM fallback integration
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { parseStoryReport } from '../audit-story';
import { ParseError } from '../audit-prd';
import { validateRunScoreRecord } from '../../writer/validate';

const FIXTURES = path.join(__dirname, 'fixtures');

describe('parseStoryReport', () => {
  it('parses sample story report (A/B/C/D format) and returns schema-compatible RunScoreRecord', async () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-story-report.md'), 'utf-8');

    const result = await parseStoryReport({
      content,
      runId: 'test-run-003',
      scenario: 'real_dev',
    });

    expect(result).toBeDefined();
    expect(result.run_id).toBe('test-run-003');
    expect(result.stage).toBe('story');
    expect(result.phase_score).toBe(100); // A => 100
    expect(result.phase_weight).toBe(0.2);
    expect(result.check_items).toBeInstanceOf(Array);
    validateRunScoreRecord(result);
  });

  it('throws when report file does not exist', async () => {
    await expect(
      parseStoryReport({
        reportPath: path.join(FIXTURES, 'nonexistent.md'),
        runId: 'r1',
        scenario: 'real_dev',
      })
    ).rejects.toThrow();
  });

  it('BUGFIX: maps problem descriptions to standard item_id when pattern matches', async () => {
    const content = `
Create Story 审计报告
====================
总体评级: B
问题清单:
1. [严重程度:低] 需求覆盖可加强
通过标准: -
`;
    const result = await parseStoryReport({ content, runId: 'r1', scenario: 'real_dev' });
    expect(result.check_items.length).toBe(1);
    expect(result.check_items[0].item_id).toBe('story_coverage_req');
  });

  it('BUGFIX: falls back to story-issue-N when no mapping matches', async () => {
    const content = `
Create Story 审计报告
====================
总体评级: C
问题清单:
1. [严重程度:中] 某未知问题xyz
通过标准: -
`;
    const result = await parseStoryReport({ content, runId: 'r1', scenario: 'real_dev' });
    expect(result.check_items.length).toBe(1);
    expect(result.check_items[0].item_id).toBe('story-issue-1');
  });

  it('BUGFIX: uses story_overall when 问题清单为空', async () => {
    const content = `
Create Story 审计报告
====================
总体评级: A
问题清单:
(无)
通过标准: -
`;
    const result = await parseStoryReport({ content, runId: 'r1', scenario: 'real_dev' });
    expect(result.check_items.length).toBe(1);
    expect(result.check_items[0].item_id).toBe('story_overall');
  });

  describe('AC-B05-7: LLM fallback integration', () => {
    const contentWithoutGrade = `
Create Story 审计报告
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

      const result = await parseStoryReport({
        content: contentWithoutGrade,
        runId: 'llm-story',
        scenario: 'real_dev',
      });
      expect(result.stage).toBe('story');
      expect(result.phase_score).toBe(80);
      validateRunScoreRecord(result);
    });

    it('正则失败 + 无 key → 抛 ParseError', async () => {
      delete process.env.SCORING_LLM_API_KEY;
      await expect(
        parseStoryReport({ content: contentWithoutGrade, runId: 'r1', scenario: 'real_dev' })
      ).rejects.toThrow(ParseError);
    });
  });
});
