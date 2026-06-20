"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVetoTriggered = isVetoTriggered;
exports.buildVetoItemIds = buildVetoItemIds;
const rules_1 = require("../parsers/rules");
const REF_ITEM_ID_PATTERN = /^code-reviewer-config#([a-zA-Z0-9_]+)$/;
/**
 * Check if any check_item has veto item_id and passed=false.
 * @param {CheckItem[]} checkItems - Check items from parsed report
 * @param {Set<string>} vetoItemIds - Set of veto item_ids from scoring rules
 * @returns {boolean} true if veto triggered
 */
function isVetoTriggered(checkItems, vetoItemIds) {
    return checkItems.some((c) => vetoItemIds.has(c.item_id) && c.passed === false);
}
function extractItemIdFromRef(ref) {
    const m = ref.match(REF_ITEM_ID_PATTERN);
    return m ? m[1] : null;
}
/**
 * Build veto item_id set from phase/stage/gaps scoring YAML veto_items.
 * @param {{ rulesDir?: string }} [options] - rulesDir for YAML lookup
 * @param {string} [options.rulesDir] - Optional rules directory path
 * @returns {Set<string>} Set of veto item_ids
 */
function buildVetoItemIds(options) {
    const ids = new Set();
    const rulesDir = options?.rulesDir ?? undefined;
    for (const phase of [2, 3, 4]) {
        const yaml = (0, rules_1.loadPhaseScoringYaml)(phase, rulesDir ? { rulesDir } : undefined);
        for (const v of yaml.veto_items ?? []) {
            const itemId = extractItemIdFromRef(v.ref);
            if (itemId)
                ids.add(itemId);
        }
    }
    for (const stage of ['spec', 'plan', 'tasks']) {
        const yaml = (0, rules_1.loadStageScoringYaml)(stage, rulesDir ? { rulesDir } : undefined);
        for (const v of yaml.veto_items ?? []) {
            const itemId = extractItemIdFromRef(v.ref);
            if (itemId)
                ids.add(itemId);
        }
    }
    const gaps = (0, rules_1.loadGapsScoringYaml)(rulesDir ? { rulesDir } : undefined);
    for (const v of gaps.veto_items ?? []) {
        const itemId = extractItemIdFromRef(v.ref);
        if (itemId)
            ids.add(itemId);
    }
    return ids;
}
