'use strict';

const { compareText, fail } = require('./canonical-artifact.cjs');

const ACTIONS = new Set([
  'promote_to_core',
  'merge_to_contract_test',
  'retain_on_demand',
  'delete_after_closeout',
]);
const LIFECYCLE_STATES = new Set([
  'core_permanent',
  'feature_working_set',
  'retained_on_demand',
  'deletion_candidate',
]);
const CATALOG_TEST_FIELDS = Object.freeze([
  'identityKey',
  'runnerId',
  'testPath',
  'executableIdentity',
  'packageId',
  'capabilityRefs',
  'failureModeRefs',
  'traceRefs',
  'featureRefs',
  'fixtureRefs',
  'lifecycleState',
  'releaseGateMembership',
  'durationSummary',
  'classifications',
  'evidenceRefs',
]);
const OPTIONAL_TEST_REF_FIELDS = Object.freeze(['traceRefs', 'fixtureRefs', 'evidenceRefs']);
const CORE_PERMANENT_HARD_LIMIT = 120;
const hasOwn = Object.prototype.hasOwnProperty;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownValue(record, field) {
  if (!isPlainObject(record) || !hasOwn.call(record, field)) return undefined;
  return record[field];
}

function containerIssueCode(path) {
  if (path === 'input.catalog') return 'FEATURE_CLOSEOUT_CATALOG_INVALID';
  if (path.startsWith('input.catalog.tests[')) {
    return 'FEATURE_CLOSEOUT_CATALOG_TEST_INVALID';
  }
  if (path === 'input.policy' || path === 'input.policy.budgets') {
    return 'FEATURE_CLOSEOUT_POLICY_INVALID';
  }
  if (path === 'input.policy.selection') {
    return 'FEATURE_CLOSEOUT_POLICY_SELECTION_INVALID';
  }
  if (path.startsWith('input.policy.protectedCapabilities[')) {
    return 'FEATURE_CLOSEOUT_POLICY_PROTECTED_CAPABILITY_INVALID';
  }
  if (path === 'input.dispositions') {
    return 'FEATURE_CLOSEOUT_DISPOSITIONS_INVALID';
  }
  if (path.startsWith('input.dispositions.')) {
    return 'FEATURE_CLOSEOUT_DISPOSITION_INVALID';
  }
  return 'FEATURE_CLOSEOUT_JSON_VALUE_INVALID';
}

function valueIssueCode(path) {
  if (path === 'input.featureRef') return 'FEATURE_CLOSEOUT_FEATURE_REF_INVALID';
  if (path === 'input.policy.budgets.corePermanentCount') {
    return 'CORE_PERMANENT_BUDGET_INVALID';
  }
  return 'FEATURE_CLOSEOUT_JSON_VALUE_INVALID';
}

function cloneJsonDto(value, path = 'input', ancestors = new WeakSet()) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value !== 'object') {
    fail(valueIssueCode(path), { path });
  }
  if (ancestors.has(value)) {
    fail('FEATURE_CLOSEOUT_JSON_VALUE_INVALID', { path });
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        fail(containerIssueCode(path), { path });
      }
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key === 'symbol') {
          fail('FEATURE_CLOSEOUT_JSON_VALUE_INVALID', { path });
        }
        if (key === 'length') continue;
        const index = Number(key);
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= value.length ||
          String(index) !== key
        ) {
          fail('FEATURE_CLOSEOUT_JSON_VALUE_INVALID', { path });
        }
      }
      const cloned = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !hasOwn.call(descriptor, 'value') || descriptor.enumerable !== true) {
          fail(
            descriptor && !hasOwn.call(descriptor, 'value')
              ? 'FEATURE_CLOSEOUT_JSON_ACCESSOR_INVALID'
              : 'FEATURE_CLOSEOUT_JSON_VALUE_INVALID',
            { path: `${path}[${index}]` }
          );
        }
        cloned.push(cloneJsonDto(descriptor.value, `${path}[${index}]`, ancestors));
      }
      return cloned;
    }
    if (!isPlainObject(value)) {
      fail(containerIssueCode(path), { path });
    }
    const cloned = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol') {
        fail('FEATURE_CLOSEOUT_JSON_VALUE_INVALID', { path });
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !hasOwn.call(descriptor, 'value')) {
        fail('FEATURE_CLOSEOUT_JSON_ACCESSOR_INVALID', { path: `${path}.${key}` });
      }
      if (descriptor.enumerable !== true) {
        fail('FEATURE_CLOSEOUT_JSON_VALUE_INVALID', { path: `${path}.${key}` });
      }
      cloned[key] = cloneJsonDto(descriptor.value, `${path}.${key}`, ancestors);
    }
    return cloned;
  } finally {
    ancestors.delete(value);
  }
}

