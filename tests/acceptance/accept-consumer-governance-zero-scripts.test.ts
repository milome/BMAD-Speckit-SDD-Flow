import { execSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
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
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
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

describe('consumer governance zero-scripts install', () => {
  it('keeps consumer root free of governance scripts and runs governance via hook-local entries', () => {
    const packDir = mkdtempSync(join(tmpdir(), 'gov-zero-scripts-pack-'));
    run(`npm pack -w bmad-speckit --pack-destination "${packDir.replace(/\\/g, '/')}"`, PKG_ROOT);
    const tgzName = readdirSync(packDir).find((f) => f.startsWith('bmad-speckit') && f.endsWith('.tgz'));
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
      expect(existsSync(join(consumer, 'node_modules', 'bmad-speckit', '_bmad', 'runtime', 'hooks', 'governance-runtime-worker.cjs'))).toBe(true);
      expect(existsSync(join(consumer, 'node_modules', 'bmad-speckit', '_bmad', 'runtime', 'hooks', 'governance-remediation-runner.cjs'))).toBe(true);

      run('npx bmad-speckit-init --agent claude-code', consumer);

      expect(existsSync(join(consumer, '.claude', 'hooks', 'governance-runtime-worker.cjs'))).toBe(true);
      expect(existsSync(join(consumer, '.claude', 'hooks', 'governance-remediation-runner.cjs'))).toBe(true);
      expect(existsSync(join(consumer, '.claude', 'hooks', 'post-tool-use.cjs'))).toBe(true);
      expect(
        existsSync(
          join(
            consumer,
            'node_modules',
            'bmad-speckit',
            'node_modules',
            '@bmad-speckit',
            'runtime-emit',
            'dist',
            'governance-runtime-worker.cjs'
          )
        )
      ).toBe(true);
      expect(
        existsSync(
          join(
            consumer,
            'node_modules',
            'bmad-speckit',
            'node_modules',
            '@bmad-speckit',
            'runtime-emit',
            'dist',
            'governance-remediation-runner.cjs'
          )
        )
      ).toBe(true);

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

      const doneFile = join(
        consumer,
        '_bmad-output',
        'runtime',
        'governance',
        'queue',
        'done',
        'gov-rerun-accept-zero-scripts-01.json'
      );
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
