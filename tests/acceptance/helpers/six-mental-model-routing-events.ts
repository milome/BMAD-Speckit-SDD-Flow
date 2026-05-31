import { appendControlEventAndReplay } from '../../../scripts/requirement-record-control-store';
import {
  IMPLEMENTATION_HASH,
  type JsonObject,
  type MentalModel,
  type ModelStatus,
  NEXT_MODEL,
  PAGE_HASH,
  SOURCE_HASH,
  modelResult,
  modelResults,
} from './six-mental-model-routing-fixture';

function currentResult(record: JsonObject): JsonObject {
  return modelResults(record)[String(record.currentMentalModel)] as JsonObject;
}

function hasOpenBlockingReconfirmation(record: JsonObject): boolean {
  return ((record.reconfirmationRequests as JsonObject[]) ?? []).some(
    (request) => request.status === 'blocking_open'
  );
}

export function appendModelResult(
  recordPath: string,
  model: MentalModel,
  status: ModelStatus
): void {
  appendControlEventAndReplay({
    recordPath,
    writerId: 'six-model-routing-e2e-model-result-writer',
    eventType: `${model}_result_recorded`,
    recordedAt: '2026-05-28T00:00:01.000Z',
    payload: {
      model,
      status,
      blockingReasons: status === 'pass' ? [] : [`${model}_blocked_for_route_matrix`],
    },
    reduce: (record, payload) => ({
      ...record,
      sixModelResults: {
        ...(record.sixModelResults as JsonObject),
        [payload.model as string]: modelResult(
          payload.model as MentalModel,
          payload.status as ModelStatus,
          payload.blockingReasons as string[]
        ),
      },
      lastEventType: `${payload.model as string}_result_recorded`,
    }),
  });
}

