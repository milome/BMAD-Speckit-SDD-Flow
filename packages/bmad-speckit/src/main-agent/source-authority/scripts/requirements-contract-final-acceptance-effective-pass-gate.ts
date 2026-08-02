import {
  reduceRequirementsContractFinalAcceptanceState,
  type RequirementsContractFinalAcceptanceState,
} from './requirements-contract-final-acceptance-state-machine';
import {
  isRecord,
  stableHash,
  text,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractFinalAcceptanceEffectivePassReceipt {
  schemaVersion: 'requirements-contract-final-acceptance-effective-pass-receipt/v1';
  campaignId: string;
  effectivePass: true;
  authorityStateHash: string;
  ledgerHeadHash: string;
  requiredClosureCount: number;
  observedClosureCount: number;
  kernelOrJudgeSubstitution: false;
  decision: 'pass';
  effectivePassReceiptHash: string;
}

export class RequirementsContractFinalAcceptanceEffectivePassGateError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractFinalAcceptanceEffectivePassGateError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractFinalAcceptanceEffectivePassGateError(code);
}

export function evaluateRequirementsContractFinalAcceptanceEffectivePass(
  input: unknown
): RequirementsContractFinalAcceptanceEffectivePassReceipt {
  if (!isRecord(input)) fail('final_acceptance_effective_pass_input_invalid');
  if (input.kernelOrJudgeSubstitution === true) {
    fail('final_acceptance_effective_pass_substitution');
  }
  const state = reduceRequirementsContractFinalAcceptanceState(
    input.state
  ) as RequirementsContractFinalAcceptanceState;
  const payload = {
    schemaVersion: 'requirements-contract-final-acceptance-effective-pass-receipt/v1' as const,
    campaignId: state.ledger.campaignId,
    effectivePass: true as const,
    authorityStateHash: state.authorityStateHash,
    ledgerHeadHash: state.ledger.ledgerHeadHash,
    requiredClosureCount: state.requiredClosureCount,
    observedClosureCount: state.observedClosureCount,
    kernelOrJudgeSubstitution: false as const,
    decision: 'pass' as const,
  };
  return { ...payload, effectivePassReceiptHash: stableHash(payload) };
}

export function validateRequirementsContractFinalAcceptanceEffectivePassReceipt(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractFinalAcceptanceEffectivePassReceipt {
  if (!isRecord(value) || !isRecord(currentAuthority)) {
    fail('final_acceptance_effective_pass_invalid');
  }
  const receipt = value as unknown as RequirementsContractFinalAcceptanceEffectivePassReceipt;
  const { effectivePassReceiptHash, ...payload } = receipt;
  if (effectivePassReceiptHash !== stableHash(payload)) {
    fail('final_acceptance_effective_pass_hash_mismatch');
  }
  if (
    receipt.schemaVersion !== 'requirements-contract-final-acceptance-effective-pass-receipt/v1' ||
    receipt.effectivePass !== true ||
    receipt.decision !== 'pass' ||
    receipt.kernelOrJudgeSubstitution !== false
  ) {
    fail('final_acceptance_effective_pass_invalid');
  }
  for (const field of ['campaignId', 'authorityStateHash', 'effectivePassReceiptHash'] as const) {
    if (text(receipt[field]) !== text(currentAuthority[field])) {
      fail('final_acceptance_effective_pass_stale');
    }
  }
  return receipt;
}
