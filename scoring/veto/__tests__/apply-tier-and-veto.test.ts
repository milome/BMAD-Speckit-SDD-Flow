/**
 * Story 4.1 T3: applyTierAndVeto 编排测试
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { applyTierAndVeto } from '../index';
import type { RunScoreRecord } from '../../writer/types';

const rulesDir = path.resolve(process.cwd(), 'scoring', 'rules');
const opts = { rulesDir };

function makeRecord(overrides: Partial<RunScoreRecord> & { raw_phase_score?: number }): RunScoreRecord & { raw_phase_score?: number } {
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

describe('applyTierAndVeto', () => {
  it('supports spec-stage veto rules from spec-scoring.yaml', () => {
    const r = makeRecord({
      stage: 'spec',
      check_items: [{ item_id: 'veto_core_unmapped', passed: false, score_delta: -10 }],
      raw_phase_score: 80,
    });
    const out = applyTierAndVeto(r, opts);
    expect(out.veto_triggered).toBe(true);
    expect(out.phase_score).toBe(0);
  });

  it('veto triggered -> phase_score=0', () => {
    const r = makeRecord({
      check_items: [{ item_id: 'veto_core_logic', passed: false, score_delta: -10 }],
      raw_phase_score: 80,
    });
    const out = applyTierAndVeto(r, opts);
    expect(out.veto_triggered).toBe(true);
    expect(out.phase_score).toBe(0);
    expect(out.tier_coefficient).toBeDefined();
  });

  it('veto not triggered -> phase_score = raw * tier', () => {
    const r = makeRecord({
      check_items: [{ item_id: 'functional_correctness', passed: true, score_delta: 0 }],
      raw_phase_score: 100,
      iteration_count: 1,
    });
    const out = applyTierAndVeto(r, opts);
    expect(out.veto_triggered).toBe(false);
    expect(out.phase_score).toBe(80); // 100 * 0.8
    expect(out.tier_coefficient).toBe(0.8);
  });

  it('fallback to phase_score when raw_phase_score absent', () => {
    const r = makeRecord({
      phase_score: 80,
      check_items: [{ item_id: 'functional_correctness', passed: true, score_delta: 0 }],
      iteration_count: 0,
    });
    const out = applyTierAndVeto(r, opts);
    expect(out.veto_triggered).toBe(false);
    expect(out.phase_score).toBe(80); // 80 * 1.0
  });
});
