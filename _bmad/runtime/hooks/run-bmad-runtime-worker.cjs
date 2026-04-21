#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * @typedef {import('node:child_process').ChildProcess} ChildProcess
 * @typedef {import('node:child_process').SpawnSyncReturns<string>} SpawnSyncResult
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceExecutionResult} GovernanceExecutionResult
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceExecutorRoutingProjection} GovernanceExecutorRoutingProjection
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceJourneyContractHintProjection} GovernanceJourneyContractHintProjection
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceRemediationAuditTrace} GovernanceRemediationAuditTrace
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceRerunDecisionProjection} GovernanceRerunDecisionProjection
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceRunnerLockSnapshot} GovernanceRunnerLockSnapshot
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceWorkerResult} GovernanceWorkerResult
 *
 * @typedef {{
 *   payload?: {
 *     journeyContractHints?: GovernanceJourneyContractHintProjection[];
 *   };
 * }} GovernanceQueueItemLike
 *
 * @typedef {{
 *   command: string;
 *   args: string[];
 *   shell: boolean;
 * }} WorkerSpawnPlan
 *
 * @typedef {{
 *   projectRoot?: string;
 *   wait?: boolean;
 *   onlyWhenPending?: boolean;
 * }} GovernanceWorkerOptions
 *
 * @typedef {{
 *   child: ChildProcess;
 *   pid?: number;
 *   intervalMs: number;
 * }} RunnerHeartbeatHandle
 *
 * @typedef {{
 *   acquired: boolean;
 *   lockPath: string;
 *   reason?: string;
 *   lock?: GovernanceRunnerLockSnapshot;
 *   activeLock?: GovernanceRunnerLockSnapshot | null;
 * }} RunnerLockAttempt
 */

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildGovernanceRunnerCliPresentation,
} = require('./governance-runner-summary-presenter.cjs');

/**
 * @param {unknown} error
 * @returns {string | undefined}
 */
function errorCode(error) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }
  const { code } = /** @type {{ code?: unknown }} */ (error);
  return typeof code === 'string' ? code : undefined;
}

/**
 * @param {string | null | undefined} explicitRoot
 * @returns {string}
 */
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

/**
 * @param {string} projectRoot
 * @returns {string}
 */
function governanceRunnerLockPath(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'runner-lock.json');
}

/**
 * @returns {string}
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * @param {number} ms
 * @returns {void}
 */
function waitBriefly(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * @param {GovernanceRunnerLockSnapshot | null | undefined} [lock]
 * @returns {number}
 */
function resolveRunnerLockTtlMs(lock) {
  return (
    parsePositiveInt(process.env.BMAD_GOVERNANCE_LOCK_TTL_MS) ??
    parsePositiveInt(lock && lock.ttlMs) ??
    60_000
  );
}

/**
 * @param {GovernanceRunnerLockSnapshot | null | undefined} [lock]
 * @returns {number}
 */
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

/**
 * @param {GovernanceRunnerLockSnapshot | null | undefined} lock
 * @param {number} [now]
 * @returns {number}
 */
function lockHeartbeatAgeMs(lock, now = Date.now()) {
  const heartbeatSource = lock && (lock.heartbeatAt || lock.acquiredAt);
  const heartbeatMs = heartbeatSource ? Date.parse(heartbeatSource) : NaN;
  if (!Number.isFinite(heartbeatMs)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, now - heartbeatMs);
}

/**
 * @param {GovernanceRunnerLockSnapshot | null | undefined} lock
 * @param {number} [now]
 * @returns {boolean}
 */
function isRunnerLockHeartbeatExpired(lock, now = Date.now()) {
  return lockHeartbeatAgeMs(lock, now) > resolveRunnerLockTtlMs(lock);
}

/**
 * @param {string} dir
 * @returns {number}
 */
function pendingJsonCount(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }
  return fs.readdirSync(dir).filter((file) => file.endsWith('.json')).length;
}

/**
 * @param {string} projectRoot
 * @returns {GovernanceQueueItemLike[]}
 */
function readPendingGovernanceQueueItems(projectRoot) {
  const pendingDir = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'governance',
    'queue',
    'pending'
  );

  if (!fs.existsSync(pendingDir)) {
    return [];
  }

  return fs
    .readdirSync(pendingDir)
    .filter((file) => file.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((file) => path.join(pendingDir, file))
    .map((file) => {
      try {
        return /** @type {GovernanceQueueItemLike} */ (JSON.parse(fs.readFileSync(file, 'utf8')));
      } catch {
        return null;
      }
    })
    .filter(
      /**
       * @param {GovernanceQueueItemLike | null} item
       * @returns {item is GovernanceQueueItemLike}
       */
      (item) => item !== null
    );
}

