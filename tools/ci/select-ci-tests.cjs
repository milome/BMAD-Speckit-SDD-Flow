'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  compareText,
  fail,
  readCanonicalArtifact,
  writeCanonicalArtifact,
} = require('./canonical-artifact.cjs');
const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const { readTestPolicy } = require('./test-policy.cjs');
const { buildChangedCodeImpact, isProductPath } = require('./build-changed-code-impact.cjs');
const {
  readTestProfilePolicy,
  selectProfileTests,
  validateTestProfilePolicy,
} = require('./test-profile-policy.cjs');

const PROFILES = Object.freeze([
  'pr-fast',
  'pr-full',
  'nightly-deep',
  'release-verify',
  'nightly-full',
  'release-full',
]);
const REQUIRED_EXPANSION_ORDER = Object.freeze(['trace_capability', 'feature', 'package']);
const REQUIRED_RELEASE_BINDING_KINDS = Object.freeze([
  'package_install',
  'cli_bin',
  'consumer_compatibility',
  'packaged_runtime',
  'security_encoding_persistence',
  'protected_acceptance_or_proof',
]);
const EXPANSION_LEVELS = new Set(REQUIRED_EXPANSION_ORDER);
const EXECUTION_LANES = new Set([
  'core',
  'product_survival',
  'feature',
  'consumer_install',
  'repo_mutating',
]);
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const PR_TEST_EXCLUSIONS_SCHEMA_VERSION = 'pr-test-exclusions/v1';
const PR_TEST_EXCLUSION_REASON_PATTERN = /^[A-Z][A-Z0-9_]*$/u;
const GATE_FAILURES = Object.freeze([
  ['selectionOmissionCount', 'CI_SELECTION_OMISSION'],
  ['selectionDuplicateCount', 'CI_SELECTION_DUPLICATE'],
  ['unresolvedImpactBindingCount', 'CI_SELECTION_IMPACT_UNRESOLVED'],
]);
const PATH_BINDING_FIELDS = Object.freeze([
  ['testIdentityRefs', 'IMPACT_PATH_BINDING_TEST_IDENTITIES_INVALID'],
  ['traceRefs', 'IMPACT_PATH_BINDING_TRACE_REFS_INVALID'],
  ['capabilityRefs', 'IMPACT_PATH_BINDING_CAPABILITY_REFS_INVALID'],
  ['featureRefs', 'IMPACT_PATH_BINDING_FEATURE_REFS_INVALID'],
  ['packageIds', 'IMPACT_PATH_BINDING_PACKAGE_IDS_INVALID'],
  ['bindingKinds', 'IMPACT_PATH_BINDING_KINDS_INVALID'],
  ['evidenceRefs', 'IMPACT_PATH_BINDING_EVIDENCE_REFS_INVALID'],
]);
const PATH_BINDING_AUTHORITY_FIELDS = Object.freeze([
  'testIdentityRefs',
  'traceRefs',
  'capabilityRefs',
  'featureRefs',
  'packageIds',
]);

function isObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeRelativePath(value) {
  return path.posix.normalize(String(value || '').replace(/\\/g, '/')).replace(/^\.\//u, '');
}

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function isWindowsAbsoluteOrDrivePrefixed(value) {
  return (
    /^[A-Za-z]:/u.test(value) ||
    path.win32.isAbsolute(value) ||
    value.startsWith('\\\\') ||
    value.startsWith('//')
  );
}

function validateSelectionPath(value) {
  if (typeof value !== 'string') fail('CI_SELECTION_PATH_INVALID');
  const trimmed = value.trim();
  if (trimmed === '' || hasControlCharacter(value) || isWindowsAbsoluteOrDrivePrefixed(trimmed)) {
    fail('CI_SELECTION_PATH_INVALID');
  }
  const normalized = normalizeRelativePath(trimmed);
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized) ||
    isWindowsAbsoluteOrDrivePrefixed(normalized)
  ) {
    fail('CI_SELECTION_PATH_INVALID');
  }
  return normalized;
}

function validatePrTestExclusions(prTestExclusions, catalog) {
  if (
    !isObject(prTestExclusions) ||
    prTestExclusions.schemaVersion !== PR_TEST_EXCLUSIONS_SCHEMA_VERSION ||
    !Array.isArray(prTestExclusions.exclusions)
  ) {
    fail('PR_TEST_EXCLUSIONS_INVALID');
  }
  if (!isObject(catalog) || !Array.isArray(catalog.tests)) {
    fail('CI_SELECTION_CATALOG_INVALID');
  }
  const identityByPath = new Map(
    catalog.tests.map((test) => [validateSelectionPath(test.testPath), test.identityKey])
  );
  const seenPaths = new Set();
  const identityKeys = [];
  const reasonCodeByIdentity = new Map();
  for (const exclusion of prTestExclusions.exclusions) {
    if (!isObject(exclusion)) fail('PR_TEST_EXCLUSION_INVALID');
    const testPath = validateSelectionPath(exclusion.testPath);
    if (exclusion.testPath !== testPath) {
      fail('PR_TEST_EXCLUSION_PATH_NOT_CANONICAL', { testPath: exclusion.testPath });
    }
    if (seenPaths.has(testPath)) fail('PR_TEST_EXCLUSION_DUPLICATE', { testPath });
    seenPaths.add(testPath);
    if (!identityByPath.has(testPath)) {
      fail('PR_TEST_EXCLUSION_CATALOG_DRIFT', { testPath });
    }
    if (
      typeof exclusion.reasonCode !== 'string' ||
      !PR_TEST_EXCLUSION_REASON_PATTERN.test(exclusion.reasonCode)
    ) {
      fail('PR_TEST_EXCLUSION_REASON_INVALID', { testPath });
    }
    if (
      typeof exclusion.observedAt !== 'string' ||
      Number.isNaN(Date.parse(exclusion.observedAt))
    ) {
      fail('PR_TEST_EXCLUSION_OBSERVED_AT_INVALID', { testPath });
    }
    const identityKey = identityByPath.get(testPath);
    identityKeys.push(identityKey);
    reasonCodeByIdentity.set(identityKey, exclusion.reasonCode);
  }
  return {
    identityKeys: stableUnique(identityKeys),
    reasonCodeByIdentity,
    testPaths: [...seenPaths].sort(compareText),
  };
}

function stableUnique(values) {
  return [
    ...new Set((values || []).filter((value) => typeof value === 'string' && value.length > 0)),
  ].sort(compareText);
}

function isCanonicalStringArray(value, { nonEmpty = false } = {}) {
  if (
    !Array.isArray(value) ||
    (nonEmpty && value.length === 0) ||
    value.some((entry) => typeof entry !== 'string' || entry.length === 0) ||
    new Set(value).size !== value.length
  ) {
    return false;
  }
  const sorted = [...value].sort(compareText);
  return value.every((entry, index) => entry === sorted[index]);
}

function requireStringArray(value, code) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim() === '')
  ) {
    fail(code);
  }
  return stableUnique(value);
}

function requireOrderedStringArray(value, code) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim() === '') ||
    new Set(value).size !== value.length
  ) {
    fail(code);
  }
  return [...value];
}

function requirePolicyStringArray(value, code) {
  const values = requireOrderedStringArray(value, code);
  if (values.length === 0) fail(code);
  return values;
}

function matchesPathRule(value, rule) {
  const candidate = normalizeRelativePath(value);
  const pattern = normalizeRelativePath(rule);
  if (pattern.endsWith('/**')) {
    const base = pattern.slice(0, -3).replace(/\/+$/u, '');
    return candidate === base || candidate.startsWith(`${base}/`);
  }
  return candidate === pattern;
}

function normalizedPathBindings(value, changedPaths) {
  if (!Array.isArray(value)) fail('IMPACT_PATH_BINDINGS_INVALID');
  const changedPathSet = new Set(changedPaths);
  const boundPaths = new Set();
  return value
    .map((binding) => {
      if (!isObject(binding)) fail('IMPACT_PATH_BINDING_INVALID');
      if (typeof binding.changedPath !== 'string' || binding.changedPath.trim() === '') {
        fail('IMPACT_PATH_BINDING_CHANGED_PATH_INVALID');
      }
      const changedPath = normalizeRelativePath(binding.changedPath);
      if (
        changedPath === '.' ||
        changedPath === '..' ||
        changedPath.startsWith('../') ||
        path.posix.isAbsolute(changedPath)
      ) {
        fail('IMPACT_PATH_BINDING_CHANGED_PATH_INVALID');
      }
      if (boundPaths.has(changedPath)) fail('IMPACT_PATH_BINDING_DUPLICATE', { changedPath });
      if (!changedPathSet.has(changedPath)) {
        fail('IMPACT_PATH_BINDING_NOT_CHANGED', { changedPath });
      }
      boundPaths.add(changedPath);
      const normalized = { changedPath };
      for (const [field, code] of PATH_BINDING_FIELDS) {
        normalized[field] = requireStringArray(binding[field] || [], code);
      }
      if (PATH_BINDING_AUTHORITY_FIELDS.every((field) => normalized[field].length === 0)) {
        fail('IMPACT_PATH_BINDING_EMPTY', { changedPath });
      }
      return normalized;
    })
    .sort((left, right) => compareText(left.changedPath, right.changedPath));
}

