import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  JUDGE_AUDIT_FIXTURE_HASHES,
  JUDGE_AUDIT_FIXTURE_IDS,
  judgeAuditUnitProjectionFixture,
} from '../fixtures/requirements-contract/judge-audit-unit-projection/input';
import * as judgeAuditProjectorModule from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-audit-unit-projector';
import { projectRequirementsContractJudgeAuditUnitSet } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-audit-unit-projector';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const INPUT_SCHEMA_PATH = path.resolve(
  ROOT,
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-audit-unit-projection-input.schema.json'
);
const SCHEMA_PATH = path.resolve(
  ROOT,
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-judge-audit-unit-set.schema.json'
);
const DIST_PROJECTOR_PATH = path.resolve(
  ROOT,
  'packages/bmad-speckit/dist/main-agent/source-authority/scripts/requirements-contract-judge-audit-unit-projector.js'
);

describe('requirements contract Judge Audit Unit projector', () => {
  it('projects associated roots and standalone roots with complete bidirectional parity', () => {
    const fixture = judgeAuditUnitProjectionFixture();
    const validateInput = new Ajv2020({ allErrors: true, strict: false }).compile(
      JSON.parse(readFileSync(INPUT_SCHEMA_PATH, 'utf8'))
    );
    const result = projectRequirementsContractJudgeAuditUnitSet(fixture);
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
      JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
    );

    expect(validateInput(fixture), JSON.stringify(validateInput.errors ?? [])).toBe(true);
    expect(result.decision).toBe('pass');
    expect(validate(result), JSON.stringify(validate.errors ?? [])).toBe(true);
    expect(result.coverage).toMatchObject({
      missingRootCount: 0,
      extraRootCount: 0,
      orphanRootCount: 0,
      duplicateRootCount: 0,
      mustUnitCoverage: 1,
      negativeRootCoverage: 1,
      acceptanceRootCoverage: 1,
    });

    const mustUnit = result.units.find(
      (unit) => unit.unitKind === 'must' && unit.requirementRef === JUDGE_AUDIT_FIXTURE_IDS.mustRoot
    );
    const standaloneUnit = result.units.find(
      (unit) =>
        unit.unitKind === 'standalone' &&
        unit.requirementRef === JUDGE_AUDIT_FIXTURE_IDS.standaloneNegativeRoot
    );

    expect(mustUnit?.rootRefs).toEqual(
      expect.arrayContaining([
        JUDGE_AUDIT_FIXTURE_IDS.mustRoot,
        JUDGE_AUDIT_FIXTURE_IDS.associatedNegativeRoot,
        JUDGE_AUDIT_FIXTURE_IDS.firstAcceptanceRoot,
        JUDGE_AUDIT_FIXTURE_IDS.secondAcceptanceRoot,
      ])
    );
    expect(standaloneUnit?.rootRefs).toEqual(
      expect.arrayContaining([
        JUDGE_AUDIT_FIXTURE_IDS.standaloneNegativeRoot,
        JUDGE_AUDIT_FIXTURE_IDS.standaloneAcceptanceRoot,
      ])
    );
    expect(standaloneUnit?.traceRowRefs).not.toContain(JUDGE_AUDIT_FIXTURE_IDS.mustTrace);
    expect(result.unitToRoot.flatMap((edge) => edge.rootRefs).sort()).toEqual(
      result.rootToUnit.map((edge) => edge.rootRef).sort()
    );
  });

  it('blocks duplicate root declarations instead of collapsing them into all-to-all coverage', () => {
    const fixture = judgeAuditUnitProjectionFixture();
    const duplicateRoot = fixture.compactTraceMatrix.acceptanceRootIds[0];
    const invalidFixture = {
      ...fixture,
      compactTraceMatrix: {
        ...fixture.compactTraceMatrix,
        acceptanceRootIds: [...fixture.compactTraceMatrix.acceptanceRootIds, duplicateRoot],
      },
    };

    const result = projectRequirementsContractJudgeAuditUnitSet(invalidFixture);

    expect(result.decision).toBe('block');
    expect(result.coverage.duplicateRootCount).toBeGreaterThan(0);
    expect(result.blockingReasons).toContain(`duplicate_root:${duplicateRoot}`);
  });

  it('returns every in-scope audit gap in one projection and rejects incomplete evidence', () => {
    const fixture = judgeAuditUnitProjectionFixture();
    const missingBindingRoot = JUDGE_AUDIT_FIXTURE_IDS.secondAcceptanceRoot;
    const incompleteEvidenceRoot = JUDGE_AUDIT_FIXTURE_IDS.associatedNegativeRoot;
    const missingSemanticRoot = JUDGE_AUDIT_FIXTURE_IDS.standaloneNegativeRoot;
    const { [missingSemanticRoot]: _omitted, ...remainingNodes } = fixture.semanticModel.nodes;
    const result = projectRequirementsContractJudgeAuditUnitSet({
      ...fixture,
      semanticModel: {
        ...fixture.semanticModel,
        nodes: remainingNodes,
      },
      compactTraceMatrix: {
        ...fixture.compactTraceMatrix,
        acceptanceRootIds: fixture.compactTraceMatrix.acceptanceRootIds.filter(
          (rootRef) => rootRef !== JUDGE_AUDIT_FIXTURE_IDS.standaloneAcceptanceRoot
        ),
      },
      rootBindings: fixture.rootBindings
        .filter((binding) => binding.rootRef !== missingBindingRoot)
        .map((binding) =>
          binding.rootRef === incompleteEvidenceRoot ? { ...binding, evidenceRefs: [] } : binding
        ),
    });

    expect(result.decision).toBe('block');
    expect(result.blockingReasons).toEqual([
      `missing_acceptance_root_projection:${JUDGE_AUDIT_FIXTURE_IDS.standaloneAcceptanceRoot}`,
      `missing_root_binding:${missingBindingRoot}`,
      `missing_semantic_root:${missingSemanticRoot}`,
      `root_binding_field_missing:${incompleteEvidenceRoot}:evidenceRefs`,
    ]);
    expect(result.coverage.unitEvidenceCompleteness).toBe(0);
  });

  it('keeps source and dist projection behavior identical for the shared fixture', () => {
    const distProjector = require(DIST_PROJECTOR_PATH) as {
      projectRequirementsContractJudgeAuditUnitSet?: typeof projectRequirementsContractJudgeAuditUnitSet;
    };

    expect(distProjector.projectRequirementsContractJudgeAuditUnitSet).toBeTypeOf('function');
    if (typeof distProjector.projectRequirementsContractJudgeAuditUnitSet !== 'function') return;

    const fixture = judgeAuditUnitProjectionFixture();
    expect(distProjector.projectRequirementsContractJudgeAuditUnitSet(fixture)).toEqual(
      projectRequirementsContractJudgeAuditUnitSet(fixture)
    );
  });

  it('blocks when an applicable root has no complete evidence binding', () => {
    const fixture = judgeAuditUnitProjectionFixture();
    const missingBindingRoot = JUDGE_AUDIT_FIXTURE_IDS.secondAcceptanceRoot;
    const result = projectRequirementsContractJudgeAuditUnitSet({
      ...fixture,
      rootBindings: fixture.rootBindings.filter(
        (binding) => binding.rootRef !== missingBindingRoot
      ),
    });

    expect(result.decision).toBe('block');
    expect(result.blockingReasons).toContain(`missing_root_binding:${missingBindingRoot}`);
  });

  it('does not associate roots through an unregistered edge type', () => {
    const fixture = judgeAuditUnitProjectionFixture();
    const edgeId = Object.keys(fixture.semanticModel.edges)[0];
    const edge = fixture.semanticModel.edges[edgeId];
    const result = projectRequirementsContractJudgeAuditUnitSet({
      ...fixture,
      semanticModel: {
        ...fixture.semanticModel,
        edges: {
          ...fixture.semanticModel.edges,
          [edgeId]: {
            ...edge,
            edgeType: 'implemented_in',
          },
        },
      },
    });
    const negativeUnit = result.units.find(
      (unit) => unit.requirementRef === JUDGE_AUDIT_FIXTURE_IDS.associatedNegativeRoot
    );

    expect(negativeUnit?.unitKind).toBe('standalone');
  });

  it('blocks payload drift against the canonical root universe', () => {
    const fixture = judgeAuditUnitProjectionFixture();
    const baseline = projectRequirementsContractJudgeAuditUnitSet(fixture);
    const result = projectRequirementsContractJudgeAuditUnitSet({
      ...fixture,
      canonicalRootUniverse: {
        ...fixture.canonicalRootUniverse,
        requirementRoots: fixture.canonicalRootUniverse.requirementRoots.map((root) =>
          root.rootRef === JUDGE_AUDIT_FIXTURE_IDS.associatedNegativeRoot
            ? { ...root, payloadHash: JUDGE_AUDIT_FIXTURE_HASHES.driftedPayloadHash }
            : root
        ),
      },
    });

    expect(result.decision).toBe('block');
    expect(result.blockingReasons).toContain(
      `root_payload_hash_mismatch:${JUDGE_AUDIT_FIXTURE_IDS.associatedNegativeRoot}`
    );
    expect(result.judgeAuditUniverseHash).not.toBe(baseline.judgeAuditUniverseHash);
  });

  it('blocks when the canonical universe contains a root missing from Semantic IR', () => {
    const fixture = judgeAuditUnitProjectionFixture();
    const missingSemanticRoot = JUDGE_AUDIT_FIXTURE_IDS.standaloneNegativeRoot;
    const { [missingSemanticRoot]: _omitted, ...remainingNodes } = fixture.semanticModel.nodes;
    const result = projectRequirementsContractJudgeAuditUnitSet({
      ...fixture,
      semanticModel: {
        ...fixture.semanticModel,
        nodes: remainingNodes,
      },
    });

    expect(result.decision).toBe('block');
    expect(result.blockingReasons).toContain(`missing_semantic_root:${missingSemanticRoot}`);
  });

  it('classifies functional roots from semantic kind rather than identifier prefix', () => {
    const fixture = judgeAuditUnitProjectionFixture();
    const renamedMustRoot = JUDGE_AUDIT_FIXTURE_IDS.mustRoot.replace(/^MUST-/u, 'REQ-');
    const renamedFixture = JSON.parse(
      JSON.stringify(fixture).replaceAll(JUDGE_AUDIT_FIXTURE_IDS.mustRoot, renamedMustRoot)
    ) as typeof fixture;
    const result = projectRequirementsContractJudgeAuditUnitSet(renamedFixture);
    const renamedUnit = result.units.find((unit) => unit.requirementRef === renamedMustRoot);

    expect(renamedUnit?.unitKind).toBe('must');
  });

  it('fails closed when projected parity, hashes, or decision are tampered', () => {
    const validator = (
      judgeAuditProjectorModule as typeof judgeAuditProjectorModule & {
        validateRequirementsContractJudgeAuditUnitSet?: (
          input: ReturnType<typeof projectRequirementsContractJudgeAuditUnitSet>
        ) => { ok: boolean; issues: string[] };
      }
    ).validateRequirementsContractJudgeAuditUnitSet;

    expect(validator).toBeTypeOf('function');
    if (typeof validator !== 'function') return;

    const result = projectRequirementsContractJudgeAuditUnitSet(judgeAuditUnitProjectionFixture());
    expect(validator(result)).toEqual({ ok: true, issues: [] });

    const unit = result.units[0];
    const unitHashTampered = {
      ...result,
      units: [
        { ...unit, unitHash: JUDGE_AUDIT_FIXTURE_HASHES.driftedPayloadHash },
        ...result.units.slice(1),
      ],
    };
    expect(validator(unitHashTampered).issues).toContain(`unit_hash_mismatch:${unit.unitId}`);

    const rootMapping = result.rootToUnit[0];
    const rootParityTampered = {
      ...result,
      rootToUnit: [
        { ...rootMapping, unitId: `${rootMapping.unitId}-TAMPERED` },
        ...result.rootToUnit.slice(1),
      ],
    };
    expect(validator(rootParityTampered).issues).toContain(
      `root_to_unit_parity_mismatch:${rootMapping.rootRef}`
    );

    expect(validator({ ...result, decision: 'block' }).issues).toContain(
      'decision_consistency_mismatch'
    );
    expect(validator({ ...result, authority: 'final_acceptance_judge' } as never).issues).toContain(
      'authority_mismatch'
    );
    expect(
      validator({
        ...result,
        coverage: { ...result.coverage, missingRootBindingCount: 99 },
      }).issues
    ).toContain('coverage_mismatch:missingRootBindingCount');
  });
});
