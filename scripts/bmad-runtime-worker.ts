import * as fs from 'node:fs';
import * as path from 'node:path';
const {
  buildGovernanceRunnerCliPresentation,
  } = require('../_bmad/runtime/hooks/governance-runner-summary-presenter.cjs') as {
  buildGovernanceRunnerCliPresentation: (input: {
    executionIntentCandidate?: GovernanceExecutionResult['executionIntentCandidate'];
    executionPlanDecision?: GovernanceExecutionResult['executionPlanDecision'];
    shouldContinue?: boolean;
    stopReason?: string | null;
    loopStateId?: string | null;
    currentAttemptNumber?: number | null;
    nextAttemptNumber?: number | null;
    artifactPath?: string | null;
    packetPaths?: Record<string, string>;
    executorRouting?: {
      routingMode?: 'targeted' | 'generic';
      executorRoute?: 'journey-contract-remediation' | 'default-gate-remediation';
      prioritizedSignals?: string[];
    };
    runnerSummaryLines?: string[];
  }) => {
    structuredMetadataLines: string[];
    rawEventLines: string[];
    combinedLines: string[];
  };
};
import { writeGovernanceRerunHistory } from '../packages/scoring/governance/write-rerun-history';
import {
  createGovernanceProviderAdapterFromConfig,
  readGovernanceRemediationConfig,
} from './governance-remediation-config';
import {
  buildGovernanceRemediationRunnerSummaryLines,
  createGovernanceExecutorPacket,
  runGovernanceRemediation,
  type GovernanceRerunDecision,
  writeGovernanceExecutorPacket,
} from './governance-remediation-runner';
import {
  appendGovernanceCurrentRun,
  ensureGovernanceQueueDirs,
  governanceCurrentRunPath,
  governanceDoneQueueFilePath,
  governanceFailedQueueFilePath,
  governancePendingQueueFilePath,
  governanceProcessingQueueFilePath,
  type GovernancePreContinuePayload,
  type GovernanceRuntimeQueueItem,
} from './governance-runtime-queue';
import type {
  GovernanceExecutionResult,
  GovernanceExecutorRoutingProjection,
  GovernancePresentation,
  GovernanceRemediationAuditTrace,
} from './governance-hook-types';

const LEGACY_QUEUE_DIR = path.join('.claude', 'state', 'runtime', 'queue');

interface LegacyQueueItem {
  id: string;
  type: string;
  payload: unknown;
  timestamp: string;
}

interface GovernanceRemediationRerunPayload {
  projectRoot?: string;
  configPath?: string;
  journeyContractHints?: Array<{ signal?: string }>;
  rerunDecision?: GovernanceRerunDecision;
  runnerInput?: Parameters<typeof runGovernanceRemediation>[0];
}

function legacyCurrentRunPath(projectRoot: string): string {
  return path.join(projectRoot, '.claude', 'state', 'runtime', 'current-run.json');
}

function ensureLegacyQueueDirs(projectRoot: string): void {
  for (const bucket of ['pending', 'processing', 'done', 'failed'] as const) {
    fs.mkdirSync(path.join(projectRoot, LEGACY_QUEUE_DIR, bucket), { recursive: true });
  }
}

function readQueueFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));
}

function appendLegacyCurrentRun(projectRoot: string, item: LegacyQueueItem): void {
  const currentRunFile = legacyCurrentRunPath(projectRoot);
  const existing = fs.existsSync(currentRunFile)
    ? (JSON.parse(fs.readFileSync(currentRunFile, 'utf8')) as LegacyQueueItem[])
    : [];
  existing.push(item);
  fs.mkdirSync(path.dirname(currentRunFile), { recursive: true });
  fs.writeFileSync(currentRunFile, JSON.stringify(existing, null, 2) + '\n', 'utf8');
}

function processLegacyEvent(projectRoot: string, item: LegacyQueueItem): void {
  appendLegacyCurrentRun(projectRoot, item);
}

