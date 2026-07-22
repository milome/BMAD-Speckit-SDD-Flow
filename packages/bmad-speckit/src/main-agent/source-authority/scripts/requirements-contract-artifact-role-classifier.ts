import { sha256Stable } from './requirements-contract-semantic-resolver';

export type RequirementsContractArtifactRole =
  | 'product_prd'
  | 'requirement_source_prd'
  | 'discovery_envelope';

export const REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-artifact-role-classifier.ts';

export type ArtifactRoleAuthoritySource =
  | {
      kind: 'explicit_request';
      artifactRole: RequirementsContractArtifactRole;
    }
  | {
      kind: 'registered_workflow';
      artifactRole: RequirementsContractArtifactRole;
      ref: string;
      hash: string;
    }
  | {
      kind: 'decision_receipt';
      artifactRole: RequirementsContractArtifactRole;
      ref: string;
      hash: string;
    };

export interface ArtifactRoleClassification {
  schemaVersion: 'requirements-contract-artifact-role/v1';
  activationState: 'active_production_authority';
  artifactRole: RequirementsContractArtifactRole;
  classificationAuthority: {
    sources: ArtifactRoleAuthoritySource[];
  };
  outputPolicy: {
    authorityClass: 'product_background' | 'implementation_semantic_authority' | 'none';
    rendererRef:
      | 'registered_product_prd_renderer'
      | 'canonical_source_prd_renderer'
      | 'discovery_envelope_renderer';
    implementationConfirmationPolicy: 'required' | 'forbidden';
    stableRequirementSetIdPolicy: 'required' | 'not_required';
    requirementRecordRegistrationPolicy: 'required' | 'forbidden';
    finalImplementationAuthority: 'source_authority' | 'none';
  };
  decision: 'classified';
}

export interface ArtifactRoleClassificationIssue {
  code:
    | 'artifact_role_authority_missing'
    | 'artifact_role_authority_invalid'
    | 'artifact_role_authority_conflict'
    | 'artifact_role_invalid';
  path: string;
  message: string;
}

export interface ArtifactRoleClassificationInput {
  requestedArtifactRole?: unknown;
  registeredWorkflowAuthority?: {
    artifactRole?: unknown;
    ref?: unknown;
    hash?: unknown;
  };
  decisionReceiptAuthority?: {
    artifactRole?: unknown;
    ref?: unknown;
    hash?: unknown;
  };
  heuristicSignals?: unknown;
}

export interface ArtifactRoleClassificationResult {
  ok: boolean;
  classification?: ArtifactRoleClassification;
  issues: ArtifactRoleClassificationIssue[];
}

export const REQUIREMENTS_CONTRACT_ARTIFACT_ROLES = [
  'product_prd',
  'requirement_source_prd',
  'discovery_envelope',
] as const satisfies readonly RequirementsContractArtifactRole[];
export const REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_AUTHORITY_SOURCES = [
  'explicit_request',
  'registered_workflow',
  'decision_receipt',
] as const;
const ARTIFACT_ROLE_POLICIES = {
  product_prd: {
    authorityClass: 'product_background',
    rendererRef: 'registered_product_prd_renderer',
    implementationConfirmationPolicy: 'forbidden',
    stableRequirementSetIdPolicy: 'not_required',
    requirementRecordRegistrationPolicy: 'forbidden',
    finalImplementationAuthority: 'none',
  },
  requirement_source_prd: {
    authorityClass: 'implementation_semantic_authority',
    rendererRef: 'canonical_source_prd_renderer',
    implementationConfirmationPolicy: 'required',
    stableRequirementSetIdPolicy: 'required',
    requirementRecordRegistrationPolicy: 'required',
    finalImplementationAuthority: 'source_authority',
  },
  discovery_envelope: {
    authorityClass: 'none',
    rendererRef: 'discovery_envelope_renderer',
    implementationConfirmationPolicy: 'forbidden',
    stableRequirementSetIdPolicy: 'not_required',
    requirementRecordRegistrationPolicy: 'forbidden',
    finalImplementationAuthority: 'none',
  },
} as const satisfies Record<
  RequirementsContractArtifactRole,
  ArtifactRoleClassification['outputPolicy']
>;
const ARTIFACT_ROLES = new Set<RequirementsContractArtifactRole>(
  REQUIREMENTS_CONTRACT_ARTIFACT_ROLES
);
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export const REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY = {
  schemaVersion: 'requirements-contract-artifact-role-registry/v1',
  classificationSchemaVersion: 'requirements-contract-artifact-role/v1',
  allowedRoles: REQUIREMENTS_CONTRACT_ARTIFACT_ROLES,
  allowedAuthoritySources: REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_AUTHORITY_SOURCES,
  rolePolicies: ARTIFACT_ROLE_POLICIES,
  applicabilityRules: {
    authoritySelection:
      'explicit_request_or_registered_workflow_or_decision_receipt',
    authorityAgreement: 'all_authorities_must_select_one_role',
    heuristicSignals: 'non_authoritative',
  },
  authority: 'none',
} as const;

