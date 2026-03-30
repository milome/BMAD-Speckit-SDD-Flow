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

async function runtimeMcpCommand(opts) {
  const serverPromise = dashboardModule.runRuntimeMcpServer({
    root: process.cwd(),
    dataPath: opts.dataPath,
    host: opts.host,
    dashboardUrl: opts.dashboardUrl,
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
