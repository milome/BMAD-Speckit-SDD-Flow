const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const { compareTestIdentity, normalizeRepoPath, stableUnique } = require('./canonical.cjs');

const SKIPPED_DIRECTORIES = new Set([
  '.artifacts',
  '.codex-tmp',
  '.git',
  '.worktrees',
  'dist',
  'node_modules',
]);

const NODE_RUNNER_ADAPTER = Object.freeze({
  runnerId: 'package-node-test',
  scriptPath: 'packages/bmad-speckit/scripts/run-node-tests.cjs',
  testsRoot: 'packages/bmad-speckit/tests',
  suffix: '.test.js',
  contractVersion: 'node-runner-discovery/v1',
});

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];

  function visit(directory) {
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  visit(root);
  return files.sort();
}

function propertyName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return null;
}

function findProperty(objectLiteral, name) {
  return objectLiteral.properties.find(
    (property) => ts.isPropertyAssignment(property) && propertyName(property.name) === name
  );
}

function findVitestConfigObject(sourceFile) {
  let configObject = null;

  function visit(node) {
    if (configObject) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineConfig' &&
      node.arguments.length > 0 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      configObject = node.arguments[0];
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return configObject;
}

function extractLiteralArray(objectLiteral, name) {
  const property = findProperty(objectLiteral, name);
  if (!property) return { values: [], dynamic: false };
  if (!ts.isArrayLiteralExpression(property.initializer)) {
    return { values: [], dynamic: true };
  }

  const values = [];
  let dynamic = false;
  for (const element of property.initializer.elements) {
    if (ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element)) {
      values.push(element.text);
    } else {
      dynamic = true;
    }
  }
  return { values, dynamic };
}

