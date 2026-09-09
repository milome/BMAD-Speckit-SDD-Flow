import {
  resolveTypedSourceAuthority,
  type RequirementsTypedSourceAuthority,
  type RequirementsTypedSourceNode,
} from '../../../main-agent/source-authority/scripts/requirements-contract-typed-source-semantics';
import { sha256Stable } from '../../../main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { validateGoalContractSchema } from './schema-registry';
import { loadStandaloneSourcePlanProfile } from '../source-plan/profile';

type JsonObject = Record<string, unknown>;

export interface CanonicalRequirementGraphSourceAuthority extends JsonObject {
  kind: 'standalone_source_plan' | 'requirements_semantic_ir';
  schemaVersion: string;
  authorityId: string;
  authorityHash: string;
}

export interface CanonicalRequirementGraphV2 extends JsonObject {
  schemaVersion: 'CanonicalRequirementGraph/v2';
  sourceAuthority: CanonicalRequirementGraphSourceAuthority;
  nodes: JsonObject[];
  relations: JsonObject[];
  aliases: JsonObject[];
  semanticHash: string;
  graphHash: string;
  typedSourceGraphHash?: string;
  upstreamCanonicalRequirementGraphHash?: string;
  derivationManifestHash?: string;
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const PROVENANCE_KEYS = new Set([
  'sourceSpanRefs',
  'legacySource',
  'sourceBinding',
  'sourcePath',
  'sourceArtifactRef',
  'byteStart',
  'byteEnd',
  'startByte',
  'endByteExclusive',
  'sourceLine',
  'lineStart',
  'lineEnd',
  'physicalLocator',
]);
const NON_SEMANTIC_ATTRIBUTE_KEYS = new Set([
  'clauses',
  'legacySourceBlockRefs',
  'sourceSpanPartitions',
  'associationBasis',
]);
const CANONICAL_ATTESTATION_KEYS = [
  'canonicalProjection',
  'canonicalProjectionHash',
  'canonicalNodeHash',
  'canonicalRequirementGraphHash',
  'derivationManifestHash',
] as const;
const REQUIREMENT_KINDS = new Set(['REQ', 'NFR', 'NEG', 'OUT']);

const RELATION_ENDPOINT_RULES: Record<
  string,
  { from?: Set<string>; to?: Set<string> }
> = {
  applies_to_requirement: { to: REQUIREMENT_KINDS },
  implemented_by: { to: new Set(['TASK']) },
  accepted_by: { to: new Set(['AC']) },
  uses_path: { to: new Set(['PATH']) },
  validated_by: { to: new Set(['CMD']) },
  evidenced_by: { to: new Set(['EVD']) },
  produces_artifact: { to: new Set(['ART']) },
  depends_on: { to: new Set(['DEP']) },
  guarded_by: { to: new Set(['STOP']) },
  produced_by: { to: new Set(['TASK', 'CMD']) },
  consumed_by: { to: new Set(['AC', 'TASK']) },
  includes_command: { from: new Set(['CMD']), to: new Set(['CMD']) },
  globally_authorized_by: { to: REQUIREMENT_KINDS },
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is JsonObject =>
          Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      )
    : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function fail(code: string): never {
  throw new Error(`canonical_requirement_graph_${code}`);
}

function isRequirementsCompatibilityNode(
  graph: JsonObject,
  node: JsonObject
): boolean {
  return (
    text(object(graph.sourceAuthority).kind) === 'requirements_semantic_ir' &&
    (
      text(object(node.attributes).compatibilityIdentity) === 'requirements_typed_source_id' ||
      text(node.id).length > 0
    )
  );
}

function ownerCycleExists(nodes: JsonObject[], known: Set<string>): boolean {
  const ownerById = new Map(
    nodes
      .map((node) => [text(node.id), text(node.ownerRef)] as const)
      .filter(([, ownerRef]) => ownerRef && known.has(ownerRef))
  );
  const states = new Map<string, 'visiting' | 'visited'>();
  const visit = (id: string): boolean => {
    if (states.get(id) === 'visiting') return true;
    if (states.get(id) === 'visited') return false;
    states.set(id, 'visiting');
    const owner = ownerById.get(id);
    if (owner && visit(owner)) return true;
    states.set(id, 'visited');
    return false;
  };
  return [...ownerById.keys()].some(visit);
}

function hasRequirementOwner(
  node: JsonObject,
  nodeById: Map<string, JsonObject>
): boolean {
  const visited = new Set<string>();
  let ownerRef = text(node.ownerRef);
  while (ownerRef && !visited.has(ownerRef)) {
    visited.add(ownerRef);
    const owner = nodeById.get(ownerRef);
    if (!owner) return false;
    if (REQUIREMENT_KINDS.has(text(owner.kind))) return true;
    ownerRef = text(owner.ownerRef);
  }
  return false;
}

function relationEndpointsValid(
  relation: JsonObject,
  nodeById: Map<string, JsonObject>
): boolean {
  const type = text(relation.type);
  const rule = RELATION_ENDPOINT_RULES[type];
  if (!rule) return type === 'owned_by';
  const from = nodeById.get(text(relation.fromRef));
  const to = nodeById.get(text(relation.toRef));
  if (!from || !to) return true;
  return (
    (!rule.from || rule.from.has(text(from.kind))) &&
    (!rule.to || rule.to.has(text(to.kind)))
  );
}

function stripProvenance(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripProvenance);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as JsonObject)
      .filter(([key]) => !PROVENANCE_KEYS.has(key))
      .map(([key, child]) => [key, stripProvenance(child)])
  );
}

