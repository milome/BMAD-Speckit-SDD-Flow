const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  readServerState,
  writeServerState,
  clearServerState,
  getServerStatePath,
} = require('./runtime-dashboard-server-state.cjs');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkHealth(url) {
  if (!url) return false;
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

function isPidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopServerByState(root) {
  const state = readServerState(root);
  if (state?.pid && isPidAlive(state.pid)) {
    try {
      process.kill(state.pid, 'SIGTERM');
    } catch {}
  }
  clearServerState(root);
}

function getRuntimeDashboardStatus(root) {
  const state = readServerState(root);
  if (!state) {
    return {
      ok: false,
      mode: 'stopped',
      state_path: getServerStatePath(root),
    };
  }

  return {
    ...state,
    ok: Boolean(state.health_url),
    alive: isPidAlive(state.pid),
    mode: 'status',
    state_path: getServerStatePath(root),
  };
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd.exe', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }

  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
}

function resolveForeverScript(root) {
  const projectScript = path.join(root, 'scripts', 'run-runtime-dashboard-forever.cjs');
  if (fs.existsSync(projectScript)) {
    return projectScript;
  }
  return path.resolve(__dirname, 'run-runtime-dashboard-forever.cjs');
}

async function waitForHealthyState(root, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = readServerState(root);
    if (state?.health_url && await checkHealth(state.health_url)) {
      return state;
    }
    await sleep(500);
  }
  throw new Error(`runtime dashboard server did not become healthy within ${timeoutMs}ms`);
}

async function startRuntimeDashboardServer(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const host = options.host || '127.0.0.1';
  const requestedPort = options.port != null ? Number(options.port) : 43124;
  const dataPath = options.dataPath ? path.resolve(options.dataPath) : undefined;
  const open = Boolean(options.open);
  const timeoutMs = Number(options.timeoutMs || 15000);

  const existing = readServerState(root);
  if (existing && isPidAlive(existing.pid) && await checkHealth(existing.health_url || `${existing.url}/health`)) {
    const payload = { ...existing, mode: 'reused', state_path: getServerStatePath(root) };
    writeServerState(root, payload);
    if (open) openBrowser(payload.url);
    return payload;
  }

  if (existing) {
    clearServerState(root);
  }

  const child = spawn(process.execPath, [resolveForeverScript(root)], {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: {
      ...process.env,
      RUNTIME_DASHBOARD_ROOT: root,
      RUNTIME_DASHBOARD_HOST: host,
      RUNTIME_DASHBOARD_PORT: String(requestedPort),
      RUNTIME_DASHBOARD_DATA_PATH: dataPath || '',
      RUNTIME_DASHBOARD_LAUNCH_MODE: existing ? 'restarted' : 'started',
    },
  });

  let startupStdout = '';
  let startupStderr = '';
  child.stdout?.on('data', (chunk) => {
    startupStdout += String(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    startupStderr += String(chunk);
  });
  child.unref();

  let healthyState;
  try {
    healthyState = await waitForHealthyState(root, timeoutMs);
  } catch (error) {
    throw new Error(`${error.message}\nstdout: ${startupStdout}\nstderr: ${startupStderr}`);
  }
  const payload = {
    ...healthyState,
    pid: healthyState.pid || child.pid,
    mode: existing ? 'restarted' : 'started',
    state_path: getServerStatePath(root),
  };
  writeServerState(root, payload);

  if (open) openBrowser(payload.url);
  return payload;
}

async function cli() {
  const payload = await startRuntimeDashboardServer({
    root: process.cwd(),
    host: process.env.RUNTIME_DASHBOARD_HOST || '127.0.0.1',
    port: Number(process.env.RUNTIME_DASHBOARD_PORT || 43124),
    dataPath: process.env.RUNTIME_DASHBOARD_DATA_PATH || undefined,
    open: process.env.RUNTIME_DASHBOARD_OPEN === '1',
  });
  console.log(JSON.stringify(payload, null, 2));
}

if (require.main === module) {
  cli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { startRuntimeDashboardServer, checkHealth, stopServerByState, getRuntimeDashboardStatus };
