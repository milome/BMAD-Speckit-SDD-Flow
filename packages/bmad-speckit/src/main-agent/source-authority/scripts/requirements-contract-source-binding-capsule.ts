import {
  bindingRevisionId,
  requirementsContractDomainHash,
  sourceBindingHash,
} from './requirements-contract-hash-domains';
import {
  createSourceSpanRegistry,
  sourceSpanRegistryHash,
  type RequirementsAuthorityClass,
  type RequirementsSourceSpan,
} from './requirements-contract-span-registry';

export interface RequirementsSourceArtifactBinding {
  sourceArtifactId: string;
  role: string;
  mediaType: string;
  sourceSnapshotHash: string;
  orderedPosition: number;
  immutableBlobRef: string;
}

export interface RequirementsEvidenceClaimBinding {
  evidenceClaimId: string;
  specSpanId: string;
  authorityClass: RequirementsAuthorityClass;
  sourceSpanRefs: string[];
}

export interface RequirementsContractSourceBindingCapsule {
  schemaVersion: 'requirements-contract-source-binding/v1';
  recordId: string;
  semanticRevisionId: string;
  scopeSemanticHash: string;
  bindingRevisionId: string;
  parentBindingRevisionId: string | null;
  sourceBindingHash: string;
  resolverIdentity: string;
  sourceArtifacts: RequirementsSourceArtifactBinding[];
  sourceSpanRegistry: RequirementsSourceSpan[];
  sourceSpanRegistryHash: string;
  evidenceClaimBindings: RequirementsEvidenceClaimBinding[];
  evidenceClaimBindingRegistryHash: string;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const sortedUnique = (values: readonly string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export function createRequirementsContractSourceBindingCapsule(input: {
  recordId: string;
  semanticRevisionId: string;
  scopeSemanticHash: string;
  parentBindingRevisionId: string | null;
  resolverIdentity: string;
  sourceArtifacts: RequirementsSourceArtifactBinding[];
  sourceSpans: Array<Omit<RequirementsSourceSpan, 'sourceSpanId'> & { sourceSpanId?: string }>;
  evidenceClaimBindings: RequirementsEvidenceClaimBinding[];
}): RequirementsContractSourceBindingCapsule {
  const sourceArtifacts = [...input.sourceArtifacts].sort(
    (left, right) => left.orderedPosition - right.orderedPosition || left.sourceArtifactId.localeCompare(right.sourceArtifactId)
  );
  const artifactById = new Map(sourceArtifacts.map((artifact) => [artifact.sourceArtifactId, artifact]));
  if (artifactById.size !== sourceArtifacts.length) throw new Error('source_binding_artifact_duplicate');
  for (const artifact of sourceArtifacts) {
    if (!SHA256.test(artifact.sourceSnapshotHash)) throw new Error('source_binding_artifact_snapshot_hash_invalid');
  }
  const sourceSpanRegistry = createSourceSpanRegistry(input.sourceSpans);
  for (const span of sourceSpanRegistry) {
    const artifact = artifactById.get(span.sourceArtifactId);
    if (!artifact) throw new Error('source_binding_artifact_missing');
    if (artifact.sourceSnapshotHash !== span.sourceSnapshotHash) {
      throw new Error('source_binding_snapshot_hash_mismatch');
    }
  }
  const spanIds = new Set(sourceSpanRegistry.map((span) => span.sourceSpanId));
  const consumedSpanIds = new Set<string>();
  const evidenceClaimBindings = input.evidenceClaimBindings
    .map((binding) => {
      if (binding.authorityClass !== 'source_grounded' && binding.sourceSpanRefs.length > 0) {
        throw new Error('non_source_claim_physical_span_forbidden');
      }
      const sourceSpanRefs = sortedUnique(binding.sourceSpanRefs);
      if (binding.authorityClass === 'source_grounded' && sourceSpanRefs.length === 0) {
        throw new Error('source_grounded_span_missing');
      }
      if (sourceSpanRefs.some((ref) => !spanIds.has(ref))) throw new Error('source_binding_orphan_span_ref');
      sourceSpanRefs.forEach((ref) => consumedSpanIds.add(ref));
      return { ...binding, sourceSpanRefs };
    })
    .sort((left, right) => left.evidenceClaimId.localeCompare(right.evidenceClaimId));
  if (sourceSpanRegistry.some((span) => !consumedSpanIds.has(span.sourceSpanId))) {
    throw new Error('source_binding_orphan_span');
  }
  const bindingPayload = {
    semanticRevisionId: input.semanticRevisionId,
    scopeSemanticHash: input.scopeSemanticHash,
    parentBindingRevisionId: input.parentBindingRevisionId,
    resolverIdentity: input.resolverIdentity,
    sourceArtifacts,
    sourceSpanRegistry,
    sourceSpanRegistryHash: sourceSpanRegistryHash(sourceSpanRegistry),
    evidenceClaimBindings,
    evidenceClaimBindingRegistryHash: requirementsContractDomainHash(
      'requirements-evidence-claim-binding-registry/v1', evidenceClaimBindings
    ),
  };
  const bindingHash = sourceBindingHash(bindingPayload);
  return {
    schemaVersion: 'requirements-contract-source-binding/v1',
    recordId: input.recordId,
    bindingRevisionId: bindingRevisionId({
      recordId: input.recordId,
      semanticRevisionId: input.semanticRevisionId,
      parentBindingRevisionId: input.parentBindingRevisionId,
      sourceBindingHash: bindingHash,
    }),
    sourceBindingHash: bindingHash,
    ...bindingPayload,
  };
}

export function validateRequirementsContractSourceBindingCapsule(value: unknown) {
  const issueCodes: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { decision: 'block' as const, issueCodes: ['source_binding_capsule_invalid'] };
  }
  const capsule = value as RequirementsContractSourceBindingCapsule & Record<string, unknown>;
  const allowed = new Set([
    'schemaVersion', 'recordId', 'semanticRevisionId', 'scopeSemanticHash', 'bindingRevisionId',
    'parentBindingRevisionId', 'sourceBindingHash', 'resolverIdentity', 'sourceArtifacts',
    'sourceSpanRegistry', 'sourceSpanRegistryHash', 'evidenceClaimBindings',
    'evidenceClaimBindingRegistryHash',
  ]);
  if (Object.keys(capsule).some((key) => !allowed.has(key))) issueCodes.push('source_binding_unknown_field');
  if (capsule.schemaVersion !== 'requirements-contract-source-binding/v1') issueCodes.push('source_binding_schema_version_invalid');
  if (![capsule.scopeSemanticHash, capsule.sourceBindingHash, capsule.sourceSpanRegistryHash, capsule.evidenceClaimBindingRegistryHash].every((hash) => SHA256.test(String(hash)))) {
    issueCodes.push('source_binding_hash_invalid');
  }
  try {
    const recreated = createRequirementsContractSourceBindingCapsule({
      recordId: capsule.recordId,
      semanticRevisionId: capsule.semanticRevisionId,
      scopeSemanticHash: capsule.scopeSemanticHash,
      parentBindingRevisionId: capsule.parentBindingRevisionId,
      resolverIdentity: capsule.resolverIdentity,
      sourceArtifacts: capsule.sourceArtifacts,
      sourceSpans: capsule.sourceSpanRegistry,
      evidenceClaimBindings: capsule.evidenceClaimBindings,
    });
    if (recreated.sourceBindingHash !== capsule.sourceBindingHash) issueCodes.push('source_binding_hash_mismatch');
    if (recreated.bindingRevisionId !== capsule.bindingRevisionId) issueCodes.push('binding_revision_id_mismatch');
  } catch (error) {
    issueCodes.push(error instanceof Error ? error.message : 'source_binding_capsule_invalid');
  }
  return { decision: issueCodes.length ? 'block' as const : 'pass' as const, issueCodes: sortedUnique(issueCodes) };
}

export function createRequirementsContractResolvedEvidenceIndex(input: {
  semanticRevisionId: string;
  bindingRevisionId: string;
  sourceBindingHash: string;
  resolutions: Array<{
    evidenceClaimId: string;
    authorityClass: RequirementsAuthorityClass;
    sourceSpanRefs: string[];
    decisionReceiptRefs: string[];
    premiseRefs: string[];
    derivationReceiptRefs: string[];
  }>;
}) {
  const resolutions = [...input.resolutions]
    .map((resolution) => ({
      ...resolution,
      sourceSpanRefs: sortedUnique(resolution.sourceSpanRefs),
      decisionReceiptRefs: sortedUnique(resolution.decisionReceiptRefs),
      premiseRefs: sortedUnique(resolution.premiseRefs),
      derivationReceiptRefs: sortedUnique(resolution.derivationReceiptRefs),
    }))
    .sort((left, right) => left.evidenceClaimId.localeCompare(right.evidenceClaimId));
  return {
    schemaVersion: 'requirements-contract-resolved-evidence-index/v1' as const,
    semanticRevisionId: input.semanticRevisionId,
    bindingRevisionId: input.bindingRevisionId,
    sourceBindingHash: input.sourceBindingHash,
    resolutions,
    indexHash: requirementsContractDomainHash('requirements-resolved-evidence-index/v1', {
      semanticRevisionId: input.semanticRevisionId,
      bindingRevisionId: input.bindingRevisionId,
      sourceBindingHash: input.sourceBindingHash,
      resolutions,
    }),
    authority: 'none' as const,
  };
}