async function processLegacyQueue(projectRoot: string): Promise<void> {
  ensureLegacyQueueDirs(projectRoot);

  const pendingDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'pending');
  const processingDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'processing');
  const doneDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'done');
  const failedDir = path.join(projectRoot, LEGACY_QUEUE_DIR, 'failed');

  for (const file of readQueueFiles(pendingDir)) {
    const itemPath = path.join(pendingDir, file);
    const processingPath = path.join(processingDir, file);

    fs.renameSync(itemPath, processingPath);

    try {
      const item = JSON.parse(fs.readFileSync(processingPath, 'utf8')) as LegacyQueueItem;
      processLegacyEvent(projectRoot, item);
      fs.renameSync(processingPath, path.join(doneDir, file));
    } catch {
      fs.renameSync(processingPath, path.join(failedDir, file));
    }
  }
}

function deriveRerunDecisionFromPayload(
  payload: GovernanceRemediationRerunPayload
): GovernanceRerunDecision {
  if (payload.rerunDecision?.mode) {
    return payload.rerunDecision;
  }

  const signals = [
    ...new Set(
      (payload.journeyContractHints ?? [])
        .map((hint) => (typeof hint?.signal === 'string' ? hint.signal : null))
        .filter((signal): signal is string => Boolean(signal && signal.trim()))
    ),
  ].sort();

  if (signals.length > 0) {
    return {
      mode: 'targeted',
      signals,
      hintCount: signals.length,
      reason: 'journey contract hints attached to governance rerun queue item',
    };
  }

  return {
    mode: 'generic',
    signals: [],
    hintCount: 0,
    reason: 'no journey contract hints attached to governance rerun queue item',
  };
}

function deriveExecutorRoutingProjection(input: {
  result: Awaited<ReturnType<typeof runGovernanceRemediation>>;
  rerunDecision: GovernanceRerunDecision;
}):
  | {
      routingMode: 'targeted' | 'generic';
      executorRoute: 'journey-contract-remediation' | 'default-gate-remediation';
      prioritizedSignals: string[];
    }
  | undefined {
  if (input.result.executorPacket) {
    return {
      routingMode: input.result.executorPacket.routingMode,
      executorRoute: input.result.executorPacket.executorRoute,
      prioritizedSignals: input.result.executorPacket.prioritizedSignals,
    };
  }

  if (input.rerunDecision.mode === 'targeted') {
    return {
      routingMode: 'targeted',
      executorRoute: 'journey-contract-remediation',
      prioritizedSignals: [...new Set((input.rerunDecision.signals ?? []).filter(Boolean))].sort(),
    };
  }

  if (input.rerunDecision.mode === 'generic') {
    return {
      routingMode: 'generic',
      executorRoute: 'default-gate-remediation',
      prioritizedSignals: [],
    };
  }

  return undefined;
}

function buildRemediationAuditTraceProjection(input: {
  result: Awaited<ReturnType<typeof runGovernanceRemediation>>;
  executorRouting:
    | GovernanceExecutorRoutingProjection
    | undefined;
}): GovernanceRemediationAuditTrace | undefined {
  if (!input.executorRouting) {
    return undefined;
  }

  const summaryLines = [
    `Routing Mode: ${input.executorRouting.routingMode}`,
    `Executor Route: ${input.executorRouting.executorRoute}`,
    `Stop Reason: ${input.result.stopReason ?? '(none)'}`,
    `Journey Contract Signals: ${input.result.journeyContractHints.map((hint) => hint.signal).join(', ') || '(none)'}`,
  ];

  return {
    artifactPath: input.result.artifactPath,
    stopReason: input.result.stopReason,
    journeyContractHints: input.result.journeyContractHints,
    routingMode: input.executorRouting.routingMode,
    executorRoute: input.executorRouting.executorRoute,
    prioritizedSignals: input.executorRouting.prioritizedSignals,
    summaryLines,
  };
}

