const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;

export function normalizedPackageFixture() {
  return {
    semanticBodies: {
      [HASH_A]: { text: 'Checkout returns a stable result.' },
      [HASH_B]: { actor: 'Customer', outcome: 'Checkout result is visible.' },
      [HASH_C]: { sourceSpanRef: 'SOURCE-SPAN-001' },
    },
    nodes: {
      'MUST-FR-001': {
        nodeType: 'requirement',
        bodySchemaVersion: 'requirement-contract-requirement/v2',
        bodyHash: HASH_A,
        applicability: {
          decision: 'applicable',
          reasonCode: 'source_authorized',
          proofRefs: ['PROOF-SOURCE-001'],
        },
        proofBindings: ['PROOF-SOURCE-001'],
      },
      'SCN-CHECKOUT-001': {
        nodeType: 'scenario',
        bodySchemaVersion: 'requirements-contract-scenario/v1',
        bodyHash: HASH_B,
        applicability: {
          decision: 'applicable',
          reasonCode: 'requirement_bound',
          proofRefs: ['PROOF-SOURCE-001'],
        },
        proofBindings: ['PROOF-SOURCE-001'],
      },
      'PROOF-SOURCE-001': {
        nodeType: 'proof',
        bodySchemaVersion: 'requirements-contract-proof/v1',
        bodyHash: HASH_C,
        applicability: {
          decision: 'applicable',
          reasonCode: 'source_span_verified',
          proofRefs: ['SOURCE-SPAN-001'],
        },
        proofBindings: ['SOURCE-SPAN-001'],
      },
    },
    edges: {
      'EDGE-REQ-SCENARIO-001': {
        edgeType: 'requirement_to_scenario',
        fromRef: 'MUST-FR-001',
        fromHash: HASH_A,
        toRef: 'SCN-CHECKOUT-001',
        toHash: HASH_B,
        applicability: {
          decision: 'applicable',
          reasonCode: 'source_authorized',
          proofRefs: ['PROOF-SOURCE-001'],
        },
        proofBindings: ['PROOF-SOURCE-001'],
        edgeHash: HASH_D,
      },
    },
  };
}

const revisionRoot =
  '_bmad-output/runtime/requirement-records/checkout/authoring/revisions/BUNDLE-REV-001';
const bundleBinding = { path: `${revisionRoot}/bundle-manifest.json`, hash: HASH_A };
const acceptanceManifestBinding = {
  path: `${revisionRoot}/acceptance-contracts.json`,
  hash: HASH_B,
};
const proofManifestBinding = {
  path: 'evidence/acceptance-root-proof-manifest.json',
  schemaVersion: 'requirements-contract-acceptance-root-proof-manifest/v1',
  hash: HASH_C,
  parserHash: HASH_D,
  sourceAuthorityHash: HASH_A,
  decisionReceiptSetHash: HASH_B,
};

function bound(...refs: string[]) {
  return { state: 'bound', refs, proofRefs: ['PROOF-SOURCE-001'] };
}

function notApplicable() {
  return {
    state: 'not_applicable',
    reasonCode: 'edge_type_dimension_not_required',
    proofRefs: ['PROOF-REGISTRY-001'],
  };
}

export function compactTraceFixture() {
  return {
    schemaVersion: 'requirements-contract-compact-trace-matrix/v1',
    activationState: 'inactive_schema_boundary',
    requirementSetId: 'checkout',
    sourceAuthorityHash: HASH_A,
    semanticModelHash: HASH_B,
    canonicalTraceGraphHash: HASH_C,
    blockingEdgeUniverseHash: HASH_D,
    edgeTypeRegistryHash: HASH_A,
    authority: 'none',
    bundleBinding,
    acceptanceManifestBinding,
    acceptanceRootProofManifestBinding: proofManifestBinding,
    acceptanceRootIds: ['ACCEPTANCE-ROOT-001'],
    acceptanceRootCount: 1,
    acceptanceRootSetHash: HASH_B,
    acceptanceRootBindings: [
      {
        acceptanceRootRef: 'ACCEPTANCE-ROOT-001',
        decision: 'trace_bound',
        traceRefs: ['TRACE-001'],
        proofRefs: ['PROOF-SOURCE-001'],
      },
    ],
    atomicRows: [
      {
        traceId: 'TRACE-001',
        edgeId: 'EDGE-001',
        edgeType: 'requirement_to_scenario',
        requirementRef: 'MUST-FR-001',
        factRefs: ['FACT-001'],
        mustRefs: ['MUST-FR-001'],
        atomRefs: ['ATOM-001'],
        originSpecSpanRefs: ['SPEC-SPAN-001'],
        evidenceClaimRefs: ['CLAIM-001'],
        fromRef: { id: 'MUST-FR-001', type: 'requirement', hash: HASH_A },
        toRef: { id: 'SCN-CHECKOUT-001', type: 'scenario', hash: HASH_B },
        applicability: {
          decision: 'applicable',
          reasonCode: 'blocking_edge',
          proofRefs: ['PROOF-SOURCE-001'],
        },
        proofRefs: ['PROOF-SOURCE-001'],
        dimensions: {
          scenario: bound('SCN-CHECKOUT-001'),
          sequenceStep: notApplicable(),
          branch: notApplicable(),
          target: notApplicable(),
          task: notApplicable(),
          red: notApplicable(),
          oracle: notApplicable(),
          command: notApplicable(),
          acceptance: bound('ACCEPTANCE-001'),
          evidenceRequirement: bound('EVDREQ-001'),
        },
        pathJoin: {
          state: 'joined',
          criticalPathRefs: ['PATH-CHECKOUT-001'],
          proofRefs: ['PROOF-SEQUENCE-001'],
        },
        bundleBinding,
        acceptanceManifestBinding,
        acceptanceRootProofManifestBinding: proofManifestBinding,
        rowHash: HASH_C,
      },
    ],
    fullPathRows: [
      {
        pathTraceId: 'TRACE-PATH-001',
        criticalPathRef: 'PATH-CHECKOUT-001',
        sequenceContractHash: HASH_D,
        orderedAtomicTraceIds: ['TRACE-001'],
        orderedEdgeIds: ['EDGE-001'],
        proofRefs: ['PROOF-SEQUENCE-001'],
        pathHash: HASH_A,
      },
    ],
    projectionHash: HASH_D,
  };
}
