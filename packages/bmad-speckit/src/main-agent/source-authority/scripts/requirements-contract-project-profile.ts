import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export type RequirementSourceIdentityAuthorityKind =
  | 'registered_requirement_record'
  | 'source_prd_identity_block'
  | 'discovery_session_receipt'
  | 'legacy_migration_receipt';

export interface RequirementSourceIdentity {
  schemaVersion: 'requirements-contract-source-identity/v1';
  recordId: string;
  requirementSetId: string;
  branch: string;
  entrySource: string;
  sourceKind: 'product_prd' | 'requirement_source_prd' | 'discovery_envelope';
  sourcePath: string;
  sourceHash: string;
  identityAuthority: {
    kind: RequirementSourceIdentityAuthorityKind;
    ref: string;
    hash: string;
  };
}

export type RequirementsContractProjectKind =
  | 'consumer_product'
  | 'governance_framework'
  | 'hybrid';

export const REQUIREMENTS_CONTRACT_PROJECT_KINDS: readonly RequirementsContractProjectKind[] =
  ['consumer_product', 'governance_framework', 'hybrid'];

export type RequirementsContractProjectClassificationAuthorityKind =
  | 'install_manifest'
  | 'registered_architecture_record'
  | 'decision_receipt';

export const REQUIREMENTS_CONTRACT_PROJECT_CLASSIFICATION_AUTHORITY_KINDS: readonly RequirementsContractProjectClassificationAuthorityKind[] =
  ['install_manifest', 'registered_architecture_record', 'decision_receipt'];

export interface RequirementsContractProjectProfile {
  schemaVersion: 'requirements-contract-project-profile/v1';
  projectKind: RequirementsContractProjectKind;
  owningSystem: string;
  governanceFramework: string;
  classificationAuthority: {
    kind: RequirementsContractProjectClassificationAuthorityKind;
    ref: string;
    hash: string;
  };
  diagramPolicyRegistryHash: string;
}

export type RequirementsContractDiagramView =
  | 'primary_business_sequence'
  | 'failure_compensation_sequence'
  | 'state_lifecycle'
  | 'deployment_delta'
  | 'data_security_flow'
  | 'scope_boundary'
  | 'governance_flow';

export const REQUIREMENTS_CONTRACT_DIAGRAM_POLICY = {
  sequenceFirst: true,
  views: [
    {
      view: 'primary_business_sequence',
      consumerProductPolicy: 'required_when_critical_interaction',
    },
    {
      view: 'failure_compensation_sequence',
      consumerProductPolicy: 'required_when_failure_or_compensation_semantics',
    },
    {
      view: 'state_lifecycle',
      consumerProductPolicy: 'required_when_authorized_state_transition',
    },
    {
      view: 'deployment_delta',
      consumerProductPolicy: 'required_when_deployment_semantics_change',
    },
    {
      view: 'data_security_flow',
      consumerProductPolicy: 'required_when_data_or_security_semantics_change',
    },
    {
      view: 'scope_boundary',
      consumerProductPolicy: 'table_unless_decision_receipt',
    },
    {
      view: 'governance_flow',
      consumerProductPolicy: 'forbidden',
    },
  ] as const satisfies ReadonlyArray<{
    view: RequirementsContractDiagramView;
    consumerProductPolicy: string;
  }>,
  readability: {
    minFontPx: 14,
    minParticipantGapPx: 24,
    minMessageRowHeightPx: 28,
    scale: 1,
  },
  decomposition: {
    maxParticipants: 8,
    maxMessages: 25,
    maxControlBlocks: 5,
  },
  syntheticFallbackAllowed: false,
} as const;

export const REQUIREMENTS_CONTRACT_PROJECT_PROFILE_COMPONENT_ROLES = [
  'project_profile_schema',
  'project_profile_resolver',
  'diagram_applicability_schema',
  'diagram_applicability_planner',
  'sequence_contract_schema',
  'sequence_compiler',
  'diagram_set_schema',
  'diagram_set_planner',
  'mermaid_projection',
  'sequence_trace_compiler',
  'deployment_model_schema',
  'deployment_delta_schema',
  'deployment_model',
  'deployment_delta',
  'observed_sequence_producer',
  'validation_facade',
] as const;

