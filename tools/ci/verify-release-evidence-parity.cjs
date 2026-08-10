'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { load } = require('js-yaml');

const { compareText, fail, readCanonicalArtifact } = require('./canonical-artifact.cjs');
const { validateRunManifest } = require('./write-ci-run-manifest.cjs');

const PARITY_FIELDS = Object.freeze([
  'commitSha',
  'catalogHash',
  'policyHash',
  'packageDescriptorHash',
  'tarballSha256',
]);
const PACKAGE_PARITY_FIELDS = Object.freeze([
  'commitSha',
  'packageDescriptorHash',
  'tarballSha256',
]);
const FULL_SUITE_PROFILES = new Set(['nightly-full', 'release-full']);

function canonicalStringArray(value, code) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim() === '') ||
    new Set(value).size !== value.length
  ) {
    fail(code);
  }
  return value.map((entry) => entry.trim()).sort(compareText);
}

function evidenceFromRunManifest(value) {
  validateRunManifest(value);
  return {
    commitSha: value.plan.repository.commitSha,
    catalogHash: value.plan.catalogHash,
    policyHash: value.plan.policyHash,
    packageDescriptorHash: value.plan.packageDescriptorHash,
    profile: value.plan.shardPlan.profile,
    tarballSha256: value.plan.tarballSha256,
    requiredLaneIdentities: value.plan.shardPlan.shards.map(
      (shard) => `${shard.lane}/${shard.shardId}`
    ),
    selectedTestIdentities: value.plan.shardPlan.shards.flatMap((shard) => shard.identityKeys),
  };
}

function normalizeEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('RELEASE_EVIDENCE_INVALID');
  }
  const source =
    value.schemaVersion === 'ci-run-manifest/v1' ? evidenceFromRunManifest(value) : value;
  const normalized = {};
  for (const field of PARITY_FIELDS) {
    const candidate = source[field];
    if (typeof candidate !== 'string' || candidate.trim() === '') {
      fail('RELEASE_EVIDENCE_INVALID', { field });
    }
    normalized[field] = candidate.trim();
  }
  if (typeof source.profile !== 'string' || source.profile.trim() === '') {
    fail('RELEASE_EVIDENCE_INVALID', { field: 'profile' });
  }
  normalized.profile = source.profile.trim();
  normalized.requiredLaneIdentities = canonicalStringArray(
    source.requiredLaneIdentities,
    'RELEASE_EVIDENCE_INVALID'
  );
  normalized.selectedTestIdentities = canonicalStringArray(
    source.selectedTestIdentities,
    'RELEASE_EVIDENCE_INVALID'
  );
  return normalized;
}

function normalizeCatalogEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('RELEASE_CATALOG_EVIDENCE_INVALID');
  }
  if (typeof value.catalogHash !== 'string' || value.catalogHash.trim() === '') {
    fail('RELEASE_CATALOG_EVIDENCE_INVALID');
  }
  return {
    catalogHash: value.catalogHash.trim(),
    testIdentities: canonicalStringArray(value.testIdentities, 'RELEASE_CATALOG_EVIDENCE_INVALID'),
  };
}

function catalogTestIdentities(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.tests)) {
    fail('RELEASE_CATALOG_EVIDENCE_INVALID');
  }
  return canonicalStringArray(
    value.tests.map((test) => test?.executableIdentity),
    'RELEASE_CATALOG_EVIDENCE_INVALID'
  );
}

function normalizePackageEvidence(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('RELEASE_PACKAGE_EVIDENCE_INVALID');
  }
  return Object.fromEntries(
    PACKAGE_PARITY_FIELDS.map((field) => {
      const candidate = value[field];
      if (typeof candidate !== 'string' || candidate.trim() === '') {
        fail('RELEASE_PACKAGE_EVIDENCE_INVALID', { field });
      }
      return [field, candidate.trim()];
    })
  );
}

