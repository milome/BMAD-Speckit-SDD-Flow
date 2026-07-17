import { sha256Stable } from '../scripts/requirements-contract-semantic-resolver';

export const REQUIREMENTS_CONTRACT_TRACE_DIMENSIONS = [
  'scenario',
  'sequenceStep',
  'branch',
  'target',
  'task',
  'red',
  'oracle',
  'command',
  'acceptance',
  'evidenceRequirement',
] as const;

export type RequirementsContractTraceDimension =
  (typeof REQUIREMENTS_CONTRACT_TRACE_DIMENSIONS)[number];

export type RequirementsContractTraceEdgeType =
  | 'requires'
  | 'verified_by'
  | 'implemented_in'
  | 'produces'
  | 'bounded_by'
  | 'derived_from';

interface RequirementsContractTraceEdgeTypeRule {
  edgeType: RequirementsContractTraceEdgeType;
  requiredDimensions: readonly RequirementsContractTraceDimension[];
  notApplicableDimensions: readonly RequirementsContractTraceDimension[];
}

function rule(
  edgeType: RequirementsContractTraceEdgeType,
  requiredDimensions: readonly RequirementsContractTraceDimension[]
): RequirementsContractTraceEdgeTypeRule {
  return {
    edgeType,
    requiredDimensions,
    notApplicableDimensions: REQUIREMENTS_CONTRACT_TRACE_DIMENSIONS.filter(
      (dimension) => !requiredDimensions.includes(dimension)
    ),
  };
}

export const REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY = {
  schemaVersion: 'requirements-contract-trace-edge-type-registry/v1',
  dimensions: REQUIREMENTS_CONTRACT_TRACE_DIMENSIONS,
  edgeTypes: [
    rule('requires', [
      'scenario',
      'sequenceStep',
      'branch',
      'target',
      'task',
      'acceptance',
    ]),
    rule('verified_by', ['red', 'oracle', 'command', 'acceptance', 'evidenceRequirement']),
    rule('implemented_in', ['target', 'task']),
    rule('produces', ['target', 'evidenceRequirement']),
    rule('bounded_by', ['branch', 'red', 'acceptance']),
    rule('derived_from', ['scenario', 'sequenceStep', 'acceptance']),
  ],
  authority: 'none',
} as const;

export function requirementsContractTraceEdgeTypeRegistryHash(): string {
  return sha256Stable(REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY);
}

interface BoundDimension {
  state: 'bound';
  refs: string[];
  proofRefs: string[];
}

interface NotApplicableDimension {
  state: 'not_applicable';
  reasonCode: string;
  proofRefs: string[];
  refs?: never;
}

export type RequirementsContractTraceDimensionDecision =
  | BoundDimension
  | NotApplicableDimension;

export function validateRequirementsContractTraceDimensions(
  edgeType: RequirementsContractTraceEdgeType,
  dimensions: Partial<
    Record<RequirementsContractTraceDimension, RequirementsContractTraceDimensionDecision>
  >
): { ok: boolean; issues: string[] } {
  const edgeRule = REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY.edgeTypes.find(
    (entry) => entry.edgeType === edgeType
  );
  if (!edgeRule) return { ok: false, issues: [`trace_edge_type_unknown:${edgeType}`] };

  const issues: string[] = [];
  for (const dimension of REQUIREMENTS_CONTRACT_TRACE_DIMENSIONS) {
    const decision = dimensions[dimension];
    if (!decision) {
      issues.push(`trace_dimension_missing:${dimension}`);
      continue;
    }
    const required = edgeRule.requiredDimensions.includes(dimension);
    if (required && decision.state !== 'bound') {
      issues.push(`trace_dimension_required_binding_missing:${dimension}`);
      continue;
    }
    if (!required && decision.state !== 'not_applicable') {
      issues.push(`trace_dimension_not_applicable_required:${dimension}`);
      continue;
    }
    if (decision.proofRefs.length === 0) {
      issues.push(`trace_dimension_proof_missing:${dimension}`);
    }
    if (decision.state === 'bound' && decision.refs.length === 0) {
      issues.push(`trace_dimension_ref_missing:${dimension}`);
    }
    if (decision.state === 'not_applicable' && decision.reasonCode.trim().length === 0) {
      issues.push(`trace_dimension_reason_missing:${dimension}`);
    }
  }
  return { ok: issues.length === 0, issues };
}