/**
 * @param {string} projectRoot
 * @returns {GovernanceJourneyContractHintProjection[]}
 */
function collectPendingJourneyContractHints(projectRoot) {
  const seen = new Set();
  const hints = [];

  for (const item of readPendingGovernanceQueueItems(projectRoot)) {
    const payload = item && typeof item.payload === 'object' ? item.payload : null;
    const payloadHints =
      payload && Array.isArray(payload.journeyContractHints) ? payload.journeyContractHints : [];

    for (const hint of payloadHints) {
      if (!hint || typeof hint !== 'object' || typeof hint.signal !== 'string') {
        continue;
      }
      const key = JSON.stringify(hint);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      hints.push(hint);
    }
  }

  return hints;
}

/**
 * @param {GovernanceJourneyContractHintProjection[] | null | undefined} hints
 * @returns {string[]}
 */
function uniqueSignalsFromHints(hints) {
  return [...new Set((Array.isArray(hints) ? hints : [])
    .map((hint) => (hint && typeof hint.signal === 'string' ? hint.signal : null))
    .filter(
      /**
       * @param {string | null} signal
       * @returns {signal is string}
       */
      (signal) => signal !== null
    ))].sort();
}

/**
 * @param {string} projectRoot
 * @param {GovernanceJourneyContractHintProjection[] | null | undefined} pendingJourneyContractHints
 * @param {boolean} pendingQueueExists
 * @returns {GovernanceRerunDecisionProjection}
 */
function buildRerunDecision(projectRoot, pendingJourneyContractHints, pendingQueueExists) {
  const normalizedHints = Array.isArray(pendingJourneyContractHints) ? pendingJourneyContractHints : [];
  const signals = uniqueSignalsFromHints(pendingJourneyContractHints);
  if (signals.length > 0) {
    return /** @type {GovernanceRerunDecisionProjection} */ ({
      mode: 'targeted',
      signals,
      hintCount: normalizedHints.length,
      reason: 'journey contract hints present in pending governance queue',
      projectRoot,
    });
  }

  if (pendingQueueExists) {
    return /** @type {GovernanceRerunDecisionProjection} */ ({
      mode: 'generic',
      signals: [],
      hintCount: 0,
      reason: 'pending governance queue exists without journey contract hints',
      projectRoot,
    });
  }

  return /** @type {GovernanceRerunDecisionProjection} */ ({
    mode: 'idle',
    signals: [],
    hintCount: 0,
    reason: 'no pending governance queue items',
    projectRoot,
  });
}

/**
 * @param {GovernanceRerunDecisionProjection | null | undefined} rerunDecision
 * @returns {GovernanceExecutorRoutingProjection}
 */
function buildExecutorRoutingPreview(rerunDecision) {
  if (rerunDecision && rerunDecision.mode === 'targeted') {
    return /** @type {GovernanceExecutorRoutingProjection} */ ({
      routingMode: 'targeted',
      executorRoute: 'journey-contract-remediation',
      prioritizedSignals: Array.isArray(rerunDecision.signals) ? rerunDecision.signals : [],
    });
  }

  return /** @type {GovernanceExecutorRoutingProjection} */ ({
    routingMode: 'generic',
    executorRoute: 'default-gate-remediation',
    prioritizedSignals: [],
  });
}

/**
 * @param {string} projectRoot
 * @returns {boolean}
 */
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

/**
 * @param {string} projectRoot
 * @returns {string}
 */
function governanceCurrentRunPath(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'current-run.json');
}

/**
 * @param {string} projectRoot
 * @returns {string}
 */
function governanceDoneQueueDir(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'queue', 'done');
}

/**
 * @param {string} projectRoot
 * @returns {string[]}
 */
function readDoneQueueItemIds(projectRoot) {
  const doneDir = governanceDoneQueueDir(projectRoot);
  if (!fs.existsSync(doneDir)) {
    return [];
  }
  return fs
    .readdirSync(doneDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/i, ''))
    .sort();
}

/**
 * @param {string} projectRoot
 * @returns {string[]}
 */
function readCurrentRunItemIds(projectRoot) {
  const currentRunFile = governanceCurrentRunPath(projectRoot);
  if (!fs.existsSync(currentRunFile)) {
    return [];
  }

  try {
    const items = JSON.parse(fs.readFileSync(currentRunFile, 'utf8'));
    if (!Array.isArray(items)) {
      return [];
    }
    return items
      .map((item) => (item && typeof item.id === 'string' ? item.id : null))
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  }
}

