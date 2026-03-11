/**
 * Story 4.1 T4: Epic 8 项条件判定
 */
import type { EpicVetoInput } from './types';
import { buildVetoItemIds } from './veto';

export interface EvaluateEpicVetoOptions {
  rulesDir?: string;
}

export interface EvaluateEpicVetoResult {
  triggered: boolean;
  triggeredConditions: string[];
}

const CONDITION_IDS = [
  '①_veto_count_ge3',
  '②_delivery_rate_lt80',
  '③_high_risk_vuln_ge2',
  '④_test_pass_rate_lt80',
  '⑤_iter4_fail_ge1',
  '⑥_first_pass_rate_lt50',
  '⑦_iter3_ge2',
  '⑧_fatal_iter3_ge1',
] as const;

/**
 * Evaluate Epic 8 veto conditions.
 * @param {EpicVetoInput} input - EpicVetoInput with storyRecords, counts, testStats
 * @param {EvaluateEpicVetoOptions} [options] - rulesDir for buildVetoItemIds
 * @returns {EvaluateEpicVetoResult} EvaluateEpicVetoResult with triggered flag and triggeredConditions
 */
export function evaluateEpicVeto(
  input: EpicVetoInput,
  options?: EvaluateEpicVetoOptions
): EvaluateEpicVetoResult {
  const triggered: string[] = [];
  const { storyRecords, epicStoryCount, passedStoryCount, testStats } = input;

  // ① 单阶段 veto 次数 ≥3
  const vetoCount = storyRecords.reduce((sum, r) => sum + (r.veto_triggered ? 1 : 0), 0);
  if (vetoCount >= 3) triggered.push(CONDITION_IDS[0]);

  // ② 需求交付率 < 80%
  if (passedStoryCount != null && epicStoryCount > 0) {
    if (passedStoryCount / epicStoryCount < 0.8) triggered.push(CONDITION_IDS[1]);
  }

  // ③ 高危漏洞 ≥ 2
  const vetoIds = buildVetoItemIds(options);
  let highRiskCount = 0;
  for (const r of storyRecords) {
    for (const c of r.check_items) {
      if (vetoIds.has(c.item_id) && !c.passed) highRiskCount++;
    }
  }
  if (highRiskCount >= 2) triggered.push(CONDITION_IDS[2]);

  // ④ 测试通过率 < 80%
  if (testStats != null && testStats.total > 0) {
    if (testStats.passed / testStats.total < 0.8) triggered.push(CONDITION_IDS[3]);
  }

  // ⑤ 整改≥4 次未通过 Story 数 ≥1
  const iter4Fail = storyRecords.filter(
    (r) => r.iteration_count >= 4 && (r.veto_triggered || r.phase_score === 0)
  );
  if (iter4Fail.length >= 1) triggered.push(CONDITION_IDS[4]);

  // ⑥ 一次通过率 < 50%
  const firstPassCount = storyRecords.filter((r) => r.first_pass).length;
  if (epicStoryCount > 0 && firstPassCount / epicStoryCount < 0.5) {
    triggered.push(CONDITION_IDS[5]);
  }

  // ⑦ 整改≥3 次 Story 数 ≥2
  const iter3Count = storyRecords.filter((r) => r.iteration_count >= 3).length;
  if (iter3Count >= 2) triggered.push(CONDITION_IDS[6]);

  // ⑧ 致命问题整改≥3 次 Story 数 ≥1
  const fatalIter3 = storyRecords.filter((r) => {
    const fatalFails = r.iteration_records.filter(
      (rec) => rec.result === 'fail' && rec.severity === 'fatal'
    );
    return fatalFails.length >= 3;
  });
  if (fatalIter3.length >= 1) triggered.push(CONDITION_IDS[7]);

  return {
    triggered: triggered.length > 0,
    triggeredConditions: triggered,
  };
}
