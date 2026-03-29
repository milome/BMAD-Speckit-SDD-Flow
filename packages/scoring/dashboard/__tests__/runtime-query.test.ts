import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as candidateBuilder from '../../analytics/candidate-builder';
import type { CanonicalSftSample } from '../../analytics/types';
import type { RuntimeEvent } from '../../runtime/types';
import type { RunScoreRecord } from '../../writer/types';
import { buildRuntimeDashboardModel } from '../runtime-query';

function makeEvent(overrides: Partial<RuntimeEvent> = {}): RuntimeEvent {
  return {
    event_id: 'evt-001',
    event_type: 'run.created',
    event_version: 1,
    timestamp: '2026-03-28T00:00:00.000Z',
    run_id: 'run-e15-s1-001',
    flow: 'story',
    payload: {},
    ...overrides,
  };
}

function makeScoreRecord(overrides: Partial<RunScoreRecord> = {}): RunScoreRecord {
  return {
    run_id: 'run-e15-s1-001',
    scenario: 'real_dev',
    stage: 'implement',
    phase_score: 92,
    phase_weight: 1,
    check_items: [],
    timestamp: '2026-03-28T00:05:00.000Z',
    iteration_count: 0,
    iteration_records: [],
    first_pass: true,
    source_path: 'docs/plans/story-15-1-runtime-dashboard.md',
    ...overrides,
  };
}

function createSourceFixture(): {
  root: string;
  sourcePath: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-query-sft-'));
  const sourcePath = 'docs/plans/BUGFIX_runtime-dashboard-sft.md';
  const absoluteSourcePath = path.join(root, sourcePath);

  fs.mkdirSync(path.dirname(absoluteSourcePath), { recursive: true });
  fs.writeFileSync(
    absoluteSourcePath,
    [
      '## §1 问题',
      'runtime dashboard 尚未展示 canonical SFT builder 状态。',
      '',
      '## §4 修复方案',
      '把 query core、MCP 与 live dashboard 统一到 canonical candidate pipeline。',
      '',
    ].join('\n'),
    'utf-8'
  );

  return {
    root,
    sourcePath,
  };
}