function normalizedImpact(impact) {
  if (impact !== undefined && impact !== null && !isObject(impact)) fail('IMPACT_INVALID');
  const value = impact ?? {};
  const changedPaths = requireStringArray(
    value.changedPaths || [],
    'IMPACT_CHANGED_PATHS_INVALID'
  ).map(normalizeRelativePath);
  const pathBindings = normalizedPathBindings(value.pathBindings || [], changedPaths);
  return {
    changedPaths,
    changedTestIdentityKeys: requireStringArray(
      value.changedTestIdentityKeys || [],
      'IMPACT_CHANGED_TESTS_INVALID'
    ),
    impactedTestIdentityKeys: stableUnique(
      pathBindings.flatMap((binding) => binding.testIdentityRefs)
    ),
    pathBindings,
    traceRefs: stableUnique([
      ...requireStringArray(value.traceRefs || [], 'IMPACT_TRACE_REFS_INVALID'),
      ...pathBindings.flatMap((binding) => binding.traceRefs),
    ]),
    capabilityRefs: stableUnique([
      ...requireStringArray(value.capabilityRefs || [], 'IMPACT_CAPABILITY_REFS_INVALID'),
      ...pathBindings.flatMap((binding) => binding.capabilityRefs),
    ]),
    featureRefs: stableUnique([
      ...requireStringArray(value.featureRefs || [], 'IMPACT_FEATURE_REFS_INVALID'),
      ...pathBindings.flatMap((binding) => binding.featureRefs),
    ]),
    packageIds: stableUnique([
      ...requireStringArray(value.packageIds || [], 'IMPACT_PACKAGE_IDS_INVALID'),
      ...pathBindings.flatMap((binding) => binding.packageIds),
    ]),
    unresolvedRefs: requireStringArray(
      value.unresolvedRefs || [],
      'IMPACT_UNRESOLVED_REFS_INVALID'
    ),
  };
}

function catalogPackageForPath(tests, changedPath) {
  const normalized = normalizeRelativePath(changedPath);
  const packageMatch = normalized.match(/^packages\/([^/]+)(?:\/|$)/u);
  if (packageMatch) {
    const packageName = packageMatch[1];
    const candidates = stableUnique(
      tests
        .filter(
          (test) =>
            normalizeRelativePath(test.testPath).startsWith(`packages/${packageName}/`) ||
            test.packageId === packageName ||
            test.packageId === `@bmad-speckit/${packageName}`
        )
        .map((test) => test.packageId)
    );
    return candidates.length === 1 ? candidates[0] : null;
  }
  return null;
}

function bindingForTests(changedPath, tests) {
  return {
    changedPath,
    capabilityRefs: stableUnique(tests.flatMap((test) => test.capabilityRefs || [])),
    featureRefs: stableUnique(tests.flatMap((test) => test.featureRefs || [])),
    packageIds: stableUnique(tests.map((test) => test.packageId)),
    traceRefs: stableUnique(tests.flatMap((test) => test.traceRefs || [])),
  };
}

function fixtureOwnersForPath(tests, changedPath) {
  return tests.filter((test) =>
    (test.fixtureRefs || []).some((fixtureRef) => normalizeRelativePath(fixtureRef) === changedPath)
  );
}

function buildImpactFromChangedPaths({ catalog, policy, changedPaths }) {
  if (!isObject(catalog) || !Array.isArray(catalog.tests)) fail('CI_SELECTION_CATALOG_INVALID');
  if (!isObject(policy) || !isObject(policy.selection)) fail('CI_SELECTION_POLICY_INVALID');
  const tests = stableTests(catalog.tests);
  const normalizedPaths = requireStringArray(changedPaths, 'IMPACT_CHANGED_PATHS_INVALID').map(
    normalizeRelativePath
  );
  const managedRules = [
    ...profileRules(
      policy,
      'releaseSurfacePathRules',
      'PROFILE_RELEASE_SURFACE_PATH_RULES_INVALID'
    ),
    ...profileRules(policy, 'highDiffusionPathRules', 'PROFILE_HIGH_DIFFUSION_PATH_RULES_INVALID'),
  ];
  const changedTestIdentityKeys = [];
  const pathBindings = [];
  const unresolvedRefs = [];

  for (const changedPath of normalizedPaths) {
    const exactTests = tests.filter((test) => normalizeRelativePath(test.testPath) === changedPath);
    if (exactTests.length > 0) {
      changedTestIdentityKeys.push(...exactTests.map((test) => test.identityKey));
      pathBindings.push(bindingForTests(changedPath, exactTests));
      continue;
    }
    const fixtureOwners = fixtureOwnersForPath(tests, changedPath);
    if (fixtureOwners.length > 0) {
      changedTestIdentityKeys.push(...fixtureOwners.map((test) => test.identityKey));
      pathBindings.push(bindingForTests(changedPath, fixtureOwners));
      continue;
    }
    if (managedRules.some((rule) => matchesPathRule(changedPath, rule))) continue;

    const packageId = catalogPackageForPath(tests, changedPath);
    const packageTests = packageId ? tests.filter((test) => test.packageId === packageId) : [];
    if (packageTests.length === 0) {
      unresolvedRefs.push(`path:${changedPath}`);
      continue;
    }
    pathBindings.push(bindingForTests(changedPath, packageTests));
  }

  if (unresolvedRefs.length > 0) {
    fail('IMPACT_BINDING_UNRESOLVED', { unresolvedRefs: stableUnique(unresolvedRefs) });
  }
  const normalized = normalizedImpact({
    changedPaths: normalizedPaths,
    changedTestIdentityKeys,
    pathBindings,
    traceRefs: [],
    capabilityRefs: [],
    featureRefs: [],
    packageIds: [],
    unresolvedRefs: [],
  });
  return {
    changedPaths: normalized.changedPaths,
    changedTestIdentityKeys: normalized.changedTestIdentityKeys,
    pathBindings: normalized.pathBindings.map(
      ({ testIdentityRefs: _tests, bindingKinds: _kinds, evidenceRefs: _evidence, ...binding }) =>
        binding
    ),
    traceRefs: normalized.traceRefs,
    capabilityRefs: normalized.capabilityRefs,
    featureRefs: normalized.featureRefs,
    packageIds: normalized.packageIds,
    unresolvedRefs: normalized.unresolvedRefs,
  };
}

function configuredProfiles(policy) {
  const profiles = policy?.profiles;
  if (
    !Array.isArray(profiles) ||
    profiles.length !== PROFILES.length ||
    profiles.some((profile, index) => profile !== PROFILES[index])
  ) {
    fail('PROFILE_POLICY_INVALID');
  }
  return profiles;
}

function profileRules(policy, field, code) {
  const values = policy?.selection?.[field];
  return requirePolicyStringArray(values, code).map(normalizeRelativePath);
}

function releaseRequiredBindingKinds(policy) {
  const configured = requireOrderedStringArray(
    policy?.selection?.releaseRequiredBindingKinds,
    'RELEASE_REQUIRED_BINDING_KINDS_INVALID'
  );
  if (
    configured.length !== REQUIRED_RELEASE_BINDING_KINDS.length ||
    configured.some((kind, index) => kind !== REQUIRED_RELEASE_BINDING_KINDS[index])
  ) {
    fail('RELEASE_REQUIRED_BINDING_KINDS_INVALID');
  }
  return configured;
}

function validateSelectionPolicy(policy) {
  configuredProfiles(policy);
  expansionOrder(policy);
  profileRules(policy, 'highDiffusionPathRules', 'PROFILE_HIGH_DIFFUSION_PATH_RULES_INVALID');
  profileRules(policy, 'releaseSurfacePathRules', 'PROFILE_RELEASE_SURFACE_PATH_RULES_INVALID');
  requirePolicyStringArray(
    policy?.selection?.productSurvivalCapabilityRefs,
    'PRODUCT_SURVIVAL_CAPABILITY_REFS_INVALID'
  );
  requirePolicyStringArray(
    policy?.selection?.releaseCapabilityRefs,
    'RELEASE_CAPABILITY_REFS_INVALID'
  );
  releaseRequiredBindingKinds(policy);
}

