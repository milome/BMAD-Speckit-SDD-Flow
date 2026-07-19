export type PlanningArtifactRole =
  | 'product_prd'
  | 'requirement_source_prd'
  | 'runtime_requirement_record';

export interface ResolvePlanningArtifactPathInput {
  role: PlanningArtifactRole;
  branch?: string;
  requirementSetId?: string;
  recordId?: string;
}

const PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function requiredSegment(
  value: string | undefined,
  missingCode: string,
  field: string
): string {
  if (!value?.trim()) throw new Error(missingCode);
  const normalized = value.trim();
  if (!PATH_SEGMENT.test(normalized) || normalized === '.' || normalized === '..') {
    throw new Error(`planning_artifact_segment_invalid:${field}`);
  }
  return normalized;
}

export function resolvePlanningArtifactPath(
  input: ResolvePlanningArtifactPathInput
): string {
  if (input.role === 'product_prd') {
    const branch = requiredSegment(
      input.branch,
      'planning_artifact_branch_required',
      'branch'
    );
    return `_bmad-output/planning-artifacts/${branch}/prd.md`;
  }
  if (input.role === 'requirement_source_prd') {
    const branch = requiredSegment(
      input.branch,
      'planning_artifact_branch_required',
      'branch'
    );
    const requirementSetId = requiredSegment(
      input.requirementSetId,
      'planning_artifact_requirement_set_id_required',
      'requirementSetId'
    );
    return `_bmad-output/planning-artifacts/${branch}/requirements/${requirementSetId}/prd.md`;
  }
  if (input.role === 'runtime_requirement_record') {
    const recordId = requiredSegment(
      input.recordId,
      'planning_artifact_record_id_required',
      'recordId'
    );
    return `_bmad-output/runtime/requirement-records/${recordId}/requirement-record.json`;
  }
  throw new Error('planning_artifact_role_invalid');
}
