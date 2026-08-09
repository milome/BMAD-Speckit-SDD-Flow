'use strict';

const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const {
  assertGovernedPath,
  fail,
  readCanonicalArtifact,
  writeCanonicalArtifact,
} = require('./canonical-artifact.cjs');
const { createBootstrapTimingSummary } = require('./summarize-test-timings.cjs');
const {
  buildSixModelPlanningDiagnostics,
  writeSixModelCiDiagnostics,
} = require('./build-six-model-ci-diagnostics.cjs');
const { commandTargetPath } = require('./test-command-bindings.cjs');
const {
  defaultListTrackedChanges,
  defaultRestoreTrackedChanges,
  normalizeTrackedChanges,
} = require('./prepare-shard-runtime.cjs');

const PROFILES = new Set([
  'pr-fast',
  'pr-full',
  'nightly-deep',
  'release-verify',
  'nightly-full',
  'release-full',
]);
const DEFAULT_CHANGED_PATHS = '.artifacts/test-portfolio/changed-paths.json';
const CATALOG_PATH = '.artifacts/test-portfolio/test-catalog.json';
const FACTS_PATH = '.artifacts/test-portfolio/test-catalog-facts.json';
const CORE_FREEZE_PATH = '.artifacts/test-portfolio/core-freeze.json';
const COVERAGE_REPORT_PATH = '.artifacts/test-portfolio/six-model-coverage-gap-report.json';
const DEFAULT_FAILURE_RECORDS_PATH = '.artifacts/test-portfolio/product-failure-records.json';
const SELECTION_PATH = '.artifacts/test-portfolio/test-selection.json';
const TIMING_SUMMARY_PATH = '.artifacts/test-portfolio/ci-test-timing-summary.json';
const POLICY_PATH = 'repo-governance/ci/test-policy.json';
const MANIFEST_PATH = '.artifacts/test-portfolio/ci-run-manifest.json';
const SEMANTIC_INDEX_PATH = '.artifacts/test-portfolio/ci-shard-semantic-index.json';
const DESCRIPTOR_PATH = '.artifacts/test-portfolio/package/canonical-package.json';
const PR_FAST_PLANNING_BUDGET_MS = 90_000;
const PLANNING_SCRIPT_NAMES = new Set([
  'ci:catalog',
  'ci:freeze-core',
  'ci:coverage-gap',
  'ci:select',
  'ci:shard-plan',
  'ci:semantic-index',
]);
const monotonicNow = () => performance.now();

function requireCommitSha(value, code) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/iu.test(value.trim())) fail(code);
  return value.trim().toLowerCase();
}

function requireEnvironmentClass(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.trim())) {
    fail('CI_GOVERNED_PROFILE_ENVIRONMENT_INVALID');
  }
  return value.trim();
}

function runtimeEnvironmentClass() {
  const nodeMajor = process.versions.node.split('.')[0];
  return `${process.platform}-${process.arch}-node${nodeMajor}`;
}

function normalizeChangedPaths(value) {
  if (!Array.isArray(value)) fail('CI_GOVERNED_PROFILE_CHANGED_PATHS_INVALID');
  const normalized = value.map((entry) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      fail('CI_GOVERNED_PROFILE_CHANGED_PATHS_INVALID');
    }
    const candidate = entry.trim().replace(/\\/g, '/');
    if (
      /^[A-Za-z]:/u.test(candidate) ||
      path.posix.isAbsolute(candidate) ||
      candidate === '..' ||
      candidate.startsWith('../') ||
      candidate.includes('/../') ||
      path.posix.normalize(candidate) !== candidate ||
      [...candidate].some((character) => character.charCodeAt(0) <= 0x1f)
    ) {
      fail('CI_GOVERNED_PROFILE_CHANGED_PATHS_INVALID', { path: entry });
    }
    return candidate;
  });
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right, 'en'));
}

function validateManifestMatrix(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.matrix)) {
    fail('CI_GOVERNED_PROFILE_MANIFEST_INVALID');
  }
  const keys = new Set();
  return manifest.matrix.map((row) => {
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row) ||
      Object.keys(row).sort().join('\0') !== 'lane\0shardId' ||
      typeof row.lane !== 'string' ||
      row.lane.trim() === '' ||
      typeof row.shardId !== 'string' ||
      row.shardId.trim() === ''
    ) {
      fail('CI_GOVERNED_PROFILE_MANIFEST_INVALID');
    }
    const key = `${row.lane}\0${row.shardId}`;
    if (keys.has(key)) fail('CI_GOVERNED_PROFILE_MANIFEST_INVALID');
    keys.add(key);
    return { lane: row.lane, shardId: row.shardId };
  });
}

