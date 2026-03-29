import { buildJourneyContractRemediationHints } from '../analytics/journey-contract-remediation';
import type { JourneyContractRemediationHint } from '../analytics/journey-contract-remediation';
import type { RunScoreRecord } from '../writer/types';

/**
 * Gate remediation hint 入口：从评分记录提取 Journey contract 定向整改建议。
 * @param {RunScoreRecord[]} records - 评分记录
 * @returns {JourneyContractRemediationHint[]} remediation hints
 */
export function buildGateRemediationHints(
  records: RunScoreRecord[]
): JourneyContractRemediationHint[] {
  return buildJourneyContractRemediationHints(records);
}
