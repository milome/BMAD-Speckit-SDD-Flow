'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const {
  compareText,
  fail,
  readCanonicalArtifact,
  writeCanonicalArtifact,
} = require('./canonical-artifact.cjs');
const { buildShardPlan, validateShardPlan } = require('./build-shard-plan.cjs');
const { validatePackageDescriptor } = require('./prepare-package-artifact.cjs');
const { validateTimingSummary } = require('./summarize-test-timings.cjs');
const { readTestPolicy } = require('./test-policy.cjs');

const COMPLETE_GATE_FIELDS = Object.freeze([
  'missingShardCount',
  'omittedIdentityCount',
  'duplicateExecutionCount',
  'unplannedExecutionCount',
  'requiredCoreIdentityMissingCount',
]);
const MANIFEST_BASE_FIELDS = Object.freeze([
  'schemaVersion',
  'status',
  'planHash',
  'plan',
  'matrix',
  'results',
  'gates',
]);
const MANIFEST_STATE_ERRORS = Object.freeze({
  planned: 'CI_MANIFEST_PLANNED_STATE_INVALID',
  complete: 'CI_MANIFEST_COMPLETE_STATE_INVALID',
  failed: 'CI_MANIFEST_FAILED_STATE_INVALID',
});

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireNonEmptyString(value, code) {
  if (typeof value !== 'string' || value.trim() === '') fail(code);
  return value.trim();
}

function requireHash(value, code) {
  const hash = requireNonEmptyString(value, code);
  if (!/^sha256:[0-9a-f]{64}$/u.test(hash)) fail(code);
  return hash;
}

function requireDenseArray(value, code, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) fail(code);
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) fail(code);
  }
  return value;
}

function validateManifestTopLevelKeys(manifest) {
  const expected =
    manifest.status === 'failed' ? [...MANIFEST_BASE_FIELDS, 'failure'] : [...MANIFEST_BASE_FIELDS];
  const actual = Object.keys(manifest).sort(compareText);
  expected.sort(compareText);
  if (
    actual.length !== expected.length ||
    actual.some((field, index) => field !== expected[index])
  ) {
    fail(MANIFEST_STATE_ERRORS[manifest.status]);
  }
}

function validateManifestTimingAuthority(plan) {
  const binding = plan.shardPlan.timingBinding;
  if (binding.expectedCommitSha !== plan.repository.commitSha) {
    fail('CI_MANIFEST_TIMING_COMMIT_MISMATCH');
  }
  if (plan.shardPlan.gates.staleTimingUsedWithoutFallbackCount !== 0) {
    fail('CI_MANIFEST_TIMING_AUTHORITY_INVALID');
  }

  const hasObservation =
    binding.observedCommitSha !== null ||
    binding.observedEnvironmentClass !== null ||
    binding.observedAt !== null ||
    binding.provenance !== null ||
    binding.artifactHashes.length > 0;
  const hasCompleteObservation =
    binding.observedCommitSha !== null &&
    binding.observedEnvironmentClass !== null &&
    binding.observedAt !== null &&
    binding.provenance === 'runner_observed';
  if (hasObservation !== hasCompleteObservation) {
    fail('CI_MANIFEST_TIMING_AUTHORITY_INVALID');
  }

  const reasonCodes = binding.fallbackReasonCodes;
  if (binding.status === 'fresh') {
    if (
      !hasCompleteObservation ||
      binding.observedCommitSha !== binding.expectedCommitSha ||
      binding.observedEnvironmentClass !== binding.expectedEnvironmentClass ||
      reasonCodes.length !== 0
    ) {
      fail('CI_MANIFEST_TIMING_AUTHORITY_INVALID');
    }
    return;
  }

  if (binding.status === 'fallback') {
    const isBootstrapFallback =
      !hasObservation &&
      reasonCodes.length === 1 &&
      reasonCodes[0] === 'TIMING_SUMMARY_EMPTY';
    const isIdentityFallback =
      hasCompleteObservation &&
      binding.observedCommitSha === binding.expectedCommitSha &&
      binding.observedEnvironmentClass === binding.expectedEnvironmentClass &&
      reasonCodes.length === 1 &&
      reasonCodes[0] === 'TIMING_IDENTITY_NOT_OBSERVED';
    if (!isBootstrapFallback && !isIdentityFallback) {
      fail('CI_MANIFEST_TIMING_AUTHORITY_INVALID');
    }
    return;
  }

  const isCommitOrProvenanceStale =
    !hasObservation &&
    reasonCodes.length === 1 &&
    ['TIMING_COMMIT_MISMATCH', 'TIMING_PROVENANCE_MISSING'].includes(reasonCodes[0]);
  const isEnvironmentStale =
    hasCompleteObservation &&
    binding.observedCommitSha === binding.expectedCommitSha &&
    binding.observedEnvironmentClass !== binding.expectedEnvironmentClass &&
    reasonCodes.length === 1 &&
    reasonCodes[0] === 'TIMING_ENVIRONMENT_MISMATCH';
  if (!isCommitOrProvenanceStale && !isEnvironmentStale) {
    fail('CI_MANIFEST_TIMING_AUTHORITY_INVALID');
  }
}

