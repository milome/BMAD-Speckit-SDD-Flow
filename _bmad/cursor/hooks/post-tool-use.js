#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveGovernanceQueueHelper() {
  const candidates = [
    path.join(__dirname, 'governance-rerun-queue.js'),
    path.join(__dirname, '..', '..', 'runtime', 'hooks', 'governance-rerun-queue.js'),
    path.join(__dirname, '..', '..', '_bmad', 'runtime', 'hooks', 'governance-rerun-queue.js'),
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
    path.join(__dirname, 'run-bmad-runtime-worker.js'),
    path.join(__dirname, '..', '..', 'runtime', 'hooks', 'run-bmad-runtime-worker.js'),
    path.join(__dirname, '..', '..', '_bmad', 'runtime', 'hooks', 'run-bmad-runtime-worker.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  return null;
}

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

function triggerDetachedBackgroundDrain(projectRoot) {
  if (process.env.BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN === '1') {
    return {
      started: false,
      skipped: true,
      reason: 'disabled by BMAD_SKIP_GOVERNANCE_BACKGROUND_DRAIN',
      projectRoot,
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

function postToolUse(event) {
  if (!event || typeof event !== 'object' || event.type !== 'governance-rerun-result') {
    return null;
  }

  const helper = resolveGovernanceQueueHelper();
  if (!helper || typeof helper.enqueueGovernanceRerunEvent !== 'function') {
    return null;
  }

  const queuePath = helper.enqueueGovernanceRerunEvent(event);
  const projectRoot = extractProjectRoot(event);
  const backgroundTrigger = triggerDetachedBackgroundDrain(projectRoot);

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
