'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const {
  assertGovernedPath,
  fail,
  readCanonicalArtifact,
  resolveOutputPath,
  writeCanonicalArtifact,
} = require('./canonical-artifact.cjs');
const { validatePackageDescriptor } = require('./prepare-package-artifact.cjs');
const { summarizeTimingEvents } = require('./summarize-test-timings.cjs');
const { validateRunManifest } = require('./write-ci-run-manifest.cjs');

const PARALLEL_LANES = new Set(['core', 'product_survival', 'feature']);
const VITEST_TEST_PATH = /\.(?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/iu;

function canonicalFsPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function validateExecutablePath(repoRoot, testPath) {
  const absoluteRoot = fs.realpathSync(repoRoot);
  const absolutePath = path.resolve(repoRoot, testPath);
  if (!fs.existsSync(absolutePath)) fail('CI_SHARD_PATH_MISSING', { testPath });
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail('CI_SHARD_PATH_INVALID', { testPath });
  }
  const realPath = fs.realpathSync(absolutePath);
  const relative = path.relative(absoluteRoot, realPath);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    canonicalFsPath(realPath) !== canonicalFsPath(absolutePath)
  ) {
    fail('CI_SHARD_PATH_OUTSIDE_ROOT', { testPath });
  }
}

function normalizeVitestIdentity(identityKey) {
  if (typeof identityKey !== 'string' || !identityKey.startsWith('vitest::')) {
    fail('CI_SHARD_RUNNER_INVALID', { identityKey });
  }
  const testPath = identityKey.slice('vitest::'.length);
  if (testPath.startsWith('packages/bmad-speckit/tests/')) {
    fail('CI_SHARD_RUNNER_INVALID', { identityKey });
  }
  if (
    testPath === '' ||
    /^[A-Za-z]:/u.test(testPath) ||
    path.win32.isAbsolute(testPath) ||
    path.posix.isAbsolute(testPath) ||
    testPath === '..' ||
    testPath.startsWith('../') ||
    testPath.includes('/../') ||
    [...testPath].some((character) => character.charCodeAt(0) <= 0x1f)
  ) {
    fail('CI_SHARD_PATH_INVALID', { identityKey });
  }
  const normalized = path.posix.normalize(testPath.replace(/\\/g, '/'));
  if (normalized !== testPath) fail('CI_SHARD_PATH_INVALID', { identityKey });
  if (
    (!testPath.startsWith('tests/') && !testPath.startsWith('packages/')) ||
    !VITEST_TEST_PATH.test(testPath)
  ) {
    fail('CI_SHARD_PATH_INVALID', { identityKey });
  }
  return testPath;
}

function normalizeNodeIdentity(identityKey) {
  if (typeof identityKey !== 'string' || !identityKey.startsWith('node::')) {
    fail('CI_SHARD_RUNNER_INVALID', { identityKey });
  }
  const testPath = identityKey.slice('node::'.length);
  if (
    testPath === '' ||
    /^[A-Za-z]:/u.test(testPath) ||
    path.win32.isAbsolute(testPath) ||
    path.posix.isAbsolute(testPath) ||
    testPath !== path.posix.normalize(testPath.replace(/\\/g, '/')) ||
    !testPath.startsWith('packages/bmad-speckit/tests/') ||
    !testPath.endsWith('.test.js') ||
    [...testPath].some((character) => character.charCodeAt(0) <= 0x1f)
  ) {
    fail('CI_SHARD_PATH_INVALID', { identityKey });
  }
  return testPath;
}

