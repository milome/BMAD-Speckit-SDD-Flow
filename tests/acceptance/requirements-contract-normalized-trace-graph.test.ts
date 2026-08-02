import { describe, expect, it } from 'vitest';
import { createRequirementsContractNormalizedTraceGraph } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-trace-graph';

const HASH_A = `sha256:${'1'.repeat(64)}`;
const HASH_B = `sha256:${'2'.repeat(64)}`;

describe('requirements contract normalized trace graph', () => {
  it('stores semantic bodies by hash reference without copied bodies', () => {
    const graph = createRequirementsContractNormalizedTraceGraph({
      requirementSetId: 'order-flow',
      sourceAuthorityHash: HASH_A,
      semanticModelHash: HASH_B,
      semanticConservationManifestHash: HASH_A,
      nodes: [
        {
          id: 'MUST-FR-001',
          nodeType: 'requirement',
          bodyHash: HASH_A,
          sourceRootRef: 'ROOT-MUST-001',
          sourceRootPayloadHash: HASH_A,
          authorityClass: 'source_grounded',
        },
      ],
      edges: [],
    });

    expect(graph.nodes['MUST-FR-001']).toEqual({
      id: 'MUST-FR-001',
      nodeType: 'requirement',
      bodyHash: HASH_A,
      sourceRootRef: 'ROOT-MUST-001',
      sourceRootPayloadHash: HASH_A,
      authorityClass: 'source_grounded',
    });
    expect(graph).not.toHaveProperty('semanticBodies');
  });

  it('rejects duplicate IDs, duplicate body ownership, and copied semantic fields', () => {
    const node = {
      id: 'MUST-FR-001',
      nodeType: 'requirement' as const,
      bodyHash: HASH_A,
      sourceRootRef: 'ROOT-MUST-001',
      sourceRootPayloadHash: HASH_A,
      authorityClass: 'source_grounded',
    };

    expect(() =>
      createRequirementsContractNormalizedTraceGraph({
        requirementSetId: 'order-flow',
        sourceAuthorityHash: HASH_A,
        semanticModelHash: HASH_B,
        semanticConservationManifestHash: HASH_A,
        nodes: [node, node],
        edges: [],
      })
    ).toThrow('trace_graph_duplicate_node_id:MUST-FR-001');
    expect(() =>
      createRequirementsContractNormalizedTraceGraph({
        requirementSetId: 'order-flow',
        sourceAuthorityHash: HASH_A,
        semanticModelHash: HASH_B,
        semanticConservationManifestHash: HASH_A,
        nodes: [
          node,
          {
            ...node,
            id: 'MUST-FR-002',
            sourceRootRef: 'ROOT-MUST-002',
          },
        ],
        edges: [],
      })
    ).toThrow(`trace_graph_duplicate_body_hash:${HASH_A}`);
    expect(() =>
      createRequirementsContractNormalizedTraceGraph({
        requirementSetId: 'order-flow',
        sourceAuthorityHash: HASH_A,
        semanticModelHash: HASH_B,
        semanticConservationManifestHash: HASH_A,
        nodes: [{ ...node, text: 'copied body' } as never],
        edges: [],
      })
    ).toThrow('trace_graph_node_shape_invalid:MUST-FR-001');
  });
});
