'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const { compareText, fail } = require('./canonical-artifact.cjs');
const {
  catalogFactsHash,
  catalogPolicyHash,
  validateCatalogAuthority,
  validateTestCatalog,
} = require('./generate-test-catalog.cjs');
const { commandBindingsForTarget } = require('./test-command-bindings.cjs');
const { validateTestPolicy } = require('./test-policy.cjs');
const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');

const PRODUCT_PATH_PREFIXES = Object.freeze([
  '.github/',
  '_bmad/',
  'packages/',
  'scripts/',
  'src/',
  'tools/',
]);
const FIXTURE_ASSET_ROOT = 'tests/fixtures/';
const CI_SELF_HOSTING_TEST_PREFIXES = Object.freeze([
  'tests/acceptance/ci-',
  'tests/acceptance/release-ci-',
  'tests/acceptance/test-portfolio-audit-',
]);
const MAX_GRAPH_PATHS = 2_000;
const OPTIONAL_SOURCE_FIELDS = Object.freeze([
  'historicalExecutionBindings',
  'observedExecutionBindings',
  'registryBindingRecords',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRelativePath(value) {
  return path.posix.normalize(String(value || '').replace(/\\/gu, '/')).replace(/^\.\//u, '');
}

function isFixtureAssetPath(value) {
  return normalizeRelativePath(value).startsWith(FIXTURE_ASSET_ROOT);
}

function stableUnique(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))].sort(
    compareText
  );
}

function isCiSelfHostingPath(changedPath) {
  return (
    changedPath.startsWith('tools/ci/') ||
    changedPath.startsWith('tools/test-portfolio-audit/') ||
    changedPath === 'tools/run-root-tests.cjs' ||
    /^vitest(?:\.[a-z0-9-]+)*\.config\.ts$/u.test(changedPath)
  );
}

function ciSelfHostingTests(changedPath, tests) {
  if (!isCiSelfHostingPath(changedPath)) return [];
  return tests
    .filter((test) =>
      CI_SELF_HOSTING_TEST_PREFIXES.some((prefix) => test.testPath.startsWith(prefix))
    )
    .sort((left, right) => compareText(left.identityKey, right.identityKey));
}

function runGit(repoRoot, args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (error) {
    fail('IMPACT_GIT_COMMAND_FAILED', {
      args,
      exitCode: error.status,
    });
  }
}

function resolveCommit(repoRoot, value, field) {
  if (typeof value !== 'string' || !/^[a-f0-9]{7,64}$/iu.test(value)) {
    fail('IMPACT_COMMIT_INVALID', { field });
  }
  return runGit(repoRoot, ['rev-parse', '--verify', `${value}^{commit}`]).trim();
}

function parseNameStatus(raw) {
  const tokens = raw.split('\0');
  if (tokens.at(-1) === '') tokens.pop();
  const changes = [];
  for (let index = 0; index < tokens.length; ) {
    const statusToken = tokens[index++];
    if (!/^(?:A|C\d+|D|M|R\d+|T)$/u.test(statusToken)) {
      fail('IMPACT_GIT_DIFF_INVALID', { status: statusToken });
    }
    if (statusToken.startsWith('R') || statusToken.startsWith('C')) {
      const previousPath = normalizeRelativePath(tokens[index++]);
      const changedPath = normalizeRelativePath(tokens[index++]);
      changes.push({ status: statusToken, previousPath, changedPath });
    } else {
      changes.push({
        status: statusToken,
        changedPath: normalizeRelativePath(tokens[index++]),
      });
    }
  }
  return changes.sort((left, right) => {
    const pathOrder = compareText(left.changedPath, right.changedPath);
    return pathOrder !== 0 ? pathOrder : compareText(left.status, right.status);
  });
}

function readCommittedChanges({ repoRoot, baseSha, commitSha }) {
  const baseCommit = resolveCommit(repoRoot, baseSha, 'baseSha');
  const commit = resolveCommit(repoRoot, commitSha, 'commitSha');
  const raw = runGit(repoRoot, [
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    '--find-copies-harder',
    baseCommit,
    commit,
    '--',
  ]);
  return {
    baseSha: baseCommit,
    commitSha: commit,
    changes: parseNameStatus(raw),
  };
}

