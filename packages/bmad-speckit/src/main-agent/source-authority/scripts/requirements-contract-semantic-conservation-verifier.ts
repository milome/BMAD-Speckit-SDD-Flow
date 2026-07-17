export interface ConservationSourceRoot {
  order: number;
  sourceRootId: string;
  rootClass: string;
  sourceSpanRefs: string[];
  payloadHash: string;
  authorityClass: string;
}

export interface ConservationSemanticNode {
  order: number;
  nodeId: string;
  nodeHash: string;
  authorityClass: string;
  authorityBearing: true;
}

export interface RootToNodeMappingInput {
  sourceRootId: string;
  nodeId: string;
}

export type NodeAuthoritySource =
  | { kind: 'source_root'; sourceRootId: string }
  | { kind: 'decision_receipt'; decisionReceiptRef: string };

export interface NodeToAuthorityMappingInput {
  nodeId: string;
  authoritySource: NodeAuthoritySource;
}

export interface SemanticConservationVerificationInput {
  sourceRoots: ConservationSourceRoot[];
  semanticNodes: ConservationSemanticNode[];
  rootToNodeMappings: RootToNodeMappingInput[];
  nodeToAuthorityMappings: NodeToAuthorityMappingInput[];
  decisionReceiptRefs: string[];
}

export interface SemanticConservationVerificationResult {
  decision: 'pass' | 'block';
  sourceToIrMissingRootCount: number;
  sourceToIrExtraRootCount: number;
  sourceToIrPayloadMismatchCount: number;
  sourceToIrAuthorityMismatchCount: number;
  sourceToIrDuplicateRootCount: number;
}

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => keys.includes(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isUniqueNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length;
}

function isSourceRoot(value: unknown): value is ConservationSourceRoot {
  return isRecord(value) &&
    exactKeys(value, [
      'order',
      'sourceRootId',
      'rootClass',
      'sourceSpanRefs',
      'payloadHash',
      'authorityClass',
    ]) &&
    Number.isSafeInteger(value.order) &&
    Number(value.order) > 0 &&
    isNonEmptyString(value.sourceRootId) &&
    isNonEmptyString(value.rootClass) &&
    isUniqueNonEmptyStringArray(value.sourceSpanRefs) &&
    typeof value.payloadHash === 'string' &&
    HASH_PATTERN.test(value.payloadHash) &&
    isNonEmptyString(value.authorityClass);
}

function isSemanticNode(value: unknown): value is ConservationSemanticNode {
  return isRecord(value) &&
    exactKeys(value, ['order', 'nodeId', 'nodeHash', 'authorityClass', 'authorityBearing']) &&
    Number.isSafeInteger(value.order) &&
    Number(value.order) > 0 &&
    isNonEmptyString(value.nodeId) &&
    typeof value.nodeHash === 'string' &&
    HASH_PATTERN.test(value.nodeHash) &&
    isNonEmptyString(value.authorityClass) &&
    value.authorityBearing === true;
}

function isRootToNodeMapping(value: unknown): value is RootToNodeMappingInput {
  return isRecord(value) &&
    exactKeys(value, ['sourceRootId', 'nodeId']) &&
    isNonEmptyString(value.sourceRootId) &&
    isNonEmptyString(value.nodeId);
}

function isAuthoritySource(value: unknown): value is NodeAuthoritySource {
  if (!isRecord(value) || !isNonEmptyString(value.kind)) return false;
  if (value.kind === 'source_root') {
    return exactKeys(value, ['kind', 'sourceRootId']) && isNonEmptyString(value.sourceRootId);
  }
  if (value.kind === 'decision_receipt') {
    return exactKeys(value, ['kind', 'decisionReceiptRef']) &&
      isNonEmptyString(value.decisionReceiptRef);
  }
  return false;
}

function isNodeToAuthorityMapping(value: unknown): value is NodeToAuthorityMappingInput {
  return isRecord(value) &&
    exactKeys(value, ['nodeId', 'authoritySource']) &&
    isNonEmptyString(value.nodeId) &&
    isAuthoritySource(value.authoritySource);
}

function parsedInput(value: unknown): SemanticConservationVerificationInput {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'sourceRoots',
      'semanticNodes',
      'rootToNodeMappings',
      'nodeToAuthorityMappings',
      'decisionReceiptRefs',
    ]) ||
    !Array.isArray(value.sourceRoots) ||
    !value.sourceRoots.every(isSourceRoot) ||
    !Array.isArray(value.semanticNodes) ||
    !value.semanticNodes.every(isSemanticNode) ||
    !Array.isArray(value.rootToNodeMappings) ||
    !value.rootToNodeMappings.every(isRootToNodeMapping) ||
    !Array.isArray(value.nodeToAuthorityMappings) ||
    !value.nodeToAuthorityMappings.every(isNodeToAuthorityMapping) ||
    !isUniqueNonEmptyStringArray(value.decisionReceiptRefs)
  ) {
    throw new Error('Malformed Semantic Conservation verification input');
  }
  return value as unknown as SemanticConservationVerificationInput;
}

