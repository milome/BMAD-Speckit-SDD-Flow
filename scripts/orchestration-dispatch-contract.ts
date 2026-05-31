import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

export type OrchestrationHost = 'cursor' | 'claude' | 'codex';
export type OrchestrationFlow = 'story' | 'bugfix' | 'standalone_tasks';
export type OrchestrationTaskType = 'implement' | 'audit' | 'remediate' | 'document';
export type PacketKind = 'recommendation' | 'execution' | 'resume';
export type ExecutionAuthorityMode =
  | 'legacy_generic_prompt'
  | 'compiled_implementation_confirmation';
export type LegacyPromptFallbackReason = 'no_confirmed_source';
const DEFAULT_AUDIT_CURRENT_EVIDENCE_HASH =
  'sha256:c8ed309d65d96bc2341ebb69cb0ab61499f75f4b526ccb79b1c5afe59727e408';

function sha256Text(value: string): string {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function isSha256Hash(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(value);
}

function currentEvidenceHashForCompiledPromptRef(ref: CompiledPromptRef): string {
  return sha256Text(
    [ref.modelPacketHash, ref.auditReceiptHash, ref.goalExecutionHash ?? 'no-goal'].join('|')
  );
}
export type ExecutionStrategyId =
  | 'compiled_trace_direct'
  | 'compiled_trace_with_sdd_artifacts'
  | 'governed_skill_adapter'
  | 'governed_skill_prompt';
export type ExecutionStrategyAvailability =
  | 'available'
  | 'blocked_until_artifact_realization_lane'
  | 'blocked_until_adapter_certification_gate'
  | 'blocked_until_prompt_equivalence_gate';

export interface CompiledPromptRef {
  modelPacketPath: string;
  modelPacketHash: string;
  humanPromptPath: string;
  humanPromptHash: string;
  auditReceiptPath: string;
  auditReceiptHash: string;
  goalExecutionPath?: string | null;
  goalExecutionHash?: string | null;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
}

export interface LintPolicy {
  required: boolean;
  blockOnWarnings: boolean;
  forbiddenWaivers: string[];
}

export interface DocCommentPolicy {
  publicApiRequired: boolean;
  languages: string[];
}

export interface FailureExclusionPolicy {
  objectiveFieldsRequired: boolean;
  userApprovalRequiredForExcludedTests: boolean;
}

export interface TestExecutionPolicy {
  projectRootRequired: boolean;
  pytestCleanupEvidenceRequired: boolean;
}

export interface SubagentContinuityPolicy {
  returnAllowedOnlyOn: string[];
}

export interface AuditReportContract {
  parseableScoreBlockRequired: boolean;
  allowedGrades: string[];
  forbidScoreRanges: boolean;
}

export interface HostCloseoutPolicy {
  prosePassIsCompletion: false;
}

export interface AuditScoringConvergencePolicy {
  auditPassRequired: boolean;
  criticalAuditorNoNewGapRequired?: boolean;
  scoreReceiptRequired: boolean;
  dimensionContractMatchRequired: boolean;
  thresholdPassRequired: boolean;
  vetoForbidden: boolean;
  iterationCountRequired: boolean;
  freshHashesRequired: boolean;
}

export interface ExecutionDisciplineProfile {
  profileId: string;
  profileHash?: string;
  flow: OrchestrationFlow;
  authority: 'discipline_profile_only';
  sourceReferences: string[];
  rules: string[];
  requiredEvidence: string[];
  auditScoringConvergencePolicy: AuditScoringConvergencePolicy;
  dimensionContractSelector: string;
  forbiddenOverrides: string[];
  lintPolicy: LintPolicy;
  docCommentPolicy: DocCommentPolicy;
  failureExclusionPolicy: FailureExclusionPolicy;
  testExecutionPolicy: TestExecutionPolicy;
  subagentContinuityPolicy: SubagentContinuityPolicy;
  auditReportContract: AuditReportContract;
  hostCloseoutPolicy: HostCloseoutPolicy;
}

export interface AuditExecutionProfile {
  schemaVersion: 'audit-execution-profile/v1';
  profileId: string;
  profileHash: string;
  stageProfileId: string;
  stageProfileHash: string;
  requiredCheckItemSetHash: string;
  perspectives: string[];
  auditScoringConvergencePolicy: AuditScoringConvergencePolicy;
  runAuditorHostArgs: {
    projectRoot: string;
    stage: string;
    artifactPath: string;
    reportPath: string;
  };
  currentAttemptBinding: {
    recordId: string;
    requirementSetId: string;
    attemptId: string;
    sourceDocumentHash: string;
    implementationConfirmationHash: string;
    modelPacketHash?: string | null;
    currentAttemptHash: string;
    currentEvidenceHash: string;
  };
  selfReviewDenied: true;
}

export interface AuditTriadExecutionPlanRef {
  path: string;
  contentHash: string;
  attemptId: string;
  stageProfileId: string;
  criticalAuditorProfileHash: string;
  criticalAuditorStageProfileHash: string;
  requiredCheckItemSetHash: string;
  auditReceiptHash?: string | null;
  goalExecutionHash?: string | null;
  currentAttemptHash: string;
  currentEvidenceHash: string;
}

export interface ExecutionStrategyOption {
  strategyId: ExecutionStrategyId;
  availability: ExecutionStrategyAvailability;
  optionHash: string;
  blockingReasons: string[];
}

export interface ExecutionStrategySelection {
  eventType: 'execution_strategy_selected';
  strategyId: ExecutionStrategyId;
  availability: 'available';
  selectedBy: 'user' | 'policy';
  strategyOptionsHash: string;
  selectedOptionHash: string;
  modelPacketHash: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
}

export interface SddArtifactManifestRef {
  path: string;
  contentHash: string;
  status?: 'not_declared' | 'pass' | 'blocked';
  blockingReasons?: string[];
}

export interface DispatchRoute {
  tool: string;
  subtype: string;
  fallback: string;
}

export interface RecommendationPacket {
  packetId: string;
  parentSessionId: string;
  flow: OrchestrationFlow;
  phase: string;
  recommendedRole: string;
  recommendedTaskType: OrchestrationTaskType;
  inputArtifacts: string[];
  allowedWriteScope: string[];
  expectedDelta: string;
  successCriteria: string[];
  stopConditions: string[];
  providerReasoning?: string | null;
}

export interface ExecutionPacket {
  packetId: string;
  parentSessionId: string;
  sourceRecommendationPacketId?: string | null;
  flow: OrchestrationFlow;
  phase: string;
  taskType: OrchestrationTaskType;
  role: string;
  inputArtifacts: string[];
  allowedWriteScope: string[];
  expectedDelta: string;
  successCriteria: string[];
  stopConditions: string[];
  downstreamConsumer?: string | null;
  authorityMode?: ExecutionAuthorityMode;
  compiledPromptRef?: CompiledPromptRef | null;
  executionDisciplineProfile?: ExecutionDisciplineProfile | null;
  legacyPromptFallbackReason?: LegacyPromptFallbackReason | null;
  compilerBlock?: string[] | null;
  executionStrategy?: ExecutionStrategySelection | null;
  sddArtifactManifestRef?: SddArtifactManifestRef | null;
  auditExecutionProfile?: AuditExecutionProfile | null;
  auditTriadExecutionPlanRef?: AuditTriadExecutionPlanRef | null;
}

export interface ResumePacket {
  packetId: string;
  parentSessionId: string;
  originalExecutionPacketId: string;
  flow: OrchestrationFlow;
  phase: string;
  role: string;
  resumeReason: string;
  inputArtifacts: string[];
  allowedWriteScope: string[];
  expectedDelta: string;
  successCriteria: string[];
  stopConditions: string[];
}

export interface TaskReport {
  packetId: string;
  status: 'done' | 'blocked' | 'partial';
  filesChanged: string[];
  validationsRun: string[];
  evidence: string[];
  downstreamContext: string[];
  driftFlags?: string[];
}

export interface FallbackDecisionInput {
  interactive: boolean;
  transportAvailable: boolean;
  explicitFallbackRequested: boolean;
}

export function packetArtifactDir(projectRoot: string, sessionId: string): string {
  try {
    const recordsRoot = path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records');
    if (fs.existsSync(recordsRoot)) {
      const directRecord = path.join(recordsRoot, sessionId, 'requirement-record.json');
      if (fs.existsSync(directRecord)) {
        return path.join(recordsRoot, sessionId, 'prompts', 'prompt-packets');
      }
      for (const dirent of fs.readdirSync(recordsRoot, { withFileTypes: true })) {
        if (!dirent.isDirectory()) continue;
        const recordPath = path.join(recordsRoot, dirent.name, 'requirement-record.json');
        if (!fs.existsSync(recordPath)) continue;
        const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
        if (
          record.runId === sessionId ||
          record.recordId === sessionId ||
          record.requirementSetId === sessionId
        ) {
          return path.join(recordsRoot, dirent.name, 'prompts', 'prompt-packets');
        }
      }
    }
  } catch {
    // Keep the legacy dev fallback below when the fs probe is unavailable.
  }
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'packets', sessionId);
}