function normalizedTargetRef(value) {
  const normalized = normalizeRelativePath(value);
  return normalized.startsWith('target:') ? normalized.slice('target:'.length) : normalized;
}

function catalogTests(catalog) {
  if (!isObject(catalog) || !Array.isArray(catalog.tests)) {
    fail('IMPACT_CATALOG_INVALID');
  }
  return catalog.tests
    .map((test) => {
      if (
        !isObject(test) ||
        typeof test.identityKey !== 'string' ||
        typeof test.testPath !== 'string'
      ) {
        fail('IMPACT_CATALOG_TEST_INVALID');
      }
      return {
        ...test,
        testPath: normalizeRelativePath(test.testPath),
        fixtureRefs: stableUnique((test.fixtureRefs || []).map(normalizeRelativePath)),
        targetRefs: stableUnique((test.targetRefs || []).map(normalizedTargetRef)),
      };
    })
    .sort((left, right) => compareText(left.identityKey, right.identityKey));
}

function productionEdges(facts) {
  const rawEdges = facts?.sourceIndex?.productionEdges;
  if (rawEdges === undefined) return [];
  if (!Array.isArray(rawEdges)) fail('IMPACT_SOURCE_INDEX_INVALID');
  return rawEdges
    .map((edge) => {
      if (!isObject(edge) || typeof edge.from !== 'string' || typeof edge.to !== 'string') {
        fail('IMPACT_SOURCE_INDEX_INVALID');
      }
      return {
        from: normalizeRelativePath(edge.from),
        to: normalizeRelativePath(edge.to),
        evidenceRef: typeof edge.evidenceRef === 'string' ? edge.evidenceRef : undefined,
        bindingKind:
          typeof edge.evidenceRef === 'string' && edge.evidenceRef.includes('#dynamic-import:')
            ? 'dynamic_import'
            : 'static_import',
      };
    })
    .sort((left, right) => compareText(`${left.from}\0${left.to}`, `${right.from}\0${right.to}`));
}

function recordArray(facts, field, code) {
  const value = facts?.sourceIndex?.[field];
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(code);
  return value;
}

function requiredRecordPath(record, field, code) {
  if (!isObject(record) || typeof record[field] !== 'string' || record[field].trim() === '') {
    fail(code);
  }
  return normalizeRelativePath(record[field]);
}

function generatedEdges(facts) {
  return recordArray(facts, 'generatedBindingRecords', 'IMPACT_GENERATED_BINDINGS_INVALID').flatMap(
    (record) => {
      const ownerPath = requiredRecordPath(record, 'ownerPath', 'IMPACT_GENERATED_BINDING_INVALID');
      const outputPath = requiredRecordPath(
        record,
        'outputPath',
        'IMPACT_GENERATED_BINDING_INVALID'
      );
      const consumerPath = requiredRecordPath(
        record,
        'consumerPath',
        'IMPACT_GENERATED_BINDING_INVALID'
      );
      const evidenceRef =
        typeof record.evidenceRef === 'string' ? record.evidenceRef : 'generated:binding';
      return [
        {
          from: outputPath,
          to: ownerPath,
          bindingKind: 'generated_artifact',
          evidenceRef,
        },
        {
          from: consumerPath,
          to: outputPath,
          bindingKind: 'generated_artifact',
          evidenceRef,
        },
      ];
    }
  );
}

function registryEdges(facts) {
  return recordArray(facts, 'registryBindingRecords', 'IMPACT_REGISTRY_BINDINGS_INVALID').map(
    (record) => ({
      from: requiredRecordPath(record, 'registryPath', 'IMPACT_REGISTRY_BINDING_INVALID'),
      to: requiredRecordPath(record, 'targetPath', 'IMPACT_REGISTRY_BINDING_INVALID'),
      bindingKind: 'registry_schema',
      evidenceRef: typeof record.evidenceRef === 'string' ? record.evidenceRef : 'registry:binding',
    })
  );
}

