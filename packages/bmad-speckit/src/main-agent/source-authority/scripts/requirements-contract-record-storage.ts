import { existsSync, lstatSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { writeJsonAtomic } from './requirement-record-control-store';
import { acquireRequirementsFileLock, releaseRequirementsFileLock } from './requirements-contract-file-lock';
import { requirementsContractDomainHash } from './requirements-contract-hash-domains';
import {
  DEFAULT_REQUIREMENTS_CONTRACT_RETENTION_POLICY,
  type RequirementsContractRetentionPolicy,
} from './requirements-contract-retention-policy';

export const REQUIREMENTS_DURABLE_STORAGE_WARNING_BYTES = 24 * 1024 * 1024;
export const REQUIREMENTS_DURABLE_STORAGE_HARD_LIMIT_BYTES = 32 * 1024 * 1024;
const SAFE_OPERATION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

export interface RequirementsRecordStorageInventory {
  durableBytes: number;
  objectBytes: number;
  metadataBytes: number;
  stagingBytes: number;
  fileCount: number;
  inventoryHash: string;
}

export interface RequirementsStorageReservation {
  schemaVersion: 'requirements-record-storage-reservation/v1';
  operationId: string;
  expectedInventoryHash: string;
  requestedUniqueBytes: number;
  requestedMetadataBytes: number;
  reservedBytes: number;
  consumedUniqueBytes?: number;
  reservationHash: string;
}

function inventoryDirectory(
  root: string,
  current: string,
  totals: { objectBytes: number; metadataBytes: number; stagingBytes: number; fileCount: number }
): void {
  if (!existsSync(current)) return;
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const target = path.join(current, entry.name);
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) throw new Error('requirements_storage_inventory_symlink_forbidden');
    if (stat.isDirectory()) {
      inventoryDirectory(root, target, totals);
      continue;
    }
    if (!stat.isFile()) continue;
    const relative = path.relative(root, target).replace(/\\/gu, '/');
    if (/\.(?:lock|tmp|recovery)$/u.test(relative) || relative.includes('.lock.')) continue;
    if (relative.startsWith('authoring/.staging/')) totals.stagingBytes += stat.size;
    else if (relative.startsWith('authoring/objects/')) totals.objectBytes += stat.size;
    else totals.metadataBytes += stat.size;
    totals.fileCount += 1;
  }
}

export function inventoryRequirementsRecordStorage(recordRoot: string): RequirementsRecordStorageInventory {
  const root = path.resolve(recordRoot);
  const totals = { objectBytes: 0, metadataBytes: 0, stagingBytes: 0, fileCount: 0 };
  inventoryDirectory(root, root, totals);
  const payload = {
    durableBytes: totals.objectBytes + totals.metadataBytes,
    ...totals,
  };
  return {
    ...payload,
    inventoryHash: requirementsContractDomainHash('requirements-record-storage-inventory/v1', payload),
  };
}

export function assertRequirementsRecordStorageBudget(input: {
  current: RequirementsRecordStorageInventory;
  plannedUniqueObjectBytes: number;
  plannedMetadataBytes: number;
  plannedReclaimedBytes: number;
  policy?: RequirementsContractRetentionPolicy;
}): 'within_budget' | 'gc_required' {
  for (const value of [input.plannedUniqueObjectBytes, input.plannedMetadataBytes, input.plannedReclaimedBytes]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('requirements_storage_budget_input_invalid');
  }
  const policy = input.policy ?? DEFAULT_REQUIREMENTS_CONTRACT_RETENTION_POLICY;
  const projected = input.current.durableBytes + input.plannedUniqueObjectBytes +
    input.plannedMetadataBytes - input.plannedReclaimedBytes;
  if (!Number.isSafeInteger(projected)) throw new Error('requirements_storage_budget_input_invalid');
  if (projected > policy.maxDurableBytes) throw new Error('requirements_record_durable_bytes_exceeded');
  return projected >= policy.warningBytes ? 'gc_required' : 'within_budget';
}

export function reserveRequirementsRecordStorage(input: {
  recordRoot: string;
  operationId: string;
  expectedInventoryHash: string;
  requestedUniqueBytes: number;
  requestedMetadataBytes: number;
}) {
  if (!SAFE_OPERATION_ID.test(input.operationId)) throw new Error('requirements_storage_reservation_operation_invalid');
  const lock = acquireRequirementsFileLock({
    lockPath: path.join(input.recordRoot, 'runtime', 'storage-reservation.lock'),
    busyCode: 'requirements_storage_reservation_busy',
  });
  try {
    const current = inventoryRequirementsRecordStorage(input.recordRoot);
    if (current.inventoryHash !== input.expectedInventoryHash) {
      throw new Error('requirements_storage_reservation_inventory_changed');
    }
    assertRequirementsRecordStorageBudget({
      current,
      plannedUniqueObjectBytes: input.requestedUniqueBytes,
      plannedMetadataBytes: input.requestedMetadataBytes,
      plannedReclaimedBytes: 0,
    });
    const payload = {
      schemaVersion: 'requirements-record-storage-reservation/v1' as const,
      operationId: input.operationId,
      expectedInventoryHash: input.expectedInventoryHash,
      requestedUniqueBytes: input.requestedUniqueBytes,
      requestedMetadataBytes: input.requestedMetadataBytes,
      reservedBytes: input.requestedUniqueBytes + input.requestedMetadataBytes,
    };
    const reservation = {
      ...payload,
      consumedUniqueBytes: 0,
      reservationHash: requirementsContractDomainHash('requirements-record-storage-reservation/v1', payload),
    };
    writeJsonAtomic(
      path.join(input.recordRoot, 'authoring', 'operations', input.operationId, 'storage-reservation.json'),
      reservation
    );
    return reservation;
  } finally {
    releaseRequirementsFileLock(lock);
  }
}

export function evaluateRequirementsContractStorageBudget(input: {
  durableBytes: number;
  incomingBytes: number;
  duplicateContent?: boolean;
}) {
  if (input.duplicateContent !== undefined && typeof input.duplicateContent !== 'boolean') {
    throw new Error('requirements_storage_budget_input_invalid');
  }
  if (
    !Number.isSafeInteger(input.durableBytes) || input.durableBytes < 0 ||
    !Number.isSafeInteger(input.incomingBytes) || input.incomingBytes < 0
  ) {
    throw new Error('requirements_storage_budget_input_invalid');
  }
  const reservedBytes = input.duplicateContent ? 0 : input.incomingBytes;
  const projectedBytes = input.durableBytes + reservedBytes;
  if (!Number.isSafeInteger(projectedBytes)) throw new Error('requirements_storage_budget_input_invalid');
  const decision = projectedBytes > REQUIREMENTS_DURABLE_STORAGE_HARD_LIMIT_BYTES
    ? 'block' as const
    : projectedBytes >= REQUIREMENTS_DURABLE_STORAGE_WARNING_BYTES
      ? 'warn' as const
      : 'pass' as const;
  return { decision, durableBytes: input.durableBytes, reservedBytes, projectedBytes };
}
