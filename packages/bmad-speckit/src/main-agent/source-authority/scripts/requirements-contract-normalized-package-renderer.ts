import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { canonicalJson } from './requirements-contract-governed-write';
import { sha256Stable } from './requirements-contract-semantic-resolver';

export const REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_RENDERER_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-package-renderer.ts';
export const REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_RENDERER_DIST_PATH =
  'packages/bmad-speckit/dist/main-agent/source-authority/scripts/requirements-contract-normalized-package-renderer.js';
export const REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-normalized-package.schema.json';
export const REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_SURFACE_PATHS = [
  REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_OWNER_PATH,
  'packages/bmad-speckit/dist/main-agent/source-authority/schemas/requirements-contract-normalized-package.schema.json',
] as const;

type NormalizedPackage = {
  semanticBodies: Record<string, Record<string, unknown>>;
  nodes: Record<
    string,
    {
      nodeType: string;
      bodySchemaVersion: string;
      bodyHash: string;
      applicability: { decision: string };
    }
  >;
  edges: Record<
    string,
    {
      edgeType: string;
      fromRef: string;
      fromHash: string;
      toRef: string;
      toHash: string;
      edgeHash: string;
    }
  >;
};

type NormalizedPackageOperationMeasureInput = {
  packageValue: unknown;
  lookupNodeIds: string[];
  outgoingNodeIds: string[];
};

function nodeIndex(nodeId: string): number {
  return Number(nodeId.slice('NODE-'.length));
}

type CriticalPathProjection = {
  sparseCriticalPathEdgeIds: string[];
  boundedDenseCriticalPaths: string[][];
  workUnits: number;
};

export function deriveRequirementsContractNormalizedPackageCriticalPaths(
  packageValue: NormalizedPackage
): CriticalPathProjection {
  const nodeIds = Object.keys(packageValue.nodes).sort();
  const edgeIds = Object.keys(packageValue.edges).sort();
  const outgoing = Object.fromEntries(
    nodeIds.map((nodeId) => [nodeId, [] as Array<{ edgeId: string; toRef: string }>])
  );
  const indegree = Object.fromEntries(nodeIds.map((nodeId) => [nodeId, 0]));

  for (const edgeId of edgeIds) {
    const edge = packageValue.edges[edgeId];
    if (!(edge.fromRef in outgoing) || !(edge.toRef in indegree)) continue;
    outgoing[edge.fromRef].push({ edgeId, toRef: edge.toRef });
    indegree[edge.toRef] += 1;
  }

  const ready = nodeIds.filter((nodeId) => indegree[nodeId] === 0);
  const distance = Object.fromEntries(nodeIds.map((nodeId) => [nodeId, 0]));
  const predecessor = new Map<string, { nodeId: string; edgeId: string }>();
  let processedNodeCount = 0;

  for (let readyIndex = 0; readyIndex < ready.length; readyIndex += 1) {
    const nodeId = ready[readyIndex];
    processedNodeCount += 1;
    for (const edge of outgoing[nodeId]) {
      const candidateDistance = distance[nodeId] + 1;
      const currentPredecessor = predecessor.get(edge.toRef);
      if (
        candidateDistance > distance[edge.toRef] ||
        (candidateDistance === distance[edge.toRef] &&
          (!currentPredecessor || edge.edgeId > currentPredecessor.edgeId))
      ) {
        distance[edge.toRef] = candidateDistance;
        predecessor.set(edge.toRef, { nodeId, edgeId: edge.edgeId });
      }
      indegree[edge.toRef] -= 1;
      if (indegree[edge.toRef] === 0) ready.push(edge.toRef);
    }
  }

  const workUnits = nodeIds.length + edgeIds.length;
  if (processedNodeCount !== nodeIds.length) {
    const rootNodeId = nodeIds[0];
    return {
      sparseCriticalPathEdgeIds: [],
      boundedDenseCriticalPaths: rootNodeId
        ? outgoing[rootNodeId].map(({ edgeId }) => [edgeId])
        : [],
      workUnits,
    };
  }

  const endNodeId = nodeIds.reduce<string | undefined>((selected, nodeId) => {
    if (!selected || distance[nodeId] > distance[selected]) return nodeId;
    if (distance[nodeId] === distance[selected] && nodeId < selected) return nodeId;
    return selected;
  }, undefined);
  const sparseCriticalPathEdgeIds: string[] = [];
  let cursor = endNodeId;
  while (cursor && predecessor.has(cursor)) {
    const step = predecessor.get(cursor);
    if (!step) break;
    sparseCriticalPathEdgeIds.push(step.edgeId);
    cursor = step.nodeId;
  }
  sparseCriticalPathEdgeIds.reverse();

  return {
    sparseCriticalPathEdgeIds,
    boundedDenseCriticalPaths: [],
    workUnits,
  };
}

