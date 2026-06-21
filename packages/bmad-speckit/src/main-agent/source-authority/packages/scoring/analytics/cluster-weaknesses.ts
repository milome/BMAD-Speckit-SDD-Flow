import type { RunScoreRecord } from '../writer/types';

/**
 * 弱点聚类结果：item_id、频率、关键词、严重度分布、影响阶段。
 */
export interface WeaknessCluster {
  cluster_id: string;
  primary_item_ids: string[];
  frequency: number;
  keywords: string[];
  severity_distribution: Record<string, number>;
  affected_stages: string[];
}

const STOPWORDS = new Set([
  '的',
  '了',
  '是',
  '在',
  '与',
  '和',
  '等',
  'the',
  'a',
  'an',
  'is',
  'are',
  'and',
  'or',
]);
const WORD_SPLIT_RE = /[\s,，。；：!?、]+/;

function mapSeverity(scoreDelta: number | null | undefined): '高' | '中' | '低' {
  if (scoreDelta == null) return '低';
  if (scoreDelta <= -10) return '高';
  if (scoreDelta <= -5) return '中';
  return '低';
}

function extractKeywords(notes: string[]): string[] {
  const freq: Record<string, number> = {};
  for (const note of notes) {
    if (!note || typeof note !== 'string') continue;
    const tokens = note.split(WORD_SPLIT_RE).filter((t) => t.length > 0);
    for (const t of tokens) {
      const lower = t.toLowerCase();
      if (!STOPWORDS.has(t) && !STOPWORDS.has(lower)) {
        freq[t] = (freq[t] ?? 0) + 1;
      }
    }
  }
  const sorted = Object.entries(freq)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 5)
    .map(([w]) => w);
  return sorted;
}

/**
 * 对评分记录中的未通过项进行聚类，输出按频率排序的 WeaknessCluster。
 * @param {RunScoreRecord[]} records - 评分记录
 * @param {number} [minFrequency=2] - 最小出现次数阈值，默认 2
 * @returns {WeaknessCluster[]} 聚类结果
 */
export function clusterWeaknesses(
  records: RunScoreRecord[],
  minFrequency: number = 2
): WeaknessCluster[] {
  if (records.length === 0) return [];

  const itemFreq: Record<string, number> = {};
  const itemNotes: Record<string, string[]> = {};
  const itemSeverities: Record<string, ('高' | '中' | '低')[]> = {};
  const itemStages: Record<string, Set<string>> = {};

  for (const rec of records) {
    const items = rec.check_items;
    if (!Array.isArray(items)) continue;
    for (const ci of items) {
      if (!ci.passed) {
        const id = ci.item_id;
        itemFreq[id] = (itemFreq[id] ?? 0) + 1;
        if (!itemNotes[id]) itemNotes[id] = [];
        if (ci.note) itemNotes[id].push(ci.note);
        if (!itemSeverities[id]) itemSeverities[id] = [];
        itemSeverities[id].push(mapSeverity(ci.score_delta));
        if (!itemStages[id]) itemStages[id] = new Set();
        itemStages[id].add(rec.stage);
      }
    }
  }

  const clusters: WeaknessCluster[] = [];
  for (const [itemId, freq] of Object.entries(itemFreq)) {
    if (freq < minFrequency) continue;
    const primaryItemIds = [itemId].sort();
    const clusterId = primaryItemIds.join('_');
    const severityCount: Record<string, number> = { 高: 0, 中: 0, 低: 0 };
    for (const s of itemSeverities[itemId]) {
      severityCount[s]++;
    }
    clusters.push({
      cluster_id: clusterId,
      primary_item_ids: primaryItemIds,
      frequency: freq,
      keywords: extractKeywords(itemNotes[itemId] ?? []),
      severity_distribution: severityCount,
      affected_stages: [...(itemStages[itemId] ?? [])].sort(),
    });
  }

  return clusters.sort((a, b) => b.frequency - a.frequency);
}
