/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { applyLimit, resolveDisplayBudget } = require('./ai-tdd/display-budget');
const { HEADING_SCHEMAS, schemaHeading, schemaTitle } = require('./markdown-sections');
const {
  loadActiveRequirementRecords,
  resolveAiTddRuntimeDecision,
} = require('./ai-tdd/runtime-decision');

const BMADS_HEADINGS = HEADING_SCHEMAS.bmads;
const BMADS_ZH_HEADINGS = HEADING_SCHEMAS.bmadsZhCn;

const BMADS_TEXT = {
  en: {
    quickStartMessage:
      'No confirmed requirement contract is active yet. BMAD will not treat bootstrap or empty state as an implementation target. Create or import a confirmable requirement source first.',
    quickStartEntries: [
      'Create a product or feature requirement contract',
      'Create a bugfix requirement contract',
      'Create a standalone task contract',
      'Import an existing requirement document',
      'Review the current blocker',
    ],
    decisionHeadings: {
      seeing: 'What you are looking at',
      waiting: 'What is blocking progress',
      why: 'Why this matters',
      action: 'What to do now',
      avoid: 'What not to do',
    },
    summaryNoActiveSeeing: (runtime) =>
      `There are ${runtime?.inventory?.currentActionableRecords ?? 0} current-actionable requirement record(s) to continue.`,
    summaryNoActiveWaiting:
      'The system is waiting for a confirmable requirement contract source and its RequirementRecord.',
    summaryNoActiveWhy:
      'Without a confirmed source, BMADS cannot decide which mental model or runtime route is safe.',
    summaryNoActiveAction:
      'Next safe action: requirements-contract-authoring author-confirmation-ready-source.',
    summarySeeing: (primary) =>
      `You are looking at the AI-TDD runtime state for ${primary.recordId}.`,
    summaryWaitingDelivery: 'The system is waiting for user delivery acceptance.',
    summaryWhyDelivery:
      'Delivery confirmation cannot close until controlled closeout acceptance ingest records the exact accepted hash.',
    summaryWaitingReconfirmation: (primary) =>
      `The system is waiting for reconfirmation: ${primary.reconfirmation.triggerId}.`,
    summaryWhyReconfirmation:
      'A stale source, confirmation, architecture, execution, or closeout carrier must be repaired before later work continues.',
    summaryWaitingReadiness:
      'The system is waiting for implementation readiness to pass.',
    summaryWhyReadiness:
      'Implementation and story development stay blocked until the governed readiness gate is current and passing.',
    summaryWaitingDefault: (primary) =>
      `The first safe-action record is positioned at ${primary.currentMentalModel}.`,
    summaryWhyDefault:
      'The next step must follow the current mental model and RequirementRecord route.',
    summaryAction: (primary) => `Next safe action: ${primary.nextSafeAction}.`,
    headingSchema: BMADS_HEADINGS,
    sectionStatusSummary: schemaTitle(BMADS_HEADINGS, 'statusSummary'),
    sectionRecommendedNextSteps: schemaTitle(BMADS_HEADINGS, 'recommendedNextSteps'),
    sectionAvailableNextActions: schemaTitle(BMADS_HEADINGS, 'availableNextActions'),
    sectionRecommendedNow: schemaTitle(BMADS_HEADINGS, 'recommendedNow'),
    sectionCoreSkills: schemaTitle(BMADS_HEADINGS, 'coreSkills'),
    sectionNavigation: schemaTitle(BMADS_HEADINGS, 'navigation'),
    sectionActiveRequirementRecords: schemaTitle(
      BMADS_HEADINGS,
      'currentActionableRequirementRecords'
    ),
    sectionSixMentalModelPanorama: schemaTitle(BMADS_HEADINGS, 'sixMentalModelPanorama'),
    sectionRuntimeWorkflowGuidance: schemaTitle(BMADS_HEADINGS, 'runtimeWorkflowGuidance'),
    sectionSeeAlsoBmadHelp: schemaTitle(BMADS_HEADINGS, 'seeAlsoBmadHelp'),
    workflowRuntimeAuthority: schemaTitle(BMADS_HEADINGS, 'runtimeAuthority'),
    workflowSafetyPriority: schemaTitle(BMADS_HEADINGS, 'safetyPriority'),
    workflowOfficialExecutionPaths: schemaTitle(BMADS_HEADINGS, 'officialExecutionPaths'),
    workflowReconfirmationRoutes: schemaTitle(BMADS_HEADINGS, 'reconfirmationRoutes'),
    recordSuffixFirstSafeAction: 'first safe action',
    fieldSourceTitle: 'source/title',
    fieldFirstSafeActionReason: 'first safe-action reason',
    fieldSelectedByUser: 'selected by user',
    fieldRuntimeIndexPointer: 'runtime index pointer',
    fieldRuntimeIndexPointerStatus: 'runtime index pointer status',
    fieldActivityState: 'activity state',
    fieldCurrentMentalModel: 'current mental model',
    fieldSchemaModelStatus: 'schema model status',
    fieldDisplayState: 'display state',
    fieldBlockerSummary: 'blocker summary',
    fieldNextSafeAction: 'next safe action',
    fieldUpdatedAtCurrent: 'updatedAt/current',
    fieldCurrentAttemptHash: 'current attempt/hash',
    fieldCloseoutPage: 'closeout page',
    fieldCloseoutRenderReport: 'closeout render report',
    fieldDeliveryCloseoutReportHash: 'delivery closeout report hash',
    fieldExactConfirmationInstruction: 'exact confirmation instruction',
    fieldUserFacingNextAction: 'user-facing next action',
    fieldTerminalCompletion: 'terminal completion',
    boolYes: 'yes',
    boolNo: 'no',
    modelQuestionLabel: 'Question',
    modelStatusLabel: 'Status',
    modelStatusSourceLabel: 'Evidence source',
    routeBasisLabel: 'Route basis',
    routeBasisCurrent: 'current RequirementRecord model',
    routeBasisPending: 'waiting for prior model evidence',
    routeBasisTerminal: 'terminal event only, not a user-executable action',
    currentStatusSuffix: 'inferred current position',
    inventoryLabel: 'Record inventory',
    inventoryLoadableLabel: 'loadable record(s)',
    inventoryCurrentActionableLabel: 'current-actionable record(s)',
    inventoryClosedLabel: 'closed/history record(s)',
    hiddenCurrentActionableRecords: (count, budgetName) =>
      `${count} additional current-actionable record(s) hidden by ${budgetName} budget`,
    indexPointerWarning: (warning) =>
      `Runtime index pointer for ${warning.recordId} is ${warning.status}; sourceType=${warning.sourceType}, indexUpdatedAt=${warning.indexUpdatedAt}. Reason: ${warning.message}. It is not treated as user selection or newest-record selection.`,
    modelQuestions: {
      requirement_confirmation: 'What exactly will be done, excluded, and confirmed?',
      architecture_confirmation:
        'Which systems are affected, and are architectural risks confirmed?',
      implementation_readiness: 'Is it safe to enter implementation?',
      execution_closure: 'Are trace slices closed with current evidence?',
      audit_review: 'Are audit, RCA, and rerun loops closed?',
      delivery_confirmation: 'Can the work be safely called complete, shipped, and closed?',
    },
    runtimeAuthorityGuidance: [
      'On this page, current-actionable means not terminal closed and still carrying a safe route, blocker, acceptance wait, reconfirmation, or current attempt to resolve.',
      'CSV manifests are display projections only; they never write RequirementRecord control state.',
      'record_closed is terminal event state only, not a user-executable route.',
    ],
    safetyPriorityGuidance: [
      'Safety priority outranks explicit user selection: awaiting acceptance, reconfirmation, stale hash, stale attempt, delivery blocker, and readiness blocker win.',
    ],
    officialExecutionPaths: [
      'Requirement contract authoring: use skill `requirements-contract-authoring`; typical action/lane: author-confirmation-ready-source.',
      'Architecture confirmation: prepare_architecture_confirmation is a runtime route and next safe action, not a skill.',
      'Implementation readiness: run_implementation_readiness_gate is a runtime gate action, not a skill.',
      'Delivery confirmation: confirm-closeout-acceptance is a controlled command-like action, not a skill.',
    ],
    reconfirmationRoutes: [
      'Reconfirmation routes cover source hash drift, confirmation mismatch, architecture stale state, execution semantic gap, stale closeout page, stale acceptance request, and post-close defect.',
    ],
    relatedWorkflow: 'Related upstream workflow/skill: bmad-help',
    seeAlsoViewMode: 'View Mode: BMAD Upstream Workflow Panorama',
    seeAlsoSwitch:
      'To see the BMAD Method workflow panorama and catalog, run `bmad-speckit bmad-help`.',
    recommendedActionDelivery:
      'Open the closeout confirmation page and run confirm-closeout-acceptance, because delivery_confirmation is waiting for controlled user acceptance.',
    recommendedActionReadiness:
      'Run the implementation readiness gate first, because the current route is blocked until readiness is current and passing.',
    recommendedActionReconfirmation:
      'Repair and reconfirm the requirement source first, because stale confirmation evidence blocks later mental models.',
    recommendedActionDefault: (primary) =>
      `Run ${primary.nextSafeAction}, because ${primary.currentMentalModel} is the current AI-TDD control position.`,
    recommendedGoal: (skill) => `Use ${skill} only after the first safe-action blocker is clear.`,
    recommendedBmadHelp:
      'Use `bmad-speckit bmad-help` only when you need the BMAD Method workflow panorama, not to override this runtime safety route.',
    noActiveSeeing: [
      'There is no current-actionable requirement record to continue yet.',
      'The system does not know which requirement should move through confirmation, architecture, readiness, execution, audit, or delivery.',
    ],
    noActiveWaiting: [
      'The system is waiting for a confirmable requirement contract source and its RequirementRecord.',
    ],
    noActiveAction: [
      'Create or update the requirement contract first: requirements-contract-authoring author-confirmation-ready-source.',
      'If you only need to choose a BMAD workflow, open bmad-help; if you need to continue this governed requirement, create the contract first.',
    ],
    noActiveAvoid: [
      'Do not jump into implementation_readiness, story development, or /goal packet compilation yet.',
    ],
    baseAvoid: [
      'Do not choose work only by latest updated time; safety priority outranks explicit selection.',
      'Do not treat record_closed as a manually executable primary action.',
    ],
    activeSeeing: (runtime, primary) => [
      `You are handling ${runtime.inventory?.currentActionableRecords ?? runtime.activeRecords.length} current-actionable RequirementRecord(s).`,
      `Look at ${primary.recordId} first because it has the highest safety priority: ${runtime.primaryBecause}.`,
      `Current position is ${primary.currentMentalModel}; the next step must follow the Next Safe Action.`,
    ],
    waitingDelivery: (primary) => `First safe-action record ${primary.recordId} is waiting for user delivery acceptance.`,
    actionDelivery:
      'Open the closeout confirmation page first and complete confirm-closeout-acceptance using the exact confirmation instruction.',
    avoidDelivery:
      'Do not continue implementation, audit dispatch, or record closure until controlled closeout acceptance ingest completes.',
    waitingReconfirmation: (primary) =>
      `First safe-action record ${primary.recordId} is waiting for reconfirmation: ${primary.reconfirmation.triggerId}.`,
    actionReconfirmation: (primary) =>
      `Run ${primary.nextSafeAction} first, refresh confirmation material, then continue the later mental model.`,
    avoidReconfirmation: 'Do not continue from a stale packet or stale confirmation hash.',
    waitingReadiness: (primary) =>
      `First safe-action record ${primary.recordId} is waiting for implementation readiness repair or gate pass.`,
    actionReadiness: (primary) =>
      `Run ${primary.nextSafeAction} first; do not enter story development directly.`,
    avoidReadiness:
      'Do not treat upstream planning readiness as governed runtime readiness.',
    waitingDefault: (primary) =>
      `First safe-action record ${primary.recordId} is currently at ${primary.currentMentalModel}.`,
    actionDefault: (primary) => `Run the Next Safe Action first: ${primary.nextSafeAction}.`,
    secondaryWaiting: (count) =>
      `There are ${count} additional current-actionable record(s). They are still visible, but they are not the first safe action right now.`,
    secondaryAvoid:
      'Do not push multiple current-actionable records through implementation in parallel unless the first safe-action blocker is cleared.',
    seeAlso: [
      'If you need to decide whether this requirement can continue, use this page: RequirementRecord, blockers, and Next Safe Action.',
      'If you need to decide which BMAD workflow or agent to choose, run `bmad-speckit bmad-help` or use skill `bmad-help`.',
      'Do not mix control authority between the two entries: runtime safety action comes from this page; BMAD upstream catalog explanation comes from bmad-help.',
    ],
  },
  'zh-CN': {
    quickStartMessage:
      '当前项目尚未创建需求契约。BMAD 不会把初始化占位状态当作真实需求。请先创建或导入一个可确认的需求源文档。',
    quickStartEntries: [
      '创建产品/功能需求契约',
      '创建 Bugfix 需求契约',
      '创建独立任务契约',
      '导入已有需求文档',
      '查看当前阻塞原因',
    ],
    decisionHeadings: {
      seeing: '你现在看到什么',
      waiting: '系统在等什么',
      why: '为什么这很重要',
      action: '你现在要做什么',
      avoid: '不要做什么',
    },
    summaryNoActiveSeeing: (runtime) =>
      `当前还有 ${runtime?.inventory?.currentActionableRecords ?? 0} 条可继续推进的需求记录。`,
    summaryNoActiveWaiting: '系统在等一个可确认的需求契约源文档和对应 RequirementRecord。',
    summaryNoActiveWhy: '没有确认过的源文档时，BMADS 不能判断哪个心智模型或 runtime route 是安全的。',
    summaryNoActiveAction:
      '下一安全动作：requirements-contract-authoring author-confirmation-ready-source。',
    summarySeeing: (primary) => `你正在查看 ${primary.recordId} 的 AI-TDD runtime 状态。`,
    summaryWaitingDelivery: '系统在等用户交付验收。',
    summaryWhyDelivery:
      '交付确认必须等 controlled closeout acceptance ingest 记录精确验收 hash 后才能关闭。',
    summaryWaitingReconfirmation: (primary) =>
      `系统在等 reconfirmation：${primary.reconfirmation.triggerId}。`,
    summaryWhyReconfirmation:
      '源文档、确认、架构、执行或 closeout carrier 过期时，必须先修复再继续后续心智模型。',
    summaryWaitingReadiness: '系统在等 implementation readiness 通过。',
    summaryWhyReadiness:
      'readiness gate 未保持当前且通过时，implementation 和 story development 都必须阻塞。',
    summaryWaitingDefault: (primary) => `第一安全动作记录位于 ${primary.currentMentalModel}。`,
    summaryWhyDefault: '下一步必须服从当前心智模型和 RequirementRecord route。',
    summaryAction: (primary) => `下一安全动作：${primary.nextSafeAction}。`,
    headingSchema: BMADS_ZH_HEADINGS,
    sectionStatusSummary: schemaTitle(BMADS_ZH_HEADINGS, 'statusSummary'),
    sectionRecommendedNextSteps: schemaTitle(BMADS_ZH_HEADINGS, 'recommendedNextSteps'),
    sectionAvailableNextActions: schemaTitle(BMADS_ZH_HEADINGS, 'availableNextActions'),
    sectionRecommendedNow: schemaTitle(BMADS_ZH_HEADINGS, 'recommendedNow'),
    sectionCoreSkills: schemaTitle(BMADS_ZH_HEADINGS, 'coreSkills'),
    sectionNavigation: schemaTitle(BMADS_ZH_HEADINGS, 'navigation'),
    sectionActiveRequirementRecords: schemaTitle(
      BMADS_ZH_HEADINGS,
      'currentActionableRequirementRecords'
    ),
    sectionSixMentalModelPanorama: schemaTitle(BMADS_ZH_HEADINGS, 'sixMentalModelPanorama'),
    sectionRuntimeWorkflowGuidance: schemaTitle(BMADS_ZH_HEADINGS, 'runtimeWorkflowGuidance'),
    sectionSeeAlsoBmadHelp: schemaTitle(BMADS_ZH_HEADINGS, 'seeAlsoBmadHelp'),
    workflowRuntimeAuthority: schemaTitle(BMADS_ZH_HEADINGS, 'runtimeAuthority'),
    workflowSafetyPriority: schemaTitle(BMADS_ZH_HEADINGS, 'safetyPriority'),
    workflowOfficialExecutionPaths: schemaTitle(BMADS_ZH_HEADINGS, 'officialExecutionPaths'),
    workflowReconfirmationRoutes: schemaTitle(BMADS_ZH_HEADINGS, 'reconfirmationRoutes'),
    recordSuffixFirstSafeAction: '第一安全动作',
    fieldSourceTitle: '来源/标题',
    fieldFirstSafeActionReason: '第一安全动作原因',
    fieldSelectedByUser: '用户显式选择',
    fieldRuntimeIndexPointer: 'runtime index 指针',
    fieldRuntimeIndexPointerStatus: 'runtime index 指针状态',
    fieldActivityState: '记录状态',
    fieldCurrentMentalModel: '当前心智模型',
    fieldSchemaModelStatus: 'schema 模型状态',
    fieldDisplayState: '显示状态',
    fieldBlockerSummary: '阻塞摘要',
    fieldNextSafeAction: '下一安全动作',
    fieldUpdatedAtCurrent: '更新时间/当前证据',
    fieldCurrentAttemptHash: '当前 attempt/hash',
    fieldCloseoutPage: '交付确认页',
    fieldCloseoutRenderReport: '交付确认渲染报告',
    fieldDeliveryCloseoutReportHash: '交付 closeout 报告 hash',
    fieldExactConfirmationInstruction: '精确确认指令',
    fieldUserFacingNextAction: '用户侧下一动作',
    fieldTerminalCompletion: '终态完成',
    boolYes: '是',
    boolNo: '否',
    modelQuestionLabel: '用户问题',
    modelStatusLabel: '状态',
    modelStatusSourceLabel: '证据来源',
    routeBasisLabel: '路由依据',
    routeBasisCurrent: '当前 RequirementRecord 模型',
    routeBasisPending: '等待前序模型证据',
    routeBasisTerminal: '只是终态事件，不是用户可执行动作',
    currentStatusSuffix: '推断当前位置',
    inventoryLabel: '记录清单',
    inventoryLoadableLabel: '可加载记录',
    inventoryCurrentActionableLabel: '可继续推进记录',
    inventoryClosedLabel: '已关闭/历史记录',
    hiddenCurrentActionableRecords: (count, budgetName) =>
      `${count} 条额外可继续推进记录因 ${budgetName} 显示预算折叠`,
    indexPointerWarning: (warning) =>
      `${warning.recordId} 的 runtime index 指针状态是 ${warning.status}；sourceType=${warning.sourceType}，indexUpdatedAt=${warning.indexUpdatedAt}。原因：${warning.status === 'ignored_fixture_pointer' ? 'runtime index 指针来自 fixture source，不会被当成用户选择' : 'runtime index 指针早于另一条可继续推进记录，不会被当成用户选择'}。它不会被当成用户选择，也不会被当成最新需求。`,
    modelQuestions: {
      requirement_confirmation: '到底要做什么、不做什么、由谁确认？',
      architecture_confirmation: '哪些系统会被影响，架构风险是否已经确认？',
      implementation_readiness: '现在进入实现是否安全？',
      execution_closure: '每个 trace slice 是否都有当前证据并已关闭？',
      audit_review: '审计、RCA 和 rerun 闭环是否已经关闭？',
      delivery_confirmation: '工作能安全地称为完成、交付并关闭吗？',
    },
    runtimeAuthorityGuidance: [
      '本页中“可继续推进”表示记录没有 terminal close，并且仍有安全 route、阻塞、验收等待、reconfirmation 或 current attempt 需要处理。',
      'CSV manifest 只是显示投影；它们永远不会写入 RequirementRecord 控制状态。',
      'record_closed 只是终态事件，不是用户可执行的主 route。',
    ],
    safetyPriorityGuidance: [
      '安全优先级高于 explicit selection：等待验收、重新确认、hash 过期、attempt 过期、交付阻塞和 readiness 阻塞都会优先生效。',
    ],
    officialExecutionPaths: [
      '需求契约编写：使用技能 `requirements-contract-authoring`；常用动作/lane：author-confirmation-ready-source。',
      '架构确认：prepare_architecture_confirmation 是 runtime route 和下一安全动作，不是技能。',
      '实现就绪：run_implementation_readiness_gate 是 runtime gate action，不是技能。',
      '交付确认：confirm-closeout-acceptance 是受控命令型动作，不是技能。',
    ],
    reconfirmationRoutes: [
      'Reconfirmation route 覆盖源文档 hash 漂移、确认不匹配、架构过期、执行语义缺口、交付确认页过期、验收请求过期和关闭后缺陷。',
    ],
    relatedWorkflow: '相关 upstream workflow/skill：bmad-help',
    seeAlsoViewMode: 'View Mode: BMAD Upstream Workflow Panorama',
    seeAlsoSwitch: '如需查看 BMAD 方法学全景和 catalog，运行 `bmad-speckit bmad-help`。',
    recommendedActionDelivery:
      '先打开 closeout confirmation page 并执行 confirm-closeout-acceptance，因为 delivery_confirmation 正在等待 controlled user acceptance。',
    recommendedActionReadiness:
      '先运行 implementation readiness gate，因为当前 route 必须等 readiness 保持当前且通过。',
    recommendedActionReconfirmation:
      '先修复并重新确认需求源，因为过期确认凭证会阻塞后续心智模型。',
    recommendedActionDefault: (primary) =>
      `先执行 ${primary.nextSafeAction}，因为 ${primary.currentMentalModel} 是当前 AI-TDD 控制位置。`,
    recommendedGoal: (skill) => `只有第一安全动作的阻塞清除后才使用 ${skill}。`,
    recommendedBmadHelp:
      '只有需要 BMAD 方法学全景时才运行 `bmad-speckit bmad-help`，不要用它覆盖本页 runtime 安全路线。',
    noActiveSeeing: [
      '当前还没有可继续推进的需求记录。',
      '这意味着系统还不知道要为哪个需求判断确认、架构、readiness、执行、审计或交付。',
    ],
    noActiveWaiting: [
      '系统在等一个可确认的需求契约源文档和对应 RequirementRecord。',
    ],
    noActiveAction: [
      '先创建或更新需求契约：requirements-contract-authoring author-confirmation-ready-source。',
      '如果你只是想选 BMAD 方法学里的工作流，再看 bmad-help；如果你要继续当前需求执行，先补需求契约。',
    ],
    noActiveAvoid: [
      '不要直接进入 implementation_readiness、story development 或 /goal packet 编译。',
    ],
    baseAvoid: [
      '不要只按最新更新时间选择记录；安全优先级高于 explicit selection。',
      '不要把 record_closed 当作可手动执行的主动作。',
    ],
    activeSeeing: (runtime, primary) => [
      `你正在处理 ${runtime.inventory?.currentActionableRecords ?? runtime.activeRecords.length} 条可继续推进的需求记录。`,
      `当前先看 ${primary.recordId}，因为它的安全优先级最高：${runtime.primaryBecause}。`,
      `当前位置是 ${primary.currentMentalModel}，下一步必须按 Next Safe Action 走。`,
    ],
    waitingDelivery: (primary) => `第一安全动作记录 ${primary.recordId} 在等用户交付验收。`,
    actionDelivery:
      '先打开 closeout confirmation 页面，按 exact confirmation instruction 完成 confirm-closeout-acceptance。',
    avoidDelivery:
      '不要继续 implementation、audit dispatch 或关闭记录，直到 controlled closeout acceptance ingest 完成。',
    waitingReconfirmation: (primary) =>
      `第一安全动作记录 ${primary.recordId} 在等 reconfirmation：${primary.reconfirmation.triggerId}。`,
    actionReconfirmation: (primary) =>
      `先执行 ${primary.nextSafeAction}，刷新确认材料后再继续后续模型。`,
    avoidReconfirmation: '不要从旧 packet 或旧确认 hash 继续执行。',
    waitingReadiness: (primary) =>
      `第一安全动作记录 ${primary.recordId} 在等 implementation readiness 修复或 gate 通过。`,
    actionReadiness: (primary) =>
      `先执行 ${primary.nextSafeAction}，不要直接进入 story development。`,
    avoidReadiness: '不要把 upstream planning readiness 当成 governed runtime readiness。',
    waitingDefault: (primary) =>
      `第一安全动作记录 ${primary.recordId} 当前位于 ${primary.currentMentalModel}。`,
    actionDefault: (primary) => `先执行 Next Safe Action：${primary.nextSafeAction}。`,
    secondaryWaiting: (count) =>
      `另外还有 ${count} 条额外的可继续推进记录；它们没有消失，但不是当前第一安全动作。`,
    secondaryAvoid:
      '不要并行推动多个可继续推进记录的实施路径，除非当前第一安全动作的阻塞已解除。',
    seeAlso: [
      '如果你要决定“当前这个需求下一步能不能继续”，看本页的 RequirementRecord、阻塞原因和 Next Safe Action。',
      '如果你要决定“BMAD 方法学里该选哪个 workflow/agent”，运行 `bmad-speckit bmad-help` 或使用 skill `bmad-help`。',
      '不要在两个入口之间混用控制权：runtime 安全动作以本页为准，BMAD upstream catalog 说明以 bmad-help 为准。',
    ],
  },
};

