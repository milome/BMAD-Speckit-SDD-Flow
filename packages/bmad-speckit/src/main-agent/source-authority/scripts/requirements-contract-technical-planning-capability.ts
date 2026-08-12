import { sha256Stable } from './requirements-contract-semantic-resolver';

export const REQUIREMENTS_TECHNICAL_EXECUTION_KINDS = [
  'ART',
  'CMD',
  'CTM',
  'EVDREQ',
  'PATH',
  'STOP',
] as const;

export type RequirementsTechnicalExecutionKind =
  (typeof REQUIREMENTS_TECHNICAL_EXECUTION_KINDS)[number];

export interface RequirementsTechnicalExecutionEntry {
  kind: RequirementsTechnicalExecutionKind;
  id: string;
  value: string;
}

export interface RequirementsTechnicalPlanningCapabilityInput {
  authoringRequestId: string;
  authoringAttemptId: string;
  checkpointId: 'cp02' | 'g02';
  capability: {
    capabilityId: string;
    status: 'available' | 'unavailable';
    capabilityHash: string;
    configHash: string;
  };
  premiseHash: string;
  candidates: RequirementsTechnicalExecutionEntry[];
}

export interface RequirementsTechnicalPlanningCapabilityResult {
  schemaVersion: 'requirements-contract-technical-planning-capability/v1';
  authoringRequestId: string;
  authoringAttemptId: string;
  checkpointId: 'cp02' | 'g02';
  capabilityId: string;
  capabilityStatus: 'available' | 'unavailable';
  capabilityHash: string;
  configHash: string;
  premiseHash: string;
  triggerIdentity: string;
  status: 'resolved' | 'technical_planning_pending';
  issueCode: 'requirements_technical_planning_pending' | null;
  resumable: boolean;
  executionRegistry: {
    schemaVersion: 'requirements-contract-typed-execution-registry/v1';
    entries: RequirementsTechnicalExecutionEntry[];
    registryHash: string;
  } | null;
  resultHash: string;
}

export interface RequirementsProductionTechnicalAuthorityCandidate {
  sourceRootId: string;
  semanticBody: Record<string, unknown>;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const executionKinds = new Set<string>(REQUIREMENTS_TECHNICAL_EXECUTION_KINDS);

function normalized(value: string, issueCode: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(issueCode);
  return value.normalize('NFC');
}

function canonicalEntries(
  entries: RequirementsTechnicalExecutionEntry[]
): RequirementsTechnicalExecutionEntry[] {
  if (!Array.isArray(entries)) throw new Error('requirements_technical_candidates_invalid');
  const normalizedEntries = entries.map((entry) => {
    if (!entry || !executionKinds.has(entry.kind)) {
      throw new Error('requirements_technical_candidate_kind_invalid');
    }
    return {
      kind: entry.kind,
      id: normalized(entry.id, 'requirements_technical_candidate_id_invalid'),
      value: normalized(entry.value, 'requirements_technical_candidate_value_invalid'),
    };
  });
  normalizedEntries.sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id)
  );
  const identities = normalizedEntries.map((entry) => `${entry.kind}:${entry.id}`);
  if (new Set(identities).size !== identities.length) {
    throw new Error('requirements_technical_candidate_duplicate');
  }
  return normalizedEntries;
}

function hashPayload(
  input: Omit<RequirementsTechnicalPlanningCapabilityResult, 'resultHash'>
): string {
  return sha256Stable({
    domain: 'requirements-contract-technical-planning-capability-result/v1',
    payload: input,
  });
}

export function resolveRequirementsTechnicalPlanningCapability(
  input: RequirementsTechnicalPlanningCapabilityInput
): RequirementsTechnicalPlanningCapabilityResult {
  const authoringRequestId = normalized(
    input.authoringRequestId,
    'requirements_technical_authoring_request_id_invalid'
  );
  const authoringAttemptId = normalized(
    input.authoringAttemptId,
    'requirements_technical_authoring_attempt_id_invalid'
  );
  const capabilityId = normalized(
    input.capability?.capabilityId,
    'requirements_technical_capability_id_invalid'
  );
  if (!['cp02', 'g02'].includes(input.checkpointId)) {
    throw new Error('requirements_technical_checkpoint_invalid');
  }
  if (!['available', 'unavailable'].includes(input.capability?.status)) {
    throw new Error('requirements_technical_capability_status_invalid');
  }
  if (
    !SHA256.test(input.capability.capabilityHash) ||
    !SHA256.test(input.capability.configHash) ||
    !SHA256.test(input.premiseHash)
  ) {
    throw new Error('requirements_technical_identity_hash_invalid');
  }
  const entries = canonicalEntries(input.candidates);
  const triggerIdentity = sha256Stable({
    domain: 'requirements-technical-planning-trigger/v1',
    authoringRequestId,
    authoringAttemptId,
    checkpointId: input.checkpointId,
    capabilityId,
    capabilityHash: input.capability.capabilityHash,
    configHash: input.capability.configHash,
    premiseHash: input.premiseHash,
  });
  const pending = input.capability.status === 'unavailable';
  const executionRegistry = pending
    ? null
    : {
        schemaVersion: 'requirements-contract-typed-execution-registry/v1' as const,
        entries,
        registryHash: sha256Stable({
          domain: 'requirements-contract-typed-execution-registry/v1',
          entries,
        }),
      };
  const payload: Omit<RequirementsTechnicalPlanningCapabilityResult, 'resultHash'> = {
    schemaVersion: 'requirements-contract-technical-planning-capability/v1',
    authoringRequestId,
    authoringAttemptId,
    checkpointId: input.checkpointId,
    capabilityId,
    capabilityStatus: input.capability.status,
    capabilityHash: input.capability.capabilityHash,
    configHash: input.capability.configHash,
    premiseHash: input.premiseHash,
    triggerIdentity,
    status: pending ? 'technical_planning_pending' : 'resolved',
    issueCode: pending ? 'requirements_technical_planning_pending' : null,
    resumable: pending,
    executionRegistry,
  };
  return { ...payload, resultHash: hashPayload(payload) };
}