function buildGovernancePresentationProjection(input: {
  result: Pick<
    GovernanceExecutionResult,
    | 'artifactPath'
    | 'executionIntentCandidate'
    | 'executionPlanDecision'
    | 'shouldContinue'
    | 'stopReason'
    | 'currentAttemptNumber'
    | 'nextAttemptNumber'
    | 'loopStateId'
    | 'executorRouting'
    | 'runnerSummaryLines'
  >;
  packetPaths: Record<string, string>;
}): GovernancePresentation {
  return buildGovernanceRunnerCliPresentation({
    executionIntentCandidate: input.result.executionIntentCandidate,
    executionPlanDecision: input.result.executionPlanDecision,
    shouldContinue: input.result.shouldContinue,
    stopReason: input.result.stopReason ?? null,
    loopStateId: input.result.loopStateId ?? null,
    currentAttemptNumber: input.result.currentAttemptNumber ?? null,
    nextAttemptNumber: input.result.nextAttemptNumber ?? null,
    artifactPath: input.result.artifactPath ?? null,
    packetPaths: input.packetPaths,
    executorRouting: input.result.executorRouting,
    runnerSummaryLines: input.result.runnerSummaryLines ?? [],
  });
}

async function processGovernanceRerunEvent(
  queueProjectRoot: string,
  item: GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload, GovernanceExecutionResult>
): Promise<GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload, GovernanceExecutionResult>> {
  const payload = item.payload ?? {};
  const runnerProjectRoot = payload.projectRoot ?? queueProjectRoot;
  const config = readGovernanceRemediationConfig(runnerProjectRoot, payload.configPath);
  const providerAdapter = createGovernanceProviderAdapterFromConfig(config);
  const runnerInput = payload.runnerInput;
  const rerunDecision = deriveRerunDecisionFromPayload(payload);

  if (!runnerInput) {
    throw new Error('governance-remediation-rerun queue item missing payload.runnerInput');
  }

  const result = await runGovernanceRemediation({
    ...runnerInput,
    projectRoot: runnerProjectRoot,
    hostKind: config.primaryHost,
    providerAdapter,
    rerunDecision,
  });
  const executorRouting = deriveExecutorRoutingProjection({ result, rerunDecision });
  const remediationAuditTrace = buildRemediationAuditTraceProjection({ result, executorRouting });

  const packetPaths: Record<string, string> = {};
  if (result.artifactPath && result.artifactResult) {
    for (const hostKind of config.packetHosts) {
      const packet = createGovernanceExecutorPacket({
        hostKind,
        runtimeContext: result.runtimeContext,
        runtimePolicy: result.runtimePolicy,
        loopState: result.loopState,
        currentAttemptNumber: result.currentAttemptNumber ?? result.loopState.attemptCount,
        rerunGate: result.loopState.rerunGate,
        artifactMarkdown: result.artifactResult.markdown,
        journeyContractHints: result.artifactResult.journeyContractHints,
        rerunDecision,
      });
      packetPaths[hostKind] = writeGovernanceExecutorPacket(result.artifactPath, packet);
    }
  }

  const runnerSummaryLines = buildGovernanceRemediationRunnerSummaryLines({
    ...result,
    packetPaths,
  });

  const processedAt = new Date().toISOString();
  writeGovernanceRerunHistory({
    projectRoot: runnerProjectRoot,
    eventId: item.id,
    timestamp: processedAt,
    rerunGate: runnerInput.rerunGate,
    outcome: runnerInput.outcome,
    decisionMode: executorRouting?.routingMode ?? rerunDecision.mode,
    attemptId: runnerInput.attemptId,
    loopStateId: result.loopState.loopStateId,
    runtimeContext: result.runtimeContext,
    runtimePolicy: result.runtimePolicy
      ? { triggerStage: result.runtimePolicy.triggerStage }
      : null,
    executorRouting,
    remediationAuditTraceSummaryLines: remediationAuditTrace?.summaryLines,
    runnerSummaryLines,
  });

  const resultPayload: GovernanceExecutionResult = {
    artifactPath: result.artifactPath,
    packetPaths,
    executionIntentCandidate: result.executionIntentCandidate,
    executionPlanDecision: result.executionPlanDecision,
    journeyContractHints: result.journeyContractHints,
    shouldContinue: result.shouldContinue,
    stopReason: result.stopReason,
    currentAttemptNumber: result.currentAttemptNumber,
    nextAttemptNumber: result.nextAttemptNumber,
    loopStateId: result.loopState.loopStateId,
    rerunGateResultIngested: result.rerunGateResultIngested,
    executorRouting,
    remediationAuditTrace,
    runnerSummaryLines,
  };
  resultPayload.governancePresentation = buildGovernancePresentationProjection({
    result: resultPayload,
    packetPaths,
  });

  const finalizedItem: GovernanceRuntimeQueueItem<
    GovernanceRemediationRerunPayload,
    GovernanceExecutionResult
  > = {
    ...item,
    processedAt,
    result: resultPayload,
  };

  appendGovernanceCurrentRun(queueProjectRoot, finalizedItem);
  return finalizedItem;
}

