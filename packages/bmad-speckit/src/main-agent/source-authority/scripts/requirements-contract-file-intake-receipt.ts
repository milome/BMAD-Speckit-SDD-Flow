import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sha256Stable, sha256Text } from './requirements-contract-semantic-resolver';

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

export function validateRequirementsContractFileIntakeReceipt(value: unknown): boolean {
  if (!schemaValidator()(value) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const receipt = value as RequirementsContractFileIntakeReceipt;
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