function canonicalNodeProjection(value: JsonObject): JsonObject {
  const projected = stripProvenance(value) as JsonObject;
  delete projected.references;
  const attributes = object(projected.attributes);
  projected.attributes = Object.fromEntries(
    Object.entries(attributes).filter(([key]) => !NON_SEMANTIC_ATTRIBUTE_KEYS.has(key))
  );
  return projected;
}

function stripTopLevelSourceSpanRefs(value: JsonObject): JsonObject {
  const { sourceSpanRefs: _sourceSpanRefs, ...projected } = value;
  return structuredClone(projected);
}

function sorted(values: JsonObject[], key: string): JsonObject[] {
  return [...values].sort((left, right) => text(left[key]).localeCompare(text(right[key])));
}

function semanticPayload(input: {
  nodes: JsonObject[];
  relations: JsonObject[];
  aliases: JsonObject[];
}): {
  nodes: JsonObject[];
  relations: JsonObject[];
  aliases: JsonObject[];
} {
  return {
    nodes: sorted(input.nodes.map(canonicalNodeProjection), 'id'),
    relations: sorted(input.relations.map((value) => stripProvenance(value) as JsonObject), 'id'),
    aliases: sorted(input.aliases.map((value) => stripProvenance(value) as JsonObject), 'alias'),
  };
}

function sourceGraphV1Hash(graph: JsonObject): string {
  const { graphHash: _graphHash, ...payload } = graph;
  return sha256Stable({
    ...payload,
    nodes: objects(graph.nodes).map(stripTopLevelSourceSpanRefs),
    relations: objects(graph.relations).map(stripTopLevelSourceSpanRefs),
    aliases: objects(graph.aliases).map(stripTopLevelSourceSpanRefs),
  });
}

function canonicalKind(node: RequirementsTypedSourceNode): string {
  const declared = node.sourceRootId.split('-')[0];
  if (['REQ', 'NFR', 'NEG', 'OUT', 'TASK', 'AC', 'PATH', 'CMD', 'EVD', 'ART', 'DEP', 'STOP'].includes(declared)) {
    return declared;
  }
  if (node.executionRole === 'action') return 'TASK';
  if (node.executionRole === 'acceptance') return 'AC';
  if (node.executionRole === 'boundary') return node.polarity === 'forbidden' ? 'NEG' : 'OUT';
  return 'REQ';
}

function genericCanonicalNode(node: RequirementsTypedSourceNode): JsonObject {
  const owner = text(node.scope.ownerId ?? node.scope.owner);
  const aliases = unique(node.declaredIds.filter((id) => id !== node.sourceRootId));
  const conditions = objects(node.conditions);
  return {
    id: node.sourceRootId,
    kind: canonicalKind(node),
    title: node.sourceRootId,
    statement: node.text,
    normativeStrength: text(node.normativeStrength).toUpperCase(),
    polarity: node.polarity,
    applicability: conditions.length > 0
      ? { mode: 'conditional', condition: conditions.map((row) => text(row.text)).join(' AND ') }
      : { mode: 'always' },
    scope: node.scope.kind === 'global' ? 'global' : 'local',
    aliases,
    ownerRef: owner || null,
    attributes: {
      executionRole: node.executionRole,
      compatibilityIdentity: 'requirements_typed_source_id',
    },
  };
}

