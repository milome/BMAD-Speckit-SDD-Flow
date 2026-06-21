"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEpicStoryFromRecord = parseEpicStoryFromRecord;
const RUN_ID_RE = /-e(\d+)-s(\d+)(?:-|$)/;
const SOURCE_PATH_STORY_RE = /story-(\d+)-(\d+)-/;
const SOURCE_PATH_EPIC_RE = /epic-(\d+)-[^/]*\/story-(\d+)-/;
/**
 * Parse epicId and storyId from record. Tries run_id regex first, then source_path fallback.
 * @param {RunScoreRecord} record - RunScoreRecord with run_id or source_path
 * @returns {{ epicId: number; storyId: number } | null} { epicId, storyId } or null if not parseable
 */
function parseEpicStoryFromRecord(record) {
    const fromRunId = record.run_id.match(RUN_ID_RE);
    if (fromRunId) {
        return {
            epicId: parseInt(fromRunId[1], 10),
            storyId: parseInt(fromRunId[2], 10),
        };
    }
    if (record.source_path) {
        let m = record.source_path.match(SOURCE_PATH_STORY_RE);
        if (m) {
            return {
                epicId: parseInt(m[1], 10),
                storyId: parseInt(m[2], 10),
            };
        }
        m = record.source_path.match(SOURCE_PATH_EPIC_RE);
        if (m) {
            return {
                epicId: parseInt(m[1], 10),
                storyId: parseInt(m[2], 10),
            };
        }
    }
    return null;
}