export function resolveRequirementsContractNormalizedPackageSchemaPath(): string {
  const candidates = [
    path.resolve(
      __dirname,
      '..',
      'schemas',
      'requirements-contract-normalized-package.schema.json'
    ),
    ...REQUIREMENTS_CONTRACT_NORMALIZED_PACKAGE_SCHEMA_SURFACE_PATHS.map((surfacePath) =>
      path.resolve(process.cwd(), surfacePath)
    ),
  ];
  const resolved = candidates.find((candidate) => {
    try {
      readFileSync(candidate, 'utf8');
      return true;
    } catch {
      return false;
    }
  });
  return resolved ?? candidates[0];
}

function validatePackage(value: unknown): value is NormalizedPackage {
  const schema = JSON.parse(
    readFileSync(resolveRequirementsContractNormalizedPackageSchemaPath(), 'utf8')
  ) as object;
  return new Ajv2020({ allErrors: true, strict: false }).compile(schema)(value) as boolean;
}

function cell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\r?\n/gu, ' ');
}

function collectCopiedSemanticBodies(
  value: unknown,
  semanticBodies: ReadonlySet<string>,
  copiedBodies: Set<string>
): void {
  if (!value || typeof value !== 'object') return;
  const canonicalValue = canonicalJson(value);
  if (semanticBodies.has(canonicalValue)) copiedBodies.add(canonicalValue);
  for (const child of Object.values(value)) {
    collectCopiedSemanticBodies(child, semanticBodies, copiedBodies);
  }
}

function countHashDomainMismatches(input: NormalizedPackage): number {
  let mismatchCount = 0;
  for (const node of Object.values(input.nodes)) {
    if (!(node.bodyHash in input.semanticBodies)) mismatchCount += 1;
  }
  for (const edge of Object.values(input.edges)) {
    const fromNode = input.nodes[edge.fromRef];
    const toNode = input.nodes[edge.toRef];
    if (!fromNode || fromNode.bodyHash !== edge.fromHash) mismatchCount += 1;
    if (!toNode || toNode.bodyHash !== edge.toHash) mismatchCount += 1;
  }
  return mismatchCount;
}

