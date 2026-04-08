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

function readPendingGovernanceStageEvents(projectRoot) {
  const dir = path.join(governanceQueueDir(projectRoot), 'pending-events');
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((file) => ({
      filePath: path.join(dir, file),
      fileName: file,
    }));
}

function drainGovernanceStageEvents(projectRoot) {
  const emitted = [];
  for (const item of readPendingGovernanceStageEvents(projectRoot)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(item.filePath, 'utf8'));
      const queuePath = enqueueGovernanceRerunEvent(parsed);
      if (queuePath) {
        emitted.push(queuePath);
      }
      fs.rmSync(item.filePath, { force: true });
    } catch {
      // keep broken event file for inspection
    }
  }
  return emitted;
}

module.exports = {
  drainGovernanceStageEvents,
  enqueueGovernanceRerunEvent,
  ensureGovernanceQueueDirs,
  governancePendingDir,
  governancePendingQueueFilePath,
  governanceQueueDir,
};
