import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createRequirementSourceRegistry,
  resolveRequirementSourceBinding,
  validateRequirementSourceRegistry,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirement-source-registry';
import { resolvePlanningArtifactPath } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-planning-artifact-resolver';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function entry(branch: string) {
  const requirementSetId = `requirements-${randomUUID()}`;
  const recordId = `record-${randomUUID()}`;
  const sourcePath = resolvePlanningArtifactPath({
    role: 'requirement_source_prd',
    branch,
    requirementSetId,
  });
  const sourceHash = sha256Stable({ requirementSetId, sourcePath });
  return {
    recordId,
    requirementSetId,
    branch,
    source: {
      path: sourcePath,
      hash: sourceHash,
      sourceKind: 'requirement_source_prd' as const,
    },
    identityAuthority: {
      kind: 'discovery_session_receipt' as const,
      ref: `_bmad-output/runtime/discovery/${requirementSetId}/session-receipt.json`,
      hash: sourceHash,
    },
  };
}

describe('requirements contract requirement source registry', () => {
  it('resolves one current hash-bound source for each stable requirementSetId', () => {
    const branch = `branch-${randomUUID()}`;
    const entries = [entry(branch), entry(branch)];
    const registry = createRequirementSourceRegistry({
      registryId: `registry-${randomUUID()}`,
      entries,
    });

    expect(validateRequirementSourceRegistry(registry)).toBe(true);
    for (const expected of entries) {
      expect(
        resolveRequirementSourceBinding({
          registry,
          requirementSetId: expected.requirementSetId,
          observedSourceHash: expected.source.hash,
        })
      ).toMatchObject(expected);
    }
  });

  it('rejects absent IDs, stale hashes, and duplicate source authority', () => {
    const branch = `branch-${randomUUID()}`;
    const current = entry(branch);
    const registry = createRequirementSourceRegistry({
      registryId: `registry-${randomUUID()}`,
      entries: [current],
    });
    expect(() =>
      resolveRequirementSourceBinding({
        registry,
        requirementSetId: `missing-${randomUUID()}`,
      })
    ).toThrow('requirement_source_not_registered');
    expect(() =>
      resolveRequirementSourceBinding({
        registry,
        requirementSetId: current.requirementSetId,
        observedSourceHash: sha256Stable({ stale: randomUUID() }),
      })
    ).toThrow('requirement_source_hash_mismatch');
    expect(() =>
      createRequirementSourceRegistry({
        registryId: `registry-${randomUUID()}`,
        entries: [
          current,
          {
            ...current,
            recordId: `record-${randomUUID()}`,
            source: {
              ...current.source,
              path: resolvePlanningArtifactPath({
                role: 'requirement_source_prd',
                branch: `${branch}-other`,
                requirementSetId: current.requirementSetId,
              }),
            },
          },
        ],
      })
    ).toThrow('requirement_source_registry_invalid');
  });
});
