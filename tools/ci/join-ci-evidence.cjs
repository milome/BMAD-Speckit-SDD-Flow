'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { compareText, fail } = require('./canonical-artifact.cjs');

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareLaneResult(left, right) {
  const laneOrder = compareText(left.lane, right.lane);
  return laneOrder !== 0 ? laneOrder : compareText(left.shardId, right.shardId);
}

function requireDenseArray(value, code) {
  if (!Array.isArray(value)) fail(code);
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) fail(code);
  }
  return value;
}

function normalizeExecutedIdentityKeys(value) {
  const values = requireDenseArray(value, 'CI_LANE_IDENTITIES_INVALID');
  if (values.some((identityKey) => typeof identityKey !== 'string' || identityKey.trim() === '')) {
    fail('CI_LANE_IDENTITIES_INVALID');
  }
  const normalized = values.map((identityKey) => identityKey.trim());
  if (new Set(normalized).size !== normalized.length) {
    fail('CI_TEST_EXECUTED_MORE_THAN_ONCE');
  }
  return normalized.sort(compareText);
}

function normalizeEvidenceStatus(value) {
  if (value === undefined) return null;
  const allowed = new Set(['complete', 'partial', 'invalid', 'missing']);
  if (!isPlainObject(value) || !allowed.has(value.junit) || !allowed.has(value.timing)) {
    fail('CI_LANE_EVIDENCE_STATUS_INVALID');
  }
  return {
    junit: value.junit,
    timing: value.timing,
  };
}

function normalizeLaneResult(result) {
  if (!isPlainObject(result)) fail('CI_LANE_RESULT_INVALID');
  if (
    typeof result.lane !== 'string' ||
    result.lane.trim() === '' ||
    typeof result.shardId !== 'string' ||
    result.shardId.trim() === ''
  ) {
    fail('CI_LANE_RESULT_INVALID');
  }
  const failedIdentityKeys =
    result.failedIdentityKeys === undefined
      ? null
      : normalizeExecutedIdentityKeys(result.failedIdentityKeys);
  const evidenceStatus = normalizeEvidenceStatus(result.evidenceStatus);
  return {
    lane: result.lane.trim(),
    shardId: result.shardId.trim(),
    commitSha: result.commitSha,
    planHash: result.planHash,
    packageDescriptorHash: result.packageDescriptorHash,
    tarballSha256: result.tarballSha256,
    outcome: result.outcome,
    executedIdentityKeys: normalizeExecutedIdentityKeys(result.executedIdentityKeys),
    ...(failedIdentityKeys === null ? {} : { failedIdentityKeys }),
    ...(evidenceStatus === null ? {} : { evidenceStatus }),
  };
}

