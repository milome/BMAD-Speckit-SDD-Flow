import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  OrchestrationFlow,
  PacketKind,
  TaskReport,
} from './orchestration-dispatch-contract';

export type OrchestrationHost = 'cursor' | 'claude' | 'codex';
export type OrchestrationPhase =
  | 'create'
  | 'audit'
  | 'specify'
  | 'plan'
  | 'gaps'
  | 'tasks'
  | 'implement'
  | 'post_audit'
  | 'closeout';
export type OrchestrationNextAction =
  | 'dispatch_implement'
  | 'dispatch_review'
  | 'dispatch_remediation'
  | 'rerun_gate'
  | 'run_closeout'
  | 'await_user'
  | 'blocked';

export interface PendingPacketPointer {
  packetId: string;
  packetPath: string;
  packetKind: PacketKind;
  status:
    | 'ready_for_main_agent'
    | 'claimed_by_main_agent'
    | 'dispatched'
    | 'completed'
    | 'invalidated';
  createdAt: string;
  claimOwner?: string | null;
  lease_owner?: string | null;
  lease_expires_ts?: string | null;
  last_heartbeat_ts?: string | null;
  heartbeat_seq?: number;
  retry_count?: number;
  stale_recovered_count?: number;
}

export interface OrchestrationState {
  version: 1;
  sessionId: string;
  host: OrchestrationHost;
  flow: OrchestrationFlow;
  currentPhase: OrchestrationPhase;
  nextAction: OrchestrationNextAction;
  pendingPacket?: PendingPacketPointer | null;
  originalExecutionPacketId?: string | null;
  fourSignal?: {
    latestStatus: 'pass' | 'warn' | 'block';
    latestHits: string[];
    driftDetected: boolean;
    missingEvidence: boolean;
  };
  latestGate?: {
    gateId: string;
    decision: 'pass' | 'auto_repairable_block' | 'true_blocker' | 'reroute';
    reason: string;
  };
  longRun?: {
    policyVersion: string;
    policyHash: string;
    loop_seq: number;
    running_for_ms: number;
    last_tick_ts: string;
    last_progress_ts: string;
    degradation_level:
      | 'none'
      | 'hook_lost'
      | 'transport_degraded'
      | 'host_partial'
      | 'cli_forced';
    active_host_mode: string;
    resume_count: number;
    resumed_from_checkpoint?: boolean;
  };
  hostRecovery?: {
    degradation_level:
      | 'none'
      | 'hook_lost'
      | 'transport_degraded'
      | 'host_partial'
      | 'cli_forced';
    active_host_mode: string;
    orchestration_entry: string;
    recovered_host_mode?: string | null;
    recovered_orchestration_entry?: string | null;
    recovery_log_path?: string | null;
    updated_at: string;
  };
  gatesLoop?: {
    retryCount: number;
    maxRetries: number;
    noProgressCount: number;
    circuitOpen: boolean;
    rerunGate?: string | null;
    activePacketId?: string | null;
    lastResult?: string | null;
  };
  closeout?: {
    invoked: boolean;
    approved: boolean;
    scoreWriteResult?: string | null;
    handoffPersisted?: boolean;
    resultCode?: string | null;
  };
  lastTaskReport?: {
    packetId: string;
    status: TaskReport['status'];
    filesChanged: string[];
    validationsRun: string[];
    evidence: string[];
    driftFlags?: string[];
  } | null;
}

export interface CreateOrchestrationStateInput {
  sessionId: string;
  host: OrchestrationHost;
  flow: OrchestrationFlow;
  currentPhase: OrchestrationPhase;
  nextAction: OrchestrationNextAction;
  pendingPacket?: PendingPacketPointer | null;
}

export function orchestrationStateDir(projectRoot: string): string {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'orchestration-state');
}

export function orchestrationStatePath(projectRoot: string, sessionId: string): string {
  return path.join(orchestrationStateDir(projectRoot), `${sessionId}.json`);
}

export function createDefaultOrchestrationState(
  input: CreateOrchestrationStateInput
): OrchestrationState {
  return {
    version: 1,
    sessionId: input.sessionId,
    host: input.host,
    flow: input.flow,
    currentPhase: input.currentPhase,
    nextAction: input.nextAction,
    pendingPacket: input.pendingPacket ?? null,
    originalExecutionPacketId: null,
    gatesLoop: {
      retryCount: 0,
      maxRetries: 3,
      noProgressCount: 0,
      circuitOpen: false,
      rerunGate: null,
      activePacketId: null,
      lastResult: null,
    },
    closeout: {
      invoked: false,
      approved: false,
      scoreWriteResult: null,
      handoffPersisted: false,
      resultCode: null,
    },
    lastTaskReport: null,
  };
}

export function readOrchestrationState(
  projectRoot: string,
  sessionId: string
): OrchestrationState | null {
  const file = orchestrationStatePath(projectRoot, sessionId);
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as OrchestrationState;
  } catch {
    return null;
  }
}

