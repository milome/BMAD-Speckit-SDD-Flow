const { createHash } = require('node:crypto');

const EVIDENCE_STRENGTH = Object.freeze({
  coverage: 1,
  projection: 1,
  static: 2,
  receipt_field: 2,
  cli_output: 3,
  behavior: 3,
  integration: 4,
  manual: 4,
  release: 5,
});

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function failure(failureClass, details = {}) {
  const error = new Error(failureClass);
  Object.assign(error, { failureClass, ...details });
  return error;
}

function normalizedArray(value) {
  return [...new Set((value || []).filter(Boolean).map(String))].sort();
}

function normalizeExpectedEvidence(item) {
  const normalized = structuredClone(item || {});
  for (const field of [
    'admissibleObservedEvidenceTypes',
    'requiredFields',
    'requiredProvenanceFields',
  ]) {
    normalized[field] = normalizedArray(normalized[field]);
  }
  if (normalized.negativeControl?.acceptedBlockerClasses) {
    normalized.negativeControl.acceptedBlockerClasses = normalizedArray(
      normalized.negativeControl.acceptedBlockerClasses
    );
  }
  return normalized;
}

function validateExpectedEvidence(items) {
  const issues = [];
  const seen = new Set();
  const requiredScalarFields = [
    'id',
    'producer',
    'commandId',
    'productionEntryPoint',
    'minimumStrength',
    'failureClass',
    'requiredCapability',
  ];
  for (const item of items) {
    for (const field of requiredScalarFields) {
      if (!String(item[field] || '').trim()) {
        issues.push({ code: 'expected_evidence_field_missing', evidenceId: item.id || null, field });
      }
    }
    for (const field of [
      'admissibleObservedEvidenceTypes',
      'requiredFields',
      'requiredProvenanceFields',
    ]) {
      if (!Array.isArray(item[field]) || item[field].length === 0) {
        issues.push({ code: 'expected_evidence_field_missing', evidenceId: item.id || null, field });
      }
    }
    if (
      !Number.isFinite(item.freshness?.maxAgeMs) ||
      item.freshness.maxAgeMs <= 0
    ) {
      issues.push({ code: 'expected_evidence_freshness_invalid', evidenceId: item.id || null });
    }
    if (!EVIDENCE_STRENGTH[item.minimumStrength]) {
      issues.push({ code: 'expected_evidence_strength_invalid', evidenceId: item.id || null });
    }
    if (seen.has(item.id)) {
      issues.push({ code: 'expected_evidence_id_duplicate', evidenceId: item.id });
    }
    seen.add(item.id);
  }
  return issues;
}

function freezeExpectedEvidenceRegistry({
  expectedEvidence,
  contractHash,
  frozenAt,
  implementationStartedAt = null,
}) {
  const frozenTime = Date.parse(frozenAt);
  const implementationTime = implementationStartedAt
    ? Date.parse(implementationStartedAt)
    : null;
  if (
    !Number.isFinite(frozenTime) ||
    (implementationTime !== null &&
      (!Number.isFinite(implementationTime) ||
        frozenTime >= implementationTime))
  ) {
    throw failure('expected_evidence_freeze_late', {
      frozenAt,
      implementationStartedAt,
    });
  }
  if (!String(contractHash || '').trim()) {
    throw failure('expected_evidence_contract_hash_missing');
  }
  const items = (expectedEvidence || [])
    .map(normalizeExpectedEvidence)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const issues = validateExpectedEvidence(items);
  if (items.length === 0 || issues.length > 0) {
    throw failure('expected_evidence_registry_incomplete', { issues });
  }
  const registry = {
    schemaVersion: 'goal-contract-expected-evidence-registry/v1',
    contractHash,
    frozenAt: new Date(frozenTime).toISOString(),
    implementationStartedAt:
      implementationTime === null
        ? null
        : new Date(implementationTime).toISOString(),
    itemCount: items.length,
    immutable: true,
    items,
  };
  registry.registryHash = sha256(
    Buffer.from(stableStringify(registry), 'utf8')
  );
  return deepFreeze(registry);
}

function validateExpectedEvidenceMutation({
  frozenRegistry,
  candidateExpectedEvidence,
  implementationStarted,
}) {
  const candidate = (candidateExpectedEvidence || [])
    .map(normalizeExpectedEvidence)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const candidateHash = sha256(
    Buffer.from(stableStringify(candidate), 'utf8')
  );
  const frozenItemsHash = sha256(
    Buffer.from(stableStringify(frozenRegistry?.items || []), 'utf8')
  );
  if (candidateHash === frozenItemsHash) {
    return {
      decision: 'pass',
      registryHash: frozenRegistry.registryHash,
      changed: false,
    };
  }
  if (implementationStarted) {
    throw failure('expected_evidence_weakening_forbidden', {
      frozenRegistryHash: frozenRegistry?.registryHash || null,
      candidateHash,
    });
  }
  return {
    decision: 'reconfirm',
    failureClass: 'RECONFIRM_REQUIRED',
    changed: true,
    candidateHash,
  };
}

module.exports = {
  EVIDENCE_STRENGTH,
  freezeExpectedEvidenceRegistry,
  validateExpectedEvidenceMutation,
};
