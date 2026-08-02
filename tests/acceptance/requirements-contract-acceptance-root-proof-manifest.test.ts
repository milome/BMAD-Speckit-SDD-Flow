import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRequirementsContractAcceptanceRootProofManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-acceptance-root-proof';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-acceptance-root-proof-manifest.schema.json'
);

function root() {
  return {
    acceptanceRootId: 'ACCEPTANCE-ROOT-001',
    sourcePath: 'docs/requirements/payments.md',
    sourceSpan: { startLine: 20, endLine: 22 },
    sourceHash: HASH_A,
    authorityClass: 'source_grounded',
    authorityProofRefs: ['PROOF-001'],
    applicability: {
      decision: 'applicable' as const,
      reasonCode: 'source_authorized',
      proofRefs: ['PROOF-001'],
    },
    requirementRefs: ['MUST-FR-001'],
    rootPayloadHash: HASH_B,
  };
}

describe('requirements contract Acceptance Root Proof Manifest', () => {
  it('creates deterministic schema-valid independent root authority', () => {
    const manifest = createRequirementsContractAcceptanceRootProofManifest({
      requirementSetId: 'payments',
      canonicalParserHash: HASH_A,
      sourceAuthorityHash: HASH_B,
      decisionReceiptSetHash: HASH_A,
      roots: [root()],
    });
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      JSON.parse(readFileSync(schemaPath, 'utf8'))
    );

    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true);
    expect(manifest.orderedRootIds).toEqual(['ACCEPTANCE-ROOT-001']);
    expect(manifest.rootSetHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('rejects duplicate roots and reversed source spans', () => {
    expect(() =>
      createRequirementsContractAcceptanceRootProofManifest({
        requirementSetId: 'payments',
        canonicalParserHash: HASH_A,
        sourceAuthorityHash: HASH_B,
        decisionReceiptSetHash: HASH_A,
        roots: [root(), root()],
      })
    ).toThrow('acceptance_root_duplicate:ACCEPTANCE-ROOT-001');
    expect(() =>
      createRequirementsContractAcceptanceRootProofManifest({
        requirementSetId: 'payments',
        canonicalParserHash: HASH_A,
        sourceAuthorityHash: HASH_B,
        decisionReceiptSetHash: HASH_A,
        roots: [{ ...root(), sourceSpan: { startLine: 22, endLine: 20 } }],
      })
    ).toThrow('acceptance_root_source_span_invalid:ACCEPTANCE-ROOT-001');
  });
});
