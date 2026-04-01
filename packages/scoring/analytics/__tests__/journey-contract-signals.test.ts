import { describe, it, expect } from 'vitest';
import { summarizeJourneyContractSignals } from '../journey-contract-signals';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(overrides: Partial<RunScoreRecord> = {}): RunScoreRecord {
  return {
    run_id: 'dev-e1-s1-spec-1',
    scenario: 'real_dev',
    stage: 'tasks',
    phase_score: 70,
    phase_weight: 0.25,
    check_items: [],
    timestamp: '2026-03-28T10:00:00Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

describe('summarizeJourneyContractSignals', () => {
  it('aggregates journey contract signals by signal key with affected stages and epic stories', () => {
    const records: RunScoreRecord[] = [
      makeRecord({
        run_id: 'dev-e1-s1-tasks-1',
        stage: 'tasks',
        journey_contract_signals: {
          smoke_task_chain: true,
          closure_task_id: true,
        },
      }),
      makeRecord({
        run_id: 'dev-e1-s2-tasks-1',
        journey_contract_signals: {
          smoke_task_chain: true,
        },
      }),
      makeRecord({
        run_id: 'dev-e1-s1-implement-2',
        stage: 'tasks',
        trigger_stage: 'speckit_5_2',
        journey_contract_signals: {
          shared_path_reference: true,
        },
      }),
    ];

    const summary = summarizeJourneyContractSignals(records);

    expect(summary[0]).toMatchObject({
      signal: 'smoke_task_chain',
      count: 2,
      affected_stages: ['tasks'],
      epic_stories: ['E1.S1', 'E1.S2'],
    });
    expect(summary.find((item) => item.signal === 'closure_task_id')).toMatchObject({
      count: 1,
      affected_stages: ['tasks'],
      epic_stories: ['E1.S1'],
    });
    expect(summary.find((item) => item.signal === 'shared_path_reference')).toMatchObject({
      count: 1,
      affected_stages: ['implement'],
      epic_stories: ['E1.S1'],
    });
  });

  it('returns empty array when no journey contract signals exist', () => {
    expect(summarizeJourneyContractSignals([makeRecord()])).toEqual([]);
  });
});
