import { sha256Stable } from './requirements-contract-semantic-resolver';
import { createRequirementsContractJudgeProviderRegistry } from './requirements-contract-judge-provider-registry';

export interface CriticalAuditorIndependentProviderExpectation {
  transactionId?: string;
  auditAttemptId?: string;
  providerId: string;
  model: string | null;
  transport: string;
  adapterRef: string;
  apiStyle: string;
  configuredBaseUrlHash: string;
  independenceClass: string;
  providerRegistryHash: string;
  providerConfigurationHash: string;
  capabilityReceiptHash?: string;
  selectionReceiptHash?: string;
  requestHash: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  projectionSetHash: string;
}

export interface CriticalAuditorIndependentProviderEvidence {
  transactionId?: string;
  auditAttemptId?: string;
  providerId: string;
  requestedModel: string | null;
  model: string;
  transport: string;
  adapterRef: string;
  apiStyle: string;
  configuredBaseUrlHash: string;
  independenceClass: string;
  providerRegistryHash: string;
  providerConfigurationHash: string;
  capabilityReceiptHash?: string;
  selectionReceiptHash?: string;
  providerRunId: string;
  requestHash: string;
  responseHash: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  projectionSetHash: string;
  runHash: string;
}

export interface CriticalAuditorIndependentProviderValidation {
  ok: boolean;
  issueCodes: string[];
}

export interface CriticalAuditorJudgeRuntimeBinding extends Record<string, unknown> {
  providerId: string;
  model: string | null;
  transport: string;
  adapterRef: string;
  apiStyle: string;
  configuredBaseUrlHash: string;
  independenceClass: string;
  providerRegistryHash: string;
  providerConfigurationHash: string;
}

export interface CriticalAuditorJudgeRuntimeBindingResult {
  binding: CriticalAuditorJudgeRuntimeBinding | null;
  issueCodes: string[];
}

export interface CriticalAuditorIndependentProviderExpectationResult {
  expectation: CriticalAuditorIndependentProviderExpectation | null;
  issueCodes: string[];
}

type JsonRecord = Record<string, unknown>;

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CREDENTIAL_KEY_PATTERN =
  /api.?key|authorization|secret|access.?token|refresh.?token|credential.?value|raw.?credential/iu;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedConfiguredModel(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function compareConfiguredModel(
  actual: unknown,
  expected: string | null,
  issueCode: string,
  issueCodes: string[]
): void {
  const normalized = normalizedConfiguredModel(actual);
  if (normalized !== expected) issueCodes.push(issueCode);
}

function containsCredentialMaterial(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => containsCredentialMaterial(item, seen));
  }
  return Object.entries(value as JsonRecord).some(
    ([key, item]) =>
      CREDENTIAL_KEY_PATTERN.test(key) || containsCredentialMaterial(item, seen)
  );
}

function recordHashWithoutField(record: JsonRecord, field: string): string {
  const canonical = { ...record };
  delete canonical[field];
  return sha256Stable(canonical);
}

function receiptHashMatches(record: JsonRecord, field = 'receiptHash'): boolean {
  const actual = text(record[field]);
  return SHA256_PATTERN.test(actual) && actual === recordHashWithoutField(record, field);
}

function compareText(
  actual: unknown,
  expected: string,
  issueCode: string,
  issues: string[]
): void {
  if (text(actual) !== expected) issues.push(issueCode);
}

function compareBoolean(
  actual: unknown,
  expected: boolean,
  issueCode: string,
  issues: string[]
): void {
  if (actual !== expected) issues.push(issueCode);
}

function configuredBaseUrlHash(value: unknown, issueCodes: string[]): string {
  const configured = text(value);
  if (!configured) {
    issueCodes.push('critical_auditor_judge_provider_base_url_mismatch');
  }
  return sha256Stable(configured);
}

