import type {
  DashboardExecutionStateSummary,
  DashboardRuntimeContextPanel,
  DashboardScoreDetailPayload,
  DashboardStageTimelineEntry,
  DashboardWorkItem,
  DashboardWorkboardPayload,
} from './runtime-query';

export type SixMentalModelId =
  | 'requirement_confirmation'
  | 'architecture_confirmation'
  | 'implementation_readiness'
  | 'execution_closure'
  | 'audit_review'
  | 'delivery_confirmation';

export interface SixMentalModelProjection {
  projection_type: 'six_mental_models_dashboard_read_model';
  sourceOfTruthRole: 'read_model';
  canAffectControlFlow: false;
  controlAuthority: {
    allowedControlSource: 'requirement-record.json';
    dashboardCanCloseRequirement: false;
    forbiddenCompletionSources: string[];
  };
  models: SixMentalModelSection[];
  entryFlowSlices: SixMentalModelEntryFlowSlices;
  businessObjectViews: SixMentalModelBusinessObjectViews;
  forbiddenDashboardDisplays: SixMentalModelForbiddenDisplayCheck[];
  projectionGate: {
    decision: 'pass' | 'blocked';
    issues: string[];
  };
}

export interface SixMentalModelSection {
  id: SixMentalModelId;
  displayName: string;
  coreQuestion: string;
  status: string;
  evidenceSignals: string[];
  drillDownSliceRefs: string[];
}

export interface SixMentalModelEntryFlowSlices {
  stories: SixMentalModelDrillDownSlice[];
  bugfixes: SixMentalModelDrillDownSlice[];
  standaloneTasks: SixMentalModelDrillDownSlice[];
  epics: SixMentalModelBoardSlice[];
}

export interface SixMentalModelDrillDownSlice {
  sliceId: string;
  workItemType: DashboardWorkItem['work_item_type'];
  flow: DashboardWorkItem['flow'];
  title: string;
  boardStatus: DashboardWorkItem['board_status'];
  runtimeStatus: DashboardWorkItem['runtime_status'];
  currentStage: string | null;
  boardGroupId: string;
  boardGroupLabel: string;
}

export interface SixMentalModelBusinessObjectView {
  viewName: 'epicStoryView' | 'taskView' | 'bugfixView' | 'scoreView' | 'reportView' | 'sftDatasetView';
  role:
    | 'user_navigation_projection'
    | 'read_model_projection'
    | 'evidence_navigation_projection'
    | 'data_product_projection';
  sourceOfTruthRole: 'read_model' | 'projection';
  canAffectControlFlow: false;
  statusDerivation: 'six_mental_models_requirement_record_projection';
  currentCloseoutAttemptId: string | null;
  items: SixMentalModelBusinessObjectItem[];
}

export interface SixMentalModelBusinessObjectItem {
  objectId: string;
  objectType: 'epic' | 'story' | 'task' | 'bugfix' | 'score' | 'report' | 'sft_dataset';
  title: string;
  projectedStatus: string;
  linkedRequirementIds: string[];
  traceRows: string[];
  artifactRefs: string[];
  blockingReasons: string[];
  currentCloseoutAttemptId: string | null;
  nextControlledSource: 'requirement-record.json';
  canAffectControlFlow: false;
  sourceSlices: string[];
}

export interface SixMentalModelBusinessObjectViews {
  epicStoryView: SixMentalModelBusinessObjectView;
  taskView: SixMentalModelBusinessObjectView;
  bugfixView: SixMentalModelBusinessObjectView;
  scoreView: SixMentalModelBusinessObjectView;
  reportView: SixMentalModelBusinessObjectView;
  sftDatasetView: SixMentalModelBusinessObjectView;
}

export interface SixMentalModelForbiddenDisplayCheck {
  id:
    | 'epicsDoneAsCloseoutPass'
    | 'storiesDoneAsRequirementPass'
    | 'tasksDoneAsDeliveryPass'
    | 'scoreGreenAsCloseoutPass'
    | 'reportExistsAsAuditPass'
    | 'sftDatasetGeneratedAsProductionReady'
    | 'dashboardGreenWithoutCurrentAttempt';
  decision: 'pass' | 'blocked';
  reason: string;
}

export interface SixMentalModelBoardSlice {
  sliceId: string;
  label: string;
  status: string;
  counts: {
    todo: number;
    in_progress: number;
    done: number;
  };
}

