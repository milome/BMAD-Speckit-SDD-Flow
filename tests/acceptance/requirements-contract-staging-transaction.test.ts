import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  cleanCriticalAuditorRound,
  createMinimalConsumerRequirementDescriptor,
  createTempRoot,
  expectSourceHashUnchanged,
  installJudgeRuntimeConfig,
  issueCodes,
  readImplementationConfirmation,
  readJson,
  removeTempRoot,
  roundArtifact,
  runAuthoring,
  sha256File,
  sourcePromotionDecisionPath,
  stagingTransactionDir,
  writeTestLocalizationResponse,
  writeConsumerRequirement,
  writeMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract staging transaction', () => {
  it('creates a complete staging transaction and blocks source promotion when provider is missing', () => {
    const root = createTempRoot('requirements-contract-staging-provider-missing-');
    try {
      const source = writeConsumerRequirement(root);
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-STAGING-MISSING', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      const stagingDir = stagingTransactionDir(root, 'REQ-STAGING-MISSING');
      const decision = readJson<Record<string, unknown>>(
        sourcePromotionDecisionPath(root, 'REQ-STAGING-MISSING')
      );

      expect(issueCodes(result)).toContain('critical_auditor_provider_mode_required');
      expect(existsSync(`${stagingDir}/draft-source.md`)).toBe(true);
      expect(existsSync(`${stagingDir}/semantic-kernel.json`)).toBe(true);
      expect(existsSync(`${stagingDir}/must_decomposition_packet.json`)).toBe(true);
      expect(existsSync(`${stagingDir}/critical-auditor-round-request-1.json`)).toBe(true);
      expect(existsSync(`${stagingDir}/source-promotion-decision.json`)).toBe(true);
      expect(decision.finalDecision).toBe('block_source_promotion');
      expect(decision.sourceMutationPerformed).toBe(false);
      expectSourceHashUnchanged(source, beforeHash);
      expect(
        existsSync(
          artifacts(root, 'REQ-STAGING-MISSING', 'REQ-STAGING-MISSING-SET')
            .sourceMaterializationReceipt
        )
      ).toBe(false);
    } finally {
      removeTempRoot(root);
    }
  });

  it('refreshes existing staging draft when non-semantic confirmation inputs change', () => {
    const root = createTempRoot('requirements-contract-staging-refresh-');
    try {
      const source = writeConsumerRequirement(root);

      const initial = runAuthoring(root, source, 'REQ-STAGING-REFRESH', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      const stagingDir = stagingTransactionDir(root, 'REQ-STAGING-REFRESH');
      const initialDraft = readFileSync(path.join(stagingDir, 'draft-source.md'), 'utf8');
      expect(issueCodes(initial)).toContain('critical_auditor_provider_mode_required');
      expect(initialDraft).toContain('confirmationLanguage: not_selected');
      const initialImplementationConfirmationHash = initial.implementationConfirmationHash;
      const staleReceipt = JSON.stringify(
        {
          schemaVersion: 'critical-auditor-receipt/v1',
          roundIndex: 1,
          inputHash: 'sha256:stale',
          sourceDocumentHash: 'sha256:stale',
          implementationConfirmationHash: 'sha256:stale',
          contentHash: 'sha256:stale',
          gateDryRunHash: 'sha256:stale',
        },
        null,
        2
      );
      writeFileSync(
        path.join(stagingDir, 'critical-auditor-receipt-round-1.json'),
        staleReceipt,
        'utf8'
      );
      writeFileSync(
        path.join(
          artifacts(root, 'REQ-STAGING-REFRESH', 'REQ-STAGING-REFRESH-SET').authoring,
          'critical-auditor-receipt-round-1.json'
        ),
        staleReceipt,
        'utf8'
      );

      const localizationBlocked = runAuthoring(root, source, 'REQ-STAGING-REFRESH', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        confirmationLanguage: 'zh-CN',
      });
      expect(localizationBlocked.substate).toBe('localization_translation_required');
      const refreshed = runAuthoring(root, source, 'REQ-STAGING-REFRESH', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        confirmationLanguage: 'zh-CN',
        localizationResponseFile: writeTestLocalizationResponse(
          root,
          'REQ-STAGING-REFRESH',
          'staging-refresh-localization-response.test.json'
        ),
      });
      const refreshedDraft = readFileSync(path.join(stagingDir, 'draft-source.md'), 'utf8');
      const refreshedRequest = readJson<Record<string, unknown>>(
        path.join(stagingDir, 'critical-auditor-round-request-1.json')
      );
      const refreshedKernel = readJson<{ semanticKernel?: Record<string, unknown> }>(
        path.join(stagingDir, 'semantic-kernel.json')
      );
      const refreshedPacket = readJson<{ must_decomposition_packet?: Record<string, unknown> }>(
        path.join(stagingDir, 'must_decomposition_packet.json')
      );

      expect(issueCodes(refreshed)).toContain('critical_auditor_provider_mode_required');
      expect(refreshed.implementationConfirmationHash).not.toBe(
        initialImplementationConfirmationHash
      );
      expect(refreshedDraft).toContain('confirmationLanguage: zh-CN');
      expect(refreshedDraft).not.toContain('confirmationLanguage: not_selected');
      expect(refreshedKernel.semanticKernel?.implementationConfirmationHash).toBe(
        refreshed.implementationConfirmationHash
      );
      expect(refreshedPacket.must_decomposition_packet?.implementationConfirmationHash).toBe(
        refreshed.implementationConfirmationHash
      );
      expect(refreshedRequest.implementationConfirmationHash).toBe(
        refreshed.implementationConfirmationHash
      );
      expect(
        ((refreshedRequest.gateDryRun as any)?.actionableBlockingIssues ?? []).map(
          (issue: any) => issue.code
        )
      ).not.toContain('critical_auditor_receipt_input_hash_stale');
      expect(existsSync(path.join(stagingDir, 'critical-auditor-receipt-round-1.json'))).toBe(
        false
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('promotes source and writes promotion receipt only after three validated no-gap rounds', () => {
    const root = createTempRoot('requirements-contract-staging-promote-');
    try {
      installJudgeRuntimeConfig(root);
      const { sourcePath: source, authoringOptions } = writeMinimalConsumerRequirement(
        root,
        'docs/requirements/minimal-consumer.md',
        createMinimalConsumerRequirementDescriptor('REQ-STAGING-PROMOTE')
      );
      const { confirmationLanguage: _confirmationLanguage, ...promotionAuthoringOptions } =
        authoringOptions;

      const result = runAuthoring(root, source, 'REQ-STAGING-PROMOTE', {
        ...promotionAuthoringOptions,
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      const paths = artifacts(root, 'REQ-STAGING-PROMOTE', 'REQ-STAGING-PROMOTE-SET');
      const decision = readJson<Record<string, unknown>>(
        sourcePromotionDecisionPath(root, 'REQ-STAGING-PROMOTE')
      );
      const promotionState = {
        issueCodes: issueCodes(result),
        blockingStage: result.blockingStage,
        promotionReceiptExists: existsSync(paths.promotionReceipt),
        blockingIssues: result.blockingIssues,
      };
      if (!promotionState.promotionReceiptExists) {
        throw new Error(JSON.stringify(promotionState, null, 2));
      }
      const route = readJson<Record<string, unknown>>(paths.scaleRoutingDecision);
      const checkpointEvidence = readJson<Record<string, unknown>>(
        paths.checkpointPersistenceEvidence
      );
      const promotionReceipt = readJson<Record<string, unknown>>(paths.promotionReceipt);
      const confirmation = readImplementationConfirmation(source);

      expect(result.ok).toBe(false);
      expect(result.blockingStage).toBeNull();
      expect(issueCodes(result)).toContain('language_required_before_render');
      expect(issueCodes(result)).not.toContain('checkpoint_required_before_source_materialization');
      expect(route.decision).toBe('single_pass_final_allowed');
      expect(route.checkpointPersistenceSatisfied).toBe(true);
      expect(checkpointEvidence.checkpointPersistenceSatisfiedCandidate).toBe(true);
      expect(decision.finalDecision).toBe('allow_source_promotion');
      expect(existsSync(paths.sourceMaterializationReceipt)).toBe(false);
      expect(promotionReceipt).toMatchObject({
        ok: true,
        promotionStage: 'authoring-draft',
        safePromotionAsDraft: true,
      });
      expect(String(promotionReceipt.receiptPath).replace(/\\/g, '/')).toMatch(
        /_bmad-output\/runtime\/requirement-records\/REQ-STAGING-PROMOTE\/authoring\/promotion-receipt\.json$/u
      );
      expect(promotionReceipt.targetHash).toBe(sha256File(source));
      expect(result.receiptPath).toBe(
        path.relative(root, paths.promotionReceipt).replace(/\\/g, '/')
      );
      expect(result.receiptHash).toBe(sha256File(paths.promotionReceipt));
      expect(confirmation.preConfirmationDrilldown).toMatchObject({
        criticalAuditor: {
          consecutiveNoNewGapRounds: 3,
          convergenceVerdict: 'bounded_no_new_gap',
        },
      });
      expect(existsSync(roundArtifact(root, 'REQ-STAGING-PROMOTE', 'receipt', 3))).toBe(true);
    } finally {
      removeTempRoot(root);
    }
  });

  it('stops promotion without overwrite when source hash changes after transaction start', () => {
    const root = createTempRoot('requirements-contract-staging-source-race-');
    try {
      installJudgeRuntimeConfig(root);
      const source = writeConsumerRequirement(root);
      const beforeHash = sha256File(source);
      let changed = false;

      const result = runAuthoring(root, source, 'REQ-STAGING-SOURCE-RACE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: (input) => {
          if (!changed) {
            writeFileSync(
              source,
              `${readFileSync(source, 'utf8')}\n<!-- concurrent user edit -->\n`,
              'utf8'
            );
            changed = true;
          }
          return cleanCriticalAuditorRound(input);
        },
      });
      const afterHash = sha256File(source);
      const decision = readJson<Record<string, unknown>>(
        sourcePromotionDecisionPath(root, 'REQ-STAGING-SOURCE-RACE')
      );

      expect(issueCodes(result)).toContain('source_hash_changed_before_promotion');
      expect(decision.finalDecision).toBe('block_source_promotion');
      expect(decision.blockingStage).toBe('source_hash_changed_before_promotion');
      expect(decision.sourceMutationPerformed).toBe(false);
      expect(afterHash).not.toBe(beforeHash);
      expect(readFileSync(source, 'utf8')).toContain('concurrent user edit');
      expect(
        existsSync(
          artifacts(root, 'REQ-STAGING-SOURCE-RACE', 'REQ-STAGING-SOURCE-RACE-SET')
            .sourceMaterializationReceipt
        )
      ).toBe(false);
    } finally {
      removeTempRoot(root);
    }
  });
});
