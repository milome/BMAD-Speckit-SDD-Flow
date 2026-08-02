'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const {
  compareText,
  fail,
  readCanonicalArtifact,
  writeCanonicalArtifact,
} = require('./canonical-artifact.cjs');
const {
  catalogProvenance,
  coreSelectedIdentities,
  findExternalTestBindings,
  impactedIdentities,
  impactProvenance,
  uniqueObligationProviders,
} = require('./authorize-test-deletions.cjs');

const REVIEW_REASON_CODES = Object.freeze({
  ineffective_candidate: 'INEFFECTIVE_ORACLE_REVIEW',
  obsolete_candidate: 'OBSOLETE_TARGET_REVIEW',
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value, code) {
  if (typeof value !== 'string' || value.trim() === '') fail(code);
  return value.trim();
}

function stringArray(value, code) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim() === '')
  ) {
    fail(code);
  }
  return value.map((entry) => entry.trim());
}

function stableUnique(values) {
  return [...new Set(values)].sort(compareText);
}

function classificationValues(test, field) {
  const value = test.classifications?.[field];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return stableUnique(value);
  return [];
}

function testIndex(catalog) {
  if (!isObject(catalog) || catalog.schemaVersion !== 'test-catalog/v1') {
    fail('TEST_DELETION_CATALOG_INVALID');
  }
  if (!Array.isArray(catalog.tests)) fail('TEST_DELETION_CATALOG_INVALID');
  const index = new Map();
  for (const test of catalog.tests) {
    if (!isObject(test)) fail('TEST_DELETION_CATALOG_TEST_INVALID');
    const identityKey = nonEmptyString(test.identityKey, 'TEST_DELETION_CATALOG_TEST_INVALID');
    nonEmptyString(test.testPath, 'TEST_DELETION_CATALOG_TEST_INVALID');
    if (index.has(identityKey)) fail('TEST_DELETION_CATALOG_DUPLICATE');
    index.set(identityKey, test);
  }
  return index;
}

function protectedCapabilityIds(policy) {
  if (!isObject(policy) || !isObject(policy.deletion)) fail('TEST_DELETION_POLICY_INVALID');
  const deterministicReasonCodes = new Set(
    stringArray(policy.deletion.deterministicReasonCodes, 'TEST_DELETION_POLICY_INVALID')
  );
  if (!Array.isArray(policy.protectedCapabilities)) fail('TEST_DELETION_POLICY_INVALID');
  const protectedIds = new Set(
    policy.protectedCapabilities.map((entry) =>
      nonEmptyString(entry?.capabilityId, 'TEST_DELETION_POLICY_INVALID')
    )
  );
  return { deterministicReasonCodes, protectedIds };
}

function authorityBindingReasons(test, protectedIds, allowTransferableBindings = false) {
  const reasons = [];
  const capabilityRefs = stringArray(
    test.capabilityRefs || [],
    'TEST_DELETION_CATALOG_TEST_INVALID'
  );
  const traceRefs = stringArray(test.traceRefs || [], 'TEST_DELETION_CATALOG_TEST_INVALID');
  const featureRefs = stringArray(test.featureRefs || [], 'TEST_DELETION_CATALOG_TEST_INVALID');
  const criticalBindings = Array.isArray(test.classifications?.criticalBindings)
    ? test.classifications.criticalBindings
    : [];
  if (capabilityRefs.some((ref) => protectedIds.has(ref))) {
    reasons.push('PROTECTED_CAPABILITY_BOUND');
  }
  if (
    (!allowTransferableBindings && capabilityRefs.length > 0) ||
    (!allowTransferableBindings && traceRefs.length > 0) ||
    (!allowTransferableBindings && featureRefs.length > 0)
  ) {
    reasons.push('AUTHORITY_BINDING_PRESENT');
  }
  if (criticalBindings.length > 0) reasons.push('CRITICAL_BINDING_PRESENT');
  if (classificationValues(test, 'criticality').includes('critical')) {
    reasons.push('CRITICAL_TEST');
  }
  return reasons;
}

