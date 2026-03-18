import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import type { RunScoreRecord } from './types';
import { resolveSchemaDir } from '../constants/path';

let validateFn: ReturnType<Ajv['compile']>;

function getValidate() {
  if (validateFn) return validateFn;
  const schemaDir = resolveSchemaDir();
  const schemaPath = path.join(schemaDir, 'run-score-schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const ajv = new Ajv();
  addFormats(ajv);
  validateFn = ajv.compile(schema);
  return validateFn;
}

/**
 * Validate record against run-score-schema. Throws if invalid.
 * @param {unknown} record - Unknown value to validate
 * @throws {Error} If validation fails
 * @returns {void}
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
 * Validate scenario constraints (Story 4.3 spec §2.1).
 * scenario must be real_dev | eval_question; when eval_question, question_version required.
 * @param {RunScoreRecord} record - RunScoreRecord to validate
 * @throws {Error} If constraints violated
 * @returns {void}
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