function changedPathHasCoverage(changedPath, tests, impact, managedRules) {
  if (managedRules.some((rule) => matchesPathRule(changedPath, rule))) return true;
  const matchingTests = tests.filter(
    (test) => normalizeRelativePath(test.testPath) === changedPath
  );
  const changedIdentityKeys = new Set(impact.changedTestIdentityKeys);
  if (matchingTests.some((test) => changedIdentityKeys.has(test.identityKey))) return true;
  return impact.pathBindings.some((binding) => binding.changedPath === changedPath);
}

function resolveProfile({ policy, tests, impact, requestedProfile }) {
  const profiles = configuredProfiles(policy);
  if (!profiles.includes(requestedProfile)) {
    fail('PROFILE_UNKNOWN', { requestedProfile });
  }

  const releaseRules = profileRules(
    policy,
    'releaseSurfacePathRules',
    'PROFILE_RELEASE_SURFACE_PATH_RULES_INVALID'
  );
  const highDiffusionRules = profileRules(
    policy,
    'highDiffusionPathRules',
    'PROFILE_HIGH_DIFFUSION_PATH_RULES_INVALID'
  );
  const releaseMatch = impact.changedPaths.some((changedPath) =>
    releaseRules.some((rule) => matchesPathRule(changedPath, rule))
  );
  const highDiffusionMatch = impact.changedPaths.some((changedPath) =>
    highDiffusionRules.some((rule) => matchesPathRule(changedPath, rule))
  );
  const escalationReasonCodes = [];
  let profile = requestedProfile;

  if (requestedProfile !== 'pr-fast') {
    if (releaseMatch && !['nightly-full', 'release-full'].includes(requestedProfile)) {
      profile = 'release-verify';
      escalationReasonCodes.push('RELEASE_SURFACE_PATH');
    } else if (highDiffusionMatch) {
      profile = profiles[Math.max(profiles.indexOf(requestedProfile), profiles.indexOf('pr-full'))];
      escalationReasonCodes.push('HIGH_DIFFUSION_PATH');
    }
  }

  const managedRules = [...releaseRules, ...highDiffusionRules];
  const catalogTestPaths = new Set(tests.map((test) => normalizeRelativePath(test.testPath)));
  const uncoveredPaths = impact.changedPaths.filter(
    (changedPath) =>
      (isProductPath(changedPath) || catalogTestPaths.has(changedPath)) &&
      !changedPathHasCoverage(changedPath, tests, impact, managedRules)
  );
  if (uncoveredPaths.length > 0) {
    fail('PROFILE_SELECTION_UNRESOLVED', {
      changedPaths: uncoveredPaths,
    });
  }

  return { profile, escalationReasonCodes };
}

function hasAnyRef(testValues, impactValues) {
  const expected = new Set(impactValues);
  return (testValues || []).some((value) => expected.has(value));
}

function stableTests(tests) {
  const byIdentity = new Map();
  for (const test of tests) {
    if (!isObject(test) || typeof test.identityKey !== 'string' || test.identityKey.length === 0) {
      fail('CI_SELECTION_CATALOG_TEST_INVALID');
    }
    executionProjection(test);
    if (byIdentity.has(test.identityKey)) fail('CI_SELECTION_CATALOG_IDENTITY_DUPLICATE');
    byIdentity.set(test.identityKey, test);
  }
  return [...byIdentity.values()].sort((left, right) =>
    compareText(left.identityKey, right.identityKey)
  );
}

function executionProjection(test) {
  const testPath = validateSelectionPath(test.testPath);
  const executableIdentity = test.executableIdentity ?? test.identityKey;
  if (typeof executableIdentity !== 'string') {
    fail('CI_SELECTION_EXECUTABLE_IDENTITY_INVALID', {
      identityKey: test.identityKey,
    });
  }
  const match = /^(vitest|node)::(.+)$/u.exec(executableIdentity);
  if (!match) {
    fail('CI_SELECTION_EXECUTABLE_IDENTITY_INVALID', {
      identityKey: test.identityKey,
      executableIdentity,
    });
  }
  const executablePath = validateSelectionPath(match[2]);
  if (
    testPath !== test.testPath ||
    executablePath !== match[2] ||
    executablePath !== testPath ||
    executableIdentity !== `${match[1]}::${executablePath}`
  ) {
    fail('CI_SELECTION_EXECUTABLE_IDENTITY_INVALID', {
      identityKey: test.identityKey,
      executableIdentity,
      testPath: test.testPath,
    });
  }
  return {
    identityKey: executableIdentity,
    runnerId: match[1],
    testPath: executablePath,
  };
}

function selectChangedTests(tests, identityKeys) {
  const requested = new Set(identityKeys);
  const selected = tests.filter((test) => requested.has(test.identityKey));
  if (selected.length !== requested.size) {
    const found = new Set(selected.map((test) => test.identityKey));
    fail('IMPACT_BINDING_UNRESOLVED', {
      identityKeys: [...requested].filter((identityKey) => !found.has(identityKey)),
    });
  }
  return selected;
}

function selectByTraceAndCapability(tests, impact) {
  return tests.filter(
    (test) =>
      hasAnyRef(test.traceRefs, impact.traceRefs) ||
      hasAnyRef(test.capabilityRefs, impact.capabilityRefs)
  );
}

function selectByFeature(tests, featureRefs) {
  return tests.filter((test) => hasAnyRef(test.featureRefs, featureRefs));
}

function selectAffectedFeatureWorkingSet(tests, impact, exact, changed, directImpact) {
  const affectedFeatureRefs = stableUnique([
    ...impact.featureRefs,
    ...exact.flatMap((test) => test.featureRefs || []),
    ...changed.flatMap((test) => test.featureRefs || []),
    ...directImpact.flatMap((test) => test.featureRefs || []),
  ]);
  const affectedPackageIds = new Set(impact.packageIds);
  if (affectedFeatureRefs.length === 0 && affectedPackageIds.size === 0) return [];
  return tests.filter(
    (test) =>
      test.lifecycleState === 'feature_working_set' &&
      (hasAnyRef(test.featureRefs, affectedFeatureRefs) || affectedPackageIds.has(test.packageId))
  );
}

function selectByPackage(tests, packageIds) {
  const expected = new Set(packageIds);
  return tests.filter((test) => expected.has(test.packageId));
}

function missingArrayRefs(tests, field, refs) {
  return refs.filter(
    (ref) => !tests.some((test) => Array.isArray(test[field]) && test[field].includes(ref))
  );
}

function validatePathBindingRefs(tests, pathBindings) {
  const catalogIdentityKeys = new Set(tests.map((test) => test.identityKey));
  for (const binding of pathBindings) {
    const missingRefs = [
      ...binding.testIdentityRefs
        .filter((identityKey) => !catalogIdentityKeys.has(identityKey))
        .map((identityKey) => `test:${identityKey}`),
      ...missingArrayRefs(tests, 'traceRefs', binding.traceRefs).map((ref) => `trace:${ref}`),
      ...missingArrayRefs(tests, 'capabilityRefs', binding.capabilityRefs).map(
        (ref) => `capability:${ref}`
      ),
      ...missingArrayRefs(tests, 'featureRefs', binding.featureRefs).map((ref) => `feature:${ref}`),
      ...binding.packageIds
        .filter((packageId) => !tests.some((test) => test.packageId === packageId))
        .map((packageId) => `package:${packageId}`),
    ];
    if (missingRefs.length > 0) {
      fail('IMPACT_PATH_BINDING_UNRESOLVED', {
        changedPath: binding.changedPath,
        refs: missingRefs,
      });
    }
  }
}

function boundaryForLevel({ tests, impact, exact, level }) {
  if (level === 'trace_capability') {
    const requestedRefCount = impact.traceRefs.length + impact.capabilityRefs.length;
    if (requestedRefCount === 0) return null;
    return {
      tests: exact,
      expansionLevel: level,
      reasonCode: 'TRACE_CAPABILITY_IMPACT',
      missingRefs: [
        ...missingArrayRefs(tests, 'traceRefs', impact.traceRefs).map((ref) => `trace:${ref}`),
        ...missingArrayRefs(tests, 'capabilityRefs', impact.capabilityRefs).map(
          (ref) => `capability:${ref}`
        ),
      ],
    };
  }
  if (level === 'feature') {
    if (impact.featureRefs.length === 0) return null;
    const feature = selectByFeature(tests, impact.featureRefs);
    return {
      tests: feature,
      expansionLevel: level,
      reasonCode: 'FEATURE_BOUNDARY',
      missingRefs: missingArrayRefs(tests, 'featureRefs', impact.featureRefs).map(
        (ref) => `feature:${ref}`
      ),
    };
  }
  if (level === 'package') {
    if (impact.packageIds.length === 0) return null;
    const packageBoundary = selectByPackage(tests, impact.packageIds);
    const coveredPackageIds = new Set(packageBoundary.map((test) => test.packageId));
    return {
      tests: packageBoundary,
      expansionLevel: level,
      reasonCode: 'PACKAGE_BOUNDARY',
      missingRefs: impact.packageIds
        .filter((packageId) => !coveredPackageIds.has(packageId))
        .map((packageId) => `package:${packageId}`),
    };
  }
  return null;
}

