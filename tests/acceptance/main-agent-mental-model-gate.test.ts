import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendControlEventAndReplay,
  sha256Json,
} from '../../scripts/requirement-record-control-store';
import { validateRequirementRecordSchemaObject } from '../../scripts/requirement-record-live-schema-gate';

type JsonObject = Record<string, unknown>;

const MODELS = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
] as const;

function baseRecord(): JsonObject {
  return {
    schemaVersion: 'requirement-record/v1',
    recordId: 'REQ-MENTAL-MODEL-GATE',
    requirementSetId: 'REQSET-MENTAL-MODEL-GATE',
    status: 'user_confirmed',
    sourcePath: 'docs/requirements/mental-model.md',
    sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: 'REQ-MENTAL-MODEL-GATE',
        requirementSetId: 'REQSET-MENTAL-MODEL-GATE',
        confirmedAt: '2026-05-28T00:00:00.000Z',
        confirmedBy: 'test',
        sourcePath: 'docs/requirements/mental-model.md',
        sourceDocumentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        confirmationPageHash:
          'sha256:3333333333333333333333333333333333333333333333333333333333333333',
        confirmationText: 'confirmed',
        renderReportPath: '_bmad-output/runtime/requirement-records/REQSET-MENTAL-MODEL-GATE/confirmation/report.json',
        htmlPath: '_bmad-output/runtime/requirement-records/REQSET-MENTAL-MODEL-GATE/confirmation/confirmation.html',
      },
    ],
    currentMentalModel: 'requirement_confirmation',
    sixModelResults: Object.fromEntries(
      MODELS.map((model) => [
        model,
        {
          payloadKind: 'model_result',
          model,
          recordId: 'REQ-MENTAL-MODEL-GATE',
          requirementSetId: 'REQSET-MENTAL-MODEL-GATE',
          sourceDocumentHash:
            'sha256:1111111111111111111111111111111111111111111111111111111111111111',
          implementationConfirmationHash:
            'sha256:2222222222222222222222222222222222222222222222222222222222222222',
          status: model === 'requirement_confirmation' ? 'pass' : 'not_established',
          resultRecordedAt: '2026-05-28T00:00:00.000Z',
          resultRecordedBy: 'test',
          blockingReasons: [],
          sourceRefs: [{ sourceType: 'fixture', id: model }],
          currentHashes: {
            sourceDocumentHash:
              'sha256:1111111111111111111111111111111111111111111111111111111111111111',
            implementationConfirmationHash:
              'sha256:2222222222222222222222222222222222222222222222222222222222222222',
          },
        },
      ])
    ),
  };
}

