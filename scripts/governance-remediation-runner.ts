import * as fs from 'node:fs';
import * as path from 'node:path';
const {
  appendRunnerSummaryToArtifactMarkdown,
  renderGovernanceRunnerSummaryLines,
} = require('../_bmad/runtime/hooks/governance-runner-summary-format.cjs') as {
  appendRunnerSummaryToArtifactMarkdown: (
    artifactMarkdown: string,
    runnerSummaryLines: string[]
  ) => string;
  renderGovernanceRunnerSummaryLines: (runnerSummaryLines: string[]) => string;
};
import type {
  GovernanceRemediationArtifactResult,
  GovernanceRemediationArtifactInput,
} from './governance-remediation-artifact';
import {
  buildRemediationAuditTraceSummaryLines,
  writeGovernanceRemediationArtifact,
} from './governance-remediation-artifact';
import { resolvePromptHintUsageFromText } from './prompt-routing-governance';
import type {
  GovernanceProviderAdapter,
  GovernanceProviderAdapterInput,
} from './governance-provider-adapter';
import { resolveModelHintsViaGovernanceProvider } from './governance-provider-adapter';
import type { ModelGovernanceHintCandidate } from './model-governance-hints-schema';
import type {
  ExecutionIntentCandidate,
  ExecutionPlanDecision,
} from './execution-intent-schema';
import { resolveGovernanceSkillInventory } from './skill-inventory-provider';
import type { RuntimeContextFile } from './runtime-context';
import { readRuntimeContext } from './runtime-context';
import type { RuntimeContextRegistry } from './runtime-context-registry';
import { readRuntimeContextRegistry } from './runtime-context-registry';
import type { RuntimePolicy } from './runtime-governance';
import { resolveRuntimePolicy } from './runtime-governance';
import {
  createGovernanceProviderAdapterFromConfig,
  readGovernanceRemediationConfig,
} from './governance-remediation-config';
import type { JourneyContractRemediationHint } from '../packages/scoring/analytics/journey-contract-remediation';
import { buildGateRemediationHints } from '../packages/scoring/gate/remediation-hints';
import { loadAndDedupeRecords } from '../packages/scoring/query/loader';
import { parseEpicStoryFromRecord } from '../packages/scoring/query';

export type GovernanceHostKind = 'cursor' | 'claude' | 'codex' | 'generic';
export type GovernanceExecutionMode =
  | 'cursor-mcp-task'
  | 'claude-agent-tool'
  | 'codex-spawn-agent'
  | 'generic-prompt-packet';
export type GovernanceRoutingMode = 'targeted' | 'generic';
export type GovernanceExecutorRoute =
  | 'journey-contract-remediation'
  | 'default-gate-remediation';

export interface GovernanceRerunDecision {
  mode?: 'targeted' | 'generic' | 'idle';
  signals?: string[];
  hintCount?: number;
  reason?: string;
  projectRoot?: string;
}

export interface GovernanceExecutorRouting {
  routingMode: GovernanceRoutingMode;
  executorRoute: GovernanceExecutorRoute;
  prioritizedSignals: string[];
  packetStrategy: 'journey-contract-remediation-packet' | 'default-remediation-packet';
  reason: string;
}

export interface GovernanceRerunGateResult {
  gate: string;
  status: 'pass' | 'fail';
  blockerIds?: string[];
  summary?: string;
  updatedArtifacts?: string[];
  contradictionsDelta?: string;
  externalProofAdded?: string;
  observedAt?: string;
}

export interface GovernanceRerunStage {
  rerunGate: string;
  capabilitySlot: string;
  canonicalAgent: string;
  targetArtifacts: string[];
  expectedDelta: string;
  actualExecutor?: string;
  adapterPath?: string;
  rerunOwner?: string;
  sourceGateFailureIds?: string[];
  outcome?: string;
}

export interface GovernanceAttemptHistoryEntry {
  attemptNumber: number;
  attemptId: string;
  outputPath: string;
  outcome: string;
  createdAt: string;
  sourceGateFailureIds: string[];
  rerunGateResult?: GovernanceRerunGateResult;
  executorRouting?: GovernanceExecutorRouting;
  remediationAuditTraceSummaryLines?: string[];
}

export interface GovernanceAttemptLoopState {
  version: 1;
  loopStateId: string;
  rerunGate: string;
  capabilitySlot: string;
  canonicalAgent: string;
  targetArtifacts: string[];
  maxAttempts: number;
  maxNoProgressRepeats: number;
  attemptCount: number;
  noProgressRepeatCount: number;
  status: 'idle' | 'awaiting_rerun' | 'completed' | 'stopped';
  lastGateResult: GovernanceRerunGateResult | null;
  lastStopReason: string | null;
  executorRouting: GovernanceExecutorRouting | null;
  remediationAuditTraceSummaryLines: string[];
  rerunChain?: GovernanceRerunStage[];
  rerunStageIndex?: number;
  createdAt: string;
  updatedAt: string;
  attempts: GovernanceAttemptHistoryEntry[];
}

export interface GovernanceExecutorPacket {
  hostKind: GovernanceHostKind;
  executionMode: GovernanceExecutionMode;
  routingMode: GovernanceRoutingMode;
  executorRoute: GovernanceExecutorRoute;
  prioritizedSignals: string[];
  packetStrategy: GovernanceExecutorRouting['packetStrategy'];
  routingReason: string;
  prompt: string;
  guardrails: string[];
  successCriteria: string[];
  stopConditions: string[];
}

export interface RunGovernanceRemediationInput
  extends Omit<GovernanceRemediationArtifactInput, 'modelHintsCandidate' | 'journeyContractHints'> {
  hostKind: GovernanceHostKind;
  providerAdapter?: GovernanceProviderAdapter;
  maxAttempts?: number;
  maxNoProgressRepeats?: number;
  loopStateId?: string;
  rerunGateResult?: GovernanceRerunGateResult;
  rerunChain?: GovernanceRerunStage[];
  rerunDecision?: GovernanceRerunDecision;
}

