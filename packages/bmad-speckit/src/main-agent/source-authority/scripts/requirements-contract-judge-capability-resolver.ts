import { canonicalJson } from './requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;

export interface RequirementsContractJudgeCapacityAssessment {
  decision: 'dispatch_allowed' | 'capacity_blocked';
  issueCode: 'judge_provider_capacity_exceeded' | null;
  state: 'dispatch_pending' | 'audit_pending';
  resumable: true;
  resumeFrom: 'judge_dispatch';
  nextActions: string[];
  declaredCapacity: {
    transportByteLimit: number | null;
    contextWindowTokens: number | null;
    maximumOutputTokens: number | null;
  } | null;
  actual: {
    requestSerializedBytes: number;
    auditPacketSerializedBytes: number;
    systemPromptBytes: number;
    rubricSerializedBytes: number;
    structuredOutputSchemaSerializedBytes: number;
    outputTokenReserve: number;
    providerInputTokens: number | null;
  };
  capacityChecks: {
    transportBytes: 'pass' | 'exceeded' | 'not_declared';
    contextWindow: 'pass' | 'exceeded' | 'not_declared' | 'not_measured';
    outputReserve: 'pass' | 'exceeded' | 'not_declared';
  };
}

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function optionalPositiveInteger(value: unknown, code: string): number | null {
  if (value === undefined) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(code);
  return Number(value);
}

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(canonicalJson(value), 'utf8');
}

export function assessRequirementsContractJudgeRequestCapacity(input: {
  request: JsonRecord;
  provider: JsonRecord;
  providerInputTokens?: number;
}): RequirementsContractJudgeCapacityAssessment {
  const request = record(input.request, 'requirements_contract_judge_capacity_request_invalid');
  const provider = record(input.provider, 'requirements_contract_judge_capacity_provider_invalid');
  const requestPolicy = record(
    provider.requestPolicy ?? {},
    'requirements_contract_judge_capacity_policy_invalid'
  );
  const prompt = record(request.prompt, 'requirements_contract_judge_capacity_prompt_invalid');
  const auditPacket = record(
    request.auditPacket,
    'requirements_contract_judge_capacity_audit_packet_invalid'
  );
  const transportByteLimit = optionalPositiveInteger(
    requestPolicy.transportByteLimit,
    'requirements_contract_judge_transport_byte_limit_invalid'
  );
  const contextWindowTokens = optionalPositiveInteger(
    requestPolicy.contextWindowTokens,
    'requirements_contract_judge_context_window_invalid'
  );
  const maximumOutputTokens = optionalPositiveInteger(
    requestPolicy.maximumOutputTokens,
    'requirements_contract_judge_maximum_output_tokens_invalid'
  );
  const outputTokenReserve = optionalPositiveInteger(
    prompt.outputTokenReserve,
    'requirements_contract_judge_output_reserve_invalid'
  );
  if (outputTokenReserve === null) throw new Error('requirements_contract_judge_output_reserve_invalid');
  const providerInputTokens = optionalPositiveInteger(
    input.providerInputTokens,
    'requirements_contract_judge_provider_input_tokens_invalid'
  );
  const actual = {
    requestSerializedBytes: serializedBytes(request),
    auditPacketSerializedBytes: serializedBytes(auditPacket),
    systemPromptBytes: Buffer.byteLength(String(prompt.systemPrompt ?? ''), 'utf8'),
    rubricSerializedBytes: serializedBytes(prompt.rubric),
    structuredOutputSchemaSerializedBytes: serializedBytes(prompt.structuredOutputSchema),
    outputTokenReserve,
    providerInputTokens,
  };
  const capacityChecks = {
    transportBytes:
      transportByteLimit === null
        ? ('not_declared' as const)
        : actual.requestSerializedBytes > transportByteLimit
          ? ('exceeded' as const)
          : ('pass' as const),
    contextWindow:
      contextWindowTokens === null
        ? ('not_declared' as const)
        : providerInputTokens === null
          ? ('not_measured' as const)
          : providerInputTokens + outputTokenReserve > contextWindowTokens
            ? ('exceeded' as const)
            : ('pass' as const),
    outputReserve:
      maximumOutputTokens === null
        ? ('not_declared' as const)
        : outputTokenReserve > maximumOutputTokens
          ? ('exceeded' as const)
          : ('pass' as const),
  };
  const blocked = Object.values(capacityChecks).includes('exceeded');
  const hasDeclaredCapacity =
    transportByteLimit !== null || contextWindowTokens !== null || maximumOutputTokens !== null;
  return {
    decision: blocked ? 'capacity_blocked' : 'dispatch_allowed',
    issueCode: blocked ? 'judge_provider_capacity_exceeded' : null,
    state: blocked ? 'audit_pending' : 'dispatch_pending',
    resumable: true,
    resumeFrom: 'judge_dispatch',
    nextActions: blocked
      ? ['select_larger_context_provider', 'adjust_provider_deployment_capacity']
      : [],
    declaredCapacity: hasDeclaredCapacity
      ? { transportByteLimit, contextWindowTokens, maximumOutputTokens }
      : null,
    actual,
    capacityChecks,
  };
}