function normalizeStringArray(value, issueCode) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0) ||
    new Set(value).size !== value.length
  ) {
    fail(issueCode);
  }
  return [...value];
}

function normalizeDispositions(dispositions) {
  if (!isPlainObject(dispositions)) fail('FEATURE_CLOSEOUT_DISPOSITIONS_INVALID');
  const normalized = Object.create(null);
  for (const [identityKey, disposition] of Object.entries(dispositions)) {
    if (!isPlainObject(disposition)) {
      fail('FEATURE_CLOSEOUT_DISPOSITION_INVALID', { identityKey });
    }
    normalized[identityKey] = {};
    for (const field of ['action', 'capabilityRef', 'replacementIdentityKey']) {
      if (hasOwn.call(disposition, field)) normalized[identityKey][field] = disposition[field];
    }
  }
  return normalized;
}

function normalizeCatalog(catalog) {
  if (
    !isPlainObject(catalog) ||
    !hasOwn.call(catalog, 'schemaVersion') ||
    catalog.schemaVersion !== 'test-catalog/v1' ||
    !hasOwn.call(catalog, 'tests') ||
    !Array.isArray(catalog.tests)
  ) {
    fail('FEATURE_CLOSEOUT_CATALOG_INVALID');
  }
  const requiredOwnFields = [
    'identityKey',
    'testPath',
    'lifecycleState',
    'featureRefs',
    'capabilityRefs',
    'failureModeRefs',
    'classifications',
  ];
  return {
    schemaVersion: catalog.schemaVersion,
    tests: catalog.tests.map((test, index) => {
      if (
        !isPlainObject(test) ||
        requiredOwnFields.some((field) => !hasOwn.call(test, field)) ||
        typeof test.identityKey !== 'string' ||
        test.identityKey.length === 0 ||
        typeof test.testPath !== 'string' ||
        test.testPath.length === 0 ||
        !isPlainObject(test.classifications) ||
        !LIFECYCLE_STATES.has(test.lifecycleState)
      ) {
        fail(
          LIFECYCLE_STATES.has(test.lifecycleState)
            ? 'FEATURE_CLOSEOUT_CATALOG_TEST_INVALID'
            : 'FEATURE_CLOSEOUT_LIFECYCLE_STATE_INVALID',
          { index }
        );
      }
      const normalizedRefs = {
        featureRefs: normalizeStringArray(
          test.featureRefs,
          'FEATURE_CLOSEOUT_FEATURE_REFS_INVALID'
        ),
        capabilityRefs: normalizeStringArray(
          test.capabilityRefs,
          'FEATURE_CLOSEOUT_CAPABILITY_REFS_INVALID'
        ),
        failureModeRefs: normalizeStringArray(
          test.failureModeRefs,
          'FEATURE_CLOSEOUT_FAILURE_MODE_REFS_INVALID'
        ),
      };
      for (const field of OPTIONAL_TEST_REF_FIELDS) {
        if (hasOwn.call(test, field)) {
          normalizedRefs[field] = normalizeStringArray(
            test[field],
            'FEATURE_CLOSEOUT_CATALOG_TEST_INVALID'
          );
        }
      }
      const classifications = { ...test.classifications };
      if (hasOwn.call(classifications, 'protectedCapabilityRefs')) {
        classifications.protectedCapabilityRefs = normalizeStringArray(
          classifications.protectedCapabilityRefs,
          'FEATURE_CLOSEOUT_CATALOG_TEST_INVALID'
        );
      }
      const normalized = {};
      for (const field of CATALOG_TEST_FIELDS) {
        if (!hasOwn.call(test, field)) continue;
        if (hasOwn.call(normalizedRefs, field)) {
          normalized[field] = normalizedRefs[field];
        } else if (field === 'classifications') {
          normalized[field] = classifications;
        } else if (field === 'durationSummary') {
          if (!isPlainObject(test[field])) {
            fail('FEATURE_CLOSEOUT_CATALOG_TEST_INVALID', { index });
          }
          normalized[field] = { ...test[field] };
        } else {
          normalized[field] = test[field];
        }
      }
      return normalized;
    }),
  };
}

