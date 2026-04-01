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

  const printable = { ...payload };
  delete printable._foregroundServer;
  console.log(JSON.stringify(printable, null, 2));

  if (payload._foregroundServer) {
    await new Promise((resolve) => {
      const shutdown = async () => {
        try {
          await payload._foregroundServer.close();
        } catch {}
        resolve();
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
    });
  }
}

module.exports = { dashboardStartCommand };