function resolveCiShard({ manifest, lane, shardId }) {
  validateRunManifest(manifest);
  if (manifest.status !== 'planned') fail('CI_MANIFEST_NOT_PLANNED');
  const shard = manifest.plan.shardPlan.shards.find(
    (candidate) => candidate.lane === lane && candidate.shardId === shardId
  );
  if (!shard) fail('CI_SHARD_NOT_FOUND', { lane, shardId });
  const vitestPaths = [];
  const nodePaths = [];
  for (const identityKey of shard.identityKeys) {
    if (identityKey.startsWith('vitest::')) {
      vitestPaths.push(normalizeVitestIdentity(identityKey));
      continue;
    }
    if (identityKey.startsWith('node::')) {
      nodePaths.push(normalizeNodeIdentity(identityKey));
      continue;
    }
    fail('CI_SHARD_RUNNER_INVALID', { identityKey });
  }
  const allPaths = [...vitestPaths, ...nodePaths];
  if (new Set(allPaths).size !== allPaths.length) fail('CI_SHARD_PATH_DUPLICATE');
  return {
    configPath: PARALLEL_LANES.has(lane)
      ? 'vitest.parallel-safe.config.ts'
      : 'vitest.repo-mutating.config.ts',
    vitestPaths,
    nodePaths,
    planHash: manifest.planHash,
    ...(Array.isArray(shard.expectedFailureIdentityKeys)
      ? { expectedFailureIdentityKeys: [...shard.expectedFailureIdentityKeys] }
      : {}),
  };
}

function resolveVitestShard(input) {
  const resolved = resolveCiShard(input);
  if (resolved.nodePaths.length > 0) fail('CI_SHARD_RUNNER_INVALID');
  return {
    configPath: resolved.configPath,
    testPaths: resolved.vitestPaths,
    planHash: resolved.planHash,
  };
}

function defaultRunCommand({ command, args, cwd, env }) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return { status: result.status ?? 1 };
}

function mergeJunitArtifacts({ repoRoot, outputPath, junitPaths }) {
  const suites = [];
  let tests = 0;
  let failures = 0;
  for (const junitPath of junitPaths) {
    assertGovernedPath(repoRoot, junitPath);
    if (!fs.existsSync(junitPath) || !fs.lstatSync(junitPath).isFile()) {
      fail('CI_JUNIT_EVIDENCE_MISSING', { junitPath });
    }
    const xml = fs.readFileSync(junitPath, 'utf8');
    if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) fail('CI_JUNIT_EVIDENCE_INVALID', { junitPath });
    const matches = [...xml.matchAll(/<testsuite\b[\s\S]*?<\/testsuite>/gu)].map(
      (match) => match[0]
    );
    if (matches.length === 0) fail('CI_JUNIT_EVIDENCE_INVALID', { junitPath });
    for (const suite of matches) {
      const openingTag = suite.match(/^<testsuite\b[^>]*>/u)?.[0] || '';
      tests += Number(openingTag.match(/\btests="(\d+)"/u)?.[1] || 0);
      failures += Number(openingTag.match(/\bfailures="(\d+)"/u)?.[1] || 0);
      suites.push(suite);
    }
  }
  assertGovernedPath(repoRoot, outputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  assertGovernedPath(repoRoot, outputPath);
  fs.writeFileSync(
    outputPath,
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuites tests="${tests}" failures="${failures}">`,
      ...suites,
      '</testsuites>',
      '',
    ].join('\n'),
    'utf8'
  );
  return path.relative(repoRoot, outputPath).replace(/\\/g, '/');
}

function mergeTimingArtifacts({
  repoRoot,
  outputDir,
  safeShardName,
  commitSha,
  planHash,
  timingPaths,
  expectedIdentityKeys,
  requireCompleteIdentityParity = true,
}) {
  const events = [];
  for (const timingPath of timingPaths) {
    let artifact;
    try {
      artifact = readCanonicalArtifact({ repoRoot, filePath: timingPath }).artifact;
    } catch (error) {
      if (error?.code === 'ENOENT') fail('CI_TIMING_EVIDENCE_MISSING', { timingPath });
      throw error;
    }
    if (
      !artifact ||
      typeof artifact !== 'object' ||
      Array.isArray(artifact) ||
      artifact.commitSha !== commitSha ||
      artifact.planHash !== planHash ||
      !Array.isArray(artifact.events)
    ) {
      fail('CI_TIMING_EVIDENCE_INVALID', { timingPath });
    }
    events.push(...artifact.events);
  }
  summarizeTimingEvents({ commitSha, events });
  const actualIdentityKeys = events.map((event) => event.identityKey).sort();
  const expectedIdentityKeySet = new Set(expectedIdentityKeys);
  if (actualIdentityKeys.some((identityKey) => !expectedIdentityKeySet.has(identityKey))) {
    fail('CI_TIMING_EVIDENCE_IDENTITY_MISMATCH');
  }
  const identityParityComplete =
    actualIdentityKeys.length === expectedIdentityKeys.length &&
    actualIdentityKeys.every((identityKey, index) => identityKey === expectedIdentityKeys[index]);
  if (requireCompleteIdentityParity && !identityParityComplete) {
    fail('CI_TIMING_EVIDENCE_IDENTITY_MISMATCH');
  }
  return {
    ...writeCanonicalArtifact({
      repoRoot,
      outputDir,
      fileName: `${safeShardName}.timing.json`,
      artifact: {
        commitSha,
        planHash,
        events: [...events].sort((left, right) =>
          left.identityKey.localeCompare(right.identityKey, 'en')
        ),
      },
    }),
    identityParityComplete,
  };
}

function existingEvidencePaths(paths) {
  return paths.filter((filePath) => fs.existsSync(filePath));
}

function decodeXmlAttribute(value) {
  return value
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&');
}

function xmlAttribute(openingTag, name) {
  const value = openingTag.match(new RegExp(`\\b${name}="([^"]*)"`, 'u'))?.[1];
  return value === undefined ? null : decodeXmlAttribute(value);
}

