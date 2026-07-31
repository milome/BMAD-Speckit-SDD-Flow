import {
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  requireText,
  stableHash,
  text,
  uniqueSorted,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractFinalRejudgeInput {
  schemaVersion: 'requirements-contract-final-rejudge-input/v1';
  campaignId: string;
  postRemediationAttemptKey: string;
  sealedByteHashes: string[];
  finalJudgeInvocationRequired: boolean;
  rejudgeInputHash: string;
  decision: 'pass';
}

export class RequirementsContractFinalRejudgeInputError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractFinalRejudgeInputError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractFinalRejudgeInputError(code);
}

export function compileRequirementsContractFinalRejudgeInput(
  input: unknown
): RequirementsContractFinalRejudgeInput {
  if (!isRecord(input)) fail('final_rejudge_input_invalid');
  const remediationApplied = input.remediationApplied === true;
  const sealedByteHashes = remediationApplied
    ? requireNonEmptyUniqueStrings(input.sealedByteHashes, 'final_rejudge_sealed_bytes_missing')
    : uniqueSorted(
        Array.isArray(input.sealedByteHashes) ? input.sealedByteHashes.filter(Boolean) : []
      );
  for (const hash of sealedByteHashes) {
    requireHash({ hash }, 'hash', 'final_rejudge_sealed_bytes_missing');
  }
  const payload = {
    schemaVersion: 'requirements-contract-final-rejudge-input/v1' as const,
    campaignId: requireText(input, 'campaignId', 'final_rejudge_campaign_invalid'),
    postRemediationAttemptKey: requireHash(
      input,
      'postRemediationAttemptKey',
      'final_rejudge_attempt_invalid'
    ),
    sealedByteHashes,
    finalJudgeInvocationRequired: remediationApplied,
    decision: 'pass' as const,
  };
  return { ...payload, rejudgeInputHash: stableHash(payload) };
}

export function validateRequirementsContractFinalRejudgeInput(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractFinalRejudgeInput {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('final_rejudge_input_invalid');
  const input = value as unknown as RequirementsContractFinalRejudgeInput;
  const { rejudgeInputHash, ...payload } = input;
  if (rejudgeInputHash !== stableHash(payload)) fail('final_rejudge_input_hash_mismatch');
  if (
    input.schemaVersion !== 'requirements-contract-final-rejudge-input/v1' ||
    input.decision !== 'pass'
  ) {
    fail('final_rejudge_input_invalid');
  }
  for (const field of ['campaignId', 'postRemediationAttemptKey', 'rejudgeInputHash'] as const) {
    if (text(input[field]) !== text(currentAuthority[field])) fail('final_rejudge_input_stale');
  }
  return input;
}
