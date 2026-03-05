/**
 * Story 5.5 B08: prompt-optimizer 单测
 * AC-B08-1, AC-B08-2, AC-B08-3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  generatePromptSuggestions,
  formatPromptSuggestionsMarkdown,
  type PromptSuggestion,
  type WeaknessCluster,
} from '../prompt-optimizer';

describe('prompt-optimizer', () => {
  let tempDir: string;
  let skillsDir: string;
  let rulesDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `prompt-opt-${Date.now()}`);
    skillsDir = path.join(tempDir, 'skills');
    rulesDir = path.join(tempDir, '.cursor', 'rules');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(rulesDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('T3-1: matches .md files when keywords overlap ≥ 2 (AC-B08-1)', () => {
    const mdPath = path.join(skillsDir, 'foo-skill.md');
    fs.writeFileSync(mdPath, 'content with test and coverage keywords here', 'utf-8');

    const clusters: WeaknessCluster[] = [
      {
        cluster_id: 'c1',
        primary_item_ids: ['item1'],
        frequency: 4,
        keywords: ['test', 'coverage', 'quality'],
        severity_distribution: {},
        affected_stages: ['prd'],
      },
    ];
    const suggestions = generatePromptSuggestions(clusters, skillsDir);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    const match = suggestions.find((s) => s.target_file.includes('foo-skill'));
    expect(match).toBeDefined();
    expect(match!.section).toBe('全文');
  });

  it('T3-2: priority high when frequency≥5, medium when≥3, low otherwise (AC-B08-2)', () => {
    const mdPath = path.join(skillsDir, 'bar.md');
    fs.writeFileSync(mdPath, 'test coverage keyword overlap', 'utf-8');

    const clusters: WeaknessCluster[] = [
      {
        cluster_id: 'c_high',
        primary_item_ids: ['a'],
        frequency: 6,
        keywords: ['test', 'coverage'],
        severity_distribution: {},
        affected_stages: [],
      },
      {
        cluster_id: 'c_med',
        primary_item_ids: ['b'],
        frequency: 4,
        keywords: ['test', 'coverage'],
        severity_distribution: {},
        affected_stages: [],
      },
      {
        cluster_id: 'c_low',
        primary_item_ids: ['c'],
        frequency: 2,
        keywords: ['test', 'coverage'],
        severity_distribution: {},
        affected_stages: [],
      },
    ];
    const suggestions = generatePromptSuggestions(clusters, skillsDir);
    const high = suggestions.filter((s) => s.priority === 'high');
    const med = suggestions.filter((s) => s.priority === 'medium');
    const low = suggestions.filter((s) => s.priority === 'low');
    expect(high.length).toBeGreaterThanOrEqual(1);
    expect(med.length).toBeGreaterThanOrEqual(1);
    expect(low.length).toBeGreaterThanOrEqual(1);
  });

  it('T3-3: empty clusters → empty suggestions (AC-B08-3)', () => {
    const suggestions = generatePromptSuggestions([], skillsDir);
    expect(suggestions).toEqual([]);
  });

  it('T3-4: formatPromptSuggestionsMarkdown produces valid Markdown', () => {
    const empty = formatPromptSuggestionsMarkdown([]);
    expect(empty).toContain('暂无建议');

    const withData: PromptSuggestion[] = [
      {
        target_file: '/path/to/file.md',
        section: '全文',
        suggestion: 'add guidance',
        evidence: 'cluster c1',
        priority: 'high',
      },
    ];
    const out = formatPromptSuggestionsMarkdown(withData);
    expect(out).toContain('# Prompt 优化建议');
    expect(out).toContain('/path/to/file.md');
    expect(out).toContain('高');
  });
});
