import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import {
  RequirementsContractAuthorityError,
  type RequirementsContractAuthorityCounters,
} from './requirements-contract-audit-actor-class';
import { verifyRequirementsContractJudgeRequest } from './requirements-contract-judge-request-identity';

type RecordValue = Record<string, unknown>;
type Boundary = {
  schema: string;
  code: string;
  forbiddenSuffixes: readonly string[];
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

function validateRequestBoundary(
  value: unknown,
  _counters: RequirementsContractAuthorityCounters,
  boundary: Boundary
): RecordValue {
  if (!isRecord(value)) fail(boundary.code);
  rejectCrossRole(value, boundary);
  try {
    return verifyRequirementsContractJudgeRequest(value);
  } catch {
    return fail(boundary.code);
  }
}

function validateResponseBoundary(
  value: unknown,
  _counters: RequirementsContractAuthorityCounters,
  boundary: Boundary
): RecordValue {
  if (!isRecord(value)) fail(boundary.code);
  rejectCrossRole(value, boundary);
  if (!schemaValidator(boundary.schema)(value)) fail(boundary.code);
  return value;
}

const requirementsRequest: Boundary = {
  schema: 'requirements-contract-judge-request.schema.json',
  code: 'requirements_judge_request_cross_role_field_forbidden',
  forbiddenSuffixes: REQUIREMENTS_FORBIDDEN,
};
const requirementsResponse: Boundary = {
  schema: 'requirements-contract-judge-response.schema.json',
  code: 'requirements_judge_response_cross_role_field_forbidden',
  forbiddenSuffixes: REQUIREMENTS_FORBIDDEN,
};

export const validateRequirementsJudgeRequest = (
  value: unknown,
  counters: RequirementsContractAuthorityCounters
) => validateRequestBoundary(value, counters, requirementsRequest);
export const validateRequirementsJudgeResponse = (
  value: unknown,
  counters: RequirementsContractAuthorityCounters
) => validateResponseBoundary(value, counters, requirementsResponse);
