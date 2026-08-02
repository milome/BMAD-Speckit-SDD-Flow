'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  compareText,
  fail,
  readCanonicalArtifact,
  writeCanonicalArtifact,
} = require('./canonical-artifact.cjs');
const { validateSemanticJourneys, validateTestPolicy } = require('./test-policy.cjs');
const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');

const SIX_MODEL_NAMES = new Set([
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
]);
const COVERAGE_STATUSES = new Set([
  'covered',
  'indirectly_covered',
  'ambiguous',
  'missing_test',
  'target_unresolved',
  'product_incompatible',
  'not_applicable',
]);
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stableUnique(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))].sort(
    compareText
  );
}

function requireArray(value, code) {
  if (!Array.isArray(value)) fail(code);
  return value;
}

function catalogTests(catalog) {
  return requireArray(catalog?.tests, 'SIX_MODEL_COVERAGE_CATALOG_INVALID')
    .map((test) => {
      if (
        !isObject(test) ||
        typeof test.identityKey !== 'string' ||
        !isObject(test.behaviorEvidence) ||
        !isObject(test.behaviorOracleAuthority) ||
        !isObject(test.classifications)
      ) {
        fail('SIX_MODEL_COVERAGE_CATALOG_TEST_INVALID');
      }
      return test;
    })
    .sort((left, right) => compareText(left.identityKey, right.identityKey));
}

function coverageModel(obligationId) {
  const separator = obligationId.indexOf('/');
  return separator > 0 ? obligationId.slice(0, separator) : 'unknown';
}

function coverageTransition(obligationId) {
  const separator = obligationId.indexOf('/');
  return separator > 0 ? obligationId.slice(separator + 1) : obligationId;
}

function effectiveCoverage(row) {
  if (row.applicability === 'not_applicable') return false;
  if (row.coverageStatus === 'covered') return true;
  return row.coverageStatus === 'indirectly_covered' && row.minimumEvidenceKind === 'indirect';
}

function strongestEvidenceKind(values) {
  if (values.includes('direct')) return 'direct';
  if (values.includes('indirect')) return 'indirect';
  if (values.includes('ambiguous')) return 'ambiguous';
  return null;
}

function atomicGapReason(status) {
  if (status === 'ambiguous') return 'ambiguous_evidence';
  if (status === 'target_unresolved') return 'target_unresolved';
  if (status === 'product_incompatible') return 'product_incompatible';
  if (status === 'missing_test') return 'missing_test';
  return null;
}

function oracleIndependenceForEvidenceRef(test, evidenceRef) {
  return (
    test.behaviorOracleAuthority[evidenceRef]?.oracleIndependence ??
    (test.classifications.oracleEffectiveness === 'effective' ? 'independent' : 'dependent')
  );
}

function projectAtomicRows({ coreFreeze, testsByIdentity }) {
  requireArray(coreFreeze.candidateEvidence, 'SIX_MODEL_COVERAGE_CORE_FREEZE_INVALID');
  return requireArray(coreFreeze.coverage, 'SIX_MODEL_COVERAGE_CORE_FREEZE_INVALID').map(
    (coverage) => {
      if (
        !isObject(coverage) ||
        typeof coverage.obligationId !== 'string' ||
        !COVERAGE_STATUSES.has(coverage.status)
      ) {
        fail('SIX_MODEL_COVERAGE_ROW_INVALID');
      }
      const diagnostics = requireArray(
        coverage.evidenceDiagnostics,
        'SIX_MODEL_COVERAGE_ROW_INVALID'
      );
      const selectedEvidence = requireArray(
        coverage.selectedEvidence,
        'SIX_MODEL_COVERAGE_ROW_INVALID'
      );
      const candidateTestIdentityRefs = stableUnique(diagnostics.map((item) => item.identityKey));
      const selectedTestIdentityRefs = stableUnique(
        selectedEvidence.map((item) => item.identityKey)
      );
      const selectedDiagnostics = diagnostics.filter(
        (diagnostic) =>
          selectedTestIdentityRefs.includes(diagnostic.identityKey) &&
          diagnostic.eligibleForCoverage === true
      );
      const targetRefs = stableUnique(
        candidateTestIdentityRefs.flatMap(
          (identityKey) => testsByIdentity.get(identityKey)?.targetRefs || []
        )
      );
      const row = {
        obligationId: coverage.obligationId,
        model: coverageModel(coverage.obligationId),
        transition: coverageTransition(coverage.obligationId),
        applicability: coverage.applicability,
        minimumEvidenceKind: coverage.minimumEvidenceKind,
        selectedTestIdentityRefs,
        candidateTestIdentityRefs,
        directEvidenceKind: strongestEvidenceKind(
          selectedEvidence.map((item) => item.evidenceKind)
        ),
        oracleIndependence:
          selectedDiagnostics.length > 0 &&
          selectedDiagnostics.every((diagnostic) => diagnostic.oracleIndependence === 'independent')
            ? 'independent'
            : 'unresolved',
        coverageStatus: coverage.status,
        gapReason: atomicGapReason(coverage.status),
        affectedTargetRefs: targetRefs,
        remediationOwner: 'dev',
        devHandoffRequired: false,
      };
      row.devHandoffRequired = row.applicability === 'applicable' && !effectiveCoverage(row);
      return row;
    }
  );
}