export const SIX_MENTAL_MODEL_ORDER: SixMentalModelId[] = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
];

export const FORBIDDEN_COMPLETION_SOURCES = [
  'dashboard_health_score',
  'dashboard_green',
  'score_record',
  'score_green',
  'legacy_gate_report',
  'report_exists',
  'sft_dataset_generated',
  'epic_done',
  'story_done',
  'task_done',
  'bugfix_fixed',
  'party_mode_summary',
  'install_config',
  'schema_file',
] as const;

export const FORBIDDEN_DASHBOARD_DISPLAY_IDS: SixMentalModelForbiddenDisplayCheck['id'][] = [
  'epicsDoneAsCloseoutPass',
  'storiesDoneAsRequirementPass',
  'tasksDoneAsDeliveryPass',
  'scoreGreenAsCloseoutPass',
  'reportExistsAsAuditPass',
  'sftDatasetGeneratedAsProductionReady',
  'dashboardGreenWithoutCurrentAttempt',
];

const MODEL_COPY: Record<SixMentalModelId, Pick<SixMentalModelSection, 'displayName' | 'coreQuestion'>> = {
  requirement_confirmation: {
    displayName: '需求确认',
    coreQuestion: '用户确认了什么，哪些 ID 被允许进入实施？',
  },
  architecture_confirmation: {
    displayName: '架构确认',
    coreQuestion: '实施是否仍在当前架构确认覆盖范围内？',
  },
  implementation_readiness: {
    displayName: '实施准备',
    coreQuestion: '受控记录是否允许开始或继续实施？',
  },
  execution_closure: {
    displayName: '执行闭合',
    coreQuestion: '每个 trace 是否有当前运行证据、命令和 closure？',
  },
  audit_review: {
    displayName: '审计复核',
    coreQuestion: '失败、评分、审计和 rerun 是否进入同一受控闭环？',
  },
  delivery_confirmation: {
    displayName: '交付确认',
    coreQuestion: '最终 decision 是否只来自当前 closeout attempt？',
  },
};

function firstPresent(values: Array<string | null | undefined>, fallback: string): string {
  return values.find((value) => Boolean(value && value.trim())) ?? fallback;
}

function modelStatus(input: {
  model: SixMentalModelId;
  runtimeContext: DashboardRuntimeContextPanel;
  executionState: DashboardExecutionStateSummary;
  stageTimeline: DashboardStageTimelineEntry[];
  scoreDetail: DashboardScoreDetailPayload;
}): string {
  const latestStage = input.stageTimeline[0];
  if (input.model === 'requirement_confirmation') {
    return firstPresent([input.runtimeContext.status, input.executionState.execution_status], 'unknown');
  }
  if (input.model === 'architecture_confirmation') {
    return input.runtimeContext.reviewer_contract ? 'projection_available' : 'not_projected';
  }
  if (input.model === 'implementation_readiness') {
    return input.executionState.execution_status ?? latestStage?.status ?? 'unknown';
  }
  if (input.model === 'execution_closure') {
    return latestStage?.status ?? input.runtimeContext.status ?? 'unknown';
  }
  if (input.model === 'audit_review') {
    return input.runtimeContext.latest_reviewer_closeout?.result_code ?? 'not_projected';
  }
  return input.runtimeContext.latest_reviewer_closeout?.closeout_approved ? 'approved' : 'not_approved';
}

