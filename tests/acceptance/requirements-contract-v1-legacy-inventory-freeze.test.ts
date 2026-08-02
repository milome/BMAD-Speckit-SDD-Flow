import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

interface LegacyInventory {
  schemaVersion: 'requirements-contract-v1-legacy-inventory/v1';
  cutoverId: string;
  cutoverPredecessorArtifact12Hash: string;
  g00BaselineHash: string;
  frozen: true;
  rows: unknown[];
}

interface LegacyInventoryFreezeReceipt {
  inventoryHash: string;
  inventorySchemaHash: string;
  writerHash: string;
  cutoverId: string;
  predecessorHash: string;
  g00BaselineHash: string;
  rowCount: number;
  freezeTransactionId: string;
}

interface LegacyInventoryWriter {
  REQUIREMENTS_CONTRACT_V1_LEGACY_INVENTORY_OWNER_PATH: string;
  createRequirementsContractV1LegacyInventory(input: {
    cutoverId: string;
    cutoverPredecessorArtifact12Hash: string;
    g00BaselineHash: string;
    rows: unknown[];
  }): LegacyInventory;
  createRequirementsContractV1LegacyInventoryFreezeReceipt(input: {
    inventoryHash: string;
    inventorySchemaHash: string;
    writerHash: string;
    cutoverId: string;
    predecessorHash: string;
    g00BaselineHash: string;
    rowCount: number;
    freezeTransactionId: string;
  }): LegacyInventoryFreezeReceipt;
}

const ROOT = process.cwd();
const WRITER_RELATIVE_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-v1-legacy-inventory.ts';
const WRITER_PATH = path.join(ROOT, WRITER_RELATIVE_PATH);
const SCHEMA_PATH = path.join(
  ROOT,
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-v1-legacy-inventory.schema.json'
);
const INVENTORY_PATH = path.join(
  ROOT,
  '_bmad/shared/requirements-contract/requirements-contract-v1-legacy-inventory.json'
);
const FREEZE_RECEIPT_PATH = path.join(
  ROOT,
  '_bmad/shared/requirements-contract/requirements-contract-v1-legacy-inventory.freeze.json'
);
const require = createRequire(import.meta.url);

function fileHash(filePath: string): string {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

describe('requirements contract frozen V1 legacy inventory', () => {
  it('publishes a schema-valid canonical inventory and immutable freeze receipt', () => {
    for (const filePath of [
      WRITER_PATH,
      SCHEMA_PATH,
      INVENTORY_PATH,
      FREEZE_RECEIPT_PATH,
    ]) {
      expect(existsSync(filePath), `required V1 inventory asset is missing: ${filePath}`).toBe(
        true
      );
    }

    const writer = require(WRITER_PATH) as LegacyInventoryWriter;
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as {
      $defs: { freezeReceipt: object };
    };
    const inventory = JSON.parse(
      readFileSync(INVENTORY_PATH, 'utf8')
    ) as LegacyInventory;
    const freezeReceipt = JSON.parse(
      readFileSync(FREEZE_RECEIPT_PATH, 'utf8')
    ) as LegacyInventoryFreezeReceipt;
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validateInventory = ajv.compile(schema);
    const validateFreezeReceipt = ajv.compile(schema.$defs.freezeReceipt);

    expect(validateInventory(inventory), JSON.stringify(validateInventory.errors ?? [])).toBe(
      true
    );
    expect(
      validateFreezeReceipt(freezeReceipt),
      JSON.stringify(validateFreezeReceipt.errors ?? [])
    ).toBe(true);
    expect(
      writer.REQUIREMENTS_CONTRACT_V1_LEGACY_INVENTORY_OWNER_PATH
    ).toBe(WRITER_RELATIVE_PATH);
    expect(freezeReceipt).toMatchObject({
      inventoryHash: fileHash(INVENTORY_PATH),
      inventorySchemaHash: fileHash(SCHEMA_PATH),
      writerHash: fileHash(WRITER_PATH),
      cutoverId: inventory.cutoverId,
      predecessorHash: inventory.cutoverPredecessorArtifact12Hash,
      g00BaselineHash: inventory.g00BaselineHash,
      rowCount: inventory.rows.length,
    });
  });

  it('reproduces the canonical bytes from the source owner inputs', () => {
    expect(existsSync(WRITER_PATH)).toBe(true);
    expect(existsSync(INVENTORY_PATH)).toBe(true);
    expect(existsSync(FREEZE_RECEIPT_PATH)).toBe(true);

    const writer = require(WRITER_PATH) as LegacyInventoryWriter;
    const inventory = JSON.parse(
      readFileSync(INVENTORY_PATH, 'utf8')
    ) as LegacyInventory;
    const freezeReceipt = JSON.parse(
      readFileSync(FREEZE_RECEIPT_PATH, 'utf8')
    ) as LegacyInventoryFreezeReceipt;

    expect(
      writer.createRequirementsContractV1LegacyInventory({
        cutoverId: inventory.cutoverId,
        cutoverPredecessorArtifact12Hash:
          inventory.cutoverPredecessorArtifact12Hash,
        g00BaselineHash: inventory.g00BaselineHash,
        rows: inventory.rows,
      })
    ).toEqual(inventory);
    expect(
      writer.createRequirementsContractV1LegacyInventoryFreezeReceipt({
        inventoryHash: freezeReceipt.inventoryHash,
        inventorySchemaHash: freezeReceipt.inventorySchemaHash,
        writerHash: freezeReceipt.writerHash,
        cutoverId: freezeReceipt.cutoverId,
        predecessorHash: freezeReceipt.predecessorHash,
        g00BaselineHash: freezeReceipt.g00BaselineHash,
        rowCount: freezeReceipt.rowCount,
        freezeTransactionId: freezeReceipt.freezeTransactionId,
      })
    ).toEqual(freezeReceipt);
  });
});
