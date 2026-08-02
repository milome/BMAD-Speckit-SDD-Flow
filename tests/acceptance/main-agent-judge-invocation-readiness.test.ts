import { describe, expect, it } from 'vitest';
import { validateRequirementsContractFinalAcceptanceJudgeInvocation } from '../..//packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-final-acceptance-judge-validator';
import { compileRequirementsContractFinalRejudgeInput } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-final-rejudge-input';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

describe('main agent judge invocation readiness', () => {
  it('does not invoke Final Judge on a clean path without remediation', () => {
    const rejudgeInput = compileRequirementsContractFinalRejudgeInput({
      campaignId: 'goal-campaign-001',
      postRemediationAttemptKey: hash('attempt'),
      remediationApplied: false,
      sealedByteHashes: [],
    });

    const receipt = validateRequirementsContractFinalAcceptanceJudgeInvocation({
      rejudgeInput,
      mutableCandidateBytes: false,
      finalJudgeInvocations: [],
    });

    expect(rejudgeInput.finalJudgeInvocationRequired).toBe(false);
    expect(receipt.invocationCount).toBe(0);
  });

  it('requires current sealed bytes when remediation happened', () => {
    const rejudgeInput = compileRequirementsContractFinalRejudgeInput({
      campaignId: 'goal-campaign-001',
      postRemediationAttemptKey: hash('attempt'),
      remediationApplied: true,
      sealedByteHashes: [hash('sealed-current')],
    });

    expect(() =>
      validateRequirementsContractFinalAcceptanceJudgeInvocation({
        rejudgeInput,
        mutableCandidateBytes: false,
        finalJudgeInvocations: [
          {
            rejudgeInputHash: rejudgeInput.rejudgeInputHash,
            sealedByteHashes: [hash('sealed-stale')],
          },
        ],
      })
    ).toThrow('final_judge_invocation_stale');
  });
});