function expansionOrder(policy) {
  const configured = requireOrderedStringArray(
    policy?.selection?.expansionOrder,
    'PROFILE_EXPANSION_ORDER_INVALID'
  );
  if (
    configured.length !== REQUIRED_EXPANSION_ORDER.length ||
    configured.some((level, index) => level !== REQUIRED_EXPANSION_ORDER[index])
  ) {
    fail('PROFILE_EXPANSION_ORDER_INVALID');
  }
  return configured;
}

function resolveFirstCompleteBoundary({ tests, impact, exact, profile, policy }) {
  const configuredOrder = expansionOrder(policy);
  if (profile === 'nightly-deep' || profile === 'nightly-full' || profile === 'release-full') {
    return {
      tests:
        profile === 'nightly-deep'
          ? tests.filter((test) => test.lifecycleState !== 'deletion_candidate')
          : tests,
      expansionLevel: 'package',
      reasonCode: profile === 'nightly-full' ? 'NIGHTLY_FULL' : 'FULL_COMPENSATION',
      unresolvedImpactBindingCount: impact.unresolvedRefs.length,
    };
  }
  if (profile === 'release-verify') {
    return {
      tests: [],
      expansionLevel: 'package',
      reasonCode: 'RELEASE_CAPABILITY',
      unresolvedImpactBindingCount: impact.unresolvedRefs.length,
    };
  }

  const unresolvedByLevel = {};
  for (const level of configuredOrder) {
    if (profile === 'pr-full' && level === 'trace_capability') continue;
    const boundary = boundaryForLevel({ tests, impact, exact, level });
    if (!boundary) continue;
    if (boundary.missingRefs.length === 0) {
      return {
        ...boundary,
        unresolvedImpactBindingCount: boundary.missingRefs.length,
      };
    }
    unresolvedByLevel[level] = boundary.missingRefs;
  }

  const hasImpact =
    impact.traceRefs.length > 0 ||
    impact.capabilityRefs.length > 0 ||
    impact.featureRefs.length > 0 ||
    impact.packageIds.length > 0;
  if (hasImpact) {
    fail('IMPACT_BINDING_UNRESOLVED', { unresolvedByLevel });
  }
  const unresolvedImpactBindingCount = Object.values(unresolvedByLevel).flat().length;
  return {
    tests: [],
    expansionLevel: 'trace_capability',
    reasonCode: 'NO_BOUNDARY_IMPACT',
    unresolvedImpactBindingCount,
  };
}

function capabilitySelection(tests, capabilityRefs) {
  const expected = new Set(capabilityRefs);
  return tests.filter((test) =>
    (test.capabilityRefs || []).some((capabilityRef) => expected.has(capabilityRef))
  );
}

function requiredCapabilitySelection(tests, capabilityRefs, code) {
  const selected = capabilitySelection(tests, capabilityRefs);
  const covered = new Set(selected.flatMap((test) => test.capabilityRefs || []));
  const missing = capabilityRefs.filter((capabilityRef) => !covered.has(capabilityRef));
  if (missing.length > 0) fail(code, { capabilityRefs: missing });
  return selected;
}

function releaseSelection(tests, policy) {
  const capabilities = requirePolicyStringArray(
    policy?.selection?.releaseCapabilityRefs,
    'RELEASE_CAPABILITY_REFS_INVALID'
  );
  const byCapability = requiredCapabilitySelection(
    tests,
    capabilities,
    'RELEASE_CAPABILITY_BINDING_MISSING'
  );
  const requiredKinds = releaseRequiredBindingKinds(policy);
  const coveredKinds = new Set(
    byCapability.flatMap((test) =>
      Array.isArray(test.classifications?.criticalBindings)
        ? test.classifications.criticalBindings
            .map((binding) => binding?.kind)
            .filter((kind) => typeof kind === 'string' && kind.length > 0)
        : []
    )
  );
  const missingKinds = requiredKinds.filter((kind) => !coveredKinds.has(kind));
  if (missingKinds.length > 0) {
    fail('RELEASE_REQUIRED_BINDING_KIND_MISSING', { kinds: missingKinds });
  }
  return byCapability;
}

function laneFor(reasonCodes) {
  if (reasonCodes.includes('REPO_MUTATING')) return 'repo_mutating';
  if (reasonCodes.includes('SEMANTIC_CORE')) return 'core';
  if (
    reasonCodes.includes('RELEASE_CAPABILITY') ||
    reasonCodes.includes('RELEASE_GATE_MEMBERSHIP')
  ) {
    return 'consumer_install';
  }
  if (reasonCodes.includes('PRODUCT_SURVIVAL')) return 'product_survival';
  return 'feature';
}

function selectionReasons(test, groups) {
  const reasons = [];
  if (test.classifications?.parallelSafety === 'unsafe') reasons.push('REPO_MUTATING');
  if (groups.profile.has(test.identityKey)) {
    reasons.push(groups.profileReasonCode);
  }
  if (groups.core.has(test.identityKey)) reasons.push('SEMANTIC_CORE');
  if (groups.changed.has(test.identityKey)) reasons.push('CHANGED_TEST');
  if (groups.directImpact.has(test.identityKey)) reasons.push('DIRECT_TARGET_IMPACT');
  if (groups.productSurvival.has(test.identityKey)) reasons.push('PRODUCT_SURVIVAL');
  if (groups.exact.has(test.identityKey)) reasons.push('TRACE_CAPABILITY_IMPACT');
  if (groups.featureWorkingSet.has(test.identityKey)) reasons.push('FEATURE_WORKING_SET');
  if (groups.boundary.has(test.identityKey)) reasons.push(groups.boundaryReasonCode);
  if (groups.releaseCapability.has(test.identityKey)) reasons.push('RELEASE_CAPABILITY');
  if (groups.releaseMembership.has(test.identityKey)) reasons.push('RELEASE_GATE_MEMBERSHIP');
  if (groups.expectedFailure.has(test.identityKey)) reasons.push('PR_KNOWN_FAILURE_EXECUTION');
  return stableUnique(reasons);
}

function identitySet(tests) {
  return new Set(tests.map((test) => test.identityKey));
}

function evidenceKindSatisfiesMinimum(evidenceKind, minimumEvidenceKind) {
  return evidenceKind === 'direct' || minimumEvidenceKind === 'indirect';
}

