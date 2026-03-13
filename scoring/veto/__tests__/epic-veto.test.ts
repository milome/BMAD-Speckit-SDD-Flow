/**
 * Story 4.1 T4.4: Epic 8 项判定单元测试
 */
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { evaluateEpicVeto } from '../epic-veto';
import type { EpicStoryRecord } from '../types';

const rulesDir = path.resolve(process.cwd(), 'scoring', 'rules');
const opts = { rulesDir };

function makeStoryRecord(overrides: Partial<EpicStoryRecord>): EpicStoryRecord {
  return {
    veto_triggered: false,
    phase_score: 100,
    iteration_count: 0,
    first_pass: true,
    iteration_records: [],
    check_items: [],
    ...overrides,
  };
}

describe('evaluateEpicVeto', () => {
  it('① veto count >= 3 triggers', () => {
    const records = [
      makeStoryRecord({ veto_triggered: true }),
      makeStoryRecord({ veto_triggered: true }),
      makeStoryRecord({ veto_triggered: true }),
    ];
    const out = evaluateEpicVeto({ storyRecords: records, epicStoryCount: 5 }, opts);
    expect(out.triggered).toBe(true);
    expect(out.triggeredConditions).toContain('①_veto_count_ge3');
  });

  it('② delivery rate < 80% triggers when passedStoryCount provided', () => {
    const records = [makeStoryRecord({}), makeStoryRecord({})];
    const out = evaluateEpicVeto(
      { storyRecords: records, epicStoryCount: 5, passedStoryCount: 2 },
      opts
    );
    expect(out.triggered).toBe(true);
    expect(out.triggeredConditions).toContain('②_delivery_rate_lt80');
  });

  it('③ high risk vuln >= 2 triggers', () => {
    const _vetoIds = ['veto_core_logic', 'veto_owasp_high'];
    const records = [
      makeStoryRecord({
        check_items: [
          { item_id: 'veto_core_logic', passed: false, score_delta: -10 },
          { item_id: 'veto_owasp_high', passed: false, score_delta: -10 },
        ],
      }),
    ];
    const out = evaluateEpicVeto({ storyRecords: records, epicStoryCount: 1 }, opts);
    expect(out.triggered).toBe(true);
    expect(out.triggeredConditions).toContain('③_high_risk_vuln_ge2');
  });

  it('⑤ iter4 fail >= 1 triggers', () => {
    const records = [
      makeStoryRecord({ iteration_count: 4, veto_triggered: true }),
    ];
    const out = evaluateEpicVeto({ storyRecords: records, epicStoryCount: 1 }, opts);
    expect(out.triggered).toBe(true);
    expect(out.triggeredConditions).toContain('⑤_iter4_fail_ge1');
  });

  it('⑥ first pass rate < 50% triggers', () => {
    const records = [
      makeStoryRecord({ first_pass: true }),
      makeStoryRecord({ first_pass: false }),
      makeStoryRecord({ first_pass: false }),
      makeStoryRecord({ first_pass: false }),
    ];
    const out = evaluateEpicVeto({ storyRecords: records, epicStoryCount: 4 }, opts);
    expect(out.triggered).toBe(true);
    expect(out.triggeredConditions).toContain('⑥_first_pass_rate_lt50');
  });

  it('⑦ iter3 >= 2 triggers', () => {
    const records = [
      makeStoryRecord({ iteration_count: 3 }),
      makeStoryRecord({ iteration_count: 4 }),
    ];
    const out = evaluateEpicVeto({ storyRecords: records, epicStoryCount: 2 }, opts);
    expect(out.triggered).toBe(true);
    expect(out.triggeredConditions).toContain('⑦_iter3_ge2');
  });

  it('⑧ fatal iter3 >= 1 triggers', () => {
    const records = [
      makeStoryRecord({
        iteration_records: [
          { timestamp: '2026-01-01Z', result: 'fail', severity: 'fatal' },
          { timestamp: '2026-01-02Z', result: 'fail', severity: 'fatal' },
          { timestamp: '2026-01-03Z', result: 'fail', severity: 'fatal' },
        ],
      }),
    ];
    const out = evaluateEpicVeto({ storyRecords: records, epicStoryCount: 1 }, opts);
    expect(out.triggered).toBe(true);
    expect(out.triggeredConditions).toContain('⑧_fatal_iter3_ge1');
  });

  it('no conditions -> not triggered', () => {
    const records = [
      makeStoryRecord({ first_pass: true }),
      makeStoryRecord({ first_pass: true }),
    ];
    const out = evaluateEpicVeto({ storyRecords: records, epicStoryCount: 2 }, opts);
    expect(out.triggered).toBe(false);
    expect(out.triggeredConditions).toHaveLength(0);
  });
});