function configuredAdapterRef(provider: JsonRecord): string {
  const explicit = text(provider.adapterRef);
  if (explicit) return explicit;
  if (provider.transport === 'claude-code-cli') {
    return 'ClaudeCodeCliJudgeAdapter';
  }
  return '';
}

function isCriticalAuditorCliTransport(value: unknown): boolean {
  return value === 'cli' || value === 'claude-code-cli';
}

export function criticalAuditorIndependentProviderRunHash(
  evidence: Omit<CriticalAuditorIndependentProviderEvidence, 'runHash'> | JsonRecord
): string {
  const canonical = { ...evidence } as JsonRecord;
  delete canonical.runHash;
  return sha256Stable(canonical);
}

export function buildCriticalAuditorJudgeRuntimeBinding(
  providerRegistry: unknown
): CriticalAuditorJudgeRuntimeBindingResult {
  const issueCodes: string[] = [];
  if (!isRecord(providerRegistry)) {
    return {
      binding: null,
      issueCodes: ['critical_auditor_judge_provider_registry_required'],
    };
  }
  if (containsCredentialMaterial(providerRegistry)) {
    issueCodes.push('critical_auditor_judge_authority_credential_material_forbidden');
  }
  compareText(
    providerRegistry.schemaVersion,
    'requirements-contract-judge-runtime/v1',
    'critical_auditor_judge_provider_registry_schema_mismatch',
    issueCodes
  );
  compareBoolean(
    providerRegistry.enabled,
    true,
    'critical_auditor_judge_runtime_disabled',
    issueCodes
  );
  const activeProviderRef = text(providerRegistry.activeProviderRef);
  if (!activeProviderRef) {
    issueCodes.push('critical_auditor_judge_active_provider_mismatch');
  }

  const selectionPolicy = isRecord(providerRegistry.selectionPolicy)
    ? providerRegistry.selectionPolicy
    : {};
  compareText(
    selectionPolicy.mode,
    'contract_locked',
    'critical_auditor_judge_selection_policy_mismatch',
    issueCodes
  );
  for (const [field, issueCode] of [
    ['runtimeFallbackAllowed', 'critical_auditor_judge_runtime_fallback_allowed'],
    ['runtimeAutoDiscoveryAllowed', 'critical_auditor_judge_runtime_discovery_allowed'],
    ['environmentOverrideAllowed', 'critical_auditor_judge_environment_override_allowed'],
  ] as const) {
    compareBoolean(selectionPolicy[field], false, issueCode, issueCodes);
  }
  compareBoolean(
    selectionPolicy.selectionReceiptRequired,
    true,
    'critical_auditor_judge_selection_receipt_not_required',
    issueCodes
  );
  compareBoolean(
    selectionPolicy.cliTransportAllowed,
    true,
    'critical_auditor_judge_cli_transport_not_enabled',
    issueCodes
  );

  const credentialConfig = isRecord(providerRegistry.credentialConfig)
    ? providerRegistry.credentialConfig
    : {};
  compareText(
    credentialConfig.source,
    'config_file',
    'critical_auditor_judge_credential_source_mismatch',
    issueCodes
  );
  compareText(
    credentialConfig.path,
    '_bmad-output/config/private/judge-provider.credentials.yaml',
    'critical_auditor_judge_credential_path_mismatch',
    issueCodes
  );
  compareText(
    credentialConfig.schemaVersion,
    'requirements-contract-judge-credentials/v1',
    'critical_auditor_judge_credential_schema_mismatch',
    issueCodes
  );
  compareText(
    credentialConfig.allowedRoot,
    '_bmad-output/config/private',
    'critical_auditor_judge_credential_root_mismatch',
    issueCodes
  );
  compareBoolean(
    credentialConfig.environmentFallbackAllowed,
    false,
    'critical_auditor_judge_credential_environment_fallback_allowed',
    issueCodes
  );

  const providers = isRecord(providerRegistry.providers) ? providerRegistry.providers : {};
  const provider = activeProviderRef && isRecord(providers[activeProviderRef])
    ? providers[activeProviderRef]
    : null;
  if (!provider) {
    issueCodes.push('critical_auditor_judge_selected_provider_missing');
    return { binding: null, issueCodes: [...new Set(issueCodes)] };
  }
  compareBoolean(
    provider.enabled,
    true,
    'critical_auditor_judge_selected_provider_disabled',
    issueCodes
  );
  const transport = text(provider.transport);
  const apiStyle = text(provider.apiStyle);
  const adapterRef = configuredAdapterRef(provider);
  if (!isCriticalAuditorCliTransport(provider.transport)) {
    issueCodes.push('critical_auditor_judge_provider_transport_mismatch');
  }
  compareText(
    apiStyle,
    'cli',
    'critical_auditor_judge_provider_api_style_mismatch',
    issueCodes
  );
  if (!adapterRef) {
    issueCodes.push('critical_auditor_judge_provider_adapter_ref_missing');
  }
  if (!text(provider.credentialRef)) {
    issueCodes.push('critical_auditor_judge_provider_credential_ref_mismatch');
  }

  const endpoint = isRecord(provider.endpoint) ? provider.endpoint : {};
  const authentication = isRecord(provider.authentication) ? provider.authentication : {};
  const hostManagedSession = authentication.type === 'claude_code_session';
  const configuredModel = hostManagedSession ? text(provider.model) : null;
  if (hostManagedSession && !configuredModel) {
    issueCodes.push('critical_auditor_judge_provider_model_mismatch');
  }
  if (!hostManagedSession && provider.model !== undefined && provider.model !== null) {
    issueCodes.push('critical_auditor_judge_gateway_model_forbidden');
  }
  const configuredEndpoint = endpoint.command;
  const baseUrlHash = configuredBaseUrlHash(configuredEndpoint, issueCodes);
  compareText(
    endpoint.resolutionMode,
    'path_search',
    'critical_auditor_judge_endpoint_resolution_mismatch',
    issueCodes
  );
  compareText(
    endpoint.routingOwnership,
    'transport_adapter',
    'critical_auditor_judge_endpoint_routing_owner_mismatch',
    issueCodes
  );
  compareText(
    endpoint.upstreamVersioning,
    hostManagedSession ? 'cli_managed' : 'gateway_managed',
    'critical_auditor_judge_upstream_versioning_mismatch',
    issueCodes
  );
  if (endpoint.explicitOperationPath !== null) {
    issueCodes.push('critical_auditor_judge_explicit_operation_path_forbidden');
  }

  if (hostManagedSession) {
    compareText(
      authentication.sensitivity,
      'host_managed',
      'critical_auditor_judge_authentication_sensitivity_mismatch',
      issueCodes
    );
    if (
      endpoint.baseUrl !== undefined ||
      !Number.isInteger(Number(authentication.sessionRevision)) ||
      Number(authentication.sessionRevision) < 1
    ) {
      issueCodes.push('critical_auditor_judge_session_revision_invalid');
    }
  } else {
    if (!['bearer', 'api_key'].includes(text(authentication.type))) {
      issueCodes.push('critical_auditor_judge_authentication_type_mismatch');
    }
    compareText(
      authentication.sensitivity,
      'secret',
      'critical_auditor_judge_authentication_sensitivity_mismatch',
      issueCodes
    );
    if (authentication.sessionRevision !== undefined) {
      issueCodes.push('critical_auditor_judge_session_revision_invalid');
    }
  }
  compareBoolean(
    authentication.arbitraryNonEmptyValueAllowed,
    false,
    'critical_auditor_judge_placeholder_credential_policy_mismatch',
    issueCodes
  );

  const auditPolicy = isRecord(provider.auditPolicy) ? provider.auditPolicy : {};
  const independenceClass = text(auditPolicy.independenceClass);
  if (!independenceClass) {
    issueCodes.push('critical_auditor_judge_provider_independence_mismatch');
  }
  compareBoolean(
    auditPolicy.blindReview,
    true,
    'critical_auditor_judge_blind_review_required',
    issueCodes
  );
  for (const [field, issueCode] of [
    ['allowPassAuthority', 'critical_auditor_judge_pass_authority_forbidden'],
    ['implementationWritesAllowed', 'critical_auditor_judge_implementation_writes_forbidden'],
  ] as const) {
    compareBoolean(auditPolicy[field], false, issueCode, issueCodes);
  }
  compareBoolean(
    auditPolicy.toolsAllowed,
    true,
    'critical_auditor_judge_read_tools_not_enabled',
    issueCodes
  );
  if (
    !Array.isArray(auditPolicy.allowedTools) ||
    JSON.stringify(auditPolicy.allowedTools) !== JSON.stringify(['Read'])
  ) {
    issueCodes.push('critical_auditor_judge_allowed_tools_mismatch');
  }

  const requestPolicy = isRecord(provider.requestPolicy) ? provider.requestPolicy : {};
  const timeoutMs = Number(requestPolicy.timeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    issueCodes.push('critical_auditor_judge_timeout_mismatch');
  }
  if (Number(requestPolicy.maximumAttempts) !== 1) {
    issueCodes.push('critical_auditor_judge_maximum_attempts_mismatch');
  }
  compareBoolean(
    requestPolicy.structuredResponseRequired,
    true,
    'critical_auditor_judge_structured_response_not_required',
    issueCodes
  );

  if (issueCodes.length > 0) {
    return { binding: null, issueCodes: [...new Set(issueCodes)] };
  }
  const runtimeRegistry = createRequirementsContractJudgeProviderRegistry({
    judgeRuntime: providerRegistry,
    runtime: providerRegistry,
  });
  return {
    binding: {
      providerId: activeProviderRef,
      model: configuredModel,
      transport,
      adapterRef,
      apiStyle,
      configuredBaseUrlHash: baseUrlHash,
      independenceClass,
      providerRegistryHash: runtimeRegistry.registryHash,
      providerConfigurationHash: sha256Stable(provider),
    },
    issueCodes: [],
  };
}

