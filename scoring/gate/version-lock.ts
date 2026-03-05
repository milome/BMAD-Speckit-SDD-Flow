/**
 * B02: 版本锁定校验
 * specify→plan 流转时比对 source_hash，hash 匹配→proceed；不匹配→block；异常→warn_and_proceed
 */
import * as fs from 'fs';
import * as path from 'path';
import { computeContentHash } from '../utils/hash';
import type { RunScoreRecord } from '../writer/types';

export interface VersionLockResult {
  passed: boolean;
  action: 'proceed' | 'warn_and_proceed' | 'block';
  actual_hash: string;
  expected_hash: string;
  preconditionFile: string;
  reason: string;
}

/**
 * 校验前置阶段源文件的 hash 是否与上一阶段审计记录中的 source_hash 一致。
 * hash 匹配→proceed；不匹配→block；异常→warn_and_proceed。
 * expectedHash 为空或未提供时，视为上一阶段无记录，返回 warn_and_proceed。
 */
export function checkPreconditionHash(
  _currentStage: string,
  preconditionFile: string,
  expectedHash: string | null | undefined
): VersionLockResult {
  if (expectedHash == null || expectedHash.trim() === '') {
    return {
      passed: true,
      action: 'warn_and_proceed',
      actual_hash: '',
      expected_hash: '',
      preconditionFile,
      reason: 'no prior record',
    };
  }

  try {
    const resolved = path.isAbsolute(preconditionFile)
      ? preconditionFile
      : path.resolve(process.cwd(), preconditionFile);
    if (!fs.existsSync(resolved)) {
      return {
        passed: false,
        action: 'block',
        actual_hash: '',
        expected_hash: expectedHash,
        preconditionFile: resolved,
        reason: `file not found: ${resolved}`,
      };
    }
    const actualHash = computeContentHash(resolved);
    if (actualHash === expectedHash) {
      return {
        passed: true,
        action: 'proceed',
        actual_hash: actualHash,
        expected_hash: expectedHash,
        preconditionFile: resolved,
        reason: 'hash matched',
      };
    }
    return {
      passed: false,
      action: 'block',
      actual_hash: actualHash,
      expected_hash: expectedHash,
      preconditionFile: resolved,
      reason: 'hash mismatch',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      passed: true,
      action: 'warn_and_proceed',
      actual_hash: '',
      expected_hash: expectedHash,
      preconditionFile,
      reason: `internal error: ${msg}`,
    };
  }
}

/**
 * 从 scoring/data/ 目录中查找指定 stage 的最新记录。
 * 扫描 *.json 文件（排除 scores.jsonl），按 timestamp 降序取最新。
 */
export function loadLatestRecordByStage(stage: string, dataPath?: string): RunScoreRecord | null {
  const base = dataPath ?? path.resolve(process.cwd(), 'scoring', 'data');
  let dir: string[];
  try {
    dir = fs.readdirSync(base);
  } catch {
    return null;
  }
  const records: RunScoreRecord[] = [];
  for (const f of dir) {
    if (!f.endsWith('.json') || f === 'scores.jsonl') continue;
    const fp = path.join(base, f);
    try {
      const content = fs.readFileSync(fp, 'utf-8');
      const r = JSON.parse(content) as RunScoreRecord;
      if (r.stage === stage && r.timestamp) {
        records.push(r);
      }
    } catch {
      // 解析失败则跳过
    }
  }
  records.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
  return records[0] ?? null;
}
