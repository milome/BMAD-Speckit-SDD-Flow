import { describe, expect, it } from 'vitest';
import { renderDashboardSnapshotMarkdown } from '../snapshot';
import type { RuntimeDashboardSnapshot } from '../runtime-query';

describe('runtime dashboard snapshot markdown', () => {
  it('includes reviewer projection details when runtime context is requested', () => {
    const snapshot = {
      generated_at: '2026-03-28T00:00:00.000Z',
      selection: {
        run_id: 'run-001',
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
      runtime_context: {
        run_id: 'run-001',
        status: 'running',
        current_stage: 'implement',
        flow: 'story',
        scope: {
          story_key: '15-1-runtime-dashboard-sft',
          resolved_context_path: '_bmad-output/runtime/context/runs/run-001.json',
        },
        last_event_at: '2026-03-28T00:05:00.000Z',
        reviewer_contract: {
          version: 'reviewer_contract_projection_v1',
          reviewerIdentity: 'bmad_code_reviewer',
          reviewerDisplayName: 'code-reviewer',
          facilitatorIdentity: 'party_mode_facilitator',
          registryVersion: 'reviewer_registry_v1',
          sharedCore: {
            version: 'reviewer_shared_core_v1',
            rootPath: '_bmad/core/agents/code-reviewer',
            basePromptPath: '_bmad/core/agents/code-reviewer/base-prompt.md',
            profilePackPath: '_bmad/core/agents/code-reviewer/profiles.json',
          },
          schemaVersions: {
            input: 'review_input_v1',
            output: 'review_output_v1',
            handoff: 'review_handoff_v1',
            closeout: 'review_host_closeout_v1',
          },
          closeoutRunner: 'runAuditorHost',
          governance: {
            implementationReadinessStatusRequired: true,
            implementationReadinessGateName: 'implementation-readiness',
            gatesLoopRequired: true,
            rerunGatesRequired: true,
            packetExecutionClosureRequired: true,
            packetExecutionClosureStatuses: [
              'awaiting_rerun_gate',
              'retry_pending',
              'gate_passed',
              'escalated',
            ],
            closeoutEnvelopeFields: [
              'resultCode',
              'requiredFixes',
              'requiredFixesDetail',
              'rerunDecision',
              'scoringFailureMode',
              'packetExecutionClosureStatus',
            ],
          },
          hostAdapterBoundary: {
            projectionOnly: true,
            hostLocalStageSemanticsForbidden: true,
            hostLocalRoutePrecedenceForbidden: true,
            hostLocalFallbackBusinessRulesForbidden: true,
          },
          compatibilityGuards: {
            codexNoopRequired: true,
            codexBehaviorChangeAllowed: false,
          },
          requiredRolloutProofs: [
            'parity_proof',
            'consumer_install_proof',
            'rollback_proof',
            'codex_noop_proof',
          ],
          supportedProfiles: ['story_audit', 'implement_audit'],
          supportedAuditEntryStages: ['story', 'implement'],
          activeAuditConsumer: {
            entryStage: 'implement',
            profile: 'implement_audit',
            closeoutStage: 'implement',
            auditorScript: 'auditor-implement',
            scoreStage: 'implement',
            triggerStage: 'speckit_5_2',
          },
        },
        latest_reviewer_closeout: {
          updated_at: '2026-03-28T00:06:00.000Z',
          runner: 'runAuditorHost',
          profile: 'implement_audit',
          stage: 'implement',
          artifact_path: 'artifacts/implement.md',
          report_path: 'artifacts/implement.audit.md',
          audit_status: 'PASS',
          closeout_approved: false,
          result_code: 'blocked',
          rerun_decision: 'rerun_required',
          packet_execution_closure_status: 'retry_pending',
          scoring_failure_mode: 'succeeded',
          blocking_reason: 'Critical readiness drift detected against the current implementation baseline.',
          required_fixes: ['Critical readiness drift detected against the current implementation baseline.'],
          score_error: null,
        },
      },
      execution_state: {
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
            requestedSkillId: 'code-reviewer',
            reviewerIdentity: 'bmad_code_reviewer',
            reviewerDisplayName: 'code-reviewer',
            registryVersion: 'reviewer_registry_v1',
            sharedCore: {
              version: 'reviewer_shared_core_v1',
              rootPath: '_bmad/core/agents/code-reviewer',
              basePromptPath: '_bmad/core/agents/code-reviewer/base-prompt.md',
              profilePackPath: '_bmad/core/agents/code-reviewer/profiles.json',
            },
            closeoutRunner: 'runAuditorHost',
            routeReasonSummary:
              'Registry-backed reviewer routing keeps shared-core semantics while preserving host-specific transport and carrier shape.',
            fallbackStatus: 'fallback_ready',
            isomorphismMaturity: 'projection_wired',
            complexitySource:
              'Dual-host carrier parity is in place, but legacy skill narrative cleanup and proof expansion still remain before rollout.',
            remainingBlocker:
              'Complete parity proof, rollback proof, Codex no-op proof, and rollout gate before declaring full isomorphism.',
            supportedProfiles: ['story_audit', 'implement_audit'],
            requiredRolloutProofs: [
              'parity_proof',
              'consumer_install_proof',
              'rollback_proof',
              'codex_noop_proof',
            ],
            compatibilityGuards: {
              codexNoopRequired: true,
              codexBehaviorChangeAllowed: false,
            },
            hosts: {
              cursor: {
                carrierSourcePath: '_bmad/cursor/agents/code-reviewer.md',
                runtimeTargetPath: '.cursor/agents/code-reviewer.md',
                preferredRoute: { tool: 'cursor-task', subtypeOrExecutor: 'code-reviewer' },
                fallbackRoute: { tool: 'mcp_task', subtypeOrExecutor: 'generalPurpose' },
                fallbackReason:
                  'Use mcp_task/generalPurpose when cursor-task/code-reviewer is unavailable, while preserving the shared reviewer contract and runAuditorHost closeout.',
              },
              claude: {
                carrierSourcePath: '_bmad/claude/agents/code-reviewer.md',
                runtimeTargetPath: '.claude/agents/code-reviewer.md',
                preferredRoute: { tool: 'Agent', subtypeOrExecutor: 'code-reviewer' },
                fallbackRoute: { tool: 'Agent', subtypeOrExecutor: 'general-purpose' },
                fallbackReason:
                  'Use Agent/general-purpose only when Agent/code-reviewer is unavailable, while preserving the shared reviewer contract and runAuditorHost closeout.',
              },
            },
            activeAuditConsumer: {
              entryStage: 'implement',
              profile: 'implement_audit',
              closeoutStage: 'implement',
              auditorScript: 'auditor-implement',
              scoreStage: 'implement',
              triggerStage: 'speckit_5_2',
            },
          },
        ],
      },
      stage_timeline: [],
      score_detail: {
        run_id: 'run-001',
        records: [],
        findings: [],
      },
      readiness_projection: {
        readiness_baseline_run_id: 'run-readiness-001',
        readiness_score: 84,
        readiness_raw_score: 84,
        drift_signals: ['smoke_task_chain'],
        drifted_dimensions: ['Smoke E2E Readiness', 'P0 Journey Coverage'],
        drift_severity: 'critical',
        re_readiness_required: true,
        blocking_reason: 'Critical readiness drift detected against the current implementation baseline.',
        effective_verdict: 'blocked',
        readiness_dimensions: {
          'P0 Journey Coverage': 88,
          'Smoke E2E Readiness': 80,
          'Evidence Proof Chain': 84,
          'Cross-Document Traceability': 84,
        },
      },
      sft_summary: {
        total_candidates: 0,
        accepted: 0,
        rejected: 0,
        downgraded: 0,
        training_ready_candidates: 0,
        by_split: { train: 0, validation: 0, test: 0, holdout: 0 },
        target_availability: {
          openai_chat: { compatible: 0, incompatible: 0 },
          hf_conversational: { compatible: 0, incompatible: 0 },
          hf_tool_calling: { compatible: 0, incompatible: 0 },
        },
        rejection_reasons: [],
        redaction_status_counts: { clean: 0, redacted: 0, blocked: 0 },
        redaction_applied_rules: [],
        redaction_finding_kinds: [],
        redaction_preview: [],
        duplicate_summary: {
          cluster_count: 0,
          duplicate_cluster_count: 0,
          duplicated_sample_count: 0,
          largest_cluster_size: 0,
          clusters: [],
        },
        balance_summary: {
          by_host_kind: {},
          by_provider_id: {},
          by_stage: {},
          by_source_scope: {},
          by_sample_kind: {},
          by_split: {},
          by_target: {},
          dominant_host_kind_share: 0,
          dominant_provider_share: 0,
          dominant_stage_share: 0,
          dominant_source_scope_share: 0,
          dominant_sample_kind_share: 0,
        },
        training_view_summary: {
          assistant_only_ready: 0,
          completion_only_ready: 0,
          tool_calling_ready: 0,
          schema_target_counts: {},
        },
        last_bundle: null,
        global_last_bundle: null,
      },
      workboard: {
        active_board_group_id: null,
        active_work_item_id: null,
        board_groups: [],
        work_items: [],
      },
    } satisfies RuntimeDashboardSnapshot;

    const markdown = renderDashboardSnapshotMarkdown('# Dashboard', snapshot, true);

    expect(markdown).toContain('## Reviewer Projection');
    expect(markdown).toContain('- Reviewer Identity: bmad_code_reviewer');
    expect(markdown).toContain('- Reviewer Registry: reviewer_registry_v1');
    expect(markdown).toContain('- Shared Core: _bmad/core/agents/code-reviewer [reviewer_shared_core_v1]');
    expect(markdown).toContain('- Current Carrier: claude -> _bmad/claude/agents/code-reviewer.md -> .claude/agents/code-reviewer.md');
    expect(markdown).toContain('- Active Reviewer Consumer: implement -> implement_audit');
    expect(markdown).toContain('- Reviewer Closeout: runAuditorHost');
    expect(markdown).toContain('- Cursor Route: cursor-task/code-reviewer');
    expect(markdown).toContain('- Claude Route: Agent/code-reviewer');
    expect(markdown).toContain('- Fallback Status: fallback_ready');
    expect(markdown).toContain('- Maturity: projection_wired');
    expect(markdown).toContain('## Latest Reviewer Closeout');
    expect(markdown).toContain('- Result Code: blocked');
    expect(markdown).toContain('- Packet Execution Closure Status: retry_pending');
    expect(markdown).toContain('## Readiness Drift Projection');
    expect(markdown).toContain('- Readiness Baseline Run ID: run-readiness-001');
    expect(markdown).toContain('- Effective Verdict: blocked');
    expect(markdown).toContain('- Drift Severity: critical');
    expect(markdown).toContain('- Drift Signals: smoke_task_chain');
    expect(markdown).toContain('- Drifted Dimensions: Smoke E2E Readiness, P0 Journey Coverage');
  });
});
