import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compileRequirementsEffectivePassReceipt,
  type RequirementsEffectivePassReceipt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirements-effective-pass-gate';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';
import { runRequirementsContractConfirmationAcceptance } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-acceptance';
import {
  extractRequirementsContractImplementationConfirmation,
  implementationConfirmationHashFor,
  sourceDocumentHashFor,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec';

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function hashesForSource(sourceText: string): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
} {
  const extracted = extractRequirementsContractImplementationConfirmation(sourceText);
  return {
    sourceDocumentHash: sourceDocumentHashFor(sourceText, extracted.blockText, extracted.value),
    implementationConfirmationHash: implementationConfirmationHashFor(extracted.value),
  };
}

const EFFECTIVE_PASS_HASHES = {
  request: sha256Stable({ field: 'confirmation-request' }),
  attempt: sha256Stable({ field: 'confirmation-attempt' }),
  scope: sha256Stable({ field: 'confirmation-scope' }),
  evidence: sha256Stable({ field: 'confirmation-evidence' }),
  providerInvocation: sha256Stable({ field: 'confirmation-providerInvocation' }),
  prompt: sha256Stable({ field: 'confirmation-prompt' }),
  schema: sha256Stable({ field: 'confirmation-schema' }),
  providerConfiguration: sha256Stable({ field: 'confirmation-providerConfiguration' }),
  ledger: sha256Stable({ field: 'confirmation-ledger' }),
};

function effectivePassInput(overrides: Record<string, unknown> = {}) {
  const coverageUnitRefs = ['coverage/dimension', 'coverage/must', 'coverage/projection'];
  return {
    request: {
      actorClass: 'requirements_critical_auditor_judge',
      judgeRole: 'requirements_critical_auditor',
      requestHash: EFFECTIVE_PASS_HASHES.request,
      attemptKeyHash: EFFECTIVE_PASS_HASHES.attempt,
      scopeManifestHash: EFFECTIVE_PASS_HASHES.scope,
      promptTemplateHash: EFFECTIVE_PASS_HASHES.prompt,
      assessmentSchemaHash: EFFECTIVE_PASS_HASHES.schema,
      providerAuthority: {
        providerRef: 'provider/requirements',
        providerRegistryHash: sha256Stable({ field: 'confirmation-providerRegistry' }),
        providerConfigurationHash: EFFECTIVE_PASS_HASHES.providerConfiguration,
        credentialRevision: 1,
      },
    },
    assessment: {
      schemaVersion: 'critical-auditor-judge-assessment/v1',
      actorClass: 'requirements_critical_auditor_judge',
      judgeRole: 'requirements_critical_auditor',
      verdict: 'no_new_valid_gap',
      validatedGaps: [],
    },
    frozenScope: {
      coverageUnitRefs,
    },
    coverage: {
      observedCoverageUnitRefs: [...coverageUnitRefs],
      unassessedScopeRefs: [],
      blockingConditionRefs: [],
    },
    evidence: {
      evidenceManifestHash: EFFECTIVE_PASS_HASHES.evidence,
      providerInvocationReceiptHash: EFFECTIVE_PASS_HASHES.providerInvocation,
      missingEvidenceRefs: [],
    },
    priorFindings: {
      ledgerEntryHash: EFFECTIVE_PASS_HASHES.ledger,
      requiredPriorFindingRefs: ['finding/1', 'finding/2'],
      currentDispositionRefs: ['finding/1', 'finding/2'],
      unresolvedPriorFindingRefs: [],
    },
    veto: {
      requirementsVetoRefs: ['veto/security', 'veto/scope'],
      passedVetoRefs: ['veto/security', 'veto/scope'],
    },
    currentAuthority: {
      attemptKeyHash: EFFECTIVE_PASS_HASHES.attempt,
      scopeManifestHash: EFFECTIVE_PASS_HASHES.scope,
      evidenceManifestHash: EFFECTIVE_PASS_HASHES.evidence,
      providerInvocationReceiptHash: EFFECTIVE_PASS_HASHES.providerInvocation,
      promptTemplateHash: EFFECTIVE_PASS_HASHES.prompt,
      assessmentSchemaHash: EFFECTIVE_PASS_HASHES.schema,
      providerConfigurationHash: EFFECTIVE_PASS_HASHES.providerConfiguration,
    },
    identity: {
      replayDetected: false,
      duplicateIdentityDetected: false,
    },
    ...overrides,
  };
}

