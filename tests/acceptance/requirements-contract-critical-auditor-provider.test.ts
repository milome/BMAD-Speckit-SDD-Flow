import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  mainMainAgentOrchestration,
  validateCriticalAuditorReceiptBinding,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  artifacts,
  buildValidResponseFromRequest,
  createMinimalConsumerRequirementDescriptor,
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
  writeMinimalConsumerRequirement,
} from './helpers/requirements-contract-authoring-fixture';

function createAuthoringConsumerFixture(root: string, recordId: string) {
  const configTarget = path.join(root, '_bmad', '_config', 'governance-remediation.yaml');
  mkdirSync(path.dirname(configTarget), { recursive: true });
  writeFileSync(
    configTarget,
    readFileSync(path.join(process.cwd(), '_bmad', '_config', 'governance-remediation.yaml'), 'utf8'),
    'utf8'
  );
  const materialization = writeMinimalConsumerRequirement(
    root,
    `docs/requirements/${recordId.toLowerCase()}.md`,
    createMinimalConsumerRequirementDescriptor(recordId)
  );
  return materialization;
}

function createRequestForResponseFile(root: string, recordId: string) {
  const materialization = createAuthoringConsumerFixture(root, recordId);
  const source = materialization.sourcePath;
  const beforeHash = sha256File(source);
  const first = runAuthoring(root, source, recordId, materialization.authoringOptions);
  const requestPath = roundArtifact(root, recordId, 'request', 1);
  if (!existsSync(requestPath)) {
    throw new Error(
      `critical auditor request was not generated: ${JSON.stringify({
        blockingStage: first.blockingStage ?? null,
        issueCodes: issueCodes(first),
      })}`
    );
  }
  return {
    source,
    beforeHash,
    first,
    authoringOptions: materialization.authoringOptions,
    requestPath,
    request: readJson<Record<string, unknown>>(requestPath),
    packet: stagingMustDecompositionPacket(root, recordId),
  };
}

