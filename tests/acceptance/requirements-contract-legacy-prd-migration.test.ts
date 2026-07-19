import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createLegacyPrdMigrationReceipt,
  validateLegacyPrdMigrationReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-legacy-prd-migration';
import { resolvePlanningArtifactPath } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-planning-artifact-resolver';
import {
  sha256Stable,
  sha256Text,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function receipt() {
  const identity = randomUUID();
  const branch = `branch-${identity}`;
  const requirementSetId = `requirements-${identity}`;
  const recordId = `record-${identity}`;
  const oldPath = `_bmad-output/planning-artifacts/${branch}/legacy-${identity}.md`;
  const newPath = resolvePlanningArtifactPath({
    role: 'requirement_source_prd',
    branch,
    requirementSetId,
  });
  return createLegacyPrdMigrationReceipt({
    migrationId: `migration-${identity}`,
    requirementSetId,
    branch,
    sourceRole: 'requirement_source_prd',
    oldSource: { path: oldPath, hash: sha256Text(`old-${identity}`) },
    newSource: { path: newPath, hash: sha256Text(`new-${identity}`) },
    runtimeRecordRef: {
      path: resolvePlanningArtifactPath({
        role: 'runtime_requirement_record',
        recordId,
      }),
      hash: sha256Stable({ recordId, requirementSetId }),
    },
    downstreamBindingUpdates: [
      {
        consumerId: `consumer-${identity}`,
        previousPath: oldPath,
        currentPath: newPath,
      },
    ],
    migratedAt: new Date().toISOString(),
  });
}

describe('requirements contract legacy PRD migration receipt', () => {
  it('binds old and canonical paths while revoking old authority', () => {
    const current = receipt();
    expect(validateLegacyPrdMigrationReceipt(current)).toBe(true);
    expect(current.oldAuthorityRevoked).toBe(true);
    expect(current.newAuthorityActivated).toBe(true);
    expect(current.oldSource.path).not.toBe(current.newSource.path);
  });

  it('rejects a rehashed receipt with a non-canonical target path', () => {
    const current = receipt();
    const { receiptHash: _receiptHash, ...payload } = current;
    const forgedPayload = {
      ...payload,
      newSource: {
        ...payload.newSource,
        path: payload.oldSource.path,
      },
    };
    const forged = {
      ...forgedPayload,
      receiptHash: sha256Stable(forgedPayload),
    };
    expect(validateLegacyPrdMigrationReceipt(forged)).toBe(false);
  });
});
