import { describe, expect, it } from 'vitest';
import { evaluateCheckpointWindowInput } from '../../scripts/party-mode-runtime';

describe('party-mode checkpoint window continue immediate', () => {
  it('maps C to immediate continue and skips the remaining checkpoint window', () => {
    const decision = evaluateCheckpointWindowInput('C', true);

    expect(decision.accepted).toBe(true);
    expect(decision.resolution).toBe('continue_immediately');
    expect(decision.closes_window).toBe(true);
    expect(decision.cancels_window_timer).toBe(true);
    expect(decision.skip_remaining_window_ms).toBe(true);
    expect(decision.stop_auto_continue).toBe(false);
  });
});
