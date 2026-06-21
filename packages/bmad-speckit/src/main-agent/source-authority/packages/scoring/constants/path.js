"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRulesDir = resolveRulesDir;
exports.resolveSchemaDir = resolveSchemaDir;
exports.getScoringDataPath = getScoringDataPath;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * 解析 scoring rules 目录路径。
 * 策略：若传入 rulesDir 则使用；否则若 cwd/packages/scoring/rules 存在则使用（monorepo）；否则使用包内 rules/。
 * @param {object} [options] - 可选参数
 * @param {string} [options.rulesDir] - 显式指定的 rules 目录
 * @returns {string} rules 目录绝对路径
 */
function resolveRulesDir(options) {
    if (options?.rulesDir) {
        return options.rulesDir;
    }
    const candidates = [
        path_1.default.join(process.cwd(), 'packages', 'scoring', 'rules'),
        path_1.default.join(process.cwd(), 'node_modules', '@bmad-speckit', 'scoring', 'rules'),
        path_1.default.join(process.cwd(), 'node_modules', 'bmad-speckit', 'node_modules', '@bmad-speckit', 'scoring', 'rules'),
        path_1.default.join(process.cwd(), 'node_modules', 'bmad-speckit-sdd-flow', 'packages', 'scoring', 'rules'),
        path_1.default.join(__dirname, '..', '..', 'rules'),
        path_1.default.join(__dirname, '..', '..', 'scoring', 'rules'),
        path_1.default.join(__dirname, '..', '..', '..', 'scoring', 'rules'),
    ];
    for (const candidate of candidates) {
        if (fs_1.default.existsSync(candidate)) {
            return candidate;
        }
    }
    return candidates[1];
}
/**
 * 解析 scoring schema 目录路径（用于 run-score-schema.json 等）。
 * 策略同 resolveRulesDir：cwd 优先，包内 fallback。
 * @param {object} [options] - 可选参数
 * @param {string} [options.schemaDir] - 显式指定的 schema 目录
 * @returns {string} schema 目录绝对路径
 */
function resolveSchemaDir(options) {
    if (options?.schemaDir) {
        return options.schemaDir;
    }
    const candidates = [
        path_1.default.join(process.cwd(), 'packages', 'scoring', 'schema'),
        path_1.default.join(process.cwd(), 'node_modules', '@bmad-speckit', 'schema'),
        path_1.default.join(process.cwd(), 'node_modules', 'bmad-speckit', 'node_modules', '@bmad-speckit', 'schema'),
        path_1.default.join(process.cwd(), 'node_modules', 'bmad-speckit-sdd-flow', 'packages', 'schema'),
        path_1.default.join(__dirname, '..', '..', 'schema'),
        path_1.default.join(__dirname, '..', '..', 'scoring', 'schema'),
        path_1.default.join(__dirname, '..', '..', '..', 'schema'),
    ];
    for (const candidate of candidates) {
        if (fs_1.default.existsSync(candidate)) {
            return candidate;
        }
    }
    return candidates[1];
}
/**
 * 获取评分数据存储路径。
 * 默认 _bmad-output/scoring/，可通过环境变量 SCORING_DATA_PATH 覆盖。
 * @returns {string} 评分数据目录的绝对路径
 */
function getScoringDataPath() {
    const envPath = process.env.SCORING_DATA_PATH;
    if (envPath) {
        return path_1.default.isAbsolute(envPath) ? envPath : path_1.default.resolve(process.cwd(), envPath);
    }
    return path_1.default.resolve(process.cwd(), '_bmad-output', 'scoring');
}
