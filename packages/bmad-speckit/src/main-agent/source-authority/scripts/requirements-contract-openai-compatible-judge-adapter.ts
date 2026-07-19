import { createHash } from 'node:crypto';
import { readRequirementsContractJudgeCredentialSecret } from './requirements-contract-judge-credential-resolver';

type JsonRecord = Record<string, unknown>;

interface AdapterInput {
  providerRef?: string;
  provider: JsonRecord;
  credential: unknown;
  body?: unknown;
  payload?: unknown;
  fetch?: typeof fetch;
}

interface AdapterRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function secret(value: unknown): string {
  try {
    return readRequirementsContractJudgeCredentialSecret(value);
  } catch {
    throw new Error('judge_adapter_credential_handle_invalid');
  }
}

function hash(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function structuredDecision(value: unknown): {
  decision: 'pass' | 'block' | 'inconclusive';
  findings: JsonRecord[];
  challengeRequests: JsonRecord[];
  evidenceRefs: string[];
} {
  const parsed = record(value, 'judge_adapter_response_schema_invalid');
  const allowedKeys = new Set(['decision', 'findings', 'challengeRequests', 'evidenceRefs']);
  if (Object.keys(parsed).some((key) => !allowedKeys.has(key))) {
    throw new Error('judge_adapter_response_schema_invalid');
  }
  if (!['pass', 'block', 'inconclusive'].includes(String(parsed.decision))) {
    throw new Error('judge_adapter_response_schema_invalid');
  }
  if (
    !Array.isArray(parsed.findings) ||
    !Array.isArray(parsed.challengeRequests) ||
    !Array.isArray(parsed.evidenceRefs)
  ) {
    throw new Error('judge_adapter_response_schema_invalid');
  }
  const findings = parsed.findings.map((finding) =>
    record(finding, 'judge_adapter_response_schema_invalid')
  );
  const challengeRequests = parsed.challengeRequests.map((request) =>
    record(request, 'judge_adapter_response_schema_invalid')
  );
  const evidenceRefs = parsed.evidenceRefs.map((reference) => {
    if (typeof reference !== 'string' || reference.length === 0) {
      throw new Error('judge_adapter_response_schema_invalid');
    }
    return reference;
  });
  if (new Set(evidenceRefs).size !== evidenceRefs.length) {
    throw new Error('judge_adapter_response_schema_invalid');
  }
  return {
    decision: parsed.decision as 'pass' | 'block' | 'inconclusive',
    findings,
    challengeRequests,
    evidenceRefs,
  };
}

function requestBody(input: AdapterInput, provider: JsonRecord): unknown {
  if (input.body !== undefined) return input.body;
  const payload = record(input.payload, 'judge_adapter_semantic_request_invalid');
  const request = record(payload.request, 'judge_adapter_semantic_request_invalid');
  if (typeof payload.systemPrompt !== 'string' || payload.systemPrompt.length === 0) {
    throw new Error('judge_adapter_semantic_request_invalid');
  }
  return {
    model: provider.model,
    messages: [
      { role: 'system', content: payload.systemPrompt },
      { role: 'user', content: JSON.stringify(request) },
    ],
    temperature: 0,
  };
}

function buildRequest(input: AdapterInput): AdapterRequest {
  const provider = record(input.provider, 'judge_adapter_provider_invalid');
  const endpoint = record(provider.endpoint, 'judge_adapter_endpoint_invalid');
  if (provider.transport !== 'openai-compatible' || provider.apiStyle !== 'chat_completions') {
    throw new Error('judge_adapter_provider_binding_invalid');
  }
  if (endpoint.resolutionMode !== 'transport_managed') {
    throw new Error('judge_adapter_resolution_mode_invalid');
  }
  if (endpoint.explicitOperationPath !== null && endpoint.explicitOperationPath !== undefined) {
    throw new Error('judge_adapter_explicit_operation_path_forbidden');
  }
  if (typeof endpoint.baseUrl !== 'string') throw new Error('judge_adapter_base_url_invalid');
  const authentication = record(provider.authentication, 'judge_adapter_authentication_invalid');
  const apiKey = secret(input.credential);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authentication.type === 'bearer') headers.authorization = `Bearer ${apiKey}`;
  else if (authentication.type === 'api_key') headers['x-api-key'] = apiKey;
  else throw new Error('judge_adapter_authentication_invalid');
  const body = requestBody(input, provider);
  const requestPolicy = record(provider.requestPolicy, 'judge_adapter_request_policy_invalid');
  return {
    url: new URL('/chat/completions', endpoint.baseUrl).toString(),
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeoutMs: typeof requestPolicy.timeoutMs === 'number' ? requestPolicy.timeoutMs : 10_000,
  };
}