function packageBinEdges(facts) {
  return recordArray(facts, 'packageBinRecords', 'IMPACT_PACKAGE_BIN_RECORDS_INVALID').map(
    (record) => ({
      from: requiredRecordPath(record, 'targetPath', 'IMPACT_PACKAGE_BIN_RECORD_INVALID'),
      to: requiredRecordPath(record, 'packagePath', 'IMPACT_PACKAGE_BIN_RECORD_INVALID'),
      bindingKind: 'cli_command',
      evidenceRef:
        typeof record.evidenceRef === 'string' ? record.evidenceRef : 'package:bin-binding',
    })
  );
}

function collectPackageExportEntries(value, exportKey = '.', entries = []) {
  if (typeof value === 'string') {
    if (value.startsWith('./')) entries.push({ exportKey, target: value });
    return entries;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectPackageExportEntries(entry, exportKey, entries);
    return entries;
  }
  if (isObject(value)) {
    const objectEntries = Object.entries(value);
    const subpathEntries = objectEntries.filter(([key]) => key.startsWith('.'));
    if (subpathEntries.length > 0) {
      if (subpathEntries.length !== objectEntries.length) {
        fail('IMPACT_PACKAGE_EXPORT_PATTERN_UNRESOLVED', { reason: 'mixed_export_keys' });
      }
      for (const [key, entry] of subpathEntries) {
        collectPackageExportEntries(entry, key, entries);
      }
      return entries;
    }
    for (const entry of Object.values(value)) {
      collectPackageExportEntries(entry, exportKey, entries);
    }
  }
  return entries;
}

function wildcardCount(value) {
  return [...value].filter((character) => character === '*').length;
}

function singleWildcardValue(pattern, candidate) {
  const wildcardIndex = pattern.indexOf('*');
  const prefix = pattern.slice(0, wildcardIndex);
  const suffix = pattern.slice(wildcardIndex + 1);
  if (
    !candidate.startsWith(prefix) ||
    !candidate.endsWith(suffix) ||
    candidate.length < prefix.length + suffix.length
  ) {
    return null;
  }
  const value = candidate.slice(prefix.length, candidate.length - suffix.length);
  if (
    value.length === 0 ||
    value.includes('*') ||
    value.split('/').some((segment) => segment === '..')
  ) {
    return null;
  }
  return value;
}

function packageManifestEdges(facts, candidatePaths) {
  return recordArray(facts, 'packageRecords', 'IMPACT_PACKAGE_RECORDS_INVALID').flatMap(
    (record) => {
      const packagePath = requiredRecordPath(
        record,
        'packagePath',
        'IMPACT_PACKAGE_RECORD_INVALID'
      );
      const packageDirectory = normalizeRelativePath(record.packageDirectory || '.');
      if (!isObject(record.packageJson)) fail('IMPACT_PACKAGE_RECORD_INVALID');
      return collectPackageExportEntries(record.packageJson.exports).flatMap(
        ({ exportKey, target }) => {
          const targetPattern = normalizeRelativePath(path.posix.join(packageDirectory, target));
          const keyWildcardCount = wildcardCount(exportKey);
          const targetWildcardCount = wildcardCount(targetPattern);
          if (keyWildcardCount === 0 && targetWildcardCount === 0) {
            return [
              {
                from: packagePath,
                to: targetPattern,
                bindingKind: 'public_consumer_boundary',
                evidenceRef: `source:${packagePath}#exports`,
              },
            ];
          }
          if (keyWildcardCount !== 1 || targetWildcardCount !== 1) {
            fail('IMPACT_PACKAGE_EXPORT_PATTERN_UNRESOLVED', {
              packagePath,
              exportKey,
              target,
            });
          }
          return candidatePaths.flatMap((candidatePath) => {
            const wildcardValue = singleWildcardValue(targetPattern, candidatePath);
            if (wildcardValue === null) return [];
            return [
              {
                from: packagePath,
                to: candidatePath,
                bindingKind: 'public_consumer_boundary',
                evidenceRef: `source:${packagePath}#exports:${exportKey.replace(
                  '*',
                  wildcardValue
                )}`,
              },
            ];
          });
        }
      );
    }
  );
}

