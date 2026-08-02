import { describe, expect, it } from 'vitest';
import {
  REQUIREMENTS_CONTRACT_AUDIT_ACTOR_CLASSES,
  REQUIREMENTS_CONTRACT_JUDGE_ACTOR_CLASSES,
  createRequirementsContractAuthorityCounters,
  requireRequirementsContractAuditActorClass,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-audit-actor-class';

describe('requirements contract audit actor classes', () => {
  it('exports exactly the four canonical actor classes and two Judge actors', () => {
    expect(REQUIREMENTS_CONTRACT_AUDIT_ACTOR_CLASSES).toEqual([
      'requirements_critical_auditor_judge',
      'bounded_code_reviewer',
      'final_acceptance_judge',
      'slice_independent_auditor',
    ]);
    expect(REQUIREMENTS_CONTRACT_JUDGE_ACTOR_CLASSES).toEqual([
      'requirements_critical_auditor_judge',
      'final_acceptance_judge',
    ]);
  });

  it('accepts every canonical actor class without inference', () => {
    for (const actorClass of REQUIREMENTS_CONTRACT_AUDIT_ACTOR_CLASSES) {
      expect(requireRequirementsContractAuditActorClass(actorClass)).toBe(actorClass);
    }
  });

  it.each([
    [undefined, 'audit_actor_class_missing'],
    [null, 'audit_actor_class_missing'],
    ['', 'audit_actor_class_missing'],
    ['requirements_auditor', 'audit_actor_class_unknown'],
    ['reviewer', 'audit_actor_class_unknown'],
  ])('rejects invalid actor class %p with stable code %s', (actorClass, code) => {
    expect(() => requireRequirementsContractAuditActorClass(actorClass)).toThrow(code);
  });

  it('exports separate zeroed invocation and persistence counters', () => {
    expect(createRequirementsContractAuthorityCounters()).toEqual({
      invocation: {
        reviewerInvocationCount: 0,
        auditorInvocationCount: 0,
        judgeSemanticAttemptCount: 0,
        judgeCommandCount: 0,
        providerSubInvocationCount: 0,
        subcontractModelAuditCount: 0,
        judgeReviewCampaignCount: 0,
        batchRemediationCount: 0,
        remediationExecutorInvocationCount: 0,
        repairUnitAttemptCount: 0,
        remediationPublicationAttemptCount: 0,
      },
      persistence: {
        persistenceWriteCount: 0,
      },
    });
  });
});
