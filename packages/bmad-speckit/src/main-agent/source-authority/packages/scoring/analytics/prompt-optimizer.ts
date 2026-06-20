/**
 * Story 5.5 B08: Prompt 模板优化建议
 * 根据 clusterWeaknesses 输出匹配 skills/ 与 .cursor/rules/ 下 .md 文件
 */
import * as fs from 'fs';
import * as path from 'path';
import type { WeaknessCluster } from './cluster-weaknesses';

export type { WeaknessCluster };

export interface PromptSuggestion {
  target_file: string;
  section: string;
  suggestion: string;
  evidence: string;
  priority: 'high' | 'medium' | 'low';
}

function collectMdFiles(dir: string, base?: string): string[] {
  const baseDir = base ?? dir;
  const result: string[] = [];
  if (!fs.existsSync(dir)) return result;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      result.push(...collectMdFiles(full, baseDir));
    } else if (e.name.endsWith('.md')) {
      result.push(path.relative(baseDir, full));
    }
  }
  return result;
}

function keywordOverlap(keywords: string[], content: string): number {
  const lower = content.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) count++;
  }
  return count;
}

function priorityFromFrequency(frequency: number): 'high' | 'medium' | 'low' {
  if (frequency >= 5) return 'high';
  if (frequency >= 3) return 'medium';
  return 'low';
}

/**
 * 根据聚类结果生成 Prompt 优化建议。
 * 遍历 skillsDir 和 .cursor/rules 下 .md 文件，keywords 与文件内容交集≥2 则匹配。
 * @param {WeaknessCluster[]} clusters - 弱点聚类结果
 * @param {string} [skillsDir] - skills 根目录，默认 cwd/skills
 * @returns {PromptSuggestion[]} Prompt 优化建议列表
 */
export function generatePromptSuggestions(
  clusters: WeaknessCluster[],
  skillsDir?: string
): PromptSuggestion[] {
  const cwd = process.cwd();
  const skillsBase = skillsDir ?? path.join(cwd, 'skills');
  const rulesBase = path.join(cwd, '.cursor', 'rules');
  const suggestions: PromptSuggestion[] = [];

  const skillsFiles = collectMdFiles(skillsBase).map((f) => path.join(skillsBase, f));
  const rulesFiles = collectMdFiles(rulesBase).map((f) => path.join(rulesBase, f));
  const allFiles = [...new Set([...skillsFiles, ...rulesFiles])];

  for (const cluster of clusters) {
    const keywords = cluster.keywords ?? [];
    const priority = priorityFromFrequency(cluster.frequency);
    const evidence = `cluster ${cluster.cluster_id}, frequency=${cluster.frequency}, keywords=${keywords.join(', ')}`;

    for (const filePath of allFiles) {
      let content: string;
      try {
        content = fs.readFileSync(filePath, 'utf-8');
      } catch {
        continue;
      }
      const overlap = keywordOverlap(keywords, content);
      if (overlap >= 2) {
        suggestions.push({
          target_file: filePath,
          section: 'full document',
          suggestion: `Consider adding guidance related to: ${keywords.slice(0, 3).join(', ')}`,
          evidence,
          priority,
        });
      }
    }
  }

  return suggestions;
}

/**
 * 将 Prompt 建议格式化为 Markdown 报告。
 * @param {PromptSuggestion[]} suggestions - Prompt 建议列表
 * @returns {string} Markdown 报告
 */
export function formatPromptSuggestionsMarkdown(suggestions: PromptSuggestion[]): string {
  if (suggestions.length === 0) return '# Prompt optimization suggestions\n\n(none)\n';
  const lines: string[] = [
    '# Prompt optimization suggestions',
    '',
    `Total: ${suggestions.length} suggestion(s).`,
    '',
  ];
  const byPriority = { high: 'high', medium: 'medium', low: 'low' };
  for (const s of suggestions) {
    lines.push(`## ${s.target_file}`, '');
    lines.push(`- **Priority**: ${byPriority[s.priority]}`);
    lines.push(`- **Scope**: ${s.section}`);
    lines.push(`- **Suggestion**: ${s.suggestion}`);
    lines.push(`- **Evidence**: ${s.evidence}`);
    lines.push('');
  }
  return lines.join('\n');
}
