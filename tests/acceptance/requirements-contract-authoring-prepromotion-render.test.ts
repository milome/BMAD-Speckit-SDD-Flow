import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  expectSourceHashUnchanged,
  readJson,
  removeTempRoot,
  runIntakeAuthoring,
  sha256File,
  sourcePromotionDecisionPath,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

function prepromotionSource(): string {
  return [
    '# Prepromotion Render PRD',
    '',
    '目标文件：`src/prepromotion_target.py`',
    '',
    '## Functional Requirements',
    '',
    '| FR ID | Requirement |',
    '| --- | --- |',
    '| FR-001 | System MUST render the staging source before promotion. |',
    '',
    '## Negative Requirements And Not Done Conditions',
    '',
    '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| NEG-001 | A failed strict render cannot count as promotion success. | Render failure must preserve the source hash and produce no promotion receipt. | The source changes or promotion proceeds after strict render failure. | FAIL-001 | ACC-002 CMD-002 |',
    '',
    '## Failure Matrix',
    '',
    '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| FAIL-001 | The staging source cannot be rendered into a valid confirmation view. | Block promotion, preserve the current source hash, and report the renderer failure without publishing partial output. | NEG-001 | ACC-001 ACC-002 E2E-001 | MUST-FR-001 |',
    '',
    '## Acceptance Evidence',
    '',
    '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| ACC-001 | Strict staging render | MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Promotion occurs only after the staging source renders successfully; render failure preserves the source hash. | CMD-001 TRACE-001 | PATH-001 owns strict rendering and rollback. |',
    '| ACC-002 | Failed-render source preservation | NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Failed strict render preserves the source hash and produces no promotion receipt. | CMD-002 TRACE-002 | PATH-001 owns rollback. |',
    '',
    '## Test And Verification Paths',
    '',
    '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| CMD-001 | delivery-evidence | MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | Strict render precedes promotion and render failure leaves the source unchanged. | ACC-001 E2E-001 TRACE-001 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py src/prepromotion_target.py |',
    '| CMD-002 | delivery-evidence | NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | Failed strict render leaves source and promotion state unchanged. | ACC-002 E2E-001 TRACE-002 | PATH-001 owns rollback. | tests/trader/test_gateway_profile_registry.py src/prepromotion_target.py |',
    '| E2E-001 | e2e | MUST-FR-001 NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py | Exit code 0. | The staging-render-to-promotion flow is atomic and fail closed. | ACC-001 ACC-002 CMD-001 CMD-002 TRACE-001 TRACE-002 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py src/prepromotion_target.py |',
    '',
    '## Trace Matrix Source',
    '',
    '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| TRACE-001 | MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Successful strict render precedes promotion; failure preserves the source hash. | MUST-FR-001 closes through ACC-001 and TRACE-001. | PATH-001 owns remediation. |',
    '| TRACE-002 | NEG-001 | ACC-002 | ACC-002 E2E-001 | CMD-002 | CMD-002 | none | PATH-001 | none | Failed strict render produces no source mutation or promotion receipt. | NEG-001 closes through ACC-002 and TRACE-002. | PATH-001 owns rollback. |',
    '',
    '## Implementation Path Map',
    '',
    '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| PATH-001 | `src/prepromotion_target.py` | Promotion owner | Require a successful strict staging render before atomic promotion. | MUST-FR-001 NEG-001 | ACC-001 and ACC-002 prove success and rollback independently. | ACC-001 ACC-002 CMD-001 CMD-002 TRACE-001 TRACE-002 | Promotion owner owns implementation and rollback. |',
    '',
    '## Out Of Scope',
    '',
    '- Direct renderer source mutation is out of scope.',
  ].join('\n');
}

describe('requirements contract authoring prepromotion render', () => {
  it('strict_render_precedes_promotion', () => {
    const root = createTempRoot('bmad-prepromotion-render-');
    try {
      const intakeSource = writeText(root, 'source.md', prepromotionSource());
      const targetSource = path.join(root, 'generated.md');
      const recordId = 'REQ-TEST-PREPROMOTION-RENDER';

      runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const decision = readJson<Record<string, unknown>>(
        sourcePromotionDecisionPath(root, recordId)
      );

      expect(decision).toMatchObject({
        strictRenderBeforePromotion: true,
        strictRenderConfirmability: 'confirmable',
        strictRenderBlockingIssueCount: 0,
        promotionPreconditionOrder: [
          'model_closure',
          'localization',
          'projection',
          'packet_reconciliation',
          'source_write_gates',
          'critical_auditor_round_1',
          'critical_auditor_round_2',
          'critical_auditor_round_3',
          'strict_render',
          'encoding_gate',
          'final_hash_reconciliation',
          'promotion',
        ],
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('failed_strict_render_preserves_source_hash', () => {
    const root = createTempRoot('bmad-prepromotion-fail-');
    try {
      const targetSource = writeText(root, 'existing.md', prepromotionSource());
      const intakeSource = writeText(root, 'source.md', prepromotionSource());
      const beforeHash = sha256File(targetSource);
      const recordId = 'REQ-TEST-PREPROMOTION-FAIL';

      const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        requiredCommand: 'python -m pytest tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        criticalAuditorRound: cleanCriticalAuditorRound,
        forceStrictRenderFailureForTest: true,
      });

      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const decisionPath = sourcePromotionDecisionPath(root, recordId);

      expect(result.blockingIssues.map((issue) => issue.code)).toContain(
        'renderer_oracle_escape_upstream_runtime_defect'
      );
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(readJson<Record<string, unknown>>(decisionPath)).toMatchObject({
        finalDecision: 'block_source_promotion',
        strictRenderBeforePromotion: true,
        sourceHashPreservedAfterFailedStrictRender: true,
      });
      expectSourceHashUnchanged(targetSource, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });
});
