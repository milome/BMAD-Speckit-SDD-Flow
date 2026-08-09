import {
  isRecord,
  requireHash,
  requireText,
  stableHash,
  text,
} from './requirements-contract-verification-evidence-normalizer';
import type {
  RequirementsContractJudgeReviewCampaignTrace,
  RequirementsContractJudgeReviewCampaignJ06TraceOutput,
} from './requirements-contract-judge-review-campaign-trace';
import { validateRequirementsContractJudgeReviewCampaignTrace } from './requirements-contract-judge-review-campaign-trace';
import {
  validateRequirementsContractJudgeReviewCampaignInput,
  type RequirementsContractJudgeReviewCampaignInputV2,
} from './requirements-contract-judge-review-campaign-input';
import { compileRequirementsContractParentGoalBlindReviewAggregate } from './requirements-contract-parent-goal-blind-review';
import { evaluateRequirementsContractFinalAcceptanceEffectivePass } from './requirements-contract-final-acceptance-effective-pass-gate';

export interface RequirementsContractJudgeReviewCampaignJ06Output {
  schemaVersion: 'requirements-contract-judge-review-campaign-j06-output/v1';
  campaignId: string;
  campaignLineageKey: string;
  initialReviewAttemptKey: string;
  campaignInputHash: string;
  controllerHash: string;
  cleanTrace: RequirementsContractJudgeReviewCampaignJ06TraceOutput;
  remediatedTrace: RequirementsContractJudgeReviewCampaignJ06TraceOutput;
  cleanSemanticInvocationCount: 2;
  remediatedSemanticInvocationCount: 3;
  reviewerInvocationCount: 1;
  secondReviewerPath: false;
  outputHash: string;
}

export interface RequirementsContractJudgeReviewCampaignController {
  schemaVersion: 'requirements-contract-judge-review-campaign-controller/v1';
  campaignId: string;
  campaignLineageKey: string;
  initialReviewAttemptKey: string;
  campaignInputHash: string;
  modelDiversityReceiptHash: string;
  mandatoryPortfolioHash: string;
  cleanTrace: RequirementsContractJudgeReviewCampaignTrace;
  remediatedTrace: RequirementsContractJudgeReviewCampaignTrace;
  traceSemanticCounts: {
    clean: 2;
    remediated: 3;
  };
  reviewerInvocationCount: 1;
  secondReviewerPath: false;
  completeReceiptSet: true;
  j06Output: RequirementsContractJudgeReviewCampaignJ06Output;
  controllerHash: string;
  decision: 'pass';
}

export interface RequirementsContractJudgeReviewCampaignControllerV2 {
  schemaVersion: 'requirements-contract-judge-review-campaign-controller/v2';
  campaignId: string;
  campaignLineageKey: string;
  initialReviewAttemptKey: string;
  campaignInputHash: string;
  actorBindingHash: string;
  reviewerActorClass: 'bounded_code_reviewer';
  finalJudgeActorClass: 'final_acceptance_judge';
  providerRef: string;
  cleanTrace: RequirementsContractJudgeReviewCampaignTrace;
  remediatedTrace: null;
  traceSemanticCounts: { clean: 2; remediated: 3 };
  reviewerInvocationCount: 1;
  secondReviewerPath: false;
  completeReceiptSet: true;
  j06Output: {
    schemaVersion: 'requirements-contract-judge-review-campaign-j06-output/v2';
    campaignId: string;
    campaignLineageKey: string;
    initialReviewAttemptKey: string;
    campaignInputHash: string;
    controllerHash: string;
    cleanTrace: RequirementsContractJudgeReviewCampaignJ06TraceOutput;
    cleanSemanticInvocationCount: 2;
    remediatedSemanticInvocationCount: 3;
    reviewerInvocationCount: 1;
    secondReviewerPath: false;
    outputHash: string;
  };
  controllerHash: string;
  decision: 'pass';
}

export class RequirementsContractJudgeReviewCampaignControllerError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractJudgeReviewCampaignControllerError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractJudgeReviewCampaignControllerError(code);
}

function rejectAuthorityInjection(input: Record<string, unknown>): void {
  for (const key of Object.keys(input)) {
    const normalized = key.replace(/[-_]/gu, '').toLowerCase();
    if (
      normalized.includes('callerverdict') ||
      normalized.includes('callerfinding') ||
      normalized.includes('callerscope') ||
      normalized.includes('callereffectivepass') ||
      normalized.includes('callercloseoutauthority')
    ) {
      fail('judge_review_campaign_controller_authority_injection');
    }
  }
}