function normalizePlanBase(input) {
  if (!isPlainObject(input)) fail('CI_MANIFEST_INPUT_INVALID');
  if (!isPlainObject(input.repository)) fail('CI_MANIFEST_REPOSITORY_INVALID');
  const commitSha = requireNonEmptyString(
    input.repository.commitSha,
    'CI_MANIFEST_COMMIT_SHA_INVALID'
  ).toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(commitSha)) fail('CI_MANIFEST_COMMIT_SHA_INVALID');
  if (typeof input.repository.dirty !== 'boolean') fail('CI_MANIFEST_DIRTY_STATE_INVALID');
  const shardPlan = validateShardPlan(input.shardPlan);
  const selectionHash = requireHash(input.selectionHash, 'CI_MANIFEST_SELECTION_HASH_INVALID');
  if (selectionHash !== shardPlan.selectionHash) {
    fail('CI_MANIFEST_SELECTION_HASH_MISMATCH');
  }

  const plan = {
    repository: {
      commitSha,
      dirty: input.repository.dirty,
    },
    catalogHash: requireHash(input.catalogHash, 'CI_MANIFEST_CATALOG_HASH_INVALID'),
    semanticIndexHash: requireHash(
      input.semanticIndexHash,
      'CI_MANIFEST_SEMANTIC_INDEX_HASH_INVALID'
    ),
    packageDescriptorHash: requireHash(
      input.packageDescriptorHash,
      'CI_MANIFEST_PACKAGE_DESCRIPTOR_HASH_INVALID'
    ),
    tarballSha256: requireHash(input.tarballSha256, 'CI_MANIFEST_TARBALL_HASH_INVALID'),
    selectionHash,
    shardPlan: structuredClone(shardPlan),
  };
  validateManifestTimingAuthority(plan);
  return plan;
}

function normalizeAuthorityPlanInput(input) {
  const base = normalizePlanBase(input);
  const timingSummary = structuredClone(validateTimingSummary(input.timingSummary));
  if (!isPlainObject(input.policy)) fail('CI_MANIFEST_POLICY_INVALID');
  const policy = structuredClone(input.policy);
  const policyHash = requireHash(input.policyHash, 'CI_MANIFEST_POLICY_HASH_INVALID');
  if (policyHash !== sha256Bytes(canonicalJsonBytes(policy))) {
    fail('CI_MANIFEST_POLICY_HASH_MISMATCH');
  }
  const expectedShardPlan = buildShardPlan({
    selection: base.shardPlan.selection,
    timingSummary,
    policy,
    expectedCommitSha: base.shardPlan.timingBinding?.expectedCommitSha,
    expectedEnvironmentClass: base.shardPlan.timingBinding?.expectedEnvironmentClass,
  });
  if (!canonicalJsonBytes(expectedShardPlan).equals(canonicalJsonBytes(base.shardPlan))) {
    fail('SHARD_PLAN_DERIVATION_MISMATCH');
  }

  return {
    ...base,
    timingSnapshotHash: timingSummary.timingSnapshotHash,
    policyHash,
  };
}

function expectedMatrix(plan) {
  return plan.shardPlan.shards.map(({ lane, shardId }) => ({ lane, shardId }));
}

function createRunManifestPlan(input) {
  const plan = normalizeAuthorityPlanInput(input);
  return {
    schemaVersion: 'ci-run-manifest/v1',
    status: 'planned',
    planHash: sha256Bytes(canonicalJsonBytes(plan)),
    plan,
    matrix: expectedMatrix(plan),
    results: [],
    gates: null,
  };
}

function validateMatrix(matrix, plan) {
  for (const row of requireDenseArray(matrix, 'CI_MANIFEST_MATRIX_INVALID')) {
    if (
      !isPlainObject(row) ||
      Object.keys(row).sort(compareText).join('\0') !== 'lane\0shardId' ||
      typeof row.lane !== 'string' ||
      typeof row.shardId !== 'string'
    ) {
      fail('CI_MANIFEST_MATRIX_INVALID');
    }
  }
  if (!canonicalJsonBytes(matrix).equals(canonicalJsonBytes(expectedMatrix(plan)))) {
    fail('CI_MANIFEST_MATRIX_INVALID');
  }
}