function payloadOrContextRejection(error: unknown): boolean {
  const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown; message?: unknown };
  const status = Number(candidate?.status ?? candidate?.statusCode);
  const message = String(candidate?.message ?? candidate?.code ?? '').toLowerCase();
  return (
    status === 413 ||
    /context length|context window|too many tokens|payload too large|request entity too large/u.test(
      message
    )
  );
}

function transportFailure(error: unknown): boolean {
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
  const name = String(candidate?.name ?? '');
  const code = String(candidate?.code ?? '').toUpperCase();
  const message = String(candidate?.message ?? '').toLowerCase();
  return (
    name === 'AbortError' ||
    ['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(code) ||
    /connection reset|connection refused|network error|request timeout|socket hang up/u.test(message)
  );
}

export async function invokeRequirementsContractJudgeWithRecovery(input: {
  request: JsonRecord;
  provider: JsonRecord;
  providerInputTokens?: number;
  attemptOrdinal: number;
  invoke: (request: JsonRecord) => Promise<unknown>;
}) {
  if (!Number.isSafeInteger(input.attemptOrdinal) || input.attemptOrdinal < 1) {
    throw new Error('requirements_contract_judge_attempt_ordinal_invalid');
  }
  const capacity = assessRequirementsContractJudgeRequestCapacity(input);
  if (capacity.decision === 'capacity_blocked') {
    return { ...capacity, acceptedEvaluation: false as const, attempt: null };
  }
  try {
    const response = await input.invoke(input.request);
    return {
      state: 'response_received' as const,
      acceptedEvaluation: false as const,
      resumable: false as const,
      response,
      capacity,
      attempt: {
        attemptOrdinal: input.attemptOrdinal,
        outcome: 'response_received' as const,
        acceptedEvaluation: false as const,
      },
    };
  } catch (error) {
    const rawResponse = (error as { rawResponse?: unknown })?.rawResponse;
    if (rawResponse && typeof rawResponse === 'object' && !Array.isArray(rawResponse)) {
      return {
        state: 'response_received' as const,
        acceptedEvaluation: false as const,
        resumable: true as const,
        response: rawResponse,
        capacity,
        attempt: {
          attemptOrdinal: input.attemptOrdinal,
          outcome: 'response_validation_failure' as const,
          acceptedEvaluation: false as const,
        },
      };
    }
    const payloadRejected = payloadOrContextRejection(error);
    if (!payloadRejected && !transportFailure(error)) throw error;
    const issueCode = payloadRejected
      ? ('judge_provider_payload_rejected' as const)
      : ('judge_provider_transport_failed' as const);
    return {
      state: 'audit_pending' as const,
      acceptedEvaluation: false as const,
      resumable: true as const,
      resumeFrom: 'judge_dispatch' as const,
      issueCode,
      nextActions: payloadRejected
        ? ['select_larger_context_provider', 'adjust_provider_deployment_capacity']
        : ['retry_judge_dispatch'],
      capacity,
      attempt: {
        attemptOrdinal: input.attemptOrdinal,
        outcome: 'transport_failure' as const,
        acceptedEvaluation: false as const,
        issueCode,
      },
    };
  }
}
