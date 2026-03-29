import { describe, expect, it } from 'vitest';
import { summarizeGovernanceRouting } from '../governance-routing-summary';
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

describe('summarizeGovernanceRouting', () => {
  it('returns the latest routing summary and affected stages from governance rerun history', () => {
    const records: RunScoreRecord[] = [
      makeRecord({
        run_id: 'dev-e1-s1-plan-1',
        governance_rerun_history: [
          {
            event_id: 'gov-evt-1',
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
            event_id: 'gov-evt-2',
            timestamp: '2026-03-28T10:20:00Z',
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
              'Stop Reason: await human review',
            ],
            runner_summary_lines: [
              '## Governance Remediation Runner Summary',
              '- Stop Reason: await human review',
              '',
              '## Loop State Trace Summary',
              '- Journey Contract Signals: closure_task_id, smoke_task_chain',
            ],
          },
        ],
      }),
    ];

    expect(summarizeGovernanceRouting(records)).toMatchObject({
      routingMode: 'targeted',
      executorRoute: 'journey-contract-remediation',
      prioritizedSignals: ['closure_task_id', 'smoke_task_chain'],
      summaryLines: [
        'Routing Mode: targeted',
        'Executor Route: journey-contract-remediation',
        'Stop Reason: await human review',
      ],
      runnerSummaryLines: [
        '## Governance Remediation Runner Summary',
        '- Stop Reason: await human review',
        '',
        '## Loop State Trace Summary',
        '- Journey Contract Signals: closure_task_id, smoke_task_chain',
      ],
      source: 'scoring-governance-history',
      latestTimestamp: '2026-03-28T10:20:00Z',
      eventCount: 2,
      affectedStages: ['implement', 'plan'],
    });
  });

  it('returns undefined when no governance rerun history exists', () => {
    expect(summarizeGovernanceRouting([makeRecord()])).toBeUndefined();
  });
});