function gitRelationEdges(changes) {
  return changes
    .filter((change) => change.previousPath && change.status.startsWith('R'))
    .map((change) => ({
      from: change.changedPath,
      to: change.previousPath,
      bindingKind: 'git_rename',
      evidenceRef: `git:${change.status}:${change.previousPath}->${change.changedPath}`,
    }));
}

function sourceEdges(facts, changes) {
  const baseEdges = [
    ...productionEdges(facts),
    ...generatedEdges(facts),
    ...registryEdges(facts),
    ...packageBinEdges(facts),
    ...gitRelationEdges(changes),
  ];
  const candidatePaths = stableUnique([
    ...changes.flatMap((change) => [
      change.changedPath,
      ...(change.previousPath && change.status.startsWith('R') ? [change.previousPath] : []),
    ]),
    ...baseEdges.flatMap((edge) => [edge.from, edge.to]),
  ]);
  return [...baseEdges, ...packageManifestEdges(facts, candidatePaths)].sort((left, right) =>
    compareText(
      `${left.from}\0${left.to}\0${left.bindingKind}\0${left.evidenceRef}`,
      `${right.from}\0${right.to}\0${right.bindingKind}\0${right.evidenceRef}`
    )
  );
}

function optionalSourceStatus(facts) {
  const sourceIndex = isObject(facts?.sourceIndex) ? facts.sourceIndex : {};
  const sourceAvailability = {};
  const sourceDiagnostics = [];
  for (const field of OPTIONAL_SOURCE_FIELDS) {
    const available = Object.prototype.hasOwnProperty.call(sourceIndex, field);
    sourceAvailability[field] = available ? 'available' : 'unavailable';
    if (!available) sourceDiagnostics.push(`IMPACT_SOURCE_UNAVAILABLE:${field}`);
  }
  return { sourceAvailability, sourceDiagnostics };
}

function indexConsumersByTarget(edges) {
  const consumersByTarget = new Map();
  for (const edge of edges) {
    if (!consumersByTarget.has(edge.to)) consumersByTarget.set(edge.to, []);
    consumersByTarget.get(edge.to).push(edge);
  }
  return consumersByTarget;
}

function reverseReachablePaths(changedPath, consumersByTarget) {
  const visited = new Set([changedPath]);
  const evidenceRefs = [];
  const bindingKinds = [];
  const queue = [changedPath];
  while (queue.length > 0) {
    const target = queue.shift();
    for (const edge of consumersByTarget.get(target) || []) {
      evidenceRefs.push(edge.evidenceRef);
      bindingKinds.push(edge.bindingKind);
      if (visited.has(edge.from)) continue;
      visited.add(edge.from);
      if (visited.size > MAX_GRAPH_PATHS) {
        fail('IMPACT_GRAPH_EXPANSION_LIMIT', { changedPath, limit: MAX_GRAPH_PATHS });
      }
      queue.push(edge.from);
    }
  }
  return {
    paths: visited,
    evidenceRefs: stableUnique(evidenceRefs),
    bindingKinds: stableUnique(bindingKinds),
  };
}

