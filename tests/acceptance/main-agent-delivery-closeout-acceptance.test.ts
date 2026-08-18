import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  extractRequirementsContractImplementationConfirmation,
  implementationConfirmationHashFor,
  sourceDocumentHashFor,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec';

const ROOT = process.cwd();
const CLI = path.join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');
const RECORD_ID = 'REQ-DELIVERY-CLOSEOUT';
const REQUIREMENT_SET_ID = 'REQSET-DELIVERY-CLOSEOUT';
const PAGE_HASH = `sha256:${'c'.repeat(64)}`;
const REPORT_HASH = `sha256:${'d'.repeat(64)}`;
let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-closeout-acceptance-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fixture(attemptId = 'attempt-closeout-001') {
  const source = path.join(tempDir, 'requirements.md');
  const sourceText = `implementationConfirmation:\n  status: user_confirmed\n  recordId: ${RECORD_ID}\n  requirementSetId: ${REQUIREMENT_SET_ID}\n  entryFlow: story\n\n# Delivery scope\n`;
  fs.writeFileSync(source, sourceText, 'utf8');
  const extracted = extractRequirementsContractImplementationConfirmation(sourceText);
  const sourceDocumentHash = sourceDocumentHashFor(
    sourceText,
    extracted.blockText,
    extracted.value
  );
  const implementationConfirmationHash = implementationConfirmationHashFor(extracted.value);
  const recordPath = path.join(tempDir, 'runtime', RECORD_ID, 'requirement-record.json');
  const renderReportPath = path.join(tempDir, 'runtime', RECORD_ID, 'closeout-render-report.json');
  const eventLogPath = path.join(tempDir, 'runtime', 'mentor-events.jsonl');
  const artifactIndexPath = path.join(tempDir, 'runtime', 'artifact-index.jsonl');
  writeJson(recordPath, {
    recordId: RECORD_ID,
    requirementSetId: REQUIREMENT_SET_ID,
    status: 'awaiting_user_acceptance',
    currentMentalModel: 'delivery_confirmation',
    currentStage: 'delivery_confirmation',
    sourceDocumentHash,
    implementationConfirmationHash,
    lastEventType: 'delivery_confirmation_user_acceptance_requested',
    closeout: {
      currentAttemptId: attemptId,
      decision: 'pass',
      acceptanceRequest: {
        status: 'awaiting_user_acceptance',
        closeoutAttemptId: attemptId,
        closeoutConfirmationPageHash: PAGE_HASH,
        deliveryCloseoutReportHash: REPORT_HASH,
      },
      attempts: [{ closeoutAttemptId: attemptId, decision: 'pass' }],
    },
  });
  writeJson(renderReportPath, {
    mode: 'closeout-review',
    recordId: RECORD_ID,
    requirementSetId: REQUIREMENT_SET_ID,
    sourceDocumentHash,
    implementationConfirmationHash,
    closeoutConfirmationPageHash: PAGE_HASH,
    deliveryCloseoutReportHash: REPORT_HASH,
    closeoutDeliveryVerdict: { ready: true, currentAttemptId: attemptId },
    finalAcceptanceReview: { ready: true, currentAttemptId: attemptId },
    artifactRef: { path: path.join(tempDir, 'closeout-confirmation-current.html') },
  });
  const confirmationText = (decision: 'accept' | 'reject') =>
    [
      decision === 'accept' ? '确认最终验收并关闭需求' : '拒绝最终验收并保持需求阻塞',
      `sourceDocumentHash=${sourceDocumentHash}`,
      `implementationConfirmationHash=${implementationConfirmationHash}`,
      `closeoutAttemptId=${attemptId}`,
      `closeoutConfirmationPageHash=${PAGE_HASH}`,
      `deliveryCloseoutReportHash=${REPORT_HASH}`,
    ].join('\n');
  return {
    source,
    recordPath,
    renderReportPath,
    eventLogPath,
    artifactIndexPath,
    confirmationText,
  };
}

function confirmCloseout(input: ReturnType<typeof fixture>, confirmationText: string) {
  return spawnSync(
    process.execPath,
    [
      CLI,
      'main-agent-orchestration',
      '--action',
      'confirm-closeout-acceptance',
      '--cwd',
      ROOT,
      '--source',
      input.source,
      '--render-report',
      input.renderReportPath,
      '--confirmation-text',
      confirmationText,
      '--confirmed-by',
      'test-user',
      '--record-id',
      RECORD_ID,
      '--requirement-record',
      input.recordPath,
      '--event-log',
      input.eventLogPath,
      '--artifact-index',
      input.artifactIndexPath,
      '--confirmed-at',
      '2026-05-27T10:00:00.000Z',
      '--json',
    ],
    { cwd: ROOT, encoding: 'utf8' }
  );
}

describe('Main Agent delivery closeout acceptance', () => {
  it.each(['accept', 'reject'] as const)(
    'rejects the legacy %s ingress without mutating record-backed authority',
    (decision) => {
      const input = fixture(`attempt-closeout-${decision}-001`);
      const recordBefore = fs.readFileSync(input.recordPath, 'utf8');
      const reportBefore = fs.readFileSync(input.renderReportPath, 'utf8');

      const result = confirmCloseout(input, input.confirmationText(decision));

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(2);
      expect(JSON.parse(result.stdout)).toMatchObject({
        status: 'unsupported_main_agent_action',
        exitCode: 2,
        errors: [{ code: 'unsupported_main_agent_action' }],
      });
      expect(fs.readFileSync(input.recordPath, 'utf8')).toBe(recordBefore);
      expect(fs.readFileSync(input.renderReportPath, 'utf8')).toBe(reportBefore);
      expect(fs.existsSync(input.eventLogPath)).toBe(false);
      expect(fs.existsSync(input.artifactIndexPath)).toBe(false);
    }
  );
});
