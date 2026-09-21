import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  lstatSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const ABANDONED_LOCK_AGE_MS = 5 * 60 * 1000;

interface RequirementsFileLockOwner {
  pid: number;
  createdAt: string;
  token: string;
}

type AbandonedRequirementsFileLock =
  | { kind: 'owner'; owner: RequirementsFileLockOwner }
  | { kind: 'malformed'; mtimeMs: number; size: number };

export interface RequirementsFileLock {
  fd: number;
  lockPath: string;
  token: string;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException)?.code === 'EPERM';
  }
}

function abandonedOwner(lockPath: string, now: number): AbandonedRequirementsFileLock | null {
  try {
    const owner = JSON.parse(readFileSync(lockPath, 'utf8')) as RequirementsFileLockOwner;
    const createdAt = Date.parse(owner.createdAt);
    if (
      !Number.isSafeInteger(owner.pid) || owner.pid < 1 ||
      typeof owner.token !== 'string' || owner.token.length === 0 ||
      !Number.isFinite(createdAt) || now - createdAt <= ABANDONED_LOCK_AGE_MS ||
      processIsAlive(owner.pid)
    ) return null;
    return { kind: 'owner', owner };
  } catch {
    try {
      const stat = lstatSync(lockPath);
      return now - stat.mtimeMs > ABANDONED_LOCK_AGE_MS
        ? { kind: 'malformed', mtimeMs: stat.mtimeMs, size: stat.size }
        : null;
    } catch {
      return null;
    }
  }
}

function removeAbandonedLock(lockPath: string, abandoned: AbandonedRequirementsFileLock): void {
  if (abandoned.kind === 'owner') {
    const current = JSON.parse(readFileSync(lockPath, 'utf8')) as RequirementsFileLockOwner;
    if (
      current.token !== abandoned.owner.token ||
      current.pid !== abandoned.owner.pid ||
      current.createdAt !== abandoned.owner.createdAt
    ) throw new Error('requirements_file_lock_owner_changed');
  } else {
    const stat = lstatSync(lockPath);
    if (stat.mtimeMs !== abandoned.mtimeMs || stat.size !== abandoned.size) {
      throw new Error('requirements_file_lock_owner_changed');
    }
  }
  rmSync(lockPath);
}

export function acquireRequirementsFileLock(input: {
  lockPath: string;
  busyCode: string;
  now?: Date;
}): RequirementsFileLock {
  mkdirSync(path.dirname(input.lockPath), { recursive: true });
  const now = input.now ?? new Date();
  const token = randomUUID();
  const owner: RequirementsFileLockOwner = { pid: process.pid, createdAt: now.toISOString(), token };
  const recoveryPath = `${input.lockPath}.recovery`;
  const open = (): number => {
    if (existsSync(recoveryPath)) {
      const abandonedRecovery = abandonedOwner(recoveryPath, now.getTime());
      if (!abandonedRecovery) throw new Error(input.busyCode);
      removeAbandonedLock(recoveryPath, abandonedRecovery);
    }
    const fd = openSync(input.lockPath, 'wx');
    try {
      writeSync(fd, JSON.stringify(owner));
    } catch (error) {
      closeSync(fd);
      rmSync(input.lockPath, { force: true });
      throw error;
    }
    if (existsSync(recoveryPath)) {
      closeSync(fd);
      const current = JSON.parse(readFileSync(input.lockPath, 'utf8')) as RequirementsFileLockOwner;
      if (current.token === token) rmSync(input.lockPath, { force: true });
      throw new Error(input.busyCode);
    }
    return fd;
  };
  try {
    return { fd: open(), lockPath: input.lockPath, token };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error;
  }
  const abandoned = abandonedOwner(input.lockPath, now.getTime());
  if (!abandoned) throw new Error(input.busyCode);
  let recoveryFd: number | undefined;
  try {
    recoveryFd = openSync(recoveryPath, 'wx');
    try {
      writeSync(recoveryFd, JSON.stringify(owner));
    } catch (error) {
      closeSync(recoveryFd);
      recoveryFd = undefined;
      rmSync(recoveryPath, { force: true });
      throw error;
    }
    removeAbandonedLock(input.lockPath, abandoned);
    const fd = openSync(input.lockPath, 'wx');
    try {
      writeSync(fd, JSON.stringify(owner));
    } catch (error) {
      closeSync(fd);
      rmSync(input.lockPath, { force: true });
      throw error;
    }
    return { fd, lockPath: input.lockPath, token };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') throw new Error(input.busyCode);
    throw error;
  } finally {
    if (recoveryFd !== undefined) {
      closeSync(recoveryFd);
      rmSync(recoveryPath, { force: true });
    }
  }
}

export function releaseRequirementsFileLock(lock: RequirementsFileLock): void {
  closeSync(lock.fd);
  if (!existsSync(lock.lockPath)) return;
  try {
    const owner = JSON.parse(readFileSync(lock.lockPath, 'utf8')) as RequirementsFileLockOwner;
    if (owner.token === lock.token && owner.pid === process.pid) rmSync(lock.lockPath, { force: true });
  } catch {
    // A malformed or replaced lock is not owned by this process.
  }
}
