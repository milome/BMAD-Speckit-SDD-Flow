import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { listDimensionNamesEn, parseDimensionScores, stageToMode } from '../dimension-parser';

const FIXTURES = path.join(__dirname, 'fixtures');

describe('dimension-parser', () => {
  it('listDimensionNamesEn returns name_en from code-reviewer-config (TB.6)', () => {
    const cfg = path.join(__dirname, '../../../../_bmad/_config/code-reviewer-config.yaml');
    if (!fs.existsSync(cfg)) return;
    const en = listDimensionNamesEn('code', cfg);
    expect(en).toEqual(['Functionality', 'Code Quality', 'Test Coverage', 'Security']);
  });

  it('maps stage to mode with Story 5.2 rules', () => {
    expect(stageToMode('prd')).toBe('prd');
    expect(stageToMode('spec')).toBe('prd');
    expect(stageToMode('plan')).toBe('prd');
    expect(stageToMode('gaps')).toBe('prd');
    expect(stageToMode('tasks')).toBe('prd');
    expect(stageToMode('arch')).toBe('arch');
    expect(stageToMode('story')).toBe('code');
    expect(stageToMode('implement')).toBe('code');
    expect(stageToMode('post_impl')).toBe('code');
    expect(stageToMode('pr_review')).toBe('pr');
  });

  it('extracts weighted dimensions from /100 style report', () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report-with-dimensions.md'), 'utf-8');
    const scores = parseDimensionScores(content, 'prd');

    expect(scores.length).toBe(4);
    expect(scores[0]).toEqual({ dimension: '需求完整性', weight: 35, score: 90 });
    expect(scores[1]).toEqual({ dimension: '可测试性', weight: 25, score: 80 });
    expect(scores[2]).toEqual({ dimension: '一致性', weight: 25, score: 70 });
    expect(scores[3]).toEqual({ dimension: '可追溯性', weight: 15, score: 60 });
  });

  it('extracts dimensions without list markers', () => {
    const content = `
维度评分:
需求完整性: 90/100
可测试性: 80/100
`;
    const scores = parseDimensionScores(content, 'prd');
    expect(scores).toEqual([
      { dimension: '需求完整性', weight: 35, score: 90 },
      { dimension: '可测试性', weight: 25, score: 80 },
    ]);
  });

  it('returns empty array when report has no /100 dimensions', () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report.md'), 'utf-8');
    expect(parseDimensionScores(content, 'prd')).toEqual([]);
  });

  it('keeps only dimensions that exist in mode config', () => {
    const content = `
维度评分:
- 需求完整性: 88/100
- 不存在的维度: 99/100
`;
    const scores = parseDimensionScores(content, 'prd');
    expect(scores.length).toBe(1);
    expect(scores[0]).toEqual({ dimension: '需求完整性', weight: 35, score: 88 });
  });

  it('supports weighted sum calculation in orchestrator formula', () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report-with-dimensions.md'), 'utf-8');
    const scores = parseDimensionScores(content, 'prd');
    const weighted = scores.reduce((sum, current) => sum + (current.score * current.weight) / 100, 0);
    expect(weighted).toBe(78);
  });

  it('returns empty array when config file is missing', () => {
    const content = fs.readFileSync(path.join(FIXTURES, 'sample-prd-report-with-dimensions.md'), 'utf-8');
    const missingPath = path.join(process.cwd(), 'config', 'code-reviewer-config.not-exists.yaml');
    expect(parseDimensionScores(content, 'prd', missingPath)).toEqual([]);
  });

  it('parses English PRD dimension labels using name_en (T3.7)', () => {
    const content = `
维度评分:
- Requirements Completeness: 85/100
- Testability: 80/100
`;
    const scores = parseDimensionScores(content, 'prd');
    expect(scores.length).toBe(2);
    expect(scores[0].dimension).toBe('Requirements Completeness');
    expect(scores[0].weight).toBe(35);
    expect(scores[1].dimension).toBe('Testability');
    expect(scores[1].weight).toBe(25);
  });

  it('parses implement report with four code dimensions (audit-prompts §5.1)', () => {
    const content = fs.readFileSync(
      path.join(FIXTURES, 'sample-implement-report-with-four-dimensions.md'),
      'utf-8'
    );
    const scores = parseDimensionScores(content, 'code');

    expect(scores.length).toBe(4);
    const dimNames = scores.map((s) => s.dimension);
    expect(dimNames).toContain('功能性');
    expect(dimNames).toContain('代码质量');
    expect(dimNames).toContain('测试覆盖');
    expect(dimNames).toContain('安全性');

    expect(scores.find((s) => s.dimension === '功能性')).toEqual({
      dimension: '功能性',
      weight: 30,
      score: 85,
    });
    expect(scores.find((s) => s.dimension === '代码质量')).toEqual({
      dimension: '代码质量',
      weight: 30,
      score: 82,
    });
    expect(scores.find((s) => s.dimension === '测试覆盖')).toEqual({
      dimension: '测试覆盖',
      weight: 20,
      score: 78,
    });
    expect(scores.find((s) => s.dimension === '安全性')).toEqual({
      dimension: '安全性',
      weight: 20,
      score: 90,
    });
  });
});
