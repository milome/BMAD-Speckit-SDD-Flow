import fs from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';

const validators = new Map<string, ValidateFunction>();
const SCHEMA_NAME = /^[a-z0-9][a-z0-9-]*\.schema\.json$/u;

function schemaPath(schemaName: string): string {
  if (!SCHEMA_NAME.test(schemaName)) throw new Error('requirements_schema_name_invalid');
  return path.resolve(__dirname, '..', 'schemas', schemaName);
}

export function requirementsContractSchemaValidator(schemaName: string): ValidateFunction {
  const cached = validators.get(schemaName);
  if (cached) return cached;
  const filePath = schemaPath(schemaName);
  const schema = JSON.parse(fs.readFileSync(filePath, 'utf8')) as object;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  validators.set(schemaName, validate);
  return validate;
}

export function validateRequirementsContractSchema(schemaName: string, value: unknown) {
  const validate = requirementsContractSchemaValidator(schemaName);
  const valid = Boolean(validate(value));
  return {
    decision: valid ? 'pass' as const : 'block' as const,
    issueCodes: valid
      ? []
      : (validate.errors ?? []).map((error) =>
          `requirements_schema_invalid:${error.instancePath || '/'}:${error.keyword}`
        ),
  };
}

export function assertRequirementsContractSchema(schemaName: string, value: unknown): void {
  const validation = validateRequirementsContractSchema(schemaName, value);
  if (validation.decision === 'block') throw new Error(validation.issueCodes.join(','));
}
