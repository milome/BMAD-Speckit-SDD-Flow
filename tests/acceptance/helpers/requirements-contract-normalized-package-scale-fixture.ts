import { sha256Stable } from '../../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const SEED = '0x5EEDC0DE';
const PROOF_REF = 'PROOF-SCALE-001';

export function scaleNodeId(index: number): string {
  return `NODE-${String(index).padStart(6, '0')}`;
}

function pathEdgeId(index: number): string {
  return `EDGE-SPARSE-PATH-${String(index).padStart(6, '0')}`;
}

function parentEdgeId(index: number): string {
  return `EDGE-SPARSE-PARENT-${String(index).padStart(6, '0')}`;
}

function denseEdgeId(offset: number, index: number): string {
  return `EDGE-DENSE-${String(offset).padStart(2, '0')}-${String(index).padStart(6, '0')}`;
}

function applicability() {
  return {
    decision: 'applicable',
    reasonCode: 'scale_corpus',
    proofRefs: [PROOF_REF],
  };
}

export function buildScaleNodes(nodeCount: number) {
  const semanticBodies: Record<string, Record<string, unknown>> = {};
  const nodes: Record<string, Record<string, unknown>> = {};
  const bodyHashes: string[] = [];
  for (let index = 0; index < nodeCount; index += 1) {
    const id = scaleNodeId(index);
    const body = { nodeId: id, ordinal: index, seed: SEED };
    const bodyHash = sha256Stable(body);
    semanticBodies[bodyHash] = body;
    nodes[id] = {
      nodeType: 'requirement',
      bodySchemaVersion: 'requirements-contract-scale-node/v1',
      bodyHash,
      applicability: applicability(),
      proofBindings: [PROOF_REF],
    };
    bodyHashes.push(bodyHash);
  }
  return { semanticBodies, nodes, bodyHashes };
}

function edgeValue(
  edgeType: string,
  fromIndex: number,
  toIndex: number,
  bodyHashes: string[]
) {
  const preimage = {
    edgeType,
    fromRef: scaleNodeId(fromIndex),
    fromHash: bodyHashes[fromIndex],
    toRef: scaleNodeId(toIndex),
    toHash: bodyHashes[toIndex],
  };
  return {
    ...preimage,
    applicability: applicability(),
    proofBindings: [PROOF_REF],
    edgeHash: sha256Stable(preimage),
  };
}

export function buildScaleEdges(
  profile: 'sparse' | 'boundedDense',
  nodeCount: number,
  bodyHashes: string[]
) {
  const edges: Record<string, ReturnType<typeof edgeValue>> = {};
  if (profile === 'sparse') {
    for (let index = 0; index < nodeCount - 1; index += 1) {
      edges[pathEdgeId(index)] = edgeValue('scale_path', index, index + 1, bodyHashes);
    }
    for (let index = 1; index < nodeCount; index += 1) {
      edges[parentEdgeId(index)] = edgeValue(
        'scale_parent',
        Math.floor((index - 1) / 2),
        index,
        bodyHashes
      );
    }
    return edges;
  }
  for (let offset = 1; offset <= 8; offset += 1) {
    for (let index = 0; index < nodeCount; index += 1) {
      edges[denseEdgeId(offset, index)] = edgeValue(
        'scale_dense',
        index,
        (index + offset) % nodeCount,
        bodyHashes
      );
    }
  }
  return edges;
}
