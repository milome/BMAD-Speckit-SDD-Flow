import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv from 'ajv';

export interface GovernedSafeWriteReceipt {
  schemaVersion: 'large-document-writer-safe-write/v1';
  targetPath: string;
  mode: 'create' | 'replace' | 'upsert';
  tempPath: string;
  tempHash: string;
  backupPath: string | null;
  originalHash: string | null;
  backupHash: string | null;
  finalHash: string;
  writtenAt: string;
}

export interface GovernedReadbackRef {
  path: string;
  hash: string;
  readbackHash: string;
  readbackVerified: true;
}

const writer = require('../../../utils/large-document-writer') as {
  safeWriteJson(
    targetPath: string,
    value: unknown,
    options: { mode: 'create' | 'replace' | 'upsert' }
  ): GovernedSafeWriteReceipt;
  safeWriteText(
    targetPath: string,
    value: string,
    options: { mode: 'create' | 'replace' | 'upsert' }
  ): GovernedSafeWriteReceipt;
};

export function slash(value: string): string {
  return value.replace(/\\/gu, '/');
}

export function sha256(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function fileHash(filePath: string): string {
  return sha256(fs.readFileSync(filePath));
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function receiptValidator() {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-large-document-writer-safe-write-receipt.schema.json'
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  return new Ajv({ allErrors: true, strict: false }).compile(schema);
}

function modeFor(targetPath: string): 'create' | 'replace' {
  return fs.existsSync(targetPath) ? 'replace' : 'create';
}

function readbackRef(targetPath: string): GovernedReadbackRef {
  const first = fs.readFileSync(targetPath);
  const second = fs.readFileSync(targetPath);
  const firstHash = sha256(first);
  const secondHash = sha256(second);
  if (firstHash !== secondHash || !first.equals(second)) {
    throw new Error(`governed readback mismatch: ${targetPath}`);
  }
  return {
    path: slash(path.resolve(targetPath)),
    hash: firstHash,
    readbackHash: secondHash,
    readbackVerified: true,
  };
}

function finalizeGovernedWrite(
  targetPath: string,
  receipt: GovernedSafeWriteReceipt
): {
  receipt: GovernedSafeWriteReceipt;
  targetRef: GovernedReadbackRef;
  receiptRef: GovernedReadbackRef;
} {
  const resolvedTarget = path.resolve(targetPath);
  const validate = receiptValidator();
  const targetRef = readbackRef(resolvedTarget);
  if (
    !validate(receipt) ||
    receipt.targetPath !== resolvedTarget ||
    receipt.finalHash !== targetRef.hash
  ) {
    throw new Error(
      `governed safe-write receipt mismatch: ${JSON.stringify(validate.errors ?? [])}`
    );
  }
  const receiptPath = `${resolvedTarget}.safe-write-receipt.json`;
  writer.safeWriteJson(receiptPath, receipt, { mode: modeFor(receiptPath) });
  const persisted = JSON.parse(fs.readFileSync(receiptPath, 'utf8')) as unknown;
  if (canonicalJson(persisted) !== canonicalJson(receipt) || !validate(persisted)) {
    throw new Error(`governed persisted safe-write receipt mismatch: ${receiptPath}`);
  }
  return { receipt, targetRef, receiptRef: readbackRef(receiptPath) };
}

export function writeGovernedJson(targetPath: string, value: unknown) {
  const resolvedTarget = path.resolve(targetPath);
  const receipt = writer.safeWriteJson(resolvedTarget, value, { mode: modeFor(resolvedTarget) });
  return finalizeGovernedWrite(resolvedTarget, receipt);
}

export function writeGovernedText(targetPath: string, value: string) {
  const resolvedTarget = path.resolve(targetPath);
  const receipt = writer.safeWriteText(resolvedTarget, value, { mode: modeFor(resolvedTarget) });
  return finalizeGovernedWrite(resolvedTarget, receipt);
}