function validateCompleteGates(gates) {
  if (!isPlainObject(gates)) fail('CI_MANIFEST_GATES_INVALID');
  const keys = Object.keys(gates).sort(compareText);
  if (keys.join('\0') !== [...COMPLETE_GATE_FIELDS].sort(compareText).join('\0')) {
    fail('CI_MANIFEST_GATES_INVALID');
  }
  for (const field of COMPLETE_GATE_FIELDS) {
    if (!Number.isSafeInteger(gates[field]) || gates[field] !== 0) {
      fail('CI_MANIFEST_GATES_INVALID', { field });
    }
  }
}

function validateRunManifest(manifest) {
  if (!isPlainObject(manifest) || manifest.schemaVersion !== 'ci-run-manifest/v1') {
    fail('CI_MANIFEST_INVALID');
  }
  if (!Object.prototype.hasOwnProperty.call(MANIFEST_STATE_ERRORS, manifest.status)) {
    fail('CI_MANIFEST_STATUS_INVALID');
  }
  validateManifestTopLevelKeys(manifest);
  const normalizedPlanBase = normalizePlanBase(manifest.plan);
  const timingSnapshotHash = requireHash(
    manifest.plan.timingSnapshotHash,
    'CI_MANIFEST_TIMING_SNAPSHOT_HASH_INVALID'
  );
  if (timingSnapshotHash !== normalizedPlanBase.shardPlan.timingSnapshotHash) {
    fail('CI_MANIFEST_TIMING_SNAPSHOT_HASH_MISMATCH');
  }
  const normalizedPlan = {
    ...normalizedPlanBase,
    timingSnapshotHash,
    policyHash: requireHash(manifest.plan.policyHash, 'CI_MANIFEST_POLICY_HASH_INVALID'),
  };
  if (!canonicalJsonBytes(normalizedPlan).equals(canonicalJsonBytes(manifest.plan))) {
    fail('CI_MANIFEST_PLAN_NOT_CANONICAL');
  }
  const expectedPlanHash = sha256Bytes(canonicalJsonBytes(manifest.plan));
  if (manifest.planHash !== expectedPlanHash) fail('CI_MANIFEST_PLAN_HASH_MISMATCH');
  validateMatrix(manifest.matrix, manifest.plan);
  requireDenseArray(manifest.results, 'CI_MANIFEST_RESULTS_INVALID');

  if (manifest.status === 'planned') {
    if (manifest.results.length !== 0 || manifest.gates !== null || 'failure' in manifest) {
      fail('CI_MANIFEST_PLANNED_STATE_INVALID');
    }
  } else if (manifest.status === 'complete') {
    validateCompleteGates(manifest.gates);
    if ('failure' in manifest) fail('CI_MANIFEST_COMPLETE_STATE_INVALID');
    const { joinCiEvidence } = require('./join-ci-evidence.cjs');
    const joined = joinCiEvidence({
      manifest: {
        ...manifest,
        status: 'planned',
        results: [],
        gates: null,
      },
      laneResults: manifest.results,
    });
    if (
      !canonicalJsonBytes(joined.laneResults).equals(canonicalJsonBytes(manifest.results)) ||
      !canonicalJsonBytes(joined.gates).equals(canonicalJsonBytes(manifest.gates))
    ) {
      fail('CI_MANIFEST_COMPLETE_EVIDENCE_INVALID');
    }
  } else {
    if (manifest.gates !== null || !isPlainObject(manifest.failure)) {
      fail('CI_MANIFEST_FAILED_STATE_INVALID');
    }
    requireNonEmptyString(manifest.failure.issueCode, 'CI_MANIFEST_FAILURE_CODE_INVALID');
  }
  return manifest;
}

function finalizeRunManifest(manifest, { laneResults } = {}) {
  validateRunManifest(manifest);
  if (manifest.status !== 'planned') fail('CI_MANIFEST_ALREADY_FINALIZED');
  try {
    const { joinCiEvidence } = require('./join-ci-evidence.cjs');
    const joined = joinCiEvidence({ manifest, laneResults });
    return validateRunManifest({
      ...manifest,
      status: 'complete',
      results: joined.laneResults,
      gates: joined.gates,
    });
  } catch (error) {
    const issueCode =
      typeof error?.code === 'string' && error.code
        ? error.code
        : typeof error?.message === 'string' && error.message
          ? error.message
          : 'CI_EVIDENCE_JOIN_FAILED';
    return validateRunManifest({
      ...manifest,
      status: 'failed',
      results: [],
      gates: null,
      failure: {
        issueCode,
        details: isPlainObject(error?.details) ? error.details : {},
      },
    });
  }
}

