/**
 * Story 9.1 T11: dashboard-generate 对 fixture 的集成测试
 */
import * as path from 'path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { loadAndDedupeRecords } from '../../query/loader';
import {
  getLatestRunRecordsV2,
  computeHealthScore,
  getDimensionScores,
  getWeakTop3EpicStory,
} from '../../dashboard';

const FIXTURE_PATH = path.join(
  process.cwd(),
  'packages',
  'scoring',
  'data',
  '__fixtures-dashboard-epic-story'
);

describe('dashboard with fixture (E9-S1 T11)', () => {
  beforeAll(() => {
    vi.useFakeTimers({ now: new Date('2026-03-06T14:00:00Z') });
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it('getLatestRunRecordsV2 returns complete run for epic=99 story=99', () => {
    const records = loadAndDedupeRecords(FIXTURE_PATH).filter(
      (r) => r.scenario !== 'eval_question'
    );
    const latest = getLatestRunRecordsV2(records, {
      strategy: 'epic_story_window',
      epic: 99,
      story: 99,
      windowHours: 168,
    });
    expect(latest).toHaveLength(3);
    expect(new Set(latest.map((r) => r.stage))).toEqual(new Set(['spec', 'plan', 'tasks']));
  });

  it('health score and dimensions match fixture (±1)', () => {
    const records = loadAndDedupeRecords(FIXTURE_PATH).filter(
      (r) => r.scenario !== 'eval_question'
    );
    const latest = getLatestRunRecordsV2(records, {
      strategy: 'epic_story_window',
      epic: 99,
      story: 99,
      windowHours: 168,
    });
    const healthScore = computeHealthScore(latest);
    const dimensions = getDimensionScores(latest);

    expect(healthScore).toBeGreaterThanOrEqual(79);
    expect(healthScore).toBeLessThanOrEqual(81);

    const needDim = dimensions.find((d) => d.dimension === '需求完整性');
    expect(needDim?.score).toBeGreaterThanOrEqual(79);
    expect(needDim?.score).toBeLessThanOrEqual(81);

    const weak = getWeakTop3EpicStory(records);
    expect(weak.length).toBeGreaterThan(0);
    expect(weak[0]!.epicStory).toBe('E99.S99');
    expect(weak[0]!.score).toBe(75);
  });
});
