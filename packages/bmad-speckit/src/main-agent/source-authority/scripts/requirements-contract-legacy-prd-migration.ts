import { sha256Stable } from './requirements-contract-semantic-resolver';
import { resolvePlanningArtifactPath } from './requirements-contract-planning-artifact-resolver';

interface FileRef {
  path: string;
  hash: string;
}

export interface LegacyPrdMigrationBindingUpdate {
  consumerId: string;
  previousPath: string;
  currentPath: string;
}

export interface LegacyPrdMigrationReceipt {
  schemaVersion: 'requirements-contract-legacy-prd-migration-receipt/v1';
  migrationId: string;
  requirementSetId: string;
  branch: string;
  sourceRole: 'requirement_source_prd';
  oldSource: FileRef;
  newSource: FileRef;
  oldAuthorityRevoked: true;
  newAuthorityActivated: true;
  runtimeRecordRef: FileRef;
  downstreamBindingUpdates: LegacyPrdMigrationBindingUpdate[];
  migratedAt: string;
  receiptHash: string;
}

export interface CreateLegacyPrdMigrationReceiptInput {
  migrationId: string;
  requirementSetId: string;
  branch: string;
  sourceRole: 'requirement_source_prd';
  oldSource: FileRef;
  newSource: FileRef;
  runtimeRecordRef: FileRef;
  downstreamBindingUpdates: LegacyPrdMigrationBindingUpdate[];
  migratedAt: string;
}

const HASH = /^sha256:[a-f0-9]{64}$/u;
const RUNTIME_RECORD_PATH =
  /^_bmad-output\/runtime\/requirement-records\/[A-Za-z0-9][A-Za-z0-9._-]*\/requirement-record\.json$/u;

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validFileRef(value: unknown): value is FileRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as FileRef;
  return (
    Object.keys(ref).length === 2 &&
    nonEmpty(ref.path) &&
    HASH.test(ref.hash)
  );
}

export function validateLegacyPrdMigrationReceipt(
  value: unknown
): value is LegacyPrdMigrationReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const receipt = value as LegacyPrdMigrationReceipt;
  if (
    receipt.schemaVersion !== 'requirements-contract-legacy-prd-migration-receipt/v1' ||
    !nonEmpty(receipt.migrationId) ||
    !nonEmpty(receipt.requirementSetId) ||
    !nonEmpty(receipt.branch) ||
    receipt.sourceRole !== 'requirement_source_prd' ||
    !validFileRef(receipt.oldSource) ||
    !validFileRef(receipt.newSource) ||
    receipt.oldSource.path === receipt.newSource.path ||
    receipt.oldAuthorityRevoked !== true ||
    receipt.newAuthorityActivated !== true ||
    !validFileRef(receipt.runtimeRecordRef) ||
    !RUNTIME_RECORD_PATH.test(receipt.runtimeRecordRef.path) ||
    !Array.isArray(receipt.downstreamBindingUpdates) ||
    !nonEmpty(receipt.migratedAt) ||
    Number.isNaN(Date.parse(receipt.migratedAt)) ||
    !HASH.test(receipt.receiptHash)
  ) {
    return false;
  }
  let expectedNewPath: string;
  try {
    expectedNewPath = resolvePlanningArtifactPath({
      role: 'requirement_source_prd',
      branch: receipt.branch,
      requirementSetId: receipt.requirementSetId,
    });
  } catch {
    return false;
  }
  if (receipt.newSource.path !== expectedNewPath) return false;
  const consumerIds = new Set<string>();
  for (const binding of receipt.downstreamBindingUpdates) {
    if (
      !binding ||
      typeof binding !== 'object' ||
      Array.isArray(binding) ||
      Object.keys(binding).length !== 3 ||
      !nonEmpty(binding.consumerId) ||
      consumerIds.has(binding.consumerId) ||
      binding.previousPath !== receipt.oldSource.path ||
      binding.currentPath !== receipt.newSource.path
    ) {
      return false;
    }
    consumerIds.add(binding.consumerId);
  }
  const { receiptHash, ...payload } = receipt;
  return receiptHash === sha256Stable(payload);
}

export function createLegacyPrdMigrationReceipt(
  input: CreateLegacyPrdMigrationReceiptInput
): LegacyPrdMigrationReceipt {
  const payload = {
    schemaVersion: 'requirements-contract-legacy-prd-migration-receipt/v1' as const,
    migrationId: input.migrationId,
    requirementSetId: input.requirementSetId,
    branch: input.branch,
    sourceRole: input.sourceRole,
    oldSource: input.oldSource,
    newSource: input.newSource,
    oldAuthorityRevoked: true as const,
    newAuthorityActivated: true as const,
    runtimeRecordRef: input.runtimeRecordRef,
    downstreamBindingUpdates: input.downstreamBindingUpdates,
    migratedAt: input.migratedAt,
  };
  const receipt = { ...payload, receiptHash: sha256Stable(payload) };
  if (!validateLegacyPrdMigrationReceipt(receipt)) {
    throw new Error('requirements_contract_legacy_prd_migration_invalid');
  }
  return receipt;
}
