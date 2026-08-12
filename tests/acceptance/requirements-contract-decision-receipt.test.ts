import { describe, expect, it } from 'vitest';
import * as interactionResolver from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-interaction-resolver';
import {
  resolveSemanticField,
  sha256Stable,
  validateSemanticResolutionReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import {
  createRequirementsContractDecisionReceipt,
  validateRequirementsContractDecisionReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-grill-session';

type DecisionReceiptRuntime = {
  createInteractionDecisionReceipt: (input: Record<string, unknown>) => Record<string, unknown>;
  validateInteractionDecisionReceipt: (value: unknown) => boolean;
  deriveDecisionDocumentationEffects: (input: Record<string, unknown>) => Record<string, unknown>;
};

const runtime = interactionResolver as unknown as Partial<DecisionReceiptRuntime>;

describe('requirements contract decision receipt', () => {
  it('authorizes a human-confirmed semantic value only from a closed decision receipt proof', () => {
    const decisionReceipt = createRequirementsContractDecisionReceipt({
      authoringRequestId: 'request-human-authority',
      grillSessionId: 'session-human-authority',
      questionId: 'question-retry-limit',
      questionVersion: 'v1',
      affectedFieldIds: ['requirements.checkout.retryLimit'],
      authorityPremiseHashes: [sha256Stable('retry-premise')],
      answerValue: 3,
      answerSchemaHash: sha256Stable('retry-answer-schema'),
      affectedNodeIds: ['NODE-RETRY-LIMIT'],
      userInputProvenance: { authorityOrigin: 'requesting_user' },
    });
    const receiptPath = 'authoring/decisions/sessions/session-human-authority/receipts/' +
      `${decisionReceipt.decisionReceiptId}.json`;
    const candidate = {
      resolutionId: 'resolution-human-authority',
      fieldRef: 'requirements.checkout.retryLimit',
      value: 3,
      semanticKind: 'retry_rule',
      resolutionAuthorityClass: 'human_confirmed',
      premises: [{
        kind: 'decision_receipt',
        decisionReceiptRef: receiptPath,
        decisionReceiptId: decisionReceipt.decisionReceiptId,
        decisionReceiptHash: decisionReceipt.receiptHash,
      }],
      derivationRule: null,
      applicabilityProof: null,
      conflictingCandidates: [],
    };
    const authority = {
      role: 'requirements_decision_receipt',
      receiptSchemaVersion: decisionReceipt.schemaVersion,
      decisionReceiptPath: receiptPath,
      decisionReceiptId: decisionReceipt.decisionReceiptId,
      decisionReceiptHash: decisionReceipt.receiptHash,
      affectedFieldIds: decisionReceipt.affectedFieldIds,
      answerValueHash: sha256Stable(decisionReceipt.answerValue),
    };
    const options = {
      trustedDecisionReceipts: { [receiptPath]: authority },
      trustedInvocationContext: {
        resolverId: 'requirements-resolver',
        resolutionRunId: 'run-human-authority',
        sourceModelBefore: { requirements: { checkout: {} } },
      },
    };

    const result = resolveSemanticField(candidate, options);
    expect(result).toMatchObject({
      status: 'authorized',
      authorityState: 'human_confirmed',
      receipt: {
        resolutionAuthorityClass: 'human_confirmed',
        authorityProof: {
          kind: 'decision_receipt',
          role: 'requirements_decision_receipt',
          decisionReceiptRef: receiptPath,
          decisionReceiptHash: decisionReceipt.receiptHash,
        },
      },
    });
    expect(validateSemanticResolutionReceipt(result.receipt)).toBe(true);
    expect(resolveSemanticField(candidate, {
      ...options,
      trustedDecisionReceipts: { [receiptPath]: { ...authority, role: 'judge_response' } },
    })).toMatchObject({ status: 'unresolved', reasonCode: 'trusted_decision_receipt_mismatch' });
  });

  it('binds stable authority premises and answer bytes without transport time', () => {
    const input = {
      authoringRequestId: 'request-decision-receipt',
      grillSessionId: 'session-decision-receipt',
      questionId: 'question-retry-limit',
      questionVersion: 'v1',
      affectedFieldIds: ['FIELD-RETRY-LIMIT'],
      authorityPremiseHashes: [sha256Stable('premise-b'), sha256Stable('premise-a')],
      answerValue: { retryLimit: 3, modes: ['bounded', 'bounded'] },
      answerSchemaHash: sha256Stable('answer-schema'),
      affectedNodeIds: ['NODE-RETRY-LIMIT'],
      userInputProvenance: { authorityOrigin: 'requesting_user' },
    };
    const first = createRequirementsContractDecisionReceipt(input);
    const replay = createRequirementsContractDecisionReceipt(input);

    expect(first).toEqual(replay);
    expect(first.authorityPremiseHashes).toEqual([...input.authorityPremiseHashes].sort());
    expect(first).not.toHaveProperty('createdAt');
    expect(first).not.toHaveProperty('requestNonce');
    expect(validateRequirementsContractDecisionReceipt(first)).toBe(true);
    expect(validateRequirementsContractDecisionReceipt({
      ...first,
      receiptHash: sha256Stable('forged'),
    })).toBe(false);
  });

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
