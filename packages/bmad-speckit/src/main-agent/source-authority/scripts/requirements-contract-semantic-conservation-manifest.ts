import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import { sha256Stable } from './requirements-contract-semantic-resolver';
import { SOURCE_ROOT_CLASS_REGISTRY_HASH } from './requirements-contract-source-root-class-registry';
import {
  type ConservationSemanticNode,
  type ConservationSourceRoot,
  type NodeToAuthorityMappingInput,
  type RootToNodeMappingInput,
  type SemanticConservationVerificationResult,
  verifyRequirementsContractSemanticConservation,
} from './requirements-contract-semantic-conservation-verifier';

interface IdentityHash {
  id: string;
  hash: string;
}

interface DecisionReceipt {
  schemaVersion: 'requirements-decision-receipt/v1';
  receiptRef: string;
  receiptHash: string;
  [key: string]: unknown;
}

interface RootToNodeMapping extends RootToNodeMappingInput {
  mappingHash: string;
}

interface NodeToAuthorityMapping extends NodeToAuthorityMappingInput {
  mappingHash: string;
}

interface SemanticConservationHashChain {
  sourceAuthorityHash: string;
  decisionReceiptSetHash: string;
  semanticConservationManifestHash: string;
  semanticModelHash: string;
}

export interface RequirementsContractSemanticConservationManifest {
  schemaVersion: 'requirements-contract-semantic-conservation-manifest/v1';
  requirementSetId: string;
  intakeReceiptPath: string;
  intakeReceiptHash: string;
  intentLineageLedgerPath: string;
  intentLineageLedgerHash: string;
  sourceRootClassRegistryHash: string;
  sourceRoots: ConservationSourceRoot[];
  semanticNodes: ConservationSemanticNode[];
  rootToNodeMappings: RootToNodeMapping[];
  nodeToAuthorityMappings: NodeToAuthorityMapping[];
  decisionReceiptSetHash: string;
  unresolvedRootIds: string[];
  sourceToIrMissingRootCount: 0;
  sourceToIrExtraRootCount: 0;
  sourceToIrPayloadMismatchCount: 0;
  sourceToIrAuthorityMismatchCount: 0;
  sourceToIrDuplicateRootCount: 0;
  semanticModelHash: string;
  canonicalRenderer: IdentityHash;
  parser: IdentityHash;
  ruleRegistry: IdentityHash;
  lintProfileRegistry: IdentityHash;
  validationFacade: IdentityHash;
  schemaHashes: IdentityHash[];
  hashChain: SemanticConservationHashChain;
  manifestHash: string;
}

interface CreateSemanticConservationManifestInput {
  requirementSetId: string;
  intakeReceiptPath: string;
  intakeReceiptHash: string;
  intentLineageLedgerPath: string;
  intentLineageLedgerHash: string;
  sourceRootClassRegistryHash: string;
  sourceRoots: ConservationSourceRoot[];
  semanticNodes: ConservationSemanticNode[];
  rootToNodeMappings: RootToNodeMappingInput[];
  nodeToAuthorityMappings: NodeToAuthorityMappingInput[];
  decisionReceipts: DecisionReceipt[];
  unresolvedRootIds: string[];
  semanticModelHash: string;
  canonicalRenderer: IdentityHash;
  parser: IdentityHash;
  ruleRegistry: IdentityHash;
  lintProfileRegistry: IdentityHash;
  validationFacade: IdentityHash;
  schemaHashes: IdentityHash[];
  sourceAuthorityHash: string;
}

const MANIFEST_SCHEMA_FILE = 'requirements-contract-semantic-conservation-manifest.schema.json';
const DECISION_SCHEMA_FILE = 'requirements-decision-receipt.schema.json';
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
let manifestValidator: ValidateFunction | null = null;
let decisionValidator: ValidateFunction | null = null;

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

function isHash(value: unknown): value is string {
  return typeof value === 'string' && HASH_PATTERN.test(value);
}

