import { describe, it, expect } from 'vitest';
import {
  groupByRunId,
  getLatestRunRecords,
  getRecentRuns,
  computeHealthScore,
  getDimensionScores,
  getWeakTop3,
  getHighIterationTop3,
  countVetoTriggers,
  getTrend,
} from '../compute';
import type { RunScoreRecord } from '../../writer/types';

function createRecord(overrides: Partial<RunScoreRecord> = {}): RunScoreRecord {
  return {
    run_id: 'dev-e6-s4-1730812345',
    scenario: 'real_dev',
    stage: 'spec',
    phase_score: 80,
    phase_weight: 20,
    check_items: [],
    timestamp: '2026-03-06T12:00:00Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

describe('groupByRunId', () => {
  it('groups records by run_id', () => {
    const records = [
      createRecord({ run_id: 'run-a', stage: 'spec' }),
      createRecord({ run_id: 'run-a', stage: 'plan' }),
      createRecord({ run_id: 'run-b', stage: 'spec' }),
    ];
    const map = groupByRunId(records);
    expect(map.get('run-a')).toHaveLength(2);
    expect(map.get('run-b')).toHaveLength(1);
  });
});

describe('getLatestRunRecords', () => {
  it('returns empty for empty input', () => {
    expect(getLatestRunRecords([])).toEqual([]);
  });

  it('returns records of the run with latest timestamp', () => {
    const records = [
      createRecord({ run_id: 'run-old', timestamp: '2026-03-05T10:00:00Z', stage: 'spec' }),
      createRecord({ run_id: 'run-old', timestamp: '2026-03-05T10:00:00Z', stage: 'plan' }),
      createRecord({ run_id: 'run-new', timestamp: '2026-03-06T12:00:00Z', stage: 'spec' }),
    ];
    const latest = getLatestRunRecords(records);
    expect(latest).toHaveLength(1);
    expect(latest[0]!.run_id).toBe('run-new');
  });
});

describe('computeHealthScore', () => {
  it('returns 0 for empty records', () => {
    expect(computeHealthScore([])).toBe(0);
  });

  it('computes weighted average and rounds', () => {
    const records = [
      createRecord({ phase_score: 80, phase_weight: 20 }),
      createRecord({ phase_score: 60, phase_weight: 30 }),
    ];
    expect(computeHealthScore(records)).toBe(68);
  });
});

describe('getDimensionScores', () => {
  it('returns 无数据 for dimensions with no data', () => {
    const records = [createRecord()];
    const dims = getDimensionScores(records);
    expect(dims.some((d) => d.score === '无数据')).toBe(true);
  });

  it('aggregates dimension_scores when present', () => {
    const records = [
      createRecord({
        dimension_scores: [
          { dimension: '功能性', weight: 0.3, score: 80 },
          { dimension: '代码质量', weight: 0.3, score: 70 },
        ],
      }),
    ];
    const dims = getDimensionScores(records);
    expect(dims.find((d) => d.dimension === '功能性')?.score).toBe(80);
    expect(dims.find((d) => d.dimension === '代码质量')?.score).toBe(70);
  });
});

describe('getHighIterationTop3', () => {
  it('returns top 3 by iteration_count descending, filters >0', () => {
    const records = [
      createRecord({ stage: 'a', iteration_count: 1 }),
      createRecord({ stage: 'b', iteration_count: 5 }),
      createRecord({ stage: 'c', iteration_count: 3 }),
      createRecord({ stage: 'd', iteration_count: 2 }),
    ];
    const top = getHighIterationTop3(records);
    expect(top).toHaveLength(3);
    expect(top[0]!.stage).toBe('b');
    expect(top[0]!.iteration_count).toBe(5);
    expect(top[1]!.stage).toBe('c');
    expect(top[1]!.iteration_count).toBe(3);
    expect(top[2]!.stage).toBe('d');
    expect(top[2]!.iteration_count).toBe(2);
  });

  it('returns [] when all iteration_count are 0', () => {
    const records = [
      createRecord({ stage: 'a', iteration_count: 0 }),
      createRecord({ stage: 'b', iteration_count: 0 }),
    ];
    expect(getHighIterationTop3(records)).toEqual([]);
  });
});

describe('getWeakTop3', () => {
  it('returns top 3 by lowest phase_score', () => {
    const records = [
      createRecord({ stage: 'a', phase_score: 90 }),
      createRecord({ stage: 'b', phase_score: 50 }),
      createRecord({ stage: 'c', phase_score: 30 }),
      createRecord({ stage: 'd', phase_score: 70 }),
    ];
    const weak = getWeakTop3(records);
    expect(weak).toHaveLength(3);
    expect(weak[0]!.stage).toBe('c');
    expect(weak[0]!.score).toBe(30);
    expect(weak[1]!.stage).toBe('b');
    expect(weak[2]!.stage).toBe('d');
  });
});

describe('countVetoTriggers', () => {
  it('counts passed=false items in veto config (excludes non-veto items)', () => {
    // veto_core_logic is a known veto item_id from buildVetoItemIds (implement-scoring.yaml ref)
    const vetoId = 'veto_core_logic';
    const records = [
      createRecord({
        check_items: [
          { item_id: vetoId, passed: false, score_delta: -10 },
          { item_id: 'other', passed: false, score_delta: -5 },
        ],
      }),
    ];
    const count = countVetoTriggers(records);
    expect(count).toBe(1); // only veto_core_logic counts; 'other' is not in vetoIds
  });

  it('returns 0 when no veto items triggered or empty check_items', () => {
    const records = [
      createRecord({ check_items: [] }),
      createRecord({ check_items: [{ item_id: 'non_veto', passed: false, score_delta: -5 }] }),
    ];
    expect(countVetoTriggers(records)).toBe(0);
  });
});

describe('getTrend', () => {
  it('returns 持平 for single run', () => {
    const records = [
      createRecord({ run_id: 'run-1', timestamp: '2026-03-06T12:00:00Z' }),
    ];
    expect(getTrend(records)).toBe('持平');
  });

  it('returns 升 when latest > previous', () => {
    const records = [
      createRecord({ run_id: 'run-new', timestamp: '2026-03-06T12:00:00Z', phase_score: 90, phase_weight: 20 }),
      createRecord({ run_id: 'run-old', timestamp: '2026-03-05T10:00:00Z', phase_score: 60, phase_weight: 20 }),
    ];
    expect(getTrend(records)).toBe('升');
  });

  it('returns 降 when latest < previous', () => {
    const records = [
      createRecord({ run_id: 'run-new', timestamp: '2026-03-06T12:00:00Z', phase_score: 50, phase_weight: 20 }),
      createRecord({ run_id: 'run-old', timestamp: '2026-03-05T10:00:00Z', phase_score: 80, phase_weight: 20 }),
    ];
    expect(getTrend(records)).toBe('降');
  });
});
