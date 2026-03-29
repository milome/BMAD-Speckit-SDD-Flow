import * as fs from 'fs';
import * as path from 'path';
import { getScoringDataPath } from '../constants/path';
import { validateRunScoreRecord, validateScenarioConstraints } from './validate';
import type {
  GovernanceRerunHistoryEntry,
  RunScoreRecord,
  WriteMode,
  WriteScoreRecordOptions,
} from './types';

const UTF8 = 'utf8';

/**
 * 确保评分数据目录存在；若不存在则创建（含父级）。
 * 与 plan §7 一致：mkdirSync(..., { recursive: true })。
 *
 * @param {string} dataPath - Absolute or relative path to scoring data directory.
 * @returns {void}
 */
export function ensureDataDir(dataPath: string): void {
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
export function writeSingleFile(record: RunScoreRecord, dataPath: string): void {
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
export function appendJsonl(record: RunScoreRecord, dataPath: string): void {
  ensureDataDir(dataPath);
  const jsonlPath = path.join(dataPath, 'scores.jsonl');
  const line = JSON.stringify(record) + '\n';
  fs.appendFileSync(jsonlPath, line, UTF8);
}

function getDataPath(options?: WriteScoreRecordOptions): string {
  const p = options?.dataPath;
  if (p != null) {
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }
  return getScoringDataPath();
}

function mergeGovernanceRerunHistory(
  existing: GovernanceRerunHistoryEntry[] | undefined,
  incoming: GovernanceRerunHistoryEntry[] | undefined
): GovernanceRerunHistoryEntry[] | undefined {
  const merged = new Map<string, GovernanceRerunHistoryEntry>();

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

function tryReadExistingSingleFileRecord(
  record: RunScoreRecord,
  dataPath: string
): RunScoreRecord | undefined {
  const filePath = path.join(dataPath, `${record.run_id}.json`);
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, UTF8)) as RunScoreRecord;
    return parsed.stage === record.stage ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function mergeWithExistingSingleFileRecord(record: RunScoreRecord, dataPath: string): RunScoreRecord {
  const existing = tryReadExistingSingleFileRecord(record, dataPath);
  if (!existing) {
    return record;
  }

  return {
    ...existing,
    ...record,
    ...(record.run_group_id == null && existing.run_group_id != null
      ? { run_group_id: existing.run_group_id }
      : {}),
    governance_rerun_history: mergeGovernanceRerunHistory(
      existing.governance_rerun_history,
      record.governance_rerun_history
    ),
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
export function writeScoreRecordSync(
  record: unknown,
  mode: WriteMode,
  options?: WriteScoreRecordOptions
): void {
  validateRunScoreRecord(record);
  let r = record as RunScoreRecord;
  const dataPath = getDataPath(options);
  r = mergeWithExistingSingleFileRecord(r, dataPath);
  validateScenarioConstraints(r);
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