function isIdentityHash(value: unknown): value is IdentityHash {
  return isRecord(value) &&
    exactKeys(value, ['id', 'hash']) &&
    isNonEmptyString(value.id) &&
    isHash(value.hash);
}

function isUniqueNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every(isNonEmptyString) &&
    new Set(value).size === value.length;
}

function schemaValidator(fileName: string): ValidateFunction {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return ajv.compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', fileName), 'utf8'))
  );
}

function validateDecisionReceipt(value: unknown): value is DecisionReceipt {
  if (!decisionValidator) decisionValidator = schemaValidator(DECISION_SCHEMA_FILE);
  if (!decisionValidator(value) || !isRecord(value) || !isHash(value.receiptHash)) return false;
  const { receiptHash, ...payload } = value;
  return receiptHash === sha256Stable(payload);
}

function validateIdentitySet(values: unknown): values is IdentityHash[] {
  return Array.isArray(values) &&
    values.length > 0 &&
    values.every(isIdentityHash) &&
    new Set(values.map((value) => value.id)).size === values.length;
}

function parsedInput(value: unknown): CreateSemanticConservationManifestInput {
  const keys = [
    'requirementSetId',
    'intakeReceiptPath',
    'intakeReceiptHash',
    'intentLineageLedgerPath',
    'intentLineageLedgerHash',
    'sourceRootClassRegistryHash',
    'sourceRoots',
    'semanticNodes',
    'rootToNodeMappings',
    'nodeToAuthorityMappings',
    'decisionReceipts',
    'unresolvedRootIds',
    'semanticModelHash',
    'canonicalRenderer',
    'parser',
    'ruleRegistry',
    'lintProfileRegistry',
    'validationFacade',
    'schemaHashes',
    'sourceAuthorityHash',
  ];
  if (
    !isRecord(value) ||
    !exactKeys(value, keys) ||
    !isNonEmptyString(value.requirementSetId) ||
    !isNonEmptyString(value.intakeReceiptPath) ||
    !isHash(value.intakeReceiptHash) ||
    !isNonEmptyString(value.intentLineageLedgerPath) ||
    !isHash(value.intentLineageLedgerHash) ||
    value.sourceRootClassRegistryHash !== SOURCE_ROOT_CLASS_REGISTRY_HASH ||
    !Array.isArray(value.sourceRoots) ||
    !Array.isArray(value.semanticNodes) ||
    !Array.isArray(value.rootToNodeMappings) ||
    !Array.isArray(value.nodeToAuthorityMappings) ||
    !Array.isArray(value.decisionReceipts) ||
    !value.decisionReceipts.every(validateDecisionReceipt) ||
    !isUniqueNonEmptyStringArray(value.unresolvedRootIds) ||
    !isHash(value.semanticModelHash) ||
    !isIdentityHash(value.canonicalRenderer) ||
    !isIdentityHash(value.parser) ||
    !isIdentityHash(value.ruleRegistry) ||
    !isIdentityHash(value.lintProfileRegistry) ||
    !isIdentityHash(value.validationFacade) ||
    !validateIdentitySet(value.schemaHashes) ||
    !isHash(value.sourceAuthorityHash)
  ) {
    throw new Error('Malformed Semantic Conservation Manifest input');
  }
  const receiptRefs = value.decisionReceipts.map((receipt) => receipt.receiptRef);
  if (new Set(receiptRefs).size !== receiptRefs.length) {
    throw new Error('Decision Receipt identities must be unique');
  }
  return value as unknown as CreateSemanticConservationManifestInput;
}

function byOrderThenId(
  left: { order: number },
  right: { order: number },
  leftId: string,
  rightId: string
): number {
  return left.order - right.order || leftId.localeCompare(rightId);
}

function assertUniqueOrders(values: Array<{ order: number }>, label: string): void {
  const orders = values.map((value) => value.order);
  if (new Set(orders).size !== orders.length) {
    throw new Error(`${label} orders must be unique`);
  }
}

function mappingHash<T extends RootToNodeMappingInput | NodeToAuthorityMappingInput>(
  mapping: T
): T & { mappingHash: string } {
  return { ...mapping, mappingHash: sha256Stable(mapping) };
}

