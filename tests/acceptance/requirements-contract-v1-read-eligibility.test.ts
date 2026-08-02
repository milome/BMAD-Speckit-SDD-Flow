import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it, vi } from 'vitest';
import { readRequirementsContract } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-read-facade';
import * as v1Adapter from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-v1-read-adapter';
import {
  readRequirementsContractV1Source,
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
  const root = mkdtempSync(path.join(os.tmpdir(), 'requirements-v1-eligibility-'));
  const identity = randomUUID();
  const requirementSetId = `legacy-${identity}`;
  const sourcePath = `docs/requirements/${requirementSetId}.md`;
  const ordinal = String((Number.parseInt(identity.slice(0, 6), 16) % 999) + 1).padStart(3, '0');
  const sourceRequirementId = `MUST-${ordinal}`;
  const normalizedRequirementId = `MUST-FR-${ordinal}`;
  const confirmation = {
    contractSchemaVersion: 1,
    must: [
      {
        id: sourceRequirementId,
        text: `Preserve legacy behavior ${identity}.`,
      },
    ],
  };
  const sourceText = `# Legacy\n\n${yaml.dump({ implementationConfirmation: confirmation })}`;
  const sourceHash = sha256Bytes(sourceText);
  const sourceTarget = path.join(root, sourcePath);
  mkdirSync(path.dirname(sourceTarget), { recursive: true });
  writeFileSync(sourceTarget, sourceText, 'utf8');
  const cutoverId = `V2-CUTOVER-${identity.toUpperCase()}`;
  const predecessorHash = sha256Stable({ cutoverId, predecessor: true });
  const formatProofHash = requirementsContractV1FormatProofHash(confirmation);
  const g00BaselineHash = sha256Stable({ identity, baseline: true });
  const inventoryPath =
    '_bmad/shared/requirements-contract/requirements-contract-v1-legacy-inventory.json';
  const freezeReceiptPath =
    '_bmad/shared/requirements-contract/requirements-contract-v1-legacy-inventory.freeze.json';
  const writerHash = sha256Stable({ identity, writer: true });
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
        v1ParserFormatProofHash: formatProofHash,
        requirementSetId,
        cutoverId,
        cutoverPredecessorArtifact12Hash: predecessorHash,
        baselineInventoryProof: {
          path: `docs/evidence/${requirementSetId}.json`,
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
    freezeTransactionId: `FREEZE-${identity}`,
  };
  const freezeReceiptHash = writeJson(root, freezeReceiptPath, freezeReceipt);
  return {
    root,
    source: {
      path: sourcePath,
      hash: sourceHash,
      requirementSetId,
      cutoverId,
    },
    expected: {
      v1FormatProofHash: formatProofHash,
      cutoverPredecessorHash: predecessorHash,
      writerHash,
      g00BaselineHash,
      freezeTransactionId: freezeReceipt.freezeTransactionId,
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
    freezeReceipt,
    freezeReceiptPath,
    normalizedRequirementId,
  };
}

describe('requirements contract V1 read eligibility', () => {
  it('resolves one exact frozen pre-cutover inventory row before adapter selection', () => {
    const value = fixture();
    try {
      const result = resolveRequirementsContractV1ReadEligibility({
        projectRoot: value.root,
        source: value.source,
        expected: value.expected,
        authority: value.authority,
      });

      expect(result).toMatchObject({
        ok: true,
        decision: 'pass',
        row: {
          requirementSetId: value.source.requirementSetId,
          sourcePath: value.source.path,
          sourceHash: value.source.hash,
          cutoverId: value.source.cutoverId,
          v1ParserFormatProofHash: value.expected.v1FormatProofHash,
          cutoverPredecessorArtifact12Hash: value.expected.cutoverPredecessorHash,
        },
      });
      expect(result.issues).toEqual([]);
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('rejects a rehashed freeze receipt whose row count no longer binds the inventory', () => {
    const value = fixture();
    try {
      const forgedReceipt = {
        ...value.freezeReceipt,
        rowCount: value.inventory.rows.length + 1,
      };
      const forgedReceiptHash = writeJson(value.root, value.freezeReceiptPath, forgedReceipt);
      const result = resolveRequirementsContractV1ReadEligibility({
        projectRoot: value.root,
        source: value.source,
        expected: value.expected,
        authority: {
          ...value.authority,
          freezeReceiptRef: {
            path: value.freezeReceiptPath,
            hash: forgedReceiptHash,
          },
        },
      });

      expect(result.decision).toBe('block');
      expect(result.issues.map((issue) => issue.code)).toContain(
        'legacy_inventory_freeze_row_count_mismatch'
      );
      expect(result.row).toBeNull();
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('normalizes eligible V1 physical fields behind the adapter without exposing their layout', () => {
    const value = fixture();
    try {
      const eligibility = resolveRequirementsContractV1ReadEligibility({
        projectRoot: value.root,
        source: value.source,
        expected: value.expected,
        authority: value.authority,
      });
      const result = readRequirementsContractV1Source({
        projectRoot: value.root,
        eligibility,
      });

      expect(result).toMatchObject({
        ok: true,
        decision: 'pass',
        logicalModel: {
          schemaVersion: 'requirement-contract-model/v2',
          requirementSetId: value.source.requirementSetId,
        },
      });
      expect(Object.keys(result.logicalModel?.nodes ?? {})).toEqual([
        value.normalizedRequirementId,
      ]);
      expect(JSON.stringify(result.logicalModel)).not.toContain('currentTargetMap');
    } finally {
      rmSync(value.root, { recursive: true, force: true });
    }
  });

  it('does not fall back to an eligible V1 adapter when selected V2 validation fails', () => {
    const value = fixture();
    const v1ReadSpy = vi.spyOn(v1Adapter, 'readRequirementsContractV1Source');
    try {
      const eligibility = resolveRequirementsContractV1ReadEligibility({
        projectRoot: value.root,
        source: value.source,
        expected: value.expected,
        authority: value.authority,
      });
      expect(eligibility.decision).toBe('pass');

      const consumerId = `consumer-${value.source.requirementSetId}`;
      const v2SourcePath = `docs/requirements/${value.source.requirementSetId}-v2.md`;
      const v2SourceText = '# Corrupted V2 fixture\n';
      const v2SourceTarget = path.join(value.root, v2SourcePath);
      mkdirSync(path.dirname(v2SourceTarget), { recursive: true });
      writeFileSync(v2SourceTarget, v2SourceText, 'utf8');
      const v2ManifestPath =
        `_bmad-output/runtime/requirement-records/${value.source.requirementSetId}` +
        '/authoring/revisions/BUNDLE-REV-CORRUPT/bundle-manifest.json';
      const v2ManifestTarget = path.join(value.root, v2ManifestPath);
      mkdirSync(path.dirname(v2ManifestTarget), { recursive: true });
      writeFileSync(v2ManifestTarget, '{"schemaVersion":\n', 'utf8');

      writeJson(
        value.root,
        '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json',
        {
          schemaVersion: 'requirements-contract-consumer-registry/v2',
          activation: {
            shadowOutputEnabled: false,
            v1OutputEnabled: false,
            productionReadModelVersion: 'v2',
            activationReceiptId: 'ACT-RECEIPT-NO-V1-FALLBACK',
          },
          consumers: [
            {
              consumerId,
              readFacadeRef: 'requirements-contract-read-facade/v1',
              adapterRef: 'requirements-contract-v2-read-adapter/v1',
              sourceFormatVersion: 'requirement-contract-model/v2',
              validationModes: ['draft'],
            },
            {
              consumerId,
              readFacadeRef: 'requirements-contract-read-facade/v1',
              adapterRef: 'requirements-contract-v1-read-adapter/v1',
              sourceFormatVersion: 'requirement-contract-source-prd/v1',
              validationModes: ['draft'],
              eligibilityAuthority: 'frozen_inventory',
              legacyEligibilitySourceRef: value.authority.inventoryRef.path,
              legacyEligibilitySourceHash: value.authority.inventoryRef.hash,
              legacyInventoryFreezeReceiptRef: value.authority.freezeReceiptRef.path,
              legacyInventoryFreezeReceiptHash: value.authority.freezeReceiptRef.hash,
              v1FormatProofHash: value.expected.v1FormatProofHash,
              cutoverPredecessorHash: value.expected.cutoverPredecessorHash,
              legacyInventoryWriterHash: value.expected.writerHash,
              legacyInventoryG00BaselineHash: value.expected.g00BaselineHash,
              legacyInventoryFreezeTransactionId: value.expected.freezeTransactionId,
            },
          ],
        }
      );

      const result = readRequirementsContract({
        projectRoot: value.root,
        consumerId,
        mode: 'draft',
        envelope: {
          requirementSetId: value.source.requirementSetId,
          sourcePath: v2SourcePath,
          sourceHash: sha256Bytes(v2SourceText),
          sourceFormatVersion: 'requirement-contract-model/v2',
          activeBundleRevision: 'BUNDLE-REV-CORRUPT',
          bundleManifestPath: v2ManifestPath,
          semanticModelHash: `sha256:${'d'.repeat(64)}`,
          traceGraphHash: `sha256:${'e'.repeat(64)}`,
        },
      });

      expect(result).toMatchObject({
        ok: false,
        decision: 'block',
        adapterInvoked: true,
        logicalModel: null,
        traceGraph: null,
      });
      expect(result.issues.map((issue) => issue.code)).toEqual(['adapter_blocked']);
      expect(v1ReadSpy).not.toHaveBeenCalled();
      expect(sha256Bytes(readFileSync(path.join(value.root, value.source.path)))).toBe(
        value.source.hash
      );
    } finally {
      v1ReadSpy.mockRestore();
      rmSync(value.root, { recursive: true, force: true });
    }
  });
});