export function requirementsContractArtifactRoleRegistryHash(): string {
  return sha256Stable(REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY);
}

export function createRequirementsContractArtifactRoleRegistryProjection(
  ownerHash: string
) {
  if (!SHA256_PATTERN.test(ownerHash)) {
    throw new Error('artifact_role_registry_owner_hash_invalid');
  }
  return {
    schemaVersion: REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.schemaVersion,
    owner: {
      path: REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY_OWNER_PATH,
      hash: ownerHash,
    },
    registryHash: requirementsContractArtifactRoleRegistryHash(),
    classificationSchemaVersion:
      REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.classificationSchemaVersion,
    allowedRoles: [
      ...REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.allowedRoles,
    ],
    allowedAuthoritySources: [
      ...REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.allowedAuthoritySources,
    ],
    rolePolicies: Object.fromEntries(
      REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.allowedRoles.map((role) => [
        role,
        { ...REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.rolePolicies[role] },
      ])
    ),
    applicabilityRules: {
      ...REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.applicabilityRules,
    },
    authority: REQUIREMENTS_CONTRACT_ARTIFACT_ROLE_REGISTRY.authority,
  };
}

function artifactRole(value: unknown): RequirementsContractArtifactRole | null {
  return typeof value === 'string' && ARTIFACT_ROLES.has(value as RequirementsContractArtifactRole)
    ? (value as RequirementsContractArtifactRole)
    : null;
}

function authorityRef(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function authorityHash(value: unknown): string | null {
  return typeof value === 'string' && SHA256_PATTERN.test(value) ? value : null;
}

function outputPolicy(
  role: RequirementsContractArtifactRole
): ArtifactRoleClassification['outputPolicy'] {
  return { ...ARTIFACT_ROLE_POLICIES[role] };
}

export function classifyRequirementsContractArtifactRole(
  input: ArtifactRoleClassificationInput
): ArtifactRoleClassificationResult {
  const issues: ArtifactRoleClassificationIssue[] = [];
  const sources: ArtifactRoleAuthoritySource[] = [];

  if (input.requestedArtifactRole !== undefined) {
    const role = artifactRole(input.requestedArtifactRole);
    if (role) {
      sources.push({ kind: 'explicit_request', artifactRole: role });
    } else {
      issues.push({
        code: 'artifact_role_invalid',
        path: '/requestedArtifactRole',
        message: 'requested artifact role is not registered',
      });
    }
  }

  for (const [key, kind] of [
    ['registeredWorkflowAuthority', 'registered_workflow'],
    ['decisionReceiptAuthority', 'decision_receipt'],
  ] as const) {
    const authority = input[key];
    if (!authority) continue;
    const role = artifactRole(authority.artifactRole);
    const ref = authorityRef(authority.ref);
    const hash = authorityHash(authority.hash);
    if (!role) {
      issues.push({
        code: 'artifact_role_invalid',
        path: `/${key}/artifactRole`,
        message: 'authority artifact role is not registered',
      });
      continue;
    }
    if (!ref || !hash) {
      issues.push({
        code: 'artifact_role_authority_invalid',
        path: `/${key}`,
        message: 'authority requires a non-empty ref and SHA256 hash',
      });
      continue;
    }
    sources.push({ kind, artifactRole: role, ref, hash });
  }

  if (sources.length === 0 && issues.length === 0) {
    issues.push({
      code: 'artifact_role_authority_missing',
      path: '/',
      message:
        'artifact role requires explicit request, registered workflow, or Decision Receipt authority',
    });
  }

  const selectedRoles = new Set(sources.map((source) => source.artifactRole));
  if (selectedRoles.size > 1) {
    issues.push({
      code: 'artifact_role_authority_conflict',
      path: '/classificationAuthority',
      message: 'artifact-role authorities select conflicting roles',
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  const selectedRole = sources[0].artifactRole;
  return {
    ok: true,
    classification: {
      schemaVersion: 'requirements-contract-artifact-role/v1',
      activationState: 'active_production_authority',
      artifactRole: selectedRole,
      classificationAuthority: { sources },
      outputPolicy: outputPolicy(selectedRole),
      decision: 'classified',
    },
    issues: [],
  };
}
