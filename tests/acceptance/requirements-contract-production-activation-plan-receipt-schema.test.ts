import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'f'.repeat(64)}`;
const UUID_V7 = '018f3f2e-7b4c-7def-8abc-1234567890ab';
const activationAttemptId = `ACT-ATTEMPT-${UUID_V7}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-production-activation-plan.schema.json'
);

function activationPlan() {
  return {
    schemaVersion: 'requirements-contract-production-activation-plan/v1',
    requirementRecord: {
      path: '_bmad-output/runtime/requirement-records/order-flow/requirement-record.json',
      hash: HASH,
    },
    requirementSetId: 'order-flow',
    implementationAttemptId: 'IMPL-ATTEMPT-001',
    activationAttemptId,
    activationReceiptId: `ACT-RECEIPT-${UUID_V7}`,
    idGenerationScheme: 'uuidv7',
    registry: {
      path: '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json',
      preimageHash: HASH,
      targetArtifact12Hash: HASH,
    },
    plannedSnapshotPath: `_bmad-output/runtime/requirement-records/order-flow/activation/IMPL-ATTEMPT-001/${activationAttemptId}/candidate-snapshot/`,
    nestedCommands: [
      { commandId: 'CMD-09', argvHash: HASH, fixtureOnly: false },
      { commandId: 'CMD-11', argvHash: HASH, fixtureOnly: false },
      { commandId: 'CMD-13', argvHash: HASH, fixtureOnly: false },
      { commandId: 'CMD-18', argvHash: HASH, fixtureOnly: true },
    ],
    cliIdentityHash: HASH,
    schemaIdentityHash: HASH,
    expectedPromotionReceiptPath: `docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-plan-write-receipts/${activationAttemptId}.receipt.json`,
    createdAt: '2026-07-13T05:00:00.000Z',
  };
}

function schemaValidator() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

it('publishes the immutable production activation plan schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))(
  'requirements-contract-production-activation-plan/v1',
  () => {
    it('accepts the pre-execution UUIDv7 plan and exact nested command order', () => {
      const validate = schemaValidator();

      expect(validate(activationPlan()), JSON.stringify(validate.errors)).toBe(true);
    });

    it('rejects missing, reordered, or non-fixture CMD-18 command declarations', () => {
      const validate = schemaValidator();
      const missing = activationPlan();
      missing.nestedCommands.pop();
      const reordered = activationPlan();
      [reordered.nestedCommands[0], reordered.nestedCommands[1]] = [
        reordered.nestedCommands[1],
        reordered.nestedCommands[0],
      ];
      const nonFixture = activationPlan();
      nonFixture.nestedCommands[3].fixtureOnly = false;

      expect(validate(missing)).toBe(false);
      expect(validate(reordered)).toBe(false);
      expect(validate(nonFixture)).toBe(false);
    });

    it('rejects downstream execution, promotion, activation, and evidence hashes', () => {
      const validate = schemaValidator();
      for (const forbiddenProperty of [
        'planHash',
        'promotionReceiptHash',
        'nestedCommandResults',
        'activationReceiptHash',
        'artifact33Hash',
        'evd14Hash',
      ]) {
        const invalid = {
          ...activationPlan(),
          [forbiddenProperty]: HASH,
        };

        expect(validate(invalid), forbiddenProperty).toBe(false);
      }
    });

    it('rejects invalid IDs, registry paths, snapshot paths, and receipt paths', () => {
      const validate = schemaValidator();
      const invalidId = activationPlan();
      invalidId.activationAttemptId = 'ACT-ATTEMPT-random';
      const invalidRegistry = activationPlan();
      invalidRegistry.registry.path = '../registry.json';
      const invalidSnapshot = activationPlan();
      invalidSnapshot.plannedSnapshotPath = '_bmad-output/runtime/candidate-snapshot/';
      const invalidReceiptPath = activationPlan();
      invalidReceiptPath.expectedPromotionReceiptPath =
        'docs/plans/evidence/loop-engineering-remediation/activation.receipt.json';

      expect(validate(invalidId)).toBe(false);
      expect(validate(invalidRegistry)).toBe(false);
      expect(validate(invalidSnapshot)).toBe(false);
      expect(validate(invalidReceiptPath)).toBe(false);
    });
  }
);