export function buildCriticalAuditorIndependentProviderExpectationFromJudgeRuntime(input: {
  providerRegistry: unknown;
  requestHash: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  projectionSetHash: string;
}): CriticalAuditorIndependentProviderExpectationResult {
  const binding = buildCriticalAuditorJudgeRuntimeBinding(input.providerRegistry);
  const issueCodes = [...binding.issueCodes];
  for (const [hash, issueCode] of [
    [input.requestHash, 'critical_auditor_request_hash_invalid'],
    [input.sourceDocumentHash, 'critical_auditor_source_hash_invalid'],
    [input.semanticModelHash, 'critical_auditor_semantic_model_hash_invalid'],
    [input.projectionSetHash, 'critical_auditor_projection_set_hash_invalid'],
  ] as const) {
    if (!SHA256_PATTERN.test(hash)) issueCodes.push(issueCode);
  }
  if (!binding.binding || issueCodes.length > 0) {
    return { expectation: null, issueCodes: [...new Set(issueCodes)] };
  }
  return {
    expectation: {
      ...binding.binding,
      requestHash: input.requestHash,
      sourceDocumentHash: input.sourceDocumentHash,
      semanticModelHash: input.semanticModelHash,
      projectionSetHash: input.projectionSetHash,
    },
    issueCodes: [],
  };
}

