export interface ParseBmadAuditResultInput {
  status?: 'PASS' | 'FAIL';
  reportPath?: string;
  iterationCount?: number;
  requiredFixesCount?: number;
  scoreTriggerPresent?: boolean;
  artifactDocPath?: string;
  converged?: boolean;
}

export function parseBmadAuditResult(input: string): ParseBmadAuditResultInput {
  const status = input.match(/status:\s*(PASS|FAIL)/)?.[1] as 'PASS' | 'FAIL' | undefined;
  const reportPath = input.match(/reportPath:\s*(.+)/)?.[1]?.trim();
  const iterationCountRaw = input.match(/iteration_count:\s*(\d+)/)?.[1];
  const requiredFixesCountRaw = input.match(/required_fixes_count:\s*(\d+)/)?.[1];
  const scoreTriggerPresentRaw = input.match(/score_trigger_present:\s*(true|false)/)?.[1];
  const artifactDocPath = input.match(/artifactDocPath:\s*(.+)/)?.[1]?.trim();
  const convergedRaw = input.match(/converged:\s*(true|false)/)?.[1];

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
