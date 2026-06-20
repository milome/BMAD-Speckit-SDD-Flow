"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEpicStoryFromRecord = void 0;
exports.queryByEpic = queryByEpic;
exports.queryByStory = queryByStory;
exports.queryLatest = queryLatest;
exports.queryByStage = queryByStage;
exports.queryByScenario = queryByScenario;
/**
 * Story 6.3: scoring/query/ 索引层 API
 * queryByEpic、queryByStory、queryLatest、queryByStage、queryByScenario
 */
const loader_1 = require("./loader");
const parse_epic_story_1 = require("./parse-epic-story");
/**
 * Epic/Story 查询仅针对 real_dev（排除 eval_question）
 * @param {RunScoreRecord[]} records - Records to filter
 * @returns {RunScoreRecord[]} Filtered records
 */
function filterRealDev(records) {
    return records.filter((r) => r.scenario !== 'eval_question');
}
/**
 * Query records by epic (real_dev only). Excludes eval_question.
 * @param {number} epicId - Epic id
 * @param {string} [dataPath] - Optional data path
 * @returns {RunScoreRecord[]} Matching RunScoreRecord array
 */
function queryByEpic(epicId, dataPath) {
    const records = (0, loader_1.loadAndDedupeRecords)(dataPath);
    const realDev = filterRealDev(records);
    return realDev.filter((r) => {
        const parsed = (0, parse_epic_story_1.parseEpicStoryFromRecord)(r);
        return parsed != null && parsed.epicId === epicId;
    });
}
/**
 * Query records by epic+story (real_dev only).
 * @param {number} epicId - Epic id
 * @param {number} storyId - Story id
 * @param {string} [dataPath] - Optional data path
 * @returns {RunScoreRecord[]} Matching RunScoreRecord array
 */
function queryByStory(epicId, storyId, dataPath) {
    const records = (0, loader_1.loadAndDedupeRecords)(dataPath);
    const realDev = filterRealDev(records);
    return realDev.filter((r) => {
        const parsed = (0, parse_epic_story_1.parseEpicStoryFromRecord)(r);
        return parsed != null && parsed.epicId === epicId && parsed.storyId === storyId;
    });
}
/**
 * Get latest n records by timestamp (descending).
 * @param {number} n - Number of records
 * @param {string} [dataPath] - Optional data path
 * @returns {RunScoreRecord[]} Latest n records
 */
function queryLatest(n, dataPath) {
    if (n <= 0)
        return [];
    const records = (0, loader_1.loadAndDedupeRecords)(dataPath);
    const sorted = [...records].sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        if (tb !== ta)
            return tb - ta;
        return a.run_id.localeCompare(b.run_id);
    });
    return sorted.slice(0, n);
}
/**
 * Query records by run_id and stage.
 * @param {string} runId - Run id
 * @param {string} stage - Stage name
 * @param {string} [dataPath] - Optional data path
 * @returns {RunScoreRecord[]} Matching RunScoreRecord array
 */
function queryByStage(runId, stage, dataPath) {
    const records = (0, loader_1.loadAndDedupeRecords)(dataPath);
    return records.filter((r) => r.run_id === runId && r.stage === stage);
}
/**
 * Query records by scenario.
 * @param {string} scenario - Scenario ('real_dev' or 'eval_question')
 * @param {string} [dataPath] - Optional data path
 * @returns {RunScoreRecord[]} Matching RunScoreRecord array
 */
function queryByScenario(scenario, dataPath) {
    if (scenario !== 'real_dev' && scenario !== 'eval_question')
        return [];
    const records = (0, loader_1.loadAndDedupeRecords)(dataPath);
    return records.filter((r) => r.scenario === scenario);
}
/** Story 6.4: 供 scores-summary 等复用 */
var parse_epic_story_2 = require("./parse-epic-story");
Object.defineProperty(exports, "parseEpicStoryFromRecord", { enumerable: true, get: function () { return parse_epic_story_2.parseEpicStoryFromRecord; } });