interface ConfirmationFixtureOptions {
  latestReceiptHash?: string;
  writerId?: string;
}

function writeConfirmationFixture(root: string, options: ConfirmationFixtureOptions = {}) {
  const sourcePath = path.join(root, 'requirements.md');
  const htmlPath = path.join(root, 'confirmation.html');
  const runtimeRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  const recordId = `REQ-CONFIRM-${createHash('sha256').update(root).digest('hex').slice(0, 12)}`;
  const recordPath = path.join(runtimeRoot, recordId, 'requirement-record.json');
  const effectivePassReceipt: RequirementsEffectivePassReceipt =
    compileRequirementsEffectivePassReceipt(effectivePassInput());
  const effectivePassReceiptPath = path.join(
    runtimeRoot,
    recordId,
    'judge',
    'requirements_critical_auditor',
    'requirements-effective-pass.receipt.json'
  );
  mkdirSync(path.dirname(effectivePassReceiptPath), { recursive: true });
  writeFileSync(
    effectivePassReceiptPath,
    `${JSON.stringify(effectivePassReceipt, null, 2)}\n`,
    'utf8'
  );
  const latestReceiptHash = options.latestReceiptHash ?? effectivePassReceipt.receiptHash;
  const writerId = options.writerId ?? 'requirements-confirmation-ingest';
  const sourceText = [
    'implementationConfirmation:',
    '  status: draft',
    `  recordId: ${recordId}`,
    `  requirementSetId: ${recordId}`,
    '  applicability:',
    '    governanceEvents:',
    '      applies: true',
    '      reasonCode: controlled_record_writes',
    '  controlledIngestWriterRegistry:',
    `    - writerId: ${writerId}`,
    '      allowedEventTypes: [confirmation_recorded]',
    '      scriptPath: packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-acceptance.ts',
    `      scriptContentHash: ${sha256('confirmation-facade')}`,
    '      ownerModel: requirement_confirmation',
    '      allowedWriteApis: [appendControlEvent, atomicWriteRequirementRecord, appendArtifactIndex]',
    '      allowedPaths: [_bmad-output/runtime/requirement-records/<requirement-set-id>/**]',
    '      payloadContractRefs: [confirmation_recorded]',
    '      writesControlFields: [confirmationHistory, sixModelResults]',
    '      receiptPath: _bmad-output/runtime/requirement-records/<requirement-set-id>/events/receipts/<receipt-id>.json',
    '      beforeAfterHashRequired: true',
    '      canModifyWriterRegistry: false',
    `      registryHash: ${sha256('registry')}`,
    `      architectureConfirmationHash: ${sha256('architecture')}`,
    '  preConfirmationDrilldown:',
    '    semanticKernelRef:',
    '      path: _bmad-output/runtime/authority/semantic-kernel.json',
    `      hash: ${sha256('semantic-kernel')}`,
    '    mustDecompositionPacketRef:',
    '      path: _bmad-output/runtime/authority/must-decomposition-packet.json',
    `      hash: ${sha256('must-decomposition-packet')}`,
    '      status: synchronized',
    '    criticalAuditor:',
    '      minimumRounds: 1',
    '      consecutiveNoNewGapRounds: 1',
    `      latestReceiptHash: ${latestReceiptHash}`,
    '      convergenceVerdict: bounded_no_new_gap',
    '    packetSourceReconciliation:',
    '      reportPath: _bmad-output/runtime/authority/packet-source-reconciliation.json',
    '      verdict: pass',
    '    preRenderGateReportPath: _bmad-output/runtime/authority/pre-render-gate.json',
    '  must: []',
    '',
    '# Source',
    '',
  ].join('\n');
  writeFileSync(sourcePath, sourceText, 'utf8');
  const htmlText = '<html><body>confirmation</body></html>\n';
  writeFileSync(htmlPath, htmlText, 'utf8');
  const hashes = hashesForSource(sourceText);
  const reportPath = path.join(root, 'confirmation-render-report.json');
  const report = {
    schemaVersion: 'requirements-contract-confirmation-render-report/v1',
    recordId,
    requirementSetId: recordId,
    sourceDocumentHash: hashes.sourceDocumentHash,
    implementationConfirmationHash: hashes.implementationConfirmationHash,
    confirmationPageHash: sha256(htmlText),
    actualHtmlFileHash: sha256(htmlText),
    confirmability: 'confirmable',
    blockingIssues: [],
    artifactRef: { path: htmlPath },
  };
  const reportText = `${JSON.stringify(report, null, 2)}\n`;
  writeFileSync(reportPath, reportText, 'utf8');
  const confirmationText = [
    '确认以上范围进入下一阶段',
    `sourceDocumentHash=${hashes.sourceDocumentHash}`,
    `implementationConfirmationHash=${hashes.implementationConfirmationHash}`,
    `confirmationPageHash=${report.confirmationPageHash}`,
  ].join('\n');
  return {
    sourcePath,
    sourceText,
    htmlPath,
    htmlText,
    runtimeRoot,
    recordId,
    recordPath,
    effectivePassReceipt,
    effectivePassReceiptPath,
    reportPath,
    reportText,
    confirmationText,
  };
}

