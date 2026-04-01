import { describe, expect, it } from 'vitest';
import { buildRunProjection } from '../projection';
import type { RuntimeEvent } from '../types';

function makeEvent(overrides: Partial<RuntimeEvent> = {}): RuntimeEvent {
  return {
    event_id: 'evt-001',
    event_type: 'run.created',
    event_version: 1,
    timestamp: '2026-03-28T00:00:00.000Z',
    run_id: 'run-001',
    flow: 'story',
    payload: {},
    ...overrides,
  };
}

describe('runtime projection', () => {
  it('rebuilds one run projection from mixed runtime events', () => {
    const projection = buildRunProjection(
      [
        makeEvent({
          scope: {
            story_key: '15-1-runtime-dashboard-sft',
            story_id: '1',
            epic_id: '15',
            artifact_root: 'docs/plans',
            host: 'cursor',
            host_kind: 'cursor',
            flow: 'story',
          },
          payload: { status: 'pending' },
        }),
        makeEvent({
          event_id: 'evt-002',
          event_type: 'stage.started',
          stage: 'implement',
          timestamp: '2026-03-28T00:00:01.000Z',
          scope: { story_key: '15-1-runtime-dashboard-sft', flow: 'story' },
          payload: {},
        }),
        makeEvent({
          event_id: 'evt-003',
          event_type: 'artifact.attached',
          stage: 'implement',
          timestamp: '2026-03-28T00:00:02.000Z',
          payload: {
            kind: 'audit_report',
            path: 'docs/plans/runtime-dashboard-audit.md',
            content_hash: 'sha256:artifact-001',
          },
        }),
        makeEvent({
          event_id: 'evt-004',
          event_type: 'score.written',
          stage: 'implement',
          timestamp: '2026-03-28T00:00:03.000Z',
          payload: {
            score_record_id: 'score-001',
            path: '_bmad-output/scoring/run-001-implement.json',
          },
        }),
        makeEvent({
          event_id: 'evt-005',
          event_type: 'sft.candidate.built',
          stage: 'implement',
          timestamp: '2026-03-28T00:00:04.000Z',
          payload: {
            sample_id: 'sample-001',
            status: 'accepted',
            split_assignment: 'train',
          },
        }),
        makeEvent({
          event_id: 'evt-006',
          event_type: 'stage.completed',
          stage: 'implement',
          timestamp: '2026-03-28T00:00:05.000Z',
          payload: {
            status: 'passed',
          },
        }),
      ],
      'run-001'
    );

    expect(projection).not.toBeNull();
    expect(projection?.status).toBe('passed');
    expect(projection?.current_stage).toBe('implement');
    expect(projection?.current_scope?.story_key).toBe('15-1-runtime-dashboard-sft');
    expect(projection?.current_scope?.story_id).toBe('1');
    expect(projection?.current_scope?.epic_id).toBe('15');
    expect(projection?.current_scope?.artifact_root).toBe('docs/plans');
    expect(projection?.current_scope?.host).toBe('cursor');
    expect(projection?.current_scope?.host_kind).toBe('cursor');
    expect(projection?.stage_history).toEqual([
      {
        stage: 'implement',
        status: 'passed',
        started_at: '2026-03-28T00:00:01.000Z',
        completed_at: '2026-03-28T00:00:05.000Z',
      },
    ]);
    expect(projection?.score_refs).toEqual([
      {
        score_record_id: 'score-001',
        stage: 'implement',
        path: '_bmad-output/scoring/run-001-implement.json',
        timestamp: '2026-03-28T00:00:03.000Z',
      },
    ]);
    expect(projection?.artifact_refs).toEqual([
      {
        kind: 'audit_report',
        path: 'docs/plans/runtime-dashboard-audit.md',
        content_hash: 'sha256:artifact-001',
      },
    ]);
    expect(projection?.dataset_candidate_refs).toEqual([
      {
        sample_id: 'sample-001',
        status: 'accepted',
        split_assignment: 'train',
      },
    ]);
  });

  it('supports partial runs without any score records', () => {
    const projection = buildRunProjection(
      [
        makeEvent({
          payload: { status: 'pending' },
        }),
        makeEvent({
          event_id: 'evt-002',
          event_type: 'stage.started',
          stage: 'plan',
          timestamp: '2026-03-28T00:00:01.000Z',
          scope: { story_key: '15-1-runtime-dashboard-sft', flow: 'story' },
          payload: {},
        }),
      ],
      'run-001'
    );

    expect(projection).not.toBeNull();
    expect(projection?.status).toBe('running');
    expect(projection?.current_stage).toBe('plan');
    expect(projection?.score_refs).toEqual([]);
    expect(projection?.stage_history).toEqual([
      {
        stage: 'plan',
        status: 'running',
        started_at: '2026-03-28T00:00:01.000Z',
      },
    ]);
  });

  it('preserves existing identity fields when later scope patches omit them', () => {
    const projection = buildRunProjection(
      [
        makeEvent({
          scope: {
            story_key: '15-1-runtime-dashboard-sft',
            story_id: '1',
            epic_id: '15',
            artifact_root: 'docs/plans',
            host: 'cursor',
            host_kind: 'cursor',
          },
          payload: { status: 'pending' },
        }),
        makeEvent({
          event_id: 'evt-002',
          event_type: 'run.scope.changed',
          timestamp: '2026-03-28T00:00:01.000Z',
          scope: {
            flow: 'story',
            story_key: '15-1-runtime-dashboard-sft',
          },
          payload: {},
        }),
      ],
      'run-001'
    );

    expect(projection?.current_scope).toEqual(
      expect.objectContaining({
        story_key: '15-1-runtime-dashboard-sft',
        story_id: '1',
        epic_id: '15',
        artifact_root: 'docs/plans',
        host: 'cursor',
        host_kind: 'cursor',
      })
    );
  });

  it('projects status transitions across pending, running, passed, failed, and vetoed', () => {
    const pendingProjection = buildRunProjection([makeEvent()], 'run-001');
    const runningProjection = buildRunProjection(
      [makeEvent(), makeEvent({ event_id: 'evt-002', event_type: 'stage.started', stage: 'tasks' })],
      'run-001'
    );
    const failedProjection = buildRunProjection(
      [
        makeEvent(),
        makeEvent({ event_id: 'evt-002', event_type: 'stage.started', stage: 'tasks' }),
        makeEvent({
          event_id: 'evt-003',
          event_type: 'stage.failed',
          stage: 'tasks',
          timestamp: '2026-03-28T00:00:02.000Z',
          payload: {},
        }),
      ],
      'run-001'
    );
    const vetoedProjection = buildRunProjection(
      [
        makeEvent(),
        makeEvent({ event_id: 'evt-002', event_type: 'stage.started', stage: 'implement' }),
        makeEvent({
          event_id: 'evt-003',
          event_type: 'stage.vetoed',
          stage: 'implement',
          timestamp: '2026-03-28T00:00:02.000Z',
          payload: {},
        }),
      ],
      'run-001'
    );

    expect(pendingProjection?.status).toBe('pending');
    expect(runningProjection?.status).toBe('running');
    expect(failedProjection?.status).toBe('failed');
    expect(vetoedProjection?.status).toBe('vetoed');
  });
});
