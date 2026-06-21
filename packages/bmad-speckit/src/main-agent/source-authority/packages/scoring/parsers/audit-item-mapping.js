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
exports.resolveItemId = resolveItemId;
exports.resolveEmptyItemId = resolveEmptyItemId;
/**
 * BUGFIX: item_id 映射解析
 * 从 _bmad/_config/audit-item-mapping.yaml 查找报告问题描述对应的标准 item_id；
 * 无匹配时返回 fallback。
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
let cachedMapping = null;
function getMappingPath() {
    const root = process.cwd();
    return path.join(root, '_bmad', '_config', 'audit-item-mapping.yaml');
}
function loadMapping() {
    if (cachedMapping)
        return cachedMapping;
    const filePath = getMappingPath();
    if (!fs.existsSync(filePath)) {
        cachedMapping = {
            prd: { checks: [] },
            arch: { checks: [] },
            story: { checks: [] },
            spec: { checks: [] },
            plan: { checks: [] },
            gaps: { checks: [] },
            tasks: { checks: [] },
            implement: { checks: [] },
            post_impl: { checks: [] },
            implementation_readiness: { checks: [] },
        };
        return cachedMapping;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const doc = js_yaml_1.default.load(content);
    const result = {};
    for (const stage of [
        'prd',
        'arch',
        'story',
        'spec',
        'plan',
        'gaps',
        'tasks',
        'implement',
        'post_impl',
        'implementation_readiness',
    ]) {
        const stageDoc = doc[stage];
        const checks = [];
        if (stageDoc?.dimensions && Array.isArray(stageDoc.dimensions)) {
            for (const dim of stageDoc.dimensions) {
                const d = dim;
                if (d.checks) {
                    for (const c of d.checks) {
                        const patterns = [];
                        if (c.text)
                            patterns.push(c.text);
                        if (c.patterns)
                            patterns.push(...c.patterns);
                        if (patterns.length > 0) {
                            checks.push({ patterns, item_id: c.item_id });
                        }
                    }
                }
            }
        }
        if (stageDoc?.checks && Array.isArray(stageDoc.checks)) {
            for (const c of stageDoc.checks) {
                const patterns = [];
                if (c.text)
                    patterns.push(c.text);
                if (c.patterns)
                    patterns.push(...c.patterns);
                if (patterns.length > 0) {
                    checks.push({ patterns, item_id: c.item_id });
                }
            }
        }
        result[stage] = {
            empty_overall: stageDoc?.empty_overall,
            empty_dimensions: stageDoc?.empty_dimensions,
            checks,
        };
    }
    cachedMapping = result;
    return result;
}
/**
 * Look up standard item_id from _bmad/_config/audit-item-mapping.yaml by problem description.
 * Match rule: note contains any pattern → use item_id; first match wins.
 * @param {AuditStage} stage - Audit stage for mapping lookup
 * @param {string} note - Problem description
 * @param {string} fallback - Returned when no pattern matches
 * @returns {string} item_id from mapping or fallback
 */
function resolveItemId(stage, note, fallback) {
    const mapping = loadMapping();
    const stageMap = mapping[stage];
    const effectiveStageMap = stage === 'post_impl' ? mapping.implement : stageMap;
    if (!effectiveStageMap || effectiveStageMap.checks.length === 0)
        return fallback;
    for (const { patterns, item_id } of effectiveStageMap.checks) {
        for (const p of patterns) {
            if (note.includes(p))
                return item_id;
        }
    }
    return fallback;
}
/**
 * Get item_id for empty checklist or dimension-sourced case.
 * Uses empty_overall or empty_dimensions from mapping when defined.
 * @param {AuditStage} stage - Audit stage
 * @param {'overall' | 'dimensions'} type - 'overall' or 'dimensions'
 * @param {string} fallback - Returned when mapping has no override
 * @returns {string} item_id from mapping or fallback
 */
function resolveEmptyItemId(stage, type, fallback) {
    const mapping = loadMapping();
    const stageMap = stage === 'post_impl' ? mapping.implement : mapping[stage];
    if (!stageMap)
        return fallback;
    if (type === 'overall' && stageMap.empty_overall)
        return stageMap.empty_overall;
    if (type === 'dimensions' && stageMap.empty_dimensions)
        return stageMap.empty_dimensions;
    return fallback;
}
