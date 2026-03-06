import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadAndDedupeRecords, isRunScoreRecord, EXCLUDED_JSON } from '../loader';
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

describe('loader', () => {
  describe('EXCLUDED_JSON', () => {
    it('excludes sft-dataset.json', () => {
      expect(EXCLUDED_JSON).toContain('sft-dataset.json');
    });
  });

  describe('isRunScoreRecord', () => {
    it('returns true for valid RunScoreRecord', () => {
      const r = makeRecord('run-1', 'prd');
      expect(isRunScoreRecord(r)).toBe(true);
    });
    it('returns false for null', () => expect(isRunScoreRecord(null)).toBe(false));
    it('returns false for non-object', () => expect(isRunScoreRecord('string')).toBe(false));
    it('returns false when run_id missing', () => {
      const r = { ...makeRecord('x', 'prd'), run_id: '' };
      expect(isRunScoreRecord(r)).toBe(false);
    });
    it('returns false when scenario invalid', () => {
      const r = { ...makeRecord('x', 'prd'), scenario: 'invalid' };
      expect(isRunScoreRecord(r)).toBe(false);
    });
  });

  describe('loadAndDedupeRecords', () => {
    it('returns [] for empty directory', () => {
      const dataPath = path.join(os.tmpdir(), `loader-empty-${Date.now()}`);
      fs.mkdirSync(dataPath, { recursive: true });
      const result = loadAndDedupeRecords(dataPath);
      expect(result).toEqual([]);
      fs.rmSync(dataPath, { recursive: true, force: true });
    });

    it('returns [] when directory does not exist', () => {
      const dataPath = path.join(os.tmpdir(), `loader-nonexist-${Date.now()}`);
      const result = loadAndDedupeRecords(dataPath);
      expect(result).toEqual([]);
    });

    it('loads records from single json file', () => {
      const runId = `loader-single-${Date.now()}`;
      const dataPath = path.join(os.tmpdir(), `loader-single-${Date.now()}`);
      fs.mkdirSync(dataPath, { recursive: true });
      const rec = makeRecord(runId, 'prd', '2026-01-01T00:00:00.000Z');
      fs.writeFileSync(path.join(dataPath, `${runId}.json`), JSON.stringify(rec, null, 2), 'utf-8');

      const result = loadAndDedupeRecords(dataPath);
      expect(result).toHaveLength(1);
      expect(result[0]!.run_id).toBe(runId);
      expect(result[0]!.stage).toBe('prd');

      fs.rmSync(dataPath, { recursive: true, force: true });
    });

    it('loads records from scores.jsonl', () => {
      const runId = `loader-jsonl-${Date.now()}`;
      const dataPath = path.join(os.tmpdir(), `loader-jsonl-${Date.now()}`);
      fs.mkdirSync(dataPath, { recursive: true });
      const rec = makeRecord(runId, 'arch', '2026-01-02T00:00:00.000Z');
      fs.writeFileSync(path.join(dataPath, 'scores.jsonl'), JSON.stringify(rec) + '\n', 'utf-8');

      const result = loadAndDedupeRecords(dataPath);
      expect(result).toHaveLength(1);
      expect(result[0]!.run_id).toBe(runId);

      fs.rmSync(dataPath, { recursive: true, force: true });
    });

    it('dedupes by run_id+stage keeping latest timestamp', () => {
      const runId = `loader-dedup-${Date.now()}`;
      const dataPath = path.join(os.tmpdir(), `loader-dedup-${Date.now()}`);
      fs.mkdirSync(dataPath, { recursive: true });
      const older = makeRecord(runId, 'prd', '2026-01-01T00:00:00.000Z');
      const newer = makeRecord(runId, 'prd', '2026-01-02T00:00:00.000Z');
      const lines = [JSON.stringify(older), JSON.stringify(newer)].join('\n');
      fs.writeFileSync(path.join(dataPath, 'scores.jsonl'), lines + '\n', 'utf-8');

      const result = loadAndDedupeRecords(dataPath);
      expect(result).toHaveLength(1);
      expect(result[0]!.timestamp).toBe('2026-01-02T00:00:00.000Z');

      fs.rmSync(dataPath, { recursive: true, force: true });
    });

    it('keeps distinct run_id+stage pairs', () => {
      const runId = `loader-distinct-${Date.now()}`;
      const dataPath = path.join(os.tmpdir(), `loader-distinct-${Date.now()}`);
      fs.mkdirSync(dataPath, { recursive: true });
      const r1 = makeRecord(runId, 'prd', '2026-01-01T00:00:00.000Z');
      const r2 = makeRecord(runId, 'arch', '2026-01-02T00:00:00.000Z');
      const lines = [JSON.stringify(r1), JSON.stringify(r2)].join('\n');
      fs.writeFileSync(path.join(dataPath, 'scores.jsonl'), lines + '\n', 'utf-8');

      const result = loadAndDedupeRecords(dataPath);
      expect(result).toHaveLength(2);

      fs.rmSync(dataPath, { recursive: true, force: true });
    });

    it('excludes sft-dataset.json', () => {
      const runId = `loader-exclude-${Date.now()}`;
      const dataPath = path.join(os.tmpdir(), `loader-exclude-${Date.now()}`);
      fs.mkdirSync(dataPath, { recursive: true });
      fs.writeFileSync(path.join(dataPath, 'sft-dataset.json'), '[]', 'utf-8');
      const rec = makeRecord(runId, 'prd');
      fs.writeFileSync(path.join(dataPath, `${runId}.json`), JSON.stringify(rec), 'utf-8');

      const result = loadAndDedupeRecords(dataPath);
      expect(result).toHaveLength(1);
      expect(result[0]!.run_id).toBe(runId);

      fs.rmSync(dataPath, { recursive: true, force: true });
    });
  });
});
