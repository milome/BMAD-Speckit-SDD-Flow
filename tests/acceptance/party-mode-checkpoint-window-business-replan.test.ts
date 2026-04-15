import { describe, expect, it } from 'vitest';
import { evaluateCheckpointWindowInput } from '../../scripts/party-mode-runtime';

describe('party-mode checkpoint window business replan', () => {
  it('treats normal business text inside the checkpoint window as replan-before-next-batch', () => {
    const decision = evaluateCheckpointWindowInput('请把重点转到 deferred risks 和 fallback', true);

    expect(decision.accepted).toBe(true);
    expect(decision.resolution).toBe('replan_before_next_batch');
    expect(decision.closes_window).toBe(true);
    expect(decision.cancels_window_timer).toBe(true);
    expect(decision.stop_auto_continue).toBe(true);
    expect(decision.treat_as_business_context).toBe(true);
  });
});
