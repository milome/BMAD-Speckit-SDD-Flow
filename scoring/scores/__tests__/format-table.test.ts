import { describe, it, expect } from 'vitest';
import { formatScoresToTable } from '../format-table';
import type { RunScoreRecord } from '../../writer/types';

function createRecord(overrides: Partial<RunScoreRecord> = {}): RunScoreRecord {
  return {
    run_id: 'dev-e4-s2-1730812345',
    scenario: 'real_dev',
    stage: 'story',
    phase_score: 80,
    phase_weight: 25,
    check_items: [
      { item_id: 'a', passed: true, score_delta: 10 },
      { item_id: 'b', passed: false, score_delta: -5 },
    ],
    timestamp: '2026-03-06T12:00:00Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

describe('formatScoresToTable', () => {
  it('returns empty string for empty records', () => {
    expect(formatScoresToTable([], 'all')).toBe('');
    expect(formatScoresToTable([], 'epic')).toBe('');
    expect(formatScoresToTable([], 'story')).toBe('');
  });

  it('mode all: outputs run_id, epic, story, stage, phase_score, phase_weight, timestamp', () => {
    const records = [createRecord({ run_id: 'dev-e3-s1-x' })];
    const out = formatScoresToTable(records, 'all');
    expect(out).toContain('| run_id | epic | story | stage |');
    expect(out).toContain('dev-e3-s1-x');
    expect(out).toContain('| 3 | 1 |');
  });

  it('mode epic: outputs story, stage, phase_score, phase_weight, timestamp', () => {
    const records = [createRecord({ run_id: 'dev-e4-s2-x' })];
    const out = formatScoresToTable(records, 'epic');
    expect(out).toContain('| story | stage |');
    expect(out).toContain('| 4.2 |');
  });

  it('mode story: outputs check_items_summary as passed/total', () => {
    const records = [
      createRecord({
        check_items: [
          { item_id: 'a', passed: true, score_delta: 5 },
          { item_id: 'b', passed: true, score_delta: 5 },
          { item_id: 'c', passed: false, score_delta: -3 },
        ],
      }),
    ];
    const out = formatScoresToTable(records, 'story');
    expect(out).toContain('| 2/3 passed |');
  });

  it('mode story: empty check_items shows "-"', () => {
    const records = [createRecord({ check_items: [] })];
    const out = formatScoresToTable(records, 'story');
    expect(out).toContain('| - |');
  });

  it('sorts by timestamp desc', () => {
    const records = [
      createRecord({ timestamp: '2026-03-06T10:00:00Z', run_id: 'zzz-early' }),
      createRecord({ timestamp: '2026-03-06T12:00:00Z', run_id: 'zzz-late' }),
    ];
    const out = formatScoresToTable(records, 'all');
    const idxEarly = out.indexOf('zzz-early');
    const idxLate = out.indexOf('zzz-late');
    expect(idxLate).toBeLessThan(idxEarly);
  });
});
