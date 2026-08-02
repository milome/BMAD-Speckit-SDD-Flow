import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sha256Stable } from './requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;

export interface EvidenceArtifactReadbackContext {
  requirementSetId: string;
  transactionId: string;
  implementationAttemptId: string;
}

export interface EvidenceArtifactReadbackValidationResult {
  decision: 'pass' | 'block';
  issueCodes: string[];
  acceptedReceipts: Array<{
    artifactPath: string;
    artifactHash: string;
    receiptPath: string;
    receiptHash: string;
  }>;
}

interface EvidenceArtifactDescriptor {
  artifactType: string;
  artifactPath: string;
  artifactHash: string;
  artifactSchemaPath: string;
  producer: string;
  requirementRefs: string[];
  receiptPath: string;
}

interface EvidenceArtifactReadbackReceipt {
  schemaVersion: 'requirements-contract-evidence-artifact-readback-receipt/v1';
  artifactId: string;
  artifactType: string;
  artifactPath: string;
  artifactHash: string;
  artifactSchemaPath: string;
  artifactSchemaHash: string;
  producerIdentity: {
    class: 'controlled_artifact_producer' | 'goal_controlled_executor';
    id: string;
  };
  requirementSetId: string;
  requirementRefs: string[];
  transactionId: string;
  implementationAttemptId: string;
  publishedAt: string;
  readbackAt: string;
  publication: {
    targetPath: string;
    publishedHash: string;
    readbackHash: string;
    readbackVerified: true;
  };
  decision: 'pass' | 'block';
  receiptHash: string;
}

const RECEIPT_SCHEMA_FILE =
  'requirements-contract-evidence-artifact-readback-receipt.schema.json';
