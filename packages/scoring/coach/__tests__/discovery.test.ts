import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { discoverLatestRunId } from '../discovery';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(
  runId: string,
  stage: string,
  timestamp?: string,
  scenario: 'real_dev' | 'eval_question' = 'real_dev'
): RunScoreRecord {
  return {
    run_id: runId,
    scenario,
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

  it('filters by scenarioFilter real_dev: returns only real_dev latest', () => {
    const runIdReal = `discovery-scenario-real-${Date.now()}`;
    const runIdEval = `discovery-scenario-eval-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `discovery-scenario-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const tReal = '2026-01-03T00:00:00.000Z';
    const tEval = '2026-01-05T00:00:00.000Z';
    const lines = [
      JSON.stringify(makeRecord(runIdReal, 'plan', tReal, 'real_dev')),
      JSON.stringify(makeRecord(runIdEval, 'implement', tEval, 'eval_question')),
    ].join('\n');
    fs.writeFileSync(path.join(dataPath, 'scores.jsonl'), `${lines}\n`, 'utf-8');

    const result = discoverLatestRunId(dataPath, 100, 'real_dev');
    expect(result).not.toBeNull();
    expect(result!.runId).toBe(runIdReal);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('filters by scenarioFilter eval_question: returns only eval_question latest', () => {
    const runIdReal = `discovery-scenario-real2-${Date.now()}`;
    const runIdEval = `discovery-scenario-eval2-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `discovery-scenario2-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const tReal = '2026-01-03T00:00:00.000Z';
    const tEval = '2026-01-05T00:00:00.000Z';
    const lines = [
      JSON.stringify(makeRecord(runIdReal, 'plan', tReal, 'real_dev')),
      JSON.stringify(makeRecord(runIdEval, 'implement', tEval, 'eval_question')),
    ].join('\n');
    fs.writeFileSync(path.join(dataPath, 'scores.jsonl'), `${lines}\n`, 'utf-8');

    const result = discoverLatestRunId(dataPath, 100, 'eval_question');
    expect(result).not.toBeNull();
    expect(result!.runId).toBe(runIdEval);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('no scenarioFilter: returns latest across all scenarios (backward compatible)', () => {
    const runIdReal = `discovery-noFilter-real-${Date.now()}`;
    const runIdEval = `discovery-noFilter-eval-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `discovery-noFilter-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const tReal = '2026-01-03T00:00:00.000Z';
    const tEval = '2026-01-05T00:00:00.000Z';
    const lines = [
      JSON.stringify(makeRecord(runIdReal, 'plan', tReal, 'real_dev')),
      JSON.stringify(makeRecord(runIdEval, 'implement', tEval, 'eval_question')),
    ].join('\n');
    fs.writeFileSync(path.join(dataPath, 'scores.jsonl'), `${lines}\n`, 'utf-8');

    const result = discoverLatestRunId(dataPath);
    expect(result).not.toBeNull();
    expect(result!.runId).toBe(runIdEval);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('scenarioFilter with no matching records returns null', () => {
    const runIdEval = `discovery-only-eval-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `discovery-only-eval-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(
      path.join(dataPath, 'scores.jsonl'),
      JSON.stringify(makeRecord(runIdEval, 'plan', undefined, 'eval_question')) + '\n',
      'utf-8'
    );

    const result = discoverLatestRunId(dataPath, 100, 'real_dev');
    expect(result).toBeNull();

    fs.rmSync(dataPath, { recursive: true, force: true });
  });
});
