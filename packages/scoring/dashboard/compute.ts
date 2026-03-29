/**
 * Story 7.1: 仪表盘计算逻辑
 */
import { summarizeJourneyContractSignals, type JourneyContractSignalSummary } from '../analytics/journey-contract-signals';
import {
  summarizeGovernanceRouting,
  type GovernanceRoutingSummary,
} from '../analytics/governance-routing-summary';
import {
  summarizeGovernanceRoutingModeDistribution,
  summarizeGovernanceSignalHotspots,
  summarizeGovernanceRerunGateFailureTrend,
  type GovernanceRoutingModeDistributionEntry,
  type GovernanceSignalHotspotEntry,
  type GovernanceRerunGateFailureTrendEntry,
} from '../analytics/governance-history-metrics';
import { buildVetoItemIds } from '../veto';
import { parseEpicStoryFromRecord } from '../query';
import { sanitizeIterationCount } from '../utils/sanitize-iteration';
import type { RunScoreRecord } from '../writer/types';

/**
 * Group records by run_id.
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {Map<string, RunScoreRecord[]>} 按 run_id 分组的 Map
 */
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

/**
 * 获取最新运行的记录
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {RunScoreRecord[]} 最新运行的记录
 */
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

/**
 * Story 9.3: 按 epic 筛选记录（不含 story 约束），时间窗口内
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @param {number} epicId - Epic ID
 * @param {number} windowHours - 时间窗口（小时）
 * @returns {RunScoreRecord[]} 筛选后的记录
 */
export function aggregateByEpicOnly(
  records: RunScoreRecord[],
  epicId: number,
  windowHours: number
): RunScoreRecord[] {
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  return records.filter((r) => {
    const parsed = parseEpicStoryFromRecord(r);
    if (!parsed || parsed.epicId !== epicId) return false;
    return new Date(r.timestamp).getTime() >= cutoff;
  });
}

/**
 * Story 9.3: Epic 聚合记录：按 epic:story 分组，每组取最新完整 run，排除不完整 Story
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @param {number} epicId - Epic ID
 * @param {number} windowHours - 时间窗口（小时）
 * @returns {RunScoreRecord[]} 聚合后的记录
 */
export function getEpicAggregateRecords(
  records: RunScoreRecord[],
  epicId: number,
  windowHours: number
): RunScoreRecord[] {
  const candidates = aggregateByEpicOnly(records, epicId, windowHours);
  const byEpicStory = new Map<string, RunScoreRecord[]>();
  for (const r of candidates) {
    const parsed = parseEpicStoryFromRecord(r);
    if (!parsed) continue;
    const key = `${parsed.epicId}:${parsed.storyId}`;
    const arr = byEpicStory.get(key) ?? [];
    arr.push(r);
    byEpicStory.set(key, arr);
  }
  const result: RunScoreRecord[] = [];
  for (const arr of byEpicStory.values()) {
    const byGroup = groupByEpicStoryOrRunId(arr);
    let bestRun: RunScoreRecord[] = [];
    let bestMaxTs = 0;
    for (const [, runRecs] of byGroup) {
      const stages = new Set(runRecs.map((x) => effectiveStage(x)));
      if (stages.size >= MIN_STAGES_COMPLETE_RUN) {
        const maxTs = Math.max(...runRecs.map((x) => new Date(x.timestamp).getTime()));
        if (maxTs > bestMaxTs) {
          bestMaxTs = maxTs;
          bestRun = runRecs;
        }
      }
    }
    if (bestRun.length > 0) {
      result.push(...bestRun);
    }
  }
  return result;
}

/**
 * Story 9.3: Epic 总分（Per-Story computeHealthScore 后简单平均）
 * @param {RunScoreRecord[]} epicRecords - Epic 评分记录数组
 * @returns {number} Epic 健康分数
 */
export function computeEpicHealthScore(epicRecords: RunScoreRecord[]): number {
  if (epicRecords.length === 0) return 0;
  const byEpicStory = new Map<string, RunScoreRecord[]>();
  for (const r of epicRecords) {
    const parsed = parseEpicStoryFromRecord(r);
    if (!parsed) continue;
    const key = `${parsed.epicId}:${parsed.storyId}`;
    const arr = byEpicStory.get(key) ?? [];
    arr.push(r);
    byEpicStory.set(key, arr);
  }
  const storyScores: number[] = [];
  for (const arr of byEpicStory.values()) {
    const s = computeHealthScore(arr);
    if (arr.length > 0) storyScores.push(s);
  }
  if (storyScores.length === 0) return 0;
  const avg = storyScores.reduce((a, b) => a + b, 0) / storyScores.length;
  return Math.round(avg);
}

