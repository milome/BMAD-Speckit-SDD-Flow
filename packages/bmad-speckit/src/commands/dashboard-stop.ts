const path = require('node:path');

function loadLauncher() {
  const root = process.cwd();
  try {
    return require(path.resolve(root, 'scripts', 'start-runtime-dashboard-server.cjs'));
  } catch {
    return require(path.resolve(__dirname, '..', '..', '..', '..', 'scripts', 'start-runtime-dashboard-server.cjs'));
  }
}

async function dashboardStopCommand() {
  const { stopServerByState, getRuntimeDashboardStatus } = loadLauncher();
  const before = getRuntimeDashboardStatus(process.cwd());
  stopServerByState(process.cwd());
  console.log(JSON.stringify({
    mode: 'stopped',
    previous: before,
  }, null, 2));
}

module.exports = { dashboardStopCommand };
