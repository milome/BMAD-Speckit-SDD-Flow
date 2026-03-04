import * as fs from 'fs';
import * as path from 'path';
import { getScoringDataPath } from '../constants/path';
import { validateRunScoreRecord } from './validate';
import type { RunScoreRecord, WriteMode, WriteScoreRecordOptions } from './types';

const UTF8 = 'utf8';

/**
 * 确保评分数据目录存在；若不存在则创建（含父级）。
 * 与 plan §7 一致：mkdirSync(..., { recursive: true })。
 */
export function ensureDataDir(dataPath: string): void {
  fs.mkdirSync(dataPath, { recursive: true });
}

/**
 * 将单条记录写入单文件 scoring/data/{run_id}.json。
 * 同一 run_id 多次调用为覆盖语义（plan §4）。
 */
export function writeSingleFile(record: RunScoreRecord, dataPath: string): void {
  ensureDataDir(dataPath);
  const filePath = path.join(dataPath, `${record.run_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), UTF8);
}

/**
 * 向 scoring/data/scores.jsonl 追加一行 JSON，不覆盖已有行。
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

/**
 * 写入单条评分记录；模式由 mode 决定。
 * 写入前校验 record 符合 run-score-schema，否则抛错不写入。
 * 单文件模式下同一 run_id 多次写入为覆盖。
 */
export function writeScoreRecordSync(
  record: unknown,
  mode: WriteMode,
  options?: WriteScoreRecordOptions
): void {
  validateRunScoreRecord(record);
  const dataPath = getDataPath(options);
  if (mode === 'single_file') {
    writeSingleFile(record, dataPath);
    return;
  }
  if (mode === 'jsonl') {
    appendJsonl(record, dataPath);
    return;
  }
  if (mode === 'both') {
    writeSingleFile(record, dataPath);
    appendJsonl(record, dataPath);
    return;
  }
  throw new Error(`Unknown WriteMode: ${mode}`);
}
