import { describe, expect, it } from 'vitest';
import {
  buildDeterministicSoakReport,
  evaluateSoakReport,
} from '../../scripts/main-agent-soak-runner';

describe('main-agent soak 8h contract', () => {
  it('requires 8h evidence, replayable recovery timelines, and >=95% recovery success', () => {
    const report = buildDeterministicSoakReport({
      targetDurationMs: 8 * 60 * 60 * 1000,
      recoveredFaults: 20,
    });
    expect(evaluateSoakReport(report)).toEqual({ passed: true, reasons: [] });

    const shortRun = { ...report, observed_duration_ms: report.target_duration_ms - 1 };
    expect(evaluateSoakReport(shortRun).passed).toBe(false);

    const weakRecovery = buildDeterministicSoakReport({
      targetDurationMs: 8 * 60 * 60 * 1000,
      recoveredFaults: 18,
      failedRecoveries: 2,
    });
    expect(evaluateSoakReport(weakRecovery).reasons).toContain(
      'recovery success rate below 95%'
    );
  });
});
