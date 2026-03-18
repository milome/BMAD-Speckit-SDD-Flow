import { PHASE_WEIGHTS, PHASE_MAX_SCORES, LEVEL_RANGES } from '../constants/weights';

/**
 * 综合得分 = Σ(环节得分/满分 × 对应权重) × 100，0–100 分（需求 §3.2）
 * 环节得分为 0–满分，按权重参与综合分计算
 * @param {number[]} phaseScores - 六个环节得分
 * @returns {number} 0–100 综合分
 */
export function computeCompositeScore(phaseScores: number[]): number {
  if (phaseScores.length !== 6) {
    throw new Error('phaseScores must have exactly 6 elements');
  }
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    sum += (phaseScores[i] / PHASE_MAX_SCORES[i]) * PHASE_WEIGHTS[i];
  }
  return Math.round(sum * 10000) / 100;
}

/**
 * 四能力维度聚合（需求 §3.2）
 * 需求与设计=环节1；代码与工程=环节2+5；质量与闭环=环节3+4；端到端=环节6
 * @param {number[]} phaseScores - 六个环节得分
 * @returns {Record<string, number>} 四能力维度分数
 */
export function aggregateFourDimensions(phaseScores: number[]): Record<string, number> {
  if (phaseScores.length !== 6) {
    throw new Error('phaseScores must have exactly 6 elements');
  }
  const [p1, p2, p3, p4, p5, p6] = phaseScores;
  return {
    '需求与设计能力': p1,
    '代码与工程能力': Math.round((p2 * 0.25 + p5 * 0.1) / 0.35 * 100) / 100,
    '质量与闭环能力': Math.round((p3 * 0.25 + p4 * 0.15) / 0.4 * 100) / 100,
    '端到端交付能力': p6,
  };
}

/**
 * 综合分 → L1–L5 等级。边界值归属高等级（如 90 归属 L5）
 * @param {number} score - 综合得分
 * @returns {string} L1–L5 等级
 */
export function scoreToLevel(score: number): string {
  for (const { min, max, level } of LEVEL_RANGES) {
    if (score >= min && score <= max) return level;
  }
  return score >= 90 ? 'L5' : score < 40 ? 'L1' : 'L3';
}
