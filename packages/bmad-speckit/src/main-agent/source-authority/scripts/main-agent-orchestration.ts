import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as crypto from 'node:crypto';
import * as yaml from 'js-yaml';
import type {
  AuditExecutionProfile,
  AuditTriadExecutionPlanRef,
  CompiledPromptRef,
  DispatchRoute,
  ExecutionPacket,
  PacketKind,
  RecommendationPacket,
  ResumePacket,
  TaskReport,
} from './orchestration-dispatch-contract';
import {
  createExecutionPacket,
  createResumePacket,
  packetArtifactPath,
  resolveDispatchRoute,
  type OrchestrationHost,
} from './orchestration-dispatch-contract';
import { resolveExecutionDisciplineProfile } from './execution-discipline-profiles';
import { runMainAgentCompiledPrompt } from './main-agent-compiled-prompt-runner';
import {
  appendExecutionStrategySelection,
  buildExecutionStrategyOptions,
  selectExecutionStrategy,
  toExecutionStrategySelectionEvent,
} from './execution-strategy-selection';
import {
  createSddArtifactManifest,
  defaultSddArtifactManifestPath,
  validateSddArtifactManifest,
  writeSddArtifactManifest,
} from './sdd-artifact-manifest';
import {
  claimPendingPacket,
  completePendingPacket,
  invalidatePendingPacket,
  markPendingPacketDispatched,
  orchestrationStateDirForRecordPath,
  readOrchestrationState,
  readOrchestrationStateAtPath,
  resetGatesLoopProgress,
  recordGatesLoopNoProgress,
  type OrchestrationNextAction,
  updateOrchestrationState,
  type OrchestrationState,
} from './orchestration-state';
import { type RuntimeContextFile } from './runtime-context';
import { loadPolicyContextFromRegistry } from './emit-runtime-policy';
import {
  buildImplementationEntryIndexKey,
  readRuntimeContextRegistry,
  type ReviewerLatestCloseoutRecord,
} from './runtime-context-registry';
import { runAdaptiveIntakeGovernanceGate } from './adaptive-intake-governance-gate';
import { runCodexWorkerAdapter } from './main-agent-codex-worker-adapter';
import { applyLongRunPolicyToState } from './long-run-runtime-policy';
import type {
  ImplementationEntryDecision,
  ImplementationEntryGate,
  RuntimeFlowId,
} from './runtime-governance';
import {
  readUserStoryMappingIndexOrDefault,
  selectBestMappingForRuntimeContext,
} from './user-story-mapping';
import { canMainAgentContinue } from './continue-state-contract';
import { buildReadinessDriftProjection } from '../packages/scoring/governance/readiness-drift';
import { loadAndDedupeRecords } from '../packages/scoring/query/loader';
import { readGovernanceRemediationConfig } from './governance-remediation-config';
import type { ResolvedRuntimeContext } from './resolve-active-requirement';
import { isNoActiveRequirementError } from './resolve-active-requirement';
import { runControlledReadinessAuditBridge } from './controlled-readiness-audit-bridge';
import { appendControlEventAndReplay } from './requirement-record-control-store';
import { mainImplementationReadinessGate } from './main-agent-implementation-readiness-gate';
import { evaluateAiTddContractGate } from './ai-tdd-contract-gate';
import { mainRunRequiredCommandsFromAiTddManifest } from './run-required-commands-from-ai-tdd-manifest';
import { evaluateStrictCloseoutProof } from './strict-closeout-proof-gate';
import { evaluateTargetArtifactRealization } from './target-artifact-realization-gate';
import { resolveRuntimeScoringDataPath } from './runtime-scoring-data-path';
import type { CodexWorkerAdapterReport } from './main-agent-codex-worker-adapter';
import {
  createAuditTriadExecutionPlan,
  writeAuditTriadExecutionPlan,
  sha256Json as sha256AuditTriadJson,
} from './audit-triad-orchestrator';
import {
  resolveCriticalAuditorProfile,
  stageProfileForCallPoint,
  validateCriticalAuditorProfileForStage,
} from './critical-auditor-profile';
import {
  validateNativeGoalReadiness,
  writeExecutionRuntimeModeSelection,
  writeRuntimeBlocker,
} from './host-runtime-mode';
import {
  resolveSixModelRuntimeDecision,
  writeSixModelRuntimeDecision,
  writeSplitBrainBlocker,
} from './six-model-runtime-decision';
import {
  buildOpenReconfirmationBlockingReasonRefs,
  hasOpenReconfirmationRequest,
  requestSemanticReconfirmation,
} from './reconfirmation-runtime';
import { runNativeGoalInvocation as runNativeGoalInvocationUntyped } from '../packages/bmad-speckit/src/main-agent/actions/native-goal-invoker';

const requireCommonJs = createRequire(__filename);

export type NativeGoalSpawnSyncFn = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    encoding: 'utf8';
    timeout: number;
    shell: boolean;
  }
) => {
  status?: number | null;
  stdout?: string | Buffer | null;
  stderr?: string | Buffer | null;
  error?: Error | null;
};

interface NativeGoalInvocationResult {
  command: string;
  args: string[];
  exitCode: number;
  stdoutPath: string;
  stderrPath: string;
  receiptPath: string | null;
  taskReportPath: string;
  taskReport: TaskReport;
}

type RunNativeGoalInvocationInput = {
  projectRoot: string;
  host: string;
  packet: ExecutionPacket;
  compiledPromptRef: CompiledPromptRef;
  taskReportPath: string;
  timeoutMs?: number;
  spawnSyncFn?: NativeGoalSpawnSyncFn;
  recordId?: string;
  attemptId?: string;
};

const runNativeGoalInvocation = runNativeGoalInvocationUntyped as (
  input: RunNativeGoalInvocationInput
) => NativeGoalInvocationResult;

export type MainAgentContinueDecision = 'continue' | 'rerun' | 'blocked' | null;
export type MainAgentOrchestrationSource =
  | 'orchestration_state'
  | 'requirement_record'
  | 'reviewer_closeout'
  | 'implementation_entry_gate'
  | 'no_active_requirement'
  | 'none';
export type MainAgentPendingPacketStatus =
  | 'none'
  | 'ready_for_main_agent'
  | 'claimed_by_main_agent'
  | 'dispatched'
  | 'completed'
  | 'invalidated'
  | 'missing_packet_file';

const SIX_MENTAL_MODEL_SEQUENCE = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
] as const;

type SixMentalModel = (typeof SIX_MENTAL_MODEL_SEQUENCE)[number];

export const SHORT_FEEDBACK_WINDOW_MS = 300000;

export interface MainAgentStageSummary {
  schemaVersion: 'main-agent-stage-summary/v1';
  recordId: string | null;
  requirementSetId: string | null;
  currentMentalModel: SixMentalModel | string | null;
  currentMentalModelStatus: string | null;
  currentStageOrdinal: number | null;
  totalStages: number;
  nextAction: string | null;
  nextMentalModel: SixMentalModel | string | null;
  ready: boolean | null;
  blocked: boolean;
  blockingReasons: string[];
  lastEventType: string | null;
  userFacingMessage: string;
}

export type PreConfirmationDrilldownSubstate =
  | 'idle'
  | 'intake_created'
  | 'initial_scale_assessed'
  | 'staging_draft_created'
  | 'critical_auditor_round_required'
  | 'checkpoint_persistence_required'
  | 'source_mutation_decision_required'
  | 'promotion_required'
  | 'promoted_not_confirmation_ready'
  | 'source_identified'
  | 'scale_assessed'
  | 'semantic_kernel_ready'
  | 'atomic_decomposition_in_progress'
  | 'gap_resolution_required'
  | 'atomic_decomposition_converged'
  | 'source_materialized'
  | 'packet_source_reconciled'
  | 'pre_render_ready'
  | 'confirmation_rendered'
  | 'user_confirmable'
  | 'user_confirmed'
  | 'blocked_by_semantic_gap'
  | 'blocked_by_unresolved_user_decision'
  | 'blocked_by_critical_auditor_gap'
  | 'blocked_by_under_split_task'
  | 'blocked_by_missing_projection'
  | 'blocked_by_packet_source_drift'
  | 'blocked_by_render_gate'
  | 'blocked_by_confirmation_hash_mismatch';

export interface PreConfirmationDrilldownIssue {
  code: string;
  message: string;
  refs: string[];
  severity: 'blocker' | 'warning';
  source: string;
}

export interface PreConfirmationDrilldownLaneState {
  currentMentalModel: 'requirement_confirmation';
  lane: 'pre_confirmation_drilldown';
  substate: PreConfirmationDrilldownSubstate;
  currentSubstate: PreConfirmationDrilldownSubstate;
  nextAction: string | null;
  nextMentalModel: 'architecture_confirmation' | null;
  userConfirmable: boolean;
  controlledIngestRequiredBeforeProgression: boolean;
  artifacts: Record<string, string>;
  blockingIssues: PreConfirmationDrilldownIssue[];
}

export interface MainAgentDriftSurface {
  driftSignals: string[];
  driftedDimensions: string[];
  driftSeverity: string | null;
  blockingReason: string | null;
  effectiveVerdict: string | null;
  reReadinessRequired: boolean;
  readinessBaselineRunId: string | null;
  baselineSource?: string | null;
}

export interface MainAgentDiagnostic {
  category: string;
  authoritativeSource: string;
  sourceChecked: string[];
  repairAction: string;
  automaticRepairAvailable: boolean;
  nextCommand: string | null;
  message: string;
}

export interface MainAgentOrchestrationSurface {
  source: MainAgentOrchestrationSource;
  sessionId: string | null;
  orchestrationStatePath: string | null;
  orchestrationState: OrchestrationState | null;
  pendingPacketStatus: MainAgentPendingPacketStatus;
  pendingPacket: RecommendationPacket | ExecutionPacket | ResumePacket | null;
  fourSignal: OrchestrationState['fourSignal'] | null;
  latestGate:
    | OrchestrationState['latestGate']
    | {
        gateId: string;
        decision: 'pass' | 'auto_repairable_block' | 'true_blocker' | 'reroute';
        reason: string;
      }
    | null;
  gatesLoop: OrchestrationState['gatesLoop'] | null;
  closeout: ReviewerLatestCloseoutRecord | null;
  drift: MainAgentDriftSurface | null;
  diagnostics: MainAgentDiagnostic[];
  mainAgentCanContinue: boolean | null;
  continueDecision: MainAgentContinueDecision;
  mainAgentNextAction: string | null;
  mainAgentReady: boolean | null;
  mainAgentStageSummary: MainAgentStageSummary | null;
  runtimeResumeProjection?: {
    projectionType: 'runtime_resume_projection';
    source: 'requirement_record';
    runtimeNextAction: string | null;
    ready: boolean;
    blockingReasonRefs: Array<{ sourceType: string; id: string }>;
    terminalState?: 'completed_no_dispatch';
    diagnostics?: MainAgentDiagnostic[];
    observedLegacyState?: {
      path: string | null;
      nextAction: string | null;
      pendingPacketStatus: MainAgentPendingPacketStatus;
    };
  };
  preConfirmationDrilldownLane?: PreConfirmationDrilldownLaneState | null;
  sixModelRuntimeDecision?: ReturnType<typeof resolveSixModelRuntimeDecision> | null;
  sixModelRuntimeDecisionPath?: string | null;
  splitBrainBlockerPath?: string | null;
}

export interface MainAgentDispatchInstruction {
  flow: RuntimeFlowId;
  stage: string;
  host: OrchestrationHost;
  nextAction: string;
  taskType: 'implement' | 'audit' | 'remediate' | 'document';
  route: DispatchRoute;
  sessionId: string;
  packetId: string;
  packetKind: PacketKind;
  packetPath: string;
  packet: RecommendationPacket | ExecutionPacket | ResumePacket | null;
  role: string;
  expectedDelta: string;
}

export interface MainAgentRunLoopResult {
  runId: string;
  status: 'completed' | 'blocked';
  steps: Array<{
    step: string;
    status: 'pass' | 'skip' | 'fail';
    summary: string;
  }>;
  dispatchInstruction: MainAgentDispatchInstruction | null;
  taskReport: TaskReport | null;
  finalSurface: MainAgentOrchestrationSurface;
  mainAgentStageSummary: MainAgentStageSummary | null;
}

export interface MainAgentRunLoopExecutorContext {
  projectRoot: string;
  instruction: MainAgentDispatchInstruction;
  args: Record<string, string | undefined>;
}

export type MainAgentRunLoopExecutor = (
  context: MainAgentRunLoopExecutorContext
) => TaskReport | null;

type ReadinessRemediationClassification =
  | 'derive_without_reconfirm'
  | 'requires_source_amendment'
  | 'requires_user_decision';

type ReadinessRemediationNextAction =
  | 'run_deterministic_projection_repair'
  | 'source_amendment_required'
  | 'blocked_by_unresolved_user_decision';

interface ReadinessRemediationAction {
  blocker: string;
  schemaVersion: 'readiness-blocker-classification/v1';
  classification: ReadinessRemediationClassification;
  sourceAuthorityImpact:
    | 'none'
    | 'proof_or_projection'
    | 'source_authority'
    | 'ambiguous_source_authority';
  autoRemediationAllowed: boolean;
  requiredNextAction: ReadinessRemediationNextAction;
  action: string;
  target?: string;
  reason: string;
  reasonCode: string;
}

interface ReadinessAutoRemediationResult {
  ok: boolean;
  status: 'done' | 'blocked';
  blockerActions: ReadinessRemediationAction[];
  requiredNextAction?: ReadinessRemediationNextAction;
  filesChanged: string[];
  validationsRun: string[];
  evidence: string[];
  receiptPath?: string;
  gateDecision?: string;
  blockingReasons: string[];
}

const READINESS_BASELINE_ACTIVATION_REPAIR_ACTIONS = new Set([
  'trigger_controlled_readiness_audit',
  'rerun_controlled_readiness_audit',
  'trigger_controlled_readiness_audit_for_dashboard_bridge',
]);

function deriveNextActionFromTaskType(
  taskType: 'implement' | 'audit' | 'remediate' | 'document',
  stage: string
): OrchestrationNextAction {
  switch (taskType) {
    case 'implement':
      return 'dispatch_implement';
    case 'audit':
      return stage === 'post_audit' ? 'dispatch_review' : 'await_user';
    case 'remediate':
      return 'rerun_gate';
    case 'document':
    default:
      return 'dispatch_review';
  }
}

function deriveNextActionFromFailedTaskType(
  taskType: 'implement' | 'audit' | 'remediate' | 'document',
  status: TaskReport['status']
): OrchestrationNextAction {
  if (taskType === 'implement') {
    return status === 'partial' ? 'dispatch_remediation' : 'dispatch_implement';
  }
  if (taskType === 'audit') {
    return 'dispatch_remediation';
  }
  if (taskType === 'remediate') {
    return 'rerun_gate';
  }
  return 'dispatch_implement';
}

export interface ResolveMainAgentOrchestrationInput {
  projectRoot?: string;
  runtimeContext?: Partial<RuntimeContextFile> | null;
  runtimeContextPath?: string;
  recordId?: string;
  requirementSetId?: string;
  runId?: string;
  flow: RuntimeFlowId;
  stage: string;
  implementationEntryGate?: ImplementationEntryGate | null;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^"(.*)"$/u, '$1').replace(/^'(.*)'$/u, '$1');
}

function pathSegments(value: string): string[] {
  return value
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function sharedPathScore(left: string, right: string): number {
  const leftSegments = pathSegments(path.normalize(left).toLowerCase());
  const rightSegments = pathSegments(path.normalize(right).toLowerCase());
  let score = 0;
  let leftIndex = leftSegments.length - 1;
  let rightIndex = rightSegments.length - 1;

  while (leftIndex >= 0 && rightIndex >= 0) {
    if (leftSegments[leftIndex] !== rightSegments[rightIndex]) {
      break;
    }
    score += 1;
    leftIndex -= 1;
    rightIndex -= 1;
  }

  return score;
}

function isTerminalPendingPacketStatus(status: unknown): boolean {
  return status === 'completed' || status === 'invalidated';
}

function isRecordScopedOrchestrationStatePath(
  candidate: string,
  runtimeContext: Partial<RuntimeContextFile> | null
): boolean {
  const recordPath = resolvedContext(runtimeContext)?.recordPath;
  if (!recordPath) {
    return false;
  }
  return candidate.startsWith(
    path.join(path.dirname(recordPath), 'orchestration', 'orchestration-state')
  );
}

function loadRuntimeContextForMainAgent(
  input: ResolveMainAgentOrchestrationInput
): Partial<RuntimeContextFile> | null {
  if (input.runtimeContext) {
    return input.runtimeContext;
  }
  if (!input.projectRoot) {
    return null;
  }
  try {
    return loadPolicyContextFromRegistry(input.projectRoot, {
      recordId: input.recordId,
      requirementSetId: input.requirementSetId,
      runId: input.runId,
    }).runtimeContext;
  } catch (error) {
    if (isNoActiveRequirementError(error)) {
      return null;
    }
    return null;
  }
}

function resolvedContext(
  runtimeContext: Partial<RuntimeContextFile> | null
): ResolvedRuntimeContext | null {
  const candidate = (runtimeContext as { resolvedRuntimeContext?: ResolvedRuntimeContext } | null)
    ?.resolvedRuntimeContext;
  return candidate?.kind === 'ResolvedRuntimeContext' ? candidate : null;
}

function listScopedOrchestrationStatePaths(
  projectRoot?: string,
  runtimeContext: Partial<RuntimeContextFile> | null = null
): string[] {
  if (!projectRoot) {
    return [];
  }
  const dirs = [
    orchestrationStateDirForRecordPath(projectRoot, resolvedContext(runtimeContext)?.recordPath),
    path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'orchestration-state'),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const dir of dirs) {
    const normalizedDir = path.resolve(dir);
    if (seen.has(normalizedDir) || !fs.existsSync(normalizedDir)) {
      continue;
    }
    seen.add(normalizedDir);
    out.push(
      ...fs
        .readdirSync(normalizedDir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => path.join(normalizedDir, file))
    );
  }
  return out;
}

function readRequirementRecordFromRuntimeContext(
  runtimeContext: Partial<RuntimeContextFile> | null
): Record<string, unknown> | null {
  const recordPath = resolvedContext(runtimeContext)?.recordPath;
  if (!recordPath || !fs.existsSync(recordPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function runtimeRecordPath(runtimeContext: Partial<RuntimeContextFile> | null): string | null {
  return resolvedContext(runtimeContext)?.recordPath ?? null;
}

function isSixMentalModel(value: string): value is SixMentalModel {
  return SIX_MENTAL_MODEL_SEQUENCE.includes(value as SixMentalModel);
}

function modelResultFor(
  record: Record<string, unknown> | null,
  model: string | null
): Record<string, unknown> | null {
  const sixModelResults =
    record?.sixModelResults &&
    typeof record.sixModelResults === 'object' &&
    !Array.isArray(record.sixModelResults)
      ? (record.sixModelResults as Record<string, unknown>)
      : null;
  const result = model ? sixModelResults?.[model] : null;
  return result && typeof result === 'object' && !Array.isArray(result)
    ? (result as Record<string, unknown>)
    : null;
}

function modelStatusFor(record: Record<string, unknown> | null, model: string): string {
  return normalizeText(modelResultFor(record, model)?.status);
}

function packetHasCurrentHashCompiledPromptRef(
  packet: RecommendationPacket | ExecutionPacket | ResumePacket | null,
  record: Record<string, unknown> | null
): boolean {
  if (!packet || !record) {
    return false;
  }
  const candidate = packet as unknown as Record<string, unknown>;
  if (normalizeText(candidate.taskType) !== 'implement') {
    return false;
  }
  if (normalizeText(candidate.authorityMode) !== 'compiled_implementation_confirmation') {
    return false;
  }
  const ref =
    candidate.compiledPromptRef &&
    typeof candidate.compiledPromptRef === 'object' &&
    !Array.isArray(candidate.compiledPromptRef)
      ? (candidate.compiledPromptRef as Record<string, unknown>)
      : null;
  if (!ref) {
    return false;
  }
  return (
    normalizeText(ref.sourceDocumentHash) === normalizeText(record.sourceDocumentHash) &&
    normalizeText(ref.implementationConfirmationHash) ===
      normalizeText(record.implementationConfirmationHash)
  );
}

function stringArrayFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => normalizeText(item)).filter(Boolean) : [];
}

function nextMentalModelFor(
  currentMentalModel: string | null,
  nextAction: string | null
): SixMentalModel | string | null {
  if (nextAction === 'enter_architecture_confirmation') {
    return 'architecture_confirmation';
  }
  if (nextAction === 'run_implementation_readiness_gate') {
    return 'implementation_readiness';
  }
  if (nextAction === 'dispatch_implement') {
    return 'execution_closure';
  }
  if (nextAction === 'dispatch_review') {
    return 'audit_review';
  }
  if (nextAction === 'run_closeout') {
    return 'delivery_confirmation';
  }
  if (nextAction === 'await_user_acceptance') {
    return 'delivery_confirmation';
  }
  if (!currentMentalModel || !isSixMentalModel(currentMentalModel)) {
    return null;
  }
  const index = SIX_MENTAL_MODEL_SEQUENCE.indexOf(currentMentalModel);
  return index >= 0 && index < SIX_MENTAL_MODEL_SEQUENCE.length - 1
    ? SIX_MENTAL_MODEL_SEQUENCE[index + 1]
    : null;
}

function buildMainAgentStageSummary(input: {
  record: Record<string, unknown> | null;
  nextAction: string | null;
  ready: boolean | null;
}): MainAgentStageSummary | null {
  if (!input.record) {
    return null;
  }
  const recordId = normalizeText(input.record.recordId) || null;
  const requirementSetId = normalizeText(input.record.requirementSetId) || recordId;
  const currentMentalModel = normalizeText(input.record.currentMentalModel) || null;
  const currentModelResult = modelResultFor(input.record, currentMentalModel);
  const currentMentalModelStatus = normalizeText(currentModelResult?.status) || null;
  const currentStageOrdinal =
    currentMentalModel && isSixMentalModel(currentMentalModel)
      ? SIX_MENTAL_MODEL_SEQUENCE.indexOf(currentMentalModel) + 1
      : null;
  const blockingReasons = Array.from(
    new Set([
      ...stringArrayFrom(currentModelResult?.blockingReasons),
      ...(input.ready === false && input.nextAction
        ? [`next_action_not_ready:${input.nextAction}`]
        : []),
    ])
  );
  const nextMentalModel = nextMentalModelFor(currentMentalModel, input.nextAction);
  const blocked =
    input.ready === false ||
    ['blocked', 'fail', 'stale', 'not_established'].includes(currentMentalModelStatus ?? '');
  const statusText = currentMentalModelStatus ?? 'unknown';
  const nextActionText = input.nextAction ?? 'none';
  return {
    schemaVersion: 'main-agent-stage-summary/v1',
    recordId,
    requirementSetId,
    currentMentalModel,
    currentMentalModelStatus,
    currentStageOrdinal,
    totalStages: SIX_MENTAL_MODEL_SEQUENCE.length,
    nextAction: input.nextAction,
    nextMentalModel,
    ready: input.ready,
    blocked,
    blockingReasons,
    lastEventType: normalizeText(input.record.lastEventType) || null,
    userFacingMessage: `当前六心智阶段: ${currentMentalModel ?? 'unknown'} (${statusText}); 下一步: ${nextActionText}.`,
  };
}

function buildNoActiveRequirementStageSummary(): MainAgentStageSummary {
  return {
    schemaVersion: 'main-agent-stage-summary/v1',
    recordId: null,
    requirementSetId: null,
    currentMentalModel: null,
    currentMentalModelStatus: 'no_active_requirement',
    currentStageOrdinal: null,
    totalStages: SIX_MENTAL_MODEL_SEQUENCE.length,
    nextAction: 'contract_authoring_required',
    nextMentalModel: 'requirement_confirmation',
    ready: false,
    blocked: true,
    blockingReasons: ['no_active_requirement', 'contract_authoring_required'],
    lastEventType: null,
    userFacingMessage:
      '当前项目尚未创建需求契约。BMAD 不会把初始化占位状态当作真实需求。请先创建或导入一个可确认的需求源文档。',
  };
}

function buildNoActiveRequirementSurface(): MainAgentOrchestrationSurface {
  return {
    source: 'no_active_requirement',
    sessionId: null,
    orchestrationStatePath: null,
    orchestrationState: null,
    pendingPacketStatus: 'none',
    pendingPacket: null,
    fourSignal: null,
    latestGate: null,
    gatesLoop: null,
    closeout: null,
    drift: null,
    diagnostics: [
      {
        category: 'active_requirement',
        authoritativeSource: '_bmad-output/runtime/requirement-records/index.json',
        sourceChecked: ['_bmad-output/runtime/requirement-records/index.json'],
        repairAction: 'contract_authoring_required',
        automaticRepairAvailable: false,
        nextCommand: 'bmads',
        message:
          'NO_ACTIVE_REQUIREMENT: create or import a requirement contract and complete requirement confirmation before orchestration can continue.',
      },
    ],
    mainAgentCanContinue: false,
    continueDecision: 'blocked',
    mainAgentNextAction: 'contract_authoring_required',
    mainAgentReady: false,
    mainAgentStageSummary: buildNoActiveRequirementStageSummary(),
  };
}

function normalizeAllowedWriteScope(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function mergeAllowedWriteScope(base: unknown, extras: unknown): string[] {
  return Array.from(
    new Set([...normalizeAllowedWriteScope(base), ...normalizeAllowedWriteScope(extras)])
  );
}

function resolveMappedAllowedWriteScope(
  projectRoot: string,
  runtimeContext: Partial<RuntimeContextFile> | null,
  flow: RuntimeFlowId,
  taskType: 'implement' | 'audit' | 'remediate' | 'document',
  requirementRecord: Record<string, unknown> | null = null
): string[] | null {
  const scopedTaskBinding = resolveTaskBindingAllowedWriteScope(runtimeContext, requirementRecord);
  if (scopedTaskBinding.length > 0) {
    return taskType === 'audit'
      ? mergeAllowedWriteScope(scopedTaskBinding, ['docs/**', '_bmad-output/**', 'specs/**'])
      : scopedTaskBinding;
  }
  const mapping = selectBestMappingForRuntimeContext(
    readUserStoryMappingIndexOrDefault(projectRoot),
    runtimeContext,
    flow
  );
  if (!mapping) {
    return null;
  }
  if (taskType === 'audit') {
    return mergeAllowedWriteScope(mapping.allowedWriteScope, [
      'docs/**',
      '_bmad-output/**',
      'specs/**',
    ]);
  }
  return normalizeAllowedWriteScope(mapping.allowedWriteScope);
}

function resolveTaskBindingAllowedWriteScope(
  runtimeContext: Partial<RuntimeContextFile> | null,
  requirementRecord: Record<string, unknown> | null
): string[] {
  const bindings = Array.isArray(requirementRecord?.taskBindings)
    ? (requirementRecord.taskBindings as unknown[])
    : [];
  const flow = normalizeText(runtimeContext?.flow);
  const epicId = normalizeText(runtimeContext?.epicId);
  const storyId = normalizeText(runtimeContext?.storyId);
  const runId = normalizeText(runtimeContext?.runId);
  const candidates = bindings
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    )
    .map((binding) => {
      const scope = Array.isArray(binding.allowedWriteScope)
        ? binding.allowedWriteScope.filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0
          )
        : [];
      if (scope.length === 0) return null;
      const bindingFlow = normalizeText(binding.flow);
      const bindingEpic = normalizeText(binding.epicId);
      const bindingStory = normalizeText(binding.storyId);
      const bindingRun = normalizeText(binding.runId);
      let score = 0;
      if (bindingFlow && flow && bindingFlow === flow) score += 1;
      if (bindingEpic && epicId && bindingEpic === epicId) score += 2;
      if (bindingStory && storyId && bindingStory === storyId) score += 4;
      if (bindingRun && runId && bindingRun === runId) score += 8;
      return { scope, score };
    })
    .filter((item): item is { scope: string[]; score: number } => item != null)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.scope ?? [];
}

function resolveScopedOrchestrationState(
  projectRoot: string | undefined,
  runtimeContext: Partial<RuntimeContextFile> | null
): {
  sessionId: string | null;
  statePath: string | null;
  state: OrchestrationState | null;
} {
  const candidates = listScopedOrchestrationStatePaths(projectRoot, runtimeContext);
  if (candidates.length === 0) {
    return {
      sessionId: null,
      statePath: null,
      state: null,
    };
  }

  const hints = [
    resolvedContext(runtimeContext)?.requirementSetId,
    resolvedContext(runtimeContext)?.recordId,
    runtimeContext?.runId,
    runtimeContext?.storyId,
    runtimeContext?.epicId,
    runtimeContext?.artifactRoot,
    runtimeContext?.artifactPath,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const strictRequirementScope = [
    'explicit_args',
    'explicit_args_without_index',
    'index_active',
    'index_match',
    'record_scan_match',
  ].includes(normalizeText(resolvedContext(runtimeContext)?.resolutionSource));

  const scored = candidates
    .map((candidate) => {
      const sessionId = path.basename(candidate, '.json');
      const state = readOrchestrationStateAtPath(candidate);
      if (!state) {
        return null;
      }

      let score = 0;
      let requirementMatchScore = 0;
      const addRequirementMatchScore = (value: number): void => {
        score += value;
        requirementMatchScore += value;
      };
      if (runtimeContext?.flow && state.flow === runtimeContext.flow) {
        score += 50;
      }
      if (runtimeContext?.stage && state.currentPhase === runtimeContext.stage) {
        score += 20;
      }
      for (const hint of hints) {
        const hintLower = hint.toLowerCase();
        if (sessionId.toLowerCase().includes(hintLower)) {
          addRequirementMatchScore(100);
        }
        if (state.pendingPacket?.packetPath) {
          const packetPath = state.pendingPacket.packetPath.toLowerCase();
          if (packetPath.includes(hintLower)) {
            addRequirementMatchScore(80);
          }
          addRequirementMatchScore(sharedPathScore(packetPath, hint) * 10);
        }
      }
      const recordScopedStatePath = isRecordScopedOrchestrationStatePath(candidate, runtimeContext);
      if (recordScopedStatePath) {
        addRequirementMatchScore(250);
      }
      if (
        resolvedContext(runtimeContext)?.recordPath &&
        state.pendingPacket?.packetPath?.startsWith(
          path.dirname(resolvedContext(runtimeContext)!.recordPath)
        )
      ) {
        addRequirementMatchScore(120);
      }
      if (state.pendingPacket?.status === 'ready_for_main_agent') {
        score += 25;
      }
      if (strictRequirementScope && !recordScopedStatePath && requirementMatchScore === 0) {
        return null;
      }
      if (
        strictRequirementScope &&
        isTerminalPendingPacketStatus(state.pendingPacket?.status) &&
        requirementMatchScore === 0
      ) {
        return null;
      }
      return {
        sessionId,
        statePath: candidate,
        state,
        score,
        requirementMatchScore,
        mtimeMs: fs.statSync(candidate).mtimeMs,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.mtimeMs - left.mtimeMs;
    });

  const selected = scored[0];
  return selected
    ? {
        sessionId: selected.sessionId,
        statePath: selected.statePath,
        state: selected.state,
      }
    : {
        sessionId: null,
        statePath: null,
        state: null,
      };
}

function readPendingPacketPayload(
  state: OrchestrationState | null
): RecommendationPacket | ExecutionPacket | ResumePacket | null {
  const packetPath = state?.pendingPacket?.packetPath;
  if (!packetPath || !fs.existsSync(packetPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(packetPath, 'utf8')) as
      | RecommendationPacket
      | ExecutionPacket
      | ResumePacket;
  } catch {
    return null;
  }
}

function normalizePendingPacketStatus(
  state: OrchestrationState | null,
  packetPayload: RecommendationPacket | ExecutionPacket | ResumePacket | null
): MainAgentPendingPacketStatus {
  if (!state?.pendingPacket) {
    return 'none';
  }
  if (
    !packetPayload &&
    state.pendingPacket.packetPath &&
    !fs.existsSync(state.pendingPacket.packetPath)
  ) {
    return 'missing_packet_file';
  }
  return state.pendingPacket.status;
}

function deriveSessionIdFromRuntimeContext(
  flow: RuntimeFlowId,
  runtimeContext: Partial<RuntimeContextFile> | null
): string {
  const runId = normalizeText(runtimeContext?.runId);
  if (runId) {
    return runId;
  }
  const storyId = normalizeText(runtimeContext?.storyId);
  if (storyId) {
    return `${flow}-${storyId}`;
  }
  const artifactRoot = normalizeText(runtimeContext?.artifactRoot);
  if (artifactRoot) {
    return `${flow}-${path.basename(artifactRoot).replace(/[^a-zA-Z0-9._-]+/g, '-')}`;
  }
  return `${flow}-session`;
}

function defaultPacketRole(taskType: 'implement' | 'audit' | 'remediate' | 'document'): string {
  switch (taskType) {
    case 'audit':
      return 'code-reviewer';
    case 'remediate':
      return 'remediation-worker';
    case 'document':
      return 'document-worker';
    case 'implement':
    default:
      return 'implementation-worker';
  }
}

function resolveMainAgentHost(
  projectRoot: string | undefined,
  explicitHost: OrchestrationHost | undefined,
  surface?: MainAgentOrchestrationSurface | null
): OrchestrationHost {
  if (explicitHost) {
    return explicitHost;
  }
  if (surface?.orchestrationState?.host) {
    return surface.orchestrationState.host;
  }
  const root = projectRoot ?? process.cwd();
  return readGovernanceRemediationConfig(root).primaryHost === 'claude' ? 'claude' : 'cursor';
}

function taskTypeFromNextAction(
  nextAction: string | null
): 'implement' | 'audit' | 'remediate' | 'document' | null {
  switch (nextAction) {
    case 'dispatch_review':
    case 'rerun_gate':
      return 'audit';
    case 'dispatch_remediation':
      return 'remediate';
    case 'dispatch_implement':
      return 'implement';
    case 'run_execution_closure_gate':
    case 'run_implementation_readiness_gate':
    case 'enter_architecture_confirmation':
    case 'prepare_architecture_confirmation':
    case 'run_closeout':
    case 'record_closed':
    case 'run_pre_confirmation_drilldown':
    case 'await_user_acceptance':
    case 'recompute_current_model_gate':
    case 'await_user':
      return null;
    default:
      return null;
  }
}

function packetTaskType(
  packet: RecommendationPacket | ExecutionPacket | ResumePacket | null
): 'implement' | 'audit' | 'remediate' | 'document' | null {
  if (!packet) {
    return null;
  }
  const taskType = normalizeText((packet as { taskType?: unknown }).taskType);
  if (
    taskType === 'implement' ||
    taskType === 'audit' ||
    taskType === 'remediate' ||
    taskType === 'document'
  ) {
    return taskType;
  }
  return null;
}

function pendingPacketDispatchable(
  packet: RecommendationPacket | ExecutionPacket | ResumePacket | null
): boolean {
  if (!packet || !('authorityMode' in packet)) {
    return true;
  }
  if (packet.authorityMode !== 'compiled_implementation_confirmation') {
    return true;
  }
  if (Array.isArray(packet.compilerBlock) && packet.compilerBlock.length > 0) {
    return false;
  }
  return Boolean(packet.compiledPromptRef);
}

function pendingPacketMatchesNextAction(surface: MainAgentOrchestrationSurface): boolean {
  const expectedTaskType = taskTypeFromNextAction(surface.mainAgentNextAction);
  if (!expectedTaskType) {
    return false;
  }
  if (!pendingPacketDispatchable(surface.pendingPacket)) {
    return false;
  }
  const actualTaskType = packetTaskType(surface.pendingPacket);
  if (actualTaskType) {
    return actualTaskType === expectedTaskType;
  }
  const packetKind = surface.orchestrationState?.pendingPacket?.packetKind;
  return packetKind === 'resume' || packetKind === 'recommendation';
}

function pendingPacketMatchesAction(input: {
  nextAction: string | null | undefined;
  pendingPacket: RecommendationPacket | ExecutionPacket | ResumePacket | null;
  state: OrchestrationState | null;
}): boolean {
  const expectedTaskType = taskTypeFromNextAction(input.nextAction ?? null);
  if (!expectedTaskType) {
    return false;
  }
  if (!pendingPacketDispatchable(input.pendingPacket)) {
    return false;
  }
  const actualTaskType = packetTaskType(input.pendingPacket);
  if (actualTaskType) {
    return actualTaskType === expectedTaskType;
  }
  const packetKind = input.state?.pendingPacket?.packetKind;
  return packetKind === 'resume' || packetKind === 'recommendation';
}

function bridgeCompletedRemediationState(input: {
  pendingPacketStatus: MainAgentPendingPacketStatus;
  pendingPacket: RecommendationPacket | ExecutionPacket | ResumePacket | null;
  state: OrchestrationState | null;
}): boolean {
  if (input.pendingPacketStatus !== 'completed' || input.state?.lastTaskReport?.status !== 'done') {
    return false;
  }
  if (packetTaskType(input.pendingPacket) === 'remediate') {
    return true;
  }
  const packetId = normalizeText(input.state?.pendingPacket?.packetId);
  if (packetId.startsWith('remediate-')) {
    return true;
  }
  return input.state?.nextAction === 'rerun_gate';
}

function isCodexSmokeOnlyTaskReport(report: TaskReport): boolean {
  return (
    report.validationsRun.some(
      (validation) => normalizeText(validation) === 'codex-worker-adapter-smoke'
    ) || report.evidence.some((evidence) => normalizeText(evidence).startsWith('codex-smoke:'))
  );
}

function blockSmokeOnlyImplementationReport(
  report: TaskReport,
  instruction: MainAgentDispatchInstruction
): TaskReport {
  if (instruction.taskType !== 'implement' || !isCodexSmokeOnlyTaskReport(report)) {
    return report;
  }
  return {
    ...report,
    status: 'blocked',
    downstreamContext: [
      ...report.downstreamContext,
      'Codex smoke validates the worker adapter only; implementation dispatch remains open for real execution.',
    ],
    driftFlags: [...new Set([...(report.driftFlags ?? []), 'codex-smoke-non-delivery-evidence'])],
  };
}

function writePacketFile(
  projectRoot: string,
  sessionId: string,
  packetId: string,
  packet: RecommendationPacket | ExecutionPacket | ResumePacket
): string {
  const file = packetArtifactPath(projectRoot, sessionId, packetId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(packet, null, 2) + '\n', 'utf8');
  return file;
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-') || 'unknown';
}

function relativePathFromRoot(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/gu, '/');
}

function recordIdentityFromPath(
  recordPath: string | undefined,
  fallbackSessionId: string
): {
  recordId: string;
  requirementSetId: string;
} {
  if (recordPath && fs.existsSync(recordPath)) {
    try {
      const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
      const recordId = normalizeText(record.recordId);
      const requirementSetId = normalizeText(record.requirementSetId) || recordId;
      if (recordId && requirementSetId) return { recordId, requirementSetId };
    } catch {
      // Fall back to the runtime session id below.
    }
  }
  return { recordId: fallbackSessionId, requirementSetId: fallbackSessionId };
}

function ensurePolicyDefaultExecutionStrategy(input: {
  recordPath?: string;
  compiledRun: NonNullable<ReturnType<typeof runMainAgentCompiledPrompt>>;
  packetId: string;
  sessionId: string;
}): ExecutionPacket['executionStrategy'] {
  const optionsResult = buildExecutionStrategyOptions({
    compiledPromptRef: input.compiledRun.compiledPromptRef,
    modelPacketGateDecision: input.compiledRun.status === 'pass' ? 'pass' : 'blocked',
  });
  if (optionsResult.status !== 'pass') return null;
  const selection = selectExecutionStrategy({
    optionsResult,
    strategyId: 'compiled_trace_direct',
    selectedBy: 'policy',
    policyDefaultAllowed: true,
  });
  if (!input.recordPath) return selection;
  const identity = recordIdentityFromPath(input.recordPath, input.sessionId);
  appendExecutionStrategySelection({
    recordPath: input.recordPath,
    event: toExecutionStrategySelectionEvent({
      ...identity,
      selection,
      sourceRefs: [
        { sourceType: 'model_packet', id: input.compiledRun.compiledPromptRef!.modelPacketHash },
        { sourceType: 'execution_strategy_option', id: selection.selectedOptionHash },
      ],
      recordedAt: new Date().toISOString(),
      recordedBy: 'main-agent-orchestration',
    }),
  });
  return selection;
}

function writeEmptySddArtifactManifestRef(input: {
  projectRoot: string;
  recordPath?: string;
  compiledOutDir?: string | null;
  packetId: string;
  sessionId: string;
  flow: 'story' | 'bugfix' | 'standalone_tasks';
}): ExecutionPacket['sddArtifactManifestRef'] {
  if (!input.compiledOutDir) return null;
  const identity = recordIdentityFromPath(input.recordPath, input.sessionId);
  const manifest = createSddArtifactManifest({
    recordId: identity.recordId,
    flow: input.flow,
    packetId: input.packetId,
    runtimeTraceExecutionDir: relativePathFromRoot(input.projectRoot, input.compiledOutDir),
  });
  const manifestPath = defaultSddArtifactManifestPath({
    runtimeTraceExecutionDir: input.compiledOutDir,
  });
  writeSddArtifactManifest(manifestPath, manifest);
  const validation = validateSddArtifactManifest({
    manifest,
    projectRoot: input.projectRoot,
  });
  return {
    path: manifestPath,
    contentHash: sha256Text(fs.readFileSync(manifestPath, 'utf8')),
    status: validation.ok ? 'pass' : 'blocked',
    blockingReasons: validation.blockingReasons,
  };
}

function readJsonObject(filePath: string): Record<string, unknown> | null {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function latestCurrentCompiledPromptRef(input: {
  projectRoot: string;
  sessionId: string;
  record: Record<string, unknown> | null;
}): ExecutionPacket['compiledPromptRef'] {
  if (!input.record) return null;
  const packetDir = path.join(
    input.projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    safeSegment(input.sessionId),
    'prompts',
    'prompt-packets'
  );
  if (!fs.existsSync(packetDir)) return null;
  const sourceHash = normalizeText(input.record.sourceDocumentHash);
  const confirmationHash = normalizeText(input.record.implementationConfirmationHash);
  const candidates = fs
    .readdirSync(packetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => {
      const filePath = path.join(packetDir, entry.name);
      return { filePath, packet: readJsonObject(filePath), stat: fs.statSync(filePath) };
    })
    .filter(({ packet }) => {
      const ref = packet?.compiledPromptRef as Record<string, unknown> | undefined;
      return (
        normalizeText(packet?.taskType) === 'implement' &&
        normalizeText(packet?.authorityMode) === 'compiled_implementation_confirmation' &&
        normalizeText(ref?.sourceDocumentHash) === sourceHash &&
        normalizeText(ref?.implementationConfirmationHash) === confirmationHash &&
        normalizeText(ref?.modelPacketHash) !== ''
      );
    })
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return (candidates[0]?.packet?.compiledPromptRef as ExecutionPacket['compiledPromptRef']) ?? null;
}

function auditArtifactsDir(projectRoot: string, recordId: string, attemptId: string): string {
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    safeSegment(recordId),
    'audit-review',
    safeSegment(attemptId)
  );
}

function writeAuditExecutionProfile(input: {
  projectRoot: string;
  recordId: string;
  requirementSetId: string;
  attemptId: string;
  stage: string;
  compiledPromptRef: NonNullable<ExecutionPacket['compiledPromptRef']>;
}): { profile: AuditExecutionProfile; path: string; triadRef: AuditTriadExecutionPlanRef } {
  const criticalProfile = resolveCriticalAuditorProfile(input.projectRoot);
  const stageProfileId = stageProfileForCallPoint('audit_review');
  const validation = validateCriticalAuditorProfileForStage({
    profile: criticalProfile,
    stageProfileId,
  });
  if (!validation.ok || !validation.stageProfile) {
    throw new Error(`audit_execution_profile_invalid:${validation.blockingReasons.join(',')}`);
  }
  const requiredCheckItemSetHash = sha256AuditTriadJson(
    validation.stageProfile.requiredCheckItemIds
  );
  const evidenceHash = sha256Text(
    [
      input.compiledPromptRef.modelPacketHash,
      input.compiledPromptRef.auditReceiptHash,
      input.compiledPromptRef.goalExecutionHash ?? 'no-goal',
    ].join('|')
  );
  const triadPlan = createAuditTriadExecutionPlan({
    projectRoot: input.projectRoot,
    recordId: input.recordId,
    stage: input.stage,
    callPoint: 'audit_review',
    attemptId: input.attemptId,
    sourceDocumentHash: input.compiledPromptRef.sourceDocumentHash,
    implementationConfirmationHash: input.compiledPromptRef.implementationConfirmationHash,
    modelPacketHash: input.compiledPromptRef.modelPacketHash,
    auditReceiptHash: input.compiledPromptRef.auditReceiptHash,
    goalExecutionHash: input.compiledPromptRef.goalExecutionHash ?? null,
    currentAttemptHash: sha256Text(input.attemptId),
    currentEvidenceHash: evidenceHash,
  });
  const triadPath = writeAuditTriadExecutionPlan(input.projectRoot, triadPlan);
  const triadRef: AuditTriadExecutionPlanRef = {
    path: triadPath,
    contentHash: sha256Text(fs.readFileSync(triadPath, 'utf8')),
    attemptId: triadPlan.attemptId,
    stageProfileId: triadPlan.stageProfileId,
    criticalAuditorProfileHash: triadPlan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: triadPlan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: triadPlan.requiredCheckItemSetHash,
    auditReceiptHash: triadPlan.auditReceiptHash ?? null,
    goalExecutionHash: triadPlan.goalExecutionHash ?? null,
    currentAttemptHash: triadPlan.currentAttemptHash,
    currentEvidenceHash: triadPlan.currentEvidenceHash,
  };
  const dir = auditArtifactsDir(input.projectRoot, input.recordId, input.attemptId);
  const reportPath = path.join(dir, 'AUDIT_current_attempt.md');
  const profile: AuditExecutionProfile = {
    schemaVersion: 'audit-execution-profile/v1',
    profileId: 'main-agent-audit-review-execution',
    profileHash: criticalProfile.profileHash,
    stageProfileId,
    stageProfileHash: validation.stageProfile.stageProfileHash,
    requiredCheckItemSetHash,
    perspectives: criticalProfile.perspectives,
    auditScoringConvergencePolicy: {
      auditPassRequired: true,
      criticalAuditorNoNewGapRequired: true,
      scoreReceiptRequired: true,
      dimensionContractMatchRequired: true,
      thresholdPassRequired: true,
      vetoForbidden: true,
      iterationCountRequired: true,
      freshHashesRequired: true,
    },
    runAuditorHostArgs: {
      projectRoot: input.projectRoot,
      stage: input.stage,
      artifactPath: input.compiledPromptRef.modelPacketPath,
      reportPath,
    },
    currentAttemptBinding: {
      recordId: input.recordId,
      requirementSetId: input.requirementSetId,
      attemptId: input.attemptId,
      sourceDocumentHash: input.compiledPromptRef.sourceDocumentHash,
      implementationConfirmationHash: input.compiledPromptRef.implementationConfirmationHash,
      modelPacketHash: input.compiledPromptRef.modelPacketHash,
      currentAttemptHash: triadPlan.currentAttemptHash,
      currentEvidenceHash: evidenceHash,
    },
    selfReviewDenied: true,
  };
  const filePath = path.join(dir, 'audit-execution-profile-packet.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  return { profile, path: filePath, triadRef };
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function sha256Json(value: unknown): string {
  return sha256Text(stableStringify(value));
}

function writeJsonUtf8(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readJsonIfExists(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function mapImplementationEntryDecision(
  gate: ImplementationEntryGate | null | undefined
): 'pass' | 'auto_repairable_block' | 'true_blocker' | 'reroute' | null {
  if (!gate) {
    return null;
  }
  if (gate.decision === 'pass') {
    return 'pass';
  }
  if (gate.decision === 'reroute') {
    return 'reroute';
  }
  return 'auto_repairable_block';
}

interface ImplementationConfirmationExtraction {
  start: number;
  end: number;
  blockText: string;
  confirmation: Record<string, unknown>;
  lines: string[];
}

interface PreConfirmationPaths {
  recordRoot: string;
  authoringDir: string;
  archiveDir: string;
  confirmationDir: string;
  recordPath: string;
  indexPath: string;
  semanticKernel: string;
  mustDecompositionPacket: string;
  controlledMustCandidates: string;
  requirementCoverageLedger: string;
  targetAuthorityReport: string;
  validationAuthorityReport: string;
  projectionDomainSanityReport: string;
  sourceMutationDecision: string;
  authoringTransaction: string;
  draftSourcePreview: string;
  promotionReceipt: string;
  draftImplementationConfirmation: string;
  authoringMaterializationReceipt: string;
  scaleAssessmentInitial: string;
  scaleAssessmentPostPacket: string;
  scaleAssessmentPostMaterialization: string;
  scaleRoutingDecision: string;
  checkpointPersistenceEvidence: string;
  checkpointReceiptPaths: string[];
  encodingReport: string;
  sourceMaterializationReceipt: string;
  receiptPaths: string[];
  reconciliationReport: string;
  progress: string;
  mustDecompositionReceipt: string;
  preRenderMustGate: string;
  preRenderGlobalConsistency: string;
  confirmationHtml: string;
  confirmationSummary: string;
  confirmationRenderReport: string;
}

export const CRITICAL_AUDITOR_PROVIDER_MODES = [
  'main_session_inline',
  'response_file',
  'codex_subagent_readonly',
  'claude_subagent_readonly',
  'external_adapter',
] as const;

export type CriticalAuditorProviderMode = (typeof CRITICAL_AUDITOR_PROVIDER_MODES)[number];

interface CriticalAuditorStagingTransaction {
  transactionId: string;
  namespaceVersion: string;
  sourceStartHash: string;
  stagingDir: string;
  draftSource: string;
  semanticKernel: string;
  mustDecompositionPacket: string;
  sourcePromotionDecision: string;
}

interface CriticalAuditorGateDryRunSummary {
  reportPath: string;
  receiptPath: string;
  reconciliationReportPath: string;
  hash: string;
  verdict: string;
  failedChecks: string[];
  blockingIssues: PreConfirmationDrilldownIssue[];
  actionableBlockingIssues: PreConfirmationDrilldownIssue[];
  actionableBlockingIssueCount: number;
  reconciliation: {
    verdict: string;
    issueCount: number;
    checkedGroups: string[];
  };
}

type CriticalAuditorVerdict =
  | 'no_new_valid_gap'
  | 'no_new_confirmation_blocking_gap'
  | 'new_valid_gap'
  | 'insufficient_audit'
  | 'blocked';

function normalizeCriticalAuditorVerdict(value: unknown): CriticalAuditorVerdict {
  const verdict = normalizeText(value);
  return [
    'no_new_valid_gap',
    'no_new_confirmation_blocking_gap',
    'new_valid_gap',
    'insufficient_audit',
    'blocked',
  ].includes(verdict)
    ? (verdict as CriticalAuditorVerdict)
    : 'blocked';
}

const CRITICAL_AUDITOR_REPAIR_ACTION_TYPES = [
  'add_must',
  'split_must',
  'add_neg',
  'add_out',
  'add_evidence',
  'add_trace',
  'add_acc',
  'add_e2e',
  'add_business_view',
  'replace_target_path',
  'replace_validation_command',
] as const;

type CriticalAuditorRepairActionType =
  (typeof CRITICAL_AUDITOR_REPAIR_ACTION_TYPES)[number];

interface CriticalAuditorRepairAction {
  actionId: string;
  type: CriticalAuditorRepairActionType;
  sourceSpan: Record<string, unknown>;
  sourceText: string;
  targetField: string;
  newValue: unknown;
  reason: string;
  mustRefs: string[];
  requirementIds: string[];
}

const CRITICAL_AUDITOR_REPAIR_ACTION_TARGET_FIELDS: Record<
  CriticalAuditorRepairActionType,
  string[]
> = {
  add_must: ['must', 'implementationConfirmation.must'],
  split_must: ['must', 'implementationConfirmation.must'],
  add_neg: [
    'notDone',
    'negativeRequirements',
    'implementationConfirmation.notDone',
    'implementationConfirmation.negativeRequirements',
  ],
  add_out: [
    'mustNot',
    'outOfScope',
    'implementationConfirmation.mustNot',
    'implementationConfirmation.outOfScope',
  ],
  add_evidence: ['evidence', 'implementationConfirmation.evidence'],
  add_trace: ['traceRows', 'implementationConfirmation.traceRows'],
  add_acc: [
    'acceptanceTests',
    'acceptanceCriteria',
    'implementationConfirmation.acceptanceTests',
    'implementationConfirmation.acceptanceCriteria',
  ],
  add_e2e: ['e2eSuites', 'e2eScenarios', 'implementationConfirmation.e2eSuites', 'implementationConfirmation.e2eScenarios'],
  add_business_view: ['businessViews', 'implementationConfirmation.businessViews'],
  replace_target_path: [
    'targetModificationPaths',
    'implementationConfirmation.targetModificationPaths',
  ],
  replace_validation_command: ['requiredCommands', 'implementationConfirmation.requiredCommands'],
};

function criticalAuditorRepairActionTargetFields(
  actionType: CriticalAuditorRepairActionType
): string[] {
  return CRITICAL_AUDITOR_REPAIR_ACTION_TARGET_FIELDS[actionType] ?? [];
}

interface CriticalAuditorRoundInput {
  roundIndex: number;
  transactionId?: string;
  namespaceVersion?: string;
  auditInputHash: string;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  packetHash: string;
  roundPerspective: Record<string, unknown>;
  gateDryRun: CriticalAuditorGateDryRunSummary;
  packetProjectionSummary: {
    projectionGroups: string[];
    projectionRefs: string[];
  };
  mustRefs: string[];
  sourceRequirementTexts: string[];
  mustPacketCount: number;
  consecutiveNoNewGapRounds: number;
  previousReceipts: Record<string, unknown>[];
}

interface CriticalAuditorRoundResult {
  verdict: CriticalAuditorVerdict;
  transactionId?: string;
  namespaceVersion?: string;
  requestHash?: string;
  sourceHash?: string;
  packetHash?: string;
  gapCandidates?: Record<string, unknown>[];
  validatedGaps?: Array<Record<string, unknown> & { repairActions?: CriticalAuditorRepairAction[] }>;
  rejectedGapCandidates?: Record<string, unknown>[];
  mutationPressureFindings?: Record<string, unknown>[];
  overBroadTaskFindings?: Record<string, unknown>[];
  missingProjectionFindings?: Record<string, unknown>[];
  invalidProofFindings?: Record<string, unknown>[];
  legacyBypassFindings?: Record<string, unknown>[];
  sourceMaterializationFindings?: Record<string, unknown>[];
  reviewedMustRefs?: string[];
  reviewedProjectionRefs?: string[];
  gateDryRunHash?: string;
  reconciliationIssueCount?: number;
  checkedProjectionGroups?: string[];
  checkedProjectionQualityRuleCodes?: string[];
  priorFindingsDisposition?: Record<string, unknown>[];
  falsePositiveProofs?: Record<string, unknown>[];
  rationale?: string;
}

export interface MainAgentPreConfirmationDrilldownResult extends PreConfirmationDrilldownLaneState {
  ok: boolean;
  selectedAuthoringLane?: 'author-confirmation-ready-source';
  visibleAuthoringLaneMessage?: string;
  advisoryScan?: Record<string, unknown>;
  status?: 'draft_updated_not_confirmation_ready';
  changedSections?: string[];
  currentBlockingReason?: string | null;
  nextUserPrompt?: string | null;
  nextRequiredAction?: string | null;
  confirmationLanguage?: string | null;
  sourcePath: string;
  requirementSetId: string;
  recordId: string;
  sourceDocumentHash: string | null;
  implementationConfirmationHash: string | null;
  criticalAuditorProviderMode?: CriticalAuditorProviderMode;
  blockingStage?: string | null;
  sourceMutationPerformed?: boolean;
  allowedArtifacts?: string[];
  forbiddenArtifacts?: string[];
  criticalAuditorContinuation?: Record<string, unknown> | null;
  stagingTransaction?: Record<string, unknown> | null;
  confirmationHtmlPath: string | null;
  confirmationRenderReportPath: string | null;
  confirmability: 'confirmable' | 'blocked';
  deliveryReadiness: Record<string, unknown>;
  finalStandards: Record<string, boolean>;
  receiptPath?: string | null;
  receiptHash?: string | null;
  updatedSourceSections?: string[];
  blockingNextAction?: string | null;
}

interface PreConfirmationRunOptions {
  source?: string;
  intakeSource?: string;
  targetSource?: string;
  recordId?: string;
  requirementSetId?: string;
  confirmationLanguage?: string;
  mode?: string;
  skipDrilldownArtifacts?: boolean;
  targetPath?: string | string[];
  requiredCommand?: string | string[];
  criticalAuditorProviderMode?: CriticalAuditorProviderMode | string;
  criticalAuditorResponseFile?: string;
  criticalAuditorResponseDir?: string;
  criticalAuditorExternalAdapterCommand?: string;
  checkpointPersistenceEvidencePath?: string;
  criticalAuditorRound?: (input: CriticalAuditorRoundInput) => CriticalAuditorRoundResult;
  maxCriticalAuditorRounds?: number;
}

interface MainAgentAuthoringRepairOptions {
  source?: string;
  recordId?: string;
  requirementSetId?: string;
  mode?: string;
  criticalAuditorResponse?: string;
}

export interface MainAgentAuthoringRepairResult {
  ok: boolean;
  status: 'blocked' | 'pre_render_ready';
  mode: 'preserve-existing';
  purpose: 'post_materialization_deep_audit';
  purposeGuard: Record<string, unknown>;
  sourcePath: string;
  recordId: string;
  requirementSetId: string;
  sourceDocumentHash: string | null;
  implementationConfirmationHash: string | null;
  packetHash: string | null;
  blockingStage: string | null;
  nextRequiredAction: string;
  repairCommand: string;
  artifacts: string[];
  paths: Record<string, string>;
  blockingIssues: PreConfirmationDrilldownIssue[];
  warnings: Array<Record<string, string>>;
  consecutiveNoNewGapRounds: number;
}

interface SourceMustRequirement {
  id: string;
  text: string;
  textZh?: string;
  source:
    | 'explicit_source_must'
    | 'inline_implementation_confirmation'
    | 'controlled_plain_source_candidate';
  sourceLine: number | null;
  sourcePath?: string;
  sourceDocumentHash?: string;
  sourceSpan?: { startLine: number; endLine: number };
  headingPath?: string[];
  candidateId?: string;
}

interface ControlledMustCandidate {
  candidateId: string;
  sourcePath: string;
  sourceHash: string;
  sourceDocumentHash: string;
  sourceSpan: { startLine: number; endLine: number };
  headingPath: string[];
  blockId?: string;
  blockKind?: StructuredSourceBlockKind;
  requirementType?: 'positive' | 'negative_constraint' | 'target_authority' | 'validation_authority';
  coverageDecision?: RequirementCoverageDecision;
  coverageReason?: string;
  confidence?: number;
  tableContext?: Record<string, unknown> | null;
  groupId?: string;
  originalText: string;
  normalizedRequirement: string;
  decision: 'accepted_for_draft' | 'rejected';
  decisionReason: string;
  requiresHumanReview: boolean;
}

type StructuredSourceBlockKind = 'paragraph' | 'list_item' | 'table_row' | 'heading';
type RequirementCoverageDecision =
  | 'mapped_to_must'
  | 'mapped_to_non_goal'
  | 'mapped_to_target_authority'
  | 'mapped_to_validation_authority'
  | 'rejected_non_requirement'
  | 'blocked_unmapped_requirement';

interface StructuredSourceBlock {
  blockId: string;
  sourcePath: string;
  sourceDocumentHash: string;
  sourceSpan: { startLine: number; endLine: number };
  headingPath: string[];
  blockKind: StructuredSourceBlockKind;
  rawText: string;
  normalizedText: string;
  requirementSignal: string[];
  domainTerms: string[];
  decision: RequirementCoverageDecision;
  tableContext?: Record<string, unknown> | null;
}

interface RequirementCoverageLedger {
  schemaVersion: 'requirements-authoring-coverage-ledger/v1';
  sourcePath: string;
  sourceDocumentHash: string;
  sourceBlockCount: number;
  requirementBearingBlockCount: number;
  mappedMustCount: number;
  mappedNonGoalCount: number;
  mappedTargetAuthorityCount: number;
  mappedValidationAuthorityCount: number;
  blockedUnmappedRequirementCount: number;
  coverageRatio: number;
  blockingIssues: string[];
  entries: StructuredSourceBlock[];
}

interface TargetAuthorityRecord {
  id: string;
  path: string;
  pathKind: 'source' | 'test' | 'doc' | 'config' | 'script' | 'external';
  source: 'explicit_option' | 'source_document';
  sourceSpan: { startLine: number; endLine: number } | null;
  sourceDocumentHash: string;
  confidence: number;
  reason: string;
  explicit: boolean;
}

interface ValidationAuthorityRecord {
  id: string;
  command: string;
  workingDirectory: string;
  source: 'explicit_option' | 'source_document';
  sourceSpan: { startLine: number; endLine: number } | null;
  sourceDocumentHash: string;
  targetPathRefs: string[];
  commandFileRefs: string[];
  executable: boolean;
  derivationReason: string;
  blocksSourceMutationWhenMissing: boolean;
}

interface SourceMutationDecision {
  schemaVersion: 'requirements-authoring-source-mutation-decision/v1';
  sourcePath: string;
  sourceDocumentExistedBefore: boolean;
  sourceDocumentHashBefore: string;
  sourceDocumentHashAfter: string;
  targetRawHashBefore?: string;
  targetRawHashAfter?: string;
  semanticSourceHashBefore?: string;
  semanticSourceHashAfter?: string;
  recordId: string;
  requirementSetId: string;
  attemptId: string;
  createdAt: string;
  sourceMutationAllowed: boolean;
  sourceMutationPerformed: boolean;
  blockedIssueCodes: string[];
  coverageDecision: string;
  targetAuthorityDecision: string;
  validationAuthorityDecision: string;
  projectionSanityDecision: string;
  auditEvidenceDecision: string;
  scaleRoutingDecision: string;
  userConfirmationDecision: string;
  reverseAuditDraftValidationDecision: string;
  finalDecision: 'allow_source_materialization' | 'block_source_materialization';
}

function preConfirmationIssue(
  code: string,
  message: string,
  refs: string[] = [],
  source = 'main_agent_orchestration'
): PreConfirmationDrilldownIssue {
  return { code, message, refs, severity: 'blocker', source };
}

function sanitizeRequirementIdSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'pre-confirmation';
}

function assertSafeRequirementIdPathSegment(label: string, value: string): void {
  if (path.isAbsolute(value)) {
    throw new Error(`${label} must not be absolute: ${value}`);
  }
  if (value.includes('..') || /[\\/]/u.test(value)) {
    throw new Error(`${label} must not contain path separators or traversal segments: ${value}`);
  }
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error(
      `${label} must contain only alphanumeric characters, hyphens, and underscores: ${value}`
    );
  }
}

function toRootRelativePath(root: string, filePath: string): string {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
  const relative = path.relative(root, absolute);
  return (!relative.startsWith('..') && !path.isAbsolute(relative) ? relative : absolute).replace(
    /\\/g,
    '/'
  );
}

function resolveRootRelativePath(root: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
}

function derivePreConfirmationIdentity(
  root: string,
  sourcePath: string,
  options: PreConfirmationRunOptions
): {
  recordId: string;
  requirementSetId: string;
} {
  const sourceStem = sanitizeRequirementIdSegment(
    path.basename(sourcePath, path.extname(sourcePath))
  ).toUpperCase();
  const recordId = normalizeText(options.recordId) || `REQ-${sourceStem}`;
  const requirementSetId = normalizeText(options.requirementSetId) || recordId;
  assertSafeRequirementIdPathSegment('recordId', recordId);
  assertSafeRequirementIdPathSegment('requirementSetId', requirementSetId);
  return { recordId, requirementSetId };
}

function preConfirmationPaths(
  root: string,
  recordId: string,
  requirementSetId = recordId
): PreConfirmationPaths {
  const recordRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId);
  const authoringDir = path.join(recordRoot, 'authoring');
  const archiveDir = path.join(authoringDir, 'archive');
  const confirmationDir = path.join(recordRoot, 'confirmation');
  return {
    recordRoot,
    authoringDir,
    archiveDir,
    confirmationDir,
    recordPath: path.join(recordRoot, 'requirement-record.json'),
    indexPath: path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'),
    semanticKernel: path.join(authoringDir, 'semantic-kernel.json'),
    mustDecompositionPacket: path.join(authoringDir, 'must_decomposition_packet.json'),
    controlledMustCandidates: path.join(authoringDir, 'controlled-must-candidates.json'),
    requirementCoverageLedger: path.join(authoringDir, 'requirement-coverage-ledger.json'),
    targetAuthorityReport: path.join(authoringDir, 'target-authority-report.json'),
    validationAuthorityReport: path.join(authoringDir, 'validation-authority-report.json'),
    projectionDomainSanityReport: path.join(authoringDir, 'projection-domain-sanity-report.json'),
    sourceMutationDecision: path.join(authoringDir, 'source-mutation-decision.json'),
    authoringTransaction: path.join(authoringDir, 'authoring-transaction.json'),
    draftSourcePreview: path.join(authoringDir, 'draft-source-preview.md'),
    promotionReceipt: path.join(authoringDir, 'promotion-receipt.json'),
    draftImplementationConfirmation: path.join(authoringDir, 'draft-implementation-confirmation.json'),
    authoringMaterializationReceipt: path.join(authoringDir, 'authoring-materialization-receipt.json'),
    scaleAssessmentInitial: path.join(authoringDir, 'scale-assessment-initial.json'),
    scaleAssessmentPostPacket: path.join(authoringDir, 'scale-assessment-post-packet.json'),
    scaleAssessmentPostMaterialization: path.join(
      authoringDir,
      'scale-assessment-post-materialization.json'
    ),
    scaleRoutingDecision: path.join(authoringDir, 'scale-routing-decision.json'),
    checkpointPersistenceEvidence: path.join(authoringDir, 'checkpoint-persistence-evidence.json'),
    checkpointReceiptPaths: Array.from({ length: 9 }, (_item, index) =>
      path.join(authoringDir, `checkpoint-receipt-cp-${String(index).padStart(2, '0')}.json`)
    ),
    encodingReport: path.join(authoringDir, 'encoding-report.json'),
    sourceMaterializationReceipt: sourceMaterializationReceiptPath(root, requirementSetId),
    receiptPaths: [1, 2, 3].map((round) =>
      path.join(authoringDir, `critical-auditor-receipt-round-${round}.json`)
    ),
    reconciliationReport: path.join(authoringDir, 'must_packet_source_reconciliation_report.json'),
    progress: path.join(authoringDir, 'semantic-checkpoint-progress.json'),
    mustDecompositionReceipt: path.join(authoringDir, 'must_decomposition_receipt.json'),
    preRenderMustGate: path.join(authoringDir, 'pre-render-must-decomposition-gate-report.json'),
    preRenderGlobalConsistency: path.join(
      authoringDir,
      'pre-render-global-consistency-report.json'
    ),
    confirmationHtml: path.join(confirmationDir, 'confirmation.html'),
    confirmationSummary: path.join(confirmationDir, 'confirmation-summary.json'),
    confirmationRenderReport: path.join(confirmationDir, 'confirmation-render-report.json'),
  };
}

function sourceMaterializationReceiptPath(root: string, requirementSetId: string): string {
  assertSafeRequirementIdPathSegment('requirementSetId', requirementSetId);
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId,
    'authoring',
    'source-materialization-receipt.json'
  );
}

function parseCriticalAuditorProviderMode(value: unknown): CriticalAuditorProviderMode {
  const normalized = normalizeText(value) || 'main_session_inline';
  if ((CRITICAL_AUDITOR_PROVIDER_MODES as readonly string[]).includes(normalized)) {
    return normalized as CriticalAuditorProviderMode;
  }
  throw new Error(
    `critical_auditor_provider_mode_invalid: expected one of ${CRITICAL_AUDITOR_PROVIDER_MODES.join(
      ', '
    )}`
  );
}

function criticalAuditorNamespaceVersion(recordId: string, sourceHash: string): string {
  return `critical-auditor-namespace/${sha256Json({ recordId, sourceHash }).slice(
    'sha256:'.length,
    'sha256:'.length + 16
  )}`;
}

function criticalAuditorTransactionId(input: {
  recordId: string;
  sourceStartHash: string;
  namespaceVersion: string;
}): string {
  const digest = sha256Json(input).slice('sha256:'.length, 'sha256:'.length + 24);
  return `CATX-${digest}`;
}

function createCriticalAuditorStagingTransaction(input: {
  paths: PreConfirmationPaths;
  recordId: string;
  sourceStartHash: string;
}): CriticalAuditorStagingTransaction {
  const namespaceVersion = criticalAuditorNamespaceVersion(input.recordId, input.sourceStartHash);
  const transactionId = criticalAuditorTransactionId({
    recordId: input.recordId,
    sourceStartHash: input.sourceStartHash,
    namespaceVersion,
  });
  const stagingDir = path.join(input.paths.authoringDir, 'staging', transactionId);
  return {
    transactionId,
    namespaceVersion,
    sourceStartHash: input.sourceStartHash,
    stagingDir,
    draftSource: path.join(stagingDir, 'draft-source.md'),
    semanticKernel: path.join(stagingDir, 'semantic-kernel.json'),
    mustDecompositionPacket: path.join(stagingDir, 'must_decomposition_packet.json'),
    sourcePromotionDecision: path.join(stagingDir, 'source-promotion-decision.json'),
  };
}

function criticalAuditorRequestPath(
  transaction: CriticalAuditorStagingTransaction,
  roundIndex: number
): string {
  return path.join(transaction.stagingDir, `critical-auditor-round-request-${roundIndex}.json`);
}

function criticalAuditorResponsePath(
  transaction: CriticalAuditorStagingTransaction,
  roundIndex: number
): string {
  return path.join(transaction.stagingDir, `critical-auditor-round-response-${roundIndex}.json`);
}

function criticalAuditorReceiptPath(
  transaction: CriticalAuditorStagingTransaction,
  roundIndex: number
): string {
  return path.join(transaction.stagingDir, `critical-auditor-receipt-round-${roundIndex}.json`);
}

function stagingTransactionEvidence(
  root: string,
  transaction: CriticalAuditorStagingTransaction
): Record<string, unknown> {
  return {
    transactionId: transaction.transactionId,
    namespaceVersion: transaction.namespaceVersion,
    sourceStartHash: transaction.sourceStartHash,
    stagingDir: toRootRelativePath(root, transaction.stagingDir),
    draftSource: toRootRelativePath(root, transaction.draftSource),
    semanticKernel: toRootRelativePath(root, transaction.semanticKernel),
    mustDecompositionPacket: toRootRelativePath(root, transaction.mustDecompositionPacket),
    sourcePromotionDecision: toRootRelativePath(root, transaction.sourcePromotionDecision),
  };
}

type RequirementsAuthoringEntryMode = 'existing_source' | 'intake_to_new_source';

function assertKnownRequirementsAuthoringSubstate(substate: PreConfirmationDrilldownSubstate): void {
  const allowed = new Set<PreConfirmationDrilldownSubstate>([
    'intake_created',
    'initial_scale_assessed',
    'staging_draft_created',
    'critical_auditor_round_required',
    'checkpoint_persistence_required',
    'source_mutation_decision_required',
    'promotion_required',
    'promoted_not_confirmation_ready',
    'blocked_by_semantic_gap',
    'blocked_by_render_gate',
    'pre_render_ready',
    'user_confirmable',
  ]);
  if (!allowed.has(substate)) {
    throw new Error(`requirements_authoring_substate_unknown:${substate}`);
  }
}

function writeRequirementsAuthoringTransaction(input: {
  root: string;
  paths: PreConfirmationPaths;
  entryMode: RequirementsAuthoringEntryMode;
  substate: PreConfirmationDrilldownSubstate;
  sourcePath: string;
  intakePath?: string | null;
  targetSourcePath?: string | null;
  sourceStartHash: string;
  draftHash?: string | null;
  scaleRoutingDecision?: string | null;
  nextRequiredAction?: string | null;
}): void {
  assertKnownRequirementsAuthoringSubstate(input.substate);
  writeJsonUtf8(input.paths.authoringTransaction, {
    schemaVersion: 'requirements-authoring-transaction/v1',
    lane: 'author-confirmation-ready-source',
    entryMode: input.entryMode,
    substate: input.substate,
    sourcePath: toRootRelativePath(input.root, input.sourcePath),
    intakePath: input.intakePath ? toRootRelativePath(input.root, input.intakePath) : null,
    targetSourcePath: input.targetSourcePath
      ? toRootRelativePath(input.root, input.targetSourcePath)
      : null,
    sourceStartHash: input.sourceStartHash,
    draftHash: input.draftHash ?? null,
    scaleRoutingDecision: input.scaleRoutingDecision ?? null,
    nextRequiredAction: input.nextRequiredAction ?? null,
    updatedAt: new Date().toISOString(),
  });
}

function writeSourcePromotionBlockDecision(input: {
  transaction: CriticalAuditorStagingTransaction;
  blockingStage: string;
  createdAt: string;
  currentSourceHash?: string;
  archiveDir?: string | null;
  root?: string;
}): void {
  writeJsonUtf8(input.transaction.sourcePromotionDecision, {
    schemaVersion: 'requirements-contract-source-promotion-decision/v1',
    transactionId: input.transaction.transactionId,
    namespaceVersion: input.transaction.namespaceVersion,
    sourceStartHash: input.transaction.sourceStartHash,
    currentSourceHash: input.currentSourceHash,
    finalDecision: 'block_source_promotion',
    blockingStage: input.blockingStage,
    sourceMutationPerformed: false,
    archiveDir:
      input.archiveDir && input.root ? toRootRelativePath(input.root, input.archiveDir) : undefined,
    createdAt: input.createdAt,
  });
}

function extractImplementationConfirmationBlock(
  sourceText: string
): ImplementationConfirmationExtraction | null {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) {
    return null;
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') {
      continue;
    }
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = index;
      break;
    }
  }
  const blockText = lines.slice(start, end).join('\n');
  const parsed = yaml.load(blockText) as Record<string, unknown> | null;
  const confirmation =
    parsed?.implementationConfirmation &&
    typeof parsed.implementationConfirmation === 'object' &&
    !Array.isArray(parsed.implementationConfirmation)
      ? (parsed.implementationConfirmation as Record<string, unknown>)
      : {};
  return { start, end, blockText, confirmation, lines };
}

function dumpImplementationConfirmation(confirmation: Record<string, unknown>): string {
  return yaml
    .dump(
      { implementationConfirmation: confirmation },
      { lineWidth: 120, noRefs: true, sortKeys: false }
    )
    .trimEnd();
}

function semanticConfirmationForHash(
  confirmation: Record<string, unknown>
): Record<string, unknown> {
  const bookkeeping = new Set([
    'status',
    'confirmedAt',
    'confirmedBy',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'reconfirmationRequest',
    'confirmationRender',
  ]);
  const semantic = Object.fromEntries(Object.entries(confirmation).filter(([key]) => !bookkeeping.has(key)));
  const drilldown = recordObject(semantic.preConfirmationDrilldown);
  const semanticKernelRef = recordObject(drilldown.semanticKernelRef);
  const mustDecompositionPacketRef = recordObject(drilldown.mustDecompositionPacketRef);
  if (Object.keys(semanticKernelRef).length > 0) {
    drilldown.semanticKernelRef = Object.fromEntries(
      Object.entries(semanticKernelRef).filter(([key]) => key !== 'hash')
    );
  }
  if (Object.keys(mustDecompositionPacketRef).length > 0) {
    drilldown.mustDecompositionPacketRef = Object.fromEntries(
      Object.entries(mustDecompositionPacketRef).filter(([key]) => key !== 'hash')
    );
  }
  const criticalAuditor = recordObject(drilldown.criticalAuditor);
  if (Object.keys(criticalAuditor).length > 0) {
    const stableCriticalAuditor = Object.fromEntries(
      Object.entries(criticalAuditor).filter(
        ([key]) => !['consecutiveNoNewGapRounds', 'latestReceiptHash', 'convergenceVerdict'].includes(key)
      )
    );
    semantic.preConfirmationDrilldown = {
      ...drilldown,
      criticalAuditor: stableCriticalAuditor,
    };
  } else if (Object.keys(drilldown).length > 0) {
    semantic.preConfirmationDrilldown = drilldown;
  }
  return semantic;
}

function sourceDocumentHashForPreConfirmation(
  sourceText: string,
  blockText: string,
  confirmation: Record<string, unknown>
): string {
  const normalizedBlock = `implementationConfirmation:${stableStringify(
    semanticConfirmationForHash(confirmation)
  )}`;
  return sha256Text(sourceText.replace(blockText, normalizedBlock));
}

function implementationConfirmationHashForPreConfirmation(
  confirmation: Record<string, unknown>
): string {
  return sha256Json(semanticConfirmationForHash(confirmation));
}

function projectionBackRef(packetHash: string, mustRef = 'MUST-001'): Record<string, unknown> {
  return {
    derivedFromMustRef: mustRef,
    derivedFromPacketHash: packetHash,
    projectionStatus: 'synchronized',
  };
}

function requirementOrdinal(index: number): string {
  return String(index + 1).padStart(3, '0');
}

function normalizeMustRef(value: unknown, index: number): string {
  const candidate = normalizeText(value).toUpperCase();
  return /^MUST-[A-Z0-9][A-Z0-9-]*$/u.test(candidate)
    ? candidate
    : `MUST-${requirementOrdinal(index)}`;
}

function atomicTaskIdsForMust(index: number, total: number): [string, string] {
  if (total === 1) {
    return ['TASK-001', 'TASK-002'];
  }
  const ordinal = requirementOrdinal(index);
  return [`TASK-${ordinal}-AUTHOR`, `TASK-${ordinal}-MATERIALIZE`];
}

function mdmIdForMust(index: number, total: number): string {
  return total === 1 ? 'MDM-001' : `MDM-${requirementOrdinal(index)}`;
}

function extractExplicitSourceMustRequirements(sourceText: string): SourceMustRequirement[] {
  const extraction = extractImplementationConfirmationBlock(sourceText);
  const semanticText = extraction
    ? [
        ...extraction.lines.slice(0, extraction.start),
        ...extraction.lines.slice(extraction.end),
      ].join('\n')
    : sourceText;
  const rows: SourceMustRequirement[] = [];
  semanticText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((line, index) => {
      const match = line.match(
        /^\s*(?:[-*]\s*)?(?:\[(MUST-\d+)\]\s*)?MUST(?:-\d+)?\s*[:：]\s*(.+?)\s*$/iu
      );
      if (!match) {
        return;
      }
      const text = normalizeText(match[2]);
      if (!text) {
        return;
      }
      rows.push({
        id: normalizeText(match[1]),
        text,
        source: 'explicit_source_must' as const,
        sourceLine: index + 1,
      });
    });
  return rows.map((item, index) => ({ ...item, id: normalizeMustRef(item.id, index) }));
}

function extractInlineMustRequirements(
  confirmation: Record<string, unknown>
): SourceMustRequirement[] {
  const rows = Array.isArray(confirmation.must) ? confirmation.must : [];
  return rows
    .filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === 'object' && !Array.isArray(row)
    )
    .map((row, index) => ({
      id: normalizeMustRef(row.id, index),
      text: normalizeText(row.text),
      textZh: normalizeText(row.textZh) || undefined,
      source: 'inline_implementation_confirmation' as const,
      sourceLine: null,
    }))
    .filter((row) => Boolean(row.text));
}

function mergeSourceBoundMustRequirements(
  existing: SourceMustRequirement[],
  candidates: SourceMustRequirement[]
): SourceMustRequirement[] {
  const rows = [...existing];
  const seenIds = new Set(rows.map((row) => normalizeText(row.id)).filter(Boolean));
  const seenTexts = new Set(rows.map((row) => normalizeText(row.text).toLowerCase()).filter(Boolean));
  for (const candidate of candidates) {
    const normalizedText = normalizeText(candidate.text);
    if (!normalizedText) {
      continue;
    }
    const normalizedId = normalizeText(candidate.id);
    if ((normalizedId && seenIds.has(normalizedId)) || seenTexts.has(normalizedText.toLowerCase())) {
      continue;
    }
    rows.push(candidate);
    if (normalizedId) {
      seenIds.add(normalizedId);
    }
    seenTexts.add(normalizedText.toLowerCase());
  }
  return rows;
}

function resolveSourceMustRequirements(sourcePath: string): SourceMustRequirement[] {
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const explicit = extractExplicitSourceMustRequirements(sourceText);
  if (explicit.length > 0) {
    return explicit;
  }
  const extraction = extractImplementationConfirmationBlock(sourceText);
  const inline = extraction ? extractInlineMustRequirements(extraction.confirmation) : [];
  if (inline.length > 0) {
    return inline;
  }
  return [];
}

function userConfirmationPromotionIssues(
  sourceText: string,
  sourcePath: string,
  root: string
): PreConfirmationDrilldownIssue[] {
  const extraction = extractImplementationConfirmationBlock(sourceText);
  if (!extraction) {
    return [];
  }
  const status = normalizeText(extraction.confirmation.status);
  if (status !== 'user_confirmed') {
    return [];
  }
  return [
    preConfirmationIssue(
      'user_confirmation_missing',
      'author-confirmation-ready-source cannot accept or synthesize status=user_confirmed; explicit user confirmation must be recorded by the separate confirmation path.',
      [toRootRelativePath(root, sourcePath), 'implementationConfirmation.status'],
      'source_mutation_gate'
    ),
  ];
}

function stripMarkdownListMarker(line: string): string {
  return normalizeText(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/u, ''));
}

function isMarkdownTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length >= 3;
}

function isMarkdownTableSeparator(line: string): boolean {
  return /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/u.test(line);
}

function markdownTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => normalizeText(cell.replace(/`([^`]+)`/gu, '$1')));
}

function sourceBlockDomainTerms(text: string): string[] {
  const terms: Array<[string, RegExp]> = [
    ['ui', /(?:UI|UX|界面|面板|设置|显示|主图|窗口|弹窗|布局|预览)/iu],
    ['data', /(?:数据|存储|DB|database|cache|queue|默认显示|持久化)/iu],
    ['operation', /(?:批量|取消|回滚|OK|保存|apply|preview|操作|流程)/iu],
    ['validation', /(?:验收|测试|pytest|vitest|command|验证|校验|检查)/iu],
    ['target', /(?:target|path|file|路径|文件|vnpy|scripts\/|tests\/)/iu],
    ['constraint', /(?:\d{3,4}x\d{3,4}|性能|兼容|约束|限制|不得|禁止|不能)/iu],
  ];
  return terms.filter(([, pattern]) => pattern.test(text)).map(([term]) => term);
}

function hasMandatoryRequirementLanguage(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length < 8) {
    return false;
  }
  if (/^MUST(?:-\d+)?\s*[:：]/iu.test(normalized)) {
    return false;
  }
  if (/\b(?:lacks?|missing|without|no)\s+(?:explicit\s+)?MUST\b/iu.test(normalized)) {
    return false;
  }
  if (/\b(?:must|shall|required to|requires?|cannot|must not|forbidden|default|ensure)\b/iu.test(normalized)) {
    return true;
  }
  return /(?:必须|不得|禁止|需要|应当|不能|不允许|默认|确保|验收|支持|保持)/u.test(normalized);
}

function headingImpliesRequirement(headingPath: string[]): boolean {
  return headingPath.some((heading) =>
    /(?:requirements?|acceptance|behavior|scope|scenario|constraints?|defaults?|settings?|display|overview|验收|需求|行为|场景|约束|默认|设置|显示|主图|功能)/iu.test(
      heading
    )
  );
}

function headingImpliesNonGoal(headingPath: string[]): boolean {
  return headingPath.some((heading) =>
    /(?:non-?goals?|out of scope|not done|不做|非目标|排除|禁止)/iu.test(heading)
  );
}

function textImpliesTargetAuthority(text: string): boolean {
  return /(?:^|\s|`)(?:[A-Za-z0-9_.-]+\/)+(?:[A-Za-z0-9_.-]+)\.(?:ts|tsx|js|cjs|mjs|py|md|toml|yaml|yml|json)(?:`|\s|$)/u.test(
    text
  );
}

function textImpliesValidationAuthority(text: string): boolean {
  return /\b(?:pytest|vitest|npm\s+run|pnpm\s+|yarn\s+|node\s+|python\s+-m|go\s+test|cargo\s+test)\b/iu.test(
    text
  );
}

function classifyStructuredSourceBlock(input: {
  text: string;
  headingPath: string[];
  blockKind: StructuredSourceBlockKind;
  tableContext?: Record<string, unknown> | null;
}): { decision: RequirementCoverageDecision; requirementSignal: string[] } {
  const normalized = normalizeText(input.text);
  const signal = new Set<string>();
  const requirementContext =
    headingImpliesRequirement(input.headingPath) ||
    (input.blockKind === 'table_row' &&
      /(?:default|behavior|expected|验收|默认|行为|设置|显示|约束)/iu.test(
        JSON.stringify(input.tableContext ?? {})
      ));
  const unresolvedPlaceholder =
    requirementContext &&
    /(?:\bTBD\b|\bTBC\b|\bTODO\b|待定|未定|不明确|(?:^|[|\s])\?(?:[|\s]|$))/iu.test(
      `${normalized} ${JSON.stringify(input.tableContext ?? {})}`
    );
  if (hasMandatoryRequirementLanguage(normalized)) {
    signal.add('mandatory_language');
  }
  if (headingImpliesRequirement(input.headingPath)) {
    signal.add('requirement_heading');
  }
  if (headingImpliesNonGoal(input.headingPath)) {
    signal.add('non_goal_heading');
  }
  if (textImpliesTargetAuthority(normalized)) {
    signal.add('target_path');
  }
  if (textImpliesValidationAuthority(normalized)) {
    signal.add('validation_command');
  }
  if (/\b\d{3,4}x\d{3,4}\b/u.test(normalized)) {
    signal.add('numeric_layout_constraint');
  }
  if (
    input.blockKind === 'table_row' &&
    requirementContext
  ) {
    signal.add('requirement_table_row');
  }
  if (unresolvedPlaceholder) {
    signal.add('unresolved_placeholder');
    return { decision: 'blocked_unmapped_requirement', requirementSignal: [...signal] };
  }

  if (signal.has('validation_command')) {
    return { decision: 'mapped_to_validation_authority', requirementSignal: [...signal] };
  }
  if (signal.has('target_path') && !signal.has('mandatory_language')) {
    return { decision: 'mapped_to_target_authority', requirementSignal: [...signal] };
  }
  if (signal.has('non_goal_heading')) {
    return { decision: 'mapped_to_non_goal', requirementSignal: [...signal] };
  }
  if (
    signal.has('mandatory_language') ||
    signal.has('requirement_table_row') ||
    signal.has('numeric_layout_constraint') ||
    (signal.has('requirement_heading') && normalized.length >= 12)
  ) {
    return { decision: 'mapped_to_must', requirementSignal: [...signal] };
  }
  return { decision: 'rejected_non_requirement', requirementSignal: [...signal] };
}

function extractStructuredSourceBlocks(
  root: string,
  sourcePath: string,
  sourceText: string
): StructuredSourceBlock[] {
  const sourceDocumentHash = sha256Text(sourceText);
  const sourceRel = toRootRelativePath(root, sourcePath);
  const extraction = extractImplementationConfirmationBlock(sourceText);
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const headingPath: string[] = [];
  const blocks: StructuredSourceBlock[] = [];
  let inFence = false;
  let paragraphStart: number | null = null;
  let paragraphLines: Array<{ lineNumber: number; text: string }> = [];

  const pushBlock = (
    startLine: number,
    endLine: number,
    blockKind: StructuredSourceBlockKind,
    rawText: string,
    tableContext: Record<string, unknown> | null = null
  ) => {
    const normalizedText = normalizeText(rawText.replace(/\s+/gu, ' '));
    if (!normalizedText) {
      return;
    }
    const classification = classifyStructuredSourceBlock({
      text: normalizedText,
      headingPath: headingPath.filter(Boolean),
      blockKind,
      tableContext,
    });
    blocks.push({
      blockId: `SRC-BLOCK-${requirementOrdinal(blocks.length)}`,
      sourcePath: sourceRel,
      sourceDocumentHash,
      sourceSpan: { startLine, endLine },
      headingPath: headingPath.filter(Boolean),
      blockKind,
      rawText,
      normalizedText,
      requirementSignal: classification.requirementSignal,
      domainTerms: sourceBlockDomainTerms(`${headingPath.join(' ')} ${normalizedText}`),
      decision: classification.decision,
      ...(tableContext ? { tableContext } : {}),
    });
  };

  const flushParagraph = () => {
    if (paragraphStart === null || paragraphLines.length === 0) {
      return;
    }
    for (const paragraphLine of paragraphLines) {
      pushBlock(paragraphLine.lineNumber, paragraphLine.lineNumber, 'paragraph', paragraphLine.text);
    }
    paragraphStart = null;
    paragraphLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    if (extraction && index >= extraction.start && index < extraction.end) {
      flushParagraph();
      continue;
    }
    if (/^\s*```/u.test(line)) {
      flushParagraph();
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/u);
    if (heading) {
      flushParagraph();
      headingPath.splice(heading[1].length - 1);
      headingPath[heading[1].length - 1] = normalizeText(heading[2]);
      continue;
    }
    if (!normalizeText(line)) {
      flushParagraph();
      continue;
    }
    const listText = stripMarkdownListMarker(line);
    if (listText !== normalizeText(line)) {
      flushParagraph();
      pushBlock(lineNumber, lineNumber, 'list_item', listText);
      continue;
    }
    if (isMarkdownTableRow(line)) {
      flushParagraph();
      const headerLine = index > 1 && isMarkdownTableSeparator(lines[index - 1]) ? lines[index - 2] : '';
      const headers = isMarkdownTableRow(headerLine) ? markdownTableCells(headerLine) : [];
      const cells = markdownTableCells(line);
      if (isMarkdownTableSeparator(line) || (headers.length === 0 && index + 1 < lines.length && isMarkdownTableSeparator(lines[index + 1]))) {
        continue;
      }
      const row: Record<string, string> = {};
      cells.forEach((cell, cellIndex) => {
        row[headers[cellIndex] || `column_${cellIndex + 1}`] = cell;
      });
      pushBlock(lineNumber, lineNumber, 'table_row', cells.join(' | '), { headers, cells, row });
      continue;
    }
    if (paragraphStart === null) {
      paragraphStart = lineNumber;
    }
    paragraphLines.push({ lineNumber, text: normalizeText(line) });
  }
  flushParagraph();
  return blocks;
}

function buildRequirementCoverageLedger(input: {
  root: string;
  sourcePath: string;
  sourceText: string;
  blocks: StructuredSourceBlock[];
}): RequirementCoverageLedger {
  const requirementBearing = input.blocks.filter((block) =>
    [
      'mapped_to_must',
      'mapped_to_non_goal',
      'mapped_to_target_authority',
      'mapped_to_validation_authority',
      'blocked_unmapped_requirement',
    ].includes(block.decision)
  );
  const count = (decision: RequirementCoverageDecision) =>
    input.blocks.filter((block) => block.decision === decision).length;
  const blockedUnmappedRequirementCount = count('blocked_unmapped_requirement');
  const mappedCount =
    count('mapped_to_must') +
    count('mapped_to_non_goal') +
    count('mapped_to_target_authority') +
    count('mapped_to_validation_authority');
  const coverageRatio =
    requirementBearing.length === 0 ? 1 : Number((mappedCount / requirementBearing.length).toFixed(4));
  const blockingIssues =
    blockedUnmappedRequirementCount > 0
      ? ['source_requirement_coverage_gap']
      : [];
  return {
    schemaVersion: 'requirements-authoring-coverage-ledger/v1',
    sourcePath: toRootRelativePath(input.root, input.sourcePath),
    sourceDocumentHash: sha256Text(input.sourceText),
    sourceBlockCount: input.blocks.length,
    requirementBearingBlockCount: requirementBearing.length,
    mappedMustCount: count('mapped_to_must'),
    mappedNonGoalCount: count('mapped_to_non_goal'),
    mappedTargetAuthorityCount: count('mapped_to_target_authority'),
    mappedValidationAuthorityCount: count('mapped_to_validation_authority'),
    blockedUnmappedRequirementCount,
    coverageRatio,
    blockingIssues,
    entries: input.blocks,
  };
}

function writeRequirementCoverageLedgerArtifact(
  pathToLedger: string,
  ledger: RequirementCoverageLedger
): void {
  writeJsonUtf8(pathToLedger, ledger);
}

function normalizeStringList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  const normalized = normalizeText(value);
  return normalized ? normalized.split(/\n+/u).map((item) => normalizeText(item)).filter(Boolean) : [];
}

function pathKindForTarget(targetPath: string): TargetAuthorityRecord['pathKind'] {
  if (/\.(?:test|spec)\.(?:ts|tsx|js|py)$/iu.test(targetPath) || /(?:^|\/)tests?\//iu.test(targetPath)) {
    return 'test';
  }
  if (/\.(?:md|mdx|rst)$/iu.test(targetPath)) {
    return 'doc';
  }
  if (/\.(?:json|ya?ml|toml|ini|cfg)$/iu.test(targetPath)) {
    return 'config';
  }
  if (/(?:^|\/)scripts\//iu.test(targetPath)) {
    return 'script';
  }
  return 'source';
}

function extractPathLikeTokens(text: string): string[] {
  const matches = text.match(
    /(?:^|[\s`"'])([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.(?:ts|tsx|js|cjs|mjs|py|md|toml|yaml|yml|json))(?:[\s`"',]|$)/gu
  );
  if (!matches) {
    return [];
  }
  return Array.from(
    new Set(
      matches
        .map((match) => normalizeText(match.replace(/^[\s`"']+|[\s`"',]+$/gu, '')))
        .filter(Boolean)
    )
  );
}

function pathEscapesProjectRoot(root: string, candidatePath: string): boolean {
  if (/^(?:https?:|mailto:)/iu.test(candidatePath)) {
    return false;
  }
  const resolved = path.isAbsolute(candidatePath)
    ? path.resolve(candidatePath)
    : path.resolve(root, candidatePath);
  const rootResolved = path.resolve(root);
  return resolved !== rootResolved && !resolved.startsWith(`${rootResolved}${path.sep}`);
}

function extractTargetAuthorityFromSource(input: {
  root: string;
  sourceText: string;
  blocks: StructuredSourceBlock[];
}): TargetAuthorityRecord[] {
  const sourceDocumentHash = sha256Text(input.sourceText);
  const records: TargetAuthorityRecord[] = [];
  for (const block of input.blocks) {
    const text = `${block.headingPath.join(' ')} ${block.normalizedText}`;
    const paths = extractPathLikeTokens(text);
    for (const candidatePath of paths) {
      records.push({
        id: `TARGET-AUTH-${requirementOrdinal(records.length)}`,
        path: candidatePath.replace(/\\/g, '/'),
        pathKind: pathKindForTarget(candidatePath),
        source: 'source_document',
        sourceSpan: block.sourceSpan,
        sourceDocumentHash,
        confidence: block.decision === 'mapped_to_target_authority' ? 0.95 : 0.8,
        reason: `Path-like token found in source block ${block.blockId}.`,
        explicit: false,
      });
    }
  }
  return records;
}

function resolveTargetAuthority(input: {
  root: string;
  sourceText: string;
  explicitTargetPaths: string[];
  sourceRecords: TargetAuthorityRecord[];
}): { accepted: TargetAuthorityRecord[]; rejected: Array<Record<string, unknown>>; issues: PreConfirmationDrilldownIssue[] } {
  const sourceDocumentHash = sha256Text(input.sourceText);
  const explicitRecords = input.explicitTargetPaths.map((targetPath, index): TargetAuthorityRecord => ({
    id: `TARGET-AUTH-EXPLICIT-${requirementOrdinal(index)}`,
    path: targetPath.replace(/\\/g, '/'),
    pathKind: pathKindForTarget(targetPath),
    source: 'explicit_option',
    sourceSpan: null,
    sourceDocumentHash,
    confidence: 1,
    reason: 'Provided by --target-path.',
    explicit: true,
  }));
  const seen = new Set<string>();
  const rejected: Array<Record<string, unknown>> = [];
  const candidateRecords = explicitRecords.length > 0 ? explicitRecords : input.sourceRecords;
  const accepted = candidateRecords.filter((record) => {
    const normalizedPath = record.path.replace(/\\/g, '/');
    if (seen.has(normalizedPath)) {
      return false;
    }
    seen.add(normalizedPath);
    if (pathEscapesProjectRoot(input.root, record.path)) {
      rejected.push({ ...record, reason: 'target_path_outside_project_root' });
      return false;
    }
    if (/^(?:https?:|mailto:)/iu.test(record.path)) {
      rejected.push({ ...record, reason: 'url_target_path_not_allowed_for_source_mutation' });
      return false;
    }
    return true;
  });
  const issues =
    accepted.length === 0
      ? [
          preConfirmationIssue(
            'target_authority_missing',
            'No explicit or source-derived target path authority was found; source materialization is blocked.',
            ['--target-path', 'target-authority-report.json'],
            'target_authority'
          ),
        ]
      : [];
  return { accepted, rejected, issues };
}

function extractValidationCommandCandidates(blocks: StructuredSourceBlock[]): Array<{
  command: string;
  sourceSpan: { startLine: number; endLine: number };
  sourceDocumentHash: string;
}> {
  const commands: Array<{
    command: string;
    sourceSpan: { startLine: number; endLine: number };
    sourceDocumentHash: string;
  }> = [];
  const commandPattern =
    /\b((?:npx\s+)?(?:pytest|vitest)(?:\s+run)?(?:\s+[-./A-Za-z0-9_*:=,@]+)*|npm\s+run\s+[A-Za-z0-9:_-]+|node\s+[-./A-Za-z0-9_]+\.js|python\s+-m\s+[A-Za-z0-9_.-]+(?:\s+[-./A-Za-z0-9_*:=,@]+)*)/giu;
  for (const block of blocks) {
    for (const match of block.normalizedText.matchAll(commandPattern)) {
      const command = normalizeText(match[1]);
      if (command) {
        commands.push({
          command,
          sourceSpan: block.sourceSpan,
          sourceDocumentHash: block.sourceDocumentHash,
        });
      }
    }
  }
  return commands;
}

function isExecutableValidationCommand(command: string): boolean {
  return /^(?:npx\s+)?(?:vitest|pytest)(?:\s+run)?\b|^npm\s+run\s+\S+|^node\s+\S+\.js\b|^python\s+-m\s+\S+/iu.test(
    command
  );
}

function commandReferencesTarget(command: string, targetRecords: TargetAuthorityRecord[]): boolean {
  const normalizedCommand = command.replace(/\\/g, '/').toLowerCase();
  const directTargetMatch = targetRecords.some((record) => {
    const normalizedTarget = record.path.replace(/\\/g, '/').toLowerCase();
    if (normalizedCommand.includes(normalizedTarget)) {
      return true;
    }
    const targetBase = path.basename(normalizedTarget);
    return targetBase.length > 3 && normalizedCommand.includes(targetBase);
  });
  if (directTargetMatch) {
    return true;
  }
  const targetDomains = new Set<string>();
  for (const record of targetRecords) {
    const normalized = record.path.replace(/\\/g, '/').toLowerCase();
    if (normalized.includes('multi_timeframe') || normalized.includes('multi-timeframe')) {
      targetDomains.add('multi_timeframe');
    }
  }
  if (targetDomains.has('multi_timeframe') && /multi[_-]?timeframe/iu.test(normalizedCommand)) {
    return true;
  }
  return false;
}

function extractCommandFileRefs(command: string): string[] {
  return extractPathLikeTokens(command)
    .filter((token) => !/^(?:https?:|mailto:)/iu.test(token))
    .map((token) => token.replace(/\\/g, '/'));
}

function validationTargetRecordsForCommandRefs(input: {
  commandFileRefs: string[];
  existingRecords: TargetAuthorityRecord[];
  sourceDocumentHash: string;
  validationRecordIndex: number;
}): TargetAuthorityRecord[] {
  const existing = new Set(input.existingRecords.map((record) => record.path.replace(/\\/g, '/')));
  const records: TargetAuthorityRecord[] = [];
  for (const commandFileRef of input.commandFileRefs) {
    if (existing.has(commandFileRef)) {
      continue;
    }
    records.push({
      id: `TARGET-AUTH-CMD-${requirementOrdinal(input.validationRecordIndex)}-${requirementOrdinal(records.length)}`,
      path: commandFileRef,
      pathKind: pathKindForTarget(commandFileRef),
      source: 'explicit_option',
      sourceSpan: null,
      sourceDocumentHash: input.sourceDocumentHash,
      confidence: 1,
      reason: 'Validation command references this file; it is tracked as validation-only target coverage.',
      explicit: true,
    });
    existing.add(commandFileRef);
  }
  return records;
}

function buildValidationAuthority(input: {
  root: string;
  sourceText: string;
  blocks: StructuredSourceBlock[];
  explicitCommands: string[];
  targetRecords: TargetAuthorityRecord[];
}): {
  accepted: ValidationAuthorityRecord[];
  acceptedTargetRecords: TargetAuthorityRecord[];
  rejected: Array<Record<string, unknown>>;
  issues: PreConfirmationDrilldownIssue[];
} {
  const sourceDocumentHash = sha256Text(input.sourceText);
  const sourceCommands = extractValidationCommandCandidates(input.blocks);
  const explicit = input.explicitCommands.map((command): {
    command: string;
    sourceSpan: { startLine: number; endLine: number } | null;
    sourceDocumentHash: string;
    source: 'explicit_option' | 'source_document';
  } => ({
    command,
    sourceSpan: null,
    sourceDocumentHash,
    source: 'explicit_option',
  }));
  const sourceDerived = sourceCommands.map((command) => ({
    ...command,
    source: 'source_document' as const,
  }));
  const rejected: Array<Record<string, unknown>> = [];
  const accepted: ValidationAuthorityRecord[] = [];
  const acceptedTargetRecords = [...input.targetRecords];
  const explicitCommandCount = explicit.length;
  for (const candidate of [...explicit, ...sourceDerived]) {
    if (candidate.source === 'source_document' && explicitCommandCount > 0 && accepted.length === 0) {
      rejected.push({
        ...candidate,
        reason: 'source_validation_command_not_used_after_explicit_command_rejection',
      });
      continue;
    }
    const executable = isExecutableValidationCommand(candidate.command);
    const targetLinked =
      input.targetRecords.length === 0 || commandReferencesTarget(candidate.command, input.targetRecords);
    const commandFileRefs = extractCommandFileRefs(candidate.command);
    const escapingCommandRefs = commandFileRefs.filter((commandFileRef) =>
      pathEscapesProjectRoot(input.root, commandFileRef)
    );
    if (!executable) {
      rejected.push({ ...candidate, reason: 'non_executable_validation_command' });
      continue;
    }
    if (escapingCommandRefs.length > 0) {
      rejected.push({
        ...candidate,
        reason: 'validation_command_file_ref_outside_project_root',
        escapingCommandRefs,
      });
      continue;
    }
    if (!targetLinked) {
      rejected.push({ ...candidate, reason: 'validation_command_not_linked_to_target_path' });
      continue;
    }
    const commandTargetRecords = validationTargetRecordsForCommandRefs({
      commandFileRefs,
      existingRecords: acceptedTargetRecords,
      sourceDocumentHash,
      validationRecordIndex: accepted.length,
    });
    acceptedTargetRecords.push(...commandTargetRecords);
    accepted.push({
      id: `CMD-AUTH-${requirementOrdinal(accepted.length)}`,
      command: candidate.command,
      workingDirectory: input.root,
      source: candidate.source,
      sourceSpan: candidate.sourceSpan,
      sourceDocumentHash: candidate.sourceDocumentHash,
      targetPathRefs: [...input.targetRecords, ...commandTargetRecords].map((record) => record.id),
      commandFileRefs,
      executable: true,
      derivationReason:
        candidate.source === 'explicit_option'
          ? 'Provided by --required-command and linked to target authority.'
          : 'Source document declares an executable validation command linked to target authority.',
      blocksSourceMutationWhenMissing: true,
    });
  }
  const issues =
    accepted.length === 0
      ? [
          preConfirmationIssue(
            'validation_authority_missing',
            'No executable validation command authority was found; source materialization is blocked.',
            ['--required-command', 'validation-authority-report.json'],
            'validation_authority'
          ),
        ]
      : [];
  return { accepted, acceptedTargetRecords, rejected, issues };
}

function writeAuthorityReports(input: {
  paths: PreConfirmationPaths;
  root: string;
  sourcePath: string;
  sourceText: string;
  targetAuthority: { accepted: TargetAuthorityRecord[]; rejected: Array<Record<string, unknown>>; issues: PreConfirmationDrilldownIssue[] };
  validationAuthority: { accepted: ValidationAuthorityRecord[]; rejected: Array<Record<string, unknown>>; issues: PreConfirmationDrilldownIssue[] };
}): void {
  const base = {
    sourcePath: toRootRelativePath(input.root, input.sourcePath),
    sourceDocumentHash: sha256Text(input.sourceText),
  };
  writeJsonUtf8(input.paths.targetAuthorityReport, {
    schemaVersion: 'requirements-authoring-target-authority/v1',
    ...base,
    decision: input.targetAuthority.issues.length > 0 ? 'block' : 'pass',
    acceptedCount: input.targetAuthority.accepted.length,
    rejectedCount: input.targetAuthority.rejected.length,
    accepted: input.targetAuthority.accepted,
    rejected: input.targetAuthority.rejected,
    blockingIssues: input.targetAuthority.issues,
  });
  writeJsonUtf8(input.paths.validationAuthorityReport, {
    schemaVersion: 'requirements-authoring-validation-authority/v1',
    ...base,
    decision: input.validationAuthority.issues.length > 0 ? 'block' : 'pass',
    acceptedCount: input.validationAuthority.accepted.length,
    rejectedCount: input.validationAuthority.rejected.length,
    accepted: input.validationAuthority.accepted,
    rejected: input.validationAuthority.rejected,
    blockingIssues: input.validationAuthority.issues,
  });
}

function projectionDomainSanityCheck(input: {
  root: string;
  sourcePath: string;
  sourceText: string;
  targetRecords: TargetAuthorityRecord[];
  validationRecords: ValidationAuthorityRecord[];
}): { report: Record<string, unknown>; issues: PreConfirmationDrilldownIssue[] } {
  const sourceRel = toRootRelativePath(input.root, input.sourcePath);
  const sourceHintsConsumer =
    /(?:vnpy|multi[_-]?timeframe|chart|trader|widget|settings|consumer|产品|界面|主图|设置)/iu.test(
      input.sourceText
    );
  const offendingTargets = input.targetRecords
    .map((record) => record.path)
    .filter((targetPath) => /(?:^|\/)scripts\/main-agent-|(?:^|\/)tests\/acceptance\/main-agent-/iu.test(targetPath));
  const offendingCommands = input.validationRecords
    .map((record) => record.command)
    .filter((command) => /tests\/acceptance\/main-agent-|scripts\/main-agent-orchestration/iu.test(command));
  const issues =
    sourceHintsConsumer && (offendingTargets.length > 0 || offendingCommands.length > 0)
      ? [
          preConfirmationIssue(
            'projection_domain_mismatch',
            'Consumer/product source cannot project to BMAD-Speckit main-agent governance paths without explicit source authority.',
            [sourceRel, ...offendingTargets, ...offendingCommands],
            'projection_domain_sanity'
          ),
        ]
      : [];
  const report = {
    schemaVersion: 'requirements-authoring-projection-domain-sanity/v1',
    sourcePath: sourceRel,
    sourceDocumentHash: sha256Text(input.sourceText),
    sourceHintsConsumer,
    offendingTargets,
    offendingCommands,
    decision: issues.length > 0 ? 'block' : 'pass',
    blockingIssues: issues,
  };
  return { report, issues };
}

function writeSourceMutationDecision(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  requirementSetId: string;
  createdAt: string;
  sourceDocumentExistedBefore?: boolean;
  sourceHashBefore: string;
  sourceHashAfter?: string | null;
  targetRawHashBefore?: string | null;
  targetRawHashAfter?: string | null;
  semanticSourceHashBefore?: string | null;
  semanticSourceHashAfter?: string | null;
  issues: PreConfirmationDrilldownIssue[];
  coverageDecision: string;
  targetAuthorityDecision: string;
  validationAuthorityDecision: string;
  projectionSanityDecision: string;
  auditEvidenceDecision: string;
  scaleRoutingDecision: string;
  userConfirmationDecision?: string;
  reverseAuditDraftValidationDecision?: string;
  sourceMutationPerformed?: boolean;
}): SourceMutationDecision {
  const allowed = input.issues.length === 0;
  const blockedIssueCodes = input.issues.map((issue) => issue.code);
  const decision: SourceMutationDecision = {
    schemaVersion: 'requirements-authoring-source-mutation-decision/v1',
    sourcePath: toRootRelativePath(input.root, input.sourcePath),
    sourceDocumentExistedBefore:
      input.sourceDocumentExistedBefore ?? fs.existsSync(input.sourcePath),
    sourceDocumentHashBefore: input.sourceHashBefore,
    sourceDocumentHashAfter: input.sourceHashAfter ?? input.sourceHashBefore,
    targetRawHashBefore: input.targetRawHashBefore ?? input.sourceHashBefore,
    targetRawHashAfter:
      input.targetRawHashAfter ?? input.sourceHashAfter ?? input.sourceHashBefore,
    semanticSourceHashBefore: input.semanticSourceHashBefore ?? input.sourceHashBefore,
    semanticSourceHashAfter:
      input.semanticSourceHashAfter ?? input.sourceHashAfter ?? input.sourceHashBefore,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    attemptId: sha256Json({
      recordId: input.recordId,
      requirementSetId: input.requirementSetId,
      sourceHashBefore: input.sourceHashBefore,
      createdAt: input.createdAt,
    }),
    createdAt: input.createdAt,
    sourceMutationAllowed: allowed,
    sourceMutationPerformed: input.sourceMutationPerformed === true,
    blockedIssueCodes,
    coverageDecision: input.coverageDecision,
    targetAuthorityDecision: input.targetAuthorityDecision,
    validationAuthorityDecision: input.validationAuthorityDecision,
    projectionSanityDecision: input.projectionSanityDecision,
    auditEvidenceDecision: input.auditEvidenceDecision,
    scaleRoutingDecision: input.scaleRoutingDecision,
    userConfirmationDecision:
      input.userConfirmationDecision ??
      (blockedIssueCodes.includes('user_confirmation_missing')
        ? 'block_user_confirmation_missing'
        : 'draft_only_user_confirmation_not_allowed'),
    reverseAuditDraftValidationDecision:
      input.reverseAuditDraftValidationDecision ?? 'not_run_before_pre_write_gate',
    finalDecision: allowed ? 'allow_source_materialization' : 'block_source_materialization',
  };
  writeJsonUtf8(input.paths.sourceMutationDecision, decision);
  return decision;
}

function buildControlledMustCandidatesFromPlainSource(
  root: string,
  sourcePath: string,
  sourceText: string
): ControlledMustCandidate[] {
  const sourceDocumentHash = sha256Text(sourceText);
  const sourceRel = toRootRelativePath(root, sourcePath);
  return extractStructuredSourceBlocks(root, sourcePath, sourceText)
    .filter((block) => block.decision === 'mapped_to_must')
    .map((block, index) => ({
      candidateId: `MUST-CAND-${requirementOrdinal(index)}`,
      sourcePath: sourceRel,
      sourceHash: sourceDocumentHash,
      sourceDocumentHash,
      sourceSpan: block.sourceSpan,
      headingPath: block.headingPath,
      blockId: block.blockId,
      blockKind: block.blockKind,
      requirementType: 'positive',
      coverageDecision: block.decision,
      coverageReason: block.requirementSignal.join(', ') || 'structured_source_block',
      confidence: block.requirementSignal.includes('mandatory_language') ? 0.95 : 0.8,
      tableContext: block.tableContext ?? null,
      groupId: block.headingPath.join(' > ') || 'root',
      originalText: block.rawText,
      normalizedRequirement: block.normalizedText,
      decision: 'accepted_for_draft',
      decisionReason:
        'Structured source block is requirement-bearing and maps to a controlled draft MUST candidate.',
      requiresHumanReview: true,
    }));
}

function mustRequirementsFromControlledCandidates(
  requirementSetId: string,
  candidates: ControlledMustCandidate[]
): SourceMustRequirement[] {
  const stablePrefix = sanitizeRequirementIdSegment(requirementSetId)
    .replace(/[^A-Z0-9]+/giu, '-')
    .replace(/^-|-$/gu, '')
    .toUpperCase()
    .slice(0, 24)
    .replace(/^-|-$/gu, '');
  return candidates
    .filter((candidate) => candidate.decision === 'accepted_for_draft')
    .map((candidate, index) => ({
      id: `MUST-${stablePrefix ? `${stablePrefix}-` : ''}L${candidate.sourceSpan.startLine}-${requirementOrdinal(index)}`,
      text: candidate.normalizedRequirement,
      source: 'controlled_plain_source_candidate' as const,
      sourceLine: candidate.sourceSpan.startLine,
      sourcePath: candidate.sourcePath,
      sourceDocumentHash: candidate.sourceDocumentHash,
      sourceSpan: candidate.sourceSpan,
      headingPath: candidate.headingPath,
      candidateId: candidate.candidateId,
    }));
}

function sourceBlockRequirementId(block: StructuredSourceBlock): string | null {
  const heading = block.headingPath.at(-1) ?? '';
  const match = heading.match(/\b((?:FR|NFR|ACC)-\d+)\b/iu);
  return match ? match[1].toUpperCase() : null;
}

function businessSourceBlockId(block: StructuredSourceBlock, index: number): string {
  const explicit = sourceBlockRequirementId(block);
  if (explicit) {
    return explicit;
  }
  const heading = block.headingPath.join(' > ');
  if (/(?:默认|default)/iu.test(heading)) {
    return `DEFAULT-${requirementOrdinal(index)}`;
  }
  if (/(?:验收|acceptance)/iu.test(heading)) {
    return `ACCEPTANCE-${requirementOrdinal(index)}`;
  }
  if (headingImpliesNonGoal(block.headingPath)) {
    return `NON-GOAL-${requirementOrdinal(index)}`;
  }
  return `BUSINESS-${requirementOrdinal(index)}`;
}

function buildBusinessRequirementRows(input: {
  mustRequirements: SourceMustRequirement[];
  blocks: StructuredSourceBlock[];
  packetHash: string;
}): Record<string, unknown>[] {
  const rows = input.mustRequirements
    .map((requirement) => {
      const heading = requirement.headingPath?.at(-1) ?? '';
      const match = heading.match(/\b((?:FR|NFR|ACC)-\d+)\b/iu);
      if (!match) {
        return null;
      }
      const requirementId = match[1].toUpperCase();
      return {
        id: `BUS-${requirementId}`,
        requirementId,
        mustRef: requirement.id,
        title: heading,
        text: requirement.text,
        sourcePath: requirement.sourcePath,
        sourceSpan: requirement.sourceSpan,
        sourceDocumentHash: requirement.sourceDocumentHash,
        headingPath: requirement.headingPath,
        covers: [requirement.id],
        ...projectionBackRef(input.packetHash, requirement.id),
      };
    })
    .filter((row): row is Record<string, unknown> => Boolean(row));
  const existing = new Set(rows.map((row) => normalizeText(row.requirementId)));
  for (const block of input.blocks) {
    if (
      ![
        'mapped_to_must',
        'mapped_to_non_goal',
        'mapped_to_target_authority',
        'mapped_to_validation_authority',
      ].includes(block.decision)
    ) {
      continue;
    }
    const requirementId = businessSourceBlockId(block, rows.length);
    if (existing.has(requirementId)) {
      continue;
    }
    existing.add(requirementId);
    rows.push({
      id: `BUS-${requirementId}`,
      requirementId,
      title: block.headingPath.at(-1) ?? block.blockId,
      text: block.normalizedText,
      sourcePath: block.sourcePath,
      sourceSpan: block.sourceSpan,
      sourceDocumentHash: block.sourceDocumentHash,
      headingPath: block.headingPath,
      sourceBlockId: block.blockId,
      coverageDecision: block.decision,
      covers: [],
      derivedFromMustRef: null,
      derivedFromPacketHash: input.packetHash,
      projectionStatus: 'synchronized',
    });
  }
  return rows;
}

function buildOutOfScopeRows(input: {
  blocks: StructuredSourceBlock[];
  packetHash: string;
}): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const block of input.blocks) {
    if (block.decision !== 'mapped_to_non_goal') {
      continue;
    }
    rows.push({
      id: `OUT-${requirementOrdinal(rows.length)}`,
      text: block.normalizedText,
      scopeBoundary: block.headingPath.join(' > ') || 'source non-goal',
      sourcePath: block.sourcePath,
      sourceSpan: block.sourceSpan,
      sourceDocumentHash: block.sourceDocumentHash,
      headingPath: block.headingPath,
      userApprovalRequiredIfChanged: true,
      derivedFromMustRef: sourceBlockRequirementId(block) ?? null,
      derivedFromPacketHash: input.packetHash,
      projectionStatus: 'synchronized',
    });
  }
  return rows;
}

function writeControlledMustCandidateArtifacts(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  requirementSetId: string;
  createdAt: string;
  sourceText: string;
  candidates: ControlledMustCandidate[];
  mustRequirements: SourceMustRequirement[];
  draftConfirmation?: Record<string, unknown> | null;
  decision: 'draft_materialization_allowed' | 'controlled_must_candidates_missing';
}): void {
  const sourceDocumentHash = sha256Text(input.sourceText);
  const acceptedCandidates = input.candidates.filter(
    (candidate) => candidate.decision === 'accepted_for_draft'
  );
  const base = {
    sourcePath: toRootRelativePath(input.root, input.sourcePath),
    sourceDocumentHash,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    createdAt: input.createdAt,
  };
  writeJsonUtf8(input.paths.controlledMustCandidates, {
    schemaVersion: 'requirements-authoring-controlled-must-candidates/v1',
    ...base,
    sourceHash: sourceDocumentHash,
    candidateCount: input.candidates.length,
    acceptedCandidateCount: acceptedCandidates.length,
    mustCount: input.mustRequirements.length,
    failClosed: input.decision === 'controlled_must_candidates_missing',
    candidates: input.candidates,
    decision: input.decision,
  });
  writeJsonUtf8(input.paths.draftImplementationConfirmation, {
    schemaVersion: 'requirements-authoring-draft-implementation-confirmation/v1',
    ...base,
    status: 'draft',
    candidateCount: input.candidates.length,
    acceptedCandidateCount: acceptedCandidates.length,
    mustCount: input.mustRequirements.length,
    failClosed: input.decision === 'controlled_must_candidates_missing',
    mustRequirements: input.mustRequirements,
    implementationConfirmation: input.draftConfirmation ?? null,
    decision: input.decision,
  });
  writeJsonUtf8(input.paths.authoringMaterializationReceipt, {
    schemaVersion: 'requirements-authoring-materialization-receipt/v1',
    ...base,
    candidateArtifactPath: toRootRelativePath(input.root, input.paths.controlledMustCandidates),
    draftImplementationConfirmationPath: toRootRelativePath(
      input.root,
      input.paths.draftImplementationConfirmation
    ),
    candidateCount: input.candidates.length,
    acceptedCandidateCount: acceptedCandidates.length,
    mustCount: input.mustRequirements.length,
    failClosed: input.decision === 'controlled_must_candidates_missing',
    decision: input.decision,
    requiresUserConfirmationBeforeExecution: true,
    receiptHash: sha256Json({
      ...base,
      candidateCount: input.candidates.length,
      acceptedCandidateCount: acceptedCandidates.length,
      mustCount: input.mustRequirements.length,
      decision: input.decision,
    }),
  });
}

function buildPreConfirmationImplementationConfirmation(input: {
  root: string;
  sourcePath: string;
  recordId: string;
  requirementSetId: string;
  language: string | null;
  paths: PreConfirmationPaths;
  packetHash: string;
  semanticKernelHash: string;
  latestReceiptHash: string;
  mustRequirements: SourceMustRequirement[];
  structuredBlocks?: StructuredSourceBlock[];
  targetAuthorityRecords?: TargetAuthorityRecord[];
  validationAuthorityRecords?: ValidationAuthorityRecord[];
  consecutiveNoNewGapRounds?: number;
  auditConvergenceVerdict?: 'audit_not_run' | 'bounded_no_new_gap' | 'blocked';
}): Record<string, unknown> {
  const rel = (filePath: string) => toRootRelativePath(input.root, filePath);
  const backRef = projectionBackRef(input.packetHash);
  const mustRefs = input.mustRequirements.map((requirement) => requirement.id);
  const mustTexts = input.mustRequirements.map((requirement) => requirement.text);
  const structuredBlocks = input.structuredBlocks ?? [];
  const businessRows = buildBusinessRequirementRows({
    mustRequirements: input.mustRequirements,
    blocks: structuredBlocks,
    packetHash: input.packetHash,
  });
  const sourceOutOfScopeRows = buildOutOfScopeRows({
    blocks: structuredBlocks,
    packetHash: input.packetHash,
  });
  const outOfScopeRows =
    sourceOutOfScopeRows.length > 0
      ? sourceOutOfScopeRows
      : [
          {
            id: 'OUT-001',
            text: 'Forbidden: creating an additional mental model or a separate controller authority.',
            textZh: '禁止新增第七个心智模型，也禁止新增独立主控权威。',
            scopeBoundary: 'Main Agent keeps the lane under the first mental model.',
            scopeBoundaryZh: '主 Agent 将该 lane 保持在第一个心智模型内。',
            userApprovalRequiredIfChanged: true,
          },
        ];
  const businessRequirementIds = businessRows
    .map((row) => normalizeText(row.requirementId))
    .filter(Boolean);
  const businessViewCoverRefs = [
    ...new Set(
      businessRows
        .flatMap((row) => asStringArray(row.covers))
        .filter((ref) => mustRefs.includes(ref))
    ),
  ];
  const businessDiagramCoverRefs =
    businessViewCoverRefs.length > 0 ? businessViewCoverRefs : mustRefs;
  const businessSequenceViews =
    businessRequirementIds.length > 0
      ? [
          {
            id: 'SEQ-BUSINESS-001',
            title: 'Source-derived business requirement scenario',
            scope: 'business',
            covers: businessDiagramCoverRefs,
            mermaid: `sequenceDiagram\n  participant U as User\n  participant S as System\n  U->>S: source-derived product behavior request [${businessRequirementIds.join(', ')}]\n  S-->>U: contract-visible behavior confirmation [${businessDiagramCoverRefs.join(', ')}]`,
          },
        ]
      : [];
  const businessFlowViews =
    businessRequirementIds.length > 0
      ? [
          {
            id: 'FLOW-BUSINESS-001',
            title: 'Source-derived product behavior flow',
            scope: 'business',
            covers: businessDiagramCoverRefs,
            mermaid: `flowchart TD\n  A[Source business requirements ${businessRequirementIds.join(' + ')}] --> B[Business scenario view]\n  B --> C[Contract semantic rows ${businessDiagramCoverRefs.join(' + ')}]`,
          },
        ]
      : [];
  const targetAuthorityRecords = input.targetAuthorityRecords ?? [];
  const validationAuthorityRecords = input.validationAuthorityRecords ?? [];
  const acceptanceTestFile =
    validationAuthorityRecords
      .flatMap((record) => record.commandFileRefs)
      .find((fileRef) => /(?:^|\/)tests?\//iu.test(fileRef.replace(/\\/g, '/'))) ??
    validationAuthorityRecords
      .map((record) => extractCommandFileRefs(record.command))
      .flat()
      .find((fileRef) => /(?:^|\/)tests?\//iu.test(fileRef.replace(/\\/g, '/'))) ??
    'source_authorized_validation_command';
  const targetPathRows = [
    ...targetAuthorityRecords.map((record, index) => ({
      id: `TARGET-MOD-${requirementOrdinal(index)}`,
      path: record.path,
      changeType: record.pathKind === 'test' ? 'validation_only' : 'modify',
      coverageRole: record.pathKind === 'test' ? 'validation_only' : 'modify',
      intent: `Modify source-authorized target path ${record.path}.`,
      ownerModel: 'implementation_target',
      requirementRefs: mustRefs,
      traceRefs: ['TRACE-001'],
      evidenceRefs: ['EVD-001'],
      artifactRefs: [],
      authorityRef: record.id,
      source: record.source,
      sourceSpan: record.sourceSpan,
      requiresReconfirmationOnChange: true,
      ...backRef,
    })),
    {
      id: `TARGET-MOD-${requirementOrdinal(targetAuthorityRecords.length)}`,
      path: rel(input.paths.preRenderMustGate),
      changeType: 'generated_output',
      coverageRole: 'generated_output',
      intent: 'Generated pre-render drilldown gate report.',
      ownerModel: 'requirement_confirmation',
      requirementRefs: mustRefs,
      traceRefs: ['TRACE-001'],
      evidenceRefs: ['EVD-001'],
      artifactRefs: ['ART-001'],
      requiresReconfirmationOnChange: false,
      ...backRef,
    },
    {
      id: `TARGET-MOD-${requirementOrdinal(targetAuthorityRecords.length + 1)}`,
      path: rel(input.paths.confirmationHtml),
      changeType: 'generated_output',
      coverageRole: 'generated_output',
      intent: 'Generated confirmation HTML projection.',
      ownerModel: 'requirement_confirmation',
      requirementRefs: mustRefs,
      traceRefs: ['TRACE-001'],
      evidenceRefs: ['EVD-001'],
      artifactRefs: ['ART-002'],
      requiresReconfirmationOnChange: false,
      ...backRef,
    },
  ];
  const commandRows = validationAuthorityRecords.map((record, index) => ({
    id: `CMD-${requirementOrdinal(index)}`,
    command: record.command,
    purpose: 'Validate source-authorized target behavior.',
    targetFiles: targetAuthorityRecords.map((target) => target.path),
    traceRows: ['TRACE-001'],
    evidenceRefs: ['EVD-001'],
    authorityRef: record.id,
    source: record.source,
    sourceSpan: record.sourceSpan,
    ...backRef,
  }));
  const mustRows = input.mustRequirements.map((requirement) => ({
    id: requirement.id,
    text: requirement.text,
    ...(requirement.textZh ? { textZh: requirement.textZh } : {}),
    source: requirement.source,
    sourceLine: requirement.sourceLine,
    ...(requirement.sourcePath ? { sourcePath: requirement.sourcePath } : {}),
    ...(requirement.sourceDocumentHash
      ? { sourceDocumentHash: requirement.sourceDocumentHash }
      : {}),
    ...(requirement.sourceSpan ? { sourceSpan: requirement.sourceSpan } : {}),
    ...(requirement.headingPath ? { headingPath: requirement.headingPath } : {}),
    ...(requirement.candidateId ? { candidateId: requirement.candidateId } : {}),
    evidenceRefs: ['EVD-001'],
    coveredByTraceRows: ['TRACE-001'],
    coveredBySequenceViews: ['SEQ-001'],
    ...projectionBackRef(input.packetHash, requirement.id),
  }));
  const matrixRows = input.mustRequirements.map((requirement, index) => {
    const taskIds = atomicTaskIdsForMust(index, input.mustRequirements.length);
    return {
      id: mdmIdForMust(index, input.mustRequirements.length),
      mustRef: requirement.id,
      atomicTaskRefs: taskIds,
      ...projectionBackRef(input.packetHash, requirement.id),
    };
  });
  const taskRows = input.mustRequirements.flatMap((requirement, index) => {
    const [authorTaskId, materializeTaskId] = atomicTaskIdsForMust(
      index,
      input.mustRequirements.length
    );
    const taskBackRef = projectionBackRef(input.packetHash, requirement.id);
    return [
      {
        id: authorTaskId,
        text: `Author semantic kernel and packet decomposition for ${requirement.id}: ${requirement.text}`,
        targetFiles: [rel(input.paths.semanticKernel), rel(input.paths.mustDecompositionPacket)],
        acceptanceRefs: ['ACC-001'],
        redProofPlan: `Gate fails if ${requirement.id} is missing from semantic kernel or must_decomposition_packet.`,
        primaryObservableBehaviors: [`${requirement.id} appears in semantic kernel and packet`],
        primaryAcceptanceOracles: [`${requirement.id} has a synchronized mustPackets row`],
        ...taskBackRef,
      },
      {
        id: materializeTaskId,
        text: `Materialize packet-backed source projections for ${requirement.id}: ${requirement.text}`,
        targetFiles: [rel(input.sourcePath), rel(input.paths.confirmationHtml)],
        acceptanceRefs: ['E2E-001'],
        redProofPlan: `Renderer blocks if ${requirement.id} lacks packet-backed trace, evidence, view, and acceptance coverage.`,
        primaryObservableBehaviors: [`${requirement.id} source projection is rendered`],
        primaryAcceptanceOracles: [`${requirement.id} passes renderer coverage checks`],
        ...taskBackRef,
      },
    ];
  });
  return {
    contractSchemaVersion: 1,
    status: 'draft',
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
    confirmationLanguage: input.language ?? 'not_selected',
    confirmationProfile: 'implementation_confirmation',
    requiredViewPacks: ['currentTargetMap'],
    optionalViewPacks: [],
    confirmedAt: null,
    confirmedBy: null,
    sourceDocumentHash: null,
    confirmationRender: {
      htmlPath: rel(input.paths.confirmationHtml),
      summaryPath: rel(input.paths.confirmationSummary),
      reportPath: rel(input.paths.confirmationRenderReport),
      htmlHash: null,
      confirmationPhrase: null,
    },
    preConfirmationDrilldown: {
      semanticKernelRef: { path: rel(input.paths.semanticKernel), hash: input.semanticKernelHash },
      mustDecompositionPacketRef: {
        path: rel(input.paths.mustDecompositionPacket),
        hash: input.packetHash,
        status: 'synchronized',
      },
      criticalAuditor: {
        minimumRounds: 3,
        consecutiveNoNewGapRounds: input.consecutiveNoNewGapRounds ?? 0,
        latestReceiptHash: input.latestReceiptHash,
        convergenceVerdict: input.auditConvergenceVerdict ?? 'audit_not_run',
      },
      packetSourceReconciliation: {
        reportPath: rel(input.paths.reconciliationReport),
        verdict: 'pass',
      },
      preRenderGateReportPath: rel(input.paths.preRenderMustGate),
      globalConsistencyReportPath: rel(input.paths.preRenderGlobalConsistency),
    },
    applicability: {
      governanceEvents: {
        applies: false,
        reasonCode: 'no_governance_event_or_control_envelope_changes',
      },
      runtimeRecovery: {
        applies: false,
        reasonCode: 'no_resume_rerun_closeout_hook_ingest_or_trace_checkpoint_changes',
        requiresFunctionalResumeFailureCaseRegistry: false,
        activeRequirementResolutionRequired: false,
        retiredContextSurfaceForbidden: true,
      },
      scoringDashboardSft: {
        applies: false,
        reasonCode: 'no_scoring_dashboard_sft_dataset_or_read_model_changes',
      },
      currentTargetMap: {
        applies: true,
        reasonCode: 'pre_confirmation_drilldown_requires_current_target_map',
      },
      scriptsAndHooks: {
        applies: false,
        reasonCode: 'no_script_hook_report_or_generated_artifact_changes',
      },
      aiTddContractGate: {
        applies: true,
        reasonCode: 'pre_confirmation_drilldown_requires_ai_tdd_manifest_projection',
      },
    },
    governanceEventTypeRegistryPolicy: {
      controlFieldVocabulary: ['confirmationHistory'],
      payloadKindContracts: [
        {
          payloadKind: 'decision',
          requiredFields: ['eventType', 'decision'],
          forbiddenFields: ['result'],
          allowedControlWriteModes: ['control'],
        },
      ],
      controlWriteModePolicies: [
        {
          allowedControlWriteMode: 'control',
          allowedWritesControlFields: ['confirmationHistory'],
        },
      ],
      eventSpecificRequirements: [],
    },
    must: mustRows,
    notDone: [
      {
        id: 'NEG-001',
        text: 'The atomic decomposition packet and renderer confirmability must not be treated as implementation completion or delivery readiness.',
        textZh: '原子拆解 packet 和 renderer 可确认状态不得被当作实现完成或交付就绪。',
        evidenceRefs: ['EVD-001'],
        whyItBlocksCompletion:
          'Confirmation scope quality is separate from implementation completion evidence.',
        whyItBlocksCompletionZh: '需求范围确认质量与实现完成证据是不同层级。',
        negativeAssertionRequired: true,
        coveredByFailurePath: ['FAIL-001'],
        ...backRef,
      },
    ],
    mustNot: outOfScopeRows,
    outOfScope: outOfScopeRows,
    mustExecutionDecompositionMatrix: matrixRows,
    atomicImplementationTaskList: taskRows,
    evidence: [
      {
        id: 'EVD-001',
        text: `Gate and renderer reports prove the source-derived requirements are user-confirmable but not delivery ready: ${mustTexts.join(' | ')}`,
        textZh: '门禁和渲染报告证明需求确认 lane 可由用户确认，但不代表交付就绪。',
        gate: 'main-agent-orchestration --action pre-confirmation-drilldown',
        oracle:
          'All drilldown artifacts, bidirectional reconciliation, pre-render gates, and renderer confirmability pass while deliveryReadiness.ready remains false before controlled ingest.',
        oracleZh:
          '所有 drilldown 产物、双向 reconciliation、预渲染门禁和 renderer 可确认性通过，同时 controlled ingest 前 deliveryReadiness.ready 保持 false。',
        requiredCommandRefs: ['CMD-001'],
        artifactRefs: ['ART-001', 'ART-002'],
        acceptanceType: 'acceptance_e2e',
        ...backRef,
      },
    ],
    openQuestions: [],
    failurePaths: [
      {
        id: 'FAIL-001',
        title: 'Missing drilldown surfaces block confirmation.',
        titleZh: '缺少 drilldown 确认面会阻断确认。',
        trigger:
          'Semantic kernel, packet, receipts, reconciliation, pre-render gate report, or renderer drilldown section is missing.',
        triggerZh:
          '缺少 semantic kernel、packet、receipt、reconciliation、预渲染门禁报告或 renderer drilldown 区块。',
        expectedBehavior:
          'Fail closed and keep currentMentalModel=requirement_confirmation; external side effects must define timeout handling, failure handling, idempotency, recovery or rollback, and assertion evidence before confirmation.',
        expectedBehaviorZh:
          '必须 fail closed，并保持 currentMentalModel=requirement_confirmation。',
        forbiddenBehavior:
          'Advance to architecture_confirmation, delivery readiness, or persistent external side effects without timeout, failure, idempotency, recovery, rollback, and assertion semantics.',
        forbiddenBehaviorZh: '不得推进到 architecture_confirmation，也不得进入交付就绪。',
        blocksCompletionWhenViolated: true,
        linkedNegIds: ['NEG-001'],
        linkedEvidenceIds: ['EVD-001'],
        traceRows: ['TRACE-001'],
        viewRefs: ['EDGEVIEW-001'],
        requiredAssertions: [
          'confirmability is blocked when drilldown surfaces are missing',
          'external side effects include timeout, failure, idempotency, recovery or rollback, and assertion evidence',
        ],
        ...backRef,
      },
    ],
    edgeCases: [
      {
        id: 'EDGE-001',
        category: 'missing_projection',
        condition: 'A source row is invented outside synchronized packet projections.',
        conditionZh: 'source row 在 synchronized packet projection 之外被独立发明。',
        expectedBehavior:
          'Packet/source reconciliation fails bidirectionally; side-effecting rows must include timeout, failure, idempotency, recovery or rollback, and assertion evidence.',
        expectedBehaviorZh: 'packet/source reconciliation 必须双向失败。',
        forbiddenBehavior:
          'Renderer allows confirmation from independently invented source rows or side-effecting rows without timeout, failure, idempotency, recovery, rollback, and assertion semantics.',
        forbiddenBehaviorZh: 'renderer 不得允许由独立发明的 source row 进入确认。',
        linkedFailurePathIds: ['FAIL-001'],
        linkedEvidenceIds: ['EVD-001'],
        traceRows: ['TRACE-001'],
        viewRefs: ['EDGEVIEW-001'],
        ...backRef,
      },
    ],
    traceRows: [
      {
        id: 'TRACE-001',
        covers: [...mustRefs, 'NEG-001'],
        sourceRequirementTexts: mustTexts,
        taskRefs: taskRows.map((task) => task.id),
        evidenceRefs: ['EVD-001'],
        contractValidationCommandRefs: ['CMD-001'],
        deliveryEvidenceCommandRefs: ['CMD-001'],
        acceptanceRefs: ['ACC-001', 'E2E-001'],
        sequenceViewRefs: ['SEQ-001'],
        boundaryViewRefs: ['BOUND-001'],
        artifactRefs: ['ART-001', 'ART-002'],
        status: 'PENDING',
        ...backRef,
      },
    ],
    acceptanceTests: [
      {
        id: 'ACC-001',
        file: acceptanceTestFile,
        covers: mustRefs,
        sourceRequirementTexts: mustTexts,
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001'],
        failurePathRefs: ['FAIL-001'],
        edgeCaseRefs: ['EDGE-001'],
        expectedPreImplementationState: 'expected_red',
        oracle:
          'Main Agent lane cannot reach user_confirmable unless atomic decomposition loop, three receipt rounds, reconciliation, gates, timeout, failure, idempotency, recovery or rollback, and assertion evidence pass.',
        positiveControl: true,
        negativeControls: ['NEG-001'],
        mockOnly: false,
        ...backRef,
      },
    ],
    acceptanceCriteria: [
      {
        id: 'ACC-001',
        covers: mustRefs,
        sourceRequirementTexts: mustTexts,
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001'],
        oracle:
          'Source-derived acceptance criteria must remain visible in the confirmation contract and linked to the validation command.',
        ...backRef,
      },
    ],
    e2eSuites: [
      {
        id: 'E2E-001',
        file: acceptanceTestFile,
        covers: ['NEG-001', ...mustRefs],
        sourceRequirementTexts: mustTexts,
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001'],
        failurePathRefs: ['FAIL-001'],
        edgeCaseRefs: ['EDGE-001'],
        expectedPreImplementationState: 'expected_red',
        oracle:
          'Before controlled ingest, the surface remains in requirement_confirmation and nextMentalModel is null.',
        positiveControl: true,
        negativeControls: ['NEG-001'],
        mockOnly: false,
        ...backRef,
      },
    ],
    e2eScenarios: [
      {
        id: 'E2E-001',
        covers: ['NEG-001', ...mustRefs],
        sourceRequirementTexts: mustTexts,
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001'],
        scenario:
          'Repository-local fixture authoring proves source-derived business requirements before source promotion.',
        ...backRef,
      },
    ],
    requirementBoundary: {
      business: {
        description:
          businessRequirementIds.length > 0
            ? 'Source-derived consumer product requirements are preserved for confirmation.'
            : 'No source-labeled consumer product behavior was found.',
        requirementIds: businessRequirementIds,
        viewRefs: [
          ...businessRows.map((row) => normalizeText(row.id)),
          ...businessSequenceViews.map((row) => row.id),
          ...businessFlowViews.map((row) => row.id),
        ],
        diagramRefs: [
          ...businessSequenceViews.map((row) => row.id),
          ...businessFlowViews.map((row) => row.id),
        ],
      },
      governance: {
        description: 'Requirement confirmation drilldown quality gate.',
        requirementIds: [...mustRefs, 'NEG-001'],
        viewRefs: ['SEQ-001', 'FLOW-001', 'EDGEVIEW-001', 'BOUND-001'],
        diagramRefs: ['SEQ-001', 'FLOW-001'],
      },
    },
    businessViews: businessRows,
    sequenceViews: [
      ...businessSequenceViews,
      {
        id: 'SEQ-001',
        title: 'Requirement confirmation drilldown lane',
        scope: 'governance',
        covers: [...mustRefs, 'NEG-001', 'EVD-001'],
        mermaid: `sequenceDiagram\n  participant M as MainAgent\n  participant G as Gates\n  participant U as User\n  M->>G: source-derived atomic drilldown before materialization [${mustRefs.join(', ')}]\n  G-->>M: PASS [EVD-001]\n  M-->>U: user_confirmable, not delivery ready [NEG-001]`,
      },
    ],
    flowViews: [
      ...businessFlowViews,
      {
        id: 'FLOW-001',
        title: 'Pre-confirmation lane state flow',
        scope: 'governance',
        covers: [...mustRefs, 'NEG-001'],
        mermaid: `flowchart TD\n  A[Source MUST atomic loop ${mustRefs.join(' + ')}] --> B[TRACE-001 synchronized projection]\n  B --> C[EVD-001 render confirmable]\n  C --> D[NEG-001 no delivery readiness]`,
      },
    ],
    edgeCaseViews: [
      {
        id: 'EDGEVIEW-001',
        title: 'Missing drilldown surfaces fail closed',
        scope: 'governance',
        covers: ['NEG-001'],
        cases: ['EDGE-001', 'FAIL-001'],
      },
    ],
    boundaryViews: [
      {
        id: 'BOUND-001',
        title: 'Mental model boundary',
        scope: 'governance',
        covers: ['OUT-001'],
      },
    ],
    currentTargetMap: {
      schemaVersion: 'current-target-map/v1',
      displayProfile: 'closed_loop_current_target_map',
      introduction: 'Pre-confirmation drilldown remains inside requirement_confirmation.',
      currentSummary: [
        {
          id: 'CT-CUR-001',
          title: 'Draft requirement',
          detail:
            'The source is not yet user confirmed and cannot enter architecture confirmation.',
        },
      ],
      targetSummary: [
        {
          id: 'CT-TGT-001',
          title: 'User-confirmable requirement',
          detail:
            'Semantic kernel, atomic packet, receipts, reconciliation, gates, and HTML are synchronized.',
        },
      ],
      diffRows: [
        {
          id: 'CT-DIFF-001',
          dimension: 'Mental model',
          currentState: 'requirement_confirmation draft',
          targetState: 'requirement_confirmation user_confirmable',
          action: 'run pre_confirmation_drilldown lane',
        },
        {
          id: 'CT-DIFF-002',
          dimension: 'Artifact source',
          currentState: 'free-form draft',
          targetState: 'packet-backed implementationConfirmation',
          action: 'materialize packet projections only',
        },
        {
          id: 'CT-DIFF-003',
          dimension: 'Progression',
          currentState: 'blocked before user confirmation',
          targetState: 'await exact phrase and hashes',
          action: 'require controlled ingest before architecture_confirmation',
        },
      ],
      process: [
        {
          id: 'CT-PROC-001',
          phase: 'Requirement confirmation',
          currentState: 'pre-confirmation quality unknown',
          targetState: 'user_confirmable with deliveryReadiness.ready=false',
        },
      ],
      artifactPaths: [
        {
          id: 'CT-ARTPATH-001',
          path: rel(input.paths.preRenderMustGate),
          targetRole: 'pre-render MUST decomposition gate report',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      canonicalArtifacts: [
        {
          id: 'CT-CANON-001',
          targetPathOrField: rel(input.paths.confirmationRenderReport),
          functionDescription: 'Renderer report for scope confirmability only.',
          controlPlaneRole: 'projection_not_delivery_proof',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
      existingArtifacts: [
        {
          id: 'CT-EXIST-001',
          currentPath: rel(input.sourcePath),
          currentFunction: 'Draft source document',
          targetTreatment: 'Materialized with packet-backed implementationConfirmation',
          completionProofPolicy: 'not_completion_proof',
          traceRows: ['TRACE-001'],
          evidenceRefs: ['EVD-001'],
        },
      ],
    },
    aiTddContractExecutionManifestProjection: {
      id: 'AI-TDD-001',
      currentTargetMap: { rows: ['CT-DIFF-001', 'CT-DIFF-002', 'CT-DIFF-003'] },
      errorCaseCoverage: ['FAIL-001', 'EDGE-001'],
      commandTargets: ['CMD-001'],
      traceClosure: ['TRACE-001'],
      canonicalSurfaces: ['CT-CANON-001'],
      legacyDenial: ['CT-EXIST-001'],
      closeoutProofPolicy: 'not_delivery_ready_before_controlled_ingest',
      ...backRef,
    },
    artifactAutomationPlan: [
      {
        artifactId: 'ART-001',
        path: rel(input.paths.preRenderMustGate),
        artifactType: 'report',
        sourceOfTruthRole: 'evidence',
        ownerModel: 'requirement_confirmation',
        producer: 'pre_render_must_decomposition_gate',
        consumer: 'renderer',
        inputArtifacts: [rel(input.paths.semanticKernel), rel(input.paths.mustDecompositionPacket)],
        outputArtifacts: ['pre-render-must-decomposition-gate-report.json'],
        recordEventTypes: [],
        canAffectControlFlow: false,
        userApprovalRequired: false,
        retention: 'long_lived',
        cleanupPolicy: 'keep',
        orphanRisk: 'low',
        containsSensitiveData: false,
        trainingDataEligible: false,
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        linkedRequirements: [...mustRefs, 'NEG-001'],
        ...backRef,
      },
      {
        artifactId: 'ART-002',
        path: rel(input.paths.confirmationHtml),
        artifactType: 'html',
        sourceOfTruthRole: 'projection',
        ownerModel: 'requirement_confirmation',
        producer: 'render-requirements-confirmation-html',
        consumer: 'user',
        inputArtifacts: [rel(input.sourcePath), rel(input.paths.preRenderMustGate)],
        outputArtifacts: ['confirmation.html', 'confirmation-render-report.json'],
        recordEventTypes: [],
        canAffectControlFlow: false,
        userApprovalRequired: true,
        retention: 'long_lived',
        cleanupPolicy: 'keep',
        orphanRisk: 'low',
        containsSensitiveData: false,
        trainingDataEligible: false,
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        linkedRequirements: [...mustRefs, 'NEG-001'],
        ...backRef,
      },
    ],
    targetModificationPaths: targetPathRows,
    requiredCommands: commandRows,
    suggestedCommands: [],
    closeoutReadinessPreview: {
      requiredCommands: commandRows.map((command) => command.id),
      orphanPolicy: 'Generated confirmation artifacts are not completion proof.',
      currentAttemptPolicy:
        'deliveryReadiness.ready remains false before controlled ingest and implementation evidence.',
      recordClosedPolicy: 'Requirement confirmation alone never closes implementation.',
      ...backRef,
    },
    architectureImpacts: [
      {
        id: 'ARCH-001',
        title: 'Mental model progression boundary',
        impact:
          'Only controlled ingest may allow progression from requirement_confirmation to architecture_confirmation.',
        requirementRefs: [...mustRefs, 'NEG-001', 'OUT-001'],
      },
    ],
  };
}

function materializeImplementationConfirmationText(
  sourceText: string,
  confirmation: Record<string, unknown>
): string {
  const extraction = extractImplementationConfirmationBlock(sourceText);
  const dumped = dumpImplementationConfirmation(confirmation);
  if (!extraction) {
    return `${sourceText.replace(/\s*$/u, '')}\n\n${dumped}\n`;
  }
  const lines = [...extraction.lines];
  lines.splice(extraction.start, extraction.end - extraction.start, ...dumped.split('\n'));
  const next = lines.join('\n');
  return next.endsWith('\n') ? next : `${next}\n`;
}

function semanticSourceDocumentHashForText(sourceText: string): string {
  const extraction = extractImplementationConfirmationBlock(sourceText);
  if (!extraction) {
    return sha256Text(sourceText);
  }
  return sourceDocumentHashForPreConfirmation(
    sourceText,
    extraction.blockText,
    extraction.confirmation
  );
}

function safeCurrentSourceDocumentHash(sourcePath: string): string {
  const sourceText = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf8') : '';
  return semanticSourceDocumentHashForText(sourceText);
}

function writtenIdRangesFromConfirmation(confirmation: Record<string, unknown>): string[] {
  const ranges = new Set<string>();
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        collect(item);
      }
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }
    const record = value as Record<string, unknown>;
    const id = normalizeText(record.id ?? record.artifactId);
    if (/^(TASK|MDM|EVD|TRACE|ACC|E2E|FAIL|EDGE|TARGET-MOD|ART|CMD)-/u.test(id)) {
      ranges.add(id);
    }
    for (const child of Object.values(record)) {
      collect(child);
    }
  };
  collect(confirmation);
  return [...ranges].sort();
}

function promoteImplementationConfirmationDraftWithReceipt(input: {
  root: string;
  sourcePath: string;
  draftPath: string;
  paths: PreConfirmationPaths;
  autoRepair?: boolean;
}): {
  ok: boolean;
  receipt: Record<string, unknown> | null;
  receiptPath: string;
  command: ReturnType<typeof runNodeJson>;
  issues: PreConfirmationDrilldownIssue[];
} {
  const script = resolveSkillScript(input.root, 'promote-draft-large-doc.js');
  const args = [
    '--draft',
    input.draftPath,
    '--target',
    toRootRelativePath(input.root, input.sourcePath),
    '--promotion-stage',
    'authoring-draft',
    '--scale-assessment',
    input.paths.scaleAssessmentInitial,
    '--scale-routing-decision',
    input.paths.scaleRoutingDecision,
    '--source-mutation-decision',
    input.paths.sourceMutationDecision,
    '--encoding-report',
    input.paths.encodingReport,
    '--receipt-out',
    input.paths.promotionReceipt,
    '--require',
    'implementationConfirmation:',
    '--json',
  ];
  if (input.autoRepair === true) {
    args.push('--auto-repair');
  }
  if (fs.existsSync(input.paths.checkpointPersistenceEvidence)) {
    args.push('--checkpoint-persistence-evidence', input.paths.checkpointPersistenceEvidence);
  }
  const command = runNodeJson(script, args, input.root);
  const receipt = command.json;
  const issues: PreConfirmationDrilldownIssue[] = [];
  if (command.status !== 0 || !receipt || receipt.ok !== true) {
    const gate = recordObject(receipt?.authoringPromotionGate);
    const errors = Array.isArray(gate.errors) ? gate.errors.map((error) => normalizeText(error)) : [];
    const failureDetails = errors.length > 0
      ? errors.join(', ')
      : [
          normalizeText(receipt?.failureClass),
          normalizeText(command.stderr),
          normalizeText(command.stdout),
        ]
          .filter(Boolean)
          .join(', ') || 'unknown failure';
    issues.push(
      preConfirmationIssue(
        'requirements_contract_promotion_failed',
        `Requirements contract promotion helper blocked source materialization: ${failureDetails}.`,
        [toRootRelativePath(input.root, script), toRootRelativePath(input.root, input.paths.promotionReceipt)],
        'source_mutation_gate'
      )
    );
  }
  return {
    ok: issues.length === 0,
    receipt,
    receiptPath: input.paths.promotionReceipt,
    command,
    issues,
  };
}

function normalizeImplementationConfirmationDraftForPromotion(input: {
  root: string;
  draftPath: string;
  paths: PreConfirmationPaths;
  blockingStage: string;
}): {
  ok: boolean;
  draftHash: string;
  issues: PreConfirmationDrilldownIssue[];
} {
  const script = resolveSkillScript(input.root, 'normalize-draft-markdown.js');
  const command = runNodeJson(script, ['--draft', input.draftPath, '--json'], input.root);
  const normalizedHash = normalizeText(command.json?.sha256);
  if (command.status !== 0 || !command.json || command.json.ok !== true || !normalizedHash) {
    return {
      ok: false,
      draftHash: fs.existsSync(input.draftPath) ? sha256File(input.draftPath) : '',
      issues: [
        preConfirmationIssue(
          'requirements_contract_draft_normalization_failed',
          `Requirements contract draft normalization failed before source promotion: ${command.stderr || command.stdout || script}.`,
          [toRootRelativePath(input.root, script), toRootRelativePath(input.root, input.draftPath)],
          input.blockingStage
        ),
      ],
    };
  }
  return {
    ok: true,
    draftHash: normalizedHash,
    issues: [],
  };
}

function sourceMaterializationGateIssue(
  code: string,
  message: string,
  refs: string[]
): PreConfirmationDrilldownIssue {
  return preConfirmationIssue(code, message, refs, 'source_materialization');
}

function verifySourceMaterializationBeforeAudit(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  requirementSetId: string;
  expectedSourceDocumentHash: string;
  expectedImplementationConfirmationHash: string;
}):
  | { ok: true; receipt: Record<string, unknown> }
  | { ok: false; issues: PreConfirmationDrilldownIssue[] } {
  const receiptPath = input.paths.promotionReceipt;
  if (!fs.existsSync(receiptPath)) {
    return {
      ok: false,
      issues: [
        sourceMaterializationGateIssue(
          'promotion_receipt_missing',
          'Deep audit requires a promotion-receipt.json source write receipt before request generation.',
          [toRootRelativePath(input.root, receiptPath)]
        ),
      ],
    };
  }

  const rawReceipt = readJsonIfExists(receiptPath);
  const receipt = recordObject(rawReceipt);
  const requiredFields = [
    'ok',
    'promotionStage',
    'targetPath',
    'targetHash',
    'manifestPath',
    'preflight',
    'authoringPromotionGate',
    'receiptPath',
  ];
  const issues: PreConfirmationDrilldownIssue[] = [];
  for (const field of requiredFields) {
    if (!(field in receipt) || receipt[field] == null) {
      issues.push(
        sourceMaterializationGateIssue(
          'promotion_receipt_field_missing',
          `Promotion receipt is missing required field ${field}.`,
          [toRootRelativePath(input.root, receiptPath), field]
        )
      );
    }
  }
  const current = readMaterializedConfirmation(input.sourcePath);
  const currentTargetHash = sha256File(input.sourcePath);
  const sourceRelative = toRootRelativePath(input.root, input.sourcePath);
  const manifest =
    recordObject(recordObject(receipt.preflight).manifest);
  const promotionGate = recordObject(receipt.authoringPromotionGate);
  const sourceMutationDecision = recordObject(recordObject(promotionGate.decisions).sourceMutation);
  if (receipt.ok !== true) {
    issues.push(
      sourceMaterializationGateIssue(
        'promotion_receipt_not_ok',
        'Promotion receipt must have ok=true before deep audit request generation.',
        [toRootRelativePath(input.root, receiptPath)]
      )
    );
  }
  if (normalizeText(receipt.promotionStage) !== 'authoring-draft') {
    issues.push(
      sourceMaterializationGateIssue(
        'promotion_receipt_stage_invalid',
        'Promotion receipt must be produced by --promotion-stage authoring-draft.',
        [normalizeText(receipt.promotionStage)]
      )
    );
  }
  if (normalizeText(receipt.targetPath) !== sourceRelative) {
    issues.push(
      sourceMaterializationGateIssue(
        'promotion_receipt_source_path_mismatch',
        'Promotion receipt targetPath does not match the current source document.',
        [sourceRelative, normalizeText(receipt.targetPath)]
      )
    );
  }
  if (normalizeText(receipt.targetHash) !== currentTargetHash) {
    issues.push(
      sourceMaterializationGateIssue(
        'promotion_receipt_source_hash_stale',
        'Current target file hash differs from promotion receipt targetHash.',
        [currentTargetHash, normalizeText(receipt.targetHash)]
      )
    );
  }
  if (current.sourceDocumentHash !== input.expectedSourceDocumentHash) {
    issues.push(
      sourceMaterializationGateIssue(
        'promotion_receipt_expected_source_hash_mismatch',
        'Current semantic source hash does not match the current audit input hash.',
        [input.expectedSourceDocumentHash, current.sourceDocumentHash]
      )
    );
  }
  if (current.implementationConfirmationHash !== input.expectedImplementationConfirmationHash) {
    issues.push(
      sourceMaterializationGateIssue(
        'promotion_receipt_confirmation_hash_stale',
        'Inline implementationConfirmation hash differs from the current audit input hash.',
        [
          current.implementationConfirmationHash,
          input.expectedImplementationConfirmationHash,
        ]
      )
    );
  }
  if (normalizeText(manifest.draftHash) !== currentTargetHash) {
    issues.push(
      sourceMaterializationGateIssue(
        'promotion_receipt_manifest_draft_hash_stale',
        'Promotion receipt manifest draftHash does not match the current target file hash.',
        [currentTargetHash, normalizeText(manifest.draftHash)]
      )
    );
  }
  if (normalizeText(sourceMutationDecision.sourceDocumentHashAfter) !== currentTargetHash) {
    issues.push(
      sourceMaterializationGateIssue(
        'promotion_receipt_source_mutation_after_hash_stale',
        'Promotion receipt source mutation decision binding does not match current target file hash.',
        [currentTargetHash, normalizeText(sourceMutationDecision.sourceDocumentHashAfter)]
      )
    );
  }
  if (promotionGate.ok !== true) {
    issues.push(
      sourceMaterializationGateIssue(
        'promotion_receipt_authoring_gate_not_ok',
        'Promotion receipt authoringPromotionGate must be ok=true before deep audit request generation.',
        [toRootRelativePath(input.root, receiptPath)]
      )
    );
  }
  if (sourceMutationDecision.finalDecision !== 'allow_source_materialization') {
    issues.push(
      sourceMaterializationGateIssue(
        'promotion_receipt_source_mutation_decision_not_allowed',
        'Promotion receipt must bind a source mutation decision with finalDecision=allow_source_materialization.',
        [normalizeText(sourceMutationDecision.finalDecision)]
      )
    );
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, receipt };
}

function buildSourceMaterializationRequiredResult(input: {
  root: string;
  sourcePath: string;
  recordId: string;
  requirementSetId: string;
  paths: PreConfirmationPaths;
  sourceDocumentHash?: string | null;
  implementationConfirmationHash?: string | null;
  packetHash?: string | null;
  warnings?: Array<Record<string, string>>;
  issues: PreConfirmationDrilldownIssue[];
}): MainAgentAuthoringRepairResult {
  return buildAuthoringRepairResult({
    root: input.root,
    sourcePath: input.sourcePath,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    paths: input.paths,
    status: 'blocked',
    blockingStage: 'promotion_receipt_required_before_audit',
    nextRequiredAction: 'promote_source_document_through_authoring_draft_before_deep_audit',
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    packetHash: input.packetHash,
    warnings: input.warnings,
    issues: input.issues,
  });
}

const CURRENT_SOURCE_PROMOTION_REFRESHABLE_ISSUES = new Set([
  'promotion_receipt_source_hash_stale',
  'promotion_receipt_confirmation_hash_stale',
  'promotion_receipt_manifest_draft_hash_stale',
  'promotion_receipt_source_mutation_after_hash_stale',
]);

function shouldAttemptCurrentSourcePromotionReceiptRefresh(
  issues: PreConfirmationDrilldownIssue[]
): boolean {
  return (
    issues.length > 0 &&
    issues.every((issue) => CURRENT_SOURCE_PROMOTION_REFRESHABLE_ISSUES.has(issue.code))
  );
}

function buildCurrentSourcePromotionRefreshFailedResult(input: {
  root: string;
  sourcePath: string;
  recordId: string;
  requirementSetId: string;
  paths: PreConfirmationPaths;
  sourceDocumentHash?: string | null;
  implementationConfirmationHash?: string | null;
  packetHash?: string | null;
  warnings?: Array<Record<string, string>>;
  staleReceiptIssues: PreConfirmationDrilldownIssue[];
  refreshIssues: PreConfirmationDrilldownIssue[];
  artifacts?: string[];
}): MainAgentAuthoringRepairResult {
  return buildAuthoringRepairResult({
    root: input.root,
    sourcePath: input.sourcePath,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    paths: input.paths,
    status: 'blocked',
    blockingStage: 'current_source_promotion_refresh_failed_before_audit',
    nextRequiredAction: 'rerun_skill_local_current_source_promotion_or_fix_promotion_gate_blockers',
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    packetHash: input.packetHash,
    warnings: input.warnings,
    artifacts: input.artifacts,
    issues: [...input.staleReceiptIssues, ...input.refreshIssues],
  });
}

function runSkillLocalCurrentSourcePromotionRefresh(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  requirementSetId: string;
}): {
  ok: true;
  receipt: Record<string, unknown>;
  artifacts: string[];
} | {
  ok: false;
  issues: PreConfirmationDrilldownIssue[];
  artifacts: string[];
} {
  const artifacts: string[] = [];
  const prepareScript = resolveSkillScript(input.root, 'prepare-current-source-promotion.js');
  const prepare = runNodeJson(
    prepareScript,
    [
      '--source',
      input.sourcePath,
      '--authoring-dir',
      input.paths.authoringDir,
      '--draft-out',
      input.paths.draftSourcePreview,
      '--encoding-report-out',
      input.paths.encodingReport,
      '--source-mutation-decision-out',
      input.paths.sourceMutationDecision,
      '--draft-implementation-confirmation-out',
      input.paths.draftImplementationConfirmation,
      '--authoring-materialization-receipt-out',
      input.paths.authoringMaterializationReceipt,
      '--record-id',
      input.recordId,
      '--requirement-set-id',
      input.requirementSetId,
      '--json',
    ],
    input.root
  );
  artifacts.push(
    input.paths.draftSourcePreview,
    input.paths.encodingReport,
    input.paths.sourceMutationDecision,
    input.paths.draftImplementationConfirmation,
    input.paths.authoringMaterializationReceipt
  );
  if (prepare.status !== 0 || !prepare.json || prepare.json.ok !== true) {
    const failureClass = normalizeText(prepare.json?.failureClass);
    return {
      ok: false,
      artifacts,
      issues: [
        preConfirmationIssue(
          failureClass || 'current_source_promotion_prep_failed',
          'Skill-local current-source promotion prep failed before promotion receipt refresh.',
          [
            toRootRelativePath(input.root, prepareScript),
            normalizeText(prepare.stderr) || normalizeText(prepare.stdout),
          ].filter(Boolean),
          'source_materialization'
        ),
      ],
    };
  }

  let routeDecision = readJsonIfExists(input.paths.scaleRoutingDecision);
  if (!routeDecision || !fs.existsSync(input.paths.scaleAssessmentInitial)) {
    const scale = runPreConfirmationScaleAssessment({
      root: input.root,
      sourcePath: input.paths.draftSourcePreview,
      paths: input.paths,
      phase: 'initial_assessment',
    });
    artifacts.push(input.paths.scaleAssessmentInitial, input.paths.scaleRoutingDecision);
    if (scale.issues.length > 0 || !scale.routingDecision) {
      return {
        ok: false,
        artifacts,
        issues: [
          preConfirmationIssue(
            'current_source_promotion_scale_routing_refresh_failed',
            'Skill-local current-source promotion could not refresh scale routing before promotion receipt refresh.',
            [toRootRelativePath(input.root, input.paths.scaleRoutingDecision)],
            'source_materialization'
          ),
          ...scale.issues,
        ],
      };
    }
    routeDecision = scale.routingDecision;
  }
  const routeDecisionText = normalizeText(routeDecision?.decision);
  if (['checkpoint_required', 'checkpoint_required_with_amendment'].includes(routeDecisionText)) {
    const sourceDocumentHash = normalizeText(prepare.json.semanticSourceHash);
    const implementationConfirmationHash = normalizeText(prepare.json.implementationConfirmationHash);
    if (!sourceDocumentHash || !implementationConfirmationHash) {
      return {
        ok: false,
        artifacts,
        issues: [
          preConfirmationIssue(
            'current_source_promotion_checkpoint_hash_binding_missing',
            'Skill-local current-source promotion prep did not return semantic source and implementationConfirmation hashes required for checkpoint persistence refresh.',
            [toRootRelativePath(input.root, prepareScript)],
            'source_materialization'
          ),
        ],
      };
    }
    const checkpointRefresh = prepareAuthoringRepairCheckpointPersistenceEvidence({
      root: input.root,
      repairDraftPath: input.paths.draftSourcePreview,
      paths: input.paths,
      recordId: input.recordId,
      sourceDocumentHash,
      implementationConfirmationHash,
      createdAt: new Date().toISOString(),
      routeDecision,
    });
    artifacts.push(
      input.paths.progress,
      input.paths.checkpointPersistenceEvidence,
      ...input.paths.checkpointReceiptPaths
    );
    if (checkpointRefresh.ok === false) {
      return {
        ok: false,
        artifacts,
        issues: [
          preConfirmationIssue(
            'current_source_promotion_checkpoint_persistence_refresh_failed',
            'Skill-local current-source promotion could not refresh checkpoint persistence evidence before promotion receipt refresh.',
            [toRootRelativePath(input.root, input.paths.checkpointPersistenceEvidence)],
            'source_materialization'
          ),
          checkpointRefresh.issue,
        ],
      };
    }
  }

  const promotion = promoteImplementationConfirmationDraftWithReceipt({
    root: input.root,
    sourcePath: input.sourcePath,
    draftPath: input.paths.draftSourcePreview,
    paths: input.paths,
    autoRepair: true,
  });
  artifacts.push(input.paths.promotionReceipt);
  if (promotion.ok !== true || !promotion.receipt || promotion.receipt.ok !== true) {
    return {
      ok: false,
      artifacts,
      issues: [
        ...promotion.issues,
        preConfirmationIssue(
          'current_source_promotion_receipt_refresh_failed',
          'Skill-local promotion could not refresh promotion-receipt.json for the current source.',
          [
            toRootRelativePath(input.root, input.paths.promotionReceipt),
            normalizeText(promotion.command.stderr) || normalizeText(promotion.command.stdout),
          ].filter(Boolean),
          'source_materialization'
        ),
      ],
    };
  }

  return { ok: true, receipt: promotion.receipt, artifacts };
}

interface AuthoringCheckpointDefinition {
  id: string;
  name: string;
  index: number;
  artifacts: (input: { draftSourcePath: string; paths: PreConfirmationPaths }) => string[];
}

const AUTHORING_REPAIR_CHECKPOINTS: AuthoringCheckpointDefinition[] = [
  {
    id: 'cp-00-semantic-kernel',
    name: 'semantic kernel',
    index: 0,
    artifacts: ({ paths }) => [paths.semanticKernel],
  },
  {
    id: 'cp-01-must-decomposition-packet',
    name: 'must decomposition packet',
    index: 1,
    artifacts: ({ paths }) => [paths.mustDecompositionPacket],
  },
  {
    id: 'cp-02-atomic-decomposition-loop-convergence',
    name: 'atomic decomposition loop convergence',
    index: 2,
    artifacts: ({ paths }) => [paths.mustDecompositionReceipt],
  },
  {
    id: 'cp-03-packet-to-source-materialization',
    name: 'packet to source materialization',
    index: 3,
    artifacts: ({ draftSourcePath, paths }) => [paths.authoringMaterializationReceipt, draftSourcePath],
  },
  {
    id: 'cp-04-id-freeze',
    name: 'ID freeze',
    index: 4,
    artifacts: ({ draftSourcePath }) => [draftSourcePath],
  },
  {
    id: 'cp-05-implementation-confirmation-core',
    name: 'implementationConfirmation core',
    index: 5,
    artifacts: ({ draftSourcePath, paths }) => [paths.draftImplementationConfirmation, draftSourcePath],
  },
  {
    id: 'cp-06-projections',
    name: 'EVD/TRACE/ACC/E2E/failure/edge/currentTarget/AI-TDD projections',
    index: 6,
    artifacts: ({ paths }) => [paths.mustDecompositionPacket],
  },
  {
    id: 'cp-07-human-readable-views',
    name: 'human-readable views',
    index: 7,
    artifacts: ({ draftSourcePath }) => [draftSourcePath],
  },
  {
    id: 'cp-08-pre-render-global-reconciliation',
    name: 'pre-render global reconciliation',
    index: 8,
    artifacts: ({ paths }) => [
      paths.preRenderMustGate,
      paths.preRenderGlobalConsistency,
      paths.reconciliationReport,
    ],
  },
];

const AUTHORING_REPAIR_CHECKPOINT_IDS = AUTHORING_REPAIR_CHECKPOINTS.map((checkpoint) => checkpoint.id);

function checkpointReceiptPath(paths: PreConfirmationPaths, checkpoint: AuthoringCheckpointDefinition): string {
  return paths.checkpointReceiptPaths[checkpoint.index];
}

function readCurrentCheckpointReceipts(paths: PreConfirmationPaths): Record<string, unknown>[] {
  return paths.checkpointReceiptPaths
    .map((receiptPath) => readJsonIfExists(receiptPath))
    .filter((receipt): receipt is Record<string, unknown> => Boolean(receipt));
}

function checkpointTraceValue(values: string[]): string {
  return values.length > 0 ? values.join(',') : 'missing';
}

function checkpointTraceHash(filePath: string): string {
  return fs.existsSync(filePath) ? sha256File(filePath) : 'missing';
}

function emitAuthoringCheckpointTrace(input: {
  root: string;
  draftSourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  routeDecision: string;
  evidence: Record<string, unknown>;
}): void {
  const completedIds = asStringArray(recordObject(input.evidence.checkpointPersistenceRef).completedCheckpointIds);
  process.stderr.write(
    `[requirements-contract-authoring] checkpoint trace start record=${input.recordId} route=${input.routeDecision} source=${toRootRelativePath(input.root, input.draftSourcePath)}\n`
  );
  AUTHORING_REPAIR_CHECKPOINTS.forEach((checkpoint, index) => {
    const artifactPaths = uniqueNonEmpty(
      checkpoint.artifacts({ draftSourcePath: input.draftSourcePath, paths: input.paths })
    );
    const artifactRefs = artifactPaths.map((artifactPath) => toRootRelativePath(input.root, artifactPath));
    const artifactHashes = artifactPaths.map(checkpointTraceHash);
    const nextCheckpoint =
      AUTHORING_REPAIR_CHECKPOINTS[index + 1]?.id ?? 'checkpoint-persistence-summary';
    const artifactValue = checkpointTraceValue(artifactRefs);
    const hashValue = checkpointTraceValue(artifactHashes);
    const result = completedIds.includes(checkpoint.id) ? 'passed' : 'missing';
    process.stderr.write(
      `[requirements-contract-authoring] checkpoint phase=start id=${checkpoint.id} name="${checkpoint.name}" artifact=${artifactValue} hash=${hashValue} next=${nextCheckpoint}\n`
    );
    process.stderr.write(
      `[requirements-contract-authoring] checkpoint phase=result id=${checkpoint.id} result=${result} artifact=${artifactValue} hash=${hashValue} next=${nextCheckpoint}\n`
    );
  });
  const summaryHash = checkpointTraceHash(input.paths.checkpointPersistenceEvidence);
  process.stderr.write(
    `[requirements-contract-authoring] checkpoint-persistence summary artifact=${toRootRelativePath(input.root, input.paths.checkpointPersistenceEvidence)} hash=${summaryHash} next=promotion_required\n`
  );
}

function checkpointArtifactRefs(input: {
  root: string;
  draftSourcePath: string;
  paths: PreConfirmationPaths;
  checkpoint: AuthoringCheckpointDefinition;
}): Array<{ path: string; hash: string }> {
  return uniqueNonEmpty(
    input.checkpoint.artifacts({ draftSourcePath: input.draftSourcePath, paths: input.paths })
  ).map((artifactPath) => ({
    path: toRootRelativePath(input.root, artifactPath),
    hash: checkpointTraceHash(artifactPath),
  }));
}

function isCurrentCheckpointReceipt(input: {
  root: string;
  receipt: Record<string, unknown> | null;
  checkpoint: AuthoringCheckpointDefinition;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  draftSourcePath: string;
}): boolean {
  if (!input.receipt || input.receipt.status !== 'passed') return false;
  if (normalizeText(input.receipt.checkpointId) !== input.checkpoint.id) return false;
  if (normalizeText(input.receipt.sourceDocumentHash) !== input.sourceDocumentHash) return false;
  if (normalizeText(input.receipt.implementationConfirmationHash) !== input.implementationConfirmationHash) {
    return false;
  }
  if (normalizeText(input.receipt.documentHash) !== checkpointTraceHash(input.draftSourcePath)) {
    return false;
  }
  const artifactRefs = Array.isArray(input.receipt.artifactRefs) ? input.receipt.artifactRefs : [];
  if (artifactRefs.length === 0) return false;
  return artifactRefs.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const artifactPath = normalizeText((item as Record<string, unknown>).path);
    const artifactHash = normalizeText((item as Record<string, unknown>).hash);
    if (!artifactPath || !artifactHash.startsWith('sha256:')) return false;
    const absoluteArtifactPath = path.isAbsolute(artifactPath)
      ? artifactPath
      : path.resolve(input.root, artifactPath);
    return fs.existsSync(absoluteArtifactPath) && sha256File(absoluteArtifactPath) === artifactHash;
  });
}

function checkpointProgressFromReceipts(input: {
  root: string;
  draftSourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  routeDecision: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  createdAt: string;
}): Record<string, unknown> {
  const receipts = readCurrentCheckpointReceipts(input.paths);
  const receiptByCheckpoint = new Map(
    receipts.map((receipt) => [normalizeText(receipt.checkpointId), receipt])
  );
  const completedIds = AUTHORING_REPAIR_CHECKPOINTS.filter((checkpoint) =>
    isCurrentCheckpointReceipt({
      root: input.root,
      receipt: receiptByCheckpoint.get(checkpoint.id) ?? null,
      checkpoint,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      draftSourcePath: input.draftSourcePath,
    })
  ).map((checkpoint) => checkpoint.id);
  const nextCheckpoint =
    AUTHORING_REPAIR_CHECKPOINTS.find((checkpoint) => !completedIds.includes(checkpoint.id))?.id ?? null;
  const lastCompletedCheckpoint = completedIds[completedIds.length - 1] ?? null;
  const progress = {
    schemaVersion: 'semantic-checkpoint-progress/v1',
    recordId: input.recordId,
    lane: 'pre_confirmation_drilldown',
    mode: 'checkpoint_required',
    modeDecision: input.routeDecision,
    source: toRootRelativePath(input.root, input.draftSourcePath),
    inputRefs: [
      toRootRelativePath(input.root, input.draftSourcePath),
      ...AUTHORING_REPAIR_CHECKPOINTS.map((checkpoint) =>
        toRootRelativePath(input.root, checkpointReceiptPath(input.paths, checkpoint))
      ),
    ],
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    documentHash: sha256File(input.draftSourcePath),
    currentCheckpoint: nextCheckpoint,
    lastCompletedCheckpoint,
    next: nextCheckpoint,
    resumeLedger: {
      schemaVersion: 'requirements-contract-checkpoint-resume-ledger/v1',
      completedCheckpointIds: completedIds,
      checkpointReceiptRefs: AUTHORING_REPAIR_CHECKPOINTS.map((checkpoint) => {
        const receiptPath = checkpointReceiptPath(input.paths, checkpoint);
        return {
          checkpointId: checkpoint.id,
          path: toRootRelativePath(input.root, receiptPath),
          hash: fs.existsSync(receiptPath) ? sha256File(receiptPath) : null,
        };
      }),
    },
    checkpoints: AUTHORING_REPAIR_CHECKPOINTS.map((checkpoint) => ({
      id: checkpoint.id,
      name: checkpoint.name,
      status: completedIds.includes(checkpoint.id) ? 'passed' : 'pending',
      receiptPath: toRootRelativePath(input.root, checkpointReceiptPath(input.paths, checkpoint)),
      receiptHash: fs.existsSync(checkpointReceiptPath(input.paths, checkpoint))
        ? sha256File(checkpointReceiptPath(input.paths, checkpoint))
        : null,
    })),
    createdBy: 'main_agent_orchestration.requirement_confirmation.checkpoint_driven_execution',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  return {
    ...progress,
    progressHash: sha256Json(progress),
  };
}

function writeCheckpointProgressFromReceipts(input: {
  root: string;
  draftSourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  routeDecision: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  createdAt: string;
}): Record<string, unknown> {
  const progress = checkpointProgressFromReceipts(input);
  writeJsonUtf8(input.paths.progress, progress);
  return progress;
}

function resolveCheckpointResumeStartIndex(input: {
  root: string;
  draftSourcePath: string;
  paths: PreConfirmationPaths;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
}): number {
  const progress = readJsonIfExists(input.paths.progress);
  if (!progress) return 0;
  if (normalizeText(progress.schemaVersion) !== 'semantic-checkpoint-progress/v1') return 0;
  if (normalizeText(progress.sourceDocumentHash) !== input.sourceDocumentHash) return 0;
  if (
    normalizeText(progress.implementationConfirmationHash) !==
    input.implementationConfirmationHash
  ) {
    return 0;
  }
  if (normalizeText(progress.documentHash) !== checkpointTraceHash(input.draftSourcePath)) {
    return 0;
  }
  const ledger = recordObject(progress.resumeLedger);
  if (normalizeText(ledger.schemaVersion) !== 'requirements-contract-checkpoint-resume-ledger/v1') {
    return 0;
  }
  const completedIds = asStringArray(ledger.completedCheckpointIds);
  if (completedIds.length > AUTHORING_REPAIR_CHECKPOINT_IDS.length) return 0;
  for (const [index, checkpointId] of completedIds.entries()) {
    const checkpoint = AUTHORING_REPAIR_CHECKPOINTS[index];
    if (!checkpoint || checkpoint.id !== checkpointId) return 0;
    const receipt = readJsonIfExists(checkpointReceiptPath(input.paths, checkpoint));
    if (
      !isCurrentCheckpointReceipt({
        root: input.root,
        receipt,
        checkpoint,
        sourceDocumentHash: input.sourceDocumentHash,
        implementationConfirmationHash: input.implementationConfirmationHash,
        draftSourcePath: input.draftSourcePath,
      })
    ) {
      return 0;
    }
  }
  const expectedNext = AUTHORING_REPAIR_CHECKPOINTS[completedIds.length]?.id ?? '';
  const actualNext = normalizeText(progress.next ?? progress.currentCheckpoint);
  if (actualNext !== expectedNext) return 0;
  return completedIds.length;
}

function runAuthoringCheckpoint(input: {
  root: string;
  draftSourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  routeDecision: string;
  checkpoint: AuthoringCheckpointDefinition;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  createdAt: string;
}): { ok: true; receipt: Record<string, unknown> } | { ok: false; issue: PreConfirmationDrilldownIssue } {
  const previousCheckpoint = AUTHORING_REPAIR_CHECKPOINTS[input.checkpoint.index - 1] ?? null;
  if (previousCheckpoint) {
    const previousReceipt = readJsonIfExists(checkpointReceiptPath(input.paths, previousCheckpoint));
    if (
      !isCurrentCheckpointReceipt({
        root: input.root,
        receipt: previousReceipt,
        checkpoint: previousCheckpoint,
        sourceDocumentHash: input.sourceDocumentHash,
        implementationConfirmationHash: input.implementationConfirmationHash,
        draftSourcePath: input.draftSourcePath,
      })
    ) {
      return {
        ok: false,
        issue: preConfirmationIssue(
          'checkpoint_prerequisite_receipt_missing',
          `Checkpoint ${input.checkpoint.id} requires current receipt for ${previousCheckpoint.id}.`,
          [toRootRelativePath(input.root, checkpointReceiptPath(input.paths, previousCheckpoint))],
          'requirements_contract_authoring_checkpoint_driven_execution'
        ),
      };
    }
  }
  const existingReceiptPath = checkpointReceiptPath(input.paths, input.checkpoint);
  const existingReceipt = readJsonIfExists(existingReceiptPath);
  if (
    isCurrentCheckpointReceipt({
      root: input.root,
      receipt: existingReceipt,
      checkpoint: input.checkpoint,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      draftSourcePath: input.draftSourcePath,
    })
  ) {
    return { ok: true, receipt: existingReceipt };
  }
  process.stderr.write(
    `[requirements-contract-authoring] checkpoint execution start id=${input.checkpoint.id} receipt=${toRootRelativePath(input.root, existingReceiptPath)}\n`
  );
  const artifactRefs = checkpointArtifactRefs({
    root: input.root,
    draftSourcePath: input.draftSourcePath,
    paths: input.paths,
    checkpoint: input.checkpoint,
  });
  const missingArtifacts = artifactRefs.filter((artifact) => artifact.hash === 'missing');
  if (missingArtifacts.length > 0) {
    return {
      ok: false,
      issue: preConfirmationIssue(
        'checkpoint_artifact_missing',
        `Checkpoint ${input.checkpoint.id} is missing required artifacts before receipt.`,
        missingArtifacts.map((artifact) => artifact.path),
        'requirements_contract_authoring_checkpoint_driven_execution'
      ),
    };
  }
  const nextCheckpoint =
    AUTHORING_REPAIR_CHECKPOINTS[input.checkpoint.index + 1]?.id ?? 'checkpoint-persistence-summary';
  const receipt = {
    schemaVersion: 'requirements-contract-checkpoint-receipt/v1',
    checkpointId: input.checkpoint.id,
    checkpointName: input.checkpoint.name,
    status: 'passed',
    recordId: input.recordId,
    routeDecision: input.routeDecision,
    source: toRootRelativePath(input.root, input.draftSourcePath),
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    documentHash: sha256File(input.draftSourcePath),
    artifactRefs,
    previousCheckpointId: previousCheckpoint?.id ?? null,
    nextCheckpointId: nextCheckpoint,
    createdBy: 'main_agent_orchestration.requirement_confirmation.checkpoint_driven_execution',
    createdAt: input.createdAt,
  };
  writeJsonUtf8(existingReceiptPath, {
    ...receipt,
    receiptHash: sha256Json(receipt),
  });
  writeCheckpointProgressFromReceipts(input);
  process.stderr.write(
    `[requirements-contract-authoring] checkpoint execution result id=${input.checkpoint.id} result=passed receipt=${toRootRelativePath(input.root, existingReceiptPath)} hash=${sha256File(existingReceiptPath)} next=${nextCheckpoint}\n`
  );
  return { ok: true, receipt: readJsonIfExists(existingReceiptPath) ?? receipt };
}

function runCp00SemanticKernel(input: Omit<Parameters<typeof runAuthoringCheckpoint>[0], 'checkpoint'>) {
  return runAuthoringCheckpoint({ ...input, checkpoint: AUTHORING_REPAIR_CHECKPOINTS[0] });
}

function runCp01MustDecompositionPacket(input: Omit<Parameters<typeof runAuthoringCheckpoint>[0], 'checkpoint'>) {
  return runAuthoringCheckpoint({ ...input, checkpoint: AUTHORING_REPAIR_CHECKPOINTS[1] });
}

function runCp02AtomicDecompositionLoopConvergence(input: Omit<Parameters<typeof runAuthoringCheckpoint>[0], 'checkpoint'>) {
  return runAuthoringCheckpoint({ ...input, checkpoint: AUTHORING_REPAIR_CHECKPOINTS[2] });
}

function runCp03PacketToSourceMaterialization(input: Omit<Parameters<typeof runAuthoringCheckpoint>[0], 'checkpoint'>) {
  return runAuthoringCheckpoint({ ...input, checkpoint: AUTHORING_REPAIR_CHECKPOINTS[3] });
}

function runCp04IdFreeze(input: Omit<Parameters<typeof runAuthoringCheckpoint>[0], 'checkpoint'>) {
  return runAuthoringCheckpoint({ ...input, checkpoint: AUTHORING_REPAIR_CHECKPOINTS[4] });
}

function runCp05ImplementationConfirmationCore(input: Omit<Parameters<typeof runAuthoringCheckpoint>[0], 'checkpoint'>) {
  return runAuthoringCheckpoint({ ...input, checkpoint: AUTHORING_REPAIR_CHECKPOINTS[5] });
}

function runCp06Projections(input: Omit<Parameters<typeof runAuthoringCheckpoint>[0], 'checkpoint'>) {
  return runAuthoringCheckpoint({ ...input, checkpoint: AUTHORING_REPAIR_CHECKPOINTS[6] });
}

function runCp07HumanReadableViews(input: Omit<Parameters<typeof runAuthoringCheckpoint>[0], 'checkpoint'>) {
  return runAuthoringCheckpoint({ ...input, checkpoint: AUTHORING_REPAIR_CHECKPOINTS[7] });
}

function runCp08Reconciliation(input: Omit<Parameters<typeof runAuthoringCheckpoint>[0], 'checkpoint'>) {
  return runAuthoringCheckpoint({ ...input, checkpoint: AUTHORING_REPAIR_CHECKPOINTS[8] });
}

function runAuthoringCheckpointExecution(input: {
  root: string;
  draftSourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  routeDecision: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  createdAt: string;
}): { ok: true } | { ok: false; issues: PreConfirmationDrilldownIssue[] } {
  const runners = [
    runCp00SemanticKernel,
    runCp01MustDecompositionPacket,
    runCp02AtomicDecompositionLoopConvergence,
    runCp03PacketToSourceMaterialization,
    runCp04IdFreeze,
    runCp05ImplementationConfirmationCore,
    runCp06Projections,
    runCp07HumanReadableViews,
    runCp08Reconciliation,
  ];
  const resumeStartIndex = resolveCheckpointResumeStartIndex(input);
  if (resumeStartIndex > 0) {
    const nextCheckpoint =
      AUTHORING_REPAIR_CHECKPOINTS[resumeStartIndex]?.id ?? 'checkpoint-persistence-summary';
    process.stderr.write(
      `[requirements-contract-authoring] checkpoint resume progress=${toRootRelativePath(input.root, input.paths.progress)} completed=${resumeStartIndex} next=${nextCheckpoint}\n`
    );
  }
  for (const runner of runners.slice(resumeStartIndex)) {
    const result = runner(input);
    if (!result.ok) {
      writeCheckpointProgressFromReceipts(input);
      return { ok: false, issues: [result.issue] };
    }
  }
  writeCheckpointProgressFromReceipts(input);
  return { ok: true };
}

function buildCheckpointPersistenceEvidenceFromReceipts(input: {
  root: string;
  draftSourcePath: string;
  paths: PreConfirmationPaths;
  routeDecision: Record<string, unknown> | null;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  createdAt: string;
}): Record<string, unknown> {
  const routeDecisionHash = normalizeText(input.routeDecision?.routeDecisionHash);
  const checkpointReceiptRefs = AUTHORING_REPAIR_CHECKPOINTS.map((checkpoint) => {
    const receiptPath = checkpointReceiptPath(input.paths, checkpoint);
    const receipt = readJsonIfExists(receiptPath);
    const current = isCurrentCheckpointReceipt({
      root: input.root,
      receipt,
      checkpoint,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      draftSourcePath: input.draftSourcePath,
    });
    return {
      checkpointId: checkpoint.id,
      path: toRootRelativePath(input.root, receiptPath),
      hash: fs.existsSync(receiptPath) ? sha256File(receiptPath) : null,
      status: current ? 'passed' : 'missing_or_stale',
    };
  });
  const completedCheckpointIds = checkpointReceiptRefs
    .filter((receipt) => receipt.status === 'passed')
    .map((receipt) => receipt.checkpointId);
  const checkpointPersistenceSatisfiedCandidate =
    AUTHORING_REPAIR_CHECKPOINT_IDS.every((id) => completedCheckpointIds.includes(id)) &&
    fs.existsSync(input.paths.progress) &&
    fs.existsSync(input.paths.preRenderMustGate) &&
    fs.existsSync(input.paths.preRenderGlobalConsistency) &&
    fs.existsSync(input.paths.reconciliationReport);
  const evidence = {
    schemaVersion: 'semantic-checkpoint-persistence-evidence/v1',
    checkpointPersistenceSatisfiedCandidate,
    checkpointPersistenceStage: 'checkpoint_driven_execution_summary',
    recordId: input.recordId,
    source: toRootRelativePath(input.root, input.draftSourcePath),
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    checkpointPersistenceRef: {
      routeDecisionHash,
      progressPath: toRootRelativePath(input.root, input.paths.progress),
      progressHash: fs.existsSync(input.paths.progress) ? sha256File(input.paths.progress) : null,
      checkpointReceiptRefs,
      completedCheckpointIds,
      preRenderMustDecompositionGateHash: fs.existsSync(input.paths.preRenderMustGate)
        ? sha256File(input.paths.preRenderMustGate)
        : null,
      preRenderGlobalConsistencyHash: fs.existsSync(input.paths.preRenderGlobalConsistency)
        ? sha256File(input.paths.preRenderGlobalConsistency)
        : null,
      packetSourceReconciliationHash: fs.existsSync(input.paths.reconciliationReport)
        ? sha256File(input.paths.reconciliationReport)
        : null,
    },
    completedAt: input.createdAt,
    createdBy:
      'main_agent_orchestration.requirement_confirmation.authoring.checkpoint_persistence_summary',
  };
  return {
    ...evidence,
    evidenceHash: sha256Json(evidence),
  };
}

function prepareAuthoringRepairCheckpointPersistenceEvidence(input: {
  root: string;
  repairDraftPath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  createdAt: string;
  routeDecision: Record<string, unknown> | null;
}): { ok: true } | { ok: false; issue: PreConfirmationDrilldownIssue } {
  const routeDecisionText = normalizeText(input.routeDecision?.decision);
  if (!['checkpoint_required', 'checkpoint_required_with_amendment'].includes(routeDecisionText)) {
    return { ok: true };
  }

  const checkpointScript = resolveSkillScript(input.root, 'run_semantic_checkpoints.js');
  const combinedGate = runNodeJson(
    checkpointScript,
    [
      '--source',
      input.repairDraftPath,
      '--progress',
      input.paths.progress,
      '--mode',
      'pre-render-gate',
      '--json',
    ],
    input.root
  );
  const combinedReport = combinedGate.json;
  if (!combinedReport && !fs.existsSync(input.paths.preRenderGlobalConsistency)) {
    return {
      ok: false,
      issue: commandFailureIssue(
        'authoring_repair_checkpoint_global_gate_report_missing',
        checkpointScript,
        combinedGate
      ),
    };
  }
  if (!fs.existsSync(input.paths.preRenderMustGate)) {
    return {
      ok: false,
      issue: sourceMaterializationGateIssue(
        'authoring_repair_checkpoint_must_gate_report_missing',
        'Authoring repair checkpoint persistence requires a current pre-render MUST gate report hash before promotion.',
        [toRootRelativePath(input.root, input.paths.preRenderMustGate)]
      ),
    };
  }
  if (!fs.existsSync(input.paths.preRenderGlobalConsistency)) {
    const globalGate = recordObject(combinedReport?.globalConsistencyGate);
    if (Object.keys(globalGate).length > 0) {
      writeJsonUtf8(input.paths.preRenderGlobalConsistency, globalGate);
    }
  }
  if (!fs.existsSync(input.paths.preRenderGlobalConsistency)) {
    return {
      ok: false,
      issue: sourceMaterializationGateIssue(
        'authoring_repair_checkpoint_global_gate_report_missing',
        'Authoring repair checkpoint persistence requires a current pre-render global consistency report hash before promotion.',
        [toRootRelativePath(input.root, input.paths.preRenderGlobalConsistency)]
      ),
    };
  }
  if (!fs.existsSync(input.paths.reconciliationReport)) {
    return {
      ok: false,
      issue: sourceMaterializationGateIssue(
        'authoring_repair_checkpoint_reconciliation_missing',
        'Authoring repair checkpoint persistence requires packet/source reconciliation evidence before promotion.',
        [toRootRelativePath(input.root, input.paths.reconciliationReport)]
      ),
    };
  }

  const checkpointRun = runAuthoringCheckpointExecution({
    root: input.root,
    draftSourcePath: input.repairDraftPath,
    paths: input.paths,
    recordId: input.recordId,
    routeDecision: routeDecisionText,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    createdAt: input.createdAt,
  });
  if (!checkpointRun.ok) {
    return { ok: false, issue: checkpointRun.issues[0] };
  }
  const evidence = buildCheckpointPersistenceEvidenceFromReceipts({
    root: input.root,
    draftSourcePath: input.repairDraftPath,
    paths: input.paths,
    routeDecision: input.routeDecision,
    recordId: input.recordId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    createdAt: input.createdAt,
  });
  writeJsonUtf8(input.paths.checkpointPersistenceEvidence, evidence);
  const validationIssues = validateCheckpointPersistenceEvidence({
    root: input.root,
    sourcePath: input.repairDraftPath,
    paths: input.paths,
    evidencePath: input.paths.checkpointPersistenceEvidence,
    routeDecision: input.routeDecision,
  });
  if (validationIssues.length > 0) {
    return { ok: false, issue: validationIssues[0] };
  }
  return { ok: true };
}

function ensureCheckpointPersistenceForAuthoring(input: {
  root: string;
  draftSourcePath: string;
  paths: PreConfirmationPaths;
  routeDecision: Record<string, unknown> | null;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  createdAt: string;
}): { ok: true } | { ok: false; issues: PreConfirmationDrilldownIssue[] } {
  const routeDecisionText = normalizeText(input.routeDecision?.decision);
  if (!['checkpoint_required', 'checkpoint_required_with_amendment'].includes(routeDecisionText)) {
    return { ok: true };
  }

  const checkpointRun = runAuthoringCheckpointExecution({
    root: input.root,
    draftSourcePath: input.draftSourcePath,
    paths: input.paths,
    recordId: input.recordId,
    routeDecision: routeDecisionText,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    createdAt: input.createdAt,
  });
  if (!checkpointRun.ok) {
    return checkpointRun;
  }
  const evidence = buildCheckpointPersistenceEvidenceFromReceipts({
    root: input.root,
    draftSourcePath: input.draftSourcePath,
    paths: input.paths,
    routeDecision: input.routeDecision,
    recordId: input.recordId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    createdAt: input.createdAt,
  });
  writeJsonUtf8(input.paths.checkpointPersistenceEvidence, evidence);

  const validationIssues = validateCheckpointPersistenceEvidence({
    root: input.root,
    sourcePath: input.draftSourcePath,
    paths: input.paths,
    evidencePath: input.paths.checkpointPersistenceEvidence,
    routeDecision: input.routeDecision,
  });
  const completedIds = asStringArray(recordObject(evidence.checkpointPersistenceRef).completedCheckpointIds);
  emitAuthoringCheckpointTrace({
    root: input.root,
    draftSourcePath: input.draftSourcePath,
    paths: input.paths,
    recordId: input.recordId,
    routeDecision: routeDecisionText,
    evidence,
  });
  const missingCheckpoints = AUTHORING_REPAIR_CHECKPOINT_IDS.filter((id) => !completedIds.includes(id));
  if (missingCheckpoints.length > 0) {
    validationIssues.push(
      preConfirmationIssue(
        'checkpoint_persistence_evidence_incomplete',
        `Checkpoint persistence evidence is missing completed checkpoint IDs: ${missingCheckpoints.join(', ')}.`,
        [toRootRelativePath(input.root, input.paths.checkpointPersistenceEvidence)],
        'requirements_contract_authoring_scale_routing'
      )
    );
  }
  if (normalizeText(evidence.schemaVersion) !== 'semantic-checkpoint-persistence-evidence/v1') {
    validationIssues.push(
      preConfirmationIssue(
        'checkpoint_persistence_evidence_schema_invalid',
        'Checkpoint persistence evidence schemaVersion must equal semantic-checkpoint-persistence-evidence/v1.',
        [toRootRelativePath(input.root, input.paths.checkpointPersistenceEvidence)],
        'requirements_contract_authoring_scale_routing'
      )
    );
  }
  if (validationIssues.length > 0) {
    return { ok: false, issues: validationIssues };
  }
  return { ok: true };
}

function materializeCriticalAuditorGapFix(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  requirementSetId: string;
  confirmation: Record<string, unknown>;
  previousSourceDocumentHash: string;
  response: CriticalAuditorRoundResult;
  createdAt: string;
}):
  | {
      ok: true;
      materialized: ReturnType<typeof readMaterializedConfirmation>;
      receipt: Record<string, unknown> | null;
      receiptPath: string;
    }
  | { ok: false; issue: PreConfirmationDrilldownIssue } {
  const semanticBeforeHash = implementationConfirmationHashForPreConfirmation(input.confirmation);
  const appliedActions: Record<string, unknown>[] = [];
  const changedTargetFields = new Set<string>();
  const repairBackRef = (
    action: CriticalAuditorRepairAction,
    materializedId: string
  ): Record<string, unknown> => ({
    derivedFromMustRef:
      normalizeText(action.type === 'add_must' || action.type === 'split_must' ? materializedId : '') ||
      asStringArray(action.mustRefs)[0] ||
      materializedId,
    projectionStatus: 'synchronized',
  });
  const appendRow = (
    confirmation: Record<string, unknown>,
    field: string,
    action: CriticalAuditorRepairAction,
    defaultPrefix: string,
    extra: Record<string, unknown> = {}
  ) => {
    const rows = asRecordArray(confirmation[field]);
    const value = recordObject(action.newValue);
    const id =
      normalizeText(value.id ?? value.commandId) ||
      `${defaultPrefix}-${String(rows.length + 1).padStart(3, '0')}`;
    confirmation[field] = [
      ...rows,
      {
        id,
        ...value,
        ...repairBackRef(action, id),
        text: normalizeText(value.text) || action.sourceText,
        sourceSpan: action.sourceSpan,
        sourceText: action.sourceText,
        sourceRequirementIds: action.requirementIds,
        repairActionId: action.actionId,
        repairReason: action.reason,
        ...extra,
      },
    ];
    changedTargetFields.add(field);
    return id;
  };
  const appendRows = (
    confirmation: Record<string, unknown>,
    fields: string[],
    action: CriticalAuditorRepairAction,
    defaultPrefix: string,
    extra: Record<string, unknown> = {}
  ) => {
    let primaryId = '';
    for (const field of fields) {
      const appendedId = appendRow(confirmation, field, action, defaultPrefix, extra);
      primaryId = primaryId || appendedId;
      if (primaryId) {
        const rows = asRecordArray(confirmation[field]);
        const last = rows[rows.length - 1];
        if (last && normalizeText(last.id) !== primaryId) {
          last.id = primaryId;
        }
      }
    }
    return primaryId;
  };
  const replaceRows = (
    confirmation: Record<string, unknown>,
    field: string,
    action: CriticalAuditorRepairAction,
    matchKeys: string[]
  ) => {
    const rows = asRecordArray(confirmation[field]);
    const value = recordObject(action.newValue);
    const nextRows = rows.filter((row) =>
      matchKeys.every((key) => {
        const replacementValue = normalizeText(value[key]);
        return !replacementValue || normalizeText(row[key]) !== replacementValue;
      })
    );
    const id =
      normalizeText(value.id ?? value.commandId) ||
      `${field === 'requiredCommands' ? 'CMD' : 'TARGET-MOD'}-${String(nextRows.length + 1).padStart(3, '0')}`;
    confirmation[field] = [
      ...nextRows,
      {
        id,
        ...value,
        ...repairBackRef(action, id),
        sourceSpan: action.sourceSpan,
        sourceText: action.sourceText,
        sourceRequirementIds: action.requirementIds,
        repairActionId: action.actionId,
        repairReason: action.reason,
      },
    ];
    changedTargetFields.add(field);
    return id;
  };
  const nextConfirmation: Record<string, unknown> = {
    ...input.confirmation,
  };
  for (const gap of asRecordArray(input.response.validatedGaps)) {
    const repairActions = asRecordArray(gap.repairActions) as unknown as CriticalAuditorRepairAction[];
    for (const action of repairActions) {
      const targetField = normalizeText(action.targetField);
      const allowedTargetFields = criticalAuditorRepairActionTargetFields(action.type);
      if (allowedTargetFields.length > 0 && !allowedTargetFields.includes(targetField)) {
        return {
          ok: false,
          issue: sourceMaterializationGateIssue(
            'critical_auditor_repair_action_target_field_mismatch',
            `Critical Auditor repair action ${action.actionId} targets ${targetField || '<missing>'}, which cannot be materialized by action type ${action.type}.`,
            [action.actionId, action.type, targetField || '<missing>', ...allowedTargetFields]
          ),
        };
      }
      let materializedRef = '';
      switch (action.type) {
        case 'add_must':
        case 'split_must':
          materializedRef = appendRow(nextConfirmation, 'must', action, 'MUST');
          break;
        case 'add_neg':
          materializedRef = appendRows(nextConfirmation, ['notDone', 'negativeRequirements'], action, 'NEG', {
            negativeAssertionRequired: true,
          });
          break;
        case 'add_out':
          materializedRef = appendRows(nextConfirmation, ['mustNot', 'outOfScope'], action, 'OUT', {
            userApprovalRequiredIfChanged: true,
          });
          break;
        case 'add_evidence':
          materializedRef = appendRow(nextConfirmation, 'evidence', action, 'EVD');
          break;
        case 'add_trace':
          materializedRef = appendRow(nextConfirmation, 'traceRows', action, 'TRACE');
          break;
        case 'add_acc':
          materializedRef = appendRows(
            nextConfirmation,
            ['acceptanceTests', 'acceptanceCriteria'],
            action,
            'ACC'
          );
          break;
        case 'add_e2e':
          materializedRef = appendRows(nextConfirmation, ['e2eSuites', 'e2eScenarios'], action, 'E2E');
          break;
        case 'add_business_view':
          materializedRef = appendRow(nextConfirmation, 'businessViews', action, 'BUSINESS-VIEW');
          break;
        case 'replace_target_path':
          materializedRef = replaceRows(nextConfirmation, 'targetModificationPaths', action, ['path']);
          break;
        case 'replace_validation_command':
          materializedRef = replaceRows(nextConfirmation, 'requiredCommands', action, ['command']);
          break;
        default:
          return {
            ok: false,
            issue: sourceMaterializationGateIssue(
              'critical_auditor_repair_action_type_unknown',
              `Critical Auditor repair action type ${normalizeText((action as Record<string, unknown>).type)} cannot be materialized.`,
              [normalizeText((action as Record<string, unknown>).type)]
            ),
          };
      }
      appliedActions.push({
        actionId: action.actionId,
        type: action.type,
        targetField: action.targetField,
        materializedRef,
        requirementIds: action.requirementIds,
        mustRefs: action.mustRefs,
      });
    }
  }
  if (appliedActions.length === 0) {
    return {
      ok: false,
      issue: sourceMaterializationGateIssue(
        'critical_auditor_repair_action_field_missing',
        'Validated Critical Auditor gaps require at least one materializable repair action.',
        ['validatedGaps.repairActions']
      ),
    };
  }
  const semanticAfterHash = implementationConfirmationHashForPreConfirmation(nextConfirmation);
  if (semanticAfterHash === semanticBeforeHash) {
    return {
      ok: false,
      issue: sourceMaterializationGateIssue(
        'source_gap_fix_semantic_hash_unchanged',
        'Validated Critical Auditor repair actions must change implementationConfirmation semantic fields, not only repair receipts.',
        appliedActions.map((action) => normalizeText(action.actionId))
      ),
    };
  }
  const existingRows = asRecordArray(input.confirmation.sourceGapFixes);
  Object.assign(nextConfirmation, {
    sourceGapFixes: [
      ...existingRows,
      {
        id: `GAP-FIX-${String(existingRows.length + 1).padStart(3, '0')}`,
        source: 'critical_auditor_validated_gap',
        status: 'materialized',
        validatedGapRefs: asRecordArray(input.response.validatedGaps).map((gap, index) =>
          normalizeText(gap.id ?? gap.code ?? `validated-gap-${index + 1}`)
        ),
        verdict: input.response.verdict,
        materializedAt: input.createdAt,
        appliedActions,
        targetFieldsChanged: Array.from(changedTargetFields).sort(),
        semanticHashBefore: semanticBeforeHash,
        semanticHashAfter: semanticAfterHash,
      },
    ],
    preConfirmationDrilldown: {
      ...recordObject(input.confirmation.preConfirmationDrilldown),
      criticalAuditor: {
        ...recordObject(recordObject(input.confirmation.preConfirmationDrilldown).criticalAuditor),
        consecutiveNoNewGapRounds: 0,
        convergenceVerdict: 'blocked_by_validated_gap_fix',
      },
    },
  });
  const repairDraftPath = path.join(input.paths.authoringDir, 'authoring-repair-draft-source.md');
  fs.writeFileSync(
    repairDraftPath,
    materializeImplementationConfirmationText(
      fs.readFileSync(input.sourcePath, 'utf8'),
      nextConfirmation
    ),
    'utf8'
  );
  const encodingGate = runEncodingIntegrityGate({
    root: input.root,
    paths: input.paths,
    targetPaths: [repairDraftPath],
  });
  if (encodingGate.issues.length > 0) {
    return { ok: false, issue: encodingGate.issues[0] };
  }
  const normalizedRepairDraft = normalizeImplementationConfirmationDraftForPromotion({
    root: input.root,
    draftPath: repairDraftPath,
    paths: input.paths,
    blockingStage: 'source_gap_fix_materialization_required',
  });
  if (!normalizedRepairDraft.ok) {
    return { ok: false, issue: normalizedRepairDraft.issues[0] };
  }
  const repairScaleAssessment = runPreConfirmationScaleAssessment({
    root: input.root,
    sourcePath: repairDraftPath,
    paths: input.paths,
    phase: 'initial_assessment',
  });
  if (repairScaleAssessment.issues.length > 0) {
    return { ok: false, issue: repairScaleAssessment.issues[0] };
  }
  const repairDraftText = fs.readFileSync(repairDraftPath, 'utf8');
  const repairDraftExtraction = extractImplementationConfirmationBlock(repairDraftText);
  if (!repairDraftExtraction) {
    return {
      ok: false,
      issue: sourceMaterializationGateIssue(
        'source_gap_fix_draft_missing_implementation_confirmation',
        'Validated Critical Auditor repair actions must produce a staging draft with implementationConfirmation before promotion.',
        [toRootRelativePath(input.root, repairDraftPath)]
      ),
    };
  }
  buildPreserveExistingAuthoringArtifacts({
    root: input.root,
    sourcePath: repairDraftPath,
    paths: input.paths,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    createdAt: input.createdAt,
    sourceText: repairDraftText,
    extraction: repairDraftExtraction,
    consecutiveNoNewGapRounds: 0,
  });
  const repairPostPacketScaleAssessment = runPreConfirmationScaleAssessment({
    root: input.root,
    sourcePath: repairDraftPath,
    paths: input.paths,
    phase: 'post_packet_assessment',
  });
  if (repairPostPacketScaleAssessment.issues.length > 0) {
    return { ok: false, issue: repairPostPacketScaleAssessment.issues[0] };
  }
  const mustGateScript = resolveSkillScript(input.root, 'pre_render_must_decomposition_gate.js');
  const mustGate = runNodeJson(
    mustGateScript,
    [
      '--source',
      repairDraftPath,
      '--authoring-dir',
      input.paths.authoringDir,
      '--out',
      input.paths.preRenderMustGate,
      '--receipt',
      input.paths.mustDecompositionReceipt,
      '--reconciliation-report',
      input.paths.reconciliationReport,
      '--json',
    ],
    input.root
  );
  if (!mustGate.json && !fs.existsSync(input.paths.reconciliationReport)) {
    return {
      ok: false,
      issue: commandFailureIssue(
        'source_gap_fix_reconciliation_report_missing',
        mustGateScript,
        mustGate
      ),
    };
  }
  let repairPostMaterializationScaleAssessment = runPreConfirmationScaleAssessment({
    root: input.root,
    sourcePath: repairDraftPath,
    paths: input.paths,
    phase: 'post_materialization_assessment',
  });
  if (repairPostMaterializationScaleAssessment.issues.length > 0) {
    return { ok: false, issue: repairPostMaterializationScaleAssessment.issues[0] };
  }
  let repairRouteDecision = repairPostMaterializationScaleAssessment.routingDecision;
  const checkpointEvidence = prepareAuthoringRepairCheckpointPersistenceEvidence({
    root: input.root,
    repairDraftPath,
    paths: input.paths,
    recordId: input.recordId,
    sourceDocumentHash: sourceDocumentHashForPreConfirmation(
      repairDraftText,
      repairDraftExtraction.blockText,
      repairDraftExtraction.confirmation
    ),
    implementationConfirmationHash: implementationConfirmationHashForPreConfirmation(
      repairDraftExtraction.confirmation
    ),
    createdAt: input.createdAt,
    routeDecision: repairRouteDecision,
  });
  if (!checkpointEvidence.ok) {
    return { ok: false, issue: checkpointEvidence.issue };
  }
  if (
    ['checkpoint_required', 'checkpoint_required_with_amendment'].includes(
      normalizeText(repairRouteDecision?.decision)
    )
  ) {
    repairPostMaterializationScaleAssessment = runPreConfirmationScaleAssessment({
      root: input.root,
      sourcePath: repairDraftPath,
      paths: input.paths,
      phase: 'post_materialization_assessment',
      checkpointPersistenceEvidencePath: input.paths.checkpointPersistenceEvidence,
    });
    if (repairPostMaterializationScaleAssessment.issues.length > 0) {
      return { ok: false, issue: repairPostMaterializationScaleAssessment.issues[0] };
    }
    repairRouteDecision = repairPostMaterializationScaleAssessment.routingDecision;
  }
  const currentTargetHash = fs.existsSync(input.sourcePath)
    ? sha256File(input.sourcePath)
    : 'absent';
  const repairDraftSemanticSourceHash = sourceDocumentHashForPreConfirmation(
    repairDraftText,
    repairDraftExtraction.blockText,
    repairDraftExtraction.confirmation
  );
  writeSourceMutationDecision({
    root: input.root,
    sourcePath: input.sourcePath,
    paths: input.paths,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    createdAt: input.createdAt,
    sourceDocumentExistedBefore: fs.existsSync(input.sourcePath),
    sourceHashBefore: currentTargetHash,
    sourceHashAfter: normalizedRepairDraft.draftHash,
    targetRawHashBefore: currentTargetHash,
    targetRawHashAfter: normalizedRepairDraft.draftHash,
    semanticSourceHashBefore: input.previousSourceDocumentHash,
    semanticSourceHashAfter: repairDraftSemanticSourceHash,
    issues: [],
    coverageDecision: 'pass',
    targetAuthorityDecision: 'pass',
    validationAuthorityDecision: 'pass',
    projectionSanityDecision: 'pass',
    auditEvidenceDecision: 'pass',
    scaleRoutingDecision:
      normalizeText(repairRouteDecision?.decision) ||
      normalizeText(repairPostPacketScaleAssessment.routingDecision?.decision) ||
      normalizeText(repairScaleAssessment.routingDecision?.decision) ||
      'authoring_repair_preserve_existing',
    reverseAuditDraftValidationDecision: 'pass',
    sourceMutationPerformed: false,
  });
  const promotion = promoteImplementationConfirmationDraftWithReceipt({
    root: input.root,
    sourcePath: input.sourcePath,
    draftPath: repairDraftPath,
    paths: input.paths,
  });
  if (!promotion.ok) {
    return { ok: false, issue: promotion.issues[0] };
  }
  const materialized = readMaterializedConfirmation(input.sourcePath);
  if (materialized.sourceDocumentHash === input.previousSourceDocumentHash) {
    return {
      ok: false,
      issue: sourceMaterializationGateIssue(
        'source_gap_fix_hash_unchanged',
        'Validated Critical Auditor gaps require a source document materialization that changes sourceDocumentHashAfter before the next audit round.',
        [input.previousSourceDocumentHash]
      ),
    };
  }
  return {
    ok: true,
    materialized,
    receipt: promotion.receipt,
    receiptPath: input.paths.promotionReceipt,
  };
}

function buildPreserveExistingAuthoringArtifacts(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  requirementSetId: string;
  createdAt: string;
  sourceText: string;
  extraction: NonNullable<ReturnType<typeof extractImplementationConfirmationBlock>>;
  consecutiveNoNewGapRounds: number;
}): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  semanticKernelHash: string;
  packetHash: string;
  mustRequirements: SourceMustRequirement[];
  packet: Record<string, unknown>;
  effectivePacket: Record<string, unknown>;
  auditInputHash: string;
} {
  const inlineMustRequirements = extractInlineMustRequirements(input.extraction.confirmation);
  const sourceBoundMustRequirements = mustRequirementsFromControlledCandidates(
    input.requirementSetId,
    buildControlledMustCandidatesFromPlainSource(input.root, input.sourcePath, input.sourceText)
  );
  const mustRequirements = mergeSourceBoundMustRequirements(
    inlineMustRequirements,
    sourceBoundMustRequirements
  );
  const sourceDocumentHash = sourceDocumentHashForPreConfirmation(
    input.sourceText,
    input.extraction.blockText,
    input.extraction.confirmation
  );
  const implementationConfirmationHash = implementationConfirmationHashForPreConfirmation(
    input.extraction.confirmation
  );
  const kernel = buildSemanticKernel({
    root: input.root,
    sourcePath: input.sourcePath,
    recordId: input.recordId,
    sourceDocumentHash,
    implementationConfirmationHash,
    createdAt: input.createdAt,
    mustRequirements,
  });
  kernel.kernelHash = sha256Json({
    schemaVersion: kernel.schemaVersion,
    recordId: kernel.recordId,
    sourceDocumentHash,
    implementationConfirmationHash,
    mustCandidates: kernel.mustCandidates,
    sourceRequirementTexts: kernel.sourceRequirementTexts,
    mode: 'preserve-existing',
  });
  kernel.contentHash = kernel.kernelHash;
  writeJsonUtf8(input.paths.semanticKernel, { semanticKernel: kernel });
  const semanticKernelHash = normalizeText(kernel.kernelHash);
  const packetHash = sha256Json({
    recordId: input.recordId,
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticKernelHash,
    mode: 'preserve-existing',
    mustRefs: mustRequirements.map((requirement) => requirement.id),
  });
  const packet = buildPreserveExistingMustDecompositionPacket({
    root: input.root,
    sourcePath: input.sourcePath,
    paths: input.paths,
    recordId: input.recordId,
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticKernelHash,
    packetHash,
    createdAt: input.createdAt,
    mustRequirements,
    confirmation: input.extraction.confirmation,
    consecutiveNoNewGapRounds: input.consecutiveNoNewGapRounds,
  });
  writeJsonUtf8(input.paths.mustDecompositionPacket, { must_decomposition_packet: packet });
  const preserveExistingCandidates: ControlledMustCandidate[] = mustRequirements.map(
    (requirement, index) => {
      const sourceLine = requirement.sourceLine ?? 1;
      return {
        candidateId: requirement.candidateId ?? `PRESERVE-${requirementOrdinal(index)}`,
        sourcePath:
          requirement.sourcePath ?? toRootRelativePath(input.root, input.sourcePath),
        sourceHash: sha256Text(input.sourceText),
        sourceDocumentHash: requirement.sourceDocumentHash ?? sourceDocumentHash,
        sourceSpan: requirement.sourceSpan ?? { startLine: sourceLine, endLine: sourceLine },
        headingPath: Array.isArray(requirement.headingPath) ? requirement.headingPath : [],
        blockKind: 'paragraph',
        requirementType: 'positive',
        coverageDecision: 'mapped_to_must',
        coverageReason: 'preserve-existing repair retained this requirement for checkpoint handoff',
        confidence: 1,
        tableContext: null,
        groupId: requirement.id,
        originalText: requirement.text,
        normalizedRequirement: requirement.text,
        decision: 'accepted_for_draft',
        decisionReason: 'preserve-existing repair retained requirement as controlled candidate',
        requiresHumanReview: false,
      };
    }
  );
  writeControlledMustCandidateArtifacts({
    root: input.root,
    sourcePath: input.sourcePath,
    paths: input.paths,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    createdAt: input.createdAt,
    sourceText: input.sourceText,
    candidates: preserveExistingCandidates,
    mustRequirements,
    draftConfirmation: input.extraction.confirmation,
    decision: 'draft_materialization_allowed',
  });
  const auditInputHash = sha256Json({
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticKernelHash,
    packetHash,
  });
  const effectivePacket = {
    ...packet,
    consecutiveNoNewValidGapRounds: input.consecutiveNoNewGapRounds,
    authorClaims: asRecordArray(packet.authorClaims).map((claim) => ({
      ...claim,
      criticDisposition:
        input.consecutiveNoNewGapRounds >= 3
          ? 'accepted_no_new_valid_gap'
          : 'pending_critical_auditor_response',
    })),
    mustPackets: asRecordArray(packet.mustPackets).map((mustPacket) => ({
      ...mustPacket,
      authorClaims: asRecordArray(mustPacket.authorClaims).map((claim) => ({
        ...claim,
        criticDisposition:
          input.consecutiveNoNewGapRounds >= 3
            ? 'accepted_no_new_valid_gap'
            : 'pending_critical_auditor_response',
      })),
    })),
  };
  return {
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticKernelHash,
    packetHash,
    mustRequirements,
    packet,
    effectivePacket,
    auditInputHash,
  };
}

function readMaterializedConfirmation(sourcePath: string): {
  sourceText: string;
  extraction: ImplementationConfirmationExtraction;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extraction = extractImplementationConfirmationBlock(sourceText);
  if (!extraction) {
    throw new Error(
      `implementationConfirmation block missing after materialization: ${sourcePath}`
    );
  }
  return {
    sourceText,
    extraction,
    sourceDocumentHash: sourceDocumentHashForPreConfirmation(
      sourceText,
      extraction.blockText,
      extraction.confirmation
    ),
    implementationConfirmationHash: implementationConfirmationHashForPreConfirmation(
      extraction.confirmation
    ),
  };
}

function buildSemanticKernel(input: {
  root: string;
  sourcePath: string;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  createdAt: string;
  mustRequirements: SourceMustRequirement[];
}): Record<string, unknown> {
  const mustRefs = input.mustRequirements.map((requirement) => requirement.id);
  const payload: Record<string, unknown> = {
    schemaVersion: 'semantic-kernel/v1',
    recordId: input.recordId,
    sourceDocument: toRootRelativePath(input.root, input.sourcePath),
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    goal: 'Prepare requirement scope confirmation through semantic drilldown without proving implementation completion.',
    currentState: input.mustRequirements.map(
      (requirement) =>
        `${requirement.id} is an authored source requirement awaiting packet-backed drilldown.`
    ),
    targetState: [
      'User-confirmable requirement confirmation page is rendered after atomic decomposition and gates pass.',
    ],
    nonGoals: [
      'No delivery readiness claim.',
      'No seventh mental model.',
      'No standalone orchestrator authority.',
    ],
    mustCandidates: mustRefs,
    sourceRequirementTexts: input.mustRequirements.map((requirement) => requirement.text),
    sourceRequirementMap: input.mustRequirements.map((requirement) => ({
      id: requirement.id,
      text: requirement.text,
      source: requirement.source,
      sourceLine: requirement.sourceLine,
      sourcePath: requirement.sourcePath,
      sourceDocumentHash: requirement.sourceDocumentHash,
      sourceSpan: requirement.sourceSpan,
      headingPath: requirement.headingPath,
      candidateId: requirement.candidateId,
    })),
    createdBy: 'main_agent_orchestration.requirement_confirmation.pre_confirmation_drilldown',
    createdAt: input.createdAt,
    inputRefs: [toRootRelativePath(input.root, input.sourcePath)],
  };
  payload.kernelHash = sha256Json({ ...payload, kernelHash: null });
  payload.contentHash = payload.kernelHash;
  return payload;
}

function buildMustDecompositionPacket(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  semanticKernelHash: string;
  packetHash: string;
  createdAt: string;
  mustRequirements: SourceMustRequirement[];
  targetAuthorityRecords?: TargetAuthorityRecord[];
  consecutiveNoNewGapRounds?: number;
}): Record<string, unknown> {
  const rel = (filePath: string) => toRootRelativePath(input.root, filePath);
  const materialized = (target: string) => [target];
  const mustRefs = input.mustRequirements.map((requirement) => requirement.id);
  const mustTexts = input.mustRequirements.map((requirement) => requirement.text);
  const totalMusts = input.mustRequirements.length;
  const targetAuthorityRecords = input.targetAuthorityRecords ?? [];
  const targetPathRowCount = targetAuthorityRecords.length + 2;
  const targetSurfaces = [
    ...targetAuthorityRecords.map((record) => record.path),
    rel(input.paths.preRenderMustGate),
    rel(input.paths.confirmationHtml),
  ];
  const payload: Record<string, unknown> = {
    schemaVersion: 'must-decomposition-packet/v1',
    recordId: input.recordId,
    sourceDocument: rel(input.sourcePath),
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    semanticKernelHash: input.semanticKernelHash,
    packetHash: input.packetHash,
    status: 'synchronized',
    generatedBy: 'main_agent_orchestration.requirement_confirmation.pre_confirmation_drilldown',
    createdBy: 'main_agent_orchestration.requirement_confirmation.pre_confirmation_drilldown',
    createdAt: input.createdAt,
    inputRefs: [rel(input.sourcePath), rel(input.paths.semanticKernel)],
    materializationTarget: 'implementationConfirmation',
    lifecycle: {
      currentMentalModel: 'requirement_confirmation',
      lane: 'pre_confirmation_drilldown',
      atomicDecompositionLoopEnteredBeforeMaterialization: true,
      materializationStartedAfterAtomicLoop: true,
      singlePassBypassPrevented: true,
      materializedAfterStatus: 'synchronized',
      controlledIngestRequiredBeforeMentalModelProgression: true,
    },
    consecutiveNoNewValidGapRounds: input.consecutiveNoNewGapRounds ?? 0,
    mustRefs,
    sourceRequirementTexts: mustTexts,
    authorClaims: [
      {
        id: 'CLAIM-001',
        claim: `Pre-confirmation packet is source-derived scope-quality evidence only, not implementation completion evidence, for ${mustRefs.join(', ')}.`,
        criticDisposition: 'accepted_no_new_valid_gap',
      },
    ],
    mustPackets: input.mustRequirements.map((requirement, index) => {
      const [authorTaskId, materializeTaskId] = atomicTaskIdsForMust(index, totalMusts);
      const matrixId = mdmIdForMust(index, totalMusts);
      const taskRows = [
        {
          id: authorTaskId,
          targetFiles: [rel(input.paths.semanticKernel), rel(input.paths.mustDecompositionPacket)],
          redProofPlan: `Gate fails without source-derived semantic kernel and synchronized packet row for ${requirement.id}.`,
          primaryObservableBehaviors: [`${requirement.id} enters semantic kernel and packet`],
          primaryAcceptanceOracles: [`${requirement.id} has synchronized mustPackets row`],
          derivedFromMustRef: requirement.id,
          materializedTo: materialized(
            `implementationConfirmation.atomicImplementationTaskList[${authorTaskId}]`
          ),
        },
        {
          id: materializeTaskId,
          targetFiles: [rel(input.sourcePath), rel(input.paths.confirmationHtml)],
          redProofPlan: `Renderer blocks if packet/source reconciliation omits ${requirement.id}.`,
          primaryObservableBehaviors: [
            `${requirement.id} is materialized into confirmation source`,
          ],
          primaryAcceptanceOracles: [`${requirement.id} is visible in confirmation-render-report`],
          derivedFromMustRef: requirement.id,
          materializedTo: materialized(
            `implementationConfirmation.atomicImplementationTaskList[${materializeTaskId}]`
          ),
        },
      ];
      return {
        mustRef: requirement.id,
        mustIntent: requirement.text,
        sourceRequirementText: requirement.text,
        sourceRequirementLine: requirement.sourceLine,
        sourceRequirementAuthority: requirement.source,
        sourcePath: requirement.sourcePath,
        sourceDocumentHash: requirement.sourceDocumentHash,
        sourceSpan: requirement.sourceSpan,
        headingPath: requirement.headingPath,
        candidateId: requirement.candidateId,
        decompositionBasis: {
          observableBehaviors: [
            `${requirement.id} is preserved from source text`,
            `${requirement.id} is split into authoring and materialization tasks`,
            `${requirement.id} is materialized only through packet projections`,
            `${requirement.id} is visible in the confirmation HTML`,
          ],
          targetSurfaces,
        },
        atomicityDrivers: {
          behaviorSurfaceOracleUnits: [
            `${requirement.id} authoring artifact production`,
            `${requirement.id} packet/source reconciliation`,
            `${requirement.id} renderer confirmability`,
          ],
          oneTaskPerIndependentBehaviorSurfaceOracle: true,
        },
        questionCoverage: {
          requiredCategories: [
            'scope_boundary',
            'atomicity',
            'projection',
            'confirmation_surface',
            'mental_model_progression',
          ],
          answeredCategories: [
            'scope_boundary',
            'atomicity',
            'projection',
            'confirmation_surface',
            'mental_model_progression',
          ],
          missingCategories: [],
          coverageVerdict: 'complete',
        },
        atomicityCompleteness: {
          splitRule: 'one_task_per_independent_behavior_surface_oracle',
          completenessVerdict: 'complete',
          expectedTaskCount: 2,
          actualTaskCount: 2,
        },
        authorClaims: [
          {
            id: `CLAIM-${requirement.id}`,
            claim: `${requirement.id} is split across source-derived authoring and render-confirmability surfaces.`,
            criticDisposition: 'accepted_no_new_valid_gap',
          },
        ],
        mustExecutionDecompositionMatrix: [
          {
            id: matrixId,
            mustRef: requirement.id,
            atomicTaskRefs: [authorTaskId, materializeTaskId],
            materializedTo: materialized(
              `implementationConfirmation.mustExecutionDecompositionMatrix[${matrixId}]`
            ),
          },
        ],
        mustAtomicTasks: taskRows,
        mustEvidenceProjection: [
          {
            id: 'EVD-001',
            materializedTo: materialized('implementationConfirmation.evidence[EVD-001]'),
          },
        ],
        mustTraceProjection: [
          {
            id: 'TRACE-001',
            materializedTo: materialized('implementationConfirmation.traceRows[TRACE-001]'),
          },
        ],
        mustAcceptanceProjection: [
          {
            id: 'ACC-001',
            materializedTo: materialized('implementationConfirmation.acceptanceTests[ACC-001]'),
          },
          {
            id: 'E2E-001',
            materializedTo: materialized('implementationConfirmation.e2eSuites[E2E-001]'),
          },
        ],
        mustFailureEdgeProjection: [
          {
            id: 'FAIL-001',
            materializedTo: materialized('implementationConfirmation.failurePaths[FAIL-001]'),
          },
          {
            id: 'EDGE-001',
            materializedTo: materialized('implementationConfirmation.edgeCases[EDGE-001]'),
          },
        ],
        mustTargetPathProjection: Array.from({ length: targetPathRowCount }, (_unused, rowIndex) => {
          const id = `TARGET-MOD-${requirementOrdinal(rowIndex)}`;
          return {
            id,
            materializedTo: materialized(`implementationConfirmation.targetModificationPaths[${id}]`),
          };
        }),
        mustCurrentTargetProjection: [
          {
            id: 'CT-CANON-001',
            materializedTo: materialized('implementationConfirmation.currentTargetMap'),
          },
        ],
        mustAiTddManifestProjection: [
          {
            id: 'AI-TDD-001',
            materializedTo: materialized(
              'implementationConfirmation.aiTddContractExecutionManifestProjection'
            ),
          },
        ],
        mustArtifactProjection: [
          {
            id: 'ART-001',
            materializedTo: materialized(
              'implementationConfirmation.artifactAutomationPlan[ART-001]'
            ),
          },
          {
            id: 'ART-002',
            materializedTo: materialized(
              'implementationConfirmation.artifactAutomationPlan[ART-002]'
            ),
          },
        ],
        mustCommandProjection: [
          {
            id: 'CMD-001',
            materializedTo: materialized('implementationConfirmation.requiredCommands[CMD-001]'),
          },
        ],
        mustCloseoutBoundaryProjection: [
          {
            id: 'CLOSEOUT-BOUNDARY-001',
            materializedTo: materialized('implementationConfirmation.closeoutReadinessPreview'),
          },
        ],
      };
    }),
    mustDerivedProjectionMap: input.mustRequirements.map((requirement) => ({
      mustRef: requirement.id,
      materializedTo: [
        'implementationConfirmation.currentTargetMap',
        'implementationConfirmation.aiTddContractExecutionManifestProjection',
        'implementationConfirmation.closeoutReadinessPreview',
      ],
    })),
  };
  payload.contentHash = input.packetHash;
  return payload;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function packetWithCriticalAuditorConvergence(
  packet: Record<string, unknown>,
  consecutiveNoNewGapRounds: number
): Record<string, unknown> {
  const criticDisposition =
    consecutiveNoNewGapRounds >= 3
      ? 'accepted_no_new_valid_gap'
      : 'pending_critical_auditor_response';
  return {
    ...packet,
    consecutiveNoNewValidGapRounds: consecutiveNoNewGapRounds,
    authorClaims: asRecordArray(packet.authorClaims).map((claim) => ({
      ...claim,
      criticDisposition,
    })),
    mustPackets: asRecordArray(packet.mustPackets).map((mustPacket) => ({
      ...mustPacket,
      authorClaims: asRecordArray(mustPacket.authorClaims).map((claim) => ({
        ...claim,
        criticDisposition,
      })),
    })),
  };
}

function projectionBackRefForRepair(packetHash: string, mustRef: string): Record<string, unknown> {
  return {
    derivedFromMustRef: mustRef,
    derivedFromPacketHash: packetHash,
    projectionStatus: 'synchronized',
  };
}

function sourceRowsForRepairProjection(
  confirmation: Record<string, unknown>,
  key: string
): Record<string, unknown>[] {
  if (key === 'currentTargetMap') {
    const currentTargetMap = recordObject(confirmation.currentTargetMap);
    return [
      ...asRecordArray(currentTargetMap.currentSummary),
      ...asRecordArray(currentTargetMap.targetSummary),
      ...asRecordArray(currentTargetMap.diffRows),
      ...asRecordArray(currentTargetMap.process),
      ...asRecordArray(currentTargetMap.artifactPaths),
      ...asRecordArray(currentTargetMap.canonicalArtifacts),
      ...asRecordArray(currentTargetMap.existingArtifacts),
    ];
  }
  if (key === 'aiTddContractExecutionManifestProjection') {
    return Object.entries(recordObject(confirmation.aiTddContractExecutionManifestProjection)).map(
      ([id, value]) => ({
        id,
        ...(value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : { value }),
      })
    );
  }
  if (key === 'closeoutReadinessPreview') {
    const closeout = recordObject(confirmation.closeoutReadinessPreview);
    return Object.keys(closeout).length ? [{ id: 'closeoutReadinessPreview', ...closeout }] : [];
  }
  return asRecordArray(confirmation[key]);
}

function rowIdForRepair(row: Record<string, unknown>, fallback: string): string {
  return normalizeText(
    row.id ?? row.taskId ?? row.commandId ?? row.artifactId ?? row.path ?? fallback
  );
}

function selectExistingRowIds(
  confirmation: Record<string, unknown>,
  keys: string[],
  fallbackIds: string[]
): string[] {
  const ids = keys
    .flatMap((key) => sourceRowsForRepairProjection(confirmation, key))
    .map((row, index) => rowIdForRepair(row, String(index)))
    .filter(Boolean);
  return ids.length > 0 ? ids : fallbackIds;
}

function buildPreserveExistingMustDecompositionPacket(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  semanticKernelHash: string;
  packetHash: string;
  createdAt: string;
  mustRequirements: SourceMustRequirement[];
  confirmation: Record<string, unknown>;
  consecutiveNoNewGapRounds: number;
}): Record<string, unknown> {
  const rel = (filePath: string) => toRootRelativePath(input.root, filePath);
  const mustRefs = input.mustRequirements.map((requirement) => requirement.id);
  const mustTexts = input.mustRequirements.map((requirement) => requirement.text);
  const firstMustRef = mustRefs[0] || 'MUST-001';
  const existingTaskRows = sourceRowsForRepairProjection(
    input.confirmation,
    'atomicImplementationTaskList'
  );
  const existingMatrixRows = sourceRowsForRepairProjection(
    input.confirmation,
    'mustExecutionDecompositionMatrix'
  );
  const existingTaskIds = existingTaskRows
    .map((row, index) => rowIdForRepair(row, String(index)))
    .filter(Boolean);
  const existingMatrixIds = existingMatrixRows
    .map((row, index) => rowIdForRepair(row, String(index)))
    .filter(Boolean);
  const evidenceIds = selectExistingRowIds(input.confirmation, ['evidence'], ['EVD-001']);
  const traceIds = selectExistingRowIds(input.confirmation, ['traceRows'], ['TRACE-001']);
  const acceptanceIds = selectExistingRowIds(input.confirmation, ['acceptanceTests'], ['ACC-001']);
  const e2eIds = selectExistingRowIds(input.confirmation, ['e2eSuites'], ['E2E-001']);
  const failureIds = selectExistingRowIds(input.confirmation, ['failurePaths'], ['FAIL-001']);
  const edgeIds = selectExistingRowIds(input.confirmation, ['edgeCases'], ['EDGE-001']);
  const targetIds = selectExistingRowIds(
    input.confirmation,
    ['targetModificationPaths'],
    ['TARGET-MOD-001']
  );
  const artifactIds = selectExistingRowIds(
    input.confirmation,
    ['artifactAutomationPlan'],
    ['ART-001']
  );
  const commandIds = selectExistingRowIds(input.confirmation, ['requiredCommands'], ['CMD-001']);
  const currentTargetIds = selectExistingRowIds(
    input.confirmation,
    ['currentTargetMap'],
    ['CT-CANON-001']
  );
  const aiTddIds = selectExistingRowIds(
    input.confirmation,
    ['aiTddContractExecutionManifestProjection'],
    ['AI-TDD-001']
  );
  const projection = (id: string, target: string, mustRef = firstMustRef) => ({
    id,
    mustRef,
    materializedTo: [target],
    ...projectionBackRefForRepair(input.packetHash, mustRef),
  });
  const payload: Record<string, unknown> = {
    schemaVersion: 'must-decomposition-packet/v1',
    recordId: input.recordId,
    sourceDocument: rel(input.sourcePath),
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    semanticKernelHash: input.semanticKernelHash,
    packetHash: input.packetHash,
    status: 'synchronized',
    generatedBy:
      'main_agent_orchestration.requirement_confirmation.authoring_repair.preserve_existing',
    createdBy:
      'main_agent_orchestration.requirement_confirmation.authoring_repair.preserve_existing',
    createdAt: input.createdAt,
    inputRefs: [rel(input.sourcePath), rel(input.paths.semanticKernel)],
    materializationTarget: 'implementationConfirmation',
    lifecycle: {
      currentMentalModel: 'requirement_confirmation',
      lane: 'authoring_repair',
      mode: 'preserve-existing',
      atomicDecompositionLoopEnteredBeforeMaterialization: true,
      materializationStartedAfterAtomicLoop: false,
      singlePassBypassPrevented: true,
      materializedAfterStatus: 'synchronized',
      controlledIngestRequiredBeforeMentalModelProgression: true,
    },
    consecutiveNoNewValidGapRounds: input.consecutiveNoNewGapRounds,
    mustRefs,
    sourceRequirementTexts: mustTexts,
    authorClaims: [
      {
        id: 'CLAIM-PRESERVE-EXISTING',
        claim:
          'Preserve-existing authoring repair synchronizes artifacts without replacing the rich source contract.',
        criticDisposition:
          input.consecutiveNoNewGapRounds >= 3
            ? 'accepted_no_new_valid_gap'
            : 'pending_critical_auditor_response',
      },
    ],
    mustPackets: input.mustRequirements.map((requirement, index) => {
      const existingTaskId =
        existingTaskIds[index] ||
        existingTaskIds[0] ||
        atomicTaskIdsForMust(index, input.mustRequirements.length)[0];
      const existingMatrixId =
        existingMatrixIds[index] ||
        existingMatrixIds[0] ||
        mdmIdForMust(index, input.mustRequirements.length);
      return {
        mustRef: requirement.id,
        mustIntent: requirement.text,
        sourceRequirementText: requirement.text,
        sourceRequirementLine: requirement.sourceLine,
        sourceRequirementAuthority: requirement.source,
        decompositionBasis: {
          observableBehaviors: [
            `${requirement.id} remains in the existing source`,
            `${requirement.id} is represented in semantic-kernel.json`,
            `${requirement.id} is represented in must_decomposition_packet.json`,
            `${requirement.id} blocks rendering until Critical Auditor convergence`,
          ],
          targetSurfaces: [
            rel(input.sourcePath),
            rel(input.paths.semanticKernel),
            rel(input.paths.mustDecompositionPacket),
          ],
        },
        atomicityDrivers: {
          behaviorSurfaceOracleUnits: [
            `${requirement.id} source preservation`,
            `${requirement.id} authoring artifact synchronization`,
            `${requirement.id} pre-render gate enforcement`,
          ],
          oneTaskPerIndependentBehaviorSurfaceOracle: true,
        },
        questionCoverage: {
          requiredCategories: ['scope_boundary', 'atomicity', 'projection', 'confirmation_surface'],
          answeredCategories: ['scope_boundary', 'atomicity', 'projection', 'confirmation_surface'],
          missingCategories: [],
          coverageVerdict: 'complete',
        },
        atomicityCompleteness: {
          splitRule: 'one_task_per_independent_behavior_surface_oracle',
          completenessVerdict: 'complete',
          expectedTaskCount: 1,
          actualTaskCount: 1,
        },
        authorClaims: [
          {
            id: `CLAIM-${requirement.id}`,
            claim: `${requirement.id} is repaired through artifact synchronization while preserving the source document.`,
            criticDisposition:
              input.consecutiveNoNewGapRounds >= 3
                ? 'accepted_no_new_valid_gap'
                : 'pending_critical_auditor_response',
          },
        ],
        mustExecutionDecompositionMatrix: [
          projection(
            existingMatrixId,
            existingMatrixRows.length > 0
              ? `implementationConfirmation.mustExecutionDecompositionMatrix[${existingMatrixId}]`
              : `implementationConfirmation.traceRows[${traceIds[0]}]`,
            requirement.id
          ),
        ],
        mustAtomicTasks: [
          {
            id: existingTaskId,
            targetFiles: [
              rel(input.paths.semanticKernel),
              rel(input.paths.mustDecompositionPacket),
              rel(input.paths.preRenderMustGate),
            ],
            redProofPlan: `Repair blocks if ${requirement.id} lacks synchronized authoring artifacts.`,
            primaryObservableBehaviors: [
              `${requirement.id} authoring repair artifact synchronization`,
            ],
            primaryAcceptanceOracles: [`${requirement.id} appears in semantic kernel and packet`],
            derivedFromMustRef: requirement.id,
            materializedTo: [
              existingTaskRows.length > 0
                ? `implementationConfirmation.atomicImplementationTaskList[${existingTaskId}]`
                : `implementationConfirmation.traceRows[${traceIds[0]}]`,
            ],
            ...projectionBackRefForRepair(input.packetHash, requirement.id),
          },
        ],
        mustEvidenceProjection: evidenceIds.map((id) =>
          projection(id, `implementationConfirmation.evidence[${id}]`, requirement.id)
        ),
        mustTraceProjection: traceIds.map((id) =>
          projection(id, `implementationConfirmation.traceRows[${id}]`, requirement.id)
        ),
        mustAcceptanceProjection: [
          ...acceptanceIds.map((id) =>
            projection(id, `implementationConfirmation.acceptanceTests[${id}]`, requirement.id)
          ),
          ...e2eIds.map((id) =>
            projection(id, `implementationConfirmation.e2eSuites[${id}]`, requirement.id)
          ),
        ],
        mustFailureEdgeProjection: [
          ...failureIds.map((id) =>
            projection(id, `implementationConfirmation.failurePaths[${id}]`, requirement.id)
          ),
          ...edgeIds.map((id) =>
            projection(id, `implementationConfirmation.edgeCases[${id}]`, requirement.id)
          ),
        ],
        mustTargetPathProjection: targetIds.map((id) =>
          projection(
            id,
            `implementationConfirmation.targetModificationPaths[${id}]`,
            requirement.id
          )
        ),
        mustCurrentTargetProjection: currentTargetIds.map((id) =>
          projection(id, 'implementationConfirmation.currentTargetMap', requirement.id)
        ),
        mustAiTddManifestProjection: aiTddIds.map((id) =>
          projection(
            id,
            'implementationConfirmation.aiTddContractExecutionManifestProjection',
            requirement.id
          )
        ),
        mustArtifactProjection: artifactIds.map((id) =>
          projection(id, `implementationConfirmation.artifactAutomationPlan[${id}]`, requirement.id)
        ),
        mustCommandProjection: commandIds.map((id) =>
          projection(id, `implementationConfirmation.requiredCommands[${id}]`, requirement.id)
        ),
        mustCloseoutBoundaryProjection: [
          projection(
            'CLOSEOUT-BOUNDARY-001',
            'implementationConfirmation.closeoutReadinessPreview',
            requirement.id
          ),
        ],
      };
    }),
    mustDerivedProjectionMap: mustRefs.map((mustRef) => ({
      mustRef,
      materializedTo: [
        'implementationConfirmation.currentTargetMap',
        'implementationConfirmation.aiTddContractExecutionManifestProjection',
        'implementationConfirmation.closeoutReadinessPreview',
      ],
    })),
  };
  payload.contentHash = input.packetHash;
  return payload;
}

function buildCriticalAuditorReceipt(input: {
  roundIndex: number;
  transactionId?: string;
  namespaceVersion?: string;
  requestHash?: string;
  gateDryRunHash?: string;
  responseHash?: string;
  auditInputHash: string;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  packetHash: string;
  createdAt: string;
  auditResult?: CriticalAuditorRoundResult;
}): Record<string, unknown> {
  const auditResult = input.auditResult ?? { verdict: 'no_new_valid_gap' as const };
  const isClean =
    auditResult.verdict === 'no_new_valid_gap' ||
    auditResult.verdict === 'no_new_confirmation_blocking_gap';
  const receipt: Record<string, unknown> = {
    schemaVersion: 'critical-auditor-receipt/v1',
    recordId: input.recordId,
    roundIndex: input.roundIndex,
    transactionId: input.transactionId,
    namespaceVersion: input.namespaceVersion,
    requestHash: input.requestHash,
    inputHash: input.auditInputHash,
    sourceHash: input.sourceDocumentHash,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    packetHash: input.packetHash,
    contentHash: input.packetHash,
    createdBy: 'critical_auditor.requirement_confirmation.pre_confirmation_drilldown',
    createdAt: input.createdAt,
    inputRefs: [
      'semantic-kernel.json',
      'must_decomposition_packet.json',
      'implementationConfirmation',
    ],
    attackVectors: ['under_split_task', 'missing_projection', 'source_row_independently_invented'],
    gapCandidates: auditResult.gapCandidates ?? [],
    validatedGaps: auditResult.validatedGaps ?? [],
    rejectedGapCandidates:
      auditResult.rejectedGapCandidates ??
      (isClean ? [{ id: `REJ-${input.roundIndex}`, reason: 'no new valid gap detected' }] : []),
    mutationPressureFindings: auditResult.mutationPressureFindings ?? [],
    overBroadTaskFindings: auditResult.overBroadTaskFindings ?? [],
    missingProjectionFindings: auditResult.missingProjectionFindings ?? [],
    invalidProofFindings: auditResult.invalidProofFindings ?? [],
    legacyBypassFindings: auditResult.legacyBypassFindings ?? [],
    sourceMaterializationFindings: auditResult.sourceMaterializationFindings ?? [],
    reviewedProjectionRefs: auditResult.reviewedProjectionRefs ?? [],
    reviewedMustRefs: auditResult.reviewedMustRefs ?? [],
    gateDryRunHash: input.gateDryRunHash ?? auditResult.gateDryRunHash ?? null,
    responseHash: input.responseHash ?? null,
    reconciliationIssueCount: auditResult.reconciliationIssueCount ?? null,
    checkedProjectionGroups: auditResult.checkedProjectionGroups ?? [],
    checkedProjectionQualityRuleCodes: auditResult.checkedProjectionQualityRuleCodes ?? [],
    priorFindingsDisposition: auditResult.priorFindingsDisposition ?? [],
    falsePositiveProofs: auditResult.falsePositiveProofs ?? [],
    noNewGapRationale:
      auditResult.rationale ??
      (isClean
        ? 'No new valid gap in this bounded audit round.'
        : 'Critical Auditor found a new gap; convergence counter resets.'),
    convergenceDecision: {
      verdict: auditResult.verdict,
      resetsConvergenceCounter: !isClean,
    },
  };
  receipt.receiptHash = sha256Json(receipt);
  return receipt;
}

function criticalAuditorReceiptMatchesCurrent(input: {
  receipt: Record<string, unknown> | null;
  roundIndex: number;
  transaction: CriticalAuditorStagingTransaction;
  auditInputHash: string;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  packetHash: string;
  requestHash: string;
  gateDryRunHash: string;
}): boolean {
  const receipt = input.receipt;
  if (!receipt) return false;
  const receiptHash = normalizeText(receipt.receiptHash);
  const receiptForHash = { ...receipt };
  delete receiptForHash.receiptHash;
  if (!receiptHash || receiptHash !== sha256Json(receiptForHash)) return false;
  if (normalizeText(receipt.schemaVersion) !== 'critical-auditor-receipt/v1') return false;
  if (Number(receipt.roundIndex) !== input.roundIndex) return false;
  if (normalizeText(receipt.transactionId) !== input.transaction.transactionId) return false;
  if (normalizeText(receipt.namespaceVersion) !== input.transaction.namespaceVersion) return false;
  if (normalizeText(receipt.recordId) !== input.recordId) return false;
  if (normalizeText(receipt.inputHash) !== input.auditInputHash) return false;
  if (normalizeText(receipt.sourceDocumentHash) !== input.sourceDocumentHash) return false;
  if (normalizeText(receipt.implementationConfirmationHash) !== input.implementationConfirmationHash) {
    return false;
  }
  if (normalizeText(receipt.packetHash) !== input.packetHash) return false;
  if (normalizeText(receipt.contentHash) !== input.packetHash) return false;
  if (normalizeText(receipt.requestHash) !== input.requestHash) return false;
  if (normalizeText(receipt.gateDryRunHash) !== input.gateDryRunHash) return false;
  return true;
}

function writeCriticalAuditorReceiptMirror(input: {
  rootReceiptPath: string;
  mirrorPath: string;
  transaction: CriticalAuditorStagingTransaction;
  authoringDir: string;
  receipt: Record<string, unknown>;
}): void {
  const payload = { criticalAuditorReceipt: input.receipt };
  const existingRoot = readJsonIfExists(input.rootReceiptPath);
  if (sha256Json(existingRoot ?? {}) !== sha256Json(payload)) {
    writeJsonUtf8(input.rootReceiptPath, payload);
  }
  const mirrorPayload = {
    criticalAuditorReceipt: input.receipt,
    transactionMirror: {
      transactionId: input.transaction.transactionId,
      sourcePath: path.relative(input.authoringDir, input.rootReceiptPath).replace(/\\/g, '/'),
    },
  };
  const existingMirror = readJsonIfExists(input.mirrorPath);
  if (sha256Json(existingMirror ?? {}) !== sha256Json(mirrorPayload)) {
    writeJsonUtf8(input.mirrorPath, mirrorPayload);
  }
}

function isNoNewGapVerdict(verdict: CriticalAuditorVerdict): boolean {
  return verdict === 'no_new_valid_gap' || verdict === 'no_new_confirmation_blocking_gap';
}

const CRITICAL_AUDITOR_PROJECTION_GROUPS = [
  'mustAtomicTasks',
  'mustExecutionDecompositionMatrix',
  'mustEvidenceProjection',
  'mustTraceProjection',
  'mustAcceptanceProjection',
  'mustFailureEdgeProjection',
  'mustTargetPathProjection',
  'mustCurrentTargetProjection',
  'mustAiTddManifestProjection',
  'mustArtifactProjection',
  'mustCommandProjection',
  'mustCloseoutBoundaryProjection',
];

const PROJECTION_QUALITY_RULE_CODES = [
  'projection_per_must_acceptance_not_independent',
  'projection_shared_evidence_without_per_must_oracle',
  'required_command_all_cover_all_without_per_must_assertions',
  'target_modification_path_all_cover_all',
  'current_target_map_not_product_specific',
  'business_visual_generic_or_compressed',
];

const CRITICAL_AUDITOR_ACTIONABLE_DRY_RUN_EXCLUSIONS = new Set([
  'critical_auditor_receipt_missing',
  'critical_auditor_less_than_three_no_new_gap_rounds',
  'author_claim_lacks_critic_disposition',
]);

const CRITICAL_AUDITOR_REPAIR_ACTION_TYPE_SET = new Set<string>(
  CRITICAL_AUDITOR_REPAIR_ACTION_TYPES
);

const CRITICAL_AUDITOR_REPAIR_ACTION_REQUIRED_FIELDS = [
  'sourceSpan',
  'sourceText',
  'targetField',
  'newValue',
  'reason',
  'mustRefs',
  'requirementIds',
];

function validateCriticalAuditorRepairActions(
  gaps: Record<string, unknown>[]
): { gaps: Array<Record<string, unknown> & { repairActions: CriticalAuditorRepairAction[] }>; issues: PreConfirmationDrilldownIssue[] } {
  const issues: PreConfirmationDrilldownIssue[] = [];
  const normalizedGaps = gaps.map((gap, gapIndex) => {
    const gapId = normalizeText(gap.id ?? gap.code ?? `validated-gap-${gapIndex + 1}`);
    const actions = asRecordArray(gap.repairActions);
    if (actions.length === 0) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_validated_gap_repair_actions_missing',
          `Validated gap ${gapId} must include non-empty repairActions[]`,
          [`${gapId}.repairActions`],
          'critical_auditor'
        )
      );
    }
    const normalizedActions = actions.map((action, actionIndex) => {
      const actionId = normalizeText(action.actionId ?? action.id) || `${gapId}-ACTION-${actionIndex + 1}`;
      const type = normalizeText(action.type ?? action.actionType);
      if (!CRITICAL_AUDITOR_REPAIR_ACTION_TYPE_SET.has(type)) {
        issues.push(
          preConfirmationIssue(
            'critical_auditor_repair_action_type_unknown',
            `Critical Auditor repair action ${actionId} uses unknown action type ${type || '<missing>'}`,
            [type || '<missing>'],
            'critical_auditor'
          )
        );
      }
      for (const field of CRITICAL_AUDITOR_REPAIR_ACTION_REQUIRED_FIELDS) {
        const value = action[field];
        const missing =
          value === undefined ||
          value === null ||
          (typeof value === 'string' && !normalizeText(value)) ||
          (Array.isArray(value) && value.length === 0) ||
          (field === 'sourceSpan' &&
            (typeof value !== 'object' || value === null || Array.isArray(value)));
        if (missing) {
          issues.push(
            preConfirmationIssue(
              'critical_auditor_repair_action_field_missing',
              `Critical Auditor repair action ${actionId} is missing required field ${field}`,
              [field],
              'critical_auditor'
            )
          );
        }
      }
      const mustRefs = asStringArray(action.mustRefs);
      const requirementIds = asStringArray(action.requirementIds);
      return {
        actionId,
        type: type as CriticalAuditorRepairActionType,
        sourceSpan: recordObject(action.sourceSpan),
        sourceText: normalizeText(action.sourceText),
        targetField: normalizeText(action.targetField),
        newValue: action.newValue,
        reason: normalizeText(action.reason),
        mustRefs,
        requirementIds,
      };
    });
    return {
      ...gap,
      repairActions: normalizedActions,
    };
  });
  return { gaps: normalizedGaps, issues };
}

function criticalAuditorRoundPerspective(roundIndex: number): Record<string, unknown> {
  const normalizedRound = ((Math.max(roundIndex, 1) - 1) % 3) + 1;
  if (normalizedRound === 1) {
    return {
      id: 'round_1_must_atomicity',
      focus: 'MUST atomicity, over-broad tasks, and missing decomposition',
      requiredAttackSurface: [
        'under_split_must',
        'over_broad_atomic_task',
        'missing_atomicity_driver',
        'missing_question_coverage',
      ],
    };
  }
  if (normalizedRound === 2) {
    return {
      id: 'round_2_projection_materialization',
      focus:
        'EVD / TRACE / ACC / E2E / FAIL / EDGE / artifact / command / AI-TDD projection materialization and per-MUST projection quality',
      requiredAttackSurface: [
        'missing_evidence_projection',
        'missing_trace_projection',
        'missing_acceptance_or_e2e_projection',
        'missing_failure_edge_projection',
        'missing_artifact_or_command_projection',
        'missing_ai_tdd_manifest_projection',
        'source_row_independently_invented',
        ...PROJECTION_QUALITY_RULE_CODES,
      ],
    };
  }
  return {
    id: 'round_3_authority_boundary_hash_delivery_confusion',
    focus:
      'stale hash, authority bypass, negative boundary, reconfirmation, and delivery-vs-confirmation confusion',
    requiredAttackSurface: [
      'stale_source_or_packet_hash',
      'authority_bypass',
      'negative_boundary_gap',
      'reconfirmation_required_gap',
      'delivery_readiness_confused_with_confirmation',
    ],
  };
}

function projectionRefsFromPacket(packet: Record<string, unknown>): string[] {
  const refs = new Set<string>();
  for (const mustPacket of asRecordArray(packet.mustPackets)) {
    const mustRef = normalizeText(mustPacket.mustRef);
    for (const key of CRITICAL_AUDITOR_PROJECTION_GROUPS) {
      for (const row of asRecordArray(mustPacket[key])) {
        const id = normalizeText(row.id);
        if (!id) continue;
        refs.add(id);
        if (mustRef) refs.add(`${mustRef}:${id}`);
        refs.add(`${key}:${id}`);
      }
    }
  }
  return [...refs].sort();
}

function actionableDryRunIssues(
  report: Record<string, unknown> | null
): PreConfirmationDrilldownIssue[] {
  return collectBlockingIssuesFromReports(report).filter(
    (issue) => !CRITICAL_AUDITOR_ACTIONABLE_DRY_RUN_EXCLUSIONS.has(issue.code)
  );
}

function buildCriticalAuditorGateDryRunSummary(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  roundIndex: number;
}): CriticalAuditorGateDryRunSummary {
  const dryRunBase = path.join(
    input.paths.authoringDir,
    `pre-render-must-decomposition-gate-dry-run-round-${input.roundIndex}`
  );
  const reportPath = `${dryRunBase}.json`;
  const receiptPath = `${dryRunBase}-receipt.json`;
  const reconciliationReportPath = `${dryRunBase}-reconciliation.json`;
  const mustGateScript = resolveSkillScript(input.root, 'pre_render_must_decomposition_gate.js');
  const dryRun = runNodeJson(
    mustGateScript,
    [
      '--source',
      input.sourcePath,
      '--authoring-dir',
      input.paths.authoringDir,
      '--out',
      reportPath,
      '--receipt',
      receiptPath,
      '--reconciliation-report',
      reconciliationReportPath,
      '--json',
    ],
    input.root
  );
  const report = dryRun.json ?? readJsonIfExists(reportPath);
  const reconciliation = readJsonIfExists(reconciliationReportPath);
  const blockingIssues = report
    ? collectBlockingIssuesFromReports(report)
    : [commandFailureIssue('critical_auditor_gate_dry_run_report_missing', mustGateScript, dryRun)];
  const actionableBlockingIssues = actionableDryRunIssues(report).concat(
    report
      ? []
      : [
          commandFailureIssue(
            'critical_auditor_gate_dry_run_report_missing',
            mustGateScript,
            dryRun
          ),
        ]
  );
  const summary = {
    reportPath,
    receiptPath,
    reconciliationReportPath,
    verdict: normalizeText(report?.verdict) || (dryRun.status === 0 ? 'PASS' : 'FAIL'),
    failedChecks: asStringArray(report?.failedChecks),
    blockingIssues,
    actionableBlockingIssues,
    actionableBlockingIssueCount: actionableBlockingIssues.length,
    reconciliation: {
      verdict: normalizeText(
        reconciliation?.verdict ?? recordObject(report?.packetSourceReconciliation).verdict
      ),
      issueCount: Number(reconciliation?.issueCount ?? 0),
      checkedGroups: asStringArray(reconciliation?.checkedGroups),
    },
  };
  return {
    ...summary,
    hash: sha256Json({
      schemaVersion: 'critical-auditor-gate-dry-run-summary/v1',
      roundIndex: input.roundIndex,
      verdict: summary.verdict,
      failedChecks: summary.failedChecks,
      actionableBlockingIssues: summary.actionableBlockingIssues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        refs: issue.refs,
      })),
      reconciliation: summary.reconciliation,
    }),
  };
}

function runCriticalAuditorReceiptLoop(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  transaction: CriticalAuditorStagingTransaction;
  auditInputHash: string;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  packetHash: string;
  mustRefs: string[];
  sourceRequirementTexts: string[];
  mustPacketCount: number;
  packet: Record<string, unknown>;
  createdAt: string;
  roundProvider?: (round: CriticalAuditorRoundInput) => CriticalAuditorRoundResult;
  maxRounds?: number;
}): {
  latestReceiptHash: string | null;
  consecutiveNoNewGapRounds: number;
  receipts: Record<string, unknown>[];
  requestPath?: string | null;
  continuation?: Record<string, unknown> | null;
  issues: PreConfirmationDrilldownIssue[];
} {
  if (!input.roundProvider) {
    const roundIndex = 1;
    const gateDryRun = buildCriticalAuditorGateDryRunSummary({
      root: input.root,
      sourcePath: input.sourcePath,
      paths: input.paths,
      roundIndex,
    });
    const candidateRequest = buildCriticalAuditorRoundRequest({
      root: input.root,
      sourcePath: input.sourcePath,
      recordId: input.recordId,
      roundIndex,
      transactionId: input.transaction.transactionId,
      namespaceVersion: input.transaction.namespaceVersion,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      packetHash: input.packetHash,
      auditInputHash: input.auditInputHash,
      mustRequirements: input.mustRefs.map((id, index) => ({
        id,
        text: input.sourceRequirementTexts[index] ?? id,
        sourceLine: index + 1,
      })),
      packet: input.packet,
      previousReceipts: [],
      gateDryRun,
      createdAt: input.createdAt,
    });
    const requestPath = criticalAuditorRequestPath(input.transaction, roundIndex);
    writeOrReuseCriticalAuditorRoundRequest({
      requestPath,
      candidate: candidateRequest,
    });
    return {
      latestReceiptHash: null,
      consecutiveNoNewGapRounds: 0,
      receipts: [],
      requestPath,
      continuation: {
        providerMode: 'main_session_inline',
        transactionId: input.transaction.transactionId,
        namespaceVersion: input.transaction.namespaceVersion,
        roundIndex,
        requestPath: toRootRelativePath(input.root, requestPath),
        responsePath: toRootRelativePath(
          input.root,
          criticalAuditorResponsePath(input.transaction, roundIndex)
        ),
        nextRequiredAction: 'run_main_session_critical_auditor_round',
      },
      issues: [
        preConfirmationIssue(
          'critical_auditor_provider_mode_required',
          'A real Critical Auditor round provider is required; synthetic clean receipts are not allowed',
          ['critical_auditor_receipt_loop'],
          'critical_auditor'
        ),
      ],
    };
  }
  const provider = input.roundProvider;
  const maxRounds = input.maxRounds && input.maxRounds > 0 ? input.maxRounds : 12;
  const receipts: Record<string, unknown>[] = [];
  const issues: PreConfirmationDrilldownIssue[] = [];
  let latestReceiptHash: string | null = null;
  let consecutiveNoNewGapRounds = 0;

  for (
    let roundIndex = 1;
    roundIndex <= maxRounds && consecutiveNoNewGapRounds < 3;
    roundIndex += 1
  ) {
    const gateDryRun = buildCriticalAuditorGateDryRunSummary({
      root: input.root,
      sourcePath: input.sourcePath,
      paths: input.paths,
      roundIndex,
    });
    const roundPerspective = criticalAuditorRoundPerspective(roundIndex);
    const projectionRefs = projectionRefsFromPacket(input.packet);
    const candidateRequest = buildCriticalAuditorRoundRequest({
      root: input.root,
      sourcePath: input.sourcePath,
      recordId: input.recordId,
      roundIndex,
      transactionId: input.transaction.transactionId,
      namespaceVersion: input.transaction.namespaceVersion,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      packetHash: input.packetHash,
      auditInputHash: input.auditInputHash,
      mustRequirements: input.mustRefs.map((id, index) => ({
        id,
        text: input.sourceRequirementTexts[index] ?? id,
        sourceLine: index + 1,
      })),
      packet: input.packet,
      previousReceipts: receipts,
      gateDryRun,
      createdAt: input.createdAt,
    });
    const requestPath = criticalAuditorRequestPath(input.transaction, roundIndex);
    const request = writeOrReuseCriticalAuditorRoundRequest({
      requestPath,
      candidate: candidateRequest,
    });
    const frozenGateDryRun = criticalAuditorGateDryRunSummaryFromRequest(request, gateDryRun);
    const receiptPath = criticalAuditorReceiptPath(input.transaction, roundIndex);
    const mirrorPath = path.join(input.paths.authoringDir, `critical-auditor-receipt-round-${roundIndex}.json`);
    const existingReceipt = unwrapCriticalAuditorReceipt(readJsonIfExists(receiptPath));
    let receipt: Record<string, unknown>;
    if (
      criticalAuditorReceiptMatchesCurrent({
        receipt: existingReceipt,
        roundIndex,
        transaction: input.transaction,
        auditInputHash: input.auditInputHash,
        recordId: input.recordId,
        sourceDocumentHash: input.sourceDocumentHash,
        implementationConfirmationHash: input.implementationConfirmationHash,
        packetHash: input.packetHash,
        requestHash: normalizeText(request.requestHash),
        gateDryRunHash: frozenGateDryRun.hash,
      })
    ) {
      receipt = existingReceipt;
    } else {
      let auditResult: CriticalAuditorRoundResult;
      try {
        auditResult = provider({
          roundIndex,
          transactionId: input.transaction.transactionId,
          namespaceVersion: input.transaction.namespaceVersion,
          auditInputHash: input.auditInputHash,
          recordId: input.recordId,
          sourceDocumentHash: input.sourceDocumentHash,
          implementationConfirmationHash: input.implementationConfirmationHash,
          packetHash: input.packetHash,
          roundPerspective,
          gateDryRun: frozenGateDryRun,
          packetProjectionSummary: {
            projectionGroups: CRITICAL_AUDITOR_PROJECTION_GROUPS,
            projectionRefs,
          },
          mustRefs: input.mustRefs,
          sourceRequirementTexts: input.sourceRequirementTexts,
          mustPacketCount: input.mustPacketCount,
          consecutiveNoNewGapRounds,
          previousReceipts: receipts,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code = normalizeText(message.split(':')[0]) || 'critical_auditor_provider_failed';
        issues.push(preConfirmationIssue(code, message, [`round-${roundIndex}`], 'critical_auditor'));
        break;
      }
      const bindingIssues = validateCriticalAuditorRoundResultBinding({
        roundIndex,
        auditResult,
        gateDryRun: frozenGateDryRun,
        packet: input.packet,
      });
      if (bindingIssues.length > 0) {
        issues.push(...bindingIssues);
        break;
      }
      receipt = buildCriticalAuditorReceipt({
        roundIndex,
        transactionId: input.transaction.transactionId,
        namespaceVersion: input.transaction.namespaceVersion,
        requestHash: normalizeText(request.requestHash),
        gateDryRunHash: frozenGateDryRun.hash,
        responseHash: sha256Json(auditResult),
        auditInputHash: input.auditInputHash,
        recordId: input.recordId,
        sourceDocumentHash: input.sourceDocumentHash,
        implementationConfirmationHash: input.implementationConfirmationHash,
        packetHash: input.packetHash,
        createdAt: input.createdAt,
        auditResult,
      });
    }
    latestReceiptHash = normalizeText(receipt.receiptHash);
    receipts.push(receipt);
    writeCriticalAuditorReceiptMirror({
      rootReceiptPath: receiptPath,
      mirrorPath,
      transaction: input.transaction,
      authoringDir: input.paths.authoringDir,
      receipt,
    });

    const verdict = normalizeCriticalAuditorVerdict(recordObject(receipt.convergenceDecision).verdict);
    if (verdict === 'blocked' || verdict === 'insufficient_audit') {
      issues.push(
        preConfirmationIssue(
          `critical_auditor_${verdict}`,
          `Critical Auditor round ${roundIndex} returned ${verdict}`,
          [`critical-auditor-receipt-round-${roundIndex}.json`],
          'critical_auditor'
        )
      );
      break;
    }

    const unresolvedGaps = asRecordArray(receipt.validatedGaps).filter((gap) => {
      const status = normalizeText(gap.status ?? gap.resolutionStatus);
      return ![
        'resolved',
        'converted_to_out_boundary',
        'converted_to_open_question',
        'rejected',
      ].includes(status);
    });
    if (unresolvedGaps.length > 0) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_unresolved_validated_gap',
          `Critical Auditor round ${roundIndex} returned unresolved validated gaps`,
          unresolvedGaps.map((gap) => normalizeText(gap.id ?? gap.code ?? 'gap')),
          'critical_auditor'
        )
      );
      consecutiveNoNewGapRounds = 0;
      break;
    }

    consecutiveNoNewGapRounds = isNoNewGapVerdict(verdict) ? consecutiveNoNewGapRounds + 1 : 0;
  }

  const derivedConvergence = deriveAuditConvergenceFromReceipts(
    receipts,
    input.sourceDocumentHash,
    input.implementationConfirmationHash,
    input.packetHash
  );
  if (derivedConvergence.issues.length > 0) {
    issues.push(...derivedConvergence.issues);
    consecutiveNoNewGapRounds = 0;
    latestReceiptHash = null;
  } else {
    consecutiveNoNewGapRounds = derivedConvergence.consecutiveNoNewGapRounds;
    latestReceiptHash = derivedConvergence.latestReceiptHash;
  }

  if (consecutiveNoNewGapRounds < 3 && issues.length === 0) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_no_new_gap_convergence_not_reached',
        `Critical Auditor did not reach three consecutive no-new-gap rounds within ${maxRounds} rounds`,
        ['critical_auditor_receipt_loop'],
        'critical_auditor'
      )
    );
  }

  return { latestReceiptHash, consecutiveNoNewGapRounds, receipts, issues };
}

function mirrorCriticalAuditorReceiptsForCurrentDraft(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  transaction: CriticalAuditorStagingTransaction;
  receipts: Record<string, unknown>[];
  auditInputHash: string;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  packetHash: string;
  mustRequirements: SourceMustRequirement[];
  packet: Record<string, unknown>;
  createdAt: string;
}): { latestReceiptHash: string | null; receipts: Record<string, unknown>[] } {
  let latestReceiptHash: string | null = null;
  const mirrored: Record<string, unknown>[] = [];
  for (const [index, receipt] of input.receipts.entries()) {
    const roundIndex = Number(receipt.roundIndex ?? index + 1);
    const auditResult: CriticalAuditorRoundResult = {
      verdict: normalizeCriticalAuditorVerdict(
        recordObject(receipt.convergenceDecision).verdict
      ),
      gapCandidates: asRecordArray(receipt.gapCandidates),
      validatedGaps: asRecordArray(receipt.validatedGaps),
      rejectedGapCandidates: asRecordArray(receipt.rejectedGapCandidates),
      mutationPressureFindings: asRecordArray(receipt.mutationPressureFindings),
      overBroadTaskFindings: asRecordArray(receipt.overBroadTaskFindings),
      missingProjectionFindings: asRecordArray(receipt.missingProjectionFindings),
      invalidProofFindings: asRecordArray(receipt.invalidProofFindings),
      legacyBypassFindings: asRecordArray(receipt.legacyBypassFindings),
      sourceMaterializationFindings: asRecordArray(receipt.sourceMaterializationFindings),
      reviewedMustRefs: asStringArray(receipt.reviewedMustRefs),
      reviewedProjectionRefs: asStringArray(receipt.reviewedProjectionRefs),
      checkedProjectionGroups: asStringArray(receipt.checkedProjectionGroups),
      checkedProjectionQualityRuleCodes: asStringArray(receipt.checkedProjectionQualityRuleCodes),
      priorFindingsDisposition: asRecordArray(receipt.priorFindingsDisposition),
      falsePositiveProofs: asRecordArray(receipt.falsePositiveProofs),
      rationale: normalizeText(receipt.noNewGapRationale) || 'No new valid gap detected in mirrored final draft receipt.',
      gateDryRunHash: normalizeText(receipt.gateDryRunHash) || undefined,
      reconciliationIssueCount:
        typeof receipt.reconciliationIssueCount === 'number'
          ? receipt.reconciliationIssueCount
          : undefined,
    };
    const gateDryRun = buildCriticalAuditorGateDryRunSummary({
      root: input.root,
      sourcePath: input.sourcePath,
      paths: input.paths,
      roundIndex,
    });
    const candidateRequest = buildCriticalAuditorRoundRequest({
      root: input.root,
      sourcePath: input.sourcePath,
      recordId: input.recordId,
      roundIndex,
      transactionId: input.transaction.transactionId,
      namespaceVersion: input.transaction.namespaceVersion,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      packetHash: input.packetHash,
      auditInputHash: input.auditInputHash,
      mustRequirements: input.mustRequirements,
      packet: input.packet,
      previousReceipts: mirrored,
      gateDryRun,
      createdAt: input.createdAt,
    });
    const request = writeOrReuseCriticalAuditorRoundRequest({
      requestPath: criticalAuditorRequestPath(input.transaction, roundIndex),
      candidate: candidateRequest,
    });
    const frozenGateDryRun = criticalAuditorGateDryRunSummaryFromRequest(request, gateDryRun);
    const receiptPath = criticalAuditorReceiptPath(input.transaction, roundIndex);
    const existingReceipt = unwrapCriticalAuditorReceipt(readJsonIfExists(receiptPath));
    const currentReceipt = criticalAuditorReceiptMatchesCurrent({
      receipt: existingReceipt,
      roundIndex,
      transaction: input.transaction,
      auditInputHash: input.auditInputHash,
      recordId: input.recordId,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      packetHash: input.packetHash,
      requestHash: normalizeText(request.requestHash),
      gateDryRunHash: frozenGateDryRun.hash,
    })
      ? existingReceipt
      : null;
    const mirroredReceipt = currentReceipt ?? buildCriticalAuditorReceipt({
      roundIndex,
      transactionId: input.transaction.transactionId,
      namespaceVersion: input.transaction.namespaceVersion,
      requestHash: normalizeText(request.requestHash),
      gateDryRunHash: frozenGateDryRun.hash,
      responseHash: normalizeText(receipt.responseHash) || undefined,
      auditInputHash: input.auditInputHash,
      recordId: input.recordId,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      packetHash: input.packetHash,
      createdAt: input.createdAt,
      auditResult,
    });
    latestReceiptHash = normalizeText(mirroredReceipt.receiptHash);
    writeCriticalAuditorReceiptMirror({
      rootReceiptPath: receiptPath,
      mirrorPath: path.join(input.paths.authoringDir, `critical-auditor-receipt-round-${roundIndex}.json`),
      transaction: input.transaction,
      authoringDir: input.paths.authoringDir,
      receipt: mirroredReceipt,
    });
    mirrored.push(mirroredReceipt);
  }
  return { latestReceiptHash, receipts: mirrored };
}

function deriveAuditConvergenceFromReceipts(
  receipts: Record<string, unknown>[],
  sourceDocumentHash: string,
  implementationConfirmationHash: string,
  packetHash: string
): {
  consecutiveNoNewGapRounds: number;
  latestReceiptHash: string | null;
  issues: PreConfirmationDrilldownIssue[];
} {
  let consecutiveNoNewGapRounds = 0;
  let latestReceiptHash: string | null = null;
  for (const receipt of receipts) {
    const receiptHash = normalizeText(receipt.receiptHash);
    const receiptForHash = { ...receipt };
    delete receiptForHash.receiptHash;
    const hashMatches = receiptHash === sha256Json(receiptForHash);
    const sourceMatches = normalizeText(receipt.sourceDocumentHash) === sourceDocumentHash;
    const confirmationMatches =
      normalizeText(receipt.implementationConfirmationHash) === implementationConfirmationHash;
    const packetMatches = normalizeText(receipt.contentHash) === packetHash;
    if (!receiptHash || !hashMatches || !sourceMatches || !confirmationMatches || !packetMatches) {
      return {
        consecutiveNoNewGapRounds: 0,
        latestReceiptHash: null,
        issues: [
          preConfirmationIssue(
            'synthetic_audit_convergence_forbidden',
            'Audit convergence cannot be claimed without real Critical Auditor receipts bound to the current source, confirmation, packet, and receipt hash.',
            ['critical_auditor_receipt_loop'],
            'critical_auditor'
          ),
        ],
      };
    }
    const verdict = normalizeText(recordObject(receipt.convergenceDecision).verdict);
    consecutiveNoNewGapRounds = isNoNewGapVerdict(verdict as CriticalAuditorVerdict)
      ? consecutiveNoNewGapRounds + 1
      : 0;
    latestReceiptHash = receiptHash;
  }
  return {
    consecutiveNoNewGapRounds,
    latestReceiptHash,
    issues:
      consecutiveNoNewGapRounds >= 3
        ? []
        : receipts.length > 0
          ? []
          : [],
  };
}

function readCriticalAuditorReceipts(authoringDir: string): Record<string, unknown>[] {
  if (!fs.existsSync(authoringDir)) {
    return [];
  }
  return fs
    .readdirSync(authoringDir)
    .filter((fileName) => /^critical-auditor-receipt-round-\d+\.json$/u.test(fileName))
    .map((fileName) => path.join(authoringDir, fileName))
    .map((filePath) => readJsonIfExists(filePath))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => recordObject(item.criticalAuditorReceipt ?? item))
    .sort((left, right) => Number(left.roundIndex ?? 0) - Number(right.roundIndex ?? 0));
}

function unwrapCriticalAuditorReceipt(
  value: Record<string, unknown> | null
): Record<string, unknown> | null {
  const receipt = value?.criticalAuditorReceipt ?? value;
  return receipt && typeof receipt === 'object' && !Array.isArray(receipt)
    ? (receipt as Record<string, unknown>)
    : null;
}

function authoringRepairPaths(root: string, paths: PreConfirmationPaths): Record<string, string> {
  return {
    authoringDir: toRootRelativePath(root, paths.authoringDir),
    semanticKernel: toRootRelativePath(root, paths.semanticKernel),
    mustDecompositionPacket: toRootRelativePath(root, paths.mustDecompositionPacket),
    promotionReceipt: toRootRelativePath(root, paths.promotionReceipt),
    sourceMaterializationReceipt: toRootRelativePath(root, paths.sourceMaterializationReceipt),
    packetSourceReconciliation: toRootRelativePath(root, paths.reconciliationReport),
    semanticCheckpointProgress: toRootRelativePath(root, paths.progress),
    semanticCheckpointReceiptGlob: `${toRootRelativePath(root, paths.authoringDir)}/checkpoint-receipt-cp-*.json`,
    preRenderMustDecompositionGate: toRootRelativePath(root, paths.preRenderMustGate),
  };
}

function authoringRepairCommand(sourcePath: string, responsePath?: string): string {
  const responseArg = responsePath ? ` --critical-auditor-response ${responsePath}` : '';
  return `main-agent-orchestration --action authoring-repair --mode preserve-existing --source ${sourcePath}${responseArg} --json`;
}

function buildAuthoringRepairResult(input: {
  root: string;
  sourcePath: string;
  recordId: string;
  requirementSetId: string;
  paths: PreConfirmationPaths;
  status: 'blocked' | 'pre_render_ready';
  blockingStage: string | null;
  nextRequiredAction: string;
  repairCommand?: string;
  artifacts?: string[];
  issues?: PreConfirmationDrilldownIssue[];
  warnings?: Array<Record<string, string>>;
  sourceDocumentHash?: string | null;
  implementationConfirmationHash?: string | null;
  packetHash?: string | null;
  consecutiveNoNewGapRounds?: number;
}): MainAgentAuthoringRepairResult {
  return {
    ok: input.status === 'pre_render_ready' && !input.blockingStage,
    status: input.status,
    mode: 'preserve-existing',
    purpose: 'post_materialization_deep_audit',
    purposeGuard: {
      purpose: 'post_materialization_deep_audit',
      requiredEvidence: [
        'current_source_hash',
        'inline_implementationConfirmation',
        'promotion_receipt',
      ],
      blockingStage:
        input.blockingStage === 'promotion_receipt_required_before_audit'
          ? 'promotion_receipt_required_before_deep_audit'
          : input.blockingStage,
      notAllowedBeforeMaterialization: [
        'critical_auditor_round_request_generation',
        'post_materialization_deep_audit',
        'grill_with_docs',
        'docs_review',
      ],
    },
    sourcePath: toRootRelativePath(input.root, input.sourcePath),
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    sourceDocumentHash: input.sourceDocumentHash ?? null,
    implementationConfirmationHash: input.implementationConfirmationHash ?? null,
    packetHash: input.packetHash ?? null,
    blockingStage: input.blockingStage,
    nextRequiredAction: input.nextRequiredAction,
    repairCommand:
      input.repairCommand ??
      authoringRepairCommand(toRootRelativePath(input.root, input.sourcePath)),
    artifacts: (input.artifacts ?? []).map((filePath) => toRootRelativePath(input.root, filePath)),
    paths: authoringRepairPaths(input.root, input.paths),
    blockingIssues: input.issues ?? [],
    warnings: input.warnings ?? [],
    consecutiveNoNewGapRounds: input.consecutiveNoNewGapRounds ?? 0,
  };
}

function buildCriticalAuditorRoundRequest(input: {
  root: string;
  sourcePath: string;
  recordId: string;
  roundIndex: number;
  transactionId?: string;
  namespaceVersion?: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  packetHash: string;
  auditInputHash: string;
  mustRequirements: SourceMustRequirement[];
  packet: Record<string, unknown>;
  previousReceipts: Record<string, unknown>[];
  gateDryRun: CriticalAuditorGateDryRunSummary;
  createdAt: string;
}): Record<string, unknown> {
  const roundPerspective = criticalAuditorRoundPerspective(input.roundIndex);
  const allProjectionRefs = projectionRefsFromPacket(input.packet);
  const request: Record<string, unknown> = {
    schemaVersion: 'critical-auditor-round-request/v1',
    purpose: 'critical_auditor_round',
    purposeGuard: {
      purpose: 'critical_auditor_round',
      parentPurpose: 'staging_transaction_deep_audit',
      requiredEvidence: [
        'gate_dry_run_hash',
        'staging_source_hash',
        'current_implementationConfirmation_hash',
        'current_packet_hash',
      ],
      sourceMaterializationRequiredBeforeDeepAudit: false,
      sourcePromotionForbiddenBeforeConvergence: true,
    },
    recordId: input.recordId,
    roundIndex: input.roundIndex,
    transactionId: input.transactionId,
    namespaceVersion: input.namespaceVersion,
    sourceDocument: toRootRelativePath(input.root, input.sourcePath),
    sourceHash: input.sourceDocumentHash,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    packetHash: input.packetHash,
    auditInputHash: input.auditInputHash,
    mustRefs: input.mustRequirements.map((requirement) => requirement.id),
    sourceRequirementTexts: input.mustRequirements.map((requirement) => requirement.text),
    packetProjectionSummary: {
      mustPacketCount: asRecordArray(input.packet.mustPackets).length,
      projectionGroups: CRITICAL_AUDITOR_PROJECTION_GROUPS,
      projectionRefs: allProjectionRefs,
    },
    projectionQualityGate: {
      requiredRuleCodes: PROJECTION_QUALITY_RULE_CODES,
      policy:
        'Every business MUST needs an independent ACC/E2E boundary or explicit per-MUST assertion mapping; shared EVD/CMD/path/currentTarget/business visual rows must declare per-MUST oracle, assertion, or responsibility mappings.',
    },
    previousReceipts: input.previousReceipts,
    roundPerspective,
    gateDryRun: {
      reportPath: toRootRelativePath(input.root, input.gateDryRun.reportPath),
      receiptPath: toRootRelativePath(input.root, input.gateDryRun.receiptPath),
      reconciliationReportPath: toRootRelativePath(
        input.root,
        input.gateDryRun.reconciliationReportPath
      ),
      gateDryRunHash: input.gateDryRun.hash,
      verdict: input.gateDryRun.verdict,
      failedChecks: input.gateDryRun.failedChecks,
      actionableBlockingIssueCount: input.gateDryRun.actionableBlockingIssueCount,
      actionableBlockingIssues: input.gateDryRun.actionableBlockingIssues,
      reconciliation: input.gateDryRun.reconciliation,
    },
    auditStandards: [
      `This round perspective is mandatory: ${normalizeText(roundPerspective.focus)}.`,
      'Consume gateDryRun before giving a verdict; no_new_* is forbidden when actionable gate dry-run blockers exist unless falsePositiveProofs[] provides machine-verifiable proof for every blocker.',
      'Find under-split MUST rows and over-broad atomic tasks.',
      'Find missing packet/source projections for EVD, TRACE, ACC, E2E, failure paths, edge cases, currentTargetMap, AI TDD manifest, commands, and closeout semantics.',
      'Find per-MUST independent acceptance gaps: every business MUST must have a distinct ACC/E2E boundary or explicit per-MUST assertions.',
      'Reject shared EVD, command, target path, currentTargetMap, or business visual rows that cover all MUST rows without per-MUST oracle, assertion, or responsibility mapping.',
      'Reject synthetic clean receipts; response must be authored by the main agent or LLM.',
      'Do not write source, packet, receipts, or control state from the response artifact.',
      'Convergence requires three consecutive no-new-valid-gap receipts, deterministic gate PASS, and packet/source reconciliation pass.',
    ],
    requiredResponseSchema: {
      schemaVersion: 'critical-auditor-round-response/v1',
      requestHash: '<copy requestHash>',
      recordId: input.recordId,
      roundIndex: input.roundIndex,
      transactionId: input.transactionId,
      namespaceVersion: input.namespaceVersion,
      sourceHash: input.sourceDocumentHash,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      packetHash: input.packetHash,
      gateDryRunHash: input.gateDryRun.hash,
      reconciliationIssueCount: input.gateDryRun.reconciliation.issueCount,
      checkedProjectionGroups: CRITICAL_AUDITOR_PROJECTION_GROUPS,
      checkedProjectionQualityRuleCodes: PROJECTION_QUALITY_RULE_CODES,
      verdict:
        'no_new_valid_gap | no_new_confirmation_blocking_gap | new_valid_gap | insufficient_audit | blocked',
      reviewedMustRefs: input.mustRequirements.map((requirement) => requirement.id),
      reviewedProjectionRefs: '<non-empty subset of packetProjectionSummary.projectionRefs>',
      priorFindingsDisposition: [
        {
          findingRef: '<previous finding id or dry-run blocker code>',
          disposition: 'new | resolved | unchanged | rejected',
          evidenceRefs: [],
        },
      ],
      falsePositiveProofs: [
        {
          blockerCode:
            '<required only when gateDryRun.actionableBlockingIssueCount > 0 and verdict is no_new_*>',
          proofType:
            'current_source_packet_hash_match | source_row_backref_resolves | projection_materialized | reconciliation_count_match',
          evidenceRefs: [],
        },
      ],
      gapCandidates: [],
      validatedGaps: [],
      rejectedGapCandidates: [],
      rationale: '<required>',
    },
    createdBy:
      'main_agent_orchestration.requirement_confirmation.authoring_repair.preserve_existing',
    createdAt: input.createdAt,
  };
  request.requestHash = sha256Json({ ...request, requestHash: null });
  return request;
}

function criticalAuditorRoundRequestMatchesCurrent(
  existing: Record<string, unknown>,
  candidate: Record<string, unknown>
): boolean {
  const comparableScalarKeys = [
    'schemaVersion',
    'recordId',
    'roundIndex',
    'transactionId',
    'namespaceVersion',
    'sourceHash',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'packetHash',
    'auditInputHash',
  ];
  for (const key of comparableScalarKeys) {
    if (normalizeText(existing[key]) !== normalizeText(candidate[key])) {
      return false;
    }
  }
  // A published round request is the hash authority for response-file recovery.
  // Gate dry-run noise can change between retries without changing the source,
  // packet, or implementationConfirmation hashes, so keep the original request
  // frozen until the transaction identity changes.
  const comparableArrayKeys = ['mustRefs', 'sourceRequirementTexts'];
  for (const key of comparableArrayKeys) {
    if (sha256Json(asStringArray(existing[key])) !== sha256Json(asStringArray(candidate[key]))) {
      return false;
    }
  }
  const existingProjectionSummary = recordObject(existing.packetProjectionSummary);
  const candidateProjectionSummary = recordObject(candidate.packetProjectionSummary);
  if (
    sha256Json(asStringArray(existingProjectionSummary.projectionRefs)) !==
    sha256Json(asStringArray(candidateProjectionSummary.projectionRefs))
  ) {
    return false;
  }
  if (
    sha256Json(asRecordArray(existing.previousReceipts)) !==
    sha256Json(asRecordArray(candidate.previousReceipts))
  ) {
    return false;
  }
  return Boolean(normalizeText(existing.requestHash));
}

function writeOrReuseCriticalAuditorRoundRequest(input: {
  requestPath: string;
  candidate: Record<string, unknown>;
}): Record<string, unknown> {
  const existing = readJsonIfExists(input.requestPath);
  if (existing && criticalAuditorRoundRequestMatchesCurrent(existing, input.candidate)) {
    return existing;
  }
  writeJsonUtf8(input.requestPath, input.candidate);
  return input.candidate;
}

function criticalAuditorGateDryRunSummaryFromRequest(
  request: Record<string, unknown>,
  fallback: CriticalAuditorGateDryRunSummary
): CriticalAuditorGateDryRunSummary {
  const gateDryRun = recordObject(request.gateDryRun);
  if (Object.keys(gateDryRun).length === 0) {
    return fallback;
  }
  const reconciliation = recordObject(gateDryRun.reconciliation);
  const actionableBlockingIssues = asRecordArray(gateDryRun.actionableBlockingIssues)
    .map((issue) => ({
      code: normalizeText(issue.code),
      message: normalizeText(issue.message),
      refs: asStringArray(issue.refs),
      category: normalizeText(issue.category),
    }))
    .filter((issue) => issue.code) as PreConfirmationDrilldownIssue[];
  const blockingIssues = asRecordArray(gateDryRun.blockingIssues)
    .map((issue) => ({
      code: normalizeText(issue.code),
      message: normalizeText(issue.message),
      refs: asStringArray(issue.refs),
      category: normalizeText(issue.category),
    }))
    .filter((issue) => issue.code) as PreConfirmationDrilldownIssue[];
  return {
    reportPath: normalizeText(gateDryRun.reportPath) || fallback.reportPath,
    receiptPath: normalizeText(gateDryRun.receiptPath) || fallback.receiptPath,
    reconciliationReportPath:
      normalizeText(gateDryRun.reconciliationReportPath) || fallback.reconciliationReportPath,
    verdict: normalizeText(gateDryRun.verdict) || fallback.verdict,
    failedChecks: asStringArray(gateDryRun.failedChecks),
    blockingIssues: blockingIssues.length > 0 ? blockingIssues : fallback.blockingIssues,
    actionableBlockingIssues,
    actionableBlockingIssueCount: Number(
      gateDryRun.actionableBlockingIssueCount ?? actionableBlockingIssues.length
    ),
    reconciliation: {
      verdict: normalizeText(reconciliation.verdict),
      issueCount: Number(reconciliation.issueCount ?? 0),
      checkedGroups: asStringArray(reconciliation.checkedGroups),
    },
    hash:
      normalizeText(gateDryRun.gateDryRunHash) ||
      normalizeText(gateDryRun.hash) ||
      fallback.hash,
  };
}

function findCriticalAuditorRequestPath(authoringDir: string, roundIndex: number): string {
  return path.join(authoringDir, `critical-auditor-round-request-${roundIndex}.json`);
}

function findNextCriticalAuditorRound(authoringDir: string): number {
  const receipts = readCriticalAuditorReceipts(authoringDir);
  return receipts.length + 1;
}

function archiveCriticalAuditorArtifacts(input: {
  authoringDir: string;
  stagingDir?: string;
  reason: string;
  auditInputHash: string;
  createdAt: string;
}): string | null {
  if (!fs.existsSync(input.authoringDir)) {
    return null;
  }
  const artifactPattern =
    /^(?:(?:critical-auditor-round-(?:request|response)-\d+)|(?:critical-auditor-receipt-round-\d+)|pre-render-must-decomposition-gate-dry-run-round-\d+(?:-receipt|-reconciliation)?)\.json$/u;
  const artifactEntries: Array<{ absolutePath: string; archiveRelativePath: string }> = [];
  for (const fileName of fs.readdirSync(input.authoringDir)) {
    if (artifactPattern.test(fileName)) {
      artifactEntries.push({
        absolutePath: path.join(input.authoringDir, fileName),
        archiveRelativePath: fileName,
      });
    }
  }
  if (input.stagingDir && fs.existsSync(input.stagingDir)) {
    const stagingName = path.basename(input.stagingDir);
    for (const fileName of fs.readdirSync(input.stagingDir)) {
      if (artifactPattern.test(fileName)) {
        artifactEntries.push({
          absolutePath: path.join(input.stagingDir, fileName),
          archiveRelativePath: path.join('staging', stagingName, fileName),
        });
      }
    }
  }
  if (artifactEntries.length === 0) {
    return null;
  }
  const stamp = input.createdAt.replace(/[^0-9A-Za-z]+/gu, '').slice(0, 15) || 'archive';
  const archiveDir = path.join(
    input.authoringDir,
    'archive',
    `${stamp}-${sha256Text(input.auditInputHash).slice(
      'sha256:'.length,
      'sha256:'.length + 12
    )}-stale-namespace`
  );
  fs.mkdirSync(archiveDir, { recursive: true });
  for (const artifact of artifactEntries) {
    const archivePath = path.join(archiveDir, artifact.archiveRelativePath);
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    fs.renameSync(artifact.absolutePath, archivePath);
  }
  writeJsonUtf8(path.join(archiveDir, 'archive-manifest.json'), {
    schemaVersion: 'critical-auditor-stale-archive/v1',
    reason: input.reason,
    auditInputHash: input.auditInputHash,
    archivedAt: input.createdAt,
    artifacts: artifactEntries.map((artifact) => artifact.archiveRelativePath.replace(/\\/g, '/')),
  });
  return archiveDir;
}

function collectStaleCriticalAuditorArtifactIssues(input: {
  authoringDir: string;
  auditInputHash: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  packetHash: string;
}): PreConfirmationDrilldownIssue[] {
  if (!fs.existsSync(input.authoringDir)) {
    return [];
  }
  const issues: PreConfirmationDrilldownIssue[] = [];
  const staleIfMismatch = (
    artifactName: string,
    artifact: Record<string, unknown> | null,
    hashFields: string[]
  ) => {
    if (!artifact) {
      return;
    }
    for (const field of hashFields) {
      const expected = normalizeText((input as unknown as Record<string, unknown>)[field]);
      if (
        expected &&
        normalizeText(artifact[field]) &&
        normalizeText(artifact[field]) !== expected
      ) {
        issues.push(
          preConfirmationIssue(
            `critical_auditor_${artifactName.replace(/\W+/gu, '_')}_${field}_stale`,
            `Critical Auditor artifact ${artifactName} has stale ${field}`,
            [artifactName, field],
            'critical_auditor'
          )
        );
      }
    }
  };
  for (const fileName of fs.readdirSync(input.authoringDir)) {
    const filePath = path.join(input.authoringDir, fileName);
    if (/^critical-auditor-round-request-\d+\.json$/u.test(fileName)) {
      const request = readJsonIfExists(filePath);
      staleIfMismatch(fileName, request, [
        'sourceDocumentHash',
        'implementationConfirmationHash',
        'packetHash',
        'auditInputHash',
      ]);
    }
    if (/^critical-auditor-round-response-\d+\.json$/u.test(fileName)) {
      const response = readJsonIfExists(filePath);
      staleIfMismatch(fileName, response, [
        'sourceDocumentHash',
        'implementationConfirmationHash',
        'packetHash',
      ]);
    }
    if (/^critical-auditor-receipt-round-\d+\.json$/u.test(fileName)) {
      const receipt = unwrapCriticalAuditorReceipt(readJsonIfExists(filePath));
      staleIfMismatch(fileName, receipt, [
        'sourceDocumentHash',
        'implementationConfirmationHash',
        'packetHash',
      ]);
      if (receipt && normalizeText(receipt.inputHash) !== input.auditInputHash) {
        issues.push(
          preConfirmationIssue(
            'critical_auditor_receipt_input_hash_stale',
            `Critical Auditor artifact ${fileName} has stale inputHash`,
            [fileName, 'inputHash'],
            'critical_auditor'
          )
        );
      }
      if (receipt && !normalizeText(receipt.gateDryRunHash)) {
        issues.push(
          preConfirmationIssue(
            'critical_auditor_receipt_gate_dry_run_hash_missing',
            `Critical Auditor artifact ${fileName} lacks gateDryRunHash`,
            [fileName, 'gateDryRunHash'],
            'critical_auditor'
          )
        );
      }
    }
  }
  return issues;
}

function collectConsecutiveNoNewGapFromReceipts(
  receipts: Record<string, unknown>[],
  auditInputHash: string
): {
  consecutive: number;
  issues: PreConfirmationDrilldownIssue[];
  latestReceiptHash: string | null;
} {
  const issues: PreConfirmationDrilldownIssue[] = [];
  let consecutive = 0;
  let latestReceiptHash: string | null = null;
  for (const receipt of receipts) {
    latestReceiptHash = normalizeText(receipt.receiptHash) || sha256Json(receipt);
    if (receipt.inputHash !== auditInputHash) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_receipt_input_hash_stale',
          `Critical Auditor receipt round ${receipt.roundIndex ?? '?'} is stale for current source/packet hashes`,
          ['inputHash'],
          'critical_auditor'
        )
      );
      consecutive = 0;
      continue;
    }
    if (!normalizeText(receipt.gateDryRunHash)) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_receipt_gate_dry_run_hash_missing',
          `Critical Auditor receipt round ${receipt.roundIndex ?? '?'} lacks gateDryRunHash and must be regenerated`,
          ['gateDryRunHash'],
          'critical_auditor'
        )
      );
      consecutive = 0;
      continue;
    }
    const verdict = normalizeText(
      recordObject(receipt.convergenceDecision).verdict
    ) as CriticalAuditorVerdict;
    consecutive = isNoNewGapVerdict(verdict) ? consecutive + 1 : 0;
  }
  return { consecutive, issues, latestReceiptHash };
}

function validateCriticalAuditorResponse(input: {
  responsePath: string;
  request: Record<string, unknown>;
  transaction?: CriticalAuditorStagingTransaction;
  roundIndex?: number;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  packetHash: string;
  mustRefs: string[];
  packet: Record<string, unknown>;
  gateDryRun: CriticalAuditorGateDryRunSummary;
}): { response: CriticalAuditorRoundResult | null; issues: PreConfirmationDrilldownIssue[] } {
  const parsed = readJsonIfExists(input.responsePath);
  const issues: PreConfirmationDrilldownIssue[] = [];
  if (!parsed) {
    return {
      response: null,
      issues: [
        preConfirmationIssue(
          'critical_auditor_response_unreadable',
          'Critical Auditor response is missing or unreadable',
          [input.responsePath],
          'critical_auditor'
        ),
      ],
    };
  }
  const requestHash = normalizeText(input.request.requestHash);
  if (normalizeText(parsed.requestHash) !== requestHash) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_request_hash_mismatch',
        'Critical Auditor response requestHash does not match the current request',
        ['requestHash'],
        'critical_auditor'
      )
    );
  }
  const expectedRoundIndex = Number(input.roundIndex ?? input.request.roundIndex ?? 0);
  if (expectedRoundIndex > 0 && Number(parsed.roundIndex) !== expectedRoundIndex) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_round_index_mismatch',
        'Critical Auditor response roundIndex does not match the current request',
        ['roundIndex'],
        'critical_auditor'
      )
    );
  }
  if (
    input.transaction &&
    normalizeText(parsed.transactionId) !== input.transaction.transactionId
  ) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_transaction_id_mismatch',
        'Critical Auditor response transactionId does not match the active staging transaction',
        ['transactionId'],
        'critical_auditor'
      )
    );
  }
  if (
    input.transaction &&
    normalizeText(parsed.namespaceVersion) !== input.transaction.namespaceVersion
  ) {
    issues.push(
      preConfirmationIssue(
        'id_namespace_mismatch',
        'Critical Auditor response namespaceVersion does not match the active namespace',
        ['namespaceVersion'],
        'critical_auditor'
      )
    );
  }
  if (normalizeText(parsed.sourceHash) && normalizeText(parsed.sourceHash) !== input.sourceDocumentHash) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_source_hash_stale',
        'Critical Auditor response sourceHash is stale',
        ['sourceHash'],
        'critical_auditor'
      )
    );
  }
  if (normalizeText(parsed.sourceDocumentHash) !== input.sourceDocumentHash) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_source_hash_stale',
        'Critical Auditor response sourceDocumentHash is stale',
        ['sourceDocumentHash'],
        'critical_auditor'
      )
    );
  }
  if (
    normalizeText(parsed.implementationConfirmationHash) !== input.implementationConfirmationHash
  ) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_implementation_hash_stale',
        'Critical Auditor response implementationConfirmationHash is stale',
        ['implementationConfirmationHash'],
        'critical_auditor'
      )
    );
  }
  if (normalizeText(parsed.packetHash) !== input.packetHash) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_packet_hash_stale',
        'Critical Auditor response packetHash is stale',
        ['packetHash'],
        'critical_auditor'
      )
    );
  }
  const verdict = normalizeText(parsed.verdict) as CriticalAuditorVerdict;
  if (!verdict) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_verdict_missing',
        'Critical Auditor response must include verdict',
        ['verdict'],
        'critical_auditor'
      )
    );
  }
  if (
    !isNoNewGapVerdict(verdict) &&
    !['new_valid_gap', 'insufficient_audit', 'blocked'].includes(verdict)
  ) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_verdict_invalid',
        'Critical Auditor response verdict is not an allowed value',
        ['verdict'],
        'critical_auditor'
      )
    );
  }
  if (verdict === 'blocked' && !hasCriticalAuditorBlockedEvidence(parsed)) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_blocked_evidence_missing',
        'Critical Auditor response verdict blocked requires source materialization, missing projection, source/projection invalid proof, or gate dry-run blocker evidence',
        ['sourceMaterializationFindings', 'missingProjectionFindings', 'invalidProofFindings', 'gateDryRunBlockers'],
        'critical_auditor'
      )
    );
  }
  if (verdict === 'insufficient_audit' && !hasCriticalAuditorInsufficientAuditEvidence(parsed)) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_insufficient_audit_evidence_missing',
        'Critical Auditor response verdict insufficient_audit requires invalidProofFindings that explicitly describe incomplete audit evidence',
        ['invalidProofFindings'],
        'critical_auditor'
      )
    );
  }
  if (normalizeText(parsed.gateDryRunHash) !== input.gateDryRun.hash) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_gate_dry_run_hash_mismatch',
        'Critical Auditor response gateDryRunHash does not match the current gate dry-run',
        ['gateDryRunHash'],
        'critical_auditor'
      )
    );
  }
  if (Number(parsed.reconciliationIssueCount) !== input.gateDryRun.reconciliation.issueCount) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_reconciliation_issue_count_mismatch',
        'Critical Auditor response reconciliationIssueCount does not match the current gate dry-run',
        ['reconciliationIssueCount'],
        'critical_auditor'
      )
    );
  }
  const checkedProjectionGroups = new Set(asStringArray(parsed.checkedProjectionGroups));
  for (const group of CRITICAL_AUDITOR_PROJECTION_GROUPS) {
    if (!checkedProjectionGroups.has(group)) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_response_checked_projection_group_missing',
          `Critical Auditor response did not check projection group ${group}`,
          [group],
          'critical_auditor'
        )
      );
    }
  }
  const checkedProjectionQualityRuleCodes = new Set(
    asStringArray(parsed.checkedProjectionQualityRuleCodes)
  );
  for (const ruleCode of PROJECTION_QUALITY_RULE_CODES) {
    if (!checkedProjectionQualityRuleCodes.has(ruleCode)) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_response_checked_projection_quality_rule_missing',
          `Critical Auditor response did not check projection quality rule ${ruleCode}`,
          [ruleCode],
          'critical_auditor'
        )
      );
    }
  }
  const priorFindingsDisposition = asRecordArray(parsed.priorFindingsDisposition);
  if (priorFindingsDisposition.length === 0) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_prior_findings_disposition_missing',
        'Critical Auditor response must classify prior findings as new/resolved/unchanged/rejected',
        ['priorFindingsDisposition'],
        'critical_auditor'
      )
    );
  }
  for (const disposition of priorFindingsDisposition) {
    const value = normalizeText(disposition.disposition);
    if (!['new', 'resolved', 'unchanged', 'rejected'].includes(value)) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_response_prior_findings_disposition_invalid',
          `Critical Auditor response has invalid prior finding disposition ${value || '<missing>'}`,
          ['priorFindingsDisposition.disposition'],
          'critical_auditor'
        )
      );
    }
  }
  const allowedRefs = new Set(input.mustRefs);
  const reviewedRefs = asStringArray(parsed.reviewedMustRefs);
  for (const ref of reviewedRefs) {
    if (!allowedRefs.has(ref)) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_response_unknown_must_ref',
          `Critical Auditor response references unknown MUST ${ref}`,
          [ref],
          'critical_auditor'
        )
      );
    }
  }
  const allowedProjectionRefs = new Set<string>();
  for (const mustPacket of asRecordArray(input.packet.mustPackets)) {
    for (const key of [
      'mustAtomicTasks',
      'mustExecutionDecompositionMatrix',
      'mustEvidenceProjection',
      'mustTraceProjection',
      'mustAcceptanceProjection',
      'mustFailureEdgeProjection',
      'mustTargetPathProjection',
      'mustCurrentTargetProjection',
      'mustAiTddManifestProjection',
      'mustArtifactProjection',
      'mustCommandProjection',
      'mustCloseoutBoundaryProjection',
    ]) {
      for (const row of asRecordArray(mustPacket[key])) {
        const id = normalizeText(row.id);
        if (id) {
          allowedProjectionRefs.add(id);
          allowedProjectionRefs.add(`${normalizeText(mustPacket.mustRef)}:${id}`);
          allowedProjectionRefs.add(`${key}:${id}`);
        }
      }
    }
  }
  const reviewedProjectionRefs = asStringArray(parsed.reviewedProjectionRefs);
  if (reviewedProjectionRefs.length === 0) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_reviewed_projection_refs_missing',
        'Critical Auditor response must include non-empty reviewedProjectionRefs',
        ['reviewedProjectionRefs'],
        'critical_auditor'
      )
    );
  }
  for (const ref of [
    ...reviewedProjectionRefs,
    ...asStringArray(parsed.projectionRefs),
    ...asStringArray(parsed.referencedProjectionRefs),
  ]) {
    if (!allowedProjectionRefs.has(ref)) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_response_unknown_projection_ref',
          `Critical Auditor response references unknown projection ${ref}`,
          [ref],
          'critical_auditor'
        )
      );
    }
  }
  if (isNoNewGapVerdict(verdict) && input.gateDryRun.actionableBlockingIssueCount > 0) {
    const proofs = asRecordArray(parsed.falsePositiveProofs);
    const provenCodes = new Set(
      proofs.map((proof) => normalizeText(proof.blockerCode)).filter(Boolean)
    );
    const missingProofs = input.gateDryRun.actionableBlockingIssues
      .map((issue) => issue.code)
      .filter((code) => !provenCodes.has(code));
    if (missingProofs.length > 0) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_no_new_gap_forbidden_by_gate_dry_run_blockers',
          'Critical Auditor response cannot use no_new_* while gate dry-run has actionable blockers without machine-verifiable falsePositiveProofs',
          missingProofs,
          'critical_auditor'
        )
      );
    }
  }
  const attemptedWrites = [
    ...asStringArray(parsed.writeAttempts),
    ...asStringArray(parsed.sourceWriteAttempts),
    ...asStringArray(parsed.controlWriteAttempts),
  ];
  if (
    attemptedWrites.length > 0 ||
    parsed.mutatesSource === true ||
    parsed.writesControlState === true
  ) {
    issues.push(
      preConfirmationIssue(
        'subagent_write_boundary_violation',
        'Critical Auditor response must not write source, packet, receipt, or control state',
        attemptedWrites,
        'critical_auditor'
      )
    );
  }
  const parsedValidatedGaps = asRecordArray(parsed.validatedGaps);
  const unresolvedGaps = parsedValidatedGaps.filter((gap) => {
    const status = normalizeText(gap.status ?? gap.resolutionStatus);
    return ![
      'resolved',
      'converted_to_out_boundary',
      'converted_to_open_question',
      'rejected',
    ].includes(status);
  });
  if (unresolvedGaps.length > 0 && verdict !== 'new_valid_gap') {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_unresolved_validated_gap',
        'Critical Auditor response contains unresolved validated gaps',
        unresolvedGaps.map((gap) => normalizeText(gap.id ?? gap.code ?? 'gap')),
        'critical_auditor'
      )
    );
  }
  const repairActionValidation =
    verdict === 'new_valid_gap'
      ? unresolvedGaps.length === 0
        ? {
            gaps: [] as Array<Record<string, unknown> & { repairActions: CriticalAuditorRepairAction[] }>,
            issues: [
              preConfirmationIssue(
                'critical_auditor_new_valid_gap_missing_validated_gap',
                'Critical Auditor response verdict new_valid_gap requires at least one unresolved validated gap',
                ['validatedGaps'],
                'critical_auditor'
              ),
            ],
          }
        : validateCriticalAuditorRepairActions(unresolvedGaps)
      : {
          gaps: parsedValidatedGaps as Array<Record<string, unknown> & { repairActions: CriticalAuditorRepairAction[] }>,
          issues: [],
        };
  if (repairActionValidation.issues.length > 0) {
    issues.push(...repairActionValidation.issues);
  }
  if (issues.length > 0) {
    return { response: null, issues };
  }
  return {
    response: {
      verdict,
      gapCandidates: asRecordArray(parsed.gapCandidates),
      validatedGaps: isNoNewGapVerdict(verdict) ? parsedValidatedGaps : repairActionValidation.gaps,
      rejectedGapCandidates: asRecordArray(parsed.rejectedGapCandidates),
      mutationPressureFindings: asRecordArray(parsed.mutationPressureFindings),
      overBroadTaskFindings: asRecordArray(parsed.overBroadTaskFindings),
      missingProjectionFindings: asRecordArray(parsed.missingProjectionFindings),
      invalidProofFindings: asRecordArray(parsed.invalidProofFindings),
      legacyBypassFindings: asRecordArray(parsed.legacyBypassFindings),
      sourceMaterializationFindings: asRecordArray(parsed.sourceMaterializationFindings),
      reviewedMustRefs: reviewedRefs,
      reviewedProjectionRefs,
      gateDryRunHash: normalizeText(parsed.gateDryRunHash),
      reconciliationIssueCount: Number(parsed.reconciliationIssueCount),
      checkedProjectionGroups: asStringArray(parsed.checkedProjectionGroups),
      checkedProjectionQualityRuleCodes: asStringArray(parsed.checkedProjectionQualityRuleCodes),
      priorFindingsDisposition,
      falsePositiveProofs: asRecordArray(parsed.falsePositiveProofs),
      rationale: normalizeText(parsed.rationale),
    },
    issues: [],
  };
}

function validateCriticalAuditorRoundResultBinding(input: {
  roundIndex: number;
  auditResult: CriticalAuditorRoundResult;
  gateDryRun: CriticalAuditorGateDryRunSummary;
  packet: Record<string, unknown>;
}): PreConfirmationDrilldownIssue[] {
  const issues: PreConfirmationDrilldownIssue[] = [];
  const result = input.auditResult;
  if (normalizeText(result.gateDryRunHash) !== input.gateDryRun.hash) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_gate_dry_run_hash_mismatch',
        `Critical Auditor provider round ${input.roundIndex} did not bind the current gate dry-run hash`,
        ['gateDryRunHash'],
        'critical_auditor'
      )
    );
  }
  if (Number(result.reconciliationIssueCount) !== input.gateDryRun.reconciliation.issueCount) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_reconciliation_issue_count_mismatch',
        `Critical Auditor provider round ${input.roundIndex} did not bind reconciliationIssueCount`,
        ['reconciliationIssueCount'],
        'critical_auditor'
      )
    );
  }
  const reviewedProjectionRefs = new Set(result.reviewedProjectionRefs ?? []);
  if (reviewedProjectionRefs.size === 0) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_reviewed_projection_refs_missing',
        `Critical Auditor provider round ${input.roundIndex} must include reviewedProjectionRefs`,
        ['reviewedProjectionRefs'],
        'critical_auditor'
      )
    );
  }
  const allowedProjectionRefs = new Set(projectionRefsFromPacket(input.packet));
  for (const ref of reviewedProjectionRefs) {
    if (!allowedProjectionRefs.has(ref)) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_response_unknown_projection_ref',
          `Critical Auditor provider round ${input.roundIndex} references unknown projection ${ref}`,
          [ref],
          'critical_auditor'
        )
      );
    }
  }
  const checkedGroups = new Set(result.checkedProjectionGroups ?? []);
  for (const group of CRITICAL_AUDITOR_PROJECTION_GROUPS) {
    if (!checkedGroups.has(group)) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_response_checked_projection_group_missing',
          `Critical Auditor provider round ${input.roundIndex} did not check projection group ${group}`,
          [group],
          'critical_auditor'
        )
      );
    }
  }
  const checkedProjectionQualityRuleCodes = new Set(
    result.checkedProjectionQualityRuleCodes ?? []
  );
  for (const ruleCode of PROJECTION_QUALITY_RULE_CODES) {
    if (!checkedProjectionQualityRuleCodes.has(ruleCode)) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_response_checked_projection_quality_rule_missing',
          `Critical Auditor provider round ${input.roundIndex} did not check projection quality rule ${ruleCode}`,
          [ruleCode],
          'critical_auditor'
        )
      );
    }
  }
  const dispositions = result.priorFindingsDisposition ?? [];
  if (dispositions.length === 0) {
    issues.push(
      preConfirmationIssue(
        'critical_auditor_response_prior_findings_disposition_missing',
        `Critical Auditor provider round ${input.roundIndex} must classify prior findings`,
        ['priorFindingsDisposition'],
        'critical_auditor'
      )
    );
  }
  for (const disposition of dispositions) {
    const value = normalizeText(disposition.disposition);
    if (!['new', 'resolved', 'unchanged', 'rejected'].includes(value)) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_response_prior_findings_disposition_invalid',
          `Critical Auditor provider round ${input.roundIndex} has invalid disposition ${value || '<missing>'}`,
          ['priorFindingsDisposition.disposition'],
          'critical_auditor'
        )
      );
    }
  }
  if (input.gateDryRun.actionableBlockingIssueCount > 0) {
    const proofs = result.falsePositiveProofs ?? [];
    const provenCodes = new Set(
      proofs.map((proof) => normalizeText(proof.blockerCode)).filter(Boolean)
    );
    const missingProofs = input.gateDryRun.actionableBlockingIssues
      .map((issue) => issue.code)
      .filter((code) => !provenCodes.has(code));
    if (missingProofs.length > 0) {
      issues.push(
        preConfirmationIssue(
          'critical_auditor_no_new_gap_forbidden_by_gate_dry_run_blockers',
          `Critical Auditor provider round ${input.roundIndex} cannot return no_new_* while gate dry-run has actionable blockers`,
          missingProofs,
          'critical_auditor'
        )
      );
    }
  }
  return issues;
}

function criticalAuditorFindingText(value: Record<string, unknown>): string {
  return [
    normalizeText(value.code),
    normalizeText(value.issueCode),
    normalizeText(value.findingCode),
    normalizeText(value.category),
    normalizeText(value.type),
    normalizeText(value.message),
    normalizeText(value.reason),
    normalizeText(value.description),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isAuditInsufficiencyFinding(value: Record<string, unknown>): boolean {
  const text = criticalAuditorFindingText(value);
  const hasAuditContext =
    text.includes('audit') ||
    text.includes('reviewed') ||
    text.includes('rationale') ||
    text.includes('evidence');
  const hasInsufficiencySignal =
    text.includes('insufficient') ||
    text.includes('incomplete') ||
    text.includes('missing') ||
    text.includes('lacks') ||
    text.includes('lack ') ||
    text.includes('without');
  return hasAuditContext && hasInsufficiencySignal;
}

function hasCriticalAuditorBlockedEvidence(parsed: Record<string, unknown>): boolean {
  const sourceMaterializationFindings = asRecordArray(parsed.sourceMaterializationFindings);
  const missingProjectionFindings = asRecordArray(parsed.missingProjectionFindings);
  const gateDryRunBlockers = [
    ...asRecordArray(parsed.gateDryRunBlockers),
    ...asRecordArray(parsed.gateDryRunFindings),
  ];
  const invalidSourceOrProjectionProofFindings = asRecordArray(parsed.invalidProofFindings).filter(
    (finding) => !isAuditInsufficiencyFinding(finding)
  );
  return (
    sourceMaterializationFindings.length > 0 ||
    missingProjectionFindings.length > 0 ||
    gateDryRunBlockers.length > 0 ||
    invalidSourceOrProjectionProofFindings.length > 0
  );
}

function hasCriticalAuditorInsufficientAuditEvidence(parsed: Record<string, unknown>): boolean {
  return asRecordArray(parsed.invalidProofFindings).some(isAuditInsufficiencyFinding);
}

function isPacketSourceProjectionMetadataDrift(response: CriticalAuditorRoundResult): boolean {
  const findings = [
    ...(response.sourceMaterializationFindings ?? []),
    ...(response.missingProjectionFindings ?? []),
    ...(response.invalidProofFindings ?? []),
    ...(response.gapCandidates ?? []),
    ...(response.rejectedGapCandidates ?? []),
  ];
  return findings.some((finding) => {
    const text = criticalAuditorFindingText(finding);
    return (
      (text.includes('source') && text.includes('packet') && text.includes('projection')) ||
      (text.includes('metadata') && text.includes('drift')) ||
      text.includes('packet_source_projection') ||
      text.includes('source_packet_projection')
    );
  });
}

function detectIgnoredRequirementSource(
  root: string,
  sourcePath: string
): Array<Record<string, string>> {
  const relative = toRootRelativePath(root, sourcePath);
  if (!relative.startsWith('docs/requirements/')) {
    return [];
  }
  const gitignorePath = path.join(root, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    return [];
  }
  const gitignoreText = fs.readFileSync(gitignorePath, 'utf8');
  if (!/^docs\/requirements\/\s*$/mu.test(gitignoreText)) {
    return [];
  }
  return [
    {
      warning: 'source_document_ignored_by_git',
      recommendedAction: `git add -f ${relative}`,
    },
  ];
}

export function runMainAgentAuthoringRepair(
  root: string,
  options: MainAgentAuthoringRepairOptions
): MainAgentAuthoringRepairResult {
  const sourceArg = normalizeText(options.source);
  if (!sourceArg) {
    throw new Error('authoring-repair requires --source <source-document.md>');
  }
  if (normalizeText(options.mode) !== 'preserve-existing') {
    throw new Error('authoring-repair currently requires --mode preserve-existing');
  }
  const sourcePath = resolveRootRelativePath(root, sourceArg);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`source document not found: ${sourcePath}`);
  }
  const identity = derivePreConfirmationIdentity(root, sourcePath, options);
  const paths = preConfirmationPaths(root, identity.recordId, identity.requirementSetId);
  const createdAt = new Date().toISOString();
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extraction = extractImplementationConfirmationBlock(sourceText);
  if (!extraction) {
    return buildAuthoringRepairResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      status: 'blocked',
      blockingStage: 'implementation_confirmation_missing',
      nextRequiredAction: 'run_author_confirmation_ready_source_before_preserve_existing_repair',
      issues: [
        preConfirmationIssue(
          'implementation_confirmation_missing',
          'preserve-existing authoring repair requires an existing inline implementationConfirmation block',
          [toRootRelativePath(root, sourcePath)],
          'authoring_repair'
        ),
      ],
    });
  }
  const inlineMustRequirements = extractInlineMustRequirements(extraction.confirmation);
  const sourceBoundMustRequirements = mustRequirementsFromControlledCandidates(
    identity.requirementSetId,
    buildControlledMustCandidatesFromPlainSource(root, sourcePath, sourceText)
  );
  const mustRequirements = mergeSourceBoundMustRequirements(
    inlineMustRequirements,
    sourceBoundMustRequirements
  );
  if (mustRequirements.length === 0) {
    return buildAuthoringRepairResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      status: 'blocked',
      blockingStage: 'semantic_kernel_required',
      nextRequiredAction: 'author_controlled_must_candidates',
      issues: [
        preConfirmationIssue(
          'controlled_must_candidates_missing',
          'No inline implementationConfirmation.must[] entries were found; preserve-existing repair does not fall back to default MUST candidates.',
          ['implementationConfirmation.must'],
          'semantic_kernel_authoring'
        ),
      ],
    });
  }
  const sourceDocumentHash = sourceDocumentHashForPreConfirmation(
    sourceText,
    extraction.blockText,
    extraction.confirmation
  );
  const implementationConfirmationHash = implementationConfirmationHashForPreConfirmation(
    extraction.confirmation
  );
  const kernel = buildSemanticKernel({
    root,
    sourcePath,
    recordId: identity.recordId,
    sourceDocumentHash,
    implementationConfirmationHash,
    createdAt,
    mustRequirements,
  });
  kernel.kernelHash = sha256Json({
    schemaVersion: kernel.schemaVersion,
    recordId: kernel.recordId,
    sourceDocumentHash,
    implementationConfirmationHash,
    mustCandidates: kernel.mustCandidates,
    sourceRequirementTexts: kernel.sourceRequirementTexts,
    mode: 'preserve-existing',
  });
  kernel.contentHash = kernel.kernelHash;
  writeJsonUtf8(paths.semanticKernel, { semanticKernel: kernel });
  const semanticKernelHash = normalizeText(kernel.kernelHash);
  const packetHash = sha256Json({
    recordId: identity.recordId,
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticKernelHash,
    mode: 'preserve-existing',
    mustRefs: mustRequirements.map((requirement) => requirement.id),
  });
  const previousReceiptsBeforePacket = readCriticalAuditorReceipts(paths.authoringDir);
  const previousConvergence = collectConsecutiveNoNewGapFromReceipts(
    previousReceiptsBeforePacket,
    sha256Json({
      sourceDocumentHash,
      implementationConfirmationHash,
      semanticKernelHash,
      packetHash,
    })
  );
  const packet = buildPreserveExistingMustDecompositionPacket({
    root,
    sourcePath,
    paths,
    recordId: identity.recordId,
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticKernelHash,
    packetHash,
    createdAt,
    mustRequirements,
    confirmation: extraction.confirmation,
    consecutiveNoNewGapRounds: previousConvergence.consecutive,
  });
  writeJsonUtf8(paths.mustDecompositionPacket, { must_decomposition_packet: packet });
  const auditInputHash = sha256Json({
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticKernelHash,
    packetHash,
  });
  const effectivePacket = {
    ...packet,
    consecutiveNoNewValidGapRounds: previousConvergence.consecutive,
    authorClaims: asRecordArray(packet.authorClaims).map((claim) => ({
      ...claim,
      criticDisposition:
        previousConvergence.consecutive >= 3
          ? 'accepted_no_new_valid_gap'
          : 'pending_critical_auditor_response',
    })),
    mustPackets: asRecordArray(packet.mustPackets).map((mustPacket) => ({
      ...mustPacket,
      authorClaims: asRecordArray(mustPacket.authorClaims).map((claim) => ({
        ...claim,
        criticDisposition:
          previousConvergence.consecutive >= 3
            ? 'accepted_no_new_valid_gap'
            : 'pending_critical_auditor_response',
      })),
    })),
  };
  const warnings = detectIgnoredRequirementSource(root, sourcePath);
  const materializationGate = verifySourceMaterializationBeforeAudit({
    root,
    sourcePath,
    paths,
    requirementSetId: identity.requirementSetId,
    expectedSourceDocumentHash: sourceDocumentHash,
    expectedImplementationConfirmationHash: implementationConfirmationHash,
  });
  if (materializationGate.ok === false) {
    if (shouldAttemptCurrentSourcePromotionReceiptRefresh(materializationGate.issues)) {
      const refresh = runSkillLocalCurrentSourcePromotionRefresh({
        root,
        sourcePath,
        paths,
        recordId: identity.recordId,
        requirementSetId: identity.requirementSetId,
      });
      if (refresh.ok === false) {
        return buildCurrentSourcePromotionRefreshFailedResult({
          root,
          sourcePath,
          recordId: identity.recordId,
          requirementSetId: identity.requirementSetId,
          paths,
          sourceDocumentHash,
          implementationConfirmationHash,
          packetHash,
          warnings,
          staleReceiptIssues: materializationGate.issues,
          refreshIssues: refresh.issues,
          artifacts: refresh.artifacts,
        });
      }
      const refreshedGate = verifySourceMaterializationBeforeAudit({
        root,
        sourcePath,
        paths,
        requirementSetId: identity.requirementSetId,
        expectedSourceDocumentHash: sourceDocumentHash,
        expectedImplementationConfirmationHash: implementationConfirmationHash,
      });
      if (refreshedGate.ok === false) {
        return buildCurrentSourcePromotionRefreshFailedResult({
          root,
          sourcePath,
          recordId: identity.recordId,
          requirementSetId: identity.requirementSetId,
          paths,
          sourceDocumentHash,
          implementationConfirmationHash,
          packetHash,
          warnings,
          staleReceiptIssues: materializationGate.issues,
          refreshIssues: refreshedGate.issues,
          artifacts: refresh.artifacts,
        });
      }
    } else {
      return buildSourceMaterializationRequiredResult({
        root,
        sourcePath,
        recordId: identity.recordId,
        requirementSetId: identity.requirementSetId,
        paths,
        sourceDocumentHash,
        implementationConfirmationHash,
        packetHash,
        warnings,
        issues: materializationGate.issues,
      });
    }
  }
  const staleArtifactIssues = collectStaleCriticalAuditorArtifactIssues({
    authoringDir: paths.authoringDir,
    auditInputHash,
    sourceDocumentHash,
    implementationConfirmationHash,
    packetHash,
  });
  const staleArchiveDir = staleArtifactIssues.length
    ? archiveCriticalAuditorArtifacts({
        authoringDir: paths.authoringDir,
        reason: 'stale_or_unbound_critical_auditor_artifacts',
        auditInputHash,
        createdAt,
      })
    : null;

  const responsePath = normalizeText(options.criticalAuditorResponse)
    ? resolveRootRelativePath(root, normalizeText(options.criticalAuditorResponse))
    : '';
  if (responsePath && !staleArtifactIssues.length) {
    const response = readJsonIfExists(responsePath);
    const roundIndex = Number(response?.roundIndex ?? 0);
    const requestPath = findCriticalAuditorRequestPath(paths.authoringDir, roundIndex);
    const request = readJsonIfExists(requestPath);
    if (!roundIndex || !request) {
      return buildAuthoringRepairResult({
        root,
        sourcePath,
        recordId: identity.recordId,
        requirementSetId: identity.requirementSetId,
        paths,
        status: 'blocked',
        blockingStage: 'critical_auditor_response_invalid',
        nextRequiredAction: 'regenerate_critical_auditor_round_request',
        sourceDocumentHash,
        implementationConfirmationHash,
        packetHash,
        warnings,
        issues: [
          preConfirmationIssue(
            'critical_auditor_request_missing_for_response',
            'Critical Auditor response does not match an existing round request',
            [responsePath],
            'critical_auditor'
          ),
        ],
      });
    }
    const responseGateDryRun = buildCriticalAuditorGateDryRunSummary({
      root,
      sourcePath,
      paths,
      roundIndex,
    });
    const validation = validateCriticalAuditorResponse({
      responsePath,
      request,
      sourceDocumentHash,
      implementationConfirmationHash,
      packetHash,
      mustRefs: mustRequirements.map((requirement) => requirement.id),
      packet: effectivePacket,
      gateDryRun: responseGateDryRun,
    });
    if (!validation.response) {
      return buildAuthoringRepairResult({
        root,
        sourcePath,
        recordId: identity.recordId,
        requirementSetId: identity.requirementSetId,
        paths,
        status: 'blocked',
        blockingStage: 'critical_auditor_response_invalid',
        nextRequiredAction: 'write_current_critical_auditor_round_response',
        sourceDocumentHash,
        implementationConfirmationHash,
        packetHash,
        warnings,
        issues: validation.issues,
      });
    }
    const receipt = buildCriticalAuditorReceipt({
      roundIndex,
      requestHash: normalizeText(request.requestHash),
      gateDryRunHash: responseGateDryRun.hash,
      responseHash: sha256Json(validation.response),
      auditInputHash,
      recordId: identity.recordId,
      sourceDocumentHash,
      implementationConfirmationHash,
      packetHash,
      createdAt,
      auditResult: validation.response,
    });
    writeJsonUtf8(
      path.join(paths.authoringDir, `critical-auditor-receipt-round-${roundIndex}.json`),
      {
        criticalAuditorReceipt: receipt,
      }
    );
    if (validation.response.verdict === 'blocked') {
      const metadataDrift = isPacketSourceProjectionMetadataDrift(validation.response);
      const blockingStage = metadataDrift
        ? 'packet_source_projection_resynchronization_required'
        : 'critical_auditor_blocked';
      const nextRequiredAction = metadataDrift
        ? 'run_packet_source_projection_resynchronization'
        : 'resolve_critical_auditor_blocker';
      return buildAuthoringRepairResult({
        root,
        sourcePath,
        recordId: identity.recordId,
        requirementSetId: identity.requirementSetId,
        paths,
        status: 'blocked',
        blockingStage,
        nextRequiredAction,
        sourceDocumentHash,
        implementationConfirmationHash,
        packetHash,
        artifacts: [
          path.join(paths.authoringDir, `critical-auditor-receipt-round-${roundIndex}.json`),
        ],
        warnings,
        issues: [
          preConfirmationIssue(
            blockingStage,
            metadataDrift
              ? 'Critical Auditor blocked on source and packet projection metadata drift; controlled resynchronization is required.'
              : 'Critical Auditor returned blocked; resolve the audit blocker before continuing authoring repair.',
            [responsePath],
            'critical_auditor'
          ),
        ],
        consecutiveNoNewGapRounds: 0,
      });
    }
    if (validation.response.verdict === 'insufficient_audit') {
      return buildAuthoringRepairResult({
        root,
        sourcePath,
        recordId: identity.recordId,
        requirementSetId: identity.requirementSetId,
        paths,
        status: 'blocked',
        blockingStage: 'critical_auditor_insufficient_audit',
        nextRequiredAction: 'rewrite_current_critical_auditor_round_response',
        sourceDocumentHash,
        implementationConfirmationHash,
        packetHash,
        artifacts: [
          path.join(paths.authoringDir, `critical-auditor-receipt-round-${roundIndex}.json`),
        ],
        warnings,
        issues: [
          preConfirmationIssue(
            'critical_auditor_insufficient_audit',
            'Critical Auditor response is insufficient for convergence; rewrite the current round response with complete audit evidence.',
            [responsePath],
            'critical_auditor'
          ),
        ],
        consecutiveNoNewGapRounds: 0,
      });
    }
    if (validation.response.verdict === 'new_valid_gap') {
      const gapFix = materializeCriticalAuditorGapFix({
        root,
        sourcePath,
        paths,
        recordId: identity.recordId,
        requirementSetId: identity.requirementSetId,
        confirmation: extraction.confirmation,
        previousSourceDocumentHash: sourceDocumentHash,
        response: validation.response,
        createdAt,
      });
      if (gapFix.ok === false) {
        return buildAuthoringRepairResult({
          root,
          sourcePath,
          recordId: identity.recordId,
          requirementSetId: identity.requirementSetId,
          paths,
          status: 'blocked',
          blockingStage: 'source_gap_fix_materialization_required',
          nextRequiredAction: 'write_source_gap_fix_before_next_audit_round',
          sourceDocumentHash,
          implementationConfirmationHash,
          packetHash,
          artifacts: [
            path.join(paths.authoringDir, `critical-auditor-receipt-round-${roundIndex}.json`),
          ],
          warnings,
          issues: [
            sourceMaterializationGateIssue(
              'source_gap_fix_materialization_required',
              'Critical Auditor new_valid_gap repair actions could not be materialized into the source contract.',
              gapFix.issue.refs
            ),
            gapFix.issue,
          ],
          consecutiveNoNewGapRounds: 0,
        });
      }
      const repaired = readMaterializedConfirmation(sourcePath);
      const rebuilt = buildPreserveExistingAuthoringArtifacts({
        root,
        sourcePath,
        paths,
        recordId: identity.recordId,
        requirementSetId: identity.requirementSetId,
        createdAt,
        sourceText: repaired.sourceText,
        extraction: repaired.extraction,
        consecutiveNoNewGapRounds: 0,
      });
      const archiveDir = archiveCriticalAuditorArtifacts({
        authoringDir: paths.authoringDir,
        reason: 'semantic_repair_transaction_restart',
        auditInputHash: rebuilt.auditInputHash,
        createdAt,
      });
      const freshGateDryRun = buildCriticalAuditorGateDryRunSummary({
        root,
        sourcePath,
        paths,
        roundIndex: 1,
      });
      const freshRequest = buildCriticalAuditorRoundRequest({
        root,
        sourcePath,
        recordId: identity.recordId,
        roundIndex: 1,
        sourceDocumentHash: rebuilt.sourceDocumentHash,
        implementationConfirmationHash: rebuilt.implementationConfirmationHash,
        packetHash: rebuilt.packetHash,
        auditInputHash: rebuilt.auditInputHash,
        mustRequirements: rebuilt.mustRequirements,
        packet: rebuilt.effectivePacket,
        previousReceipts: [],
        gateDryRun: freshGateDryRun,
        createdAt,
      });
      const freshRequestPath = findCriticalAuditorRequestPath(paths.authoringDir, 1);
      writeJsonUtf8(freshRequestPath, freshRequest);
      return buildAuthoringRepairResult({
        root,
        sourcePath,
        recordId: identity.recordId,
        requirementSetId: identity.requirementSetId,
        paths,
        status: 'blocked',
        blockingStage: 'critical_auditor_round_required',
        nextRequiredAction: 'write_critical_auditor_round_response',
        repairCommand: authoringRepairCommand(
          toRootRelativePath(root, sourcePath),
          toRootRelativePath(root, path.join(paths.authoringDir, 'critical-auditor-round-response-1.json'))
        ),
        sourceDocumentHash: rebuilt.sourceDocumentHash,
        implementationConfirmationHash: rebuilt.implementationConfirmationHash,
        packetHash: rebuilt.packetHash,
        artifacts: [
          freshRequestPath,
          archiveDir,
          gapFix.receiptPath,
        ],
        warnings,
        issues: [
          preConfirmationIssue(
            'semantic_repair_transaction_restarted',
            'Critical Auditor validated gap was materialized into semantic fields; stale audit artifacts were archived and round 1 restarted on the repaired packet.',
            [freshRequestPath, archiveDir],
            'critical_auditor'
          ),
        ],
        consecutiveNoNewGapRounds: 0,
      });
    }
  } else if (responsePath && staleArtifactIssues.length) {
    try {
      if (fs.existsSync(responsePath) && path.dirname(responsePath) !== path.dirname(sourcePath)) {
        const archivedResponsePath = path.join(
          staleArchiveDir ?? paths.authoringDir,
          path.basename(responsePath)
        );
        if (!fs.existsSync(archivedResponsePath)) {
          fs.renameSync(responsePath, archivedResponsePath);
        }
      }
    } catch {
      // Stale external responses are best-effort archived; restart remains fail-closed.
    }
  }

  const receipts = readCriticalAuditorReceipts(paths.authoringDir);
  const convergence = collectConsecutiveNoNewGapFromReceipts(receipts, auditInputHash);
  const restartIssues = [...staleArtifactIssues, ...convergence.issues];
  if (restartIssues.length > 0) {
    const archiveDir =
      staleArchiveDir ??
      archiveCriticalAuditorArtifacts({
        authoringDir: paths.authoringDir,
        reason: 'stale_or_unbound_critical_auditor_artifacts',
        auditInputHash,
        createdAt,
      });
    const freshRequestGateDryRun = buildCriticalAuditorGateDryRunSummary({
      root,
      sourcePath,
      paths,
      roundIndex: 1,
    });
    const request = buildCriticalAuditorRoundRequest({
      root,
      sourcePath,
      recordId: identity.recordId,
      roundIndex: 1,
      sourceDocumentHash,
      implementationConfirmationHash,
      packetHash,
      auditInputHash,
      mustRequirements,
      packet: effectivePacket,
      previousReceipts: [],
      gateDryRun: freshRequestGateDryRun,
      createdAt,
    });
    const requestPath = findCriticalAuditorRequestPath(paths.authoringDir, 1);
    writeJsonUtf8(requestPath, request);
    return buildAuthoringRepairResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      status: 'blocked',
      blockingStage: 'critical_auditor_round_required',
      nextRequiredAction: 'write_critical_auditor_round_response',
      repairCommand: authoringRepairCommand(
        toRootRelativePath(root, sourcePath),
        toRootRelativePath(
          root,
          path.join(paths.authoringDir, 'critical-auditor-round-response-1.json')
        )
      ),
      sourceDocumentHash,
      implementationConfirmationHash,
      packetHash,
      warnings,
      issues: restartIssues,
      artifacts: [requestPath, ...(archiveDir ? [archiveDir] : [])],
      consecutiveNoNewGapRounds: convergence.consecutive,
    });
  }

  if (convergence.consecutive < 3) {
    const roundIndex = findNextCriticalAuditorRound(paths.authoringDir);
    const request = buildCriticalAuditorRoundRequest({
      root,
      sourcePath,
      recordId: identity.recordId,
      roundIndex,
      sourceDocumentHash,
      implementationConfirmationHash,
      packetHash,
      auditInputHash,
      mustRequirements,
      packet: effectivePacket,
      previousReceipts: receipts,
      gateDryRun: buildCriticalAuditorGateDryRunSummary({
        root,
        sourcePath,
        paths,
        roundIndex,
      }),
      createdAt,
    });
    const requestPath = findCriticalAuditorRequestPath(paths.authoringDir, roundIndex);
    writeJsonUtf8(requestPath, request);
    return buildAuthoringRepairResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      status: 'blocked',
      blockingStage: 'critical_auditor_round_required',
      nextRequiredAction: 'write_critical_auditor_round_response',
      repairCommand: authoringRepairCommand(
        toRootRelativePath(root, sourcePath),
        toRootRelativePath(
          root,
          path.join(paths.authoringDir, `critical-auditor-round-response-${roundIndex}.json`)
        )
      ),
      artifacts: [requestPath],
      sourceDocumentHash,
      implementationConfirmationHash,
      packetHash,
      warnings,
      consecutiveNoNewGapRounds: convergence.consecutive,
    });
  }

  const finalPacket = {
    ...effectivePacket,
    consecutiveNoNewValidGapRounds: convergence.consecutive,
  };
  writeJsonUtf8(paths.mustDecompositionPacket, { must_decomposition_packet: finalPacket });

  const mustGateScript = resolveSkillScript(root, 'pre_render_must_decomposition_gate.js');
  const mustGate = runNodeJson(
    mustGateScript,
    [
      '--source',
      sourcePath,
      '--authoring-dir',
      paths.authoringDir,
      '--out',
      paths.preRenderMustGate,
      '--receipt',
      paths.mustDecompositionReceipt,
      '--reconciliation-report',
      paths.reconciliationReport,
      '--json',
    ],
    root
  );
  const mustGateReport = mustGate.json ?? readJsonIfExists(paths.preRenderMustGate);
  const reconciliationReport = readJsonIfExists(paths.reconciliationReport);
  if (mustGateReport?.verdict !== 'PASS' || reconciliationReport?.verdict !== 'pass') {
    return buildAuthoringRepairResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      status: 'blocked',
      blockingStage: 'pre_render_must_gate_required',
      nextRequiredAction: 'repair_pre_render_must_gate',
      artifacts: [paths.preRenderMustGate, paths.reconciliationReport],
      sourceDocumentHash,
      implementationConfirmationHash,
      packetHash,
      warnings,
      issues: mustGateReport
        ? collectBlockingIssuesFromReports(mustGateReport, reconciliationReport)
        : [
            commandFailureIssue(
              'pre_render_must_decomposition_gate_report_missing',
              mustGateScript,
              mustGate
            ),
          ],
      consecutiveNoNewGapRounds: convergence.consecutive,
    });
  }

  writeJsonUtf8(paths.progress, {
    schemaVersion: 'semantic-checkpoint-progress/v1',
    recordId: identity.recordId,
    status: 'pre_render_ready',
    mode: 'preserve-existing',
    sourceDocumentHash,
    implementationConfirmationHash,
    packetHash,
    consecutiveNoNewGapRounds: convergence.consecutive,
    currentStage: 'pre_render_ready',
    createdBy:
      'main_agent_orchestration.requirement_confirmation.authoring_repair.preserve_existing',
    createdAt,
    inputRefs: [
      toRootRelativePath(root, sourcePath),
      toRootRelativePath(root, paths.semanticKernel),
      toRootRelativePath(root, paths.mustDecompositionPacket),
      toRootRelativePath(root, paths.preRenderMustGate),
    ],
  });

  return buildAuthoringRepairResult({
    root,
    sourcePath,
    recordId: identity.recordId,
    requirementSetId: identity.requirementSetId,
    paths,
    status: 'pre_render_ready',
    blockingStage: null,
    nextRequiredAction: 'render_confirmation_allowed',
    repairCommand: authoringRepairCommand(toRootRelativePath(root, sourcePath)),
    artifacts: [
      paths.semanticKernel,
      paths.mustDecompositionPacket,
      paths.reconciliationReport,
      paths.preRenderMustGate,
      paths.progress,
    ],
    sourceDocumentHash,
    implementationConfirmationHash,
    packetHash,
    warnings,
    consecutiveNoNewGapRounds: convergence.consecutive,
  });
}

function enhanceArtifactMetadata(
  filePath: string,
  input: {
    schemaVersion?: string;
    recordId: string;
    sourceDocumentHash: string | null;
    implementationConfirmationHash: string | null;
    createdBy: string;
    createdAt: string;
    inputRefs: string[];
  }
): Record<string, unknown> | null {
  const existing = readJsonIfExists(filePath);
  if (!existing) {
    return null;
  }
  const enhanced = {
    ...existing,
    schemaVersion: normalizeText(existing.schemaVersion) || input.schemaVersion || null,
    recordId: normalizeText(existing.recordId) || input.recordId,
    sourceDocumentHash: normalizeText(existing.sourceDocumentHash) || input.sourceDocumentHash,
    implementationConfirmationHash:
      normalizeText(existing.implementationConfirmationHash) ||
      input.implementationConfirmationHash,
    createdBy: normalizeText(existing.createdBy) || input.createdBy,
    createdAt: normalizeText(existing.createdAt) || input.createdAt,
    inputRefs: Array.isArray(existing.inputRefs) ? existing.inputRefs : input.inputRefs,
  };
  const hashKey = normalizeText((enhanced as Record<string, unknown>).receiptHash)
    ? 'receiptHash'
    : 'contentHash';
  (enhanced as Record<string, unknown>)[hashKey] = sha256Json({
    ...enhanced,
    contentHash: null,
    confirmationPageHash: null,
    renderReportHash: null,
    receiptHash: null,
  });
  writeJsonUtf8(filePath, enhanced);
  return enhanced;
}

function writePreConfirmationRequirementRecord(input: {
  root: string;
  sourcePath: string;
  recordId: string;
  requirementSetId: string;
  paths: PreConfirmationPaths;
  laneState: PreConfirmationDrilldownSubstate;
  sourceDocumentHash: string | null;
  implementationConfirmationHash: string | null;
  confirmationPageHash: string | null;
  renderReportPath: string | null;
  createdAt: string;
}): void {
  const record = {
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    status: 'draft',
    flow: 'standalone_tasks',
    stage: 'implement',
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    sourcePath: toRootRelativePath(input.root, input.sourcePath),
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    confirmationPageHash: input.confirmationPageHash,
    lastEventType: 'pre_confirmation_drilldown_user_confirmable',
    updatedAt: input.createdAt,
    preConfirmationDrilldownLane: {
      currentMentalModel: 'requirement_confirmation',
      lane: 'pre_confirmation_drilldown',
      substate: input.laneState,
      nextMentalModel: null,
      controlledIngestRequiredBeforeProgression: true,
      confirmationRenderReportPath: input.renderReportPath
        ? toRootRelativePath(input.root, input.renderReportPath)
        : null,
    },
    architectureConfirmationState: {
      status: 'missing',
      reasonCode: 'blocked_until_controlled_requirement_confirmation_ingest',
      updatedAt: input.createdAt,
    },
    runtimePolicySnapshotRef: {
      path: toRootRelativePath(
        input.root,
        path.join(input.paths.recordRoot, 'recovery', 'runtime-policy-snapshot.json')
      ),
    },
    recoveryContextRef: {
      path: toRootRelativePath(
        input.root,
        path.join(input.paths.recordRoot, 'recovery', 'recovery-context.json')
      ),
    },
  };
  const recoveryDir = path.join(input.paths.recordRoot, 'recovery');
  writeJsonUtf8(path.join(recoveryDir, 'runtime-policy-snapshot.json'), {
    kind: 'runtime-policy-snapshot',
    flow: 'standalone_tasks',
    stage: 'implement',
    policy: { flow: 'standalone_tasks', stage: 'implement' },
  });
  writeJsonUtf8(path.join(recoveryDir, 'recovery-context.json'), {
    kind: 'recovery-context',
    currentMentalModel: 'requirement_confirmation',
    lane: 'pre_confirmation_drilldown',
  });
  writeJsonUtf8(input.paths.recordPath, record);
  writeJsonUtf8(input.paths.indexPath, {
    version: 1,
    active: {
      recordId: input.recordId,
      requirementSetId: input.requirementSetId,
      recordPath: toRootRelativePath(input.root, input.paths.recordPath),
    },
    records: [
      {
        recordId: input.recordId,
        requirementSetId: input.requirementSetId,
        recordPath: toRootRelativePath(input.root, input.paths.recordPath),
      },
    ],
  });
}

function resolveSkillScript(root: string, relativeScript: string): string {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const packageRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
  const candidates = [
    path.join(root, '_bmad', 'skills', 'requirements-contract-authoring'),
    path.join(root, '.codex', 'skills', 'requirements-contract-authoring'),
    path.join(root, '.cursor', 'skills', 'requirements-contract-authoring'),
    path.join(root, '.claude', 'skills', 'requirements-contract-authoring'),
    path.join(root, '.agents', 'skills', 'requirements-contract-authoring'),
    path.join(packageRoot, '_bmad', 'skills', 'requirements-contract-authoring'),
    path.join(repoRoot, '_bmad', 'skills', 'requirements-contract-authoring'),
    path.join(repoRoot, '.codex', 'skills', 'requirements-contract-authoring'),
    path.join(repoRoot, '.cursor', 'skills', 'requirements-contract-authoring'),
    path.join(repoRoot, '.claude', 'skills', 'requirements-contract-authoring'),
    path.resolve(__dirname, '..', '_bmad', 'skills', 'requirements-contract-authoring'),
    path.resolve(__dirname, '..', '.codex', 'skills', 'requirements-contract-authoring'),
    path.resolve(__dirname, '..', '.cursor', 'skills', 'requirements-contract-authoring'),
    path.resolve(__dirname, '..', '.claude', 'skills', 'requirements-contract-authoring'),
    ...(home
      ? [
          path.join(home, '.codex', 'skills', 'requirements-contract-authoring'),
          path.join(home, '.cursor', 'skills', 'requirements-contract-authoring'),
          path.join(home, '.claude', 'skills', 'requirements-contract-authoring'),
          path.join(home, '.agents', 'skills', 'requirements-contract-authoring'),
        ]
      : []),
  ];
  for (const skillDir of candidates) {
    if (!fs.existsSync(path.join(skillDir, 'SKILL.md'))) continue;
    const scriptPath = path.join(skillDir, 'scripts', relativeScript);
    if (fs.existsSync(scriptPath)) return scriptPath;
  }
  return path.join(candidates[0], 'scripts', relativeScript);
}

function resolveEncodingIntegrityScript(root: string): string {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const packageRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
  const candidates = [
    path.join(root, '_bmad', 'skills', 'encoding-integrity-guardian'),
    path.join(root, '.codex', 'skills', 'encoding-integrity-guardian'),
    path.join(root, '.cursor', 'skills', 'encoding-integrity-guardian'),
    path.join(root, '.claude', 'skills', 'encoding-integrity-guardian'),
    path.join(packageRoot, '_bmad', 'skills', 'encoding-integrity-guardian'),
    path.join(repoRoot, '_bmad', 'skills', 'encoding-integrity-guardian'),
    path.join(repoRoot, '.codex', 'skills', 'encoding-integrity-guardian'),
    ...(home ? [path.join(home, '.codex', 'skills', 'encoding-integrity-guardian')] : []),
  ];
  for (const skillDir of candidates) {
    const scriptPath = path.join(skillDir, 'scripts', 'check-encoding-integrity.js');
    if (fs.existsSync(scriptPath)) return scriptPath;
  }
  return path.join(candidates[0], 'scripts', 'check-encoding-integrity.js');
}

function runNodeJson(
  scriptPath: string,
  args: string[],
  cwd: string
): {
  status: number;
  stdout: string;
  stderr: string;
  json: Record<string, unknown> | null;
} {
  const packageRoot = path.resolve(__dirname, '..');
  const packageNodeModules = path.join(packageRoot, 'node_modules');
  const nodePath = [packageNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      BMAD_SPECKIT_PACKAGE_ROOT: packageRoot,
      NODE_PATH: nodePath,
    },
  });
  let json: Record<string, unknown> | null = null;
  const candidate = result.stdout.trim() || result.stderr.trim();
  if (candidate) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      json =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
    } catch {
      json = null;
    }
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
    json,
  };
}

function runEncodingIntegrityGate(input: {
  root: string;
  paths: PreConfirmationPaths;
  targetPaths?: string[];
}): {
  report: Record<string, unknown> | null;
  issues: PreConfirmationDrilldownIssue[];
} {
  const script = resolveEncodingIntegrityScript(input.root);
  const pathArgs = (input.targetPaths ?? [])
    .filter((item) => normalizeText(item))
    .flatMap((item) => ['--paths', toRootRelativePath(input.root, item)]);
  const command = runNodeJson(script, ['--json', ...pathArgs], input.root);
  const report = command.json;
  const issues: PreConfirmationDrilldownIssue[] = [];
  if (command.status !== 0 || !report) {
    issues.push(
      preConfirmationIssue(
        'encoding_gate_report_missing',
        `Encoding integrity gate failed or did not emit JSON: ${command.stderr || command.stdout || script}.`,
        [script],
        'encoding_integrity_gate'
      )
    );
  } else {
    writeJsonUtf8(input.paths.encodingReport, report);
    const findings = Array.isArray(report.findings) ? report.findings : [];
    if (findings.length > 0) {
      issues.push(
        preConfirmationIssue(
          'encoding_gate_findings_present',
          `Encoding integrity gate reported ${findings.length} finding(s).`,
          [toRootRelativePath(input.root, input.paths.encodingReport)],
          'encoding_integrity_gate'
        )
      );
    }
  }
  return { report, issues };
}

export function validateWrittenDeepReviewInput(input: {
  root: string;
  skillName: 'grill-with-docs' | 'docs-review';
  documentPath?: string | null;
  inputHash?: string | null;
}): {
  ok: boolean;
  status:
    | 'ready'
    | 'written_document_path_required'
    | 'written_document_missing'
    | 'input_hash_mismatch';
  skillName: 'grill-with-docs' | 'docs-review';
  documentPath: string | null;
  writtenFileHash: string | null;
  inputHash: string | null;
} {
  const documentArg = normalizeText(input.documentPath);
  if (!documentArg) {
    return {
      ok: false,
      status: 'written_document_path_required',
      skillName: input.skillName,
      documentPath: null,
      writtenFileHash: null,
      inputHash: normalizeText(input.inputHash) || null,
    };
  }
  const absoluteDocumentPath = resolveRootRelativePath(input.root, documentArg);
  const relativeDocumentPath = toRootRelativePath(input.root, absoluteDocumentPath);
  if (!fs.existsSync(absoluteDocumentPath)) {
    return {
      ok: false,
      status: 'written_document_missing',
      skillName: input.skillName,
      documentPath: relativeDocumentPath,
      writtenFileHash: null,
      inputHash: normalizeText(input.inputHash) || null,
    };
  }
  const writtenFileHash = sha256File(absoluteDocumentPath);
  const inputHash = normalizeText(input.inputHash) || writtenFileHash;
  if (inputHash !== writtenFileHash) {
    return {
      ok: false,
      status: 'input_hash_mismatch',
      skillName: input.skillName,
      documentPath: relativeDocumentPath,
      writtenFileHash,
      inputHash,
    };
  }
  return {
    ok: true,
    status: 'ready',
    skillName: input.skillName,
    documentPath: relativeDocumentPath,
    writtenFileHash,
    inputHash,
  };
}

function commandFailureIssue(
  code: string,
  scriptPath: string,
  command: ReturnType<typeof runNodeJson>
): PreConfirmationDrilldownIssue {
  const output = (command.stderr.trim() || command.stdout.trim()).slice(0, 600);
  return preConfirmationIssue(
    code,
    `Skill-local script failed or did not emit its required report: ${scriptPath}${output ? `; output: ${output}` : ''}`,
    [scriptPath],
    'skill_script_resolution'
  );
}

function runPreConfirmationScaleAssessment(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  phase: 'initial_assessment' | 'post_packet_assessment' | 'post_materialization_assessment';
  checkpointPersistenceEvidencePath?: string;
}): {
  assessment: Record<string, unknown> | null;
  routingDecision: Record<string, unknown> | null;
  issues: PreConfirmationDrilldownIssue[];
} {
  const script = resolveSkillScript(input.root, 'assess_contract_authoring_scale.js');
  const outByPhase = {
    initial_assessment: input.paths.scaleAssessmentInitial,
    post_packet_assessment: input.paths.scaleAssessmentPostPacket,
    post_materialization_assessment: input.paths.scaleAssessmentPostMaterialization,
  };
  const args = [
    '--source',
    input.sourcePath,
    '--phase',
    input.phase,
    '--out',
    outByPhase[input.phase],
    '--routing-decision-out',
    input.paths.scaleRoutingDecision,
    '--json',
  ];
  if (input.phase !== 'initial_assessment') {
    args.push('--semantic-kernel', input.paths.semanticKernel);
    args.push('--packet', input.paths.mustDecompositionPacket);
    args.push('--initial-assessment', input.paths.scaleAssessmentInitial);
  }
  if (input.phase === 'post_materialization_assessment') {
    args.push('--post-packet-assessment', input.paths.scaleAssessmentPostPacket);
    args.push('--packet-source-reconciliation', input.paths.reconciliationReport);
    if (input.checkpointPersistenceEvidencePath) {
      args.push('--checkpoint-persistence-evidence', input.checkpointPersistenceEvidencePath);
    }
  }
  const command = runNodeJson(script, args, input.root);
  if (command.stderr) {
    process.stderr.write(command.stderr);
  }
  const assessment = command.json ?? readJsonIfExists(outByPhase[input.phase]);
  const routingDecision = readJsonIfExists(input.paths.scaleRoutingDecision);
  const issues: PreConfirmationDrilldownIssue[] = [];
  if (!assessment) {
    issues.push(commandFailureIssue('scale_assessment_report_missing', script, command));
  }
  if (!routingDecision) {
    issues.push(commandFailureIssue('scale_routing_decision_missing', script, command));
  }
  return { assessment, routingDecision, issues };
}

function validateCheckpointPersistenceEvidence(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  evidencePath: string;
  routeDecision: Record<string, unknown> | null;
}): PreConfirmationDrilldownIssue[] {
  const evidence = readJsonIfExists(input.evidencePath);
  const issues: PreConfirmationDrilldownIssue[] = [];
  const ref =
    evidence?.checkpointPersistenceRef &&
    typeof evidence.checkpointPersistenceRef === 'object' &&
    !Array.isArray(evidence.checkpointPersistenceRef)
      ? (evidence.checkpointPersistenceRef as Record<string, unknown>)
      : null;
  const expected = {
    routeDecisionHash: normalizeText(input.routeDecision?.routeDecisionHash),
    progressHash: fs.existsSync(input.paths.progress) ? sha256File(input.paths.progress) : '',
    preRenderMustDecompositionGateHash: fs.existsSync(input.paths.preRenderMustGate)
      ? sha256File(input.paths.preRenderMustGate)
      : '',
    preRenderGlobalConsistencyHash: fs.existsSync(input.paths.preRenderGlobalConsistency)
      ? sha256File(input.paths.preRenderGlobalConsistency)
      : '',
    packetSourceReconciliationHash: fs.existsSync(input.paths.reconciliationReport)
      ? sha256File(input.paths.reconciliationReport)
      : '',
  };
  const addIssue = (detail: string) => {
    issues.push(
      preConfirmationIssue(
        'checkpoint_persistence_evidence_invalid',
        `Checkpoint persistence evidence is not bound to the current transaction: ${detail}.`,
        [toRootRelativePath(input.root, input.evidencePath)],
        'requirements_contract_authoring_scale_routing'
      )
    );
  };
  if (!evidence) {
    addIssue('evidence file is missing or invalid JSON');
    return issues;
  }
  if (evidence.checkpointPersistenceSatisfiedCandidate !== true) {
    addIssue('checkpointPersistenceSatisfiedCandidate is not true');
  }
  if (!ref) {
    addIssue('checkpointPersistenceRef is missing');
    return issues;
  }
  for (const [field, expectedValue] of Object.entries(expected)) {
    const actual = normalizeText(ref[field]);
    if (!expectedValue || actual !== expectedValue) {
      addIssue(`${field} mismatch`);
    }
  }
  const receiptRefs = Array.isArray(ref.checkpointReceiptRefs)
    ? (ref.checkpointReceiptRefs as Record<string, unknown>[])
    : [];
  if (receiptRefs.length !== AUTHORING_REPAIR_CHECKPOINT_IDS.length) {
    addIssue('checkpointReceiptRefs must contain one receipt ref per checkpoint');
  }
  const completedIds = asStringArray(ref.completedCheckpointIds);
  for (const checkpoint of AUTHORING_REPAIR_CHECKPOINTS) {
    if (!completedIds.includes(checkpoint.id)) {
      addIssue(`completedCheckpointIds missing ${checkpoint.id}`);
    }
    const receiptPath = checkpointReceiptPath(input.paths, checkpoint);
    const refRow = receiptRefs.find((item) => normalizeText(item.checkpointId) === checkpoint.id);
    if (!refRow) {
      addIssue(`checkpoint receipt ref missing ${checkpoint.id}`);
      continue;
    }
    if (normalizeText(refRow.path) !== toRootRelativePath(input.root, receiptPath)) {
      addIssue(`checkpoint receipt path mismatch ${checkpoint.id}`);
    }
    if (!fs.existsSync(receiptPath)) {
      addIssue(`checkpoint receipt file missing ${checkpoint.id}`);
      continue;
    }
    if (normalizeText(refRow.hash) !== sha256File(receiptPath)) {
      addIssue(`checkpoint receipt hash mismatch ${checkpoint.id}`);
    }
    const receipt = readJsonIfExists(receiptPath);
    if (
      !isCurrentCheckpointReceipt({
        root: input.root,
        receipt,
        checkpoint,
        sourceDocumentHash: normalizeText(evidence.sourceDocumentHash),
        implementationConfirmationHash: normalizeText(evidence.implementationConfirmationHash),
        draftSourcePath: input.sourcePath,
      })
    ) {
      addIssue(`checkpoint receipt stale or invalid ${checkpoint.id}`);
    }
  }
  return issues;
}

function collectBlockingIssuesFromReports(
  ...reports: Array<Record<string, unknown> | null>
): PreConfirmationDrilldownIssue[] {
  return reports.flatMap((report) => {
    if (!report) {
      return [];
    }
    const issueRows = [
      ...(Array.isArray(report.blockingIssues) ? report.blockingIssues : []),
      ...(Array.isArray(report.issues) ? report.issues : []),
    ];
    const normalized = issueRows
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
      .map((item) =>
        preConfirmationIssue(
          normalizeText(item.code) || 'unknown_pre_confirmation_issue',
          normalizeText(item.message) || normalizeText(item.code) || 'pre-confirmation issue',
          Array.isArray(item.refs) ? item.refs.map(String) : [],
          normalizeText(item.source) || 'pre_confirmation_gate'
        )
      );
    if (normalized.length > 0) {
      return normalized;
    }
    return (Array.isArray(report.failedChecks) ? report.failedChecks : []).map((code) =>
      preConfirmationIssue(
        String(code),
        `pre-confirmation gate failed: ${String(code)}`,
        [String(code)],
        'pre_confirmation_gate'
      )
    );
  });
}

function artifactMap(root: string, paths: PreConfirmationPaths): Record<string, string> {
  return {
    semanticKernel: toRootRelativePath(root, paths.semanticKernel),
    mustDecompositionPacket: toRootRelativePath(root, paths.mustDecompositionPacket),
    controlledMustCandidates: toRootRelativePath(root, paths.controlledMustCandidates),
    requirementCoverageLedger: toRootRelativePath(root, paths.requirementCoverageLedger),
    targetAuthorityReport: toRootRelativePath(root, paths.targetAuthorityReport),
    validationAuthorityReport: toRootRelativePath(root, paths.validationAuthorityReport),
    projectionDomainSanityReport: toRootRelativePath(root, paths.projectionDomainSanityReport),
    sourceMutationDecision: toRootRelativePath(root, paths.sourceMutationDecision),
    draftSourcePreview: toRootRelativePath(root, paths.draftSourcePreview),
    draftImplementationConfirmation: toRootRelativePath(root, paths.draftImplementationConfirmation),
    authoringMaterializationReceipt: toRootRelativePath(
      root,
      paths.authoringMaterializationReceipt
    ),
    criticalAuditorReceiptRound1: toRootRelativePath(root, paths.receiptPaths[0]),
    criticalAuditorReceiptRound2: toRootRelativePath(root, paths.receiptPaths[1]),
    criticalAuditorReceiptRound3: toRootRelativePath(root, paths.receiptPaths[2]),
    criticalAuditorReceiptDirectory: toRootRelativePath(root, paths.authoringDir),
    criticalAuditorReceiptGlob: `${toRootRelativePath(root, paths.authoringDir)}/critical-auditor-receipt-round-*.json`,
    criticalAuditorStagingRoot: toRootRelativePath(root, path.join(paths.authoringDir, 'staging')),
    criticalAuditorArchiveDir: toRootRelativePath(root, paths.archiveDir),
    promotionReceipt: toRootRelativePath(root, paths.promotionReceipt),
    sourceMaterializationReceipt: toRootRelativePath(root, paths.sourceMaterializationReceipt),
    packetSourceReconciliation: toRootRelativePath(root, paths.reconciliationReport),
    semanticCheckpointProgress: toRootRelativePath(root, paths.progress),
    preRenderMustDecompositionGate: toRootRelativePath(root, paths.preRenderMustGate),
    preRenderGlobalConsistency: toRootRelativePath(root, paths.preRenderGlobalConsistency),
    confirmationHtml: toRootRelativePath(root, paths.confirmationHtml),
    confirmationSummary: toRootRelativePath(root, paths.confirmationSummary),
    confirmationRenderReport: toRootRelativePath(root, paths.confirmationRenderReport),
  };
}

function buildPreConfirmationResult(input: {
  root: string;
  sourcePath: string;
  recordId: string;
  requirementSetId: string;
  paths: PreConfirmationPaths;
  substate: PreConfirmationDrilldownSubstate;
  issues?: PreConfirmationDrilldownIssue[];
  renderReport?: Record<string, unknown> | null;
  mustGateReport?: Record<string, unknown> | null;
  globalGateReport?: Record<string, unknown> | null;
  sourceDocumentHash?: string | null;
  implementationConfirmationHash?: string | null;
  criticalAuditorProviderMode?: CriticalAuditorProviderMode;
  blockingStage?: string | null;
  sourceMutationPerformed?: boolean;
  allowedArtifacts?: string[];
  forbiddenArtifacts?: string[];
  criticalAuditorContinuation?: Record<string, unknown> | null;
  stagingTransaction?: CriticalAuditorStagingTransaction | null;
  finalStandards?: Record<string, boolean>;
  receiptPath?: string | null;
  receiptHash?: string | null;
  updatedSourceSections?: string[];
  blockingNextAction?: string | null;
  selectedAuthoringLane?: 'author-confirmation-ready-source';
  visibleAuthoringLaneMessage?: string;
  status?: 'draft_updated_not_confirmation_ready';
  changedSections?: string[];
  currentBlockingReason?: string | null;
  nextUserPrompt?: string | null;
  nextRequiredAction?: string | null;
  confirmationLanguage?: string | null;
}): MainAgentPreConfirmationDrilldownResult {
  const issues = input.issues ?? [];
  const confirmable = input.substate === 'user_confirmable' && issues.length === 0;
  const deliveryReadiness =
    input.renderReport?.deliveryReadiness &&
    typeof input.renderReport.deliveryReadiness === 'object' &&
    !Array.isArray(input.renderReport.deliveryReadiness)
      ? (input.renderReport.deliveryReadiness as Record<string, unknown>)
      : { ready: false, label: 'delivery_not_ready_before_controlled_ingest' };
  return {
    ok: confirmable,
    selectedAuthoringLane: input.selectedAuthoringLane ?? 'author-confirmation-ready-source',
    visibleAuthoringLaneMessage:
      input.visibleAuthoringLaneMessage ??
      `author-confirmation-ready-source lane selected for ${toRootRelativePath(
        input.root,
        input.sourcePath
      )}`,
    advisoryScan: {
      purpose: 'pre_materialization_advisory_scan',
      evidenceClass: 'not_audit_evidence',
      notAuditEvidence: true,
      readOnly: true,
      loopAllowed: false,
      artifactWriteAllowed: false,
      appliesBefore: 'source_materialization',
    },
    status: input.status,
    changedSections: input.changedSections ?? input.updatedSourceSections ?? [],
    currentBlockingReason: input.currentBlockingReason ?? null,
    nextUserPrompt: input.nextUserPrompt ?? null,
    nextRequiredAction: input.nextRequiredAction ?? null,
    confirmationLanguage: input.confirmationLanguage ?? null,
    currentMentalModel: 'requirement_confirmation',
    lane: 'pre_confirmation_drilldown',
    substate: input.substate,
    currentSubstate: input.substate,
    nextAction: confirmable
      ? 'await_exact_confirmation_phrase_with_hashes'
      : 'repair_non_semantic_gap',
    nextMentalModel: null,
    userConfirmable: confirmable,
    controlledIngestRequiredBeforeProgression: true,
    artifacts: artifactMap(input.root, input.paths),
    blockingIssues: issues,
    sourcePath: toRootRelativePath(input.root, input.sourcePath),
    requirementSetId: input.requirementSetId,
    recordId: input.recordId,
    sourceDocumentHash: input.sourceDocumentHash ?? null,
    implementationConfirmationHash: input.implementationConfirmationHash ?? null,
    criticalAuditorProviderMode: input.criticalAuditorProviderMode,
    blockingStage: input.blockingStage ?? (issues[0]?.code === 'critical_auditor_provider_mode_required'
      ? 'critical_auditor_provider_mode_required'
      : null),
    sourceMutationPerformed: input.sourceMutationPerformed ?? false,
    allowedArtifacts: input.allowedArtifacts,
    forbiddenArtifacts: input.forbiddenArtifacts,
    criticalAuditorContinuation: input.criticalAuditorContinuation ?? null,
    stagingTransaction: input.stagingTransaction
      ? stagingTransactionEvidence(input.root, input.stagingTransaction)
      : null,
    confirmationHtmlPath: fs.existsSync(input.paths.confirmationHtml)
      ? toRootRelativePath(input.root, input.paths.confirmationHtml)
      : null,
    confirmationRenderReportPath: fs.existsSync(input.paths.confirmationRenderReport)
      ? toRootRelativePath(input.root, input.paths.confirmationRenderReport)
      : null,
    confirmability: confirmable ? 'confirmable' : 'blocked',
    deliveryReadiness,
    receiptPath: input.receiptPath ?? null,
    receiptHash: input.receiptHash ?? null,
    updatedSourceSections: input.updatedSourceSections ?? [],
    blockingNextAction: input.blockingNextAction ?? null,
    finalStandards: {
      newSkillFlowEntersAtomicDecompositionLoopBeforeMaterialization: false,
      singlePassCannotSkipAtomicDecompositionLoop: false,
      threeConsecutiveNoNewValidGapRoundsRequired: false,
      mustDecompositionPacketSynchronizedBeforeMaterialization: false,
      sourceRowsMaterializedOnlyFromPacketProjections: false,
      packetSourceReconciliationPassesBidirectionally: false,
      preRenderGateBlocksMissingCoreSurfaces: false,
      rendererShowsFullDrilldownInteraction: false,
      confirmabilityBlocksOnMissingDrilldownSurfaces: false,
      controlledIngestRequiredBeforeMentalModelProgression: false,
      ...(input.finalStandards ?? {}),
    },
  };
}

function updatePreConfirmationProgress(input: {
  root: string;
  sourcePath: string;
  paths: PreConfirmationPaths;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  createdAt: string;
  mustGateReport: Record<string, unknown> | null;
  globalGateReport: Record<string, unknown> | null;
  substate: PreConfirmationDrilldownSubstate;
}): void {
  const criticalAuditor = input.mustGateReport?.criticalAuditor as
    | Record<string, unknown>
    | undefined;
  const consecutiveNoNewValidGapRounds = Number(criticalAuditor?.consecutiveNoNewGapRounds ?? 0);
  const progressCheckpoints = [
    { id: 'cp-00-semantic-kernel', name: 'semantic kernel', status: 'passed' },
    { id: 'cp-01-must-decomposition-packet', name: 'must_decomposition_packet', status: 'passed' },
    {
      id: 'cp-02-atomic-decomposition-loop-convergence',
      name: 'atomic decomposition loop convergence',
      status: consecutiveNoNewValidGapRounds >= 3 ? 'passed' : 'blocked',
      consecutiveNoNewValidGapRounds,
    },
    {
      id: 'cp-03-packet-to-source-materialization',
      name: 'packet-to-source materialization',
      status: 'passed',
    },
    { id: 'cp-04-id-freeze', name: 'ID freeze', status: 'passed' },
    {
      id: 'cp-05-implementation-confirmation-core',
      name: 'implementationConfirmation core',
      status: 'passed',
    },
    {
      id: 'cp-06-projections',
      name: 'EVD/TRACE/ACC/E2E/failure/edge/currentTarget/AI-TDD projections',
      status: 'passed',
    },
    { id: 'cp-07-human-readable-views', name: 'human-readable views', status: 'passed' },
    {
      id: 'cp-08-pre-render-global-reconciliation',
      name: 'pre-render global reconciliation',
      status:
        input.mustGateReport?.verdict === 'PASS' && input.globalGateReport?.verdict === 'PASS'
          ? 'passed'
          : 'blocked',
    },
  ];
  writeJsonUtf8(input.paths.progress, {
    schemaVersion: 'semantic-checkpoint-progress/v1',
    recordId: input.recordId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    source: toRootRelativePath(input.root, input.sourcePath),
    documentHash: sha256File(input.sourcePath),
    mode: 'checkpoint_required',
    modeDecision: 'checkpoint_required',
    authoringMode: 'semantic_kernel_then_packet_with_amendment',
    lastCompletedCheckpoint: 'cp-08-pre-render-global-reconciliation',
    currentCheckpoint: null,
    next: null,
    contentHash: sha256Json({
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      substate: input.substate,
    }),
    createdBy: 'main_agent_orchestration.requirement_confirmation.pre_confirmation_drilldown',
    createdAt: input.createdAt,
    inputRefs: ['semantic-kernel.json', 'must_decomposition_packet.json'],
    currentMentalModel: 'requirement_confirmation',
    lane: 'pre_confirmation_drilldown',
    substate: input.substate,
    checkpoints: progressCheckpoints,
    authoringSubstates: [
      { id: 'source_identification', status: 'completed' },
      { id: 'scale_assessment', status: 'completed' },
      { id: 'semantic_kernel_authoring', status: 'completed' },
      { id: 'atomic_decomposition_loop', status: 'completed' },
      {
        id: 'critical_auditor_receipt_loop',
        status: consecutiveNoNewValidGapRounds >= 3 ? 'completed' : 'blocked',
        consecutiveNoNewValidGapRounds,
      },
      { id: 'packet_synchronization', status: 'completed' },
      { id: 'packet_to_source_materialization', status: 'completed' },
      {
        id: 'packet_source_reconciliation',
        status: input.mustGateReport?.packetSourceReconciliation ? 'completed' : 'blocked',
      },
      {
        id: 'pre_render_must_decomposition_gate',
        status: input.mustGateReport?.verdict === 'PASS' ? 'completed' : 'blocked',
      },
      {
        id: 'pre_render_global_consistency_gate',
        status: input.globalGateReport?.verdict === 'PASS' ? 'completed' : 'blocked',
      },
    ],
    validation: {
      mustDecomposition: input.mustGateReport?.verdict === 'PASS' ? 'pass' : 'fail',
      packetSourceReconciliation:
        (input.mustGateReport?.packetSourceReconciliation as Record<string, unknown> | undefined)
          ?.verdict === 'pass'
          ? 'pass'
          : 'fail',
      globalConsistency: input.globalGateReport?.verdict === 'PASS' ? 'pass' : 'fail',
      preRenderGate:
        input.mustGateReport?.verdict === 'PASS' && input.globalGateReport?.verdict === 'PASS'
          ? 'pass'
          : 'fail',
    },
    preRenderMustDecompositionGate: {
      verdict: input.mustGateReport?.verdict ?? 'FAIL',
      reportPath: toRootRelativePath(input.root, input.paths.preRenderMustGate),
      failedChecks: input.mustGateReport?.failedChecks ?? [],
    },
    preRenderGlobalConsistency: {
      verdict: input.globalGateReport?.verdict ?? 'FAIL',
      reportPath: input.globalGateReport?.reportPath ?? null,
      failedChecks: input.globalGateReport?.failedChecks ?? [],
    },
  });
}

function finalStandardsFromReports(input: {
  packet: Record<string, unknown> | null;
  mustGateReport: Record<string, unknown> | null;
  globalGateReport: Record<string, unknown> | null;
  renderReport: Record<string, unknown> | null;
  missingSurfaceProbe?: MainAgentPreConfirmationDrilldownResult | null;
  requirementRecord: Record<string, unknown> | null;
}): Record<string, boolean> {
  const packet = input.packet;
  const lifecycle =
    packet?.lifecycle && typeof packet.lifecycle === 'object' && !Array.isArray(packet.lifecycle)
      ? (packet.lifecycle as Record<string, unknown>)
      : {};
  const renderSections = Array.isArray(input.renderReport?.renderedSections)
    ? input.renderReport.renderedSections.map(String)
    : [];
  const delivery =
    input.renderReport?.deliveryReadiness &&
    typeof input.renderReport.deliveryReadiness === 'object' &&
    !Array.isArray(input.renderReport.deliveryReadiness)
      ? (input.renderReport.deliveryReadiness as Record<string, unknown>)
      : {};
  return {
    newSkillFlowEntersAtomicDecompositionLoopBeforeMaterialization:
      lifecycle.atomicDecompositionLoopEnteredBeforeMaterialization === true,
    singlePassCannotSkipAtomicDecompositionLoop: true,
    threeConsecutiveNoNewValidGapRoundsRequired:
      Number(
        input.mustGateReport?.criticalAuditor &&
          (input.mustGateReport.criticalAuditor as Record<string, unknown>)
            .consecutiveNoNewGapRounds
      ) >= 3,
    mustDecompositionPacketSynchronizedBeforeMaterialization:
      packet?.status === 'synchronized' && lifecycle.materializedAfterStatus === 'synchronized',
    sourceRowsMaterializedOnlyFromPacketProjections:
      (input.mustGateReport?.packetSourceReconciliation as Record<string, unknown> | undefined)
        ?.verdict === 'pass',
    packetSourceReconciliationPassesBidirectionally:
      (input.mustGateReport?.packetSourceReconciliation as Record<string, unknown> | undefined)
        ?.verdict === 'pass',
    preRenderGateBlocksMissingCoreSurfaces:
      input.missingSurfaceProbe?.confirmability === 'blocked' &&
      input.missingSurfaceProbe.blockingIssues.length > 0,
    rendererShowsFullDrilldownInteraction:
      renderSections.includes('pre-confirmation-semantic-drilldown') &&
      Boolean(input.renderReport?.preConfirmationSemanticDrilldown) &&
      (input.renderReport?.preConfirmationSemanticDrilldown as Record<string, unknown> | undefined)
        ?.status === 'pass',
    confirmabilityBlocksOnMissingDrilldownSurfaces:
      input.missingSurfaceProbe?.confirmability === 'blocked',
    controlledIngestRequiredBeforeMentalModelProgression:
      normalizeText(input.requirementRecord?.status) !== 'user_confirmed' &&
      delivery.ready !== true,
  };
}

export function runMainAgentPreConfirmationDrilldown(
  root: string,
  options: PreConfirmationRunOptions
): MainAgentPreConfirmationDrilldownResult {
  const sourceArg = normalizeText(options.source);
  const intakeArg = normalizeText(options.intakeSource);
  const targetSourceArg = normalizeText(options.targetSource);
  if (sourceArg && intakeArg) {
    throw new Error('requirements_authoring_entry_mode_conflict');
  }
  if (intakeArg && !targetSourceArg) {
    throw new Error('requirements_authoring_target_source_required');
  }
  if (!sourceArg && !intakeArg) {
    throw new Error(
      'pre-confirmation-drilldown requires --source <source-document.md> or --intake-source <intake.md> --target-source <target.md>'
    );
  }
  const entryMode: RequirementsAuthoringEntryMode = intakeArg ? 'intake_to_new_source' : 'existing_source';
  const intakePath = intakeArg ? resolveRootRelativePath(root, intakeArg) : null;
  const sourcePath = entryMode === 'intake_to_new_source'
    ? resolveRootRelativePath(root, targetSourceArg)
    : resolveRootRelativePath(root, sourceArg);
  const semanticInputPath = intakePath ?? sourcePath;
  if (!fs.existsSync(semanticInputPath)) {
    throw new Error(`source document not found: ${semanticInputPath}`);
  }
  if (entryMode === 'intake_to_new_source' && fs.existsSync(sourcePath)) {
    throw new Error('target_created_before_promotion');
  }
  const identity = derivePreConfirmationIdentity(root, sourcePath, options);
  const paths = preConfirmationPaths(root, identity.recordId, identity.requirementSetId);
  const createdAt = new Date().toISOString();
  const language = normalizeText(options.confirmationLanguage) || null;

  if (normalizeText(options.mode) === 'single_pass') {
    const issue = preConfirmationIssue(
      'single_pass_cannot_skip_atomic_decomposition_loop',
      'single_pass cannot skip the mandatory pre-confirmation atomic decomposition loop',
      ['atomic_decomposition_loop']
    );
    return buildPreConfirmationResult({
      root,
      sourcePath: semanticInputPath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_under_split_task',
      issues: [issue],
      finalStandards: { singlePassCannotSkipAtomicDecompositionLoop: true },
    });
  }

  const sourceText = fs.readFileSync(semanticInputPath, 'utf8');
  const sourceHashBefore = semanticSourceDocumentHashForText(sourceText);
  const stagingTransaction = createCriticalAuditorStagingTransaction({
    paths,
    recordId: identity.recordId,
    sourceStartHash: sourceHashBefore,
  });
  fs.mkdirSync(stagingTransaction.stagingDir, { recursive: true });
  writeRequirementsAuthoringTransaction({
    root,
    paths,
    entryMode,
    substate: entryMode === 'intake_to_new_source' ? 'intake_created' : 'initial_scale_assessed',
    sourcePath,
    intakePath,
    targetSourcePath: entryMode === 'intake_to_new_source' ? sourcePath : null,
    sourceStartHash: sourceHashBefore,
    nextRequiredAction: 'run_initial_scale_assessment',
  });
  const explicitCheckpointEvidencePath = normalizeText(options.checkpointPersistenceEvidencePath)
    ? resolveRootRelativePath(root, normalizeText(options.checkpointPersistenceEvidencePath))
    : '';
  let checkpointPersistenceEvidencePrevalidated = false;
  if (explicitCheckpointEvidencePath && fs.existsSync(paths.scaleRoutingDecision)) {
    const existingRouteDecision = readJsonIfExists(paths.scaleRoutingDecision);
    checkpointPersistenceEvidencePrevalidated =
      validateCheckpointPersistenceEvidence({
        root,
        sourcePath: paths.draftSourcePreview,
        paths,
        evidencePath: explicitCheckpointEvidencePath,
        routeDecision: existingRouteDecision,
      }).length === 0;
  }

  const semanticKernelHashSeed = sha256Json({
    recordId: identity.recordId,
    sourcePath: toRootRelativePath(root, sourcePath),
    lane: 'pre_confirmation_drilldown',
    seed: 'semantic-kernel',
  });
  const packetHash = sha256Json({
    recordId: identity.recordId,
    sourcePath: toRootRelativePath(root, sourcePath),
    lane: 'pre_confirmation_drilldown',
    seed: 'must-decomposition-packet',
  });
  const receiptHashSeed = sha256Json({
    recordId: identity.recordId,
    packetHash,
    seed: 'critical-auditor-receipt',
  });

  const initialScaleAssessment = runPreConfirmationScaleAssessment({
    root,
    sourcePath: semanticInputPath,
    paths,
    phase: 'initial_assessment',
  });
  writeRequirementsAuthoringTransaction({
    root,
    paths,
    entryMode,
    substate: 'initial_scale_assessed',
    sourcePath,
    intakePath,
    targetSourcePath: entryMode === 'intake_to_new_source' ? sourcePath : null,
    sourceStartHash: sourceHashBefore,
    scaleRoutingDecision: normalizeText(initialScaleAssessment.routingDecision?.decision) || null,
    nextRequiredAction: 'create_staging_draft',
  });
  if (initialScaleAssessment.issues.length > 0) {
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: initialScaleAssessment.issues,
      finalStandards: { singlePassCannotSkipAtomicDecompositionLoop: true },
    });
  }

  const criticalAuditorProviderMode = parseCriticalAuditorProviderMode(
    options.criticalAuditorProviderMode
  );
  if (criticalAuditorProviderMode === 'external_adapter') {
    const command = normalizeText(options.criticalAuditorExternalAdapterCommand);
    if (!command) {
      const issue = preConfirmationIssue(
        'critical_auditor_external_adapter_missing',
        'external_adapter Critical Auditor provider mode requires an explicit adapter command.',
        ['criticalAuditorExternalAdapterCommand'],
        'critical_auditor'
      );
      return buildPreConfirmationResult({
        root,
        sourcePath,
        recordId: identity.recordId,
        requirementSetId: identity.requirementSetId,
        paths,
        substate: 'blocked_by_render_gate',
        issues: [issue],
        criticalAuditorProviderMode,
        blockingStage: 'critical_auditor_external_adapter_missing',
        sourceMutationPerformed: false,
      });
    }
  }
  const structuredBlocks = extractStructuredSourceBlocks(root, semanticInputPath, sourceText);
  const coverageLedger = buildRequirementCoverageLedger({
    root,
    sourcePath: semanticInputPath,
    sourceText,
    blocks: structuredBlocks,
  });
  writeRequirementCoverageLedgerArtifact(paths.requirementCoverageLedger, coverageLedger);

  let mustRequirements = resolveSourceMustRequirements(semanticInputPath);
  const controlledCandidates =
    mustRequirements.length === 0
      ? buildControlledMustCandidatesFromPlainSource(root, semanticInputPath, sourceText)
      : [];
  if (mustRequirements.length === 0) {
    mustRequirements = mustRequirementsFromControlledCandidates(
      identity.requirementSetId,
      controlledCandidates
    );
  }

  const explicitTargetPaths = normalizeStringList(options.targetPath);
  const explicitRequiredCommands = normalizeStringList(options.requiredCommand);
  const sourceTargetRecords = extractTargetAuthorityFromSource({ root, sourceText, blocks: structuredBlocks });
  const targetAuthority = resolveTargetAuthority({
    root,
    sourceText,
    explicitTargetPaths,
    sourceRecords: sourceTargetRecords,
  });
  const validationAuthority = buildValidationAuthority({
    root,
    sourceText,
    blocks: structuredBlocks,
    explicitCommands: explicitRequiredCommands,
    targetRecords: targetAuthority.accepted,
  });
  const projectionTargetAuthorityRecords = validationAuthority.acceptedTargetRecords;
  writeAuthorityReports({
    paths,
    root,
    sourcePath: semanticInputPath,
    sourceText,
    targetAuthority: { ...targetAuthority, accepted: projectionTargetAuthorityRecords },
    validationAuthority,
  });
  const projectionSanity = projectionDomainSanityCheck({
    root,
    sourcePath: semanticInputPath,
    sourceText,
    targetRecords: projectionTargetAuthorityRecords,
    validationRecords: validationAuthority.accepted,
  });
  writeJsonUtf8(paths.projectionDomainSanityReport, projectionSanity.report);

  const initialIssues: PreConfirmationDrilldownIssue[] = [];
  initialIssues.push(...userConfirmationPromotionIssues(sourceText, semanticInputPath, root));
  if (coverageLedger.blockingIssues.includes('source_requirement_coverage_gap')) {
    initialIssues.push(
      preConfirmationIssue(
        'source_requirement_coverage_gap',
        'Requirement-bearing source blocks were not mapped to controlled MUST, non-goal, target authority, or validation authority rows.',
        [toRootRelativePath(root, paths.requirementCoverageLedger)],
        'requirement_coverage'
      )
    );
  }
  if (mustRequirements.length === 0) {
    initialIssues.push(
      preConfirmationIssue(
        'controlled_must_candidates_missing',
        'No explicit MUST: rows, inline implementationConfirmation.must[] entries, or source-bound controlled MUST candidates were found after structured candidate extraction.',
        [
          toRootRelativePath(root, semanticInputPath),
          'implementationConfirmation.must',
          toRootRelativePath(root, paths.controlledMustCandidates),
        ],
        'semantic_kernel_authoring'
      )
    );
  }
  initialIssues.push(...targetAuthority.issues, ...validationAuthority.issues, ...projectionSanity.issues);

  const draftConfirmation =
    mustRequirements.length > 0
      ? buildPreConfirmationImplementationConfirmation({
          root,
          sourcePath: semanticInputPath,
          recordId: identity.recordId,
          requirementSetId: identity.requirementSetId,
          language,
          paths,
          packetHash,
          semanticKernelHash: semanticKernelHashSeed,
          latestReceiptHash: receiptHashSeed,
          mustRequirements,
          structuredBlocks,
          targetAuthorityRecords: projectionTargetAuthorityRecords,
          validationAuthorityRecords: validationAuthority.accepted,
          consecutiveNoNewGapRounds: 0,
          auditConvergenceVerdict: 'audit_not_run',
        })
      : null;
  writeControlledMustCandidateArtifacts({
    root,
    sourcePath: semanticInputPath,
    paths,
    recordId: identity.recordId,
    requirementSetId: identity.requirementSetId,
    createdAt,
    sourceText,
    candidates: controlledCandidates,
    mustRequirements,
    draftConfirmation,
    decision: initialIssues.length === 0 ? 'draft_materialization_allowed' : 'controlled_must_candidates_missing',
  });

  if (initialIssues.length > 0 || !draftConfirmation) {
    writeSourceMutationDecision({
      root,
      sourcePath,
      paths,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      createdAt,
      sourceHashBefore,
      issues: initialIssues,
      coverageDecision: coverageLedger.blockingIssues.length > 0 ? 'block' : 'pass',
      targetAuthorityDecision: targetAuthority.issues.length > 0 ? 'block' : 'pass',
      validationAuthorityDecision: validationAuthority.issues.length > 0 ? 'block' : 'pass',
      projectionSanityDecision: projectionSanity.issues.length > 0 ? 'block' : 'pass',
      auditEvidenceDecision: 'not_started',
      scaleRoutingDecision: normalizeText(initialScaleAssessment.routingDecision?.decision) || 'not_started',
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_semantic_gap',
      issues: initialIssues,
      confirmationLanguage: language,
      finalStandards: {
        newSkillFlowEntersAtomicDecompositionLoopBeforeMaterialization: false,
        mustDecompositionPacketSynchronizedBeforeMaterialization: false,
      },
    });
  }

  const materializedDraftText = materializeImplementationConfirmationText(sourceText, draftConfirmation);
  const stagedDraftText = fs.existsSync(stagingTransaction.draftSource)
    ? fs.readFileSync(stagingTransaction.draftSource, 'utf8')
    : null;
  const stagingDraftRefreshed = stagedDraftText !== materializedDraftText;
  if (stagingDraftRefreshed) {
    fs.writeFileSync(stagingTransaction.draftSource, materializedDraftText, 'utf8');
  }
  fs.copyFileSync(stagingTransaction.draftSource, paths.draftSourcePreview);
  writeRequirementsAuthoringTransaction({
    root,
    paths,
    entryMode,
    substate: 'staging_draft_created',
    sourcePath,
    intakePath,
    targetSourcePath: entryMode === 'intake_to_new_source' ? sourcePath : null,
    sourceStartHash: sourceHashBefore,
    draftHash: sha256File(stagingTransaction.draftSource),
    scaleRoutingDecision: normalizeText(initialScaleAssessment.routingDecision?.decision) || null,
    nextRequiredAction: 'run_critical_auditor_loop',
  });
  const previewText = fs.readFileSync(paths.draftSourcePreview, 'utf8');
  const previewExtraction = extractImplementationConfirmationBlock(previewText);
  if (!previewExtraction) {
    const issue = preConfirmationIssue(
      'draft_source_preview_missing_implementation_confirmation',
      'Draft source preview failed to materialize implementationConfirmation.',
      [toRootRelativePath(root, paths.draftSourcePreview)],
      'source_mutation_gate'
    );
    writeSourceMutationDecision({
      root,
      sourcePath,
      paths,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      createdAt,
      sourceHashBefore,
      issues: [issue],
      coverageDecision: 'pass',
      targetAuthorityDecision: 'pass',
      validationAuthorityDecision: 'pass',
      projectionSanityDecision: 'pass',
      auditEvidenceDecision: 'not_started',
      scaleRoutingDecision: normalizeText(initialScaleAssessment.routingDecision?.decision) || 'not_started',
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: [issue],
      confirmationLanguage: language,
    });
  }

  const previewSourceDocumentHash = sourceDocumentHashForPreConfirmation(
    previewText,
    previewExtraction.blockText,
    previewExtraction.confirmation
  );
  const previewImplementationConfirmationHash = implementationConfirmationHashForPreConfirmation(
    previewExtraction.confirmation
  );
  let kernel: Record<string, unknown>;
  if (!stagingDraftRefreshed && fs.existsSync(stagingTransaction.semanticKernel)) {
    const stagedKernel = readJsonIfExists(stagingTransaction.semanticKernel);
    kernel = recordObject(stagedKernel?.semanticKernel);
    writeJsonUtf8(paths.semanticKernel, { semanticKernel: kernel });
  } else {
    kernel = buildSemanticKernel({
      root,
      sourcePath: paths.draftSourcePreview,
      recordId: identity.recordId,
      sourceDocumentHash: previewSourceDocumentHash,
      implementationConfirmationHash: previewImplementationConfirmationHash,
      createdAt,
      mustRequirements,
    });
    writeJsonUtf8(paths.semanticKernel, { semanticKernel: kernel });
    writeJsonUtf8(stagingTransaction.semanticKernel, {
      semanticKernel: {
        ...kernel,
        transactionId: stagingTransaction.transactionId,
        namespaceVersion: stagingTransaction.namespaceVersion,
      },
    });
  }
  const semanticKernelHash = normalizeText(kernel.kernelHash);
  let previewPacket: Record<string, unknown>;
  if (!stagingDraftRefreshed && fs.existsSync(stagingTransaction.mustDecompositionPacket)) {
    const stagedPacket = readJsonIfExists(stagingTransaction.mustDecompositionPacket);
    previewPacket = recordObject(stagedPacket?.must_decomposition_packet);
    writeJsonUtf8(paths.mustDecompositionPacket, { must_decomposition_packet: previewPacket });
  } else {
    previewPacket = buildMustDecompositionPacket({
      root,
      sourcePath: paths.draftSourcePreview,
      paths,
      recordId: identity.recordId,
      sourceDocumentHash: previewSourceDocumentHash,
      implementationConfirmationHash: previewImplementationConfirmationHash,
      semanticKernelHash,
      packetHash,
      createdAt,
      mustRequirements,
      targetAuthorityRecords: projectionTargetAuthorityRecords,
      consecutiveNoNewGapRounds: 0,
    });
    writeJsonUtf8(paths.mustDecompositionPacket, { must_decomposition_packet: previewPacket });
    writeJsonUtf8(stagingTransaction.mustDecompositionPacket, {
      must_decomposition_packet: {
        ...previewPacket,
        transactionId: stagingTransaction.transactionId,
        namespaceVersion: stagingTransaction.namespaceVersion,
      },
    });
  }

  const previewPostPacketScaleAssessment = runPreConfirmationScaleAssessment({
    root,
    sourcePath: paths.draftSourcePreview,
    paths,
    phase: 'post_packet_assessment',
  });
  if (previewPostPacketScaleAssessment.issues.length > 0) {
    writeSourceMutationDecision({
      root,
      sourcePath,
      paths,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      createdAt,
      sourceHashBefore,
      issues: previewPostPacketScaleAssessment.issues,
      coverageDecision: 'pass',
      targetAuthorityDecision: 'pass',
      validationAuthorityDecision: 'pass',
      projectionSanityDecision: 'pass',
      auditEvidenceDecision: 'not_started',
      scaleRoutingDecision:
        normalizeText(previewPostPacketScaleAssessment.routingDecision?.decision) || 'missing',
    });
    writeRequirementsAuthoringTransaction({
      root,
      paths,
      entryMode,
      substate: providerMissing ? 'critical_auditor_round_required' : 'staging_draft_created',
      sourcePath,
      intakePath,
      targetSourcePath: entryMode === 'intake_to_new_source' ? sourcePath : null,
      sourceStartHash: sourceHashBefore,
      draftHash: fs.existsSync(stagingTransaction.draftSource)
        ? sha256File(stagingTransaction.draftSource)
        : null,
      scaleRoutingDecision:
        normalizeText(previewPostPacketScaleAssessment.routingDecision?.decision) || 'missing',
      nextRequiredAction: providerMissing
        ? 'run_main_session_critical_auditor_round'
        : 'repair_critical_auditor_gap',
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: providerMissing ? 'critical_auditor_round_required' : 'blocked_by_render_gate',
      issues: previewPostPacketScaleAssessment.issues,
      sourceDocumentHash: sourceHashBefore,
      implementationConfirmationHash: previewImplementationConfirmationHash,
    });
  }

  const auditInputHash = sha256Json({
    sourceDocumentHash: previewSourceDocumentHash,
    implementationConfirmationHash: previewImplementationConfirmationHash,
    semanticKernelHash,
    packetHash,
  });
  const responseFilePath = normalizeText(options.criticalAuditorResponseFile)
    ? resolveRootRelativePath(root, normalizeText(options.criticalAuditorResponseFile))
    : '';
  const responseDirPath = normalizeText(options.criticalAuditorResponseDir)
    ? resolveRootRelativePath(root, normalizeText(options.criticalAuditorResponseDir))
    : '';
  const fileBackedProvider =
    (responseFilePath || responseDirPath) &&
    ['response_file', 'codex_subagent_readonly', 'claude_subagent_readonly'].includes(
      criticalAuditorProviderMode
    )
      ? (() => {
          let responseFileConsumed = false;
          return (round: CriticalAuditorRoundInput): CriticalAuditorRoundResult => {
          const requestPath = criticalAuditorRequestPath(stagingTransaction, round.roundIndex);
          const request = readJsonIfExists(requestPath);
          if (!request) {
            throw new Error(`critical_auditor_request_missing_for_response: ${requestPath}`);
          }
          const gateDryRun = round.gateDryRun;
          const responseTargetPath = criticalAuditorResponsePath(stagingTransaction, round.roundIndex);
          const responseDirRoundPath = responseDirPath
            ? path.join(responseDirPath, `critical-auditor-round-response-${round.roundIndex}.json`)
            : '';
          const stagedResponseExists = fs.existsSync(responseTargetPath);
          const responseDirRoundExists = Boolean(
            responseDirRoundPath && fs.existsSync(responseDirRoundPath)
          );
          const selectedResponsePath = stagedResponseExists
            ? responseTargetPath
            : responseDirRoundExists
              ? responseDirRoundPath
              : responseFilePath && !responseFileConsumed
                ? responseFilePath
                : '';
          if (!selectedResponsePath || !fs.existsSync(selectedResponsePath)) {
            throw new Error(
              `critical_auditor_response_file_missing: ${responseTargetPath}`
            );
          }
          const validation = validateCriticalAuditorResponse({
            responsePath: selectedResponsePath,
            request,
            transaction: stagingTransaction,
            roundIndex: round.roundIndex,
            sourceDocumentHash: previewSourceDocumentHash,
            implementationConfirmationHash: previewImplementationConfirmationHash,
            packetHash,
            mustRefs: mustRequirements.map((requirement) => requirement.id),
            packet: previewPacket,
            gateDryRun,
          });
          if (!validation.response) {
            const code = validation.issues[0]?.code ?? 'critical_auditor_response_invalid';
            throw new Error(`${code}: ${selectedResponsePath}`);
          }
          if (path.resolve(selectedResponsePath) !== path.resolve(responseTargetPath)) {
            fs.copyFileSync(selectedResponsePath, responseTargetPath);
          }
          if (responseFilePath && path.resolve(selectedResponsePath) === path.resolve(responseFilePath)) {
            responseFileConsumed = true;
          }
          return validation.response;
        };
      })()
      : undefined;
  const criticalAuditorLoop = runCriticalAuditorReceiptLoop({
    root,
    sourcePath: paths.draftSourcePreview,
    paths,
    transaction: stagingTransaction,
    auditInputHash,
    recordId: identity.recordId,
    sourceDocumentHash: previewSourceDocumentHash,
    implementationConfirmationHash: previewImplementationConfirmationHash,
    packetHash,
    mustRefs: mustRequirements.map((requirement) => requirement.id),
    sourceRequirementTexts: mustRequirements.map((requirement) => requirement.text),
    mustPacketCount: mustRequirements.length,
    packet: previewPacket,
    createdAt,
    roundProvider: options.criticalAuditorRound ?? fileBackedProvider,
    maxRounds: options.maxCriticalAuditorRounds,
  });
  if (criticalAuditorLoop.issues.length > 0) {
    const providerMissing = criticalAuditorLoop.issues.some(
      (issue) => issue.code === 'critical_auditor_provider_mode_required'
    );
    const namespaceMismatch = criticalAuditorLoop.issues.some(
      (issue) => issue.code === 'id_namespace_mismatch'
    );
    const namespaceArchiveDir = namespaceMismatch
      ? archiveCriticalAuditorArtifacts({
          authoringDir: paths.authoringDir,
          stagingDir: stagingTransaction.stagingDir,
          reason: 'stale_namespace_response_rejected',
          auditInputHash,
          createdAt,
        })
      : null;
    if (namespaceMismatch) {
      const freshGateDryRun = buildCriticalAuditorGateDryRunSummary({
        root,
        sourcePath: paths.draftSourcePreview,
        paths,
        roundIndex: 1,
      });
      const freshRequest = buildCriticalAuditorRoundRequest({
        root,
        sourcePath: paths.draftSourcePreview,
        recordId: identity.recordId,
        roundIndex: 1,
        transactionId: stagingTransaction.transactionId,
        namespaceVersion: stagingTransaction.namespaceVersion,
        sourceDocumentHash: previewSourceDocumentHash,
        implementationConfirmationHash: previewImplementationConfirmationHash,
        packetHash,
        auditInputHash,
        mustRequirements,
        packet: previewPacket,
        previousReceipts: [],
        gateDryRun: freshGateDryRun,
        createdAt,
      });
      writeJsonUtf8(criticalAuditorRequestPath(stagingTransaction, 1), freshRequest);
    }
    writeSourcePromotionBlockDecision({
      transaction: stagingTransaction,
      blockingStage: providerMissing
        ? 'critical_auditor_provider_mode_required'
        : namespaceMismatch
          ? 'id_namespace_mismatch'
          : 'critical_auditor_convergence_required',
      archiveDir: namespaceArchiveDir,
      root,
      createdAt,
    });
    writeSourceMutationDecision({
      root,
      sourcePath,
      paths,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      createdAt,
      sourceHashBefore,
      issues: criticalAuditorLoop.issues,
      coverageDecision: 'pass',
      targetAuthorityDecision: 'pass',
      validationAuthorityDecision: 'pass',
      projectionSanityDecision: 'pass',
      auditEvidenceDecision: 'block',
      scaleRoutingDecision:
        normalizeText(previewPostPacketScaleAssessment.routingDecision?.decision) || 'missing',
    });
    writeRequirementsAuthoringTransaction({
      root,
      paths,
      entryMode,
      substate: providerMissing ? 'critical_auditor_round_required' : 'staging_draft_created',
      sourcePath,
      intakePath,
      targetSourcePath: entryMode === 'intake_to_new_source' ? sourcePath : null,
      sourceStartHash: sourceHashBefore,
      draftHash: fs.existsSync(paths.draftSourcePreview) ? sha256File(paths.draftSourcePreview) : null,
      scaleRoutingDecision:
        normalizeText(previewPostPacketScaleAssessment.routingDecision?.decision) || 'missing',
      nextRequiredAction: providerMissing
        ? 'run_main_session_critical_auditor_round'
        : 'repair_critical_auditor_gap',
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: providerMissing ? 'critical_auditor_round_required' : 'blocked_by_render_gate',
      issues: criticalAuditorLoop.issues,
      sourceDocumentHash: sourceHashBefore,
      implementationConfirmationHash: previewImplementationConfirmationHash,
      criticalAuditorProviderMode,
      blockingStage: providerMissing ? 'critical_auditor_provider_mode_required' : null,
      sourceMutationPerformed: false,
      allowedArtifacts: providerMissing ? ['advisory', 'staging'] : undefined,
      forbiddenArtifacts: providerMissing
        ? ['promotion-receipt', 'source-materialization-receipt', 'source mutation']
        : undefined,
      criticalAuditorContinuation: criticalAuditorLoop.continuation ?? null,
      stagingTransaction,
      nextRequiredAction: providerMissing
        ? 'run_main_session_critical_auditor_round'
        : undefined,
      finalStandards: {
        newSkillFlowEntersAtomicDecompositionLoopBeforeMaterialization: true,
        singlePassCannotSkipAtomicDecompositionLoop: true,
        threeConsecutiveNoNewValidGapRoundsRequired: false,
        mustDecompositionPacketSynchronizedBeforeMaterialization: true,
      },
    });
  }

  const latestReceiptHash = criticalAuditorLoop.latestReceiptHash ?? receiptHashSeed;
  const existingCriticalAuditorState = recordObject(
    recordObject(previewExtraction.confirmation.preConfirmationDrilldown).criticalAuditor
  );
  const existingDraftAlreadyConverged =
    Number(existingCriticalAuditorState.consecutiveNoNewGapRounds ?? 0) >= 3 &&
    normalizeText(existingCriticalAuditorState.convergenceVerdict) === 'bounded_no_new_gap' &&
    criticalAuditorLoop.consecutiveNoNewGapRounds >= 3;
  if (!existingDraftAlreadyConverged) {
    const auditedConfirmation = buildPreConfirmationImplementationConfirmation({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      language,
      paths,
      packetHash,
      semanticKernelHash,
      latestReceiptHash,
      mustRequirements,
      structuredBlocks,
      targetAuthorityRecords: projectionTargetAuthorityRecords,
      validationAuthorityRecords: validationAuthority.accepted,
      consecutiveNoNewGapRounds: criticalAuditorLoop.consecutiveNoNewGapRounds,
      auditConvergenceVerdict:
        criticalAuditorLoop.consecutiveNoNewGapRounds >= 3 ? 'bounded_no_new_gap' : 'blocked',
    });
    fs.writeFileSync(paths.draftSourcePreview, materializeImplementationConfirmationText(sourceText, auditedConfirmation), 'utf8');
    fs.writeFileSync(stagingTransaction.draftSource, fs.readFileSync(paths.draftSourcePreview, 'utf8'), 'utf8');
  }
  const finalDraftSource = path.join(stagingTransaction.stagingDir, 'final-draft-source.md');
  fs.copyFileSync(paths.draftSourcePreview, finalDraftSource);
  const normalizedFinalDraft = normalizeImplementationConfirmationDraftForPromotion({
    root,
    draftPath: finalDraftSource,
    paths,
    blockingStage: 'source_mutation_gate',
  });
  if (!normalizedFinalDraft.ok) {
    writeSourcePromotionBlockDecision({
      transaction: stagingTransaction,
      blockingStage: 'requirements_contract_draft_normalization_failed',
      currentSourceHash: safeCurrentSourceDocumentHash(sourcePath),
      createdAt,
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: normalizedFinalDraft.issues,
      sourceDocumentHash: sourceHashBefore,
      implementationConfirmationHash: previewImplementationConfirmationHash,
    });
  }
  fs.copyFileSync(finalDraftSource, paths.draftSourcePreview);
  fs.copyFileSync(finalDraftSource, stagingTransaction.draftSource);
  const auditedPreviewText = fs.readFileSync(paths.draftSourcePreview, 'utf8');
  const auditedPreviewExtraction = extractImplementationConfirmationBlock(auditedPreviewText);
  if (!auditedPreviewExtraction) {
    throw new Error('audited draft source preview lost implementationConfirmation');
  }
  const auditedPreviewSourceDocumentHash = sourceDocumentHashForPreConfirmation(
    auditedPreviewText,
    auditedPreviewExtraction.blockText,
    auditedPreviewExtraction.confirmation
  );
  const auditedPreviewImplementationConfirmationHash = implementationConfirmationHashForPreConfirmation(
    auditedPreviewExtraction.confirmation
  );
  // The post-audit preview intentionally replaces seed metadata with the current
  // Critical Auditor convergence summary. Continue with the audited hashes so
  // source-race and checkpoint gates remain the authoritative promotion blockers.
  const stagedFinalKernel = recordObject(readJsonIfExists(stagingTransaction.semanticKernel)?.semanticKernel);
  const finalKernel =
    normalizeText(stagedFinalKernel.sourceDocumentHash) === auditedPreviewSourceDocumentHash &&
    normalizeText(stagedFinalKernel.implementationConfirmationHash) === auditedPreviewImplementationConfirmationHash
      ? stagedFinalKernel
      : buildSemanticKernel({
          root,
          sourcePath: paths.draftSourcePreview,
          recordId: identity.recordId,
          sourceDocumentHash: auditedPreviewSourceDocumentHash,
          implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
          createdAt,
          mustRequirements,
        });
  const finalSemanticKernelHash = normalizeText(finalKernel.kernelHash);
  writeJsonUtf8(paths.semanticKernel, { semanticKernel: finalKernel });
  writeJsonUtf8(stagingTransaction.semanticKernel, {
    semanticKernel: {
      ...finalKernel,
      transactionId: stagingTransaction.transactionId,
      namespaceVersion: stagingTransaction.namespaceVersion,
    },
  });

  const stagedFinalPacket = recordObject(
    readJsonIfExists(stagingTransaction.mustDecompositionPacket)?.must_decomposition_packet
  );
  const baseFinalPacket =
    normalizeText(stagedFinalPacket.sourceDocumentHash) === auditedPreviewSourceDocumentHash &&
    normalizeText(stagedFinalPacket.implementationConfirmationHash) === auditedPreviewImplementationConfirmationHash &&
    normalizeText(stagedFinalPacket.semanticKernelHash) === finalSemanticKernelHash
      ? stagedFinalPacket
      : buildMustDecompositionPacket({
          root,
          sourcePath: paths.draftSourcePreview,
          paths,
          recordId: identity.recordId,
          sourceDocumentHash: auditedPreviewSourceDocumentHash,
          implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
          semanticKernelHash: finalSemanticKernelHash,
          packetHash,
          createdAt,
          mustRequirements,
          targetAuthorityRecords: projectionTargetAuthorityRecords,
          consecutiveNoNewGapRounds: criticalAuditorLoop.consecutiveNoNewGapRounds,
        });
  const finalPacket = packetWithCriticalAuditorConvergence(
    baseFinalPacket,
    criticalAuditorLoop.consecutiveNoNewGapRounds
  );
  writeJsonUtf8(paths.mustDecompositionPacket, { must_decomposition_packet: finalPacket });
  writeJsonUtf8(stagingTransaction.mustDecompositionPacket, {
    must_decomposition_packet: {
      ...finalPacket,
      transactionId: stagingTransaction.transactionId,
      namespaceVersion: stagingTransaction.namespaceVersion,
    },
  });
  const finalAuditInputHash = sha256Json({
    sourceDocumentHash: auditedPreviewSourceDocumentHash,
    implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
    semanticKernelHash: finalSemanticKernelHash,
    packetHash,
  });
  const finalCriticalAuditorLoop = mirrorCriticalAuditorReceiptsForCurrentDraft({
    root,
    sourcePath: paths.draftSourcePreview,
    paths,
    transaction: stagingTransaction,
    receipts: criticalAuditorLoop.receipts,
    auditInputHash: finalAuditInputHash,
    recordId: identity.recordId,
    sourceDocumentHash: auditedPreviewSourceDocumentHash,
    implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
    packetHash,
    mustRequirements,
    packet: finalPacket,
    createdAt,
  });

  const mustGateScript = resolveSkillScript(root, 'pre_render_must_decomposition_gate.js');
  const mustGate = runNodeJson(
    mustGateScript,
    [
      '--source',
      paths.draftSourcePreview,
      '--authoring-dir',
      paths.authoringDir,
      '--out',
      paths.preRenderMustGate,
      '--receipt',
      paths.mustDecompositionReceipt,
      '--reconciliation-report',
      paths.reconciliationReport,
      '--json',
    ],
    root
  );
  let mustGateReport = mustGate.json ?? readJsonIfExists(paths.preRenderMustGate);
  if (!mustGateReport) {
    const issue = commandFailureIssue(
      'pre_render_must_decomposition_gate_report_missing',
      mustGateScript,
      mustGate
    );
    writeSourcePromotionBlockDecision({
      transaction: stagingTransaction,
      blockingStage: 'pre_render_must_decomposition_gate_report_missing',
      currentSourceHash: safeCurrentSourceDocumentHash(sourcePath),
      createdAt,
    });
    writeSourceMutationDecision({
      root,
      sourcePath,
      paths,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      createdAt,
      sourceHashBefore,
      issues: [issue],
      coverageDecision: 'pass',
      targetAuthorityDecision: 'pass',
      validationAuthorityDecision: 'pass',
      projectionSanityDecision: 'pass',
      auditEvidenceDecision: 'pass',
      scaleRoutingDecision:
        normalizeText(previewPostPacketScaleAssessment.routingDecision?.decision) || 'missing',
      reverseAuditDraftValidationDecision: 'block',
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: [issue],
      sourceDocumentHash: sourceHashBefore,
      implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
    });
  }
  enhanceArtifactMetadata(paths.reconciliationReport, {
    recordId: identity.recordId,
    sourceDocumentHash: auditedPreviewSourceDocumentHash,
    implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
    createdBy: 'pre_render_must_decomposition_gate',
    createdAt,
    inputRefs: [
      toRootRelativePath(root, paths.draftSourcePreview),
      toRootRelativePath(root, paths.mustDecompositionPacket),
    ],
  });
  mustGateReport =
    enhanceArtifactMetadata(paths.preRenderMustGate, {
      recordId: identity.recordId,
      sourceDocumentHash: auditedPreviewSourceDocumentHash,
      implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
      createdBy: 'pre_render_must_decomposition_gate',
      createdAt,
      inputRefs: [
        toRootRelativePath(root, paths.draftSourcePreview),
        toRootRelativePath(root, paths.semanticKernel),
        toRootRelativePath(root, paths.mustDecompositionPacket),
        toRootRelativePath(root, paths.reconciliationReport),
      ],
    }) ?? mustGateReport;

  const checkpointScript = resolveSkillScript(root, 'run_semantic_checkpoints.js');
  const combinedGate = runNodeJson(
    checkpointScript,
    ['--source', paths.draftSourcePreview, '--progress', paths.progress, '--mode', 'pre-render-gate', '--json'],
    root
  );
  const combinedReport = combinedGate.json;
  if (!combinedReport) {
    const issue = commandFailureIssue(
      'pre_render_global_consistency_gate_report_missing',
      checkpointScript,
      combinedGate
    );
    writeSourcePromotionBlockDecision({
      transaction: stagingTransaction,
      blockingStage: 'pre_render_global_consistency_gate_report_missing',
      currentSourceHash: safeCurrentSourceDocumentHash(sourcePath),
      createdAt,
    });
    writeSourceMutationDecision({
      root,
      sourcePath,
      paths,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      createdAt,
      sourceHashBefore,
      issues: [issue],
      coverageDecision: 'pass',
      targetAuthorityDecision: 'pass',
      validationAuthorityDecision: 'pass',
      projectionSanityDecision: 'pass',
      auditEvidenceDecision: 'pass',
      scaleRoutingDecision:
        normalizeText(previewPostPacketScaleAssessment.routingDecision?.decision) || 'missing',
      reverseAuditDraftValidationDecision: 'block',
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: [issue],
      mustGateReport,
      sourceDocumentHash: sourceHashBefore,
      implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
    });
  }
  const globalGateReport =
    (combinedReport?.globalConsistencyGate &&
    typeof combinedReport.globalConsistencyGate === 'object' &&
    !Array.isArray(combinedReport.globalConsistencyGate)
      ? (combinedReport.globalConsistencyGate as Record<string, unknown>)
      : readJsonIfExists(paths.preRenderGlobalConsistency)) ?? null;
  enhanceArtifactMetadata(paths.preRenderGlobalConsistency, {
    recordId: identity.recordId,
    sourceDocumentHash: auditedPreviewSourceDocumentHash,
    implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
    createdBy: 'run_semantic_checkpoints.pre_render_global_consistency',
    createdAt,
    inputRefs: [
      toRootRelativePath(root, paths.draftSourcePreview),
      toRootRelativePath(root, paths.preRenderMustGate),
    ],
  });
  updatePreConfirmationProgress({
    root,
    sourcePath: paths.draftSourcePreview,
    paths,
    recordId: identity.recordId,
    sourceDocumentHash: auditedPreviewSourceDocumentHash,
    implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
    createdAt,
    mustGateReport,
    globalGateReport,
    substate:
      mustGateReport?.verdict === 'PASS' && globalGateReport?.verdict === 'PASS'
        ? 'pre_render_ready'
        : 'blocked_by_render_gate',
  });

  const gateIssues = collectBlockingIssuesFromReports(mustGateReport, globalGateReport);
  if (
    mustGateReport?.verdict !== 'PASS' ||
    globalGateReport?.verdict !== 'PASS' ||
    gateIssues.length > 0
  ) {
    writeSourcePromotionBlockDecision({
      transaction: stagingTransaction,
      blockingStage: 'pre_render_gate_blocks_source_promotion',
      currentSourceHash: safeCurrentSourceDocumentHash(sourcePath),
      createdAt,
    });
    writeSourceMutationDecision({
      root,
      sourcePath,
      paths,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      createdAt,
      sourceHashBefore,
      issues: gateIssues,
      coverageDecision: 'pass',
      targetAuthorityDecision: 'pass',
      validationAuthorityDecision: 'pass',
      projectionSanityDecision: 'pass',
      auditEvidenceDecision: 'pass',
      scaleRoutingDecision:
        normalizeText(previewPostPacketScaleAssessment.routingDecision?.decision) || 'missing',
      reverseAuditDraftValidationDecision: 'block',
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: gateIssues,
      mustGateReport,
      globalGateReport,
      sourceDocumentHash: sourceHashBefore,
      implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
    });
  }

  const promotionPreSemanticHash =
    entryMode === 'intake_to_new_source'
      ? 'absent'
      : safeCurrentSourceDocumentHash(sourcePath);
  const promotionPreRawHash =
    entryMode === 'intake_to_new_source'
      ? 'absent'
      : sha256Text(fs.readFileSync(sourcePath, 'utf8'));
  if (
    entryMode === 'existing_source' &&
    promotionPreSemanticHash !== stagingTransaction.sourceStartHash
  ) {
    const issue = preConfirmationIssue(
      'source_hash_changed_before_promotion',
      'Current source hash changed after staging transaction start; source promotion is forbidden.',
      [
        toRootRelativePath(root, sourcePath),
        stagingTransaction.sourceStartHash,
        promotionPreSemanticHash,
      ],
      'source_mutation_gate'
    );
    writeSourcePromotionBlockDecision({
      transaction: stagingTransaction,
      currentSourceHash: promotionPreSemanticHash,
      blockingStage: 'source_hash_changed_before_promotion',
      createdAt,
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: [issue],
      mustGateReport,
      globalGateReport,
      sourceDocumentHash: promotionPreSemanticHash,
      implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
      criticalAuditorProviderMode,
      blockingStage: 'source_hash_changed_before_promotion',
      sourceMutationPerformed: false,
      stagingTransaction,
    });
  }
  if (entryMode === 'intake_to_new_source' && fs.existsSync(sourcePath)) {
    const issue = preConfirmationIssue(
      'target_created_before_promotion',
      'Intake target source was created before authoring-draft promotion; source promotion is forbidden.',
      [toRootRelativePath(root, sourcePath)],
      'source_mutation_gate'
    );
    writeSourcePromotionBlockDecision({
      transaction: stagingTransaction,
      currentSourceHash: safeCurrentSourceDocumentHash(sourcePath),
      blockingStage: 'target_created_before_promotion',
      createdAt,
    });
    writeRequirementsAuthoringTransaction({
      root,
      paths,
      entryMode,
      substate: 'promotion_required',
      sourcePath,
      intakePath,
      targetSourcePath: sourcePath,
      sourceStartHash: sourceHashBefore,
      draftHash: fs.existsSync(paths.draftSourcePreview) ? sha256File(paths.draftSourcePreview) : null,
      scaleRoutingDecision: normalizeText(previewPostPacketScaleAssessment.routingDecision?.decision) || null,
      nextRequiredAction: 'stop_target_created_before_promotion',
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: [issue],
      mustGateReport,
      globalGateReport,
      sourceDocumentHash: safeCurrentSourceDocumentHash(sourcePath),
      implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
      criticalAuditorProviderMode,
      blockingStage: 'target_created_before_promotion',
      sourceMutationPerformed: false,
      stagingTransaction,
    });
  }

  let postMaterializationScaleAssessment = runPreConfirmationScaleAssessment({
    root,
    sourcePath: paths.draftSourcePreview,
    paths,
    phase: 'post_materialization_assessment',
  });
  let routingDecision = postMaterializationScaleAssessment.routingDecision;
  let routingDecisionText = normalizeText(routingDecision?.decision);
  let checkpointEvidenceIssues: PreConfirmationDrilldownIssue[] = [];
  let checkpointEvidenceSatisfied = false;
  if (
    explicitCheckpointEvidencePath &&
    ['checkpoint_required', 'checkpoint_required_with_amendment'].includes(routingDecisionText)
  ) {
    checkpointEvidenceIssues = checkpointPersistenceEvidencePrevalidated
      ? []
      : validateCheckpointPersistenceEvidence({
          root,
          sourcePath: paths.draftSourcePreview,
          paths,
          evidencePath: explicitCheckpointEvidencePath,
          routeDecision: routingDecision,
        });
    if (checkpointEvidenceIssues.length === 0) {
      fs.copyFileSync(explicitCheckpointEvidencePath, paths.checkpointPersistenceEvidence);
      postMaterializationScaleAssessment = runPreConfirmationScaleAssessment({
        root,
        sourcePath: paths.draftSourcePreview,
        paths,
        phase: 'post_materialization_assessment',
        checkpointPersistenceEvidencePath: paths.checkpointPersistenceEvidence,
      });
      routingDecision = postMaterializationScaleAssessment.routingDecision;
      routingDecisionText = normalizeText(routingDecision?.decision);
    }
  }
  if (
    !explicitCheckpointEvidencePath &&
    ['checkpoint_required', 'checkpoint_required_with_amendment'].includes(routingDecisionText)
  ) {
    writeRequirementsAuthoringTransaction({
      root,
      paths,
      entryMode,
      substate: 'checkpoint_persistence_required',
      sourcePath,
      intakePath,
      targetSourcePath: entryMode === 'intake_to_new_source' ? sourcePath : null,
      sourceStartHash: sourceHashBefore,
      draftHash: fs.existsSync(paths.draftSourcePreview) ? sha256File(paths.draftSourcePreview) : null,
      scaleRoutingDecision: routingDecisionText,
      nextRequiredAction: 'run_checkpoint_persistence',
    });
    const checkpoint = ensureCheckpointPersistenceForAuthoring({
      root,
      draftSourcePath: paths.draftSourcePreview,
      paths,
      routeDecision: routingDecision,
      recordId: identity.recordId,
      sourceDocumentHash: auditedPreviewSourceDocumentHash,
      implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
      createdAt,
    });
    if (checkpoint.ok) {
      postMaterializationScaleAssessment = runPreConfirmationScaleAssessment({
        root,
        sourcePath: paths.draftSourcePreview,
        paths,
        phase: 'post_materialization_assessment',
        checkpointPersistenceEvidencePath: paths.checkpointPersistenceEvidence,
      });
      routingDecision = postMaterializationScaleAssessment.routingDecision;
      routingDecisionText = normalizeText(routingDecision?.decision);
    } else {
      checkpointEvidenceIssues.push(...checkpoint.issues);
    }
  }
  const routingIssues = [...postMaterializationScaleAssessment.issues];
  routingIssues.push(...checkpointEvidenceIssues);
  checkpointEvidenceSatisfied =
    checkpointEvidenceIssues.length === 0 &&
    (Boolean(explicitCheckpointEvidencePath) || fs.existsSync(paths.checkpointPersistenceEvidence));
  if (
    ['checkpoint_required', 'checkpoint_required_with_amendment'].includes(routingDecisionText) &&
    !checkpointEvidenceSatisfied
  ) {
    routingIssues.push(
      preConfirmationIssue(
        'checkpoint_required_before_source_materialization',
        `Scale routing decision ${routingDecisionText} requires checkpoint persistence before source materialization.`,
        [toRootRelativePath(root, paths.scaleRoutingDecision)],
        'requirements_contract_authoring_scale_routing'
      )
    );
  } else if (routingDecisionText !== 'single_pass_final_allowed') {
    routingIssues.push(
      preConfirmationIssue(
        normalizeText(routingDecision?.blockingState) || 'scale_routing_decision_blocks_source_materialization',
        `Scale routing decision blocks source materialization: ${routingDecisionText}`,
        [toRootRelativePath(root, paths.scaleRoutingDecision)],
        'requirements_contract_authoring_scale_routing'
      )
    );
  }
  if (routingIssues.length > 0) {
    writeSourcePromotionBlockDecision({
      transaction: stagingTransaction,
      blockingStage: 'scale_routing_blocks_source_promotion',
      currentSourceHash: safeCurrentSourceDocumentHash(sourcePath),
      createdAt,
    });
    writeSourceMutationDecision({
      root,
      sourcePath,
      paths,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      createdAt,
      sourceHashBefore,
      issues: routingIssues,
      coverageDecision: 'pass',
      targetAuthorityDecision: 'pass',
      validationAuthorityDecision: 'pass',
      projectionSanityDecision: 'pass',
      auditEvidenceDecision: 'pass',
      scaleRoutingDecision: routingDecisionText || 'missing',
      reverseAuditDraftValidationDecision: 'pass',
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: routingIssues,
      mustGateReport,
      globalGateReport,
      sourceDocumentHash: sourceHashBefore,
      implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
      finalStandards: finalStandardsFromReports({
        packet: finalPacket,
        mustGateReport,
        globalGateReport,
        renderReport: null,
        missingSurfaceProbe: null,
        requirementRecord: null,
      }),
    });
  }

  const encodingGate = runEncodingIntegrityGate({ root, paths, targetPaths: [finalDraftSource] });
  if (encodingGate.issues.length > 0) {
    writeSourcePromotionBlockDecision({
      transaction: stagingTransaction,
      blockingStage: 'encoding_gate_blocks_source_promotion',
      currentSourceHash: safeCurrentSourceDocumentHash(sourcePath),
      createdAt,
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: encodingGate.issues,
      mustGateReport,
      globalGateReport,
      sourceDocumentHash: sourceHashBefore,
      implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
    });
  }
  const normalizedFinalDraftText = fs.readFileSync(finalDraftSource, 'utf8');
  const normalizedFinalDraftSemanticHash =
    semanticSourceDocumentHashForText(normalizedFinalDraftText);

  writeSourceMutationDecision({
    root,
    sourcePath,
    paths,
    recordId: identity.recordId,
    requirementSetId: identity.requirementSetId,
    createdAt,
    sourceDocumentExistedBefore: entryMode === 'existing_source',
    sourceHashBefore: promotionPreRawHash,
    sourceHashAfter: normalizedFinalDraft.draftHash,
    targetRawHashBefore: promotionPreRawHash,
    targetRawHashAfter: normalizedFinalDraft.draftHash,
    semanticSourceHashBefore: promotionPreSemanticHash,
    semanticSourceHashAfter: normalizedFinalDraftSemanticHash,
    issues: [],
    coverageDecision: 'pass',
    targetAuthorityDecision: 'pass',
    validationAuthorityDecision: 'pass',
    projectionSanityDecision: 'pass',
    auditEvidenceDecision: 'pass',
    scaleRoutingDecision: routingDecisionText,
    reverseAuditDraftValidationDecision: 'pass',
    sourceMutationPerformed: false,
  });
  writeRequirementsAuthoringTransaction({
    root,
    paths,
    entryMode,
    substate: 'source_mutation_decision_required',
    sourcePath,
    intakePath,
    targetSourcePath: entryMode === 'intake_to_new_source' ? sourcePath : null,
    sourceStartHash: sourceHashBefore,
    draftHash: normalizedFinalDraft.draftHash,
    scaleRoutingDecision: routingDecisionText,
    nextRequiredAction: 'promote_authoring_draft',
  });

  writeJsonUtf8(stagingTransaction.sourcePromotionDecision, {
    schemaVersion: 'requirements-contract-source-promotion-decision/v1',
    transactionId: stagingTransaction.transactionId,
    namespaceVersion: stagingTransaction.namespaceVersion,
    sourceStartHash: stagingTransaction.sourceStartHash,
    currentSourceHash: promotionPreSemanticHash,
    finalDecision: 'allow_source_promotion',
    criticalAuditorReceiptHashes: finalCriticalAuditorLoop.receipts.map((receipt) =>
      normalizeText(receipt.receiptHash)
    ),
    createdAt,
  });

  const promotion = promoteImplementationConfirmationDraftWithReceipt({
    root,
    sourcePath,
    paths,
    draftPath: finalDraftSource,
  });
  if (!promotion.ok) {
    writeSourcePromotionBlockDecision({
      transaction: stagingTransaction,
      blockingStage: 'requirements_contract_promotion_failed',
      currentSourceHash: safeCurrentSourceDocumentHash(sourcePath),
      createdAt,
    });
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: promotion.issues,
      mustGateReport,
      globalGateReport,
      sourceDocumentHash: sourceHashBefore,
      implementationConfirmationHash: auditedPreviewImplementationConfirmationHash,
      finalStandards: finalStandardsFromReports({
        packet: finalPacket,
        mustGateReport,
        globalGateReport,
        renderReport: null,
        missingSurfaceProbe: null,
        requirementRecord: null,
      }),
    });
  }

  const finalMaterialized = readMaterializedConfirmation(sourcePath);
  const promotionReceiptHash = fs.existsSync(paths.promotionReceipt)
    ? sha256File(paths.promotionReceipt)
    : null;
  writeRequirementsAuthoringTransaction({
    root,
    paths,
    entryMode,
    substate: 'promoted_not_confirmation_ready',
    sourcePath,
    intakePath,
    targetSourcePath: entryMode === 'intake_to_new_source' ? sourcePath : null,
    sourceStartHash: sourceHashBefore,
    draftHash: sha256File(sourcePath),
    scaleRoutingDecision: routingDecisionText,
    nextRequiredAction: language
      ? 'render_confirmation'
      : 'select_confirmation_language_then_render_confirmation',
  });
  const finalWrittenIdRanges = writtenIdRangesFromConfirmation(
    finalMaterialized.extraction.confirmation
  );

  if (!language) {
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'pre_render_ready',
      issues: [
        preConfirmationIssue(
          'language_required_before_render',
          'Confirmation language is required before rendering the confirmation HTML.',
          ['confirmationLanguage'],
          'render_confirmation'
        ),
      ],
      mustGateReport,
      globalGateReport,
      sourceDocumentHash: finalMaterialized.sourceDocumentHash,
      implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
      receiptPath: toRootRelativePath(root, paths.promotionReceipt),
      receiptHash: promotionReceiptHash,
      sourceMutationPerformed: true,
      updatedSourceSections: finalWrittenIdRanges,
      status: 'draft_updated_not_confirmation_ready',
      changedSections: finalWrittenIdRanges,
      currentBlockingReason: 'confirmation_language_not_selected',
      nextUserPrompt: '请选择确认页语言：中文 / English / 中英双语',
      nextRequiredAction: 'select_confirmation_language_then_render_confirmation',
      blockingNextAction: 'select_confirmation_language_then_render_confirmation',
      confirmationLanguage: null,
      finalStandards: finalStandardsFromReports({
        packet: finalPacket,
        mustGateReport,
        globalGateReport,
        renderReport: null,
        missingSurfaceProbe: null,
        requirementRecord: null,
      }),
    });
  }

  const rendererScript = resolveSkillScript(root, 'render-requirements-confirmation-html.ts');
  const render = runNodeJson(
    rendererScript,
    [
      '--source',
      sourcePath,
      '--out',
      paths.confirmationHtml,
      '--language',
      language,
      '--record-id',
      identity.recordId,
      '--entry-flow',
      'standalone_tasks',
      '--drilldown-gate-report',
      paths.preRenderMustGate,
      '--json',
    ],
    root
  );
  enhanceArtifactMetadata(paths.confirmationSummary, {
    schemaVersion: 'confirmation-summary/v1',
    recordId: identity.recordId,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    createdBy: 'render-requirements-confirmation-html',
    createdAt,
    inputRefs: [
      toRootRelativePath(root, sourcePath),
      toRootRelativePath(root, paths.preRenderMustGate),
    ],
  });
  const renderReport = enhanceArtifactMetadata(paths.confirmationRenderReport, {
    schemaVersion: 'confirmation-render-report/v1',
    recordId: identity.recordId,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    createdBy: 'render-requirements-confirmation-html',
    createdAt,
    inputRefs: [
      toRootRelativePath(root, sourcePath),
      toRootRelativePath(root, paths.preRenderMustGate),
      toRootRelativePath(root, paths.confirmationHtml),
    ],
  });
  if (!renderReport) {
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: [commandFailureIssue('confirmation_renderer_report_missing', rendererScript, render)],
      mustGateReport,
      globalGateReport,
      sourceDocumentHash: finalMaterialized.sourceDocumentHash,
      implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
      sourceMutationPerformed: true,
    });
  }
  const renderIssues = collectBlockingIssuesFromReports(renderReport);
  const substate =
    render.status === 0 &&
    renderReport?.confirmability === 'confirmable' &&
    renderIssues.length === 0
      ? 'user_confirmable'
      : 'blocked_by_render_gate';

  let missingSurfaceProbe: MainAgentPreConfirmationDrilldownResult | null = null;
  if (substate === 'user_confirmable') {
    const probeSource = path.join(paths.authoringDir, 'missing-surface-probe-source.md');
    fs.mkdirSync(path.dirname(probeSource), { recursive: true });
    fs.copyFileSync(sourcePath, probeSource);
    missingSurfaceProbe = runMainAgentPreConfirmationDrilldown(root, {
      source: probeSource,
      recordId: `${identity.recordId}-MISSING-SURFACE-PROBE`,
      requirementSetId: `${identity.requirementSetId}-MISSING-SURFACE-PROBE`,
      confirmationLanguage: language,
      targetPath: explicitTargetPaths,
      requiredCommand: explicitRequiredCommands,
      skipDrilldownArtifacts: true,
    });
  }

  writePreConfirmationRequirementRecord({
    root,
    sourcePath,
    recordId: identity.recordId,
    requirementSetId: identity.requirementSetId,
    paths,
    laneState: substate,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    confirmationPageHash: normalizeText(renderReport?.confirmationPageHash) || null,
    renderReportPath: paths.confirmationRenderReport,
    createdAt,
  });
  const requirementRecord = readJsonIfExists(paths.recordPath);

  return buildPreConfirmationResult({
    root,
    sourcePath,
    recordId: identity.recordId,
    requirementSetId: identity.requirementSetId,
    paths,
    substate,
    issues: renderIssues,
    renderReport,
    mustGateReport,
    globalGateReport,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    sourceMutationPerformed: true,
    finalStandards: finalStandardsFromReports({
      packet: finalPacket,
      mustGateReport,
      globalGateReport,
      renderReport,
      missingSurfaceProbe,
      requirementRecord,
    }),
  });
}

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readinessBaselineActivation(
  record: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!record) return null;
  const activation = recordObject(record.readinessBaselineActivation);
  return normalizeText(activation.activationId) ? activation : null;
}

function readinessBaselineMetadata(
  record: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!record) return null;
  const metadata = recordObject(record.readinessBaselineMetadata);
  return normalizeText(metadata.baselineId) ? metadata : null;
}

function currentArchitectureHashFromRecord(record: Record<string, unknown> | null): string {
  return normalizeText(
    recordObject(record?.architectureConfirmationState).currentArchitectureConfirmationHash
  );
}

function baselineMismatchFields(
  record: Record<string, unknown> | null,
  baseline: Record<string, unknown> | null
): string[] {
  if (!record || !baseline) return [];
  const checks: Array<[string, string, string]> = [
    [
      'sourceDocumentHash',
      normalizeText(record.sourceDocumentHash),
      normalizeText(baseline.sourceDocumentHash),
    ],
    [
      'implementationConfirmationHash',
      normalizeText(record.implementationConfirmationHash),
      normalizeText(baseline.implementationConfirmationHash),
    ],
    [
      'architectureConfirmationHash',
      currentArchitectureHashFromRecord(record),
      normalizeText(baseline.architectureConfirmationHash),
    ],
  ];
  return checks
    .filter(([, current, recorded]) => Boolean(recorded) && current !== recorded)
    .map(([field]) => field);
}

function buildDiagnostic(input: {
  category: string;
  sourceChecked: string[];
  repairAction: string;
  automaticRepairAvailable: boolean;
  nextCommand?: string | null;
  message: string;
}): MainAgentDiagnostic {
  return {
    category: input.category,
    authoritativeSource: 'requirement-record/control-store',
    sourceChecked: input.sourceChecked,
    repairAction: input.repairAction,
    automaticRepairAvailable: input.automaticRepairAvailable,
    nextCommand: input.nextCommand ?? null,
    message: input.message,
  };
}

function readinessDiagnostics(input: {
  root?: string;
  recordPath?: string | null;
  record: Record<string, unknown> | null;
  drift: MainAgentDriftSurface | null;
  pendingPacketStatus: MainAgentPendingPacketStatus;
}): MainAgentDiagnostic[] {
  const diagnostics: MainAgentDiagnostic[] = [];
  const activation = readinessBaselineActivation(input.record);
  const metadata = readinessBaselineMetadata(input.record);
  const activationStatus = normalizeText(activation?.status);
  const metadataStatus = normalizeText(metadata?.status);
  const mismatchFields = baselineMismatchFields(input.record, metadata);
  if (mismatchFields.length > 0) {
    diagnostics.push(
      buildDiagnostic({
        category: 'blocked_stale_readiness_baseline',
        sourceChecked: [
          input.recordPath ?? 'requirement-record',
          'readinessBaselineMetadata',
          ...mismatchFields,
        ],
        repairAction: 'rerun_controlled_readiness_audit',
        automaticRepairAvailable: Boolean(input.root && input.recordPath),
        message: `Readiness baseline is stale: ${mismatchFields.join(', ')}`,
      })
    );
  }
  if (activationStatus === 'audit_required') {
    diagnostics.push(
      buildDiagnostic({
        category: 'repairable_readiness_audit_required',
        sourceChecked: [input.recordPath ?? 'requirement-record', 'readinessBaselineActivation'],
        repairAction: 'trigger_controlled_readiness_audit',
        automaticRepairAvailable: Boolean(input.root && input.recordPath),
        message:
          'Implementation readiness gate passed; controlled readiness audit must write the scoring baseline.',
      })
    );
  }
  if (
    input.drift?.effectiveVerdict === 'blocked_pending_rereadiness' &&
    metadataStatus !== 'current'
  ) {
    diagnostics.push(
      buildDiagnostic({
        category: 'missing_readiness_baseline',
        sourceChecked: [
          input.recordPath ?? 'requirement-record',
          'readinessBaselineMetadata',
          '_bmad-output/scoring',
        ],
        repairAction:
          activationStatus === 'audit_required'
            ? 'trigger_controlled_readiness_audit'
            : 'run_implementation_readiness_gate_then_controlled_audit',
        automaticRepairAvailable:
          activationStatus === 'audit_required' && Boolean(input.root && input.recordPath),
        message:
          input.drift.blockingReason ??
          'Missing implementation readiness baseline; controlled audit/scoring bridge is required.',
      })
    );
  }
  if (input.pendingPacketStatus === 'none' && isRequirementRecordClosed(input.record)) {
    diagnostics.push(
      buildDiagnostic({
        category: 'completed_no_dispatch',
        sourceChecked: [
          input.recordPath ?? 'requirement-record',
          'closeout',
          'orchestration-state',
        ],
        repairAction: 'none',
        automaticRepairAvailable: false,
        nextCommand: null,
        message: 'Closeout pass is terminal; no pending packet is expected.',
      })
    );
    if (activationStatus === 'audit_required' || metadataStatus !== 'current') {
      diagnostics.push(
        buildDiagnostic({
          category: 'dashboard_bridge_pending',
          sourceChecked: [input.recordPath ?? 'requirement-record', 'readinessBaselineMetadata'],
          repairAction: 'trigger_controlled_readiness_audit_for_dashboard_bridge',
          automaticRepairAvailable: Boolean(input.root && input.recordPath),
          message:
            'Legacy/dashboard readiness score bridge is pending but does not block completed closeout.',
        })
      );
    }
  }
  return diagnostics;
}

function deriveDriftSurface(
  projectRoot: string | undefined,
  closeout: ReviewerLatestCloseoutRecord | null,
  requirementRecord: Record<string, unknown> | null = null
): MainAgentDriftSurface | null {
  if (
    closeout &&
    (closeout.driftSignals ||
      closeout.driftedDimensions ||
      closeout.driftSeverity ||
      closeout.blockingReason ||
      closeout.effectiveVerdict ||
      closeout.reReadinessRequired !== undefined)
  ) {
    return {
      driftSignals: closeout.driftSignals ?? [],
      driftedDimensions: closeout.driftedDimensions ?? [],
      driftSeverity: closeout.driftSeverity ?? null,
      blockingReason: closeout.blockingReason ?? null,
      effectiveVerdict: closeout.effectiveVerdict ?? null,
      reReadinessRequired: closeout.reReadinessRequired ?? false,
      readinessBaselineRunId: closeout.readinessBaselineRunId ?? null,
      baselineSource: 'reviewer_closeout',
    };
  }

  const metadata = readinessBaselineMetadata(requirementRecord);
  const mismatchFields = baselineMismatchFields(requirementRecord, metadata);
  if (metadata && normalizeText(metadata.status) === 'current' && mismatchFields.length === 0) {
    return {
      driftSignals: [],
      driftedDimensions: [],
      driftSeverity: 'none',
      blockingReason: null,
      effectiveVerdict: 'approved',
      reReadinessRequired: false,
      readinessBaselineRunId: normalizeText(metadata.scoringRunId) || null,
      baselineSource: 'requirement_metadata',
    };
  }

  if (isRequirementRecordClosed(requirementRecord)) {
    return {
      driftSignals: [],
      driftedDimensions: [],
      driftSeverity: 'none',
      blockingReason: null,
      effectiveVerdict: 'approved',
      reReadinessRequired: false,
      readinessBaselineRunId: null,
      baselineSource: 'completed_requirement_no_dispatch',
    };
  }
  if (metadata && mismatchFields.length > 0) {
    return {
      driftSignals: mismatchFields,
      driftedDimensions: [],
      driftSeverity: 'major',
      blockingReason: `Stale implementation readiness baseline: ${mismatchFields.join(', ')}`,
      effectiveVerdict: 'blocked_pending_rereadiness',
      reReadinessRequired: true,
      readinessBaselineRunId: normalizeText(metadata.scoringRunId) || null,
      baselineSource: 'stale_requirement_metadata',
    };
  }

  const scopedRecords = Array.isArray(requirementRecord?.readinessScoringRecords)
    ? (requirementRecord.readinessScoringRecords as unknown[]).filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
  const latestScoped = scopedRecords
    .filter((item) => normalizeText(item.stage) === 'implementation_readiness')
    .at(-1);
  if (latestScoped) {
    return {
      driftSignals: [],
      driftedDimensions: [],
      driftSeverity: 'none',
      blockingReason: null,
      effectiveVerdict: 'approved',
      reReadinessRequired: false,
      readinessBaselineRunId: normalizeText(latestScoped.scoringRunId) || null,
      baselineSource: 'requirement_scoped_scoring',
    };
  }

  if (!projectRoot) {
    return null;
  }

  try {
    const records = loadAndDedupeRecords(resolveRuntimeScoringDataPath({ root: projectRoot }));
    const projection = buildReadinessDriftProjection({ allRecords: records });
    if (
      projection.drift_signals.length === 0 &&
      projection.drifted_dimensions.length === 0 &&
      projection.drift_severity === 'none' &&
      projection.effective_verdict === 'unknown'
    ) {
      return null;
    }
    return {
      driftSignals: projection.drift_signals,
      driftedDimensions: projection.drifted_dimensions,
      driftSeverity: projection.drift_severity,
      blockingReason: projection.blocking_reason,
      effectiveVerdict: projection.effective_verdict,
      reReadinessRequired: projection.re_readiness_required,
      readinessBaselineRunId: projection.readiness_baseline_run_id,
      baselineSource: projection.readiness_baseline_run_id ? 'legacy_scoring_data' : null,
    };
  } catch {
    return null;
  }
}

function resolveImplementationEntryGateFromRegistry(
  projectRoot: string | undefined,
  runtimeContext: Partial<RuntimeContextFile> | null,
  flow: RuntimeFlowId
): ImplementationEntryGate | null {
  if (!projectRoot || (flow !== 'story' && flow !== 'bugfix' && flow !== 'standalone_tasks')) {
    return null;
  }
  const resolvedGate = (
    runtimeContext as { implementationEntryGate?: ImplementationEntryGate } | null
  )?.implementationEntryGate;
  if (resolvedGate) {
    return resolvedGate;
  }

  let registry;
  try {
    registry = readRuntimeContextRegistry(projectRoot);
  } catch {
    return null;
  }
  const flowIndex = registry.implementationEntryIndex?.[flow] ?? {};
  const candidates = new Set<string>();
  const addCandidate = (value: string | null | undefined) => {
    const normalized = normalizeText(value);
    if (normalized) {
      candidates.add(path.normalize(normalized).replace(/\\/g, '/'));
    }
  };
  const artifactPath = normalizeText(runtimeContext?.artifactPath);
  const artifactRoot = normalizeText(runtimeContext?.artifactRoot);
  const runId = normalizeText(runtimeContext?.runId);
  const storyId = normalizeText(runtimeContext?.storyId);
  addCandidate(runId);
  addCandidate(artifactPath);
  addCandidate(artifactRoot);
  addCandidate(storyId);
  if (flow === 'story') {
    try {
      candidates.add(
        buildImplementationEntryIndexKey({
          flow,
          runId,
          artifactRoot,
          storyId,
        })
      );
    } catch {
      // Candidate inputs are intentionally best-effort.
    }
  } else {
    for (const artifactDocPath of [artifactPath, artifactRoot]) {
      try {
        candidates.add(
          buildImplementationEntryIndexKey({
            flow,
            runId,
            artifactDocPath,
          })
        );
      } catch {
        // Candidate inputs are intentionally best-effort.
      }
    }
  }
  for (const key of candidates) {
    const gate = flowIndex[key];
    if (gate) {
      return gate;
    }
  }
  return null;
}

function deriveContinueDecisionFromSurface(input: {
  closeout: ReviewerLatestCloseoutRecord | null;
  state: OrchestrationState | null;
  latestGateDecision: 'pass' | 'auto_repairable_block' | 'true_blocker' | 'reroute' | null;
  fourSignalStatus: 'pass' | 'warn' | 'block';
}): { canContinue: boolean | null; continueDecision: MainAgentContinueDecision } {
  const closeout = input.closeout;
  const state = input.state;
  const latestGateDecision = input.latestGateDecision;

  if (closeout) {
    const closeoutGateDecision =
      latestGateDecision ?? (closeout.closeoutApproved ? 'pass' : 'true_blocker');
    return {
      canContinue: canMainAgentContinue({
        latestGateDecision: closeoutGateDecision,
        fourSignalStatus: input.fourSignalStatus,
        closeoutApproved: closeout.closeoutApproved,
        scoreWriteResult: closeout.scoreWriteResult,
        handoffPersisted: closeout.handoffPersisted ?? false,
        circuitOpen: state?.gatesLoop?.circuitOpen ?? false,
      }),
      continueDecision:
        closeout.canMainAgentContinue === true
          ? 'continue'
          : closeout.closeoutEnvelope?.rerunDecision &&
              closeout.closeoutEnvelope.rerunDecision !== 'none'
            ? 'rerun'
            : 'blocked',
    };
  }

  if (state?.gatesLoop?.circuitOpen) {
    return { canContinue: false, continueDecision: 'blocked' };
  }
  if (input.fourSignalStatus === 'block') {
    return { canContinue: false, continueDecision: 'blocked' };
  }
  if (latestGateDecision === 'auto_repairable_block') {
    return { canContinue: false, continueDecision: 'rerun' };
  }
  if (latestGateDecision === 'reroute' || latestGateDecision === 'true_blocker') {
    return { canContinue: false, continueDecision: 'blocked' };
  }
  return { canContinue: null, continueDecision: null };
}

function latestRecordsById(records: unknown, idField: string): Record<string, unknown>[] {
  const latest = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(records)) {
    return [];
  }
  for (const item of records) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = normalizeText(record[idField]);
    if (id) {
      latest.set(id, record);
    }
  }
  return [...latest.values()];
}

function hasOpenRerunLoop(record: Record<string, unknown> | null): boolean {
  return latestRecordsById(record?.rerunLoops, 'rerunLoopId').some((loop) =>
    ['open', 'in_progress', 'no_progress', 'blocked'].includes(normalizeText(loop.status))
  );
}

function gateIdentity(gate: Record<string, unknown>, index: number): string {
  return (
    [normalizeText(gate.gate), normalizeText(gate.traceId), normalizeText(gate.requirementId)]
      .filter(Boolean)
      .join(':') ||
    normalizeText(gate.checkId) ||
    normalizeText(gate.gateCheckId) ||
    normalizeText(gate.id) ||
    `gate-${index}`
  );
}

function latestGateChecks(records: unknown): Record<string, unknown>[] {
  const latest = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(records)) {
    return [];
  }
  records.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return;
    }
    const gate = item as Record<string, unknown>;
    latest.set(gateIdentity(gate, index), gate);
  });
  return [...latest.values()];
}

function isRequirementRecordClosed(record: Record<string, unknown> | null): boolean {
  if (!record) {
    return false;
  }
  const closeout =
    record.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
      ? (record.closeout as Record<string, unknown>)
      : null;
  return normalizeText(closeout?.decision) === 'pass';
}

function architectureConfirmationRequiredForRecord(
  record: Record<string, unknown> | null
): boolean {
  if (!record) return false;
  if (record.architectureConfirmationRequired === true) return true;
  if (
    Array.isArray(record.architectureConfirmations) &&
    record.architectureConfirmations.length > 0
  )
    return true;
  if (
    Array.isArray(record.architectureConfirmationStateChecks) &&
    record.architectureConfirmationStateChecks.length > 0
  ) {
    return true;
  }
  const state = record.architectureConfirmationState;
  return Boolean(state && typeof state === 'object' && !Array.isArray(state));
}

function isRuntimeRegistryBridgeRecord(record: Record<string, unknown> | null): boolean {
  return Boolean(record?.runtimeRegistryBridge);
}

function recordHasImplementationEntryGate(record: Record<string, unknown> | null): boolean {
  return Boolean(
    record?.implementationEntryGate &&
    typeof record.implementationEntryGate === 'object' &&
    !Array.isArray(record.implementationEntryGate)
  );
}

function readPreConfirmationLaneStateFromRecord(
  record: Record<string, unknown> | null
): PreConfirmationDrilldownLaneState | null {
  if (!record) {
    return null;
  }
  const lane =
    record.preConfirmationDrilldownLane &&
    typeof record.preConfirmationDrilldownLane === 'object' &&
    !Array.isArray(record.preConfirmationDrilldownLane)
      ? (record.preConfirmationDrilldownLane as Record<string, unknown>)
      : null;
  if (!lane) {
    return null;
  }
  const substate = normalizeText(lane.substate) as PreConfirmationDrilldownSubstate;
  const confirmationHistory = Array.isArray(record.confirmationHistory)
    ? record.confirmationHistory.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
  const hasControlledConfirmationEvent = confirmationHistory.some(
    (event) =>
      normalizeText(event.eventType) === 'confirmation_recorded' &&
      (!normalizeText(record.sourceDocumentHash) ||
        normalizeText(event.sourceDocumentHash) === normalizeText(record.sourceDocumentHash)) &&
      (!normalizeText(record.implementationConfirmationHash) ||
        normalizeText(event.implementationConfirmationHash) ===
          normalizeText(record.implementationConfirmationHash))
  );
  const userConfirmed =
    normalizeText(record.status) === 'user_confirmed' && hasControlledConfirmationEvent;
  const effectiveSubstate: PreConfirmationDrilldownSubstate = userConfirmed
    ? 'user_confirmed'
    : substate || 'idle';
  return {
    currentMentalModel: 'requirement_confirmation',
    lane: 'pre_confirmation_drilldown',
    substate: effectiveSubstate,
    currentSubstate: effectiveSubstate,
    nextAction: userConfirmed
      ? 'enter_architecture_confirmation'
      : effectiveSubstate === 'user_confirmable'
        ? 'await_exact_confirmation_phrase_with_hashes'
        : 'run_pre_confirmation_drilldown',
    nextMentalModel: userConfirmed ? 'architecture_confirmation' : null,
    userConfirmable: effectiveSubstate === 'user_confirmable',
    controlledIngestRequiredBeforeProgression: !userConfirmed,
    artifacts: {},
    blockingIssues: [],
  };
}

function deriveNextActionFromRequirementRecord(input: {
  stage: string;
  record: Record<string, unknown> | null;
  state: OrchestrationState | null;
  pendingPacketStatus: MainAgentPendingPacketStatus;
  pendingPacket: RecommendationPacket | ExecutionPacket | ResumePacket | null;
  implementationEntryDecision: ImplementationEntryDecision | null | undefined;
  continueDecision: MainAgentContinueDecision;
}): {
  nextAction: string | null;
  ready: boolean;
  blockingReasonRefs: Array<{ sourceType: string; id: string }>;
  terminalState?: 'completed_no_dispatch';
} {
  const recordId = normalizeText(input.record?.recordId) || 'requirement-record';
  const currentMentalModel = normalizeText(input.record?.currentMentalModel);
  const sixModelResults =
    input.record?.sixModelResults &&
    typeof input.record.sixModelResults === 'object' &&
    !Array.isArray(input.record.sixModelResults)
      ? (input.record.sixModelResults as Record<string, unknown>)
      : null;
  const currentModelResult =
    currentMentalModel &&
    sixModelResults?.[currentMentalModel] &&
    typeof sixModelResults[currentMentalModel] === 'object' &&
    !Array.isArray(sixModelResults[currentMentalModel])
      ? (sixModelResults[currentMentalModel] as Record<string, unknown>)
      : null;
  const architectureState =
    input.record?.architectureConfirmationState &&
    typeof input.record.architectureConfirmationState === 'object' &&
    !Array.isArray(input.record.architectureConfirmationState)
      ? (input.record.architectureConfirmationState as Record<string, unknown>)
      : null;
  const openRerun = hasOpenRerunLoop(input.record);
  const hasBlockingGate = latestGateChecks(input.record?.gateChecks).some((gate) =>
    ['fail', 'blocked'].includes(normalizeText(gate.decision))
  );
  const blockingReasonRefs: Array<{ sourceType: string; id: string }> = [];
  if (hasOpenReconfirmationRequest(input.record)) {
    blockingReasonRefs.push(...buildOpenReconfirmationBlockingReasonRefs(input.record));
    return {
      nextAction: 'run_pre_confirmation_drilldown',
      ready: false,
      blockingReasonRefs,
    };
  }
  const preConfirmationLane = readPreConfirmationLaneStateFromRecord(input.record);
  if (!input.record || normalizeText(input.record.status) !== 'user_confirmed') {
    blockingReasonRefs.push({
      sourceType:
        preConfirmationLane?.substate === 'user_confirmable'
          ? 'pre_confirmation_drilldown'
          : 'requirement_record',
      id: recordId,
    });
  }
  if (
    architectureConfirmationRequiredForRecord(input.record) &&
    normalizeText(architectureState?.status) !== 'active'
  ) {
    blockingReasonRefs.push({
      sourceType: 'architecture_confirmation',
      id: normalizeText(architectureState?.currentArchitectureConfirmationHash) || recordId,
    });
  }
  if (isRequirementRecordClosed(input.record)) {
    return {
      nextAction: null,
      ready: false,
      blockingReasonRefs,
      terminalState: 'completed_no_dispatch',
    };
  }
  if (currentMentalModel === 'requirement_confirmation') {
    if (normalizeText(currentModelResult?.status) === 'pass') {
      return {
        nextAction: 'enter_architecture_confirmation',
        ready: true,
        blockingReasonRefs,
      };
    }
    blockingReasonRefs.push({ sourceType: 'model_result', id: 'requirement_confirmation' });
    return { nextAction: 'run_pre_confirmation_drilldown', ready: false, blockingReasonRefs };
  }
  if (currentMentalModel === 'architecture_confirmation') {
    if (normalizeText(currentModelResult?.status) === 'pass') {
      return {
        nextAction: 'run_implementation_readiness_gate',
        ready: true,
        blockingReasonRefs,
      };
    }
    blockingReasonRefs.push({ sourceType: 'model_result', id: 'architecture_confirmation' });
    return { nextAction: 'prepare_architecture_confirmation', ready: false, blockingReasonRefs };
  }
  if (currentMentalModel === 'implementation_readiness') {
    const implementationReadinessStatus = normalizeText(currentModelResult?.status);
    if (implementationReadinessStatus !== 'pass') {
      blockingReasonRefs.push({ sourceType: 'model_result', id: 'implementation_readiness' });
      if (['blocked', 'fail'].includes(implementationReadinessStatus)) {
        return { nextAction: 'dispatch_remediation', ready: true, blockingReasonRefs };
      }
      return { nextAction: 'run_implementation_readiness_gate', ready: false, blockingReasonRefs };
    }
  } else if (currentMentalModel === 'execution_closure') {
    const executionClosureStatus = normalizeText(currentModelResult?.status);
    if (executionClosureStatus === 'pass') {
      return { nextAction: 'dispatch_review', ready: true, blockingReasonRefs };
    }
    if (['blocked', 'fail'].includes(executionClosureStatus)) {
      blockingReasonRefs.push({ sourceType: 'model_result', id: 'execution_closure' });
      return { nextAction: 'dispatch_remediation', ready: true, blockingReasonRefs };
    }
    blockingReasonRefs.push({ sourceType: 'model_result', id: 'execution_closure' });
    return { nextAction: 'dispatch_implement', ready: true, blockingReasonRefs };
  } else if (currentMentalModel === 'audit_review') {
    const auditReviewStatus = normalizeText(currentModelResult?.status);
    const executionClosureStatus = modelStatusFor(input.record, 'execution_closure');
    if (auditReviewStatus === 'pass' && executionClosureStatus === 'pass') {
      return { nextAction: 'run_closeout', ready: true, blockingReasonRefs };
    }
    if (['blocked', 'fail'].includes(auditReviewStatus)) {
      blockingReasonRefs.push({ sourceType: 'model_result', id: 'audit_review' });
      return { nextAction: 'dispatch_remediation', ready: true, blockingReasonRefs };
    }
    blockingReasonRefs.push({ sourceType: 'model_result', id: 'audit_review' });
    return { nextAction: 'dispatch_review', ready: true, blockingReasonRefs };
  } else if (currentMentalModel) {
    blockingReasonRefs.push({ sourceType: 'model_result', id: currentMentalModel });
    return { nextAction: 'await_user', ready: false, blockingReasonRefs };
  }
  if (input.implementationEntryDecision === 'reroute') {
    blockingReasonRefs.push({ sourceType: 'gate_check', id: 'implementation-readiness' });
    return { nextAction: 'await_user', ready: false, blockingReasonRefs };
  }
  if (input.implementationEntryDecision === 'block' || openRerun || hasBlockingGate) {
    blockingReasonRefs.push({ sourceType: 'gate_check', id: 'implementation-readiness' });
    return {
      nextAction: 'dispatch_remediation',
      ready: blockingReasonRefs.length === 1,
      blockingReasonRefs,
    };
  }
  if (input.continueDecision === 'rerun') {
    blockingReasonRefs.push({ sourceType: 'rerun_loop', id: 'latest-open-rerun' });
    return { nextAction: 'dispatch_remediation', ready: true, blockingReasonRefs };
  }
  if (input.continueDecision === 'blocked') {
    blockingReasonRefs.push({ sourceType: 'gate_check', id: 'delivery-closeout' });
    return { nextAction: 'await_user', ready: false, blockingReasonRefs };
  }
  if (blockingReasonRefs.length > 0) {
    return { nextAction: 'await_user', ready: false, blockingReasonRefs };
  }
  const executionClosurePass = modelStatusFor(input.record, 'execution_closure') === 'pass';
  const auditReviewPass = modelStatusFor(input.record, 'audit_review') === 'pass';
  const hasCurrentCompiledPromptRef = packetHasCurrentHashCompiledPromptRef(
    input.pendingPacket,
    input.record
  );
  const requirementNextAction = !executionClosurePass
    ? 'dispatch_implement'
    : !auditReviewPass
      ? 'dispatch_review'
      : 'run_closeout';
  if (!executionClosurePass) {
    if (!hasCurrentCompiledPromptRef) {
      blockingReasonRefs.push({
        sourceType: 'compiled_prompt_ref',
        id: 'missing_current_hash_compiledPromptRef',
      });
    }
    return {
      nextAction: requirementNextAction,
      ready: true,
      blockingReasonRefs,
    };
  }
  if (!auditReviewPass) {
    return {
      nextAction: requirementNextAction,
      ready: true,
      blockingReasonRefs,
    };
  }
  const requirementTaskType = taskTypeFromNextAction(requirementNextAction);
  const stateNextAction = input.state?.nextAction ?? null;
  const stateTaskType = taskTypeFromNextAction(stateNextAction);
  const lastTaskReportStatus = input.state?.lastTaskReport?.status ?? null;
  const canReuseStateTransition =
    stateNextAction === requirementNextAction ||
    (lastTaskReportStatus === 'partial' && stateNextAction === 'dispatch_remediation') ||
    (lastTaskReportStatus === 'blocked' &&
      (stateNextAction === 'dispatch_implement' ||
        stateNextAction === 'dispatch_remediation' ||
        stateNextAction === 'rerun_gate'));
  if (
    input.state &&
    input.state.pendingPacket?.packetKind !== 'recommendation' &&
    input.pendingPacketStatus !== 'none' &&
    input.pendingPacketStatus !== 'completed' &&
    input.pendingPacketStatus !== 'invalidated' &&
    canReuseStateTransition &&
    packetTaskType(input.pendingPacket) ===
      (stateNextAction === requirementNextAction ? requirementTaskType : stateTaskType)
  ) {
    return {
      nextAction:
        stateNextAction === requirementNextAction ? requirementNextAction : stateNextAction,
      ready: input.pendingPacketStatus === 'ready_for_main_agent',
      blockingReasonRefs,
    };
  }
  if (
    input.state &&
    (input.pendingPacketStatus === 'completed' || input.pendingPacketStatus === 'invalidated') &&
    input.state.lastTaskReport
  ) {
    if (input.state.lastTaskReport.status !== 'done') {
      return {
        nextAction: requirementNextAction,
        ready: true,
        blockingReasonRefs,
      };
    }
    return {
      nextAction:
        input.state.nextAction === requirementNextAction
          ? input.state.nextAction
          : requirementNextAction,
      ready: true,
      blockingReasonRefs,
    };
  }
  return {
    nextAction: requirementNextAction,
    ready: true,
    blockingReasonRefs,
  };
}

function normalizeBlockingReasonRefs(value: unknown): Array<{ sourceType: string; id: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { sourceType: string; id: string } => {
      return (
        item != null &&
        typeof item === 'object' &&
        typeof (item as { sourceType?: unknown }).sourceType === 'string' &&
        typeof (item as { id?: unknown }).id === 'string'
      );
    })
    .map((item) => ({ sourceType: item.sourceType, id: item.id }));
}

function deriveNextActionFromSurface(input: {
  stage: string;
  state: OrchestrationState | null;
  pendingPacketStatus: MainAgentPendingPacketStatus;
  continueDecision: MainAgentContinueDecision;
  implementationEntryDecision: ImplementationEntryDecision | null | undefined;
}): { nextAction: string | null; ready: boolean | null; source: MainAgentOrchestrationSource } {
  if (input.state?.gatesLoop?.circuitOpen) {
    return { nextAction: 'await_user', ready: false, source: 'orchestration_state' };
  }

  if (
    input.state &&
    input.pendingPacketStatus !== 'none' &&
    input.pendingPacketStatus !== 'completed' &&
    input.pendingPacketStatus !== 'invalidated'
  ) {
    return {
      nextAction: input.state.nextAction,
      ready: input.pendingPacketStatus === 'ready_for_main_agent',
      source: 'orchestration_state',
    };
  }

  if (
    input.state &&
    (input.pendingPacketStatus === 'completed' || input.pendingPacketStatus === 'invalidated') &&
    input.state.lastTaskReport
  ) {
    return {
      nextAction: input.state.nextAction,
      ready: input.state.nextAction !== 'await_user' && input.state.nextAction !== 'blocked',
      source: 'orchestration_state',
    };
  }

  if (input.implementationEntryDecision === 'reroute') {
    return { nextAction: 'await_user', ready: false, source: 'implementation_entry_gate' };
  }

  if (input.implementationEntryDecision === 'block') {
    return { nextAction: 'dispatch_remediation', ready: true, source: 'implementation_entry_gate' };
  }

  if (input.continueDecision === 'rerun') {
    return { nextAction: 'dispatch_remediation', ready: true, source: 'reviewer_closeout' };
  }

  if (input.continueDecision === 'blocked') {
    return { nextAction: 'await_user', ready: false, source: 'reviewer_closeout' };
  }

  if (input.continueDecision === 'continue') {
    return {
      nextAction: input.stage === 'post_audit' ? 'run_closeout' : 'dispatch_implement',
      ready: true,
      source: 'reviewer_closeout',
    };
  }

  if (input.stage === 'post_audit') {
    return { nextAction: 'run_closeout', ready: true, source: 'implementation_entry_gate' };
  }

  return { nextAction: 'dispatch_implement', ready: true, source: 'implementation_entry_gate' };
}

function inferLatestGateFromState(state: OrchestrationState | null): {
  gateId: string;
  decision: 'pass' | 'auto_repairable_block' | 'true_blocker' | 'reroute';
  reason: string;
} | null {
  if (!state) {
    return null;
  }
  if (state.nextAction === 'dispatch_remediation') {
    return {
      gateId: 'implementation-readiness',
      decision: 'auto_repairable_block',
      reason: 'orchestration state requires remediation before the main flow can continue',
    };
  }
  if (state.nextAction === 'await_user' || state.nextAction === 'blocked') {
    return {
      gateId: 'implementation-readiness',
      decision: 'true_blocker',
      reason: 'orchestration state currently blocks continuation',
    };
  }
  if (
    state.nextAction === 'dispatch_implement' ||
    state.nextAction === 'dispatch_review' ||
    state.nextAction === 'run_closeout'
  ) {
    return {
      gateId: 'implementation-readiness',
      decision: 'pass',
      reason: 'orchestration state indicates the main flow may continue',
    };
  }
  return null;
}

export function resolveMainAgentOrchestrationSurface(
  input: ResolveMainAgentOrchestrationInput
): MainAgentOrchestrationSurface {
  const runtimeContext = loadRuntimeContextForMainAgent(input);
  const requirementRecord = readRequirementRecordFromRuntimeContext(runtimeContext);
  const recordPath = runtimeRecordPath(runtimeContext);
  const closeout = runtimeContext?.latestReviewerCloseout ?? null;
  const explicitImplementationEntryGateProvided = input.implementationEntryGate !== undefined;
  const runtimeRegistryBridgeRecord = isRuntimeRegistryBridgeRecord(requirementRecord);
  const runtimeContextImplementationEntryGate = resolveImplementationEntryGateFromRegistry(
    input.projectRoot,
    runtimeContext,
    input.flow
  );
  const implementationEntryGate = explicitImplementationEntryGateProvided
    ? input.implementationEntryGate
    : runtimeContextImplementationEntryGate;
  const scopedState = input.projectRoot
    ? resolveScopedOrchestrationState(input.projectRoot, runtimeContext)
    : { sessionId: null, statePath: null, state: null };
  if (!requirementRecord && !scopedState.state && !implementationEntryGate) {
    return buildNoActiveRequirementSurface();
  }
  const pendingPacket = readPendingPacketPayload(scopedState.state);
  const pendingPacketStatus = normalizePendingPacketStatus(scopedState.state, pendingPacket);
  const fourSignal = scopedState.state?.fourSignal ?? null;
  const inferredLatestGate = inferLatestGateFromState(scopedState.state);
  const displayLatestGateDecision =
    scopedState.state?.latestGate?.decision ??
    inferredLatestGate?.decision ??
    mapImplementationEntryDecision(implementationEntryGate) ??
    null;
  const bridgeRecordWithoutControlledGate = runtimeRegistryBridgeRecord && !implementationEntryGate;
  const controlLatestGateDecision =
    requirementRecord && !bridgeRecordWithoutControlledGate
      ? mapImplementationEntryDecision(implementationEntryGate)
      : displayLatestGateDecision;
  const latestGate =
    scopedState.state?.latestGate ??
    inferredLatestGate ??
    (implementationEntryGate
      ? {
          gateId: implementationEntryGate.gateName,
          decision: displayLatestGateDecision ?? 'true_blocker',
          reason: implementationEntryGate.blockerSummary.join('; '),
        }
      : null);
  const continueState = deriveContinueDecisionFromSurface({
    closeout,
    state: scopedState.state,
    latestGateDecision: controlLatestGateDecision,
    fourSignalStatus: fourSignal?.latestStatus ?? 'pass',
  });
  const useRequirementRecordProjection =
    Boolean(requirementRecord) &&
    !(explicitImplementationEntryGateProvided && runtimeRegistryBridgeRecord);
  const preConfirmationDrilldownLane = readPreConfirmationLaneStateFromRecord(requirementRecord);
  const action = useRequirementRecordProjection
    ? {
        ...deriveNextActionFromRequirementRecord({
          stage: input.stage,
          record: requirementRecord,
          state: scopedState.state,
          pendingPacketStatus,
          pendingPacket,
          implementationEntryDecision: implementationEntryGate?.decision ?? null,
          continueDecision: continueState.continueDecision,
        }),
        source: 'requirement_record' as const,
      }
    : deriveNextActionFromSurface({
        stage: input.stage,
        state: scopedState.state,
        pendingPacketStatus,
        continueDecision: continueState.continueDecision,
        implementationEntryDecision: implementationEntryGate?.decision ?? null,
      });
  const matrixAttemptId =
    scopedState.state?.pendingPacket?.packetId ??
    normalizeText(runtimeContext?.runId) ??
    normalizeText(requirementRecord?.requirementSetId) ??
    'inspect';
  const sixModelRuntimeDecision = useRequirementRecordProjection
    ? resolveSixModelRuntimeDecision({
        record: requirementRecord,
        attemptId: matrixAttemptId,
        pendingPacketId: scopedState.state?.pendingPacket?.packetId ?? null,
        pendingPacketTaskType: packetTaskType(pendingPacket),
        pendingPacketKind: scopedState.state?.pendingPacket?.packetKind ?? null,
        lastTaskReportPacketId: scopedState.state?.lastTaskReport?.packetId ?? null,
        lastTaskReportStatus: scopedState.state?.lastTaskReport?.status ?? null,
      })
    : null;
  const sixModelRuntimeDecisionPath =
    input.projectRoot && sixModelRuntimeDecision
      ? writeSixModelRuntimeDecision({
          projectRoot: input.projectRoot,
          decision: sixModelRuntimeDecision,
        })
      : null;
  const implementationEntryDecision = implementationEntryGate?.decision ?? null;
  const controlPlaneBlocksSixModelOverride =
    continueState.continueDecision === 'blocked' ||
    continueState.continueDecision === 'rerun' ||
    hasOpenRerunLoop(requirementRecord) ||
    implementationEntryDecision === 'block' ||
    implementationEntryDecision === 'reroute';
  const bridgePendingPacketRemainsAuthoritative =
    runtimeRegistryBridgeRecord &&
    pendingPacketStatus !== 'none' &&
    pendingPacketStatus !== 'missing_packet_file' &&
    pendingPacketStatus !== 'completed' &&
    pendingPacketStatus !== 'invalidated' &&
    pendingPacketMatchesAction({
      nextAction: scopedState.state?.nextAction ?? null,
      pendingPacket,
      state: scopedState.state,
    });
  const bridgeImplementDispatchFallback =
    bridgeRecordWithoutControlledGate &&
    input.stage === 'implement' &&
    action.nextAction === 'run_implementation_readiness_gate';
  const stateOnlyControlledRemediation =
    !requirementRecord && Boolean(scopedState.state) && action.source === 'orchestration_state';
  const bridgeCompletedRemediationReturnsToImplement =
    (runtimeRegistryBridgeRecord || stateOnlyControlledRemediation) &&
    bridgeCompletedRemediationState({
      pendingPacketStatus,
      pendingPacket,
      state: scopedState.state,
    });
  const sixModelRuntimeDecisionAuthoritative =
    Boolean(sixModelRuntimeDecision?.currentMentalModel) &&
    sixModelRuntimeDecision?.nextAction !== 'record_closed' &&
    !controlPlaneBlocksSixModelOverride &&
    !bridgePendingPacketRemainsAuthoritative &&
    !bridgeImplementDispatchFallback &&
    !bridgeCompletedRemediationReturnsToImplement;
  const fallbackActionNextAction = bridgeImplementDispatchFallback
    ? 'dispatch_implement'
    : bridgeCompletedRemediationReturnsToImplement
      ? 'dispatch_implement'
      : bridgePendingPacketRemainsAuthoritative
        ? (scopedState.state?.nextAction ?? action.nextAction)
        : action.nextAction;
  const fallbackActionReady =
    bridgeImplementDispatchFallback || bridgeCompletedRemediationReturnsToImplement
      ? true
      : bridgePendingPacketRemainsAuthoritative
        ? pendingPacketStatus === 'ready_for_main_agent'
        : action.ready;
  const actionNextAction = sixModelRuntimeDecisionAuthoritative
    ? sixModelRuntimeDecision?.nextAction
    : fallbackActionNextAction;
  const actionReady = sixModelRuntimeDecisionAuthoritative
    ? sixModelRuntimeDecision?.ready
    : fallbackActionReady;
  const splitBrainBlockerPath =
    input.projectRoot &&
    sixModelRuntimeDecision &&
    sixModelRuntimeDecisionAuthoritative &&
    scopedState.state?.nextAction &&
    scopedState.state.nextAction !== sixModelRuntimeDecision.nextAction
      ? writeSplitBrainBlocker({
          projectRoot: input.projectRoot,
          decision: sixModelRuntimeDecision,
          orchestrationStateNextAction: scopedState.state.nextAction,
          pendingPacketId: scopedState.state.pendingPacket?.packetId ?? null,
          lastTaskReportStatus: scopedState.state.lastTaskReport?.status ?? null,
          decisionRef: sixModelRuntimeDecisionPath ?? 'not_written',
        })
      : null;
  const implementationEntryGateComesFromRecord =
    !explicitImplementationEntryGateProvided && recordHasImplementationEntryGate(requirementRecord);
  const implementationEntryGateIsBridgeOnly =
    runtimeRegistryBridgeRecord && implementationEntryGateComesFromRecord;
  const explicitImplementationEntryGateIsOnlySource =
    explicitImplementationEntryGateProvided && !recordHasImplementationEntryGate(requirementRecord);
  const surfaceSource: MainAgentOrchestrationSource =
    action.source === 'implementation_entry_gate' ||
    explicitImplementationEntryGateIsOnlySource ||
    implementationEntryGateIsBridgeOnly
      ? 'implementation_entry_gate'
      : action.source;
  const drift = deriveDriftSurface(input.projectRoot, closeout, requirementRecord);
  const diagnostics = readinessDiagnostics({
    root: input.projectRoot,
    recordPath,
    record: requirementRecord,
    drift,
    pendingPacketStatus,
  });
  const terminalState =
    'terminalState' in action && action.terminalState === 'completed_no_dispatch'
      ? action.terminalState
      : undefined;
  const mainAgentStageSummary = buildMainAgentStageSummary({
    record: requirementRecord,
    nextAction: actionNextAction,
    ready: actionReady,
  });

  return {
    source: surfaceSource,
    sessionId: scopedState.sessionId,
    orchestrationStatePath: scopedState.statePath,
    orchestrationState: scopedState.state,
    pendingPacketStatus,
    pendingPacket,
    fourSignal,
    latestGate,
    gatesLoop: scopedState.state?.gatesLoop ?? null,
    closeout,
    drift,
    diagnostics,
    mainAgentCanContinue: continueState.canContinue,
    continueDecision: continueState.continueDecision,
    mainAgentNextAction: actionNextAction,
    mainAgentReady: actionReady,
    mainAgentStageSummary,
    sixModelRuntimeDecision,
    sixModelRuntimeDecisionPath,
    splitBrainBlockerPath,
    preConfirmationDrilldownLane,
    ...(useRequirementRecordProjection
      ? {
          runtimeResumeProjection: {
            projectionType: 'runtime_resume_projection' as const,
            source: 'requirement_record' as const,
            runtimeNextAction: actionNextAction,
            ready: actionReady === true,
            blockingReasonRefs: normalizeBlockingReasonRefs(
              'blockingReasonRefs' in action ? action.blockingReasonRefs : []
            ).concat(sixModelRuntimeDecision?.blockingReasonRefs ?? []),
            ...(terminalState ? { terminalState } : {}),
            diagnostics,
            observedLegacyState: {
              path: scopedState.statePath,
              nextAction: scopedState.state?.nextAction ?? null,
              pendingPacketStatus,
            },
          },
        }
      : {}),
  };
}

export function claimMainAgentPendingPacket(
  projectRoot: string,
  sessionId: string,
  owner = 'main-agent'
): OrchestrationState {
  return claimPendingPacket(projectRoot, sessionId, owner);
}

export function markMainAgentPacketDispatched(
  projectRoot: string,
  sessionId: string,
  packetId: string
): OrchestrationState {
  return markPendingPacketDispatched(projectRoot, sessionId, packetId);
}

export function completeMainAgentPendingPacket(
  projectRoot: string,
  sessionId: string,
  packetId: string
): OrchestrationState {
  return completePendingPacket(projectRoot, sessionId, packetId);
}

export function invalidateMainAgentPendingPacket(
  projectRoot: string,
  sessionId: string,
  packetId: string
): OrchestrationState {
  return invalidatePendingPacket(projectRoot, sessionId, packetId);
}

export function ingestMainAgentTaskReport(
  projectRoot: string,
  sessionId: string,
  report: TaskReport,
  options: {
    nextActionHint?: OrchestrationNextAction;
    currentStage?: string;
  } = {}
): OrchestrationState {
  const state = readOrchestrationState(projectRoot, sessionId);
  if (!state) {
    throw new Error(`Main-agent ingestion failed: session not found (${sessionId})`);
  }

  const pendingPacket = state.pendingPacket;
  const packet = pendingPacket ? readPendingPacketPayload(state) : null;
  const taskType =
    packet && 'taskType' in packet
      ? packet.taskType
      : state.nextAction === 'dispatch_remediation'
        ? 'remediate'
        : state.nextAction === 'dispatch_review'
          ? 'audit'
          : 'implement';

  const legacyNextAction =
    options.nextActionHint ??
    (report.status === 'done'
      ? deriveNextActionFromTaskType(taskType, options.currentStage ?? state.currentPhase)
      : deriveNextActionFromFailedTaskType(taskType, report.status));

  if (report.status === 'done') {
    completePendingPacket(projectRoot, sessionId, report.packetId);
    resetGatesLoopProgress(projectRoot, sessionId, {
      lastResult: `task-report:${report.status}`,
    });
  } else if (report.status === 'partial') {
    recordGatesLoopNoProgress(projectRoot, sessionId, {
      lastResult: `task-report:${report.status}`,
    });
  } else {
    invalidatePendingPacket(projectRoot, sessionId, report.packetId);
    recordGatesLoopNoProgress(projectRoot, sessionId, {
      lastResult: `task-report:${report.status}`,
    });
  }

  const evidenceState = updateOrchestrationState(projectRoot, sessionId, (current) => ({
    ...current,
    nextAction: legacyNextAction,
    lastTaskReport: {
      packetId: report.packetId,
      status: report.status,
      filesChanged: report.filesChanged,
      validationsRun: report.validationsRun,
      evidence: report.evidence,
      ...(report.driftFlags ? { driftFlags: report.driftFlags } : {}),
    },
  }));
  const runtimeContext = loadRuntimeContextForMainAgent({
    projectRoot,
    flow: evidenceState.flow as RuntimeFlowId,
    stage: options.currentStage ?? evidenceState.currentPhase,
  });
  const requirementRecord = readRequirementRecordFromRuntimeContext(runtimeContext);
  const matrix = resolveSixModelRuntimeDecision({
    record: requirementRecord,
    attemptId: report.packetId,
    pendingPacketId: evidenceState.pendingPacket?.packetId ?? null,
    pendingPacketTaskType: packetTaskType(packet),
    pendingPacketKind: evidenceState.pendingPacket?.packetKind ?? null,
    lastTaskReportPacketId: report.packetId,
    lastTaskReportStatus: report.status,
  });
  const matrixPath = writeSixModelRuntimeDecision({ projectRoot, decision: matrix });
  const keepLegacyTransition =
    isRuntimeRegistryBridgeRecord(requirementRecord) && taskType === 'remediate';
  if (!keepLegacyTransition && legacyNextAction !== matrix.nextAction) {
    writeSplitBrainBlocker({
      projectRoot,
      decision: matrix,
      orchestrationStateNextAction: legacyNextAction,
      pendingPacketId: evidenceState.pendingPacket?.packetId ?? null,
      lastTaskReportStatus: report.status,
      decisionRef: matrixPath,
    });
  }
  return updateOrchestrationState(projectRoot, sessionId, (current) => ({
    ...current,
    nextAction: (keepLegacyTransition
      ? legacyNextAction
      : (matrix.nextAction ?? 'await_user')) as OrchestrationNextAction,
  }));
}

export function ensureMainAgentDispatchPacket(
  input: ResolveMainAgentOrchestrationInput & {
    host?: OrchestrationHost;
    preferredPacketId?: string | null;
  }
): MainAgentOrchestrationSurface {
  const runtimeContext = loadRuntimeContextForMainAgent(input);
  const resolvedInput = runtimeContext ? { ...input, runtimeContext } : input;
  const currentSurface = resolveMainAgentOrchestrationSurface(resolvedInput);
  if (
    currentSurface.pendingPacketStatus !== 'none' &&
    currentSurface.pendingPacketStatus !== 'missing_packet_file' &&
    currentSurface.pendingPacketStatus !== 'completed' &&
    currentSurface.pendingPacketStatus !== 'invalidated' &&
    pendingPacketMatchesNextAction(currentSurface)
  ) {
    return currentSurface;
  }
  if (!input.projectRoot) {
    return currentSurface;
  }

  const taskType = taskTypeFromNextAction(currentSurface.mainAgentNextAction);
  if (!taskType) {
    return currentSurface;
  }

  const sessionId =
    resolvedContext(runtimeContext)?.requirementSetId ??
    currentSurface.sessionId ??
    deriveSessionIdFromRuntimeContext(input.flow, runtimeContext);
  const host = resolveMainAgentHost(input.projectRoot, input.host, currentSurface);
  const packetId = input.preferredPacketId ?? `${taskType}-${Date.now()}`;
  const role = defaultPacketRole(taskType);
  const flow = input.flow as 'story' | 'bugfix' | 'standalone_tasks';
  const executionDisciplineProfile =
    taskType === 'implement' || taskType === 'remediate'
      ? resolveExecutionDisciplineProfile(flow)
      : null;
  const inputArtifacts = [
    normalizeText(runtimeContext?.artifactPath),
    normalizeText(runtimeContext?.artifactRoot),
    normalizeText(currentSurface.closeout?.artifactPath),
    normalizeText(currentSurface.closeout?.reportPath),
  ].filter(Boolean);
  const resolvedScope = resolveMappedAllowedWriteScope(
    input.projectRoot,
    runtimeContext,
    input.flow,
    taskType,
    currentSurface.runtimeResumeProjection
      ? readRequirementRecordFromRuntimeContext(runtimeContext)
      : null
  );
  const allowedWriteScope =
    resolvedScope && resolvedScope.length > 0
      ? resolvedScope
      : taskType === 'audit'
        ? ['docs/**', '_bmad-output/**', 'specs/**']
        : ['src/**', 'tests/**', 'docs/**', '_bmad-output/**'];

  const recordPath = resolvedContext(runtimeContext)?.recordPath;
  const compiledRun =
    taskType === 'implement' && !currentSurface.orchestrationState?.originalExecutionPacketId
      ? runMainAgentCompiledPrompt({
          projectRoot: input.projectRoot,
          recordPath,
          sourcePath:
            normalizeText(runtimeContext?.artifactPath) ||
            normalizeText(runtimeContext?.artifactRoot),
          packetId,
          flow,
          executionHost:
            host === 'codex' ? 'codex' : host === 'claude' ? 'claude-code' : 'cursor-ide',
          executionDisciplineProfile,
          goalCommandAvailable: host === 'codex' || host === 'claude' ? 'true' : 'false',
        })
      : null;
  const activeRecord = readRequirementRecordFromRuntimeContext(runtimeContext);
  const inheritedCompiledPromptRef =
    taskType === 'audit'
      ? latestCurrentCompiledPromptRef({
          projectRoot: input.projectRoot,
          sessionId,
          record: activeRecord,
        })
      : null;
  const auditExecution =
    taskType === 'audit' && inheritedCompiledPromptRef
      ? writeAuditExecutionProfile({
          projectRoot: input.projectRoot,
          recordId: normalizeText(activeRecord?.recordId) || sessionId,
          requirementSetId: normalizeText(activeRecord?.requirementSetId) || sessionId,
          attemptId: packetId,
          stage: input.stage,
          compiledPromptRef: inheritedCompiledPromptRef,
        })
      : null;
  const runtimeModeSelection =
    taskType === 'implement' && compiledRun?.status === 'pass' && compiledRun.compiledPromptRef
      ? writeExecutionRuntimeModeSelection({
          projectRoot: input.projectRoot,
          recordId: normalizeText(activeRecord?.recordId) || sessionId,
          packetId,
          attemptId: packetId,
          host,
          compiledPromptRef: compiledRun.compiledPromptRef,
        })
      : null;
  if (runtimeModeSelection && compiledRun?.compiledPromptRef) {
    const nativeGoalBlocker = validateNativeGoalReadiness({
      projectRoot: input.projectRoot,
      recordId: normalizeText(activeRecord?.recordId) || sessionId,
      packetId,
      attemptId: packetId,
      host,
      compiledPromptRef: compiledRun.compiledPromptRef,
    });
    if (nativeGoalBlocker) {
      writeRuntimeBlocker(
        input.projectRoot,
        normalizeText(activeRecord?.recordId) || sessionId,
        packetId,
        nativeGoalBlocker
      );
    }
  }
  const executionStrategy =
    compiledRun?.status === 'pass'
      ? ensurePolicyDefaultExecutionStrategy({
          recordPath,
          compiledRun,
          packetId,
          sessionId,
        })
      : null;
  const sddArtifactManifestRef =
    compiledRun?.status === 'pass'
      ? writeEmptySddArtifactManifestRef({
          projectRoot: input.projectRoot,
          recordPath,
          compiledOutDir: compiledRun.outDir,
          packetId,
          sessionId,
          flow,
        })
      : null;
  const packet =
    currentSurface.orchestrationState?.originalExecutionPacketId != null
      ? createResumePacket({
          packetId,
          parentSessionId: sessionId,
          originalExecutionPacketId: currentSurface.orchestrationState.originalExecutionPacketId,
          flow,
          phase: input.stage,
          role,
          resumeReason: `main agent resumed ${taskType} after orchestration-state inspection`,
          inputArtifacts: [resolvedContext(runtimeContext)?.recordPath, ...inputArtifacts].filter(
            Boolean
          ) as string[],
          allowedWriteScope,
          expectedDelta: `continue ${taskType} through the main-agent runtime loop`,
          successCriteria: ['bounded task report returned', 'state updated'],
          stopConditions: ['true blocker detected', 'scope must widen'],
        })
      : createExecutionPacket({
          packetId,
          parentSessionId: sessionId,
          flow,
          phase: input.stage,
          taskType,
          role,
          inputArtifacts: [resolvedContext(runtimeContext)?.recordPath, ...inputArtifacts].filter(
            Boolean
          ) as string[],
          allowedWriteScope,
          expectedDelta: `execute ${taskType} through the main-agent runtime loop`,
          successCriteria: ['bounded task report returned', 'state updated'],
          stopConditions: ['true blocker detected', 'scope must widen'],
          authorityMode:
            taskType === 'audit'
              ? 'compiled_implementation_confirmation'
              : compiledRun?.status === 'pass'
                ? 'compiled_implementation_confirmation'
                : compiledRun?.status === 'no_confirmed_source' || compiledRun === null
                  ? 'legacy_generic_prompt'
                  : 'compiled_implementation_confirmation',
          compiledPromptRef: compiledRun?.compiledPromptRef ?? inheritedCompiledPromptRef ?? null,
          executionDisciplineProfile,
          executionStrategy,
          sddArtifactManifestRef,
          auditExecutionProfile: auditExecution?.profile ?? null,
          auditTriadExecutionPlanRef: auditExecution?.triadRef ?? null,
          legacyPromptFallbackReason:
            taskType === 'audit'
              ? null
              : compiledRun?.status === 'no_confirmed_source' || compiledRun === null
                ? 'no_confirmed_source'
                : null,
          compilerBlock:
            taskType === 'audit' && !inheritedCompiledPromptRef
              ? ['audit_current_attempt_compiledPromptRef_missing']
              : compiledRun &&
                  compiledRun.status !== 'pass' &&
                  compiledRun.status !== 'no_confirmed_source'
                ? compiledRun.blockingReasons
                : null,
        });
  const compilerBlocked =
    'compilerBlock' in packet &&
    Array.isArray(packet.compilerBlock) &&
    packet.compilerBlock.length > 0;

  const packetKind: PacketKind = 'originalExecutionPacketId' in packet ? 'resume' : 'execution';
  const packetPath = writePacketFile(input.projectRoot, sessionId, packetId, packet);

  let writtenState: OrchestrationState;
  const canUpdateCurrentState =
    Boolean(currentSurface.orchestrationState) && currentSurface.sessionId === sessionId;
  if (canUpdateCurrentState) {
    updateOrchestrationState(input.projectRoot, sessionId, (current) => ({
      ...current,
      host,
      pendingPacket: {
        packetId,
        packetPath,
        packetKind,
        status: compilerBlocked ? 'invalidated' : 'ready_for_main_agent',
        createdAt: new Date().toISOString(),
        claimOwner: null,
      },
      nextAction:
        (currentSurface.mainAgentNextAction as OrchestrationState['nextAction']) ??
        current.nextAction,
      gatesLoop: {
        retryCount: current.gatesLoop?.retryCount ?? 0,
        maxRetries: current.gatesLoop?.maxRetries ?? 3,
        noProgressCount: current.gatesLoop?.noProgressCount ?? 0,
        circuitOpen: current.gatesLoop?.circuitOpen ?? false,
        rerunGate: current.gatesLoop?.rerunGate ?? null,
        activePacketId: packetId,
        lastResult: current.gatesLoop?.lastResult ?? null,
      },
    }));
    writtenState = readOrchestrationState(input.projectRoot, sessionId)!;
  } else {
    writtenState = {
      version: 1,
      sessionId,
      host,
      flow: input.flow as 'story' | 'bugfix' | 'standalone_tasks',
      currentPhase: input.stage as OrchestrationState['currentPhase'],
      nextAction:
        (currentSurface.mainAgentNextAction as OrchestrationState['nextAction']) ??
        'dispatch_implement',
      pendingPacket: {
        packetId,
        packetPath,
        packetKind,
        status: compilerBlocked ? 'invalidated' : 'ready_for_main_agent',
        createdAt: new Date().toISOString(),
        claimOwner: null,
      },
      originalExecutionPacketId: null,
      gatesLoop: {
        retryCount: 0,
        maxRetries: 3,
        noProgressCount: 0,
        circuitOpen: false,
        rerunGate: null,
        activePacketId: packetId,
        lastResult: null,
      },
      closeout: {
        invoked: false,
        approved: false,
        scoreWriteResult: null,
        handoffPersisted: false,
        resultCode: null,
      },
    };
    const file = path.join(
      orchestrationStateDirForRecordPath(
        input.projectRoot,
        resolvedContext(runtimeContext)?.recordPath
      ),
      `${sessionId}.json`
    );
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(writtenState, null, 2) + '\n', 'utf8');
  }

  const refreshed = resolveMainAgentOrchestrationSurface(resolvedInput);
  if (refreshed.pendingPacketStatus !== 'none' && pendingPacketMatchesNextAction(refreshed)) {
    return refreshed;
  }

  return {
    source: 'orchestration_state',
    sessionId,
    orchestrationStatePath: path.join(
      orchestrationStateDirForRecordPath(
        input.projectRoot,
        resolvedContext(runtimeContext)?.recordPath
      ),
      `${sessionId}.json`
    ),
    orchestrationState: writtenState,
    pendingPacketStatus: compilerBlocked ? 'invalidated' : 'ready_for_main_agent',
    pendingPacket: packet,
    fourSignal: writtenState.fourSignal ?? null,
    latestGate: writtenState.latestGate ?? null,
    gatesLoop: writtenState.gatesLoop ?? null,
    closeout: currentSurface.closeout,
    drift: currentSurface.drift,
    diagnostics: currentSurface.diagnostics,
    mainAgentCanContinue: false,
    continueDecision: 'blocked',
    mainAgentNextAction: writtenState.nextAction,
    mainAgentReady: !compilerBlocked,
    mainAgentStageSummary: currentSurface.mainAgentStageSummary,
  };
}

export function buildMainAgentDispatchInstruction(
  input: ResolveMainAgentOrchestrationInput & {
    host?: OrchestrationHost;
    hydratePacket?: boolean;
    preferredPacketId?: string | null;
  }
): MainAgentDispatchInstruction | null {
  const surface = input.hydratePacket
    ? ensureMainAgentDispatchPacket(input)
    : resolveMainAgentOrchestrationSurface(input);
  const nextAction = surface.mainAgentNextAction;
  const taskType = taskTypeFromNextAction(nextAction);
  if (!nextAction || !taskType || !surface.mainAgentReady) {
    return null;
  }
  if (!surface.pendingPacket || !surface.orchestrationState?.pendingPacket?.packetPath) {
    return null;
  }
  if (!pendingPacketDispatchable(surface.pendingPacket)) {
    return null;
  }

  const host = resolveMainAgentHost(input.projectRoot, input.host, surface);
  const route = resolveDispatchRoute(host, taskType);
  return {
    flow: input.flow,
    stage: input.stage,
    host,
    nextAction,
    taskType,
    route,
    sessionId: surface.sessionId!,
    packetId: surface.orchestrationState.pendingPacket!.packetId,
    packetKind: surface.orchestrationState.pendingPacket!.packetKind,
    packetPath: surface.orchestrationState.pendingPacket!.packetPath,
    packet: surface.pendingPacket,
    role:
      'role' in surface.pendingPacket
        ? surface.pendingPacket.role
        : (surface.pendingPacket.recommendedRole ?? defaultPacketRole(taskType)),
    expectedDelta:
      (surface.pendingPacket as ExecutionPacket | ResumePacket).expectedDelta ??
      (surface.pendingPacket as RecommendationPacket).expectedDelta,
  };
}

const MAIN_AGENT_CLI_ACTIONS = new Set([
  'inspect',
  'step',
  'dispatch-plan',
  'run-loop',
  'claim',
  'dispatch',
  'complete',
  'invalidate',
  'route-intake',
  'adaptive-intake',
  'confirm-scope',
  'confirmation-ingest',
  'confirm-closeout-acceptance',
  'closeout-acceptance-ingest',
  'post-close-defect-intake',
  'route-confirmation-drift',
  'confirmation-drift-route',
  'repair-confirmation-bookkeeping',
  'confirmation-bookkeeping-repair',
  'pre-confirmation-drilldown',
  'pre_confirmation_drilldown',
  'author-confirmation-ready-source',
  'author_confirmation_ready_source',
  'authoring-repair',
  'authoring_repair',
  'controlled-readiness-audit',
]);

function isMainAgentCliAction(value: string): boolean {
  return MAIN_AGENT_CLI_ACTIONS.has(value);
}

function defaultRunLoopTaskReportPath(
  projectRoot: string,
  sessionId: string,
  packetId: string
): string {
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'governance',
    'task-reports',
    sessionId,
    `${packetId}.json`
  );
}

function dispatchPacketGoalCommandMode(packet: ExecutionPacket): string {
  const receiptPath = normalizeText(packet.compiledPromptRef?.auditReceiptPath);
  if (!receiptPath || !fs.existsSync(receiptPath)) return '';
  try {
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as Record<string, unknown>;
    const goalCommand =
      receipt.goalCommand && typeof receipt.goalCommand === 'object'
        ? (receipt.goalCommand as Record<string, unknown>)
        : {};
    return normalizeText(goalCommand.mode);
  } catch {
    return '';
  }
}

function isNativeGoalExecutionPacket(
  instruction: MainAgentDispatchInstruction,
  args: Record<string, string | undefined>
): instruction is MainAgentDispatchInstruction & { packet: ExecutionPacket } {
  if (args.codexSmoke === 'true') return false;
  if (instruction.host !== 'codex' && instruction.host !== 'claude') return false;
  const packet = instruction.packet;
  return Boolean(
    packet &&
      'taskType' in packet &&
      packet.taskType === 'implement' &&
      packet.authorityMode === 'compiled_implementation_confirmation' &&
      packet.compiledPromptRef?.goalExecutionHash &&
      packet.compiledPromptRef.goalExecutionPath &&
      dispatchPacketGoalCommandMode(packet) === 'native_goal_document_ref'
  );
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const positional: string[] = [];
  const appendArg = (key: string, value: string): void => {
    const existing = out[key];
    out[key] = existing ? `${existing}\n${value}` : value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--cwd' && argv[index + 1]) {
      out.cwd = argv[++index];
    } else if (token === '--flow' && argv[index + 1]) {
      out.flow = argv[++index];
    } else if (token === '--stage' && argv[index + 1]) {
      out.stage = argv[++index];
    } else if (token === '--record-id' && argv[index + 1]) {
      out.recordId = argv[++index];
    } else if (token === '--requirement-set-id' && argv[index + 1]) {
      out.requirementSetId = argv[++index];
    } else if (token === '--run-id' && argv[index + 1]) {
      out.runId = argv[++index];
    } else if (token === '--attempt-id' && argv[index + 1]) {
      out.attemptId = argv[++index];
    } else if (
      (token === '--implementation-run-kind' || token === '--implementationRunKind') &&
      argv[index + 1]
    ) {
      out.implementationRunKind = argv[++index];
    } else if (
      (token === '--readiness-report-path' || token === '--readinessReportPath') &&
      argv[index + 1]
    ) {
      out.readinessReportPath = argv[++index];
    } else if (token === '--scoring-run-id' && argv[index + 1]) {
      out.scoringRunId = argv[++index];
    } else if (token === '--source' && argv[index + 1]) {
      out.source = argv[++index];
    } else if ((token === '--intake-source' || token === '--intakeSource') && argv[index + 1]) {
      out.intakeSource = argv[++index];
    } else if ((token === '--target-source' || token === '--targetSource') && argv[index + 1]) {
      out.targetSource = argv[++index];
    } else if (
      (token === '--target-path' || token === '--targetPath') &&
      argv[index + 1]
    ) {
      appendArg('targetPath', argv[++index]);
    } else if (
      (token === '--required-command' || token === '--requiredCommand') &&
      argv[index + 1]
    ) {
      appendArg('requiredCommand', argv[++index]);
    } else if (token === '--render-report' && argv[index + 1]) {
      out.renderReport = argv[++index];
    } else if ((token === '--report-path' || token === '--reportPath') && argv[index + 1]) {
      out.reportPath = argv[++index];
    } else if (token === '--confirmation-text' && argv[index + 1]) {
      out.confirmationText = argv[++index];
    } else if (token === '--confirmation-text-file' && argv[index + 1]) {
      out.confirmationTextFile = argv[++index];
    } else if (token === '--confirmed-by' && argv[index + 1]) {
      out.confirmedBy = argv[++index];
    } else if (token === '--confirmed-at' && argv[index + 1]) {
      out.confirmedAt = argv[++index];
    } else if (
      (token === '--confirmation-language' || token === '--confirmationLanguage') &&
      argv[index + 1]
    ) {
      out.confirmationLanguage = argv[++index];
    } else if (token === '--mode' && argv[index + 1]) {
      out.mode = argv[++index];
    } else if (
      (token === '--critical-auditor-response' || token === '--criticalAuditorResponse') &&
      argv[index + 1]
    ) {
      out.criticalAuditorResponse = argv[++index];
    } else if (
      (token === '--critical-auditor-provider-mode' || token === '--criticalAuditorProviderMode') &&
      argv[index + 1]
    ) {
      out.criticalAuditorProviderMode = argv[++index];
    } else if (
      (token === '--critical-auditor-response-file' || token === '--criticalAuditorResponseFile') &&
      argv[index + 1]
    ) {
      out.criticalAuditorResponseFile = argv[++index];
    } else if (
      (token === '--critical-auditor-response-dir' || token === '--criticalAuditorResponseDir') &&
      argv[index + 1]
    ) {
      out.criticalAuditorResponseDir = argv[++index];
    } else if (
      (token === '--critical-auditor-external-adapter-command' ||
        token === '--criticalAuditorExternalAdapterCommand') &&
      argv[index + 1]
    ) {
      out.criticalAuditorExternalAdapterCommand = argv[++index];
    } else if (
      (token === '--checkpoint-persistence-evidence' ||
        token === '--checkpointPersistenceEvidence') &&
      argv[index + 1]
    ) {
      out.checkpointPersistenceEvidencePath = argv[++index];
    } else if (token === '--skip-drilldown-artifacts') {
      out.skipDrilldownArtifacts = 'true';
    } else if (token === '--runtime-root' && argv[index + 1]) {
      out.runtimeRoot = argv[++index];
    } else if (token === '--requirement-record' && argv[index + 1]) {
      out.requirementRecord = argv[++index];
    } else if (token === '--event-log' && argv[index + 1]) {
      out.eventLog = argv[++index];
    } else if (token === '--artifact-index' && argv[index + 1]) {
      out.artifactIndex = argv[++index];
    } else if (token === '--update-source' && argv[index + 1]) {
      out.updateSource = argv[++index];
    } else if (token === '--action' && argv[index + 1]) {
      out.action = argv[++index];
    } else if ((token === '--host' || token === '--hostKind') && argv[index + 1]) {
      out.host = argv[++index];
    } else if (token === '--sessionId' && argv[index + 1]) {
      out.sessionId = argv[++index];
    } else if (token === '--packetId' && argv[index + 1]) {
      out.packetId = argv[++index];
    } else if (token === '--owner' && argv[index + 1]) {
      out.owner = argv[++index];
    } else if (token === '--reportStatus' && argv[index + 1]) {
      out.reportStatus = argv[++index];
    } else if (token === '--reportEvidence' && argv[index + 1]) {
      out.reportEvidence = argv[++index];
    } else if (token === '--taskReportPath' && argv[index + 1]) {
      out.taskReportPath = argv[++index];
    } else if (token === '--codexSmoke') {
      out.codexSmoke = 'true';
    } else if (token === '--codexSmokeTargetPath' && argv[index + 1]) {
      out.codexSmokeTargetPath = argv[++index];
    } else if (token === '--codexTimeoutMs' && argv[index + 1]) {
      out.codexTimeoutMs = argv[++index];
    } else if (token === '--filesChanged' && argv[index + 1]) {
      out.filesChanged = argv[++index];
    } else if (token === '--validationsRun' && argv[index + 1]) {
      out.validationsRun = argv[++index];
    } else if (token === '--input' && argv[index + 1]) {
      out.input = argv[++index];
    } else if (token === '--payload' && argv[index + 1]) {
      out.payload = argv[++index];
    } else if (token === '--signal' && argv[index + 1]) {
      out.signal = argv[++index];
    } else if ((token === '--data-path' || token === '--dataPath') && argv[index + 1]) {
      out.dataPath = argv[++index];
    } else if (token === '--dry-run' || token === '--dryRun') {
      out.dryRun = 'true';
    } else if (token === '--apply') {
      out.apply = 'true';
    } else if (!token.startsWith('--')) {
      positional.push(token);
    }
  }
  const positionalAction = positional.find(isMainAgentCliAction);
  if (!out.action && positionalAction) {
    out.action = positionalAction;
  }
  const cwdCandidate = positional.find((item) => item !== positionalAction);
  if (!out.cwd && cwdCandidate) out.cwd = cwdCandidate;
  return out;
}

function pickRoot(args: Record<string, string | undefined>): string {
  const fromArg = stripWrappingQuotes(normalizeText(args.cwd));
  return fromArg ? path.resolve(fromArg) : process.cwd();
}

function pushOptionalArg(
  target: string[],
  flag: string,
  value: string | undefined,
  root: string,
  pathLike = false
): void {
  const normalized = normalizeText(value);
  if (!normalized) {
    return;
  }
  const stripped = stripWrappingQuotes(normalized);
  target.push(flag, pathLike ? path.resolve(root, stripped) : stripped);
}

export interface MainAgentConfirmScopeResult {
  ok: boolean;
  action:
    | 'confirm-scope'
    | 'confirm-closeout-acceptance'
    | 'repair-confirmation-bookkeeping'
    | 'route-confirmation-drift';
  delegatedEntry: string;
  exitCode: number;
  stdout?: unknown;
  stderr?: string;
  route?: string;
  block?: string;
  nextRequiredAction?: string;
  requestId?: string;
  eventId?: string | null;
  rollbackEventId?: string | null;
  receiptPath?: string | null;
  eventLogPath?: string;
  requirementRecordIndexPath?: string | null;
  reusedExistingRequest?: boolean;
  classification?: Record<string, unknown>;
  delegatedResult?: MainAgentConfirmScopeResult;
  mainAgentStageSummary?: MainAgentStageSummary | null;
}

function stageSummaryForCommandResult(
  root: string,
  args: Record<string, string | undefined>,
  delegatedOutput?: unknown
): MainAgentStageSummary | null {
  try {
    const { flow, stage } = resolveFlowAndStage(root, args);
    const surfaceSummary = resolveMainAgentOrchestrationSurface({
      projectRoot: root,
      recordId: args.recordId,
      requirementSetId: args.requirementSetId,
      runId: args.runId,
      flow,
      stage,
    }).mainAgentStageSummary;
    if (surfaceSummary) {
      return surfaceSummary;
    }
  } catch {
    // Fall back to direct record reads below; user-facing hints must not fail the command.
  }
  const recordPath = directRequirementRecordPathForCommand(root, args, delegatedOutput);
  const record = recordPath ? readJsonIfExists(recordPath) : null;
  if (!record) {
    return null;
  }
  const stage = normalizeText(args.stage) || normalizeText(record.stage) || 'implement';
  const implementationEntryGate =
    record.implementationEntryGate &&
    typeof record.implementationEntryGate === 'object' &&
    !Array.isArray(record.implementationEntryGate)
      ? (record.implementationEntryGate as ImplementationEntryGate)
      : null;
  const action = deriveNextActionFromRequirementRecord({
    stage,
    record,
    state: null,
    pendingPacketStatus: 'none',
    pendingPacket: null,
    implementationEntryDecision: implementationEntryGate?.decision ?? null,
    continueDecision: null,
  });
  return buildMainAgentStageSummary({
    record,
    nextAction: action.nextAction,
    ready: action.ready,
  });
}

function directRequirementRecordPathForCommand(
  root: string,
  args: Record<string, string | undefined>,
  delegatedOutput?: unknown
): string | null {
  const fromArg = normalizeText(args.requirementRecord);
  if (fromArg) {
    return path.resolve(root, stripWrappingQuotes(fromArg));
  }
  const output =
    delegatedOutput && typeof delegatedOutput === 'object' && !Array.isArray(delegatedOutput)
      ? (delegatedOutput as Record<string, unknown>)
      : null;
  const fromOutput =
    normalizeText(output?.requirementRecordPath) ||
    normalizeText(
      output?.stdout && typeof output.stdout === 'object' && !Array.isArray(output.stdout)
        ? (output.stdout as Record<string, unknown>).requirementRecordPath
        : null
    );
  if (fromOutput) {
    return path.resolve(root, stripWrappingQuotes(fromOutput));
  }
  const index = readJsonIfExists(
    path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json')
  );
  const active =
    index?.active && typeof index.active === 'object' && !Array.isArray(index.active)
      ? (index.active as Record<string, unknown>)
      : null;
  const activeRequirementSetId = normalizeText(active?.requirementSetId || args.requirementSetId);
  if (activeRequirementSetId) {
    return path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      activeRequirementSetId,
      'requirement-record.json'
    );
  }
  return null;
}

export function runMainAgentConfirmCloseoutAcceptance(
  root: string,
  args: Record<string, string | undefined>
): MainAgentConfirmScopeResult {
  const entry = resolveSkillScript(root, 'ingest-confirmation-event.js');
  if (!fs.existsSync(entry)) {
    throw new Error(`controlled closeout acceptance entry missing: ${entry}`);
  }
  const source = normalizeText(args.source);
  if (!source) {
    throw new Error('confirm-closeout-acceptance requires --source <source-document.md>');
  }
  if (!normalizeText(args.renderReport)) {
    throw new Error(
      'confirm-closeout-acceptance requires --render-report <closeout-render-report.json>'
    );
  }
  if (!normalizeText(args.confirmationText) && !normalizeText(args.confirmationTextFile)) {
    throw new Error(
      'confirm-closeout-acceptance requires --confirmation-text <exact closeout confirmation> or --confirmation-text-file <file>'
    );
  }

  const delegatedArgs = [
    '--action',
    'confirm-closeout-acceptance',
    '--source',
    path.resolve(root, stripWrappingQuotes(source)),
    '--json',
  ];
  pushOptionalArg(delegatedArgs, '--render-report', args.renderReport, root, true);
  pushOptionalArg(delegatedArgs, '--confirmation-text', args.confirmationText, root);
  pushOptionalArg(delegatedArgs, '--confirmation-text-file', args.confirmationTextFile, root, true);
  pushOptionalArg(
    delegatedArgs,
    '--confirmed-by',
    args.confirmedBy ?? 'main-agent-orchestration',
    root
  );
  pushOptionalArg(delegatedArgs, '--confirmed-at', args.confirmedAt, root);
  pushOptionalArg(delegatedArgs, '--record-id', args.recordId, root);
  pushOptionalArg(delegatedArgs, '--requirement-set-id', args.requirementSetId, root);
  pushOptionalArg(delegatedArgs, '--requirement-record', args.requirementRecord, root, true);
  pushOptionalArg(delegatedArgs, '--event-log', args.eventLog, root, true);
  pushOptionalArg(delegatedArgs, '--artifact-index', args.artifactIndex, root, true);

  const step = spawnSync(process.execPath, [entry, ...delegatedArgs], {
    cwd: root,
    encoding: 'utf8',
  });
  let parsedStdout: unknown = undefined;
  if (step.stdout.trim()) {
    try {
      parsedStdout = JSON.parse(step.stdout);
    } catch {
      parsedStdout = step.stdout.trim();
    }
  }
  return {
    ok: step.status === 0,
    action: 'confirm-closeout-acceptance',
    delegatedEntry: path.relative(root, entry).replace(/\\/g, '/'),
    exitCode: step.status ?? 2,
    ...(parsedStdout !== undefined ? { stdout: parsedStdout } : {}),
    ...(step.stderr.trim() ? { stderr: step.stderr.trim() } : {}),
    mainAgentStageSummary: stageSummaryForCommandResult(root, args, parsedStdout),
  };
}

export function runMainAgentConfirmScope(
  root: string,
  args: Record<string, string | undefined>
): MainAgentConfirmScopeResult {
  const entry = resolveSkillScript(root, 'confirm-requirements-scope.js');
  if (!fs.existsSync(entry)) {
    throw new Error(`controlled confirmation entry missing: ${entry}`);
  }
  const source = normalizeText(args.source);
  if (!source) {
    throw new Error('confirm-scope requires --source <source-document.md>');
  }
  if (!normalizeText(args.confirmationText) && !normalizeText(args.confirmationTextFile)) {
    throw new Error(
      'confirm-scope requires --confirmation-text <exact chat confirmation> or --confirmation-text-file <file>'
    );
  }

  const delegatedArgs = ['--source', path.resolve(root, stripWrappingQuotes(source)), '--json'];
  pushOptionalArg(delegatedArgs, '--render-report', args.renderReport, root, true);
  pushOptionalArg(delegatedArgs, '--confirmation-text', args.confirmationText, root);
  pushOptionalArg(delegatedArgs, '--confirmation-text-file', args.confirmationTextFile, root, true);
  pushOptionalArg(
    delegatedArgs,
    '--confirmed-by',
    args.confirmedBy ?? 'main-agent-orchestration',
    root
  );
  pushOptionalArg(delegatedArgs, '--confirmed-at', args.confirmedAt, root);
  pushOptionalArg(delegatedArgs, '--record-id', args.recordId, root);
  pushOptionalArg(delegatedArgs, '--requirement-set-id', args.requirementSetId, root);
  pushOptionalArg(delegatedArgs, '--runtime-root', args.runtimeRoot, root, true);
  pushOptionalArg(delegatedArgs, '--requirement-record', args.requirementRecord, root, true);
  pushOptionalArg(delegatedArgs, '--event-log', args.eventLog, root, true);
  pushOptionalArg(delegatedArgs, '--artifact-index', args.artifactIndex, root, true);
  pushOptionalArg(delegatedArgs, '--update-source', args.updateSource, root);

  const step = spawnSync(process.execPath, [entry, ...delegatedArgs], {
    cwd: root,
    encoding: 'utf8',
  });
  let parsedStdout: unknown = undefined;
  if (step.stdout.trim()) {
    try {
      parsedStdout = JSON.parse(step.stdout);
    } catch {
      parsedStdout = step.stdout.trim();
    }
  }
  return {
    ok: step.status === 0,
    action: 'confirm-scope',
    delegatedEntry: path.relative(root, entry).replace(/\\/g, '/'),
    exitCode: step.status ?? 2,
    ...(parsedStdout !== undefined ? { stdout: parsedStdout } : {}),
    ...(step.stderr.trim() ? { stderr: step.stderr.trim() } : {}),
    mainAgentStageSummary: stageSummaryForCommandResult(root, args, parsedStdout),
  };
}

export function runMainAgentConfirmationBookkeepingRepair(
  root: string,
  args: Record<string, string | undefined>
): MainAgentConfirmScopeResult {
  const entry = resolveSkillScript(root, 'confirm-requirements-scope.js');
  if (!fs.existsSync(entry)) {
    throw new Error(`controlled confirmation repair entry missing: ${entry}`);
  }
  const source = normalizeText(args.source);
  if (!source) {
    throw new Error('repair-confirmation-bookkeeping requires --source <source-document.md>');
  }
  const requirementRecord = normalizeText(args.requirementRecord);
  if (!requirementRecord) {
    throw new Error('repair-confirmation-bookkeeping requires --requirement-record <path>');
  }

  const delegatedArgs = [
    '--action',
    'repair-bookkeeping',
    '--source',
    path.resolve(root, stripWrappingQuotes(source)),
    '--requirement-record',
    path.resolve(root, stripWrappingQuotes(requirementRecord)),
    '--confirmed-by',
    args.confirmedBy ?? 'main-agent-orchestration',
    '--json',
  ];
  pushOptionalArg(delegatedArgs, '--confirmed-at', args.confirmedAt, root);
  pushOptionalArg(delegatedArgs, '--record-id', args.recordId, root);
  pushOptionalArg(delegatedArgs, '--requirement-set-id', args.requirementSetId, root);
  pushOptionalArg(delegatedArgs, '--event-log', args.eventLog, root, true);
  pushOptionalArg(delegatedArgs, '--artifact-index', args.artifactIndex, root, true);
  pushOptionalArg(delegatedArgs, '--update-source', args.updateSource, root);

  const step = spawnSync(process.execPath, [entry, ...delegatedArgs], {
    cwd: root,
    encoding: 'utf8',
  });
  let parsedStdout: unknown = undefined;
  if (step.stdout.trim()) {
    try {
      parsedStdout = JSON.parse(step.stdout);
    } catch {
      parsedStdout = step.stdout.trim();
    }
  }
  return {
    ok: step.status === 0,
    action: 'repair-confirmation-bookkeeping',
    delegatedEntry: path.relative(root, entry).replace(/\\/g, '/'),
    exitCode: step.status ?? 2,
    ...(parsedStdout !== undefined ? { stdout: parsedStdout } : {}),
    ...(step.stderr.trim() ? { stderr: step.stderr.trim() } : {}),
    mainAgentStageSummary: stageSummaryForCommandResult(root, args, parsedStdout),
  };
}

function loadConfirmationDriftClassifier(root: string): {
  classifyConfirmationDrift: (input: Record<string, unknown>) => Record<string, unknown>;
} {
  const classifierPath = resolveSkillScript(root, 'confirmation_drift_classifier.js');
  if (!fs.existsSync(classifierPath)) {
    throw new Error(`confirmation drift classifier missing: ${classifierPath}`);
  }
  return requireCommonJs(classifierPath) as {
    classifyConfirmationDrift: (input: Record<string, unknown>) => Record<string, unknown>;
  };
}

function currentConfirmationHashes(sourcePath: string): {
  confirmation: Record<string, unknown>;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extraction = extractImplementationConfirmationBlock(sourceText);
  if (!extraction) {
    throw new Error(`implementationConfirmation block missing: ${sourcePath}`);
  }
  return {
    confirmation: extraction.confirmation,
    sourceDocumentHash: sourceDocumentHashForPreConfirmation(
      sourceText,
      extraction.blockText,
      extraction.confirmation
    ),
    implementationConfirmationHash: implementationConfirmationHashForPreConfirmation(
      extraction.confirmation
    ),
  };
}

function confirmationTextFromRenderReport(report: Record<string, unknown>): string {
  const sourceDocumentHash = normalizeText(report.sourceDocumentHash);
  const implementationConfirmationHash = normalizeText(report.implementationConfirmationHash);
  const confirmationPageHash = normalizeText(report.confirmationPageHash);
  if (!sourceDocumentHash || !implementationConfirmationHash || !confirmationPageHash) {
    throw new Error('route-confirmation-drift projection refresh requires render report hashes');
  }
  return [
    `sourceDocumentHash=${sourceDocumentHash}`,
    `implementationConfirmationHash=${implementationConfirmationHash}`,
    `confirmationPageHash=${confirmationPageHash}`,
  ].join('\n');
}

export function runMainAgentConfirmationDriftRoute(
  root: string,
  args: Record<string, string | undefined>
): MainAgentConfirmScopeResult {
  const source = normalizeText(args.source);
  if (!source) {
    throw new Error('route-confirmation-drift requires --source <source-document.md>');
  }
  const requirementRecord = normalizeText(args.requirementRecord);
  if (!requirementRecord) {
    throw new Error('route-confirmation-drift requires --requirement-record <path>');
  }
  const sourcePath = path.resolve(root, stripWrappingQuotes(source));
  const recordPath = path.resolve(root, stripWrappingQuotes(requirementRecord));
  const record = fs.existsSync(recordPath) ? (readJsonIfExists(recordPath) ?? {}) : {};
  const renderReportPath = normalizeText(args.renderReport)
    ? path.resolve(root, stripWrappingQuotes(normalizeText(args.renderReport)))
    : null;
  const renderReport = renderReportPath ? (readJsonIfExists(renderReportPath) ?? {}) : {};
  const hashes = currentConfirmationHashes(sourcePath);
  const { classifyConfirmationDrift } = loadConfirmationDriftClassifier(root);
  const classification = classifyConfirmationDrift({
    confirmation: hashes.confirmation,
    requirementRecord: record,
    renderReport,
    currentHashes: {
      sourceDocumentHash: hashes.sourceDocumentHash,
      implementationConfirmationHash: hashes.implementationConfirmationHash,
    },
  });
  const kind = normalizeText(classification.kind);

  if (kind === 'confirmed_current') {
    return {
      ok: true,
      action: 'route-confirmation-drift',
      delegatedEntry: path
        .relative(root, resolveSkillScript(root, 'confirmation_drift_classifier.js'))
        .replace(/\\/g, '/'),
      exitCode: 0,
      route: 'confirmed_current',
      classification,
    };
  }

  if (kind === 'stale_bookkeeping_repair_required') {
    const delegatedResult = runMainAgentConfirmationBookkeepingRepair(root, args);
    return {
      ok: delegatedResult.ok,
      action: 'route-confirmation-drift',
      delegatedEntry: delegatedResult.delegatedEntry,
      exitCode: delegatedResult.exitCode,
      route: 'bookkeeping_repair',
      classification,
      delegatedResult,
    };
  }

  if (kind === 'projection_refresh_required') {
    if (!renderReportPath) {
      return {
        ok: false,
        action: 'route-confirmation-drift',
        delegatedEntry: path
          .relative(root, resolveSkillScript(root, 'confirm-requirements-scope.js'))
          .replace(/\\/g, '/'),
        exitCode: 3,
        route: 'projection_refresh',
        block: 'PROJECTION_REFRESH_RENDER_REPORT_REQUIRED',
        classification,
      };
    }
    const priorProjectionHash =
      normalizeText(classification.latestProjectionHash) ||
      normalizeText(
        (record as { latestConfirmationProjectionHash?: unknown }).latestConfirmationProjectionHash
      ) ||
      normalizeText((record as { confirmationPageHash?: unknown }).confirmationPageHash);
    if (!priorProjectionHash) {
      return {
        ok: false,
        action: 'route-confirmation-drift',
        delegatedEntry: path
          .relative(root, resolveSkillScript(root, 'confirm-requirements-scope.js'))
          .replace(/\\/g, '/'),
        exitCode: 3,
        route: 'projection_refresh',
        block: 'PROJECTION_REFRESH_PRIOR_PROJECTION_HASH_REQUIRED',
        classification,
      };
    }
    const delegatedResult = runMainAgentConfirmScope(root, {
      ...args,
      renderReport: renderReportPath,
      confirmationText: confirmationTextFromRenderReport({
        ...renderReport,
        confirmationPageHash: priorProjectionHash,
      }),
      updateSource: 'false',
    });
    return {
      ok: delegatedResult.ok,
      action: 'route-confirmation-drift',
      delegatedEntry: delegatedResult.delegatedEntry,
      exitCode: delegatedResult.exitCode,
      route: 'projection_refresh',
      classification,
      delegatedResult,
    };
  }

  if (kind === 'semantic_reconfirmation_required') {
    const reconfirmation = requestSemanticReconfirmation({
      recordPath,
      classification,
      recordedBy: 'main-agent-reconfirmation-router',
    });
    return {
      ok: false,
      action: 'route-confirmation-drift',
      delegatedEntry: path
        .relative(root, resolveSkillScript(root, 'confirmation_drift_classifier.js'))
        .replace(/\\/g, '/'),
      exitCode: 3,
      route: 'semantic_reconfirmation_required',
      block: 'CONFIRMATION_REQUIRED',
      nextRequiredAction: 'await_exact_confirmation_phrase_with_hashes',
      requestId: reconfirmation.requestId,
      eventId: reconfirmation.eventId,
      rollbackEventId: reconfirmation.rollbackEventId,
      receiptPath: reconfirmation.receiptPath,
      eventLogPath: reconfirmation.eventLogPath,
      requirementRecordIndexPath: reconfirmation.indexPath,
      reusedExistingRequest: reconfirmation.reusedExistingRequest,
      classification,
    };
  }

  return {
    ok: false,
    action: 'route-confirmation-drift',
    delegatedEntry: path
      .relative(root, resolveSkillScript(root, 'confirmation_drift_classifier.js'))
      .replace(/\\/g, '/'),
    exitCode: 3,
    route: 'unknown',
    block: 'UNKNOWN_CONFIRMATION_DRIFT_CLASSIFICATION',
    classification,
  };
}

export async function runMainAgentControlledReadinessAudit(
  root: string,
  args: Record<string, string | undefined>
): Promise<Awaited<ReturnType<typeof runControlledReadinessAuditBridge>>> {
  const loaded = loadPolicyContextFromRegistry(root, {
    recordId: args.recordId,
    requirementSetId: args.requirementSetId,
    runId: args.runId,
  });
  return runControlledReadinessAuditBridge({
    root,
    recordPath: loaded.resolvedRuntimeContext.recordPath,
    dataPath: normalizeText(args.dataPath) || undefined,
    scoringRunId: normalizeText(args.scoringRunId) || undefined,
  });
}

function resolveFlowAndStage(
  root: string,
  args: Record<string, string | undefined>
): { flow: RuntimeFlowId | null; stage: string | null; noActiveRequirement: boolean } {
  const explicitFlow = normalizeText(args.flow);
  const explicitStage = normalizeText(args.stage);
  if (explicitFlow && explicitStage) {
    return {
      flow: explicitFlow as RuntimeFlowId,
      stage: explicitStage,
      noActiveRequirement: false,
    };
  }
  try {
    const runtimeContext = loadPolicyContextFromRegistry(root, {
      recordId: args.recordId,
      requirementSetId: args.requirementSetId,
      runId: args.runId,
    }).runtimeContext;
    const flow = explicitFlow || runtimeContext.flow;
    const stage = explicitStage || runtimeContext.stage;
    return {
      flow: flow as RuntimeFlowId,
      stage,
      noActiveRequirement: false,
    };
  } catch (error) {
    if (!isNoActiveRequirementError(error)) {
      throw error;
    }
    return {
      flow: explicitFlow ? (explicitFlow as RuntimeFlowId) : null,
      stage: explicitStage || null,
      noActiveRequirement: true,
    };
  }
}

function buildNoActiveRequirementRunLoopResult(
  root: string,
  flow: RuntimeFlowId | null,
  stage: string | null
): MainAgentRunLoopResult {
  const surface = resolveMainAgentOrchestrationSurface({
    projectRoot: root,
    flow: flow ?? ('story' as RuntimeFlowId),
    stage: stage ?? 'requirement_confirmation',
  });
  return {
    runId: `main-agent-run-loop-${Date.now()}`,
    status: 'blocked',
    steps: [
      {
        step: 'inspect.initial',
        status: 'fail',
        summary: 'NO_ACTIVE_REQUIREMENT: contract_authoring_required',
      },
    ],
    dispatchInstruction: null,
    taskReport: null,
    finalSurface: surface,
    mainAgentStageSummary: surface.mainAgentStageSummary,
  };
}

function parseOrchestrationHost(value: string | undefined): OrchestrationHost | undefined {
  const normalized = normalizeText(value);
  if (normalized === 'cursor' || normalized === 'claude' || normalized === 'codex') {
    return normalized;
  }
  return undefined;
}

function resolveSessionAndPacketFromSurface(
  surface: MainAgentOrchestrationSurface,
  args: Record<string, string | undefined>
): { sessionId: string; packetId: string } {
  const sessionId = normalizeText(args.sessionId) || normalizeText(surface.sessionId);
  const packetId =
    normalizeText(args.packetId) ||
    normalizeText(surface.orchestrationState?.pendingPacket?.packetId);
  if (!sessionId || !packetId) {
    throw new Error('sessionId and packetId are required for packet lifecycle actions');
  }
  return { sessionId, packetId };
}

function parseTaskReportStatus(value: string | undefined): TaskReport['status'] {
  const normalized = normalizeText(value);
  if (normalized === 'blocked' || normalized === 'partial') {
    return normalized;
  }
  return 'done';
}

function validateTaskReportShape(value: unknown): value is TaskReport {
  const report = value as Partial<TaskReport>;
  return (
    typeof report?.packetId === 'string' &&
    (report.status === 'done' || report.status === 'blocked' || report.status === 'partial') &&
    Array.isArray(report.filesChanged) &&
    Array.isArray(report.validationsRun) &&
    Array.isArray(report.evidence) &&
    Array.isArray(report.downstreamContext)
  );
}

function readTaskReportFromFile(reportPath: string, packetId: string): TaskReport {
  const resolved = path.resolve(reportPath);
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown;
  if (!validateTaskReportShape(parsed)) {
    throw new Error(`Invalid task report shape: ${resolved}`);
  }
  if (parsed.packetId !== packetId) {
    throw new Error(`Task report packetId mismatch: expected ${packetId}, got ${parsed.packetId}`);
  }
  return parsed;
}

function readTaskReportPacketId(reportPath: string | undefined): string | null {
  const normalized = normalizeText(reportPath);
  if (!normalized || !fs.existsSync(normalized)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(path.resolve(normalized), 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return normalizeText((parsed as { packetId?: unknown }).packetId) || null;
  } catch {
    return null;
  }
}

function controlledIngestCodexWorkerEvidence(input: {
  recordPath: string | null;
  adapterReport: CodexWorkerAdapterReport;
  recordedAt: string;
}): string[] {
  if (!input.recordPath) return [];
  const envelope = input.adapterReport.subagentEvidenceEnvelope;
  const validation = input.adapterReport.subagentEvidenceEnvelopeValidation;
  const record = readJsonIfExists(input.recordPath) ?? {};
  const recordId = normalizeText(record.recordId);
  const requirementSetId = normalizeText(record.requirementSetId) || recordId;
  const sourceRefs = validation.sourceRefs.length
    ? validation.sourceRefs
    : [{ sourceType: 'execution_packet', id: input.adapterReport.taskReport.packetId }];
  const artifactRefs = validation.evidenceArtifactRefs;
  const events: string[] = [];
  if (envelope && validation.ok) {
    const subagentEvent = {
      eventType: 'subagent_evidence_envelope_recorded',
      recordId,
      requirementSetId,
      executionIterationId: `${input.adapterReport.taskReport.packetId}:subagent-evidence-envelope`,
      runId: input.adapterReport.taskReport.packetId,
      status: validation.status,
      subagentEvidenceEnvelope: envelope,
      subagentEvidenceEnvelopeHash: validation.envelopeHash,
      traceRows: Array.isArray(envelope.traceRows) ? envelope.traceRows : [],
      taskRefs: Array.isArray(envelope.taskRefs) ? envelope.taskRefs : [],
      evidenceRefs: input.adapterReport.taskReport.evidence,
      coveredRequirementIds: Array.isArray(envelope.coveredRequirementIds)
        ? envelope.coveredRequirementIds
        : [],
      commandRunRefs: Array.isArray(envelope.commandRuns) ? envelope.commandRuns : [],
      evidenceArtifactRefs: artifactRefs,
      sourceRefs,
      sourceDocumentHash: normalizeText(envelope.sourceDocumentHash),
      implementationConfirmationHash: normalizeText(envelope.implementationConfirmationHash),
      architectureConfirmationHash: normalizeText(envelope.architectureConfirmationHash),
      recordedAt: input.recordedAt,
      recordedBy: 'main-agent-orchestration',
    };
    const commit = appendControlEventAndReplay({
      recordPath: input.recordPath,
      writerId: 'main-agent-orchestration',
      eventType: 'subagent_evidence_envelope_recorded',
      payload: subagentEvent,
      recordedAt: input.recordedAt,
      reduce: (current) => ({
        ...current,
        executionIterations: [...objectsFrom(current.executionIterations), subagentEvent],
        lastEventType: 'subagent_evidence_envelope_recorded',
        updatedAt: input.recordedAt,
      }),
    });
    events.push(commit.event.eventId);
    for (const artifact of artifactRefs) {
      const artifactEvent = {
        ...artifact,
        eventType: 'artifact_indexed',
        recordId,
        requirementSetId,
      };
      const artifactCommit = appendControlEventAndReplay({
        recordPath: input.recordPath,
        writerId: 'main-agent-orchestration',
        eventType: 'artifact_indexed',
        payload: artifactEvent,
        recordedAt: input.recordedAt,
        reduce: (current) => ({
          ...current,
          artifactIndex: [...objectsFrom(current.artifactIndex), artifactEvent],
          lastEventType: 'artifact_indexed',
          updatedAt: input.recordedAt,
        }),
      });
      events.push(artifactCommit.event.eventId);
    }
  }
  const executionEvent = {
    eventType: 'execution_iteration_recorded',
    recordId,
    requirementSetId,
    executionIterationId: input.adapterReport.taskReport.packetId,
    runId: input.adapterReport.taskReport.packetId,
    status: input.adapterReport.taskReport.status,
    traceRows: envelope && Array.isArray(envelope.traceRows) ? envelope.traceRows : [],
    taskRefs: envelope && Array.isArray(envelope.taskRefs) ? envelope.taskRefs : [],
    evidenceRefs: input.adapterReport.taskReport.evidence,
    filesChanged: input.adapterReport.taskReport.filesChanged,
    diffSummary:
      'Codex worker TaskReport ingested as iteration evidence only; not terminal closeout.',
    commandRunRefs: envelope && Array.isArray(envelope.commandRuns) ? envelope.commandRuns : [],
    evidenceArtifactRefs: artifactRefs,
    sourceRefs,
    sourceDocumentHash: normalizeText(record.sourceDocumentHash),
    implementationConfirmationHash: normalizeText(record.implementationConfirmationHash),
    architectureConfirmationHash: normalizeText(
      (record.architectureConfirmationState as Record<string, unknown> | undefined)
        ?.currentArchitectureConfirmationHash
    ),
    recordedAt: input.recordedAt,
    recordedBy: 'main-agent-orchestration',
  };
  const iterationCommit = appendControlEventAndReplay({
    recordPath: input.recordPath,
    writerId: 'main-agent-orchestration',
    eventType: 'execution_iteration_recorded',
    payload: executionEvent,
    recordedAt: input.recordedAt,
    reduce: (current) => ({
      ...current,
      executionIterations: [...objectsFrom(current.executionIterations), executionEvent],
      lastEventType: 'execution_iteration_recorded',
      updatedAt: input.recordedAt,
    }),
  });
  events.push(iterationCommit.event.eventId);
  return events;
}

export function writeMainAgentRunLoopTaskReport(
  projectRoot: string,
  instruction: MainAgentDispatchInstruction,
  args: Record<string, string | undefined> = {}
): string {
  const evidence = normalizeText(args.reportEvidence)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const report: TaskReport = {
    packetId: instruction.packetId,
    status: parseTaskReportStatus(args.reportStatus),
    filesChanged: normalizeText(args.filesChanged)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    validationsRun: normalizeText(args.validationsRun)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    evidence: evidence.length > 0 ? evidence : [instruction.packetPath],
    downstreamContext: [instruction.expectedDelta],
  };
  if (report.validationsRun.length === 0) {
    report.validationsRun.push('main-agent:run-loop-task-report');
  }
  const reportPath = path.resolve(
    args.taskReportPath ??
      path.join(
        projectRoot,
        '_bmad-output',
        'runtime',
        'governance',
        'task-reports',
        instruction.sessionId,
        `${instruction.packetId}.json`
      )
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return reportPath;
}

function latestImplementationReadinessGate(
  record: Record<string, unknown> | null
): Record<string, unknown> | null {
  const gates = latestGateChecks(record?.gateChecks).filter(
    (gate) => normalizeText(gate.gate) === 'Implementation Readiness Gate'
  );
  return gates.length > 0 ? gates[gates.length - 1] : null;
}

function readReadinessReport(
  recordPath: string,
  args: Record<string, string | undefined>
): Record<string, unknown> | null {
  const explicit = normalizeText(args.readinessReportPath);
  const reportPath = explicit
    ? path.resolve(explicit)
    : path.join(path.dirname(recordPath), 'implementation-readiness-report.json');
  return readJsonIfExists(reportPath);
}

function stringsFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeText(item)).filter(Boolean);
}

function objectsFrom(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function latestReadinessBlockers(
  record: Record<string, unknown> | null,
  report: Record<string, unknown> | null
): string[] {
  const fromReport = stringsFrom(report?.blockingReasons);
  if (fromReport.length > 0) return Array.from(new Set(fromReport));
  return Array.from(
    new Set(stringsFrom(latestImplementationReadinessGate(record)?.blockingReasons))
  );
}

function deriveReadinessAction(input: {
  blocker: string;
  action: string;
  reason: string;
  reasonCode: string;
  target?: string;
}): ReadinessRemediationAction {
  return {
    blocker: input.blocker,
    schemaVersion: 'readiness-blocker-classification/v1',
    classification: 'derive_without_reconfirm',
    sourceAuthorityImpact: 'proof_or_projection',
    autoRemediationAllowed: true,
    requiredNextAction: 'run_deterministic_projection_repair',
    action: input.action,
    ...(input.target ? { target: input.target } : {}),
    reason: input.reason,
    reasonCode: input.reasonCode,
  };
}

function sourceAmendmentReadinessAction(
  blocker: string,
  reasonCode = 'source_authority_blocker_requires_amendment',
  reason = 'blocker affects confirmed execution contract semantics or authority'
): ReadinessRemediationAction {
  return {
    blocker,
    schemaVersion: 'readiness-blocker-classification/v1',
    classification: 'requires_source_amendment',
    sourceAuthorityImpact: 'source_authority',
    autoRemediationAllowed: false,
    requiredNextAction: 'source_amendment_required',
    action: 'block_for_source_amendment',
    reason,
    reasonCode,
  };
}

function userDecisionReadinessAction(
  blocker: string,
  reasonCode = 'multiple_equal_candidates_require_user_decision',
  reason = 'confirmed source does not select one candidate among multiple equal valid candidates'
): ReadinessRemediationAction {
  return {
    blocker,
    schemaVersion: 'readiness-blocker-classification/v1',
    classification: 'requires_user_decision',
    sourceAuthorityImpact: 'ambiguous_source_authority',
    autoRemediationAllowed: false,
    requiredNextAction: 'blocked_by_unresolved_user_decision',
    action: 'block_for_user_decision',
    reason,
    reasonCode,
  };
}

function blockerHasMultipleEqualCandidates(blocker: string): boolean {
  return (
    blocker.includes(':multiple_equal_candidates') ||
    blocker.includes(':ambiguous_candidates') ||
    blocker.includes(':ambiguous') ||
    blocker.startsWith('multiple_equal_candidate:')
  );
}

function readinessBlockerBaseId(blocker: string): string {
  const normalized = normalizeText(blocker);
  if (normalized.startsWith('multiple_equal_candidate:')) {
    return normalized.slice('multiple_equal_candidate:'.length);
  }
  for (const suffix of [':multiple_equal_candidates', ':ambiguous_candidates', ':ambiguous']) {
    if (normalized.endsWith(suffix)) return normalized.slice(0, -suffix.length);
  }
  return normalized;
}

function classifyReadinessBlocker(blocker: string): ReadinessRemediationAction {
  const blockerId = normalizeText(blocker);
  const baseBlocker = readinessBlockerBaseId(blockerId);
  const hasMultipleEqualCandidates = blockerHasMultipleEqualCandidates(blockerId);

  if (baseBlocker.startsWith('required_command_file_missing:')) {
    return deriveReadinessAction({
      blocker: blockerId,
      action: 'create_expected_red_adapter_test',
      target: baseBlocker.slice('required_command_file_missing:'.length),
      reason: 'missing command target file can be created without changing requirement semantics',
      reasonCode: 'missing_command_file_derivable_from_manifest',
    });
  }
  if (baseBlocker === 'ai_tdd_pre_implementation_readiness_not_ready') {
    return deriveReadinessAction({
      blocker: blockerId,
      action: 'rerun_after_child_ai_tdd_repairs',
      reason: 'summary blocker is resolved by repairing concrete AI-TDD blockers',
      reasonCode: 'summary_blocker_resolved_by_child_derive_repairs',
    });
  }
  if (baseBlocker === 'PRE_CONFIRMATION_DRILLDOWN_REQUIRED') {
    return deriveReadinessAction({
      blocker: blockerId,
      action: 'regenerate_pre_confirmation_drilldown_artifacts',
      reason:
        'pre-confirmation drilldown is a proof artifact projection for current confirmed source',
      reasonCode: 'proof_artifact_regeneration_allowed',
    });
  }
  if (baseBlocker === 'PACKET_SOURCE_RECONCILIATION_REQUIRED') {
    return deriveReadinessAction({
      blocker: blockerId,
      action: 'rerun_packet_source_reconciliation',
      reason:
        'missing or stale reconciliation report can be rerun without changing source semantics',
      reasonCode: 'reconciliation_report_rerun_allowed',
    });
  }
  if (baseBlocker === 'PACKET_SOURCE_RECONCILIATION_FAILED') {
    return sourceAmendmentReadinessAction(
      blockerId,
      'reconciliation_failed_requires_source_amendment',
      'packet/source reconciliation failure indicates source and packet drift'
    );
  }
  if (baseBlocker === 'PRE_RENDER_GATE_REPORT_REQUIRED') {
    return deriveReadinessAction({
      blocker: blockerId,
      action: 'rerun_pre_render_gate',
      reason:
        'missing or stale pre-render gate report can be rerun without changing source semantics',
      reasonCode: 'pre_render_report_rerun_allowed',
    });
  }
  if (
    baseBlocker === 'ATOMIC_TASK_LINEAGE_REQUIRED' ||
    baseBlocker === 'MANIFEST_SECTION_REQUIRED:atomicImplementationTaskLineage'
  ) {
    if (hasMultipleEqualCandidates) return userDecisionReadinessAction(blockerId);
    return deriveReadinessAction({
      blocker: blockerId,
      action: 'materialize_existing_atomic_task_lineage',
      reason:
        'existing deterministic atomic packet lineage can be materialized for current confirmed source',
      reasonCode: 'existing_atomic_lineage_materialization_allowed',
    });
  }
  if (
    [
      'MANIFEST_SECTION_REQUIRED:preConfirmationDrilldownInputs',
      'MANIFEST_SECTION_REQUIRED:legacyDenial',
      'MANIFEST_SECTION_REQUIRED:executionLoopProtocol',
      'MANIFEST_SECTION_REQUIRED:semanticGapPolicy',
      'MANIFEST_SECTION_REQUIRED:evidenceTrustStates',
    ].includes(baseBlocker)
  ) {
    return deriveReadinessAction({
      blocker: blockerId,
      action: 'materialize_policy_or_projection_section',
      reason: 'manifest section is policy or projection materialization, not source semantics',
      reasonCode: 'manifest_policy_projection_materialization_allowed',
    });
  }
  if (baseBlocker === 'MANIFEST_SECTION_REQUIRED:hostExecutionHints') {
    if (hasMultipleEqualCandidates) return userDecisionReadinessAction(blockerId);
    return deriveReadinessAction({
      blocker: blockerId,
      action: 'materialize_host_execution_hints',
      reason: 'host selection already exists in main-agent input',
      reasonCode: 'host_selection_materialization_allowed',
    });
  }
  if (baseBlocker === 'AI_TDD_MANIFEST_REQUIRED') {
    return sourceAmendmentReadinessAction(
      blockerId,
      'ai_tdd_manifest_root_blocker_requires_section_detail',
      'AI_TDD_MANIFEST_REQUIRED must be classified by concrete missing manifest sections'
    );
  }
  if (
    [
      'MANIFEST_SECTION_REQUIRED:finalGateMatrix',
      'MANIFEST_SECTION_REQUIRED:canonicalSurfaceReconciliation',
      'MANIFEST_SECTION_REQUIRED:closeoutProof',
      'MANIFEST_SECTION_REQUIRED:errorCaseCoverage',
      'MANIFEST_SECTION_REQUIRED:traceClosureAssertions',
      'MANIFEST_SECTION_REQUIRED:commandTargets',
      'MANIFEST_SECTION_REQUIRED:currentTargetMap',
    ].includes(baseBlocker)
  ) {
    if (hasMultipleEqualCandidates) return userDecisionReadinessAction(blockerId);
    return sourceAmendmentReadinessAction(
      blockerId,
      'authority_or_relation_manifest_section_requires_source_amendment',
      'manifest section can affect source authority, target authority, command authority, artifact authority, or relation bindings'
    );
  }
  if (
    baseBlocker.startsWith('PRE_IMPLEMENTATION_RED_PROOF_PLAN_REQUIRED:') ||
    baseBlocker.startsWith('FAILURE_PATH_BINDING_REQUIRED:TRACE-') ||
    baseBlocker.startsWith('EDGE_CASE_BINDING_REQUIRED:TRACE-') ||
    baseBlocker.startsWith('ERROR_CASE_CLOSURE_INCOMPLETE:FAIL-') ||
    baseBlocker.startsWith('ERROR_CASE_CLOSURE_INCOMPLETE:EDGE-')
  ) {
    if (hasMultipleEqualCandidates) return userDecisionReadinessAction(blockerId);
    return sourceAmendmentReadinessAction(
      blockerId,
      'relation_or_red_proof_requires_source_amendment',
      'missing relation or expected-red proof plan belongs to confirmed source execution contract'
    );
  }
  if (
    [
      'requirement_pre_implementation_missing_plan',
      'pre_implementation_red_proof_missing',
      'pre_implementation_valid_expected_red_missing',
      'trace_acceptance_binding_missing',
      'artifact_ref_missing',
      'command_target_refs_missing',
      'artifact_refs_missing',
      'current_target_map_refs_missing',
      'orphan_evidence',
      'orphan_command',
      'orphan_artifact',
      'missing_test_plan_blocked',
      'target_artifact_plan_blocked',
      'negative_control_plan_blocked',
      'contract_completeness_report_blocked',
      'acceptance_or_e2e_coverage_missing',
      'stage_audit_requirement_missing_acceptance_or_e2e_coverage',
    ].includes(baseBlocker)
  ) {
    if (hasMultipleEqualCandidates) return userDecisionReadinessAction(blockerId);
    return sourceAmendmentReadinessAction(blockerId);
  }
  if (baseBlocker.includes('commandTargets -> commandTargetCollection')) {
    return deriveReadinessAction({
      blocker: blockerId,
      action: 'normalize_equal_command_target_alias',
      reason: 'canonical alias normalization is allowed only when authority is unchanged',
      reasonCode: 'equal_alias_normalization_allowed',
    });
  }
  return sourceAmendmentReadinessAction(
    blockerId,
    'unknown_blocker_fail_closed',
    'blocker has no deterministic non-semantic repair mapping'
  );
}

function classifyReadinessBlockers(blockers: string[]): ReadinessRemediationAction[] {
  const uniqueBlockers = Array.from(new Set(blockers.map(normalizeText).filter(Boolean)));
  const hasMissingTestRoot = uniqueBlockers.some(
    (blocker) =>
      blocker.startsWith('required_command_file_missing:') ||
      [
        'acceptance_test_file_missing',
        'stage_audit_acceptance_test_file_missing',
        'requirement_pre_implementation_missing_test',
      ].includes(blocker)
  );
  const stageAuditBlockers = uniqueBlockers.filter((blocker) => blocker.startsWith('stage_audit_'));
  const stageAuditOnlyMissingTest =
    stageAuditBlockers.length > 0 &&
    stageAuditBlockers.every((blocker) => blocker === 'stage_audit_acceptance_test_file_missing');

  return uniqueBlockers.map((blocker) => {
    if (
      hasMissingTestRoot &&
      [
        'acceptance_test_file_missing',
        'stage_audit_acceptance_test_file_missing',
        'requirement_pre_implementation_missing_test',
      ].includes(blocker)
    ) {
      return deriveReadinessAction({
        blocker,
        action: 'create_missing_acceptance_files_from_manifest',
        reason:
          'missing expected-red test files are uniquely declared by the confirmed AI-TDD manifest',
        reasonCode: 'missing_expected_red_files_derivable_from_manifest',
      });
    }
    if (
      hasMissingTestRoot &&
      [
        'missing_test_plan_blocked',
        'requirement_pre_implementation_missing_plan',
        'trace_acceptance_binding_missing',
      ].includes(blocker)
    ) {
      return classifyReadinessBlocker(blocker);
    }
    if (blocker === 'implementation_readiness_stage_audit_failed' && stageAuditOnlyMissingTest) {
      return deriveReadinessAction({
        blocker,
        action: 'rerun_after_child_ai_tdd_repairs',
        reason: 'stage audit failure is fully explained by missing expected-red test files',
        reasonCode: 'stage_audit_missing_test_child_blocker_derivable',
      });
    }
    return classifyReadinessBlocker(blocker);
  });
}

function resolveProjectPath(root: string, candidate: string): string {
  const normalized = normalizeText(candidate);
  if (!normalized) return root;
  return path.isAbsolute(normalized) ? normalized : path.resolve(root, normalized);
}

type PostCloseIntakeClassification =
  | 'implementation_defect'
  | 'missing_scope'
  | 'architecture_drift'
  | 'closeout_proof_defect'
  | 'production_regression'
  | 'post_close_revalidation_required'
  | 'no_post_close_action_required';

interface PostCloseArtifactSnapshot {
  artifactId: string;
  path: string;
  absolutePath: string;
  previousHash: string;
  previousArtifactEvidenceRefs: string[];
  previousSource: string;
}

interface PostCloseChangedTargetArtifact extends PostCloseArtifactSnapshot {
  currentHash: string | null;
  missing: boolean;
}

function toProjectRelativePath(root: string, candidate: string): string {
  const absolute = resolveProjectPath(root, candidate);
  return path.relative(root, absolute).replace(/\\/g, '/') || candidate.replace(/\\/g, '/');
}

function normalizeArtifactHash(value: unknown): string {
  return normalizeText(value);
}

function artifactSnapshotFromRow(input: {
  root: string;
  row: Record<string, unknown>;
  index: number;
  previousSource: string;
}): PostCloseArtifactSnapshot | null {
  const pathValue =
    normalizeText(input.row.path) ||
    normalizeText(input.row.filePath) ||
    normalizeText(input.row.absolutePath) ||
    normalizeText(input.row.pathOrField);
  const previousHash =
    normalizeArtifactHash(input.row.hash) ||
    normalizeArtifactHash(input.row.contentHash) ||
    normalizeArtifactHash(input.row.artifactHash) ||
    normalizeArtifactHash(input.row.previousHash);
  if (!pathValue || !previousHash) return null;
  const absolutePath = resolveProjectPath(input.root, pathValue);
  return {
    artifactId:
      normalizeText(input.row.artifactId) ||
      normalizeText(input.row.id) ||
      normalizeText(input.row.targetId) ||
      `TARGET-${String(input.index + 1).padStart(3, '0')}`,
    path: toProjectRelativePath(input.root, absolutePath),
    absolutePath,
    previousHash,
    previousArtifactEvidenceRefs: uniqueNonEmpty([
      ...stringsFrom(input.row.evidenceRefs),
      normalizeText(input.row.evidenceRef),
      normalizeText(input.row.path),
    ]),
    previousSource: input.previousSource,
  };
}

function currentCloseoutAttemptId(record: Record<string, unknown>): string {
  const closeout =
    record.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
      ? (record.closeout as Record<string, unknown>)
      : {};
  return normalizeText(closeout.currentAttemptId);
}

function readJsonlObjects(filePath: string): Record<string, unknown>[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        const parsed = JSON.parse(line) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    })
    .filter((item): item is Record<string, unknown> => item !== null);
}

function postCloseArtifactSnapshots(input: {
  root: string;
  record: Record<string, unknown>;
  recordPath: string;
  attemptId: string;
}): PostCloseArtifactSnapshot[] {
  const snapshots: PostCloseArtifactSnapshot[] = [];
  const closeoutEvidence =
    input.record.closeoutEvidence &&
    typeof input.record.closeoutEvidence === 'object' &&
    !Array.isArray(input.record.closeoutEvidence)
      ? (input.record.closeoutEvidence as Record<string, unknown>)
      : {};
  for (const [index, row] of objectsFrom(closeoutEvidence.targetArtifacts).entries()) {
    const snapshot = artifactSnapshotFromRow({
      root: input.root,
      row,
      index,
      previousSource: 'record.closeoutEvidence.targetArtifacts',
    });
    if (snapshot) snapshots.push(snapshot);
  }
  const artifactIndexPath = path.join(path.dirname(input.recordPath), 'artifact-index.jsonl');
  const artifactRows = readJsonlObjects(artifactIndexPath).filter((row) => {
    if (normalizeText(row.artifactType) !== 'target_file_snapshot') return false;
    const inputVersion = normalizeText(row.inputVersion);
    const outputVersion = normalizeText(row.outputVersion);
    return inputVersion === input.attemptId || outputVersion === input.attemptId;
  });
  for (const [index, row] of artifactRows.entries()) {
    const snapshot = artifactSnapshotFromRow({
      root: input.root,
      row,
      index: snapshots.length + index,
      previousSource: path.relative(input.root, artifactIndexPath).replace(/\\/g, '/'),
    });
    if (snapshot) snapshots.push(snapshot);
  }
  const deduped = new Map<string, PostCloseArtifactSnapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.path}:${snapshot.previousHash}`;
    if (!deduped.has(key)) {
      deduped.set(key, snapshot);
    }
  }
  return [...deduped.values()];
}

function changedPostCloseTargetArtifacts(
  snapshots: PostCloseArtifactSnapshot[]
): PostCloseChangedTargetArtifact[] {
  const changed: PostCloseChangedTargetArtifact[] = [];
  for (const snapshot of snapshots) {
    if (!fs.existsSync(snapshot.absolutePath)) {
      changed.push({ ...snapshot, currentHash: null, missing: true });
      continue;
    }
    const currentHash = sha256File(snapshot.absolutePath);
    if (currentHash !== snapshot.previousHash) {
      changed.push({ ...snapshot, currentHash, missing: false });
    }
  }
  return changed;
}

function hasCloseoutProofDefectSignal(
  record: Record<string, unknown>,
  explicitSignal: string
): boolean {
  if (
    [
      'closeout_proof_defect',
      'false_closeout_proof',
      'broken_gate_logic',
      'corrupted_provenance',
      'invalid_event_chain_replay',
      'untrusted_terminal_close_event',
      'closure_integrity_incident_required',
    ].includes(explicitSignal)
  ) {
    return true;
  }
  return objectsFrom(record.postCloseSignals).some((signal) =>
    [
      'closeout_proof_defect',
      'false_closeout_proof',
      'broken_gate_logic',
      'corrupted_provenance',
      'invalid_event_chain_replay',
      'untrusted_terminal_close_event',
    ].includes(normalizeText(signal.type) || normalizeText(signal.classification))
  );
}

function explicitPostCloseClassification(signal: string): PostCloseIntakeClassification | null {
  if (
    signal === 'implementation_defect' ||
    signal === 'missing_scope' ||
    signal === 'architecture_drift' ||
    signal === 'production_regression'
  ) {
    return signal;
  }
  return null;
}

function defaultRunId(recordId: string): string {
  return `post-close-revalidation-run-${recordId}-${new Date()
    .toISOString()
    .replace(/[-:]/gu, '')
    .replace(/\.\d{3}Z$/u, 'Z')}`;
}

function postCloseReportPath(input: {
  root: string;
  recordPath: string;
  recordId: string;
  runId: string;
  explicitReportPath?: string;
}): string {
  const explicit = normalizeText(input.explicitReportPath);
  if (explicit) return resolveProjectPath(input.root, stripWrappingQuotes(explicit));
  return path.join(path.dirname(input.recordPath), 'post-close', `${input.runId}.json`);
}

function gateReportRef(filePath: string, report: Record<string, unknown>): Record<string, unknown> {
  return {
    path: filePath.replace(/\\/g, '/'),
    hash: fs.existsSync(filePath) ? sha256File(filePath) : sha256Json(report),
    decision: normalizeText(report.decision),
    blockingReasons: stringsFrom(report.blockingReasons),
    reportType: normalizeText(report.reportType),
  };
}

function writeGateReport(
  filePath: string,
  report: Record<string, unknown>
): Record<string, unknown> {
  writeJsonUtf8(filePath, report);
  return gateReportRef(filePath, report);
}

function captureNestedMainOutput(fn: () => number): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const originalConsoleError = console.error;
  process.stdout.write = (chunk: string | Uint8Array) => {
    stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  };
  process.stderr.write = (chunk: string | Uint8Array) => {
    stderrChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  };
  console.error = (...args: unknown[]) => {
    stderrChunks.push(args.map((arg) => String(arg)).join(' '));
  };
  try {
    return { exitCode: fn(), stdout: stdoutChunks.join(''), stderr: stderrChunks.join('\n') };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    console.error = originalConsoleError;
  }
}

function postCloseCarrierControlRecordPath(reportDir: string): string {
  return path.join(reportDir, 'revalidation-carrier-control-record.json');
}

function preparePostCloseCarrierControlRecord(input: {
  originRecord: Record<string, unknown>;
  carrierRecordPath: string;
}): Record<string, unknown> {
  const carrierRecord = {
    ...input.originRecord,
    postCloseOriginRecord: {
      recordId: normalizeText(input.originRecord.recordId),
      requirementSetId: normalizeText(input.originRecord.requirementSetId),
      sourceDocumentHash: normalizeText(input.originRecord.sourceDocumentHash),
      implementationConfirmationHash: normalizeText(
        input.originRecord.implementationConfirmationHash
      ),
      closeoutAttemptId: currentCloseoutAttemptId(input.originRecord),
      carrierPolicy: 'post_close_revalidation_evidence_carrier_only',
      createsRequirementRecord: false,
    },
  };
  writeJsonUtf8(input.carrierRecordPath, carrierRecord);
  return carrierRecord;
}

function runPostCloseGateStack(input: {
  root: string;
  sourcePath: string;
  recordPath: string;
  record: Record<string, unknown>;
  attemptId: string;
  runId: string;
  reportDir: string;
}): { gateReports: Record<string, unknown>[]; blockingReasons: string[] } {
  fs.mkdirSync(input.reportDir, { recursive: true });
  const gateReports: Record<string, unknown>[] = [];
  const commandEvidenceDir = path.join(input.reportDir, 'required-command-evidence');
  const carrierRecordPath = postCloseCarrierControlRecordPath(input.reportDir);
  const carrierRecord = preparePostCloseCarrierControlRecord({
    originRecord: input.record,
    carrierRecordPath,
  });
  const commandRun = captureNestedMainOutput(() =>
    mainRunRequiredCommandsFromAiTddManifest([
      '--source',
      input.sourcePath,
      '--requirement-record',
      carrierRecordPath,
      '--mode',
      'closeout',
      '--attempt-id',
      input.attemptId,
      '--run-id',
      input.runId,
      '--evidence-dir',
      commandEvidenceDir,
      '--json',
    ])
  );
  gateReports.push({
    reportType: 'required_commands_from_ai_tdd_manifest',
    path: commandEvidenceDir.replace(/\\/g, '/'),
    carrierRecordPath: carrierRecordPath.replace(/\\/g, '/'),
    originRecordPath: input.recordPath.replace(/\\/g, '/'),
    decision: commandRun.exitCode === 0 ? 'pass' : 'blocked',
    exitCode: commandRun.exitCode,
    stdout: commandRun.stdout.trim(),
    stderr: commandRun.stderr.trim(),
    blockingReasons: commandRun.exitCode === 0 ? [] : ['required_commands_revalidation_failed'],
  });
  const updatedRecord = readJsonIfExists(carrierRecordPath) ?? carrierRecord;
  const targetReport = evaluateTargetArtifactRealization({
    sourcePath: input.sourcePath,
    record: updatedRecord,
    recordPath: carrierRecordPath,
    attemptId: input.attemptId,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: 'main-agent-orchestration:post-close-defect-intake',
  });
  gateReports.push(
    writeGateReport(
      path.join(input.reportDir, 'target-artifact-realization-report.json'),
      targetReport
    )
  );
  const strictReport = evaluateStrictCloseoutProof({
    sourcePath: input.sourcePath,
    record: updatedRecord,
    recordPath: carrierRecordPath,
    attemptId: input.attemptId,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: 'main-agent-orchestration:post-close-defect-intake',
  });
  gateReports.push(
    writeGateReport(path.join(input.reportDir, 'strict-closeout-proof-report.json'), strictReport)
  );
  const aiTddReport = evaluateAiTddContractGate({
    sourcePath: input.sourcePath,
    record: updatedRecord,
    recordPath: carrierRecordPath,
    mode: 'closeout',
    attemptId: input.attemptId,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: 'main-agent-orchestration:post-close-defect-intake',
  });
  gateReports.push(
    writeGateReport(
      path.join(input.reportDir, 'ai-tdd-contract-gate-closeout-report.json'),
      aiTddReport
    )
  );
  return {
    gateReports,
    blockingReasons: uniqueNonEmpty(
      gateReports.flatMap((report) =>
        normalizeText(report.decision) === 'pass'
          ? []
          : [
              normalizeText(report.reportType) || 'gate_report',
              ...stringsFrom(report.blockingReasons),
            ]
      )
    ),
  };
}

export function runMainAgentPostCloseDefectIntake(
  root: string,
  args: Record<string, string | undefined>
): Record<string, unknown> {
  const source = normalizeText(args.source);
  const requirementRecord = normalizeText(args.requirementRecord);
  if (!source) throw new Error('post-close-defect-intake requires --source <source-document.md>');
  if (!requirementRecord)
    throw new Error('post-close-defect-intake requires --requirement-record <path>');
  const sourcePath = resolveProjectPath(root, stripWrappingQuotes(source));
  const recordPath = resolveProjectPath(root, stripWrappingQuotes(requirementRecord));
  const record = readJsonIfExists(recordPath);
  if (!record) throw new Error(`requirement record missing or invalid: ${recordPath}`);
  const recordId = normalizeText(record.recordId) || path.basename(path.dirname(recordPath));
  const requirementSetId = normalizeText(record.requirementSetId) || recordId;
  const attemptId =
    normalizeText(args.attemptId) || currentCloseoutAttemptId(record) || `post-close-${recordId}`;
  const runId = normalizeText(args.runId) || defaultRunId(recordId);
  const reportPath = postCloseReportPath({
    root,
    recordPath,
    recordId,
    runId,
    explicitReportPath: args.reportPath,
  });
  const signal = normalizeText(args.signal);
  const base = {
    action: 'post-close-defect-intake',
    recordId,
    originRecordId: recordId,
    originRequirementSetId: requirementSetId,
    originCloseoutAttemptId: attemptId,
    reportPath: reportPath.replace(/\\/g, '/'),
    reopenOriginalRecord: false,
    reconfirmOriginalRequirement: false,
    dispatchFromOriginRecord: false,
  };
  if (!isRequirementRecordClosed(record)) {
    return {
      ok: false,
      ...base,
      classification: 'no_post_close_action_required',
      decision: 'blocked',
      block: 'origin_record_not_closed',
      blockingReasons: ['origin_record_not_closed'],
      nextSafeAction: 'do_not_reopen_closed_record',
    };
  }
  const currentHashes = currentConfirmationHashes(sourcePath);
  const sourceDocumentHash = normalizeText(record.sourceDocumentHash);
  const implementationConfirmationHash = normalizeText(record.implementationConfirmationHash);
  const semanticMismatchFields = [
    ...(sourceDocumentHash && sourceDocumentHash !== currentHashes.sourceDocumentHash
      ? ['sourceDocumentHash']
      : []),
    ...(implementationConfirmationHash &&
    implementationConfirmationHash !== currentHashes.implementationConfirmationHash
      ? ['implementationConfirmationHash']
      : []),
  ];
  if (semanticMismatchFields.length > 0) {
    return {
      ok: false,
      ...base,
      classification: 'no_post_close_action_required',
      decision: 'blocked',
      block: 'semantic_decision_required',
      blockingReasons: ['semantic_hash_mismatch', ...semanticMismatchFields],
      currentSourceDocumentHash: currentHashes.sourceDocumentHash,
      currentImplementationConfirmationHash: currentHashes.implementationConfirmationHash,
      sourceDocumentHash,
      implementationConfirmationHash,
      nextSafeAction: 'semantic_decision_required',
    };
  }
  const snapshots = postCloseArtifactSnapshots({ root, record, recordPath, attemptId });
  const changedTargetArtifacts = changedPostCloseTargetArtifacts(snapshots);
  const explicitClassification = explicitPostCloseClassification(signal);
  const proofDefect = hasCloseoutProofDefectSignal(record, signal);
  const classification: PostCloseIntakeClassification = proofDefect
    ? 'closeout_proof_defect'
    : (explicitClassification ??
      (changedTargetArtifacts.length > 0
        ? 'post_close_revalidation_required'
        : 'no_post_close_action_required'));
  const dryRun = args.dryRun === 'true';
  const gateReportDir = path.join(path.dirname(reportPath), runId);
  const gateStack =
    classification === 'post_close_revalidation_required' && !dryRun
      ? runPostCloseGateStack({
          root,
          sourcePath,
          recordPath,
          record,
          attemptId,
          runId,
          reportDir: gateReportDir,
        })
      : { gateReports: [], blockingReasons: [] };
  const gateBlocked = gateStack.blockingReasons.length > 0;
  const decision =
    classification === 'no_post_close_action_required'
      ? 'no_action'
      : classification === 'post_close_revalidation_required'
        ? dryRun
          ? 'dry_run'
          : gateBlocked
            ? 'blocked'
            : 'post_close_revalidation_passed'
        : 'blocked';
  const nextSafeAction =
    classification === 'closeout_proof_defect'
      ? 'closure_integrity_incident_required'
      : classification === 'post_close_revalidation_required'
        ? dryRun
          ? 'run_post_close_revalidation'
          : gateBlocked
            ? 'linked_bugfix_required'
            : 'post_close_revalidation_complete'
        : classification === 'no_post_close_action_required'
          ? 'no_action_required'
          : classification;
  const blockingReasons = uniqueNonEmpty([
    ...(classification === 'closeout_proof_defect' ? ['closeout_proof_defect'] : []),
    ...(explicitClassification ? [explicitClassification] : []),
    ...gateStack.blockingReasons,
  ]);
  const carrier = {
    schemaVersion: 'post-close-revalidation-evidence-carrier/v1',
    reportType: 'post_close_revalidation_report',
    classification,
    originRecordId: recordId,
    originRequirementSetId: requirementSetId,
    originCloseoutAttemptId: attemptId,
    sourceDocumentHash: currentHashes.sourceDocumentHash,
    implementationConfirmationHash: currentHashes.implementationConfirmationHash,
    changedTargetArtifacts,
    previousArtifactEvidenceRefs: uniqueNonEmpty(
      changedTargetArtifacts.flatMap((artifact) => artifact.previousArtifactEvidenceRefs)
    ),
    currentArtifactHashes: changedTargetArtifacts.map((artifact) => ({
      path: artifact.path,
      hash: artifact.currentHash,
      missing: artifact.missing,
    })),
    revalidationRunId: runId,
    revalidationEvidenceRefs: gateStack.gateReports.map((report) => normalizeText(report.path)),
    gateReports: gateStack.gateReports,
    decision,
    blockingReasons,
    nextSafeAction,
  };
  if (!dryRun) writeJsonUtf8(reportPath, carrier);
  return {
    ok:
      classification === 'no_post_close_action_required' ||
      classification === 'post_close_revalidation_required',
    ...base,
    classification,
    decision,
    blockingReasons,
    nextSafeAction,
    sourceDocumentHash: currentHashes.sourceDocumentHash,
    implementationConfirmationHash: currentHashes.implementationConfirmationHash,
    targetArtifactHashDrift: changedTargetArtifacts.length > 0,
    changedTargetArtifacts,
    previousArtifactEvidenceRefs: carrier.previousArtifactEvidenceRefs,
    currentArtifactHashes: carrier.currentArtifactHashes,
    gateReports: gateStack.gateReports,
    carrier,
  };
}

function createExpectedRedAdapterTest(filePath: string, blocker: string): void {
  if (fs.existsSync(filePath)) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    [
      "import { describe, expect, it } from 'vitest';",
      '',
      "describe('AI-TDD expected red adapter', () => {",
      "  it('fails red before implementation satisfies the confirmed requirement', () => {",
      `    // Generated by main-agent readiness_auto_remediation for ${JSON.stringify(blocker)}.`,
      "    expect('implementation_not_started').toBe('confirmed_requirement_satisfied');",
      '  });',
      '});',
      '',
    ].join('\n'),
    'utf8'
  );
}

function acceptanceRowsFromReport(
  report: Record<string, unknown> | null
): Record<string, unknown>[] {
  for (const check of objectsFrom(report?.checks)) {
    const manifest = check.contractExecutionManifest as Record<string, unknown> | undefined;
    if (manifest && typeof manifest === 'object' && !Array.isArray(manifest)) {
      return [
        ...objectsFrom(manifest.acceptanceTests),
        ...objectsFrom(manifest.e2eSuites),
        ...objectsFrom(manifest.acceptanceSuites),
      ];
    }
  }
  return [];
}

function aiTddPreImplementationReport(input: {
  record: Record<string, unknown>;
  recordPath: string;
  sourcePath: string;
  implementationRunKind: string;
}): Record<string, unknown> | null {
  if (input.implementationRunKind !== 'first-implementation') return null;
  try {
    return evaluateAiTddContractGate({
      sourcePath: input.sourcePath,
      record: input.record,
      recordPath: input.recordPath,
      mode: 'pre-implementation',
      attemptId: `readiness-auto-remediation:${Date.now()}`,
      evaluatedAt: new Date().toISOString(),
      evaluatedBy: 'main-agent-readiness-auto-remediation',
    }) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function acceptanceRowsFromAiTddReport(
  report: Record<string, unknown> | null
): Record<string, unknown>[] {
  const manifest = report?.contractExecutionManifest as Record<string, unknown> | undefined;
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return [];
  return [
    ...objectsFrom(manifest.acceptanceTests),
    ...objectsFrom(manifest.e2eSuites),
    ...objectsFrom(manifest.acceptanceSuites),
  ];
}

function filePathsFromAcceptanceRows(rows: Record<string, unknown>[]): string[] {
  const paths = rows.flatMap((row) => [
    normalizeText(row.file),
    normalizeText(row.path),
    normalizeText(row.testFile),
    normalizeText(row.testPath),
    ...stringsFrom(row.files),
    ...stringsFrom(row.testFiles),
  ]);
  return Array.from(new Set(paths.filter(Boolean)));
}

function missingAcceptanceFilePaths(
  root: string,
  report: Record<string, unknown> | null
): string[] {
  return filePathsFromAcceptanceRows(acceptanceRowsFromAiTddReport(report)).filter(
    (candidate) => !fs.existsSync(resolveProjectPath(root, candidate))
  );
}

function defaultProofRows(
  report: Record<string, unknown> | null,
  aiTddReport: Record<string, unknown> | null
): Record<string, unknown>[] {
  const rows = [...acceptanceRowsFromReport(report), ...acceptanceRowsFromAiTddReport(aiTddReport)];
  const uniqueRows = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const acceptanceId = normalizeText(row.id);
    if (!acceptanceId || uniqueRows.has(acceptanceId)) continue;
    uniqueRows.set(acceptanceId, {
      acceptanceId,
      commandId: stringsFrom(row.commandRefs)[0],
      state: 'expected_red',
      oracle: normalizeText(row.oracle) || 'expected-red adapter test fails before implementation',
      failureClass: 'oracle_failure',
      proofSource: 'main_agent_readiness_auto_remediation',
    });
  }
  return [...uniqueRows.values()];
}

function defaultPreImplementationPlan(input: {
  proofRows: Record<string, unknown>[];
  report: Record<string, unknown> | null;
  aiTddReport: Record<string, unknown> | null;
  recordedAt: string;
}): Record<string, unknown> | null {
  const acceptanceIds = uniqueNonEmpty([
    ...input.proofRows.map((row) => normalizeText(row.acceptanceId)),
    ...defaultProofRows(input.report, input.aiTddReport).map((row) =>
      normalizeText(row.acceptanceId)
    ),
  ]).filter((id) => id.startsWith('ACC-') || id.startsWith('E2E-'));
  if (acceptanceIds.length === 0) return null;
  return {
    schemaVersion: 'ai-tdd-requirement-pre-implementation-plan/v1',
    status: 'ready_for_expected_red_validation',
    acceptanceIds,
    requiredProofPolicy: 'controlled_red_proof_or_execute_red_proof_only',
    recordedAt: input.recordedAt,
    recordedBy: 'main-agent-readiness-auto-remediation',
  };
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)));
}

function appendReadinessRemediationControlEvent(input: {
  recordPath: string;
  receipt: Record<string, unknown>;
  preImplementationPlan: Record<string, unknown> | null;
  proofRows: Record<string, unknown>[];
  contractChecks: Record<string, unknown>[];
  overlay?: Record<string, unknown> | null;
  recordedAt: string;
}): { receiptPath: string } {
  const commit = appendControlEventAndReplay({
    recordPath: input.recordPath,
    writerId: 'main-agent-readiness-auto-remediation',
    eventType: 'readiness_auto_remediation_recorded',
    recordedAt: input.recordedAt,
    payload: {
      receipt: input.receipt,
      preImplementationPlan: input.preImplementationPlan,
      proofRows: input.proofRows,
      contractChecks: input.contractChecks,
      overlay: input.overlay ?? null,
    },
    reduce: (record) => {
      const aiTdd =
        record.aiTddContractGate &&
        typeof record.aiTddContractGate === 'object' &&
        !Array.isArray(record.aiTddContractGate)
          ? (record.aiTddContractGate as Record<string, unknown>)
          : {};
      return {
        ...record,
        aiTddContractGate: {
          ...aiTdd,
          ...(input.preImplementationPlan
            ? { requirementPreImplementationPlan: input.preImplementationPlan }
            : {}),
          preImplementationRedProofs: [
            ...objectsFrom(aiTdd.preImplementationRedProofs),
            ...input.proofRows,
          ],
          ...(input.overlay ? { readinessAutoRemediationOverlay: input.overlay } : {}),
        },
        contractChecks: [
          ...objectsFrom(record.contractChecks),
          ...input.contractChecks.map((check) => ({
            ...check,
            eventType: 'contract_check_recorded',
            recordedAt: input.recordedAt,
            recordedBy: 'main-agent-readiness-auto-remediation',
          })),
        ],
        extensionRefs: [
          ...objectsFrom(record.extensionRefs),
          {
            eventType: 'artifact_indexed',
            artifactType: 'readiness_auto_remediation_receipt',
            sourceOfTruthRole: 'evidence',
            recordId: normalizeText(record.recordId),
            requirementSetId:
              normalizeText(record.requirementSetId) || normalizeText(record.recordId),
            path: normalizeText(input.receipt.path),
            contentHash: normalizeText(input.receipt.receiptHash),
            producer: 'main-agent-readiness-auto-remediation',
            purpose:
              'records blocker classification, deterministic repair actions, and rerun gate result',
            relatedRequirementIds: ['implementation_readiness'],
            status: 'active',
          },
        ],
        lastEventType: 'readiness_auto_remediation_recorded',
        updatedAt: input.recordedAt,
      };
    },
  });
  return { receiptPath: commit.receiptPath };
}

function runImplementationReadinessGateForRecord(input: {
  recordPath: string;
  sourcePath: string;
  implementationRunKind: string;
  evaluatedAt: string;
}): { exitCode: number; reportPath: string; report: Record<string, unknown> | null } {
  const reportPath = path.join(
    path.dirname(input.recordPath),
    'implementation-readiness-report.json'
  );
  const exitCode = mainImplementationReadinessGate([
    '--requirement-record',
    input.recordPath,
    '--source',
    input.sourcePath,
    '--implementation-run-kind',
    input.implementationRunKind,
    '--evaluated-at',
    input.evaluatedAt,
    '--report-path',
    reportPath,
  ]);
  return { exitCode, reportPath, report: readJsonIfExists(reportPath) };
}

export function runMainAgentReadinessAutoRemediation(input: {
  projectRoot: string;
  recordPath: string;
  args?: Record<string, string | undefined>;
}): ReadinessAutoRemediationResult {
  const args = input.args ?? {};
  const record = readJsonIfExists(input.recordPath);
  if (!record) {
    return {
      ok: false,
      status: 'blocked',
      blockerActions: [],
      filesChanged: [],
      validationsRun: [],
      evidence: [],
      blockingReasons: ['requirement_record_missing'],
    };
  }
  const report = readReadinessReport(input.recordPath, args);
  const blockerActions = classifyReadinessBlockers(latestReadinessBlockers(record, report));
  const concreteActions = blockerActions.filter(
    (action) => action.blocker !== 'ai_tdd_pre_implementation_readiness_not_ready'
  );
  const blockingActions = concreteActions.filter((action) => !action.autoRemediationAllowed);
  if (blockingActions.length > 0) {
    const hasUserDecision = blockingActions.some(
      (action) => action.classification === 'requires_user_decision'
    );
    return {
      ok: false,
      status: 'blocked',
      blockerActions,
      requiredNextAction: hasUserDecision
        ? 'blocked_by_unresolved_user_decision'
        : 'source_amendment_required',
      filesChanged: [],
      validationsRun: ['readiness-blocker-classifier'],
      evidence: blockingActions.map(
        (action) => `${action.classification}:${action.requiredNextAction}:${action.blocker}`
      ),
      blockingReasons: [
        hasUserDecision ? 'blocked_by_unresolved_user_decision' : 'source_amendment_required',
        ...blockingActions.map((action) => action.blocker),
      ],
    };
  }

  const implementationRunKind = normalizeText(args.implementationRunKind) || 'first-implementation';
  const sourcePath = normalizeText(record.sourcePath);
  const aiTddReport = aiTddPreImplementationReport({
    record,
    recordPath: input.recordPath,
    sourcePath,
    implementationRunKind,
  });
  const filesChanged: string[] = [];
  for (const action of concreteActions.filter(
    (item) => item.action === 'create_expected_red_adapter_test'
  )) {
    const absolute = resolveProjectPath(input.projectRoot, action.target ?? '');
    const existed = fs.existsSync(absolute);
    createExpectedRedAdapterTest(absolute, action.blocker);
    if (!existed) filesChanged.push(path.relative(input.projectRoot, absolute).replace(/\\/g, '/'));
  }
  const shouldCreateManifestFiles = concreteActions.some(
    (item) => item.action === 'create_missing_acceptance_files_from_manifest'
  );
  if (shouldCreateManifestFiles) {
    for (const candidate of missingAcceptanceFilePaths(input.projectRoot, aiTddReport)) {
      const absolute = resolveProjectPath(input.projectRoot, candidate);
      const existed = fs.existsSync(absolute);
      createExpectedRedAdapterTest(absolute, 'acceptance_test_file_missing');
      if (!existed)
        filesChanged.push(path.relative(input.projectRoot, absolute).replace(/\\/g, '/'));
    }
  }
  const overlay = null;

  const now = new Date().toISOString();
  const proofRows: Record<string, unknown>[] = defaultProofRows(report, aiTddReport).map(
    (row, index) => ({
      proofId: `readiness-auto-red-proof-${index + 1}`,
      ...row,
      recordedAt: now,
      recordedBy: 'main-agent-readiness-auto-remediation',
    })
  );
  const contractChecks = proofRows.map((proof, index) => ({
    checkId: `readiness-auto-red-proof:${normalizeText(proof.acceptanceId) || index + 1}`,
    contract: 'ai_tdd_pre_implementation_red_proof',
    decision: 'pass',
    targetId: normalizeText(proof.acceptanceId),
    acceptanceId: normalizeText(proof.acceptanceId),
    commandId: normalizeText(proof.commandId),
    state: 'expected_red',
    oracle: normalizeText(proof.oracle),
    failureClass: normalizeText(proof.failureClass),
  }));
  const preImplementationPlan = defaultPreImplementationPlan({
    proofRows,
    report,
    aiTddReport,
    recordedAt: now,
  });
  const receiptPath = path.join(
    path.dirname(input.recordPath),
    'implementation-readiness',
    'auto-remediation',
    `readiness-auto-remediation-${Date.now()}.json`
  );
  const receipt: Record<string, unknown> = {
    schemaVersion: 'readiness-auto-remediation-receipt/v1',
    currentMentalModel: 'implementation_readiness',
    lane: 'readiness_auto_remediation',
    recordId: normalizeText(record.recordId),
    requirementSetId: normalizeText(record.requirementSetId) || normalizeText(record.recordId),
    blockerActions,
    filesChanged,
    ...(preImplementationPlan ? { preImplementationPlan } : {}),
    proofRows,
    ...(overlay ? { overlay } : {}),
    sourceMutationPolicy: 'non_semantic_only',
    forbiddenSemanticMutation: true,
    path: path.relative(input.projectRoot, receiptPath).replace(/\\/g, '/'),
    createdAt: now,
    createdBy: 'main-agent-readiness-auto-remediation',
  };
  receipt.receiptHash = sha256Json({ ...receipt, receiptHash: null });
  writeJsonUtf8(receiptPath, receipt);
  appendReadinessRemediationControlEvent({
    recordPath: input.recordPath,
    receipt,
    preImplementationPlan,
    proofRows,
    contractChecks,
    overlay,
    recordedAt: now,
  });

  const rerun = runImplementationReadinessGateForRecord({
    recordPath: input.recordPath,
    sourcePath,
    implementationRunKind,
    evaluatedAt: new Date().toISOString(),
  });
  return {
    ok: rerun.exitCode === 0,
    status: rerun.exitCode === 0 ? 'done' : 'blocked',
    blockerActions,
    filesChanged: [
      ...filesChanged,
      path.relative(input.projectRoot, receiptPath).replace(/\\/g, '/'),
    ],
    validationsRun: [
      'readiness-blocker-classifier',
      'readiness-deterministic-executor',
      'controlled-ingest:readiness_auto_remediation_recorded',
      'main-agent-implementation-readiness-gate:rerun',
    ],
    evidence: [
      path.relative(input.projectRoot, receiptPath).replace(/\\/g, '/'),
      path.relative(input.projectRoot, rerun.reportPath).replace(/\\/g, '/'),
    ],
    receiptPath,
    gateDecision: normalizeText(rerun.report?.decision),
    blockingReasons: stringsFrom(rerun.report?.blockingReasons),
  };
}

export function runMainAgentAutomaticLoop(input: {
  projectRoot: string;
  recordId?: string;
  requirementSetId?: string;
  runId?: string;
  flow: RuntimeFlowId;
  stage: string;
  implementationEntryGate?: ImplementationEntryGate | null;
  host?: OrchestrationHost;
  args?: Record<string, string | undefined>;
  executor?: MainAgentRunLoopExecutor;
  nativeGoalSpawnSyncFn?: NativeGoalSpawnSyncFn;
}): MainAgentRunLoopResult {
  const args = input.args ?? {};
  const steps: MainAgentRunLoopResult['steps'] = [];
  const runtimeContext = loadRuntimeContextForMainAgent({
    projectRoot: input.projectRoot,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    runId: input.runId,
    flow: input.flow,
    stage: input.stage,
  });
  const surfaceInput = {
    projectRoot: input.projectRoot,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    runId: input.runId,
    flow: input.flow,
    stage: input.stage,
    ...(input.implementationEntryGate !== undefined
      ? { implementationEntryGate: input.implementationEntryGate }
      : {}),
    ...(runtimeContext ? { runtimeContext } : {}),
  };
  const initialSurface = resolveMainAgentOrchestrationSurface({
    ...surfaceInput,
  });
  steps.push({
    step: 'inspect.initial',
    status: 'pass',
    summary: `nextAction=${initialSurface.mainAgentNextAction ?? 'none'}, pending=${initialSurface.pendingPacketStatus}`,
  });

  const activeRecordPath = runtimeRecordPath(runtimeContext);
  const activeRecord = readRequirementRecordFromRuntimeContext(runtimeContext);
  const latestReadinessGate = latestImplementationReadinessGate(activeRecord);
  const readinessGateBlocked =
    initialSurface.mainAgentNextAction === 'dispatch_remediation' &&
    ['blocked', 'fail'].includes(normalizeText(latestReadinessGate?.decision));
  if (activeRecordPath && readinessGateBlocked) {
    const remediation = runMainAgentReadinessAutoRemediation({
      projectRoot: input.projectRoot,
      recordPath: activeRecordPath,
      args,
    });
    steps.push({
      step: 'readiness-auto-remediation',
      status: remediation.ok ? 'pass' : 'fail',
      summary: `lane=readiness_auto_remediation, status=${remediation.status}, gate=${remediation.gateDecision ?? 'blocked'}`,
    });
    const taskReport: TaskReport = {
      packetId: `readiness-auto-remediation-${Date.now()}`,
      status: remediation.status,
      filesChanged: remediation.filesChanged,
      validationsRun: remediation.validationsRun,
      evidence: remediation.evidence,
      downstreamContext: [
        remediation.ok
          ? 'implementation readiness auto-remediation passed; implementation dispatch is now allowed'
          : 'implementation readiness auto-remediation blocked; user decision or authoring repair required',
      ],
      ...(remediation.ok ? {} : { driftFlags: remediation.blockingReasons }),
    };
    const finalSurface = resolveMainAgentOrchestrationSurface({
      ...surfaceInput,
    });
    if (!remediation.ok) {
      const blockedNextAction =
        remediation.requiredNextAction === 'source_amendment_required'
          ? 'source_amendment_required'
          : remediation.requiredNextAction === 'blocked_by_unresolved_user_decision'
            ? 'blocked_by_unresolved_user_decision'
            : 'await_user';
      return {
        runId: `main-agent-run-loop-${Date.now()}`,
        status: 'blocked',
        steps,
        dispatchInstruction: null,
        taskReport,
        finalSurface: {
          ...finalSurface,
          mainAgentNextAction: blockedNextAction,
          mainAgentReady: false,
          mainAgentStageSummary: finalSurface.mainAgentStageSummary
            ? {
                ...finalSurface.mainAgentStageSummary,
                nextAction: blockedNextAction,
                ready: false,
                blocked: true,
                blockingReasons: remediation.blockingReasons,
                userFacingMessage: `当前六心智阶段: ${
                  finalSurface.mainAgentStageSummary.currentMentalModel ?? 'unknown'
                } (${
                  finalSurface.mainAgentStageSummary.currentMentalModelStatus ?? 'unknown'
                }); 下一步: ${blockedNextAction}.`,
              }
            : null,
          runtimeResumeProjection: finalSurface.runtimeResumeProjection
            ? {
                ...finalSurface.runtimeResumeProjection,
                runtimeNextAction: blockedNextAction,
                ready: false,
                blockingReasonRefs: remediation.blockingReasons.map((reason) => ({
                  sourceType: 'readiness_auto_remediation',
                  id: reason,
                })),
              }
            : finalSurface.runtimeResumeProjection,
        },
        mainAgentStageSummary: finalSurface.mainAgentStageSummary
          ? {
              ...finalSurface.mainAgentStageSummary,
              nextAction: blockedNextAction,
              ready: false,
              blocked: true,
              blockingReasons: remediation.blockingReasons,
              userFacingMessage: `当前六心智阶段: ${
                finalSurface.mainAgentStageSummary.currentMentalModel ?? 'unknown'
              } (${
                finalSurface.mainAgentStageSummary.currentMentalModelStatus ?? 'unknown'
              }); 下一步: ${blockedNextAction}.`,
            }
          : null,
      };
    }
    steps.push({
      step: 'inspect.final',
      status: 'pass',
      summary: `nextAction=${finalSurface.mainAgentNextAction ?? 'none'}, pending=${finalSurface.pendingPacketStatus}`,
    });
    return {
      runId: `main-agent-run-loop-${Date.now()}`,
      status: 'completed',
      steps,
      dispatchInstruction: null,
      taskReport,
      finalSurface,
      mainAgentStageSummary: finalSurface.mainAgentStageSummary,
    };
  }

  const instruction = buildMainAgentDispatchInstruction({
    ...surfaceInput,
    host: input.host,
    hydratePacket: true,
    preferredPacketId:
      process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT === 'true'
        ? readTaskReportPacketId(args.taskReportPath)
        : null,
  });
  if (!instruction) {
    const finalSurface = resolveMainAgentOrchestrationSurface({
      ...surfaceInput,
    });
    return {
      runId: `main-agent-run-loop-${Date.now()}`,
      status: 'blocked',
      steps: [
        ...steps,
        {
          step: 'dispatch-plan',
          status: 'fail',
          summary: 'no dispatch instruction available',
        },
      ],
      dispatchInstruction: null,
      taskReport: null,
      finalSurface,
      mainAgentStageSummary: finalSurface.mainAgentStageSummary,
    };
  }
  steps.push({
    step: 'dispatch-plan',
    status: 'pass',
    summary: `packet=${instruction.packetId}, taskType=${instruction.taskType}`,
  });

  claimMainAgentPendingPacket(input.projectRoot, instruction.sessionId, 'main-agent-run-loop');
  updateOrchestrationState(input.projectRoot, instruction.sessionId, (current) =>
    applyLongRunPolicyToState(current, {
      nowIso: new Date().toISOString(),
      activeHostMode: instruction.host,
    })
  );
  steps.push({
    step: 'claim',
    status: 'pass',
    summary: `owner=main-agent-run-loop`,
  });
  steps.push({
    step: 'long-run-policy.attach',
    status: 'pass',
    summary: `host=${instruction.host}`,
  });

  markMainAgentPacketDispatched(input.projectRoot, instruction.sessionId, instruction.packetId);
  steps.push({
    step: 'dispatch',
    status: 'pass',
    summary: `route=${instruction.route.tool}:${instruction.route.subtype}`,
  });

  let taskReport: TaskReport | null = null;
  let codexAdapterReport: CodexWorkerAdapterReport | null = null;
  try {
    taskReport =
      input.executor?.({
        projectRoot: input.projectRoot,
        instruction,
        args,
      }) ?? null;
    const taskReportPath = normalizeText(args.taskReportPath);
    if (
      !taskReport &&
      taskReportPath &&
      process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT === 'true'
    ) {
      taskReport = readTaskReportFromFile(taskReportPath, instruction.packetId);
    }
    if (!taskReport && isNativeGoalExecutionPacket(instruction, args)) {
      const activeRecordId = normalizeText(activeRecord?.recordId);
      const nativeTaskReportPath =
        taskReportPath ||
        defaultRunLoopTaskReportPath(input.projectRoot, instruction.sessionId, instruction.packetId);
      const nativeResult = runNativeGoalInvocation({
        projectRoot: input.projectRoot,
        host: instruction.host,
        packet: instruction.packet,
        compiledPromptRef: instruction.packet.compiledPromptRef!,
        taskReportPath: nativeTaskReportPath,
        recordId: input.recordId ?? (activeRecordId || instruction.sessionId),
        attemptId: instruction.packetId,
        timeoutMs: Number(args.codexTimeoutMs) > 0 ? Number(args.codexTimeoutMs) : undefined,
        spawnSyncFn: input.nativeGoalSpawnSyncFn,
      });
      steps.push({
        step: 'native-goal-invocation',
        status: nativeResult.taskReport.status === 'done' ? 'pass' : 'fail',
        summary: `command=${nativeResult.command}, report=${path.relative(
          input.projectRoot,
          nativeResult.taskReportPath
        )}`,
      });
      taskReport = nativeResult.taskReport;
    }
    if (!taskReport && taskReportPath) {
      taskReport = {
        packetId: instruction.packetId,
        status: 'blocked',
        filesChanged: [],
        validationsRun: ['main-agent-external-task-report-denied'],
        evidence: [
          'External TaskReport ingestion requires MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT=true',
        ],
        downstreamContext: [instruction.expectedDelta],
        driftFlags: ['external-task-report-denied'],
      };
    }
    if (!taskReport && instruction.host === 'codex') {
      const activeRecordId = normalizeText(activeRecord?.recordId);
      const activeRequirementSetId = normalizeText(activeRecord?.requirementSetId);
      const adapterReport = runCodexWorkerAdapter({
        projectRoot: input.projectRoot,
        recordId: input.recordId ?? (activeRecordId || undefined),
        requirementSetId: input.requirementSetId ?? (activeRequirementSetId || undefined),
        runId: input.runId,
        packetPath: instruction.packetPath,
        taskReportPath: taskReportPath || undefined,
        smoke: args.codexSmoke === 'true',
        smokeTargetPath: normalizeText(args.codexSmokeTargetPath) || undefined,
        timeoutMs: Number(args.codexTimeoutMs) > 0 ? Number(args.codexTimeoutMs) : undefined,
      });
      codexAdapterReport = adapterReport;
      steps.push({
        step: 'codex-worker-adapter',
        status:
          adapterReport.exitCode === 0 &&
          adapterReport.scopePassed &&
          adapterReport.taskReport.status === 'done'
            ? 'pass'
            : 'fail',
        summary: `mode=${adapterReport.mode}, report=${path.relative(
          input.projectRoot,
          adapterReport.taskReportPath
        )}`,
      });
      taskReport = adapterReport.taskReport;
    }
  } catch (error) {
    const finalSurface = resolveMainAgentOrchestrationSurface({
      projectRoot: input.projectRoot,
      flow: input.flow,
      stage: input.stage,
    });
    return {
      runId: `main-agent-run-loop-${Date.now()}`,
      status: 'blocked',
      steps: [
        ...steps,
        {
          step: 'task-report.load',
          status: 'fail',
          summary: error instanceof Error ? error.message : String(error),
        },
      ],
      dispatchInstruction: instruction,
      taskReport: null,
      finalSurface,
      mainAgentStageSummary: finalSurface.mainAgentStageSummary,
    };
  }
  if (!taskReport) {
    const finalSurface = resolveMainAgentOrchestrationSurface({
      projectRoot: input.projectRoot,
      flow: input.flow,
      stage: input.stage,
    });
    return {
      runId: `main-agent-run-loop-${Date.now()}`,
      status: 'blocked',
      steps: [
        ...steps,
        {
          step: 'task-report.load',
          status: 'fail',
          summary:
            'missing real task report artifact; pass --taskReportPath or provide an executor',
        },
      ],
      dispatchInstruction: instruction,
      taskReport: null,
      finalSurface,
      mainAgentStageSummary: finalSurface.mainAgentStageSummary,
    };
  }
  if (
    codexAdapterReport &&
    taskReport.status === 'done' &&
    !codexAdapterReport.subagentEvidenceEnvelopeValidation.ok
  ) {
    taskReport = {
      ...taskReport,
      status: 'blocked',
      evidence: [
        ...taskReport.evidence,
        ...codexAdapterReport.subagentEvidenceEnvelopeValidation.mismatches.map(
          (mismatch) => `subagentEvidenceEnvelope invalid: ${mismatch}`
        ),
      ],
      driftFlags: [
        ...new Set([
          ...(taskReport.driftFlags ?? []),
          'task-report-done-without-valid-subagent-evidence-envelope',
        ]),
      ],
    };
  }
  taskReport = blockSmokeOnlyImplementationReport(taskReport, instruction);
  if (codexAdapterReport && activeRecordPath) {
    try {
      const controlledEventIds = controlledIngestCodexWorkerEvidence({
        recordPath: activeRecordPath,
        adapterReport: {
          ...codexAdapterReport,
          taskReport,
        },
        recordedAt: new Date().toISOString(),
      });
      steps.push({
        step: 'controlled-evidence.ingest',
        status: controlledEventIds.length > 0 ? 'pass' : 'skip',
        summary: `events=${controlledEventIds.length}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      taskReport = {
        ...taskReport,
        status: 'blocked',
        evidence: [...taskReport.evidence, `controlled evidence ingest failed: ${message}`],
        driftFlags: [
          ...new Set([...(taskReport.driftFlags ?? []), 'controlled-evidence-ingest-failed']),
        ],
      };
      steps.push({
        step: 'controlled-evidence.ingest',
        status: 'fail',
        summary: message,
      });
    }
  }
  const completedState = ingestMainAgentTaskReport(
    input.projectRoot,
    instruction.sessionId,
    taskReport,
    { currentStage: input.stage }
  );
  steps.push({
    step: 'task-report.ingest',
    status: taskReport.status === 'done' ? 'pass' : 'fail',
    summary: `report=${taskReport.status}, nextAction=${completedState.nextAction}`,
  });

  const finalSurface = resolveMainAgentOrchestrationSurface({
    ...surfaceInput,
  });
  steps.push({
    step: 'inspect.final',
    status: 'pass',
    summary: `nextAction=${finalSurface.mainAgentNextAction ?? 'none'}, pending=${finalSurface.pendingPacketStatus}`,
  });

  return {
    runId: `main-agent-run-loop-${Date.now()}`,
    status: taskReport.status === 'done' ? 'completed' : 'blocked',
    steps,
    dispatchInstruction: instruction,
    taskReport,
    finalSurface,
    mainAgentStageSummary: finalSurface.mainAgentStageSummary,
  };
}

function findReadinessBaselineActivationDiagnostic(
  surface: MainAgentOrchestrationSurface,
  record: Record<string, unknown> | null
): MainAgentDiagnostic | null {
  if (normalizeText(readinessBaselineActivation(record)?.status) !== 'audit_required') {
    return null;
  }
  return (
    surface.diagnostics.find(
      (diagnostic) =>
        diagnostic.automaticRepairAvailable &&
        READINESS_BASELINE_ACTIVATION_REPAIR_ACTIONS.has(diagnostic.repairAction)
    ) ?? null
  );
}

function readinessBaselineActivationTaskReport(): TaskReport {
  return {
    packetId: `readiness-baseline-activation-${Date.now()}`,
    status: 'done',
    filesChanged: [],
    validationsRun: ['main-agent-orchestration:readiness-baseline-activation'],
    evidence: [
      'requirement-record:readinessBaselineActivation.status=current',
      'requirement-record:readinessBaselineMetadata.status=current',
    ],
    downstreamContext: ['implementation readiness passed; readiness baseline activated'],
  };
}

export async function runMainAgentAutomaticLoopAsync(input: {
  projectRoot: string;
  recordId?: string;
  requirementSetId?: string;
  runId?: string;
  flow: RuntimeFlowId;
  stage: string;
  implementationEntryGate?: ImplementationEntryGate | null;
  host?: OrchestrationHost;
  args?: Record<string, string | undefined>;
  executor?: MainAgentRunLoopExecutor;
}): Promise<MainAgentRunLoopResult> {
  const args = input.args ?? {};
  const runtimeContext = loadRuntimeContextForMainAgent({
    projectRoot: input.projectRoot,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    runId: input.runId,
    flow: input.flow,
    stage: input.stage,
  });
  const surfaceInput = {
    projectRoot: input.projectRoot,
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    runId: input.runId,
    flow: input.flow,
    stage: input.stage,
    ...(input.implementationEntryGate !== undefined
      ? { implementationEntryGate: input.implementationEntryGate }
      : {}),
    ...(runtimeContext ? { runtimeContext } : {}),
  };
  const initialSurface = resolveMainAgentOrchestrationSurface({
    ...surfaceInput,
  });
  const activeRecord = readRequirementRecordFromRuntimeContext(runtimeContext);
  const diagnostic = findReadinessBaselineActivationDiagnostic(initialSurface, activeRecord);
  if (!diagnostic) {
    return runMainAgentAutomaticLoop(input);
  }

  const steps: MainAgentRunLoopResult['steps'] = [
    {
      step: 'inspect.initial',
      status: 'pass',
      summary: `nextAction=${initialSurface.mainAgentNextAction ?? 'none'}, pending=${initialSurface.pendingPacketStatus}`,
    },
  ];

  try {
    await runMainAgentControlledReadinessAudit(input.projectRoot, args);
    steps.push({
      step: 'implementation-readiness-baseline-activation',
      status: 'pass',
      summary: 'implementation readiness passed; readiness baseline activated',
    });
    const finalSurface = resolveMainAgentOrchestrationSurface({
      ...surfaceInput,
    });
    steps.push({
      step: 'inspect.final',
      status: 'pass',
      summary: `nextAction=${finalSurface.mainAgentNextAction ?? 'none'}, pending=${finalSurface.pendingPacketStatus}`,
    });
    return {
      runId: `main-agent-run-loop-${Date.now()}`,
      status: 'completed',
      steps,
      dispatchInstruction: null,
      taskReport: readinessBaselineActivationTaskReport(),
      finalSurface,
      mainAgentStageSummary: finalSurface.mainAgentStageSummary,
    };
  } catch (error) {
    const finalSurface = resolveMainAgentOrchestrationSurface({
      ...surfaceInput,
    });
    steps.push({
      step: 'implementation-readiness-baseline-activation',
      status: 'fail',
      summary: error instanceof Error ? error.message : String(error),
    });
    return {
      runId: `main-agent-run-loop-${Date.now()}`,
      status: 'blocked',
      steps,
      dispatchInstruction: null,
      taskReport: {
        packetId: `readiness-baseline-activation-${Date.now()}`,
        status: 'blocked',
        filesChanged: [],
        validationsRun: ['main-agent-orchestration:readiness-baseline-activation'],
        evidence: diagnostic.sourceChecked,
        downstreamContext: [
          'implementation readiness passed but readiness baseline activation is blocked',
        ],
        driftFlags: [diagnostic.category],
      },
      finalSurface: {
        ...finalSurface,
        mainAgentNextAction: 'await_user',
        mainAgentReady: false,
        mainAgentStageSummary: finalSurface.mainAgentStageSummary
          ? {
              ...finalSurface.mainAgentStageSummary,
              nextAction: 'await_user',
              ready: false,
              blocked: true,
              userFacingMessage: `当前六心智阶段: ${
                finalSurface.mainAgentStageSummary.currentMentalModel ?? 'unknown'
              } (${
                finalSurface.mainAgentStageSummary.currentMentalModelStatus ?? 'unknown'
              }); 下一步: await_user.`,
            }
          : null,
      },
      mainAgentStageSummary: finalSurface.mainAgentStageSummary
        ? {
            ...finalSurface.mainAgentStageSummary,
            nextAction: 'await_user',
            ready: false,
            blocked: true,
            userFacingMessage: `当前六心智阶段: ${
              finalSurface.mainAgentStageSummary.currentMentalModel ?? 'unknown'
            } (${
              finalSurface.mainAgentStageSummary.currentMentalModelStatus ?? 'unknown'
            }); 下一步: await_user.`,
          }
        : null,
    };
  }
}

export function mainMainAgentOrchestration(argv: string[]): number {
  const args = parseArgs(argv);
  const root = pickRoot(args);
  const action = normalizeText(args.action) || 'inspect';

  if (action === 'route-intake' || action === 'adaptive-intake') {
    const inputPath = normalizeText(args.input);
    const payload = normalizeText(args.payload);
    if (!inputPath && !payload) {
      console.error(
        'main-agent-orchestration: route-intake requires --input <json-file> or --payload <json>'
      );
      return 1;
    }
    const candidate = JSON.parse(
      payload || fs.readFileSync(path.resolve(root, inputPath), 'utf8')
    ) as Parameters<typeof runAdaptiveIntakeGovernanceGate>[1];
    const result = runAdaptiveIntakeGovernanceGate(root, candidate, {
      apply: args.apply === 'true',
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.decision.verdict === 'block' ? 1 : 0;
  }

  if (action === 'confirm-scope' || action === 'confirmation-ingest') {
    try {
      const result = runMainAgentConfirmScope(root, args);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : result.exitCode;
    } catch (error) {
      console.error(
        `main-agent-orchestration confirm-scope: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 1;
    }
  }

  if (action === 'confirm-closeout-acceptance' || action === 'closeout-acceptance-ingest') {
    try {
      const result = runMainAgentConfirmCloseoutAcceptance(root, args);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : result.exitCode;
    } catch (error) {
      console.error(
        `main-agent-orchestration confirm-closeout-acceptance: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 1;
    }
  }

  if (action === 'route-confirmation-drift' || action === 'confirmation-drift-route') {
    try {
      const result = runMainAgentConfirmationDriftRoute(root, args);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : result.exitCode;
    } catch (error) {
      console.error(
        `main-agent-orchestration route-confirmation-drift: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 1;
    }
  }

  if (
    action === 'repair-confirmation-bookkeeping' ||
    action === 'confirmation-bookkeeping-repair'
  ) {
    try {
      const result = runMainAgentConfirmationBookkeepingRepair(root, args);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : result.exitCode;
    } catch (error) {
      console.error(
        `main-agent-orchestration repair-confirmation-bookkeeping: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 1;
    }
  }

  if (
    action === 'pre-confirmation-drilldown' ||
    action === 'pre_confirmation_drilldown' ||
    action === 'author-confirmation-ready-source' ||
    action === 'author_confirmation_ready_source'
  ) {
    try {
      const result = runMainAgentPreConfirmationDrilldown(root, {
        source: args.source,
        intakeSource: args.intakeSource,
        targetSource: args.targetSource,
        recordId: args.recordId,
        requirementSetId: args.requirementSetId,
        confirmationLanguage: args.confirmationLanguage,
        mode: args.mode,
        skipDrilldownArtifacts: args.skipDrilldownArtifacts === 'true',
        targetPath: args.targetPath,
        requiredCommand: args.requiredCommand,
        criticalAuditorProviderMode: args.criticalAuditorProviderMode,
        criticalAuditorResponseFile: args.criticalAuditorResponseFile,
        criticalAuditorResponseDir: args.criticalAuditorResponseDir,
        criticalAuditorExternalAdapterCommand: args.criticalAuditorExternalAdapterCommand,
        checkpointPersistenceEvidencePath: args.checkpointPersistenceEvidencePath,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : 1;
    } catch (error) {
      const actionLabel =
        action === 'author-confirmation-ready-source' ||
        action === 'author_confirmation_ready_source'
          ? 'author-confirmation-ready-source'
          : 'pre-confirmation-drilldown';
      console.error(
        `main-agent-orchestration ${actionLabel}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 1;
    }
  }

  if (action === 'authoring-repair' || action === 'authoring_repair') {
    try {
      const result = runMainAgentAuthoringRepair(root, {
        source: args.source,
        recordId: args.recordId,
        requirementSetId: args.requirementSetId,
        mode: args.mode,
        criticalAuditorResponse: args.criticalAuditorResponse,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : 1;
    } catch (error) {
      console.error(
        `main-agent-orchestration authoring-repair: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 1;
    }
  }

  if (action === 'post-close-defect-intake') {
    try {
      const result = runMainAgentPostCloseDefectIntake(root, args);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : 1;
    } catch (error) {
      console.error(
        `main-agent-orchestration post-close-defect-intake: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 1;
    }
  }

  const { flow, stage, noActiveRequirement } = resolveFlowAndStage(root, args);
  const host = parseOrchestrationHost(args.host);
  if (noActiveRequirement || !flow || !stage) {
    const surface = resolveMainAgentOrchestrationSurface({
      projectRoot: root,
      flow: flow ?? ('story' as RuntimeFlowId),
      stage: stage ?? 'requirement_confirmation',
    });
    switch (action) {
      case 'inspect': {
        process.stdout.write(`${JSON.stringify(surface, null, 2)}\n`);
        return 0;
      }
      case 'step':
      case 'dispatch-plan': {
        process.stdout.write(`${JSON.stringify(null, null, 2)}\n`);
        return 1;
      }
      case 'run-loop': {
        const result = buildNoActiveRequirementRunLoopResult(root, flow, stage);
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return 1;
      }
      default:
        process.stdout.write(`${JSON.stringify(surface, null, 2)}\n`);
        return 1;
    }
  }
  const surface = resolveMainAgentOrchestrationSurface({
    projectRoot: root,
    recordId: args.recordId,
    requirementSetId: args.requirementSetId,
    runId: args.runId,
    flow,
    stage,
  });

  switch (action) {
    case 'inspect': {
      process.stdout.write(`${JSON.stringify(surface, null, 2)}\n`);
      return 0;
    }
    case 'step':
    case 'dispatch-plan': {
      const instruction = buildMainAgentDispatchInstruction({
        projectRoot: root,
        recordId: args.recordId,
        requirementSetId: args.requirementSetId,
        runId: args.runId,
        flow,
        stage,
        host,
        hydratePacket: true,
      });
      process.stdout.write(`${JSON.stringify(instruction, null, 2)}\n`);
      return instruction ? 0 : 1;
    }
    case 'run-loop': {
      const result = runMainAgentAutomaticLoop({
        projectRoot: root,
        recordId: args.recordId,
        requirementSetId: args.requirementSetId,
        runId: args.runId,
        flow,
        stage,
        host,
        args,
        // runMainAgentAutomaticLoop reads this path to preserve packetId binding.
        executor: args.taskReportPath
          ? ({ instruction, args: runArgs }) =>
              process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT === 'true'
                ? readTaskReportFromFile(
                    path.resolve(runArgs.taskReportPath!),
                    instruction.packetId
                  )
                : null
          : args.reportEvidence && host !== 'codex'
            ? ({ projectRoot, instruction, args: runArgs }) => {
                const reportPath = writeMainAgentRunLoopTaskReport(
                  projectRoot,
                  instruction,
                  runArgs
                );
                return readTaskReportFromFile(reportPath, instruction.packetId);
              }
            : undefined,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.status === 'completed' ? 0 : 1;
    }
    case 'claim': {
      const { sessionId } = resolveSessionAndPacketFromSurface(surface, args);
      const state = claimMainAgentPendingPacket(
        root,
        sessionId,
        normalizeText(args.owner) || 'main-agent'
      );
      process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
      return 0;
    }
    case 'dispatch': {
      const { sessionId, packetId } = resolveSessionAndPacketFromSurface(surface, args);
      const state = markMainAgentPacketDispatched(root, sessionId, packetId);
      process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
      return 0;
    }
    case 'complete': {
      const { sessionId, packetId } = resolveSessionAndPacketFromSurface(surface, args);
      const state = completeMainAgentPendingPacket(root, sessionId, packetId);
      process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
      return 0;
    }
    case 'invalidate': {
      const { sessionId, packetId } = resolveSessionAndPacketFromSurface(surface, args);
      const state = invalidateMainAgentPendingPacket(root, sessionId, packetId);
      process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
      return 0;
    }
    default:
      console.error(`main-agent-orchestration: unsupported action=${action}`);
      return 1;
  }
}

export async function mainMainAgentOrchestrationAsync(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const root = pickRoot(args);
  const action = normalizeText(args.action) || 'inspect';
  if (action === 'run-loop') {
    const { flow, stage, noActiveRequirement } = resolveFlowAndStage(root, args);
    if (noActiveRequirement || !flow || !stage) {
      const result = buildNoActiveRequirementRunLoopResult(root, flow, stage);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 1;
    }
    const host = parseOrchestrationHost(args.host);
    const result = await runMainAgentAutomaticLoopAsync({
      projectRoot: root,
      recordId: args.recordId,
      requirementSetId: args.requirementSetId,
      runId: args.runId,
      flow,
      stage,
      host,
      args,
      executor: args.taskReportPath
        ? ({ instruction, args: runArgs }) =>
            process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT === 'true'
              ? readTaskReportFromFile(path.resolve(runArgs.taskReportPath!), instruction.packetId)
              : null
        : args.reportEvidence && host !== 'codex'
          ? ({ projectRoot, instruction, args: runArgs }) => {
              const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, runArgs);
              return readTaskReportFromFile(reportPath, instruction.packetId);
            }
          : undefined,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.status === 'completed' ? 0 : 1;
  }
  if (action !== 'controlled-readiness-audit') {
    return mainMainAgentOrchestration(argv);
  }
  try {
    const result = await runMainAgentControlledReadinessAudit(root, args);
    process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
    return 0;
  } catch (error) {
    console.error(
      `main-agent-orchestration controlled-readiness-audit: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return 1;
  }
}

function isDirectMainAgentOrchestrationCli(): boolean {
  const entry = normalizeText(process.argv[1]);
  return /(^|[\\/])main-agent-orchestration(\.[cm]?js|\.ts)?$/iu.test(entry);
}

if (require.main === module && isDirectMainAgentOrchestrationCli()) {
  void mainMainAgentOrchestrationAsync(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
