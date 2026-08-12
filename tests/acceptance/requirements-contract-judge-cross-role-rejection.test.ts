import { describe, expect, it } from 'vitest';
import { createRequirementsContractAuthorityCounters } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-audit-actor-class';
import {
  validateRequirementsJudgeRequest,
  validateRequirementsJudgeResponse,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-cross-role-guard';
import { buildRequirementsContractJudgeRequest } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-request-identity';

const hash = (character: string) => `sha256:${character.repeat(64)}`;

function request() {
  return buildRequirementsContractJudgeRequest({
    authority: {
      activeSemanticRevisionId: 'semantic-1',
      activeScopeSemanticHash: hash('1'),
    },
    providerSelection: {
      schemaVersion: 'requirements-contract-judge-selection-receipt/v1',
      decision: 'selected',
      providerRef: 'provider-1',
      transport: 'openai-compatible',
      apiStyle: 'chat-completions',
      model: 'model-1',
      adapterRef: 'OpenAICompatibleJudgeAdapter',
      providerRegistryHash: hash('2'),
      providerConfigurationHash: hash('3'),
      declaredCapacity: null,
      issueCodes: [],
      providerSelectionHash: hash('4'),
    },
    prompt: {
      systemPrompt: 'Configured Requirements Judge prompt.',
      rubric: { mandatoryDimensionIds: ['semantic-completeness'] },
      structuredOutputSchema: { type: 'object' },
      outputTokenReserve: 4096,
    },
    auditPacket: { body: { requirementIds: ['MUST-1'] } },
    auditPacketArtifactManifest: [{ artifactId: 'requirements-ir' }],
    remediation: null,
  });
}

function response() {
  return {
    schemaVersion: 'requirements-contract-judge-response/v2',
    judgeRequestHash: request().judgeRequestHash,
    verdict: 'pass',
    findings: [],
    advisoryObservations: [],
    checkedDimensionIds: ['semantic-completeness'],
    dimensionResults: [
      {
        dimensionId: 'semantic-completeness',
        decision: 'pass',
        findingRefs: [],
      },
    ],
    reviewedArtifactRefs: ['requirements-ir'],
    reviewedMustRefs: ['MUST-1'],
    insufficientAuditReasons: [],
  };
}

describe('requirements contract Judge cross-role rejection', () => {
  it('accepts only the canonical Requirements request and response contracts', () => {
    const counters = createRequirementsContractAuthorityCounters();
    const validRequest = request();
    const validResponse = response();

    expect(validateRequirementsJudgeRequest(validRequest, counters)).toBe(validRequest);
    expect(validateRequirementsJudgeResponse(validResponse, counters)).toBe(validResponse);
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });

  it.each([
    ['actorClass', 'final_acceptance_judge'],
    ['judgeRole', 'final_acceptance_judge'],
    ['implementationApproval', true],
    ['deliveryRecommendation', 'ship'],
    ['finalizationDecision', 'finalize'],
    ['effectivePass', { decision: 'pass' }],
  ])('rejects request cross-role field %s before side effects', (field, value) => {
    const counters = createRequirementsContractAuthorityCounters();
    const mutated = { ...request(), [field]: value };

    expect(() => validateRequirementsJudgeRequest(mutated, counters)).toThrow(
      'requirements_judge_request_cross_role_field_forbidden'
    );
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });

  it.each([
    ['actorClass', 'final_acceptance_judge'],
    ['judgeRole', 'final_acceptance_judge'],
    ['auditReviewScoring', { overallGrade: 'A' }],
    ['closeoutApproved', true],
    ['finalizationAuthority', 'final-judge'],
  ])('rejects response cross-role field %s before side effects', (field, value) => {
    const counters = createRequirementsContractAuthorityCounters();
    const mutated = { ...response(), [field]: value };

    expect(() => validateRequirementsJudgeResponse(mutated, counters)).toThrow(
      'requirements_judge_response_cross_role_field_forbidden'
    );
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });

  it('rejects nested scoring authority before side effects', () => {
    const counters = createRequirementsContractAuthorityCounters();
    const mutated = {
      ...response(),
      advisoryObservations: [{ auditReviewScoringContract: { overallGrade: 'A' } }],
    };

    expect(() => validateRequirementsJudgeResponse(mutated, counters)).toThrow(
      'requirements_judge_response_cross_role_field_forbidden'
    );
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });
});