export function buildCriticalAuditorIndependentProviderExpectationFromJudgeSelection(input: {
  providerRegistry: unknown;
  capabilityReceipt: unknown;
  selectionReceipt: unknown;
  expectedTransactionId: string;
  expectedAuditAttemptId: string;
  requestHash: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  projectionSetHash: string;
}): CriticalAuditorIndependentProviderExpectationResult {
  const issueCodes: string[] = [];
  for (const [hash, issueCode] of [
    [input.requestHash, 'critical_auditor_request_hash_invalid'],
    [input.sourceDocumentHash, 'critical_auditor_source_hash_invalid'],
    [input.semanticModelHash, 'critical_auditor_semantic_model_hash_invalid'],
    [input.projectionSetHash, 'critical_auditor_projection_set_hash_invalid'],
  ] as const) {
    if (!SHA256_PATTERN.test(hash)) issueCodes.push(issueCode);
  }
  if (!text(input.expectedTransactionId)) {
    issueCodes.push('critical_auditor_expected_transaction_id_missing');
  }
  if (!text(input.expectedAuditAttemptId)) {
    issueCodes.push('critical_auditor_expected_audit_attempt_id_missing');
  }
  if (
    containsCredentialMaterial(input.providerRegistry) ||
    containsCredentialMaterial(input.capabilityReceipt) ||
    containsCredentialMaterial(input.selectionReceipt)
  ) {
    issueCodes.push('critical_auditor_judge_authority_credential_material_forbidden');
  }

  if (!isRecord(input.providerRegistry)) {
    issueCodes.push('critical_auditor_judge_provider_registry_required');
  }
  if (!isRecord(input.capabilityReceipt)) {
    issueCodes.push('critical_auditor_judge_capability_receipt_required');
  }
  if (!isRecord(input.selectionReceipt)) {
    issueCodes.push('critical_auditor_judge_selection_receipt_required');
  }
  if (
    !isRecord(input.providerRegistry) ||
    !isRecord(input.capabilityReceipt) ||
    !isRecord(input.selectionReceipt)
  ) {
    return { expectation: null, issueCodes: [...new Set(issueCodes)] };
  }
  if (issueCodes.includes('critical_auditor_judge_authority_credential_material_forbidden')) {
    return { expectation: null, issueCodes: [...new Set(issueCodes)] };
  }

  const registry = input.providerRegistry;
  const capability = input.capabilityReceipt;
  const selection = input.selectionReceipt;
  compareText(
    registry.schemaVersion,
    'requirements-contract-judge-runtime/v1',
    'critical_auditor_judge_provider_registry_schema_mismatch',
    issueCodes
  );
  const activeProviderRef = text(registry.activeProviderRef);
  if (!activeProviderRef) {
    issueCodes.push('critical_auditor_judge_active_provider_mismatch');
  }
  const selectionPolicy = isRecord(registry.selectionPolicy)
    ? registry.selectionPolicy
    : {};
  compareText(
    selectionPolicy.mode,
    'contract_locked',
    'critical_auditor_judge_selection_policy_mismatch',
    issueCodes
  );
  compareBoolean(
    selectionPolicy.runtimeFallbackAllowed,
    false,
    'critical_auditor_judge_runtime_fallback_allowed',
    issueCodes
  );
  compareBoolean(
    selectionPolicy.selectionReceiptRequired,
    true,
    'critical_auditor_judge_selection_receipt_not_required',
    issueCodes
  );

  const providers = isRecord(registry.providers) ? registry.providers : {};
  const provider = activeProviderRef && isRecord(providers[activeProviderRef])
    ? providers[activeProviderRef]
    : null;
  if (!provider) {
    issueCodes.push('critical_auditor_judge_selected_provider_missing');
  }
  const endpoint = provider && isRecord(provider.endpoint) ? provider.endpoint : {};
  const authentication =
    provider && isRecord(provider.authentication) ? provider.authentication : {};
  const transport = text(provider?.transport);
  const apiStyle = text(provider?.apiStyle);
  const adapterRef = provider ? configuredAdapterRef(provider) : '';
  const hostManagedSession = authentication.type === 'claude_code_session';
  const baseUrlHash = configuredBaseUrlHash(
    endpoint.command,
    issueCodes
  );
  const auditPolicy = provider && isRecord(provider.auditPolicy) ? provider.auditPolicy : {};
  const independenceClass = text(auditPolicy.independenceClass);
  const configuredModel = hostManagedSession ? text(provider?.model) : null;
  if (provider) {
    compareBoolean(
      provider.enabled,
      true,
      'critical_auditor_judge_selected_provider_disabled',
      issueCodes
    );
    if (!isCriticalAuditorCliTransport(provider.transport)) {
      issueCodes.push('critical_auditor_judge_provider_transport_mismatch');
    }
    compareText(
      apiStyle,
      'cli',
      'critical_auditor_judge_provider_api_style_mismatch',
      issueCodes
    );
    if (!adapterRef) {
      issueCodes.push('critical_auditor_judge_provider_adapter_ref_missing');
    }
    if (hostManagedSession && !configuredModel) {
      issueCodes.push('critical_auditor_judge_provider_model_mismatch');
    }
    if (!hostManagedSession && provider.model !== undefined && provider.model !== null) {
      issueCodes.push('critical_auditor_judge_gateway_model_forbidden');
    }
    compareText(
      endpoint.resolutionMode,
      'path_search',
      'critical_auditor_judge_endpoint_resolution_mismatch',
      issueCodes
    );
    compareText(
      endpoint.routingOwnership,
      'transport_adapter',
      'critical_auditor_judge_endpoint_routing_owner_mismatch',
      issueCodes
    );
    compareText(
      endpoint.upstreamVersioning,
      hostManagedSession ? 'cli_managed' : 'gateway_managed',
      'critical_auditor_judge_upstream_versioning_mismatch',
      issueCodes
    );
    if (!independenceClass) {
      issueCodes.push('critical_auditor_judge_provider_independence_mismatch');
    }
    compareBoolean(
      auditPolicy.blindReview,
      true,
      'critical_auditor_judge_blind_review_required',
      issueCodes
    );
    compareBoolean(
      auditPolicy.allowPassAuthority,
      false,
      'critical_auditor_judge_pass_authority_forbidden',
      issueCodes
    );
    compareBoolean(
      auditPolicy.toolsAllowed,
      true,
      'critical_auditor_judge_read_tools_not_enabled',
      issueCodes
    );
    if (
      !Array.isArray(auditPolicy.allowedTools) ||
      JSON.stringify(auditPolicy.allowedTools) !== JSON.stringify(['Read'])
    ) {
      issueCodes.push('critical_auditor_judge_allowed_tools_mismatch');
    }
  }

  const providerRegistryHash = createRequirementsContractJudgeProviderRegistry({
    judgeRuntime: registry,
    runtime: registry,
  }).registryHash;
  const providerConfigurationHash = provider ? sha256Stable(provider) : '';
  const capabilityReceiptHash = text(capability.receiptHash);
  const selectionReceiptHash = text(selection.receiptHash);

  compareText(
    capability.schemaVersion,
    'requirements-contract-judge-capability-receipt/v1',
    'critical_auditor_judge_capability_schema_mismatch',
    issueCodes
  );
  if (!receiptHashMatches(capability)) {
    issueCodes.push('critical_auditor_judge_capability_receipt_hash_mismatch');
  }
  compareText(
    capability.transactionId,
    input.expectedTransactionId,
    'critical_auditor_judge_capability_transaction_mismatch',
    issueCodes
  );
  compareText(
    capability.auditAttemptId,
    input.expectedAuditAttemptId,
    'critical_auditor_judge_capability_audit_attempt_mismatch',
    issueCodes
  );
  compareText(
    capability.providerRef,
    activeProviderRef,
    'critical_auditor_judge_capability_provider_mismatch',
    issueCodes
  );
  compareText(
    capability.publicProviderConfigurationHash,
    providerConfigurationHash,
    'critical_auditor_judge_capability_provider_configuration_hash_mismatch',
    issueCodes
  );
  compareText(
    capability.configuredBaseUrlHash,
    baseUrlHash,
    'critical_auditor_judge_capability_base_url_hash_mismatch',
    issueCodes
  );
  compareText(
    capability.transport,
    transport,
    'critical_auditor_judge_capability_transport_mismatch',
    issueCodes
  );
  compareText(
    capability.apiStyle,
    apiStyle,
    'critical_auditor_judge_capability_api_style_mismatch',
    issueCodes
  );
  compareConfiguredModel(
    capability.configuredModel,
    configuredModel,
    'critical_auditor_judge_capability_configured_model_mismatch',
    issueCodes
  );
  if (!text(capability.returnedModel)) {
    issueCodes.push('critical_auditor_judge_capability_returned_model_mismatch');
  }
  compareBoolean(
    capability.fallbackObserved,
    false,
    'critical_auditor_judge_capability_fallback_observed',
    issueCodes
  );
  compareText(
    capability.decision,
    'pass',
    'critical_auditor_judge_capability_not_pass',
    issueCodes
  );

  compareText(
    selection.schemaVersion,
    'requirements-contract-judge-selection-receipt/v1',
    'critical_auditor_judge_selection_schema_mismatch',
    issueCodes
  );
  if (!receiptHashMatches(selection)) {
    issueCodes.push('critical_auditor_judge_selection_receipt_hash_mismatch');
  }
  compareText(
    selection.transactionId,
    input.expectedTransactionId,
    'critical_auditor_judge_selection_transaction_mismatch',
    issueCodes
  );
  compareText(
    selection.auditAttemptId,
    input.expectedAuditAttemptId,
    'critical_auditor_judge_selection_audit_attempt_mismatch',
    issueCodes
  );
  compareText(
    selection.providerRegistryHash,
    providerRegistryHash,
    'critical_auditor_judge_selection_registry_hash_mismatch',
    issueCodes
  );
  compareText(
    selection.publicProviderConfigurationHash,
    providerConfigurationHash,
    'critical_auditor_judge_selection_provider_configuration_hash_mismatch',
    issueCodes
  );
  compareText(
    selection.capabilityReceiptHash,
    capabilityReceiptHash,
    'critical_auditor_judge_selection_capability_hash_mismatch',
    issueCodes
  );
  compareText(
    selection.selectedProvider,
    activeProviderRef,
    'critical_auditor_judge_selection_provider_mismatch',
    issueCodes
  );
  compareText(
    selection.configuredBaseUrlHash,
    baseUrlHash,
    'critical_auditor_judge_selection_base_url_hash_mismatch',
    issueCodes
  );
  compareText(
    selection.transport,
    transport,
    'critical_auditor_judge_selection_transport_mismatch',
    issueCodes
  );
  compareText(
    selection.apiStyle,
    apiStyle,
    'critical_auditor_judge_selection_api_style_mismatch',
    issueCodes
  );
  compareConfiguredModel(
    selection.model,
    configuredModel,
    'critical_auditor_judge_selection_model_mismatch',
    issueCodes
  );
  compareText(
    selection.independenceClass,
    independenceClass,
    'critical_auditor_judge_selection_independence_mismatch',
    issueCodes
  );
  compareBoolean(
    selection.blindReview,
    true,
    'critical_auditor_judge_selection_blind_review_required',
    issueCodes
  );
  compareBoolean(
    selection.allowPassAuthority,
    false,
    'critical_auditor_judge_selection_pass_authority_forbidden',
    issueCodes
  );
  compareBoolean(
    selection.runtimeFallbackAllowed,
    false,
    'critical_auditor_judge_selection_runtime_fallback_allowed',
    issueCodes
  );
  compareText(
    selection.sourceHash,
    input.sourceDocumentHash,
    'critical_auditor_judge_selection_source_hash_stale',
    issueCodes
  );
  compareText(
    selection.decision,
    'frozen',
    'critical_auditor_judge_selection_not_frozen',
    issueCodes
  );

  if (issueCodes.length > 0) {
    return { expectation: null, issueCodes: [...new Set(issueCodes)] };
  }
  return {
    expectation: {
      transactionId: input.expectedTransactionId,
      auditAttemptId: input.expectedAuditAttemptId,
      providerId: activeProviderRef,
      model: configuredModel,
      transport,
      adapterRef,
      apiStyle,
      configuredBaseUrlHash: baseUrlHash,
      independenceClass,
      providerRegistryHash,
      providerConfigurationHash,
      capabilityReceiptHash,
      selectionReceiptHash,
      requestHash: input.requestHash,
      sourceDocumentHash: input.sourceDocumentHash,
      semanticModelHash: input.semanticModelHash,
      projectionSetHash: input.projectionSetHash,
    },
    issueCodes: [],
  };
}

