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
    'Target file: `tests/trader/test_gateway_profile_registry.py`',
    '',
    '## Product Context',
    '',
    'The authoring flow validates a strict staging render before source publication.',
    '',
    '## Success Criteria',
    '',
    'Promotion occurs only after a confirmable strict render, and failure preserves source bytes.',
    '',
    '## In Scope',
    '',
    'Strict staging render ordering and fail-closed source promotion.',
    '',
    '## User Journeys',
    '',
    'The author receives either a confirmed promotion decision or an unchanged source with a blocker.',
    '',
    '## Functional Requirements',
    '',
    '| FR ID | Requirement | Source rationale | Acceptance link | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| FR-001 | System MUST render the staging source before promotion. | Promotion cannot validate content that was not rendered. | ACC-001 | Strict render succeeds before promotion begins. | CMD-001 TRACE-001 | PATH-001 owns strict rendering. |',
    '',
    '## Non-Functional Requirements',
    '',
    '| NFR ID | Category | Requirement | Threshold and evidence | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| NFR-001 | Atomicity | Strict render failure must preserve the target source hash. | ACC-002 proves byte preservation and no promotion receipt. | The target hash remains unchanged after failure. | ACC-002 CMD-002 TRACE-002 | PATH-001 owns source preservation. |',
    '',
    '## Negative Requirements And Not Done Conditions',
    '',
    '| ID | Not-done condition | Negative assertion | Blocks completion when | Failure refs | Evidence refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| NEG-001 | A failed strict render cannot count as promotion success. | Render failure must preserve the source hash and produce no promotion receipt. | The source changes or promotion proceeds after strict render failure. | FAIL-002 | ACC-002 CMD-002 |',
    '| NEG-002 | Promotion cannot begin before strict rendering succeeds. | The promotion decision remains blocked until strict rendering is confirmed. | Promotion starts before the strict render result is confirmable. | FAIL-001 | ACC-001 CMD-001 |',
    '',
    '## Architecture Decision Records',
    '',
    'Strict rendering is a mandatory promotion precondition and cannot be bypassed.',
    '',
    '## Failure Matrix',
    '',
    '| ID | Failure condition | Required system behavior | Negative requirement refs | Evidence | Requirement refs |',
    '| --- | --- | --- | --- | --- | --- |',
    '| FAIL-001 | Promotion begins before the staging source renders successfully. | Block promotion until the strict staging render succeeds. | NEG-002 | ACC-001 E2E-001 | MUST-FR-001 |',
    '| FAIL-002 | The staging source cannot be rendered into a valid confirmation view. | Block promotion, preserve the current source hash, and report the renderer failure without publishing partial output. | NEG-001 | ACC-002 E2E-002 | MUST-NFR-001 |',
    '',
    '## Acceptance Evidence',
    '',
    '| ID | Evidence target | Covers | Required evidence | Oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    '| ACC-001 | Strict staging render | NEG-002 MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k strict_render_precedes_promotion | Promotion occurs only after the staging source renders successfully. | CMD-001 | PATH-001 owns strict rendering. |',
    '| ACC-002 | Failed-render source preservation | NEG-001 MUST-NFR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k failed_strict_render_preserves_source_hash | Failed strict render preserves the source hash and produces no promotion receipt. | CMD-002 | PATH-001 owns rollback. |',
    '',
    '## Test And Verification Paths',
    '',
    '| ID | Type | Covers | Command or evidence path | Completion rule | Per-MUST oracle | Assertion source | Responsibility mapping | Target files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| CMD-001 | delivery-evidence | NEG-002 MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k strict_render_precedes_promotion | Exit code 0. | Strict render precedes promotion. | ACC-001 E2E-001 TRACE-001 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py |',
    '| CMD-002 | delivery-evidence | NEG-001 MUST-NFR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k failed_strict_render_preserves_source_hash | Exit code 0. | Failed strict render leaves source and promotion state unchanged. | ACC-002 E2E-002 TRACE-002 | PATH-001 owns rollback. | tests/trader/test_gateway_profile_registry.py |',
    '| E2E-001 | e2e | NEG-002 MUST-FR-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k strict_render_precedes_promotion | Exit code 0. | The staging render succeeds before promotion begins. | ACC-001 CMD-001 TRACE-001 | PATH-001 owns remediation. | tests/trader/test_gateway_profile_registry.py |',
    '| E2E-002 | e2e | MUST-NFR-001 NEG-001 | python -m pytest tests/trader/test_gateway_profile_registry.py -k failed_strict_render_preserves_source_hash | Exit code 0. | A failed strict render preserves the source hash and promotion state. | ACC-002 CMD-002 TRACE-002 | PATH-001 owns rollback. | tests/trader/test_gateway_profile_registry.py |',
    '',
    '## Trace Matrix Source',
    '',
    '| ID | Covers | Evidence refs | Acceptance refs | Contract validation command refs | Delivery evidence command refs | View refs | Artifact refs | Boundary refs | Per-MUST oracle | Per-MUST closure assertion | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| TRACE-001 | NEG-002 MUST-FR-001 | ACC-001 | ACC-001 E2E-001 | CMD-001 | CMD-001 | none | PATH-001 | none | Successful strict render precedes promotion. | NEG-002 and MUST-FR-001 close through ACC-001 and TRACE-001. | PATH-001 owns remediation. |',
    '| TRACE-002 | NEG-001 MUST-NFR-001 | ACC-002 | ACC-002 E2E-002 | CMD-002 | CMD-002 | none | PATH-001 | none | Failed strict render produces no source mutation or promotion receipt. | NEG-001 and MUST-NFR-001 close through ACC-002 and TRACE-002. | PATH-001 owns rollback. |',
    '',
    '## Implementation Path Map',
    '',
    '| ID | Repository path | Ownership | Required change | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| PATH-001 | `tests/trader/test_gateway_profile_registry.py` | Promotion owner | Require a successful strict staging render before atomic promotion. | MUST-FR-001 MUST-NFR-001 NEG-001 | ACC-001 and ACC-002 prove success and source preservation independently. | ACC-001 ACC-002 CMD-001 CMD-002 TRACE-001 TRACE-002 | Promotion owner owns implementation and rollback. |',
    '',
    '## Source Current State',
    '',
    '| ID | Current behavior | Current path | Limitation | Evidence |',
    '| --- | --- | --- | --- | --- |',
    '| CUR-001 | Promotion can evaluate a staging draft. | `tests/trader/test_gateway_profile_registry.py` | The strict-render result must remain authoritative. | ACC-001 |',
    '',
    '## Source Target State',
    '',
    '| ID | Target behavior | Target path | Acceptance state | Evidence |',
    '| --- | --- | --- | --- | --- |',
    '| TGT-001 | Promotion follows a successful strict render and fails closed otherwise. | `tests/trader/test_gateway_profile_registry.py` | ACC-001 and ACC-002 pass. | ACC-001 ACC-002 |',
    '',
    '## Current Target Map',
    '',
    '| ID | Current refs | Target refs | Transition | Invariant | Requirement refs | Per-MUST oracle | Assertion source | Responsibility mapping |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '| CTM-001 | CUR-001 | TGT-001 | Gate publication on strict render. | Failed rendering never mutates the source. | FR-001 NFR-001 | ACC-001 and ACC-002 remain authoritative. | ACC-001 ACC-002 | PATH-001 owns remediation. |',
    '',
    '## Human-Readable ID-Bound Views',
    '',
    'Happy-path sequence view; Failure-path sequence view; State and flow view; Edge-case view; Business and governance boundary view; Artifact automation plan; Current-vs-target map; aiTddContractExecutionManifestProjection.',
    '',
    '## Out Of Scope',
    '',
    '| ID | Excluded capability | Preservation rule | Evidence |',
    '| --- | --- | --- | --- |',
    '| OUT-001 | Direct renderer source mutation. | The renderer never mutates the target source directly. | ACC-002 |',
  ].join('\n');
}