function requireTrace(
  value: unknown,
  authority: {
    campaignId: string;
    campaignLineageKey: string;
    initialReviewAttemptKey: string;
  }
): RequirementsContractJudgeReviewCampaignTrace {
  if (!isRecord(value)) fail('judge_review_campaign_controller_trace_missing');
  const traceHash = requireText(
    value,
    'traceHash',
    'judge_review_campaign_controller_trace_missing'
  );
  return validateRequirementsContractJudgeReviewCampaignTrace(value, {
    ...authority,
    traceHash,
  });
}

export function compileRequirementsContractJudgeReviewCampaignController(
  input: unknown
):
  | RequirementsContractJudgeReviewCampaignController
  | RequirementsContractJudgeReviewCampaignControllerV2 {
  if (!isRecord(input)) fail('judge_review_campaign_controller_invalid');
  rejectAuthorityInjection(input);
  const authority = {
    campaignId: requireText(input, 'campaignId', 'judge_review_campaign_controller_identity'),
    campaignLineageKey: requireHash(
      input,
      'campaignLineageKey',
      'judge_review_campaign_controller_identity'
    ),
    initialReviewAttemptKey: requireHash(
      input,
      'initialReviewAttemptKey',
      'judge_review_campaign_controller_identity'
    ),
  };
  if (input.actorBindingHash !== undefined) {
    const cleanTrace = requireTrace(input.cleanTrace, authority);
    if (cleanTrace.mode !== 'clean' || input.remediatedTrace !== null) {
      fail('judge_review_campaign_controller_trace_mode_invalid');
    }
    const reviewerActorClass = requireText(
      input,
      'reviewerActorClass',
      'judge_review_campaign_controller_identity'
    );
    const finalJudgeActorClass = requireText(
      input,
      'finalJudgeActorClass',
      'judge_review_campaign_controller_identity'
    );
    if (
      reviewerActorClass !== 'bounded_code_reviewer' ||
      finalJudgeActorClass !== 'final_acceptance_judge'
    ) {
      fail('judge_review_campaign_controller_identity');
    }
    const payload = {
      schemaVersion: 'requirements-contract-judge-review-campaign-controller/v2' as const,
      ...authority,
      campaignInputHash: requireHash(
        input,
        'campaignInputHash',
        'judge_review_campaign_controller_identity'
      ),
      actorBindingHash: requireHash(
        input,
        'actorBindingHash',
        'judge_review_campaign_controller_identity'
      ),
      reviewerActorClass: 'bounded_code_reviewer' as const,
      finalJudgeActorClass: 'final_acceptance_judge' as const,
      providerRef: requireText(input, 'providerRef', 'judge_review_campaign_controller_identity'),
      cleanTrace,
      remediatedTrace: null,
      traceSemanticCounts: { clean: 2 as const, remediated: 3 as const },
      reviewerInvocationCount: 1 as const,
      secondReviewerPath: false as const,
      completeReceiptSet: true as const,
    };
    const controllerHash = stableHash(payload);
    const j06Payload = {
      schemaVersion: 'requirements-contract-judge-review-campaign-j06-output/v2' as const,
      ...authority,
      campaignInputHash: payload.campaignInputHash,
      controllerHash,
      cleanTrace: cleanTrace.j06StableOutput,
      cleanSemanticInvocationCount: 2 as const,
      remediatedSemanticInvocationCount: 3 as const,
      reviewerInvocationCount: 1 as const,
      secondReviewerPath: false as const,
    };
    return {
      ...payload,
      j06Output: { ...j06Payload, outputHash: stableHash(j06Payload) },
      controllerHash,
      decision: 'pass',
    };
  }
  const cleanTrace = requireTrace(input.cleanTrace, authority);
  const remediatedTrace = requireTrace(input.remediatedTrace, authority);
  if (cleanTrace.mode !== 'clean' || remediatedTrace.mode !== 'remediated') {
    fail('judge_review_campaign_controller_trace_mode_invalid');
  }
  if (
    cleanTrace.invocationCounts.semanticInvocationCount !== 2 ||
    remediatedTrace.invocationCounts.semanticInvocationCount !== 3 ||
    cleanTrace.invocationCounts.reviewerCalls !== 1 ||
    remediatedTrace.invocationCounts.reviewerCalls !== 1
  ) {
    fail('judge_review_campaign_controller_semantic_counts_invalid');
  }
  const payload = {
    schemaVersion: 'requirements-contract-judge-review-campaign-controller/v1' as const,
    ...authority,
    campaignInputHash: requireHash(
      input,
      'campaignInputHash',
      'judge_review_campaign_controller_identity'
    ),
    modelDiversityReceiptHash: requireHash(
      input,
      'modelDiversityReceiptHash',
      'judge_review_campaign_controller_identity'
    ),
    mandatoryPortfolioHash: requireHash(
      input,
      'mandatoryPortfolioHash',
      'judge_review_campaign_controller_identity'
    ),
    cleanTrace,
    remediatedTrace,
    traceSemanticCounts: {
      clean: 2 as const,
      remediated: 3 as const,
    },
    reviewerInvocationCount: 1 as const,
    secondReviewerPath: false as const,
    completeReceiptSet: true as const,
  };
  const controllerHash = stableHash(payload);
  const j06Payload = {
    schemaVersion: 'requirements-contract-judge-review-campaign-j06-output/v1' as const,
    ...authority,
    campaignInputHash: payload.campaignInputHash,
    controllerHash,
    cleanTrace: cleanTrace.j06StableOutput,
    remediatedTrace: remediatedTrace.j06StableOutput,
    cleanSemanticInvocationCount: 2 as const,
    remediatedSemanticInvocationCount: 3 as const,
    reviewerInvocationCount: 1 as const,
    secondReviewerPath: false as const,
  };
  const j06Output = { ...j06Payload, outputHash: stableHash(j06Payload) };
  return {
    ...payload,
    j06Output,
    controllerHash,
    decision: 'pass' as const,
  };
}

