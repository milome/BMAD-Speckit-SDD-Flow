'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { compareText, fail } = require('./canonical-artifact.cjs');

const SCHEMA_VERSION = 'test-profile-policy/v1';
const PROFILES = Object.freeze(['nightly-full', 'pr-fast', 'release-full']);
const PR_EXCLUDED_PROFILE = 'pr-excluded';
const POLICY_PROFILES = new Set([...PROFILES, PR_EXCLUDED_PROFILE]);
const RISK_TIERS = new Set(['critical', 'high', 'medium', 'low']);
const COLD_START_ESTIMATED_DURATION_MS = 5_000;

function normalizeTestPath(value) {
  if (typeof value !== 'string' || value.trim() === '') fail('TEST_PROFILE_PATH_INVALID');
  const slashPath = value.replace(/\\/gu, '/');
  const normalized = path.posix.normalize(slashPath).replace(/^\.\//u, '');
  if (
    normalized !== slashPath ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    fail('TEST_PROFILE_PATH_INVALID', { testPath: value });
  }
  return normalized;
}

function stableStrings(values, code, { allowEmpty = true } = {}) {
  if (
    !Array.isArray(values) ||
    (!allowEmpty && values.length === 0) ||
    values.some((value) => typeof value !== 'string' || value.trim() === '')
  ) {
    fail(code);
  }
  if (new Set(values).size !== values.length) fail(code);
  return [...values].sort(compareText);
}

function riskTier(test) {
  const criticality = test?.classifications?.criticality;
  if (criticality === 'critical') return 'high';
  if (test?.releaseGateMembership && test.releaseGateMembership !== 'none') {
    return 'high';
  }
  if ((test?.capabilityRefs || []).length > 0) return 'medium';
  return 'low';
}

function estimatedDurationMs(test, estimatedDurationsByIdentity) {
  const observed = estimatedDurationsByIdentity[test.executableIdentity];
  if (observed !== undefined) return observed;
  if (test?.durationSummary?.source === 'policy_default') {
    return COLD_START_ESTIMATED_DURATION_MS;
  }
  return test?.durationSummary?.durationMs ?? 0;
}

function buildTestProfilePolicy({
  catalog,
  prFastTestPaths = [],
  prExcludedTestPaths = [],
  estimatedDurationsByIdentity = {},
  owner = 'ci-governance',
  lastFullRunAt = null,
}) {
  if (!catalog || !Array.isArray(catalog.tests)) fail('TEST_PROFILE_CATALOG_INVALID');
  if (typeof owner !== 'string' || owner.trim() === '') fail('TEST_PROFILE_OWNER_INVALID');
  const prFast = new Set(prFastTestPaths.map(normalizeTestPath));
  const prExcluded = new Set(prExcludedTestPaths.map(normalizeTestPath));
  const tests = [...catalog.tests]
    .sort((left, right) => compareText(left.testPath, right.testPath))
    .map((test) => {
      const testPath = normalizeTestPath(test.testPath);
      const profiles = ['nightly-full', 'release-full'];
      if (prExcluded.has(testPath)) {
        profiles.push(PR_EXCLUDED_PROFILE);
      } else if (prFast.has(testPath)) {
        profiles.push('pr-fast');
      }
      return {
        testPath,
        runner: test.runnerId,
        capabilityRefs: stableStrings(
          test.capabilityRefs || [],
          'TEST_PROFILE_CAPABILITIES_INVALID'
        ),
        riskTier: riskTier(test),
        profiles: profiles.sort(compareText),
        estimatedDurationMs: Math.round(estimatedDurationMs(test, estimatedDurationsByIdentity)),
        owner: owner.trim(),
        lastFullRunAt,
      };
    });
  const policy = { schemaVersion: SCHEMA_VERSION, tests };
  validateTestProfilePolicy(policy, catalog);
  return policy;
}

function validateLastFullRunAt(value) {
  if (value === null) return;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    fail('TEST_PROFILE_LAST_FULL_RUN_INVALID');
  }
}