function verifyReleaseEvidenceParity(
  prEvidence,
  fullSuiteEvidence,
  catalogEvidence,
  packageEvidence
) {
  const expected = normalizeEvidence(prEvidence);
  const actual = normalizeEvidence(fullSuiteEvidence);
  const catalog = normalizeCatalogEvidence(catalogEvidence);
  const preparedPackage = normalizePackageEvidence(packageEvidence);
  for (const field of PARITY_FIELDS) {
    if (field === 'catalogHash') continue;
    if (actual[field] !== expected[field]) {
      fail('RELEASE_EVIDENCE_PARITY_MISMATCH', { field });
    }
  }
  if (catalog.catalogHash !== actual.catalogHash) {
    fail('RELEASE_CATALOG_EVIDENCE_PARITY_MISMATCH', { field: 'catalogHash' });
  }
  if (expected.profile !== 'pr-fast') {
    fail('RELEASE_QUALIFYING_PROFILE_INVALID');
  }
  if (!FULL_SUITE_PROFILES.has(actual.profile)) {
    fail('RELEASE_VERIFICATION_PROFILE_INVALID');
  }
  const releaseIdentities = new Set(actual.selectedTestIdentities);
  const missingPrIdentities = expected.selectedTestIdentities.filter(
    (identity) => !releaseIdentities.has(identity)
  );
  if (missingPrIdentities.length > 0) {
    fail('RELEASE_EVIDENCE_PR_NOT_CONTAINED', {
      missingIdentityCount: missingPrIdentities.length,
    });
  }
  if (
    actual.selectedTestIdentities.length !== catalog.testIdentities.length ||
    actual.selectedTestIdentities.some(
      (identity, index) => identity !== catalog.testIdentities[index]
    )
  ) {
    fail('RELEASE_EVIDENCE_CATALOG_MISMATCH');
  }
  for (const field of PACKAGE_PARITY_FIELDS) {
    if (preparedPackage[field] !== actual[field]) {
      fail('RELEASE_PACKAGE_EVIDENCE_PARITY_MISMATCH', { field });
    }
  }
  return {
    ...Object.fromEntries(
      PARITY_FIELDS.map((field) => [
        field,
        field === 'catalogHash' ? actual[field] : expected[field],
      ])
    ),
    qualifyingProfile: expected.profile,
    qualifyingSelectedCount: expected.selectedTestIdentities.length,
    fullSuiteProfile: actual.profile,
    fullSuiteSelectedCount: actual.selectedTestIdentities.length,
  };
}

function parseWorkflow(source, code) {
  let workflow;
  try {
    workflow = load(source);
  } catch {
    fail(code);
  }
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) fail(code);
  return workflow;
}

function stepText(workflow) {
  return Object.values(workflow.jobs || {})
    .flatMap((job) => (Array.isArray(job?.steps) ? job.steps : []))
    .map((step) => `${step?.uses || ''}\n${step?.run || ''}`)
    .join('\n');
}

function nodeVersions(workflow) {
  return Object.values(workflow.jobs || {})
    .flatMap((job) => (Array.isArray(job?.steps) ? job.steps : []))
    .filter((step) => step?.uses === 'actions/setup-node@v4')
    .map((step) => String(step?.with?.['node-version'] || ''));
}