function validateCoreFreeze({ coreFreeze, catalog, policy, tests }) {
  if (
    !isObject(coreFreeze) ||
    coreFreeze.schemaVersion !== 'test-portfolio-core-freeze/v2' ||
    !Array.isArray(coreFreeze.selected) ||
    !Array.isArray(coreFreeze.coverage) ||
    !Array.isArray(coreFreeze.gaps) ||
    !isObject(coreFreeze.hashes)
  ) {
    fail('CI_SELECTION_CORE_FREEZE_INVALID');
  }
  const expectedCatalogHash = sha256Bytes(canonicalJsonBytes(catalog));
  if (coreFreeze.hashes.catalogSha256 !== expectedCatalogHash) {
    fail('CI_SELECTION_CORE_FREEZE_CATALOG_HASH_MISMATCH', {
      expected: expectedCatalogHash,
      actual: coreFreeze.hashes.catalogSha256,
    });
  }
  const expectedPolicyHash = sha256Bytes(canonicalJsonBytes(policy));
  if (coreFreeze.hashes.policySha256 !== expectedPolicyHash) {
    fail('CI_SELECTION_CORE_FREEZE_POLICY_HASH_MISMATCH', {
      expected: expectedPolicyHash,
      actual: coreFreeze.hashes.policySha256,
    });
  }
  const testsByIdentity = new Map(tests.map((test) => [test.identityKey, test]));
  const selectedByIdentity = new Map();
  for (const item of coreFreeze.selected) {
    if (
      !isObject(item) ||
      typeof item.identityKey !== 'string' ||
      !isCanonicalStringArray(item.coveredObligationIds, { nonEmpty: true })
    ) {
      fail('CI_SELECTION_CORE_FREEZE_INVALID');
    }
    if (selectedByIdentity.has(item.identityKey)) {
      fail('CI_SELECTION_CORE_FREEZE_DUPLICATE', { identityKey: item.identityKey });
    }
    const test = testsByIdentity.get(item.identityKey);
    if (!test) {
      fail('CI_SELECTION_CORE_FREEZE_IDENTITY_MISSING', { identityKey: item.identityKey });
    }
    selectedByIdentity.set(item.identityKey, {
      test,
      coveredObligationIds: [...item.coveredObligationIds],
    });
  }
  const selectedIdentities = [...selectedByIdentity.keys()];
  const canonicalIdentities = [...selectedIdentities].sort(compareText);
  if (selectedIdentities.some((identityKey, index) => identityKey !== canonicalIdentities[index])) {
    fail('CI_SELECTION_CORE_FREEZE_INVALID');
  }
  const coverageIds = new Set();
  const coverageById = new Map();
  const uncoveredObligationIds = [];
  const coveredObligationsByIdentity = new Map(
    [...selectedByIdentity.keys()].map((identityKey) => [identityKey, []])
  );
  for (const item of coreFreeze.coverage) {
    if (
      !isObject(item) ||
      typeof item.obligationId !== 'string' ||
      item.obligationId.length === 0 ||
      !['applicable', 'not_applicable'].includes(item.applicability) ||
      !['covered', 'indirectly_covered', 'ambiguous', 'missing_test', 'not_applicable'].includes(
        item.status
      ) ||
      !Array.isArray(item.selectedEvidence)
    ) {
      fail('CI_SELECTION_CORE_FREEZE_INVALID');
    }
    if (coverageIds.has(item.obligationId)) fail('CI_SELECTION_CORE_FREEZE_INVALID');
    coverageIds.add(item.obligationId);
    coverageById.set(item.obligationId, item);
    const covered = ['covered', 'indirectly_covered'].includes(item.status);
    if (item.applicability === 'applicable' && !covered) {
      uncoveredObligationIds.push(item.obligationId);
    }
    if (item.applicability === 'not_applicable' && item.selectedEvidence.length > 0) {
      fail('CI_SELECTION_CORE_FREEZE_COVERAGE_MISMATCH', {
        obligationId: item.obligationId,
      });
    }
    if (item.applicability === 'applicable' && covered && item.selectedEvidence.length === 0) {
      fail('CI_SELECTION_CORE_FREEZE_COVERAGE_MISMATCH', {
        obligationId: item.obligationId,
      });
    }
    if (item.applicability === 'applicable' && !covered && item.selectedEvidence.length > 0) {
      fail('CI_SELECTION_CORE_FREEZE_COVERAGE_MISMATCH', {
        obligationId: item.obligationId,
      });
    }
    for (const evidence of item.selectedEvidence) {
      if (
        !isObject(evidence) ||
        typeof evidence.identityKey !== 'string' ||
        !['direct', 'indirect'].includes(evidence.evidenceKind) ||
        !coveredObligationsByIdentity.has(evidence.identityKey)
      ) {
        fail('CI_SELECTION_CORE_FREEZE_COVERAGE_MISMATCH', {
          obligationId: item.obligationId,
        });
      }
      coveredObligationsByIdentity.get(evidence.identityKey).push(item.obligationId);
    }
  }
  const candidateObligationsByIdentity = new Map();
  if (Array.isArray(coreFreeze.candidateEvidence)) {
    for (const item of coreFreeze.candidateEvidence) {
      if (
        !isObject(item) ||
        typeof item.identityKey !== 'string' ||
        !isObject(item.obligationEvidence) ||
        !isObject(item.obligationOracleIndependence) ||
        !['dependent', 'independent'].includes(item.oracleIndependence) ||
        candidateObligationsByIdentity.has(item.identityKey) ||
        !testsByIdentity.has(item.identityKey)
      ) {
        fail('CI_SELECTION_CORE_FREEZE_INVALID');
      }
      const obligationEvidence = new Map();
      for (const [obligationId, evidenceKind] of Object.entries(item.obligationEvidence)) {
        const oracleIndependence = item.obligationOracleIndependence[obligationId];
        if (
          !coverageById.has(obligationId) ||
          !['direct', 'indirect'].includes(evidenceKind) ||
          !['dependent', 'independent'].includes(oracleIndependence)
        ) {
          fail('CI_SELECTION_CORE_FREEZE_INVALID');
        }
        obligationEvidence.set(obligationId, {
          evidenceKind,
          oracleIndependence,
        });
      }
      if (
        Object.keys(item.obligationOracleIndependence).some(
          (obligationId) => !obligationEvidence.has(obligationId)
        )
      ) {
        fail('CI_SELECTION_CORE_FREEZE_INVALID');
      }
      candidateObligationsByIdentity.set(item.identityKey, obligationEvidence);
    }
    for (const item of coreFreeze.coverage) {
      for (const evidence of item.selectedEvidence) {
        const candidateEvidence = candidateObligationsByIdentity
          .get(evidence.identityKey)
          ?.get(item.obligationId);
        if (
          candidateEvidence?.evidenceKind !== evidence.evidenceKind ||
          candidateEvidence.oracleIndependence !== 'independent'
        ) {
          fail('CI_SELECTION_CORE_FREEZE_COVERAGE_MISMATCH', {
            obligationId: item.obligationId,
          });
        }
      }
    }
  } else {
    for (const item of coreFreeze.coverage) {
      for (const evidence of item.selectedEvidence) {
        if (!candidateObligationsByIdentity.has(evidence.identityKey)) {
          candidateObligationsByIdentity.set(evidence.identityKey, new Map());
        }
        candidateObligationsByIdentity.get(evidence.identityKey).set(item.obligationId, {
          evidenceKind: evidence.evidenceKind,
          oracleIndependence: 'independent',
        });
      }
    }
  }
  for (const [identityKey, item] of selectedByIdentity) {
    const coveredObligationIds = stableUnique(coveredObligationsByIdentity.get(identityKey));
    if (
      item.coveredObligationIds.length !== coveredObligationIds.length ||
      item.coveredObligationIds.some(
        (obligationId, index) => obligationId !== coveredObligationIds[index]
      )
    ) {
      fail('CI_SELECTION_CORE_FREEZE_COVERAGE_MISMATCH', { identityKey });
    }
  }
  const reportedObligationGaps = new Set(
    coreFreeze.gaps
      .filter((gap) => isObject(gap) && typeof gap.obligationId === 'string')
      .map((gap) => gap.obligationId)
  );
  if (
    uncoveredObligationIds.some((obligationId) => !reportedObligationGaps.has(obligationId)) ||
    [...reportedObligationGaps].some(
      (obligationId) => !uncoveredObligationIds.includes(obligationId)
    )
  ) {
    fail('CI_SELECTION_CORE_FREEZE_COVERAGE_MISMATCH');
  }
  return {
    tests: [...selectedByIdentity.values()].map((item) => item.test),
    blockingGapCount: coreFreeze.gaps.length,
    uncoveredObligationIds: stableUnique(uncoveredObligationIds),
    coveredObligationsByIdentity: new Map(
      [...selectedByIdentity.entries()].map(([identityKey, item]) => [
        identityKey,
        item.coveredObligationIds,
      ])
    ),
    candidateObligationsByIdentity,
  };
}

function coverageReportRowIsGap(row) {
  if (row.applicability !== 'applicable') return false;
  if (row.coverageStatus === 'covered') return false;
  return !(row.coverageStatus === 'indirectly_covered' && row.minimumEvidenceKind === 'indirect');
}

