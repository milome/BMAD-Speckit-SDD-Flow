import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractNormalizedTraceGraph,
  validateRequirementsContractNormalizedTraceGraph,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-trace-graph';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;

function graphInput() {
  return {
    requirementSetId: 'payments',
    sourceAuthorityHash: HASH_A,
    semanticModelHash: HASH_B,
    semanticConservationManifestHash: HASH_A,
    nodes: [
      {
        id: 'MUST-FR-001',
        nodeType: 'requirement' as const,
        bodyHash: HASH_A,
        sourceRootRef: 'ROOT-MUST-001',
        sourceRootPayloadHash: HASH_A,
        authorityClass: 'source_grounded',
      },
      {
        id: 'ORACLE-001',
        nodeType: 'oracle' as const,
        bodyHash: HASH_B,
        sourceRootRef: 'ROOT-ORACLE-001',
        sourceRootPayloadHash: HASH_B,
        authorityClass: 'source_grounded',
      },
    ],
    edges: [
      {
        edgeId: 'EDGE-001',
        edgeType: 'verified_by' as const,
        fromRef: 'MUST-FR-001',
        toRef: 'ORACLE-001',
        sourceRef: 'ROOT-MUST-001',
        sourceHash: HASH_A,
        proofRefs: ['PROOF-001'],
        applicability: 'applicable' as const,
      },
    ],
  };
}

describe('requirements contract Canonical Trace Graph', () => {
  it('accepts requirement-specific independent oracle edges', () => {
    const graph = createRequirementsContractNormalizedTraceGraph(graphInput());

    expect(
      validateRequirementsContractNormalizedTraceGraph(graph, {
        positiveRequirementIds: ['MUST-FR-001'],
      })
    ).toEqual({ ok: true, issues: [] });
    expect(graph.edgeCount).toBe(1);
    expect(graph.graphHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('rejects unknown endpoints and missing positive-requirement oracle coverage', () => {
    const invalid = graphInput();
    invalid.edges[0].toRef = 'ORACLE-404';

    expect(() => createRequirementsContractNormalizedTraceGraph(invalid)).toThrow(
      'trace_graph_unknown_endpoint:ORACLE-404'
    );

    const noEdges = createRequirementsContractNormalizedTraceGraph({
      ...graphInput(),
      edges: [],
    });
    expect(
      validateRequirementsContractNormalizedTraceGraph(noEdges, {
        positiveRequirementIds: ['MUST-FR-001'],
      }).issues
    ).toContain('trace_graph_independent_oracle_missing:MUST-FR-001');
  });

  it('rejects broad shared-oracle claims without explicit per-requirement edges', () => {
    const input = graphInput();
    input.nodes.splice(1, 0, {
      id: 'MUST-FR-002',
      nodeType: 'requirement',
      bodyHash: `sha256:${'c'.repeat(64)}`,
      sourceRootRef: 'ROOT-MUST-002',
      sourceRootPayloadHash: `sha256:${'c'.repeat(64)}`,
      authorityClass: 'source_grounded',
    });
    const graph = createRequirementsContractNormalizedTraceGraph(input);

    expect(
      validateRequirementsContractNormalizedTraceGraph(graph, {
        positiveRequirementIds: ['MUST-FR-001', 'MUST-FR-002'],
      }).issues
    ).toContain('trace_graph_independent_oracle_missing:MUST-FR-002');
  });
});
