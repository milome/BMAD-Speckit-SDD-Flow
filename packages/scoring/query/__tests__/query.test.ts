import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  queryByEpic,
  queryByStory,
  queryLatest,
  queryByStage,
  queryByScenario,
} from '../index';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(
  runId: string,
  stage: string,
  opts?: { timestamp?: string; scenario?: 'real_dev' | 'eval_question'; source_path?: string }
): RunScoreRecord {
  return {
    run_id: runId,
    scenario: opts?.scenario ?? 'real_dev',
    stage,
    phase_score: 80,
    phase_weight: 0.2,
    check_items: [{ item_id: 'test', passed: true, score_delta: 0 }],
    timestamp: opts?.timestamp ?? new Date().toISOString(),
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...(opts?.source_path && { source_path: opts.source_path }),
  };
}

function createFixture(records: RunScoreRecord[]): string {
  const dir = path.join(os.tmpdir(), `query-fixture-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'scores.jsonl'),
    records.map((r) => JSON.stringify(r)).join('\n') + '\n',
    'utf-8'
  );
  return dir;
}

describe('query API', () => {
  it('queryByEpic returns only real_dev records matching epic', () => {
    const r1 = makeRecord('dev-e3-s1-prd-1', 'prd', { timestamp: '2026-01-01T00:00:00.000Z' });
    const r2 = makeRecord('dev-e3-s2-arch-1', 'arch', { timestamp: '2026-01-02T00:00:00.000Z' });
    const r3 = makeRecord('dev-e4-s1-prd-1', 'prd', { timestamp: '2026-01-03T00:00:00.000Z' });
    const r4 = makeRecord('eval-q001-v1-1', 'prd', {
      scenario: 'eval_question',
      timestamp: '2026-01-04T00:00:00.000Z',
    });
    const dir = createFixture([r1, r2, r3, r4]);

    const result = queryByEpic(3, dir);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.run_id.startsWith('dev-e3'))).toBe(true);
    expect(result.every((r) => r.scenario !== 'eval_question')).toBe(true);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('queryByStory returns only real_dev records matching epic and story', () => {
    const r1 = makeRecord('dev-e3-s1-prd-1', 'prd', { timestamp: '2026-01-01T00:00:00.000Z' });
    const r2 = makeRecord('dev-e3-s2-arch-1', 'arch', { timestamp: '2026-01-02T00:00:00.000Z' });
    const dir = createFixture([r1, r2]);

    const result = queryByStory(3, 1, dir);
    expect(result).toHaveLength(1);
    expect(result[0]!.run_id).toBe('dev-e3-s1-prd-1');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('queryLatest returns n records sorted by timestamp desc', () => {
    const r1 = makeRecord('run-1', 'prd', { timestamp: '2026-01-01T00:00:00.000Z' });
    const r2 = makeRecord('run-2', 'prd', { timestamp: '2026-01-03T00:00:00.000Z' });
    const r3 = makeRecord('run-3', 'prd', { timestamp: '2026-01-02T00:00:00.000Z' });
    const dir = createFixture([r1, r2, r3]);

    const result = queryLatest(2, dir);
    expect(result).toHaveLength(2);
    expect(result[0]!.timestamp).toBe('2026-01-03T00:00:00.000Z');
    expect(result[1]!.timestamp).toBe('2026-01-02T00:00:00.000Z');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('queryLatest(0) returns []', () => {
    const dir = createFixture([
      makeRecord('run-1', 'prd', { timestamp: '2026-01-01T00:00:00.000Z' }),
    ]);
    const result = queryLatest(0, dir);
    expect(result).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('queryLatest(-1) returns []', () => {
    const dir = createFixture([
      makeRecord('run-1', 'prd', { timestamp: '2026-01-01T00:00:00.000Z' }),
    ]);
    const result = queryLatest(-1, dir);
    expect(result).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('queryByStage returns records matching runId and stage', () => {
    const runId = `run-stage-${Date.now()}`;
    const r1 = makeRecord(runId, 'prd', { timestamp: '2026-01-01T00:00:00.000Z' });
    const r2 = makeRecord(runId, 'arch', { timestamp: '2026-01-02T00:00:00.000Z' });
    const dir = createFixture([r1, r2]);

    const result = queryByStage(runId, 'prd', dir);
    expect(result).toHaveLength(1);
    expect(result[0]!.stage).toBe('prd');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('queryByScenario returns records matching scenario', () => {
    const r1 = makeRecord('dev-1', 'prd', { scenario: 'real_dev' });
    const r2 = makeRecord('eval-q001', 'prd', { scenario: 'eval_question' });
    const dir = createFixture([r1, r2]);

    const realDev = queryByScenario('real_dev', dir);
    expect(realDev).toHaveLength(1);
    expect(realDev[0]!.scenario).toBe('real_dev');

    const evalQ = queryByScenario('eval_question', dir);
    expect(evalQ).toHaveLength(1);
    expect(evalQ[0]!.scenario).toBe('eval_question');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('queryByScenario invalid scenario returns []', () => {
    const dir = createFixture([makeRecord('run-1', 'prd')]);
    const result = queryByScenario('invalid', dir);
    expect(result).toEqual([]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('Epic/Story queries do not include eval_question', () => {
    const r1 = makeRecord('dev-e3-s1-1', 'prd', { scenario: 'real_dev' });
    const r2 = makeRecord('eval-q001', 'prd', {
      scenario: 'eval_question',
      source_path: 'story-3-1-eval',
    });
    const dir = createFixture([r1, r2]);

    const byEpic = queryByEpic(3, dir);
    expect(byEpic).toHaveLength(1);
    expect(byEpic[0]!.scenario).toBe('real_dev');

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('query module can be imported from external (integration)', () => {
    expect(typeof queryByEpic).toBe('function');
    expect(typeof queryByStory).toBe('function');
    expect(typeof queryLatest).toBe('function');
    expect(typeof queryByStage).toBe('function');
    expect(typeof queryByScenario).toBe('function');
  });
});
