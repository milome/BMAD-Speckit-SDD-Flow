"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeGovernanceRouting = summarizeGovernanceRouting;
const query_1 = require("../query");
function effectiveStage(record) {
    return record.trigger_stage === 'speckit_5_2' ? 'implement' : record.stage;
}
function compareEventTimestamp(left, right) {
    return right.event.timestamp.localeCompare(left.event.timestamp);
}
/**
 * 从 scoring records 中提取最新 governance rerun executor routing 摘要。
 * 若最新事件没有 executor_routing，则继续向前回退到最近一条带 routing 的事件。
 * @param {RunScoreRecord[]} records - scoring records
 * @returns {GovernanceRoutingSummary | undefined} 最新 routing 摘要
 */
function summarizeGovernanceRouting(records) {
    const events = [];
    for (const record of records) {
        for (const event of record.governance_rerun_history ?? []) {
            events.push({ record, event });
        }
    }
    if (events.length === 0) {
        return undefined;
    }
    const sorted = [...events].sort(compareEventTimestamp);
    const latestWithRouting = sorted.find((entry) => entry.event.executor_routing != null);
    if (!latestWithRouting?.event.executor_routing) {
        return undefined;
    }
    const affectedStages = [...new Set(events.map((entry) => effectiveStage(entry.record)))].sort();
    const epicStories = [
        ...new Set(events
            .map(({ record }) => {
            const parsed = (0, query_1.parseEpicStoryFromRecord)(record);
            return parsed ? `E${parsed.epicId}.S${parsed.storyId}` : null;
        })
            .filter((value) => value != null)),
    ].sort();
    return {
        routingMode: latestWithRouting.event.executor_routing.routing_mode,
        executorRoute: latestWithRouting.event.executor_routing.executor_route,
        prioritizedSignals: [...latestWithRouting.event.executor_routing.prioritized_signals].sort(),
        summaryLines: [...(latestWithRouting.event.summary_lines ?? [])],
        runnerSummaryLines: [
            ...(latestWithRouting.event.runner_summary_lines ??
                latestWithRouting.event.summary_lines ??
                []),
        ],
        source: 'scoring-governance-history',
        latestTimestamp: latestWithRouting.event.timestamp,
        eventCount: events.length,
        affectedStages,
        epicStories,
    };
}