function normalizePolicyClassificationRecord(record) {
  if (!isPlainObject(record)) fail('FEATURE_CLOSEOUT_POLICY_CLASSIFICATION_INVALID');
  const normalized = {};
  for (const field of ['ruleId', 'pattern', 'testPath', 'state', 'capabilityRefs']) {
    if (!hasOwn.call(record, field)) continue;
    if (field === 'capabilityRefs') {
      normalized[field] = normalizeStringArray(
        record[field],
        'FEATURE_CLOSEOUT_POLICY_CLASSIFICATION_INVALID'
      );
    } else if (field === 'state' && !LIFECYCLE_STATES.has(record[field])) {
      fail('FEATURE_CLOSEOUT_POLICY_CLASSIFICATION_INVALID');
    } else {
      normalized[field] = record[field];
    }
  }
  return normalized;
}

function normalizePolicy(policy) {
  if (
    !isPlainObject(policy) ||
    !hasOwn.call(policy, 'budgets') ||
    !isPlainObject(policy.budgets) ||
    !hasOwn.call(policy, 'protectedCapabilities') ||
    !Array.isArray(policy.protectedCapabilities)
  ) {
    fail('FEATURE_CLOSEOUT_POLICY_INVALID');
  }
  const normalized = {
    budgets: {
      corePermanentCount: ownValue(policy.budgets, 'corePermanentCount'),
    },
    protectedCapabilities: policy.protectedCapabilities.map((capability, index) => {
      if (
        !isPlainObject(capability) ||
        !hasOwn.call(capability, 'capabilityId') ||
        typeof capability.capabilityId !== 'string' ||
        capability.capabilityId.trim().length === 0 ||
        !hasOwn.call(capability, 'selectionRefs')
      ) {
        fail('FEATURE_CLOSEOUT_POLICY_PROTECTED_CAPABILITY_INVALID', { index });
      }
      return {
        capabilityId: capability.capabilityId,
        selectionRefs: normalizeStringArray(
          capability.selectionRefs,
          'FEATURE_CLOSEOUT_POLICY_PROTECTED_CAPABILITY_INVALID'
        ),
      };
    }),
  };
  if (hasOwn.call(policy, 'selection')) {
    if (!isPlainObject(policy.selection)) {
      fail('FEATURE_CLOSEOUT_POLICY_SELECTION_INVALID');
    }
    if (!hasOwn.call(policy.selection, 'productSurvivalCapabilityRefs')) {
      fail('FEATURE_CLOSEOUT_PRODUCT_SURVIVAL_CAPABILITIES_INVALID');
    }
    normalized.selection = {
      productSurvivalCapabilityRefs: normalizeStringArray(
        policy.selection.productSurvivalCapabilityRefs,
        'FEATURE_CLOSEOUT_PRODUCT_SURVIVAL_CAPABILITIES_INVALID'
      ),
    };
  }
  if (hasOwn.call(policy, 'classification')) {
    if (!isPlainObject(policy.classification)) {
      fail('FEATURE_CLOSEOUT_POLICY_CLASSIFICATION_INVALID');
    }
    const directoryRules = ownValue(policy.classification, 'directoryRules');
    const exceptions = ownValue(policy.classification, 'exceptions');
    if (!Array.isArray(directoryRules) || !Array.isArray(exceptions)) {
      fail('FEATURE_CLOSEOUT_POLICY_CLASSIFICATION_INVALID');
    }
    normalized.classification = {
      directoryRules: directoryRules.map(normalizePolicyClassificationRecord),
      exceptions: exceptions.map(normalizePolicyClassificationRecord),
    };
  }
  return normalized;
}

