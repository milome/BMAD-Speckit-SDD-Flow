'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const { compareText, fail, readCanonicalArtifact } = require('./canonical-artifact.cjs');
const {
  REVIEW_PROFILE_VERSION,
  reviewAmbiguousCandidatesOnce,
} = require('./review-ambiguous-test-candidates.cjs');
const { createCodexLocalReviewInvoker } = require('./invoke-local-test-deletion-review.cjs');

const REQUIRED_VALIDATION_KINDS = Object.freeze([
  'affected_tests',
  'binding_gates',
  'catalog_reconciliation',
  'count',
]);
const CANDIDATE_SET_FIELDS = Object.freeze({
  deterministic: 'candidates',
  'local-review': 'localReviewCandidates',
});
const DEFAULT_MAX_BATCH_SIZE = 50;
const MAX_AUTHORITY_FILE_BYTES = 8 * 1024 * 1024;
const MAX_AUTHORITY_SCAN_BYTES = 32 * 1024 * 1024;
const AUTHORITY_ROOTS = Object.freeze([
  '.github/actions',
  '.github/workflows',
  '_bmad',
  'bin',
  'packages',
  'repo-governance/ci',
  'scripts',
  'src',
  'templates',
  'tools',
  'package.json',
  'vitest.config.ts',
  'vitest.consumer-install.config.ts',
  'vitest.long-run.config.ts',
  'vitest.parallel-safe.config.ts',
  'vitest.repo-mutating.config.ts',
]);
const AUTHORITY_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.json',
  '.mjs',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value, code) {
  if (typeof value !== 'string' || value.trim() === '') fail(code);
  return value.trim();
}

function stableUnique(values) {
  return [...new Set(values)].sort(compareText);
}

function sortCanonical(values) {
  return [...values].sort((left, right) =>
    compareText(
      canonicalJsonBytes(left).toString('utf8'),
      canonicalJsonBytes(right).toString('utf8')
    )
  );
}

function catalogProvenance(catalog) {
  if (!isPlainObject(catalog) || !Array.isArray(catalog.tests)) {
    fail('TEST_DELETION_CATALOG_INVALID');
  }
  return {
    ...catalog,
    tests: sortCanonical(
      catalog.tests.map((test) => {
        if (!isPlainObject(test)) fail('TEST_DELETION_CATALOG_INVALID');
        return {
          ...test,
          capabilityRefs: stableUnique(test.capabilityRefs || []),
          failureModeRefs: stableUnique(test.failureModeRefs || []),
          traceRefs: stableUnique(test.traceRefs || []),
          featureRefs: stableUnique(test.featureRefs || []),
          targetRefs: stableUnique(test.targetRefs || []),
          evidenceRefs: stableUnique(test.evidenceRefs || []),
        };
      })
    ),
  };
}

function impactProvenance(impact) {
  if (
    !isPlainObject(impact) ||
    !Array.isArray(impact.changedTestIdentityKeys) ||
    !Array.isArray(impact.pathBindings)
  ) {
    fail('TEST_DELETION_IMPACT_INVALID');
  }
  return {
    ...impact,
    changedTestIdentityKeys: stableUnique(impact.changedTestIdentityKeys),
    pathBindings: sortCanonical(
      impact.pathBindings.map((binding) => {
        if (!isPlainObject(binding)) fail('TEST_DELETION_IMPACT_INVALID');
        return {
          ...binding,
          testIdentityRefs: stableUnique(binding.testIdentityRefs || []),
        };
      })
    ),
  };
}

function coreSelectedIdentities(coreFreeze) {
  if (
    !isPlainObject(coreFreeze) ||
    coreFreeze.schemaVersion !== 'test-portfolio-core-freeze/v2' ||
    !Array.isArray(coreFreeze.selected) ||
    !Array.isArray(coreFreeze.coverage)
  ) {
    fail('TEST_DELETION_CORE_FREEZE_INVALID');
  }
  return new Set(
    coreFreeze.selected.map((entry) =>
      nonEmptyString(entry?.identityKey, 'TEST_DELETION_CORE_FREEZE_INVALID')
    )
  );
}

function impactedIdentities(impact) {
  const normalized = impactProvenance(impact);
  const identities = new Set(normalized.changedTestIdentityKeys);
  for (const binding of normalized.pathBindings) {
    for (const identityKey of binding.testIdentityRefs) identities.add(identityKey);
  }
  return identities;
}

