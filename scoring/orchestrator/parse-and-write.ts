/**
 * Story 3.3: parseAndWriteScore 编排
 * Story 4.1: 集成 applyTierAndVeto，在写入前应用 veto 与阶梯系数
 * GAP-B01: 支持 base_commit_hash + content_hash 版本追溯
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseAuditReport } from '../parsers';
import type { AuditStage } from '../parsers';
import { writeScoreRecordSync } from '../writer';
import type { WriteMode } from '../writer';
import { applyTierAndVeto } from '../veto';
import { computeContentHash, computeStringHash, getGitHeadHash } from '../utils/hash';

export interface ParseAndWriteScoreOptions {
  reportPath?: string;
  content?: string;
  stage: AuditStage;
  runId: string;
  scenario: 'real_dev' | 'eval_question';
  writeMode: WriteMode;
  dataPath?: string;
  /** 评测题目版本；scenario=eval_question 时必填（Story 4.3） */
  question_version?: string;
  /** 覆盖 git HEAD hash；未传入时自动获取 */
  baseCommitHash?: string;
  /** 是否跳过自动采集 hash（测试用） */
  skipAutoHash?: boolean;
  /** 被审计源文件路径，用于计算 source_hash 并写入记录（B02） */
  sourceHashFilePath?: string;
}

/**
 * 解析审计报告并写入 scoring 存储。
 * 写入前应用 veto 与阶梯系数（Story 4.1）；reportPath 与 content 二选一。
 * 自动采集 base_commit_hash（git HEAD）和 content_hash（审计内容 SHA-256）。
 */
export async function parseAndWriteScore(options: ParseAndWriteScoreOptions): Promise<void> {
  const { stage, runId, scenario, writeMode, dataPath } = options;
  let content = options.content;

  if (options.reportPath) {
    const reportPath = path.isAbsolute(options.reportPath)
      ? options.reportPath
      : path.resolve(process.cwd(), options.reportPath);
    content = fs.readFileSync(reportPath, 'utf-8');
  }

  if (content == null || content === '') {
    throw new Error('parseAndWriteScore: reportPath or content must be provided');
  }

  const record = await parseAuditReport({
    content,
    stage,
    runId,
    scenario,
  });

  const rawScore = record.phase_score;
  const { phase_score, veto_triggered, tier_coefficient } = applyTierAndVeto(
    { ...record, raw_phase_score: rawScore },
    { rulesDir: path.join(process.cwd(), 'scoring', 'rules') }
  );

  const baseCommitHash = options.skipAutoHash
    ? options.baseCommitHash
    : (options.baseCommitHash ?? getGitHeadHash());
  const contentHash = options.skipAutoHash
    ? undefined
    : computeStringHash(content);

  let sourceHash: string | undefined;
  if (options.sourceHashFilePath) {
    const resolved = path.isAbsolute(options.sourceHashFilePath)
      ? options.sourceHashFilePath
      : path.resolve(process.cwd(), options.sourceHashFilePath);
    sourceHash = computeContentHash(resolved);
  }

  const recordToWrite = {
    ...record,
    phase_score,
    veto_triggered,
    tier_coefficient,
    ...(options.question_version != null ? { question_version: options.question_version } : {}),
    ...(baseCommitHash != null ? { base_commit_hash: baseCommitHash } : {}),
    ...(contentHash != null ? { content_hash: contentHash } : {}),
    ...(sourceHash != null ? { source_hash: sourceHash } : {}),
  };

  writeScoreRecordSync(recordToWrite, writeMode, dataPath != null ? { dataPath } : undefined);
}
