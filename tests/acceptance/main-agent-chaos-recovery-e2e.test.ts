import { runChaosScenarios } from '../../scripts/main-agent-chaos-scenarios';
import { describe, expect, it } from 'vitest';

describe('main-agent chaos recovery e2e', () => {
  it('recovers all required control-plane chaos scenarios to continue-ready', () => {
    const report = runChaosScenarios();

    expect(report.reportType).toBe('main_agent_chaos_recovery');
    expect(report.recoveryRate).toBe(1);
    expect(report.scenarios.map((scenario) => scenario.id)).toEqual([
      'pending_packet_loss',
      'closeout_failure',
      'rerun_gate_pending',
      'session_recovery',
      'host_switching',
    ]);
    expect(report.scenarios.every((scenario) => scenario.recovered)).toBe(true);
    expect(report.scenarios.every((scenario) => scenario.finalState.nextAction === 'continue_ready')).toBe(
      true
    );
  });
});
