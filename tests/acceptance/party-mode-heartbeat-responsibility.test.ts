import { describe, expect, it } from 'vitest';
import { createFacilitatorHeartbeat } from '../../scripts/party-mode-runtime';

describe('party-mode heartbeat responsibility', () => {
  it('assigns heartbeat to the facilitator and keeps it out of agent_turn accounting', () => {
    const heartbeat = createFacilitatorHeartbeat({
      currentRoundInBatch: 12,
      batchSize: 20,
      elapsedMs: 92_000,
    });

    expect(heartbeat.authority).toBe('facilitator');
    expect(heartbeat.record_type).toBe('heartbeat');
    expect(heartbeat.counts_toward_ratio).toBe(false);
    expect(heartbeat.message).toContain('当前批次 12/20');
    expect(heartbeat.message).toContain('已运行 1m32s');
  });
});
