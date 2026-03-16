/**
 * Story 4.1 T2: 阶梯系数计算
 * 先应用 severity_override（fatal≥3→0，serious≥2→降一档），再按 iteration_count 查 iteration_tier
 */
import type { RunScoreRecord } from '../writer/types';
import { loadIterationTierYaml } from '../parsers/rules';
import * as path from 'path';

function getRulesDir(options?: { rulesDir?: string }): string {
  if (options?.rulesDir) return options.rulesDir;
  return path.join(process.cwd(), 'packages', 'scoring', 'rules');
}

/**
 * 从 iteration_records 统计 severity 出现次数（result=fail 的才计整改）
 * @param {{ result: string; severity: string }[]} records - iteration_records 数组
 * @param {string} severity - severity 级别
 * @returns {number} 出现次数
 */
function countSeverityFails(records: { result: string; severity: string }[], severity: string): number {
  return records.filter((r) => r.result === 'fail' && r.severity === severity).length;
}

/**
 * iteration_count 映射到 tier: 0->1, 1->2, 2->3, >=3->4
 * @param {number} iterationCount - 迭代次数
 * @returns {number} tier 级别
 */
function getTierFromIterationCount(iterationCount: number): number {
  return Math.min(iterationCount + 1, 4);
}

/**
 * Get tier coefficient for phase_score. Checks severity_override first, then iteration_tier.
 * @param {RunScoreRecord} record - RunScoreRecord with iteration_records
 * @param {{ rulesDir?: string }} [options] - rulesDir for iteration-tier.yaml
 * @param {string} [options.rulesDir] - Optional rules directory path
 * @returns {number} Coefficient (0-1)
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
 * Apply tier coefficient to raw score: phase_score = rawScore * getTierCoefficient(record).
 * @param {number} rawScore - Pre-tier raw score
 * @param {RunScoreRecord} record - RunScoreRecord
 * @param {{ rulesDir?: string }} [options] - rulesDir
 * @param {string} [options.rulesDir] - Optional rules directory path
 * @returns {number} Adjusted phase score
 */
export function applyTierToPhaseScore(
  rawScore: number,
  record: RunScoreRecord,
  options?: { rulesDir?: string }
): number {
  const coeff = getTierCoefficient(record, options);
  return Math.round(rawScore * coeff * 100) / 100;
}