function rejectionReasons(test, context, options = {}) {
  const reasons = [];
  if (test.lifecycleState === 'core_permanent' || context.coreSelected.has(test.identityKey)) {
    reasons.push('CORE_SELECTED');
  }
  if (context.impacted.has(test.identityKey)) reasons.push('CHANGED_CODE_IMPACTED');
  if (context.uniqueProviders.has(test.identityKey)) reasons.push('UNIQUE_OBLIGATION_PROVIDER');
  reasons.push(
    ...authorityBindingReasons(
      test,
      context.protectedIds,
      options.allowTransferableBindings === true
    )
  );
  if (
    classificationValues(test, 'targetValidity').includes('ambiguous') ||
    classificationValues(test, 'oracleEffectiveness').includes('ambiguous')
  ) {
    reasons.push('EVIDENCE_AMBIGUOUS');
  }
  return stableUnique(reasons);
}

function isSuperset(actual, required) {
  const values = new Set(actual);
  return required.every((entry) => values.has(entry));
}

function consolidationCandidate(intent, index, context) {
  if (!isObject(intent)) fail('TEST_DELETION_CONSOLIDATION_INTENT_INVALID');
  const sourceIdentityKey = nonEmptyString(
    intent.sourceIdentityKey,
    'TEST_DELETION_CONSOLIDATION_INTENT_INVALID'
  );
  const replacementIdentityKey = nonEmptyString(
    intent.replacementIdentityKey,
    'TEST_DELETION_CONSOLIDATION_INTENT_INVALID'
  );
  const reasonCode = nonEmptyString(
    intent.reasonCode,
    'TEST_DELETION_CONSOLIDATION_INTENT_INVALID'
  );
  if (
    sourceIdentityKey === replacementIdentityKey ||
    reasonCode !== 'REPLACED_BY_CONTRACT_TEST' ||
    !context.deterministicReasonCodes.has(reasonCode)
  ) {
    fail('TEST_DELETION_CONSOLIDATION_INTENT_INVALID');
  }
  const source = index.get(sourceIdentityKey);
  const replacement = index.get(replacementIdentityKey);
  if (!source || !replacement || replacement.lifecycleState === 'deletion_candidate') {
    fail('TEST_DELETION_CONSOLIDATION_TARGET_INVALID');
  }
  const rejection = rejectionReasons(source, context, { allowTransferableBindings: true });
  if (rejection.length > 0) {
    return {
      rejected: {
        identityKey: sourceIdentityKey,
        reasonCodes: rejection,
      },
    };
  }
  const sourceCapabilities = stringArray(
    source.capabilityRefs || [],
    'TEST_DELETION_CATALOG_TEST_INVALID'
  );
  const sourceFailureModes = stringArray(
    source.failureModeRefs || [],
    'TEST_DELETION_CATALOG_TEST_INVALID'
  );
  const sourceTraceRefs = stringArray(source.traceRefs || [], 'TEST_DELETION_CATALOG_TEST_INVALID');
  const sourceFeatureRefs = stringArray(
    source.featureRefs || [],
    'TEST_DELETION_CATALOG_TEST_INVALID'
  );
  const replacementCapabilities = stringArray(
    replacement.capabilityRefs || [],
    'TEST_DELETION_CATALOG_TEST_INVALID'
  );
  const replacementFailureModes = stringArray(
    replacement.failureModeRefs || [],
    'TEST_DELETION_CATALOG_TEST_INVALID'
  );
  const replacementTraceRefs = stringArray(
    replacement.traceRefs || [],
    'TEST_DELETION_CATALOG_TEST_INVALID'
  );
  const replacementFeatureRefs = stringArray(
    replacement.featureRefs || [],
    'TEST_DELETION_CATALOG_TEST_INVALID'
  );
  if (
    !isSuperset(replacementCapabilities, sourceCapabilities) ||
    !isSuperset(replacementFailureModes, sourceFailureModes) ||
    !isSuperset(replacementTraceRefs, sourceTraceRefs) ||
    !isSuperset(replacementFeatureRefs, sourceFeatureRefs)
  ) {
    fail('TEST_DELETION_REPLACEMENT_COVERAGE_LOSS', {
      sourceIdentityKey,
      replacementIdentityKey,
    });
  }
  return {
    candidate: {
      identityKey: sourceIdentityKey,
      testPath: source.testPath,
      lifecycleState: 'deletion_candidate',
      reasonCode,
      replacementIdentityKey,
      capabilityRefs: stableUnique(sourceCapabilities),
      evidenceRefs: stableUnique([
        `replacement:${replacementIdentityKey}`,
        'coverage-conserved:capabilityRefs',
        'coverage-conserved:failureModeRefs',
        'coverage-conserved:traceRefs',
        'coverage-conserved:featureRefs',
      ]),
    },
  };
}

