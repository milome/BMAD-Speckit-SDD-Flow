import { createHash, randomUUID } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  requirementsContractV1FormatProofHash,
  resolveRequirementsContractV1ReadEligibility,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-v1-read-adapter';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function sha256Bytes(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function writeJson(root: string, relativePath: string, value: unknown): string {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return sha256Bytes(readFileSync(target));
}

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'v1-inventory-mutation-'));
  const identity = randomUUID();
  const requirementSetId = `legacy-${identity}`;
  const sourcePath = `docs/requirements/${requirementSetId}.md`;
  const confirmation = {
    contractSchemaVersion: 1,
    must: [
      {
        id: 'MUST-001',
        text: `Preserve legacy source ${identity}.`,
      },
    ],
  };
  const sourceText = `# Legacy\n\n${yaml.dump({ implementationConfirmation: confirmation })}`;
  const sourceTarget = path.join(root, sourcePath);
  mkdirSync(path.dirname(sourceTarget), { recursive: true });
  writeFileSync(sourceTarget, sourceText, 'utf8');
  const sourceHash = sha256Bytes(sourceText);
  const cutoverId = `V2-CUTOVER-${identity.toUpperCase()}`;
  const predecessorHash = sha256Stable({ identity, predecessor: true });
  const g00BaselineHash = sha256Stable({ identity, baseline: true });
  const writerHash = sha256Stable({ identity, writer: true });
  const freezeTransactionId = `FREEZE-${identity}`;
  const inventoryPath =
    '_bmad/shared/requirements-contract/requirements-contract-v1-legacy-inventory.json';
  const freezeReceiptPath =
    '_bmad/shared/requirements-contract/requirements-contract-v1-legacy-inventory.freeze.json';
  const inventory = {
    schemaVersion: 'requirements-contract-v1-legacy-inventory/v1',
    cutoverId,
    cutoverPredecessorArtifact12Hash: predecessorHash,
    g00BaselineHash,
    frozen: true,
    rows: [
      {
        sourcePath,
        sourceHash,
        v1ParserFormatProofHash:
          requirementsContractV1FormatProofHash(confirmation),
        requirementSetId,
        cutoverId,
        cutoverPredecessorArtifact12Hash: predecessorHash,
        baselineInventoryProof: {
          path: `baseline/${requirementSetId}.json`,
          hash: g00BaselineHash,
        },
        legacyReadEligibility: 'eligible',
      },
    ],
  };
  const inventoryHash = writeJson(root, inventoryPath, inventory);
  const schemaPath = path.resolve(
    'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-v1-legacy-inventory.schema.json'
  );
  const freezeReceipt = {
    inventoryHash,
    inventorySchemaHash: sha256Bytes(readFileSync(schemaPath)),
    writerHash,
    cutoverId,
    predecessorHash,
    g00BaselineHash,
    rowCount: inventory.rows.length,
    freezeTransactionId,
  };
  const freezeReceiptHash = writeJson(
    root,
    freezeReceiptPath,
    freezeReceipt
  );
  return {
    root,
    source: {
      path: sourcePath,
      hash: sourceHash,
      requirementSetId,
      cutoverId,
    },
    expected: {
      v1FormatProofHash: inventory.rows[0].v1ParserFormatProofHash,
      cutoverPredecessorHash: predecessorHash,
      writerHash,
      g00BaselineHash,
      freezeTransactionId,
    },
    authority: {
      kind: 'frozen_inventory' as const,
      inventoryRef: { path: inventoryPath, hash: inventoryHash },
      freezeReceiptRef: {
        path: freezeReceiptPath,
        hash: freezeReceiptHash,
      },
    },
    inventory,
    inventoryPath,
    freezeReceipt,
    freezeReceiptPath,
  };
}

describe('requirements contract V1 legacy inventory mutation rejection', () => {
  it('rejects coordinated G00 baseline substitution', () => {
    const value = fixture();
    try {
      const mutatedBaselineHash = sha256Stable({
        mutation: randomUUID(),
        baseline: true,
      });
      const inventory = {
        ...value.inventory,
        g00BaselineHash: mutatedBaselineHash,
      };
      const inventoryHash = writeJson(
        value.root,
        value.inventoryPath,
        inventory
      );
      const freezeReceipt = {
        ...value.freezeReceipt,
        inventoryHash,
        g00BaselineHash: mutatedBaselineHash,
      };
      const freezeReceiptHash = writeJson(
        value.root,
        value.freezeReceiptPath,
        freezeReceipt
      );

      const result = resolveRequirementsContractV1ReadEligibility({
        projectRoot: value.root,
        source: value.source,
        expected: value.expected,
        authority: {
          ...value.authority,
          inventoryRef: { path: value.inventoryPath, hash: inventoryHash },
          freezeReceiptRef: {
            path: value.freezeReceiptPath,
            hash: freezeReceiptHash,
          },
        },
      });

      expect(result.decision).toBe('block');
      expect(result.issues.map((issue) => issue.code)).toContain(
        'legacy_inventory_freeze_baseline_mismatch'
      );
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('rejects a rehashed freeze transaction substitution', () => {
    const value = fixture();
    try {
      const freezeReceipt = {
        ...value.freezeReceipt,
        freezeTransactionId: `FREEZE-${randomUUID()}`,
      };
      const freezeReceiptHash = writeJson(
        value.root,
        value.freezeReceiptPath,
        freezeReceipt
      );
      const result = resolveRequirementsContractV1ReadEligibility({
        projectRoot: value.root,
        source: value.source,
        expected: value.expected,
        authority: {
          ...value.authority,
          freezeReceiptRef: {
            path: value.freezeReceiptPath,
            hash: freezeReceiptHash,
          },
        },
      });

      expect(result.decision).toBe('block');
      expect(result.issues.map((issue) => issue.code)).toContain(
        'legacy_inventory_freeze_transaction_mismatch'
      );
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('rejects post-freeze row and source mutations against immutable refs', () => {
    const value = fixture();
    try {
      const mutated = {
        ...value.inventory,
        rows: [
          ...value.inventory.rows,
          {
            ...value.inventory.rows[0],
            requirementSetId: `legacy-${randomUUID()}`,
            sourcePath: `docs/requirements/${randomUUID()}.md`,
          },
        ],
      };
      writeJson(value.root, value.inventoryPath, mutated);

      const result = resolveRequirementsContractV1ReadEligibility({
        projectRoot: value.root,
        source: value.source,
        expected: value.expected,
        authority: value.authority,
      });

      expect(result.decision).toBe('block');
      expect(result.issues.map((issue) => issue.code)).toContain(
        'legacy_inventory_hash_mismatch'
      );
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });
});
