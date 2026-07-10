import { existsSync, readFileSync } from 'node:fs';
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
import {
  REQUIREMENTS_AUTHORING_REPAIR_REGISTRY,
  classifyRequirementAuthoringIssue,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-repair-registry';

function sourceWithDerivableViews(): string {
  return [
    '# Auto Repair Source PRD',
    '',
    '目标文件：`src/auto_repair_target.py`',
    '',
    '## Functional Requirements',
    '',
    '| FR ID | Requirement |',
    '| --- | --- |',
    '| FR-001 | The system MUST publish a confirmation-ready source from source-bound rows. |',
    '',
    '## Out Of Scope',
    '',
    '- Runtime delivery execution is out of scope.',
  ].join('\n');
}

describe('requirements contract authoring auto-repair loop', () => {
  it('classifies deterministic, authority, environment, and forbidden blocker families through a typed registry', () => {
    expect(REQUIREMENTS_AUTHORING_REPAIR_REGISTRY.sourceKind).toBe('typescript_typed_map');
    expect(classifyRequirementAuthoringIssue('trace_unknown_view_ref')).toMatchObject({
      repairability: 'auto',
      failureClass: 'deterministic_generation_defect',
    });
    expect(
      classifyRequirementAuthoringIssue('confirmation_language_content_english_only')
    ).toMatchObject({
      repairability: 'auto',
      failureClass: 'deterministic_generation_defect',
      issueFamily: 'confirmation_localization_materialization',
    });
    expect(classifyRequirementAuthoringIssue('target_authority_missing')).toMatchObject({
      repairability: 'input_required',
      failureClass: 'authority_gap',
    });
    expect(classifyRequirementAuthoringIssue('missing_mermaid_runtime')).toMatchObject({
      repairability: 'environment_required',
      failureClass: 'environment_gap',
    });
    expect(classifyRequirementAuthoringIssue('forbidden_repair_requested')).toMatchObject({
      repairability: 'forbidden',
      failureClass: 'forbidden_repair',
    });
    expect(classifyRequirementAuthoringIssue('new_renderer_blocker_from_future')).toMatchObject({
      code: 'repair_registry_unclassified_issue_code',
      rawIssueCode: 'new_renderer_blocker_from_future',
      repairability: 'forbidden',
      failureClass: 'upstream_runtime_defect',
    });
  });

  it('writes registry receipts by default and preserves diagnostics for --no-auto-repair', () => {
    const root = createTempRoot('bmad-auto-repair-');
    try {
      const intakeSource = writeText(root, 'source.md', sourceWithDerivableViews());
      const targetSource = path.join(root, 'generated.md');
      const recordId = 'REQ-TEST-AUTO-REPAIR';

      const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const registryPath = path.join(paths.authoring, 'repair-registry.json');
      expect(existsSync(registryPath)).toBe(true);
      expect(readJson<Record<string, unknown>>(registryPath)).toMatchObject({
        sourceKind: 'typescript_typed_map',
      });
      expect(result.blockingIssues.map((issue) => issue.code)).not.toContain(
        'repair_registry_unclassified_issue_code'
      );
      expect(readFileSync(targetSource, 'utf8')).toContain('implementationConfirmation:');

      const diagnosticRecordId = 'REQ-TEST-AUTO-REPAIR-DIAGNOSTIC';
      const diagnosticTarget = path.join(root, 'diagnostic-generated.md');
      const diagnostic = runIntakeAuthoring(
        root,
        intakeSource,
        diagnosticTarget,
        diagnosticRecordId,
        {
          targetPath: 'tests/trader/test_gateway_profile_registry.py',
          requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
          confirmationLanguage: 'en-US',
          noAutoRepair: true,
        }
      );
      const diagnosticPaths = artifacts(root, diagnosticRecordId, `${diagnosticRecordId}-SET`);
      expect(existsSync(path.join(diagnosticPaths.authoring, 'repair-registry.json'))).toBe(true);
      expect(diagnostic.blockingIssues.map((issue) => issue.code)).not.toContain(
        'repair_registry_unclassified_issue_code'
      );
    } finally {
      removeTempRoot(root);
    }
  });
});