function sortCanonical(values) {
  return [...values].sort((left, right) =>
    compareText(
      canonicalJsonBytes(left).toString('utf8'),
      canonicalJsonBytes(right).toString('utf8')
    )
  );
}

function consolidationIntentProvenance(consolidationIntents) {
  return sortCanonical(
    consolidationIntents.map((intent) => ({
      sourceIdentityKey: intent.sourceIdentityKey,
      replacementIdentityKey: intent.replacementIdentityKey,
      reasonCode: intent.reasonCode,
    }))
  );
}

function reviewCandidate(test, context) {
  if (test.lifecycleState !== 'retained_on_demand' || test.testPath.startsWith('tests/fixtures/')) {
    return null;
  }
  const targetValidity = classificationValues(test, 'targetValidity');
  const oracleEffectiveness = classificationValues(test, 'oracleEffectiveness');
  const reasonCode =
    targetValidity.length === 1 && targetValidity[0] === 'obsolete_candidate'
      ? REVIEW_REASON_CODES.obsolete_candidate
      : oracleEffectiveness.length === 1 && oracleEffectiveness[0] === 'ineffective_candidate'
        ? REVIEW_REASON_CODES.ineffective_candidate
        : null;
  if (!reasonCode) return null;
  const rejection = rejectionReasons(test, context);
  if (rejection.length > 0) {
    return { rejected: { identityKey: test.identityKey, reasonCodes: rejection } };
  }
  return {
    candidate: {
      identityKey: test.identityKey,
      testPath: test.testPath,
      lifecycleState: 'deletion_candidate',
      reasonCode,
      capabilityRefs: stableUnique(test.capabilityRefs || []),
      evidenceRefs: stableUnique(test.evidenceRefs || []),
    },
  };
}

