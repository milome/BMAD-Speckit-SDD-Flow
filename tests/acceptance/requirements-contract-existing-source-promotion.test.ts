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
});