function canonicalAttestations(
  nodes: RequirementsTypedSourceNode[],
  anchor: {
    expectedTypedSourceGraphHash?: string;
    actualTypedSourceGraphHash: string;
  }
): {
  nodes: JsonObject[];
  upstreamCanonicalRequirementGraphHash?: string;
  derivationManifestHash?: string;
} {
  const references = nodes.map((node) => object(node.typedReferences));
  const hasAttestation = references.some((value) =>
    CANONICAL_ATTESTATION_KEYS.some((key) => value[key] !== undefined)
  );
  if (!hasAttestation) return { nodes: nodes.map(genericCanonicalNode) };
  if (
    !SHA256.test(text(anchor.expectedTypedSourceGraphHash)) ||
    anchor.expectedTypedSourceGraphHash !== anchor.actualTypedSourceGraphHash
  ) {
    fail('attestation_upstream_anchor_mismatch');
  }
  if (
    references.some((value) =>
      CANONICAL_ATTESTATION_KEYS
        .filter((key) => key !== 'canonicalProjectionHash')
        .some((key) => value[key] === undefined)
    )
  ) {
    fail('attestation_incomplete');
  }
  const hasProjectionHash = references.some(
    (value) => value.canonicalProjectionHash !== undefined
  );
  if (
    hasProjectionHash &&
    references.some((value) => value.canonicalProjectionHash === undefined)
  ) {
    fail('attestation_incomplete');
  }
  const graphHashes = unique(references.map((value) => text(value.canonicalRequirementGraphHash)));
  const manifestHashes = unique(references.map((value) => text(value.derivationManifestHash)));
  if (graphHashes.length !== 1 || manifestHashes.length !== 1) fail('attestation_mixed');
  if (![graphHashes[0], manifestHashes[0]].every((value) => SHA256.test(value))) {
    fail('attestation_hash_invalid');
  }
  const projected = nodes.map((node, index) => {
    const reference = references[index];
    const projection = object(reference.canonicalProjection);
    if (
      text(projection.id) !== node.sourceRootId ||
      !SHA256.test(text(reference.canonicalNodeHash)) ||
      Object.keys(projection).some((key) => PROVENANCE_KEYS.has(key))
    ) {
      fail('attestation_projection_invalid');
    }
    if (hasProjectionHash && (
      !SHA256.test(text(reference.canonicalProjectionHash)) ||
      reference.canonicalProjectionHash !== sha256Stable(projection)
    )) {
      fail('attestation_projection_hash_mismatch');
    }
    return canonicalNodeProjection(projection);
  });
  return {
    nodes: projected,
    upstreamCanonicalRequirementGraphHash: graphHashes[0],
    derivationManifestHash: manifestHashes[0],
  };
}

function canonicalRelations(input: {
  sourceRelations: JsonObject[];
  nodes: JsonObject[];
}): JsonObject[] {
  const nodeById = new Map(input.nodes.map((node) => [text(node.id), node]));
  const relationTypes = new Map([
    ['applies_to', 'applies_to_requirement'],
    ['command_set_includes', 'includes_command'],
  ]);
  return input.sourceRelations.map((relation) => ({
    id: text(relation.relationId),
    type: relationTypes.get(text(relation.kind)) ?? text(relation.kind),
    fromRef: text(relation.from),
    toRef: text(relation.to),
    scope: text(nodeById.get(text(relation.from))?.scope) === 'global' ? 'global' : 'local',
  }));
}

function aliasesFromNodes(nodes: JsonObject[]): JsonObject[] {
  return nodes.flatMap((node) =>
    strings(node.aliases).map((alias) => ({ alias, canonicalRef: text(node.id) }))
  );
}

