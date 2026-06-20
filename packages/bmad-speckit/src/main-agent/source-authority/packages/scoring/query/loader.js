"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXCLUDED_JSON = void 0;
exports.isRunScoreRecord = isRunScoreRecord;
exports.loadAndDedupeRecords = loadAndDedupeRecords;
/**
 * Story 6.3: scoring/query/ 数据加载与去重
 * 从 getScoringDataPath() 下 *.json 与 scores.jsonl 加载，按 (run_id, stage) 去重取 timestamp 最新。
 */
const fs = require("fs");
const path = require("path");
const path_1 = require("../constants/path");
exports.EXCLUDED_JSON = ['sft-dataset.json'];
/**
 * Type guard: check if object is valid RunScoreRecord.
 * @param {unknown} obj - Unknown value
 * @returns {obj is RunScoreRecord} true if obj has run_id, timestamp, scenario, stage
 */
function isRunScoreRecord(obj) {
    if (obj == null || typeof obj !== 'object')
        return false;
    const o = obj;
    return (typeof o.run_id === 'string' &&
        o.run_id.length > 0 &&
        typeof o.timestamp === 'string' &&
        (o.scenario === 'real_dev' || o.scenario === 'eval_question') &&
        typeof o.stage === 'string');
}
function resolveDataPath(dataPath) {
    if (dataPath == null || dataPath === '') {
        return (0, path_1.getScoringDataPath)();
    }
    return path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
}
function parseRecords(content) {
    const records = [];
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
            for (const item of parsed) {
                if (isRunScoreRecord(item))
                    records.push(item);
            }
        }
        else if (isRunScoreRecord(parsed)) {
            records.push(parsed);
        }
    }
    catch {
        // skip invalid json
    }
    return records;
}
function loadAllRecords(dataPath) {
    const base = resolveDataPath(dataPath);
    const records = [];
    if (!fs.existsSync(base)) {
        return [];
    }
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const e of entries) {
        if (!e.isFile())
            continue;
        const full = path.join(base, e.name);
        if (e.name.endsWith('.json') && !exports.EXCLUDED_JSON.includes(e.name)) {
            try {
                const content = fs.readFileSync(full, 'utf-8');
                records.push(...parseRecords(content));
            }
            catch {
                // skip
            }
        }
    }
    const jsonlPath = path.join(base, 'scores.jsonl');
    if (fs.existsSync(jsonlPath)) {
        const lines = fs
            .readFileSync(jsonlPath, 'utf-8')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (isRunScoreRecord(parsed))
                    records.push(parsed);
            }
            catch {
                // skip invalid line
            }
        }
    }
    return records;
}
/**
 * 按 (run_id, stage) 分组，每组取 timestamp 最大的一条
 * @param {RunScoreRecord[]} records - Records to dedupe
 * @returns {RunScoreRecord[]} Deduplicated records
 */
function dedupeByRunIdStage(records) {
    const byKey = new Map();
    for (const r of records) {
        const key = `${r.run_id}::${r.stage}`;
        const existing = byKey.get(key);
        if (!existing || new Date(r.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
            byKey.set(key, r);
        }
    }
    return Array.from(byKey.values());
}
/**
 * Load all score records from *.json and scores.jsonl, dedupe by (run_id, stage), keep latest per group.
 * @param {string} [dataPath] - Optional path; defaults to getScoringDataPath()
 * @returns {RunScoreRecord[]} Deduplicated RunScoreRecord array
 */
function loadAndDedupeRecords(dataPath) {
    const pathToUse = dataPath != null && dataPath !== '' ? dataPath : (0, path_1.getScoringDataPath)();
    const base = pathToUse === (0, path_1.getScoringDataPath)() ? pathToUse : resolveDataPath(pathToUse);
    const raw = loadAllRecords(base);
    return dedupeByRunIdStage(raw);
}
