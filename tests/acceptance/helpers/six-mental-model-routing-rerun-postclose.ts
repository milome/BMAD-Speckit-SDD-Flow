import { appendControlEventAndReplay } from '../../../scripts/requirement-record-control-store';
import {
  type JsonObject,
  type MentalModel,
  PAGE_HASH,
  modelResults,
} from './six-mental-model-routing-fixture';

function assertNoOpenRerunLoops(record: JsonObject): void {
  const latestById = new Map<string, JsonObject>();
  for (const loop of (record.rerunLoops as JsonObject[]) ?? []) {
    latestById.set(String(loop.rerunLoopId), loop);
  }
  const openLoop = [...latestById.values()].find((loop) =>
    ['open', 'in_progress', 'no_progress', 'blocked'].includes(String(loop.status))
  );
  if (openLoop) {
    throw new Error('mental_model_transition_blocked_by_open_rerun_loop');
  }
}

export function openRerunLoop(recordPath: string, model: MentalModel): void {
  appendControlEventAndReplay({
    recordPath,
    writerId: 'controlled-rerun-loop-writer',
    eventType: 'rerun_loop_recorded',
    recordedAt: '2026-05-28T00:00:07.000Z',
    payload: {
      rerunLoopId: `rerun-${model}`,
      status: 'in_progress',
      sourceRefs: [{ sourceType: 'gate_check', id: `${model}:blocked` }],
      blockerRefs: [{ sourceType: 'failure_record', id: `${model}:blocked` }],
    },
    reduce: (record, payload) => ({
      ...record,
      rerunLoops: [...((record.rerunLoops as unknown[]) ?? []), payload],
      lastEventType: 'rerun_loop_recorded',
    }),
  });
}

export function resolveRerunLoop(recordPath: string, model: MentalModel): void {
  appendControlEventAndReplay({
    recordPath,
    writerId: 'controlled-rerun-loop-writer',
    eventType: 'rerun_loop_recorded',
    recordedAt: '2026-05-28T00:00:08.000Z',
    payload: {
      rerunLoopId: `rerun-${model}`,
      status: 'resolved',
      sourceRefs: [{ sourceType: 'failure_record', id: `${model}:blocked` }],
      recheckRefs: [{ sourceType: 'gate_check', id: `${model}:rerun-pass` }],
    },
    reduce: (record, payload) => ({
      ...record,
      rerunLoops: [...((record.rerunLoops as unknown[]) ?? []), payload],
      lastEventType: 'rerun_loop_recorded',
    }),
  });
}

export function transitionAfterRerun(
  recordPath: string,
  fromModel: MentalModel,
  toModel: MentalModel
): void {
  appendControlEventAndReplay({
    recordPath,
    writerId: 'controlled-six-model-transition-writer',
    eventType: 'mental_model_transition_recorded',
    recordedAt: '2026-05-28T00:00:09.000Z',
    payload: {
      eventType: 'mental_model_transition_recorded',
      fromModel,
      toModel,
      recordedAt: '2026-05-28T00:00:09.000Z',
      recordedBy: 'six-model-routing-e2e',
      sourceRefs: [
        { sourceType: 'model_result', id: fromModel },
        { sourceType: 'rerun_loop', id: `rerun-${fromModel}` },
      ],
    },
    reduce: (record, payload) => {
      assertNoOpenRerunLoops(record);
      if ((modelResults(record)[payload.fromModel as string] as JsonObject).status !== 'pass') {
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

export function recordPostCloseCarrier(
  recordPath: string,
  attemptedControlMutation: Partial<{
    currentMentalModel: string;
    status: string;
    sixModelResults: JsonObject;
    closeout: JsonObject;
  }> = {}
): void {
  appendControlEventAndReplay({
    recordPath,
    writerId: 'post-close-defect-intake-carrier',
    eventType: 'post_close_revalidation_carrier_recorded',
    recordedAt: '2026-05-28T00:00:10.000Z',
    payload: {
      carrierId: 'post-close-carrier-six-model-routing-e2e',
      originRecordId: 'REQ-SIX-MODEL-ROUTING-E2E',
      classification: 'post_close_revalidation_required',
      decision: 'blocked',
      sourceRefs: [{ sourceType: 'record_closed', id: 'closeout-six-model-routing-e2e' }],
      attemptedControlMutation,
    },
    reduce: (record, payload) => {
      if (Object.keys((payload.attemptedControlMutation as JsonObject) ?? {}).length > 0) {
        throw new Error('post_close_carrier_cannot_mutate_control_fields');
      }
      return {
        ...record,
        artifactIndex: [
          ...((record.artifactIndex as unknown[]) ?? []),
          {
            eventType: 'artifact_indexed',
            artifactType: 'post_close_revalidation_carrier',
            sourceOfTruthRole: 'evidence',
            recordId: record.recordId,
            requirementSetId: record.requirementSetId,
            path: '_bmad-output/runtime/requirement-records/REQ-SIX-MODEL-ROUTING-E2E/post-close/post-close-carrier-six-model-routing-e2e.json',
            contentHash: PAGE_HASH,
            producer: 'post-close-defect-intake-carrier',
            purpose: 'prove post-close defect is carried outside origin record mutation',
            relatedRequirementIds: ['post-close-defect-intake'],
            status: 'active',
            inputVersion: 'record-closed',
            outputVersion: 'post-close-carrier',
          },
        ],
        lastEventType: 'post_close_revalidation_carrier_recorded',
      };
    },
  });
}