function packageOwner(changedPath, tests, facts) {
  const matchingRecords = recordArray(facts, 'packageRecords', 'IMPACT_PACKAGE_RECORDS_INVALID')
    .map((record) => {
      if (!isObject(record?.packageJson)) {
        fail('IMPACT_PACKAGE_RECORD_INVALID');
      }
      if (!Object.prototype.hasOwnProperty.call(record.packageJson, 'name')) return null;
      if (typeof record.packageJson.name !== 'string') fail('IMPACT_PACKAGE_RECORD_INVALID');
      if (record.packageJson.name.trim().length === 0) return null;
      const packageDirectory = normalizeRelativePath(record.packageDirectory || '.');
      return {
        packageDirectory,
        packageId: record.packageJson.name,
      };
    })
    .filter(Boolean)
    .filter(
      (record) =>
        record.packageDirectory !== '.' &&
        (changedPath === record.packageDirectory ||
          changedPath.startsWith(`${record.packageDirectory}/`))
    )
    .sort(
      (left, right) =>
        right.packageDirectory.length - left.packageDirectory.length ||
        compareText(left.packageDirectory, right.packageDirectory) ||
        compareText(left.packageId, right.packageId)
    );
  if (matchingRecords.length === 0) return null;
  const longestLength = matchingRecords[0].packageDirectory.length;
  const longestRecords = matchingRecords.filter(
    (record) => record.packageDirectory.length === longestLength
  );
  const longestPackageIds = stableUnique(longestRecords.map((record) => record.packageId));
  if (longestPackageIds.length !== 1) {
    fail('IMPACT_PACKAGE_OWNERSHIP_CONFLICT', {
      changedPath,
      packageIds: longestPackageIds,
    });
  }
  const packageDirectory = longestRecords[0].packageDirectory;
  const catalogPackageIds = stableUnique(
    tests
      .filter(
        (test) =>
          test.testPath === packageDirectory || test.testPath.startsWith(`${packageDirectory}/`)
      )
      .map((test) => test.packageId)
      .filter((packageId) => typeof packageId === 'string' && packageId.trim() !== '')
  );
  if (catalogPackageIds.length > 1) {
    fail('IMPACT_PACKAGE_TEST_IDENTITY_CONFLICT', {
      changedPath,
      packageDirectory,
      packageIds: catalogPackageIds,
    });
  }
  return catalogPackageIds[0] || longestPackageIds[0];
}

function isProductPath(changedPath) {
  return (
    PRODUCT_PATH_PREFIXES.some((prefix) => changedPath.startsWith(prefix)) ||
    ['package.json', 'package-lock.json'].includes(changedPath) ||
    /^[^/]+\.(?:js|cjs|mjs|ts|cts|mts|jsx|tsx)$/u.test(changedPath)
  );
}

function matchesManagedPathRule(changedPath, rule) {
  const candidate = normalizeRelativePath(changedPath);
  const pattern = normalizeRelativePath(rule);
  if (pattern.endsWith('/**')) {
    const base = pattern.slice(0, -3).replace(/\/+$/u, '');
    return candidate === base || candidate.startsWith(`${base}/`);
  }
  return candidate === pattern;
}

function isManagedImpactPath(changedPath, policy) {
  const selection = isObject(policy?.selection) ? policy.selection : {};
  const managedRules = [
    ...(Array.isArray(selection.releaseSurfacePathRules)
      ? selection.releaseSurfacePathRules
      : []),
    ...(Array.isArray(selection.highDiffusionPathRules)
      ? selection.highDiffusionPathRules
      : []),
  ];
  return managedRules.some((rule) => matchesManagedPathRule(changedPath, rule));
}

function criticalBindingKinds(test) {
  return stableUnique(
    (test.classifications?.criticalBindings || [])
      .map((binding) => binding?.kind)
      .filter((kind) => typeof kind === 'string')
  );
}

function observedTestIdentityRefs(facts, reachablePaths) {
  const fields = ['observedExecutionBindings', 'historicalExecutionBindings'];
  const rows = fields.flatMap((field) =>
    recordArray(facts, field, 'IMPACT_EXECUTION_BINDINGS_INVALID').map((record) => {
      if (
        !isObject(record) ||
        typeof record.testIdentity !== 'string' ||
        record.testIdentity.trim() === ''
      ) {
        fail('IMPACT_EXECUTION_BINDING_INVALID');
      }
      return {
        targetPath: requiredRecordPath(record, 'targetPath', 'IMPACT_EXECUTION_BINDING_INVALID'),
        testIdentity: record.testIdentity,
        evidenceRef:
          typeof record.evidenceRef === 'string' ? record.evidenceRef : `execution:${field}`,
      };
    })
  );
  const matching = rows.filter((row) => reachablePaths.has(row.targetPath));
  return {
    identityRefs: stableUnique(matching.map((row) => row.testIdentity)),
    evidenceRefs: stableUnique(matching.map((row) => row.evidenceRef)),
  };
}

