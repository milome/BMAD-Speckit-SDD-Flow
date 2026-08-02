'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJsonBytes } = require('../test-portfolio-audit/canonical.cjs');
const { compareText, fail } = require('./canonical-artifact.cjs');

const STATES = Object.freeze([
  'core_permanent',
  'feature_working_set',
  'retained_on_demand',
  'deletion_candidate',
]);
const PROFILES = Object.freeze([
  'pr-fast',
  'pr-full',
  'nightly-deep',
  'release-verify',
  'nightly-full',
  'release-full',
]);
const EXPANSION_LEVELS = Object.freeze(['trace_capability', 'feature', 'package']);
const RELEASE_REQUIRED_BINDING_KINDS = Object.freeze([
  'package_install',
  'cli_bin',
  'consumer_compatibility',
  'packaged_runtime',
  'security_encoding_persistence',
  'protected_acceptance_or_proof',
]);
const DETERMINISTIC_REASON_CODES = Object.freeze([
  'EXACT_DUPLICATE',
  'TARGET_REMOVED',
  'SELF_PROVING_ORACLE',
  'REPLACED_BY_CONTRACT_TEST',
]);
const SIX_MODEL_ORDER = Object.freeze([
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
]);
const COMMON_REQUIRED_BEHAVIORS = Object.freeze([
  'state_entry',
  'applicability_or_not_applicable',
  'successful_promotion',
  'fail_closed',
  'invalidation',
  'reconfirmation',
  'evidence_binding',
  'authority_rejection',
  'stale_evidence_rejection',
]);
const MODEL_SPECIFIC_BEHAVIORS = Object.freeze({
  audit_review: Object.freeze(['reverse_audit_execution', 'judge_continuation']),
  delivery_confirmation: Object.freeze(['record_closed_final_transition']),
});
const APPLICABILITY_VALUES = new Set(['applicable', 'not_applicable']);
const EVIDENCE_KIND_VALUES = new Set(['direct', 'indirect']);
const ORACLE_INDEPENDENCE_VALUES = new Set(['independent']);
const SEMANTIC_EVIDENCE_REF_PREFIXES = Object.freeze(['feature:', 'target:', 'trace:']);
const CANONICAL_REF_PAYLOAD = /^[A-Za-z0-9._/@#[\]-]+(?::[A-Za-z0-9._/@#[\]-]+)*$/u;
const CLASSIFICATION_FIELDS = Object.freeze([
  'state',
  'packageId',
  'capabilityRefs',
  'traceRefs',
  'featureRefs',
  'fixtureRefs',
  'releaseGateMembership',
]);
const CLASSIFICATION_FIELD_SET = new Set(CLASSIFICATION_FIELDS);

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireObject(value, code) {
  if (!isPlainObject(value)) fail(code);
  return value;
}

function requireNonEmptyString(value, code) {
  if (typeof value !== 'string' || value.trim() === '') fail(code);
  return value;
}

function normalizePolicyTestPath(value) {
  const rawPath = requireNonEmptyString(value, 'POLICY_SEMANTIC_EVIDENCE_TEST_PATH_INVALID');
  const slashPath = rawPath.replace(/\\/gu, '/');
  const normalized = path.posix.normalize(slashPath).replace(/^\.\//u, '');
  if (
    normalized !== slashPath ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    fail('POLICY_SEMANTIC_EVIDENCE_TEST_PATH_INVALID', { testPath: value });
  }
  return normalized;
}

function isCanonicalNamespacedRef(value, namespace) {
  if (typeof value !== 'string' || typeof namespace !== 'string' || namespace.length === 0) {
    return false;
  }
  const prefix = `${namespace}:`;
  return (
    value.startsWith(prefix) &&
    value === value.trim() &&
    CANONICAL_REF_PAYLOAD.test(value.slice(prefix.length))
  );
}

function requireInteger(value, code, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(code);
  return value;
}

function requireStringArray(value, code, { nonEmpty = false } = {}) {
  if (
    !Array.isArray(value) ||
    (nonEmpty && value.length === 0) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim() === '')
  ) {
    fail(code);
  }
  if (new Set(value).size !== value.length) fail(code);
  return value;
}

function requireExactValues(actual, expected, code) {
  requireStringArray(actual, code, { nonEmpty: true });
  if (
    actual.length !== expected.length ||
    actual.some((entry, index) => entry !== expected[index])
  ) {
    fail(code);
  }
}

function requireBudget(actual, expected, code) {
  if (actual !== expected) fail(code, { expected, actual });
}

function normalizeRepoPattern(value, code) {
  const normalized = path.posix.normalize(requireNonEmptyString(value, code).replace(/\\/g, '/'));
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    fail(code);
  }
  return normalized.replace(/^\.\//u, '');
}

function directoryPatternBase(pattern) {
  const normalized = normalizeRepoPattern(pattern, 'POLICY_DIRECTORY_PATTERN_INVALID');
  if (!normalized.endsWith('/**')) fail('POLICY_DIRECTORY_PATTERN_INVALID');
  const base = normalized.slice(0, -3).replace(/\/+$/u, '');
  const segments = base.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => /[*?[\]]/u.test(segment))) {
    fail('POLICY_DIRECTORY_PATTERN_INVALID');
  }
  return { normalized, base, segments };
}