export interface RunGovernanceRemediationResult {
  artifactPath: string | null;
  artifactResult: GovernanceRemediationArtifactResult | null;
  executionIntentCandidate: ExecutionIntentCandidate | null;
  executionPlanDecision: ExecutionPlanDecision | null;
  journeyContractHints: JourneyContractRemediationHint[];
  runtimeContext: RuntimeContextFile | null;
  runtimeRegistry: RuntimeContextRegistry | null;
  runtimePolicy: RuntimePolicy | null;
  modelHintsCandidate: ModelGovernanceHintCandidate | null;
  loopState: GovernanceAttemptLoopState;
  currentAttemptNumber: number | null;
  nextAttemptNumber: number | null;
  shouldContinue: boolean;
  stopReason: string | null;
  rerunGateResultIngested: boolean;
  executorPacket: GovernanceExecutorPacket | null;
  packetPaths?: Partial<Record<GovernanceHostKind, string>>;
}

function toExecutionMode(hostKind: GovernanceHostKind): GovernanceExecutionMode {
  switch (hostKind) {
    case 'cursor':
      return 'cursor-mcp-task';
    case 'claude':
      return 'claude-agent-tool';
    case 'codex':
      return 'codex-spawn-agent';
    case 'generic':
    default:
      return 'generic-prompt-packet';
  }
}

function sanitizeLoopStateId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.trim() !== ''))];
}

function blockerSignature(result: GovernanceRerunGateResult | null): string {
  if (!result || result.status !== 'fail') {
    return '';
  }
  return unique([...(result.blockerIds ?? [])]).sort().join('|');
}

function resolveAbsolutePath(projectRoot: string, targetPath: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.join(projectRoot, targetPath);
}

function resolveGovernanceScoringDataPath(projectRoot: string): string {
  const envPath = process.env.SCORING_DATA_PATH;
  if (envPath && envPath.trim() !== '') {
    return path.isAbsolute(envPath) ? envPath : path.resolve(projectRoot, envPath);
  }

  const candidates = [
    path.join(projectRoot, 'packages', 'scoring', 'data'),
    path.join(projectRoot, 'scoring', 'data'),
    path.join(projectRoot, '_bmad-output', 'scoring'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]!;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseEpicStoryFromRuntimeContext(
  runtimeContext: RuntimeContextFile | null
): { epicId: number; storyId: number } | null {
  const dottedStory = runtimeContext?.storyId?.match(/^(\d+)\.(\d+)$/);
  if (dottedStory) {
    return {
      epicId: Number(dottedStory[1]),
      storyId: Number(dottedStory[2]),
    };
  }

  const epic = runtimeContext?.epicId?.match(/(\d+)/);
  const story = runtimeContext?.storyId?.match(/(\d+)$/);
  if (epic && story) {
    return {
      epicId: Number(epic[1]),
      storyId: Number(story[1]),
    };
  }

  return null;
}

function loadJourneyContractHintsForRuntime(
  projectRoot: string,
  runtimeContext: RuntimeContextFile | null
): JourneyContractRemediationHint[] {
  const dataPath = resolveGovernanceScoringDataPath(projectRoot);
  if (!fs.existsSync(dataPath)) {
    return [];
  }

  const records = loadAndDedupeRecords(dataPath).filter(
    (record) => record.scenario === 'real_dev' && record.journey_contract_signals != null
  );
  if (records.length === 0) {
    return [];
  }

  const epicStory = parseEpicStoryFromRuntimeContext(runtimeContext);
  const relevantRecords = epicStory
    ? records.filter((record) => {
        const parsed = parseEpicStoryFromRecord(record);
        return (
          parsed != null &&
          parsed.epicId === epicStory.epicId &&
          parsed.storyId === epicStory.storyId
        );
      })
    : records;

  if (relevantRecords.length === 0) {
    return [];
  }

  return buildGateRemediationHints(relevantRecords);
}

function buildJourneyContractActionLines(hints: JourneyContractRemediationHint[]): string[] {
  if (hints.length === 0) {
    return ['- (none)'];
  }

  return hints.flatMap((hint) => [
    `- ${hint.signal}: ${hint.recommendation}`,
    `  - Count: ${hint.count}`,
    `  - Affected stages: ${hint.affected_stages.join(', ') || '(none)'}`,
    `  - Stories: ${hint.epic_stories.join(', ') || '(none)'}`,
  ]);
}

function uniqueSignals(signals: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      signals.filter((signal): signal is string => Boolean(signal && signal.trim()))
    ),
  ].sort();
}

function resolveExecutorRouting(input: {
  journeyContractHints: JourneyContractRemediationHint[];
  rerunDecision?: GovernanceRerunDecision;
}): GovernanceExecutorRouting {
  const hintSignals = input.journeyContractHints.map((hint) => hint.signal);
  const decisionSignals = input.rerunDecision?.signals ?? [];
  const prioritizedSignals = uniqueSignals([...decisionSignals, ...hintSignals]);
  const targeted =
    input.rerunDecision?.mode === 'targeted' || prioritizedSignals.length > 0;

  if (targeted) {
    return {
      routingMode: 'targeted',
      executorRoute: 'journey-contract-remediation',
      prioritizedSignals,
      packetStrategy: 'journey-contract-remediation-packet',
      reason:
        input.rerunDecision?.reason ??
        'journey contract hints detected; use targeted remediation routing before generic blocker cleanup',
    };
  }

  return {
    routingMode: 'generic',
    executorRoute: 'default-gate-remediation',
    prioritizedSignals: [],
    packetStrategy: 'default-remediation-packet',
    reason:
      input.rerunDecision?.reason ??
      'no journey contract hints detected; use the default gate remediation route',
  };
}

function normalizeRerunStage(stage: GovernanceRerunStage): GovernanceRerunStage {
  return {
    ...stage,
    targetArtifacts: unique(stage.targetArtifacts ?? []),
    sourceGateFailureIds: unique(stage.sourceGateFailureIds ?? []),
  };
}

function createRerunStageFromInput(input: RunGovernanceRemediationInput): GovernanceRerunStage {
  return normalizeRerunStage({
    rerunGate: input.rerunGate,
    capabilitySlot: input.capabilitySlot,
    canonicalAgent: input.canonicalAgent,
    targetArtifacts: input.targetArtifacts,
    expectedDelta: input.expectedDelta,
    actualExecutor: input.actualExecutor,
    adapterPath: input.adapterPath,
    rerunOwner: input.rerunOwner,
    sourceGateFailureIds: input.sourceGateFailureIds,
    outcome: input.outcome,
  });
}

function activeRerunChain(state: GovernanceAttemptLoopState): GovernanceRerunStage[] {
  if (state.rerunChain && state.rerunChain.length > 0) {
    return state.rerunChain.map((stage) => normalizeRerunStage(stage));
  }
  return [
    normalizeRerunStage({
      rerunGate: state.rerunGate,
      capabilitySlot: state.capabilitySlot,
      canonicalAgent: state.canonicalAgent,
      targetArtifacts: state.targetArtifacts,
      expectedDelta: '',
    }),
  ];
}

