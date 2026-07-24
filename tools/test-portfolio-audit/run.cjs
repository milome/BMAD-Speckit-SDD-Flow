const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const { compareTestIdentity, normalizeRepoPath, stableUnique } = require('./canonical.cjs');
const {
  discoverNodeTests,
  discoverVitestTests,
  reconcileDiscovery,
  scanFilesystemCandidates,
} = require('./discovery.cjs');
const { buildExecutionRouteGraph, extractConfiguredCandidateRefs } = require('./routes.cjs');
const duplicate = require('./analyzers/duplicate.cjs');
const targetValidity = require('./analyzers/target-validity.cjs');
const oracleEffectiveness = require('./analyzers/oracle-effectiveness.cjs');
const parallelSafety = require('./analyzers/parallel-safety.cjs');
const criticality = require('./analyzers/criticality.cjs');
const { runProbeQueue } = require('./probe.cjs');
const { reduceAudit } = require('./audit.cjs');
const { renderSummary, writeAuditArtifacts } = require('./report.cjs');

const SKIPPED_DIRECTORIES = new Set([
  '.artifacts',
  '.codex-tmp',
  '.git',
  '.tmp',
  '.worktrees',
  '_bmad-output',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'outputs',
]);
const VITEST_CONFIG_NAMES = [
  'vitest.config.ts',
  'vitest.config.mts',
  'vitest.config.cts',
  'vitest.config.js',
  'vitest.config.mjs',
  'vitest.config.cjs',
];
const EXECUTABLE_TEST_PATH = /\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/iu;
const EXPLICIT_TEST_PATH =
  /(?:^|[\s"'=])([A-Za-z0-9_./\\-]+\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx))(?=$|[\s"';&|])/giu;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectFiles(root, predicate) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile() && predicate(absolutePath, entry.name)) {
        files.push(absolutePath);
      }
    }
  };
  visit(root);
  return files.sort();
}

function normalizeFilesystemCandidates(repoRoot, candidates) {
  return stableUnique(
    candidates
      .map((testPath) => normalizeRepoPath(repoRoot, testPath))
      .filter((testPath) => EXECUTABLE_TEST_PATH.test(testPath))
      .filter(
        (testPath) => !testPath.split('/').some((segment) => SKIPPED_DIRECTORIES.has(segment))
      )
  );
}

function compareText(left, right) {
  return String(left || '').localeCompare(String(right || ''), 'en');
}

function auditError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function issue(code, context = {}) {
  return { severity: context.severity || 'warning', code, ...context };
}

function discoverPackagePaths(repoRoot) {
  return collectFiles(repoRoot, (_absolutePath, name) => name === 'package.json').map(
    (absolutePath) => normalizeRepoPath(repoRoot, absolutePath)
  );
}

function readPackageRecords(repoRoot, packagePaths) {
  return packagePaths.map((packagePath) => {
    try {
      return { packagePath, packageJson: readJson(path.resolve(repoRoot, packagePath)) };
    } catch (error) {
      if (packagePath === 'package.json') {
        throw auditError('CONFIGURED_DISCOVERY_FAILED', error.message);
      }
      return {
        packagePath,
        packageJson: null,
        issue: issue('PACKAGE_JSON_INVALID', { sourceRef: `source:${packagePath}` }),
      };
    }
  });
}

function scriptEntries(record) {
  return Object.entries(record.packageJson?.scripts || {}).filter(
    ([, command]) => typeof command === 'string'
  );
}

function findVitestConfig(repoRoot) {
  return VITEST_CONFIG_NAMES.find((configPath) =>
    fs.existsSync(path.resolve(repoRoot, configPath))
  );
}

function configuredVitest(record, configPath) {
  return Boolean(
    configPath ||
    scriptEntries(record).some(([, command]) =>
      /\b(?:npx\s+)?vitest\s+(?:run|list)\b/u.test(command)
    )
  );
}

function vitestVersion() {
  try {
    return String(require('vitest/package.json').version);
  } catch {
    return 'unknown';
  }
}

