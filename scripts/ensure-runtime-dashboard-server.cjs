const path = require('node:path');

function loadLauncher(projectRoot) {
  const projectScript = path.join(projectRoot, 'scripts', 'start-runtime-dashboard-server.cjs');
  try {
    return require(projectScript);
  } catch {
    return require(path.resolve(__dirname, 'start-runtime-dashboard-server.cjs'));
  }
}

async function ensureRuntimeDashboardServer(options = {}) {
  const projectRoot = path.resolve(options.root || process.cwd());
  const { startRuntimeDashboardServer } = loadLauncher(projectRoot);

  const payload = await startRuntimeDashboardServer({
    root: projectRoot,
    host: options.host || process.env.RUNTIME_DASHBOARD_HOST || '127.0.0.1',
    port:
      options.port != null
        ? Number(options.port)
        : process.env.RUNTIME_DASHBOARD_PORT != null
          ? Number(process.env.RUNTIME_DASHBOARD_PORT)
          : 43124,
    dataPath: options.dataPath || process.env.RUNTIME_DASHBOARD_DATA_PATH || undefined,
    open: Boolean(options.open),
  });

  return payload;
}

async function cli() {
  const payload = await ensureRuntimeDashboardServer({
    root: process.cwd(),
    open: process.argv.includes('--open'),
  });
  console.log(JSON.stringify(payload, null, 2));
}

if (require.main === module) {
  cli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { ensureRuntimeDashboardServer };
