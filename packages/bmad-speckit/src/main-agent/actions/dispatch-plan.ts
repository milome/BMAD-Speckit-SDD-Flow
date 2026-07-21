import { buildMainAgentDispatchInstruction } from '../source-authority/scripts/main-agent-orchestration';
import type {
  OrchestrationFlow,
  OrchestrationHost,
} from '../source-authority/scripts/orchestration-dispatch-contract';
import { resolveVerifiedSixModelStatus } from '../source-authority/scripts/verified-six-model-status-facade';
import type { MainAgentActionContext } from './source-authority-main-action';

type JsonRecord = Record<string, unknown>;

interface MainAgentRuntimeState {
  active?: unknown;
  activeRecord?: unknown;
  [key: string]: unknown;
}

function object(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function blockedDispatch(blockerRefs: unknown) {
  const blockers = Array.isArray(blockerRefs) && blockerRefs.length > 0
    ? blockerRefs.map(String)
    : ['implementation_readiness_not_verified_pass'];
  return {
    status: 'dispatch_blocked',
    exitCode: 1,
    dispatchInstruction: null,
    errors: blockers.map((code) => ({ code, message: code })),
  };
}

function normalizeFlow(value: unknown): OrchestrationFlow | null {
  const normalized = String(value || '').trim();
  return normalized === 'story' ||
    normalized === 'bugfix' ||
    normalized === 'standalone_tasks'
    ? normalized
    : null;
}

function normalizeHost(value: unknown): OrchestrationHost | undefined {
  const normalized = String(value || '').trim();
  if (normalized === 'claude' || normalized === 'claude-code') return 'claude';
  if (normalized === 'cursor' || normalized === 'cursor-ide' || normalized === 'cursor-cli') {
    return 'cursor';
  }
  return normalized === 'codex' ? 'codex' : undefined;
}

export function dispatchPlanAction(
  context: MainAgentActionContext,
  runtimeState: MainAgentRuntimeState
) {
  const active = object(runtimeState.active);
  const record =
    runtimeState.activeRecord &&
    typeof runtimeState.activeRecord === 'object' &&
    !Array.isArray(runtimeState.activeRecord)
      ? (runtimeState.activeRecord as JsonRecord)
      : null;
  if (!record) return blockedDispatch(['active_requirement_record_missing']);

  const currentAttemptId = String(
    record.currentAttemptId || record.implementationAttemptId || record.runId || ''
  ).trim();
  const readiness = resolveVerifiedSixModelStatus({
    record,
    modelId: 'implementation_readiness',
    currentImplementationAttemptId: currentAttemptId,
  });
  if (readiness.effectiveStatus !== 'pass') {
    return blockedDispatch(readiness.blockerRefs);
  }

  const requirementSetId =
    context.args.requirementSetId ||
    record.requirementSetId ||
    active.requirementSetId ||
    active.id ||
    null;
  const recordId = context.args.recordId || record.recordId || active.recordId || null;
  const flow = normalizeFlow(context.args.flow || record.flow || record.entryFlow || active.flow);
  const stage = String(
    context.args.stage || record.stage || record.currentStage || active.stage || ''
  ).trim();
  if (!requirementSetId || !recordId || !flow || !stage) {
    return blockedDispatch(['canonical_dispatch_authority_input_missing']);
  }

  let dispatchInstruction: ReturnType<typeof buildMainAgentDispatchInstruction>;
  try {
    dispatchInstruction = buildMainAgentDispatchInstruction({
      projectRoot: context.cwd,
      recordId: String(recordId),
      requirementSetId: String(requirementSetId),
      runId: String(context.args.runId || record.runId || currentAttemptId || '') || undefined,
      flow,
      stage,
      host: normalizeHost(context.args.host || active.host),
      hydratePacket: true,
      preferredPacketId: String(context.args.packetId || '').trim() || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...blockedDispatch(['canonical_dispatch_planning_failed']),
      errors: [{ code: 'canonical_dispatch_planning_failed', message }],
    };
  }
  if (!dispatchInstruction) {
    return blockedDispatch(['canonical_dispatch_instruction_unavailable']);
  }

  return {
    status: 'dispatch_ready',
    exitCode: 0,
    dispatchInstruction,
    readiness,
    runtimeState,
    errors: [],
  };
}
