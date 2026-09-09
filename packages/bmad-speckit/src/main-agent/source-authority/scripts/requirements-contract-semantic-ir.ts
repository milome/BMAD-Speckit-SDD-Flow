import {
  requirementsContractDomainHash,
  scopeSemanticHash,
  semanticRevisionId,
} from './requirements-contract-hash-domains';
import {
  createSpecSpanRegistry,
  resolveEvidenceClaimAuthority,
  resolveRequirementsSpecSpanSourceNodeIds,
  specSpanRegistryHash,
  type RequirementsAuthorityClass,
  type RequirementsSpecSpan,
} from './requirements-contract-span-registry';
import { assertTypedSourceAtomRoles, resolveTypedSourceAuthority, resolveTypedSourceCoverage,
  type RequirementsTypedSourceAuthority } from './requirements-contract-typed-source-semantics';
import { resolveTypedTechnicalDeclarations } from './requirements-contract-technical-planning-capability';
import { stableStringify } from './requirements-contract-semantic-resolver';
import { encodeGoalSemanticDictionary, decodeGoalSemanticDictionary, type GoalSemanticDictionary } from '../../../utils/goal-contract/control-plane/goal-semantic-dictionary';
import { expandRequirementsTypedDictionaries, restoreRequirementsTypedDictionaries } from './requirements-contract-typed-dictionary-expansion';

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
  authorityKind?: 'source_declared' | 'derived';
  applicableSourceRefs?: string[];
  conditions?: unknown[];
  scope?: Record<string, unknown>;
  modality?: 'required' | 'suggested' | 'prohibited' | 'template' | 'context';
  sourceDeclarationRefs?: string[];
  coverageRole?: 'action_trace' | 'non_action_declaration';
  declarationRole?: string;
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
  schemaVersion: 'requirements-contract-semantic-ir/v1' | 'requirements-contract-semantic-ir/v2';
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

export interface RequirementsSemanticCandidate {
  schemaVersion: 'RequirementsSemanticCandidate/v2';
  semanticRevisionId: string;
  scopeSemanticHash: string;
  semanticIr: GoalSemanticDictionary;
  candidateHash: string;
}

export function normalizeRequirementsContractSemanticIrAuthority(ir: RequirementsContractSemanticIr): RequirementsContractSemanticIr | RequirementsSemanticCandidate {
  const validation = validateRequirementsContractSemanticIr(ir);
  if (validation.decision !== 'pass') throw new Error(validation.issueCodes[0] || 'requirements_semantic_candidate_ir_invalid');
  if (ir.schemaVersion === 'requirements-contract-semantic-ir/v1') return ir;
  const payload = { schemaVersion: 'RequirementsSemanticCandidate/v2' as const,
    semanticRevisionId: ir.semanticRevisionId, scopeSemanticHash: ir.scopeSemanticHash,
    semanticIr: encodeGoalSemanticDictionary(expandRequirementsTypedDictionaries(ir)) };
  return { ...payload, candidateHash: requirementsContractDomainHash('requirements-semantic-candidate/v2', payload) };
}

