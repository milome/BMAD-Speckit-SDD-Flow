export const REQUIREMENTS_CONTRACT_AUDIT_ACTOR_CLASSES = [
  'requirements_critical_auditor_judge',
  'bounded_code_reviewer',
  'final_acceptance_judge',
  'slice_independent_auditor',
] as const;

export type RequirementsContractAuditActorClass =
  (typeof REQUIREMENTS_CONTRACT_AUDIT_ACTOR_CLASSES)[number];

export const REQUIREMENTS_CONTRACT_JUDGE_ACTOR_CLASSES = [
  'requirements_critical_auditor_judge',
  'final_acceptance_judge',
] as const satisfies readonly RequirementsContractAuditActorClass[];

export type RequirementsContractJudgeActorClass =
  (typeof REQUIREMENTS_CONTRACT_JUDGE_ACTOR_CLASSES)[number];

export interface RequirementsContractInvocationCounters {
  reviewerInvocationCount: number;
  auditorInvocationCount: number;
  judgeSemanticAttemptCount: number;
  judgeCommandCount: number;
  providerSubInvocationCount: number;
  subcontractModelAuditCount: number;
  judgeReviewCampaignCount: number;
  batchRemediationCount: number;
  remediationExecutorInvocationCount: number;
  repairUnitAttemptCount: number;
  remediationPublicationAttemptCount: number;
}

export interface RequirementsContractPersistenceCounters {
  persistenceWriteCount: number;
}

export interface RequirementsContractAuthorityCounters {
  invocation: RequirementsContractInvocationCounters;
  persistence: RequirementsContractPersistenceCounters;
}

export class RequirementsContractAuthorityError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractAuthorityError';
    this.code = code;
  }
}

export function createRequirementsContractAuthorityCounters(): RequirementsContractAuthorityCounters {
  return {
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
  };
}

export function requireRequirementsContractAuditActorClass(
  value: unknown
): RequirementsContractAuditActorClass {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RequirementsContractAuthorityError('audit_actor_class_missing');
  }
  if (
    !REQUIREMENTS_CONTRACT_AUDIT_ACTOR_CLASSES.includes(
      value as RequirementsContractAuditActorClass
    )
  ) {
    throw new RequirementsContractAuthorityError('audit_actor_class_unknown');
  }
  return value as RequirementsContractAuditActorClass;
}
