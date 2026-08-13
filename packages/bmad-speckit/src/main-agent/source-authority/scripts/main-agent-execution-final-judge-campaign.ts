import {
  stableHash,
  uniqueSorted,
} from './requirements-contract-verification-evidence-normalizer';
import {
  validateMainAgentExecutionFinalJudgeCampaignInput,
  type MainAgentExecutionFinalJudgeCampaignInput,
} from './main-agent-execution-final-judge-campaign-input';

export type MainAgentExecutionFinalJudgeActorIntent = {
  actorClass: 'bounded_code_reviewer' | 'final_acceptance_judge';
  dispatchMode: 'parallel';
  invocationMode: 'native';
  dispatchGroupId: string;
  preparedBeforeDispatch: true;
  blindInput: Record<string, unknown>;
  blindInputHash: string;
  invocationIntentHash: string;
};

export type MainAgentExecutionReviewerResult = {
  sourceLedgerHash: string;
  terminalOutcome: 'clean' | 'findings' | 'blocked';
  findingIds?: string[];
};

export type MainAgentExecutionFinalJudgeProducedResult = {
  sourceLedgerHash: string;
  auditDecision: 'pass' | 'fail';
  verdict: 'coverage_satisfied' | 'findings_present' | 'insufficient_evidence' | 'blocked';
  findingIds?: string[];
};

export type MainAgentExecutionFinalJudgeNotProducedResult = {
  auditDecision: 'not_produced';
  sourceErrorCode: string;
};

export type MainAgentExecutionFinalJudgeResult =
  | MainAgentExecutionFinalJudgeProducedResult
  | MainAgentExecutionFinalJudgeNotProducedResult;

export class MainAgentExecutionFinalJudgeCampaignError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'MainAgentExecutionFinalJudgeCampaignError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new MainAgentExecutionFinalJudgeCampaignError(code);
}

function campaignBlindInput(input: MainAgentExecutionFinalJudgeCampaignInput) {
  return {
    campaignId: input.campaignId,
    campaignLineageKey: input.campaignLineageKey,
    closureReceiptHash: input.closureReceiptHash,
    candidateBytesHash: input.candidateBytesHash,
    currentImplementationHash: input.currentImplementationHash,
    currentEvidenceHash: input.currentEvidenceHash,
    initialReviewAttemptKey: input.initialReviewAttemptKey,
  };
}

function actorIntent(
  actorClass: MainAgentExecutionFinalJudgeActorIntent['actorClass'],
  dispatchGroupId: string,
  blindInput: Record<string, unknown>
): MainAgentExecutionFinalJudgeActorIntent {
  const payload = {
    actorClass,
    dispatchMode: 'parallel' as const,
    invocationMode: 'native' as const,
    dispatchGroupId,
    preparedBeforeDispatch: true as const,
    blindInput,
  };
  return {
    ...payload,
    blindInputHash: stableHash(blindInput),
    invocationIntentHash: stableHash(payload),
  };
}

function actorReceipt(
  intent: MainAgentExecutionFinalJudgeActorIntent,
  result: Pick<MainAgentExecutionReviewerResult, 'sourceLedgerHash' | 'findingIds'>,
  terminalOutcome: MainAgentExecutionReviewerResult['terminalOutcome']
) {
  if (!/^sha256:[0-9a-f]{64}$/u.test(result.sourceLedgerHash)) {
    fail('main_agent_execution_final_judge_actor_receipt_invalid');
  }
  const payload = {
    actorClass: intent.actorClass,
    dispatchGroupId: intent.dispatchGroupId,
    invocationMode: 'native' as const,
    startedAfterBothIntentsPrepared: true as const,
    blindInputHash: intent.blindInputHash,
    invocationIntentHash: intent.invocationIntentHash,
    sourceLedgerHash: result.sourceLedgerHash,
    terminalOutcome,
    findingIds: uniqueSorted(result.findingIds ?? []),
  };
  return { ...payload, actorReceiptHash: stableHash(payload) };
}

function finalJudgeTerminalOutcome(
  verdict: MainAgentExecutionFinalJudgeProducedResult['verdict']
): MainAgentExecutionReviewerResult['terminalOutcome'] {
  if (verdict === 'coverage_satisfied') return 'clean';
  if (verdict === 'findings_present') return 'findings';
  return 'blocked';
}

