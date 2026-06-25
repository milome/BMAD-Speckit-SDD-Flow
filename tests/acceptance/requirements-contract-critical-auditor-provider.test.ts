import { existsSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  artifacts,
  buildValidResponseFromRequest,
  createTempRoot,
  expectSourceHashUnchanged,
  issueCodes,
  readJson,
  removeTempRoot,
  roundArtifact,
  runAuthoring,
  sha256File,
  sourcePromotionDecisionPath,
  stagingMustDecompositionPacket,
  writeConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

function createRequestForResponseFile(root: string, recordId: string) {
  const source = writeConsumerRequirement(root);
  const beforeHash = sha256File(source);
  const first = runAuthoring(root, source, recordId, {
    targetPath: 'vnpy/chart/multi_timeframe_widget.py',
    requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
  });
  const requestPath = roundArtifact(root, recordId, 'request', 1);
  return {
    source,
    beforeHash,
    first,
    requestPath,
    request: readJson<Record<string, unknown>>(requestPath),
    packet: stagingMustDecompositionPacket(root, recordId),
  };
}

describe('requirements contract Critical Auditor provider modes', () => {
  it('response_file accepts one valid response and writes receipt through the orchestrator only', () => {
    const root = createTempRoot('requirements-contract-response-file-');
    try {
      const recordId = 'REQ-RESPONSE-FILE';
      const fixture = createRequestForResponseFile(root, recordId);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      writeFileSync(
        responsePath,
        `${JSON.stringify(buildValidResponseFromRequest(fixture.request, fixture.packet), null, 2)}\n`,
        'utf8'
      );

      const result = runAuthoring(root, fixture.source, recordId, {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseFile: responsePath,
        maxCriticalAuditorRounds: 1,
      });
      const receiptPath = roundArtifact(root, recordId, 'receipt', 1);
      const receipt = readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(receiptPath)
        .criticalAuditorReceipt;

      expect(issueCodes(result)).toContain('critical_auditor_no_new_gap_convergence_not_reached');
      expect(existsSync(receiptPath)).toBe(true);
      expect(receipt.requestHash).toBe(fixture.request.requestHash);
      expect(receipt.transactionId).toBe(fixture.request.transactionId);
      expect(receipt.namespaceVersion).toBe(fixture.request.namespaceVersion);
      expect(receipt.roundIndex).toBe(1);
      expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
      expect(existsSync(artifacts(root, recordId, `${recordId}-SET`).sourceMaterializationReceipt)).toBe(
        false
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('response_file rejects mismatched hashes and never writes a receipt', () => {
    const root = createTempRoot('requirements-contract-response-file-mismatch-');
    try {
      const recordId = 'REQ-RESPONSE-FILE-MISMATCH';
      const fixture = createRequestForResponseFile(root, recordId);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      writeFileSync(
        responsePath,
        `${JSON.stringify(
          {
            ...buildValidResponseFromRequest(fixture.request, fixture.packet),
            requestHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const result = runAuthoring(root, fixture.source, recordId, {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseFile: responsePath,
      });

      expect(issueCodes(result)).toContain('critical_auditor_response_request_hash_mismatch');
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(false);
      expect(readJson<Record<string, unknown>>(sourcePromotionDecisionPath(root, recordId)).finalDecision).toBe(
        'block_source_promotion'
      );
      expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('external_adapter requires an explicit adapter command before writing staging artifacts', () => {
    const root = createTempRoot('requirements-contract-external-adapter-');
    try {
      const source = writeConsumerRequirement(root);
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, 'REQ-EXTERNAL-ADAPTER', {
        criticalAuditorProviderMode: 'external_adapter',
      });

      expect(issueCodes(result)).toContain('critical_auditor_external_adapter_missing');
      expect(result.blockingStage).toBe('critical_auditor_external_adapter_missing');
      expect(result.sourceMutationPerformed).toBe(false);
      expectSourceHashUnchanged(source, beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });
});
