export const REQUIREMENTS_AUTHORING_LIMIT_ISSUE_CODES = [
  'requirements_source_bytes_exceeded',
  'requirements_semantic_node_count_exceeded',
  'requirements_source_span_count_exceeded',
  'requirements_projection_count_exceeded',
  'judge_payload_budget_exceeded',
  'judge_token_budget_exceeded',
] as const;

export interface RequirementsAuthoringCapacity {
  sourceBytes: number;
  semanticNodeCount: number;
  sourceSpanCount: number;
  projectionCount: number;
  judgePayloadBytes: number;
  judgeTokenEstimate: number;
}

export interface RequirementsAuthoringLimits {
  maxSourceBytes: number;
  maxSemanticNodes: number;
  maxSourceSpans: number;
  maxProjections: number;
  maxJudgePayloadBytes: number;
  maxJudgeTokens: number;
}

export function evaluateRequirementsAuthoringLimits(
  capacity: RequirementsAuthoringCapacity,
  limits: RequirementsAuthoringLimits
) {
  const comparisons: Array<[number, number, (typeof REQUIREMENTS_AUTHORING_LIMIT_ISSUE_CODES)[number]]> = [
    [capacity.sourceBytes, limits.maxSourceBytes, 'requirements_source_bytes_exceeded'],
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
