'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const { compareText, fail } = require('./canonical-artifact.cjs');
const {
  buildInfrastructureOnlyDiagnostics,
  buildSixModelCiDiagnostics,
  buildSixModelPlanningDiagnostics,
  writeSixModelCiDiagnostics,
} = require('./build-six-model-ci-diagnostics.cjs');

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
      if (result.outcome === 'failed') {
        const executedIdentitySet = new Set(result.executedIdentityKeys);
        if (failedIdentityKeys.some((identityKey) => !executedIdentitySet.has(identityKey))) {
          fail('CI_LANE_FAILURE_EVIDENCE_INVALID');
        }
        fail('CI_REQUIRED_LANE_NOT_PASSED');
      }
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
      ![
        '--manifest',
        '--lane-results-dir',
        '--semantic-index',
        '--status-snapshot',
        '--expected-attempt-id',
        '--expected-source-document-hash',
        '--expected-implementation-confirmation-hash',
        '--expected-semantic-model-hash',
        '--output-dir',
      ].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CI_EVIDENCE_JOIN_CLI_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  const statusOptions = [
    options['status-snapshot'],
    options['expected-attempt-id'],
    options['expected-source-document-hash'],
    options['expected-implementation-confirmation-hash'],
    options['expected-semantic-model-hash'],
  ];
  if (
    !options.manifest ||
    !options['lane-results-dir'] ||
    !options['semantic-index'] ||
    (statusOptions.some(Boolean) && !statusOptions.every(Boolean))
  ) {
    fail('CI_EVIDENCE_JOIN_CLI_ARGS_INVALID');
  }
  return options;
}

function laneResultKey(value) {
  return `${value.lane}\0${value.shardId}`;
}

function validateSemanticIndexManifestBinding(manifest, semanticIndex) {
  const shardPlan = manifest?.plan?.shardPlan;
  if (
    !isPlainObject(semanticIndex) ||
    semanticIndex.semanticIndexHash !== manifest?.plan?.semanticIndexHash ||
    semanticIndex.selectionHash !== shardPlan?.selectionHash ||
    semanticIndex.shardPlanHash !== shardPlan?.shardPlanHash ||
    (shardPlan?.selection?.coverageReportHash !== undefined &&
      semanticIndex.coverageReportHash !== shardPlan.selection.coverageReportHash) ||
    semanticIndex.catalogHash !== manifest?.plan?.catalogHash
  ) {
    fail('CI_SEMANTIC_INDEX_MANIFEST_MISMATCH');
  }
  const expectedShards = (shardPlan.shards || []).map(({ lane, shardId, identityKeys }) => ({
    lane,
    shardId,
    identityKeys,
  }));
  const actualShards = (semanticIndex.shards || []).map(({ lane, shardId, identityKeys }) => ({
    lane,
    shardId,
    identityKeys,
  }));
  const placements = new Map();
  for (const shard of semanticIndex.shards || []) {
    for (const identityKey of shard.identityKeys || []) {
      placements.set(identityKey, `${shard.lane}\0${shard.shardId}`);
    }
  }
  const testPlacements = (semanticIndex.tests || []).map((test) => ({
    identityKey: test.identityKey,
    placement: `${test.lane}\0${test.shardId}`,
  }));
  const expectedPlacements = (shardPlan.selection?.selected || []).map((test) => ({
    identityKey: test.identityKey,
    placement: placements.get(test.identityKey),
  }));
  if (
    !canonicalJsonBytes(actualShards).equals(canonicalJsonBytes(expectedShards)) ||
    !canonicalJsonBytes(testPlacements).equals(canonicalJsonBytes(expectedPlacements))
  ) {
    fail('CI_SEMANTIC_INDEX_MANIFEST_MISMATCH');
  }
}

