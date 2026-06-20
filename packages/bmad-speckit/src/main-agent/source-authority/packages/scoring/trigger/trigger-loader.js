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
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetTriggerConfigCache = resetTriggerConfigCache;
exports.loadTriggerConfig = loadTriggerConfig;
exports.shouldWriteScore = shouldWriteScore;
exports.scoringEnabledForTriggerStage = scoringEnabledForTriggerStage;
/**
 * B04: scoring-trigger-modes.yaml 程序化加载器
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
let cachedConfig = null;
let cachedConfigPath = null;
/**
 * 清空 trigger 配置缓存，用于测试或热重载。
 * @returns {void}
 */
function resetTriggerConfigCache() {
    cachedConfig = null;
    cachedConfigPath = null;
}
/**
 * 加载 scoring-trigger-modes.yaml 配置。
 * @param {string} [configPath] - 配置文件路径，默认 _bmad/_config/scoring-trigger-modes.yaml
 * @returns {TriggerConfig} TriggerConfig 对象
 * @throws 文件不存在或格式无效时抛错
 */
function loadTriggerConfig(configPath) {
    const base = configPath ?? path.resolve(process.cwd(), '_bmad', '_config', 'scoring-trigger-modes.yaml');
    const resolved = path.isAbsolute(base) ? base : path.resolve(process.cwd(), base);
    if (cachedConfig && cachedConfigPath === resolved) {
        return cachedConfig;
    }
    if (!fs.existsSync(resolved)) {
        throw new Error(`Trigger config not found: ${resolved}`);
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    const raw = yaml.load(content);
    if (!raw ||
        typeof raw !== 'object' ||
        !('scoring_write_control' in raw) ||
        !('event_to_write_mode' in raw)) {
        throw new Error(`Invalid trigger config: missing scoring_write_control or event_to_write_mode`);
    }
    cachedConfig = raw;
    cachedConfigPath = resolved;
    return cachedConfig;
}
/**
 * 根据 event、stage、scenario 判断是否应写分及写分模式。
 * @param {string} event - 事件名
 * @param {string} stage - 阶段
 * @param {'real_dev' | 'eval_question'} scenario - real_dev | eval_question
 * @param {string} [configPath] - 可选配置路径
 * @returns {TriggerDecision} TriggerDecision 对象
 */
function shouldWriteScore(event, stage, scenario, configPath) {
    const config = loadTriggerConfig(configPath);
    const { enabled, call_mapping } = config.scoring_write_control;
    if (!enabled) {
        return { write: false, writeMode: 'single_file', reason: 'scoring disabled' };
    }
    const entries = Object.values(call_mapping ?? {});
    const matched = entries.find((e) => e.event === event && e.stage === stage);
    if (!matched) {
        return {
            write: false,
            writeMode: 'single_file',
            reason: 'stage not registered in call_mapping',
        };
    }
    const eventModes = config.event_to_write_mode?.[event];
    if (!eventModes) {
        return { write: false, writeMode: 'single_file', reason: 'event not in event_to_write_mode' };
    }
    const modeStr = (eventModes[scenario] ?? eventModes.default ?? 'single_file');
    const writeMode = modeStr === 'jsonl' ? 'jsonl' : modeStr === 'both' ? 'both' : 'single_file';
    return { write: true, writeMode, reason: 'matched' };
}
/**
 * Resolve whether scoring write is enabled for a registered trigger stage id.
 * Uses `call_mapping` entries where `entry.stage === triggerStage` (exact string match);
 * the event passed to `shouldWriteScore` comes from that entry (e.g. `stage_audit_complete` or `story_status_change`).
 * @param {string} triggerStage - Scoring stage id from `call_mapping[].stage`
 * @param {'real_dev' | 'eval_question'} scenario - Scenario for write mode lookup
 * @param {string} [configPath] - Optional path to `scoring-trigger-modes.yaml`
 * @returns {{ enabled: boolean; reason: string }} Aligned with `shouldWriteScore`
 */
function scoringEnabledForTriggerStage(triggerStage, scenario, configPath) {
    const config = loadTriggerConfig(configPath);
    const { enabled, call_mapping } = config.scoring_write_control;
    if (!enabled) {
        return { enabled: false, reason: 'scoring disabled' };
    }
    const entries = Object.values(call_mapping ?? {}).filter((e) => e.stage === triggerStage);
    if (entries.length === 0) {
        return { enabled: false, reason: 'stage not registered in call_mapping' };
    }
    const events = new Set(entries.map((e) => e.event));
    if (events.size > 1) {
        throw new Error(`scoring-trigger-modes.yaml call_mapping: ambiguous multiple events for stage "${triggerStage}"`);
    }
    const entry = entries[0];
    const decision = shouldWriteScore(entry.event, triggerStage, scenario, configPath);
    return { enabled: decision.write, reason: decision.reason };
}