function validateTestProfilePolicy(policy, catalog) {
  if (!policy || policy.schemaVersion !== SCHEMA_VERSION || !Array.isArray(policy.tests)) {
    fail('TEST_PROFILE_POLICY_INVALID');
  }
  const seen = new Set();
  for (const record of policy.tests) {
    const testPath = normalizeTestPath(record?.testPath);
    if (seen.has(testPath)) fail('TEST_PROFILE_PATH_DUPLICATE', { testPath });
    seen.add(testPath);
    if (typeof record.runner !== 'string' || record.runner.trim() === '') {
      fail('TEST_PROFILE_RUNNER_INVALID', { testPath });
    }
    stableStrings(record.capabilityRefs, 'TEST_PROFILE_CAPABILITIES_INVALID');
    if (!RISK_TIERS.has(record.riskTier)) fail('TEST_PROFILE_RISK_TIER_INVALID', { testPath });
    const profiles = stableStrings(record.profiles, 'TEST_PROFILE_PROFILES_INVALID', {
      allowEmpty: false,
    });
    if (profiles.some((profile) => !POLICY_PROFILES.has(profile))) {
      fail('TEST_PROFILE_UNKNOWN', { testPath });
    }
    if (profiles.includes('pr-fast') && profiles.includes(PR_EXCLUDED_PROFILE)) {
      fail('TEST_PROFILE_PR_EXCLUSION_CONFLICT', { testPath });
    }
    if (!profiles.includes('nightly-full') || !profiles.includes('release-full')) {
      fail('TEST_PROFILE_FULL_COMPENSATION_MISSING', { testPath });
    }
    if (!Number.isSafeInteger(record.estimatedDurationMs) || record.estimatedDurationMs < 0) {
      fail('TEST_PROFILE_DURATION_INVALID', { testPath });
    }
    if (typeof record.owner !== 'string' || record.owner.trim() === '') {
      fail('TEST_PROFILE_OWNER_INVALID', { testPath });
    }
    validateLastFullRunAt(record.lastFullRunAt);
  }
  if (catalog) {
    if (!Array.isArray(catalog.tests)) fail('TEST_PROFILE_CATALOG_INVALID');
    const catalogPaths = new Set(catalog.tests.map((test) => normalizeTestPath(test.testPath)));
    if (
      catalogPaths.size !== seen.size ||
      [...catalogPaths].some((testPath) => !seen.has(testPath))
    ) {
      fail('TEST_PROFILE_POLICY_CATALOG_DRIFT');
    }
  }
  return policy;
}

function selectProfileTests({ catalog, profilePolicy, profile, impactedTestIdentityKeys = [] }) {
  validateTestProfilePolicy(profilePolicy, catalog);
  if (!PROFILES.includes(profile)) fail('TEST_PROFILE_UNKNOWN', { profile });
  const policyByPath = new Map(profilePolicy.tests.map((record) => [record.testPath, record]));
  const impacted = new Set(impactedTestIdentityKeys);
  return [...catalog.tests]
    .filter((test) => {
      const record = policyByPath.get(normalizeTestPath(test.testPath));
      return (
        record.profiles.includes(profile) ||
        (profile === 'pr-fast' && impacted.has(test.identityKey))
      );
    })
    .sort((left, right) => compareText(left.testPath, right.testPath));
}

function readTestProfilePolicy(repoRoot, filePath = 'repo-governance/ci/test-profile-policy.json') {
  const root = path.resolve(repoRoot);
  const target = path.resolve(root, filePath);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail('TEST_PROFILE_POLICY_PATH_INVALID');
  }
  return validateTestProfilePolicy(JSON.parse(fs.readFileSync(target, 'utf8')));
}

module.exports = {
  PR_EXCLUDED_PROFILE,
  PROFILES,
  buildTestProfilePolicy,
  readTestProfilePolicy,
  selectProfileTests,
  validateTestProfilePolicy,
};
