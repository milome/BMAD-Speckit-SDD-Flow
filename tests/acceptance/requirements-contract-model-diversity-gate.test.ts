import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractModelDiversityReceipt,
  validateRequirementsContractModelDiversityReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model-diversity-gate';
import {
  compileRequirementsContractJudgeReviewCampaignInput,
  validateRequirementsContractJudgeReviewCampaignInput,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign-input';
import { compileRequirementsContractFinalScopeManifest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-final-scope-compiler';
import { compileRequirementsContractMandatoryVerificationPortfolio } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-mandatory-verification-portfolio';
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

function scopeAndPortfolio() {
  const scopeManifest = compileRequirementsContractFinalScopeManifest({
    campaignId: 'goal-campaign-001',
    attemptId: 'attempt-001',
    partitionManifestHash: hash('manifest'),
    partitionSetHash: hash('partition-set'),
    sourceAuthorityBundleHash: hash('source-authority'),
    sourceCompositionPolicyHash: hash('source-policy'),
    expectedPartitionIds: ['partition-a'],
    childClosureReceipts: [
      {
        partitionId: 'partition-a',
        childContractHash: hash('child'),
        receiptHash: hash('closure'),
        governedFileManifestHash: hash('files'),
        subcontractEvidenceHash: hash('evidence'),
        productionReachabilityReceiptHash: hash('reachability'),
        dependencyClosureHash: hash('deps'),
        decision: 'pass',
      },
    ],
    governedPathRefs: ['src/a.ts'],
    taskReportProvenanceRefs: ['task-report/p01'],
    priorFindingRefs: [],
    deliverySurfaceRefs: ['surface/codex'],
    policyRefs: ['policy/fail-closed'],
    currentImplementationLineage: {
      current: true,
      decision: 'pass',
      partitionManifestHash: hash('manifest'),
      partitionSetHash: hash('partition-set'),
      implementationLineageHash: hash('lineage-root'),
    },
  });
  const portfolio = compileRequirementsContractMandatoryVerificationPortfolio({
    campaignId: scopeManifest.campaignId,
    scopeManifestHash: scopeManifest.scopeManifestHash,
    campaignLineageKey: scopeManifest.campaignLineageKey,
    requiredSections: [
      'complete_dependencies',
      'governed_bytes',
      'verification_evidence',
      'production_reachability',
      'task_report_provenance',
      'mandatory_portfolio',
      'delivery_surfaces',
      'prior_findings',
      'policy',
    ],
    evidenceRefs: ['evidence/child-closure'],
    commandRefs: ['CMD-J05-T01-01'],
    taskReportProvenanceRefs: ['task-report/p01'],
    deliverySurfaceRefs: ['surface/codex'],
    policyRefs: ['policy/fail-closed'],
    priorFindingRefs: [],
    currentAuthority: {
      scopeManifestHash: scopeManifest.scopeManifestHash,
      campaignLineageKey: scopeManifest.campaignLineageKey,
    },
  });
  return { scopeManifest, portfolio };
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

  it('exports a typed campaign input bound to scope, portfolio, diversity, and initial attempt', () => {
    const { scopeManifest, portfolio } = scopeAndPortfolio();
    const modelDiversityReceipt = compileRequirementsContractModelDiversityReceipt(
      diversityInput({
        campaignId: scopeManifest.campaignId,
        campaignLineageKey: scopeManifest.campaignLineageKey,
        currentAuthority: {
          campaignId: scopeManifest.campaignId,
          campaignLineageKey: scopeManifest.campaignLineageKey,
        },
      })
    );
    const campaignInput = compileRequirementsContractJudgeReviewCampaignInput({
      scopeManifest,
      portfolio,
      modelDiversityReceipt,
    });

    expect(campaignInput).toMatchObject({
      schemaVersion: 'requirements-contract-judge-review-campaign-input/v1',
      campaignId: scopeManifest.campaignId,
      campaignLineageKey: scopeManifest.campaignLineageKey,
      scopeManifestHash: scopeManifest.scopeManifestHash,
      portfolioHash: portfolio.portfolioHash,
      modelDiversityReceiptHash: modelDiversityReceipt.receiptHash,
      initialReviewAttemptKey: modelDiversityReceipt.initialReviewAttemptKey,
    });
    expect(
      validateRequirementsContractJudgeReviewCampaignInput(campaignInput, {
        campaignId: campaignInput.campaignId,
        campaignLineageKey: campaignInput.campaignLineageKey,
        scopeManifestHash: campaignInput.scopeManifestHash,
        portfolioHash: campaignInput.portfolioHash,
        modelDiversityReceiptHash: campaignInput.modelDiversityReceiptHash,
        initialReviewAttemptKey: campaignInput.initialReviewAttemptKey,
      })
    ).toBe(campaignInput);
    expect(() =>
      validateRequirementsContractJudgeReviewCampaignInput(
        { ...campaignInput, portfolioHash: hash('tamper') },
        {
          campaignId: campaignInput.campaignId,
          campaignLineageKey: campaignInput.campaignLineageKey,
          scopeManifestHash: campaignInput.scopeManifestHash,
          portfolioHash: campaignInput.portfolioHash,
          modelDiversityReceiptHash: campaignInput.modelDiversityReceiptHash,
          initialReviewAttemptKey: campaignInput.initialReviewAttemptKey,
        }
      )
    ).toThrow('judge_review_campaign_input_hash_mismatch');
  });
});