describe('runtime-aware dashboard query', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves the latest active runtime run ahead of older scored runs', () => {
    const snapshot = buildRuntimeDashboardModel({
      events: [
        makeEvent({
          run_id: 'run-e15-s1-older',
          event_id: 'evt-010',
          timestamp: '2026-03-28T00:00:00.000Z',
          payload: { status: 'pending' },
          scope: { story_key: '15-1-runtime-dashboard-sft', flow: 'story' },
        }),
        makeEvent({
          run_id: 'run-e15-s1-older',
          event_id: 'evt-011',
          event_type: 'stage.completed',
          stage: 'implement',
          timestamp: '2026-03-28T00:10:00.000Z',
          payload: { status: 'passed' },
        }),
        makeEvent({
          run_id: 'run-e15-s1-active',
          event_id: 'evt-020',
          timestamp: '2026-03-28T01:00:00.000Z',
          payload: { status: 'pending' },
          scope: { story_key: '15-1-runtime-dashboard-sft', flow: 'story' },
        }),
        makeEvent({
          run_id: 'run-e15-s1-active',
          event_id: 'evt-021',
          event_type: 'stage.started',
          stage: 'plan',
          timestamp: '2026-03-28T01:05:00.000Z',
          payload: { status: 'running' },
        }),
      ],
      scoreRecords: [
        makeScoreRecord({
          run_id: 'run-e15-s1-older',
          stage: 'implement',
          timestamp: '2026-03-28T00:10:00.000Z',
          phase_score: 95,
        }),
      ],
    });

    expect(snapshot.selection.run_id).toBe('run-e15-s1-active');
    expect(snapshot.selection.source).toBe('runtime');
    expect(snapshot.runtime_context.current_stage).toBe('plan');
    expect(snapshot.overview.status).toBe('running');
    expect(snapshot.score_detail.records).toEqual([]);
  });

  it('builds a runtime-aware snapshot with score detail, timeline, and trend', () => {
    const fixture = createSourceFixture();
    const samples: CanonicalSftSample[] = [
      {
        sample_id: 'sample-runtime-query-001',
        sample_version: 'v1',
        source: {
          run_id: 'run-e15-s1-001',
          stage: 'implement',
          flow: 'story',
          score_record_id: 'run-e15-s1-001:implement',
          event_ids: ['score:run-e15-s1-001:implement'],
          artifact_refs: [
            {
              path: fixture.sourcePath,
              content_hash: 'sha256:content-001',
              source_hash: 'sha256:source-001',
              kind: 'md',
            },
          ],
        },
        messages: [
          { role: 'system', content: 'You are a senior coding agent.' },
          { role: 'user', content: 'Explain runtime dashboard SFT integration.' },
          { role: 'assistant', content: 'Wire query core, MCP, and live dashboard together.' },
        ],
        metadata: {
          schema_targets: ['openai_chat', 'hf_conversational'],
          language: 'zh-CN',
          notes: [],
        },
        quality: {
          acceptance_decision: 'accepted',
          phase_score: 91,
          raw_phase_score: 91,
          dimension_scores: {
            功能性: 93,
            代码质量: 88,
          },
          veto_triggered: false,
          iteration_count: 0,
          has_code_pair: true,
          token_estimate: 64,
          dedupe_cluster_id: null,
          safety_flags: [],
          rejection_reasons: [],
          warnings: [],
        },
        provenance: {
          base_commit_hash: 'base-commit-001',
          content_hash: 'sha256:content-001',
          source_hash: 'sha256:source-001',
          source_path: fixture.sourcePath,
          patch_ref: 'sha256:patch-001',
          generated_at: '2026-03-28T00:05:30.000Z',
          lineage: ['run-e15-s1-001', 'run-e15-s1-001:implement'],
        },
        split: {
          assignment: 'train',
          group_key: 'epic-15/story-15-1-runtime-dashboard-sft',
          seed: 42,
        },
        redaction: {
          status: 'clean',
          applied_rules: [],
          findings: [],
          redacted_fields: [],
        },
        export_compatibility: {
          openai_chat: { compatible: true, reasons: [], warnings: [] },
          hf_conversational: { compatible: true, reasons: [], warnings: [] },
          hf_tool_calling: {
            compatible: false,
            reasons: ['target_incompatible_hf_tool_calling'],
            warnings: [],
          },
        },
      },
    ];
    vi.spyOn(candidateBuilder, 'buildCanonicalCandidatesFromRecordsSync').mockReturnValue({
      samples,
    });

    try {
      const snapshot = buildRuntimeDashboardModel({
        root: fixture.root,
        events: [
          makeEvent({
            event_id: 'evt-001',
            payload: { status: 'pending' },
            scope: {
              story_key: '15-1-runtime-dashboard-sft',
              epic_id: 'epic-15',
              story_id: '15-1-runtime-dashboard-sft',
              flow: 'story',
              resolved_context_path: '_bmad-output/runtime/context/runs/epic-15/15-1-runtime-dashboard-sft/run.json',
            },
          }),
          makeEvent({
            event_id: 'evt-002',
            event_type: 'stage.started',
            stage: 'implement',
            timestamp: '2026-03-28T00:01:00.000Z',
            payload: { status: 'running' },
          }),
          makeEvent({
            event_id: 'evt-003',
            event_type: 'score.written',
            stage: 'implement',
            timestamp: '2026-03-28T00:05:00.000Z',
            payload: {
              score_record_id: 'run-e15-s1-001:implement',
              phase_score: 91,
              veto_triggered: false,
            },
          }),
          makeEvent({
            event_id: 'evt-005',
            event_type: 'stage.completed',
            stage: 'implement',
            timestamp: '2026-03-28T00:07:00.000Z',
            payload: { status: 'passed' },
          }),
        ],
        scoreRecords: [
          makeScoreRecord({
            phase_score: 91,
            iteration_count: 0,
            first_pass: true,
            source_path: fixture.sourcePath,
            base_commit_hash: 'base-commit-001',
            content_hash: 'sha256:content-001',
            source_hash: 'sha256:source-001',
            dimension_scores: [
              { dimension: '功能性', weight: 25, score: 93 },
              { dimension: '代码质量', weight: 25, score: 88 },
            ],
          }),
          makeScoreRecord({
            run_id: 'run-e15-s1-prev',
            timestamp: '2026-03-27T00:07:00.000Z',
            phase_score: 70,
            phase_weight: 1,
            source_path: fixture.sourcePath,
            base_commit_hash: 'base-commit-001',
            content_hash: 'sha256:content-prev',
            source_hash: 'sha256:source-prev',
          }),
        ],
      });

      expect(snapshot.selection.run_id).toBe('run-e15-s1-001');
      expect(snapshot.overview.health_score).toBe(91);
      expect(snapshot.overview.veto_count).toBe(0);
      expect(snapshot.overview.trend).toBe('升');
      expect(snapshot.runtime_context.scope?.resolved_context_path).toContain('_bmad-output/runtime/context/runs');
      expect(snapshot.stage_timeline).toEqual([
        expect.objectContaining({
          stage: 'implement',
          status: 'passed',
          phase_score: 91,
          veto_triggered: false,
          iteration_count: 0,
        }),
      ]);
      expect(snapshot.score_detail.records).toEqual([
        expect.objectContaining({
          stage: 'implement',
          phase_score: 91,
          veto_triggered: false,
          iteration_count: 0,
        }),
      ]);
      expect(snapshot.sft_summary.total_candidates).toBe(1);
      expect(snapshot.sft_summary.accepted).toBe(1);
      expect(
        snapshot.sft_summary.by_split.train +
          snapshot.sft_summary.by_split.validation +
          snapshot.sft_summary.by_split.test +
          snapshot.sft_summary.by_split.holdout
      ).toBe(1);
      expect(snapshot.sft_summary.target_availability.openai_chat.compatible).toBe(1);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it('gracefully falls back when runtime events exist but scores do not', () => {
    const snapshot = buildRuntimeDashboardModel({
      events: [
        makeEvent({
          payload: { status: 'pending' },
          scope: { story_key: '15-1-runtime-dashboard-sft', flow: 'story' },
        }),
        makeEvent({
          event_id: 'evt-002',
          event_type: 'stage.started',
          stage: 'tasks',
          timestamp: '2026-03-28T00:01:00.000Z',
          payload: { status: 'running' },
        }),
      ],
      scoreRecords: [],
    });

    expect(snapshot.selection.run_id).toBe('run-e15-s1-001');
    expect(snapshot.runtime_context.current_stage).toBe('tasks');
    expect(snapshot.overview.health_score).toBeNull();
    expect(snapshot.score_detail.records).toEqual([]);
    expect(snapshot.stage_timeline).toEqual([
      expect.objectContaining({
        stage: 'tasks',
        status: 'running',
      }),
    ]);
  });

  it('gracefully falls back when scores exist but runtime events do not', () => {
    const snapshot = buildRuntimeDashboardModel({
      events: [],
      scoreRecords: [
        makeScoreRecord({
          run_id: 'run-e15-s1-fallback',
          stage: 'spec',
          timestamp: '2026-03-28T00:01:00.000Z',
          phase_score: 82,
          phase_weight: 0.4,
        }),
        makeScoreRecord({
          run_id: 'run-e15-s1-fallback',
          stage: 'plan',
          timestamp: '2026-03-28T00:02:00.000Z',
          phase_score: 88,
          phase_weight: 0.6,
        }),
      ],
    });

    expect(snapshot.selection.run_id).toBe('run-e15-s1-fallback');
    expect(snapshot.selection.source).toBe('scores');
    expect(snapshot.runtime_context.status).toBe('passed');
    expect(snapshot.runtime_context.current_stage).toBe('plan');
    expect(snapshot.stage_timeline).toEqual([
      expect.objectContaining({
        stage: 'spec',
        status: 'passed',
        phase_score: 82,
      }),
      expect.objectContaining({
        stage: 'plan',
        status: 'passed',
        phase_score: 88,
      }),
    ]);
    expect(snapshot.score_detail.records).toHaveLength(2);
    expect(snapshot.overview.health_score).toBe(86);
  });
});
