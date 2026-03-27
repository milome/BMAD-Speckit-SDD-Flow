#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function findProjectRoot(explicitRoot) {
  if (explicitRoot) {
    const resolved = path.resolve(explicitRoot);
    if (fs.existsSync(path.join(resolved, '_bmad'))) {
      return resolved;
    }
  }

  const envRoot = process.env.CLAUDE_PROJECT_DIR || process.env.CURSOR_PROJECT_ROOT;
  if (envRoot) {
    const resolved = path.resolve(envRoot);
    if (fs.existsSync(path.join(resolved, '_bmad'))) {
      return resolved;
    }
  }

  let current = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(current, '_bmad'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
}

function governanceRunnerLockPath(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'runner-lock.json');
}

function nowIso() {
  return new Date().toISOString();
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveRunnerLockTtlMs(lock) {
  return (
    parsePositiveInt(process.env.BMAD_GOVERNANCE_LOCK_TTL_MS) ??
    parsePositiveInt(lock && lock.ttlMs) ??
    60_000
  );
}

function resolveRunnerHeartbeatIntervalMs(lock) {
  const ttlMs = resolveRunnerLockTtlMs(lock);
  const requested =
    parsePositiveInt(process.env.BMAD_GOVERNANCE_LOCK_HEARTBEAT_MS) ??
    parsePositiveInt(lock && lock.heartbeatIntervalMs) ??
    Math.max(50, Math.floor(ttlMs / 4));
  const reserveMs = ttlMs > 1 ? Math.max(1, Math.min(250, Math.floor(ttlMs / 5))) : 1;
  const maxInterval = ttlMs > 1 ? Math.max(1, ttlMs - reserveMs) : 1;
  return Math.min(requested, maxInterval);
}

function lockHeartbeatAgeMs(lock, now = Date.now()) {
  const heartbeatSource = lock && (lock.heartbeatAt || lock.acquiredAt);
  const heartbeatMs = heartbeatSource ? Date.parse(heartbeatSource) : NaN;
  if (!Number.isFinite(heartbeatMs)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, now - heartbeatMs);
}

function isRunnerLockHeartbeatExpired(lock, now = Date.now()) {
  return lockHeartbeatAgeMs(lock, now) > resolveRunnerLockTtlMs(lock);
}

function pendingJsonCount(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }
  return fs.readdirSync(dir).filter((file) => file.endsWith('.json')).length;
}

function hasPendingQueueItems(projectRoot) {
  const governancePending = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'governance',
    'queue',
    'pending'
  );
  const legacyPending = path.join(projectRoot, '.claude', 'state', 'runtime', 'queue', 'pending');
  return pendingJsonCount(governancePending) > 0 || pendingJsonCount(legacyPending) > 0;
}

function tryResolveModule(moduleId, projectRoot) {
  try {
    return require.resolve(moduleId, { paths: [projectRoot, __dirname] });
  } catch {
    return null;
  }
}