function journeyCandidates(tests, journey) {
  return tests
    .map((test) => {
      const evidence = journey.anyOfEvidenceRefs
        .map((evidenceRef) => ({
          evidenceKind: test.behaviorEvidence[evidenceRef],
          oracleIndependence: oracleIndependenceForEvidenceRef(test, evidenceRef),
        }))
        .filter((entry) => entry.evidenceKind);
      if (evidence.length === 0) return null;
      const independentEvidence = evidence.filter(
        (entry) => entry.oracleIndependence === 'independent'
      );
      return {
        identityKey: test.identityKey,
        evidenceKind: strongestEvidenceKind(
          (independentEvidence.length > 0 ? independentEvidence : evidence).map(
            (entry) => entry.evidenceKind
          )
        ),
        oracleIndependence: independentEvidence.length > 0 ? 'independent' : 'dependent',
        targetRefs: Array.isArray(test.targetRefs) ? test.targetRefs : [],
      };
    })
    .filter(Boolean)
    .sort((left, right) => compareText(left.identityKey, right.identityKey));
}

function journeyStatus(journey, candidates) {
  if (journey.applicability === 'not_applicable') return 'not_applicable';
  const independent = candidates.filter(
    (candidate) => candidate.oracleIndependence === 'independent'
  );
  if (independent.some((candidate) => candidate.evidenceKind === 'direct')) return 'covered';
  if (independent.some((candidate) => candidate.evidenceKind === 'indirect')) {
    return 'indirectly_covered';
  }
  if (candidates.length > 0) return 'ambiguous';
  return 'missing_test';
}

function journeyGapReason(journey, status) {
  if (status === 'missing_test') return 'missing_complete_six_model_e2e';
  if (status === 'indirectly_covered' && journey.minimumEvidenceKind === 'direct') {
    return 'minimum_evidence_not_met';
  }
  if (status === 'ambiguous') return 'missing_independent_oracle';
  return null;
}

function projectJourneyRows({ policy, tests }) {
  return policy.semanticJourneys.map((journey) => {
    const candidates = journeyCandidates(tests, journey);
    const status = journeyStatus(journey, candidates);
    const eligible = candidates.filter(
      (candidate) =>
        candidate.oracleIndependence === 'independent' && candidate.evidenceKind !== 'ambiguous'
    );
    const selected = eligible.length > 0 ? [eligible[0]] : [];
    const row = {
      obligationId: `journey/${journey.journeyId}`,
      model: journey.model,
      transition: journey.transition,
      applicability: journey.applicability,
      minimumEvidenceKind: journey.minimumEvidenceKind,
      selectedTestIdentityRefs: selected.map((candidate) => candidate.identityKey),
      candidateTestIdentityRefs: candidates.map((candidate) => candidate.identityKey),
      directEvidenceKind: strongestEvidenceKind(
        selected.map((candidate) => candidate.evidenceKind)
      ),
      oracleIndependence:
        selected.length > 0 &&
        selected.every((candidate) => candidate.oracleIndependence === 'independent')
          ? 'independent'
          : 'unresolved',
      coverageStatus: status,
      gapReason: journeyGapReason(journey, status),
      affectedTargetRefs: stableUnique([
        ...journey.affectedTargetRefs,
        ...candidates.flatMap((candidate) => candidate.targetRefs),
      ]),
      remediationOwner: journey.remediationOwner,
      devHandoffRequired: false,
    };
    row.devHandoffRequired = row.applicability === 'applicable' && !effectiveCoverage(row);
    return row;
  });
}

