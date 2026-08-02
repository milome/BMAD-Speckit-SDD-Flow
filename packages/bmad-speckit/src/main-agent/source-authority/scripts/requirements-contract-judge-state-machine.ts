import { sha256Stable } from './requirements-contract-semantic-resolver';

export type RequirementsJudgeStatus =
  | 'initialized'
  | 'lease_issued'
  | 'assessment_recorded'
  | 'remediation_recorded'
  | 'effective_pass_recorded'
  | 'blocked';

export type RequirementsJudgeTransition =
  | 'lease_issued'
  | 'assessment_recorded'
  | 'remediation_recorded'
  | 'effective_pass_recorded'
  | 'blocked';

export interface RequirementsJudgeTransitionReceipt {
  schemaVersion: 'requirements-contract-judge-transition-receipt/v1';
  from: RequirementsJudgeStatus;
  to: RequirementsJudgeTransition;
  authoritySnapshotHash: string;
  receiptHash: string;
  transitionHash: string;
}

export interface RequirementsJudgeState {
  schemaVersion: 'requirements-contract-judge-state/v1';
  attemptKeyHash: string;
  authoritySnapshotHash: string;
  status: RequirementsJudgeStatus;
  transitionReceipts: RequirementsJudgeTransitionReceipt[];
  providerInvocationOutcome?: 'none' | 'committed' | 'unknown';
  providerInvocationReceiptHash?: string;
  reusedProviderInvocationReceiptHash?: string;
  stateHash: string;
}

const LEGAL_TRANSITIONS: Record<RequirementsJudgeStatus, RequirementsJudgeTransition[]> = {
  initialized: ['lease_issued', 'blocked'],
  lease_issued: ['assessment_recorded', 'blocked'],
  assessment_recorded: ['remediation_recorded', 'blocked'],
  remediation_recorded: ['effective_pass_recorded', 'blocked'],
  effective_pass_recorded: [],
  blocked: [],
};

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function requireHash(value: unknown, code: string): string {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) throw new Error(code);
  return value;
}

function withStateHash(state: Omit<RequirementsJudgeState, 'stateHash'>): RequirementsJudgeState {
  return { ...state, stateHash: sha256Stable(state) };
}

export function createRequirementsJudgeState(input: {
  attemptKeyHash: string;
  authoritySnapshotHash: string;
  providerInvocationOutcome?: 'none' | 'committed' | 'unknown';
  providerInvocationReceiptHash?: string;
}): RequirementsJudgeState {
  return withStateHash({
    schemaVersion: 'requirements-contract-judge-state/v1',
    attemptKeyHash: requireHash(input.attemptKeyHash, 'requirements_judge_attempt_key_invalid'),
    authoritySnapshotHash: requireHash(
      input.authoritySnapshotHash,
      'requirements_judge_authority_snapshot_invalid'
    ),
    status: 'initialized',
    transitionReceipts: [],
    providerInvocationOutcome: input.providerInvocationOutcome ?? 'none',
    providerInvocationReceiptHash: input.providerInvocationReceiptHash,
  });
}

export function applyRequirementsJudgeTransition(
  state: RequirementsJudgeState,
  request: {
    transition: RequirementsJudgeTransition;
    authoritySnapshotHash: string;
    receiptHash: string;
    recovery?: boolean;
    providerInvocationReceiptHash?: string;
  }
): RequirementsJudgeState {
  const allowed = LEGAL_TRANSITIONS[state.status] ?? [];
  if (!allowed.includes(request.transition)) {
    throw new Error('requirements_judge_transition_undeclared');
  }
  if (request.authoritySnapshotHash !== state.authoritySnapshotHash) {
    throw new Error('requirements_judge_transition_stale_authority');
  }
  if (request.transition === 'assessment_recorded' && request.recovery === true) {
    if (state.providerInvocationOutcome === 'unknown') {
      throw new Error('requirements_judge_provider_invocation_unknown');
    }
    if (
      state.providerInvocationOutcome === 'committed' &&
      state.providerInvocationReceiptHash &&
      request.providerInvocationReceiptHash !== state.providerInvocationReceiptHash
    ) {
      throw new Error('requirements_judge_provider_invocation_replay');
    }
  }
  const transitionPayload = {
    schemaVersion: 'requirements-contract-judge-transition-receipt/v1' as const,
    from: state.status,
    to: request.transition,
    authoritySnapshotHash: requireHash(
      request.authoritySnapshotHash,
      'requirements_judge_authority_snapshot_invalid'
    ),
    receiptHash: requireHash(request.receiptHash, 'requirements_judge_transition_receipt_invalid'),
  };
  const transitionReceipt = {
    ...transitionPayload,
    transitionHash: sha256Stable(transitionPayload),
  };
  return withStateHash({
    ...state,
    status: request.transition,
    transitionReceipts: [...state.transitionReceipts, transitionReceipt],
    reusedProviderInvocationReceiptHash:
      request.recovery === true && state.providerInvocationOutcome === 'committed'
        ? state.providerInvocationReceiptHash
        : state.reusedProviderInvocationReceiptHash,
  });
}
