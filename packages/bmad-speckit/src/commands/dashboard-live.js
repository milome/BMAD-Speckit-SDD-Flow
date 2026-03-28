const { startLiveDashboardServer } = require('@bmad-speckit/scoring/dashboard');

async function dashboardLiveCommand(opts) {
  const server = await startLiveDashboardServer({
    root: process.cwd(),
    dataPath: opts.dataPath,
    host: opts.host,
    port: opts.port != null ? Number(opts.port) : undefined,
  });

  // eslint-disable-next-line no-console -- CLI contract
  console.log(server.url);

  await new Promise((resolve) => {
    const shutdown = async () => {
      await server.close();
      resolve();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}

module.exports = { dashboardLiveCommand };
