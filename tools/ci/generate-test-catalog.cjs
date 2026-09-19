'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const { collectAuditFacts } = require('../test-portfolio-audit/facts.cjs');
const { compareText, fail, writeCanonicalArtifact } = require('./canonical-artifact.cjs');
const {
  isCanonicalNamespacedRef,
  isStableOracleEvidenceRef,
  readTestPolicy,
  STATES,
  validateTestPolicy,
} = require('./test-policy.cjs');
const { commandBindingsForTarget } = require('./test-command-bindings.cjs');

const GENERATED_PATH = '.artifacts/test-portfolio/test-catalog.json';
// The catalog records the complete retained inventory; PR runtime is governed
// by profile selection and shard budgets, not by deleting catalog entries.
const EXECUTABLE_TEST_BUDGET = 1200;
const POLICY_FIELDS = Object.freeze([
  'state',
  'packageId',
  'capabilityRefs',
  'traceRefs',
  'featureRefs',
  'fixtureRefs',
  'releaseGateMembership',
]);
const GATE_FAILURES = Object.freeze([
  ['catalogIdentityDuplicateCount', 'CATALOG_IDENTITY_DUPLICATE'],
  ['unexplainedRunnerOnlyCount', 'CATALOG_RUNNER_ONLY'],
  ['unexplainedCandidateOnlyCount', 'CATALOG_CANDIDATE_ONLY'],
  ['unclassifiedTestCount', 'CATALOG_TEST_UNCLASSIFIED'],
]);
const INTEGER_GATE_FIELDS = Object.freeze([
  'catalogIdentityDuplicateCount',
  'unexplainedRunnerOnlyCount',
  'unexplainedCandidateOnlyCount',
  'unclassifiedTestCount',
  'protectedCapabilityWithoutCoreTestCount',
  'executableTestCount',
  'executableTestBudget',
  'corePermanentCount',
  'reconciliationErrorCount',
]);
const EXECUTION_RUNNER_BY_AUDIT_RUNNER = Object.freeze({
  'root-vitest': 'vitest',
  vitest: 'vitest',
  'package-node-test': 'node',
  'node-test': 'node',
  node: 'node',
});
const DISCOVERY_COUNT_LIST_FIELDS = Object.freeze([
  ['runnerResolvedCount', 'runnerResolved'],
  ['candidateCount', 'candidates'],
  ['unexplainedRunnerOnlyCount', 'unexplainedRunnerOnly'],
  ['unexplainedCandidateOnlyCount', 'unexplainedCandidateOnly'],
]);
const MAX_TEST_TARGET_EXPANSION = 2_000;
const hasOwn = Object.prototype.hasOwnProperty;

function isObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwnDataProperty(record, field) {
  if (!isObject(record)) return false;
  const descriptor = Object.getOwnPropertyDescriptor(record, field);
  return Boolean(descriptor && hasOwn.call(descriptor, 'value'));
}

function ownDataValue(record, field) {
  if (!hasOwnDataProperty(record, field)) return undefined;
  return Object.getOwnPropertyDescriptor(record, field).value;
}

function normalizeRelativePath(value) {
  return path.posix.normalize(String(value || '').replace(/\\/g, '/')).replace(/^\.\//u, '');
}

function stableUnique(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))].sort(
    compareText
  );
}

function stableObjects(values) {
  const indexed = new Map();
  for (const value of values.filter(isObject)) {
    const key = canonicalJsonBytes(value).toString('utf8');
    indexed.set(key, { ...value });
  }
  return [...indexed.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, value]) => value);
}

function canonicalTestTargetPath(value) {
  const raw = value.trim();
  const slashPath = raw.replace(/\\/gu, '/');
  const normalized = path.posix.normalize(slashPath).replace(/^\.\//u, '');
  if (
    raw !== value ||
    slashPath !== raw ||
    normalized !== slashPath ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized) ||
    /^[A-Za-z]:\//u.test(normalized)
  ) {
    fail('CATALOG_TEST_TARGET_PATH_INVALID', { path: value });
  }
  return normalized;
}

function normalizedTestTargetRecord(record) {
  if (
    !isObject(record) ||
    typeof record.testPath !== 'string' ||
    record.testPath.trim() === '' ||
    typeof record.targetPath !== 'string' ||
    record.targetPath.trim() === ''
  ) {
    fail('CATALOG_TEST_TARGET_RECORD_INVALID');
  }
  const testPath = canonicalTestTargetPath(record.testPath);
  const targetPath = canonicalTestTargetPath(record.targetPath);
  const evidenceRef =
    typeof record.evidenceRef === 'string' && record.evidenceRef.trim() !== ''
      ? record.evidenceRef.trim()
      : `source:${testPath}#test-target:${targetPath}`;
  return { testPath, targetPath, evidenceRef };
}

function testTargetRecords(facts) {
  const sourceIndex = facts?.sourceIndex;
  const explicit = sourceIndex?.testTargetRecords;
  if (explicit !== undefined && !Array.isArray(explicit)) {
    fail('CATALOG_TEST_TARGET_RECORDS_INVALID');
  }
  const records = Array.isArray(explicit) ? explicit.map(normalizedTestTargetRecord) : [];
  if (sourceIndex?.testTargets instanceof Map) {
    for (const [testPath, targetPaths] of sourceIndex.testTargets.entries()) {
      if (!Array.isArray(targetPaths)) fail('CATALOG_TEST_TARGET_RECORDS_INVALID');
      for (const targetPath of targetPaths) {
        records.push(normalizedTestTargetRecord({ testPath, targetPath }));
      }
    }
  }
  return stableObjects(records);
}

function materializeCatalogFacts(facts) {
  if (!isObject(facts)) fail('CATALOG_FACTS_INVALID');
  const sourceIndex = isObject(facts.sourceIndex) ? { ...facts.sourceIndex } : {};
  delete sourceIndex.testTargets;
  sourceIndex.testTargetRecords = testTargetRecords(facts);
  return {
    ...facts,
    sourceIndex,
  };
}

function normalizedClassificationRecord(record) {
  const normalized = { ...record };
  if (Object.prototype.hasOwnProperty.call(normalized, 'pattern')) {
    normalized.pattern = normalizeRelativePath(normalized.pattern);
  }
  if (Object.prototype.hasOwnProperty.call(normalized, 'testPath')) {
    normalized.testPath = normalizeRelativePath(normalized.testPath);
  }
  for (const field of ['capabilityRefs', 'traceRefs', 'featureRefs', 'fixtureRefs']) {
    if (Array.isArray(normalized[field])) normalized[field] = stableUnique(normalized[field]);
  }
  return normalized;
}

function semanticPolicyForHash(policy) {
  return {
    ...policy,
    semanticEvidenceBindings: stableObjects(
      (policy.semanticEvidenceBindings || []).map((entry) => ({
        runnerId: entry.runnerId,
        testPath: normalizeRelativePath(entry.testPath),
        bindings: stableObjects(entry.bindings),
      }))
    ),
    protectedCapabilities: stableObjects(
      policy.protectedCapabilities.map((capability) => ({
        ...capability,
        selectionRefs: stableUnique(capability.selectionRefs),
      }))
    ),
    classification: {
      ...policy.classification,
      directoryRules: stableObjects(
        policy.classification.directoryRules.map(normalizedClassificationRecord)
      ),
      exceptions: stableObjects(
        policy.classification.exceptions.map(normalizedClassificationRecord)
      ),
    },
    selection: {
      ...policy.selection,
      highDiffusionPathRules: stableUnique(
        policy.selection.highDiffusionPathRules.map(normalizeRelativePath)
      ),
    },
    deletion: {
      ...policy.deletion,
      deterministicReasonCodes: stableUnique(policy.deletion.deterministicReasonCodes),
    },
  };
}