/**
 * @param {GovernanceExecutionResult | null | undefined} result
 * @param {GovernanceExecutorRoutingProjection} executorRouting
 * @returns {GovernanceRemediationAuditTrace}
 */
function buildRemediationAuditTrace(result, executorRouting) {
  const journeyContractHints =
    result && Array.isArray(result.journeyContractHints) ? result.journeyContractHints : [];
  const prioritizedSignals = Array.isArray(executorRouting.prioritizedSignals)
    ? executorRouting.prioritizedSignals
    : [];
  const stopReason =
    result && result.stopReason !== undefined && result.stopReason !== null
      ? String(result.stopReason)
      : null;
  const summaryLines = [
    `Routing Mode: ${executorRouting.routingMode || '(unknown)'}`,
    `Executor Route: ${executorRouting.executorRoute || '(unknown)'}`,
    `Stop Reason: ${stopReason || '(none)'}`,
    `Journey Contract Signals: ${journeyContractHints.map((hint) => hint && hint.signal).filter(Boolean).join(', ') || '(none)'}`,
  ];

  return {
    artifactPath: result && typeof result.artifactPath === 'string' ? result.artifactPath : undefined,
    stopReason,
    journeyContractHints,
    routingMode: executorRouting.routingMode,
    executorRoute: executorRouting.executorRoute,
    prioritizedSignals,
    summaryLines,
  };
}

/**
 * @param {GovernanceJourneyContractHintProjection[] | null | undefined} journeyContractHints
 * @param {GovernanceExecutorRoutingProjection} executorRouting
 * @param {string | null | undefined} stopReason
 * @returns {GovernanceRemediationAuditTrace}
 */
function buildFallbackRemediationAuditTrace(journeyContractHints, executorRouting, stopReason) {
  return buildRemediationAuditTrace(
    {
      artifactPath: undefined,
      stopReason: stopReason !== undefined ? stopReason : null,
      journeyContractHints: Array.isArray(journeyContractHints) ? journeyContractHints : [],
    },
    executorRouting
  );
}

/**
 * @param {GovernanceExecutionResult | null | undefined} executionSummary
 * @returns {string[]}
 */
function buildRunnerSummaryLinesFromExecutionSummary(executionSummary) {
  if (!executionSummary || typeof executionSummary !== 'object') {
    return [];
  }

  const lines = [
    '## Governance Remediation Runner Summary',
    `- Loop State ID: ${executionSummary.loopStateId || '(none)'}`,
    `- Current Attempt Number: ${
      executionSummary.currentAttemptNumber !== undefined &&
      executionSummary.currentAttemptNumber !== null
        ? executionSummary.currentAttemptNumber
        : '(none)'
    }`,
    `- Next Attempt Number: ${
      executionSummary.nextAttemptNumber !== undefined &&
      executionSummary.nextAttemptNumber !== null
        ? executionSummary.nextAttemptNumber
        : '(none)'
    }`,
    `- Should Continue: ${executionSummary.shouldContinue ? 'yes' : 'no'}`,
    `- Stop Reason: ${executionSummary.stopReason || '(none)'}`,
    `- Artifact Path: ${executionSummary.artifactPath || '(none)'}`,
    `- Executor Packet: ${
      executionSummary.packetPaths && Object.keys(executionSummary.packetPaths).length > 0 ? 'yes' : 'no'
    }`,
    '',
    '## Loop State Trace Summary',
  ];

  const remediationTrace =
    executionSummary.remediationAuditTrace && Array.isArray(executionSummary.remediationAuditTrace.summaryLines)
      ? executionSummary.remediationAuditTrace.summaryLines
      : [];
  if (remediationTrace.length > 0) {
    for (const line of remediationTrace) {
      lines.push(`- ${line}`);
    }
  } else {
    lines.push('- (none)');
  }

  const packetPaths = executionSummary.packetPaths && typeof executionSummary.packetPaths === 'object'
    ? Object.entries(executionSummary.packetPaths).filter((entry) => entry[1])
    : [];
  if (packetPaths.length > 0) {
    lines.push('');
    lines.push('## Packet Paths');
    for (const [hostKind, packetPath] of packetPaths) {
      lines.push(`- ${hostKind}: ${packetPath}`);
    }
  }

  return lines;
}

/**
 * @param {string} projectRoot
 * @returns {GovernanceExecutionResult | null}
 */