function blockMessage(result: SemanticConservationVerificationResult): string {
  if (result.sourceToIrMissingRootCount > 0) {
    return `Semantic Conservation blocked by missing root count ${result.sourceToIrMissingRootCount}`;
  }
  if (result.sourceToIrDuplicateRootCount > 0) {
    return `Semantic Conservation blocked by duplicate root count ${result.sourceToIrDuplicateRootCount}`;
  }
  if (result.sourceToIrPayloadMismatchCount > 0) {
    return `Semantic Conservation blocked by payload mismatch count ${result.sourceToIrPayloadMismatchCount}`;
  }
  if (result.sourceToIrAuthorityMismatchCount > 0) {
    return `Semantic Conservation blocked by authority mismatch count ${result.sourceToIrAuthorityMismatchCount}`;
  }
  return `Semantic Conservation blocked by extra root count ${result.sourceToIrExtraRootCount}`;
}

function manifestPreimage(
  manifest: Omit<RequirementsContractSemanticConservationManifest, 'manifestHash'>
): unknown {
  const {
    semanticConservationManifestHash: _selfHash,
    ...hashChainWithoutSelf
  } = manifest.hashChain;
  return {
    ...manifest,
    hashChain: hashChainWithoutSelf,
  };
}

export function createRequirementsContractSemanticConservationManifest(
  inputValue: unknown
): RequirementsContractSemanticConservationManifest {
  const input = parsedInput(inputValue);
  const decisionReceipts = [...input.decisionReceipts]
    .sort((left, right) => left.receiptRef.localeCompare(right.receiptRef));
  const decisionReceiptRefs = decisionReceipts.map((receipt) => receipt.receiptRef);
  const verification = verifyRequirementsContractSemanticConservation({
    sourceRoots: input.sourceRoots,
    semanticNodes: input.semanticNodes,
    rootToNodeMappings: input.rootToNodeMappings,
    nodeToAuthorityMappings: input.nodeToAuthorityMappings,
    decisionReceiptRefs,
  });
  if (verification.decision !== 'pass') throw new Error(blockMessage(verification));

  const sourceRoots = [...input.sourceRoots]
    .sort((left, right) => byOrderThenId(left, right, left.sourceRootId, right.sourceRootId));
  const semanticNodes = [...input.semanticNodes]
    .sort((left, right) => byOrderThenId(left, right, left.nodeId, right.nodeId));
  assertUniqueOrders(sourceRoots, 'Source Root');
  assertUniqueOrders(semanticNodes, 'Semantic node');

  const rootToNodeMappings = [...input.rootToNodeMappings]
    .sort((left, right) =>
      left.sourceRootId.localeCompare(right.sourceRootId) || left.nodeId.localeCompare(right.nodeId)
    )
    .map(mappingHash);
  const nodeToAuthorityMappings = [...input.nodeToAuthorityMappings]
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
    .map(mappingHash);
  const schemaHashes = [...input.schemaHashes].sort((left, right) => left.id.localeCompare(right.id));
  const unresolvedRootIds = [...input.unresolvedRootIds].sort();
  const rootIds = new Set(sourceRoots.map((root) => root.sourceRootId));
  if (unresolvedRootIds.some((rootId) => !rootIds.has(rootId))) {
    throw new Error('Unresolved inventory references an unknown Source Root');
  }

  const decisionReceiptSetHash = sha256Stable(decisionReceipts);
  const base = {
    schemaVersion: 'requirements-contract-semantic-conservation-manifest/v1' as const,
    requirementSetId: input.requirementSetId,
    intakeReceiptPath: input.intakeReceiptPath,
    intakeReceiptHash: input.intakeReceiptHash,
    intentLineageLedgerPath: input.intentLineageLedgerPath,
    intentLineageLedgerHash: input.intentLineageLedgerHash,
    sourceRootClassRegistryHash: input.sourceRootClassRegistryHash,
    sourceRoots,
    semanticNodes,
    rootToNodeMappings,
    nodeToAuthorityMappings,
    decisionReceiptSetHash,
    unresolvedRootIds,
    sourceToIrMissingRootCount: 0 as const,
    sourceToIrExtraRootCount: 0 as const,
    sourceToIrPayloadMismatchCount: 0 as const,
    sourceToIrAuthorityMismatchCount: 0 as const,
    sourceToIrDuplicateRootCount: 0 as const,
    semanticModelHash: input.semanticModelHash,
    canonicalRenderer: input.canonicalRenderer,
    parser: input.parser,
    ruleRegistry: input.ruleRegistry,
    lintProfileRegistry: input.lintProfileRegistry,
    validationFacade: input.validationFacade,
    schemaHashes,
  };
  const hashChainWithoutSelf = {
    sourceAuthorityHash: input.sourceAuthorityHash,
    decisionReceiptSetHash,
    semanticModelHash: input.semanticModelHash,
  };
  const manifestHash = sha256Stable({ ...base, hashChain: hashChainWithoutSelf });
  const manifest: RequirementsContractSemanticConservationManifest = {
    ...base,
    hashChain: {
      sourceAuthorityHash: input.sourceAuthorityHash,
      decisionReceiptSetHash,
      semanticConservationManifestHash: manifestHash,
      semanticModelHash: input.semanticModelHash,
    },
    manifestHash,
  };
  if (!validateRequirementsContractSemanticConservationManifest(manifest)) {
    throw new Error('Generated Semantic Conservation Manifest failed schema or hash validation');
  }
  return manifest;
}