function catalogPolicyHash(policy) {
  validateTestPolicy(policy);
  return sha256Bytes(canonicalJsonBytes(semanticPolicyForHash(policy)));
}

function normalizedFactsHashValue(value) {
  if (Array.isArray(value)) {
    return value
      .map(normalizedFactsHashValue)
      .sort((left, right) =>
        compareText(
          canonicalJsonBytes(left).toString('utf8'),
          canonicalJsonBytes(right).toString('utf8')
        )
      );
  }
  if (isObject(value)) {
    const entries = [];
    for (const [key, entry] of Object.entries(value).sort(([left], [right]) =>
      compareText(left, right)
    )) {
      const normalized = normalizedFactsHashValue(entry);
      if (Array.isArray(normalized) && normalized.length === 0) continue;
      entries.push([key, normalized]);
    }
    return Object.fromEntries(entries);
  }
  return value;
}

function semanticFactsForHash(facts) {
  const materialized = materializeCatalogFacts(facts);
  const durations = isObject(materialized.durations) ? { ...materialized.durations } : undefined;
  const sourceIndex = isObject(materialized.sourceIndex) ? { ...materialized.sourceIndex } : {};
  if (durations) {
    delete durations.probeMs;
    delete durations.staticAnalysisMs;
    delete durations.totalMs;
  }
  delete sourceIndex.repoRoot;
  return {
    ...materialized,
    ...(durations ? { durations } : {}),
    sourceIndex,
  };
}

function catalogFactsHash(facts) {
  return sha256Bytes(canonicalJsonBytes(normalizedFactsHashValue(semanticFactsForHash(facts))));
}

function compareTestIdentity(left, right) {
  return compareText(
    `${left.identityKey || ''}\0${left.runnerId || ''}\0${left.testPath || ''}`,
    `${right.identityKey || ''}\0${right.runnerId || ''}\0${right.testPath || ''}`
  );
}

function canonicalExecutableIdentity(test) {
  const runnerId = ownDataValue(test, 'runnerId');
  const executionRunnerId = EXECUTION_RUNNER_BY_AUDIT_RUNNER[runnerId];
  if (!executionRunnerId) {
    fail('CATALOG_EXECUTION_RUNNER_UNSUPPORTED', {
      identityKey: ownDataValue(test, 'identityKey'),
      runnerId,
    });
  }
  const testPath = normalizeRelativePath(ownDataValue(test, 'testPath'));
  const expected = `${executionRunnerId}::${testPath}`;
  const supplied = ownDataValue(test, 'executableIdentity');
  if (supplied !== undefined && supplied !== expected) {
    fail('CATALOG_EXECUTABLE_IDENTITY_MISMATCH', {
      identityKey: ownDataValue(test, 'identityKey'),
      expected,
      actual: supplied,
    });
  }
  return expected;
}

function indexAnalyzerFindings(analyzerResults) {
  const byIdentity = new Map();
  for (const result of Array.isArray(analyzerResults) ? analyzerResults : []) {
    const dimension = result?.dimension || result?.analyzerId;
    if (typeof dimension !== 'string') continue;
    for (const finding of Array.isArray(result.findings) ? result.findings : []) {
      if (!isObject(finding) || typeof finding.identityKey !== 'string') continue;
      if (!byIdentity.has(finding.identityKey)) byIdentity.set(finding.identityKey, new Map());
      const dimensions = byIdentity.get(finding.identityKey);
      if (!dimensions.has(dimension)) dimensions.set(dimension, []);
      dimensions.get(dimension).push(finding);
    }
  }
  for (const dimensions of byIdentity.values()) {
    for (const findings of dimensions.values()) {
      findings.sort((left, right) =>
        compareText(
          canonicalJsonBytes(left).toString('utf8'),
          canonicalJsonBytes(right).toString('utf8')
        )
      );
    }
  }
  return byIdentity;
}

function indexCriticalBindings(analyzerResults) {
  const indexed = new Map();
  for (const result of Array.isArray(analyzerResults) ? analyzerResults : []) {
    if (result?.dimension !== 'criticality') continue;
    for (const finding of Array.isArray(result.findings) ? result.findings : []) {
      if (!isObject(finding) || typeof finding.identityKey !== 'string') continue;
      const bindings = Array.isArray(finding.bindings) ? finding.bindings : [];
      for (const binding of bindings) {
        if (
          !isObject(binding) ||
          typeof binding.kind !== 'string' ||
          binding.kind.trim() === '' ||
          !isCanonicalNamespacedRef(binding.evidenceRef, 'source') ||
          (Object.prototype.hasOwnProperty.call(binding, 'selectionRef') &&
            !isCanonicalNamespacedRef(binding.selectionRef, 'script'))
        ) {
          fail('CATALOG_CRITICAL_BINDING_INVALID', { identityKey: finding.identityKey });
        }
      }
      if (!indexed.has(finding.identityKey)) {
        indexed.set(finding.identityKey, {
          bindings: [],
          evidenceRefs: [],
          releaseGateMembership: [],
        });
      }
      const entry = indexed.get(finding.identityKey);
      if (finding.value === 'critical' && finding.confidence === 'high') {
        entry.bindings.push(...bindings);
      }
      entry.evidenceRefs.push(...(Array.isArray(finding.evidenceRefs) ? finding.evidenceRefs : []));
      if (typeof finding.releaseGateMembership === 'string') {
        entry.releaseGateMembership.push(finding.releaseGateMembership);
      }
    }
  }
  for (const entry of indexed.values()) {
    entry.bindings = stableObjects(entry.bindings);
    entry.evidenceRefs = stableUnique([
      ...entry.evidenceRefs,
      ...entry.bindings.map((binding) => binding.evidenceRef),
    ]);
    entry.releaseGateMembership = selectReleaseMembership(entry.releaseGateMembership);
  }
  return indexed;
}

function selectReleaseMembership(values) {
  const memberships = new Set(values);
  if (memberships.has('mixed')) return 'mixed';
  if (memberships.has('explicit') && memberships.has('inherited')) return 'mixed';
  if (memberships.has('explicit')) return 'explicit';
  if (memberships.has('inherited')) return 'inherited';
  return 'none';
}

function matchesDirectoryRule(testPath, pattern) {
  const normalized = normalizeRelativePath(pattern);
  if (!normalized.endsWith('/**')) return false;
  const base = normalized.slice(0, -3).replace(/\/+$/u, '');
  return testPath === base || testPath.startsWith(`${base}/`);
}

function copyPolicyFields(record) {
  const fields = {};
  for (const field of POLICY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(record, field)) fields[field] = record[field];
  }
  return fields;
}

