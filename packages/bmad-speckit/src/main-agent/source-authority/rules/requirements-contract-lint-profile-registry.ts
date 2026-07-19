import {
  type RequirementsConfirmationRenderInput,
  validateRequirementsConfirmationRenderInput,
} from '../scripts/requirements-contract-confirmation-render-input';
import { sha256Stable } from '../scripts/requirements-contract-semantic-resolver';

export const REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/rules/requirements-contract-lint-profile-registry.ts';

export const REQUIREMENTS_CONTRACT_LINT_PROFILES = [
  'draft',
  'confirmation-ready',
] as const;
export type RequirementsContractLintProfile =
  (typeof REQUIREMENTS_CONTRACT_LINT_PROFILES)[number];
export const REQUIREMENTS_CONTRACT_LINT_PROFILE_CORE_RULE_REFS = [
  'allowBlockingUnresolved',
  'requireZeroSyntheticFields',
  'requireValidAuthority',
  'requireCompleteRenderCoverage',
] as const;
export const REQUIREMENTS_CONTRACT_LINT_PROFILE_ADDITIVE_RULE_REFS = [
  'all_core_rules_required',
  'core_profiles_immutable',
  'additive_profiles_must_not_weaken_core',
  'additive_profiles_must_not_duplicate_core',
] as const;

export interface RequirementsContractLintProfileResult {
  decision: 'pass' | 'block';
  profile: RequirementsContractLintProfile;
  issueCodes: string[];
  metrics: {
    blockingUnresolvedCount: number;
    syntheticFieldCount: number;
    authorityInvalidCount: number;
    coveredFieldCount: number;
    requiredRenderFieldCount: number;
  };
}

export const REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY = {
  draft: {
    allowBlockingUnresolved: true,
    requireZeroSyntheticFields: true,
    requireValidAuthority: true,
    requireCompleteRenderCoverage: true,
  },
  'confirmation-ready': {
    allowBlockingUnresolved: false,
    requireZeroSyntheticFields: true,
    requireValidAuthority: true,
    requireCompleteRenderCoverage: true,
  },
} as const;

export const REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY_HASH = sha256Stable(
  REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY
);

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export function createRequirementsContractLintProfileRegistryProjection(
  ownerHash: string
) {
  if (!SHA256_PATTERN.test(ownerHash)) {
    throw new Error('lint_profile_registry_owner_hash_invalid');
  }
  return {
    schemaVersion: 'requirements-contract-lint-profile-registry/v1',
    owner: {
      path: REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY_OWNER_PATH,
      hash: ownerHash,
    },
    registryHash: REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY_HASH,
    profiles: REQUIREMENTS_CONTRACT_LINT_PROFILES.map((profile) => ({
      profile,
      policy: {
        ...REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY[profile],
      },
    })),
    immutableCoreRuleRefs: [
      ...REQUIREMENTS_CONTRACT_LINT_PROFILE_CORE_RULE_REFS,
    ],
    additiveProfileRuleRefs: [
      ...REQUIREMENTS_CONTRACT_LINT_PROFILE_ADDITIVE_RULE_REFS,
    ],
    applicabilityRules: {
      profileSelection: 'explicit_registered_profile_required',
      unknownProfile: 'block',
      additiveProfiles:
        'allowed_only_without_core_weakening_or_duplication',
    },
    authority: 'none',
  };
}

export interface RequirementsContractLintProfileRegistryValidationResult {
  decision: 'pass' | 'block';
  issueCodes: string[];
  registryHash: string;
}