function normalizeRelativePath(value) {
  return String(value || '')
    .replace(/\\/gu, '/')
    .replace(/^\.\//u, '');
}

function normalizedTestPath(test) {
  const explicitPath = normalizeRelativePath(test.testPath);
  if (explicitPath) return explicitPath;
  const identityKey = String(test.identityKey || '');
  for (const separator of ['::', '#']) {
    const separatorIndex = identityKey.indexOf(separator);
    if (separatorIndex >= 0) {
      return normalizeRelativePath(identityKey.slice(separatorIndex + separator.length));
    }
  }
  return '';
}

function stableUnique(values) {
  return [
    ...new Set((values || []).filter((value) => typeof value === 'string' && value.length > 0)),
  ].sort(compareText);
}

function validateEvidenceRefs(catalog, field, issueCode) {
  for (const test of catalog.tests) {
    const refs = test[field];
    if (
      !Array.isArray(refs) ||
      refs.some((ref) => typeof ref !== 'string' || ref.trim().length === 0) ||
      new Set(refs).size !== refs.length
    ) {
      fail(issueCode, {
        identityKey: test.identityKey,
      });
    }
  }
}

function isSuperset(actual, required) {
  const values = new Set(actual || []);
  return (required || []).every((value) => values.has(value));
}

function coverageIsConserved(replacement, original) {
  return (
    isSuperset(replacement.capabilityRefs, original.capabilityRefs) &&
    isSuperset(replacement.failureModeRefs, original.failureModeRefs)
  );
}

function policyPatchIntent(test, disposition) {
  switch (disposition.action) {
    case 'promote_to_core':
      return {
        capabilityRefs: stableUnique([...(test.capabilityRefs || []), disposition.capabilityRef]),
      };
    case 'retain_on_demand':
      return {
        state: 'retained_on_demand',
      };
    case 'merge_to_contract_test':
    case 'delete_after_closeout':
      return {
        state: 'deletion_candidate',
      };
    default:
      return {};
  }
}

function policyPatchIntentIsEqual(left, right) {
  const fields = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...fields].every((field) => equalPolicyField(left[field], right[field]));
}

function validatePathDispositionCompatibility({ catalog, dispositions }) {
  const byPath = new Map();
  for (const test of catalog.tests) {
    const disposition = dispositions[test.identityKey];
    if (!disposition) continue;
    const testPath = normalizedTestPath(test);
    const intent = policyPatchIntent(test, disposition);
    const existing = byPath.get(testPath);
    if (existing && !policyPatchIntentIsEqual(existing.intent, intent)) {
      fail('FEATURE_CLOSEOUT_PATH_DISPOSITION_CONFLICT', {
        testPath,
        identityKeys: [existing.identityKey, test.identityKey].sort(compareText),
      });
    }
    if (!existing) byPath.set(testPath, { identityKey: test.identityKey, intent });
  }
}

function validateFinalCoreEquivalence({ catalog, finalTests }) {
  const originalCoreIdentityKeys = new Set(
    catalog.tests
      .filter((test) => test.lifecycleState === 'core_permanent')
      .map((test) => test.identityKey)
  );
  const finalCore = finalTests.filter((test) => test.lifecycleState === 'core_permanent');
  for (const promoted of finalCore.filter(
    (test) => !originalCoreIdentityKeys.has(test.identityKey)
  )) {
    const equivalentCore = finalCore.find(
      (candidate) =>
        candidate.identityKey !== promoted.identityKey && coverageIsConserved(candidate, promoted)
    );
    if (equivalentCore) {
      fail('FEATURE_CLOSEOUT_EQUIVALENT_CORE_EXISTS', {
        identityKey: promoted.identityKey,
        equivalentIdentityKey: equivalentCore.identityKey,
      });
    }
  }
}

function validatePathIdentitySafety({ catalog, dispositions, policyPatch, finalTests }) {
  const finalByIdentity = new Map(finalTests.map((test) => [test.identityKey, test]));
  for (const patch of policyPatch.classification?.exceptions || []) {
    const testPath = normalizeRelativePath(patch.testPath);
    for (const test of catalog.tests.filter(
      (candidate) => normalizedTestPath(candidate) === testPath
    )) {
      if (Object.prototype.hasOwnProperty.call(dispositions, test.identityKey)) continue;
      const finalTest = finalByIdentity.get(test.identityKey);
      const lifecycleChanged = finalTest?.lifecycleState !== test.lifecycleState;
      const capabilitiesChanged = !equalPolicyField(finalTest?.capabilityRefs, test.capabilityRefs);
      if (lifecycleChanged || capabilitiesChanged) {
        fail('FEATURE_CLOSEOUT_PATH_IDENTITY_UNSAFE', {
          testPath,
          identityKey: test.identityKey,
          lifecycleState: test.lifecycleState,
          finalLifecycleState: finalTest?.lifecycleState,
        });
      }
    }
  }
}

function matchesDirectoryRule(testPath, pattern) {
  const normalized = normalizeRelativePath(pattern);
  if (!normalized.endsWith('/**')) return false;
  const base = normalized.slice(0, -3).replace(/\/+$/u, '');
  return testPath === base || testPath.startsWith(`${base}/`);
}