export interface RequirementsContractDiagramApplicability {
  schemaVersion: 'requirements-contract-diagram-applicability/v1';
  projectProfileHash: string;
  decisions: Array<{
    view: RequirementsContractDiagramView;
    applicability: 'required' | 'not_applicable' | 'unresolved' | 'forbidden';
    reasonCode: string;
    proofRefs: string[];
  }>;
}

export interface RequirementsContractProfileIssue {
  code:
    | 'schema_validation_failed'
    | 'basename_derived_identity'
    | 'duplicate_requirement_set_identity'
    | 'source_path_collision'
    | 'multiple_authoritative_source_paths'
    | 'invalid_project_kind'
    | 'unauthorized_project_classification'
    | 'missing_owning_system'
    | 'missing_diagram_view_decision'
    | 'duplicate_diagram_view_decision'
    | 'consumer_governance_flow_forbidden';
  path: string;
  message: string;
}

export interface RequirementsContractProfileValidationResult {
  ok: boolean;
  issues: RequirementsContractProfileIssue[];
}

const SOURCE_IDENTITY_AUTHORITY_KINDS = new Set<RequirementSourceIdentityAuthorityKind>([
  'registered_requirement_record',
  'source_prd_identity_block',
  'discovery_session_receipt',
  'legacy_migration_receipt',
]);
const PROJECT_KINDS = new Set<RequirementsContractProjectKind>(
  REQUIREMENTS_CONTRACT_PROJECT_KINDS
);
const PROJECT_CLASSIFICATION_AUTHORITY_KINDS =
  new Set<RequirementsContractProjectClassificationAuthorityKind>(
    REQUIREMENTS_CONTRACT_PROJECT_CLASSIFICATION_AUTHORITY_KINDS
  );
const DIAGRAM_VIEWS: RequirementsContractDiagramView[] =
  REQUIREMENTS_CONTRACT_DIAGRAM_POLICY.views.map(({ view }) => view);