function parseArgs(argv) {
  const options = { projectRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cwd') options.projectRoot = argv[++index] || options.projectRoot;
    else if (arg.startsWith('--cwd=')) options.projectRoot = arg.slice('--cwd='.length);
    else if (arg === '--json') options.json = true;
    else if (arg === '--budget') options.budget = argv[++index];
    else if (arg.startsWith('--budget=')) options.budget = arg.slice('--budget='.length);
    else if (arg === '--lang' || arg === '--locale') options.lang = argv[++index];
    else if (arg.startsWith('--lang=')) options.lang = arg.slice('--lang='.length);
    else if (arg.startsWith('--locale=')) options.lang = arg.slice('--locale='.length);
  }
  if (process.env.npm_config_json === 'true') options.json = true;
  return options;
}

function resolveLanguage(input) {
  const value = String(input || process.env.BMAD_LANG || process.env.BMAD_LOCALE || '').toLowerCase();
  if (/^zh|chinese|cn|hans|zh[-_]?cn/u.test(value)) return 'zh-CN';
  return 'en';
}

function textBundle(language) {
  return BMADS_TEXT[resolveLanguage(language)];
}

function packageAssetRoot() {
  return path.resolve(__dirname, '..', '..');
}

function repoAssetRoot() {
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function hasBmadAssets(assetRoot) {
  return fs.existsSync(path.join(assetRoot, '_bmad', '_config', 'bmads-runtime.yaml'));
}

function resolveBmadAssetRoot(projectRoot, explicitAssetRoot) {
  const candidates = [
    explicitAssetRoot,
    projectRoot,
    packageAssetRoot(),
    repoAssetRoot(),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (hasBmadAssets(resolved)) return resolved;
  }
  return path.resolve(explicitAssetRoot || projectRoot || packageAssetRoot());
}

function loadRuntimeContract(assetRoot) {
  const contractPath = path.join(assetRoot, '_bmad', '_config', 'bmads-runtime.yaml');
  const parsed = yaml.load(fs.readFileSync(contractPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${contractPath} must be a YAML object`);
  }
  if (!Array.isArray(parsed.layers)) {
    throw new Error(`${contractPath} must define layers[]`);
  }
  if (!parsed.contracts || typeof parsed.contracts !== 'object' || Array.isArray(parsed.contracts)) {
    throw new Error(`${contractPath} must define contracts{}`);
  }
  if (!parsed.entry || typeof parsed.entry !== 'object' || Array.isArray(parsed.entry)) {
    throw new Error(`${contractPath} must define entry{}`);
  }
  return parsed;
}

function existsRelative(projectRoot, relativePath) {
  return fs.existsSync(path.join(projectRoot, relativePath));
}

function toProjectRelative(projectRoot, filePath) {
  return path.relative(projectRoot, filePath).replace(/\\/g, '/');
}

function collectFilesRecursive(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else files.push(entryPath);
    }
  };
  visit(root);
  return files;
}

function artifactRecord(projectRoot, filePath) {
  const stat = fs.statSync(filePath);
  return {
    path: toProjectRelative(projectRoot, filePath),
    bytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

function collectUpstreamArtifacts(projectRoot) {
  const planningRoot = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
  const files = collectFilesRecursive(planningRoot);
  const byName = (predicate) =>
    files
      .filter((filePath) => predicate(path.basename(filePath).toLowerCase()))
      .map((filePath) => artifactRecord(projectRoot, filePath))
      .sort((left, right) => left.path.localeCompare(right.path));
  return {
    productBriefs: byName(
      (name) => /^product-brief.*\.md$/u.test(name) || /^brief.*\.md$/u.test(name)
    ),
    prds: byName((name) => name === 'prd.md' || /^prd[._-].*\.md$/u.test(name)),
    architectures: byName(
      (name) => name === 'architecture.md' || /^arch(?:itecture)?[._-].*\.md$/u.test(name)
    ),
    epics: byName((name) => name === 'epics.md' || /^epics[._-].*\.md$/u.test(name)),
  };
}

function findLatestReadinessReport(projectRoot) {
  const roots = [
    path.join(projectRoot, '_bmad-output', 'planning-artifacts'),
    path.join(projectRoot, '_bmad-output', 'implementation-artifacts'),
  ];
  const matches = [];
  const visit = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (/implementation-readiness-report-\d{4}-\d{2}-\d{2}\.md$/iu.test(entry.name)) {
        matches.push({ filePath: entryPath, mtimeMs: fs.statSync(entryPath).mtimeMs });
      }
    }
  };
  for (const root of roots) visit(root);
  matches.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return matches[0]?.filePath || null;
}

function resolveReadinessStatus(projectRoot) {
  const reportPath = findLatestReadinessReport(projectRoot);
  if (!reportPath) {
    return {
      status: 'missing',
      reportPath: null,
      reason: 'No implementation-readiness report was found.',
    };
  }
  const content = fs.readFileSync(reportPath, 'utf8');
  const normalized = content.replace(/\r\n/g, '\n');
  const hasNotReadyConclusion =
    /\bNOT\s+READY\b/iu.test(normalized) ||
    /Overall Readiness Status\s*\n+\s*\*\*NOT READY\*\*/iu.test(normalized);
  const hasReadyConclusion =
    !hasNotReadyConclusion &&
    (/\bREADY\b/iu.test(normalized) ||
      /ready_clean/iu.test(normalized) ||
      /repair_closed/iu.test(normalized) ||
      /Overall Readiness Status\s*\n+\s*\*\*READY\*\*/iu.test(normalized));
  if (!hasReadyConclusion) {
    return {
      status: 'missing',
      reportPath: toProjectRelative(projectRoot, reportPath),
      reason:
        'Latest implementation-readiness report does not state READY / ready_clean / repair_closed.',
    };
  }
  const runtimeContextPath = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'context',
    'project.json'
  );
  if (
    fs.existsSync(runtimeContextPath) &&
    fs.statSync(reportPath).mtimeMs < fs.statSync(runtimeContextPath).mtimeMs
  ) {
    return {
      status: 'stale',
      reportPath: toProjectRelative(projectRoot, reportPath),
      reason: 'Latest implementation-readiness report is older than the active runtime context.',
    };
  }
  return {
    status: 'ready',
    reportPath: toProjectRelative(projectRoot, reportPath),
    reason: 'Latest implementation-readiness report states READY / ready_clean / repair_closed.',
  };
}

function outputRootForLayer(layerId) {
  switch (layerId) {
    case 'layer_1':
      return '_bmad-output/runtime/context';
    case 'layer_2':
      return 'docs/architecture';
    case 'layer_3':
      return 'docs/stories';
    case 'layer_4':
      return 'specs';
    case 'layer_5':
      return '_bmad-output/runtime/gates';
    default:
      return '_bmad-output/runtime/context';
  }
}

function loadLayerDefinitions(assetRoot) {
  const mappingPath = path.join(assetRoot, '_bmad', '_config', 'stage-mapping.yaml');
  const parsed = yaml.load(fs.readFileSync(mappingPath, 'utf8')) || {};
  const rawLayers = parsed.layer_to_stages || {};
  return ['layer_1', 'layer_2', 'layer_3', 'layer_4', 'layer_5'].map((id) => {
    const stages = rawLayers[id]?.stages || [];
    const executableStages = Array.from(
      new Set(
        stages.map((stage) =>
          stage === 'story' ? 'story_create' : stage === 'post_impl' ? 'post_audit' : stage
        )
      )
    );
    return {
      id,
      name: rawLayers[id]?.name || id,
      stages: executableStages,
      outputRoot: outputRootForLayer(id),
    };
  });
}

function stageEvidencePath(projectRoot, layer, stage) {
  return path.join(projectRoot, layer.outputRoot, `${layer.id}-${stage}.complete.json`);
}

function exactStageEvidenceNames(stage) {
  const normalized = String(stage).toLowerCase();
  const dashed = normalized.replace(/_/gu, '-');
  const names = new Set([
    `${normalized}.json`,
    `${normalized}.md`,
    `${dashed}.json`,
    `${dashed}.md`,
  ]);
  if (stage === 'arch') {
    for (const item of ['architecture.md', 'architecture.json', 'arch.md', 'arch.json']) {
      names.add(item);
    }
  }
  if (stage === 'epics') {
    names.add('epics.md');
    names.add('epics.json');
  }
  if (stage === 'story_create') {
    names.add('story-create.md');
    names.add('story-create.json');
  }
  if (stage === 'post_audit') {
    names.add('post-audit.md');
    names.add('post-audit.json');
  }
  return names;
}

function hasUpstreamPlanningArtifact(projectRoot, fileNames) {
  const planningRoot = path.join(projectRoot, '_bmad-output', 'planning-artifacts');
  if (!fs.existsSync(planningRoot)) return false;
  const names = new Set(fileNames.map((item) => item.toLowerCase()));
  const stack = [planningRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (names.has(entry.name.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

function gateReportPassed(filePath, predicate) {
  if (!fs.existsSync(filePath)) return false;
  try {
    return predicate(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return false;
  }
}

function resolveStageEvidence(projectRoot, layer, stage) {
  const root = path.join(projectRoot, layer.outputRoot);
  if (stage === 'release_gate') {
    const completed =
      fs.existsSync(root) &&
      gateReportPassed(
        path.join(root, 'main-agent-release-gate-report.json'),
        (value) => value.critical_failures === 0 && value.blocked_sprint_status_update === false
      );
    return { completed, evidenceKind: completed ? 'gate_report' : 'missing' };
  }
  if (stage === 'delivery_truth_gate') {
    const completed =
      fs.existsSync(root) &&
      gateReportPassed(
        path.join(root, 'main-agent-delivery-truth-gate-report.json'),
        (value) => value.completionAllowed === true
      );
    return { completed, evidenceKind: completed ? 'gate_report' : 'missing' };
  }
  const explicitStageMarker = stageEvidencePath(projectRoot, layer, stage);
  if (fs.existsSync(explicitStageMarker)) {
    return { completed: true, evidenceKind: 'strict_marker' };
  }
  if (layer.id === 'layer_1' && stage === 'prd') {
    const upstreamPrdComplete = hasUpstreamPlanningArtifact(projectRoot, ['prd.md']);
    return {
      completed: upstreamPrdComplete,
      evidenceKind: upstreamPrdComplete ? 'upstream_artifact' : 'missing',
    };
  }
  if (!fs.existsSync(root)) {
    if (layer.id === 'layer_2' && stage === 'arch') {
      const completed = hasUpstreamPlanningArtifact(projectRoot, ['architecture.md']);
      return { completed, evidenceKind: completed ? 'upstream_artifact' : 'missing' };
    }
    if (layer.id === 'layer_3' && stage === 'epics') {
      const completed = hasUpstreamPlanningArtifact(projectRoot, ['epics.md']);
      return { completed, evidenceKind: completed ? 'upstream_artifact' : 'missing' };
    }
    return { completed: false, evidenceKind: 'missing' };
  }
  const exactNames = exactStageEvidenceNames(stage);
  const completed = fs
    .readdirSync(root, { withFileTypes: true })
    .some((entry) => exactNames.has(entry.name.toLowerCase()));
  if (completed) return { completed: true, evidenceKind: 'strict_marker' };
  if (layer.id === 'layer_2' && stage === 'arch') {
    const upstreamComplete = hasUpstreamPlanningArtifact(projectRoot, ['architecture.md']);
    return {
      completed: upstreamComplete,
      evidenceKind: upstreamComplete ? 'upstream_artifact' : 'missing',
    };
  }
  if (layer.id === 'layer_3' && stage === 'epics') {
    const upstreamComplete = hasUpstreamPlanningArtifact(projectRoot, ['epics.md']);
    return {
      completed: upstreamComplete,
      evidenceKind: upstreamComplete ? 'upstream_artifact' : 'missing',
    };
  }
  return { completed: false, evidenceKind: 'missing' };
}

function resolveBmadHelpFiveLayerProgressState(input) {
  const projectRoot = path.resolve(input.projectRoot);
  const assetRoot = path.resolve(input.assetRoot || projectRoot);
  const layers = loadLayerDefinitions(assetRoot);
  const stageStatuses = layers.flatMap((layer) =>
    layer.stages.map((stage) => {
      const evidence = resolveStageEvidence(projectRoot, layer, stage);
      return {
        layer: layer.id,
        stage,
        completed: evidence.completed,
        evidenceKind: evidence.evidenceKind,
        evidencePath: stageEvidencePath(projectRoot, layer, stage),
      };
    })
  );
  const firstIncomplete = stageStatuses.find((item) => !item.completed) || stageStatuses.at(-1);
  if (!firstIncomplete) {
    throw new Error('bmad-help five-layer mapping has no executable stages');
  }
  const completedLayers = layers
    .filter(
      (layer) =>
        layer.stages.length > 0 &&
        layer.stages.every((stage) =>
          stageStatuses.some(
            (item) => item.layer === layer.id && item.stage === stage && item.completed
          )
        )
    )
    .map((layer) => layer.id);
  return {
    currentLayer: firstIncomplete.layer,
    currentStage: firstIncomplete.stage,
    nextRequiredLayer: firstIncomplete.layer,
    completedLayers,
    stageStatuses,
  };
}

function buildNoActiveRequirementSurface(labels = textBundle()) {
  return {
    source: 'no_active_requirement',
    nextAction: 'contract_authoring_required',
    ready: false,
    pendingPacketStatus: 'none',
    sessionId: null,
    stageSummary: {
      currentMentalModelStatus: 'context_intake_blocked',
      userFacingMessage: labels.quickStartMessage,
      blockingReasons: ['no_active_requirement', 'contract_authoring_required'],
    },
  };
}

function resolveMainAgentOrchestrationSurface(projectRoot, labels = textBundle()) {
  const { records } = loadActiveRequirementRecords(projectRoot);
  const hasActiveRequirement = records.length > 0;
  if (!hasActiveRequirement) return buildNoActiveRequirementSurface(labels);
  const primary = records[0];
  return {
    source: 'requirement_record',
    nextAction: 'inspect_requirement_record',
    ready: true,
    pendingPacketStatus: 'none',
    sessionId: primary.recordId,
    stageSummary: {
      currentMentalModelStatus: 'requirement_record_available',
      userFacingMessage: 'Active requirement record is available. Inspect the current record for next action.',
      blockingReasons: [],
    },
  };
}

function filterRecommendedWorkflows(input) {
  if (input.currentStage !== 'story_create') return input.workflows;
  if (input.readiness.status === 'ready') return input.workflows;
  return input.workflows.filter((workflow) => workflow !== 'bmad-story-assistant');
}

function buildBmadsOutput(projectRootInput = process.cwd(), buildOptions = {}) {
  const projectRoot =
    typeof projectRootInput === 'object'
      ? path.resolve(projectRootInput.projectRoot || process.cwd())
      : path.resolve(projectRootInput);
  const options = typeof projectRootInput === 'object' ? projectRootInput : buildOptions;
  const language = resolveLanguage(options.lang || options.language || options.locale);
  const labels = textBundle(language);
  const assetRoot = resolveBmadAssetRoot(projectRoot, options.assetRoot);
  const runtime = loadRuntimeContract(assetRoot);
  const progress = resolveBmadHelpFiveLayerProgressState({ projectRoot, assetRoot });
  const orchestration = resolveMainAgentOrchestrationSurface(projectRoot, labels);
  const readiness = resolveReadinessStatus(projectRoot);
  const artifacts = collectUpstreamArtifacts(projectRoot);
  const aiTdd = resolveAiTddRuntimeDecision(projectRoot, {
    assetRoot,
    displayBudget: options.budget,
  });
  const displayBudget = resolveDisplayBudget(options.budget, 'route');
  const currentRoute = runtime.layers
    .flatMap((layer) => layer.stages.map((stage) => ({ layer, stage })))
    .find(
      (item) => item.layer.id === progress.currentLayer && item.stage.id === progress.currentStage
    );
  const contractStatus = {
    governance: existsRelative(projectRoot, runtime.contracts.governance),
    dispatch: existsRelative(projectRoot, runtime.contracts.dispatch),
    stageMapping: existsRelative(projectRoot, runtime.contracts.stageMapping),
  };
  return {
    console: 'BMADS Runtime Console',
    viewMode: aiTdd.viewMode,
    projectRoot,
    assetRoot,
    schemaVersion: runtime.schemaVersion,
    language,
    entry: runtime.entry,
    contracts: runtime.contracts,
    contractStatus,
    artifacts,
    progress,
    currentRoute: currentRoute
      ? {
          layer: currentRoute.layer.id,
          layerName: currentRoute.layer.name,
          stage: currentRoute.stage.id,
          governanceStage: currentRoute.stage.governanceStage,
          requiredGovernanceSignalsFrom: currentRoute.stage.requiredGovernanceSignalsFrom,
          recommendedWorkflows: filterRecommendedWorkflows({
            currentStage: progress.currentStage,
            workflows: currentRoute.stage.recommendedWorkflows || [],
            readiness,
          }),
          blockedWorkflows:
            progress.currentStage === 'story_create' && readiness.status !== 'ready'
              ? [
                  {
                    workflow: 'bmad-story-assistant',
                    reason:
                      'implementation-readiness must be READY / ready_clean / repair_closed before story development.',
                  },
                ]
              : [],
          dispatch: currentRoute.stage.dispatch || null,
          gates: currentRoute.stage.gates || null,
          next: currentRoute.stage.next || null,
        }
      : null,
    readiness,
    orchestration: {
      source: orchestration.source,
      nextAction: orchestration.nextAction,
      ready: orchestration.ready,
      pendingPacketStatus: orchestration.pendingPacketStatus,
      sessionId: orchestration.sessionId,
      stageSummary: orchestration.stageSummary,
    },
    quickStart:
      orchestration.source === 'no_active_requirement'
        ? {
            status: 'no_active_requirement',
            nextRequiredAction: 'contract_authoring_required',
            message: labels.quickStartMessage,
            entries: labels.quickStartEntries,
          }
        : null,
    advisory: runtime.entry.advisory,
    aiTdd,
    displayBudget,
    commandHints: [
      'bmads',
      'bmad-speckit bmads',
      'bmad-speckit bmad-help',
      'bmad-speckit confirm-scope',
      'bmad-speckit main-agent:confirm-scope',
      'bmad-speckit main-agent-orchestration --action inspect',
      'bmad-speckit main-agent-orchestration --action confirm-scope',
      'bmad-speckit main-agent-orchestration --action dispatch-plan --host codex',
      'bmad-speckit main-agent:release-gate',
      'bmad-speckit main-agent:delivery-truth-gate',
    ],
  };
}

function renderArtifactGroup(label, artifacts) {
  if (artifacts.length === 0) return [`${label}: missing`];
  return [
    `${label}:`,
    ...artifacts.map((item) => `- ${item.path} (${item.bytes} bytes, updated ${item.updatedAt})`),
  ];
}

function renderAiTddActiveRecord(record, isPrimary, budget, labels) {
  const lines = [
    `- recordId: ${record.recordId}${isPrimary ? ` (${labels.recordSuffixFirstSafeAction})` : ''}`,
    `  ${labels.fieldSourceTitle}: ${record.sourceOrTitle}`,
    `  ${labels.fieldFirstSafeActionReason}: ${record.primaryReasonToken}`,
    `  ${labels.fieldSelectedByUser}: ${record.isExplicitSelection ? labels.boolYes : labels.boolNo}`,
    `  ${labels.fieldRuntimeIndexPointer}: ${record.isIndexedActive ? labels.boolYes : labels.boolNo}`,
    `  ${labels.fieldRuntimeIndexPointerStatus}: ${record.indexPointerStatus}`,
    `  ${labels.fieldActivityState}: ${record.activityState}`,
    `  ${labels.fieldCurrentMentalModel}: ${record.currentMentalModel}`,
    `  ${labels.fieldSchemaModelStatus}: ${record.schemaModelStatus}`,
    `  ${labels.fieldDisplayState}: ${record.displayState}`,
    `  ${labels.fieldBlockerSummary}: ${record.blockerSummary}`,
    `  ${labels.fieldNextSafeAction}: ${record.nextSafeAction}`,
    `  ${labels.fieldUpdatedAtCurrent}: ${record.updatedAt}`,
  ];
  if (record.currentAttemptId) lines.push(`  ${labels.fieldCurrentAttemptHash}: ${record.currentAttemptId}`);
  else if (record.sourceDocumentHash) lines.push(`  ${labels.fieldCurrentAttemptHash}: ${record.sourceDocumentHash}`);
  if (record.delivery.awaiting) {
    lines.push(`  ${labels.fieldCloseoutPage}: ${record.delivery.pagePath}`);
    lines.push(`  ${labels.fieldCloseoutRenderReport}: ${record.delivery.renderReportPath}`);
    lines.push(
      `  ${labels.fieldDeliveryCloseoutReportHash}: ${record.delivery.deliveryCloseoutReportHash || 'missing'}`
    );
    lines.push(`  ${labels.fieldExactConfirmationInstruction}: ${record.delivery.exactInstruction}`);
    lines.push(`  ${labels.fieldUserFacingNextAction}: confirm-closeout-acceptance`);
  }
  if (
    record.delivery.stalePage ||
    record.delivery.staleAttempt ||
    record.delivery.hashMismatch ||
    record.delivery.missingAcceptanceRequest
  ) {
    lines.push(
      `  ${labels.fieldTerminalCompletion}: blocked until current closeout page, attempt, hash, and acceptance request match`
    );
  }
  if (!isPrimary && budget.name === 'compact') {
    return lines.slice(0, 4);
  }
  return lines;
}

function humanDecisionCardFor(runtime, secondaryRecords, labels) {
  const primary = runtime.primaryRecord;
  if (!primary) {
    return {
      seeing: labels.noActiveSeeing,
      waiting: labels.noActiveWaiting,
      action: labels.noActiveAction,
      avoid: labels.noActiveAvoid,
    };
  }

  const waiting = [];
  const action = [];
  const avoid = [...labels.baseAvoid];
  if (primary.delivery.awaiting || primary.displayState === 'awaiting_user_acceptance') {
    waiting.push(labels.waitingDelivery(primary));
    action.push(labels.actionDelivery);
    avoid.push(labels.avoidDelivery);
  } else if (primary.reconfirmation.required) {
    waiting.push(labels.waitingReconfirmation(primary));
    action.push(labels.actionReconfirmation(primary));
    avoid.push(labels.avoidReconfirmation);
  } else if (primary.primaryReasonToken === 'readiness_blocker') {
    waiting.push(labels.waitingReadiness(primary));
    action.push(labels.actionReadiness(primary));
    avoid.push(labels.avoidReadiness);
  } else {
    waiting.push(labels.waitingDefault(primary));
    action.push(labels.actionDefault(primary));
  }
  if (secondaryRecords.length > 0) {
    waiting.push(labels.secondaryWaiting(secondaryRecords.length));
    avoid.push(labels.secondaryAvoid);
  }

  return {
    seeing: labels.activeSeeing(runtime, primary),
    waiting,
    action,
    avoid,
  };
}

function summaryCardFor(runtime, secondaryRecords, labels) {
  const primary = runtime.primaryRecord;
  if (!primary) {
    return {
      seeing: labels.summaryNoActiveSeeing(runtime),
      waiting: labels.summaryNoActiveWaiting,
      why: labels.summaryNoActiveWhy,
      action: labels.summaryNoActiveAction,
      avoid: labels.noActiveAvoid,
    };
  }

  const avoid = [...labels.baseAvoid];
  let waiting;
  let why;
  let action;
  if (primary.delivery.awaiting || primary.displayState === 'awaiting_user_acceptance') {
    waiting = labels.summaryWaitingDelivery;
    why = labels.summaryWhyDelivery;
    action = labels.summaryAction(primary);
    avoid.push(labels.avoidDelivery);
  } else if (primary.reconfirmation.required) {
    waiting = labels.summaryWaitingReconfirmation(primary);
    why = labels.summaryWhyReconfirmation;
    action = labels.summaryAction(primary);
    avoid.push(labels.avoidReconfirmation);
  } else if (primary.primaryReasonToken === 'readiness_blocker') {
    waiting = labels.summaryWaitingReadiness;
    why = labels.summaryWhyReadiness;
    action = labels.summaryAction(primary);
    avoid.push(labels.avoidReadiness);
  } else {
    waiting = labels.summaryWaitingDefault(primary);
    why = labels.summaryWhyDefault;
    action = labels.summaryAction(primary);
  }
  if (secondaryRecords.length > 0) avoid.push(labels.secondaryAvoid);
  return {
    seeing: labels.summarySeeing(primary),
    waiting,
    why,
    action,
    avoid,
  };
}

function renderStatusSummary(runtime, secondaryRecords, labels) {
  const card = summaryCardFor(runtime, secondaryRecords, labels);
  const lines = [schemaHeading(labels.headingSchema, 'statusSummary'), ''];
  if (runtime.inventory) {
    lines.push(
      `${labels.inventoryLabel}: ${runtime.inventory.loadableRecords} ${labels.inventoryLoadableLabel}, ${runtime.inventory.currentActionableRecords} ${labels.inventoryCurrentActionableLabel}, ${runtime.inventory.closedOrHistoricalRecords} ${labels.inventoryClosedLabel}`
    );
  }
  for (const warning of runtime.indexPointerWarnings || []) {
    lines.push(`Warning: ${labels.indexPointerWarning(warning)}`);
  }
  lines.push('', schemaHeading(labels.headingSchema, 'evidenceCurrentPosition'));
  lines.push(`${labels.decisionHeadings.seeing}: ${card.seeing}`);
  lines.push(`${labels.decisionHeadings.why}: ${card.why}`);
  lines.push('', schemaHeading(labels.headingSchema, 'gateBlockingState'));
  lines.push(`${labels.decisionHeadings.waiting}: ${card.waiting}`);
  lines.push(`${labels.decisionHeadings.action}: ${card.action}`);
  lines.push(`${labels.decisionHeadings.avoid}:`);
  for (const item of card.avoid) lines.push(`- ${item}`);
  return lines;
}

function recommendedPrimaryAction(primary, labels) {
  if (!primary) return labels.summaryNoActiveAction;
  if (primary.delivery.awaiting || primary.displayState === 'awaiting_user_acceptance') {
    return labels.recommendedActionDelivery;
  }
  if (primary.reconfirmation.required) return labels.recommendedActionReconfirmation;
  if (
    primary.primaryReasonToken === 'readiness_blocker' ||
    primary.nextSafeAction === 'run_implementation_readiness_gate'
  ) {
    return labels.recommendedActionReadiness;
  }
  return labels.recommendedActionDefault(primary);
}

function renderRecommendedNextSteps(runtime, labels) {
  const primary = runtime.primaryRecord;
  return [
    schemaHeading(labels.headingSchema, 'recommendedNextSteps'),
    '',
    `1. ${recommendedPrimaryAction(primary, labels)}`,
    `2. ${labels.recommendedGoal(runtime.goalRoute.skill)}`,
    `3. ${labels.recommendedBmadHelp}`,
  ];
}

function actionDisplay({
  kind,
  executable,
  label,
  ownerSkill = null,
  actionToken = null,
  suggestedPrompt = null,
  renderAsCode = false,
}) {
  return {
    kind,
    executable: Boolean(executable),
    label: String(label || ''),
    ownerSkill,
    actionToken,
    suggestedPrompt,
    renderAsCode: Boolean(renderAsCode),
  };
}

function renderActionToken(action) {
  if (!action?.actionToken) return '';
  return action.renderAsCode ? `\`${action.actionToken}\`` : action.actionToken;
}

function coreSkillActions(language) {
  const zh = resolveLanguage(language) === 'zh-CN';
  if (zh) {
    return [
      actionDisplay({
        kind: 'skill',
        executable: true,
        label: '技能：',
        ownerSkill: 'requirements-contract-authoring',
        actionToken: 'requirements-contract-authoring',
        renderAsCode: true,
      }),
      actionDisplay({
        kind: 'skill',
        executable: true,
        label: '技能：',
        ownerSkill: 'req-trace-matrix-prompt-generator',
        actionToken: 'req-trace-matrix-prompt-generator',
        renderAsCode: true,
      }),
      actionDisplay({
        kind: 'skill',
        executable: true,
        label: '技能：',
        ownerSkill: 'goal-execution-contract-generator',
        actionToken: 'goal-execution-contract-generator',
        renderAsCode: true,
      }),
      actionDisplay({
        kind: 'skill',
        executable: true,
        label: '技能：',
        ownerSkill: 'grill-with-docs',
        actionToken: 'grill-with-docs',
        renderAsCode: true,
      }),
      actionDisplay({
        kind: 'skill',
        executable: true,
        label: '技能：',
        ownerSkill: 'docs-review',
        actionToken: 'docs-review',
        renderAsCode: true,
      }),
    ];
  }
  return [
    actionDisplay({
      kind: 'skill',
      executable: true,
      label: 'Skill:',
      ownerSkill: 'requirements-contract-authoring',
      actionToken: 'requirements-contract-authoring',
      renderAsCode: true,
    }),
    actionDisplay({
      kind: 'skill',
      executable: true,
      label: 'Skill:',
      ownerSkill: 'req-trace-matrix-prompt-generator',
      actionToken: 'req-trace-matrix-prompt-generator',
      renderAsCode: true,
    }),
    actionDisplay({
      kind: 'skill',
      executable: true,
      label: 'Skill:',
      ownerSkill: 'goal-execution-contract-generator',
      actionToken: 'goal-execution-contract-generator',
      renderAsCode: true,
    }),
    actionDisplay({
      kind: 'skill',
      executable: true,
      label: 'Skill:',
      ownerSkill: 'grill-with-docs',
      actionToken: 'grill-with-docs',
      renderAsCode: true,
    }),
    actionDisplay({
      kind: 'skill',
      executable: true,
      label: 'Skill:',
      ownerSkill: 'docs-review',
      actionToken: 'docs-review',
      renderAsCode: true,
    }),
  ];
}

function recommendedNowAction(primary, language) {
  const zh = resolveLanguage(language) === 'zh-CN';
  if (!primary) {
    return actionDisplay({
      kind: 'skill',
      executable: true,
      label: 'requirements contract authoring',
      ownerSkill: 'requirements-contract-authoring',
      actionToken: 'requirements-contract-authoring',
      renderAsCode: true,
    });
  }
  const route = primary.currentMentalModel;
  const next = primary.nextSafeAction;
  if (primary.delivery.awaiting || next === 'confirm-closeout-acceptance') {
    return actionDisplay({
      kind: 'cli_command',
      executable: true,
      label: 'controlled delivery acceptance',
      actionToken: 'confirm-closeout-acceptance',
      renderAsCode: true,
    });
  }
  if (/requirements-contract-authoring/iu.test(next) || route === 'requirement_confirmation') {
    return actionDisplay({
      kind: 'skill',
      executable: true,
      label: 'requirements contract authoring',
      ownerSkill: 'requirements-contract-authoring',
      actionToken: 'requirements-contract-authoring',
      renderAsCode: true,
    });
  }
  if (/goal-execution-contract-generator/iu.test(next)) {
    return actionDisplay({
      kind: 'skill',
      executable: true,
      label: 'goal execution contract generation',
      ownerSkill: 'goal-execution-contract-generator',
      actionToken: 'goal-execution-contract-generator',
      renderAsCode: true,
    });
  }
  if (/req-trace-matrix-prompt-generator/iu.test(next) || route === 'execution_closure') {
    return actionDisplay({
      kind: 'skill',
      executable: true,
      label: 'requirement trace compilation',
      ownerSkill: 'req-trace-matrix-prompt-generator',
      actionToken: 'req-trace-matrix-prompt-generator',
      renderAsCode: true,
    });
  }
  if (/review|grill|audit/iu.test(next) || route === 'audit_review') {
    return actionDisplay({
      kind: 'skill',
      executable: true,
      label: 'document review and grilling',
      ownerSkill: 'grill-with-docs',
      actionToken: 'grill-with-docs',
      renderAsCode: true,
    });
  }
  if (route === 'architecture_confirmation' && next === 'prepare_architecture_confirmation') {
    return actionDisplay({
      kind: 'suggested_prompt',
      executable: true,
      label: 'architecture confirmation suggested prompt',
      actionToken: next,
      suggestedPrompt: zh
        ? '请根据当前 RequirementRecord 的 architecture_confirmation 状态，生成架构确认问题清单、影响系统、风险确认项、证据要求和阻塞项。不要进入实现，直到架构确认完成。'
        : 'Please analyze the current RequirementRecord architecture_confirmation state and produce the architecture confirmation questions, affected systems, risk confirmations, evidence requirements, and blocking issues. Do not proceed to implementation until architecture confirmation is complete.',
      renderAsCode: false,
    });
  }
  return actionDisplay({
    kind: 'suggested_prompt',
    executable: true,
    label: 'runtime route suggested prompt',
    actionToken: next || route || 'inspect_requirement_record',
    suggestedPrompt:
      'Please inspect the current RequirementRecord route, identify the blocking evidence, and produce the safest next user-facing action. Do not proceed to implementation until the current route is complete.',
    renderAsCode: false,
  });
}

function renderCoreSkills(language) {
  const zh = resolveLanguage(language) === 'zh-CN';
  const actions = coreSkillActions(language);
  if (zh) {
    return [
      `- ${actions[0].label} ${renderActionToken(actions[0])}`,
      '  适用：创建或更新需求契约源文档。',
      '  常用动作：author-confirmation-ready-source',
      '',
      `- ${actions[1].label} ${renderActionToken(actions[1])}`,
      '  适用：把需求 trace 编译成 prompt / model packet / execution input。',
      '  常见产出：prompt packet、trace matrix、model packet。',
      '',
      `- ${actions[2].label} ${renderActionToken(actions[2])}`,
      '  适用：生成严格 goal 执行合同文档。',
      '  常见产出：`docs/plans/...goal-execution-plan.md`',
      '',
      `- ${actions[3].label} ${renderActionToken(actions[3])}`,
      '  适用：对需求、计划或规格文档做深度质询。',
      '',
      `- ${actions[4].label} ${renderActionToken(actions[4])}`,
      '  适用：审计文档清晰度、完整性、矛盾和验收就绪度。',
    ];
  }
  return [
    `- ${actions[0].label} ${renderActionToken(actions[0])}`,
    '  Use when: creating or updating a requirement contract source document.',
    '  Typical action: author-confirmation-ready-source',
    '',
    `- ${actions[1].label} ${renderActionToken(actions[1])}`,
    '  Use when: compiling requirement trace into prompt / model packet / execution input.',
    '  Typical output: prompt packet, trace matrix, model packet.',
    '',
    `- ${actions[2].label} ${renderActionToken(actions[2])}`,
    '  Use when: generating a strict goal execution contract document.',
    '  Typical output: `docs/plans/...goal-execution-plan.md`',
    '',
    `- ${actions[3].label} ${renderActionToken(actions[3])}`,
    '  Use when: running deep document grilling against a requirement, plan, or spec.',
    '',
    `- ${actions[4].label} ${renderActionToken(actions[4])}`,
    '  Use when: auditing document clarity, completeness, contradictions, and acceptance readiness.',
  ];
}

function navigationActions() {
  return [
    actionDisplay({
      kind: 'cli_command',
      executable: true,
      label: 'Runtime console',
      actionToken: 'bmad-speckit bmads',
      renderAsCode: true,
    }),
    actionDisplay({
      kind: 'cli_command',
      executable: true,
      label: 'BMAD workflow help',
      actionToken: 'bmad-speckit bmad-help',
      renderAsCode: true,
    }),
  ];
}

function renderNavigation(language) {
  const zh = resolveLanguage(language) === 'zh-CN';
  return navigationActions().map((action) =>
    zh ? `- ${action.label}：${renderActionToken(action)}` : `- ${action.label}: ${renderActionToken(action)}`
  );
}

function renderRecommendedNow(runtime, labels, language) {
  const primary = runtime.primaryRecord;
  const zh = resolveLanguage(language) === 'zh-CN';
  const action = recommendedNowAction(primary, language);
  const route = primary?.currentMentalModel || 'none';
  const next = primary?.nextSafeAction || 'requirements-contract-authoring author-confirmation-ready-source';
  const lines = [schemaHeading(labels.headingSchema, 'recommendedNow')];
  if (zh) {
    lines.push('', `当前 route：${route}`, `下一安全动作：${next}`);
    if (action.kind === 'suggested_prompt') {
      lines.push('这个 route 没有专属公开技能，请复制下面提示词执行。', '', '推荐提示词：');
      lines.push(
        action.suggestedPrompt ||
          '请检查当前 RequirementRecord route，识别阻塞证据，并生成最安全的用户侧下一步。不要进入实现，直到当前 route 完成。'
      );
    } else if (action.kind === 'cli_command') {
      lines.push(`受控动作：${renderActionToken(action)}`, '这个动作不是技能，只能在对应受控确认条件满足时执行。');
    } else {
      lines.push(`可用技能：${renderActionToken(action)}`);
      if (action.ownerSkill === 'requirements-contract-authoring') {
        lines.push('常用动作/lane：author-confirmation-ready-source');
      }
    }
    return lines;
  }
  lines.push('', `Current route: ${route}`, `Next safe action: ${next}`);
  if (action.kind === 'suggested_prompt') {
    lines.push('This route has no dedicated public skill. Use the suggested prompt below.', '', 'Suggested prompt:');
    lines.push(
      action.suggestedPrompt ||
        'Please inspect the current RequirementRecord route, identify the blocking evidence, and produce the safest next user-facing action. Do not proceed to implementation until the current route is complete.'
    );
  } else if (action.kind === 'cli_command') {
    lines.push(`Controlled action: ${renderActionToken(action)}`, 'This action is not a skill and is available only under the controlled confirmation condition.');
  } else {
    lines.push(`Available skill: ${renderActionToken(action)}`);
    if (action.ownerSkill === 'requirements-contract-authoring') {
      lines.push('Typical action/lane: author-confirmation-ready-source');
    }
  }
  return lines;
}

function renderAvailableNextActions(runtime, labels, language) {
  return [
    schemaHeading(labels.headingSchema, 'availableNextActions'),
    '',
    ...renderRecommendedNow(runtime, labels, language),
    '',
    schemaHeading(labels.headingSchema, 'coreSkills'),
    '',
    ...renderCoreSkills(language),
    '',
    schemaHeading(labels.headingSchema, 'navigation'),
    '',
    ...renderNavigation(language),
  ];
}

function modelStatusForRow(row, primary) {
  if (!primary) return 'pending';
  const evidence = primary.modelStatuses?.[row.modelId];
  if (evidence?.isCurrent) return `current (${evidence.status}; ${evidence.source})`;
  if (evidence?.status) return evidence.status;
  const status = primary.rawRecord?.sixModelResults?.[row.modelId]?.status ||
    primary.rawRecord?.sixModelResults?.[row.modelId];
  if (typeof status === 'string') return status;
  if (status && typeof status.status === 'string') return status.status;
  if (row.modelId === 'delivery_confirmation' && primary.delivery.awaiting) {
    return 'awaiting_user_acceptance';
  }
  return 'pending';
}

function modelStatusSourceForRow(row, primary) {
  if (!primary) return 'no active RequirementRecord';
  const evidence = primary.modelStatuses?.[row.modelId];
  if (evidence?.source) return evidence.source;
  if (primary.currentMentalModel === row.modelId) return 'current RequirementRecord model';
  if (row.terminalEvent) return 'manifest terminal event';
  return 'no model evidence found';
}

function routeBasisForModel(row, primary, labels) {
  if (!primary) return labels.routeBasisPending;
  if (primary.currentMentalModel === row.modelId) return labels.routeBasisCurrent;
  if (row.terminalEvent) return labels.routeBasisTerminal;
  return labels.routeBasisPending;
}

function renderRuntimeWorkflowGuidance(labels) {
  return [
    schemaHeading(labels.headingSchema, 'runtimeWorkflowGuidance'),
    '',
    schemaHeading(labels.headingSchema, 'runtimeAuthority'),
    ...labels.runtimeAuthorityGuidance.map((item) => `- ${item}`),
    '',
    schemaHeading(labels.headingSchema, 'safetyPriority'),
    ...labels.safetyPriorityGuidance.map((item) => `- ${item}`),
    '',
    schemaHeading(labels.headingSchema, 'officialExecutionPaths'),
    ...labels.officialExecutionPaths.map((item) => `- ${item}`),
    '',
    schemaHeading(labels.headingSchema, 'reconfirmationRoutes'),
    ...labels.reconfirmationRoutes.map((item) => `- ${item}`),
  ];
}

function modelQuestionForRow(row, labels) {
  return labels.modelQuestions?.[row.modelId] || row.question;
}

function renderAiTddStatus(output) {
  const runtime = output.aiTdd;
  if (!runtime) return [];
  const labels = textBundle(output.language);
  const budget = output.displayBudget || resolveDisplayBudget('route');
  const primary = runtime.primaryRecord;
  const activeRecords = runtime.activeRecords;
  const secondary = activeRecords.filter((record) => record !== primary);
  const visibleSecondary = applyLimit(secondary, budget.secondaryRecords);
  const lines = [
    `View Mode: ${runtime.viewMode}`,
    '',
    ...renderStatusSummary(runtime, secondary, labels),
    '',
    ...renderRecommendedNextSteps(runtime, labels),
    '',
    ...renderAvailableNextActions(runtime, labels, output.language),
    '',
    schemaHeading(labels.headingSchema, 'currentActionableRequirementRecords'),
    '',
  ];
  if (!primary) {
    lines.push(
      '- none',
      '- next safe action: requirements-contract-authoring author-confirmation-ready-source'
    );
  } else {
    lines.push(...renderAiTddActiveRecord(primary, true, budget, labels));
    for (const record of visibleSecondary) {
      lines.push(...renderAiTddActiveRecord(record, false, budget, labels));
    }
    if (visibleSecondary.length < secondary.length) {
      lines.push(
        `- ${labels.hiddenCurrentActionableRecords(secondary.length - visibleSecondary.length, budget.name)}`
      );
    }
  }
  lines.push('', schemaHeading(labels.headingSchema, 'sixMentalModelPanorama'), '');
  const modelRows = applyLimit(runtime.manifests.sixModelManifest || [], budget.projectionRows);
  const totalModels = runtime.manifests.sixModelManifest?.length || modelRows.length;
  for (const [index, row] of modelRows.entries()) {
    lines.push(
      `- ${index + 1}/${totalModels}. ${row.displayName} (${row.modelId})`,
      `  ${labels.modelQuestionLabel}: ${modelQuestionForRow(row, labels)}`,
      `  ${labels.modelStatusLabel}: ${modelStatusForRow(row, primary)}`,
      `  ${labels.modelStatusSourceLabel}: ${modelStatusSourceForRow(row, primary)}`,
      `  ${labels.routeBasisLabel}: ${routeBasisForModel(row, primary, labels)}`,
      `  terminalEvent: ${row.terminalEvent || 'none'}`
    );
  }
  if (modelRows.length < (runtime.manifests.sixModelManifest || []).length) {
    lines.push(`- panorama rows hidden by ${budget.name} budget`);
  }
  lines.push(
    '',
    ...renderRuntimeWorkflowGuidance(labels),
    '',
    schemaHeading(labels.headingSchema, 'seeAlsoBmadHelp'),
    '',
    labels.seeAlsoViewMode,
    labels.relatedWorkflow,
    labels.seeAlsoSwitch
  );
  return lines;
}

function renderDiagnosticDetails(output) {
  const progress = output.progress;
  const route = output.currentRoute;
  const readiness = output.readiness;
  const artifacts = output.artifacts;
  const orchestration = output.orchestration;
  const quickStart = output.quickStart;
  const contractStatus = output.contractStatus;
  const advisory = output.advisory;
  const schema = BMADS_HEADINGS;
  const lines = [
    schemaHeading(schema, 'projectState'),
    '',
    `Current: ${progress.currentLayer} / ${progress.currentStage}`,
    `Next required: ${progress.nextRequiredLayer}`,
    `Completed layers: ${progress.completedLayers.length > 0 ? progress.completedLayers.join(', ') : 'none'}`,
    '',
    schemaHeading(schema, 'upstreamBmadArtifacts'),
    '',
    ...renderArtifactGroup('Product briefs', artifacts.productBriefs),
    ...renderArtifactGroup('PRDs', artifacts.prds),
    ...renderArtifactGroup('Architectures', artifacts.architectures),
    ...renderArtifactGroup('Epics', artifacts.epics),
    '',
    schemaHeading(schema, 'completedLayerArtifacts'),
    '',
    ...progress.stageStatuses
      .filter((item) => progress.completedLayers.includes(item.layer))
      .map((item) => `- ${item.layer}/${item.stage}: ${item.evidenceKind} ${item.evidencePath}`),
    ...(progress.completedLayers.length === 0 ? ['- none'] : []),
    '',
    schemaHeading(schema, 'implementationReadiness'),
    '',
    `Status: ${readiness.status}`,
    `Reason: ${readiness.reason}`,
    `Report: ${readiness.reportPath || 'none'}`,
    '',
    schemaHeading(schema, 'currentRoute'),
    '',
  ];
  if (route) {
    lines.push(`Layer name: ${route.layerName}`);
    lines.push(`Governance stage: ${route.governanceStage}`);
    lines.push(`Governance source: ${route.requiredGovernanceSignalsFrom}`);
    lines.push(
      `Recommended workflows: ${route.recommendedWorkflows.length > 0 ? route.recommendedWorkflows.join(', ') : 'none'}`
    );
    if (route.blockedWorkflows && route.blockedWorkflows.length > 0) {
      lines.push('Blocked workflows:');
      for (const item of route.blockedWorkflows) lines.push(`- ${item.workflow}: ${item.reason}`);
    }
    if (route.dispatch)
      lines.push(`Dispatch: ${route.dispatch.taskType} via ${route.dispatch.hosts.join(', ')}`);
    if (route.gates) lines.push(`Required gates: ${route.gates.required.join(', ')}`);
    if (route.next) lines.push(`Next: ${route.next.layer} / ${route.next.stage}`);
  } else {
    lines.push('No route matched current layer/stage.');
  }
  lines.push(
    '',
    schemaHeading(schema, 'mainAgent'),
    '',
    `Source: ${orchestration.source || 'unknown'}`,
    `Next action: ${orchestration.nextAction || 'none'}`,
    `Ready: ${String(orchestration.ready)}`,
    `Pending packet: ${orchestration.pendingPacketStatus}`,
    `Session: ${orchestration.sessionId || 'none'}`,
    ...(orchestration.stageSummary?.currentMentalModelStatus
      ? [`Mental model status: ${orchestration.stageSummary.currentMentalModelStatus}`]
      : []),
    ...(orchestration.stageSummary?.userFacingMessage
      ? [`Message: ${orchestration.stageSummary.userFacingMessage}`]
      : []),
    ...(orchestration.stageSummary?.blockingReasons &&
    orchestration.stageSummary.blockingReasons.length > 0
      ? [`Blocking reasons: ${orchestration.stageSummary.blockingReasons.join(', ')}`]
      : []),
    ...(quickStart
      ? [
          '',
          schemaHeading(schema, 'quickStart'),
          '',
          quickStart.message,
          '',
          `Status: ${quickStart.status}`,
          `Next required action: ${quickStart.nextRequiredAction}`,
          '',
          ...quickStart.entries.map((item) => `- ${item}`),
        ]
      : []),
    '',
    schemaHeading(schema, 'contractStatus'),
    '',
    ...Object.entries(contractStatus).map(
      ([name, exists]) => `- ${name}: ${exists ? 'present' : 'missing'}`
    ),
    '',
    schemaHeading(schema, 'stageEvidence'),
    '',
    ...progress.stageStatuses.map(
      (item) =>
        `- ${item.layer}/${item.stage}: ${item.completed ? 'complete' : 'missing'} (${item.evidenceKind}) ${item.evidencePath}`
    ),
    '',
    schemaHeading(schema, 'commandHints'),
    '',
    ...output.commandHints.map((item) => `- ${item}`),
    '',
    schemaHeading(schema, 'bmadMethodAdvisory'),
    '',
    `${advisory.message} Command: \`${advisory.bmadHelpCommand}\`.`
  );
  return lines;
}

function renderBmads(output) {
  const aiTddStatus = renderAiTddStatus(output);
  const lines = [
    schemaHeading(BMADS_HEADINGS, 'pageTitle'),
    '',
  ];
  if (aiTddStatus.length > 0) lines.push(...aiTddStatus, '');
  if (output.displayBudget?.name === 'full' || output.debug === true) {
    lines.push(...renderDiagnosticDetails(output), '');
  }
  return `${lines.join('\n')}\n`;
}

function mainBmadsRenderer(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const output = buildBmadsOutput(options);
    if (options.json) console.log(JSON.stringify(output, null, 2));
    else process.stdout.write(renderBmads(output));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

module.exports = {
  buildBmadsOutput,
  mainBmadsRenderer,
  renderBmads,
};

if (require.main === module) {
  process.exitCode = mainBmadsRenderer();
}