function assertSourceAuthority(value: CanonicalRequirementGraphSourceAuthority): void {
  if (
    !['standalone_source_plan', 'requirements_semantic_ir'].includes(value.kind) ||
    !value.schemaVersion ||
    !value.authorityId ||
    !SHA256.test(value.authorityHash)
  ) {
    fail('source_authority_invalid');
  }
}

function createGraph(input: {
  sourceAuthority: CanonicalRequirementGraphSourceAuthority;
  nodes: JsonObject[];
  relations: JsonObject[];
  aliases: JsonObject[];
  typedSourceGraphHash?: string;
  upstreamCanonicalRequirementGraphHash?: string;
  derivationManifestHash?: string;
}): CanonicalRequirementGraphV2 {
  assertSourceAuthority(input.sourceAuthority);
  const semantic = semanticPayload(input);
  const semanticHash = sha256Stable({
    domain: 'canonical-requirement-semantic/v1',
    ...semantic,
  });
  const payload = {
    schemaVersion: 'CanonicalRequirementGraph/v2' as const,
    sourceAuthority: structuredClone(input.sourceAuthority),
    ...semantic,
    semanticHash,
    ...(input.typedSourceGraphHash ? { typedSourceGraphHash: input.typedSourceGraphHash } : {}),
    ...(input.upstreamCanonicalRequirementGraphHash
      ? { upstreamCanonicalRequirementGraphHash: input.upstreamCanonicalRequirementGraphHash }
      : {}),
    ...(input.derivationManifestHash
      ? { derivationManifestHash: input.derivationManifestHash }
      : {}),
  };
  const graph = { ...payload, graphHash: sha256Stable({ domain: 'canonical-requirement-graph/v2', payload }) };
  const lint = lintCanonicalRequirementGraph(graph);
  if (lint.decision !== 'pass') fail(lint.issueCodes[0] ?? 'lint_failed');
  return Object.freeze(graph);
}

export function normalizeCanonicalRequirementGraph(input: {
  sourceAuthority: CanonicalRequirementGraphSourceAuthority;
  standaloneGraph?: JsonObject;
  typedSourceAuthority?: RequirementsTypedSourceAuthority;
  expectedTypedSourceGraphHash?: string;
}): CanonicalRequirementGraphV2 {
  if (Boolean(input.standaloneGraph) === Boolean(input.typedSourceAuthority)) {
    fail('source_projection_ambiguous');
  }
  if (input.standaloneGraph) {
    const graph = input.standaloneGraph;
    if (
      graph.schemaVersion !== 'CanonicalRequirementGraph/v1' ||
      !SHA256.test(text(graph.graphHash)) ||
      sourceGraphV1Hash(graph) !== graph.graphHash
    ) {
      fail('standalone_v1_invalid');
    }
    return createGraph({
      sourceAuthority: input.sourceAuthority,
      nodes: objects(graph.nodes).map((node) => {
        return canonicalNodeProjection(node);
      }),
      relations: objects(graph.relations),
      aliases: objects(graph.aliases),
      upstreamCanonicalRequirementGraphHash: text(graph.graphHash),
    });
  }

  const authority = input.typedSourceAuthority!;
  const typedGraph = resolveTypedSourceAuthority(authority);
  const attestations = canonicalAttestations(typedGraph.sourceNodes, {
    expectedTypedSourceGraphHash: input.expectedTypedSourceGraphHash,
    actualTypedSourceGraphHash: authority.graphHash,
  });
  const {
    nodes: attestedNodes,
    ...attestationLineage
  } = attestations;
  return createGraph({
    sourceAuthority: input.sourceAuthority,
    nodes: attestedNodes,
    relations: canonicalRelations({
      sourceRelations: typedGraph.sourceRelations,
      nodes: attestedNodes,
    }),
    aliases: aliasesFromNodes(attestedNodes),
    typedSourceGraphHash: authority.graphHash,
    ...attestationLineage,
  });
}

