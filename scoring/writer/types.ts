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

export interface IterationRecord {
  timestamp: string;
  result: 'pass' | 'fail';
  severity: 'fatal' | 'serious' | 'normal' | 'minor';
  note?: string;
}

export interface RunScoreRecord {
  run_id: string;
  scenario: 'real_dev' | 'eval_question';
  stage: string;
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
}

/**
 * 写入模式：仅单文件、仅 JSONL、或同时写入。
 * 单文件下同一 run_id 多次写入为覆盖语义。
 */
export type WriteMode = 'single_file' | 'jsonl' | 'both';

export interface WriteScoreRecordOptions {
  dataPath?: string;
}
