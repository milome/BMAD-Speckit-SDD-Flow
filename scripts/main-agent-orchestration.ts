import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  DispatchRoute,
  ExecutionPacket,
  RecommendationPacket,
  ResumePacket,
  TaskReport,
} from './orchestration-dispatch-contract';
import {
  createExecutionPacket,
  createResumePacket,
  packetArtifactPath,
  resolveDispatchRoute,
} from './orchestration-dispatch-contract';
import {
  claimPendingPacket,
  completePendingPacket,
  invalidatePendingPacket,
  markPendingPacketDispatched,
  orchestrationStateDir,
  readOrchestrationState,
  resetGatesLoopProgress,
  recordGatesLoopNoProgress,
  type OrchestrationNextAction,
  updateOrchestrationState,
  type OrchestrationState,
} from './orchestration-state';
import { readRuntimeContext, type RuntimeContextFile } from './runtime-context';
import {
  readRegistryOrDefault,
  type ReviewerLatestCloseoutRecord,
} from './runtime-context-registry';
import { runAdaptiveIntakeGovernanceGate } from './adaptive-intake-governance-gate';
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

export type MainAgentContinueDecision = 'continue' | 'rerun' | 'blocked' | null;
export type MainAgentOrchestrationSource =
  | 'orchestration_state'
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

export interface MainAgentDriftSurface {
  driftSignals: string[];
  driftedDimensions: string[];
  driftSeverity: string | null;
  blockingReason: string | null;
  effectiveVerdict: string | null;
  reReadinessRequired: boolean;
  readinessBaselineRunId: string | null;
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
  mainAgentCanContinue: boolean | null;
  continueDecision: MainAgentContinueDecision;
  mainAgentNextAction: string | null;
  mainAgentReady: boolean | null;
}

export interface MainAgentDispatchInstruction {
  flow: RuntimeFlowId;
  stage: string;
  host: 'cursor' | 'claude';
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
    return readRuntimeContext(input.projectRoot, input.runtimeContextPath);
  } catch {
    return null;
  }
}

function listScopedOrchestrationStatePaths(projectRoot?: string): string[] {
  if (!projectRoot) {
    return [];
  }
  const dir = orchestrationStateDir(projectRoot);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(dir, file));
}

function mergeAllowedWriteScope(base: string[], extras: string[]): string[] {
  return Array.from(new Set([...base, ...extras]));
}

