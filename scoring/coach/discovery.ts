/**
 * Story 6.1: Discovery 最新 run_id
 * 扫描 getScoringDataPath 下 *.json 与 scores.jsonl，按 timestamp 取最新 N 条，
 * 返回拥有最新 timestamp 的记录的 run_id。
 */
import * as fs from 'fs';
import * as path from 'path';
import type { RunScoreRecord } from '../writer/types';

const DEFAULT_LIMIT = 100;
const EXCLUDED_JSON = ['sft-dataset.json'];

function isRunScoreRecord(obj: unknown): obj is RunScoreRecord {
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

function parseRecords(content: string, _filePath: string): RunScoreRecord[] {
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
  const base = path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
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
        records.push(...parseRecords(content, full));
      } catch {
        // skip
      }
    }
  }

  if (fs.existsSync(path.join(base, 'scores.jsonl'))) {
    const jsonlPath = path.join(base, 'scores.jsonl');
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

/**
 * 扫描 dataPath 下 *.json 与 scores.jsonl，解析为 RunScoreRecord[]，
 * 按 timestamp 降序取前 limit 条，返回拥有最新 timestamp 的记录的 run_id。
 *
 * @param dataPath - 数据根路径（通常 getScoringDataPath()）
 * @param limit - 最多考虑的记录数，默认 100
 * @param scenarioFilter - 可选。'real_dev' | 'eval_question' | 'all' | undefined
 *   - undefined 或 'all'：不过滤 scenario（向后兼容）
 *   - 'real_dev'：仅考虑 scenario=real_dev
 *   - 'eval_question'：仅考虑 scenario=eval_question
 * @returns { runId, truncated } 或 null（无记录时）
 */
export function discoverLatestRunId(
  dataPath: string,
  limit: number = DEFAULT_LIMIT,
  scenarioFilter?: 'real_dev' | 'eval_question' | 'all'
): { runId: string; truncated: boolean } | null {
  let records = loadAllRecords(dataPath);
  if (scenarioFilter != null && scenarioFilter !== 'all') {
    records = records.filter((r) => r.scenario === scenarioFilter);
  }
  if (records.length === 0) return null;

  const sorted = records.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return tb - ta; // 降序
  });

  const total = sorted.length;
  const taken = sorted.slice(0, limit);
  const first = taken[0];
  if (!first) return null;

  return {
    runId: first.run_id,
    truncated: total > limit,
  };
}
