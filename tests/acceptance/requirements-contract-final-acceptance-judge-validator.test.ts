import { describe, expect, it } from 'vitest';
import {
  validateRequirementsContractFinalAcceptanceJudgeInvocation,
  validateRequirementsContractFinalAcceptanceJudgeValidationReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-final-acceptance-judge-validator';
import { compileRequirementsContractFinalRejudgeInput } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-final-rejudge-input';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

describe('requirements contract final acceptance judge validator', () => {
  it('invokes exactly one current-byte Final Judge for remediated sealed bytes', () => {
    const rejudgeInput = compileRequirementsContractFinalRejudgeInput({
      campaignId: 'goal-campaign-001',
      postRemediationAttemptKey: hash('attempt'),
      remediationApplied: true,
      sealedByteHashes: [hash('file-b'), hash('file-a')],
    });
    const receipt = validateRequirementsContractFinalAcceptanceJudgeInvocation({
      rejudgeInput,
      mutableCandidateBytes: false,
      finalJudgeInvocations: [
        {
          rejudgeInputHash: rejudgeInput.rejudgeInputHash,
          sealedByteHashes: rejudgeInput.sealedByteHashes,
        },
      ],
    });

    expect(receipt.invocationCount).toBe(1);
    expect(
      validateRequirementsContractFinalAcceptanceJudgeValidationReceipt(receipt, {
        rejudgeInputHash: rejudgeInput.rejudgeInputHash,
        validationReceiptHash: receipt.validationReceiptHash,
      })
    ).toBe(receipt);
  });

  it('fails closed for stale, mutable, missing, and repeated rejudge attempts', () => {
    const rejudgeInput = compileRequirementsContractFinalRejudgeInput({
      campaignId: 'goal-campaign-001',
      postRemediationAttemptKey: hash('attempt'),
      remediationApplied: true,
      sealedByteHashes: [hash('file-a')],
    });

    expect(() =>
      validateRequirementsContractFinalAcceptanceJudgeInvocation({
        rejudgeInput,
        mutableCandidateBytes: true,
        finalJudgeInvocations: [
          { rejudgeInputHash: rejudgeInput.rejudgeInputHash, sealedByteHashes: [hash('file-a')] },
        ],
      })
    ).toThrow('final_judge_invocation_mutable_bytes');

    expect(() =>
      validateRequirementsContractFinalAcceptanceJudgeInvocation({
        rejudgeInput,
        mutableCandidateBytes: false,
        finalJudgeInvocations: [],
      })
    ).toThrow('final_judge_invocation_missing');

    expect(() =>
      validateRequirementsContractFinalAcceptanceJudgeInvocation({
        rejudgeInput,
        mutableCandidateBytes: false,
        finalJudgeInvocations: [
          { rejudgeInputHash: rejudgeInput.rejudgeInputHash, sealedByteHashes: [hash('file-a')] },
          { rejudgeInputHash: rejudgeInput.rejudgeInputHash, sealedByteHashes: [hash('file-a')] },
        ],
      })
    ).toThrow('final_judge_invocation_repeated');

    expect(() =>
      validateRequirementsContractFinalAcceptanceJudgeInvocation({
        rejudgeInput,
        mutableCandidateBytes: false,
        finalJudgeInvocations: [
          { rejudgeInputHash: hash('stale'), sealedByteHashes: [hash('file-a')] },
        ],
      })
    ).toThrow('final_judge_invocation_stale');
  });
});
