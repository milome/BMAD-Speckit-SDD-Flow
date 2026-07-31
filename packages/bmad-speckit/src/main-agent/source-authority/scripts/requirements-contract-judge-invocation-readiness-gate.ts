import Ajv2020 from 'ajv/dist/2020.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { canonicalJson, sha256 } from './requirements-contract-governed-write';

type JsonRecord = Record<string, unknown>;

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const REQUIRED_BINDING_FIELDS = [
  'providerRegistryHash',
  'credentialBindingHash',
  'promptHash',
  'schemaHash',
  'policyHash',
  'ledgerHash',
  'auditUnitSetHash',
  'vetoSetHash',
] as const;

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}

function hash(value: unknown, code: string): string {
  const normalized = text(value, code);
  if (!HASH_PATTERN.test(normalized)) throw new Error(code);
  return normalized;
}

function schemaValidator() {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-judge-invocation-readiness-receipt.schema.json'
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema);
}

export interface RequirementsContractJudgeInvocationReadinessReceipt {
  schemaVersion: 'requirements-contract-judge-invocation-readiness-receipt/v1';
  role: 'requirements';
  attemptId: string;
  requestHash: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  projectionSetHash: string;
  scopeHash: string;
  providerRegistryHash: string;
  credentialBindingHash: string;
  promptHash: string;
  schemaHash: string;
  policyHash: string;
  ledgerHash: string;
  auditUnitSetHash: string;
  vetoSetHash: string;
  readinessHash: string;
  providerInvocationCount: 0;
  decision: 'pass';
}

export function evaluateRequirementsContractJudgeInvocationReadiness(input: {
  role: 'requirements';
  attemptId: string;
  scope: JsonRecord;
  providerRegistryHash: string;
  credentialBindingHash: string;
  promptHash: string;
  schemaHash: string;
  policyHash: string;
  ledgerHash: string;
  auditUnitSetHash: string;
  vetoSetHash: string;
}): RequirementsContractJudgeInvocationReadinessReceipt {
  if (input.role !== 'requirements') {
    throw new Error('requirements_contract_judge_readiness_role_invalid');
  }
  const scope = record(input.scope, 'requirements_contract_judge_readiness_scope_invalid');
  const payload = {
    schemaVersion: 'requirements-contract-judge-invocation-readiness-receipt/v1' as const,
    role: 'requirements' as const,
    attemptId: text(input.attemptId, 'requirements_contract_judge_readiness_missing:attemptId'),
    requestHash: hash(
      scope.requestHash,
      'requirements_contract_judge_readiness_missing:requestHash'
    ),
    sourceDocumentHash: hash(
      scope.sourceDocumentHash,
      'requirements_contract_judge_readiness_missing:sourceDocumentHash'
    ),
    semanticModelHash: hash(
      scope.semanticModelHash,
      'requirements_contract_judge_readiness_missing:semanticModelHash'
    ),
    projectionSetHash: hash(
      scope.projectionSetHash,
      'requirements_contract_judge_readiness_missing:projectionSetHash'
    ),
    scopeHash: hash(scope.scopeHash, 'requirements_contract_judge_readiness_missing:scopeHash'),
    providerRegistryHash: hash(
      input.providerRegistryHash,
      'requirements_contract_judge_readiness_missing:providerRegistryHash'
    ),
    credentialBindingHash: hash(
      input.credentialBindingHash,
      'requirements_contract_judge_readiness_missing:credentialBindingHash'
    ),
    promptHash: hash(input.promptHash, 'requirements_contract_judge_readiness_missing:promptHash'),
    schemaHash: hash(input.schemaHash, 'requirements_contract_judge_readiness_missing:schemaHash'),
    policyHash: hash(input.policyHash, 'requirements_contract_judge_readiness_missing:policyHash'),
    ledgerHash: hash(input.ledgerHash, 'requirements_contract_judge_readiness_missing:ledgerHash'),
    auditUnitSetHash: hash(
      input.auditUnitSetHash,
      'requirements_contract_judge_readiness_missing:auditUnitSetHash'
    ),
    vetoSetHash: hash(
      input.vetoSetHash,
      'requirements_contract_judge_readiness_missing:vetoSetHash'
    ),
    providerInvocationCount: 0 as const,
    decision: 'pass' as const,
  };
  const receipt = {
    ...payload,
    readinessHash: sha256(canonicalJson(payload)),
  };
  const validate = schemaValidator();
  if (!validate(receipt)) {
    throw new Error(
      `requirements_contract_judge_readiness_schema_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
  return receipt;
}

export function assertRequirementsContractJudgeInvocationReadiness(input: {
  readinessReceipt: JsonRecord;
  scope: JsonRecord;
  providerInvocationCount: number;
}): RequirementsContractJudgeInvocationReadinessReceipt {
  const receipt = record(
    input.readinessReceipt,
    'requirements_contract_judge_readiness_receipt_invalid'
  );
  const scope = record(input.scope, 'requirements_contract_judge_readiness_scope_invalid');
  const validate = schemaValidator();
  if (!validate(receipt)) {
    for (const field of REQUIRED_BINDING_FIELDS) {
      if (receipt[field] === undefined) {
        throw new Error(`requirements_contract_judge_readiness_missing:${field}`);
      }
    }
    throw new Error(
      `requirements_contract_judge_readiness_schema_invalid:${JSON.stringify(validate.errors ?? [])}`
    );
  }
  if (input.providerInvocationCount !== 0 || receipt.providerInvocationCount !== 0) {
    throw new Error('requirements_contract_judge_readiness_provider_invoked_before_ready');
  }
  for (const field of [
    'requestHash',
    'sourceDocumentHash',
    'semanticModelHash',
    'projectionSetHash',
    'scopeHash',
  ]) {
    if (receipt[field] !== scope[field]) {
      throw new Error(`requirements_contract_judge_readiness_stale:${field}`);
    }
  }
  for (const field of REQUIRED_BINDING_FIELDS) {
    hash(receipt[field], `requirements_contract_judge_readiness_missing:${field}`);
  }
  const unsignedReceipt = { ...receipt };
  delete unsignedReceipt.readinessHash;
  const expectedHash = sha256(canonicalJson(unsignedReceipt));
  if (receipt.readinessHash !== expectedHash) {
    throw new Error('requirements_contract_judge_readiness_stale:readinessHash');
  }
  return receipt as unknown as RequirementsContractJudgeInvocationReadinessReceipt;
}