function resolvePolicyFields(identity, policy) {
  const testPath = normalizeRelativePath(identity.testPath);
  const rules = policy.classification.directoryRules
    .filter((rule) => matchesDirectoryRule(testPath, rule.pattern))
    .sort((left, right) => {
      const leftSpecificity = normalizeRelativePath(left.pattern).split('/').length;
      const rightSpecificity = normalizeRelativePath(right.pattern).split('/').length;
      if (leftSpecificity !== rightSpecificity) return rightSpecificity - leftSpecificity;
      return compareText(left.ruleId, right.ruleId);
    });
  const selectedRule = rules[0];
  const fields = selectedRule ? copyPolicyFields(selectedRule) : {};
  let stateAuthority = selectedRule
    ? { kind: 'directory_rule', refs: [selectedRule.ruleId] }
    : undefined;

  const exceptions = policy.classification.exceptions
    .filter((entry) => normalizeRelativePath(entry.testPath) === testPath)
    .sort((left, right) =>
      compareText(
        canonicalJsonBytes(left).toString('utf8'),
        canonicalJsonBytes(right).toString('utf8')
      )
    );
  for (const exception of exceptions) {
    Object.assign(fields, copyPolicyFields(exception));
    if (Object.prototype.hasOwnProperty.call(exception, 'state')) {
      stateAuthority = { kind: 'policy_exception', refs: [testPath] };
    }
  }
  return { fields, stateAuthority };
}

function protectedCapabilityRefs(criticalBindings, projectedBehaviorEvidence, policy) {
  const bindingRefs = new Set(
    criticalBindings
      .map((binding) => binding.selectionRef)
      .filter((selectionRef) => typeof selectionRef === 'string' && selectionRef.length > 0)
  );
  return stableUnique(
    policy.protectedCapabilities
      .filter(
        (capability) =>
          capability.selectionRefs.some((selectionRef) => bindingRefs.has(selectionRef)) ||
          (capability.bindTestsBySurvivalEvidence === true &&
            capability.survivalEvidenceRefs.some(
              (evidenceRef) => projectedBehaviorEvidence[evidenceRef] === 'direct'
            ))
      )
      .map((capability) => capability.capabilityId)
  );
}

function analyzerTargetEvidence(dimensions, additionalTargetRefs = []) {
  const targetEvidence = new Map();
  for (const finding of dimensions?.get('targetValidity') || []) {
    if (typeof finding.targetRef !== 'string' || finding.targetRef.trim() === '') continue;
    const targetRef = normalizeRelativePath(finding.targetRef);
    const registeredCommand = commandBindingsForTarget(targetRef).length > 0;
    const evidenceKind =
      registeredCommand || finding.value === 'active'
        ? 'direct'
        : finding.value === 'ambiguous'
          ? 'ambiguous'
          : null;
    if (!evidenceKind) continue;
    const current = targetEvidence.get(targetRef);
    if (current === 'ambiguous' || evidenceKind === 'ambiguous') {
      targetEvidence.set(targetRef, 'ambiguous');
    } else {
      targetEvidence.set(targetRef, evidenceKind);
    }
  }
  for (const targetRef of additionalTargetRefs) {
    targetEvidence.set(normalizeRelativePath(targetRef), 'direct');
  }
  return targetEvidence;
}

function indexTestTargetRecords(facts) {
  const recordsByTestPath = new Map();
  for (const record of testTargetRecords(facts)) {
    if (!recordsByTestPath.has(record.testPath)) recordsByTestPath.set(record.testPath, []);
    recordsByTestPath.get(record.testPath).push(record);
  }
  return recordsByTestPath;
}