function failedIdentityEvidence({ repoRoot, junitPaths, expectedIdentityKeys }) {
  const expectedIdentitySet = new Set(expectedIdentityKeys);
  const failedIdentityKeys = new Set();
  let unresolvedFailureCount = 0;
  for (const junitPath of junitPaths) {
    assertGovernedPath(repoRoot, junitPath);
    const xml = fs.readFileSync(junitPath, 'utf8');
    const suites = [...xml.matchAll(/<testsuite\b[\s\S]*?<\/testsuite>/gu)].map(
      (match) => match[0]
    );
    for (const suite of suites) {
      const openingTag = suite.match(/^<testsuite\b[^>]*>/u)?.[0] || '';
      const failedTestcases = [...suite.matchAll(/<testcase\b[\s\S]*?<\/testcase>/gu)].filter(
        (match) => /<(?:failure|error)\b/iu.test(match[0])
      );
      const declaredFailureCount =
        Number(xmlAttribute(openingTag, 'failures') || 0) +
        Number(xmlAttribute(openingTag, 'errors') || 0);
      const failureCount = Math.max(declaredFailureCount, failedTestcases.length);
      if (failureCount === 0) continue;
      const suiteName = xmlAttribute(openingTag, 'name');
      const vitestIdentity =
        suiteName === null ? null : `vitest::${suiteName.replace(/\\/gu, '/')}`;
      if (vitestIdentity !== null && expectedIdentitySet.has(vitestIdentity)) {
        failedIdentityKeys.add(vitestIdentity);
        continue;
      }
      let mappedFailureCount = 0;
      for (const match of failedTestcases) {
        const testcaseOpeningTag = match[0].match(/^<testcase\b[^>]*>/u)?.[0] || '';
        const testcaseName = xmlAttribute(testcaseOpeningTag, 'name');
        if (testcaseName !== null && expectedIdentitySet.has(testcaseName)) {
          failedIdentityKeys.add(testcaseName);
          mappedFailureCount += 1;
        }
      }
      unresolvedFailureCount += Math.max(0, failureCount - mappedFailureCount);
    }
  }
  return {
    failedIdentityKeys: [...failedIdentityKeys].sort(),
    unresolvedFailureCount,
  };
}

