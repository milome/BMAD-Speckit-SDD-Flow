import {
  isRecord,
  requireHash,
  requireText,
  stableHash,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';

export interface MainAgentExecutionFinalJudgeCampaignInput {
  schemaVersion: 'main-agent-execution-final-judge-campaign-input/v1';
  campaignId: string;
  campaignLineageKey: string;
  closureReceiptHash: string;
  candidateBytesHash: string;
  currentImplementationHash: string;
  currentEvidenceHash: string;
  initialReviewAttemptKey: string;
  reviewerActorClass: 'bounded_code_reviewer';
  finalJudgeActorClass: 'final_acceptance_judge';
  providerRef: string;
  actorBindingHash: string;
  inputHash: string;
}

export class MainAgentExecutionFinalJudgeCampaignInputError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'MainAgentExecutionFinalJudgeCampaignInputError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new MainAgentExecutionFinalJudgeCampaignInputError(code);
}

export function compileMainAgentExecutionFinalJudgeCampaignInput(input: {
  campaignId: string;
  campaignLineageKey: string;
  closureReceiptHash: string;
  candidateBytesHash: string;
  currentImplementationHash: string;
  currentEvidenceHash: string;
  initialReviewAttemptKey: string;
  providerRef: string;
}): MainAgentExecutionFinalJudgeCampaignInput {
  const reviewerActorClass = 'bounded_code_reviewer' as const;
  const finalJudgeActorClass = 'final_acceptance_judge' as const;
  const providerRef = requireText(
    input,
    'providerRef',
    'main_agent_execution_final_judge_campaign_input_invalid'
  );
  const payload = {
    schemaVersion: 'main-agent-execution-final-judge-campaign-input/v1' as const,
    campaignId: requireText(
      input,
      'campaignId',
      'main_agent_execution_final_judge_campaign_input_invalid'
    ),
    campaignLineageKey: requireHash(
      input,
      'campaignLineageKey',
      'main_agent_execution_final_judge_campaign_input_invalid'
    ),
    closureReceiptHash: requireHash(
      input,
      'closureReceiptHash',
      'main_agent_execution_final_judge_campaign_input_invalid'
    ),
    candidateBytesHash: requireHash(
      input,
      'candidateBytesHash',
      'main_agent_execution_final_judge_campaign_input_invalid'
    ),
    currentImplementationHash: requireHash(
      input,
      'currentImplementationHash',
      'main_agent_execution_final_judge_campaign_input_invalid'
    ),
    currentEvidenceHash: requireHash(
      input,
      'currentEvidenceHash',
      'main_agent_execution_final_judge_campaign_input_invalid'
    ),
    initialReviewAttemptKey: requireHash(
      input,
      'initialReviewAttemptKey',
      'main_agent_execution_final_judge_campaign_input_invalid'
    ),
    reviewerActorClass,
    finalJudgeActorClass,
    providerRef,
    actorBindingHash: stableHash({ reviewerActorClass, finalJudgeActorClass, providerRef }),
  };
  return { ...payload, inputHash: stableHash(payload) };
}

export function validateMainAgentExecutionFinalJudgeCampaignInput(
  value: unknown,
  currentAuthority: unknown
): MainAgentExecutionFinalJudgeCampaignInput {
  if (!isRecord(value) || !isRecord(currentAuthority)) {
    fail('main_agent_execution_final_judge_campaign_input_invalid');
  }
  const record = value as unknown as JsonRecord;
  const { inputHash: _inputHash, ...payload } = record;
  if (
    record.schemaVersion !== 'main-agent-execution-final-judge-campaign-input/v1' ||
    record.inputHash !== stableHash(payload) ||
    record.reviewerActorClass !== 'bounded_code_reviewer' ||
    record.finalJudgeActorClass !== 'final_acceptance_judge'
  ) {
    fail('main_agent_execution_final_judge_campaign_input_hash_mismatch');
  }
  for (const field of [
    'campaignId',
    'campaignLineageKey',
    'closureReceiptHash',
    'candidateBytesHash',
    'currentImplementationHash',
    'currentEvidenceHash',
    'initialReviewAttemptKey',
    'providerRef',
    'actorBindingHash',
  ]) {
    const expected = requireText(
      currentAuthority,
      field,
      'main_agent_execution_final_judge_campaign_input_stale'
    );
    if (record[field] !== expected) {
      fail('main_agent_execution_final_judge_campaign_input_stale');
    }
  }
  return value as MainAgentExecutionFinalJudgeCampaignInput;
}
