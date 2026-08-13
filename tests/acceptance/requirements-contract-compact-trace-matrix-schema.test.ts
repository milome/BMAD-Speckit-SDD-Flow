import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;
const schemaPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-compact-trace-matrix.schema.json'
);

const bundleBinding = {
  path: '_bmad-output/runtime/requirement-records/order-flow/authoring/revisions/BUNDLE-REV-001/bundle-manifest.json',
  hash: HASH_A,
};

const acceptanceManifestBinding = {
  path: '_bmad-output/runtime/requirement-records/order-flow/authoring/revisions/BUNDLE-REV-001/acceptance-contracts.json',
  hash: HASH_B,
};

const acceptanceRootProofManifestBinding = {
  path: 'docs/plans/evidence/loop-engineering-remediation/acceptance-root-proof-manifest.json',
  schemaVersion: 'requirements-contract-acceptance-root-proof-manifest/v1',
  hash: HASH_C,
  parserHash: HASH_D,
  sourceAuthorityHash: HASH_A,
  decisionReceiptSetHash: HASH_B,
};

function bound(...refs: string[]) {
  return {
    state: 'bound',
    refs,
    proofRefs: ['PROOF-SOURCE-001'],
  };
}

function notApplicable(reasonCode = 'edge_type_dimension_not_required') {
  return {
    state: 'not_applicable',
    reasonCode,
    proofRefs: ['PROOF-REGISTRY-001'],
  };
}

function compactTraceMatrix() {
  return {
    schemaVersion: 'requirements-contract-compact-trace-matrix/v1',
    activationState: 'inactive_schema_boundary',
    requirementSetId: 'order-flow',
    sourceAuthorityHash: HASH_A,
    semanticModelHash: HASH_B,
    canonicalTraceGraphHash: HASH_C,
    blockingEdgeUniverseHash: HASH_D,
    edgeTypeRegistryHash: HASH_A,
    authority: 'none',
    bundleBinding,
    acceptanceManifestBinding,
    acceptanceRootProofManifestBinding,
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
        factRefs: ['FACT-ORDER-001'],
        mustRefs: ['MUST-FR-001'],
        atomRefs: ['ATOM-ORDER-001'],
        originSpecSpanRefs: ['SPAN-ORDER-001'],
        evidenceClaimRefs: ['EVIDENCE-CLAIM-ORDER-001'],
        fromRef: {
          id: 'MUST-FR-001',
          type: 'requirement',
          hash: HASH_A,
        },
        toRef: {
          id: 'SCN-ORDER-001',
          type: 'scenario',
          hash: HASH_B,
        },
        applicability: {
          decision: 'applicable',
          reasonCode: 'blocking_edge',
          proofRefs: ['PROOF-SOURCE-001'],
        },
        proofRefs: ['PROOF-SOURCE-001'],
        dimensions: {
          scenario: bound('SCN-ORDER-001'),
          sequenceStep: notApplicable(),
          branch: notApplicable(),
          target: notApplicable(),
          task: notApplicable(),
          red: notApplicable(),
          oracle: notApplicable(),
          command: notApplicable(),
          acceptance: bound('ACCEPTANCE-001'),
          evidenceRequirement: notApplicable(),
        },
        pathJoin: {
          state: 'joined',
          criticalPathRefs: ['PATH-ORDER-001'],
          proofRefs: ['PROOF-SEQUENCE-001'],
        },
        bundleBinding,
        acceptanceManifestBinding,
        acceptanceRootProofManifestBinding,
        rowHash: HASH_C,
      },
    ],
    fullPathRows: [
      {
        pathTraceId: 'TRACE-PATH-001',
        criticalPathRef: 'PATH-ORDER-001',
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

function schemaValidator() {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: true }).compile(schema);
}

it('publishes the G01 Compact Trace Matrix schema boundary', () => {
  expect(existsSync(schemaPath)).toBe(true);
});

