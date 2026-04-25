export interface ContinueStateEvaluationInput {
  latestGateDecision: 'pass' | 'auto_repairable_block' | 'true_blocker' | 'reroute';
  fourSignalStatus: 'pass' | 'warn' | 'block';
  closeoutApproved: boolean;
  scoreWriteResult: string | null | undefined;
  handoffPersisted: boolean;
  circuitOpen: boolean;
}

export function canMainAgentContinue(input: ContinueStateEvaluationInput): boolean {
  if (input.circuitOpen) {
    return false;
  }
  if (input.latestGateDecision === 'true_blocker' || input.latestGateDecision === 'reroute') {
    return false;
  }
  if (input.fourSignalStatus === 'block') {
    return false;
  }
  if (!input.closeoutApproved) {
    return false;
  }
  if (input.scoreWriteResult !== 'ok') {
    return false;
  }
  if (!input.handoffPersisted) {
    return false;
  }
  return true;
}

export interface ReviewerCloseoutContinueInput {
  closeoutApproved: boolean;
  scoreWriteResult?: 'ok' | 'failed' | null;
  handoffPersisted?: boolean;
  latestGateDecision: 'pass' | 'auto_repairable_block' | 'true_blocker' | 'reroute';
  fourSignalStatus: 'pass' | 'warn' | 'block';
  circuitOpen?: boolean;
}

export function canMainAgentContinueFromCloseout(
  input: ReviewerCloseoutContinueInput
): boolean {
  return canMainAgentContinue({
    latestGateDecision: input.latestGateDecision,
    fourSignalStatus: input.fourSignalStatus,
    closeoutApproved: input.closeoutApproved,
    scoreWriteResult: input.scoreWriteResult ?? null,
    handoffPersisted: input.handoffPersisted ?? false,
    circuitOpen: input.circuitOpen ?? false,
  });
}
