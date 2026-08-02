import { existsSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildValidResponseFromRequest,
  createTempRoot,
  expectSourceHashUnchanged,
  installJudgeRuntimeConfig,
  issueCodes,
  readJson,
  removeTempRoot,
  roundArtifact,
  runAuthoring,
  sha256File,
  stagingMustDecompositionPacket,
  writeConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

function prepareSubagentResponse(root: string, recordId: string) {
  installJudgeRuntimeConfig(root);
  const source = writeConsumerRequirement(root);
  const beforeHash = sha256File(source);
  runAuthoring(root, source, recordId, {
    targetPath: 'vnpy/chart/multi_timeframe_widget.py',
    requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
  });
  const request = readJson<Record<string, unknown>>(roundArtifact(root, recordId, 'request', 1));
  const packet = stagingMustDecompositionPacket(root, recordId);
  const responsePath = roundArtifact(root, recordId, 'response', 1);
  return { source, beforeHash, request, packet, responsePath };
}

describe('requirements contract readonly subagent providers', () => {
  it.each(['codex_subagent_readonly', 'claude_subagent_readonly'] as const)(
    '%s rejects source, packet, receipt, and requirement-record write fields',
    (providerMode) => {
      const root = createTempRoot(`requirements-contract-${providerMode}-forbidden-`);
      try {
        const recordId = `REQ-${providerMode.toUpperCase().replace(/_/gu, '-')}-FORBIDDEN`;
        const fixture = prepareSubagentResponse(root, recordId);
        writeFileSync(
          fixture.responsePath,
          `${JSON.stringify(
            {
              ...buildValidResponseFromRequest(fixture.request, fixture.packet),
              writeAttempts: ['source document', 'must_decomposition_packet.json'],
              sourceWriteAttempts: ['docs/requirements/multi-timeframe.md'],
              controlWriteAttempts: ['source-materialization-receipt.json'],
              mutatesSource: true,
              writesControlState: true,
            },
            null,
            2
          )}\n`,
          'utf8'
        );

        const result = runAuthoring(root, fixture.source, recordId, {
          targetPath: 'vnpy/chart/multi_timeframe_widget.py',
          requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
          criticalAuditorProviderMode: providerMode,
          criticalAuditorResponseFile: fixture.responsePath,
        });

        expect(issueCodes(result)).toContain('subagent_write_boundary_violation');
        expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(false);
        expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
      } finally {
        removeTempRoot(root);
      }
    }
  );

  it.each(['codex_subagent_readonly', 'claude_subagent_readonly'] as const)(
    '%s accepts read-only response data but leaves receipt writing to the orchestrator',
    (providerMode) => {
      const root = createTempRoot(`requirements-contract-${providerMode}-valid-`);
      try {
        const recordId = `REQ-${providerMode.toUpperCase().replace(/_/gu, '-')}-VALID`;
        const fixture = prepareSubagentResponse(root, recordId);
        writeFileSync(
          fixture.responsePath,
          `${JSON.stringify(buildValidResponseFromRequest(fixture.request, fixture.packet), null, 2)}\n`,
          'utf8'
        );

        const result = runAuthoring(root, fixture.source, recordId, {
          targetPath: 'vnpy/chart/multi_timeframe_widget.py',
          requiredCommand: 'pytest tests/test_multi_timeframe_settings.py',
          criticalAuditorProviderMode: providerMode,
          criticalAuditorResponseFile: fixture.responsePath,
          maxCriticalAuditorRounds: 1,
        });
        const receiptPath = roundArtifact(root, recordId, 'receipt', 1);
        const receipt = readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(
          receiptPath
        ).criticalAuditorReceipt;

        expect(issueCodes(result)).toContain('critical_auditor_no_new_gap_convergence_not_reached');
        expect(existsSync(receiptPath)).toBe(true);
        expect(receipt.responseHash).toBeDefined();
        expect(receipt.requestHash).toBe(fixture.request.requestHash);
        expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
      } finally {
        removeTempRoot(root);
      }
    }
  );
});
