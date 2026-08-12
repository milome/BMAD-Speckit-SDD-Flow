import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractSemanticConservationManifest,
  validateRequirementsContractSemanticConservationManifest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-conservation-manifest';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { SOURCE_ROOT_CLASS_REGISTRY_HASH } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-root-class-registry';
import { verifyExecutionConstraintConservation } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-conservation-verifier';

function fixture() {
  const payloadHash = sha256Stable({ must: 'preserve payment idempotency' });
  const sourceRoot = {
    order: 1,
    sourceRootId: 'fixture-source-root',
    rootClass: 'must',
    sourceSpanRefs: ['fixture-span'],
    payloadHash,
    authorityClass: 'source_authority',
  };
  const semanticNode = {
    order: 1,
    nodeId: 'fixture-semantic-node',
    nodeHash: payloadHash,
    authorityClass: sourceRoot.authorityClass,
    authorityBearing: true as const,
    executionConstraintRefs: ['CMD:targeted-conservation-test'],
  };
  const hash = (value: string) => sha256Stable(value);
  return {
    input: {
      requirementSetId: 'conservation-fixture-set',
      intakeReceiptPath: 'authoring/intake/intake-receipt.json',
      intakeReceiptHash: hash('intake'),
      intentLineageLedgerPath: 'authoring/intake/intent-lineage-ledger.json',
      intentLineageLedgerHash: hash('lineage'),
      sourceRoots: [sourceRoot],
      semanticNodes: [semanticNode],
      rootToNodeMappings: [{
        sourceRootId: sourceRoot.sourceRootId,
        nodeId: semanticNode.nodeId,
      }],
      nodeToAuthorityMappings: [{
        nodeId: semanticNode.nodeId,
        authoritySource: { kind: 'source_root' as const, sourceRootId: sourceRoot.sourceRootId },
      }],
      decisionReceipts: [],
      unresolvedRootIds: [],
      sourceRootClassRegistryHash: SOURCE_ROOT_CLASS_REGISTRY_HASH,
      semanticModelHash: hash('semantic-model'),
      canonicalRenderer: { id: 'fixture-renderer', hash: hash('renderer') },
      parser: { id: 'fixture-parser', hash: hash('parser') },
      ruleRegistry: { id: 'fixture-rule-registry', hash: hash('rules') },
      lintProfileRegistry: { id: 'fixture-lint-registry', hash: hash('lint') },
      validationFacade: { id: 'fixture-validation-facade', hash: hash('facade') },
      schemaHashes: [{ id: 'fixture-schema', hash: hash('schema') }],
      sourceAuthorityHash: hash('source-authority'),
    },
    sourceRoot,
    semanticNode,
  };
}

describe('requirements contract semantic conservation manifest', () => {
  it('fails closed when semantic execution refs are absent from the typed registry', () => {
    const { semanticNode } = fixture();
    const executionRegistry = {
      entries: [{
        kind: 'CMD' as const,
        id: 'targeted-conservation-test',
        value: 'npm test -- requirements-contract-semantic-conservation-manifest.test.ts',
      }],
    };
    expect(verifyExecutionConstraintConservation({
      semanticNodes: [semanticNode],
      executionRegistry,
    })).toEqual({ decision: 'pass', issueCodes: [] });
    expect(verifyExecutionConstraintConservation({
      semanticNodes: [{ ...semanticNode, executionConstraintRefs: ['CMD:missing'] }],
      executionRegistry,
    })).toEqual({
      decision: 'block',
      issueCodes: [
        'requirements_execution_constraint_unknown',
        'requirements_execution_registry_entry_unreferenced',
      ],
    });
  });

  it('accepts a semantic model with no execution constraints', () => {
    const { semanticNode } = fixture();
    expect(verifyExecutionConstraintConservation({
      semanticNodes: [{ ...semanticNode, executionConstraintRefs: [] }],
      executionRegistry: { entries: [] },
    })).toEqual({ decision: 'pass', issueCodes: [] });
  });

  it('builds a hash-bound exact source-root to authority-node bijection', () => {
    const { input } = fixture();
    const manifest = createRequirementsContractSemanticConservationManifest(input);

    expect(manifest.sourceToIrMissingRootCount).toBe(0);
    expect(manifest.sourceToIrExtraRootCount).toBe(0);
    expect(manifest.sourceToIrPayloadMismatchCount).toBe(0);
    expect(manifest.sourceToIrAuthorityMismatchCount).toBe(0);
    expect(manifest.sourceToIrDuplicateRootCount).toBe(0);
    expect(manifest.sourceRootClassRegistryHash).toBe(SOURCE_ROOT_CLASS_REGISTRY_HASH);
    expect(validateRequirementsContractSemanticConservationManifest(manifest)).toBe(true);
  });

  it('requires the current Source Root class registry hash in the manifest preimage', () => {
    const { input } = fixture();
    const manifest = createRequirementsContractSemanticConservationManifest(input);
    const missingRegistryHash = { ...manifest } as Record<string, unknown>;
    delete missingRegistryHash.sourceRootClassRegistryHash;

    expect(validateRequirementsContractSemanticConservationManifest(missingRegistryHash)).toBe(
      false
    );
    expect(
      validateRequirementsContractSemanticConservationManifest({
        ...manifest,
        sourceRootClassRegistryHash: sha256Stable('stale-source-root-registry'),
      })
    ).toBe(false);
  });

  it('rejects downstream render and bundle hashes at the upstream conservation boundary', () => {
    const { input } = fixture();
    const downstreamFields = [
      'bundleManifestHash',
      'confirmationProjectionHash',
      'sourceDocumentHash',
    ] as const;

    for (const field of downstreamFields) {
      expect(() =>
        createRequirementsContractSemanticConservationManifest({
          ...input,
          [field]: sha256Stable(field),
        })
      ).toThrow(/Malformed Semantic Conservation Manifest input/u);
    }

    const manifest = createRequirementsContractSemanticConservationManifest(input);
    for (const field of downstreamFields) {
      expect(
        validateRequirementsContractSemanticConservationManifest({
          ...manifest,
          hashChain: {
            ...manifest.hashChain,
            [field]: sha256Stable(field),
          },
        }),
        field
      ).toBe(false);
    }
  });

  it('blocks missing, duplicate, payload-mismatched, and authority-mismatched mappings', () => {
    const { input, sourceRoot, semanticNode } = fixture();
    expect(() =>
      createRequirementsContractSemanticConservationManifest({
        ...input,
        rootToNodeMappings: [],
      })
    ).toThrow(/missing root/u);
    expect(() =>
      createRequirementsContractSemanticConservationManifest({
        ...input,
        rootToNodeMappings: [
          ...input.rootToNodeMappings,
          { sourceRootId: sourceRoot.sourceRootId, nodeId: semanticNode.nodeId },
        ],
      })
    ).toThrow(/duplicate root/u);
    expect(() =>
      createRequirementsContractSemanticConservationManifest({
        ...input,
        semanticNodes: [{ ...semanticNode, nodeHash: sha256Stable('mismatch') }],
      })
    ).toThrow(/payload mismatch/u);
    expect(() =>
      createRequirementsContractSemanticConservationManifest({
        ...input,
        semanticNodes: [{ ...semanticNode, authorityClass: 'different-authority' }],
      })
    ).toThrow(/authority mismatch/u);
  });
});
