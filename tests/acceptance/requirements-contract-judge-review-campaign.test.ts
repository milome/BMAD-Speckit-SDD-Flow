import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractJudgeReviewCampaignController,
  validateRequirementsContractJudgeReviewCampaignController,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign';
import { compileRequirementsContractJudgeReviewCampaignTrace } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign-trace';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function trace(mode: 'clean' | 'remediated') {
  return compileRequirementsContractJudgeReviewCampaignTrace({
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    initialReviewAttemptKey: hash('initial-attempt'),
    mode,
    blindReviewAggregateHash: hash('blind-aggregate'),
    remediationLedgerHash: mode === 'remediated' ? hash('remediation-ledger') : null,
    repairTransactionManifestHash: mode === 'remediated' ? hash('repair-manifest') : null,
    remediationBaselineHash: mode === 'remediated' ? hash('baseline') : null,
    remediationJournalHash: mode === 'remediated' ? hash('journal') : null,
    remediationVerificationHash: mode === 'remediated' ? hash('verification') : null,
    publicationReceiptHash: mode === 'remediated' ? hash('publication') : null,
    finalizationByteManifestHash: mode === 'remediated' ? hash('final-bytes') : null,
    finalRejudgeInputHash: mode === 'remediated' ? hash('rejudge') : null,
    finalAcceptanceStateHash: hash(`final-state-${mode}`),
    effectivePassReceiptHash: hash(`effective-pass-${mode}`),
    transitionReceiptHashes: [hash(`transition-${mode}`)],
    originReceiptHashes: [hash('origin-a')],
    repairUnitReceiptHashes: mode === 'remediated' ? [hash('unit-a'), hash('unit-b')] : [],
    deterministicRetryReceiptHashes: mode === 'remediated' ? [hash('retry-a')] : [],
  });
}

describe('requirements contract JudgeReviewCampaign controller', () => {
  it('exports one stable typed J06 output for clean and remediated traces', () => {
    const controller = compileRequirementsContractJudgeReviewCampaignController({
      campaignInputHash: hash('campaign-input'),
      campaignId: 'goal-campaign-001',
      campaignLineageKey: hash('lineage'),
      initialReviewAttemptKey: hash('initial-attempt'),
      cleanTrace: trace('clean'),
      remediatedTrace: trace('remediated'),
      modelDiversityReceiptHash: hash('model-diversity'),
      mandatoryPortfolioHash: hash('portfolio'),
    });

    expect(controller.traceSemanticCounts).toEqual({ clean: 2, remediated: 3 });
    expect(controller.reviewerInvocationCount).toBe(1);
    expect(controller.secondReviewerPath).toBe(false);
    expect(controller.j06Output).toMatchObject({
      schemaVersion: 'requirements-contract-judge-review-campaign-j06-output/v1',
      campaignId: 'goal-campaign-001',
      cleanSemanticInvocationCount: 2,
      remediatedSemanticInvocationCount: 3,
      secondReviewerPath: false,
    });
    expect(
      validateRequirementsContractJudgeReviewCampaignController(controller, {
        campaignId: 'goal-campaign-001',
        campaignLineageKey: hash('lineage'),
        initialReviewAttemptKey: hash('initial-attempt'),
        controllerHash: controller.controllerHash,
      })
    ).toBe(controller);
  });

  it('rejects trace mismatch, missing remediated trace, and authority injection', () => {
    expect(() =>
      compileRequirementsContractJudgeReviewCampaignController({
        campaignInputHash: hash('campaign-input'),
        campaignId: 'goal-campaign-001',
        campaignLineageKey: hash('lineage'),
        initialReviewAttemptKey: hash('initial-attempt'),
        cleanTrace: trace('clean'),
        remediatedTrace: null,
        modelDiversityReceiptHash: hash('model-diversity'),
        mandatoryPortfolioHash: hash('portfolio'),
      })
    ).toThrow('judge_review_campaign_controller_trace_missing');

    expect(() =>
      compileRequirementsContractJudgeReviewCampaignController({
        campaignInputHash: hash('campaign-input'),
        campaignId: 'goal-campaign-001',
        campaignLineageKey: hash('lineage'),
        initialReviewAttemptKey: hash('initial-attempt'),
        cleanTrace: trace('clean'),
        remediatedTrace: trace('remediated'),
        modelDiversityReceiptHash: hash('model-diversity'),
        mandatoryPortfolioHash: hash('portfolio'),
        callerEffectivePass: true,
      })
    ).toThrow('judge_review_campaign_controller_authority_injection');
  });
});