function classificationShape(record, identityFields) {
  const shape = {};
  for (const [key, value] of Object.entries(record)) {
    if (identityFields.has(key)) continue;
    if (!CLASSIFICATION_FIELD_SET.has(key)) {
      fail('POLICY_CLASSIFICATION_FIELD_UNKNOWN', { field: key });
    }
    shape[key] = value;
  }
  if (Object.prototype.hasOwnProperty.call(shape, 'state') && !STATES.includes(shape.state)) {
    fail('POLICY_STATE_UNKNOWN', { state: shape.state });
  }
  return shape;
}

function stableShape(value) {
  return canonicalJsonBytes(value).toString('utf8');
}

function validateDirectoryRules(directoryRules) {
  if (!Array.isArray(directoryRules) || directoryRules.length === 0) {
    fail('POLICY_DIRECTORY_RULES_INVALID');
  }
  const rules = directoryRules.map((rule) => {
    requireObject(rule, 'POLICY_DIRECTORY_RULE_INVALID');
    const ruleId = requireNonEmptyString(rule.ruleId, 'POLICY_DIRECTORY_RULE_ID_INVALID');
    const pattern = directoryPatternBase(rule.pattern);
    const fields = classificationShape(rule, new Set(['ruleId', 'pattern']));
    if (Object.keys(fields).length === 0) fail('POLICY_DIRECTORY_RULE_EMPTY');
    return {
      rule,
      ruleId,
      pattern,
      fields,
      specificity: pattern.segments.length,
    };
  });

  for (let leftIndex = 0; leftIndex < rules.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rules.length; rightIndex += 1) {
      const left = rules[leftIndex];
      const right = rules[rightIndex];
      if (
        left.specificity === right.specificity &&
        left.pattern.base === right.pattern.base &&
        stableShape(left.fields) !== stableShape(right.fields)
      ) {
        fail('POLICY_CLASSIFICATION_CONFLICT', {
          ruleIds: [left.ruleId, right.ruleId].sort(compareText),
        });
      }
    }
  }
  return rules;
}

function normalizeTestPath(value) {
  const normalized = normalizeRepoPattern(value, 'POLICY_EXCEPTION_PATH_INVALID');
  if (/[*?[\]]/u.test(normalized)) fail('POLICY_EXCEPTION_PATH_INVALID');
  return normalized;
}

function matchingDirectoryRule(testPath, rules) {
  return [...rules]
    .filter(
      (entry) => testPath === entry.pattern.base || testPath.startsWith(`${entry.pattern.base}/`)
    )
    .sort((left, right) => {
      if (left.specificity !== right.specificity) {
        return right.specificity - left.specificity;
      }
      const patternOrder = compareText(left.pattern.normalized, right.pattern.normalized);
      return patternOrder !== 0 ? patternOrder : compareText(left.ruleId, right.ruleId);
    })[0];
}

function validatedExceptions(classification, rules) {
  const exceptions = classification.exceptions;
  if (!Array.isArray(exceptions)) fail('POLICY_EXCEPTIONS_INVALID');
  const byTestPath = new Map();
  return exceptions.map((exception) => {
    requireObject(exception, 'POLICY_EXCEPTION_INVALID');
    const testPath = normalizeTestPath(exception.testPath);
    const fields = classificationShape(exception, new Set(['testPath']));
    if (Object.keys(fields).length === 0) fail('POLICY_EXCEPTION_EMPTY');
    const shape = stableShape(fields);
    const previous = byTestPath.get(testPath);
    if (previous && previous !== shape) {
      fail('POLICY_EXCEPTION_CONFLICT', { testPath });
    }
    byTestPath.set(testPath, shape);
    return {
      exception,
      testPath,
      fields,
      shape,
      directoryRule: matchingDirectoryRule(testPath, rules),
    };
  });
}

function isRedundantException(entry) {
  if (!entry.directoryRule) return false;
  return Object.entries(entry.fields).every(
    ([field, value]) =>
      Object.prototype.hasOwnProperty.call(entry.directoryRule.fields, field) &&
      stableShape({ value: entry.directoryRule.fields[field] }) === stableShape({ value })
  );
}

