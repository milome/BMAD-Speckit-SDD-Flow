import { describe, expect, it } from 'vitest';
import {
  migrateRequirementContractV1ToV2,
  validateRequirementContractModelV2,
  type RequirementContractModel,
  type RequirementContractRequirementV2,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';

const HASH = `sha256:${'1'.repeat(64)}`;

function legacyModel(requirementId = 'FR-1'): RequirementContractModel {
  return {
    schemaVersion: 'requirement-contract-model/v1',
    recordId: 'REQ-MIGRATION',
    requirementSetId: 'migration',
    must: [
      {
        id: requirementId,
        text: 'The source actor can invoke the source operation.',
        sourceRequirementId: requirementId,
        sourcePath: 'docs/requirements/source.md',
        sourceSpan: { startLine: 10, endLine: 12 },
        headingPath: ['Source operation'],
        authorityState: 'source_authorized',
        provenance: { sourceHash: HASH },
      },
    ],
    notDone: [],
    outOfScope: [],
    evidence: [],
    acceptanceCriteria: [],
    requiredCommands: [],
    traceRows: [],
    businessViews: [],
    sequenceViews: [],
    flowViews: [],
    edgeCaseViews: [],
    boundaryViews: [],
    targetModificationPaths: [],
    applicability: {},
    invariantClosure: {
      appliedPasses: [],
      remainingIssueCount: 0,
      rendererBlockerPolicy: 'renderer_blocker_release_failure',
      issues: [],
    },
  };
}

function migratedRequirement(model = legacyModel()): RequirementContractRequirementV2 {
  const migrated = migrateRequirementContractV1ToV2(model);
  const node = migrated.nodes['MUST-FR-001'];
  return migrated.semanticBodies[node.bodyHash] as unknown as RequirementContractRequirementV2;
}

describe('requirements contract v1 to v2 migration', () => {
  it('preserves source text and bindings while blocking unavailable semantic fields', () => {
    const requirement = migratedRequirement();

    expect(requirement).toMatchObject({
      id: 'MUST-FR-001',
      text: 'The source actor can invoke the source operation.',
      source: {
        sourcePath: 'docs/requirements/source.md',
        sourceSpan: { startLine: 10, endLine: 12 },
        sourceHash: HASH,
        sourceRequirementId: 'FR-1',
      },
      authority: {
        authorityState: 'source_grounded',
        derivation: 'migrated_v1_source_binding',
      },
      applicability: {
        state: 'unresolved',
        reasonCode: 'migration_requires_semantic_resolution',
      },
    });
    expect(requirement.unresolved.length).toBeGreaterThan(0);
    expect(requirement.unresolved.every((item) => item.blocking)).toBe(true);
  });

  it('is deterministic and produces a schema-valid inactive v2 model', () => {
    const first = migrateRequirementContractV1ToV2(legacyModel());
    const second = migrateRequirementContractV1ToV2(legacyModel());

    expect(second).toEqual(first);
    expect(first.activationState).toBe('inactive_schema_boundary');
    expect(first.authority).toBe('none');
    expect(validateRequirementContractModelV2(first)).toEqual({ ok: true, issues: [] });
  });

  it('fails closed for non-deterministic IDs and empty requirement roots', () => {
    expect(() => migrateRequirementContractV1ToV2(legacyModel('REQ-PAYMENT'))).toThrow(
      'v1 requirement ID cannot be migrated deterministically'
    );
    expect(() =>
      migrateRequirementContractV1ToV2({
        ...legacyModel(),
        must: [],
      })
    ).toThrow('v1 requirement model cannot migrate without requirement roots');
  });
});