function copyVitestOverlay(repoRoot) {
  const overlayRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-portfolio-vitest-overlay-'));
  for (const testPath of normalizeFilesystemCandidates(
    repoRoot,
    scanFilesystemCandidates({ repoRoot })
  )) {
    const source = path.resolve(repoRoot, testPath);
    const target = path.resolve(overlayRoot, testPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  fs.writeFileSync(
    path.join(overlayRoot, 'vitest.config.cjs'),
    [
      'module.exports = {',
      '  test: {',
      "    include: ['**/*.test.{js,cjs,mjs,ts,tsx,jsx}', '**/*.spec.{js,cjs,mjs,ts,tsx,jsx}'],",
      '  },',
      '};',
      '',
    ].join('\n'),
    'utf8'
  );
  return overlayRoot;
}

function explicitVitestTargets(repoRoot, record) {
  const targets = new Map();
  for (const [scriptName, command] of scriptEntries(record)) {
    if (!/\b(?:npx\s+)?vitest\s+(?:run|list)\b/u.test(command)) continue;
    const sourceRef = `source:${record.packagePath}#scripts.${scriptName}`;
    for (const match of command.matchAll(EXPLICIT_TEST_PATH)) {
      const testPath = normalizeRepoPath(repoRoot, match[1]);
      if (!targets.has(testPath)) targets.set(testPath, []);
      targets.get(testPath).push(sourceRef);
    }
  }
  return [...targets]
    .map(([testPath, sourceRefs]) => ({
      testPath,
      sourceRefs: stableUnique(sourceRefs),
    }))
    .sort((left, right) => compareText(left.testPath, right.testPath));
}

function mergeExplicitVitestTargets(repoRoot, record, result) {
  const tests = new Map(result.tests.map((test) => [test.testPath, test]));
  const configuredCandidateRefs = [...(result.configuredCandidateRefs || [])];
  const issues = [...(result.issues || [])];
  let status = result.status;

  for (const target of explicitVitestTargets(repoRoot, record)) {
    configuredCandidateRefs.push(
      ...target.sourceRefs.map((sourceRef) => ({ testPath: target.testPath, sourceRef }))
    );
    if (!fs.existsSync(path.resolve(repoRoot, target.testPath))) {
      status = 'unsupported';
      issues.push(
        issue('VITEST_EXPLICIT_TARGET_MISSING', {
          sourceRef: target.sourceRefs[0],
          testPath: target.testPath,
        })
      );
      continue;
    }
    const existing = tests.get(target.testPath);
    tests.set(target.testPath, {
      ...(existing || { testPath: target.testPath, runnerId: result.runnerId }),
      evidenceRefs: stableUnique([...(existing?.evidenceRefs || []), ...target.sourceRefs]),
    });
  }

  return {
    ...result,
    status,
    tests: [...tests.values()].sort(compareTestIdentity),
    configuredCandidateRefs,
    issues,
  };
}

function normalizeVitestResult(result, evidenceRef) {
  const issues = [...(result.issues || [])];
  const blockingIssues = issues.filter((entry) => entry.code !== 'VITEST_EXCLUSION_DYNAMIC');
  const status =
    result.tests.length > 0 && blockingIssues.length === 0 ? 'complete' : result.status;
  if (status !== 'complete') {
    issues.push(issue('CONFIGURED_RUNNER_UNSUPPORTED', { sourceRef: evidenceRef }));
  }
  return {
    ...result,
    status,
    version: vitestVersion(),
    evidenceRefs: [evidenceRef],
    issues,
    tests: result.tests.map((test) => ({
      ...test,
      evidenceRefs: stableUnique([...(test.evidenceRefs || []), evidenceRef]),
    })),
  };
}

function discoverConfiguredVitest({ repoRoot, configPath, record }) {
  if (configPath) {
    return normalizeVitestResult(
      mergeExplicitVitestTargets(repoRoot, record, discoverVitestTests({ repoRoot, configPath })),
      `source:${configPath}`
    );
  }

  const overlayRoot = copyVitestOverlay(repoRoot);
  try {
    const result = discoverVitestTests({
      repoRoot: overlayRoot,
      configPath: 'vitest.config.cjs',
    });
    return normalizeVitestResult(
      mergeExplicitVitestTargets(repoRoot, record, {
        ...result,
        tests: result.tests.map((test) => ({
          ...test,
          testPath: normalizeRepoPath(overlayRoot, test.testPath),
        })),
        explicitExclusions: [],
        configuredCandidateRefs: [],
      }),
      'source:package.json#scripts'
    );
  } finally {
    fs.rmSync(overlayRoot, { recursive: true, force: true });
  }
}

function genericNodeTestPaths(repoRoot, record, command) {
  const packageDirectory = path.posix.dirname(record.packagePath);
  const normalizedDirectory = packageDirectory === '.' ? '' : packageDirectory;
  const matches = command.match(/[A-Za-z0-9_./\\-]+\.(?:test|spec)\.[cm]?js\b/gu) || [];
  if (matches.length > 0) {
    return stableUnique(
      matches.map((testPath) =>
        normalizeRepoPath(
          repoRoot,
          path.posix.join(normalizedDirectory, testPath.replace(/\\/g, '/'))
        )
      )
    );
  }

  return collectFiles(path.resolve(repoRoot, normalizedDirectory), (_absolutePath, name) =>
    /\.(?:test|spec)\.[cm]?js$/u.test(name)
  ).map((absolutePath) => normalizeRepoPath(repoRoot, absolutePath));
}

function discoverGenericNodeTests(repoRoot, packageRecords) {
  const tests = [];
  const issues = [];
  for (const record of packageRecords) {
    if (!record.packageJson) continue;
    for (const [scriptName, command] of scriptEntries(record)) {
      if (!/\bnode\s+--test\b/u.test(command)) continue;
      const sourceRef = `source:${record.packagePath}#scripts.${scriptName}`;
      for (const testPath of genericNodeTestPaths(repoRoot, record, command)) {
        if (!fs.existsSync(path.resolve(repoRoot, testPath))) {
          issues.push(issue('NODE_TEST_TARGET_MISSING', { sourceRef }));
          continue;
        }
        tests.push({
          testPath,
          runnerId: 'node-test',
          evidenceRefs: [sourceRef],
        });
      }
    }
  }
  if (tests.length === 0 && issues.length === 0) return null;
  return {
    runnerId: 'node-test',
    version: process.version,
    status: issues.length === 0 ? 'complete' : 'unsupported',
    tests: tests.sort(compareTestIdentity),
    explicitExclusions: [],
    configuredCandidateRefs: [],
    issues:
      issues.length === 0
        ? []
        : [...issues, issue('CONFIGURED_RUNNER_UNSUPPORTED', { sourceRef: issues[0].sourceRef })],
  };
}

function discoverUnsupportedRunners(packageRecords) {
  const results = [];
  const unsupported = /\b(?:jest|mocha|pytest)\b|\bplaywright\s+test\b|\bcypress\s+run\b/u;
  for (const record of packageRecords) {
    if (!record.packageJson) continue;
    for (const [scriptName, command] of scriptEntries(record)) {
      if (!/(?:^|:)test(?:$|:)/u.test(scriptName) || !unsupported.test(command)) continue;
      const sourceRef = `source:${record.packagePath}#scripts.${scriptName}`;
      results.push({
        runnerId: `unsupported:${record.packagePath}#${scriptName}`,
        version: 'unknown',
        status: 'unsupported',
        tests: [],
        explicitExclusions: [],
        configuredCandidateRefs: [],
        issues: [issue('CONFIGURED_RUNNER_UNSUPPORTED', { sourceRef })],
      });
    }
  }
  return results;
}

function normalizeNodeAdapterResult(result) {
  const issues = [...(result.issues || [])];
  if (result.status !== 'complete') {
    issues.push(
      issue('CONFIGURED_RUNNER_UNSUPPORTED', {
        sourceRef: 'source:packages/bmad-speckit/scripts/run-node-tests.cjs',
      })
    );
  }
  return {
    ...result,
    version: process.version,
    explicitExclusions: [],
    configuredCandidateRefs: [],
    evidenceRefs: ['source:packages/bmad-speckit/scripts/run-node-tests.cjs'],
    issues,
    tests: result.tests.map((test) => ({
      ...test,
      evidenceRefs: ['source:packages/bmad-speckit/scripts/run-node-tests.cjs'],
    })),
  };
}

function discoverConfiguredTests({ repoRoot }) {
  let packagePaths;
  let packageRecords;
  try {
    packagePaths = discoverPackagePaths(repoRoot);
    packageRecords = readPackageRecords(repoRoot, packagePaths);
  } catch (error) {
    return {
      failed: true,
      packagePaths: ['package.json'],
      runnerResults: [],
      issues: [
        issue('CONFIGURED_DISCOVERY_FAILED', {
          severity: 'fatal',
          sourceRef: 'source:package.json',
          detail: error.message,
        }),
      ],
    };
  }

  const rootRecord = packageRecords.find((record) => record.packagePath === 'package.json') || {
    packagePath: 'package.json',
    packageJson: {},
  };
  const runnerResults = [];
  const configPath = findVitestConfig(repoRoot);
  if (configuredVitest(rootRecord, configPath)) {
    runnerResults.push(discoverConfiguredVitest({ repoRoot, configPath, record: rootRecord }));
  }
  if (
    fs.existsSync(
      path.resolve(repoRoot, 'packages', 'bmad-speckit', 'scripts', 'run-node-tests.cjs')
    )
  ) {
    runnerResults.push(normalizeNodeAdapterResult(discoverNodeTests({ repoRoot })));
  }
  const genericNode = discoverGenericNodeTests(repoRoot, packageRecords);
  if (genericNode) runnerResults.push(genericNode);
  runnerResults.push(...discoverUnsupportedRunners(packageRecords));

  return {
    failed: false,
    packagePaths,
    runnerResults,
    issues: [
      ...packageRecords.flatMap((record) => (record.issue ? [record.issue] : [])),
      ...runnerResults.flatMap((result) => result.issues || []),
    ],
  };
}

function globPattern(pattern) {
  const normalized = String(pattern).replace(/\\/g, '/').replace(/^\.\//u, '');
  let expression = '^';
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === '*' && normalized[index + 1] === '*') {
      if (normalized[index + 2] === '/') {
        expression += '(?:.*/)?';
        index += 2;
      } else {
        expression += '.*';
        index += 1;
      }
    } else if (character === '*') {
      expression += '[^/]*';
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += character.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    }
  }
  return new RegExp(`${expression}$`, 'u');
}

function expandRunnerExclusions(runnerResults, filesystemCandidates) {
  return runnerResults.map((result) => {
    const patterns = result.explicitExclusions || [];
    const exclusions = stableUnique([
      ...patterns.filter((value) => filesystemCandidates.includes(value)),
      ...filesystemCandidates.filter((testPath) =>
        patterns.some((pattern) => globPattern(pattern).test(testPath))
      ),
    ]);
    return { ...result, explicitExclusions: exclusions };
  });
}

function buildCanonicalInventory(runnerResults, routeGraph) {
  const routeRefs = new Map();
  for (const route of routeGraph.routes || []) {
    if (!routeRefs.has(route.identityKey)) routeRefs.set(route.identityKey, []);
    routeRefs.get(route.identityKey).push(route.routeId);
  }
  return {
    tests: runnerResults
      .flatMap((result) =>
        result.tests.map((test) => {
          const identityKey = `${test.runnerId}#${test.testPath}`;
          return {
            identityKey,
            testPath: test.testPath,
            runnerId: test.runnerId,
            runnerBindings: [{ runnerId: test.runnerId }],
            executionRouteRefs: stableUnique(routeRefs.get(identityKey) || []),
            evidenceRefs: stableUnique([
              ...(test.evidenceRefs || []),
              ...(result.evidenceRefs || []),
            ]),
          };
        })
      )
      .sort(compareTestIdentity),
  };
}

function attachDiscoveryCounts(discovery) {
  return {
    ...discovery,
    runnerResolvedCount: discovery.runnerResolved.length,
    candidateCount: discovery.candidates.length,
    unexplainedRunnerOnlyCount: discovery.unexplainedRunnerOnly.length,
    unexplainedCandidateOnlyCount: discovery.unexplainedCandidateOnly.length,
  };
}

function reconciliationIssues(discovery) {
  return [
    ...discovery.unexplainedRunnerOnly.map((testPath) =>
      issue('DISCOVERY_RUNNER_ONLY_UNEXPLAINED', { sourceRef: `source:${testPath}` })
    ),
    ...discovery.unexplainedCandidateOnly.map((testPath) =>
      issue('DISCOVERY_CANDIDATE_ONLY_UNEXPLAINED', { sourceRef: `source:${testPath}` })
    ),
  ];
}

function failedAnalyzerResult(analyzer, error) {
  const dimension = analyzer.DIMENSION || 'executionMultiplicity';
  return {
    analyzerId: analyzer.ANALYZER_ID,
    analyzerVersion: analyzer.ANALYZER_VERSION,
    dimension,
    required: true,
    status: 'failed',
    findings: [],
    issues: [
      issue('ANALYZER_EXECUTION_FAILED', {
        analyzerId: analyzer.ANALYZER_ID,
        dimension,
        detail: error.message,
      }),
    ],
  };
}

async function runAnalyzer(analyzer, input) {
  try {
    return await analyzer.analyze(input);
  } catch (error) {
    return failedAnalyzerResult(analyzer, error);
  }
}

async function runAnalyzersIndependently(input) {
  const common = {
    repoRoot: input.repoRoot,
    inventory: input.inventory,
    routeGraph: input.routeGraph,
    sourceIndex: input.sourceIndex,
  };
  return Promise.all([
    runAnalyzer(duplicate, common),
    runAnalyzer(targetValidity, common),
    runAnalyzer(oracleEffectiveness, common),
    runAnalyzer(parallelSafety, common),
    runAnalyzer(criticality, common),
  ]);
}

function readRepositoryIdentity(repoRoot) {
  const commit = childProcess.spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  const dirty = childProcess.spawnSync('git', ['status', '--short', '--untracked-files=no'], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    commit: commit.status === 0 ? commit.stdout.trim() : 'unknown',
    dirty: dirty.status !== 0 || dirty.stdout.trim() !== '',
  };
}

function toolMetadata(runnerResults) {
  return {
    version: 'test-portfolio-audit/1',
    runnerVersions: runnerResults.map((result) => ({
      runnerId: result.runnerId,
      version: result.version || 'unknown',
    })),
  };
}

function probeCandidatesFrom(analyzerResults, inventory) {
  const parallel = analyzerResults.find((result) => result.dimension === 'parallelSafety');
  const critical = analyzerResults.find((result) => result.dimension === 'criticality');
  const criticalByIdentity = new Map(
    (critical?.findings || []).map((finding) => [finding.identityKey, finding.value])
  );
  const parallelByIdentity = new Map(
    (parallel?.findings || []).map((finding) => [finding.identityKey, finding.value])
  );
  return inventory.tests.map((test) => ({
    ...test,
    parallelSafety: parallelByIdentity.get(test.identityKey) || 'unknown',
    criticality: criticalByIdentity.get(test.identityKey) || 'unknown',
  }));
}

async function runOptionalProbe({ options, repository, inventory, analyzerResults }) {
  if (options.probeLimit === 0) {
    return {
      requested: 0,
      selected: 0,
      completed: 0,
      failed: 0,
      timedOut: 0,
      unprobed: 0,
      issueCodes: [],
      results: [],
    };
  }
  if (!options.probeSandboxRoot) {
    return {
      requested: options.probeLimit,
      selected: 0,
      completed: 0,
      failed: 0,
      timedOut: 0,
      unprobed: options.probeLimit,
      issueCodes: ['PROBE_DISABLED_NO_SANDBOX'],
      results: [],
    };
  }
  try {
    const result = await runProbeQueue({
      repoRoot: options.repoRoot,
      sandboxRoot: options.probeSandboxRoot,
      expectedCommit: repository.commit,
      candidates: probeCandidatesFrom(analyzerResults, inventory),
      limit: options.probeLimit,
      budgetMs: options.probeBudgetMs,
    });
    const attempted = result.completed + result.failed + result.timedOut;
    return {
      ...result,
      requested: options.probeLimit,
      unprobed: Math.max(0, options.probeLimit - attempted),
    };
  } catch (error) {
    return {
      requested: options.probeLimit,
      selected: 0,
      completed: 0,
      failed: 0,
      timedOut: 0,
      unprobed: options.probeLimit,
      issueCodes: [error.code || 'PROBE_EXECUTION_FAILED'],
      results: [],
    };
  }
}

function safeRouteGraph(repoRoot, inventory) {
  try {
    return buildExecutionRouteGraph({ repoRoot, inventory });
  } catch (error) {
    return {
      routes: [],
      invocations: [],
      failed: true,
      issues: [
        issue('ROUTE_GRAPH_FAILED', {
          severity: 'fatal',
          sourceRef: 'source:.github/workflows',
          detail: error.message,
        }),
      ],
    };
  }
}

function createStaticAnalysisView(repoRoot) {
  const analysisRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-portfolio-static-view-'));
  const includedExtensions = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs']);
  for (const absolutePath of collectFiles(
    repoRoot,
    (_filePath, name) => name === 'package.json' || includedExtensions.has(path.extname(name))
  )) {
    const relativePath = normalizeRepoPath(repoRoot, absolutePath);
    const targetPath = path.resolve(analysisRoot, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    try {
      fs.linkSync(absolutePath, targetPath);
    } catch {
      fs.copyFileSync(absolutePath, targetPath);
    }
  }
  return analysisRoot;
}

function safeSourceIndex(repoRoot, packagePaths) {
  let analysisRoot;
  try {
    analysisRoot = createStaticAnalysisView(repoRoot);
    return {
      sourceIndex: targetValidity.buildSourceIndex({ repoRoot: analysisRoot, packagePaths }),
      analysisRoot,
      issues: [],
    };
  } catch (error) {
    if (analysisRoot) fs.rmSync(analysisRoot, { recursive: true, force: true });
    return {
      sourceIndex: null,
      analysisRoot: null,
      issues: [issue('TARGET_SOURCE_INDEX_FAILED', { detail: error.message })],
    };
  }
}

function collectIssues({ discoveryRun, discovery, analyzerResults, setupIssues }) {
  return [
    ...(discoveryRun.issues || []),
    ...reconciliationIssues(discovery),
    ...setupIssues,
    ...analyzerResults.flatMap((result) => result.issues || []),
  ];
}

function duration(value) {
  return Math.max(0, Math.round(value));
}

function buildRunReceipt({
  reduced,
  writes,
  probeResults,
  staticDurationMs,
  probeDurationMs,
  totalDurationMs,
}) {
  return {
    schemaVersion: 'test-portfolio-audit-run-receipt/v1',
    status: reduced.artifact.status,
    auditPath: writes.auditPath,
    summaryPath: writes.summaryPath,
    auditSha256: writes.auditSha256,
    executableTestCount: reduced.artifact.tests.length,
    discovery: reduced.artifact.discovery,
    findings: reduced.artifact.totals,
    probe: {
      ...reduced.artifact.probe,
      issueCodes: stableUnique(probeResults.issueCodes || []),
    },
    staticAnalysisDurationMs: duration(staticDurationMs),
    probeDurationMs: duration(probeDurationMs),
    totalDurationMs: duration(totalDurationMs),
  };
}

async function runAudit(options) {
  const startedAt = performance.now();
  const repository = readRepositoryIdentity(options.repoRoot);
  const discoveryRun = discoverConfiguredTests({ repoRoot: options.repoRoot });
  const filesystemCandidates = normalizeFilesystemCandidates(
    options.repoRoot,
    scanFilesystemCandidates({ repoRoot: options.repoRoot })
  );
  const runnerResults = expandRunnerExclusions(discoveryRun.runnerResults, filesystemCandidates);
  const preliminaryInventory = buildCanonicalInventory(runnerResults, { routes: [] });
  const routeGraph = discoveryRun.failed
    ? { routes: [], invocations: [], issues: [], failed: true }
    : safeRouteGraph(options.repoRoot, preliminaryInventory.tests);
  const configuredCandidateRefs = [
    ...runnerResults.flatMap((result) => result.configuredCandidateRefs || []),
    ...extractConfiguredCandidateRefs(routeGraph).filter((reference) =>
      fs.existsSync(path.resolve(options.repoRoot, reference.testPath))
    ),
  ];
  const discovery = attachDiscoveryCounts(
    reconcileDiscovery({
      runnerResults,
      filesystemCandidates,
      configuredCandidateRefs,
    })
  );
  const inventory = buildCanonicalInventory(runnerResults, routeGraph);
  const sourceIndexResult = safeSourceIndex(options.repoRoot, discoveryRun.packagePaths);
  let analyzerResults;
  try {
    analyzerResults = await runAnalyzersIndependently({
      repoRoot: options.repoRoot,
      inventory,
      routeGraph,
      sourceIndex: sourceIndexResult.sourceIndex,
    });
  } finally {
    if (sourceIndexResult.analysisRoot) {
      fs.rmSync(sourceIndexResult.analysisRoot, { recursive: true, force: true });
    }
  }
  const staticFinishedAt = performance.now();
  const probeResults = await runOptionalProbe({
    options,
    repository,
    inventory,
    analyzerResults,
  });
  const probeFinishedAt = performance.now();
  const setupIssues = [...sourceIndexResult.issues, ...(routeGraph.issues || [])];
  const fatalIssues = [
    ...(discoveryRun.issues || []).filter((entry) => entry.severity === 'fatal'),
    ...(routeGraph.issues || []).filter((entry) => entry.severity === 'fatal'),
  ];
  const reduced = reduceAudit({
    repository,
    tool: toolMetadata(runnerResults),
    inventory,
    routeGraph,
    discovery: {
      ...discovery,
      issues: [
        ...runnerResults.flatMap((result) => result.issues || []),
        ...reconciliationIssues(discovery),
      ],
    },
    analyzerResults,
    probeResults,
    issues: collectIssues({
      discoveryRun,
      discovery,
      analyzerResults,
      setupIssues,
    }),
    fatalIssues,
  });
  const summaryMarkdown = renderSummary(reduced.artifact);
  const writes = writeAuditArtifacts({
    outputDir: options.outputDir,
    canonicalBytes: reduced.canonicalBytes,
    summaryMarkdown,
  });
  const finishedAt = performance.now();
  return {
    ...reduced,
    ...writes,
    receipt: buildRunReceipt({
      reduced,
      writes,
      probeResults,
      staticDurationMs: staticFinishedAt - startedAt,
      probeDurationMs: probeFinishedAt - staticFinishedAt,
      totalDurationMs: finishedAt - startedAt,
    }),
  };
}

function requireNext(argv, index, option) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) {
    throw auditError('OPTION_VALUE_REQUIRED', `OPTION_VALUE_REQUIRED:${option}`);
  }
  return value;
}