let receiptValidator: ValidateFunction | null = null;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function sameStrings(left: string[], right: string[]): boolean {
  const normalizedLeft = [...new Set(left)].sort();
  const normalizedRight = [...new Set(right)].sort();
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function normalizedPath(value: string): string {
  return path.resolve(value).replace(/\\/gu, '/');
}

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function resolveWithinRoot(
  projectRoot: string,
  candidate: string,
  requireExisting = false
): string | null {
  const root = path.resolve(projectRoot);
  const resolved = path.isAbsolute(candidate)
    ? path.resolve(candidate)
    : path.resolve(root, candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  if (!fs.existsSync(resolved)) return requireExisting ? null : resolved;
  const realRoot = fs.realpathSync.native(root);
  const realCandidate = fs.realpathSync.native(resolved);
  if (
    realCandidate !== realRoot &&
    !realCandidate.startsWith(`${realRoot}${path.sep}`)
  ) {
    return null;
  }
  return resolved;
}

function getReceiptValidator(): ValidateFunction {
  if (receiptValidator) return receiptValidator;
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    RECEIPT_SCHEMA_FILE
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  receiptValidator = ajv.compile(
    JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
  );
  return receiptValidator;
}

function descriptorFromArtifact(
  artifact: JsonRecord
): { descriptor: EvidenceArtifactDescriptor | null; issueCodes: string[] } {
  const artifactPath = text(artifact.path);
  const label = artifactPath || 'unknown';
  const descriptor: EvidenceArtifactDescriptor = {
    artifactType: text(artifact.artifactType),
    artifactPath,
    artifactHash: text(artifact.hash ?? artifact.contentHash),
    artifactSchemaPath: text(artifact.schemaPath),
    producer: text(artifact.producer),
    requirementRefs: strings(artifact.relatedRequirementIds),
    receiptPath: text(artifact.readbackReceiptPath),
  };
  const missing = Object.entries(descriptor)
    .filter(([, value]) => Array.isArray(value) ? value.length === 0 : !value)
    .map(([field]) => `evidence_artifact_descriptor_invalid:${label}:${field}`);
  return {
    descriptor: missing.length === 0 ? descriptor : null,
    issueCodes: missing,
  };
}

function artifactLabel(projectRoot: string, artifactPath: string): string {
  const resolved = path.isAbsolute(artifactPath)
    ? path.resolve(artifactPath)
    : path.resolve(projectRoot, artifactPath);
  const relative = path.relative(path.resolve(projectRoot), resolved).replace(/\\/gu, '/');
  return relative && !relative.startsWith('..') ? relative : artifactPath.replace(/\\/gu, '/');
}

function validateArtifact(input: {
  projectRoot: string;
  descriptor: EvidenceArtifactDescriptor;
  context: EvidenceArtifactReadbackContext;
}): {
  issueCodes: string[];
  acceptedReceipt: EvidenceArtifactReadbackValidationResult['acceptedReceipts'][number] | null;
} {
  const label = artifactLabel(input.projectRoot, input.descriptor.artifactPath);
  const artifactPath = resolveWithinRoot(
    input.projectRoot,
    input.descriptor.artifactPath,
    true
  );
  if (!artifactPath || !fs.statSync(artifactPath).isFile()) {
    return {
      issueCodes: [`evidence_artifact_missing:${label}`],
      acceptedReceipt: null,
    };
  }
  const receiptPath = resolveWithinRoot(
    input.projectRoot,
    input.descriptor.receiptPath,
    true
  );
  if (!receiptPath || !fs.statSync(receiptPath).isFile()) {
    return {
      issueCodes: [`evidence_artifact_readback_receipt_missing:${label}`],
      acceptedReceipt: null,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as unknown;
  } catch {
    return {
      issueCodes: [`evidence_artifact_readback_receipt_schema_invalid:${label}`],
      acceptedReceipt: null,
    };
  }
  if (!getReceiptValidator()(parsed) || !isRecord(parsed)) {
    return {
      issueCodes: [`evidence_artifact_readback_receipt_schema_invalid:${label}`],
      acceptedReceipt: null,
    };
  }
  const receipt = parsed as unknown as EvidenceArtifactReadbackReceipt;
  const { receiptHash, ...payload } = receipt;
  if (receiptHash !== sha256Stable(payload)) {
    return {
      issueCodes: [`evidence_artifact_readback_receipt_hash_mismatch:${label}`],
      acceptedReceipt: null,
    };
  }
  const bindingChecks: Array<[string, boolean]> = [
    ['artifactType', receipt.artifactType === input.descriptor.artifactType],
    [
      'artifactPath',
      normalizedPath(receipt.artifactPath) === normalizedPath(artifactPath),
    ],
    ['artifactHash', receipt.artifactHash === input.descriptor.artifactHash],
    [
      'artifactSchemaPath',
      normalizedPath(receipt.artifactSchemaPath) ===
        normalizedPath(input.descriptor.artifactSchemaPath),
    ],
    ['producerIdentity', receipt.producerIdentity.id === input.descriptor.producer],
    ['requirementSetId', receipt.requirementSetId === input.context.requirementSetId],
    [
      'requirementRefs',
      sameStrings(receipt.requirementRefs, input.descriptor.requirementRefs),
    ],
    ['transactionId', receipt.transactionId === input.context.transactionId],
    [
      'implementationAttemptId',
      receipt.implementationAttemptId === input.context.implementationAttemptId,
    ],
  ];
  const failedBinding = bindingChecks.find(([, valid]) => !valid);
  if (failedBinding) {
    return {
      issueCodes: [
        `evidence_artifact_readback_binding_mismatch:${label}:${failedBinding[0]}`,
      ],
      acceptedReceipt: null,
    };
  }
  if (
    normalizedPath(receipt.publication.targetPath) !== normalizedPath(artifactPath) ||
    receipt.publication.publishedHash !== receipt.artifactHash ||
    receipt.publication.readbackHash !== receipt.artifactHash
  ) {
    return {
      issueCodes: [`evidence_artifact_readback_publication_invalid:${label}`],
      acceptedReceipt: null,
    };
  }
  const publishedAt = Date.parse(receipt.publishedAt);
  const readbackAt = Date.parse(receipt.readbackAt);
  if (
    Number.isNaN(publishedAt) ||
    Number.isNaN(readbackAt) ||
    readbackAt < publishedAt
  ) {
    return {
      issueCodes: [`evidence_artifact_readback_timestamp_invalid:${label}`],
      acceptedReceipt: null,
    };
  }
  const artifactSchemaPath = resolveWithinRoot(
    input.projectRoot,
    receipt.artifactSchemaPath,
    true
  );
  if (
    !artifactSchemaPath ||
    !fs.statSync(artifactSchemaPath).isFile() ||
    fileHash(artifactSchemaPath) !== receipt.artifactSchemaHash
  ) {
    return {
      issueCodes: [`evidence_artifact_schema_binding_invalid:${label}`],
      acceptedReceipt: null,
    };
  }
  const actualArtifactHash = fileHash(artifactPath);
  if (
    actualArtifactHash !== input.descriptor.artifactHash ||
    actualArtifactHash !== receipt.artifactHash
  ) {
    return {
      issueCodes: [`evidence_artifact_hash_mismatch:${label}`],
      acceptedReceipt: null,
    };
  }
  try {
    const artifactSchema = JSON.parse(
      fs.readFileSync(artifactSchemaPath, 'utf8')
    ) as object;
    const artifactValue = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as unknown;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    if (!ajv.compile(artifactSchema)(artifactValue)) {
      return {
        issueCodes: [`evidence_artifact_schema_invalid:${label}`],
        acceptedReceipt: null,
      };
    }
  } catch {
    return {
      issueCodes: [`evidence_artifact_schema_invalid:${label}`],
      acceptedReceipt: null,
    };
  }
  if (receipt.decision !== 'pass') {
    return {
      issueCodes: [`evidence_artifact_readback_non_pass:${label}`],
      acceptedReceipt: null,
    };
  }
  return {
    issueCodes: [],
    acceptedReceipt: {
      artifactPath,
      artifactHash: actualArtifactHash,
      receiptPath,
      receiptHash,
    },
  };
}

export function validateEvidenceArtifactReadbackReceipts(input: {
  projectRoot: string;
  artifacts: JsonRecord[];
  context: EvidenceArtifactReadbackContext;
}): EvidenceArtifactReadbackValidationResult {
  const issueCodes: string[] = [];
  const acceptedReceipts: EvidenceArtifactReadbackValidationResult['acceptedReceipts'] = [];
  const seen = new Set<string>();
  for (const artifact of input.artifacts) {
    if (text(artifact.sourceOfTruthRole) !== 'evidence') continue;
    const parsed = descriptorFromArtifact(artifact);
    issueCodes.push(...parsed.issueCodes);
    if (!parsed.descriptor) continue;
    const key = `${normalizedPath(parsed.descriptor.artifactPath)}|${normalizedPath(
      parsed.descriptor.receiptPath
    )}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const result = validateArtifact({
      projectRoot: input.projectRoot,
      descriptor: parsed.descriptor,
      context: input.context,
    });
    issueCodes.push(...result.issueCodes);
    if (result.acceptedReceipt) acceptedReceipts.push(result.acceptedReceipt);
  }
  const evidenceArtifactCount = input.artifacts.filter(
    (artifact) => text(artifact.sourceOfTruthRole) === 'evidence'
  ).reduce((keys, artifact) => {
    const artifactPath = text(artifact.path);
    const receiptPath = text(artifact.readbackReceiptPath);
    if (artifactPath && receiptPath) {
      keys.add(`${normalizedPath(artifactPath)}|${normalizedPath(receiptPath)}`);
    }
    return keys;
  }, new Set<string>()).size;
  return {
    decision:
      issueCodes.length === 0 && acceptedReceipts.length === evidenceArtifactCount
        ? 'pass'
        : 'block',
    issueCodes: [...new Set(issueCodes)],
    acceptedReceipts,
  };
}
