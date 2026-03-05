import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { discoverLatestRunId } from '../discovery';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(runId: string, stage: string, timestamp?: string): RunScoreRecord {
  return {
    run_id: runId,
    scenario: 'real_dev',
    stage,
    phase_score: 80,
    phase_weight: 0.2,
    check_items: [{ item_id: 'test', passed: true, score_delta: 0 }],
    timestamp: timestamp ?? new Date().toISOString(),
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
  };
}

describe('discoverLatestRunId', () => {
  it('returns null for empty directory', () => {
    const dataPath = path.join(os.tmpdir(), `discovery-empty-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const result = discoverLatestRunId(dataPath);
    expect(result).toBeNull();
    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('returns null when directory does not exist', () => {
    const dataPath = path.join(os.tmpdir(), `discovery-nonexist-${Date.now()}`);
    const result = discoverLatestRunId(dataPath);
    expect(result).toBeNull();
  });

  it('returns runId from single *.json file', () => {
    const runId = `discovery-single-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `discovery-single-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(
      path.join(dataPath, `${runId}.json`),
      JSON.stringify(makeRecord(runId, 'implement'), null, 2),
      'utf-8'
    );

    const result = discoverLatestRunId(dataPath);
    expect(result).not.toBeNull();
    expect(result!.runId).toBe(runId);
    expect(result!.truncated).toBe(false);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('returns latest runId from scores.jsonl', () => {
    const runId1 = `discovery-jsonl-a-${Date.now()}`;
    const runId2 = `discovery-jsonl-b-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `discovery-jsonl-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const t1 = '2026-01-01T00:00:00.000Z';
    const t2 = '2026-01-02T00:00:00.000Z';
    const lines = [
      JSON.stringify(makeRecord(runId1, 'plan', t1)),
      JSON.stringify(makeRecord(runId2, 'implement', t2)),
    ].join('\n');
    fs.writeFileSync(path.join(dataPath, 'scores.jsonl'), `${lines}\n`, 'utf-8');

    const result = discoverLatestRunId(dataPath);
    expect(result).not.toBeNull();
    expect(result!.runId).toBe(runId2);
    expect(result!.truncated).toBe(false);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('returns truncated true when records exceed limit', () => {
    const dataPath = path.join(os.tmpdir(), `discovery-limit-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const records: RunScoreRecord[] = [];
    for (let i = 0; i < 10; i++) {
      const day = String(i + 1).padStart(2, '0');
      records.push(makeRecord(`run-${i}`, 'spec', `2026-01-${day}T00:00:00.000Z`));
    }
    fs.writeFileSync(path.join(dataPath, 'scores.jsonl'), records.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');

    const result = discoverLatestRunId(dataPath, 5);
    expect(result).not.toBeNull();
    expect(result!.runId).toBe('run-9');
    expect(result!.truncated).toBe(true);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('excludes sft-dataset.jsonl', () => {
    const runId = `discovery-exclude-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `discovery-exclude-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(
      path.join(dataPath, `${runId}.json`),
      JSON.stringify(makeRecord(runId, 'implement'), null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(dataPath, 'sft-dataset.jsonl'),
      '{"invalid": "line"}\n',
      'utf-8'
    );

    const result = discoverLatestRunId(dataPath);
    expect(result).not.toBeNull();
    expect(result!.runId).toBe(runId);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('skips non-scoring schema json', () => {
    const dataPath = path.join(os.tmpdir(), `discovery-nonscore-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(
      path.join(dataPath, 'other.json'),
      JSON.stringify({ foo: 'bar' }),
      'utf-8'
    );

    const result = discoverLatestRunId(dataPath);
    expect(result).toBeNull();

    fs.rmSync(dataPath, { recursive: true, force: true });
  });
});
