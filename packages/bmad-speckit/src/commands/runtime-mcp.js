const dashboardModule = (() => {
  try {
    const loaded = require('@bmad-speckit/scoring/dashboard');
    if (typeof loaded.runRuntimeMcpServer === 'function') {
      return loaded;
    }
  } catch {
    // fall through to dist fallback
  }
  return require('../../../scoring/dist/dashboard/index.js');
})();

const path = require('node:path');

function tryLoadLauncher() {
  try {
    return require(path.resolve(process.cwd(), 'scripts', 'start-runtime-dashboard-server.cjs'));
  } catch {
    return null;
  }
}

async function runtimeMcpCommand(opts) {
  let dashboardUrl = opts.dashboardUrl;
  const launcher = tryLoadLauncher();

  if (!dashboardUrl && launcher && opts.dashboardPort == null) {
    const payload = await launcher.startRuntimeDashboardServer({
      root: process.cwd(),
      dataPath: opts.dataPath,
      host: opts.host,
      port: 43124,
      open: false,
    });
    dashboardUrl = payload.url;
  }

  const serverPromise = dashboardModule.runRuntimeMcpServer({
    root: process.cwd(),
    dataPath: opts.dataPath,
    host: opts.host,
    dashboardUrl,
    dashboardPort:
      opts.dashboardPort != null ? Number(opts.dashboardPort) : undefined,
  });

  if (opts.dashboardPort != null && Number(opts.dashboardPort) === 0) {
    await serverPromise;
    return;
  }

  void serverPromise;
}

module.exports = { runtimeMcpCommand };