function summarize(rows) {
  const applicable = rows.filter((row) => row.applicability === 'applicable');
  const effective = applicable.filter(effectiveCoverage);
  const count = (status) => applicable.filter((row) => row.coverageStatus === status).length;
  return {
    totalObligationCount: rows.length,
    applicableObligationCount: applicable.length,
    effectivelyCoveredObligationCount: effective.length,
    coveredObligationCount: count('covered'),
    indirectlyCoveredObligationCount: count('indirectly_covered'),
    ambiguousObligationCount: count('ambiguous'),
    missingTestObligationCount: count('missing_test'),
    targetUnresolvedObligationCount: count('target_unresolved'),
    productIncompatibleObligationCount: count('product_incompatible'),
    notApplicableObligationCount: rows.length - applicable.length,
    coverageBasisPoints:
      applicable.length === 0
        ? 10_000
        : Math.floor((effective.length * 10_000) / applicable.length),
  };
}

function buildSixModelCoverageGapReport({ catalog, coreFreeze, policy }) {
  if (!isObject(policy)) fail('SIX_MODEL_COVERAGE_POLICY_INVALID');
  validateSemanticJourneys(policy.semanticJourneys);
  if (!isObject(coreFreeze) || coreFreeze.schemaVersion !== 'test-portfolio-core-freeze/v2') {
    fail('SIX_MODEL_COVERAGE_CORE_FREEZE_INVALID');
  }
  const tests = catalogTests(catalog);
  const testsByIdentity = new Map(tests.map((test) => [test.identityKey, test]));
  const obligations = [
    ...projectAtomicRows({ coreFreeze, testsByIdentity }),
    ...projectJourneyRows({ policy, tests }),
  ].sort((left, right) => compareText(left.obligationId, right.obligationId));
  const report = {
    schemaVersion: 'six-model-coverage-gap-report/v1',
    obligations,
    summary: summarize(obligations),
    gates: {
      unmappedSixModelBehaviorCount: obligations.filter(
        (row) =>
          SIX_MODEL_NAMES.has(row.model) &&
          row.applicability === 'applicable' &&
          !effectiveCoverage(row)
      ).length,
      unmappedCriticalTransitionCount: obligations.filter(
        (row) =>
          row.obligationId.startsWith('journey/') &&
          row.applicability === 'applicable' &&
          !effectiveCoverage(row)
      ).length,
    },
    hashes: {
      catalogSha256: sha256Bytes(canonicalJsonBytes({ ...catalog, tests })),
      coreFreezeSha256: sha256Bytes(canonicalJsonBytes(coreFreeze)),
      policySha256: sha256Bytes(canonicalJsonBytes(policy)),
    },
  };
  return report;
}

function productOwnerForTargets(targetRefs) {
  const packageTarget = targetRefs.find((targetRef) => targetRef.startsWith('packages/'));
  if (packageTarget) return packageTarget.split('/').slice(0, 2).join('/');
  if (targetRefs.some((targetRef) => targetRef.startsWith('_bmad/shared/'))) {
    return '_bmad/shared';
  }
  if (targetRefs.some((targetRef) => targetRef.startsWith('scripts/'))) return 'scripts';
  return 'dev';
}

function catalogTestForSuiteName(tests, suiteName) {
  if (typeof suiteName !== 'string' || suiteName.trim() === '') {
    fail('DEV_REMEDIATION_TEST_REPORT_INVALID');
  }
  const normalized = suiteName.trim().replace(/\\/g, '/');
  const matches = tests.filter(
    (test) => normalized === test.testPath || normalized.endsWith(`/${test.testPath}`)
  );
  if (matches.length !== 1) {
    fail('DEV_REMEDIATION_TEST_PATH_UNRESOLVED', {
      suiteName: normalized,
      matchCount: matches.length,
    });
  }
  return matches[0];
}