describe('requirements contract authoring prepromotion render', () => {
  it('strict_render_precedes_promotion', () => {
    const root = createTempRoot('bmad-prepromotion-render-');
    try {
      const intakeSource = writeText(root, 'source.md', prepromotionSource());
      const targetSource = path.join(root, 'generated.md');
      const recordId = 'REQ-TEST-PREPROMOTION-RENDER';

      const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      expect(result.blockingIssues, JSON.stringify(result.blockingIssues, null, 2)).toEqual([]);

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
  }, 60_000);

  it('failed_strict_render_preserves_source_hash', () => {
    const root = createTempRoot('bmad-prepromotion-fail-');
    try {
      const targetSource = writeText(root, 'existing.md', prepromotionSource());
      const intakeSource = writeText(root, 'source.md', prepromotionSource());
      const beforeHash = sha256File(targetSource);
      const recordId = 'REQ-TEST-PREPROMOTION-FAIL';

      const result = runIntakeAuthoring(root, intakeSource, targetSource, recordId, {
        targetPath: 'tests/trader/test_gateway_profile_registry.py',
        confirmationLanguage: 'en-US',
        criticalAuditorRound: cleanCriticalAuditorRound,
        forceStrictRenderFailureForTest: true,
      });

      const paths = artifacts(root, recordId, `${recordId}-SET`);
      const decisionPath = sourcePromotionDecisionPath(root, recordId);

      expect(
        result.blockingIssues.map((issue) => issue.code),
        JSON.stringify(result.blockingIssues, null, 2)
      ).toContain(
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
  }, 60_000);
});
