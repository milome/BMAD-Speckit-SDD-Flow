/**
 * Story 4.1 T2.3: 阶梯系数单元测试
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { getTierCoefficient, applyTierToPhaseScore } from '../tier';
import type { RunScoreRecord, IterationRecord } from '../../writer/types';

const rulesDir = path.resolve(process.cwd(), 'scoring', 'rules');

function makeRecord(overrides: Partial<RunScoreRecord>): RunScoreRecord {
  return {
    run_id: 'test',
    scenario: 'real_dev',
    stage: 'prd',
    phase_score: 100,
    phase_weight: 0.2,
    check_items: [],
    timestamp: new Date().toISOString(),
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

describe('getTierCoefficient', () => {
  it('iteration_count 0 -> 1.0', () => {
    const r = makeRecord({ iteration_count: 0 });
    expect(getTierCoefficient(r, { rulesDir })).toBe(1.0);
  });

  it('iteration_count 1 -> 0.8', () => {
    const r = makeRecord({ iteration_count: 1 });
    expect(getTierCoefficient(r, { rulesDir })).toBe(0.8);
  });

  it('iteration_count 2 -> 0.5', () => {
    const r = makeRecord({ iteration_count: 2 });
    expect(getTierCoefficient(r, { rulesDir })).toBe(0.5);
  });

  it('iteration_count >= 3 -> 0', () => {
    expect(getTierCoefficient(makeRecord({ iteration_count: 3 }), { rulesDir })).toBe(0);
    expect(getTierCoefficient(makeRecord({ iteration_count: 5 }), { rulesDir })).toBe(0);
  });

  it('severity_override: fatal >= 3 -> 0', () => {
    const recs: IterationRecord[] = [
      { timestamp: '2026-01-01T00:00:00Z', result: 'fail', severity: 'fatal' },
      { timestamp: '2026-01-02T00:00:00Z', result: 'fail', severity: 'fatal' },
      { timestamp: '2026-01-03T00:00:00Z', result: 'fail', severity: 'fatal' },
    ];
    const r = makeRecord({ iteration_count: 3, iteration_records: recs });
    expect(getTierCoefficient(r, { rulesDir })).toBe(0);
  });

  it('severity_override: serious >= 2 -> drop one tier', () => {
    const recs: IterationRecord[] = [
      { timestamp: '2026-01-01T00:00:00Z', result: 'fail', severity: 'serious' },
      { timestamp: '2026-01-02T00:00:00Z', result: 'fail', severity: 'serious' },
    ];
    const r = makeRecord({ iteration_count: 1, iteration_records: recs }); // tier 2 (0.8) -> drop to tier 3 (0.5)
    expect(getTierCoefficient(r, { rulesDir })).toBe(0.5);
  });

  it('applyTierToPhaseScore: raw * coefficient', () => {
    const r = makeRecord({ iteration_count: 1 });
    expect(applyTierToPhaseScore(100, r, { rulesDir })).toBe(80);
  });
});
