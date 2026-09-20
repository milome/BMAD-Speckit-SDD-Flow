import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sourceBytesHash } from './requirements-contract-hash-domains';
import {
  readRequirementsContentObject,
  publishRequirementsContentObject,
  type RequirementsContentRef,
} from './requirements-contract-content-store';
import { sha256Stable, sha256Text } from './requirements-contract-semantic-resolver';
import {
  buildUtf8LineIndex,
  lineRangeToByteRange,
  sliceAndHashSourceRange,
} from './requirements-contract-utf8-source-index';

export type FileIntakeEntrySource = 'bmad_prd' | 'source_prd_draft';

export interface RequirementsContractFileIntakeReceipt {
  schemaVersion: 'requirements-contract-file-intake-receipt/v1';
  requirementSetId: string;
  entrySource: FileIntakeEntrySource;
  requestedArtifactRole: 'product_prd' | 'requirement_source_prd';
  sourcePath: string;
  sourceContentHash: string;
  sourceByteLength: number;
  excerpts: Array<{
    order: number;
    excerptId: string;
    actorIdentityClass: 'source_document';
    content: string;
    contentHash: string;
    boundary: {
      kind: 'file';
      sourcePath: string;
      startUtf8Byte: number;
      endUtf8ByteExclusive: number;
      startLine: number;
      endLine: number;
    };
  }>;
  capturedAt: string;
  receiptHash: string;
}

export interface RequirementsContractFileIntakeReceiptV2 {
  schemaVersion: 'requirements-contract-file-intake-receipt/v2';
  requirementSetId: string;
  entrySource: FileIntakeEntrySource;
  requestedArtifactRole: 'product_prd' | 'requirement_source_prd';
  sourceId: string;
  sourcePath: string;
  sourceBlobRef: RequirementsContentRef;
  sourceBytesHash: string;
  sourceByteLength: number;
  lineCount: number;
  materialExcerpts: Array<{
    order: number;
    excerptId: string;
    sourceRootId: string;
    range: {
      startUtf8Byte: number;
      endUtf8ByteExclusive: number;
      startLine: number;
      endLine: number;
      contentHash: string;
    };
  }>;
  materialExcerptSetHash: string;
  capturedAt: string;
  receiptHash: string;
}

const SCHEMA_FILE = 'requirements-contract-file-intake-receipt.schema.json';
let validator: ValidateFunction | null = null;

