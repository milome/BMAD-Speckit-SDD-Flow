import { expect, it } from 'vitest';
import {
  verifyRequirementsContractSemanticConservation,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-conservation-verifier';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

it('reports exact deterministic mismatch counters without accepting audit prose', () => {
  const root = {
    order: 1,
    sourceRootId: 'verifier-root',
    rootClass: 'must',
    sourceSpanRefs: ['verifier-span'],
    payloadHash: sha256Stable('root-payload'),
    authorityClass: 'source_authority',
  };
  const node = {
    order: 1,
    nodeId: 'verifier-node',
    nodeHash: sha256Stable('different-payload'),
    authorityClass: 'different-authority',
    authorityBearing: true as const,
    executionConstraintRefs: [],
  };
  const result = verifyRequirementsContractSemanticConservation({
    sourceRoots: [root, { ...root }],
    semanticNodes: [node],
    rootToNodeMappings: [{ sourceRootId: root.sourceRootId, nodeId: node.nodeId }],
    nodeToAuthorityMappings: [{
      nodeId: node.nodeId,
      authoritySource: { kind: 'source_root' as const, sourceRootId: root.sourceRootId },
    }],
    decisionReceiptRefs: [],
  });

  expect(result).toMatchObject({
    decision: 'block',
    sourceToIrMissingRootCount: 0,
    sourceToIrExtraRootCount: 0,
    sourceToIrPayloadMismatchCount: 1,
    sourceToIrAuthorityMismatchCount: 1,
    sourceToIrDuplicateRootCount: 1,
  });
});
