import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainControlPlaneIsolationCheck } from '../../scripts/main-agent-control-plane-isolation-check';

const HASH = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

function writeRecord(
  root: string,
  record: Record<string, unknown>
): { recordPath: string; reportPath: string } {
  const base = path.join(root, '_bmad-output', 'runtime', 'requirement-records', 'REQ-ISOLATION');
  mkdirSync(base, { recursive: true });
  const recordPath = path.join(base, 'requirement-record.json');
  const reportPath = path.join(base, 'control-plane-isolation-report.json');
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return { recordPath, reportPath };
}

function artifact(overrides: Record<string, unknown> = {}) {
  return {
    eventType: 'artifact_indexed',
    artifactType: 'dashboard_snapshot',
    sourceOfTruthRole: 'read_model',
    path: '_bmad-output/dashboard/snapshot.json',
    contentHash: HASH,
    producer: 'main-agent-control-plane-isolation-check.test',
    purpose: 'prove read model remains non-control',
    relatedRequirementIds: ['MUST-021', 'NEG-009', 'OUT-007', 'EVD-021'],
    status: 'active',
    inputVersion: 'source-v1',
    outputVersion: 'artifact-v1',
    ...overrides,
  };
}

function baseRecord(): Record<string, unknown> {
  return {
    recordId: 'REQ-ISOLATION',
    requirementSetId: 'REQ-ISOLATION',
    status: 'user_confirmed',
    sourceDocumentHash: HASH,
    implementationConfirmationHash: HASH,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-ISOLATION',
        requirementSetId: 'REQ-ISOLATION',
        confirmedAt: '2026-05-19T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'docs/design/example.md',
        sourceDocumentHash: HASH,
        implementationConfirmationHash: HASH,
        confirmationPageHash: HASH,
        confirmationText: 'confirm',
        renderReportPath: 'confirmation-render-report.json',
        htmlPath: 'confirmation.html',
      },
    ],
    artifactIndex: [
      artifact(),
      artifact({
        artifactType: 'bmad_workflow_projection',
        sourceOfTruthRole: 'projection',
        path: '_bmad-output/runtime/requirement-records/REQ-ISOLATION/projections/bmad-workflow-routing.json',
        purpose: 'prove BMAD workflow projection is navigational only',
      }),
    ],
    gateChecks: [
      {
        eventType: 'gate_check_recorded',
        checkId: 'gate-001',
        gate: 'Implementation Readiness Gate',
        decision: 'pass',
        sourceRefs: [{ sourceType: 'requirement_record', id: 'REQ-ISOLATION' }],
      },
    ],
    contractChecks: [
      {
        eventType: 'contract_check_recorded',
        checkId: 'contract-001',
        contract: 'requirement_confirmation',
        decision: 'pass',
        sourceRefs: [{ sourceType: 'requirement_confirmation', id: 'confirmation-001' }],
      },
    ],
    failureRecords: [
      {
        eventType: 'failure_recorded',
        failureId: 'failure-001',
        type: 'score_write_failed',
        status: 'resolved',
        sourceRefs: [{ sourceType: 'gate_check', id: 'score-materialization-001' }],
      },
    ],
    rcaRecords: [
      {
        eventType: 'rca_created',
        rcaId: 'rca-001',
        type: 'closeout_blocker',
        status: 'resolved',
        sourceRefs: [{ sourceType: 'failure_record', id: 'failure-001' }],
      },
    ],
    rerunLoops: [
      {
        rerunLoopId: 'rerun-001',
        status: 'resolved',
        sourceRefs: [{ sourceType: 'gate_check', id: 'score-materialization-001' }],
        blockerRefs: [{ sourceType: 'failure_record', id: 'failure-001' }],
      },
    ],
  };
}

function run(record: Record<string, unknown>) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'control-plane-isolation-'));
  const { recordPath, reportPath } = writeRecord(root, record);
  const code = mainControlPlaneIsolationCheck([
    '--requirement-record',
    recordPath,
    '--report-path',
    reportPath,
    '--evaluated-at',
    '2026-05-19T00:00:00.000Z',
    '--evaluated-by',
    'test-agent',
    '--json',
  ]);
  const updated = JSON.parse(readFileSync(recordPath, 'utf8'));
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  rmSync(root, { recursive: true, force: true });
  return { code, updated, report };
}

describe('main-agent control plane isolation check', () => {
  it('passes when projections and read models are indexed but not used as control sources', () => {
    const { code, updated, report } = run(baseRecord());

    expect(code).toBe(0);
    expect(updated).not.toHaveProperty('lastEventType');
    expect(report.decision).toBe('pass');
    expect(report.checks.every((check: { passed: boolean }) => check.passed)).toBe(true);
    expect(report.controlWrite).toBeUndefined();
  });

  it('blocks when dashboard, score, SFT, or report fields appear as root control fields', () => {
    const { code, report } = run({
      ...baseRecord(),
      dashboard: { status: 'green' },
      score: { decision: 'pass' },
      report: { complete: true },
    });

    expect(code).toBe(1);
    expect(report.blockingReasons).toEqual(
      expect.arrayContaining([
        'root_control_field_forbidden:dashboard',
        'root_control_field_forbidden:score',
        'root_control_field_forbidden:report',
      ])
    );
  });

  it('blocks when artifact refs or read models are used as source authority', () => {
    const record = baseRecord();
    record.gateChecks = [
      {
        eventType: 'gate_check_recorded',
        checkId: 'gate-from-artifact',
        gate: 'Delivery Closeout Gate',
        decision: 'pass',
        sourceRefs: [{ sourceType: 'artifact_ref', id: 'dashboard-green' }],
      },
    ];

    const { code, report } = run(record);

    expect(code).toBe(1);
    expect(report.blockingReasons).toContain('gate_check:non_control_source_ref:artifact_ref');
  });

  it('blocks when an orphan artifact is allowed through a passing closeout attempt', () => {
    const record = baseRecord();
    record.artifactIndex = [
      artifact({
        path: '_bmad-output/dashboard/orphan-score.json',
        status: 'orphan',
        relatedRequirementIds: ['MUST-021'],
      }),
    ];
    record.closeout = {
      currentAttemptId: 'closeout-001',
      attempts: [
        {
          closeoutAttemptId: 'closeout-001',
          decision: 'pass',
          blockingReasons: [],
        },
      ],
    };

    const { code, report } = run(record);

    expect(code).toBe(1);
    expect(report.blockingReasons).toEqual(
      expect.arrayContaining([
        'orphan_artifact_closeout_pass_forbidden',
        'orphan_artifact_missing_closeout_blocking_reason',
      ])
    );
  });

  it('blocks when lifecycle rows keep deprecated result or decision control fields', () => {
    const record = baseRecord();
    record.rerunLoops = [
      {
        rerunLoopId: 'rerun-legacy',
        status: 'resolved',
        result: 'pass',
        decision: 'pass',
        sourceRefs: [{ sourceType: 'gate_check', id: 'gate-001' }],
      },
    ];

    const { code, report } = run(record);

    expect(code).toBe(1);
    expect(report.blockingReasons).toEqual(
      expect.arrayContaining(['rerun_result_forbidden', 'rerun_decision_forbidden'])
    );
  });
});