function activeRerunStage(state: GovernanceAttemptLoopState): GovernanceRerunStage {
  const chain = activeRerunChain(state);
  const index = Math.min(Math.max(state.rerunStageIndex ?? 0, 0), chain.length - 1);
  return chain[index];
}

function syncLoopStateWithActiveRerunStage(state: GovernanceAttemptLoopState): GovernanceAttemptLoopState {
  const chain = activeRerunChain(state);
  const index = Math.min(Math.max(state.rerunStageIndex ?? 0, 0), chain.length - 1);
  const stage = chain[index];
  state.rerunChain = chain;
  state.rerunStageIndex = index;
  state.rerunGate = stage.rerunGate;
  state.capabilitySlot = stage.capabilitySlot;
  state.canonicalAgent = stage.canonicalAgent;
  state.targetArtifacts = unique(stage.targetArtifacts);
  return state;
}

function ensureLoopStateRerunChain(
  state: GovernanceAttemptLoopState,
  input: RunGovernanceRemediationInput
): GovernanceAttemptLoopState {
  if ((!state.rerunChain || state.rerunChain.length === 0) && input.rerunChain?.length) {
    state.rerunChain = input.rerunChain.map((stage) => normalizeRerunStage(stage));
    state.rerunStageIndex = 0;
  } else if (!state.rerunChain || state.rerunChain.length === 0) {
    state.rerunChain = [createRerunStageFromInput(input)];
    state.rerunStageIndex = 0;
  }

  return syncLoopStateWithActiveRerunStage(state);
}

function advanceLoopStateToNextRerunStage(
  state: GovernanceAttemptLoopState
): GovernanceRerunStage | null {
  const chain = activeRerunChain(state);
  const currentIndex = Math.min(Math.max(state.rerunStageIndex ?? 0, 0), chain.length - 1);
  if (currentIndex >= chain.length - 1) {
    return null;
  }
  state.rerunChain = chain;
  state.rerunStageIndex = currentIndex + 1;
  syncLoopStateWithActiveRerunStage(state);
  state.updatedAt = nowIso();
  return activeRerunStage(state);
}

function deriveLoopStateId(input: RunGovernanceRemediationInput): string {
  return sanitizeLoopStateId(
    input.loopStateId ??
      `${input.rerunGate}--${input.capabilitySlot}--${input.targetArtifacts.join('-') || 'artifacts'}`
  );
}

export function governanceAttemptLoopStatePath(projectRoot: string, loopStateId: string): string {
  return path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'governance',
    'remediation-loops',
    `${sanitizeLoopStateId(loopStateId)}.json`
  );
}

function defaultGovernanceAttemptLoopState(
  input: RunGovernanceRemediationInput,
  loopStateId: string
): GovernanceAttemptLoopState {
  const timestamp = nowIso();
  const rerunChain = (input.rerunChain?.length ? input.rerunChain : [createRerunStageFromInput(input)]).map(
    (stage) => normalizeRerunStage(stage)
  );
  const firstStage = rerunChain[0];
  return {
    version: 1,
    loopStateId,
    rerunGate: firstStage.rerunGate,
    capabilitySlot: firstStage.capabilitySlot,
    canonicalAgent: firstStage.canonicalAgent,
    targetArtifacts: firstStage.targetArtifacts,
    maxAttempts: input.maxAttempts ?? 3,
    maxNoProgressRepeats: input.maxNoProgressRepeats ?? 1,
    attemptCount: 0,
    noProgressRepeatCount: 0,
    status: 'idle',
    lastGateResult: null,
    lastStopReason: null,
    executorRouting: null,
    remediationAuditTraceSummaryLines: [],
    rerunChain,
    rerunStageIndex: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: [],
  };
}

function tryReadRuntimeContext(projectRoot: string): RuntimeContextFile | null {
  try {
    return readRuntimeContext(projectRoot);
  } catch {
    return null;
  }
}

function tryReadRuntimeContextRegistry(projectRoot: string): RuntimeContextRegistry | null {
  try {
    return readRuntimeContextRegistry(projectRoot);
  } catch {
    return null;
  }
}

function tryResolveRuntimePolicy(runtimeContext: RuntimeContextFile | null): RuntimePolicy | null {
  if (!runtimeContext) {
    return null;
  }
  try {
    return resolveRuntimePolicy({
      flow: runtimeContext.flow,
      stage: runtimeContext.stage,
      epicId: runtimeContext.epicId,
      storyId: runtimeContext.storyId,
      storySlug: runtimeContext.storySlug,
      runId: runtimeContext.runId,
      artifactRoot: runtimeContext.artifactRoot,
      contextSource: runtimeContext.sourceMode,
    });
  } catch {
    return null;
  }
}

export function readGovernanceAttemptLoopState(
  projectRoot: string,
  loopStateId: string
): GovernanceAttemptLoopState {
  const file = governanceAttemptLoopStatePath(projectRoot, loopStateId);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as GovernanceAttemptLoopState;
}

function tryReadGovernanceAttemptLoopState(
  projectRoot: string,
  loopStateId: string
): GovernanceAttemptLoopState | null {
  const file = governanceAttemptLoopStatePath(projectRoot, loopStateId);
  if (!fs.existsSync(file)) {
    return null;
  }
  return readGovernanceAttemptLoopState(projectRoot, loopStateId);
}

