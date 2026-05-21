import { describe, expect, it, vi } from 'vitest';
import * as runtimeQuery from '../runtime-query';
import { invokeRuntimeMcpTool } from '../mcp-server';
import {
  buildReviewerContractProjection,
  buildReviewerRouteExplainability,
} from '../reviewer-projection';
import { buildSixMentalModelProjection } from '../six-model-projection';
import type { RuntimeDashboardSnapshot } from '../runtime-query';

describe('runtime dashboard MCP server', () => {
  it('includes redaction summary in preview_sft and export_sft tool responses', async () => {
    const runtimeContext: RuntimeDashboardSnapshot['runtime_context'] = {
      run_id: 'run-e15-s1-001',
      status: 'running',
      current_stage: 'implement',
      flow: 'story',
      scope: null,
      last_event_at: '2026-03-28T00:05:00.000Z',
      reviewer_contract: buildReviewerContractProjection({ auditEntryStage: 'implement' }),
    };
    const executionState: RuntimeDashboardSnapshot['execution_state'] = {
      source: 'execution_record',
      selection_match: 'work_item',
      execution_id: 'exec-001',
      execution_status: 'running',
      configured_authoritative_host: 'cursor',
      dispatched_host: 'claude',
      fallback_used: true,
      last_rerun_gate_status: 'fail',
      artifact_path: 'artifacts/attempt.md',
      packet_paths: {},
      last_dispatch_error: null,
      reviewer_route_explainability: [
        {
          ...buildReviewerRouteExplainability({ auditEntryStage: 'implement' }),
          matchedSkillId: 'code-reviewer',
        },
      ],
    };
    const stageTimeline: RuntimeDashboardSnapshot['stage_timeline'] = [];
    const scoreDetail: RuntimeDashboardSnapshot['score_detail'] = {
      run_id: 'run-e15-s1-001',
      records: [],
      findings: [],
    };
    const workboard: RuntimeDashboardSnapshot['workboard'] = {
      active_board_group_id: null,
      active_work_item_id: null,
      board_groups: [],
      work_items: [],
    };

    vi.spyOn(runtimeQuery, 'queryRuntimeDashboard').mockReturnValue({
      generated_at: '2026-03-28T00:00:00.000Z',
      selection: {
        run_id: 'run-e15-s1-001',
        source: 'runtime',
        has_runtime: true,
        has_scores: true,
      },
      overview: {
        status: 'running',
        health_score: 91,
        trend: '升',
        veto_count: 0,
        dimensions: [],
        weak_top3: [],
        high_iteration_top3: [],
        score_record_count: 1,
        last_updated_at: '2026-03-28T00:05:00.000Z',
      },
      runtime_context: runtimeContext,
      stage_timeline: stageTimeline,
      score_detail: scoreDetail,
      sft_summary: {
        total_candidates: 3,
        accepted: 2,
        rejected: 1,
        downgraded: 0,
        training_ready_candidates: 2,
        by_split: {
          train: 1,
          validation: 1,
          test: 1,
          holdout: 0,
        },
        target_availability: {
          openai_chat: { compatible: 2, incompatible: 1 },
          hf_conversational: { compatible: 1, incompatible: 2 },
          hf_tool_calling: { compatible: 1, incompatible: 2 },
        },
        rejection_reasons: [
          { reason: 'redaction_blocked', count: 1 },
        ],
        redaction_status_counts: {
          clean: 1,
          redacted: 1,
          blocked: 1,
        },
        redaction_applied_rules: [
          { rule: 'secret-token', count: 1 },
          { rule: 'private-key', count: 1 },
        ],
        redaction_finding_kinds: [
          { kind: 'secret_token', count: 1 },
          { kind: 'private_key', count: 1 },
        ],
        redaction_preview: [
          {
            sample_id: 'sample-runtime-query-002',
            status: 'redacted',
            applied_rules: ['secret-token'],
            finding_kinds: ['secret_token'],
            rejection_reasons: [],
          },
          {
            sample_id: 'sample-runtime-query-003',
            status: 'blocked',
            applied_rules: ['private-key'],
            finding_kinds: ['private_key'],
            rejection_reasons: ['redaction_blocked', 'secret_detected_unresolved'],
          },
        ],
        last_bundle: {
          bundle_id: 'openai_chat-story-runtime-query',
          export_target: 'openai_chat',
          created_at: '2026-03-28T00:10:00.000Z',
          bundle_dir: '_bmad-output/datasets/openai_chat-story-runtime-query',
          manifest_path: '_bmad-output/datasets/openai_chat-story-runtime-query/manifest.json',
          source_scope: {
            scope_type: 'story',
            epic_id: 'epic-15',
            story_key: '15-1-runtime-dashboard-sft',
          },
        },
        global_last_bundle: {
          bundle_id: 'openai_chat-global-runtime-query',
          export_target: 'openai_chat',
          created_at: '2026-03-28T00:12:00.000Z',
          bundle_dir: '_bmad-output/datasets/openai_chat-global-runtime-query',
          manifest_path: '_bmad-output/datasets/openai_chat-global-runtime-query/manifest.json',
          source_scope: {
            scope_type: 'global',
          },
        },
      },
      execution_state: executionState,
      workboard,
      six_model_projection: buildSixMentalModelProjection({
        runtimeContext,
        executionState,
        stageTimeline,
        scoreDetail,
        workboard,
      }),
    });

    const summary = await invokeRuntimeMcpTool(
      'get_current_run_summary',
      undefined,
      'http://127.0.0.1:43123',
      {}
    );
    const stageStatus = await invokeRuntimeMcpTool(
      'get_stage_status',
      undefined,
      'http://127.0.0.1:43123',
      {}
    );
    const health = await invokeRuntimeMcpTool(
      'get_runtime_service_health',
      undefined,
      'http://127.0.0.1:43123',
      {}
    );
    const preview = await invokeRuntimeMcpTool('preview_sft', undefined, 'http://127.0.0.1:43123', {});
    const exportResult = await invokeRuntimeMcpTool(
      'export_sft',
      { target: 'hf_tool_calling' },
      'http://127.0.0.1:43123',
      {}
    );

    expect(summary.structuredContent).toMatchObject({
      reviewer_contract: expect.objectContaining({
        reviewerIdentity: 'bmad_code_reviewer',
        activeAuditConsumer: expect.objectContaining({
          entryStage: 'implement',
        }),
      }),
    });
    expect(stageStatus.structuredContent).toMatchObject({
      reviewer_route_explainability: expect.arrayContaining([
        expect.objectContaining({
          reviewerIdentity: 'bmad_code_reviewer',
          closeoutRunner: 'runAuditorHost',
        }),
      ]),
    });
    expect(health.structuredContent).toMatchObject({
      reviewer_registry_version: 'reviewer_registry_v1',
      reviewer_identity: 'bmad_code_reviewer',
    });
    expect(preview.structuredContent).toMatchObject({
      training_ready_candidates: 2,
      redaction_status_counts: {
        clean: 1,
        redacted: 1,
        blocked: 1,
      },
      redaction_preview: expect.arrayContaining([
        expect.objectContaining({
          sample_id: 'sample-runtime-query-003',
          status: 'blocked',
        }),
      ]),
    });
    expect(exportResult.structuredContent).toMatchObject({
      target: 'hf_tool_calling',
      last_bundle: expect.objectContaining({
        bundle_id: 'openai_chat-story-runtime-query',
      }),
      global_last_bundle: expect.objectContaining({
        bundle_id: 'openai_chat-global-runtime-query',
      }),
      redaction_status_counts: {
        clean: 1,
        redacted: 1,
        blocked: 1,
      },
      redaction_finding_kinds: expect.arrayContaining([
        expect.objectContaining({ kind: 'private_key', count: 1 }),
      ]),
      redaction_preview: expect.arrayContaining([
        expect.objectContaining({
          sample_id: 'sample-runtime-query-002',
          status: 'redacted',
        }),
      ]),
    });
  });
});
