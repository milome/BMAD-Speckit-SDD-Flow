"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.governanceEventTypeRegistryHash = governanceEventTypeRegistryHash;
exports.governanceEventTypeRegistryPolicyHash = governanceEventTypeRegistryPolicyHash;
exports.validateGovernanceTransportEnvelope = validateGovernanceTransportEnvelope;
exports.assertGovernanceTransportEnvelope = assertGovernanceTransportEnvelope;
const node_crypto_1 = require("node:crypto");
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function containsForbiddenResult(value) {
    if (!value || typeof value !== 'object')
        return false;
    if (Array.isArray(value))
        return value.some(containsForbiddenResult);
    const objectValue = value;
    return (Object.prototype.hasOwnProperty.call(objectValue, 'result') ||
        Object.values(objectValue).some(containsForbiddenResult));
}
function asRecord(value) {
    return isObject(value) ? value : null;
}
function strings(value) {
    return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    const objectValue = value;
    return `{${Object.keys(objectValue)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
        .join(',')}}`;
}
function sha256Object(value) {
    return `sha256:${(0, node_crypto_1.createHash)('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}
function normalizeRegistryRows(value) {
    const rows = Array.isArray(value)
        ? value
        : isObject(value) && Array.isArray(value.governanceEventTypeRegistry)
            ? value.governanceEventTypeRegistry
            : [];
    return rows
        .filter(isObject)
        .map((row) => ({
        eventType: text(row.eventType),
        payloadKind: text(row.payloadKind),
        allowedDecisionValues: strings(row.allowedDecisionValues),
        allowedStatusValues: strings(row.allowedStatusValues),
        writesControlFields: strings(row.writesControlFields),
        canAffectControlFlow: row.canAffectControlFlow === true,
        payloadContract: isObject(row.payloadContract)
            ? {
                requiredFields: strings(row.payloadContract.requiredFields),
                forbiddenFields: strings(row.payloadContract.forbiddenFields),
                requiredSourceRefs: row.payloadContract.requiredSourceRefs === true,
                allowedControlWriteMode: text(row.payloadContract.allowedControlWriteMode),
            }
            : undefined,
    }))
        .filter((row) => row.eventType);
}
function normalizePolicyRows(value) {
    const raw = isObject(value) ? value : {};
    return {
        controlFieldVocabulary: strings(raw.controlFieldVocabulary),
        payloadKindContracts: Array.isArray(raw.payloadKindContracts)
            ? raw.payloadKindContracts.filter(isObject).map((row) => ({
                payloadKind: text(row.payloadKind),
                requiredFields: strings(row.requiredFields),
                forbiddenFields: strings(row.forbiddenFields),
                allowedControlWriteModes: strings(row.allowedControlWriteModes),
            }))
            : [],
        controlWriteModePolicies: Array.isArray(raw.controlWriteModePolicies)
            ? raw.controlWriteModePolicies.filter(isObject).map((row) => ({
                allowedControlWriteMode: text(row.allowedControlWriteMode ?? row.mode),
                allowedWritesControlFields: strings(row.allowedWritesControlFields),
            }))
            : [],
        eventSpecificRequirements: Array.isArray(raw.eventSpecificRequirements)
            ? raw.eventSpecificRequirements.filter(isObject).map((row) => ({
                eventType: text(row.eventType),
                payloadKind: text(row.payloadKind),
                requiredSourceRefs: row.requiredSourceRefs === true,
                requiredFields: strings(row.requiredFields),
                forbiddenFields: strings(row.forbiddenFields),
                allowedControlWriteMode: text(row.allowedControlWriteMode),
            }))
            : [],
    };
}
function governanceEventTypeRegistryHash(registry) {
    return sha256Object(normalizeRegistryRows(registry).sort((left, right) => left.eventType.localeCompare(right.eventType)));
}
function governanceEventTypeRegistryPolicyHash(policy) {
    const normalized = normalizePolicyRows(policy);
    return sha256Object({
        controlFieldVocabulary: [...(normalized.controlFieldVocabulary ?? [])].sort(),
        payloadKindContracts: [...(normalized.payloadKindContracts ?? [])].sort((left, right) => left.payloadKind.localeCompare(right.payloadKind)),
        controlWriteModePolicies: [...(normalized.controlWriteModePolicies ?? [])].sort((left, right) => left.allowedControlWriteMode.localeCompare(right.allowedControlWriteMode)),
        eventSpecificRequirements: [...(normalized.eventSpecificRequirements ?? [])].sort((left, right) => left.eventType.localeCompare(right.eventType)),
    });
}
function registryPolicyFor(policy, mismatches) {
    const normalized = normalizePolicyRows(policy);
    const controlFieldVocabulary = new Set();
    for (const field of normalized.controlFieldVocabulary ?? []) {
        if (controlFieldVocabulary.has(field)) {
            mismatches.push(`envelope_event_registry_policy_control_field_vocabulary_duplicate:${field}`);
        }
        controlFieldVocabulary.add(field);
    }
    const payloadKindContracts = new Map();
    for (const row of normalized.payloadKindContracts ?? []) {
        if (!row.payloadKind) {
            mismatches.push('envelope_event_registry_policy_payload_kind_missing');
            continue;
        }
        if (payloadKindContracts.has(row.payloadKind)) {
            mismatches.push(`envelope_event_registry_policy_payload_kind_duplicate:${row.payloadKind}`);
        }
        payloadKindContracts.set(row.payloadKind, row);
    }
    const controlWriteModePolicies = new Map();
    for (const row of normalized.controlWriteModePolicies ?? []) {
        if (!row.allowedControlWriteMode) {
            mismatches.push('envelope_event_registry_policy_write_mode_missing');
            continue;
        }
        if (controlWriteModePolicies.has(row.allowedControlWriteMode)) {
            mismatches.push(`envelope_event_registry_policy_write_mode_duplicate:${row.allowedControlWriteMode}`);
        }
        for (const field of row.allowedWritesControlFields ?? []) {
            if (!controlFieldVocabulary.has(field)) {
                mismatches.push(`envelope_event_registry_policy_control_field_vocabulary_unknown:${field}`);
            }
        }
        controlWriteModePolicies.set(row.allowedControlWriteMode, row);
    }
    const eventSpecificRequirements = new Map();
    for (const row of normalized.eventSpecificRequirements ?? []) {
        if (!row.eventType) {
            mismatches.push('envelope_event_registry_policy_event_requirement_missing');
            continue;
        }
        if (eventSpecificRequirements.has(row.eventType)) {
            mismatches.push(`envelope_event_registry_policy_event_requirement_duplicate:${row.eventType}`);
        }
        eventSpecificRequirements.set(row.eventType, row);
    }
    if (!controlFieldVocabulary.size)
        mismatches.push('envelope_event_registry_policy_control_field_vocabulary_missing');
    if (!payloadKindContracts.size)
        mismatches.push('envelope_event_registry_policy_payload_kind_contracts_missing');
    if (!controlWriteModePolicies.size)
        mismatches.push('envelope_event_registry_policy_control_write_modes_missing');
    return {
        controlFieldVocabulary,
        payloadKindContracts,
        controlWriteModePolicies,
        eventSpecificRequirements,
        registryPolicyHash: controlFieldVocabulary.size && payloadKindContracts.size && controlWriteModePolicies.size
            ? governanceEventTypeRegistryPolicyHash(policy)
            : null,
    };
}
function registryMapFor(registry, mismatches) {
    const rows = normalizeRegistryRows(registry);
    if (!rows.length) {
        mismatches.push('envelope_event_registry_missing');
        return { rows: new Map(), registryHash: null };
    }
    const map = new Map();
    for (const row of rows) {
        if (map.has(row.eventType))
            mismatches.push(`envelope_event_registry_duplicate:${row.eventType}`);
        if (!row.payloadKind)
            mismatches.push(`envelope_event_registry_payload_kind_missing:${row.eventType}`);
        if (!row.payloadContract)
            mismatches.push(`envelope_event_registry_payload_contract_missing:${row.eventType}`);
        map.set(row.eventType, row);
    }
    return {
        rows: map,
        registryHash: sha256Object(rows.sort((left, right) => left.eventType.localeCompare(right.eventType))),
    };
}
function validatePolicyConformance(row, policy, mismatches) {
    if (!row)
        return;
    const payloadContract = row.payloadContract;
    const payloadKindPolicy = policy.payloadKindContracts.get(row.payloadKind);
    if (!payloadKindPolicy) {
        mismatches.push(`envelope_event_registry_policy_payload_kind_unknown:${row.eventType}:${row.payloadKind || '<missing>'}`);
        return;
    }
    for (const field of payloadKindPolicy.requiredFields ?? []) {
        if (!payloadContract?.requiredFields?.includes(field)) {
            mismatches.push(`envelope_event_registry_policy_required_field_missing:${row.eventType}:${field}`);
        }
    }
    for (const field of payloadKindPolicy.forbiddenFields ?? []) {
        if (!payloadContract?.forbiddenFields?.includes(field)) {
            mismatches.push(`envelope_event_registry_policy_forbidden_field_missing:${row.eventType}:${field}`);
        }
    }
    if (payloadContract?.allowedControlWriteMode &&
        !(payloadKindPolicy.allowedControlWriteModes ?? []).includes(payloadContract.allowedControlWriteMode)) {
        mismatches.push(`envelope_event_registry_policy_write_mode_invalid:${row.eventType}:${payloadContract.allowedControlWriteMode}`);
    }
    const writeModePolicy = policy.controlWriteModePolicies.get(payloadContract?.allowedControlWriteMode ?? '');
    if (!writeModePolicy) {
        mismatches.push(`envelope_event_registry_policy_write_mode_unknown:${row.eventType}:${payloadContract?.allowedControlWriteMode || '<missing>'}`);
    }
    else {
        for (const field of row.writesControlFields ?? []) {
            if (!policy.controlFieldVocabulary.has(field)) {
                mismatches.push(`envelope_event_registry_policy_control_field_unknown:${row.eventType}:${field}`);
            }
            if (!(writeModePolicy.allowedWritesControlFields ?? []).includes(field)) {
                mismatches.push(`envelope_event_registry_policy_control_field_disallowed:${row.eventType}:${field}`);
            }
        }
    }
    const eventPolicy = policy.eventSpecificRequirements.get(row.eventType);
    if (!eventPolicy)
        return;
    if (eventPolicy.payloadKind && eventPolicy.payloadKind !== row.payloadKind) {
        mismatches.push(`envelope_event_registry_policy_payload_kind_mismatch:${row.eventType}:${row.payloadKind}`);
    }
    for (const field of eventPolicy.requiredFields ?? []) {
        if (!payloadContract?.requiredFields?.includes(field)) {
            mismatches.push(`envelope_event_registry_policy_event_required_field_missing:${row.eventType}:${field}`);
        }
    }
    for (const field of eventPolicy.forbiddenFields ?? []) {
        if (!payloadContract?.forbiddenFields?.includes(field)) {
            mismatches.push(`envelope_event_registry_policy_event_forbidden_field_missing:${row.eventType}:${field}`);
        }
    }
    if (eventPolicy.requiredSourceRefs === true && payloadContract?.requiredSourceRefs !== true) {
        mismatches.push(`envelope_event_registry_policy_source_refs_not_required:${row.eventType}`);
    }
    if (eventPolicy.allowedControlWriteMode &&
        eventPolicy.allowedControlWriteMode !== payloadContract?.allowedControlWriteMode) {
        mismatches.push(`envelope_event_registry_policy_event_write_mode_mismatch:${row.eventType}`);
    }
}
function fieldPresent(envelope, field) {
    const payload = asRecord(envelope.payload);
    return (Object.prototype.hasOwnProperty.call(envelope, field) ||
        (payload ? Object.prototype.hasOwnProperty.call(payload, field) : false));
}
function fieldValue(envelope, field) {
    if (Object.prototype.hasOwnProperty.call(envelope, field))
        return envelope[field];
    const payload = asRecord(envelope.payload);
    return payload?.[field];
}
function listFieldValue(envelope, field) {
    const value = fieldValue(envelope, field);
    return Array.isArray(value) ? value : [];
}
function presentControlFields(envelope, vocabulary) {
    const fields = new Set();
    for (const key of Object.keys(envelope)) {
        if (vocabulary.has(key))
            fields.add(key);
    }
    const payload = asRecord(envelope.payload);
    if (payload) {
        for (const key of Object.keys(payload)) {
            if (vocabulary.has(key))
                fields.add(key);
        }
    }
    return [...fields].sort();
}
function hasArtifactRef(value) {
    const ref = asRecord(value);
    if (!ref)
        return false;
    return Boolean(text(ref.path) && SHA256_PATTERN.test(text(ref.contentHash ?? ref.hash)));
}
function codexVersionSupportsHooks(version) {
    const match = version.match(/(\d+)\.(\d+)\.(\d+)/u);
    if (!match)
        return false;
    const [, majorRaw, minorRaw, patchRaw] = match;
    const major = Number(majorRaw);
    const minor = Number(minorRaw);
    const patch = Number(patchRaw);
    if (major > 0)
        return true;
    if (major < 0)
        return false;
    if (minor > 130)
        return true;
    if (minor < 130)
        return false;
    return patch >= 0;
}
function validateCodexHookTrust(envelope) {
    if (text(envelope.hostKind) !== 'codex' || text(envelope.hostMode) !== 'hooks_enabled') {
        return [];
    }
    const mismatches = [];
    const payload = asRecord(envelope.payload);
    if (!payload)
        return ['codex_hook_trust_payload_missing'];
    if (!codexVersionSupportsHooks(text(payload.codexVersion))) {
        mismatches.push(`codex_version_hooks_unsupported:${text(payload.codexVersion) || '<missing>'}`);
    }
    if (payload.hooksFeatureStable !== true)
        mismatches.push('codex_hooks_feature_stable_not_true');
    if (text(payload.hookTrust) !== 'trusted') {
        mismatches.push(`codex_hook_trust_not_trusted:${text(payload.hookTrust) || '<missing>'}`);
    }
    if (!hasArtifactRef(payload.capabilityProbeReceiptRef)) {
        mismatches.push('codex_capability_probe_receipt_ref_missing');
    }
    if (!hasArtifactRef(payload.sessionStartSmokeReceiptRef)) {
        mismatches.push('codex_session_start_smoke_receipt_ref_missing');
    }
    if (!hasArtifactRef(payload.hookTrustReceiptRef)) {
        mismatches.push('codex_hook_trust_receipt_ref_missing');
    }
    if (!SHA256_PATTERN.test(text(payload.managedHookConfigHash))) {
        mismatches.push('codex_managed_hook_config_hash_missing');
    }
    if (!SHA256_PATTERN.test(text(payload.runtimePolicySnapshotHash))) {
        mismatches.push('codex_runtime_policy_snapshot_hash_missing');
    }
    return mismatches;
}
function validateGovernanceTransportEnvelope(input, options = {}) {
    const mismatches = [];
    const registryPolicy = registryPolicyFor(options.governanceEventTypeRegistryPolicy, mismatches);
    const { rows: eventRegistry, registryHash } = registryMapFor(options.governanceEventTypeRegistry, mismatches);
    const requireRegistryBinding = options.requireRegistryBinding !== false;
    if (requireRegistryBinding && !options.governanceEventTypeRegistryPolicy) {
        mismatches.push('envelope_event_registry_policy_missing');
    }
    if (options.registryPolicyHash &&
        registryPolicy.registryPolicyHash !== options.registryPolicyHash) {
        mismatches.push(`envelope_event_registry_policy_hash_mismatch:${registryPolicy.registryPolicyHash ?? '<missing>'}`);
    }
    if (requireRegistryBinding &&
        !options.registryPolicyHash &&
        !options.governanceEventTypeRegistryPolicy) {
        mismatches.push('envelope_event_registry_policy_hash_missing');
    }
    if (options.expectedRegistryHash && registryHash !== options.expectedRegistryHash) {
        mismatches.push(`envelope_event_registry_hash_mismatch:${registryHash ?? '<missing>'}`);
    }
    if (requireRegistryBinding && !options.expectedRegistryHash && !options.registryHash) {
        mismatches.push('envelope_event_registry_hash_missing');
    }
    if (options.registryHash && registryHash !== options.registryHash) {
        mismatches.push(`envelope_event_registry_hash_mismatch:${registryHash ?? '<missing>'}`);
    }
    if (options.expectedArchitectureConfirmationHash &&
        options.architectureConfirmationHash !== options.expectedArchitectureConfirmationHash) {
        mismatches.push(`envelope_architecture_confirmation_hash_mismatch:${options.architectureConfirmationHash || '<missing>'}`);
    }
    if (requireRegistryBinding &&
        !options.expectedArchitectureConfirmationHash &&
        !options.architectureConfirmationHash) {
        mismatches.push('envelope_architecture_confirmation_hash_missing');
    }
    if (!isObject(input))
        return { ok: false, mismatches: ['envelope_object_required'], registryHash };
    const envelope = input;
    for (const field of [
        'hostKind',
        'hostMode',
        'entry',
        'runId',
        'recordId',
        'requirementSetId',
        'stage',
        'packetId',
        'eventType',
        'payloadKind',
    ]) {
        if (!text(envelope[field]))
            mismatches.push(`envelope_${field}_missing`);
    }
    if (containsForbiddenResult(envelope))
        mismatches.push('envelope_result_forbidden');
    const eventType = text(envelope.eventType);
    const payloadKind = text(envelope.payloadKind);
    const eventDefinition = eventRegistry.get(eventType);
    validatePolicyConformance(eventDefinition, registryPolicy, mismatches);
    const authorizedControlFields = new Set(eventDefinition?.writesControlFields ?? []);
    for (const field of presentControlFields(envelope, registryPolicy.controlFieldVocabulary)) {
        if (!authorizedControlFields.has(field)) {
            mismatches.push(`envelope_control_field_not_authorized:${eventType || '<missing>'}:${field}`);
        }
    }
    const expectedKind = eventDefinition?.payloadKind ?? null;
    if (!eventDefinition)
        mismatches.push(`envelope_event_type_unsupported:${eventType || '<missing>'}`);
    if (expectedKind && payloadKind !== expectedKind) {
        mismatches.push(`envelope_payload_kind_mismatch:${eventType}:${payloadKind || '<missing>'}`);
    }
    const payloadContract = eventDefinition?.payloadContract;
    for (const field of payloadContract?.requiredFields ?? []) {
        if (!fieldPresent(envelope, field))
            mismatches.push(`envelope_required_field_missing:${eventType}:${field}`);
    }
    for (const field of payloadContract?.forbiddenFields ?? []) {
        if (fieldPresent(envelope, field))
            mismatches.push(`envelope_forbidden_field_present:${eventType}:${field}`);
    }
    if (payloadContract?.requiredSourceRefs === true &&
        listFieldValue(envelope, 'sourceRefs').length === 0) {
        mismatches.push(`envelope_source_refs_missing:${eventType}`);
    }
    const decisionValues = eventDefinition?.allowedDecisionValues ?? [];
    if (decisionValues.length && !decisionValues.includes(text(envelope.decision))) {
        mismatches.push(`envelope_decision_invalid:${text(envelope.decision) || '<missing>'}`);
    }
    const statusValues = eventDefinition?.allowedStatusValues ?? [];
    if (statusValues.length && !statusValues.includes(text(envelope.status))) {
        mismatches.push(`envelope_status_invalid:${text(envelope.status) || '<missing>'}`);
    }
    mismatches.push(...validateCodexHookTrust(envelope));
    return {
        ok: mismatches.length === 0,
        mismatches: [...new Set(mismatches)],
        registryHash,
        registryPolicyHash: registryPolicy.registryPolicyHash,
    };
}
function assertGovernanceTransportEnvelope(input, options = {}) {
    const validation = validateGovernanceTransportEnvelope(input, options);
    if (!validation.ok) {
        throw new Error(`invalid GovernanceTransportEnvelope: ${validation.mismatches.join(', ')}`);
    }
}
