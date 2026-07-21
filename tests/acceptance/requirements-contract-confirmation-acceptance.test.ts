import { createHash } from 'node:crypto';
import {
  existsSync,
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
  runRequirementsContractConfirmationAcceptance,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-acceptance';
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
    sourceDocumentHash: sourceDocumentHashFor(
      sourceText,
      extracted.blockText,
      extracted.value
    ),
    implementationConfirmationHash: implementationConfirmationHashFor(extracted.value),
  };
}

function writeConfirmationFixture(root: string) {
  const sourcePath = path.join(root, 'requirements.md');
  const htmlPath = path.join(root, 'confirmation.html');
  const runtimeRoot = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  const recordId = `REQ-CONFIRM-${createHash('sha256').update(root).digest('hex').slice(0, 12)}`;
  const recordPath = path.join(runtimeRoot, recordId, 'requirement-record.json');
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
    '    - writerId: requirements-confirmation-ingest',
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
    reportPath,
    reportText,
    confirmationText,
  };
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
      rmSync(root, { recursive: true, force: true });
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
          ? readdirSync(
              path.join(path.dirname(fixture.recordPath), 'events', 'receipts')
            ).length
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
      rmSync(root, { recursive: true, force: true });
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
        },
      });

      expect(result.ok).toBe(false);
      expect(result.mismatches).toContain('atomic_source_update_required');
      expect(readFileSync(fixture.sourcePath, 'utf8')).toBe(fixture.sourceText);
      expect(existsSync(fixture.recordPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
