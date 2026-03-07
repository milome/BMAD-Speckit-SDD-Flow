/**
 * Story 9.3: Epic 级仪表盘聚合单测
 * US-1.1～US-2.1
 */
import { describe, it, expect } from 'vitest';
import {
  aggregateByEpicOnly,
  getEpicAggregateRecords,
  computeEpicHealthScore,
  getEpicDimensionScores,
  getLatestRunRecordsV2,
  aggregateByEpicStoryTimeWindow,
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

describe('aggregateByEpicOnly (US-1.1, AC-1)', () => {
  it('epic=9、windowHours=168 时仅返回 E9.*，排除 E8.S1', () => {
    const now = Date.now();
    const recent = new Date(now - 1 * 60 * 60 * 1000).toISOString();
    const records = [
      createRecord({ run_id: 'dev-e9-s1-spec-1', stage: 'spec', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s2-spec-1', stage: 'spec', timestamp: recent }),
      createRecord({ run_id: 'dev-e8-s1-spec-1', stage: 'spec', timestamp: recent }),
    ];
    const result = aggregateByEpicOnly(records, 9, 168);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.run_id.includes('-e9-'))).toBe(true);
    expect(result.some((r) => r.run_id.includes('-e8-'))).toBe(false);
  });

  it('与 aggregateByEpicStoryTimeWindow 在 epic+story 时结果一致', () => {
    const now = Date.now();
    const recent = new Date(now - 1 * 60 * 60 * 1000).toISOString();
    const records = [
      createRecord({ run_id: 'dev-e9-s1-spec-1', stage: 'spec', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s1-plan-1', stage: 'plan', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s2-spec-1', stage: 'spec', timestamp: recent }),
    ];
    const epicOnly = aggregateByEpicOnly(records, 9, 168);
    const epicStory = aggregateByEpicStoryTimeWindow(records, 9, 1, 168);
    expect(epicOnly.filter((r) => r.run_id.includes('-e9-s1-'))).toEqual(epicStory);
  });

  it('排除 windowHours 外的记录', () => {
    const now = Date.now();
    const recent = new Date(now - 1 * 60 * 60 * 1000).toISOString();
    const old = new Date(now - 200 * 60 * 60 * 1000).toISOString();
    const records = [
      createRecord({ run_id: 'dev-e9-s1-spec-1', stage: 'spec', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s1-plan-1', stage: 'plan', timestamp: old }),
    ];
    const result = aggregateByEpicOnly(records, 9, 168);
    expect(result).toHaveLength(1);
    expect(result[0]!.run_id).toBe('dev-e9-s1-spec-1');
  });
});

describe('getEpicAggregateRecords (US-1.2, AC-2)', () => {
  it('E9 有 S1、S2 各一完整 run 返回 6 条；S3 仅 1 stage 不包含', () => {
    const now = Date.now();
    const recent = new Date(now - 1 * 60 * 60 * 1000).toISOString();
    const records = [
      createRecord({ run_id: 'dev-e9-s1-spec-1', stage: 'spec', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s1-plan-2', stage: 'plan', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s1-tasks-3', stage: 'tasks', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s2-spec-1', stage: 'spec', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s2-plan-2', stage: 'plan', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s2-tasks-3', stage: 'tasks', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s3-spec-1', stage: 'spec', timestamp: recent }),
    ];
    const result = getEpicAggregateRecords(records, 9, 168);
    expect(result).toHaveLength(6);
    const runIds = new Set(result.map((r) => r.run_id));
    expect(runIds.has('dev-e9-s1-spec-1') || result.some((r) => r.run_id.includes('-e9-s1-'))).toBe(true);
    expect(result.every((r) => !r.run_id.includes('-e9-s3-'))).toBe(true);
  });
});

describe('computeEpicHealthScore (US-1.3, AC-3)', () => {
  it('S1 80、S2 90 → Epic 85', () => {
    const records = [
      createRecord({ run_id: 'dev-e9-s1-x', phase_score: 80, phase_weight: 20 }),
      createRecord({ run_id: 'dev-e9-s1-x', phase_score: 80, phase_weight: 30 }),
      createRecord({ run_id: 'dev-e9-s2-x', phase_score: 90, phase_weight: 20 }),
      createRecord({ run_id: 'dev-e9-s2-x', phase_score: 90, phase_weight: 30 }),
    ];
    const score = computeEpicHealthScore(records);
    expect(score).toBe(85);
  });

  it('单 Story 时等价于 computeHealthScore', () => {
    const records = [
      createRecord({ run_id: 'dev-e9-s1-x', phase_score: 75, phase_weight: 20 }),
      createRecord({ run_id: 'dev-e9-s1-x', phase_score: 75, phase_weight: 30 }),
    ];
    const score = computeEpicHealthScore(records);
    expect(score).toBe(75);
  });
});

describe('getEpicDimensionScores (US-1.4, AC-4)', () => {
  it('2 Story 各 2 维，断言合并与平均正确', () => {
    const records = [
      createRecord({
        run_id: 'dev-e9-s1-x',
        dimension_scores: [
          { dimension: 'A', weight: 0.25, score: 80 },
          { dimension: 'B', weight: 0.25, score: 60 },
        ],
      }),
      createRecord({
        run_id: 'dev-e9-s2-x',
        dimension_scores: [
          { dimension: 'A', weight: 0.25, score: 100 },
          { dimension: 'B', weight: 0.25, score: 80 },
        ],
      }),
    ];
    const dims = getEpicDimensionScores(records);
    const a = dims.find((d) => d.dimension === 'A');
    const b = dims.find((d) => d.dimension === 'B');
    expect(a?.score).toBe(90);
    expect(b?.score).toBe(70);
  });

  it('单 Story 时与 getDimensionScores 一致', () => {
    const records = [
      createRecord({
        run_id: 'dev-e9-s1-x',
        dimension_scores: [
          { dimension: '功能性', weight: 0.3, score: 85 },
        ],
      }),
    ];
    const dims = getEpicDimensionScores(records);
    expect(dims.find((d) => d.dimension === '功能性')?.score).toBe(85);
  });
});

describe('getLatestRunRecordsV2 epic-only (US-2.1, AC-5)', () => {
  it('epic=9、story=null 时仅含 E9 records', () => {
    const now = Date.now();
    const recent = new Date(now - 1 * 60 * 60 * 1000).toISOString();
    const records = [
      createRecord({ run_id: 'dev-e9-s1-spec-1', stage: 'spec', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s1-plan-2', stage: 'plan', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s1-tasks-3', stage: 'tasks', timestamp: recent }),
      createRecord({ run_id: 'dev-e8-s1-spec-1', stage: 'spec', timestamp: recent }),
    ];
    const result = getLatestRunRecordsV2(records, {
      strategy: 'epic_story_window',
      epic: 9,
      windowHours: 168,
    });
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.run_id.includes('-e9-'))).toBe(true);
  });

  it('strategy=run_id 时 epic 忽略', () => {
    const records = [
      createRecord({ run_id: 'run-a', stage: 'spec', timestamp: '2026-03-06T12:00:00Z' }),
      createRecord({ run_id: 'run-a', stage: 'plan', timestamp: '2026-03-06T12:00:00Z' }),
      createRecord({ run_id: 'run-a', stage: 'tasks', timestamp: '2026-03-06T12:00:00Z' }),
    ];
    const withEpic = getLatestRunRecordsV2(records, { strategy: 'run_id', epic: 9 });
    const withoutEpic = getLatestRunRecordsV2(records, { strategy: 'run_id' });
    expect(withEpic).toEqual(withoutEpic);
  });

  it('epic+story 时行为不变', () => {
    const now = Date.now();
    const recent = new Date(now - 1 * 60 * 60 * 1000).toISOString();
    const records = [
      createRecord({ run_id: 'dev-e9-s1-spec-1', stage: 'spec', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s1-plan-2', stage: 'plan', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s1-tasks-3', stage: 'tasks', timestamp: recent }),
    ];
    const result = getLatestRunRecordsV2(records, {
      strategy: 'epic_story_window',
      epic: 9,
      story: 1,
      windowHours: 168,
    });
    expect(result).toHaveLength(3);
  });
});