function withRecord<T>(run: (recordPath: string) => T): T {
  const root = mkdtempSync(path.join(os.tmpdir(), 'mental-model-gate-'));
  try {
    const recordPath = path.join(
      root,
      '_bmad-output/runtime/requirement-records/REQSET-MENTAL-MODEL-GATE/requirement-record.json'
    );
    mkdirSync(path.dirname(recordPath), { recursive: true });
    writeFileSync(recordPath, `${JSON.stringify(baseRecord(), null, 2)}\n`, 'utf8');
    return run(recordPath);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('main-agent mental model gate', () => {
  it('preserves canonical six-model results for all six mental models', () => {
    withRecord((recordPath) => {
      appendControlEventAndReplay({
        recordPath,
        writerId: 'main-agent-mental-model-gate',
        eventType: 'main_agent_mental_model_gate_recorded',
        recordedAt: '2026-05-28T00:00:01.000Z',
        payload: { gateId: 'six-model-gate' },
        reduce: (record) => ({
          ...record,
          lastEventType: 'main_agent_mental_model_gate_recorded',
        }),
      });

      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(Object.keys(record.sixModelResults).sort()).toEqual([...MODELS].sort());
      expect(validateRequirementRecordSchemaObject(record).ok).toBe(true);
    });
  });

  it('allows forward transition only when the current model result has pass status', () => {
    withRecord((recordPath) => {
      appendControlEventAndReplay({
        recordPath,
        writerId: 'controlled-mental-model-transition-writer',
        eventType: 'mental_model_transition_recorded',
        recordedAt: '2026-05-28T00:00:02.000Z',
        payload: {
          eventType: 'mental_model_transition_recorded',
          fromModel: 'requirement_confirmation',
          toModel: 'architecture_confirmation',
          recordedAt: '2026-05-28T00:00:02.000Z',
          recordedBy: 'test',
          sourceRefs: [{ sourceType: 'model_result', id: 'requirement_confirmation' }],
        },
        reduce: (record, payload) => {
          const currentModel = String(record.currentMentalModel ?? '');
          const currentResult = (record.sixModelResults as JsonObject)?.[currentModel] as
            | JsonObject
            | undefined;
          if (currentResult?.status !== 'pass') {
            throw new Error('mental_model_transition_requires_current_model_pass');
          }
          return {
            ...record,
            currentMentalModel: payload.toModel,
            mentalModelTransitions: [...((record.mentalModelTransitions as unknown[]) ?? []), payload],
            lastEventType: 'mental_model_transition_recorded',
          };
        },
      });

      const record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.currentMentalModel).toBe('architecture_confirmation');
      expect(record.mentalModelTransitions.at(-1).eventType).toBe(
        'mental_model_transition_recorded'
      );
    });
  });

  it('rejects gate_check_recorded as a direct writer for sixModelResults implementation readiness', () => {
    withRecord((recordPath) => {
      expect(() =>
        appendControlEventAndReplay({
          recordPath,
          writerId: 'gate-check-writer',
          eventType: 'gate_check_recorded',
          recordedAt: '2026-05-28T00:00:03.000Z',
          payload: {
            eventType: 'gate_check_recorded',
            gate: 'implementation_readiness',
            decision: 'pass',
          },
          reduce: (record) => {
            const beforeHash = sha256Json(record.sixModelResults);
            const next = {
              ...record,
              sixModelResults: {
                ...(record.sixModelResults as JsonObject),
                implementation_readiness: {
                  ...((record.sixModelResults as JsonObject)
                    .implementation_readiness as JsonObject),
                  status: 'pass',
                },
              },
            };
            if (sha256Json(next.sixModelResults) !== beforeHash) {
              throw new Error('gate_check_recorded_cannot_write_sixModelResults');
            }
            return next;
          },
        })
      ).toThrow('gate_check_recorded_cannot_write_sixModelResults');
    });
  });

  it('writes reconfirmation requests separately from rollback transitions', () => {
    withRecord((recordPath) => {
      appendControlEventAndReplay({
        recordPath,
        writerId: 'controlled-reconfirmation-router',
        eventType: 'reconfirmation_requested',
        recordedAt: '2026-05-28T00:00:04.000Z',
        payload: {
          requestId: 'reconfirm-001',
          targetModel: 'requirement_confirmation',
          status: 'blocking_open',
          blocking: true,
          sourceRefs: [{ sourceType: 'drift', id: 'source-hash-drift' }],
          requestedAt: '2026-05-28T00:00:04.000Z',
          requestedBy: 'test',
          closureCondition: 'user reconfirms source hash drift',
        },
        reduce: (record, payload) => ({
          ...record,
          reconfirmationRequests: [
            ...((record.reconfirmationRequests as unknown[]) ?? []),
            payload,
          ],
          lastEventType: 'reconfirmation_requested',
        }),
      });

      let record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.currentMentalModel).toBe('requirement_confirmation');
      expect(record.mentalModelTransitions ?? []).toHaveLength(0);

      appendControlEventAndReplay({
        recordPath,
        writerId: 'controlled-mental-model-rollback-writer',
        eventType: 'mental_model_rollback_recorded',
        recordedAt: '2026-05-28T00:00:05.000Z',
        payload: {
          eventType: 'mental_model_rollback_recorded',
          fromModel: 'architecture_confirmation',
          toModel: 'requirement_confirmation',
          recordedAt: '2026-05-28T00:00:05.000Z',
          recordedBy: 'test',
          reasonCode: 'source_hash_drift',
          sourceRefs: [{ sourceType: 'reconfirmation_request', id: 'reconfirm-001' }],
        },
        reduce: (currentRecord, payload) => {
          const hasOpenBlockingRequest = ((currentRecord.reconfirmationRequests as JsonObject[]) ?? [])
            .some((request) => request.status === 'blocking_open');
          if (!hasOpenBlockingRequest) {
            throw new Error('mental_model_rollback_requires_open_blocking_reconfirmation');
          }
          return {
            ...currentRecord,
            currentMentalModel: payload.toModel,
            mentalModelTransitions: [
              ...((currentRecord.mentalModelTransitions as unknown[]) ?? []),
              payload,
            ],
            lastEventType: 'mental_model_rollback_recorded',
          };
        },
      });

      record = JSON.parse(readFileSync(recordPath, 'utf8'));
      expect(record.currentMentalModel).toBe('requirement_confirmation');
      expect(record.mentalModelTransitions.at(-1).eventType).toBe(
        'mental_model_rollback_recorded'
      );
    });
  });
});
