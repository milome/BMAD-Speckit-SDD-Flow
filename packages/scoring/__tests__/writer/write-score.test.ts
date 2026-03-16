import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  writeScoreRecordSync,
  writeSingleFile,
  appendJsonl,
  ensureDataDir,
  type RunScoreRecord,
} from '../../writer';

const validRecord: RunScoreRecord = {
  run_id: 'test-run-1',
  scenario: 'real_dev',
  stage: 'implement',
  phase_score: 22,
  phase_weight: 0.25,
  check_items: [
    { item_id: 'func_correct', passed: true, score_delta: 0, note: '' },
  ],
  timestamp: '2026-03-04T12:00:00.000Z',
  iteration_count: 0,
  iteration_records: [],
  first_pass: true,
};

describe('writer (sync)', () => {
  let testDataPath: string;
  const origEnv = process.env.SCORING_DATA_PATH;

  beforeEach(() => {
    testDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'scoring-writer-'));
    process.env.SCORING_DATA_PATH = testDataPath;
  });

  afterEach(() => {
    process.env.SCORING_DATA_PATH = origEnv;
    try {
      fs.rmSync(testDataPath, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('ensureDataDir', () => {
    it('创建目录并存在', () => {
      ensureDataDir(testDataPath);
      expect(fs.existsSync(testDataPath)).toBe(true);
      expect(fs.statSync(testDataPath).isDirectory()).toBe(true);
    });
  });

  describe('writeSingleFile', () => {
    it('写入单文件 {run_id}.json，内容为 record JSON', () => {
      writeSingleFile(validRecord, testDataPath);
      const filePath = path.join(testDataPath, 'test-run-1.json');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.run_id).toBe(validRecord.run_id);
      expect(content.check_items).toEqual(validRecord.check_items);
    });

    it('同一 run_id 再次写入为覆盖', () => {
      writeSingleFile(validRecord, testDataPath);
      const updated = { ...validRecord, phase_score: 99 };
      writeSingleFile(updated, testDataPath);
      const filePath = path.join(testDataPath, 'test-run-1.json');
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.phase_score).toBe(99);
    });
  });

  describe('appendJsonl', () => {
    it('追加一行 JSON，多次调用行数递增', () => {
      appendJsonl(validRecord, testDataPath);
      const jsonlPath = path.join(testDataPath, 'scores.jsonl');
      let lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n');
      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0]).run_id).toBe(validRecord.run_id);

      const record2 = { ...validRecord, run_id: 'test-run-2' };
      appendJsonl(record2, testDataPath);
      lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n');
      expect(lines.length).toBe(2);
      expect(JSON.parse(lines[1]).run_id).toBe('test-run-2');
    });

    it('每行可独立解析为合法 JSON', () => {
      appendJsonl(validRecord, testDataPath);
      appendJsonl({ ...validRecord, run_id: 'r2' }, testDataPath);
      const jsonlPath = path.join(testDataPath, 'scores.jsonl');
      const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n');
      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });
  });

  describe('writeScoreRecordSync', () => {
    it('mode single_file 仅写单文件，不写 jsonl', () => {
      writeScoreRecordSync(validRecord, 'single_file');
      expect(fs.existsSync(path.join(testDataPath, 'test-run-1.json'))).toBe(true);
      expect(fs.existsSync(path.join(testDataPath, 'scores.jsonl'))).toBe(false);
    });

    it('mode jsonl 仅追加 jsonl，不写单文件', () => {
      writeScoreRecordSync(validRecord, 'jsonl');
      expect(fs.existsSync(path.join(testDataPath, 'test-run-1.json'))).toBe(false);
      expect(fs.existsSync(path.join(testDataPath, 'scores.jsonl'))).toBe(true);
    });

    it('mode both 同时写单文件和 jsonl', () => {
      writeScoreRecordSync(validRecord, 'both');
      expect(fs.existsSync(path.join(testDataPath, 'test-run-1.json'))).toBe(true);
      expect(fs.existsSync(path.join(testDataPath, 'scores.jsonl'))).toBe(true);
      const single = JSON.parse(fs.readFileSync(path.join(testDataPath, 'test-run-1.json'), 'utf-8'));
      const lines = fs.readFileSync(path.join(testDataPath, 'scores.jsonl'), 'utf-8').trim().split('\n');
      expect(single.run_id).toBe(validRecord.run_id);
      expect(JSON.parse(lines[0]).run_id).toBe(validRecord.run_id);
    });

    it('非法 record 拒写并抛错', () => {
      const invalid = { run_id: 'x', scenario: 'invalid_enum' } as unknown;
      expect(() => writeScoreRecordSync(invalid, 'single_file')).toThrow(/validation failed/i);
      expect(fs.existsSync(path.join(testDataPath, 'x.json'))).toBe(false);
    });
  });

  describe('check_items 结构', () => {
    it('check_items 含 item_id、passed、score_delta、note 原样写入', () => {
      const withNote: RunScoreRecord = {
        ...validRecord,
        check_items: [
          { item_id: 'a', passed: false, score_delta: -2, note: 'some note' },
        ],
      };
      writeScoreRecordSync(withNote, 'single_file');
      const filePath = path.join(testDataPath, 'test-run-1.json');
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(Array.isArray(content.check_items)).toBe(true);
      expect(content.check_items[0]).toMatchObject({
        item_id: 'a',
        passed: false,
        score_delta: -2,
        note: 'some note',
      });
    });
  });
});
