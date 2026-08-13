import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractModelDiversityReceipt,
  validateRequirementsContractModelDiversityReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model-diversity-gate';
import {
  compileMainAgentExecutionFinalJudgeCampaignInput,
  validateMainAgentExecutionFinalJudgeCampaignInput,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-judge-campaign-input';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function reviewerModel(overrides = {}) {
  return {
    actorClass: 'bounded_code_reviewer',
    providerRef: 'provider/reviewer',
    modelRef: 'reviewer-model-a',
    modelFamily: 'family-a',
    modelRevisionHash: hash('reviewer-revision'),
    invocationMode: 'native',
    fallbackUsed: false,
    ...overrides,
  };
}

function finalJudgeModel(overrides = {}) {
  return {
    actorClass: 'final_acceptance_judge',
    providerRef: 'provider/final-judge',
    modelRef: 'final-judge-model-b',
    modelFamily: 'family-b',
    modelRevisionHash: hash('final-revision'),
    invocationMode: 'native',
    fallbackUsed: false,
    ...overrides,
  };
}

function diversityInput(overrides = {}) {
  return {
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    reviewerModel: reviewerModel(),
    finalJudgeModel: finalJudgeModel(),
    budgetPolicy: {
      partitionCountBasedScaling: false,
    },
    currentAuthority: {
      campaignId: 'goal-campaign-001',
      campaignLineageKey: hash('lineage'),
    },
    ...overrides,
  };
}

describe('requirements contract model diversity gate', () => {
  it('writes one diverse blind actor pair and initial review attempt key', () => {
    const receipt = compileRequirementsContractModelDiversityReceipt(diversityInput());
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-model-diversity-receipt.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(receipt.decision).toBe('pass');
    expect(receipt.reviewerModel.modelRef).toBe('reviewer-model-a');
    expect(receipt.finalJudgeModel.modelRef).toBe('final-judge-model-b');
    expect(receipt.initialReviewAttemptKey).toMatch(/^sha256:/u);
    expect(validate(receipt), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(
      validateRequirementsContractModelDiversityReceipt(receipt, {
        campaignId: receipt.campaignId,
        campaignLineageKey: receipt.campaignLineageKey,
      })
    ).toBe(receipt);
  });

  it.each([
    [
      'same observed model',
      { finalJudgeModel: finalJudgeModel({ modelRef: 'reviewer-model-a' }) },
      'model_diversity_same_model',
    ],
    [
      'family overlap',
      { finalJudgeModel: finalJudgeModel({ modelFamily: 'family-a' }) },
      'model_diversity_family_overlap',
    ],
    [
      'unknown identity',
      { reviewerModel: reviewerModel({ modelRef: '' }) },
      'model_diversity_identity_invalid',
    ],
    [
      'fallback reviewer',
      { reviewerModel: reviewerModel({ fallbackUsed: true }) },
      'model_diversity_fallback_forbidden',
    ],
    [
      'fallback mode',
      { finalJudgeModel: finalJudgeModel({ invocationMode: 'fallback' }) },
      'model_diversity_fallback_forbidden',
    ],
    [
      'budget scaling',
      { budgetPolicy: { partitionCountBasedScaling: true } },
      'model_diversity_budget_scaling_forbidden',
    ],
    [
      'stale lineage',
      { currentAuthority: { campaignId: 'goal-campaign-001', campaignLineageKey: hash('other') } },
      'model_diversity_lineage_stale',
    ],
  ])('fails closed for %s', (_name, patch, code) => {
    expect(() =>
      compileRequirementsContractModelDiversityReceipt({
        ...diversityInput(),
        ...patch,
      })
    ).toThrow(code);
  });

  it('binds the diverse initial review attempt to the current final Judge campaign input', () => {
    const modelDiversityReceipt =
      compileRequirementsContractModelDiversityReceipt(diversityInput());
    const campaignInput = compileMainAgentExecutionFinalJudgeCampaignInput({
      campaignId: modelDiversityReceipt.campaignId,
      campaignLineageKey: modelDiversityReceipt.campaignLineageKey,
      closureReceiptHash: hash('closure'),
      candidateBytesHash: hash('candidate'),
      currentImplementationHash: hash('implementation'),
      currentEvidenceHash: hash('evidence'),
      initialReviewAttemptKey: modelDiversityReceipt.initialReviewAttemptKey,
      providerRef: modelDiversityReceipt.finalJudgeModel.providerRef,
    });

    expect(campaignInput).toMatchObject({
      schemaVersion: 'main-agent-execution-final-judge-campaign-input/v1',
      campaignId: modelDiversityReceipt.campaignId,
      campaignLineageKey: modelDiversityReceipt.campaignLineageKey,
      initialReviewAttemptKey: modelDiversityReceipt.initialReviewAttemptKey,
      providerRef: modelDiversityReceipt.finalJudgeModel.providerRef,
      reviewerActorClass: 'bounded_code_reviewer',
      finalJudgeActorClass: 'final_acceptance_judge',
    });
    expect(
      validateMainAgentExecutionFinalJudgeCampaignInput(campaignInput, {
        campaignId: campaignInput.campaignId,
        campaignLineageKey: campaignInput.campaignLineageKey,
        closureReceiptHash: campaignInput.closureReceiptHash,
        candidateBytesHash: campaignInput.candidateBytesHash,
        currentImplementationHash: campaignInput.currentImplementationHash,
        currentEvidenceHash: campaignInput.currentEvidenceHash,
        initialReviewAttemptKey: campaignInput.initialReviewAttemptKey,
        providerRef: campaignInput.providerRef,
        actorBindingHash: campaignInput.actorBindingHash,
      })
    ).toBe(campaignInput);
    expect(() =>
      validateMainAgentExecutionFinalJudgeCampaignInput(
        { ...campaignInput, candidateBytesHash: hash('tamper') },
        {
          campaignId: campaignInput.campaignId,
          campaignLineageKey: campaignInput.campaignLineageKey,
          closureReceiptHash: campaignInput.closureReceiptHash,
          candidateBytesHash: campaignInput.candidateBytesHash,
          currentImplementationHash: campaignInput.currentImplementationHash,
          currentEvidenceHash: campaignInput.currentEvidenceHash,
          initialReviewAttemptKey: campaignInput.initialReviewAttemptKey,
          providerRef: campaignInput.providerRef,
          actorBindingHash: campaignInput.actorBindingHash,
        }
      )
    ).toThrow('main_agent_execution_final_judge_campaign_input_hash_mismatch');
  });
});
