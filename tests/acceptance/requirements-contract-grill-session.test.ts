import { describe, expect, it } from 'vitest';
import {
  createRequirementsGrillQuestionPacket,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-grill-model';
import {
  createRequirementsGrillResponse,
  createRequirementsGrillSession,
  submitRequirementsGrillResponse,
  validateRequirementsGrillSession,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-grill-session';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const semanticModelBefore = { requirements: { checkout: {} } };

function investigations(namespace: string) {
  return ['source', 'repository', 'architecture', 'policy', 'glossary', 'tests'].map((kind) => ({
    kind,
    ref: `${namespace}-${kind}`,
    hash: sha256Stable(`${namespace}-${kind}`),
    finding: `${kind} evidence leaves the decision unresolved`,
    resolution: 'unresolved' as const,
  }));
}

function question(
  questionId: string,
  fieldRef: string,
  dependencies: string[] = []
) {
  return createRequirementsGrillQuestionPacket({
    questionId,
    fieldRef,
    issueCode: 'business_decision_required',
    sourceEvidence: [{
      path: 'docs/requirements/checkout.md',
      hash: sha256Stable('checkout-source'),
      excerptHash: sha256Stable(questionId),
    }],
    investigations: investigations(questionId),
    dependencies,
    affectedRequirementRefs: ['REQ-CHECKOUT'],
    affectedArtifactRefs: {
      semanticIr: [`semantic-ir.json#/${questionId}`],
      render: [`confirmation.html#${questionId}`],
      oracle: [`oracle-registry.json#${questionId}`],
      red: [`red-contracts.json#${questionId}`],
      packet: [`model_packet.json#${questionId}`],
      evidence: [`evidence-requirements.json#${questionId}`],
    },
    options: [
      {
        optionId: `${questionId}-primary`,
        value: questionId === 'question-retry' ? 3 : 30,
        provenanceRefs: [`source:${questionId}`],
        behaviorImpact: `Apply ${questionId} primary behavior.`,
        deliveryImpact: `Implement and test ${questionId}.`,
      },
      {
        optionId: `${questionId}-secondary`,
        value: questionId === 'question-retry' ? 5 : 60,
        provenanceRefs: [`policy:${questionId}`],
        behaviorImpact: `Apply ${questionId} secondary behavior.`,
        deliveryImpact: `Implement and test alternate ${questionId}.`,
      },
    ],
    recommendation: {
      optionId: `${questionId}-primary`,
      rationale: 'Preferred but never automatically selected.',
    },
  });
}

function session() {
  const retry = question('question-retry', 'requirements.checkout.retryLimit');
  const timeout = question(
    'question-timeout',
    'requirements.checkout.timeoutSeconds',
    [retry.questionId]
  );
  return createRequirementsGrillSession({
    sessionId: 'grill-session-dependency-order',
    requirementSetId: 'requirements-checkout',
    semanticModelHash: sha256Stable(semanticModelBefore),
    createdAt: '2026-07-18T04:10:00.000Z',
    questions: [timeout, retry],
  });
}

describe('requirements contract Grill session', () => {
  it('investigates first and exposes exactly one dependency-ordered active question', () => {
    const current = session();

    expect(current.orderedQuestionIds).toEqual(['question-retry', 'question-timeout']);
    expect(current.activeQuestionId).toBe('question-retry');
    expect(current.activeQuestionCount).toBe(1);
    expect(current.questions[0].recommendation.selected).toBe(false);
    expect(new Set(current.questions[0].investigations.map((row) => row.kind))).toEqual(
      new Set(['source', 'repository', 'architecture', 'policy', 'glossary', 'tests'])
    );
    expect(validateRequirementsGrillSession(current)).toBe(true);
  });

  it('creates one human-confirmed receipt only for an explicit schema-valid selection', () => {
    const current = session();
    const active = current.questions.find((row) => row.questionId === current.activeQuestionId)!;
    const response = createRequirementsGrillResponse({
      responseId: 'response-question-retry',
      questionId: active.questionId,
      questionHash: active.questionHash,
      decision: 'select_option',
      optionId: 'question-retry-primary',
      respondedAt: '2026-07-18T04:11:00.000Z',
    });
    const result = submitRequirementsGrillResponse({
      session: current,
      response,
      semanticModelBefore,
      receiptRef: 'authoring/decisions/question-retry.json',
      confirmedAt: '2026-07-18T04:11:01.000Z',
    });

    expect(result.decisionReceipt?.authorityState).toBe('human_confirmed');
    expect(result.decisionReceipt?.selection).toEqual({
      kind: 'option',
      optionId: 'question-retry-primary',
    });
    expect(result.decisionReceipt?.invalidatedArtifactRefs).toEqual([
      'semantic-ir.json#/question-retry',
      'confirmation.html#question-retry',
      'oracle-registry.json#question-retry',
      'red-contracts.json#question-retry',
      'model_packet.json#question-retry',
      'evidence-requirements.json#question-retry',
    ]);
    expect(result.session.activeQuestionId).toBe('question-timeout');
    expect(result.session.activeQuestionCount).toBe(1);
    expect(validateRequirementsGrillSession(result.session)).toBe(true);
  });

  it('keeps rejected and deferred responses unresolved and emits no decision receipt', () => {
    for (const decision of ['reject', 'defer'] as const) {
      const current = session();
      const active = current.questions.find((row) => row.questionId === current.activeQuestionId)!;
      const result = submitRequirementsGrillResponse({
        session: current,
        response: createRequirementsGrillResponse({
          responseId: `response-${decision}`,
          questionId: active.questionId,
          questionHash: active.questionHash,
          decision,
          reason: `${decision} pending further user authority`,
          respondedAt: '2026-07-18T04:12:00.000Z',
        }),
        semanticModelBefore,
        receiptRef: `authoring/decisions/${decision}.json`,
        confirmedAt: '2026-07-18T04:12:01.000Z',
      });

      expect(result.decisionReceipt).toBeNull();
      expect(result.session.questionStates[active.questionId].status).toBe('unresolved');
      expect(result.session.activeQuestionCount).toBe(0);
      expect(result.session.resumeState).toBe('paused');
    }
  });
});
