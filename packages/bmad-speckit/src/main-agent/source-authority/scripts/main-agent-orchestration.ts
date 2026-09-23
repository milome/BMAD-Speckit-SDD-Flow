import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as crypto from 'node:crypto';
import * as yaml from 'js-yaml';
import type {
  AuditExecutionProfile,
  AuditRepairContext,
  AuditTriadExecutionPlanRef,
  CompiledPromptRef,
  DispatchRoute,
  ExecutionPacket,
  OrchestrationTaskType,
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
import {
  resolveInstalledSkillPath,
  resolvePackageOwnedBmadPath,
} from '../../runtime/package-bmad-root';
import {
  buildExecutionStrategyOptions,
  exactExecutionStrategySelectionPhrase,
  selectExecutionStrategy,
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
import {
  evaluateControlledGoalCloseoutGate,
  mainDeliveryCloseoutGate,
} from './main-agent-delivery-closeout-gate';
import { materializeControlledCloseoutConfirmationPage } from './controlled-closeout-confirmation-page';
import { applyLongRunPolicyToState } from './long-run-runtime-policy';
import { getReviewerConsumerByAuditStage, isReviewerAuditEntryStage } from './reviewer-registry';
import {
  type NativeReviewerDispatch,
  type NativeReviewerTransport,
} from './requirements-contract-native-reviewer-transport';
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
import { resolveScoringDimensionContract } from '../packages/scoring/contracts/dimension-contracts';
import { loadAndDedupeRecords } from '../packages/scoring/query/loader';
import { readGovernanceRemediationConfig } from './governance-remediation-config';
import {
  buildAuditTriadJudgeRuntimeBinding,
  type AuditTriadJudgeRuntimeBinding,
  type AuditProviderEvidence,
  type AuditProviderExpectation,
  validateAuditProviderEvidence,
} from './requirements-contract-judge-provider-independence';
import type {
  AuditReviewScoringAssessment,
  AuditTriadJudgeInvocationResult,
} from './audit-triad-judge-invocation';

type AuditProviderBindingExpectation = Pick<
  AuditTriadJudgeRuntimeBinding,
  | 'providerId'
  | 'model'
  | 'transport'
  | 'adapterRef'
  | 'apiStyle'
  | 'configuredBaseUrlHash'
  | 'independenceClass'
  | 'providerRegistryHash'
  | 'providerConfigurationHash'
>;
import type { ResolvedRuntimeContext } from './resolve-active-requirement';
import { isNoActiveRequirementError } from './resolve-active-requirement';
import { runControlledReadinessAuditBridge } from './controlled-readiness-audit-bridge';
import { appendControlEventAndReplay } from './requirement-record-control-store';
import {
  runRequirementsContractConfirmationAcceptance,
  type RequirementsContractConfirmationAcceptanceResult,
} from './requirements-contract-confirmation-acceptance';
import {
  expectedSetsFromConfirmation,
  projectProductionImplementationConfirmation,
  selectRequirementsContractFrozenConfirmationSemantics,
} from './requirements-contract-confirmation-projection-facade';
import { createRequirementsContractCoreArtifactFreeze, sha256Stable } from './requirements-contract-semantic-resolver';
import {
  compileRequirementContractModel,
  writeRequirementContractModelArtifacts,
} from './requirements-contract-compiler';
import {
  buildCanonicalMustRequirementProjection,
  buildCanonicalPreCheckpointCompilerInput,
  type CanonicalPreCheckpointCompilerInput,
} from './requirements-contract-canonical-compiler-input';
import {
  materializeEntryLineage,
  materializeFileEntryIntake,
  materializeInvocationEntryAuthority,
  materializeSessionEntryIntake,
  readCanonicalUtf8Source,
  type EntryIntakeAuthority,
  type EntryLineageSourceRoot,
  type InvocationEntryAuthority,
} from './requirements-contract-entry-authority-facade';
import { requirementsContractInvocationAuthorityBindingHash } from './requirements-contract-invocation-authority-receipt';
import { closeRequirementContractInvariants } from './requirements-contract-invariant-closure';
import {
  runRequirementsContractProductionSemanticPipeline,
  type ProductionSemanticPipelineResult,
  type ProductionSemanticSourceRoot,
  type ProductionSemanticSourceRootCandidate,
} from './requirements-contract-production-semantic-pipeline';
import { compactProductionSourceBacking } from './requirements-contract-production-source-view';
import { createSameVolumeBoundedTempDirectory } from './requirements-contract-same-volume-bounded-temp';
import {
  extractRequirementsContractImplementationConfirmation,
  implementationConfirmationHashFor as implementationConfirmationHashForContract,
  sourceDocumentHashFor as sourceDocumentHashForContract,
} from './requirements-contract-implementation-confirmation-codec';
import {
  projectionSetHash as projectionSetHashForContract,
} from './requirements-contract-hash-domains';
import { parseRequirementsContractSourceText } from './requirements-contract-source-parser';
import {
  CANONICAL_GENERATED_DEFINITION_OF_DONE_SECTION,
  createDirectV2RequirementSemanticBody,
  createRegisteredSourceAuthoritySnapshot,
  extractRegisteredSourceRootCandidates,
  extractRegisteredSourceRootLineageWitnesses,
  validateRegisteredSourceRootInventory,
} from './requirements-contract-source-root-registry';
import { evaluateRequirementsContractRenderRoundTrip } from './requirements-contract-render-roundtrip-gate';
import {
  assertProductionPrdOutputPolicyCurrent,
  acquireProductionOutputPolicyLock,
  renderProductionClassifiedRequirementSourcePrd,
} from './requirements-contract-prd-render-write-seam';
import {
  createCheckpointSemanticValidationReceipt,
  deriveCheckpointProgressState,
  validateCheckpointSemanticValidationReceipt,
  type CheckpointProgressStateInput,
  type CheckpointSemanticBlocker,
  type CheckpointValidatedInput,
  type RequirementsContractCheckpointSemanticValidationReceipt,
} from './requirements-contract-checkpoint-semantic-validation';
import { mainImplementationReadinessGate } from './main-agent-implementation-readiness-gate';
import {
  mainAuditReviewGate,
  type AuditReviewGateCommitBundle,
} from './main-agent-audit-review-gate';
import { evaluateAiTddContractGate } from './ai-tdd-contract-gate';
import { mainRunRequiredCommandsFromAiTddManifest } from './run-required-commands-from-ai-tdd-manifest';
import { evaluateStrictCloseoutProof } from './strict-closeout-proof-gate';
import { evaluateTargetArtifactRealization } from './target-artifact-realization-gate';
import { resolveRuntimeScoringDataPath } from './runtime-scoring-data-path';
import {
  AUDIT_PROJECTION_QUALITY_RULE_CODES,
  auditTriadRoundHistoryIssues,
  createAuditTriadExecutionPlan,
  type AuditTriadExecutionPlan,
  type AuditTriadRoundReceipt,
  writeAuditTriadExecutionPlan,
  sha256Json as sha256AuditTriadJson,
} from './audit-triad-orchestrator';
import {
  resolveCriticalAuditorProfile,
  stageProfileForCallPoint,
  validateCriticalAuditorProfileForStage,
} from './critical-auditor-profile';
import {
  resolveGeneratorAuditReceipt,
  runtimeModeDir,
  validateNativeGoalInvocationReceipt,
  validateNativeGoalReadiness,
  writeExecutionRuntimeModeSelection,
  writeRuntimeBlocker,
} from './host-runtime-mode';
import {
  hasCurrentCloseoutAcceptanceRequest,
  hasCurrentControlledCloseoutAcceptance,
  resolveSixModelRuntimeDecision,
  writeSixModelRuntimeDecision,
  writeSplitBrainBlocker,
} from './six-model-runtime-decision';
import { resolveVerifiedSixModelStatus } from './verified-six-model-status-facade';
import {
  buildOpenReconfirmationBlockingReasonRefs,
  hasOpenReconfirmationRequest,
  requestSemanticReconfirmation,
} from './reconfirmation-runtime';
import {
  lintRequirementsContractSourcePrd,
  type EntrySource as SourcePrdAuthoringEntrySource,
  type LintResult as SourcePrdInstanceLintResult,
} from './lint-requirements-contract-source-prd';
import { validateSourcePrdLintTransition } from './requirements-contract-validation-facade';
import {
  resolveRequirementsContractProjectProfile,
  type ResolvedRequirementsContractProjectProfile,
} from './requirements-contract-project-profile-resolver';
import {
  validateRequirementsContractProjectProfile,
  type RequirementsContractProjectProfile,
} from './requirements-contract-project-profile';
import {
  requiredCommandIdsFromModelPacket,
  validateModelPacketCommandExecutionReceipts,
  type CommandExecutionReceiptValidationResult,
} from './requirements-contract-command-execution-receipt';
import {
  resolveCurrentDispatchPointer,
  type CurrentDispatchPointerExpectedIdentity,
} from './requirements-contract-current-dispatch-pointer';
import { resolveCampaignRuntimeBinding } from './campaign-runtime-binding';
import {
  createNativeGoalHostExecutor,
  runNativeGoalInvocation,
  type NativeGoalAttemptBundle,
  type NativeGoalControlledExecutor,
  type NativeGoalInvocationResult,
} from '../../actions/native-goal-invoker';
import {
  executeMainAgentExecutionFinalJudgeCampaign,
  validateMainAgentExecutionActorIsolationReceipt,
  type ExecutionFinalFinding,
  type MainAgentExecutionFinalJudgeProducedResult,
} from './main-agent-execution-final-judge-campaign';
import { createGoalFinalizationActorResolver } from './main-agent-goal-finalization-actor-resolver';
import {
  compileMainAgentExecutionFinalJudgeCampaignInput,
  type MainAgentExecutionFinalJudgeCampaignInput,
} from './main-agent-execution-final-judge-campaign-input';
import {
  confirmMainAgentControlledCloseout,
  confirmMainAgentRecordBackedCloseout,
} from './main-agent-controlled-closeout-confirmation';
import type {
  ClaudeCodeCliCommandInvocation,
  ClaudeCodeCliCommandResult,
} from './requirements-contract-claude-code-cli-judge-adapter';
import type {
  CodexCliCommandInvocation,
  CodexCliCommandResult,
} from './requirements-contract-codex-cli-judge-adapter';
import { ingestMainAgentControlledCloseout } from './main-agent-governed-goal-integration';

const requireCommonJs = createRequire(__filename);

export type { NativeGoalControlledExecutor } from '../../actions/native-goal-invoker';

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
  status: 'completed' | 'awaiting_user_acceptance' | 'blocked';
  steps: Array<{
    step: string;
    status: 'pass' | 'skip' | 'fail';
    summary: string;
  }>;
  dispatchInstruction: MainAgentDispatchInstruction | null;
  taskReport: TaskReport | null;
  closeoutAttemptId?: string;
  taskReportCandidatePath?: string;
  taskReportArtifactHash?: string;
  controlledCloseoutIngested?: boolean;
  controlledCloseout?: NativeGoalInvocationResult['controlledCloseout'];
  finalSurface: MainAgentOrchestrationSurface;
  mainAgentStageSummary: MainAgentStageSummary | null;
}

export function mainAgentRunLoopExitCode(status: MainAgentRunLoopResult['status']): number {
  return status === 'completed' || status === 'awaiting_user_acceptance' ? 0 : 1;
}

export interface NativeGoalTaskReportImportResult {
  status: 'imported' | 'invalid';
  reasonCode?: 'native_goal_task_report_invalid';
  validationErrors: string[];
  taskReportPath: string;
  packetId: string | null;
  nextAction: OrchestrationNextAction | null;
  controlledIngested: boolean;
  taskReport: TaskReport | null;
}

export interface MainAgentRunLoopExecutorContext {
  projectRoot: string;
  instruction: MainAgentDispatchInstruction;
  args: Record<string, string | undefined>;
}

export type MainAgentRunLoopExecutor = (
  context: MainAgentRunLoopExecutorContext
) => TaskReport | null;

export interface AuditJudgeExecutorContext {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  readonlyAuditorRequest: Record<string, unknown>;
  readonlyAuditorResponse: Record<string, unknown>;
  judgeRequest: Record<string, unknown>;
}

export type AuditJudgeExecutor = (context: AuditJudgeExecutorContext) => unknown;

type ReadinessRemediationClassification =
  | 'derive_without_reconfirm'
  | 'requires_source_amendment'
  | 'requires_test_authoring'
  | 'requires_user_decision';

type ReadinessRemediationNextAction =
  | 'run_deterministic_projection_repair'
  | 'dispatch_test_authoring'
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

function normalizeConfiguredModel(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function envFlagSet(value: string | undefined): boolean {
  const normalized = normalizeText(value).toLowerCase();
  return Boolean(normalized && normalized !== '0' && normalized !== 'false' && normalized !== 'no');
}

function resolveProcessMainAgentHost(): OrchestrationHost | null {
  if (
    envFlagSet(process.env.CODEX_THREAD_ID) ||
    envFlagSet(process.env.CODEX_MANAGED_BY_NPM) ||
    envFlagSet(process.env.CODEX_MANAGED_PACKAGE_ROOT) ||
    envFlagSet(process.env.CODEX_HOME) ||
    envFlagSet(process.env.CODEX_SANDBOX)
  ) {
    return 'codex';
  }
  if (envFlagSet(process.env.CLAUDE_CODE_CLI)) {
    return 'claude';
  }
  return null;
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

function readActiveRequirementRecordForDispatch(
  projectRoot: string,
  runtimeContext: Partial<RuntimeContextFile> | null
): Record<string, unknown> | null {
  const runtimeRecord = readRequirementRecordFromRuntimeContext(runtimeContext);
  if (runtimeRecord) return runtimeRecord;
  const indexPath = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'index.json'
  );
  if (!fs.existsSync(indexPath)) return null;
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as Record<string, unknown>;
    const active =
      index.active && typeof index.active === 'object' && !Array.isArray(index.active)
        ? (index.active as Record<string, unknown>)
        : null;
    const records = Array.isArray(index.records)
      ? index.records.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item)
        )
      : [];
    const activeRecordId = normalizeText(active?.recordId);
    const activeRequirementSetId = normalizeText(active?.requirementSetId);
    const selected =
      records.find(
        (record) =>
          (activeRecordId && normalizeText(record.recordId) === activeRecordId) ||
          (activeRequirementSetId &&
            normalizeText(record.requirementSetId) === activeRequirementSetId)
      ) ?? active;
    const recordPath = normalizeText(
      selected?.recordPath || selected?.path || selected?.controlRecordPath
    );
    if (!recordPath) return null;
    const parsed = JSON.parse(
      fs.readFileSync(path.resolve(projectRoot, recordPath), 'utf8')
    ) as unknown;
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
  if (!record || !model || !isSixMentalModel(model)) return null;
  const closeout =
    record.closeout && typeof record.closeout === 'object' && !Array.isArray(record.closeout)
      ? (record.closeout as Record<string, unknown>)
      : null;
  const verified = resolveVerifiedSixModelStatus({
    record,
    modelId: model,
    currentImplementationAttemptId:
      normalizeText(record.currentAttemptId) ||
      normalizeText(record.implementationAttemptId) ||
      normalizeText(record.runId) ||
      normalizeText(closeout?.currentAttemptId),
  });
  return {
    status: verified.effectiveStatus,
    blockingReasons: verified.blockerRefs,
    projectionStatus: verified.projectionStatus,
    projectionIntegrity: verified.projectionIntegrity,
    decisionReceiptRef: verified.decisionReceiptRef,
    decisionReceiptHash: verified.decisionReceiptHash,
  };
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
  const recordScopedCandidates = candidates.filter((candidate) =>
    isRecordScopedOrchestrationStatePath(candidate, runtimeContext)
  );
  const authorityCandidates =
    recordScopedCandidates.length > 0 ? recordScopedCandidates : candidates;

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

  const scored = authorityCandidates
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

function readAuditRepairContextFromState(
  projectRoot: string,
  state: OrchestrationState | null
): AuditRepairContext | null {
  const evidenceRefs = [...(state?.lastTaskReport?.evidence ?? [])].reverse();
  for (const evidenceRef of evidenceRefs) {
    const artifactPath = resolveRootRelativePath(projectRoot, evidenceRef);
    const relative = path.relative(projectRoot, artifactPath);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(artifactPath)) {
      continue;
    }
    let artifact: Record<string, unknown>;
    try {
      artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (normalizeText(artifact.schemaVersion) !== 'audit-repair-feedback-dispatch/v1') {
      continue;
    }
    const dispatchHash = normalizeText(artifact.dispatchHash);
    const { dispatchHash: _ignoredDispatchHash, ...dispatchWithoutHash } = artifact;
    if (dispatchHash !== sha256Json(dispatchWithoutHash)) {
      throw new Error('audit_repair_feedback_dispatch_hash_mismatch');
    }
    const validatedGapRefs = Array.isArray(artifact.validatedGapRefs)
      ? artifact.validatedGapRefs.map((value) => normalizeText(value)).filter(Boolean)
      : [];
    const priorRepairReceiptRefs = Array.isArray(artifact.priorRepairReceiptRefs)
      ? artifact.priorRepairReceiptRefs
          .map((value) => recordObject(value))
          .map((ref) => ({
            path: normalizeText(ref.path),
            contentHash: normalizeText(ref.contentHash),
          }))
          .filter((ref) => Boolean(ref.path) && /^sha256:[a-f0-9]{64}$/u.test(ref.contentHash))
      : [];
    return {
      schemaVersion: 'audit-repair-context/v1',
      sourceAuditEpochId: normalizeText(artifact.auditEpochId),
      sourceAuditTargetBundleHash: normalizeText(artifact.auditTargetBundleHash),
      semanticModelHash: normalizeText(artifact.semanticModelHash),
      projectionSetHash: normalizeText(artifact.projectionSetHash),
      qualityRuleSetHash: normalizeText(artifact.qualityRuleSetHash),
      validatedGapRefs,
      priorRepairReceiptRefs,
      feedbackDispatchRef: {
        path: artifactPath,
        contentHash: sha256Text(fs.readFileSync(artifactPath, 'utf8')),
        dispatchHash,
      },
    };
  }
  return null;
}

function readAuditRepairReceiptRefsFromState(
  projectRoot: string,
  state: OrchestrationState | null
): Array<{ path: string; contentHash: string }> {
  const refs: Array<{ path: string; contentHash: string }> = [];
  const seen = new Set<string>();
  for (const evidenceRef of [...(state?.lastTaskReport?.evidence ?? [])].reverse()) {
    const artifactPath = resolveRootRelativePath(projectRoot, evidenceRef);
    const relative = path.relative(projectRoot, artifactPath);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(artifactPath)) {
      continue;
    }
    const content = fs.readFileSync(artifactPath, 'utf8');
    let artifact: Record<string, unknown>;
    try {
      artifact = JSON.parse(content) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (normalizeText(artifact.schemaVersion) !== 'audit-main-agent-repair-receipt/v1') {
      continue;
    }
    const receiptHash = normalizeText(artifact.receiptHash);
    const { receiptHash: _ignoredReceiptHash, ...receiptWithoutHash } = artifact;
    if (receiptHash !== sha256Json(receiptWithoutHash)) {
      throw new Error('audit_main_agent_repair_receipt_hash_mismatch');
    }
    const rootRelativePath = toRootRelativePath(projectRoot, artifactPath);
    if (seen.has(rootRelativePath)) continue;
    seen.add(rootRelativePath);
    refs.push({
      path: rootRelativePath,
      contentHash: sha256Text(content),
    });
  }
  return refs;
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
  const processHost = resolveProcessMainAgentHost();
  if (processHost) {
    return processHost;
  }
  if (surface?.orchestrationState?.host) {
    return surface.orchestrationState.host;
  }
  const root = projectRoot ?? process.cwd();
  const primaryHost = readGovernanceRemediationConfig(root).primaryHost;
  return primaryHost === 'claude' || primaryHost === 'codex' ? primaryHost : 'cursor';
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

function completedAuditRepairReturnsToReview(input: {
  projectRoot: string;
  record: Record<string, unknown> | null;
  pendingPacketStatus: MainAgentPendingPacketStatus;
  pendingPacket: RecommendationPacket | ExecutionPacket | ResumePacket | null;
  state: OrchestrationState | null;
}): boolean {
  const completionReport = input.state?.lastTaskReport;
  const packet = input.pendingPacket;
  if (
    input.pendingPacketStatus !== 'completed' ||
    input.state?.nextAction !== 'dispatch_review' ||
    completionReport?.status !== 'done' ||
    !packet ||
    packetTaskType(packet) !== 'remediate' ||
    !('auditRepairContext' in packet) ||
    !packet.auditRepairContext ||
    completionReport.packetId !== packet.packetId ||
    normalizeText(input.state.pendingPacket?.packetId) !== packet.packetId
  ) {
    return false;
  }
  const currentRef = currentCompiledPromptRefFromDispatchPointer({
    projectRoot: input.projectRoot,
    record: input.record,
  });
  return Boolean(
    currentRef &&
    auditRepairReceiptSupersedesPendingPacket({
      projectRoot: input.projectRoot,
      record: input.record,
      packet,
      currentRef,
      completionReport,
    })
  );
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
  compiledPromptRef: NonNullable<ExecutionPacket['compiledPromptRef']>;
  campaignRuntimeBindingRef?: ExecutionPacket['campaignRuntimeBindingRef'];
}): ExecutionPacket['executionStrategy'] {
  const optionsResult = buildExecutionStrategyOptions({
    compiledPromptRef: input.compiledPromptRef,
    modelPacketGateDecision: 'pass',
  });
  if (optionsResult.status !== 'pass') return null;
  const selection = selectExecutionStrategy({
    optionsResult,
    strategyId: 'compiled_trace_direct',
    selectedBy: 'policy',
    policyDefaultAllowed: true,
  });
  if (selection.strategyId === 'governed_skill_adapter' && !input.campaignRuntimeBindingRef) {
    const direct = optionsResult.options.find(
      (option) => option.strategyId === 'compiled_trace_direct'
    );
    if (!direct || direct.availability !== 'available') return null;
    return selectExecutionStrategy({
      optionsResult,
      strategyId: 'compiled_trace_direct',
      selectedBy: 'user',
      exactPhrase: exactExecutionStrategySelectionPhrase({
        strategyId: 'compiled_trace_direct',
        strategyOptionsHash: optionsResult.strategyOptionsHash,
        modelPacketHash: optionsResult.modelPacketHash,
        sourceDocumentHash: optionsResult.sourceDocumentHash,
        implementationConfirmationHash: optionsResult.implementationConfirmationHash,
      }),
    });
  }
  return selection;
}

function writeEmptySddArtifactManifestRef(input: {
  projectRoot: string;
  recordPath?: string;
  compiledPromptRef: NonNullable<ExecutionPacket['compiledPromptRef']>;
  packetId: string;
  sessionId: string;
  flow: 'story' | 'bugfix' | 'standalone_tasks';
}): ExecutionPacket['sddArtifactManifestRef'] {
  const compiledOutDir = path.dirname(path.resolve(input.compiledPromptRef.modelPacketPath));
  const identity = recordIdentityFromPath(input.recordPath, input.sessionId);
  const manifest = createSddArtifactManifest({
    recordId: identity.recordId,
    flow: input.flow,
    packetId: input.packetId,
    runtimeTraceExecutionDir: relativePathFromRoot(input.projectRoot, compiledOutDir),
  });
  const manifestPath = defaultSddArtifactManifestPath({
    runtimeTraceExecutionDir: compiledOutDir,
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

function canonicalCurrentDispatchPointerPath(projectRoot: string): string {
  return path.join(
    projectRoot,
    'docs',
    'plans',
    'evidence',
    'loop-engineering-remediation',
    'current-dispatch-pointer-receipt.json'
  );
}

function currentDispatchPointerExpectedIdentityFromRecord(
  record: Record<string, unknown> | null
): CurrentDispatchPointerExpectedIdentity {
  if (!record) {
    throw new Error('current_dispatch_pointer_expected_identity_missing:requirementRecord');
  }
  const expected = {
    requirementSetId: normalizeText(record.requirementSetId),
    implementationAttemptId:
      normalizeText(record.currentAttemptId) || normalizeText(record.implementationAttemptId),
    transactionId: normalizeText(record.transactionId),
  };
  for (const field of ['requirementSetId', 'implementationAttemptId', 'transactionId'] as const) {
    if (!expected[field]) {
      throw new Error(`current_dispatch_pointer_expected_identity_missing:${field}`);
    }
  }
  return expected;
}

function currentCompiledPromptRefFromDispatchPointer(input: {
  projectRoot: string;
  record: Record<string, unknown> | null;
}): CompiledPromptRef {
  return resolveCurrentCompiledPromptRefFromDispatchPointer({
    authorityRoot: input.projectRoot,
    pointerPath: canonicalCurrentDispatchPointerPath(input.projectRoot),
    expected: currentDispatchPointerExpectedIdentityFromRecord(input.record),
  });
}

function nativeGoalAttemptBundleFromCurrentPointer(input: {
  projectRoot: string;
  record: Record<string, unknown> | null;
  compiledPromptRef: CompiledPromptRef;
}): NativeGoalAttemptBundle {
  const pointerPath = canonicalCurrentDispatchPointerPath(input.projectRoot);
  const { pointer } = resolveCurrentDispatchPointer({
    authorityRoot: input.projectRoot,
    pointerPath,
    expected: currentDispatchPointerExpectedIdentityFromRecord(input.record),
  });
  if (!pointer.goalExecutionRef) {
    throw new Error('current_dispatch_pointer_goal_execution_ref_missing');
  }
  return {
    sourceDocumentHash: input.compiledPromptRef.sourceDocumentHash,
    implementationConfirmationHash: input.compiledPromptRef.implementationConfirmationHash,
    modelPacketHash: input.compiledPromptRef.modelPacketHash,
    auditReceiptHash: input.compiledPromptRef.auditReceiptHash,
    goalExecutionHash: input.compiledPromptRef.goalExecutionHash ?? '',
    transactionManifestPath: pointer.transactionManifestRef.path,
    transactionManifestHash: pointer.transactionManifestRef.hash,
    currentDispatchPointerPath: pointerPath,
    currentDispatchPointerHash: sha256File(pointerPath),
  };
}

function currentCampaignRuntimeBindingRefFromDispatchPointer(input: {
  projectRoot: string;
  record: Record<string, unknown> | null;
}): ExecutionPacket['campaignRuntimeBindingRef'] {
  const pointerPath = canonicalCurrentDispatchPointerPath(input.projectRoot);
  const { pointer } = resolveCurrentDispatchPointer({
    authorityRoot: input.projectRoot,
    pointerPath,
    expected: currentDispatchPointerExpectedIdentityFromRecord(input.record),
  });
  const ref = pointer.campaignRuntimeBindingRef;
  if (!ref) return null;
  return {
    path: ref.path,
    hash: ref.hash,
    readbackHash: ref.readbackHash,
    readbackVerified: true,
  };
}

type PointerBoundTaskType = 'implement' | 'audit' | 'remediate';

function pointerBoundTaskTypeFor(
  taskType: ReturnType<typeof taskTypeFromNextAction>,
  record: Record<string, unknown> | null
): PointerBoundTaskType | null {
  if (taskType === 'implement' || taskType === 'audit') return taskType;
  if (taskType === 'remediate' && record && !isRuntimeRegistryBridgeRecord(record)) {
    return taskType;
  }
  return null;
}

function compiledPendingPacketBindingMismatch(
  packet: RecommendationPacket | ExecutionPacket | ResumePacket | null,
  currentRef: NonNullable<ExecutionPacket['compiledPromptRef']>,
  expectedTaskType: PointerBoundTaskType
): string | null {
  if (
    !packet ||
    packetTaskType(packet) !== expectedTaskType ||
    !('authorityMode' in packet) ||
    packet.authorityMode !== 'compiled_implementation_confirmation' ||
    !packet.compiledPromptRef
  ) {
    return 'compiledPromptRef';
  }
  const packetRef = packet.compiledPromptRef;
  const fields: Array<{
    key: keyof CompiledPromptRef;
    label: string;
    path?: boolean;
  }> = [
    { key: 'modelPacketPath', label: 'modelPacketPath', path: true },
    { key: 'modelPacketHash', label: 'modelPacketHash' },
    { key: 'humanPromptPath', label: 'humanPromptPath', path: true },
    { key: 'humanPromptHash', label: 'humanPromptHash' },
    { key: 'auditReceiptPath', label: 'auditReceiptPath', path: true },
    { key: 'auditReceiptHash', label: 'auditReceiptHash' },
    { key: 'goalExecutionPath', label: 'goalExecutionPath', path: true },
    { key: 'goalExecutionHash', label: 'goalExecutionHash' },
    { key: 'taskReportPath', label: 'taskReportPath', path: true },
    { key: 'sourceDocumentHash', label: 'sourceDocumentHash' },
    {
      key: 'implementationConfirmationHash',
      label: 'implementationConfirmationHash',
    },
  ];
  const normalizePath = (value: unknown) => {
    const resolved = path.resolve(String(value));
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  for (const field of fields) {
    const actual = packetRef[field.key] ?? null;
    const expected = currentRef[field.key] ?? null;
    const matches =
      field.path && actual !== null && expected !== null
        ? normalizePath(actual) === normalizePath(expected)
        : actual === expected;
    if (!matches) return field.label;
  }
  return null;
}

function auditArtifactsDir(
  projectRoot: string,
  recordId: string,
  attemptId: string,
  recordPath?: string
): string {
  const recordRoot = recordPath
    ? path.dirname(path.resolve(recordPath))
    : path.join(
        projectRoot,
        '_bmad-output',
        'runtime',
        'requirement-records',
        safeSegment(recordId)
      );
  return path.join(recordRoot, 'audit-review', safeSegment(attemptId));
}

function writeAuditExecutionProfile(input: {
  projectRoot: string;
  recordPath?: string;
  recordId: string;
  requirementSetId: string;
  attemptId: string;
  stage: string;
  semanticModelHash: string;
  compiledPromptRef: NonNullable<ExecutionPacket['compiledPromptRef']>;
  priorRepairReceiptRefs: Array<{ path: string; contentHash: string }>;
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
  if (!/^sha256:[a-f0-9]{64}$/u.test(input.semanticModelHash)) {
    throw new Error('audit_execution_profile_semantic_model_hash_invalid');
  }
  const modelPacketResult = readModelPacketForCompiledRef(
    input.projectRoot,
    input.compiledPromptRef
  );
  if (!modelPacketResult.modelPacket || modelPacketResult.issueCodes.length > 0) {
    throw new Error(
      `audit_execution_profile_model_packet_invalid:${modelPacketResult.issueCodes.join(',')}`
    );
  }
  const modelPacketSemanticModelHash = normalizeText(
    modelPacketResult.modelPacket.semanticModelHash
  );
  if (modelPacketSemanticModelHash && modelPacketSemanticModelHash !== input.semanticModelHash) {
    throw new Error('audit_execution_profile_semantic_model_hash_mismatch');
  }
  const projectionSetHash = requirementsProjectionSetHash(modelPacketResult.modelPacket);
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
    semanticModelHash: input.semanticModelHash,
    implementationConfirmationHash: input.compiledPromptRef.implementationConfirmationHash,
    projectionSetHash,
    modelPacketHash: input.compiledPromptRef.modelPacketHash,
    auditReceiptHash: input.compiledPromptRef.auditReceiptHash,
    goalExecutionHash: input.compiledPromptRef.goalExecutionHash ?? null,
    currentAttemptHash: sha256Text(input.attemptId),
    currentEvidenceHash: evidenceHash,
    priorRepairReceiptRefs: input.priorRepairReceiptRefs,
  });
  const triadPath = writeAuditTriadExecutionPlan(input.projectRoot, triadPlan, {
    recordPath: input.recordPath,
  });
  const triadRef: AuditTriadExecutionPlanRef = {
    path: triadPath,
    contentHash: sha256Text(fs.readFileSync(triadPath, 'utf8')),
    attemptId: triadPlan.attemptId,
    stageProfileId: triadPlan.stageProfileId,
    auditEpochId: triadPlan.auditEpochId,
    auditTargetBundleHash: triadPlan.auditTargetBundleHash,
    semanticModelHash: triadPlan.semanticModelHash,
    projectionSetHash: triadPlan.projectionSetHash,
    qualityRuleSetHash: triadPlan.qualityRuleSetHash,
    criticalAuditorProfileHash: triadPlan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: triadPlan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: triadPlan.requiredCheckItemSetHash,
    auditReceiptHash: triadPlan.auditReceiptHash ?? null,
    goalExecutionHash: triadPlan.goalExecutionHash ?? null,
    currentAttemptHash: triadPlan.currentAttemptHash,
    currentEvidenceHash: triadPlan.currentEvidenceHash,
  };
  const dir = auditArtifactsDir(
    input.projectRoot,
    input.recordId,
    input.attemptId,
    input.recordPath
  );
  const reportPath = path.join(dir, 'AUDIT_current_attempt.md');
  const profile: AuditExecutionProfile = {
    schemaVersion: 'audit-execution-profile/v1',
    profileId: 'main-agent-audit-review-execution',
    profileHash: criticalProfile.profileHash,
    stageProfileId,
    stageProfileHash: validation.stageProfile.stageProfileHash,
    requiredCheckItemSetHash,
    auditEpochId: triadPlan.auditEpochId,
    auditTargetBundleHash: triadPlan.auditTargetBundleHash,
    semanticModelHash: triadPlan.semanticModelHash,
    projectionSetHash: triadPlan.projectionSetHash,
    checkedProjectionQualityRuleCodes: triadPlan.checkedProjectionQualityRuleCodes,
    qualityRuleSetHash: triadPlan.qualityRuleSetHash,
    independentProviderBinding: triadPlan.independentProviderBinding,
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
      semanticModelHash: triadPlan.semanticModelHash,
      implementationConfirmationHash: input.compiledPromptRef.implementationConfirmationHash,
      projectionSetHash: triadPlan.projectionSetHash,
      qualityRuleSetHash: triadPlan.qualityRuleSetHash,
      auditEpochId: triadPlan.auditEpochId,
      auditTargetBundleHash: triadPlan.auditTargetBundleHash,
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

interface AuditOpenReadonlyAuditorRoundState {
  status: 'awaiting_response' | 'response_available';
  requestPath: string;
  responsePath: string;
  roundIndex: number;
}

interface AuditCompletedReadonlyAuditorRoundsState {
  status: 'rounds_complete';
  roundReceiptPaths: string[];
}

type AuditReadonlyAuditorRequestState =
  | AuditOpenReadonlyAuditorRoundState
  | AuditCompletedReadonlyAuditorRoundsState;

interface AuditControlledRoundResult {
  roundIndex: number;
  roundReceiptPath: string;
  judgeReceiptPath: string;
  verdict: AuditTriadJudgeVerdict;
  validatedGapRefs: string[];
}

function auditRoundDir(planPath: string, roundIndex: number): string {
  return path.join(path.dirname(planPath), 'rounds', `round-${roundIndex}`);
}

function auditReadonlyAuditorInvocationStatePath(roundDir: string): string {
  return path.join(roundDir, 'readonly-auditor-invocation-state.json');
}

function writeAuditReadonlyAuditorInvocationState(
  statePath: string,
  value: Record<string, unknown>
): Record<string, unknown> {
  const stateWithoutHash = { ...value };
  delete stateWithoutHash.stateHash;
  const state = {
    ...stateWithoutHash,
    stateHash: sha256Json(stateWithoutHash),
  };
  writeJsonUtf8(statePath, state);
  return state;
}

function hasCommittedAuditReadonlyAuditorInvocation(input: {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  requestPath: string;
  responsePath: string;
  roundIndex: number;
}): boolean {
  const roundDir = path.dirname(input.requestPath);
  const statePath = auditReadonlyAuditorInvocationStatePath(roundDir);
  const hostReceiptPath = path.join(roundDir, 'readonly-auditor-host-invocation-receipt.json');
  const request = readJsonIfExists(input.requestPath);
  const response = readJsonIfExists(input.responsePath);
  const state = readJsonIfExists(statePath);
  const hostReceipt = readJsonIfExists(hostReceiptPath);
  if (!request || !response || !state || !hostReceipt) return false;
  const auditReportPathValue = normalizeText(hostReceipt.auditReportPath);
  const auditReportPath = auditReportPathValue
    ? resolveRootRelativePath(input.projectRoot, auditReportPathValue)
    : '';

  const stateWithoutHash = { ...state };
  delete stateWithoutHash.stateHash;
  return (
    normalizeText(state.schemaVersion) === 'audit-readonly-auditor-invocation-state/v1' &&
    normalizeText(state.status) === 'committed' &&
    normalizeText(state.requestHash) === normalizeText(request.requestHash) &&
    normalizeText(state.auditEpochId) === input.plan.auditEpochId &&
    normalizeText(state.auditTargetBundleHash) === input.plan.auditTargetBundleHash &&
    Number(state.roundIndex) === input.roundIndex &&
    normalizeText(state.invocationId) !== '' &&
    normalizeText(state.invocationId) === normalizeText(hostReceipt.invocationId) &&
    /^sha256:[a-f0-9]{64}$/u.test(normalizeText(state.invocationNonceHash)) &&
    normalizeText(state.invocationNonceHash) === normalizeText(hostReceipt.invocationNonceHash) &&
    normalizeText(response.producerInvocationId) === normalizeText(state.invocationId) &&
    normalizeText(hostReceipt.producerInvocationId) === normalizeText(state.invocationId) &&
    normalizeText(state.responseHash) === normalizeText(response.responseHash) &&
    normalizeText(state.responseContentHash) === sha256File(input.responsePath) &&
    Boolean(auditReportPath) &&
    fs.existsSync(auditReportPath) &&
    normalizeText(hostReceipt.auditReportHash) === sha256File(auditReportPath) &&
    normalizeText(state.auditReportContentHash) === sha256File(auditReportPath) &&
    normalizeText(state.hostReceiptContentHash) === sha256File(hostReceiptPath) &&
    normalizeText(state.hostReceiptReceiptHash) === normalizeText(hostReceipt.receiptHash) &&
    normalizeText(hostReceipt.adapterKind) === 'codex_exec_readonly' &&
    hostReceipt.responseProduced === true &&
    Number(hostReceipt.exitCode) === 0 &&
    normalizeText(state.stateHash) === sha256Json(stateWithoutHash)
  );
}

function resolveDefaultAuditReadonlyAuditorCommand(): string[] {
  const pathEntries = (process.env.PATH ?? process.env.Path ?? '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const visited = new Set<string>();
  for (const entry of pathEntries) {
    const resolvedEntry = path.resolve(entry);
    const normalizedEntry = resolvedEntry.toLowerCase();
    if (visited.has(normalizedEntry)) continue;
    visited.add(normalizedEntry);

    if (process.platform !== 'win32') {
      const executable = path.join(resolvedEntry, 'codex');
      if (!fs.existsSync(executable) || !fs.statSync(executable).isFile()) {
        continue;
      }
      try {
        fs.accessSync(executable, fs.constants.X_OK);
        return [executable];
      } catch {
        continue;
      }
    }

    const nativeExecutable = path.join(resolvedEntry, 'codex.exe');
    if (fs.existsSync(nativeExecutable)) return [nativeExecutable];

    const npmShim = path.join(resolvedEntry, 'codex.cmd');
    const npmJavaScriptEntry = path.join(
      resolvedEntry,
      'node_modules',
      '@openai',
      'codex',
      'bin',
      'codex.js'
    );
    if (fs.existsSync(npmShim) && fs.existsSync(npmJavaScriptEntry)) {
      return [process.execPath, npmJavaScriptEntry];
    }
  }
  throw new Error('audit_readonly_auditor_codex_entry_not_resolvable');
}

function auditReadonlyAuditorResponseSchema(
  plan: AuditTriadExecutionPlan,
  requestHash: string,
  invocationId: string,
  roundIndex: number
): Record<string, unknown> {
  const perspectiveResultSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['agentId', 'validGaps'],
    properties: {
      agentId: { type: 'string', const: invocationId },
      validGaps: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
    },
  };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: [
      'schemaVersion',
      'requestHash',
      'auditEpochId',
      'auditTargetBundleHash',
      'roundIndex',
      'producerInvocationId',
      'perspectiveResults',
      'coveredCheckItemIds',
      'vetoItemResults',
      'validatedGapRefs',
      'invalidGapRefs',
      'checkedProjectionQualityRuleCodes',
      'auditStatus',
      'requiredFixes',
      'rationale',
    ],
    properties: {
      schemaVersion: { type: 'string', const: 'audit-readonly-auditor-response/v1' },
      requestHash: { type: 'string', const: requestHash },
      auditEpochId: { type: 'string', const: plan.auditEpochId },
      auditTargetBundleHash: { type: 'string', const: plan.auditTargetBundleHash },
      roundIndex: { type: 'integer', const: roundIndex },
      producerInvocationId: { type: 'string', const: invocationId },
      perspectiveResults: {
        type: 'object',
        additionalProperties: false,
        required: ['product_intent', 'model_projection', 'main_agent_execution'],
        properties: {
          product_intent: perspectiveResultSchema,
          model_projection: perspectiveResultSchema,
          main_agent_execution: perspectiveResultSchema,
        },
      },
      coveredCheckItemIds: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
      vetoItemResults: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['itemId', 'passed'],
          properties: {
            itemId: { type: 'string', enum: plan.vetoItemIds },
            passed: { type: 'boolean' },
          },
        },
      },
      validatedGapRefs: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
      invalidGapRefs: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
      checkedProjectionQualityRuleCodes: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
      auditStatus: { type: 'string', enum: ['PASS', 'FAIL'] },
      requiredFixes: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
      rationale: { type: 'string', minLength: 1 },
    },
  };
}

function auditReadonlyAuditorPrompt(input: {
  projectRoot: string;
  requestPath: string;
  plan: AuditTriadExecutionPlan;
  roundIndex: number;
  invocationId: string;
}): string {
  return [
    'Act as the one-shot readonly Critical Auditor for this audit round.',
    'Do not modify source, tests, configuration, receipts, or runtime state.',
    `Read the request at ${toRootRelativePath(input.projectRoot, input.requestPath)}.`,
    'Inspect the current production source and evidence independently.',
    'Return only the JSON object required by the supplied output schema.',
    'Do not include Judge verdicts, provider evidence, credentials, or host receipts.',
    `Use producerInvocationId ${input.invocationId} and repeat that exact value as agentId for all three perspective results; one real readonly invocation owns all perspectives.`,
    `Bind the response to round ${input.roundIndex}, audit epoch ${input.plan.auditEpochId}, and the request hash from the request file.`,
    `Report every required veto item exactly once: ${input.plan.vetoItemIds.join(', ')}.`,
    'Set auditStatus=PASS only when validatedGapRefs is empty and every veto item passed; otherwise set auditStatus=FAIL and provide non-empty requiredFixes.',
  ].join('\n');
}

function materializeAuditReadonlyAuditorReport(input: {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  reportPath: string;
}): void {
  const validatedGapRefs = stringsFrom(input.response.validatedGapRefs);
  const vetoItemResults = asRecordArray(input.response.vetoItemResults);
  const hasFailedVeto = vetoItemResults.some((item) => item.passed !== true);
  const expectedStatus = validatedGapRefs.length === 0 && !hasFailedVeto ? 'PASS' : 'FAIL';
  const auditStatus = normalizeText(input.response.auditStatus);
  const requiredFixes = stringsFrom(input.response.requiredFixes);
  if (
    auditStatus !== expectedStatus ||
    (auditStatus === 'PASS' && requiredFixes.length > 0) ||
    (auditStatus === 'FAIL' && requiredFixes.length === 0)
  ) {
    throw new Error('audit_readonly_auditor_report_status_inconsistent');
  }
  const reportLines = [
    `status: ${auditStatus}`,
    `stage: ${input.plan.stage}`,
    `reportPath: ${toRootRelativePath(input.projectRoot, input.reportPath)}`,
    `artifactDocPath: ${normalizeText(input.request.auditArtifactPath)}`,
    `iteration_count: ${Number(input.response.roundIndex)}`,
    `required_fixes_count: ${requiredFixes.length}`,
    'score_trigger_present: true',
    `converged: ${auditStatus === 'PASS' ? 'true' : 'false'}`,
    '',
    '## Required Fixes',
    ...(requiredFixes.length > 0 ? requiredFixes.map((fix) => `- ${fix}`) : ['- None']),
    '',
    '## Auditor Rationale',
    normalizeText(input.response.rationale),
    '',
  ];
  fs.writeFileSync(input.reportPath, reportLines.join('\n'), 'utf8');
}

function executeAuditReadonlyAuditor(input: {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  state: AuditOpenReadonlyAuditorRoundState;
}): void {
  const actualRoundDir = path.dirname(input.state.requestPath);
  const schemaPath = path.join(actualRoundDir, 'readonly-auditor-response.schema.json');
  const rawResponsePath = path.join(actualRoundDir, 'readonly-auditor-response.raw.json');
  const candidateResponsePath = path.join(
    actualRoundDir,
    'readonly-auditor-response.candidate.json'
  );
  const stdoutPath = path.join(actualRoundDir, 'readonly-auditor-host.stdout.log');
  const stderrPath = path.join(actualRoundDir, 'readonly-auditor-host.stderr.log');
  const hostReceiptPath = path.join(
    actualRoundDir,
    'readonly-auditor-host-invocation-receipt.json'
  );
  const auditReportPath = path.join(actualRoundDir, 'readonly-auditor-report.md');
  const invocationStatePath = auditReadonlyAuditorInvocationStatePath(actualRoundDir);
  const request = readJsonIfExists(input.state.requestPath);
  if (!request) throw new Error('audit_readonly_auditor_request_missing');
  if (
    hasCommittedAuditReadonlyAuditorInvocation({
      projectRoot: input.projectRoot,
      plan: input.plan,
      requestPath: input.state.requestPath,
      responsePath: input.state.responsePath,
      roundIndex: input.state.roundIndex,
    })
  ) {
    return;
  }
  const staleArtifacts = [
    input.state.responsePath,
    rawResponsePath,
    candidateResponsePath,
    hostReceiptPath,
    invocationStatePath,
    stdoutPath,
    stderrPath,
    auditReportPath,
  ].filter((artifactPath) => fs.existsSync(artifactPath));
  if (staleArtifacts.length > 0) {
    const priorState = readJsonIfExists(invocationStatePath);
    const archiveDir = path.join(
      actualRoundDir,
      'failed-readonly-auditor-invocations',
      normalizeText(priorState?.invocationId) || crypto.randomUUID()
    );
    fs.mkdirSync(archiveDir, { recursive: true });
    for (const artifactPath of staleArtifacts) {
      fs.renameSync(artifactPath, path.join(archiveDir, path.basename(artifactPath)));
    }
  }
  const invocationId = crypto.randomUUID();
  writeJsonUtf8(
    schemaPath,
    auditReadonlyAuditorResponseSchema(
      input.plan,
      normalizeText(request.requestHash),
      invocationId,
      input.state.roundIndex
    )
  );
  const prompt = auditReadonlyAuditorPrompt({
    projectRoot: input.projectRoot,
    requestPath: input.state.requestPath,
    plan: input.plan,
    roundIndex: input.state.roundIndex,
    invocationId,
  });
  const startedAt = new Date().toISOString();
  const invocationNonceHash = sha256Text(crypto.randomBytes(32).toString('hex'));
  const baseInvocationState = {
    schemaVersion: 'audit-readonly-auditor-invocation-state/v1',
    auditEpochId: input.plan.auditEpochId,
    auditTargetBundleHash: input.plan.auditTargetBundleHash,
    roundIndex: input.state.roundIndex,
    requestHash: normalizeText(request.requestHash),
    invocationId,
    invocationNonceHash,
    startedAt,
  };
  writeAuditReadonlyAuditorInvocationState(invocationStatePath, {
    ...baseInvocationState,
    status: 'prepared',
    completedAt: null,
    exitCode: null,
    responseHash: null,
    responseContentHash: null,
    hostReceiptReceiptHash: null,
    hostReceiptContentHash: null,
    failureCode: null,
  });
  let command: string;
  let commandArgs: string[];
  try {
    const [resolvedCommand, ...commandPrefixArgs] = resolveDefaultAuditReadonlyAuditorCommand();
    command = resolvedCommand;
    commandArgs = [
      ...commandPrefixArgs,
      'exec',
      '--sandbox',
      'read-only',
      '--ephemeral',
      '--skip-git-repo-check',
      '--output-schema',
      schemaPath,
      '--output-last-message',
      rawResponsePath,
      '--json',
      '-C',
      input.projectRoot,
      '-',
    ];
  } catch (error) {
    writeAuditReadonlyAuditorInvocationState(invocationStatePath, {
      ...baseInvocationState,
      status: 'failed',
      completedAt: new Date().toISOString(),
      exitCode: -1,
      responseHash: null,
      responseContentHash: null,
      hostReceiptReceiptHash: null,
      hostReceiptContentHash: null,
      failureCode:
        error instanceof Error ? error.message : 'audit_readonly_auditor_command_resolution_failed',
    });
    throw error;
  }
  const execution = spawnSync(command, commandArgs, {
    cwd: input.projectRoot,
    encoding: 'utf8',
    input: prompt,
    env: {
      ...process.env,
      BMAD_READONLY_AUDITOR_PROJECT_ROOT: input.projectRoot,
      BMAD_READONLY_AUDITOR_REQUEST_PATH: input.state.requestPath,
      BMAD_READONLY_AUDITOR_RESPONSE_SCHEMA_PATH: schemaPath,
      BMAD_READONLY_AUDITOR_ROUND_INDEX: String(input.state.roundIndex),
    },
    shell: false,
    timeout: resolveAuditReadonlyAuditorHostTimeoutMs(input.projectRoot),
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  const completedAt = new Date().toISOString();
  const stdout = execution.stdout ?? '';
  const stderr = execution.stderr ?? '';
  fs.writeFileSync(stdoutPath, stdout, 'utf8');
  fs.writeFileSync(stderrPath, stderr, 'utf8');
  const exitCode =
    typeof execution.status === 'number' ? execution.status : execution.error ? -1 : 0;
  const baseReceipt = {
    schemaVersion: 'audit-readonly-auditor-host-invocation-receipt/v1',
    auditEpochId: input.plan.auditEpochId,
    auditTargetBundleHash: input.plan.auditTargetBundleHash,
    roundIndex: input.state.roundIndex,
    requestHash: normalizeText(request.requestHash),
    invocationId,
    invocationNonceHash,
    adapterKind: 'codex_exec_readonly',
    commandHash: sha256Json({
      command,
      args: commandArgs,
    }),
    startedAt,
    completedAt,
    exitCode,
    stdoutPath: toRootRelativePath(input.projectRoot, stdoutPath),
    stdoutHash: sha256Text(stdout),
    stderrPath: toRootRelativePath(input.projectRoot, stderrPath),
    stderrHash: sha256Text(stderr),
  };
  const writeHostReceipt = (details: Record<string, unknown>): Record<string, unknown> => {
    const receiptWithoutHash = {
      ...baseReceipt,
      ...details,
    };
    const receipt = {
      ...receiptWithoutHash,
      receiptHash: sha256Json(receiptWithoutHash),
    };
    writeJsonUtf8(hostReceiptPath, receipt);
    return receipt;
  };
  const writeFailedInvocationState = (
    hostReceipt: Record<string, unknown>,
    failureCode: string
  ): void => {
    writeAuditReadonlyAuditorInvocationState(invocationStatePath, {
      ...baseInvocationState,
      status: 'failed',
      completedAt,
      exitCode,
      responseHash: null,
      responseContentHash: null,
      hostReceiptReceiptHash: normalizeText(hostReceipt.receiptHash),
      hostReceiptContentHash: sha256File(hostReceiptPath),
      failureCode,
    });
  };
  if (execution.error || exitCode !== 0) {
    const hostReceipt = writeHostReceipt({
      responseProduced: false,
      responseHash: null,
      failureCode: 'audit_readonly_auditor_adapter_failed',
    });
    writeFailedInvocationState(hostReceipt, 'audit_readonly_auditor_adapter_failed');
    throw new Error(
      `audit_readonly_auditor_adapter_failed:${exitCode}:${
        execution.error?.message || stderr || stdout
      }`
    );
  }
  try {
    if (!fs.existsSync(rawResponsePath)) {
      throw new Error('audit_readonly_auditor_response_file_missing');
    }
    const rawResponseText = fs.readFileSync(rawResponsePath, 'utf8');
    const parsed = JSON.parse(rawResponseText.trim()) as Record<string, unknown>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      auditProviderContainsCredentialMaterial(parsed) ||
      Object.hasOwn(parsed, 'independentProviderEvidence') ||
      Object.hasOwn(parsed, 'providerRun') ||
      Object.hasOwn(parsed, 'judgeDecision') ||
      Object.hasOwn(parsed, 'verdict')
    ) {
      throw new Error('audit_readonly_auditor_adapter_response_invalid');
    }
    const responseWithoutHash = { ...parsed };
    const response = {
      ...responseWithoutHash,
      responseHash: sha256Json(responseWithoutHash),
    };
    writeJsonUtf8(candidateResponsePath, response);
    readAuditReadonlyAuditorResponse({
      projectRoot: input.projectRoot,
      plan: input.plan,
      requestPath: input.state.requestPath,
      responsePath: candidateResponsePath,
      roundIndex: input.state.roundIndex,
      requireHostReceipt: false,
    });
    writeJsonUtf8(input.state.responsePath, response);
    materializeAuditReadonlyAuditorReport({
      projectRoot: input.projectRoot,
      plan: input.plan,
      request,
      response,
      reportPath: auditReportPath,
    });
    const hostReceipt = writeHostReceipt({
      responseProduced: true,
      responseHash: response.responseHash,
      producerInvocationId: invocationId,
      auditReportPath: toRootRelativePath(input.projectRoot, auditReportPath),
      auditReportHash: sha256File(auditReportPath),
      failureCode: null,
    });
    writeAuditReadonlyAuditorInvocationState(invocationStatePath, {
      ...baseInvocationState,
      status: 'committed',
      completedAt,
      exitCode,
      responseHash: response.responseHash,
      responseContentHash: sha256File(input.state.responsePath),
      auditReportContentHash: sha256File(auditReportPath),
      hostReceiptReceiptHash: normalizeText(hostReceipt.receiptHash),
      hostReceiptContentHash: sha256File(hostReceiptPath),
      failureCode: null,
    });
  } catch (error) {
    fs.rmSync(input.state.responsePath, { force: true });
    const hostReceipt = writeHostReceipt({
      responseProduced: false,
      responseHash: null,
      failureCode: 'audit_readonly_auditor_adapter_response_invalid',
    });
    writeFailedInvocationState(hostReceipt, 'audit_readonly_auditor_adapter_response_invalid');
    throw error;
  } finally {
    if (fs.existsSync(candidateResponsePath)) {
      fs.rmSync(candidateResponsePath, { force: true });
    }
  }
}

function validatePersistedAuditControlledRoundProvenance(input: {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  planPath: string;
  roundIndex: number;
  roundReceiptPath: string;
}): AuditTriadRoundReceipt {
  const roundLabel = `round-${input.roundIndex}`;
  const roundDir = auditRoundDir(input.planPath, input.roundIndex);
  const judgeReceiptPath = path.join(roundDir, 'judge-execution-receipt.json');
  const readonlyRequestPath = path.join(roundDir, 'readonly-auditor-request.json');
  const readonlyResponsePath = path.join(roundDir, 'readonly-auditor-response.json');
  const hostReceiptPath = path.join(roundDir, 'readonly-auditor-host-invocation-receipt.json');
  const runAuditorHostBindingPath = path.join(roundDir, 'run-auditor-host-binding.json');
  const judgeAuthoritativeReportPath = path.join(roundDir, 'judge-authoritative-audit-report.md');
  for (const [role, artifactPath] of [
    ['judge_execution_receipt', judgeReceiptPath],
    ['readonly_auditor_request', readonlyRequestPath],
    ['readonly_auditor_response', readonlyResponsePath],
    ['readonly_auditor_host_invocation_receipt', hostReceiptPath],
    ['run_auditor_host_binding', runAuditorHostBindingPath],
    ['judge_authoritative_audit_report', judgeAuthoritativeReportPath],
  ] as const) {
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`audit_controlled_executor_round_provenance_missing:${roundLabel}:${role}`);
    }
  }
  const roundReceipt = readJsonIfExists(input.roundReceiptPath);
  const judgeReceipt = readJsonIfExists(judgeReceiptPath);
  const readonlyRequest = readJsonIfExists(readonlyRequestPath);
  const readonlyResponse = readJsonIfExists(readonlyResponsePath);
  const hostReceipt = readJsonIfExists(hostReceiptPath);
  const runAuditorHostBinding = readJsonIfExists(runAuditorHostBindingPath);
  if (
    !roundReceipt ||
    !judgeReceipt ||
    !readonlyRequest ||
    !readonlyResponse ||
    !hostReceipt ||
    !runAuditorHostBinding
  ) {
    throw new Error(`audit_controlled_executor_round_provenance_invalid:${roundLabel}`);
  }
  if (
    normalizeText(roundReceipt.schemaVersion) !== 'audit-triad-round-receipt/v1' ||
    normalizeText(roundReceipt.roundId) !== roundLabel ||
    normalizeText(roundReceipt.auditEpochId) !== input.plan.auditEpochId ||
    normalizeText(roundReceipt.auditTargetBundleHash) !== input.plan.auditTargetBundleHash
  ) {
    throw new Error(`audit_controlled_executor_round_receipt_binding_invalid:${roundLabel}`);
  }
  const roundReceiptWithoutHash = { ...roundReceipt };
  delete roundReceiptWithoutHash.receiptHash;
  if (normalizeText(roundReceipt.receiptHash) !== sha256Json(roundReceiptWithoutHash)) {
    throw new Error(`audit_controlled_executor_round_receipt_self_hash_invalid:${roundLabel}`);
  }
  const judgeReceiptWithoutHash = { ...judgeReceipt };
  delete judgeReceiptWithoutHash.receiptHash;
  if (
    normalizeText(judgeReceipt.schemaVersion) !== 'audit-judge-execution-receipt/v1' ||
    Number(judgeReceipt.roundIndex) !== input.roundIndex ||
    normalizeText(judgeReceipt.auditEpochId) !== input.plan.auditEpochId ||
    normalizeText(judgeReceipt.auditTargetBundleHash) !== input.plan.auditTargetBundleHash ||
    normalizeText(judgeReceipt.sourceDocumentHash) !== input.plan.sourceDocumentHash ||
    !/^sha256:[a-f0-9]{64}$/u.test(normalizeText(judgeReceipt.sourceBytesHash)) ||
    normalizeText(roundReceipt.sourceBytesHash) !== normalizeText(judgeReceipt.sourceBytesHash) ||
    normalizeText(judgeReceipt.semanticModelHash) !== input.plan.semanticModelHash ||
    normalizeText(judgeReceipt.implementationConfirmationHash) !==
      input.plan.implementationConfirmationHash ||
    normalizeText(judgeReceipt.projectionSetHash) !== input.plan.projectionSetHash ||
    normalizeText(judgeReceipt.qualityRuleSetHash) !== input.plan.qualityRuleSetHash ||
    normalizeText(judgeReceipt.currentAttemptHash) !== input.plan.currentAttemptHash ||
    normalizeText(judgeReceipt.currentEvidenceHash) !== input.plan.currentEvidenceHash ||
    !/^sha256:[a-f0-9]{64}$/u.test(normalizeText(judgeReceipt.auditReviewScoringContractHash)) ||
    Object.keys(recordObject(judgeReceipt.auditReviewScoring)).length === 0 ||
    normalizeText(judgeReceipt.receiptHash) !== sha256Json(judgeReceiptWithoutHash)
  ) {
    throw new Error(`audit_controlled_executor_judge_receipt_invalid:${roundLabel}`);
  }
  const roundVerdict = normalizeText(roundReceipt.verdict);
  const judgeVerdict = normalizeText(judgeReceipt.verdict);
  if (!roundVerdict || roundVerdict !== judgeVerdict) {
    throw new Error(`audit_controlled_executor_judge_verdict_binding_invalid:${roundLabel}`);
  }
  if (!isAuditTriadNoNewGapVerdict(roundVerdict as AuditTriadJudgeVerdict)) {
    throw new Error(
      `audit_controlled_executor_judge_verdict_not_convergent:${roundLabel}:${roundVerdict}`
    );
  }
  const readonlyResponseWithoutHash = { ...readonlyResponse };
  delete readonlyResponseWithoutHash.responseHash;
  if (
    normalizeText(readonlyResponse.requestHash) !== normalizeText(readonlyRequest.requestHash) ||
    normalizeText(roundReceipt.readonlyAuditorInvocationId) !==
      normalizeText(readonlyResponse.producerInvocationId) ||
    normalizeText(readonlyResponse.responseHash) !== sha256Json(readonlyResponseWithoutHash)
  ) {
    throw new Error(`audit_controlled_executor_readonly_response_invalid:${roundLabel}`);
  }
  const hostReceiptWithoutHash = { ...hostReceipt };
  delete hostReceiptWithoutHash.receiptHash;
  if (
    normalizeText(hostReceipt.schemaVersion) !==
      'audit-readonly-auditor-host-invocation-receipt/v1' ||
    Number(hostReceipt.roundIndex) !== input.roundIndex ||
    normalizeText(hostReceipt.auditEpochId) !== input.plan.auditEpochId ||
    normalizeText(hostReceipt.requestHash) !== normalizeText(readonlyRequest.requestHash) ||
    normalizeText(hostReceipt.responseHash) !== normalizeText(readonlyResponse.responseHash) ||
    normalizeText(hostReceipt.producerInvocationId) !==
      normalizeText(roundReceipt.readonlyAuditorInvocationId) ||
    Number(hostReceipt.exitCode) !== 0 ||
    normalizeText(hostReceipt.receiptHash) !== sha256Json(hostReceiptWithoutHash)
  ) {
    throw new Error(`audit_controlled_executor_host_receipt_invalid:${roundLabel}`);
  }
  const judgeEvidence = recordObject(judgeReceipt.independentProviderEvidence);
  const roundEvidence = recordObject(roundReceipt.independentProviderEvidence);
  if (
    !normalizeText(judgeEvidence.providerRunId) ||
    normalizeText(judgeEvidence.providerRunId) !== normalizeText(roundEvidence.providerRunId) ||
    normalizeText(judgeEvidence.requestHash) !==
      normalizeText(roundReceipt.auditTriadJudgeRequestHash)
  ) {
    throw new Error(`audit_controlled_executor_provider_provenance_invalid:${roundLabel}`);
  }
  const judgeProviderReceiptRef = recordObject(judgeReceipt.providerInvocationReceiptRef);
  const roundProviderReceiptRef = recordObject(roundReceipt.providerInvocationReceiptRef);
  if (sha256Json(judgeProviderReceiptRef) !== sha256Json(roundProviderReceiptRef)) {
    throw new Error(`audit_controlled_executor_provider_receipt_ref_mismatch:${roundLabel}`);
  }
  validateAuditProviderInvocationReceipt({
    projectRoot: input.projectRoot,
    receiptRef: judgeProviderReceiptRef,
    requestHash: normalizeText(roundReceipt.auditTriadJudgeRequestHash),
    sourceDocumentHash: input.plan.sourceDocumentHash,
    sourceBytesHash: normalizeText(judgeReceipt.sourceBytesHash),
    semanticModelHash: input.plan.semanticModelHash,
    projectionSetHash: input.plan.projectionSetHash,
    providerRunId: normalizeText(judgeEvidence.providerRunId),
    expectedProviderBinding: input.plan.independentProviderBinding,
  });
  const judgeHostExecution = validateAuditProviderJudgeHostExecution(
    input.projectRoot,
    judgeReceipt.judgeAdapterHostExecution
  );
  const roundHostExecution = validateAuditProviderJudgeHostExecution(
    input.projectRoot,
    roundReceipt.judgeAdapterHostExecution
  );
  if (sha256Json(judgeHostExecution) !== sha256Json(roundHostExecution)) {
    throw new Error(`audit_controlled_executor_judge_host_execution_mismatch:${roundLabel}`);
  }
  const judgeReceiptRef = recordObject(roundReceipt.judgeExecutionReceiptRef);
  const readonlyHostReceiptRef = recordObject(roundReceipt.readonlyAuditorHostInvocationReceiptRef);
  if (
    normalizeText(judgeReceiptRef.path) !==
      toRootRelativePath(input.projectRoot, judgeReceiptPath) ||
    normalizeText(judgeReceiptRef.contentHash) !== sha256File(judgeReceiptPath) ||
    normalizeText(judgeReceiptRef.receiptHash) !== normalizeText(judgeReceipt.receiptHash)
  ) {
    throw new Error(`audit_controlled_executor_judge_receipt_ref_invalid:${roundLabel}`);
  }
  if (
    normalizeText(readonlyHostReceiptRef.path) !==
      toRootRelativePath(input.projectRoot, hostReceiptPath) ||
    normalizeText(readonlyHostReceiptRef.contentHash) !== sha256File(hostReceiptPath) ||
    normalizeText(readonlyHostReceiptRef.receiptHash) !== normalizeText(hostReceipt.receiptHash)
  ) {
    throw new Error(`audit_controlled_executor_host_receipt_ref_invalid:${roundLabel}`);
  }
  const scoreReceiptRefs = stringsFrom(roundReceipt.scoreReceiptRefs);
  const runAuditorHostReceiptRefs = stringsFrom(roundReceipt.runAuditorHostReceiptRefs);
  if (scoreReceiptRefs.length !== 1 || runAuditorHostReceiptRefs.length !== 1) {
    throw new Error(`audit_controlled_executor_auditor_host_receipt_count_invalid:${roundLabel}`);
  }
  const scoreReceiptPath = resolveRootRelativePath(input.projectRoot, scoreReceiptRefs[0]);
  const runAuditorHostReceiptPath = resolveRootRelativePath(
    input.projectRoot,
    runAuditorHostReceiptRefs[0]
  );
  const scoreReceipt = readJsonIfExists(scoreReceiptPath);
  const runAuditorHostReceipt = readJsonIfExists(runAuditorHostReceiptPath);
  if (!scoreReceipt || !runAuditorHostReceipt) {
    throw new Error(`audit_controlled_executor_auditor_host_receipt_missing:${roundLabel}`);
  }
  const scoreReceiptWithoutHash = { ...scoreReceipt };
  delete scoreReceiptWithoutHash.receiptHash;
  const runAuditorHostReceiptWithoutHash = { ...runAuditorHostReceipt };
  delete runAuditorHostReceiptWithoutHash.receiptHash;
  const scoreWriterInvocationReceiptRef = validateAuditBoundReceiptRef({
    projectRoot: input.projectRoot,
    value: roundReceipt.scoreWriterInvocationReceiptRef,
    expectedSchemaVersion: 'run-auditor-host-score-writer-invocation-receipt/v1',
    errorCode: `audit_controlled_executor_score_writer_invocation_receipt:${roundLabel}`,
  });
  const scoreWriterInvocationReceiptPath = resolveRootRelativePath(
    input.projectRoot,
    scoreWriterInvocationReceiptRef.path
  );
  const scoreWriterInvocationReceipt = readJsonIfExists(scoreWriterInvocationReceiptPath);
  if (!scoreWriterInvocationReceipt) {
    throw new Error(
      `audit_controlled_executor_score_writer_invocation_receipt_missing:${roundLabel}`
    );
  }
  const scoreWriterStatePath = path.join(
    path.dirname(scoreWriterInvocationReceiptPath),
    'score-writer-invocation-state.json'
  );
  const scoreWriterState = readJsonIfExists(scoreWriterStatePath);
  const scoreRecordPath = resolveRootRelativePath(
    input.projectRoot,
    normalizeText(scoreWriterInvocationReceipt.scoreRecordPath)
  );
  const scoreRecord = readJsonIfExists(scoreRecordPath);
  const runAuditorHostInvocationId = normalizeText(
    runAuditorHostBinding.runAuditorHostInvocationId
  );
  const runAuditorHostBindingHash = sha256Json(runAuditorHostBinding);
  const scoreWriterStateWithoutHash = scoreWriterState ? { ...scoreWriterState } : null;
  if (scoreWriterStateWithoutHash) {
    delete scoreWriterStateWithoutHash.stateHash;
  }
  const scoreWriterProducer = recordObject(scoreWriterInvocationReceipt.producerIdentity);
  const boundScoreWriterReceiptRef = recordObject(scoreReceipt.scoreWriterInvocationReceiptRef);
  const hostScoreWriterReceiptRef = recordObject(
    runAuditorHostReceipt.scoreWriterInvocationReceiptRef
  );
  if (
    scoreWriterInvocationReceiptRef.path === scoreReceiptRefs[0] ||
    scoreWriterInvocationReceiptRef.path === runAuditorHostReceiptRefs[0] ||
    scoreWriterInvocationReceiptRef.path === normalizeText(judgeReceiptRef.path) ||
    scoreWriterInvocationReceiptRef.path === normalizeText(readonlyHostReceiptRef.path)
  ) {
    throw new Error(
      `audit_controlled_executor_score_writer_invocation_receipt_role_invalid:${roundLabel}`
    );
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      runAuditorHostInvocationId
    ) ||
    normalizeText(runAuditorHostBinding.roundId) !== roundLabel ||
    normalizeText(runAuditorHostBinding.auditEpochId) !== input.plan.auditEpochId ||
    normalizeText(runAuditorHostBinding.auditTargetBundleHash) !==
      input.plan.auditTargetBundleHash ||
    normalizeText(runAuditorHostBinding.sourceDocumentHash) !== input.plan.sourceDocumentHash ||
    normalizeText(runAuditorHostBinding.semanticModelHash) !== input.plan.semanticModelHash ||
    normalizeText(runAuditorHostBinding.projectionSetHash) !== input.plan.projectionSetHash ||
    normalizeText(runAuditorHostBinding.readonlyAuditorRequestHash) !==
      normalizeText(readonlyRequest.requestHash) ||
    normalizeText(runAuditorHostBinding.readonlyAuditorResponseHash) !==
      normalizeText(readonlyResponse.responseHash) ||
    normalizeText(runAuditorHostBinding.judgeRequestHash) !==
      normalizeText(judgeReceipt.judgeRequestHash) ||
    normalizeText(runAuditorHostBinding.judgeAuthoritativeReportHash) !==
      sha256File(judgeAuthoritativeReportPath) ||
    scoreWriterProducer.id !== 'package-score-command' ||
    scoreWriterProducer.role !== 'score_writer' ||
    normalizeText(scoreWriterInvocationReceipt.runAuditorHostInvocationId) !==
      runAuditorHostInvocationId ||
    normalizeText(scoreWriterInvocationReceipt.bindingHash) !== runAuditorHostBindingHash ||
    normalizeText(scoreWriterInvocationReceipt.roundId) !== roundLabel ||
    !normalizeText(scoreWriterInvocationReceipt.invocationId) ||
    !normalizeText(scoreWriterInvocationReceipt.scoreRunId) ||
    !scoreWriterState ||
    !scoreRecord ||
    normalizeText(scoreWriterState.schemaVersion) !==
      'run-auditor-host-score-writer-invocation-state/v1' ||
    normalizeText(scoreWriterState.status) !== 'committed' ||
    normalizeText(scoreWriterState.runAuditorHostInvocationId) !== runAuditorHostInvocationId ||
    normalizeText(scoreWriterState.invocationId) !==
      normalizeText(scoreWriterInvocationReceipt.invocationId) ||
    normalizeText(scoreWriterState.bindingHash) !== runAuditorHostBindingHash ||
    normalizeText(scoreWriterState.roundId) !== roundLabel ||
    normalizeText(scoreWriterState.scoreRunId) !==
      normalizeText(scoreWriterInvocationReceipt.scoreRunId) ||
    normalizeText(scoreWriterState.scoreRecordPath) !==
      normalizeText(scoreWriterInvocationReceipt.scoreRecordPath) ||
    normalizeText(scoreWriterState.receiptHash) !==
      normalizeText(scoreWriterInvocationReceipt.receiptHash) ||
    normalizeText(scoreWriterState.receiptContentHash) !==
      scoreWriterInvocationReceiptRef.contentHash ||
    normalizeText(scoreWriterState.stateHash) !== sha256Json(scoreWriterStateWithoutHash) ||
    normalizeText(scoreWriterInvocationReceipt.scoreRecordHash) !== sha256File(scoreRecordPath) ||
    sha256Json(boundScoreWriterReceiptRef) !== sha256Json(scoreWriterInvocationReceiptRef) ||
    sha256Json(hostScoreWriterReceiptRef) !== sha256Json(scoreWriterInvocationReceiptRef)
  ) {
    throw new Error(`audit_controlled_executor_score_writer_provenance_invalid:${roundLabel}`);
  }
  const judgeAuditReviewScoringHash = sha256Json(recordObject(judgeReceipt.auditReviewScoring));
  if (
    normalizeText(scoreReceipt.schemaVersion) !== 'run-auditor-host-score-receipt/v1' ||
    normalizeText(scoreReceipt.runAuditorHostInvocationId) !== runAuditorHostInvocationId ||
    normalizeText(scoreReceipt.bindingHash) !== runAuditorHostBindingHash ||
    normalizeText(scoreReceipt.roundId) !== roundLabel ||
    normalizeText(scoreReceipt.scoreRunId) !==
      normalizeText(scoreWriterInvocationReceipt.scoreRunId) ||
    normalizeText(scoreReceipt.scoreRecordPath) !==
      normalizeText(scoreWriterInvocationReceipt.scoreRecordPath) ||
    normalizeText(scoreReceipt.scoreRecordHash) !== sha256File(scoreRecordPath) ||
    normalizeText(scoreReceipt.sourceDocumentHash) !== input.plan.sourceDocumentHash ||
    normalizeText(scoreReceipt.semanticModelHash) !== input.plan.semanticModelHash ||
    normalizeText(scoreReceipt.projectionSetHash) !== input.plan.projectionSetHash ||
    normalizeText(scoreReceipt.auditReportHash) !== sha256File(judgeAuthoritativeReportPath) ||
    normalizeText(scoreReceipt.judgeAuditReviewScoringContractHash) !==
      normalizeText(judgeReceipt.auditReviewScoringContractHash) ||
    normalizeText(scoreReceipt.judgeAuditReviewScoringHash) !== judgeAuditReviewScoringHash ||
    normalizeText(scoreReceipt.receiptHash) !== sha256Json(scoreReceiptWithoutHash) ||
    normalizeText(runAuditorHostReceipt.schemaVersion) !== 'run-auditor-host-closeout-receipt/v1' ||
    normalizeText(runAuditorHostReceipt.runAuditorHostInvocationId) !==
      runAuditorHostInvocationId ||
    normalizeText(runAuditorHostReceipt.bindingHash) !== runAuditorHostBindingHash ||
    normalizeText(runAuditorHostReceipt.roundId) !== roundLabel ||
    normalizeText(runAuditorHostReceipt.scoreRecordPath) !==
      normalizeText(scoreWriterInvocationReceipt.scoreRecordPath) ||
    normalizeText(runAuditorHostReceipt.scoreRecordHash) !== sha256File(scoreRecordPath) ||
    normalizeText(runAuditorHostReceipt.scoreReceiptPath) !== scoreReceiptRefs[0] ||
    normalizeText(runAuditorHostReceipt.scoreReceiptHash) !==
      normalizeText(scoreReceipt.receiptHash) ||
    normalizeText(runAuditorHostReceipt.sourceDocumentHash) !== input.plan.sourceDocumentHash ||
    normalizeText(runAuditorHostReceipt.semanticModelHash) !== input.plan.semanticModelHash ||
    normalizeText(runAuditorHostReceipt.projectionSetHash) !== input.plan.projectionSetHash ||
    normalizeText(runAuditorHostReceipt.auditStatus) !== 'PASS' ||
    runAuditorHostReceipt.closeoutApproved !== true ||
    normalizeText(runAuditorHostReceipt.judgeVerdict) !== judgeVerdict ||
    normalizeText(runAuditorHostReceipt.judgeAuditReviewScoringContractHash) !==
      normalizeText(judgeReceipt.auditReviewScoringContractHash) ||
    normalizeText(runAuditorHostReceipt.judgeAuditReviewScoringHash) !==
      judgeAuditReviewScoringHash ||
    normalizeText(runAuditorHostReceipt.receiptHash) !==
      sha256Json(runAuditorHostReceiptWithoutHash)
  ) {
    throw new Error(`audit_controlled_executor_auditor_host_receipt_invalid:${roundLabel}`);
  }
  const projectRelativeRoundReceipt = toRootRelativePath(input.projectRoot, input.roundReceiptPath);
  if (!projectRelativeRoundReceipt) {
    throw new Error(`audit_controlled_executor_round_receipt_path_invalid:${roundLabel}`);
  }
  return roundReceipt as unknown as AuditTriadRoundReceipt;
}

function materializeAuditReadonlyAuditorRequest(input: {
  projectRoot: string;
  packet: ExecutionPacket;
}): AuditReadonlyAuditorRequestState {
  const profile = input.packet.auditExecutionProfile;
  const planRef = input.packet.auditTriadExecutionPlanRef;
  if (!profile || !planRef) {
    throw new Error('audit_controlled_executor_binding_missing');
  }
  const planPath = path.resolve(planRef.path);
  if (!fs.existsSync(planPath)) {
    throw new Error('audit_controlled_executor_plan_missing');
  }
  const planText = fs.readFileSync(planPath, 'utf8');
  if (sha256Text(planText) !== planRef.contentHash) {
    throw new Error('audit_controlled_executor_plan_hash_mismatch');
  }
  const plan = JSON.parse(planText) as AuditTriadExecutionPlan;
  if (
    plan.auditEpochId !== profile.auditEpochId ||
    plan.auditEpochId !== planRef.auditEpochId ||
    plan.auditTargetBundleHash !== profile.auditTargetBundleHash ||
    plan.auditTargetBundleHash !== planRef.auditTargetBundleHash
  ) {
    throw new Error('audit_controlled_executor_epoch_binding_mismatch');
  }
  const requiredRoundCount = Number(plan.roundPolicy?.consecutiveNoGapRoundsRequired);
  if (!Number.isInteger(requiredRoundCount) || requiredRoundCount < 1) {
    throw new Error('audit_controlled_executor_round_policy_invalid');
  }
  const roundReceiptPaths = Array.from({ length: requiredRoundCount }, (_, index) =>
    path.join(auditRoundDir(planPath, index + 1), 'audit-triad-round-receipt.json')
  );
  const persistedRounds: AuditTriadRoundReceipt[] = [];
  for (const [index, roundReceiptPath] of roundReceiptPaths.entries()) {
    if (fs.existsSync(roundReceiptPath)) {
      persistedRounds.push(
        validatePersistedAuditControlledRoundProvenance({
          projectRoot: input.projectRoot,
          plan,
          planPath,
          roundIndex: index + 1,
          roundReceiptPath,
        })
      );
    }
  }
  const historyIssues = auditTriadRoundHistoryIssues(persistedRounds);
  if (historyIssues.length > 0) {
    throw new Error(`audit_controlled_executor_round_history_invalid:${historyIssues[0]}`);
  }
  const nextRoundOffset = roundReceiptPaths.findIndex((receiptPath) => !fs.existsSync(receiptPath));
  if (nextRoundOffset < 0) {
    return {
      status: 'rounds_complete',
      roundReceiptPaths,
    };
  }
  const roundIndex = nextRoundOffset + 1;
  const roundDir = auditRoundDir(planPath, roundIndex);
  const requestPath = path.join(roundDir, 'readonly-auditor-request.json');
  const responsePath = path.join(roundDir, 'readonly-auditor-response.json');
  const requestWithoutHash = {
    schemaVersion: 'audit-readonly-auditor-request/v1',
    recordId: plan.recordId,
    attemptId: plan.attemptId,
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    roundIndex,
    sourceDocumentHash: plan.sourceDocumentHash,
    semanticModelHash: plan.semanticModelHash,
    implementationConfirmationHash: plan.implementationConfirmationHash,
    projectionSetHash: plan.projectionSetHash,
    checkedProjectionQualityRuleCodes: plan.checkedProjectionQualityRuleCodes,
    qualityRuleSetHash: plan.qualityRuleSetHash,
    requiredVetoItemIds: plan.vetoItemIds,
    priorRepairReceiptRefs: plan.priorRepairReceiptRefs,
    criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    currentAttemptHash: plan.currentAttemptHash,
    currentEvidenceHash: plan.currentEvidenceHash,
    auditArtifactPath: toRootRelativePath(
      input.projectRoot,
      normalizeText(profile.runAuditorHostArgs.artifactPath)
    ),
    executionMode: {
      providerMode: 'codex_exec_readonly',
      toolName: 'codex exec',
      producerCount: 1,
      implementationWritesAllowed: false,
    },
    perspectiveAssignments: plan.subagents.map((subagent) => ({
      perspectiveId: subagent.perspectiveId,
      requiredCheckItemIds: subagent.requiredCheckItemIds,
      currentHashBinding: subagent.currentHashBinding,
    })),
    responsePath: toRootRelativePath(input.projectRoot, responsePath),
    requiredResponseSchema: {
      schemaVersion: 'audit-readonly-auditor-response/v1',
      requiredFields: [
        'auditEpochId',
        'auditTargetBundleHash',
        'roundIndex',
        'perspectiveResults',
        'coveredCheckItemIds',
        'vetoItemResults',
        'validatedGapRefs',
        'invalidGapRefs',
        'checkedProjectionQualityRuleCodes',
        'rationale',
      ],
    },
  };
  const request = {
    ...requestWithoutHash,
    requestHash: sha256Json(requestWithoutHash),
  };
  const existing = readJsonIfExists(requestPath);
  if (existing) {
    const existingWithoutHash = { ...existing };
    delete existingWithoutHash.requestHash;
    if (sha256Json(existingWithoutHash) !== request.requestHash) {
      throw new Error('audit_controlled_executor_request_changed');
    }
  } else {
    writeJsonUtf8(requestPath, request);
  }
  const committedResponseAvailable = hasCommittedAuditReadonlyAuditorInvocation({
    projectRoot: input.projectRoot,
    plan,
    requestPath,
    responsePath,
    roundIndex,
  });
  return {
    status: committedResponseAvailable ? 'response_available' : 'awaiting_response',
    requestPath,
    responsePath,
    roundIndex,
  };
}

function readAuditReadonlyAuditorResponse(input: {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  requestPath: string;
  responsePath: string;
  roundIndex: number;
  requireHostReceipt?: boolean;
}): {
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  responseHash: string;
} {
  const request = readJsonIfExists(input.requestPath);
  const response = readJsonIfExists(input.responsePath);
  if (!request || !response) {
    throw new Error('audit_readonly_auditor_response_missing');
  }
  if (normalizeText(response.schemaVersion) !== 'audit-readonly-auditor-response/v1') {
    throw new Error('audit_readonly_auditor_response_schema_invalid');
  }
  if (
    normalizeText(response.requestHash) !== normalizeText(request.requestHash) ||
    normalizeText(response.auditEpochId) !== input.plan.auditEpochId ||
    normalizeText(response.auditTargetBundleHash) !== input.plan.auditTargetBundleHash ||
    Number(response.roundIndex) !== input.roundIndex
  ) {
    throw new Error('audit_readonly_auditor_response_binding_mismatch');
  }
  if (
    Object.hasOwn(response, 'independentProviderEvidence') ||
    Object.hasOwn(response, 'providerRun') ||
    Object.hasOwn(response, 'judgeDecision')
  ) {
    throw new Error('audit_readonly_auditor_self_authored_judge_evidence_forbidden');
  }
  if (auditProviderContainsCredentialMaterial(response)) {
    throw new Error('audit_readonly_auditor_credential_material_forbidden');
  }
  const responseHash = normalizeText(response.responseHash);
  const responseWithoutHash = { ...response };
  delete responseWithoutHash.responseHash;
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(responseHash) ||
    sha256Json(responseWithoutHash) !== responseHash
  ) {
    throw new Error('audit_readonly_auditor_response_hash_mismatch');
  }
  const perspectiveResults = recordObject(response.perspectiveResults);
  const producerInvocationId = normalizeText(response.producerInvocationId);
  if (!producerInvocationId) {
    throw new Error('audit_readonly_auditor_producer_invocation_id_missing');
  }
  const requiredPerspectives = [
    'product_intent',
    'model_projection',
    'main_agent_execution',
  ] as const;
  const agentIds: string[] = [];
  for (const perspective of requiredPerspectives) {
    const result = recordObject(perspectiveResults[perspective]);
    const agentId = normalizeText(result.agentId);
    if (!agentId) {
      throw new Error(`audit_readonly_auditor_perspective_missing:${perspective}`);
    }
    if (agentId !== producerInvocationId) {
      throw new Error(`audit_readonly_auditor_perspective_producer_mismatch:${perspective}`);
    }
    agentIds.push(agentId);
  }
  if (new Set(agentIds).size !== 1) {
    throw new Error('audit_readonly_auditor_multiple_producers_forbidden');
  }
  const coveredCheckItemIds = new Set(stringsFrom(response.coveredCheckItemIds));
  for (const itemId of input.plan.subagents[0]?.requiredCheckItemIds ?? []) {
    if (!coveredCheckItemIds.has(itemId)) {
      throw new Error(`audit_readonly_auditor_check_item_missing:${itemId}`);
    }
  }
  const checkedQualityRules = new Set(stringsFrom(response.checkedProjectionQualityRuleCodes));
  for (const ruleCode of input.plan.checkedProjectionQualityRuleCodes) {
    if (!checkedQualityRules.has(ruleCode)) {
      throw new Error(`audit_readonly_auditor_quality_rule_missing:${ruleCode}`);
    }
  }
  const vetoItemResults = asRecordArray(response.vetoItemResults);
  const seenVetoItemIds = new Set<string>();
  for (const result of vetoItemResults) {
    const itemId = normalizeText(result.itemId);
    if (!itemId) {
      throw new Error('audit_readonly_auditor_veto_item_id_missing');
    }
    if (seenVetoItemIds.has(itemId)) {
      throw new Error(`audit_readonly_auditor_veto_item_duplicate:${itemId}`);
    }
    seenVetoItemIds.add(itemId);
    if (!input.plan.vetoItemIds.includes(itemId)) {
      throw new Error(`audit_readonly_auditor_veto_item_unknown:${itemId}`);
    }
  }
  for (const itemId of input.plan.vetoItemIds) {
    if (!seenVetoItemIds.has(itemId)) {
      throw new Error(`audit_readonly_auditor_veto_item_missing:${itemId}`);
    }
  }
  if (!normalizeText(response.rationale)) {
    throw new Error('audit_readonly_auditor_rationale_missing');
  }
  const validatedGapRefs = stringsFrom(response.validatedGapRefs);
  const requiredFixes = stringsFrom(response.requiredFixes);
  const auditStatus = normalizeText(response.auditStatus);
  const expectedAuditStatus =
    validatedGapRefs.length === 0 && vetoItemResults.every((item) => item.passed === true)
      ? 'PASS'
      : 'FAIL';
  if (
    auditStatus !== expectedAuditStatus ||
    (auditStatus === 'PASS' && requiredFixes.length > 0) ||
    (auditStatus === 'FAIL' && requiredFixes.length === 0)
  ) {
    throw new Error('audit_readonly_auditor_report_status_inconsistent');
  }
  if (input.requireHostReceipt !== false) {
    const hostReceiptPath = path.join(
      path.dirname(input.responsePath),
      'readonly-auditor-host-invocation-receipt.json'
    );
    const hostReceipt = readJsonIfExists(hostReceiptPath);
    if (!hostReceipt) {
      throw new Error('audit_readonly_auditor_host_receipt_missing');
    }
    const hostReceiptWithoutHash = { ...hostReceipt };
    delete hostReceiptWithoutHash.receiptHash;
    if (
      normalizeText(hostReceipt.schemaVersion) !==
        'audit-readonly-auditor-host-invocation-receipt/v1' ||
      normalizeText(hostReceipt.auditEpochId) !== input.plan.auditEpochId ||
      normalizeText(hostReceipt.auditTargetBundleHash) !== input.plan.auditTargetBundleHash ||
      Number(hostReceipt.roundIndex) !== input.roundIndex ||
      normalizeText(hostReceipt.requestHash) !== normalizeText(request.requestHash) ||
      normalizeText(hostReceipt.responseHash) !== responseHash ||
      normalizeText(hostReceipt.producerInvocationId) !== producerInvocationId ||
      hostReceipt.responseProduced !== true ||
      Number(hostReceipt.exitCode) !== 0 ||
      normalizeText(hostReceipt.receiptHash) !== sha256Json(hostReceiptWithoutHash)
    ) {
      throw new Error('audit_readonly_auditor_host_receipt_invalid');
    }
    const auditReportPath = resolveRootRelativePath(
      input.projectRoot,
      normalizeText(hostReceipt.auditReportPath)
    );
    if (
      !normalizeText(hostReceipt.auditReportPath) ||
      !fs.existsSync(auditReportPath) ||
      normalizeText(hostReceipt.auditReportHash) !== sha256File(auditReportPath)
    ) {
      throw new Error('audit_readonly_auditor_report_receipt_invalid');
    }
    if (
      !hasCommittedAuditReadonlyAuditorInvocation({
        projectRoot: input.projectRoot,
        plan: input.plan,
        requestPath: input.requestPath,
        responsePath: input.responsePath,
        roundIndex: input.roundIndex,
      })
    ) {
      throw new Error('audit_readonly_auditor_invocation_state_invalid');
    }
  }
  return { request, response, responseHash };
}

const AUDIT_REVIEW_STRUCTURED_DRIFT_SIGNAL_IDS = [
  'smoke_task_chain',
  'closure_task_id',
  'journey_unlock',
  'gap_split_contract',
  'shared_path_reference',
] as const;

interface AuditReviewScoringContract {
  schemaVersion: 'audit-review-scoring-contract/v1';
  auditStage: string;
  scoreStage: string;
  dimensionContractId: string;
  dimensionMode: string;
  expectedDimensions: string[];
  minimumPhaseScore: number;
  scoringPolicyPath: string;
  scoringPolicyHash: string;
  vetoForbidden: true;
  approvedEffectiveVerdictRequired: true;
  structuredDriftSignalIds: string[];
}

function resolveAuditReviewScoringContract(input: {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
}): AuditReviewScoringContract {
  if (!isReviewerAuditEntryStage(input.plan.stage)) {
    throw new Error(`audit_review_scoring_stage_unsupported:${input.plan.stage}`);
  }
  const scoreStage = getReviewerConsumerByAuditStage(input.plan.stage).scoreStage;
  const dimensionContract = resolveScoringDimensionContract({ stage: scoreStage });
  if (
    dimensionContract.status !== 'resolved' ||
    !dimensionContract.dimensionContractId ||
    !dimensionContract.dimensionMode ||
    dimensionContract.expectedDimensions.length === 0
  ) {
    throw new Error(
      `audit_review_scoring_dimension_contract_invalid:${dimensionContract.blockingReasons.join(',')}`
    );
  }
  const scoringPolicyPath = path.join(
    input.projectRoot,
    '_bmad',
    '_config',
    'scoring-policy.contract.yaml'
  );
  if (!fs.existsSync(scoringPolicyPath)) {
    throw new Error('audit_review_scoring_policy_missing');
  }
  const policy = yaml.load(fs.readFileSync(scoringPolicyPath, 'utf8')) as Record<
    string,
    unknown
  > | null;
  const passThresholds = recordObject(policy?.passThresholds);
  const byStage = recordObject(passThresholds.byStage);
  const minimumPhaseScore = Number(
    byStage[scoreStage] ?? byStage.audit_closeout ?? passThresholds.default
  );
  if (
    normalizeText(policy?.schemaVersion) !== 'scoring-policy.contract/v1' ||
    !Number.isFinite(minimumPhaseScore) ||
    minimumPhaseScore < 0 ||
    minimumPhaseScore > 100
  ) {
    throw new Error('audit_review_scoring_policy_invalid');
  }
  return {
    schemaVersion: 'audit-review-scoring-contract/v1',
    auditStage: input.plan.stage,
    scoreStage,
    dimensionContractId: dimensionContract.dimensionContractId,
    dimensionMode: dimensionContract.dimensionMode,
    expectedDimensions: [...dimensionContract.expectedDimensions],
    minimumPhaseScore,
    scoringPolicyPath: toRootRelativePath(input.projectRoot, scoringPolicyPath),
    scoringPolicyHash: sha256File(scoringPolicyPath),
    vetoForbidden: true,
    approvedEffectiveVerdictRequired: true,
    structuredDriftSignalIds: [...AUDIT_REVIEW_STRUCTURED_DRIFT_SIGNAL_IDS],
  };
}

function expectedAuditReviewGrade(phaseScore: number): 'A' | 'B' | 'C' | 'D' {
  if (phaseScore >= 90) return 'A';
  if (phaseScore >= 80) return 'B';
  if (phaseScore >= 60) return 'C';
  return 'D';
}

function validateAuditReviewScoringAssessment(input: {
  assessment: AuditReviewScoringAssessment | undefined;
  contract: AuditReviewScoringContract;
  approvalRequired: boolean;
}): AuditReviewScoringAssessment {
  const assessment = input.assessment;
  if (!assessment || typeof assessment !== 'object') {
    throw new Error('audit_judge_audit_review_scoring_missing');
  }
  if (
    assessment.dimensionContractId !== input.contract.dimensionContractId ||
    assessment.dimensionMode !== input.contract.dimensionMode ||
    stableStringify(assessment.expectedDimensions) !==
      stableStringify(input.contract.expectedDimensions)
  ) {
    throw new Error('audit_judge_audit_review_scoring_contract_mismatch');
  }
  if (
    !Number.isFinite(assessment.phaseScore) ||
    assessment.phaseScore < 0 ||
    assessment.phaseScore > 100 ||
    assessment.overallGrade !== expectedAuditReviewGrade(assessment.phaseScore)
  ) {
    throw new Error('audit_judge_audit_review_scoring_threshold_mismatch');
  }
  if (
    input.approvalRequired &&
    (assessment.phaseScore < input.contract.minimumPhaseScore ||
      assessment.vetoTriggered ||
      assessment.effectiveVerdict !== 'approved')
  ) {
    throw new Error('audit_judge_audit_review_scoring_not_approved');
  }
  const scoreByDimension = new Map<string, number>();
  for (const row of assessment.dimensionScores ?? []) {
    const dimension = normalizeText(row.dimension);
    if (
      !dimension ||
      scoreByDimension.has(dimension) ||
      !Number.isFinite(row.score) ||
      row.score < 0 ||
      row.score > 100 ||
      !normalizeText(row.rationale)
    ) {
      throw new Error('audit_judge_audit_review_dimension_score_invalid');
    }
    scoreByDimension.set(dimension, row.score);
  }
  if (
    scoreByDimension.size !== input.contract.expectedDimensions.length ||
    input.contract.expectedDimensions.some((dimension) => !scoreByDimension.has(dimension))
  ) {
    throw new Error('audit_judge_audit_review_dimension_score_incomplete');
  }
  const driftSignals = new Map<string, boolean>();
  for (const signal of assessment.structuredDriftSignals ?? []) {
    const signalId = normalizeText(signal.signal);
    if (
      !signalId ||
      driftSignals.has(signalId) ||
      !input.contract.structuredDriftSignalIds.includes(signalId) ||
      typeof signal.triggered !== 'boolean' ||
      !normalizeText(signal.evidence)
    ) {
      throw new Error('audit_judge_audit_review_drift_signal_invalid');
    }
    driftSignals.set(signalId, signal.triggered);
  }
  if (
    driftSignals.size !== input.contract.structuredDriftSignalIds.length ||
    input.contract.structuredDriftSignalIds.some((signalId) => !driftSignals.has(signalId)) ||
    (input.approvalRequired && [...driftSignals.values()].some(Boolean))
  ) {
    throw new Error('audit_judge_audit_review_drift_signal_blocked');
  }
  if (
    !Array.isArray(assessment.evidenceRefs) ||
    assessment.evidenceRefs.length === 0 ||
    assessment.evidenceRefs.some((ref) => !normalizeText(ref)) ||
    !normalizeText(assessment.rationale)
  ) {
    throw new Error('audit_judge_audit_review_evidence_missing');
  }
  return assessment;
}

function writeAuditJudgeAuthoritativeReport(input: {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  roundIndex: number;
  roundDir: string;
  readonlyAuditorRequest: Record<string, unknown>;
  scoring: AuditReviewScoringAssessment;
}): string {
  const reportPath = path.join(input.roundDir, 'judge-authoritative-audit-report.md');
  const requiredFixes: string[] = [];
  const reportLines = [
    'status: PASS',
    `stage: ${input.plan.stage}`,
    `reportPath: ${toRootRelativePath(input.projectRoot, reportPath)}`,
    `artifactDocPath: ${normalizeText(input.readonlyAuditorRequest.auditArtifactPath)}`,
    `iteration_count: ${input.roundIndex}`,
    `required_fixes_count: ${requiredFixes.length}`,
    'score_trigger_present: true',
    'converged: true',
    `Overall Grade: ${input.scoring.overallGrade}`,
    '',
    '## Dimension Scores',
    ...input.scoring.dimensionScores.map((row) => `- ${row.dimension}: ${row.score}/100`),
    '',
    '## Structured Drift Signal Block',
    '| Signal | Status | Evidence |',
    '| --- | --- | --- |',
    ...input.scoring.structuredDriftSignals.map(
      (signal) =>
        `| ${signal.signal} | ${signal.triggered ? 'triggered' : 'pass'} | ${signal.evidence.replace(/\|/gu, '\\|')} |`
    ),
    '',
    '## Required Fixes',
    '- None',
    '',
    '## Judge Rationale',
    input.scoring.rationale,
    '',
    '## Judge Evidence Refs',
    ...input.scoring.evidenceRefs.map((ref) => `- ${ref}`),
    '',
  ];
  const content = reportLines.join('\n');
  if (fs.existsSync(reportPath)) {
    if (fs.readFileSync(reportPath, 'utf8') !== content) {
      throw new Error('audit_judge_authoritative_report_changed');
    }
  } else {
    fs.writeFileSync(reportPath, content, 'utf8');
  }
  return reportPath;
}

function validateAuditHostScoreRecordAgainstJudge(input: {
  scoreRecord: Record<string, unknown>;
  contract: AuditReviewScoringContract;
  scoring: AuditReviewScoringAssessment;
}): void {
  if (
    normalizeText(input.scoreRecord.dimension_contract_id) !== input.contract.dimensionContractId ||
    normalizeText(input.scoreRecord.dimension_mode) !== input.contract.dimensionMode ||
    stableStringify(input.scoreRecord.expected_dimensions) !==
      stableStringify(input.contract.expectedDimensions) ||
    Number(input.scoreRecord.phase_score) !== input.scoring.phaseScore ||
    input.scoreRecord.veto_triggered !== input.scoring.vetoTriggered ||
    (['implement', 'post_impl'].includes(input.contract.scoreStage) &&
      normalizeText(input.scoreRecord.effective_verdict) !== input.scoring.effectiveVerdict)
  ) {
    throw new Error('audit_run_auditor_host_score_judge_binding_mismatch');
  }
  const scoreRows = asRecordArray(input.scoreRecord.dimension_scores);
  const scoreByDimension = new Map(
    scoreRows.map((row) => [normalizeText(row.dimension), Number(row.score)])
  );
  if (
    scoreByDimension.size !== input.scoring.dimensionScores.length ||
    input.scoring.dimensionScores.some((row) => scoreByDimension.get(row.dimension) !== row.score)
  ) {
    throw new Error('audit_run_auditor_host_dimension_score_judge_binding_mismatch');
  }
}

function writeAuditJudgeRequest(input: {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  roundIndex: number;
  roundDir: string;
  readonlyAuditorRequest: Record<string, unknown>;
  readonlyAuditorResponse: Record<string, unknown>;
  readonlyAuditorResponseHash: string;
}): { request: Record<string, unknown>; path: string } {
  const auditReviewScoringContract = resolveAuditReviewScoringContract({
    projectRoot: input.projectRoot,
    plan: input.plan,
  });
  const authorityBinding = resolveAuditJudgeRequestAuthorityBinding({
    projectRoot: input.projectRoot,
    modelPacketPath: normalizeText(input.readonlyAuditorRequest.auditArtifactPath),
    modelPacketHash: normalizeText(input.plan.modelPacketHash),
    sourceDocumentHash: input.plan.sourceDocumentHash,
    projectionSetHash: input.plan.projectionSetHash,
  });
  const readonlyValidatedGapRefs = stringsFrom(input.readonlyAuditorResponse.validatedGapRefs);
  const readonlyFailedVetoRefs = asRecordArray(input.readonlyAuditorResponse.vetoItemResults)
    .filter((item) => item.passed !== true)
    .map((item) => normalizeText(item.itemId))
    .filter(Boolean);
  const readonlyBlockingRefs = uniqueNonEmpty([
    ...readonlyValidatedGapRefs,
    ...readonlyFailedVetoRefs,
  ]);
  const gateDryRunHash = sha256Json({
    auditEpochId: input.plan.auditEpochId,
    auditTargetBundleHash: input.plan.auditTargetBundleHash,
    readonlyAuditorResponseHash: input.readonlyAuditorResponseHash,
  });
  const requestWithoutHash = {
    schemaVersion: 'audit-triad-judge-request/v1',
    roundIndex: input.roundIndex,
    transactionId: input.plan.auditEpochId,
    namespaceVersion: `audit-review/${input.plan.attemptId}`,
    auditAttemptId: input.plan.attemptId,
    sourceHash: input.plan.sourceDocumentHash,
    sourceDocument: authorityBinding.sourceDocument,
    sourceDocumentHash: input.plan.sourceDocumentHash,
    sourceBytesHash: authorityBinding.sourceBytesHash,
    semanticModelHash: input.plan.semanticModelHash,
    implementationConfirmationHash: input.plan.implementationConfirmationHash,
    packetHash: input.plan.modelPacketHash ?? input.plan.auditTargetBundleHash,
    projectionSetHash: input.plan.projectionSetHash,
    independentProviderBinding: input.plan.independentProviderBinding,
    independentProviderBindingIssueCodes: [],
    auditEpochId: input.plan.auditEpochId,
    auditTargetBundleHash: input.plan.auditTargetBundleHash,
    qualityRuleSetHash: input.plan.qualityRuleSetHash,
    projectionQualityGate: {
      requiredRuleCodes: input.plan.checkedProjectionQualityRuleCodes,
    },
    packetProjectionSummary: authorityBinding.packetProjectionSummary,
    mustRefs: authorityBinding.mustRefs,
    sourceRequirementTexts: authorityBinding.sourceRequirementTexts,
    readonlyAuditorRequestHash: normalizeText(input.readonlyAuditorRequest.requestHash),
    readonlyAuditorResponseHash: input.readonlyAuditorResponseHash,
    readonlyAuditorResponse: input.readonlyAuditorResponse,
    auditReviewScoringContract,
    gateDryRun: {
      gateDryRunHash,
      verdict: readonlyBlockingRefs.length === 0 ? 'pass' : 'blocked',
      failedChecks: readonlyBlockingRefs,
      reconciliation: {
        issueCount: readonlyBlockingRefs.length,
      },
    },
  };
  const request = {
    ...requestWithoutHash,
    requestHash: sha256Json({ ...requestWithoutHash, requestHash: null }),
  };
  const requestPath = path.join(input.roundDir, 'judge-request.json');
  const existing = readJsonIfExists(requestPath);
  if (existing) {
    if (sha256Json(existing) !== sha256Json(request)) {
      throw new Error('audit_judge_request_changed');
    }
  } else {
    writeJsonUtf8(requestPath, request);
  }
  return { request, path: requestPath };
}

function executeAuditJudge(input: {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  roundIndex: number;
  roundDir: string;
  readonlyAuditorRequest: Record<string, unknown>;
  readonlyAuditorResponse: Record<string, unknown>;
  judgeRequest: Record<string, unknown>;
  judgeRequestPath: string;
}): AuditTriadJudgeInvocationResult {
  const expected: AuditProviderExpectation = {
    ...input.plan.independentProviderBinding,
    transactionId: input.plan.auditEpochId,
    auditAttemptId: input.plan.attemptId,
    requestHash: normalizeText(input.judgeRequest.requestHash),
    sourceDocumentHash: input.plan.sourceDocumentHash,
    semanticModelHash: input.plan.semanticModelHash,
    projectionSetHash: input.plan.projectionSetHash,
  };
  const result = executeAuditProviderJudgeAdapter({
    projectRoot: input.projectRoot,
    requestPath: input.judgeRequestPath,
    outputDir: path.join(input.roundDir, 'audit-provider-judge-invocation'),
    roundIndex: input.roundIndex,
    expected,
  });
  const resultRecord = result as unknown as Record<string, unknown>;
  for (const [field, expectedValue] of [
    ['requestHash', input.judgeRequest.requestHash],
    ['sourceDocumentHash', input.plan.sourceDocumentHash],
    ['sourceBytesHash', input.judgeRequest.sourceBytesHash],
    ['semanticModelHash', input.plan.semanticModelHash],
    ['implementationConfirmationHash', input.plan.implementationConfirmationHash],
    ['packetHash', input.plan.modelPacketHash ?? input.plan.auditTargetBundleHash],
    ['projectionSetHash', input.plan.projectionSetHash],
  ] as const) {
    if (normalizeText(resultRecord[field]) !== normalizeText(expectedValue)) {
      throw new Error(`audit_judge_response_${field}_mismatch`);
    }
  }
  const checkedRules = new Set(result.checkedProjectionQualityRuleCodes ?? []);
  for (const ruleCode of input.plan.checkedProjectionQualityRuleCodes) {
    if (!checkedRules.has(ruleCode)) {
      throw new Error(`audit_judge_response_quality_rule_missing:${ruleCode}`);
    }
  }
  if (
    normalizeText(input.readonlyAuditorResponse.auditStatus) === 'FAIL' &&
    isAuditTriadNoNewGapVerdict(result.verdict)
  ) {
    throw new Error('audit_judge_no_gap_conflicts_with_readonly_auditor_failure');
  }
  return result;
}

function judgeGapRefs(values: Array<Record<string, unknown>> | undefined): string[] {
  return (values ?? [])
    .map((value) => normalizeText(value.gapId ?? value.id ?? value.ref))
    .filter(Boolean);
}

function resolveRunAuditorHostCliCommand(): string[] {
  const javascriptEntry = path.resolve(__dirname, 'run-auditor-host.js');
  if (fs.existsSync(javascriptEntry)) {
    return [process.execPath, javascriptEntry];
  }
  const typescriptEntry = path.resolve(__dirname, 'run-auditor-host.ts');
  if (!fs.existsSync(typescriptEntry)) {
    throw new Error('audit_run_auditor_host_entry_missing');
  }
  return [process.execPath, '--import', 'tsx', typescriptEntry];
}

function validateAuditBoundReceiptRef(input: {
  projectRoot: string;
  value: unknown;
  expectedSchemaVersion: string;
  errorCode: string;
}): { path: string; contentHash: string; receiptHash: string } {
  const ref = recordObject(input.value);
  const receiptPathValue = normalizeText(ref.path);
  const receiptPath = resolveRootRelativePath(input.projectRoot, receiptPathValue);
  const receipt = readJsonIfExists(receiptPath);
  if (!receipt) throw new Error(`${input.errorCode}_missing`);
  const receiptWithoutHash = { ...receipt };
  delete receiptWithoutHash.receiptHash;
  if (
    normalizeText(receipt.schemaVersion) !== input.expectedSchemaVersion ||
    normalizeText(ref.contentHash) !== sha256File(receiptPath) ||
    normalizeText(ref.receiptHash) !== normalizeText(receipt.receiptHash) ||
    normalizeText(receipt.receiptHash) !== sha256Json(receiptWithoutHash)
  ) {
    throw new Error(`${input.errorCode}_invalid`);
  }
  return {
    path: toRootRelativePath(input.projectRoot, receiptPath),
    contentHash: sha256File(receiptPath),
    receiptHash: normalizeText(receipt.receiptHash),
  };
}

function executeAuditRunAuditorHost(input: {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  roundIndex: number;
  roundDir: string;
  readonlyAuditorRequest: Record<string, unknown>;
  readonlyAuditorResponse: Record<string, unknown>;
  readonlyAuditorResponseHash: string;
  readonlyAuditorHostInvocationReceiptRef: {
    path: string;
    contentHash: string;
    receiptHash: string;
  };
  judgeRequestHash: string;
  judgeExecutionReceiptRef: { path: string; contentHash: string; receiptHash: string };
  judgeProviderInvocationReceiptRef: {
    path: string;
    contentHash: string;
    receiptHash: string;
  };
  judgeAuthoritativeReportPath: string;
  judgeAuditReviewScoringContractHash: string;
  auditReviewScoring: AuditReviewScoringAssessment;
}): {
  scoreWriterInvocationReceiptRef: {
    path: string;
    contentHash: string;
    receiptHash: string;
  };
  scoreReceiptRef: { path: string; contentHash: string; receiptHash: string };
  runAuditorHostReceiptRef: { path: string; contentHash: string; receiptHash: string };
  scoreRecord: Record<string, unknown>;
} {
  const reportPath = input.judgeAuthoritativeReportPath;
  if (!fs.existsSync(reportPath)) {
    throw new Error('audit_judge_authoritative_report_missing');
  }
  const artifactPath = resolveRootRelativePath(
    input.projectRoot,
    normalizeText(input.readonlyAuditorRequest.auditArtifactPath)
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error('audit_run_auditor_host_artifact_missing');
  }
  if (
    normalizeText(input.readonlyAuditorResponse.responseHash) !== input.readonlyAuditorResponseHash
  ) {
    throw new Error('audit_run_auditor_host_readonly_response_hash_mismatch');
  }
  const bindingPath = path.join(input.roundDir, 'run-auditor-host-binding.json');
  const resultPath = path.join(input.roundDir, 'run-auditor-host-result.json');
  const stdoutPath = path.join(input.roundDir, 'run-auditor-host.stdout.log');
  const stderrPath = path.join(input.roundDir, 'run-auditor-host.stderr.log');
  const bindingBase = {
    roundId: `round-${input.roundIndex}`,
    auditEpochId: input.plan.auditEpochId,
    auditTargetBundleHash: input.plan.auditTargetBundleHash,
    sourceDocumentHash: input.plan.sourceDocumentHash,
    semanticModelHash: input.plan.semanticModelHash,
    implementationConfirmationHash: input.plan.implementationConfirmationHash,
    projectionSetHash: input.plan.projectionSetHash,
    qualityRuleSetHash: input.plan.qualityRuleSetHash,
    criticalAuditorProfileHash: input.plan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: input.plan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: input.plan.requiredCheckItemSetHash,
    currentAttemptHash: input.plan.currentAttemptHash,
    currentEvidenceHash: input.plan.currentEvidenceHash,
    readonlyAuditorRequestHash: normalizeText(input.readonlyAuditorRequest.requestHash),
    readonlyAuditorResponseHash: input.readonlyAuditorResponseHash,
    readonlyAuditorHostInvocationReceiptRef: input.readonlyAuditorHostInvocationReceiptRef,
    judgeRequestHash: input.judgeRequestHash,
    judgeExecutionReceiptRef: input.judgeExecutionReceiptRef,
    judgeProviderInvocationReceiptRef: input.judgeProviderInvocationReceiptRef,
    judgeAuthoritativeReportHash: sha256File(reportPath),
    judgeAuditReviewScoringContractHash: input.judgeAuditReviewScoringContractHash,
    judgeAuditReviewScoringHash: sha256Json(input.auditReviewScoring),
  };
  const existingBinding = readJsonIfExists(bindingPath);
  const runAuditorHostInvocationId = normalizeText(existingBinding?.runAuditorHostInvocationId);
  const binding = existingBinding
    ? (() => {
        const existingBindingBase = { ...existingBinding };
        delete existingBindingBase.runAuditorHostInvocationId;
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
            runAuditorHostInvocationId
          ) ||
          sha256Json(existingBindingBase) !== sha256Json(bindingBase)
        ) {
          throw new Error('audit_run_auditor_host_binding_changed');
        }
        return existingBinding;
      })()
    : {
        ...bindingBase,
        runAuditorHostInvocationId: crypto.randomUUID(),
      };
  if (!existingBinding) {
    writeJsonUtf8(bindingPath, binding);
  }
  const [command, ...prefixArgs] = resolveRunAuditorHostCliCommand();
  const commandArgs = [
    ...prefixArgs,
    '--projectRoot',
    input.projectRoot,
    '--stage',
    input.plan.stage,
    '--artifactPath',
    artifactPath,
    '--reportPath',
    reportPath,
    '--iterationCount',
    String(input.roundIndex),
    '--controlledAuditBindingFile',
    bindingPath,
    '--resultPath',
    resultPath,
  ];
  const execution = spawnSync(command, commandArgs, {
    cwd: input.projectRoot,
    encoding: 'utf8',
    shell: false,
    timeout: 300_000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  const stdout = execution.stdout ?? '';
  const stderr = execution.stderr ?? '';
  fs.writeFileSync(stdoutPath, stdout, 'utf8');
  fs.writeFileSync(stderrPath, stderr, 'utf8');
  const exitCode =
    typeof execution.status === 'number' ? execution.status : execution.error ? -1 : 0;
  if (execution.error || exitCode !== 0 || !fs.existsSync(resultPath)) {
    throw new Error(
      `audit_run_auditor_host_failed:${exitCode}:${execution.error?.message || stderr || stdout}`
    );
  }
  const result = readJsonIfExists(resultPath);
  if (!result || normalizeText(result.status) !== 'PASS') {
    throw new Error('audit_run_auditor_host_result_status_mismatch');
  }
  const scoreRecord = recordObject(result.scoreRecord);
  if (Object.keys(scoreRecord).length === 0) {
    throw new Error('audit_run_auditor_host_score_record_missing');
  }
  return {
    scoreWriterInvocationReceiptRef: validateAuditBoundReceiptRef({
      projectRoot: input.projectRoot,
      value: result.scoreWriterInvocationReceiptRef,
      expectedSchemaVersion: 'run-auditor-host-score-writer-invocation-receipt/v1',
      errorCode: 'audit_run_auditor_host_score_writer_invocation_receipt',
    }),
    scoreReceiptRef: validateAuditBoundReceiptRef({
      projectRoot: input.projectRoot,
      value: result.scoreReceiptRef,
      expectedSchemaVersion: 'run-auditor-host-score-receipt/v1',
      errorCode: 'audit_run_auditor_host_score_receipt',
    }),
    runAuditorHostReceiptRef: validateAuditBoundReceiptRef({
      projectRoot: input.projectRoot,
      value: result.runAuditorHostReceiptRef,
      expectedSchemaVersion: 'run-auditor-host-closeout-receipt/v1',
      errorCode: 'audit_run_auditor_host_closeout_receipt',
    }),
    scoreRecord,
  };
}

function materializeAuditControlledRound(input: {
  projectRoot: string;
  planPath: string;
  state: AuditOpenReadonlyAuditorRoundState;
}): AuditControlledRoundResult {
  const plan = JSON.parse(fs.readFileSync(input.planPath, 'utf8')) as AuditTriadExecutionPlan;
  const readonly = readAuditReadonlyAuditorResponse({
    projectRoot: input.projectRoot,
    plan,
    requestPath: input.state.requestPath,
    responsePath: input.state.responsePath,
    roundIndex: input.state.roundIndex,
  });
  const roundDir = auditRoundDir(input.planPath, input.state.roundIndex);
  const judgeRequest = writeAuditJudgeRequest({
    projectRoot: input.projectRoot,
    plan,
    roundIndex: input.state.roundIndex,
    roundDir,
    readonlyAuditorRequest: readonly.request,
    readonlyAuditorResponse: readonly.response,
    readonlyAuditorResponseHash: readonly.responseHash,
  });
  const judgeResult = executeAuditJudge({
    projectRoot: input.projectRoot,
    plan,
    roundIndex: input.state.roundIndex,
    roundDir,
    readonlyAuditorRequest: readonly.request,
    readonlyAuditorResponse: readonly.response,
    judgeRequest: judgeRequest.request,
    judgeRequestPath: judgeRequest.path,
  });
  const providerRunId = normalizeText(judgeResult.independentProviderEvidence?.providerRunId);
  if (!providerRunId) {
    throw new Error('audit_judge_provider_run_id_missing');
  }
  validateAuditProviderInvocationReceipt({
    projectRoot: input.projectRoot,
    receiptRef: judgeResult.providerInvocationReceiptRef,
    requestHash: normalizeText(judgeRequest.request.requestHash),
    sourceDocumentHash: plan.sourceDocumentHash,
    sourceBytesHash: normalizeText(judgeRequest.request.sourceBytesHash),
    semanticModelHash: plan.semanticModelHash,
    projectionSetHash: plan.projectionSetHash,
    providerRunId,
    expectedProviderBinding: plan.independentProviderBinding,
  });
  validateAuditProviderJudgeHostExecution(
    input.projectRoot,
    judgeResult.judgeAdapterHostExecution
  );
  const convergentVerdict = isAuditTriadNoNewGapVerdict(judgeResult.verdict);
  const auditReviewScoringContract = recordObject(
    judgeRequest.request.auditReviewScoringContract
  ) as unknown as AuditReviewScoringContract;
  const auditReviewScoring = validateAuditReviewScoringAssessment({
    assessment: judgeResult.auditReviewScoring,
    contract: auditReviewScoringContract,
    approvalRequired: convergentVerdict,
  });
  const validatedGapRefs = convergentVerdict ? [] : judgeGapRefs(judgeResult.validatedGaps);
  const judgeProviderInvocationReceiptRef = validateAuditBoundReceiptRef({
    projectRoot: input.projectRoot,
    value: judgeResult.providerInvocationReceiptRef,
    expectedSchemaVersion: 'audit-provider-judge-invocation-receipt/v1',
    errorCode: 'audit_judge_provider_invocation_receipt',
  });
  const judgeReceiptWithoutHash = {
    schemaVersion: 'audit-judge-execution-receipt/v1',
    recordId: plan.recordId,
    attemptId: plan.attemptId,
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    roundIndex: input.state.roundIndex,
    judgeRequestHash: normalizeText(judgeRequest.request.requestHash),
    readonlyAuditorResponseHash: readonly.responseHash,
    verdict: judgeResult.verdict,
    validatedGapRefs,
    sourceDocumentHash: plan.sourceDocumentHash,
    sourceBytesHash: normalizeText(judgeRequest.request.sourceBytesHash),
    semanticModelHash: plan.semanticModelHash,
    implementationConfirmationHash: plan.implementationConfirmationHash,
    projectionSetHash: plan.projectionSetHash,
    qualityRuleSetHash: plan.qualityRuleSetHash,
    currentAttemptHash: plan.currentAttemptHash,
    currentEvidenceHash: plan.currentEvidenceHash,
    auditReviewScoringContractHash: sha256Json(auditReviewScoringContract),
    auditReviewScoring,
    independentProviderEvidence: judgeResult.independentProviderEvidence,
    providerInvocationReceiptRef: judgeProviderInvocationReceiptRef,
    judgeAdapterHostExecution: judgeResult.judgeAdapterHostExecution,
  };
  const judgeReceipt = {
    ...judgeReceiptWithoutHash,
    receiptHash: sha256Json(judgeReceiptWithoutHash),
  };
  const judgeReceiptPath = path.join(roundDir, 'judge-execution-receipt.json');
  writeJsonUtf8(judgeReceiptPath, judgeReceipt);
  const readonlyHostReceiptPath = path.join(
    roundDir,
    'readonly-auditor-host-invocation-receipt.json'
  );
  const readonlyHostReceipt = readJsonIfExists(readonlyHostReceiptPath);
  if (!readonlyHostReceipt) {
    throw new Error('audit_readonly_auditor_host_receipt_missing');
  }
  const readonlyAuditorHostInvocationReceiptRef = validateAuditBoundReceiptRef({
    projectRoot: input.projectRoot,
    value: {
      path: toRootRelativePath(input.projectRoot, readonlyHostReceiptPath),
      contentHash: sha256File(readonlyHostReceiptPath),
      receiptHash: normalizeText(readonlyHostReceipt.receiptHash),
    },
    expectedSchemaVersion: 'audit-readonly-auditor-host-invocation-receipt/v1',
    errorCode: 'audit_readonly_auditor_host_invocation_receipt',
  });
  const judgeExecutionReceiptRef = validateAuditBoundReceiptRef({
    projectRoot: input.projectRoot,
    value: {
      path: toRootRelativePath(input.projectRoot, judgeReceiptPath),
      contentHash: sha256File(judgeReceiptPath),
      receiptHash: normalizeText(judgeReceipt.receiptHash),
    },
    expectedSchemaVersion: 'audit-judge-execution-receipt/v1',
    errorCode: 'audit_judge_execution_receipt',
  });
  const roundReceiptBase = {
    schemaVersion: 'audit-triad-round-receipt/v1' as const,
    roundId: `round-${input.state.roundIndex}`,
    verdict: judgeResult.verdict,
    stageProfileId: plan.stageProfileId,
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    readonlyAuditorInvocationId: normalizeText(readonly.response.producerInvocationId),
    perspectiveResults: recordObject(readonly.response.perspectiveResults),
    coveredCheckItemIds: stringsFrom(readonly.response.coveredCheckItemIds),
    vetoItemResults: asRecordArray(readonly.response.vetoItemResults).map((item) => ({
      itemId: normalizeText(item.itemId),
      passed: item.passed === true,
    })),
    validatedGapRefs,
    invalidGapRefs: judgeGapRefs(judgeResult.rejectedGapCandidates),
    sourceDocumentHash: plan.sourceDocumentHash,
    sourceBytesHash: normalizeText(judgeRequest.request.sourceBytesHash),
    semanticModelHash: plan.semanticModelHash,
    implementationConfirmationHash: plan.implementationConfirmationHash,
    projectionSetHash: plan.projectionSetHash,
    checkedProjectionQualityRuleCodes: plan.checkedProjectionQualityRuleCodes,
    qualityRuleSetHash: plan.qualityRuleSetHash,
    modelPacketHash: plan.modelPacketHash,
    auditReceiptHash: plan.auditReceiptHash,
    goalExecutionHash: plan.goalExecutionHash,
    criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    currentAttemptHash: plan.currentAttemptHash,
    currentEvidenceHash: plan.currentEvidenceHash,
    auditTriadJudgeRequestHash: normalizeText(judgeRequest.request.requestHash),
    independentProviderEvidence: judgeResult.independentProviderEvidence,
    providerInvocationReceiptRef: judgeProviderInvocationReceiptRef,
    judgeAdapterHostExecution: judgeResult.judgeAdapterHostExecution,
    judgeExecutionReceiptRef,
    readonlyAuditorHostInvocationReceiptRef,
  };
  const roundReceiptPath = path.join(roundDir, 'audit-triad-round-receipt.json');
  if (!convergentVerdict) {
    writeJsonUtf8(roundReceiptPath, {
      ...roundReceiptBase,
      receiptHash: sha256Json(roundReceiptBase),
    });
    return {
      roundIndex: input.state.roundIndex,
      roundReceiptPath,
      judgeReceiptPath,
      verdict: judgeResult.verdict,
      validatedGapRefs,
    };
  }
  const judgeAuthoritativeReportPath = writeAuditJudgeAuthoritativeReport({
    projectRoot: input.projectRoot,
    plan,
    roundIndex: input.state.roundIndex,
    roundDir,
    readonlyAuditorRequest: readonly.request,
    scoring: auditReviewScoring,
  });
  const auditorHost = executeAuditRunAuditorHost({
    projectRoot: input.projectRoot,
    plan,
    roundIndex: input.state.roundIndex,
    roundDir,
    readonlyAuditorRequest: readonly.request,
    readonlyAuditorResponse: readonly.response,
    readonlyAuditorResponseHash: readonly.responseHash,
    readonlyAuditorHostInvocationReceiptRef,
    judgeRequestHash: normalizeText(judgeRequest.request.requestHash),
    judgeExecutionReceiptRef,
    judgeProviderInvocationReceiptRef,
    judgeAuthoritativeReportPath,
    judgeAuditReviewScoringContractHash: sha256Json(auditReviewScoringContract),
    auditReviewScoring,
  });
  validateAuditHostScoreRecordAgainstJudge({
    scoreRecord: auditorHost.scoreRecord,
    contract: auditReviewScoringContract,
    scoring: auditReviewScoring,
  });
  const roundReceiptWithoutHash = {
    ...roundReceiptBase,
    scoreWriterInvocationReceiptRef: auditorHost.scoreWriterInvocationReceiptRef,
    scoreReceiptRefs: [auditorHost.scoreReceiptRef.path],
    runAuditorHostReceiptRefs: [auditorHost.runAuditorHostReceiptRef.path],
  };
  const roundReceipt = {
    ...roundReceiptWithoutHash,
    receiptHash: sha256Json(roundReceiptWithoutHash),
  };
  writeJsonUtf8(roundReceiptPath, roundReceipt);
  return {
    roundIndex: input.state.roundIndex,
    roundReceiptPath,
    judgeReceiptPath,
    verdict: judgeResult.verdict,
    validatedGapRefs,
  };
}

interface AuditControlledFinalizationResult {
  decision: 'pass' | 'blocked';
  taskReport: TaskReport;
  taskReportPath: string;
  reportPath: string;
  runtimeStatusReceiptPath: string;
  finalizationReceiptPath: string;
  nextAction: string;
}

interface AuditControlledFinalizationIntent {
  schemaVersion: 'audit-controlled-finalization-intent/v1';
  intentId: string;
  recordPath: string;
  sessionId: string;
  packetId: string;
  currentStage: string;
  instruction: MainAgentDispatchInstruction;
  instructionHash: string;
  planRef: {
    path: string;
    contentHash: string;
  };
  roundReceiptRefs: Array<{
    path: string;
    contentHash: string;
  }>;
  preparedAt: string;
  intentHash: string;
}

interface AuditGapRemediationDispatchResult {
  taskReport: TaskReport;
  taskReportPath: string;
  feedbackDispatchPath: string;
  nextAction: string;
}

interface AuditRepairAuthoritySnapshot {
  context: AuditRepairContext;
  recordId: string;
  requirementSetId: string;
  currentCompiledPromptRef: CompiledPromptRef;
  currentSemanticModelHash: string;
  currentProjectionSetHash: string;
  repairedAuditTargetBundleHash: string;
  feedbackDispatchPath: string;
  feedbackDispatch: Record<string, unknown>;
  roundReceiptPath: string;
  roundReceipt: Record<string, unknown>;
}

interface AuditRepairFreshAuthorityResult {
  taskReport: TaskReport;
  changedHashFields: string[];
  issueCode: string | null;
  snapshot: AuditRepairAuthoritySnapshot | null;
}

function auditTargetBundleHashForCurrentProfile(input: {
  projectRoot: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  implementationConfirmationHash: string;
  projectionSetHash: string;
  modelPacketHash: string;
  auditReceiptHash: string;
  goalExecutionHash: string | null;
  priorRepairReceiptRefs: Array<{ path: string; contentHash: string }>;
}): string {
  const profile = resolveCriticalAuditorProfile(input.projectRoot);
  const stageProfileId = stageProfileForCallPoint('audit_review');
  const validation = validateCriticalAuditorProfileForStage({
    profile,
    stageProfileId,
  });
  if (!validation.ok || !validation.stageProfile) {
    throw new Error(`audit_target_bundle_profile_invalid:${validation.blockingReasons.join(',')}`);
  }
  const qualityRuleCodes = [...AUDIT_PROJECTION_QUALITY_RULE_CODES].sort();
  return sha256AuditTriadJson({
    sourceDocumentHash: input.sourceDocumentHash,
    semanticModelHash: input.semanticModelHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    projectionSetHash: input.projectionSetHash,
    checkedProjectionQualityRuleCodes: qualityRuleCodes,
    qualityRuleSetHash: sha256AuditTriadJson(qualityRuleCodes),
    modelPacketHash: input.modelPacketHash,
    auditReceiptHash: input.auditReceiptHash,
    goalExecutionHash: input.goalExecutionHash,
    vetoItemIds: [...validation.stageProfile.vetoItemIds].sort(),
    priorRepairReceiptRefs: input.priorRepairReceiptRefs,
  });
}

function auditRepairFreshAuthorityGate(input: {
  projectRoot: string;
  recordPath: string | null;
  packet: ExecutionPacket;
  taskReport: TaskReport;
}): AuditRepairFreshAuthorityResult {
  const context = input.packet.auditRepairContext;
  if (!context || input.taskReport.status !== 'done') {
    return {
      taskReport: input.taskReport,
      changedHashFields: [],
      issueCode: null,
      snapshot: null,
    };
  }
  const blocked = (issueCode: string) => ({
    taskReport: {
      ...input.taskReport,
      status: 'blocked' as const,
      evidence: [...input.taskReport.evidence, `audit repair authority blocked: ${issueCode}`],
      driftFlags: [
        ...new Set([
          ...(input.taskReport.driftFlags ?? []),
          'audit-repair-fresh-authority-required',
        ]),
      ],
    },
    changedHashFields: [],
    issueCode,
    snapshot: null,
  });
  if (!input.recordPath) {
    return blocked('audit_repair_requirement_record_missing');
  }
  const currentRecord = readJsonIfExists(input.recordPath);
  const currentCompiledPromptRef = currentCompiledPromptRefFromDispatchPointer({
    projectRoot: input.projectRoot,
    record: currentRecord,
  });
  if (!currentCompiledPromptRef) {
    return blocked('audit_repair_current_publication_missing');
  }
  const modelPacketRead = readModelPacketForCompiledRef(
    input.projectRoot,
    currentCompiledPromptRef
  );
  if (!modelPacketRead.modelPacket || modelPacketRead.issueCodes.length > 0) {
    return blocked(
      `audit_repair_current_publication_invalid:${modelPacketRead.issueCodes.join(',') || 'model_packet_missing'}`
    );
  }
  const currentSemanticModelHash = normalizeText(currentRecord?.semanticModelHash);
  const publishedSemanticModelHash = normalizeText(modelPacketRead.modelPacket.semanticModelHash);
  if (
    !currentSemanticModelHash ||
    (publishedSemanticModelHash && publishedSemanticModelHash !== currentSemanticModelHash)
  ) {
    return blocked('audit_repair_current_semantic_binding_invalid');
  }
  const feedbackDispatchPath = resolveRootRelativePath(
    input.projectRoot,
    context.feedbackDispatchRef.path
  );
  const feedbackRelativePath = path.relative(input.projectRoot, feedbackDispatchPath);
  if (
    feedbackRelativePath.startsWith('..') ||
    path.isAbsolute(feedbackRelativePath) ||
    !fs.existsSync(feedbackDispatchPath)
  ) {
    return blocked('audit_repair_feedback_dispatch_missing');
  }
  const feedbackDispatchContent = fs.readFileSync(feedbackDispatchPath, 'utf8');
  if (sha256Text(feedbackDispatchContent) !== context.feedbackDispatchRef.contentHash) {
    return blocked('audit_repair_feedback_dispatch_content_hash_mismatch');
  }
  const feedbackDispatch = readJsonIfExists(feedbackDispatchPath);
  if (!feedbackDispatch) {
    return blocked('audit_repair_feedback_dispatch_invalid');
  }
  const feedbackDispatchHash = normalizeText(feedbackDispatch.dispatchHash);
  const { dispatchHash: _ignoredDispatchHash, ...feedbackWithoutHash } = feedbackDispatch;
  if (
    feedbackDispatchHash !== context.feedbackDispatchRef.dispatchHash ||
    feedbackDispatchHash !== sha256Json(feedbackWithoutHash)
  ) {
    return blocked('audit_repair_feedback_dispatch_hash_mismatch');
  }
  for (const [field, expected] of [
    ['auditEpochId', context.sourceAuditEpochId],
    ['auditTargetBundleHash', context.sourceAuditTargetBundleHash],
    ['semanticModelHash', context.semanticModelHash],
    ['projectionSetHash', context.projectionSetHash],
    ['qualityRuleSetHash', context.qualityRuleSetHash],
  ] as const) {
    if (normalizeText(feedbackDispatch[field]) !== expected) {
      return blocked(`audit_repair_feedback_dispatch_${field}_mismatch`);
    }
  }
  if (
    sha256Json(stringsFrom(feedbackDispatch.validatedGapRefs)) !==
    sha256Json(context.validatedGapRefs)
  ) {
    return blocked('audit_repair_feedback_dispatch_validated_gap_refs_mismatch');
  }
  const roundReceiptRef = recordObject(feedbackDispatch?.roundReceiptRef);
  const roundReceiptPath = resolveRootRelativePath(
    input.projectRoot,
    normalizeText(roundReceiptRef.path)
  );
  const roundReceipt = roundReceiptPath ? readJsonIfExists(roundReceiptPath) : null;
  if (!roundReceipt) {
    return blocked('audit_repair_source_round_receipt_missing');
  }
  if (
    sha256Text(fs.readFileSync(roundReceiptPath, 'utf8')) !==
    normalizeText(roundReceiptRef.contentHash)
  ) {
    return blocked('audit_repair_source_round_receipt_hash_mismatch');
  }
  for (const [field, expected] of [
    ['auditEpochId', context.sourceAuditEpochId],
    ['auditTargetBundleHash', context.sourceAuditTargetBundleHash],
    ['semanticModelHash', context.semanticModelHash],
    ['projectionSetHash', context.projectionSetHash],
    ['qualityRuleSetHash', context.qualityRuleSetHash],
  ] as const) {
    if (normalizeText(roundReceipt[field]) !== expected) {
      return blocked(`audit_repair_source_round_receipt_${field}_mismatch`);
    }
  }
  const expectedQualityRuleCodes = [...AUDIT_PROJECTION_QUALITY_RULE_CODES].sort();
  if (
    sha256AuditTriadJson(stringsFrom(roundReceipt.checkedProjectionQualityRuleCodes).sort()) !==
      context.qualityRuleSetHash ||
    sha256AuditTriadJson(expectedQualityRuleCodes) !== context.qualityRuleSetHash
  ) {
    return blocked('audit_repair_quality_rule_set_mismatch');
  }
  if (input.taskReport.filesChanged.length === 0) {
    return blocked('audit_repair_files_changed_missing');
  }
  const normalizedFeedbackPath = path.resolve(feedbackDispatchPath);
  if (
    !input.taskReport.evidence.some(
      (evidenceRef) =>
        path.resolve(resolveRootRelativePath(input.projectRoot, evidenceRef)) ===
        normalizedFeedbackPath
    )
  ) {
    return blocked('audit_repair_feedback_evidence_missing');
  }
  const currentProjectionSetHash = requirementsProjectionSetHash(modelPacketRead.modelPacket);
  const changedHashFields = (
    [
      [
        'sourceDocumentHash',
        normalizeText(roundReceipt.sourceDocumentHash),
        currentCompiledPromptRef.sourceDocumentHash,
      ],
      [
        'implementationConfirmationHash',
        normalizeText(roundReceipt.implementationConfirmationHash),
        currentCompiledPromptRef.implementationConfirmationHash,
      ],
      [
        'modelPacketHash',
        normalizeText(roundReceipt.modelPacketHash),
        currentCompiledPromptRef.modelPacketHash,
      ],
      [
        'auditReceiptHash',
        normalizeText(roundReceipt.auditReceiptHash),
        currentCompiledPromptRef.auditReceiptHash,
      ],
      [
        'goalExecutionHash',
        normalizeText(roundReceipt.goalExecutionHash),
        normalizeText(currentCompiledPromptRef.goalExecutionHash),
      ],
      ['semanticModelHash', context.semanticModelHash, currentSemanticModelHash],
      ['projectionSetHash', context.projectionSetHash, currentProjectionSetHash],
    ] as Array<[string, string, string]>
  )
    .filter(([, previousHash, currentHash]) => previousHash !== currentHash)
    .map(([field]) => field);
  if (changedHashFields.length === 0) {
    return blocked('audit_repair_current_publication_unchanged');
  }
  const repairedAuditTargetBundleHash = auditTargetBundleHashForCurrentProfile({
    projectRoot: input.projectRoot,
    sourceDocumentHash: currentCompiledPromptRef.sourceDocumentHash,
    semanticModelHash: currentSemanticModelHash,
    implementationConfirmationHash: currentCompiledPromptRef.implementationConfirmationHash,
    projectionSetHash: currentProjectionSetHash,
    modelPacketHash: currentCompiledPromptRef.modelPacketHash,
    auditReceiptHash: currentCompiledPromptRef.auditReceiptHash,
    goalExecutionHash: currentCompiledPromptRef.goalExecutionHash ?? null,
    priorRepairReceiptRefs: context.priorRepairReceiptRefs ?? [],
  });
  if (repairedAuditTargetBundleHash === context.sourceAuditTargetBundleHash) {
    return blocked('audit_repair_target_bundle_unchanged');
  }
  return {
    taskReport: input.taskReport,
    changedHashFields,
    issueCode: null,
    snapshot: {
      context,
      recordId: normalizeText(currentRecord?.recordId),
      requirementSetId: normalizeText(currentRecord?.requirementSetId),
      currentCompiledPromptRef,
      currentSemanticModelHash,
      currentProjectionSetHash,
      repairedAuditTargetBundleHash,
      feedbackDispatchPath,
      feedbackDispatch,
      roundReceiptPath,
      roundReceipt,
    },
  };
}

function materializeAuditMainAgentRepairReceipt(input: {
  projectRoot: string;
  packet: ExecutionPacket;
  taskReport: TaskReport;
  changedHashFields: string[];
  snapshot: AuditRepairAuthoritySnapshot;
}): { path: string; contentHash: string } {
  const feedbackDispatch = input.snapshot.feedbackDispatch;
  const roundReceiptRef = recordObject(feedbackDispatch.roundReceiptRef);
  const judgeReceiptRef = recordObject(feedbackDispatch.judgeReceiptRef);
  const receiptWithoutHash = {
    schemaVersion: 'audit-main-agent-repair-receipt/v1',
    recordId: input.snapshot.recordId,
    requirementSetId: input.snapshot.requirementSetId,
    sourceAuditEpochId: input.snapshot.context.sourceAuditEpochId,
    sourceAuditTargetBundleHash: input.snapshot.context.sourceAuditTargetBundleHash,
    remediationPacketId: input.packet.packetId,
    feedbackDispatchRef: {
      path: toRootRelativePath(input.projectRoot, input.snapshot.feedbackDispatchPath),
      contentHash: input.snapshot.context.feedbackDispatchRef.contentHash,
      dispatchHash: input.snapshot.context.feedbackDispatchRef.dispatchHash,
    },
    sourceRoundReceiptRef: {
      path: toRootRelativePath(input.projectRoot, input.snapshot.roundReceiptPath),
      contentHash: normalizeText(roundReceiptRef.contentHash),
    },
    sourceJudgeReceiptRef: {
      path: normalizeText(judgeReceiptRef.path),
      contentHash: normalizeText(judgeReceiptRef.contentHash),
    },
    priorRepairReceiptRefs: input.snapshot.context.priorRepairReceiptRefs ?? [],
    validatedGapRefs: input.snapshot.context.validatedGapRefs,
    sourceSemanticModelHash: input.snapshot.context.semanticModelHash,
    sourceProjectionSetHash: input.snapshot.context.projectionSetHash,
    qualityRuleSetHash: input.snapshot.context.qualityRuleSetHash,
    repairedSemanticModelHash: input.snapshot.currentSemanticModelHash,
    repairedProjectionSetHash: input.snapshot.currentProjectionSetHash,
    repairedModelPacketHash: input.snapshot.currentCompiledPromptRef.modelPacketHash,
    repairedAuditReceiptHash: input.snapshot.currentCompiledPromptRef.auditReceiptHash,
    repairedGoalExecutionHash: input.snapshot.currentCompiledPromptRef.goalExecutionHash ?? null,
    repairedAuditTargetBundleHash: input.snapshot.repairedAuditTargetBundleHash,
    changedHashFields: input.changedHashFields,
    executorTaskReportHash: sha256Json(input.taskReport),
    filesChanged: input.taskReport.filesChanged,
    validationsRun: input.taskReport.validationsRun,
    executorEvidenceRefs: input.taskReport.evidence,
  };
  const receipt = {
    ...receiptWithoutHash,
    receiptHash: sha256Json(receiptWithoutHash),
  };
  const receiptPath = path.join(
    path.dirname(input.snapshot.feedbackDispatchPath),
    'main-agent-repair-receipt.json'
  );
  const existing = readJsonIfExists(receiptPath);
  if (existing) {
    if (sha256Json(existing) !== sha256Json(receipt)) {
      throw new Error('audit_main_agent_repair_receipt_changed');
    }
  } else {
    writeJsonUtf8(receiptPath, receipt);
  }
  return {
    path: receiptPath,
    contentHash: sha256Text(fs.readFileSync(receiptPath, 'utf8')),
  };
}

function materializeAuditGapRemediationDispatch(input: {
  projectRoot: string;
  recordPath: string;
  instruction: MainAgentDispatchInstruction;
  planPath: string;
  round: AuditControlledRoundResult;
  currentStage: string;
}): AuditGapRemediationDispatchResult {
  const plan = JSON.parse(fs.readFileSync(input.planPath, 'utf8')) as AuditTriadExecutionPlan;
  const roundReceiptPath = input.round.roundReceiptPath;
  const judgeReceiptPath = input.round.judgeReceiptPath;
  const roundDir = path.dirname(roundReceiptPath);
  const feedbackDispatchWithoutHash = {
    schemaVersion: 'audit-repair-feedback-dispatch/v1',
    recordId: plan.recordId,
    attemptId: plan.attemptId,
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    semanticModelHash: plan.semanticModelHash,
    projectionSetHash: plan.projectionSetHash,
    qualityRuleSetHash: plan.qualityRuleSetHash,
    roundIndex: input.round.roundIndex,
    validatedGapRefs: input.round.validatedGapRefs,
    priorRepairReceiptRefs: plan.priorRepairReceiptRefs,
    roundReceiptRef: {
      path: toRootRelativePath(input.projectRoot, roundReceiptPath),
      contentHash: sha256Text(fs.readFileSync(roundReceiptPath, 'utf8')),
    },
    judgeReceiptRef: {
      path: toRootRelativePath(input.projectRoot, judgeReceiptPath),
      contentHash: sha256Text(fs.readFileSync(judgeReceiptPath, 'utf8')),
    },
  };
  const feedbackDispatch = {
    ...feedbackDispatchWithoutHash,
    dispatchHash: sha256Json(feedbackDispatchWithoutHash),
  };
  const feedbackDispatchPath = path.join(roundDir, 'repair-feedback-dispatch.json');
  const existingFeedback = readJsonIfExists(feedbackDispatchPath);
  if (existingFeedback) {
    if (sha256Json(existingFeedback) !== sha256Json(feedbackDispatch)) {
      throw new Error('audit_repair_feedback_dispatch_changed');
    }
  } else {
    writeJsonUtf8(feedbackDispatchPath, feedbackDispatch);
  }
  const record = readJsonIfExists(input.recordPath);
  const implementationAttemptId =
    normalizeText(record?.currentAttemptId) ||
    normalizeText(record?.implementationAttemptId) ||
    normalizeText(record?.runId);
  if (!implementationAttemptId) {
    throw new Error('audit_remediation_dispatch_implementation_attempt_missing');
  }
  const auditDir = path.dirname(input.planPath);
  const reportPath = path.join(auditDir, 'audit-review-report.json');
  const runtimeStatusReceiptPath = path.join(
    path.dirname(input.recordPath),
    'runtime',
    'status-decisions',
    implementationAttemptId,
    'audit_review.json'
  );
  const gateCode = mainAuditReviewGate(
    [
      '--requirement-record',
      input.recordPath,
      '--attempt-id',
      plan.attemptId,
      '--plan',
      input.planPath,
      '--round',
      roundReceiptPath,
      '--repair-feedback-dispatch',
      feedbackDispatchPath,
      '--report-path',
      reportPath,
      '--evaluated-by',
      'main-agent-controlled-executor',
    ],
    { writeOutput: () => undefined }
  );
  const auditReviewReport = readJsonIfExists(reportPath);
  if (
    gateCode === 0 ||
    normalizeText(auditReviewReport?.decision) !== 'blocked' ||
    !fs.existsSync(runtimeStatusReceiptPath)
  ) {
    throw new Error('audit_remediation_dispatch_review_state_missing');
  }
  const taskReport: TaskReport = {
    packetId: input.instruction.packetId,
    status: 'blocked',
    filesChanged: [feedbackDispatchPath, reportPath, runtimeStatusReceiptPath],
    validationsRun: [
      'audit-controlled-executor-judge',
      'audit-gap-remediation-dispatch',
      'main-agent-audit-review-gate',
    ],
    evidence: [
      input.planPath,
      roundReceiptPath,
      judgeReceiptPath,
      feedbackDispatchPath,
      reportPath,
      runtimeStatusReceiptPath,
    ].map((artifactPath) => toRootRelativePath(input.projectRoot, artifactPath)),
    downstreamContext: input.round.validatedGapRefs.map(
      (gapRef) => `Validated audit gap requires controlled remediation: ${gapRef}`
    ),
    driftFlags: ['audit-validated-gap-remediation-required'],
  };
  const taskReportPath = defaultRunLoopTaskReportPath(
    input.projectRoot,
    input.instruction.sessionId,
    input.instruction.packetId
  );
  writeJsonUtf8(taskReportPath, taskReport);
  const completedState = ingestMainAgentTaskReport(
    input.projectRoot,
    input.instruction.sessionId,
    taskReport,
    {
      currentStage: input.currentStage,
      nextActionHint: 'dispatch_remediation',
      authoritativeNextActionHint: true,
    }
  );
  return {
    taskReport,
    taskReportPath,
    feedbackDispatchPath,
    nextAction: completedState.nextAction,
  };
}

interface AuditControlledFinalizationGatePreparation {
  gateArgs: string[];
  auditDir: string;
  reportPath: string;
  runtimeStatusReceiptPath: string;
}

function prepareAuditControlledFinalizationGate(input: {
  projectRoot: string;
  recordPath: string;
  instruction: MainAgentDispatchInstruction;
  planPath: string;
  roundReceiptPaths: string[];
}): AuditControlledFinalizationGatePreparation {
  const plan = JSON.parse(fs.readFileSync(input.planPath, 'utf8')) as AuditTriadExecutionPlan;
  const record = readJsonIfExists(input.recordPath);
  const implementationAttemptId =
    normalizeText(record?.currentAttemptId) ||
    normalizeText(record?.implementationAttemptId) ||
    normalizeText(record?.runId);
  if (!implementationAttemptId) {
    throw new Error('audit_controlled_executor_implementation_attempt_missing');
  }
  const auditDir = path.dirname(input.planPath);
  const reportPath = path.join(auditDir, 'audit-review-report.json');
  const runtimeStatusReceiptPath = path.join(
    path.dirname(input.recordPath),
    'runtime',
    'status-decisions',
    implementationAttemptId,
    'audit_review.json'
  );
  const repairReceiptPaths = plan.priorRepairReceiptRefs.map((ref) =>
    resolveRootRelativePath(input.projectRoot, ref.path)
  );
  const repairFeedbackDispatchPaths = repairReceiptPaths
    .map((receiptPath) => readJsonIfExists(receiptPath))
    .map((receipt) => normalizeText(recordObject(receipt?.feedbackDispatchRef).path))
    .filter(Boolean)
    .map((feedbackPath) => resolveRootRelativePath(input.projectRoot, feedbackPath));
  const gateArgs = [
    '--requirement-record',
    input.recordPath,
    '--attempt-id',
    plan.attemptId,
    '--plan',
    input.planPath,
    '--report-path',
    reportPath,
    '--evaluated-by',
    'main-agent-controlled-executor',
    ...repairReceiptPaths.flatMap((receiptPath) => ['--repair-receipt', receiptPath]),
    ...repairFeedbackDispatchPaths.flatMap((dispatchPath) => [
      '--repair-feedback-dispatch',
      dispatchPath,
    ]),
    ...input.roundReceiptPaths.flatMap((receiptPath) => ['--round', receiptPath]),
  ];
  return {
    gateArgs,
    auditDir,
    reportPath,
    runtimeStatusReceiptPath,
  };
}

function writeJsonCreateOnlyOrEqual(
  targetPath: string,
  payload: Record<string, unknown>,
  conflictCode: string
): { content: string; contentHash: string } {
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  const contentHash = sha256Text(content);
  if (fs.existsSync(targetPath)) {
    if (sha256Text(fs.readFileSync(targetPath, 'utf8')) !== contentHash) {
      throw new Error(conflictCode);
    }
    return { content, contentHash };
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, content, 'utf8');
    fs.renameSync(temporaryPath, targetPath);
  } catch (error) {
    if (
      fs.existsSync(targetPath) &&
      sha256Text(fs.readFileSync(targetPath, 'utf8')) === contentHash
    ) {
      return { content, contentHash };
    }
    throw error;
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
  return { content, contentHash };
}

function auditControlledFinalizationIntentPayload(
  intent: AuditControlledFinalizationIntent | Omit<AuditControlledFinalizationIntent, 'intentHash'>
): Omit<AuditControlledFinalizationIntent, 'intentHash'> {
  return {
    schemaVersion: 'audit-controlled-finalization-intent/v1',
    intentId: intent.intentId,
    recordPath: intent.recordPath,
    sessionId: intent.sessionId,
    packetId: intent.packetId,
    currentStage: intent.currentStage,
    instruction: intent.instruction,
    instructionHash: intent.instructionHash,
    planRef: intent.planRef,
    roundReceiptRefs: intent.roundReceiptRefs,
    preparedAt: intent.preparedAt,
  };
}

function validateAuditControlledFinalizationIntent(input: {
  projectRoot: string;
  intentPath: string;
  expectedIntentId?: string;
  expectedContentHash?: string;
}): AuditControlledFinalizationIntent {
  const raw = readJsonIfExists(input.intentPath);
  if (!raw) {
    throw new Error('audit_controlled_executor_finalization_intent_missing');
  }
  const intent = raw as unknown as AuditControlledFinalizationIntent;
  if (
    intent.schemaVersion !== 'audit-controlled-finalization-intent/v1' ||
    !normalizeText(intent.intentId) ||
    (input.expectedIntentId && intent.intentId !== input.expectedIntentId) ||
    !normalizeText(intent.recordPath) ||
    !normalizeText(intent.sessionId) ||
    !normalizeText(intent.packetId) ||
    !normalizeText(intent.currentStage) ||
    !intent.instruction ||
    intent.instructionHash !== sha256Json(intent.instruction) ||
    !normalizeText(intent.planRef?.path) ||
    !normalizeText(intent.planRef?.contentHash) ||
    !Array.isArray(intent.roundReceiptRefs) ||
    !normalizeText(intent.preparedAt) ||
    !normalizeText(intent.intentHash) ||
    intent.intentHash !== sha256Json(auditControlledFinalizationIntentPayload(intent))
  ) {
    throw new Error('audit_controlled_executor_finalization_intent_invalid');
  }
  const contentHash = sha256File(input.intentPath);
  if (input.expectedContentHash && contentHash !== input.expectedContentHash) {
    throw new Error('audit_controlled_executor_finalization_intent_content_hash_mismatch');
  }
  const planPath = resolveRootRelativePath(input.projectRoot, intent.planRef.path);
  if (!fs.existsSync(planPath) || sha256File(planPath) !== intent.planRef.contentHash) {
    throw new Error('audit_controlled_executor_finalization_intent_plan_changed');
  }
  for (const [index, receiptRef] of intent.roundReceiptRefs.entries()) {
    const receiptPath = resolveRootRelativePath(input.projectRoot, receiptRef.path);
    if (
      !normalizeText(receiptRef.contentHash) ||
      !fs.existsSync(receiptPath) ||
      sha256File(receiptPath) !== receiptRef.contentHash
    ) {
      throw new Error(`audit_controlled_executor_finalization_intent_round_changed:${index + 1}`);
    }
  }
  return intent;
}

function persistAuditControlledFinalizationPointer(input: {
  projectRoot: string;
  sessionId: string;
  intent: AuditControlledFinalizationIntent;
  intentPath: string;
  intentContentHash: string;
}): void {
  updateOrchestrationState(input.projectRoot, input.sessionId, (current) => {
    const existing = current.auditControlledFinalization;
    if (existing?.status === 'prepared' && existing.intentId !== input.intent.intentId) {
      throw new Error('audit_controlled_executor_finalization_intent_in_progress');
    }
    if (
      existing?.intentId === input.intent.intentId &&
      existing.intentContentHash !== input.intentContentHash
    ) {
      throw new Error('audit_controlled_executor_finalization_pointer_hash_mismatch');
    }
    if (existing?.intentId === input.intent.intentId && existing.status === 'committed') {
      return current;
    }
    return {
      ...current,
      auditControlledFinalization: {
        schemaVersion: 'audit-controlled-finalization-pointer/v1',
        status: 'prepared',
        intentId: input.intent.intentId,
        intentPath: toRootRelativePath(input.projectRoot, input.intentPath),
        intentContentHash: input.intentContentHash,
        packetId: input.intent.packetId,
        preparedAt: input.intent.preparedAt,
        finalizationReceiptPath: null,
        finalizationReceiptContentHash: null,
      },
    };
  });
}

function loadOrCreateAuditControlledFinalizationIntent(input: {
  projectRoot: string;
  recordPath: string;
  instruction: MainAgentDispatchInstruction;
  planPath: string;
  roundReceiptPaths: string[];
  currentStage: string;
  auditDir: string;
}): {
  intent: AuditControlledFinalizationIntent;
  path: string;
  contentHash: string;
} {
  const planRef = {
    path: toRootRelativePath(input.projectRoot, input.planPath),
    contentHash: sha256File(input.planPath),
  };
  const roundReceiptRefs = input.roundReceiptPaths.map((roundReceiptPath) => ({
    path: toRootRelativePath(input.projectRoot, roundReceiptPath),
    contentHash: sha256File(roundReceiptPath),
  }));
  const identityHash = sha256Json({
    schemaVersion: 'audit-controlled-finalization-intent-identity/v1',
    recordPath: toRootRelativePath(input.projectRoot, input.recordPath),
    sessionId: input.instruction.sessionId,
    packetId: input.instruction.packetId,
    currentStage: input.currentStage,
    instructionHash: sha256Json(input.instruction),
    planRef,
    roundReceiptRefs,
  });
  const intentId = `AUDIT-FINAL-INTENT-${identityHash.slice(
    'sha256:'.length,
    'sha256:'.length + 24
  )}`;
  const intentPath = path.join(
    input.auditDir,
    'finalization-intents',
    safeSegment(intentId),
    'audit-finalization-intent.json'
  );
  let intent: AuditControlledFinalizationIntent;
  let contentHash: string;
  if (fs.existsSync(intentPath)) {
    intent = validateAuditControlledFinalizationIntent({
      projectRoot: input.projectRoot,
      intentPath,
      expectedIntentId: intentId,
    });
    contentHash = sha256File(intentPath);
  } else {
    const payload: Omit<AuditControlledFinalizationIntent, 'intentHash'> = {
      schemaVersion: 'audit-controlled-finalization-intent/v1',
      intentId,
      recordPath: toRootRelativePath(input.projectRoot, input.recordPath),
      sessionId: input.instruction.sessionId,
      packetId: input.instruction.packetId,
      currentStage: input.currentStage,
      instruction: input.instruction,
      instructionHash: sha256Json(input.instruction),
      planRef,
      roundReceiptRefs,
      preparedAt: new Date().toISOString(),
    };
    intent = {
      ...payload,
      intentHash: sha256Json(auditControlledFinalizationIntentPayload(payload)),
    };
    contentHash = writeJsonCreateOnlyOrEqual(
      intentPath,
      intent as unknown as Record<string, unknown>,
      'audit_controlled_executor_finalization_intent_conflict'
    ).contentHash;
  }
  if (
    intent.instructionHash !== sha256Json(input.instruction) ||
    intent.planRef.contentHash !== planRef.contentHash ||
    sha256Json(intent.roundReceiptRefs) !== sha256Json(roundReceiptRefs)
  ) {
    throw new Error('audit_controlled_executor_finalization_intent_input_mismatch');
  }
  persistAuditControlledFinalizationPointer({
    projectRoot: input.projectRoot,
    sessionId: input.instruction.sessionId,
    intent,
    intentPath,
    intentContentHash: contentHash,
  });
  return { intent, path: intentPath, contentHash };
}

function taskReportStateProjection(
  report: TaskReport
): NonNullable<OrchestrationState['lastTaskReport']> {
  return {
    packetId: report.packetId,
    status: report.status,
    filesChanged: report.filesChanged,
    validationsRun: report.validationsRun,
    evidence: report.evidence,
    ...(report.driftFlags ? { driftFlags: report.driftFlags } : {}),
  };
}

function auditControlledTaskReportAlreadyIngested(input: {
  projectRoot: string;
  sessionId: string;
  taskReport: TaskReport;
}): OrchestrationState | null {
  const state = readOrchestrationState(input.projectRoot, input.sessionId);
  if (!state) {
    throw new Error('audit_controlled_executor_orchestration_state_missing');
  }
  const expectedReport = taskReportStateProjection(input.taskReport);
  const expectedPacketStatus = input.taskReport.status === 'done' ? 'completed' : 'invalidated';
  const reportMatches = sha256Json(state.lastTaskReport ?? null) === sha256Json(expectedReport);
  const packetMatches =
    state.pendingPacket?.packetId === input.taskReport.packetId &&
    state.pendingPacket.status === expectedPacketStatus;
  if (reportMatches && packetMatches) {
    return state;
  }
  if (
    state.lastTaskReport?.packetId === input.taskReport.packetId ||
    (state.pendingPacket?.packetId === input.taskReport.packetId &&
      (state.pendingPacket.status === 'completed' || state.pendingPacket.status === 'invalidated'))
  ) {
    throw new Error('audit_controlled_executor_partial_task_report_ingest');
  }
  return null;
}

function auditControlledFinalizationStateHash(state: OrchestrationState): string {
  const { auditControlledFinalization: _pointer, ...authorityState } = state;
  return sha256Json(authorityState);
}

function markAuditControlledFinalizationCommitted(input: {
  projectRoot: string;
  sessionId: string;
  intentId: string;
  finalizationReceiptPath: string;
  finalizationReceiptContentHash: string;
}): void {
  updateOrchestrationState(input.projectRoot, input.sessionId, (current) => {
    const pointer = current.auditControlledFinalization;
    if (!pointer || pointer.intentId !== input.intentId) {
      throw new Error('audit_controlled_executor_finalization_pointer_missing');
    }
    if (
      pointer.status === 'committed' &&
      (pointer.finalizationReceiptPath !==
        toRootRelativePath(input.projectRoot, input.finalizationReceiptPath) ||
        pointer.finalizationReceiptContentHash !== input.finalizationReceiptContentHash)
    ) {
      throw new Error('audit_controlled_executor_finalization_pointer_conflict');
    }
    return {
      ...current,
      auditControlledFinalization: {
        ...pointer,
        status: 'committed',
        finalizationReceiptPath: toRootRelativePath(
          input.projectRoot,
          input.finalizationReceiptPath
        ),
        finalizationReceiptContentHash: input.finalizationReceiptContentHash,
      },
    };
  });
}

function resumePreparedAuditControlledFinalization(input: {
  projectRoot: string;
  state: OrchestrationState | null;
}): {
  result: AuditControlledFinalizationResult;
  instruction: MainAgentDispatchInstruction;
} | null {
  const pointer = input.state?.auditControlledFinalization;
  if (!pointer || pointer.status !== 'prepared') return null;
  const intentPath = resolveRootRelativePath(input.projectRoot, pointer.intentPath);
  const intent = validateAuditControlledFinalizationIntent({
    projectRoot: input.projectRoot,
    intentPath,
    expectedIntentId: pointer.intentId,
    expectedContentHash: pointer.intentContentHash,
  });
  if (pointer.packetId !== intent.packetId || input.state?.sessionId !== intent.sessionId) {
    throw new Error('audit_controlled_executor_finalization_pointer_identity_mismatch');
  }
  return {
    result: finalizeAuditControlledExecution({
      projectRoot: input.projectRoot,
      recordPath: resolveRootRelativePath(input.projectRoot, intent.recordPath),
      instruction: intent.instruction,
      planPath: resolveRootRelativePath(input.projectRoot, intent.planRef.path),
      roundReceiptPaths: intent.roundReceiptRefs.map((receiptRef) =>
        resolveRootRelativePath(input.projectRoot, receiptRef.path)
      ),
      currentStage: intent.currentStage,
    }),
    instruction: intent.instruction,
  };
}

function finalizeAuditControlledExecution(input: {
  projectRoot: string;
  recordPath: string;
  instruction: MainAgentDispatchInstruction;
  planPath: string;
  roundReceiptPaths: string[];
  currentStage: string;
}): AuditControlledFinalizationResult {
  const preparation = prepareAuditControlledFinalizationGate(input);
  const finalizationIntent = loadOrCreateAuditControlledFinalizationIntent({
    ...input,
    auditDir: preparation.auditDir,
  });
  preparation.gateArgs.push('--evaluated-at', finalizationIntent.intent.preparedAt);
  let gateCommitBundle: Readonly<AuditReviewGateCommitBundle> | null = null;
  const gateCode = mainAuditReviewGate(preparation.gateArgs, {
    writeOutput: () => undefined,
    onCommitted: (bundle) => {
      gateCommitBundle = bundle;
    },
  });
  if (!gateCommitBundle) {
    throw new Error('audit_controlled_executor_gate_commit_bundle_missing');
  }
  const bundle = gateCommitBundle as Readonly<AuditReviewGateCommitBundle>;
  if (
    path.resolve(bundle.report.path) !== path.resolve(preparation.reportPath) ||
    path.resolve(bundle.runtimeStatus.path) !==
      path.resolve(preparation.runtimeStatusReceiptPath) ||
    (bundle.decision === 'pass') !== (gateCode === 0)
  ) {
    throw new Error('audit_controlled_executor_gate_commit_bundle_invalid');
  }
  const plan = bundle.plan.value;
  const report = bundle.report.value;
  const implementationAttemptId = normalizeText(bundle.runtimeStatus.value.implementationAttemptId);
  if (!implementationAttemptId) {
    throw new Error('audit_controlled_executor_implementation_attempt_missing');
  }
  const decision = bundle.decision;
  const evidencePaths = [
    bundle.plan.path,
    ...bundle.roundInputs.map((artifact) => artifact.path),
    ...bundle.repairInputs.map((artifact) => artifact.path),
    bundle.report.path,
    bundle.runtimeStatus.path,
    bundle.control.commitReceiptPath,
  ].filter((artifactPath, index, values) => values.indexOf(artifactPath) === index);
  const taskReport: TaskReport = {
    packetId: input.instruction.packetId,
    status: decision === 'pass' ? 'done' : 'blocked',
    filesChanged: [bundle.report.path, bundle.runtimeStatus.path],
    validationsRun: [
      'audit-triad-convergence',
      'main-agent-audit-review-gate',
      'audit-controlled-executor-finalization',
    ],
    evidence: evidencePaths.map((artifactPath) =>
      toRootRelativePath(input.projectRoot, artifactPath)
    ),
    downstreamContext:
      decision === 'pass'
        ? ['Current audit epoch converged and Audit Review passed.']
        : stringsFrom(report.blockingReasons),
    ...(decision === 'pass' ? {} : { driftFlags: ['audit-review-finalization-blocked'] }),
  };
  const taskReportPath = defaultRunLoopTaskReportPath(
    input.projectRoot,
    input.instruction.sessionId,
    input.instruction.packetId
  );
  const taskReportWrite = writeJsonCreateOnlyOrEqual(
    taskReportPath,
    taskReport as unknown as Record<string, unknown>,
    'audit_controlled_executor_task_report_conflict'
  );
  const completedState =
    auditControlledTaskReportAlreadyIngested({
      projectRoot: input.projectRoot,
      sessionId: input.instruction.sessionId,
      taskReport,
    }) ??
    ingestMainAgentTaskReport(input.projectRoot, input.instruction.sessionId, taskReport, {
      currentStage: input.currentStage,
      expectedRequirementRecordHash: bundle.control.afterRecordHash,
    });
  const finalizationTransactionId = `AUDIT-FINAL-${sha256Json({
    finalizationIntentId: finalizationIntent.intent.intentId,
    gateTransactionId: bundle.control.transactionId,
    gateEventHash: bundle.control.eventHash,
    packetId: input.instruction.packetId,
    taskReportHash: taskReportWrite.contentHash,
  }).slice('sha256:'.length, 'sha256:'.length + 24)}`;
  const finalizationReceiptWithoutHash = {
    schemaVersion: 'audit-controlled-executor-finalization-receipt/v1',
    recordId: plan.recordId,
    attemptId: plan.attemptId,
    implementationAttemptId,
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    semanticModelHash: plan.semanticModelHash,
    projectionSetHash: plan.projectionSetHash,
    qualityRuleSetHash: plan.qualityRuleSetHash,
    decision,
    auditTriadExecutionPlanRef: {
      path: toRootRelativePath(input.projectRoot, bundle.plan.path),
      contentHash: bundle.plan.contentHash,
    },
    roundReceiptRefs: bundle.roundInputs.map((receipt) => ({
      path: toRootRelativePath(input.projectRoot, receipt.path),
      contentHash: receipt.contentHash,
    })),
    repairReceiptRefs: bundle.repairInputs
      .filter((receipt) => receipt.role.startsWith('repair_receipt_'))
      .map((receipt) => ({
        path: toRootRelativePath(input.projectRoot, receipt.path),
        contentHash: receipt.contentHash,
      })),
    repairFeedbackDispatchRefs: bundle.repairInputs
      .filter((dispatch) => dispatch.role.startsWith('repair_feedback_dispatch_'))
      .map((dispatch) => ({
        path: toRootRelativePath(input.projectRoot, dispatch.path),
        contentHash: dispatch.contentHash,
      })),
    repairEvidence: recordObject(report.repairEvidence),
    finalizationIntentRef: {
      path: toRootRelativePath(input.projectRoot, finalizationIntent.path),
      contentHash: finalizationIntent.contentHash,
      intentHash: finalizationIntent.intent.intentHash,
    },
    auditReviewReportRef: {
      path: toRootRelativePath(input.projectRoot, bundle.report.path),
      contentHash: bundle.report.contentHash,
    },
    runtimeStatusReceiptRef: {
      path: toRootRelativePath(input.projectRoot, bundle.runtimeStatus.path),
      contentHash: bundle.runtimeStatus.contentHash,
    },
    taskReportRef: {
      path: toRootRelativePath(input.projectRoot, taskReportPath),
      contentHash: taskReportWrite.contentHash,
    },
    gateControlCommit: {
      transactionId: bundle.control.transactionId,
      eventId: bundle.control.eventId,
      eventHash: bundle.control.eventHash,
      beforeRecordHash: bundle.control.beforeRecordHash,
      afterRecordHash: bundle.control.afterRecordHash,
      commitReceiptRef: {
        path: toRootRelativePath(input.projectRoot, bundle.control.commitReceiptPath),
        contentHash: bundle.control.commitReceiptContentHash,
      },
    },
    frozenInputSetHash: sha256Json(bundle.frozenInputs),
    finalizationTransactionId,
    orchestrationStateHash: auditControlledFinalizationStateHash(completedState),
    nextAction: completedState.nextAction,
  };
  const finalizationReceipt = {
    ...finalizationReceiptWithoutHash,
    receiptHash: sha256Json(finalizationReceiptWithoutHash),
  };
  const finalizationReceiptPath = path.join(
    preparation.auditDir,
    'finalizations',
    safeSegment(finalizationTransactionId),
    'audit-finalization-receipt.json'
  );
  const finalizationReceiptWrite = writeJsonCreateOnlyOrEqual(
    finalizationReceiptPath,
    finalizationReceipt,
    'audit_controlled_executor_finalization_receipt_conflict'
  );
  markAuditControlledFinalizationCommitted({
    projectRoot: input.projectRoot,
    sessionId: input.instruction.sessionId,
    intentId: finalizationIntent.intent.intentId,
    finalizationReceiptPath,
    finalizationReceiptContentHash: finalizationReceiptWrite.contentHash,
  });
  return {
    decision,
    taskReport,
    taskReportPath,
    reportPath: bundle.report.path,
    runtimeStatusReceiptPath: bundle.runtimeStatus.path,
    finalizationReceiptPath,
    nextAction: completedState.nextAction,
  };
}

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? String(value);
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

type AuditTriadJudgeVerdict =
  | 'no_new_valid_gap'
  | 'no_new_confirmation_blocking_gap'
  | 'new_valid_gap'
  | 'insufficient_audit'
  | 'blocked';

type AuditReviewEffectiveVerdict =
  | 'approved'
  | 'required_fixes'
  | 'blocked'
  | 'blocked_pending_rereadiness';

const AUDIT_PROVIDER_CREDENTIAL_KEY_PATTERN =
  /api.?key|authorization|secret|access.?token|refresh.?token|credential.?value|raw.?credential/iu;

function auditProviderContainsCredentialMaterial(
  value: unknown,
  seen = new Set<object>()
): boolean {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => auditProviderContainsCredentialMaterial(item, seen));
  }
  return Object.entries(value as Record<string, unknown>).some(
    ([key, item]) =>
      AUDIT_PROVIDER_CREDENTIAL_KEY_PATTERN.test(key) ||
      auditProviderContainsCredentialMaterial(item, seen)
  );
}

export function resolveAuditReadonlyAuditorHostTimeoutMs(projectRoot: string): number {
  const judgeRuntime = readGovernanceRemediationConfig(projectRoot).judgeRuntime;
  const providerRef = normalizeText(judgeRuntime?.activeProviderRef);
  const provider = providerRef ? judgeRuntime?.providers?.[providerRef] : undefined;
  const timeoutMs = Number(provider?.requestPolicy?.timeoutMs);
  if (
    judgeRuntime?.enabled !== true ||
    provider?.enabled !== true ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0
  ) {
    throw new Error('audit_readonly_auditor_host_timeout_invalid');
  }
  return timeoutMs;
}

function resolveAuditTriadJudgeInvocationCommand(): string[] {
  const javascriptEntry = path.resolve(__dirname, 'audit-triad-judge-invocation.js');
  if (fs.existsSync(javascriptEntry)) return [process.execPath, javascriptEntry];
  const typescriptEntry = path.resolve(__dirname, 'audit-triad-judge-invocation.ts');
  if (!fs.existsSync(typescriptEntry)) {
    throw new Error('audit_triad_judge_invocation_entry_missing');
  }
  return [process.execPath, '--import', 'tsx', typescriptEntry];
}

export function executeAuditProviderJudgeAdapter(input: {
  projectRoot: string;
  requestPath: string;
  outputDir: string;
  roundIndex: number;
  expected: AuditProviderExpectation;
  processExecutor?: typeof spawnSync;
}): AuditTriadJudgeInvocationResult {
  const [command, ...prefixArgs] = resolveAuditTriadJudgeInvocationCommand();
  const commandArgs = [
    ...prefixArgs,
    '--project-root',
    input.projectRoot,
    '--request',
    input.requestPath,
    '--output-dir',
    input.outputDir,
    '--round',
    String(input.roundIndex),
  ];
  const processExecutor = input.processExecutor ?? spawnSync;
  const execution = processExecutor(command, commandArgs, {
    cwd: input.projectRoot,
    encoding: 'utf8',
    env: process.env,
    shell: false,
    timeout: resolveAuditReadonlyAuditorHostTimeoutMs(input.projectRoot) + 30_000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  const stdout = execution.stdout ?? '';
  const stderr = execution.stderr ?? '';
  const exitCode =
    typeof execution.status === 'number' ? execution.status : execution.error ? -1 : 0;
  if (execution.error || exitCode !== 0) {
    throw new Error(
      `audit_provider_judge_invocation_failed:${exitCode}:${execution.error?.message || stderr || stdout}`
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    throw new Error('audit_provider_judge_invocation_result_json_invalid');
  }
  const result = recordObject(parsed);
  if (auditProviderContainsCredentialMaterial(result)) {
    throw new Error('audit_provider_judge_credential_material_forbidden');
  }
  const providerValidation = validateAuditProviderEvidence({
    expected: input.expected,
    evidence: result.independentProviderEvidence,
  });
  if (!providerValidation.ok) {
    throw new Error(
      providerValidation.issueCodes[0] ?? 'audit_provider_judge_evidence_invalid'
    );
  }
  for (const field of [
    'requestHash',
    'sourceDocumentHash',
    'semanticModelHash',
    'projectionSetHash',
  ] as const) {
    if (normalizeText(result[field]) !== normalizeText(input.expected[field])) {
      throw new Error(`audit_provider_judge_${field}_mismatch`);
    }
  }
  return result as AuditTriadJudgeInvocationResult;
}

export function validateAuditProviderInvocationReceipt(input: {
  projectRoot: string;
  receiptRef: unknown;
  requestHash: string;
  sourceDocumentHash: string;
  sourceBytesHash: string;
  semanticModelHash: string;
  projectionSetHash: string;
  providerRunId: string;
  expectedProviderBinding: AuditProviderBindingExpectation;
}): Record<string, unknown> {
  const receiptRef = recordObject(input.receiptRef);
  const receiptPathValue = normalizeText(receiptRef.path);
  if (!receiptPathValue) {
    throw new Error('audit_provider_judge_invocation_receipt_ref_missing');
  }
  const receiptPath = resolveRootRelativePath(input.projectRoot, receiptPathValue);
  if (!fs.existsSync(receiptPath)) {
    throw new Error('audit_provider_judge_invocation_receipt_missing');
  }
  const receipt = readJsonIfExists(receiptPath);
  if (!receipt || auditProviderContainsCredentialMaterial(receipt)) {
    throw new Error('audit_provider_judge_invocation_receipt_invalid');
  }
  const transportEvidence = recordObject(receipt.transportEvidence);
  const expectedRequestedModel =
    input.expectedProviderBinding.model === null
      ? null
      : normalizeText(input.expectedProviderBinding.model);
  const receiptRequestedModel =
    receipt.requestedModel === null ? null : normalizeText(receipt.requestedModel);
  const observedModel =
    normalizeText(transportEvidence.observedModel) || normalizeText(transportEvidence.initModel);
  const receiptWithoutHash = { ...receipt };
  delete receiptWithoutHash.receiptHash;
  if (
    normalizeText(receipt.schemaVersion) !== 'audit-provider-judge-invocation-receipt/v1' ||
    normalizeText(receiptRef.contentHash) !== sha256File(receiptPath) ||
    normalizeText(receiptRef.receiptHash) !== normalizeText(receipt.receiptHash) ||
    normalizeText(receipt.receiptHash) !== sha256Json(receiptWithoutHash) ||
    normalizeText(receipt.requestHash) !== input.requestHash ||
    normalizeText(receipt.sourceDocumentHash) !== input.sourceDocumentHash ||
    normalizeText(receipt.sourceBytesHash) !== input.sourceBytesHash ||
    normalizeText(receipt.semanticModelHash) !== input.semanticModelHash ||
    normalizeText(receipt.projectionSetHash) !== input.projectionSetHash ||
    normalizeText(receipt.providerRunId) !== input.providerRunId ||
    normalizeText(receipt.providerId) !== input.expectedProviderBinding.providerId ||
    receiptRequestedModel !== expectedRequestedModel ||
    normalizeText(receipt.model) !== observedModel ||
    normalizeText(receipt.transport) !== input.expectedProviderBinding.transport ||
    normalizeText(receipt.adapterRef) !== input.expectedProviderBinding.adapterRef ||
    normalizeText(receipt.apiStyle) !== input.expectedProviderBinding.apiStyle ||
    normalizeText(receipt.configuredBaseUrlHash) !==
      input.expectedProviderBinding.configuredBaseUrlHash ||
    normalizeText(receipt.independenceClass) !== input.expectedProviderBinding.independenceClass ||
    normalizeText(receipt.providerRegistryHash) !==
      input.expectedProviderBinding.providerRegistryHash ||
    normalizeText(receipt.providerConfigurationHash) !==
      input.expectedProviderBinding.providerConfigurationHash ||
    normalizeText(receipt.transportEvidenceHash) !==
      sha256Json(transportEvidence) ||
    normalizeText(transportEvidence.adapterRef) !== input.expectedProviderBinding.adapterRef ||
    sha256Json(normalizeText(transportEvidence.command)) !==
      input.expectedProviderBinding.configuredBaseUrlHash ||
    normalizeText(transportEvidence.executorKind) !== 'native_spawn' ||
    Number(transportEvidence.exitCode) !== 0
  ) {
    throw new Error('audit_provider_judge_invocation_receipt_binding_mismatch');
  }
  return receipt;
}

function validateAuditProviderJudgeHostExecution(
  projectRoot: string,
  value: unknown
): Record<string, unknown> {
  const execution = recordObject(value);
  const stdoutPathValue = normalizeText(execution.stdoutPath);
  const stderrPathValue = normalizeText(execution.stderrPath);
  if (!stdoutPathValue || !stderrPathValue) {
    throw new Error('audit_provider_judge_host_execution_invalid');
  }
  const stdoutPath = resolveRootRelativePath(projectRoot, stdoutPathValue);
  const stderrPath = resolveRootRelativePath(projectRoot, stderrPathValue);
  if (
    normalizeText(execution.adapterKind) !== 'audit_provider_judge_invocation' ||
    !/^sha256:[a-f0-9]{64}$/u.test(normalizeText(execution.commandHash)) ||
    Number(execution.exitCode) !== 0 ||
    !fs.existsSync(stdoutPath) ||
    !fs.existsSync(stderrPath) ||
    normalizeText(execution.stdoutHash) !== sha256Text(fs.readFileSync(stdoutPath, 'utf8')) ||
    normalizeText(execution.stderrHash) !== sha256Text(fs.readFileSync(stderrPath, 'utf8'))
  ) {
    throw new Error('audit_provider_judge_host_execution_invalid');
  }
  return execution;
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

export function resolveCurrentCompiledPromptRefFromDispatchPointer(input: {
  authorityRoot: string;
  pointerPath: string;
  expected: CurrentDispatchPointerExpectedIdentity;
}): CompiledPromptRef {
  const { pointer, modelPacket } = resolveCurrentDispatchPointer(input);
  const implementationConfirmationHash = normalizeText(modelPacket.implementationConfirmationHash);
  const executionHandoff =
    modelPacket.executionHandoff &&
    typeof modelPacket.executionHandoff === 'object' &&
    !Array.isArray(modelPacket.executionHandoff)
      ? (modelPacket.executionHandoff as Record<string, unknown>)
      : null;
  const taskReportPath = normalizeText(executionHandoff?.taskReportPath);
  if (!implementationConfirmationHash) {
    throw new Error(
      'current_dispatch_pointer_model_packet_mismatch:implementationConfirmationHash'
    );
  }
  if (!taskReportPath) {
    throw new Error(
      'current_dispatch_pointer_model_packet_mismatch:executionHandoff.taskReportPath'
    );
  }
  return {
    modelPacketPath: pointer.modelPacketRef.path,
    modelPacketHash: pointer.modelPacketRef.hash,
    humanPromptPath: pointer.humanPromptRef.path,
    humanPromptHash: pointer.humanPromptRef.hash,
    auditReceiptPath: pointer.auditReceiptRef.path,
    auditReceiptHash: pointer.auditReceiptRef.hash,
    goalExecutionPath: pointer.goalExecutionRef?.path ?? null,
    goalExecutionHash: pointer.goalExecutionRef?.hash ?? null,
    taskReportPath: path.resolve(taskReportPath),
    sourceDocumentHash: pointer.sourceDocumentHash,
    implementationConfirmationHash,
  };
}

function isAuditTriadNoNewGapVerdict(verdict: AuditTriadJudgeVerdict): boolean {
  return verdict === 'no_new_valid_gap' || verdict === 'no_new_confirmation_blocking_gap';
}

function compiledModelPacketProjectionIdentity(row: Record<string, unknown>): string {
  return normalizeText(
    row.id ??
      row.taskId ??
      row.traceId ??
      row.commandId ??
      row.acceptanceId ??
      row.e2eId ??
      row.artifactId
  );
}

function compiledModelPacketProjectionInventory(packet: Record<string, unknown>): {
  projectionGroups: string[];
  projectionRefs: string[];
} {
  const projectionGroups = new Set<string>();
  const projectionRefs = new Set<string>();
  const visit = (value: unknown, pathSegments: string[]): void => {
    if (Array.isArray(value)) {
      const group = pathSegments.join('.');
      for (const item of value) {
        const row = recordObject(item);
        const identity = compiledModelPacketProjectionIdentity(row);
        if (identity && group) {
          projectionGroups.add(group);
          projectionRefs.add(identity);
          projectionRefs.add(`${group}:${identity}`);
        }
        if (Object.keys(row).length > 0) visit(row, pathSegments);
      }
      return;
    }
    const row = recordObject(value);
    for (const [key, child] of Object.entries(row)) {
      visit(child, [...pathSegments, key]);
    }
  };
  visit(packet, []);
  return {
    projectionGroups: [...projectionGroups].sort(),
    projectionRefs: [...projectionRefs].sort(),
  };
}

function compiledModelPacketMustAuthority(packet: Record<string, unknown>): {
  mustRefs: string[];
  sourceRequirementTexts: string[];
} {
  const requirements = recordObject(packet.requirements);
  const authorityByMustRef = new Map<string, string>();
  for (const row of asRecordArray(requirements.must)) {
    const mustRef = normalizeText(row.id);
    const sourceRequirementText = normalizeText(row.text);
    if (!mustRef || !sourceRequirementText) continue;
    authorityByMustRef.set(mustRef, sourceRequirementText);
  }
  return {
    mustRefs: [...authorityByMustRef.keys()],
    sourceRequirementTexts: [...authorityByMustRef.values()],
  };
}

export function resolveAuditJudgeRequestAuthorityBinding(input: {
  projectRoot: string;
  modelPacketPath: string;
  modelPacketHash: string;
  sourceDocumentHash: string;
  projectionSetHash: string;
}): {
  sourceDocument: string;
  sourceBytesHash: string;
  mustRefs: string[];
  sourceRequirementTexts: string[];
  packetProjectionSummary: {
    mustPacketCount: number;
    projectionGroups: string[];
    projectionRefs: string[];
  };
} {
  const projectRoot = path.resolve(input.projectRoot);
  const modelPacketPath = resolveRootRelativePath(projectRoot, input.modelPacketPath);
  const relativeModelPacketPath = path.relative(projectRoot, modelPacketPath);
  if (
    !input.modelPacketPath ||
    relativeModelPacketPath.startsWith('..') ||
    path.isAbsolute(relativeModelPacketPath)
  ) {
    throw new Error('audit_judge_model_packet_path_invalid');
  }
  if (!fs.existsSync(modelPacketPath) || !fs.statSync(modelPacketPath).isFile()) {
    throw new Error('audit_judge_model_packet_missing');
  }
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(input.modelPacketHash) ||
    sha256File(modelPacketPath) !== input.modelPacketHash
  ) {
    throw new Error('audit_judge_model_packet_hash_mismatch');
  }
  const packet = readJsonIfExists(modelPacketPath);
  if (!packet || normalizeText(packet.schemaVersion) !== 'req-trace-ai-tdd-model-packet/v1') {
    throw new Error('audit_judge_model_packet_schema_invalid');
  }
  const sourceDocument = normalizeText(packet.sourceDocument);
  if (!sourceDocument) {
    throw new Error('audit_judge_source_document_missing');
  }
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(input.sourceDocumentHash) ||
    normalizeText(packet.sourceDocumentHash) !== input.sourceDocumentHash
  ) {
    throw new Error('audit_judge_source_document_hash_mismatch');
  }
  const sourcePath = path.resolve(projectRoot, sourceDocument);
  const relativeSourcePath = path.relative(projectRoot, sourcePath);
  if (
    path.isAbsolute(sourceDocument) ||
    relativeSourcePath.startsWith('..') ||
    path.isAbsolute(relativeSourcePath)
  ) {
    throw new Error('audit_judge_source_document_path_invalid');
  }
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    throw new Error('audit_judge_source_document_missing');
  }
  const projectRealPath = fs.realpathSync(projectRoot);
  const sourceRealPath = fs.realpathSync(sourcePath);
  const relativeRealSourcePath = path.relative(projectRealPath, sourceRealPath);
  if (relativeRealSourcePath.startsWith('..') || path.isAbsolute(relativeRealSourcePath)) {
    throw new Error('audit_judge_source_document_realpath_escape');
  }
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extracted = extractRequirementsContractImplementationConfirmation(sourceText);
  if (
    sourceDocumentHashForContract(sourceText, extracted.blockText, extracted.value) !==
    input.sourceDocumentHash
  ) {
    throw new Error('audit_judge_source_document_hash_mismatch');
  }
  const mustAuthority = compiledModelPacketMustAuthority(packet);
  if (mustAuthority.mustRefs.length === 0) {
    throw new Error('audit_judge_must_refs_missing');
  }
  const projectionInventory = compiledModelPacketProjectionInventory(packet);
  if (
    projectionInventory.projectionGroups.length === 0 ||
    projectionInventory.projectionRefs.length === 0
  ) {
    throw new Error('audit_judge_projection_inventory_missing');
  }
  const derivedProjectionSetHash = projectionSetHashForContract(projectionInventory.projectionRefs);
  if (derivedProjectionSetHash !== input.projectionSetHash) {
    throw new Error('audit_judge_projection_set_hash_mismatch');
  }
  return {
    sourceDocument: relativeSourcePath.replace(/\\/gu, '/'),
    sourceBytesHash: sha256File(sourcePath),
    mustRefs: mustAuthority.mustRefs,
    sourceRequirementTexts: mustAuthority.sourceRequirementTexts,
    packetProjectionSummary: {
      mustPacketCount: mustAuthority.mustRefs.length,
      projectionGroups: projectionInventory.projectionGroups,
      projectionRefs: projectionInventory.projectionRefs,
    },
  };
}

function requirementsProjectionSetHash(packet: Record<string, unknown>): string {
  return projectionSetHashForContract(
    compiledModelPacketProjectionInventory(packet).projectionRefs
  );
}

function isExecutableTestPath(candidatePath: string): boolean {
  const normalized = candidatePath.replace(/\\/g, '/');
  return (
    /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs|py)$/iu.test(normalized) ||
    (/(?:^|\/)tests?\//iu.test(normalized) && /\.(?:ts|tsx|js|jsx|mjs|cjs|py)$/iu.test(normalized))
  );
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function resolveSkillScript(root: string, relativeScript: string): string {
  return resolveInstalledSkillPath(
    root,
    'requirements-contract-authoring',
    'scripts',
    relativeScript
  );
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
        message: 'Controlled user closeout acceptance is terminal; no pending packet is expected.',
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
  return Boolean(record && hasCurrentControlledCloseoutAcceptance(record));
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

function nativeGoalHandoffRequiresTaskReportImport(
  record: Record<string, unknown> | null
): boolean {
  const handoff =
    record?.nativeGoalHandoff &&
    typeof record.nativeGoalHandoff === 'object' &&
    !Array.isArray(record.nativeGoalHandoff)
      ? (record.nativeGoalHandoff as Record<string, unknown>)
      : null;
  const importStatus = normalizeText(handoff?.importStatus);
  return Boolean(
    handoff &&
    handoff.invoked === true &&
    handoff.imported !== true &&
    !['task_report_partial', 'task_report_blocked'].includes(importStatus)
  );
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
  const currentModelResult = modelResultFor(input.record, currentMentalModel);
  const nativeGoalAwaitingTaskReport = nativeGoalHandoffRequiresTaskReportImport(input.record);
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
  if (!input.record || normalizeText(input.record.status) !== 'user_confirmed') {
    blockingReasonRefs.push({
      sourceType: 'requirement_record',
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
  if (nativeGoalAwaitingTaskReport) {
    blockingReasonRefs.push({
      sourceType: 'native_goal_handoff',
      id: 'task_report_import_required',
    });
    return { nextAction: 'await_native_goal_task_report', ready: false, blockingReasonRefs };
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
  } else if (currentMentalModel === 'delivery_confirmation') {
    if (
      normalizeText(input.record?.status) === 'awaiting_user_acceptance' &&
      input.record &&
      hasCurrentCloseoutAcceptanceRequest(input.record, 'awaiting_user_acceptance')
    ) {
      return {
        nextAction: 'await_user_acceptance',
        ready: false,
        blockingReasonRefs,
      };
    }
    blockingReasonRefs.push({
      sourceType: 'closeout_acceptance',
      id: 'controlled_user_acceptance_required',
    });
    return { nextAction: 'run_closeout', ready: true, blockingReasonRefs };
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
  if (nativeGoalAwaitingTaskReport && executionClosurePass) {
    blockingReasonRefs.push({
      sourceType: 'native_goal_handoff',
      id: 'task_report_import_required',
    });
    return { nextAction: 'await_native_goal_task_report', ready: false, blockingReasonRefs };
  }
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
    normalizeText(requirementRecord?.currentAttemptId) ||
    normalizeText(requirementRecord?.implementationAttemptId) ||
    normalizeText(requirementRecord?.runId) ||
    scopedState.state?.pendingPacket?.packetId ||
    normalizeText(runtimeContext?.runId) ||
    normalizeText(requirementRecord?.requirementSetId) ||
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
    nativeGoalHandoffRequiresTaskReportImport(requirementRecord) ||
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
  const auditRepairCompletionReturnsToReview =
    Boolean(input.projectRoot) &&
    completedAuditRepairReturnsToReview({
      projectRoot: input.projectRoot!,
      record: requirementRecord,
      pendingPacketStatus,
      pendingPacket,
      state: scopedState.state,
    });
  const pendingAuditAfterVerifiedRepair =
    Boolean(input.projectRoot) &&
    sixModelRuntimeDecision?.currentMentalModel === 'audit_review' &&
    sixModelRuntimeDecision.currentModelStatus === 'blocked' &&
    sixModelRuntimeDecision.nextAction === 'dispatch_remediation' &&
    !controlPlaneBlocksSixModelOverride &&
    pendingAuditSupersedesBlockedReview({
      projectRoot: input.projectRoot!,
      stage: input.stage,
      record: requirementRecord,
      pendingPacketStatus,
      pendingPacket,
      state: scopedState.state,
    });
  const sixModelRuntimeDecisionAuthoritative =
    Boolean(sixModelRuntimeDecision?.currentMentalModel) &&
    sixModelRuntimeDecision?.nextAction !== 'record_closed' &&
    (sixModelRuntimeDecision?.nextAction === 'await_native_goal_task_report' ||
      !controlPlaneBlocksSixModelOverride) &&
    (sixModelRuntimeDecision?.nextAction === 'await_native_goal_task_report' ||
      !bridgePendingPacketRemainsAuthoritative) &&
    !bridgeImplementDispatchFallback &&
    !bridgeCompletedRemediationReturnsToImplement &&
    !auditRepairCompletionReturnsToReview &&
    !pendingAuditAfterVerifiedRepair;
  const fallbackActionNextAction = auditRepairCompletionReturnsToReview
    ? 'dispatch_review'
    : pendingAuditAfterVerifiedRepair
      ? 'dispatch_review'
      : bridgeImplementDispatchFallback
        ? 'dispatch_implement'
        : bridgeCompletedRemediationReturnsToImplement
          ? 'dispatch_implement'
          : bridgePendingPacketRemainsAuthoritative
            ? (scopedState.state?.nextAction ?? action.nextAction)
            : action.nextAction;
  const fallbackActionReady = pendingAuditAfterVerifiedRepair
    ? pendingPacketStatus === 'ready_for_main_agent'
    : auditRepairCompletionReturnsToReview ||
        bridgeImplementDispatchFallback ||
        bridgeCompletedRemediationReturnsToImplement
      ? true
      : bridgePendingPacketRemainsAuthoritative
        ? pendingPacketStatus === 'ready_for_main_agent'
        : action.ready;
  const actionNextAction =
    (sixModelRuntimeDecisionAuthoritative
      ? sixModelRuntimeDecision?.nextAction
      : fallbackActionNextAction) ?? null;
  const actionReady =
    (sixModelRuntimeDecisionAuthoritative ? sixModelRuntimeDecision?.ready : fallbackActionReady) ??
    null;
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

function auditRepairReceiptSupersedesPendingPacket(input: {
  projectRoot: string;
  record: Record<string, unknown> | null;
  packet: ExecutionPacket;
  currentRef: CompiledPromptRef;
  completionReport: Pick<TaskReport, 'status' | 'evidence'>;
}): boolean {
  if (input.completionReport.status !== 'done' || !input.packet.auditRepairContext) {
    return false;
  }
  const receipt = input.completionReport.evidence
    .map((evidenceRef) => resolveRootRelativePath(input.projectRoot, evidenceRef))
    .map((receiptPath) => ({
      receiptPath,
      receipt: readJsonIfExists(receiptPath),
    }))
    .find(
      (candidate) =>
        normalizeText(candidate.receipt?.schemaVersion) === 'audit-main-agent-repair-receipt/v1'
    );
  if (!receipt?.receipt) {
    return false;
  }
  const context = input.packet.auditRepairContext;
  const receiptHash = normalizeText(receipt.receipt.receiptHash);
  const { receiptHash: _ignoredReceiptHash, ...receiptWithoutHash } = receipt.receipt;
  const modelPacketRead = readModelPacketForCompiledRef(input.projectRoot, input.currentRef);
  const repairedProjectionSetHash = modelPacketRead.modelPacket
    ? requirementsProjectionSetHash(modelPacketRead.modelPacket)
    : '';
  const expectedRepairedTargetBundleHash = auditTargetBundleHashForCurrentProfile({
    projectRoot: input.projectRoot,
    sourceDocumentHash: input.currentRef.sourceDocumentHash,
    semanticModelHash: normalizeText(input.record?.semanticModelHash),
    implementationConfirmationHash: input.currentRef.implementationConfirmationHash,
    projectionSetHash: repairedProjectionSetHash,
    modelPacketHash: input.currentRef.modelPacketHash,
    auditReceiptHash: input.currentRef.auditReceiptHash,
    goalExecutionHash: input.currentRef.goalExecutionHash ?? null,
    priorRepairReceiptRefs: context.priorRepairReceiptRefs ?? [],
  });
  const feedbackRef = recordObject(receipt.receipt.feedbackDispatchRef);
  return (
    receiptHash === sha256Json(receiptWithoutHash) &&
    normalizeText(receipt.receipt.remediationPacketId) === input.packet.packetId &&
    normalizeText(receipt.receipt.sourceAuditEpochId) === context.sourceAuditEpochId &&
    normalizeText(receipt.receipt.sourceAuditTargetBundleHash) ===
      context.sourceAuditTargetBundleHash &&
    normalizeText(feedbackRef.dispatchHash) === context.feedbackDispatchRef.dispatchHash &&
    normalizeText(feedbackRef.contentHash) === context.feedbackDispatchRef.contentHash &&
    normalizeText(receipt.receipt.repairedSemanticModelHash) ===
      normalizeText(input.record?.semanticModelHash) &&
    normalizeText(receipt.receipt.repairedProjectionSetHash) === repairedProjectionSetHash &&
    normalizeText(receipt.receipt.repairedModelPacketHash) === input.currentRef.modelPacketHash &&
    normalizeText(receipt.receipt.repairedAuditReceiptHash) === input.currentRef.auditReceiptHash &&
    normalizeText(receipt.receipt.repairedGoalExecutionHash) ===
      normalizeText(input.currentRef.goalExecutionHash) &&
    normalizeText(receipt.receipt.repairedAuditTargetBundleHash) ===
      expectedRepairedTargetBundleHash &&
    stringsFrom(receipt.receipt.changedHashFields).length > 0 &&
    modelPacketRead.issueCodes.length === 0
  );
}

function auditRepairReceiptBindsCurrentPublication(input: {
  projectRoot: string;
  record: Record<string, unknown> | null;
  currentRef: CompiledPromptRef;
  remediationPacketId: string;
  ref: { path: string; contentHash: string };
}): boolean {
  const receiptPath = resolveRootRelativePath(input.projectRoot, input.ref.path);
  const relative = path.relative(input.projectRoot, receiptPath);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(receiptPath)) {
    return false;
  }
  const receiptText = fs.readFileSync(receiptPath, 'utf8');
  if (sha256Text(receiptText) !== input.ref.contentHash) {
    return false;
  }
  let receipt: Record<string, unknown>;
  try {
    receipt = JSON.parse(receiptText) as Record<string, unknown>;
  } catch {
    return false;
  }
  if (normalizeText(receipt.schemaVersion) !== 'audit-main-agent-repair-receipt/v1') {
    return false;
  }
  const receiptHash = normalizeText(receipt.receiptHash);
  const { receiptHash: _ignoredReceiptHash, ...receiptWithoutHash } = receipt;
  const modelPacketRead = readModelPacketForCompiledRef(input.projectRoot, input.currentRef);
  if (!modelPacketRead.modelPacket || modelPacketRead.issueCodes.length > 0) {
    return false;
  }
  const semanticModelHash = normalizeText(input.record?.semanticModelHash);
  const projectionSetHash = requirementsProjectionSetHash(modelPacketRead.modelPacket);
  const qualityRuleCodes = [...AUDIT_PROJECTION_QUALITY_RULE_CODES].sort();
  const qualityRuleSetHash = sha256AuditTriadJson(qualityRuleCodes);
  const priorRepairReceiptRefs = Array.isArray(receipt.priorRepairReceiptRefs)
    ? receipt.priorRepairReceiptRefs.map((value) => {
        const ref = recordObject(value);
        return {
          path: normalizeText(ref.path),
          contentHash: normalizeText(ref.contentHash),
        };
      })
    : [];
  if (
    priorRepairReceiptRefs.some(
      (ref) => !ref.path || !/^sha256:[a-f0-9]{64}$/u.test(ref.contentHash)
    )
  ) {
    return false;
  }
  const expectedTargetBundleHash = auditTargetBundleHashForCurrentProfile({
    projectRoot: input.projectRoot,
    sourceDocumentHash: input.currentRef.sourceDocumentHash,
    semanticModelHash,
    implementationConfirmationHash: input.currentRef.implementationConfirmationHash,
    projectionSetHash,
    modelPacketHash: input.currentRef.modelPacketHash,
    auditReceiptHash: input.currentRef.auditReceiptHash,
    goalExecutionHash: input.currentRef.goalExecutionHash ?? null,
    priorRepairReceiptRefs,
  });
  return (
    receiptHash === sha256Json(receiptWithoutHash) &&
    normalizeText(receipt.recordId) === normalizeText(input.record?.recordId) &&
    normalizeText(receipt.requirementSetId) === normalizeText(input.record?.requirementSetId) &&
    normalizeText(receipt.remediationPacketId) === input.remediationPacketId &&
    normalizeText(receipt.repairedSemanticModelHash) === semanticModelHash &&
    normalizeText(receipt.repairedProjectionSetHash) === projectionSetHash &&
    normalizeText(receipt.qualityRuleSetHash) === qualityRuleSetHash &&
    normalizeText(receipt.repairedModelPacketHash) === input.currentRef.modelPacketHash &&
    normalizeText(receipt.repairedAuditReceiptHash) === input.currentRef.auditReceiptHash &&
    normalizeText(receipt.repairedGoalExecutionHash) ===
      normalizeText(input.currentRef.goalExecutionHash) &&
    normalizeText(receipt.repairedAuditTargetBundleHash) === expectedTargetBundleHash &&
    stringsFrom(receipt.changedHashFields).length > 0
  );
}

function pendingAuditSupersedesBlockedReview(input: {
  projectRoot: string;
  stage: string;
  record: Record<string, unknown> | null;
  pendingPacketStatus: MainAgentPendingPacketStatus;
  pendingPacket: RecommendationPacket | ExecutionPacket | ResumePacket | null;
  state: OrchestrationState | null;
}): boolean {
  if (
    !input.record ||
    !input.pendingPacket ||
    packetTaskType(input.pendingPacket) !== 'audit' ||
    !(
      input.pendingPacketStatus === 'ready_for_main_agent' ||
      input.pendingPacketStatus === 'claimed_by_main_agent' ||
      input.pendingPacketStatus === 'dispatched'
    ) ||
    input.state?.nextAction !== 'dispatch_review' ||
    input.state.lastTaskReport?.status !== 'done' ||
    !normalizeText(input.state.lastTaskReport.packetId) ||
    input.state.lastTaskReport.packetId === input.pendingPacket.packetId ||
    normalizeText(input.state.pendingPacket?.packetId) !== input.pendingPacket.packetId ||
    !('compiledPromptRef' in input.pendingPacket) ||
    !input.pendingPacket.compiledPromptRef ||
    !input.pendingPacket.auditExecutionProfile ||
    !input.pendingPacket.auditTriadExecutionPlanRef
  ) {
    return false;
  }
  let currentRef: CompiledPromptRef;
  let repairReceiptRefs: Array<{ path: string; contentHash: string }>;
  try {
    currentRef = currentCompiledPromptRefFromDispatchPointer({
      projectRoot: input.projectRoot,
      record: input.record,
    });
    repairReceiptRefs = readAuditRepairReceiptRefsFromState(input.projectRoot, input.state);
  } catch {
    return false;
  }
  if (
    compiledPendingPacketBindingMismatch(input.pendingPacket, currentRef, 'audit') ||
    repairReceiptRefs.length === 0 ||
    !repairReceiptRefs.every((ref) =>
      auditRepairReceiptBindsCurrentPublication({
        projectRoot: input.projectRoot,
        record: input.record,
        currentRef,
        remediationPacketId: input.state!.lastTaskReport!.packetId,
        ref,
      })
    )
  ) {
    return false;
  }
  const planRef = input.pendingPacket.auditTriadExecutionPlanRef;
  const planPath = path.resolve(planRef.path);
  const relativePlanPath = path.relative(input.projectRoot, planPath);
  if (
    relativePlanPath.startsWith('..') ||
    path.isAbsolute(relativePlanPath) ||
    !fs.existsSync(planPath)
  ) {
    return false;
  }
  const planText = fs.readFileSync(planPath, 'utf8');
  if (sha256Text(planText) !== planRef.contentHash) {
    return false;
  }
  let plan: AuditTriadExecutionPlan;
  try {
    plan = JSON.parse(planText) as AuditTriadExecutionPlan;
  } catch {
    return false;
  }
  const modelPacketRead = readModelPacketForCompiledRef(input.projectRoot, currentRef);
  if (!modelPacketRead.modelPacket || modelPacketRead.issueCodes.length > 0) {
    return false;
  }
  const semanticModelHash = normalizeText(input.record.semanticModelHash);
  const projectionSetHash = requirementsProjectionSetHash(modelPacketRead.modelPacket);
  const qualityRuleCodes = [...AUDIT_PROJECTION_QUALITY_RULE_CODES].sort();
  const qualityRuleSetHash = sha256AuditTriadJson(qualityRuleCodes);
  const expectedTargetBundleHash = auditTargetBundleHashForCurrentProfile({
    projectRoot: input.projectRoot,
    sourceDocumentHash: currentRef.sourceDocumentHash,
    semanticModelHash,
    implementationConfirmationHash: currentRef.implementationConfirmationHash,
    projectionSetHash,
    modelPacketHash: currentRef.modelPacketHash,
    auditReceiptHash: currentRef.auditReceiptHash,
    goalExecutionHash: currentRef.goalExecutionHash ?? null,
    priorRepairReceiptRefs: repairReceiptRefs,
  });
  let expectedPlan: AuditTriadExecutionPlan;
  try {
    expectedPlan = createAuditTriadExecutionPlan({
      projectRoot: input.projectRoot,
      recordId: normalizeText(input.record.recordId),
      stage: input.stage,
      callPoint: 'audit_review',
      attemptId: input.pendingPacket.packetId,
      sourceDocumentHash: currentRef.sourceDocumentHash,
      semanticModelHash,
      implementationConfirmationHash: currentRef.implementationConfirmationHash,
      projectionSetHash,
      modelPacketHash: currentRef.modelPacketHash,
      auditReceiptHash: currentRef.auditReceiptHash,
      goalExecutionHash: currentRef.goalExecutionHash ?? null,
      currentAttemptHash: sha256Text(input.pendingPacket.packetId),
      currentEvidenceHash: sha256Text(
        [
          currentRef.modelPacketHash,
          currentRef.auditReceiptHash,
          currentRef.goalExecutionHash ?? 'no-goal',
        ].join('|')
      ),
      priorRepairReceiptRefs: repairReceiptRefs,
    });
  } catch {
    return false;
  }
  const profile = input.pendingPacket.auditExecutionProfile;
  return (
    sha256Json(plan) === sha256Json(expectedPlan) &&
    plan.schemaVersion === 'audit-triad-execution-plan/v1' &&
    plan.attemptId === input.pendingPacket.packetId &&
    planRef.attemptId === plan.attemptId &&
    plan.sourceDocumentHash === currentRef.sourceDocumentHash &&
    plan.semanticModelHash === semanticModelHash &&
    plan.implementationConfirmationHash === currentRef.implementationConfirmationHash &&
    plan.projectionSetHash === projectionSetHash &&
    sha256Json(plan.checkedProjectionQualityRuleCodes) === sha256Json(qualityRuleCodes) &&
    plan.qualityRuleSetHash === qualityRuleSetHash &&
    normalizeText(plan.modelPacketHash) === currentRef.modelPacketHash &&
    normalizeText(plan.auditReceiptHash) === currentRef.auditReceiptHash &&
    normalizeText(plan.goalExecutionHash) === normalizeText(currentRef.goalExecutionHash) &&
    sha256Json(plan.priorRepairReceiptRefs) === sha256Json(repairReceiptRefs) &&
    plan.auditTargetBundleHash === expectedTargetBundleHash &&
    planRef.auditEpochId === plan.auditEpochId &&
    planRef.auditTargetBundleHash === plan.auditTargetBundleHash &&
    planRef.semanticModelHash === plan.semanticModelHash &&
    planRef.projectionSetHash === plan.projectionSetHash &&
    planRef.qualityRuleSetHash === plan.qualityRuleSetHash &&
    profile.auditEpochId === plan.auditEpochId &&
    profile.auditTargetBundleHash === plan.auditTargetBundleHash &&
    profile.semanticModelHash === plan.semanticModelHash &&
    profile.projectionSetHash === plan.projectionSetHash &&
    profile.qualityRuleSetHash === plan.qualityRuleSetHash
  );
}

function assertPendingPacketCurrentDispatchPointer(
  projectRoot: string,
  sessionId: string,
  packetId?: string,
  completionReport?: TaskReport
): void {
  const state = readOrchestrationState(projectRoot, sessionId);
  const pending = state?.pendingPacket;
  if (!pending || (packetId && pending.packetId !== packetId)) return;
  const packet = readPendingPacketPayload(state);
  if (!packet) {
    throw new Error('pending_packet_payload_missing_or_invalid');
  }
  if (
    !('authorityMode' in packet) ||
    packet.authorityMode !== 'compiled_implementation_confirmation'
  ) {
    return;
  }
  const record = readActiveRequirementRecordForDispatch(projectRoot, null);
  const taskType = packetTaskType(packet);
  if (taskType !== 'implement' && taskType !== 'audit' && taskType !== 'remediate') {
    throw new Error('pending_packet_payload_missing_or_invalid');
  }
  const pointerBoundTaskType: PointerBoundTaskType = taskType;
  const currentRef = currentCompiledPromptRefFromDispatchPointer({
    projectRoot,
    record,
  });
  const mismatch = compiledPendingPacketBindingMismatch(packet, currentRef, pointerBoundTaskType);
  if (mismatch) {
    if (
      pointerBoundTaskType === 'remediate' &&
      'auditRepairContext' in packet &&
      packet.auditRepairContext &&
      currentRef &&
      completionReport &&
      auditRepairReceiptSupersedesPendingPacket({
        projectRoot,
        record,
        packet,
        currentRef,
        completionReport,
      })
    ) {
      return;
    }
    throw new Error(
      `${pointerBoundTaskType}_pending_packet_current_dispatch_pointer_mismatch:${mismatch}`
    );
  }
}

export function claimMainAgentPendingPacket(
  projectRoot: string,
  sessionId: string,
  owner = 'main-agent'
): OrchestrationState {
  assertPendingPacketCurrentDispatchPointer(projectRoot, sessionId);
  return claimPendingPacket(projectRoot, sessionId, owner);
}

export function markMainAgentPacketDispatched(
  projectRoot: string,
  sessionId: string,
  packetId: string
): OrchestrationState {
  assertPendingPacketCurrentDispatchPointer(projectRoot, sessionId, packetId);
  return markPendingPacketDispatched(projectRoot, sessionId, packetId);
}

export function completeMainAgentPendingPacket(
  projectRoot: string,
  sessionId: string,
  packetId: string,
  completionReport?: TaskReport
): OrchestrationState {
  assertPendingPacketCurrentDispatchPointer(projectRoot, sessionId, packetId, completionReport);
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
    nativeGoalProvenanceValidated?: boolean;
    authoritativeNextActionHint?: boolean;
    expectedRequirementRecordHash?: string;
  } = {}
): OrchestrationState {
  const state = readOrchestrationState(projectRoot, sessionId);
  if (!state) {
    throw new Error(`Main-agent ingestion failed: session not found (${sessionId})`);
  }
  let boundRuntimeContext: ReturnType<typeof loadRuntimeContextForMainAgent> | null = null;
  let boundRequirementRecord: ReturnType<typeof readRequirementRecordFromRuntimeContext> | null =
    null;
  if (options.expectedRequirementRecordHash) {
    boundRuntimeContext = loadRuntimeContextForMainAgent({
      projectRoot,
      flow: state.flow as RuntimeFlowId,
      stage: options.currentStage ?? state.currentPhase,
    });
    const requirementRecord = readRequirementRecordFromRuntimeContext(boundRuntimeContext);
    if (!requirementRecord) {
      throw new Error('task_report_ingest_requirement_record_missing');
    }
    boundRequirementRecord = requirementRecord;
    if (
      normalizeText(boundRequirementRecord.recordHash) !== options.expectedRequirementRecordHash
    ) {
      throw new Error('task_report_ingest_requirement_record_hash_mismatch');
    }
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
  const requiresNativeGoalProvenance =
    (state.host === 'codex' || state.host === 'claude') &&
    packet &&
    'taskType' in packet &&
    packet.taskType === 'implement' &&
    packet.authorityMode === 'compiled_implementation_confirmation' &&
    packet.compiledPromptRef?.goalExecutionHash &&
    dispatchPacketGoalCommandMode(packet) === 'native_goal_document_ref';
  if (requiresNativeGoalProvenance && options.nativeGoalProvenanceValidated !== true) {
    throw new Error('native_goal_task_report_provenance_required');
  }

  const legacyNextAction =
    options.nextActionHint ??
    (report.status === 'done'
      ? deriveNextActionFromTaskType(taskType, options.currentStage ?? state.currentPhase)
      : deriveNextActionFromFailedTaskType(taskType, report.status));

  if (report.status === 'done') {
    completeMainAgentPendingPacket(projectRoot, sessionId, report.packetId, report);
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
  const runtimeContext =
    boundRuntimeContext ??
    loadRuntimeContextForMainAgent({
      projectRoot,
      flow: evidenceState.flow as RuntimeFlowId,
      stage: options.currentStage ?? evidenceState.currentPhase,
    });
  const requirementRecord =
    boundRequirementRecord ?? readRequirementRecordFromRuntimeContext(runtimeContext);
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
  const keepAuthoritativeTransition =
    options.authoritativeNextActionHint === true && options.nextActionHint != null;
  if (
    !keepLegacyTransition &&
    !keepAuthoritativeTransition &&
    legacyNextAction !== matrix.nextAction
  ) {
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
    nextAction: (keepLegacyTransition || keepAuthoritativeTransition
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
  const taskType = taskTypeFromNextAction(currentSurface.mainAgentNextAction);
  const auditDispatchRequested =
    taskType === 'audit' ||
    (taskType === null && normalizeText(input.preferredPacketId).startsWith('audit-'));
  const activeDispatchRecord = input.projectRoot
    ? readActiveRequirementRecordForDispatch(input.projectRoot, runtimeContext)
    : null;
  const pointerBoundTaskType = pointerBoundTaskTypeFor(taskType, activeDispatchRecord);
  const currentCompiledPromptRef =
    (pointerBoundTaskType !== null || auditDispatchRequested) && input.projectRoot
      ? currentCompiledPromptRefFromDispatchPointer({
          projectRoot: input.projectRoot,
          record: activeDispatchRecord,
        })
      : null;
  const reusablePendingPacket =
    currentSurface.pendingPacketStatus !== 'none' &&
    currentSurface.pendingPacketStatus !== 'missing_packet_file' &&
    currentSurface.pendingPacketStatus !== 'completed' &&
    currentSurface.pendingPacketStatus !== 'invalidated' &&
    pendingPacketMatchesNextAction(currentSurface);
  if (reusablePendingPacket) {
    if (!pointerBoundTaskType) {
      return currentSurface;
    }
    if (!currentCompiledPromptRef) {
      return currentSurface;
    }
    if (
      compiledPendingPacketBindingMismatch(
        currentSurface.pendingPacket,
        currentCompiledPromptRef,
        pointerBoundTaskType
      ) === null
    ) {
      return currentSurface;
    }
  }
  if (!input.projectRoot) {
    return currentSurface;
  }

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
  const auditRepairContext =
    taskType === 'remediate'
      ? readAuditRepairContextFromState(
          input.projectRoot,
          currentSurface.orchestrationState ?? null
        )
      : null;
  const inputArtifacts = [
    normalizeText(runtimeContext?.artifactPath),
    normalizeText(runtimeContext?.artifactRoot),
    normalizeText(currentSurface.closeout?.artifactPath),
    normalizeText(currentSurface.closeout?.reportPath),
    auditRepairContext?.feedbackDispatchRef.path ?? '',
  ].filter(
    (artifactPath, index, values) => Boolean(artifactPath) && values.indexOf(artifactPath) === index
  );
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
  const activeRecord =
    activeDispatchRecord ?? readRequirementRecordFromRuntimeContext(runtimeContext);
  const dispatchCompiledPromptRef = pointerBoundTaskType ? currentCompiledPromptRef : null;
  const auditExecution =
    taskType === 'audit' && dispatchCompiledPromptRef
      ? writeAuditExecutionProfile({
          projectRoot: input.projectRoot,
          ...(recordPath ? { recordPath } : {}),
          recordId: normalizeText(activeRecord?.recordId) || sessionId,
          requirementSetId: normalizeText(activeRecord?.requirementSetId) || sessionId,
          attemptId: packetId,
          stage: input.stage,
          semanticModelHash: normalizeText(activeRecord?.semanticModelHash),
          compiledPromptRef: dispatchCompiledPromptRef,
          priorRepairReceiptRefs: readAuditRepairReceiptRefsFromState(
            input.projectRoot,
            currentSurface.orchestrationState ?? null
          ),
        })
      : null;
  const runtimeModeSelection =
    taskType === 'implement' && dispatchCompiledPromptRef
      ? writeExecutionRuntimeModeSelection({
          projectRoot: input.projectRoot,
          recordId: normalizeText(activeRecord?.recordId) || sessionId,
          packetId,
          attemptId: packetId,
          host,
          compiledPromptRef: dispatchCompiledPromptRef,
        })
      : null;
  if (runtimeModeSelection && dispatchCompiledPromptRef) {
    const nativeGoalBlocker = validateNativeGoalReadiness({
      projectRoot: input.projectRoot,
      recordId: normalizeText(activeRecord?.recordId) || sessionId,
      packetId,
      attemptId: packetId,
      host,
      compiledPromptRef: dispatchCompiledPromptRef,
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
  const nativeCompiledRefMissing =
    isNativeImplementHost(host, taskType) &&
    dispatchCompiledPromptRef &&
    (!dispatchCompiledPromptRef.goalExecutionPath ||
      !dispatchCompiledPromptRef.goalExecutionHash ||
      !dispatchCompiledPromptRef.taskReportPath);
  const executionStrategy =
    (taskType === 'implement' || taskType === 'remediate') && dispatchCompiledPromptRef
      ? ensurePolicyDefaultExecutionStrategy({
          compiledPromptRef: dispatchCompiledPromptRef,
          campaignRuntimeBindingRef: currentCampaignRuntimeBindingRefFromDispatchPointer({
            projectRoot: input.projectRoot,
            record: activeRecord,
          }),
        })
      : null;
  const campaignRuntimeBindingRef =
    dispatchCompiledPromptRef && (taskType === 'implement' || taskType === 'remediate')
      ? currentCampaignRuntimeBindingRefFromDispatchPointer({
          projectRoot: input.projectRoot,
          record: activeRecord,
        })
      : null;
  const sddArtifactManifestRef =
    taskType === 'implement' && dispatchCompiledPromptRef
      ? writeEmptySddArtifactManifestRef({
          projectRoot: input.projectRoot,
          recordPath,
          compiledPromptRef: dispatchCompiledPromptRef,
          packetId,
          sessionId,
          flow,
        })
      : null;
  const packet =
    pointerBoundTaskType === null &&
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
          authorityMode: pointerBoundTaskType
            ? 'compiled_implementation_confirmation'
            : 'legacy_generic_prompt',
          compiledPromptRef: dispatchCompiledPromptRef,
          executionDisciplineProfile,
          executionStrategy,
          campaignRuntimeBindingRef,
          sddArtifactManifestRef,
          auditExecutionProfile: auditExecution?.profile ?? null,
          auditTriadExecutionPlanRef: auditExecution?.triadRef ?? null,
          auditRepairContext,
          legacyPromptFallbackReason: pointerBoundTaskType ? null : 'no_confirmed_source',
          compilerBlock:
            pointerBoundTaskType && !dispatchCompiledPromptRef
              ? [`${pointerBoundTaskType}_current_attempt_compiledPromptRef_missing`]
              : nativeCompiledRefMissing
                ? ['native_goal_compiled_ref_missing']
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
    resumeInFlightAudit?: boolean;
  }
): MainAgentDispatchInstruction | null {
  const surface = input.hydratePacket
    ? ensureMainAgentDispatchPacket(input)
    : resolveMainAgentOrchestrationSurface(input);
  const nextAction = surface.mainAgentNextAction;
  const taskType = taskTypeFromNextAction(nextAction);
  const resumesInFlightAudit =
    input.resumeInFlightAudit === true &&
    taskType === 'audit' &&
    (surface.pendingPacketStatus === 'claimed_by_main_agent' ||
      surface.pendingPacketStatus === 'dispatched');
  if (!nextAction || !taskType || (!surface.mainAgentReady && !resumesInFlightAudit)) {
    return null;
  }
  if (!surface.pendingPacket || !surface.orchestrationState?.pendingPacket?.packetPath) {
    return null;
  }
  if (!pendingPacketDispatchable(surface.pendingPacket)) {
    return null;
  }
  const runtimeContext = input.projectRoot ? loadRuntimeContextForMainAgent(input) : null;
  const activeDispatchRecord = input.projectRoot
    ? readActiveRequirementRecordForDispatch(input.projectRoot, runtimeContext)
    : null;
  const pointerBoundTaskType = pointerBoundTaskTypeFor(taskType, activeDispatchRecord);
  if (pointerBoundTaskType) {
    if (!input.projectRoot) {
      throw new Error('current_dispatch_pointer_expected_identity_missing:authorityRoot');
    }
    const currentRef = currentCompiledPromptRefFromDispatchPointer({
      projectRoot: input.projectRoot,
      record: activeDispatchRecord,
    });
    const mismatch = currentRef
      ? compiledPendingPacketBindingMismatch(
          surface.pendingPacket,
          currentRef,
          pointerBoundTaskType
        )
      : 'compiledPromptRef';
    if (mismatch) {
      throw new Error(
        `${pointerBoundTaskType}_pending_packet_current_dispatch_pointer_mismatch:${mismatch}`
      );
    }
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
  'import-native-goal-task-report',
  'run-loop',
  'controlled-closeout',
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

function normalizeSlashPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
}

function globToRegExp(glob: string): RegExp {
  const normalized = normalizeSlashPath(glob);
  let pattern = '';
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '*' && next === '*') {
      pattern += '.*';
      index += 1;
    } else if (char === '*') {
      pattern += '[^/]*';
    } else {
      pattern += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`, 'u');
}

function pathMatchesAllowedScope(filePath: string, scopes: string[]): boolean {
  const normalized = normalizeSlashPath(filePath);
  return scopes.some((scope) => globToRegExp(scope).test(normalized));
}

function readJsonObjectFile(filePath: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readModelPacketForCompiledRef(
  projectRoot: string,
  compiledPromptRef: CompiledPromptRef | null | undefined
): {
  modelPacket: Record<string, unknown> | null;
  issueCodes: string[];
} {
  const modelPacketPath = normalizeText(compiledPromptRef?.modelPacketPath);
  if (!modelPacketPath) {
    return { modelPacket: null, issueCodes: ['model_packet_path_missing'] };
  }
  const expectedHash = normalizeText(compiledPromptRef?.modelPacketHash);
  if (!/^sha256:[a-f0-9]{64}$/u.test(expectedHash)) {
    return { modelPacket: null, issueCodes: ['model_packet_hash_invalid'] };
  }
  const root = path.resolve(projectRoot);
  const absolute = path.isAbsolute(modelPacketPath)
    ? modelPacketPath
    : path.resolve(root, modelPacketPath);
  const resolved = path.resolve(absolute);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    return { modelPacket: null, issueCodes: ['model_packet_path_outside_project'] };
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return { modelPacket: null, issueCodes: ['model_packet_missing'] };
  }
  const bytes = fs.readFileSync(resolved);
  const observedHash = `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
  if (observedHash !== expectedHash) {
    return { modelPacket: null, issueCodes: ['model_packet_hash_mismatch'] };
  }
  const modelPacket = readJsonObjectFile(resolved);
  return modelPacket
    ? { modelPacket, issueCodes: [] }
    : { modelPacket: null, issueCodes: ['model_packet_schema_invalid'] };
}

export function buildNativeGoalImportReturnMetadata(taskReportPath: string): {
  returnCommand: 'bmad-speckit';
  returnArgv: string[];
} {
  return {
    returnCommand: 'bmad-speckit',
    returnArgv: [
      'main-agent-orchestration',
      '--action',
      'import-native-goal-task-report',
      '--taskReportPath',
      taskReportPath,
    ],
  };
}

function isNativeImplementHost(host: OrchestrationHost, taskType: OrchestrationTaskType): boolean {
  return taskType === 'implement' && (host === 'codex' || host === 'claude');
}

function recordNativeGoalHandoff(input: {
  projectRoot: string;
  recordPath?: string | null;
  sessionId: string;
  orchestrationStatePath: string;
  host: OrchestrationHost;
  packet: RecommendationPacket | ExecutionPacket | ResumePacket;
  packetPath: string;
  modelPacket?: Record<string, unknown> | null;
  invocationReceiptPath?: string | null;
  invoked?: boolean;
  imported?: boolean;
  importStatus?: string;
  closeoutAttemptId?: string;
  taskReportCandidatePath?: string;
  taskReportArtifactHash?: string;
  controlledCloseoutIngested?: boolean;
  controlledCloseout?: NativeGoalInvocationResult['controlledCloseout'];
}): Record<string, unknown> | null {
  if (!input.recordPath || !fs.existsSync(input.recordPath)) return null;
  if (!('taskType' in input.packet) || input.packet.taskType !== 'implement') return null;
  const compiledPromptRef = input.packet.compiledPromptRef;
  if (!compiledPromptRef?.goalExecutionPath || !compiledPromptRef.goalExecutionHash) return null;
  const taskReportPath = normalizeText(compiledPromptRef.taskReportPath);
  if (!taskReportPath) return null;
  const record = readJsonIfExists(input.recordPath);
  if (!record) return null;
  const receipt = readJsonObjectFile(compiledPromptRef.auditReceiptPath);
  const generatorReceipt = receipt ? resolveGeneratorAuditReceipt(receipt) : null;
  const goalCommand =
    generatorReceipt?.goalCommand &&
    typeof generatorReceipt.goalCommand === 'object' &&
    !Array.isArray(generatorReceipt.goalCommand)
      ? (generatorReceipt.goalCommand as Record<string, unknown>)
      : {};
  const commandText =
    normalizeText(goalCommand.commandText) ||
    normalizeText(
      (generatorReceipt?.continuationDirective as Record<string, unknown> | undefined)?.directive
    );
  const attemptBundle = nativeGoalAttemptBundleFromCurrentPointer({
    projectRoot: input.projectRoot,
    record,
    compiledPromptRef,
  });
  const returnMetadata = buildNativeGoalImportReturnMetadata(taskReportPath);
  const invocationReceiptPath = normalizeText(input.invocationReceiptPath);
  const handoff = {
    schemaVersion: 'native-goal-handoff/v1',
    recordId: normalizeText(record.recordId) || input.packet.parentSessionId,
    sessionId: input.sessionId,
    orchestrationStatePath: input.orchestrationStatePath,
    packetId: input.packet.packetId,
    packetPath: input.packetPath,
    dispatchHost: input.host,
    runtimeHost: input.host === 'claude' ? 'claude-code-cli' : input.host,
    renderedHostLabel: input.host === 'claude' ? 'claude-code' : input.host,
    modelPacketPath: compiledPromptRef.modelPacketPath,
    goalExecutionPath: compiledPromptRef.goalExecutionPath,
    goalExecutionHash: compiledPromptRef.goalExecutionHash,
    taskReportPath,
    taskReportHash: fs.existsSync(taskReportPath) ? sha256File(taskReportPath) : null,
    goalCommand: commandText,
    returnAction: 'import-native-goal-task-report',
    ...returnMetadata,
    sourceDocumentHash: compiledPromptRef.sourceDocumentHash,
    implementationConfirmationHash: compiledPromptRef.implementationConfirmationHash,
    modelPacketHash: compiledPromptRef.modelPacketHash,
    auditReceiptHash: compiledPromptRef.auditReceiptHash,
    transactionManifestPath: attemptBundle.transactionManifestPath,
    transactionManifestHash: attemptBundle.transactionManifestHash,
    currentDispatchPointerPath: attemptBundle.currentDispatchPointerPath,
    currentDispatchPointerHash: attemptBundle.currentDispatchPointerHash,
    invocationReceiptPath: invocationReceiptPath || null,
    invocationReceiptHash:
      invocationReceiptPath && fs.existsSync(invocationReceiptPath)
        ? sha256File(invocationReceiptPath)
        : null,
    requiredCommands: requiredCommandIdsFromModelPacket(input.modelPacket ?? null),
    invoked: input.invoked === true || input.imported === true,
    imported: input.imported === true,
    importStatus: input.importStatus ?? (input.imported ? 'imported' : 'awaiting_task_report'),
    ...(input.closeoutAttemptId ? { closeoutAttemptId: input.closeoutAttemptId } : {}),
    ...(input.taskReportCandidatePath
      ? { taskReportCandidatePath: input.taskReportCandidatePath }
      : {}),
    ...(input.taskReportArtifactHash
      ? { taskReportArtifactHash: input.taskReportArtifactHash }
      : {}),
    ...(input.controlledCloseoutIngested === true ? { controlledCloseoutIngested: true } : {}),
    ...(input.controlledCloseout ? { controlledCloseout: input.controlledCloseout } : {}),
  };
  const recordedAt = new Date().toISOString();
  appendControlEventAndReplay({
    recordPath: input.recordPath,
    writerId: 'main-agent-orchestration',
    eventType: 'native_goal_handoff_recorded',
    payload: {
      eventType: 'native_goal_handoff_recorded',
      recordId: handoff.recordId,
      requirementSetId: normalizeText(record.requirementSetId) || input.sessionId,
      packetId: handoff.packetId,
      nativeGoalHandoff: handoff,
      recordedAt,
      recordedBy: 'main-agent-orchestration',
    },
    recordedAt,
    reduce: (current) => ({
      ...current,
      currentMentalModel:
        normalizeText(current.currentMentalModel) === 'implementation_readiness'
          ? 'execution_closure'
          : current.currentMentalModel,
      nativeGoalHandoff: handoff,
      lastEventType: 'native_goal_handoff_recorded',
      updatedAt: recordedAt,
    }),
  });
  return handoff;
}

function dispatchPacketGoalCommandMode(packet: ExecutionPacket): string {
  const receiptPath = normalizeText(packet.compiledPromptRef?.auditReceiptPath);
  if (!receiptPath || !fs.existsSync(receiptPath)) return '';
  try {
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as Record<string, unknown>;
    const generatorReceipt = resolveGeneratorAuditReceipt(receipt);
    const goalCommand =
      generatorReceipt.goalCommand && typeof generatorReceipt.goalCommand === 'object'
        ? (generatorReceipt.goalCommand as Record<string, unknown>)
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
    } else if (
      (token === '--implementation-attempt-id' || token === '--implementationAttemptId') &&
      argv[index + 1]
    ) {
      out.implementationAttemptId = argv[++index];
    } else if ((token === '--session-id' || token === '--sessionId') && argv[index + 1]) {
      out.sessionId = argv[++index];
    } else if ((token === '--session-turn-id' || token === '--sessionTurnId') && argv[index + 1]) {
      out.sessionTurnId = argv[++index];
    } else if (
      (token === '--session-message-id' || token === '--sessionMessageId') &&
      argv[index + 1]
    ) {
      out.sessionMessageId = argv[++index];
    } else if (
      (token === '--session-actor-identity-class' || token === '--sessionActorIdentityClass') &&
      argv[index + 1]
    ) {
      out.sessionActorIdentityClass = argv[++index];
    } else if ((token === '--session-branch' || token === '--sessionBranch') && argv[index + 1]) {
      out.sessionBranch = argv[++index];
    } else if (
      (token === '--session-captured-at' || token === '--sessionCapturedAt') &&
      argv[index + 1]
    ) {
      out.sessionCapturedAt = argv[++index];
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
    } else if ((token === '--entry-source' || token === '--entrySource') && argv[index + 1]) {
      out.entrySource = argv[++index];
    } else if ((token === '--target-path' || token === '--targetPath') && argv[index + 1]) {
      appendArg('targetPath', argv[++index]);
    } else if (
      (token === '--required-command' || token === '--requiredCommand') &&
      argv[index + 1]
    ) {
      appendArg('requiredCommand', argv[++index]);
    } else if (token === '--render-report' && argv[index + 1]) {
      out.renderReport = argv[++index];
    } else if (
      (token === '--controlled-closeout-request' || token === '--controlledCloseoutRequest') &&
      argv[index + 1]
    ) {
      out.controlledCloseoutRequest = argv[++index];
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
    } else if (
      (token === '--localization-response' || token === '--localizationResponseFile') &&
      argv[index + 1]
    ) {
      out.localizationResponseFile = argv[++index];
    } else if (token === '--mode' && argv[index + 1]) {
      out.mode = argv[++index];
    } else if (
      token.startsWith('--critical-auditor-') ||
      token.startsWith('--criticalAuditor') ||
      token.startsWith('--max-critical-auditor')
    ) {
      throw new Error('requirements_authoring_legacy_argument_removed');
    } else if (token === '--no-auto-repair' || token === '--noAutoRepair') {
      out.noAutoRepair = 'true';
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
    } else if (token === '--source-context-path' && argv[index + 1]) {
      out.sourceContextPath = argv[++index];
    } else if (token === '--output-context-path' && argv[index + 1]) {
      out.outputContextPath = argv[++index];
    } else if (token === '--closeout-attempt-id' && argv[index + 1]) {
      out.closeoutAttemptId = argv[++index];
    } else if (token === '--allowed-write-path' && argv[index + 1]) {
      out.allowedWritePath = argv[++index];
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
    | 'refresh-confirmation-projection'
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
    if (flow && stage) {
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

interface ControlledCloseoutConfirmationPreparation {
  recordPath: string;
  closeoutAttemptId: string;
  candidatePath: string;
  candidateBytesHash: string;
  finalTaskReportPath: string;
  completionReceiptPath: string;
  provenanceHashes: Record<string, string>;
}

function prepareControlledCloseoutConfirmation(
  root: string,
  args: Record<string, string | undefined>
): ControlledCloseoutConfirmationPreparation | null {
  const recordPath = directRequirementRecordPathForCommand(root, args);
  const record = recordPath ? readJsonIfExists(recordPath) : null;
  const handoff = recordObject(record?.nativeGoalHandoff);
  if (handoff.controlledCloseoutIngested !== true) return null;
  const controlledCloseout = recordObject(handoff.controlledCloseout);
  const closeoutAttemptId = normalizeText(handoff.closeoutAttemptId);
  const currentAttemptId = normalizeText(recordObject(record?.closeout).currentAttemptId);
  const candidatePath = normalizeText(handoff.taskReportCandidatePath);
  const candidateBytesHash = normalizeText(handoff.taskReportArtifactHash);
  const finalTaskReportPath = normalizeText(handoff.taskReportPath);
  const completionReceiptPath =
    normalizeText(handoff.completionReceiptPath) ||
    (finalTaskReportPath ? `${finalTaskReportPath}.completion-receipt.json` : '');
  const provenanceHashes = {
    contextHash: normalizeText(controlledCloseout.contextHash),
    compileReceiptHash: normalizeText(controlledCloseout.compileReceiptHash),
    childClosureSetHash: normalizeText(controlledCloseout.childClosureSetHash),
    campaignReportHash: normalizeText(controlledCloseout.campaignReportHash),
    closureReceiptHash: normalizeText(controlledCloseout.closureReceiptHash),
    executionFinalJudgeCampaignHash: normalizeText(
      controlledCloseout.executionFinalJudgeCampaignHash
    ),
    effectivePassReceiptHash: normalizeText(controlledCloseout.effectivePassReceiptHash),
    deliveryCloseoutGateReceiptHash: normalizeText(
      controlledCloseout.deliveryCloseoutGateReceiptHash
    ),
  };
  if (
    !recordPath ||
    !closeoutAttemptId ||
    currentAttemptId !== closeoutAttemptId ||
    normalizeText(controlledCloseout.closeoutAttemptId) !== closeoutAttemptId ||
    !candidatePath ||
    !fs.existsSync(candidatePath) ||
    !finalTaskReportPath ||
    !completionReceiptPath ||
    !/^sha256:[a-f0-9]{64}$/u.test(candidateBytesHash) ||
    sha256File(candidatePath) !== candidateBytesHash ||
    Object.values(provenanceHashes).some((value) => !/^sha256:[a-f0-9]{64}$/u.test(value)) ||
    fs.existsSync(finalTaskReportPath) ||
    fs.existsSync(completionReceiptPath)
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  return {
    recordPath,
    closeoutAttemptId,
    candidatePath,
    candidateBytesHash,
    finalTaskReportPath,
    completionReceiptPath,
    provenanceHashes,
  };
}

interface StandaloneControlledCloseoutConfirmationPreparation {
  requestPath: string;
  closeoutAttemptId: string;
  candidatePath: string;
  candidateBytesHash: string;
  finalTaskReportPath: string;
  completionReceiptPath: string;
  provenanceHashes: Record<string, unknown>;
}

function controlledGoalCloseoutPath(root: string, value: unknown): string {
  const configured = normalizeText(value);
  if (!configured) throw new Error('main_agent_goal_task_report_provenance_mismatch');
  const projectRoot = path.resolve(root);
  const resolved = path.resolve(projectRoot, stripWrappingQuotes(configured));
  if (resolved !== projectRoot && !resolved.startsWith(`${projectRoot}${path.sep}`)) {
    throw new Error('campaign_closeout_path_escape');
  }
  return resolved;
}

function prepareStandaloneControlledCloseoutConfirmation(
  root: string,
  requestValue: unknown
): StandaloneControlledCloseoutConfirmationPreparation {
  const requestPath = controlledGoalCloseoutPath(root, requestValue);
  const request = readJsonObjectFile(requestPath);
  if (!request) throw new Error('main_agent_goal_task_report_provenance_mismatch');
  const requestPayload = { ...request };
  delete requestPayload.acceptanceRequestHash;
  delete requestPayload.confirmationText;
  delete requestPayload.rejectionConfirmationText;
  const acceptanceRequestHash = normalizeText(request.acceptanceRequestHash);
  const markerPath = controlledGoalCloseoutPath(root, request.markerPath);
  const candidatePath = controlledGoalCloseoutPath(root, request.taskReportCandidatePath);
  const finalTaskReportPath = controlledGoalCloseoutPath(root, request.finalTaskReportPath);
  const completionReceiptPath = controlledGoalCloseoutPath(root, request.completionReceiptPath);
  const marker = readJsonObjectFile(markerPath);
  const producerReceipt = recordObject(marker?.producerReceipt);
  const campaign = recordObject(marker?.executionFinalJudgeCampaign);
  const effectivePass = recordObject(marker?.effectivePassReceipt);
  const deliveryGate = recordObject(marker?.deliveryGateReceipt);
  const provenanceHashes = recordObject(request.provenanceHashes);
  const closeoutAttemptId = normalizeText(request.closeoutAttemptId);
  const candidateBytesHash = normalizeText(request.taskReportArtifactHash);
  const requiredProvenance = {
    contextHash: normalizeText(marker?.contextHash),
    compileReceiptHash: normalizeText(producerReceipt.compileReceiptHash),
    childClosureSetHash: normalizeText(producerReceipt.childClosureSetHash),
    campaignReportHash: normalizeText(producerReceipt.campaignReportHash),
    closureReceiptHash: normalizeText(producerReceipt.receiptHash),
    executionFinalJudgeCampaignHash: normalizeText(campaign.aggregateHash),
    effectivePassReceiptHash: normalizeText(effectivePass.effectivePassReceiptHash),
    deliveryCloseoutGateReceiptHash: normalizeText(deliveryGate.receiptHash),
  };
  const candidateRoot = path.dirname(candidatePath);
  if (
    request.schemaVersion !== 'main-agent-controlled-closeout-acceptance-request/v1' ||
    request.status !== 'awaiting_user_acceptance' ||
    marker?.status !== 'awaiting_user_acceptance' ||
    controlledHash(controlledStableJson(requestPayload)) !== acceptanceRequestHash ||
    !closeoutAttemptId ||
    normalizeText(marker.closeoutAttemptId) !== closeoutAttemptId ||
    normalizeText(producerReceipt.closeoutAttemptId) !== closeoutAttemptId ||
    normalizeText(campaign.closeoutAttemptId) !== closeoutAttemptId ||
    normalizeText(deliveryGate.closeoutAttemptId) !== closeoutAttemptId ||
    producerReceipt.status !== 'campaign_closed' ||
    effectivePass.effectivePass !== true ||
    normalizeText(marker.contextHash) !== normalizeText(request.contextHash) ||
    normalizeText(producerReceipt.contextHash) !== normalizeText(request.contextHash) ||
    normalizeText(marker.candidateBytesHash) !== candidateBytesHash ||
    normalizeText(producerReceipt.taskReportArtifactHash) !== candidateBytesHash ||
    normalizeText(campaign.candidateBytesHash) !== candidateBytesHash ||
    deliveryGate.status !== 'awaiting_user_acceptance' ||
    Object.entries(requiredProvenance).some(
      ([key, value]) =>
        !/^sha256:[a-f0-9]{64}$/u.test(value) || normalizeText(provenanceHashes[key]) !== value
    ) ||
    !/^sha256:[a-f0-9]{64}$/u.test(candidateBytesHash) ||
    !fs.existsSync(candidatePath) ||
    sha256File(candidatePath) !== candidateBytesHash ||
    path.dirname(finalTaskReportPath) !== candidateRoot ||
    path.dirname(completionReceiptPath) !== candidateRoot ||
    (fs.existsSync(finalTaskReportPath) && sha256File(finalTaskReportPath) !== candidateBytesHash)
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  return {
    requestPath,
    closeoutAttemptId,
    candidatePath,
    candidateBytesHash,
    finalTaskReportPath,
    completionReceiptPath,
    provenanceHashes,
  };
}

function recordControlledGoalCompletion(input: {
  preparation: ControlledCloseoutConfirmationPreparation;
  completionReceipt: Record<string, unknown>;
  recordClosedReceipt: Record<string, unknown>;
}): void {
  const current = readJsonIfExists(input.preparation.recordPath);
  if (
    !current ||
    normalizeText(recordObject(current.closeout).currentAttemptId) !==
      input.preparation.closeoutAttemptId ||
    normalizeText(recordObject(current.closeoutAcceptance).receiptHash) !==
      normalizeText(input.recordClosedReceipt.receiptHash)
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  const next = {
    ...current,
    status: 'done',
    controlledGoalCompletion: {
      path: input.preparation.completionReceiptPath,
      completionReceiptHash: input.completionReceipt.completionReceiptHash,
      closeoutAttemptId: input.preparation.closeoutAttemptId,
      taskReportPath: input.preparation.finalTaskReportPath,
      taskReportArtifactHash: input.preparation.candidateBytesHash,
      recordClosedReceiptHash: input.recordClosedReceipt.receiptHash,
    },
    lastEventType: 'native_goal_completion_recorded',
    updatedAt: normalizeText(input.recordClosedReceipt.confirmedAt) || new Date().toISOString(),
  };
  const temporaryPath = `${input.preparation.recordPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, input.preparation.recordPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
}

export function runMainAgentConfirmCloseoutAcceptance(
  root: string,
  args: Record<string, string | undefined>
): MainAgentConfirmScopeResult {
  const controlledCloseoutRequest = normalizeText(args.controlledCloseoutRequest);
  if (controlledCloseoutRequest) {
    if (!normalizeText(args.confirmationText) && !normalizeText(args.confirmationTextFile)) {
      throw new Error(
        'confirm-closeout-acceptance requires --confirmation-text <exact closeout confirmation> or --confirmation-text-file <file>'
      );
    }
    const preparation = prepareStandaloneControlledCloseoutConfirmation(
      root,
      controlledCloseoutRequest
    );
    const confirmationTextFile = normalizeText(args.confirmationTextFile);
    const confirmationText = confirmationTextFile
      ? fs.readFileSync(controlledGoalCloseoutPath(root, confirmationTextFile), 'utf8')
      : normalizeText(args.confirmationText);
    const confirmation = confirmMainAgentControlledCloseout({
      projectRoot: root,
      requestPath: preparation.requestPath,
      confirmationText,
      confirmedBy: args.confirmedBy ?? 'main-agent-orchestration',
      ...(normalizeText(args.confirmedAt) ? { confirmedAt: normalizeText(args.confirmedAt) } : {}),
    });
    let parsedStdout: unknown = confirmation;
    if (confirmation.ok) {
      const delegatedOutput = recordObject(confirmation);
      const recordClosedReceipt = recordObject(delegatedOutput.recordClosedReceipt);
      if (recordClosedReceipt.status === 'user_accepted_closeout') {
        const completionReceipt = persistAcceptedControlledTaskReport({
          closeoutAttemptId: preparation.closeoutAttemptId,
          latestCloseoutAttemptId: preparation.closeoutAttemptId,
          candidatePath: preparation.candidatePath,
          candidateBytesHash: preparation.candidateBytesHash,
          finalTaskReportPath: preparation.finalTaskReportPath,
          completionReceiptPath: preparation.completionReceiptPath,
          recordClosedReceipt,
          provenanceHashes: preparation.provenanceHashes,
        });
        parsedStdout = {
          ...delegatedOutput,
          status: 'done',
          taskReportPath: preparation.finalTaskReportPath,
          completionReceiptPath: preparation.completionReceiptPath,
          completionReceipt,
        };
      }
    }
    return {
      ok: confirmation.ok,
      action: 'confirm-closeout-acceptance',
      delegatedEntry: 'main-agent-controlled-closeout-confirmation',
      exitCode: confirmation.exitCode,
      stdout: parsedStdout,
      mainAgentStageSummary: stageSummaryForCommandResult(root, args, parsedStdout),
    };
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
  const controlledPreparation = prepareControlledCloseoutConfirmation(root, args);
  const confirmationTextFile = normalizeText(args.confirmationTextFile);
  const confirmationText = confirmationTextFile
    ? fs.readFileSync(path.resolve(root, stripWrappingQuotes(confirmationTextFile)), 'utf8')
    : normalizeText(args.confirmationText);
  const confirmation = confirmMainAgentRecordBackedCloseout({
    projectRoot: root,
    sourcePath: path.resolve(root, stripWrappingQuotes(source)),
    renderReportPath: path.resolve(root, stripWrappingQuotes(normalizeText(args.renderReport))),
    confirmationText,
    confirmedBy: args.confirmedBy ?? 'main-agent-orchestration',
    ...(normalizeText(args.confirmedAt) ? { confirmedAt: normalizeText(args.confirmedAt) } : {}),
    ...(normalizeText(args.recordId) ? { recordId: normalizeText(args.recordId) } : {}),
    ...(normalizeText(args.requirementSetId)
      ? { requirementSetId: normalizeText(args.requirementSetId) }
      : {}),
    ...(normalizeText(args.requirementRecord)
      ? {
          requirementRecordPath: path.resolve(
            root,
            stripWrappingQuotes(normalizeText(args.requirementRecord))
          ),
        }
      : {}),
    ...(normalizeText(args.eventLog)
      ? { eventLogPath: path.resolve(root, stripWrappingQuotes(normalizeText(args.eventLog))) }
      : {}),
    ...(normalizeText(args.artifactIndex)
      ? {
          artifactIndexPath: path.resolve(
            root,
            stripWrappingQuotes(normalizeText(args.artifactIndex))
          ),
        }
      : {}),
  });
  let parsedStdout: unknown = confirmation;
  if (confirmation.ok && controlledPreparation) {
    const delegatedOutput = recordObject(confirmation);
    const recordClosedReceipt = recordObject(delegatedOutput.recordClosedReceipt);
    if (recordClosedReceipt.status === 'user_accepted_closeout') {
      const completionReceipt = persistAcceptedControlledTaskReport({
        closeoutAttemptId: controlledPreparation.closeoutAttemptId,
        latestCloseoutAttemptId: controlledPreparation.closeoutAttemptId,
        candidatePath: controlledPreparation.candidatePath,
        candidateBytesHash: controlledPreparation.candidateBytesHash,
        finalTaskReportPath: controlledPreparation.finalTaskReportPath,
        completionReceiptPath: controlledPreparation.completionReceiptPath,
        recordClosedReceipt,
        provenanceHashes: controlledPreparation.provenanceHashes,
      });
      recordControlledGoalCompletion({
        preparation: controlledPreparation,
        completionReceipt,
        recordClosedReceipt,
      });
      parsedStdout = {
        ...delegatedOutput,
        status: 'done',
        completionReceiptPath: controlledPreparation.completionReceiptPath,
        completionReceipt,
      };
    }
  }
  return {
    ok: confirmation.ok,
    action: 'confirm-closeout-acceptance',
    delegatedEntry: 'main-agent-controlled-closeout-confirmation',
    exitCode: confirmation.exitCode,
    stdout: parsedStdout,
    mainAgentStageSummary: stageSummaryForCommandResult(root, args, parsedStdout),
  };
}

export function runMainAgentConfirmScope(
  root: string,
  args: Record<string, string | undefined>
): MainAgentConfirmScopeResult {
  const source = normalizeText(args.source);
  if (!source) {
    throw new Error('confirm-scope requires --source <source-document.md>');
  }
  if (!normalizeText(args.confirmationText) && !normalizeText(args.confirmationTextFile)) {
    throw new Error(
      'confirm-scope requires --confirmation-text <exact chat confirmation> or --confirmation-text-file <file>'
    );
  }
  let result: RequirementsContractConfirmationAcceptanceResult;
  try {
    result = runRequirementsContractConfirmationAcceptance({
      root,
      args: {
        ...args,
        source: path.resolve(root, stripWrappingQuotes(source)),
        confirmedBy: args.confirmedBy ?? 'main-agent-orchestration',
      },
    });
  } catch (error) {
    result = {
      ok: false,
      action: 'confirm-scope',
      exitCode: 2,
      authority: 'main-agent-controlled-confirmation',
      requirementRecordPath: normalizeText(args.requirementRecord) || '',
      renderReportPath: normalizeText(args.renderReport) || '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return {
    ok: result.ok,
    action: 'confirm-scope',
    delegatedEntry: path
      .relative(root, path.join(__dirname, 'requirements-contract-confirmation-acceptance.js'))
      .replace(/\\/g, '/'),
    exitCode: result.exitCode,
    stdout: result,
    ...(result.error ? { stderr: result.error } : {}),
    mainAgentStageSummary: stageSummaryForCommandResult(root, args, result),
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

function runMainAgentConfirmationProjectionRefresh(
  root: string,
  args: Record<string, string | undefined>
): MainAgentConfirmScopeResult {
  const entry = resolveSkillScript(root, 'ingest-confirmation-event.js');
  const source = normalizeText(args.source);
  const renderReport = normalizeText(args.renderReport);
  const requirementRecord = normalizeText(args.requirementRecord);
  const confirmationText = normalizeText(args.confirmationText);
  if (!fs.existsSync(entry)) {
    throw new Error(`controlled confirmation projection entry missing: ${entry}`);
  }
  if (!source || !renderReport || !requirementRecord || !confirmationText) {
    throw new Error(
      'confirmation projection refresh requires source, render report, requirement record, and confirmation text'
    );
  }

  const delegatedArgs = [
    '--source',
    path.resolve(root, stripWrappingQuotes(source)),
    '--render-report',
    path.resolve(root, stripWrappingQuotes(renderReport)),
    '--requirement-record',
    path.resolve(root, stripWrappingQuotes(requirementRecord)),
    '--confirmation-text',
    confirmationText,
    '--confirmed-by',
    args.confirmedBy ?? 'main-agent-orchestration',
    '--update-source',
    'false',
    '--json',
  ];
  pushOptionalArg(delegatedArgs, '--confirmed-at', args.confirmedAt, root);
  pushOptionalArg(delegatedArgs, '--record-id', args.recordId, root);
  pushOptionalArg(delegatedArgs, '--requirement-set-id', args.requirementSetId, root);
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
    action: 'refresh-confirmation-projection',
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
  const extraction = extractRequirementsContractImplementationConfirmation(sourceText);
  return {
    confirmation: extraction.value,
    sourceDocumentHash: sourceDocumentHashForContract(
      sourceText,
      extraction.blockText,
      extraction.value
    ),
    implementationConfirmationHash: implementationConfirmationHashForContract(extraction.value),
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
    '确认以上范围进入下一阶段',
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
    const delegatedResult = runMainAgentConfirmationProjectionRefresh(root, {
      ...args,
      renderReport: renderReportPath,
      confirmationText: confirmationTextFromRenderReport({
        ...renderReport,
        confirmationPageHash: priorProjectionHash,
      }),
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

function mainSessionExecutionRequiredTaskReport(
  instruction: MainAgentDispatchInstruction
): TaskReport {
  return {
    packetId: instruction.packetId,
    status: 'blocked',
    filesChanged: [],
    validationsRun: ['main-session-execution-preparation'],
    evidence: [
      `Current main session must execute the hash-bound dispatch packet: ${instruction.packetPath}`,
    ],
    downstreamContext: [instruction.expectedDelta],
    driftFlags: ['main-session-execution-required'],
  };
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

function parseJsonObjectFromText(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function recordNativeGoalControlledIngestEvidence(input: {
  recordPath: string | null;
  taskReportPath: string;
  taskReport: TaskReport;
  pendingPacket: ExecutionPacket;
  commandReceipts: CommandExecutionReceiptValidationResult['acceptedReceipts'];
  provenance: {
    invocationReceiptPath: string;
    invocationReceiptHash: string;
    taskReportHash: string;
    transactionManifestPath: string;
    transactionManifestHash: string;
    currentDispatchPointerPath: string;
    currentDispatchPointerHash: string;
  };
  recordedAt: string;
}): string[] {
  if (!input.recordPath) return [];
  const record = readJsonIfExists(input.recordPath) ?? {};
  const recordId = normalizeText(record.recordId) || input.pendingPacket.parentSessionId;
  const requirementSetId =
    normalizeText(record.requirementSetId) || input.pendingPacket.parentSessionId;
  const sourceDocumentHash =
    normalizeText(input.pendingPacket.compiledPromptRef?.sourceDocumentHash) ||
    normalizeText(record.sourceDocumentHash);
  const implementationConfirmationHash =
    normalizeText(input.pendingPacket.compiledPromptRef?.implementationConfirmationHash) ||
    normalizeText(record.implementationConfirmationHash);
  const relatedRequirementIds = uniqueNonEmpty(
    input.commandReceipts.flatMap((receipt) => receipt.commandRunRef.coveredRequirementIds)
  );
  const artifactRelatedRequirementIds =
    relatedRequirementIds.length > 0 ? relatedRequirementIds : [recordId];
  const artifactRef = (artifact: {
    artifactType: string;
    sourceOfTruthRole: string;
    path: string;
    hash: string;
    producer: string;
    purpose: string;
    inputVersion: string;
    outputVersion: string;
  }): Record<string, unknown> => ({
    eventType: 'artifact_indexed',
    artifactType: artifact.artifactType,
    sourceOfTruthRole: artifact.sourceOfTruthRole,
    recordId,
    requirementSetId,
    path: artifact.path,
    contentHash: artifact.hash,
    producer: artifact.producer,
    purpose: artifact.purpose,
    relatedRequirementIds: artifactRelatedRequirementIds,
    status: 'active',
    inputVersion: artifact.inputVersion,
    outputVersion: artifact.outputVersion,
    traceRows: [],
    evidenceRefs: input.taskReport.evidence,
  });
  const evidenceArtifactRefs = [
    artifactRef({
      artifactType: 'native_goal_task_report',
      sourceOfTruthRole: 'evidence',
      path: input.taskReportPath,
      hash: input.provenance.taskReportHash,
      producer: 'main-agent-controlled-native-goal',
      purpose: 'Preserve the imported TaskReport claim with its validated content hash.',
      inputVersion: 'task-report/v1',
      outputVersion: 'native-goal-controlled-ingest/v1',
    }),
    artifactRef({
      artifactType: 'native_goal_invocation_receipt',
      sourceOfTruthRole: 'control',
      path: input.provenance.invocationReceiptPath,
      hash: input.provenance.invocationReceiptHash,
      producer: 'main-agent-native-goal-invoker',
      purpose: 'Bind the TaskReport to the successful Main Agent native goal invocation.',
      inputVersion: 'main-agent-native-goal-invocation-receipt/v2',
      outputVersion: 'native-goal-controlled-ingest/v1',
    }),
    artifactRef({
      artifactType: 'prompt_transaction_manifest',
      sourceOfTruthRole: 'control',
      path: input.provenance.transactionManifestPath,
      hash: input.provenance.transactionManifestHash,
      producer: 'requirements-contract-prompt-transaction-publisher',
      purpose: 'Bind the TaskReport to the frozen prompt transaction manifest.',
      inputVersion: 'requirements-contract-prompt-transaction-manifest/v1',
      outputVersion: 'native-goal-controlled-ingest/v1',
    }),
    artifactRef({
      artifactType: 'current_dispatch_pointer',
      sourceOfTruthRole: 'runtime_next_action_authority',
      path: input.provenance.currentDispatchPointerPath,
      hash: input.provenance.currentDispatchPointerHash,
      producer: 'requirements-contract-current-dispatch-pointer',
      purpose: 'Bind the TaskReport to the exact current dispatch publication.',
      inputVersion: 'requirements-contract-current-dispatch-pointer/v1',
      outputVersion: 'native-goal-controlled-ingest/v1',
    }),
    ...input.commandReceipts.map((receipt) =>
      artifactRef({
        artifactType: 'command_execution_receipt',
        sourceOfTruthRole: 'evidence',
        path: receipt.receiptPath,
        hash: receipt.receiptHash,
        producer: receipt.commandRunRef.executorIdentity.id,
        purpose: `Bind validated command execution ${receipt.commandId} to this TaskReport ingest.`,
        inputVersion: 'requirements-contract-command-execution-receipt/v1',
        outputVersion: 'native-goal-controlled-ingest/v1',
      })
    ),
  ];
  const eventIds: string[] = [];
  const executionEvent = {
    eventType: 'execution_iteration_recorded',
    recordId,
    requirementSetId,
    packetId: input.taskReport.packetId,
    executionIterationId: input.taskReport.packetId,
    runId: input.taskReport.packetId,
    status: input.taskReport.status,
    filesChanged: input.taskReport.filesChanged,
    validationsRun: input.taskReport.validationsRun,
    evidenceRefs: input.taskReport.evidence,
    commandRunRefs: input.commandReceipts.map((receipt) => receipt.commandRunRef),
    evidenceArtifactRefs,
    sourceRefs: [
      {
        sourceType: 'native_goal_task_report',
        id: input.taskReport.packetId,
      },
      {
        sourceType: 'native_goal_invocation_receipt',
        id: input.provenance.invocationReceiptHash,
      },
      {
        sourceType: 'prompt_transaction_manifest',
        id: input.provenance.transactionManifestHash,
      },
      {
        sourceType: 'current_dispatch_pointer',
        id: input.provenance.currentDispatchPointerHash,
      },
    ],
    downstreamContext: input.taskReport.downstreamContext,
    taskReportPath: input.taskReportPath,
    taskReportHash: input.provenance.taskReportHash,
    invocationReceiptPath: input.provenance.invocationReceiptPath,
    invocationReceiptHash: input.provenance.invocationReceiptHash,
    transactionManifestPath: input.provenance.transactionManifestPath,
    transactionManifestHash: input.provenance.transactionManifestHash,
    currentDispatchPointerPath: input.provenance.currentDispatchPointerPath,
    currentDispatchPointerHash: input.provenance.currentDispatchPointerHash,
    sourceDocumentHash,
    implementationConfirmationHash,
    recordedAt: input.recordedAt,
    recordedBy: 'main-agent-orchestration',
    ingestPolicy: 'strict_task_report_controlled_ingest',
    authorityClass: 'untrusted_claim',
    commandSuccessEligible: false,
    requirementClosureEligible: false,
    evidenceAcceptanceEligible: false,
    gatePassEligible: false,
    sixModelAdvancementEligible: false,
    completionEligible: false,
  };
  const executionCommit = appendControlEventAndReplay({
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
  eventIds.push(executionCommit.event.eventId);
  return eventIds;
}

function nativeGoalHandoffFromRecord(
  record: Record<string, unknown> | null
): Record<string, unknown> | null {
  const handoff = record?.nativeGoalHandoff;
  return handoff && typeof handoff === 'object' && !Array.isArray(handoff)
    ? (handoff as Record<string, unknown>)
    : null;
}

function readPersistedNativeGoalOrchestrationState(input: {
  projectRoot: string;
  record: Record<string, unknown> | null;
}): {
  state: OrchestrationState | null;
  statePath: string;
  validationErrors: string[];
} {
  const handoff = nativeGoalHandoffFromRecord(input.record);
  const rawStatePath = normalizeText(handoff?.orchestrationStatePath);
  if (!rawStatePath) {
    return {
      state: null,
      statePath: '',
      validationErrors: ['native_goal_handoff_orchestration_state_path_missing'],
    };
  }
  const projectRoot = path.resolve(input.projectRoot);
  const statePath = path.resolve(rawStatePath);
  if (statePath !== projectRoot && !statePath.startsWith(`${projectRoot}${path.sep}`)) {
    return {
      state: null,
      statePath,
      validationErrors: ['native_goal_handoff_orchestration_state_path_outside_project'],
    };
  }
  const state = readOrchestrationStateAtPath(statePath);
  if (!state) {
    return {
      state: null,
      statePath,
      validationErrors: ['native_goal_handoff_orchestration_state_missing'],
    };
  }
  const expectedSessionId = normalizeText(handoff?.sessionId);
  if (!expectedSessionId || state.sessionId !== expectedSessionId) {
    return {
      state: null,
      statePath,
      validationErrors: ['native_goal_handoff_session_mismatch'],
    };
  }
  return { state, statePath, validationErrors: [] };
}

function validateNativeGoalTaskReportProvenance(input: {
  projectRoot: string;
  record: Record<string, unknown>;
  pendingPacket: ExecutionPacket;
  taskReportPath: string;
}): {
  validationErrors: string[];
  evidence: {
    invocationReceiptPath: string;
    invocationReceiptHash: string;
    taskReportHash: string;
    transactionManifestPath: string;
    transactionManifestHash: string;
    currentDispatchPointerPath: string;
    currentDispatchPointerHash: string;
  } | null;
} {
  const compiledPromptRef = input.pendingPacket.compiledPromptRef;
  if (!compiledPromptRef?.goalExecutionHash) {
    return { validationErrors: ['compiledPromptRef_missing'], evidence: null };
  }
  const attemptBundle = nativeGoalAttemptBundleFromCurrentPointer({
    projectRoot: input.projectRoot,
    record: input.record,
    compiledPromptRef,
  });
  const taskReportHash = sha256File(input.taskReportPath);
  const recordId = normalizeText(input.record.recordId) || input.pendingPacket.parentSessionId;
  const invocationReceiptPath = path.join(
    runtimeModeDir(input.projectRoot, recordId, input.pendingPacket.packetId),
    'native-goal-invocation-receipt.json'
  );
  const blocker = validateNativeGoalInvocationReceipt({
    projectRoot: input.projectRoot,
    recordId,
    attemptId: input.pendingPacket.packetId,
    packetId: input.pendingPacket.packetId,
    host: normalizeText(nativeGoalHandoffFromRecord(input.record)?.runtimeHost) || 'unknown',
    goalExecutionHash: attemptBundle.goalExecutionHash,
    taskReportPath: input.taskReportPath,
    taskReportHash,
    sourceDocumentHash: attemptBundle.sourceDocumentHash,
    implementationConfirmationHash: attemptBundle.implementationConfirmationHash,
    modelPacketHash: attemptBundle.modelPacketHash,
    auditReceiptHash: attemptBundle.auditReceiptHash,
    transactionManifestPath: attemptBundle.transactionManifestPath,
    transactionManifestHash: attemptBundle.transactionManifestHash,
    currentDispatchPointerPath: attemptBundle.currentDispatchPointerPath,
    currentDispatchPointerHash: attemptBundle.currentDispatchPointerHash,
  });
  if (blocker) {
    const invalidFields = Array.isArray(blocker.reasonDetails.invalidFields)
      ? blocker.reasonDetails.invalidFields.filter(
          (field): field is string => typeof field === 'string'
        )
      : [];
    const validationErrors = [blocker.reasonCode];
    for (const field of invalidFields) {
      if (field === 'taskReportHash') {
        validationErrors.push('native_goal_task_report_hash_mismatch');
      } else if (
        [
          'sourceDocumentHash',
          'implementationConfirmationHash',
          'modelPacketHash',
          'auditReceiptHash',
          'goalExecutionHash',
          'transactionManifestPath',
          'transactionManifestHash',
          'currentDispatchPointerPath',
          'currentDispatchPointerHash',
        ].includes(field)
      ) {
        validationErrors.push(`native_goal_attempt_bundle_mismatch:${field}`);
      }
    }
    return { validationErrors: uniqueNonEmpty(validationErrors), evidence: null };
  }
  return {
    validationErrors: [],
    evidence: {
      invocationReceiptPath,
      invocationReceiptHash: sha256File(invocationReceiptPath),
      taskReportHash,
      transactionManifestPath: attemptBundle.transactionManifestPath,
      transactionManifestHash: attemptBundle.transactionManifestHash,
      currentDispatchPointerPath: attemptBundle.currentDispatchPointerPath,
      currentDispatchPointerHash: attemptBundle.currentDispatchPointerHash,
    },
  };
}

function invalidNativeGoalTaskReportImport(input: {
  taskReportPath: string;
  packetId?: string | null;
  validationErrors: string[];
  taskReport?: TaskReport | null;
}): NativeGoalTaskReportImportResult {
  return {
    status: 'invalid',
    reasonCode: 'native_goal_task_report_invalid',
    validationErrors: input.validationErrors,
    taskReportPath: input.taskReportPath,
    packetId: input.packetId ?? input.taskReport?.packetId ?? null,
    nextAction: null,
    controlledIngested: false,
    taskReport: input.taskReport ?? null,
  };
}

export function importNativeGoalTaskReport(input: {
  projectRoot: string;
  flow: RuntimeFlowId;
  stage: string;
  taskReportPath?: string | null;
  recordId?: string;
  requirementSetId?: string;
  runId?: string;
}): NativeGoalTaskReportImportResult {
  const taskReportPath = normalizeText(input.taskReportPath);
  if (!taskReportPath || !fs.existsSync(taskReportPath)) {
    return invalidNativeGoalTaskReportImport({
      taskReportPath,
      validationErrors: ['taskReportPath_missing'],
    });
  }
  const runtimeContext = loadRuntimeContextForMainAgent(input);
  const activeRecordPath = runtimeRecordPath(runtimeContext);
  const activeRecord = readRequirementRecordFromRuntimeContext(runtimeContext);
  if (!activeRecordPath || !activeRecord) {
    return invalidNativeGoalTaskReportImport({
      taskReportPath,
      validationErrors: ['active_requirement_record_missing'],
    });
  }
  const persistedState = readPersistedNativeGoalOrchestrationState({
    projectRoot: input.projectRoot,
    record: activeRecord,
  });
  if (!persistedState.state) {
    return invalidNativeGoalTaskReportImport({
      taskReportPath,
      validationErrors: persistedState.validationErrors,
    });
  }
  const state = persistedState.state;
  const pendingPacket = readPendingPacketPayload(state);
  if (!state?.pendingPacket || !pendingPacket || !('taskType' in pendingPacket)) {
    return invalidNativeGoalTaskReportImport({
      taskReportPath,
      validationErrors: ['pending_implement_packet_missing'],
    });
  }
  const parsed = readJsonObjectFile(taskReportPath);
  if (!validateTaskReportShape(parsed)) {
    return invalidNativeGoalTaskReportImport({
      taskReportPath,
      packetId: normalizeText(parsed?.packetId) || null,
      validationErrors: ['schema_invalid'],
    });
  }
  const report = parsed;
  const validationErrors: string[] = [];
  if (pendingPacket.taskType !== 'implement') validationErrors.push('pending_packet_not_implement');
  if (report.packetId !== pendingPacket.packetId) validationErrors.push('packetId_mismatch');
  const compiledPromptRef = pendingPacket.compiledPromptRef;
  if (!compiledPromptRef) validationErrors.push('compiledPromptRef_missing');
  if (
    compiledPromptRef &&
    normalizeText(compiledPromptRef.sourceDocumentHash) !==
      normalizeText(activeRecord?.sourceDocumentHash)
  ) {
    validationErrors.push('sourceDocumentHash_mismatch');
  }
  const modelPacketRead = readModelPacketForCompiledRef(input.projectRoot, compiledPromptRef);
  validationErrors.push(...modelPacketRead.issueCodes);
  const modelPacket = modelPacketRead.modelPacket;
  const allowedWriteScope =
    Array.isArray(pendingPacket.allowedWriteScope) && pendingPacket.allowedWriteScope.length > 0
      ? pendingPacket.allowedWriteScope
      : [];
  for (const changed of report.filesChanged) {
    if (!pathMatchesAllowedScope(changed, allowedWriteScope)) {
      validationErrors.push(`filesChanged_out_of_scope:${changed}`);
    }
  }
  const provenanceValidation =
    compiledPromptRef && validationErrors.length === 0
      ? validateNativeGoalTaskReportProvenance({
          projectRoot: input.projectRoot,
          record: activeRecord,
          pendingPacket,
          taskReportPath,
        })
      : { validationErrors: [], evidence: null };
  validationErrors.push(...provenanceValidation.validationErrors);
  const commandReceiptValidation = validateModelPacketCommandExecutionReceipts({
    projectRoot: input.projectRoot,
    modelPacket,
  });
  validationErrors.push(...commandReceiptValidation.issueCodes);
  if (report.evidence.length === 0) validationErrors.push('evidence_empty');

  if (validationErrors.length > 0) {
    return invalidNativeGoalTaskReportImport({
      taskReportPath,
      validationErrors,
      taskReport: report,
    });
  }
  if (!provenanceValidation.evidence) {
    return invalidNativeGoalTaskReportImport({
      taskReportPath,
      validationErrors: ['native_goal_provenance_evidence_missing'],
      taskReport: report,
    });
  }

  const nextActionHint: OrchestrationNextAction =
    report.status === 'done' ? 'run_execution_closure_gate' : 'dispatch_remediation';
  const completedState = ingestMainAgentTaskReport(input.projectRoot, state.sessionId, report, {
    nextActionHint,
    currentStage: input.stage,
    nativeGoalProvenanceValidated: true,
  });
  const recordedAt = new Date().toISOString();
  recordNativeGoalControlledIngestEvidence({
    recordPath: activeRecordPath,
    taskReportPath,
    taskReport: report,
    pendingPacket,
    commandReceipts: commandReceiptValidation.acceptedReceipts,
    provenance: provenanceValidation.evidence,
    recordedAt,
  });
  if (activeRecordPath && compiledPromptRef) {
    recordNativeGoalHandoff({
      projectRoot: input.projectRoot,
      recordPath: activeRecordPath,
      sessionId: state.sessionId,
      orchestrationStatePath: persistedState.statePath,
      host: state.host,
      packet: pendingPacket,
      packetPath: state.pendingPacket.packetPath,
      modelPacket,
      invocationReceiptPath: provenanceValidation.evidence.invocationReceiptPath,
      invoked: true,
      imported: report.status === 'done',
      importStatus: `task_report_${report.status}`,
    });
  }
  return {
    status: 'imported',
    validationErrors: [],
    taskReportPath,
    packetId: report.packetId,
    nextAction: report.status === 'done' ? completedState.nextAction : 'dispatch_remediation',
    controlledIngested: true,
    taskReport: report,
  };
}

function commandCloseoutAttemptId(command: Record<string, unknown>): string {
  const direct = normalizeText(command.closeoutAttemptId);
  if (direct) return direct;
  const lastRunRef = command.lastRunRef;
  return lastRunRef && typeof lastRunRef === 'object' && !Array.isArray(lastRunRef)
    ? normalizeText((lastRunRef as Record<string, unknown>).closeoutAttemptId)
    : '';
}

function selectEvidenceBoundCloseoutAttemptId(record: Record<string, unknown> | null): string {
  if (!record) return '';
  const deliveryEvidence =
    record.deliveryEvidence &&
    typeof record.deliveryEvidence === 'object' &&
    !Array.isArray(record.deliveryEvidence)
      ? (record.deliveryEvidence as Record<string, unknown>)
      : {};
  const commandAttempts = objectsFrom(deliveryEvidence.requiredCommands)
    .map(commandCloseoutAttemptId)
    .filter(Boolean);
  const runAttempts = new Set(
    objectsFrom(record.executionIterations)
      .flatMap((iteration) => objectsFrom(iteration.commandRunRefs))
      .map((run) => normalizeText(run.closeoutAttemptId))
      .filter(Boolean)
  );
  return commandAttempts.find((candidate) => runAttempts.has(candidate)) ?? '';
}

function runMainAgentDeliveryCloseout(input: {
  projectRoot: string;
  recordPath: string;
  args: Record<string, string | undefined>;
}): {
  ok: boolean;
  taskReport: TaskReport;
  reportPath: string | null;
  decision: string;
  blockingReasons: string[];
} {
  const requestedAttemptId =
    normalizeText(input.args.closeoutAttemptId) || normalizeText(input.args.attemptId);
  const record = readJsonObject(input.recordPath);
  const evidenceBoundAttemptId = requestedAttemptId
    ? ''
    : selectEvidenceBoundCloseoutAttemptId(record);
  let attemptId = requestedAttemptId || evidenceBoundAttemptId;
  const explicitReportPath = normalizeText(input.args.closeoutReportPath);
  const reportPath = explicitReportPath
    ? path.resolve(input.projectRoot, stripWrappingQuotes(explicitReportPath))
    : path.join(path.dirname(input.recordPath), 'delivery-closeout-report.json');
  const argv = [
    '--requirement-record',
    input.recordPath,
    '--allow-existing-attempt',
    '--report-path',
    reportPath,
    '--json',
  ];
  if (attemptId) argv.push('--attempt-id', attemptId);
  const source = normalizeText(input.args.sourcePath);
  if (source) argv.push('--source', stripWrappingQuotes(source));
  const modelPacket = normalizeText(input.args.modelPacketPath);
  if (modelPacket) argv.push('--model-packet', stripWrappingQuotes(modelPacket));
  const closeoutHtmlPath = normalizeText(input.args.closeoutHtmlPath);
  if (closeoutHtmlPath) argv.push('--closeout-html-path', stripWrappingQuotes(closeoutHtmlPath));
  const closeoutRenderReportPath = normalizeText(input.args.closeoutRenderReportPath);
  if (closeoutRenderReportPath) {
    argv.push('--closeout-render-report-path', stripWrappingQuotes(closeoutRenderReportPath));
  }

  let nested: { exitCode: number; stdout: string; stderr: string };
  try {
    nested = captureNestedMainOutput(() => mainDeliveryCloseoutGate(argv));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const report = readJsonObject(reportPath);
    attemptId =
      normalizeText(report?.currentAttemptId) ||
      normalizeText((record?.closeout as Record<string, unknown> | undefined)?.currentAttemptId) ||
      evidenceBoundAttemptId ||
      requestedAttemptId ||
      `closeout-${Date.now()}`;
    const taskReport: TaskReport = {
      packetId: attemptId,
      status: 'blocked',
      filesChanged: [],
      validationsRun: ['main-agent:delivery-closeout-gate'],
      evidence: [relativePathFromRoot(input.projectRoot, reportPath)],
      downstreamContext: [
        'delivery closeout blocked; satisfy closeout evidence before user acceptance',
      ],
      driftFlags: ['delivery-closeout-gate-error', message],
    };
    return {
      ok: false,
      taskReport,
      reportPath: fs.existsSync(reportPath) ? reportPath : null,
      decision: 'blocked',
      blockingReasons: taskReport.driftFlags ?? [],
    };
  }

  const output = parseJsonObjectFromText(nested.stdout);
  const outputReportPath = normalizeText(output?.reportPath);
  const resolvedReportPath = outputReportPath
    ? path.resolve(input.projectRoot, outputReportPath)
    : reportPath;
  const report = readJsonObject(resolvedReportPath);
  attemptId =
    normalizeText(output?.attemptId) ||
    normalizeText(report?.currentAttemptId) ||
    attemptId ||
    `closeout-${Date.now()}`;
  const decision =
    normalizeText(output?.decision) ||
    normalizeText(report?.decision) ||
    (nested.exitCode === 0 ? 'pass' : 'blocked');
  const outputBlockingReasons = stringsFrom(output?.blockingReasons);
  const blockingReasons = outputBlockingReasons.length
    ? outputBlockingReasons
    : stringsFrom(report?.blockingReasons);
  const reportEvidencePath = fs.existsSync(resolvedReportPath)
    ? relativePathFromRoot(input.projectRoot, resolvedReportPath)
    : relativePathFromRoot(input.projectRoot, reportPath);
  const taskReport: TaskReport = {
    packetId: attemptId,
    status: decision === 'pass' && nested.exitCode === 0 ? 'done' : 'blocked',
    filesChanged: [],
    validationsRun: ['main-agent:delivery-closeout-gate'],
    evidence: [
      reportEvidencePath,
      ...(normalizeText(output?.receiptPath) ? [normalizeText(output?.receiptPath)] : []),
    ],
    downstreamContext: [
      decision === 'pass'
        ? 'delivery closeout passed; delivery confirmation user acceptance can proceed'
        : 'delivery closeout blocked; satisfy closeout evidence before user acceptance',
    ],
    ...(blockingReasons.length ? { driftFlags: blockingReasons } : {}),
  };
  return {
    ok: taskReport.status === 'done',
    taskReport,
    reportPath: fs.existsSync(resolvedReportPath) ? resolvedReportPath : null,
    decision,
    blockingReasons,
  };
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

function testAuthoringReadinessAction(
  blocker: string,
  target?: string
): ReadinessRemediationAction {
  return {
    blocker,
    schemaVersion: 'readiness-blocker-classification/v1',
    classification: 'requires_test_authoring',
    sourceAuthorityImpact: 'none',
    autoRemediationAllowed: false,
    requiredNextAction: 'dispatch_test_authoring',
    action: 'dispatch_bounded_test_authoring',
    ...(target ? { target } : {}),
    reason:
      'missing expected-red tests require semantic test authoring and real oracle execution; placeholder tests are forbidden',
    reasonCode: 'semantic_expected_red_test_authoring_required',
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
    const target = baseBlocker.slice('required_command_file_missing:'.length);
    return isExecutableTestPath(target)
      ? testAuthoringReadinessAction(blockerId, target)
      : sourceAmendmentReadinessAction(
          blockerId,
          'missing_command_dependency_requires_authoritative_repair',
          'required command references a missing non-test dependency that cannot be synthesized safely'
        );
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
      return testAuthoringReadinessAction(blocker);
    }
    if (
      hasMissingTestRoot &&
      [
        'missing_test_plan_blocked',
        'requirement_pre_implementation_missing_plan',
        'trace_acceptance_binding_missing',
        'pre_implementation_red_proof_missing',
        'pre_implementation_valid_expected_red_missing',
      ].includes(blocker)
    ) {
      return deriveReadinessAction({
        blocker,
        action: 'rerun_after_bounded_test_authoring',
        reason: 'dependent readiness blocker must be reevaluated after semantic test authoring',
        reasonCode: 'dependent_blocker_waits_for_semantic_test_authoring',
      });
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

function aiTddPreImplementationReport(input: {
  record: Record<string, unknown>;
  recordPath: string;
  sourcePath: string;
  implementationRunKind: string;
  executeRedProof?: boolean;
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
      executeRedProof: input.executeRedProof ?? true,
    }) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function objectFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizedCommandPath(value: unknown): string {
  return normalizeText(value).replace(/\\/gu, '/').toLowerCase();
}

function deriveValidationOnlyTargetPathOverlay(
  aiTddReport: Record<string, unknown> | null
): Record<string, unknown> | null {
  const manifest = objectFrom(aiTddReport?.contractExecutionManifest);
  const targetRows = objectsFrom(manifest?.targetModificationPaths);
  const commandRows = objectsFrom(manifest?.requiredCommands);
  const traceRows = objectsFrom(manifest?.traceRows);
  const traceById = new Map(
    traceRows.map((row) => [normalizeText(row.id), row] as const).filter(([id]) => Boolean(id))
  );
  const targetPathBindings: Record<string, unknown>[] = [];

  for (const target of targetRows) {
    const validationOnly =
      normalizeText(target.coverageRole) === 'validation_only' ||
      normalizeText(target.changeType) === 'validation_only';
    const id = normalizeText(target.id);
    const targetPath = normalizedCommandPath(target.path);
    if (!validationOnly || !id || !targetPath) continue;
    if (stringsFrom(target.traceRefs).length > 0 && stringsFrom(target.evidenceRefs).length > 0) {
      continue;
    }

    const matchingCommands = commandRows.filter((command) =>
      normalizedCommandPath(command.command).includes(targetPath)
    );
    if (matchingCommands.length !== 1) continue;

    const command = matchingCommands[0]!;
    const traceRefs = uniqueNonEmpty([
      ...stringsFrom(command.traceRefs),
      ...stringsFrom(command.traceRows),
    ]);
    const evidenceRefs = uniqueNonEmpty([
      ...stringsFrom(command.evidenceRefs),
      ...traceRefs.flatMap((traceRef) => stringsFrom(traceById.get(traceRef)?.evidenceRefs)),
    ]);
    if (traceRefs.length === 0 || evidenceRefs.length === 0) continue;

    targetPathBindings.push({
      id,
      traceRefs,
      evidenceRefs,
    });
  }

  return targetPathBindings.length > 0
    ? {
        schemaVersion: 'readiness-auto-remediation-overlay/v1',
        sourceMutationPolicy: 'non_semantic_projection_only',
        targetPathBindings,
      }
    : null;
}

const VALIDATION_TARGET_OVERLAY_BLOCKERS = new Set([
  'contract_completeness_report_blocked',
  'target_modification_trace_refs_missing',
  'target_modification_evidence_refs_missing',
]);

function applyResolvedValidationTargetOverlayActions(input: {
  actions: ReadinessRemediationAction[];
  overlay: Record<string, unknown> | null;
  projectedAiTddReport: Record<string, unknown> | null;
}): ReadinessRemediationAction[] {
  if (!input.overlay) return input.actions;
  const projectedBlockers = new Set(
    stringsFrom(input.projectedAiTddReport?.blockingReasons).map(readinessBlockerBaseId)
  );
  return input.actions.map((action) => {
    const baseBlocker = readinessBlockerBaseId(action.blocker);
    if (
      !VALIDATION_TARGET_OVERLAY_BLOCKERS.has(baseBlocker) ||
      projectedBlockers.has(baseBlocker)
    ) {
      return action;
    }
    return deriveReadinessAction({
      blocker: action.blocker,
      action: 'persist_validation_target_trace_evidence_overlay',
      reason:
        'validation-only target path has one source-authorized command to trace to evidence chain',
      reasonCode: 'unique_validation_target_projection_allowed',
    });
  });
}

const EXPECTED_RED_PROOF_MATERIALIZATION_BLOCKERS = new Set([
  'pre_implementation_valid_expected_red_missing',
  'requirement_pre_implementation_missing_plan',
  'trace_acceptance_binding_missing',
  'pre_implementation_red_proof_missing',
]);

function canMaterializeExpectedRedProofsFromManifest(input: {
  blockingActions: ReadinessRemediationAction[];
  aiTddReport: Record<string, unknown> | null;
}): boolean {
  if (input.blockingActions.length === 0) return true;
  if (input.blockingActions.some((action) => action.classification === 'requires_user_decision')) {
    return false;
  }
  if (
    input.blockingActions.some(
      (action) =>
        !EXPECTED_RED_PROOF_MATERIALIZATION_BLOCKERS.has(readinessBlockerBaseId(action.blocker))
    )
  ) {
    return false;
  }

  const proofRows = defaultProofRows(null, input.aiTddReport);
  const proofAcceptanceIds = new Set(
    proofRows.map((row) => normalizeText(row.acceptanceId)).filter(Boolean)
  );
  if (proofAcceptanceIds.size === 0) return false;

  const matrixRows = objectsFrom(input.aiTddReport?.redGreenMatrix);
  const acceptanceRows = matrixRows.filter((row) =>
    ['ACC', 'E2E'].includes(normalizeText(row.category))
  );
  if (acceptanceRows.length === 0) return false;

  return acceptanceRows.every((row) => {
    const rowId = normalizeText(row.id);
    return (
      rowId &&
      proofAcceptanceIds.has(rowId) &&
      stringsFrom(row.commandRefs).length > 0 &&
      stringsFrom(row.refs).some((ref) => /^TRACE-/u.test(ref)) &&
      stringsFrom(row.refs).some((ref) => /^EVD-/u.test(ref)) &&
      Boolean(normalizeText(row.oracle))
    );
  });
}

function expectedRedProofMaterializationAction(
  action: ReadinessRemediationAction
): ReadinessRemediationAction {
  return deriveReadinessAction({
    blocker: action.blocker,
    action: 'persist_executed_expected_red_proof',
    reason:
      'declared acceptance and e2e commands produced valid expected-red oracle failures and may be persisted without source mutation',
    reasonCode: 'executed_expected_red_proof_persistence_allowed',
  });
}

function defaultProofRows(
  _report: Record<string, unknown> | null,
  aiTddReport: Record<string, unknown> | null
): Record<string, unknown>[] {
  const rows = objectsFrom(aiTddReport?.redGreenMatrix).filter(
    (row) =>
      ['ACC', 'E2E'].includes(normalizeText(row.category)) &&
      normalizeText(row.currentState) === 'expected_red' &&
      stringsFrom(row.refs).includes('proof:execute_red_proof')
  );
  const uniqueRows = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const acceptanceId = normalizeText(row.id);
    if (!acceptanceId || uniqueRows.has(acceptanceId)) continue;
    uniqueRows.set(acceptanceId, {
      acceptanceId,
      commandId: stringsFrom(row.commandRefs)[0],
      state: 'expected_red',
      oracle: normalizeText(row.oracle),
      failureClass: 'oracle_failure',
      proofSource: 'execute_red_proof',
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

function uniqueNonEmpty(values: readonly unknown[]): string[] {
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
  const initialBlockerActions = classifyReadinessBlockers(latestReadinessBlockers(record, report));
  const implementationRunKind = normalizeText(args.implementationRunKind) || 'first-implementation';
  const sourcePath = normalizeText(record.sourcePath);
  const initialAiTddReport = aiTddPreImplementationReport({
    record,
    recordPath: input.recordPath,
    sourcePath,
    implementationRunKind,
  });
  const overlay = deriveValidationOnlyTargetPathOverlay(initialAiTddReport);
  const projectedAiTddReport = overlay
    ? aiTddPreImplementationReport({
        record: {
          ...record,
          aiTddContractGate: {
            ...(objectFrom(record.aiTddContractGate) ?? {}),
            readinessAutoRemediationOverlay: overlay,
          },
        },
        recordPath: input.recordPath,
        sourcePath,
        implementationRunKind,
        executeRedProof: false,
      })
    : null;
  const aiTddReport = initialAiTddReport;
  const blockerActions = applyResolvedValidationTargetOverlayActions({
    actions: initialBlockerActions,
    overlay,
    projectedAiTddReport,
  });
  const concreteActions = blockerActions.filter(
    (action) => action.blocker !== 'ai_tdd_pre_implementation_readiness_not_ready'
  );
  const initialBlockingActions = concreteActions.filter((action) => !action.autoRemediationAllowed);
  const canMaterializeExpectedRedProofs = canMaterializeExpectedRedProofsFromManifest({
    blockingActions: initialBlockingActions,
    aiTddReport,
  });
  const effectiveActions = canMaterializeExpectedRedProofs
    ? blockerActions.map((action) =>
        EXPECTED_RED_PROOF_MATERIALIZATION_BLOCKERS.has(readinessBlockerBaseId(action.blocker))
          ? expectedRedProofMaterializationAction(action)
          : action
      )
    : blockerActions;
  const effectiveConcreteActions = effectiveActions.filter(
    (action) => action.blocker !== 'ai_tdd_pre_implementation_readiness_not_ready'
  );
  const blockingActions = effectiveConcreteActions.filter(
    (action) => !action.autoRemediationAllowed
  );
  if (blockingActions.length > 0) {
    const hasUserDecision = blockingActions.some(
      (action) => action.classification === 'requires_user_decision'
    );
    const hasTestAuthoring = blockingActions.some(
      (action) => action.classification === 'requires_test_authoring'
    );
    return {
      ok: false,
      status: 'blocked',
      blockerActions: effectiveActions,
      requiredNextAction: hasUserDecision
        ? 'blocked_by_unresolved_user_decision'
        : hasTestAuthoring
          ? 'dispatch_test_authoring'
          : 'source_amendment_required',
      filesChanged: [],
      validationsRun: ['readiness-blocker-classifier'],
      evidence: blockingActions.map(
        (action) => `${action.classification}:${action.requiredNextAction}:${action.blocker}`
      ),
      blockingReasons: [
        hasUserDecision
          ? 'blocked_by_unresolved_user_decision'
          : hasTestAuthoring
            ? 'dispatch_test_authoring'
            : 'source_amendment_required',
        ...blockingActions.map((action) => action.blocker),
      ],
    };
  }

  const filesChanged: string[] = [];

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
    blockerActions: effectiveActions,
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
    blockerActions: effectiveActions,
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

function assertMainAgentAuditControlInput(input: {
  args?: Record<string, string | undefined>;
}): void {
  if (Object.prototype.hasOwnProperty.call(input, 'auditJudgeExecutor')) {
    throw new Error('audit_judge_result_injection_forbidden');
  }
  for (const argumentName of [
    'auditJudgeAdapterCommand',
    'auditReadonlyAuditorAdapterCommand',
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(input.args ?? {}, argumentName)) {
      throw new Error('audit_controlled_executor_command_override_forbidden');
    }
  }
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
  nativeGoalExecutor?: NativeGoalControlledExecutor;
}): MainAgentRunLoopResult {
  assertMainAgentAuditControlInput(input);
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
  if (initialSurface.orchestrationState?.auditControlledFinalization?.status === 'prepared') {
    try {
      const recovered = resumePreparedAuditControlledFinalization({
        projectRoot: input.projectRoot,
        state: initialSurface.orchestrationState,
      });
      if (!recovered) {
        throw new Error('audit_controlled_executor_finalization_resume_missing');
      }
      steps.push({
        step: 'audit-controlled-executor.finalization-resume',
        status: recovered.result.decision === 'pass' ? 'pass' : 'fail',
        summary: `decision=${recovered.result.decision}, receipt=${relativePathFromRoot(
          input.projectRoot,
          recovered.result.finalizationReceiptPath
        )}`,
      });
      const finalSurface = resolveMainAgentOrchestrationSurface({
        ...surfaceInput,
      });
      return {
        runId: `main-agent-run-loop-${Date.now()}`,
        status: recovered.result.taskReport.status === 'done' ? 'completed' : 'blocked',
        steps,
        dispatchInstruction: recovered.instruction,
        taskReport: recovered.result.taskReport,
        finalSurface,
        mainAgentStageSummary: finalSurface.mainAgentStageSummary,
      };
    } catch (error) {
      const finalSurface = resolveMainAgentOrchestrationSurface({
        ...surfaceInput,
      });
      return {
        runId: `main-agent-run-loop-${Date.now()}`,
        status: 'blocked',
        steps: [
          ...steps,
          {
            step: 'audit-controlled-executor.finalization-resume',
            status: 'fail',
            summary: error instanceof Error ? error.message : String(error),
          },
        ],
        dispatchInstruction: null,
        taskReport: null,
        finalSurface,
        mainAgentStageSummary: finalSurface.mainAgentStageSummary,
      };
    }
  }
  if (nativeGoalHandoffRequiresTaskReportImport(activeRecord)) {
    const nextAction = 'await_native_goal_task_report';
    const finalSurface: MainAgentOrchestrationSurface = {
      ...initialSurface,
      mainAgentNextAction: nextAction,
      mainAgentReady: false,
      mainAgentCanContinue: false,
      continueDecision: 'blocked',
      mainAgentStageSummary: initialSurface.mainAgentStageSummary
        ? {
            ...initialSurface.mainAgentStageSummary,
            nextAction,
            ready: false,
            blocked: true,
            blockingReasons: [
              ...new Set([
                ...initialSurface.mainAgentStageSummary.blockingReasons,
                'native_goal_task_report_import_required',
              ]),
            ],
            userFacingMessage:
              'Native /goal execution is awaiting the packet-bound TaskReport import.',
          }
        : null,
      runtimeResumeProjection: initialSurface.runtimeResumeProjection
        ? {
            ...initialSurface.runtimeResumeProjection,
            runtimeNextAction: nextAction,
            ready: false,
            blockingReasonRefs: [
              {
                sourceType: 'native_goal_handoff',
                id: 'task_report_import_required',
              },
            ],
          }
        : initialSurface.runtimeResumeProjection,
    };
    return {
      runId: `main-agent-run-loop-${Date.now()}`,
      status: 'blocked',
      steps: [
        ...steps,
        {
          step: 'native-goal-task-report',
          status: 'fail',
          summary: 'waiting for packet-bound native /goal TaskReport import',
        },
      ],
      dispatchInstruction: null,
      taskReport: null,
      finalSurface,
      mainAgentStageSummary: finalSurface.mainAgentStageSummary,
    };
  }
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
            : remediation.requiredNextAction === 'dispatch_test_authoring'
              ? 'dispatch_test_authoring'
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

  if (activeRecordPath && initialSurface.mainAgentNextAction === 'run_closeout') {
    const closeout = runMainAgentDeliveryCloseout({
      projectRoot: input.projectRoot,
      recordPath: activeRecordPath,
      args,
    });
    steps.push({
      step: 'delivery-closeout',
      status: closeout.ok ? 'pass' : 'fail',
      summary: `decision=${closeout.decision}, report=${
        closeout.reportPath
          ? relativePathFromRoot(input.projectRoot, closeout.reportPath)
          : 'missing'
      }`,
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
      status: closeout.ok ? 'completed' : 'blocked',
      steps,
      dispatchInstruction: null,
      taskReport: closeout.taskReport,
      finalSurface,
      mainAgentStageSummary: finalSurface.mainAgentStageSummary,
    };
  }

  if (initialSurface.mainAgentNextAction === 'await_native_goal_task_report') {
    const finalSurface = resolveMainAgentOrchestrationSurface({
      ...surfaceInput,
    });
    return {
      runId: `main-agent-run-loop-${Date.now()}`,
      status: 'blocked',
      steps: [
        ...steps,
        {
          step: 'native-goal-task-report',
          status: 'fail',
          summary: 'waiting for packet-bound native /goal TaskReport import',
        },
      ],
      dispatchInstruction: null,
      taskReport: null,
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
    resumeInFlightAudit: true,
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

  const resumesInFlightAudit =
    instruction.taskType === 'audit' &&
    (initialSurface.pendingPacketStatus === 'claimed_by_main_agent' ||
      initialSurface.pendingPacketStatus === 'dispatched') &&
    initialSurface.orchestrationState?.pendingPacket?.packetId === instruction.packetId;
  if (resumesInFlightAudit) {
    steps.push({
      step: 'resume',
      status: 'pass',
      summary: `packet=${instruction.packetId}, status=${initialSurface.pendingPacketStatus}`,
    });
  } else {
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
  }

  const auditInstructionPacket = instruction.packet;
  if (
    instruction.taskType === 'audit' &&
    auditInstructionPacket &&
    'compiledPromptRef' in auditInstructionPacket
  ) {
    try {
      const packet = auditInstructionPacket as ExecutionPacket;
      const planPath = packet.auditTriadExecutionPlanRef!.path;
      const finalizeCurrentAuditEpoch = (roundReceiptPaths: string[]): MainAgentRunLoopResult => {
        if (!activeRecordPath) {
          throw new Error('audit_controlled_executor_requirement_record_missing');
        }
        const finalization = finalizeAuditControlledExecution({
          projectRoot: input.projectRoot,
          recordPath: activeRecordPath,
          instruction,
          planPath,
          roundReceiptPaths,
          currentStage: input.stage,
        });
        steps.push({
          step: 'audit-controlled-executor.finalize',
          status: finalization.decision === 'pass' ? 'pass' : 'fail',
          summary: `decision=${finalization.decision}, receipt=${relativePathFromRoot(
            input.projectRoot,
            finalization.finalizationReceiptPath
          )}`,
        });
        steps.push({
          step: 'task-report.ingest',
          status: finalization.taskReport.status === 'done' ? 'pass' : 'fail',
          summary: `report=${finalization.taskReport.status}, nextAction=${finalization.nextAction}`,
        });
        const finalSurface = resolveMainAgentOrchestrationSurface({
          ...surfaceInput,
        });
        return {
          runId: `main-agent-run-loop-${Date.now()}`,
          status: finalization.taskReport.status === 'done' ? 'completed' : 'blocked',
          steps,
          dispatchInstruction: instruction,
          taskReport: finalization.taskReport,
          finalSurface,
          mainAgentStageSummary: finalSurface.mainAgentStageSummary,
        };
      };
      const auditState = materializeAuditReadonlyAuditorRequest({
        projectRoot: input.projectRoot,
        packet,
      });
      if (auditState.status === 'rounds_complete') {
        return finalizeCurrentAuditEpoch(auditState.roundReceiptPaths);
      }
      steps.push({
        step: 'audit-controlled-executor.readonly-auditor-request',
        status: 'skip',
        summary: `round=${auditState.roundIndex}, status=${auditState.status}, request=${relativePathFromRoot(
          input.projectRoot,
          auditState.requestPath
        )}`,
      });
      let readyAuditState = auditState;
      if (auditState.status === 'awaiting_response') {
        const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')) as AuditTriadExecutionPlan;
        executeAuditReadonlyAuditor({
          projectRoot: input.projectRoot,
          plan,
          state: auditState,
        });
        readyAuditState = {
          ...auditState,
          status: 'response_available',
        };
        steps.push({
          step: 'audit-controlled-executor.readonly-auditor-host',
          status: 'pass',
          summary: `round=${auditState.roundIndex}, response=${relativePathFromRoot(
            input.projectRoot,
            auditState.responsePath
          )}`,
        });
      }
      const round = materializeAuditControlledRound({
        projectRoot: input.projectRoot,
        planPath,
        state: readyAuditState,
      });
      steps.push({
        step: 'audit-controlled-executor.judge',
        status: isAuditTriadNoNewGapVerdict(round.verdict) ? 'pass' : 'fail',
        summary: `round=${round.roundIndex}, verdict=${round.verdict}, gaps=${
          round.validatedGapRefs.join(',') || 'none'
        }`,
      });
      if (!isAuditTriadNoNewGapVerdict(round.verdict) && round.verdict !== 'new_valid_gap') {
        throw new Error(`audit_judge_verdict_not_convergent:${round.verdict}`);
      }
      if (round.verdict === 'new_valid_gap') {
        if (round.validatedGapRefs.length === 0) {
          throw new Error('audit_judge_new_valid_gap_without_validated_gap');
        }
        const remediation = materializeAuditGapRemediationDispatch({
          projectRoot: input.projectRoot,
          recordPath:
            activeRecordPath ??
            (() => {
              throw new Error('audit_controlled_executor_requirement_record_missing');
            })(),
          instruction,
          planPath,
          round,
          currentStage: input.stage,
        });
        steps.push({
          step: 'audit-controlled-executor.remediation-dispatch',
          status: 'pass',
          summary: `gaps=${round.validatedGapRefs.length}, dispatch=${relativePathFromRoot(
            input.projectRoot,
            remediation.feedbackDispatchPath
          )}`,
        });
        steps.push({
          step: 'task-report.ingest',
          status: 'fail',
          summary: `report=${remediation.taskReport.status}, nextAction=${remediation.nextAction}`,
        });
        const finalSurface = resolveMainAgentOrchestrationSurface({
          ...surfaceInput,
        });
        return {
          runId: `main-agent-run-loop-${Date.now()}`,
          status: 'blocked',
          steps,
          dispatchInstruction: instruction,
          taskReport: remediation.taskReport,
          finalSurface,
          mainAgentStageSummary: finalSurface.mainAgentStageSummary,
        };
      }
      const nextAuditState = materializeAuditReadonlyAuditorRequest({
        projectRoot: input.projectRoot,
        packet,
      });
      if (nextAuditState.status === 'rounds_complete') {
        return finalizeCurrentAuditEpoch(nextAuditState.roundReceiptPaths);
      }
      steps.push({
        step: 'audit-controlled-executor.readonly-auditor-request',
        status: 'skip',
        summary: `round=${nextAuditState.roundIndex}, status=${nextAuditState.status}, request=${relativePathFromRoot(
          input.projectRoot,
          nextAuditState.requestPath
        )}`,
      });
      const finalSurface = resolveMainAgentOrchestrationSurface({
        ...surfaceInput,
      });
      return {
        runId: `main-agent-run-loop-${Date.now()}`,
        status: 'blocked',
        steps,
        dispatchInstruction: instruction,
        taskReport: null,
        finalSurface,
        mainAgentStageSummary: finalSurface.mainAgentStageSummary,
      };
    } catch (error) {
      const finalSurface = resolveMainAgentOrchestrationSurface({
        ...surfaceInput,
      });
      return {
        runId: `main-agent-run-loop-${Date.now()}`,
        status: 'blocked',
        steps: [
          ...steps,
          {
            step: 'audit-controlled-executor.readonly-auditor-request',
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
  }

  if (isNativeGoalExecutionPacket(instruction, args)) {
    try {
      if (!activeRecordPath || !activeRecord) {
        throw new Error('native_goal_active_requirement_record_missing');
      }
      const compiledPromptRef = instruction.packet.compiledPromptRef;
      if (!compiledPromptRef) {
        throw new Error('native_goal_compiled_prompt_ref_missing');
      }
      const modelPacketRead = readModelPacketForCompiledRef(input.projectRoot, compiledPromptRef);
      if (!modelPacketRead.modelPacket || modelPacketRead.issueCodes.length > 0) {
        throw new Error(`native_goal_model_packet_invalid:${modelPacketRead.issueCodes.join(',')}`);
      }
      const nativeTaskReportPath =
        normalizeText(compiledPromptRef.taskReportPath) ||
        defaultRunLoopTaskReportPath(
          input.projectRoot,
          instruction.sessionId,
          instruction.packetId
        );
      const governedCampaign =
        instruction.packet.executionStrategy?.strategyId === 'governed_skill_adapter'
          ? (() => {
              const pointerPath = canonicalCurrentDispatchPointerPath(input.projectRoot);
              const pointerResolution = resolveCurrentDispatchPointer({
                authorityRoot: input.projectRoot,
                pointerPath,
                expected: currentDispatchPointerExpectedIdentityFromRecord(activeRecord),
              });
              const binding = resolveCampaignRuntimeBinding({
                pointerPath,
                pointerHash: pointerResolution.pointerHash,
                packetPath: instruction.packetPath,
                packetHash: sha256File(instruction.packetPath),
                pointer: pointerResolution.pointer,
                packet: instruction.packet as unknown as Record<string, unknown>,
              });
              return {
                children: binding.binding.children as Array<Record<string, unknown>>,
                requirementRecordBinding: (modelPacketRead.modelPacket.requirementRecordBinding as
                  | Record<string, unknown>
                  | undefined) ?? { status: 'absent' },
                packageRequestRef: binding.binding.packageRequestRef,
                partitionManifestRef: binding.binding.partitionManifestRef,
                dependencies: {
                  ...binding.dependencies,
                  persistTaskReport: () => undefined,
                },
              };
            })()
          : undefined;
      const nativeResult: NativeGoalInvocationResult = runNativeGoalInvocation({
        projectRoot: input.projectRoot,
        host: instruction.host,
        packet: instruction.packet,
        compiledPromptRef,
        taskReportPath: nativeTaskReportPath,
        attemptBundle: nativeGoalAttemptBundleFromCurrentPointer({
          projectRoot: input.projectRoot,
          record: activeRecord,
          compiledPromptRef,
        }),
        recordId: input.recordId ?? normalizeText(activeRecord.recordId),
        attemptId: instruction.packetId,
        timeoutMs: Number(args.codexTimeoutMs) > 0 ? Number(args.codexTimeoutMs) : undefined,
        executor: input.nativeGoalExecutor,
        governedCampaign,
      });
      const exactStatePath = path.join(
        orchestrationStateDirForRecordPath(input.projectRoot, activeRecordPath),
        `${instruction.sessionId}.json`
      );
      recordNativeGoalHandoff({
        projectRoot: input.projectRoot,
        recordPath: activeRecordPath,
        sessionId: instruction.sessionId,
        orchestrationStatePath: exactStatePath,
        host: instruction.host,
        packet: instruction.packet,
        packetPath: instruction.packetPath,
        modelPacket: modelPacketRead.modelPacket,
        invocationReceiptPath: nativeResult.receiptPath,
        invoked: true,
        imported: false,
        importStatus:
          nativeResult.status === 'awaiting_task_report'
            ? 'awaiting_task_report'
            : nativeResult.status === 'awaiting_user_acceptance'
              ? 'awaiting_user_acceptance'
              : nativeResult.status === 'executed'
                ? 'native_goal_execution_completed'
                : 'native_goal_execution_failed',
        closeoutAttemptId: nativeResult.closeoutAttemptId,
        taskReportCandidatePath: nativeResult.taskReportCandidatePath,
        taskReportArtifactHash: nativeResult.taskReportArtifactHash,
        controlledCloseoutIngested: nativeResult.controlledCloseoutIngested,
        controlledCloseout: nativeResult.controlledCloseout,
      });
      steps.push({
        step: 'native-goal-invocation',
        status:
          nativeResult.status === 'executed'
            ? 'pass'
            : nativeResult.status === 'awaiting_user_acceptance'
              ? 'pass'
              : nativeResult.status === 'awaiting_task_report'
                ? 'skip'
                : 'fail',
        summary: `status=${nativeResult.status}, command=${nativeResult.command}, report=${path.relative(
          input.projectRoot,
          nativeResult.taskReportPath
        )}, errors=${nativeResult.validationErrors.join(',') || 'none'}`,
      });
      if (nativeResult.status === 'awaiting_user_acceptance') {
        const finalSurface = resolveMainAgentOrchestrationSurface({
          ...surfaceInput,
        });
        return {
          runId: `main-agent-run-loop-${Date.now()}`,
          status: 'awaiting_user_acceptance',
          steps,
          dispatchInstruction: instruction,
          taskReport: null,
          closeoutAttemptId: nativeResult.closeoutAttemptId,
          taskReportCandidatePath: nativeResult.taskReportCandidatePath,
          taskReportArtifactHash: nativeResult.taskReportArtifactHash,
          controlledCloseoutIngested: nativeResult.controlledCloseoutIngested,
          controlledCloseout: nativeResult.controlledCloseout,
          finalSurface,
          mainAgentStageSummary: finalSurface.mainAgentStageSummary,
        };
      }
      if (nativeResult.status !== 'executed' || !nativeResult.taskReport) {
        const finalSurface = resolveMainAgentOrchestrationSurface({
          ...surfaceInput,
        });
        return {
          runId: `main-agent-run-loop-${Date.now()}`,
          status: 'blocked',
          steps,
          dispatchInstruction: instruction,
          taskReport: null,
          finalSurface,
          mainAgentStageSummary: finalSurface.mainAgentStageSummary,
        };
      }

      const imported = importNativeGoalTaskReport({
        projectRoot: input.projectRoot,
        flow: input.flow,
        stage: input.stage,
        recordId: input.recordId,
        requirementSetId: input.requirementSetId,
        runId: input.runId,
        taskReportPath: nativeResult.taskReportPath,
      });
      steps.push({
        step: 'native-goal-task-report.ingest',
        status: imported.status === 'imported' ? 'pass' : 'fail',
        summary:
          imported.status === 'imported'
            ? `report=${nativeResult.taskReport.status}, nextAction=${imported.nextAction}`
            : imported.validationErrors.join(','),
      });
      const finalSurface = resolveMainAgentOrchestrationSurface({
        ...surfaceInput,
      });
      return {
        runId: `main-agent-run-loop-${Date.now()}`,
        status:
          imported.status === 'imported' && nativeResult.taskReport.status === 'done'
            ? 'completed'
            : 'blocked',
        steps,
        dispatchInstruction: instruction,
        taskReport: nativeResult.taskReport,
        finalSurface,
        mainAgentStageSummary: finalSurface.mainAgentStageSummary,
      };
    } catch (error) {
      const finalSurface = resolveMainAgentOrchestrationSurface({
        ...surfaceInput,
      });
      return {
        runId: `main-agent-run-loop-${Date.now()}`,
        status: 'blocked',
        steps: [
          ...steps,
          {
            step: 'native-goal-invocation',
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
  }

  let taskReport: TaskReport | null = null;
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
      taskReport = mainSessionExecutionRequiredTaskReport(instruction);
      steps.push({
        step: 'main-session-execution-handoff',
        status: 'fail',
        summary: `packet=${path.relative(input.projectRoot, instruction.packetPath)}`,
      });
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
  const instructionPacket = instruction.packet;
  const executionPacket =
    instructionPacket &&
    'compiledPromptRef' in instructionPacket &&
    instructionPacket.compiledPromptRef
      ? (instructionPacket as ExecutionPacket)
      : null;
  const externalTaskReportRequiresCommandReceipts = Boolean(normalizeText(args.taskReportPath));
  if (executionPacket?.compiledPromptRef || externalTaskReportRequiresCommandReceipts) {
    const repairCompiledPromptRef =
      executionPacket?.auditRepairContext && activeRecordPath
        ? currentCompiledPromptRefFromDispatchPointer({
            projectRoot: input.projectRoot,
            record: readJsonIfExists(activeRecordPath),
          })
        : null;
    const modelPacketRead = readModelPacketForCompiledRef(
      input.projectRoot,
      repairCompiledPromptRef ?? executionPacket?.compiledPromptRef
    );
    const commandReceiptValidation = validateModelPacketCommandExecutionReceipts({
      projectRoot: input.projectRoot,
      modelPacket: modelPacketRead.modelPacket,
      requireCommandDescriptors: externalTaskReportRequiresCommandReceipts,
    });
    const receiptIssues = [...modelPacketRead.issueCodes, ...commandReceiptValidation.issueCodes];
    if (receiptIssues.length > 0) {
      taskReport = {
        ...taskReport,
        status: 'blocked',
        evidence: [
          ...taskReport.evidence,
          ...receiptIssues.map((issue) => `command Receipt validation blocked: ${issue}`),
        ],
        driftFlags: [
          ...new Set([
            ...(taskReport.driftFlags ?? []),
            'required-command-receipt-validation-failed',
          ]),
        ],
      };
    }
    steps.push({
      step: 'command-receipt.validate',
      status: receiptIssues.length === 0 ? 'pass' : 'fail',
      summary:
        receiptIssues.length === 0
          ? `commands=${commandReceiptValidation.commandIds.length}`
          : receiptIssues.join(','),
    });
  }
  let auditRepairReadyForReview = false;
  if (executionPacket?.auditRepairContext && taskReport) {
    const repairAuthority = auditRepairFreshAuthorityGate({
      projectRoot: input.projectRoot,
      recordPath: activeRecordPath,
      packet: executionPacket,
      taskReport,
    });
    taskReport = repairAuthority.taskReport;
    if (!repairAuthority.issueCode && repairAuthority.snapshot && taskReport.status === 'done') {
      const repairReceipt = materializeAuditMainAgentRepairReceipt({
        projectRoot: input.projectRoot,
        packet: executionPacket,
        taskReport,
        changedHashFields: repairAuthority.changedHashFields,
        snapshot: repairAuthority.snapshot,
      });
      taskReport = {
        ...taskReport,
        evidence: [
          ...new Set([
            ...taskReport.evidence,
            toRootRelativePath(input.projectRoot, repairReceipt.path),
          ]),
        ],
      };
      steps.push({
        step: 'audit-repair-receipt.materialize',
        status: 'pass',
        summary: `receipt=${toRootRelativePath(input.projectRoot, repairReceipt.path)}`,
      });
      auditRepairReadyForReview = true;
    }
    steps.push({
      step: 'audit-repair-authority.validate',
      status: repairAuthority.issueCode ? 'fail' : 'pass',
      summary: repairAuthority.issueCode
        ? repairAuthority.issueCode
        : `changedHashes=${repairAuthority.changedHashFields.join(',')}`,
    });
  }
  const completedState = ingestMainAgentTaskReport(
    input.projectRoot,
    instruction.sessionId,
    taskReport,
    {
      currentStage: input.stage,
      ...(auditRepairReadyForReview
        ? {
            nextActionHint: 'dispatch_review' as const,
            authoritativeNextActionHint: true,
          }
        : {}),
    }
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
  nativeGoalExecutor?: NativeGoalControlledExecutor;
}): Promise<MainAgentRunLoopResult> {
  assertMainAgentAuditControlInput(input);
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
  if (!diagnostic || input.executor || input.nativeGoalExecutor) {
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

  if (action === 'refresh-closeout-context') {
    try {
      const required = [
        args.sourceContextPath,
        args.outputContextPath,
        args.closeoutAttemptId,
        args.allowedWritePath,
      ];
      if (required.some((value) => !normalizeText(value))) {
        throw new Error('campaign_closeout_context_mismatch');
      }
      const result = refreshMainAgentCloseoutContext({
        projectRoot: root,
        sourceContextPath: args.sourceContextPath!,
        outputContextPath: args.outputContextPath!,
        closeoutAttemptId: args.closeoutAttemptId!,
        allowedWritePath: args.allowedWritePath!,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    } catch (error) {
      console.error(
        `main-agent-orchestration refresh-closeout-context: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 1;
    }
  }

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
    case 'import-native-goal-task-report': {
      const result = importNativeGoalTaskReport({
        projectRoot: root,
        recordId: args.recordId,
        requirementSetId: args.requirementSetId,
        runId: args.runId,
        flow,
        stage,
        taskReportPath: args.taskReportPath,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.status === 'imported' ? 0 : 1;
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
        nativeGoalExecutor:
          host === 'codex' || host === 'claude'
            ? createNativeGoalHostExecutor()
            : undefined,
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return mainAgentRunLoopExitCode(result.status);
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
  if (action === 'controlled-closeout') {
    try {
      const result = await runMainAgentControlledCloseoutCli(root, args);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result.status === 'awaiting_user_acceptance' ? 0 : 1;
    } catch (error) {
      console.error(
        `main-agent-orchestration controlled-closeout: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return 1;
    }
  }
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
      nativeGoalExecutor:
        host === 'codex' || host === 'claude' ? createNativeGoalHostExecutor() : undefined,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return mainAgentRunLoopExitCode(result.status);
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

export type MainAgentCanonicalJudgeRunRole = 'requirements_judge';

export interface MainAgentCanonicalJudgeRunDispatchInput {
  projectRoot: string;
  config: string;
  request: string;
  role: MainAgentCanonicalJudgeRunRole;
  attemptId: string;
  outputDir: string;
  controlledDispatchRef: unknown;
  callerVerdict?: unknown;
  callerFindings?: unknown;
  callerScope?: unknown;
  callerEffectivePass?: unknown;
  callerCloseoutAuthority?: unknown;
  directAdapterDispatch?: unknown;
}

export interface MainAgentCanonicalJudgeRunDispatch {
  schemaVersion: 'main-agent-canonical-judge-run-dispatch/v1';
  command: 'bmad-speckit judge run';
  argv: string[];
  role: MainAgentCanonicalJudgeRunRole;
  attemptId: string;
  controlledDispatchHash: string;
  roleInference: false;
  directAdapterDispatch: false;
  callerAuthorityInjection: false;
  dispatchHash: string;
  decision: 'pass';
}

function rejectMainAgentJudgeAuthorityInjection(input: {
  callerVerdict?: unknown;
  callerFindings?: unknown;
  callerScope?: unknown;
  callerEffectivePass?: unknown;
  callerCloseoutAuthority?: unknown;
  directAdapterDispatch?: unknown;
}): void {
  for (const key of [
    'callerVerdict',
    'callerFindings',
    'callerScope',
    'callerEffectivePass',
    'callerCloseoutAuthority',
  ] as const) {
    if (input[key] !== undefined) {
      throw new Error('main_agent_judge_bridge_caller_authority_injection');
    }
  }
  if (input.directAdapterDispatch === true) {
    throw new Error('main_agent_judge_bridge_direct_adapter_forbidden');
  }
}

export function buildMainAgentCanonicalJudgeRunDispatch(
  input: MainAgentCanonicalJudgeRunDispatchInput
): MainAgentCanonicalJudgeRunDispatch {
  rejectMainAgentJudgeAuthorityInjection(input);
  if (input.role !== 'requirements_judge') {
    throw new Error('main_agent_judge_run_role_explicit_required');
  }
  const controlledDispatch = recordObject(input.controlledDispatchRef);
  if (
    !normalizeText(controlledDispatch.packetId) ||
    !normalizeText(controlledDispatch.packetKind)
  ) {
    throw new Error('main_agent_judge_bridge_controlled_dispatch_invalid');
  }
  const argv = [
    'judge',
    'run',
    '--project-root',
    input.projectRoot,
    '--config',
    input.config,
    '--request',
    input.request,
    '--role',
    input.role,
    '--attempt-id',
    input.attemptId,
    '--output-dir',
    input.outputDir,
    '--json',
  ];
  const controlledDispatchHash = sha256Json({
    packetId: normalizeText(controlledDispatch.packetId),
    packetKind: normalizeText(controlledDispatch.packetKind),
    route: controlledDispatch.route ?? null,
  });
  const payload = {
    schemaVersion: 'main-agent-canonical-judge-run-dispatch/v1' as const,
    command: 'bmad-speckit judge run' as const,
    argv,
    role: input.role,
    attemptId: input.attemptId,
    controlledDispatchHash,
    roleInference: false as const,
    directAdapterDispatch: false as const,
    callerAuthorityInjection: false as const,
  };
  return { ...payload, dispatchHash: sha256Json(payload), decision: 'pass' as const };
}

function controlledStableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(controlledStableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${controlledStableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? String(value);
}

function controlledHash(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

export function createJudgeStageStatusReceipt(input: {
  closeoutAttemptId: string;
  providerRef: string;
  actorClass?: 'bounded_code_reviewer' | 'final_acceptance_judge';
  logicalAttemptOrdinal: number;
  maxAttempts: number;
  sourceErrorCode: string;
  resumeFrom: string | null;
}) {
  const actorClass = input.actorClass ?? 'final_acceptance_judge';
  const sourceErrorCode = String(input.sourceErrorCode ?? '');
  const executionStatus =
    sourceErrorCode === 'PROVIDER_NOT_CONFIGURED'
      ? 'awaiting_provider_configuration'
      : /(?:401|403|AUTH)/iu.test(sourceErrorCode)
        ? 'provider_auth_required'
        : /(?:429|503|TIMEOUT|TEMPORAR)/iu.test(sourceErrorCode)
          ? 'provider_temporarily_unavailable'
          : 'provider_execution_error';
  if (
    !input.closeoutAttemptId ||
    !input.providerRef ||
    !Number.isInteger(input.logicalAttemptOrdinal) ||
    input.logicalAttemptOrdinal < 1 ||
    !Number.isInteger(input.maxAttempts) ||
    input.maxAttempts < input.logicalAttemptOrdinal
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  const payload = {
    schemaVersion: 'main-agent-goal-judge-stage-status-receipt/v1' as const,
    closeoutAttemptId: input.closeoutAttemptId,
    phase: actorClass === 'bounded_code_reviewer' ? ('reviewer' as const) : ('judge' as const),
    actorClass,
    executionStatus,
    auditDecision: 'not_produced' as const,
    providerRef: input.providerRef,
    logicalAttemptOrdinal: input.logicalAttemptOrdinal,
    maxAttempts: input.maxAttempts,
    resumeFrom: input.resumeFrom,
    sourceErrorCode,
  };
  return Object.freeze({
    ...payload,
    receiptHash: controlledHash(controlledStableJson(payload)),
  });
}

function judgeProviderSourceErrorCode(error: unknown): string {
  const source = recordObject(error);
  const status = Number(source.statusCode ?? source.status);
  if ([401, 403, 429, 503].includes(status)) return `HTTP_${status}`;
  const code = normalizeText(source.sourceErrorCode ?? source.code).toUpperCase();
  const message = `${code} ${error instanceof Error ? error.message : String(error)}`;
  if (/PROVIDER[_ -]?NOT[_ -]?CONFIGURED|PROVIDER[_ -]?MISSING/iu.test(message)) {
    return 'PROVIDER_NOT_CONFIGURED';
  }
  for (const httpStatus of [401, 403, 429, 503]) {
    if (new RegExp(`(?:HTTP[_ -]?)?${httpStatus}`, 'u').test(message)) {
      return `HTTP_${httpStatus}`;
    }
  }
  if (/ETIMEDOUT|TIMEOUT|TIMED OUT|ABORTED/iu.test(message)) return 'PROVIDER_TIMEOUT';
  if (/EMPTY[_ -]?RESPONSE/iu.test(message)) return 'EMPTY_RESPONSE';
  if (/SCHEMA[_ -]?INVALID|INVALID[_ -]?SCHEMA/iu.test(message)) return 'SCHEMA_INVALID';
  return 'PROVIDER_EXECUTION_ERROR';
}

export async function runMainAgentExecutionFinalJudgeCampaign(
  input: {
    campaignInput: MainAgentExecutionFinalJudgeCampaignInput;
    finalAcceptanceState?: unknown;
    closeoutAttemptId: string;
    logicalAttemptOrdinal: number;
    maxAttempts: number;
    resumeFrom: string | null;
    reusedFinalJudge?: {
      result: MainAgentExecutionFinalJudgeProducedResult;
      receipt: Record<string, unknown>;
    };
  },
  dependencies: Parameters<typeof executeMainAgentExecutionFinalJudgeCampaign>[1]
) {
  const result = await executeMainAgentExecutionFinalJudgeCampaign(
    {
      campaignInput: input.campaignInput,
      ...(input.reusedFinalJudge ? { reusedFinalJudge: input.reusedFinalJudge } : {}),
    },
    {
      ...dependencies,
      invokeFinalJudge: async (judgeInput) => {
        try {
          return await dependencies.invokeFinalJudge(judgeInput);
        } catch (error) {
          return {
            auditDecision: 'not_produced',
            sourceErrorCode: judgeProviderSourceErrorCode(error),
          };
        }
      },
    }
  );
  if (result.status !== 'not_produced') return result;
  const finalJudge = recordObject(result.finalJudge);
  const notProducedActor =
    result.notProducedActor === 'bounded_code_reviewer'
      ? 'bounded_code_reviewer'
      : 'final_acceptance_judge';
  const stageStatusReceipt = createJudgeStageStatusReceipt({
    closeoutAttemptId: input.closeoutAttemptId,
    providerRef: input.campaignInput.providerRef,
    actorClass: notProducedActor,
    logicalAttemptOrdinal: input.logicalAttemptOrdinal,
    maxAttempts: input.maxAttempts,
    sourceErrorCode:
      notProducedActor === 'bounded_code_reviewer'
        ? judgeProviderSourceErrorCode(result.sourceError)
        : normalizeText(finalJudge.sourceErrorCode) ||
          judgeProviderSourceErrorCode(result.sourceError),
    resumeFrom: input.resumeFrom,
  });
  return Object.freeze({
    ...result,
    effectivePassReceipt: null,
    reviewerStageStatusReceipt:
      notProducedActor === 'bounded_code_reviewer' ? stageStatusReceipt : null,
    judgeStageStatusReceipt:
      notProducedActor === 'final_acceptance_judge' ? stageStatusReceipt : null,
  });
}

type MainAgentControlledCloseoutCampaignDependencies = Parameters<
  typeof executeMainAgentExecutionFinalJudgeCampaign
>[1];

export interface MainAgentControlledCloseoutInput {
  projectRoot: string;
  contextPath: string;
  expectedContextHash: string;
  closureReceiptPath: string;
  outputRoot: string;
  judgeConfigPath: string;
  finalAcceptanceState?: unknown;
  judgePrompt: {
    systemPrompt: string;
    structuredOutputSchema?: Record<string, unknown>;
  };
  /** Test-only direct bridge; production callers use the goal finalization actor resolver. */
  invokeReviewer?: MainAgentControlledCloseoutCampaignDependencies['invokeReviewer'];
  /** Test-only direct bridge; production callers use the goal finalization actor resolver. */
  invokeFinalJudge?: MainAgentControlledCloseoutCampaignDependencies['invokeFinalJudge'];
  nativeReviewerTransport?: NativeReviewerTransport;
  nativeReviewerHost?: string;
  nativeReviewerTimeoutMs?: number;
  dispatchNativeReviewer?: NativeReviewerDispatch;
  executeClaudeCodeCliCommand?: (
    invocation: ClaudeCodeCliCommandInvocation
  ) => Promise<ClaudeCodeCliCommandResult>;
  executeCodexCliCommand?: (
    invocation: CodexCliCommandInvocation
  ) => Promise<CodexCliCommandResult>;
  logicalAttemptOrdinal?: number;
  resumeFrom?: string | null;
  resumeFromOutputRoot?: string | null;
}

export interface MainAgentControlledCloseoutResult {
  status: 'awaiting_user_acceptance' | 'not_produced' | 'blocked';
  closeoutAttemptId: string;
  contextHash: string;
  candidateBytesHash: string;
  producerReceipt: Record<string, unknown>;
  executionFinalJudgeCampaign: Record<string, unknown> | null;
  effectivePassReceipt: Record<string, unknown> | null;
  deliveryGateReceipt: Record<string, unknown> | null;
  judgeStageStatusReceipt: Record<string, unknown> | null;
  reviewerStageStatusReceipt?: Record<string, unknown> | null;
  finalJudgeReused?: boolean;
  receiptPaths: Record<string, string>;
}

export type MainAgentNativeHostCloseoutInput = Omit<
  MainAgentControlledCloseoutInput,
  'invokeReviewer' | 'invokeFinalJudge' | 'nativeReviewerTransport' | 'dispatchNativeReviewer'
> & {
  nativeReviewerHost?: string;
  nativeReviewerDispatch?: NativeReviewerDispatch;
};

/**
 * Host-facing product entry for the controlled closeout chain.
 * Native Reviewer routing is owned by the host bridge; Judge provider resolution remains in
 * `runMainAgentControlledCloseout` and is therefore independent from the host selection.
 * @param {MainAgentNativeHostCloseoutInput} input Controlled closeout input with optional native
 * Reviewer host routing.
 * @returns {Promise<MainAgentControlledCloseoutResult>} The controlled closeout result after native
 * Reviewer transport completes.
 */
export function runMainAgentControlledCloseoutFromNativeHost(
  input: MainAgentNativeHostCloseoutInput
): Promise<MainAgentControlledCloseoutResult> {
  return runMainAgentControlledCloseout(input);
}

export interface MainAgentControlledCloseoutCliDependencies {
  runCloseout?: (
    input: MainAgentNativeHostCloseoutInput
  ) => Promise<MainAgentControlledCloseoutResult>;
}

function controlledCloseoutDispatchPath(
  projectRoot: string,
  value: unknown,
  failureClass: string
): string {
  const configured = normalizeText(value);
  if (!configured) throw new Error(failureClass);
  const resolved = path.resolve(projectRoot, stripWrappingQuotes(configured));
  const root = path.resolve(projectRoot);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('campaign_closeout_path_escape');
  }
  return resolved;
}

function readControlledCloseoutDispatchObject(
  projectRoot: string,
  value: unknown,
  failureClass: string
): Record<string, unknown> {
  const sourcePath = controlledCloseoutDispatchPath(projectRoot, value, failureClass);
  const parsed = readJsonObjectFile(sourcePath);
  if (!parsed) throw new Error(failureClass);
  return parsed;
}

export async function runMainAgentControlledCloseoutCli(
  projectRoot: string,
  args: Record<string, string | undefined>,
  dependencies: MainAgentControlledCloseoutCliDependencies = {}
): Promise<MainAgentControlledCloseoutResult> {
  const dispatchPath = controlledCloseoutDispatchPath(
    projectRoot,
    args.input,
    'main_agent_controlled_closeout_dispatch_missing'
  );
  const dispatch = readJsonObjectFile(dispatchPath);
  if (dispatch?.schemaVersion !== 'main-agent-controlled-closeout-dispatch/v1') {
    throw new Error('main_agent_controlled_closeout_dispatch_invalid');
  }
  const judgePromptPath = controlledCloseoutDispatchPath(
    projectRoot,
    dispatch.judgePromptPath,
    'main_agent_judge_system_prompt_missing'
  );
  if (!fs.existsSync(judgePromptPath) || !fs.statSync(judgePromptPath).isFile()) {
    throw new Error('main_agent_judge_system_prompt_missing');
  }
  const structuredOutputSchemaPath = normalizeText(dispatch.judgeStructuredOutputSchemaPath);
  const structuredOutputSchema = structuredOutputSchemaPath
    ? readControlledCloseoutDispatchObject(
        projectRoot,
        structuredOutputSchemaPath,
        'main_agent_judge_structured_output_schema_invalid'
      )
    : undefined;
  const runCloseout = dependencies.runCloseout ?? runMainAgentControlledCloseoutFromNativeHost;
  const nativeReviewerTimeoutMs = Number(dispatch.nativeReviewerTimeoutMs);
  if (
    dispatch.nativeReviewerTimeoutMs !== undefined &&
    (!Number.isInteger(nativeReviewerTimeoutMs) || nativeReviewerTimeoutMs < 1)
  ) {
    throw new Error('main_agent_native_reviewer_timeout_invalid');
  }
  return runCloseout({
    projectRoot: path.resolve(projectRoot),
    contextPath: normalizeText(dispatch.contextPath),
    expectedContextHash: normalizeText(dispatch.expectedContextHash),
    closureReceiptPath: normalizeText(dispatch.closureReceiptPath),
    outputRoot: normalizeText(dispatch.outputRoot),
    judgeConfigPath: normalizeText(dispatch.judgeConfigPath),
    judgePrompt: {
      systemPrompt: fs.readFileSync(judgePromptPath, 'utf8'),
      ...(structuredOutputSchema ? { structuredOutputSchema } : {}),
    },
    nativeReviewerHost:
      normalizeText(dispatch.nativeReviewerHost) || normalizeText(args.host) || 'codex',
    ...(Number.isInteger(nativeReviewerTimeoutMs) ? { nativeReviewerTimeoutMs } : {}),
    ...(Number.isInteger(Number(dispatch.logicalAttemptOrdinal))
      ? { logicalAttemptOrdinal: Number(dispatch.logicalAttemptOrdinal) }
      : {}),
    ...(normalizeText(dispatch.resumeFrom)
      ? { resumeFrom: normalizeText(dispatch.resumeFrom) }
      : {}),
    ...(normalizeText(dispatch.resumeFromOutputRoot)
      ? { resumeFromOutputRoot: normalizeText(dispatch.resumeFromOutputRoot) }
      : {}),
  });
}

export interface MainAgentCloseoutContextRefreshInput {
  projectRoot: string;
  sourceContextPath: string;
  outputContextPath: string;
  closeoutAttemptId: string;
  allowedWritePath: string;
}

export interface MainAgentCloseoutContextRefreshResult {
  status: 'refreshed';
  sourceContextPath: string;
  contextPath: string;
  closeoutAttemptId: string;
  contextHash: string;
  validationMaterialization: {
    head: string;
    tree: string;
    algorithm: 'raw-tracked-v1';
    hash: string;
  };
}

function closeoutProducerSorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(closeoutProducerSorted);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = closeoutProducerSorted((value as Record<string, unknown>)[key]);
      return result;
    }, {});
}

function closeoutProducerStableJson(value: unknown): string {
  return `${JSON.stringify(closeoutProducerSorted(value), null, 2)}\n`;
}

function closeoutProducerHash(value: unknown): string {
  return `sha256:${crypto
    .createHash('sha256')
    .update(closeoutProducerStableJson(value), 'utf8')
    .digest('hex')}`;
}

export function refreshMainAgentCloseoutContext(
  input: MainAgentCloseoutContextRefreshInput
): MainAgentCloseoutContextRefreshResult {
  const projectRoot = path.resolve(input.projectRoot);
  const sourceContextPath = path.resolve(projectRoot, input.sourceContextPath);
  const outputContextPath = path.resolve(projectRoot, input.outputContextPath);
  const closeoutAttemptId = normalizeText(input.closeoutAttemptId);
  const allowedWritePath = normalizeText(input.allowedWritePath);
  if (!closeoutAttemptId || !allowedWritePath) {
    throw new Error('campaign_closeout_context_mismatch');
  }
  const sourceContext = readMainAgentCloseoutJson(
    sourceContextPath,
    'campaign_closeout_context_mismatch'
  );
  const sourceContextHash = requireMainAgentCloseoutHash(
    sourceContext.contextHash,
    'campaign_closeout_context_mismatch'
  );
  const { contextHash: _sourceContextHash, ...sourceContextCore } = sourceContext;
  if (closeoutProducerHash(sourceContextCore) !== sourceContextHash) {
    throw new Error('campaign_closeout_context_mismatch');
  }
  const packageBinding = recordObject(sourceContext.package);
  const manifestPath = resolveMainAgentCloseoutPath(
    projectRoot,
    packageBinding.manifestPath,
    'campaign_closeout_path_escape'
  );
  const manifest = readMainAgentCloseoutJson(
    manifestPath,
    'campaign_closeout_compile_binding_mismatch'
  );
  const repositoryRoot = path.resolve(projectRoot, normalizeText(manifest.repositoryRoot));
  if (!fs.existsSync(repositoryRoot) || !fs.statSync(repositoryRoot).isDirectory()) {
    throw new Error('campaign_closeout_path_escape');
  }
  const producerPath = path.resolve(
    projectRoot,
    '_bmad/skills/goal-subcontract-execution-package-generator/scripts/close-completed-campaign.js'
  );
  let captureRawTrackedMaterialization: (root: string) => {
    head: string;
    tree: string;
    hash: string;
  };
  try {
    const producer = requireCommonJs(producerPath) as Record<string, unknown>;
    if (typeof producer.captureRawTrackedMaterialization !== 'function') {
      throw new Error('campaign_closeout_context_mismatch');
    }
    captureRawTrackedMaterialization =
      producer.captureRawTrackedMaterialization as typeof captureRawTrackedMaterialization;
  } catch (error) {
    if (error instanceof Error && error.message === 'campaign_closeout_context_mismatch') {
      throw error;
    }
    throw new Error('campaign_closeout_context_mismatch');
  }
  const materialization = captureRawTrackedMaterialization(repositoryRoot);
  const compileReceipt = recordObject(sourceContext.compileReceipt);
  const validationMaterialization = {
    ...recordObject(sourceContext.validationMaterialization),
    head: materialization.head,
    tree: materialization.tree,
    algorithm: 'raw-tracked-v1' as const,
    hash: materialization.hash,
  };
  const refreshedCore = {
    ...sourceContextCore,
    closeoutAttemptId,
    allowedWritePaths: [allowedWritePath],
    allowedWritePathSetHash: closeoutProducerHash([allowedWritePath]),
    compileReceipt: {
      ...compileReceipt,
      validationHead: materialization.head,
      validationTree: materialization.tree,
    },
    validationMaterialization,
  };
  const refreshedContext = {
    ...refreshedCore,
    contextHash: closeoutProducerHash(refreshedCore),
  };
  writeJsonCreateOnlyOrEqual(
    outputContextPath,
    refreshedContext,
    'campaign_closeout_target_exists'
  );
  return {
    status: 'refreshed',
    sourceContextPath,
    contextPath: outputContextPath,
    closeoutAttemptId,
    contextHash: refreshedContext.contextHash,
    validationMaterialization,
  };
}

function resolveMainAgentCloseoutPath(root: string, value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(code);
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(code);
  return resolved;
}

function requireMainAgentCloseoutHash(value: unknown, code: string): string {
  const normalized = normalizeText(value);
  if (!/^sha256:[a-f0-9]{64}$/u.test(normalized)) throw new Error(code);
  return normalized;
}

function readMainAgentCloseoutJson(filePath: string, code: string): Record<string, unknown> {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return recordObject(value);
  } catch {
    throw new Error(code);
  }
}

function validateMainAgentCloseoutSource(input: {
  projectRoot: string;
  contextPath: string;
  expectedContextHash: string;
  closureReceiptPath: string;
}) {
  const context = readMainAgentCloseoutJson(
    input.contextPath,
    'campaign_closeout_context_mismatch'
  );
  const contextHash = requireMainAgentCloseoutHash(
    context.contextHash,
    'campaign_closeout_context_mismatch'
  );
  if (contextHash !== input.expectedContextHash) {
    throw new Error('campaign_closeout_context_mismatch');
  }
  const { contextHash: _contextHash, ...contextCore } = context;
  if (closeoutProducerHash(contextCore) !== contextHash) {
    throw new Error('campaign_closeout_context_mismatch');
  }
  const closureReceipt = readMainAgentCloseoutJson(
    input.closureReceiptPath,
    'main_agent_goal_task_report_provenance_mismatch'
  );
  const closureReceiptHash = requireMainAgentCloseoutHash(
    closureReceipt.receiptHash,
    'main_agent_goal_task_report_provenance_mismatch'
  );
  const { receiptHash: _receiptHash, ...closureCore } = closureReceipt;
  if (
    closeoutProducerHash(closureCore) !== closureReceiptHash ||
    closureReceipt.status !== 'campaign_closed' ||
    closureReceipt.contextHash !== contextHash ||
    closureReceipt.closeoutAttemptId !== context.closeoutAttemptId
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  const candidatePath = resolveMainAgentCloseoutPath(
    path.dirname(input.closureReceiptPath),
    closureReceipt.taskReportCandidatePath,
    'main_agent_goal_task_report_provenance_mismatch'
  );
  if (
    !fs.existsSync(candidatePath) ||
    !fs.statSync(candidatePath).isFile() ||
    sha256File(candidatePath) !== closureReceipt.taskReportArtifactHash
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  const campaignReportPath = resolveMainAgentCloseoutPath(
    path.dirname(input.closureReceiptPath),
    closureReceipt.campaignReportPath,
    'main_agent_goal_task_report_provenance_mismatch'
  );
  if (!fs.existsSync(campaignReportPath) || !fs.statSync(campaignReportPath).isFile()) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  const packageBinding = recordObject(context.package);
  const campaignBinding = recordObject(context.campaign);
  const materialization = recordObject(context.validationMaterialization);
  const campaignId = normalizeText(packageBinding.packageId);
  const campaignLineageKey = requireMainAgentCloseoutHash(
    campaignBinding.activationHash,
    'campaign_closeout_context_mismatch'
  );
  const currentImplementationHash = requireMainAgentCloseoutHash(
    materialization.hash,
    'campaign_closeout_context_mismatch'
  );
  const currentEvidenceHash = controlledHash(
    controlledStableJson({
      childClosureSetHash: context.childClosureSetHash,
      finalValidationEvidenceSetHash: context.finalValidationEvidenceSetHash,
      collectionVerificationSetHash: context.collectionVerificationSetHash,
    })
  );
  if (!campaignId) throw new Error('campaign_closeout_context_mismatch');
  return {
    context,
    closureReceipt,
    contextHash,
    closureReceiptHash,
    candidatePath,
    candidateBytesHash: requireMainAgentCloseoutHash(
      closureReceipt.taskReportArtifactHash,
      'main_agent_goal_task_report_provenance_mismatch'
    ),
    campaignReportPath,
    campaignId,
    campaignLineageKey,
    currentImplementationHash,
    currentEvidenceHash,
  };
}

function mainAgentCloseoutProviderErrorCode(error: unknown): string {
  const source = recordObject(error);
  const status = Number(source.statusCode ?? source.status);
  if ([401, 403, 429, 503].includes(status)) return `HTTP_${status}`;
  const code = normalizeText(source.sourceErrorCode ?? source.code).toUpperCase();
  const message = `${code} ${error instanceof Error ? error.message : String(error)}`;
  if (
    /PROVIDER[_ -]?NOT[_ -]?CONFIGURED|PROVIDER[_ -]?MISSING|ACTIVE[_ -]?REF|ENOENT|CREDENTIAL[_ -]?MISSING|RUNTIME[_ -]?MISSING/iu.test(
      message
    )
  ) {
    return 'PROVIDER_NOT_CONFIGURED';
  }
  if (/NATIVE[_ -]?REVIEWER[_ -]?TRANSPORT[_ -]?NOT[_ -]?CONFIGURED/iu.test(message)) {
    return 'NATIVE_REVIEWER_TRANSPORT_NOT_CONFIGURED';
  }
  if (/ETIMEDOUT|TIMEOUT|TIMED OUT|ABORTED/iu.test(message)) return 'PROVIDER_TIMEOUT';
  if (/EMPTY[_ -]?RESPONSE/iu.test(message)) return 'EMPTY_RESPONSE';
  if (/SCHEMA[_ -]?INVALID|INVALID[_ -]?SCHEMA|NORMALIZED_RESPONSE_INVALID/iu.test(message)) {
    return 'SCHEMA_INVALID';
  }
  return code || 'PROVIDER_EXECUTION_ERROR';
}

function writeMainAgentControlledCloseoutReceipt(
  targetPath: string,
  payload: object
): Record<string, unknown> {
  const recordPayload = Object.fromEntries(Object.entries(payload));
  writeJsonCreateOnlyOrEqual(
    targetPath,
    recordPayload,
    'main_agent_goal_task_report_provenance_mismatch'
  );
  return recordPayload;
}

export function materializeMainAgentControlledCloseoutAcceptanceRequest(input: {
  projectRoot: string;
  markerPath: string;
  candidatePath: string;
  outputPath?: string;
  finalTaskReportPath?: string;
  completionReceiptPath?: string;
  confirmationPagePath?: string;
}) {
  const projectRoot = path.resolve(input.projectRoot);
  const markerPath = controlledGoalCloseoutPath(projectRoot, input.markerPath);
  const candidatePath = controlledGoalCloseoutPath(projectRoot, input.candidatePath);
  const outputPath = controlledGoalCloseoutPath(
    projectRoot,
    input.outputPath ?? path.join(path.dirname(markerPath), 'closeout-acceptance-request.json')
  );
  const finalTaskReportPath = controlledGoalCloseoutPath(
    projectRoot,
    input.finalTaskReportPath ?? path.join(path.dirname(candidatePath), 'task-report.json')
  );
  const completionReceiptPath = controlledGoalCloseoutPath(
    projectRoot,
    input.completionReceiptPath ??
      path.join(path.dirname(candidatePath), 'task-report.completion-receipt.json')
  );
  const confirmationPagePath = controlledGoalCloseoutPath(
    projectRoot,
    input.confirmationPagePath ??
      path.join(path.dirname(outputPath), 'confirmation', 'closeout-confirmation-current.html')
  );
  const marker = readJsonObjectFile(markerPath);
  const producerReceipt = recordObject(marker?.producerReceipt);
  const campaign = recordObject(marker?.executionFinalJudgeCampaign);
  const effectivePass = recordObject(marker?.effectivePassReceipt);
  const deliveryGate = recordObject(marker?.deliveryGateReceipt);
  const closeoutAttemptId = normalizeText(marker?.closeoutAttemptId);
  const contextHash = normalizeText(marker?.contextHash);
  const taskReportArtifactHash = normalizeText(marker?.candidateBytesHash);
  const provenanceHashes = {
    contextHash,
    compileReceiptHash: normalizeText(producerReceipt.compileReceiptHash),
    childClosureSetHash: normalizeText(producerReceipt.childClosureSetHash),
    campaignReportHash: normalizeText(producerReceipt.campaignReportHash),
    closureReceiptHash: normalizeText(producerReceipt.receiptHash),
    executionFinalJudgeCampaignHash: normalizeText(campaign.aggregateHash),
    effectivePassReceiptHash: normalizeText(effectivePass.effectivePassReceiptHash),
    deliveryCloseoutGateReceiptHash: normalizeText(deliveryGate.receiptHash),
  };
  const candidateRoot = path.dirname(candidatePath);
  if (
    marker?.status !== 'awaiting_user_acceptance' ||
    !closeoutAttemptId ||
    producerReceipt.status !== 'campaign_closed' ||
    normalizeText(producerReceipt.closeoutAttemptId) !== closeoutAttemptId ||
    normalizeText(campaign.closeoutAttemptId) !== closeoutAttemptId ||
    normalizeText(deliveryGate.closeoutAttemptId) !== closeoutAttemptId ||
    normalizeText(producerReceipt.contextHash) !== contextHash ||
    normalizeText(producerReceipt.taskReportArtifactHash) !== taskReportArtifactHash ||
    normalizeText(campaign.candidateBytesHash) !== taskReportArtifactHash ||
    effectivePass.effectivePass !== true ||
    deliveryGate.status !== 'awaiting_user_acceptance' ||
    Object.values(provenanceHashes).some((value) => !/^sha256:[a-f0-9]{64}$/u.test(value)) ||
    !/^sha256:[a-f0-9]{64}$/u.test(taskReportArtifactHash) ||
    !fs.existsSync(candidatePath) ||
    sha256File(candidatePath) !== taskReportArtifactHash ||
    path.dirname(finalTaskReportPath) !== candidateRoot ||
    path.dirname(completionReceiptPath) !== candidateRoot ||
    fs.existsSync(finalTaskReportPath) ||
    fs.existsSync(completionReceiptPath)
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  const requestPayload = {
    schemaVersion: 'main-agent-controlled-closeout-acceptance-request/v1' as const,
    status: 'awaiting_user_acceptance' as const,
    closeoutAttemptId,
    markerPath,
    contextHash,
    taskReportCandidatePath: candidatePath,
    taskReportArtifactHash,
    finalTaskReportPath,
    completionReceiptPath,
    provenanceHashes,
  };
  const acceptanceRequestHash = controlledHash(controlledStableJson(requestPayload));
  const confirmationText = [
    '确认当前 Goal closeout 并关闭记录',
    `closeoutAttemptId=${closeoutAttemptId}`,
    `acceptanceRequestHash=${acceptanceRequestHash}`,
  ].join('\n');
  const rejectionConfirmationText = [
    '拒绝当前 Goal closeout 并保持阻塞',
    `closeoutAttemptId=${closeoutAttemptId}`,
    `acceptanceRequestHash=${acceptanceRequestHash}`,
  ].join('\n');
  const request = Object.freeze({
    ...requestPayload,
    acceptanceRequestHash,
    confirmationText,
    rejectionConfirmationText,
  });
  writeMainAgentControlledCloseoutReceipt(outputPath, request);
  materializeControlledCloseoutConfirmationPage({
    outputPath: confirmationPagePath,
    closeoutAttemptId,
    acceptanceRequestHash,
    taskReportArtifactHash,
    confirmationText,
    rejectionConfirmationText,
  });
  return request;
}

function requiredMainAgentCloseoutRecord(
  value: unknown,
  code = 'main_agent_goal_task_report_provenance_mismatch'
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return recordObject(value);
}

function nullableMainAgentCloseoutRecord(
  value: unknown
): Record<string, unknown> | null {
  return value === null
    ? null
    : requiredMainAgentCloseoutRecord(value);
}

function optionalMainAgentCloseoutStringArray(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('main_agent_goal_task_report_provenance_mismatch');
  const items = value.map((item) => (typeof item === 'string' ? item.trim() : ''));
  if (items.some((item) => !item) || new Set(items).size !== items.length) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  return items;
}

function isExecutionFinalFinding(value: unknown): value is ExecutionFinalFinding {
  const finding = recordObject(value);
  return (
    normalizeText(finding.findingId) !== '' &&
    ['critical', 'high', 'medium', 'low'].includes(normalizeText(finding.severity)) &&
    normalizeText(finding.dimensionId) !== '' &&
    [
      'dimension',
      'artifact',
      'obligation',
      'execution_result',
      'command',
      'evidence',
      'delivery_claim',
    ].includes(normalizeText(finding.subjectKind)) &&
    normalizeText(finding.subjectId) !== '' &&
    Array.isArray(finding.evidenceRefs) &&
    finding.evidenceRefs.every((item) => typeof item === 'string' && item.trim() !== '') &&
    normalizeText(finding.issueCode) !== '' &&
    [
      'requirements_successor',
      'architecture_successor',
      'readiness_recheck',
      'execution_authority',
      'campaign_closure',
      'delivery_claim',
    ].includes(normalizeText(finding.remediationOwner))
  );
}

function optionalExecutionFinalFindings(value: unknown): ExecutionFinalFinding[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || !value.every(isExecutionFinalFinding)) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  return value;
}

function readMainAgentControlledCloseoutResult(value: unknown): MainAgentControlledCloseoutResult {
  const result = requiredMainAgentCloseoutRecord(value);
  const status = result.status;
  if (!['awaiting_user_acceptance', 'not_produced', 'blocked'].includes(String(status))) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  const closeoutAttemptId = normalizeText(result.closeoutAttemptId);
  const contextHash = requireMainAgentCloseoutHash(
    result.contextHash,
    'main_agent_goal_task_report_provenance_mismatch'
  );
  const candidateBytesHash = requireMainAgentCloseoutHash(
    result.candidateBytesHash,
    'main_agent_goal_task_report_provenance_mismatch'
  );
  const receiptPathsSource = requiredMainAgentCloseoutRecord(result.receiptPaths);
  const receiptPaths = Object.fromEntries(
    Object.entries(receiptPathsSource).map(([key, item]) => {
      const receiptPath = normalizeText(item);
      if (!key || !receiptPath) throw new Error('main_agent_goal_task_report_provenance_mismatch');
      return [key, receiptPath];
    })
  );
  if (!closeoutAttemptId || Object.keys(receiptPaths).length === 0) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  const normalizedStatus: MainAgentControlledCloseoutResult['status'] =
    status === 'awaiting_user_acceptance'
      ? 'awaiting_user_acceptance'
      : status === 'not_produced'
        ? 'not_produced'
        : 'blocked';
  return {
    status: normalizedStatus,
    closeoutAttemptId,
    contextHash,
    candidateBytesHash,
    producerReceipt: requiredMainAgentCloseoutRecord(result.producerReceipt),
    executionFinalJudgeCampaign: nullableMainAgentCloseoutRecord(
      result.executionFinalJudgeCampaign
    ),
    effectivePassReceipt: nullableMainAgentCloseoutRecord(result.effectivePassReceipt),
    deliveryGateReceipt: nullableMainAgentCloseoutRecord(result.deliveryGateReceipt),
    judgeStageStatusReceipt: nullableMainAgentCloseoutRecord(result.judgeStageStatusReceipt),
    ...(result.reviewerStageStatusReceipt === undefined
      ? {}
      : {
          reviewerStageStatusReceipt: nullableMainAgentCloseoutRecord(
            result.reviewerStageStatusReceipt
          ),
        }),
    ...(result.finalJudgeReused === undefined
      ? {}
      : typeof result.finalJudgeReused === 'boolean'
        ? { finalJudgeReused: result.finalJudgeReused }
        : (() => {
            throw new Error('main_agent_goal_task_report_provenance_mismatch');
          })()),
    receiptPaths,
  };
}

function readReusableFinalJudgeResult(
  value: unknown,
  receiptValue: unknown
): MainAgentExecutionFinalJudgeProducedResult {
  const result = recordObject(value);
  const receipt = requiredMainAgentCloseoutRecord(receiptValue);
  const sourceLedgerHash = normalizeText(result.sourceLedgerHash);
  const auditDecision = normalizeText(result.auditDecision);
  const verdict = normalizeText(result.verdict);
  const findingIds = optionalMainAgentCloseoutStringArray(result.findingIds) ?? [];
  const dispatchGroupId = requireMainAgentCloseoutHash(
    receipt.dispatchGroupId,
    'main_agent_goal_task_report_provenance_mismatch'
  );
  const actorIsolationReceipt = validateMainAgentExecutionActorIsolationReceipt(
    { actorClass: 'final_acceptance_judge', dispatchGroupId },
    result.actorIsolationReceipt
  );
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(sourceLedgerHash) ||
    !['pass', 'fail'].includes(auditDecision) ||
    !['coverage_satisfied', 'findings_present', 'insufficient_evidence', 'blocked'].includes(
      verdict
    ) ||
    receipt.actorClass !== 'final_acceptance_judge' ||
    normalizeText(receipt.sourceLedgerHash) !== sourceLedgerHash ||
    normalizeText(receipt.actorIsolationReceiptHash) !==
      actorIsolationReceipt.isolationReceiptHash
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  return {
    sourceLedgerHash,
    actorIsolationReceipt,
    auditDecision: auditDecision === 'pass' ? 'pass' : 'fail',
    verdict:
      verdict === 'coverage_satisfied'
        ? 'coverage_satisfied'
        : verdict === 'findings_present'
          ? 'findings_present'
          : verdict === 'insufficient_evidence'
            ? 'insufficient_evidence'
            : 'blocked',
    findingIds,
    ...(optionalMainAgentCloseoutStringArray(result.coveredDimensionIds) === undefined
      ? {}
      : { coveredDimensionIds: optionalMainAgentCloseoutStringArray(result.coveredDimensionIds) }),
    ...(optionalMainAgentCloseoutStringArray(result.coveredArtifactIds) === undefined
      ? {}
      : { coveredArtifactIds: optionalMainAgentCloseoutStringArray(result.coveredArtifactIds) }),
    ...(optionalMainAgentCloseoutStringArray(result.coveredObligationIds) === undefined
      ? {}
      : {
          coveredObligationIds: optionalMainAgentCloseoutStringArray(result.coveredObligationIds),
        }),
    ...(optionalMainAgentCloseoutStringArray(result.coveredExecutionResultIds) === undefined
      ? {}
      : {
          coveredExecutionResultIds: optionalMainAgentCloseoutStringArray(
            result.coveredExecutionResultIds
          ),
        }),
    ...(optionalMainAgentCloseoutStringArray(result.coveredCommandIds) === undefined
      ? {}
      : { coveredCommandIds: optionalMainAgentCloseoutStringArray(result.coveredCommandIds) }),
    ...(optionalMainAgentCloseoutStringArray(result.coveredEvidenceIds) === undefined
      ? {}
      : { coveredEvidenceIds: optionalMainAgentCloseoutStringArray(result.coveredEvidenceIds) }),
    ...(optionalMainAgentCloseoutStringArray(result.coveredDeliveryClaimIds) === undefined
      ? {}
      : {
          coveredDeliveryClaimIds: optionalMainAgentCloseoutStringArray(
            result.coveredDeliveryClaimIds
          ),
        }),
    ...(optionalExecutionFinalFindings(result.findings) === undefined
      ? {}
      : { findings: optionalExecutionFinalFindings(result.findings) }),
  };
}

export async function runMainAgentControlledCloseout(
  input: MainAgentControlledCloseoutInput
): Promise<MainAgentControlledCloseoutResult> {
  if (!normalizeText(input.judgePrompt?.systemPrompt)) {
    throw new Error('main_agent_judge_system_prompt_missing');
  }
  const projectRoot = path.resolve(input.projectRoot);
  const contextPath = resolveMainAgentCloseoutPath(
    projectRoot,
    input.contextPath,
    'campaign_closeout_context_mismatch'
  );
  const closureReceiptPath = resolveMainAgentCloseoutPath(
    projectRoot,
    input.closureReceiptPath,
    'main_agent_goal_task_report_provenance_mismatch'
  );
  const outputRoot = resolveMainAgentCloseoutPath(
    projectRoot,
    input.outputRoot,
    'main_agent_goal_task_report_provenance_mismatch'
  );
  const source = validateMainAgentCloseoutSource({
    projectRoot,
    contextPath,
    expectedContextHash: input.expectedContextHash,
    closureReceiptPath,
  });
  const closeoutAttemptId = normalizeText(source.context.closeoutAttemptId);
  const receiptPaths = {
    input: path.join(outputRoot, 'execution-final-judge-campaign-input.json'),
    reviewer: path.join(outputRoot, 'reviewer-receipt.json'),
    finalJudge: path.join(outputRoot, 'final-judge-receipt.json'),
    aggregate: path.join(outputRoot, 'execution-final-judge-campaign-aggregate.json'),
    ingest: path.join(outputRoot, 'execution-final-judge-campaign-ingest.json'),
    effectivePass: path.join(outputRoot, 'execution-final-judge-effective-pass-receipt.json'),
    finalJudgeResult: path.join(outputRoot, 'final-judge-reuse-binding.json'),
    reviewerStageStatus: path.join(outputRoot, 'reviewer-stage-status-receipt.json'),
    stageStatus: path.join(outputRoot, 'judge-stage-status-receipt.json'),
    deliveryGate: path.join(outputRoot, 'delivery-closeout-gate-receipt.json'),
    acceptanceRequest: path.join(outputRoot, 'closeout-acceptance-request.json'),
    confirmationPage: path.join(outputRoot, 'confirmation', 'closeout-confirmation-current.html'),
    marker: path.join(outputRoot, 'main-agent-controlled-closeout.json'),
  };
  if (!closeoutAttemptId) throw new Error('campaign_closeout_context_mismatch');
  if (fs.existsSync(receiptPaths.marker)) {
    const existing = readMainAgentControlledCloseoutResult(
      readMainAgentCloseoutJson(
        receiptPaths.marker,
        'main_agent_goal_task_report_provenance_mismatch'
      )
    );
    if (
      existing.status === 'awaiting_user_acceptance' &&
      existing.closeoutAttemptId === closeoutAttemptId &&
      existing.contextHash === source.contextHash &&
      existing.candidateBytesHash === source.candidateBytesHash
    ) {
      materializeMainAgentControlledCloseoutAcceptanceRequest({
        projectRoot,
        markerPath: receiptPaths.marker,
        candidatePath: source.candidatePath,
        outputPath: receiptPaths.acceptanceRequest,
        confirmationPagePath: receiptPaths.confirmationPage,
      });
      return {
        ...existing,
        receiptPaths: {
          ...existing.receiptPaths,
          confirmationPage: receiptPaths.confirmationPage,
        },
      };
    }
    throw new Error('main_agent_execution_final_judge_campaign_duplicate_attempt');
  }
  if (fs.existsSync(outputRoot)) {
    throw new Error('main_agent_execution_final_judge_campaign_duplicate_attempt');
  }
  let reusedFinalJudge:
    | { result: MainAgentExecutionFinalJudgeProducedResult; receipt: Record<string, unknown> }
    | undefined;
  if (input.resumeFromOutputRoot) {
    const priorOutputRoot = resolveMainAgentCloseoutPath(
      projectRoot,
      input.resumeFromOutputRoot,
      'main_agent_goal_task_report_provenance_mismatch'
    );
    const priorMarker = readMainAgentCloseoutJson(
      path.join(priorOutputRoot, 'main-agent-controlled-closeout.json'),
      'main_agent_goal_task_report_provenance_mismatch'
    );
    const reviewerStage = recordObject(priorMarker.reviewerStageStatusReceipt);
    const binding = readMainAgentCloseoutJson(
      path.join(priorOutputRoot, 'final-judge-reuse-binding.json'),
      'main_agent_goal_task_report_provenance_mismatch'
    );
    if (
      priorMarker.status !== 'not_produced' ||
      normalizeText(priorMarker.closeoutAttemptId) !== closeoutAttemptId ||
      normalizeText(priorMarker.contextHash) !== source.contextHash ||
      normalizeText(priorMarker.candidateBytesHash) !== source.candidateBytesHash ||
      reviewerStage.actorClass !== 'bounded_code_reviewer' ||
      reviewerStage.auditDecision !== 'not_produced' ||
      normalizeText(reviewerStage.receiptHash) !== normalizeText(input.resumeFrom) ||
      binding.schemaVersion !== 'main-agent-final-judge-reuse-binding/v1' ||
      normalizeText(binding.closeoutAttemptId) !== closeoutAttemptId
    ) {
      throw new Error('main_agent_goal_task_report_provenance_mismatch');
    }
    reusedFinalJudge = {
      result: readReusableFinalJudgeResult(binding.result, binding.receipt),
      receipt: recordObject(binding.receipt),
    };
  } else if (input.resumeFrom) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  fs.mkdirSync(outputRoot, { recursive: false });

  const configured = readGovernanceRemediationConfig(projectRoot, input.judgeConfigPath);
  const configuredRuntime = configured.judgeRuntime;
  const configuredProviderRef =
    normalizeText(configuredRuntime?.activeProviderRef) || 'unconfigured-provider';
  const maxAttempts = Math.max(
    1,
    Number(configuredRuntime?.providers?.[configuredProviderRef]?.requestPolicy.maximumAttempts) ||
      1
  );
  const logicalAttemptOrdinal = input.logicalAttemptOrdinal ?? 1;
  const resumeFrom = input.resumeFrom ?? null;
  if (
    !Number.isInteger(logicalAttemptOrdinal) ||
    logicalAttemptOrdinal < 1 ||
    logicalAttemptOrdinal > maxAttempts
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  const actorResolver = createGoalFinalizationActorResolver(
    { projectRoot, config: input.judgeConfigPath },
    {
      readConfig: () => configured,
      executeClaudeCodeCliCommand: input.executeClaudeCodeCliCommand,
      executeCodexCliCommand: input.executeCodexCliCommand,
    }
  );
  let providerRef: string;
  try {
    providerRef = actorResolver.resolveProviderRef();
  } catch (error) {
    const stage = createJudgeStageStatusReceipt({
      closeoutAttemptId,
      providerRef: configuredProviderRef,
      logicalAttemptOrdinal,
      maxAttempts,
      sourceErrorCode: mainAgentCloseoutProviderErrorCode(error),
      resumeFrom,
    });
    writeMainAgentControlledCloseoutReceipt(receiptPaths.stageStatus, stage);
    const blocked: MainAgentControlledCloseoutResult = {
      status: 'not_produced',
      closeoutAttemptId,
      contextHash: source.contextHash,
      candidateBytesHash: source.candidateBytesHash,
      producerReceipt: source.closureReceipt,
      executionFinalJudgeCampaign: null,
      effectivePassReceipt: null,
      deliveryGateReceipt: null,
      judgeStageStatusReceipt: stage,
      reviewerStageStatusReceipt: null,
      finalJudgeReused: false,
      receiptPaths,
    };
    writeMainAgentControlledCloseoutReceipt(receiptPaths.marker, blocked);
    return blocked;
  }

  const invokeReviewer = input.invokeReviewer ?? actorResolver.invokeReviewer;

  const campaignInput = compileMainAgentExecutionFinalJudgeCampaignInput({
    campaignId: source.campaignId,
    campaignLineageKey: source.campaignLineageKey,
    closureReceiptHash: source.closureReceiptHash,
    candidateBytesHash: source.candidateBytesHash,
    currentImplementationHash: source.currentImplementationHash,
    currentEvidenceHash: source.currentEvidenceHash,
    initialReviewAttemptKey: controlledHash(
      controlledStableJson({ closeoutAttemptId, contextHash: source.contextHash })
    ),
    providerRef,
  });
  writeMainAgentControlledCloseoutReceipt(
    receiptPaths.input,
    campaignInput as unknown as Record<string, unknown>
  );
  const requestPath = path.join(outputRoot, 'final-judge-request.json');
  const request = {
    schemaVersion: 'main-agent-controlled-closeout-judge-request/v1',
    role: 'final_acceptance_judge',
    judgeRole: 'final_acceptance_judge',
    actorClass: 'final_acceptance_judge',
    closeoutAttemptId,
    campaignId: source.campaignId,
    campaignLineageKey: source.campaignLineageKey,
    contextHash: source.contextHash,
    closureReceiptHash: source.closureReceiptHash,
    candidateBytesHash: source.candidateBytesHash,
    currentImplementationHash: source.currentImplementationHash,
    currentEvidenceHash: source.currentEvidenceHash,
    blindInput: {
      campaignId: campaignInput.campaignId,
      campaignLineageKey: campaignInput.campaignLineageKey,
      closureReceiptHash: campaignInput.closureReceiptHash,
      candidateBytesHash: campaignInput.candidateBytesHash,
      currentImplementationHash: campaignInput.currentImplementationHash,
      currentEvidenceHash: campaignInput.currentEvidenceHash,
      initialReviewAttemptKey: campaignInput.initialReviewAttemptKey,
    },
    contextPath: path.relative(projectRoot, contextPath).replace(/\\/gu, '/'),
    closureReceiptPath: path.relative(projectRoot, closureReceiptPath).replace(/\\/gu, '/'),
    candidatePath: path.relative(projectRoot, source.candidatePath).replace(/\\/gu, '/'),
    campaignReportPath: path.relative(projectRoot, source.campaignReportPath).replace(/\\/gu, '/'),
    evidencePath: [
      contextPath,
      closureReceiptPath,
      source.candidatePath,
      source.campaignReportPath,
    ].map((value) => path.relative(projectRoot, value).replace(/\\/gu, '/')),
  };
  writeMainAgentControlledCloseoutReceipt(requestPath, request);
  const invokeFinalJudgeActor = input.invokeFinalJudge ?? actorResolver.invokeFinalJudge;
  const invokeFinalJudge = async (
    intent: Parameters<MainAgentControlledCloseoutCampaignDependencies['invokeFinalJudge']>[0]
  ) => invokeFinalJudgeActor(intent);
  let campaignResult: Awaited<ReturnType<typeof runMainAgentExecutionFinalJudgeCampaign>>;
  try {
    campaignResult = await runMainAgentExecutionFinalJudgeCampaign(
      {
        campaignInput,
        closeoutAttemptId,
        logicalAttemptOrdinal,
        maxAttempts,
        resumeFrom,
        ...(reusedFinalJudge ? { reusedFinalJudge } : {}),
      },
      {
        invokeReviewer,
        invokeFinalJudge,
      }
    );
  } catch (error) {
    const stage = createJudgeStageStatusReceipt({
      closeoutAttemptId,
      providerRef,
      logicalAttemptOrdinal,
      maxAttempts,
      sourceErrorCode: mainAgentCloseoutProviderErrorCode(error),
      resumeFrom,
    });
    writeMainAgentControlledCloseoutReceipt(receiptPaths.stageStatus, stage);
    const blocked: MainAgentControlledCloseoutResult = {
      status: 'not_produced',
      closeoutAttemptId,
      contextHash: source.contextHash,
      candidateBytesHash: source.candidateBytesHash,
      producerReceipt: source.closureReceipt,
      executionFinalJudgeCampaign: null,
      effectivePassReceipt: null,
      deliveryGateReceipt: null,
      judgeStageStatusReceipt: stage,
      receiptPaths,
    };
    writeMainAgentControlledCloseoutReceipt(receiptPaths.marker, blocked);
    return blocked;
  }
  if (campaignResult.status === 'not_produced') {
    const reviewerStage = campaignResult.reviewerStageStatusReceipt ?? null;
    const judgeStage = campaignResult.judgeStageStatusReceipt ?? null;
    const stage =
      reviewerStage ??
      judgeStage ??
      createJudgeStageStatusReceipt({
        closeoutAttemptId,
        providerRef,
        logicalAttemptOrdinal,
        maxAttempts,
        sourceErrorCode: 'PROVIDER_EXECUTION_ERROR',
        resumeFrom,
      });
    writeMainAgentControlledCloseoutReceipt(
      reviewerStage ? receiptPaths.reviewerStageStatus : receiptPaths.stageStatus,
      stage
    );
    if (campaignResult.reviewerReceipt) {
      writeMainAgentControlledCloseoutReceipt(
        receiptPaths.reviewer,
        campaignResult.reviewerReceipt as unknown as Record<string, unknown>
      );
    }
    if (campaignResult.finalJudgeReceipt) {
      const finalJudgeReceipt = campaignResult.finalJudgeReceipt as unknown as Record<
        string,
        unknown
      >;
      writeMainAgentControlledCloseoutReceipt(receiptPaths.finalJudge, finalJudgeReceipt);
      const finalJudge = recordObject(campaignResult.finalJudge);
      if (finalJudge.auditDecision !== 'not_produced') {
        writeMainAgentControlledCloseoutReceipt(receiptPaths.finalJudgeResult, {
          schemaVersion: 'main-agent-final-judge-reuse-binding/v1',
          closeoutAttemptId,
          result: finalJudge,
          receipt: finalJudgeReceipt,
        });
      }
    }
    const blocked: MainAgentControlledCloseoutResult = {
      status: 'not_produced',
      closeoutAttemptId,
      contextHash: source.contextHash,
      candidateBytesHash: source.candidateBytesHash,
      producerReceipt: source.closureReceipt,
      executionFinalJudgeCampaign: null,
      effectivePassReceipt: null,
      deliveryGateReceipt: null,
      reviewerStageStatusReceipt: reviewerStage,
      judgeStageStatusReceipt: judgeStage ?? (reviewerStage ? null : stage),
      finalJudgeReused: campaignResult.finalJudgeReused,
      receiptPaths,
    };
    writeMainAgentControlledCloseoutReceipt(receiptPaths.marker, blocked);
    return blocked;
  }
  if (!campaignResult.aggregate) {
    throw new Error('main_agent_execution_final_judge_campaign_invalid');
  }
  const aggregate = campaignResult.aggregate as unknown as Record<string, unknown>;
  const executionFinalJudgeCampaign = { ...aggregate, closeoutAttemptId };
  if (!campaignResult.effectivePassReceipt || campaignResult.status !== 'effective_pass_ready') {
    if (campaignResult.reviewerReceipt) {
      writeMainAgentControlledCloseoutReceipt(
        receiptPaths.reviewer,
        campaignResult.reviewerReceipt as unknown as Record<string, unknown>
      );
    }
    if (campaignResult.finalJudgeReceipt) {
      writeMainAgentControlledCloseoutReceipt(
        receiptPaths.finalJudge,
        campaignResult.finalJudgeReceipt as unknown as Record<string, unknown>
      );
    }
    writeMainAgentControlledCloseoutReceipt(receiptPaths.aggregate, aggregate);
    writeMainAgentControlledCloseoutReceipt(receiptPaths.ingest, executionFinalJudgeCampaign);
    const blocked: MainAgentControlledCloseoutResult = {
      status: 'blocked',
      closeoutAttemptId,
      contextHash: source.contextHash,
      candidateBytesHash: source.candidateBytesHash,
      producerReceipt: source.closureReceipt,
      executionFinalJudgeCampaign,
      effectivePassReceipt: null,
      deliveryGateReceipt: null,
      judgeStageStatusReceipt: null,
      reviewerStageStatusReceipt: null,
      finalJudgeReused: campaignResult.finalJudgeReused,
      receiptPaths,
    };
    writeMainAgentControlledCloseoutReceipt(receiptPaths.marker, blocked);
    return blocked;
  }
  const effectivePassReceipt = campaignResult.effectivePassReceipt as unknown as Record<
    string,
    unknown
  >;
  if (campaignResult.reviewerReceipt) {
    writeMainAgentControlledCloseoutReceipt(
      receiptPaths.reviewer,
      campaignResult.reviewerReceipt as unknown as Record<string, unknown>
    );
  }
  if (campaignResult.finalJudgeReceipt) {
    writeMainAgentControlledCloseoutReceipt(
      receiptPaths.finalJudge,
      campaignResult.finalJudgeReceipt as unknown as Record<string, unknown>
    );
  }
  writeMainAgentControlledCloseoutReceipt(receiptPaths.aggregate, aggregate);
  writeMainAgentControlledCloseoutReceipt(receiptPaths.ingest, executionFinalJudgeCampaign);
  writeMainAgentControlledCloseoutReceipt(receiptPaths.effectivePass, effectivePassReceipt);
  const ingested = ingestMainAgentControlledCloseout({
    closeoutAttemptId,
    contextHash: source.contextHash,
    producerReceipt: source.closureReceipt,
    executionFinalJudgeCampaign,
    candidateBytes: fs.readFileSync(source.candidatePath),
    effectivePassReceipt,
  });
  const deliveryGate = evaluateControlledGoalCloseoutGate({
    closeoutAttemptId,
    contextHash: source.contextHash,
    closureReceipt: source.closureReceipt,
    taskReportArtifactHash: source.candidateBytesHash,
    executionFinalJudgeCampaign,
    effectivePassReceipt,
  });
  const deliveryGateCore = {
    schemaVersion: 'main-agent-controlled-delivery-closeout-gate/v1',
    ...deliveryGate,
    ingestedStatus: ingested.status,
  };
  const deliveryGateReceipt = {
    ...deliveryGateCore,
    receiptHash: controlledHash(controlledStableJson(deliveryGateCore)),
  };
  writeMainAgentControlledCloseoutReceipt(receiptPaths.deliveryGate, deliveryGateReceipt);
  const completed: MainAgentControlledCloseoutResult = {
    status: 'awaiting_user_acceptance',
    closeoutAttemptId,
    contextHash: source.contextHash,
    candidateBytesHash: source.candidateBytesHash,
    producerReceipt: source.closureReceipt,
    executionFinalJudgeCampaign,
    effectivePassReceipt,
    deliveryGateReceipt,
    judgeStageStatusReceipt: null,
    reviewerStageStatusReceipt: null,
    finalJudgeReused: campaignResult.finalJudgeReused,
    receiptPaths,
  };
  writeMainAgentControlledCloseoutReceipt(receiptPaths.marker, completed);
  materializeMainAgentControlledCloseoutAcceptanceRequest({
    projectRoot,
    markerPath: receiptPaths.marker,
    candidatePath: source.candidatePath,
    outputPath: receiptPaths.acceptanceRequest,
    confirmationPagePath: receiptPaths.confirmationPage,
  });
  return completed;
}

export async function resumeJudgeStage(
  closeoutAttemptId: string,
  expectedContextHash: string,
  dependencies: {
    loadContext: () => unknown | Promise<unknown>;
    loadClosureReceipt: () => unknown | Promise<unknown>;
    invokeFinalJudge: (input: {
      closeoutAttemptId: string;
      expectedContextHash: string;
      context: Record<string, unknown>;
      closureReceipt: Record<string, unknown>;
    }) => unknown | Promise<unknown>;
  }
) {
  const context = recordObject(await dependencies.loadContext());
  const closureReceipt = recordObject(await dependencies.loadClosureReceipt());
  if (
    normalizeText(context.closeoutAttemptId) !== closeoutAttemptId ||
    normalizeText(context.contextHash) !== expectedContextHash ||
    closureReceipt.status !== 'campaign_closed' ||
    normalizeText(closureReceipt.contextHash) !== expectedContextHash
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  return dependencies.invokeFinalJudge({
    closeoutAttemptId,
    expectedContextHash,
    context,
    closureReceipt,
  });
}

export function persistAcceptedControlledTaskReport(input: {
  closeoutAttemptId: string;
  latestCloseoutAttemptId: string;
  candidatePath: string;
  candidateBytesHash: string;
  finalTaskReportPath: string;
  completionReceiptPath: string;
  recordClosedReceipt: Record<string, unknown>;
  provenanceHashes: Record<string, unknown>;
}) {
  const recordClosedReceiptHash = normalizeText(input.recordClosedReceipt.receiptHash);
  const recordClosedPayload = { ...input.recordClosedReceipt };
  delete recordClosedPayload.receiptHash;
  const requiredProvenanceKeys = [
    'contextHash',
    'compileReceiptHash',
    'childClosureSetHash',
    'campaignReportHash',
    'closureReceiptHash',
    'executionFinalJudgeCampaignHash',
    'effectivePassReceiptHash',
    'deliveryCloseoutGateReceiptHash',
  ] as const;
  if (
    input.closeoutAttemptId !== input.latestCloseoutAttemptId ||
    input.recordClosedReceipt.status !== 'user_accepted_closeout' ||
    input.recordClosedReceipt.closeoutAttemptId !== input.closeoutAttemptId ||
    !/^sha256:[a-f0-9]{64}$/u.test(recordClosedReceiptHash) ||
    controlledHash(controlledStableJson(recordClosedPayload)) !== recordClosedReceiptHash ||
    requiredProvenanceKeys.some(
      (key) => !/^sha256:[a-f0-9]{64}$/u.test(normalizeText(input.provenanceHashes[key]))
    )
  ) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  const candidateBytes = fs.readFileSync(input.candidatePath);
  if (controlledHash(candidateBytes) !== input.candidateBytesHash) {
    throw new Error('main_agent_goal_task_report_provenance_mismatch');
  }
  if (fs.existsSync(input.finalTaskReportPath)) {
    if (controlledHash(fs.readFileSync(input.finalTaskReportPath)) !== input.candidateBytesHash) {
      throw new Error('main_agent_goal_task_report_provenance_mismatch');
    }
  } else {
    fs.mkdirSync(path.dirname(input.finalTaskReportPath), { recursive: true });
    const taskReportTemporaryPath = `${input.finalTaskReportPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(taskReportTemporaryPath, candidateBytes);
      fs.renameSync(taskReportTemporaryPath, input.finalTaskReportPath);
    } finally {
      if (fs.existsSync(taskReportTemporaryPath))
        fs.rmSync(taskReportTemporaryPath, { force: true });
    }
  }
  const payload = {
    schemaVersion: 'main-agent-goal-completion-receipt/v1' as const,
    status: 'done' as const,
    closeoutAttemptId: input.closeoutAttemptId,
    taskReportPath: input.finalTaskReportPath,
    taskReportArtifactHash: input.candidateBytesHash,
    recordClosedReceiptHash,
    ...input.provenanceHashes,
  };
  const completionReceipt = Object.freeze({
    ...payload,
    completionReceiptHash: controlledHash(controlledStableJson(payload)),
  });
  writeJsonCreateOnlyOrEqual(
    input.completionReceiptPath,
    completionReceipt,
    'main_agent_goal_task_report_provenance_mismatch'
  );
  return completionReceipt;
}
