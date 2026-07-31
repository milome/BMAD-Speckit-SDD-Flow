import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { createRequirementsContractAuthorityCounters } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-audit-actor-class';
import {
  validateFinalAcceptanceJudgeAssessment,
  validateFinalAcceptanceJudgeRequest,
  validateRequirementsJudgeAssessment,
  validateRequirementsJudgeRequest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-cross-role-guard';

const hash = (character: string) => `sha256:${character.repeat(64)}`;
const schemaRoot = path.resolve('packages/bmad-speckit/src/main-agent/source-authority/schemas');
const providerAuthority = (role: string, registryHash: string, configurationHash: string) => ({
  providerRef: `provider:${role}`,
  providerRegistryHash: hash(registryHash),
  providerConfigurationHash: hash(configurationHash),
  credentialRevision: 1,
});
const ledgerAuthority = (role: string, character: string) => ({
  ledgerRef: `ledger:${role}`,
  ledgerHash: hash(character),
});

function request(kind: 'requirements' | 'final') {
  const requirements = kind === 'requirements';
  return {
    schemaVersion: requirements
      ? 'requirements-contract-critical-auditor-judge-request/v1'
      : 'requirements-contract-final-acceptance-judge-request/v1',
    actorClass: requirements ? 'requirements_critical_auditor_judge' : 'final_acceptance_judge',
    judgeRole: requirements ? 'requirements_critical_auditor' : 'final_acceptance_judge',
    scopeManifestHash: hash(requirements ? '1' : '7'),
    attemptKey: hash(requirements ? '2' : '8'),
    promptTemplateHash: hash(requirements ? '3' : '9'),
    assessmentSchemaHash: hash(requirements ? '4' : 'a'),
    providerAuthority: providerAuthority(kind, requirements ? '5' : 'b', requirements ? '6' : 'c'),
    ledgerAuthority: ledgerAuthority(kind, requirements ? '6' : 'd'),
  };
}

function assessment(kind: 'requirements' | 'final') {
  const base = request(kind);
  const binding = {
    ...base,
    schemaVersion:
      kind === 'requirements'
        ? 'critical-auditor-judge-assessment/v1'
        : 'requirements-contract-final-acceptance-judge-assessment/v1',
    requestHash: hash(kind === 'requirements' ? 'b' : 'e'),
    providerInvocationHash: hash(kind === 'requirements' ? 'c' : 'f'),
    sourceLedgerHash: base.ledgerAuthority.ledgerHash,
  };
  if (kind === 'final') {
    return {
      ...binding,
      verdict: 'coverage_satisfied',
      findings: [],
      coverage: [],
      evidenceRefs: ['EVD-FINAL-1'],
      rationale: 'Readonly final acceptance assessment.',
    };
  }
  return {
    ...binding,
    verdict: 'no_new_valid_gap',
    gapCandidates: [],
    validatedGaps: [],
    rejectedGapCandidates: [],
    mutationPressureFindings: [],
    overBroadTaskFindings: [],
    missingProjectionFindings: [],
    invalidProofFindings: [],
    legacyBypassFindings: [],
    sourceMaterializationFindings: [],
    reviewedMustRefs: ['MUST-1'],
    reviewedProjectionRefs: ['projection:1'],
    checkedProjectionGroups: ['requirements.must'],
    checkedProjectionQualityRuleCodes: ['projection_complete'],
    priorFindingsDisposition: [],
    falsePositiveProofs: [],
    rationale: 'Requirements-only assessment.',
  };
}

function expectSchema(file: string, value: unknown) {
  const schema = JSON.parse(readFileSync(path.join(schemaRoot, file), 'utf8'));
  expect(new Ajv2020({ allErrors: true, strict: false }).compile(schema)(value)).toBe(true);
}

type Mutation = [string, unknown];

const finalForbidden: Mutation[] = [
  ['requirementsGapRoundVerdict', 'new_valid_gap'],
  ['repairActions', [{ actionId: 'mutate-source' }]],
  ['sourceMutationInstructions', ['rewrite requirements']],
  ['confirmationConvergence', 'confirmed'],
  ['requirementsPromotionDecision', 'promote'],
  ['verdict', 'no_new_valid_gap'],
  ['verdict', 'no_new_confirmation_blocking_gap'],
];
const requirementsForbidden: Mutation[] = [
  ['auditReviewScoring', { overallGrade: 'A' }],
  ['finalScore', 100],
  ['implementationApproval', true],
  ['deliveryRecommendation', 'ship'],
  ['closeoutApproved', true],
  ['finalizationDecision', 'finalize'],
];

const boundaries = [
  {
    name: 'requirements request',
    valid: request('requirements'),
    crossRole: request('final'),
    validate: validateRequirementsJudgeRequest,
    schema: 'requirements-contract-critical-auditor-judge-request.schema.json',
    code: 'requirements_judge_request_cross_role_field_forbidden',
    forbidden: requirementsForbidden,
  },
  {
    name: 'requirements assessment',
    valid: assessment('requirements'),
    crossRole: assessment('final'),
    validate: validateRequirementsJudgeAssessment,
    schema: 'requirements-contract-critical-auditor-judge-assessment.schema.json',
    code: 'requirements_judge_assessment_cross_role_field_forbidden',
    forbidden: requirementsForbidden,
  },
  {
    name: 'final acceptance request',
    valid: request('final'),
    crossRole: request('requirements'),
    validate: validateFinalAcceptanceJudgeRequest,
    schema: 'requirements-contract-final-acceptance-judge-request.schema.json',
    code: 'final_acceptance_judge_request_cross_role_field_forbidden',
    forbidden: finalForbidden,
  },
  {
    name: 'final acceptance assessment',
    valid: assessment('final'),
    crossRole: assessment('requirements'),
    validate: validateFinalAcceptanceJudgeAssessment,
    schema: 'requirements-contract-final-acceptance-judge-assessment.schema.json',
    code: 'final_acceptance_judge_assessment_cross_role_field_forbidden',
    forbidden: finalForbidden,
  },
] as const;

describe('requirements contract Judge cross-role rejection', () => {
  it.each(boundaries)('accepts valid $name and its direct Ajv schema', (boundary) => {
    const counters = createRequirementsContractAuthorityCounters();
    expect(boundary.validate(boundary.valid, counters)).toBe(boundary.valid);
    expectSchema(boundary.schema, boundary.valid);
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });

  it.each(boundaries)('rejects cross-role replay at the $name boundary', (boundary) => {
    const counters = createRequirementsContractAuthorityCounters();
    expect(() => boundary.validate(boundary.crossRole, counters)).toThrow(boundary.code);
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });

  it.each(boundaries)('preserves invalid pair code at the $name boundary', (boundary) => {
    const counters = createRequirementsContractAuthorityCounters();
    const mutated = {
      ...boundary.valid,
      actorClass:
        boundary.valid.actorClass === 'final_acceptance_judge'
          ? 'requirements_critical_auditor_judge'
          : 'final_acceptance_judge',
    };
    expect(() => boundary.validate(mutated, counters)).toThrow('judge_role_actor_mismatch');
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });

  it.each(boundaries)('uses the role-bound code for ordinary $name schema errors', (boundary) => {
    const counters = createRequirementsContractAuthorityCounters();
    const mutated = structuredClone(boundary.valid) as Record<string, unknown>;
    delete mutated.promptTemplateHash;
    expect(() => boundary.validate(mutated, counters)).toThrow(boundary.code);
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });

  it('rejects a nested Requirements scoring contract before side effects', () => {
    const counters = createRequirementsContractAuthorityCounters();
    const mutated = structuredClone(assessment('requirements')) as Record<string, unknown>;
    mutated.gapCandidates = [
      {
        auditReviewScoringContract: {
          schemaVersion: 'audit-review-scoring-contract/v1',
        },
      },
    ];

    expect(() => validateRequirementsJudgeAssessment(mutated, counters)).toThrow(
      'requirements_judge_assessment_cross_role_field_forbidden'
    );
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });

  for (const boundary of boundaries) {
    it.each(boundary.forbidden)(
      `rejects ${boundary.name} cross-role mutation %s before side effects`,
      (field, value) => {
        const counters = createRequirementsContractAuthorityCounters();
        const mutated = structuredClone(boundary.valid) as Record<string, unknown>;
        mutated[field] = value;
        expect(() => boundary.validate(mutated, counters)).toThrow(boundary.code);
        expect(counters.invocation.providerSubInvocationCount).toBe(0);
        expect(counters.persistence.persistenceWriteCount).toBe(0);
      }
    );
  }
});