function analyzePolicyExceptions({ policy, baselineExceptionCount = 0 }) {
  requireInteger(baselineExceptionCount, 'POLICY_BASELINE_EXCEPTION_COUNT_INVALID', 0);
  const classification = requireObject(policy?.classification, 'POLICY_CLASSIFICATION_INVALID');
  const rules = validateDirectoryRules(classification.directoryRules);
  const exceptions = validatedExceptions(classification, rules);
  const groups = new Map();
  let redundantExceptionCount = 0;

  for (const entry of exceptions) {
    if (isRedundantException(entry)) redundantExceptionCount += 1;
    const directory = path.posix.dirname(entry.testPath);
    const key = `${directory}\0${entry.shape}`;
    if (!groups.has(key)) {
      groups.set(key, {
        directory,
        exceptionCount: 0,
        override: entry.fields,
      });
    }
    groups.get(key).exceptionCount += 1;
  }

  return {
    exceptionCount: exceptions.length,
    exceptionCountDelta: exceptions.length - baselineExceptionCount,
    redundantExceptionCount,
    directoryRulePromotionCandidates: [...groups.values()]
      .filter((entry) => entry.exceptionCount >= 3)
      .sort((left, right) => {
        const directoryOrder = compareText(left.directory, right.directory);
        return directoryOrder !== 0
          ? directoryOrder
          : compareText(stableShape(left.override), stableShape(right.override));
      }),
  };
}

function requiredBehaviorsForModel(model) {
  return [...COMMON_REQUIRED_BEHAVIORS, ...(MODEL_SPECIFIC_BEHAVIORS[model] || [])];
}

function validateSemanticObligations(semanticObligations) {
  if (
    !Array.isArray(semanticObligations) ||
    semanticObligations.length !== SIX_MODEL_ORDER.length
  ) {
    fail('POLICY_SEMANTIC_OBLIGATIONS_INVALID');
  }
  for (const [index, group] of semanticObligations.entries()) {
    requireObject(group, 'POLICY_SEMANTIC_OBLIGATION_INVALID');
    const expectedModel = SIX_MODEL_ORDER[index];
    if (group.model !== expectedModel) {
      fail('POLICY_SEMANTIC_MODEL_ORDER_INVALID', {
        expected: expectedModel,
        actual: group.model,
      });
    }
    if (!APPLICABILITY_VALUES.has(group.applicability)) {
      fail('POLICY_SEMANTIC_APPLICABILITY_INVALID', { model: group.model });
    }
    if (!EVIDENCE_KIND_VALUES.has(group.minimumEvidenceKind)) {
      fail('POLICY_SEMANTIC_MINIMUM_EVIDENCE_INVALID', { model: group.model });
    }
    requireExactValues(
      group.requiredBehaviors,
      requiredBehaviorsForModel(group.model),
      'POLICY_SEMANTIC_REQUIRED_BEHAVIORS_INVALID'
    );
  }
}

function semanticModelForObligationRef(obligationRef) {
  const separatorIndex = obligationRef.indexOf('/');
  return separatorIndex > 0 ? obligationRef.slice(0, separatorIndex) : null;
}

function semanticEvidenceRef(value) {
  return SEMANTIC_EVIDENCE_REF_PREFIXES.some((prefix) =>
    isCanonicalNamespacedRef(value, prefix.slice(0, -1))
  );
}

function semanticEvidenceRefForObligation(namespace, obligation) {
  const model = obligation.model.replace(/_/gu, '-');
  const behavior = obligation.behavior.replace(/_/gu, '-');
  return `${namespace}/${model}/${behavior}`;
}

function declaredSemanticEvidenceRefs(policy) {
  const refs = new Set();
  for (const capability of policy.protectedCapabilities) {
    if (capability.semanticEvidenceNamespace) {
      for (const obligation of expandedModelObligations(policy.semanticObligations)) {
        refs.add(
          semanticEvidenceRefForObligation(capability.semanticEvidenceNamespace, obligation)
        );
      }
    }
    for (const binding of Object.values(capability.requiredBehaviors || {})) {
      for (const evidenceRef of binding.anyOfEvidenceRefs || []) {
        if (semanticEvidenceRef(evidenceRef)) refs.add(evidenceRef);
      }
    }
  }
  for (const journey of policy.semanticJourneys) {
    for (const evidenceRef of journey.anyOfEvidenceRefs) {
      refs.add(evidenceRef);
    }
  }
  return refs;
}

