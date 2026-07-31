import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractJudgeReviewCampaignTrace,
  validateRequirementsContractJudgeReviewCampaignTrace,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign-trace';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function baseInput(overrides = {}) {
  return {
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    initialReviewAttemptKey: hash('initial-attempt'),
    blindReviewAggregateHash: hash('blind-aggregate'),
    remediationLedgerHash: hash('remediation-ledger'),
    repairTransactionManifestHash: hash('repair-manifest'),
    remediationBaselineHash: hash('baseline'),
    remediationJournalHash: hash('journal'),
    remediationVerificationHash: hash('verification'),
    publicationReceiptHash: hash('publication'),
    finalizationByteManifestHash: hash('final-bytes'),
    finalRejudgeInputHash: hash('rejudge'),
    finalAcceptanceStateHash: hash('final-state'),
    effectivePassReceiptHash: hash('effective-pass'),
    transitionReceiptHashes: [hash('transition-a'), hash('transition-b')],
    originReceiptHashes: [hash('origin-a')],
    repairUnitReceiptHashes: [hash('unit-a'), hash('unit-b')],
    deterministicRetryReceiptHashes: [hash('retry-a')],
    ...overrides,
  };
}

describe('requirements contract JudgeReviewCampaign source-tree trace', () => {
  it('records clean semantic count 2 without remediation or a second Reviewer path', () => {
    const trace = compileRequirementsContractJudgeReviewCampaignTrace({
      ...baseInput({
        mode: 'clean',
        remediationLedgerHash: null,
        repairTransactionManifestHash: null,
        remediationBaselineHash: null,
        remediationJournalHash: null,
        remediationVerificationHash: null,
        publicationReceiptHash: null,
        finalizationByteManifestHash: null,
        finalRejudgeInputHash: null,
        repairUnitReceiptHashes: [],
        deterministicRetryReceiptHashes: [],
      }),
    });

    expect(trace.mode).toBe('clean');
    expect(trace.invocationCounts).toMatchObject({
      reviewerCalls: 1,
      initialFinalJudgeCalls: 1,
      finalRejudgeCalls: 0,
      semanticInvocationCount: 2,
    });
    expect(trace.remediationCounts).toMatchObject({
      repairUnitCount: 0,
      deterministicRetryCount: 0,
      transactionCount: 0,
      publicationCount: 0,
    });
    expect(trace.secondReviewerPath).toBe(false);
    expect(trace.completeReceiptSet).toBe(true);
    expect(
      validateRequirementsContractJudgeReviewCampaignTrace(trace, {
        campaignId: 'goal-campaign-001',
        campaignLineageKey: hash('lineage'),
        initialReviewAttemptKey: hash('initial-attempt'),
        traceHash: trace.traceHash,
      })
    ).toBe(trace);
  });

  it('records remediated semantic count 3 and keeps retries out of semantic counts', () => {
    const trace = compileRequirementsContractJudgeReviewCampaignTrace({
      ...baseInput({ mode: 'remediated' }),
    });

    expect(trace.mode).toBe('remediated');
    expect(trace.invocationCounts).toMatchObject({
      reviewerCalls: 1,
      initialFinalJudgeCalls: 1,
      finalRejudgeCalls: 1,
      semanticInvocationCount: 3,
    });
    expect(trace.remediationCounts).toMatchObject({
      repairUnitCount: 2,
      deterministicRetryCount: 1,
      transactionCount: 1,
      publicationCount: 1,
    });
    expect(trace.secondReviewerPath).toBe(false);
    expect(trace.j06StableOutput.semanticInvocationCount).toBe(3);
  });

  it('fails closed for missing receipts, stale authority, and second Reviewer attempts', () => {
    expect(() =>
      compileRequirementsContractJudgeReviewCampaignTrace({
        ...baseInput({ mode: 'remediated', publicationReceiptHash: null }),
      })
    ).toThrow('judge_review_campaign_trace_receipts_incomplete');

    expect(() =>
      compileRequirementsContractJudgeReviewCampaignTrace({
        ...baseInput({ mode: 'clean', reviewerCalls: 2 }),
      })
    ).toThrow('judge_review_campaign_trace_second_reviewer_forbidden');

    const trace = compileRequirementsContractJudgeReviewCampaignTrace({
      ...baseInput({ mode: 'remediated' }),
    });
    expect(() =>
      validateRequirementsContractJudgeReviewCampaignTrace(trace, {
        campaignId: 'goal-campaign-001',
        campaignLineageKey: hash('lineage'),
        initialReviewAttemptKey: hash('initial-attempt'),
        traceHash: hash('stale'),
      })
    ).toThrow('judge_review_campaign_trace_stale');
  });
});
