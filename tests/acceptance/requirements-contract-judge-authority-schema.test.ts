import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'5'.repeat(64)}`;
const schemaRoot = path.resolve('packages/bmad-speckit/src/main-agent/source-authority/schemas');
const schemaFiles = {
  attemptKey: 'requirements-contract-judge-attempt-key.schema.json',
  ledgerEntry: 'requirements-contract-judge-ledger-entry.schema.json',
  transitionReceipt: 'requirements-contract-judge-transition-receipt.schema.json',
};

type SchemaName = keyof typeof schemaFiles;
type JsonRecord = Record<string, unknown>;

function validator(name: SchemaName) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(path.join(schemaRoot, schemaFiles[name]), 'utf8')));
}

function attemptKey(overrides: JsonRecord = {}) {
  return {
    schemaVersion: 'requirements-contract-judge-attempt-key/v1',
    attemptId: 'JUDGE-ATTEMPT-001',
    actorClass: 'requirements_critical_auditor_judge',
    judgeRole: 'requirements_critical_auditor',
    sourceAuthorityHash: HASH,
    scopeManifestHash: HASH,
    promptTemplateHash: HASH,
    assessmentSchemaHash: HASH,
    providerRegistryHash: HASH,
    providerConfigurationHash: HASH,
    ledgerNamespace: 'requirements',
    previousAttemptKeyHash: null,
    attemptOrdinal: 1,
    attemptKeyHash: HASH,
    ...overrides,
  };
}

function ledgerEntry(overrides: JsonRecord = {}) {
  return {
    schemaVersion: 'requirements-contract-judge-ledger-entry/v1',
    ledgerEntryId: 'LEDGER-ENTRY-001',
    ledgerNamespace: 'requirements',
    actorClass: 'requirements_critical_auditor_judge',
    judgeRole: 'requirements_critical_auditor',
    attemptKeyHash: HASH,
    sourceAuthorityHash: HASH,
    observationHash: HASH,
    dispositionHash: HASH,
    previousLedgerEntryHash: null,
    ledgerEntryHash: HASH,
    appendOnly: true,
    decisionFieldOrigin: 'package_calculated',
    decision: 'recorded',
    ...overrides,
  };
}

function transitionReceipt(overrides: JsonRecord = {}) {
  return {
    schemaVersion: 'requirements-contract-judge-transition-receipt/v1',
    transitionId: 'TRANSITION-001',
    actorClass: 'requirements_critical_auditor_judge',
    judgeRole: 'requirements_critical_auditor',
    attemptKeyHash: HASH,
    fromState: 'RequirementsAssessed',
    toState: 'RequirementsEffectivePass',
    ledgerEntryHash: HASH,
    evidenceManifestHash: HASH,
    blockingReasonHash: HASH,
    effectivePassReceiptRef: {
      schemaVersion: 'requirements-effective-pass-receipt/v1',
      path: 'judge/requirements/effective-pass.receipt.json',
      hash: HASH,
    },
    writeSemantics: 'create_only',
    writer: 'package_owned_judge_transition_writer',
    decisionFieldOrigin: 'package_calculated',
    decision: 'pass',
    receiptHash: HASH,
    ...overrides,
  };
}

describe('requirements contract Judge authority schemas', () => {
  it('publishes the shared AttemptKey, ledger, and transition schemas', () => {
    expect(
      Object.values(schemaFiles).every((name) => existsSync(path.join(schemaRoot, name)))
    ).toBe(true);
  });

  describe.runIf(
    Object.values(schemaFiles).every((name) => existsSync(path.join(schemaRoot, name)))
  )('J01-T05 authority fixtures', () => {
    it('accepts role-separated Requirements and Final AttemptKey fixtures', () => {
      const validate = validator('attemptKey');
      const requirements = attemptKey();
      const final = attemptKey({
        actorClass: 'final_acceptance_judge',
        judgeRole: 'final_acceptance_judge',
        ledgerNamespace: 'final_acceptance',
        previousAttemptKeyHash: HASH,
        attemptOrdinal: 2,
      });

      expect(validate(requirements), JSON.stringify(validate.errors)).toBe(true);
      expect(validate(final), JSON.stringify(validate.errors)).toBe(true);
    });

    it('rejects actor-role mismatches and incomplete authority hash binding', () => {
      const validate = validator('attemptKey');
      const mismatched = attemptKey({ judgeRole: 'final_acceptance_judge' });
      const missingHash = attemptKey();
      delete (missingHash as JsonRecord).providerRegistryHash;

      expect(validate(mismatched)).toBe(false);
      expect(validate(missingHash)).toBe(false);
    });

    it('accepts append-only ledger entries and rejects caller-provided pass authority', () => {
      const validate = validator('ledgerEntry');

      expect(validate(ledgerEntry()), JSON.stringify(validate.errors)).toBe(true);
      expect(validate(ledgerEntry({ appendOnly: false }))).toBe(false);
      expect(validate(ledgerEntry({ closeoutApproved: true }))).toBe(false);
      expect(validate(ledgerEntry({ decisionFieldOrigin: 'caller_provided' }))).toBe(false);
    });

    it('accepts create-only transition receipts and rejects Kernel/Judge substitution', () => {
      const validate = validator('transitionReceipt');

      expect(validate(transitionReceipt()), JSON.stringify(validate.errors)).toBe(true);
      expect(validate(transitionReceipt({ writeSemantics: 'upsert' }))).toBe(false);
      expect(validate(transitionReceipt({ expectedHash: HASH }))).toBe(false);
      expect(validate(transitionReceipt({ pass: true }))).toBe(false);
      expect(
        validate({
          ...transitionReceipt(),
          schemaVersion: 'goal-contract-subcontract-closure-receipt/v1',
        })
      ).toBe(false);
      expect(
        validate(
          transitionReceipt({
            effectivePassReceiptRef: {
              schemaVersion: 'goal-contract-subcontract-closure-receipt/v1',
              path: 'kernel/closure.receipt.json',
              hash: HASH,
            },
          })
        )
      ).toBe(false);
    });
  });
});
