'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { fail } = require('./canonical-artifact.cjs');

const RUNTIME_INIT_SCRIPTS = Object.freeze(['init:claude', 'init:cursor', 'init:codex']);

function errorDetails(error) {
  return {
    message: error instanceof Error ? error.message : String(error),
    status: Number.isInteger(error?.status) ? error.status : null,
  };
}

function defaultRunNpmScript(scriptName, { repoRoot }) {
  const result = spawnSync('npm', ['run', scriptName], {
    cwd: repoRoot,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`npm run ${scriptName} failed`);
    error.status = result.status;
    throw error;
  }
}

function trackedPath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('CI_SHARD_RUNTIME_TRACKED_PATH_INVALID');
  }
  const candidate = value.replaceAll('\\', '/');
  if (
    candidate !== value ||
    /^[A-Za-z]:/u.test(candidate) ||
    path.posix.isAbsolute(candidate) ||
    candidate === '.' ||
    candidate === '..' ||
    candidate.startsWith('../') ||
    candidate.includes('/../') ||
    path.posix.normalize(candidate) !== candidate ||
    [...candidate].some((character) => character.charCodeAt(0) <= 0x1f)
  ) {
    fail('CI_SHARD_RUNTIME_TRACKED_PATH_INVALID', { path: value });
  }
  return candidate;
}

function normalizeTrackedChanges(values) {
  if (!Array.isArray(values)) fail('CI_SHARD_RUNTIME_TRACKED_CHANGES_INVALID');
  return [...new Set(values.map(trackedPath))].sort((left, right) =>
    left.localeCompare(right, 'en')
  );
}

function defaultListTrackedChanges({ repoRoot }) {
  const result = spawnSync('git', ['diff', '--name-only', '-z', 'HEAD', '--'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error('git diff HEAD failed');
    error.status = result.status;
    throw error;
  }
  return normalizeTrackedChanges(result.stdout.split('\0').filter(Boolean));
}

function defaultRestoreTrackedChanges(paths, { repoRoot }) {
  const trackedChanges = normalizeTrackedChanges(paths);
  if (trackedChanges.length === 0) return;
  const result = spawnSync(
    'git',
    ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...trackedChanges],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error('git restore failed');
    error.status = result.status;
    throw error;
  }
}

