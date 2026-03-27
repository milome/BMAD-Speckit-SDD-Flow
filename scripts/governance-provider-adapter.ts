import {
  createStubModelGovernanceHintProvider,
  resolveModelGovernanceHintCandidate,
  type ResolveModelGovernanceHintInput,
} from './model-governance-hint-resolver';
import type {
  ModelGovernanceHintCandidate,
  ModelGovernanceProviderMode,
} from './model-governance-hints-schema';

export type GovernanceProviderProtocol = ModelGovernanceProviderMode;

export interface GovernanceProviderAdapterInput extends ResolveModelGovernanceHintInput {
  capabilitySlot: string;
  canonicalAgent: string;
  actualExecutor: string;
  targetArtifacts: string[];
}

export interface GovernanceProviderAdapter {
  id: string;
  protocol: GovernanceProviderProtocol;
  displayName: string;
  resolveModelHints(
    input: GovernanceProviderAdapterInput
  ): ModelGovernanceHintCandidate | null | Promise<ModelGovernanceHintCandidate | null>;
}

export interface HttpJsonGovernanceProviderAdapterConfig {
  id: string;
  endpoint: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  method?: 'POST' | 'PUT';
  displayName?: string;
  requestBuilder?: (input: GovernanceProviderAdapterInput) => unknown;
  responseParser?: (payload: unknown, input: GovernanceProviderAdapterInput) => unknown;
}

export interface OpenAICompatibleGovernanceProviderAdapterConfig {
  id: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  displayName?: string;
  systemPrompt?: string;
}

function defaultHttpJsonRequestBuilder(input: GovernanceProviderAdapterInput): unknown {
  return {
    promptText: input.promptText,
    routingContext: {
      stageContextKnown: input.stageContextKnown,
      gateFailureExists: input.gateFailureExists,
      blockerOwnershipLocked: input.blockerOwnershipLocked,
      rootTargetLocked: input.rootTargetLocked,
      equivalentAdapterCount: input.equivalentAdapterCount,
      capabilitySlot: input.capabilitySlot,
      canonicalAgent: input.canonicalAgent,
      actualExecutor: input.actualExecutor,
      targetArtifacts: input.targetArtifacts,
    },
  };
}

function normalizeOpenAICompatibleBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function extractJsonObjectFromText(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') {
    throw new Error('Empty provider response content');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Provider response did not contain a valid JSON object');
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function toModelGovernanceHintCandidate(
  payload: unknown,
  adapterId: string,
  protocol: GovernanceProviderProtocol
): ModelGovernanceHintCandidate {
  const candidate =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const nested =
    candidate.hint && typeof candidate.hint === 'object' && !Array.isArray(candidate.hint)
      ? (candidate.hint as Record<string, unknown>)
      : candidate.candidate && typeof candidate.candidate === 'object' && !Array.isArray(candidate.candidate)
        ? (candidate.candidate as Record<string, unknown>)
        : candidate;

  const confidence = nested.confidence;
  const researchPolicy = nested.researchPolicy;
  const delegationPreference = nested.delegationPreference;

  return {
    source: 'model-provider',
    providerId: adapterId,
    providerMode: protocol,
    confidence:
      confidence === 'low' || confidence === 'medium' || confidence === 'high'
        ? confidence
        : 'low',
    ...(typeof nested.suggestedStage === 'string'
      ? { suggestedStage: nested.suggestedStage }
      : {}),
    ...(typeof nested.suggestedAction === 'string'
      ? { suggestedAction: nested.suggestedAction }
      : {}),
    ...(typeof nested.suggestedArtifactTarget === 'string'
      ? { suggestedArtifactTarget: nested.suggestedArtifactTarget }
      : {}),
    explicitRolePreference: normalizeStringArray(nested.explicitRolePreference),
    researchPolicy:
      researchPolicy === 'allowed' || researchPolicy === 'forbidden' || researchPolicy === 'preferred'
        ? researchPolicy
        : 'allowed',
    delegationPreference:
      delegationPreference === 'decide-for-me' || delegationPreference === 'ask-me-first'
        ? delegationPreference
        : 'ask-me-first',
    constraints: normalizeStringArray(nested.constraints),
    rationale:
      typeof nested.rationale === 'string' && nested.rationale.trim() !== ''
        ? nested.rationale
        : 'Governance provider response',
    overrideAllowed: false,
    ...(nested.forbiddenOverrides &&
    typeof nested.forbiddenOverrides === 'object' &&
    !Array.isArray(nested.forbiddenOverrides)
      ? {
          forbiddenOverrides: nested.forbiddenOverrides as ModelGovernanceHintCandidate['forbiddenOverrides'],
        }
      : {}),
  };
}

async function postJson(
  endpoint: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number,
  method: 'POST' | 'PUT'
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Governance provider request failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function defaultOpenAICompatibleSystemPrompt(): string {
  return [
    'You are a governance hint synthesizer.',
    'Return JSON only.',
    'You may suggest stage/action/artifact/role/research/delegation/constraints.',
    'You must not assert authority over blocker ownership, failed-check severity, or artifact-derived root target.',
  ].join(' ');
}

function parseOpenAICompatibleResponse(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    throw new Error('OpenAI-compatible provider returned a non-object payload');
  }
  const doc = payload as Record<string, unknown>;

  if (typeof doc.output_text === 'string' && doc.output_text.trim() !== '') {
    return extractJsonObjectFromText(doc.output_text);
  }

  const choices = doc.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    const message =
      first.message && typeof first.message === 'object'
        ? (first.message as Record<string, unknown>)
        : null;
    const content = message?.content;
    if (typeof content === 'string') {
      return extractJsonObjectFromText(content);
    }
    if (Array.isArray(content)) {
      const text = content
        .map((item) =>
          item && typeof item === 'object' && typeof (item as Record<string, unknown>).text === 'string'
            ? ((item as Record<string, unknown>).text as string)
            : ''
        )
        .join('\n');
      return extractJsonObjectFromText(text);
    }
  }

  throw new Error('OpenAI-compatible provider response missing choices[0].message.content or output_text');
}

