import { describe, expect, it } from 'vitest';
import {
  REQUIREMENTS_CONTRACT_AUDIT_ACTOR_CLASSES,
  createRequirementsContractAuthorityCounters,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-audit-actor-class';
import {
  REQUIREMENTS_CONTRACT_JUDGE_ROLES,
  resolveRequirementsContractJudgeAuthority,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-role';

describe('requirements contract Judge role authority', () => {
  it('exports exactly the two canonical Judge roles', () => {
    expect(REQUIREMENTS_CONTRACT_JUDGE_ROLES).toEqual([
      'requirements_critical_auditor',
      'final_acceptance_judge',
    ]);
  });

  it.each([
    ['requirements_critical_auditor_judge', 'requirements_critical_auditor'],
    ['final_acceptance_judge', 'final_acceptance_judge'],
  ] as const)('accepts the exact Judge pair %s -> %s', (actorClass, judgeRole) => {
    const counters = createRequirementsContractAuthorityCounters();

    expect(resolveRequirementsContractJudgeAuthority({ actorClass, judgeRole }, counters)).toEqual({
      actorClass,
      judgeRole,
      decision: 'pass',
    });
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });

  it.each(['bounded_code_reviewer', 'slice_independent_auditor'] as const)(
    'accepts non-Judge actor %s only without a Judge role',
    (actorClass) => {
      expect(
        resolveRequirementsContractJudgeAuthority(
          { actorClass },
          createRequirementsContractAuthorityCounters()
        )
      ).toEqual({
        actorClass,
        judgeRole: null,
        decision: 'pass',
      });
    }
  );

  it('rejects every invalid actor and role pairing before side effects', () => {
    const validPairs = new Set([
      'requirements_critical_auditor_judge:requirements_critical_auditor',
      'final_acceptance_judge:final_acceptance_judge',
    ]);

    for (const actorClass of REQUIREMENTS_CONTRACT_AUDIT_ACTOR_CLASSES) {
      for (const judgeRole of REQUIREMENTS_CONTRACT_JUDGE_ROLES) {
        if (validPairs.has(`${actorClass}:${judgeRole}`)) continue;
        const counters = createRequirementsContractAuthorityCounters();
        const expectedCode =
          actorClass === 'bounded_code_reviewer' || actorClass === 'slice_independent_auditor'
            ? 'judge_role_forbidden_for_actor'
            : 'judge_role_actor_mismatch';

        expect(() =>
          resolveRequirementsContractJudgeAuthority({ actorClass, judgeRole }, counters)
        ).toThrow(expectedCode);
        expect(counters.invocation.providerSubInvocationCount).toBe(0);
        expect(counters.persistence.persistenceWriteCount).toBe(0);
      }
    }
  });

  it.each([
    [{}, 'audit_actor_class_missing'],
    [{ actorClass: 'requirements_critical_auditor_judge' }, 'judge_role_missing'],
    [
      { actorClass: 'final_acceptance_judge', judgeRole: 'requirements_auditor' },
      'judge_role_unknown',
    ],
  ])('rejects incomplete or unknown authority with stable code', (input, code) => {
    const counters = createRequirementsContractAuthorityCounters();

    expect(() => resolveRequirementsContractJudgeAuthority(input, counters)).toThrow(code);
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });

  it.each([
    'inferredJudgeRole',
    'requestShapeJudgeRole',
    'providerJudgeRole',
    'filenameJudgeRole',
    'callSiteJudgeRole',
    'scoreJudgeRole',
    'roundJudgeRole',
  ])('rejects the inference channel %s before provider or persistence', (field) => {
    const counters = createRequirementsContractAuthorityCounters();
    const input = {
      actorClass: 'requirements_critical_auditor_judge',
      judgeRole: 'requirements_critical_auditor',
      [field]: 'final_acceptance_judge',
    };

    expect(() => resolveRequirementsContractJudgeAuthority(input, counters)).toThrow(
      'judge_role_inference_forbidden'
    );
    expect(counters.invocation.providerSubInvocationCount).toBe(0);
    expect(counters.persistence.persistenceWriteCount).toBe(0);
  });
});
