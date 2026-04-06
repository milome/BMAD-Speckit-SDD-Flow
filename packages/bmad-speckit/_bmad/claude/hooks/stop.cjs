#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceStopHookResult} GovernanceStopHookResult
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceWorkerResult} GovernanceWorkerResult
 */

const fs = require('node:fs');
const path = require('node:path');

function resolvePresenterModule() {
  const candidates = [
    path.join(__dirname, 'governance-runner-summary-presenter.cjs'),
    path.join(__dirname, '..', '..', 'runtime', 'hooks', 'governance-runner-summary-presenter.cjs'),
    path.join(__dirname, '..', '..', '_bmad', 'runtime', 'hooks', 'governance-runner-summary-presenter.cjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  throw new Error('Cannot resolve governance-runner-summary-presenter.cjs from known hook locations');
}

const {
  printGovernanceRunnerCliPresentation,
} = resolvePresenterModule();

function resolveRuntimeWorkerHelper() {
  const candidates = [
    path.join(__dirname, 'run-bmad-runtime-worker.cjs'),
    path.join(__dirname, '..', '..', 'runtime', 'hooks', 'run-bmad-runtime-worker.cjs'),
    path.join(__dirname, '..', '..', '_bmad', 'runtime', 'hooks', 'run-bmad-runtime-worker.cjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  return null;
}

/**
 * @param {GovernanceWorkerResult | null | undefined} workerResult
 * @returns {GovernanceWorkerResult | null | undefined}
 */
function normalizeWorkerResult(workerResult) {
  if (!workerResult || typeof workerResult !== 'object') {
    return workerResult;
  }

  const journeyContractHints = Array.isArray(workerResult.journeyContractHints)
    ? workerResult.journeyContractHints
    : Array.isArray(workerResult.pendingJourneyContractHints)
      ? workerResult.pendingJourneyContractHints
      : undefined;
  const { pendingJourneyContractHints, ...rest } = workerResult;
  void pendingJourneyContractHints;

  return {
    ...rest,
    ...(journeyContractHints ? { journeyContractHints } : {}),
    ...(typeof workerResult.shouldContinue === 'boolean'
      ? { shouldContinue: workerResult.shouldContinue }
      : {}),
    stopReason: workerResult.stopReason !== undefined ? workerResult.stopReason : null,
    ...(workerResult.executorRouting ? { executorRouting: workerResult.executorRouting } : {}),
    ...(workerResult.remediationAuditTrace
      ? { remediationAuditTrace: workerResult.remediationAuditTrace }
      : {}),
    ...(workerResult.governancePresentation
      ? { governancePresentation: workerResult.governancePresentation }
      : {}),
  };
}

/**
 * @param {GovernanceWorkerResult | null | undefined} workerResult
 * @returns {void}
 */
function logRemediationAuditTrace(workerResult) {
  const presentation =
    workerResult &&
    workerResult.governancePresentation &&
    typeof workerResult.governancePresentation === 'object'
      ? workerResult.governancePresentation
      : null;
  if (presentation && Array.isArray(presentation.combinedLines) && presentation.combinedLines.length > 0) {
    printGovernanceRunnerCliPresentation(presentation, console.log);
    return;
  }

  const runnerSummaryLines =
    workerResult && Array.isArray(workerResult.runnerSummaryLines) ? workerResult.runnerSummaryLines : [];
  if (runnerSummaryLines.length > 0) {
    for (const line of runnerSummaryLines) {
      console.log(line);
    }
    return;
  }

  const trace =
    workerResult && workerResult.remediationAuditTrace && typeof workerResult.remediationAuditTrace === 'object'
      ? workerResult.remediationAuditTrace
      : null;
  const summaryLines = trace && Array.isArray(trace.summaryLines) ? trace.summaryLines : [];
  if (summaryLines.length === 0) {
    return;
  }

  for (const line of summaryLines) {
    console.log(line);
  }
}

/**
 * @param {{ projectRoot?: string; waitForWorker?: boolean }} [options]
 * @returns {GovernanceStopHookResult}
 */
function stop(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || process.cwd());
  const checkpointDir = path.join(projectRoot, '.claude', 'state', 'runtime', 'checkpoints');
  const checkpointPath = path.join(checkpointDir, 'latest.md');

  const timestamp = new Date().toISOString();
  const checkpoint = `# BMAD Checkpoint
Generated: ${timestamp}

## Session End
`;

  fs.mkdirSync(checkpointDir, { recursive: true });
  fs.writeFileSync(checkpointPath, checkpoint, 'utf8');

  let workerResult = null;
  const helper = resolveRuntimeWorkerHelper();
  if (helper && typeof helper.runBmadRuntimeWorker === 'function') {
    workerResult = normalizeWorkerResult(helper.runBmadRuntimeWorker({
      projectRoot,
      wait: options.waitForWorker !== false,
      onlyWhenPending: true,
    }));
  }

  console.log('[BMAD] Checkpoint saved');
  if (workerResult && workerResult.started && !workerResult.skipped) {
    console.log('[BMAD] Runtime worker triggered');
    logRemediationAuditTrace(workerResult);
  }

  return {
    checkpointPath,
    workerResult,
  };
}

if (require.main === module) {
  stop();
}

module.exports = { stop };
