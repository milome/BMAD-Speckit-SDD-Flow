import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import {
  RequirementsContractAuthorityError,
  type RequirementsContractAuthorityCounters,
} from './requirements-contract-audit-actor-class';
import { resolveRequirementsContractJudgeAuthority } from './requirements-contract-judge-role';

type RecordValue = Record<string, unknown>;
type JudgePair = {
  actorClass: 'requirements_critical_auditor_judge' | 'final_acceptance_judge';
  judgeRole: 'requirements_critical_auditor' | 'final_acceptance_judge';
};
type Boundary = JudgePair & {
  schema: string;
  code: string;
  forbiddenSuffixes: readonly string[];
  forbiddenVerdicts?: ReadonlySet<string>;
  assessment?: boolean;
};

const validators = new Map<string, ValidateFunction>();
const REQUIREMENTS_FORBIDDEN = [
  'auditreviewscoringcontract',
  'scoring',
  'score',
  'implementationapproval',
  'deliveryrecommendation',
  'closeoutapproved',
  'finalizationdecision',
  'finalizationauthority',
  'effectivepass',
] as const;
const FINAL_FORBIDDEN = [
  'gaproundverdict',
  'repairactions',
  'sourcemutationinstructions',
  'confirmationconvergence',
  'requirementspromotiondecision',
  'promotiondecision',
] as const;
const REQUIREMENTS_VERDICTS = new Set(['no_new_valid_gap', 'no_new_confirmation_blocking_gap']);

function fail(code: string): never {
  throw new RequirementsContractAuthorityError(code);
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizedKey(key: string): string {
  return key.replace(/[-_]/gu, '').toLowerCase();
}

function rejectCrossRole(value: unknown, boundary: Boundary): void {
  if (Array.isArray(value)) {
    value.forEach((item) => rejectCrossRole(item, boundary));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizedKey(key);
    if (boundary.forbiddenSuffixes.some((suffix) => normalized.endsWith(suffix))) {
      fail(boundary.code);
    }
    if (boundary.forbiddenVerdicts?.has(String(child)) && normalized.endsWith('verdict')) {
      fail(boundary.code);
    }
    rejectCrossRole(child, boundary);
  }
}

function schemaValidator(schema: string): ValidateFunction {
  const cached = validators.get(schema);
  if (cached) return cached;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', schema), 'utf8'))
  );
  validators.set(schema, validate);
  return validate;
}

function validateBoundary(
  value: unknown,
  counters: RequirementsContractAuthorityCounters,
  boundary: Boundary
): RecordValue {
  if (!isRecord(value)) fail(boundary.code);
  rejectCrossRole(value, boundary);
  const authority = resolveRequirementsContractJudgeAuthority(value, counters);
  if (
    authority.actorClass !== boundary.actorClass ||
    authority.judgeRole !== boundary.judgeRole ||
    !schemaValidator(boundary.schema)(value)
  ) {
    fail(boundary.code);
  }
  if (
    boundary.assessment &&
    (!isRecord(value.ledgerAuthority) ||
      value.sourceLedgerHash !== value.ledgerAuthority.ledgerHash)
  ) {
    fail(boundary.code);
  }
  return value;
}

const requirementsRequest: Boundary = {
  actorClass: 'requirements_critical_auditor_judge',
  judgeRole: 'requirements_critical_auditor',
  schema: 'requirements-contract-critical-auditor-judge-request.schema.json',
  code: 'requirements_judge_request_cross_role_field_forbidden',
  forbiddenSuffixes: REQUIREMENTS_FORBIDDEN,
};
const requirementsAssessment: Boundary = {
  ...requirementsRequest,
  schema: 'requirements-contract-critical-auditor-judge-assessment.schema.json',
  code: 'requirements_judge_assessment_cross_role_field_forbidden',
  assessment: true,
};
const finalRequest: Boundary = {
  actorClass: 'final_acceptance_judge',
  judgeRole: 'final_acceptance_judge',
  schema: 'requirements-contract-final-acceptance-judge-request.schema.json',
  code: 'final_acceptance_judge_request_cross_role_field_forbidden',
  forbiddenSuffixes: FINAL_FORBIDDEN,
  forbiddenVerdicts: REQUIREMENTS_VERDICTS,
};
const finalAssessment: Boundary = {
  ...finalRequest,
  schema: 'requirements-contract-final-acceptance-judge-assessment.schema.json',
  code: 'final_acceptance_judge_assessment_cross_role_field_forbidden',
  assessment: true,
};

export const validateRequirementsJudgeRequest = (
  value: unknown,
  counters: RequirementsContractAuthorityCounters
) => validateBoundary(value, counters, requirementsRequest);
export const validateRequirementsJudgeAssessment = (
  value: unknown,
  counters: RequirementsContractAuthorityCounters
) => validateBoundary(value, counters, requirementsAssessment);
export const validateFinalAcceptanceJudgeRequest = (
  value: unknown,
  counters: RequirementsContractAuthorityCounters
) => validateBoundary(value, counters, finalRequest);
export const validateFinalAcceptanceJudgeAssessment = (
  value: unknown,
  counters: RequirementsContractAuthorityCounters
) => validateBoundary(value, counters, finalAssessment);
