"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLocalizedMarkdownPath = resolveLocalizedMarkdownPath;
exports.deriveLocalizedMarkdownPaths = deriveLocalizedMarkdownPaths;
const fs = require("node:fs");
function normalizeDefaultMarkdownPath(basePath) {
    return /\.md$/i.test(basePath) ? basePath : `${basePath}.md`;
}
function buildSidecarPath(defaultPath, locale) {
    return defaultPath.replace(/\.md$/i, `.${locale}.md`);
}
function resolveLocalizedMarkdownPath(input) {
    const defaultPath = normalizeDefaultMarkdownPath(input.basePath);
    const zhPath = buildSidecarPath(defaultPath, 'zh');
    const enPath = buildSidecarPath(defaultPath, 'en');
    const resolvedMode = input.resolvedMode === 'en' || input.resolvedMode === 'zh' || input.resolvedMode === 'bilingual'
        ? input.resolvedMode
        : 'zh';
    if (resolvedMode === 'en') {
        if (fs.existsSync(enPath)) {
            return { resolvedPath: enPath, usedFallback: false, variant: 'en' };
        }
        return { resolvedPath: defaultPath, usedFallback: true, variant: 'base' };
    }
    if (fs.existsSync(zhPath)) {
        return { resolvedPath: zhPath, usedFallback: false, variant: 'zh' };
    }
    return { resolvedPath: defaultPath, usedFallback: true, variant: 'base' };
}
function deriveLocalizedMarkdownPaths(basePath) {
    const defaultPath = normalizeDefaultMarkdownPath(basePath);
    return {
        defaultPath,
        zhPath: buildSidecarPath(defaultPath, 'zh'),
        enPath: buildSidecarPath(defaultPath, 'en'),
    };
}
