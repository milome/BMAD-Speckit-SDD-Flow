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
    '## Negative Requirements And Not Done Conditions',
    '',
    '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| NEG-001 | Publishing partial or invalid source-bound rows cannot count as success. | A validation failure must preserve the previous valid source and report the rejected rows. | Any invalid row is published or the previous valid source is mutated. | FAIL-001 | ACC-002 CMD-002 |',
    '',
    '## Failure Matrix',
    '',
    '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| FAIL-001 | Source-bound requirement rows are missing, invalid, or internally inconsistent. | Reject publication, preserve the previous valid source, and report the invalid business requirement rows. | NEG-001 | ACC-001 ACC-002 E2E-001 | MUST-FR-001 |',
    '',
    '## Acceptance Evidence',
    '',
    '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| ACC-001 | Confirmation-ready source publication | MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Valid source-bound rows produce one confirmation-ready source; invalid rows preserve the previous valid source. | CMD-001 TRACE-001 | PATH-001 owns implementation and rollback. |',
    '| ACC-002 | Invalid source rejection | NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Invalid source-bound rows never replace the previous valid source and are reported explicitly. | CMD-002 TRACE-002 | PATH-001 owns rollback. |',
    '',
    '## Test And Verification Paths',
    '',
    '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| CMD-001 | delivery-evidence | MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | Publication succeeds only for valid source-bound rows and otherwise preserves the prior source. | ACC-001 E2E-001 TRACE-001 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py src/auto_repair_target.py |',
    '| CMD-002 | delivery-evidence | NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | Invalid rows are rejected and the previous valid source hash is preserved. | ACC-002 E2E-001 TRACE-002 | PATH-001 owns rollback. | tests/trader/test_gateway_profile_registry.py src/auto_repair_target.py |',
    '| E2E-001 | e2e | MUST-FR-001 NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | The source-bound publication flow either completes atomically or fails without mutation. | ACC-001 ACC-002 CMD-001 CMD-002 TRACE-001 TRACE-002 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py src/auto_repair_target.py |',
    '',
    '## Trace Matrix Source',
    '',
    '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Valid source-bound rows publish atomically; invalid rows leave the prior source unchanged. | MUST-FR-001 closes through ACC-001, CMD-001, and TRACE-001. | PATH-001 owns remediation. |',
    '| TRACE-002 | NEG-001 | ACC-002 | ACC-002 E2E-001 | CMD-002 | CMD-002 | none | PATH-001 | none | Invalid rows never replace the previous valid source. | NEG-001 closes through ACC-002 and TRACE-002. | PATH-001 owns rollback. |',
    '',
    '## Implementation Path Map',
    '',
    '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| PATH-001 | `src/auto_repair_target.py` | Source publication owner | Publish only validated source-bound rows and preserve the prior valid source on failure. | MUST-FR-001 NEG-001 | ACC-001 and ACC-002 pass without partial publication. | ACC-001 ACC-002 CMD-001 CMD-002 TRACE-001 TRACE-002 | Source publication owner owns implementation and rollback. |',
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