function buildProductFailureRecords({
  testReport,
  catalog,
  requiredSelectionIdentityKeys = [],
  exactCommand,
  exitCode,
  changedProductPaths = [],
}) {
  if (
    !isObject(testReport) ||
    !Array.isArray(testReport.testResults) ||
    typeof exactCommand !== 'string' ||
    exactCommand.trim() === '' ||
    !Number.isSafeInteger(exitCode) ||
    exitCode === 0 ||
    !Array.isArray(requiredSelectionIdentityKeys) ||
    !Array.isArray(changedProductPaths)
  ) {
    fail('DEV_REMEDIATION_TEST_REPORT_INVALID');
  }
  const tests = catalogTests(catalog);
  const requiredIdentities = new Set(stableUnique(requiredSelectionIdentityKeys));
  const normalizedChangedPaths = stableUnique(
    changedProductPaths.map((value) => String(value).replace(/\\/g, '/'))
  );
  const records = [];
  for (const suite of testReport.testResults) {
    if (!isObject(suite) || !Array.isArray(suite.assertionResults)) {
      fail('DEV_REMEDIATION_TEST_REPORT_INVALID');
    }
    const test = catalogTestForSuiteName(tests, suite.name);
    const traceRefs = stableUnique(test.traceRefs || []);
    const capabilityRefs = stableUnique(test.capabilityRefs || []);
    const targetRefs = stableUnique(test.targetRefs || []);
    const modelRefs = stableUnique(
      traceRefs
        .map((traceRef) => coverageModel(traceRef))
        .filter((model) => SIX_MODEL_NAMES.has(model))
    );
    const transitionRefs = stableUnique(
      traceRefs
        .filter((traceRef) => SIX_MODEL_NAMES.has(coverageModel(traceRef)))
        .map(coverageTransition)
    );
    const affectedChangedPaths = normalizedChangedPaths.filter((changedPath) =>
      targetRefs.includes(changedPath)
    );
    for (const assertion of suite.assertionResults) {
      if (!isObject(assertion) || assertion.status !== 'failed') continue;
      const testCaseName =
        typeof assertion.fullName === 'string' && assertion.fullName.trim() !== ''
          ? assertion.fullName.trim()
          : typeof assertion.title === 'string' && assertion.title.trim() !== ''
            ? assertion.title.trim()
            : null;
      const failureMessages = Array.isArray(assertion.failureMessages)
        ? assertion.failureMessages
            .filter((message) => typeof message === 'string' && message.trim() !== '')
            .map((message) => message.trim())
        : [];
      if (!testCaseName || failureMessages.length === 0) {
        fail('DEV_REMEDIATION_TEST_REPORT_INVALID');
      }
      const failureSummary = failureMessages
        .join('\n')
        .split(/\r?\n/u)
        .find((line) => line.trim() !== '')
        ?.trim();
      records.push({
        itemKind: 'product_failure',
        obligationId: null,
        modelRefs,
        transitionRefs,
        capabilityRefs,
        traceRefs,
        testIdentity: test.identityKey,
        testPath: test.testPath,
        testCaseName,
        targetRefs,
        exactCommand: exactCommand.trim(),
        exitCode,
        failureFingerprint: sha256Bytes(
          canonicalJsonBytes({
            testIdentity: test.identityKey,
            testCaseName,
            failureMessages,
          })
        ),
        failureSummary: failureSummary || 'unknown failure',
        changedProductPaths: affectedChangedPaths,
        suspectedProductOwner: productOwnerForTargets(targetRefs),
        selectionRemainsRequired:
          requiredIdentities.has(test.identityKey) ||
          requiredIdentities.has(test.executableIdentity),
        blocksPortfolioCorrectness: false,
      });
    }
  }
  return records.sort((left, right) =>
    compareText(
      `${left.testIdentity}\0${left.testCaseName}`,
      `${right.testIdentity}\0${right.testCaseName}`
    )
  );
}

