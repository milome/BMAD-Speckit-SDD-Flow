#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function governanceQueueDir(projectRoot) {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'queue');
}

function governancePendingDir(projectRoot) {
  return path.join(governanceQueueDir(projectRoot), 'pending');
}

function governancePendingQueueFilePath(projectRoot, id) {
  return path.join(governancePendingDir(projectRoot), `${id}.json`);
}

function ensureGovernanceQueueDirs(projectRoot) {
  for (const bucket of ['pending', 'processing', 'done', 'failed']) {
    fs.mkdirSync(path.join(governanceQueueDir(projectRoot), bucket), { recursive: true });
  }
}

function makeQueueId() {
  return `gov-rerun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function enqueueGovernanceRerunEvent(event) {
  if (!event || event.type !== 'governance-rerun-result') {
    return null;
  }

  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  const runnerInput =
    payload.runnerInput && typeof payload.runnerInput === 'object' ? payload.runnerInput : {};
  const projectRoot =
    (typeof runnerInput.projectRoot === 'string' && runnerInput.projectRoot) ||
    (typeof payload.projectRoot === 'string' && payload.projectRoot) ||
    process.cwd();

  ensureGovernanceQueueDirs(projectRoot);

  const id = makeQueueId();
  const item = {
    id,
    type: 'governance-remediation-rerun',
    timestamp: new Date().toISOString(),
    payload: {
      projectRoot,
      ...(Array.isArray(payload.journeyContractHints) && payload.journeyContractHints.length > 0
        ? { journeyContractHints: payload.journeyContractHints }
        : {}),
      ...(typeof payload.configPath === 'string' && payload.configPath
        ? { configPath: payload.configPath }
        : {}),
      runnerInput: {
        ...runnerInput,
        projectRoot,
        rerunGateResult: runnerInput.rerunGateResult || payload.rerunGateResult || undefined,
      },
    },
  };

  const file = governancePendingQueueFilePath(projectRoot, id);
  fs.writeFileSync(file, JSON.stringify(item, null, 2) + '\n', 'utf8');
  return file;
}

module.exports = {
  enqueueGovernanceRerunEvent,
  ensureGovernanceQueueDirs,
  governancePendingDir,
  governancePendingQueueFilePath,
  governanceQueueDir,
};
