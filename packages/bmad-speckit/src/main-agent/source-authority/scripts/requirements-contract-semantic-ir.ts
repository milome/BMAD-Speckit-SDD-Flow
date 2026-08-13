import {
  requirementsContractDomainHash,
  scopeSemanticHash,
  semanticRevisionId,
} from './requirements-contract-hash-domains';
import {
  createSpecSpanRegistry,
  resolveEvidenceClaimAuthority,
  specSpanRegistryHash,
  type RequirementsAuthorityClass,
  type RequirementsSpecSpan,
} from './requirements-contract-span-registry';

export const REQUIREMENTS_EXECUTION_CONSTRAINT_KINDS = [
  'PATH', 'CMD', 'ART', 'CTM', 'EVDREQ', 'STOP',
] as const;

export interface RequirementsExecutionConstraint {
  constraintId: string;
  kind: (typeof REQUIREMENTS_EXECUTION_CONSTRAINT_KINDS)[number];
  canonicalValue: string;
  applicableMustRefs: string[];
  applicableAtomRefs: string[];
  premiseRefs: string[];
  derivationReceiptRefs: string[];
  disposition: 'proven' | 'unresolved';
}

export interface RequirementsEvidenceClaim {
  evidenceClaimId: string;
  authorityClass: RequirementsAuthorityClass;
  normalizedClaimHash: string;
  sourceEvidenceRequired?: boolean;
  decisionReceiptRefs: string[];
  premiseRefs: string[];
  derivationReceiptRefs: string[];
}

export interface RequirementsContractSemanticIr {
  schemaVersion: 'requirements-contract-semantic-ir/v1';
  recordId: string;
  requestId: string;
  semanticRevisionId: string;
  parentSemanticRevisionId: string | null;
  compilerVersion: string;
  scopeSemanticHash: string;
  semanticPayload: {
    semantics: Record<string, unknown>;
    evidenceClaims: RequirementsEvidenceClaim[];
    evidenceClaimRegistryHash: string;
    specSpanRegistry: RequirementsSpecSpan[];
    specSpanRegistryHash: string;
    executionConstraints: RequirementsExecutionConstraint[];
    executionConstraintRegistryHash: string;
    semanticProvenance: Record<string, string>;
  };
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const PHYSICAL_KEYS = new Set([
  'sourceBindingHash', 'bindingRevisionId', 'sourceSnapshotHash', 'sourceArtifactId',
  'sourceSpanId', 'sourceSpanRefs', 'startByte', 'endByteExclusive', 'startLine',
  'startColumn', 'endLine', 'endColumn', 'exactTextHash', 'sourcePath', 'physicalLocator',
]);

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function containsPhysicalKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsPhysicalKey);
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => PHYSICAL_KEYS.has(key) || containsPhysicalKey(child)
  );
}

export function createExecutionConstraintRegistry(
  constraints: RequirementsExecutionConstraint[]
): { executionConstraints: RequirementsExecutionConstraint[]; executionConstraintRegistryHash: string } {
  const executionConstraints = constraints
    .map((constraint) => ({
      ...constraint,
      applicableMustRefs: sortedUnique(constraint.applicableMustRefs),
      applicableAtomRefs: sortedUnique(constraint.applicableAtomRefs),
      premiseRefs: sortedUnique(constraint.premiseRefs),
      derivationReceiptRefs: sortedUnique(constraint.derivationReceiptRefs),
    }))
    .sort((left, right) => left.constraintId.localeCompare(right.constraintId));
  return {
    executionConstraints,
    executionConstraintRegistryHash: requirementsContractDomainHash(
      'requirements-execution-constraint-registry/v1',
      executionConstraints
    ),
  };
}

export function validateExecutionConstraintRegistry(value: unknown) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decision: 'block' as const, issueCodes: ['execution_constraint_registry_invalid'] };
  }
  const registry = value as Record<string, unknown>;
  const constraints = Array.isArray(registry.executionConstraints)
    ? (registry.executionConstraints as Array<Record<string, unknown>>)
    : [];
  if (!Array.isArray(registry.executionConstraints)) issueCodes.push('execution_constraint_registry_invalid');
  const ids = new Set<string>();
  for (const constraint of constraints) {
    const id = String(constraint.constraintId ?? '');
    const kind = String(constraint.kind ?? '');
    if (!REQUIREMENTS_EXECUTION_CONSTRAINT_KINDS.includes(kind as never) || !id.startsWith(`${kind}-`)) {
      issueCodes.push('execution_constraint_kind_identity_invalid');
    }
    if (ids.has(id)) issueCodes.push('execution_constraint_identity_duplicate');
    ids.add(id);
    if ('observedEvidenceRefs' in constraint) {
      issueCodes.push('execution_constraint_observed_evidence_forbidden');
    }
    if (
      constraint.disposition === 'proven' &&
      (!Array.isArray(constraint.premiseRefs) || constraint.premiseRefs.length === 0)
    ) {
      issueCodes.push('execution_constraint_proven_premise_missing');
    }
  }
  const expected = createExecutionConstraintRegistry(
    constraints as unknown as RequirementsExecutionConstraint[]
  ).executionConstraintRegistryHash;
  if (registry.executionConstraintRegistryHash !== expected) {
    issueCodes.push('execution_constraint_registry_hash_mismatch');
  }
  return { decision: issueCodes.length ? 'block' as const : 'pass' as const, issueCodes: sortedUnique(issueCodes) };
}

