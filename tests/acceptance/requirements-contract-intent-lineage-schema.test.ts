import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'b'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-intent-lineage-ledger.schema.json'
);

function classification(
  spanId: string,
  disposition: 'source_root' | 'duplicate' | 'superseded' | 'rejected' | 'excluded',
  details: Record<string, unknown>
) {
  return {
    spanId,
    sourceHash: HASH,
    disposition,
    classificationRule: `lineage-rule/${disposition}/v1`,
    classificationHash: HASH,
    ...details,
  };
}

function ledger() {
  return {
    schemaVersion: 'requirements-contract-intent-lineage-ledger/v1',
    requirementSetId: 'checkout-reliability',
    intakeReceiptPath:
      '_bmad-output/runtime/requirement-records/checkout-reliability/authoring/intake/intake-receipt.json',
    intakeReceiptHash: HASH,
    materialSpanIds: ['span-001', 'span-002', 'span-003', 'span-004', 'span-005'],
    classifications: [
      classification('span-001', 'source_root', {
        sourceRootRefs: ['MUST-CHECKOUT-001', 'ACC-CHECKOUT-001'],
      }),
      classification('span-002', 'duplicate', {
        duplicateOfSourceRootRef: 'MUST-CHECKOUT-001',
        decisionHash: HASH,
      }),
      classification('span-003', 'superseded', {
        supersededBySpanId: 'span-004',
        decisionHash: HASH,
      }),
      classification('span-004', 'rejected', {
        decisionReceiptRef: 'DEC-CHECKOUT-001',
        decisionHash: HASH,
      }),
      classification('span-005', 'excluded', {
        exclusionRuleRef: 'non-requirement-conversation/v1',
        exclusionReason: 'tool transport metadata',
        decisionHash: HASH,
      }),
    ],
    classificationSetHash: HASH,
    ledgerHash: HASH,
  };
}

function validator() {
  return new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(readFileSync(schemaPath, 'utf8'))
  );
}

it('publishes the inactive Intent Lineage Ledger schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))('requirements-contract-intent-lineage-ledger/v1', () => {
  it('accepts all five mutually exclusive material-span dispositions', () => {
    const validate = validator();

    expect(validate(ledger()), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects mixed disposition facts', () => {
    const validate = validator();
    const mixedDuplicate = ledger();
    (mixedDuplicate.classifications as Array<Record<string, unknown>>)[1] = {
      ...mixedDuplicate.classifications[1],
      sourceRootRefs: ['MUST-CHECKOUT-001'],
    };
    const mixedRejected = ledger();
    (mixedRejected.classifications as Array<Record<string, unknown>>)[3] = {
      ...mixedRejected.classifications[3],
      exclusionReason: 'not applicable',
    };

    expect(validate(mixedDuplicate)).toBe(false);
    expect(validate(mixedRejected)).toBe(false);
  });

  it('rejects missing related refs or decision hashes', () => {
    const validate = validator();
    const duplicateWithoutRoot = ledger() as Record<string, unknown>;
    delete (duplicateWithoutRoot.classifications as Array<Record<string, unknown>>)[1]
      .duplicateOfSourceRootRef;
    const excludedWithoutDecision = ledger() as Record<string, unknown>;
    delete (excludedWithoutDecision.classifications as Array<Record<string, unknown>>)[4]
      .decisionHash;

    expect(validate(duplicateWithoutRoot)).toBe(false);
    expect(validate(excludedWithoutDecision)).toBe(false);
  });

  it('rejects unknown dispositions, duplicate material IDs, and malformed hashes', () => {
    const validate = validator();
    const unknownDisposition = ledger();
    unknownDisposition.classifications[0].disposition = 'ignored' as never;
    const duplicateMaterialIds = ledger();
    duplicateMaterialIds.materialSpanIds[4] = 'span-001';
    const malformedHash = ledger();
    malformedHash.classifications[0].classificationHash = 'sha256:short';

    expect(validate(unknownDisposition)).toBe(false);
    expect(validate(duplicateMaterialIds)).toBe(false);
    expect(validate(malformedHash)).toBe(false);
  });

  it('rejects undeclared ledger and classification properties', () => {
    const validate = validator();
    const extraLedger = { ...ledger(), allMaterialSpansClassified: true };
    const extraClassification = ledger();
    (extraClassification.classifications as Array<Record<string, unknown>>)[0] = {
      ...extraClassification.classifications[0],
      modelConfidence: 1,
    };

    expect(validate(extraLedger)).toBe(false);
    expect(validate(extraClassification)).toBe(false);
  });
});
