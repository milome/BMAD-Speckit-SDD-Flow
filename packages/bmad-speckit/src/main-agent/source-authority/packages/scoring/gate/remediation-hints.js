"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGateRemediationHints = buildGateRemediationHints;
const journey_contract_remediation_1 = require("../analytics/journey-contract-remediation");
/**
 * Gate remediation hint 入口：从评分记录提取 Journey contract 定向整改建议。
 * @param {RunScoreRecord[]} records - 评分记录
 * @returns {JourneyContractRemediationHint[]} remediation hints
 */
function buildGateRemediationHints(records) {
    return (0, journey_contract_remediation_1.buildJourneyContractRemediationHints)(records);
}