function localShardExecutionOrder(matrix) {
  return matrix
    .map((row, index) => ({ ...row, index }))
    .sort((left, right) => {
      if (left.lane === right.lane && left.lane === 'repo_mutating') {
        const leftExpectedFailure = left.shardId.includes('-xfail-');
        const rightExpectedFailure = right.shardId.includes('-xfail-');
        if (leftExpectedFailure !== rightExpectedFailure) {
          return leftExpectedFailure ? -1 : 1;
        }
      }
      return left.index - right.index;
    })
    .map(({ index: _index, ...row }) => row);
}

function command(scriptName, args, extra = {}) {
  return { scriptName, args, ...extra };
}

function buildGovernedProfileCommands({
  profile,
  baseSha,
  commitSha,
  environmentClass = runtimeEnvironmentClass(),
  changedPathsPath = DEFAULT_CHANGED_PATHS,
  failureRecordsPath,
  manifest,
}) {
  if (!PROFILES.has(profile)) fail('CI_GOVERNED_PROFILE_UNKNOWN');
  const normalizedBaseSha = requireCommitSha(baseSha, 'CI_GOVERNED_PROFILE_BASE_INVALID');
  const normalizedCommitSha = requireCommitSha(commitSha, 'CI_GOVERNED_PROFILE_COMMIT_INVALID');
  const normalizedEnvironmentClass = requireEnvironmentClass(environmentClass);
  const matrix = localShardExecutionOrder(validateManifestMatrix(manifest));
  return [
    command('ci:catalog', ['--changed-paths', changedPathsPath]),
    command(
      'ci:freeze-core',
      [
        '--catalog',
        CATALOG_PATH,
        '--facts',
        FACTS_PATH,
        '--policy',
        POLICY_PATH,
        '--timing-summary',
        TIMING_SUMMARY_PATH,
        '--commit-sha',
        normalizedCommitSha,
        '--environment-class',
        normalizedEnvironmentClass,
        '--output',
        CORE_FREEZE_PATH,
      ],
      {
        directNodeScript: commandTargetPath('governed-profile-freeze-core'),
        acceptedStatuses: [0, 1],
      }
    ),
    command(
      'ci:coverage-gap',
      [
        '--catalog',
        CATALOG_PATH,
        '--core-freeze',
        CORE_FREEZE_PATH,
        '--policy',
        POLICY_PATH,
        ...(failureRecordsPath ? ['--failure-records', failureRecordsPath] : []),
      ],
      { directNodeScript: commandTargetPath('governed-profile-coverage-gap') }
    ),
    command('ci:select', [
      '--catalog',
      CATALOG_PATH,
      '--core-freeze',
      CORE_FREEZE_PATH,
      '--coverage-report',
      COVERAGE_REPORT_PATH,
      '--facts',
      FACTS_PATH,
      '--base-sha',
      normalizedBaseSha,
      '--commit-sha',
      normalizedCommitSha,
      '--requested-profile',
      profile,
    ]),
    command('ci:shard-plan', [
      '--selection',
      '.artifacts/test-portfolio/test-selection.json',
      '--commit-sha',
      normalizedCommitSha,
      '--environment-class',
      normalizedEnvironmentClass,
    ]),
    command(
      'ci:semantic-index',
      [
        '--selection',
        SELECTION_PATH,
        '--shard-plan',
        '.artifacts/test-portfolio/ci-shard-plan.json',
        '--coverage-report',
        COVERAGE_REPORT_PATH,
        '--catalog',
        CATALOG_PATH,
        '--changed-paths',
        changedPathsPath,
      ],
      { directNodeScript: commandTargetPath('governed-profile-semantic-index') }
    ),
    command('ci:prepare-package', ['--commit-sha', normalizedCommitSha]),
    command('ci:manifest', [
      '--catalog',
      '.artifacts/test-portfolio/test-catalog.json',
      '--selection',
      '.artifacts/test-portfolio/test-selection.json',
      '--shard-plan',
      '.artifacts/test-portfolio/ci-shard-plan.json',
      '--timing-summary',
      TIMING_SUMMARY_PATH,
      '--semantic-index',
      SEMANTIC_INDEX_PATH,
      '--package-descriptor',
      DESCRIPTOR_PATH,
      '--commit-sha',
      normalizedCommitSha,
    ]),
    command('ci:prepare-shard-runtime', []),
    ...matrix.map(({ lane, shardId }) =>
      command(
        'ci:run-shard',
        [
          '--manifest',
          MANIFEST_PATH,
          '--lane',
          lane,
          '--shard-id',
          shardId,
          '--descriptor',
          DESCRIPTOR_PATH,
        ],
        { lane, shardId }
      )
    ),
    command('ci:join', [
      '--manifest',
      MANIFEST_PATH,
      '--lane-results-dir',
      '.artifacts/test-portfolio/lane-results',
      '--semantic-index',
      SEMANTIC_INDEX_PATH,
    ]),
  ];
}

