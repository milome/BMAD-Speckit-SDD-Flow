const fs = require('node:fs');
const path = require('node:path');

const SERVER_STATE_DIR = path.join('outputs', 'runtime', 'runtime-dashboard');
const SERVER_STATE_FILE = 'server.json';

function getServerStateDir(root) {
  return path.join(root, SERVER_STATE_DIR);
}

function getServerStatePath(root) {
  return path.join(getServerStateDir(root), SERVER_STATE_FILE);
}

function ensureServerStateDir(root) {
  fs.mkdirSync(getServerStateDir(root), { recursive: true });
}

function readServerState(root) {
  const statePath = getServerStatePath(root);
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeServerState(root, payload) {
  ensureServerStateDir(root);
  const statePath = getServerStatePath(root);
  fs.writeFileSync(statePath, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  return statePath;
}

function clearServerState(root) {
  const statePath = getServerStatePath(root);
  if (fs.existsSync(statePath)) {
    fs.rmSync(statePath, { force: true });
  }
}

module.exports = {
  SERVER_STATE_DIR,
  SERVER_STATE_FILE,
  getServerStateDir,
  getServerStatePath,
  ensureServerStateDir,
  readServerState,
  writeServerState,
  clearServerState,
};
