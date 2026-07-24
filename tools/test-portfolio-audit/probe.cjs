const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { canonicalJsonBytes, sha256Bytes } = require('./canonical.cjs');

const PROBE_MARKER = Object.freeze({
  schemaVersion: 'test-portfolio-probe-sandbox/v1',
  disposable: true,
});
const PROBE_TEMP_PREFIX = 'test-portfolio-probe-';
const COVERAGE_KEYS = ['repository', 'environment', 'temp', 'processes', 'ports'];

function probeError(code, cause) {
  const error = new Error(code);
  error.code = code;
  if (cause !== undefined) error.cause = cause;
  return error;
}

function realpath(directory, invalidCode) {
  try {
    return fs.realpathSync(directory);
  } catch (error) {
    throw probeError(invalidCode, error);
  }
}

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function runGit(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw probeError('PROBE_SANDBOX_GIT_UNAVAILABLE', result.error || result.stderr);
  }
  return result;
}

function readProbeMarker(sandboxRoot) {
  try {
    const marker = JSON.parse(
      fs.readFileSync(path.join(sandboxRoot, '.test-portfolio-probe-sandbox.json'), 'utf8')
    );
    const keys = Object.keys(marker).sort();
    if (
      !marker ||
      typeof marker !== 'object' ||
      Array.isArray(marker) ||
      keys.length !== 2 ||
      keys[0] !== 'disposable' ||
      keys[1] !== 'schemaVersion' ||
      marker.schemaVersion !== PROBE_MARKER.schemaVersion ||
      marker.disposable !== PROBE_MARKER.disposable
    ) {
      throw probeError('PROBE_SANDBOX_MARKER_INVALID');
    }
    return marker;
  } catch (error) {
    if (error && error.code === 'PROBE_SANDBOX_MARKER_INVALID') throw error;
    throw probeError('PROBE_SANDBOX_MARKER_INVALID', error);
  }
}

function validateProbeSandbox({ repoRoot, sandboxRoot, expectedCommit, git = runGit }) {
  if (!sandboxRoot) throw probeError('PROBE_DISABLED_NO_SANDBOX');
  const source = realpath(repoRoot, 'PROBE_SOURCE_INVALID');
  const sandbox = realpath(sandboxRoot, 'PROBE_SANDBOX_MARKER_INVALID');
  const comparableSource = comparablePath(source);
  const comparableSandbox = comparablePath(sandbox);

  if (comparableSource === comparableSandbox) {
    throw probeError('PROBE_SANDBOX_EQUALS_SOURCE');
  }
  if (isInside(comparableSource, comparableSandbox)) {
    throw probeError('PROBE_SANDBOX_INSIDE_SOURCE');
  }

  readProbeMarker(sandbox);
  const result = git(sandbox, ['rev-parse', 'HEAD']);
  const commit = String(result && result.stdout !== undefined ? result.stdout : result).trim();
  if (commit !== expectedCommit) throw probeError('PROBE_SANDBOX_COMMIT_MISMATCH');
  return { source, sandbox, commit };
}

function probeRank(row) {
  if (row.criticality === 'critical' && row.parallelSafety === 'safe_candidate') return 0;
  if (row.parallelSafety === 'safe_candidate' && Number.isFinite(row.durationMs)) return 1;
  if (row.parallelSafety === 'unknown') return 2;
  return 3;
}

function boundedLimit(limit) {
  const numeric = Number(limit);
  if (!Number.isFinite(numeric)) return numeric === Number.POSITIVE_INFINITY ? Infinity : 0;
  return Math.max(0, Math.floor(numeric));
}

function durationForSort(row) {
  return Number.isFinite(row.durationMs) ? Number(row.durationMs) : 0;
}

function selectProbeCandidates(rows, limit) {
  const bounded = boundedLimit(limit);
  if (bounded === 0) return [];
  return [...rows]
    .filter((row) => row.parallelSafety !== 'unsafe')
    .sort((left, right) => {
      const rank = probeRank(left) - probeRank(right);
      if (rank !== 0) return rank;
      const duration = durationForSort(right) - durationForSort(left);
      if (duration !== 0) return duration;
      return String(left.testPath).localeCompare(String(right.testPath), 'en');
    })
    .slice(0, bounded);
}

function commandResult(spawn, command, args, options = {}) {
  const result = spawn(command, args, {
    ...options,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw probeError('PROBE_OBSERVATION_ADAPTER_UNAVAILABLE', result.error || result.stderr);
  }
  return String(result.stdout || '');
}

function lines(value) {
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '');
}