export function mergeJudgeReviewCampaign(input: unknown): {
  status: 'not_produced' | 'blocked' | 'remediation_required' | 'effective_pass_ready';
} {
  if (!isRecord(input) || !isRecord(input.reviewer) || !isRecord(input.finalJudge)) {
    fail('judge_review_campaign_controller_invalid');
  }
  const reviewer = input.reviewer;
  const finalJudge = input.finalJudge;
  if (finalJudge.auditDecision === 'not_produced') return { status: 'not_produced' };
  if (
    reviewer.terminalOutcome === 'blocked' ||
    finalJudge.verdict === 'insufficient_evidence' ||
    finalJudge.verdict === 'blocked'
  ) {
    return { status: 'blocked' };
  }
  if (reviewer.terminalOutcome === 'findings' || finalJudge.verdict === 'findings_present') {
    return { status: 'remediation_required' };
  }
  if (reviewer.terminalOutcome === 'clean' && finalJudge.verdict === 'coverage_satisfied') {
    return { status: 'effective_pass_ready' };
  }
  return { status: 'blocked' };
}

export type JudgeReviewActorIntent = {
  actorClass: 'bounded_code_reviewer' | 'final_acceptance_judge';
  dispatchMode: 'parallel';
  invocationMode: 'native';
  dispatchGroupId: string;
  preparedBeforeDispatch: true;
  blindInput: Record<string, unknown>;
  blindInputHash: string;
  invocationIntentHash: string;
};

export type ReviewerExecutionResult = {
  sourceLedgerHash: string;
  terminalOutcome: 'clean' | 'findings' | 'blocked';
  findingIds?: string[];
};

export type FinalJudgeProducedResult = {
  sourceLedgerHash: string;
  auditDecision: 'pass' | 'fail';
  verdict: 'coverage_satisfied' | 'findings_present' | 'insufficient_evidence' | 'blocked';
  findingIds?: string[];
};

export type FinalJudgeNotProducedResult = {
  auditDecision: 'not_produced';
  sourceErrorCode: string;
};

export type FinalJudgeExecutionResult = FinalJudgeProducedResult | FinalJudgeNotProducedResult;

function campaignBlindInput(input: RequirementsContractJudgeReviewCampaignInputV2) {
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
  actorClass: JudgeReviewActorIntent['actorClass'],
  dispatchGroupId: string,
  blindInput: Record<string, unknown>
): JudgeReviewActorIntent {
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
  intent: JudgeReviewActorIntent,
  result: Pick<ReviewerExecutionResult, 'sourceLedgerHash' | 'findingIds'>,
  terminalOutcome: ReviewerExecutionResult['terminalOutcome']
) {
  if (!/^sha256:[0-9a-f]{64}$/u.test(result.sourceLedgerHash)) {
    fail('blind_review_actor_receipt_invalid');
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
    findingIds: [...new Set(result.findingIds ?? [])].sort(),
  };
  return { ...payload, actorReceiptHash: stableHash(payload) };
}

function finalJudgeTerminalOutcome(
  verdict: FinalJudgeProducedResult['verdict']
): ReviewerExecutionResult['terminalOutcome'] {
  if (verdict === 'coverage_satisfied') return 'clean';
  if (verdict === 'findings_present') return 'findings';
  return 'blocked';
}

