import {
  type RequirementsContractFinalRejudgeInput,
  validateRequirementsContractFinalRejudgeInput,
} from './requirements-contract-final-rejudge-input';
import {
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  stableHash,
  text,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractFinalAcceptanceJudgeValidationReceipt {
  schemaVersion: 'requirements-contract-final-acceptance-judge-validation-receipt/v1';
  rejudgeInputHash: string;
  invocationCount: 0 | 1;
  sealedByteHashSetHash: string;
  decision: 'pass';
  validationReceiptHash: string;
}

export class RequirementsContractFinalAcceptanceJudgeValidatorError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractFinalAcceptanceJudgeValidatorError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractFinalAcceptanceJudgeValidatorError(code);
}

export function validateRequirementsContractFinalAcceptanceJudgeInvocation(
  input: unknown
): RequirementsContractFinalAcceptanceJudgeValidationReceipt {
  if (!isRecord(input)) fail('final_judge_invocation_input_invalid');
  const rejudgeInput = validateRequirementsContractFinalRejudgeInput(
    input.rejudgeInput,
    input.rejudgeInput
  ) as RequirementsContractFinalRejudgeInput;
  if (input.mutableCandidateBytes === true) fail('final_judge_invocation_mutable_bytes');
  const invocations = Array.isArray(input.finalJudgeInvocations) ? input.finalJudgeInvocations : [];
  const expectedCount = rejudgeInput.finalJudgeInvocationRequired ? 1 : 0;
  if (invocations.length !== expectedCount) {
    fail(
      invocations.length > expectedCount
        ? 'final_judge_invocation_repeated'
        : 'final_judge_invocation_missing'
    );
  }
  if (expectedCount === 1) {
    const invocation = invocations[0];
    if (!isRecord(invocation)) fail('final_judge_invocation_invalid');
    if (
      requireHash(invocation, 'rejudgeInputHash', 'final_judge_invocation_stale') !==
      rejudgeInput.rejudgeInputHash
    ) {
      fail('final_judge_invocation_stale');
    }
    const invocationSealedBytes = requireNonEmptyUniqueStrings(
      invocation.sealedByteHashes,
      'final_judge_invocation_stale'
    );
    if (JSON.stringify(invocationSealedBytes) !== JSON.stringify(rejudgeInput.sealedByteHashes)) {
      fail('final_judge_invocation_stale');
    }
  }
  const payload = {
    schemaVersion: 'requirements-contract-final-acceptance-judge-validation-receipt/v1' as const,
    rejudgeInputHash: rejudgeInput.rejudgeInputHash,
    invocationCount: expectedCount as 0 | 1,
    sealedByteHashSetHash: stableHash(rejudgeInput.sealedByteHashes),
    decision: 'pass' as const,
  };
  return { ...payload, validationReceiptHash: stableHash(payload) };
}

export function validateRequirementsContractFinalAcceptanceJudgeValidationReceipt(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractFinalAcceptanceJudgeValidationReceipt {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('final_judge_receipt_invalid');
  const receipt = value as unknown as RequirementsContractFinalAcceptanceJudgeValidationReceipt;
  const { validationReceiptHash, ...payload } = receipt;
  if (validationReceiptHash !== stableHash(payload)) fail('final_judge_receipt_hash_mismatch');
  if (
    receipt.schemaVersion !==
      'requirements-contract-final-acceptance-judge-validation-receipt/v1' ||
    receipt.decision !== 'pass' ||
    (receipt.invocationCount !== 0 && receipt.invocationCount !== 1)
  ) {
    fail('final_judge_receipt_invalid');
  }
  for (const field of ['rejudgeInputHash', 'validationReceiptHash'] as const) {
    if (text(receipt[field]) !== text(currentAuthority[field])) fail('final_judge_receipt_stale');
  }
  return receipt;
}
