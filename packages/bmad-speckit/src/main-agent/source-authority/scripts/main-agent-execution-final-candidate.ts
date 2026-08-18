import {
  isRecord,
  stableHash,
  uniqueSorted,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';

type GoalProfile = 'requirements_backed' | 'standalone';

type CandidateArtifact = {
  artifactId: string;
  artifactKind: string;
  path: string;
  hash: string;
};

type CandidateExecutionResult = {
  executionResultId: string;
  executionAuthorityId: string;
  closureHash: string;
};

type CandidateCommand = {
  commandId: string;
  normalizedInvocationHash: string;
};

type CandidateEvidence = {
  evidenceId: string;
  evidenceKind: string;
  path: string;
  hash: string;
};

type CandidateDeliveryClaim = {
  deliveryClaimId: string;
  claimHash: string;
  evidenceIds: string[];
};

export type ExecutionFinalCandidate = {
  schemaVersion: 'ExecutionFinalCandidate/v1';
  profile: GoalProfile;
  goalId: string;
  goalExecutionIRHash: string;
  requirementsLineage?: JsonRecord;
  standaloneLineage?: JsonRecord;
  activeRunPointerHash: string;
  activationRecordHash: string;
  executionPackageHashes: string[];
  campaignClosureHash: string;
  implementationContextHash: string;
  requiredDimensionIds: string[];
  requiredArtifactIds: string[];
  requiredObligationIds: string[];
  requiredExecutionResultIds: string[];
  requiredCommandIds: string[];
  requiredEvidenceIds: string[];
  requiredDeliveryClaimIds: string[];
  artifacts: CandidateArtifact[];
  executionResults: CandidateExecutionResult[];
  commands: CandidateCommand[];
  evidence: CandidateEvidence[];
  deliveryClaims: CandidateDeliveryClaim[];
  executionFinalCandidateHash: string;
};

export class ExecutionFinalCandidateError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'ExecutionFinalCandidateError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new ExecutionFinalCandidateError(code);
}

function text(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('execution_final_candidate_invalid');
  }
  return value;
}

function hash(value: unknown): string {
  const result = text(value);
  if (!/^sha256:[0-9a-f]{64}$/u.test(result)) {
    fail('execution_final_candidate_invalid');
  }
  return result;
}

function records(value: unknown): JsonRecord[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isRecord)) {
    fail('execution_final_candidate_invalid');
  }
  return value;
}

function stringSet(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((item) => typeof item === 'string')
  ) {
    fail('execution_final_candidate_invalid');
  }
  const normalized = uniqueSorted(value.map(text));
  if (normalized.length !== value.length) {
    fail('execution_final_candidate_duplicate_id');
  }
  return normalized;
}

function uniqueById<T>(records: T[], id: (record: T) => string): T[] {
  const sorted = [...records].sort((left, right) => id(left).localeCompare(id(right)));
  if (new Set(sorted.map(id)).size !== sorted.length) {
    fail('execution_final_candidate_duplicate_id');
  }
  return sorted;
}

function dimensionsFor(profile: GoalProfile): string[] {
  return profile === 'requirements_backed'
    ? [
        'requirement_confirmation',
        'architecture_confirmation',
        'implementation_readiness',
        'execution_closure',
        'audit_review',
        'delivery_confirmation',
      ].sort()
    : ['execution_closure', 'audit_review', 'delivery_confirmation'].sort();
}

function semanticCandidateView(
  candidate: Omit<ExecutionFinalCandidate, 'executionFinalCandidateHash'>
) {
  return {
    ...candidate,
    artifacts: candidate.artifacts.map(({ path: _path, ...artifact }) => artifact),
    evidence: candidate.evidence.map(({ path: _path, ...evidence }) => evidence),
  };
}