export function transition(recordPath: string, fromModel: MentalModel, toModel: MentalModel): void {
  appendControlEventAndReplay({
    recordPath,
    writerId: 'controlled-six-model-transition-writer',
    eventType: 'mental_model_transition_recorded',
    recordedAt: '2026-05-28T00:00:02.000Z',
    payload: {
      eventType: 'mental_model_transition_recorded',
      fromModel,
      toModel,
      recordedAt: '2026-05-28T00:00:02.000Z',
      recordedBy: 'six-model-routing-e2e',
      sourceRefs: [{ sourceType: 'model_result', id: fromModel }],
    },
    reduce: (record, payload) => {
      if (record.currentMentalModel !== payload.fromModel) {
        throw new Error('mental_model_transition_from_model_mismatch');
      }
      if (NEXT_MODEL[payload.fromModel as MentalModel] !== payload.toModel) {
        throw new Error('mental_model_transition_order_violation');
      }
      if (hasOpenBlockingReconfirmation(record)) {
        throw new Error('mental_model_transition_blocked_by_open_reconfirmation');
      }
      if (currentResult(record).status !== 'pass') {
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
}

export function closeRecord(recordPath: string): void {
  appendControlEventAndReplay({
    recordPath,
    writerId: 'controlled-record-close-writer',
    eventType: 'record_closed',
    recordedAt: '2026-05-28T00:00:03.000Z',
    payload: {
      closeoutAttemptId: 'closeout-six-model-routing-e2e',
      sourceRefs: [{ sourceType: 'model_result', id: 'delivery_confirmation' }],
    },
    reduce: (record) => {
      if (record.currentMentalModel !== 'delivery_confirmation') {
        throw new Error('record_closed_requires_delivery_confirmation_model');
      }
      if ((modelResults(record).delivery_confirmation as JsonObject).status !== 'pass') {
        throw new Error('record_closed_requires_delivery_confirmation_pass');
      }
      return {
        ...record,
        status: 'closed',
        closeout: {
          currentAttemptId: 'closeout-six-model-routing-e2e',
          decision: 'pass',
          attempts: [
            {
              eventType: 'closeout_check_recorded',
              closeoutAttemptId: 'closeout-six-model-routing-e2e',
              decision: 'pass',
              blockingReasons: [],
            },
          ],
        },
        lastEventType: 'record_closed',
      };
    },
  });
}

export function requestReconfirmation(recordPath: string): void {
  appendControlEventAndReplay({
    recordPath,
    writerId: 'controlled-reconfirmation-router',
    eventType: 'reconfirmation_requested',
    recordedAt: '2026-05-28T00:00:04.000Z',
    payload: {
      requestId: 'reconfirm-six-model-routing-e2e',
      targetModel: 'requirement_confirmation',
      status: 'blocking_open',
      sourceRefs: [{ sourceType: 'semantic_drift', id: 'source-document-hash-drift' }],
      requestedAt: '2026-05-28T00:00:04.000Z',
      requestedBy: 'six-model-routing-e2e',
    },
    reduce: (record, payload) => ({
      ...record,
      status: 'reconfirm_required',
      reconfirmationRequests: [...((record.reconfirmationRequests as unknown[]) ?? []), payload],
      lastEventType: 'reconfirmation_requested',
    }),
  });
}

export function rollbackToRequirementConfirmation(
  recordPath: string,
  fromModel: MentalModel
): void {
  appendControlEventAndReplay({
    recordPath,
    writerId: 'controlled-six-model-rollback-writer',
    eventType: 'mental_model_rollback_recorded',
    recordedAt: '2026-05-28T00:00:05.000Z',
    payload: {
      eventType: 'mental_model_rollback_recorded',
      fromModel,
      toModel: 'requirement_confirmation',
      recordedAt: '2026-05-28T00:00:05.000Z',
      recordedBy: 'six-model-routing-e2e',
      reasonCode: 'semantic_drift_reconfirmation_required',
      sourceRefs: [{ sourceType: 'reconfirmation_request', id: 'reconfirm-six-model-routing-e2e' }],
    },
    reduce: (record, payload) => {
      const openRequest = ((record.reconfirmationRequests as JsonObject[]) ?? []).some(
        (request) =>
          request.status === 'blocking_open' && request.targetModel === 'requirement_confirmation'
      );
      if (!openRequest) {
        throw new Error('mental_model_rollback_requires_open_blocking_reconfirmation');
      }
      return {
        ...record,
        currentMentalModel: payload.toModel,
        mentalModelTransitions: [...((record.mentalModelTransitions as unknown[]) ?? []), payload],
        lastEventType: 'mental_model_rollback_recorded',
      };
    },
  });
}

export function ingestReconfirmation(
  recordPath: string,
  overrides: Partial<{
    sourceDocumentHash: string;
    implementationConfirmationHash: string;
  }> = {}
): void {
  appendControlEventAndReplay({
    recordPath,
    writerId: 'controlled-reconfirmation-ingest',
    eventType: 'confirmation_recorded',
    recordedAt: '2026-05-28T00:00:06.000Z',
    payload: {
      requestId: 'reconfirm-six-model-routing-e2e',
      sourceDocumentHash: overrides.sourceDocumentHash ?? SOURCE_HASH,
      implementationConfirmationHash:
        overrides.implementationConfirmationHash ?? IMPLEMENTATION_HASH,
    },
    reduce: (record, payload) => {
      if (
        payload.sourceDocumentHash !== record.sourceDocumentHash ||
        payload.implementationConfirmationHash !== record.implementationConfirmationHash
      ) {
        throw new Error('reconfirmation_ingest_hash_mismatch');
      }
      const requests = ((record.reconfirmationRequests as JsonObject[]) ?? []).map((request) =>
        request.requestId === payload.requestId
          ? { ...request, status: 'controlled_confirmed', closedAt: '2026-05-28T00:00:06.000Z' }
          : request
      );
      return {
        ...record,
        status: 'user_confirmed',
        currentMentalModel: 'requirement_confirmation',
        reconfirmationRequests: requests,
        sixModelResults: {
          ...(record.sixModelResults as JsonObject),
          requirement_confirmation: modelResult('requirement_confirmation', 'pass'),
        },
        confirmationHistory: [
          ...((record.confirmationHistory as unknown[]) ?? []),
          {
            eventType: 'confirmation_recorded',
            recordId: record.recordId,
            requirementSetId: record.requirementSetId,
            confirmedAt: '2026-05-28T00:00:06.000Z',
            confirmedBy: 'six-model-routing-e2e',
            sourcePath: record.sourcePath,
            sourceDocumentHash: payload.sourceDocumentHash,
            implementationConfirmationHash: payload.implementationConfirmationHash,
            confirmationPageHash: PAGE_HASH,
            confirmationText: 'reconfirmed',
            renderReportPath:
              '_bmad-output/runtime/requirement-records/REQSET-SIX-MODEL-ROUTING-E2E/confirmation/reconfirmation-render-report.json',
            htmlPath:
              '_bmad-output/runtime/requirement-records/REQSET-SIX-MODEL-ROUTING-E2E/confirmation/reconfirmation.html',
          },
        ],
        lastEventType: 'confirmation_recorded',
      };
    },
  });
}