function generateTestDeletionCandidates({
  catalog,
  coreFreeze,
  impact,
  policy,
  consolidationIntents = [],
  validationCommands = [],
}) {
  if (!Array.isArray(consolidationIntents) || !Array.isArray(validationCommands)) {
    fail('TEST_DELETION_CANDIDATE_INPUT_INVALID');
  }
  const index = testIndex(catalog);
  const { deterministicReasonCodes, protectedIds } = protectedCapabilityIds(policy);
  const context = {
    coreSelected: coreSelectedIdentities(coreFreeze),
    uniqueProviders: uniqueObligationProviders(coreFreeze),
    impacted: impactedIdentities(impact),
    deterministicReasonCodes,
    protectedIds,
  };
  const deterministic = [];
  const localReview = [];
  const rejected = [];
  const intentSources = new Set();
  for (const intent of consolidationIntents) {
    const sourceIdentityKey = nonEmptyString(
      intent?.sourceIdentityKey,
      'TEST_DELETION_CONSOLIDATION_INTENT_INVALID'
    );
    if (intentSources.has(sourceIdentityKey)) fail('TEST_DELETION_CONSOLIDATION_INTENT_DUPLICATE');
    intentSources.add(sourceIdentityKey);
    const projected = consolidationCandidate(intent, index, context);
    if (projected.candidate) deterministic.push(projected.candidate);
    if (projected.rejected) rejected.push(projected.rejected);
  }
  for (const test of [...index.values()].sort((left, right) =>
    compareText(left.identityKey, right.identityKey)
  )) {
    if (intentSources.has(test.identityKey)) continue;
    const projected = reviewCandidate(test, context);
    if (projected?.candidate) localReview.push(projected.candidate);
    if (projected?.rejected) rejected.push(projected.rejected);
  }
  const candidates = deterministic.sort((left, right) =>
    compareText(left.identityKey, right.identityKey)
  );
  const localReviewCandidates = localReview.sort((left, right) =>
    compareText(left.identityKey, right.identityKey)
  );
  if (
    (candidates.length > 0 || localReviewCandidates.length > 0) &&
    validationCommands.length === 0
  ) {
    fail('TEST_DELETION_VALIDATION_MISSING');
  }
  const rejectedCandidates = rejected
    .sort((left, right) => compareText(left.identityKey, right.identityKey))
    .filter(
      (entry, indexValue, values) =>
        indexValue === 0 || entry.identityKey !== values[indexValue - 1].identityKey
    );
  const body = {
    schemaVersion: 'test-deletion-candidates/v1',
    candidates,
    localReviewCandidates,
    rejectedCandidates,
    validationCommands: stableUnique(validationCommands),
    summary: {
      deterministicCandidateCount: candidates.length,
      localReviewCandidateCount: localReviewCandidates.length,
      rejectedCandidateCount: rejectedCandidates.length,
    },
    provenance: {
      catalogHash: sha256Bytes(canonicalJsonBytes(catalogProvenance(catalog))),
      coreFreezeHash: sha256Bytes(canonicalJsonBytes(coreFreeze)),
      impactHash: sha256Bytes(canonicalJsonBytes(impactProvenance(impact))),
      policyHash: sha256Bytes(canonicalJsonBytes(policy)),
      consolidationIntentHash: sha256Bytes(
        canonicalJsonBytes(consolidationIntentProvenance(consolidationIntents))
      ),
    },
  };
  return {
    ...body,
    candidateSetHash: sha256Bytes(canonicalJsonBytes(body)),
  };
}

function rejectExternallyBoundCandidates({ artifact, references }) {
  if (
    !isObject(artifact) ||
    !Array.isArray(artifact.candidates) ||
    !Array.isArray(artifact.localReviewCandidates) ||
    !Array.isArray(artifact.rejectedCandidates) ||
    !Array.isArray(references)
  ) {
    fail('TEST_DELETION_EXTERNAL_BINDING_INPUT_INVALID');
  }
  const boundPaths = new Set(
    references.map((reference) => {
      if (
        !isObject(reference) ||
        typeof reference.authorityKind !== 'string' ||
        typeof reference.authorityPath !== 'string'
      ) {
        fail('TEST_DELETION_EXTERNAL_BINDING_INPUT_INVALID');
      }
      return nonEmptyString(
        reference.testPath,
        'TEST_DELETION_EXTERNAL_BINDING_INPUT_INVALID'
      ).replaceAll('\\', '/');
    })
  );
  if (boundPaths.size === 0) return artifact;

  const rejectedByIdentity = new Map(
    artifact.rejectedCandidates.map((entry) => [
      nonEmptyString(entry.identityKey, 'TEST_DELETION_EXTERNAL_BINDING_INPUT_INVALID'),
      {
        identityKey: entry.identityKey,
        reasonCodes: stableUnique(
          stringArray(entry.reasonCodes || [], 'TEST_DELETION_EXTERNAL_BINDING_INPUT_INVALID')
        ),
      },
    ])
  );
  const retainUnbound = (candidates) =>
    candidates.filter((candidate) => {
      const testPath = nonEmptyString(
        candidate.testPath,
        'TEST_DELETION_EXTERNAL_BINDING_INPUT_INVALID'
      ).replaceAll('\\', '/');
      if (!boundPaths.has(testPath)) return true;
      const identityKey = nonEmptyString(
        candidate.identityKey,
        'TEST_DELETION_EXTERNAL_BINDING_INPUT_INVALID'
      );
      const existing = rejectedByIdentity.get(identityKey);
      rejectedByIdentity.set(identityKey, {
        identityKey,
        reasonCodes: stableUnique([
          ...(existing?.reasonCodes || []),
          'EXTERNAL_AUTHORITY_BINDING_PRESENT',
        ]),
      });
      return false;
    });
  const candidates = retainUnbound(artifact.candidates);
  const localReviewCandidates = retainUnbound(artifact.localReviewCandidates);
  const rejectedCandidates = [...rejectedByIdentity.values()].sort((left, right) =>
    compareText(left.identityKey, right.identityKey)
  );
  const { candidateSetHash: _candidateSetHash, ...artifactBody } = artifact;
  const body = {
    ...artifactBody,
    candidates,
    localReviewCandidates,
    rejectedCandidates,
    summary: {
      deterministicCandidateCount: candidates.length,
      localReviewCandidateCount: localReviewCandidates.length,
      rejectedCandidateCount: rejectedCandidates.length,
    },
  };
  return {
    ...body,
    candidateSetHash: sha256Bytes(canonicalJsonBytes(body)),
  };
}