function duplicateOccurrenceCount(values: readonly string[]): number {
  return values.length - new Set(values).size;
}

function increment(counter: Map<string, number>, key: string): void {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

export function verifyRequirementsContractSemanticConservation(
  inputValue: unknown
): SemanticConservationVerificationResult {
  const input = parsedInput(inputValue);
  const rootById = new Map<string, ConservationSourceRoot>();
  for (const root of input.sourceRoots) {
    if (!rootById.has(root.sourceRootId)) rootById.set(root.sourceRootId, root);
  }
  const nodeById = new Map<string, ConservationSemanticNode>();
  for (const node of input.semanticNodes) {
    if (nodeById.has(node.nodeId)) {
      throw new Error(`Duplicate semantic node identity ${node.nodeId}`);
    }
    nodeById.set(node.nodeId, node);
  }

  const validMappings: RootToNodeMappingInput[] = [];
  let sourceToIrExtraRootCount = 0;
  for (const mapping of input.rootToNodeMappings) {
    if (!rootById.has(mapping.sourceRootId) || !nodeById.has(mapping.nodeId)) {
      sourceToIrExtraRootCount += 1;
      continue;
    }
    validMappings.push(mapping);
  }

  const mappingsPerRoot = new Map<string, number>();
  const mappingsPerNode = new Map<string, number>();
  for (const mapping of validMappings) {
    increment(mappingsPerRoot, mapping.sourceRootId);
    increment(mappingsPerNode, mapping.nodeId);
  }

  const sourceToIrMissingRootCount = [...rootById.keys()]
    .filter((rootId) => (mappingsPerRoot.get(rootId) ?? 0) === 0)
    .length;
  sourceToIrExtraRootCount += [...nodeById.keys()]
    .filter((nodeId) => (mappingsPerNode.get(nodeId) ?? 0) === 0)
    .length;
  sourceToIrExtraRootCount += [...mappingsPerNode.values()]
    .reduce((total, count) => total + Math.max(0, count - 1), 0);

  const sourceToIrDuplicateRootCount =
    duplicateOccurrenceCount(input.sourceRoots.map((root) => root.sourceRootId)) +
    [...mappingsPerRoot.values()].reduce(
      (total, count) => total + Math.max(0, count - 1),
      0
    );

  let sourceToIrPayloadMismatchCount = 0;
  let sourceToIrAuthorityMismatchCount = 0;
  const authorityMappingsByNode = new Map<string, NodeToAuthorityMappingInput[]>();
  for (const mapping of input.nodeToAuthorityMappings) {
    const existing = authorityMappingsByNode.get(mapping.nodeId) ?? [];
    existing.push(mapping);
    authorityMappingsByNode.set(mapping.nodeId, existing);
  }
  const decisionReceiptRefs = new Set(input.decisionReceiptRefs);

  for (const mapping of validMappings) {
    const root = rootById.get(mapping.sourceRootId);
    const node = nodeById.get(mapping.nodeId);
    if (!root || !node) continue;
    if (root.payloadHash !== node.nodeHash) sourceToIrPayloadMismatchCount += 1;

    const authorityMappings = authorityMappingsByNode.get(node.nodeId) ?? [];
    if (authorityMappings.length !== 1) {
      sourceToIrAuthorityMismatchCount += 1;
      continue;
    }
    const authoritySource = authorityMappings[0].authoritySource;
    if (authoritySource.kind === 'source_root') {
      if (
        authoritySource.sourceRootId !== root.sourceRootId ||
        root.authorityClass !== node.authorityClass
      ) {
        sourceToIrAuthorityMismatchCount += 1;
      }
    } else if (!decisionReceiptRefs.has(authoritySource.decisionReceiptRef)) {
      sourceToIrAuthorityMismatchCount += 1;
    }
  }

  for (const nodeId of authorityMappingsByNode.keys()) {
    if (!nodeById.has(nodeId)) sourceToIrAuthorityMismatchCount += 1;
  }

  const result = {
    sourceToIrMissingRootCount,
    sourceToIrExtraRootCount,
    sourceToIrPayloadMismatchCount,
    sourceToIrAuthorityMismatchCount,
    sourceToIrDuplicateRootCount,
  };
  return {
    decision: Object.values(result).some((count) => count !== 0) ? 'block' : 'pass',
    ...result,
  };
}
