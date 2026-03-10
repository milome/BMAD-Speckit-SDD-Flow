import { describe, it, expect } from 'vitest';
import { parseEpicStoryFromRecord } from '../parse-epic-story';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(runId: string, sourcePath?: string): RunScoreRecord {
  return {
    run_id: runId,
    scenario: 'real_dev',
    stage: 'prd',
    phase_score: 80,
    phase_weight: 0.2,
    check_items: [{ item_id: 'test', passed: true, score_delta: 0 }],
    timestamp: '2026-01-01T00:00:00.000Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...(sourcePath && { source_path: sourcePath }),
  };
}

describe('parseEpicStoryFromRecord', () => {
  describe('run_id regex', () => {
    it('parses -e4-s2- format', () => {
      const r = makeRecord('dev-e4-s2-story-1730812345');
      const result = parseEpicStoryFromRecord(r);
      expect(result).toEqual({ epicId: 4, storyId: 2 });
    });
    it('parses -e5-s5$ format (end of string)', () => {
      const r = makeRecord('dev-e5-s5-1730812345');
      const result = parseEpicStoryFromRecord(r);
      expect(result).toEqual({ epicId: 5, storyId: 5 });
    });
    it('returns null when run_id has no match', () => {
      const r = makeRecord('cli-1730812345');
      const result = parseEpicStoryFromRecord(r);
      expect(result).toBeNull();
    });
  });

  describe('source_path fallback (story first, epic second)', () => {
    it('parses story-4-2- format (story priority)', () => {
      const r = makeRecord('cli-123', 'story-4-2-eval-ai-coach');
      const result = parseEpicStoryFromRecord(r);
      expect(result).toEqual({ epicId: 4, storyId: 2 });
    });
    it('parses epic-5-*/story-5- format (epic second)', () => {
      const r = makeRecord('cli-123', 'epic-5-feature-eval/story-5-eval-analytics-advanced');
      const result = parseEpicStoryFromRecord(r);
      expect(result).toEqual({ epicId: 5, storyId: 5 });
    });
    it('returns null when no source_path', () => {
      const r = makeRecord('cli-123');
      const result = parseEpicStoryFromRecord(r);
      expect(result).toBeNull();
    });
    it('returns null when source_path has no match', () => {
      const r = makeRecord('cli-123', 'some/other/path');
      const result = parseEpicStoryFromRecord(r);
      expect(result).toBeNull();
    });
  });

  describe('run_id takes priority over source_path', () => {
    it('uses run_id when both match', () => {
      const r = makeRecord('dev-e3-s1-ts', 'story-4-2-other');
      const result = parseEpicStoryFromRecord(r);
      expect(result).toEqual({ epicId: 3, storyId: 1 });
    });
  });
});