function cleanupConfirmationFixture(root: string): void {
  rmSync(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

describe('package confirmation acceptance authority', () => {
  it('commits first confirmation and requirement_confirmation pass in one control transaction', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'confirmation-acceptance-'));
    try {
      const fixture = writeConfirmationFixture(root);

      const result = runRequirementsContractConfirmationAcceptance({
        root,
        args: {
          source: fixture.sourcePath,
          renderReport: fixture.reportPath,
          confirmationText: fixture.confirmationText,
          confirmedBy: 'test-user',
          confirmedAt: '2026-07-19T00:00:00.000Z',
          recordId: fixture.recordId,
          requirementSetId: fixture.recordId,
          runtimeRoot: fixture.runtimeRoot,
          requirementRecord: fixture.recordPath,
          requirementsEffectivePassReceipt: fixture.effectivePassReceiptPath,
        },
      });

      expect(result.ok).toBe(true);
      expect(result.artifactPaths).toEqual(
        expect.arrayContaining([
          fixture.sourcePath.replace(/\\/gu, '/'),
          fixture.htmlPath.replace(/\\/gu, '/'),
          fixture.reportPath.replace(/\\/gu, '/'),
        ])
      );
      const frozenIrPath = result.artifactPaths?.find((artifactPath) =>
        artifactPath.endsWith('/authority/requirement-confirmation-ir.json')
      );
      expect(frozenIrPath).toBeTruthy();
      const frozenIr = JSON.parse(readFileSync(frozenIrPath!, 'utf8')) as Record<string, any>;
      expect(frozenIr).toMatchObject({
        schemaVersion: 'requirements-contract-confirmation-ir/v1',
        recordId: fixture.recordId,
        requirementSetId: fixture.recordId,
      });
      expect(result.event?.frozenConfirmationIrRef).toMatchObject({
        path: frozenIrPath,
        semanticHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        contentHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      });
      expect(result.event?.requirementsEffectivePassReceiptRef).toMatchObject({
        path: fixture.effectivePassReceiptPath.replace(/\\/gu, '/'),
        receiptHash: fixture.effectivePassReceipt.receiptHash,
        schemaVersion: 'requirements-effective-pass-receipt/v1',
      });
      expect(result.event?.confirmedAuthorityIdentity).toMatchObject({
        frozenConfirmationIrRef: result.event?.frozenConfirmationIrRef,
      });
      expect(
        extractRequirementsContractImplementationConfirmation(
          readFileSync(fixture.sourcePath, 'utf8')
        ).value.status
      ).toBe('user_confirmed');
      const record = JSON.parse(readFileSync(fixture.recordPath, 'utf8')) as Record<string, any>;
      expect(record.status).toBe('user_confirmed');
      expect(record.sixModelResults.requirement_confirmation.status).toBe('pass');
      expect(record.controlledIngestWriterRegistryRequired).toBe(true);
      expect(record.confirmationHistory.at(-1)).toMatchObject({
        eventType: 'confirmation_recorded',
        confirmedBy: 'test-user',
      });
      expect(
        existsSync(path.join(path.dirname(fixture.recordPath), 'events', 'control-events.jsonl'))
      ).toBe(true);
      expect(existsSync(path.join(path.dirname(fixture.recordPath), 'events', 'receipts'))).toBe(
        true
      );
      expect(existsSync(path.join(path.dirname(fixture.recordPath), 'artifact-index.jsonl'))).toBe(
        true
      );
      expect(existsSync(path.join(fixture.runtimeRoot, 'artifact-index.jsonl'))).toBe(true);
    } finally {
      cleanupConfirmationFixture(root);
    }
  });

  it('rolls back first confirmation when an authority artifact cannot be promoted', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'confirmation-acceptance-rollback-'));
    try {
      const fixture = writeConfirmationFixture(root);
      let artifactWriteCallbackCount = 0;
      const result = runRequirementsContractConfirmationAcceptance({
        root,
        args: {
          source: fixture.sourcePath,
          renderReport: fixture.reportPath,
          confirmationText: fixture.confirmationText,
          confirmedBy: 'test-user',
          confirmedAt: '2026-07-20T00:00:00.000Z',
          recordId: fixture.recordId,
          requirementSetId: fixture.recordId,
          runtimeRoot: fixture.runtimeRoot,
          requirementRecord: fixture.recordPath,
          requirementsEffectivePassReceipt: fixture.effectivePassReceiptPath,
        },
        controlStoreDeps: {
          beforeArtifactWrite() {
            artifactWriteCallbackCount += 1;
            throw new Error('injected_confirmation_artifact_promotion_failure');
          },
        },
      } as any);

      expect({
        artifactWriteCallbackCount,
        resultOk: result.ok,
        error: result.error,
        recordExists: existsSync(fixture.recordPath),
        eventLogExists: existsSync(
          path.join(path.dirname(fixture.recordPath), 'events', 'control-events.jsonl')
        ),
        receiptFileCount: existsSync(
          path.join(path.dirname(fixture.recordPath), 'events', 'receipts')
        )
          ? readdirSync(path.join(path.dirname(fixture.recordPath), 'events', 'receipts')).length
          : 0,
        localArtifactIndexExists: existsSync(
          path.join(path.dirname(fixture.recordPath), 'artifact-index.jsonl')
        ),
        globalArtifactIndexExists: existsSync(
          path.join(fixture.runtimeRoot, 'artifact-index.jsonl')
        ),
      }).toEqual({
        artifactWriteCallbackCount: 1,
        resultOk: false,
        error: expect.stringContaining('injected_confirmation_artifact_promotion_failure'),
        recordExists: false,
        eventLogExists: false,
        receiptFileCount: 0,
        localArtifactIndexExists: false,
        globalArtifactIndexExists: false,
      });
      expect(readFileSync(fixture.sourcePath, 'utf8')).toBe(fixture.sourceText);
      expect(readFileSync(fixture.htmlPath, 'utf8')).toBe(fixture.htmlText);
      expect(readFileSync(fixture.reportPath, 'utf8')).toBe(fixture.reportText);
    } finally {
      cleanupConfirmationFixture(root);
    }
  });

  it('rejects disabling the source transition before creating confirmation authority', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'confirmation-acceptance-no-source-'));
    try {
      const fixture = writeConfirmationFixture(root);
      const result = runRequirementsContractConfirmationAcceptance({
        root,
        args: {
          source: fixture.sourcePath,
          renderReport: fixture.reportPath,
          confirmationText: fixture.confirmationText,
          updateSource: 'false',
          recordId: fixture.recordId,
          requirementSetId: fixture.recordId,
          runtimeRoot: fixture.runtimeRoot,
          requirementRecord: fixture.recordPath,
          requirementsEffectivePassReceipt: fixture.effectivePassReceiptPath,
        },
      });

      expect(result.ok).toBe(false);
      expect(result.mismatches).toContain('atomic_source_update_required');
      expect(readFileSync(fixture.sourcePath, 'utf8')).toBe(fixture.sourceText);
      expect(existsSync(fixture.recordPath)).toBe(false);
    } finally {
      cleanupConfirmationFixture(root);
    }
  });

  it('rejects missing or stale Requirements EffectivePass before publishing confirmation authority', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'confirmation-acceptance-effective-pass-'));
    try {
      const fixture = writeConfirmationFixture(root);
      const stale = writeConfirmationFixture(
        mkdtempSync(path.join(os.tmpdir(), 'confirmation-acceptance-effective-pass-stale-')),
        { latestReceiptHash: sha256('stale-effective-pass') }
      );

      const missing = runRequirementsContractConfirmationAcceptance({
        root,
        args: {
          source: fixture.sourcePath,
          renderReport: fixture.reportPath,
          confirmationText: fixture.confirmationText,
          confirmedAt: '2026-07-21T00:00:00.000Z',
          recordId: fixture.recordId,
          requirementSetId: fixture.recordId,
          runtimeRoot: fixture.runtimeRoot,
          requirementRecord: fixture.recordPath,
        },
      });
      expect(missing.ok).toBe(false);
      expect(missing.mismatches).toContain('requirements_effective_pass_receipt_missing');
      expect(existsSync(fixture.recordPath)).toBe(false);

      const staleResult = runRequirementsContractConfirmationAcceptance({
        root: path.dirname(stale.sourcePath),
        args: {
          source: stale.sourcePath,
          renderReport: stale.reportPath,
          confirmationText: stale.confirmationText,
          confirmedAt: '2026-07-21T00:00:00.000Z',
          recordId: stale.recordId,
          requirementSetId: stale.recordId,
          runtimeRoot: stale.runtimeRoot,
          requirementRecord: stale.recordPath,
          requirementsEffectivePassReceipt: stale.effectivePassReceiptPath,
        },
      });
      expect(staleResult.ok).toBe(false);
      expect(staleResult.mismatches).toContain('requirements_effective_pass_receipt_stale');
      expect(existsSync(stale.recordPath)).toBe(false);

      cleanupConfirmationFixture(path.dirname(stale.sourcePath));
    } finally {
      cleanupConfirmationFixture(root);
    }
  });

  it('rejects copied record identity and uncontrolled confirmation writers', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'confirmation-acceptance-identity-'));
    const uncontrolledRoot = mkdtempSync(
      path.join(os.tmpdir(), 'confirmation-acceptance-uncontrolled-')
    );
    try {
      const fixture = writeConfirmationFixture(root);
      const copied = runRequirementsContractConfirmationAcceptance({
        root,
        args: {
          source: fixture.sourcePath,
          renderReport: fixture.reportPath,
          confirmationText: fixture.confirmationText,
          confirmedAt: '2026-07-22T00:00:00.000Z',
          recordId: `${fixture.recordId}-copied`,
          requirementSetId: fixture.recordId,
          runtimeRoot: fixture.runtimeRoot,
          requirementRecord: path.join(
            fixture.runtimeRoot,
            `${fixture.recordId}-copied`,
            'requirement-record.json'
          ),
          requirementsEffectivePassReceipt: fixture.effectivePassReceiptPath,
        },
      });
      expect(copied.ok).toBe(false);
      expect(copied.mismatches).toContain('confirmation_record_identity_mismatch');

      const uncontrolled = writeConfirmationFixture(uncontrolledRoot, {
        writerId: 'uncontrolled-confirmation-ingest',
      });
      const uncontrolledResult = runRequirementsContractConfirmationAcceptance({
        root: uncontrolledRoot,
        args: {
          source: uncontrolled.sourcePath,
          renderReport: uncontrolled.reportPath,
          confirmationText: uncontrolled.confirmationText,
          confirmedAt: '2026-07-22T00:00:00.000Z',
          recordId: uncontrolled.recordId,
          requirementSetId: uncontrolled.recordId,
          runtimeRoot: uncontrolled.runtimeRoot,
          requirementRecord: uncontrolled.recordPath,
          requirementsEffectivePassReceipt: uncontrolled.effectivePassReceiptPath,
        },
      });
      expect(uncontrolledResult.ok).toBe(false);
      expect(uncontrolledResult.error).toContain(
        'controlled_ingest_writer_not_authorized:requirements-confirmation-ingest'
      );
      expect(existsSync(uncontrolled.recordPath)).toBe(false);
    } finally {
      cleanupConfirmationFixture(root);
      cleanupConfirmationFixture(uncontrolledRoot);
    }
  });

  it('rolls back partial source, event, record, and projection publication', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'confirmation-acceptance-partial-'));
    try {
      const fixture = writeConfirmationFixture(root);
      const result = runRequirementsContractConfirmationAcceptance({
        root,
        args: {
          source: fixture.sourcePath,
          renderReport: fixture.reportPath,
          confirmationText: fixture.confirmationText,
          confirmedAt: '2026-07-23T00:00:00.000Z',
          recordId: fixture.recordId,
          requirementSetId: fixture.recordId,
          runtimeRoot: fixture.runtimeRoot,
          requirementRecord: fixture.recordPath,
          requirementsEffectivePassReceipt: fixture.effectivePassReceiptPath,
        },
        controlStoreDeps: {
          beforeBoundary(boundary) {
            if (boundary === 'before_receipt') {
              throw new Error('injected_partial_confirmation_publication_failure');
            }
          },
        },
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('injected_partial_confirmation_publication_failure');
      expect(readFileSync(fixture.sourcePath, 'utf8')).toBe(fixture.sourceText);
      expect(existsSync(fixture.recordPath)).toBe(false);
      expect(
        existsSync(path.join(path.dirname(fixture.recordPath), 'events', 'control-events.jsonl'))
      ).toBe(false);
      expect(
        existsSync(
          path.join(
            path.dirname(fixture.recordPath),
            'authority',
            'requirement-confirmation-ir.json'
          )
        )
      ).toBe(false);
    } finally {
      cleanupConfirmationFixture(root);
    }
  });

  it('rejects replayed confirmation events instead of accepting copied authority', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'confirmation-acceptance-replay-'));
    try {
      const fixture = writeConfirmationFixture(root);
      const args = {
        source: fixture.sourcePath,
        renderReport: fixture.reportPath,
        confirmationText: fixture.confirmationText,
        confirmedAt: '2026-07-24T00:00:00.000Z',
        recordId: fixture.recordId,
        requirementSetId: fixture.recordId,
        runtimeRoot: fixture.runtimeRoot,
        requirementRecord: fixture.recordPath,
        requirementsEffectivePassReceipt: fixture.effectivePassReceiptPath,
      };
      const first = runRequirementsContractConfirmationAcceptance({ root, args });
      expect(first.ok).toBe(true);

      const replay = runRequirementsContractConfirmationAcceptance({ root, args });
      expect(replay.ok).toBe(false);
      expect(replay.error).toContain('control_store_duplicate_event');
    } finally {
      cleanupConfirmationFixture(root);
    }
  });
});
