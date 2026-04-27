import { createHash } from 'node:crypto';
import type { OrchestrationState, PendingPacketPointer } from './orchestration-state';

export interface LongRunPolicy {
  version: string;
  tick_interval_ms: number;
  progress_probe_every_n_ticks: number;
  max_no_progress_ticks: number;
  lease_ttl_ms: number;
  heartbeat_interval_ms: number;
  heartbeat_timeout_ms: number;
  max_retries_by_error_class: Record<string, number>;
  cooldown_ms_by_error_class: Record<string, number>;
  degradation_policy: {
    no_progress: 'soft_degrade_then_resume';
    lease_expired: 'recover_stale_packet';
    unrecoverable: 'hard_block';
  };
  resume_policy: {
    preserve_loop_seq: true;
    preserve_retry_count: true;
    preserve_original_execution_packet_id: true;
    preserve_gates_loop: true;
    increment_resume_count: true;
    mark_resumed_from_checkpoint: true;
  };
  checkpoint_every_n_ticks: number;
  compaction_threshold_tokens: number;
}

export const LONG_RUN_RUNTIME_POLICY: LongRunPolicy = {
  version: 'long-run-runtime-policy/v1',
  tick_interval_ms: 30_000,
  progress_probe_every_n_ticks: 4,
  max_no_progress_ticks: 8,
  lease_ttl_ms: 180_000,
  heartbeat_interval_ms: 30_000,
  heartbeat_timeout_ms: 120_000,
  max_retries_by_error_class: {
    transient_io: 5,
    gate_pending: 12,
    host_switch: 3,
    unrecoverable_contract: 0,
  },
  cooldown_ms_by_error_class: {
    transient_io: 5_000,
    gate_pending: 30_000,
    host_switch: 15_000,
    unrecoverable_contract: 0,
  },
  degradation_policy: {
    no_progress: 'soft_degrade_then_resume',
    lease_expired: 'recover_stale_packet',
    unrecoverable: 'hard_block',
  },
  resume_policy: {
    preserve_loop_seq: true,
    preserve_retry_count: true,
    preserve_original_execution_packet_id: true,
    preserve_gates_loop: true,
    increment_resume_count: true,
    mark_resumed_from_checkpoint: true,
  },
  checkpoint_every_n_ticks: 10,
  compaction_threshold_tokens: 120_000,
};

const REQUIRED_KEYS: Array<keyof LongRunPolicy> = [
  'tick_interval_ms',
  'progress_probe_every_n_ticks',
  'max_no_progress_ticks',
  'lease_ttl_ms',
  'heartbeat_interval_ms',
  'heartbeat_timeout_ms',
  'max_retries_by_error_class',
  'cooldown_ms_by_error_class',
  'degradation_policy',
  'resume_policy',
  'checkpoint_every_n_ticks',
  'compaction_threshold_tokens',
];

export function hashLongRunPolicy(policy: LongRunPolicy = LONG_RUN_RUNTIME_POLICY): string {
  return createHash('sha256').update(JSON.stringify(policy)).digest('hex');
}

export function validateLongRunPolicy(policy: Partial<LongRunPolicy>): string[] {
  const missing = REQUIRED_KEYS.filter((key) => policy[key] == null).map(String);
  const numericFailures = REQUIRED_KEYS.filter((key) => key.endsWith('_ms') || key.endsWith('_ticks'))
    .filter((key) => typeof policy[key] === 'number' && Number(policy[key]) <= 0)
    .map(String);
  return [...missing, ...numericFailures];
}

export function attachLeaseToPendingPacket(
  packet: PendingPacketPointer,
  input: {
    owner: string;
    nowIso: string;
    policy?: LongRunPolicy;
  }
): PendingPacketPointer {
  const policy = input.policy ?? LONG_RUN_RUNTIME_POLICY;
  const leaseExpires = new Date(Date.parse(input.nowIso) + policy.lease_ttl_ms).toISOString();
  return {
    ...packet,
    lease_owner: input.owner,
    lease_expires_ts: leaseExpires,
    last_heartbeat_ts: input.nowIso,
    heartbeat_seq: (packet.heartbeat_seq ?? 0) + 1,
    retry_count: packet.retry_count ?? 0,
    stale_recovered_count: packet.stale_recovered_count ?? 0,
  };
}

export function applyLongRunPolicyToState(
  state: OrchestrationState,
  input: {
    nowIso: string;
    activeHostMode: string;
    resumedFromCheckpoint?: boolean;
    policy?: LongRunPolicy;
  }
): OrchestrationState {
  const policy = input.policy ?? LONG_RUN_RUNTIME_POLICY;
  const previous = state.longRun;
  const pendingPacket = state.pendingPacket
    ? attachLeaseToPendingPacket(state.pendingPacket, {
        owner: input.activeHostMode,
        nowIso: input.nowIso,
        policy,
      })
    : state.pendingPacket;

  return {
    ...state,
    pendingPacket,
    longRun: {
      policyVersion: policy.version,
      policyHash: hashLongRunPolicy(policy),
      loop_seq: (previous?.loop_seq ?? 0) + 1,
      running_for_ms: previous
        ? Math.max(0, Date.parse(input.nowIso) - Date.parse(previous.last_tick_ts)) +
          previous.running_for_ms
        : 0,
      last_tick_ts: input.nowIso,
      last_progress_ts: previous?.last_progress_ts ?? input.nowIso,
      degradation_level: previous?.degradation_level ?? 'none',
      active_host_mode: input.activeHostMode,
      resume_count:
        (previous?.resume_count ?? 0) + (input.resumedFromCheckpoint ? 1 : 0),
      resumed_from_checkpoint: input.resumedFromCheckpoint === true,
    },
  };
}

export function main(argv: string[]): number {
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(LONG_RUN_RUNTIME_POLICY, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        policyVersion: LONG_RUN_RUNTIME_POLICY.version,
        policyHash: hashLongRunPolicy(),
        requiredKeys: REQUIRED_KEYS,
      },
      null,
      2
    )}\n`
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
