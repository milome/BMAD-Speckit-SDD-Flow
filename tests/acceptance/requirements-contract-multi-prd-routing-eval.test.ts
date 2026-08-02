import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateMultiPrdRoutingCases,
  type MultiPrdRoutingEvaluationCase,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';
import {
  resolvePlanningArtifactPath,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-planning-artifact-resolver';
import {
  validateRequirementSourceIdentitySet,
  type RequirementSourceIdentity,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-project-profile';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

function identity(input: {
  branch: string;
  requirementSetId: string;
  recordId: string;
  sourcePath: string;
}): RequirementSourceIdentity {
  const sourceHash = sha256Stable(input);
  return {
    schemaVersion: 'requirements-contract-source-identity/v1',
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    branch: input.branch,
    entrySource: 'create_prd_session',
    sourceKind: 'requirement_source_prd',
    sourcePath: input.sourcePath,
    sourceHash,
    identityAuthority: {
      kind: 'discovery_session_receipt',
      ref: `_bmad-output/runtime/discovery/${input.requirementSetId}/session-receipt.json`,
      hash: sourceHash,
    },
  };
}

describe('requirements contract multi-PRD routing evaluation', () => {
  it('routes explicit stable identities through one canonical path resolver', () => {
    const branch = `branch-${randomUUID()}`;
    const requirementSetIds = [randomUUID(), randomUUID()].map(
      (value) => `requirements-${value}`
    );
    const productPath = resolvePlanningArtifactPath({
      role: 'product_prd',
      branch,
    });
    const requirementPaths = requirementSetIds.map((requirementSetId) =>
      resolvePlanningArtifactPath({
        role: 'requirement_source_prd',
        branch,
        requirementSetId,
      })
    );
    const identities = requirementSetIds.map((requirementSetId, index) =>
      identity({
        branch,
        requirementSetId,
        recordId: `record-${randomUUID()}`,
        sourcePath: requirementPaths[index],
      })
    );
    const identityValidation = validateRequirementSourceIdentitySet(identities);
    const evaluationCase: MultiPrdRoutingEvaluationCase = {
      caseRef: `routing-${randomUUID()}`,
      productPath,
      requirementPaths,
      identityValidationOk: identityValidation.ok,
      basenameDerivedRequirementIdentityCount: 0,
      sourceIdentityCollisionCount: 0,
      ambiguousPrdAutoSelectionCount: 0,
      directPlanningPathConstructionCount: 0,
      duplicatePrdAuthorityCount: 0,
      runtimeSourceHashMismatchCount: 0,
    };

    const result = evaluateMultiPrdRoutingCases([evaluationCase]);

    expect(new Set(requirementPaths).size).toBe(requirementSetIds.length);
    expect(requirementPaths.every((value) => !value.includes('*'))).toBe(true);
    expect(productPath).not.toBe(requirementPaths[0]);
    expect(result.invalidIdentitySetCount).toBe(0);
    expect(result.issueCount).toBe(0);
    expect(result.decision).toBe('pass');
  });

  it('blocks missing stable IDs and multiple authoritative source paths', () => {
    const branch = `branch-${randomUUID()}`;
    const requirementSetId = `requirements-${randomUUID()}`;
    const firstPath = resolvePlanningArtifactPath({
      role: 'requirement_source_prd',
      branch,
      requirementSetId,
    });
    const secondPath = resolvePlanningArtifactPath({
      role: 'requirement_source_prd',
      branch: `${branch}-other`,
      requirementSetId,
    });
    const validation = validateRequirementSourceIdentitySet([
      identity({
        branch,
        requirementSetId,
        recordId: `record-${randomUUID()}`,
        sourcePath: firstPath,
      }),
      identity({
        branch: `${branch}-other`,
        requirementSetId,
        recordId: `record-${randomUUID()}`,
        sourcePath: secondPath,
      }),
    ]);
    expect(() =>
      resolvePlanningArtifactPath({
        role: 'requirement_source_prd',
        branch,
      })
    ).toThrow('planning_artifact_requirement_set_id_required');

    const result = evaluateMultiPrdRoutingCases([
      {
        caseRef: `routing-conflict-${randomUUID()}`,
        productPath: resolvePlanningArtifactPath({ role: 'product_prd', branch }),
        requirementPaths: [firstPath, secondPath],
        identityValidationOk: validation.ok,
        basenameDerivedRequirementIdentityCount: 0,
        sourceIdentityCollisionCount: validation.issues.filter(
          (issue) =>
            issue.code === 'source_path_collision' ||
            issue.code === 'multiple_authoritative_source_paths'
        ).length,
        ambiguousPrdAutoSelectionCount: 0,
        directPlanningPathConstructionCount: 0,
        duplicatePrdAuthorityCount: validation.issues.filter(
          (issue) => issue.code === 'duplicate_requirement_set_identity'
        ).length,
        runtimeSourceHashMismatchCount: 0,
      },
    ]);

    expect(validation.ok).toBe(false);
    expect(result.issueCount).toBeGreaterThan(0);
    expect(result.decision).toBe('block');
  });
});
