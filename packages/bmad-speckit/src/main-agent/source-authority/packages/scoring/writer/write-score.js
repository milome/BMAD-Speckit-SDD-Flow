"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDataDir = ensureDataDir;
exports.writeSingleFile = writeSingleFile;
exports.appendJsonl = appendJsonl;
exports.writeScoreRecordSync = writeScoreRecordSync;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const path_1 = require("../constants/path");
const validate_1 = require("./validate");
const UTF8 = 'utf8';
/**
 * 确保评分数据目录存在；若不存在则创建（含父级）。
 * 与 plan §7 一致：mkdirSync(..., { recursive: true })。
 *
 * @param {string} dataPath - Absolute or relative path to scoring data directory.
 * @returns {void}
 */
function ensureDataDir(dataPath) {
    fs.mkdirSync(dataPath, { recursive: true });
}
/**
 * 将单条记录写入单文件 scoring/data/{run_id}.json。
 * 同一 run_id 多次调用为覆盖语义（plan §4）。
 *
 * @param {RunScoreRecord} record - RunScoreRecord to write.
 * @param {string} dataPath - Scoring data directory path.
 * @returns {void}
 */
function writeSingleFile(record, dataPath) {
    ensureDataDir(dataPath);
    const filePath = path.join(dataPath, `${record.run_id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), UTF8);
}
/**
 * 向 scoring/data/scores.jsonl 追加一行 JSON，不覆盖已有行。
 *
 * @param {RunScoreRecord} record - RunScoreRecord to append.
 * @param {string} dataPath - Scoring data directory path.
 * @returns {void}
 */
function appendJsonl(record, dataPath) {
    ensureDataDir(dataPath);
    const jsonlPath = path.join(dataPath, 'scores.jsonl');
    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(jsonlPath, line, UTF8);
}
function getDataPath(options) {
    const p = options?.dataPath;
    if (p != null) {
        return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    }
    return (0, path_1.getScoringDataPath)();
}
function mergeGovernanceRerunHistory(existing, incoming) {
    const merged = new Map();
    for (const item of existing ?? []) {
        if (item?.event_id) {
            merged.set(item.event_id, item);
        }
    }
    for (const item of incoming ?? []) {
        if (item?.event_id) {
            merged.set(item.event_id, item);
        }
    }
    if (merged.size === 0) {
        return undefined;
    }
    return [...merged.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}
function tryReadExistingSingleFileRecord(record, dataPath) {
    const filePath = path.join(dataPath, `${record.run_id}.json`);
    if (!fs.existsSync(filePath)) {
        return undefined;
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, UTF8));
        return parsed.stage === record.stage ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
function mergeWithExistingSingleFileRecord(record, dataPath) {
    const existing = tryReadExistingSingleFileRecord(record, dataPath);
    if (!existing) {
        return record;
    }
    return {
        ...existing,
        ...record,
        ...(record.story_key == null && existing.story_key != null
            ? { story_key: existing.story_key }
            : {}),
        ...(record.story_id == null && existing.story_id != null
            ? { story_id: existing.story_id }
            : {}),
        ...(record.epic_id == null && existing.epic_id != null ? { epic_id: existing.epic_id } : {}),
        ...(record.artifact_root == null && existing.artifact_root != null
            ? { artifact_root: existing.artifact_root }
            : {}),
        ...(record.host == null && existing.host != null ? { host: existing.host } : {}),
        ...(record.host_kind == null && existing.host_kind != null
            ? { host_kind: existing.host_kind }
            : {}),
        ...(record.run_group_id == null && existing.run_group_id != null
            ? { run_group_id: existing.run_group_id }
            : {}),
        governance_rerun_history: mergeGovernanceRerunHistory(existing.governance_rerun_history, record.governance_rerun_history),
    };
}
/**
 * 写入单条评分记录；模式由 mode 决定。
 * 写入前校验 record 符合 run-score-schema，否则抛错不写入。
 * 单文件模式下同一 run_id 多次写入为覆盖。
 *
 * @param {unknown} record - RunScoreRecord (validated via validateRunScoreRecord).
 * @param {WriteMode} mode - 'single_file' | 'jsonl' | 'both'.
 * @param {WriteScoreRecordOptions} [options] - Optional WriteScoreRecordOptions (dataPath override).
 * @returns {void}
 * @throws Error when validation fails or mode is unknown.
 */
function writeScoreRecordSync(record, mode, options) {
    (0, validate_1.validateRunScoreRecord)(record);
    let r = record;
    const dataPath = getDataPath(options);
    r = mergeWithExistingSingleFileRecord(r, dataPath);
    (0, validate_1.validateScenarioConstraints)(r);
    if (r.path_type == null || r.path_type === '') {
        r.path_type = 'full';
    }
    if (mode === 'single_file') {
        writeSingleFile(r, dataPath);
        return;
    }
    if (mode === 'jsonl') {
        appendJsonl(r, dataPath);
        return;
    }
    if (mode === 'both') {
        writeSingleFile(r, dataPath);
        appendJsonl(r, dataPath);
        return;
    }
    throw new Error(`Unknown WriteMode: ${mode}`);
}
