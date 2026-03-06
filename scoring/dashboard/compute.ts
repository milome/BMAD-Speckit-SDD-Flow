/**
 * Story 7.1: 仪表盘计算逻辑
 */
import { buildVetoItemIds } from '../veto';
import { parseEpicStoryFromRecord } from '../query';
import { sanitizeIterationCount } from '../utils/sanitize-iteration';
import type { RunScoreRecord } from '../writer/types';

/** 按 run_id 分组 */
export function groupByRunId(
  records: RunScoreRecord[]
): Map<string, RunScoreRecord[]> {
  const byRun = new Map<string, RunScoreRecord[]>();
  for (const r of records) {
    const arr = byRun.get(r.run_id) ?? [];
    arr.push(r);
    byRun.set(r.run_id, arr);
  }
  return byRun;
}

/** 取最新 run 的 records（按 run 最大 timestamp 降序，取第一组） */
export function getLatestRunRecords(records: RunScoreRecord[]): RunScoreRecord[] {
  if (records.length === 0) return [];
  const groups = groupByRunId(records);
  const sorted = [...groups.entries()].sort(([, a], [, b]) => {
    const maxA = Math.max(...a.map((x) => new Date(x.timestamp).getTime()));
    const maxB = Math.max(...b.map((x) => new Date(x.timestamp).getTime()));
    return maxB - maxA;
  });
  return sorted[0]?.[1] ?? [];
}

/** 取最近 n 个 run 的 record 数组（按 run 最大 timestamp 降序） */
export function getRecentRuns(
  records: RunScoreRecord[],
  n: number
): RunScoreRecord[][] {
  if (records.length === 0 || n <= 0) return [];
  const groups = groupByRunId(records);
  const sorted = [...groups.entries()].sort(([, a], [, b]) => {
    const maxA = Math.max(...a.map((x) => new Date(x.timestamp).getTime()));
    const maxB = Math.max(...b.map((x) => new Date(x.timestamp).getTime()));
    return maxB - maxA;
  });
  return sorted.slice(0, n).map(([, arr]) => arr);
}

/** 单 run 的加权总分 */
export function computeHealthScore(records: RunScoreRecord[]): number {
  if (records.length === 0) return 0;
  let sumScore = 0;
  let sumWeight = 0;
  for (const r of records) {
    const w = r.phase_weight > 0 ? r.phase_weight : 0;
    if (w > 0) {
      sumScore += r.phase_score * w;
      sumWeight += w;
    }
  }
  if (sumWeight === 0) return 0;
  return Math.round(sumScore / sumWeight);
}

/** 四维数据：合并 dimension_scores，无则「无数据」 */
export interface DimensionEntry {
  dimension: string;
  score: number | '无数据';
}

export function getDimensionScores(
  records: RunScoreRecord[]
): DimensionEntry[] {
  const byDim = new Map<string, number[]>();
  for (const r of records) {
    if (r.dimension_scores && r.dimension_scores.length > 0) {
      for (const d of r.dimension_scores) {
        const arr = byDim.get(d.dimension) ?? [];
        arr.push(d.score);
        byDim.set(d.dimension, arr);
      }
    }
  }
  const knownDims = [...byDim.keys()].sort();
  const fallbackDims = ['功能性', '代码质量', '测试覆盖', '安全性'];
  const allDims = knownDims.length > 0 ? knownDims : fallbackDims;
  return allDims.map((dim) => {
    const scores = byDim.get(dim);
    if (!scores || scores.length === 0) {
      return { dimension: dim, score: '无数据' as const };
    }
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { dimension: dim, score: Math.round(avg) };
  });
}

/** 短板 Top 3：得分最低的 3 条 */
export interface WeakEntry {
  stage: string;
  epicStory: string;
  score: number;
}

/** 高迭代 Top 3：iteration_count 降序，过滤 >0，取前 3 */
export interface HighIterEntry {
  stage: string;
  epicStory: string;
  iteration_count: number;
}

export function getHighIterationTop3(records: RunScoreRecord[]): HighIterEntry[] {
  const sanitized = records.map((r) => ({
    record: r,
    iter: sanitizeIterationCount(r.iteration_count),
  }));
  const filtered = sanitized.filter((x) => x.iter > 0);
  const sorted = [...filtered].sort((a, b) => b.iter - a.iter);
  return sorted.slice(0, 3).map((x) => {
    const parsed = parseEpicStoryFromRecord(x.record);
    const epicStory = parsed ? `E${parsed.epicId}.S${parsed.storyId}` : '-';
    return {
      stage: x.record.stage,
      epicStory,
      iteration_count: x.iter,
    };
  });
}

export function getWeakTop3(records: RunScoreRecord[]): WeakEntry[] {
  const sorted = [...records].sort((a, b) => a.phase_score - b.phase_score);
  return sorted.slice(0, 3).map((r) => {
    const parsed = parseEpicStoryFromRecord(r);
    const epicStory = parsed ? `E${parsed.epicId}.S${parsed.storyId}` : '-';
    return { stage: r.stage, epicStory, score: r.phase_score };
  });
}

/** Veto 触发计数 */
export function countVetoTriggers(records: RunScoreRecord[]): number {
  const vetoIds = buildVetoItemIds();
  let count = 0;
  for (const r of records) {
    for (const c of r.check_items ?? []) {
      if (c.passed === false && vetoIds.has(c.item_id)) {
        count++;
      }
    }
  }
  return count;
}

/** 趋势：升 | 降 | 持平 */
export type TrendDirection = '升' | '降' | '持平';

export function getTrend(records: RunScoreRecord[]): TrendDirection {
  const runs = getRecentRuns(records, 5);
  if (runs.length === 0) return '持平';
  if (runs.length === 1) return '持平';
  const latest = computeHealthScore(runs[0]!);
  const previous = computeHealthScore(runs[1]!);
  if (latest > previous) return '升';
  if (latest < previous) return '降';
  return '持平';
}
