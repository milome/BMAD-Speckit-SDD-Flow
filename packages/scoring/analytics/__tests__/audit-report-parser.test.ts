/**
 * T2: audit-report-parser 单测
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { extractAuditReportSections } from '../audit-report-parser';

const PARSER_FIXTURES = path.join(__dirname, '../../parsers/__tests__/fixtures');

describe('extractAuditReportSections', () => {
  it('parses criticConclusion from ## 批判审计员结论', () => {
    const content = `## 批判审计员结论

已检查维度：遗漏需求点。
每维度结论：全部通过。

## 其他章节`;
    const result = extractAuditReportSections(content);
    expect(result.criticConclusion).toContain('已检查维度');
    expect(result.criticConclusion).toContain('每维度结论');
  });

  it('parses criticConclusion from ## 2. 批判审计员结论', () => {
    const content = `## 2. 批判审计员结论

结论内容在此

## 修改建议`;
    const result = extractAuditReportSections(content);
    expect(result.criticConclusion).toContain('结论内容在此');
  });

  it('parses gaps from 本轮存在 gap。具体项：1) A；2) B', () => {
    const content = `**本轮结论**：本轮存在 gap。具体项：1) A；2) B`;
    const result = extractAuditReportSections(content);
    expect(result.gaps).toEqual(['A', 'B']);
  });

  it('parses gaps=[] from 本轮无新 gap', () => {
    const content = `**本轮结论**：本轮无新 gap。`;
    const result = extractAuditReportSections(content);
    expect(result.gaps).toEqual([]);
  });

  it('parses suggestions from ## 修改建议', () => {
    const content = `## 修改建议

1) 在 T1 验收标准中补充
2) 在 T3 验收标准中补充`;
    const result = extractAuditReportSections(content);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions.some((s) => s.includes('T1'))).toBe(true);
  });

  it('parses suggestions from **修改建议**', () => {
    const content = `**修改建议**：1) 建议一；2) 建议二`;
    const result = extractAuditReportSections(content);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it('parses suggestions from | Gap | 修改建议 | table', () => {
    const content = `| Gap | 修改建议 |
|-----|----------|
| G1 | 建议内容 |`;
    const result = extractAuditReportSections(content);
    expect(result.suggestions).toContain('建议内容');
  });

  it('parses English headings (TB.4)', () => {
    const EN_REPORT = fs.readFileSync(
      path.join(PARSER_FIXTURES, 'sample-audit-sections.en.md'),
      'utf-8'
    );
    const r = extractAuditReportSections(EN_REPORT);
    expect(r.criticConclusion).toContain('Checked all dimensions');
    expect(r.gaps).toEqual(['A', 'B']);
    expect(r.suggestions.some((s) => s.includes('T1'))).toBe(true);
  });

  it('parses no new gaps in English', () => {
    const content = `**Round conclusion**: no new gaps`;
    const r = extractAuditReportSections(content);
    expect(r.gaps).toEqual([]);
  });
});
