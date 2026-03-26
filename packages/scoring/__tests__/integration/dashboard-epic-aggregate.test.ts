/**
 * Story 9.3 US-4.2: Epic 聚合集成测试（五场景）
 */
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { loadAndDedupeRecords } from '../../query/loader';
import { parseEpicStoryFromRecord } from '../../query';
import {
  getEpicAggregateRecords,
  getLatestRunRecordsV2,
  computeEpicHealthScore,
  getEpicDimensionScores,
  aggregateByEpicOnly,
} from '../../dashboard';
import { execSync } from 'child_process';

const FIXTURE_AGGREGATE = path.join(
  process.cwd(),
  'packages',
  'scoring',
  'data',
  '__fixtures-epic-aggregate'
);
const FIXTURE_NO_COMPLETE = path.join(
  process.cwd(),
  'packages',
  'scoring',
  'data',
  '__fixtures-epic-no-complete'
);

describe('Epic 聚合集成 (US-4.2)', () => {
  beforeAll(() => {
    vi.useFakeTimers({ now: new Date('2026-03-06T14:00:00Z') });
  });
  afterAll(() => {
    vi.useRealTimers();
  });
  it('(1) --epic 9 时总分、四维与预期一致', () => {
    const records = loadAndDedupeRecords(FIXTURE_AGGREGATE).filter(
      (r) => r.scenario !== 'eval_question'
    );
    const epicRecords = getEpicAggregateRecords(records, 9, 168);
    expect(epicRecords).toHaveLength(6);
    const score = computeEpicHealthScore(epicRecords);
    expect(score).toBe(85);
    const dims = getEpicDimensionScores(epicRecords);
    expect(dims.find((d) => d.dimension === 'A')?.score).toBe(90);
    expect(dims.find((d) => d.dimension === 'B')?.score).toBe(70);
  });

  it('(2) 部分 Story 不完整时排除且 excludedStories 含 E9.S3', () => {
    const records = loadAndDedupeRecords(FIXTURE_AGGREGATE).filter(
      (r) => r.scenario !== 'eval_question'
    );
    const result = getEpicAggregateRecords(records, 9, 168);
    const candidates = aggregateByEpicOnly(records, 9, 168);
    const inResult = new Set(
      result
        .map((r) => {
          const p = parseEpicStoryFromRecord(r);
          return p ? `E${p.epicId}.S${p.storyId}` : null;
        })
        .filter((x): x is string => x != null)
    );
    const excludedStories: string[] = [];
    const seen = new Set<string>();
    for (const r of candidates) {
      const p = parseEpicStoryFromRecord(r);
      if (p) {
        const key = `E${p.epicId}.S${p.storyId}`;
        if (!inResult.has(key) && !seen.has(key)) {
          seen.add(key);
          excludedStories.push(key);
        }
      }
    }
    expect(excludedStories).toContain('E9.S3');
    expect(result.every((r) => !r.run_id.includes('-e9-s3-'))).toBe(true);
  });

  it('(3) strategy=run_id 时 epic 忽略', () => {
    const records = loadAndDedupeRecords(FIXTURE_AGGREGATE).filter(
      (r) => r.scenario !== 'eval_question'
    );
    const withEpic = getLatestRunRecordsV2(records, { strategy: 'run_id', epic: 9 });
    const withoutEpic = getLatestRunRecordsV2(records, { strategy: 'run_id' });
    expect(withEpic).toEqual(withoutEpic);
  });

  it('(4) Epic 下无完整 Story 时 getEpicAggregateRecords 返回空', () => {
    const records = loadAndDedupeRecords(FIXTURE_NO_COMPLETE).filter(
      (r) => r.scenario !== 'eval_question'
    );
    const result = getEpicAggregateRecords(records, 9, 168);
    expect(result).toHaveLength(0);
  });

  it('(5) CLI 无完整 Story 时输出含「Epic N 下无完整 Story」', { timeout: 45000 }, () => {
    const outPath = path.join(os.tmpdir(), `dashboard-us42-no-complete-${Date.now()}.md`);
    execSync(
      `npx ts-node scripts/dashboard-generate.ts --dataPath "${FIXTURE_NO_COMPLETE}" --epic 9 --strategy epic_story_window --windowHours 999999 --output "${outPath}"`,
      { cwd: process.cwd(), encoding: 'utf-8' }
    );
    const content = fs.readFileSync(outPath, 'utf-8');
    expect(content).toMatch(/Epic 9 下无完整 Story|暂无聚合数据/);
    try {
      fs.unlinkSync(outPath);
    } catch {
      // ignore
    }
  });

  it('(6) CLI epic 聚合输出含 Epic 9 聚合视图', { timeout: 45000 }, () => {
    const outPath = path.join(os.tmpdir(), `dashboard-us42-aggregate-${Date.now()}.md`);
    execSync(
      `npx ts-node scripts/dashboard-generate.ts --dataPath "${FIXTURE_AGGREGATE}" --epic 9 --strategy epic_story_window --windowHours 999999 --output "${outPath}"`,
      { cwd: process.cwd(), encoding: 'utf-8' }
    );
    const content = fs.readFileSync(outPath, 'utf-8');
    expect(content).toMatch(/Epic 9|Epic 9 聚合/);
    expect(content).toMatch(/已排除/);
    try {
      fs.unlinkSync(outPath);
    } catch {
      // ignore
    }
  });

  it('(7) 单 Story --epic 9 --story 1 行为与 epic+story 一致', () => {
    const records = loadAndDedupeRecords(FIXTURE_AGGREGATE).filter(
      (r) => r.scenario !== 'eval_question'
    );
    const singleStory = getLatestRunRecordsV2(records, {
      strategy: 'epic_story_window',
      epic: 9,
      story: 1,
      windowHours: 168,
    });
    expect(singleStory).toHaveLength(3);
    expect(singleStory.every((r) => r.run_id.includes('-e9-s1-'))).toBe(true);
  });
});