function defaultSyncPackageRuntime({ repoRoot }) {
  const result = spawnSync(process.execPath, ['scripts/prepublish-check.js'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error('node scripts/prepublish-check.js failed');
    error.status = result.status;
    throw error;
  }
}

function initializeAgentSurfaces({ repoRoot, runNpmScript = defaultRunNpmScript }) {
  for (const scriptName of RUNTIME_INIT_SCRIPTS) {
    runNpmScript(scriptName, { repoRoot });
  }
}

function prepareShardRuntime({
  repoRoot = process.cwd(),
  listTrackedChanges = defaultListTrackedChanges,
  restoreTrackedChanges = defaultRestoreTrackedChanges,
  runNpmScript = defaultRunNpmScript,
  syncPackageRuntime = defaultSyncPackageRuntime,
} = {}) {
  if (typeof listTrackedChanges !== 'function') {
    fail('CI_SHARD_RUNTIME_CHANGE_LISTER_INVALID');
  }
  if (typeof restoreTrackedChanges !== 'function') {
    fail('CI_SHARD_RUNTIME_RESTORER_INVALID');
  }
  if (typeof runNpmScript !== 'function') fail('CI_SHARD_RUNTIME_RUNNER_INVALID');
  if (typeof syncPackageRuntime !== 'function') fail('CI_SHARD_RUNTIME_SYNC_INVALID');

  const initialTrackedChanges = normalizeTrackedChanges(listTrackedChanges({ repoRoot }));
  if (initialTrackedChanges.length > 0) {
    fail('CI_SHARD_RUNTIME_CHECKOUT_DIRTY', {
      trackedPaths: initialTrackedChanges,
    });
  }

  let prepackError = null;
  try {
    runNpmScript('prepack', { repoRoot });
  } catch (error) {
    prepackError = error;
  }

  let postpackError = null;
  try {
    runNpmScript('postpack', { repoRoot });
  } catch (error) {
    postpackError = error;
  }

  let generatedTrackedChanges = [];
  let cleanupError = null;
  try {
    generatedTrackedChanges = normalizeTrackedChanges(listTrackedChanges({ repoRoot }));
    if (generatedTrackedChanges.length > 0) {
      restoreTrackedChanges(generatedTrackedChanges, { repoRoot });
    }
  } catch (error) {
    cleanupError = error;
  }

  if (prepackError) {
    fail('CI_SHARD_RUNTIME_PREPACK_FAILED', {
      prepack: errorDetails(prepackError),
      postpack: postpackError ? errorDetails(postpackError) : null,
      cleanup: cleanupError ? errorDetails(cleanupError) : null,
    });
  }
  if (postpackError) {
    fail('CI_SHARD_RUNTIME_POSTPACK_FAILED', {
      postpack: errorDetails(postpackError),
      cleanup: cleanupError ? errorDetails(cleanupError) : null,
    });
  }
  if (cleanupError) {
    fail('CI_SHARD_RUNTIME_RESTORE_INCOMPLETE', {
      cleanup: errorDetails(cleanupError),
    });
  }

  let remainingTrackedChanges;
  try {
    remainingTrackedChanges = normalizeTrackedChanges(listTrackedChanges({ repoRoot }));
  } catch (error) {
    fail('CI_SHARD_RUNTIME_RESTORE_INCOMPLETE', {
      cleanup: errorDetails(error),
    });
  }
  if (remainingTrackedChanges.length > 0) {
    fail('CI_SHARD_RUNTIME_RESTORE_INCOMPLETE', {
      trackedPaths: remainingTrackedChanges,
    });
  }

  const restoredTrackedPaths = new Set(generatedTrackedChanges);
  let syncError = null;
  try {
    syncPackageRuntime({ repoRoot });
  } catch (error) {
    syncError = error;
  }

  let syncedTrackedChanges = [];
  let syncCleanupError = null;
  try {
    syncedTrackedChanges = normalizeTrackedChanges(listTrackedChanges({ repoRoot }));
    if (syncedTrackedChanges.length > 0) {
      restoreTrackedChanges(syncedTrackedChanges, { repoRoot });
      for (const trackedPath of syncedTrackedChanges) {
        restoredTrackedPaths.add(trackedPath);
      }
    }
  } catch (error) {
    syncCleanupError = error;
  }

  let remainingSyncedTrackedChanges = [];
  if (!syncCleanupError) {
    try {
      remainingSyncedTrackedChanges = normalizeTrackedChanges(
        listTrackedChanges({ repoRoot })
      );
    } catch (error) {
      syncCleanupError = error;
    }
  }

  if (syncError) {
    fail('CI_SHARD_RUNTIME_SYNC_FAILED', {
      sync: errorDetails(syncError),
      cleanup: syncCleanupError ? errorDetails(syncCleanupError) : null,
      trackedPaths:
        remainingSyncedTrackedChanges.length > 0
          ? remainingSyncedTrackedChanges
          : undefined,
    });
  }
  if (syncCleanupError) {
    fail('CI_SHARD_RUNTIME_RESTORE_INCOMPLETE', {
      cleanup: errorDetails(syncCleanupError),
    });
  }
  if (remainingSyncedTrackedChanges.length > 0) {
    fail('CI_SHARD_RUNTIME_RESTORE_INCOMPLETE', {
      trackedPaths: remainingSyncedTrackedChanges,
    });
  }

  let initializationError = null;
  try {
    initializeAgentSurfaces({ repoRoot, runNpmScript });
  } catch (error) {
    initializationError = error;
  }

  let initializedTrackedChanges = [];
  let initializationCleanupError = null;
  try {
    initializedTrackedChanges = normalizeTrackedChanges(listTrackedChanges({ repoRoot }));
    if (initializedTrackedChanges.length > 0) {
      restoreTrackedChanges(initializedTrackedChanges, { repoRoot });
      for (const trackedPath of initializedTrackedChanges) {
        restoredTrackedPaths.add(trackedPath);
      }
    }
  } catch (error) {
    initializationCleanupError = error;
  }

  let remainingInitializedTrackedChanges = [];
  if (!initializationCleanupError) {
    try {
      remainingInitializedTrackedChanges = normalizeTrackedChanges(listTrackedChanges({ repoRoot }));
    } catch (error) {
      initializationCleanupError = error;
    }
  }

  if (initializationError) {
    fail('CI_SHARD_RUNTIME_INIT_FAILED', {
      initialization: errorDetails(initializationError),
      cleanup: initializationCleanupError ? errorDetails(initializationCleanupError) : null,
      trackedPaths:
        remainingInitializedTrackedChanges.length > 0
          ? remainingInitializedTrackedChanges
          : undefined,
    });
  }
  if (initializationCleanupError) {
    fail('CI_SHARD_RUNTIME_RESTORE_INCOMPLETE', {
      cleanup: errorDetails(initializationCleanupError),
    });
  }
  if (remainingInitializedTrackedChanges.length > 0) {
    fail('CI_SHARD_RUNTIME_RESTORE_INCOMPLETE', {
      trackedPaths: remainingInitializedTrackedChanges,
    });
  }

  return {
    status: 'prepared',
    restoredTrackedFileCount: restoredTrackedPaths.size,
  };
}

function main() {
  const result = prepareShardRuntime({ repoRoot: process.cwd() });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  defaultListTrackedChanges,
  defaultRestoreTrackedChanges,
  defaultRunNpmScript,
  defaultSyncPackageRuntime,
  initializeAgentSurfaces,
  main,
  normalizeTrackedChanges,
  prepareShardRuntime,
};