export function measureRequirementsContractNormalizedPackageOperations(
  input: NormalizedPackageOperationMeasureInput
) {
  if (!validatePackage(input.packageValue)) {
    throw new Error('Normalized Contract Package schema validation failed');
  }
  const packageValue = input.packageValue;
  const canonicalPackage = canonicalJson(packageValue);
  const packageHash = sha256Stable(packageValue);
  const nodeIds = Object.keys(packageValue.nodes).sort();
  const edgeIds = Object.keys(packageValue.edges).sort();
  const lookup = input.lookupNodeIds.map((nodeId) => ({
    index: nodeIndex(nodeId),
    nodeId,
    bodyHash: packageValue.nodes[nodeId]?.bodyHash,
  }));
  const selectedOutgoingNodes = new Set(input.outgoingNodeIds);
  const outgoingEdgeIds = Object.fromEntries(
    input.outgoingNodeIds.map((nodeId) => [String(nodeIndex(nodeId)), [] as string[]])
  );
  const compactTraceRows: Array<{
    edgeId: string;
    edgeType: string;
    fromRef: string;
    toRef: string;
    edgeHash: string;
  }> = [];
  for (const [edgeId, edge] of Object.entries(packageValue.edges)) {
    if (selectedOutgoingNodes.has(edge.fromRef)) {
      outgoingEdgeIds[String(nodeIndex(edge.fromRef))].push(edgeId);
    }
    compactTraceRows.push({
      edgeId,
      edgeType: edge.edgeType,
      fromRef: edge.fromRef,
      toRef: edge.toRef,
      edgeHash: edge.edgeHash,
    });
  }
  for (const ids of Object.values(outgoingEdgeIds)) ids.sort();
  compactTraceRows.sort((left, right) => left.edgeId.localeCompare(right.edgeId));
  const criticalPaths = deriveRequirementsContractNormalizedPackageCriticalPaths(packageValue);

  const canonicalBytes = Buffer.byteLength(canonicalPackage, 'utf8');
  const operationOutputHashes = {
    complete_manifest_serialization: sha256Stable({ packageHash, canonicalBytes }),
    parse_and_index: sha256Stable({ nodeIds, edgeIds }),
    node_lookup: sha256Stable(lookup),
    outgoing_edge_lookup: sha256Stable(outgoingEdgeIds),
    complete_edge_compact_trace_projection: sha256Stable(compactTraceRows),
    sparse_critical_path: sha256Stable(criticalPaths.sparseCriticalPathEdgeIds),
    bounded_dense_one_edge_critical_paths: sha256Stable(criticalPaths.boundedDenseCriticalPaths),
  };
  const nodeCount = nodeIds.length;
  const edgeCount = edgeIds.length;
  const selectedOutgoingEdgeCount = Object.values(outgoingEdgeIds).reduce(
    (count, ids) => count + ids.length,
    0
  );
  const workUnits = {
    complete_manifest_serialization: 2 * nodeCount + edgeCount,
    parse_and_index: nodeCount + edgeCount,
    node_lookup: lookup.length,
    outgoing_edge_lookup: edgeCount + selectedOutgoingEdgeCount,
    complete_edge_compact_trace_projection: 2 * edgeCount,
    sparse_critical_path:
      criticalPaths.sparseCriticalPathEdgeIds.length > 0 ? criticalPaths.workUnits : 0,
    bounded_dense_one_edge_critical_paths:
      criticalPaths.boundedDenseCriticalPaths.length > 0 ? criticalPaths.workUnits : 0,
  };
  return {
    nodeCount,
    edgeCount,
    packageHash,
    canonicalBytes,
    lookup,
    outgoingEdgeIds,
    sparseCriticalPathEdgeIds: criticalPaths.sparseCriticalPathEdgeIds,
    boundedDenseCriticalPaths: criticalPaths.boundedDenseCriticalPaths,
    operationOutputHashes,
    expectedOutputSetHash: sha256Stable(operationOutputHashes),
    workUnits,
  };
}

export function renderRequirementsContractNormalizedPackage(input: unknown) {
  if (!validatePackage(input))
    throw new Error('Normalized Contract Package schema validation failed');
  const semanticBodyValues = Object.values(input.semanticBodies).map(canonicalJson);
  const semanticBodies = new Set(semanticBodyValues);
  const duplicatedSemanticBodyCount = semanticBodyValues.length - semanticBodies.size;
  const copiedSemanticBodies = new Set<string>();
  for (const edge of Object.values(input.edges)) {
    collectCopiedSemanticBodies(edge, semanticBodies, copiedSemanticBodies);
  }
  const duplicateSemanticBodyInEdgeCount = copiedSemanticBodies.size;
  const hashDomainMismatchCount = countHashDomainMismatches(input);
  const nodeRows = Object.entries(input.nodes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([id, node]) =>
        `| ${cell(id)} | ${cell(node.nodeType)} | ${cell(node.bodySchemaVersion)} | ${node.bodyHash} | ${cell(node.applicability.decision)} |`
    );
  const edgeRows = Object.entries(input.edges)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([id, edge]) =>
        `| ${cell(id)} | ${cell(edge.edgeType)} | ${cell(edge.fromRef)} | ${cell(edge.toRef)} | ${edge.edgeHash} |`
    );
  const markdown = [
    '## Normalized Nodes',
    '',
    '| Node | Type | Body schema | Body hash | Applicability |',
    '|---|---|---|---|---|',
    ...nodeRows,
    '',
    '## Normalized Edges',
    '',
    '| Edge | Type | From | To | Edge hash |',
    '|---|---|---|---|---|',
    ...edgeRows,
    '',
  ].join('\n');
  return {
    schemaVersion: 'requirements-contract-normalized-package-render/v1',
    packageHash: sha256Stable(input),
    canonicalJson: `${canonicalJson(input)}\n`,
    markdown,
    semanticBodyCount: Object.keys(input.semanticBodies).length,
    nodeCount: Object.keys(input.nodes).length,
    edgeCount: Object.keys(input.edges).length,
    duplicatedSemanticBodyCount,
    duplicateSemanticBodyInEdgeCount,
    hashDomainMismatchCount,
    decision:
      duplicatedSemanticBodyCount === 0 &&
      duplicateSemanticBodyInEdgeCount === 0 &&
      hashDomainMismatchCount === 0
        ? ('pass' as const)
        : ('block' as const),
  };
}