function mergeFailedJunitEvidence({ repoRoot, outputPath, junitPaths }) {
  const presentPaths = existingEvidencePaths(junitPaths);
  if (presentPaths.length === 0) return 'missing';
  try {
    mergeJunitArtifacts({ repoRoot, outputPath, junitPaths: presentPaths });
    return presentPaths.length === junitPaths.length ? 'complete' : 'partial';
  } catch {
    fs.rmSync(outputPath, { force: true });
    return 'invalid';
  }
}

function mergeFailedTimingEvidence({
  repoRoot,
  outputDir,
  safeShardName,
  commitSha,
  planHash,
  timingPaths,
  expectedIdentityKeys,
}) {
  const presentPaths = existingEvidencePaths(timingPaths);
  if (presentPaths.length === 0) return 'missing';
  try {
    const merged = mergeTimingArtifacts({
      repoRoot,
      outputDir,
      safeShardName,
      commitSha,
      planHash,
      timingPaths: presentPaths,
      expectedIdentityKeys,
      requireCompleteIdentityParity: false,
    });
    return merged.identityParityComplete ? 'complete' : 'partial';
  } catch {
    fs.rmSync(path.resolve(outputDir, `${safeShardName}.timing.json`), { force: true });
    return 'invalid';
  }
}

function outputPathsForShard({ repoRoot, governedOutputDir, safeShardName, resolved }) {
  const outputs = {
    junitPath: path.resolve(governedOutputDir, `${safeShardName}.junit.xml`),
    timingPath: path.resolve(governedOutputDir, `${safeShardName}.timing.json`),
    resultPath: resolveOutputPath(repoRoot, governedOutputDir, `${safeShardName}.result.json`),
    vitest: null,
    node: null,
  };
  if (resolved.vitestPaths.length > 0) {
    outputs.vitest = {
      junitPath: path.resolve(governedOutputDir, `${safeShardName}.vitest.junit.xml`),
      timingPath: path.resolve(governedOutputDir, `${safeShardName}.vitest.timing.json`),
    };
  }
  if (resolved.nodePaths.length > 0) {
    outputs.node = {
      junitPath: path.resolve(governedOutputDir, `${safeShardName}.node.junit.xml`),
      timingPath: path.resolve(governedOutputDir, `${safeShardName}.node.timing.json`),
    };
  }
  const allPaths = [
    outputs.junitPath,
    outputs.timingPath,
    outputs.resultPath,
    ...(outputs.vitest ? [outputs.vitest.junitPath, outputs.vitest.timingPath] : []),
    ...(outputs.node ? [outputs.node.junitPath, outputs.node.timingPath] : []),
  ];
  for (const outputPath of allPaths) assertGovernedPath(repoRoot, outputPath);
  for (const outputPath of allPaths) fs.rmSync(outputPath, { force: true });
  return outputs;
}

function expectedIdentityKeys(resolved) {
  return [
    ...resolved.nodePaths.map((testPath) => `node::${testPath}`),
    ...resolved.vitestPaths.map((testPath) => `vitest::${testPath}`),
  ].sort();
}

function writeLaneResult({
  repoRoot,
  governedOutputDir,
  safeShardName,
  manifest,
  resolved,
  lane,
  shardId,
  outcome,
  evidenceStatus,
  failedIdentityKeys = [],
}) {
  const laneResult = {
    schemaVersion: 'ci-lane-result/v1',
    lane,
    shardId,
    commitSha: manifest.plan.repository.commitSha,
    planHash: resolved.planHash,
    packageDescriptorHash: manifest.plan.packageDescriptorHash,
    tarballSha256: manifest.plan.tarballSha256,
    outcome,
    executedIdentityKeys: expectedIdentityKeys(resolved),
    ...(failedIdentityKeys.length > 0 ? { failedIdentityKeys } : {}),
    evidenceStatus,
    junitPath: path
      .relative(repoRoot, path.resolve(governedOutputDir, `${safeShardName}.junit.xml`))
      .replace(/\\/g, '/'),
    timingPath: path
      .relative(repoRoot, path.resolve(governedOutputDir, `${safeShardName}.timing.json`))
      .replace(/\\/g, '/'),
  };
  const receipt = writeCanonicalArtifact({
    repoRoot,
    outputDir: governedOutputDir,
    fileName: `${safeShardName}.result.json`,
    artifact: laneResult,
  });
  return { laneResult, receipt };
}

