import {
  REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY,
  type RequirementsContractTraceEdgeType,
} from '../rules/requirements-contract-trace-edge-type-registry';
import { sha256Stable } from './requirements-contract-semantic-resolver';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const NODE_KEYS = [
  'id',
  'nodeType',
  'bodyHash',
  'sourceRootRef',
  'sourceRootPayloadHash',
  'authorityClass',
] as const;
const EDGE_KEYS = [
  'edgeId',
  'edgeType',
  'fromRef',
  'toRef',
  'sourceRef',
  'sourceHash',
  'proofRefs',
  'applicability',
] as const;

export type RequirementsContractTraceNodeType =
  | 'requirement'
  | 'negative_requirement'
  | 'out_of_scope'
  | 'scenario'
  | 'sequence_step'
  | 'branch'
  | 'target'
  | 'task'
  | 'red'
  | 'oracle'
  | 'command'
  | 'acceptance'
  | 'evidence_requirement';

export interface RequirementsContractTraceNode {
  id: string;
  nodeType: RequirementsContractTraceNodeType;
  bodyHash: string;
  sourceRootRef: string;
  sourceRootPayloadHash: string;
  authorityClass: string;
}

export interface RequirementsContractTraceEdge {
  edgeId: string;
  edgeType: RequirementsContractTraceEdgeType;
  fromRef: string;
  toRef: string;
  sourceRef: string;
  sourceHash: string;
  proofRefs: string[];
  applicability: 'applicable' | 'not_applicable' | 'unresolved' | 'invalid';
}

export interface RequirementsContractNormalizedTraceGraph {
  schemaVersion: 'requirements-contract-normalized-trace-graph/v1';
  requirementSetId: string;
  sourceAuthorityHash: string;
  semanticModelHash: string;
  semanticConservationManifestHash: string;
  edgeTypeRegistryHash: string;
  authority: 'none';
  nodes: Record<string, RequirementsContractTraceNode>;
  edges: Record<string, RequirementsContractTraceEdge>;
  nodeCount: number;
  edgeCount: number;
  graphHash: string;
}

