import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsContractParentGoalBlindReviewAggregate,
  validateRequirementsContractParentGoalBlindReviewAggregate,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-parent-goal-blind-review';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function campaignInput() {
  return {
    schemaVersion: 'requirements-contract-judge-review-campaign-input/v1',
    campaignId: 'goal-campaign-001',
    campaignLineageKey: hash('lineage'),
    scopeManifestHash: hash('scope'),
    portfolioHash: hash('portfolio'),
    modelDiversityReceiptHash: hash('diversity'),
    initialReviewAttemptKey: hash('attempt-1'),
    reviewerActorClass: 'bounded_code_reviewer' as const,
    finalJudgeActorClass: 'final_acceptance_judge' as const,
    inputHash: hash('campaign-input'),
  };
}

function blindInput(overrides = {}) {
  const input = campaignInput();
  return {
    campaignId: input.campaignId,
    campaignLineageKey: input.campaignLineageKey,
    scopeManifestHash: input.scopeManifestHash,
    portfolioHash: input.portfolioHash,
    modelDiversityReceiptHash: input.modelDiversityReceiptHash,
    initialReviewAttemptKey: input.initialReviewAttemptKey,
    frozenScopeBytesHash: hash('scope-bytes'),
    frozenEvidenceHash: hash('evidence-bytes'),
    governedPathSetHash: hash('governed-paths'),
    ...overrides,
  };
}

function intent(
  actorClass: 'bounded_code_reviewer' | 'final_acceptance_judge',
  overrides: { blindInput?: ReturnType<typeof blindInput> } = {}
) {
  const actorBlindInput = overrides.blindInput ?? blindInput();
  const payload = {
    actorClass,
    dispatchMode: 'parallel',
    invocationMode: 'native',
    dispatchGroupId: 'blind-wave-001',
    preparedBeforeDispatch: true,
    modelRef: actorClass === 'bounded_code_reviewer' ? 'reviewer-model-a' : 'final-model-b',
    modelRevisionHash:
      actorClass === 'bounded_code_reviewer' ? hash('reviewer-rev') : hash('final-rev'),
    blindInput: actorBlindInput,
  };
  return {
    ...payload,
    blindInputHash: sha256Stable(actorBlindInput),
    invocationIntentHash: sha256Stable(payload),
  };
}

function receipt(actorClass: 'bounded_code_reviewer' | 'final_acceptance_judge', overrides = {}) {
  const actorIntent = intent(actorClass);
  const payload = {
    actorClass,
    dispatchGroupId: actorIntent.dispatchGroupId,
    invocationMode: 'native',
    startedAfterBothIntentsPrepared: true,
    modelRef: actorIntent.modelRef,
    modelRevisionHash: actorIntent.modelRevisionHash,
    blindInputHash: actorIntent.blindInputHash,
    invocationIntentHash: actorIntent.invocationIntentHash,
    sourceLedgerHash: hash(`${actorClass}:source-ledger`),
    terminalOutcome: actorClass === 'bounded_code_reviewer' ? 'findings' : 'clean',
    findingIds: actorClass === 'bounded_code_reviewer' ? ['R-001'] : [],
    ...overrides,
  };
  return {
    ...payload,
    actorReceiptHash: sha256Stable(payload),
  };
}

function validInput(overrides = {}) {
  return {
    campaignInput: campaignInput(),
    preparedIntents: [intent('final_acceptance_judge'), intent('bounded_code_reviewer')],
    actorReceipts: [receipt('bounded_code_reviewer'), receipt('final_acceptance_judge')],
    ...overrides,
  };
}

