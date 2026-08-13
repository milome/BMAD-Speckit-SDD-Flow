import path from 'node:path';
import {
  canonicalRequirementsJson,
  requirementsContractDomainHash,
} from './requirements-contract-hash-domains';
import {
  requirementsRemediationStepHash,
  validateRequirementsContractRemediationPlan,
  type RequirementsContractRemediationPlan,
} from './requirements-contract-remediation-plan';

export interface RequirementsRemediationStepRef {
  stepId: string;
  stepHash: string;
  finalDisposition: string;
}

export interface RequirementsContractRemediationDelta {
  schemaVersion: 'requirements-remediation-delta/v1';
  remediationPlanHash: string;
  remediatesRequestHash: string;
  remediationAggregateHash: string;
  executedRepairStepRefs: RequirementsRemediationStepRef[];
  deferredRepairStepRefs: RequirementsRemediationStepRef[];
  authorityBasisRefs: string[];
  findingDispositionRefs: string[];
  affectedIds: string[];
  earliestAffectedStage: string;
  latestValidPredecessorCheckpoint: string | null;
  beforeState: Record<string, string>;
  afterState: Record<string, string>;
  changedArtifactRoles: string[];
  compilerIdentity: string;
  remediationDeltaHash: string;
}

export interface RequirementsRemediationChangedArtifactReadback {
  role: string;
  recordRelativePath: string;
  artifactHash: string;
}

export interface RequirementsRemediationDeltaReadbackContext {
  authoringAttemptId: string;
  stagingRoot: string;
  authorityBasisRefs: string[];
  findingDispositionRefs: string[];
  latestValidPredecessorCheckpoint: string | null;
  beforeState: Record<string, string>;
  afterState: Record<string, string>;
  changedArtifacts: RequirementsRemediationChangedArtifactReadback[];
}

