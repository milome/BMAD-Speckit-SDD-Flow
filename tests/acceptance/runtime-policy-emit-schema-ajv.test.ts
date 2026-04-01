import * as fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { resolveRuntimePolicy } from '../../scripts/runtime-governance';
import { stableStringifyPolicy } from '../../scripts/stable-runtime-policy-json';

const repoRoot = process.cwd();

describe('runtime-policy-emit.schema.json (AJV)', () => {
  it('validates success policy JSON from resolveRuntimePolicy', () => {
    const raw = fs.readFileSync(
      path.join(repoRoot, 'docs/reference/runtime-policy-emit.schema.json'),
      'utf8'
    );
    const schema = JSON.parse(raw) as object;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const policy = resolveRuntimePolicy({ flow: 'story', stage: 'specify' });
    const obj = JSON.parse(stableStringifyPolicy(policy)) as object;
    const ok = validate(obj);
    expect(validate.errors).toBeFalsy();
    expect(ok).toBe(true);
  });
});