function evidenceSignals(input: {
  model: SixMentalModelId;
  runtimeContext: DashboardRuntimeContextPanel;
  executionState: DashboardExecutionStateSummary;
  stageTimeline: DashboardStageTimelineEntry[];
  scoreDetail: DashboardScoreDetailPayload;
}): string[] {
  if (input.model === 'requirement_confirmation') {
    return [
      `run=${input.runtimeContext.run_id ?? 'none'}`,
      `flow=${input.runtimeContext.flow ?? 'none'}`,
      `work_item=${input.runtimeContext.work_item?.work_item_id ?? 'none'}`,
    ];
  }
  if (input.model === 'architecture_confirmation') {
    return [
      `reviewer_registry=${input.runtimeContext.reviewer_contract?.registryVersion ?? 'none'}`,
      `active_consumer=${input.runtimeContext.reviewer_contract?.activeAuditConsumer?.entryStage ?? 'none'}`,
    ];
  }
  if (input.model === 'implementation_readiness') {
    return [
      `execution_status=${input.executionState.execution_status ?? 'none'}`,
      `fallback_used=${input.executionState.fallback_used ? 'yes' : 'no'}`,
      `last_rerun_gate=${input.executionState.last_rerun_gate_status ?? 'none'}`,
    ];
  }
  if (input.model === 'execution_closure') {
    return [
      `stage_count=${input.stageTimeline.length}`,
      `score_records=${input.scoreDetail.records.length}`,
      `finding_count=${input.scoreDetail.findings.length}`,
    ];
  }
  if (input.model === 'audit_review') {
    return [
      `audit_status=${input.runtimeContext.latest_reviewer_closeout?.audit_status ?? 'none'}`,
      `rerun_decision=${input.runtimeContext.latest_reviewer_closeout?.rerun_decision ?? 'none'}`,
      `score_failure_mode=${input.runtimeContext.latest_reviewer_closeout?.scoring_failure_mode ?? 'none'}`,
    ];
  }
  return [
    `closeout_approved=${input.runtimeContext.latest_reviewer_closeout?.closeout_approved ? 'yes' : 'no'}`,
    `packet_execution_closure_status=${input.runtimeContext.latest_reviewer_closeout?.packet_execution_closure_status ?? 'none'}`,
  ];
}

function toWorkItemSlice(workItem: DashboardWorkItem): SixMentalModelDrillDownSlice {
  return {
    sliceId: workItem.work_item_id,
    workItemType: workItem.work_item_type,
    flow: workItem.flow,
    title: workItem.title,
    boardStatus: workItem.board_status,
    runtimeStatus: workItem.runtime_status,
    currentStage: workItem.current_stage ?? null,
    boardGroupId: workItem.board_group_id,
    boardGroupLabel: workItem.board_group_label,
  };
}

function buildEntryFlowSlices(workboard: DashboardWorkboardPayload): SixMentalModelEntryFlowSlices {
  return {
    stories: workboard.work_items.filter((item) => item.flow === 'story').map(toWorkItemSlice),
    bugfixes: workboard.work_items.filter((item) => item.flow === 'bugfix').map(toWorkItemSlice),
    standaloneTasks: workboard.work_items
      .filter((item) => item.flow === 'standalone_tasks')
      .map(toWorkItemSlice),
    epics: workboard.board_groups
      .filter((group) => group.kind === 'epic')
      .map((group) => ({
        sliceId: group.board_group_id,
        label: group.board_group_label,
        status: group.board_status,
        counts: group.counts,
      })),
  };
}

function latestCloseoutAttemptId(runtimeContext: DashboardRuntimeContextPanel): string | null {
  const closeout = runtimeContext.latest_reviewer_closeout;
  if (!closeout) return null;
  return closeout.updated_at ? `reviewer-closeout:${closeout.updated_at}` : null;
}

function linkedRequirementsForSlice(slice: Pick<SixMentalModelDrillDownSlice, 'sliceId' | 'flow'>): string[] {
  return [`dashboard:${slice.flow}:${slice.sliceId}`];
}

function traceRowsForSlice(slice: Pick<SixMentalModelDrillDownSlice, 'sliceId'>): string[] {
  return [`trace:${slice.sliceId}`];
}

function blockingReasonsForSlice(slice: Pick<SixMentalModelDrillDownSlice, 'runtimeStatus' | 'boardStatus'>): string[] {
  const reasons: string[] = [];
  if (slice.runtimeStatus === 'failed' || slice.runtimeStatus === 'vetoed') {
    reasons.push(`runtime_status:${slice.runtimeStatus}`);
  }
  if (slice.boardStatus === 'in_progress') reasons.push('business_object_not_terminal');
  if (slice.boardStatus === 'todo') reasons.push('business_object_not_started');
  return reasons;
}

function statusForSlice(slice: Pick<SixMentalModelDrillDownSlice, 'runtimeStatus' | 'boardStatus'>): string {
  if (slice.runtimeStatus === 'failed' || slice.runtimeStatus === 'vetoed') return 'blocked_in_audit_review';
  if (slice.runtimeStatus === 'running' || slice.boardStatus === 'in_progress') return 'executing_or_missing_evidence';
  if (slice.boardStatus === 'done') return 'closeout_pass_projected';
  return 'closeout_not_started';
}

