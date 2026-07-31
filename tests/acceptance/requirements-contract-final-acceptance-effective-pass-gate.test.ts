import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  evaluateMainAgentFinalAcceptanceEffectivePass,
  validateMainAgentFinalAcceptanceEffectivePassReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-audit-review-gate';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function state(overrides = {}) {
  return {
    mode: 'remediated',
    requiredClosureCount: 3,
    observedClosureCount: 3,
    ledger: {
      campaignId: 'goal-campaign-001',
      closureHashes: [hash('closure-a'), hash('closure-b'), hash('closure-c')],
      reviewerGateHash: hash('reviewer-gate'),
      finalJudgeValidationHash: hash('final-judge'),
      unresolvedIssueHashes: [],
    },
    replayedAttempt: false,
    partialAuthority: false,
    ...overrides,
  };
}

describe('requirements contract final acceptance effective pass gate', () => {
  it('emits mechanical EffectivePass only for complete current authority', () => {
    const receipt = evaluateMainAgentFinalAcceptanceEffectivePass({
      state: state(),
      kernelOrJudgeSubstitution: false,
    });
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-final-acceptance-effective-pass-receipt.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(validate(receipt), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(receipt.effectivePass).toBe(true);
    expect(receipt.kernelOrJudgeSubstitution).toBe(false);
    expect(
      validateMainAgentFinalAcceptanceEffectivePassReceipt(receipt, {
        campaignId: 'goal-campaign-001',
        authorityStateHash: receipt.authorityStateHash,
        effectivePassReceiptHash: receipt.effectivePassReceiptHash,
      })
    ).toBe(receipt);
  });

  it('fails closed for Kernel or Judge substitution and stale receipts', () => {
    expect(() =>
      evaluateMainAgentFinalAcceptanceEffectivePass({
        state: state(),
        kernelOrJudgeSubstitution: true,
      })
    ).toThrow('final_acceptance_effective_pass_substitution');

    const receipt = evaluateMainAgentFinalAcceptanceEffectivePass({
      state: state(),
      kernelOrJudgeSubstitution: false,
    });

    expect(() =>
      validateMainAgentFinalAcceptanceEffectivePassReceipt(receipt, {
        campaignId: 'goal-campaign-001',
        authorityStateHash: hash('stale'),
        effectivePassReceiptHash: receipt.effectivePassReceiptHash,
      })
    ).toThrow('final_acceptance_effective_pass_stale');
  });
});
