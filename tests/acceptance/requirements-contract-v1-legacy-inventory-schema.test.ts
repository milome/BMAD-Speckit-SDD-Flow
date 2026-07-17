import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'3'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-v1-legacy-inventory.schema.json'
);

function inventory() {
  return {
    schemaVersion: 'requirements-contract-v1-legacy-inventory/v1',
    cutoverId: 'V2-CUTOVER-001',
    cutoverPredecessorArtifact12Hash: HASH,
    g00BaselineHash: HASH,
    frozen: true,
    rows: [
      {
        sourcePath: 'docs/requirements/legacy-order.md',
        sourceHash: HASH,
        v1ParserFormatProofHash: HASH,
        requirementSetId: 'legacy-order',
        cutoverId: 'V2-CUTOVER-001',
        cutoverPredecessorArtifact12Hash: HASH,
        baselineInventoryProof: {
          path: 'docs/plans/evidence/loop-engineering-remediation/G00-baseline-fixture.json',
          hash: HASH,
        },
        legacyReadEligibility: 'eligible',
      },
    ],
  };
}

function freezeReceipt() {
  return {
    inventoryHash: HASH,
    inventorySchemaHash: HASH,
    writerHash: HASH,
    cutoverId: 'V2-CUTOVER-001',
    predecessorHash: HASH,
    g00BaselineHash: HASH,
    rowCount: 1,
    freezeTransactionId: 'FREEZE-TX-001',
  };
}

function schemaDocument() {
  return JSON.parse(readFileSync(schemaPath, 'utf8')) as {
    $defs: {
      freezeReceipt: object;
    };
  };
}

it('publishes the frozen V1 legacy inventory schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))('requirements-contract-v1-legacy-inventory/v1', () => {
  it('accepts only explicitly frozen pre-cutover legacy rows', () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schemaDocument());

    expect(validate(inventory()), JSON.stringify(validate.errors)).toBe(true);
  });

  it('validates the separate immutable freeze receipt definition', () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      schemaDocument().$defs.freezeReceipt
    );

    expect(validate(freezeReceipt()), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects forged rows, invalid hashes, and post-freeze authority fields', () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schemaDocument());
    const forged = inventory();
    forged.rows[0].legacyReadEligibility = 'discovered_at_runtime' as never;
    const invalidHash = inventory();
    invalidHash.rows[0].v1ParserFormatProofHash = 'sha256:short';
    const postFreeze = {
      ...inventory(),
      allowPostFreezeRows: true,
    };

    expect(validate(forged)).toBe(false);
    expect(validate(invalidHash)).toBe(false);
    expect(validate(postFreeze)).toBe(false);
  });

  it('rejects incomplete or self-hashed freeze receipts', () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      schemaDocument().$defs.freezeReceipt
    );
    const incomplete = freezeReceipt() as Record<string, unknown>;
    delete incomplete.writerHash;
    const selfHashed = {
      ...freezeReceipt(),
      freezeReceiptHash: HASH,
    };

    expect(validate(incomplete)).toBe(false);
    expect(validate(selfHashed)).toBe(false);
  });
});
