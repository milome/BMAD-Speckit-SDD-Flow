import { execSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PKG_ROOT = join(import.meta.dirname, '..', '..');

function run(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_loglevel: 'error',
    },
  });
}

function waitFor(predicate: () => boolean, timeoutMs = 30000, intervalMs = 200): void {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, intervalMs);
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

function removeDirWithRetry(target: string, attempts = 15, intervalMs = 300): void {
  for (let index = 0; index < attempts; index += 1) {
    try {
      rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (index === attempts - 1) {
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, intervalMs);
    }
  }
}

function findFirstExistingPath(candidates: string[]): string | null {
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

describe('consumer governance zero-scripts install', () => {
  it('keeps consumer root free of governance scripts and runs governance via hook-local entries', () => {
    const packDir = mkdtempSync(join(tmpdir(), 'gov-zero-scripts-root-pack-'));
    run(`npm pack --pack-destination "${packDir.replace(/\\/g, '/')}"`, PKG_ROOT);
    const tgzName = readdirSync(packDir).find(
      (f) => f.startsWith('bmad-speckit-sdd-flow-') && f.endsWith('.tgz')
    );
    expect(tgzName).toBeTruthy();

    const consumer = mkdtempSync(join(tmpdir(), 'gov-zero-scripts-consumer-'));
    try {
      writeFileSync(
        join(consumer, 'package.json'),
        JSON.stringify({ name: 'gov-zero-scripts-consumer', version: '1.0.0', private: true }),
        'utf8'
      );

      run(`npm install "${join(packDir, tgzName!).replace(/\\/g, '/')}"`, consumer);
      run('npm install js-yaml', consumer);
      run('npx bmad-speckit-init --agent cursor', consumer);

      expect(existsSync(join(consumer, 'scripts', 'governance-remediation-runner.ts'))).toBe(false);
      const rootInstallDir = join(consumer, 'node_modules', 'bmad-speckit-sdd-flow');
      expect(
        existsSync(
          join(rootInstallDir, '_bmad', 'runtime', 'hooks', 'governance-runtime-worker.cjs')
        )
      ).toBe(true);
      expect(
        existsSync(
          join(rootInstallDir, '_bmad', 'runtime', 'hooks', 'governance-remediation-runner.cjs')
        )
      ).toBe(true);

      run('npx bmad-speckit-init --agent claude-code', consumer);

      writeFileSync(
        join(consumer, '_bmad', '_config', 'governance-remediation.yaml'),
        [
          'version: 1',
          'primaryHost: claude',
          'packetHosts:',
          '  - claude',
          'provider:',
          '  mode: stub',
          '  id: accept-consumer-zero-scripts',
        ].join('\n'),
        'utf8'
      );

      expect(existsSync(join(consumer, '.claude', 'hooks', 'governance-runtime-worker.cjs'))).toBe(true);
      expect(existsSync(join(consumer, '.claude', 'hooks', 'governance-remediation-runner.cjs'))).toBe(true);
      expect(existsSync(join(consumer, '.claude', 'hooks', 'post-tool-use.cjs'))).toBe(true);
      expect(existsSync(join(consumer, '.claude', 'hooks', 'deferred-gap-governance.cjs'))).toBe(true);
      const runtimeEmitDist =
        findFirstExistingPath([
          join(
            rootInstallDir,
            'packages',
            'bmad-speckit',
            'node_modules',
            '@bmad-speckit',
            'runtime-emit',
            'dist'
          ),
          join(
            rootInstallDir,
            'node_modules',
            'bmad-speckit',
            'node_modules',
            '@bmad-speckit',
            'runtime-emit',
            'dist'
          ),
          join(rootInstallDir, 'node_modules', '@bmad-speckit', 'runtime-emit', 'dist'),
        ]) ?? '';
      expect(runtimeEmitDist).toBeTruthy();
      expect(existsSync(join(runtimeEmitDist, 'governance-runtime-worker.cjs'))).toBe(true);
      expect(existsSync(join(runtimeEmitDist, 'governance-remediation-runner.cjs'))).toBe(true);

      const readinessArtifact = join(
        consumer,
        '_bmad-output',
        'planning-artifacts',
        'dev',
        'implementation-readiness-report-2026-04-08.md'
      );
      mkdirSync(join(consumer, '_bmad-output', 'planning-artifacts', 'dev'), { recursive: true });
      writeFileSync(
        readinessArtifact,
        [
          '# Implementation Readiness Report',
          '',
          '## Blockers Requiring Immediate Action',
          '',
          '- IR-BLK-001: missing proof chain',
          '',
          '## Deferred Gaps',
          '',
          '- J04-Smoke-E2E: P0 Journey J04 缺少 Smoke E2E',
          '  - Reason: P2 优先级',
          '  - Resolution Target: Sprint 2+',
          '  - Owner: Dev Team',
          '',
          '## Deferred Gaps Tracking',
          '',
          '| Gap ID | 描述 | 原因 | 解决时机 | Owner | 状态检查点 |',
          '|--------|------|------|----------|-------|-----------|',
          '| J04-Smoke-E2E | P0 Journey J04 缺少 Smoke E2E | P2 优先级 | Sprint 2+ | Dev Team | Sprint Planning |',
          '',
          '## Four-Signal Governance Contract Status',
          '',
          'P0 Journey Coverage Matrix / Smoke E2E Preconditions Traceability / Cross-Document Traceability / Four-Signal Contract Verification',
          '',
          '## P0 Journey Coverage Matrix',
          '',
          '| PRD Journey ID | PRD Journey Name | Arch P0 Key Path | Epic Coverage | Status | Evidence |',
          '|----------------|------------------|------------------|---------------|--------|----------|',
          '| J01 | Demo | KP-01 | Epic 1 | ✅ | arch.md |',
          '',
          '## Smoke E2E Preconditions Traceability',
          '',
          '- E2E test strategy',
          '- Critical paths',
          '',
          '## Cross-Document Traceability',
          '',
          '- PRD Requirement',
          '- Architecture Decision',
          '- Epic Story',
          '- Traceability Status',
          '',
          '## Four-Signal Contract Verification',
          '',
          '- P0 Journey smoke E2E evidence traceability',
          '',
        ].join('\n'),
        'utf8'
      );

      const preContinue = spawnSync(
        process.execPath,
        [join(consumer, '.claude', 'hooks', 'pre-continue-check.cjs'), 'check-implementation-readiness', 'step-06-final-assessment'],
        {
          cwd: consumer,
          env: {
            ...process.env,
            BMAD_PRECONTINUE_ARTIFACT_PATH: readinessArtifact,
          },
          encoding: 'utf8',
        }
      );

      expect(preContinue.stdout).toContain('"workflow":"bmad-check-implementation-readiness"');
      expect(preContinue.stdout).toContain('"deferredGapAudit"');
      expect(preContinue.stderr).not.toContain('Cannot find module');

      const event = {
        type: 'governance-rerun-result',
        payload: {
          projectRoot: consumer,
          sourceEventType: 'governance-pre-continue-check',
          runnerInput: {
            projectRoot: consumer,
            rerunGate: 'implementation-readiness',
            attemptId: 'accept-zero-scripts-01',
            capabilitySlot: 'qa.readiness',
            canonicalAgent: 'PM + QA / readiness reviewer',
            targetArtifacts: ['prd.md', 'architecture.md'],
            expectedDelta: 'close readiness blockers',
            outputPath: join(consumer, '_bmad-output', 'planning-artifacts', 'dev', 'accept-out.md'),
            promptText: 'consumer zero scripts packaged rerun',
            stageContextKnown: true,
            gateFailureExists: true,
            blockerOwnershipLocked: true,
            rootTargetLocked: true,
            equivalentAdapterCount: 1,
            sourceGateFailureIds: ['CONSUMER-1'],
            actualExecutor: 'implementation readiness workflow',
            adapterPath: 'local workflow fallback',
            rerunOwner: 'PM',
            outcome: 'blocked',
            hostKind: 'claude',
          },
          rerunGateResult: {
            gate: 'implementation-readiness',
            status: 'fail',
          },
        },
      };

      const hook = spawnSync(process.execPath, [join(consumer, '.claude', 'hooks', 'post-tool-use.cjs')], {
        cwd: consumer,
        input: JSON.stringify(event),
        encoding: 'utf8',
      });

      expect(hook.status).toBe(0);
      const stdout = `${hook.stdout || ''}${hook.stderr || ''}`;
      expect(stdout).toContain('received rerun-result');
      expect(stdout).toContain('queued rerun event');

      const logPath = join(consumer, '.claude', 'state', 'runtime', 'governance-hook.log');
      waitFor(() => existsSync(logPath));
      const logText = readFileSync(logPath, 'utf8');
      expect(logText).toContain('received rerun-result gate=implementation-readiness');

      const currentRun = join(consumer, '_bmad-output', 'runtime', 'governance', 'current-run.json');
      const failedDebug = join(
        consumer,
        '_bmad-output',
        'runtime',
        'governance',
        'queue',
        'last-failed-debug.json'
      );
      waitFor(() => existsSync(currentRun) || existsSync(failedDebug), 30000, 250);
      if (existsSync(failedDebug)) {
        throw new Error(readFileSync(failedDebug, 'utf8'));
      }
      const currentRunText = readFileSync(currentRun, 'utf8');
      expect(currentRunText).toContain('implementation-readiness');
    } finally {
      const lockPath = join(consumer, '_bmad-output', 'runtime', 'governance', 'runner-lock.json');
      waitFor(() => !existsSync(lockPath), 15000, 200);
      removeDirWithRetry(consumer);
      removeDirWithRetry(packDir);
    }
  }, 180_000);
});
