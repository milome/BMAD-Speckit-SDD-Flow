/**
 * Story 4.1: veto 与阶梯模块
 * 导出 applyTierAndVeto、evaluateEpicVeto、getTierCoefficient、isVetoTriggered、buildVetoItemIds
 */
import type { RunScoreRecord } from '../writer/types';
import { isVetoTriggered, buildVetoItemIds } from './veto';
import { getTierCoefficient, applyTierToPhaseScore } from './tier';

export { isVetoTriggered, buildVetoItemIds } from './veto';
export { getTierCoefficient, applyTierToPhaseScore } from './tier';
export { evaluateEpicVeto } from './epic-veto';
export type { EpicVetoInput, EpicStoryRecord } from './types';

export interface ApplyTierAndVetoOptions {
  rulesDir?: string;
}

export interface ApplyTierAndVetoResult {
  phase_score: number;
  veto_triggered: boolean;
  tier_coefficient: number;
}

/**
 * 先判定 veto，若触发则 phase_score=0；否则应用阶梯系数。
 * raw_phase_score 由调用方传入；若无则用 phase_score 作基数（文档化限制：可能重复应用阶梯，调用方需避免）。
 */
export function applyTierAndVeto(
  record: RunScoreRecord & { raw_phase_score?: number },
  options?: ApplyTierAndVetoOptions
): ApplyTierAndVetoResult {
  const opts = options ?? {};
  const vetoIds = buildVetoItemIds(opts);
  const triggered = isVetoTriggered(record.check_items, vetoIds);

  if (triggered) {
    const tier = getTierCoefficient(record, opts);
    return {
      phase_score: 0,
      veto_triggered: true,
      tier_coefficient: tier,
    };
  }

  const raw = record.raw_phase_score ?? record.phase_score;
  const tier = getTierCoefficient(record, opts);
  const phaseScore = applyTierToPhaseScore(raw, record, opts);
  return {
    phase_score: phaseScore,
    veto_triggered: false,
    tier_coefficient: tier,
  };
}