function validateSemanticEvidenceBindings(policy) {
  const semanticEvidenceBindings = policy.semanticEvidenceBindings;
  if (semanticEvidenceBindings === undefined) return;
  if (!Array.isArray(semanticEvidenceBindings)) {
    fail('POLICY_SEMANTIC_EVIDENCE_BINDINGS_INVALID');
  }
  const allowedEvidenceRefs = declaredSemanticEvidenceRefs(policy);
  const assignedEvidenceRefs = new Map();
  const identities = new Set();
  for (const entry of semanticEvidenceBindings) {
    requireObject(entry, 'POLICY_SEMANTIC_EVIDENCE_BINDING_INVALID');
    const runnerId = requireNonEmptyString(
      entry.runnerId,
      'POLICY_SEMANTIC_EVIDENCE_RUNNER_ID_INVALID'
    );
    if (!/^[A-Za-z0-9._-]+$/u.test(runnerId)) {
      fail('POLICY_SEMANTIC_EVIDENCE_RUNNER_ID_INVALID', { runnerId });
    }
    const testPath = normalizePolicyTestPath(entry.testPath);
    const identity = `${runnerId}#${testPath}`;
    if (identities.has(identity)) {
      fail('POLICY_SEMANTIC_EVIDENCE_IDENTITY_DUPLICATE', { identity });
    }
    identities.add(identity);

    if (!Array.isArray(entry.bindings) || entry.bindings.length === 0) {
      fail('POLICY_SEMANTIC_EVIDENCE_BINDINGS_INVALID', { identity });
    }
    const evidenceRefs = new Set();
    for (const rawBinding of entry.bindings) {
      const binding = requireObject(rawBinding, 'POLICY_SEMANTIC_EVIDENCE_BINDING_ENTRY_INVALID');
      const evidenceRef = requireNonEmptyString(
        binding.evidenceRef,
        'POLICY_SEMANTIC_EVIDENCE_REF_INVALID'
      );
      if (!semanticEvidenceRef(evidenceRef)) {
        fail('POLICY_SEMANTIC_EVIDENCE_REF_INVALID', { evidenceRef, identity });
      }
      if (!allowedEvidenceRefs.has(evidenceRef)) {
        fail('POLICY_SEMANTIC_EVIDENCE_REF_OUTSIDE_NAMESPACE', {
          evidenceRef,
          identity,
        });
      }
      if (evidenceRefs.has(evidenceRef)) {
        fail('POLICY_SEMANTIC_EVIDENCE_REF_DUPLICATE', { evidenceRef, identity });
      }
      if (assignedEvidenceRefs.has(evidenceRef)) {
        fail('POLICY_SEMANTIC_EVIDENCE_REF_ASSIGNED_MULTIPLE_IDENTITIES', {
          evidenceRef,
          identities: [assignedEvidenceRefs.get(evidenceRef), identity],
        });
      }
      evidenceRefs.add(evidenceRef);
      assignedEvidenceRefs.set(evidenceRef, identity);
      if (!EVIDENCE_KIND_VALUES.has(binding.evidenceKind)) {
        fail('POLICY_SEMANTIC_EVIDENCE_KIND_INVALID', { evidenceRef, identity });
      }
      if (binding.oracleAuthority !== undefined) {
        const oracleAuthority = requireObject(
          binding.oracleAuthority,
          'POLICY_SEMANTIC_ORACLE_AUTHORITY_INVALID'
        );
        if (!ORACLE_INDEPENDENCE_VALUES.has(oracleAuthority.independence)) {
          fail('POLICY_SEMANTIC_ORACLE_AUTHORITY_INVALID', { evidenceRef, identity });
        }
        const oracleEvidenceRefs = requireStringArray(
          oracleAuthority.evidenceRefs,
          'POLICY_SEMANTIC_ORACLE_EVIDENCE_INVALID',
          { nonEmpty: true }
        );
        const expectedPrefix = `source:${testPath}#assertion:line:`;
        for (const oracleEvidenceRef of oracleEvidenceRefs) {
          const line = oracleEvidenceRef.slice(expectedPrefix.length);
          if (
            !oracleEvidenceRef.startsWith(expectedPrefix) ||
            !/^[1-9][0-9]*$/u.test(line) ||
            !isCanonicalNamespacedRef(oracleEvidenceRef, 'source')
          ) {
            fail('POLICY_SEMANTIC_ORACLE_EVIDENCE_OUTSIDE_TEST', {
              evidenceRef,
              identity,
              oracleEvidenceRef,
            });
          }
        }
      }
    }
  }
}