function effectivePolicyFields(testPath, policy) {
  const classification = policy.classification;
  if (!classification) return {};
  const normalizedPath = normalizeRelativePath(testPath);
  const matchingRules = (classification.directoryRules || [])
    .filter((rule) => matchesDirectoryRule(normalizedPath, rule.pattern))
    .sort((left, right) => {
      const leftSpecificity = normalizeRelativePath(left.pattern).split('/').length;
      const rightSpecificity = normalizeRelativePath(right.pattern).split('/').length;
      if (leftSpecificity !== rightSpecificity) return rightSpecificity - leftSpecificity;
      return compareText(left.ruleId, right.ruleId);
    });
  const fields = matchingRules[0] ? policyFields(matchingRules[0]) : {};
  const exceptions = (classification.exceptions || [])
    .filter((entry) => normalizeRelativePath(entry.testPath) === normalizedPath)
    .sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right)));
  for (const exception of exceptions) Object.assign(fields, policyFields(exception));
  return fields;
}

function policyFields(record) {
  const fields = {};
  for (const field of ['state', 'capabilityRefs']) {
    if (Object.prototype.hasOwnProperty.call(record, field)) fields[field] = record[field];
  }
  return fields;
}

function equalPolicyField(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(stableUnique(left)) === JSON.stringify(stableUnique(right));
  }
  return left === right;
}

function attachPolicyPatch(updated, policy, desiredFields, policyPatchMetadata) {
  const existing = effectivePolicyFields(updated.testPath, policy);
  const changed = {};
  for (const [field, value] of Object.entries(desiredFields)) {
    if (!equalPolicyField(existing[field], value)) changed[field] = value;
  }
  if (Object.keys(changed).length > 0) {
    policyPatchMetadata.set(updated.identityKey, changed);
  }
  return updated;
}

function transition(test, lifecycleState, lifecycleReason) {
  return {
    ...test,
    lifecycleState,
    classifications: {
      ...(test.classifications || {}),
      lifecycleReason,
    },
  };
}

function promoteToCore({ test, disposition, catalog, policy, policyPatchMetadata }) {
  const capabilityRef = disposition.capabilityRef;
  const protectedCapabilities = new Set(
    (policy.protectedCapabilities || []).map((entry) => entry.capabilityId)
  );
  if (!protectedCapabilities.has(capabilityRef)) {
    fail('FEATURE_CLOSEOUT_CORE_CAPABILITY_NOT_PROTECTED', {
      identityKey: test.identityKey,
      capabilityRef,
    });
  }
  const productSurvivalCapabilityRefs = new Set(
    policy.selection?.productSurvivalCapabilityRefs || []
  );
  if (!productSurvivalCapabilityRefs.has(capabilityRef)) {
    fail('FEATURE_CLOSEOUT_CORE_CAPABILITY_NOT_PRODUCT_SURVIVAL', {
      identityKey: test.identityKey,
      capabilityRef,
    });
  }
  if (ownValue(test.classifications, 'oracleEffectiveness') !== 'effective') {
    fail('CORE_TEST_ORACLE_NOT_INDEPENDENT', { identityKey: test.identityKey });
  }

  const capabilityRefs = stableUnique([...(test.capabilityRefs || []), capabilityRef]);
  const promoted = { ...test, capabilityRefs };
  const equivalentCore = catalog.tests.find(
    (candidate) =>
      candidate.identityKey !== test.identityKey &&
      candidate.lifecycleState === 'core_permanent' &&
      coverageIsConserved(candidate, promoted)
  );
  if (equivalentCore) {
    fail('FEATURE_CLOSEOUT_EQUIVALENT_CORE_EXISTS', {
      identityKey: test.identityKey,
      equivalentIdentityKey: equivalentCore.identityKey,
    });
  }

  const updated = transition(test, 'core_permanent', {
    kind: 'protected_capability_binding',
    refs: [capabilityRef],
  });
  updated.capabilityRefs = capabilityRefs;
  updated.classifications.protectedCapabilityRefs = stableUnique([
    ...(updated.classifications.protectedCapabilityRefs || []),
    capabilityRef,
  ]);
  return attachPolicyPatch(
    updated,
    policy,
    {
      capabilityRefs,
    },
    policyPatchMetadata
  );
}

