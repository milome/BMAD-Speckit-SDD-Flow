const fs = require('node:fs');
const path = require('node:path');

function repoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function workspaceScoringRoot() {
  return path.join(repoRoot(), 'packages', 'scoring', 'dist');
}

function resolveWorkspaceModule(subpath) {
  const resolved = path.join(workspaceScoringRoot(), ...subpath.split('/'));
  const filePath = resolved.endsWith('.json') || resolved.endsWith('.js') ? resolved : `${resolved}.js`;
  return fs.existsSync(filePath) ? filePath : null;
}

function loadScoringModule(subpath) {
  const workspacePath = resolveWorkspaceModule(subpath);
  if (workspacePath) {
    return require(workspacePath);
  }
  return require(`@bmad-speckit/scoring/${subpath}`);
}

module.exports = {
  loadScoringModule,
  repoRoot,
  workspaceScoringRoot,
};
