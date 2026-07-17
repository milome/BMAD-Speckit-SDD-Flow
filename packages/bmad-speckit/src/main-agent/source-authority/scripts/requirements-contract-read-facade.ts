import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { RequirementsContractValidationMode } from './requirements-contract-validation-facade';

export interface RequirementsContractReadEnvelope {
  requirementSetId: string;
  sourcePath: string;
  sourceHash: string;
  sourceFormatVersion: 'requirement-contract-model/v2' | 'requirement-contract-source-prd/v1';
  activeBundleRevision: string;
  semanticModelHash: string;
  traceGraphHash: string;
  cutoverId: string;
}

export interface RequirementsContractReadInput {
  projectRoot: string;
  consumerId: string;
  mode: RequirementsContractValidationMode;
  envelope: RequirementsContractReadEnvelope;
}

export interface RequirementsContractReadIssue {
  code:
    | 'consumer_registry_missing'
    | 'consumer_registry_invalid'
    | 'consumer_not_registered'
    | 'consumer_contract_mismatch'
    | 'unsupported_source_format'
    | 'adapter_blocked'
    | 'lifecycle_validation_blocked';
  path: string;
  message: string;
}

export interface RequirementsContractReadResult {
  ok: boolean;
  decision: 'pass' | 'block';
  adapterInvoked: boolean;
  issues: RequirementsContractReadIssue[];
  logicalModel: Record<string, unknown> | null;
  traceGraph: Record<string, unknown> | null;
}

const CONSUMER_REGISTRY_PATH =
  '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function blocked(
  code: RequirementsContractReadIssue['code'],
  issuePath: string,
  message: string
): RequirementsContractReadResult {
  return {
    ok: false,
    decision: 'block',
    adapterInvoked: false,
    issues: [{ code, path: issuePath, message }],
    logicalModel: null,
    traceGraph: null,
  };
}

export function readRequirementsContract(
  input: RequirementsContractReadInput
): RequirementsContractReadResult {
  const registryPath = path.resolve(input.projectRoot, CONSUMER_REGISTRY_PATH);
  if (!existsSync(registryPath)) {
    return blocked(
      'consumer_registry_missing',
      registryPath,
      'canonical requirements contract Consumer Registry is missing'
    );
  }

  let registry: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(readFileSync(registryPath, 'utf8'));
    if (!isRecord(parsed)) throw new Error('Consumer Registry root must be an object');
    registry = parsed;
  } catch (error) {
    return blocked(
      'consumer_registry_invalid',
      registryPath,
      error instanceof Error ? error.message : String(error)
    );
  }
  const activation = isRecord(registry.activation) ? registry.activation : null;
  if (
    registry.schemaVersion !== 'requirements-contract-consumer-registry/v1' ||
    !activation ||
    activation.shadowOutputEnabled !== false ||
    activation.v1OutputEnabled !== false ||
    activation.productionReadModelVersion !== 'v2' ||
    !Array.isArray(registry.consumers)
  ) {
    return blocked(
      'consumer_registry_invalid',
      registryPath,
      'Consumer Registry schema or V2 production activation selector is invalid'
    );
  }
  const consumer = registry.consumers.find(
    (candidate) => isRecord(candidate) && candidate.consumerId === input.consumerId
  );
  if (!isRecord(consumer)) {
    return blocked(
      'consumer_not_registered',
      registryPath,
      `production semantic consumer is not registered: ${input.consumerId}`
    );
  }

  return blocked(
    'consumer_contract_mismatch',
    registryPath,
    'registered consumer contract validation is not implemented'
  );
}