export function createStubGovernanceProviderAdapter(
  candidate: ModelGovernanceHintCandidate | null,
  id = 'stub-governance-provider-adapter'
): GovernanceProviderAdapter {
  const provider = createStubModelGovernanceHintProvider(candidate, id);
  return {
    id,
    protocol: 'stub',
    displayName: 'Stub Governance Provider Adapter',
    resolveModelHints(input) {
      return provider.resolve(input);
    },
  };
}

export function createHttpJsonGovernanceProviderAdapter(
  config: HttpJsonGovernanceProviderAdapterConfig
): GovernanceProviderAdapter {
  return {
    id: config.id,
    protocol: 'http-json',
    displayName: config.displayName ?? 'HTTP JSON Governance Provider Adapter',
    async resolveModelHints(input) {
      const response = await postJson(
        config.endpoint,
        (config.requestBuilder ?? defaultHttpJsonRequestBuilder)(input),
        config.headers ?? {},
        config.timeoutMs ?? 30_000,
        config.method ?? 'POST'
      );
      const parsed = config.responseParser ? config.responseParser(response, input) : response;
      return toModelGovernanceHintCandidate(parsed, config.id, 'http-json');
    },
  };
}

export function createOpenAICompatibleGovernanceProviderAdapter(
  config: OpenAICompatibleGovernanceProviderAdapterConfig
): GovernanceProviderAdapter {
  const endpoint = `${normalizeOpenAICompatibleBaseUrl(config.baseUrl)}/chat/completions`;
  return {
    id: config.id,
    protocol: 'openai-compatible',
    displayName: config.displayName ?? 'OpenAI-Compatible Governance Provider Adapter',
    async resolveModelHints(input) {
      const body = {
        model: config.model,
        temperature: 0,
        response_format: {
          type: 'json_object',
        },
        messages: [
          {
            role: 'system',
            content: config.systemPrompt ?? defaultOpenAICompatibleSystemPrompt(),
          },
          {
            role: 'user',
            content: JSON.stringify(defaultHttpJsonRequestBuilder(input)),
          },
        ],
      };
      const response = await postJson(
        endpoint,
        body,
        {
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
          ...(config.headers ?? {}),
        },
        config.timeoutMs ?? 30_000,
        'POST'
      );
      const parsed = parseOpenAICompatibleResponse(response);
      return toModelGovernanceHintCandidate(parsed, config.id, 'openai-compatible');
    },
  };
}

export async function resolveModelHintsViaGovernanceProvider(
  input: GovernanceProviderAdapterInput,
  adapter: GovernanceProviderAdapter
): Promise<ModelGovernanceHintCandidate | null> {
  return resolveModelGovernanceHintCandidate(input, {
    id: adapter.id,
    mode: adapter.protocol,
    resolve: (payload) => adapter.resolveModelHints({ ...input, ...payload }),
  });
}
