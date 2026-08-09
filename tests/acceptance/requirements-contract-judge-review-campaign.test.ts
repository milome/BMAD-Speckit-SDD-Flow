import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractJudgeReviewCampaignController,
  executeJudgeReviewCampaign,
  mergeJudgeReviewCampaign,
  validateRequirementsContractJudgeReviewCampaignController,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign';
import { compileRequirementsContractJudgeReviewCampaignTrace } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign-trace';
import { compileRequirementsContractJudgeReviewCampaignInput } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-review-campaign-input';
import { reduceRequirementsContractFinalAcceptanceState } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-final-acceptance-state-machine';
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
  it('freezes a v2 blind input around closure, candidate, and current evidence bytes', () => {
    const input = compileRequirementsContractJudgeReviewCampaignInput({
      campaignId: 'goal-campaign-v2',
      campaignLineageKey: hash('lineage-v2'),
      closureReceiptHash: hash('closure-v2'),
      candidateBytesHash: hash('candidate-v2'),
      currentImplementationHash: hash('implementation-v2'),
      currentEvidenceHash: hash('evidence-v2'),
      initialReviewAttemptKey: hash('attempt-v2'),
      providerRef: 'gateway-managed-judge',
    } as any);
    expect(input).toMatchObject({
      schemaVersion: 'requirements-contract-judge-review-campaign-input/v2',
      reviewerActorClass: 'bounded_code_reviewer',
      finalJudgeActorClass: 'final_acceptance_judge',
      providerRef: 'gateway-managed-judge',
    });
    expect(input.actorBindingHash).toMatch(/^sha256:/u);
    expect(input).not.toHaveProperty('modelDiversityReceiptHash');
  });

  it('merges Judge outcomes using not_produced, blocked, findings, then clean priority', () => {
    const cases = [
      {
        reviewer: { terminalOutcome: 'clean' },
        finalJudge: { auditDecision: 'not_produced' },
        expected: 'not_produced',
      },
      {
        reviewer: { terminalOutcome: 'blocked' },
        finalJudge: { verdict: 'coverage_satisfied' },
        expected: 'blocked',
      },
      {
        reviewer: { terminalOutcome: 'findings' },
        finalJudge: { verdict: 'coverage_satisfied' },
        expected: 'remediation_required',
      },
      {
        reviewer: { terminalOutcome: 'clean' },
        finalJudge: { verdict: 'coverage_satisfied' },
        expected: 'effective_pass_ready',
      },
    ];
    for (const current of cases) {
      expect(mergeJudgeReviewCampaign(current as any).status).toBe(current.expected);
    }
  });

  it('owns one blind Reviewer and Final Judge wave for any manifest-defined campaign', async () => {
    const campaignInput = compileRequirementsContractJudgeReviewCampaignInput({
      campaignId: 'standalone-goal-partition-campaign',
      campaignLineageKey: hash('standalone-lineage'),
      closureReceiptHash: hash('dynamic-closure'),
      candidateBytesHash: hash('dynamic-candidate'),
      currentImplementationHash: hash('dynamic-implementation'),
      currentEvidenceHash: hash('dynamic-evidence-set'),
      initialReviewAttemptKey: hash('dynamic-closeout-attempt'),
      providerRef: 'gateway-managed-judge',
    } as any);
    let reviewerCalls = 0;
    let finalJudgeCalls = 0;
    const observedBlindInputHashes: string[] = [];

    const result = await executeJudgeReviewCampaign(
      {
        campaignInput,
      },
      {
        invokeReviewer: async (intent) => {
          reviewerCalls += 1;
          observedBlindInputHashes.push(intent.blindInputHash);
          return {
            sourceLedgerHash: hash('reviewer-ledger'),
            terminalOutcome: 'clean',
            findingIds: [],
          };
        },
        invokeFinalJudge: async (intent) => {
          finalJudgeCalls += 1;
          observedBlindInputHashes.push(intent.blindInputHash);
          return {
            sourceLedgerHash: hash('final-judge-ledger'),
            auditDecision: 'pass',
            verdict: 'coverage_satisfied',
            findingIds: [],
          };
        },
      }
    );

    expect(reviewerCalls).toBe(1);
    expect(finalJudgeCalls).toBe(1);
    expect(new Set(observedBlindInputHashes).size).toBe(1);
    if (result.status !== 'effective_pass_ready') throw new Error('expected_effective_pass');
    const expectedState = reduceRequirementsContractFinalAcceptanceState({
      mode: 'clean',
      requiredClosureCount: 1,
      observedClosureCount: 1,
      ledger: {
        campaignId: campaignInput.campaignId,
        closureHashes: [campaignInput.closureReceiptHash],
        reviewerGateHash: result.reviewerReceipt.actorReceiptHash,
        finalJudgeValidationHash: result.finalJudgeReceipt.actorReceiptHash,
        unresolvedIssueHashes: [],
      },
      replayedAttempt: false,
      partialAuthority: false,
    });
    expect(result).toMatchObject({
      status: 'effective_pass_ready',
      aggregate: {
        schemaVersion: 'requirements-contract-parent-goal-blind-review-aggregate/v2',
        candidateBytesHash: campaignInput.candidateBytesHash,
        invocationCountReceipt: {
          reviewerCalls: 1,
          finalJudgeCalls: 1,
          semanticInvocationCount: 2,
        },
      },
      effectivePassReceipt: {
        campaignId: campaignInput.campaignId,
        effectivePass: true,
        authorityStateHash: expectedState.authorityStateHash,
        ledgerHeadHash: expectedState.ledger.ledgerHeadHash,
        requiredClosureCount: 1,
        observedClosureCount: 1,
      },
    });
  });

  it('accepts gateway-managed actor binding without model diversity authority', () => {
    const controller = compileRequirementsContractJudgeReviewCampaignController({
      campaignInputHash: hash('campaign-input-gateway'),
      campaignId: 'goal-campaign-001',
      campaignLineageKey: hash('lineage'),
      initialReviewAttemptKey: hash('initial-attempt'),
      cleanTrace: trace('clean'),
      remediatedTrace: null,
      actorBindingHash: hash('actor-binding'),
      reviewerActorClass: 'bounded_code_reviewer',
      finalJudgeActorClass: 'final_acceptance_judge',
      providerRef: 'gateway-managed-judge',
    } as any);

    expect(controller).toMatchObject({
      schemaVersion: 'requirements-contract-judge-review-campaign-controller/v2',
      actorBindingHash: hash('actor-binding'),
      reviewerInvocationCount: 1,
      secondReviewerPath: false,
    });
    expect(controller.j06Output.schemaVersion).toBe(
      'requirements-contract-judge-review-campaign-j06-output/v2'
    );
  });

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
