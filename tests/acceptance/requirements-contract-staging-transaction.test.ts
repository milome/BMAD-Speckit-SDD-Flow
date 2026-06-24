import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
  roundArtifact,
  runAuthoring,
  sha256File,
  sourcePromotionDecisionPath,
  stagingTransactionDir,
  writeConsumerRequirement,
  writeCheckpointPersistenceEvidence,
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
      expect(existsSync(artifacts(root, 'REQ-STAGING-MISSING', 'REQ-STAGING-MISSING-SET').sourceMaterializationReceipt)).toBe(
        false
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('promotes source and writes source-materialization receipt only after three validated no-gap rounds', () => {
    const root = createTempRoot('requirements-contract-staging-promote-');
    try {
      const source = writeMinimalConsumerRequirement(root);

      const result = runAuthoring(root, source, 'REQ-STAGING-PROMOTE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });
      expect(issueCodes(result)).toContain('checkpoint_required_before_source_materialization');
      const evidencePath = writeCheckpointPersistenceEvidence(root, 'REQ-STAGING-PROMOTE');

      const promoted = runAuthoring(root, source, 'REQ-STAGING-PROMOTE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
        checkpointPersistenceEvidencePath: evidencePath,
      });
      const paths = artifacts(root, 'REQ-STAGING-PROMOTE', 'REQ-STAGING-PROMOTE-SET');
      const decision = readJson<Record<string, unknown>>(
        sourcePromotionDecisionPath(root, 'REQ-STAGING-PROMOTE')
      );
      const receipt = readJson<Record<string, unknown>>(paths.sourceMaterializationReceipt);
      const confirmation = readImplementationConfirmation(source);

      expect(promoted.ok).toBe(false);
      expect(promoted.blockingStage).toBeNull();
      expect(decision.finalDecision).toBe('allow_source_promotion');
      expect(existsSync(paths.sourceMaterializationReceipt)).toBe(true);
      expect(receipt.transactionId).toBe(decision.transactionId);
      expect(receipt.sourceStartHash).toBe(decision.sourceStartHash);
      expect(receipt.sourceDocumentHashPrePromote).toBe(decision.currentSourceHash);
      expect(Array.isArray(receipt.criticalAuditorReceiptHashes)).toBe(true);
      expect((receipt.criticalAuditorReceiptHashes as unknown[]).length).toBe(3);
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
      const source = writeConsumerRequirement(root);
      const beforeHash = sha256File(source);
      let changed = false;

      const result = runAuthoring(root, source, 'REQ-STAGING-SOURCE-RACE', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: (input) => {
          if (!changed) {
            writeFileSync(source, `${readFileSync(source, 'utf8')}\n<!-- concurrent user edit -->\n`, 'utf8');
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
      expect(existsSync(artifacts(root, 'REQ-STAGING-SOURCE-RACE', 'REQ-STAGING-SOURCE-RACE-SET').sourceMaterializationReceipt)).toBe(
        false
      );
    } finally {
      removeTempRoot(root);
    }
  });
});
