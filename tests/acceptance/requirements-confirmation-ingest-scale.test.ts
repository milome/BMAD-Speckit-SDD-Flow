import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  extractRequirementsContractImplementationConfirmation,
  implementationConfirmationHashFor,
  sourceDocumentHashFor,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec';
import { materializeRequirementsEffectivePassFixture } from '../helpers/requirements-effective-pass-fixture';

const ROOT = process.cwd();
const CORPUS = JSON.parse(
  fs.readFileSync(
    path.resolve(
      'tests/fixtures/requirements-contract/requirements-confirmation-ingest-scale.v1.json'
    ),
    'utf8'
  )
) as {
  schemaVersion: string;
  minUtf8Bytes: number;
  totalLines: number;
  sourceSpan: { startLine: number; endLine: number };
  replacementRange: { startLine: number; endLine: number };
  replacementLineCount: number;
  tailLineCount: number;
  replacementContentSha256: string;
};

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-confirm-scale-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function replacementLine(index: number): string {
  return `    - "scale-replacement-${String(index).padStart(6, '0')}-${'x'.repeat(48)}"`;
}

function writeScaleSource(): {
  sourcePath: string;
  sourceText: string;
  payload: string[];
  effectivePassReceiptPath: string;
} {
  const effectivePass = materializeRequirementsEffectivePassFixture({
    root: tempDir,
    recordId: 'REQ-CONFIRM-SCALE',
  });
  const lines = [
    '# Scale Confirmation',
    '',
    'implementationConfirmation:',
    '  status: draft',
    '  recordId: REQ-CONFIRM-SCALE',
    '  requirementSetId: REQSET-CONFIRM-SCALE',
    '  entryFlow: story',
    '  entryFlowClass: full_story_entry',
    '  workflowAdapter: bmad',
    '  contractAuthoringRequired: true',
    '  confirmationLanguage: zh-CN',
    '  confirmedAt: null',
    '  confirmedBy: null',
    '  sourceDocumentHash: null',
    '  implementationConfirmationHash: null',
    '  controlledIngestWriterRegistry:',
    '    - writerId: requirements-confirmation-ingest',
    '      scriptPath: "_bmad/skills/requirements-contract-authoring/scripts/ingest-confirmation-event.js"',
    `      scriptContentHash: "sha256:${'a'.repeat(64)}"`,
    '      ownerModel: requirements_contract',
    '      allowedWriteApis: [appendControlEvent, atomicWriteRequirementRecord, appendArtifactIndex]',
    '      allowedPaths:',
    '        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/requirement-record.json"',
    '        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/events/control-events.jsonl"',
    '        - "_bmad-output/runtime/requirement-records/<requirement-set-id>/artifact-index.jsonl"',
    '        - "_bmad-output/runtime/requirement-records/artifact-index.jsonl"',
    '      allowedEventTypes: [confirmation_recorded, artifact_index_recorded]',
    '      payloadContractRefs: [confirmation_recorded, artifact_index_recorded]',
    '      writesControlFields: [confirmationHistory, artifactIndex]',
    '      receiptPath: "_bmad-output/runtime/requirement-records/<requirement-set-id>/receipts/requirements-confirmation-ingest/<receipt-id>.json"',
    '      beforeAfterHashRequired: true',
    '      canModifyWriterRegistry: false',
    `      registryHash: "sha256:${'b'.repeat(64)}"`,
    `      architectureConfirmationHash: "sha256:${'c'.repeat(64)}"`,
    '  preConfirmationDrilldown:',
    '    criticalAuditor:',
    `      latestReceiptHash: ${effectivePass.receipt.receiptHash}`,
  ];
  while (lines.length < CORPUS.sourceSpan.startLine - 2) {
    lines.push(`  # scale-prefix-${String(lines.length + 1).padStart(6, '0')}`);
  }
  lines.push('  largeScaleReplacement:');
  const payload = Array.from({ length: CORPUS.replacementLineCount }, (_, index) =>
    replacementLine(index)
  );
  for (const line of payload) lines.push(line);
  lines.push('  tailScalePadding:');
  for (let index = 0; index < CORPUS.tailLineCount - 1; index += 1) {
    lines.push(`    - "tail-${String(index).padStart(6, '0')}"`);
  }
  const sourceText = lines.join('\n');
  const sourcePath = path.join(tempDir, 'scale-prd.md');
  fs.writeFileSync(sourcePath, sourceText, 'utf8');
  return {
    sourcePath,
    sourceText,
    payload,
    effectivePassReceiptPath: effectivePass.receiptPath,
  };
}