function listTempEntries(tempRoot) {
  if (!fs.existsSync(tempRoot)) return [];
  const entries = [];

  function visit(directory) {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = fs.statSync(absolutePath);
      const relativePath = path.relative(tempRoot, absolutePath).replace(/\\/g, '/');
      entries.push(`${relativePath}:${stat.size}:${Math.trunc(stat.mtimeMs)}`);
    }
  }

  visit(tempRoot);
  return entries;
}

function parsePosixProcesses(stdout) {
  return lines(stdout)
    .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s*(.*)$/))
    .filter(Boolean)
    .map((match) => `${match[1]}:${match[2]}:${match[3]}`);
}

function splitEndpoint(endpoint) {
  const separator = endpoint.lastIndexOf(':');
  if (separator === -1) return { address: endpoint, port: '' };
  return {
    address: endpoint.slice(0, separator),
    port: endpoint.slice(separator + 1),
  };
}

function parseSsPorts(stdout) {
  return lines(stdout)
    .filter((line) => !/^State\s/i.test(line))
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) return null;
      const endpoint = splitEndpoint(parts[3]);
      const pidMatch = line.match(/pid=(\d+)/);
      return `tcp:${endpoint.address}:${endpoint.port}:${pidMatch ? pidMatch[1] : ''}`;
    })
    .filter(Boolean);
}

function parseNetstatPorts(stdout) {
  return lines(stdout)
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4 || !/^tcp/i.test(parts[0])) return null;
      const endpoint = splitEndpoint(parts[3]);
      const owner = parts.find((part) => /^\d+\//.test(part));
      const pid = owner ? owner.slice(0, owner.indexOf('/')) : '';
      return `${parts[0].toLowerCase()}:${endpoint.address}:${endpoint.port}:${pid}`;
    })
    .filter(Boolean);
}

function createProductionObservationAdapters({
  spawn = spawnSync,
  platform = process.platform,
} = {}) {
  return {
    repository({ sandboxRoot }) {
      return lines(
        commandResult(spawn, 'git', ['status', '--porcelain=v1', '--untracked-files=all'], {
          cwd: sandboxRoot,
        })
      );
    },
    tempEntries({ tempRoot }) {
      return listTempEntries(tempRoot);
    },
    processes() {
      if (platform === 'win32') {
        const script =
          'Get-CimInstance Win32_Process | Sort-Object ProcessId | ForEach-Object { "$($_.ProcessId):$($_.ParentProcessId):$($_.CommandLine)" }';
        return lines(
          commandResult(spawn, 'pwsh.exe', ['-NoLogo', '-NoProfile', '-Command', script])
        );
      }
      return parsePosixProcesses(commandResult(spawn, 'ps', ['-eo', 'pid=,ppid=,command=']));
    },
    listeningPorts() {
      if (platform === 'win32') {
        const script =
          'Get-NetTCPConnection -State Listen | Sort-Object LocalAddress,LocalPort,OwningProcess | ForEach-Object { "tcp:$($_.LocalAddress):$($_.LocalPort):$($_.OwningProcess)" }';
        return lines(
          commandResult(spawn, 'pwsh.exe', ['-NoLogo', '-NoProfile', '-Command', script])
        );
      }
      try {
        return parseSsPorts(commandResult(spawn, 'ss', ['-ltnp']));
      } catch (_err) {
        return parseNetstatPorts(commandResult(spawn, 'netstat', ['-anp']));
      }
    },
  };
}

function normalizeEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment || {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
  );
}

function stableArray(values) {
  return [...new Set((values || []).map(String))].sort((left, right) =>
    left.localeCompare(right, 'en')
  );
}

function captureProbeSnapshot({
  sandboxRoot,
  tempRoot,
  childEnv,
  adapters = createProductionObservationAdapters(),
}) {
  const coverage = {
    repository: false,
    environment: true,
    temp: false,
    processes: false,
    ports: false,
  };

  function capture(adapterName, coverageKey, input) {
    const adapter = adapters && adapters[adapterName];
    if (typeof adapter !== 'function') return [];
    try {
      const value = stableArray(adapter(input));
      coverage[coverageKey] = true;
      return value;
    } catch (_err) {
      return [];
    }
  }

  const environment = normalizeEnvironment(childEnv);
  return {
    repository: capture('repository', 'repository', { sandboxRoot }),
    environmentHash: sha256Bytes(canonicalJsonBytes(environment)),
    tempEntries: capture('tempEntries', 'temp', { tempRoot }),
    processes: capture('processes', 'processes'),
    listeningPorts: capture('listeningPorts', 'ports'),
    coverage,
  };
}

