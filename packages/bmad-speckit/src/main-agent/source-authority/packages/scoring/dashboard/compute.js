"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupByRunId = groupByRunId;
exports.getLatestRunRecords = getLatestRunRecords;
exports.aggregateByEpicOnly = aggregateByEpicOnly;
exports.getEpicAggregateRecords = getEpicAggregateRecords;
exports.computeEpicHealthScore = computeEpicHealthScore;
exports.getEpicDimensionScores = getEpicDimensionScores;
exports.aggregateByEpicStoryTimeWindow = aggregateByEpicStoryTimeWindow;
exports.effectiveStage = effectiveStage;
exports.getLatestRunRecordsV2 = getLatestRunRecordsV2;
exports.getRecentRuns = getRecentRuns;
exports.computeHealthScore = computeHealthScore;
exports.getDimensionScores = getDimensionScores;
exports.getHighIterationTop3 = getHighIterationTop3;
exports.getWeakTop3 = getWeakTop3;
exports.getWeakTop3EpicStory = getWeakTop3EpicStory;
exports.getJourneyContractSummary = getJourneyContractSummary;
exports.getGovernanceRoutingSummary = getGovernanceRoutingSummary;
exports.getGovernanceRoutingModeDistribution = getGovernanceRoutingModeDistribution;
exports.getGovernanceSignalHotspots = getGovernanceSignalHotspots;
exports.getGovernanceRerunGateFailureTrend = getGovernanceRerunGateFailureTrend;
exports.countVetoTriggers = countVetoTriggers;
exports.getTrend = getTrend;
/**
 * Story 7.1: 仪表盘计算逻辑
 */
const journey_contract_signals_1 = require("../analytics/journey-contract-signals");
const governance_routing_summary_1 = require("../analytics/governance-routing-summary");
const governance_history_metrics_1 = require("../analytics/governance-history-metrics");
const veto_1 = require("../veto");
const query_1 = require("../query");
const sanitize_iteration_1 = require("../utils/sanitize-iteration");
/**
 * Group records by run_id.
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {Map<string, RunScoreRecord[]>} 按 run_id 分组的 Map
 */
