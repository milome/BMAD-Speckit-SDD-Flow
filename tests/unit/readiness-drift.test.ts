import { describe, expect, it } from 'vitest';
import { buildReadinessDriftProjection } from '../../packages/scoring/governance/readiness-drift';
import type { RunScoreRecord } from '../../packages/scoring/writer/types';

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

describe('readiness drift baseline precedence', () => {
  it('uses current requirement metadata before scoped or legacy scoring baselines', () => {
    const projection = buildReadinessDriftProjection({
      allRecords: [
        makeRecord({
          run_id: 'legacy-readiness',
          stage: 'implementation_readiness',
          phase_score: 70,
        }),
      ],
      requirementBaseline: {
        current: {
          status: 'current',
          scoringRunId: 'current-readiness',
          score: 96,
          rawScore: 96,
          dimensions: { 'P0 Journey Coverage': 96 },
          sourceDocumentHash: 'sha256:111',
          implementationConfirmationHash: 'sha256:222',
          architectureConfirmationHash: 'sha256:333',
        },
        scopedScoring: [
          {
            stage: 'implementation_readiness',
            scoringRunId: 'scoped-readiness',
            score: 88,
          },
        ],
        currentHashes: {
          sourceDocumentHash: 'sha256:111',
          implementationConfirmationHash: 'sha256:222',
          architectureConfirmationHash: 'sha256:333',
        },
      },
    });

    expect(projection.baseline_source).toBe('requirement_metadata');
    expect(projection.readiness_baseline_run_id).toBe('current-readiness');
    expect(projection.readiness_score).toBe(96);
    expect(projection.effective_verdict).toBe('approved');
  });

  it('uses requirement-scoped scoring before legacy data when current metadata is absent', () => {
    const projection = buildReadinessDriftProjection({
      allRecords: [
        makeRecord({
          run_id: 'legacy-readiness',
          stage: 'implementation_readiness',
          phase_score: 70,
        }),
      ],
      requirementBaseline: {
        scopedScoring: [
          {
            stage: 'implementation_readiness',
            scoringRunId: 'scoped-readiness',
            score: 88,
            dimensions: { 'Evidence Proof Chain': 88 },
          },
        ],
      },
    });

    expect(projection.baseline_source).toBe('requirement_scoped_scoring');
    expect(projection.readiness_baseline_run_id).toBe('scoped-readiness');
    expect(projection.readiness_score).toBe(88);
  });

  it('fails closed when current requirement metadata is stale', () => {
    const projection = buildReadinessDriftProjection({
      allRecords: [],
      requirementBaseline: {
        current: {
          status: 'current',
          scoringRunId: 'stale-readiness',
          score: 91,
          sourceDocumentHash: 'sha256:old',
          implementationConfirmationHash: 'sha256:222',
          architectureConfirmationHash: 'sha256:333',
        },
        currentHashes: {
          sourceDocumentHash: 'sha256:new',
          implementationConfirmationHash: 'sha256:222',
          architectureConfirmationHash: 'sha256:333',
        },
      },
    });

    expect(projection.baseline_source).toBe('stale_requirement_metadata');
    expect(projection.effective_verdict).toBe('blocked_pending_rereadiness');
    expect(projection.re_readiness_required).toBe(true);
    expect(projection.blocking_reason).toContain('sourceDocumentHash');
  });
});
