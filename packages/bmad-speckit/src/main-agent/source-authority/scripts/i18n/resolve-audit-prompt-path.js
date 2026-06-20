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
exports.getAuditPromptLocale = void 0;
exports.getAuditPromptLocaleFromRuntimeContext = getAuditPromptLocaleFromRuntimeContext;
exports.resolveAuditPromptPath = resolveAuditPromptPath;
/**
 * Resolves audit prompt template file path for locale (TASKS 附录 A / AUDIT_PROMPTS_STRATEGY.md).
 * Default `{stem}.md` = 中文主稿；`{stem}.zh.md` 显式中文；`{stem}.en.md` 全英文。
 *
 * Locale **does not** use environment variables. It comes from runtime context
 * `_bmad-output/runtime/context/project.json` → `languagePolicy.resolvedMode` (same contract as hooks / `render-audit-block-cli`).
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const resolve_localized_markdown_path_1 = require("./resolve-localized-markdown-path");
const PROJECT_RUNTIME_CONTEXT = path.join('_bmad-output', 'runtime', 'context', 'project.json');
/**
 * Maps `languagePolicy.resolvedMode` to which sidecar to prefer.
 * - `en` → English `.en.md` when present.
 * - `zh` | `bilingual` → Chinese path (`.zh.md` or default `.md`); bilingual does not pick a second file here.
 * - Missing/invalid file or field → **zh** (default main稿).
 * @param {string} [projectRoot=process.cwd()] - Project root used to locate runtime context
 * @returns {AuditPromptLocale} Preferred audit prompt locale
 */
function getAuditPromptLocaleFromRuntimeContext(projectRoot = process.cwd()) {
    const ctxPath = path.join(projectRoot, PROJECT_RUNTIME_CONTEXT);
    if (!fs.existsSync(ctxPath)) {
        return 'zh';
    }
    try {
        const raw = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
        const m = raw?.languagePolicy?.resolvedMode;
        if (m === 'en')
            return 'en';
        if (m === 'zh' || m === 'bilingual')
            return 'zh';
    }
    catch {
        /* ignore malformed context */
    }
    return 'zh';
}
/** Alias for documentation clarity. */
exports.getAuditPromptLocale = getAuditPromptLocaleFromRuntimeContext;
/**
 * Resolve the concrete audit prompt template path for a locale.
 * @param {string} refsDir - e.g. .../speckit-workflow/references
 * @param {string} templateBasename - Value from code-reviewer-config prompt_template, e.g. audit-prompts-code.md
 * @param {AuditPromptLocale} locale - Locale from runtime context (`zh` | `en`)
 * @returns {ResolveAuditPromptResult} Resolved path metadata
 */
function resolveAuditPromptPath(refsDir, templateBasename, locale) {
    const result = (0, resolve_localized_markdown_path_1.resolveLocalizedMarkdownPath)({
        basePath: path.join(refsDir, templateBasename),
        resolvedMode: locale,
    });
    return {
        resolvedPath: result.resolvedPath,
        usedFallback: mapAuditPromptFallback(result.variant, result.usedFallback, locale),
        variant: mapAuditPromptVariant(result.variant),
    };
}
function mapAuditPromptVariant(variant) {
    switch (variant) {
        case 'en':
            return 'en';
        case 'zh':
            return 'zh-explicit';
        default:
            return 'default';
    }
}
function mapAuditPromptFallback(variant, usedFallback, locale) {
    if (locale === 'zh' && variant === 'base') {
        return false;
    }
    return usedFallback;
}
