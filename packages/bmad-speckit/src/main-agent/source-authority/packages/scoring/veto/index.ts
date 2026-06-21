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
 * Apply veto and tier: if veto triggered, phase_score=0; else apply tier coefficient to raw score.
 * @param {RunScoreRecord & { raw_phase_score?: number }} record - RunScoreRecord; raw_phase_score optional pre-tier base
 * @param {ApplyTierAndVetoOptions} [options] - rulesDir
 * @returns {ApplyTierAndVetoResult} ApplyTierAndVetoResult with phase_score, veto_triggered, tier_coefficient
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