function workSliceToBusinessObject(
  slice: SixMentalModelDrillDownSlice,
  objectType: SixMentalModelBusinessObjectItem['objectType'],
  currentCloseoutAttemptId: string | null
): SixMentalModelBusinessObjectItem {
  return {
    objectId: slice.sliceId,
    objectType,
    title: slice.title,
    projectedStatus: statusForSlice(slice),
    linkedRequirementIds: linkedRequirementsForSlice(slice),
    traceRows: traceRowsForSlice(slice),
    artifactRefs: [slice.sliceId],
    blockingReasons: blockingReasonsForSlice(slice),
    currentCloseoutAttemptId,
    nextControlledSource: 'requirement-record.json',
    canAffectControlFlow: false,
    sourceSlices: [slice.sliceId],
  };
}

function epicToBusinessObject(
  slice: SixMentalModelBoardSlice,
  currentCloseoutAttemptId: string | null
): SixMentalModelBusinessObjectItem {
  const blockingReasons = slice.status === 'done' ? [] : [`epic_board_status:${slice.status}`];
  return {
    objectId: slice.sliceId,
    objectType: 'epic',
    title: slice.label,
    projectedStatus: slice.status === 'done' ? 'closeout_pass_projected' : 'executing_or_missing_evidence',
    linkedRequirementIds: [`dashboard:epic:${slice.sliceId}`],
    traceRows: [`trace:${slice.sliceId}`],
    artifactRefs: [slice.sliceId],
    blockingReasons,
    currentCloseoutAttemptId,
    nextControlledSource: 'requirement-record.json',
    canAffectControlFlow: false,
    sourceSlices: [slice.sliceId],
  };
}

function scoreBusinessObjects(
  scoreDetail: DashboardScoreDetailPayload,
  currentCloseoutAttemptId: string | null
): SixMentalModelBusinessObjectItem[] {
  return scoreDetail.records.map((record) => ({
    objectId: `score:${record.run_id}:${record.stage}`,
    objectType: 'score',
    title: `${record.stage} score ${record.phase_score}`,
    projectedStatus: record.veto_triggered ? 'blocked_in_audit_review' : 'audit_score_projected',
    linkedRequirementIds: [`dashboard:score:${record.run_id}`],
    traceRows: [`trace:score:${record.run_id}:${record.stage}`],
    artifactRefs: [record.source_path ?? record.run_id],
    blockingReasons: record.veto_triggered ? ['score_veto_projected_not_closeout'] : [],
    currentCloseoutAttemptId,
    nextControlledSource: 'requirement-record.json',
    canAffectControlFlow: false,
    sourceSlices: [record.run_id],
  }));
}

function reportBusinessObjects(
  runtimeContext: DashboardRuntimeContextPanel,
  scoreDetail: DashboardScoreDetailPayload,
  currentCloseoutAttemptId: string | null
): SixMentalModelBusinessObjectItem[] {
  const reviewerReport = runtimeContext.latest_reviewer_closeout?.report_path
    ? [
        {
          objectId: `report:${runtimeContext.latest_reviewer_closeout.report_path}`,
          objectType: 'report' as const,
          title: runtimeContext.latest_reviewer_closeout.report_path,
          projectedStatus: 'audit_report_projected',
          linkedRequirementIds: [`dashboard:report:${runtimeContext.latest_reviewer_closeout.report_path}`],
          traceRows: [`trace:report:${runtimeContext.latest_reviewer_closeout.report_path}`],
          artifactRefs: [runtimeContext.latest_reviewer_closeout.report_path],
          blockingReasons:
            runtimeContext.latest_reviewer_closeout.result_code === 'blocked'
              ? ['reviewer_closeout_blocked_projected']
              : [],
          currentCloseoutAttemptId,
          nextControlledSource: 'requirement-record.json' as const,
          canAffectControlFlow: false as const,
          sourceSlices: [runtimeContext.latest_reviewer_closeout.report_path],
        },
      ]
    : [];
  const scoreReports = scoreDetail.records
    .filter((record) => record.source_path)
    .map((record) => ({
      objectId: `report:${record.source_path}`,
      objectType: 'report' as const,
      title: record.source_path ?? record.run_id,
      projectedStatus: 'score_report_projected',
      linkedRequirementIds: [`dashboard:report:${record.run_id}`],
      traceRows: [`trace:report:${record.run_id}:${record.stage}`],
      artifactRefs: [record.source_path ?? record.run_id],
      blockingReasons: [],
      currentCloseoutAttemptId,
      nextControlledSource: 'requirement-record.json' as const,
      canAffectControlFlow: false as const,
      sourceSlices: [record.run_id],
    }));
  return [...reviewerReport, ...scoreReports];
}

