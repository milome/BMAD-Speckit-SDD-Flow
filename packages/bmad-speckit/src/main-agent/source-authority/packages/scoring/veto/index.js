"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateEpicVeto = exports.applyTierToPhaseScore = exports.getTierCoefficient = exports.buildVetoItemIds = exports.isVetoTriggered = void 0;
exports.applyTierAndVeto = applyTierAndVeto;
const veto_1 = require("./veto");
const tier_1 = require("./tier");
var veto_2 = require("./veto");
Object.defineProperty(exports, "isVetoTriggered", { enumerable: true, get: function () { return veto_2.isVetoTriggered; } });
Object.defineProperty(exports, "buildVetoItemIds", { enumerable: true, get: function () { return veto_2.buildVetoItemIds; } });
var tier_2 = require("./tier");
Object.defineProperty(exports, "getTierCoefficient", { enumerable: true, get: function () { return tier_2.getTierCoefficient; } });
Object.defineProperty(exports, "applyTierToPhaseScore", { enumerable: true, get: function () { return tier_2.applyTierToPhaseScore; } });
var epic_veto_1 = require("./epic-veto");
Object.defineProperty(exports, "evaluateEpicVeto", { enumerable: true, get: function () { return epic_veto_1.evaluateEpicVeto; } });
/**
 * Apply veto and tier: if veto triggered, phase_score=0; else apply tier coefficient to raw score.
 * @param {RunScoreRecord & { raw_phase_score?: number }} record - RunScoreRecord; raw_phase_score optional pre-tier base
 * @param {ApplyTierAndVetoOptions} [options] - rulesDir
 * @returns {ApplyTierAndVetoResult} ApplyTierAndVetoResult with phase_score, veto_triggered, tier_coefficient
 */
function applyTierAndVeto(record, options) {
    const opts = options ?? {};
    const vetoIds = (0, veto_1.buildVetoItemIds)(opts);
    const triggered = (0, veto_1.isVetoTriggered)(record.check_items, vetoIds);
    if (triggered) {
        const tier = (0, tier_1.getTierCoefficient)(record, opts);
        return {
            phase_score: 0,
            veto_triggered: true,
            tier_coefficient: tier,
        };
    }
    const raw = record.raw_phase_score ?? record.phase_score;
    const tier = (0, tier_1.getTierCoefficient)(record, opts);
    const phaseScore = (0, tier_1.applyTierToPhaseScore)(raw, record, opts);
    return {
        phase_score: phaseScore,
        veto_triggered: false,
        tier_coefficient: tier,
    };
}