export function canonicalRequirementGraphRef(graph: CanonicalRequirementGraphV2): JsonObject {
  const lint = lintCanonicalRequirementGraph(graph);
  if (lint.decision !== 'pass') fail(lint.issueCodes[0] ?? 'lint_failed');
  return {
    schemaVersion: 'CanonicalRequirementGraphRef/v1',
    graphSchemaVersion: graph.schemaVersion,
    graphHash: graph.graphHash,
    semanticHash: graph.semanticHash,
    sourceAuthorityHash: graph.sourceAuthority.authorityHash,
    lintReceiptHash: lint.receiptHash,
    ...(graph.typedSourceGraphHash ? { typedSourceGraphHash: graph.typedSourceGraphHash } : {}),
    ...(graph.upstreamCanonicalRequirementGraphHash
      ? { upstreamCanonicalRequirementGraphHash: graph.upstreamCanonicalRequirementGraphHash }
      : {}),
    ...(graph.derivationManifestHash
      ? { derivationManifestHash: graph.derivationManifestHash }
      : {}),
  };
}

export function lintCanonicalRequirementGraph(value: unknown): {
  schemaVersion: 'CanonicalRequirementGraphLintResult/v1';
  decision: 'pass' | 'block';
  graphHash: string;
  semanticHash: string;
  nodeCount: number;
  relationCount: number;
  aliasCount: number;
  issueCodes: string[];
  receiptHash: string;
} {
  const graph = object(value);
  const nodes = objects(graph.nodes);
  const relations = objects(graph.relations);
  const aliases = objects(graph.aliases);
  const issueCodes: string[] = [];
  const ids = nodes.map((node) => text(node.id));
  const known = new Set(ids);
  const nodeById = new Map(nodes.map((node) => [text(node.id), node]));
  const { profile } = loadStandaloneSourcePlanProfile();
  const identity = object(profile.identity);
  const canonicalPattern = new RegExp(text(identity.canonicalPattern), 'u');
  const ownerRules = profile.ownerRules as Record<string, string[]>;
  const ownedNodeKinds = new Set(profile.ownedNodeKinds);
  const requirementOwnerKinds = new Set(profile.requirementOwnerKinds);
  const conflictingTargets = new Set(
    strings(object(profile.purpose).conflictingTargets)
  );
  try {
    validateGoalContractSchema('canonical-requirement-graph-v2.schema.json', graph);
  } catch {
    issueCodes.push('wire_schema_invalid');
  }
  if (graph.schemaVersion !== 'CanonicalRequirementGraph/v2') issueCodes.push('schema_invalid');
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) issueCodes.push('node_identity_invalid');
  if (ids.some((id) => /^(?:SRC|SPAN|source-block|clause)-/u.test(id))) issueCodes.push('provenance_identity_promoted');
  const strictNodes = nodes.filter((node) => !isRequirementsCompatibilityNode(graph, node));
  if (strictNodes.some((node) => !canonicalPattern.test(text(node.id)))) {
    issueCodes.push('node_identity_grammar_invalid');
  }
  if (strictNodes.some((node) => text(node.id).split('-')[0] !== text(node.kind))) {
    issueCodes.push('node_kind_identity_mismatch');
  }
  if (
    text(object(graph.sourceAuthority).kind) !== 'requirements_semantic_ir' &&
    nodes.some(
      (node) =>
        text(object(node.attributes).compatibilityIdentity) ===
        'requirements_typed_source_id'
    )
  ) {
    issueCodes.push('compatibility_identity_unauthorized');
  }

  const relationIds = relations.map((relation) => text(relation.id));
  if (
    relationIds.some((id) => !id) ||
    new Set(relationIds).size !== relationIds.length
  ) {
    issueCodes.push('relation_identity_invalid');
  }
  if (relations.some((relation) => !known.has(text(relation.fromRef)) ||
    (!known.has(text(relation.toRef)) && text(relation.toRef) !== 'ALL_WORKS'))) {
    issueCodes.push('relation_reference_invalid');
  }
  if (relations.some((relation) => !relationEndpointsValid(relation, nodeById))) {
    issueCodes.push('relation_endpoint_type_invalid');
  }
  if (
    relations.some((relation) => {
      const from = nodeById.get(text(relation.fromRef));
      return from && text(relation.scope) !== text(from.scope);
    })
  ) {
    issueCodes.push('relation_scope_invalid');
  }
  if (
    relations.some((relation) => {
      if (text(relation.type) !== 'owned_by') return false;
      const from = nodeById.get(text(relation.fromRef));
      return from && text(from.ownerRef) !== text(relation.toRef);
    })
  ) {
    issueCodes.push('owner_relation_mismatch');
  }
  const aliasNames = aliases.map((alias) => text(alias.alias));
  if (aliasNames.some((alias) => !alias) || new Set(aliasNames).size !== aliasNames.length ||
    aliases.some((alias) => !known.has(text(alias.canonicalRef)))) issueCodes.push('alias_reference_invalid');
  if (nodes.some((node) => text(node.ownerRef) && !known.has(text(node.ownerRef)))) issueCodes.push('owner_reference_invalid');
  if (
    strictNodes.some(
      (node) => ownedNodeKinds.has(text(node.kind)) && !text(node.ownerRef)
    )
  ) {
    issueCodes.push('owner_reference_required');
  }
  if (nodes.some((node) => text(node.ownerRef) === text(node.id))) {
    issueCodes.push('owner_self_reference_invalid');
  }
  if (
    nodes.some((node) => {
      const ownerRef = text(node.ownerRef);
      if (!ownerRef || ownerRef === text(node.id)) return false;
      const owner = nodeById.get(ownerRef);
      if (!owner) return false;
      const kind = text(node.kind);
      const allowed = new Set(
        ownerRules[kind] ?? (kind === 'TASK' ? [...requirementOwnerKinds] : [])
      );
      return allowed.size > 0 && !allowed.has(text(owner.kind));
    })
  ) {
    issueCodes.push('owner_type_invalid');
  }
  if (ownerCycleExists(nodes, known)) issueCodes.push('owner_cycle_invalid');

  if (
    nodes.some((node) =>
      strings(object(node.attributes).prohibits).some((target) =>
        conflictingTargets.has(target)
      )
    )
  ) {
    issueCodes.push('source_plan_purpose_conflict');
  }

  const globalAuthorityFromRefs = new Set(
    relations
      .filter((relation) => text(relation.type) === 'globally_authorized_by')
      .map((relation) => text(relation.fromRef))
  );
  if (
    relations.some(
      (relation) =>
        text(relation.type) === 'globally_authorized_by' &&
        text(nodeById.get(text(relation.fromRef))?.scope) !== 'global'
    )
  ) {
    issueCodes.push('global_authority_invalid');
  }
  const missingGlobalAuthority = nodes.some((node) => {
    if (text(node.scope) !== 'global') return false;
    if (globalAuthorityFromRefs.has(text(node.id))) return false;
    if (!isRequirementsCompatibilityNode(graph, node)) return true;
    return !hasRequirementOwner(node, nodeById);
  });
  if (missingGlobalAuthority) issueCodes.push('global_authority_missing');
  if (
    relations.some((relation) => {
      if (text(relation.toRef) !== 'ALL_WORKS') return false;
      const fromRef = text(relation.fromRef);
      const from = nodeById.get(fromRef);
      return text(from?.scope) !== 'global' || !globalAuthorityFromRefs.has(fromRef);
    })
  ) {
    issueCodes.push('global_fanout_unauthorized');
  }
  const semantic = semanticPayload({ nodes, relations, aliases });
  const semanticHash = sha256Stable({ domain: 'canonical-requirement-semantic/v1', ...semantic });
  if (!SHA256.test(text(graph.semanticHash)) || graph.semanticHash !== semanticHash) issueCodes.push('semantic_hash_mismatch');
  const { graphHash: _graphHash, ...payload } = graph;
  const graphHash = sha256Stable({ domain: 'canonical-requirement-graph/v2', payload });
  if (!SHA256.test(text(graph.graphHash)) || graph.graphHash !== graphHash) issueCodes.push('graph_hash_mismatch');
  if (!object(graph.sourceAuthority).authorityHash || !SHA256.test(text(object(graph.sourceAuthority).authorityHash))) {
    issueCodes.push('source_authority_invalid');
  }
  const base = {
    schemaVersion: 'CanonicalRequirementGraphLintResult/v1' as const,
    decision: issueCodes.length === 0 ? 'pass' as const : 'block' as const,
    graphHash: text(graph.graphHash),
    semanticHash: text(graph.semanticHash),
    nodeCount: nodes.length,
    relationCount: relations.length,
    aliasCount: aliases.length,
    issueCodes: unique(issueCodes),
  };
  return { ...base, receiptHash: sha256Stable({ domain: 'canonical-requirement-graph-lint/v1', payload: base }) };
}