function packageDirectoryOwner(filePath, facts) {
  const packageDirectories = stableUnique([
    ...recordArray(facts, 'packageRecords', 'IMPACT_PACKAGE_RECORDS_INVALID').map((record) =>
      normalizeRelativePath(record.packageDirectory || '.')
    ),
    ...recordArray(facts, 'packageBinRecords', 'IMPACT_PACKAGE_BIN_RECORDS_INVALID').map((record) =>
      normalizeRelativePath(record.packageDirectory || '.')
    ),
  ])
    .filter(
      (packageDirectory) =>
        packageDirectory !== '.' &&
        (filePath === packageDirectory || filePath.startsWith(`${packageDirectory}/`))
    )
    .sort((left, right) => right.length - left.length || compareText(left, right));
  return packageDirectories[0] || '.';
}

function packageBoundaryManifestPath(changedPath) {
  const normalized = normalizeRelativePath(changedPath);
  if (path.posix.basename(normalized) !== 'package-lock.json') return normalized;
  return normalizeRelativePath(path.posix.join(path.posix.dirname(normalized), 'package.json'));
}

function packageBoundaryTests(changedPath, tests, facts) {
  const packagePath = packageBoundaryManifestPath(changedPath);
  const binRecords = recordArray(facts, 'packageBinRecords', 'IMPACT_PACKAGE_BIN_RECORDS_INVALID')
    .filter(
      (record) =>
        normalizeRelativePath(record.packagePath) === packagePath ||
        normalizeRelativePath(record.targetPath) === changedPath
    )
    .map((record) => normalizeRelativePath(record.packageDirectory || '.'));
  const manifestRecords = recordArray(facts, 'packageRecords', 'IMPACT_PACKAGE_RECORDS_INVALID')
    .filter((record) => normalizeRelativePath(record.packagePath) === packagePath)
    .map((record) => normalizeRelativePath(record.packageDirectory || '.'));
  const records = stableUnique([...binRecords, ...manifestRecords]);
  if (records.length === 0) return [];
  const allowedKinds = new Set([
    'cli_bin',
    'consumer_compatibility',
    'package_install',
    'packaged_runtime',
  ]);
  return tests.filter((test) => {
    if (!criticalBindingKinds(test).some((kind) => allowedKinds.has(kind))) return false;
    return records.includes(packageDirectoryOwner(test.testPath, facts));
  });
}

