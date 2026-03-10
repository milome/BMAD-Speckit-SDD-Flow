/**
 * Story 8.3: run 命令核心逻辑
 * - runId 生成：eval-q{id}-{version}-{timestamp}
 * - question_version 校验：scenario=eval_question 时必填
 */

/**
 * 生成 eval_question 格式的 runId。
 * 格式：eval-{id}-{version}-{timestamp}，示例 eval-q001-v1-1730812345
 * id 保留原值（如 q001）；见 scoring/docs/RUN_ID_CONVENTION.md §2.2
 */
export function generateEvalRunId(questionId: string, version: string, timestamp?: number): string {
  const ts = timestamp ?? Date.now();
  return `eval-${questionId}-${version}-${ts}`;
}

/**
 * 校验 scenario=eval_question 时 question_version 必填。
 * 缺失或空字符串时 throw。
 */
export function validateQuestionVersionForEval(
  scenario: 'real_dev' | 'eval_question',
  questionVersion: string | undefined
): void {
  if (scenario !== 'eval_question') return;
  if (questionVersion == null || (typeof questionVersion === 'string' && questionVersion.trim() === '')) {
    throw new Error('validateScenarioConstraints: question_version 必填 when scenario=eval_question');
  }
}