export function packetArtifactPath(
  projectRoot: string,
  sessionId: string,
  packetId: string
): string {
  return path.join(packetArtifactDir(projectRoot, sessionId), `${packetId}.json`);
}

export function resolveDispatchRoute(
  host: OrchestrationHost,
  taskType: OrchestrationTaskType
): DispatchRoute {
  if (host === 'codex') {
    return {
      tool: 'codex',
      subtype: `worker:${taskType}`,
      fallback: 'disabled',
    };
  }

  if (host === 'cursor') {
    if (taskType === 'audit') {
      return {
        tool: 'Task',
        subtype: 'code-reviewer',
        fallback: 'mcp_task:generalPurpose',
      };
    }
    return {
      tool: 'mcp_task',
      subtype: 'generalPurpose',
      fallback: 'disabled',
    };
  }

  if (taskType === 'audit') {
    return {
      tool: 'Agent',
      subtype: 'code-reviewer',
      fallback: 'Agent:general-purpose',
    };
  }

  return {
    tool: 'Agent',
    subtype: 'general-purpose',
    fallback: 'disabled',
  };
}

export function fallbackAllowed(_input: FallbackDecisionInput): boolean {
  return false;
}

export function createExecutionPacket(input: ExecutionPacket): ExecutionPacket {
  if (
    input.authorityMode === 'compiled_implementation_confirmation' &&
    !input.compiledPromptRef &&
    (!Array.isArray(input.compilerBlock) || input.compilerBlock.length === 0)
  ) {
    throw new Error(
      'compiledPromptRef or compilerBlock is required when authorityMode=compiled_implementation_confirmation'
    );
  }
  if (input.authorityMode === 'legacy_generic_prompt' && !input.legacyPromptFallbackReason) {
    throw new Error(
      'legacyPromptFallbackReason is required when authorityMode=legacy_generic_prompt'
    );
  }
  if (
    input.authorityMode === 'compiled_implementation_confirmation' &&
    input.compiledPromptRef &&
    !input.executionStrategy &&
    input.taskType !== 'audit'
  ) {
    throw new Error('executionStrategy is required after compiled model_packet gate PASS');
  }
  if (input.executionStrategy && !input.compiledPromptRef) {
    throw new Error('executionStrategy cannot bypass compiledPromptRef model_packet authority');
  }
  if (input.taskType === 'audit') {
    if (input.authorityMode === 'legacy_generic_prompt') {
      throw new Error('audit packets cannot use legacy_generic_prompt');
    }
    if (!input.compiledPromptRef) {
      throw new Error('audit packets require compiledPromptRef current-attempt binding');
    }
    if (!input.auditExecutionProfile) {
      throw new Error('auditExecutionProfile is required for audit packets');
    }
    if (!input.auditTriadExecutionPlanRef) {
      throw new Error('auditTriadExecutionPlanRef is required for audit packets');
    }
    if (!input.auditExecutionProfile.runAuditorHostArgs) {
      throw new Error('runAuditorHostArgs are required for audit packets');
    }
    if (input.auditExecutionProfile.selfReviewDenied !== true) {
      throw new Error('audit packets must deny self review');
    }
    if (input.auditExecutionProfile.currentAttemptBinding.attemptId !== input.packetId) {
      throw new Error('auditExecutionProfile attemptId must match packetId');
    }
    if (input.auditTriadExecutionPlanRef.attemptId !== input.packetId) {
      throw new Error('auditTriadExecutionPlanRef attemptId must match packetId');
    }
    if (
      input.auditExecutionProfile.currentAttemptBinding.sourceDocumentHash !==
      input.compiledPromptRef.sourceDocumentHash
    ) {
      throw new Error('auditExecutionProfile sourceDocumentHash must match compiledPromptRef');
    }
    if (
      input.auditExecutionProfile.currentAttemptBinding.implementationConfirmationHash !==
      input.compiledPromptRef.implementationConfirmationHash
    ) {
      throw new Error(
        'auditExecutionProfile implementationConfirmationHash must match compiledPromptRef'
      );
    }
    if (
      input.auditExecutionProfile.currentAttemptBinding.modelPacketHash !==
      input.compiledPromptRef.modelPacketHash
    ) {
      throw new Error('auditExecutionProfile modelPacketHash must match compiledPromptRef');
    }
    const currentAttemptHash = input.auditExecutionProfile.currentAttemptBinding.currentAttemptHash;
    if (!currentAttemptHash || !isSha256Hash(currentAttemptHash)) {
      throw new Error('auditExecutionProfile currentAttemptHash must be a canonical sha256 hash');
    }
    if (
      currentAttemptHash !== sha256Text(input.auditExecutionProfile.currentAttemptBinding.attemptId)
    ) {
      throw new Error('auditExecutionProfile currentAttemptHash must be derived from attemptId');
    }
    const currentEvidenceHash =
      input.auditExecutionProfile.currentAttemptBinding.currentEvidenceHash;
    if (
      !currentEvidenceHash ||
      !isSha256Hash(currentEvidenceHash) ||
      currentEvidenceHash === DEFAULT_AUDIT_CURRENT_EVIDENCE_HASH
    ) {
      throw new Error(
        'auditExecutionProfile currentEvidenceHash must be a fresh non-placeholder hash'
      );
    }
    if (currentEvidenceHash !== currentEvidenceHashForCompiledPromptRef(input.compiledPromptRef)) {
      throw new Error(
        'auditExecutionProfile currentEvidenceHash must match compiledPromptRef evidence hashes'
      );
    }
    if (
      input.auditTriadExecutionPlanRef.auditReceiptHash !== input.compiledPromptRef.auditReceiptHash
    ) {
      throw new Error('auditTriadExecutionPlanRef auditReceiptHash must match compiledPromptRef');
    }
    if (
      (input.auditTriadExecutionPlanRef.goalExecutionHash ?? null) !==
      (input.compiledPromptRef.goalExecutionHash ?? null)
    ) {
      throw new Error('auditTriadExecutionPlanRef goalExecutionHash must match compiledPromptRef');
    }
    if (input.auditTriadExecutionPlanRef.currentAttemptHash !== currentAttemptHash) {
      throw new Error(
        'auditTriadExecutionPlanRef currentAttemptHash must match auditExecutionProfile'
      );
    }
    if (input.auditTriadExecutionPlanRef.currentEvidenceHash !== currentEvidenceHash) {
      throw new Error(
        'auditTriadExecutionPlanRef currentEvidenceHash must match auditExecutionProfile'
      );
    }
    if (
      input.auditTriadExecutionPlanRef.stageProfileId !== input.auditExecutionProfile.stageProfileId
    ) {
      throw new Error('auditTriadExecutionPlanRef stageProfileId must match auditExecutionProfile');
    }
    if (
      input.auditTriadExecutionPlanRef.criticalAuditorProfileHash !==
      input.auditExecutionProfile.profileHash
    ) {
      throw new Error('auditTriadExecutionPlanRef profileHash must match auditExecutionProfile');
    }
    if (
      input.auditTriadExecutionPlanRef.criticalAuditorStageProfileHash !==
      input.auditExecutionProfile.stageProfileHash
    ) {
      throw new Error(
        'auditTriadExecutionPlanRef stageProfileHash must match auditExecutionProfile'
      );
    }
    if (
      input.auditTriadExecutionPlanRef.requiredCheckItemSetHash !==
      input.auditExecutionProfile.requiredCheckItemSetHash
    ) {
      throw new Error(
        'auditTriadExecutionPlanRef requiredCheckItemSetHash must match auditExecutionProfile'
      );
    }
  }
  if (input.executionStrategy && input.executionStrategy.availability !== 'available') {
    throw new Error('executionStrategy availability must be available');
  }
  if (
    input.executionStrategy &&
    input.compiledPromptRef &&
    input.executionStrategy.modelPacketHash !== input.compiledPromptRef.modelPacketHash
  ) {
    throw new Error('executionStrategy modelPacketHash must match compiledPromptRef');
  }
  if (
    input.executionStrategy &&
    input.compiledPromptRef &&
    input.executionStrategy.sourceDocumentHash !== input.compiledPromptRef.sourceDocumentHash
  ) {
    throw new Error('executionStrategy sourceDocumentHash must match compiledPromptRef');
  }
  if (
    input.executionStrategy &&
    input.compiledPromptRef &&
    input.executionStrategy.implementationConfirmationHash !==
      input.compiledPromptRef.implementationConfirmationHash
  ) {
    throw new Error(
      'executionStrategy implementationConfirmationHash must match compiledPromptRef'
    );
  }
  return {
    ...input,
    sourceRecommendationPacketId: input.sourceRecommendationPacketId ?? null,
    downstreamConsumer: input.downstreamConsumer ?? null,
    authorityMode: input.authorityMode ?? 'legacy_generic_prompt',
    compiledPromptRef: input.compiledPromptRef ?? null,
    executionDisciplineProfile: input.executionDisciplineProfile ?? null,
    legacyPromptFallbackReason: input.legacyPromptFallbackReason ?? null,
    compilerBlock: input.compilerBlock ?? null,
    executionStrategy: input.executionStrategy ?? null,
    sddArtifactManifestRef: input.sddArtifactManifestRef ?? null,
    auditExecutionProfile: input.auditExecutionProfile ?? null,
    auditTriadExecutionPlanRef: input.auditTriadExecutionPlanRef ?? null,
  };
}

export function createResumePacket(input: ResumePacket): ResumePacket {
  return { ...input };
}
