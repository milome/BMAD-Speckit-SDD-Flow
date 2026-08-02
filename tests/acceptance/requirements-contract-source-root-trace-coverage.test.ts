import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractNormalizedTraceGraph,
  validateRequirementsContractSourceRootTraceCoverage,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-trace-graph';

const HASH_A = `sha256:${'3'.repeat(64)}`;
const HASH_B = `sha256:${'4'.repeat(64)}`;

function graph() {
  return createRequirementsContractNormalizedTraceGraph({
    requirementSetId: 'coverage',
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
      {
        id: 'NEG-001',
        nodeType: 'negative_requirement',
        bodyHash: HASH_B,
        sourceRootRef: 'ROOT-NEG-001',
        sourceRootPayloadHash: HASH_B,
        authorityClass: 'source_grounded',
      },
    ],
    edges: [],
  });
}

describe('requirements contract Source Root trace coverage', () => {
  it('accepts exact Source Root payload and authority bindings', () => {
    expect(
      validateRequirementsContractSourceRootTraceCoverage({
        graph: graph(),
        sourceRoots: [
          {
            sourceRootId: 'ROOT-MUST-001',
            payloadHash: HASH_A,
            authorityClass: 'source_grounded',
          },
          {
            sourceRootId: 'ROOT-NEG-001',
            payloadHash: HASH_B,
            authorityClass: 'source_grounded',
          },
        ],
      })
    ).toEqual({ ok: true, issues: [] });
  });

  it('detects omitted roots, payload drift, and authority drift', () => {
    const result = validateRequirementsContractSourceRootTraceCoverage({
      graph: graph(),
      sourceRoots: [
        {
          sourceRootId: 'ROOT-MUST-001',
          payloadHash: HASH_B,
          authorityClass: 'decision_grounded',
        },
        {
          sourceRootId: 'ROOT-ACCEPTANCE-001',
          payloadHash: HASH_A,
          authorityClass: 'source_grounded',
        },
      ],
    });

    expect(result.issues).toEqual(
      expect.arrayContaining([
        'source_root_payload_mismatch:ROOT-MUST-001',
        'source_root_authority_mismatch:ROOT-MUST-001',
        'source_root_trace_missing:ROOT-ACCEPTANCE-001',
        'trace_source_root_missing:ROOT-NEG-001',
      ])
    );
  });
});
