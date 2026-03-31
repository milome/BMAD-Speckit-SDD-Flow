const path = require('node:path');

function loadLauncher() {
  const root = process.cwd();
  try {
    return require(path.resolve(root, 'scripts', 'start-runtime-dashboard-server.cjs'));
  } catch {
    return require(path.resolve(__dirname, '..', '..', '..', '..', 'scripts', 'start-runtime-dashboard-server.cjs'));
  }
}

async function dashboardStartCommand(opts) {
  const { startRuntimeDashboardServer } = loadLauncher();
  const payload = await startRuntimeDashboardServer({
    root: process.cwd(),
    dataPath: opts.dataPath,
    host: opts.host,
    port: opts.port != null ? Number(opts.port) : 0,
    open: Boolean(opts.open),
  });

  console.log(JSON.stringify(payload, null, 2));
}

module.exports = { dashboardStartCommand };