function writeRunManifest({
  repoRoot = process.cwd(),
  outputDir = '.artifacts/test-portfolio',
  manifest,
}) {
  validateRunManifest(manifest);
  const receipt = writeCanonicalArtifact({
    repoRoot,
    outputDir,
    fileName: 'ci-run-manifest.json',
    artifact: manifest,
  });
  return {
    ...receipt,
    status: manifest.status,
    planHash: manifest.planHash,
  };
}

function parseCliArgs(args) {
  const options = {
    outputDir: '.artifacts/test-portfolio',
    policy: 'repo-governance/ci/test-policy.json',
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      ![
        '--catalog',
        '--selection',
        '--shard-plan',
        '--timing-summary',
        '--policy',
        '--semantic-index',
        '--package-descriptor',
        '--commit-sha',
        '--output-dir',
      ].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CI_MANIFEST_CLI_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  for (const required of [
    'catalog',
    'selection',
    'shard-plan',
    'timing-summary',
    'semantic-index',
    'package-descriptor',
  ]) {
    if (!options[required]) fail('CI_MANIFEST_CLI_ARGS_INVALID', { required });
  }
  return options;
}

function currentCommitSha(repoRoot, explicitCommitSha) {
  const value =
    explicitCommitSha ||
    process.env.CI_COMMIT_SHA ||
    execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  if (!/^[0-9a-f]{40}$/iu.test(value)) fail('CI_MANIFEST_COMMIT_SHA_INVALID');
  return value.toLowerCase();
}

function assertCleanRepository(repoRoot) {
  const status = execFileSync(
    'git',
    ['status', '--porcelain', '--untracked-files=no', '--', ':!.artifacts'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  ).trim();
  if (status !== '') fail('CI_MANIFEST_REPOSITORY_DIRTY');
}

function appendGitHubOutputs(manifest, manifestPath) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  fs.appendFileSync(
    outputPath,
    [
      `matrix=${JSON.stringify({ include: manifest.matrix })}`,
      `manifest_path=${manifestPath.replace(/\\/g, '/')}`,
      `plan_hash=${manifest.planHash}`,
      '',
    ].join('\n'),
    'utf8'
  );
}

function main(args = process.argv.slice(2)) {
  const options = parseCliArgs(args);
  const repoRoot = process.cwd();
  assertCleanRepository(repoRoot);
  const catalogReceipt = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options.catalog),
  });
  const selectionReceipt = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options.selection),
  });
  const shardPlan = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options['shard-plan']),
  }).artifact;
  const semanticIndex = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options['semantic-index']),
  }).artifact;
  const { buildSixModelPlanningDiagnostics } = require('./build-six-model-ci-diagnostics.cjs');
  buildSixModelPlanningDiagnostics({ semanticIndex });
  const timingSummary = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options['timing-summary']),
  }).artifact;
  const descriptorPath = path.resolve(repoRoot, options['package-descriptor']);
  const descriptorReceipt = readCanonicalArtifact({ repoRoot, filePath: descriptorPath });
  validatePackageDescriptor({
    repoRoot,
    descriptor: descriptorReceipt.artifact,
    descriptorPath,
    expectedCommitSha: currentCommitSha(repoRoot, options['commit-sha']),
  });
  const policy = readTestPolicy(repoRoot, options.policy);
  const manifest = createRunManifestPlan({
    repository: {
      commitSha: descriptorReceipt.artifact.commitSha,
      dirty: false,
    },
    catalogHash: catalogReceipt.sha256,
    semanticIndexHash: semanticIndex.semanticIndexHash,
    packageDescriptorHash: descriptorReceipt.sha256,
    tarballSha256: descriptorReceipt.artifact.tarballSha256,
    selectionHash: selectionReceipt.sha256,
    shardPlan,
    timingSummary,
    policy,
    policyHash: sha256Bytes(canonicalJsonBytes(policy)),
  });
  const receipt = writeRunManifest({
    repoRoot,
    outputDir: options['output-dir'],
    manifest,
  });
  appendGitHubOutputs(manifest, receipt.path);
  process.stdout.write(
    `${JSON.stringify({
      path: receipt.path,
      sha256: receipt.sha256,
      planHash: receipt.planHash,
      matrix: manifest.matrix,
    })}\n`
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  createRunManifestPlan,
  finalizeRunManifest,
  main,
  parseCliArgs,
  validateRunManifest,
  writeRunManifest,
};