function readLatestGovernanceExecutionSummary(projectRoot) {
  const currentRunFile = governanceCurrentRunPath(projectRoot);
  if (!fs.existsSync(currentRunFile)) {
    return null;
  }

  try {
    const items = JSON.parse(fs.readFileSync(currentRunFile, 'utf8'));
    if (!Array.isArray(items)) {
      return null;
    }
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      const result = item && typeof item.result === 'object' ? item.result : null;
      const executorRouting =
        result && typeof result.executorRouting === 'object' ? result.executorRouting : null;
      if (!executorRouting) {
        continue;
      }
      return {
        shouldContinue: typeof result.shouldContinue === 'boolean' ? result.shouldContinue : undefined,
        stopReason: typeof result.stopReason === 'string' ? result.stopReason : null,
        loopStateId: typeof result.loopStateId === 'string' ? result.loopStateId : null,
        currentAttemptNumber:
          typeof result.currentAttemptNumber === 'number' ? result.currentAttemptNumber : null,
        nextAttemptNumber:
          typeof result.nextAttemptNumber === 'number' ? result.nextAttemptNumber : null,
        artifactPath: typeof result.artifactPath === 'string' ? result.artifactPath : null,
        packetPaths:
          result && typeof result.packetPaths === 'object' && result.packetPaths ? result.packetPaths : {},
        executorRouting,
        runnerSummaryLines: Array.isArray(result.runnerSummaryLines)
          ? result.runnerSummaryLines
          : buildRunnerSummaryLinesFromExecutionSummary({
              ...result,
              executorRouting,
              remediationAuditTrace: buildRemediationAuditTrace(result, executorRouting),
            }),
        remediationAuditTrace: buildRemediationAuditTrace(result, executorRouting),
        governancePresentation: buildGovernanceRunnerCliPresentation({
          shouldContinue:
            typeof result.shouldContinue === 'boolean' ? result.shouldContinue : undefined,
          stopReason: typeof result.stopReason === 'string' ? result.stopReason : null,
          loopStateId: typeof result.loopStateId === 'string' ? result.loopStateId : null,
          currentAttemptNumber:
            typeof result.currentAttemptNumber === 'number' ? result.currentAttemptNumber : null,
          nextAttemptNumber:
            typeof result.nextAttemptNumber === 'number' ? result.nextAttemptNumber : null,
          artifactPath: typeof result.artifactPath === 'string' ? result.artifactPath : null,
          packetPaths:
            result && typeof result.packetPaths === 'object' && result.packetPaths
              ? result.packetPaths
              : {},
          executorRouting,
          runnerSummaryLines: Array.isArray(result.runnerSummaryLines)
            ? result.runnerSummaryLines
            : buildRunnerSummaryLinesFromExecutionSummary({
                ...result,
                executorRouting,
                remediationAuditTrace: buildRemediationAuditTrace(result, executorRouting),
              }),
        }),
      };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * @param {string} projectRoot
 * @returns {GovernanceExecutionResult | null}
 */
function readLatestDoneQueueExecutionSummary(projectRoot) {
  const doneDir = governanceDoneQueueDir(projectRoot);
  if (!fs.existsSync(doneDir)) {
    return null;
  }

  const files = fs.readdirSync(doneDir).filter((file) => file.endsWith('.json')).sort();
  for (let index = files.length - 1; index >= 0; index -= 1) {
    const file = path.join(doneDir, files[index]);
    try {
      const item = JSON.parse(fs.readFileSync(file, 'utf8'));
      const result = item && typeof item.result === 'object' ? item.result : null;
      if (!result) {
        continue;
      }
      const executorRouting =
        result && typeof result.executorRouting === 'object' ? result.executorRouting : null;
      const remediationAuditTrace =
        result && typeof result.remediationAuditTrace === 'object'
          ? result.remediationAuditTrace
          : buildRemediationAuditTrace(result, executorRouting || buildExecutorRoutingPreview({ mode: 'generic', signals: [] }));
      if (!executorRouting) {
        continue;
      }
      return {
        shouldContinue: typeof result.shouldContinue === 'boolean' ? result.shouldContinue : undefined,
        stopReason: typeof result.stopReason === 'string' ? result.stopReason : null,
        loopStateId: typeof result.loopStateId === 'string' ? result.loopStateId : null,
        currentAttemptNumber:
          typeof result.currentAttemptNumber === 'number' ? result.currentAttemptNumber : null,
        nextAttemptNumber:
          typeof result.nextAttemptNumber === 'number' ? result.nextAttemptNumber : null,
        artifactPath: typeof result.artifactPath === 'string' ? result.artifactPath : null,
        packetPaths:
          result && typeof result.packetPaths === 'object' && result.packetPaths ? result.packetPaths : {},
        executorRouting,
        runnerSummaryLines: Array.isArray(result.runnerSummaryLines)
          ? result.runnerSummaryLines
          : buildRunnerSummaryLinesFromExecutionSummary({
              ...result,
              executorRouting,
              remediationAuditTrace,
            }),
        remediationAuditTrace,
        governancePresentation:
          result && result.governancePresentation
            ? result.governancePresentation
            : buildGovernanceRunnerCliPresentation({
                shouldContinue:
                  typeof result.shouldContinue === 'boolean' ? result.shouldContinue : undefined,
                stopReason: typeof result.stopReason === 'string' ? result.stopReason : null,
                loopStateId: typeof result.loopStateId === 'string' ? result.loopStateId : null,
                currentAttemptNumber:
                  typeof result.currentAttemptNumber === 'number' ? result.currentAttemptNumber : null,
                nextAttemptNumber:
                  typeof result.nextAttemptNumber === 'number' ? result.nextAttemptNumber : null,
                artifactPath: typeof result.artifactPath === 'string' ? result.artifactPath : null,
                packetPaths:
                  result && typeof result.packetPaths === 'object' && result.packetPaths
                    ? result.packetPaths
                    : {},
                executorRouting,
                runnerSummaryLines: Array.isArray(result.runnerSummaryLines)
                  ? result.runnerSummaryLines
                  : buildRunnerSummaryLinesFromExecutionSummary({
                      ...result,
                      executorRouting,
                      remediationAuditTrace,
                    }),
              }),
      };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * @param {string} projectRoot
 * @param {number} [attempts]
 * @param {number} [delayMs]
 * @returns {GovernanceExecutionResult | null}
 */
function readLatestGovernanceExecutionSummaryWithRetry(projectRoot, attempts = 5, delayMs = 100) {
  const baselineDoneIds = new Set(readDoneQueueItemIds(projectRoot));
  const baselineCurrentRunIds = new Set(readCurrentRunItemIds(projectRoot));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const summary = readLatestGovernanceExecutionSummary(projectRoot);
    const doneIds = readDoneQueueItemIds(projectRoot);
    const currentRunIds = readCurrentRunItemIds(projectRoot);
    const hasNewDoneItem = doneIds.some((id) => !baselineDoneIds.has(id));
    const hasNewCurrentRunItem = currentRunIds.some((id) => !baselineCurrentRunIds.has(id));
    if (
      summary &&
      !hasPendingQueueItems(projectRoot) &&
      !hasProcessingQueueItems(projectRoot) &&
      (hasNewDoneItem || hasNewCurrentRunItem)
    ) {
      return summary;
    }
    const doneSummary = readLatestDoneQueueExecutionSummary(projectRoot);
    if (doneSummary && !hasPendingQueueItems(projectRoot) && !hasProcessingQueueItems(projectRoot)) {
      return doneSummary;
    }
    if (attempt < attempts - 1) {
      waitBriefly(delayMs);
    }
  }
  return null;
}

/**
 * @param {string} moduleId
 * @param {string} projectRoot
 * @returns {string | null}
 */
function tryResolveModule(moduleId, projectRoot) {
  try {
    return require.resolve(moduleId, { paths: [projectRoot, __dirname] });
  } catch {
    return null;
  }
}

/**
 * @param {string} projectRoot
 * @returns {string | null}
 */
function resolveWorkerEntry(projectRoot) {
  const candidates = [
    path.resolve(__dirname, 'governance-runtime-worker.cjs'),
    path.resolve(__dirname, '..', '..', 'runtime', 'hooks', 'governance-runtime-worker.cjs'),
    path.resolve(__dirname, '..', '..', '..', '_bmad', 'runtime', 'hooks', 'governance-runtime-worker.cjs'),
    path.resolve(__dirname, '..', '..', 'scripts', 'bmad-runtime-worker.js'),
    path.resolve(__dirname, '..', '..', '..', 'scripts', 'bmad-runtime-worker.js'),
    path.join(projectRoot, '.claude', 'hooks', 'governance-runtime-worker.cjs'),
    path.join(projectRoot, '.cursor', 'hooks', 'governance-runtime-worker.cjs'),
    path.join(projectRoot, '_bmad', 'runtime', 'hooks', 'governance-runtime-worker.cjs'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit', '_bmad', 'runtime', 'hooks', 'governance-runtime-worker.cjs'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit', 'scripts', 'bmad-runtime-worker.js'),
  ];

  const resolvedModules = [
    tryResolveModule('bmad-speckit/_bmad/runtime/hooks/governance-runtime-worker.cjs', projectRoot),
    tryResolveModule('bmad-speckit/scripts/bmad-runtime-worker.js', projectRoot),
  ];

  for (const candidate of [...resolvedModules, ...candidates]) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * @param {string} projectRoot
 * @returns {WorkerSpawnPlan}
 */
function buildWorkerSpawnPlan(projectRoot) {
  const workerEntry = resolveWorkerEntry(projectRoot);
  if (!workerEntry) {
    throw new Error('bmad runtime worker entry not found');
  }
  return {
    command: process.execPath,
    args: [workerEntry, projectRoot],
    shell: false,
  };
}

/**
 * @param {string} projectRoot
 * @returns {GovernanceExecutionResult | null}
 */
function buildProcessingPlaceholderExecutionSummary(projectRoot) {
  const doneDir = governanceDoneQueueDir(projectRoot);
  const processingDir = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'governance',
    'queue',
    'processing'
  );

  const processingFiles = fs.existsSync(processingDir)
    ? fs.readdirSync(processingDir).filter((file) => file.endsWith('.json')).sort()
    : [];
  if (processingFiles.length === 0) {
    return null;
  }

  fs.mkdirSync(doneDir, { recursive: true });

  let executorRouting = buildExecutorRoutingPreview({ mode: 'generic', signals: [] });
  let journeyContractHints = [];
  let stopReason = null;
  let shouldContinue = false;
  for (const file of processingFiles) {
    const fullPath = path.join(processingDir, file);
    let parsed = null;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    } catch {
      continue;
    }
    const payload = parsed && typeof parsed.payload === 'object' ? parsed.payload : null;
    if (payload && Array.isArray(payload.journeyContractHints)) {
      journeyContractHints = payload.journeyContractHints;
      executorRouting = buildExecutorRoutingPreview(
        buildRerunDecision(projectRoot, journeyContractHints, true)
      );
    }
    const result = parsed && typeof parsed.result === 'object' ? parsed.result : null;
    if (result) {
      if (typeof result.stopReason === 'string') {
        stopReason = result.stopReason;
      }
      if (typeof result.shouldContinue === 'boolean') {
        shouldContinue = result.shouldContinue;
      }
      const resultRouting =
        result && typeof result.executorRouting === 'object' ? result.executorRouting : null;
      if (resultRouting && resultRouting.routingMode && resultRouting.executorRoute) {
        executorRouting = resultRouting;
      }
      if (Array.isArray(result.journeyContractHints) && result.journeyContractHints.length > 0) {
        journeyContractHints = result.journeyContractHints;
      }
      if (result && typeof result.remediationAuditTrace === 'object') {
        const trace = result.remediationAuditTrace;
        if (typeof trace.stopReason === 'string') {
          stopReason = trace.stopReason;
        }
      }
    }
    const donePath = path.join(doneDir, file);
    if (!fs.existsSync(donePath)) {
      fs.copyFileSync(fullPath, donePath);
    }
  }

  const remediationAuditTrace = buildFallbackRemediationAuditTrace(
    journeyContractHints,
    executorRouting,
    stopReason
  );
  const runnerSummaryLines = buildRunnerSummaryLinesFromExecutionSummary({
    loopStateId: null,
    currentAttemptNumber: null,
    nextAttemptNumber: null,
    shouldContinue,
    stopReason,
    artifactPath: null,
    packetPaths: {},
    remediationAuditTrace,
  });

  return {
    shouldContinue,
    stopReason,
    loopStateId: null,
    currentAttemptNumber: null,
    nextAttemptNumber: null,
    artifactPath: null,
    packetPaths: {},
    executorRouting,
    journeyContractHints,
    remediationAuditTrace,
    runnerSummaryLines,
    governancePresentation: buildGovernanceRunnerCliPresentation({
      shouldContinue,
      stopReason,
      loopStateId: null,
      currentAttemptNumber: null,
      nextAttemptNumber: null,
      artifactPath: null,
      packetPaths: {},
      executorRouting,
      runnerSummaryLines,
    }),
  };
}

/**
 * @param {string} projectRoot
 * @returns {GovernanceRunnerLockSnapshot | null}
 */
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

/**
 * @param {string} projectRoot
 * @param {GovernanceRunnerLockSnapshot} lockPayload
 * @returns {GovernanceRunnerLockSnapshot}
 */
function writeRunnerLock(projectRoot, lockPayload) {
  const lockPath = governanceRunnerLockPath(projectRoot);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify(lockPayload, null, 2) + '\n', 'utf8');
  return lockPayload;
}

/**
 * @param {number | null | undefined} pid
 * @returns {boolean}
 */
function isProcessAlive(pid) {
  const normalizedPid = typeof pid === 'number' && Number.isInteger(pid) ? pid : null;
  if (!normalizedPid || normalizedPid <= 0) {
    return false;
  }

  try {
    process.kill(normalizedPid, 0);
    return true;
  } catch (error) {
    return errorCode(error) !== 'ESRCH';
  }
}

/**
 * @param {string} projectRoot
 * @param {number} ownerPid
 * @param {Partial<GovernanceRunnerLockSnapshot>} [patch]
 * @returns {GovernanceRunnerLockSnapshot | null}
 */
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

/**
 * @param {string} projectRoot
 * @returns {{
 *   cleared: boolean;
 *   lockPath: string;
 *   reason?: string;
 *   lock?: GovernanceRunnerLockSnapshot;
 *   staleLock?: GovernanceRunnerLockSnapshot;
 *   staleReason?: string;
 * }}
 */
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

/**
 * @param {string} projectRoot
 * @returns {GovernanceRunnerLockSnapshot | null}
 */
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

/**
 * @param {string} projectRoot
 * @returns {RunnerLockAttempt}
 */
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
      if (errorCode(error) !== 'EEXIST') {
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

/**
 * @param {string} projectRoot
 * @returns {boolean}
 */
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

/**
 * @param {string} projectRoot
 * @returns {SpawnSyncResult}
 */
function runActualWorker(projectRoot) {
  const plan = buildWorkerSpawnPlan(projectRoot);
  return spawnSync(plan.command, plan.args, {
    cwd: projectRoot,
    env: { ...process.env, BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS: '1' },
    windowsHide: true,
    shell: plan.shell,
    encoding: 'utf8',
    stdio: 'pipe',
    maxBuffer: 10 * 1024 * 1024,
  });
}

/**
 * @param {string} projectRoot
 * @returns {boolean}
 */
function hasProcessingQueueItems(projectRoot) {
  const processingDir = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'governance',
    'queue',
    'processing'
  );
  return pendingJsonCount(processingDir) > 0;
}

/**
 * @param {string} projectRoot
 * @param {number} ownerPid
 * @returns {RunnerHeartbeatHandle}
 */
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

/**
 * @param {RunnerHeartbeatHandle | null | undefined} heartbeatHandle
 * @returns {boolean}
 */
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

/**
 * @param {GovernanceWorkerOptions} [options]
 * @returns {GovernanceWorkerResult}
 */
function runWorkerWithRunnerLock(options = {}) {
  const projectRoot = findProjectRoot(options.projectRoot);
  const pendingJourneyContractHints = collectPendingJourneyContractHints(projectRoot);
  const pendingQueueExists = hasPendingQueueItems(projectRoot);
  const rerunDecision = buildRerunDecision(
    projectRoot,
    pendingJourneyContractHints,
    pendingQueueExists
  );
  const onlyWhenPending = options.onlyWhenPending !== false;

  if (onlyWhenPending && !pendingQueueExists) {
    const processingSummary = hasProcessingQueueItems(projectRoot)
      ? buildProcessingPlaceholderExecutionSummary(projectRoot)
      : null;
    if (processingSummary) {
      return {
        started: false,
        skipped: false,
        projectRoot,
        reason: 'governance worker already processing queue items',
        lockPath: governanceRunnerLockPath(projectRoot),
        pendingJourneyContractHints,
        rerunDecision,
        shouldContinue: processingSummary.shouldContinue,
        stopReason: processingSummary.stopReason,
        executorRouting: processingSummary.executorRouting,
        remediationAuditTrace: processingSummary.remediationAuditTrace,
        runnerSummaryLines: processingSummary.runnerSummaryLines,
        governancePresentation: processingSummary.governancePresentation,
        status: 0,
      };
    }
    return {
      started: false,
      skipped: true,
      projectRoot,
      reason: 'no pending queue items',
      lockPath: governanceRunnerLockPath(projectRoot),
      pendingJourneyContractHints,
      rerunDecision,
      executorRouting: buildExecutorRoutingPreview(rerunDecision),
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
      pendingJourneyContractHints,
      rerunDecision,
      executorRouting: buildExecutorRoutingPreview(rerunDecision),
    };
  }

  let heartbeatHandle = null;
  try {
    heartbeatHandle = startRunnerLockHeartbeat(projectRoot, process.pid);
    const result = runActualWorker(projectRoot);
    const executionSummary =
      result.status === 0 ? readLatestGovernanceExecutionSummaryWithRetry(projectRoot) : null;
    return {
      started: true,
      skipped: false,
      wait: true,
      projectRoot,
      lockPath: lockAttempt.lockPath,
      status: result.status === null ? 1 : result.status,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      pendingJourneyContractHints,
      rerunDecision,
      shouldContinue: executionSummary ? executionSummary.shouldContinue : undefined,
      stopReason: executionSummary ? executionSummary.stopReason : undefined,
      executorRouting: executionSummary
        ? executionSummary.executorRouting
        : buildExecutorRoutingPreview(rerunDecision),
      runnerSummaryLines: executionSummary
        ? executionSummary.runnerSummaryLines
        : buildRunnerSummaryLinesFromExecutionSummary({
            loopStateId: null,
            currentAttemptNumber: null,
            nextAttemptNumber: null,
            shouldContinue: false,
            stopReason: null,
            artifactPath: null,
            packetPaths: {},
            remediationAuditTrace: buildFallbackRemediationAuditTrace(
              pendingJourneyContractHints,
              buildExecutorRoutingPreview(rerunDecision),
              null
            ),
          }),
      governancePresentation: executionSummary
        ? executionSummary.governancePresentation
        : buildGovernanceRunnerCliPresentation({
            shouldContinue: false,
            stopReason: null,
            loopStateId: null,
            currentAttemptNumber: null,
            nextAttemptNumber: null,
            artifactPath: null,
            packetPaths: {},
            executorRouting: buildExecutorRoutingPreview(rerunDecision),
            runnerSummaryLines: buildRunnerSummaryLinesFromExecutionSummary({
              loopStateId: null,
              currentAttemptNumber: null,
              nextAttemptNumber: null,
              shouldContinue: false,
              stopReason: null,
              artifactPath: null,
              packetPaths: {},
              remediationAuditTrace: buildFallbackRemediationAuditTrace(
                pendingJourneyContractHints,
                buildExecutorRoutingPreview(rerunDecision),
                null
              ),
            }),
          }),
      remediationAuditTrace: executionSummary
        ? executionSummary.remediationAuditTrace
        : buildFallbackRemediationAuditTrace(
            pendingJourneyContractHints,
            buildExecutorRoutingPreview(rerunDecision),
            null
          ),
    };
  } finally {
    stopRunnerLockHeartbeat(heartbeatHandle);
    releaseRunnerLock(projectRoot);
  }
}

/**
 * @param {GovernanceWorkerOptions} [options]
 * @returns {GovernanceWorkerResult}
 */
function runBmadRuntimeWorker(options = {}) {
  const projectRoot = findProjectRoot(options.projectRoot);
  const wait = options.wait !== false;
  const onlyWhenPending = options.onlyWhenPending !== false;
  const pendingJourneyContractHints = collectPendingJourneyContractHints(projectRoot);
  const pendingQueueExists = hasPendingQueueItems(projectRoot);
  const rerunDecision = buildRerunDecision(
    projectRoot,
    pendingJourneyContractHints,
    pendingQueueExists
  );

  if (onlyWhenPending && !pendingQueueExists) {
    return {
      started: false,
      skipped: true,
      projectRoot,
      reason: 'no pending queue items',
      lockPath: governanceRunnerLockPath(projectRoot),
      pendingJourneyContractHints,
      rerunDecision,
      executorRouting: buildExecutorRoutingPreview(rerunDecision),
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
      pendingJourneyContractHints,
      rerunDecision,
      executorRouting: buildExecutorRoutingPreview(rerunDecision),
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
    pendingJourneyContractHints,
    rerunDecision,
    executorRouting: buildExecutorRoutingPreview(rerunDecision),
  };
}

/**
 * @param {string[]} args
 * @param {string} flag
 * @returns {string | undefined}
 */
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
  collectPendingJourneyContractHints,
  buildRerunDecision,
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
    if (
      result.governancePresentation &&
      Array.isArray(result.governancePresentation.combinedLines) &&
      result.governancePresentation.combinedLines.length > 0
    ) {
      process.stdout.write(`${result.governancePresentation.combinedLines.join('\n')}\n`);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    process.exit(result.status === 0 || result.skipped ? 0 : result.status || 1);
  }
}