function schemaValidator(): ValidateFunction {
  if (validator) return validator;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  validator = ajv.compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE), 'utf8'))
  );
  return validator;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be a non-empty string`);
  return normalized;
}

function sourceLineExcerpts(
  sourcePath: string,
  sourceContent: string
): RequirementsContractFileIntakeReceipt['excerpts'] {
  const excerpts: RequirementsContractFileIntakeReceipt['excerpts'] = [];
  const pattern = /[^\r\n]*(?:\r\n|\n|\r|$)/gu;
  let startUtf8Byte = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sourceContent)) !== null) {
    const content = match[0];
    if (!content) break;
    const order = excerpts.length + 1;
    const contentHash = sha256Text(content);
    const endUtf8ByteExclusive = startUtf8Byte + Buffer.byteLength(content, 'utf8');
    excerpts.push({
      order,
      excerptId: `file-excerpt-${sha256Stable({
        sourcePath,
        startUtf8Byte,
        endUtf8ByteExclusive,
        contentHash,
      }).slice('sha256:'.length, 'sha256:'.length + 24)}`,
      actorIdentityClass: 'source_document',
      content,
      contentHash,
      boundary: {
        kind: 'file',
        sourcePath,
        startUtf8Byte,
        endUtf8ByteExclusive,
        startLine: order,
        endLine: order,
      },
    });
    startUtf8Byte = endUtf8ByteExclusive;
  }
  if (excerpts.length === 0 || startUtf8Byte !== Buffer.byteLength(sourceContent, 'utf8')) {
    throw new Error('File Intake excerpts do not cover the complete source bytes');
  }
  return excerpts;
}

export function createRequirementsContractFileIntakeReceipt(input: {
  requirementSetId: string;
  entrySource: FileIntakeEntrySource;
  requestedArtifactRole: RequirementsContractFileIntakeReceipt['requestedArtifactRole'];
  sourcePath: string;
  sourceContent: string;
  capturedAt: string;
}): RequirementsContractFileIntakeReceipt {
  const sourcePath = requiredText(input.sourcePath, 'sourcePath').replace(/\\/gu, '/');
  const sourceContent = input.sourceContent;
  if (!sourceContent.trim()) throw new Error('sourceContent must be a non-empty string');
  const sourceByteLength = Buffer.byteLength(sourceContent, 'utf8');
  if (Number.isNaN(Date.parse(input.capturedAt))) {
    throw new Error('capturedAt must be an ISO-8601 timestamp');
  }
  const contentHash = sha256Text(sourceContent);
  const excerpts = sourceLineExcerpts(sourcePath, sourceContent);
  const payload = {
    schemaVersion: 'requirements-contract-file-intake-receipt/v1' as const,
    requirementSetId: requiredText(input.requirementSetId, 'requirementSetId'),
    entrySource: input.entrySource,
    requestedArtifactRole: input.requestedArtifactRole,
    sourcePath,
    sourceContentHash: contentHash,
    sourceByteLength,
    excerpts,
    capturedAt: input.capturedAt,
  };
  const receipt = { ...payload, receiptHash: sha256Stable(payload) };
  if (!validateRequirementsContractFileIntakeReceipt(receipt)) {
    throw new Error('Generated File Intake Receipt failed schema or hash validation');
  }
  return receipt;
}

export function createRequirementsContractFileIntakeReceiptV2(input: {
  recordRoot: string;
  requirementSetId: string;
  entrySource: FileIntakeEntrySource;
  requestedArtifactRole: RequirementsContractFileIntakeReceiptV2['requestedArtifactRole'];
  sourcePath: string;
  sourceContent: string;
  materialRoots: Array<{ sourceRootId: string; startLine: number; endLine: number }>;
  capturedAt: string;
}): RequirementsContractFileIntakeReceiptV2 {
  const sourcePath = requiredText(input.sourcePath, 'sourcePath').replace(/\\/gu, '/');
  if (!input.sourceContent.trim()) throw new Error('sourceContent must be a non-empty string');
  if (Number.isNaN(Date.parse(input.capturedAt))) {
    throw new Error('capturedAt must be an ISO-8601 timestamp');
  }
  const bytes = Buffer.from(input.sourceContent, 'utf8');
  const sourceContentHash = sourceBytesHash(bytes);
  const sourceBlobRef = publishRequirementsContentObject({
    recordRoot: input.recordRoot,
    role: 'requirements_source',
    mediaType: 'text/markdown; charset=utf-8',
    bytes,
  });
  const index = buildUtf8LineIndex(bytes);
  const materialExcerpts = input.materialRoots.map((root) => {
    const sourceRootId = requiredText(root.sourceRootId, 'sourceRootId');
    const byteRange = lineRangeToByteRange(index, root.startLine, root.endLine);
    const range = {
      ...byteRange,
      startLine: root.startLine,
      endLine: root.endLine,
      contentHash: sliceAndHashSourceRange(bytes, byteRange),
    };
    return { sourceRootId, range };
  }).sort((left, right) =>
    left.range.startUtf8Byte - right.range.startUtf8Byte ||
    left.sourceRootId.localeCompare(right.sourceRootId)
  ).map((excerpt, indexValue) => ({
    order: indexValue + 1,
    excerptId: `file-excerpt-${sha256Stable({
      sourceContentHash,
      sourceRootId: excerpt.sourceRootId,
      range: excerpt.range,
    }).slice('sha256:'.length, 'sha256:'.length + 24)}`,
    ...excerpt,
  }));
  const materialExcerptSetHash = sha256Stable(materialExcerpts);
  const payload = {
    schemaVersion: 'requirements-contract-file-intake-receipt/v2' as const,
    requirementSetId: requiredText(input.requirementSetId, 'requirementSetId'),
    entrySource: input.entrySource,
    requestedArtifactRole: input.requestedArtifactRole,
    sourceId: `SOURCE-${sourceContentHash.slice('sha256:'.length, 'sha256:'.length + 24).toUpperCase()}`,
    sourcePath,
    sourceBlobRef,
    sourceBytesHash: sourceContentHash,
    sourceByteLength: bytes.length,
    lineCount: index.lineStartOffsets.length,
    materialExcerpts,
    materialExcerptSetHash,
    capturedAt: input.capturedAt,
  };
  const receipt = { ...payload, receiptHash: sha256Stable(payload) };
  if (!validateRequirementsContractFileIntakeReceipt(receipt, { recordRoot: input.recordRoot })) {
    throw new Error('Generated File Intake Receipt v2 failed schema or source binding validation');
  }
  return receipt;
}

function validateV1Receipt(receipt: RequirementsContractFileIntakeReceipt): boolean {
  if (receipt.excerpts.length === 0) return false;
  let expectedStartUtf8Byte = 0;
  for (const [index, excerpt] of receipt.excerpts.entries()) {
    if (
      excerpt.order !== index + 1 ||
      excerpt.contentHash !== sha256Text(excerpt.content) ||
      excerpt.boundary.sourcePath !== receipt.sourcePath ||
      excerpt.boundary.startUtf8Byte !== expectedStartUtf8Byte ||
      excerpt.boundary.endUtf8ByteExclusive !==
        expectedStartUtf8Byte + Buffer.byteLength(excerpt.content, 'utf8') ||
      excerpt.boundary.startLine !== index + 1 ||
      excerpt.boundary.endLine !== index + 1
    ) {
      return false;
    }
    expectedStartUtf8Byte = excerpt.boundary.endUtf8ByteExclusive;
  }
  const reconstructedContent = receipt.excerpts.map((excerpt) => excerpt.content).join('');
  if (
    new Set(receipt.excerpts.map((excerpt) => excerpt.excerptId)).size !==
      receipt.excerpts.length ||
    receipt.sourceContentHash !== sha256Text(reconstructedContent) ||
    receipt.sourceByteLength !== Buffer.byteLength(reconstructedContent, 'utf8') ||
    expectedStartUtf8Byte !== receipt.sourceByteLength
  ) {
    return false;
  }
  const { receiptHash, ...payload } = receipt;
  return receiptHash === sha256Stable(payload);
}

function validateV2Receipt(
  receipt: RequirementsContractFileIntakeReceiptV2,
  options?: { recordRoot?: string }
): boolean {
  if (
    receipt.sourceBlobRef.contentHash !== receipt.sourceBytesHash ||
    receipt.sourceBlobRef.byteLength !== receipt.sourceByteLength ||
    receipt.materialExcerptSetHash !== sha256Stable(receipt.materialExcerpts) ||
    receipt.lineCount < 1
  ) {
    return false;
  }
  const expectedSourceId = `SOURCE-${receipt.sourceBytesHash
    .slice('sha256:'.length, 'sha256:'.length + 24)
    .toUpperCase()}`;
  if (receipt.sourceId !== expectedSourceId) return false;
  let sourceBytes: Buffer | undefined;
  if (options?.recordRoot) {
    try {
      sourceBytes = readRequirementsContentObject({
        recordRoot: options.recordRoot,
        ref: receipt.sourceBlobRef,
      });
    } catch {
      return false;
    }
    if (sourceBytesHash(sourceBytes) !== receipt.sourceBytesHash) return false;
  }
  const lineIndex = sourceBytes ? buildUtf8LineIndex(sourceBytes) : undefined;
  let previousStart = -1;
  for (const [index, excerpt] of receipt.materialExcerpts.entries()) {
    if (
      excerpt.order !== index + 1 ||
      excerpt.range.startUtf8Byte < 0 ||
      excerpt.range.endUtf8ByteExclusive <= excerpt.range.startUtf8Byte ||
      excerpt.range.endUtf8ByteExclusive > receipt.sourceByteLength ||
      excerpt.range.startUtf8Byte < previousStart ||
      excerpt.range.startLine < 1 ||
      excerpt.range.endLine < excerpt.range.startLine ||
      excerpt.range.endLine > receipt.lineCount
    ) {
      return false;
    }
    if (lineIndex) {
      try {
        const expectedRange = lineRangeToByteRange(
          lineIndex,
          excerpt.range.startLine,
          excerpt.range.endLine
        );
        if (
          expectedRange.startUtf8Byte !== excerpt.range.startUtf8Byte ||
          expectedRange.endUtf8ByteExclusive !== excerpt.range.endUtf8ByteExclusive ||
          sliceAndHashSourceRange(sourceBytes!, excerpt.range) !== excerpt.range.contentHash
        ) {
          return false;
        }
      } catch {
        return false;
      }
    }
    previousStart = excerpt.range.startUtf8Byte;
  }
  if (
    new Set(receipt.materialExcerpts.map((excerpt) => excerpt.excerptId)).size !==
      receipt.materialExcerpts.length ||
    new Set(receipt.materialExcerpts.map((excerpt) => excerpt.sourceRootId)).size !==
      receipt.materialExcerpts.length
  ) {
    return false;
  }
  const { receiptHash, ...payload } = receipt;
  return receiptHash === sha256Stable(payload);
}

export function validateRequirementsContractFileIntakeReceipt(
  value: unknown,
  options?: { recordRoot?: string }
): boolean {
  if (!schemaValidator()(value) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const receipt = value as RequirementsContractFileIntakeReceipt | RequirementsContractFileIntakeReceiptV2;
  return receipt.schemaVersion === 'requirements-contract-file-intake-receipt/v2'
    ? validateV2Receipt(receipt, options)
    : validateV1Receipt(receipt);
}

export function readRequirementsContractFileIntakeReceipt(input: {
  receiptPath: string;
  recordRoot?: string;
}): RequirementsContractFileIntakeReceipt | RequirementsContractFileIntakeReceiptV2 {
  const receipt = JSON.parse(readFileSync(input.receiptPath, 'utf8')) as unknown;
  if (!validateRequirementsContractFileIntakeReceipt(receipt, input)) {
    throw new Error('requirements_file_intake_receipt_invalid');
  }
  return receipt as RequirementsContractFileIntakeReceipt | RequirementsContractFileIntakeReceiptV2;
}

export function migrateRequirementsContractFileIntakeReceiptV1ToV2(input: {
  recordRoot: string;
  receipt: RequirementsContractFileIntakeReceipt;
  materialRoots: Array<{ sourceRootId: string; startLine: number; endLine: number }>;
}): RequirementsContractFileIntakeReceiptV2 {
  if (
    input.receipt.schemaVersion !== 'requirements-contract-file-intake-receipt/v1' ||
    !validateRequirementsContractFileIntakeReceipt(input.receipt)
  ) {
    throw new Error('requirements_file_intake_v1_migration_requires_verified_receipt');
  }
  return createRequirementsContractFileIntakeReceiptV2({
    recordRoot: input.recordRoot,
    requirementSetId: input.receipt.requirementSetId,
    entrySource: input.receipt.entrySource,
    requestedArtifactRole: input.receipt.requestedArtifactRole,
    sourcePath: input.receipt.sourcePath,
    sourceContent: input.receipt.excerpts.map((excerpt) => excerpt.content).join(''),
    materialRoots: input.materialRoots,
    capturedAt: input.receipt.capturedAt,
  });
}
