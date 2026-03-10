import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import type { RunScoreRecord } from './types';

let validateFn: ReturnType<Ajv['compile']>;

function getValidate() {
  if (validateFn) return validateFn;
  const schemaPath = path.resolve(process.cwd(), 'scoring', 'schema', 'run-score-schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const ajv = new Ajv();
  addFormats(ajv);
  validateFn = ajv.compile(schema);
  return validateFn;
}

/**
 * 校验 record 是否符合 run-score-schema；不符合则抛出错误。
 */
export function validateRunScoreRecord(record: unknown): asserts record is RunScoreRecord {
  const validate = getValidate();
  const ok = validate(record);
  if (!ok) {
    const err = validate.errors;
    throw new Error(`RunScoreRecord validation failed: ${JSON.stringify(err)}`);
  }
}

/**
 * 校验 record 符合场景约束（Story 4.3 spec §2.1）。
 * - scenario 必为 real_dev | eval_question
 * - scenario=eval_question 时 question_version 必填（非空字符串）
 */
export function validateScenarioConstraints(record: RunScoreRecord): void {
  if (record.scenario !== 'real_dev' && record.scenario !== 'eval_question') {
    throw new Error(`validateScenarioConstraints: scenario must be real_dev or eval_question, got ${record.scenario}`);
  }
  if (record.scenario === 'eval_question') {
    const qv = record.question_version;
    if (qv == null || (typeof qv === 'string' && qv.trim() === '')) {
      throw new Error('validateScenarioConstraints: question_version 必填 when scenario=eval_question');
    }
  }
}
