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
