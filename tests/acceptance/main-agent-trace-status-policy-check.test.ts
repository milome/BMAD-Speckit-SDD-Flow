import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainTraceStatusPolicyCheck } from '../../scripts/main-agent-trace-status-policy-check';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH =
  'sha256:2222222222222222222222222222222222222222222222222222222222222222';

const TRACE_STATUS_POLICY = {
  schemaVersion: 'trace-status-policy/v1',
  allowedStatuses: [
    'PENDING',
    'PASS',
    'FAIL',
    'BLOCKED',
    'LINKED_DOWNSTREAM',
    'USER_APPROVED_DEFERRED',
    'USER_APPROVED_OUT_OF_SCOPE',
  ],
  terminalFullCloseoutStatuses: ['PASS', 'FAIL', 'BLOCKED'],
  linkedDownstreamRequiredFields: [
    'downstreamRecordId',
    'downstreamStoryRef',
    'downstreamSourceDocumentPath',
    'downstreamSourceDocumentHash',
    'downstreamScopeSummary',
    'downstreamRequirementIds',
    'downstreamAuditEvidenceRefs',
  ],
  userApprovedDeferredRequiredFields: [
    'userApprovalRef',
    'approvedAt',
    'approvedBy',
    'impactSummary',
    'followUpRecordId',
    'followUpDueCondition',
  ],
  userApprovedOutOfScopeRequiredFields: [
    'userApprovalRef',
    'approvedAt',
    'approvedBy',
    'impactSummary',
    'confirmationDeltaRef',
  ],
  bareDeferredForbidden: true,
  bareOutOfScopeForbidden: true,
  fullCloseoutForUserScopedStatusesForbidden: true,
};

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeSource(root: string, status = 'PENDING', extra = ''): string {
  const file = path.join(root, 'source.md');
  writeFileSync(
    file,
    [
      '# Trace Status Contract',
      '',
      'implementationConfirmation:',
      '  recordId: REQ-TRACE-STATUS',
      '  requirementSetId: REQ-TRACE-STATUS',
      '  entryFlow: standalone_tasks',
      '  entryFlowClass: task_packet_entry',
      '  workflowAdapter: direct',
      '  contractAuthoringRequired: true',
      '  traceRows:',
      '    - id: TRACE-018',
      '      covers: ["MUST-025", "NEG-013", "OUT-011"]',
      '      taskRefs: ["TASK-ENTRYFLOW-TRACEABILITY"]',
      '      evidenceRefs: ["EVD-025"]',
      `      status: ${status}`,
      extra
        .split('\n')
        .filter(Boolean)
        .map((line) => `      ${line}`)
        .join('\n'),
      '',
    ].join('\n'),
    'utf8'
  );
  return file;
}

function writeRecord(root: string, overrides: Record<string, unknown> = {}): string {
  const base = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'REQ-TRACE-STATUS'
  );
  const recordPath = path.join(base, 'requirement-record.json');
  writeJson(recordPath, {
    recordId: 'REQ-TRACE-STATUS',
    requirementSetId: 'REQ-TRACE-STATUS',
    sourcePath: 'source.md',
    status: 'user_confirmed',
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    traceStatusPolicy: TRACE_STATUS_POLICY,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-TRACE-STATUS',
        requirementSetId: 'REQ-TRACE-STATUS',
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'source.md',
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        confirmationPageHash:
          'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        confirmationText: 'confirmed',
        renderReportPath: 'confirmation-render-report.json',
        htmlPath: 'confirmation.html',
      },
    ],
    executionIterations: [
      {
        eventType: 'execution_iteration_recorded',
        recordId: 'REQ-TRACE-STATUS',
        requirementSetId: 'REQ-TRACE-STATUS',
        executionIterationId: 'exec-018',
        runId: 'run-018',
        status: 'done',
        traceRows: ['TRACE-018'],
        evidenceRefs: ['EVD-025'],
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        architectureConfirmationHash:
          'sha256:4444444444444444444444444444444444444444444444444444444444444444',
        recordedAt: '2026-05-19T00:00:00.000Z',
        recordedBy: 'test',
      },
    ],
    ...overrides,
  });
  return recordPath;
}

describe('main-agent trace status policy check', () => {
  it('passes for scoped trace rows using allowed non-closeout status', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'trace-status-pass-'));
    try {
      const sourcePath = writeSource(root, 'PENDING');
      const recordPath = writeRecord(root);
      const reportPath = path.join(root, 'trace-status-policy-check.json');
      const code = mainTraceStatusPolicyCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--report-path',
        reportPath,
        '--json',
      ]);

      expect(code).toBe(0);
      expect(existsSync(reportPath)).toBe(true);
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      expect(report.decision).toBe('pass');
      expect(report.checkedTraceRows[0]).toMatchObject({ id: 'TRACE-018', status: 'PENDING' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks bare DEFERRED and OUT_OF_SCOPE statuses', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'trace-status-bare-'));
    try {
      const sourcePath = writeSource(root, 'DEFERRED');
      const recordPath = writeRecord(root);
      const code = mainTraceStatusPolicyCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
      ]);

      expect(code).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks USER_APPROVED_DEFERRED without follow-up evidence', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'trace-status-user-deferred-'));
    try {
      const sourcePath = writeSource(
        root,
        'USER_APPROVED_DEFERRED',
        'userApprovalRef: CHAT-001\napprovedAt: 2026-05-19T00:00:00.000Z\napprovedBy: user\nimpactSummary: scoped deferral'
      );
      const recordPath = writeRecord(root);
      const code = mainTraceStatusPolicyCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
      ]);

      expect(code).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks user-scoped statuses in full closeout mode', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'trace-status-full-closeout-'));
    try {
      const sourcePath = writeSource(
        root,
        'USER_APPROVED_OUT_OF_SCOPE',
        'userApprovalRef: CHAT-001\napprovedAt: 2026-05-19T00:00:00.000Z\napprovedBy: user\nimpactSummary: user scoped exclusion\nconfirmationDeltaRef: CONFIRMATION-DELTA-001'
      );
      const recordPath = writeRecord(root);
      const code = mainTraceStatusPolicyCheck([
        '--requirement-record',
        recordPath,
        '--source',
        sourcePath,
        '--full-closeout',
      ]);

      expect(code).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
