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
import { encodeGoalSemanticDictionary, decodeGoalSemanticDictionary, type GoalSemanticDictionary } from '../../../utils/goal-contract/control-plane/goal-semantic-dictionary';
import { resolveTypedSourceAuthority, type RequirementsTypedSourceAuthority } from './requirements-contract-typed-source-semantics';
import { sha256Stable, stableStringify } from './requirements-contract-semantic-resolver';

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
  schemaVersion: 'requirements-contract-source-binding/v1' | 'requirements-contract-source-binding/v2';
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
  typedSourceBindings?: RequirementsTypedSourceBindings;
}

export interface RequirementsTypedSourceBindings {
  schemaVersion: 'requirements-contract-typed-source-bindings/v2';
  graphHash: string;
  mappings: GoalSemanticDictionary;
  mappingsHash: string;
}
export interface RequirementsTypedSourceBindingMappings {
  artifacts: Array<{ artifactId: string; path: string; bytes: number; sha256: string }>;
  nodes: Array<{ sourceRootId: string; sourceSpanId: string; sourceBinding: Record<string, unknown> }>;
  relations: Array<{ relationId: string; sourceLine: number }>;
  contexts: Record<string, unknown>[];
}

export function createTypedSourceBindings(graphHash: string, mappings: RequirementsTypedSourceBindingMappings): RequirementsTypedSourceBindings {
  const dictionary = encodeGoalSemanticDictionary(mappings);
  return { schemaVersion: 'requirements-contract-typed-source-bindings/v2', graphHash,
    mappings: dictionary, mappingsHash: dictionary.expandedHash };
}

export function resolveTypedSourceBindings(value: RequirementsTypedSourceBindings): RequirementsTypedSourceBindingMappings {
  if (!value || value.schemaVersion !== 'requirements-contract-typed-source-bindings/v2' ||
    !SHA256.test(value.graphHash) || value.mappingsHash !== value.mappings?.expandedHash ||
    Object.keys(value).some((key) => !['schemaVersion', 'graphHash', 'mappings', 'mappingsHash'].includes(key))) {
    throw new Error('typed_source_bindings_identity_invalid');
  }
  const mappings = decodeGoalSemanticDictionary(value.mappings) as unknown as RequirementsTypedSourceBindingMappings;
  if (!mappings || !['artifacts', 'nodes', 'relations', 'contexts'].every((key) => Array.isArray((mappings as unknown as Record<string, unknown>)[key]))) {
    throw new Error('typed_source_bindings_mappings_invalid');
  }
  return mappings;
}

