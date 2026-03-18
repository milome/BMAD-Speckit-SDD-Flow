/**
 * Story 8.2: 题目模板生成与 manifest 追加
 * Schema: scoring/eval-questions/MANIFEST_SCHEMA.md §3.1
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { EvalQuestionEntry } from './manifest-loader';

/**
 * 从 title 生成 slug：小写、空格→连字符、去除非字母数字；无效时返回 untitled
 * @param {string} title - Title to convert
 * @returns {string} Generated slug
 */
export function generateSlugFromTitle(title: string): string {
  const trimmed = String(title || '').trim();
  if (!trimmed) return 'untitled';
  const slug = trimmed
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'untitled';
}

/**
 * 从现有 questions 计算下一个 id（q001, q002, ...）
 * @param {EvalQuestionEntry[]} questions - List of existing questions
 * @returns {string} Next question ID
 */
export function generateNextQuestionId(questions: EvalQuestionEntry[]): string {
  let max = 0;
  for (const q of questions) {
    const m = q.id.match(/^q0*(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  const next = max + 1;
  return `q${String(next).padStart(3, '0')}`;
}

/**
 * 生成符合 MANIFEST_SCHEMA §3.1 的最小模板
 * @param {Object} params - Template parameters
 * @param {string} params.id - Question ID
 * @param {string} params.title - Question title
 * @param {string} params.date - Date string
 * @returns {string} Generated markdown template
 */
export function generateQuestionTemplate(params: {
  id: string;
  title: string;
  date: string;
}): string {
  return `# ${params.title} 审计报告

审计对象: ${params.id}
审计日期: ${params.date}
场景: eval_question

总体评级: A|B|C|D

维度评分:
1. {维度名}: {等级} ({分数}/{满分})
2. ...

问题清单:
1. [严重程度:高|中|低] 描述

通过标准:
- 总体评级A或B: 通过
`;
}

/**
 * 将新题目条目追加到 manifest.yaml
 * @param {string} versionDir - Version directory path
 * @param {EvalQuestionEntry} entry - Question entry to add
 * @returns {void}
 */
export function addQuestionToManifest(versionDir: string, entry: EvalQuestionEntry): void {
  const resolvedDir = path.isAbsolute(versionDir)
    ? versionDir
    : path.resolve(process.cwd(), versionDir);
  const manifestPath = path.join(resolvedDir, 'manifest.yaml');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const content = fs.readFileSync(manifestPath, 'utf-8');
  const raw = yaml.load(content) as unknown;

  if (!raw || typeof raw !== 'object' || !('questions' in raw)) {
    throw new Error(`Invalid manifest: missing 'questions' at ${manifestPath}`);
  }

  const questions = (raw as { questions: unknown[] }).questions;
  if (!Array.isArray(questions)) {
    throw new Error(`Invalid manifest: 'questions' must be an array at ${manifestPath}`);
  }

  const newEntry = {
    id: entry.id,
    title: entry.title,
    path: entry.path,
    ...(entry.difficulty && { difficulty: entry.difficulty }),
    ...(entry.tags && entry.tags.length > 0 && { tags: entry.tags }),
  };
  questions.push(newEntry);

  const newContent = yaml.dump(raw, { lineWidth: -1 });
  fs.writeFileSync(manifestPath, newContent, 'utf-8');
}
