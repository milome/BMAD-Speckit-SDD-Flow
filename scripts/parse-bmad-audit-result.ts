export interface ParseBmadAuditResultInput {
  status?: 'PASS' | 'FAIL';
  stage?: string;
  reportPath?: string;
  iterationCount?: number;
  requiredFixesCount?: number;
  requiredFixes?: string[];
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

function extractRequiredFixes(input: string): string[] {
  const sectionMatch =
    /(?:^|\n)##\s*(?:Required Fixes|待修复项|必须修复项)\s*\n([\s\S]*?)(?=\n##\s+|\n---|\n$)/im.exec(
      input
    ) ??
    /(?:^|\n)(?:Required Fixes|待修复项|必须修复项)\s*:\s*\n([\s\S]*?)(?=\n##\s+|\n---|\n$)/im.exec(
      input
    );

  if (!sectionMatch) {
    return [];
  }

  return sectionMatch[1]
    .split(/\r?\n/)
    .map((line) => {
      const bulletMatch = /^\s*(?:[-*]|\d+\.)\s+(.+?)\s*$/.exec(line);
      return bulletMatch ? bulletMatch[1].trim() : null;
    })
    .filter((line): line is string => Boolean(line))
    .filter((line) => !/^none$/i.test(line) && !/^无$/i.test(line));
}

export function parseBmadAuditResult(input: string): ParseBmadAuditResultInput {
  const status = matchCanonicalThenCompatibility(
    input,
    /status:\s*(PASS|FAIL)/,
    /状态:\s*(PASS|FAIL)/
  ) as 'PASS' | 'FAIL' | undefined;
  const stage = matchCanonicalThenCompatibility(input, /stage:\s*([A-Za-z_]+)/, /阶段:\s*([A-Za-z_]+)/);
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
  const requiredFixes = extractRequiredFixes(input);

  return {
    status,
    stage,
    reportPath,
    iterationCount: iterationCountRaw ? Number(iterationCountRaw) : 0,
    requiredFixesCount: requiredFixesCountRaw ? Number(requiredFixesCountRaw) : 0,
    ...(requiredFixes.length > 0 ? { requiredFixes } : {}),
    scoreTriggerPresent: scoreTriggerPresentRaw === 'true',
    artifactDocPath,
    converged: convergedRaw === 'true',
  };
}