function bindingForPath({ changedPath, tests, consumersByTarget, facts }) {
  const exactTests = tests.filter((test) => test.testPath === changedPath);
  const fixtureTests = tests.filter((test) => test.fixtureRefs.includes(changedPath));
  const reachable = reverseReachablePaths(changedPath, consumersByTarget);
  const commandBindings = commandBindingsForTarget(changedPath);
  const targetTests = tests.filter((test) =>
    test.targetRefs.some((targetRef) => reachable.paths.has(targetRef))
  );
  const observed = observedTestIdentityRefs(facts, reachable.paths);
  const observedTests = observed.identityRefs.map((identityKey) => {
    const test = tests.find((candidate) => candidate.identityKey === identityKey);
    if (!test) fail('IMPACT_EXECUTION_TEST_UNRESOLVED', { identityKey });
    return test;
  });
  const boundaryTests = packageBoundaryTests(changedPath, tests, facts);
  const owner = packageOwner(changedPath, tests, facts);
  const primaryTests = [
    ...new Map(
      [...exactTests, ...fixtureTests, ...targetTests, ...observedTests, ...boundaryTests].map(
        (test) => [test.identityKey, test]
      )
    ).values(),
  ];
  if (isFixtureAssetPath(changedPath) && primaryTests.length === 0) return null;
  const selfHostingTests =
    primaryTests.length === 0 && !owner ? ciSelfHostingTests(changedPath, tests) : [];
  const matchedTests = [...primaryTests, ...selfHostingTests];
  if (matchedTests.length === 0 && !owner) return null;
  const directTarget = targetTests.some((test) => test.targetRefs.includes(changedPath));
  const bindingKinds = [...reachable.bindingKinds];
  if (exactTests.length > 0) bindingKinds.push('changed_test');
  if (fixtureTests.length > 0) bindingKinds.push('fixture_dependency');
  if (directTarget) bindingKinds.push('direct_target');
  if (commandBindings.length > 0) bindingKinds.push('cli_command');
  if (observedTests.length > 0) bindingKinds.push('observed_execution');
  if (boundaryTests.length > 0) bindingKinds.push('public_consumer_boundary');
  if (selfHostingTests.length > 0) bindingKinds.push('ci_self_hosting');
  if (owner) bindingKinds.push('package_ownership');
  return {
    changedPath,
    testIdentityRefs: stableUnique(matchedTests.map((test) => test.identityKey)),
    traceRefs: stableUnique(matchedTests.flatMap((test) => test.traceRefs || [])),
    capabilityRefs: stableUnique(matchedTests.flatMap((test) => test.capabilityRefs || [])),
    featureRefs: stableUnique(matchedTests.flatMap((test) => test.featureRefs || [])),
    packageIds: owner ? [owner] : [],
    bindingKinds: stableUnique(bindingKinds),
    evidenceRefs: stableUnique([
      ...reachable.evidenceRefs,
      ...observed.evidenceRefs,
      ...commandBindings.map((binding) => binding.evidenceRef),
      ...(selfHostingTests.length > 0 ? [`policy:ci-self-hosting:${changedPath}`] : []),
      ...fixtureTests.flatMap((test) =>
        (test.evidenceRefs || []).filter((evidenceRef) =>
          evidenceRef.endsWith(`#test-target:${changedPath}`)
        )
      ),
    ]),
  };
}

function validateDeclaredProvenance({ catalog, facts, policy, commitSha }) {
  validateTestPolicy(policy);
  validateTestCatalog(catalog);
  if (!isObject(facts) || facts.schemaVersion !== 'test-portfolio-audit-facts/v1') {
    fail('IMPACT_FACTS_SCHEMA_INVALID');
  }
  if (!isObject(facts.repository) || typeof facts.repository.commit !== 'string') {
    fail('IMPACT_FACTS_REPOSITORY_INVALID');
  }
  if (facts.repository.dirty !== false) fail('IMPACT_FACTS_DIRTY');
  if (facts.repository.commit.toLowerCase() !== commitSha.toLowerCase()) {
    fail('IMPACT_FACTS_COMMIT_MISMATCH', {
      expected: commitSha,
      actual: facts.repository.commit,
    });
  }
  if (!isObject(catalog) || catalog.schemaVersion !== 'test-catalog/v1') {
    fail('IMPACT_CATALOG_SCHEMA_INVALID');
  }
  if (!isObject(catalog.repository) || typeof catalog.repository.commit !== 'string') {
    fail('IMPACT_CATALOG_REPOSITORY_INVALID');
  }
  if (catalog.repository.dirty !== false) fail('IMPACT_CATALOG_DIRTY');
  if (catalog.repository.commit.toLowerCase() !== commitSha.toLowerCase()) {
    fail('IMPACT_CATALOG_COMMIT_MISMATCH', {
      expected: commitSha,
      actual: catalog.repository.commit,
    });
  }
  if (
    catalog.repository.commit.toLowerCase() !== facts.repository.commit.toLowerCase() ||
    catalog.repository.dirty !== facts.repository.dirty
  ) {
    fail('IMPACT_AUTHORITY_PROVENANCE_MISMATCH');
  }
  if (typeof catalog.factsHash !== 'string') fail('IMPACT_CATALOG_FACTS_HASH_MISSING');
  if (catalog.factsHash !== catalogFactsHash(facts)) {
    fail('IMPACT_CATALOG_FACTS_MISMATCH');
  }
  const expectedPolicyHash = catalogPolicyHash(policy);
  if (catalog.policyHash !== expectedPolicyHash) {
    fail('IMPACT_CATALOG_POLICY_HASH_MISMATCH', {
      expected: expectedPolicyHash,
      actual: catalog.policyHash,
    });
  }
  validateCatalogAuthority({
    catalog,
    facts,
    policy,
    errorCode: 'IMPACT_CATALOG_AUTHORITY_MISMATCH',
  });
}