async function execute(input: AdapterInput) {
  const provider = record(input.provider, 'judge_adapter_provider_invalid');
  const endpoint = record(provider.endpoint, 'judge_adapter_endpoint_invalid');
  const request = buildRequest(input);
  const transport = input.fetch ?? globalThis.fetch;
  if (typeof transport !== 'function') throw new Error('judge_adapter_fetch_unavailable');
  const response = await transport(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(request.timeoutMs),
  });
  if (!response.ok) throw new Error(`judge_adapter_transport_failed:${response.status}`);
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('judge_adapter_response_json_invalid');
  }
  return {
    status: response.status,
    requestHash: hash(JSON.stringify({ url: request.url, body: request.body })),
    responseHash: hash(text),
    originPreservationDecision:
      new URL(request.url).origin === new URL(String(endpoint.baseUrl)).origin ? 'pass' : 'block',
    payload,
  };
}

async function probe(input: AdapterInput) {
  const provider = record(input.provider, 'judge_adapter_provider_invalid');
  return execute({
    ...input,
    body: input.body ??
      input.payload ?? {
        model: provider.model,
        messages: [
          { role: 'system', content: 'Return one structured Judge capability decision.' },
          { role: 'user', content: '{"probe":"requirements-contract-judge-provider-smoke/v1"}' },
        ],
        temperature: 0,
      },
  });
}

async function judge(input: AdapterInput): Promise<unknown> {
  const execution = await execute(input);
  const provider = record(input.provider, 'judge_adapter_provider_invalid');
  const payload = record(execution.payload, 'judge_adapter_response_schema_invalid');
  if (payload.model !== provider.model) {
    throw new Error('judge_adapter_returned_model_mismatch');
  }
  if (typeof payload.id !== 'string' || payload.id.length === 0) {
    throw new Error('judge_adapter_response_schema_invalid');
  }
  if (!Array.isArray(payload.choices) || payload.choices.length !== 1) {
    throw new Error('judge_adapter_response_schema_invalid');
  }
  const choice = record(payload.choices[0], 'judge_adapter_response_schema_invalid');
  const message = record(choice.message, 'judge_adapter_response_schema_invalid');
  if (typeof message.content !== 'string') {
    throw new Error('judge_adapter_response_schema_invalid');
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(message.content);
  } catch {
    throw new Error('judge_adapter_response_schema_invalid');
  }
  const normalized = structuredDecision(decoded);
  const providerRef = input.providerRef ?? provider.providerRef;
  if (typeof providerRef !== 'string' || providerRef.length === 0) {
    throw new Error('judge_adapter_provider_ref_missing');
  }
  return {
    schemaVersion: 'requirements-contract-normalized-judge-response/v1',
    providerRef,
    transport: provider.transport,
    configuredModel: provider.model,
    returnedModel: payload.model,
    ...normalized,
    providerRequestId: payload.id,
    requestHash: execution.requestHash,
    responseHash: execution.responseHash,
  };
}

export const OpenAICompatibleJudgeAdapter = { probe, judge, buildRequest } as const;
