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
exports.stageToMode = stageToMode;
exports.parseDimensionScores = parseDimensionScores;
exports.listDimensionNamesEn = listDimensionNamesEn;
/**
 * Dimension parser: extract dimension scores from report content.
 * Uses code-reviewer-config modes.{mode}.dimensions for weights.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const DIMENSION_SCORE_PATTERN = /^(?:[-*]\s*|\d+\.\s*)?(.+?)\s*[：:]\s*(\d+)\s*[/／]\s*100\s*$/;
function getConfigPath(configPath) {
    return configPath ?? path.join(process.cwd(), '_bmad', '_config', 'code-reviewer-config.yaml');
}
function loadModeWeights(mode, configPath) {
    const resolved = getConfigPath(configPath);
    if (!fs.existsSync(resolved))
        return new Map();
    const content = fs.readFileSync(resolved, 'utf-8');
    const parsed = js_yaml_1.default.load(content);
    const dimensions = parsed?.modes?.[mode]?.dimensions;
    if (!Array.isArray(dimensions))
        return new Map();
    const map = new Map();
    for (const item of dimensions) {
        const name = typeof item?.name === 'string' ? item.name.trim() : '';
        const nameEn = typeof item.name_en === 'string'
            ? item.name_en.trim()
            : '';
        const weight = typeof item?.weight === 'number' ? item.weight : Number(item?.weight);
        if (!name || !Number.isFinite(weight))
            continue;
        map.set(name, weight);
        if (nameEn) {
            map.set(nameEn, weight);
        }
    }
    return map;
}
/**
 * Map audit stage to dimension mode for weight lookup.
 * @param {string} stage - Audit stage string
 * @returns {DimensionMode} DimensionMode (prd, arch, code, or pr)
 */
function stageToMode(stage) {
    switch (stage) {
        case 'prd':
        case 'spec':
        case 'plan':
        case 'gaps':
            return 'prd';
        case 'arch':
            return 'arch';
        case 'story':
            return 'story';
        case 'tasks':
            return 'tasks';
        case 'bugfix':
            return 'bugfix';
        case 'implement':
        case 'post_impl':
            return 'code';
        case 'pr_review':
            return 'pr';
        case 'implementation_readiness':
            return 'readiness';
        case 'delivery_confirmation':
            return 'delivery';
        default:
            return 'code';
    }
}
/**
 * Parse dimension scores from report content. Format: "dimension: score/100".
 * Uses mode weights from code-reviewer-config; returns only dimensions with configured weights.
 * @param {string} content - Report text
 * @param {DimensionMode} mode - Dimension mode for weight lookup
 * @param {string} [configPath] - Optional path to code-reviewer-config.yaml
 * @returns {DimensionScore[]} DimensionScore array
 */
function parseDimensionScores(content, mode, configPath) {
    try {
        const weights = loadModeWeights(mode, configPath);
        if (weights.size === 0)
            return [];
        const results = [];
        for (const rawLine of content.split(/\r?\n/)) {
            const line = rawLine.trim();
            const match = line.match(DIMENSION_SCORE_PATTERN);
            if (!match)
                continue;
            const dimension = match[1].trim();
            const score = Number(match[2]);
            let weight = weights.get(dimension);
            if (weight == null) {
                const lower = dimension.toLowerCase();
                for (const [k, w] of weights) {
                    if (k.toLowerCase() === lower) {
                        weight = w;
                        break;
                    }
                }
            }
            if (weight == null || !Number.isFinite(score))
                continue;
            results.push({ dimension, weight, score });
        }
        return results;
    }
    catch {
        return [];
    }
}
/**
 * English dimension labels from code-reviewer-config `name_en` (TB.6 WARN / diagnostics).
 * @param {DimensionMode} mode - Dimension mode
 * @param {string} [configPath] - Optional config path
 * @returns {string[]} Ordered list of name_en values (skips entries without name_en)
 */
function listDimensionNamesEn(mode, configPath) {
    const resolved = getConfigPath(configPath);
    if (!fs.existsSync(resolved))
        return [];
    const content = fs.readFileSync(resolved, 'utf-8');
    const parsed = js_yaml_1.default.load(content);
    const dimensions = parsed?.modes?.[mode]?.dimensions;
    if (!Array.isArray(dimensions))
        return [];
    const out = [];
    for (const item of dimensions) {
        const nameEn = typeof item?.name_en === 'string' ? item.name_en.trim() : '';
        if (nameEn)
            out.push(nameEn);
    }
    return out;
}
