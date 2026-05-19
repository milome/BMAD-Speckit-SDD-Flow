import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainEntryFlowTraceabilityCheck } from '../../scripts/main-agent-entryflow-traceability-check';

const SOURCE_HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMPLEMENTATION_HASH = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeSource(root: string, overrides: Record<string, unknown> = {}): string {
  const file = path.join(root, 'source.md');
  const entryFlow = String(overrides.entryFlow ?? 'standalone_tasks');
  const entryFlowClass = String(overrides.entryFlowClass ?? 'task_packet_entry');
  const workflowAdapter = String(overrides.workflowAdapter ?? 'direct');
  const contractAuthoringRequired = overrides.contractAuthoringRequired ?? true;
  writeFileSync(
    file,
    [
      '# EntryFlow Contract',
      '',
      '```yaml',
      'implementationConfirmation:',
      '  recordId: REQ-ENTRYFLOW',
      '  requirementSetId: REQ-ENTRYFLOW',
      `  entryFlow: ${entryFlow}`,
      `  entryFlowClass: ${entryFlowClass}`,
      `  workflowAdapter: ${workflowAdapter}`,
      `  contractAuthoringRequired: ${contractAuthoringRequired}`,
      '```',
      '',
    ].join('\n'),
    'utf8'
  );
  return file;
}

function writeRecord(root: string, overrides: Record<string, unknown> = {}): string {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-ENTRYFLOW');
  const recordPath = path.join(base, 'requirement-record.json');
  writeJson(recordPath, {
    recordId: 'REQ-ENTRYFLOW',
    requirementSetId: 'REQ-ENTRYFLOW',
    sourcePath: 'source.md',
    status: 'user_confirmed',
    entryFlow: 'standalone_tasks',
    entryFlowClass: 'task_packet_entry',
    workflowAdapter: 'direct',
    contractAuthoringRequired: true,
    sourceDocumentHash: SOURCE_HASH,
    implementationConfirmationHash: IMPLEMENTATION_HASH,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-ENTRYFLOW',
        requirementSetId: 'REQ-ENTRYFLOW',
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
        recordId: 'REQ-ENTRYFLOW',
        requirementSetId: 'REQ-ENTRYFLOW',
        executionIterationId: 'exec-016',
        runId: 'run-016',
        status: 'done',
        traceRows: ['TRACE-016'],
        evidenceRefs: ['EVD-001', 'EVD-004', 'EVD-023'],
        sourceDocumentHash: SOURCE_HASH,
        implementationConfirmationHash: IMPLEMENTATION_HASH,
        architectureConfirmationHash:
          'sha256:4444444444444444444444444444444444444444444444444444444444444444',
        recordedAt: '2026-05-19T00:00:00.000Z',
        recordedBy: 'test',
      },
    ],
    requirementClosures: [
      'MUST-023',
      'NEG-011',
      'OUT-009',
      'EVD-001',
      'EVD-004',
      'EVD-023',
    ].map((requirementId) => ({
      eventType: 'requirement_closure_recorded',
      recordId: 'REQ-ENTRYFLOW',
      requirementSetId: 'REQ-ENTRYFLOW',
      requirementId,
      status: 'pass',
      recordedAt: '2026-05-19T00:00:00.000Z',
      recordedBy: 'test',
    })),
    artifactIndex: [],
    ...overrides,
  });
  return recordPath;
}

describe('main-agent entryFlow traceability check', () => {
  it('passes for a canonical standalone_tasks requirement record mirrored from source contract', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'entryflow-pass-'));
    try {
      const sourcePath = writeSource(root);
      const recordPath = writeRecord(root);
      const reportPath = path.join(root, 'entry-flow-adaptation-matrix.json');
      const code = mainEntryFlowTraceabilityCheck([
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
      expect(report.entryFlowAdaptationMatrix.record).toMatchObject({
        entryFlow: 'standalone_tasks',
        entryFlowClass: 'task_packet_entry',
        workflowAdapter: 'direct',
        contractAuthoringRequired: true,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('blocks internal speckit and assistant flows as top-level entryFlow values', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'entryflow-forbidden-'));
    try {
      const sourcePath = writeSource(root, { entryFlow: 'speckit_tasks' });
      const recordPath = writeRecord(root, { entryFlow: 'speckit_tasks' });
      const code = mainEntryFlowTraceabilityCheck([
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

  it('blocks standalone_tasks dedicated runtime control fact artifacts', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'entryflow-standalone-artifact-'));
    try {
      const sourcePath = writeSource(root);
      const recordPath = writeRecord(root, {
        artifactIndex: [
          {
            artifactType: 'standalone_task_runtime_state',
            sourceOfTruthRole: 'control',
            path: '_bmad-output/runtime/requirement-records/REQ-ENTRYFLOW/standalone_tasks/state.json',
          },
        ],
      });
      const code = mainEntryFlowTraceabilityCheck([
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
});