function uniqueObligationProviders(coreFreeze) {
  coreSelectedIdentities(coreFreeze);
  const providers = new Set();
  for (const coverage of coreFreeze.coverage) {
    if (!isPlainObject(coverage) || !Array.isArray(coverage.evidenceDiagnostics)) {
      fail('TEST_DELETION_CORE_FREEZE_INVALID');
    }
    const eligible = stableUnique(
      coverage.evidenceDiagnostics
        .filter((diagnostic) => {
          if (!isPlainObject(diagnostic)) fail('TEST_DELETION_CORE_FREEZE_INVALID');
          return diagnostic.eligibleForCoverage === true;
        })
        .map((diagnostic) =>
          nonEmptyString(diagnostic.identityKey, 'TEST_DELETION_CORE_FREEZE_INVALID')
        )
    );
    if (eligible.length === 1) providers.add(eligible[0]);
  }
  return providers;
}

function repositoryPath(repoRoot, filePath, code) {
  const relative = path.relative(path.resolve(repoRoot), path.resolve(filePath));
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`)) fail(code);
  return relative.replaceAll('\\', '/');
}

function sha256Value(value, code) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/u.test(value)) fail(code);
  return value;
}

function selectCandidateSet(payload, candidateSet) {
  const selectedSet =
    typeof candidateSet === 'string' && candidateSet.trim() !== '' ? candidateSet.trim() : null;
  if (Array.isArray(payload)) {
    if (selectedSet && selectedSet !== 'deterministic') {
      fail('TEST_DELETION_CANDIDATE_SET_UNKNOWN');
    }
    if (payload.length === 0) fail('TEST_DELETION_CANDIDATE_SET_EMPTY');
    return payload;
  }
  if (!isPlainObject(payload)) fail('TEST_DELETION_CANDIDATES_INVALID');
  if (payload.schemaVersion === 'test-deletion-candidates/v1' && !selectedSet) {
    fail('TEST_DELETION_CANDIDATE_SET_REQUIRED');
  }
  const effectiveSet = selectedSet || 'deterministic';
  const field = CANDIDATE_SET_FIELDS[effectiveSet];
  if (!field) fail('TEST_DELETION_CANDIDATE_SET_UNKNOWN');
  const candidates = payload[field];
  if (!Array.isArray(candidates)) fail('TEST_DELETION_CANDIDATE_SET_INVALID');
  if (candidates.length === 0) fail('TEST_DELETION_CANDIDATE_SET_EMPTY');
  return candidates;
}

function stringArray(value, code) {
  if (!Array.isArray(value)) fail(code);
  for (let index = 0; index < value.length; index += 1) {
    if (
      !Object.prototype.hasOwnProperty.call(value, index) ||
      typeof value[index] !== 'string' ||
      value[index].trim() === ''
    ) {
      fail(code);
    }
  }
  const normalized = value.map((entry) => entry.trim());
  if (new Set(normalized).size !== normalized.length) fail(code);
  return normalized.sort(compareText);
}

function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) fail('TEST_DELETION_BATCH_EMPTY');
  for (let index = 0; index < candidates.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(candidates, index)) {
      fail('TEST_DELETION_CANDIDATE_INVALID');
    }
  }
  const identities = new Set();
  return candidates
    .map((candidate) => {
      if (
        !isPlainObject(candidate) ||
        typeof candidate.identityKey !== 'string' ||
        candidate.identityKey.trim() === '' ||
        typeof candidate.lifecycleState !== 'string' ||
        typeof candidate.reasonCode !== 'string' ||
        candidate.reasonCode.trim() === ''
      ) {
        fail('TEST_DELETION_CANDIDATE_INVALID');
      }
      const normalized = {
        ...candidate,
        identityKey: candidate.identityKey.trim(),
        reasonCode: candidate.reasonCode.trim(),
        capabilityRefs: stringArray(candidate.capabilityRefs || [], 'TEST_DELETION_REFS_INVALID'),
        evidenceRefs: stringArray(candidate.evidenceRefs || [], 'TEST_DELETION_REFS_INVALID'),
      };
      if (identities.has(normalized.identityKey)) fail('TEST_DELETION_CANDIDATE_DUPLICATE');
      identities.add(normalized.identityKey);
      return normalized;
    })
    .sort((left, right) => compareText(left.identityKey, right.identityKey));
}

function policyBindings(policy) {
  if (
    !isPlainObject(policy) ||
    !isPlainObject(policy.deletion) ||
    !Array.isArray(policy.deletion.deterministicReasonCodes) ||
    !isPlainObject(policy.deletion.localReview)
  ) {
    fail('TEST_DELETION_POLICY_INVALID');
  }
  const deterministicReasonCodes = new Set(
    stringArray(policy.deletion.deterministicReasonCodes, 'TEST_DELETION_POLICY_INVALID')
  );
  const localReviewMaxCandidates = policy.deletion.localReview.maxCandidates;
  if (
    !Number.isSafeInteger(localReviewMaxCandidates) ||
    localReviewMaxCandidates < 1 ||
    localReviewMaxCandidates > DEFAULT_MAX_BATCH_SIZE
  ) {
    fail('TEST_DELETION_POLICY_INVALID');
  }
  const maxBatchSize = policy.deletion.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
  if (
    !Number.isSafeInteger(maxBatchSize) ||
    maxBatchSize < localReviewMaxCandidates ||
    maxBatchSize > DEFAULT_MAX_BATCH_SIZE
  ) {
    fail('TEST_DELETION_POLICY_INVALID');
  }
  if (
    policy.deletion.localReview.maxCalls !== 1 ||
    policy.deletion.localReview.retries !== 0 ||
    !Number.isSafeInteger(policy.deletion.localReview.timeoutMs) ||
    policy.deletion.localReview.timeoutMs < 1 ||
    policy.deletion.localReview.timeoutMs > 300000
  ) {
    fail('TEST_DELETION_POLICY_INVALID');
  }
  const protectedCapabilityIds = new Set(
    (policy.protectedCapabilities || []).map((entry) => {
      if (
        !isPlainObject(entry) ||
        typeof entry.capabilityId !== 'string' ||
        entry.capabilityId.trim() === ''
      ) {
        fail('TEST_DELETION_POLICY_INVALID');
      }
      return entry.capabilityId.trim();
    })
  );
  return {
    deterministicReasonCodes,
    localReviewMaxCandidates,
    maxBatchSize,
    protectedCapabilityIds,
  };
}

function rejectExcludedCandidates(candidates, protectedCapabilityIds) {
  for (const candidate of candidates) {
    if (candidate.quarantineStatus || candidate.reasonCode.startsWith('FLAKE_')) {
      fail('FLAKE_NOT_DELETION_AUTHORITY', { identityKey: candidate.identityKey });
    }
    if (
      candidate.lifecycleState === 'core_permanent' ||
      candidate.capabilityRefs.some((ref) => protectedCapabilityIds.has(ref))
    ) {
      fail('CORE_TEST_CHANGE_REQUIRES_SEPARATE_FLOW', {
        identityKey: candidate.identityKey,
      });
    }
    if (candidate.lifecycleState !== 'deletion_candidate') {
      fail('TEST_DELETION_CANDIDATE_STATE_INVALID');
    }
  }
}

function batchHash(identityKeys) {
  return sha256Bytes(canonicalJsonBytes(identityKeys.slice().sort(compareText)));
}

function prepareDeletionReview(rawCandidates, policy) {
  const candidates = normalizeCandidates(rawCandidates);
  const bindings = policyBindings(policy);
  if (candidates.length > bindings.maxBatchSize) fail('TEST_DELETION_BATCH_TOO_LARGE');
  rejectExcludedCandidates(candidates, bindings.protectedCapabilityIds);
  if (candidates.length > bindings.localReviewMaxCandidates) {
    fail('TEST_DELETION_LOCAL_REVIEW_BATCH_TOO_LARGE');
  }

  const candidateIdentityKeys = candidates.map((candidate) => candidate.identityKey);
  const evidenceView = candidates.map((candidate) => ({
    identityKey: candidate.identityKey,
    reasonCode: candidate.reasonCode,
    capabilityRefs: candidate.capabilityRefs,
    evidenceRefs: candidate.evidenceRefs,
  }));
  const authorizationBindings = {
    batchHash: batchHash(candidateIdentityKeys),
    evidenceHash: sha256Bytes(canonicalJsonBytes(evidenceView)),
    policyHash: sha256Bytes(canonicalJsonBytes(policy)),
  };
  return { authorizationBindings, candidateIdentityKeys, candidates };
}

async function authorizeDeletionBatch({ candidates: rawCandidates, policy, invokeLocalModel }) {
  const prepared = prepareDeletionReview(rawCandidates, policy);
  return reviewAmbiguousCandidatesOnce({
    candidates: prepared.candidates,
    invoke: invokeLocalModel,
    timeoutMs: policy.deletion.localReview.timeoutMs,
    ...prepared.authorizationBindings,
  });
}

function verifyDeletionAuthorization({
  authorization,
  deletedIdentityKeys,
  evidenceHash,
  policyHash,
  reviewMode,
  reviewProfileVersion,
}) {
  if (!isPlainObject(authorization)) fail('TEST_DELETION_REVIEW_MISSING');
  const identities = stringArray(deletedIdentityKeys, 'TEST_DELETION_AUTHORIZATION_DRIFT');
  if (
    authorization.verdict !== 'approve_delete' ||
    authorization.batchHash !== batchHash(identities) ||
    authorization.evidenceHash !== evidenceHash ||
    authorization.policyHash !== policyHash ||
    authorization.reviewMode !== reviewMode ||
    authorization.reviewProfileVersion !== reviewProfileVersion
  ) {
    fail('TEST_DELETION_AUTHORIZATION_DRIFT');
  }
  return authorization;
}

function deletionExceptionPolicy(policy) {
  if (policy?.deletion?.optimizationUseForbidden !== true) return null;
  const deletion = policy.deletion;
  if (
    deletion.requiredReviewMode !== 'manual_exception' ||
    !Number.isSafeInteger(deletion.minimumApprovals) ||
    deletion.minimumApprovals < 2
  ) {
    fail('TEST_DELETION_EXCEPTION_POLICY_INVALID');
  }
  return {
    minimumApprovals: deletion.minimumApprovals,
    reviewMode: deletion.requiredReviewMode,
  };
}

function requireDeletionException({
  policy,
  exceptionTicket,
  exceptionReason,
  approvers,
}) {
  const exceptionPolicy = deletionExceptionPolicy(policy);
  if (!exceptionPolicy) return null;
  const normalizedApprovers = stringArray(approvers, 'TEST_DELETION_EXCEPTION_APPROVERS_INVALID');
  if (normalizedApprovers.length < exceptionPolicy.minimumApprovals) {
    fail('TEST_DELETION_EXCEPTION_APPROVALS_INSUFFICIENT');
  }
  return {
    exceptionTicket: nonEmptyString(
      exceptionTicket,
      'TEST_DELETION_EXCEPTION_TICKET_REQUIRED'
    ),
    exceptionReason: nonEmptyString(
      exceptionReason,
      'TEST_DELETION_EXCEPTION_REASON_REQUIRED'
    ),
    approvers: normalizedApprovers,
    reviewMode: exceptionPolicy.reviewMode,
  };
}

function verifyDeletionExceptionAuthorization({ policy, registry, authorization }) {
  const exceptionPolicy = deletionExceptionPolicy(policy);
  if (!exceptionPolicy) return authorization;
  if (registry?.registryMode !== 'manual_exception') {
    fail('TEST_DELETION_EXCEPTION_REGISTRY_REQUIRED');
  }
  if (
    authorization?.reviewMode !== exceptionPolicy.reviewMode ||
    typeof authorization.exceptionTicket !== 'string' ||
    authorization.exceptionTicket.trim() === '' ||
    typeof authorization.exceptionReason !== 'string' ||
    authorization.exceptionReason.trim() === ''
  ) {
    fail('TEST_DELETION_EXCEPTION_AUTHORIZATION_REQUIRED');
  }
  const approvers = stringArray(
    authorization.approvers,
    'TEST_DELETION_EXCEPTION_APPROVERS_INVALID'
  );
  if (approvers.length < exceptionPolicy.minimumApprovals) {
    fail('TEST_DELETION_EXCEPTION_APPROVALS_INSUFFICIENT');
  }
  return authorization;
}

function resolveRepositoryPath(repoRoot, inputPath, code) {
  if (typeof inputPath !== 'string' || inputPath.trim() === '') fail(code);
  const root = path.resolve(repoRoot);
  const target = path.resolve(root, inputPath);
  const relative = path.relative(root, target);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    fail(code);
  }
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail(code);
  }
  return target;
}

function readCanonicalSource({ repoRoot, inputPath, code }) {
  const filePath = resolveRepositoryPath(repoRoot, inputPath, code);
  const receipt = readCanonicalArtifact({ repoRoot, filePath });
  return {
    artifact: receipt.artifact,
    fileSha256: receipt.sha256,
    repositoryPath: repositoryPath(repoRoot, filePath, code),
  };
}

function loadDeletionAuthorityArtifacts({
  repoRoot,
  candidatesPath,
  candidateSet,
  catalogPath,
  coreFreezePath,
  impactPath,
  policy,
}) {
  const candidateSource = readCanonicalSource({
    repoRoot,
    inputPath: candidatesPath,
    code: 'TEST_DELETION_CANDIDATE_PATH_INVALID',
  });
  const artifact = candidateSource.artifact;
  if (
    path.posix.basename(candidateSource.repositoryPath) !== 'test-deletion-candidates.json' ||
    !isPlainObject(artifact) ||
    artifact.schemaVersion !== 'test-deletion-candidates/v1' ||
    !Array.isArray(artifact.candidates) ||
    !Array.isArray(artifact.localReviewCandidates) ||
    !Array.isArray(artifact.rejectedCandidates) ||
    !Array.isArray(artifact.validationCommands) ||
    !isPlainObject(artifact.provenance)
  ) {
    fail('TEST_DELETION_CANDIDATE_ARTIFACT_INVALID');
  }
  const { candidateSetHash, ...artifactBody } = artifact;
  if (
    sha256Value(candidateSetHash, 'TEST_DELETION_CANDIDATE_ARTIFACT_INVALID') !==
    sha256Bytes(canonicalJsonBytes(artifactBody))
  ) {
    fail('TEST_DELETION_CANDIDATE_ARTIFACT_INVALID');
  }
  const selectedCandidateSet =
    typeof candidateSet === 'string' && candidateSet.trim() !== ''
      ? candidateSet.trim()
      : fail('TEST_DELETION_CANDIDATE_SET_REQUIRED');
  const selectedCandidates = selectCandidateSet(artifact, selectedCandidateSet);
  const normalizedCandidates = normalizeCandidates(selectedCandidates);

  const catalogSource = readCanonicalSource({
    repoRoot,
    inputPath: catalogPath,
    code: 'TEST_DELETION_CATALOG_PATH_INVALID',
  });
  const coreFreezeSource = readCanonicalSource({
    repoRoot,
    inputPath: coreFreezePath,
    code: 'TEST_DELETION_CORE_FREEZE_PATH_INVALID',
  });
  const impactSource = readCanonicalSource({
    repoRoot,
    inputPath: impactPath,
    code: 'TEST_DELETION_IMPACT_PATH_INVALID',
  });
  const contentHashes = {
    catalog: sha256Bytes(canonicalJsonBytes(catalogProvenance(catalogSource.artifact))),
    coreFreeze: sha256Bytes(canonicalJsonBytes(coreFreezeSource.artifact)),
    impact: sha256Bytes(canonicalJsonBytes(impactProvenance(impactSource.artifact))),
  };
  if (
    artifact.provenance.catalogHash !== contentHashes.catalog ||
    artifact.provenance.coreFreezeHash !== contentHashes.coreFreeze ||
    artifact.provenance.impactHash !== contentHashes.impact ||
    artifact.provenance.policyHash !== sha256Bytes(canonicalJsonBytes(policy))
  ) {
    fail('TEST_DELETION_CANDIDATE_PROVENANCE_DRIFT');
  }

  return {
    artifact,
    authorityBindings: {
      candidateArtifact: {
        repositoryPath: candidateSource.repositoryPath,
        fileSha256: candidateSource.fileSha256,
        candidateSetHash,
        selectedCandidateSet,
        selectedCandidateSetHash: sha256Bytes(canonicalJsonBytes(selectedCandidates)),
      },
      catalog: {
        repositoryPath: catalogSource.repositoryPath,
        fileSha256: catalogSource.fileSha256,
        contentHash: contentHashes.catalog,
      },
      coreFreeze: {
        repositoryPath: coreFreezeSource.repositoryPath,
        fileSha256: coreFreezeSource.fileSha256,
        contentHash: contentHashes.coreFreeze,
      },
      impact: {
        repositoryPath: impactSource.repositoryPath,
        fileSha256: impactSource.fileSha256,
        contentHash: contentHashes.impact,
      },
    },
    catalog: catalogSource.artifact,
    coreFreeze: coreFreezeSource.artifact,
    impact: impactSource.artifact,
    normalizedCandidates,
  };
}

function candidateBindings(repoRoot, candidates) {
  const paths = new Set();
  return candidates
    .map((candidate) => {
      const testPath = nonEmptyCandidatePath(candidate.testPath);
      if (paths.has(testPath)) fail('TEST_DELETION_CANDIDATE_PATH_DUPLICATE');
      paths.add(testPath);
      const target = resolveRepositoryPath(repoRoot, testPath, 'TEST_DELETION_PATH_INVALID');
      if (!fs.existsSync(target) || !fs.lstatSync(target).isFile()) {
        fail('TEST_DELETION_SOURCE_MISSING', { testPath });
      }
      return {
        identityKey: candidate.identityKey.trim(),
        sourceSha256: sha256Bytes(fs.readFileSync(target)),
        testPath,
      };
    })
    .sort((left, right) => compareText(left.identityKey, right.identityKey));
}

function nonEmptyCandidatePath(value) {
  if (typeof value !== 'string' || value.trim() === '') fail('TEST_DELETION_PATH_INVALID');
  const normalized = value.trim().replaceAll('\\', '/');
  if (
    path.isAbsolute(normalized) ||
    normalized.startsWith('/') ||
    normalized.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    fail('TEST_DELETION_PATH_INVALID');
  }
  return normalized;
}

function isAuthorityFile(repositoryPath, candidatePaths) {
  if (candidatePaths.has(repositoryPath)) return false;
  if (
    repositoryPath === 'repo-governance/ci/test-deletion-authorizations.json' ||
    repositoryPath === 'repo-governance/ci/test-deletion-exception-authorizations.json' ||
    repositoryPath.startsWith('.artifacts/') ||
    repositoryPath.startsWith('.codex-tmp/') ||
    repositoryPath.startsWith('tests/') ||
    repositoryPath.includes('/tests/') ||
    repositoryPath.includes('/fixtures/') ||
    repositoryPath.includes('/assets/') ||
    repositoryPath.includes('/dist/')
  ) {
    return false;
  }
  if (
    repositoryPath.startsWith('packages/') &&
    !repositoryPath.includes('/src/') &&
    !repositoryPath.includes('/bin/') &&
    !repositoryPath.includes('/scripts/') &&
    !repositoryPath.endsWith('/package.json')
  ) {
    return false;
  }
  return (
    repositoryPath === 'package.json' ||
    AUTHORITY_EXTENSIONS.has(path.posix.extname(repositoryPath))
  );
}

function trackedAuthorityFiles(repoRoot, candidatePaths) {
  let output;
  try {
    output = execFileSync('git', ['ls-files', '-z', '--', ...AUTHORITY_ROOTS], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    fail('TEST_DELETION_AUTHORITY_DISCOVERY_FAILED');
  }

  const files = output
    .split('\0')
    .filter(Boolean)
    .map((entry) => entry.replaceAll('\\', '/'))
    .filter((entry) => isAuthorityFile(entry, candidatePaths))
    .sort(compareText);
  let totalBytes = 0;
  return files.map((repositoryPath) => {
    const target = resolveRepositoryPath(
      repoRoot,
      repositoryPath,
      'TEST_DELETION_AUTHORITY_PATH_INVALID'
    );
    if (!fs.existsSync(target) || !fs.lstatSync(target).isFile()) {
      fail('TEST_DELETION_AUTHORITY_SOURCE_MISSING', { authorityPath: repositoryPath });
    }
    const size = fs.statSync(target).size;
    totalBytes += size;
    if (size > MAX_AUTHORITY_FILE_BYTES || totalBytes > MAX_AUTHORITY_SCAN_BYTES) {
      fail('TEST_DELETION_AUTHORITY_SCAN_LIMIT', {
        authorityPath: repositoryPath,
        size,
        totalBytes,
      });
    }
    return { repositoryPath, target };
  });
}

function authorityKind(repositoryPath) {
  if (repositoryPath.startsWith('.github/workflows/')) return 'workflow_authority';
  if (repositoryPath.startsWith('_bmad/shared/requirements-contract/')) {
    return 'manifest_authority';
  }
  if (repositoryPath.startsWith('repo-governance/')) return 'tracked_registry';
  if (repositoryPath.endsWith('/package.json') || repositoryPath === 'package.json') {
    return 'package_script_authority';
  }
  return 'production_source';
}

function findExternalTestBindings({ repoRoot, candidatePaths: rawCandidatePaths }) {
  if (!Array.isArray(rawCandidatePaths) || rawCandidatePaths.length === 0) {
    fail('TEST_DELETION_BATCH_EMPTY');
  }
  const candidatePaths = new Set(rawCandidatePaths.map(nonEmptyCandidatePath));
  const authorityFiles = trackedAuthorityFiles(repoRoot, candidatePaths);
  const references = [];
  for (const authorityFile of authorityFiles) {
    let source;
    try {
      source = fs.readFileSync(authorityFile.target, 'utf8');
    } catch {
      fail('TEST_DELETION_AUTHORITY_SOURCE_UNREADABLE', {
        authorityPath: authorityFile.repositoryPath,
      });
    }
    for (const testPath of candidatePaths) {
      if (source.includes(testPath) || source.includes(testPath.replaceAll('/', path.win32.sep))) {
        references.push({
          authorityKind: authorityKind(authorityFile.repositoryPath),
          authorityPath: authorityFile.repositoryPath,
          testPath,
        });
      }
    }
  }
  return {
    authorityFileCount: authorityFiles.length,
    references: references.sort(
      (left, right) =>
        compareText(left.testPath, right.testPath) ||
        compareText(left.authorityPath, right.authorityPath) ||
        compareText(left.authorityKind, right.authorityKind)
    ),
  };
}

function assertNoExternalTestBindings(input) {
  const result = findExternalTestBindings(input);
  if (result.references.length > 0) {
    fail('TEST_DELETION_EXTERNAL_BINDING_ACTIVE', {
      referenceCount: result.references.length,
      references: result.references.slice(0, DEFAULT_MAX_BATCH_SIZE),
    });
  }
  return { authorityFileCount: result.authorityFileCount };
}

function normalizeValidationCommands(value) {
  if (!Array.isArray(value) || value.length === 0) fail('TEST_DELETION_VALIDATION_MISSING');
  const commands = value.map((entry) => {
    if (!isPlainObject(entry)) fail('TEST_DELETION_VALIDATION_INVALID');
    const kind = typeof entry.kind === 'string' ? entry.kind.trim() : '';
    const rawCommand = typeof entry.command === 'string' ? entry.command.trim() : '';
    const command =
      rawCommand && path.resolve(rawCommand) === path.resolve(process.execPath)
        ? 'node'
        : rawCommand;
    if (!REQUIRED_VALIDATION_KINDS.includes(kind) || command === '') {
      fail('TEST_DELETION_VALIDATION_INVALID');
    }
    if (!Array.isArray(entry.args) || entry.args.some((argument) => typeof argument !== 'string')) {
      fail('TEST_DELETION_VALIDATION_INVALID');
    }
    const args = entry.args.slice();
    return { args, command, kind };
  });
  const kinds = new Set(commands.map((entry) => entry.kind));
  if (REQUIRED_VALIDATION_KINDS.some((kind) => !kinds.has(kind))) {
    fail('TEST_DELETION_VALIDATION_MISSING');
  }
  return commands.sort(
    (left, right) =>
      compareText(left.kind, right.kind) ||
      compareText(left.command, right.command) ||
      compareText(canonicalJsonBytes(left.args), canonicalJsonBytes(right.args))
  );
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) fail('TEST_DELETION_ARGUMENT_INVALID');
    parsed[key.slice(2)] = value;
  }
  for (const required of [
    'candidates',
    'candidate-set',
    'catalog',
    'core-freeze',
    'impact',
    'policy',
    'output',
  ]) {
    if (!parsed[required]) fail('TEST_DELETION_ARGUMENT_MISSING', { argument: required });
  }
  return parsed;
}

function readJson(filePath, code) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    fail(code, { filePath });
  }
}

function writeAtomicJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, canonicalJsonBytes(value), { flag: 'wx' });
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

function appendTrackedAuthorization(registry, authorization) {
  if (
    !isPlainObject(registry) ||
    registry.schemaVersion !== 'test-deletion-authorizations/v1' ||
    !Array.isArray(registry.authorizations)
  ) {
    fail('TEST_DELETION_REGISTRY_INVALID');
  }
  const existing = registry.authorizations.find(
    (entry) => entry?.batchHash === authorization.batchHash
  );
  if (existing) {
    if (!canonicalJsonBytes(existing).equals(canonicalJsonBytes(authorization))) {
      fail('TEST_DELETION_AUTHORIZATION_DRIFT');
    }
    return registry;
  }
  return {
    ...registry,
    authorizations: [...registry.authorizations, authorization].sort((left, right) =>
      compareText(left.batchHash, right.batchHash)
    ),
  };
}

function verifyTrackedAuthorization({ registry, authorization }) {
  if (
    !isPlainObject(registry) ||
    !Array.isArray(registry.authorizations) ||
    !isPlainObject(authorization)
  ) {
    fail('TEST_DELETION_REVIEW_MISSING');
  }
  const tracked = registry.authorizations.find(
    (entry) => entry?.batchHash === authorization.batchHash
  );
  if (!tracked) fail('TEST_DELETION_REVIEW_MISSING');
  if (!canonicalJsonBytes(tracked).equals(canonicalJsonBytes(authorization))) {
    fail('TEST_DELETION_AUTHORIZATION_DRIFT');
  }
  return authorization;
}

async function authorizeFromFiles({
  repoRoot = process.cwd(),
  candidatesPath,
  candidateSet,
  catalogPath,
  coreFreezePath,
  impactPath,
  policyPath,
  outputPath,
  registryPath = 'repo-governance/ci/test-deletion-exception-authorizations.json',
  exceptionTicket,
  exceptionReason,
  approvers = [],
  invokeLocalModel,
}) {
  const root = path.resolve(repoRoot);
  const candidateFile = resolveRepositoryPath(
    root,
    candidatesPath,
    'TEST_DELETION_CANDIDATE_PATH_INVALID'
  );
  const policyFile = resolveRepositoryPath(root, policyPath, 'TEST_DELETION_POLICY_PATH_INVALID');
  const outputFile = resolveRepositoryPath(root, outputPath, 'TEST_DELETION_OUTPUT_PATH_INVALID');
  const governedOutputRoot = path.resolve(root, '.artifacts', 'test-portfolio');
  const outputRelative = path.relative(governedOutputRoot, outputFile);
  if (
    outputRelative === '' ||
    outputRelative === '..' ||
    outputRelative.startsWith(`..${path.sep}`)
  ) {
    fail('TEST_DELETION_OUTPUT_PATH_INVALID');
  }
  const registryFile = resolveRepositoryPath(
    root,
    registryPath,
    'TEST_DELETION_REGISTRY_PATH_INVALID'
  );
  const policy = readJson(policyFile, 'TEST_DELETION_POLICY_INVALID');
  const deletionException = requireDeletionException({
    policy,
    exceptionTicket,
    exceptionReason,
    approvers,
  });
  const authority = loadDeletionAuthorityArtifacts({
    repoRoot: root,
    candidatesPath: candidateFile,
    candidateSet,
    catalogPath,
    coreFreezePath,
    impactPath,
    policy,
  });
  const payload = authority.artifact;
  const normalizedCandidates = authority.normalizedCandidates;
  const preparedReview = prepareDeletionReview(normalizedCandidates, policy);
  const boundCandidates = candidateBindings(root, normalizedCandidates);
  assertNoExternalTestBindings({
    repoRoot: root,
    candidatePaths: boundCandidates.map((binding) => binding.testPath),
  });
  const normalizedValidationCommands = normalizeValidationCommands(payload.validationCommands);
  const registry = readJson(registryFile, 'TEST_DELETION_REGISTRY_INVALID');
  if (deletionException && registry.registryMode !== 'manual_exception') {
    fail('TEST_DELETION_EXCEPTION_REGISTRY_REQUIRED');
  }
  const tracked = registry.authorizations.find(
    (entry) => entry?.batchHash === preparedReview.authorizationBindings.batchHash
  );
  if (tracked) {
    verifyDeletionAuthorization({
      authorization: tracked,
      deletedIdentityKeys: preparedReview.candidateIdentityKeys,
      evidenceHash: preparedReview.authorizationBindings.evidenceHash,
      policyHash: preparedReview.authorizationBindings.policyHash,
      reviewMode: deletionException?.reviewMode || 'local_model_once',
      reviewProfileVersion: REVIEW_PROFILE_VERSION,
    });
    verifyDeletionExceptionAuthorization({ policy, registry, authorization: tracked });
    if (
      !canonicalJsonBytes(tracked.candidateBindings).equals(canonicalJsonBytes(boundCandidates)) ||
      !canonicalJsonBytes(tracked.validationCommands).equals(
        canonicalJsonBytes(normalizedValidationCommands)
      ) ||
      !canonicalJsonBytes(tracked.authorityBindings).equals(
        canonicalJsonBytes(authority.authorityBindings)
      )
    ) {
      fail('TEST_DELETION_AUTHORIZATION_DRIFT');
    }
    writeAtomicJson(outputFile, tracked);
    return tracked;
  }
  const effectiveInvokeLocalModel =
    invokeLocalModel ||
    createCodexLocalReviewInvoker({
      repoRoot: root,
      timeoutMs: policy.deletion.localReview.timeoutMs,
    });
  const authorization = await authorizeDeletionBatch({
    candidates: normalizedCandidates,
    policy,
    invokeLocalModel: effectiveInvokeLocalModel,
  });
  if (authorization.verdict !== 'approve_delete') {
    fail('TEST_DELETION_REVIEW_NOT_APPROVED', { verdict: authorization.verdict });
  }
  const completeAuthorization = {
    ...authorization,
    ...(deletionException || {}),
    authorityBindings: authority.authorityBindings,
    candidateBindings: boundCandidates,
    validationCommands: normalizedValidationCommands,
  };
  const updatedRegistry = appendTrackedAuthorization(registry, completeAuthorization);
  writeAtomicJson(outputFile, completeAuthorization);
  writeAtomicJson(registryFile, updatedRegistry);
  return completeAuthorization;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const authorization = await authorizeFromFiles({
    candidatesPath: args.candidates,
    candidateSet: args['candidate-set'],
    catalogPath: args.catalog,
    coreFreezePath: args['core-freeze'],
    impactPath: args.impact,
    outputPath: args.output,
    policyPath: args.policy,
    registryPath: args.registry,
    exceptionTicket: args['exception-ticket'],
    exceptionReason: args['exception-reason'],
    approvers: args.approvers ? args.approvers.split(',') : [],
  });
  process.stdout.write(
    `${JSON.stringify({
      batchHash: authorization.batchHash,
      candidateCount: authorization.candidateIdentityKeys.length,
      reviewMode: authorization.reviewMode,
      verdict: authorization.verdict,
    })}\n`
  );
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(
      `${error?.code || error?.message || 'TEST_DELETION_AUTHORIZATION_FAILED'}\n`
    );
    process.exitCode = 1;
  });
}

module.exports = {
  appendTrackedAuthorization,
  assertNoExternalTestBindings,
  authorizeDeletionBatch,
  authorizeFromFiles,
  catalogProvenance,
  coreSelectedIdentities,
  createCodexLocalReviewInvoker,
  findExternalTestBindings,
  impactedIdentities,
  impactProvenance,
  requireDeletionException,
  loadDeletionAuthorityArtifacts,
  selectCandidateSet,
  uniqueObligationProviders,
  verifyTrackedAuthorization,
  verifyDeletionAuthorization,
  verifyDeletionExceptionAuthorization,
};
