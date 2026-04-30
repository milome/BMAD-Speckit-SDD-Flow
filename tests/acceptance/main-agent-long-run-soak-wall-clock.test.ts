import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { evaluateSoakReport, runWallClockSoak } from '../../scripts/main-agent-soak-runner';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

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

function rmEventually(target: string): void {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
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

  it('records real main-agent run-loop invocations for development soak evidence', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wall-clock-development-soak-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: 'S-development-soak',
          runId: 'development-soak-test',
        })
      );

      const tickScript = path.join(root, 'tick.js');
      fs.writeFileSync(
        tickScript,
        [
          "const fs = require('node:fs');",
          "const path = require('node:path');",
          "const tickDir = process.env.BMAD_REAL_DEV_TICK_DIR;",
          "const tick = Number(process.env.BMAD_REAL_DEV_TICK || '0');",
          "const report = { packetId: `packet-${tick}`, status: 'done', filesChanged: ['src/example.js'], validationsRun: ['tick-test'], evidence: [`real-tick-${tick}`], downstreamContext: [] };",
          "const record = { packetId: report.packetId, taskReport: report, runLoopIngest: { exitCode: 0 }, evidence: { taskReportPath: path.join(tickDir, 'task-report.json'), runLoopIngestPath: path.join(tickDir, 'ingest.json') } };",
          "fs.mkdirSync(tickDir, { recursive: true });",
          "fs.writeFileSync(path.join(tickDir, 'task-report.json'), JSON.stringify(report));",
          "fs.writeFileSync(path.join(tickDir, 'tick-record.json'), JSON.stringify(record));",
        ].join('\n'),
        'utf8'
      );
      const report = await runWallClockSoak({
        durationMs: 30,
        tickIntervalMs: 5,
        projectRoot: root,
        developmentRunLoop: true,
        flow: 'story',
        stage: 'implement',
        tickCommand: `"${process.execPath}" "${tickScript}"`,
      });

      expect(report.run_kind).toBe('development_run_loop');
      expect(report.developmentRun?.tick_count).toBe(report.tick_count);
      expect(report.developmentRun?.completed_ticks).toBeGreaterThan(0);
      expect(report.developmentRun?.runLoopInvocations[0].packetId).toBeTruthy();
      expect(report.developmentRun?.runLoopInvocations[0].evidence).toContain('real-tick-1');
      expect(report.developmentRun?.runLoopInvocations[0].tickCommand?.exitCode).toBe(0);
      expect(report.developmentRun?.runLoopInvocations[0].tickCommand?.diffHashBefore).toBeTruthy();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
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
          '--developmentRunLoop',
          '--hostKind',
          'codex',
          '--tickCommand',
          `${process.execPath} -e "console.log('background real tick validation')"`,
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
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as {
        developmentRunLoop: boolean;
        hostKind: string;
      };
      expect(metadata.developmentRunLoop).toBe(true);
      expect(metadata.hostKind).toBe('codex');
      expect(metadata).toMatchObject({
        tickCommand: `${process.execPath} -e "console.log('background real tick validation')"`,
      });
      await waitForFile(reportPath, 5_000);
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        mode: string;
        target_duration_ms: number;
        observed_duration_ms: number;
        run_kind: string;
        developmentRun?: { hostKind: string };
      };
      expect(report.mode).toBe('wall_clock');
      expect(report.run_kind).toBe('development_run_loop');
      expect(report.developmentRun?.hostKind).toBe('codex');
      expect(report.observed_duration_ms).toBeGreaterThanOrEqual(report.target_duration_ms);
    } finally {
      rmEventually(root);
    }
  });
});
