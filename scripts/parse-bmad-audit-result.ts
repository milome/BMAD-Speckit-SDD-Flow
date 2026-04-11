export interface ParseBmadAuditResultInput {
  status?: 'PASS' | 'FAIL';
  reportPath?: string;
  iterationCount?: number;
  requiredFixesCount?: number;
  scoreTriggerPresent?: boolean;
  artifactDocPath?: string;
  converged?: boolean;
}

function matchControlValue(input: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const matched = input.match(pattern)?.[1]?.trim();
    if (matched) {
      return matched;
    }
  }
  return undefined;
}

function matchCanonicalThenCompatibility(
  input: string,
  canonicalPattern: RegExp,
  compatibilityPattern: RegExp
): string | undefined {
  return matchControlValue(input, [canonicalPattern, compatibilityPattern]);
}

export function parseBmadAuditResult(input: string): ParseBmadAuditResultInput {
  const status = matchCanonicalThenCompatibility(
    input,
    /status:\s*(PASS|FAIL)/,
    /状态:\s*(PASS|FAIL)/
  ) as 'PASS' | 'FAIL' | undefined;
  const reportPath = matchCanonicalThenCompatibility(
    input,
    /reportPath:\s*(.+)/,
    /报告路径:\s*(.+)/
  );
  const iterationCountRaw = matchCanonicalThenCompatibility(
    input,
    /iteration_count:\s*(\d+)/,
    /迭代次数:\s*(\d+)/
  );
  const requiredFixesCountRaw = matchCanonicalThenCompatibility(
    input,
    /required_fixes_count:\s*(\d+)/,
    /待修复项数:\s*(\d+)/
  );
  const scoreTriggerPresentRaw = matchCanonicalThenCompatibility(
    input,
    /score_trigger_present:\s*(true|false)/,
    /已检测到评分触发器:\s*(true|false)/
  );
  const artifactDocPath = matchCanonicalThenCompatibility(
    input,
    /artifactDocPath:\s*(.+)/,
    /产物文档路径:\s*(.+)/
  );
  const convergedRaw = matchCanonicalThenCompatibility(
    input,
    /converged:\s*(true|false)/,
    /是否已收敛:\s*(true|false)/
  );

  return {
    status,
    reportPath,
    iterationCount: iterationCountRaw ? Number(iterationCountRaw) : 0,
    requiredFixesCount: requiredFixesCountRaw ? Number(requiredFixesCountRaw) : 0,
    scoreTriggerPresent: scoreTriggerPresentRaw === 'true',
    artifactDocPath,
    converged: convergedRaw === 'true',
  };
}
