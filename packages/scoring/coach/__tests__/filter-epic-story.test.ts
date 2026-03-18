import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseEpicStoryFromRecord, filterByEpicStory } from '../filter-epic-story';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(
  runId: string,
  stage: string,
  opts?: { scenario?: 'real_dev' | 'eval_question'; source_path?: string; timestamp?: string }
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
    ...(opts?.source_path != null ? { source_path: opts.source_path } : {}),
  };
}

describe('parseEpicStoryFromRecord', () => {
  it('parses run_id with -e(N)-s(M)- pattern', () => {
    const r = makeRecord('dev-e4-s2-story-1730812345', 'implement');
    const parsed = parseEpicStoryFromRecord(r);
    expect(parsed).toEqual({ epicId: 4, storyId: 2 });
  });

  it('parses run_id with -e(N)-s(M) at end', () => {
    const r = makeRecord('dev-e5-s5-1730812345', 'implement');
    const parsed = parseEpicStoryFromRecord(r);
    expect(parsed).toEqual({ epicId: 5, storyId: 5 });
  });

  it('parses source_path epic-{epic}-*/story-{story}-*', () => {
    const r = makeRecord('cli-1730812345', 'implement', {
      source_path: 'epic-5-feature-x/story-4-eval-analytics-advanced',
    });
    const parsed = parseEpicStoryFromRecord(r);
    expect(parsed).toEqual({ epicId: 5, storyId: 4 });
  });

  it('parses source_path story-{epic}-{story}-*', () => {
    const r = makeRecord('cli-1730812345', 'implement', {
      source_path: 'story-3-4-eval-ai-coach',
    });
    const parsed = parseEpicStoryFromRecord(r);
    expect(parsed).toEqual({ epicId: 3, storyId: 4 });
  });

  it('returns null when neither run_id nor source_path match', () => {
    const r = makeRecord('cli-1730812345', 'implement');
    const parsed = parseEpicStoryFromRecord(r);
    expect(parsed).toBeNull();
  });

  it('returns null when source_path has no match', () => {
    const r = makeRecord('cli-1730812345', 'implement', { source_path: 'random-path/foo' });
    const parsed = parseEpicStoryFromRecord(r);
    expect(parsed).toBeNull();
  });
});

describe('filterByEpicStory', () => {
  it('returns error when directory is empty', () => {
    const dataPath = path.join(os.tmpdir(), `filter-empty-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });

    const result = filterByEpicStory(dataPath, { epicId: 3 });
    expect('error' in result).toBe(true);
    expect((result as { error: string }).error).toBe('暂无评分数据，请先完成至少一轮 Dev Story');

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('returns error when no records are parsable', () => {
    const dataPath = path.join(os.tmpdir(), `filter-noparse-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(
      path.join(dataPath, 'run.json'),
      JSON.stringify(makeRecord('cli-1730812345', 'implement'), null, 2),
      'utf-8'
    );

    const result = filterByEpicStory(dataPath, { epicId: 3 });
    expect('error' in result).toBe(true);
    expect((result as { error: string }).error).toContain('无可解析 Epic/Story');

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('returns error when filter has no match', () => {
    const dataPath = path.join(os.tmpdir(), `filter-nomatch-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(
      path.join(dataPath, 'run.json'),
      JSON.stringify(makeRecord('dev-e4-s2-story-1730812345', 'implement'), null, 2),
      'utf-8'
    );

    const result = filterByEpicStory(dataPath, { epicId: 99 });
    expect('error' in result).toBe(true);
    expect((result as { error: string }).error).toBe('无可筛选数据');

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('filters by epicId and returns records + runId', () => {
    const runId = `dev-e3-s1-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `filter-epic-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const rec = makeRecord(runId, 'implement', { timestamp: '2026-01-02T00:00:00.000Z' });
    fs.writeFileSync(path.join(dataPath, `${runId}.json`), JSON.stringify(rec), 'utf-8');

    const result = filterByEpicStory(dataPath, { epicId: 3 });
    expect('records' in result).toBe(true);
    const r = result as { records: RunScoreRecord[]; runId: string };
    expect(r.records.length).toBeGreaterThan(0);
    expect(r.runId).toBe(runId);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('filters by epicId and storyId (--story X.Y)', () => {
    const runId = `dev-e3-s3-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `filter-story-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const rec = makeRecord(runId, 'implement');
    fs.writeFileSync(path.join(dataPath, `${runId}.json`), JSON.stringify(rec), 'utf-8');

    const result = filterByEpicStory(dataPath, { epicId: 3, storyId: 3 });
    expect('records' in result).toBe(true);
    const r = result as { records: RunScoreRecord[]; runId: string };
    expect(r.records.length).toBeGreaterThan(0);
    expect(r.runId).toBe(runId);

    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it('excludes scenario=eval_question records', () => {
    const runId = `eval-q001-${Date.now()}`;
    const dataPath = path.join(os.tmpdir(), `filter-eval-${Date.now()}`);
    fs.mkdirSync(dataPath, { recursive: true });
    const rec = makeRecord(runId, 'implement', { scenario: 'eval_question' });
    fs.writeFileSync(path.join(dataPath, `${runId}.json`), JSON.stringify(rec), 'utf-8');

    const result = filterByEpicStory(dataPath, { epicId: 1 });
    expect('error' in result).toBe(true);
    expect((result as { error: string }).error).toContain('无可解析');

    fs.rmSync(dataPath, { recursive: true, force: true });
  });
});
