import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

describe('schema', () => {
  const schemaPath = path.resolve(__dirname, '../schema/run-score-schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const ajv = new Ajv();
  addFormats(ajv);
  const validate = ajv.compile(schema);

  it('AC-2.1: 合法数据验证通过', () => {
    const valid = {
      run_id: 'x',
      scenario: 'real_dev',
      stage: 'implement',
      phase_score: 22,
      phase_weight: 0.25,
      check_items: [{ item_id: 'a', passed: true, score_delta: 0 }],
      timestamp: '2026-03-04T12:00:00.000Z',
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
    };
    expect(validate(valid)).toBe(true);
  });

  it('AC-2.2: scenario 枚举 real_dev | eval_question', () => {
    const invalid = {
      run_id: 'x',
      scenario: 'invalid',
      stage: 'implement',
      phase_score: 22,
      phase_weight: 0.25,
      check_items: [],
      timestamp: '2026-03-04T12:00:00.000Z',
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
    };
    expect(validate(invalid)).toBe(false);
  });

  it('AC-2.3: stage 枚举完整', () => {
    const invalid = {
      run_id: 'x',
      scenario: 'real_dev',
      stage: 'invalid_stage',
      phase_score: 22,
      phase_weight: 0.25,
      check_items: [],
      timestamp: '2026-03-04T12:00:00.000Z',
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
    };
    expect(validate(invalid)).toBe(false);
  });

  it('AC-2.4: check_items 含 item_id、passed、score_delta、note', () => {
    const valid = {
      run_id: 'x',
      scenario: 'real_dev',
      stage: 'implement',
      phase_score: 22,
      phase_weight: 0.25,
      check_items: [
        { item_id: 'a', passed: true, score_delta: -2, note: 'ok' },
      ],
      timestamp: '2026-03-04T12:00:00.000Z',
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
    };
    expect(validate(valid)).toBe(true);
  });
});