function hasExactKeys(value, keys) {
  return Object.keys(value).sort(compareText).join('\0') === [...keys].sort(compareText).join('\0');
}

function validateStringArray(value, code, { allowedValues } = {}) {
  if (!Array.isArray(value)) fail(code);
  const normalized = value.map((entry) => {
    if (typeof entry !== 'string' || entry.trim() === '') fail(code);
    const candidate = entry.trim();
    if (allowedValues && !allowedValues.has(candidate)) fail(code);
    return candidate;
  });
  if (
    new Set(normalized).size !== normalized.length ||
    normalized.some((entry, index) => index > 0 && compareText(normalized[index - 1], entry) > 0)
  ) {
    fail(code);
  }
  return normalized;
}

function validateRepoPath(value, code) {
  if (typeof value !== 'string' || value.trim() === '') fail(code);
  const candidate = value.trim().replace(/\\/gu, '/');
  if (
    /^[A-Za-z]:/u.test(candidate) ||
    path.posix.isAbsolute(candidate) ||
    candidate === '..' ||
    candidate.startsWith('../') ||
    candidate.includes('/../') ||
    path.posix.normalize(candidate) !== candidate
  ) {
    fail(code);
  }
  return candidate;
}

function validateProductFailureRecord(record) {
  const code = 'SIX_MODEL_COVERAGE_FAILURE_RECORD_INVALID';
  if (
    !isObject(record) ||
    !hasExactKeys(record, [
      'blocksPortfolioCorrectness',
      'capabilityRefs',
      'changedProductPaths',
      'exactCommand',
      'exitCode',
      'failureFingerprint',
      'failureSummary',
      'itemKind',
      'modelRefs',
      'obligationId',
      'selectionRemainsRequired',
      'suspectedProductOwner',
      'targetRefs',
      'testCaseName',
      'testIdentity',
      'testPath',
      'traceRefs',
      'transitionRefs',
    ]) ||
    record.itemKind !== 'product_failure' ||
    record.obligationId !== null ||
    typeof record.testIdentity !== 'string' ||
    record.testIdentity.trim() === '' ||
    typeof record.testCaseName !== 'string' ||
    record.testCaseName.trim() === '' ||
    typeof record.exactCommand !== 'string' ||
    record.exactCommand.trim() === '' ||
    !Number.isSafeInteger(record.exitCode) ||
    record.exitCode === 0 ||
    typeof record.failureFingerprint !== 'string' ||
    !SHA256_PATTERN.test(record.failureFingerprint) ||
    typeof record.failureSummary !== 'string' ||
    record.failureSummary.trim() === '' ||
    typeof record.suspectedProductOwner !== 'string' ||
    record.suspectedProductOwner.trim() === '' ||
    typeof record.selectionRemainsRequired !== 'boolean' ||
    record.blocksPortfolioCorrectness !== false
  ) {
    fail(code);
  }
  const modelRefs = validateStringArray(record.modelRefs, code, {
    allowedValues: SIX_MODEL_NAMES,
  });
  const transitionRefs = validateStringArray(record.transitionRefs, code);
  const capabilityRefs = validateStringArray(record.capabilityRefs, code);
  const traceRefs = validateStringArray(record.traceRefs, code);
  const targetRefs = validateStringArray(record.targetRefs, code).map((entry) =>
    validateRepoPath(entry, code)
  );
  const changedProductPaths = validateStringArray(record.changedProductPaths, code).map((entry) =>
    validateRepoPath(entry, code)
  );
  const testPath = validateRepoPath(record.testPath, code);
  if (changedProductPaths.some((changedPath) => !targetRefs.includes(changedPath))) {
    fail(code);
  }
  return {
    ...record,
    modelRefs,
    transitionRefs,
    capabilityRefs,
    traceRefs,
    targetRefs,
    testPath,
    changedProductPaths,
  };
}

