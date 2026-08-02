import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'1'.repeat(64)}`;
const UUID_V7 = '018f3f2e-7b4c-7def-8abc-1234567890ab';
const activationAttemptId = `ACT-ATTEMPT-${UUID_V7}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-production-activation-receipt.schema.json'
);

function commonReceipt() {
  return {
    schemaVersion: 'requirements-contract-production-activation-receipt/v1',
    requirementSetId: 'order-flow',
    implementationAttemptId: 'IMPL-ATTEMPT-001',
    activationAttemptId,
    activationReceiptId: `ACT-RECEIPT-${UUID_V7}`,
    selectedReceiptSchemaVersion: 'requirements-contract-production-activation-receipt/v1',
    selectedReceiptSchemaHash: HASH,
    activationPlan: {
      path: `docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-plans/${activationAttemptId}.json`,
      hash: HASH,
      promotionReceiptPath: `docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-plan-write-receipts/${activationAttemptId}.receipt.json`,
      promotionReceiptHash: HASH,
    },
    candidateSnapshot: {
      path: `_bmad-output/runtime/requirement-records/order-flow/activation/IMPL-ATTEMPT-001/${activationAttemptId}/candidate-snapshot/`,
      hash: HASH,
    },
    commands: ['CMD-09', 'CMD-11', 'CMD-13', 'CMD-18'].map((commandId) => ({
      commandId,
      argvHash: HASH,
      exitCode: 0,
      stdoutHash: HASH,
      stderrHash: HASH,
      decision: 'pass',
    })),
    lock: {
      acquired: true,
      lockIdentityHash: HASH,
    },
    compareAndSwap: {
      registryPreimageHash: HASH,
      registryTargetHash: HASH,
      decision: 'pass',
    },
  };
}

function successReceipt() {
  return {
    ...commonReceipt(),
    activationOutcome: 'success',
    selectedReceiptPath:
      'docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-receipt.json',
    readback: {
      registryHash: HASH,
      selectorDecision: 'pass',
      activeImplementationAttemptId: 'IMPL-ATTEMPT-001',
      decision: 'pass',
    },
  };
}

function blockedReceipt() {
  return {
    ...commonReceipt(),
    activationOutcome: 'blocked',
    selectedReceiptPath: `docs/plans/evidence/loop-engineering-remediation/normalized-contract-activation-attempts/${activationAttemptId}.json`,
    failure: {
      code: 'activation_compare_and_swap_failed',
      phase: 'compare_and_swap',
      stderrHash: HASH,
    },
    restoration: {
      registryRestored: true,
      restoredRegistryHash: HASH,
      decision: 'pass',
    },
  };
}

function schemaValidator() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

it('publishes the exclusive production activation outcome receipt schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))(
  'requirements-contract-production-activation-receipt/v1',
  () => {
    it('accepts mutually exclusive success and blocked receipts', () => {
      const validate = schemaValidator();

      expect(validate(successReceipt()), JSON.stringify(validate.errors)).toBe(true);
      expect(validate(blockedReceipt()), JSON.stringify(validate.errors)).toBe(true);
    });

    it('rejects mixed success and blocked facts or the wrong selected path', () => {
      const validate = schemaValidator();
      const mixed = {
        ...successReceipt(),
        failure: blockedReceipt().failure,
        restoration: blockedReceipt().restoration,
      };
      const wrongSuccessPath = successReceipt();
      wrongSuccessPath.selectedReceiptPath = blockedReceipt().selectedReceiptPath;
      const wrongBlockedPath = blockedReceipt();
      wrongBlockedPath.selectedReceiptPath = successReceipt().selectedReceiptPath;

      expect(validate(mixed)).toBe(false);
      expect(validate(wrongSuccessPath)).toBe(false);
      expect(validate(wrongBlockedPath)).toBe(false);
    });

    it('rejects missing readback or restoration proof', () => {
      const validate = schemaValidator();
      const successWithoutReadback = successReceipt() as Record<string, unknown>;
      delete successWithoutReadback.readback;
      const blockedWithoutRestoration = blockedReceipt() as Record<string, unknown>;
      delete blockedWithoutRestoration.restoration;

      expect(validate(successWithoutReadback)).toBe(false);
      expect(validate(blockedWithoutRestoration)).toBe(false);
    });

    it('rejects self-hash and downstream Artifact or Evidence references', () => {
      const validate = schemaValidator();
      for (const forbiddenProperty of ['receiptHash', 'artifact33Hash', 'evd14Hash']) {
        const invalid = {
          ...successReceipt(),
          [forbiddenProperty]: HASH,
        };

        expect(validate(invalid), forbiddenProperty).toBe(false);
      }
    });
  }
);