function exactShape(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function traceGraphPreimage(
  graph: Omit<RequirementsContractNormalizedTraceGraph, 'graphHash'>
): Omit<RequirementsContractNormalizedTraceGraph, 'graphHash'> {
  return graph;
}

export function createRequirementsContractNormalizedTraceGraph(input: {
  requirementSetId: string;
  sourceAuthorityHash: string;
  semanticModelHash: string;
  semanticConservationManifestHash: string;
  nodes: RequirementsContractTraceNode[];
  edges: RequirementsContractTraceEdge[];
}): RequirementsContractNormalizedTraceGraph {
  const nodes: Record<string, RequirementsContractTraceNode> = {};
  const bodyOwners = new Map<string, string>();
  for (const node of input.nodes) {
    if (!exactShape(node, NODE_KEYS)) {
      throw new Error(`trace_graph_node_shape_invalid:${node.id}`);
    }
    if (nodes[node.id]) throw new Error(`trace_graph_duplicate_node_id:${node.id}`);
    if (!SHA256.test(node.bodyHash) || !SHA256.test(node.sourceRootPayloadHash)) {
      throw new Error(`trace_graph_node_hash_invalid:${node.id}`);
    }
    const bodyOwner = bodyOwners.get(node.bodyHash);
    if (bodyOwner) throw new Error(`trace_graph_duplicate_body_hash:${node.bodyHash}`);
    bodyOwners.set(node.bodyHash, node.id);
    nodes[node.id] = { ...node };
  }

  const edges: Record<string, RequirementsContractTraceEdge> = {};
  const supportedEdgeTypes = new Set(
    REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY.edgeTypes.map((entry) => entry.edgeType)
  );
  for (const edge of input.edges) {
    if (!exactShape(edge, EDGE_KEYS)) {
      throw new Error(`trace_graph_edge_shape_invalid:${edge.edgeId}`);
    }
    if (edges[edge.edgeId]) throw new Error(`trace_graph_duplicate_edge_id:${edge.edgeId}`);
    if (!nodes[edge.fromRef]) throw new Error(`trace_graph_unknown_endpoint:${edge.fromRef}`);
    if (!nodes[edge.toRef]) throw new Error(`trace_graph_unknown_endpoint:${edge.toRef}`);
    if (!supportedEdgeTypes.has(edge.edgeType)) {
      throw new Error(`trace_graph_unknown_edge_type:${edge.edgeType}`);
    }
    if (!SHA256.test(edge.sourceHash) || edge.proofRefs.length === 0) {
      throw new Error(`trace_graph_edge_authority_invalid:${edge.edgeId}`);
    }
    edges[edge.edgeId] = { ...edge, proofRefs: [...edge.proofRefs] };
  }

  const preimage = traceGraphPreimage({
    schemaVersion: 'requirements-contract-normalized-trace-graph/v1',
    requirementSetId: input.requirementSetId,
    sourceAuthorityHash: input.sourceAuthorityHash,
    semanticModelHash: input.semanticModelHash,
    semanticConservationManifestHash: input.semanticConservationManifestHash,
    edgeTypeRegistryHash: sha256Stable(REQUIREMENTS_CONTRACT_TRACE_EDGE_TYPE_REGISTRY),
    authority: 'none',
    nodes,
    edges,
    nodeCount: Object.keys(nodes).length,
    edgeCount: Object.keys(edges).length,
  });
  return { ...preimage, graphHash: sha256Stable(preimage) };
}

export function validateRequirementsContractNormalizedTraceGraph(
  graph: RequirementsContractNormalizedTraceGraph,
  input: { positiveRequirementIds: string[] }
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const { graphHash: _graphHash, ...preimage } = graph;
  if (graph.graphHash !== sha256Stable(preimage)) {
    issues.push('trace_graph_hash_mismatch');
  }
  for (const requirementId of input.positiveRequirementIds) {
    const hasIndependentOracle = Object.values(graph.edges).some(
      (edge) =>
        edge.edgeType === 'verified_by' &&
        edge.fromRef === requirementId &&
        graph.nodes[edge.toRef]?.nodeType === 'oracle' &&
        edge.applicability === 'applicable'
    );
    if (!hasIndependentOracle) {
      issues.push(`trace_graph_independent_oracle_missing:${requirementId}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

function stableProjection(value: unknown): string {
  return sha256Stable(value);
}

export function compareRequirementsContractCompactTraceParity(
  sourceProjection: Record<string, unknown>,
  artifactProjection: Record<string, unknown>
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const pairs: Array<[string, string, string]> = [
    ['atomicRows', 'atomicRows', 'compact_trace_atomic_rows_mismatch'],
    ['acceptanceRootIds', 'acceptanceRootIds', 'compact_trace_acceptance_roots_mismatch'],
    ['fullPathRows', 'fullPathRows', 'compact_trace_full_path_rows_mismatch'],
  ];
  for (const [sourceKey, artifactKey, code] of pairs) {
    if (stableProjection(sourceProjection[sourceKey]) !== stableProjection(artifactProjection[artifactKey])) {
      issues.push(code);
    }
  }
  const scalarPairs: Array<[string, string]> = [
    ['canonicalTraceGraphHash', 'compact_trace_graph_hash_mismatch'],
    ['edgeTypeRegistryHash', 'compact_trace_edge_registry_mismatch'],
    ['bundleBindingHash', 'compact_trace_bundle_binding_mismatch'],
    ['acceptanceBindingHash', 'compact_trace_acceptance_binding_mismatch'],
    ['acceptanceRootProofManifestHash', 'compact_trace_root_proof_binding_mismatch'],
    ['acceptanceRootCount', 'compact_trace_acceptance_root_count_mismatch'],
    ['acceptanceRootSetHash', 'compact_trace_acceptance_root_set_hash_mismatch'],
  ];
  for (const [key, code] of scalarPairs) {
    if (sourceProjection[key] !== artifactProjection[key]) issues.push(code);
  }
  return { ok: issues.length === 0, issues };
}

export function validateRequirementsContractSourceRootTraceCoverage(input: {
  graph: RequirementsContractNormalizedTraceGraph;
  sourceRoots: Array<{
    sourceRootId: string;
    payloadHash: string;
    authorityClass: string;
  }>;
}): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const nodesByRoot = new Map(
    Object.values(input.graph.nodes).map((node) => [node.sourceRootRef, node])
  );
  const rootsById = new Map(input.sourceRoots.map((root) => [root.sourceRootId, root]));
  for (const root of input.sourceRoots) {
    const node = nodesByRoot.get(root.sourceRootId);
    if (!node) {
      issues.push(`source_root_trace_missing:${root.sourceRootId}`);
      continue;
    }
    if (node.sourceRootPayloadHash !== root.payloadHash) {
      issues.push(`source_root_payload_mismatch:${root.sourceRootId}`);
    }
    if (node.authorityClass !== root.authorityClass) {
      issues.push(`source_root_authority_mismatch:${root.sourceRootId}`);
    }
  }
  for (const node of Object.values(input.graph.nodes)) {
    if (!rootsById.has(node.sourceRootRef)) {
      issues.push(`trace_source_root_missing:${node.sourceRootRef}`);
    }
  }
  return { ok: issues.length === 0, issues };
}
