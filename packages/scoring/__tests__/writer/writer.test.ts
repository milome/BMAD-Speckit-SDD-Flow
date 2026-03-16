/**
 * Story 1.2 writer tests: single-file, JSONL, both, dir creation, same run_id overwrite, schema.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { writeScoreRecord, type RunScoreRecord } from '../../writer';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

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

describe('writeScoreRecord', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `writer-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('T1: single_file mode writes {run_id}.json and content matches', async () => {
    await writeScoreRecord(validRecord, 'single_file', { dataPath: tmpDir });
    const filePath = path.join(tmpDir, 'test-run-1.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content) as RunScoreRecord;
    expect(parsed.run_id).toBe(validRecord.run_id);
    expect(parsed.check_items).toEqual(validRecord.check_items);
  });

  it('T2: same run_id second write overwrites single file (AC-6)', async () => {
    await writeScoreRecord(validRecord, 'single_file', { dataPath: tmpDir });
    const updated = { ...validRecord, phase_score: 99 };
    await writeScoreRecord(updated, 'single_file', { dataPath: tmpDir });
    const filePath = path.join(tmpDir, 'test-run-1.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content) as RunScoreRecord;
    expect(parsed.phase_score).toBe(99);
  });

  it('T3: jsonl mode appends lines; line count increases', async () => {
    await writeScoreRecord(validRecord, 'jsonl', { dataPath: tmpDir });
    const r2 = { ...validRecord, run_id: 'test-run-2' };
    await writeScoreRecord(r2, 'jsonl', { dataPath: tmpDir });
    const filePath = path.join(tmpDir, 'scores.jsonl');
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).run_id).toBe('test-run-1');
    expect(JSON.parse(lines[1]).run_id).toBe('test-run-2');
  });

  it('T4: both mode updates single file and scores.jsonl', async () => {
    await writeScoreRecord(validRecord, 'both', { dataPath: tmpDir });
    const singlePath = path.join(tmpDir, 'test-run-1.json');
    const jsonlPath = path.join(tmpDir, 'scores.jsonl');
    const singleContent = await fs.readFile(singlePath, 'utf-8');
    const jsonlContent = await fs.readFile(jsonlPath, 'utf-8');
    expect(JSON.parse(singleContent).run_id).toBe('test-run-1');
    const lines = jsonlContent.trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(1);
    expect(JSON.parse(lines[0]).run_id).toBe('test-run-1');
  });

  it('T5: creates data dir when missing', async () => {
    const subDir = path.join(tmpDir, 'nested', 'data');
    await writeScoreRecord(validRecord, 'single_file', { dataPath: subDir });
    const filePath = path.join(subDir, 'test-run-1.json');
    const content = await fs.readFile(filePath, 'utf-8');
    expect(JSON.parse(content).run_id).toBe(validRecord.run_id);
  });

  it('AC-4: check_items structure item_id, passed, score_delta, note', async () => {
    const withNote: RunScoreRecord = {
      ...validRecord,
      check_items: [
        { item_id: 'a', passed: false, score_delta: -5, note: 'failed' },
      ],
    };
    await writeScoreRecord(withNote, 'single_file', { dataPath: tmpDir });
    const filePath = path.join(tmpDir, 'test-run-1.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed.check_items)).toBe(true);
    expect(parsed.check_items[0]).toMatchObject({
      item_id: 'a',
      passed: false,
      score_delta: -5,
      note: 'failed',
    });
  });

  it('AC-7: written file validates against run-score-schema', async () => {
    await writeScoreRecord(validRecord, 'single_file', { dataPath: tmpDir });
    const schemaPath = path.resolve(__dirname, '../../schema/run-score-schema.json');
    const schema = JSON.parse(await fs.readFile(schemaPath, 'utf-8'));
    const ajv = new Ajv();
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const filePath = path.join(tmpDir, 'test-run-1.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    expect(validate(data)).toBe(true);
  });

  it('throws on unknown mode', async () => {
    await expect(
      writeScoreRecord(validRecord, 'invalid' as any, { dataPath: tmpDir })
    ).rejects.toThrow(/Unknown WriteMode/);
  });
});
