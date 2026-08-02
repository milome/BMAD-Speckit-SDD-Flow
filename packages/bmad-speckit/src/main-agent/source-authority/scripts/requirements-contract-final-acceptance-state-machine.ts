import {
  compileRequirementsContractFinalAcceptanceLedger,
  type RequirementsContractFinalAcceptanceLedger,
} from './requirements-contract-final-acceptance-ledger';
import {
  isRecord,
  requireHash,
  stableHash,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractFinalAcceptanceState {
  schemaVersion: 'requirements-contract-final-acceptance-state/v1';
  mode: 'clean' | 'remediated';
  ledger: RequirementsContractFinalAcceptanceLedger;
  requiredClosureCount: number;
  observedClosureCount: number;
  authorityStateHash: string;
  decision: 'pass';
}

export class RequirementsContractFinalAcceptanceStateMachineError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractFinalAcceptanceStateMachineError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractFinalAcceptanceStateMachineError(code);
}

export function reduceRequirementsContractFinalAcceptanceState(
  input: unknown
): RequirementsContractFinalAcceptanceState {
  if (!isRecord(input)) fail('final_acceptance_state_input_invalid');
  if (input.replayedAttempt === true) fail('final_acceptance_state_replay');
  if (input.partialAuthority === true) fail('final_acceptance_state_partial');
  const mode: 'clean' | 'remediated' = input.mode === 'remediated' ? 'remediated' : 'clean';
  const requiredClosureCount =
    typeof input.requiredClosureCount === 'number' ? input.requiredClosureCount : 0;
  const observedClosureCount =
    typeof input.observedClosureCount === 'number' ? input.observedClosureCount : 0;
  if (requiredClosureCount <= 0 || observedClosureCount !== requiredClosureCount) {
    fail('final_acceptance_state_count_invalid');
  }
  const ledger = compileRequirementsContractFinalAcceptanceLedger(input.ledger);
  if (ledger.closureHashes.length !== requiredClosureCount) {
    fail('final_acceptance_state_count_invalid');
  }
  requireHash({ hash: ledger.ledgerHeadHash }, 'hash', 'final_acceptance_state_ledger_invalid');
  const payload = {
    schemaVersion: 'requirements-contract-final-acceptance-state/v1' as const,
    mode,
    ledger,
    requiredClosureCount,
    observedClosureCount,
    decision: 'pass' as const,
  };
  const state = { ...payload, authorityStateHash: stableHash(payload) };
  if (
    typeof input.currentAuthorityHash === 'string' &&
    input.currentAuthorityHash !== state.authorityStateHash
  ) {
    fail('final_acceptance_state_stale');
  }
  return state;
}
