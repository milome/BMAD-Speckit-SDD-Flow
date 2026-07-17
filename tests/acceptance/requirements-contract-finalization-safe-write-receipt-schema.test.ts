import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'2'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-finalization-safe-write-receipt.schema.json'
);

function receipt(result: 'PASS' | 'BLOCK' = 'PASS') {
  const value = {
    schemaVersion: 'requirements-contract-finalization-safe-write-receipt/v1',
    commandId: 'requirements-contract-finalization-safe-write',
    finalizationRunId: 'FINALIZATION-RUN-001',
    requirementRecord: {
      path: '_bmad-output/runtime/requirement-records/REQ-001/requirement-record.json',
      hash: HASH,
    },
    implementationAttemptId: 'IMP-001',
    exactArgv: ['node', 'packages/bmad-speckit/bin/bmad-speckit.js'],
    argvHash: HASH,
    artifactRole: 'EVD-15',
    validationProfile: 'goal-task-evidence',
    finalizationDeclarationHash: HASH,
    predecessor: {
      applicable: true,
      expectedReceiptPath:
        'docs/plans/evidence/loop-engineering-remediation/finalization-receipts/amend05-safe-write-receipt-manifest.receipt.json',
      receipt: {
        path: 'docs/plans/evidence/loop-engineering-remediation/finalization-receipts/amend05-safe-write-receipt-manifest.receipt.json',
        hash: HASH,
        artifactRole: 'AMEND05-SAFE-WRITE-MANIFEST',
      },
    },
    target: {
      path: 'docs/plans/evidence/loop-engineering-remediation/G15-final-gates.json',
      requiredSchemaVersion: 'requirements-contract-goal-task-evidence/v1',
      requiredSchemaHash: HASH,
      minBytes: 2,
      targetExistedBefore: true,
      previousHash: HASH,
      promotedHash: HASH,
      readbackHash: HASH,
    },
    draft: {
      path: 'docs/plans/evidence/loop-engineering-remediation/.finalization-staging/IMP-001/G15-final-gates.json',
      hash: HASH,
      bytes: 256,
    },
    writerIdentity: 'requirements-contract-finalization-safe-writer/v1',
    result,
    selectedReceiptPath:
      'docs/plans/evidence/loop-engineering-remediation/finalization-receipts/G15-final-gates.receipt.json',
  } as Record<string, unknown>;
  if (result === 'BLOCK') {
    value.failure = { code: 'draft_schema_invalid' };
    value.retryRole = 'EVD-15';
    value.selectedReceiptPath =
      'docs/plans/evidence/loop-engineering-remediation/finalization-receipts/blocked/IMP-001/FINALIZATION-RUN-001/EVD-15.blocked.json';
    value.draft = {
      path: 'docs/plans/evidence/loop-engineering-remediation/.finalization-staging/IMP-001/G15-final-gates.json',
      archivedPath:
        'docs/plans/evidence/loop-engineering-remediation/finalization-failure-archive/IMP-001/FINALIZATION-RUN-001/EVD-15.draft.json',
      archivedHash: HASH,
    };
    value.target = {
      path: 'docs/plans/evidence/loop-engineering-remediation/G15-final-gates.json',
      requiredSchemaVersion: 'requirements-contract-goal-task-evidence/v1',
      requiredSchemaHash: HASH,
      minBytes: 2,
      targetExistedBefore: true,
      previousHash: HASH,
    };
  }
  return value;
}

function validator() {
  return new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(readFileSync(schemaPath, 'utf8'))
  );
}

describe('requirements-contract-finalization-safe-write-receipt/v1', () => {
  it('accepts complete PASS and BLOCK receipts', () => {
    const validate = validator();

    expect(validate(receipt('PASS')), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(receipt('BLOCK')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('requires promoted and readback hashes for PASS', () => {
    const validate = validator();
    const incomplete = receipt('PASS');
    delete (incomplete.target as Record<string, unknown>).promotedHash;
    delete (incomplete.target as Record<string, unknown>).readbackHash;

    expect(validate(incomplete)).toBe(false);
  });

  it('requires an archived draft for BLOCK and forbids PASS-only target facts', () => {
    const validate = validator();
    const missingArchive = receipt('BLOCK');
    delete (missingArchive.draft as Record<string, unknown>).archivedPath;
    const falseBlockedPromotion = receipt('BLOCK');
    (falseBlockedPromotion.target as Record<string, unknown>).promotedHash = HASH;

    expect(validate(missingArchive)).toBe(false);
    expect(validate(falseBlockedPromotion)).toBe(false);
  });
});
