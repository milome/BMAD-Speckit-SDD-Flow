import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'d'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-acceptance-root-proof-manifest.schema.json'
);

function proofManifest() {
  return {
    schemaVersion: 'requirements-contract-acceptance-root-proof-manifest/v1',
    canonicalFileName: 'acceptance-root-proof-manifest.json',
    requirementSetId: 'order-flow',
    canonicalParserHash: HASH,
    sourceAuthorityHash: HASH,
    decisionReceiptSetHash: HASH,
    rootCount: 1,
    orderedRootIds: ['ACCEPTANCE-ROOT-001'],
    rootSetHash: HASH,
    roots: [
      {
        acceptanceRootId: 'ACCEPTANCE-ROOT-001',
        sourcePath: 'docs/requirements/order-flow.md',
        sourceSpan: {
          startLine: 80,
          endLine: 84,
        },
        sourceHash: HASH,
        authorityClass: 'source_prd',
        authorityProofRefs: ['SOURCE-AUTHORITY-001'],
        applicability: {
          decision: 'applicable',
          reasonCode: 'source_declared',
          proofRefs: ['SOURCE-SPAN-001'],
        },
        requirementRefs: ['MUST-FR-001'],
        rootPayloadHash: HASH,
      },
    ],
  };
}

function schemaValidator() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

it('publishes the independent Acceptance Root Proof Manifest schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))(
  'requirements-contract-acceptance-root-proof-manifest/v1',
  () => {
    it('accepts independently parsed source spans and root-universe hashes', () => {
      const validate = schemaValidator();

      expect(validate(proofManifest()), JSON.stringify(validate.errors)).toBe(true);
    });

    it('rejects invalid spans, hashes, and unproved applicability', () => {
      const validate = schemaValidator();
      const invalidSpan = proofManifest();
      invalidSpan.roots[0].sourceSpan = { startLine: 0, endLine: 80 };
      const invalidHash = proofManifest();
      invalidHash.roots[0].rootPayloadHash = 'sha256:short';
      const missingProof = proofManifest();
      missingProof.roots[0].applicability.proofRefs = [];

      expect(validate(invalidSpan)).toBe(false);
      expect(validate(invalidHash)).toBe(false);
      expect(validate(missingProof)).toBe(false);
    });

    it('rejects compiler-output and Acceptance Manifest reverse bindings', () => {
      const validate = schemaValidator();
      for (const forbiddenProperty of [
        'semanticModelHash',
        'acceptanceManifestHash',
        'compactTraceHash',
      ]) {
        const invalid = {
          ...proofManifest(),
          [forbiddenProperty]: HASH,
        };

        expect(validate(invalid), forbiddenProperty).toBe(false);
      }
    });
  }
);