function runCiShard({
  repoRoot = process.cwd(),
  manifest,
  lane,
  shardId,
  outputDir = '.artifacts/test-portfolio/lane-results',
  environment = {},
  runCommand = defaultRunCommand,
}) {
  const resolved = resolveCiShard({ manifest, lane, shardId });
  for (const testPath of [...resolved.vitestPaths, ...resolved.nodePaths]) {
    validateExecutablePath(repoRoot, testPath);
  }
  const safeShardName = `${lane}-${shardId}`.replace(/[^A-Za-z0-9._-]/gu, '_');
  const governedOutputDir = assertGovernedPath(repoRoot, path.resolve(repoRoot, outputDir));
  const outputs = outputPathsForShard({
    repoRoot,
    governedOutputDir,
    safeShardName,
    resolved,
  });
  const { junitPath } = outputs;
  const junitPaths = [];
  const timingPaths = [];
  const executions = [];
  if (resolved.vitestPaths.length > 0) {
    const vitestJunitPath = outputs.vitest.junitPath;
    const vitestTimingPath = outputs.vitest.timingPath;
    junitPaths.push(vitestJunitPath);
    timingPaths.push(vitestTimingPath);
    executions.push(
      runCommand({
        kind: 'vitest',
        command: 'npm',
        args: [
          'exec',
          '--',
          'vitest',
          'run',
          '--config',
          resolved.configPath,
          ...resolved.vitestPaths,
        ],
        cwd: repoRoot,
        env: {
          ...process.env,
          ...environment,
          CI_GOVERNED_SHARD: '1',
          CI_COMMIT_SHA: manifest.plan.repository.commitSha,
          CI_PLAN_HASH: manifest.planHash,
          CI_JUNIT_OUTPUT: vitestJunitPath,
          CI_TIMING_OUTPUT: vitestTimingPath,
        },
      })
    );
  }
  if (resolved.nodePaths.length > 0) {
    const nodeJunitPath = outputs.node.junitPath;
    const nodeTimingPath = outputs.node.timingPath;
    junitPaths.push(nodeJunitPath);
    timingPaths.push(nodeTimingPath);
    executions.push(
      runCommand({
        kind: 'node_test',
        command: process.execPath,
        args: [
          path.join(repoRoot, 'packages', 'bmad-speckit', 'scripts', 'run-node-tests.cjs'),
          '--ci-exact',
          ...resolved.nodePaths,
        ],
        cwd: path.join(repoRoot, 'packages', 'bmad-speckit'),
        env: {
          ...process.env,
          ...environment,
          CI_COMMIT_SHA: manifest.plan.repository.commitSha,
          CI_PLAN_HASH: manifest.planHash,
          CI_NODE_PACKAGE_ROOT: path.join(repoRoot, 'packages', 'bmad-speckit'),
          CI_LANE: lane,
          CI_SHARD_ID: shardId,
          CI_JUNIT_OUTPUT: nodeJunitPath,
          CI_TIMING_OUTPUT: nodeTimingPath,
        },
      })
    );
  }
  const failedExecution = executions.find((execution) => execution?.status !== 0);
  const identities = expectedIdentityKeys(resolved);
  let evidenceStatus;
  if (!failedExecution) {
    mergeJunitArtifacts({ repoRoot, outputPath: junitPath, junitPaths });
    mergeTimingArtifacts({
      repoRoot,
      outputDir: governedOutputDir,
      safeShardName,
      commitSha: manifest.plan.repository.commitSha,
      planHash: manifest.planHash,
      timingPaths,
      expectedIdentityKeys: identities,
    });
    evidenceStatus = { junit: 'complete', timing: 'complete' };
  } else {
    evidenceStatus = {
      junit: mergeFailedJunitEvidence({ repoRoot, outputPath: junitPath, junitPaths }),
      timing: mergeFailedTimingEvidence({
        repoRoot,
        outputDir: governedOutputDir,
        safeShardName,
        commitSha: manifest.plan.repository.commitSha,
        planHash: manifest.planHash,
        timingPaths,
        expectedIdentityKeys: identities,
      }),
    };
  }
  let outcome = failedExecution ? 'failed' : 'passed';
  let failedIdentityKeys = [];
  const expectedFailureIdentityKeys = resolved.expectedFailureIdentityKeys || [];
  if (
    failedExecution &&
    expectedFailureIdentityKeys.length > 0 &&
    evidenceStatus.junit === 'complete' &&
    evidenceStatus.timing === 'complete'
  ) {
    const failureEvidence = failedIdentityEvidence({
      repoRoot,
      junitPaths,
      expectedIdentityKeys: identities,
    });
    const expectedFailureIdentitySet = new Set(expectedFailureIdentityKeys);
    if (
      failureEvidence.unresolvedFailureCount === 0 &&
      failureEvidence.failedIdentityKeys.length > 0 &&
      failureEvidence.failedIdentityKeys.every((identityKey) =>
        expectedFailureIdentitySet.has(identityKey)
      )
    ) {
      outcome = 'expected_failed';
      failedIdentityKeys = failureEvidence.failedIdentityKeys;
    }
  }
  const { laneResult, receipt } = writeLaneResult({
    repoRoot,
    governedOutputDir,
    safeShardName,
    manifest,
    resolved,
    lane,
    shardId,
    outcome,
    evidenceStatus,
    failedIdentityKeys,
  });
  return {
    ...laneResult,
    exitCode:
      outcome === 'failed'
        ? Number.isInteger(failedExecution?.status)
          ? failedExecution.status
          : 1
        : 0,
    resultPath: receipt.path,
    resultSha256: receipt.sha256,
  };
}

