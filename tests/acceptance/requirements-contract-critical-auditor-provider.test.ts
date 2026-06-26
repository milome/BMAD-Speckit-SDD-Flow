import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainMainAgentOrchestration } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
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
      const response = buildValidResponseFromRequest(fixture.request, fixture.packet);
      writeFileSync(
        responsePath,
        `${JSON.stringify(
          {
            ...response,
            falsePositiveProofs: [
              {
                blockerCode: 'synthetic_gate_blocker',
                proofType: 'current_source_packet_hash_match',
                evidenceRefs: ['gate-dry-run'],
              },
            ],
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

  it('falsePositiveProofs no_new_valid_gap response survives parsing and binding', () => {
    const root = createTempRoot('requirements-contract-false-positive-proof-');
    try {
      const recordId = 'REQ-FALSE-POSITIVE-PROOF';
      const fixture = createRequestForResponseFile(root, recordId);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      const response = buildValidResponseFromRequest(fixture.request, fixture.packet);
      writeFileSync(
        responsePath,
        `${JSON.stringify(
          {
            ...response,
            falsePositiveProofs: [
              {
                blockerCode: 'synthetic_gate_blocker',
                proofType: 'current_source_packet_hash_match',
                evidenceRefs: ['gate-dry-run'],
              },
            ],
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
        maxCriticalAuditorRounds: 1,
      });
      const receipt = readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(
        roundArtifact(root, recordId, 'receipt', 1)
      ).criticalAuditorReceipt;

      expect(issueCodes(result)).not.toContain(
        'critical_auditor_no_new_gap_forbidden_by_gate_dry_run_blockers'
      );
      expect(receipt.falsePositiveProofs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ blockerCode: expect.any(String) }),
        ])
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('falsePositiveProofs no_new_confirmation_blocking_gap response survives parsing and binding', () => {
    const root = createTempRoot('requirements-contract-confirmation-blocking-proof-');
    try {
      const recordId = 'REQ-CONFIRMATION-BLOCKING-PROOF';
      const fixture = createRequestForResponseFile(root, recordId);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      const response = buildValidResponseFromRequest(fixture.request, fixture.packet);
      writeFileSync(
        responsePath,
        `${JSON.stringify(
          {
            ...response,
            verdict: 'no_new_confirmation_blocking_gap',
            falsePositiveProofs: [
              {
                blockerCode: 'synthetic_gate_blocker',
                proofType: 'current_source_packet_hash_match',
                evidenceRefs: ['gate-dry-run'],
              },
            ],
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
        maxCriticalAuditorRounds: 1,
      });
      const receipt = readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(
        roundArtifact(root, recordId, 'receipt', 1)
      ).criticalAuditorReceipt;

      expect(issueCodes(result)).not.toContain(
        'critical_auditor_no_new_gap_forbidden_by_gate_dry_run_blockers'
      );
      expect(receipt.falsePositiveProofs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ blockerCode: expect.any(String) }),
        ])
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('response_file consumes only the current missing round response', () => {
    const root = createTempRoot('requirements-contract-response-round-recovery-');
    try {
      const recordId = 'REQ-RESPONSE-ROUND-RECOVERY';
      const source = writeConsumerRequirement(root);
      const initial = runAuthoring(root, source, recordId, {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
      });
      expect(issueCodes(initial)).toContain('critical_auditor_provider_mode_required');
      const packet = stagingMustDecompositionPacket(root, recordId);
      const responseDir = path.join(root, 'auditor-responses');
      mkdirSync(responseDir, { recursive: true });

      const request1 = readJson<Record<string, unknown>>(roundArtifact(root, recordId, 'request', 1));
      const responseFile = path.join(root, 'critical-auditor-current-round-response.json');
      writeFileSync(
        responseFile,
        `${JSON.stringify(buildValidResponseFromRequest(request1, packet), null, 2)}\n`,
        'utf8'
      );

      const afterRound1 = runAuthoring(root, source, recordId, {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseFile: responseFile,
        maxCriticalAuditorRounds: 3,
      });
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(true);
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 2))).toBe(false);
      expect(issueCodes(afterRound1)).toContain('critical_auditor_response_file_missing');
      expect(issueCodes(afterRound1)).not.toContain('critical_auditor_response_request_hash_mismatch');

      const request2 = readJson<Record<string, unknown>>(roundArtifact(root, recordId, 'request', 2));
      const stagedResponse2 = roundArtifact(root, recordId, 'response', 2);
      expect(existsSync(stagedResponse2)).toBe(false);
      const response2 = path.join(responseDir, 'critical-auditor-round-response-2.json');
      writeFileSync(
        response2,
        `${JSON.stringify(buildValidResponseFromRequest(request2, packet), null, 2)}\n`,
        'utf8'
      );
      expect(readJson<Record<string, unknown>>(response2).requestHash).toBe(request2.requestHash);

      const afterRound2 = runAuthoring(root, source, recordId, {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseDir: responseDir,
        maxCriticalAuditorRounds: 3,
      });
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(true);
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 2))).toBe(true);
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 3))).toBe(false);
      expect(issueCodes(afterRound2)).toContain('critical_auditor_response_file_missing');
      expect(issueCodes(afterRound2)).not.toContain('critical_auditor_response_request_hash_mismatch');

      const request3 = readJson<Record<string, unknown>>(roundArtifact(root, recordId, 'request', 3));
      const response3 = path.join(responseDir, 'critical-auditor-round-response-3.json');
      writeFileSync(
        response3,
        `${JSON.stringify(buildValidResponseFromRequest(request3, packet), null, 2)}\n`,
        'utf8'
      );

      const third = runAuthoring(root, source, recordId, {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseDir: responseDir,
        maxCriticalAuditorRounds: 3,
      });

      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(true);
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 2))).toBe(true);
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 3))).toBe(true);
      expect(readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(
        roundArtifact(root, recordId, 'receipt', 2)
      ).criticalAuditorReceipt.requestHash).toBe(request2.requestHash);
      expect(readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(
        roundArtifact(root, recordId, 'receipt', 3)
      ).criticalAuditorReceipt.requestHash).toBe(request3.requestHash);
      expect(issueCodes(third)).not.toContain('critical_auditor_response_request_hash_mismatch');
    } finally {
      removeTempRoot(root);
    }
  });

  it('response_file rejects wrong round hash', () => {
    const root = createTempRoot('requirements-contract-response-wrong-round-');
    try {
      const recordId = 'REQ-RESPONSE-WRONG-ROUND';
      const fixture = createRequestForResponseFile(root, recordId);
      const wrongResponse = roundArtifact(root, recordId, 'response', 1);
      const wrong = {
        ...buildValidResponseFromRequest(fixture.request, fixture.packet),
        roundIndex: 2,
      };
      writeFileSync(wrongResponse, `${JSON.stringify(wrong, null, 2)}\n`, 'utf8');

      const result = runAuthoring(root, fixture.source, recordId, {
        targetPath: 'vnpy/chart/multi_timeframe_widget.py',
        requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseFile: wrongResponse,
      });

      expect(issueCodes(result)).toContain('critical_auditor_response_round_index_mismatch');
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(false);
      expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('critical auditor response dir CLI aliases reach pre-confirmation provider', () => {
    for (const flag of ['--critical-auditor-response-dir', '--criticalAuditorResponseDir']) {
      const root = createTempRoot(`requirements-contract-response-dir-cli-${flag.replace(/[^a-z]/gi, '-')}-`);
      const originalWrite = process.stdout.write;
      let stdout = '';
      try {
        const recordId = `REQ-RESPONSE-DIR-CLI-${flag.includes('Auditor') ? 'CAMEL' : 'KEBAB'}`;
        const fixture = createRequestForResponseFile(root, recordId);
        const responseDir = path.join(root, 'auditor-responses');
        mkdirSync(responseDir, { recursive: true });
        const responsePath = path.join(responseDir, 'critical-auditor-round-response-1.json');
        writeFileSync(
          responsePath,
          `${JSON.stringify(buildValidResponseFromRequest(fixture.request, fixture.packet), null, 2)}\n`,
          'utf8'
        );
        process.stdout.write = ((chunk: string | Uint8Array) => {
          stdout += chunk.toString();
          return true;
        }) as typeof process.stdout.write;

        const exitCode = mainMainAgentOrchestration([
          root,
          '--action',
          'author-confirmation-ready-source',
          '--source',
          fixture.source,
          '--record-id',
          recordId,
          '--requirement-set-id',
          `${recordId}-SET`,
          '--target-path',
          'vnpy/chart/multi_timeframe_widget.py',
          '--required-command',
          'pytest tests/test_multi_timeframe_settings.py',
          '--critical-auditor-provider-mode',
          'response_file',
          flag,
          responseDir,
        ]);

        expect(exitCode).toBe(1);
        const result = JSON.parse(stdout);
        expect(result.sourceMutationPerformed).toBe(false);
        const receipt = readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(
          roundArtifact(root, recordId, 'receipt', 1)
        ).criticalAuditorReceipt;
        expect(receipt.requestHash).toBe(fixture.request.requestHash);
      } finally {
        process.stdout.write = originalWrite;
        removeTempRoot(root);
      }
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