function requireReplacementIdentity(test, disposition) {
  if (
    typeof disposition.replacementIdentityKey !== 'string' ||
    disposition.replacementIdentityKey.length === 0
  ) {
    fail('CONTRACT_TEST_REPLACEMENT_REQUIRED', { identityKey: test.identityKey });
  }
  return disposition.replacementIdentityKey;
}

function terminalReplacementView(test, disposition) {
  if (!disposition) return test;
  if (disposition.action === 'promote_to_core') {
    return {
      ...test,
      lifecycleState: 'core_permanent',
      capabilityRefs: stableUnique([...(test.capabilityRefs || []), disposition.capabilityRef]),
    };
  }
  if (disposition.action === 'retain_on_demand') {
    return { ...test, lifecycleState: 'retained_on_demand' };
  }
  if (disposition.action === 'delete_after_closeout') {
    return { ...test, lifecycleState: 'deletion_candidate' };
  }
  return test;
}

function resolveFinalReplacement({ test, disposition, catalogByIdentity, dispositions }) {
  const visited = new Set([test.identityKey]);
  let replacementIdentityKey = requireReplacementIdentity(test, disposition);

  for (let depth = 0; depth <= catalogByIdentity.size; depth += 1) {
    if (visited.has(replacementIdentityKey)) {
      fail('CONTRACT_TEST_REPLACEMENT_CYCLE', {
        identityKey: test.identityKey,
        replacementIdentityKey,
      });
    }
    visited.add(replacementIdentityKey);
    const replacement = catalogByIdentity.get(replacementIdentityKey);
    if (!replacement) {
      fail('CONTRACT_TEST_REPLACEMENT_NOT_FOUND', {
        identityKey: test.identityKey,
        replacementIdentityKey,
      });
    }
    const replacementDisposition = dispositions[replacementIdentityKey];
    if (replacementDisposition?.action === 'merge_to_contract_test') {
      replacementIdentityKey = requireReplacementIdentity(replacement, replacementDisposition);
      continue;
    }

    const finalReplacement = terminalReplacementView(replacement, replacementDisposition);
    if (!['core_permanent', 'retained_on_demand'].includes(finalReplacement.lifecycleState)) {
      fail('CONTRACT_TEST_REPLACEMENT_NOT_RETAINED', {
        identityKey: test.identityKey,
        replacementIdentityKey,
        lifecycleState: finalReplacement.lifecycleState,
      });
    }
    return finalReplacement;
  }
  fail('CONTRACT_TEST_REPLACEMENT_CYCLE', { identityKey: test.identityKey });
}

function finalReplacementMap({ catalog, dispositions }) {
  const catalogByIdentity = new Map(catalog.tests.map((test) => [test.identityKey, test]));
  const replacements = new Map();
  for (const test of catalog.tests) {
    const disposition = dispositions[test.identityKey];
    if (disposition?.action !== 'merge_to_contract_test') continue;
    replacements.set(
      test.identityKey,
      resolveFinalReplacement({ test, disposition, catalogByIdentity, dispositions })
    );
  }
  return replacements;
}

function mergeToContractTest({
  test,
  disposition,
  finalReplacements,
  policy,
  featureRef,
  policyPatchMetadata,
}) {
  const replacement = finalReplacements.get(test.identityKey);
  if (!replacement) {
    fail('CONTRACT_TEST_REPLACEMENT_NOT_FOUND', {
      identityKey: test.identityKey,
      replacementIdentityKey: disposition.replacementIdentityKey,
    });
  }
  if (stableUnique(test.failureModeRefs || []).length === 0) {
    fail('CONTRACT_TEST_FAILURE_MODE_EVIDENCE_REQUIRED', {
      identityKey: test.identityKey,
      replacementIdentityKey: replacement.identityKey,
    });
  }
  if (!coverageIsConserved(replacement, test)) {
    fail('CONTRACT_TEST_COVERAGE_NOT_CONSERVED', {
      identityKey: test.identityKey,
      replacementIdentityKey: replacement.identityKey,
    });
  }
  if (ownValue(replacement.classifications, 'oracleEffectiveness') !== 'effective') {
    fail('CONTRACT_TEST_ORACLE_NOT_INDEPENDENT', {
      replacementIdentityKey: replacement.identityKey,
    });
  }
  return attachPolicyPatch(
    transition(test, 'deletion_candidate', {
      kind: 'feature_closeout_disposition',
      action: 'merge_to_contract_test',
      refs: [featureRef, replacement.identityKey],
    }),
    policy,
    { state: 'deletion_candidate' },
    policyPatchMetadata
  );
}