function fallbackSemanticIndex(manifest) {
  const shardPlan = manifest.plan.shardPlan;
  const placements = new Map();
  for (const shard of shardPlan.shards) {
    for (const identityKey of shard.identityKeys) {
      placements.set(identityKey, { lane: shard.lane, shardId: shard.shardId });
    }
  }
  const uncoveredObligationRefs = [...(shardPlan.selection.uncoveredObligationIds || [])].sort(
    compareText
  );
  const body = {
    schemaVersion: 'ci-shard-semantic-index/v1',
    selectionHash: shardPlan.selectionHash,
    shardPlanHash: shardPlan.shardPlanHash,
    coverageReportHash: shardPlan.selection.coverageReportHash,
    catalogHash: manifest.plan.catalogHash,
    changedPathsHash: sha256Bytes(canonicalJsonBytes([])),
    uncoveredObligationRefs,
    obligationBindings: uncoveredObligationRefs.map((obligationId) => {
      const separator = obligationId.indexOf('/');
      return {
        obligationId,
        modelRef: null,
        transitionRef: separator >= 0 ? obligationId.slice(separator + 1) : obligationId,
      };
    }),
    tests: shardPlan.selection.selected.map((test) => ({
      identityKey: test.identityKey,
      lane: placements.get(test.identityKey).lane,
      shardId: placements.get(test.identityKey).shardId,
      modelRefs: [],
      obligationRefs: [],
      transitionRefs: [],
      targetRefs: [],
      changedPaths: [],
    })),
    shards: shardPlan.shards.map((shard) => ({
      lane: shard.lane,
      shardId: shard.shardId,
      testCount: shard.identityKeys.length,
      identityKeys: [...shard.identityKeys],
      modelRefs: [],
      obligationRefs: [],
      transitionRefs: [],
      modelCoverage: {},
    })),
  };
  return { ...body, semanticIndexHash: sha256Bytes(canonicalJsonBytes(body)) };
}

function trustedLaneResultsForDiagnostics(manifest, laneResults, laneResultRefs) {
  const expectedShards = new Map(
    manifest.plan.shardPlan.shards.map((shard) => [laneResultKey(shard), shard])
  );
  const trusted = [];
  const infrastructureFailureInputs = [];
  const seen = new Set();
  for (const result of laneResults) {
    const expected = isPlainObject(result) ? expectedShards.get(laneResultKey(result)) : null;
    let issueCode = null;
    const key = isPlainObject(result) ? laneResultKey(result) : '';
    if (!expected) issueCode = 'CI_UNPLANNED_SHARD_RESULT';
    else if (
      typeof result.outcome !== 'string' ||
      !Array.isArray(result.executedIdentityKeys) ||
      !Array.isArray(result.failedIdentityKeys || [])
    ) {
      issueCode = 'CI_LANE_RESULT_INVALID';
    } else if (seen.has(key)) {
      issueCode = 'CI_DUPLICATE_SHARD_RESULT';
      const trustedIndex = trusted.findIndex((candidate) => laneResultKey(candidate) === key);
      if (trustedIndex >= 0) trusted.splice(trustedIndex, 1);
    } else if (
      new Set(result.executedIdentityKeys).size !== result.executedIdentityKeys.length ||
      result.executedIdentityKeys.some((identityKey) => !expected.identityKeys.includes(identityKey)) ||
      new Set(result.failedIdentityKeys || []).size !== (result.failedIdentityKeys || []).length ||
      (result.failedIdentityKeys || []).some(
        (identityKey) => !result.executedIdentityKeys.includes(identityKey)
      )
    ) {
      issueCode = 'CI_LANE_FAILURE_EVIDENCE_INVALID';
    }
    else if (result.commitSha !== manifest.plan.repository.commitSha) {
      issueCode = 'CI_LANE_COMMIT_SHA_MISMATCH';
    } else if (result.planHash !== manifest.planHash) {
      issueCode = 'CI_LANE_PLAN_HASH_MISMATCH';
    } else if (result.packageDescriptorHash !== manifest.plan.packageDescriptorHash) {
      issueCode = 'CI_LANE_PACKAGE_DESCRIPTOR_HASH_MISMATCH';
    } else if (result.tarballSha256 !== manifest.plan.tarballSha256) {
      issueCode = 'CI_LANE_TARBALL_HASH_MISMATCH';
    }
    if (!issueCode) {
      seen.add(key);
      trusted.push(result);
      continue;
    }
    infrastructureFailureInputs.push({
      lane: isPlainObject(result) && result.lane ? result.lane : 'infrastructure',
      shardId: isPlainObject(result) && result.shardId ? result.shardId : 'lane-result',
      outcome: 'invalid_lane_evidence',
      evidenceStatus: { issueCode },
      logRef: laneResultRefs[key] || null,
    });
  }
  return { trusted, infrastructureFailureInputs };
}

