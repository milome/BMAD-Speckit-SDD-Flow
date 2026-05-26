import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as yaml from 'js-yaml';
import type {
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
import type { ReviewerLatestCloseoutRecord } from './runtime-context-registry';
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
import { runControlledReadinessAuditBridge } from './controlled-readiness-audit-bridge';

export type MainAgentContinueDecision = 'continue' | 'rerun' | 'blocked' | null;
export type MainAgentOrchestrationSource =
  | 'orchestration_state'
  | 'requirement_record'
  | 'reviewer_closeout'
  | 'implementation_entry_gate'
  | 'none';
export type MainAgentPendingPacketStatus =
  | 'none'
  | 'ready_for_main_agent'
  | 'claimed_by_main_agent'
  | 'dispatched'
  | 'completed'
  | 'invalidated'
  | 'missing_packet_file';

export type PreConfirmationDrilldownSubstate =
  | 'idle'
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
}

export interface MainAgentRunLoopExecutorContext {
  projectRoot: string;
  instruction: MainAgentDispatchInstruction;
  args: Record<string, string | undefined>;
}

export type MainAgentRunLoopExecutor = (
  context: MainAgentRunLoopExecutorContext
) => TaskReport | null;

function deriveNextActionFromTaskType(
  taskType: 'implement' | 'audit' | 'remediate' | 'document',
  stage: string
): OrchestrationNextAction {
  switch (taskType) {
    case 'implement':
      return 'dispatch_review';
    case 'audit':
      return stage === 'post_audit' ? 'run_closeout' : 'await_user';
    case 'remediate':
      return 'rerun_gate';
    case 'document':
    default:
      return 'dispatch_review';
  }
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
  } catch {
    return null;
  }
}

