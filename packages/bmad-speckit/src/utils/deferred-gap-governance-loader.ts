const fs = require('node:fs');
const { resolvePackageOwnedBmadPath } = require('../main-agent/runtime/package-bmad-root');

function resolveDeferredGapGovernancePath() {
  const candidates = [
    resolvePackageOwnedBmadPath('runtime', 'hooks', 'deferred-gap-governance.cjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'deferred-gap-governance loader: installed package _bmad owner is missing runtime hook'
  );
}

function loadDeferredGapGovernance() {
  return require(resolveDeferredGapGovernancePath());
}

module.exports = {
  resolveDeferredGapGovernancePath,
  loadDeferredGapGovernance,
};
