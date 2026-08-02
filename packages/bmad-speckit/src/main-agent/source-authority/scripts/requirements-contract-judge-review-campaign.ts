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
  const traceHash = requireText(value, 'traceHash', 'judge_review_campaign_controller_trace_missing');
  return validateRequirementsContractJudgeReviewCampaignTrace(value, {
    ...authority,
    traceHash,
  });
}

export function compileRequirementsContractJudgeReviewCampaignController(
  input: unknown
): RequirementsContractJudgeReviewCampaignController {
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
