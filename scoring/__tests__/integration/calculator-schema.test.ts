import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import { computeCompositeScore, scoreToLevel } from '../../core/calculator';

describe('integration: calculator-schema', () => {
  it('schema 验证后传入 calculator 可正确计算', () => {
    const schemaPath = path.resolve(__dirname, '../../schema/run-score-schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    const ajv = new Ajv();
    addFormats(ajv);
    const validate = ajv.compile(schema);

    const phaseScores = [18, 22, 20, 12, 8, 4];
    const record = {
      run_id: 'x',
      scenario: 'real_dev',
      stage: 'implement',
      phase_score: phaseScores[1],
      phase_weight: 0.25,
      check_items: [],
      timestamp: '2026-03-04T12:00:00.000Z',
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
    };
    expect(validate(record)).toBe(true);

    const score = computeCompositeScore(phaseScores);
    const level = scoreToLevel(score);
    expect(score).toBeCloseTo(84, 1);
    expect(level).toBe('L4');
  });
});
