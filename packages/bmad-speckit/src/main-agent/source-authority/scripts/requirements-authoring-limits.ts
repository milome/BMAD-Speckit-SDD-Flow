export const REQUIREMENTS_AUTHORING_LIMIT_ISSUE_CODES = [
  'requirements_source_bytes_exceeded',
  'requirements_total_source_bytes_exceeded',
  'requirements_semantic_node_count_exceeded',
  'requirements_source_span_count_exceeded',
  'requirements_projection_count_exceeded',
  'judge_payload_budget_exceeded',
  'judge_token_budget_exceeded',
] as const;

export interface RequirementsAuthoringCapacity {
  largestSourceBytes: number;
  totalSourceBytes: number;
  semanticNodeCount: number;
  sourceSpanCount: number;
  projectionCount: number;
  judgePayloadBytes: number;
  judgeTokenEstimate: number;
}

export interface RequirementsAuthoringLimits {
  maxSingleSourceBytes: number;
  maxTotalSourceBytes: number;
  maxSemanticNodes: number;
  maxSourceSpans: number;
  maxProjections: number;
  maxJudgePayloadBytes: number;
  maxJudgeTokens: number;
}

export type RequirementsSourceResourceLimits = Pick<
  RequirementsAuthoringLimits,
  'maxSingleSourceBytes' | 'maxTotalSourceBytes' | 'maxSemanticNodes' | 'maxSourceSpans'
>;

export const DEFAULT_REQUIREMENTS_SOURCE_RESOURCE_LIMITS: RequirementsSourceResourceLimits = {
  maxSingleSourceBytes: 1024 * 1024,
  maxTotalSourceBytes: 16 * 1024 * 1024,
  maxSemanticNodes: 10_000,
  maxSourceSpans: 10_000,
};

export function evaluateRequirementsAuthoringLimits(
  capacity: RequirementsAuthoringCapacity,
  limits: RequirementsAuthoringLimits
) {
  const comparisons: Array<[number, number, (typeof REQUIREMENTS_AUTHORING_LIMIT_ISSUE_CODES)[number]]> = [
    [
      capacity.largestSourceBytes,
      limits.maxSingleSourceBytes,
      'requirements_source_bytes_exceeded',
    ],
    [
      capacity.totalSourceBytes,
      limits.maxTotalSourceBytes,
      'requirements_total_source_bytes_exceeded',
    ],
    [capacity.semanticNodeCount, limits.maxSemanticNodes, 'requirements_semantic_node_count_exceeded'],
    [capacity.sourceSpanCount, limits.maxSourceSpans, 'requirements_source_span_count_exceeded'],
    [capacity.projectionCount, limits.maxProjections, 'requirements_projection_count_exceeded'],
    [capacity.judgePayloadBytes, limits.maxJudgePayloadBytes, 'judge_payload_budget_exceeded'],
    [capacity.judgeTokenEstimate, limits.maxJudgeTokens, 'judge_token_budget_exceeded'],
  ];
  const issueCodes = comparisons
    .filter(([actual, maximum]) => !Number.isSafeInteger(actual) || actual < 0 || actual > maximum)
    .map(([, , issueCode]) => issueCode);
  return { decision: issueCodes.length ? 'block' as const : 'pass' as const, issueCodes };
}