export function assertTypedSourceBindingAuthority(capsule: RequirementsContractSourceBindingCapsule, authority: RequirementsTypedSourceAuthority): void {
  const graph = resolveTypedSourceAuthority(authority);
  if (capsule.schemaVersion !== 'requirements-contract-source-binding/v2' || capsule.typedSourceBindings?.graphHash !== authority.graphHash) {
    throw new Error('typed_source_bindings_graph_hash_mismatch');
  }
  const mappings = resolveTypedSourceBindings(capsule.typedSourceBindings);
  const actual = mappings.nodes.map((node) => node.sourceRootId).sort();
  const expected = graph.sourceNodes.map((node) => node.sourceRootId).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('typed_source_bindings_node_set_mismatch');
  const spans = new Map(capsule.sourceSpanRegistry.map((span) => [span.sourceSpanId, span]));
  const nodes = new Map(graph.sourceNodes.map((node) => [node.sourceRootId, node]));
  for (const binding of mappings.nodes) {
    const span = spans.get(binding.sourceSpanId);
    const node = nodes.get(binding.sourceRootId)!;
    if (!span || span.exactTextHash !== sha256Stable({ domain: 'requirements-source-exact-text/v1', content: node.text }) ||
      span.normalizedTextHash !== sha256Stable({ domain: 'requirements-source-normalized-text/v1',
        content: node.text.replace(/\r\n?/gu, '\n').normalize('NFC') })) throw new Error('typed_source_bindings_claim_text_mismatch');
  }
  const claims = capsule.evidenceClaimBindings.filter((claim) => claim.authorityClass === 'source_grounded');
  if (claims.length !== 1 || claims[0].evidenceClaimId !== 'EVIDENCE-CLAIM-TYPED-SOURCE-GRAPH' ||
    stableStringify(sortedUnique(claims[0].sourceSpanRefs)) !== stableStringify(sortedUnique(mappings.nodes.map((node) => node.sourceSpanId)))) {
    throw new Error('typed_source_bindings_claim_node_span_conservation_failed');
  }
  const relationIds = new Set(graph.sourceRelations.map((relation) => relation.relationId));
  if (mappings.relations.some((binding) => !relationIds.has(binding.relationId))) throw new Error('typed_source_bindings_relation_unknown');
  const contextRefs = new Set<string>();
  for (const binding of mappings.contexts) {
    if (typeof binding.fieldRef !== 'string' || contextRefs.has(binding.fieldRef)) throw new Error('typed_source_bindings_context_identity_invalid');
    contextRefs.add(binding.fieldRef);
    let parent: unknown = graph;
    const parts = binding.fieldRef.split('/');
    if (parts.shift() !== '' || parts.length < 3) throw new Error('typed_source_bindings_context_path_invalid');
    for (const part of parts.slice(0, -1)) {
      if (!parent || typeof parent !== 'object' || !Object.prototype.hasOwnProperty.call(parent, part)) throw new Error('typed_source_bindings_context_path_unknown');
      parent = (parent as Record<string, unknown>)[part];
    }
    if (!parent || typeof parent !== 'object' || Object.prototype.hasOwnProperty.call(parent, parts.at(-1)!)) throw new Error('typed_source_bindings_context_collision');
  }
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
  typedSourceBindings?: RequirementsTypedSourceBindings;
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
  if (input.typedSourceBindings) {
    const mappings = resolveTypedSourceBindings(input.typedSourceBindings);
    const declared = new Map(mappings.artifacts.map((artifact) => [artifact.artifactId, artifact]));
    if (declared.size !== mappings.artifacts.length) throw new Error('typed_source_bindings_artifact_duplicate');
    const nodeIds = new Set<string>();
    const spans = new Map(sourceSpanRegistry.map((span) => [span.sourceSpanId, span]));
    for (const node of mappings.nodes) {
      if (nodeIds.has(node.sourceRootId)) throw new Error('typed_source_bindings_node_duplicate');
      nodeIds.add(node.sourceRootId);
      const binding = node.sourceBinding;
      const artifact = declared.get(String(binding.sourceArtifactRef));
      const span = spans.get(node.sourceSpanId);
      if (!artifact || !span || span.sourceArtifactId !== artifact.artifactId) throw new Error('typed_source_bindings_span_missing');
      if (!Number.isSafeInteger(binding.byteStart) || !Number.isSafeInteger(binding.byteEnd) ||
        Number(binding.byteStart) < 0 || Number(binding.byteEnd) <= Number(binding.byteStart) || Number(binding.byteEnd) > artifact.bytes ||
        span.startByte !== binding.byteStart || span.endByteExclusive !== binding.byteEnd) throw new Error('typed_source_bindings_span_invalid');
      if (span.sourceSnapshotHash !== `sha256:${artifact.sha256}`) throw new Error('typed_source_bindings_source_hash_mismatch');
    }
    const relationIds = mappings.relations.map((binding) => binding.relationId);
    if (new Set(relationIds).size !== relationIds.length) throw new Error('typed_source_bindings_relation_duplicate');
  }
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
    ...(input.typedSourceBindings ? { typedSourceBindings: input.typedSourceBindings } : {}),
  };
  const bindingHash = input.typedSourceBindings ? requirementsContractDomainHash('requirements-source-binding/v2', bindingPayload) : sourceBindingHash(bindingPayload);
  return {
    schemaVersion: input.typedSourceBindings ? 'requirements-contract-source-binding/v2' : 'requirements-contract-source-binding/v1',
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
    'typedSourceBindings',
  ]);
  if (Object.keys(capsule).some((key) => !allowed.has(key))) issueCodes.push('source_binding_unknown_field');
  if (!['requirements-contract-source-binding/v1', 'requirements-contract-source-binding/v2'].includes(capsule.schemaVersion)) issueCodes.push('source_binding_schema_version_invalid');
  if ((capsule.schemaVersion === 'requirements-contract-source-binding/v2') !== !!capsule.typedSourceBindings) issueCodes.push('source_binding_typed_version_invalid');
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
      ...(capsule.typedSourceBindings ? { typedSourceBindings: capsule.typedSourceBindings } : {}),
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
