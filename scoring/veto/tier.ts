/**
 * Story 4.1 T2: 阶梯系数计算
 * 先应用 severity_override（fatal≥3→0，serious≥2→降一档），再按 iteration_count 查 iteration_tier
 */
import type { RunScoreRecord } from '../writer/types';
import { loadIterationTierYaml } from '../parsers/rules';
import * as path from 'path';

function getRulesDir(options?: { rulesDir?: string }): string {
  if (options?.rulesDir) return options.rulesDir;
  return path.join(process.cwd(), 'scoring', 'rules');
}

/**
 * 从 iteration_records 统计 severity 出现次数（result=fail 的才计整改）
 */
function countSeverityFails(records: { result: string; severity: string }[], severity: string): number {
  return records.filter((r) => r.result === 'fail' && r.severity === severity).length;
}

/**
 * iteration_count 映射到 tier: 0->1, 1->2, 2->3, >=3->4
 */
function getTierFromIterationCount(iterationCount: number): number {
  return Math.min(iterationCount + 1, 4);
}

/**
 * 获取阶梯系数。先检查 severity_override，再按 iteration_count 查 tier
 */
export function getTierCoefficient(
  record: RunScoreRecord,
  options?: { rulesDir?: string }
): number {
  const dir = getRulesDir(options);
  const yaml = loadIterationTierYaml({ rulesDir: dir });
  const tierMap = yaml.iteration_tier;
  const sevOverride = yaml.severity_override ?? {};

  const fatalThreshold = sevOverride.fatal ?? 3;
  const seriousThreshold = sevOverride.serious ?? 2;

  const fatalCount = countSeverityFails(record.iteration_records, 'fatal');
  if (fatalCount >= fatalThreshold) return 0;

  let tier = getTierFromIterationCount(record.iteration_count);
  const seriousCount = countSeverityFails(record.iteration_records, 'serious');
  if (seriousCount >= seriousThreshold) {
    tier = Math.min(tier + 1, 4);
  }

  return tierMap[tier] ?? 0;
}

/**
 * phase_score = rawScore × getTierCoefficient(record)
 */
export function applyTierToPhaseScore(
  rawScore: number,
  record: RunScoreRecord,
  options?: { rulesDir?: string }
): number {
  const coeff = getTierCoefficient(record, options);
  return Math.round(rawScore * coeff * 100) / 100;
}