function parseBoundedInteger(value, minimum, maximum, option) {
  if (!/^-?\d+$/u.test(value)) {
    throw auditError('OPTION_VALUE_INVALID', `OPTION_VALUE_INVALID:${option}`);
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw auditError('OPTION_VALUE_OUT_OF_RANGE', `OPTION_VALUE_OUT_OF_RANGE:${option}`);
  }
  return numeric;
}

function parseArgs(argv) {
  const options = {
    json: false,
    repoRoot: process.cwd(),
    outputDir: null,
    probeLimit: 20,
    probeBudgetMs: 600_000,
    probeSandboxRoot: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--json') options.json = true;
    else if (option === '--repo-root') options.repoRoot = requireNext(argv, ++index, option);
    else if (option === '--output-dir') options.outputDir = requireNext(argv, ++index, option);
    else if (option === '--probe-limit') {
      options.probeLimit = parseBoundedInteger(requireNext(argv, ++index, option), 0, 20, option);
    } else if (option === '--probe-budget-ms') {
      options.probeBudgetMs = parseBoundedInteger(
        requireNext(argv, ++index, option),
        0,
        600_000,
        option
      );
    } else if (option === '--probe-sandbox-root') {
      options.probeSandboxRoot = requireNext(argv, ++index, option);
    } else {
      throw auditError('UNKNOWN_OPTION', `UNKNOWN_OPTION:${option}`);
    }
  }
  options.repoRoot = path.resolve(options.repoRoot);
  options.outputDir = path.resolve(
    options.outputDir || path.join(options.repoRoot, '.artifacts', 'ci')
  );
  options.probeSandboxRoot = options.probeSandboxRoot
    ? path.resolve(options.probeSandboxRoot)
    : null;
  return options;
}

function renderConsoleReceipt(receipt) {
  return [
    `Status: ${receipt.status}`,
    `Audit: ${receipt.auditPath}`,
    `Summary: ${receipt.summaryPath}`,
    `Tests: ${receipt.executableTestCount}`,
    '',
  ].join('\n');
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runAudit(options);
    process.stdout.write(
      options.json ? `${JSON.stringify(result.receipt)}\n` : renderConsoleReceipt(result.receipt)
    );
    process.exitCode =
      result.artifact.status === 'COMPLETE' ? 0 : result.artifact.status === 'INCOMPLETE' ? 2 : 1;
  } catch (error) {
    process.stderr.write(`${error.code || error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = {
  main,
  parseArgs,
  runAudit,
};