export function mergeMainAgentExecutionFinalJudgeCampaign(input: {
  reviewer: MainAgentExecutionReviewerResult;
  finalJudge: MainAgentExecutionFinalJudgeResult;
}): {
  status: 'not_produced' | 'blocked' | 'remediation_required' | 'effective_pass_ready';
} {
  if (input.finalJudge.auditDecision === 'not_produced') return { status: 'not_produced' };
  if (
    input.reviewer.terminalOutcome === 'blocked' ||
    input.finalJudge.verdict === 'insufficient_evidence' ||
    input.finalJudge.verdict === 'blocked'
  ) {
    return { status: 'blocked' };
  }
  if (
    input.reviewer.terminalOutcome === 'findings' ||
    input.finalJudge.verdict === 'findings_present'
  ) {
    return { status: 'remediation_required' };
  }
  if (
    input.reviewer.terminalOutcome === 'clean' &&
    input.finalJudge.verdict === 'coverage_satisfied'
  ) {
    return { status: 'effective_pass_ready' };
  }
  return { status: 'blocked' };
}

function compileExecutionFinalJudgeAggregate(input: {
  campaignInput: MainAgentExecutionFinalJudgeCampaignInput;
  intents: MainAgentExecutionFinalJudgeActorIntent[];
  receipts: ReturnType<typeof actorReceipt>[];
}) {
  const blindInput = campaignBlindInput(input.campaignInput);
  const actorBindingPayload = {
    reviewerActorClass: input.campaignInput.reviewerActorClass,
    finalJudgeActorClass: input.campaignInput.finalJudgeActorClass,
    providerRef: input.campaignInput.providerRef,
  };
  if (input.campaignInput.actorBindingHash !== stableHash(actorBindingPayload)) {
    fail('main_agent_execution_final_judge_campaign_input_invalid');
  }
  const actorClasses = input.receipts.map((receipt) => receipt.actorClass);
  if (
    input.intents.length !== 2 ||
    input.receipts.length !== 2 ||
    new Set(actorClasses).size !== 2 ||
    !actorClasses.includes('bounded_code_reviewer') ||
    !actorClasses.includes('final_acceptance_judge')
  ) {
    fail('main_agent_execution_final_judge_actor_count_invalid');
  }
  const sortedReceipts = [...input.receipts].sort((left, right) =>
    left.actorClass.localeCompare(right.actorClass)
  );
  const payload = {
    schemaVersion: 'main-agent-execution-final-judge-aggregate/v1' as const,
    ...blindInput,
    actorBindingHash: input.campaignInput.actorBindingHash,
    actorReceipts: sortedReceipts,
    blindnessProof: {
      identicalBlindInputHash: stableHash(blindInput),
      preparedIntentHashes: uniqueSorted(
        input.intents.map((intent) => intent.invocationIntentHash)
      ),
      peerLeakageDetected: false as const,
    },
    invocationCountReceipt: {
      reviewerCalls: 1 as const,
      finalJudgeCalls: 1 as const,
      semanticInvocationCount: 2 as const,
    },
    sourceLedgerHashes: uniqueSorted(
      sortedReceipts.map((receipt) => receipt.sourceLedgerHash)
    ),
    decision: 'pass' as const,
  };
  return { ...payload, aggregateHash: stableHash(payload) };
}

function compileExecutionFinalJudgeEffectivePass(input: {
  campaignInput: MainAgentExecutionFinalJudgeCampaignInput;
  reviewerReceipt: ReturnType<typeof actorReceipt>;
  finalJudgeReceipt: ReturnType<typeof actorReceipt>;
}) {
  const ledgerPayload = {
    schemaVersion: 'main-agent-execution-final-judge-ledger/v1' as const,
    campaignId: input.campaignInput.campaignId,
    closureHashes: [input.campaignInput.closureReceiptHash],
    reviewerGateHash: input.reviewerReceipt.actorReceiptHash,
    finalJudgeValidationHash: input.finalJudgeReceipt.actorReceiptHash,
    unresolvedIssueHashes: [] as [],
    decision: 'pass' as const,
  };
  const ledger = { ...ledgerPayload, ledgerHeadHash: stableHash(ledgerPayload) };
  const statePayload = {
    schemaVersion: 'main-agent-execution-final-judge-state/v1' as const,
    mode: 'clean' as const,
    ledger,
    requiredClosureCount: 1,
    observedClosureCount: 1,
    decision: 'pass' as const,
  };
  const authorityStateHash = stableHash(statePayload);
  const payload = {
    schemaVersion: 'main-agent-execution-final-judge-effective-pass-receipt/v1' as const,
    campaignId: input.campaignInput.campaignId,
    effectivePass: true as const,
    authorityStateHash,
    ledgerHeadHash: ledger.ledgerHeadHash,
    requiredClosureCount: 1,
    observedClosureCount: 1,
    kernelOrJudgeSubstitution: false as const,
    decision: 'pass' as const,
  };
  return { ...payload, effectivePassReceiptHash: stableHash(payload) };
}

