import { describe, it, expect } from 'vitest';
import { formatToMarkdown } from '../format';
import type { CoachDiagnosisReport } from '../types';

function makeReport(overrides?: Partial<CoachDiagnosisReport>): CoachDiagnosisReport {
  return {
    summary: 'test summary',
    phase_scores: { spec: 80, plan: 75 },
    weak_areas: [],
    recommendations: [],
    iteration_passed: true,
    ...overrides,
  };
}

describe('formatToMarkdown', () => {
  it('extends Phase Scores with remediation iterations when phase_iteration_counts exists', () => {
    const report = makeReport({
      phase_iteration_counts: { spec: 2, plan: 0 },
    });
    const md = formatToMarkdown(report);
    expect(md).toContain('spec: 80 pts, remediation iterations: 2');
    expect(md).toContain('plan: 75 pts, remediation iterations: 0');
  });

  it('keeps existing - stage: score format when phase_iteration_counts is absent', () => {
    const report = makeReport();
    const md = formatToMarkdown(report);
    expect(md).toContain('- spec: 80');
    expect(md).toContain('- plan: 75');
    expect(md).not.toContain('pts, remediation');
  });

  it('adds Remediation iterations per stage section with desc when phase_iteration_counts exists', () => {
    const report = makeReport({
      phase_iteration_counts: { spec: 1, plan: 0 },
    });
    const md = formatToMarkdown(report);
    expect(md).toContain('## Remediation iterations per stage');
    expect(md).toContain(
      'Count of failed-audit rounds; 0 = passed first time; post-pass confirmation rounds do not count.'
    );
    expect(md).toContain('- spec: 1 round(s)');
    expect(md).toContain('- plan: 0 round(s)');
  });

  it('shows All 0 (passed on first try) when all iteration counts are 0', () => {
    const report = makeReport({
      phase_iteration_counts: { spec: 0, plan: 0 },
    });
    const md = formatToMarkdown(report);
    expect(md).toContain('All 0 (passed on first try)');
  });

  it('contains tiered deduction note', () => {
    const report = makeReport({ phase_iteration_counts: { spec: 0 } });
    const md = formatToMarkdown(report);
    expect(md).toContain('`phase_score` uses tiered deduction from remediation iteration counts.');
  });

  it('Story 9.4: adds Score evolution section when stage_evolution_traces exists', () => {
    const report = makeReport({
      stage_evolution_traces: {
        spec: 'Round 1 C → Round 2 B → Round 3 A',
        plan: 'Round 1 B → Round 2 A',
      },
    });
    const md = formatToMarkdown(report);
    expect(md).toContain('## Score evolution (Story 9.4)');
    expect(md).toContain('Round 1 C → Round 2 B → Round 3 A');
    expect(md).toContain('Round 1 B → Round 2 A');
  });

  it('Story 9.4: omits evolution section when stage_evolution_traces empty', () => {
    const report = makeReport();
    const md = formatToMarkdown(report);
    expect(md).not.toContain('Score evolution');
  });

  it('sanitizes NaN/negative/decimal in phase_iteration_counts (US-005)', () => {
    const report = makeReport({
      phase_scores: { a: 70, b: 60, c: 50, d: 40 },
      phase_iteration_counts: {
        a: NaN as unknown as number,
        b: -1,
        c: 1.7,
        d: undefined as unknown as number,
      },
    });
    const md = formatToMarkdown(report);
    expect(md).toContain('remediation iterations: 0');
    expect(md).toContain('remediation iterations: 2');
  });

  it('renders Journey contract remediation section when hints exist', () => {
    const report = makeReport({
      journey_contract_hints: [
        {
          signal: 'smoke_task_chain',
          label: 'Smoke Task Chain',
          count: 2,
          affected_stages: ['tasks'],
          epic_stories: ['E6.S4'],
          recommendation: 'Add at least one smoke task chain per Journey Slice and point setup tasks to that chain.',
        },
      ],
    });
    const md = formatToMarkdown(report);
    expect(md).toContain('## Journey Contract Remediation');
    expect(md).toContain('Smoke Task Chain: 2 occurrence(s)');
    expect(md).toContain('affected stages tasks');
    expect(md).toContain('stories E6.S4');
    expect(md).toContain('Add at least one smoke task chain per Journey Slice');
  });
});
