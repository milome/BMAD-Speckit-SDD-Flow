import {
  type RequirementsContractProjectKind,
  type RequirementsContractProjectProfile,
  validateRequirementsContractProjectProfile,
} from './requirements-contract-project-profile';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export interface ResolveRequirementsContractProjectProfileInput {
  projectKind: RequirementsContractProjectKind;
  owningSystem: string;
  governanceFramework: string;
  classificationAuthority: RequirementsContractProjectProfile['classificationAuthority'];
  diagramPolicyRegistryHash: string;
}

export interface ResolvedRequirementsContractProjectProfile {
  profile: RequirementsContractProjectProfile;
  projectProfileHash: string;
}

const AUTHORITY_KINDS = new Set<
  RequirementsContractProjectProfile['classificationAuthority']['kind']
>(['install_manifest', 'registered_architecture_record', 'decision_receipt']);

export function resolveRequirementsContractProjectProfile(
  input: ResolveRequirementsContractProjectProfileInput
): ResolvedRequirementsContractProjectProfile {
  if (!AUTHORITY_KINDS.has(input.classificationAuthority.kind)) {
    throw new Error('project_profile_authority_kind_invalid');
  }
  const profile: RequirementsContractProjectProfile = {
    schemaVersion: 'requirements-contract-project-profile/v1',
    projectKind: input.projectKind,
    owningSystem: input.owningSystem,
    governanceFramework: input.governanceFramework,
    classificationAuthority: structuredClone(input.classificationAuthority),
    diagramPolicyRegistryHash: input.diagramPolicyRegistryHash,
  };
  const validation = validateRequirementsContractProjectProfile(profile);
  if (!validation.ok) {
    throw new Error(
      `project_profile_invalid:${validation.issues.map((issue) => issue.code).join(',')}`
    );
  }
  return {
    profile,
    projectProfileHash: sha256Stable(profile),
  };
}