function validateSemanticJourneys(semanticJourneys) {
  if (!Array.isArray(semanticJourneys) || semanticJourneys.length === 0) {
    fail('POLICY_SEMANTIC_JOURNEYS_INVALID');
  }
  const journeyIds = new Set();
  for (const journey of semanticJourneys) {
    requireObject(journey, 'POLICY_SEMANTIC_JOURNEY_INVALID');
    const journeyId = requireNonEmptyString(
      journey.journeyId,
      'POLICY_SEMANTIC_JOURNEY_ID_INVALID'
    );
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(journeyId) || journeyIds.has(journeyId)) {
      fail('POLICY_SEMANTIC_JOURNEY_ID_INVALID', { journeyId });
    }
    journeyIds.add(journeyId);
    requireNonEmptyString(journey.model, 'POLICY_SEMANTIC_JOURNEY_MODEL_INVALID');
    requireNonEmptyString(journey.transition, 'POLICY_SEMANTIC_JOURNEY_TRANSITION_INVALID');
    requireNonEmptyString(
      journey.remediationOwner,
      'POLICY_SEMANTIC_JOURNEY_REMEDIATION_OWNER_INVALID'
    );
    if (!APPLICABILITY_VALUES.has(journey.applicability)) {
      fail('POLICY_SEMANTIC_JOURNEY_APPLICABILITY_INVALID', { journeyId });
    }
    if (!EVIDENCE_KIND_VALUES.has(journey.minimumEvidenceKind)) {
      fail('POLICY_SEMANTIC_JOURNEY_MINIMUM_EVIDENCE_INVALID', { journeyId });
    }
    const evidenceRefs = requireStringArray(
      journey.anyOfEvidenceRefs,
      'POLICY_SEMANTIC_JOURNEY_EVIDENCE_INVALID',
      { nonEmpty: true }
    );
    if (evidenceRefs.some((evidenceRef) => !semanticEvidenceRef(evidenceRef))) {
      fail('POLICY_SEMANTIC_JOURNEY_EVIDENCE_INVALID', { journeyId });
    }
    const targetRefs = requireStringArray(
      journey.affectedTargetRefs,
      'POLICY_SEMANTIC_JOURNEY_TARGET_REFS_INVALID',
      { nonEmpty: true }
    );
    if (
      targetRefs.some(
        (targetRef) =>
          !isCanonicalNamespacedRef(targetRef, 'capability') &&
          !isCanonicalNamespacedRef(targetRef, 'target') &&
          !isCanonicalNamespacedRef(targetRef, 'transition')
      )
    ) {
      fail('POLICY_SEMANTIC_JOURNEY_TARGET_REFS_INVALID', { journeyId });
    }
    if (
      Object.prototype.hasOwnProperty.call(journey, 'identityKey') ||
      Object.prototype.hasOwnProperty.call(journey, 'testPath')
    ) {
      fail('POLICY_SEMANTIC_JOURNEY_TEST_IDENTITY_FORBIDDEN', { journeyId });
    }
  }
}

function expandedModelObligations(semanticObligations) {
  return semanticObligations.flatMap((group) =>
    group.requiredBehaviors.map((behavior) => ({
      obligationId: `${group.model}/${behavior}`,
      model: group.model,
      behavior,
      applicability: group.applicability,
      minimumEvidenceKind: group.minimumEvidenceKind,
    }))
  );
}

function resolveRequiredBehaviorRef(obligationRef, semanticObligations) {
  const obligations = expandedModelObligations(semanticObligations);
  if (obligationRef.endsWith('/*')) {
    const model = obligationRef.slice(0, -2);
    return obligations.filter((obligation) => obligation.model === model);
  }
  return obligations.filter((obligation) => obligation.obligationId === obligationRef);
}

function validateRequiredBehaviors(capability, semanticObligations, evidenceModels) {
  const requiredBehaviors = requireObject(
    capability.requiredBehaviors,
    'POLICY_REQUIRED_BEHAVIORS_INVALID'
  );
  for (const [obligationRef, rawBinding] of Object.entries(requiredBehaviors)) {
    if (capability.semanticEvidenceNamespace && obligationRef.endsWith('/*')) {
      fail('POLICY_REQUIRED_BEHAVIOR_WILDCARD_FORBIDDEN', {
        capabilityId: capability.capabilityId,
        obligationRef,
      });
    }
    const resolved = resolveRequiredBehaviorRef(obligationRef, semanticObligations);
    if (resolved.length === 0) {
      fail('POLICY_REQUIRED_BEHAVIOR_REF_INVALID', {
        capabilityId: capability.capabilityId,
        obligationRef,
      });
    }
    const binding = requireObject(rawBinding, 'POLICY_REQUIRED_BEHAVIOR_BINDING_INVALID');
    const evidenceRefs = requireStringArray(
      binding.anyOfEvidenceRefs,
      'POLICY_REQUIRED_BEHAVIOR_EVIDENCE_INVALID',
      { nonEmpty: true }
    );
    if (evidenceRefs.some((evidenceRef) => !semanticEvidenceRef(evidenceRef))) {
      fail('POLICY_REQUIRED_BEHAVIOR_EVIDENCE_INVALID', {
        capabilityId: capability.capabilityId,
        obligationRef,
      });
    }
    if (!EVIDENCE_KIND_VALUES.has(binding.evidenceKind)) {
      fail('POLICY_REQUIRED_BEHAVIOR_EVIDENCE_KIND_INVALID', {
        capabilityId: capability.capabilityId,
        obligationRef,
      });
    }
    const model = semanticModelForObligationRef(obligationRef);
    for (const evidenceRef of evidenceRefs) {
      if (!evidenceModels.has(evidenceRef)) evidenceModels.set(evidenceRef, new Set());
      evidenceModels.get(evidenceRef).add(model);
      if (evidenceModels.get(evidenceRef).size > 1) {
        fail('POLICY_CROSS_MODEL_EVIDENCE_REUSE_FORBIDDEN', { evidenceRef });
      }
    }
  }
}