function normalizeEvidenceClaims(claims: RequirementsEvidenceClaim[]): RequirementsEvidenceClaim[] {
  return claims
    .map((claim) => ({
      ...claim,
      decisionReceiptRefs: sortedUnique(claim.decisionReceiptRefs),
      premiseRefs: sortedUnique(claim.premiseRefs),
      derivationReceiptRefs: sortedUnique(claim.derivationReceiptRefs),
    }))
    .sort((left, right) => left.evidenceClaimId.localeCompare(right.evidenceClaimId));
}

export function createRequirementsContractSemanticIr(input: {
  recordId: string;
  requestId: string;
  parentSemanticRevisionId: string | null;
  compilerVersion: string;
  semantics: Record<string, unknown>;
  evidenceClaims: RequirementsEvidenceClaim[];
  specSpanRegistry: Array<Omit<RequirementsSpecSpan, 'specSpanId'> & { specSpanId?: string }>;
  executionConstraints: RequirementsExecutionConstraint[];
  semanticProvenance: Record<string, string>;
}): RequirementsContractSemanticIr {
  if (containsPhysicalKey(input)) throw new Error('semantic_ir_physical_binding_forbidden');
  const evidenceClaims = normalizeEvidenceClaims(input.evidenceClaims);
  for (const claim of evidenceClaims) {
    if (claim.authorityClass === 'source_grounded') {
      if (claim.sourceEvidenceRequired !== true) {
        throw new Error('source_grounded_evidence_claim_requirement_missing');
      }
      continue;
    }
    const resolution = resolveEvidenceClaimAuthority(claim);
    if (resolution.decision === 'block') throw new Error(resolution.issueCodes[0]);
  }
  const specSpanRegistry = createSpecSpanRegistry(input.specSpanRegistry);
  const constraints = createExecutionConstraintRegistry(input.executionConstraints);
  const constraintValidation = validateExecutionConstraintRegistry(constraints);
  if (constraintValidation.decision === 'block') throw new Error(constraintValidation.issueCodes[0]);
  const semanticPayload = {
    semantics: input.semantics,
    evidenceClaims,
    evidenceClaimRegistryHash: requirementsContractDomainHash(
      'requirements-evidence-claim-registry/v1', evidenceClaims
    ),
    specSpanRegistry,
    specSpanRegistryHash: specSpanRegistryHash(specSpanRegistry),
    ...constraints,
    semanticProvenance: input.semanticProvenance,
  };
  const semanticHash = scopeSemanticHash(semanticPayload);
  return {
    schemaVersion: 'requirements-contract-semantic-ir/v1',
    recordId: input.recordId,
    requestId: input.requestId,
    semanticRevisionId: semanticRevisionId({
      recordId: input.recordId,
      parentSemanticRevisionId: input.parentSemanticRevisionId,
      scopeSemanticHash: semanticHash,
      compilerVersion: input.compilerVersion,
    }),
    parentSemanticRevisionId: input.parentSemanticRevisionId,
    compilerVersion: input.compilerVersion,
    scopeSemanticHash: semanticHash,
    semanticPayload,
  };
}

export function validateRequirementsContractSemanticIr(value: unknown) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decision: 'block' as const, issueCodes: ['semantic_ir_invalid'] };
  }
  if (containsPhysicalKey(value)) issueCodes.push('semantic_ir_physical_binding_forbidden');
  const ir = value as Partial<RequirementsContractSemanticIr> & Record<string, unknown>;
  const allowed = new Set([
    'schemaVersion', 'recordId', 'requestId', 'semanticRevisionId', 'parentSemanticRevisionId',
    'compilerVersion', 'scopeSemanticHash', 'semanticPayload',
  ]);
  if (Object.keys(ir).some((key) => !allowed.has(key))) issueCodes.push('semantic_ir_unknown_field');
  if (ir.schemaVersion !== 'requirements-contract-semantic-ir/v1') issueCodes.push('semantic_ir_schema_version_invalid');
  if (!ir.semanticPayload || typeof ir.semanticPayload !== 'object') {
    issueCodes.push('semantic_ir_payload_invalid');
  } else {
    const payload = ir.semanticPayload as RequirementsContractSemanticIr['semanticPayload'];
    if (ir.scopeSemanticHash !== scopeSemanticHash(payload)) issueCodes.push('semantic_ir_scope_hash_mismatch');
    const constraints = validateExecutionConstraintRegistry(payload);
    issueCodes.push(...constraints.issueCodes);
  }
  if (!SHA256.test(String(ir.scopeSemanticHash ?? ''))) issueCodes.push('semantic_ir_scope_hash_invalid');
  return { decision: issueCodes.length ? 'block' as const : 'pass' as const, issueCodes: sortedUnique(issueCodes) };
}