function groupByRunId(records) {
    const byRun = new Map();
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
function getLatestRunRecords(records) {
    if (records.length === 0)
        return [];
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
function aggregateByEpicOnly(records, epicId, windowHours) {
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    return records.filter((r) => {
        const parsed = (0, query_1.parseEpicStoryFromRecord)(r);
        if (!parsed || parsed.epicId !== epicId)
            return false;
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
function getEpicAggregateRecords(records, epicId, windowHours) {
    const candidates = aggregateByEpicOnly(records, epicId, windowHours);
    const byEpicStory = new Map();
    for (const r of candidates) {
        const parsed = (0, query_1.parseEpicStoryFromRecord)(r);
        if (!parsed)
            continue;
        const key = `${parsed.epicId}:${parsed.storyId}`;
        const arr = byEpicStory.get(key) ?? [];
        arr.push(r);
        byEpicStory.set(key, arr);
    }
    const result = [];
    for (const arr of byEpicStory.values()) {
        const byGroup = groupByEpicStoryOrRunId(arr);
        let bestRun = [];
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
function computeEpicHealthScore(epicRecords) {
    if (epicRecords.length === 0)
        return 0;
    const byEpicStory = new Map();
    for (const r of epicRecords) {
        const parsed = (0, query_1.parseEpicStoryFromRecord)(r);
        if (!parsed)
            continue;
        const key = `${parsed.epicId}:${parsed.storyId}`;
        const arr = byEpicStory.get(key) ?? [];
        arr.push(r);
        byEpicStory.set(key, arr);
    }
    const storyScores = [];
    for (const arr of byEpicStory.values()) {
        const s = computeHealthScore(arr);
        if (arr.length > 0)
            storyScores.push(s);
    }
    if (storyScores.length === 0)
        return 0;
    const avg = storyScores.reduce((a, b) => a + b, 0) / storyScores.length;
    return Math.round(avg);
}
/**
 * Story 9.3: Epic 四维分数（每 Story getDimensionScores 后同维度 Story 级平均）
 * @param {RunScoreRecord[]} epicRecords - Epic 评分记录数组
 * @returns {DimensionEntry[]} 维度分数列表
 */
function getEpicDimensionScores(epicRecords) {
    if (epicRecords.length === 0) {
        return ['功能性', '代码质量', '测试覆盖', '安全性'].map((dim) => ({
            dimension: dim,
            score: '无数据',
        }));
    }
    const byEpicStory = new Map();
    for (const r of epicRecords) {
        const parsed = (0, query_1.parseEpicStoryFromRecord)(r);
        if (!parsed)
            continue;
        const key = `${parsed.epicId}:${parsed.storyId}`;
        const arr = byEpicStory.get(key) ?? [];
        arr.push(r);
        byEpicStory.set(key, arr);
    }
    const storyDimEntries = [];
    for (const arr of byEpicStory.values()) {
        storyDimEntries.push(getDimensionScores(arr));
    }
    const byDim = new Map();
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
            return { dimension: dim, score: '无数据' };
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
function aggregateByEpicStoryTimeWindow(records, epicId, storyId, windowHours) {
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    return records.filter((r) => {
        const parsed = (0, query_1.parseEpicStoryFromRecord)(r);
        if (!parsed || parsed.epicId !== epicId || parsed.storyId !== storyId)
            return false;
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
function effectiveStage(r) {
    return r.trigger_stage === 'speckit_5_2' ? 'implement' : r.stage;
}
/**
 * 按 run_group_id 或 (epic, story) 分组，兼容「每 stage 不同 run_id」的场景。
 * 当 run_id 各不相同、无法按 run_id 聚为完整 run 时，同一 epic/story 时间窗口内的
 * 多 stage 视为同一 run（T11 run_id 共享策略的 fallback）。
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {Map<string, RunScoreRecord[]>} 分组后的 Map
 */
function groupByEpicStoryOrRunId(records) {
    const byKey = new Map();
    for (const r of records) {
        const parsed = (0, query_1.parseEpicStoryFromRecord)(r);
        const key = r.run_group_id ??
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
function getLatestRunRecordsV2(records, options) {
    const realDev = records.filter((r) => r.scenario !== 'eval_question');
    if (realDev.length === 0)
        return [];
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
        }
        else {
            const groupedByEpicStory = new Map();
            for (const r of realDev) {
                const parsed = (0, query_1.parseEpicStoryFromRecord)(r);
                if (!parsed)
                    continue;
                const key = `${parsed.epicId}:${parsed.storyId}`;
                const arr = groupedByEpicStory.get(key) ?? [];
                arr.push(r);
                groupedByEpicStory.set(key, arr);
            }
            const windowCutoff = Date.now() - windowHours * 60 * 60 * 1000;
            let bestRun = [];
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
function getRecentRuns(records, n) {
    if (records.length === 0 || n <= 0)
        return [];
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
function computeHealthScore(records) {
    if (records.length === 0)
        return 0;
    let sumScore = 0;
    let sumWeight = 0;
    for (const r of records) {
        const w = r.phase_weight > 0 ? r.phase_weight : 0;
        if (w > 0) {
            sumScore += r.phase_score * w;
            sumWeight += w;
        }
    }
    if (sumWeight === 0)
        return 0;
    return Math.round(sumScore / sumWeight);
}
function getDimensionScores(records) {
    const byDim = new Map();
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
            return { dimension: dim, score: '无数据' };
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
function formatIterationEvolution(recs) {
    if (!recs || recs.length === 0)
        return undefined;
    if (!recs.some((r) => r.overall_grade != null && r.overall_grade.length > 0))
        return undefined;
    return recs.map((r, i) => `第${i + 1}轮 ${r.overall_grade ?? '?'}`).join(' → ');
}
/**
 * 获取高迭代次数的 Top 3
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {HighIterEntry[]} 高迭代次数条目列表
 */
function getHighIterationTop3(records) {
    const sanitized = records.map((r) => ({
        record: r,
        iter: (0, sanitize_iteration_1.sanitizeIterationCount)(r.iteration_count),
    }));
    const filtered = sanitized.filter((x) => x.iter > 0);
    const sorted = [...filtered].sort((a, b) => b.iter - a.iter);
    return sorted.slice(0, 3).map((x) => {
        const parsed = (0, query_1.parseEpicStoryFromRecord)(x.record);
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
function getWeakTop3(records) {
    const sorted = [...records].sort((a, b) => a.phase_score - b.phase_score);
    return sorted.slice(0, 3).map((r) => {
        const parsed = (0, query_1.parseEpicStoryFromRecord)(r);
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
function getWeakTop3EpicStory(records) {
    const realDev = records.filter((r) => r.scenario !== 'eval_question');
    const byEpicStory = new Map();
    for (const r of realDev) {
        const parsed = (0, query_1.parseEpicStoryFromRecord)(r);
        if (!parsed)
            continue;
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
function getJourneyContractSummary(records) {
    return (0, journey_contract_signals_1.summarizeJourneyContractSignals)(records);
}
/**
 * 汇总 governance rerun history，输出 dashboard 可直接消费的 executor routing 摘要。
 * 数据来源必须是 scoring records，而不是 runtime current-run 快照。
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {GovernanceRoutingSummaryEntry | undefined} routing 摘要
 */
function getGovernanceRoutingSummary(records) {
    return (0, governance_routing_summary_1.summarizeGovernanceRouting)(records);
}
/**
 * 获取 governance routing mode 分布。
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {GovernanceRoutingModeDistributionSummaryEntry[]} routing mode 分布
 */
function getGovernanceRoutingModeDistribution(records) {
    return (0, governance_history_metrics_1.summarizeGovernanceRoutingModeDistribution)(records);
}
/**
 * 获取 governance signal 热点。
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {GovernanceSignalHotspotSummaryEntry[]} signal 热点
 */
function getGovernanceSignalHotspots(records) {
    return (0, governance_history_metrics_1.summarizeGovernanceSignalHotspots)(records);
}
/**
 * 获取 governance rerun gate 失败趋势。
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {GovernanceRerunGateFailureTrendSummaryEntry[]} gate 失败趋势
 */
function getGovernanceRerunGateFailureTrend(records) {
    return (0, governance_history_metrics_1.summarizeGovernanceRerunGateFailureTrend)(records);
}
/**
 * Veto 触发计数
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {number} Veto 触发次数
 */
function countVetoTriggers(records) {
    const vetoIds = (0, veto_1.buildVetoItemIds)();
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
/**
 * 获取趋势方向
 * @param {RunScoreRecord[]} records - RunScoreRecord 数组
 * @returns {TrendDirection} 趋势方向（升、降、持平）
 */
function getTrend(records) {
    const runs = getRecentRuns(records, 5);
    if (runs.length === 0)
        return '持平';
    if (runs.length === 1)
        return '持平';
    const latest = computeHealthScore(runs[0]);
    const previous = computeHealthScore(runs[1]);
    if (latest > previous)
        return '升';
    if (latest < previous)
        return '降';
    return '持平';
}
