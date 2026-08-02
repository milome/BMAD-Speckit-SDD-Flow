import { describe, expect, it } from 'vitest';
import * as interactionResolver from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-interaction-resolver';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

type DecisionReceiptRuntime = {
  createInteractionDecisionReceipt: (input: Record<string, unknown>) => Record<string, unknown>;
  validateInteractionDecisionReceipt: (value: unknown) => boolean;
  deriveDecisionDocumentationEffects: (input: Record<string, unknown>) => Record<string, unknown>;
};

const runtime = interactionResolver as unknown as Partial<DecisionReceiptRuntime>;

describe('requirements contract decision receipt', () => {
  it('creates and validates immutable human-confirmed receipts with exact invalidation refs', () => {
    expect(typeof runtime.createInteractionDecisionReceipt).toBe('function');
    expect(typeof runtime.validateInteractionDecisionReceipt).toBe('function');
    const create = runtime.createInteractionDecisionReceipt!;
    const validate = runtime.validateInteractionDecisionReceipt!;
    const before = { requirements: { checkout: {} } };
    const after = { requirements: { checkout: { retryLimit: 3 } } };
    const receipt = create({
      receiptRef: 'authoring/decisions/retry-limit.json',
      questionId: 'question-retry-limit',
      questionHash: sha256Stable('question-retry-limit'),
      responseId: 'response-retry-limit',
      responseHash: sha256Stable('response-retry-limit'),
      selection: { kind: 'option', optionId: 'retry-3' },
      fieldRef: 'requirements.checkout.retryLimit',
      value: 3,
      sequenceModelBefore: before,
      sequenceModelAfter: after,
      affectedRequirementRefs: ['REQ-CHECKOUT'],
      invalidatedArtifactRefs: [
        'semantic-ir.json#/retry-limit',
        'confirmation.html#retry-limit',
        'oracle-registry.json#retry-limit',
        'red-contracts.json#retry-limit',
        'model_packet.json#retry-limit',
        'evidence-requirements.json#retry-limit',
      ],
      confirmedAt: '2026-07-18T04:20:00.000Z',
    });

    expect(receipt.authorityState).toBe('human_confirmed');
    expect(validate(receipt)).toBe(true);
    expect(validate({ ...receipt, receiptHash: sha256Stable('forged') })).toBe(false);
    expect(validate({ ...receipt, conversationAuthority: true })).toBe(false);
  });

  it('allows glossary and ADR side effects only within DSA-08 boundaries', () => {
    expect(typeof runtime.deriveDecisionDocumentationEffects).toBe('function');
    const derive = runtime.deriveDecisionDocumentationEffects!;
    const receiptRef = 'authoring/decisions/retry-limit.json';
    const effects = derive({
      receiptRef,
      domainVocabulary: [{
        term: 'bounded retry',
        definition: 'A retry policy with an explicit maximum attempt count.',
      }],
      adrCriteria: {
        hardToReverse: true,
        surprising: true,
        realTradeoff: true,
      },
    });

    expect(effects).toMatchObject({
      authorityReceiptRef: receiptRef,
      contextUpdate: {
        applicability: 'domain_vocabulary_only',
      },
      adr: {
        applicability: 'required',
      },
      conversationAuthority: false,
    });
    expect(JSON.stringify(effects)).not.toContain('implementationDetails');
    expect(derive({
      receiptRef,
      domainVocabulary: [],
      adrCriteria: {
        hardToReverse: true,
        surprising: false,
        realTradeoff: true,
      },
    })).toMatchObject({
      adr: { applicability: 'not_applicable' },
      conversationAuthority: false,
    });
  });
});
