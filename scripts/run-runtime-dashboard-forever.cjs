const fs = require('node:fs');
const path = require('node:path');
const {
  writeServerState,
  clearServerState,
  getServerStatePath,
} = require('./runtime-dashboard-server-state.cjs');

function loadDashboardModule(root) {
  const projectDist = path.join(root, 'packages', 'scoring', 'dist', 'dashboard', 'live-server.js');
  if (fs.existsSync(projectDist)) {
    return require(projectDist);
  }

  const packageDist = path.resolve(__dirname, '..', 'packages', 'scoring', 'dist', 'dashboard', 'live-server.js');
  if (fs.existsSync(packageDist)) {
    return require(packageDist);
  }

  throw new Error('runtime dashboard dist live-server.js not found; run build:scoring first');
}

const root = process.env.RUNTIME_DASHBOARD_ROOT || process.cwd();
const host = process.env.RUNTIME_DASHBOARD_HOST || '127.0.0.1';
const port = Number(process.env.RUNTIME_DASHBOARD_PORT || '43124');
const dataPath = process.env.RUNTIME_DASHBOARD_DATA_PATH || undefined;
const launchMode = process.env.RUNTIME_DASHBOARD_LAUNCH_MODE || 'started';

async function main() {
  const { startLiveDashboardServer } = loadDashboardModule(root);
  const server = await startLiveDashboardServer({ host, port, root, dataPath });
  const healthUrl = `${server.url}/health`;
  const statePath = writeServerState(root, {
    pid: process.pid,
    host,
    port: server.port,
    url: server.url,
    health_url: healthUrl,
    started_at: new Date().toISOString(),
    root,
    data_path: dataPath ?? null,
    mode: launchMode,
    state_path: getServerStatePath(root),
  });

  console.log(JSON.stringify({
    pid: process.pid,
    host,
    port: server.port,
    url: server.url,
    health_url: healthUrl,
    root,
    data_path: dataPath ?? null,
    mode: launchMode,
    state_path: statePath,
  }));

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await server.close();
    } catch {}
    clearServerState(root);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
