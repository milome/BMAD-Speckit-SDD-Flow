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
        return `- ${stage}: ${score} 分，整改 ${iter} 轮`;
      }
      return `- ${stage}: ${score}`;
    })
    .join('\n');
  const weakAreaLines = report.weak_areas.length > 0
    ? report.weak_areas.map((x) => `- ${x}`).join('\n')
    : '- 无';
  const recommendationLines = report.recommendations.length > 0
    ? report.recommendations.map((x) => `- ${x}`).join('\n')
    : '- 无';

  const iterationSection =
    counts != null
      ? (() => {
          const entries = Object.entries(counts).map(([s, v]) => [s, sanitizeIterationCount(v)] as const);
          const allZero = entries.every(([, v]) => v === 0);
          const desc =
            '审计未通过次数，0=一次通过；通过后的多轮确认验证不计入。';
          const body = allZero
            ? '均为 0（一次通过）'
            : entries.map(([s, v]) => `- ${s}: ${v} 轮`).join('\n');
          return ['', '## 各 Stage 整改轮次', '', desc, '', body];
        })()
      : [];

  const evolutionSection =
    report.stage_evolution_traces != null && Object.keys(report.stage_evolution_traces).length > 0
      ? [
          '',
          '## 演进轨迹（Story 9.4）',
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
    'phase_score 已按整改轮次应用阶梯扣分。',
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