export function validateRequirementsContractSemanticConservationManifest(value: unknown): boolean {
  if (!manifestValidator) manifestValidator = schemaValidator(MANIFEST_SCHEMA_FILE);
  if (!manifestValidator(value) || !isRecord(value)) return false;
  const manifest = value as unknown as RequirementsContractSemanticConservationManifest;
  if (
    manifest.sourceRootClassRegistryHash !== SOURCE_ROOT_CLASS_REGISTRY_HASH ||
    manifest.hashChain.decisionReceiptSetHash !== manifest.decisionReceiptSetHash ||
    manifest.hashChain.semanticModelHash !== manifest.semanticModelHash ||
    manifest.hashChain.semanticConservationManifestHash !== manifest.manifestHash
  ) {
    return false;
  }
  if (
    manifest.rootToNodeMappings.some(({ mappingHash: actual, ...mapping }) =>
      actual !== sha256Stable(mapping)
    ) ||
    manifest.nodeToAuthorityMappings.some(({ mappingHash: actual, ...mapping }) =>
      actual !== sha256Stable(mapping)
    ) ||
    new Set(manifest.sourceRoots.map((root) => root.order)).size !== manifest.sourceRoots.length ||
    new Set(manifest.semanticNodes.map((node) => node.order)).size !== manifest.semanticNodes.length ||
    new Set(manifest.schemaHashes.map((identity) => identity.id)).size !==
      manifest.schemaHashes.length
  ) {
    return false;
  }
  const decisionReceiptRefs = manifest.nodeToAuthorityMappings.flatMap((mapping) =>
    mapping.authoritySource.kind === 'decision_receipt'
      ? [mapping.authoritySource.decisionReceiptRef]
      : []
  );
  try {
    const verification = verifyRequirementsContractSemanticConservation({
      sourceRoots: manifest.sourceRoots,
      semanticNodes: manifest.semanticNodes,
      rootToNodeMappings: manifest.rootToNodeMappings.map(
        ({ mappingHash: _mappingHash, ...mapping }) => mapping
      ),
      nodeToAuthorityMappings: manifest.nodeToAuthorityMappings.map(
        ({ mappingHash: _mappingHash, ...mapping }) => mapping
      ),
      decisionReceiptRefs: [...new Set(decisionReceiptRefs)],
    });
    if (verification.decision !== 'pass') return false;
  } catch {
    return false;
  }
  const { manifestHash, ...payload } = manifest;
  return manifestHash === sha256Stable(manifestPreimage(payload));
}