function validateSemanticEvidenceNamespace(capability, semanticObligations, evidenceModels) {
  if (!Object.prototype.hasOwnProperty.call(capability, 'semanticEvidenceNamespace')) return;
  const namespace = requireNonEmptyString(
    capability.semanticEvidenceNamespace,
    'POLICY_SEMANTIC_EVIDENCE_NAMESPACE_INVALID'
  );
  if (!isCanonicalNamespacedRef(namespace, 'trace')) {
    fail('POLICY_SEMANTIC_EVIDENCE_NAMESPACE_INVALID', {
      capabilityId: capability.capabilityId,
      namespace,
    });
  }
  for (const obligation of expandedModelObligations(semanticObligations)) {
    const evidenceRef = semanticEvidenceRefForObligation(namespace, obligation);
    if (!evidenceModels.has(evidenceRef)) evidenceModels.set(evidenceRef, new Set());
    evidenceModels.get(evidenceRef).add(obligation.model);
  }
}

function validateProtectedCapabilities(protectedCapabilities, semanticObligations) {
  if (!Array.isArray(protectedCapabilities) || protectedCapabilities.length === 0) {
    fail('POLICY_PROTECTED_CAPABILITIES_INVALID');
  }
  const capabilityIds = new Set();
  const selectionRefs = new Set();
  const evidenceModels = new Map();
  for (const capability of protectedCapabilities) {
    requireObject(capability, 'POLICY_PROTECTED_CAPABILITY_INVALID');
    const capabilityId = requireNonEmptyString(
      capability.capabilityId,
      'POLICY_CAPABILITY_ID_INVALID'
    );
    if (capabilityIds.has(capabilityId)) fail('POLICY_CAPABILITY_ID_DUPLICATE');
    capabilityIds.add(capabilityId);
    requireStringArray(capability.selectionRefs, 'POLICY_SELECTION_REFS_INVALID', {
      nonEmpty: true,
    });
    const survivalEvidenceRefs = requireStringArray(
      capability.survivalEvidenceRefs,
      'POLICY_SURVIVAL_EVIDENCE_REFS_INVALID',
      { nonEmpty: true }
    );
    if (survivalEvidenceRefs.some((evidenceRef) => !semanticEvidenceRef(evidenceRef))) {
      fail('POLICY_SURVIVAL_EVIDENCE_REFS_INVALID', { capabilityId });
    }
    if (Object.prototype.hasOwnProperty.call(capability, 'coreIdentityKeys')) {
      fail('POLICY_CORE_IDENTITY_KEYS_FORBIDDEN', { capabilityId });
    }
    if (
      Object.prototype.hasOwnProperty.call(capability, 'bindTestsBySurvivalEvidence') &&
      capability.bindTestsBySurvivalEvidence !== true
    ) {
      fail('POLICY_SURVIVAL_EVIDENCE_TEST_BINDING_INVALID', { capabilityId });
    }
    validateSemanticEvidenceNamespace(capability, semanticObligations, evidenceModels);
    validateRequiredBehaviors(capability, semanticObligations, evidenceModels);
    for (const selectionRef of capability.selectionRefs) {
      if (!isCanonicalNamespacedRef(selectionRef, 'script')) {
        fail('POLICY_SELECTION_REF_INVALID');
      }
      if (selectionRefs.has(selectionRef)) fail('POLICY_SELECTION_REF_DUPLICATE');
      selectionRefs.add(selectionRef);
    }
  }
}

function expandSemanticObligations(policy) {
  requireObject(policy, 'POLICY_INVALID');
  validateSemanticObligations(policy.semanticObligations);
  if (!Array.isArray(policy.protectedCapabilities) || policy.protectedCapabilities.length === 0) {
    fail('POLICY_PROTECTED_CAPABILITIES_INVALID');
  }
  return [
    ...expandedModelObligations(policy.semanticObligations),
    ...policy.protectedCapabilities.map((capability) => ({
      obligationId: `survival/${requireNonEmptyString(
        capability.capabilityId,
        'POLICY_CAPABILITY_ID_INVALID'
      )}`,
      model: 'minimum_survival',
      behavior: capability.capabilityId,
      applicability: 'applicable',
      minimumEvidenceKind: 'direct',
    })),
  ].sort((left, right) => compareText(left.obligationId, right.obligationId));
}

