import { describe, expect, it } from 'vitest';
import {
  applyLongRunPolicyToState,
  LONG_RUN_RUNTIME_POLICY,
  validateLongRunPolicy,
} from '../../scripts/long-run-runtime-policy';
import { createDefaultOrchestrationState } from '../../scripts/orchestration-state';

describe('runtime long-run policy contract', () => {
  it('fails closed on missing fields and writes replayable long-run state', () => {
    expect(validateLongRunPolicy(LONG_RUN_RUNTIME_POLICY)).toEqual([]);
    expect(validateLongRunPolicy({ ...LONG_RUN_RUNTIME_POLICY, lease_ttl_ms: undefined })).toContain(
      'lease_ttl_ms'
    );

    const state = createDefaultOrchestrationState({
      sessionId: 'long-run-session',
      host: 'cursor',
      flow: 'story',
      currentPhase: 'implement',
      nextAction: 'dispatch_implement',
      pendingPacket: {
        packetId: 'packet-1',
        packetPath: '_bmad-output/runtime/governance/packets/packet-1.json',
        packetKind: 'execution',
        status: 'ready_for_main_agent',
        createdAt: '2026-04-27T00:00:00.000Z',
      },
    });
    const first = applyLongRunPolicyToState(state, {
      nowIso: '2026-04-27T00:00:00.000Z',
      activeHostMode: 'cursor',
    });
    const resumed = applyLongRunPolicyToState(
      {
        ...first,
        originalExecutionPacketId: 'packet-original',
      },
      {
        nowIso: '2026-04-27T00:01:00.000Z',
        activeHostMode: 'cursor',
        resumedFromCheckpoint: true,
      }
    );

    expect(resumed.longRun?.policyVersion).toBe(LONG_RUN_RUNTIME_POLICY.version);
    expect(resumed.longRun?.loop_seq).toBe(2);
    expect(resumed.longRun?.resume_count).toBe(1);
    expect(resumed.longRun?.resumed_from_checkpoint).toBe(true);
    expect(resumed.originalExecutionPacketId).toBe('packet-original');
    expect(resumed.gatesLoop).toEqual(first.gatesLoop);
    expect(resumed.pendingPacket?.lease_owner).toBe('cursor');
    expect(resumed.pendingPacket?.heartbeat_seq).toBe(2);
    expect(resumed.pendingPacket?.retry_count).toBe(0);
    expect(resumed.pendingPacket?.stale_recovered_count).toBe(0);
  });
});