function failedManifest(manifest, error) {
  const { validateRunManifest } = require('./write-ci-run-manifest.cjs');
  validateRunManifest(manifest);
  return validateRunManifest({
    ...manifest,
    status: 'failed',
    results: [],
    gates: null,
    failure: {
      issueCode: error.code || error.message || 'CI_EVIDENCE_JOIN_FAILED',
      details: isPlainObject(error.details) ? error.details : {},
    },
  });
}

function finalizeCiEvidenceWithDiagnostics({
  repoRoot = process.cwd(),
  outputDir = '.artifacts/test-portfolio/final',
  manifest,
  laneResults,
  semanticIndex,
  laneResultRefs = {},
  statusSnapshot,
  expectedAttemptId,
  expectedAuthorityHashes,
  ingestionFailureInputs = [],
  finalizationFailure = null,
}) {
  const { finalizeRunManifest, writeRunManifest } = require('./write-ci-run-manifest.cjs');
  let semanticFailure = null;
  let diagnosticSemanticIndex = semanticIndex;
  try {
    validateSemanticIndexManifestBinding(manifest, semanticIndex);
    buildSixModelPlanningDiagnostics({ semanticIndex });
  } catch (error) {
    semanticFailure = error;
    diagnosticSemanticIndex = fallbackSemanticIndex(manifest);
  }
  const laneDiagnostics = trustedLaneResultsForDiagnostics(
    manifest,
    semanticFailure ? [] : laneResults,
    laneResultRefs
  );
  const infrastructureFailureInputs = [
    ...laneDiagnostics.infrastructureFailureInputs,
    ...ingestionFailureInputs,
  ];
  if (semanticFailure) {
    infrastructureFailureInputs.push({
      lane: 'infrastructure',
      shardId: 'semantic-index',
      outcome: 'invalid_semantic_index',
      evidenceStatus: { issueCode: semanticFailure.code || semanticFailure.message },
      logRef: null,
    });
  }
  const diagnostics = buildSixModelCiDiagnostics({
    semanticIndex: diagnosticSemanticIndex,
    laneResults: laneDiagnostics.trusted,
    laneResultRefs,
    infrastructureFailureInputs,
    statusSnapshot,
    expectedAttemptId,
    expectedAuthorityHashes,
  });
  const diagnosticsReceipts = writeSixModelCiDiagnostics({
    repoRoot,
    outputDir,
    report: diagnostics,
  });
  const finalized = semanticFailure || finalizationFailure
    ? failedManifest(manifest, semanticFailure || finalizationFailure)
    : finalizeRunManifest(manifest, { laneResults });
  const manifestReceipt = writeRunManifest({
    repoRoot,
    outputDir,
    manifest: finalized,
  });
  return {
    finalized,
    diagnostics,
    receipts: {
      diagnostics: diagnosticsReceipts,
      manifest: manifestReceipt,
    },
  };
}