export function validateRequirementsContractLintProfileRegistry(
  candidate: unknown
): RequirementsContractLintProfileRegistryValidationResult {
  const issueCodes: string[] = [];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return {
      decision: 'block',
      issueCodes: ['lint_profile_registry_invalid'],
      registryHash: sha256Stable(candidate),
    };
  }
  const registry = candidate as Record<string, unknown>;
  for (const [profile, expectedPolicy] of Object.entries(
    REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY
  )) {
    const policy = registry[profile];
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
      issueCodes.push(`core_profile_missing:${profile}`);
      continue;
    }
    const values = policy as Record<string, unknown>;
    for (const rule of REQUIREMENTS_CONTRACT_LINT_PROFILE_CORE_RULE_REFS) {
      if (!(rule in values)) {
        issueCodes.push(`core_rule_missing:${profile}:${rule}`);
      } else if (values[rule] !== expectedPolicy[rule]) {
        issueCodes.push(`core_rule_changed:${profile}:${rule}`);
      }
    }
    for (const key of Object.keys(values)) {
      if (
        !REQUIREMENTS_CONTRACT_LINT_PROFILE_CORE_RULE_REFS.includes(
          key as (typeof REQUIREMENTS_CONTRACT_LINT_PROFILE_CORE_RULE_REFS)[number]
        )
      ) {
        issueCodes.push(`core_rule_unknown:${profile}:${key}`);
      }
    }
  }
  const corePolicies = Object.values(REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY);
  for (const [profile, policy] of Object.entries(registry)) {
    if (profile in REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY) continue;
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
      issueCodes.push(`additive_profile_invalid:${profile}`);
      continue;
    }
    const values = policy as Record<string, unknown>;
    if (
      REQUIREMENTS_CONTRACT_LINT_PROFILE_CORE_RULE_REFS.some(
        (rule) => typeof values[rule] !== 'boolean'
      ) ||
      Object.keys(values).some(
        (key) =>
          !REQUIREMENTS_CONTRACT_LINT_PROFILE_CORE_RULE_REFS.includes(
            key as (typeof REQUIREMENTS_CONTRACT_LINT_PROFILE_CORE_RULE_REFS)[number]
          )
      )
    ) {
      issueCodes.push(`additive_profile_invalid:${profile}`);
      continue;
    }
    if (
      values.requireZeroSyntheticFields !== true ||
      values.requireValidAuthority !== true ||
      values.requireCompleteRenderCoverage !== true
    ) {
      issueCodes.push(`additive_profile_weakens_core:${profile}`);
    }
    if (
      corePolicies.some(
        (corePolicy) => sha256Stable(corePolicy) === sha256Stable(values)
      )
    ) {
      issueCodes.push(`duplicate_core_profile:${profile}`);
    }
  }
  return {
    decision: issueCodes.length === 0 ? 'pass' : 'block',
    issueCodes,
    registryHash: sha256Stable(candidate),
  };
}

function emptyMetrics(): RequirementsContractLintProfileResult['metrics'] {
  return {
    blockingUnresolvedCount: 0,
    syntheticFieldCount: 0,
    authorityInvalidCount: 0,
    coveredFieldCount: 0,
    requiredRenderFieldCount: 0,
  };
}

export function evaluateRequirementsContractLintProfile(
  input: RequirementsConfirmationRenderInput,
  profile: RequirementsContractLintProfile
): RequirementsContractLintProfileResult {
  const policy = REQUIREMENTS_CONTRACT_LINT_PROFILE_REGISTRY[profile];
  if (!policy || !validateRequirementsConfirmationRenderInput(input)) {
    return {
      decision: 'block',
      profile,
      issueCodes: ['confirmation_render_input_invalid'],
      metrics: emptyMetrics(),
    };
  }
  const metrics = {
    blockingUnresolvedCount: input.blockingUnresolvedCount,
    syntheticFieldCount: input.syntheticFieldCount,
    authorityInvalidCount: input.authorityInvalidCount,
    coveredFieldCount: input.coveredFieldCount,
    requiredRenderFieldCount: input.requiredRenderFieldCount,
  };
  const issueCodes: string[] = [];
  if (!policy.allowBlockingUnresolved && metrics.blockingUnresolvedCount !== 0) {
    issueCodes.push('blocking_unresolved_fields_present');
  }
  if (policy.requireZeroSyntheticFields && metrics.syntheticFieldCount !== 0) {
    issueCodes.push('synthetic_render_fields_present');
  }
  if (policy.requireValidAuthority && metrics.authorityInvalidCount !== 0) {
    issueCodes.push('render_field_authority_invalid');
  }
  if (
    policy.requireCompleteRenderCoverage &&
    metrics.coveredFieldCount !== metrics.requiredRenderFieldCount
  ) {
    issueCodes.push('render_field_coverage_incomplete');
  }
  return {
    decision: issueCodes.length === 0 ? 'pass' : 'block',
    profile,
    issueCodes,
    metrics,
  };
}
