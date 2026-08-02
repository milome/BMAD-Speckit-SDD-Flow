import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sha256Stable, sha256Text } from './requirements-contract-semantic-resolver';

export type InvocationAuthorityEntrySource =
  | 'bmad_prd'
  | 'session_requirements'
  | 'source_prd_draft';

export interface InvocationAuthorityArgument {
  order: number;
  argumentId: string;
  kind: 'target_path' | 'required_command';
  optionName: '--target-path' | '--required-command';
  value: string;
  valueHash: string;
}

export interface RequirementsContractInvocationAuthorityReceipt {
  schemaVersion: 'requirements-contract-invocation-authority-receipt/v1';
  requirementSetId: string;
  recordId: string;
  invocationId: string;
  entrySource: InvocationAuthorityEntrySource;
  sourceDocumentHash: string;
  arguments: InvocationAuthorityArgument[];
  argumentSetHash: string;
  capturedAt: string;
  receiptHash: string;
}

export function requirementsContractInvocationAuthorityBindingHash(
  receipt: RequirementsContractInvocationAuthorityReceipt
): string {
  return sha256Stable({
    schemaVersion: receipt.schemaVersion,
    requirementSetId: receipt.requirementSetId,
    recordId: receipt.recordId,
    invocationId: receipt.invocationId,
    entrySource: receipt.entrySource,
    sourceDocumentHash: receipt.sourceDocumentHash,
    argumentSetHash: receipt.argumentSetHash,
  });
}

const SCHEMA_FILE = 'requirements-contract-invocation-authority-receipt.schema.json';
let validator: ValidateFunction | null = null;

function schemaValidator(): ValidateFunction {
  if (validator) return validator;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  validator = ajv.compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE), 'utf8'))
  );
  return validator;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be a non-empty string`);
  return normalized;
}

export function createRequirementsContractInvocationAuthorityReceipt(input: {
  requirementSetId: string;
  recordId: string;
  entrySource: InvocationAuthorityEntrySource;
  sourceDocumentHash: string;
  targetPaths: string[];
  requiredCommands: string[];
  capturedAt: string;
}): RequirementsContractInvocationAuthorityReceipt {
  const rawArguments = [
    ...input.targetPaths.map((value) => ({
      kind: 'target_path' as const,
      optionName: '--target-path' as const,
      value: requiredText(value, 'targetPath').replace(/\\/gu, '/'),
    })),
    ...input.requiredCommands.map((value) => ({
      kind: 'required_command' as const,
      optionName: '--required-command' as const,
      value: requiredText(value, 'requiredCommand'),
    })),
  ];
  if (rawArguments.length === 0) {
    throw new Error('Invocation Authority Receipt requires explicit invocation arguments');
  }
  if (Number.isNaN(Date.parse(input.capturedAt))) {
    throw new Error('capturedAt must be an ISO-8601 timestamp');
  }
  const argumentsWithIdentity: InvocationAuthorityArgument[] = rawArguments.map(
    (argument, index) => ({
      order: index + 1,
      argumentId: `INVOCATION-ARG-${String(index + 1).padStart(3, '0')}`,
      ...argument,
      valueHash: sha256Text(argument.value),
    })
  );
  const argumentSetHash = sha256Stable(argumentsWithIdentity);
  const identity = {
    requirementSetId: requiredText(input.requirementSetId, 'requirementSetId'),
    recordId: requiredText(input.recordId, 'recordId'),
    entrySource: input.entrySource,
    sourceDocumentHash: requiredText(input.sourceDocumentHash, 'sourceDocumentHash'),
    argumentSetHash,
  };
  const payload = {
    schemaVersion: 'requirements-contract-invocation-authority-receipt/v1' as const,
    ...identity,
    invocationId: `requirements-invocation-${sha256Stable(identity).slice(
      'sha256:'.length,
      'sha256:'.length + 24
    )}`,
    arguments: argumentsWithIdentity,
    capturedAt: input.capturedAt,
  };
  const receipt = { ...payload, receiptHash: sha256Stable(payload) };
  if (!validateRequirementsContractInvocationAuthorityReceipt(receipt)) {
    throw new Error('Generated Invocation Authority Receipt failed schema or hash validation');
  }
  return receipt;
}

export function validateRequirementsContractInvocationAuthorityReceipt(
  value: unknown
): boolean {
  if (!schemaValidator()(value) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const receipt = value as RequirementsContractInvocationAuthorityReceipt;
  if (
    receipt.arguments.some(
      (argument, index) =>
        argument.order !== index + 1 ||
        argument.argumentId !== `INVOCATION-ARG-${String(index + 1).padStart(3, '0')}` ||
        argument.valueHash !== sha256Text(argument.value) ||
        (argument.kind === 'target_path' && argument.optionName !== '--target-path') ||
        (argument.kind === 'required_command' &&
          argument.optionName !== '--required-command')
    ) ||
    receipt.argumentSetHash !== sha256Stable(receipt.arguments)
  ) {
    return false;
  }
  const { receiptHash, ...payload } = receipt;
  return receiptHash === sha256Stable(payload);
}