const runVitestShard = runCiShard;

function parseCliArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      !['--manifest', '--lane', '--shard-id', '--output-dir', '--descriptor'].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CI_SHARD_CLI_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  if (!options.manifest || !options.lane || !options['shard-id']) {
    fail('CI_SHARD_CLI_ARGS_INVALID');
  }
  if (options.lane === 'consumer_install' && !options.descriptor) {
    fail('CANONICAL_PACKAGE_DESCRIPTOR_REQUIRED');
  }
  return options;
}

function main(args = process.argv.slice(2)) {
  const options = parseCliArgs(args);
  const repoRoot = process.cwd();
  const manifestPath = path.resolve(options.manifest);
  const manifest = readCanonicalArtifact({
    repoRoot,
    filePath: manifestPath,
  }).artifact;
  let environment = {};
  if (options.lane === 'consumer_install') {
    const descriptorPath = path.resolve(options.descriptor);
    const descriptor = readCanonicalArtifact({
      repoRoot,
      filePath: descriptorPath,
    }).artifact;
    validatePackageDescriptor({
      repoRoot,
      descriptor,
      descriptorPath,
      expectedCommitSha: manifest.plan.repository.commitSha,
    });
    environment = {
      BMAD_SPECKIT_TARBALL: path.resolve(repoRoot, descriptor.tarballPath),
      BMAD_SPECKIT_PACKAGE_DESCRIPTOR: descriptorPath,
      CI_RUN_MANIFEST: manifestPath,
    };
  }
  const result = runCiShard({
    repoRoot,
    manifest,
    lane: options.lane,
    shardId: options['shard-id'],
    outputDir: options['output-dir'] || '.artifacts/test-portfolio/lane-results',
    environment,
  });
  process.stdout.write(
    `${JSON.stringify({
      lane: result.lane,
      shardId: result.shardId,
      outcome: result.outcome,
      resultPath: result.resultPath,
    })}\n`
  );
  return result.exitCode;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  main,
  parseCliArgs,
  mergeJunitArtifacts,
  mergeTimingArtifacts,
  resolveCiShard,
  resolveVitestShard,
  runCiShard,
  runVitestShard,
};
