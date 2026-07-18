import {
  type RequirementsConfirmationRenderInput,
  validateRequirementsConfirmationRenderInput,
} from '../scripts/requirements-contract-confirmation-render-input';

export type RequirementsContractLintProfile = 'draft' | 'confirmation-ready';

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
