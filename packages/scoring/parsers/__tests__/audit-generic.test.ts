import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseAuditReport } from '../audit-index';
import { extractCheckItems, extractOverallGrade, parseGenericReport } from '../audit-generic';
import { ParseError } from '../audit-prd';
import { validateRunScoreRecord } from '../../writer/validate';

const FIXTURES = path.join(__dirname, 'fixtures');

const CASES = [
  { stage: 'spec', fixture: 'sample-spec-report.md', expectedScore: 80 },
  { stage: 'plan', fixture: 'sample-plan-report.md', expectedScore: 100 },
  { stage: 'tasks', fixture: 'sample-tasks-report.md', expectedScore: 60 },
  { stage: 'implement', fixture: 'sample-implement-report.md', expectedScore: 80, phaseWeight: 0.25 },
] as const;

describe('audit-generic parser', () => {
  for (const testCase of CASES) {
    it(`parses ${testCase.stage} report via parseAuditReport`, async () => {
      const content = fs.readFileSync(path.join(FIXTURES, testCase.fixture), 'utf-8');
      const result = await parseAuditReport({
        content,
        stage: testCase.stage,
        runId: `run-${testCase.stage}`,
        scenario: 'real_dev',
      });

      expect(result.stage).toBe(testCase.stage);
      expect(result.phase_weight).toBe('phaseWeight' in testCase && testCase.phaseWeight != null ? testCase.phaseWeight : 0.2);
      expect(result.phase_score).toBe(testCase.expectedScore);
      expect(result.check_items.length).toBeGreaterThan(0);
      validateRunScoreRecord(result);
    });

    it(`extracts ${testCase.stage} check_items`, () => {
      const content = fs.readFileSync(path.join(FIXTURES, testCase.fixture), 'utf-8');
      const items = extractCheckItems(content, testCase.stage);

      expect(items.length).toBeGreaterThan(0);
      expect(items[0].passed).toBe(false);
      expect(items[0].score_delta).toBeLessThan(0);
    });

    it(`throws ParseError when ${testCase.stage} report misses grade`, async () => {
      const content = fs
        .readFileSync(path.join(FIXTURES, testCase.fixture), 'utf-8')
        .replace(/总体评级:\s*[ABCD]/, '总体评级:');
      delete process.env.SCORING_LLM_API_KEY;

      await expect(
        parseGenericReport({
          content,
          stage: testCase.stage,
          runId: `bad-${testCase.stage}`,
          scenario: 'real_dev',
          phaseWeight: 0.2,
        })
      ).rejects.toBeInstanceOf(ParseError);
    });
  }

  describe('AC-B05-7: LLM fallback integration (generic)', () => {
    const contentWithoutGrade = `
Spec 审计报告
=============
（无总体评级）
`;
    const originalEnv = process.env;

    afterEach(() => {
      vi.unstubAllGlobals();
      process.env = { ...originalEnv };
    });

    it('正则失败 + 有 key + LLM 成功 → 返回 RunScoreRecord (spec stage)', async () => {
      process.env.SCORING_LLM_API_KEY = 'test-key';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                grade: 'C',
                issues: [{ severity: '中', description: 'spec 问题' }],
                veto_items: [],
              }),
            },
          }],
        }),
      }));

      const result = await parseAuditReport({
        content: contentWithoutGrade,
        stage: 'spec',
        runId: 'llm-spec',
        scenario: 'real_dev',
      });
      expect(result.stage).toBe('spec');
      expect(result.phase_score).toBe(60);
      expect(result.check_items.length).toBeGreaterThan(0);
    });

    it('正则失败 + 无 key → 抛 ParseError (generic)', async () => {
      delete process.env.SCORING_LLM_API_KEY;
      await expect(
        parseGenericReport({
          content: contentWithoutGrade,
          stage: 'spec',
          runId: 'r1',
          scenario: 'real_dev',
          phaseWeight: 0.2,
        })
      ).rejects.toThrow(ParseError);
    });
  });

  describe('English report headings (E15-S2)', () => {
    it('extractOverallGrade matches Overall Grade / Overall rating', () => {
      expect(extractOverallGrade('Intro\n\nOverall Grade: B\n')).toBe('B');
      expect(extractOverallGrade('Overall rating: C')).toBe('C');
    });

    it('extractCheckItems parses Issue List and Severity', () => {
      const content = `
Issue List:
1. [Severity: Medium] Missing edge case

Pass Criteria:
ok
`;
      const items = extractCheckItems(content, 'spec');
      expect(items.some((i) => !i.passed && i.note.includes('edge'))).toBe(true);
    });

    it('treats Issue List (none) as empty pass', () => {
      const content = `
Overall Grade: A

Issue List:
(none)

Pass Criteria:
ok
`;
      const items = extractCheckItems(content, 'spec');
      expect(items.some((i) => i.passed && i.note.includes('问题清单为空'))).toBe(true);
    });

    it('parses problem line with Recommendation suffix (English)', () => {
      const content = `
Overall Grade: C

Issue List:
1. [Severity: High] Missing edge case Recommendation: add tests

Pass Criteria:
no
`;
      const items = extractCheckItems(content, 'spec');
      expect(items.some((i) => !i.passed && i.note.includes('Missing edge'))).toBe(true);
    });

    it('parseGenericReport succeeds on English headings', async () => {
      const content = `
Overall Grade: A

Issue List:
1. [Severity: Low] minor

Pass Criteria:
yes
`;
      delete process.env.SCORING_LLM_API_KEY;
      const r = await parseGenericReport({
        content,
        stage: 'spec',
        runId: 'en-1',
        scenario: 'real_dev',
        phaseWeight: 0.2,
      });
      expect(r.phase_score).toBe(100);
    });
  });
});