function applyDisposition({
  test,
  disposition,
  catalog,
  finalReplacements,
  policy,
  featureRef,
  policyPatchMetadata,
}) {
  switch (disposition.action) {
    case 'promote_to_core':
      return promoteToCore({
        test,
        disposition,
        catalog,
        policy,
        policyPatchMetadata,
      });
    case 'merge_to_contract_test':
      return mergeToContractTest({
        test,
        disposition,
        finalReplacements,
        policy,
        featureRef,
        policyPatchMetadata,
      });
    case 'retain_on_demand':
      return attachPolicyPatch(
        transition(test, 'retained_on_demand', {
          kind: 'feature_closeout_disposition',
          action: disposition.action,
          refs: [featureRef],
        }),
        policy,
        { state: 'retained_on_demand' },
        policyPatchMetadata
      );
    case 'delete_after_closeout':
      return attachPolicyPatch(
        transition(test, 'deletion_candidate', {
          kind: 'feature_closeout_disposition',
          action: disposition.action,
          refs: [featureRef],
        }),
        policy,
        { state: 'deletion_candidate' },
        policyPatchMetadata
      );
    default:
      fail('FEATURE_CLOSEOUT_ACTION_INVALID', {
        identityKey: test.identityKey,
        action: disposition.action,
      });
  }
}

function buildPolicyPatch(updatedTests, policyPatchMetadata) {
  const byPath = new Map();
  for (const test of updatedTests) {
    const fields = policyPatchMetadata.get(test.identityKey);
    if (!fields) continue;
    const testPath = normalizeRelativePath(test.testPath);
    const existing = byPath.get(testPath);
    if (
      existing &&
      ![...new Set([...Object.keys(existing), ...Object.keys(fields)])].every((field) =>
        equalPolicyField(existing[field], fields[field])
      )
    ) {
      fail('FEATURE_CLOSEOUT_POLICY_PATCH_CONFLICT', { testPath });
    }
    if (!existing) byPath.set(testPath, fields);
  }
  const exceptions = [...byPath.entries()]
    .map(([testPath, fields]) => ({ testPath, ...fields }))
    .sort((left, right) => compareText(left.testPath, right.testPath));
  return exceptions.length > 0 ? { classification: { exceptions } } : {};
}

function finalEffectiveCatalogView({ updatedTests, policyPatch, policy }) {
  const patchesByPath = new Map(
    (policyPatch.classification?.exceptions || []).map((entry) => [
      normalizeRelativePath(entry.testPath),
      policyFields(entry),
    ])
  );
  const protectedCapabilities = new Set(
    (policy.protectedCapabilities || []).map((entry) => entry.capabilityId)
  );
  const productSurvivalCapabilityRefs = new Set(
    policy.selection?.productSurvivalCapabilityRefs || []
  );

  return updatedTests.map((test) => {
    const fields = patchesByPath.get(normalizedTestPath(test));
    if (!fields) return test;
    const effective = {
      ...test,
      classifications: { ...(test.classifications || {}) },
    };
    if (Object.prototype.hasOwnProperty.call(fields, 'capabilityRefs')) {
      effective.capabilityRefs = stableUnique(fields.capabilityRefs);
    }
    const protectedCapabilityRefs = stableUnique([
      ...(effective.classifications.protectedCapabilityRefs || []),
      ...(effective.capabilityRefs || []).filter(
        (capabilityRef) =>
          protectedCapabilities.has(capabilityRef) &&
          productSurvivalCapabilityRefs.has(capabilityRef)
      ),
    ]);
    if (protectedCapabilityRefs.length > 0) {
      effective.lifecycleState = 'core_permanent';
      effective.classifications.protectedCapabilityRefs = protectedCapabilityRefs;
      effective.classifications.lifecycleReason = {
        kind: 'protected_capability_binding',
        refs: protectedCapabilityRefs,
      };
    } else if (Object.prototype.hasOwnProperty.call(fields, 'state')) {
      effective.lifecycleState = fields.state;
      effective.classifications.lifecycleReason = {
        kind: 'policy_exception',
        refs: [normalizedTestPath(test)],
      };
    }
    return effective;
  });
}

