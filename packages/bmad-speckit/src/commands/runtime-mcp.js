const { runRuntimeMcpServer } = require('@bmad-speckit/scoring/dashboard');

async function runtimeMcpCommand(opts) {
  await runRuntimeMcpServer({
    root: process.cwd(),
    dataPath: opts.dataPath,
    host: opts.host,
    dashboardUrl: opts.dashboardUrl,
    dashboardPort:
      opts.dashboardPort != null ? Number(opts.dashboardPort) : undefined,
  });
}

module.exports = { runtimeMcpCommand };
