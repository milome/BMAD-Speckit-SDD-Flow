import { describe, expect, it } from 'vitest';
import { compareRequirementsContractCompactTraceParity } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-trace-graph';

const HASH = `sha256:${'7'.repeat(64)}`;

function projection() {
  return {
    canonicalTraceGraphHash: HASH,
    edgeTypeRegistryHash: HASH,
    bundleBindingHash: HASH,
    acceptanceBindingHash: HASH,
    acceptanceRootProofManifestHash: HASH,
    acceptanceRootIds: ['ACCEPTANCE-ROOT-001'],
    acceptanceRootCount: 1,
    acceptanceRootSetHash: HASH,
    atomicRows: [
      {
        traceId: 'TRACE-001',
        edgeId: 'EDGE-001',
        edgeType: 'verified_by',
        requirementRef: 'MUST-FR-001',
        fromRef: 'MUST-FR-001',
        toRef: 'ORACLE-001',
        applicability: 'applicable',
        proofRefs: ['PROOF-001'],
        requiredDimensionsHash: HASH,
        pathJoinHash: HASH,
      },
    ],
    fullPathRows: [
      {
        pathTraceId: 'TRACE-PATH-001',
        orderedEdgeIds: ['EDGE-001'],
        pathHash: HASH,
      },
    ],
  };
}

describe('requirements contract Compact Trace parity', () => {
  it('accepts exact Source PRD and ARTIFACT-24 projection parity', () => {
    expect(compareRequirementsContractCompactTraceParity(projection(), projection())).toEqual({
      ok: true,
      issues: [],
    });
  });

  it('rejects edge, acceptance-root, binding, and full-path drift', () => {
    const artifact = projection();
    artifact.atomicRows[0].toRef = 'ORACLE-002';
    artifact.acceptanceRootIds = ['ACCEPTANCE-ROOT-002'];
    artifact.bundleBindingHash = `sha256:${'8'.repeat(64)}`;
    artifact.fullPathRows[0].orderedEdgeIds = ['EDGE-002'];
    const result = compareRequirementsContractCompactTraceParity(projection(), artifact);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'compact_trace_atomic_rows_mismatch',
        'compact_trace_acceptance_roots_mismatch',
        'compact_trace_bundle_binding_mismatch',
        'compact_trace_full_path_rows_mismatch',
      ])
    );
  });
});
