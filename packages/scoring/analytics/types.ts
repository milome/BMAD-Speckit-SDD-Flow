export type CanonicalMessageRole = 'system' | 'user' | 'assistant' | 'tool';
export type CanonicalAcceptanceDecision = 'accepted' | 'rejected' | 'downgraded';
export type CanonicalSplitAssignment = 'train' | 'validation' | 'test' | 'holdout';
export type RedactionStatus = 'clean' | 'redacted' | 'blocked';

export interface CanonicalArtifactRef {
  path: string;
  content_hash: string;
  source_hash?: string;
  kind?: string;
}

export interface CanonicalSourceRef {
  run_id: string;
  stage: string;
  flow: string;
  epic_id?: string;
  story_id?: string;
  story_slug?: string;
  event_ids: string[];
  score_record_id?: string;
  artifact_refs: CanonicalArtifactRef[];
}

export interface CanonicalToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface CanonicalMessage {
  role: CanonicalMessageRole;
  content: string | Array<{ type: 'text'; text: string }>;
  name?: string;
  tool_call_id?: string;
  tool_calls?: CanonicalToolCall[];
  weight?: 0 | 1;
  metadata?: Record<string, unknown>;
}

export interface CanonicalTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface CanonicalMetadata {
  schema_targets: Array<'openai_chat' | 'hf_conversational' | 'hf_tool_calling'>;
  sample_kind?: 'implementation' | 'documentation';
  host?: string;
  language?: string;
  tags?: string[];
  notes?: string[];
}

export interface CanonicalQuality {
  acceptance_decision: CanonicalAcceptanceDecision;
  phase_score: number | null;
  raw_phase_score: number | null;
  dimension_scores?: Record<string, number>;
  dimension_floors?: Record<string, number>;
  veto_triggered: boolean;
  iteration_count: number;
  has_code_pair: boolean;
  token_estimate: number;
  dedupe_cluster_id: string | null;
  safety_flags: string[];
  rejection_reasons: string[];
  warnings: string[];
}

export interface CanonicalProvenance {
  base_commit_hash: string | null;
  content_hash: string | null;
  source_hash: string | null;
  source_path: string | null;
  patch_ref: string | null;
  lineage: string[];
  generated_at: string;
}

export interface CanonicalSplit {
  assignment: CanonicalSplitAssignment;
  seed: number;
  strategy: string;
  group_key: string | null;
}

export interface CanonicalRedactionFinding {
  kind: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  field_path: string;
  action?: string;
}

export interface CanonicalRedaction {
  status: RedactionStatus;
  applied_rules: string[];
  findings: CanonicalRedactionFinding[];
  redacted_fields: string[];
}

export interface ExportDecision {
  compatible: boolean;
  reasons: string[];
  warnings: string[];
}

export interface ExportCompatibility {
  openai_chat: ExportDecision;
  hf_conversational: ExportDecision;
  hf_tool_calling: ExportDecision;
}

export interface CanonicalSftSample {
  sample_id: string;
  sample_version: 'v1';
  source: CanonicalSourceRef;
  messages: CanonicalMessage[];
  tools?: CanonicalTool[];
  metadata: CanonicalMetadata;
  quality: CanonicalQuality;
  provenance: CanonicalProvenance;
  split: CanonicalSplit;
  redaction: CanonicalRedaction;
  export_compatibility: ExportCompatibility;
}

export interface DatasetBundleManifest {
  bundle_id: string;
  export_target: 'openai_chat' | 'hf_conversational' | 'hf_tool_calling';
  created_at: string;
  canonical_schema_version: 'v1';
  exporter_version: string;
  export_hash: string;
  filter_settings: {
    min_score?: number;
    drop_no_code_pair?: boolean;
    max_tokens?: number;
  };
  split: {
    seed: number;
    strategy: string;
  };
  counts: {
    accepted: number;
    rejected: number;
    train: number;
    validation: number;
    test: number;
  };
  artifacts: {
    train_path: string;
    validation_path: string;
    test_path: string;
    manifest_path: string;
    validation_report_path: string;
    rejection_report_path: string;
  };
}