function closeFeaturePortfolio(input) {
  const normalizedInput = cloneJsonDto(input);
  if (!isPlainObject(normalizedInput)) {
    fail('FEATURE_CLOSEOUT_JSON_VALUE_INVALID');
  }
  let catalog = ownValue(normalizedInput, 'catalog');
  let policy = ownValue(normalizedInput, 'policy');
  const featureRef = ownValue(normalizedInput, 'featureRef');
  let dispositions = ownValue(normalizedInput, 'dispositions');
  if (typeof featureRef !== 'string' || featureRef.trim().length === 0) {
    fail('FEATURE_CLOSEOUT_FEATURE_REF_INVALID');
  }
  policy = normalizePolicy(policy);
  if (
    !Number.isSafeInteger(policy.budgets.corePermanentCount) ||
    policy.budgets.corePermanentCount < 0 ||
    policy.budgets.corePermanentCount > CORE_PERMANENT_HARD_LIMIT
  ) {
    fail('CORE_PERMANENT_BUDGET_INVALID');
  }
  catalog = normalizeCatalog(catalog);
  dispositions = normalizeDispositions(dispositions);
  validateEvidenceRefs(catalog, 'capabilityRefs', 'FEATURE_CLOSEOUT_CAPABILITY_REFS_INVALID');
  validateEvidenceRefs(catalog, 'failureModeRefs', 'FEATURE_CLOSEOUT_FAILURE_MODE_REFS_INVALID');

  const working = catalog.tests.filter(
    (test) =>
      test.lifecycleState === 'feature_working_set' && (test.featureRefs || []).includes(featureRef)
  );

  for (const test of catalog.tests) {
    const disposition = dispositions[test.identityKey];
    if (!disposition) continue;
    if (test.lifecycleState === 'core_permanent') {
      fail('CORE_TEST_CHANGE_REQUIRES_SEPARATE_FLOW', [test.identityKey]);
    }
    if (!ACTIONS.has(disposition.action)) {
      fail('FEATURE_CLOSEOUT_ACTION_INVALID', {
        identityKey: test.identityKey,
        action: disposition.action,
      });
    }
  }
  const workingIdentityKeys = new Set(working.map((test) => test.identityKey));
  const invalidDispositionIdentityKeys = Object.keys(dispositions)
    .filter((identityKey) => !workingIdentityKeys.has(identityKey))
    .sort(compareText);
  if (invalidDispositionIdentityKeys.length > 0) {
    fail('FEATURE_CLOSEOUT_DISPOSITION_IDENTITY_INVALID', invalidDispositionIdentityKeys);
  }
  if (working.length === 0) {
    fail('FEATURE_CLOSEOUT_WORKING_SET_EMPTY', { featureRef });
  }
  const missing = working.filter((test) => !dispositions[test.identityKey]);
  if (missing.length > 0) {
    fail(
      'FEATURE_CLOSEOUT_DISPOSITION_MISSING',
      missing.map((test) => test.identityKey)
    );
  }

  validatePathDispositionCompatibility({ catalog, dispositions });
  const finalReplacements = finalReplacementMap({ catalog, dispositions });
  const policyPatchMetadata = new Map();

  const updatedTests = catalog.tests.map((test) => {
    const disposition = dispositions[test.identityKey];
    if (!disposition) return test;
    return applyDisposition({
      test,
      disposition,
      catalog,
      finalReplacements,
      policy,
      featureRef,
      policyPatchMetadata,
    });
  });
  const policyPatch = buildPolicyPatch(updatedTests, policyPatchMetadata);
  const finalTests = finalEffectiveCatalogView({ updatedTests, policyPatch, policy });
  validateFinalCoreEquivalence({ catalog, finalTests });
  validatePathIdentitySafety({ catalog, dispositions, policyPatch, finalTests });

  const gates = {
    unclosedFeatureWorkingTestCount: finalTests.filter(
      (test) =>
        test.lifecycleState === 'feature_working_set' &&
        (test.featureRefs || []).includes(featureRef)
    ).length,
    corePermanentCount: finalTests.filter((test) => test.lifecycleState === 'core_permanent')
      .length,
  };
  if (gates.unclosedFeatureWorkingTestCount !== 0) fail('FEATURE_CLOSEOUT_INCOMPLETE');
  if (gates.corePermanentCount > policy.budgets.corePermanentCount) {
    fail('CORE_PERMANENT_BUDGET_EXCEEDED');
  }
  return { featureRef, updatedTests, policyPatch, gates };
}

module.exports = {
  closeFeaturePortfolio,
};
