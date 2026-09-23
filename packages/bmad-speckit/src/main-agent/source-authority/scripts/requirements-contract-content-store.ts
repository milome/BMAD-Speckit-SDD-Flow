import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sourceBytesHash } from './requirements-contract-hash-domains';
import { readJson, writeJsonAtomic } from './requirement-record-control-store';
import { requirementsContractDomainHash } from './requirements-contract-hash-domains';
import type { RequirementsStorageReservation } from './requirements-contract-record-storage';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;

export interface RequirementsContentRef {
  schemaVersion: 'requirements-content-ref/v1';
  contentHash: string;
  byteLength: number;
  mediaType: string;
  recordRelativePath: string;
}

function nonEmpty(value: string, code: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function canonicalObjectPath(contentHash: string): string {
  if (!SHA256.test(contentHash)) throw new Error('requirements_content_object_hash_invalid');
  const hex = contentHash.slice('sha256:'.length);
  return `authoring/objects/sha256/${hex.slice(0, 2)}/${hex.slice(2)}`;
}

function resolvedObjectPath(recordRoot: string, ref: RequirementsContentRef): string {
  if (
    !ref ||
    ref.schemaVersion !== 'requirements-content-ref/v1' ||
    !Number.isSafeInteger(ref.byteLength) ||
    ref.byteLength < 0 ||
    !String(ref.mediaType ?? '').trim()
  ) {
    throw new Error('requirements_content_ref_invalid');
  }
  const expected = canonicalObjectPath(ref.contentHash);
  if (ref.recordRelativePath !== expected) {
    throw new Error('requirements_content_object_path_invalid');
  }
  const realRoot = fs.realpathSync.native(path.resolve(recordRoot));
  const target = path.resolve(realRoot, ...expected.split('/'));
  const relative = path.relative(realRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('requirements_content_object_path_invalid');
  }
  let cursor = realRoot;
  for (const segment of expected.split('/')) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) continue;
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error('requirements_content_object_symlink_forbidden');
    const realCursor = fs.realpathSync.native(cursor);
    const realRelative = path.relative(realRoot, realCursor);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw new Error('requirements_content_object_path_invalid');
    }
  }
  return target;
}

function verifyBytes(ref: RequirementsContentRef, bytes: Buffer): void {
  if (bytes.length !== ref.byteLength) {
    throw new Error('requirements_content_object_length_mismatch');
  }
  if (sourceBytesHash(bytes) !== ref.contentHash) {
    throw new Error('requirements_content_object_hash_mismatch');
  }
}

export function verifyRequirementsContentRef(input: {
  recordRoot: string;
  ref: RequirementsContentRef;
}): void {
  const target = resolvedObjectPath(input.recordRoot, input.ref);
  if (!fs.existsSync(target)) throw new Error('requirements_content_object_missing');
  if (fs.lstatSync(target).isSymbolicLink()) {
    throw new Error('requirements_content_object_symlink_forbidden');
  }
  verifyBytes(input.ref, fs.readFileSync(target));
}

export function readRequirementsContentObject(input: {
  recordRoot: string;
  ref: RequirementsContentRef;
}): Buffer {
  const target = resolvedObjectPath(input.recordRoot, input.ref);
  if (!fs.existsSync(target)) throw new Error('requirements_content_object_missing');
  if (fs.lstatSync(target).isSymbolicLink()) {
    throw new Error('requirements_content_object_symlink_forbidden');
  }
  const bytes = fs.readFileSync(target);
  verifyBytes(input.ref, bytes);
  return bytes;
}

export function publishRequirementsContentObject(input: {
  recordRoot: string;
  role: string;
  mediaType: string;
  bytes: Buffer;
  reservation?: RequirementsStorageReservation;
}): RequirementsContentRef {
  nonEmpty(input.role, 'requirements_content_object_role_invalid');
  const mediaType = nonEmpty(input.mediaType, 'requirements_content_object_media_type_invalid');
  if (!Buffer.isBuffer(input.bytes)) throw new Error('requirements_content_object_bytes_invalid');
  const contentHash = sourceBytesHash(input.bytes);
  const ref: RequirementsContentRef = {
    schemaVersion: 'requirements-content-ref/v1',
    contentHash,
    byteLength: input.bytes.length,
    mediaType,
    recordRelativePath: canonicalObjectPath(contentHash),
  };
  const target = resolvedObjectPath(input.recordRoot, ref);
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  const realRoot = fs.realpathSync.native(path.resolve(input.recordRoot));
  const realParent = fs.realpathSync.native(parent);
  const parentRelative = path.relative(realRoot, realParent);
  if (parentRelative.startsWith('..') || path.isAbsolute(parentRelative)) {
    throw new Error('requirements_content_object_path_invalid');
  }
  if (fs.existsSync(target)) {
    verifyRequirementsContentRef({ recordRoot: input.recordRoot, ref });
    return ref;
  }

  let reservationRecord: RequirementsStorageReservation | null = null;
  if (input.reservation) {
    const reservationPath = path.join(
      input.recordRoot, 'authoring', 'operations', input.reservation.operationId,
      'storage-reservation.json'
    );
    if (!fs.existsSync(reservationPath)) throw new Error('requirements_storage_reservation_missing');
    reservationRecord = readJson(reservationPath) as unknown as RequirementsStorageReservation;
    const { consumedUniqueBytes: _consumed, reservationHash, ...payload } = reservationRecord;
    if (
      reservationHash !== requirementsContractDomainHash('requirements-record-storage-reservation/v1', payload) ||
      reservationRecord.operationId !== input.reservation.operationId ||
      reservationRecord.requestedUniqueBytes !== input.reservation.requestedUniqueBytes ||
      !Number.isSafeInteger(reservationRecord.consumedUniqueBytes ?? 0) ||
      Number(reservationRecord.consumedUniqueBytes ?? 0) + input.bytes.length > reservationRecord.requestedUniqueBytes
    ) throw new Error('requirements_storage_reservation_invalid');
  }

  const temporary = path.join(parent, `.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, input.bytes, { flag: 'wx' });
    verifyBytes(ref, fs.readFileSync(temporary));
    try {
      fs.copyFileSync(temporary, target, fs.constants.COPYFILE_EXCL);
      fs.rmSync(temporary, { force: true });
    } catch (error) {
      if (!fs.existsSync(target)) throw error;
      verifyRequirementsContentRef({ recordRoot: input.recordRoot, ref });
    }
    verifyRequirementsContentRef({ recordRoot: input.recordRoot, ref });
    if (reservationRecord) {
      writeJsonAtomic(
        path.join(input.recordRoot, 'authoring', 'operations', reservationRecord.operationId, 'storage-reservation.json'),
        { ...reservationRecord, consumedUniqueBytes: Number(reservationRecord.consumedUniqueBytes ?? 0) + input.bytes.length }
      );
    }
    return ref;
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}