function validateProductFailureRecordsWrapper({ wrapper, catalog, catalogSha256 }) {
  const wrapperCode = 'SIX_MODEL_COVERAGE_FAILURE_RECORDS_WRAPPER_INVALID';
  if (
    !isObject(wrapper) ||
    !hasExactKeys(wrapper, [
      'catalogSha256',
      'commitSha',
      'records',
      'runReceiptSha256',
      'schemaVersion',
      'selectionArtifacts',
      'summary',
      'testReportSha256',
    ]) ||
    wrapper.schemaVersion !== 'product-failure-records/v1' ||
    typeof wrapper.commitSha !== 'string' ||
    !COMMIT_SHA_PATTERN.test(wrapper.commitSha) ||
    typeof wrapper.catalogSha256 !== 'string' ||
    !SHA256_PATTERN.test(wrapper.catalogSha256) ||
    typeof wrapper.testReportSha256 !== 'string' ||
    !SHA256_PATTERN.test(wrapper.testReportSha256) ||
    typeof wrapper.runReceiptSha256 !== 'string' ||
    !SHA256_PATTERN.test(wrapper.runReceiptSha256) ||
    !Array.isArray(wrapper.selectionArtifacts) ||
    wrapper.selectionArtifacts.length === 0 ||
    !Array.isArray(wrapper.records) ||
    !isObject(wrapper.summary)
  ) {
    fail(wrapperCode);
  }
  const catalogCommit = catalog?.repository?.commit;
  if (
    typeof catalogCommit !== 'string' ||
    !COMMIT_SHA_PATTERN.test(catalogCommit) ||
    wrapper.commitSha !== catalogCommit
  ) {
    fail('SIX_MODEL_COVERAGE_FAILURE_RECORDS_COMMIT_MISMATCH');
  }
  if (wrapper.catalogSha256 !== catalogSha256) {
    fail('SIX_MODEL_COVERAGE_FAILURE_RECORDS_CATALOG_HASH_MISMATCH');
  }
  const selectionPaths = new Set();
  const selectionArtifacts = wrapper.selectionArtifacts.map((artifact) => {
    if (
      !isObject(artifact) ||
      !hasExactKeys(artifact, ['path', 'sha256']) ||
      typeof artifact.sha256 !== 'string' ||
      !SHA256_PATTERN.test(artifact.sha256)
    ) {
      fail(wrapperCode);
    }
    const artifactPath = validateRepoPath(artifact.path, wrapperCode);
    if (selectionPaths.has(artifactPath)) fail(wrapperCode);
    selectionPaths.add(artifactPath);
    return { path: artifactPath, sha256: artifact.sha256 };
  });
  if (
    selectionArtifacts.some(
      (artifact, index) =>
        index > 0 && compareText(selectionArtifacts[index - 1].path, artifact.path) > 0
    )
  ) {
    fail(wrapperCode);
  }
  const records = wrapper.records.map(validateProductFailureRecord);
  const recordKeys = records.map((record) => `${record.testIdentity}\0${record.testCaseName}`);
  if (
    new Set(recordKeys).size !== recordKeys.length ||
    recordKeys.some((key, index) => index > 0 && compareText(recordKeys[index - 1], key) > 0)
  ) {
    fail('SIX_MODEL_COVERAGE_FAILURE_RECORD_INVALID');
  }
  if (
    !hasExactKeys(wrapper.summary, [
      'portfolioBlockingCount',
      'recordCount',
      'requiredSelectionCount',
      'selectedFailureCount',
      'selectionArtifactCount',
    ]) ||
    Object.values(wrapper.summary).some(
      (value) => !Number.isSafeInteger(value) || value < 0
    ) ||
    wrapper.summary.recordCount !== records.length ||
    wrapper.summary.selectionArtifactCount !== selectionArtifacts.length ||
    wrapper.summary.selectedFailureCount !==
      records.filter((record) => record.selectionRemainsRequired).length ||
    wrapper.summary.portfolioBlockingCount !== 0
  ) {
    fail(wrapperCode);
  }
  return records;
}

function failureFingerprint(row) {
  if (row.gapReason === 'missing_complete_six_model_e2e') {
    return 'MISSING_COMPLETE_SIX_MODEL_E2E';
  }
  return `COVERAGE_GAP_${row.coverageStatus.toUpperCase()}`;
}