function releaseParityEvidencePaths(releaseText) {
  const command = releaseText
    .split(/\r?\n/u)
    .find((line) => line.includes('ci:verify-release-parity'));
  if (!command) fail('RELEASE_EVIDENCE_PARITY_REQUIRED');
  const valueFor = (flag) => {
    const match = command.match(new RegExp(`${flag}\\s+(?:"([^"]+)"|'([^']+)'|(\\S+))`, 'u'));
    return match?.[1] || match?.[2] || match?.[3] || null;
  };
  const prEvidencePath = valueFor('--pr-evidence');
  const fullSuiteEvidencePath = valueFor('--full-suite-evidence');
  const catalogPath = valueFor('--catalog');
  const packageDescriptorPath = valueFor('--package-descriptor');
  if (!prEvidencePath || !fullSuiteEvidencePath || !catalogPath || !packageDescriptorPath) {
    fail('RELEASE_EVIDENCE_PARITY_REQUIRED');
  }
  const normalizedPaths = Object.fromEntries(
    Object.entries({
      catalogPath,
      fullSuiteEvidencePath,
      packageDescriptorPath,
      prEvidencePath,
    }).map(([field, value]) => {
      if (/[$`]/u.test(value) || path.posix.isAbsolute(value)) {
        fail('RELEASE_EVIDENCE_PATH_INVALID', { field });
      }
      const normalized = path.posix.normalize(value.replace(/\\/g, '/'));
      if (normalized === '..' || normalized.startsWith('../')) {
        fail('RELEASE_EVIDENCE_PATH_INVALID', { field });
      }
      return [field, normalized];
    })
  );
  if (normalizedPaths.prEvidencePath === normalizedPaths.fullSuiteEvidencePath) {
    fail('RELEASE_EVIDENCE_SELF_COMPARISON');
  }
  return normalizedPaths;
}

function verifyReleaseWorkflowAuthority({ releaseSource, publishSource }) {
  const release = parseWorkflow(releaseSource, 'RELEASE_WORKFLOW_INVALID');
  const publish = parseWorkflow(publishSource, 'PUBLISH_WORKFLOW_INVALID');
  const releaseText = stepText(release);
  const publishJobs = Object.values(publish.jobs || {});
  const reusableCalls = publishJobs.filter(
    (job) => job?.uses === './.github/workflows/release.yml'
  );
  const independentPublishAuthorityCount = publishJobs.length - reusableCalls.length;
  const independentPackAuthorityCount = (releaseText.match(/\bnpm\s+pack\b/gu) || []).length;
  const versions = nodeVersions(release);
  const runtimeMismatchCount = versions.filter((version) => version !== '22.22.1').length;
  const workflowCall = release.on?.workflow_call || release.true?.workflow_call;
  const evidencePaths = releaseParityEvidencePaths(releaseText);
  const serialReleaseFullRunCount = (releaseText.match(/\bnpm\s+run\s+ci:release-full\b/gu) || [])
    .length;
  const packagePreparationRunCount = (
    releaseText.match(
      /\bnpm\s+run\s+ci:prepare-package\s+--\s+--commit-sha\s+"\$CI_COMMIT_SHA"/gu
    ) || []
  ).length;
  const fallback = release.jobs?.['release-full-fallback'];
  const releaseJob = release.jobs?.release;
  const releaseFullFallbackCount =
    fallback?.uses === './.github/workflows/ci.yml' &&
    fallback?.if === "${{ inputs.full_suite_run_id == '' }}" &&
    fallback?.with?.requested_profile === 'release-full' &&
    fallback?.with?.commit_sha === '${{ inputs.commit_sha }}'
      ? 1
      : 0;
  const releaseCancellationGuardCount =
    typeof releaseJob?.if === 'string' &&
    releaseJob.if.includes('!cancelled()') &&
    !releaseJob.if.includes('always()')
      ? 1
      : 0;
  const fullSuiteRunProvenanceCheckCount = (releaseJob?.steps || []).filter((step) => {
    const script = String(step?.with?.script || '');
    return (
      step?.uses === 'actions/github-script@v7' &&
      step?.if === "${{ inputs.full_suite_run_id != '' }}" &&
      script.includes('getWorkflowRun') &&
      script.includes("run.conclusion !== 'success'") &&
      script.includes('run.head_sha') &&
      script.includes('getWorkflow') &&
      script.includes("workflow.path !== '.github/workflows/ci.yml'")
    );
  }).length;

  if (!workflowCall) fail('RELEASE_WORKFLOW_CALL_REQUIRED');
  if (independentPublishAuthorityCount > 0) fail('CI_INDEPENDENT_PUBLISH_AUTHORITY');
  if (independentPackAuthorityCount > 0) fail('CI_SECOND_PACKAGE_AUTHORITY');
  if (runtimeMismatchCount > 0 || versions.length === 0) fail('RELEASE_RUNTIME_MISMATCH');
  if (
    releaseFullFallbackCount !== 1 ||
    releaseCancellationGuardCount !== 1 ||
    fullSuiteRunProvenanceCheckCount !== 1 ||
    serialReleaseFullRunCount !== 0 ||
    packagePreparationRunCount !== 1 ||
    evidencePaths.prEvidencePath !== '.artifacts/qualifying/final/ci-run-manifest.json' ||
    evidencePaths.fullSuiteEvidencePath !==
      '.artifacts/test-portfolio/full-suite/final/ci-run-manifest.json' ||
    evidencePaths.catalogPath !== '.artifacts/test-portfolio/full-suite/plan/test-catalog.json' ||
    evidencePaths.packageDescriptorPath !==
      '.artifacts/test-portfolio/package/canonical-package.json'
  ) {
    fail('RELEASE_VERIFICATION_RUN_REQUIRED');
  }
  return {
    independentPublishAuthorityCount,
    independentPackAuthorityCount,
    releaseFullFallbackCount,
    releaseCancellationGuardCount,
    fullSuiteRunProvenanceCheckCount,
    serialReleaseFullRunCount,
    packagePreparationRunCount,
    runtimeMismatchCount,
    evidencePathDistinct: evidencePaths.prEvidencePath !== evidencePaths.fullSuiteEvidencePath,
  };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      !['--pr-evidence', '--full-suite-evidence', '--catalog', '--package-descriptor'].includes(
        flag
      ) ||
      !value
    ) {
      fail('RELEASE_PARITY_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  if (
    !options['pr-evidence'] ||
    !options['full-suite-evidence'] ||
    !options.catalog ||
    !options['package-descriptor']
  ) {
    fail('RELEASE_PARITY_ARGS_INVALID');
  }
  return options;
}

function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const prEvidence = JSON.parse(fs.readFileSync(path.resolve(options['pr-evidence']), 'utf8'));
  const fullSuiteEvidence = JSON.parse(
    fs.readFileSync(path.resolve(options['full-suite-evidence']), 'utf8')
  );
  if (prEvidence?.schemaVersion !== 'ci-run-manifest/v1') {
    fail('RELEASE_QUALIFYING_MANIFEST_REQUIRED');
  }
  if (prEvidence.status !== 'complete') {
    fail('RELEASE_QUALIFYING_EVIDENCE_INCOMPLETE');
  }
  if (fullSuiteEvidence?.schemaVersion !== 'ci-run-manifest/v1') {
    fail('RELEASE_VERIFICATION_MANIFEST_REQUIRED');
  }
  if (fullSuiteEvidence.status !== 'complete') {
    fail('RELEASE_VERIFICATION_EVIDENCE_INCOMPLETE');
  }
  const catalogReceipt = readCanonicalArtifact({
    repoRoot: process.cwd(),
    filePath: path.resolve(options.catalog),
  });
  const packageReceipt = readCanonicalArtifact({
    repoRoot: process.cwd(),
    filePath: path.resolve(options['package-descriptor']),
  });
  const result = verifyReleaseEvidenceParity(
    prEvidence,
    fullSuiteEvidence,
    {
      catalogHash: catalogReceipt.sha256,
      testIdentities: catalogTestIdentities(catalogReceipt.artifact),
    },
    {
      commitSha: packageReceipt.artifact.commitSha,
      packageDescriptorHash: packageReceipt.sha256,
      tarballSha256: packageReceipt.artifact.tarballSha256,
    }
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  catalogTestIdentities,
  evidenceFromRunManifest,
  main,
  verifyReleaseEvidenceParity,
  verifyReleaseWorkflowAuthority,
};
