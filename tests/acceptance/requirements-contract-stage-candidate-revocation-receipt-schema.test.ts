import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'4'.repeat(64)}`;
const SCHEMA_VERSION = 'requirements-contract-stage-candidate-revocation-receipt/v1';
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-stage-candidate-revocation-receipt.schema.json'
);

function receipt() {
  return {
    schemaVersion: SCHEMA_VERSION,
    candidateReceipt: {
      path: 'audit/pre-candidate/cmd34/candidate.receipt.json',
      hash: HASH,
    },
    auditAttemptId: 'AUDIT-01',
    passAuthority: false,
    reason: 'mandatory_pre_candidate_revocation',
    decision: 'revoked_candidate',
  };
}

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));
}

it('publishes the hard-cut candidate revocation schema identity', () => {
  const schema = existsSync(schemaPath)
    ? (JSON.parse(readFileSync(schemaPath, 'utf8')) as {
        $id?: string;
        properties?: { schemaVersion?: { const?: string } };
      })
    : undefined;

  expect({
    schemaExists: existsSync(schemaPath),
    schemaId: schema?.$id,
    schemaVersionConst: schema?.properties?.schemaVersion?.const,
  }).toEqual({
    schemaExists: true,
    schemaId: SCHEMA_VERSION,
    schemaVersionConst: SCHEMA_VERSION,
  });
});

describe.runIf(existsSync(schemaPath))(SCHEMA_VERSION, () => {
  it('accepts the unchanged candidate revocation receipt semantics', () => {
    const validate = validator();

    expect(validate(receipt()), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects a receipt that changes the governed revocation decision', () => {
    const validate = validator();
    const invalid = receipt();
    invalid.decision = 'pass';

    expect(validate(invalid)).toBe(false);
  });
});
