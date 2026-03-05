import type { CoachDiagnosisReport } from './types';

export function formatToMarkdown(report: CoachDiagnosisReport): string {
  const phaseLines = Object.entries(report.phase_scores)
    .map(([stage, score]) => `- ${stage}: ${score}`)
    .join('\n');
  const weakAreaLines = report.weak_areas.length > 0
    ? report.weak_areas.map((x) => `- ${x}`).join('\n')
    : '- 无';
  const recommendationLines = report.recommendations.length > 0
    ? report.recommendations.map((x) => `- ${x}`).join('\n')
    : '- 无';

  return [
    '# AI Coach Diagnosis',
    '',
    '## Summary',
    report.summary,
    '',
    '## Phase Scores',
    phaseLines,
    '',
    '## Weak Areas',
    weakAreaLines,
    '',
    '## Recommendations',
    recommendationLines,
    '',
    '## Iteration Passed',
    report.iteration_passed ? 'true' : 'false',
  ].join('\n');
}

