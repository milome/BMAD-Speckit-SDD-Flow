import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateSoakReport,
  runWallClockSoak,
} from '../../scripts/main-agent-soak-runner';

describe('main-agent long-run wall-clock soak', () => {
  it('records real elapsed ticks heartbeats and recovery timeline', async () => {
    const report = await runWallClockSoak({
      durationMs: 30,
      tickIntervalMs: 5,
      injectRecoverableFault: true,
    });
    expect(report.mode).toBe('wall_clock');
    expect(report.observed_duration_ms).toBeGreaterThanOrEqual(30);
    expect(report.tick_count).toBeGreaterThan(0);
    expect(report.heartbeats).toHaveLength(report.tick_count);
    expect(report.recoveries[0].fault_detected_at).toBeTruthy();
    expect(evaluateSoakReport(report).passed).toBe(true);
  });

  it('can persist the wall-clock report artifact shape', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wall-clock-soak-report-'));
    try {
      const reportPath = path.join(root, 'soak-report.json');
      const report = await runWallClockSoak({
        durationMs: 10,
        tickIntervalMs: 5,
      });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
      const parsed = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as typeof report;
      expect(parsed.mode).toBe('wall_clock');
      expect(parsed.target_duration_ms).toBe(10);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