function validateCoverageReport({ coverageReport, catalog, policy, coreFreeze, coreAuthority }) {
  if (
    !isObject(coverageReport) ||
    coverageReport.schemaVersion !== 'six-model-coverage-gap-report/v1' ||
    !Array.isArray(coverageReport.obligations) ||
    !isObject(coverageReport.gates) ||
    !isObject(coverageReport.hashes)
  ) {
    fail('CI_SELECTION_COVERAGE_REPORT_INVALID');
  }
  const expectedHashes = {
    catalogSha256: sha256Bytes(canonicalJsonBytes(catalog)),
    coreFreezeSha256: sha256Bytes(canonicalJsonBytes(coreFreeze)),
    policySha256: sha256Bytes(canonicalJsonBytes(policy)),
  };
  for (const [field, code] of [
    ['catalogSha256', 'CI_SELECTION_COVERAGE_REPORT_CATALOG_HASH_MISMATCH'],
    ['coreFreezeSha256', 'CI_SELECTION_COVERAGE_REPORT_CORE_FREEZE_HASH_MISMATCH'],
    ['policySha256', 'CI_SELECTION_COVERAGE_REPORT_POLICY_HASH_MISMATCH'],
  ]) {
    if (coverageReport.hashes[field] !== expectedHashes[field]) {
      fail(code, { expected: expectedHashes[field], actual: coverageReport.hashes[field] });
    }
  }
  const obligationIds = new Set();
  const atomicRowsById = new Map();
  const journeyRowsById = new Map();
  const atomicGapIds = [];
  const journeyGapIds = [];
  for (const row of coverageReport.obligations) {
    if (
      !isObject(row) ||
      typeof row.obligationId !== 'string' ||
      row.obligationId.length === 0 ||
      !['applicable', 'not_applicable'].includes(row.applicability) ||
      !['direct', 'indirect'].includes(row.minimumEvidenceKind) ||
      ![
        'covered',
        'indirectly_covered',
        'ambiguous',
        'missing_test',
        'target_unresolved',
        'product_incompatible',
        'not_applicable',
      ].includes(row.coverageStatus) ||
      obligationIds.has(row.obligationId)
    ) {
      fail('CI_SELECTION_COVERAGE_REPORT_INVALID');
    }
    obligationIds.add(row.obligationId);
    if (row.obligationId.startsWith('journey/')) {
      journeyRowsById.set(row.obligationId, row);
    } else {
      atomicRowsById.set(row.obligationId, row);
    }
    if (!coverageReportRowIsGap(row)) continue;
    if (row.obligationId.startsWith('journey/')) {
      journeyGapIds.push(row.obligationId);
    } else {
      atomicGapIds.push(row.obligationId);
    }
  }
  const canonicalAtomicGapIds = stableUnique(atomicGapIds);
  if (
    canonicalAtomicGapIds.length !== coreAuthority.uncoveredObligationIds.length ||
    canonicalAtomicGapIds.some(
      (obligationId, index) => obligationId !== coreAuthority.uncoveredObligationIds[index]
    )
  ) {
    fail('CI_SELECTION_COVERAGE_REPORT_ATOMIC_GAPS_MISMATCH');
  }
  if (atomicRowsById.size !== coreFreeze.coverage.length) {
    fail('CI_SELECTION_COVERAGE_REPORT_ATOMIC_COVERAGE_MISMATCH');
  }
  for (const coverage of coreFreeze.coverage) {
    const row = atomicRowsById.get(coverage.obligationId);
    if (
      !row ||
      row.applicability !== coverage.applicability ||
      row.minimumEvidenceKind !== coverage.minimumEvidenceKind ||
      row.coverageStatus !== coverage.status
    ) {
      fail('CI_SELECTION_COVERAGE_REPORT_ATOMIC_COVERAGE_MISMATCH', {
        obligationId: coverage.obligationId,
      });
    }
  }
  const semanticJourneys = Array.isArray(policy.semanticJourneys) ? policy.semanticJourneys : [];
  const catalogIdentityKeys = new Set(catalog.tests.map((test) => test.identityKey));
  if (journeyRowsById.size !== semanticJourneys.length) {
    fail('CI_SELECTION_COVERAGE_REPORT_JOURNEYS_MISMATCH');
  }
  for (const journey of semanticJourneys) {
    const obligationId = `journey/${journey.journeyId}`;
    const row = journeyRowsById.get(obligationId);
    const candidateTestIdentityRefs = row?.candidateTestIdentityRefs;
    const selectedTestIdentityRefs = row?.selectedTestIdentityRefs;
    if (
      !row ||
      row.applicability !== journey.applicability ||
      row.minimumEvidenceKind !== journey.minimumEvidenceKind ||
      !isCanonicalStringArray(candidateTestIdentityRefs) ||
      !isCanonicalStringArray(selectedTestIdentityRefs) ||
      selectedTestIdentityRefs.length > 1 ||
      candidateTestIdentityRefs.some((identityKey) => !catalogIdentityKeys.has(identityKey)) ||
      selectedTestIdentityRefs.some(
        (identityKey) => !candidateTestIdentityRefs.includes(identityKey)
      ) ||
      ![null, 'direct', 'indirect'].includes(row.directEvidenceKind) ||
      !['independent', 'unresolved'].includes(row.oracleIndependence) ||
      (selectedTestIdentityRefs.length > 0 &&
        (row.directEvidenceKind === null || row.oracleIndependence !== 'independent')) ||
      (selectedTestIdentityRefs.length === 0 &&
        (row.directEvidenceKind !== null || row.oracleIndependence !== 'unresolved'))
    ) {
      fail('CI_SELECTION_COVERAGE_REPORT_JOURNEYS_MISMATCH', { obligationId });
    }
  }
  const canonicalJourneyGapIds = stableUnique(journeyGapIds);
  if (
    !Number.isSafeInteger(coverageReport.gates.unmappedCriticalTransitionCount) ||
    coverageReport.gates.unmappedCriticalTransitionCount !== canonicalJourneyGapIds.length
  ) {
    fail('CI_SELECTION_COVERAGE_REPORT_CRITICAL_GAPS_MISMATCH');
  }
  return {
    blockingGapCount: coreAuthority.blockingGapCount + canonicalJourneyGapIds.length,
    uncoveredObligationIds: stableUnique([
      ...coreAuthority.uncoveredObligationIds,
      ...canonicalJourneyGapIds,
    ]),
    journeyRows: [...journeyRowsById.values()],
    coverageReportHash: sha256Bytes(canonicalJsonBytes(coverageReport)),
  };
}

function recomputeFinalCoverage({
  coreFreeze,
  coreAuthority,
  coverageAuthority,
  selectedByIdentity,
}) {
  const selectedIdentityKeys = [...selectedByIdentity.keys()];
  const coveredObligationsByIdentity = new Map(
    selectedIdentityKeys.map((identityKey) => [identityKey, []])
  );
  const uncoveredAtomicObligationIds = [];
  for (const coverage of coreFreeze.coverage) {
    if (coverage.applicability !== 'applicable') continue;
    if (!['covered', 'indirectly_covered'].includes(coverage.status)) {
      uncoveredAtomicObligationIds.push(coverage.obligationId);
      continue;
    }
    let covered = false;
    for (const identityKey of selectedIdentityKeys) {
      const evidence = coreAuthority.candidateObligationsByIdentity
        .get(identityKey)
        ?.get(coverage.obligationId);
      if (
        !evidence ||
        evidence.oracleIndependence !== 'independent' ||
        !evidenceKindSatisfiesMinimum(evidence.evidenceKind, coverage.minimumEvidenceKind)
      ) {
        continue;
      }
      covered = true;
      coveredObligationsByIdentity.get(identityKey).push(coverage.obligationId);
    }
    if (!covered) uncoveredAtomicObligationIds.push(coverage.obligationId);
  }
  const uncoveredJourneyObligationIds = [];
  for (const row of coverageAuthority.journeyRows) {
    if (row.applicability !== 'applicable') continue;
    const selectedProviders = row.selectedTestIdentityRefs.filter((identityKey) =>
      selectedByIdentity.has(identityKey)
    );
    const covered =
      selectedProviders.length > 0 &&
      row.oracleIndependence === 'independent' &&
      evidenceKindSatisfiesMinimum(row.directEvidenceKind, row.minimumEvidenceKind) &&
      !coverageReportRowIsGap(row);
    if (!covered) {
      uncoveredJourneyObligationIds.push(row.obligationId);
      continue;
    }
    for (const identityKey of selectedProviders) {
      coveredObligationsByIdentity.get(identityKey).push(row.obligationId);
    }
  }
  const nonObligationCoreGapCount = coreFreeze.gaps.filter(
    (gap) => !isObject(gap) || typeof gap.obligationId !== 'string'
  ).length;
  const uncoveredObligationIds = stableUnique([
    ...uncoveredAtomicObligationIds,
    ...uncoveredJourneyObligationIds,
  ]);
  return {
    blockingGapCount: uncoveredObligationIds.length + nonObligationCoreGapCount,
    uncoveredObligationIds,
    coveredObligationsByIdentity: new Map(
      [...coveredObligationsByIdentity.entries()].map(([identityKey, obligationIds]) => [
        identityKey,
        stableUnique(obligationIds),
      ])
    ),
  };
}

