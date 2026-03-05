/**
 * Story 6.2: Epic/Story 筛选（最小 inline 实现）
 * run_id 正则、source_path fallback、scenario 过滤
 */
import * as fs from 'fs';
import * as path from 'path';
import type { RunScoreRecord } from '../writer/types';

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

function loadAllRecordsForFilter(dataPath: string): RunScoreRecord[] {
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
        records.push(...parseRecords(content));
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

const RUN_ID_EPIC_STORY_RE = /-e(\d+)-s(\d+)(?:-|$)/;

function parseEpicStoryFromRunId(runId: string): { epicId: number; storyId: number } | null {
  const m = runId.match(RUN_ID_EPIC_STORY_RE);
  if (m) {
    return { epicId: parseInt(m[1], 10), storyId: parseInt(m[2], 10) };
  }
  return null;
}

const SOURCE_PATH_EPIC_STORY_RE = /epic-(\d+)-[^/]*\/story-(\d+)-/;
const SOURCE_PATH_STORY_EPIC_STORY_RE = /story-(\d+)-(\d+)-/;

function parseEpicStoryFromSourcePath(sourcePath: string): { epicId: number; storyId: number } | null {
  if (!sourcePath) return null;
  let m = sourcePath.match(SOURCE_PATH_EPIC_STORY_RE);
  if (m) {
    return { epicId: parseInt(m[1], 10), storyId: parseInt(m[2], 10) };
  }
  m = sourcePath.match(SOURCE_PATH_STORY_EPIC_STORY_RE);
  if (m) {
    return { epicId: parseInt(m[1], 10), storyId: parseInt(m[2], 10) };
  }
  return null;
}

/**
 * 从 record 解析 epicId、storyId。优先 run_id 正则，其次 source_path fallback。
 */
export function parseEpicStoryFromRecord(
  record: RunScoreRecord
): { epicId: number; storyId: number } | null {
  const fromRunId = parseEpicStoryFromRunId(record.run_id);
  if (fromRunId) return fromRunId;
  if (record.source_path) {
    return parseEpicStoryFromSourcePath(record.source_path);
  }
  return null;
}

export interface FilterEpicStoryResult {
  records: RunScoreRecord[];
  runId: string;
}

export interface FilterEpicStoryError {
  error: string;
}

/**
 * 按 epicId/storyId 筛选评分记录。仅针对 scenario !== 'eval_question'。
 * 空目录返回「暂无评分数据...」；无可解析返回「当前评分记录无可解析...」；无匹配返回「无可筛选数据」。
 */
export function filterByEpicStory(
  dataPath: string,
  filter: { epicId?: number; storyId?: number }
): FilterEpicStoryResult | FilterEpicStoryError {
  const all = loadAllRecordsForFilter(dataPath);
  if (all.length === 0) {
    return { error: '暂无评分数据，请先完成至少一轮 Dev Story' };
  }

  const realDev = all.filter((r) => r.scenario !== 'eval_question');
  const withParsed = realDev.map((r) => ({ record: r, parsed: parseEpicStoryFromRecord(r) }));

  const parsable = withParsed.filter((x) => x.parsed != null);
  if (parsable.length === 0) {
    return { error: '当前评分记录无可解析 Epic/Story，请确认 run_id 约定' };
  }

  const matched = parsable.filter((x) => {
    const p = x.parsed!;
    if (filter.storyId != null && filter.epicId != null) {
      return p.epicId === filter.epicId && p.storyId === filter.storyId;
    }
    if (filter.epicId != null) {
      return p.epicId === filter.epicId;
    }
    return false;
  });

  if (matched.length === 0) {
    return { error: '无可筛选数据' };
  }

  const byRunId = new Map<string, typeof matched>();
  for (const m of matched) {
    const rid = m.record.run_id;
    if (!byRunId.has(rid)) byRunId.set(rid, []);
    byRunId.get(rid)!.push(m);
  }

  let latestRunId = '';
  let latestTs = 0;
  for (const [rid, items] of byRunId) {
    const rec = items[0]!.record;
    const ts = new Date(rec.timestamp).getTime();
    if (ts > latestTs) {
      latestTs = ts;
      latestRunId = rid;
    }
  }

  const recordsForRun = all.filter((r) => r.run_id === latestRunId);
  return { records: recordsForRun, runId: latestRunId };
}
