import {
  isRecord,
  requireHash,
  requireText,
  stableHash,
  text,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractModelIdentity {
  actorClass: 'bounded_code_reviewer' | 'final_acceptance_judge';
  providerRef: string;
  modelRef: string;
  modelFamily: string;
  modelRevisionHash: string;
  invocationMode: 'native';
  fallbackUsed: false;
}

export interface RequirementsContractModelDiversityReceipt {
  schemaVersion: 'requirements-contract-model-diversity-receipt/v1';
  campaignId: string;
  campaignLineageKey: string;
  reviewerModel: RequirementsContractModelIdentity;
  finalJudgeModel: RequirementsContractModelIdentity;
  actorPairHash: string;
  initialReviewAttemptKey: string;
  decision: 'pass';
  receiptHash: string;
}

export class RequirementsContractModelDiversityError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractModelDiversityError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractModelDiversityError(code);
}

function modelIdentity(
  value: unknown,
  actorClass: RequirementsContractModelIdentity['actorClass']
) {
  if (!isRecord(value)) fail('model_diversity_identity_invalid');
  if (value.actorClass !== actorClass) fail('model_diversity_identity_invalid');
  if (value.invocationMode !== 'native') fail('model_diversity_fallback_forbidden');
  if (value.fallbackUsed !== false) fail('model_diversity_fallback_forbidden');
  return {
    actorClass,
    providerRef: requireText(value, 'providerRef', 'model_diversity_identity_invalid'),
    modelRef: requireText(value, 'modelRef', 'model_diversity_identity_invalid'),
    modelFamily: requireText(value, 'modelFamily', 'model_diversity_identity_invalid'),
    modelRevisionHash: requireHash(value, 'modelRevisionHash', 'model_diversity_identity_invalid'),
    invocationMode: 'native' as const,
    fallbackUsed: false as const,
  };
}

function rejectBudgetScaling(input: JsonRecord): void {
  const budget = isRecord(input.budgetPolicy) ? input.budgetPolicy : {};
  if (budget.partitionCountBasedScaling === true || budget.budgetScaling === true) {
    fail('model_diversity_budget_scaling_forbidden');
  }
}

export function compileRequirementsContractModelDiversityReceipt(
  input: unknown
): RequirementsContractModelDiversityReceipt {
  if (!isRecord(input)) fail('model_diversity_input_invalid');
  rejectBudgetScaling(input);
  const reviewerModel = modelIdentity(input.reviewerModel, 'bounded_code_reviewer');
  const finalJudgeModel = modelIdentity(input.finalJudgeModel, 'final_acceptance_judge');
  if (reviewerModel.modelRef === finalJudgeModel.modelRef) fail('model_diversity_same_model');
  if (reviewerModel.modelFamily === finalJudgeModel.modelFamily) {
    fail('model_diversity_family_overlap');
  }
  const campaignId = requireText(input, 'campaignId', 'model_diversity_identity_invalid');
  const campaignLineageKey = requireHash(
    input,
    'campaignLineageKey',
    'model_diversity_identity_invalid'
  );
  const currentAuthority = isRecord(input.currentAuthority) ? input.currentAuthority : {};
  if (
    text(currentAuthority.campaignLineageKey) !== campaignLineageKey ||
    text(currentAuthority.campaignId) !== campaignId
  ) {
    fail('model_diversity_lineage_stale');
  }
  const actorPairHash = stableHash({ reviewerModel, finalJudgeModel });
  const payload = {
    schemaVersion: 'requirements-contract-model-diversity-receipt/v1' as const,
    campaignId,
    campaignLineageKey,
    reviewerModel,
    finalJudgeModel,
    actorPairHash,
    initialReviewAttemptKey: stableHash({
      campaignId,
      campaignLineageKey,
      actorPairHash,
      attemptOrdinal: 1,
    }),
    decision: 'pass' as const,
  };
  return { ...payload, receiptHash: stableHash(payload) };
}

export function validateRequirementsContractModelDiversityReceipt(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractModelDiversityReceipt {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('model_diversity_receipt_invalid');
  const receipt = value as unknown as RequirementsContractModelDiversityReceipt;
  const { receiptHash, ...payload } = receipt;
  if (receiptHash !== stableHash(payload)) fail('model_diversity_hash_mismatch');
  if (
    receipt.decision !== 'pass' ||
    receipt.campaignId !== currentAuthority.campaignId ||
    receipt.campaignLineageKey !== currentAuthority.campaignLineageKey
  ) {
    fail('model_diversity_lineage_stale');
  }
  return receipt;
}
