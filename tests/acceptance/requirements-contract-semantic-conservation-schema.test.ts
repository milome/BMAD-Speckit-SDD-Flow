import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH = `sha256:${'c'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-semantic-conservation-manifest.schema.json'
);

function manifest() {
  return {
    schemaVersion: 'requirements-contract-semantic-conservation-manifest/v1',
    requirementSetId: 'checkout-reliability',
    intakeReceiptPath:
      '_bmad-output/runtime/requirement-records/checkout-reliability/authoring/intake/intake-receipt.json',
    intakeReceiptHash: HASH,
    intentLineageLedgerPath:
      '_bmad-output/runtime/requirement-records/checkout-reliability/authoring/intake/intent-lineage-ledger.json',
    intentLineageLedgerHash: HASH,
    sourceRoots: [
      {
        order: 1,
        sourceRootId: 'MUST-CHECKOUT-001',
        rootClass: 'must',
        sourceSpanRefs: ['span-001'],
        payloadHash: HASH,
        authorityClass: 'source_authority',
      },
      {
        order: 2,
        sourceRootId: 'UNRESOLVED-CHECKOUT-001',
        rootClass: 'unresolved_decision',
        sourceSpanRefs: ['span-002'],
        payloadHash: HASH,
        authorityClass: 'unresolved_authority',
      },
    ],
    semanticNodes: [
      {
        order: 1,
        nodeId: 'NODE-MUST-CHECKOUT-001',
        nodeHash: HASH,
        authorityClass: 'source_authority',
        authorityBearing: true,
      },
      {
        order: 2,
        nodeId: 'NODE-DECISION-CHECKOUT-001',
        nodeHash: HASH,
        authorityClass: 'decision_authority',
        authorityBearing: true,
      },
    ],
    rootToNodeMappings: [
      {
        sourceRootId: 'MUST-CHECKOUT-001',
        nodeId: 'NODE-MUST-CHECKOUT-001',
        mappingHash: HASH,
      },
      {
        sourceRootId: 'UNRESOLVED-CHECKOUT-001',
        nodeId: 'NODE-DECISION-CHECKOUT-001',
        mappingHash: HASH,
      },
    ],
    nodeToAuthorityMappings: [
      {
        nodeId: 'NODE-MUST-CHECKOUT-001',
        authoritySource: {
          kind: 'source_root',
          sourceRootId: 'MUST-CHECKOUT-001',
        },
        mappingHash: HASH,
      },
      {
        nodeId: 'NODE-DECISION-CHECKOUT-001',
        authoritySource: {
          kind: 'decision_receipt',
          decisionReceiptRef: 'DEC-CHECKOUT-001',
        },
        mappingHash: HASH,
      },
    ],
    decisionReceiptSetHash: HASH,
    unresolvedRootIds: ['UNRESOLVED-CHECKOUT-001'],
    sourceRootClassRegistryHash: HASH,
    sourceToIrMissingRootCount: 0,
    sourceToIrExtraRootCount: 0,
    sourceToIrPayloadMismatchCount: 0,
    sourceToIrAuthorityMismatchCount: 0,
    sourceToIrDuplicateRootCount: 0,
    semanticModelHash: HASH,
    canonicalRenderer: {
      id: 'canonical-source-prd-renderer/v1',
      hash: HASH,
    },
    parser: {
      id: 'canonical-source-prd-parser/v1',
      hash: HASH,
    },
    ruleRegistry: {
      id: 'requirements-contract-rule-registry/v1',
      hash: HASH,
    },
    lintProfileRegistry: {
      id: 'requirements-contract-lint-profile-registry/v1',
      hash: HASH,
    },
    validationFacade: {
      id: 'requirements-contract-validation-facade/v1',
      hash: HASH,
    },
    schemaHashes: [
      {
        id: 'requirement-contract-model-v2',
        hash: HASH,
      },
      {
        id: 'requirements-contract-semantic-conservation-manifest',
        hash: HASH,
      },
    ],
    hashChain: {
      sourceAuthorityHash: HASH,
      decisionReceiptSetHash: HASH,
      semanticConservationManifestHash: HASH,
      semanticModelHash: HASH,
    },
    manifestHash: HASH,
  };
}

function validator() {
  return new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(readFileSync(schemaPath, 'utf8'))
  );
}

it('publishes the inactive Semantic Conservation Manifest schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))(
  'requirements-contract-semantic-conservation-manifest/v1',
  () => {
    it('accepts ordered source, semantic, mapping, tool, and upstream hash-chain bindings', () => {
      const validate = validator();

      expect(validate(manifest()), JSON.stringify(validate.errors)).toBe(true);
    });

    it('rejects downstream render and bundle hashes in the conservation hash chain', () => {
      const validate = validator();
      for (const field of [
        'bundleManifestHash',
        'confirmationProjectionHash',
        'sourceDocumentHash',
      ]) {
        const candidate = manifest();
        (candidate.hashChain as Record<string, unknown>)[field] = HASH;
        expect(validate(candidate), field).toBe(false);
      }
    });

    it('rejects any nonzero conservation mismatch count', () => {
      const validate = validator();
      const fields = [
        'sourceToIrMissingRootCount',
        'sourceToIrExtraRootCount',
        'sourceToIrPayloadMismatchCount',
        'sourceToIrAuthorityMismatchCount',
        'sourceToIrDuplicateRootCount',
      ];

      for (const field of fields) {
        const candidate = manifest() as Record<string, unknown>;
        candidate[field] = 1;
        expect(validate(candidate), field).toBe(false);
      }
    });

    it('rejects a manifest without the Source Root class registry hash', () => {
      const validate = validator();
      const candidate = manifest() as Record<string, unknown>;
      delete candidate.sourceRootClassRegistryHash;

      expect(validate(candidate)).toBe(false);
    });

    it('rejects incomplete roots, nodes, and bidirectional mappings', () => {
      const validate = validator();
      const missingRootSpan = manifest();
      delete (missingRootSpan.sourceRoots as Array<Record<string, unknown>>)[0].sourceSpanRefs;
      const derivedNode = manifest();
      (derivedNode.semanticNodes as Array<Record<string, unknown>>)[0].authorityBearing = false;
      const missingReverseAuthority = manifest();
      delete (
        (missingReverseAuthority.nodeToAuthorityMappings as Array<Record<string, unknown>>)[1]
          .authoritySource as Record<string, unknown>
      ).decisionReceiptRef;

      expect(validate(missingRootSpan)).toBe(false);
      expect(validate(derivedNode)).toBe(false);
      expect(validate(missingReverseAuthority)).toBe(false);
    });

    it('rejects missing tooling identities and schema hashes', () => {
      const validate = validator();
      const missingParser = manifest() as Record<string, unknown>;
      delete missingParser.parser;
      const emptySchemas = manifest();
      emptySchemas.schemaHashes = [];

      expect(validate(missingParser)).toBe(false);
      expect(validate(emptySchemas)).toBe(false);
    });

    it('rejects malformed hash-chain values and undeclared properties', () => {
      const validate = validator();
      const malformedChain = manifest();
      malformedChain.hashChain.sourceDocumentHash = 'sha256:short';
      const extraRoot = manifest();
      (extraRoot.sourceRoots as Array<Record<string, unknown>>)[0].projectionCount = 2;
      const extraManifest = {
        ...manifest(),
        bijectionDecision: 'pass',
      };

      expect(validate(malformedChain)).toBe(false);
      expect(validate(extraRoot)).toBe(false);
      expect(validate(extraManifest)).toBe(false);
    });
  }
);
