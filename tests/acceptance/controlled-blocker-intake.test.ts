import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendControlEventAndReplay,
} from '../../scripts/requirement-record-control-store';

type JsonObject = Record<string, unknown>;

const SIGNAL_CLASSES = [
  'task_report',
  'subagent_evidence_envelope',
  'inspect_diagnostic',
  'resolver_projection',
  'gate_failure',
  'drift_result',
  'audit_scoring_failure',
  'closeout_blocker',
] as const;

function baseRecord(): JsonObject {
  return {
    schemaVersion: 'requirement-record/v1',
    recordId: 'REQ-BLOCKER-INTAKE',
    requirementSetId: 'REQSET-BLOCKER-INTAKE',
    status: 'user_confirmed',
    sourcePath: 'docs/requirements/blocker-intake.md',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-BLOCKER-INTAKE',
        requirementSetId: 'REQSET-BLOCKER-INTAKE',
        confirmedAt: '2026-05-28T00:00:00.000Z',
        confirmedBy: 'test',
        sourcePath: 'docs/requirements/blocker-intake.md',
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        confirmationPageHash:
          'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        confirmationText: 'confirmed',
        renderReportPath: '_bmad-output/runtime/requirement-records/REQSET-BLOCKER-INTAKE/confirmation/report.json',
        htmlPath: '_bmad-output/runtime/requirement-records/REQSET-BLOCKER-INTAKE/confirmation/confirmation.html',
      },
    ],
    currentMentalModel: 'implementation_readiness',
    sixModelResults: {
      implementation_readiness: {
        payloadKind: 'model_result',
        model: 'implementation_readiness',
        recordId: 'REQ-BLOCKER-INTAKE',
        requirementSetId: 'REQSET-BLOCKER-INTAKE',
        sourceDocumentHash:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        status: 'pass',
        resultRecordedAt: '2026-05-28T00:00:00.000Z',
        resultRecordedBy: 'test',
        blockingReasons: [],
        sourceRefs: [{ sourceType: 'fixture', id: 'implementation_readiness' }],
        currentHashes: {},
      },
    },
  };
}

function withRecord<T>(run: (recordPath: string) => T): T {
  const root = mkdtempSync(path.join(os.tmpdir(), 'controlled-blocker-intake-'));
  try {
    const recordPath = path.join(
      root,
      '_bmad-output/runtime/requirement-records/REQSET-BLOCKER-INTAKE/requirement-record.json'
    );
    mkdirSync(path.dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, `${JSON.stringify(baseRecord(), null, 2)}\n`, 'utf8');
    return run(recordPath);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('controlled blocker intake', () => {
  it('normalizes every required raw signal class into pendingBlockerIntake and blockerIntakeRuns', () => {
    withRecord((recordPath) => {
      appendControlEventAndReplay({
        recordPath,
        writerId: 'controlled-blocker-intake-writer',
        eventType: 'controlled_blocker_recorded',
        recordedAt: '2026-05-28T00:00:01.000Z',
        payload: {
          runId: 'blocker-intake-run-001',
          status: 'blocking',
          normalizedSignals: SIGNAL_CLASSES.map((signalClass) => ({
            intakeId: `intake-${signalClass}`,
            status: 'blocking',
            signalClass,
            sourceRefs: [{ sourceType: signalClass, id: `${signalClass}-001` }],
          })),
        },
        reduce: (record, payload) => ({
          ...record,
          pendingBlockerIntake: payload.normalizedSignals,
          blockerIntakeRuns: [
            {
              runId: payload.runId,
              status: payload.status,
              signalClasses: SIGNAL_CLASSES,
              recordedAt: '2026-05-28T00:00:01.000Z',
            },
          ],
          lastEventType: 'controlled_blocker_recorded',
        }),
      });

      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.pendingBlockerIntake.map((item: JsonObject) => item.signalClass)).toEqual(
        SIGNAL_CLASSES
      );
      expect(record.blockerIntakeRuns.at(-1)).toMatchObject({
        runId: 'blocker-intake-run-001',
        status: 'blocking',
      });
    });
  });

  it('keeps raw evidence signals from directly advancing six-model state', () => {
    withRecord((recordPath) => {
      expect(() =>
        appendControlEventAndReplay({
          recordPath,
          writerId: 'raw-task-report-writer',
          eventType: 'execution_iteration_recorded',
          recordedAt: '2026-05-28T00:00:02.000Z',
          payload: {
            eventType: 'execution_iteration_recorded',
            runId: 'task-report-001',
            status: 'done',
          },
          reduce: (record) => {
            if (record.currentMentalModel === 'implementation_readiness') {
              throw new Error('raw_signal_cannot_advance_six_model_state');
            }
            return record;
          },
        })
      ).toThrow('raw_signal_cannot_advance_six_model_state');
    });
  });
});
