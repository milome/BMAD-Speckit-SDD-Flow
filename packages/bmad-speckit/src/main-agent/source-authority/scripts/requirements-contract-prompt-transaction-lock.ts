import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface PromptTransactionLockRecord {
  schemaVersion: 'requirements-contract-prompt-transaction-lock/v1';
  lockId: string;
  transactionId: string;
  host: string;
  processId: number;
  acquiredAt: string;
  leaseExpiresAt: string;
}

export interface PromptTransactionLockHandle {
  path: string;
  record: PromptTransactionLockRecord;
  staleRecovery: {
    staleLockId: string;
    staleTransactionId: string;
    archivePath: string;
  } | null;
}

export interface PromptTransactionLockDeps {
  now?: () => Date;
  hostName?: () => string;
  processId?: () => number;
  createLockId?: () => string;
  isProcessAlive?: (processId: number) => boolean;
}

function observeProcessAlive(processId: number): boolean {
  if (!Number.isInteger(processId) || processId <= 0) return false;
  if (processId === process.pid) return true;
  try {
    process.kill(processId, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false;
    if (code === 'EPERM') return true;
    throw new Error(`prompt_transaction_lock_owner_liveness_indeterminate:${code ?? 'unknown'}`);
  }
}

function readLock(lockPath: string): PromptTransactionLockRecord {
  const value = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as PromptTransactionLockRecord;
  if (
    value.schemaVersion !== 'requirements-contract-prompt-transaction-lock/v1' ||
    !value.lockId ||
    !value.transactionId ||
    !value.host ||
    !Number.isInteger(value.processId) ||
    Number.isNaN(Date.parse(value.acquiredAt)) ||
    Number.isNaN(Date.parse(value.leaseExpiresAt))
  ) {
    throw new Error('prompt_transaction_lock_record_invalid');
  }
  return value;
}

function createLock(
  lockPath: string,
  transactionId: string,
  now: Date,
  leaseMs: number,
  deps: PromptTransactionLockDeps
): PromptTransactionLockHandle {
  const record: PromptTransactionLockRecord = {
    schemaVersion: 'requirements-contract-prompt-transaction-lock/v1',
    lockId: deps.createLockId?.() ?? `LOCK-${randomUUID()}`,
    transactionId,
    host: deps.hostName?.() ?? os.hostname(),
    processId: deps.processId?.() ?? process.pid,
    acquiredAt: now.toISOString(),
    leaseExpiresAt: new Date(now.getTime() + leaseMs).toISOString(),
  };
  const handle = fs.openSync(lockPath, 'wx');
  try {
    fs.writeFileSync(handle, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  return { path: lockPath, record, staleRecovery: null };
}

export function acquirePromptTransactionLock(input: {
  outDir: string;
  transactionId: string;
  now?: Date;
  leaseMs?: number;
}, deps: PromptTransactionLockDeps = {}): PromptTransactionLockHandle {
  const outDir = path.resolve(input.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const lockPath = path.join(outDir, '.prompt-transaction.lock');
  const now = input.now ?? deps.now?.() ?? new Date();
  const leaseMs = input.leaseMs ?? 5 * 60 * 1000;
  try {
    return createLock(lockPath, input.transactionId, now, leaseMs, deps);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }

  const stale = readLock(lockPath);
  if (stale.host !== (deps.hostName?.() ?? os.hostname())) {
    throw new Error('prompt_transaction_lock_cross_host_owner_indeterminate');
  }
  const leaseExpired = Date.parse(stale.leaseExpiresAt) <= now.getTime();
  if (!leaseExpired || (deps.isProcessAlive ?? observeProcessAlive)(stale.processId)) {
    throw new Error('prompt_transaction_lock_held');
  }
  const archivePath = `${lockPath}.stale.${stale.lockId}`;
  if (fs.existsSync(archivePath)) {
    throw new Error('prompt_transaction_stale_lock_archive_collision');
  }
  fs.renameSync(lockPath, archivePath);
  const acquired = createLock(lockPath, input.transactionId, now, leaseMs, deps);
  acquired.staleRecovery = {
    staleLockId: stale.lockId,
    staleTransactionId: stale.transactionId,
    archivePath,
  };
  return acquired;
}

export function releasePromptTransactionLock(handle: PromptTransactionLockHandle): void {
  const current = readLock(handle.path);
  if (
    current.lockId !== handle.record.lockId ||
    current.transactionId !== handle.record.transactionId
  ) {
    throw new Error('prompt_transaction_lock_release_owner_mismatch');
  }
  fs.rmSync(handle.path);
}