function expandCapabilityBehaviorBindings(policy, capability) {
  const obligations = expandSemanticObligations(policy);
  const requiredBehaviors = capability.requiredBehaviors || {};
  const expanded = new Map();
  expanded.set(`survival/${capability.capabilityId}`, {
    obligationId: `survival/${capability.capabilityId}`,
    anyOfEvidenceRefs: [...capability.survivalEvidenceRefs].sort(compareText),
    evidenceKind: 'direct',
  });
  if (capability.semanticEvidenceNamespace) {
    for (const obligation of obligations.filter(
      (candidate) => candidate.model !== 'minimum_survival'
    )) {
      expanded.set(obligation.obligationId, {
        obligationId: obligation.obligationId,
        anyOfEvidenceRefs: [
          semanticEvidenceRefForObligation(capability.semanticEvidenceNamespace, obligation),
        ],
        evidenceKind: obligation.minimumEvidenceKind,
      });
    }
  }
  for (const [obligationRef, binding] of Object.entries(requiredBehaviors)) {
    for (const obligation of obligations.filter(
      (candidate) =>
        candidate.model !== 'minimum_survival' &&
        (obligationRef === candidate.obligationId ||
          (obligationRef.endsWith('/*') && candidate.model === obligationRef.slice(0, -2)))
    )) {
      expanded.set(obligation.obligationId, {
        obligationId: obligation.obligationId,
        anyOfEvidenceRefs: [...binding.anyOfEvidenceRefs].sort(compareText),
        evidenceKind: binding.evidenceKind,
      });
    }
  }
  return [...expanded.values()].sort((left, right) =>
    compareText(left.obligationId, right.obligationId)
  );
}

function validateTask4SelectionAuthority(selection) {
  requireStringArray(selection.releaseSurfacePathRules, 'POLICY_RELEASE_SURFACE_RULES_INVALID', {
    nonEmpty: true,
  });
  for (const pattern of selection.releaseSurfacePathRules) {
    normalizeRepoPattern(pattern, 'POLICY_RELEASE_SURFACE_RULE_INVALID');
  }
  requireStringArray(
    selection.productSurvivalCapabilityRefs,
    'POLICY_PRODUCT_SURVIVAL_REFS_INVALID',
    { nonEmpty: true }
  );
  requireStringArray(selection.releaseCapabilityRefs, 'POLICY_RELEASE_CAPABILITY_REFS_INVALID', {
    nonEmpty: true,
  });
  requireExactValues(
    selection.releaseRequiredBindingKinds,
    RELEASE_REQUIRED_BINDING_KINDS,
    'POLICY_RELEASE_REQUIRED_BINDING_KINDS_INVALID'
  );
}

function validateSelection(selection) {
  requireObject(selection, 'POLICY_SELECTION_INVALID');
  requireExactValues(selection.expansionOrder, EXPANSION_LEVELS, 'POLICY_EXPANSION_ORDER_INVALID');
  requireStringArray(selection.highDiffusionPathRules, 'POLICY_HIGH_DIFFUSION_RULES_INVALID');
  for (const pattern of selection.highDiffusionPathRules) {
    normalizeRepoPattern(pattern, 'POLICY_HIGH_DIFFUSION_RULE_INVALID');
  }
  validateTask4SelectionAuthority(selection);
}

function validateTiming(timing) {
  requireObject(timing, 'POLICY_TIMING_INVALID');
  const unknownDurationMs = requireInteger(
    timing.unknownDurationMs,
    'POLICY_UNKNOWN_DURATION_INVALID',
    1,
    480_000
  );
  const maxShardDurationMs = requireInteger(
    timing.maxShardDurationMs,
    'POLICY_MAX_SHARD_DURATION_INVALID',
    1,
    480_000
  );
  if (unknownDurationMs > maxShardDurationMs) fail('POLICY_TIMING_BOUNDS_INVALID');
  requireInteger(timing.maxShardsPerLane, 'POLICY_MAX_SHARDS_INVALID', 1, 64);
}