function sftBusinessObjects(
  workboard: DashboardWorkboardPayload,
  currentCloseoutAttemptId: string | null
): SixMentalModelBusinessObjectItem[] {
  return workboard.work_items
    .filter((item) => item.sft_status && item.sft_status !== 'none')
    .map((item) => ({
      objectId: `sft:${item.work_item_id}`,
      objectType: 'sft_dataset' as const,
      title: `${item.title} SFT ${item.sft_status}`,
      projectedStatus: `sft_${item.sft_status}_projected`,
      linkedRequirementIds: [`dashboard:sft:${item.work_item_id}`],
      traceRows: [`trace:sft:${item.work_item_id}`],
      artifactRefs: [item.artifact_doc_path ?? item.source_path ?? item.work_item_id],
      blockingReasons: item.sft_status === 'blocked' ? ['sft_dataset_blocked_projected'] : [],
      currentCloseoutAttemptId,
      nextControlledSource: 'requirement-record.json' as const,
      canAffectControlFlow: false as const,
      sourceSlices: [item.work_item_id],
    }));
}

function businessView(input: {
  viewName: SixMentalModelBusinessObjectView['viewName'];
  role: SixMentalModelBusinessObjectView['role'];
  items: SixMentalModelBusinessObjectItem[];
  currentCloseoutAttemptId: string | null;
}): SixMentalModelBusinessObjectView {
  return {
    viewName: input.viewName,
    role: input.role,
    sourceOfTruthRole: input.role === 'user_navigation_projection' ? 'projection' : 'read_model',
    canAffectControlFlow: false,
    statusDerivation: 'six_mental_models_requirement_record_projection',
    currentCloseoutAttemptId: input.currentCloseoutAttemptId,
    items: input.items,
  };
}

function buildBusinessObjectViews(input: {
  runtimeContext: DashboardRuntimeContextPanel;
  scoreDetail: DashboardScoreDetailPayload;
  workboard: DashboardWorkboardPayload;
}): SixMentalModelBusinessObjectViews {
  const currentCloseoutAttemptId = latestCloseoutAttemptId(input.runtimeContext);
  return {
    epicStoryView: businessView({
      viewName: 'epicStoryView',
      role: 'user_navigation_projection',
      currentCloseoutAttemptId,
      items: [
        ...input.workboard.board_groups
          .filter((group) => group.kind === 'epic')
          .map((group) =>
            epicToBusinessObject(
              {
                sliceId: group.board_group_id,
                label: group.board_group_label,
                status: group.board_status,
                counts: group.counts,
              },
              currentCloseoutAttemptId
            )
          ),
        ...input.workboard.work_items
          .filter((item) => item.flow === 'story')
          .map((item) => workSliceToBusinessObject(toWorkItemSlice(item), 'story', currentCloseoutAttemptId)),
      ],
    }),
    taskView: businessView({
      viewName: 'taskView',
      role: 'user_navigation_projection',
      currentCloseoutAttemptId,
      items: input.workboard.work_items
        .filter((item) => item.flow === 'standalone_tasks')
        .map((item) => workSliceToBusinessObject(toWorkItemSlice(item), 'task', currentCloseoutAttemptId)),
    }),
    bugfixView: businessView({
      viewName: 'bugfixView',
      role: 'user_navigation_projection',
      currentCloseoutAttemptId,
      items: input.workboard.work_items
        .filter((item) => item.flow === 'bugfix')
        .map((item) => workSliceToBusinessObject(toWorkItemSlice(item), 'bugfix', currentCloseoutAttemptId)),
    }),
    scoreView: businessView({
      viewName: 'scoreView',
      role: 'read_model_projection',
      currentCloseoutAttemptId,
      items: scoreBusinessObjects(input.scoreDetail, currentCloseoutAttemptId),
    }),
    reportView: businessView({
      viewName: 'reportView',
      role: 'evidence_navigation_projection',
      currentCloseoutAttemptId,
      items: reportBusinessObjects(input.runtimeContext, input.scoreDetail, currentCloseoutAttemptId),
    }),
    sftDatasetView: businessView({
      viewName: 'sftDatasetView',
      role: 'data_product_projection',
      currentCloseoutAttemptId,
      items: sftBusinessObjects(input.workboard, currentCloseoutAttemptId),
    }),
  };
}