function coverageComplete(snapshot) {
  return (
    snapshot && snapshot.coverage && COVERAGE_KEYS.every((key) => snapshot.coverage[key] === true)
  );
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function newEntries(before, after) {
  const existing = new Set(before || []);
  return (after || []).filter((entry) => !existing.has(entry));
}

function compareSnapshots(before, after) {
  const issueCodes = [];
  if (!coverageComplete(before) || !coverageComplete(after)) {
    issueCodes.push('PROBE_OBSERVATION_INCOMPLETE');
  }
  if (!same(before.repository, after.repository)) {
    issueCodes.push('PROBE_REPOSITORY_MUTATION');
  }
  if (!same(before.tempEntries, after.tempEntries)) {
    issueCodes.push('PROBE_TEMP_STATE_LEAK');
  }
  if (newEntries(before.processes, after.processes).length > 0) {
    issueCodes.push('PROBE_PROCESS_LEAK');
  }
  if (newEntries(before.listeningPorts, after.listeningPorts).length > 0) {
    issueCodes.push('PROBE_PORT_LEAK');
  }
  if (issueCodes.includes('PROBE_OBSERVATION_INCOMPLETE')) {
    return { value: 'unknown', confidence: 'low', issueCodes };
  }
  if (issueCodes.length > 0) {
    return { value: 'unsafe', confidence: 'high', issueCodes };
  }
  return { value: 'safe_candidate', confidence: 'medium', issueCodes: [] };
}

function resolveVitestCli(sandboxRoot) {
  let packageJsonPath;
  try {
    packageJsonPath = require.resolve('vitest/package.json', { paths: [sandboxRoot] });
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    packageJsonPath = require.resolve('vitest/package.json');
  }
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const binPath =
    typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin && packageJson.bin.vitest;
  if (packageJson.name !== 'vitest' || typeof binPath !== 'string') {
    throw probeError('PROBE_VITEST_CLI_INVALID');
  }
  const packageRoot = path.dirname(packageJsonPath);
  const cliPath = path.resolve(packageRoot, binPath);
  if (!isInside(packageRoot, cliPath)) throw probeError('PROBE_VITEST_CLI_INVALID');
  return cliPath;
}

function buildProbeCommand({ sandboxRoot, candidate }) {
  if (candidate.runnerId === 'root-vitest') {
    return {
      command: process.execPath,
      args: [
        resolveVitestCli(sandboxRoot),
        'run',
        '--no-cache',
        '--config',
        path.resolve(sandboxRoot, candidate.configPath || 'vitest.config.ts'),
        candidate.testPath,
      ],
    };
  }
  if (candidate.runnerId === 'bmad-speckit-node-test') {
    return {
      command: process.execPath,
      args: [
        path.resolve(sandboxRoot, 'packages/bmad-speckit/scripts/run-node-tests.cjs'),
        candidate.testPath,
      ],
    };
  }
  throw probeError(`PROBE_RUNNER_UNSUPPORTED:${candidate.runnerId}`);
}

function childEnvironment(childEnv, tempRoot) {
  return {
    ...(childEnv || process.env),
    TMP: tempRoot,
    TEMP: tempRoot,
    TMPDIR: tempRoot,
  };
}

function runProbeTest({
  sandboxRoot,
  candidate,
  tempRoot,
  childEnv,
  timeoutMs,
  spawn = spawnSync,
}) {
  const command = buildProbeCommand({ sandboxRoot, candidate });
  const result = spawn(command.command, command.args, {
    cwd: sandboxRoot,
    encoding: 'utf8',
    env: childEnvironment(childEnv, tempRoot),
    timeout: Math.max(1, Math.floor(timeoutMs)),
    windowsHide: true,
  });
  return {
    status: typeof result.status === 'number' ? result.status : null,
    timedOut: Boolean(result.timedOut || (result.error && result.error.code === 'ETIMEDOUT')),
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
    errorCode: result.error && result.error.code ? String(result.error.code) : undefined,
  };
}

function createProbeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), PROBE_TEMP_PREFIX));
}

function assertProbeOwnedTempRoot(tempRoot) {
  const resolved = path.resolve(tempRoot);
  const tempDirectory = path.resolve(os.tmpdir());
  if (
    comparablePath(path.dirname(resolved)) !== comparablePath(tempDirectory) ||
    !path.basename(resolved).startsWith(PROBE_TEMP_PREFIX)
  ) {
    throw probeError('PROBE_TEMP_ROOT_NOT_OWNED');
  }
  return resolved;
}

function removeProbeTempRoot(tempRoot) {
  fs.rmSync(assertProbeOwnedTempRoot(tempRoot), { recursive: true, force: true });
}

function uniqueIssueCodes(values) {
  return [...new Set(values.filter(Boolean))];
}

