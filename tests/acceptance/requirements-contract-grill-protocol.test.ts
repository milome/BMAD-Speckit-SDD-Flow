import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createRequirementsGrillQuestionPacket,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-grill-model';
import {
  createRequirementsGrillResponse,
  createRequirementsGrillSession,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-grill-session';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const ROOT = path.resolve('.');
const schemaPaths = {
  question: path.join(
    ROOT,
    'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-grill-question.schema.json'
  ),
  response: path.join(
    ROOT,
    'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-grill-response.schema.json'
  ),
  session: path.join(
    ROOT,
    'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-grill-session.schema.json'
  ),
  decision: path.join(
    ROOT,
    'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-decision-receipt.schema.json'
  ),
};

function investigationRecords() {
  return ['source', 'repository', 'architecture', 'policy', 'glossary', 'tests'].map((kind) => ({
    kind,
    ref: `${kind}-investigation`,
    hash: sha256Stable(`${kind}-investigation`),
    finding: `${kind} does not authorize a deterministic answer`,
    resolution: 'unresolved' as const,
  }));
}

function question() {
  return createRequirementsGrillQuestionPacket({
    questionId: 'question-retry-limit',
    fieldRef: 'requirements.checkout.retryLimit',
    issueCode: 'business_decision_required',
    sourceEvidence: [{
      path: 'docs/requirements/checkout.md',
      hash: sha256Stable('checkout-source'),
      excerptHash: sha256Stable('retry excerpt'),
    }],
    investigations: investigationRecords(),
    dependencies: [],
    affectedRequirementRefs: ['REQ-CHECKOUT'],
    affectedArtifactRefs: {
      semanticIr: ['semantic-ir.json#/requirements/checkout'],
      render: ['confirmation.html#retry-limit'],
      oracle: ['oracle-registry.json#retry-limit'],
      red: ['red-contracts.json#retry-limit'],
      packet: ['model_packet.json#retry-limit'],
      evidence: ['evidence-requirements.json#retry-limit'],
    },
    options: [
      {
        optionId: 'retry-3',
        value: 3,
        provenanceRefs: ['source:checkout-retry'],
        behaviorImpact: 'Retry failed checkout operations three times.',
        deliveryImpact: 'Requires retry orchestration and bounded failure tests.',
      },
      {
        optionId: 'retry-5',
        value: 5,
        provenanceRefs: ['policy:resilience-default'],
        behaviorImpact: 'Retry failed checkout operations five times.',
        deliveryImpact: 'Increases latency and retry load.',
      },
    ],
    recommendation: {
      optionId: 'retry-3',
      rationale: 'Lower latency while preserving bounded recovery.',
    },
  });
}

describe('requirements contract Grill protocol', () => {
  it('publishes schema-valid question, response, session, and decision protocols', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validators = Object.fromEntries(
      Object.entries(schemaPaths).map(([key, schemaPath]) => [
        key,
        ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')) as object),
      ])
    );
    const packet = question();
    const session = createRequirementsGrillSession({
      sessionId: 'grill-session-checkout',
      requirementSetId: 'requirements-checkout',
      semanticModelHash: sha256Stable({ requirements: { checkout: {} } }),
      createdAt: '2026-07-18T04:00:00.000Z',
      questions: [packet],
    });
    const response = createRequirementsGrillResponse({
      responseId: 'response-retry-limit',
      questionId: packet.questionId,
      questionHash: packet.questionHash,
      decision: 'select_option',
      optionId: 'retry-3',
      respondedAt: '2026-07-18T04:01:00.000Z',
    });

    expect(validators.question(packet), validators.question.errors?.map(String).join('\n')).toBe(true);
    expect(validators.response(response), validators.response.errors?.map(String).join('\n')).toBe(true);
    expect(validators.session(session), validators.session.errors?.map(String).join('\n')).toBe(true);
    expect(validators.decision.schema.$id).toContain('requirements-decision-receipt');
  });

  it('publishes the Grill Skill consistently across root, Codex, and package surfaces', () => {
    const surfaces = [
      '_bmad/skills/requirements-contract-grill/SKILL.md',
      '.codex/skills/requirements-contract-grill/SKILL.md',
      'packages/bmad-speckit/_bmad/skills/requirements-contract-grill/SKILL.md',
    ].map((relativePath) =>
      readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/\r\n?/gu, '\n')
    );

    expect(new Set(surfaces).size).toBe(1);
    expect(surfaces[0]).toContain('requirements-contract-grill');
    expect(surfaces[0]).toContain('exactly one active question');
    expect(surfaces[0]).toContain('human_confirmed');
    expect(surfaces[0]).toContain('never automatically selected');

    for (const setupPath of [
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/setup.ps1',
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/setup.sh',
    ]) {
      expect(readFileSync(path.join(ROOT, setupPath), 'utf8')).toContain(
        'requirements-contract-grill'
      );
    }
  });
});
