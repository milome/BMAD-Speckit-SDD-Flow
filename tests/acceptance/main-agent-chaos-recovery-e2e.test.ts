import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runChaosScenarios } from '../../scripts/main-agent-chaos-scenarios';
import { describe, expect, it } from 'vitest';

describe('main-agent chaos recovery e2e', () => {
  it('recovers all required control-plane chaos scenarios to continue-ready', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-chaos-test-'));
    const report = runChaosScenarios({ projectRoot });
    const recoveredPacketPath = path.join(
      projectRoot,
      '_bmad-output',
      'runtime',
      'chaos',
      'packet-loss.json'
    );
    const recoveredPacket = JSON.parse(fs.readFileSync(recoveredPacketPath, 'utf8')) as {
      packetId: string;
      recovered: boolean;
    };

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
    expect(recoveredPacket).toEqual({ packetId: 'chaos-packet', recovered: true });
    expect(
      report.scenarios
        .find((scenario) => scenario.id === 'pending_packet_loss')
        ?.evidence.some((entry) => entry.startsWith('recreated packet artifact:'))
    ).toBe(true);
  });
});
