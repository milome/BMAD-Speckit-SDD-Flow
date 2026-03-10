/**
 * Story 6.3: scoring/query/ 数据加载与去重
 * 从 getScoringDataPath() 下 *.json 与 scores.jsonl 加载，按 (run_id, stage) 去重取 timestamp 最新。
 */
import * as fs from 'fs';
import * as path from 'path';
import { getScoringDataPath } from '../constants/path';
import type { RunScoreRecord } from '../writer/types';

export const EXCLUDED_JSON = ['sft-dataset.json'];

export function isRunScoreRecord(obj: unknown): obj is RunScoreRecord {
  if (obj == null || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.run_id === 'string' &&
    o.run_id.length > 0 &&
    typeof o.timestamp === 'string' &&
    (o.scenario === 'real_dev' || o.scenario === 'eval_question') &&
    typeof o.stage === 'string'
  );
}

function resolveDataPath(dataPath?: string): string {
  if (dataPath == null || dataPath === '') {
    return getScoringDataPath();
  }
  return path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
}

function parseRecords(content: string): RunScoreRecord[] {
  const records: RunScoreRecord[] = [];
  try {
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (isRunScoreRecord(item)) records.push(item);
      }
    } else if (isRunScoreRecord(parsed)) {
      records.push(parsed);
    }
  } catch {
    // skip invalid json
  }
  return records;
}

function loadAllRecords(dataPath: string): RunScoreRecord[] {
  const base = resolveDataPath(dataPath);
  const records: RunScoreRecord[] = [];

  if (!fs.existsSync(base)) {
    return [];
  }

  const entries = fs.readdirSync(base, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    const full = path.join(base, e.name);

    if (e.name.endsWith('.json') && !EXCLUDED_JSON.includes(e.name)) {
      try {
        const content = fs.readFileSync(full, 'utf-8');
        records.push(...parseRecords(content));
      } catch {
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
        const parsed = JSON.parse(line) as unknown;
        if (isRunScoreRecord(parsed)) records.push(parsed);
      } catch {
        // skip invalid line
      }
    }
  }

  return records;
}

/** 按 (run_id, stage) 分组，每组取 timestamp 最大的一条 */
function dedupeByRunIdStage(records: RunScoreRecord[]): RunScoreRecord[] {
  const byKey = new Map<string, RunScoreRecord>();
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
 * 加载所有评分记录并按 (run_id, stage) 去重，保留每组 timestamp 最新的一条。
 */
export function loadAndDedupeRecords(dataPath?: string): RunScoreRecord[] {
  const pathToUse = dataPath != null && dataPath !== '' ? dataPath : getScoringDataPath();
  const base = pathToUse === getScoringDataPath() ? pathToUse : resolveDataPath(pathToUse);
  const raw = loadAllRecords(base);
  return dedupeByRunIdStage(raw);
}