describe.runIf(existsSync(schemaPath))('requirements-contract-compact-trace-matrix/v1', () => {
  it('accepts one complete atomic edge row plus its critical full-path join', () => {
    const validate = schemaValidator();

    expect(validate(compactTraceMatrix()), JSON.stringify(validate.errors)).toBe(true);
  });

  it('requires every registry-controlled dimension or a proof-bound not_applicable decision', () => {
    const validate = schemaValidator();
    const missingDimension = compactTraceMatrix();
    delete (missingDimension.atomicRows[0].dimensions as Record<string, unknown>).oracle;
    const unprovedNotApplicable = compactTraceMatrix();
    unprovedNotApplicable.atomicRows[0].dimensions.oracle = {
      state: 'not_applicable',
      reasonCode: 'edge_type_dimension_not_required',
      proofRefs: [],
    };
    const syntheticBinding = compactTraceMatrix();
    syntheticBinding.atomicRows[0].dimensions.oracle = {
      state: 'not_applicable',
      reasonCode: 'edge_type_dimension_not_required',
      proofRefs: ['PROOF-REGISTRY-001'],
      refs: ['ORACLE-SYNTHETIC-001'],
    } as never;

    expect(validate(missingDimension)).toBe(false);
    expect(validate(unprovedNotApplicable)).toBe(false);
    expect(validate(syntheticBinding)).toBe(false);
  });

  it('rejects copied semantic bodies in atomic rows, dimensions, and artifact bindings', () => {
    const validate = schemaValidator();
    const copiedRowBody = compactTraceMatrix();
    copiedRowBody.atomicRows[0] = {
      ...copiedRowBody.atomicRows[0],
      requirementBody: 'copied requirement text',
    } as never;
    const copiedDimensionBody = compactTraceMatrix();
    copiedDimensionBody.atomicRows[0].dimensions.acceptance = {
      ...bound('ACCEPTANCE-001'),
      acceptanceBody: 'copied acceptance text',
    } as never;
    const copiedBindingBody = compactTraceMatrix();
    copiedBindingBody.atomicRows[0].bundleBinding = {
      ...bundleBinding,
      manifestBody: {},
    } as never;

    expect(validate(copiedRowBody)).toBe(false);
    expect(validate(copiedDimensionBody)).toBe(false);
    expect(validate(copiedBindingBody)).toBe(false);
  });

  it('requires typed endpoints, stable hashes, and current artifact path bindings on every row', () => {
    const validate = schemaValidator();
    const invalidEndpointType = compactTraceMatrix();
    invalidEndpointType.atomicRows[0].toRef.type = 'markdown_heading';
    const invalidEndpointHash = compactTraceMatrix();
    invalidEndpointHash.atomicRows[0].toRef.hash = 'sha256:short';
    const missingProofManifestBinding = compactTraceMatrix();
    delete (missingProofManifestBinding.atomicRows[0] as Record<string, unknown>)
      .acceptanceRootProofManifestBinding;

    expect(validate(invalidEndpointType)).toBe(false);
    expect(validate(invalidEndpointHash)).toBe(false);
    expect(validate(missingProofManifestBinding)).toBe(false);
  });

  it('supports only trace-bound or proof-bound not-applicable Acceptance root decisions', () => {
    const validate = schemaValidator();
    const missingTrace = compactTraceMatrix();
    missingTrace.acceptanceRootBindings[0].traceRefs = [];
    const invalidDecision = compactTraceMatrix();
    invalidDecision.acceptanceRootBindings[0].decision = 'assumed';
    const notApplicableRoot = compactTraceMatrix();
    notApplicableRoot.acceptanceRootBindings[0] = {
      acceptanceRootRef: 'ACCEPTANCE-ROOT-001',
      decision: 'not_applicable',
      reasonCode: 'verified_product_boundary',
      proofRefs: ['PROOF-DECISION-001'],
    } as never;

    expect(validate(missingTrace)).toBe(false);
    expect(validate(invalidDecision)).toBe(false);
    expect(validate(notApplicableRoot), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects unproved path joins, replaced atomic rows, duplicate root IDs, and self file hashes', () => {
    const validate = schemaValidator();
    const unprovedPathJoin = compactTraceMatrix();
    unprovedPathJoin.atomicRows[0].pathJoin = {
      state: 'not_applicable',
      reasonCode: 'non_critical_edge',
      proofRefs: [],
    } as never;
    const missingAtomicRows = compactTraceMatrix();
    missingAtomicRows.atomicRows = [];
    const duplicateRoots = compactTraceMatrix();
    duplicateRoots.acceptanceRootIds.push('ACCEPTANCE-ROOT-001');
    const selfHashed = {
      ...compactTraceMatrix(),
      compactTraceMatrixHash: HASH_A,
    };

    expect(validate(unprovedPathJoin)).toBe(false);
    expect(validate(missingAtomicRows)).toBe(false);
    expect(validate(duplicateRoots)).toBe(false);
    expect(validate(selfHashed)).toBe(false);
  });
});