export function writeGovernanceAttemptLoopState(
  projectRoot: string,
  state: GovernanceAttemptLoopState
): void {
  const file = governanceAttemptLoopStatePath(projectRoot, state.loopStateId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function shouldStopForHumanPrReview(input: {
  rerunGateResult: GovernanceRerunGateResult;
  nextStage: GovernanceRerunStage | null;
}): boolean {
  return (
    input.rerunGateResult.gate === 'bmad_story_stage4' &&
    input.rerunGateResult.status === 'pass' &&
    input.nextStage?.rerunGate === 'pr_review'
  );
}

function ingestRerunGateResult(
  state: GovernanceAttemptLoopState,
  result: GovernanceRerunGateResult
): GovernanceAttemptLoopState {
  const previous = state.lastGateResult;
  const lastAttempt = state.attempts[state.attempts.length - 1];
  if (lastAttempt) {
    lastAttempt.rerunGateResult = {
      ...result,
      observedAt: result.observedAt ?? nowIso(),
    };
  }

  const normalized: GovernanceRerunGateResult = {
    ...result,
    observedAt: result.observedAt ?? nowIso(),
  };

  if (
    normalized.status === 'fail' &&
    previous?.status === 'fail' &&
    blockerSignature(previous) !== '' &&
    blockerSignature(previous) === blockerSignature(normalized)
  ) {
    state.noProgressRepeatCount += 1;
  } else if (normalized.status === 'fail') {
    state.noProgressRepeatCount = 0;
  } else {
    state.noProgressRepeatCount = 0;
  }

  state.lastGateResult = normalized;
  state.updatedAt = nowIso();
  return state;
}

function writeLoopStateTraceSummary(input: {
  loopState: GovernanceAttemptLoopState;
  stopReason: string | null;
  journeyContractHints: JourneyContractRemediationHint[];
  executorRouting: GovernanceExecutorRouting;
  attachToLatestAttempt?: boolean;
}): GovernanceAttemptLoopState {
  input.loopState.executorRouting = {
    ...input.executorRouting,
    prioritizedSignals: [...input.executorRouting.prioritizedSignals],
  };
  input.loopState.remediationAuditTraceSummaryLines = buildRemediationAuditTraceSummaryLines(
    input.stopReason ?? undefined,
    input.journeyContractHints,
    input.executorRouting
  );

  if (input.attachToLatestAttempt) {
    const lastAttempt = input.loopState.attempts[input.loopState.attempts.length - 1];
    if (lastAttempt) {
      lastAttempt.executorRouting = {
        ...input.executorRouting,
        prioritizedSignals: [...input.executorRouting.prioritizedSignals],
      };
      lastAttempt.remediationAuditTraceSummaryLines = [
        ...input.loopState.remediationAuditTraceSummaryLines,
      ];
    }
  }

  return input.loopState;
}

function buildPacketPrompt(input: {
  runtimeContext: RuntimeContextFile | null;
  runtimePolicy: RuntimePolicy | null;
  loopState: GovernanceAttemptLoopState;
  currentAttemptNumber: number;
  rerunGate: string;
  artifactMarkdown: string;
  journeyContractHints: JourneyContractRemediationHint[];
  executorRouting: GovernanceExecutorRouting;
}): string {
  const runtimeLines = input.runtimeContext
    ? [
        `- Flow: ${input.runtimeContext.flow}`,
        `- Stage: ${input.runtimeContext.stage}`,
        `- Scope: ${input.runtimeContext.contextScope ?? 'project'}`,
        `- Story ID: ${input.runtimeContext.storyId ?? '(none)'}`,
        `- Run ID: ${input.runtimeContext.runId ?? '(none)'}`,
        `- Artifact Root: ${input.runtimeContext.artifactRoot ?? '(none)'}`,
      ]
    : ['- (none)'];
  const policyLines = input.runtimePolicy
    ? [
        `- Trigger Stage: ${input.runtimePolicy.triggerStage}`,
        `- Strictness: ${input.runtimePolicy.strictness}`,
        `- Audit Required: ${input.runtimePolicy.auditRequired ? 'yes' : 'no'}`,
        `- Mandatory Gate: ${input.runtimePolicy.mandatoryGate ? 'yes' : 'no'}`,
      ]
    : ['- (none)'];
  return [
    '# Governance Remediation Task Packet',
    '',
    '## Runtime Context',
    ...runtimeLines,
    '',
    '## Runtime Policy',
    ...policyLines,
    '',
    '## Attempt Loop State',
    `- Loop State ID: ${input.loopState.loopStateId}`,
    `- Current Attempt Number: ${input.currentAttemptNumber}`,
    `- Attempt Count So Far: ${input.loopState.attemptCount}`,
    `- Max Attempts: ${input.loopState.maxAttempts}`,
    `- No-Progress Repeat Count: ${input.loopState.noProgressRepeatCount}`,
    `- Awaiting Rerun Gate: ${input.rerunGate}`,
    `- Previous Gate Result: ${input.loopState.lastGateResult?.status ?? 'none'}`,
    '',
    '## Executor Routing Decision',
    `- Routing Mode: ${input.executorRouting.routingMode}`,
    `- Executor Route: ${input.executorRouting.executorRoute}`,
    `- Packet Strategy: ${input.executorRouting.packetStrategy}`,
    `- Prioritized Signals: ${
      input.executorRouting.prioritizedSignals.join(', ') || '(none)'
    }`,
    `- Routing Reason: ${input.executorRouting.reason}`,
    '',
    '## Guardrails',
    '- Do not change blocker ownership.',
    '- Do not change failed-check severity.',
    '- Do not change artifact-derived root target.',
    '- Do not continue downstream while the blocker gate remains open.',
    '',
    '## Success Criteria',
    '- Apply the minimal remediation needed to close the named blockers.',
    '- Update only the target artifacts required by the remediation artifact.',
    `- Leave the work ready for rerun of \`${input.rerunGate}\`.`,
    ...(input.executorRouting.routingMode === 'targeted'
      ? [
          '- Resolve the prioritized journey contract signals first and keep the same Journey Slice evidence chain intact.',
        ]
      : []),
    '',
    '## Stop Conditions',
    '- Stop if the rerun gate passes.',
    '- Stop if governance-owned fields would need to change.',
    '- Stop if max attempts is reached or no-progress repeats exceed the policy limit.',
    '',
    '## Targeted Remediation Actions',
    ...buildJourneyContractActionLines(input.journeyContractHints),
    '',
    '## Remediation Artifact',
    '',
    input.artifactMarkdown,
    '',
  ].join('\n');
}

function buildExecutorPacket(input: {
  hostKind: GovernanceHostKind;
  runtimeContext: RuntimeContextFile | null;
  runtimePolicy: RuntimePolicy | null;
  loopState: GovernanceAttemptLoopState;
  currentAttemptNumber: number;
  rerunGate: string;
  artifactMarkdown: string;
  journeyContractHints: JourneyContractRemediationHint[];
  rerunDecision?: GovernanceRerunDecision;
  executorRouting?: GovernanceExecutorRouting;
}): GovernanceExecutorPacket {
  const executorRouting =
    input.executorRouting ??
    resolveExecutorRouting({
      journeyContractHints: input.journeyContractHints,
      rerunDecision: input.rerunDecision,
    });
  const successCriteria = [
    'Apply the minimal remediation needed to close the named blockers.',
    'Update only the target artifacts required by the remediation artifact.',
    `Leave the work ready for rerun of ${input.rerunGate}.`,
    ...(executorRouting.routingMode === 'targeted'
      ? [
          'Resolve the prioritized journey contract signals first and keep the same Journey Slice evidence chain intact.',
        ]
      : []),
  ];
  return {
    hostKind: input.hostKind,
    executionMode: toExecutionMode(input.hostKind),
    routingMode: executorRouting.routingMode,
    executorRoute: executorRouting.executorRoute,
    prioritizedSignals: executorRouting.prioritizedSignals,
    packetStrategy: executorRouting.packetStrategy,
    routingReason: executorRouting.reason,
    prompt: buildPacketPrompt({
      ...input,
      executorRouting,
    }),
    guardrails: [
      'Do not change blocker ownership.',
      'Do not change failed-check severity.',
      'Do not change artifact-derived root target.',
      'Do not continue downstream while the blocker gate remains open.',
    ],
    successCriteria,
    stopConditions: [
      'Stop if the rerun gate passes.',
      'Stop if governance-owned fields would need to change.',
      'Stop if max attempts is reached.',
      'Stop if no-progress repeats exceed the policy limit.',
    ],
  };
}

export function createGovernanceExecutorPacket(input: {
  hostKind: GovernanceHostKind;
  runtimeContext: RuntimeContextFile | null;
  runtimePolicy: RuntimePolicy | null;
  loopState: GovernanceAttemptLoopState;
  currentAttemptNumber: number;
  rerunGate: string;
  artifactMarkdown: string;
  journeyContractHints: JourneyContractRemediationHint[];
  rerunDecision?: GovernanceRerunDecision;
  executorRouting?: GovernanceExecutorRouting;
}): GovernanceExecutorPacket {
  return buildExecutorPacket(input);
}

export function governanceExecutorPacketPath(
  artifactPath: string,
  hostKind: GovernanceHostKind
): string {
  return artifactPath.replace(/\.md$/i, `.${hostKind}-packet.md`);
}

export function renderGovernanceExecutorPacket(packet: GovernanceExecutorPacket): string {
  return [
    '# Governance Remediation Executor Packet',
    '',
    `- Host Kind: ${packet.hostKind}`,
    `- Execution Mode: ${packet.executionMode}`,
    `- Routing Mode: ${packet.routingMode}`,
    `- Executor Route: ${packet.executorRoute}`,
    `- Packet Strategy: ${packet.packetStrategy}`,
    `- Prioritized Signals: ${packet.prioritizedSignals.join(', ') || '(none)'}`,
    `- Routing Reason: ${packet.routingReason}`,
    '',
    '## Guardrails',
    ...packet.guardrails.map((line) => `- ${line}`),
    '',
    '## Success Criteria',
    ...packet.successCriteria.map((line) => `- ${line}`),
    '',
    '## Stop Conditions',
    ...packet.stopConditions.map((line) => `- ${line}`),
    '',
    '## Prompt',
    '',
    packet.prompt,
    '',
  ].join('\n');
}

export function writeGovernanceExecutorPacket(
  artifactPath: string,
  packet: GovernanceExecutorPacket
): string {
  const file = governanceExecutorPacketPath(artifactPath, packet.hostKind);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, renderGovernanceExecutorPacket(packet), 'utf8');
  return file;
}

async function resolveModelHintsCandidate(
  input: RunGovernanceRemediationInput
): Promise<ModelGovernanceHintCandidate | null> {
  if (!input.providerAdapter || !input.promptText) {
    return null;
  }

  const adapterInput: GovernanceProviderAdapterInput = {
    projectRoot: input.projectRoot,
    hostKind: input.hostKind,
    promptText: input.promptText,
    stageContextKnown: input.stageContextKnown,
    gateFailureExists: input.gateFailureExists,
    blockerOwnershipLocked: input.blockerOwnershipLocked,
    rootTargetLocked: input.rootTargetLocked,
    equivalentAdapterCount: input.equivalentAdapterCount,
    capabilitySlot: input.capabilitySlot,
    canonicalAgent: input.canonicalAgent,
    actualExecutor: input.actualExecutor,
    targetArtifacts: input.targetArtifacts,
    availableSkills: input.availableSkills,
    skillPaths: input.skillPaths,
    skillInventory: input.skillInventory,
  };

  return resolveModelHintsViaGovernanceProvider(adapterInput, input.providerAdapter);
}

function stopResult(input: {
  loopState: GovernanceAttemptLoopState;
  stopReason: string;
  runtimeContext: RuntimeContextFile | null;
  runtimeRegistry: RuntimeContextRegistry | null;
  runtimePolicy: RuntimePolicy | null;
  rerunGateResultIngested: boolean;
  modelHintsCandidate: ModelGovernanceHintCandidate | null;
  executionIntentCandidate: ExecutionIntentCandidate | null;
  executionPlanDecision: ExecutionPlanDecision | null;
  journeyContractHints: JourneyContractRemediationHint[];
}): RunGovernanceRemediationResult {
  return {
    artifactPath: null,
    artifactResult: null,
    executionIntentCandidate: input.executionIntentCandidate,
    executionPlanDecision: input.executionPlanDecision,
    journeyContractHints: input.journeyContractHints,
    runtimeContext: input.runtimeContext,
    runtimeRegistry: input.runtimeRegistry,
    runtimePolicy: input.runtimePolicy,
    modelHintsCandidate: input.modelHintsCandidate,
    loopState: input.loopState,
    currentAttemptNumber: input.loopState.attemptCount > 0 ? input.loopState.attemptCount : null,
    nextAttemptNumber: null,
    shouldContinue: false,
    stopReason: input.stopReason,
    rerunGateResultIngested: input.rerunGateResultIngested,
    executorPacket: null,
    packetPaths: {},
  };
}

export async function runGovernanceRemediation(
  input: RunGovernanceRemediationInput
): Promise<RunGovernanceRemediationResult> {
  const loopStateId = deriveLoopStateId(input);
  const runtimeContext = tryReadRuntimeContext(input.projectRoot);
  const runtimeRegistry = tryReadRuntimeContextRegistry(input.projectRoot);
  const runtimePolicy = tryResolveRuntimePolicy(runtimeContext);
  const resolvedSkillInventory =
    input.availableSkills?.length || input.skillPaths?.length || input.skillInventory?.length
      ? {
          availableSkills: input.availableSkills ?? [],
          skillPaths: input.skillPaths ?? [],
          skillInventory: input.skillInventory ?? [],
        }
      : resolveGovernanceSkillInventory({
          projectRoot: input.projectRoot,
          hostKind: input.hostKind,
        });
  const modelHintsCandidate = await resolveModelHintsCandidate(input);
  const promptHintUsage = resolvePromptHintUsageFromText({
    projectRoot: input.projectRoot,
    promptText: input.promptText,
    stageContextKnown: input.stageContextKnown,
    gateFailure: {
      exists: input.gateFailureExists,
      blockerOwnershipLocked: input.blockerOwnershipLocked,
    },
    artifactState: {
      rootTargetLocked: input.rootTargetLocked,
      equivalentAdapterCount: input.equivalentAdapterCount,
    },
    modelHintsCandidate,
    availableSkills: resolvedSkillInventory.availableSkills,
    skillPaths: resolvedSkillInventory.skillPaths,
    skillInventory: resolvedSkillInventory.skillInventory,
  });
  const executionIntentCandidate = promptHintUsage.executionIntentCandidate;
  const executionPlanDecision = promptHintUsage.executionPlanDecision;
  const journeyContractHints = loadJourneyContractHintsForRuntime(
    input.projectRoot,
    runtimeContext
  );

  let loopState =
    tryReadGovernanceAttemptLoopState(input.projectRoot, loopStateId) ??
    defaultGovernanceAttemptLoopState(input, loopStateId);
  loopState.maxAttempts = input.maxAttempts ?? loopState.maxAttempts;
  loopState.maxNoProgressRepeats = input.maxNoProgressRepeats ?? loopState.maxNoProgressRepeats;
  loopState = ensureLoopStateRerunChain(loopState, input);

  let rerunGateResultIngested = false;
  if (input.rerunGateResult) {
    loopState = ingestRerunGateResult(loopState, input.rerunGateResult);
    rerunGateResultIngested = true;

    if (input.rerunGateResult.status === 'pass') {
      const nextStage = advanceLoopStateToNextRerunStage(loopState);
      if (!nextStage) {
        loopState = writeLoopStateTraceSummary({
          loopState,
          stopReason: 'rerun gate passed',
          journeyContractHints,
          executorRouting: resolveExecutorRouting({
            journeyContractHints,
            rerunDecision: input.rerunDecision,
          }),
        });
        loopState.status = 'completed';
        loopState.lastStopReason = 'rerun gate passed';
        loopState.updatedAt = nowIso();
        writeGovernanceAttemptLoopState(input.projectRoot, loopState);
        return stopResult({
          loopState,
          stopReason: 'rerun gate passed',
          runtimeContext,
          runtimeRegistry,
          runtimePolicy,
          rerunGateResultIngested,
          modelHintsCandidate,
          executionIntentCandidate,
          executionPlanDecision,
          journeyContractHints,
        });
      }

      if (shouldStopForHumanPrReview({ rerunGateResult: input.rerunGateResult, nextStage })) {
        loopState = writeLoopStateTraceSummary({
          loopState,
          stopReason: 'await human review',
          journeyContractHints,
          executorRouting: resolveExecutorRouting({
            journeyContractHints,
            rerunDecision: input.rerunDecision,
          }),
        });
        loopState.status = 'stopped';
        loopState.lastStopReason = 'await human review';
        loopState.updatedAt = nowIso();
        writeGovernanceAttemptLoopState(input.projectRoot, loopState);
        return stopResult({
          loopState,
          stopReason: 'await human review',
          runtimeContext,
          runtimeRegistry,
          runtimePolicy,
          rerunGateResultIngested,
          modelHintsCandidate,
          executionIntentCandidate,
          executionPlanDecision,
          journeyContractHints,
        });
      }

      loopState.status = 'idle';
      loopState.lastStopReason = null;
      loopState.updatedAt = nowIso();
    }

    if (loopState.attemptCount >= loopState.maxAttempts) {
      loopState = writeLoopStateTraceSummary({
        loopState,
        stopReason: `max attempts reached (${loopState.maxAttempts})`,
        journeyContractHints,
        executorRouting: resolveExecutorRouting({
          journeyContractHints,
          rerunDecision: input.rerunDecision,
        }),
      });
      loopState.status = 'stopped';
      loopState.lastStopReason = `max attempts reached (${loopState.maxAttempts})`;
      loopState.updatedAt = nowIso();
      writeGovernanceAttemptLoopState(input.projectRoot, loopState);
      return stopResult({
        loopState,
        stopReason: loopState.lastStopReason,
        runtimeContext,
        runtimeRegistry,
        runtimePolicy,
        rerunGateResultIngested,
        modelHintsCandidate,
        executionIntentCandidate,
        executionPlanDecision,
        journeyContractHints,
      });
    }

    if (loopState.noProgressRepeatCount >= loopState.maxNoProgressRepeats) {
      loopState = writeLoopStateTraceSummary({
        loopState,
        stopReason: `no-progress repeat limit reached (${loopState.maxNoProgressRepeats})`,
        journeyContractHints,
        executorRouting: resolveExecutorRouting({
          journeyContractHints,
          rerunDecision: input.rerunDecision,
        }),
      });
      loopState.status = 'stopped';
      loopState.lastStopReason = `no-progress repeat limit reached (${loopState.maxNoProgressRepeats})`;
      loopState.updatedAt = nowIso();
      writeGovernanceAttemptLoopState(input.projectRoot, loopState);
      return stopResult({
        loopState,
        stopReason: loopState.lastStopReason,
        runtimeContext,
        runtimeRegistry,
        runtimePolicy,
        rerunGateResultIngested,
        modelHintsCandidate,
        executionIntentCandidate,
        executionPlanDecision,
        journeyContractHints,
      });
    }
  }

  const stage = activeRerunStage(loopState);
  const currentAttemptNumber = loopState.attemptCount + 1;
  if (currentAttemptNumber > loopState.maxAttempts) {
    loopState = writeLoopStateTraceSummary({
      loopState,
      stopReason: `max attempts reached (${loopState.maxAttempts})`,
      journeyContractHints,
      executorRouting: resolveExecutorRouting({
        journeyContractHints,
        rerunDecision: input.rerunDecision,
      }),
    });
    loopState.status = 'stopped';
    loopState.lastStopReason = `max attempts reached (${loopState.maxAttempts})`;
    loopState.updatedAt = nowIso();
    writeGovernanceAttemptLoopState(input.projectRoot, loopState);
    return stopResult({
      loopState,
      stopReason: loopState.lastStopReason,
      runtimeContext,
      runtimeRegistry,
      runtimePolicy,
      rerunGateResultIngested,
      modelHintsCandidate,
      executionIntentCandidate,
      executionPlanDecision,
      journeyContractHints,
    });
  }
  const absoluteOutputPath = resolveAbsolutePath(input.projectRoot, input.outputPath);
  const sharedArtifactsUpdated = unique([
    ...(input.sharedArtifactsUpdated ?? []),
    ...(input.rerunGateResult?.updatedArtifacts ?? []),
  ]);
  const executorRouting = resolveExecutorRouting({
    journeyContractHints,
    rerunDecision: input.rerunDecision,
  });

  const artifactResult = writeGovernanceRemediationArtifact({
    ...input,
    outputPath: absoluteOutputPath,
    modelHintsCandidate,
    journeyContractHints,
    sourceGateFailureIds:
      stage.sourceGateFailureIds && stage.sourceGateFailureIds.length > 0
        ? stage.sourceGateFailureIds
        : input.sourceGateFailureIds,
    capabilitySlot: stage.capabilitySlot,
    canonicalAgent: stage.canonicalAgent,
      actualExecutor: stage.actualExecutor ?? input.actualExecutor,
      adapterPath: stage.adapterPath ?? input.adapterPath,
      targetArtifacts: stage.targetArtifacts,
      availableSkills: resolvedSkillInventory.availableSkills,
      skillPaths: resolvedSkillInventory.skillPaths,
      skillInventory: resolvedSkillInventory.skillInventory,
      expectedDelta: stage.expectedDelta || input.expectedDelta,
    rerunOwner: stage.rerunOwner ?? input.rerunOwner,
    rerunGate: stage.rerunGate,
    outcome: stage.outcome ?? input.outcome,
    sharedArtifactsUpdated,
    contradictionsDelta:
      input.contradictionsDelta ?? input.rerunGateResult?.contradictionsDelta,
    externalProofAdded:
      input.externalProofAdded ?? input.rerunGateResult?.externalProofAdded,
    readyToRerunGate: input.readyToRerunGate ?? false,
    stopReason: input.stopReason,
    executorRouting,
  });

  loopState.attemptCount = currentAttemptNumber;
  loopState.status = 'awaiting_rerun';
  loopState.lastStopReason = null;
  loopState.updatedAt = nowIso();
  loopState.attempts.push({
    attemptNumber: currentAttemptNumber,
    attemptId: input.attemptId,
    outputPath: absoluteOutputPath,
    outcome: stage.outcome ?? input.outcome,
    createdAt: loopState.updatedAt,
    sourceGateFailureIds:
      stage.sourceGateFailureIds && stage.sourceGateFailureIds.length > 0
        ? stage.sourceGateFailureIds
        : input.sourceGateFailureIds,
  });
  loopState = writeLoopStateTraceSummary({
    loopState,
    stopReason: input.stopReason ?? null,
    journeyContractHints,
    executorRouting,
    attachToLatestAttempt: true,
  });
  writeGovernanceAttemptLoopState(input.projectRoot, loopState);

  const provisionalExecutorPacket = buildExecutorPacket({
    hostKind: input.hostKind,
    runtimeContext,
    runtimePolicy,
    loopState,
    currentAttemptNumber,
    rerunGate: stage.rerunGate,
    artifactMarkdown: artifactResult.markdown,
    journeyContractHints: artifactResult.journeyContractHints,
    rerunDecision: input.rerunDecision,
    executorRouting,
  });

  const artifactWithRunnerSummary: GovernanceRemediationArtifactResult = {
    ...artifactResult,
    markdown: appendRunnerSummaryToArtifactMarkdown(
      artifactResult.markdown,
      buildGovernanceRemediationRunnerSummaryLines({
        artifactPath: absoluteOutputPath,
        artifactResult,
        executionIntentCandidate,
        executionPlanDecision,
        journeyContractHints: artifactResult.journeyContractHints,
        runtimeContext,
        runtimeRegistry,
        runtimePolicy,
        modelHintsCandidate,
        loopState,
        currentAttemptNumber,
        nextAttemptNumber: currentAttemptNumber + 1,
        shouldContinue: true,
        stopReason: null,
        rerunGateResultIngested,
        executorPacket: provisionalExecutorPacket,
        packetPaths: {},
      })
    ),
  };
  fs.writeFileSync(absoluteOutputPath, artifactWithRunnerSummary.markdown, 'utf8');

  const executorPacket = buildExecutorPacket({
    hostKind: input.hostKind,
    runtimeContext,
    runtimePolicy,
    loopState,
    currentAttemptNumber,
    rerunGate: stage.rerunGate,
    artifactMarkdown: artifactWithRunnerSummary.markdown,
    journeyContractHints: artifactWithRunnerSummary.journeyContractHints,
    rerunDecision: input.rerunDecision,
    executorRouting,
  });

  return {
    artifactPath: absoluteOutputPath,
    artifactResult: artifactWithRunnerSummary,
    executionIntentCandidate:
      artifactWithRunnerSummary.executionIntentCandidate ?? executionIntentCandidate,
    executionPlanDecision:
      artifactWithRunnerSummary.executionPlanDecision ?? executionPlanDecision,
    journeyContractHints: artifactWithRunnerSummary.journeyContractHints,
    runtimeContext,
    runtimeRegistry,
    runtimePolicy,
    modelHintsCandidate,
    loopState,
    currentAttemptNumber,
    nextAttemptNumber: currentAttemptNumber + 1,
    shouldContinue: true,
    stopReason: null,
    rerunGateResultIngested,
    executorPacket,
    packetPaths: {},
  };
}

function parseBooleanFlag(value: string | undefined, flagName: string): boolean {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new Error(`Invalid ${flagName}: expected true|false`);
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function argValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

export function buildGovernanceRemediationRunnerSummaryLines(
  result: RunGovernanceRemediationResult
): string[] {
  const lines = [
    '## Governance Remediation Runner Summary',
    `- Loop State ID: ${result.loopState.loopStateId}`,
    `- Current Attempt Number: ${result.currentAttemptNumber ?? '(none)'}`,
    `- Next Attempt Number: ${result.nextAttemptNumber ?? '(none)'}`,
    `- Should Continue: ${result.shouldContinue ? 'yes' : 'no'}`,
    `- Stop Reason: ${result.stopReason ?? '(none)'}`,
    `- Artifact Path: ${result.artifactPath ?? '(none)'}`,
    `- Executor Packet: ${result.executorPacket ? 'yes' : 'no'}`,
    '',
    '## Loop State Trace Summary',
    ...(result.loopState.remediationAuditTraceSummaryLines.length > 0
      ? result.loopState.remediationAuditTraceSummaryLines.map((line) => `- ${line}`)
      : ['- (none)']),
  ];

  const packetPaths = result.packetPaths
    ? Object.entries(result.packetPaths).filter((entry): entry is [string, string] => Boolean(entry[1]))
    : [];
  if (packetPaths.length > 0) {
    lines.push('');
    lines.push('## Packet Paths');
    for (const [hostKind, packetPath] of packetPaths) {
      lines.push(`- ${hostKind}: ${packetPath}`);
    }
  }

  return lines;
}

function renderGovernanceRemediationRunnerSummary(
  result: RunGovernanceRemediationResult
): string {
  return renderGovernanceRunnerSummaryLines(
    buildGovernanceRemediationRunnerSummaryLines(result)
  );
}

async function main(): Promise<void> {
  const argvTokens = process.argv.map((value) => path.basename(String(value)).toLowerCase());
  const isDirectRunnerCli = argvTokens.some((value) => value.includes('governance-remediation-runner'));
  if (process.env.BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS === '1') {
    return;
  }
  if (require.main !== module || !isDirectRunnerCli) {
    return;
  }

  const args = process.argv.slice(2);
  const jsonInputPath = argValue(args, '--jsonInputPath');
  if (jsonInputPath) {
    const payload = JSON.parse(fs.readFileSync(path.resolve(jsonInputPath), 'utf8')) as RunGovernanceRemediationInput;
    const result = await runGovernanceRemediation(payload);
    process.stdout.write(JSON.stringify(result));
    return;
  }

  const outputPath = argValue(args, '--outputPath');
  if (!outputPath) {
    throw new Error(
      'Usage: npx ts-node --transpile-only scripts/governance-remediation-runner.ts --outputPath <path> --attemptId <id> --capabilitySlot <slot> --canonicalAgent <agent> --actualExecutor <executor> --adapterPath <path> --expectedDelta <text> --rerunOwner <owner> --rerunGate <gate> --outcome <text> --stageContextKnown true|false --gateFailureExists true|false --blockerOwnershipLocked true|false --rootTargetLocked true|false --equivalentAdapterCount <n> [--projectRoot <path>] [--configPath <path>] [--promptText <text>] [--sourceGateFailureIds a,b] [--targetArtifacts a,b]'
    );
  }

  const projectRoot = argValue(args, '--projectRoot')
    ? path.resolve(argValue(args, '--projectRoot') as string)
    : process.cwd();
  const config = readGovernanceRemediationConfig(projectRoot, argValue(args, '--configPath'));
  const providerAdapter = createGovernanceProviderAdapterFromConfig(config);

  const result = await runGovernanceRemediation({
    projectRoot,
    outputPath,
    promptText: argValue(args, '--promptText'),
    stageContextKnown: parseBooleanFlag(argValue(args, '--stageContextKnown'), '--stageContextKnown'),
    gateFailureExists: parseBooleanFlag(argValue(args, '--gateFailureExists'), '--gateFailureExists'),
    blockerOwnershipLocked: parseBooleanFlag(
      argValue(args, '--blockerOwnershipLocked'),
      '--blockerOwnershipLocked'
    ),
    rootTargetLocked: parseBooleanFlag(argValue(args, '--rootTargetLocked'), '--rootTargetLocked'),
    equivalentAdapterCount: Number(argValue(args, '--equivalentAdapterCount') ?? '0'),
    attemptId: argValue(args, '--attemptId') ?? 'attempt-unknown',
    sourceGateFailureIds: parseList(argValue(args, '--sourceGateFailureIds')),
    capabilitySlot: argValue(args, '--capabilitySlot') ?? 'unknown-slot',
    canonicalAgent: argValue(args, '--canonicalAgent') ?? 'unknown-agent',
    actualExecutor: argValue(args, '--actualExecutor') ?? 'unknown-executor',
    adapterPath: argValue(args, '--adapterPath') ?? 'unknown-adapter',
    targetArtifacts: parseList(argValue(args, '--targetArtifacts')),
    expectedDelta: argValue(args, '--expectedDelta') ?? 'n/a',
    rerunOwner: argValue(args, '--rerunOwner') ?? 'PM',
    rerunGate: argValue(args, '--rerunGate') ?? 'n/a',
    outcome: argValue(args, '--outcome') ?? 'n/a',
    sharedArtifactsUpdated: parseList(argValue(args, '--sharedArtifactsUpdated')),
    contradictionsDelta: argValue(args, '--contradictionsDelta'),
    externalProofAdded: argValue(args, '--externalProofAdded'),
    readyToRerunGate: argValue(args, '--readyToRerunGate')
      ? parseBooleanFlag(argValue(args, '--readyToRerunGate'), '--readyToRerunGate')
      : undefined,
    stopReason: argValue(args, '--stopReason'),
    hostKind: config.primaryHost,
    providerAdapter,
    maxAttempts: argValue(args, '--maxAttempts')
      ? Number(argValue(args, '--maxAttempts'))
      : undefined,
    maxNoProgressRepeats: argValue(args, '--maxNoProgressRepeats')
      ? Number(argValue(args, '--maxNoProgressRepeats'))
      : undefined,
    loopStateId: argValue(args, '--loopStateId'),
  });

  if (!result.executorPacket || !result.artifactPath || !result.artifactResult) {
    console.log(renderGovernanceRemediationRunnerSummary(result));
    return;
  }

  const packetPaths: Partial<Record<GovernanceHostKind, string>> = {};
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
      rerunDecision: {
        mode: result.executorPacket.routingMode,
        signals: result.executorPacket.prioritizedSignals,
        reason: result.executorPacket.routingReason,
      },
      executorRouting: {
        routingMode: result.executorPacket.routingMode,
        executorRoute: result.executorPacket.executorRoute,
        prioritizedSignals: result.executorPacket.prioritizedSignals,
        packetStrategy: result.executorPacket.packetStrategy,
        reason: result.executorPacket.routingReason,
      },
    });
    packetPaths[hostKind] = writeGovernanceExecutorPacket(result.artifactPath, packet);
  }

  result.packetPaths = packetPaths;
  console.log(renderGovernanceRemediationRunnerSummary(result));
}

void main();
