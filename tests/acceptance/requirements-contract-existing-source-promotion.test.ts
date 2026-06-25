import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  expectSourceHashUnchanged,
  issueCodes,
  readImplementationConfirmation,
  readJson,
  removeTempRoot,
  runAuthoring,
  sha256File,
  writeMinimalConsumerRequirement,
  writeText,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract existing source promotion', () => {
  it('keeps existing source unchanged until auditor convergence and authoring-draft promotion', () => {
    const root = createTempRoot('requirements-contract-existing-source-');
    try {
      const source = writeMinimalConsumerRequirement(root, 'docs/plans/existing-source.md');
      const beforeHash = sha256File(source);

      const blocked = runAuthoring(root, source, 'REQ-EXISTING-SOURCE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      const paths = artifacts(root, 'REQ-EXISTING-SOURCE', 'REQ-EXISTING-SOURCE-SET');

      expect(issueCodes(blocked)).toContain('critical_auditor_provider_mode_required');
      expect(existsSync(paths.draftSourcePreview)).toBe(true);
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expectSourceHashUnchanged(source, beforeHash);
      expect(readJson<Record<string, unknown>>(paths.authoringTransaction).substate).toBe(
        'critical_auditor_round_required'
      );

      const promoted = runAuthoring(root, source, 'REQ-EXISTING-SOURCE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const receipt = readJson<Record<string, unknown>>(paths.promotionReceipt);
      const ledger = readJson<Record<string, unknown>>(paths.authoringTransaction);

      expect(existsSync(paths.promotionReceipt)).toBe(true);
      expect(receipt.promotionStage).toBe('authoring-draft');
      expect(receipt.targetHash).toBe(sha256File(source));
      expect(promoted.receiptHash).toBe(sha256File(paths.promotionReceipt));
      expect(readImplementationConfirmation(source).preConfirmationDrilldown).toBeTruthy();
      expect(ledger).toMatchObject({
        schemaVersion: 'requirements-authoring-transaction/v1',
        lane: 'author-confirmation-ready-source',
        entryMode: 'existing_source',
        substate: 'promoted_not_confirmation_ready',
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('promotes an existing source that already has a stale implementationConfirmation block', () => {
    const root = createTempRoot('requirements-contract-existing-source-stale-block-');
    try {
      const source = writeText(
        root,
        'docs/plans/existing-source-with-stale-block.md',
        [
          '# Existing Source With Stale Contract',
          '',
          '目标文件：`vnpy/chart/multi_timeframe_widget.py`',
          '',
          '## 验收标准',
          '',
          '- 主图摘要必须展示所有启用周期。',
          '- pytest tests/test_multi_timeframe_settings.py 必须覆盖主图摘要显示。',
          '',
          'implementationConfirmation:',
          '  status: draft',
          '  recordId: REQ-STALE',
          '  requirementSetId: REQ-STALE-SET',
          '  must:',
          '    - id: MUST-STALE-001',
          '      text: 旧契约行应被新 authoring 事务替换。',
          '',
        ].join('\n')
      );
      const beforeRawHash = sha256File(source);

      const promoted = runAuthoring(root, source, 'REQ-EXISTING-SOURCE-STALE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(
        root,
        'REQ-EXISTING-SOURCE-STALE',
        'REQ-EXISTING-SOURCE-STALE-SET'
      );
      const receipt = readJson<Record<string, unknown>>(paths.promotionReceipt);
      const decision = readJson<Record<string, unknown>>(paths.sourceMutationDecision);
      const confirmation = readImplementationConfirmation(source);

      expect(existsSync(paths.promotionReceipt)).toBe(true);
      expect(promoted.receiptHash).toBe(sha256File(paths.promotionReceipt));
      expect(receipt.targetHash).toBe(sha256File(source));
      expect(decision.sourceDocumentHashBefore).toBe(beforeRawHash);
      expect(decision.targetRawHashBefore).toBe(beforeRawHash);
      expect(decision.semanticSourceHashBefore).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(decision.semanticSourceHashBefore).not.toBe(beforeRawHash);
      expect(confirmation.recordId).toBe('REQ-EXISTING-SOURCE-STALE');
    } finally {
      removeTempRoot(root);
    }
  });
});
