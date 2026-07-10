import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  readJson,
  removeTempRoot,
  runIntakeAuthoring,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';
import type { RequirementContractModel } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-model';
import {
  compileRequirementContractModel,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compiler';
import {
  closeRequirementContractInvariants,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-invariant-closure';

function compilerSource(): string {
  return [
    '# Compiler Closure PRD',
    '',
    '目标文件：`src/compiler_target.py`',
    '',
    '## Functional Requirements',
    '',
    '| FR ID | Requirement |',
    '| --- | --- |',
    '| FR-001 | System MUST compile source-bound requirements into a closed model. |',
    '| FR-002 | System MUST preserve trace, acceptance, evidence, and view closure. |',
    '',
    '## Out Of Scope',
    '',
    '- User confirmation is out of scope for authoring.',
  ].join('\n');
}

describe('requirements contract authoring compiler invariant closure', () => {
  it('model_is_projection_authority', () => {
    const model = compileRequirementContractModel({
      recordId: 'REQ-COMPILER-AUTHORITY',
      requirementSetId: 'REQ-COMPILER-AUTHORITY-SET',
      must: [
        {
          id: 'MUST-FR-001',
          text: 'System MUST compile source-bound requirements into a closed model.',
          sourceRequirementId: 'FR-001',
        },
      ],
      outOfScope: [{ id: 'OUT-001', text: 'Manual source patching is out of scope.' }],
      requiredCommands: ['python -m pytest tests/trader/test_gateway_profile_registry.py'],
    });

    const closed = closeRequirementContractInvariants(model);

    expect(closed.businessViews.map((row) => row.id)).toContain('SEQ-BUSINESS-001');
    expect(closed.traceRows.every((row) => row.businessViewRefs.includes('SEQ-BUSINESS-001'))).toBe(
      true
    );
    expect(closed.invariantClosure.rendererBlockerPolicy).toBe(
      'renderer_blocker_release_failure'
    );
  });

  it('closure_measure_is_computed', () => {
    const model = compileRequirementContractModel({
      recordId: 'REQ-COMPILER-MEASURE',
      requirementSetId: 'REQ-COMPILER-MEASURE-SET',
      must: [
        {
          id: 'MUST-FR-001',
          text: 'System MUST compute a closure measure before projection.',
          sourceRequirementId: 'FR-001',
        },
      ],
      outOfScope: [{ id: 'OUT-001', text: 'Unmeasured projection success is out of scope.' }],
      requiredCommands: ['python -m pytest tests/trader/test_gateway_profile_registry.py'],
    });

    const closed = closeRequirementContractInvariants(model);
    const closure = closed.invariantClosure as unknown as Record<string, unknown>;

    expect(closure.measureBefore).toMatchObject({
      unresolvedInvariantCount: expect.any(Number),
      orphanReferenceCount: expect.any(Number),
      missingProjectionCount: expect.any(Number),
      localizationParityCount: expect.any(Number),
      schemaValidationCount: expect.any(Number),
    });
    expect(closure.measureAfter).toMatchObject({
      unresolvedInvariantCount: 0,
      orphanReferenceCount: 0,
      missingProjectionCount: 0,
      localizationParityCount: 0,
      schemaValidationCount: 0,
    });
  });

  it('closes model invariants before source materialization', () => {
    const model = compileRequirementContractModel({
      recordId: 'REQ-COMPILER-UNIT',
      requirementSetId: 'REQ-COMPILER-UNIT-SET',
      must: [
        {
          id: 'MUST-FR-001',
          text: 'System MUST compile source-bound requirements into a closed model.',
          sourceRequirementId: 'FR-001',
        },
      ],
      outOfScope: [{ id: 'OUT-001', text: 'User confirmation is out of scope.' }],
      requiredCommands: ['python -m pytest tests/trader/test_gateway_profile_registry.py'],
    });
    const closed: RequirementContractModel = closeRequirementContractInvariants(model);

    expect(closed.invariantClosure.remainingIssueCount).toBe(0);
    expect(closed.invariantClosure.appliedPasses).toEqual(
      expect.arrayContaining([
        'closeMustCoverage',
        'closeNegCoverage',
        'closeOutBoundaryViews',
        'closeTraceViewRefs',
        'closeAcceptanceCoverage',
        'closeArtifactPlan',
        'closeTargetModificationPaths',
        'closeApplicabilityDomains',
      ])
    );
    expect(closed.traceRows[0].sequenceViewRefs).toContain('SEQ-BUSINESS-001');
    expect(closed.traceRows[0].boundaryViewRefs).toContain('BOUND-001');
  });

  it('writes model and closure reports during author-confirmation-ready-source', () => {
    const root = createTempRoot('bmad-compiler-closure-');
    try {
      const intakeSource = writeText(root, 'source.md', compilerSource());
      const targetSource = path.join(root, 'generated.md');
      const recordId = 'REQ-TEST-COMPILER-CLOSURE';
      const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const modelPath = path.join(paths.authoring, 'requirement-contract-model.json');
      const reportPath = path.join(paths.authoring, 'compiler-closure-report.json');
      expect(existsSync(modelPath)).toBe(true);
      expect(existsSync(reportPath)).toBe(true);
      expect(readJson<Record<string, unknown>>(reportPath)).toMatchObject({
        remainingIssueCount: 0,
        rendererBlockerPolicy: 'renderer_blocker_release_failure',
      });
      expect(result.blockingIssues.map((issue) => issue.code)).not.toContain(
        'renderer_blocker_release_failure'
      );
    } finally {
      removeTempRoot(root);
    }
  });
});
