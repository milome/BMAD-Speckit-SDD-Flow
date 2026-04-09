#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceBackgroundTrigger} GovernanceBackgroundTrigger
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceExecutorRoutingProjection} GovernanceExecutorRoutingProjection
 * @typedef {import('../../../scripts/governance-hook-types').GovernanceJourneyContractHintProjection} GovernanceJourneyContractHintProjection
 * @typedef {import('../../../scripts/governance-hook-types').GovernancePostToolUseResult} GovernancePostToolUseResult
 *
 * @typedef {{
 *   type?: string;
 *   payload?: {
 *     projectRoot?: string;
 *     runnerInput?: { projectRoot?: string };
 *     journeyContractHints?: GovernanceJourneyContractHintProjection[];
 *   };
 * }} GovernanceRerunEventLike
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
  try {
    process.stdout.write(`${line}\n`);
  } catch {
    // ignore stdout failures
  }
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
} = resolvePresenterModule();

function resolveGovernanceQueueHelper() {
  const candidates = [
    path.join(__dirname, 'governance-rerun-queue.cjs'),
    path.join(__dirname, '..', '..', 'runtime', 'hooks', 'governance-rerun-queue.cjs'),
    path.join(__dirname, '..', '..', '_bmad', 'runtime', 'hooks', 'governance-rerun-queue.cjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  return null;
}

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
 * @returns {Promise<GovernanceRerunEventLike | null>}
 */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      if (!data.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    process.stdin.on('error', reject);
  });
}

/**
 * @param {GovernanceRerunEventLike | null | undefined} event
 * @returns {void}
 */
function recordHighValueEvent(event) {
  const highValueEvents = ['file-modified', 'audit-request', 'git-commit-attempt'];
  if (typeof event?.type !== 'string' || !highValueEvents.includes(event.type)) {
    return;
  }

  const eventsDir = path.join(process.cwd(), '.claude', 'state', 'runtime', 'events');
  fs.mkdirSync(eventsDir, { recursive: true });
  const eventPath = path.join(eventsDir, `${Date.now()}.json`);
  fs.writeFileSync(eventPath, JSON.stringify(event, null, 2) + '\n', 'utf8');
}

/**
 * @param {GovernanceRerunEventLike | null | undefined} event
 * @returns {string}
 */
function extractProjectRoot(event) {
  const payload = event && typeof event.payload === 'object' ? event.payload : null;
  const runnerInput =
    payload && payload.runnerInput && typeof payload.runnerInput === 'object'
      ? payload.runnerInput
      : null;

  if (runnerInput && typeof runnerInput.projectRoot === 'string' && runnerInput.projectRoot) {
    return runnerInput.projectRoot;
  }
  if (payload && typeof payload.projectRoot === 'string' && payload.projectRoot) {
    return payload.projectRoot;
  }
  return process.cwd();
}

/**
 * @param {GovernanceRerunEventLike | null | undefined} event
 * @returns {GovernanceJourneyContractHintProjection[]}
 */
function extractJourneyContractHints(event) {
  const payload = event && typeof event.payload === 'object' ? event.payload : null;
  return payload && Array.isArray(payload.journeyContractHints) ? payload.journeyContractHints : [];
}

/**
 * @param {GovernanceJourneyContractHintProjection[] | null | undefined} journeyContractHints
 * @returns {GovernanceExecutorRoutingProjection}
 */
function buildExecutorRoutingFromHints(journeyContractHints) {
  const normalizedHints = Array.isArray(journeyContractHints) ? journeyContractHints : [];
  const prioritizedSignals = [...new Set(normalizedHints
    .map((hint) => (hint && typeof hint.signal === 'string' ? hint.signal : null))
    .filter(Boolean))].sort();

  if (prioritizedSignals.length > 0) {
    return /** @type {GovernanceExecutorRoutingProjection} */ ({
      routingMode: 'targeted',
      executorRoute: 'journey-contract-remediation',
      prioritizedSignals,
    });
  }

  return /** @type {GovernanceExecutorRoutingProjection} */ ({
    routingMode: 'generic',
    executorRoute: 'default-gate-remediation',
    prioritizedSignals: [],
  });
}

/**
 * @param {GovernanceRerunEventLike | null | undefined} event
 * @returns {GovernanceExecutorRoutingProjection}
 */
function buildExecutorRoutingPreview(event) {
  return buildExecutorRoutingFromHints(extractJourneyContractHints(event));
}

/**
 * @param {GovernanceBackgroundTrigger | null | undefined} backgroundTrigger
 * @param {string} projectRoot
 * @param {GovernanceRerunEventLike | null | undefined} event
 * @returns {GovernanceBackgroundTrigger | null | undefined}
 */
