import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  GovernanceRemediationArtifactResult,
  GovernanceRemediationArtifactInput,
} from './governance-remediation-artifact';
import { writeGovernanceRemediationArtifact } from './governance-remediation-artifact';
import type {
  GovernanceProviderAdapter,
  GovernanceProviderAdapterInput,
} from './governance-provider-adapter';
import { resolveModelHintsViaGovernanceProvider } from './governance-provider-adapter';
import type { ModelGovernanceHintCandidate } from './model-governance-hints-schema';
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

export type GovernanceHostKind = 'cursor' | 'claude' | 'codex' | 'generic';
export type GovernanceExecutionMode =
  | 'cursor-mcp-task'
  | 'claude-agent-tool'
  | 'codex-spawn-agent'
  | 'generic-prompt-packet';

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

export interface GovernanceAttemptHistoryEntry {
  attemptNumber: number;
  attemptId: string;
  outputPath: string;
  outcome: string;
  createdAt: string;
  sourceGateFailureIds: string[];
  rerunGateResult?: GovernanceRerunGateResult;
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
  createdAt: string;
  updatedAt: string;
  attempts: GovernanceAttemptHistoryEntry[];
}

export interface GovernanceExecutorPacket {
  hostKind: GovernanceHostKind;
  executionMode: GovernanceExecutionMode;
  prompt: string;
  guardrails: string[];
  successCriteria: string[];
  stopConditions: string[];
}

export interface RunGovernanceRemediationInput
  extends Omit<GovernanceRemediationArtifactInput, 'modelHintsCandidate'> {
  hostKind: GovernanceHostKind;
  providerAdapter?: GovernanceProviderAdapter;
  maxAttempts?: number;
  maxNoProgressRepeats?: number;
  loopStateId?: string;
  rerunGateResult?: GovernanceRerunGateResult;
}

export interface RunGovernanceRemediationResult {
  artifactPath: string | null;
  artifactResult: GovernanceRemediationArtifactResult | null;
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

function nowIso(): string {
  return new Date().toISOString();
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
  return {
    version: 1,
    loopStateId,
    rerunGate: input.rerunGate,
    capabilitySlot: input.capabilitySlot,
    canonicalAgent: input.canonicalAgent,
    targetArtifacts: input.targetArtifacts,
    maxAttempts: input.maxAttempts ?? 3,
    maxNoProgressRepeats: input.maxNoProgressRepeats ?? 1,
    attemptCount: 0,
    noProgressRepeatCount: 0,
    status: 'idle',
    lastGateResult: null,
    lastStopReason: null,
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

function buildPacketPrompt(input: {
  runtimeContext: RuntimeContextFile | null;
  runtimePolicy: RuntimePolicy | null;
  loopState: GovernanceAttemptLoopState;
  currentAttemptNumber: number;
  rerunGate: string;
  artifactMarkdown: string;
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
    '',
    '## Stop Conditions',
    '- Stop if the rerun gate passes.',
    '- Stop if governance-owned fields would need to change.',
    '- Stop if max attempts is reached or no-progress repeats exceed the policy limit.',
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
}): GovernanceExecutorPacket {
  return {
    hostKind: input.hostKind,
    executionMode: toExecutionMode(input.hostKind),
    prompt: buildPacketPrompt(input),
    guardrails: [
      'Do not change blocker ownership.',
      'Do not change failed-check severity.',
      'Do not change artifact-derived root target.',
      'Do not continue downstream while the blocker gate remains open.',
    ],
    successCriteria: [
      'Apply the minimal remediation needed to close the named blockers.',
      'Update only the target artifacts required by the remediation artifact.',
      `Leave the work ready for rerun of ${input.rerunGate}.`,
    ],
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
}): RunGovernanceRemediationResult {
  return {
    artifactPath: null,
    artifactResult: null,
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
  const modelHintsCandidate = await resolveModelHintsCandidate(input);

  let loopState =
    tryReadGovernanceAttemptLoopState(input.projectRoot, loopStateId) ??
    defaultGovernanceAttemptLoopState(input, loopStateId);
  loopState.maxAttempts = input.maxAttempts ?? loopState.maxAttempts;
  loopState.maxNoProgressRepeats = input.maxNoProgressRepeats ?? loopState.maxNoProgressRepeats;

  let rerunGateResultIngested = false;
  if (input.rerunGateResult) {
    loopState = ingestRerunGateResult(loopState, input.rerunGateResult);
    rerunGateResultIngested = true;

    if (input.rerunGateResult.status === 'pass') {
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
      });
    }

    if (loopState.attemptCount >= loopState.maxAttempts) {
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
      });
    }

    if (loopState.noProgressRepeatCount >= loopState.maxNoProgressRepeats) {
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
      });
    }
  }

  const currentAttemptNumber = loopState.attemptCount + 1;
  const absoluteOutputPath = resolveAbsolutePath(input.projectRoot, input.outputPath);
  const sharedArtifactsUpdated = unique([
    ...(input.sharedArtifactsUpdated ?? []),
    ...(input.rerunGateResult?.updatedArtifacts ?? []),
  ]);

  const artifactResult = writeGovernanceRemediationArtifact({
    ...input,
    outputPath: absoluteOutputPath,
    modelHintsCandidate,
    sharedArtifactsUpdated,
    contradictionsDelta:
      input.contradictionsDelta ?? input.rerunGateResult?.contradictionsDelta,
    externalProofAdded:
      input.externalProofAdded ?? input.rerunGateResult?.externalProofAdded,
    readyToRerunGate: input.readyToRerunGate ?? false,
    stopReason: input.stopReason,
  });

  loopState.attemptCount = currentAttemptNumber;
  loopState.status = 'awaiting_rerun';
  loopState.lastStopReason = null;
  loopState.updatedAt = nowIso();
  loopState.attempts.push({
    attemptNumber: currentAttemptNumber,
    attemptId: input.attemptId,
    outputPath: absoluteOutputPath,
    outcome: input.outcome,
    createdAt: loopState.updatedAt,
    sourceGateFailureIds: input.sourceGateFailureIds,
  });
  writeGovernanceAttemptLoopState(input.projectRoot, loopState);

  const executorPacket = buildExecutorPacket({
    hostKind: input.hostKind,
    runtimeContext,
    runtimePolicy,
    loopState,
    currentAttemptNumber,
    rerunGate: input.rerunGate,
    artifactMarkdown: artifactResult.markdown,
  });

  return {
    artifactPath: absoluteOutputPath,
    artifactResult,
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

async function main(): Promise<void> {
  if (require.main !== module) {
    return;
  }

  const args = process.argv.slice(2);
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
    });
    packetPaths[hostKind] = writeGovernanceExecutorPacket(result.artifactPath, packet);
  }

  result.packetPaths = packetPaths;
}

void main();
