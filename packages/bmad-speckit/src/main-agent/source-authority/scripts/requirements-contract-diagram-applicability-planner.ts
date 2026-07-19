import {
  REQUIREMENTS_CONTRACT_DIAGRAM_POLICY,
  type RequirementsContractDiagramApplicability,
  type RequirementsContractDiagramView,
  type RequirementsContractProjectProfile,
  validateDiagramApplicability,
  validateRequirementsContractProjectProfile,
} from './requirements-contract-project-profile';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export interface RequirementsContractDiagramViewEvidence {
  proofRefs: string[];
  unresolved?: boolean;
}

export interface PlanRequirementsContractDiagramApplicabilityInput {
  projectProfile: RequirementsContractProjectProfile;
  projectProfileHash: string;
  viewEvidence?: Partial<
    Record<RequirementsContractDiagramView, RequirementsContractDiagramViewEvidence>
  >;
}

const DIAGRAM_VIEWS: RequirementsContractDiagramView[] =
  REQUIREMENTS_CONTRACT_DIAGRAM_POLICY.views.map(({ view }) => view);

function uniqueProofRefs(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function planRequirementsContractDiagramApplicability(
  input: PlanRequirementsContractDiagramApplicabilityInput
): RequirementsContractDiagramApplicability {
  const profileValidation = validateRequirementsContractProjectProfile(input.projectProfile);
  if (!profileValidation.ok) throw new Error('diagram_project_profile_invalid');
  if (sha256Stable(input.projectProfile) !== input.projectProfileHash) {
    throw new Error('diagram_project_profile_hash_mismatch');
  }

  const authorityProof = input.projectProfile.classificationAuthority.ref;
  const decisions = DIAGRAM_VIEWS.map((view) => {
    const evidence = input.viewEvidence?.[view];
    const proofRefs = uniqueProofRefs(evidence?.proofRefs ?? []);
    if (evidence?.unresolved === true && proofRefs.length === 0) {
      throw new Error(`diagram_applicability_proof_required:${view}`);
    }
    if (
      view === 'governance_flow' &&
      input.projectProfile.projectKind === 'consumer_product'
    ) {
      return {
        view,
        applicability: 'forbidden' as const,
        reasonCode: 'consumer_product_governance_flow_forbidden',
        proofRefs: [authorityProof],
      };
    }
    if (evidence?.unresolved === true) {
      return {
        view,
        applicability: 'unresolved' as const,
        reasonCode: 'applicability_requires_decision',
        proofRefs,
      };
    }
    if (proofRefs.length > 0) {
      return {
        view,
        applicability: 'required' as const,
        reasonCode:
          view === 'primary_business_sequence'
            ? 'critical_cross_participant_interaction'
            : 'authorized_view_evidence_present',
        proofRefs,
      };
    }
    if (view === 'scope_boundary') {
      return {
        view,
        applicability: 'required' as const,
        reasonCode: 'project_scope_boundary_required',
        proofRefs: [authorityProof],
      };
    }
    return {
      view,
      applicability: 'not_applicable' as const,
      reasonCode: 'no_authorized_view_semantics',
      proofRefs: [authorityProof],
    };
  });

  const result: RequirementsContractDiagramApplicability = {
    schemaVersion: 'requirements-contract-diagram-applicability/v1',
    projectProfileHash: input.projectProfileHash,
    decisions,
  };
  const validation = validateDiagramApplicability(result, input.projectProfile);
  if (!validation.ok) {
    throw new Error(
      `diagram_applicability_invalid:${validation.issues.map((issue) => issue.code).join(',')}`
    );
  }
  return result;
}