function commandDurationMs({ scriptName, startedAtMs, endedAtMs }) {
  const durationMs = endedAtMs - startedAtMs;
  if (
    !Number.isFinite(startedAtMs) ||
    !Number.isFinite(endedAtMs) ||
    !Number.isFinite(durationMs) ||
    durationMs < 0
  ) {
    fail('CI_GOVERNED_PROFILE_TIMING_INVALID', {
      scriptName,
      startedAtMs,
      endedAtMs,
    });
  }
  return durationMs;
}

function runScript(commandSpec, { repoRoot, spawn = spawnSync, now = monotonicNow } = {}) {
  const directNodeScript =
    typeof commandSpec.directNodeScript === 'string' ? commandSpec.directNodeScript : null;
  const executable = directNodeScript ? process.execPath : 'npm';
  const args = directNodeScript
    ? [directNodeScript, ...commandSpec.args]
    : ['run', commandSpec.scriptName, '--', ...commandSpec.args];
  const startedAtMs = now();
  const result = spawn(executable, args, {
    cwd: repoRoot,
    env: process.env,
    shell: directNodeScript ? false : process.platform === 'win32',
    stdio: 'inherit',
  });
  const durationMs = commandDurationMs({
    scriptName: commandSpec.scriptName,
    startedAtMs,
    endedAtMs: now(),
  });
  if (result.error) throw result.error;
  const acceptedStatuses = Array.isArray(commandSpec.acceptedStatuses)
    ? commandSpec.acceptedStatuses
    : [0];
  if (!acceptedStatuses.includes(result.status)) {
    fail('CI_GOVERNED_PROFILE_COMMAND_FAILED', {
      scriptName: commandSpec.scriptName,
      status: result.status,
      signal: result.signal || null,
      durationMs,
    });
  }
  return {
    scriptName: commandSpec.scriptName,
    durationMs,
  };
}

function errorDetails(error) {
  return {
    code: typeof error?.code === 'string' ? error.code : null,
    message: error instanceof Error ? error.message : String(error),
    status: Number.isInteger(error?.status) ? error.status : null,
  };
}

