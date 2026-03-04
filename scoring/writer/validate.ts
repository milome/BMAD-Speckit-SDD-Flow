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