export function resolveRequirementsContractSemanticIrAuthority(value: unknown): RequirementsContractSemanticIr {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('requirements_semantic_authority_invalid');
  const candidate = value as RequirementsSemanticCandidate;
  if (candidate.schemaVersion !== 'RequirementsSemanticCandidate/v2') {
    const ir = value as RequirementsContractSemanticIr;
    if (ir.schemaVersion !== 'requirements-contract-semantic-ir/v1') throw new Error('requirements_semantic_authority_candidate_required');
    const validation = validateRequirementsContractSemanticIr(ir);
    if (validation.decision !== 'pass') throw new Error(validation.issueCodes[0] || 'requirements_semantic_authority_invalid');
    return ir;
  }
  if (Object.keys(candidate).sort().join('|') !== ['schemaVersion', 'semanticRevisionId', 'scopeSemanticHash', 'semanticIr', 'candidateHash'].sort().join('|')) {
    throw new Error('requirements_semantic_candidate_fields_invalid');
  }
  const { candidateHash, ...payload } = candidate;
  if (candidateHash !== requirementsContractDomainHash('requirements-semantic-candidate/v2', payload)) throw new Error('requirements_semantic_candidate_hash_mismatch');
  const ir = restoreRequirementsTypedDictionaries(decodeGoalSemanticDictionary(candidate.semanticIr)) as RequirementsContractSemanticIr;
  if (ir.schemaVersion !== 'requirements-contract-semantic-ir/v2' || ir.semanticRevisionId !== candidate.semanticRevisionId ||
    ir.scopeSemanticHash !== candidate.scopeSemanticHash) throw new Error('requirements_semantic_candidate_identity_mismatch');
  const validation = validateRequirementsContractSemanticIr(ir);
  if (validation.decision !== 'pass') throw new Error(validation.issueCodes[0] || 'requirements_semantic_candidate_ir_invalid');
  return ir;
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

function stringRefs(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
}

function hasScopeOwner(scope: Record<string, unknown>): boolean {
  return ['owner', 'ownerId', 'authorityRef'].some((key) =>
    typeof scope[key] === 'string' && String(scope[key]).length > 0
  );
}

function assertTypedSourceClaimConservation(semantics: Record<string, unknown>, claims: RequirementsEvidenceClaim[], spans: RequirementsSpecSpan[]): void {
  const authority = semantics.typedSourceAuthority as RequirementsTypedSourceAuthority | undefined;
  if (!authority) {
    if (spans.some((span) => span.boundTypedSourceGraphHash !== undefined)) throw new Error('semantic_ir_typed_span_version_required');
    return;
  }
  const sourceClaims = claims.filter((claim) => claim.authorityClass === 'source_grounded');
  const sourceSpans = spans.filter((span) => span.authorityClass === 'source_grounded');
  if (sourceClaims.length !== 1 || sourceSpans.length !== 1 ||
    sourceClaims[0].evidenceClaimId !== 'EVIDENCE-CLAIM-TYPED-SOURCE-GRAPH' ||
    sourceClaims[0].normalizedClaimHash !== authority.graphHash ||
    sourceSpans[0].boundTypedSourceGraphHash !== authority.graphHash ||
    stableStringify(sourceSpans[0].evidenceClaimRefs) !== stableStringify([sourceClaims[0].evidenceClaimId])) {
    throw new Error('semantic_ir_typed_source_claim_conservation_failed');
  }
  resolveRequirementsSpecSpanSourceNodeIds(sourceSpans[0], authority);
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
      ...(constraint.applicableSourceRefs ? { applicableSourceRefs: sortedUnique(constraint.applicableSourceRefs) } : {}),
      ...(constraint.sourceDeclarationRefs ? { sourceDeclarationRefs: sortedUnique(constraint.sourceDeclarationRefs) } : {}),
    }))
    .sort((left, right) => left.constraintId.localeCompare(right.constraintId));
  return {
    executionConstraints,
    executionConstraintRegistryHash: requirementsContractDomainHash(
      executionConstraints.some((constraint) => constraint.authorityKind)
        ? 'requirements-execution-constraint-registry/v2' : 'requirements-execution-constraint-registry/v1',
      executionConstraints
    ),
  };
}

