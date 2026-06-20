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
exports.loadCoachConfig = loadCoachConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const DEFAULT_CONFIG = {
    required_skill_path: path.join(os.homedir(), '.cursor', 'skills', 'bmad-code-reviewer-lifecycle', 'SKILL.md'),
    auto_trigger_post_impl: false,
    run_mode: 'manual_or_post_impl',
};
function resolveConfigPath(configPath) {
    if (configPath == null || configPath === '') {
        return path.resolve(process.cwd(), '_bmad', '_config', 'coach-trigger.yaml');
    }
    return path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
}
/**
 * Load coach config from _bmad/_config/coach-trigger.yaml.
 * @param {string} [configPath] - Optional path; defaults to _bmad/_config/coach-trigger.yaml
 * @returns {import('./types').CoachConfig} CoachConfig (merged with defaults)
 */
function loadCoachConfig(configPath) {
    const targetPath = resolveConfigPath(configPath);
    if (!fs.existsSync(targetPath)) {
        return { ...DEFAULT_CONFIG };
    }
    const content = fs.readFileSync(targetPath, 'utf-8');
    const parsed = js_yaml_1.default.load(content);
    if (parsed == null || typeof parsed !== 'object') {
        return { ...DEFAULT_CONFIG };
    }
    const rawPath = parsed.required_skill_path ?? DEFAULT_CONFIG.required_skill_path;
    let expanded = rawPath;
    if (typeof rawPath === 'string') {
        const home = os.homedir();
        expanded = rawPath
            .replace(/\{SKILLS_ROOT\}/g, path.join(home, '.cursor', 'skills'))
            .replace(/%USERPROFILE%/g, home)
            .replace(/~\//g, home + '/');
    }
    return {
        required_skill_path: expanded,
        auto_trigger_post_impl: parsed.auto_trigger_post_impl ?? DEFAULT_CONFIG.auto_trigger_post_impl,
        run_mode: parsed.run_mode ?? DEFAULT_CONFIG.run_mode,
    };
}
