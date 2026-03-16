import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadRunRecords } from '../loader';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(runId: string, stage: string): RunScoreRecord {
  return {
    run_id: runId,
    scenario: 'real_dev',
    stage,
    phase_score: 80,
    phase_weight: 0.2,
    check_items: [{ item_id: 'functional_correctness', passed: true, score_delta: 0 }],
    timestamp: new Date().toISOString(),
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
  };
}

describe('loadRunRecords', () => {
  it('loads run records from {runId}.json', () => {
    const runId = `loader-file-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-loader-file-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(
      path.join(dataPath, `${runId}.json`),
      JSON.stringify(makeRecord(runId, 'implement'), null, 2),
      'utf-8'
    );

    const records = loadRunRecords(runId, dataPath);
    expect(records.length).toBe(1);
    expect(records[0].run_id).toBe(runId);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('loads run records from scores.jsonl when single file absent', () => {
    const runId = `loader-jsonl-${Date.now()}`;
    const otherRunId = `loader-jsonl-other-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-loader-jsonl-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const lines = [
      JSON.stringify(makeRecord(otherRunId, 'plan')),
      JSON.stringify(makeRecord(runId, 'implement')),
      JSON.stringify(makeRecord(runId, 'post_impl')),
    ].join('\n');
    fs.writeFileSync(path.join(dataPath, 'scores.jsonl'), `${lines}\n`, 'utf-8');

    const records = loadRunRecords(runId, dataPath);
    expect(records.length).toBe(2);
    expect(records.every((r) => r.run_id === runId)).toBe(true);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('returns [] when single-file object has run_id different from requested runId', () => {
    const runId = `loader-file-${Date.now()}`;
    const otherRunId = `other-run-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-loader-mismatch-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(
      path.join(dataPath, `${runId}.json`),
      JSON.stringify(makeRecord(otherRunId, 'implement'), null, 2),
      'utf-8'
    );

    const records = loadRunRecords(runId, dataPath);
    expect(records.length).toBe(0);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('filters out non-target run_id records in mixed single-file array payload', () => {
    const runId = `loader-mixed-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `coach-loader-mixed-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const mixed = [
      makeRecord(runId, 'implement'),
      makeRecord('other-run', 'post_impl'),
    ];
    fs.writeFileSync(path.join(dataPath, `${runId}.json`), JSON.stringify(mixed, null, 2), 'utf-8');

    const records = loadRunRecords(runId, dataPath);
    expect(records.length).toBe(1);
    expect(records[0].run_id).toBe(runId);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });
});

