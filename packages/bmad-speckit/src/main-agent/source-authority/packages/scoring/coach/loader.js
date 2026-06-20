"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadRunRecords = loadRunRecords;
const fs = require("fs");
const path = require("path");
const path_1 = require("../constants/path");
function resolveDataPath(dataPath) {
    if (dataPath == null || dataPath === '') {
        return (0, path_1.getScoringDataPath)();
    }
    return path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
}
function sortByTimestamp(records) {
    return records.sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return ta - tb;
    });
}
function parseJsonFile(content, runId) {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
        return parsed.filter((record) => record.run_id === runId);
    }
    const record = parsed;
    return record.run_id === runId ? [record] : [];
}
/**
 * Load RunScoreRecords for a given run_id from {runId}.json or scores.jsonl.
 * @param {string} runId - Run id to load
 * @param {string} [dataPath] - Optional data path; defaults to getScoringDataPath()
 * @returns {RunScoreRecord[]} Records sorted by timestamp
 */
function loadRunRecords(runId, dataPath) {
    const base = resolveDataPath(dataPath);
    const singleFilePath = path.join(base, `${runId}.json`);
    if (fs.existsSync(singleFilePath)) {
        const records = parseJsonFile(fs.readFileSync(singleFilePath, 'utf-8'), runId);
        return sortByTimestamp(records);
    }
    const jsonlPath = path.join(base, 'scores.jsonl');
    if (!fs.existsSync(jsonlPath)) {
        return [];
    }
    const lines = fs
        .readFileSync(jsonlPath, 'utf-8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    const records = [];
    for (const line of lines) {
        const record = JSON.parse(line);
        if (record.run_id === runId) {
            records.push(record);
        }
    }
    return sortByTimestamp(records);
}
