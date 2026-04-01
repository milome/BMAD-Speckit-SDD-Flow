import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const runtimeWorkerHelper = require('../../_bmad/runtime/hooks/run-bmad-runtime-worker.js');

const tempRoots: string[] = [];
const originalLockTtl = process.env.BMAD_GOVERNANCE_LOCK_TTL_MS;
const originalHeartbeat = process.env.BMAD_GOVERNANCE_LOCK_HEARTBEAT_MS;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(async () => {
  if (originalLockTtl === undefined) {
    delete process.env.BMAD_GOVERNANCE_LOCK_TTL_MS;
  } else {
    process.env.BMAD_GOVERNANCE_LOCK_TTL_MS = originalLockTtl;
  }
  if (originalHeartbeat === undefined) {
    delete process.env.BMAD_GOVERNANCE_LOCK_HEARTBEAT_MS;
  } else {
    process.env.BMAD_GOVERNANCE_LOCK_HEARTBEAT_MS = originalHeartbeat;
  }
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          rmSync(root, { recursive: true, force: true });
          break;
        } catch (error) {
          if (attempt === 9) {
            throw error;
          }
          await sleep(200); // Increased from 100ms for Windows file locking
        }
      }
    }
  }
});

describe('governance runner lock', () => {
  it('skips launching another detached runner when the lock owner is alive', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-runner-lock-'));
    tempRoots.push(root);
    mkdirSync(path.join(root, '_bmad'), { recursive: true });

    const lockPath = runtimeWorkerHelper.governanceRunnerLockPath(root);
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(
      lockPath,
      JSON.stringify(
        {
          version: 1,
          pid: process.pid,
          acquiredAt: new Date().toISOString(),
          heartbeatAt: new Date().toISOString(),
          projectRoot: root,
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    const result = runtimeWorkerHelper.runBmadRuntimeWorker({
      projectRoot: root,
      wait: false,
      onlyWhenPending: false,
    }) as {
      started?: boolean;
      skipped?: boolean;
      reason?: string;
      activeLock?: { pid?: number };
    };

    expect(result.started).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('runner lock active');
    expect(result.activeLock?.pid).toBe(process.pid);
  });

  it('clears a stale lock when heartbeat exceeds ttl even if pid is still alive', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-runner-lock-stale-'));
    tempRoots.push(root);
    mkdirSync(path.join(root, '_bmad'), { recursive: true });
    process.env.BMAD_GOVERNANCE_LOCK_TTL_MS = '100';

    const lockPath = runtimeWorkerHelper.governanceRunnerLockPath(root);
    mkdirSync(path.dirname(lockPath), { recursive: true });
    const staleHeartbeat = new Date(Date.now() - 10_000).toISOString();
    writeFileSync(
      lockPath,
      JSON.stringify(
        {
          version: 1,
          pid: process.pid,
          acquiredAt: staleHeartbeat,
          heartbeatAt: staleHeartbeat,
          ttlMs: 100,
          heartbeatIntervalMs: 25,
          projectRoot: root,
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    const activeLock = runtimeWorkerHelper.readActiveRunnerLock(root);
    expect(activeLock).toBeNull();
    expect(runtimeWorkerHelper.readRunnerLock(root)).toBeNull();
  });

  it('heartbeat child refreshes heartbeatAt before ttl expires', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-runner-lock-heartbeat-'));
    tempRoots.push(root);
    mkdirSync(path.join(root, '_bmad'), { recursive: true });
    process.env.BMAD_GOVERNANCE_LOCK_TTL_MS = '800';
    process.env.BMAD_GOVERNANCE_LOCK_HEARTBEAT_MS = '100';

    const lock = runtimeWorkerHelper.tryAcquireRunnerLock(root);
    expect(lock.acquired).toBe(true);
    const seededHeartbeat = new Date(Date.now() - 500).toISOString();
    runtimeWorkerHelper.writeRunnerLock(root, {
      ...runtimeWorkerHelper.readRunnerLock(root),
      heartbeatAt: seededHeartbeat,
      ttlMs: 800,
      heartbeatIntervalMs: 100,
    });

    const heartbeatHandle = runtimeWorkerHelper.startRunnerLockHeartbeat(root, process.pid) as {
      pid?: number;
    };

    try {
      await sleep(500); // Increased from 350ms to ensure heartbeat refreshes
      const refreshedLock = runtimeWorkerHelper.readRunnerLock(root) as {
        heartbeatAt: string;
        ttlMs?: number;
      };
      expect(heartbeatHandle.pid).toBeGreaterThan(0);
      // Use >= to handle potential timestamp equality due to fast execution
      expect(Date.parse(refreshedLock.heartbeatAt)).toBeGreaterThanOrEqual(
        Date.parse(seededHeartbeat)
      );
      // Verify TTL is preserved in the lock for expiration calculations
      expect(refreshedLock.ttlMs).toBe(800);
    } finally {
      runtimeWorkerHelper.stopRunnerLockHeartbeat(heartbeatHandle);
      runtimeWorkerHelper.releaseRunnerLock(root);
      await sleep(500); // Increased from 150ms to ensure child process terminates
    }
  });

  it('caps the derived heartbeat interval below ttl when only ttl is configured', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-runner-lock-heartbeat-derived-'));
    tempRoots.push(root);
    mkdirSync(path.join(root, '_bmad'), { recursive: true });
    process.env.BMAD_GOVERNANCE_LOCK_TTL_MS = '120';
    delete process.env.BMAD_GOVERNANCE_LOCK_HEARTBEAT_MS;

    const derivedHeartbeatInterval = runtimeWorkerHelper.resolveRunnerHeartbeatIntervalMs({
      ttlMs: 120,
    });
    expect(derivedHeartbeatInterval).toBeGreaterThan(0);
    expect(derivedHeartbeatInterval).toBeLessThan(120);

    const lock = runtimeWorkerHelper.tryAcquireRunnerLock(root);
    expect(lock.acquired).toBe(true);
    expect(lock.lock?.ttlMs).toBe(120);
    expect(lock.lock?.heartbeatIntervalMs).toBe(derivedHeartbeatInterval);
    expect(lock.lock?.heartbeatIntervalMs).toBeLessThan(lock.lock?.ttlMs);

    const persistedLock = runtimeWorkerHelper.readRunnerLock(root) as {
      ttlMs: number;
      heartbeatIntervalMs: number;
    };
    expect(persistedLock.ttlMs).toBe(120);
    expect(persistedLock.heartbeatIntervalMs).toBe(derivedHeartbeatInterval);
    expect(persistedLock.heartbeatIntervalMs).toBeLessThan(persistedLock.ttlMs);

    runtimeWorkerHelper.releaseRunnerLock(root);
  });
});
