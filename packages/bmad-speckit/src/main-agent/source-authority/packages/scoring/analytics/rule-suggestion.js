"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRuleSuggestions = generateRuleSuggestions;
exports.formatRuleSuggestionsYaml = formatRuleSuggestionsYaml;
/**
 * Story 5.5 B09: 规则自优化建议
 * 根据 clusterWeaknesses 与 records 统计，输出 rule-upgrade-suggestions.yaml
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const path_1 = require("../constants/path");
function loadItemDeducts(rulesDir) {
    const map = new Map();
    if (!fs.existsSync(rulesDir))
        return map;
    const entries = fs.readdirSync(rulesDir);
    for (const name of entries) {
        if (!name.endsWith('-scoring.yaml'))
            continue;
        try {
            const content = fs.readFileSync(path.join(rulesDir, name), 'utf-8');
            const doc = js_yaml_1.default.load(content);
            const items = doc?.items ?? [];
            for (const it of items) {
                const id = it.id ?? it.ref;
                if (id && typeof it.deduct === 'number') {
                    map.set(id, it.deduct);
                }
            }
        }
        catch {
            // skip invalid
        }
    }
    return map;
}
function countItemAppearances(records) {
    const map = new Map();
    for (const rec of records) {
        const items = rec.check_items ?? [];
        for (const ci of items) {
            const id = ci.item_id;
            map.set(id, (map.get(id) ?? 0) + 1);
        }
    }
    return map;
}
/**
 * 根据聚类与记录统计生成规则升级建议。
 * 不修改规则文件，仅输出 YAML 建议。
 * @param {WeaknessCluster[]} clusters - 弱点聚类结果
 * @param {RunScoreRecord[]} records - 评分记录
 * @param {string} [rulesDir] - scoring/rules 目录，默认 cwd/scoring/rules
 * @returns {RuleSuggestion[]} 规则升级建议列表
 */
function generateRuleSuggestions(clusters, records, rulesDir) {
    const rulesPath = rulesDir ?? (0, path_1.resolveRulesDir)();
    const itemDeducts = loadItemDeducts(rulesPath);
    const evidenceTotals = countItemAppearances(records);
    const existingIds = new Set(itemDeducts.keys());
    const suggestions = [];
    for (const cluster of clusters) {
        const evidenceCount = cluster.frequency;
        for (const itemId of cluster.primary_item_ids ?? []) {
            const total = evidenceTotals.get(itemId) ?? 0;
            if (total === 0)
                continue;
            const failureRate = evidenceCount / total;
            const currentDeduct = itemDeducts.get(itemId) ?? 0;
            if (failureRate > 0.8) {
                suggestions.push({
                    item_id: itemId,
                    current_deduct: currentDeduct,
                    suggested_deduct: 0,
                    action: 'promote_to_veto',
                    reason: `Failure rate ${(failureRate * 100).toFixed(1)}% > 80%`,
                    evidence_count: evidenceCount,
                    evidence_total: total,
                });
            }
            else if (failureRate > 0.5 && currentDeduct < 8) {
                suggestions.push({
                    item_id: itemId,
                    current_deduct: currentDeduct,
                    suggested_deduct: currentDeduct + 2,
                    action: 'increase_deduct',
                    reason: `Failure rate ${(failureRate * 100).toFixed(1)}% > 50% and deduct=${currentDeduct} < 8`,
                    evidence_count: evidenceCount,
                    evidence_total: total,
                });
            }
        }
        const keywords = cluster.keywords ?? [];
        const keywordMatch = keywords.some((kw) => {
            const lower = kw.toLowerCase();
            return [...existingIds].some((id) => id.toLowerCase().includes(lower) || lower.includes(id.toLowerCase()));
        });
        if (keywords.length > 0 && !keywordMatch) {
            suggestions.push({
                item_id: `new_${cluster.cluster_id}`,
                current_deduct: 0,
                suggested_deduct: 8,
                action: 'add_new_item',
                reason: `Keywords [${keywords.slice(0, 3).join(', ')}] do not match an existing item`,
                evidence_count: evidenceCount,
                evidence_total: evidenceTotals.get(cluster.primary_item_ids?.[0] ?? '') ?? 0,
            });
        }
    }
    return suggestions;
}
/**
 * 将规则建议序列化为 YAML 字符串。
 * @param {RuleSuggestion[]} suggestions - 规则建议列表
 * @returns {string} YAML 字符串
 */
function formatRuleSuggestionsYaml(suggestions) {
    return js_yaml_1.default.dump({ suggestions }, { lineWidth: 120 });
}