function buildDevRemediationHandoff({ coverageReport, failureRecords = [] }) {
  if (
    !isObject(coverageReport) ||
    !Array.isArray(coverageReport.obligations) ||
    !Array.isArray(failureRecords) ||
    failureRecords.some(
      (record) =>
        !isObject(record) ||
        record.itemKind !== 'product_failure' ||
        record.blocksPortfolioCorrectness !== false
    )
  ) {
    fail('DEV_REMEDIATION_COVERAGE_REPORT_INVALID');
  }
  const coverageItems = coverageReport.obligations
    .filter((row) => row.devHandoffRequired === true)
    .map((row) => ({
      itemKind: 'coverage_gap',
      obligationId: row.obligationId,
      modelRefs: [row.model],
      transitionRefs: [row.transition],
      testIdentity: row.candidateTestIdentityRefs[0] || null,
      testPath: null,
      targetRefs: row.affectedTargetRefs,
      exactCommand: null,
      exitCode: null,
      failureFingerprint: failureFingerprint(row),
      changedProductPaths: [],
      suspectedProductOwner: row.remediationOwner,
      selectionRemainsRequired: true,
      blocksPortfolioCorrectness: !row.obligationId.startsWith('journey/'),
    }));
  const items = [...coverageItems, ...failureRecords].sort((left, right) =>
    compareText(
      `${left.itemKind}\0${left.obligationId || ''}\0${left.testIdentity || ''}`,
      `${right.itemKind}\0${right.obligationId || ''}\0${right.testIdentity || ''}`
    )
  );
  return {
    schemaVersion: 'dev-remediation-handoff/v1',
    items,
    summary: {
      itemCount: items.length,
      coverageGapCount: coverageItems.length,
      productFailureCount: failureRecords.length,
    },
    coverageReportSha256: sha256Bytes(canonicalJsonBytes(coverageReport)),
  };
}

function readRepoJson(repoRoot, value, code) {
  const target = path.resolve(repoRoot, value);
  const relative = path.relative(path.resolve(repoRoot), target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(code);
  }
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function parseCliArgs(args) {
  const options = {
    policy: 'repo-governance/ci/test-policy.json',
    outputDir: '.artifacts/test-portfolio',
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      !['--catalog', '--core-freeze', '--policy', '--failure-records', '--output-dir'].includes(
        flag
      ) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('SIX_MODEL_COVERAGE_CLI_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  if (!options.catalog || !options['core-freeze']) {
    fail('SIX_MODEL_COVERAGE_CLI_ARGS_INVALID');
  }
  return options;
}

function main(args = process.argv.slice(2)) {
  const repoRoot = process.cwd();
  const options = parseCliArgs(args);
  const catalogReceipt = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options.catalog),
  });
  const catalog = catalogReceipt.artifact;
  const coreFreeze = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options['core-freeze']),
  }).artifact;
  const policy = readRepoJson(repoRoot, options.policy, 'SIX_MODEL_COVERAGE_POLICY_PATH_INVALID');
  validateTestPolicy(policy);
  const failureRecords = options['failure-records']
    ? validateProductFailureRecordsWrapper({
        wrapper: readCanonicalArtifact({
          repoRoot,
          filePath: path.resolve(repoRoot, options['failure-records']),
        }).artifact,
        catalog,
        catalogSha256: catalogReceipt.sha256,
      })
    : [];
  const report = buildSixModelCoverageGapReport({ catalog, coreFreeze, policy });
  const handoff = buildDevRemediationHandoff({ coverageReport: report, failureRecords });
  const reportReceipt = writeCanonicalArtifact({
    repoRoot,
    outputDir: options.outputDir,
    fileName: 'six-model-coverage-gap-report.json',
    artifact: report,
  });
  const handoffReceipt = writeCanonicalArtifact({
    repoRoot,
    outputDir: options.outputDir,
    fileName: 'dev-remediation-handoff.json',
    artifact: handoff,
  });
  process.stdout.write(
    `${JSON.stringify({
      report: reportReceipt,
      handoff: handoffReceipt,
      summary: report.summary,
      gates: report.gates,
    })}\n`
  );
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
  buildDevRemediationHandoff,
  buildProductFailureRecords,
  buildSixModelCoverageGapReport,
  main,
  parseCliArgs,
  validateProductFailureRecordsWrapper,
};