function validateDeletion(deletion) {
  requireObject(deletion, 'POLICY_DELETION_INVALID');
  if (deletion.optimizationUseForbidden !== true) {
    fail('POLICY_DELETION_OPTIMIZATION_FORBIDDEN_REQUIRED');
  }
  if (deletion.requiredReviewMode !== 'manual_exception') {
    fail('POLICY_DELETION_REVIEW_MODE_INVALID');
  }
  requireInteger(deletion.minimumApprovals, 'POLICY_DELETION_APPROVALS_INVALID', 2, 10);
  const maxBatchSize = requireInteger(
    deletion.maxBatchSize,
    'POLICY_DELETION_BATCH_SIZE_INVALID',
    1,
    10
  );
  requireStringArray(deletion.deterministicReasonCodes, 'POLICY_DELETION_REASON_CODES_INVALID', {
    nonEmpty: true,
  });
  for (const reasonCode of deletion.deterministicReasonCodes) {
    if (!DETERMINISTIC_REASON_CODES.includes(reasonCode)) {
      fail('POLICY_DELETION_REASON_UNKNOWN', { reasonCode });
    }
  }
  const localReview = requireObject(deletion.localReview, 'POLICY_LOCAL_REVIEW_INVALID');
  const maxCandidates = requireInteger(
    localReview.maxCandidates,
    'POLICY_LOCAL_REVIEW_MAX_INVALID',
    1,
    10
  );
  if (maxCandidates > maxBatchSize) fail('POLICY_LOCAL_REVIEW_MAX_INVALID');
  requireInteger(localReview.maxCalls, 'POLICY_LOCAL_REVIEW_CALLS_INVALID', 1, 1);
  requireInteger(localReview.retries, 'POLICY_LOCAL_REVIEW_RETRIES_INVALID', 0, 0);
  requireInteger(localReview.timeoutMs, 'POLICY_LOCAL_REVIEW_TIMEOUT_INVALID', 1, 300_000);
}

function validateClassification(classification) {
  requireObject(classification, 'POLICY_CLASSIFICATION_INVALID');
  validateDirectoryRules(classification.directoryRules);
  for (const record of [
    ...classification.directoryRules,
    ...(Array.isArray(classification.exceptions) ? classification.exceptions : []),
  ]) {
    if (record?.state === 'core_permanent') {
      fail('POLICY_STATIC_CORE_FORBIDDEN');
    }
  }
  const diagnostics = analyzePolicyExceptions({ policy: { classification } });
  if (diagnostics.redundantExceptionCount > 0) {
    fail('POLICY_EXCEPTION_REDUNDANT', {
      redundantExceptionCount: diagnostics.redundantExceptionCount,
    });
  }
}

function validateTestPolicy(policy) {
  requireObject(policy, 'POLICY_INVALID');
  if (policy.schemaVersion !== 'test-portfolio-policy/v1') {
    fail('POLICY_SCHEMA_VERSION_INVALID');
  }
  if (
    Object.prototype.hasOwnProperty.call(policy, 'tests') ||
    Object.prototype.hasOwnProperty.call(policy, 'catalog')
  ) {
    fail('POLICY_GENERATED_CATALOG_FORBIDDEN');
  }
  requireExactValues(policy.profiles, PROFILES, 'POLICY_PROFILES_INVALID');
  requireObject(policy.budgets, 'POLICY_BUDGETS_INVALID');
  requireBudget(policy.budgets.executableTestCount, 1200, 'POLICY_EXECUTABLE_BUDGET_INVALID');
  requireInteger(policy.budgets.corePermanentCount, 'POLICY_CORE_BUDGET_INVALID', 0, 120);
  requireBudget(policy.budgets.prP95Minutes, 10, 'POLICY_PR_TIME_BUDGET_INVALID');
  validateSemanticObligations(policy.semanticObligations);
  validateSemanticJourneys(policy.semanticJourneys);
  validateProtectedCapabilities(policy.protectedCapabilities, policy.semanticObligations);
  validateSemanticEvidenceBindings(policy);
  validateClassification(policy.classification);
  validateSelection(policy.selection);
  validateTiming(policy.timing);
  validateDeletion(policy.deletion);
  return policy;
}

function readTestPolicy(repoRoot, policyPath = 'repo-governance/ci/test-policy.json') {
  const root = path.resolve(repoRoot);
  const absolutePath = path.resolve(root, policyPath);
  const relative = path.relative(root, absolutePath);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail('POLICY_PATH_OUTSIDE_REPO', { policyPath: absolutePath });
  }
  const policy = validateTestPolicy(JSON.parse(fs.readFileSync(absolutePath, 'utf8')));
  validateTask4SelectionAuthority(policy.selection);
  return policy;
}

module.exports = {
  COMMON_REQUIRED_BEHAVIORS,
  PROFILES,
  SIX_MODEL_ORDER,
  STATES,
  analyzePolicyExceptions,
  expandCapabilityBehaviorBindings,
  expandSemanticObligations,
  isCanonicalNamespacedRef,
  readTestPolicy,
  validateSemanticJourneys,
  validateTestPolicy,
};