export function validateCriticalAuditorIndependentProviderEvidence(input: {
  expected: CriticalAuditorIndependentProviderExpectation;
  evidence: unknown;
}): CriticalAuditorIndependentProviderValidation {
  if (!isRecord(input.evidence)) {
    return {
      ok: false,
      issueCodes: ['critical_auditor_independent_provider_evidence_required'],
    };
  }
  const evidence = input.evidence;
  const issueCodes: string[] = [];
  const compare = (
    field: keyof CriticalAuditorIndependentProviderExpectation,
    issueCode: string
  ) => {
    const expected = input.expected[field];
    if (expected !== undefined && text(evidence[field]) !== expected) {
      issueCodes.push(issueCode);
    }
  };
  compare('transactionId', 'critical_auditor_transaction_id_mismatch');
  compare('auditAttemptId', 'critical_auditor_audit_attempt_id_mismatch');
  compare('providerId', 'critical_auditor_provider_identity_mismatch');
  if (
    !Object.hasOwn(evidence, 'requestedModel') ||
    normalizedConfiguredModel(evidence.requestedModel) !== input.expected.model
  ) {
    issueCodes.push('critical_auditor_requested_model_identity_mismatch');
  }
  if (!text(evidence.model)) {
    issueCodes.push('critical_auditor_returned_model_identity_missing');
  }
  compare('transport', 'critical_auditor_transport_identity_mismatch');
  compare('adapterRef', 'critical_auditor_adapter_identity_mismatch');
  compare('apiStyle', 'critical_auditor_api_style_mismatch');
  compare(
    'configuredBaseUrlHash',
    'critical_auditor_configured_base_url_hash_mismatch'
  );
  compare('independenceClass', 'critical_auditor_independence_class_mismatch');
  compare('providerRegistryHash', 'critical_auditor_provider_registry_hash_mismatch');
  compare(
    'providerConfigurationHash',
    'critical_auditor_provider_configuration_hash_mismatch'
  );
  compare('capabilityReceiptHash', 'critical_auditor_capability_receipt_hash_mismatch');
  compare('selectionReceiptHash', 'critical_auditor_selection_receipt_hash_mismatch');
  compare('requestHash', 'critical_auditor_request_hash_mismatch');
  compare('sourceDocumentHash', 'critical_auditor_source_hash_stale');
  compare('semanticModelHash', 'critical_auditor_semantic_model_hash_stale');
  compare('projectionSetHash', 'critical_auditor_projection_set_hash_mismatch');

  if (!text(evidence.providerRunId)) {
    issueCodes.push('critical_auditor_provider_run_id_missing');
  }
  if (!SHA256_PATTERN.test(text(evidence.responseHash))) {
    issueCodes.push('critical_auditor_provider_response_hash_invalid');
  }
  const runHash = text(evidence.runHash);
  if (
    !SHA256_PATTERN.test(runHash) ||
    runHash !== criticalAuditorIndependentProviderRunHash(evidence)
  ) {
    issueCodes.push('critical_auditor_provider_run_hash_mismatch');
  }
  if (containsCredentialMaterial(evidence)) {
    issueCodes.push('critical_auditor_credential_material_forbidden');
  }
  return {
    ok: issueCodes.length === 0,
    issueCodes: [...new Set(issueCodes)],
  };
}