/**
 * Story 9.3: Epic 四维分数（每 Story getDimensionScores 后同维度 Story 级平均）
 * @param {RunScoreRecord[]} epicRecords - Epic 评分记录数组
 * @returns {DimensionEntry[]} 维度分数列表
 */
export function getEpicDimensionScores(
  epicRecords: RunScoreRecord[]
): DimensionEntry[] {
  if (epicRecords.length === 0) {
    return ['功能性', '代码质量', '测试覆盖', '安全性'].map((dim) => ({
      dimension: dim,
      score: '无数据' as const,
    }));
  }
  const byEpicStory = new Map<string, RunScoreRecord[]>();
  for (const r of epicRecords) {
    const parsed = parseEpicStoryFromRecord(r);
    if (!parsed) continue;
    const key = `${parsed.epicId}:${parsed.storyId}`;
    const arr = byEpicStory.get(key) ?? [];
    arr.push(r);
    byEpicStory.set(key, arr);
  }
  const storyDimEntries: DimensionEntry[][] = [];
  for (const arr of byEpicStory.values()) {
    storyDimEntries.push(getDimensionScores(arr));
  }
  const byDim = new Map<string, number[]>();
  for (const entries of storyDimEntries) {
    for (const e of entries) {
      if (e.score !== '无数据') {
        const arr = byDim.get(e.dimension) ?? [];
        arr.push(e.score);
        byDim.set(e.dimension, arr);
      }
    }
  }
  const fallbackDims = ['功能性', '代码质量', '测试覆盖', '安全性'];
  const allDims = byDim.size > 0 ? [...new Set([...byDim.keys(), ...fallbackDims])] : fallbackDims;
  return allDims.map((dim) => {
    const scores = byDim.get(dim);
    if (!scores || scores.length === 0) {
      return { dimension: dim, score: '无数据' as const };
    }
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { dimension: dim, score: Math.round(avg) };
  });
}

/**
 * Story 9.1 T9: 按 epic/story 与时间窗口筛选记录
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @param {number} epicId - Epic ID
 * @param {number} storyId - Story ID
 * @param {number} windowHours - 时间窗口（小时）
 * @returns {RunScoreRecord[]} 筛选后的记录
 */
export function aggregateByEpicStoryTimeWindow(
  records: RunScoreRecord[],
  epicId: number,
  storyId: number,
  windowHours: number
): RunScoreRecord[] {
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  return records.filter((r) => {
    const parsed = parseEpicStoryFromRecord(r);
    if (!parsed || parsed.epicId !== epicId || parsed.storyId !== storyId) return false;
    return new Date(r.timestamp).getTime() >= cutoff;
  });
}

/** 完整 run 定义：至少 2 个 stage（story+implement 为 2-stage 设计） */
const MIN_STAGES_COMPLETE_RUN = 2;

/**
 * Story 9.2: 当 trigger_stage=speckit_5_2 时等效为 implement，否则用 record.stage
 * @param {RunScoreRecord} r - 评分记录
 * @returns {string} 有效阶段名称
 */
export function effectiveStage(r: RunScoreRecord): string {
  return r.trigger_stage === 'speckit_5_2' ? 'implement' : r.stage;
}

export interface GetLatestRunRecordsV2Options {
  strategy: 'run_id' | 'epic_story_window';
  epic?: number;
  story?: number;
  windowHours?: number;
}

/**
 * 按 run_group_id 或 (epic, story) 分组，兼容「每 stage 不同 run_id」的场景。
 * 当 run_id 各不相同、无法按 run_id 聚为完整 run 时，同一 epic/story 时间窗口内的
 * 多 stage 视为同一 run（T11 run_id 共享策略的 fallback）。
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {Map<string, RunScoreRecord[]>} 分组后的 Map
 */
function groupByEpicStoryOrRunId(
  records: RunScoreRecord[]
): Map<string, RunScoreRecord[]> {
  const byKey = new Map<string, RunScoreRecord[]>();
  for (const r of records) {
    const parsed = parseEpicStoryFromRecord(r);
    const key =
      (r as RunScoreRecord & { run_group_id?: string }).run_group_id ??
      (parsed ? `${parsed.epicId}:${parsed.storyId}` : r.run_id);
    const arr = byKey.get(key) ?? [];
    arr.push(r);
    byKey.set(key, arr);
  }
  return byKey;
}

