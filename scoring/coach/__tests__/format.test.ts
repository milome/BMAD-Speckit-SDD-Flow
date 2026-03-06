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
  it('extends Phase Scores with 整改 N 轮 when phase_iteration_counts exists', () => {
    const report = makeReport({
      phase_iteration_counts: { spec: 2, plan: 0 },
    });
    const md = formatToMarkdown(report);
    expect(md).toContain('spec: 80 分，整改 2 轮');
    expect(md).toContain('plan: 75 分，整改 0 轮');
  });

  it('keeps existing - stage: score format when phase_iteration_counts is absent', () => {
    const report = makeReport();
    const md = formatToMarkdown(report);
    expect(md).toContain('- spec: 80');
    expect(md).toContain('- plan: 75');
    expect(md).not.toContain('分，整改');
  });

  it('adds 各 Stage 整改轮次 section with desc when phase_iteration_counts exists', () => {
    const report = makeReport({
      phase_iteration_counts: { spec: 1, plan: 0 },
    });
    const md = formatToMarkdown(report);
    expect(md).toContain('## 各 Stage 整改轮次');
    expect(md).toContain('审计未通过次数，0=一次通过；通过后的多轮确认验证不计入。');
    expect(md).toContain('- spec: 1 轮');
    expect(md).toContain('- plan: 0 轮');
  });

  it('shows 均为 0（一次通过） when all iteration counts are 0', () => {
    const report = makeReport({
      phase_iteration_counts: { spec: 0, plan: 0 },
    });
    const md = formatToMarkdown(report);
    expect(md).toContain('均为 0（一次通过）');
  });

  it('contains phase_score 已按整改轮次应用阶梯扣分', () => {
    const report = makeReport({ phase_iteration_counts: { spec: 0 } });
    const md = formatToMarkdown(report);
    expect(md).toContain('phase_score 已按整改轮次应用阶梯扣分');
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
    expect(md).toContain('整改 0 轮');
    expect(md).toContain('整改 2 轮');
  });
});
