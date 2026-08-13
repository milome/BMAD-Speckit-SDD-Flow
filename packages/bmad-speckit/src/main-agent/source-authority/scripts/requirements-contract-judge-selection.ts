import { canonicalJson, sha256 } from './requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;

const DOMAIN_TAG = 'providerSelectionHash/v1\n';

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function optionalCapacity(provider: JsonRecord) {
  const policy = record(provider.requestPolicy ?? {}, 'requirements_contract_judge_request_policy_invalid');
  const capacity = {
    transportByteLimit: Number.isSafeInteger(policy.transportByteLimit)
      ? Number(policy.transportByteLimit)
      : null,
    contextWindowTokens: Number.isSafeInteger(policy.contextWindowTokens)
      ? Number(policy.contextWindowTokens)
      : null,
    maximumOutputTokens: Number.isSafeInteger(policy.maximumOutputTokens)
      ? Number(policy.maximumOutputTokens)
      : null,
  };
  return Object.values(capacity).some((value) => value !== null) ? capacity : null;
}

export function resolveRequirementsContractJudgeAdapterRef(provider: JsonRecord): string {
  if (typeof provider.adapterRef === 'string' && provider.adapterRef) {
    return provider.adapterRef;
  }
  return provider.transport === 'openai-compatible'
    ? 'OpenAICompatibleJudgeAdapter'
    : provider.transport === 'anthropic-compatible'
      ? 'AnthropicCompatibleJudgeAdapter'
      : provider.transport === 'claude-code-cli'
        ? 'ClaudeCodeCliJudgeAdapter'
        : 'CodexCliJudgeAdapter';
}

export function createRequirementsContractJudgeSelectionReceipt(input: {
  providerRef: string;
  provider: JsonRecord;
  adapterRef: string;
  providerRegistryHash: string;
}) {
  const provider = record(input.provider, 'requirements_contract_judge_provider_invalid');
  const payload = {
    schemaVersion: 'requirements-contract-judge-selection-receipt/v1' as const,
    decision: 'selected' as const,
    providerRef: input.providerRef,
    transport: String(provider.transport ?? ''),
    apiStyle: String(provider.apiStyle ?? ''),
    model: provider.model === undefined ? null : provider.model,
    adapterRef: input.adapterRef,
    providerRegistryHash: input.providerRegistryHash,
    providerConfigurationHash: sha256(canonicalJson(provider)),
    declaredCapacity: optionalCapacity(provider),
    issueCodes: [] as string[],
  };
  return {
    ...payload,
    providerSelectionHash: sha256(`${DOMAIN_TAG}${canonicalJson(payload)}`),
  };
}

export function createUnavailableRequirementsContractJudgeSelectionReceipt(input: {
  providerRegistryHash: string;
  providerConfigurationHash: string;
  issueCode: string;
}) {
  const payload = {
    schemaVersion: 'requirements-contract-judge-selection-receipt/v1' as const,
    decision: 'unavailable' as const,
    providerRef: null,
    transport: null,
    apiStyle: null,
    model: null,
    adapterRef: null,
    providerRegistryHash: input.providerRegistryHash,
    providerConfigurationHash: input.providerConfigurationHash,
    declaredCapacity: null,
    issueCodes: [input.issueCode],
  };
  return {
    ...payload,
    providerSelectionHash: sha256(`${DOMAIN_TAG}${canonicalJson(payload)}`),
  };
}
