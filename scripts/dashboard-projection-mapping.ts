/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildSixMentalModelProjection,
  type DashboardExecutionStateSummary,
  type DashboardRuntimeContextPanel,
  type DashboardScoreDetailPayload,
  type DashboardStageTimelineEntry,
  type DashboardWorkboardPayload,
} from '../packages/scoring/dashboard';

type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  outDir?: string;
  generatedBy?: string;
  json?: boolean;
  help?: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[key] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fixtureInput(): {
  runtimeContext: DashboardRuntimeContextPanel;
  executionState: DashboardExecutionStateSummary;
  stageTimeline: DashboardStageTimelineEntry[];
  scoreDetail: DashboardScoreDetailPayload;
  workboard: DashboardWorkboardPayload;
} {
  return {
    runtimeContext: {
      run_id: 'run-dashboard-trace-032',
      status: 'running',
      current_stage: 'implement',
      flow: 'story',
      scope: {
        flow: 'story',
        epic_id: 'epic-15',
        story_key: '15-1-runtime-dashboard-read-model',
        story_id: '15-1-runtime-dashboard-read-model',
      },
      last_event_at: '2026-05-20T18:00:00.000Z',
      reviewer_contract: null,
      latest_reviewer_closeout: {
        updated_at: '2026-05-20T18:00:00.000Z',
        runner: 'runAuditorHost',
        profile: 'implement_audit',
        stage: 'implement',
        artifact_path: '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/dashboard/audit.md',
        report_path: '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/dashboard/report.md',
        audit_status: 'PASS',
        closeout_approved: false,
        result_code: 'blocked',
        rerun_decision: 'rerun_required',
        packet_execution_closure_status: 'retry_pending',
        scoring_failure_mode: 'succeeded',
        blocking_reason: 'dashboard projection is read-only',
        required_fixes: ['controlled closeout attempt must decide final status'],
        score_error: null,
      },
      work_item: null,
    },
    executionState: {
      source: 'execution_record',
      selection_match: 'work_item',
      execution_id: 'exec-dashboard-trace-032',
      execution_status: 'running',
      configured_authoritative_host: 'codex',
      dispatched_host: 'codex',
      fallback_used: false,
      last_rerun_gate_status: 'pass',
      artifact_path: '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/dashboard/projection.json',
      packet_paths: {},
      last_dispatch_error: null,
      reviewer_route_explainability: null,
    },
    stageTimeline: [
      {
        stage: 'implement',
        status: 'running',
        phase_score: 96,
        raw_phase_score: 96,
        veto_triggered: false,
        iteration_count: 2,
        score_timestamp: '2026-05-20T18:00:00.000Z',
      },
    ],
    scoreDetail: {
      run_id: 'run-dashboard-trace-032',
      findings: [],
      records: [
        {
          run_id: 'run-dashboard-trace-032',
          stage: 'implement',
          timestamp: '2026-05-20T18:00:00.000Z',
          phase_score: 96,
          raw_phase_score: 96,
          phase_weight: 1,
          iteration_count: 2,
          first_pass: true,
          veto_triggered: false,
          tier_coefficient: 1,
          check_item_count: 3,
          source_path: '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/dashboard/report.md',
          findings: [],
        },
      ],
    },
    workboard: {
      active_board_group_id: 'epic:epic-15',
      active_work_item_id: 'story:15-1-runtime-dashboard-read-model',
      board_groups: [
        {
          board_group_id: 'epic:epic-15',
          board_group_label: 'Epic 15',
          kind: 'epic',
          board_status: 'done',
          sort_order: 0,
          counts: { todo: 0, in_progress: 0, done: 1 },
        },
      ],
      work_items: [
        {
          work_item_id: 'story:15-1-runtime-dashboard-read-model',
          work_item_type: 'story',
          artifact_scope: 'story_scoped',
          title: '15-1-runtime-dashboard-read-model',
          slug: '15-1-runtime-dashboard-read-model',
          flow: 'story',
          board_group_id: 'epic:epic-15',
          board_group_label: 'Epic 15',
          board_status: 'done',
          epic_id: 'epic-15',
          story_key: '15-1-runtime-dashboard-read-model',
          linked_story_key: null,
          linked_epic_id: null,
          primary_run_id: 'run-dashboard-trace-032',
          run_ids: ['run-dashboard-trace-032'],
          runtime_status: 'passed',
          current_stage: 'implement',
          phase_score: 96,
          findings_count: 0,
          sft_status: 'ready',
          source_path: '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/dashboard/story.md',
          artifact_doc_path: '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/dashboard/story.md',
          last_updated_at: '2026-05-20T18:00:00.000Z',
        },
        {
          work_item_id: 'standalone_task:orphan:dashboard-projection',
          work_item_type: 'standalone_task',
          artifact_scope: 'orphan_scoped',
          title: 'Dashboard Projection',
          slug: 'dashboard-projection',
          flow: 'standalone_tasks',
          board_group_id: 'queue:standalone-ops',
          board_group_label: 'Standalone / Ops',
          board_status: 'in_progress',
          primary_run_id: 'run-standalone-dashboard',
          run_ids: ['run-standalone-dashboard'],
          runtime_status: 'running',
          current_stage: 'implement',
          phase_score: null,
          findings_count: 0,
          sft_status: 'none',
          source_path: '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/dashboard/task.md',
          artifact_doc_path: '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/dashboard/task.md',
          last_updated_at: '2026-05-20T18:00:00.000Z',
        },
        {
          work_item_id: 'bugfix:orphan:dashboard-green',
          work_item_type: 'bugfix',
          artifact_scope: 'orphan_scoped',
          title: 'Dashboard Green Bugfix',
          slug: 'dashboard-green',
          flow: 'bugfix',
          board_group_id: 'queue:bugfix',
          board_group_label: 'Bugfix Queue',
          board_status: 'in_progress',
          primary_run_id: 'run-bugfix-dashboard',
          run_ids: ['run-bugfix-dashboard'],
          runtime_status: 'failed',
          current_stage: 'implement',
          phase_score: null,
          findings_count: 1,
          sft_status: 'none',
          source_path: '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/dashboard/bugfix.md',
          artifact_doc_path: '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/dashboard/bugfix.md',
          last_updated_at: '2026-05-20T18:00:00.000Z',
        },
      ],
    },
  };
}

