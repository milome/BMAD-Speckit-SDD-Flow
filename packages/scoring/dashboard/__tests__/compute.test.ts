import { describe, it, expect } from 'vitest';
import {
  groupByRunId,
  getLatestRunRecords,
  getLatestRunRecordsV2,
  computeHealthScore,
  getDimensionScores,
  getWeakTop3,
  getWeakTop3EpicStory,
  getJourneyContractSummary,
  aggregateByEpicStoryTimeWindow,
  getHighIterationTop3,
  countVetoTriggers,
  getTrend,
  effectiveStage,
  getGovernanceRoutingSummary,
  getGovernanceRoutingModeDistribution,
  getGovernanceSignalHotspots,
  getGovernanceRerunGateFailureTrend,
} from '../compute';
import type { RunScoreRecord } from '../../writer/types';

function createRecord(overrides: Partial<RunScoreRecord> = {}): RunScoreRecord {
  return {
    run_id: 'dev-e6-s4-1730812345',
    scenario: 'real_dev',
    stage: 'spec',
    phase_score: 80,
    phase_weight: 20,
    check_items: [],
    timestamp: '2026-03-06T12:00:00Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

describe('groupByRunId', () => {
  it('groups records by run_id', () => {
    const records = [
      createRecord({ run_id: 'run-a', stage: 'spec' }),
      createRecord({ run_id: 'run-a', stage: 'plan' }),
      createRecord({ run_id: 'run-b', stage: 'spec' }),
    ];
    const map = groupByRunId(records);
    expect(map.get('run-a')).toHaveLength(2);
    expect(map.get('run-b')).toHaveLength(1);
  });
});

describe('getLatestRunRecords', () => {
  it('returns empty for empty input', () => {
    expect(getLatestRunRecords([])).toEqual([]);
  });

  it('returns records of the run with latest timestamp', () => {
    const records = [
      createRecord({ run_id: 'run-old', timestamp: '2026-03-05T10:00:00Z', stage: 'spec' }),
      createRecord({ run_id: 'run-old', timestamp: '2026-03-05T10:00:00Z', stage: 'plan' }),
      createRecord({ run_id: 'run-new', timestamp: '2026-03-06T12:00:00Z', stage: 'spec' }),
    ];
    const latest = getLatestRunRecords(records);
    expect(latest).toHaveLength(1);
    expect(latest[0]!.run_id).toBe('run-new');
  });
});

describe('computeHealthScore', () => {
  it('returns 0 for empty records', () => {
    expect(computeHealthScore([])).toBe(0);
  });

  it('computes weighted average and rounds', () => {
    const records = [
      createRecord({ phase_score: 80, phase_weight: 20 }),
      createRecord({ phase_score: 60, phase_weight: 30 }),
    ];
    expect(computeHealthScore(records)).toBe(68);
  });
});

describe('getDimensionScores', () => {
  it('returns 无数据 for dimensions with no data', () => {
    const records = [createRecord()];
    const dims = getDimensionScores(records);
    expect(dims.some((d) => d.score === '无数据')).toBe(true);
  });

  it('aggregates dimension_scores when present', () => {
    const records = [
      createRecord({
        dimension_scores: [
          { dimension: '功能性', weight: 0.3, score: 80 },
          { dimension: '代码质量', weight: 0.3, score: 70 },
        ],
      }),
    ];
    const dims = getDimensionScores(records);
    expect(dims.find((d) => d.dimension === '功能性')?.score).toBe(80);
    expect(dims.find((d) => d.dimension === '代码质量')?.score).toBe(70);
  });
});

describe('getHighIterationTop3', () => {
  it('returns top 3 by iteration_count descending, filters >0', () => {
    const records = [
      createRecord({ stage: 'a', iteration_count: 1 }),
      createRecord({ stage: 'b', iteration_count: 5 }),
      createRecord({ stage: 'c', iteration_count: 3 }),
      createRecord({ stage: 'd', iteration_count: 2 }),
    ];
    const top = getHighIterationTop3(records);
    expect(top).toHaveLength(3);
    expect(top[0]!.stage).toBe('b');
    expect(top[0]!.iteration_count).toBe(5);
    expect(top[1]!.stage).toBe('c');
    expect(top[1]!.iteration_count).toBe(3);
    expect(top[2]!.stage).toBe('d');
    expect(top[2]!.iteration_count).toBe(2);
  });

  it('returns [] when all iteration_count are 0', () => {
    const records = [
      createRecord({ stage: 'a', iteration_count: 0 }),
      createRecord({ stage: 'b', iteration_count: 0 }),
    ];
    expect(getHighIterationTop3(records)).toEqual([]);
  });

  it('displays effectiveStage implement for stage=tasks+trigger_stage=speckit_5_2 (Story 9.2)', () => {
    const records = [
      createRecord({ stage: 'tasks', trigger_stage: 'speckit_5_2', iteration_count: 4 }),
    ];
    const top = getHighIterationTop3(records);
    expect(top).toHaveLength(1);
    expect(top[0]!.stage).toBe('implement');
  });

  it('Story 9.4: includes evolution_trace when iteration_records have overall_grade', () => {
    const records = [
      createRecord({
        stage: 'spec',
        iteration_count: 2,
        iteration_records: [
          { timestamp: '2026-03-06T10:00:00Z', result: 'fail' as const, severity: 'normal' as const, overall_grade: 'C' },
          { timestamp: '2026-03-06T11:00:00Z', result: 'fail' as const, severity: 'minor' as const, overall_grade: 'B' },
          { timestamp: '2026-03-06T12:00:00Z', result: 'pass' as const, severity: 'normal' as const, overall_grade: 'A' },
        ],
      }),
    ];
    const top = getHighIterationTop3(records);
    expect(top).toHaveLength(1);
    expect(top[0]!.evolution_trace).toBe('第1轮 C → 第2轮 B → 第3轮 A');
  });
});

describe('getWeakTop3', () => {
  it('returns top 3 by lowest phase_score', () => {
    const records = [
      createRecord({ stage: 'a', phase_score: 90 }),
      createRecord({ stage: 'b', phase_score: 50 }),
      createRecord({ stage: 'c', phase_score: 30 }),
      createRecord({ stage: 'd', phase_score: 70 }),
    ];
    const weak = getWeakTop3(records);
    expect(weak).toHaveLength(3);
    expect(weak[0]!.stage).toBe('c');
    expect(weak[0]!.score).toBe(30);
    expect(weak[1]!.stage).toBe('b');
    expect(weak[2]!.stage).toBe('d');
  });

  it('displays effectiveStage implement for stage=tasks+trigger_stage=speckit_5_2 (Story 9.2)', () => {
    const records = [
      createRecord({ stage: 'tasks', trigger_stage: 'speckit_5_2', phase_score: 65 }),
    ];
    const weak = getWeakTop3(records);
    expect(weak).toHaveLength(1);
    expect(weak[0]!.stage).toBe('implement');
  });

  it('Story 9.4: includes evolution_trace when iteration_records have overall_grade', () => {
    const records = [
      createRecord({
        stage: 'spec',
        phase_score: 60,
        iteration_records: [
          { timestamp: '2026-03-06T10:00:00Z', result: 'fail' as const, severity: 'normal' as const, overall_grade: 'C' },
          { timestamp: '2026-03-06T11:00:00Z', result: 'pass' as const, severity: 'normal' as const, overall_grade: 'B' },
        ],
      }),
    ];
    const weak = getWeakTop3(records);
    expect(weak).toHaveLength(1);
    expect(weak[0]!.evolution_trace).toBe('第1轮 C → 第2轮 B');
  });
});

describe('aggregateByEpicStoryTimeWindow (E9-S1 T9)', () => {
  it('filters by epic/story and time window', () => {
    const now = Date.now();
    const recent = new Date(now - 1 * 60 * 60 * 1000).toISOString();
    const old = new Date(now - 25 * 60 * 60 * 1000).toISOString();
    const records = [
      createRecord({ run_id: 'dev-e8-s1-spec-1', stage: 'spec', timestamp: recent }),
      createRecord({ run_id: 'dev-e8-s2-spec-1', stage: 'spec', timestamp: recent }),
      createRecord({ run_id: 'dev-e8-s1-plan-1', stage: 'plan', timestamp: old }),
    ];
    const result = aggregateByEpicStoryTimeWindow(records, 8, 1, 24);
    expect(result).toHaveLength(1);
    expect(result[0]!.run_id).toBe('dev-e8-s1-spec-1');
  });
});

describe('getLatestRunRecordsV2 (E9-S1 T9)', () => {
  it('strategy run_id returns same as getLatestRunRecords', () => {
    const records = [
      createRecord({ run_id: 'run-a', timestamp: '2026-03-05T10:00:00Z', stage: 'spec' }),
      createRecord({ run_id: 'run-a', timestamp: '2026-03-05T10:00:00Z', stage: 'plan' }),
      createRecord({ run_id: 'run-b', timestamp: '2026-03-06T12:00:00Z', stage: 'spec' }),
    ];
    const v2 = getLatestRunRecordsV2(records, { strategy: 'run_id' });
    const v1 = getLatestRunRecords(records);
    expect(v2).toEqual(v1);
  });

  it('strategy epic_story_window returns complete run with >=2 stages', () => {
    const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const records = [
      createRecord({ run_id: 'dev-e9-s1-x', stage: 'story', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s1-x', stage: 'implement', timestamp: recent }),
    ];
    const result = getLatestRunRecordsV2(records, {
      strategy: 'epic_story_window',
      epic: 9,
      story: 1,
      windowHours: 168,
    });
    expect(result).toHaveLength(2);
    expect(new Set(result.map((r) => r.stage)).size).toBe(2);
  });

  it('strategy epic_story_window returns complete run with 3 stages (still valid)', () => {
    const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const records = [
      createRecord({ run_id: 'dev-e9-s1-x', stage: 'spec', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s1-x', stage: 'plan', timestamp: recent }),
      createRecord({ run_id: 'dev-e9-s1-x', stage: 'tasks', timestamp: recent }),
    ];
    const result = getLatestRunRecordsV2(records, {
      strategy: 'epic_story_window',
      epic: 9,
      story: 1,
      windowHours: 168,
    });
    expect(result).toHaveLength(3);
    expect(new Set(result.map((r) => r.stage)).size).toBe(3);
  });

  it('strategy epic_story_window accepts stage=implement as complete run (Story 9.2)', () => {
    const base = Date.now() - 2 * 60 * 60 * 1000;
    const records = [
      createRecord({ run_id: 'dev-e9-s2-spec-1', stage: 'spec', timestamp: new Date(base).toISOString() }),
      createRecord({ run_id: 'dev-e9-s2-plan-2', stage: 'plan', timestamp: new Date(base + 30 * 60 * 1000).toISOString() }),
      createRecord({ run_id: 'dev-e9-s2-implement-3', stage: 'implement', timestamp: new Date(base + 60 * 60 * 1000).toISOString() }),
    ];
    const result = getLatestRunRecordsV2(records, {
      strategy: 'epic_story_window',
      epic: 9,
      story: 2,
      windowHours: 168,
    });
    expect(result).toHaveLength(3);
    expect(new Set(result.map((r) => r.stage)).has('implement')).toBe(true);
    expect(new Set(result.map((r) => r.stage)).size).toBe(3);
  });

  it('strategy epic_story_window treats different run_ids per stage as one run (Epic 9 pattern)', () => {
    const base = Date.now() - 2 * 60 * 60 * 1000;
    const records = [
      createRecord({ run_id: 'dev-e9-s1-spec-1772797518938', stage: 'spec', timestamp: new Date(base).toISOString() }),
      createRecord({ run_id: 'dev-e9-s1-plan-1772798018940', stage: 'plan', timestamp: new Date(base + 30 * 60 * 1000).toISOString() }),
      createRecord({ run_id: 'dev-e9-s1-tasks-1772798984398', stage: 'tasks', timestamp: new Date(base + 60 * 60 * 1000).toISOString() }),
    ];
    const result = getLatestRunRecordsV2(records, {
      strategy: 'epic_story_window',
      epic: 9,
      story: 1,
      windowHours: 168,
    });
    expect(result).toHaveLength(3);
    expect(new Set(result.map((r) => r.stage)).size).toBe(3);
  });

  it('strategy epic_story_window treats stage=tasks+trigger_stage=speckit_5_2 as implement (Story 9.2 backward compat)', () => {
    const base = Date.now() - 2 * 60 * 60 * 1000;
    const records = [
      createRecord({ run_id: 'dev-e9-s2-spec-1', stage: 'spec', timestamp: new Date(base).toISOString() }),
      createRecord({ run_id: 'dev-e9-s2-plan-2', stage: 'plan', timestamp: new Date(base + 30 * 60 * 1000).toISOString() }),
      createRecord({
        run_id: 'dev-e9-s2-tasks-3',
        stage: 'tasks',
        trigger_stage: 'speckit_5_2',
        timestamp: new Date(base + 60 * 60 * 1000).toISOString(),
      }),
    ];
    const result = getLatestRunRecordsV2(records, {
      strategy: 'epic_story_window',
      epic: 9,
      story: 2,
      windowHours: 168,
    });
    expect(result).toHaveLength(3);
    const effectiveStages = new Set(result.map((r) => effectiveStage(r)));
    expect(effectiveStages.has('implement')).toBe(true);
    expect(effectiveStages.size).toBe(3);
  });
});

describe('getWeakTop3EpicStory (E9-S1 T12)', () => {
  it('aggregates by epic/story and takes min score per story', () => {
    const records = [
      createRecord({ run_id: 'dev-e1-s1-x', stage: 'spec', phase_score: 90 }),
      createRecord({ run_id: 'dev-e1-s1-x', stage: 'plan', phase_score: 50 }),
      createRecord({ run_id: 'dev-e2-s1-x', stage: 'spec', phase_score: 40 }),
      createRecord({ run_id: 'dev-e3-s1-x', stage: 'spec', phase_score: 70 }),
    ];
    const weak = getWeakTop3EpicStory(records);
    expect(weak).toHaveLength(3);
    expect(weak[0]!.epicStory).toBe('E2.S1');
    expect(weak[0]!.score).toBe(40);
    expect(weak[1]!.epicStory).toBe('E1.S1');
    expect(weak[1]!.score).toBe(50);
  });
});

describe('countVetoTriggers', () => {
  it('counts passed=false items in veto config (excludes non-veto items)', () => {
    // veto_core_logic is a known veto item_id from buildVetoItemIds (implement-scoring.yaml ref)
    const vetoId = 'veto_core_logic';
    const records = [
      createRecord({
        check_items: [
          { item_id: vetoId, passed: false, score_delta: -10 },
          { item_id: 'other', passed: false, score_delta: -5 },
        ],
      }),
    ];
    const count = countVetoTriggers(records);
    expect(count).toBe(1); // only veto_core_logic counts; 'other' is not in vetoIds
  });

  it('returns 0 when no veto items triggered or empty check_items', () => {
    const records = [
      createRecord({ check_items: [] }),
      createRecord({ check_items: [{ item_id: 'non_veto', passed: false, score_delta: -5 }] }),
    ];
    expect(countVetoTriggers(records)).toBe(0);
  });
});

describe('getJourneyContractSummary', () => {
  it('returns journey contract summary sorted by frequency desc', () => {
    const records = [
      createRecord({
        run_id: 'dev-e6-s4-tasks-1',
        stage: 'tasks',
        journey_contract_signals: {
          smoke_task_chain: true,
          closure_task_id: true,
        },
      }),
      createRecord({
        run_id: 'dev-e6-s5-tasks-2',
        stage: 'tasks',
        journey_contract_signals: {
          smoke_task_chain: true,
        },
      }),
      createRecord({
        run_id: 'dev-e6-s4-implement-3',
        stage: 'tasks',
        trigger_stage: 'speckit_5_2',
        journey_contract_signals: {
          shared_path_reference: true,
        },
      }),
    ];

    const summary = getJourneyContractSummary(records);

    expect(summary[0]).toMatchObject({
      signal: 'smoke_task_chain',
      count: 2,
      affected_stages: ['tasks'],
      epic_stories: ['E6.S4', 'E6.S5'],
    });
    expect(summary.find((item) => item.signal === 'shared_path_reference')).toMatchObject({
      affected_stages: ['implement'],
      epic_stories: ['E6.S4'],
    });
  });
});

describe('getGovernanceRoutingSummary', () => {
  it('summarizes the latest governance rerun history from score records instead of runtime state', () => {
    const records = [
      createRecord({
        run_id: 'dev-e6-s4-plan-1',
        stage: 'plan',
        timestamp: '2026-03-28T10:00:00.000Z',
        governance_rerun_history: [
          {
            event_id: 'gov-evt-1',
            timestamp: '2026-03-28T10:05:00.000Z',
            rerun_gate: 'brief-gate',
            outcome: 'blocked',
            decision_mode: 'generic',
            executor_routing: {
              routing_mode: 'generic',
              executor_route: 'default-gate-remediation',
              prioritized_signals: [],
            },
            summary_lines: [
              'Routing Mode: generic',
              'Executor Route: default-gate-remediation',
              'Stop Reason: (none)',
              'Journey Contract Signals: (none)',
            ],
          },
        ],
      }),
      createRecord({
        run_id: 'dev-e6-s4-implement-2',
        stage: 'tasks',
        trigger_stage: 'speckit_5_2',
        timestamp: '2026-03-28T11:00:00.000Z',
        governance_rerun_history: [
          {
            event_id: 'gov-evt-2',
            timestamp: '2026-03-28T11:15:00.000Z',
            rerun_gate: 'implementation-readiness',
            outcome: 'blocked',
            decision_mode: 'targeted',
            executor_routing: {
              routing_mode: 'targeted',
              executor_route: 'journey-contract-remediation',
              prioritized_signals: ['closure_task_id', 'smoke_task_chain'],
            },
            summary_lines: [
              'Routing Mode: targeted',
              'Executor Route: journey-contract-remediation',
              'Stop Reason: (none)',
              'Journey Contract Signals: closure_task_id, smoke_task_chain',
            ],
          },
        ],
      }),
    ];

    const summary = getGovernanceRoutingSummary(records);

    expect(summary).toMatchObject({
      routingMode: 'targeted',
      executorRoute: 'journey-contract-remediation',
      prioritizedSignals: ['closure_task_id', 'smoke_task_chain'],
      source: 'scoring-governance-history',
      latestTimestamp: '2026-03-28T11:15:00.000Z',
      eventCount: 2,
      affectedStages: ['implement', 'plan'],
    });
    expect(summary?.summaryLines).toEqual([
      'Routing Mode: targeted',
      'Executor Route: journey-contract-remediation',
      'Stop Reason: (none)',
      'Journey Contract Signals: closure_task_id, smoke_task_chain',
    ]);
  });
});

describe('governance history dashboard metrics', () => {
  const records = [
    createRecord({
      run_id: 'dev-e6-s4-plan-1',
      stage: 'plan',
      governance_rerun_history: [
        {
          event_id: 'gov-evt-1',
          timestamp: '2026-03-28T10:00:00.000Z',
          rerun_gate: 'brief-gate',
          outcome: 'pass',
          decision_mode: 'generic',
          executor_routing: {
            routing_mode: 'generic',
            executor_route: 'default-gate-remediation',
            prioritized_signals: [],
          },
        },
        {
          event_id: 'gov-evt-2',
          timestamp: '2026-03-28T10:10:00.000Z',
          rerun_gate: 'brief-gate',
          outcome: 'blocked',
          decision_mode: 'generic',
          executor_routing: {
            routing_mode: 'generic',
            executor_route: 'default-gate-remediation',
            prioritized_signals: [],
          },
        },
      ],
    }),
    createRecord({
      run_id: 'dev-e6-s4-implement-2',
      stage: 'tasks',
      trigger_stage: 'speckit_5_2',
      governance_rerun_history: [
        {
          event_id: 'gov-evt-3',
          timestamp: '2026-03-28T10:20:00.000Z',
          rerun_gate: 'implementation-readiness',
          outcome: 'blocked',
          decision_mode: 'targeted',
          executor_routing: {
            routing_mode: 'targeted',
            executor_route: 'journey-contract-remediation',
            prioritized_signals: ['smoke_task_chain'],
          },
        },
        {
          event_id: 'gov-evt-4',
          timestamp: '2026-03-28T10:30:00.000Z',
          rerun_gate: 'implementation-readiness',
          outcome: 'blocked',
          decision_mode: 'targeted',
          executor_routing: {
            routing_mode: 'targeted',
            executor_route: 'journey-contract-remediation',
            prioritized_signals: ['closure_task_id', 'smoke_task_chain'],
          },
        },
      ],
    }),
  ];

  it('returns routing mode distribution', () => {
    expect(getGovernanceRoutingModeDistribution(records)).toEqual([
      { mode: 'generic', count: 2 },
      { mode: 'targeted', count: 2 },
    ]);
  });

  it('returns governance signal hotspots', () => {
    expect(getGovernanceSignalHotspots(records)).toEqual([
      {
        signal: 'smoke_task_chain',
        count: 2,
        affected_stages: ['implement'],
        rerun_gates: ['implementation-readiness'],
      },
      {
        signal: 'closure_task_id',
        count: 1,
        affected_stages: ['implement'],
        rerun_gates: ['implementation-readiness'],
      },
    ]);
  });

  it('returns rerun gate failure trend', () => {
    expect(getGovernanceRerunGateFailureTrend(records)).toEqual([
      {
        rerun_gate: 'implementation-readiness',
        failure_count: 2,
        total_events: 2,
        latest_outcome: 'blocked',
        latest_timestamp: '2026-03-28T10:30:00.000Z',
        trend: 'flat',
      },
      {
        rerun_gate: 'brief-gate',
        failure_count: 1,
        total_events: 2,
        latest_outcome: 'blocked',
        latest_timestamp: '2026-03-28T10:10:00.000Z',
        trend: 'worsening',
      },
    ]);
  });
});

describe('getTrend', () => {
  it('returns 持平 for single run', () => {
    const records = [
      createRecord({ run_id: 'run-1', timestamp: '2026-03-06T12:00:00Z' }),
    ];
    expect(getTrend(records)).toBe('持平');
  });

  it('returns 升 when latest > previous', () => {
    const records = [
      createRecord({ run_id: 'run-new', timestamp: '2026-03-06T12:00:00Z', phase_score: 90, phase_weight: 20 }),
      createRecord({ run_id: 'run-old', timestamp: '2026-03-05T10:00:00Z', phase_score: 60, phase_weight: 20 }),
    ];
    expect(getTrend(records)).toBe('升');
  });

  it('returns 降 when latest < previous', () => {
    const records = [
      createRecord({ run_id: 'run-new', timestamp: '2026-03-06T12:00:00Z', phase_score: 50, phase_weight: 20 }),
      createRecord({ run_id: 'run-old', timestamp: '2026-03-05T10:00:00Z', phase_score: 80, phase_weight: 20 }),
    ];
    expect(getTrend(records)).toBe('降');
  });
});
