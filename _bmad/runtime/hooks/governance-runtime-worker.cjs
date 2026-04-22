#!/usr/bin/env node
'use strict';

const path = require('node:path');

function resolvePackagedWorker(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'node_modules', '@bmad-speckit', 'runtime-emit', 'dist', 'governance-runtime-worker.cjs'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit', 'node_modules', '@bmad-speckit', 'runtime-emit', 'dist', 'governance-runtime-worker.cjs'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit-sdd-flow', 'node_modules', '@bmad-speckit', 'runtime-emit', 'dist', 'governance-runtime-worker.cjs'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit-sdd-flow', 'packages', 'bmad-speckit', 'node_modules', '@bmad-speckit', 'runtime-emit', 'dist', 'governance-runtime-worker.cjs'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit-sdd-flow', 'packages', 'runtime-emit', 'dist', 'governance-runtime-worker.cjs'),
  ];

  for (const candidate of candidates) {
    if (!candidate || !require('node:fs').existsSync(candidate)) continue;
    if (path.resolve(candidate) === path.resolve(__filename)) continue;
    return require(candidate);
  }

  return null;
}

async function processQueue(projectRoot = process.cwd()) {
  const workerModule = resolvePackagedWorker(projectRoot);
  if (!workerModule || typeof workerModule.processQueue !== 'function') {
    throw new Error('governance runtime worker module not found via packaged CJS path');
  }
  return workerModule.processQueue(projectRoot);
}

module.exports = {
  processQueue,
};

if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd();
  Promise.resolve(processQueue(projectRoot)).catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
