import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { evaluateSoakReport, runWallClockSoak } from '../../scripts/main-agent-soak-runner';

function waitForFile(filePath: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (fs.existsSync(filePath)) {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error(`timed out waiting for ${filePath}`));
        return;
      }
      setTimeout(tick, 25);
    };
    tick();
  });
}

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

  it('writes the standard truth-gate soak report path from the CLI', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wall-clock-soak-standard-'));
    try {
      const run = spawnSync(
        process.execPath,
        [
          path.join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'),
          '--project',
          path.join(process.cwd(), 'tsconfig.node.json'),
          '--transpile-only',
          path.join(process.cwd(), 'scripts', 'main-agent-soak-runner.ts'),
          '--durationMs',
          '10',
          '--tickIntervalMs',
          '5',
        ],
        { cwd: root, encoding: 'utf8' }
      );
      expect(run.status).toBe(0);
      expect(
        fs.existsSync(
          path.join(root, '_bmad-output', 'runtime', 'soak', 'main-agent-soak-report.json')
        )
      ).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('can start a background wall-clock soak and persist metadata plus report', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wall-clock-soak-background-'));
    try {
      const run = spawnSync(
        process.execPath,
        [
          path.join(process.cwd(), 'node_modules', 'ts-node', 'dist', 'bin.js'),
          '--project',
          path.join(process.cwd(), 'tsconfig.node.json'),
          '--transpile-only',
          path.join(process.cwd(), 'scripts', 'main-agent-soak-runner.ts'),
          '--durationMs',
          '30',
          '--tickIntervalMs',
          '5',
          '--startBackground',
        ],
        { cwd: root, encoding: 'utf8' }
      );
      expect(run.status).toBe(0);
      const metadataPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'soak',
        'main-agent-soak-background.json'
      );
      const reportPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'soak',
        'main-agent-soak-report.json'
      );
      expect(fs.existsSync(metadataPath)).toBe(true);
      await waitForFile(reportPath, 5_000);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        mode: string;
        target_duration_ms: number;
        observed_duration_ms: number;
      };
      expect(report.mode).toBe('wall_clock');
      expect(report.observed_duration_ms).toBeGreaterThanOrEqual(report.target_duration_ms);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