function validateBusinessObjectItem(item: SixMentalModelBusinessObjectItem): string[] {
  const issues: string[] = [];
  if (item.canAffectControlFlow !== false) issues.push(`business_object_can_affect_control:${item.objectId}`);
  if (item.nextControlledSource !== 'requirement-record.json') issues.push(`business_object_control_source_invalid:${item.objectId}`);
  if (item.linkedRequirementIds.length === 0) issues.push(`business_object_requirement_ids_missing:${item.objectId}`);
  if (item.traceRows.length === 0) issues.push(`business_object_trace_rows_missing:${item.objectId}`);
  if (item.artifactRefs.length === 0) issues.push(`business_object_artifact_refs_missing:${item.objectId}`);
  if (item.currentCloseoutAttemptId == null) issues.push(`business_object_current_attempt_missing:${item.objectId}`);
  return issues;
}

function validateBusinessObjectViews(views: SixMentalModelBusinessObjectViews): string[] {
  return Object.values(views).flatMap((view) => [
    ...(view.canAffectControlFlow === false ? [] : [`view_can_affect_control:${view.viewName}`]),
    ...view.items.flatMap(validateBusinessObjectItem),
  ]);
}

function buildForbiddenDashboardDisplays(
  currentCloseoutAttemptId: string | null
): SixMentalModelForbiddenDisplayCheck[] {
  return FORBIDDEN_DASHBOARD_DISPLAY_IDS.map((id) => ({
    id,
    decision: id === 'dashboardGreenWithoutCurrentAttempt' && !currentCloseoutAttemptId ? 'blocked' : 'pass',
    reason:
      id === 'dashboardGreenWithoutCurrentAttempt' && !currentCloseoutAttemptId
        ? 'dashboard green cannot imply closeout without current closeout attempt'
        : 'display remains read-only and cannot write requirement, closeout, or production-ready state',
  }));
}

export function buildSixMentalModelProjection(input: {
  runtimeContext: DashboardRuntimeContextPanel;
  executionState: DashboardExecutionStateSummary;
  stageTimeline: DashboardStageTimelineEntry[];
  scoreDetail: DashboardScoreDetailPayload;
  workboard: DashboardWorkboardPayload;
}): SixMentalModelProjection {
  const entryFlowSlices = buildEntryFlowSlices(input.workboard);
  const currentCloseoutAttemptId = latestCloseoutAttemptId(input.runtimeContext);
  const businessObjectViews = buildBusinessObjectViews({
    runtimeContext: input.runtimeContext,
    scoreDetail: input.scoreDetail,
    workboard: input.workboard,
  });
  const forbiddenDashboardDisplays = buildForbiddenDashboardDisplays(currentCloseoutAttemptId);
  const projectionIssues = [
    ...validateBusinessObjectViews(businessObjectViews),
    ...forbiddenDashboardDisplays
      .filter((item) => item.decision === 'blocked')
      .map((item) => `forbidden_dashboard_display:${item.id}`),
  ];
  const allSliceRefs = [
    ...entryFlowSlices.stories.map((item) => item.sliceId),
    ...entryFlowSlices.bugfixes.map((item) => item.sliceId),
    ...entryFlowSlices.standaloneTasks.map((item) => item.sliceId),
  ];

  return {
    projection_type: 'six_mental_models_dashboard_read_model',
    sourceOfTruthRole: 'read_model',
    canAffectControlFlow: false,
    controlAuthority: {
      allowedControlSource: 'requirement-record.json',
      dashboardCanCloseRequirement: false,
      forbiddenCompletionSources: [...FORBIDDEN_COMPLETION_SOURCES],
    },
    models: SIX_MENTAL_MODEL_ORDER.map((id) => ({
      id,
      displayName: MODEL_COPY[id].displayName,
      coreQuestion: MODEL_COPY[id].coreQuestion,
      status: modelStatus({ ...input, model: id }),
      evidenceSignals: evidenceSignals({ ...input, model: id }),
      drillDownSliceRefs: allSliceRefs,
    })),
    entryFlowSlices,
    businessObjectViews,
    forbiddenDashboardDisplays,
    projectionGate: {
      decision: projectionIssues.length === 0 ? 'pass' : 'blocked',
      issues: projectionIssues,
    },
  };
}