function testTargetOwnership(recordsByTestPath, testPath, executableTestPaths) {
  const fixtureRefs = [];
  const commandTargetRefs = [];
  const evidenceRefs = [];
  const visited = new Set();
  const queue = [...(recordsByTestPath.get(normalizeRelativePath(testPath)) || [])];
  while (queue.length > 0) {
    const record = queue.shift();
    const targetPath = record.targetPath;
    const visitKey = `${record.testPath}\0${targetPath}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    if (visited.size > MAX_TEST_TARGET_EXPANSION) {
      fail('CATALOG_TEST_TARGET_EXPANSION_LIMIT', {
        testPath,
        limit: MAX_TEST_TARGET_EXPANSION,
      });
    }
    evidenceRefs.push(record.evidenceRef);
    if (commandBindingsForTarget(targetPath).length > 0) {
      commandTargetRefs.push(targetPath);
    }
    if (targetPath.startsWith('tests/') && !executableTestPaths.has(targetPath)) {
      fixtureRefs.push(targetPath);
      queue.push(...(recordsByTestPath.get(targetPath) || []));
    }
  }
  return {
    fixtureRefs: stableUnique(fixtureRefs),
    commandTargetRefs: stableUnique(commandTargetRefs),
    evidenceRefs: stableUnique(evidenceRefs),
  };
}

function criticalSelectionRefs(criticalBindings) {
  return stableUnique(
    criticalBindings
      .map((binding) => binding.selectionRef)
      .filter((selectionRef) => typeof selectionRef === 'string' && selectionRef.length > 0)
  );
}

function semanticEvidenceBindingKey(runnerId, testPath) {
  return `${runnerId}\0${normalizeRelativePath(testPath)}`;
}

function indexSemanticEvidenceBindings(policy) {
  return new Map(
    (policy.semanticEvidenceBindings || []).map((entry) => [
      semanticEvidenceBindingKey(entry.runnerId, entry.testPath),
      stableObjects(entry.bindings),
    ])
  );
}

function behaviorEvidence({
  dimensions,
  criticalBindings,
  semanticBindings = [],
  additionalTargetRefs = [],
}) {
  const entries = new Map();
  const add = (evidenceRef, evidenceKind) => {
    const current = entries.get(evidenceRef);
    if (current === 'ambiguous' || evidenceKind === 'ambiguous') {
      entries.set(evidenceRef, 'ambiguous');
    } else if (evidenceKind === 'direct' || current === undefined) {
      entries.set(evidenceRef, evidenceKind);
    }
  };
  for (const selectionRef of criticalSelectionRefs(criticalBindings)) {
    add(`selection:${selectionRef}`, 'direct');
  }
  for (const [targetRef, evidenceKind] of analyzerTargetEvidence(
    dimensions,
    additionalTargetRefs
  )) {
    add(`target:${targetRef}`, evidenceKind);
  }
  for (const binding of semanticBindings) {
    add(binding.evidenceRef, binding.evidenceKind);
  }
  return Object.fromEntries(
    [...entries.entries()].sort(([left], [right]) => compareText(left, right))
  );
}

function behaviorOracleAuthority({ dimensions, semanticBindings = [] }) {
  const analyzerRefs = new Set(analyzerEvidenceRefs(dimensions));
  const entries = [];
  for (const binding of semanticBindings) {
    if (!isObject(binding.oracleAuthority)) continue;
    const evidenceRefs = stableUnique(binding.oracleAuthority.evidenceRefs || []);
    const unresolvedRefs = evidenceRefs.filter((evidenceRef) => !analyzerRefs.has(evidenceRef));
    if (unresolvedRefs.length > 0) {
      fail('CATALOG_SEMANTIC_ORACLE_EVIDENCE_UNRESOLVED', {
        evidenceRef: binding.evidenceRef,
        unresolvedRefs,
      });
    }
    entries.push([
      binding.evidenceRef,
      {
        evidenceRefs,
        oracleIndependence: binding.oracleAuthority.independence,
      },
    ]);
  }
  return Object.fromEntries(entries.sort(([left], [right]) => compareText(left, right)));
}

function featureBindingRefs(featureBindings, identity) {
  const binding = featureBindings?.[identity.identityKey] ?? featureBindings?.[identity.testPath];
  if (binding === undefined || binding === null) return [];
  if (typeof binding === 'string') return stableUnique([binding]);
  if (Array.isArray(binding)) return stableUnique(binding);
  if (!isObject(binding) || binding.active !== true) return [];
  const refs = [
    ...(Array.isArray(binding.featureRefs) ? binding.featureRefs : []),
    ...(typeof binding.featureRef === 'string' ? [binding.featureRef] : []),
  ];
  if (refs.length === 0) fail('CATALOG_ACTIVE_FEATURE_BINDING_INVALID');
  return stableUnique(refs);
}

function normalizedCandidate(reasonCode, dimension, finding) {
  const evidenceRefs = stableUnique(finding.evidenceRefs || []);
  const semanticFields = {
    reasonCode,
    dimension,
    identityKey: finding.identityKey || '',
    value: finding.value || '',
    confidence: finding.confidence || '',
    targetRef: finding.targetRef || '',
    evidenceRole: finding.evidenceRole || '',
    approved: finding.approved === true,
    deterministicReasonCode: finding.deterministicReasonCode || '',
    bindings: stableObjects(finding.bindings || []),
    evidenceRefs,
    issueCodes: stableUnique(finding.issueCodes || []),
    claimedRoles: stableUnique(finding.claimedRoles || []),
    executionRouteRefs: stableUnique(finding.executionRouteRefs || []),
  };
  return {
    reasonCode,
    evidenceRefs,
    sortKey: canonicalJsonBytes(semanticFields).toString('utf8'),
  };
}

function deterministicCandidate(dimensions, policy) {
  const candidates = [];
  for (const finding of dimensions?.get('executionMultiplicity') || []) {
    if (
      finding.value === 'duplicate' &&
      finding.confidence === 'high' &&
      finding.approved === true &&
      (finding.issueCodes || []).includes('DUPLICATE_EFFECTIVE_EXECUTION')
    ) {
      candidates.push(normalizedCandidate('EXACT_DUPLICATE', 'executionMultiplicity', finding));
    }
  }
  for (const finding of dimensions?.get('targetValidity') || []) {
    if (
      finding.value === 'obsolete_candidate' &&
      finding.confidence === 'high' &&
      finding.approved === true
    ) {
      candidates.push(normalizedCandidate('TARGET_REMOVED', 'targetValidity', finding));
    }
  }
  for (const finding of dimensions?.get('oracleEffectiveness') || []) {
    if (
      finding.value === 'ineffective_candidate' &&
      finding.approved === true &&
      (finding.issueCodes || []).includes('ORACLE_SELF_GENERATED_EXPECTED')
    ) {
      candidates.push(normalizedCandidate('SELF_PROVING_ORACLE', 'oracleEffectiveness', finding));
    }
  }
  for (const [dimension, findings] of dimensions?.entries() || []) {
    for (const finding of findings) {
      if (finding.approved === true && typeof finding.deterministicReasonCode === 'string') {
        candidates.push(normalizedCandidate(finding.deterministicReasonCode, dimension, finding));
      }
    }
  }
  return candidates
    .filter((candidate) => policy.deletion.deterministicReasonCodes.includes(candidate.reasonCode))
    .sort((left, right) => {
      const reasonOrder = compareText(left.reasonCode, right.reasonCode);
      return reasonOrder !== 0 ? reasonOrder : compareText(left.sortKey, right.sortKey);
    })[0];
}

function analyzerClassifications(dimensions, criticalBindings) {
  const classifications = {};
  for (const [dimension, findings] of [...(dimensions?.entries() || [])].sort(([left], [right]) =>
    compareText(left, right)
  )) {
    const values = stableUnique(findings.map((finding) => finding.value));
    if (values.length > 0) classifications[dimension] = values.length === 1 ? values[0] : values;
  }
  classifications.criticalBindings = criticalBindings;
  classifications.analyzerIssueCodes = stableUnique(
    [...(dimensions?.values() || [])].flatMap((findings) =>
      findings.flatMap((finding) => finding.issueCodes || [])
    )
  );
  return classifications;
}

function analyzerEvidenceRefs(dimensions) {
  return stableUnique(
    [...(dimensions?.values() || [])].flatMap((findings) =>
      findings.flatMap((finding) => finding.evidenceRefs || [])
    )
  );
}

function durationSummary(identityKey, facts, policy) {
  const observed = facts.timings?.[identityKey];
  if (typeof observed === 'number' && Number.isFinite(observed) && observed >= 0) {
    return { durationMs: Math.round(observed), source: 'observed' };
  }
  if (isObject(observed)) return { ...observed };
  return { durationMs: policy.timing.unknownDurationMs, source: 'policy_default' };
}

function inferPackageId(identity, policyFields) {
  if (typeof policyFields.packageId === 'string') return policyFields.packageId;
  if (typeof identity.packageId === 'string') return identity.packageId;
  const segments = normalizeRelativePath(identity.testPath).split('/');
  return segments[0] === 'packages' && segments[1] ? `packages/${segments[1]}` : 'root';
}

function lifecycleResolution({
  identity,
  changed,
  activeFeatureRefs,
  candidate,
  policyFields,
  stateAuthority,
}) {
  if (changed.has(identity.testPath) || changed.has(identity.identityKey)) {
    return {
      lifecycleState: 'feature_working_set',
      lifecycleReason: { kind: 'changed_test', refs: [identity.testPath] },
    };
  }
  if (activeFeatureRefs.length > 0) {
    return {
      lifecycleState: 'feature_working_set',
      lifecycleReason: { kind: 'active_feature_binding', refs: activeFeatureRefs },
    };
  }
  if (candidate) {
    return {
      lifecycleState: 'deletion_candidate',
      lifecycleReason: {
        kind: 'approved_deterministic_candidate',
        reasonCode: candidate.reasonCode,
        refs: stableUnique(candidate.evidenceRefs),
      },
    };
  }
  if (['retained_on_demand', 'deletion_candidate'].includes(policyFields.state)) {
    return {
      lifecycleState: policyFields.state,
      lifecycleReason: stateAuthority,
    };
  }
  return { lifecycleState: undefined, lifecycleReason: undefined };
}

function duplicateIdentityCount(tests) {
  const counts = new Map();
  for (const test of tests) counts.set(test.identityKey, (counts.get(test.identityKey) || 0) + 1);
  return [...counts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
}

function validateDiscoveryFacts(discovery) {
  if (!isObject(discovery)) fail('CATALOG_FACTS_INVALID', { field: 'discovery' });
  if (discovery.complete !== true) {
    fail('CATALOG_FACTS_INVALID', { field: 'discovery.complete' });
  }
  for (const [countField, listField] of DISCOVERY_COUNT_LIST_FIELDS) {
    const count = discovery[countField];
    const list = discovery[listField];
    if (
      !Number.isSafeInteger(count) ||
      count < 0 ||
      !Array.isArray(list) ||
      list.some((entry) => typeof entry !== 'string' || entry.length === 0) ||
      count !== list.length
    ) {
      fail('CATALOG_FACTS_INVALID', { field: `discovery.${countField}` });
    }
  }
  return discovery;
}

function calculateCatalogGates(facts, tests, policy) {
  const protectedCapabilities = policy.protectedCapabilities.map(
    (capability) => capability.capabilityId
  );
  const missingProtected = protectedCapabilities.filter(
    (capabilityRef) =>
      !tests.some((test) => test.classifications.protectedCapabilityRefs.includes(capabilityRef))
  );
  const unexplainedRunnerOnlyCount = facts.discovery.unexplainedRunnerOnlyCount;
  const unexplainedCandidateOnlyCount = facts.discovery.unexplainedCandidateOnlyCount;
  return {
    catalogIdentityDuplicateCount: duplicateIdentityCount(tests),
    unexplainedRunnerOnlyCount,
    unexplainedCandidateOnlyCount,
    unclassifiedTestCount: tests.filter((test) => !test.lifecycleState).length,
    protectedCapabilityWithoutCoreTestCount: missingProtected.length,
    executableTestCount: tests.length,
    executableTestBudget: EXECUTABLE_TEST_BUDGET,
    executableBudgetStatus: tests.length > EXECUTABLE_TEST_BUDGET ? 'over_budget' : 'within_budget',
    corePermanentCount: 0,
    reconciliationErrorCount:
      unexplainedRunnerOnlyCount + unexplainedCandidateOnlyCount + duplicateIdentityCount(tests),
  };
}

function assertGeneratedPath(generatedPath) {
  if (generatedPath === GENERATED_PATH) return;
  const normalized = normalizeRelativePath(generatedPath);
  const governedRoot = '.artifacts/test-portfolio';
  const isGovernedPath =
    typeof generatedPath === 'string' &&
    !path.posix.isAbsolute(normalized) &&
    !/^[A-Za-z]:\//u.test(normalized) &&
    (normalized === governedRoot || normalized.startsWith(`${governedRoot}/`));
  fail(isGovernedPath ? 'CATALOG_GENERATED_PATH_INVALID' : 'CATALOG_GENERATED_PATH_OUTSIDE_ROOT', {
    generatedPath,
  });
}

function assertRequiredRefArray(test, field, issueCode) {
  const refs = ownDataValue(test, field);
  if (
    !Array.isArray(refs) ||
    refs.some((ref) => typeof ref !== 'string' || ref.trim().length === 0) ||
    new Set(refs).size !== refs.length
  ) {
    fail(issueCode, { identityKey: test.identityKey });
  }
}

function assertRequiredTestFields(test) {
  for (const field of ['identityKey', 'runnerId', 'testPath', 'executableIdentity', 'packageId']) {
    const value = ownDataValue(test, field);
    if (typeof value !== 'string' || value.length === 0) {
      fail('CATALOG_TEST_FIELD_MISSING', {
        field,
        identityKey: ownDataValue(test, 'identityKey'),
      });
    }
  }
  for (const field of [
    'capabilityRefs',
    'failureModeRefs',
    'selectionRefs',
    'targetRefs',
    'traceRefs',
    'featureRefs',
    'fixtureRefs',
    'evidenceRefs',
  ]) {
    if (!Array.isArray(ownDataValue(test, field))) {
      fail('CATALOG_TEST_FIELD_MISSING', {
        field,
        identityKey: ownDataValue(test, 'identityKey'),
      });
    }
  }
  if (!hasOwnDataProperty(test, 'lifecycleState')) {
    fail('CATALOG_TEST_FIELD_MISSING', {
      field: 'lifecycleState',
      identityKey: ownDataValue(test, 'identityKey'),
    });
  }
  assertRequiredRefArray(test, 'capabilityRefs', 'CATALOG_CAPABILITY_REFS_INVALID');
  assertRequiredRefArray(test, 'failureModeRefs', 'CATALOG_FAILURE_MODE_REFS_INVALID');
  assertRequiredRefArray(test, 'selectionRefs', 'CATALOG_SELECTION_REFS_INVALID');
  assertRequiredRefArray(test, 'targetRefs', 'CATALOG_TARGET_REFS_INVALID');
  if (
    !isObject(ownDataValue(test, 'durationSummary')) ||
    !isObject(ownDataValue(test, 'classifications')) ||
    !isObject(ownDataValue(test, 'behaviorEvidence')) ||
    !isObject(ownDataValue(test, 'behaviorOracleAuthority'))
  ) {
    fail('CATALOG_TEST_FIELD_MISSING', { identityKey: ownDataValue(test, 'identityKey') });
  }
  for (const [evidenceRef, evidenceKind] of Object.entries(
    ownDataValue(test, 'behaviorEvidence')
  )) {
    if (
      typeof evidenceRef !== 'string' ||
      evidenceRef.trim() === '' ||
      !['direct', 'indirect', 'ambiguous'].includes(evidenceKind)
    ) {
      fail('CATALOG_BEHAVIOR_EVIDENCE_INVALID', {
        identityKey: ownDataValue(test, 'identityKey'),
      });
    }
  }
  for (const [evidenceRef, authority] of Object.entries(
    ownDataValue(test, 'behaviorOracleAuthority')
  )) {
    if (
      !hasOwn.call(ownDataValue(test, 'behaviorEvidence'), evidenceRef) ||
      !isObject(authority) ||
      ownDataValue(authority, 'oracleIndependence') !== 'independent' ||
      !Array.isArray(ownDataValue(authority, 'evidenceRefs')) ||
      ownDataValue(authority, 'evidenceRefs').length === 0 ||
      ownDataValue(authority, 'evidenceRefs').some(
        (ref) => !isStableOracleEvidenceRef(ref, ownDataValue(test, 'testPath'))
      )
    ) {
      fail('CATALOG_BEHAVIOR_ORACLE_AUTHORITY_INVALID', {
        identityKey: ownDataValue(test, 'identityKey'),
        evidenceRef,
      });
    }
  }
  if (typeof ownDataValue(test, 'releaseGateMembership') !== 'string') {
    fail('CATALOG_TEST_FIELD_MISSING', {
      field: 'releaseGateMembership',
      identityKey: ownDataValue(test, 'identityKey'),
    });
  }
}

function requireIntegerGate(gates, field) {
  const value = ownDataValue(gates, field);
  if (!hasOwnDataProperty(gates, field) || !Number.isSafeInteger(value) || value < 0) {
    fail('CATALOG_GATE_INVALID', { field, value });
  }
  return value;
}

function assertInventoryIdentity(identity, index) {
  if (!isObject(identity)) {
    fail('CATALOG_FACTS_INVALID', { index });
  }
  const optionalFieldInvalid = (field, validate) => {
    if (!(field in identity)) return false;
    if (!hasOwnDataProperty(identity, field)) return true;
    return !validate(ownDataValue(identity, field));
  };
  const validRefArray = (refs) =>
    Array.isArray(refs) &&
    refs.every((ref) => typeof ref === 'string' && ref.trim().length > 0) &&
    new Set(refs).size === refs.length;
  if (
    !['identityKey', 'runnerId', 'testPath'].every((field) => {
      const value = ownDataValue(identity, field);
      return typeof value === 'string' && value.length > 0;
    }) ||
    optionalFieldInvalid(
      'executableIdentity',
      (value) => typeof value === 'string' && value.length > 0
    ) ||
    optionalFieldInvalid('evidenceRefs', validRefArray) ||
    optionalFieldInvalid('capabilityRefs', validRefArray) ||
    optionalFieldInvalid('failureModeRefs', validRefArray)
  ) {
    fail('CATALOG_FACTS_INVALID', { index });
  }
}

function validateTestCatalog(catalog) {
  if (
    !isObject(catalog) ||
    !hasOwnDataProperty(catalog, 'schemaVersion') ||
    ownDataValue(catalog, 'schemaVersion') !== 'test-catalog/v1'
  ) {
    fail('CATALOG_SCHEMA_VERSION_INVALID');
  }
  if (
    !hasOwnDataProperty(catalog, 'repository') ||
    !isObject(ownDataValue(catalog, 'repository')) ||
    !hasOwnDataProperty(catalog, 'policyHash') ||
    typeof ownDataValue(catalog, 'policyHash') !== 'string' ||
    ownDataValue(catalog, 'policyHash').length === 0 ||
    !hasOwnDataProperty(catalog, 'factsHash') ||
    !/^sha256:[a-f0-9]{64}$/u.test(ownDataValue(catalog, 'factsHash'))
  ) {
    fail('CATALOG_SCHEMA_INVALID');
  }
  if (!hasOwnDataProperty(catalog, 'generatedPath')) {
    fail('CATALOG_SCHEMA_INVALID');
  }
  assertGeneratedPath(ownDataValue(catalog, 'generatedPath'));
  if (
    !hasOwnDataProperty(catalog, 'tests') ||
    !hasOwnDataProperty(catalog, 'gates') ||
    !Array.isArray(ownDataValue(catalog, 'tests')) ||
    !isObject(ownDataValue(catalog, 'gates'))
  ) {
    fail('CATALOG_SCHEMA_INVALID');
  }
  const tests = ownDataValue(catalog, 'tests');
  const gates = ownDataValue(catalog, 'gates');
  for (const field of INTEGER_GATE_FIELDS) requireIntegerGate(catalog.gates, field);
  if (!hasOwnDataProperty(gates, 'executableBudgetStatus')) {
    fail('CATALOG_GATE_INVALID', { field: 'executableBudgetStatus' });
  }
  for (const [index, test] of tests.entries()) {
    if (!isObject(test)) fail('CATALOG_TEST_FIELD_MISSING', { index });
    assertRequiredTestFields(test);
    canonicalExecutableIdentity(test);
  }

  for (const [gate, code] of GATE_FAILURES) {
    if (gates[gate] !== 0) fail(code, { count: gates[gate] });
  }
  const actualDuplicateCount = duplicateIdentityCount(tests);
  if (actualDuplicateCount > 0) fail('CATALOG_IDENTITY_DUPLICATE');

  for (const test of tests) {
    if (Array.isArray(test.lifecycleState) && test.lifecycleState.length > 1) {
      fail('CATALOG_LIFECYCLE_STATE_MULTIPLE', { identityKey: test.identityKey });
    }
    if (test.lifecycleState === undefined || test.lifecycleState === null) {
      fail('CATALOG_TEST_UNCLASSIFIED', { identityKey: test.identityKey });
    }
    if (typeof test.lifecycleState !== 'string' || !STATES.includes(test.lifecycleState)) {
      fail('CATALOG_LIFECYCLE_STATE_UNKNOWN', {
        identityKey: test.identityKey,
        lifecycleState: test.lifecycleState,
      });
    }
    if (test.lifecycleState === 'core_permanent') {
      fail('CATALOG_STATIC_CORE_FORBIDDEN', { identityKey: test.identityKey });
    }
    if (test.lifecycleState === 'feature_working_set') {
      const reason = test.classifications.lifecycleReason;
      if (
        !isObject(reason) ||
        !['changed_test', 'active_feature_binding'].includes(reason.kind) ||
        !Array.isArray(reason.refs) ||
        reason.refs.length === 0
      ) {
        fail('CATALOG_FEATURE_AUTHORITY_MISSING', { identityKey: test.identityKey });
      }
    }
  }

  const actualCounts = {
    catalogIdentityDuplicateCount: actualDuplicateCount,
    unclassifiedTestCount: tests.filter((test) => !test.lifecycleState).length,
    executableTestCount: tests.length,
    corePermanentCount: tests.filter((test) => test.lifecycleState === 'core_permanent').length,
    reconciliationErrorCount:
      gates.unexplainedRunnerOnlyCount + gates.unexplainedCandidateOnlyCount + actualDuplicateCount,
  };
  for (const [field, actual] of Object.entries(actualCounts)) {
    if (gates[field] !== actual) {
      fail('CATALOG_GATE_COUNT_MISMATCH', {
        field,
        expected: actual,
        actual: gates[field],
      });
    }
  }
  if (gates.executableTestBudget !== EXECUTABLE_TEST_BUDGET) {
    fail('CATALOG_EXECUTABLE_BUDGET_INVALID');
  }
  const expectedBudgetStatus =
    tests.length > EXECUTABLE_TEST_BUDGET ? 'over_budget' : 'within_budget';
  if (gates.executableBudgetStatus !== expectedBudgetStatus) {
    fail('CATALOG_EXECUTABLE_BUDGET_STATUS_INVALID');
  }
  return catalog;
}

function validateCatalogAuthority({
  catalog,
  facts,
  policy,
  errorCode = 'CATALOG_AUTHORITY_MISMATCH',
}) {
  facts = materializeCatalogFacts(facts);
  validateTestPolicy(policy);
  validateTestCatalog(catalog);
  if (!isObject(facts) || catalog.factsHash !== catalogFactsHash(facts)) {
    fail(errorCode, { reason: 'facts_hash_mismatch' });
  }
  if (canonicalJsonBytes(catalog.repository).compare(canonicalJsonBytes(facts.repository)) !== 0) {
    fail(errorCode, { reason: 'repository_mismatch' });
  }

  const inventoryIdentities = Array.isArray(facts.inventory?.tests)
    ? facts.inventory.tests
        .map((identity) => ownDataValue(identity, 'identityKey'))
        .sort(compareText)
    : [];
  const catalogIdentities = catalog.tests.map((test) => test.identityKey).sort(compareText);
  if (
    inventoryIdentities.length !== catalogIdentities.length ||
    inventoryIdentities.some((identityKey, index) => identityKey !== catalogIdentities[index])
  ) {
    fail(errorCode, { reason: 'identity_set_mismatch' });
  }

  const criticalBindings = indexCriticalBindings(facts.analyzerResults);
  const analyzerFindings = indexAnalyzerFindings(facts.analyzerResults);
  const semanticEvidenceBindings = indexSemanticEvidenceBindings(policy);
  const executableTestPaths = new Set(
    facts.inventory.tests.map((identity) =>
      normalizeRelativePath(ownDataValue(identity, 'testPath'))
    )
  );
  const testTargetsByTestPath = indexTestTargetRecords(facts);
  const catalogSemanticIdentities = new Set(
    catalog.tests.map((test) => semanticEvidenceBindingKey(test.runnerId, test.testPath))
  );
  for (const identity of semanticEvidenceBindings.keys()) {
    if (!catalogSemanticIdentities.has(identity)) {
      fail(errorCode, { identity, reason: 'semantic_evidence_identity_missing' });
    }
  }
  for (const test of catalog.tests) {
    const critical = criticalBindings.get(test.identityKey) || {
      bindings: [],
      evidenceRefs: [],
      releaseGateMembership: 'none',
    };
    const expectedSelectionRefs = criticalSelectionRefs(critical.bindings);
    const ownership = testTargetOwnership(
      testTargetsByTestPath,
      test.testPath,
      executableTestPaths
    );
    const expectedTargetRefs = stableUnique([
      ...analyzerTargetEvidence(
        analyzerFindings.get(test.identityKey),
        ownership.commandTargetRefs
      ).keys(),
    ]);
    const policyBinding = resolvePolicyFields(test, policy);
    const expectedFixtureRefs = stableUnique([
      ...(policyBinding.fields.fixtureRefs || []),
      ...ownership.fixtureRefs,
    ]);
    const expectedBehaviorEvidence = behaviorEvidence({
      dimensions: analyzerFindings.get(test.identityKey),
      criticalBindings: critical.bindings,
      additionalTargetRefs: ownership.commandTargetRefs,
      semanticBindings:
        semanticEvidenceBindings.get(semanticEvidenceBindingKey(test.runnerId, test.testPath)) ||
        [],
    });
    const expectedBehaviorOracleAuthority = behaviorOracleAuthority({
      dimensions: analyzerFindings.get(test.identityKey),
      semanticBindings:
        semanticEvidenceBindings.get(semanticEvidenceBindingKey(test.runnerId, test.testPath)) ||
        [],
    });
    const expectedProtectedRefs = protectedCapabilityRefs(
      critical.bindings,
      expectedBehaviorEvidence,
      policy
    );
    const actualProtectedRefs = test.classifications.protectedCapabilityRefs;
    if (
      canonicalJsonBytes(test.selectionRefs).compare(canonicalJsonBytes(expectedSelectionRefs)) !==
        0 ||
      canonicalJsonBytes(actualProtectedRefs).compare(canonicalJsonBytes(expectedProtectedRefs)) !==
        0 ||
      canonicalJsonBytes(test.targetRefs).compare(canonicalJsonBytes(expectedTargetRefs)) !== 0 ||
      canonicalJsonBytes(test.fixtureRefs).compare(canonicalJsonBytes(expectedFixtureRefs)) !== 0 ||
      canonicalJsonBytes(test.behaviorEvidence).compare(
        canonicalJsonBytes(expectedBehaviorEvidence)
      ) !== 0 ||
      canonicalJsonBytes(test.behaviorOracleAuthority).compare(
        canonicalJsonBytes(expectedBehaviorOracleAuthority)
      ) !== 0
    ) {
      fail(errorCode, { identityKey: test.identityKey, reason: 'authority_projection_mismatch' });
    }
  }
  return catalog;
}

function projectTestCatalog({ facts, policy, changedPaths = [], featureBindings = {} }) {
  facts = materializeCatalogFacts(facts);
  validateTestPolicy(policy);
  if (!isObject(facts) || !Array.isArray(facts.inventory?.tests)) {
    fail('CATALOG_FACTS_INVALID');
  }
  validateDiscoveryFacts(facts.discovery);
  facts.inventory.tests.forEach(assertInventoryIdentity);
  const criticalBindings = indexCriticalBindings(facts.analyzerResults);
  const analyzerFindings = indexAnalyzerFindings(facts.analyzerResults);
  const semanticEvidenceBindings = indexSemanticEvidenceBindings(policy);
  const inventorySemanticIdentities = new Set(
    facts.inventory.tests.map((identity) =>
      semanticEvidenceBindingKey(
        ownDataValue(identity, 'runnerId'),
        ownDataValue(identity, 'testPath')
      )
    )
  );
  for (const identity of semanticEvidenceBindings.keys()) {
    if (!inventorySemanticIdentities.has(identity)) {
      fail('CATALOG_SEMANTIC_EVIDENCE_IDENTITY_MISSING', { identity });
    }
  }
  const changed = new Set(changedPaths.map(normalizeRelativePath));
  const executableTestPaths = new Set(
    facts.inventory.tests.map((identity) =>
      normalizeRelativePath(ownDataValue(identity, 'testPath'))
    )
  );
  const testTargetsByTestPath = indexTestTargetRecords(facts);
  const tests = facts.inventory.tests.map((identity) => {
    const identityKey = ownDataValue(identity, 'identityKey');
    const normalizedIdentity = {
      identityKey,
      runnerId: ownDataValue(identity, 'runnerId'),
      testPath: normalizeRelativePath(ownDataValue(identity, 'testPath')),
    };
    for (const field of [
      'executableIdentity',
      'packageId',
      'capabilityRefs',
      'failureModeRefs',
      'evidenceRefs',
    ]) {
      if (hasOwnDataProperty(identity, field)) {
        normalizedIdentity[field] = ownDataValue(identity, field);
      }
    }
    normalizedIdentity.executableIdentity = canonicalExecutableIdentity(normalizedIdentity);
    const critical = criticalBindings.get(identityKey) || {
      bindings: [],
      evidenceRefs: [],
      releaseGateMembership: 'none',
    };
    const dimensions = analyzerFindings.get(identityKey);
    const policyBinding = resolvePolicyFields(normalizedIdentity, policy);
    const ownership = testTargetOwnership(
      testTargetsByTestPath,
      normalizedIdentity.testPath,
      executableTestPaths
    );
    const projectedBehaviorEvidence = behaviorEvidence({
      dimensions,
      criticalBindings: critical.bindings,
      additionalTargetRefs: ownership.commandTargetRefs,
      semanticBindings:
        semanticEvidenceBindings.get(
          semanticEvidenceBindingKey(normalizedIdentity.runnerId, normalizedIdentity.testPath)
        ) || [],
    });
    const projectedBehaviorOracleAuthority = behaviorOracleAuthority({
      dimensions,
      semanticBindings:
        semanticEvidenceBindings.get(
          semanticEvidenceBindingKey(normalizedIdentity.runnerId, normalizedIdentity.testPath)
        ) || [],
    });
    const protectedRefs = protectedCapabilityRefs(
      critical.bindings,
      projectedBehaviorEvidence,
      policy
    );
    const activeFeatureRefs = featureBindingRefs(featureBindings, normalizedIdentity);
    const candidate = deterministicCandidate(dimensions, policy);
    const lifecycle = lifecycleResolution({
      identity: normalizedIdentity,
      changed,
      activeFeatureRefs,
      candidate,
      policyFields: policyBinding.fields,
      stateAuthority: policyBinding.stateAuthority,
    });
    const classifications = analyzerClassifications(dimensions, critical.bindings);
    classifications.protectedCapabilityRefs = protectedRefs;
    if (lifecycle.lifecycleReason) classifications.lifecycleReason = lifecycle.lifecycleReason;
    if (candidate) classifications.deterministicDeletionReasonCode = candidate.reasonCode;

    const traceRefs = stableUnique(policyBinding.fields.traceRefs || []);
    const featureRefs = stableUnique([
      ...(policyBinding.fields.featureRefs || []),
      ...activeFeatureRefs,
    ]);
    const selectionRefs = criticalSelectionRefs(critical.bindings);
    const targetRefs = stableUnique([
      ...analyzerTargetEvidence(dimensions, ownership.commandTargetRefs).keys(),
    ]);

    return {
      identityKey,
      runnerId: normalizedIdentity.runnerId,
      testPath: normalizedIdentity.testPath,
      executableIdentity: normalizedIdentity.executableIdentity,
      packageId: inferPackageId(normalizedIdentity, policyBinding.fields),
      capabilityRefs: stableUnique([
        ...(policyBinding.fields.capabilityRefs || []),
        ...protectedRefs,
      ]),
      failureModeRefs: stableUnique(normalizedIdentity.failureModeRefs || []),
      selectionRefs,
      targetRefs,
      traceRefs,
      featureRefs,
      fixtureRefs: stableUnique([
        ...(policyBinding.fields.fixtureRefs || []),
        ...ownership.fixtureRefs,
      ]),
      lifecycleState: lifecycle.lifecycleState,
      releaseGateMembership:
        policyBinding.fields.releaseGateMembership || critical.releaseGateMembership,
      durationSummary: durationSummary(identityKey, facts, policy),
      behaviorEvidence: projectedBehaviorEvidence,
      behaviorOracleAuthority: projectedBehaviorOracleAuthority,
      classifications,
      evidenceRefs: stableUnique([
        ...(normalizedIdentity.evidenceRefs || []),
        ...critical.evidenceRefs,
        ...analyzerEvidenceRefs(dimensions),
        ...(candidate?.evidenceRefs || []),
        ...ownership.evidenceRefs,
      ]),
    };
  });

  const sortedTests = tests.sort(compareTestIdentity);
  const catalog = {
    schemaVersion: 'test-catalog/v1',
    repository: facts.repository,
    policyHash: catalogPolicyHash(policy),
    factsHash: catalogFactsHash(facts),
    generatedPath: GENERATED_PATH,
    tests: sortedTests,
    gates: calculateCatalogGates(facts, sortedTests, policy),
  };
  validateTestCatalog(catalog);
  return catalog;
}

function writeTestCatalog({ repoRoot, catalog, outputDir = '.artifacts/test-portfolio' }) {
  validateTestCatalog(catalog);
  const expectedOutputDir = path.resolve(repoRoot, '.artifacts', 'test-portfolio');
  const requestedOutputDir = path.resolve(repoRoot, outputDir);
  if (path.relative(expectedOutputDir, requestedOutputDir) !== '') {
    fail('CATALOG_OUTPUT_PATH_INVALID', { outputDir: requestedOutputDir });
  }
  const receipt = writeCanonicalArtifact({
    repoRoot,
    outputDir: requestedOutputDir,
    fileName: 'test-catalog.json',
    artifact: catalog,
  });
  return {
    path: receipt.path,
    sha256: receipt.sha256,
    testCount: catalog.tests.length,
  };
}

function writeCatalogFacts({ repoRoot, facts, outputDir = '.artifacts/test-portfolio' }) {
  facts = materializeCatalogFacts(facts);
  if (
    !facts ||
    typeof facts !== 'object' ||
    Array.isArray(facts) ||
    facts.schemaVersion !== 'test-portfolio-audit-facts/v1'
  ) {
    fail('CATALOG_FACTS_SCHEMA_INVALID');
  }
  const expectedOutputDir = path.resolve(repoRoot, '.artifacts', 'test-portfolio');
  const requestedOutputDir = path.resolve(repoRoot, outputDir);
  if (path.relative(expectedOutputDir, requestedOutputDir) !== '') {
    fail('CATALOG_OUTPUT_PATH_INVALID', { outputDir: requestedOutputDir });
  }
  const receipt = writeCanonicalArtifact({
    repoRoot,
    outputDir: requestedOutputDir,
    fileName: 'test-catalog-facts.json',
    artifact: facts,
  });
  return {
    path: receipt.path,
    sha256: receipt.sha256,
  };
}

function repoPath(repoRoot, value, code) {
  if (typeof value !== 'string' || value.trim() === '') fail(code);
  const target = path.resolve(repoRoot, value);
  const relative = path.relative(path.resolve(repoRoot), target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail(code);
  }
  return target;
}

function readOptionalJson(repoRoot, value, fallback, code) {
  if (!value) return fallback;
  return JSON.parse(fs.readFileSync(repoPath(repoRoot, value, code), 'utf8'));
}

function parseCliArgs(args) {
  const options = {
    repoRoot: process.cwd(),
    policy: 'repo-governance/ci/test-policy.json',
    outputDir: '.artifacts/test-portfolio',
    probeLimit: 0,
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      ![
        '--repo-root',
        '--policy',
        '--output-dir',
        '--facts',
        '--changed-paths',
        '--feature-bindings',
        '--probe-limit',
      ].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CATALOG_CLI_ARGS_INVALID');
    }
    const key = flag.slice(2).replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
    options[key] = value;
  }
  options.repoRoot = path.resolve(options.repoRoot);
  const probeLimit = Number(options.probeLimit);
  if (!Number.isSafeInteger(probeLimit) || probeLimit < 0 || probeLimit > 20) {
    fail('CATALOG_CLI_ARGS_INVALID');
  }
  options.probeLimit = probeLimit;
  return options;
}

async function main(args = process.argv.slice(2)) {
  const options = parseCliArgs(args);
  const policy = readTestPolicy(options.repoRoot, options.policy);
  const facts = options.facts
    ? readOptionalJson(options.repoRoot, options.facts, null, 'CATALOG_FACTS_PATH_INVALID')
    : await collectAuditFacts({
        repoRoot: options.repoRoot,
        outputDir: path.join(options.repoRoot, '.artifacts', 'ci'),
        probeLimit: options.probeLimit,
        probeBudgetMs: options.probeLimit === 0 ? 0 : 600_000,
        probeSandboxRoot: null,
      });
  const changedPaths = readOptionalJson(
    options.repoRoot,
    options.changedPaths,
    [],
    'CATALOG_CHANGED_PATHS_INVALID'
  );
  const featureBindings = readOptionalJson(
    options.repoRoot,
    options.featureBindings,
    {},
    'CATALOG_FEATURE_BINDINGS_INVALID'
  );
  if (!Array.isArray(changedPaths)) fail('CATALOG_CHANGED_PATHS_INVALID');
  const catalog = projectTestCatalog({ facts, policy, changedPaths, featureBindings });
  const factsReceipt = writeCatalogFacts({
    repoRoot: options.repoRoot,
    outputDir: options.outputDir,
    facts,
  });
  const receipt = writeTestCatalog({
    repoRoot: options.repoRoot,
    outputDir: options.outputDir,
    catalog,
  });
  process.stdout.write(
    `${JSON.stringify({
      ...receipt,
      factsPath: factsReceipt.path,
      factsSha256: factsReceipt.sha256,
    })}\n`
  );
  return 0;
}

if (require.main === module) {
  void main().catch((error) => {
    process.stderr.write(`${error.code || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  catalogFactsHash,
  catalogPolicyHash,
  main,
  materializeCatalogFacts,
  parseCliArgs,
  projectTestCatalog,
  validateCatalogAuthority,
  validateTestCatalog,
  writeCatalogFacts,
  writeTestCatalog,
};