function assertTypedExecutionProofs(semantics: Record<string, unknown>, constraints: RequirementsExecutionConstraint[]): void {
  const authority = semantics.typedSourceAuthority as RequirementsTypedSourceAuthority;
  resolveTypedSourceCoverage(semantics.typedCoverage, authority);
  const commandConstraints = constraints.filter((constraint) => constraint.kind === 'CMD');
  const stampedCommands = commandConstraints.filter(
    (constraint) => constraint.coverageRole !== undefined && constraint.declarationRole !== undefined
  );
  if (stampedCommands.length !== 0 && stampedCommands.length !== commandConstraints.length) {
    throw new Error('requirements_typed_constraint_role_profile_mixed');
  }
  const expected = resolveTypedTechnicalDeclarations(authority, {
    commandSemantics: stampedCommands.length === 0 ? 'legacy_v2' : 'normalized',
  });
  const byId = new Map(expected.map((entry) => [entry.id, entry]));
  if (constraints.length !== expected.length) throw new Error('requirements_typed_constraint_source_set_mismatch');
  for (const constraint of constraints) {
    const entry = byId.get(constraint.constraintId);
    if (!entry || constraint.authorityKind !== 'source_declared' || constraint.disposition !== 'proven') {
      throw new Error('requirements_typed_constraint_source_proof_missing');
    }
    const actual = { kind: constraint.kind, id: constraint.constraintId, value: constraint.canonicalValue,
      authorityKind: constraint.authorityKind, applicableSourceRefs: constraint.applicableSourceRefs,
      premiseRefs: constraint.premiseRefs, derivationReceiptRefs: constraint.derivationReceiptRefs,
      conditions: constraint.conditions, scope: constraint.scope, modality: constraint.modality,
      sourceDeclarationRefs: constraint.sourceDeclarationRefs };
    const { coverageRole, declarationRole, ...expectedProof } = entry;
    const optionalRolesMismatch =
      (constraint.coverageRole !== undefined && constraint.coverageRole !== coverageRole) ||
      (constraint.declarationRole !== undefined && constraint.declarationRole !== declarationRole);
    // Older confirmed v2 candidates omit these derivable roles; new producers persist and prove them.
    if (stableStringify(actual) !== stableStringify(expectedProof) || optionalRolesMismatch ||
      stableStringify(sortedUnique(constraint.applicableMustRefs)) !== stableStringify(entry.applicableSourceRefs) ||
      stableStringify(sortedUnique(constraint.applicableAtomRefs)) !== stableStringify(entry.applicableSourceRefs!.map((id) => `${id}-A1`).sort())) {
      throw new Error('requirements_typed_constraint_source_proof_mismatch');
    }
  }
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
    const mustRefs = stringRefs(constraint.applicableMustRefs);
    const scope = constraint.scope && typeof constraint.scope === 'object' && !Array.isArray(constraint.scope)
      ? constraint.scope as Record<string, unknown>
      : {};
    const typedConstraint = constraint.authorityKind === 'source_declared' ||
      constraint.authorityKind === 'derived';
    if (typedConstraint) {
      const sourceDeclarationRefs = stringRefs(constraint.sourceDeclarationRefs);
      const premiseRefs = new Set(stringRefs(constraint.premiseRefs));
      if (sourceDeclarationRefs.length === 0 ||
        sourceDeclarationRefs.some((ref) => !premiseRefs.has(ref))) {
        issueCodes.push('execution_constraint_source_declaration_missing');
      }
      const applicableSourceRefs = stringRefs(constraint.applicableSourceRefs);
      const sourceRefSet = new Set(applicableSourceRefs);
      if (mustRefs.some((ref) => !sourceRefSet.has(ref))) {
        issueCodes.push('execution_constraint_applicability_ref_invalid');
      }
      if (constraint.coverageRole === 'action_trace') {
        const expectedAtomRefs = applicableSourceRefs.map((ref) => `${ref}-A1`).sort();
        if (stableStringify(sortedUnique(stringRefs(constraint.applicableAtomRefs))) !==
          stableStringify(expectedAtomRefs)) {
          issueCodes.push('execution_constraint_applicability_ref_invalid');
        }
      }
      if (typeof scope.kind !== 'string' || scope.kind.length === 0 || !hasScopeOwner(scope)) {
        issueCodes.push('execution_constraint_scope_owner_missing');
      }
    }
    if (scope.kind === 'global' &&
      (typeof scope.authorityRef !== 'string' || scope.authorityRef.length === 0)) {
      issueCodes.push('execution_constraint_global_authority_missing');
    }
    if ('observedEvidenceRefs' in constraint) {
      issueCodes.push('execution_constraint_observed_evidence_forbidden');
    }
    if (
      constraint.disposition === 'proven' &&
      (!Array.isArray(constraint.premiseRefs) || constraint.premiseRefs.length === 0)
    ) {
      issueCodes.push('execution_constraint_proven_premise_missing');
    }
    if (constraint.disposition === 'proven' && constraint.authorityKind === 'derived' &&
      (!Array.isArray(constraint.derivationReceiptRefs) || constraint.derivationReceiptRefs.length === 0)) {
      issueCodes.push('execution_constraint_proven_derivation_missing');
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
  assertTypedSourceAtomRoles(input.semantics);
  const typed = !!input.semantics.typedSourceAuthority;
  if (!typed && input.semantics.schemaVersion === 'requirements-contract-typed-source-semantics/v2') {
    throw new Error('requirements_typed_source_authority_missing');
  }
  if (typed) {
    resolveTypedSourceAuthority(input.semantics.typedSourceAuthority);
    assertTypedExecutionProofs(input.semantics, input.executionConstraints);
  }
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
  assertTypedSourceClaimConservation(input.semantics, evidenceClaims, specSpanRegistry);
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
    schemaVersion: typed ? 'requirements-contract-semantic-ir/v2' : 'requirements-contract-semantic-ir/v1',
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
  if (!['requirements-contract-semantic-ir/v1', 'requirements-contract-semantic-ir/v2'].includes(String(ir.schemaVersion))) {
    issueCodes.push('semantic_ir_schema_version_invalid');
  }
  if (!ir.semanticPayload || typeof ir.semanticPayload !== 'object') {
    issueCodes.push('semantic_ir_payload_invalid');
  } else {
    const payload = ir.semanticPayload as RequirementsContractSemanticIr['semanticPayload'];
    if (ir.schemaVersion === 'requirements-contract-semantic-ir/v1' &&
      (payload.semantics?.typedSourceAuthority || payload.semantics?.schemaVersion === 'requirements-contract-typed-source-semantics/v2')) {
      issueCodes.push('semantic_ir_typed_source_version_required');
    }
    if (ir.schemaVersion === 'requirements-contract-semantic-ir/v2') {
      try { resolveTypedSourceAuthority(payload.semantics?.typedSourceAuthority); assertTypedSourceAtomRoles(payload.semantics);
        assertTypedExecutionProofs(payload.semantics, payload.executionConstraints);
        assertTypedSourceClaimConservation(payload.semantics, payload.evidenceClaims, payload.specSpanRegistry); }
      catch (error) { issueCodes.push(error instanceof Error ? error.message : 'semantic_ir_typed_source_invalid'); }
    }
    if (ir.schemaVersion === 'requirements-contract-semantic-ir/v1' && payload.specSpanRegistry?.some((span) => span.boundTypedSourceGraphHash !== undefined)) {
      issueCodes.push('semantic_ir_typed_span_version_required');
    }
    if (ir.scopeSemanticHash !== scopeSemanticHash(payload)) issueCodes.push('semantic_ir_scope_hash_mismatch');
    const constraints = validateExecutionConstraintRegistry(payload);
    issueCodes.push(...constraints.issueCodes);
  }
  if (!SHA256.test(String(ir.scopeSemanticHash ?? ''))) issueCodes.push('semantic_ir_scope_hash_invalid');
  return { decision: issueCodes.length ? 'block' as const : 'pass' as const, issueCodes: sortedUnique(issueCodes) };
}