function runShardWithTrackedCleanup(
  commandSpec,
  {
    repoRoot,
    spawn,
    now,
    listTrackedChanges = defaultListTrackedChanges,
    restoreTrackedChanges = defaultRestoreTrackedChanges,
  } = {}
) {
  if (commandSpec?.scriptName !== 'ci:run-shard') {
    fail('CI_GOVERNED_PROFILE_SHARD_COMMAND_INVALID');
  }
  if (typeof listTrackedChanges !== 'function') {
    fail('CI_GOVERNED_PROFILE_SHARD_CHANGE_LISTER_INVALID');
  }
  if (typeof restoreTrackedChanges !== 'function') {
    fail('CI_GOVERNED_PROFILE_SHARD_RESTORER_INVALID');
  }

  let initialTrackedChanges;
  try {
    initialTrackedChanges = normalizeTrackedChanges(listTrackedChanges({ repoRoot }));
  } catch (error) {
    fail('CI_GOVERNED_PROFILE_SHARD_CLEANUP_FAILED', {
      lane: commandSpec.lane,
      shardId: commandSpec.shardId,
      cleanup: errorDetails(error),
    });
  }

  const initialTrackedPaths = new Set(initialTrackedChanges);
  let commandTiming;
  let commandError = null;
  try {
    commandTiming = runScript(commandSpec, { repoRoot, spawn, now });
  } catch (error) {
    commandError = error;
  }

  let cleanupError = null;
  let remainingGeneratedChanges = [];
  try {
    const generatedChanges = normalizeTrackedChanges(listTrackedChanges({ repoRoot })).filter(
      (trackedPath) => !initialTrackedPaths.has(trackedPath)
    );
    if (generatedChanges.length > 0) {
      restoreTrackedChanges(generatedChanges, { repoRoot });
    }
    remainingGeneratedChanges = normalizeTrackedChanges(listTrackedChanges({ repoRoot })).filter(
      (trackedPath) => !initialTrackedPaths.has(trackedPath)
    );
  } catch (error) {
    cleanupError = error;
  }

  if (cleanupError || remainingGeneratedChanges.length > 0) {
    fail('CI_GOVERNED_PROFILE_SHARD_CLEANUP_FAILED', {
      lane: commandSpec.lane,
      shardId: commandSpec.shardId,
      command: commandError ? errorDetails(commandError) : null,
      cleanup: cleanupError ? errorDetails(cleanupError) : null,
      trackedPaths: remainingGeneratedChanges.length > 0 ? remainingGeneratedChanges : undefined,
    });
  }
  if (commandError) throw commandError;
  return commandTiming;
}

function gitOutput(repoRoot, args, code) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    }).trim();
  } catch {
    fail(code);
  }
}

function assertCleanRepository(repoRoot) {
  const status = gitOutput(
    repoRoot,
    ['status', '--porcelain', '--untracked-files=no', '--', ':!.artifacts'],
    'CI_GOVERNED_PROFILE_GIT_STATUS_FAILED'
  );
  if (status !== '') fail('CI_GOVERNED_PROFILE_REPOSITORY_DIRTY');
}

function deriveChangedPaths({ repoRoot, commitSha, baseSha }) {
  const normalizedBaseSha = baseSha
    ? requireCommitSha(baseSha, 'CI_GOVERNED_PROFILE_BASE_INVALID')
    : gitOutput(repoRoot, ['rev-parse', `${commitSha}^`], 'CI_GOVERNED_PROFILE_BASE_REQUIRED');
  const output = gitOutput(
    repoRoot,
    ['diff', '--name-only', normalizedBaseSha, commitSha],
    'CI_GOVERNED_PROFILE_DIFF_FAILED'
  );
  return normalizeChangedPaths(output === '' ? [] : output.split(/\r?\n/u));
}

function resetGeneratedEvidence(repoRoot, protectedPaths = []) {
  const protectedTargets = protectedPaths.map((relativePath) =>
    assertGovernedPath(repoRoot, path.resolve(repoRoot, relativePath))
  );
  for (const relativePath of [
    DEFAULT_CHANGED_PATHS,
    CATALOG_PATH,
    FACTS_PATH,
    CORE_FREEZE_PATH,
    COVERAGE_REPORT_PATH,
    '.artifacts/test-portfolio/dev-remediation-handoff.json',
    SELECTION_PATH,
    '.artifacts/test-portfolio/ci-shard-plan.json',
    SEMANTIC_INDEX_PATH,
    MANIFEST_PATH,
    '.artifacts/test-portfolio/lane-results',
    '.artifacts/test-portfolio/final',
  ]) {
    const target = assertGovernedPath(repoRoot, path.resolve(repoRoot, relativePath));
    if (
      protectedTargets.some(
        (protectedTarget) =>
          protectedTarget === target || protectedTarget.startsWith(`${target}${path.sep}`)
      )
    ) {
      continue;
    }
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function writeBlockedPlanningDiagnostics(repoRoot) {
  const semanticIndex = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, SEMANTIC_INDEX_PATH),
  }).artifact;
  return writeSixModelCiDiagnostics({
    repoRoot,
    report: buildSixModelPlanningDiagnostics({ semanticIndex }),
  });
}