function collectValidationIssues(projection: ReturnType<typeof buildSixMentalModelProjection>): string[] {
  const issues: string[] = [];
  if (projection.sourceOfTruthRole !== 'read_model') issues.push('projection_source_role_not_read_model');
  if (projection.canAffectControlFlow !== false) issues.push('projection_can_affect_control');
  if (projection.controlAuthority.dashboardCanCloseRequirement !== false) {
    issues.push('dashboard_can_close_requirement');
  }
  const viewEntries = Object.entries(projection.businessObjectViews);
  const expectedViews = ['epicStoryView', 'taskView', 'bugfixView', 'scoreView', 'reportView', 'sftDatasetView'];
  for (const viewName of expectedViews) {
    if (!projection.businessObjectViews[viewName as keyof typeof projection.businessObjectViews]) {
      issues.push(`view_missing:${viewName}`);
    }
  }
  for (const [viewName, view] of viewEntries) {
    if (view.canAffectControlFlow !== false) issues.push(`view_can_affect_control:${viewName}`);
    for (const item of view.items) {
      if (item.canAffectControlFlow !== false) issues.push(`item_can_affect_control:${item.objectId}`);
      if (item.nextControlledSource !== 'requirement-record.json') {
        issues.push(`item_control_source_invalid:${item.objectId}`);
      }
      if (item.linkedRequirementIds.length === 0) issues.push(`item_requirement_ids_missing:${item.objectId}`);
      if (item.traceRows.length === 0) issues.push(`item_trace_rows_missing:${item.objectId}`);
      if (item.artifactRefs.length === 0) issues.push(`item_artifact_refs_missing:${item.objectId}`);
      if (!item.currentCloseoutAttemptId) issues.push(`item_current_attempt_missing:${item.objectId}`);
    }
  }
  const forbiddenIds = projection.forbiddenDashboardDisplays.map((item) => item.id);
  for (const id of [
    'epicsDoneAsCloseoutPass',
    'storiesDoneAsRequirementPass',
    'tasksDoneAsDeliveryPass',
    'scoreGreenAsCloseoutPass',
    'reportExistsAsAuditPass',
    'sftDatasetGeneratedAsProductionReady',
    'dashboardGreenWithoutCurrentAttempt',
  ]) {
    if (!forbiddenIds.includes(id as never)) issues.push(`forbidden_display_missing:${id}`);
  }
  if (projection.forbiddenDashboardDisplays.some((item) => item.decision !== 'pass')) {
    issues.push('forbidden_display_blocked_in_valid_fixture');
  }
  if (projection.projectionGate.decision !== 'pass') {
    issues.push(...projection.projectionGate.issues);
  }
  return [...new Set(issues)];
}

export function mainDashboardProjectionMapping(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: dashboard-projection-mapping --out-dir <dir> [--json]');
    return 0;
  }
  const outDir = path.resolve(args.outDir ?? '_bmad-output/runtime/requirement-records/REQ-CLOSED-LOOP-DESIGN/evidence/TRACE-032/dashboard');
  const input = fixtureInput();
  const projection = buildSixMentalModelProjection(input);
  const issues = collectValidationIssues(projection);
  const projectionPath = path.join(outDir, 'dashboard-read-model-projection.json');
  const reportPath = path.join(outDir, 'dashboard-projection-mapping-report.json');
  writeJson(projectionPath, projection);
  const report = {
    reportType: 'dashboard_projection_mapping',
    generatedAt: new Date().toISOString(),
    generatedBy: args.generatedBy ?? 'agent',
    decision: issues.length === 0 ? 'pass' : 'blocked',
    projectionPath: projectionPath.replace(/\\/gu, '/'),
    projectionHash: sha256File(projectionPath),
    sixMentalModelView: projection.models.map((model) => model.id),
    businessObjectViews: Object.fromEntries(
      Object.entries(projection.businessObjectViews).map(([viewName, view]) => [
        viewName,
        {
          itemCount: view.items.length,
          canAffectControlFlow: view.canAffectControlFlow,
          currentCloseoutAttemptId: view.currentCloseoutAttemptId,
        },
      ])
    ),
    forbiddenDashboardDisplays: projection.forbiddenDashboardDisplays,
    issues,
  };
  writeJson(reportPath, report);
  const output = {
    ok: issues.length === 0,
    decision: report.decision,
    reportPath: reportPath.replace(/\\/gu, '/'),
    projectionPath: projectionPath.replace(/\\/gu, '/'),
    projectionHash: report.projectionHash,
    issues,
  };
  process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `dashboard_projection=${report.decision}\n`);
  return issues.length === 0 ? 0 : 1;
}

if (require.main === module) {
  try {
    process.exitCode = mainDashboardProjectionMapping(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 1;
  }
}