function readVitestConfigMetadata({ repoRoot, configPath }) {
  const absoluteConfigPath = path.resolve(repoRoot, configPath);
  const normalizedConfigPath = normalizeRepoPath(repoRoot, absoluteConfigPath);
  const source = fs.readFileSync(absoluteConfigPath, 'utf8');
  const sourceFile = ts.createSourceFile(
    absoluteConfigPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const configObject = findVitestConfigObject(sourceFile);
  if (!configObject) {
    return {
      normalizedConfigPath,
      includes: [],
      exclusions: [],
      exclusionDynamic: false,
    };
  }

  const testProperty = findProperty(configObject, 'test');
  if (!testProperty || !ts.isObjectLiteralExpression(testProperty.initializer)) {
    return {
      normalizedConfigPath,
      includes: [],
      exclusions: [],
      exclusionDynamic: false,
    };
  }

  const includes = extractLiteralArray(testProperty.initializer, 'include');
  const exclusions = extractLiteralArray(testProperty.initializer, 'exclude');
  return {
    normalizedConfigPath,
    includes: stableUnique(
      includes.values.map((testPath) => normalizeRepoPath(repoRoot, testPath))
    ),
    exclusions: stableUnique(
      exclusions.values.map((testPath) => normalizeRepoPath(repoRoot, testPath))
    ),
    exclusionDynamic: exclusions.dynamic,
  };
}

function extractLiteralVitestExclusions({ repoRoot, configPath }) {
  return readVitestConfigMetadata({ repoRoot, configPath }).exclusions;
}

function resolveVitestCli() {
  try {
    return require.resolve('vitest/vitest.mjs');
  } catch (error) {
    if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
    return path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
  }
}

function configuredCandidateRefs(metadata) {
  return metadata.includes.map((testPath) => ({
    testPath,
    sourceRef: `source:${metadata.normalizedConfigPath}#test.include`,
  }));
}

function discoverVitestTests({
  repoRoot,
  configPath,
  runnerId = 'root-vitest',
  spawn = spawnSync,
}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-portfolio-vitest-list-'));
  const outputPath = path.join(tempRoot, 'files.json');
  let metadata = {
    normalizedConfigPath: normalizeRepoPath(repoRoot, configPath),
    includes: [],
    exclusions: [],
    exclusionDynamic: false,
  };

  try {
    metadata = readVitestConfigMetadata({ repoRoot, configPath });
    const vitestCli = resolveVitestCli();
    const result = spawn(
      process.execPath,
      [
        vitestCli,
        'list',
        '--config',
        path.resolve(repoRoot, configPath),
        '--filesOnly',
        `--json=${outputPath}`,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true,
      }
    );

    if (result.error || result.status !== 0 || !fs.existsSync(outputPath)) {
      return {
        runnerId,
        status: 'unsupported',
        tests: [],
        explicitExclusions: metadata.exclusions,
        configuredCandidateRefs: configuredCandidateRefs(metadata),
        issues: [{ code: 'RUNNER_DISCOVERY_FAILED', runnerId }],
      };
    }

    const rows = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    if (!Array.isArray(rows)) throw new Error('VITEST_DISCOVERY_OUTPUT_INVALID');
    const tests = rows
      .map((row) => row && row.file)
      .filter((file) => typeof file === 'string')
      .map((file) => ({
        testPath: normalizeRepoPath(repoRoot, file),
        runnerId,
      }))
      .sort(compareTestIdentity);
    const issues = metadata.exclusionDynamic
      ? [
          {
            code: 'VITEST_EXCLUSION_DYNAMIC',
            runnerId,
            sourceRef: `source:${metadata.normalizedConfigPath}#test.exclude`,
          },
        ]
      : [];

    return {
      runnerId,
      status: issues.length === 0 ? 'complete' : 'unsupported',
      tests,
      explicitExclusions: metadata.exclusions,
      configuredCandidateRefs: configuredCandidateRefs(metadata),
      issues,
    };
  } catch {
    return {
      runnerId,
      status: 'unsupported',
      tests: [],
      explicitExclusions: metadata.exclusions,
      configuredCandidateRefs: configuredCandidateRefs(metadata),
      issues: [{ code: 'RUNNER_DISCOVERY_FAILED', runnerId }],
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function discoverNodeTests({ repoRoot }) {
  const script = path.resolve(repoRoot, NODE_RUNNER_ADAPTER.scriptPath);
  let contractVersion;
  let resolvedScript;
  let originalCacheEntry;
  let hadOriginalCacheEntry = false;
  try {
    resolvedScript = require.resolve(script);
    hadOriginalCacheEntry = Object.prototype.hasOwnProperty.call(require.cache, resolvedScript);
    originalCacheEntry = require.cache[resolvedScript];
    delete require.cache[resolvedScript];
    contractVersion = require(resolvedScript).DISCOVERY_CONTRACT_VERSION;
  } catch {
    contractVersion = null;
  } finally {
    if (resolvedScript) {
      if (hadOriginalCacheEntry) require.cache[resolvedScript] = originalCacheEntry;
      else delete require.cache[resolvedScript];
    }
  }
  if (contractVersion !== NODE_RUNNER_ADAPTER.contractVersion) {
    return {
      runnerId: NODE_RUNNER_ADAPTER.runnerId,
      status: 'unsupported',
      tests: [],
      issues: [{ code: 'NODE_RUNNER_CONVENTION_DRIFT' }],
    };
  }

  const tests = walkFiles(path.resolve(repoRoot, NODE_RUNNER_ADAPTER.testsRoot))
    .filter((file) => file.endsWith(NODE_RUNNER_ADAPTER.suffix))
    .map((file) => ({
      testPath: normalizeRepoPath(repoRoot, file),
      runnerId: NODE_RUNNER_ADAPTER.runnerId,
    }))
    .sort(compareTestIdentity);
  return {
    runnerId: NODE_RUNNER_ADAPTER.runnerId,
    status: 'complete',
    tests,
    issues: [],
  };
}

function scanFilesystemCandidates({ repoRoot, configuredIncludes = [] }) {
  const configuredPaths = new Set(
    configuredIncludes.map((entry) =>
      normalizeRepoPath(repoRoot, typeof entry === 'string' ? entry : entry.testPath)
    )
  );
  return stableUnique(
    walkFiles(repoRoot)
      .map((file) => normalizeRepoPath(repoRoot, file))
      .filter((testPath) => /\.(?:test|spec)\..+$/i.test(testPath) || configuredPaths.has(testPath))
  );
}

function reconcileDiscovery({ runnerResults, filesystemCandidates, configuredCandidateRefs }) {
  const runnerResolved = stableUnique(
    runnerResults.flatMap((result) => result.tests.map((test) => test.testPath))
  );
  const candidates = stableUnique([
    ...filesystemCandidates,
    ...configuredCandidateRefs.map((reference) => reference.testPath),
  ]);
  const exclusions = new Set(runnerResults.flatMap((result) => result.explicitExclusions || []));
  const runnerOnly = runnerResolved.filter((testPath) => !candidates.includes(testPath));
  const candidateOnly = candidates.filter((testPath) => !runnerResolved.includes(testPath));
  const explainedCandidateOnly = candidateOnly
    .filter((testPath) => exclusions.has(testPath))
    .map((testPath) => ({
      testPath,
      reason: 'EXPLICIT_RUNNER_EXCLUSION',
    }));
  const unexplainedCandidateOnly = candidateOnly.filter((testPath) => !exclusions.has(testPath));

  return {
    runnerResolved,
    candidates,
    runnerOnly,
    candidateOnly,
    unexplainedRunnerOnly: runnerOnly,
    explainedCandidateOnly,
    unexplainedCandidateOnly,
    complete:
      runnerResults.every((result) => result.status === 'complete') &&
      runnerOnly.length === 0 &&
      unexplainedCandidateOnly.length === 0,
  };
}

module.exports = {
  discoverNodeTests,
  discoverVitestTests,
  extractLiteralVitestExclusions,
  reconcileDiscovery,
  scanFilesystemCandidates,
};
