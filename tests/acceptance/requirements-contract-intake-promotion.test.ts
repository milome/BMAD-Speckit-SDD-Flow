import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  installJudgeRuntimeConfig,
  readJson,
  removeTempRoot,
  runIntakeAuthoring,
  sha256File,
  writeLintReadyMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';
import {
  evaluateIntakeTargetPromotionRace,
  rollbackPromotedSourceAfterReadbackFailure,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';

describe('requirements contract intake promotion', () => {
  it('keeps intake target absent until a real Critical Auditor provider converges', () => {
    const root = createTempRoot('requirements-contract-intake-promotion-');
    installJudgeRuntimeConfig(root);
    try {
      const { sourcePath: intake, authoringOptions } = writeLintReadyMinimalConsumerRequirement(
        root,
        '_bmad-output/runtime/requirement-records/REQ-INTAKE-PROMOTE/authoring/intake/intake-source.md',
        createMinimalConsumerRequirementDescriptor('REQ-INTAKE-PROMOTE')
      );
      const target = path.join(root, 'docs/plans/new-intake-promoted.md');

      const promoted = runIntakeAuthoring(root, intake, target, 'REQ-INTAKE-PROMOTE', {
        ...authoringOptions,
      });
      const paths = artifacts(root, 'REQ-INTAKE-PROMOTE', 'REQ-INTAKE-PROMOTE-SET');
      expect(promoted.criticalAuditorProviderMode).toBe('main_session_inline');
      expect(promoted.blockingStage).toBe('critical_auditor_provider_mode_required');
      expect(promoted.nextRequiredAction).toBe('run_main_session_critical_auditor_round');
      expect(promoted.criticalAuditorContinuation).toMatchObject({
        providerMode: 'main_session_inline',
        roundIndex: 1,
        nextRequiredAction: 'run_main_session_critical_auditor_round',
      });
      expect(existsSync(target)).toBe(false);
      expect(existsSync(paths.promotionReceipt)).toBe(false);
    } finally {
      removeTempRoot(root);
    }
  });

  it('stops when an intake target appears after the authoring transaction starts', () => {
    expect(
      evaluateIntakeTargetPromotionRace({
        entryMode: 'intake_to_new_source',
        targetSourceExistedBeforeAuthoring: false,
        targetExistsBeforePromotion: true,
      })
    ).toEqual({
      code: 'target_created_before_promotion',
      blockingStage: 'target_created_before_promotion',
      nextRequiredAction: 'stop_target_created_before_promotion',
    });
    expect(
      evaluateIntakeTargetPromotionRace({
        entryMode: 'intake_to_new_source',
        targetSourceExistedBeforeAuthoring: true,
        targetExistsBeforePromotion: true,
      })
    ).toBeNull();
    expect(
      evaluateIntakeTargetPromotionRace({
        entryMode: 'existing_source',
        targetSourceExistedBeforeAuthoring: false,
        targetExistsBeforePromotion: true,
      })
    ).toBeNull();
  });

  it('rolls back a newly created target after promotion readback failure', () => {
    const root = createTempRoot('requirements-contract-intake-readback-drift-');
    try {
      const target = path.join(root, 'docs/plans/new-intake-readback-drift.md');
      const paths = artifacts(
        root,
        'REQ-INTAKE-READBACK-DRIFT',
        'REQ-INTAKE-READBACK-DRIFT-SET'
      );
      const rollbackReceiptPath = path.join(
        paths.authoring,
        'proofs',
        'promotion-readback-rollback-receipt.json'
      );
      mkdirSync(path.dirname(target), { recursive: true });
      mkdirSync(path.dirname(paths.promotionReceipt), { recursive: true });
      writeFileSync(target, '# Semantically drifted promoted target\n', 'utf8');
      const promotionReceipt = { ok: true, targetHash: sha256File(target) };
      writeFileSync(paths.promotionReceipt, `${JSON.stringify(promotionReceipt)}\n`, 'utf8');

      const rollback = rollbackPromotedSourceAfterReadbackFailure({
        root,
        sourcePath: target,
        sourceExistedBeforePromotion: false,
        expectedOriginalHash: 'absent',
        promotionReceipt,
        paths: {
          promotionReceipt: paths.promotionReceipt,
          promotionReadbackRoundTripReport: paths.promotionReadbackRoundTripReport,
          promotionReadbackRollbackReceipt: rollbackReceiptPath,
        },
        reasonCode: 'promotion_readback_semantic_conservation_failed',
        createdAt: '2026-08-04T00:00:00.000Z',
      });

      expect(rollback.ok).toBe(true);
      expect(existsSync(target)).toBe(false);
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(readJson<Record<string, unknown>>(rollbackReceiptPath)).toMatchObject({
        schemaVersion: 'requirements-contract-promotion-readback-rollback-receipt/v1',
        reasonCode: 'promotion_readback_semantic_conservation_failed',
        decision: 'rolled_back',
        promotionReadbackReportHash: null,
        targetExistedBeforePromotion: false,
        targetExistsAfterRollback: false,
        successPromotionReceiptRetained: false,
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('restores an existing target after promotion readback failure', () => {
    const root = createTempRoot('requirements-contract-existing-readback-drift-');
    try {
      const target = path.join(root, 'docs/plans/existing-readback-target.md');
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, '# Existing target\n\nPreserve these exact bytes.\n', 'utf8');
      const originalHash = sha256File(target);
      const backupPath = path.join(path.dirname(target), `${path.basename(target)}.backup-test`);
      writeFileSync(backupPath, '# Existing target\n\nPreserve these exact bytes.\n', 'utf8');
      writeFileSync(target, '# Semantically drifted promoted target\n', 'utf8');
      const paths = artifacts(
        root,
        'REQ-EXISTING-READBACK-DRIFT',
        'REQ-EXISTING-READBACK-DRIFT-SET'
      );
      const rollbackReceiptPath = path.join(
        paths.authoring,
        'proofs',
        'promotion-readback-rollback-receipt.json'
      );
      mkdirSync(path.dirname(paths.promotionReceipt), { recursive: true });
      const promotionReceipt = {
        ok: true,
        targetHash: sha256File(target),
        backupPath,
      };
      writeFileSync(paths.promotionReceipt, `${JSON.stringify(promotionReceipt)}\n`, 'utf8');

      const rollback = rollbackPromotedSourceAfterReadbackFailure({
        root,
        sourcePath: target,
        sourceExistedBeforePromotion: true,
        expectedOriginalHash: originalHash,
        promotionReceipt,
        paths: {
          promotionReceipt: paths.promotionReceipt,
          promotionReadbackRoundTripReport: paths.promotionReadbackRoundTripReport,
          promotionReadbackRollbackReceipt: rollbackReceiptPath,
        },
        reasonCode: 'promotion_readback_semantic_conservation_failed',
        createdAt: '2026-08-04T00:00:00.000Z',
      });
      const rollbackReceipt = readJson<Record<string, unknown>>(rollbackReceiptPath);

      expect(rollback.ok).toBe(true);
      expect(existsSync(target)).toBe(true);
      expect(sha256File(target)).toBe(originalHash);
      expect(existsSync(paths.promotionReceipt)).toBe(false);
      expect(rollbackReceipt).toMatchObject({
        reasonCode: 'promotion_readback_semantic_conservation_failed',
        decision: 'rolled_back',
        targetExistedBeforePromotion: true,
        expectedOriginalHash: originalHash,
        targetExistsAfterRollback: true,
        targetHashAfterRollback: originalHash,
        successPromotionReceiptRetained: false,
      });
    } finally {
      removeTempRoot(root);
    }
  });
});