function repoJson(repoRoot, value, code) {
  const target = path.resolve(repoRoot, value);
  const relative = path.relative(repoRoot, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(code);
  }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function parseCliArgs(args) {
  const options = {
    policy: 'repo-governance/ci/test-policy.json',
    outputDir: '.artifacts/test-portfolio/deletion-batches',
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      ![
        '--catalog',
        '--core-freeze',
        '--impact',
        '--policy',
        '--maintenance-plan',
        '--output-dir',
      ].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('TEST_DELETION_CANDIDATE_ARGS_INVALID');
    }
    const key = flag.slice(2).replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
    options[key] = value;
  }
  if (!options.catalog || !options.coreFreeze || !options.impact) {
    fail('TEST_DELETION_CANDIDATE_ARGS_INVALID');
  }
  return options;
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
    filePath: path.resolve(repoRoot, options.coreFreeze),
  }).artifact;
  const impact = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options.impact),
  }).artifact;
  const policy = repoJson(repoRoot, options.policy, 'TEST_DELETION_POLICY_PATH_INVALID');
  const maintenancePlan = options.maintenancePlan
    ? repoJson(repoRoot, options.maintenancePlan, 'TEST_DELETION_MAINTENANCE_PLAN_PATH_INVALID')
    : {};
  const generatedArtifact = generateTestDeletionCandidates({
    catalog,
    coreFreeze,
    impact,
    policy,
    consolidationIntents: maintenancePlan.consolidationIntents || [],
    validationCommands: maintenancePlan.validationCommands || [],
  });
  const reviewableCandidates = [
    ...generatedArtifact.candidates,
    ...generatedArtifact.localReviewCandidates,
  ];
  const bindingScan =
    reviewableCandidates.length === 0
      ? { references: [] }
      : findExternalTestBindings({
          repoRoot,
          candidatePaths: reviewableCandidates.map((candidate) => candidate.testPath),
        });
  const artifact = rejectExternallyBoundCandidates({
    artifact: generatedArtifact,
    references: bindingScan.references,
  });
  const receipt = writeCanonicalArtifact({
    repoRoot,
    outputDir: options.outputDir,
    fileName: 'test-deletion-candidates.json',
    artifact,
  });
  process.stdout.write(`${JSON.stringify({ ...receipt, summary: artifact.summary })}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.code || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  generateTestDeletionCandidates,
  main,
  parseCliArgs,
  rejectExternallyBoundCandidates,
};