async function processGovernanceEvent(
  queueProjectRoot: string,
  item: GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload, GovernanceExecutionResult>
): Promise<GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload, GovernanceExecutionResult>> {
  if (item.type === 'governance-pre-continue-check') {
    const payload = (item.payload ?? {}) as GovernancePreContinuePayload;
    const gateFailures = Array.isArray(payload.failures) ? payload.failures : [];
    const gateCheck = {
      gate: payload.gate || 'pre-continue',
      workflow: payload.workflow,
      step: payload.step,
      artifactPath: payload.artifactPath ?? null,
      scope: {
        branch: payload.branch ?? null,
        epicId: payload.epicId ?? null,
        storyId: payload.storyId ?? null,
      },
      failures: gateFailures,
      status: payload.status || (gateFailures.length > 0 ? 'fail' : 'pass'),
      rerunGate: payload.rerunGate || payload.gate || 'pre-continue',
      sourceGateFailureIds: payload.sourceGateFailureIds || [],
    };

    const result: GovernanceExecutionResult = {
      shouldContinue: gateCheck.status === 'pass' ? false : false,
      stopReason: gateFailures.length > 0 ? 'gate failed - remediation required' : 'gate passed - awaiting workflow transition',
      gateCheck,
    };

    if (payload.status === 'fail' && payload.rerunGate) {
      const remediationResult = await runGovernanceRemediation({
        projectRoot: payload.projectRoot ?? queueProjectRoot,
        outputPath: payload.artifactPath ?? path.join(payload.projectRoot ?? queueProjectRoot, '_bmad-output', 'planning-artifacts', 'gate-remediation.md'),
        promptText: `GateFailure for ${payload.workflow || 'unknown-workflow'} ${payload.step || 'workflow'}: ${gateFailures.join('; ')}`,
        stageContextKnown: true,
        gateFailureExists: true,
        blockerOwnershipLocked: true,
        rootTargetLocked: true,
        equivalentAdapterCount: 1,
        attemptId: `pre-continue-${item.id}`,
        sourceGateFailureIds: payload.sourceGateFailureIds ?? [],
        capabilitySlot: `${payload.workflow || 'workflow'}.${payload.step || 'workflow'}`,
        canonicalAgent: 'Governance Gate Runner',
        actualExecutor: 'pre-continue-check',
        adapterPath: '_bmad/runtime/hooks/pre-continue-check.cjs',
        targetArtifacts: payload.artifactPath ? [payload.artifactPath] : [],
        expectedDelta: 'repair governed contract sections before Continue',
        rerunOwner: 'PM',
        rerunGate: payload.rerunGate,
        outcome: 'blocked',
        hostKind: 'claude',
      });

      result.stopReason = remediationResult.stopReason ?? result.stopReason;
      result.shouldContinue = false;
      result.currentAttemptNumber = remediationResult.currentAttemptNumber;
      result.nextAttemptNumber = remediationResult.nextAttemptNumber;
      result.loopStateId = remediationResult.loopState.loopStateId;
      result.rerunGateResultIngested = remediationResult.rerunGateResultIngested;
      result.executorRouting = remediationResult.executorPacket
        ? {
            routingMode: remediationResult.executorPacket.routingMode,
            executorRoute: remediationResult.executorPacket.executorRoute,
            prioritizedSignals: remediationResult.executorPacket.prioritizedSignals,
          }
        : undefined;
      result.runnerSummaryLines = buildGovernanceRemediationRunnerSummaryLines({
        ...remediationResult,
        shouldContinue: false,
        stopReason: result.stopReason ?? null,
      });
      result.packetPaths = remediationResult.packetPaths;
      result.artifactPath = remediationResult.artifactPath;
    }

    const passthroughItem: GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload, GovernanceExecutionResult> = {
      ...item,
      processedAt: new Date().toISOString(),
      result,
    };
    appendGovernanceCurrentRun(queueProjectRoot, passthroughItem);
    return passthroughItem;
  }

  if (item.type === 'governance-remediation-rerun') {
    return processGovernanceRerunEvent(queueProjectRoot, item);
  }

  const passthroughItem: GovernanceRuntimeQueueItem<
    GovernanceRemediationRerunPayload,
    GovernanceExecutionResult
  > = {
    ...item,
    processedAt: new Date().toISOString(),
  };
  appendGovernanceCurrentRun(queueProjectRoot, passthroughItem);
  return passthroughItem;
}

