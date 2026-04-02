import type {
  RuntimeArtifactRef,
  RuntimeDatasetCandidateRef,
  RuntimeEvent,
  RuntimeRunProjection,
  RuntimeRunStatus,
  RuntimeScopeRef,
  RuntimeScoreRef,
  RuntimeStageProjection,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isRuntimeRunStatus(value: unknown): value is RuntimeRunStatus {
  return (
    value === 'pending' ||
    value === 'running' ||
    value === 'passed' ||
    value === 'failed' ||
    value === 'vetoed' ||
    value === 'skipped'
  );
}

function compareEvents(left: RuntimeEvent, right: RuntimeEvent): number {
  const byTimestamp = left.timestamp.localeCompare(right.timestamp);
  if (byTimestamp !== 0) {
    return byTimestamp;
  }

  const order: Record<string, number> = {
    'run.created': 0,
    'run.scope.changed': 1,
    'stage.started': 2,
    'artifact.attached': 3,
    'score.written': 4,
    'sft.candidate.built': 5,
    'stage.completed': 6,
    'stage.failed': 7,
    'stage.vetoed': 8,
  };

  const leftRank = order[left.event_type] ?? 99;
  const rightRank = order[right.event_type] ?? 99;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return left.event_id.localeCompare(right.event_id);
}

function mergeScope(
  currentScope: RuntimeScopeRef | null,
  eventScope: RuntimeEvent['scope']
): RuntimeScopeRef | null {
  if (eventScope == null) {
    return currentScope;
  }

  const normalizedEventScope = Object.fromEntries(
    Object.entries(eventScope).filter(([, value]) => value !== undefined)
  ) as RuntimeScopeRef;

  return {
    ...(currentScope ?? {}),
    ...normalizedEventScope,
  };
}

function upsertStageProjection(
  stageHistory: RuntimeStageProjection[],
  stage: string,
  patch: Partial<RuntimeStageProjection>
): void {
  const existing = stageHistory.find((item) => item.stage === stage);
  if (existing) {
    Object.assign(existing, patch);
    return;
  }

  stageHistory.push({
    stage,
    status: 'pending',
    ...patch,
  });
}

function maybePushScoreRef(
  scoreRefs: RuntimeScoreRef[],
  event: RuntimeEvent
): void {
  if (!isRecord(event.payload)) {
    return;
  }

  const scoreRecordId =
    typeof event.payload.score_record_id === 'string'
      ? event.payload.score_record_id
      : undefined;
  const recordPath =
    typeof event.payload.path === 'string'
      ? event.payload.path
      : undefined;

  if (!scoreRecordId && !recordPath) {
    return;
  }

  scoreRefs.push({
    score_record_id: scoreRecordId,
    stage: event.stage ?? null,
    path: recordPath,
    timestamp: event.timestamp,
  });
}

function maybePushArtifactRef(
  artifactRefs: RuntimeArtifactRef[],
  event: RuntimeEvent
): void {
  if (!isRecord(event.payload) || typeof event.payload.path !== 'string') {
    return;
  }

  artifactRefs.push({
    kind: typeof event.payload.kind === 'string' ? event.payload.kind : undefined,
    path: event.payload.path,
    content_hash:
      typeof event.payload.content_hash === 'string'
        ? event.payload.content_hash
        : undefined,
  });
}

function maybePushDatasetCandidateRef(
  candidateRefs: RuntimeDatasetCandidateRef[],
  event: RuntimeEvent
): void {
  if (!isRecord(event.payload) || typeof event.payload.sample_id !== 'string') {
    return;
  }

  candidateRefs.push({
    sample_id: event.payload.sample_id,
    status:
      event.payload.status === 'accepted' ||
      event.payload.status === 'rejected' ||
      event.payload.status === 'downgraded'
        ? event.payload.status
        : undefined,
    split_assignment:
      event.payload.split_assignment === 'train' ||
      event.payload.split_assignment === 'validation' ||
      event.payload.split_assignment === 'test' ||
      event.payload.split_assignment === 'holdout'
        ? event.payload.split_assignment
        : undefined,
  });
}

function createEmptyProjection(runId: string): RuntimeRunProjection {
  return {
    run_id: runId,
    status: 'pending',
    current_stage: null,
    current_scope: null,
    stage_history: [],
    score_refs: [],
    artifact_refs: [],
    dataset_candidate_refs: [],
    last_event_at: null,
  };
}

export function buildRunProjection(
  events: RuntimeEvent[],
  runId: string
): RuntimeRunProjection | null {
  const relevantEvents = events
    .filter((event) => event.run_id === runId)
    .sort(compareEvents);

  if (relevantEvents.length === 0) {
    return null;
  }

  const projection = createEmptyProjection(runId);

  for (const event of relevantEvents) {
    projection.last_event_at = event.timestamp;
    projection.current_scope = mergeScope(projection.current_scope, event.scope);

    switch (event.event_type) {
      case 'run.created': {
        if (isRecord(event.payload) && isRuntimeRunStatus(event.payload.status)) {
          projection.status = event.payload.status;
        }
        break;
      }
      case 'run.scope.changed': {
        projection.current_scope = mergeScope(projection.current_scope, event.scope);
        break;
      }
      case 'stage.started': {
        if (event.stage) {
          projection.current_stage = event.stage;
          projection.status = 'running';
          upsertStageProjection(projection.stage_history, event.stage, {
            status: 'running',
            started_at: event.timestamp,
          });
        }
        break;
      }
      case 'stage.completed': {
        if (event.stage) {
          const nextStatus =
            isRecord(event.payload) && isRuntimeRunStatus(event.payload.status)
              ? event.payload.status
              : 'passed';
          projection.current_stage = event.stage;
          projection.status = nextStatus;
          upsertStageProjection(projection.stage_history, event.stage, {
            status: nextStatus,
            completed_at: event.timestamp,
          });
        }
        break;
      }
      case 'stage.failed': {
        if (event.stage) {
          projection.current_stage = event.stage;
          projection.status = 'failed';
          upsertStageProjection(projection.stage_history, event.stage, {
            status: 'failed',
            completed_at: event.timestamp,
          });
        }
        break;
      }
      case 'stage.vetoed': {
        if (event.stage) {
          projection.current_stage = event.stage;
          projection.status = 'vetoed';
          upsertStageProjection(projection.stage_history, event.stage, {
            status: 'vetoed',
            completed_at: event.timestamp,
          });
        }
        break;
      }
      case 'score.written': {
        maybePushScoreRef(projection.score_refs, event);
        break;
      }
      case 'artifact.attached': {
        maybePushArtifactRef(projection.artifact_refs, event);
        break;
      }
      case 'sft.candidate.built': {
        maybePushDatasetCandidateRef(projection.dataset_candidate_refs, event);
        break;
      }
      default:
        break;
    }
  }

  return projection;
}
