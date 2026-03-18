/**
 * Story 8.2: 题目模板生成与 slug 单元测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  generateSlugFromTitle,
  generateNextQuestionId,
  generateQuestionTemplate,
  addQuestionToManifest,
} from '../template-generator';

describe('generateSlugFromTitle', () => {
  it('title 转小写、空格换连字符、去除非字母数字', () => {
    expect(generateSlugFromTitle('Refactor Scoring')).toBe('refactor-scoring');
  });
  it('空 title 返回 untitled', () => {
    expect(generateSlugFromTitle('')).toBe('untitled');
  });
  it('仅非字母数字返回 untitled', () => {
    expect(generateSlugFromTitle('!@#$')).toBe('untitled');
  });
  it('多空格合并为单连字符', () => {
    expect(generateSlugFromTitle('  bug  fix  veto  ')).toBe('bug-fix-veto');
  });
});

describe('generateNextQuestionId', () => {
  it('空列表返回 q001', () => {
    expect(generateNextQuestionId([])).toBe('q001');
  });
  it('q001 存在返回 q002', () => {
    expect(generateNextQuestionId([{ id: 'q001', title: 'a', path: 'a.md' }])).toBe('q002');
  });
  it('q001..q003 存在返回 q004', () => {
    const qs = [
      { id: 'q001', title: 'a', path: 'a.md' },
      { id: 'q002', title: 'b', path: 'b.md' },
      { id: 'q003', title: 'c', path: 'c.md' },
    ];
    expect(generateNextQuestionId(qs)).toBe('q004');
  });
});

describe('generateQuestionTemplate', () => {
  it('模板含题目标题、id、日期、场景 eval_question', () => {
    const out = generateQuestionTemplate({
      id: 'q001',
      title: 'Refactor Scoring',
      date: '2026-03-06',
    });
    expect(out).toContain('# Refactor Scoring 审计报告');
    expect(out).toContain('审计对象: q001');
    expect(out).toContain('审计日期: 2026-03-06');
    expect(out).toContain('场景: eval_question');
  });
  it('模板含总体评级、维度评分、问题清单、通过标准占位', () => {
    const out = generateQuestionTemplate({
      id: 'q002',
      title: 'Bug Fix',
      date: '2026-03-06',
    });
    expect(out).toContain('总体评级:');
    expect(out).toContain('维度评分:');
    expect(out).toContain('问题清单:');
    expect(out).toContain('通过标准:');
  });
});

describe('addQuestionToManifest', () => {
  const FIXTURES = path.resolve(process.cwd(), 'packages', 'scoring', 'eval-questions', '__tests__', 'fixtures');
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(FIXTURES, `tmp-add-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('追加新条目到 manifest questions', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'manifest.yaml'),
      `questions:
  - id: q001
    title: Existing
    path: q001-existing.md
`,
      'utf-8'
    );
    fs.writeFileSync(path.join(tmpDir, 'q001-existing.md'), '# Old\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'q002-new.md'), '# New\n', 'utf-8');

    addQuestionToManifest(tmpDir, {
      id: 'q002',
      title: 'New Question',
      path: 'q002-new.md',
    });

    const content = fs.readFileSync(path.join(tmpDir, 'manifest.yaml'), 'utf-8');
    expect(content).toContain('q002');
    expect(content).toContain('New Question');
    expect(content).toContain('q002-new.md');
  });
});