function resolveFailureRecordsPath(repoRoot, explicitPath) {
  const value = explicitPath || DEFAULT_FAILURE_RECORDS_PATH;
  const target = assertGovernedPath(repoRoot, path.resolve(repoRoot, value));
  if (!fs.existsSync(target)) {
    if (explicitPath) fail('CI_GOVERNED_PROFILE_FAILURE_RECORDS_MISSING');
    return undefined;
  }
  return path.relative(repoRoot, target).replace(/\\/gu, '/');
}

function writeChangedPaths(repoRoot, changedPaths) {
  return writeCanonicalArtifact({
    repoRoot,
    outputDir: '.artifacts/test-portfolio',
    fileName: 'changed-paths.json',
    artifact: normalizeChangedPaths(changedPaths),
  });
}

function ensureTimingSummary(repoRoot) {
  const target = assertGovernedPath(repoRoot, path.resolve(repoRoot, TIMING_SUMMARY_PATH));
  if (fs.existsSync(target)) return;
  writeCanonicalArtifact({
    repoRoot,
    outputDir: path.dirname(target),
    fileName: path.basename(target),
    artifact: createBootstrapTimingSummary(),
  });
}

function selectionAllowsExecution(selection) {
  if (
    !selection ||
    typeof selection !== 'object' ||
    Array.isArray(selection) ||
    !['ready', 'blocked'].includes(selection.selectionStatus)
  ) {
    fail('CI_GOVERNED_PROFILE_SELECTION_INVALID');
  }
  return selection.selectionStatus === 'ready';
}

function parseCliArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      ![
        '--profile',
        '--base-sha',
        '--commit-sha',
        '--changed-paths',
        '--environment-class',
        '--failure-records',
      ].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CI_GOVERNED_PROFILE_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  if (!PROFILES.has(options.profile)) fail('CI_GOVERNED_PROFILE_UNKNOWN');
  return options;
}

