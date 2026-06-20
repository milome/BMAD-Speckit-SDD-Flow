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
exports.resolveRef = resolveRef;
exports.loadPhaseScoringYaml = loadPhaseScoringYaml;
exports.loadStageScoringYaml = loadStageScoringYaml;
exports.loadGapsScoringYaml = loadGapsScoringYaml;
exports.loadIterationTierYaml = loadIterationTierYaml;
/**
 * Story 2.1: YAML 规则解析器，支持 ref 解析并关联 code-reviewer-config
 * Architecture §2、§9，plan-E2-S1 §3
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const types_1 = require("./types");
const path_1 = require("../constants/path");
const REF_PATTERN = /^code-reviewer-config#([a-zA-Z0-9_]+)$/;
function getRulesDir(options) {
    return (0, path_1.resolveRulesDir)(options);
}
function getConfigPath(options) {
    const root = process.cwd();
    return options?.configPath ?? path.join(root, '_bmad', '_config', 'code-reviewer-config.yaml');
}
/**
 * 加载并解析 code-reviewer-config.yaml
 * @param {string} configPath - Config path
 * @returns {object} Config object with items and veto_items
 */
function loadCodeReviewerConfig(configPath) {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = js_yaml_1.default.load(content);
    return {
        items: config.items,
        veto_items: config.veto_items,
    };
}
/**
 * Resolve ref (code-reviewer-config#item_id) to ResolvedItem from code-reviewer-config.
 * @param {string} ref - Reference string, e.g. code-reviewer-config#item_id
 * @param {string} [configPath] - Optional path to code-reviewer-config.yaml
 * @returns {ResolvedItem} ResolvedItem with item_id, name, description
 * @throws {RefResolutionError} If item_id not found in config
 */
function resolveRef(ref, configPath) {
    const m = ref.match(REF_PATTERN);
    if (!m) {
        throw new types_1.RefResolutionError(ref, ref, configPath);
    }
    const itemId = m[1];
    const cfgPath = configPath ?? getConfigPath();
    const config = loadCodeReviewerConfig(cfgPath);
    // veto_* 查 veto_items，否则查 items
    if (itemId.startsWith('veto_')) {
        const v = config.veto_items?.[itemId];
        if (!v) {
            throw new types_1.RefResolutionError(ref, itemId, cfgPath);
        }
        return { item_id: itemId, name: v.name, ...v };
    }
    const item = config.items?.[itemId];
    if (!item) {
        throw new types_1.RefResolutionError(ref, itemId, cfgPath);
    }
    return { item_id: itemId, name: item.name, description: item.description, ...item };
}
/**
 * 加载环节 2/3/4 的 YAML
 * @param {2 | 3 | 4} phase - Phase number
 * @param {object} [options] - Options object
 * @param {string} [options.rulesDir] - Rules directory path
 * @param {string} [options.configPath] - Config path
 * @returns {PhaseScoringYaml} PhaseScoringYaml
 */
function loadPhaseScoringYaml(phase, options) {
    const rulesDir = getRulesDir(options);
    const files = {
        2: 'implement-scoring.yaml',
        3: 'test-scoring.yaml',
        4: 'bugfix-scoring.yaml',
    };
    const filePath = path.join(rulesDir, 'default', files[phase]);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = js_yaml_1.default.load(content);
    validatePhaseScoringYaml(parsed, options?.configPath);
    return parsed;
}
/**
 * Load spec/plan/tasks stage scoring YAML (Story 5.2 B03).
 * @param {'spec' | 'plan' | 'tasks'} stage - spec, plan, or tasks
 * @param {object} [options] - Options object
 * @param {string} [options.rulesDir] - Rules directory path
 * @param {string} [options.configPath] - Config path
 * @returns {PhaseScoringYaml} PhaseScoringYaml
 * @throws {Error} If file invalid
 */
function loadStageScoringYaml(stage, options) {
    const rulesDir = getRulesDir(options);
    const files = {
        spec: 'spec-scoring.yaml',
        plan: 'plan-scoring.yaml',
        tasks: 'tasks-scoring.yaml',
    };
    const filePath = path.join(rulesDir, files[stage]);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = js_yaml_1.default.load(content);
    validatePhaseScoringYaml(parsed, options?.configPath);
    return parsed;
}
/**
 * Load gaps-scoring.yaml from rules directory.
 * @param {object} [options] - Options object
 * @param {string} [options.rulesDir] - Rules directory path
 * @returns {GapsScoringYaml} GapsScoringYaml
 * @throws {Error} If version, stage, or weights missing
 */
function loadGapsScoringYaml(options) {
    const rulesDir = getRulesDir(options);
    const filePath = path.join(rulesDir, 'gaps-scoring.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = js_yaml_1.default.load(content);
    if (!parsed.version || !parsed.stage || !parsed.weights) {
        throw new Error('Invalid gaps-scoring.yaml: missing version, stage, or weights');
    }
    return parsed;
}
/**
 * Load iteration-tier.yaml from rules directory.
 * @param {object} [options] - Options object
 * @param {string} [options.rulesDir] - Rules directory path
 * @returns {IterationTierYaml} IterationTierYaml
 * @throws {Error} If iteration_tier missing
 */
function loadIterationTierYaml(options) {
    const rulesDir = getRulesDir(options);
    const filePath = path.join(rulesDir, 'iteration-tier.yaml');
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = js_yaml_1.default.load(content);
    if (!parsed.iteration_tier || typeof parsed.iteration_tier !== 'object') {
        throw new Error('Invalid iteration-tier.yaml: missing iteration_tier');
    }
    return parsed;
}
/**
 * 校验环节 2/3/4 YAML 并解析所有 ref（确保 item_id 存在）
 * @param {PhaseScoringYaml} y - Phase scoring YAML
 * @param {string} [configPath] - Config path
 */
function validatePhaseScoringYaml(y, configPath) {
    if (!y.version || !y.stage || !y.link_stage || !y.weights || !y.items) {
        throw new Error('Invalid phase scoring YAML: missing version, stage, link_stage, weights, or items');
    }
    for (const item of y.items) {
        if (!item.id || !item.ref || typeof item.deduct !== 'number') {
            throw new Error(`Invalid item: missing id, ref, or deduct`);
        }
        if (!REF_PATTERN.test(item.ref)) {
            throw new Error(`Invalid ref format: ${item.ref}, expected code-reviewer-config#item_id`);
        }
        resolveRef(item.ref, configPath);
    }
    for (const v of y.veto_items ?? []) {
        if (!v.id || !v.ref || !v.consequence) {
            throw new Error(`Invalid veto_item: missing id, ref, or consequence`);
        }
        if (!REF_PATTERN.test(v.ref)) {
            throw new Error(`Invalid ref format: ${v.ref}`);
        }
        resolveRef(v.ref, configPath);
    }
}