function resolvedContext(runtimeContext: Partial<RuntimeContextFile> | null): ResolvedRuntimeContext | null {
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

function mergeAllowedWriteScope(base: string[], extras: string[]): string[] {
  return Array.from(new Set([...base, ...extras]));
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
  return mapping.allowedWriteScope;
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
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((binding) => {
      const scope = Array.isArray(binding.allowedWriteScope)
        ? binding.allowedWriteScope.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
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
    runtimeContext?.runId,
    runtimeContext?.storyId,
    runtimeContext?.epicId,
    runtimeContext?.artifactRoot,
    runtimeContext?.artifactPath,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  const scored = candidates
    .map((candidate) => {
      const sessionId = path.basename(candidate, '.json');
      const state = readOrchestrationStateAtPath(candidate);
      if (!state) {
        return null;
      }

      let score = 0;
      if (runtimeContext?.flow && state.flow === runtimeContext.flow) {
        score += 50;
      }
      if (runtimeContext?.stage && state.currentPhase === runtimeContext.stage) {
        score += 20;
      }
      for (const hint of hints) {
        const hintLower = hint.toLowerCase();
        if (sessionId.toLowerCase().includes(hintLower)) {
          score += 100;
        }
        if (state.pendingPacket?.packetPath) {
          const packetPath = state.pendingPacket.packetPath.toLowerCase();
          if (packetPath.includes(hintLower)) {
            score += 80;
          }
          score += sharedPathScore(packetPath, hint) * 10;
        }
      }
      if (state.pendingPacket?.status === 'ready_for_main_agent') {
        score += 25;
      }
      return {
        sessionId,
        statePath: candidate,
        state,
        score,
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

function pendingPacketMatchesNextAction(surface: MainAgentOrchestrationSurface): boolean {
  const expectedTaskType = taskTypeFromNextAction(surface.mainAgentNextAction);
  if (!expectedTaskType) {
    return false;
  }
  const actualTaskType = packetTaskType(surface.pendingPacket);
  if (actualTaskType) {
    return actualTaskType === expectedTaskType;
  }
  const packetKind = surface.orchestrationState?.pendingPacket?.packetKind;
  return packetKind === 'resume' || packetKind === 'recommendation';
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
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
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
  confirmationDir: string;
  recordPath: string;
  indexPath: string;
  semanticKernel: string;
  mustDecompositionPacket: string;
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

type CriticalAuditorVerdict =
  | 'no_new_valid_gap'
  | 'no_new_confirmation_blocking_gap'
  | 'new_valid_gap'
  | 'insufficient_audit'
  | 'blocked';

interface CriticalAuditorRoundInput {
  roundIndex: number;
  auditInputHash: string;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  packetHash: string;
  mustRefs: string[];
  sourceRequirementTexts: string[];
  mustPacketCount: number;
  consecutiveNoNewGapRounds: number;
  previousReceipts: Record<string, unknown>[];
}

interface CriticalAuditorRoundResult {
  verdict: CriticalAuditorVerdict;
  gapCandidates?: Record<string, unknown>[];
  validatedGaps?: Record<string, unknown>[];
  rejectedGapCandidates?: Record<string, unknown>[];
  mutationPressureFindings?: Record<string, unknown>[];
  overBroadTaskFindings?: Record<string, unknown>[];
  missingProjectionFindings?: Record<string, unknown>[];
  invalidProofFindings?: Record<string, unknown>[];
  legacyBypassFindings?: Record<string, unknown>[];
  sourceMaterializationFindings?: Record<string, unknown>[];
  rationale?: string;
}

export interface MainAgentPreConfirmationDrilldownResult extends PreConfirmationDrilldownLaneState {
  ok: boolean;
  sourcePath: string;
  requirementSetId: string;
  recordId: string;
  sourceDocumentHash: string | null;
  implementationConfirmationHash: string | null;
  confirmationHtmlPath: string | null;
  confirmationRenderReportPath: string | null;
  confirmability: 'confirmable' | 'blocked';
  deliveryReadiness: Record<string, unknown>;
  finalStandards: Record<string, boolean>;
}

interface PreConfirmationRunOptions {
  source?: string;
  recordId?: string;
  requirementSetId?: string;
  confirmationLanguage?: string;
  mode?: string;
  skipDrilldownArtifacts?: boolean;
  criticalAuditorRound?: (input: CriticalAuditorRoundInput) => CriticalAuditorRoundResult;
  maxCriticalAuditorRounds?: number;
}

interface SourceMustRequirement {
  id: string;
  text: string;
  textZh?: string;
  source: 'explicit_source_must' | 'inline_implementation_confirmation';
  sourceLine: number | null;
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
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'pre-confirmation';
}

function toRootRelativePath(root: string, filePath: string): string {
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
  const relative = path.relative(root, absolute);
  return (!relative.startsWith('..') && !path.isAbsolute(relative) ? relative : absolute).replace(/\\/g, '/');
}

function resolveRootRelativePath(root: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
}

function derivePreConfirmationIdentity(root: string, sourcePath: string, options: PreConfirmationRunOptions): {
  recordId: string;
  requirementSetId: string;
} {
  const sourceStem = sanitizeRequirementIdSegment(path.basename(sourcePath, path.extname(sourcePath))).toUpperCase();
  const recordId = normalizeText(options.recordId) || `REQ-${sourceStem}`;
  const requirementSetId = normalizeText(options.requirementSetId) || recordId;
  return { recordId, requirementSetId };
}

function preConfirmationPaths(root: string, recordId: string): PreConfirmationPaths {
  const recordRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records', recordId);
  const authoringDir = path.join(recordRoot, 'authoring');
  const confirmationDir = path.join(recordRoot, 'confirmation');
  return {
    recordRoot,
    authoringDir,
    confirmationDir,
    recordPath: path.join(recordRoot, 'requirement-record.json'),
    indexPath: path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'index.json'),
    semanticKernel: path.join(authoringDir, 'semantic-kernel.json'),
    mustDecompositionPacket: path.join(authoringDir, 'must_decomposition_packet.json'),
    receiptPaths: [1, 2, 3].map((round) =>
      path.join(authoringDir, `critical-auditor-receipt-round-${round}.json`)
    ),
    reconciliationReport: path.join(authoringDir, 'must_packet_source_reconciliation_report.json'),
    progress: path.join(authoringDir, 'semantic-checkpoint-progress.json'),
    mustDecompositionReceipt: path.join(authoringDir, 'must_decomposition_receipt.json'),
    preRenderMustGate: path.join(authoringDir, 'pre-render-must-decomposition-gate-report.json'),
    preRenderGlobalConsistency: path.join(authoringDir, 'pre-render-global-consistency-report.json'),
    confirmationHtml: path.join(confirmationDir, 'confirmation.html'),
    confirmationSummary: path.join(confirmationDir, 'confirmation-summary.json'),
    confirmationRenderReport: path.join(confirmationDir, 'confirmation-render-report.json'),
  };
}

function extractImplementationConfirmationBlock(sourceText: string): ImplementationConfirmationExtraction | null {
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
    .dump({ implementationConfirmation: confirmation }, { lineWidth: 120, noRefs: true, sortKeys: false })
    .trimEnd();
}

function semanticConfirmationForHash(confirmation: Record<string, unknown>): Record<string, unknown> {
  const bookkeeping = new Set([
    'status',
    'confirmedAt',
    'confirmedBy',
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'reconfirmationRequest',
    'confirmationRender',
  ]);
  return Object.fromEntries(Object.entries(confirmation).filter(([key]) => !bookkeeping.has(key)));
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

function implementationConfirmationHashForPreConfirmation(confirmation: Record<string, unknown>): string {
  return sha256Json(semanticConfirmationForHash(confirmation));
}

function projectionBackRef(packetHash: string, mustRef = 'MUST-001'): Record<string, unknown> {
  return {
    derivedFromMustRef: mustRef,
    derivedFromPacketHash: packetHash,
    projectionStatus: 'synchronized',
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function requirementOrdinal(index: number): string {
  return String(index + 1).padStart(3, '0');
}

function normalizeMustRef(value: unknown, index: number): string {
  const candidate = normalizeText(value).toUpperCase();
  return /^MUST-\d+$/u.test(candidate) ? candidate : `MUST-${requirementOrdinal(index)}`;
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
    ? [...extraction.lines.slice(0, extraction.start), ...extraction.lines.slice(extraction.end)].join('\n')
    : sourceText;
  const rows: SourceMustRequirement[] = [];
  semanticText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((line, index) => {
      const match = line.match(/^\s*(?:[-*]\s*)?(?:\[(MUST-\d+)\]\s*)?MUST(?:-\d+)?\s*[:：]\s*(.+?)\s*$/iu);
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

function extractInlineMustRequirements(confirmation: Record<string, unknown>): SourceMustRequirement[] {
  const rows = Array.isArray(confirmation.must) ? confirmation.must : [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row))
    .map((row, index) => ({
      id: normalizeMustRef(row.id, index),
      text: normalizeText(row.text),
      textZh: normalizeText(row.textZh) || undefined,
      source: 'inline_implementation_confirmation' as const,
      sourceLine: null,
    }))
    .filter((row) => Boolean(row.text));
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

function buildPreConfirmationImplementationConfirmation(input: {
  root: string;
  sourcePath: string;
  recordId: string;
  requirementSetId: string;
  language: string;
  paths: PreConfirmationPaths;
  packetHash: string;
  semanticKernelHash: string;
  latestReceiptHash: string;
  mustRequirements: SourceMustRequirement[];
}): Record<string, unknown> {
  const rel = (filePath: string) => toRootRelativePath(input.root, filePath);
  const backRef = projectionBackRef(input.packetHash);
  const mustRefs = input.mustRequirements.map((requirement) => requirement.id);
  const mustTexts = input.mustRequirements.map((requirement) => requirement.text);
  const mustRows = input.mustRequirements.map((requirement) => ({
    id: requirement.id,
    text: requirement.text,
    ...(requirement.textZh ? { textZh: requirement.textZh } : {}),
    source: requirement.source,
    sourceLine: requirement.sourceLine,
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
    const [authorTaskId, materializeTaskId] = atomicTaskIdsForMust(index, input.mustRequirements.length);
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
  const acceptanceTestFile = path.resolve(
    __dirname,
    '..',
    'tests',
    'acceptance',
    'main-agent-pre-confirmation-drilldown-lane.test.ts'
  );
  return {
    contractSchemaVersion: 1,
    status: 'draft',
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
    confirmationLanguage: input.language,
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
        consecutiveNoNewGapRounds: 3,
        latestReceiptHash: input.latestReceiptHash,
        convergenceVerdict: 'bounded_no_new_gap',
      },
      packetSourceReconciliation: {
        reportPath: rel(input.paths.reconciliationReport),
        verdict: 'pass',
      },
      preRenderGateReportPath: rel(input.paths.preRenderMustGate),
      globalConsistencyReportPath: rel(input.paths.preRenderGlobalConsistency),
    },
    applicability: {
      governanceEvents: { applies: false, reasonCode: 'no_governance_event_or_control_envelope_changes' },
      runtimeRecovery: {
        applies: false,
        reasonCode: 'no_resume_rerun_closeout_hook_ingest_or_trace_checkpoint_changes',
        requiresFunctionalResumeFailureCaseRegistry: false,
        activeRequirementResolutionRequired: false,
        retiredContextSurfaceForbidden: true,
      },
      scoringDashboardSft: { applies: false, reasonCode: 'no_scoring_dashboard_sft_dataset_or_read_model_changes' },
      currentTargetMap: { applies: true, reasonCode: 'pre_confirmation_drilldown_requires_current_target_map' },
      scriptsAndHooks: { applies: false, reasonCode: 'no_script_hook_report_or_generated_artifact_changes' },
      aiTddContractGate: { applies: true, reasonCode: 'pre_confirmation_drilldown_requires_ai_tdd_manifest_projection' },
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
        whyItBlocksCompletion: 'Confirmation scope quality is separate from implementation completion evidence.',
        whyItBlocksCompletionZh: '需求范围确认质量与实现完成证据是不同层级。',
        negativeAssertionRequired: true,
        coveredByFailurePath: ['FAIL-001'],
        ...backRef,
      },
    ],
    mustNot: [
      {
        id: 'OUT-001',
        text: 'Forbidden: creating an additional mental model or a separate controller authority.',
        textZh: '禁止新增第七个心智模型，也禁止新增独立主控权威。',
        scopeBoundary: 'Main Agent keeps the lane under the first mental model.',
        scopeBoundaryZh: '主 Agent 将该 lane 保持在第一个心智模型内。',
        userApprovalRequiredIfChanged: true,
      },
    ],
    mustExecutionDecompositionMatrix: matrixRows,
    atomicImplementationTaskList: taskRows,
    evidence: [
      {
        id: 'EVD-001',
        text: `Gate and renderer reports prove the source-derived requirements are user-confirmable but not delivery ready: ${mustTexts.join(' | ')}`,
        textZh: '门禁和渲染报告证明需求确认 lane 可由用户确认，但不代表交付就绪。',
        gate: 'main-agent-orchestration --action pre-confirmation-drilldown',
        oracle: 'All drilldown artifacts, bidirectional reconciliation, pre-render gates, and renderer confirmability pass while deliveryReadiness.ready remains false before controlled ingest.',
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
        trigger: 'Semantic kernel, packet, receipts, reconciliation, pre-render gate report, or renderer drilldown section is missing.',
        triggerZh: '缺少 semantic kernel、packet、receipt、reconciliation、预渲染门禁报告或 renderer drilldown 区块。',
        expectedBehavior: 'Fail closed and keep currentMentalModel=requirement_confirmation.',
        expectedBehaviorZh: '必须 fail closed，并保持 currentMentalModel=requirement_confirmation。',
        forbiddenBehavior: 'Advance to architecture_confirmation or delivery readiness.',
        forbiddenBehaviorZh: '不得推进到 architecture_confirmation，也不得进入交付就绪。',
        blocksCompletionWhenViolated: true,
        linkedNegIds: ['NEG-001'],
        linkedEvidenceIds: ['EVD-001'],
        traceRows: ['TRACE-001'],
        viewRefs: ['EDGEVIEW-001'],
        requiredAssertions: ['confirmability is blocked when drilldown surfaces are missing'],
        ...backRef,
      },
    ],
    edgeCases: [
      {
        id: 'EDGE-001',
        category: 'missing_projection',
        condition: 'A source row is invented outside synchronized packet projections.',
        conditionZh: 'source row 在 synchronized packet projection 之外被独立发明。',
        expectedBehavior: 'Packet/source reconciliation fails bidirectionally.',
        expectedBehaviorZh: 'packet/source reconciliation 必须双向失败。',
        forbiddenBehavior: 'Renderer allows confirmation from independently invented source rows.',
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
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001'],
        failurePathRefs: ['FAIL-001'],
        edgeCaseRefs: ['EDGE-001'],
        expectedPreImplementationState: 'expected_red',
        oracle: 'Main Agent lane cannot reach user_confirmable unless atomic decomposition loop, three receipt rounds, reconciliation, and gates pass.',
        positiveControl: true,
        negativeControls: ['NEG-001'],
        mockOnly: false,
        ...backRef,
      },
    ],
    e2eSuites: [
      {
        id: 'E2E-001',
        file: acceptanceTestFile,
        covers: ['NEG-001', ...mustRefs],
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        commandRefs: ['CMD-001'],
        failurePathRefs: ['FAIL-001'],
        edgeCaseRefs: ['EDGE-001'],
        expectedPreImplementationState: 'expected_red',
        oracle: 'Before controlled ingest, the surface remains in requirement_confirmation and nextMentalModel is null.',
        positiveControl: true,
        negativeControls: ['NEG-001'],
        mockOnly: false,
        ...backRef,
      },
    ],
    requirementBoundary: {
      business: {
        description: 'No consumer product behavior is confirmed by this lane.',
        requirementIds: [],
        viewRefs: [],
        diagramRefs: [],
      },
      governance: {
        description: 'Requirement confirmation drilldown quality gate.',
        requirementIds: [...mustRefs, 'NEG-001'],
        viewRefs: ['SEQ-001', 'FLOW-001', 'EDGEVIEW-001', 'BOUND-001'],
        diagramRefs: ['SEQ-001', 'FLOW-001'],
      },
    },
    sequenceViews: [
      {
        id: 'SEQ-001',
        title: 'Requirement confirmation drilldown lane',
        scope: 'governance',
        covers: [...mustRefs, 'NEG-001', 'EVD-001'],
        mermaid:
          `sequenceDiagram\n  participant M as MainAgent\n  participant G as Gates\n  participant U as User\n  M->>G: source-derived atomic drilldown before materialization [${mustRefs.join(', ')}]\n  G-->>M: PASS [EVD-001]\n  M-->>U: user_confirmable, not delivery ready [NEG-001]`,
      },
    ],
    flowViews: [
      {
        id: 'FLOW-001',
        title: 'Pre-confirmation lane state flow',
        scope: 'governance',
        covers: [...mustRefs, 'NEG-001'],
        mermaid:
          `flowchart TD\n  A[Source MUST atomic loop ${mustRefs.join(' + ')}] --> B[TRACE-001 synchronized projection]\n  B --> C[EVD-001 render confirmable]\n  C --> D[NEG-001 no delivery readiness]`,
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
          detail: 'The source is not yet user confirmed and cannot enter architecture confirmation.',
        },
      ],
      targetSummary: [
        {
          id: 'CT-TGT-001',
          title: 'User-confirmable requirement',
          detail: 'Semantic kernel, atomic packet, receipts, reconciliation, gates, and HTML are synchronized.',
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
    targetModificationPaths: [
      {
        id: 'TARGET-MOD-001',
        path: 'scripts/main-agent-orchestration.ts',
        changeType: 'modify',
        coverageRole: 'modify',
        intent: 'Expose requirement_confirmation.pre_confirmation_drilldown lane inside Main Agent orchestration.',
        ownerModel: 'requirement_confirmation',
        requirementRefs: [...mustRefs, 'NEG-001'],
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        artifactRefs: ['ART-001'],
        requiresReconfirmationOnChange: true,
        ...backRef,
      },
      {
        id: 'TARGET-MOD-002',
        path: 'tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts',
        changeType: 'validation_only',
        coverageRole: 'validation_only',
        intent: 'Validate the lane and fail-closed behavior.',
        ownerModel: 'acceptance_tests',
        requirementRefs: [...mustRefs, 'NEG-001'],
        traceRefs: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        artifactRefs: [],
        requiresReconfirmationOnChange: false,
        ...backRef,
      },
      {
        id: 'TARGET-MOD-003',
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
        id: 'TARGET-MOD-004',
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
    ],
    requiredCommands: [
      {
        id: 'CMD-001',
        command:
          'npx vitest run tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts',
        purpose: 'Validate Main Agent pre-confirmation drilldown lane behavior.',
        targetFiles: ['tests/acceptance/main-agent-pre-confirmation-drilldown-lane.test.ts'],
        traceRows: ['TRACE-001'],
        evidenceRefs: ['EVD-001'],
        ...backRef,
      },
    ],
    suggestedCommands: [],
    closeoutReadinessPreview: {
      requiredCommands: ['CMD-001'],
      orphanPolicy: 'Generated confirmation artifacts are not completion proof.',
      currentAttemptPolicy: 'deliveryReadiness.ready remains false before controlled ingest and implementation evidence.',
      recordClosedPolicy: 'Requirement confirmation alone never closes implementation.',
      ...backRef,
    },
    architectureImpacts: [
      {
        id: 'ARCH-001',
        title: 'Mental model progression boundary',
        impact: 'Only controlled ingest may allow progression from requirement_confirmation to architecture_confirmation.',
        requirementRefs: [...mustRefs, 'NEG-001', 'OUT-001'],
      },
    ],
  };
}

function materializeImplementationConfirmationSource(
  sourcePath: string,
  confirmation: Record<string, unknown>
): string {
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extraction = extractImplementationConfirmationBlock(sourceText);
  const dumped = dumpImplementationConfirmation(confirmation);
  if (!extraction) {
    const next = `${sourceText.replace(/\s*$/u, '')}\n\n${dumped}\n`;
    fs.writeFileSync(sourcePath, next, 'utf8');
    return next;
  }
  const lines = [...extraction.lines];
  lines.splice(extraction.start, extraction.end - extraction.start, ...dumped.split('\n'));
  const next = lines.join('\n');
  fs.writeFileSync(sourcePath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');
  return next.endsWith('\n') ? next : `${next}\n`;
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
    throw new Error(`implementationConfirmation block missing after materialization: ${sourcePath}`);
  }
  return {
    sourceText,
    extraction,
    sourceDocumentHash: sourceDocumentHashForPreConfirmation(
      sourceText,
      extraction.blockText,
      extraction.confirmation
    ),
    implementationConfirmationHash: implementationConfirmationHashForPreConfirmation(extraction.confirmation),
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
    goal:
      'Prepare requirement scope confirmation through semantic drilldown without proving implementation completion.',
    currentState: input.mustRequirements.map(
      (requirement) => `${requirement.id} is an authored source requirement awaiting packet-backed drilldown.`
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
}): Record<string, unknown> {
  const rel = (filePath: string) => toRootRelativePath(input.root, filePath);
  const materialized = (target: string) => [target];
  const mustRefs = input.mustRequirements.map((requirement) => requirement.id);
  const mustTexts = input.mustRequirements.map((requirement) => requirement.text);
  const totalMusts = input.mustRequirements.length;
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
    consecutiveNoNewValidGapRounds: 3,
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
          materializedTo: materialized(`implementationConfirmation.atomicImplementationTaskList[${authorTaskId}]`),
        },
        {
          id: materializeTaskId,
          targetFiles: [rel(input.sourcePath), rel(input.paths.confirmationHtml)],
          redProofPlan: `Renderer blocks if packet/source reconciliation omits ${requirement.id}.`,
          primaryObservableBehaviors: [`${requirement.id} is materialized into confirmation source`],
          primaryAcceptanceOracles: [`${requirement.id} is visible in confirmation-render-report`],
          derivedFromMustRef: requirement.id,
          materializedTo: materialized(`implementationConfirmation.atomicImplementationTaskList[${materializeTaskId}]`),
        },
      ];
      return {
        mustRef: requirement.id,
        mustIntent: requirement.text,
        sourceRequirementText: requirement.text,
        sourceRequirementLine: requirement.sourceLine,
        sourceRequirementAuthority: requirement.source,
        decompositionBasis: {
          observableBehaviors: [
            `${requirement.id} is preserved from source text`,
            `${requirement.id} is split into authoring and materialization tasks`,
            `${requirement.id} is materialized only through packet projections`,
            `${requirement.id} is visible in the confirmation HTML`,
          ],
          targetSurfaces: [
            'scripts/main-agent-orchestration.ts',
            rel(input.paths.preRenderMustGate),
            rel(input.paths.confirmationHtml),
          ],
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
            materializedTo: materialized(`implementationConfirmation.mustExecutionDecompositionMatrix[${matrixId}]`),
          },
        ],
        mustAtomicTasks: taskRows,
        mustEvidenceProjection: [
          { id: 'EVD-001', materializedTo: materialized('implementationConfirmation.evidence[EVD-001]') },
        ],
        mustTraceProjection: [
          { id: 'TRACE-001', materializedTo: materialized('implementationConfirmation.traceRows[TRACE-001]') },
        ],
        mustAcceptanceProjection: [
          { id: 'ACC-001', materializedTo: materialized('implementationConfirmation.acceptanceTests[ACC-001]') },
          { id: 'E2E-001', materializedTo: materialized('implementationConfirmation.e2eSuites[E2E-001]') },
        ],
        mustFailureEdgeProjection: [
          { id: 'FAIL-001', materializedTo: materialized('implementationConfirmation.failurePaths[FAIL-001]') },
          { id: 'EDGE-001', materializedTo: materialized('implementationConfirmation.edgeCases[EDGE-001]') },
        ],
        mustTargetPathProjection: [
          {
            id: 'TARGET-MOD-001',
            materializedTo: materialized('implementationConfirmation.targetModificationPaths[TARGET-MOD-001]'),
          },
          {
            id: 'TARGET-MOD-002',
            materializedTo: materialized('implementationConfirmation.targetModificationPaths[TARGET-MOD-002]'),
          },
          {
            id: 'TARGET-MOD-003',
            materializedTo: materialized('implementationConfirmation.targetModificationPaths[TARGET-MOD-003]'),
          },
          {
            id: 'TARGET-MOD-004',
            materializedTo: materialized('implementationConfirmation.targetModificationPaths[TARGET-MOD-004]'),
          },
        ],
        mustCurrentTargetProjection: [
          { id: 'CT-CANON-001', materializedTo: materialized('implementationConfirmation.currentTargetMap') },
        ],
        mustAiTddManifestProjection: [
          {
            id: 'AI-TDD-001',
            materializedTo: materialized('implementationConfirmation.aiTddContractExecutionManifestProjection'),
          },
        ],
        mustArtifactProjection: [
          { id: 'ART-001', materializedTo: materialized('implementationConfirmation.artifactAutomationPlan[ART-001]') },
          { id: 'ART-002', materializedTo: materialized('implementationConfirmation.artifactAutomationPlan[ART-002]') },
        ],
        mustCommandProjection: [
          { id: 'CMD-001', materializedTo: materialized('implementationConfirmation.requiredCommands[CMD-001]') },
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

function buildCriticalAuditorReceipt(input: {
  roundIndex: number;
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
    inputHash: input.auditInputHash,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    contentHash: input.packetHash,
    createdBy: 'critical_auditor.requirement_confirmation.pre_confirmation_drilldown',
    createdAt: input.createdAt,
    inputRefs: ['semantic-kernel.json', 'must_decomposition_packet.json', 'implementationConfirmation'],
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

function isNoNewGapVerdict(verdict: CriticalAuditorVerdict): boolean {
  return verdict === 'no_new_valid_gap' || verdict === 'no_new_confirmation_blocking_gap';
}

function runCriticalAuditorReceiptLoop(input: {
  paths: PreConfirmationPaths;
  auditInputHash: string;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  packetHash: string;
  mustRefs: string[];
  sourceRequirementTexts: string[];
  mustPacketCount: number;
  createdAt: string;
  roundProvider?: (round: CriticalAuditorRoundInput) => CriticalAuditorRoundResult;
  maxRounds?: number;
}): {
  latestReceiptHash: string | null;
  consecutiveNoNewGapRounds: number;
  receipts: Record<string, unknown>[];
  issues: PreConfirmationDrilldownIssue[];
} {
  if (!input.roundProvider) {
    return {
      latestReceiptHash: null,
      consecutiveNoNewGapRounds: 0,
      receipts: [],
      issues: [
        preConfirmationIssue(
          'critical_auditor_round_provider_missing',
          'A real Critical Auditor round provider is required; synthetic clean receipts are not allowed',
          ['critical_auditor_receipt_loop'],
          'critical_auditor'
        ),
      ],
    };
  }
  const provider = input.roundProvider;
  const maxRounds = Math.max(input.maxRounds ?? 12, 3);
  const receipts: Record<string, unknown>[] = [];
  const issues: PreConfirmationDrilldownIssue[] = [];
  let latestReceiptHash: string | null = null;
  let consecutiveNoNewGapRounds = 0;

  for (let roundIndex = 1; roundIndex <= maxRounds && consecutiveNoNewGapRounds < 3; roundIndex += 1) {
    const auditResult = provider({
      roundIndex,
      auditInputHash: input.auditInputHash,
      recordId: input.recordId,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      packetHash: input.packetHash,
      mustRefs: input.mustRefs,
      sourceRequirementTexts: input.sourceRequirementTexts,
      mustPacketCount: input.mustPacketCount,
      consecutiveNoNewGapRounds,
      previousReceipts: receipts,
    });
    const receipt = buildCriticalAuditorReceipt({
      roundIndex,
      auditInputHash: input.auditInputHash,
      recordId: input.recordId,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
      packetHash: input.packetHash,
      createdAt: input.createdAt,
      auditResult,
    });
    latestReceiptHash = normalizeText(receipt.receiptHash);
    receipts.push(receipt);
    writeJsonUtf8(
      path.join(input.paths.authoringDir, `critical-auditor-receipt-round-${roundIndex}.json`),
      { criticalAuditorReceipt: receipt }
    );

    const verdict = auditResult.verdict;
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

    const unresolvedGaps = (auditResult.validatedGaps ?? []).filter((gap) => {
      const status = normalizeText(gap.status ?? gap.resolutionStatus);
      return !['resolved', 'converted_to_out_boundary', 'converted_to_open_question', 'rejected'].includes(status);
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
      normalizeText(existing.implementationConfirmationHash) || input.implementationConfirmationHash,
    createdBy: normalizeText(existing.createdBy) || input.createdBy,
    createdAt: normalizeText(existing.createdAt) || input.createdAt,
    inputRefs: Array.isArray(existing.inputRefs) ? existing.inputRefs : input.inputRefs,
  };
  const hashKey = normalizeText((enhanced as Record<string, unknown>).receiptHash) ? 'receiptHash' : 'contentHash';
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
      path: toRootRelativePath(input.root, path.join(input.paths.recordRoot, 'recovery', 'recovery-context.json')),
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
  const candidates = [
    path.join(root, '.codex', 'skills', 'requirements-contract-authoring'),
    path.join(root, '_bmad', 'skills', 'requirements-contract-authoring'),
    path.join(root, '.agents', 'skills', 'requirements-contract-authoring'),
    path.resolve(__dirname, '..', '.codex', 'skills', 'requirements-contract-authoring'),
    path.resolve(__dirname, '..', '_bmad', 'skills', 'requirements-contract-authoring'),
    ...(home
      ? [
          path.join(home, '.codex', 'skills', 'requirements-contract-authoring'),
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

function runNodeJson(scriptPath: string, args: string[], cwd: string): {
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
      json = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
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

function commandFailureIssue(code: string, scriptPath: string, command: ReturnType<typeof runNodeJson>): PreConfirmationDrilldownIssue {
  const output = (command.stderr.trim() || command.stdout.trim()).slice(0, 600);
  return preConfirmationIssue(
    code,
    `Skill-local script failed or did not emit its required report: ${scriptPath}${output ? `; output: ${output}` : ''}`,
    [scriptPath],
    'skill_script_resolution'
  );
}

function collectBlockingIssuesFromReports(...reports: Array<Record<string, unknown> | null>): PreConfirmationDrilldownIssue[] {
  return reports.flatMap((report) => {
    if (!report) {
      return [];
    }
    const issueRows = [
      ...(Array.isArray(report.blockingIssues) ? report.blockingIssues : []),
      ...(Array.isArray(report.issues) ? report.issues : []),
    ];
    const normalized = issueRows
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
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
      preConfirmationIssue(String(code), `pre-confirmation gate failed: ${String(code)}`, [String(code)], 'pre_confirmation_gate')
    );
  });
}

function artifactMap(root: string, paths: PreConfirmationPaths): Record<string, string> {
  return {
    semanticKernel: toRootRelativePath(root, paths.semanticKernel),
    mustDecompositionPacket: toRootRelativePath(root, paths.mustDecompositionPacket),
    criticalAuditorReceiptRound1: toRootRelativePath(root, paths.receiptPaths[0]),
    criticalAuditorReceiptRound2: toRootRelativePath(root, paths.receiptPaths[1]),
    criticalAuditorReceiptRound3: toRootRelativePath(root, paths.receiptPaths[2]),
    criticalAuditorReceiptDirectory: toRootRelativePath(root, paths.authoringDir),
    criticalAuditorReceiptGlob: `${toRootRelativePath(root, paths.authoringDir)}/critical-auditor-receipt-round-*.json`,
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
  finalStandards?: Record<string, boolean>;
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
    currentMentalModel: 'requirement_confirmation',
    lane: 'pre_confirmation_drilldown',
    substate: input.substate,
    currentSubstate: input.substate,
    nextAction: confirmable ? 'await_exact_confirmation_phrase_with_hashes' : 'repair_non_semantic_gap',
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
    confirmationHtmlPath: fs.existsSync(input.paths.confirmationHtml)
      ? toRootRelativePath(input.root, input.paths.confirmationHtml)
      : null,
    confirmationRenderReportPath: fs.existsSync(input.paths.confirmationRenderReport)
      ? toRootRelativePath(input.root, input.paths.confirmationRenderReport)
      : null,
    confirmability: confirmable ? 'confirmable' : 'blocked',
    deliveryReadiness,
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
  paths: PreConfirmationPaths;
  recordId: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  createdAt: string;
  mustGateReport: Record<string, unknown> | null;
  globalGateReport: Record<string, unknown> | null;
  substate: PreConfirmationDrilldownSubstate;
}): void {
  const criticalAuditor = input.mustGateReport?.criticalAuditor as Record<string, unknown> | undefined;
  const consecutiveNoNewValidGapRounds = Number(criticalAuditor?.consecutiveNoNewGapRounds ?? 0);
  writeJsonUtf8(input.paths.progress, {
    schemaVersion: 'semantic-checkpoint-progress/v1',
    recordId: input.recordId,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
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
    checkpoints: [
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
      { id: 'packet_source_reconciliation', status: input.mustGateReport?.packetSourceReconciliation ? 'completed' : 'blocked' },
      { id: 'pre_render_must_decomposition_gate', status: input.mustGateReport?.verdict === 'PASS' ? 'completed' : 'blocked' },
      { id: 'pre_render_global_consistency_gate', status: input.globalGateReport?.verdict === 'PASS' ? 'completed' : 'blocked' },
    ],
    validation: {
      mustDecomposition: input.mustGateReport?.verdict === 'PASS' ? 'pass' : 'fail',
      packetSourceReconciliation:
        (input.mustGateReport?.packetSourceReconciliation as Record<string, unknown> | undefined)?.verdict === 'pass'
          ? 'pass'
          : 'fail',
      globalConsistency: input.globalGateReport?.verdict === 'PASS' ? 'pass' : 'fail',
      preRenderGate:
        input.mustGateReport?.verdict === 'PASS' && input.globalGateReport?.verdict === 'PASS' ? 'pass' : 'fail',
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
      Number(input.mustGateReport?.criticalAuditor && (input.mustGateReport.criticalAuditor as Record<string, unknown>).consecutiveNoNewGapRounds) >= 3,
    mustDecompositionPacketSynchronizedBeforeMaterialization:
      packet?.status === 'synchronized' && lifecycle.materializedAfterStatus === 'synchronized',
    sourceRowsMaterializedOnlyFromPacketProjections:
      (input.mustGateReport?.packetSourceReconciliation as Record<string, unknown> | undefined)?.verdict === 'pass',
    packetSourceReconciliationPassesBidirectionally:
      (input.mustGateReport?.packetSourceReconciliation as Record<string, unknown> | undefined)?.verdict === 'pass',
    preRenderGateBlocksMissingCoreSurfaces:
      input.missingSurfaceProbe?.substate === 'blocked_by_render_gate' &&
      input.missingSurfaceProbe.blockingIssues.some((issue) => issue.code === 'missing_semantic_kernel'),
    rendererShowsFullDrilldownInteraction:
      renderSections.includes('pre-confirmation-semantic-drilldown') &&
      Boolean(input.renderReport?.preConfirmationSemanticDrilldown) &&
      (input.renderReport?.preConfirmationSemanticDrilldown as Record<string, unknown> | undefined)?.status === 'pass',
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
  if (!sourceArg) {
    throw new Error('pre-confirmation-drilldown requires --source <source-document.md>');
  }
  const sourcePath = resolveRootRelativePath(root, sourceArg);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`source document not found: ${sourcePath}`);
  }
  const identity = derivePreConfirmationIdentity(root, sourcePath, options);
  const paths = preConfirmationPaths(root, identity.recordId);
  const createdAt = new Date().toISOString();
  const language = normalizeText(options.confirmationLanguage) || 'zh-CN';
  const mustRequirements = resolveSourceMustRequirements(sourcePath);
  if (mustRequirements.length === 0) {
    const issue = preConfirmationIssue(
      'controlled_must_candidates_missing',
      'No explicit MUST: rows or inline implementationConfirmation.must[] entries were found; authoring must generate controlled MUST candidates before packet materialization.',
      [toRootRelativePath(root, sourcePath), 'implementationConfirmation.must'],
      'semantic_kernel_authoring'
    );
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_semantic_gap',
      issues: [issue],
      finalStandards: {
        newSkillFlowEntersAtomicDecompositionLoopBeforeMaterialization: false,
        mustDecompositionPacketSynchronizedBeforeMaterialization: false,
      },
    });
  }

  if (normalizeText(options.mode) === 'single_pass') {
    const issue = preConfirmationIssue(
      'single_pass_cannot_skip_atomic_decomposition_loop',
      'single_pass cannot skip the mandatory pre-confirmation atomic decomposition loop',
      ['atomic_decomposition_loop']
    );
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_under_split_task',
      issues: [issue],
      finalStandards: { singlePassCannotSkipAtomicDecompositionLoop: true },
    });
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

  const provisionalConfirmation = buildPreConfirmationImplementationConfirmation({
    root,
    sourcePath,
    recordId: identity.recordId,
    requirementSetId: identity.requirementSetId,
    language,
    paths,
    packetHash,
    semanticKernelHash: semanticKernelHashSeed,
    latestReceiptHash: receiptHashSeed,
    mustRequirements,
  });
  materializeImplementationConfirmationSource(sourcePath, provisionalConfirmation);
  const materialized = readMaterializedConfirmation(sourcePath);

  writePreConfirmationRequirementRecord({
    root,
    sourcePath,
    recordId: identity.recordId,
    requirementSetId: identity.requirementSetId,
    paths,
    laneState: 'source_materialized',
    sourceDocumentHash: materialized.sourceDocumentHash,
    implementationConfirmationHash: materialized.implementationConfirmationHash,
    confirmationPageHash: null,
    renderReportPath: null,
    createdAt,
  });

  if (options.skipDrilldownArtifacts) {
    const mustGateScript = resolveSkillScript(root, 'pre_render_must_decomposition_gate.js');
    const gate = runNodeJson(
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
    const report = gate.json ?? readJsonIfExists(paths.preRenderMustGate);
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: collectBlockingIssuesFromReports(report),
      mustGateReport: report,
      sourceDocumentHash: materialized.sourceDocumentHash,
      implementationConfirmationHash: materialized.implementationConfirmationHash,
    });
  }

  const kernel = buildSemanticKernel({
    root,
    sourcePath,
    recordId: identity.recordId,
    sourceDocumentHash: materialized.sourceDocumentHash,
    implementationConfirmationHash: materialized.implementationConfirmationHash,
    createdAt,
    mustRequirements,
  });
  writeJsonUtf8(paths.semanticKernel, { semanticKernel: kernel });
  const semanticKernelHash = normalizeText(kernel.kernelHash);
  const confirmation = buildPreConfirmationImplementationConfirmation({
    root,
    sourcePath,
    recordId: identity.recordId,
    requirementSetId: identity.requirementSetId,
    language,
    paths,
    packetHash,
    semanticKernelHash,
    latestReceiptHash: receiptHashSeed,
    mustRequirements,
  });
  materializeImplementationConfirmationSource(sourcePath, confirmation);
  const rematerialized = readMaterializedConfirmation(sourcePath);

  const packet = buildMustDecompositionPacket({
    root,
    sourcePath,
    paths,
    recordId: identity.recordId,
    sourceDocumentHash: rematerialized.sourceDocumentHash,
    implementationConfirmationHash: rematerialized.implementationConfirmationHash,
    semanticKernelHash,
    packetHash,
    createdAt,
    mustRequirements,
  });
  writeJsonUtf8(paths.mustDecompositionPacket, { must_decomposition_packet: packet });

  let latestReceiptHash = receiptHashSeed;

  const finalConfirmation = buildPreConfirmationImplementationConfirmation({
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
  });
  materializeImplementationConfirmationSource(sourcePath, finalConfirmation);
  const finalMaterialized = readMaterializedConfirmation(sourcePath);

  const finalKernel: Record<string, unknown> = {
    ...kernel,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
  };
  finalKernel.kernelHash = sha256Json({ ...finalKernel, kernelHash: null, contentHash: null });
  finalKernel.contentHash = finalKernel.kernelHash;
  writeJsonUtf8(paths.semanticKernel, { semanticKernel: finalKernel });

  const finalPacket = buildMustDecompositionPacket({
    root,
    sourcePath,
    paths,
    recordId: identity.recordId,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    semanticKernelHash: normalizeText(finalKernel.kernelHash),
    packetHash,
    createdAt,
    mustRequirements,
  });
  writeJsonUtf8(paths.mustDecompositionPacket, { must_decomposition_packet: finalPacket });

  const finalAuditInputHash = sha256Json({
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    semanticKernelHash: normalizeText(finalKernel.kernelHash),
    packetHash,
  });
  const criticalAuditorLoop = runCriticalAuditorReceiptLoop({
    paths,
    auditInputHash: finalAuditInputHash,
    recordId: identity.recordId,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    packetHash,
    mustRefs: mustRequirements.map((requirement) => requirement.id),
    sourceRequirementTexts: mustRequirements.map((requirement) => requirement.text),
    mustPacketCount: mustRequirements.length,
    createdAt,
    roundProvider: options.criticalAuditorRound,
    maxRounds: options.maxCriticalAuditorRounds,
  });
  latestReceiptHash = criticalAuditorLoop.latestReceiptHash ?? latestReceiptHash;

  if (criticalAuditorLoop.issues.length > 0) {
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: criticalAuditorLoop.issues,
      sourceDocumentHash: finalMaterialized.sourceDocumentHash,
      implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
      finalStandards: {
        newSkillFlowEntersAtomicDecompositionLoopBeforeMaterialization: true,
        singlePassCannotSkipAtomicDecompositionLoop: true,
        threeConsecutiveNoNewValidGapRoundsRequired: false,
        mustDecompositionPacketSynchronizedBeforeMaterialization: true,
      },
    });
  }

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
  let mustGateReport = mustGate.json ?? readJsonIfExists(paths.preRenderMustGate);
  if (!mustGateReport) {
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: [commandFailureIssue('pre_render_must_decomposition_gate_report_missing', mustGateScript, mustGate)],
      sourceDocumentHash: finalMaterialized.sourceDocumentHash,
      implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    });
  }
  enhanceArtifactMetadata(paths.reconciliationReport, {
    recordId: identity.recordId,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    createdBy: 'pre_render_must_decomposition_gate',
    createdAt,
    inputRefs: [toRootRelativePath(root, sourcePath), toRootRelativePath(root, paths.mustDecompositionPacket)],
  });
  mustGateReport = enhanceArtifactMetadata(paths.preRenderMustGate, {
    recordId: identity.recordId,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    createdBy: 'pre_render_must_decomposition_gate',
    createdAt,
    inputRefs: [toRootRelativePath(root, sourcePath), toRootRelativePath(root, paths.mustDecompositionPacket)],
  }) ?? mustGateReport;

  const checkpointScript = resolveSkillScript(root, 'run_semantic_checkpoints.js');
  const combinedGate = runNodeJson(
    checkpointScript,
    ['--source', sourcePath, '--progress', paths.progress, '--mode', 'pre-render-gate', '--json'],
    root
  );
  const combinedReport = combinedGate.json;
  if (!combinedReport) {
    return buildPreConfirmationResult({
      root,
      sourcePath,
      recordId: identity.recordId,
      requirementSetId: identity.requirementSetId,
      paths,
      substate: 'blocked_by_render_gate',
      issues: [commandFailureIssue('pre_render_global_consistency_gate_report_missing', checkpointScript, combinedGate)],
      mustGateReport,
      sourceDocumentHash: finalMaterialized.sourceDocumentHash,
      implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    });
  }
  const globalGateReport =
    (combinedReport?.globalConsistencyGate &&
    typeof combinedReport.globalConsistencyGate === 'object' &&
    !Array.isArray(combinedReport.globalConsistencyGate)
      ? (combinedReport.globalConsistencyGate as Record<string, unknown>)
      : readJsonIfExists(paths.preRenderGlobalConsistency)) ?? null;
  enhanceArtifactMetadata(paths.reconciliationReport, {
    recordId: identity.recordId,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    createdBy: 'pre_render_must_decomposition_gate',
    createdAt,
    inputRefs: [toRootRelativePath(root, sourcePath), toRootRelativePath(root, paths.mustDecompositionPacket)],
  });
  mustGateReport = enhanceArtifactMetadata(paths.preRenderMustGate, {
    recordId: identity.recordId,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    createdBy: 'pre_render_must_decomposition_gate',
    createdAt,
    inputRefs: [
      toRootRelativePath(root, sourcePath),
      toRootRelativePath(root, paths.semanticKernel),
      toRootRelativePath(root, paths.mustDecompositionPacket),
      toRootRelativePath(root, paths.reconciliationReport),
    ],
  }) ?? mustGateReport;
  enhanceArtifactMetadata(paths.preRenderGlobalConsistency, {
    recordId: identity.recordId,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    createdBy: 'run_semantic_checkpoints.pre_render_global_consistency',
    createdAt,
    inputRefs: [toRootRelativePath(root, sourcePath), toRootRelativePath(root, paths.preRenderMustGate)],
  });

  updatePreConfirmationProgress({
    root,
    paths,
    recordId: identity.recordId,
    sourceDocumentHash: finalMaterialized.sourceDocumentHash,
    implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
    createdAt,
    mustGateReport,
    globalGateReport,
    substate: mustGateReport?.verdict === 'PASS' && globalGateReport?.verdict === 'PASS' ? 'pre_render_ready' : 'blocked_by_render_gate',
  });

  const gateIssues = collectBlockingIssuesFromReports(mustGateReport, globalGateReport);
  if (mustGateReport?.verdict !== 'PASS' || globalGateReport?.verdict !== 'PASS' || gateIssues.length > 0) {
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
      sourceDocumentHash: finalMaterialized.sourceDocumentHash,
      implementationConfirmationHash: finalMaterialized.implementationConfirmationHash,
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
    inputRefs: [toRootRelativePath(root, sourcePath), toRootRelativePath(root, paths.preRenderMustGate)],
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
    });
  }
  const renderIssues = collectBlockingIssuesFromReports(renderReport);
  const substate =
    render.status === 0 && renderReport?.confirmability === 'confirmable' && renderIssues.length === 0
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

function readinessBaselineActivation(record: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!record) return null;
  const activation = recordObject(record.readinessBaselineActivation);
  return normalizeText(activation.activationId) ? activation : null;
}

function readinessBaselineMetadata(record: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!record) return null;
  const metadata = recordObject(record.readinessBaselineMetadata);
  return normalizeText(metadata.baselineId) ? metadata : null;
}

function currentArchitectureHashFromRecord(record: Record<string, unknown> | null): string {
  return normalizeText(recordObject(record?.architectureConfirmationState).currentArchitectureConfirmationHash);
}

function baselineMismatchFields(
  record: Record<string, unknown> | null,
  baseline: Record<string, unknown> | null
): string[] {
  if (!record || !baseline) return [];
  const checks: Array<[string, string, string]> = [
    ['sourceDocumentHash', normalizeText(record.sourceDocumentHash), normalizeText(baseline.sourceDocumentHash)],
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
        nextCommand: 'main-agent-orchestration --action controlled-readiness-audit',
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
        nextCommand: 'main-agent-orchestration --action controlled-readiness-audit',
        message: 'Implementation readiness gate passed; controlled readiness audit must write the scoring baseline.',
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
          'packages/scoring/data',
        ],
        repairAction:
          activationStatus === 'audit_required'
            ? 'trigger_controlled_readiness_audit'
            : 'run_implementation_readiness_gate_then_controlled_audit',
        automaticRepairAvailable: activationStatus === 'audit_required' && Boolean(input.root && input.recordPath),
        nextCommand: 'main-agent-orchestration --action controlled-readiness-audit',
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
        sourceChecked: [input.recordPath ?? 'requirement-record', 'closeout', 'orchestration-state'],
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
          nextCommand: 'main-agent-orchestration --action controlled-readiness-audit',
          message: 'Legacy/dashboard readiness score bridge is pending but does not block completed closeout.',
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
    const records = loadAndDedupeRecords(path.join(projectRoot, 'packages', 'scoring', 'data'));
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
  const resolvedGate = (runtimeContext as { implementationEntryGate?: ImplementationEntryGate } | null)
    ?.implementationEntryGate;
  return resolvedGate ?? null;
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

function gateIdentity(gate: Record<string, unknown>, index: number): string {
  return (
    [
      normalizeText(gate.gate),
      normalizeText(gate.traceId),
      normalizeText(gate.requirementId),
    ]
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
        normalizeText(event.implementationConfirmationHash) === normalizeText(record.implementationConfirmationHash))
  );
  const userConfirmed = normalizeText(record.status) === 'user_confirmed' && hasControlledConfirmationEvent;
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
  const architectureState =
    input.record?.architectureConfirmationState &&
    typeof input.record.architectureConfirmationState === 'object' &&
    !Array.isArray(input.record.architectureConfirmationState)
      ? (input.record.architectureConfirmationState as Record<string, unknown>)
      : null;
  const openRerun = latestRecordsById(input.record?.rerunLoops, 'rerunLoopId').some((loop) =>
        ['open', 'in_progress', 'no_progress', 'blocked'].includes(normalizeText(loop.status))
      );
  const hasBlockingGate = latestGateChecks(input.record?.gateChecks).some((gate) =>
        ['fail', 'blocked'].includes(normalizeText(gate.decision))
      );
  const blockingReasonRefs: Array<{ sourceType: string; id: string }> = [];
  const preConfirmationLane = readPreConfirmationLaneStateFromRecord(input.record);
  if (!input.record || normalizeText(input.record.status) !== 'user_confirmed') {
    blockingReasonRefs.push({
      sourceType: preConfirmationLane?.substate === 'user_confirmable'
        ? 'pre_confirmation_drilldown'
        : 'requirement_record',
      id: recordId,
    });
  }
  if (normalizeText(architectureState?.status) !== 'active') {
    blockingReasonRefs.push({ sourceType: 'architecture_confirmation', id: normalizeText(architectureState?.currentArchitectureConfirmationHash) || recordId });
  }
  if (isRequirementRecordClosed(input.record)) {
    return {
      nextAction: null,
      ready: false,
      blockingReasonRefs,
      terminalState: 'completed_no_dispatch',
    };
  }
  if (input.implementationEntryDecision === 'reroute') {
    blockingReasonRefs.push({ sourceType: 'gate_check', id: 'implementation-readiness' });
    return { nextAction: 'await_user', ready: false, blockingReasonRefs };
  }
  if (input.implementationEntryDecision === 'block' || openRerun || hasBlockingGate) {
    blockingReasonRefs.push({ sourceType: 'gate_check', id: 'implementation-readiness' });
    return { nextAction: 'dispatch_remediation', ready: blockingReasonRefs.length === 1, blockingReasonRefs };
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
  const requirementNextAction = input.stage === 'post_audit' ? 'run_closeout' : 'dispatch_implement';
  const requirementTaskType = taskTypeFromNextAction(requirementNextAction);
  const stateNextAction = input.state?.nextAction ?? null;
  const stateTaskType = taskTypeFromNextAction(stateNextAction);
  const canReuseStateTransition =
    stateNextAction === requirementNextAction || Boolean(input.state?.lastTaskReport);
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
      nextAction: stateNextAction === requirementNextAction ? requirementNextAction : stateNextAction,
      ready: input.pendingPacketStatus === 'ready_for_main_agent',
      blockingReasonRefs,
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
  const runtimeContextImplementationEntryGate =
    resolveImplementationEntryGateFromRegistry(input.projectRoot, runtimeContext, input.flow);
  const implementationEntryGate =
    explicitImplementationEntryGateProvided
      ? input.implementationEntryGate
      : runtimeContextImplementationEntryGate;
  const scopedState = input.projectRoot
    ? resolveScopedOrchestrationState(input.projectRoot, runtimeContext)
    : { sessionId: null, statePath: null, state: null };
  const pendingPacket = readPendingPacketPayload(scopedState.state);
  const pendingPacketStatus = normalizePendingPacketStatus(scopedState.state, pendingPacket);
  const fourSignal = scopedState.state?.fourSignal ?? null;
  const inferredLatestGate = inferLatestGateFromState(scopedState.state);
  const displayLatestGateDecision =
    scopedState.state?.latestGate?.decision ??
    inferredLatestGate?.decision ??
    mapImplementationEntryDecision(implementationEntryGate) ??
    null;
  const bridgeRecordWithoutControlledGate =
    runtimeRegistryBridgeRecord && !implementationEntryGate;
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
    mainAgentNextAction: action.nextAction,
    mainAgentReady: action.ready,
    preConfirmationDrilldownLane,
    ...(useRequirementRecordProjection
      ? {
          runtimeResumeProjection: {
            projectionType: 'runtime_resume_projection' as const,
            source: 'requirement_record' as const,
            runtimeNextAction: action.nextAction,
            ready: action.ready === true,
            blockingReasonRefs: normalizeBlockingReasonRefs(
              'blockingReasonRefs' in action ? action.blockingReasonRefs : []
            ),
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

  const nextAction =
    options.nextActionHint ??
    deriveNextActionFromTaskType(taskType, options.currentStage ?? state.currentPhase);

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

  return updateOrchestrationState(projectRoot, sessionId, (current) => ({
    ...current,
    nextAction,
    lastTaskReport: {
      packetId: report.packetId,
      status: report.status,
      filesChanged: report.filesChanged,
      validationsRun: report.validationsRun,
      evidence: report.evidence,
      ...(report.driftFlags ? { driftFlags: report.driftFlags } : {}),
    },
  }));
}

export function ensureMainAgentDispatchPacket(
  input: ResolveMainAgentOrchestrationInput & { host?: OrchestrationHost }
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
  const packetId = `${taskType}-${Date.now()}`;
  const role = defaultPacketRole(taskType);
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
    currentSurface.runtimeResumeProjection ? readRequirementRecordFromRuntimeContext(runtimeContext) : null
  );
  const allowedWriteScope =
    resolvedScope && resolvedScope.length > 0
      ? resolvedScope
      : taskType === 'audit'
        ? ['docs/**', '_bmad-output/**', 'specs/**']
        : ['src/**', 'tests/**', 'docs/**', '_bmad-output/**'];

  const packet =
    currentSurface.orchestrationState?.originalExecutionPacketId != null
      ? createResumePacket({
          packetId,
          parentSessionId: sessionId,
          originalExecutionPacketId: currentSurface.orchestrationState.originalExecutionPacketId,
          flow: input.flow as 'story' | 'bugfix' | 'standalone_tasks',
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
          flow: input.flow as 'story' | 'bugfix' | 'standalone_tasks',
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
        });

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
        status: 'ready_for_main_agent',
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
        status: 'ready_for_main_agent',
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
    pendingPacketStatus: 'ready_for_main_agent',
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
    mainAgentReady: true,
  };
}

export function buildMainAgentDispatchInstruction(
  input: ResolveMainAgentOrchestrationInput & {
    host?: OrchestrationHost;
    hydratePacket?: boolean;
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
    role:
      'role' in surface.pendingPacket
        ? surface.pendingPacket.role
        : surface.pendingPacket.recommendedRole ?? defaultPacketRole(taskType),
    expectedDelta:
      (surface.pendingPacket as ExecutionPacket | ResumePacket).expectedDelta ??
      (surface.pendingPacket as RecommendationPacket).expectedDelta,
  };
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const positional: string[] = [];
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
    } else if (token === '--scoring-run-id' && argv[index + 1]) {
      out.scoringRunId = argv[++index];
    } else if (token === '--source' && argv[index + 1]) {
      out.source = argv[++index];
    } else if (token === '--render-report' && argv[index + 1]) {
      out.renderReport = argv[++index];
    } else if (token === '--confirmation-text' && argv[index + 1]) {
      out.confirmationText = argv[++index];
    } else if (token === '--confirmation-text-file' && argv[index + 1]) {
      out.confirmationTextFile = argv[++index];
    } else if (token === '--confirmed-by' && argv[index + 1]) {
      out.confirmedBy = argv[++index];
    } else if (token === '--confirmed-at' && argv[index + 1]) {
      out.confirmedAt = argv[++index];
    } else if ((token === '--confirmation-language' || token === '--confirmationLanguage') && argv[index + 1]) {
      out.confirmationLanguage = argv[++index];
    } else if (token === '--mode' && argv[index + 1]) {
      out.mode = argv[++index];
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
    } else if ((token === '--data-path' || token === '--dataPath') && argv[index + 1]) {
      out.dataPath = argv[++index];
    } else if (token === '--apply') {
      out.apply = 'true';
    } else if (!token.startsWith('--')) {
      positional.push(token);
    }
  }
  if (!out.cwd && positional[0]) out.cwd = positional[0];
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
  action: 'confirm-scope';
  delegatedEntry: string;
  exitCode: number;
  stdout?: unknown;
  stderr?: string;
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
  pushOptionalArg(delegatedArgs, '--confirmed-by', args.confirmedBy ?? 'main-agent-orchestration', root);
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
): { flow: RuntimeFlowId; stage: string } {
  const runtimeContext = loadPolicyContextFromRegistry(root, {
    recordId: args.recordId,
    requirementSetId: args.requirementSetId,
    runId: args.runId,
  }).runtimeContext;
  const flow = normalizeText(args.flow) || runtimeContext.flow;
  const stage = normalizeText(args.stage) || runtimeContext.stage;
  return {
    flow: flow as RuntimeFlowId,
    stage,
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

  const instruction = buildMainAgentDispatchInstruction({
    ...surfaceInput,
    host: input.host,
    hydratePacket: true,
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
  try {
    taskReport = input.executor?.({
      projectRoot: input.projectRoot,
      instruction,
      args,
    }) ?? null;
    const taskReportPath = normalizeText(args.taskReportPath);
    if (!taskReport && taskReportPath) {
      if (process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT === 'true') {
        taskReport = readTaskReportFromFile(taskReportPath, instruction.packetId);
      } else {
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
    }
    if (!taskReport && instruction.host === 'codex') {
      const adapterReport = runCodexWorkerAdapter({
        projectRoot: input.projectRoot,
        recordId: input.recordId,
        requirementSetId: input.requirementSetId,
        runId: input.runId,
        packetPath: instruction.packetPath,
        taskReportPath: taskReportPath || undefined,
        smoke: args.codexSmoke === 'true',
        smokeTargetPath: normalizeText(args.codexSmokeTargetPath) || undefined,
        timeoutMs: Number(args.codexTimeoutMs) > 0 ? Number(args.codexTimeoutMs) : undefined,
      });
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
    };
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
  };
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

  if (action === 'pre-confirmation-drilldown' || action === 'pre_confirmation_drilldown') {
    try {
      const result = runMainAgentPreConfirmationDrilldown(root, {
        source: args.source,
        recordId: args.recordId,
        requirementSetId: args.requirementSetId,
        confirmationLanguage: args.confirmationLanguage,
        mode: args.mode,
        skipDrilldownArtifacts: args.skipDrilldownArtifacts === 'true',
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.ok ? 0 : 1;
    } catch (error) {
      console.error(
        `main-agent-orchestration pre-confirmation-drilldown: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 1;
    }
  }

  const { flow, stage } = resolveFlowAndStage(root, args);
  const host = parseOrchestrationHost(args.host);
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
        executor:
          args.taskReportPath
            ? ({ instruction, args: runArgs }) =>
                process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT === 'true'
                  ? readTaskReportFromFile(path.resolve(runArgs.taskReportPath!), instruction.packetId)
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
