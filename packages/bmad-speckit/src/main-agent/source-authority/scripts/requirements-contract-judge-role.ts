import {
  REQUIREMENTS_CONTRACT_JUDGE_ACTOR_CLASSES,
  RequirementsContractAuthorityError,
  type RequirementsContractAuditActorClass,
  type RequirementsContractAuthorityCounters,
  type RequirementsContractJudgeActorClass,
  requireRequirementsContractAuditActorClass,
} from './requirements-contract-audit-actor-class';

export const REQUIREMENTS_CONTRACT_JUDGE_ROLES = [
  'requirements_critical_auditor',
  'final_acceptance_judge',
] as const;

export type RequirementsContractJudgeRole = (typeof REQUIREMENTS_CONTRACT_JUDGE_ROLES)[number];

const JUDGE_ROLE_BY_ACTOR = {
  requirements_critical_auditor_judge: 'requirements_critical_auditor',
  final_acceptance_judge: 'final_acceptance_judge',
} as const satisfies Record<RequirementsContractJudgeActorClass, RequirementsContractJudgeRole>;

const INFERENCE_FIELDS = [
  'inferredJudgeRole',
  'requestShapeJudgeRole',
  'providerJudgeRole',
  'filenameJudgeRole',
  'callSiteJudgeRole',
  'scoreJudgeRole',
  'roundJudgeRole',
] as const;

type JudgeAuthority =
  | {
      actorClass: RequirementsContractJudgeActorClass;
      judgeRole: RequirementsContractJudgeRole;
      decision: 'pass';
    }
  | {
      actorClass: Exclude<RequirementsContractAuditActorClass, RequirementsContractJudgeActorClass>;
      judgeRole: null;
      decision: 'pass';
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function resolveRequirementsContractJudgeAuthority(
  input: unknown,
  _counters: RequirementsContractAuthorityCounters
): JudgeAuthority {
  const record = isRecord(input) ? input : {};
  if (INFERENCE_FIELDS.some((field) => Object.hasOwn(record, field))) {
    throw new RequirementsContractAuthorityError('judge_role_inference_forbidden');
  }

  const actorClass = requireRequirementsContractAuditActorClass(record.actorClass);
  const isJudgeActor = REQUIREMENTS_CONTRACT_JUDGE_ACTOR_CLASSES.includes(
    actorClass as RequirementsContractJudgeActorClass
  );
  if (!isJudgeActor) {
    if (Object.hasOwn(record, 'judgeRole')) {
      throw new RequirementsContractAuthorityError('judge_role_forbidden_for_actor');
    }
    return {
      actorClass: actorClass as Exclude<
        RequirementsContractAuditActorClass,
        RequirementsContractJudgeActorClass
      >,
      judgeRole: null,
      decision: 'pass',
    };
  }

  if (typeof record.judgeRole !== 'string' || record.judgeRole.trim().length === 0) {
    throw new RequirementsContractAuthorityError('judge_role_missing');
  }
  if (
    !REQUIREMENTS_CONTRACT_JUDGE_ROLES.includes(record.judgeRole as RequirementsContractJudgeRole)
  ) {
    throw new RequirementsContractAuthorityError('judge_role_unknown');
  }
  const judgeActor = actorClass as RequirementsContractJudgeActorClass;
  if (record.judgeRole !== JUDGE_ROLE_BY_ACTOR[judgeActor]) {
    throw new RequirementsContractAuthorityError('judge_role_actor_mismatch');
  }
  return {
    actorClass: judgeActor,
    judgeRole: record.judgeRole as RequirementsContractJudgeRole,
    decision: 'pass',
  };
}
