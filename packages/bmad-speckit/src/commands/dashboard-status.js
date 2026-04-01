const path = require('node:path');

function loadLauncher() {
  const root = process.cwd();
  try {
    return require(path.resolve(root, 'scripts', 'start-runtime-dashboard-server.cjs'));
  } catch {
    return require(path.resolve(__dirname, '..', '..', '..', '..', 'scripts', 'start-runtime-dashboard-server.cjs'));
  }
}

async function dashboardStatusCommand() {
  const { getRuntimeDashboardStatus, checkHealth } = loadLauncher();
  const payload = getRuntimeDashboardStatus(process.cwd());
  if (payload.health_url) {
    payload.healthy = await checkHealth(payload.health_url);
  } else {
    payload.healthy = false;
  }
  console.log(JSON.stringify(payload, null, 2));
}

module.exports = { dashboardStatusCommand };