function resolveWorkerEntry(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'scripts', 'bmad-runtime-worker.js'),
    path.join(projectRoot, 'scripts', 'bmad-runtime-worker.ts'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit', 'scripts', 'bmad-runtime-worker.js'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit', 'scripts', 'bmad-runtime-worker.ts'),
    path.resolve(__dirname, '..', '..', 'scripts', 'bmad-runtime-worker.js'),
    path.resolve(__dirname, '..', '..', 'scripts', 'bmad-runtime-worker.ts'),
    path.resolve(__dirname, '..', '..', '..', 'scripts', 'bmad-runtime-worker.js'),
    path.resolve(__dirname, '..', '..', '..', 'scripts', 'bmad-runtime-worker.ts'),
  ];

  const resolvedModules = [
    tryResolveModule('bmad-speckit/scripts/bmad-runtime-worker.js', projectRoot),
    tryResolveModule('bmad-speckit/scripts/bmad-runtime-worker.ts', projectRoot),
    tryResolveModule('./scripts/bmad-runtime-worker.js', projectRoot),
    tryResolveModule('./scripts/bmad-runtime-worker.ts', projectRoot),
  ];

  for (const candidate of [...resolvedModules, ...candidates]) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveTsNodeBin(projectRoot, workerEntry) {
  const fromModules = tryResolveModule('ts-node/dist/bin.js', projectRoot);
  if (fromModules && fs.existsSync(fromModules)) {
    return fromModules;
  }

  const candidates = [
    path.join(projectRoot, 'node_modules', 'ts-node', 'dist', 'bin.js'),
    path.join(
      projectRoot,
      'node_modules',
      'bmad-speckit',
      'node_modules',
      'ts-node',
      'dist',
      'bin.js'
    ),
    path.join(path.dirname(workerEntry), '..', '..', 'node_modules', 'ts-node', 'dist', 'bin.js'),
    path.join(
      path.dirname(workerEntry),
      '..',
      '..',
      'node_modules',
      'bmad-speckit',
      'node_modules',
      'ts-node',
      'dist',
      'bin.js'
    ),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildWorkerSpawnPlan(projectRoot) {
  const workerEntry = resolveWorkerEntry(projectRoot);
  if (!workerEntry) {
    throw new Error('bmad runtime worker entry not found');
  }

  if (workerEntry.endsWith('.js')) {
    return {
      command: process.execPath,
      args: [workerEntry],
      shell: false,
    };
  }

  const tsNodeBin = resolveTsNodeBin(projectRoot, workerEntry);
  if (tsNodeBin) {
    return {
      command: process.execPath,
      args: [tsNodeBin, '--transpile-only', workerEntry],
      shell: false,
    };
  }

  return {
    command: 'npx',
    args: ['ts-node', '--transpile-only', workerEntry],
    shell: true,
  };
}

function readRunnerLock(projectRoot) {
  const lockPath = governanceRunnerLockPath(projectRoot);
  if (!fs.existsSync(lockPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeRunnerLock(projectRoot, lockPayload) {
  const lockPath = governanceRunnerLockPath(projectRoot);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify(lockPayload, null, 2) + '\n', 'utf8');
  return lockPayload;
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code !== 'ESRCH';
  }
}

function updateRunnerLockHeartbeat(projectRoot, ownerPid, patch = {}) {
  const currentLock = readRunnerLock(projectRoot);
  if (!currentLock || currentLock.pid !== ownerPid) {
    return null;
  }

  const nextLock = {
    ...currentLock,
    ...patch,
    heartbeatAt: nowIso(),
  };

  writeRunnerLock(projectRoot, nextLock);
  return nextLock;
}

function clearStaleRunnerLock(projectRoot) {
  const lockPath = governanceRunnerLockPath(projectRoot);
  const currentLock = readRunnerLock(projectRoot);
  if (!currentLock) {
    return { cleared: false, lockPath, reason: 'missing or unreadable' };
  }
  const ownerAlive = isProcessAlive(currentLock.pid);
  const heartbeatExpired = isRunnerLockHeartbeatExpired(currentLock);
  if (ownerAlive && !heartbeatExpired) {
    return {
      cleared: false,
      lockPath,
      reason: 'lock owner still alive and heartbeat fresh',
      lock: currentLock,
    };
  }
  fs.rmSync(lockPath, { force: true });
  return {
    cleared: true,
    lockPath,
    staleLock: currentLock,
    staleReason: ownerAlive ? 'heartbeat expired' : 'lock owner not alive',
  };
}

function readActiveRunnerLock(projectRoot) {
  const currentLock = readRunnerLock(projectRoot);
  if (!currentLock) {
    return null;
  }
  if (isProcessAlive(currentLock.pid) && !isRunnerLockHeartbeatExpired(currentLock)) {
    return currentLock;
  }
  clearStaleRunnerLock(projectRoot);
  return null;
}

function tryAcquireRunnerLock(projectRoot) {
  const lockPath = governanceRunnerLockPath(projectRoot);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const lockPayload = {
        version: 1,
        pid: process.pid,
        acquiredAt: nowIso(),
        heartbeatAt: nowIso(),
        ttlMs: resolveRunnerLockTtlMs(),
        heartbeatIntervalMs: resolveRunnerHeartbeatIntervalMs(),
        projectRoot,
      };
      fs.writeFileSync(lockPath, JSON.stringify(lockPayload, null, 2) + '\n', {
        encoding: 'utf8',
        flag: 'wx',
      });
      return {
        acquired: true,
        lockPath,
        lock: lockPayload,
      };
    } catch (error) {
      if (!error || error.code !== 'EEXIST') {
        throw error;
      }

      const activeLock = readRunnerLock(projectRoot);
      if (activeLock && isProcessAlive(activeLock.pid) && !isRunnerLockHeartbeatExpired(activeLock)) {
        return {
          acquired: false,
          lockPath,
          reason: 'runner lock active',
          activeLock,
        };
      }

      fs.rmSync(lockPath, { force: true });
    }
  }

  return {
    acquired: false,
    lockPath,
    reason: 'runner lock contention',
  };
}

function releaseRunnerLock(projectRoot) {
  const lockPath = governanceRunnerLockPath(projectRoot);
  const currentLock = readRunnerLock(projectRoot);
  if (!currentLock) {
    fs.rmSync(lockPath, { force: true });
    return false;
  }
  if (currentLock.pid !== process.pid) {
    return false;
  }
  fs.rmSync(lockPath, { force: true });
  return true;
}

function runActualWorker(projectRoot) {
  const plan = buildWorkerSpawnPlan(projectRoot);
  return spawnSync(plan.command, plan.args, {
    cwd: projectRoot,
    env: { ...process.env },
    windowsHide: true,
    shell: plan.shell,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 10 * 1024 * 1024,
  });
}

function startRunnerLockHeartbeat(projectRoot, ownerPid) {
  const intervalMs = resolveRunnerHeartbeatIntervalMs();
  const child = spawn(
    process.execPath,
    [
      __filename,
      '--heartbeat-lock',
      '--project-root',
      projectRoot,
      '--owner-pid',
      String(ownerPid),
      '--interval-ms',
      String(intervalMs),
    ],
    {
      cwd: projectRoot,
      env: { ...process.env },
      windowsHide: true,
      shell: false,
      stdio: 'ignore',
    }
  );
  return {
    child,
    pid: child.pid,
    intervalMs,
  };
}

function stopRunnerLockHeartbeat(heartbeatHandle) {
  if (!heartbeatHandle || !heartbeatHandle.child || typeof heartbeatHandle.child.kill !== 'function') {
    return false;
  }
  try {
    heartbeatHandle.child.kill();
    return true;
  } catch {
    return false;
  }
}

function runWorkerWithRunnerLock(options = {}) {
  const projectRoot = findProjectRoot(options.projectRoot);
  const onlyWhenPending = options.onlyWhenPending !== false;

  if (onlyWhenPending && !hasPendingQueueItems(projectRoot)) {
    return {
      started: false,
      skipped: true,
      projectRoot,
      reason: 'no pending queue items',
      lockPath: governanceRunnerLockPath(projectRoot),
    };
  }

  const lockAttempt = tryAcquireRunnerLock(projectRoot);
  if (!lockAttempt.acquired) {
    return {
      started: false,
      skipped: true,
      projectRoot,
      reason: lockAttempt.reason || 'runner lock active',
      lockPath: lockAttempt.lockPath,
      activeLock: lockAttempt.activeLock || null,
    };
  }

  let heartbeatHandle = null;
  try {
    heartbeatHandle = startRunnerLockHeartbeat(projectRoot, process.pid);
    const result = runActualWorker(projectRoot);
    return {
      started: true,
      skipped: false,
      wait: true,
      projectRoot,
      lockPath: lockAttempt.lockPath,
      status: result.status === null ? 1 : result.status,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    };
  } finally {
    stopRunnerLockHeartbeat(heartbeatHandle);
    releaseRunnerLock(projectRoot);
  }
}

function runBmadRuntimeWorker(options = {}) {
  const projectRoot = findProjectRoot(options.projectRoot);
  const wait = options.wait !== false;
  const onlyWhenPending = options.onlyWhenPending !== false;

  if (onlyWhenPending && !hasPendingQueueItems(projectRoot)) {
    return {
      started: false,
      skipped: true,
      projectRoot,
      reason: 'no pending queue items',
      lockPath: governanceRunnerLockPath(projectRoot),
    };
  }

  const activeLock = readActiveRunnerLock(projectRoot);
  if (activeLock) {
    return {
      started: false,
      skipped: true,
      projectRoot,
      reason: 'runner lock active',
      lockPath: governanceRunnerLockPath(projectRoot),
      activeLock,
    };
  }

  if (wait) {
    return runWorkerWithRunnerLock({
      projectRoot,
      onlyWhenPending: false,
    });
  }

  const child = spawn(process.execPath, [__filename, '--project-root', projectRoot], {
    cwd: projectRoot,
    env: { ...process.env },
    windowsHide: true,
    shell: false,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return {
    started: true,
    skipped: false,
    wait: false,
    projectRoot,
    lockPath: governanceRunnerLockPath(projectRoot),
    pid: child.pid,
  };
}

function argValue(args, flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

module.exports = {
  buildWorkerSpawnPlan,
  clearStaleRunnerLock,
  findProjectRoot,
  governanceRunnerLockPath,
  hasPendingQueueItems,
  isProcessAlive,
  isRunnerLockHeartbeatExpired,
  lockHeartbeatAgeMs,
  readActiveRunnerLock,
  readRunnerLock,
  releaseRunnerLock,
  resolveRunnerHeartbeatIntervalMs,
  resolveRunnerLockTtlMs,
  runBmadRuntimeWorker,
  startRunnerLockHeartbeat,
  stopRunnerLockHeartbeat,
  runWorkerWithRunnerLock,
  tryAcquireRunnerLock,
  updateRunnerLockHeartbeat,
  writeRunnerLock,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--heartbeat-lock')) {
    const projectRoot = findProjectRoot(argValue(args, '--project-root'));
    const ownerPid = parsePositiveInt(argValue(args, '--owner-pid'));
    const intervalMs = parsePositiveInt(argValue(args, '--interval-ms')) ?? resolveRunnerHeartbeatIntervalMs();

    if (!ownerPid) {
      process.exit(1);
    }

    const tick = () => {
      const currentLock = readRunnerLock(projectRoot);
      if (!currentLock || currentLock.pid !== ownerPid || !isProcessAlive(ownerPid)) {
        process.exit(0);
      }
      updateRunnerLockHeartbeat(projectRoot, ownerPid);
    };

    tick();
    setInterval(tick, intervalMs);
  } else {
    const projectRoot = argValue(args, '--project-root');
    const result = runWorkerWithRunnerLock({
      projectRoot,
      onlyWhenPending: true,
    });

    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    process.exit(result.status === 0 || result.skipped ? 0 : result.status || 1);
  }
}
