import type { RequirementsContractMandatoryVerificationPortfolio } from './requirements-contract-mandatory-verification-portfolio';
import type { RequirementsContractModelDiversityReceipt } from './requirements-contract-model-diversity-gate';
import type { RequirementsContractParentGoalCampaignScopeManifest } from './requirements-contract-final-scope-compiler';
import {
  isRecord,
  requireHash,
  requireText,
  stableHash,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractJudgeReviewCampaignInput {
  schemaVersion: 'requirements-contract-judge-review-campaign-input/v1';
  campaignId: string;
  campaignLineageKey: string;
  scopeManifestHash: string;
  portfolioHash: string;
  modelDiversityReceiptHash: string;
  initialReviewAttemptKey: string;
  reviewerActorClass: 'bounded_code_reviewer';
  finalJudgeActorClass: 'final_acceptance_judge';
  inputHash: string;
}

export class RequirementsContractJudgeReviewCampaignInputError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractJudgeReviewCampaignInputError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractJudgeReviewCampaignInputError(code);
}

export function compileRequirementsContractJudgeReviewCampaignInput(input: {
  scopeManifest: RequirementsContractParentGoalCampaignScopeManifest;
  portfolio: RequirementsContractMandatoryVerificationPortfolio;
  modelDiversityReceipt: RequirementsContractModelDiversityReceipt;
}): RequirementsContractJudgeReviewCampaignInput {
  const { scopeManifest, portfolio, modelDiversityReceipt } = input;
  if (
    scopeManifest.campaignId !== portfolio.campaignId ||
    scopeManifest.campaignId !== modelDiversityReceipt.campaignId ||
    scopeManifest.campaignLineageKey !== portfolio.campaignLineageKey ||
    scopeManifest.campaignLineageKey !== modelDiversityReceipt.campaignLineageKey ||
    scopeManifest.scopeManifestHash !== portfolio.scopeManifestHash
  ) {
    fail('judge_review_campaign_input_scope_mismatch');
  }
  const payload = {
    schemaVersion: 'requirements-contract-judge-review-campaign-input/v1' as const,
    campaignId: scopeManifest.campaignId,
    campaignLineageKey: scopeManifest.campaignLineageKey,
    scopeManifestHash: scopeManifest.scopeManifestHash,
    portfolioHash: portfolio.portfolioHash,
    modelDiversityReceiptHash: modelDiversityReceipt.receiptHash,
    initialReviewAttemptKey: modelDiversityReceipt.initialReviewAttemptKey,
    reviewerActorClass: 'bounded_code_reviewer' as const,
    finalJudgeActorClass: 'final_acceptance_judge' as const,
  };
  return { ...payload, inputHash: stableHash(payload) };
}

export function validateRequirementsContractJudgeReviewCampaignInput(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractJudgeReviewCampaignInput {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('judge_review_campaign_input_invalid');
  const record = value as unknown as JsonRecord;
  const { inputHash: _inputHash, ...payload } = record;
  if (record.inputHash !== stableHash(payload)) fail('judge_review_campaign_input_hash_mismatch');
  for (const field of [
    'campaignId',
    'campaignLineageKey',
    'scopeManifestHash',
    'portfolioHash',
    'modelDiversityReceiptHash',
    'initialReviewAttemptKey',
  ]) {
    const expected =
      field === 'modelDiversityReceiptHash'
        ? requireHash(currentAuthority, field, 'judge_review_campaign_input_stale')
        : requireText(currentAuthority, field, 'judge_review_campaign_input_stale');
    if (record[field] !== expected) fail('judge_review_campaign_input_stale');
  }
  return value as RequirementsContractJudgeReviewCampaignInput;
}
