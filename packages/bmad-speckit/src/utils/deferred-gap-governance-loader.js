const fs = require('node:fs');
const path = require('node:path');

function resolveDeferredGapGovernancePath() {
  const candidates = [
    path.resolve(__dirname, '..', '..', '_bmad', 'runtime', 'hooks', 'deferred-gap-governance.cjs'),
    path.resolve(__dirname, '..', '..', '..', '..', '_bmad', 'runtime', 'hooks', 'deferred-gap-governance.cjs'),
    path.resolve(process.cwd(), '_bmad', 'runtime', 'hooks', 'deferred-gap-governance.cjs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'deferred-gap-governance loader: cannot resolve _bmad/runtime/hooks/deferred-gap-governance.cjs from package-local or consumer project paths'
  );
}

function loadDeferredGapGovernance() {
  return require(resolveDeferredGapGovernancePath());
}

module.exports = {
  resolveDeferredGapGovernancePath,
  loadDeferredGapGovernance,
};
