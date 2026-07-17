export type RequirementsContractArtifactRole =
  | 'product_prd'
  | 'requirement_source_prd'
  | 'discovery_envelope';

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
  activationState: 'inactive_schema_boundary';
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

const ARTIFACT_ROLES = new Set<RequirementsContractArtifactRole>([
  'product_prd',
  'requirement_source_prd',
  'discovery_envelope',
]);
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

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
  if (role === 'product_prd') {
    return {
      authorityClass: 'product_background',
      rendererRef: 'registered_product_prd_renderer',
      implementationConfirmationPolicy: 'forbidden',
      stableRequirementSetIdPolicy: 'not_required',
      requirementRecordRegistrationPolicy: 'forbidden',
      finalImplementationAuthority: 'none',
    };
  }
  if (role === 'requirement_source_prd') {
    return {
      authorityClass: 'implementation_semantic_authority',
      rendererRef: 'canonical_source_prd_renderer',
      implementationConfirmationPolicy: 'required',
      stableRequirementSetIdPolicy: 'required',
      requirementRecordRegistrationPolicy: 'required',
      finalImplementationAuthority: 'source_authority',
    };
  }
  return {
    authorityClass: 'none',
    rendererRef: 'discovery_envelope_renderer',
    implementationConfirmationPolicy: 'forbidden',
    stableRequirementSetIdPolicy: 'not_required',
    requirementRecordRegistrationPolicy: 'forbidden',
    finalImplementationAuthority: 'none',
  };
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
      activationState: 'inactive_schema_boundary',
      artifactRole: selectedRole,
      classificationAuthority: { sources },
      outputPolicy: outputPolicy(selectedRole),
      decision: 'classified',
    },
    issues: [],
  };
}
