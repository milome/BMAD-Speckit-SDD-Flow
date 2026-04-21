import { describe, expect, it } from 'vitest';
import {
  buildReadinessDriftProjection,
  deriveReadinessDriftSeverity,
  deriveReadinessDriftedDimensions,
  evaluateReadinessDrift,
} from '../readiness-drift';
import type { RunScoreRecord } from '../../writer/types';

function makeRecord(overrides: Partial<RunScoreRecord>): RunScoreRecord {
  return {
    run_id: 'run-default',
    scenario: 'real_dev',
    stage: 'implement',
    phase_score: 90,
    phase_weight: 0.25,
    check_items: [],
    timestamp: '2026-04-13T00:00:00.000Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    ...overrides,
  };
}

describe('readiness drift', () => {
  it('maps signal severity deterministically', () => {
    expect(deriveReadinessDriftSeverity(['journey_unlock'])).toBe('major');
    expect(deriveReadinessDriftSeverity(['smoke_task_chain'])).toBe('critical');
    expect(deriveReadinessDriftSeverity([])).toBe('none');
  });

  it('maps drifted dimensions deterministically', () => {
    expect(
      deriveReadinessDriftedDimensions(['smoke_task_chain', 'shared_path_reference'])
    ).toEqual([
      'Smoke E2E Readiness',
      'P0 Journey Coverage',
      'Evidence Proof Chain',
    ]);
  });

  it('blocks implement verdict when readiness baseline is missing', () => {
    const result = evaluateReadinessDrift({
      stage: 'implement',
      signals: {},
      allRecords: [],
    });

    expect(result.effective_verdict).toBe('blocked_pending_rereadiness');
    expect(result.re_readiness_required).toBe(true);
    expect(result.blocking_reason).toContain('Missing implementation readiness baseline');
  });

  it('blocks implement verdict when structured drift signal block is missing', () => {
    const baseline = makeRecord({
      run_id: 'run-readiness-1',
      stage: 'implementation_readiness',
      phase_score: 82,
    });

    const result = evaluateReadinessDrift({
      stage: 'implement',
      signals: {},
      signalBlockPresent: false,
      allRecords: [baseline],
    });

    expect(result.effective_verdict).toBe('blocked_pending_rereadiness');
    expect(result.re_readiness_required).toBe(true);
    expect(result.blocking_reason).toContain('Missing structured drift signal block');
  });

  it('returns required_fixes for major drift when baseline exists', () => {
    const baseline = makeRecord({
      run_id: 'run-readiness-1',
      stage: 'implementation_readiness',
      phase_score: 82,
      dimension_scores: [
        { dimension: 'P0 Journey Coverage', weight: 25, score: 80 },
        { dimension: 'Smoke E2E Readiness', weight: 25, score: 84 },
        { dimension: 'Evidence Proof Chain', weight: 25, score: 83 },
        { dimension: 'Cross-Document Traceability', weight: 25, score: 81 },
      ],
    });
    const implement = makeRecord({
      run_id: 'run-impl-1',
      journey_contract_signals: { journey_unlock: true },
    });

    const result = buildReadinessDriftProjection({
      currentRecord: implement,
      allRecords: [baseline, implement],
    });

    expect(result.readiness_baseline_run_id).toBe('run-readiness-1');
    expect(result.effective_verdict).toBe('required_fixes');
    expect(result.drift_severity).toBe('major');
    expect(result.drifted_dimensions).toContain('P0 Journey Coverage');
    expect(result.readiness_score).toBe(82);
  });

  it('returns blocked for critical drift when baseline exists', () => {
    const baseline = makeRecord({
      run_id: 'run-readiness-1',
      stage: 'implementation_readiness',
      phase_score: 90,
    });
    const implement = makeRecord({
      run_id: 'run-impl-2',
      journey_contract_signals: { smoke_task_chain: true },
    });

    const result = evaluateReadinessDrift({
      stage: 'implement',
      signals: implement.journey_contract_signals,
      allRecords: [baseline, implement],
    });

    expect(result.effective_verdict).toBe('blocked');
    expect(result.drift_severity).toBe('critical');
    expect(result.re_readiness_required).toBe(true);
  });

  it('applies the same drift logic to post_impl stage', () => {
    const baseline = makeRecord({
      run_id: 'run-readiness-1',
      stage: 'implementation_readiness',
      phase_score: 90,
    });

    const result = evaluateReadinessDrift({
      stage: 'post_impl',
      signals: { closure_task_id: true },
      signalBlockPresent: true,
      allRecords: [baseline],
    });

    expect(result.effective_verdict).toBe('blocked');
    expect(result.drift_severity).toBe('critical');
  });
});
