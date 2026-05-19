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
  'score_record',
  'legacy_gate_report',
  'party_mode_summary',
  'install_config',
  'schema_file',
] as const;

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

export function buildSixMentalModelProjection(input: {
  runtimeContext: DashboardRuntimeContextPanel;
  executionState: DashboardExecutionStateSummary;
  stageTimeline: DashboardStageTimelineEntry[];
  scoreDetail: DashboardScoreDetailPayload;
  workboard: DashboardWorkboardPayload;
}): SixMentalModelProjection {
  const entryFlowSlices = buildEntryFlowSlices(input.workboard);
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
  };
}