/**
 * Story 9.1 T9: 支持 epic_story_window 策略的取最新 run
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @param {GetLatestRunRecordsV2Options} options - 选项配置
 * @returns {RunScoreRecord[]} 最新运行的记录
 */
export function getLatestRunRecordsV2(
  records: RunScoreRecord[],
  options: GetLatestRunRecordsV2Options
): RunScoreRecord[] {
  const realDev = records.filter((r) => r.scenario !== 'eval_question');
  if (realDev.length === 0) return [];

  if (options.strategy === 'run_id') {
    return getLatestRunRecords(realDev);
  }

  if (options.strategy === 'epic_story_window') {
    const epic = options.epic;
    const story = options.story;
    const windowHours = options.windowHours ?? 24 * 7; // 默认 7 天

    if (epic != null && story == null) {
      return getEpicAggregateRecords(realDev, epic, windowHours);
    }

    let candidateRecords = realDev;
    if (epic != null && story != null) {
      candidateRecords = aggregateByEpicStoryTimeWindow(realDev, epic, story, windowHours);
    } else {
      const groupedByEpicStory = new Map<string, RunScoreRecord[]>();
      for (const r of realDev) {
        const parsed = parseEpicStoryFromRecord(r);
        if (!parsed) continue;
        const key = `${parsed.epicId}:${parsed.storyId}`;
        const arr = groupedByEpicStory.get(key) ?? [];
        arr.push(r);
        groupedByEpicStory.set(key, arr);
      }
      const windowCutoff = Date.now() - windowHours * 60 * 60 * 1000;
      let bestRun: RunScoreRecord[] = [];
      let bestMaxTs = 0;
      for (const arr of groupedByEpicStory.values()) {
        const inWindow = arr.filter((r) => new Date(r.timestamp).getTime() >= windowCutoff);
        const byGroup = groupByEpicStoryOrRunId(inWindow);
        for (const [, runRecs] of byGroup) {
          const stages = new Set(runRecs.map((x) => effectiveStage(x)));
          if (stages.size >= MIN_STAGES_COMPLETE_RUN) {
            const maxTs = Math.max(...runRecs.map((x) => new Date(x.timestamp).getTime()));
            if (maxTs > bestMaxTs) {
              bestMaxTs = maxTs;
              bestRun = runRecs;
            }
          }
        }
      }
      return bestRun;
    }

    const byGroup = groupByEpicStoryOrRunId(candidateRecords);
    const sorted = [...byGroup.entries()].sort(([, a], [, b]) => {
      const maxA = Math.max(...a.map((x) => new Date(x.timestamp).getTime()));
      const maxB = Math.max(...b.map((x) => new Date(x.timestamp).getTime()));
      return maxB - maxA;
    });
    for (const [, runRecs] of sorted) {
      const stages = new Set(runRecs.map((x) => effectiveStage(x)));
      if (stages.size >= MIN_STAGES_COMPLETE_RUN) {
        return runRecs;
      }
    }
    return sorted[0]?.[1] ?? [];
  }

  return getLatestRunRecords(realDev);
}

/**
 * 取最近 n 个 run 的 record 数组（按 run 最大 timestamp 降序）
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @param {number} n - 取最近的 n 个 run
 * @returns {RunScoreRecord[][]} 最近 n 个 run 的记录数组
 */
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

/**
 * 计算健康分数（加权平均）
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {number} 加权健康分数 (0-100)
 */
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

/**
 * Story 9.4: 从 iteration_records 格式化演进轨迹
 * @param {import('../writer/types').IterationRecord[] | undefined} recs - 迭代记录
 * @returns {string | undefined} 格式化的演进轨迹
 */
function formatIterationEvolution(
  recs: import('../writer/types').IterationRecord[] | undefined
): string | undefined {
  if (!recs || recs.length === 0) return undefined;
  if (!recs.some((r) => r.overall_grade != null && r.overall_grade.length > 0)) return undefined;
  return recs.map((r, i) => `第${i + 1}轮 ${r.overall_grade ?? '?'}`).join(' → ');
}

/** 短板 Top 3：得分最低的 3 条 */
export interface WeakEntry {
  stage: string;
  epicStory: string;
  score: number;
  /** Story 9.4: 演进轨迹 */
  evolution_trace?: string;
}

