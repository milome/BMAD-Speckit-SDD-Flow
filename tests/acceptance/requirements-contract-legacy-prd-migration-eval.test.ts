import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateLegacyPrdMigrationCases,
  type LegacyPrdMigrationEvaluationCase,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';
import {
  createLegacyPrdMigrationReceipt,
  validateLegacyPrdMigrationReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-legacy-prd-migration';
import { resolvePlanningArtifactPath } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-planning-artifact-resolver';
import {
  sha256Stable,
  sha256Text,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function migrationCase(): {
  evaluationCase: LegacyPrdMigrationEvaluationCase;
  receipt: ReturnType<typeof createLegacyPrdMigrationReceipt>;
} {
  const identity = randomUUID();
  const branch = `branch-${identity}`;
  const requirementSetId = `requirements-${identity}`;
  const recordId = `record-${identity}`;
  const oldPath = `_bmad-output/planning-artifacts/${branch}/legacy-${identity}-prd.md`;
  const newPath = resolvePlanningArtifactPath({
    role: 'requirement_source_prd',
    branch,
    requirementSetId,
  });
  const runtimeRecordPath = resolvePlanningArtifactPath({
    role: 'runtime_requirement_record',
    recordId,
  });
  const receipt = createLegacyPrdMigrationReceipt({
    migrationId: `migration-${identity}`,
    requirementSetId,
    branch,
    sourceRole: 'requirement_source_prd',
    oldSource: {
      path: oldPath,
      hash: sha256Text(`legacy-source-${identity}`),
    },
    newSource: {
      path: newPath,
      hash: sha256Text(`canonical-source-${identity}`),
    },
    runtimeRecordRef: {
      path: runtimeRecordPath,
      hash: sha256Stable({ recordId, requirementSetId, newPath }),
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
  return {
    receipt,
    evaluationCase: {
      caseRef: receipt.migrationId,
      receiptValid: validateLegacyPrdMigrationReceipt(receipt),
      oldAuthorityActive: !receipt.oldAuthorityRevoked,
      newAuthorityActive: receipt.newAuthorityActivated,
      downstreamBindingMismatchCount: receipt.downstreamBindingUpdates.filter(
        (binding) =>
          binding.previousPath !== receipt.oldSource.path ||
          binding.currentPath !== receipt.newSource.path
      ).length,
    },
  };
}

describe('requirements contract legacy PRD migration evaluation', () => {
  it('binds migration hashes and leaves only the canonical source authoritative', () => {
    const current = migrationCase();

    const result = evaluateLegacyPrdMigrationCases([current.evaluationCase]);

    expect(current.receipt.oldSource.path).not.toBe(current.receipt.newSource.path);
    expect(result.invalidReceiptCount).toBe(0);
    expect(result.duplicatePrdAuthorityCount).toBe(0);
    expect(result.downstreamBindingMismatchCount).toBe(0);
    expect(result.decision).toBe('pass');
  });

  it('blocks a migration that leaves old and new PRDs authoritative', () => {
    const current = migrationCase();
    const invalid: LegacyPrdMigrationEvaluationCase = {
      ...current.evaluationCase,
      oldAuthorityActive: true,
      newAuthorityActive: true,
    };

    const result = evaluateLegacyPrdMigrationCases([invalid]);

    expect(result.duplicatePrdAuthorityCount).toBe(1);
    expect(result.decision).toBe('block');
  });
});