function runGovernedProfile({
  repoRoot = process.cwd(),
  profile,
  commitSha,
  baseSha,
  changedPaths,
  failureRecordsPath,
  environmentClass = runtimeEnvironmentClass(),
  now = monotonicNow,
  planningBudgetMs = PR_FAST_PLANNING_BUDGET_MS,
  spawn,
  listTrackedChanges = defaultListTrackedChanges,
  restoreTrackedChanges = defaultRestoreTrackedChanges,
  planningDiagnosticsWriter = writeBlockedPlanningDiagnostics,
}) {
  const normalizedCommitSha = requireCommitSha(commitSha, 'CI_GOVERNED_PROFILE_COMMIT_INVALID');
  if (profile === 'pr-fast' && (!Number.isFinite(planningBudgetMs) || planningBudgetMs < 0)) {
    fail('CI_GOVERNED_PROFILE_TIMING_INVALID', { planningBudgetMs });
  }
  assertCleanRepository(repoRoot);
  const resolvedFailureRecordsPath = resolveFailureRecordsPath(repoRoot, failureRecordsPath);
  resetGeneratedEvidence(repoRoot, resolvedFailureRecordsPath ? [resolvedFailureRecordsPath] : []);
  ensureTimingSummary(repoRoot);
  const resolvedChangedPaths =
    changedPaths === undefined
      ? deriveChangedPaths({ repoRoot, commitSha: normalizedCommitSha, baseSha })
      : normalizeChangedPaths(changedPaths);
  const resolvedBaseSha = baseSha
    ? requireCommitSha(baseSha, 'CI_GOVERNED_PROFILE_BASE_INVALID')
    : gitOutput(
        repoRoot,
        ['rev-parse', `${normalizedCommitSha}^`],
        'CI_GOVERNED_PROFILE_BASE_REQUIRED'
      );
  writeChangedPaths(repoRoot, resolvedChangedPaths);

  const placeholderManifest = { matrix: [] };
  const planningCommands = buildGovernedProfileCommands({
    profile,
    baseSha: resolvedBaseSha,
    commitSha: normalizedCommitSha,
    environmentClass,
    failureRecordsPath: resolvedFailureRecordsPath,
    manifest: placeholderManifest,
  });
  const joinIndex = planningCommands.findIndex(
    (commandSpec) => commandSpec.scriptName === 'ci:join'
  );
  if (joinIndex < 0) fail('CI_GOVERNED_PROFILE_COMMAND_PLAN_INVALID');
  const planningStageDurationsMs = {};
  let planningDurationMs = 0;
  for (const commandSpec of planningCommands.slice(0, joinIndex)) {
    const timing = runScript(commandSpec, { repoRoot, spawn, now });
    if (PLANNING_SCRIPT_NAMES.has(commandSpec.scriptName)) {
      planningStageDurationsMs[commandSpec.scriptName] = timing.durationMs;
      planningDurationMs += timing.durationMs;
      if (!Number.isFinite(planningDurationMs) || planningDurationMs < 0) {
        fail('CI_GOVERNED_PROFILE_TIMING_INVALID', {
          planningDurationMs,
          planningStageDurationsMs,
        });
      }
      if (profile === 'pr-fast' && planningDurationMs > planningBudgetMs) {
        fail('CI_PR_FAST_PLANNING_BUDGET_EXCEEDED', {
          planningBudgetMs,
          planningDurationMs,
          planningStageDurationsMs,
        });
      }
    }
  }

  const manifest = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, MANIFEST_PATH),
  }).artifact;
  const selection = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, SELECTION_PATH),
  }).artifact;
  if (!selectionAllowsExecution(selection)) {
    const diagnosticsReceipts = planningDiagnosticsWriter(repoRoot);
    return {
      profile,
      commitSha: normalizedCommitSha,
      changedPathCount: resolvedChangedPaths.length,
      shardCount: manifest.matrix.length,
      executionStatus: 'blocked',
      blockingGapCount: selection.blockingGapCount,
      selectionPath: SELECTION_PATH,
      coverageReportPath: COVERAGE_REPORT_PATH,
      shardPlanPath: '.artifacts/test-portfolio/ci-shard-plan.json',
      manifestPath: MANIFEST_PATH,
      diagnosticsPath: diagnosticsReceipts.json?.path || null,
      diagnosticsMarkdownPath: diagnosticsReceipts.markdown?.path || null,
      planningDurationMs,
      planningStageDurationsMs,
    };
  }
  const executionCommands = buildGovernedProfileCommands({
    profile,
    baseSha: resolvedBaseSha,
    commitSha: normalizedCommitSha,
    environmentClass,
    failureRecordsPath: resolvedFailureRecordsPath,
    manifest,
  }).filter((commandSpec) => ['ci:run-shard', 'ci:join'].includes(commandSpec.scriptName));
  for (const commandSpec of executionCommands) {
    if (commandSpec.scriptName === 'ci:run-shard') {
      runShardWithTrackedCleanup(commandSpec, {
        repoRoot,
        spawn,
        now,
        listTrackedChanges,
        restoreTrackedChanges,
      });
    } else {
      runScript(commandSpec, { repoRoot, spawn, now });
    }
  }
  return {
    profile,
    commitSha: normalizedCommitSha,
    changedPathCount: resolvedChangedPaths.length,
    shardCount: manifest.matrix.length,
    executionStatus: 'executed',
    finalManifestPath: '.artifacts/test-portfolio/final/ci-run-manifest.json',
    planningDurationMs,
    planningStageDurationsMs,
  };
}

function main(args = process.argv.slice(2)) {
  const options = parseCliArgs(args);
  const repoRoot = process.cwd();
  const commitSha =
    options['commit-sha'] ||
    process.env.CI_COMMIT_SHA ||
    gitOutput(repoRoot, ['rev-parse', 'HEAD'], 'CI_GOVERNED_PROFILE_COMMIT_INVALID');
  const changedPaths = options['changed-paths']
    ? JSON.parse(fs.readFileSync(path.resolve(repoRoot, options['changed-paths']), 'utf8'))
    : undefined;
  const result = runGovernedProfile({
    repoRoot,
    profile: options.profile,
    commitSha,
    baseSha: options['base-sha'],
    changedPaths,
    failureRecordsPath: options['failure-records'],
    environmentClass:
      options['environment-class'] || process.env.CI_ENVIRONMENT_CLASS || runtimeEnvironmentClass(),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  buildGovernedProfileCommands,
  main,
  normalizeChangedPaths,
  parseCliArgs,
  resetGeneratedEvidence,
  resolveFailureRecordsPath,
  runtimeEnvironmentClass,
  runScript,
  runGovernedProfile,
  runShardWithTrackedCleanup,
  selectionAllowsExecution,
  writeBlockedPlanningDiagnostics,
};
