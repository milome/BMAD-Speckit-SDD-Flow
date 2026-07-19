import path from 'node:path';
import type { RequirementsContractV1LegacyInventoryRow } from './requirements-contract-v1-read-adapter';

export const REQUIREMENTS_CONTRACT_V1_LEGACY_INVENTORY_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-v1-legacy-inventory.ts';

const HASH = /^sha256:[a-f0-9]{64}$/u;
const CUTOVER_ID = /^V2-CUTOVER-[A-Z0-9][A-Z0-9._-]*$/u;
const STABLE_ID = /^[a-z0-9][a-z0-9._-]*$/u;

export interface RequirementsContractV1LegacyInventory {
  schemaVersion: 'requirements-contract-v1-legacy-inventory/v1';
  cutoverId: string;
  cutoverPredecessorArtifact12Hash: string;
  g00BaselineHash: string;
  frozen: true;
  rows: RequirementsContractV1LegacyInventoryRow[];
}

export interface RequirementsContractV1LegacyInventoryFreezeReceipt {
  inventoryHash: string;
  inventorySchemaHash: string;
  writerHash: string;
  cutoverId: string;
  predecessorHash: string;
  g00BaselineHash: string;
  rowCount: number;
  freezeTransactionId: string;
}

function isRepositoryPath(value: string): boolean {
  if (!value || path.isAbsolute(value) || /^[A-Za-z]:/u.test(value)) return false;
  return !value.split(/[\\/]/u).includes('..') && !value.includes('\\');
}

function assertHash(value: string, field: string): void {
  if (!HASH.test(value)) throw new Error(`v1_legacy_inventory_${field}_invalid`);
}

function normalizedRow(
  row: RequirementsContractV1LegacyInventoryRow,
  input: {
    cutoverId: string;
    cutoverPredecessorArtifact12Hash: string;
    g00BaselineHash: string;
  }
): RequirementsContractV1LegacyInventoryRow {
  if (
    !isRepositoryPath(row.sourcePath) ||
    !STABLE_ID.test(row.requirementSetId) ||
    row.cutoverId !== input.cutoverId ||
    row.cutoverPredecessorArtifact12Hash !==
      input.cutoverPredecessorArtifact12Hash ||
    row.legacyReadEligibility !== 'eligible' ||
    !isRepositoryPath(row.baselineInventoryProof.path)
  ) {
    throw new Error('v1_legacy_inventory_row_identity_invalid');
  }
  assertHash(row.sourceHash, 'row_source_hash');
  assertHash(row.v1ParserFormatProofHash, 'row_format_proof_hash');
  assertHash(row.baselineInventoryProof.hash, 'row_baseline_proof_hash');
  if (row.baselineInventoryProof.hash !== input.g00BaselineHash) {
    throw new Error('v1_legacy_inventory_row_baseline_hash_mismatch');
  }
  return structuredClone(row);
}

export function createRequirementsContractV1LegacyInventory(input: {
  cutoverId: string;
  cutoverPredecessorArtifact12Hash: string;
  g00BaselineHash: string;
  rows: readonly RequirementsContractV1LegacyInventoryRow[];
}): RequirementsContractV1LegacyInventory {
  if (!CUTOVER_ID.test(input.cutoverId)) {
    throw new Error('v1_legacy_inventory_cutover_id_invalid');
  }
  assertHash(
    input.cutoverPredecessorArtifact12Hash,
    'cutover_predecessor_hash'
  );
  assertHash(input.g00BaselineHash, 'g00_baseline_hash');
  const rows = input.rows
    .map((row) => normalizedRow(row, input))
    .sort(
      (left, right) =>
        left.requirementSetId.localeCompare(right.requirementSetId) ||
        left.sourcePath.localeCompare(right.sourcePath)
    );
  if (
    new Set(rows.map((row) => row.requirementSetId)).size !== rows.length ||
    new Set(rows.map((row) => row.sourcePath)).size !== rows.length
  ) {
    throw new Error('v1_legacy_inventory_row_identity_duplicate');
  }
  return {
    schemaVersion: 'requirements-contract-v1-legacy-inventory/v1',
    cutoverId: input.cutoverId,
    cutoverPredecessorArtifact12Hash:
      input.cutoverPredecessorArtifact12Hash,
    g00BaselineHash: input.g00BaselineHash,
    frozen: true,
    rows,
  };
}

export function createRequirementsContractV1LegacyInventoryFreezeReceipt(input: {
  inventoryHash: string;
  inventorySchemaHash: string;
  writerHash: string;
  cutoverId: string;
  predecessorHash: string;
  g00BaselineHash: string;
  rowCount: number;
  freezeTransactionId: string;
}): RequirementsContractV1LegacyInventoryFreezeReceipt {
  assertHash(input.inventoryHash, 'freeze_inventory_hash');
  assertHash(input.inventorySchemaHash, 'freeze_schema_hash');
  assertHash(input.writerHash, 'freeze_writer_hash');
  assertHash(input.predecessorHash, 'freeze_predecessor_hash');
  assertHash(input.g00BaselineHash, 'freeze_g00_baseline_hash');
  if (
    !CUTOVER_ID.test(input.cutoverId) ||
    !Number.isSafeInteger(input.rowCount) ||
    input.rowCount < 0 ||
    !input.freezeTransactionId.trim()
  ) {
    throw new Error('v1_legacy_inventory_freeze_identity_invalid');
  }
  return {
    inventoryHash: input.inventoryHash,
    inventorySchemaHash: input.inventorySchemaHash,
    writerHash: input.writerHash,
    cutoverId: input.cutoverId,
    predecessorHash: input.predecessorHash,
    g00BaselineHash: input.g00BaselineHash,
    rowCount: input.rowCount,
    freezeTransactionId: input.freezeTransactionId,
  };
}