describe('requirements confirmation ingest scale corpus', () => {
  it(
    'ingests the frozen exact-line fixture without argument expansion or stack failure',
    { timeout: 180_000 },
    () => {
      const { sourcePath, sourceText, payload, effectivePassReceiptPath } = writeScaleSource();
      expect(CORPUS.schemaVersion).toBe('requirements-confirmation-ingest-scale/v1');
      expect(sourceText.split('\n')).toHaveLength(CORPUS.totalLines);
      expect(Buffer.byteLength(sourceText, 'utf8')).toBeGreaterThanOrEqual(CORPUS.minUtf8Bytes);
      expect(sourceText.split('\n')[CORPUS.sourceSpan.startLine - 1]).toBe(payload[0]);
      expect(sourceText.split('\n')[CORPUS.replacementRange.endLine - 1]).toBe(payload.at(-1));
      expect(`sha256:${createHash('sha256').update(payload.join('\n')).digest('hex')}`).toBe(
        CORPUS.replacementContentSha256
      );

      const extracted = extractRequirementsContractImplementationConfirmation(sourceText);
      const sourceDocumentHash = sourceDocumentHashFor(
        sourceText,
        extracted.blockText,
        extracted.value
      );
      const implementationConfirmationHash = implementationConfirmationHashFor(extracted.value);
      const htmlPath = path.join(tempDir, 'confirmation.html');
      const htmlText =
        '<!doctype html><html lang="zh-CN"><title>Scale confirmation</title></html>\n';
      const actualHtmlFileHash = `sha256:${createHash('sha256').update(htmlText, 'utf8').digest('hex')}`;
      const confirmationPageHash = actualHtmlFileHash;
      const reportPath = path.join(tempDir, 'confirmation-render-report.json');
      const confirmationTextPath = path.join(tempDir, 'confirmation.txt');
      const confirmInstruction = [
        '确认以上范围进入下一阶段',
        `sourceDocumentHash=${sourceDocumentHash}`,
        `implementationConfirmationHash=${implementationConfirmationHash}`,
        `confirmationPageHash=${confirmationPageHash}`,
      ].join('\n');
      fs.writeFileSync(
        reportPath,
        `${JSON.stringify({
          confirmability: 'confirmable',
          recordId: 'REQ-CONFIRM-SCALE',
          requirementSetId: 'REQSET-CONFIRM-SCALE',
          sourceDocumentHash,
          implementationConfirmationHash,
          confirmationPageHash,
          actualHtmlFileHash,
          confirmInstruction,
          artifactRef: { path: htmlPath, actualFileHash: actualHtmlFileHash },
        })}\n`,
        'utf8'
      );
      fs.writeFileSync(htmlPath, htmlText, 'utf8');
      fs.writeFileSync(confirmationTextPath, confirmInstruction, 'utf8');

      const result = spawnSync(
        process.execPath,
        [
          path.join(ROOT, 'packages/bmad-speckit/bin/bmad-speckit.js'),
          'main-agent:confirm-scope',
          '--cwd',
          ROOT,
          '--source',
          sourcePath,
          '--render-report',
          reportPath,
          '--confirmation-text-file',
          confirmationTextPath,
          '--confirmed-by',
          'scale-test',
          '--runtime-root',
          path.join(tempDir, 'runtime'),
          '--requirements-effective-pass-receipt',
          effectivePassReceiptPath,
          '--confirmed-at',
          '2026-07-19T04:00:00.000Z',
        ],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
      );

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(result.stderr).not.toMatch(/Maximum call stack|RangeError/iu);
      const output = JSON.parse(result.stdout);
      expect(output).toMatchObject({ ok: true, action: 'confirm-scope' });
      const updated = extractRequirementsContractImplementationConfirmation(
        fs.readFileSync(sourcePath, 'utf8')
      );
      expect(updated.value.status).toBe('user_confirmed');
      expect(updated.value.largeScaleReplacement).toHaveLength(CORPUS.replacementLineCount);
      expect((updated.value.largeScaleReplacement as string[]).at(-1)).toContain(
        'scale-replacement-124999'
      );
    }
  );
});