describe('requirements contract Critical Auditor provider modes', () => {
  it('no-new-gap response writer rejects deterministic synthesis without writing a response', () => {
    const root = createTempRoot('requirements-contract-critical-auditor-writer-quality-');
    try {
      const recordId = 'REQ-CRITICAL-AUDITOR-WRITER-QUALITY';
      const fixture = createRequestForResponseFile(root, recordId);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      const requestForWriter = {
        ...(fixture.request as any),
        gateDryRun: {
          ...((fixture.request as any).gateDryRun ?? {}),
          verdict: 'PASS',
          failedChecks: [],
          actionableBlockingIssueCount: 0,
          actionableBlockingIssues: [],
        },
      };
      const requestForWriterPath = path.join(
        path.dirname(fixture.requestPath),
        'critical-auditor-round-request-writer-fixture.json'
      );
      writeFileSync(requestForWriterPath, `${JSON.stringify(requestForWriter, null, 2)}\n`, 'utf8');
      const script = path.join(
        process.cwd(),
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'write-critical-auditor-no-new-gap-response.js'
      );

      const result = spawnSync(
        process.execPath,
        [
          script,
          '--authoring-dir',
          path.dirname(fixture.requestPath),
          '--request',
          requestForWriterPath,
          '--response-out',
          responsePath,
          '--round',
          '1',
          '--reviewed-projection-ref',
          String((fixture.request as any).packetProjectionSummary.projectionRefs[0]),
          '--json',
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      );

      expect(result.status, result.stderr || result.stdout).toBe(1);
      const response = JSON.parse(result.stdout || result.stderr);
      expect(response).toMatchObject({
        ok: false,
        failureClass: 'critical_auditor_independent_provider_evidence_required',
        issues: ['deterministic_no_new_gap_response_writer_forbidden'],
        receiptWritten: false,
      });
      expect(existsSync(responsePath)).toBe(false);
      expect(response.requestHash).toBe((fixture.request as any).requestHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('no-new-gap response writer fails closed on malformed gate counts and out-of-scope requests', () => {
    const root = createTempRoot('requirements-contract-critical-auditor-writer-fail-closed-');
    try {
      const recordId = 'REQ-CRITICAL-AUDITOR-WRITER-FAIL-CLOSED';
      const fixture = createRequestForResponseFile(root, recordId);
      const authoringDir = path.dirname(fixture.requestPath);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      const script = path.join(
        process.cwd(),
        '_bmad',
        'skills',
        'requirements-contract-authoring',
        'scripts',
        'write-critical-auditor-no-new-gap-response.js'
      );
      const malformedRequest = {
        ...(fixture.request as any),
        gateDryRun: {
          ...((fixture.request as any).gateDryRun ?? {}),
          actionableBlockingIssueCount: 'not-a-number',
          actionableBlockingIssues: {},
          reconciliation: {
            ...(((fixture.request as any).gateDryRun ?? {}).reconciliation ?? {}),
            issueCount: 'not-a-number',
          },
        },
      };
      const malformedRequestPath = path.join(
        authoringDir,
        'critical-auditor-round-request-malformed.json'
      );
      writeFileSync(malformedRequestPath, `${JSON.stringify(malformedRequest, null, 2)}\n`, 'utf8');

      const malformed = spawnSync(
        process.execPath,
        [
          script,
          '--authoring-dir',
          authoringDir,
          '--request',
          malformedRequestPath,
          '--response-out',
          responsePath,
          '--round',
          '1',
          '--reviewed-projection-ref',
          String((fixture.request as any).packetProjectionSummary.projectionRefs[0]),
          '--json',
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      );
      const malformedJson = JSON.parse(malformed.stdout);
      expect(malformed.status).toBe(1);
      expect(malformedJson.issues).toEqual(
        expect.arrayContaining([
          'critical_auditor_request_gate_dry_run_blocker_count_malformed',
          'critical_auditor_request_gate_dry_run_blockers_malformed',
          'critical_auditor_request_reconciliation_issue_count_malformed',
        ])
      );

      const outOfScopeRequestPath = path.join(root, 'critical-auditor-round-request-outside.json');
      writeFileSync(outOfScopeRequestPath, `${JSON.stringify(fixture.request, null, 2)}\n`, 'utf8');
      const outOfScope = spawnSync(
        process.execPath,
        [
          script,
          '--authoring-dir',
          authoringDir,
          '--request',
          outOfScopeRequestPath,
          '--response-out',
          responsePath,
          '--round',
          '1',
          '--json',
        ],
        { cwd: process.cwd(), encoding: 'utf8' }
      );
      expect(outOfScope.status).toBe(1);
      const outOfScopeJson = JSON.parse(outOfScope.stdout);
      expect(outOfScopeJson).toMatchObject({
        ok: false,
        failureClass: 'critical_auditor_no_new_gap_response_failed',
        error: 'request_outside_authoring_dir',
      });
    } finally {
      removeTempRoot(root);
    }
  });

  it('round requests require Critical Auditor to check per-MUST projection quality rules', () => {
    const root = createTempRoot('requirements-contract-critical-auditor-projection-quality-');
    try {
      const recordId = 'REQ-CRITICAL-AUDITOR-PROJECTION-QUALITY';
      const fixture = createRequestForResponseFile(root, recordId);
      const request = fixture.request as Record<string, any>;

      expect(request.projectionQualityGate).toMatchObject({
        requiredRuleCodes: expect.arrayContaining([
          'projection_per_must_acceptance_not_independent',
          'projection_shared_evidence_without_per_must_oracle',
          'required_command_all_cover_all_without_per_must_assertions',
          'target_modification_path_all_cover_all',
          'current_target_map_not_product_specific',
          'business_visual_generic_or_compressed',
        ]),
      });
      expect(request.auditStandards.join('\n')).toContain('per-MUST independent acceptance');
      expect(request.requiredResponseSchema.checkedProjectionQualityRuleCodes).toEqual(
        request.projectionQualityGate.requiredRuleCodes
      );
    } finally {
      removeTempRoot(root);
    }
  });

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
              ...((response.falsePositiveProofs as Record<string, unknown>[] | undefined) ?? []),
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
        ...fixture.authoringOptions,
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseFile: responsePath,
        maxCriticalAuditorRounds: 1,
      });
      const receiptPath = roundArtifact(root, recordId, 'receipt', 1);
      const receipt = readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(
        receiptPath
      ).criticalAuditorReceipt;

      expect(issueCodes(result)).toContain('critical_auditor_no_new_gap_convergence_not_reached');
      expect(existsSync(receiptPath)).toBe(true);
      expect(receipt.requestHash).toBe(fixture.request.requestHash);
      expect(receipt.transactionId).toBe(fixture.request.transactionId);
      expect(receipt.namespaceVersion).toBe(fixture.request.namespaceVersion);
      expect(receipt.roundIndex).toBe(1);
      expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
      expect(
        existsSync(artifacts(root, recordId, `${recordId}-SET`).sourceMaterializationReceipt)
      ).toBe(false);
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
        ...fixture.authoringOptions,
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseFile: responsePath,
      });

      expect(issueCodes(result)).toContain('critical_auditor_response_request_hash_mismatch');
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(false);
      expect(
        readJson<Record<string, unknown>>(sourcePromotionDecisionPath(root, recordId)).finalDecision
      ).toBe('block_source_promotion');
      expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('response_file rejects responses that omit per-MUST projection quality rule checks', () => {
    const root = createTempRoot('requirements-contract-response-file-missing-projection-quality-');
    try {
      const recordId = 'REQ-RESPONSE-FILE-MISSING-PROJECTION-QUALITY';
      const fixture = createRequestForResponseFile(root, recordId);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      const response = buildValidResponseFromRequest(fixture.request, fixture.packet);
      delete response.checkedProjectionQualityRuleCodes;
      writeFileSync(responsePath, `${JSON.stringify(response, null, 2)}\n`, 'utf8');

      const result = runAuthoring(root, fixture.source, recordId, {
        ...fixture.authoringOptions,
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseFile: responsePath,
      });

      expect(issueCodes(result)).toContain(
        'critical_auditor_response_checked_projection_quality_rule_missing'
      );
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(false);
      expectSourceHashUnchanged(fixture.source, fixture.beforeHash);
    } finally {
      removeTempRoot(root);
    }
  });

  it('response_file rejects no-new-gap responses without independent Judge run evidence', () => {
    const root = createTempRoot('requirements-contract-response-file-missing-judge-evidence-');
    try {
      const recordId = 'REQ-RESPONSE-FILE-MISSING-JUDGE-EVIDENCE';
      const fixture = createRequestForResponseFile(root, recordId);
      const responsePath = roundArtifact(root, recordId, 'response', 1);
      const response = buildValidResponseFromRequest(fixture.request, fixture.packet);
      delete response.independentProviderEvidence;
      writeFileSync(responsePath, `${JSON.stringify(response, null, 2)}\n`, 'utf8');

      const result = runAuthoring(root, fixture.source, recordId, {
        ...fixture.authoringOptions,
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseFile: responsePath,
      });

      expect(issueCodes(result), JSON.stringify(issueCodes(result))).toContain(
        'critical_auditor_independent_provider_evidence_required'
      );
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(false);
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
              ...((response.falsePositiveProofs as Record<string, unknown>[] | undefined) ?? []),
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
        ...fixture.authoringOptions,
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
        expect.arrayContaining([expect.objectContaining({ blockerCode: expect.any(String) })])
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
              ...((response.falsePositiveProofs as Record<string, unknown>[] | undefined) ?? []),
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
        ...fixture.authoringOptions,
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
        expect.arrayContaining([expect.objectContaining({ blockerCode: expect.any(String) })])
      );
    } finally {
      removeTempRoot(root);
    }
  });

  it('response_file consumes only the current missing round response', () => {
    const root = createTempRoot('requirements-contract-response-round-recovery-');
    try {
      const recordId = 'REQ-RESPONSE-ROUND-RECOVERY';
      const materialization = createAuthoringConsumerFixture(root, recordId);
      const source = materialization.sourcePath;
      const initial = runAuthoring(root, source, recordId, materialization.authoringOptions);
      expect(issueCodes(initial)).toContain('critical_auditor_provider_mode_required');
      const packet = stagingMustDecompositionPacket(root, recordId);
      const responseDir = path.join(root, 'auditor-responses');
      mkdirSync(responseDir, { recursive: true });

      const request1 = readJson<Record<string, unknown>>(
        roundArtifact(root, recordId, 'request', 1)
      );
      const responseFile = path.join(root, 'critical-auditor-current-round-response.json');
      writeFileSync(
        responseFile,
        `${JSON.stringify(buildValidResponseFromRequest(request1, packet), null, 2)}\n`,
        'utf8'
      );

      const afterRound1 = runAuthoring(root, source, recordId, {
        ...materialization.authoringOptions,
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseFile: responseFile,
        maxCriticalAuditorRounds: 3,
      });
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(true);
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 2))).toBe(false);
      expect(issueCodes(afterRound1)).toContain('critical_auditor_response_file_missing');
      expect(issueCodes(afterRound1)).not.toContain(
        'critical_auditor_response_request_hash_mismatch'
      );

      const request2 = readJson<Record<string, unknown>>(
        roundArtifact(root, recordId, 'request', 2)
      );
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
        ...materialization.authoringOptions,
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseDir: responseDir,
        maxCriticalAuditorRounds: 3,
      });
      const afterRound2State = {
        issueCodes: issueCodes(afterRound2),
        blockingStage: afterRound2.blockingStage,
        receipt1Exists: existsSync(roundArtifact(root, recordId, 'receipt', 1)),
        receipt2Exists: existsSync(roundArtifact(root, recordId, 'receipt', 2)),
        response1Exists: existsSync(roundArtifact(root, recordId, 'response', 1)),
        response2Exists: existsSync(roundArtifact(root, recordId, 'response', 2)),
      };
      expect(afterRound2State).toMatchObject({
        receipt1Exists: true,
        receipt2Exists: true,
        response1Exists: true,
        response2Exists: true,
      });
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 3))).toBe(false);
      expect(issueCodes(afterRound2)).toEqual(['critical_auditor_response_file_missing']);
      expect(issueCodes(afterRound2)).not.toContain(
        'critical_auditor_response_request_hash_mismatch'
      );

      const consumedRequest2 = readJson<Record<string, unknown>>(
        roundArtifact(root, recordId, 'request', 2)
      );
      const consumedReceipt2 = readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(
        roundArtifact(root, recordId, 'receipt', 2)
      ).criticalAuditorReceipt;
      expect(consumedRequest2.requestHash).toBe(consumedReceipt2.requestHash);

      const request3 = readJson<Record<string, unknown>>(
        roundArtifact(root, recordId, 'request', 3)
      );
      const response3 = path.join(responseDir, 'critical-auditor-round-response-3.json');
      writeFileSync(
        response3,
        `${JSON.stringify(buildValidResponseFromRequest(request3, packet), null, 2)}\n`,
        'utf8'
      );

      const third = runAuthoring(root, source, recordId, {
        ...materialization.authoringOptions,
        criticalAuditorProviderMode: 'response_file',
        criticalAuditorResponseDir: responseDir,
        maxCriticalAuditorRounds: 3,
      });
      const currentRequest1 = readJson<Record<string, unknown>>(
        roundArtifact(root, recordId, 'request', 1)
      );
      const archiveRoot = path.resolve(
        path.dirname(roundArtifact(root, recordId, 'request', 1)),
        '..',
        '..',
        'archive'
      );
      const finalDraftArchive = readdirSync(archiveRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) =>
          readJson<{
            schemaVersion: string;
            reason: string;
            artifacts: string[];
          }>(path.join(archiveRoot, entry.name, 'archive-manifest.json'))
        )
        .find((manifest) => manifest.reason === 'final_draft_binding_changed_restart_from_round_1');

      expect(finalDraftArchive).toMatchObject({
        schemaVersion: 'critical-auditor-stale-archive/v1',
        reason: 'final_draft_binding_changed_restart_from_round_1',
      });
      for (const roundIndex of [1, 2, 3]) {
        expect(finalDraftArchive?.artifacts).toContain(
          `critical-auditor-receipt-round-${roundIndex}.json`
        );
        for (const kind of ['request', 'response'] as const) {
          expect(
            finalDraftArchive?.artifacts.some((artifact) =>
              artifact.endsWith(`critical-auditor-round-${kind}-${roundIndex}.json`)
            )
          ).toBe(true);
        }
      }
      expect(third.blockingStage).toBe('critical_auditor_receipt_binding_invalid');
      expect(issueCodes(third)).toEqual(['critical_auditor_response_file_missing']);
      expect(currentRequest1.requestHash).not.toBe(request1.requestHash);
      expect(currentRequest1.previousReceipts).toEqual([]);
      for (const roundIndex of [1, 2, 3]) {
        expect(existsSync(roundArtifact(root, recordId, 'receipt', roundIndex))).toBe(false);
        expect(existsSync(roundArtifact(root, recordId, 'response', roundIndex))).toBe(false);
      }

      const freshResponseDir = path.join(root, 'fresh-auditor-responses');
      mkdirSync(freshResponseDir, { recursive: true });
      const writeFreshRoundResponse = (roundIndex: number) => {
        const currentRequest = readJson<Record<string, unknown>>(
          roundArtifact(root, recordId, 'request', roundIndex)
        );
        writeFileSync(
          path.join(freshResponseDir, `critical-auditor-round-response-${roundIndex}.json`),
          `${JSON.stringify(
            buildValidResponseFromRequest(
              currentRequest,
              stagingMustDecompositionPacket(root, recordId)
            ),
            null,
            2
          )}\n`,
          'utf8'
        );
        return currentRequest;
      };
      const runFreshRound = () =>
        runAuthoring(root, source, recordId, {
          ...materialization.authoringOptions,
          criticalAuditorProviderMode: 'response_file',
          criticalAuditorResponseDir: freshResponseDir,
          maxCriticalAuditorRounds: 3,
        });

      const freshRequest1 = writeFreshRoundResponse(1);
      const afterFreshRound1 = runFreshRound();
      expect(issueCodes(afterFreshRound1)).toEqual(['critical_auditor_response_file_missing']);
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 1))).toBe(true);
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 2))).toBe(false);

      const freshRequest2 = writeFreshRoundResponse(2);
      const afterFreshRound2 = runFreshRound();
      expect(issueCodes(afterFreshRound2)).toEqual(['critical_auditor_response_file_missing']);
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 2))).toBe(true);
      expect(existsSync(roundArtifact(root, recordId, 'receipt', 3))).toBe(false);

      const freshRequest3 = writeFreshRoundResponse(3);
      const final = runFreshRound();
      expect(final.blockingStage).toBeNull();
      expect(issueCodes(final)).not.toContain('critical_auditor_response_request_hash_mismatch');
      expect(
        readJson<Record<string, unknown>>(sourcePromotionDecisionPath(root, recordId)).finalDecision
      ).toBe('allow_source_promotion');
      expect(existsSync(artifacts(root, recordId, `${recordId}-SET`).promotionReceipt)).toBe(true);

      const freshRequests = [freshRequest1, freshRequest2, freshRequest3];
      for (const [index, freshRequest] of freshRequests.entries()) {
        const roundIndex = index + 1;
        const finalRequest = readJson<Record<string, unknown>>(
          roundArtifact(root, recordId, 'request', roundIndex)
        );
        const finalResponse = readJson<Record<string, unknown>>(
          roundArtifact(root, recordId, 'response', roundIndex)
        );
        const finalReceipt = readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(
          roundArtifact(root, recordId, 'receipt', roundIndex)
        ).criticalAuditorReceipt;
        const gateDryRun = finalRequest.gateDryRun as Record<string, unknown>;
        const validation = validateCriticalAuditorReceiptBinding({
          receipt: finalReceipt,
          response: finalResponse,
          expectation: {
            roundIndex,
            transactionId: String(finalRequest.transactionId),
            namespaceVersion: String(finalRequest.namespaceVersion),
            auditInputHash: String(finalRequest.auditInputHash),
            recordId: String(finalRequest.recordId),
            sourceDocumentHash: String(finalRequest.sourceDocumentHash),
            semanticModelHash: String(finalRequest.semanticModelHash),
            implementationConfirmationHash: String(finalRequest.implementationConfirmationHash),
            packetHash: String(finalRequest.packetHash),
            projectionSetHash: String(finalRequest.projectionSetHash),
            requestHash: String(finalRequest.requestHash),
            gateDryRunHash: String(gateDryRun.gateDryRunHash),
          },
        });

        expect(finalRequest.requestHash).toBe(freshRequest.requestHash);
        expect(validation).toMatchObject({
          ok: true,
          issueCodes: [],
          responseHash: finalReceipt.responseHash,
        });
      }
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
        ...fixture.authoringOptions,
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
      const root = createTempRoot(
        `requirements-contract-response-dir-cli-${flag.replace(/[^a-z]/gi, '-')}-`
      );
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
          '--implementation-attempt-id',
          fixture.authoringOptions.implementationAttemptId,
          '--session-id',
          fixture.authoringOptions.sessionId,
          '--session-turn-id',
          fixture.authoringOptions.sessionTurnId,
          '--session-message-id',
          fixture.authoringOptions.sessionMessageId,
          '--session-actor-identity-class',
          fixture.authoringOptions.sessionActorIdentityClass,
          '--session-branch',
          fixture.authoringOptions.sessionBranch,
          '--session-captured-at',
          fixture.authoringOptions.sessionCapturedAt,
          '--confirmation-language',
          fixture.authoringOptions.confirmationLanguage,
          '--target-path',
          fixture.authoringOptions.targetPath,
          '--required-command',
          fixture.authoringOptions.requiredCommand,
          '--critical-auditor-provider-mode',
          'response_file',
          flag,
          responseDir,
        ]);

        expect(exitCode).toBe(1);
        const result = JSON.parse(stdout);
        expect(result.sourceMutationPerformed).toBe(false);
        const receiptPath = roundArtifact(root, recordId, 'receipt', 1);
        expect(existsSync(receiptPath), JSON.stringify(result)).toBe(true);
        const receipt = readJson<{ criticalAuditorReceipt: Record<string, unknown> }>(receiptPath)
          .criticalAuditorReceipt;
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
      const recordId = 'REQ-EXTERNAL-ADAPTER';
      const materialization = createAuthoringConsumerFixture(root, recordId);
      const source = materialization.sourcePath;
      const beforeHash = sha256File(source);

      const result = runAuthoring(root, source, recordId, {
        ...materialization.authoringOptions,
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
