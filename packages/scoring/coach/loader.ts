import * as fs from 'fs';
import * as path from 'path';
import { getScoringDataPath } from '../constants/path';
import type { RunScoreRecord } from '../writer/types';

function resolveDataPath(dataPath?: string): string {
  if (dataPath == null || dataPath === '') {
    return getScoringDataPath();
  }
  return path.isAbsolute(dataPath) ? dataPath : path.resolve(process.cwd(), dataPath);
}

function sortByTimestamp(records: RunScoreRecord[]): RunScoreRecord[] {
  return records.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return ta - tb;
  });
}

function parseJsonFile(content: string, runId: string): RunScoreRecord[] {
  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) {
    return (parsed as RunScoreRecord[]).filter((record) => record.run_id === runId);
  }
  const record = parsed as RunScoreRecord;
  return record.run_id === runId ? [record] : [];
}

/**
 * Load RunScoreRecords for a given run_id from {runId}.json or scores.jsonl.
 * @param {string} runId - Run id to load
 * @param {string} [dataPath] - Optional data path; defaults to getScoringDataPath()
 * @returns {RunScoreRecord[]} Records sorted by timestamp
 */
export function loadRunRecords(runId: string, dataPath?: string): RunScoreRecord[] {
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

  const lines = fs.readFileSync(jsonlPath, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const records: RunScoreRecord[] = [];
  for (const line of lines) {
    const record = JSON.parse(line) as RunScoreRecord;
    if (record.run_id === runId) {
      records.push(record);
    }
  }

  return sortByTimestamp(records);
}