function schemaPath(fileName: string): string {
  const candidates = [
    path.resolve(
      process.cwd(),
      'packages',
      'bmad-speckit',
      'src',
      'main-agent',
      'source-authority',
      'schemas',
      fileName
    ),
    path.resolve(__dirname, '..', 'schemas', fileName),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function schemaIssues(fileName: string, candidate: unknown): RequirementsContractProfileIssue[] {
  const schema = JSON.parse(readFileSync(schemaPath(fileName), 'utf8')) as Record<string, unknown>;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (validate(candidate)) return [];
  return (validate.errors ?? []).map((error) => ({
    code: 'schema_validation_failed' as const,
    path: error.instancePath || '/',
    message: error.message ?? 'schema validation failed',
  }));
}

function addIssue(
  issues: RequirementsContractProfileIssue[],
  code: RequirementsContractProfileIssue['code'],
  issuePath: string,
  message: string
): void {
  if (issues.some((issue) => issue.code === code && issue.path === issuePath)) return;
  issues.push({ code, path: issuePath, message });
}

function recordValue(candidate: unknown): Record<string, unknown> | null {
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : null;
}

export function validateRequirementSourceIdentity(
  candidate: unknown
): RequirementsContractProfileValidationResult {
  const issues = schemaIssues('requirements-contract-source-identity.schema.json', candidate);
  const value = recordValue(candidate);
  const authority = recordValue(value?.identityAuthority);
  if (
    typeof authority?.kind === 'string' &&
    !SOURCE_IDENTITY_AUTHORITY_KINDS.has(authority.kind as RequirementSourceIdentityAuthorityKind)
  ) {
    addIssue(
      issues,
      'basename_derived_identity',
      '/identityAuthority/kind',
      `identity authority cannot derive from ${authority.kind}`
    );
  }
  return { ok: issues.length === 0, issues };
}

export function validateRequirementSourceIdentitySet(
  candidates: unknown[]
): RequirementsContractProfileValidationResult {
  const issues: RequirementsContractProfileIssue[] = [];
  const requirementSets = new Map<string, { index: number; sourcePath: string }>();
  const sourcePaths = new Map<string, { index: number; requirementSetId: string }>();

  candidates.forEach((candidate, index) => {
    for (const issue of validateRequirementSourceIdentity(candidate).issues) {
      addIssue(issues, issue.code, `/identities/${index}${issue.path}`, issue.message);
    }
    const value = recordValue(candidate);
    if (!value) return;
    const requirementSetId =
      typeof value.requirementSetId === 'string' ? value.requirementSetId : '';
    const sourcePathValue = typeof value.sourcePath === 'string' ? value.sourcePath : '';
    if (requirementSetId) {
      const existing = requirementSets.get(requirementSetId);
      if (existing) {
        addIssue(
          issues,
          'duplicate_requirement_set_identity',
          `/identities/${index}/requirementSetId`,
          `requirementSetId already exists at index ${existing.index}: ${requirementSetId}`
        );
        if (existing.sourcePath !== sourcePathValue) {
          addIssue(
            issues,
            'multiple_authoritative_source_paths',
            `/identities/${index}/sourcePath`,
            `requirementSetId resolves more than one authoritative source path: ${requirementSetId}`
          );
        }
      } else {
        requirementSets.set(requirementSetId, { index, sourcePath: sourcePathValue });
      }
    }
    if (sourcePathValue) {
      const existing = sourcePaths.get(sourcePathValue);
      if (existing && existing.requirementSetId !== requirementSetId) {
        addIssue(
          issues,
          'source_path_collision',
          `/identities/${index}/sourcePath`,
          `source path already belongs to ${existing.requirementSetId} at index ${existing.index}`
        );
      } else if (!existing) {
        sourcePaths.set(sourcePathValue, { index, requirementSetId });
      }
    }
  });

  return { ok: issues.length === 0, issues };
}

export function validateRequirementsContractProjectProfile(
  candidate: unknown
): RequirementsContractProfileValidationResult {
  const issues = schemaIssues('requirements-contract-project-profile.schema.json', candidate);
  const value = recordValue(candidate);
  if (typeof value?.projectKind === 'string' && !PROJECT_KINDS.has(value.projectKind as never)) {
    addIssue(
      issues,
      'invalid_project_kind',
      '/projectKind',
      `unsupported project kind: ${value.projectKind}`
    );
  }
  if (typeof value?.owningSystem === 'string' && value.owningSystem.trim() === '') {
    addIssue(issues, 'missing_owning_system', '/owningSystem', 'owningSystem cannot be empty');
  }
  const authority = recordValue(value?.classificationAuthority);
  if (
    typeof authority?.kind === 'string' &&
    !PROJECT_CLASSIFICATION_AUTHORITY_KINDS.has(authority.kind)
  ) {
    addIssue(
      issues,
      'unauthorized_project_classification',
      '/classificationAuthority/kind',
      `project classification cannot derive from ${authority.kind}`
    );
  }
  return { ok: issues.length === 0, issues };
}

export function validateDiagramApplicability(
  candidate: unknown,
  projectProfile: RequirementsContractProjectProfile
): RequirementsContractProfileValidationResult {
  const issues = schemaIssues('requirements-contract-diagram-applicability.schema.json', candidate);
  const value = recordValue(candidate);
  const decisions = Array.isArray(value?.decisions) ? value.decisions : [];
  const counts = new Map<string, number>();
  decisions.forEach((decision) => {
    const item = recordValue(decision);
    if (typeof item?.view !== 'string') return;
    counts.set(item.view, (counts.get(item.view) ?? 0) + 1);
    if (
      projectProfile.projectKind === 'consumer_product' &&
      item.view === 'governance_flow' &&
      item.applicability !== 'forbidden'
    ) {
      addIssue(
        issues,
        'consumer_governance_flow_forbidden',
        '/decisions/governance_flow',
        'consumer_product must forbid the governance flow view'
      );
    }
  });
  for (const view of DIAGRAM_VIEWS) {
    const count = counts.get(view) ?? 0;
    if (count === 0) {
      addIssue(
        issues,
        'missing_diagram_view_decision',
        `/decisions/${view}`,
        `diagram applicability decision is missing for ${view}`
      );
    } else if (count > 1) {
      addIssue(
        issues,
        'duplicate_diagram_view_decision',
        `/decisions/${view}`,
        `diagram applicability decision is duplicated for ${view}`
      );
    }
  }
  return { ok: issues.length === 0, issues };
}
