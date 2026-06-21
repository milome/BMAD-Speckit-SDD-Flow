"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeJourneyContractSignals = summarizeJourneyContractSignals;
const query_1 = require("../query");
const JOURNEY_CONTRACT_SIGNAL_LABELS = {
    smoke_task_chain: 'Smoke Task Chain',
    closure_task_id: 'Closure Task',
    journey_unlock: 'Journey Unlock',
    gap_split_contract: 'Gap Split Contract',
    shared_path_reference: 'Shared Path Reference',
};
function effectiveStageForAnalytics(record) {
    return record.trigger_stage === 'speckit_5_2' ? 'implement' : record.stage;
}
/**
 * 聚合 RunScoreRecord 中的 journey_contract_signals，输出按频率排序的摘要。
 * @param {RunScoreRecord[]} records - 评分记录数组
 * @returns {JourneyContractSignalSummary[]} Journey contract 信号摘要
 */
function summarizeJourneyContractSignals(records) {
    const bySignal = new Map();
    for (const record of records) {
        const signals = record.journey_contract_signals;
        if (!signals)
            continue;
        for (const [signal, enabled] of Object.entries(signals)) {
            if (!enabled)
                continue;
            const current = bySignal.get(signal) ?? {
                count: 0,
                stages: new Set(),
                epicStories: new Set(),
            };
            current.count += 1;
            current.stages.add(effectiveStageForAnalytics(record));
            const parsed = (0, query_1.parseEpicStoryFromRecord)(record);
            if (parsed) {
                current.epicStories.add(`E${parsed.epicId}.S${parsed.storyId}`);
            }
            bySignal.set(signal, current);
        }
    }
    return [...bySignal.entries()]
        .map(([signal, value]) => ({
        signal,
        label: JOURNEY_CONTRACT_SIGNAL_LABELS[signal],
        count: value.count,
        affected_stages: [...value.stages].sort(),
        epic_stories: [...value.epicStories].sort(),
    }))
        .sort((a, b) => {
        if (b.count !== a.count)
            return b.count - a.count;
        return a.label.localeCompare(b.label);
    });
}
