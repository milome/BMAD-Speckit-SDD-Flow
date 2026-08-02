import {
  isRecord,
  requireHash,
  requireNonEmptyUniqueStrings,
  requireText,
  stableHash,
  text,
  uniqueSorted,
} from './requirements-contract-verification-evidence-normalizer';

export interface RequirementsContractVerificationDag {
  schemaVersion: 'requirements-contract-verification-dag/v1';
  candidateId: string;
  mandatoryCommandIdentityHashes: string[];
  originClosureHashes: string[];
  topologicalOriginOrder: string[];
  duplicateCommandExecutionCount: 0;
  missingOriginCount: 0;
  verificationDagHash: string;
  decision: 'pass';
}

export class RequirementsContractVerificationDagError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractVerificationDagError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractVerificationDagError(code);
}

function commandExecutionIdentity(record: Record<string, unknown>): string {
  return stableHash({
    commandRef: requireText(record, 'commandRef', 'verification_dag_command_invalid'),
    exactCommand: requireText(record, 'exactCommand', 'verification_dag_command_invalid'),
    inputByteHash: requireHash(record, 'inputByteHash', 'verification_dag_command_invalid'),
  });
}

function originHash(record: Record<string, unknown>): string {
  return requireHash(record, 'closureHash', 'verification_dag_origin_missing');
}

export function compileRequirementsContractVerificationDag(
  input: unknown
): RequirementsContractVerificationDag {
  if (!isRecord(input)) fail('verification_dag_input_invalid');
  const candidateId = requireText(input, 'candidateId', 'verification_dag_candidate_invalid');
  const commandExecutions = Array.isArray(input.commandExecutions) ? input.commandExecutions : [];
  if (commandExecutions.length === 0) fail('verification_dag_command_missing');
  const commandIdentityHashes = commandExecutions.map((execution) => {
    if (!isRecord(execution)) fail('verification_dag_command_invalid');
    if (execution.exitCode !== 0) fail('verification_dag_command_failed');
    return commandExecutionIdentity(execution);
  });
  if (new Set(commandIdentityHashes).size !== commandIdentityHashes.length) {
    fail('verification_dag_duplicate_command_execution');
  }
  const originClosures = Array.isArray(input.originClosures) ? input.originClosures : [];
  const expectedOrigins = requireNonEmptyUniqueStrings(
    input.expectedOriginIds,
    'verification_dag_origin_missing'
  );
  const originsById = new Map<string, string>();
  for (const origin of originClosures) {
    if (!isRecord(origin)) fail('verification_dag_origin_missing');
    const originId = requireText(origin, 'originId', 'verification_dag_origin_missing');
    if (origin.decision !== 'pass') fail('verification_dag_origin_stale');
    originsById.set(originId, originHash(origin));
  }
  for (const originId of expectedOrigins) {
    if (!originsById.has(originId)) fail('verification_dag_origin_missing');
  }
  const unexpectedOrigins = [...originsById.keys()].filter(
    (originId) => !expectedOrigins.includes(originId)
  );
  if (unexpectedOrigins.length > 0) fail('verification_dag_origin_unexpected');
  const topologicalOriginOrder = expectedOrigins;
  const payload = {
    schemaVersion: 'requirements-contract-verification-dag/v1' as const,
    candidateId,
    mandatoryCommandIdentityHashes: uniqueSorted(commandIdentityHashes),
    originClosureHashes: topologicalOriginOrder.map((originId) => originsById.get(originId) ?? ''),
    topologicalOriginOrder,
    duplicateCommandExecutionCount: 0 as const,
    missingOriginCount: 0 as const,
    decision: 'pass' as const,
  };
  return { ...payload, verificationDagHash: stableHash(payload) };
}

export function validateRequirementsContractVerificationDag(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractVerificationDag {
  if (!isRecord(value) || !isRecord(currentAuthority)) fail('verification_dag_invalid');
  const dag = value as unknown as RequirementsContractVerificationDag;
  const { verificationDagHash, ...payload } = dag;
  if (verificationDagHash !== stableHash(payload)) fail('verification_dag_hash_mismatch');
  if (
    dag.schemaVersion !== 'requirements-contract-verification-dag/v1' ||
    dag.decision !== 'pass' ||
    dag.duplicateCommandExecutionCount !== 0 ||
    dag.missingOriginCount !== 0
  ) {
    fail('verification_dag_invalid');
  }
  if (
    text(dag.candidateId) !== text(currentAuthority.candidateId) ||
    dag.verificationDagHash !==
      requireHash(currentAuthority, 'verificationDagHash', 'verification_dag_stale')
  ) {
    fail('verification_dag_stale');
  }
  return dag;
}