function joinCiEvidence({ manifest, laneResults }) {
  const { validateRunManifest } = require('./write-ci-run-manifest.cjs');
  validateRunManifest(manifest);
  if (manifest.status !== 'planned') fail('CI_MANIFEST_ALREADY_FINALIZED');
  requireDenseArray(laneResults, 'CI_LANE_RESULTS_INVALID');

  const shards = manifest.plan.shardPlan.shards;
  const expectedShards = new Map(shards.map((shard) => [`${shard.lane}\0${shard.shardId}`, shard]));
  const selectedIdentityKeys = new Set(shards.flatMap((shard) => shard.identityKeys));
  const expectedCoreIdentityKeys = new Set(
    shards.filter((shard) => shard.lane === 'core').flatMap((shard) => shard.identityKeys)
  );
  const actualShards = new Map();
  const executionCount = new Map();

  for (const rawResult of laneResults) {
    const result = normalizeLaneResult(rawResult);
    if (result.commitSha !== manifest.plan.repository.commitSha) {
      fail('CI_LANE_COMMIT_SHA_MISMATCH');
    }
    if (result.planHash !== manifest.planHash) fail('CI_LANE_PLAN_HASH_MISMATCH');
    if (result.packageDescriptorHash !== manifest.plan.packageDescriptorHash) {
      fail('CI_LANE_PACKAGE_DESCRIPTOR_HASH_MISMATCH');
    }
    if (result.tarballSha256 !== manifest.plan.tarballSha256) {
      fail('CI_LANE_TARBALL_HASH_MISMATCH');
    }
    const key = `${result.lane}\0${result.shardId}`;
    const expectedShard = expectedShards.get(key);
    if (!expectedShard) fail('CI_UNPLANNED_SHARD_RESULT');
    if (actualShards.has(key)) fail('CI_DUPLICATE_SHARD_RESULT');
    const expectedFailureIdentityKeys = expectedShard.expectedFailureIdentityKeys || [];
    const failedIdentityKeys = result.failedIdentityKeys || [];
    if (result.outcome === 'expected_failed') {
      if (expectedFailureIdentityKeys.length === 0) {
        fail('CI_EXPECTED_FAILURE_NOT_DECLARED');
      }
      if (
        result.evidenceStatus?.junit !== 'complete' ||
        result.evidenceStatus?.timing !== 'complete'
      ) {
        fail('CI_EXPECTED_FAILURE_EVIDENCE_INCOMPLETE');
      }
      const expectedFailureIdentitySet = new Set(expectedFailureIdentityKeys);
      const executedIdentitySet = new Set(result.executedIdentityKeys);
      if (
        failedIdentityKeys.length === 0 ||
        failedIdentityKeys.some(
          (identityKey) =>
            !expectedFailureIdentitySet.has(identityKey) || !executedIdentitySet.has(identityKey)
        )
      ) {
        fail('CI_EXPECTED_FAILURE_IDENTITY_MISMATCH');
      }
    } else {
      if (failedIdentityKeys.length > 0) fail('CI_LANE_FAILURE_EVIDENCE_INVALID');
      if (result.outcome !== 'passed') fail('CI_REQUIRED_LANE_NOT_PASSED');
    }

    const expectedIdentityKeys = new Set(expectedShard.identityKeys);
    const unplanned = result.executedIdentityKeys.filter(
      (identityKey) => !selectedIdentityKeys.has(identityKey)
    );
    if (unplanned.length > 0) fail('CI_UNPLANNED_TEST_EXECUTED', { identityKeys: unplanned });
    const wrongShard = result.executedIdentityKeys.filter(
      (identityKey) => !expectedIdentityKeys.has(identityKey)
    );
    if (wrongShard.length > 0) {
      fail('CI_SHARD_IDENTITY_MISMATCH', {
        lane: result.lane,
        shardId: result.shardId,
        identityKeys: wrongShard,
      });
    }
    const omittedFromShard = expectedShard.identityKeys.filter(
      (identityKey) => !result.executedIdentityKeys.includes(identityKey)
    );
    if (omittedFromShard.length > 0) {
      fail('CI_SELECTED_TEST_NOT_EXECUTED', { identityKeys: omittedFromShard });
    }

    actualShards.set(key, result);
    for (const identityKey of result.executedIdentityKeys) {
      executionCount.set(identityKey, (executionCount.get(identityKey) || 0) + 1);
    }
  }

  const missingShardCount = [...expectedShards.keys()].filter(
    (key) => !actualShards.has(key)
  ).length;
  if (missingShardCount > 0) fail('CI_REQUIRED_SHARD_MISSING', { missingShardCount });

  const omitted = [...selectedIdentityKeys].filter(
    (identityKey) => !executionCount.has(identityKey)
  );
  if (omitted.length > 0) fail('CI_SELECTED_TEST_NOT_EXECUTED', { identityKeys: omitted });
  const duplicated = [...executionCount]
    .filter(([, count]) => count !== 1)
    .map(([identityKey]) => identityKey);
  if (duplicated.length > 0) {
    fail('CI_TEST_EXECUTED_MORE_THAN_ONCE', { identityKeys: duplicated });
  }
  const unplanned = [...executionCount.keys()].filter(
    (identityKey) => !selectedIdentityKeys.has(identityKey)
  );
  if (unplanned.length > 0) fail('CI_UNPLANNED_TEST_EXECUTED', { identityKeys: unplanned });
  const missingCore = [...expectedCoreIdentityKeys].filter(
    (identityKey) => executionCount.get(identityKey) !== 1
  );
  if (missingCore.length > 0)
    fail('CI_REQUIRED_CORE_IDENTITY_MISSING', { identityKeys: missingCore });

  return {
    laneResults: [...actualShards.values()].sort(compareLaneResult),
    gates: {
      missingShardCount,
      omittedIdentityCount: omitted.length,
      duplicateExecutionCount: duplicated.length,
      unplannedExecutionCount: unplanned.length,
      requiredCoreIdentityMissingCount: missingCore.length,
    },
  };
}

function parseCliArgs(args) {
  const options = {
    'output-dir': '.artifacts/test-portfolio/final',
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      !['--manifest', '--lane-results-dir', '--output-dir'].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CI_EVIDENCE_JOIN_CLI_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  if (!options.manifest || !options['lane-results-dir']) {
    fail('CI_EVIDENCE_JOIN_CLI_ARGS_INVALID');
  }
  return options;
}

function laneResultPaths(root) {
  const paths = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isSymbolicLink()) fail('CI_LANE_RESULT_PATH_INVALID');
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && entry.name.endsWith('.result.json')) paths.push(target);
      if (paths.length > 256 || pending.length > 256) fail('CI_LANE_RESULT_COUNT_EXCEEDED');
    }
  }
  return paths.sort(compareText);
}

function main(args = process.argv.slice(2)) {
  const options = parseCliArgs(args);
  const repoRoot = process.cwd();
  const { readCanonicalArtifact } = require('./canonical-artifact.cjs');
  const { finalizeRunManifest, writeRunManifest } = require('./write-ci-run-manifest.cjs');
  const manifest = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options.manifest),
  }).artifact;
  const resultsRoot = path.resolve(repoRoot, options['lane-results-dir']);
  const laneResults = laneResultPaths(resultsRoot).map(
    (filePath) => readCanonicalArtifact({ repoRoot, filePath }).artifact
  );
  const finalized = finalizeRunManifest(manifest, { laneResults });
  const receipt = writeRunManifest({
    repoRoot,
    outputDir: options['output-dir'],
    manifest: finalized,
  });
  process.stdout.write(
    `${JSON.stringify({
      path: receipt.path,
      sha256: receipt.sha256,
      planHash: receipt.planHash,
      status: finalized.status,
      failure: finalized.failure || null,
    })}\n`
  );
  return finalized.status === 'complete' ? 0 : 1;
}

module.exports = {
  joinCiEvidence,
  main,
  parseCliArgs,
};

if (require.main === module) {
  process.exitCode = main();
}
