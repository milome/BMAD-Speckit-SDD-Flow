import type { CoachDiagnosisReport } from './types';
import { sanitizeIterationCount } from '../utils/sanitize-iteration';

/**
 * Format CoachDiagnosisReport to Markdown.
 * @param {import('./types').CoachDiagnosisReport} report - Diagnosis report
 * @returns {string} Markdown string
 */
export function formatToMarkdown(report: CoachDiagnosisReport): string {
  const counts = report.phase_iteration_counts;
  const phaseLines = Object.entries(report.phase_scores)
    .map(([stage, score]) => {
      if (counts != null && stage in counts) {
        const iter = sanitizeIterationCount(counts[stage]);
        return `- ${stage}: ${score} pts, remediation iterations: ${iter}`;
      }
      return `- ${stage}: ${score}`;
    })
    .join('\n');
  const weakAreaLines = report.weak_areas.length > 0
    ? report.weak_areas.map((x) => `- ${x}`).join('\n')
    : '- (none)';
  const recommendationLines = report.recommendations.length > 0
    ? report.recommendations.map((x) => `- ${x}`).join('\n')
    : '- (none)';

  const iterationSection =
    counts != null
      ? (() => {
          const entries = Object.entries(counts).map(([s, v]) => [s, sanitizeIterationCount(v)] as const);
          const allZero = entries.every(([, v]) => v === 0);
          const desc =
            'Count of failed-audit rounds; 0 = passed first time; post-pass confirmation rounds do not count.';
          const body = allZero
            ? 'All 0 (passed on first try)'
            : entries.map(([s, v]) => `- ${s}: ${v} round(s)`).join('\n');
          return ['', '## Remediation iterations per stage', '', desc, '', body];
        })()
      : [];

  const evolutionSection =
    report.stage_evolution_traces != null && Object.keys(report.stage_evolution_traces).length > 0
      ? [
          '',
          '## Score evolution (Story 9.4)',
          '',
          ...Object.entries(report.stage_evolution_traces).map(
            ([stage, trace]) => `- ${stage}: ${trace}`
          ),
        ]
      : [];

  return [
    '# AI Coach Diagnosis',
    '',
    '## Summary',
    report.summary,
    '',
    '## Phase Scores',
    phaseLines,
    '',
    '`phase_score` uses tiered deduction from remediation iteration counts.',
    ...iterationSection,
    ...evolutionSection,
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

