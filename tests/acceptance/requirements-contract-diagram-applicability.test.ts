import { describe, expect, it } from 'vitest';
import { planRequirementsContractDiagramApplicability } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-diagram-applicability-planner';
import { resolveRequirementsContractProjectProfile } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-project-profile-resolver';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

let proofOrdinal = 0;

function nextProof(prefix: string): string {
  proofOrdinal += 1;
  return `${prefix}-${String(proofOrdinal).padStart(3, '0')}`;
}

function consumerProfile() {
  const authorityRef = nextProof('PROFILE-AUTHORITY');
  return resolveRequirementsContractProjectProfile({
    projectKind: 'consumer_product',
    owningSystem: nextProof('OWNING-SYSTEM'),
    governanceFramework: nextProof('GOVERNANCE-FRAMEWORK'),
    classificationAuthority: {
      kind: 'decision_receipt',
      ref: authorityRef,
      hash: sha256Stable({ authorityRef }),
    },
    diagramPolicyRegistryHash: sha256Stable({ authorityRef, registry: 'diagram-policy' }),
  });
}

describe('requirements contract diagram applicability planner', () => {
  it('requires the primary sequence from critical cross-participant proof and forbids consumer governance diagrams', () => {
    const resolved = consumerProfile();
    const primaryProof = nextProof('CRITICAL-INTERACTION');
    const securityProof = nextProof('SECURITY-FLOW');

    const result = planRequirementsContractDiagramApplicability({
      projectProfile: resolved.profile,
      projectProfileHash: resolved.projectProfileHash,
      viewEvidence: {
        primary_business_sequence: { proofRefs: [primaryProof] },
        data_security_flow: { proofRefs: [securityProof] },
      },
    });
    const byView = Object.fromEntries(
      result.decisions.map((decision) => [decision.view, decision])
    );

    expect(result.decisions).toHaveLength(7);
    expect(byView.primary_business_sequence).toMatchObject({
      applicability: 'required',
      proofRefs: [primaryProof],
    });
    expect(byView.data_security_flow).toMatchObject({
      applicability: 'required',
      proofRefs: [securityProof],
    });
    expect(byView.scope_boundary).toMatchObject({
      applicability: 'required',
      proofRefs: [resolved.profile.classificationAuthority.ref],
    });
    expect(byView.governance_flow).toMatchObject({
      applicability: 'forbidden',
      proofRefs: [resolved.profile.classificationAuthority.ref],
    });
    expect(
      result.decisions.filter((decision) => decision.applicability === 'not_applicable')
    ).toSatisfy((decisions: typeof result.decisions) =>
      decisions.every((decision) => decision.proofRefs.length > 0)
    );
  });

  it('records unresolved applicability instead of inventing a fallback diagram', () => {
    const resolved = consumerProfile();
    const unresolvedProof = nextProof('UNRESOLVED-STATE');
    const result = planRequirementsContractDiagramApplicability({
      projectProfile: resolved.profile,
      projectProfileHash: resolved.projectProfileHash,
      viewEvidence: {
        state_lifecycle: {
          proofRefs: [unresolvedProof],
          unresolved: true,
        },
      },
    });

    expect(
      result.decisions.find((decision) => decision.view === 'state_lifecycle')
    ).toMatchObject({
      applicability: 'unresolved',
      proofRefs: [unresolvedProof],
    });
    expect(result.decisions.some((decision) => decision.reasonCode === 'synthetic_fallback')).toBe(
      false
    );
  });
});