export function compileExecutionFinalCandidate(input: JsonRecord): ExecutionFinalCandidate {
  const profile = input.profile;
  if (profile !== 'requirements_backed' && profile !== 'standalone') {
    fail('execution_final_candidate_invalid');
  }
  const requirementsLineage = isRecord(input.requirementsLineage)
    ? input.requirementsLineage
    : undefined;
  const standaloneLineage = isRecord(input.standaloneLineage) ? input.standaloneLineage : undefined;
  if (
    (profile === 'requirements_backed' && (!requirementsLineage || standaloneLineage)) ||
    (profile === 'standalone' && (!standaloneLineage || requirementsLineage))
  ) {
    fail('execution_final_candidate_lineage_invalid');
  }

  const artifacts = uniqueById(
    records(input.artifacts).map((record) => ({
      artifactId: text(record.artifactId),
      artifactKind: text(record.artifactKind),
      path: text(record.path),
      hash: hash(record.hash),
    })),
    (record) => record.artifactId
  );
  const executionResults = uniqueById(
    records(input.executionResults).map((record) => ({
      executionResultId: text(record.executionResultId),
      executionAuthorityId: text(record.executionAuthorityId),
      closureHash: hash(record.closureHash),
    })),
    (record) => record.executionResultId
  );
  const commands = uniqueById(
    records(input.commands).map((record) => ({
      commandId: text(record.commandId),
      normalizedInvocationHash: hash(record.normalizedInvocationHash),
    })),
    (record) => record.commandId
  );
  const evidence = uniqueById(
    records(input.evidence).map((record) => ({
      evidenceId: text(record.evidenceId),
      evidenceKind: text(record.evidenceKind),
      path: text(record.path),
      hash: hash(record.hash),
    })),
    (record) => record.evidenceId
  );
  const evidenceIds = new Set(evidence.map((record) => record.evidenceId));
  const deliveryClaims = uniqueById(
    records(input.deliveryClaims).map((record) => {
      const claimEvidenceIds = stringSet(record.evidenceIds);
      if (claimEvidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId))) {
        fail('execution_final_candidate_evidence_ref_invalid');
      }
      return {
        deliveryClaimId: text(record.deliveryClaimId),
        claimHash: hash(record.claimHash),
        evidenceIds: claimEvidenceIds,
      };
    }),
    (record) => record.deliveryClaimId
  );

  const payload: Omit<ExecutionFinalCandidate, 'executionFinalCandidateHash'> = {
    schemaVersion: 'ExecutionFinalCandidate/v1',
    profile,
    goalId: text(input.goalId),
    goalExecutionIRHash: hash(input.goalExecutionIRHash),
    ...(requirementsLineage ? { requirementsLineage } : { standaloneLineage: standaloneLineage! }),
    activeRunPointerHash: hash(input.activeRunPointerHash),
    activationRecordHash: hash(input.activationRecordHash),
    executionPackageHashes: stringSet(input.executionPackageHashes).map(hash),
    campaignClosureHash: hash(input.campaignClosureHash),
    implementationContextHash: hash(input.implementationContextHash),
    requiredDimensionIds: dimensionsFor(profile),
    requiredArtifactIds: artifacts.map((record) => record.artifactId),
    requiredObligationIds: stringSet(input.obligationIds),
    requiredExecutionResultIds: executionResults.map((record) => record.executionResultId),
    requiredCommandIds: commands.map((record) => record.commandId),
    requiredEvidenceIds: evidence.map((record) => record.evidenceId),
    requiredDeliveryClaimIds: deliveryClaims.map((record) => record.deliveryClaimId),
    artifacts,
    executionResults,
    commands,
    evidence,
    deliveryClaims,
  };
  return Object.freeze({
    ...payload,
    executionFinalCandidateHash: stableHash(semanticCandidateView(payload)),
  });
}

export function validateExecutionFinalCandidate(value: unknown): ExecutionFinalCandidate {
  if (!isRecord(value)) {
    fail('execution_final_candidate_invalid');
  }
  const compiled = compileExecutionFinalCandidate({
    profile: value.profile,
    goalId: value.goalId,
    goalExecutionIRHash: value.goalExecutionIRHash,
    requirementsLineage: value.requirementsLineage,
    standaloneLineage: value.standaloneLineage,
    activeRunPointerHash: value.activeRunPointerHash,
    activationRecordHash: value.activationRecordHash,
    executionPackageHashes: value.executionPackageHashes,
    campaignClosureHash: value.campaignClosureHash,
    implementationContextHash: value.implementationContextHash,
    artifacts: value.artifacts,
    obligationIds: value.requiredObligationIds,
    executionResults: value.executionResults,
    commands: value.commands,
    evidence: value.evidence,
    deliveryClaims: value.deliveryClaims,
  });
  if (stableHash(value) !== stableHash(compiled)) {
    fail('execution_final_candidate_hash_mismatch');
  }
  return value as ExecutionFinalCandidate;
}
