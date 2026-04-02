/**
 * RunScoreRecord: 符合 run-score-schema 的单条评分记录。
 * 与 Story 1.1 的 scoring/schema/run-score-schema.json 一致。
 */
export interface CheckItem {
  item_id: string;
  passed: boolean;
  score_delta: number;
  note?: string;
}

export interface DimensionScore {
  dimension: string;
  weight: number;
  score: number;
}

export interface JourneyContractSignals {
  smoke_task_chain?: boolean;
  closure_task_id?: boolean;
  journey_unlock?: boolean;
  gap_split_contract?: boolean;
  shared_path_reference?: boolean;
}

export interface GovernanceExecutorRoutingRecord {
  routing_mode: 'targeted' | 'generic';
  executor_route: 'journey-contract-remediation' | 'default-gate-remediation';
  prioritized_signals: string[];
}

export interface GovernanceRerunHistoryEntry {
  event_id: string;
  timestamp: string;
  rerun_gate: string;
  outcome: string;
  decision_mode?: 'targeted' | 'generic' | 'idle';
  attempt_id?: string;
  loop_state_id?: string;
  executor_routing?: GovernanceExecutorRoutingRecord;
  summary_lines?: string[];
  runner_summary_lines?: string[];
}

export interface IterationRecord {
  timestamp: string;
  result: 'pass' | 'fail';
  severity: 'fatal' | 'serious' | 'normal' | 'minor';
  note?: string;
  /** Story 9.4: 可解析总体评级 A|B|C|D */
  overall_grade?: string;
  /** Story 9.4: 可解析维度评分 */
  dimension_scores?: DimensionScore[];
}

export interface RunScoreRecord {
  run_id: string;
  scenario: 'real_dev' | 'eval_question';
  stage: string;
  story_key?: string;
  story_id?: string;
  epic_id?: string;
  artifact_root?: string;
  host?: string;
  host_kind?: string;
  phase_score: number;
  phase_weight: number;
  check_items: CheckItem[];
  timestamp: string;
  iteration_count: number;
  iteration_records: IterationRecord[];
  first_pass: boolean;
  dimension_scores?: DimensionScore[];
  path_type?: string;
  model_version?: string;
  question_version?: string;
  /** 评分时 git HEAD 的 commit hash（修改前基线） */
  base_commit_hash?: string;
  /** 传入 parseAndWriteScore 的审计报告内容的 SHA-256（非源文件 hash） */
  content_hash?: string;
  /** 被审计的源文件的 SHA-256 指纹，用于跨阶段版本锁定校验 */
  source_hash?: string;
  /** 稳定 patch snapshot 的内容哈希，供 canonical SFT provenance 复用 */
  patch_ref?: string;
  /** 稳定 patch snapshot 的落盘路径，供 analytics 直接读取 immutable diff */
  patch_snapshot_path?: string;
  /** 触发本次评分的源文档路径，如 BUGFIX 文档（B07 SFT 提取用） */
  source_path?: string;
  /** Story 9.1 T4: 触发阶段标识，如 speckit_5_2、bmad_story_stage4，用于 implement 与 story 阶段区分 */
  trigger_stage?: string;
  /** Wave 1B: 从 dedicated journey contract check_items 派生的结构化信号 */
  journey_contract_signals?: JourneyContractSignals;
  /** 将同一 run 的多条 stage score 归到同一 logical run group；dashboard 兼容字段 */
  run_group_id?: string;
  /** Governance rerun/runtime worker 追加的结构化历史事件 */
  governance_rerun_history?: GovernanceRerunHistoryEntry[];
}

/**
 * 写入模式：仅单文件、仅 JSONL、或同时写入。
 * 单文件下同一 run_id 多次写入为覆盖语义。
 */
export type WriteMode = 'single_file' | 'jsonl' | 'both';

export interface WriteScoreRecordOptions {
  dataPath?: string;
}
