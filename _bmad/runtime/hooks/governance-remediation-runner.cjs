#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolvePackagedRunner(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'node_modules', '@bmad-speckit', 'runtime-emit', 'dist', 'governance-remediation-runner.cjs'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit', 'node_modules', '@bmad-speckit', 'runtime-emit', 'dist', 'governance-remediation-runner.cjs'),
    path.join(projectRoot, 'node_modules', 'bmad-speckit-sdd-flow', 'packages', 'runtime-emit', 'dist', 'governance-remediation-runner.cjs'),
  ];

  for (const candidate of candidates) {
    if (!candidate || !fs.existsSync(candidate)) continue;
    try {
      if (path.resolve(candidate) === path.resolve(__filename)) {
        continue;
      }
      return require(candidate);
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function runGovernanceRemediation(input) {
  const projectRoot = input && typeof input.projectRoot === 'string' ? input.projectRoot : process.cwd();
  const runnerModule = resolvePackagedRunner(projectRoot);
  if (!runnerModule || typeof runnerModule.runGovernanceRemediation !== 'function') {
    throw new Error('governance remediation runner module not found via packaged/local CJS path');
  }
  return runnerModule.runGovernanceRemediation(input);
}

module.exports = {
  runGovernanceRemediation,
};