export async function executeJudgeReviewCampaign(
  input: {
    campaignInput: RequirementsContractJudgeReviewCampaignInputV2;
    finalAcceptanceState?: unknown;
    reusedFinalJudge?: {
      result: FinalJudgeProducedResult;
      receipt: Record<string, unknown>;
    };
  },
  dependencies: {
    invokeReviewer: (intent: JudgeReviewActorIntent) => Promise<ReviewerExecutionResult>;
    invokeFinalJudge: (intent: JudgeReviewActorIntent) => Promise<FinalJudgeExecutionResult>;
  }
) {
  const campaignInput = validateRequirementsContractJudgeReviewCampaignInput(
    input.campaignInput,
    input.campaignInput
  );
  if (campaignInput.schemaVersion !== 'requirements-contract-judge-review-campaign-input/v2') {
    fail('judge_review_campaign_controller_invalid');
  }
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
  const reusableFinalJudgeReceipt = (finalJudge: FinalJudgeProducedResult) => {
    const expected = actorReceipt(
      finalJudgeIntent,
      finalJudge,
      finalJudgeTerminalOutcome(finalJudge.verdict)
    );
    if (
      input.reusedFinalJudge &&
      stableHash(input.reusedFinalJudge.receipt) !== stableHash(expected)
    ) {
      fail('judge_review_campaign_controller_stale');
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
  const merge = mergeJudgeReviewCampaign({ reviewer, finalJudge });
  const reviewerReceipt = actorReceipt(reviewerIntent, reviewer, reviewer.terminalOutcome);
  const finalJudgeReceipt = reusableFinalJudgeReceipt(finalJudge);
  const aggregate = compileRequirementsContractParentGoalBlindReviewAggregate({
    campaignInput,
    preparedIntents: [reviewerIntent, finalJudgeIntent],
    actorReceipts: [reviewerReceipt, finalJudgeReceipt],
  });
  if (merge.status !== 'effective_pass_ready') {
    return Object.freeze({
      status: merge.status,
      reviewerReceipt,
      finalJudgeReceipt,
      aggregate,
      effectivePassReceipt: null,
      finalJudgeReused,
    });
  }
  const effectivePassReceipt = evaluateRequirementsContractFinalAcceptanceEffectivePass({
    state: {
      mode: 'clean',
      requiredClosureCount: 1,
      observedClosureCount: 1,
      ledger: {
        campaignId: campaignInput.campaignId,
        closureHashes: [campaignInput.closureReceiptHash],
        reviewerGateHash: reviewerReceipt.actorReceiptHash,
        finalJudgeValidationHash: finalJudgeReceipt.actorReceiptHash,
        unresolvedIssueHashes: [],
      },
      replayedAttempt: false,
      partialAuthority: false,
    },
    kernelOrJudgeSubstitution: false,
  });
  if (effectivePassReceipt.campaignId !== campaignInput.campaignId) {
    fail('judge_review_campaign_controller_stale');
  }
  return Object.freeze({
    status: merge.status,
    reviewerReceipt,
    finalJudgeReceipt,
    aggregate,
    effectivePassReceipt,
    finalJudgeReused,
  });
}

export function validateRequirementsContractJudgeReviewCampaignController(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractJudgeReviewCampaignController {
  if (!isRecord(value) || !isRecord(currentAuthority)) {
    fail('judge_review_campaign_controller_invalid');
  }
  const controller = value as unknown as RequirementsContractJudgeReviewCampaignController;
  const { controllerHash, decision, j06Output, ...payload } = controller;
  if (
    decision !== 'pass' ||
    controller.schemaVersion !== 'requirements-contract-judge-review-campaign-controller/v1' ||
    controller.secondReviewerPath !== false ||
    controller.completeReceiptSet !== true ||
    controllerHash !== stableHash(payload)
  ) {
    fail('judge_review_campaign_controller_hash_mismatch');
  }
  if (
    j06Output.schemaVersion !== 'requirements-contract-judge-review-campaign-j06-output/v1' ||
    j06Output.controllerHash !== controllerHash
  ) {
    fail('judge_review_campaign_controller_output_invalid');
  }
  const { outputHash, ...j06Payload } = j06Output;
  if (outputHash !== stableHash(j06Payload)) {
    fail('judge_review_campaign_controller_output_invalid');
  }
  for (const field of [
    'campaignId',
    'campaignLineageKey',
    'initialReviewAttemptKey',
    'controllerHash',
  ] as const) {
    if (text(controller[field]) !== text(currentAuthority[field])) {
      fail('judge_review_campaign_controller_stale');
    }
  }
  return controller;
}