function selectCiTests({
  catalog,
  policy,
  profilePolicy,
  prTestExclusions,
  coreFreeze,
  coverageReport,
  impact: rawImpact,
  requestedProfile,
}) {
  if (!isObject(catalog) || !Array.isArray(catalog.tests)) fail('CI_SELECTION_CATALOG_INVALID');
  if (!isObject(policy) || !isObject(policy.selection)) fail('CI_SELECTION_POLICY_INVALID');
  validateSelectionPolicy(policy);
  const tests = stableTests(catalog.tests);
  const validatedPrTestExclusions = prTestExclusions
    ? validatePrTestExclusions(prTestExclusions, catalog)
    : { identityKeys: [], reasonCodeByIdentity: new Map(), testPaths: [] };
  const explicitPrExclusionIdentityKeys = new Set(validatedPrTestExclusions.identityKeys);
  const coreAuthority = validateCoreFreeze({ coreFreeze, catalog, policy, tests });
  const coverageAuthority = validateCoverageReport({
    coverageReport,
    catalog,
    policy,
    coreFreeze,
    coreAuthority,
  });
  const impact = normalizedImpact(rawImpact);
  validatePathBindingRefs(tests, impact.pathBindings);
  if (impact.unresolvedRefs.length > 0) {
    fail('IMPACT_BINDING_UNRESOLVED', { unresolvedRefs: impact.unresolvedRefs });
  }
  const { profile, escalationReasonCodes } = resolveProfile({
    policy,
    tests,
    impact,
    requestedProfile,
  });
  if (profilePolicy) validateTestProfilePolicy(profilePolicy, catalog);
  const profileRecords = profilePolicy
    ? new Map(profilePolicy.tests.map((record) => [record.testPath, record]))
    : null;
  const profileBaseline =
    profilePolicy && ['pr-fast', 'nightly-full', 'release-full'].includes(profile)
      ? selectProfileTests({
          catalog,
          profilePolicy,
          profile,
          impactedTestIdentityKeys: stableUnique([
            ...impact.changedTestIdentityKeys,
            ...impact.impactedTestIdentityKeys,
          ]),
        })
      : [];
  const core = coreAuthority.tests;
  const changedBindings = selectChangedTests(tests, impact.changedTestIdentityKeys);
  const changed =
    profile === 'release-verify'
      ? []
      : profile === 'nightly-deep'
        ? changedBindings.filter((test) => test.lifecycleState !== 'deletion_candidate')
        : changedBindings;
  const directImpactBindings = selectChangedTests(tests, impact.impactedTestIdentityKeys);
  const directImpact =
    profile === 'release-verify'
      ? []
      : profile === 'nightly-deep'
        ? directImpactBindings.filter((test) => test.lifecycleState !== 'deletion_candidate')
        : directImpactBindings;
  const exact = selectByTraceAndCapability(tests, impact);
  const boundary = resolveFirstCompleteBoundary({ tests, impact, exact, profile, policy });
  const isPullRequestProfile = profile === 'pr-fast' || profile === 'pr-full';
  const prExcluded = new Set(
    isPullRequestProfile && profileRecords
      ? tests
          .filter((test) =>
            profileRecords
              .get(normalizeRelativePath(test.testPath))
              .profiles.includes('pr-excluded')
          )
          .map((test) => test.identityKey)
      : []
  );
  const impactIdentityKeys = new Set([
    ...impact.changedTestIdentityKeys,
    ...impact.impactedTestIdentityKeys,
  ]);
  const exactAffected = isPullRequestProfile ? exact : [];
  const featureWorkingSet = isPullRequestProfile
    ? selectAffectedFeatureWorkingSet(tests, impact, exact, changedBindings, directImpactBindings)
    : [];
  const productSurvivalCapabilityRefs = requirePolicyStringArray(
    policy.selection.productSurvivalCapabilityRefs,
    'PRODUCT_SURVIVAL_CAPABILITY_REFS_INVALID'
  );
  const productSurvivalBindings = requiredCapabilitySelection(
    tests,
    productSurvivalCapabilityRefs,
    'PRODUCT_SURVIVAL_BINDING_MISSING'
  );
  const productSurvival = isPullRequestProfile ? productSurvivalBindings : [];
  const release = profile === 'release-verify' ? releaseSelection(tests, policy) : [];
  const releaseCapabilityRefs = new Set(
    requirePolicyStringArray(
      policy.selection.releaseCapabilityRefs,
      'RELEASE_CAPABILITY_REFS_INVALID'
    )
  );
  const releaseCapability = release.filter((test) =>
    (test.capabilityRefs || []).some((capabilityRef) => releaseCapabilityRefs.has(capabilityRef))
  );
  const releaseMembership =
    profile === 'release-verify'
      ? tests.filter(
          (test) =>
            typeof test.releaseGateMembership === 'string' &&
            !['', 'none'].includes(test.releaseGateMembership)
        )
      : [];
  const impactSelectedIdentityKeys = new Set([
    ...changed.map((test) => test.identityKey),
    ...directImpact.map((test) => test.identityKey),
    ...exactAffected.map((test) => test.identityKey),
    ...featureWorkingSet.map((test) => test.identityKey),
    ...boundary.tests.map((test) => test.identityKey),
  ]);
  const expectedFailureReasonCodeByIdentity = new Map(
    isPullRequestProfile
      ? [...validatedPrTestExclusions.reasonCodeByIdentity].filter(([identityKey]) =>
          impactSelectedIdentityKeys.has(identityKey)
        )
      : []
  );
  const selectPrBaseline = (candidates) =>
    isPullRequestProfile
      ? candidates.filter(
          (test) =>
            !explicitPrExclusionIdentityKeys.has(test.identityKey) ||
            impactIdentityKeys.has(test.identityKey)
        )
      : candidates;
  const excludedBaseline = (candidates) =>
    selectPrBaseline(candidates.filter((test) => !prExcluded.has(test.identityKey)));
  const expected = [
    ...selectPrBaseline(profileBaseline),
    ...excludedBaseline(core),
    ...changed,
    ...directImpact,
    ...excludedBaseline(productSurvival),
    ...exactAffected,
    ...featureWorkingSet,
    ...boundary.tests,
    ...excludedBaseline(release),
  ];
  const selectedByIdentity = new Map(expected.map((test) => [test.identityKey, test]));
  const finalCoverage = recomputeFinalCoverage({
    coreFreeze,
    coreAuthority,
    coverageAuthority,
    selectedByIdentity,
  });
  const groups = {
    profile: identitySet(profileBaseline),
    profileReasonCode:
      profile === 'pr-fast'
        ? 'PROFILE_PR_FAST'
        : profile === 'nightly-full'
          ? 'PROFILE_NIGHTLY_FULL'
          : 'PROFILE_RELEASE_FULL',
    core: identitySet(core),
    changed: identitySet(changed),
    directImpact: identitySet(directImpact),
    productSurvival: identitySet(productSurvival),
    exact: identitySet(exactAffected),
    featureWorkingSet: identitySet(featureWorkingSet),
    boundary: identitySet(boundary.tests),
    boundaryReasonCode: boundary.reasonCode,
    releaseCapability: identitySet(releaseCapability),
    releaseMembership: identitySet(releaseMembership),
    expectedFailure: new Set(expectedFailureReasonCodeByIdentity.keys()),
  };
  const expectedExecutionIdentities = [...selectedByIdentity.values()].map(
    (test) => executionProjection(test).identityKey
  );
  const selected = [...selectedByIdentity.values()]
    .map((test) => ({ test, execution: executionProjection(test) }))
    .sort((left, right) => compareText(left.execution.identityKey, right.execution.identityKey))
    .map(({ test, execution }) => {
      const reasonCodes = selectionReasons(test, groups);
      return {
        ...execution,
        ...(profileRecords
          ? { estimatedDurationMs: profileRecords.get(execution.testPath).estimatedDurationMs }
          : {}),
        ...(expectedFailureReasonCodeByIdentity.has(test.identityKey)
          ? {
              expectedFailureReasonCode: expectedFailureReasonCodeByIdentity.get(test.identityKey),
            }
          : {}),
        lane: laneFor(reasonCodes),
        reasonCodes,
        coveredObligationIds:
          finalCoverage.coveredObligationsByIdentity.get(test.identityKey) || [],
      };
    });
  const result = {
    schemaVersion: 'test-selection/v1',
    coverageReportHash: coverageAuthority.coverageReportHash,
    selectionStatus: finalCoverage.blockingGapCount === 0 ? 'ready' : 'blocked',
    blockingGapCount: finalCoverage.blockingGapCount,
    uncoveredObligationIds: finalCoverage.uncoveredObligationIds,
    profile,
    requestedProfile,
    escalationReasonCodes: stableUnique(escalationReasonCodes),
    expansionLevel: boundary.expansionLevel,
    selected,
    gates: {
      selectionOmissionCount: expectedExecutionIdentities.filter(
        (identityKey) => !selected.some((item) => item.identityKey === identityKey)
      ).length,
      selectionDuplicateCount:
        selected.length - new Set(selected.map((item) => item.identityKey)).size,
      unresolvedImpactBindingCount: boundary.unresolvedImpactBindingCount,
    },
  };
  validateSelection(result);
  return result;
}