function buildChangedCodeImpact({ repoRoot, baseSha, commitSha, catalog, facts, policy }) {
  if (typeof repoRoot !== 'string' || repoRoot.trim() === '') fail('IMPACT_REPO_ROOT_INVALID');
  const committed = readCommittedChanges({ repoRoot, baseSha, commitSha });
  validateDeclaredProvenance({
    catalog,
    facts,
    policy,
    commitSha: committed.commitSha,
  });
  const tests = catalogTests(catalog);
  const edges = sourceEdges(facts, committed.changes);
  const consumersByTarget = indexConsumersByTarget(edges);
  const changedPaths = stableUnique(
    committed.changes.flatMap((change) => [
      change.changedPath,
      ...(change.previousPath && change.status.startsWith('R') ? [change.previousPath] : []),
    ])
  );
  const changedTestIdentityKeys = [];
  const pathBindings = [];
  const unresolvedRefs = [];
  const unmappedChangedProductPaths = [];

  for (const changedPath of changedPaths) {
    const binding = bindingForPath({ changedPath, tests, consumersByTarget, facts });
    const exactTests = tests.filter((test) => test.testPath === changedPath);
    changedTestIdentityKeys.push(...exactTests.map((test) => test.identityKey));
    if (binding) {
      pathBindings.push(binding);
      continue;
    }
    if (isProductPath(changedPath) && !isManagedImpactPath(changedPath, policy)) {
      unmappedChangedProductPaths.push(changedPath);
      unresolvedRefs.push(`path:${changedPath}`);
    }
  }

  if (unresolvedRefs.length > 0) {
    fail('IMPACT_BINDING_UNRESOLVED', {
      unmappedChangedProductPaths: stableUnique(unmappedChangedProductPaths),
      unresolvedRefs: stableUnique(unresolvedRefs),
    });
  }

  const impact = {
    schemaVersion: 'committed-changed-code-impact/v1',
    baseSha: committed.baseSha,
    commitSha: committed.commitSha,
    changedFiles: committed.changes,
    changedPaths,
    changedTestIdentityKeys: stableUnique(changedTestIdentityKeys),
    pathBindings: pathBindings.sort((left, right) =>
      compareText(left.changedPath, right.changedPath)
    ),
    traceRefs: stableUnique(pathBindings.flatMap((binding) => binding.traceRefs)),
    capabilityRefs: stableUnique(pathBindings.flatMap((binding) => binding.capabilityRefs)),
    featureRefs: stableUnique(pathBindings.flatMap((binding) => binding.featureRefs)),
    packageIds: stableUnique(pathBindings.flatMap((binding) => binding.packageIds)),
    unresolvedRefs: [],
    unmappedChangedProductPaths: [],
    ...optionalSourceStatus(facts),
    provenance: {
      catalogHash: sha256Bytes(canonicalJsonBytes(catalog)),
      factsHash: catalogFactsHash(facts),
      gitDiffHash: sha256Bytes(canonicalJsonBytes(committed.changes)),
    },
  };
  return {
    ...impact,
    impactHash: sha256Bytes(canonicalJsonBytes(impact)),
  };
}

module.exports = {
  bindingForPath,
  buildChangedCodeImpact,
  isProductPath,
  parseNameStatus,
  readCommittedChanges,
};
