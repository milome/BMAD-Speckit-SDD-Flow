#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
    workerResult = helper.runBmadRuntimeWorker({
      projectRoot,
      wait: options.waitForWorker !== false,
      onlyWhenPending: true,
    });
  }

  console.log('[BMAD] Checkpoint saved');
  if (workerResult && workerResult.started && !workerResult.skipped) {
    console.log('[BMAD] Runtime worker triggered');
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
