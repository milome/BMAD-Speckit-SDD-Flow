import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateGrillCases,
  type GrillEvaluationCase,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';
import { createRequirementsGrillQuestionPacket } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-grill-model';
import {
  createRequirementsGrillResponse,
  createRequirementsGrillSession,
  submitRequirementsGrillResponse,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-grill-session';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function exerciseGrill(decision: 'select_option' | 'reject'): GrillEvaluationCase {
  const identity = randomUUID();
  const questionId = `question-${identity}`;
  const optionId = `option-${identity}`;
  const alternativeOptionId = `option-alternative-${identity}`;
  const semanticModelBefore = { requirements: { [identity]: {} } };
  const question = createRequirementsGrillQuestionPacket({
    questionId,
    fieldRef: `requirements.${identity}.semantics.timeout`,
    issueCode: 'business_decision_required',
    sourceEvidence: [
      {
        path: `docs/requirements/${identity}.md`,
        hash: sha256Stable({ identity, kind: 'source' }),
        excerptHash: sha256Stable({ identity, kind: 'excerpt' }),
      },
    ],
    investigations: ['source', 'repository', 'architecture', 'policy', 'glossary', 'tests'].map(
      (kind) => ({
        kind,
        ref: `${identity}-${kind}`,
        hash: sha256Stable({ identity, kind }),
        finding: `${kind} evidence leaves the decision unresolved`,
        resolution: 'unresolved' as const,
      })
    ),
    dependencies: [],
    affectedRequirementRefs: [`requirement-${identity}`],
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
        optionId,
        value: 30,
        provenanceRefs: [`source:${identity}`],
        behaviorImpact: 'Apply the explicitly selected timeout.',
        deliveryImpact: 'Implement and test the selected timeout.',
      },
      {
        optionId: alternativeOptionId,
        value: 60,
        provenanceRefs: [`policy:${identity}`],
        behaviorImpact: 'Apply the alternate timeout.',
        deliveryImpact: 'Implement and test the alternate timeout.',
      },
    ],
    recommendation: {
      optionId,
      rationale: 'Recommendation remains non-authoritative until selected.',
    },
  });
  const createdAt = new Date();
  const respondedAt = new Date(createdAt.getTime() + 1);
  const confirmedAt = new Date(createdAt.getTime() + 2);
  const session = createRequirementsGrillSession({
    sessionId: `session-${identity}`,
    requirementSetId: `requirements-${identity}`,
    semanticModelHash: sha256Stable(semanticModelBefore),
    createdAt: createdAt.toISOString(),
    questions: [question],
  });
  const result = submitRequirementsGrillResponse({
    session,
    response: createRequirementsGrillResponse({
      responseId: `response-${identity}`,
      questionId,
      questionHash: question.questionHash,
      decision,
      ...(decision === 'select_option'
        ? { optionId }
        : { reason: 'Explicit authority remains unresolved.' }),
      respondedAt: respondedAt.toISOString(),
    }),
    semanticModelBefore,
    receiptRef: `authoring/decisions/${identity}.json`,
    confirmedAt: confirmedAt.toISOString(),
  });
  return {
    caseRef: questionId,
    unresolvedCandidate: true,
    requiresHumanDecision: true,
    explicitSelection: decision === 'select_option',
    decisionReceiptIssued: result.decisionReceipt !== null,
    decisionChanged: false,
  };
}

describe('requirements contract Grill evaluation', () => {
  it('measures explicit human escalation through the production Grill session', () => {
    const cases = [exerciseGrill('select_option'), exerciseGrill('reject')];

    const result = evaluateGrillCases(cases);

    expect(result.caseCount).toBe(cases.length);
    expect(result.humanEscalationRate).toBe(1);
    expect(result.decisionReworkRate).toBe(0);
    expect(result.invalidDecisionReceiptCount).toBe(0);
    expect(result.decision).toBe('pass');
  });

  it('blocks a decision receipt that lacks an explicit human selection', () => {
    const fabricated: GrillEvaluationCase = {
      ...exerciseGrill('reject'),
      decisionReceiptIssued: true,
    };

    const result = evaluateGrillCases([fabricated]);

    expect(result.invalidDecisionReceiptCount).toBe(1);
    expect(result.decision).toBe('block');
  });
});
