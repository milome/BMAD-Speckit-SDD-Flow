/**
 * Story 5.5 B09: 规则自优化建议
 * 根据 clusterWeaknesses 与 records 统计，输出 rule-upgrade-suggestions.yaml
 */
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import { resolveRulesDir } from '../constants/path';
import type { WeaknessCluster } from './cluster-weaknesses';
import type { RunScoreRecord } from '../writer/types';

export interface RuleSuggestion {
  item_id: string;
  current_deduct: number;
  suggested_deduct: number;
  action: 'increase_deduct' | 'promote_to_veto' | 'add_new_item';
  reason: string;
  evidence_count: number;
  evidence_total: number;
}

interface ScoringItem {
  id?: string;
  deduct?: number;
  ref?: string;
  [k: string]: unknown;
}

function loadItemDeducts(rulesDir: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!fs.existsSync(rulesDir)) return map;

  const entries = fs.readdirSync(rulesDir);
  for (const name of entries) {
    if (!name.endsWith('-scoring.yaml')) continue;
    try {
      const content = fs.readFileSync(path.join(rulesDir, name), 'utf-8');
      const doc = yaml.load(content) as { items?: ScoringItem[] };
      const items = doc?.items ?? [];
      for (const it of items) {
        const id = it.id ?? it.ref;
        if (id && typeof it.deduct === 'number') {
          map.set(id, it.deduct);
        }
      }
    } catch {
      // skip invalid
    }
  }
  return map;
}

function countItemAppearances(records: RunScoreRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const rec of records) {
    const items = rec.check_items ?? [];
    for (const ci of items) {
      const id = ci.item_id;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
  }
  return map;
}

/**
 * 根据聚类与记录统计生成规则升级建议。
 * 不修改规则文件，仅输出 YAML 建议。
 * @param {WeaknessCluster[]} clusters - 弱点聚类结果
 * @param {RunScoreRecord[]} records - 评分记录
 * @param {string} [rulesDir] - scoring/rules 目录，默认 cwd/scoring/rules
 * @returns {RuleSuggestion[]} 规则升级建议列表
 */
export function generateRuleSuggestions(
  clusters: WeaknessCluster[],
  records: RunScoreRecord[],
  rulesDir?: string
): RuleSuggestion[] {
  const rulesPath = rulesDir ?? resolveRulesDir();
  const itemDeducts = loadItemDeducts(rulesPath);
  const evidenceTotals = countItemAppearances(records);

  const existingIds = new Set(itemDeducts.keys());
  const suggestions: RuleSuggestion[] = [];

  for (const cluster of clusters) {
    const evidenceCount = cluster.frequency;

    for (const itemId of cluster.primary_item_ids ?? []) {
      const total = evidenceTotals.get(itemId) ?? 0;
      if (total === 0) continue;

      const failureRate = evidenceCount / total;
      const currentDeduct = itemDeducts.get(itemId) ?? 0;

      if (failureRate > 0.8) {
        suggestions.push({
          item_id: itemId,
          current_deduct: currentDeduct,
          suggested_deduct: 0,
          action: 'promote_to_veto',
          reason: `失败率 ${(failureRate * 100).toFixed(1)}% > 80%`,
          evidence_count: evidenceCount,
          evidence_total: total,
        });
      } else if (failureRate > 0.5 && currentDeduct < 8) {
        suggestions.push({
          item_id: itemId,
          current_deduct: currentDeduct,
          suggested_deduct: currentDeduct + 2,
          action: 'increase_deduct',
          reason: `失败率 ${(failureRate * 100).toFixed(1)}% > 50%，且 deduct=${currentDeduct} < 8`,
          evidence_count: evidenceCount,
          evidence_total: total,
        });
      }
    }

    const keywords = cluster.keywords ?? [];
    const keywordMatch = keywords.some((kw) => {
      const lower = kw.toLowerCase();
      return [...existingIds].some((id) => id.toLowerCase().includes(lower) || lower.includes(id.toLowerCase()));
    });
    if (keywords.length > 0 && !keywordMatch) {
      suggestions.push({
        item_id: `new_${cluster.cluster_id}`,
        current_deduct: 0,
        suggested_deduct: 8,
        action: 'add_new_item',
        reason: `关键词 ${keywords.slice(0, 3).join('、')} 不匹配现有 item`,
        evidence_count: evidenceCount,
        evidence_total: evidenceTotals.get(cluster.primary_item_ids?.[0] ?? '') ?? 0,
      });
    }
  }

  return suggestions;
}

/**
 * 将规则建议序列化为 YAML 字符串。
 * @param {RuleSuggestion[]} suggestions - 规则建议列表
 * @returns {string} YAML 字符串
 */
export function formatRuleSuggestionsYaml(suggestions: RuleSuggestion[]): string {
  return yaml.dump({ suggestions }, { lineWidth: 120 });
}
