export type RuntimeRunStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'vetoed'
  | 'skipped';

export interface RuntimeScopeRef {
  story_key?: string;
  epic_id?: string;
  story_id?: string;
  flow?: string;
  template_id?: string;
  artifact_root?: string;
  resolved_context_path?: string;
}

export interface RuntimeEventSourceRef {
  source_path?: string;
  base_commit_hash?: string;
  content_hash?: string;
}

export interface RuntimeEvent {
  event_id: string;
  event_type: string;
  event_version: number;
  timestamp: string;
  run_id: string;
  flow?: string | null;
  stage?: string | null;
  scope?: RuntimeScopeRef | null;
  payload: Record<string, unknown>;
  source?: RuntimeEventSourceRef;
}

export interface RuntimeScoreRef {
  score_record_id?: string;
  stage?: string | null;
  path?: string;
  timestamp?: string;
}

export interface RuntimeArtifactRef {
  kind?: string;
  path: string;
  content_hash?: string;
}

export interface RuntimeDatasetCandidateRef {
  sample_id: string;
  status?: 'accepted' | 'rejected' | 'downgraded';
  split_assignment?: 'train' | 'validation' | 'test' | 'holdout';
}

export interface RuntimeStageProjection {
  stage: string;
  status: RuntimeRunStatus;
  started_at?: string;
  completed_at?: string;
}

export interface RuntimeRunProjection {
  run_id: string;
  status: RuntimeRunStatus;
  current_stage: string | null;
  current_scope: RuntimeScopeRef | null;
  stage_history: RuntimeStageProjection[];
  score_refs: RuntimeScoreRef[];
  artifact_refs: RuntimeArtifactRef[];
  dataset_candidate_refs: RuntimeDatasetCandidateRef[];
  last_event_at: string | null;
}
