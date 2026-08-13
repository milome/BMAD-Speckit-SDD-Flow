import { canonicalJson, sha256 } from './requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;

const REQUEST_INPUT_KEYS = new Set([
  'authority',
  'providerSelection',
  'prompt',
  'auditPacket',
  'auditPacketArtifactManifest',
  'remediation',
]);
const REQUEST_KEYS = new Set([...REQUEST_INPUT_KEYS, 'schemaVersion', 'judgeRequestHash']);
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const DOMAIN_TAG = 'judgeRequestHash/v2\n';

export interface RequirementsContractJudgeRequestInput extends JsonRecord {
  authority: JsonRecord;
  providerSelection: JsonRecord;
  prompt: JsonRecord;
  auditPacket: JsonRecord;
  auditPacketArtifactManifest: JsonRecord[];
  remediation: JsonRecord | null;
}

export interface RequirementsContractJudgeRequest extends RequirementsContractJudgeRequestInput {
  schemaVersion: 'requirements-contract-judge-request/v2';
  judgeRequestHash: string;
}

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function assertExactKeys(value: JsonRecord, allowed: ReadonlySet<string>, code: string): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error(code);
}

function validateInput(value: unknown): RequirementsContractJudgeRequestInput {
  const input = record(value, 'requirements_contract_judge_request_invalid');
  assertExactKeys(input, REQUEST_INPUT_KEYS, 'requirements_contract_judge_request_field_set_invalid');
  record(input.authority, 'requirements_contract_judge_request_authority_invalid');
  const selection = record(
    input.providerSelection,
    'requirements_contract_judge_request_selection_invalid'
  );
  if (!HASH_PATTERN.test(String(selection.providerSelectionHash ?? ''))) {
    throw new Error('requirements_contract_judge_request_selection_hash_invalid');
  }
  const prompt = record(input.prompt, 'requirements_contract_judge_request_prompt_invalid');
  if (typeof prompt.systemPrompt !== 'string' || prompt.systemPrompt.trim().length === 0) {
    throw new Error('requirements_contract_judge_request_prompt_invalid');
  }
  record(prompt.rubric, 'requirements_contract_judge_request_rubric_invalid');
  record(
    prompt.structuredOutputSchema,
    'requirements_contract_judge_request_response_schema_invalid'
  );
  if (!Number.isSafeInteger(prompt.outputTokenReserve) || Number(prompt.outputTokenReserve) < 1) {
    throw new Error('requirements_contract_judge_request_output_reserve_invalid');
  }
  record(input.auditPacket, 'requirements_contract_judge_request_audit_packet_invalid');
  if (!Array.isArray(input.auditPacketArtifactManifest)) {
    throw new Error('requirements_contract_judge_request_artifact_manifest_invalid');
  }
  if (input.remediation !== null) {
    const remediation = record(
      input.remediation,
      'requirements_contract_judge_request_remediation_invalid'
    );
    const keys = new Set([
      'remediatesRequestHash',
      'remediationAggregateHash',
      'remediationDeltaHash',
    ]);
    if (
      Object.keys(remediation).length !== keys.size ||
      Object.keys(remediation).some((key) => !keys.has(key))
    ) {
      throw new Error('requirements_contract_judge_request_remediation_field_set_invalid');
    }
    if ([...keys].some((key) => !HASH_PATTERN.test(String(remediation[key] ?? '')))) {
      throw new Error('requirements_contract_judge_request_remediation_hash_invalid');
    }
  }
  return input as RequirementsContractJudgeRequestInput;
}

function requestHash(payload: JsonRecord): string {
  return sha256(`${DOMAIN_TAG}${canonicalJson(payload)}`);
}

export function buildRequirementsContractJudgeRequest(
  input: RequirementsContractJudgeRequestInput
): RequirementsContractJudgeRequest {
  const validated = validateInput(input);
  const payload = {
    schemaVersion: 'requirements-contract-judge-request/v2' as const,
    authority: validated.authority,
    providerSelection: validated.providerSelection,
    prompt: validated.prompt,
    auditPacket: validated.auditPacket,
    auditPacketArtifactManifest: validated.auditPacketArtifactManifest,
    remediation: validated.remediation,
  };
  return { ...payload, judgeRequestHash: requestHash(payload) };
}

export function verifyRequirementsContractJudgeRequest(
  value: unknown
): RequirementsContractJudgeRequest {
  const request = record(value, 'requirements_contract_judge_request_invalid');
  assertExactKeys(request, REQUEST_KEYS, 'requirements_contract_judge_request_field_set_invalid');
  if (request.schemaVersion !== 'requirements-contract-judge-request/v2') {
    throw new Error('requirements_contract_judge_request_schema_version_invalid');
  }
  const { judgeRequestHash, ...payload } = request;
  validateInput({
    authority: request.authority,
    providerSelection: request.providerSelection,
    prompt: request.prompt,
    auditPacket: request.auditPacket,
    auditPacketArtifactManifest: request.auditPacketArtifactManifest,
    remediation: request.remediation,
  });
  if (!HASH_PATTERN.test(String(judgeRequestHash ?? '')) || requestHash(payload) !== judgeRequestHash) {
    throw new Error('requirements_contract_judge_request_hash_mismatch');
  }
  return request as unknown as RequirementsContractJudgeRequest;
}
