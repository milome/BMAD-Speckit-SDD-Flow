import type {
  ExecutionIntentCandidate,
  ExecutionPlanDecision,
} from './execution-intent-schema';

export interface GovernancePresentation {
  structuredMetadataLines: string[];
  rawEventLines: string[];
  combinedLines: string[];
}

export interface GovernanceExecutorRoutingProjection {
  routingMode?: 'targeted' | 'generic';
  executorRoute?: 'journey-contract-remediation' | 'default-gate-remediation';
  prioritizedSignals?: string[];
}

export interface GovernanceJourneyContractHintProjection {
  signal?: string;
  recommendation?: string;
}

export interface GovernanceRemediationAuditTrace {
  artifactPath?: string | null;
  stopReason?: string | null;
  journeyContractHints?: GovernanceJourneyContractHintProjection[];
  routingMode?: 'targeted' | 'generic';
  executorRoute?: 'journey-contract-remediation' | 'default-gate-remediation';
  prioritizedSignals?: string[];
  summaryLines?: string[];
}

export interface GovernanceExecutionProjection {
  executionId?: string;
  executionStatus?:
    | 'pending_dispatch'
    | 'leased'
    | 'running'
    | 'awaiting_rerun_gate'
    | 'retry_pending'
    | 'gate_passed'
    | 'escalated';
  authoritativeHost?: 'cursor' | 'claude' | 'codex' | 'generic';
  lastRerunGateStatus?: 'pass' | 'fail' | null;
}

export interface GovernanceExecutionResult {
  executionId?: string | null;
  executionStatus?:
    | 'pending_dispatch'
    | 'leased'
    | 'running'
    | 'awaiting_rerun_gate'
    | 'retry_pending'
    | 'gate_passed'
    | 'escalated'
    | null;
  authoritativeHost?: 'cursor' | 'claude' | 'codex' | 'generic' | null;
  lastRerunGateStatus?: 'pass' | 'fail' | null;
  artifactPath?: string | null;
  packetPaths?: Record<string, string>;
  executionIntentCandidate?: ExecutionIntentCandidate | null;
  executionPlanDecision?: ExecutionPlanDecision | null;
  journeyContractHints?: GovernanceJourneyContractHintProjection[];
  shouldContinue?: boolean;
  stopReason?: string | null;
  currentAttemptNumber?: number | null;
  nextAttemptNumber?: number | null;
  loopStateId?: string | null;
  rerunGateResultIngested?: boolean;
  executorRouting?: GovernanceExecutorRoutingProjection;
  remediationAuditTrace?: GovernanceRemediationAuditTrace;
  executionProjection?: GovernanceExecutionProjection;
  runnerSummaryLines?: string[];
  governancePresentation?: GovernancePresentation;
  gateCheck?: {
    gate: string;
    workflow?: string;
    step?: string;
    artifactPath?: string | null;
    scope?: {
      branch?: string | null;
      epicId?: string | null;
      storyId?: string | null;
    };
    failures?: string[];
    status?: 'pass' | 'fail';
    rerunGate?: string;
    sourceGateFailureIds?: string[];
  };
}

export interface GovernanceRerunDecisionProjection {
  mode?: 'targeted' | 'generic' | 'idle';
  signals?: string[];
  hintCount?: number;
  reason?: string;
  projectRoot?: string;
}

export interface GovernanceRunnerLockSnapshot {
  version?: number;
  pid?: number;
  acquiredAt?: string;
  heartbeatAt?: string;
  ttlMs?: number;
  heartbeatIntervalMs?: number;
  projectRoot?: string;
}

export interface GovernanceHookExecutionEnvelope extends GovernanceExecutionResult {
  started?: boolean;
  skipped?: boolean;
  wait?: boolean;
  status?: number;
  pid?: number;
  stdout?: string;
  stderr?: string;
  projectRoot?: string;
  reason?: string;
  lockPath?: string;
  activeLock?: GovernanceRunnerLockSnapshot | null;
  journeyContractHints?: GovernanceJourneyContractHintProjection[];
  pendingJourneyContractHints?: GovernanceJourneyContractHintProjection[];
  rerunDecision?: GovernanceRerunDecisionProjection;
}

export type GovernanceWorkerResult = GovernanceHookExecutionEnvelope;
export type GovernanceBackgroundTrigger = GovernanceHookExecutionEnvelope;

export interface GovernancePostToolUseResult {
  queuePath?: string;
  projectRoot?: string;
  backgroundTrigger?: GovernanceBackgroundTrigger | null;
}

export interface GovernanceStopHookResult {
  checkpointPath: string;
  workerResult?: GovernanceWorkerResult | null;
}
