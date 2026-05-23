import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
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
  const dir = orchestrationStateDirForRecordPath(
    projectRoot,
    resolvedContext(runtimeContext)?.recordPath
  );
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(dir, file));
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

function deriveNextActionFromRequirementRecord(input: {
  stage: string;
  record: Record<string, unknown> | null;
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
  if (!input.record || normalizeText(input.record.status) !== 'user_confirmed') {
    blockingReasonRefs.push({ sourceType: 'requirement_record', id: recordId });
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
  return {
    nextAction: input.stage === 'post_audit' ? 'run_closeout' : 'dispatch_implement',
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
  const displayLatestGateDecision =
    scopedState.state?.latestGate?.decision ??
    inferredLatestGate?.decision ??
    mapImplementationEntryDecision(implementationEntryGate) ??
    null;
  const controlLatestGateDecision = requirementRecord
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
  const action = requirementRecord
    ? {
        ...deriveNextActionFromRequirementRecord({
          stage: input.stage,
          record: requirementRecord,
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
    drift,
    diagnostics,
    mainAgentCanContinue: continueState.canContinue,
    continueDecision: continueState.continueDecision,
    mainAgentNextAction: action.nextAction,
    mainAgentReady: action.ready,
    ...(requirementRecord
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
  const resolvedScope = resolveMappedAllowedWriteScope(input.projectRoot, runtimeContext, input.flow, taskType);
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
  if (currentSurface.orchestrationState) {
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
  if (refreshed.pendingPacketStatus !== 'none') {
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
  const entry = path.join(
    root,
    '_bmad',
    'skills',
    'requirements-contract-authoring',
    'scripts',
    'confirm-requirements-scope.js'
  );
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
