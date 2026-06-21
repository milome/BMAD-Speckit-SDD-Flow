"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildJourneyContractRemediationHintsFromSummary = buildJourneyContractRemediationHintsFromSummary;
exports.buildJourneyContractRemediationHints = buildJourneyContractRemediationHints;
const journey_contract_signals_1 = require("./journey-contract-signals");
const JOURNEY_CONTRACT_RECOMMENDATIONS = {
    smoke_task_chain: 'Add at least one smoke task chain per Journey Slice and point setup tasks to that chain.',
    closure_task_id: 'Add one closure note task for each Journey Slice and link it to the same smoke path evidence chain.',
    journey_unlock: 'Update setup and foundation tasks to state exactly which journey and smoke path they unlock.',
    gap_split_contract: 'Split definition gap tasks from implementation gap tasks inside each Journey Slice.',
    shared_path_reference: 'Require multi-agent tasks to reference the same journey ledger, invariant ledger, and trace map paths.',
};
/**
 * 将 Journey contract 聚合摘要转换成可执行整改 hints。
 * @param {JourneyContractSignalSummary[]} summary - Journey contract 聚合摘要
 * @returns {JourneyContractRemediationHint[]} remediation hints
 */
function buildJourneyContractRemediationHintsFromSummary(summary) {
    return summary.map((item) => ({
        ...item,
        recommendation: JOURNEY_CONTRACT_RECOMMENDATIONS[item.signal],
    }));
}
/**
 * 直接从评分记录构建 Journey contract remediation hints。
 * @param {RunScoreRecord[]} records - 评分记录
 * @returns {JourneyContractRemediationHint[]} remediation hints
 */
function buildJourneyContractRemediationHints(records) {
    return buildJourneyContractRemediationHintsFromSummary((0, journey_contract_signals_1.summarizeJourneyContractSignals)(records));
}
