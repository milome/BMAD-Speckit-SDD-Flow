import { createHash } from 'node:crypto';

const localRejections = new WeakSet<Error>();

function localRejection(code: string, detail: Record<string, unknown>): Error {
  const error = Object.assign(new Error(code), detail);
  localRejections.add(error);
  return error;
}

export function isLocalJudgePreflightRejection(value: unknown): value is Error {
  return value instanceof Error && localRejections.has(value);
}

export interface JudgePayloadPreflight {
  schemaVersion: 'judge-payload-preflight/v1';
  stage: string;
  transport: string;
  serializedPayloadHash: string;
  serializedPayloadBytes: number;
  serializedPayloadCodeUnits: number;
  auxiliaryPayloadHash: string;
  auxiliaryPayloadBytes: number;
  totalBytes: number;
  /** Null means that the selected provider has not declared a byte capacity. */
  transportByteLimit: number | null;
  providerTransportByteLimit: number | null;
  contextWindowCheck: 'not_measured';
  externalLengthUnit: 'unknown';
}

function hash(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export interface JudgePayloadBudgetInput {
  serializedPayload: string;
  auxiliaryPayload?: string;
  provider?: Record<string, unknown>;
  stage: string;
  sourceHash?: unknown;
  candidateHash?: unknown;
  contributors?: Record<string, number>;
}

/** Measure the exact UTF-8 representation without applying a capacity policy.
 * @param {JudgePayloadBudgetInput} input Payload and provider policy to measure.
 * @returns {JudgePayloadPreflight} The immutable UTF-8 size receipt.
 */
export function measureJudgePayload(input: JudgePayloadBudgetInput): JudgePayloadPreflight {
  const policy = (input.provider?.requestPolicy ?? {}) as Record<string, unknown>;
  const declared = policy.transportByteLimit;
  if (declared !== undefined && (!Number.isSafeInteger(declared) || Number(declared) < 1)) {
    throw new Error('requirements_contract_judge_transport_byte_limit_invalid');
  }
  const providerTransportByteLimit = declared === undefined ? null : Number(declared);
  const auxiliaryPayload = input.auxiliaryPayload ?? '';
  const serializedPayloadBytes = Buffer.byteLength(input.serializedPayload, 'utf8');
  const auxiliaryPayloadBytes = Buffer.byteLength(auxiliaryPayload, 'utf8');
  const receipt: JudgePayloadPreflight = {
    schemaVersion: 'judge-payload-preflight/v1',
    stage: input.stage,
    transport: String(input.provider?.transport ?? 'canonical-json'),
    serializedPayloadHash: hash(input.serializedPayload),
    serializedPayloadBytes,
    serializedPayloadCodeUnits: input.serializedPayload.length,
    auxiliaryPayloadHash: hash(auxiliaryPayload),
    auxiliaryPayloadBytes,
    totalBytes: serializedPayloadBytes + auxiliaryPayloadBytes,
    transportByteLimit: providerTransportByteLimit,
    providerTransportByteLimit,
    contextWindowCheck: 'not_measured',
    externalLengthUnit: 'unknown',
  };
  return Object.freeze(receipt);
}

/** Enforce only a capacity explicitly declared by the selected provider.
 * @param {JudgePayloadBudgetInput} input Payload and provider policy to validate.
 * @returns {JudgePayloadPreflight} The immutable UTF-8 size receipt when within capacity.
 */
export function assertJudgePayloadBudget(input: JudgePayloadBudgetInput): JudgePayloadPreflight {
  const receipt = measureJudgePayload(input);
  if (receipt.transportByteLimit !== null && receipt.totalBytes > receipt.transportByteLimit) {
    throw localRejection('judge_provider_capacity_exceeded', {
      failureClass: 'judge_provider_capacity_exceeded',
      dispatchState: 'not_dispatched',
      goalJudgeDispatchCount: 0,
      ...receipt,
      unit: 'utf8_bytes',
      sourceHash: input.sourceHash ?? null,
      candidateHash: input.candidateHash ?? null,
      contributors: input.contributors ?? {},
    });
  }
  return receipt;
}

export function assertJudgePayloadUnchanged(
  expected: JudgePayloadPreflight | undefined,
  actual: JudgePayloadPreflight
): void {
  if (
    expected &&
    (expected.serializedPayloadHash !== actual.serializedPayloadHash ||
      expected.auxiliaryPayloadHash !== actual.auxiliaryPayloadHash ||
      expected.transport !== actual.transport ||
      expected.transportByteLimit !== actual.transportByteLimit)
  ) {
    throw localRejection('judge_preflight_payload_changed', {
      failureClass: 'judge_preflight_payload_changed',
      dispatchState: 'not_dispatched',
      goalJudgeDispatchCount: 0,
      expectedPayloadHash: expected.serializedPayloadHash,
      actualPayloadHash: actual.serializedPayloadHash,
    });
  }
}
