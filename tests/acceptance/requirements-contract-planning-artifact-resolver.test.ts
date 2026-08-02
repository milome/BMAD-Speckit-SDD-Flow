import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { resolvePlanningArtifactPath } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-planning-artifact-resolver';

describe('requirements contract planning artifact resolver', () => {
  it('resolves every path role from explicit stable identity inputs', () => {
    const branch = `branch-${randomUUID()}`;
    const requirementSetId = `requirements-${randomUUID()}`;
    const recordId = `record-${randomUUID()}`;

    expect(resolvePlanningArtifactPath({ role: 'product_prd', branch })).toBe(
      `_bmad-output/planning-artifacts/${branch}/prd.md`
    );
    expect(
      resolvePlanningArtifactPath({
        role: 'requirement_source_prd',
        branch,
        requirementSetId,
      })
    ).toBe(
      `_bmad-output/planning-artifacts/${branch}/requirements/${requirementSetId}/prd.md`
    );
    expect(
      resolvePlanningArtifactPath({
        role: 'runtime_requirement_record',
        recordId,
      })
    ).toBe(
      `_bmad-output/runtime/requirement-records/${recordId}/requirement-record.json`
    );
  });

  it('rejects missing identities and unsafe path segments', () => {
    const branch = `branch-${randomUUID()}`;
    expect(() =>
      resolvePlanningArtifactPath({ role: 'requirement_source_prd', branch })
    ).toThrow('planning_artifact_requirement_set_id_required');
    expect(() =>
      resolvePlanningArtifactPath({
        role: 'requirement_source_prd',
        branch: '../escape',
        requirementSetId: `requirements-${randomUUID()}`,
      })
    ).toThrow('planning_artifact_segment_invalid:branch');
    expect(() =>
      resolvePlanningArtifactPath({
        role: 'runtime_requirement_record',
        recordId: '*',
      })
    ).toThrow('planning_artifact_segment_invalid:recordId');
  });
});
