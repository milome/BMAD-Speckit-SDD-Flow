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

function verifyReleaseEvidenceParity(prEvidence, releaseEvidence, catalogEvidence) {
  const expected = normalizeEvidence(prEvidence);
  const actual = normalizeEvidence(releaseEvidence);
  const catalog = normalizeCatalogEvidence(catalogEvidence);
  for (const field of PARITY_FIELDS) {
    if (actual[field] !== expected[field]) {
      fail('RELEASE_EVIDENCE_PARITY_MISMATCH', { field });
    }
  }
  if (catalog.catalogHash !== expected.catalogHash) {
    fail('RELEASE_EVIDENCE_PARITY_MISMATCH', { field: 'catalogHash' });
  }
  if (expected.profile !== 'pr-fast') {
    fail('RELEASE_QUALIFYING_PROFILE_INVALID');
  }
  if (actual.profile !== 'release-full') {
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
  return {
    ...Object.fromEntries(PARITY_FIELDS.map((field) => [field, expected[field]])),
    qualifyingProfile: expected.profile,
    qualifyingSelectedCount: expected.selectedTestIdentities.length,
    releaseProfile: actual.profile,
    releaseSelectedCount: actual.selectedTestIdentities.length,
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
  const releaseEvidencePath = valueFor('--release-evidence');
  const catalogPath = valueFor('--catalog');
  if (!prEvidencePath || !releaseEvidencePath || !catalogPath) {
    fail('RELEASE_EVIDENCE_PARITY_REQUIRED');
  }
  if (
    /[$`]/u.test(prEvidencePath) ||
    /[$`]/u.test(releaseEvidencePath) ||
    /[$`]/u.test(catalogPath) ||
    path.posix.isAbsolute(prEvidencePath) ||
    path.posix.isAbsolute(releaseEvidencePath) ||
    path.posix.isAbsolute(catalogPath)
  ) {
    fail('RELEASE_EVIDENCE_PATH_INVALID');
  }
  const normalizedPrPath = path.posix.normalize(prEvidencePath.replace(/\\/g, '/'));
  const normalizedReleasePath = path.posix.normalize(releaseEvidencePath.replace(/\\/g, '/'));
  const normalizedCatalogPath = path.posix.normalize(catalogPath.replace(/\\/g, '/'));
  if (
    normalizedPrPath === '..' ||
    normalizedPrPath.startsWith('../') ||
    normalizedReleasePath === '..' ||
    normalizedReleasePath.startsWith('../') ||
    normalizedCatalogPath === '..' ||
    normalizedCatalogPath.startsWith('../')
  ) {
    fail('RELEASE_EVIDENCE_PATH_INVALID');
  }
  if (normalizedPrPath === normalizedReleasePath) {
    fail('RELEASE_EVIDENCE_SELF_COMPARISON');
  }
  return {
    catalogPath: normalizedCatalogPath,
    prEvidencePath: normalizedPrPath,
    releaseEvidencePath: normalizedReleasePath,
  };
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
  const releaseVerificationRunCount = (
    releaseText.match(
      /\bnpm\s+run\s+ci:release-full\s+--\s+--commit-sha\s+"\$CI_COMMIT_SHA"\s+--changed-paths\s+\.artifacts\/qualifying\/plan\/changed-paths\.json\b/gu
    ) || []
  ).length;

  if (!workflowCall) fail('RELEASE_WORKFLOW_CALL_REQUIRED');
  if (independentPublishAuthorityCount > 0) fail('CI_INDEPENDENT_PUBLISH_AUTHORITY');
  if (independentPackAuthorityCount > 0) fail('CI_SECOND_PACKAGE_AUTHORITY');
  if (runtimeMismatchCount > 0 || versions.length === 0) fail('RELEASE_RUNTIME_MISMATCH');
  if (
    releaseVerificationRunCount !== 1 ||
    evidencePaths.prEvidencePath !== '.artifacts/qualifying/final/ci-run-manifest.json' ||
    evidencePaths.releaseEvidencePath !== '.artifacts/test-portfolio/final/ci-run-manifest.json' ||
    evidencePaths.catalogPath !== '.artifacts/test-portfolio/test-catalog.json'
  ) {
    fail('RELEASE_VERIFICATION_RUN_REQUIRED');
  }
  return {
    independentPublishAuthorityCount,
    independentPackAuthorityCount,
    releaseVerificationRunCount,
    runtimeMismatchCount,
    evidencePathDistinct: evidencePaths.prEvidencePath !== evidencePaths.releaseEvidencePath,
  };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!['--pr-evidence', '--release-evidence', '--catalog'].includes(flag) || !value) {
      fail('RELEASE_PARITY_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  if (!options['pr-evidence'] || !options['release-evidence'] || !options.catalog) {
    fail('RELEASE_PARITY_ARGS_INVALID');
  }
  return options;
}

function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const prEvidence = JSON.parse(fs.readFileSync(path.resolve(options['pr-evidence']), 'utf8'));
  const releaseEvidence = JSON.parse(
    fs.readFileSync(path.resolve(options['release-evidence']), 'utf8')
  );
  if (prEvidence?.schemaVersion !== 'ci-run-manifest/v1') {
    fail('RELEASE_QUALIFYING_MANIFEST_REQUIRED');
  }
  if (prEvidence.status !== 'complete') {
    fail('RELEASE_QUALIFYING_EVIDENCE_INCOMPLETE');
  }
  if (releaseEvidence?.schemaVersion !== 'ci-run-manifest/v1') {
    fail('RELEASE_VERIFICATION_MANIFEST_REQUIRED');
  }
  if (releaseEvidence.status !== 'complete') {
    fail('RELEASE_VERIFICATION_EVIDENCE_INCOMPLETE');
  }
  const catalogReceipt = readCanonicalArtifact({
    repoRoot: process.cwd(),
    filePath: path.resolve(options.catalog),
  });
  const result = verifyReleaseEvidenceParity(prEvidence, releaseEvidence, {
    catalogHash: catalogReceipt.sha256,
    testIdentities: catalogReceipt.artifact.tests.map((test) => test.identityKey),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  evidenceFromRunManifest,
  main,
  verifyReleaseEvidenceParity,
  verifyReleaseWorkflowAuthority,
};