/** 高迭代 Top 3：iteration_count 降序，过滤 >0，取前 3 */
export interface HighIterEntry {
  stage: string;
  epicStory: string;
  iteration_count: number;
  /** Story 9.4: 演进轨迹 */
  evolution_trace?: string;
}

export type JourneyContractSummaryEntry = JourneyContractSignalSummary;
export type GovernanceRoutingSummaryEntry = GovernanceRoutingSummary;
export type GovernanceRoutingModeDistributionSummaryEntry =
  GovernanceRoutingModeDistributionEntry;
export type GovernanceSignalHotspotSummaryEntry = GovernanceSignalHotspotEntry;
export type GovernanceRerunGateFailureTrendSummaryEntry =
  GovernanceRerunGateFailureTrendEntry;

/**
 * 获取高迭代次数的 Top 3
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {HighIterEntry[]} 高迭代次数条目列表
 */
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
      stage: effectiveStage(x.record),
      epicStory,
      iteration_count: x.iter,
      evolution_trace: formatIterationEvolution(x.record.iteration_records),
    };
  });
}

/**
 * 获取最弱项的 Top 3
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {WeakEntry[]} 弱项条目列表
 */
export function getWeakTop3(records: RunScoreRecord[]): WeakEntry[] {
  const sorted = [...records].sort((a, b) => a.phase_score - b.phase_score);
  return sorted.slice(0, 3).map((r) => {
    const parsed = parseEpicStoryFromRecord(r);
    const epicStory = parsed ? `E${parsed.epicId}.S${parsed.storyId}` : '-';
    return {
      stage: effectiveStage(r),
      epicStory,
      score: r.phase_score,
      evolution_trace: formatIterationEvolution(r.iteration_records),
    };
  });
}

/**
 * Story 9.1 T12: 按 epic/story 聚合，同一 Story 各 stage 取最低分，跨 run 短板 Top 3
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {WeakEntry[]} 弱项条目列表
 */
export function getWeakTop3EpicStory(records: RunScoreRecord[]): WeakEntry[] {
  const realDev = records.filter((r) => r.scenario !== 'eval_question');
  const byEpicStory = new Map<string, { minScore: number; stage: string; record: RunScoreRecord }>();

  for (const r of realDev) {
    const parsed = parseEpicStoryFromRecord(r);
    if (!parsed) continue;
    const key = `E${parsed.epicId}.S${parsed.storyId}`;
    const existing = byEpicStory.get(key);
    if (!existing || r.phase_score < existing.minScore) {
      byEpicStory.set(key, { minScore: r.phase_score, stage: effectiveStage(r), record: r });
    }
  }

  const sorted = [...byEpicStory.entries()]
    .map(([epicStory, { minScore, stage, record }]) => ({
      stage,
      epicStory,
      score: minScore,
      evolution_trace: formatIterationEvolution(record.iteration_records),
    }))
    .sort((a, b) => a.score - b.score);
  return sorted.slice(0, 3);
}

/**
 * 汇总 Journey contract 结构化信号，供 dashboard 单独展示。
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {JourneyContractSummaryEntry[]} Journey contract 摘要列表
 */
export function getJourneyContractSummary(
  records: RunScoreRecord[]
): JourneyContractSummaryEntry[] {
  return summarizeJourneyContractSignals(records);
}

/**
 * 汇总 governance rerun history，输出 dashboard 可直接消费的 executor routing 摘要。
 * 数据来源必须是 scoring records，而不是 runtime current-run 快照。
 */
export function getGovernanceRoutingSummary(
  records: RunScoreRecord[]
): GovernanceRoutingSummaryEntry | undefined {
  return summarizeGovernanceRouting(records);
}

export function getGovernanceRoutingModeDistribution(
  records: RunScoreRecord[]
): GovernanceRoutingModeDistributionSummaryEntry[] {
  return summarizeGovernanceRoutingModeDistribution(records);
}

export function getGovernanceSignalHotspots(
  records: RunScoreRecord[]
): GovernanceSignalHotspotSummaryEntry[] {
  return summarizeGovernanceSignalHotspots(records);
}

export function getGovernanceRerunGateFailureTrend(
  records: RunScoreRecord[]
): GovernanceRerunGateFailureTrendSummaryEntry[] {
  return summarizeGovernanceRerunGateFailureTrend(records);
}

/**
 * Veto 触发计数
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {number} Veto 触发次数
 */
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

/**
 * 获取趋势方向
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {TrendDirection} 趋势方向（升、降、持平）
 */
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
