import { describe, expect, it } from 'vitest';
import {
  summarizeGovernanceRoutingModeDistribution,
  summarizeGovernanceSignalHotspots,
  summarizeGovernanceRerunGateFailureTrend,
} from '../governance-history-metrics';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(overrides: Partial<RunScoreRecord> = {}): RunScoreRecord {
  return {
    run_id: 'dev-e1-s1-plan-1',
    scenario: 'real_dev',
    stage: 'plan',
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

describe('governance history metrics', () => {
  const records: RunScoreRecord[] = [
    makeRecord({
      run_id: 'dev-e1-s1-plan-1',
      stage: 'plan',
      governance_rerun_history: [
        {
          event_id: 'gov-evt-1',
          timestamp: '2026-03-28T10:00:00Z',
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
          timestamp: '2026-03-28T10:10:00Z',
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
    makeRecord({
      run_id: 'dev-e1-s1-implement-2',
      stage: 'tasks',
      trigger_stage: 'speckit_5_2',
      governance_rerun_history: [
        {
          event_id: 'gov-evt-3',
          timestamp: '2026-03-28T10:20:00Z',
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
          timestamp: '2026-03-28T10:30:00Z',
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

  it('summarizes routing mode distribution across governance history', () => {
    expect(summarizeGovernanceRoutingModeDistribution(records)).toEqual([
      { mode: 'generic', count: 2 },
      { mode: 'targeted', count: 2 },
    ]);
  });

  it('summarizes governance signal hotspots with stages and rerun gates', () => {
    expect(summarizeGovernanceSignalHotspots(records)).toEqual([
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

  it('summarizes rerun gate failure trend using governance history outcomes', () => {
    expect(summarizeGovernanceRerunGateFailureTrend(records)).toEqual([
      {
        rerun_gate: 'implementation-readiness',
        failure_count: 2,
        total_events: 2,
        latest_outcome: 'blocked',
        latest_timestamp: '2026-03-28T10:30:00Z',
        trend: 'flat',
      },
      {
        rerun_gate: 'brief-gate',
        failure_count: 1,
        total_events: 2,
        latest_outcome: 'blocked',
        latest_timestamp: '2026-03-28T10:10:00Z',
        trend: 'worsening',
      },
    ]);
  });
});