async function processGovernanceQueue(projectRoot: string): Promise<void> {
  ensureGovernanceQueueDirs(projectRoot);

  const pendingDir = path.dirname(governancePendingQueueFilePath(projectRoot, 'queue-probe'));

  for (const file of readQueueFiles(pendingDir)) {
    const itemPath = path.join(pendingDir, file);
    const itemId = path.basename(file, '.json');
    const processingPath = governanceProcessingQueueFilePath(projectRoot, itemId);

    fs.renameSync(itemPath, processingPath);

    try {
      const item = JSON.parse(
        fs.readFileSync(processingPath, 'utf8')
      ) as GovernanceRuntimeQueueItem<GovernanceRemediationRerunPayload, GovernanceExecutionResult>;

      const finalizedItem = await processGovernanceEvent(projectRoot, item);
      fs.writeFileSync(processingPath, JSON.stringify(finalizedItem, null, 2) + '\n', 'utf8');
      fs.renameSync(processingPath, governanceDoneQueueFilePath(projectRoot, itemId));
    } catch (error) {
      try {
        const failedItem = JSON.parse(
          fs.readFileSync(processingPath, 'utf8')
        ) as GovernanceRuntimeQueueItem<
          GovernanceRemediationRerunPayload,
          GovernanceExecutionResult
        >;
        failedItem.processedAt = new Date().toISOString();
        failedItem.error = error instanceof Error ? error.message : String(error);
        fs.writeFileSync(processingPath, JSON.stringify(failedItem, null, 2) + '\n', 'utf8');
      } catch {
        // Keep the original queue file if it cannot be re-read or re-written.
      }

      fs.renameSync(processingPath, governanceFailedQueueFilePath(projectRoot, itemId));
    }
  }
}

export { governanceCurrentRunPath };

export async function processQueue(projectRoot: string = process.cwd()): Promise<void> {
  await processGovernanceQueue(projectRoot);
  await processLegacyQueue(projectRoot);
}

if (require.main === module) {
  void processQueue();
}
