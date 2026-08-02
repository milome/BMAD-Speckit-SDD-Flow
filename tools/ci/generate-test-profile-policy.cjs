'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const { fail } = require('./canonical-artifact.cjs');
const { buildTestProfilePolicy, validateTestProfilePolicy } = require('./test-profile-policy.cjs');

const DEFAULT_CATALOG = '.artifacts/test-portfolio/test-catalog.json';
const DEFAULT_HISTORY = 'repo-governance/ci/test-deletion-authorizations.json';
const DEFAULT_EXCLUSIONS = 'repo-governance/ci/pr-test-exclusions.json';
const DEFAULT_OUTPUT = 'repo-governance/ci/test-profile-policy.json';
const DEFAULT_TIMING_SUMMARY = '.artifacts/test-portfolio/ci-test-timing-summary.json';

function repositoryFile(repoRoot, value, code) {
  if (typeof value !== 'string' || value.trim() === '') fail(code);
  const root = path.resolve(repoRoot);
  const target = path.resolve(root, value);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(code);
  }
  return target;
}

function readJson(filePath, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    fail(code, { filePath });
  }
}

function historicalCandidatePaths(history) {
  if (
    !history ||
    history.schemaVersion !== 'test-deletion-authorizations/v1' ||
    !Array.isArray(history.authorizations)
  ) {
    fail('TEST_PROFILE_HISTORY_INVALID');
  }
  const paths = new Set();
  for (const authorization of history.authorizations) {
    if (!Array.isArray(authorization?.candidateBindings)) fail('TEST_PROFILE_HISTORY_INVALID');
    for (const binding of authorization.candidateBindings) {
      if (typeof binding?.testPath !== 'string' || binding.testPath.trim() === '') {
        fail('TEST_PROFILE_HISTORY_INVALID');
      }
      paths.add(binding.testPath.replace(/\\/gu, '/'));
    }
  }
  return paths;
}

function explicitExclusionPaths(exclusions) {
  if (
    !exclusions ||
    exclusions.schemaVersion !== 'pr-test-exclusions/v1' ||
    !Array.isArray(exclusions.exclusions) ||
    Object.keys(exclusions).sort().join('\n') !== 'exclusions\nschemaVersion'
  ) {
    fail('TEST_PROFILE_EXCLUSIONS_INVALID');
  }
  const paths = new Set();
  for (const exclusion of exclusions.exclusions) {
    const observedAt = Date.parse(exclusion?.observedAt);
    if (
      typeof exclusion?.testPath !== 'string' ||
      exclusion.testPath.trim() === '' ||
      typeof exclusion?.reasonCode !== 'string' ||
      !/^[A-Z][A-Z0-9_]*$/u.test(exclusion.reasonCode) ||
      typeof exclusion?.observedAt !== 'string' ||
      Number.isNaN(observedAt) ||
      new Date(observedAt).toISOString() !== exclusion.observedAt ||
      Object.keys(exclusion).sort().join('\n') !== 'observedAt\nreasonCode\ntestPath'
    ) {
      fail('TEST_PROFILE_EXCLUSIONS_INVALID');
    }
    const testPath = exclusion.testPath.replace(/\\/gu, '/');
    if (paths.has(testPath)) {
      fail('TEST_PROFILE_EXCLUSION_DUPLICATE', { testPath });
    }
    paths.add(testPath);
  }
  return paths;
}

function timingEstimates(timingSummary) {
  if (!timingSummary) return {};
  if (
    timingSummary.schemaVersion !== 'ci-test-timing-summary/v1' ||
    !timingSummary.timings ||
    typeof timingSummary.timings !== 'object' ||
    Array.isArray(timingSummary.timings)
  ) {
    fail('TEST_PROFILE_TIMING_INVALID');
  }
  return Object.fromEntries(
    Object.entries(timingSummary.timings).map(([identityKey, timing]) => {
      if (!Number.isSafeInteger(timing?.conservativeMs) || timing.conservativeMs <= 0) {
        fail('TEST_PROFILE_TIMING_INVALID');
      }
      return [identityKey, timing.conservativeMs];
    })
  );
}