function laneResultPaths(root) {
  if (!fs.existsSync(root)) return [];
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

function main(args = process.argv.slice(2), repoRoot = process.cwd()) {
  const options = parseCliArgs(args);
  const { readCanonicalArtifact } = require('./canonical-artifact.cjs');
  let manifest;
  try {
    const manifestArtifact = readCanonicalArtifact({
      repoRoot,
      filePath: path.resolve(repoRoot, options.manifest),
    }).artifact;
    const { validateRunManifest } = require('./write-ci-run-manifest.cjs');
    manifest = validateRunManifest(manifestArtifact);
  } catch (error) {
    const report = buildInfrastructureOnlyDiagnostics({
      outcome: 'invalid_manifest_artifact',
      logRef: options.manifest,
    });
    const receipts = writeSixModelCiDiagnostics({
      repoRoot,
      outputDir: options['output-dir'],
      report,
    });
    process.stdout.write(
      `${JSON.stringify({
        status: 'failed',
        failure: { issueCode: error.code || error.message },
        diagnosticsPath: receipts.json.path,
        diagnosticsSha256: receipts.json.sha256,
        diagnosticsMarkdownPath: receipts.markdown.path,
      })}\n`
    );
    return 1;
  }
  const resultsRoot = path.resolve(repoRoot, options['lane-results-dir']);
  const ingestionFailureInputs = [];
  let finalizationFailure = null;
  let resultPaths = [];
  try {
    resultPaths = laneResultPaths(resultsRoot);
  } catch (error) {
    finalizationFailure = {
      code: 'CI_LANE_RESULT_ARTIFACT_INVALID',
      details: { issueCode: error.code || error.message },
    };
    ingestionFailureInputs.push({
      lane: 'infrastructure',
      shardId: 'lane-result-directory',
      outcome: 'invalid_lane_result_artifact',
      evidenceStatus: { issueCode: error.code || error.message },
      logRef: options['lane-results-dir'],
    });
  }
  const laneResults = [];
  const laneResultRefs = {};
  for (const filePath of resultPaths) {
    const logRef = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    try {
      const artifact = readCanonicalArtifact({ repoRoot, filePath }).artifact;
      laneResults.push(artifact);
      laneResultRefs[laneResultKey(artifact)] = logRef;
    } catch (error) {
      finalizationFailure ||= {
        code: 'CI_LANE_RESULT_ARTIFACT_INVALID',
        details: { logRef, issueCode: error.code || error.message },
      };
      ingestionFailureInputs.push({
        lane: 'infrastructure',
        shardId: 'lane-result',
        outcome: 'invalid_lane_result_artifact',
        evidenceStatus: { issueCode: error.code || error.message },
        logRef,
      });
    }
  }
  let semanticIndex = null;
  try {
    semanticIndex = readCanonicalArtifact({
      repoRoot,
      filePath: path.resolve(repoRoot, options['semantic-index']),
    }).artifact;
  } catch {
    semanticIndex = null;
  }
  let statusSnapshot;
  if (options['status-snapshot']) {
    try {
      statusSnapshot = readCanonicalArtifact({
        repoRoot,
        filePath: path.resolve(repoRoot, options['status-snapshot']),
      }).artifact;
    } catch {
      statusSnapshot = undefined;
    }
  }
  const result = finalizeCiEvidenceWithDiagnostics({
    repoRoot,
    outputDir: options['output-dir'],
    manifest,
    laneResults,
    semanticIndex,
    laneResultRefs,
    statusSnapshot,
    expectedAttemptId: options['expected-attempt-id'],
    expectedAuthorityHashes: options['status-snapshot']
      ? {
          sourceDocumentHash: options['expected-source-document-hash'],
          implementationConfirmationHash:
            options['expected-implementation-confirmation-hash'],
          semanticModelHash: options['expected-semantic-model-hash'],
        }
      : undefined,
    ingestionFailureInputs,
    finalizationFailure,
  });
  process.stdout.write(
    `${JSON.stringify({
      path: result.receipts.manifest.path,
      sha256: result.receipts.manifest.sha256,
      planHash: result.receipts.manifest.planHash,
      status: result.finalized.status,
      failure: result.finalized.failure || null,
      diagnosticsPath: result.receipts.diagnostics.json.path,
      diagnosticsSha256: result.receipts.diagnostics.json.sha256,
      diagnosticsMarkdownPath: result.receipts.diagnostics.markdown.path,
    })}\n`
  );
  return result.finalized.status === 'complete' ? 0 : 1;
}

module.exports = {
  finalizeCiEvidenceWithDiagnostics,
  joinCiEvidence,
  main,
  parseCliArgs,
};

if (require.main === module) {
  process.exitCode = main();
}
