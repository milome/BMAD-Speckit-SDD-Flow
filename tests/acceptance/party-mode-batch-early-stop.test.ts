import { describe, expect, it } from 'vitest';
import { evaluateCheckpointWindowInput } from '../../scripts/party-mode-runtime';

describe('party-mode batch early stop', () => {
  it('maps S to stop-and-output-current-conclusion inside the checkpoint window', () => {
    const decision = evaluateCheckpointWindowInput('S', true);

    expect(decision.accepted).toBe(true);
    expect(decision.resolution).toBe('stop_and_output_current_conclusion');
    expect(decision.closes_window).toBe(true);
    expect(decision.cancels_window_timer).toBe(true);
    expect(decision.stop_auto_continue).toBe(true);
  });

  it('maps F to finalize-current-deliverable inside the checkpoint window', () => {
    const decision = evaluateCheckpointWindowInput('F', true);

    expect(decision.accepted).toBe(true);
    expect(decision.resolution).toBe('finalize_current_deliverable');
    expect(decision.closes_window).toBe(true);
    expect(decision.cancels_window_timer).toBe(true);
    expect(decision.stop_auto_continue).toBe(true);
  });
});