function validateSelection(selection) {
  if (!isObject(selection) || selection.schemaVersion !== 'test-selection/v1') {
    fail('CI_SELECTION_INVALID');
  }
  if (!['ready', 'blocked'].includes(selection.selectionStatus)) {
    fail('CI_SELECTION_STATUS_INVALID');
  }
  if (
    selection.coverageReportHash !== undefined &&
    !SHA256_PATTERN.test(selection.coverageReportHash)
  ) {
    fail('CI_SELECTION_COVERAGE_REPORT_HASH_INVALID');
  }
  if (
    !Number.isSafeInteger(selection.blockingGapCount) ||
    selection.blockingGapCount < 0 ||
    !isCanonicalStringArray(selection.uncoveredObligationIds)
  ) {
    fail('CI_SELECTION_BLOCKING_GAPS_INVALID');
  }
  const expectedStatus = selection.blockingGapCount === 0 ? 'ready' : 'blocked';
  if (
    selection.selectionStatus !== expectedStatus ||
    selection.blockingGapCount < selection.uncoveredObligationIds.length
  ) {
    fail('CI_SELECTION_BLOCKING_GAPS_INVALID');
  }
  if (!PROFILES.includes(selection.profile) || !PROFILES.includes(selection.requestedProfile)) {
    fail('PROFILE_UNKNOWN');
  }
  if (!EXPANSION_LEVELS.has(selection.expansionLevel)) {
    fail('CI_SELECTION_EXPANSION_LEVEL_INVALID');
  }
  if (!Array.isArray(selection.selected) || !isObject(selection.gates)) {
    fail('CI_SELECTION_INVALID');
  }
  if (!isCanonicalStringArray(selection.escalationReasonCodes)) {
    fail('CI_SELECTION_ESCALATION_REASON_CODES_INVALID');
  }
  const identityKeys = new Set();
  for (const item of selection.selected) {
    if (
      !isObject(item) ||
      typeof item.identityKey !== 'string' ||
      typeof item.runnerId !== 'string' ||
      typeof item.testPath !== 'string' ||
      typeof item.lane !== 'string' ||
      (item.expectedFailureReasonCode !== undefined &&
        (typeof item.expectedFailureReasonCode !== 'string' ||
          !PR_TEST_EXCLUSION_REASON_PATTERN.test(item.expectedFailureReasonCode))) ||
      (item.estimatedDurationMs !== undefined &&
        (!Number.isSafeInteger(item.estimatedDurationMs) || item.estimatedDurationMs < 0)) ||
      !isCanonicalStringArray(item.reasonCodes, { nonEmpty: true }) ||
      !isCanonicalStringArray(item.coveredObligationIds)
    ) {
      if (isObject(item) && Array.isArray(item.reasonCodes)) {
        fail('CI_SELECTION_REASON_CODES_INVALID');
      }
      fail('CI_SELECTION_ITEM_INVALID');
    }
    const expectedFailureExecution = item.reasonCodes.includes('PR_KNOWN_FAILURE_EXECUTION');
    if (
      (item.expectedFailureReasonCode !== undefined) !== expectedFailureExecution ||
      (expectedFailureExecution && !['pr-fast', 'pr-full'].includes(selection.profile))
    ) {
      fail('CI_SELECTION_EXPECTED_FAILURE_INVALID');
    }
    if (!EXECUTION_LANES.has(item.lane)) fail('CI_SELECTION_LANE_INVALID');
    const testPath = validateSelectionPath(item.testPath);
    if (item.testPath !== testPath || item.identityKey !== `${item.runnerId}::${testPath}`) {
      fail('CI_SELECTION_IDENTITY_MISMATCH');
    }
    if (identityKeys.has(item.identityKey)) fail('CI_SELECTION_DUPLICATE');
    identityKeys.add(item.identityKey);
  }
  const canonicalIdentityKeys = [...identityKeys].sort(compareText);
  if (selection.selected.some((item, index) => item.identityKey !== canonicalIdentityKeys[index])) {
    fail('CI_SELECTION_SELECTED_ORDER_INVALID');
  }
  for (const [field, code] of GATE_FAILURES) {
    if (!Number.isSafeInteger(selection.gates[field]) || selection.gates[field] < 0) {
      fail('CI_SELECTION_GATE_INVALID', { field });
    }
    if (selection.gates[field] !== 0) fail(code, { [field]: selection.gates[field] });
  }
  return selection;
}

function writeSelection({
  repoRoot = process.cwd(),
  outputDir = '.artifacts/test-portfolio',
  selection,
}) {
  validateSelection(selection);
  const receipt = writeCanonicalArtifact({
    repoRoot,
    outputDir,
    fileName: 'test-selection.json',
    artifact: selection,
  });
  return {
    path: receipt.path,
    sha256: receipt.sha256,
    selectedCount: selection.selected.length,
    selectionStatus: selection.selectionStatus,
    blockingGapCount: selection.blockingGapCount,
    profile: selection.profile,
    expansionLevel: selection.expansionLevel,
  };
}

function parseCliArgs(args) {
  const options = {
    policy: 'repo-governance/ci/test-policy.json',
    'profile-policy': 'repo-governance/ci/test-profile-policy.json',
    'pr-test-exclusions': 'repo-governance/ci/pr-test-exclusions.json',
    outputDir: '.artifacts/test-portfolio',
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      ![
        '--catalog',
        '--core-freeze',
        '--coverage-report',
        '--facts',
        '--base-sha',
        '--commit-sha',
        '--policy',
        '--profile-policy',
        '--pr-test-exclusions',
        '--impact',
        '--changed-paths',
        '--requested-profile',
        '--output-dir',
      ].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CI_SELECTION_CLI_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  const committedFields = [options.facts, options['base-sha'], options['commit-sha']];
  const committedFieldCount = committedFields.filter(Boolean).length;
  const committedMode = committedFieldCount === committedFields.length;
  const selectionInputModeCount =
    Number(Boolean(options.impact)) +
    Number(Boolean(options['changed-paths'])) +
    Number(committedMode);
  if (
    !options.catalog ||
    !options['core-freeze'] ||
    !options['coverage-report'] ||
    !options['requested-profile'] ||
    (committedFieldCount > 0 && !committedMode) ||
    selectionInputModeCount !== 1
  ) {
    fail('CI_SELECTION_CLI_ARGS_INVALID');
  }
  return options;
}

function readRepoJson(repoRoot, value, code) {
  const target = path.resolve(repoRoot, value);
  const relative = path.relative(path.resolve(repoRoot), target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(code);
  }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function main(args = process.argv.slice(2)) {
  const options = parseCliArgs(args);
  const repoRoot = process.cwd();
  const catalog = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options.catalog),
  }).artifact;
  const coreFreeze = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options['core-freeze']),
  }).artifact;
  const coverageReport = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options['coverage-report']),
  }).artifact;
  const policy = readTestPolicy(repoRoot, options.policy);
  const profilePolicy = readTestProfilePolicy(repoRoot, options['profile-policy']);
  const prTestExclusions = readRepoJson(
    repoRoot,
    options['pr-test-exclusions'],
    'PR_TEST_EXCLUSIONS_PATH_INVALID'
  );
  const impact = options.impact
    ? readRepoJson(repoRoot, options.impact, 'CI_SELECTION_IMPACT_PATH_INVALID')
    : options['changed-paths']
      ? buildImpactFromChangedPaths({
          catalog,
          policy,
          changedPaths: readRepoJson(
            repoRoot,
            options['changed-paths'],
            'CI_SELECTION_CHANGED_PATHS_PATH_INVALID'
          ),
        })
      : buildChangedCodeImpact({
          repoRoot,
          baseSha: options['base-sha'],
          commitSha: options['commit-sha'],
          catalog,
          policy,
          facts: readCanonicalArtifact({
            repoRoot,
            filePath: path.resolve(repoRoot, options.facts),
          }).artifact,
        });
  const selection = selectCiTests({
    catalog,
    policy,
    profilePolicy,
    prTestExclusions,
    coreFreeze,
    coverageReport,
    impact,
    requestedProfile: options['requested-profile'],
  });
  const receipt = writeSelection({
    repoRoot,
    outputDir: options['output-dir'],
    selection,
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  buildImpactFromChangedPaths,
  main,
  parseCliArgs,
  selectCiTests,
  validatePrTestExclusions,
  validateCoreFreeze,
  validateSelection,
  writeSelection,
};
