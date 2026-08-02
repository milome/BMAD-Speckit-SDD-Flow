import { describe, expect, it } from 'vitest';
import {
  REQUIREMENTS_CONTRACT_TRACE_DIMENSIONS,
  REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY,
  requirementsContractTraceEdgeTypeRegistryHash,
  validateRequirementsContractTraceDimensions,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-trace-edge-type-registry';

describe('requirements contract trace edge type registry', () => {
  it('freezes every canonical graph edge type and dimension partition', () => {
    const edgeTypes = REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY.edgeTypes.map(
      (entry) => entry.edgeType
    );

    expect(edgeTypes).toEqual([
      'requires',
      'verified_by',
      'implemented_in',
      'produces',
      'bounded_by',
      'derived_from',
    ]);
    for (const entry of REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY.edgeTypes) {
      expect(
        [...entry.requiredDimensions, ...entry.notApplicableDimensions].sort()
      ).toEqual([...REQUIREMENTS_CONTRACT_TRACE_DIMENSIONS].sort());
      expect(
        entry.requiredDimensions.filter((dimension) =>
          entry.notApplicableDimensions.includes(dimension)
        )
      ).toEqual([]);
    }
    expect(requirementsContractTraceEdgeTypeRegistryHash()).toMatch(
      /^sha256:[a-f0-9]{64}$/u
    );
  });

  it('accepts required bindings plus proof-bound not-applicable dimensions', () => {
    const result = validateRequirementsContractTraceDimensions('verified_by', {
      scenario: { state: 'not_applicable', reasonCode: 'edge_type_dimension_not_required', proofRefs: ['PROOF-1'] },
      sequenceStep: { state: 'not_applicable', reasonCode: 'edge_type_dimension_not_required', proofRefs: ['PROOF-1'] },
      branch: { state: 'not_applicable', reasonCode: 'edge_type_dimension_not_required', proofRefs: ['PROOF-1'] },
      target: { state: 'not_applicable', reasonCode: 'edge_type_dimension_not_required', proofRefs: ['PROOF-1'] },
      task: { state: 'not_applicable', reasonCode: 'edge_type_dimension_not_required', proofRefs: ['PROOF-1'] },
      red: { state: 'bound', refs: ['RED-1'], proofRefs: ['PROOF-1'] },
      oracle: { state: 'bound', refs: ['ORACLE-1'], proofRefs: ['PROOF-1'] },
      command: { state: 'bound', refs: ['CMD-1'], proofRefs: ['PROOF-1'] },
      acceptance: { state: 'bound', refs: ['AC-1'], proofRefs: ['PROOF-1'] },
      evidenceRequirement: { state: 'bound', refs: ['EVD-1'], proofRefs: ['PROOF-1'] },
    });

    expect(result).toEqual({ ok: true, issues: [] });
  });

  it('rejects missing required bindings and unproved not-applicable dimensions', () => {
    const result = validateRequirementsContractTraceDimensions('implemented_in', {
      scenario: { state: 'not_applicable', reasonCode: 'edge_type_dimension_not_required', proofRefs: [] },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'trace_dimension_proof_missing:scenario',
        'trace_dimension_missing:target',
        'trace_dimension_missing:task',
      ])
    );
  });
});
