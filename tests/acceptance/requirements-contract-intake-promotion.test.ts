import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createTempRoot,
  issueCodes,
  readImplementationConfirmation,
  readJson,
  removeTempRoot,
  runIntakeAuthoring,
  sha256File,
  writeMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract intake promotion', () => {
  it('creates target only after auditor convergence and authoring-draft promotion', () => {
    const root = createTempRoot('requirements-contract-intake-promotion-');
    try {
      const intake = writeMinimalConsumerRequirement(
        root,
        '_bmad-output/runtime/requirement-records/REQ-INTAKE-PROMOTE/authoring/intake/intake-source.md'
      );
      const target = path.join(root, 'docs/plans/new-intake-promoted.md');

      const promoted = runIntakeAuthoring(root, intake, target, 'REQ-INTAKE-PROMOTE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-INTAKE-PROMOTE', 'REQ-INTAKE-PROMOTE-SET');
      const receipt = readJson<Record<string, unknown>>(paths.promotionReceipt);
      const ledger = readJson<Record<string, unknown>>(paths.authoringTransaction);

      expect(existsSync(target)).toBe(true);
      expect(receipt).toMatchObject({
        ok: true,
        promotionStage: 'authoring-draft',
        targetPath: 'docs/plans/new-intake-promoted.md',
      });
      expect(receipt.targetHash).toBe(sha256File(target));
      expect(promoted.receiptHash).toBe(sha256File(paths.promotionReceipt));
      expect(readImplementationConfirmation(target).preConfirmationDrilldown).toBeTruthy();
      expect(ledger.entryMode).toBe('intake_to_new_source');
      expect(ledger.substate).toBe('promoted_not_confirmation_ready');
    } finally {
      removeTempRoot(root);
    }
  });

  it('stops when intake target is created before promotion', () => {
    const root = createTempRoot('requirements-contract-intake-race-');
    try {
      const intake = writeMinimalConsumerRequirement(
        root,
        '_bmad-output/runtime/requirement-records/REQ-INTAKE-RACE/authoring/intake/intake-source.md'
      );
      const target = path.join(root, 'docs/plans/new-intake-race.md');
      let created = false;

      const result = runIntakeAuthoring(root, intake, target, 'REQ-INTAKE-RACE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: (input) => {
          if (!created) {
            mkdirSync(path.dirname(target), { recursive: true });
            writeFileSync(target, '# Concurrent target\n', 'utf8');
            created = true;
          }
          return cleanCriticalAuditorRound(input);
        },
      });
      const paths = artifacts(root, 'REQ-INTAKE-RACE', 'REQ-INTAKE-RACE-SET');

      expect(issueCodes(result)).toContain('target_created_before_promotion');
      expect(result.blockingStage).toBe('target_created_before_promotion');
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(existsSync(target)).toBe(true);
    } finally {
      removeTempRoot(root);
    }
  });
});
