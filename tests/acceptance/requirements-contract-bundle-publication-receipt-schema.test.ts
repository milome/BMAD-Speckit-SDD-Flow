import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'e'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-bundle-publication-receipt.schema.json'
);
const memberFiles = [
  'semantic-ir.json',
  'trace-graph.json',
  'target-bindings.json',
  'task-graph.json',
  'red-contracts.json',
  'oracle-registry.json',
  'acceptance-contracts.json',
  'evidence-requirements.json',
  'business-behavior-delta.json',
  'implementation-impact-map.json',
] as const;

function publicationReceipt() {
  const revisionRoot =
    '_bmad-output/runtime/requirement-records/order-flow/authoring/revisions/BUNDLE-REV-001';
  return {
    schemaVersion: 'requirements-contract-bundle-publication-receipt/v1',
    commandId: 'CMD-26',
    exactArgv: [
      'node',
      'packages/bmad-speckit/bin/bmad-speckit.js',
      'requirements-contract-bundle-publish',
      '--requirement-record',
      '_bmad-output/runtime/requirement-records/order-flow/requirement-record.json',
      '--source-document',
      'docs/requirements/order-flow.md',
      '--receipt',
      'docs/plans/evidence/loop-engineering-remediation/runtime-bundle-publication-receipt.json',
      '--json',
    ],
    argvHash: HASH,
    requirementSetId: 'order-flow',
    baseRevision: 7,
    expectedCommittedRecordRevision: 8,
    observedCommittedRecordRevision: 8,
    bundleRevision: 'BUNDLE-REV-001',
    atomicCommitId: 'ATOMIC-COMMIT-001',
    controlEventId: 'CONTROL-EVENT-001',
    manifest: {
      path: `${revisionRoot}/bundle-manifest.json`,
      hash: HASH,
      canonicalByteDomain: 'requirements-contract-runtime-bundle-manifest/v1',
    },
    members: memberFiles.map((fileName) => ({
      path: `${revisionRoot}/${fileName}`,
      hash: HASH,
      safeWriteReceiptRef: `SAFE-WRITE-${fileName}`,
      readbackHash: HASH,
    })),
    staging: {
      path: '_bmad-output/runtime/requirement-records/order-flow/authoring/.staging/ATOMIC-COMMIT-001',
      allElevenFilesReadBack: true,
      sameVolumeRenameDecision: 'pass',
      orphanCleanupDecision: 'pass',
    },
    compareAndSwap: {
      baseRevisionMatched: true,
      activeBundleRevisionMatched: true,
      eventAppended: true,
      activeBundleRevision: 'BUNDLE-REV-001',
      decision: 'pass',
    },
    result: 'pass',
  };
}

function schemaValidator() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

it('publishes the immutable Bundle publication receipt schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))(
  'requirements-contract-bundle-publication-receipt/v1',
  () => {
    it('accepts upstream CMD-26 revision, manifest, member, CAS, and readback facts', () => {
      const validate = schemaValidator();

      expect(validate(publicationReceipt()), JSON.stringify(validate.errors)).toBe(true);
    });

    it('requires the exact ten canonical Bundle member paths', () => {
      const validate = schemaValidator();
      const missing = publicationReceipt();
      missing.members.pop();
      const replaced = publicationReceipt();
      replaced.members[9] = {
        ...replaced.members[9],
        path: replaced.members[9].path.replace(
          'implementation-impact-map.json',
          'unexpected-member.json'
        ),
      };

      expect(validate(missing)).toBe(false);
      expect(validate(replaced)).toBe(false);
    });

    it('rejects receipt self-proof and downstream reverse references', () => {
      const validate = schemaValidator();
      for (const forbiddenProperty of [
        'receiptHash',
        'promotionReceiptHash',
        'promotedHash',
        'receiptReadbackHash',
        'artifact29Hash',
        'evd10Hash',
      ]) {
        const invalid = {
          ...publicationReceipt(),
          [forbiddenProperty]: HASH,
        };

        expect(validate(invalid), forbiddenProperty).toBe(false);
      }
    });

    it('rejects non-PASS CAS, invalid hashes, and extra nested claims', () => {
      const validate = schemaValidator();
      const blockedCas = publicationReceipt();
      blockedCas.compareAndSwap.decision = 'blocked' as never;
      const invalidHash = publicationReceipt();
      invalidHash.members[0].readbackHash = 'sha256:short';
      const extraNested = publicationReceipt();
      extraNested.manifest = {
        ...extraNested.manifest,
        manifestPromotionReceiptHash: HASH,
      } as never;

      expect(validate(blockedCas)).toBe(false);
      expect(validate(invalidHash)).toBe(false);
      expect(validate(extraNested)).toBe(false);
    });
  }
);
