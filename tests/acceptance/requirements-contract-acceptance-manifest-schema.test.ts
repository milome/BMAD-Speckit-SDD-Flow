import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'c'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-acceptance-contracts.schema.json'
);

function acceptanceManifest() {
  return {
    schemaVersion: 'requirements-contract-acceptance-manifest/v1',
    canonicalByteDomain: 'requirements-contract-acceptance-manifest/v1',
    canonicalFileName: 'acceptance-contracts.json',
    requirementSetId: 'order-flow',
    sourceAuthorityHash: HASH,
    semanticModelHash: HASH,
    acceptanceRootProofManifest: {
      path: 'docs/plans/evidence/loop-engineering-remediation/acceptance-root-proof-manifest.json',
      hash: HASH,
      rootSetHash: HASH,
    },
    acceptanceRootIds: ['ACCEPTANCE-ROOT-001'],
    acceptanceRootCount: 1,
    acceptanceRootSetHash: HASH,
    contracts: [
      {
        id: 'ACCEPTANCE-001',
        acceptanceRootRef: 'ACCEPTANCE-ROOT-001',
        requirementRefs: ['MUST-FR-001'],
        text: 'A submitted order receives a stable identifier.',
        applicability: {
          decision: 'applicable',
          proofRefs: ['SOURCE-SPAN-001'],
        },
        verification: {
          oracleRefs: ['ORACLE-001'],
          commandRefs: ['CMD-001'],
          evidenceRequirementRefs: ['EVIDENCE-REQ-001'],
        },
        contractHash: HASH,
      },
    ],
  };
}

function schemaValidator() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

it('publishes the canonical Acceptance Manifest schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))('requirements-contract-acceptance-manifest/v1', () => {
  it('accepts the sole canonical acceptance-contracts.json representation', () => {
    const validate = schemaValidator();

    expect(validate(acceptanceManifest()), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects a second Acceptance Manifest filename and self-hash claims', () => {
    const validate = schemaValidator();
    const alternateFile = acceptanceManifest();
    alternateFile.canonicalFileName = 'acceptance-manifest.json';
    const selfHashed = {
      ...acceptanceManifest(),
      acceptanceManifestHash: HASH,
    };

    expect(validate(alternateFile)).toBe(false);
    expect(validate(selfHashed)).toBe(false);
  });

  it('requires proof-manifest root universe bindings and strict nested objects', () => {
    const validate = schemaValidator();
    const missingRootSet = acceptanceManifest() as Record<string, unknown>;
    delete missingRootSet.acceptanceRootSetHash;
    const invalidApplicability = acceptanceManifest();
    invalidApplicability.contracts[0].applicability.decision = 'assumed' as never;
    const copiedRelationshipBody = acceptanceManifest();
    copiedRelationshipBody.contracts[0].verification = {
      ...copiedRelationshipBody.contracts[0].verification,
      requirementBody: 'copied semantic content',
    } as never;

    expect(validate(missingRootSet)).toBe(false);
    expect(validate(invalidApplicability)).toBe(false);
    expect(validate(copiedRelationshipBody)).toBe(false);
  });
});