export async function executeMainAgentExecutionFinalJudgeCampaign(
  input: {
    campaignInput: MainAgentExecutionFinalJudgeCampaignInput;
    reusedFinalJudge?: {
      result: MainAgentExecutionFinalJudgeProducedResult;
      receipt: Record<string, unknown>;
    };
  },
  dependencies: {
    invokeReviewer: (
      intent: MainAgentExecutionFinalJudgeActorIntent
    ) => Promise<MainAgentExecutionReviewerResult>;
    invokeFinalJudge: (
      intent: MainAgentExecutionFinalJudgeActorIntent
    ) => Promise<MainAgentExecutionFinalJudgeResult>;
  }
) {
  const campaignInput = validateMainAgentExecutionFinalJudgeCampaignInput(
    input.campaignInput,
    input.campaignInput
  );
  const blindInput = campaignBlindInput(campaignInput);
  const dispatchGroupId = stableHash({
    campaignInputHash: campaignInput.inputHash,
    initialReviewAttemptKey: campaignInput.initialReviewAttemptKey,
  });
  const reviewerIntent = actorIntent('bounded_code_reviewer', dispatchGroupId, blindInput);
  const finalJudgeIntent = actorIntent('final_acceptance_judge', dispatchGroupId, blindInput);
  const [reviewerOutcome, finalJudgeOutcome] = await Promise.allSettled([
    dependencies.invokeReviewer(reviewerIntent),
    input.reusedFinalJudge
      ? Promise.resolve(input.reusedFinalJudge.result)
      : dependencies.invokeFinalJudge(finalJudgeIntent),
  ]);
  const finalJudgeReused = input.reusedFinalJudge !== undefined;
  const reusableFinalJudgeReceipt = (finalJudge: MainAgentExecutionFinalJudgeProducedResult) => {
    const expected = actorReceipt(
      finalJudgeIntent,
      finalJudge,
      finalJudgeTerminalOutcome(finalJudge.verdict)
    );
    if (
      input.reusedFinalJudge &&
      stableHash(input.reusedFinalJudge.receipt) !== stableHash(expected)
    ) {
      fail('main_agent_execution_final_judge_campaign_stale');
    }
    return expected;
  };
  if (reviewerOutcome.status === 'rejected') {
    const finalJudge = finalJudgeOutcome.status === 'fulfilled' ? finalJudgeOutcome.value : null;
    const finalJudgeReceipt =
      finalJudge && finalJudge.auditDecision !== 'not_produced'
        ? reusableFinalJudgeReceipt(finalJudge)
        : null;
    return Object.freeze({
      status: 'not_produced' as const,
      notProducedActor: 'bounded_code_reviewer' as const,
      sourceError: reviewerOutcome.reason,
      reviewer: null,
      finalJudge,
      reviewerReceipt: null,
      finalJudgeReceipt,
      finalJudgeReused,
      effectivePassReceipt: null,
    });
  }
  const reviewer = reviewerOutcome.value;
  if (finalJudgeOutcome.status === 'rejected') {
    return Object.freeze({
      status: 'not_produced' as const,
      notProducedActor: 'final_acceptance_judge' as const,
      sourceError: finalJudgeOutcome.reason,
      reviewer,
      finalJudge: null,
      reviewerReceipt: actorReceipt(reviewerIntent, reviewer, reviewer.terminalOutcome),
      finalJudgeReceipt: null,
      finalJudgeReused,
      effectivePassReceipt: null,
    });
  }
  const finalJudge = finalJudgeOutcome.value;
  if (finalJudge.auditDecision === 'not_produced') {
    return Object.freeze({
      status: 'not_produced' as const,
      notProducedActor: 'final_acceptance_judge' as const,
      sourceError: finalJudge.sourceErrorCode,
      reviewer,
      finalJudge,
      reviewerReceipt: actorReceipt(reviewerIntent, reviewer, reviewer.terminalOutcome),
      finalJudgeReceipt: null,
      finalJudgeReused,
      effectivePassReceipt: null,
    });
  }
  const merge = mergeMainAgentExecutionFinalJudgeCampaign({ reviewer, finalJudge });
  const reviewerReceipt = actorReceipt(reviewerIntent, reviewer, reviewer.terminalOutcome);
  const finalJudgeReceipt = reusableFinalJudgeReceipt(finalJudge);
  const aggregate = compileExecutionFinalJudgeAggregate({
    campaignInput,
    intents: [reviewerIntent, finalJudgeIntent],
    receipts: [reviewerReceipt, finalJudgeReceipt],
  });
  if (merge.status !== 'effective_pass_ready') {
    return Object.freeze({
      status: merge.status,
      reviewer,
      finalJudge,
      reviewerReceipt,
      finalJudgeReceipt,
      aggregate,
      effectivePassReceipt: null,
      finalJudgeReused,
    });
  }
  return Object.freeze({
    status: merge.status,
    reviewer,
    finalJudge,
    reviewerReceipt,
    finalJudgeReceipt,
    aggregate,
    effectivePassReceipt: compileExecutionFinalJudgeEffectivePass({
      campaignInput,
      reviewerReceipt,
      finalJudgeReceipt,
    }),
    finalJudgeReused,
  });
}