function normalizeBackgroundTrigger(backgroundTrigger, projectRoot, event) {
  if (!backgroundTrigger || typeof backgroundTrigger !== 'object') {
    return backgroundTrigger;
  }

  const journeyContractHintsFromEvent = extractJourneyContractHints(event);
  const journeyContractHints = Array.isArray(backgroundTrigger.journeyContractHints)
    ? backgroundTrigger.journeyContractHints
    : Array.isArray(backgroundTrigger.pendingJourneyContractHints)
      ? backgroundTrigger.pendingJourneyContractHints
      : journeyContractHintsFromEvent;
  const executorRouting =
    backgroundTrigger.executorRouting || buildExecutorRoutingFromHints(journeyContractHints);
  const governancePresentation =
    backgroundTrigger.governancePresentation ||
    buildGovernanceRunnerCliPresentation({
      shouldContinue:
        typeof backgroundTrigger.shouldContinue === 'boolean'
          ? backgroundTrigger.shouldContinue
          : undefined,
      stopReason:
        backgroundTrigger.stopReason !== undefined ? backgroundTrigger.stopReason : null,
      loopStateId:
        typeof backgroundTrigger.loopStateId === 'string' ? backgroundTrigger.loopStateId : null,
      currentAttemptNumber:
        typeof backgroundTrigger.currentAttemptNumber === 'number'
          ? backgroundTrigger.currentAttemptNumber
          : null,
      nextAttemptNumber:
        typeof backgroundTrigger.nextAttemptNumber === 'number'
          ? backgroundTrigger.nextAttemptNumber
          : null,
      artifactPath:
        typeof backgroundTrigger.artifactPath === 'string' ? backgroundTrigger.artifactPath : null,
      packetPaths:
        backgroundTrigger.packetPaths && typeof backgroundTrigger.packetPaths === 'object'
          ? backgroundTrigger.packetPaths
          : {},
      executorRouting,
      runnerSummaryLines: Array.isArray(backgroundTrigger.runnerSummaryLines)
        ? backgroundTrigger.runnerSummaryLines
        : [],
    });
  const { pendingJourneyContractHints, ...rest } = backgroundTrigger;
  void pendingJourneyContractHints;

  return {
    ...rest,
    projectRoot:
      typeof rest.projectRoot === 'string' && rest.projectRoot ? rest.projectRoot : projectRoot,
    journeyContractHints,
    stopReason: backgroundTrigger.stopReason !== undefined ? backgroundTrigger.stopReason : null,
    executorRouting,
    governancePresentation,
  };
}

/**
 * @param {string} projectRoot
 * @param {GovernanceRerunEventLike | null | undefined} event
 * @returns {GovernanceBackgroundTrigger | null}
 */
function triggerDetachedBackgroundDrain(projectRoot, event) {
  const executorRouting = buildExecutorRoutingPreview(event);
  if (process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN === '1') {
    return {
      started: false,
      skipped: true,
      reason: 'disabled by BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN',
      projectRoot,
      executorRouting,
    };
  }

  const helper = resolveRuntimeWorkerHelper();
  if (!helper || typeof helper.runBmadRuntimeWorker !== 'function') {
    return null;
  }

  return helper.runBmadRuntimeWorker({
    projectRoot,
    wait: false,
    onlyWhenPending: true,
  });
}

/**
 * @param {GovernanceRerunEventLike | null | undefined} event
 * @returns {GovernancePostToolUseResult | null}
 */
function postToolUse(event) {
  if (!event || typeof event !== 'object') {
    return null;
  }

  recordHighValueEvent(event);
  const projectRoot = extractProjectRoot(event);
  const packetHardCloseout = resolvePacketHardCloseoutHelper();
  if (
    packetHardCloseout &&
    typeof packetHardCloseout.maybeNormalizeGovernancePackets === 'function'
  ) {
    const normalization = packetHardCloseout.maybeNormalizeGovernancePackets(projectRoot, event);
    if (normalization && normalization.normalized) {
      appendGovernanceLog(
        projectRoot,
        `[Runtime Governance] normalized readiness packets artifact=${normalization.artifactPath}`
      );
    }
  }

  if (event.type !== 'governance-rerun-result') {
    return null;
  }

  const helper = resolveGovernanceQueueHelper();
  if (!helper || typeof helper.enqueueGovernanceRerunEvent !== 'function') {
    return null;
  }

  const rerunGate =
    event.payload &&
    event.payload.runnerInput &&
    typeof event.payload.runnerInput.rerunGate === 'string'
      ? event.payload.runnerInput.rerunGate
      : 'unknown-gate';
  appendGovernanceLog(
    projectRoot,
    `[Runtime Governance] received rerun-result gate=${rerunGate}`
  );

  if (typeof helper.drainGovernanceStageEvents === 'function') {
    helper.drainGovernanceStageEvents(projectRoot);
  }

  const queuePath = helper.enqueueGovernanceRerunEvent(event);
  appendGovernanceLog(
    projectRoot,
    `[Runtime Governance] queued rerun event path=${queuePath}`
  );
  const backgroundTrigger = normalizeBackgroundTrigger(
    triggerDetachedBackgroundDrain(projectRoot, event),
    projectRoot,
    event
  );

  if (!backgroundTrigger) {
    appendGovernanceLog(
      projectRoot,
      '[Runtime Governance] worker helper unavailable; background drain not started'
    );
  } else if (backgroundTrigger.started) {
    appendGovernanceLog(
      projectRoot,
      `[Runtime Governance] background worker started pid=${backgroundTrigger.pid || 'unknown'}`
    );
  } else if (backgroundTrigger.skipped) {
    appendGovernanceLog(
      projectRoot,
      `[Runtime Governance] background worker skipped reason=${backgroundTrigger.reason || 'unknown'}`
    );
  }

  return {
    queuePath,
    projectRoot,
    backgroundTrigger,
  };
}

async function main() {
  const event = await readStdin();
  if (!event) {
    return;
  }
  postToolUse(event);
}

if (require.main === module) {
  void main().catch(() => process.exit(0));
}

module.exports = { postToolUse };
