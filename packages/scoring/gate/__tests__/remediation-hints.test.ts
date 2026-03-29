import { describe, it, expect } from 'vitest';
import { buildGateRemediationHints } from '../remediation-hints';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(overrides: Partial<RunScoreRecord> = {}): RunScoreRecord {
  return {
    run_id: 'dev-e3-s2-tasks-1',
    scenario: 'real_dev',
    stage: 'tasks',
    phase_score: 60,
    phase_weight: 0.25,
    check_items: [],
    timestamp: '2026-03-28T12:00:00Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

describe('buildGateRemediationHints', () => {
  it('builds targeted remediation hints from journey contract signals', () => {
    const records: RunScoreRecord[] = [
      makeRecord({
        journey_contract_signals: {
          smoke_task_chain: true,
          closure_task_id: true,
        },
      }),
      makeRecord({
        run_id: 'dev-e3-s3-tasks-2',
        journey_contract_signals: {
          smoke_task_chain: true,
        },
      }),
      makeRecord({
        run_id: 'dev-e3-s2-implement-3',
        stage: 'tasks',
        trigger_stage: 'speckit_5_2',
        journey_contract_signals: {
          shared_path_reference: true,
        },
      }),
    ];

    const hints = buildGateRemediationHints(records);

    expect(hints.map((item) => item.signal)).toEqual([
      'smoke_task_chain',
      'closure_task_id',
      'shared_path_reference',
    ]);
    expect(hints[0]).toMatchObject({
      signal: 'smoke_task_chain',
      count: 2,
      affected_stages: ['tasks'],
      epic_stories: ['E3.S2', 'E3.S3'],
    });
    expect(hints[0]?.recommendation).toContain('Add at least one smoke task chain per Journey Slice');
    expect(hints[2]).toMatchObject({
      signal: 'shared_path_reference',
      affected_stages: ['implement'],
      epic_stories: ['E3.S2'],
    });
  });

  it('returns empty array when no journey signals are present', () => {
    expect(buildGateRemediationHints([makeRecord()])).toEqual([]);
  });
});
