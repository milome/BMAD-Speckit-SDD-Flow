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
  writeLatestBundleFixture(root);

  return {
    root,
    sourcePath,
  };
}

function writeLatestBundleFixture(root: string): void {
  const bundleRoot = path.join(root, '_bmad-output', 'datasets', 'openai_chat-runtime-query');
  fs.mkdirSync(bundleRoot, { recursive: true });
  fs.writeFileSync(
    path.join(bundleRoot, 'manifest.json'),
    JSON.stringify(
      {
        bundle_id: 'openai_chat-runtime-query',
        bundle_version: 'v2',
        bundle_kind: 'training',
        export_target: 'openai_chat',
        created_at: '2026-03-28T00:10:00.000Z',
        canonical_schema_version: 'v1',
        exporter_version: 'v1-test',
        generator_version: 'bundle-writer.v2',
        source_scope: {
          scope_type: 'story',
          epic_id: 'epic-15',
          story_key: '15-1-runtime-dashboard-sft',
          work_item_id: 'story:15-1-runtime-dashboard-sft',
          board_group_id: 'epic:epic-15',
        },
        source_snapshot: { sample_count: 3 },
        export_hash: 'sha256:bundle-runtime-query',
        filter_settings: { min_score: 90 },
        split: { seed: 42, strategy: 'story_hash_v1' },
        counts: {
          total_candidates: 3,
          accepted: 2,
          rejected: 1,
          downgraded: 0,
          blocked: 1,
          train: 1,
          validation: 1,
          test: 1,
        },
        provider_summary: {},
        redaction_summary: {},
        validation_summary: {
          schema_valid: true,
          training_ready_passed: false,
        },
        artifacts: {
          train_path: 'train.jsonl',
          validation_path: 'validation.jsonl',
          test_path: 'test.jsonl',
          manifest_path: 'manifest.json',
          validation_report_path: 'validation-report.json',
          rejection_report_path: 'rejection-report.json',
        },
      },
      null,
      2
    ),
    'utf-8'
  );

  const globalBundleRoot = path.join(root, '_bmad-output', 'datasets', 'openai_chat-global-runtime-query');
  fs.mkdirSync(globalBundleRoot, { recursive: true });
  fs.writeFileSync(
    path.join(globalBundleRoot, 'manifest.json'),
    JSON.stringify(
      {
        bundle_id: 'openai_chat-global-runtime-query',
        bundle_version: 'v2',
        bundle_kind: 'training',
        export_target: 'openai_chat',
        created_at: '2026-03-28T00:12:00.000Z',
        canonical_schema_version: 'v1',
        exporter_version: 'v1-test',
        generator_version: 'bundle-writer.v2',
        source_scope: {
          scope_type: 'global',
        },
        source_snapshot: { sample_count: 9 },
        export_hash: 'sha256:bundle-runtime-query-global',
        filter_settings: { min_score: 90 },
        split: { seed: 42, strategy: 'story_hash_v1' },
        counts: {
          total_candidates: 9,
          accepted: 5,
          rejected: 2,
          downgraded: 2,
          blocked: 1,
          train: 5,
          validation: 2,
          test: 2,
        },
        provider_summary: {},
        redaction_summary: {},
        validation_summary: {
          schema_valid: true,
          training_ready_passed: true,
        },
        artifacts: {
          train_path: 'train.jsonl',
          validation_path: 'validation.jsonl',
          test_path: 'test.jsonl',
          manifest_path: 'manifest.json',
          validation_report_path: 'validation-report.json',
          rejection_report_path: 'rejection-report.json',
        },
      },
      null,
      2
    ),
    'utf-8'
  );
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
    expect(snapshot.score_detail.records).toEqual([
      expect.objectContaining({
        run_id: 'run-e15-s1-older',
        stage: 'implement',
        phase_score: 95,
      }),
    ]);
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
          training_ready: true,
          training_blockers: [],
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
          strategy: 'story_hash_v1',
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
      {
        sample_id: 'sample-runtime-query-002',
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
              content_hash: 'sha256:content-002',
              source_hash: 'sha256:source-002',
              kind: 'md',
            },
          ],
        },
        messages: [
          { role: 'system', content: 'You are a senior coding agent.' },
          { role: 'user', content: 'Explain the redacted runtime snapshot.' },
          { role: 'assistant', content: 'The tool arguments were redacted before export.' },
        ],
        metadata: {
          schema_targets: ['openai_chat', 'hf_tool_calling'],
          language: 'zh-CN',
          notes: ['tool_trace_injected'],
        },
        quality: {
          acceptance_decision: 'accepted',
          phase_score: 90,
          raw_phase_score: 90,
          training_ready: true,
          training_blockers: [],
          veto_triggered: false,
          iteration_count: 0,
          has_code_pair: true,
          token_estimate: 72,
          dedupe_cluster_id: null,
          safety_flags: [],
          rejection_reasons: [],
          warnings: ['warning_redacted_noncritical'],
        },
        provenance: {
          base_commit_hash: 'base-commit-001',
          content_hash: 'sha256:content-002',
          source_hash: 'sha256:source-002',
          source_path: fixture.sourcePath,
          patch_ref: 'sha256:patch-002',
          generated_at: '2026-03-28T00:05:40.000Z',
          lineage: ['run-e15-s1-001', 'run-e15-s1-001:implement', 'tool-trace:sha256:trace-002'],
        },
        split: {
          assignment: 'validation',
          group_key: 'epic-15/story-15-1-runtime-dashboard-sft',
          seed: 42,
          strategy: 'story_hash_v1',
        },
        redaction: {
          status: 'redacted',
          applied_rules: ['secret-token'],
          findings: [
            {
              kind: 'secret_token',
              severity: 'high',
              field_path: 'messages[2].tool_calls[0].function.arguments',
              action: 'redact',
            },
          ],
          redacted_fields: ['messages[2].tool_calls[0].function.arguments'],
        },
        export_compatibility: {
          openai_chat: { compatible: true, reasons: [], warnings: [] },
          hf_conversational: { compatible: false, reasons: ['target_incompatible_hf_conversational'], warnings: [] },
          hf_tool_calling: { compatible: true, reasons: [], warnings: [] },
        },
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_runtime_snapshot',
              parameters: {
                type: 'object',
                properties: {
                  run_id: { type: 'string' },
                },
              },
            },
          },
        ],
      },
      {
        sample_id: 'sample-runtime-query-003',
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
              content_hash: 'sha256:content-003',
              source_hash: 'sha256:source-003',
              kind: 'md',
            },
          ],
        },
        messages: [
          { role: 'system', content: 'You are a senior coding agent.' },
          { role: 'user', content: 'Explain the blocked runtime snapshot.' },
          { role: 'assistant', content: 'This sample must not export.' },
        ],
        metadata: {
          schema_targets: ['openai_chat', 'hf_tool_calling'],
          language: 'zh-CN',
          notes: ['tool_trace_injected'],
        },
        quality: {
          acceptance_decision: 'rejected',
          phase_score: 95,
          raw_phase_score: 95,
          training_ready: false,
          training_blockers: ['redaction_blocked', 'tool_trace_blocked'],
          veto_triggered: false,
          iteration_count: 0,
          has_code_pair: true,
          token_estimate: 80,
          dedupe_cluster_id: null,
          safety_flags: [],
          rejection_reasons: ['redaction_blocked', 'secret_detected_unresolved'],
          warnings: [],
        },
        provenance: {
          base_commit_hash: 'base-commit-001',
          content_hash: 'sha256:content-003',
          source_hash: 'sha256:source-003',
          source_path: fixture.sourcePath,
          patch_ref: 'sha256:patch-003',
          generated_at: '2026-03-28T00:05:50.000Z',
          lineage: ['run-e15-s1-001', 'run-e15-s1-001:implement', 'tool-trace:sha256:trace-003'],
        },
        split: {
          assignment: 'test',
          group_key: 'epic-15/story-15-1-runtime-dashboard-sft',
          seed: 42,
          strategy: 'story_hash_v1',
        },
        redaction: {
          status: 'blocked',
          applied_rules: ['private-key'],
          findings: [
            {
              kind: 'private_key',
              severity: 'critical',
              field_path: 'messages[2].tool_calls[0].function.arguments',
              action: 'block',
            },
          ],
          redacted_fields: ['messages[2].tool_calls[0].function.arguments'],
        },
        export_compatibility: {
          openai_chat: { compatible: false, reasons: ['redaction_blocked'], warnings: [] },
          hf_conversational: { compatible: false, reasons: ['redaction_blocked'], warnings: [] },
          hf_tool_calling: { compatible: false, reasons: ['redaction_blocked'], warnings: [] },
        },
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_runtime_snapshot',
              parameters: {
                type: 'object',
                properties: {
                  privateKey: { type: 'string' },
                },
              },
            },
          },
        ],
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
      expect(snapshot.stage_timeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ stage: 'brief', status: 'pending' }),
          expect.objectContaining({ stage: 'prd', status: 'pending' }),
          expect.objectContaining({ stage: 'arch', status: 'pending' }),
          expect.objectContaining({ stage: 'tasks', status: 'pending' }),
          expect.objectContaining({
            stage: 'implement',
            status: 'passed',
            phase_score: 91,
            veto_triggered: false,
            iteration_count: 0,
          }),
        ])
      );
      expect(snapshot.score_detail.records).toEqual([
        expect.objectContaining({
          stage: 'implement',
          phase_score: 91,
          veto_triggered: false,
          iteration_count: 0,
        }),
      ]);
      expect(snapshot.sft_summary.total_candidates).toBe(3);
      expect(snapshot.sft_summary.accepted).toBe(2);
      expect(snapshot.sft_summary.rejected).toBe(1);
      expect(snapshot.sft_summary.training_ready_candidates).toBe(2);
      expect(
        snapshot.sft_summary.by_split.train +
          snapshot.sft_summary.by_split.validation +
          snapshot.sft_summary.by_split.test +
          snapshot.sft_summary.by_split.holdout
      ).toBe(3);
      expect(snapshot.sft_summary.target_availability.openai_chat.compatible).toBe(2);
      expect(snapshot.sft_summary.redaction_status_counts).toEqual({
        clean: 1,
        redacted: 1,
        blocked: 1,
      });
      expect(snapshot.sft_summary.redaction_applied_rules).toEqual(
        expect.arrayContaining([
          { rule: 'secret-token', count: 1 },
          { rule: 'private-key', count: 1 },
        ])
      );
      expect(snapshot.sft_summary.redaction_finding_kinds).toEqual(
        expect.arrayContaining([
          { kind: 'secret_token', count: 1 },
          { kind: 'private_key', count: 1 },
        ])
      );
      expect(snapshot.sft_summary.redaction_preview).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sample_id: 'sample-runtime-query-002',
            status: 'redacted',
            finding_kinds: ['secret_token'],
          }),
          expect.objectContaining({
            sample_id: 'sample-runtime-query-003',
            status: 'blocked',
            finding_kinds: ['private_key'],
            rejection_reasons: ['redaction_blocked', 'secret_detected_unresolved'],
          }),
        ])
      );
      expect(snapshot.sft_summary.last_bundle?.validation_summary).toEqual(
        expect.objectContaining({
          schema_valid: true,
        })
      );
      expect(snapshot.sft_summary.last_bundle).toEqual(
        expect.objectContaining({
          bundle_id: 'openai_chat-runtime-query',
          source_scope: expect.objectContaining({
            scope_type: 'story',
            story_key: '15-1-runtime-dashboard-sft',
          }),
        })
      );
      expect(snapshot.sft_summary.global_last_bundle).toEqual(
        expect.objectContaining({
          bundle_id: 'openai_chat-global-runtime-query',
          source_scope: expect.objectContaining({
            scope_type: 'global',
          }),
        })
      );
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
    expect(snapshot.stage_timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'brief', status: 'pending' }),
        expect.objectContaining({ stage: 'prd', status: 'pending' }),
        expect.objectContaining({ stage: 'arch', status: 'pending' }),
        expect.objectContaining({ stage: 'tasks', status: 'running' }),
        expect.objectContaining({ stage: 'implement', status: 'pending' }),
      ])
    );
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
    expect(snapshot.stage_timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'brief', status: 'pending' }),
        expect.objectContaining({ stage: 'prd', status: 'pending' }),
        expect.objectContaining({ stage: 'arch', status: 'pending' }),
        expect.objectContaining({ stage: 'tasks', status: 'pending' }),
        expect.objectContaining({ stage: 'implement', status: 'pending' }),
        expect.objectContaining({ stage: 'spec', status: 'passed', phase_score: 82 }),
        expect.objectContaining({ stage: 'plan', status: 'passed', phase_score: 88 }),
      ])
    );
    expect(snapshot.score_detail.records).toHaveLength(2);
    expect(snapshot.overview.health_score).toBe(86);
  });

  it('keeps work items visible when the selected run belongs to a different board group', () => {
    const snapshot = buildRuntimeDashboardModel({
      events: [
        makeEvent({
          run_id: 'run-e15-s1-story',
          event_id: 'evt-story-001',
          timestamp: '2026-03-28T00:00:00.000Z',
          payload: { status: 'pending' },
          scope: {
            story_key: '15-1-runtime-dashboard-sft',
            epic_id: 'epic-15',
            story_id: '15-1-runtime-dashboard-sft',
            flow: 'story',
          },
        }),
        makeEvent({
          run_id: 'run-e15-s1-story',
          event_id: 'evt-story-002',
          event_type: 'stage.completed',
          stage: 'implement',
          timestamp: '2026-03-28T00:05:00.000Z',
          payload: { status: 'passed' },
        }),
        makeEvent({
          run_id: 'run-standalone-ops-001',
          event_id: 'evt-ops-001',
          timestamp: '2026-03-28T01:00:00.000Z',
          payload: { status: 'pending' },
        }),
        makeEvent({
          run_id: 'run-standalone-ops-001',
          event_id: 'evt-ops-002',
          event_type: 'stage.started',
          stage: 'plan',
          timestamp: '2026-03-28T01:10:00.000Z',
          payload: { status: 'running' },
        }),
      ],
      scoreRecords: [
        makeScoreRecord({
          run_id: 'run-e15-s1-story',
          source_path: 'docs/plans/story-15-1-runtime-dashboard.md',
          timestamp: '2026-03-28T00:05:00.000Z',
        }),
      ],
    });

    expect(snapshot.selection.run_id).toBe('run-standalone-ops-001');
    expect(snapshot.workboard.board_groups.map((group) => group.board_group_id)).toEqual(
      expect.arrayContaining(['epic:epic-15', 'queue:standalone-ops'])
    );
    expect(snapshot.workboard.active_board_group_id).toBe('queue:standalone-ops');
    expect(snapshot.workboard.work_items.filter((item) => item.board_group_id === 'queue:standalone-ops')).toHaveLength(1);
    expect(snapshot.workboard.active_work_item_id).toBe('standalone_task:orphan:run-standalone-ops-001');
  });

  it('aggregates a full stage timeline for the active work item across runs', () => {
    const snapshot = buildRuntimeDashboardModel({
      events: [
        makeEvent({
          run_id: 'run-e15-s1-prev',
          event_id: 'evt-prev-001',
          timestamp: '2026-03-27T00:00:00.000Z',
          payload: { status: 'pending' },
          scope: {
            story_key: '15-1-runtime-dashboard-sft',
            epic_id: 'epic-15',
            story_id: '15-1-runtime-dashboard-sft',
            flow: 'story',
          },
        }),
        makeEvent({
          run_id: 'run-e15-s1-prev',
          event_id: 'evt-prev-002',
          event_type: 'stage.completed',
          stage: 'prd',
          timestamp: '2026-03-27T00:05:00.000Z',
          payload: { status: 'passed' },
        }),
        makeEvent({
          run_id: 'run-e15-s1-prev',
          event_id: 'evt-prev-003',
          event_type: 'stage.completed',
          stage: 'plan',
          timestamp: '2026-03-27T00:10:00.000Z',
          payload: { status: 'passed' },
        }),
        makeEvent({
          run_id: 'run-e15-s1-active',
          event_id: 'evt-active-001',
          timestamp: '2026-03-28T00:00:00.000Z',
          payload: { status: 'pending' },
          scope: {
            story_key: '15-1-runtime-dashboard-sft',
            epic_id: 'epic-15',
            story_id: '15-1-runtime-dashboard-sft',
            flow: 'story',
          },
        }),
        makeEvent({
          run_id: 'run-e15-s1-active',
          event_id: 'evt-active-002',
          event_type: 'stage.started',
          stage: 'implement',
          timestamp: '2026-03-28T00:15:00.000Z',
          payload: { status: 'running' },
        }),
      ],
      scoreRecords: [
        makeScoreRecord({
          run_id: 'run-e15-s1-prev',
          stage: 'prd',
          timestamp: '2026-03-27T00:05:00.000Z',
          phase_score: 78,
          source_path: 'docs/plans/story-15-1-runtime-dashboard.md',
        }),
        makeScoreRecord({
          run_id: 'run-e15-s1-prev',
          stage: 'plan',
          timestamp: '2026-03-27T00:10:00.000Z',
          phase_score: 84,
          source_path: 'docs/plans/story-15-1-runtime-dashboard.md',
        }),
        makeScoreRecord({
          run_id: 'run-e15-s1-active',
          stage: 'implement',
          timestamp: '2026-03-28T00:15:00.000Z',
          phase_score: 91,
          source_path: 'docs/plans/story-15-1-runtime-dashboard.md',
        }),
      ],
      options: {
        boardGroupId: 'epic:epic-15',
        workItemId: 'story:15-1-runtime-dashboard-sft',
      },
    });

    expect(snapshot.stage_timeline.map((entry) => entry.stage)).toEqual(['brief', 'prd', 'arch', 'tasks', 'implement', 'plan']);
    expect(snapshot.stage_timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'brief', status: 'pending' }),
        expect.objectContaining({ stage: 'prd', phase_score: 78, status: 'passed' }),
        expect.objectContaining({ stage: 'arch', status: 'pending' }),
        expect.objectContaining({ stage: 'tasks', status: 'pending' }),
        expect.objectContaining({ stage: 'implement', phase_score: 91, status: 'running' }),
        expect.objectContaining({ stage: 'plan', phase_score: 84, status: 'passed' }),
      ])
    );
  });

  it('deduplicates repeated findings for the same failed check item', () => {
    const snapshot = buildRuntimeDashboardModel({
      events: [],
      scoreRecords: [
        makeScoreRecord({
          run_id: 'run-bugfix-queue-001',
          stage: 'plan',
          timestamp: '2026-03-28T00:02:00.000Z',
          source_path: '_bmad-output/implementation-artifacts/_orphan/bugfix/fix-runtime-dashboard-findings-duplication.md',
          check_items: [
            { item_id: 'dup-1', note: 'same finding', passed: false, score_delta: -10 },
            { item_id: 'dup-1', note: 'same finding', passed: false, score_delta: -10 },
          ],
        }),
      ],
      options: {
        boardGroupId: 'queue:bugfix',
      },
    });

    expect(snapshot.score_detail.findings).toHaveLength(1);
    expect(snapshot.score_detail.findings[0]).toEqual(
      expect.objectContaining({
        item_id: 'dup-1',
        note: 'same finding',
        score_delta: -10,
      })
    );
  });

  it('deduplicates board groups with the same label', () => {
    const snapshot = buildRuntimeDashboardModel({
      events: [
        makeEvent({
          run_id: 'run-e15-s1-story',
          event_id: 'evt-story-001',
          timestamp: '2026-03-28T00:00:00.000Z',
          payload: { status: 'pending' },
          scope: {
            story_key: '15-1-runtime-dashboard-sft',
            epic_id: 'epic-15',
            story_id: '15-1-runtime-dashboard-sft',
            flow: 'story',
          },
        }),
      ],
      scoreRecords: [
        makeScoreRecord({
          run_id: 'run-e15-s1-story',
          source_path: 'specs/epic-15/story-1-runtime-dashboard-sft/spec.md',
        }),
        makeScoreRecord({
          run_id: 'run-e15-s1-story-dup',
          source_path: 'docs/plans/story-15-1-runtime-dashboard.md',
        }),
      ],
    });

    const epic15Groups = snapshot.workboard.board_groups.filter((group) => group.board_group_label === 'Epic 15');
    expect(epic15Groups).toHaveLength(1);
  });

  it('builds todo/in-progress/done swimlanes for the active board group', () => {
    const snapshot = buildRuntimeDashboardModel({
      events: [
        makeEvent({
          run_id: 'run-standalone-todo-001',
          event_id: 'evt-todo-001',
          timestamp: '2026-03-28T00:00:00.000Z',
          payload: { status: 'pending' },
        }),
        makeEvent({
          run_id: 'run-standalone-active-001',
          event_id: 'evt-active-001',
          timestamp: '2026-03-28T00:05:00.000Z',
          payload: { status: 'pending' },
        }),
        makeEvent({
          run_id: 'run-standalone-active-001',
          event_id: 'evt-active-002',
          event_type: 'stage.started',
          stage: 'plan',
          timestamp: '2026-03-28T00:10:00.000Z',
          payload: { status: 'running' },
        }),
      ],
      scoreRecords: [
        makeScoreRecord({
          run_id: 'run-standalone-done-001',
          phase_score: 97,
          source_path: '_bmad-output/implementation-artifacts/_orphan/standalone_tasks/finished-item.md',
          timestamp: '2026-03-28T00:20:00.000Z',
        }),
      ],
      options: {
        boardGroupId: 'queue:standalone-ops',
      },
    });

    expect(snapshot.workboard.swimlanes?.todo).toHaveLength(1);
    expect(snapshot.workboard.swimlanes?.in_progress).toHaveLength(1);
    expect(snapshot.workboard.swimlanes?.done).toHaveLength(1);
  });

  it('prefers the bugfix board group when the selected run id is bugfix-scoped', () => {
    const snapshot = buildRuntimeDashboardModel({
      events: [],
      scoreRecords: [
        makeScoreRecord({
          run_id: 'run-standalone-ops-001',
          source_path: '_bmad-output/implementation-artifacts/_orphan/standalone_tasks/improve-audit-rollup.md',
          phase_score: 93,
        }),
        makeScoreRecord({
          run_id: 'run-bugfix-queue-001',
          stage: 'plan',
          source_path: '_bmad-output/implementation-artifacts/_orphan/bugfix/fix-runtime-dashboard-findings-duplication.md',
          phase_score: 90,
          timestamp: '2026-03-28T00:30:00.000Z',
        }),
      ],
      options: {
        boardGroupId: 'queue:bugfix',
      },
    });

    expect(snapshot.workboard.active_board_group_id).toBe('queue:bugfix');
  });

  it('builds todo/in-progress/done swimlanes for board groups as well', () => {
    const snapshot = buildRuntimeDashboardModel({
      events: [
        makeEvent({
          run_id: 'run-story-todo-001',
          event_id: 'evt-story-todo-001',
          timestamp: '2026-03-28T00:00:00.000Z',
          payload: { status: 'pending' },
          scope: {
            story_key: '15-1-runtime-dashboard-sft',
            epic_id: 'epic-15',
            story_id: '15-1-runtime-dashboard-sft',
            flow: 'story',
          },
        }),
        makeEvent({
          run_id: 'run-bugfix-active-001',
          event_id: 'evt-bugfix-active-001',
          timestamp: '2026-03-28T00:05:00.000Z',
          payload: { status: 'pending' },
        }),
        makeEvent({
          run_id: 'run-bugfix-active-001',
          event_id: 'evt-bugfix-active-002',
          event_type: 'stage.started',
          stage: 'plan',
          timestamp: '2026-03-28T00:10:00.000Z',
          payload: { status: 'running' },
        }),
      ],
      scoreRecords: [
        makeScoreRecord({
          run_id: 'run-standalone-done-001',
          phase_score: 97,
          source_path: '_bmad-output/implementation-artifacts/_orphan/standalone_tasks/finished-item.md',
          timestamp: '2026-03-28T00:20:00.000Z',
        }),
      ],
    });

    expect(snapshot.workboard.board_group_swimlanes?.todo).toHaveLength(1);
    expect(snapshot.workboard.board_group_swimlanes?.in_progress).toHaveLength(1);
    expect(snapshot.workboard.board_group_swimlanes?.done).toHaveLength(0);
  });
});
