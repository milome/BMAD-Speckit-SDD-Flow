#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceStopHookResult} GovernanceStopHookResult
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceWorkerResult} GovernanceWorkerResult
 */

const fs = require('node:fs');
const path = require('node:path');

function governanceLogPath(projectRoot) {
  return path.join(projectRoot, '.claude', 'state', 'runtime', 'governance-hook.log');
}

function appendGovernanceLog(projectRoot, message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  try {
    fs.mkdirSync(path.dirname(governanceLogPath(projectRoot)), { recursive: true });
    fs.appendFileSync(governanceLogPath(projectRoot), `${line}\n`, 'utf8');
  } catch {
    // ignore log write failures
  }
  console.log(line);
}

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
  buildGovernanceRunnerCliPresentation,
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

function resolvePacketHardCloseoutHelper() {
  const candidates = [
    path.join(__dirname, 'governance-packet-hard-closeout.cjs'),
    path.join(__dirname, '..', '..', 'runtime', 'hooks', 'governance-packet-hard-closeout.cjs'),
    path.join(__dirname, '..', '..', '_bmad', 'runtime', 'hooks', 'governance-packet-hard-closeout.cjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  return null;
}

/**
 * @param {import('../../../scripts/governance-hook-types').GovernanceJourneyContractHintProjection[] | null | undefined} journeyContractHints
 * @returns {import('../../../scripts/governance-hook-types').GovernanceExecutorRoutingProjection}
 */
function buildExecutorRoutingFromHints(journeyContractHints) {
  const normalizedHints = Array.isArray(journeyContractHints) ? journeyContractHints : [];
  const prioritizedSignals = [...new Set(normalizedHints
    .map((hint) => (hint && typeof hint.signal === 'string' ? hint.signal : null))
    .filter(Boolean))].sort();

  if (prioritizedSignals.length > 0) {
    return {
      routingMode: 'targeted',
      executorRoute: 'journey-contract-remediation',
      prioritizedSignals,
    };
  }

  return {
    routingMode: 'generic',
    executorRoute: 'default-gate-remediation',
    prioritizedSignals: [],
  };
}

/**
 * @param {import('../../../scripts/governance-hook-types').GovernanceJourneyContractHintProjection[] | null | undefined} journeyContractHints
 * @returns {string}
 */
function renderJourneyContractSignals(journeyContractHints) {
  return [...new Set((Array.isArray(journeyContractHints) ? journeyContractHints : [])
    .map((hint) => (hint && typeof hint.signal === 'string' ? hint.signal : null))
    .filter(Boolean))].join(', ') || '(none)';
}

/**
 * @param {string[] | null | undefined} lines
 * @param {string} prefix
 * @param {string} value
 * @returns {string[]}
 */
function upsertSummaryLine(lines, prefix, value) {
  const nextLines = Array.isArray(lines) ? [...lines] : [];
  const renderedLine = `${prefix}${value}`;
  const existingIndex = nextLines.findIndex(
    (line) => typeof line === 'string' && line.startsWith(prefix)
  );
  if (existingIndex >= 0) {
    nextLines[existingIndex] = renderedLine;
    return nextLines;
  }
  nextLines.push(renderedLine);
  return nextLines;
}

/**
 * @param {import('../../../scripts/governance-hook-types').GovernanceWorkerResult} workerResult
 * @param {import('../../../scripts/governance-hook-types').GovernanceJourneyContractHintProjection[] | undefined} journeyContractHints
 * @param {import('../../../scripts/governance-hook-types').GovernanceExecutorRoutingProjection} executorRouting
 * @param {string | null} stopReason
 * @returns {import('../../../scripts/governance-hook-types').GovernanceRemediationAuditTrace}
 */
function buildNormalizedRemediationAuditTrace(
  workerResult,
  journeyContractHints,
  executorRouting,
  stopReason
) {
  const artifactPath =
    (workerResult.remediationAuditTrace &&
      typeof workerResult.remediationAuditTrace.artifactPath === 'string' &&
      workerResult.remediationAuditTrace.artifactPath) ||
    (typeof workerResult.artifactPath === 'string' ? workerResult.artifactPath : null);
  const summaryLines = [
    `Routing Mode: ${executorRouting.routingMode || '(unknown)'}`,
    `Executor Route: ${executorRouting.executorRoute || '(unknown)'}`,
    `Stop Reason: ${stopReason || '(none)'}`,
    `Journey Contract Signals: ${renderJourneyContractSignals(journeyContractHints)}`,
  ];

  return {
    artifactPath,
    stopReason,
    journeyContractHints,
    routingMode: executorRouting.routingMode,
    executorRoute: executorRouting.executorRoute,
    prioritizedSignals: Array.isArray(executorRouting.prioritizedSignals)
      ? executorRouting.prioritizedSignals
      : [],
    summaryLines,
  };
}

/**
 * @param {import('../../../scripts/governance-hook-types').GovernanceWorkerResult} workerResult
 * @param {import('../../../scripts/governance-hook-types').GovernanceRemediationAuditTrace} remediationAuditTrace
 * @returns {string[]}
 */
function buildNormalizedRunnerSummaryLines(workerResult, remediationAuditTrace) {
  let lines = Array.isArray(workerResult.runnerSummaryLines)
    ? workerResult.runnerSummaryLines.filter((line) => typeof line === 'string')
    : [];

  if (lines.length === 0) {
    lines = [
      '## Governance Remediation Runner Summary',
      `- Loop State ID: ${workerResult.loopStateId || '(none)'}`,
      `- Current Attempt Number: ${
        workerResult.currentAttemptNumber !== undefined && workerResult.currentAttemptNumber !== null
          ? workerResult.currentAttemptNumber
          : '(none)'
      }`,
      `- Next Attempt Number: ${
        workerResult.nextAttemptNumber !== undefined && workerResult.nextAttemptNumber !== null
          ? workerResult.nextAttemptNumber
          : '(none)'
      }`,
      `- Should Continue: ${
        workerResult.shouldContinue === true
          ? 'yes'
          : workerResult.shouldContinue === false
            ? 'no'
            : '(unknown)'
      }`,
      `- Stop Reason: ${remediationAuditTrace.stopReason || '(none)'}`,
      `- Artifact Path: ${remediationAuditTrace.artifactPath || '(none)'}`,
      `- Executor Packet: ${
        workerResult.packetPaths && Object.keys(workerResult.packetPaths).length > 0 ? 'yes' : 'no'
      }`,
      '',
      '## Loop State Trace Summary',
    ];
  }

  if (!lines.includes('## Governance Remediation Runner Summary')) {
    lines.unshift('## Governance Remediation Runner Summary');
  }
  if (!lines.includes('## Loop State Trace Summary')) {
    lines.push('', '## Loop State Trace Summary');
  }

  lines = upsertSummaryLine(lines, '- Routing Mode: ', remediationAuditTrace.routingMode || '(unknown)');
  lines = upsertSummaryLine(
    lines,
    '- Executor Route: ',
    remediationAuditTrace.executorRoute || '(unknown)'
  );
  lines = upsertSummaryLine(lines, '- Stop Reason: ', remediationAuditTrace.stopReason || '(none)');
  lines = upsertSummaryLine(
    lines,
    '- Journey Contract Signals: ',
    renderJourneyContractSignals(remediationAuditTrace.journeyContractHints)
  );

  return lines;
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
  const executorRouting =
    workerResult.executorRouting || buildExecutorRoutingFromHints(journeyContractHints);
  const stopReason =
    workerResult.stopReason !== undefined && workerResult.stopReason !== null
      ? workerResult.stopReason
      : null;
  const remediationAuditTrace = buildNormalizedRemediationAuditTrace(
    workerResult,
    journeyContractHints,
    executorRouting,
    stopReason
  );
  const runnerSummaryLines = buildNormalizedRunnerSummaryLines(
    workerResult,
    remediationAuditTrace
  );
  const governancePresentation = buildGovernanceRunnerCliPresentation({
    ...workerResult,
    ...(journeyContractHints ? { journeyContractHints } : {}),
    stopReason,
    executorRouting,
    remediationAuditTrace,
    runnerSummaryLines,
  });
  const { pendingJourneyContractHints, ...rest } = workerResult;
  void pendingJourneyContractHints;

  return {
    ...rest,
    ...(journeyContractHints ? { journeyContractHints } : {}),
    ...(typeof workerResult.shouldContinue === 'boolean'
      ? { shouldContinue: workerResult.shouldContinue }
      : {}),
    stopReason,
    executorRouting,
    remediationAuditTrace,
    runnerSummaryLines,
    governancePresentation,
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

  appendGovernanceLog(projectRoot, '[BMAD] Checkpoint saved');
  if (workerResult && workerResult.started && !workerResult.skipped) {
    appendGovernanceLog(projectRoot, '[BMAD] Runtime worker triggered');
    logRemediationAuditTrace(workerResult);
  } else if (workerResult && workerResult.skipped) {
    appendGovernanceLog(
      projectRoot,
      `[Runtime Governance] stop hook skipped worker reason=${workerResult.reason || 'unknown'}`
    );
  } else if (!helper) {
    appendGovernanceLog(
      projectRoot,
      '[Runtime Governance] stop hook worker helper unavailable'
    );
  }

  const packetHardCloseout = resolvePacketHardCloseoutHelper();
  if (
    packetHardCloseout &&
    typeof packetHardCloseout.normalizeRecentReadinessArtifacts === 'function'
  ) {
    const normalization = packetHardCloseout.normalizeRecentReadinessArtifacts(projectRoot);
    if (normalization && normalization.normalized) {
      appendGovernanceLog(
        projectRoot,
        `[Runtime Governance] stop hook normalized readiness packets count=${normalization.count}`
      );
    }
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