export interface RequirementsRemediationDeltaValidationContext {
  remediationPlan: RequirementsContractRemediationPlan;
  readback?: RequirementsRemediationDeltaReadbackContext;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const DELTA_KEYS = new Set([
  'schemaVersion', 'remediationPlanHash', 'remediatesRequestHash', 'remediationAggregateHash',
  'executedRepairStepRefs', 'deferredRepairStepRefs', 'authorityBasisRefs',
  'findingDispositionRefs', 'affectedIds', 'earliestAffectedStage',
  'latestValidPredecessorCheckpoint', 'beforeState', 'afterState', 'changedArtifactRoles',
  'compilerIdentity', 'remediationDeltaHash',
]);

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function canonicalStepRefs(refs: RequirementsRemediationStepRef[]): RequirementsRemediationStepRef[] {
  return [...refs]
    .map((ref) => ({
      stepId: ref.stepId,
      stepHash: ref.stepHash,
      finalDisposition: ref.finalDisposition,
    }))
    .sort((left, right) => left.stepId.localeCompare(right.stepId));
}

function validStagingOwnership(ownership: RequirementsRemediationDeltaReadbackContext): boolean {
  const expected = `authoring/staging/${ownership.authoringAttemptId}`;
  return (
    ownership.stagingRoot === expected &&
    path.posix.normalize(ownership.stagingRoot) === ownership.stagingRoot &&
    !ownership.stagingRoot.includes('\\')
  );
}

function validOwnedArtifactPath(stagingRoot: string, artifactPath: string): boolean {
  if (artifactPath.includes('\\') || path.posix.normalize(artifactPath) !== artifactPath) return false;
  const relative = path.posix.relative(stagingRoot, artifactPath);
  return relative.length > 0 && relative !== '..' && !relative.startsWith('../') && !path.posix.isAbsolute(relative);
}

function canonicallyEqual(left: unknown, right: unknown): boolean {
  return canonicalRequirementsJson(left) === canonicalRequirementsJson(right);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return canonicallyEqual(sortedUnique(left), sortedUnique(right));
}

function validatePlanBinding(
  delta: RequirementsContractRemediationDelta,
  plan: RequirementsContractRemediationPlan,
  issueCodes: string[]
): void {
  if (validateRequirementsContractRemediationPlan(plan).decision === 'block') {
    issueCodes.push('remediation_delta_plan_invalid');
    return;
  }
  if (delta.remediationPlanHash !== plan.remediationPlanHash) issueCodes.push('remediation_delta_plan_hash_mismatch');
  if (
    delta.remediatesRequestHash !== plan.remediatesRequestHash ||
    delta.remediationAggregateHash !== plan.remediationAggregateHash
  ) {
    issueCodes.push('remediation_delta_plan_authority_mismatch');
  }

  const planSteps = new Map(plan.repairSteps.map((step) => [step.stepId, step]));
  const executedRefs = delta.executedRepairStepRefs ?? [];
  const deferredRefs = delta.deferredRepairStepRefs ?? [];
  const allRefs = [...executedRefs, ...deferredRefs];
  const refIds = allRefs.map((ref) => ref.stepId);
  if (
    new Set(refIds).size !== refIds.length ||
    !sameSet(refIds, [...planSteps.keys()])
  ) {
    issueCodes.push('remediation_delta_step_partition_invalid');
  }
  for (const ref of allRefs) {
    const step = planSteps.get(ref.stepId);
    if (step && ref.stepHash !== requirementsRemediationStepHash(step)) {
      issueCodes.push('remediation_delta_step_hash_mismatch');
    }
  }
  if (executedRefs.some((ref) => ref.finalDisposition !== 'executed')) {
    issueCodes.push('remediation_delta_step_disposition_invalid');
  }
  if (deferredRefs.some((ref) => ref.finalDisposition !== 'deferred')) {
    issueCodes.push('remediation_delta_step_disposition_invalid');
  }

  if (!sameSet(delta.findingDispositionRefs ?? [], plan.findingDispositionRefs)) {
    issueCodes.push('remediation_delta_finding_coverage_invalid');
  }
  if (!sameSet(delta.authorityBasisRefs ?? [], plan.authorityBasisRefs)) {
    issueCodes.push('remediation_delta_authority_basis_mismatch');
  }
  if (!sameSet(delta.affectedIds ?? [], plan.affectedIds)) {
    issueCodes.push('remediation_delta_affected_identity_mismatch');
  }
  if (delta.earliestAffectedStage !== plan.earliestAffectedStage) {
    issueCodes.push('remediation_delta_earliest_stage_mismatch');
  }
  if (delta.latestValidPredecessorCheckpoint !== plan.latestValidPredecessorCheckpoint) {
    issueCodes.push('remediation_delta_checkpoint_mismatch');
  }
  if (!canonicallyEqual(delta.beforeState, plan.beforeState)) {
    issueCodes.push('remediation_delta_before_state_mismatch');
  }

  const expectedChangedRoles = executedRefs.flatMap(
    (ref) => planSteps.get(ref.stepId)?.expectedChangedArtifactRoles ?? []
  );
  if (!sameSet(delta.changedArtifactRoles ?? [], expectedChangedRoles)) {
    issueCodes.push('remediation_delta_changed_artifact_mismatch');
  }
}

function validateReadback(
  delta: RequirementsContractRemediationDelta,
  readback: RequirementsRemediationDeltaReadbackContext,
  issueCodes: string[]
): void {
  if (!validStagingOwnership(readback)) {
    issueCodes.push('remediation_delta_staging_ownership_invalid');
    return;
  }
  if (readback.changedArtifacts.some((artifact) => !validOwnedArtifactPath(readback.stagingRoot, artifact.recordRelativePath))) {
    issueCodes.push('remediation_delta_staging_ownership_invalid');
  }
  if (!sameSet(delta.authorityBasisRefs ?? [], readback.authorityBasisRefs)) {
    issueCodes.push('remediation_delta_authority_basis_mismatch');
  }
  if (!sameSet(delta.findingDispositionRefs ?? [], readback.findingDispositionRefs)) {
    issueCodes.push('remediation_delta_finding_coverage_invalid');
  }
  if (delta.latestValidPredecessorCheckpoint !== readback.latestValidPredecessorCheckpoint) {
    issueCodes.push('remediation_delta_checkpoint_mismatch');
  }
  if (
    !canonicallyEqual(delta.beforeState, readback.beforeState) ||
    !canonicallyEqual(delta.afterState, readback.afterState)
  ) {
    issueCodes.push('remediation_delta_readback_state_mismatch');
  }
  const readbackRoles = readback.changedArtifacts.map((artifact) => artifact.role);
  const afterHashes = new Set(Object.values(readback.afterState));
  if (
    !sameSet(delta.changedArtifactRoles ?? [], readbackRoles) ||
    readback.changedArtifacts.some((artifact) => !SHA256.test(artifact.artifactHash) || !afterHashes.has(artifact.artifactHash))
  ) {
    issueCodes.push('remediation_delta_changed_artifact_mismatch');
  }
}

export function createRequirementsContractRemediationDelta(
  input: Omit<RequirementsContractRemediationDelta, 'schemaVersion' | 'remediationDeltaHash'>,
  context: RequirementsRemediationDeltaValidationContext
): RequirementsContractRemediationDelta {
  if (!context.readback || !validStagingOwnership(context.readback)) {
    throw new Error('remediation_delta_staging_ownership_invalid');
  }
  if (input.executedRepairStepRefs.length === 0) {
    throw new Error('remediation_delta_executed_step_required');
  }
  if (canonicalRequirementsJson(input.beforeState) === canonicalRequirementsJson(input.afterState)) {
    throw new Error('remediation_delta_empty');
  }
  if (input.changedArtifactRoles.length === 0) throw new Error('remediation_delta_changed_artifact_missing');
  const payload = {
    schemaVersion: 'requirements-remediation-delta/v1' as const,
    remediationPlanHash: input.remediationPlanHash,
    remediatesRequestHash: input.remediatesRequestHash,
    remediationAggregateHash: input.remediationAggregateHash,
    executedRepairStepRefs: canonicalStepRefs(input.executedRepairStepRefs),
    deferredRepairStepRefs: canonicalStepRefs(input.deferredRepairStepRefs),
    authorityBasisRefs: sortedUnique(input.authorityBasisRefs),
    findingDispositionRefs: sortedUnique(input.findingDispositionRefs),
    affectedIds: sortedUnique(input.affectedIds),
    earliestAffectedStage: input.earliestAffectedStage,
    latestValidPredecessorCheckpoint: input.latestValidPredecessorCheckpoint,
    beforeState: Object.fromEntries(Object.entries(input.beforeState).sort(([a], [b]) => a.localeCompare(b))),
    afterState: Object.fromEntries(Object.entries(input.afterState).sort(([a], [b]) => a.localeCompare(b))),
    changedArtifactRoles: sortedUnique(input.changedArtifactRoles),
    compilerIdentity: input.compilerIdentity,
  };
  const delta = {
    ...payload,
    remediationDeltaHash: requirementsContractDomainHash(
      'requirements-remediation-delta/v1', payload
    ),
  };
  const validation = validateRequirementsContractRemediationDelta(delta, context);
  if (validation.decision === 'block') throw new Error(validation.issueCodes[0]);
  return delta;
}

export function validateRequirementsContractRemediationDelta(
  value: unknown,
  context?: RequirementsRemediationDeltaValidationContext
) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decision: 'block' as const, issueCodes: ['remediation_delta_invalid'] };
  }
  const delta = value as RequirementsContractRemediationDelta & Record<string, unknown>;
  if (Object.keys(delta).some((key) => !DELTA_KEYS.has(key))) issueCodes.push('remediation_delta_unknown_field');
  if (delta.schemaVersion !== 'requirements-remediation-delta/v1') issueCodes.push('remediation_delta_schema_version_invalid');
  if (![delta.remediationPlanHash, delta.remediatesRequestHash, delta.remediationAggregateHash].every((hash) => SHA256.test(String(hash)))) {
    issueCodes.push('remediation_delta_authority_hash_invalid');
  }
  if (!Array.isArray(delta.executedRepairStepRefs) || delta.executedRepairStepRefs.length === 0) {
    issueCodes.push('remediation_delta_executed_step_required');
  }
  const executed = new Set((delta.executedRepairStepRefs ?? []).map((ref) => ref.stepId));
  if ((delta.deferredRepairStepRefs ?? []).some((ref) => executed.has(ref.stepId))) {
    issueCodes.push('remediation_delta_step_partition_invalid');
  }
  for (const ref of [...(delta.executedRepairStepRefs ?? []), ...(delta.deferredRepairStepRefs ?? [])]) {
    if (!SHA256.test(String(ref.stepHash))) issueCodes.push('remediation_delta_step_hash_invalid');
  }
  if (canonicalRequirementsJson(delta.beforeState) === canonicalRequirementsJson(delta.afterState)) {
    issueCodes.push('remediation_delta_empty');
  }
  if (!Array.isArray(delta.changedArtifactRoles) || delta.changedArtifactRoles.length === 0) {
    issueCodes.push('remediation_delta_changed_artifact_missing');
  }
  if (context) {
    validatePlanBinding(delta, context.remediationPlan, issueCodes);
    if (context.readback) validateReadback(delta, context.readback, issueCodes);
  }
  const { remediationDeltaHash, ...payload } = delta;
  if (
    !SHA256.test(String(remediationDeltaHash)) ||
    remediationDeltaHash !== requirementsContractDomainHash('requirements-remediation-delta/v1', payload)
  ) {
    issueCodes.push('remediation_delta_hash_mismatch');
  }
  return { decision: issueCodes.length ? 'block' as const : 'pass' as const, issueCodes: sortedUnique(issueCodes) };
}
