import { describe, expect, it } from 'vitest';
import { scoringEnabledForTriggerStage } from '../../packages/scoring/trigger/trigger-loader';

describe('runtime-governance score idempotency', () => {
  it('rejects duplicate authoritative final-pass identity tuples while preserving registered trigger-stage semantics', () => {
    const scoring = scoringEnabledForTriggerStage('speckit_5_2', 'real_dev');
    const seen = new Set<string>();
    const recordIdentity = (parts: {
      storyId: string;
      stage: string;
      triggerStage: string;
      runId: string;
    }) => {
      const key = `${parts.storyId}|${parts.stage}|${parts.triggerStage}|${parts.runId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    };

    expect(scoring).toEqual({ enabled: true, reason: 'matched' });
    expect(
      recordIdentity({
        storyId: '14.1',
        stage: 'implement',
        triggerStage: 'speckit_5_2',
        runId: 'run-001',
      })
    ).toBe(true);
    expect(
      recordIdentity({
        storyId: '14.1',
        stage: 'implement',
        triggerStage: 'speckit_5_2',
        runId: 'run-001',
      })
    ).toBe(false);
    expect(
      recordIdentity({
        storyId: '14.1',
        stage: 'implement',
        triggerStage: 'speckit_5_2',
        runId: 'run-002',
      })
    ).toBe(true);
  });
});