export function resolveRequirementsProductionTechnicalPlanningCapability(input: {
  authoringRequestId: string;
  authoringAttemptId: string;
  premiseHash: string;
  sourceRootCandidates: RequirementsProductionTechnicalAuthorityCandidate[];
}): RequirementsTechnicalPlanningCapabilityResult {
  if (!Array.isArray(input.sourceRootCandidates)) {
    throw new Error('requirements_technical_authority_candidates_invalid');
  }
  const candidates = input.sourceRootCandidates.flatMap((candidate) => {
    if (!normalized(candidate.sourceRootId, 'requirements_technical_source_root_id_invalid')) {
      throw new Error('requirements_technical_source_root_id_invalid');
    }
    const declared = candidate.semanticBody?.executionConstraints;
    if (declared === undefined) return [];
    if (!Array.isArray(declared)) {
      throw new Error('requirements_technical_candidates_invalid');
    }
    return declared as RequirementsTechnicalExecutionEntry[];
  });
  const status = candidates.length > 0 ? 'available' as const : 'unavailable' as const;
  const capabilityId = 'requirements-production-technical-planner';
  return resolveRequirementsTechnicalPlanningCapability({
    authoringRequestId: input.authoringRequestId,
    authoringAttemptId: input.authoringAttemptId,
    checkpointId: 'cp02',
    capability: {
      capabilityId,
      status,
      capabilityHash: sha256Stable({
        domain: 'requirements-production-technical-planner-capability/v1',
        capabilityId,
        status,
      }),
      configHash: sha256Stable({
        domain: 'requirements-production-technical-planner-config/v1',
        candidates: canonicalEntries(candidates),
      }),
    },
    premiseHash: input.premiseHash,
    candidates,
  });
}

export function validateRequirementsTechnicalPlanningCapabilityResult(
  value: unknown
): value is RequirementsTechnicalPlanningCapabilityResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as RequirementsTechnicalPlanningCapabilityResult;
  const keys = [
    'schemaVersion',
    'authoringRequestId',
    'authoringAttemptId',
    'checkpointId',
    'capabilityId',
    'capabilityStatus',
    'capabilityHash',
    'configHash',
    'premiseHash',
    'triggerIdentity',
    'status',
    'issueCode',
    'resumable',
    'executionRegistry',
    'resultHash',
  ];
  if (Object.keys(result).sort().join('|') !== [...keys].sort().join('|')) return false;
  if (
    result.schemaVersion !== 'requirements-contract-technical-planning-capability/v1' ||
    !['cp02', 'g02'].includes(result.checkpointId) ||
    !['available', 'unavailable'].includes(result.capabilityStatus) ||
    ![result.capabilityHash, result.configHash, result.premiseHash,
      result.triggerIdentity, result.resultHash].every((hash) => SHA256.test(hash))
  ) {
    return false;
  }
  const pending = result.status === 'technical_planning_pending';
  if (
    pending !== (result.capabilityStatus === 'unavailable') ||
    pending !== result.resumable ||
    (pending ? result.issueCode !== 'requirements_technical_planning_pending' : result.issueCode !== null) ||
    (pending ? result.executionRegistry !== null : result.executionRegistry === null)
  ) {
    return false;
  }
  try {
    const entries = result.executionRegistry
      ? canonicalEntries(result.executionRegistry.entries)
      : [];
    if (
      result.executionRegistry &&
      (JSON.stringify(entries) !== JSON.stringify(result.executionRegistry.entries) ||
        result.executionRegistry.registryHash !== sha256Stable({
          domain: 'requirements-contract-typed-execution-registry/v1',
          entries,
        }))
    ) {
      return false;
    }
    const { resultHash, ...payload } = result;
    return resultHash === hashPayload(payload);
  } catch {
    return false;
  }
}
