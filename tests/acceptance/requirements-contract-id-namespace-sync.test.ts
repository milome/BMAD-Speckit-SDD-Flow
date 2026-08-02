import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildValidResponseFromRequest,
  cleanCriticalAuditorRound,
  createTempRoot,
  installJudgeRuntimeConfig,
  issueCodes,
  readJson,
  removeTempRoot,
  roundArtifact,
  runAuthoring,
  sourcePromotionDecisionPath,
  stagingMustDecompositionPacket,
  stagingTransactionDir,
  writeConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

describe('requirements contract ID namespace synchronization', () => {
  it('binds request, packet, response, and receipt refs to one namespace version', () => {
    const root = createTempRoot('requirements-contract-namespace-sync-');
    try {
      installJudgeRuntimeConfig(root);
      const source = writeConsumerRequirement(root);

      runAuthoring(root, source, 'REQ-NAMESPACE-SYNC', {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorRound: cleanCriticalAuditorRound,
      });

      const request = readJson<Record<string, unknown>>(roundArtifact(root, 'REQ-NAMESPACE-SYNC', 'request', 1));
      const packet = readJson<{ must_decomposition_packet: Record<string, unknown> }>(
        path.join(stagingTransactionDir(root, 'REQ-NAMESPACE-SYNC'), 'must_decomposition_packet.json')
      ).must_decomposition_packet;
      const receipt = readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(
        roundArtifact(root, 'REQ-NAMESPACE-SYNC', 'receipt', 1)
      ).criticalAuditorReceipt;
      const decision = readJson<Record<string, unknown>>(
        sourcePromotionDecisionPath(root, 'REQ-NAMESPACE-SYNC')
      );

      expect(request.namespaceVersion).toBeDefined();
      expect(packet.namespaceVersion).toBe(request.namespaceVersion);
      expect(receipt.namespaceVersion).toBe(request.namespaceVersion);
      expect(decision.namespaceVersion).toBe(request.namespaceVersion);
      expect(request.transactionId).toBe(receipt.transactionId);
      expect(decision.transactionId).toBe(receipt.transactionId);
    } finally {
      removeTempRoot(root);
    }
  });

  it('archives stale namespace artifacts and restarts at round one when response namespace drifts', () => {
    const root = createTempRoot('requirements-contract-namespace-stale-');
    try {
      installJudgeRuntimeConfig(root);
      const recordId = 'REQ-NAMESPACE-STALE';
      const source = writeConsumerRequirement(root);
      runAuthoring(root, source, recordId, {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      const request = readJson<Record<string, unknown>>(roundArtifact(root, recordId, 'request', 1));
      const packet = stagingMustDecompositionPacket(root, recordId);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      writeFileSync(
        responsePath,
        `${JSON.stringify(
          {
            ...buildValidResponseFromRequest(request, packet),
            namespaceVersion: 'critical-auditor-namespace/stale',
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const result = runAuthoring(root, source, recordId, {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseFile: responsePath,
      });
      const archiveRoot = path.join(
        root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        recordId,
        'authoring',
        'archive'
      );
      const archiveEntries = existsSync(archiveRoot)
        ? readdirSync(archiveRoot).filter((entry) => entry.endsWith('-stale-namespace'))
        : [];

      expect(issueCodes(result)).toContain('id_namespace_mismatch');
      expect(archiveEntries.length).toBeGreaterThanOrEqual(1);
      expect(existsSync(roundArtifact(root, recordId, 'request', 1))).toBe(true);
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(false);
    } finally {
      removeTempRoot(root);
    }
  });
});