function resolveMappedAllowedWriteScope(
  projectRoot: string,
  runtimeContext: Partial<RuntimeContextFile> | null,
  flow: RuntimeFlowId,
  taskType: 'implement' | 'audit' | 'remediate' | 'document'
): string[] | null {
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

function resolveScopedOrchestrationState(
  projectRoot: string | undefined,
  runtimeContext: Partial<RuntimeContextFile> | null
): {
  sessionId: string | null;
  statePath: string | null;
  state: OrchestrationState | null;
} {
  const candidates = listScopedOrchestrationStatePaths(projectRoot);
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
      const state = readOrchestrationState(projectRoot!, sessionId);
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

function taskTypeFromNextAction(
  nextAction: string | null
): 'implement' | 'audit' | 'remediate' | 'document' | null {
  switch (nextAction) {
    case 'dispatch_review':
      return 'audit';
    case 'dispatch_remediation':
      return 'remediate';
    case 'dispatch_implement':
      return 'implement';
    default:
      return null;
  }
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

function deriveDriftSurface(
  projectRoot: string | undefined,
  closeout: ReviewerLatestCloseoutRecord | null
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

  const registry = readRegistryOrDefault(projectRoot);
  const gates = registry.implementationEntryIndex[flow];
  const entries = Object.entries(gates);
  if (entries.length === 0) {
    return null;
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

  const scored = entries
    .map(([key, gate]) => {
      let score = 0;
      const keyLower = key.toLowerCase();
      for (const hint of hints) {
        const hintLower = hint.toLowerCase();
        if (keyLower.includes(hintLower)) {
          score += 100;
        }
        score += sharedPathScore(key, hint) * 10;
      }
      return {
        gate,
        score,
      };
    })
    .sort((left, right) => right.score - left.score);

  return scored[0]?.gate ?? null;
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
  const registry = input.projectRoot ? readRegistryOrDefault(input.projectRoot) : null;
  const closeout =
    runtimeContext?.latestReviewerCloseout ?? registry?.latestReviewerCloseout ?? null;
  const implementationEntryGate =
    input.implementationEntryGate ??
    resolveImplementationEntryGateFromRegistry(input.projectRoot, runtimeContext, input.flow);
  const scopedState = input.projectRoot
    ? resolveScopedOrchestrationState(input.projectRoot, runtimeContext)
    : { sessionId: null, statePath: null, state: null };
  const pendingPacket = readPendingPacketPayload(scopedState.state);
  const pendingPacketStatus = normalizePendingPacketStatus(scopedState.state, pendingPacket);
  const fourSignal = scopedState.state?.fourSignal ?? null;
  const inferredLatestGate = inferLatestGateFromState(scopedState.state);
  const latestGateDecision =
    scopedState.state?.latestGate?.decision ??
    inferredLatestGate?.decision ??
    mapImplementationEntryDecision(implementationEntryGate) ??
    null;
  const latestGate =
    scopedState.state?.latestGate ??
    inferredLatestGate ??
    (implementationEntryGate
      ? {
          gateId: implementationEntryGate.gateName,
          decision: latestGateDecision ?? 'true_blocker',
          reason: implementationEntryGate.blockerSummary.join('; '),
        }
      : null);
  const continueState = deriveContinueDecisionFromSurface({
    closeout,
    state: scopedState.state,
    latestGateDecision,
    fourSignalStatus: fourSignal?.latestStatus ?? 'pass',
  });
  const action = deriveNextActionFromSurface({
    stage: input.stage,
    state: scopedState.state,
    pendingPacketStatus,
    continueDecision: continueState.continueDecision,
    implementationEntryDecision: implementationEntryGate?.decision ?? null,
  });

  return {
    source: action.source,
    sessionId: scopedState.sessionId,
    orchestrationStatePath: scopedState.statePath,
    orchestrationState: scopedState.state,
    pendingPacketStatus,
    pendingPacket,
    fourSignal,
    latestGate,
    gatesLoop: scopedState.state?.gatesLoop ?? null,
    closeout,
    drift: deriveDriftSurface(input.projectRoot, closeout),
    mainAgentCanContinue: continueState.canContinue,
    continueDecision: continueState.continueDecision,
    mainAgentNextAction: action.nextAction,
    mainAgentReady: action.ready,
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
  input: ResolveMainAgentOrchestrationInput
): MainAgentOrchestrationSurface {
  const runtimeContext = loadRuntimeContextForMainAgent(input);
  const currentSurface = resolveMainAgentOrchestrationSurface(input);
  if (
    currentSurface.pendingPacketStatus !== 'none' &&
    currentSurface.pendingPacketStatus !== 'missing_packet_file'
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
    currentSurface.sessionId ?? deriveSessionIdFromRuntimeContext(input.flow, runtimeContext);
  const packetId = `${taskType}-${Date.now()}`;
  const role = defaultPacketRole(taskType);
  const inputArtifacts = [
    normalizeText(runtimeContext?.artifactPath),
    normalizeText(runtimeContext?.artifactRoot),
    normalizeText(currentSurface.closeout?.artifactPath),
    normalizeText(currentSurface.closeout?.reportPath),
  ].filter(Boolean);
  const allowedWriteScope =
    resolveMappedAllowedWriteScope(input.projectRoot, runtimeContext, input.flow, taskType) ??
    (taskType === 'audit'
      ? ['docs/**', '_bmad-output/**', 'specs/**']
      : ['src/**', 'tests/**', 'docs/**', '_bmad-output/**']);

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
          inputArtifacts,
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
          inputArtifacts,
          allowedWriteScope,
          expectedDelta: `execute ${taskType} through the main-agent runtime loop`,
          successCriteria: ['bounded task report returned', 'state updated'],
          stopConditions: ['true blocker detected', 'scope must widen'],
        });

  const packetKind: PacketKind = 'originalExecutionPacketId' in packet ? 'resume' : 'execution';
  const packetPath = writePacketFile(input.projectRoot, sessionId, packetId, packet);

  let writtenState: OrchestrationState;
  if (currentSurface.orchestrationState) {
    updateOrchestrationState(input.projectRoot, sessionId, (current) => ({
      ...current,
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
      host:
        currentSurface.closeout?.runner === 'runAuditorHost'
          ? readGovernanceRemediationConfig(input.projectRoot).primaryHost === 'claude'
            ? 'claude'
            : 'cursor'
          : readGovernanceRemediationConfig(input.projectRoot).primaryHost === 'claude'
            ? 'claude'
            : 'cursor',
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
    const file = path.join(orchestrationStateDir(input.projectRoot), `${sessionId}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(writtenState, null, 2) + '\n', 'utf8');
  }

  const refreshed = resolveMainAgentOrchestrationSurface(input);
  if (refreshed.pendingPacketStatus !== 'none') {
    return refreshed;
  }

  return {
    source: 'orchestration_state',
    sessionId,
    orchestrationStatePath: path.join(
      orchestrationStateDir(input.projectRoot),
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
    mainAgentCanContinue: false,
    continueDecision: 'blocked',
    mainAgentNextAction: writtenState.nextAction,
    mainAgentReady: true,
  };
}

export function buildMainAgentDispatchInstruction(
  input: ResolveMainAgentOrchestrationInput & {
    host?: 'cursor' | 'claude';
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

  const host =
    input.host ??
    surface.orchestrationState?.host ??
    (readGovernanceRemediationConfig(input.projectRoot ?? process.cwd()).primaryHost === 'claude'
      ? 'claude'
      : 'cursor');
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
      (surface.pendingPacket as ExecutionPacket | RecommendationPacket | ResumePacket).role ??
      (surface.pendingPacket as RecommendationPacket).recommendedRole ??
      defaultPacketRole(taskType),
    expectedDelta:
      (surface.pendingPacket as ExecutionPacket | ResumePacket).expectedDelta ??
      (surface.pendingPacket as RecommendationPacket).expectedDelta,
  };
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--cwd' && argv[index + 1]) {
      out.cwd = argv[++index];
    } else if (token === '--flow' && argv[index + 1]) {
      out.flow = argv[++index];
    } else if (token === '--stage' && argv[index + 1]) {
      out.stage = argv[++index];
    } else if (token === '--action' && argv[index + 1]) {
      out.action = argv[++index];
    } else if (token === '--sessionId' && argv[index + 1]) {
      out.sessionId = argv[++index];
    } else if (token === '--packetId' && argv[index + 1]) {
      out.packetId = argv[++index];
    } else if (token === '--owner' && argv[index + 1]) {
      out.owner = argv[++index];
    } else if (token === '--input' && argv[index + 1]) {
      out.input = argv[++index];
    } else if (token === '--payload' && argv[index + 1]) {
      out.payload = argv[++index];
    } else if (token === '--apply') {
      out.apply = 'true';
    }
  }
  return out;
}

function pickRoot(args: Record<string, string | undefined>): string {
  const fromArg = stripWrappingQuotes(normalizeText(args.cwd));
  return fromArg ? path.resolve(fromArg) : process.cwd();
}

function resolveFlowAndStage(
  root: string,
  args: Record<string, string | undefined>
): { flow: RuntimeFlowId; stage: string } {
  const runtimeContext = readRuntimeContext(root);
  const flow = normalizeText(args.flow) || runtimeContext.flow;
  const stage = normalizeText(args.stage) || runtimeContext.stage;
  return {
    flow: flow as RuntimeFlowId,
    stage,
  };
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

  const { flow, stage } = resolveFlowAndStage(root, args);
  const surface = resolveMainAgentOrchestrationSurface({
    projectRoot: root,
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
        flow,
        stage,
        hydratePacket: true,
      });
      process.stdout.write(`${JSON.stringify(instruction, null, 2)}\n`);
      return instruction ? 0 : 1;
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

function isDirectMainAgentOrchestrationCli(): boolean {
  const entry = normalizeText(process.argv[1]);
  return /(^|[\\/])main-agent-orchestration(\.[cm]?js|\.ts)?$/iu.test(entry);
}

if (require.main === module && isDirectMainAgentOrchestrationCli()) {
  process.exit(mainMainAgentOrchestration(process.argv.slice(2)));
}