function emptyQueueResult(requested, issueCodes = []) {
  return {
    requested,
    selected: 0,
    completed: 0,
    failed: 0,
    timedOut: 0,
    unprobed: requested,
    issueCodes,
    results: [],
  };
}

async function runProbeQueue({
  repoRoot,
  sandboxRoot,
  expectedCommit,
  candidates = [],
  limit = 0,
  budgetMs = 600_000,
  perTestTimeoutMs = 60_000,
  now = Date.now,
  childEnv = process.env,
  validateSandbox = validateProbeSandbox,
  captureSnapshot = captureProbeSnapshot,
  runTest = runProbeTest,
  createTempRoot = createProbeTempRoot,
  removeTempRoot = removeProbeTempRoot,
}) {
  const eligible = selectProbeCandidates(candidates, Infinity);
  const requested = eligible.length;
  const bounded = boundedLimit(limit);
  if (bounded === 0) return emptyQueueResult(requested);
  if (!sandboxRoot) {
    return emptyQueueResult(requested, ['PROBE_DISABLED_NO_SANDBOX']);
  }

  const validated = validateSandbox({
    repoRoot,
    sandboxRoot,
    expectedCommit,
  });
  const effectiveSandbox = validated.sandbox || sandboxRoot;
  const selectedCandidates = selectProbeCandidates(eligible, bounded);
  const result = {
    requested,
    selected: selectedCandidates.length,
    completed: 0,
    failed: 0,
    timedOut: 0,
    unprobed: requested,
    issueCodes: [],
    results: [],
  };
  const startedAt = now();
  const numericBudget = Number(budgetMs);
  const effectiveBudget = Number.isFinite(numericBudget)
    ? Math.max(0, numericBudget)
    : Number.POSITIVE_INFINITY;

  for (const selected of selectedCandidates) {
    const elapsed = Math.max(0, now() - startedAt);
    if (elapsed >= effectiveBudget) {
      result.issueCodes.push('PROBE_BUDGET_EXHAUSTED');
      break;
    }

    const remainingBudget = effectiveBudget - elapsed;
    const timeoutMs = Math.max(
      1,
      Math.floor(Math.min(Number(perTestTimeoutMs) || 60_000, remainingBudget))
    );
    const tempRoot = assertProbeOwnedTempRoot(createTempRoot());
    const environment = childEnvironment(childEnv, tempRoot);
    let before = captureSnapshot({
      sandboxRoot: effectiveSandbox,
      tempRoot,
      childEnv: environment,
    });
    let childResult;

    try {
      childResult = await runTest({
        sandboxRoot: effectiveSandbox,
        candidate: selected,
        tempRoot,
        childEnv: environment,
        timeoutMs,
      });
    } catch (error) {
      childResult = {
        status: null,
        timedOut: Boolean(error && error.code === 'ETIMEDOUT'),
        stdout: '',
        stderr: error && error.message ? error.message : String(error),
        errorCode: error && error.code ? String(error.code) : undefined,
      };
    }

    let after;
    try {
      after = captureSnapshot({
        sandboxRoot: effectiveSandbox,
        tempRoot,
        childEnv: environment,
      });
    } finally {
      removeTempRoot(tempRoot);
    }

    if (!before) before = captureProbeSnapshot({ childEnv: environment, adapters: {} });
    if (!after) after = captureProbeSnapshot({ childEnv: environment, adapters: {} });
    const comparison = compareSnapshots(before, after);
    let assessment = comparison;

    if (childResult.timedOut) {
      result.timedOut += 1;
      assessment = {
        value: 'unknown',
        confidence: 'low',
        issueCodes: uniqueIssueCodes(['PROBE_TEST_TIMEOUT', ...comparison.issueCodes]),
      };
    } else if (childResult.status !== 0) {
      result.failed += 1;
      assessment = {
        value: 'unknown',
        confidence: 'low',
        issueCodes: uniqueIssueCodes(['PROBE_TEST_FAILED', ...comparison.issueCodes]),
      };
    } else {
      result.completed += 1;
    }

    result.results.push({
      testPath: selected.testPath,
      runnerId: selected.runnerId,
      value: assessment.value,
      confidence: assessment.confidence,
      issueCodes: assessment.issueCodes,
      childStatus: childResult.status,
      childTimedOut: childResult.timedOut,
    });
  }

  const attempted = result.completed + result.failed + result.timedOut;
  result.unprobed = Math.max(0, requested - attempted);
  result.issueCodes = uniqueIssueCodes(result.issueCodes);
  return result;
}

module.exports = {
  buildProbeCommand,
  captureProbeSnapshot,
  compareSnapshots,
  createProductionObservationAdapters,
  probeRank,
  runProbeQueue,
  runProbeTest,
  selectProbeCandidates,
  validateProbeSandbox,
};