describe('requirements contract parent goal blind review', () => {
  it('compiles v2 actor authority without requiring model identity or diversity receipts', () => {
    const v2BlindInput = {
      campaignId: 'goal-campaign-v2',
      campaignLineageKey: hash('lineage-v2'),
      closureReceiptHash: hash('closure-v2'),
      candidateBytesHash: hash('candidate-v2'),
      currentImplementationHash: hash('implementation-v2'),
      currentEvidenceHash: hash('evidence-v2'),
      initialReviewAttemptKey: hash('attempt-v2'),
    };
    const actorBindingHash = sha256Stable({
      reviewerActorClass: 'bounded_code_reviewer',
      finalJudgeActorClass: 'final_acceptance_judge',
      providerRef: 'gateway-managed-judge',
    });
    const makeIntent = (actorClass: 'bounded_code_reviewer' | 'final_acceptance_judge') => {
      const payload = {
        actorClass,
        dispatchMode: 'parallel',
        invocationMode: 'native',
        dispatchGroupId: 'blind-wave-v2',
        preparedBeforeDispatch: true,
        blindInput: v2BlindInput,
      };
      return {
        ...payload,
        blindInputHash: sha256Stable(v2BlindInput),
        invocationIntentHash: sha256Stable(payload),
      };
    };
    const intents = [makeIntent('bounded_code_reviewer'), makeIntent('final_acceptance_judge')];
    const receipts = intents.map((actorIntent) => {
      const payload = {
        actorClass: actorIntent.actorClass,
        dispatchGroupId: actorIntent.dispatchGroupId,
        invocationMode: 'native',
        startedAfterBothIntentsPrepared: true,
        blindInputHash: actorIntent.blindInputHash,
        invocationIntentHash: actorIntent.invocationIntentHash,
        sourceLedgerHash: hash(`${actorIntent.actorClass}:v2-ledger`),
        terminalOutcome: 'clean',
        findingIds: [],
      };
      return { ...payload, actorReceiptHash: sha256Stable(payload) };
    });
    const aggregate = compileRequirementsContractParentGoalBlindReviewAggregate({
      campaignInput: {
        schemaVersion: 'requirements-contract-judge-review-campaign-input/v2',
        ...v2BlindInput,
        actorBindingHash,
        reviewerActorClass: 'bounded_code_reviewer',
        finalJudgeActorClass: 'final_acceptance_judge',
        providerRef: 'gateway-managed-judge',
        inputHash: hash('campaign-input-v2'),
      },
      preparedIntents: intents,
      actorReceipts: receipts,
    } as any);

    expect(aggregate).toMatchObject({
      schemaVersion: 'requirements-contract-parent-goal-blind-review-aggregate/v2',
      actorBindingHash,
      invocationCountReceipt: { reviewerCalls: 1, finalJudgeCalls: 1 },
    });
    expect(aggregate).not.toHaveProperty('modelDiversityReceiptHash');
  });

  it('compiles deterministic blind aggregate from exactly one reviewer and one final judge call', () => {
    const aggregate = compileRequirementsContractParentGoalBlindReviewAggregate(validInput());
    const reversed = compileRequirementsContractParentGoalBlindReviewAggregate({
      ...validInput(),
      preparedIntents: [...validInput().preparedIntents].reverse(),
      actorReceipts: [...validInput().actorReceipts].reverse(),
    });
    const schema = JSON.parse(
      readFileSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-blind-review-aggregate-receipt.schema.json'
        ),
        'utf8'
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

    expect(reversed).toEqual(aggregate);
    expect(aggregate.invocationCountReceipt).toEqual({
      reviewerCalls: 1,
      finalJudgeCalls: 1,
      semanticInvocationCount: 2,
    });
    expect(aggregate.blindnessProof.identicalBlindInputHash).toMatch(/^sha256:/u);
    expect(aggregate.blindnessProof.peerLeakageDetected).toBe(false);
    expect(aggregate.actorReceipts.map((item) => item.actorClass)).toEqual([
      'bounded_code_reviewer',
      'final_acceptance_judge',
    ]);
    expect(validate(aggregate), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(
      validateRequirementsContractParentGoalBlindReviewAggregate(aggregate, {
        campaignId: aggregate.campaignId,
        campaignLineageKey: aggregate.campaignLineageKey,
        initialReviewAttemptKey: aggregate.initialReviewAttemptKey,
        aggregateHash: aggregate.aggregateHash,
      })
    ).toBe(aggregate);
  });

  it.each([
    [
      'second reviewer call',
      {
        actorReceipts: [
          receipt('bounded_code_reviewer'),
          receipt('bounded_code_reviewer'),
          receipt('final_acceptance_judge'),
        ],
      },
      'blind_review_actor_count_invalid',
    ],
    [
      'non blind peer leakage',
      {
        preparedIntents: [
          intent('bounded_code_reviewer'),
          intent('final_acceptance_judge'),
          { ...intent('final_acceptance_judge'), blindInput: blindInput({ peerResponse: 'leak' }) },
        ],
      },
      'blind_review_peer_leakage_forbidden',
    ],
    [
      'scope mismatch',
      {
        preparedIntents: [
          intent('bounded_code_reviewer', {
            blindInput: blindInput({ scopeManifestHash: hash('other-scope') }),
          }),
          intent('final_acceptance_judge'),
        ],
      },
      'blind_review_scope_mismatch',
    ],
    [
      'byte mismatch',
      {
        preparedIntents: [
          intent('bounded_code_reviewer', {
            blindInput: blindInput({ frozenScopeBytesHash: hash('other-bytes') }),
          }),
          intent('final_acceptance_judge'),
        ],
      },
      'blind_review_byte_mismatch',
    ],
    [
      'model mismatch',
      {
        actorReceipts: [
          receipt('bounded_code_reviewer', { modelRef: 'unexpected-model' }),
          receipt('final_acceptance_judge'),
        ],
      },
      'blind_review_model_mismatch',
    ],
    [
      'unknown terminal outcome',
      {
        actorReceipts: [
          receipt('bounded_code_reviewer', { terminalOutcome: 'maybe' }),
          receipt('final_acceptance_judge'),
        ],
      },
      'blind_review_terminal_outcome_invalid',
    ],
  ])('fails closed for %s', (_name, patch, code) => {
    expect(() =>
      compileRequirementsContractParentGoalBlindReviewAggregate({
        ...validInput(),
        ...patch,
      })
    ).toThrow(code);
  });

  it('rejects aggregate receipt tampering', () => {
    const aggregate = compileRequirementsContractParentGoalBlindReviewAggregate(validInput());

    expect(() =>
      validateRequirementsContractParentGoalBlindReviewAggregate(
        {
          ...aggregate,
          invocationCountReceipt: { ...aggregate.invocationCountReceipt, reviewerCalls: 2 },
        },
        {
          campaignId: aggregate.campaignId,
          campaignLineageKey: aggregate.campaignLineageKey,
          initialReviewAttemptKey: aggregate.initialReviewAttemptKey,
          aggregateHash: aggregate.aggregateHash,
        }
      )
    ).toThrow('blind_review_aggregate_hash_mismatch');
  });
});