function buildPolicyFromHistory({
  catalog,
  history,
  exclusions = {
    schemaVersion: 'pr-test-exclusions/v1',
    exclusions: [],
  },
  timingSummary,
  owner = 'ci-governance',
}) {
  const historicalCandidates = historicalCandidatePaths(history);
  const explicitExclusions = explicitExclusionPaths(exclusions);
  const catalogPaths = new Set(catalog.tests.map((test) => test.testPath));
  const unmatchedExplicitExclusions = [...explicitExclusions]
    .filter((testPath) => !catalogPaths.has(testPath))
    .sort();
  if (unmatchedExplicitExclusions.length > 0) {
    fail('TEST_PROFILE_EXCLUSION_UNMATCHED', {
      testPaths: unmatchedExplicitExclusions,
    });
  }
  const prExcludedTestPaths = new Set([...historicalCandidates, ...explicitExclusions]);
  const prFastTestPaths = [...catalogPaths].filter(
    (testPath) => !prExcludedTestPaths.has(testPath)
  );
  const estimatedDurationsByIdentity = timingEstimates(timingSummary);
  const policy = buildTestProfilePolicy({
    catalog,
    prFastTestPaths,
    prExcludedTestPaths: [...prExcludedTestPaths],
    estimatedDurationsByIdentity,
    owner,
    lastFullRunAt: null,
  });
  return {
    policy,
    statistics: {
      catalogTestCount: catalogPaths.size,
      historicalCandidateCount: historicalCandidates.size,
      historicalCandidateMatchedCount: [...historicalCandidates].filter((testPath) =>
        catalogPaths.has(testPath)
      ).length,
      historicalCandidateUnmatchedCount: [...historicalCandidates].filter(
        (testPath) => !catalogPaths.has(testPath)
      ).length,
      explicitExclusionCount: explicitExclusions.size,
      explicitExclusionMatchedCount: [...explicitExclusions].filter((testPath) =>
        catalogPaths.has(testPath)
      ).length,
      explicitExclusionUnmatchedCount: [...explicitExclusions].filter(
        (testPath) => !catalogPaths.has(testPath)
      ).length,
      observedDurationCount: catalog.tests.filter(
        (test) => estimatedDurationsByIdentity[test.executableIdentity] !== undefined
      ).length,
      prExcludedTestCount: [...prExcludedTestPaths].filter((testPath) => catalogPaths.has(testPath))
        .length,
      prFastTestCount: prFastTestPaths.length,
    },
  };
}

function writeAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const bytes = canonicalJsonBytes(value);
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, bytes, { flag: 'wx' });
    const verified = JSON.parse(fs.readFileSync(temporary, 'utf8'));
    validateTestProfilePolicy(verified);
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
  return { bytes: bytes.length, sha256: sha256Bytes(bytes) };
}

function parseCliArgs(args) {
  const options = {
    catalog: DEFAULT_CATALOG,
    exclusions: DEFAULT_EXCLUSIONS,
    history: DEFAULT_HISTORY,
    output: DEFAULT_OUTPUT,
    owner: 'ci-governance',
    timingSummary: DEFAULT_TIMING_SUMMARY,
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      ![
        '--catalog',
        '--exclusions',
        '--history',
        '--output',
        '--owner',
        '--timing-summary',
      ].includes(flag) ||
      !value
    ) {
      fail('TEST_PROFILE_GENERATOR_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  return options;
}

function main(args = process.argv.slice(2)) {
  const repoRoot = process.cwd();
  const options = parseCliArgs(args);
  const catalog = readJson(
    repositoryFile(repoRoot, options.catalog, 'TEST_PROFILE_CATALOG_PATH_INVALID'),
    'TEST_PROFILE_CATALOG_INVALID'
  );
  const history = readJson(
    repositoryFile(repoRoot, options.history, 'TEST_PROFILE_HISTORY_PATH_INVALID'),
    'TEST_PROFILE_HISTORY_INVALID'
  );
  const exclusions = readJson(
    repositoryFile(repoRoot, options.exclusions, 'TEST_PROFILE_EXCLUSIONS_PATH_INVALID'),
    'TEST_PROFILE_EXCLUSIONS_INVALID'
  );
  const timingPath = repositoryFile(
    repoRoot,
    options.timingSummary,
    'TEST_PROFILE_TIMING_PATH_INVALID'
  );
  const timingSummary = fs.existsSync(timingPath)
    ? readJson(timingPath, 'TEST_PROFILE_TIMING_INVALID')
    : null;
  const output = repositoryFile(repoRoot, options.output, 'TEST_PROFILE_OUTPUT_PATH_INVALID');
  const { policy, statistics } = buildPolicyFromHistory({
    catalog,
    exclusions,
    history,
    timingSummary,
    owner: options.owner,
  });
  validateTestProfilePolicy(policy, catalog);
  const receipt = writeAtomic(output, policy);
  process.stdout.write(`${JSON.stringify({ path: output, ...receipt, ...statistics })}\n`);
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = {
  buildPolicyFromHistory,
  explicitExclusionPaths,
  historicalCandidatePaths,
  main,
  parseCliArgs,
  timingEstimates,
};
