const { createHash } = require('node:crypto');
const {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { availableParallelism } = require('node:os');
const {
  basename,
  dirname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
  win32,
} = require('node:path');
const { performance } = require('node:perf_hooks');
const { spawnSync } = require('node:child_process');

module.exports.DISCOVERY_CONTRACT_VERSION = 'node-runner-discovery/v1';
const REPOSITORY_PACKAGE_PREFIX = 'packages/bmad-speckit/';

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function canonicalFsPath(value) {
  const resolved = resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function assertNoLinkedPathComponents(repoRoot, target) {
  const root = resolve(repoRoot);
  const pathFromRoot = relative(root, target);
  let current = root;
  for (const segment of ['', ...pathFromRoot.split(require('node:path').sep)]) {
    if (segment) current = join(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) {
        throw new Error('CI_NODE_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT');
      }
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
  }
}

function assertGovernedNodeArtifactPath(repoRoot, targetPath) {
  const allowedRoot = resolve(repoRoot, '.artifacts', 'test-portfolio');
  const target = resolve(targetPath);
  const pathFromAllowedRoot = relative(allowedRoot, target);
  if (
    pathFromAllowedRoot === '' ||
    pathFromAllowedRoot === '..' ||
    pathFromAllowedRoot.startsWith(`..${require('node:path').sep}`) ||
    isAbsolute(pathFromAllowedRoot)
  ) {
    throw new Error('CI_NODE_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT');
  }
  assertNoLinkedPathComponents(repoRoot, target);
  return target;
}

function resolveExactNodeArtifactPaths({ packageRoot, junitOutput, timingOutput }) {
  const repoRoot = resolve(packageRoot, '..', '..');
  const canonicalPackageRoot = resolve(repoRoot, 'packages', 'bmad-speckit');
  if (canonicalFsPath(packageRoot) !== canonicalFsPath(canonicalPackageRoot)) {
    throw new Error('NODE_TEST_EXACT_ROOT_MISMATCH');
  }
  const junitPath = assertGovernedNodeArtifactPath(repoRoot, junitOutput);
  const timingPath = assertGovernedNodeArtifactPath(repoRoot, timingOutput);
  if (canonicalFsPath(junitPath) === canonicalFsPath(timingPath)) {
    throw new Error('CI_NODE_ARTIFACT_PATH_INVALID');
  }
  return { repoRoot, junitPath, timingPath };
}

function writeGovernedNodeArtifact({ repoRoot, outputPath, content }) {
  const target = assertGovernedNodeArtifactPath(repoRoot, outputPath);
  mkdirSync(dirname(target), { recursive: true });
  assertGovernedNodeArtifactPath(repoRoot, target);
  writeFileSync(target, content);
}

function resolveExactNodeTestPaths({
  packageRoot,
  expectedPackageRoot = packageRoot,
  requestedPaths,
}) {
  if (
    typeof packageRoot !== 'string' ||
    packageRoot.trim() === '' ||
    (!isAbsolute(packageRoot) && !win32.isAbsolute(packageRoot)) ||
    !Array.isArray(requestedPaths) ||
    requestedPaths.length === 0
  ) {
    throw new Error('NODE_TEST_EXACT_PATH_INVALID');
  }
  let actualRoot;
  let expectedRoot;
  try {
    actualRoot = canonicalFsPath(realpathSync(packageRoot));
    expectedRoot = canonicalFsPath(realpathSync(expectedPackageRoot));
  } catch {
    throw new Error('NODE_TEST_EXACT_ROOT_MISMATCH');
  }
  if (actualRoot !== expectedRoot) {
    throw new Error('NODE_TEST_EXACT_ROOT_MISMATCH');
  }
  const resolved = requestedPaths.map((value) => {
    if (
      typeof value !== 'string' ||
      value === '' ||
      value !== value.trim() ||
      hasControlCharacter(value) ||
      /^[A-Za-z]:/u.test(value) ||
      win32.isAbsolute(value) ||
      posix.isAbsolute(value) ||
      !value.startsWith(REPOSITORY_PACKAGE_PREFIX)
    ) {
      throw new Error('NODE_TEST_EXACT_PATH_INVALID');
    }
    const packageRelativePath = value.slice(REPOSITORY_PACKAGE_PREFIX.length);
    if (
      packageRelativePath !== posix.normalize(packageRelativePath) ||
      !packageRelativePath.startsWith('tests/') ||
      !packageRelativePath.endsWith('.test.js')
    ) {
      throw new Error('NODE_TEST_EXACT_PATH_INVALID');
    }
    const absolutePath = resolve(packageRoot, packageRelativePath);
    if (
      !existsSync(absolutePath) ||
      !lstatSync(absolutePath).isFile() ||
      lstatSync(absolutePath).isSymbolicLink()
    ) {
      throw new Error('NODE_TEST_EXACT_PATH_MISSING');
    }
    let realPath;
    try {
      realPath = realpathSync(absolutePath);
    } catch {
      throw new Error('NODE_TEST_EXACT_PATH_MISSING');
    }
    if (canonicalFsPath(realPath) !== canonicalFsPath(absolutePath)) {
      throw new Error('NODE_TEST_EXACT_PATH_INVALID');
    }
    return packageRelativePath;
  });
  if (new Set(resolved).size !== resolved.length) {
    throw new Error('NODE_TEST_EXACT_PATH_DUPLICATE');
  }
  return resolved;
}

function canonicalJsonBytes(value) {
  function normalize(candidate) {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (candidate && typeof candidate === 'object') {
      return Object.fromEntries(
        Object.keys(candidate)
          .sort()
          .map((key) => [key, normalize(candidate[key])])
      );
    }
    return candidate;
  }
  return Buffer.from(`${JSON.stringify(normalize(value))}\n`, 'utf8');
}

function timingEventId(commitSha, identityKey) {
  return `sha256:${createHash('sha256')
    .update(canonicalJsonBytes({ commitSha, identityKey }))
    .digest('hex')}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function writeJunitReport({ repoRoot, outputPath, events }) {
  const failures = events.filter((event) => event.outcome !== 'passed').length;
  const durationMs = events.reduce((sum, event) => sum + event.durationMs, 0);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites tests="${events.length}" failures="${failures}" time="${(
      durationMs / 1000
    ).toFixed(3)}">`,
    `  <testsuite name="node" tests="${events.length}" failures="${failures}" time="${(
      durationMs / 1000
    ).toFixed(3)}">`,
  ];
  for (const event of events) {
    const testcase = `    <testcase classname="node" name="${escapeXml(
      event.identityKey
    )}" time="${(event.durationMs / 1000).toFixed(3)}"`;
    if (event.outcome === 'passed') {
      lines.push(`${testcase} />`);
    } else {
      lines.push(`${testcase}>`);
      lines.push('      <failure message="Node test file failed" />');
      lines.push('    </testcase>');
    }
  }
  lines.push('  </testsuite>', '</testsuites>', '');
  writeGovernedNodeArtifact({
    repoRoot,
    outputPath,
    content: lines.join('\n'),
  });
}

function collectTests(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTests(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizePathForMatch(value) {
  return String(value || '').replace(/\\/g, '/');
}

function matchesFilter(testFile, filter, cwd) {
  const normalizedFilter = normalizePathForMatch(filter);
  const absoluteTestFile = resolve(cwd, testFile);
  const relativeTestFile = normalizePathForMatch(relative(cwd, absoluteTestFile));
  const absoluteFilter = isAbsolute(filter) ? normalizePathForMatch(resolve(filter)) : null;

  return (
    relativeTestFile === normalizedFilter ||
    relativeTestFile.includes(normalizedFilter) ||
    relativeTestFile.endsWith(`/${normalizedFilter}`) ||
    basename(testFile) === normalizedFilter ||
    basename(testFile).includes(normalizedFilter) ||
    (absoluteFilter != null && normalizePathForMatch(absoluteTestFile) === absoluteFilter)
  );
}

function applyFilters(testFiles, filters, cwd) {
  if (filters.length === 0) return testFiles;
  return testFiles.filter((testFile) =>
    filters.some((filter) => matchesFilter(testFile, filter, cwd))
  );
}

const stateMutatingTestNames = new Set([
  'ai-tdd-projection-manifest.test.js',
  'bmad-help-bmads-fusion-contract.test.js',
  'bmads-six-model-installed-parity.test.js',
  'judge-runtime-installed-parity.test.js',
  'main-agent-build-dist.test.js',
  'main-agent-dist-no-redundant-assets.test.js',
  'main-agent-full-orchestration-no-regression.test.js',
  'main-agent-runtime-hash-installed-parity.test.js',
  'pack-bmad-mirror.test.js',
]);
const stableTestConcurrency = Math.max(1, Math.min(4, availableParallelism()));

function runTestFiles(files, extraArgs, preloadArgs, childEnv) {
  if (files.length === 0) return 0;
  const result = spawnSync(process.execPath, [...preloadArgs, '--test', ...extraArgs, ...files], {
    stdio: 'inherit',
    env: childEnv,
  });

  if (typeof result.status === 'number') return result.status;

  if (result.error) {
    throw result.error;
  }

  return 1;
}

function isStateMutatingTest(testFile) {
  return stateMutatingTestNames.has(basename(testFile));
}

function main() {
  const args = process.argv.slice(2);
  const exactMode = args[0] === '--ci-exact';
  const filters = (exactMode ? args.slice(1) : args).filter((arg) => String(arg).trim() !== '');
  let testFiles = [];

  if (exactMode) {
    const expectedPackageRoot = String(process.env.CI_NODE_PACKAGE_ROOT || '').trim();
    if (expectedPackageRoot === '') {
      throw new Error('CI_NODE_PACKAGE_ROOT_REQUIRED');
    }
    testFiles = resolveExactNodeTestPaths({
      packageRoot: process.cwd(),
      expectedPackageRoot,
      requestedPaths: filters,
    });
  } else {
    try {
      testFiles = collectTests('tests').sort();
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        console.log('No tests yet');
        return 0;
      }
      throw error;
    }
  }

  if (testFiles.length === 0) {
    console.log('No tests yet');
    return 0;
  }

  if (!exactMode) {
    testFiles = applyFilters(testFiles, filters, process.cwd());
  }

  if (!exactMode && filters.length > 0 && testFiles.length === 0) {
    console.error(`No tests matched filters: ${filters.join(', ')}`);
    return 1;
  }

  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const tsSourceRegisterPath = './tests/register-ts-source.cjs';
  const preloadArgs = existsSync(tsSourceRegisterPath) ? ['-r', tsSourceRegisterPath] : [];
  if (exactMode) {
    const commitSha = String(process.env.CI_COMMIT_SHA || '')
      .trim()
      .toLowerCase();
    const planHash = String(process.env.CI_PLAN_HASH || '')
      .trim()
      .toLowerCase();
    const junitOutput = String(process.env.CI_JUNIT_OUTPUT || '').trim();
    const timingOutput = String(process.env.CI_TIMING_OUTPUT || '').trim();
    if (
      !/^[0-9a-f]{40}$/u.test(commitSha) ||
      !/^sha256:[0-9a-f]{64}$/u.test(planHash) ||
      junitOutput === '' ||
      timingOutput === ''
    ) {
      throw new Error('CI_NODE_TIMING_CONTEXT_REQUIRED');
    }
    const { repoRoot, junitPath, timingPath } = resolveExactNodeArtifactPaths({
      packageRoot: process.cwd(),
      junitOutput,
      timingOutput,
    });
    for (const outputPath of [junitPath, timingPath]) {
      rmSync(outputPath, { force: true });
    }
    const events = [];
    let status = 0;
    for (const testFile of testFiles) {
      const startedAt = performance.now();
      const fileStatus = runTestFiles([testFile], ['--test-concurrency=1'], preloadArgs, childEnv);
      const durationMs = Math.max(1, Math.round(performance.now() - startedAt));
      const testPath = `${REPOSITORY_PACKAGE_PREFIX}${normalizePathForMatch(testFile)}`;
      const identityKey = `node::${testPath}`;
      events.push({
        eventId: timingEventId(commitSha, identityKey),
        identityKey,
        runnerId: 'node',
        testPath,
        durationMs,
        outcome: fileStatus === 0 ? 'passed' : 'failed',
      });
      if (status === 0 && fileStatus !== 0) status = fileStatus;
    }
    writeGovernedNodeArtifact({
      repoRoot,
      outputPath: timingPath,
      content: canonicalJsonBytes({
        commitSha,
        planHash,
        events: events.sort((left, right) =>
          left.identityKey.localeCompare(right.identityKey, 'en')
        ),
      }),
    });
    writeJunitReport({ repoRoot, outputPath: junitPath, events });
    return status;
  }
  const stableTestFiles = testFiles.filter((testFile) => !isStateMutatingTest(testFile));
  const stateMutatingTestFiles = testFiles.filter(isStateMutatingTest);

  let status = runTestFiles(
    stableTestFiles,
    [`--test-concurrency=${stableTestConcurrency}`],
    preloadArgs,
    childEnv
  );
  if (status === 0) {
    status = runTestFiles(stateMutatingTestFiles, ['--test-concurrency=1'], preloadArgs, childEnv);
  }
  return status;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports.resolveExactNodeTestPaths = resolveExactNodeTestPaths;