export function writeOrchestrationState(projectRoot: string, state: OrchestrationState): void {
  const file = orchestrationStatePath(projectRoot, state.sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(tempFile, file);
}

export function updateOrchestrationState(
  projectRoot: string,
  sessionId: string,
  updater: (current: OrchestrationState) => OrchestrationState
): OrchestrationState {
  const current = readOrchestrationState(projectRoot, sessionId);
  if (!current) {
    throw new Error(`Orchestration state not found for session: ${sessionId}`);
  }
  const next = updater(current);
  writeOrchestrationState(projectRoot, next);
  return next;
}

export function claimPendingPacket(
  projectRoot: string,
  sessionId: string,
  owner: string
): OrchestrationState {
  return updateOrchestrationState(projectRoot, sessionId, (current) => ({
    ...current,
    pendingPacket: current.pendingPacket
      ? {
          ...current.pendingPacket,
          status: 'claimed_by_main_agent',
          claimOwner: owner,
        }
      : null,
  }));
}

export function completePendingPacket(
  projectRoot: string,
  sessionId: string,
  packetId: string
): OrchestrationState {
  return updateOrchestrationState(projectRoot, sessionId, (current) => ({
    ...current,
    pendingPacket:
      current.pendingPacket && current.pendingPacket.packetId === packetId
        ? {
            ...current.pendingPacket,
            status: 'completed',
          }
        : current.pendingPacket ?? null,
  }));
}

export function markPendingPacketDispatched(
  projectRoot: string,
  sessionId: string,
  packetId: string
): OrchestrationState {
  return updateOrchestrationState(projectRoot, sessionId, (current) => ({
    ...current,
    pendingPacket:
      current.pendingPacket && current.pendingPacket.packetId === packetId
        ? {
            ...current.pendingPacket,
            status: 'dispatched',
          }
        : current.pendingPacket ?? null,
  }));
}

export function recordGatesLoopRetry(
  projectRoot: string,
  sessionId: string,
  input: {
    rerunGate?: string | null;
    activePacketId?: string | null;
    lastResult?: string | null;
  } = {}
): OrchestrationState {
  return updateOrchestrationState(projectRoot, sessionId, (current) => ({
    ...current,
    gatesLoop: {
      retryCount: (current.gatesLoop?.retryCount ?? 0) + 1,
      maxRetries: current.gatesLoop?.maxRetries ?? 3,
      noProgressCount: current.gatesLoop?.noProgressCount ?? 0,
      circuitOpen: current.gatesLoop?.circuitOpen ?? false,
      rerunGate: input.rerunGate ?? current.gatesLoop?.rerunGate ?? null,
      activePacketId: input.activePacketId ?? current.gatesLoop?.activePacketId ?? null,
      lastResult: input.lastResult ?? current.gatesLoop?.lastResult ?? null,
    },
  }));
}

export function recordGatesLoopNoProgress(
  projectRoot: string,
  sessionId: string,
  input: {
    lastResult?: string | null;
    maxNoProgressCount?: number;
  } = {}
): OrchestrationState {
  return updateOrchestrationState(projectRoot, sessionId, (current) => {
    const nextNoProgress = (current.gatesLoop?.noProgressCount ?? 0) + 1;
    const maxNoProgressCount = input.maxNoProgressCount ?? 2;
    return {
      ...current,
      gatesLoop: {
        retryCount: current.gatesLoop?.retryCount ?? 0,
        maxRetries: current.gatesLoop?.maxRetries ?? 3,
        noProgressCount: nextNoProgress,
        circuitOpen:
          (current.gatesLoop?.circuitOpen ?? false) || nextNoProgress >= maxNoProgressCount,
        rerunGate: current.gatesLoop?.rerunGate ?? null,
        activePacketId: current.gatesLoop?.activePacketId ?? null,
        lastResult: input.lastResult ?? current.gatesLoop?.lastResult ?? null,
      },
    };
  });
}

export function resetGatesLoopProgress(
  projectRoot: string,
  sessionId: string,
  input: {
    lastResult?: string | null;
  } = {}
): OrchestrationState {
  return updateOrchestrationState(projectRoot, sessionId, (current) => ({
    ...current,
    gatesLoop: {
      retryCount: current.gatesLoop?.retryCount ?? 0,
      maxRetries: current.gatesLoop?.maxRetries ?? 3,
      noProgressCount: 0,
      circuitOpen: false,
      rerunGate: current.gatesLoop?.rerunGate ?? null,
      activePacketId: current.gatesLoop?.activePacketId ?? null,
      lastResult: input.lastResult ?? current.gatesLoop?.lastResult ?? null,
    },
  }));
}

export function invalidatePendingPacket(
  projectRoot: string,
  sessionId: string,
  packetId: string
): OrchestrationState {
  return updateOrchestrationState(projectRoot, sessionId, (current) => ({
    ...current,
    pendingPacket:
      current.pendingPacket && current.pendingPacket.packetId === packetId
        ? {
            ...current.pendingPacket,
            status: 'invalidated',
          }
        : current.pendingPacket ?? null,
  }));
}
