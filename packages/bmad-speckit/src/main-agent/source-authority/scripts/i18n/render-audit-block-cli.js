"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CLI: print manifest-rendered audit parseable block for injection (T4.5).
 * Used by pre-agent-summary hook; reads `_bmad-output/runtime/context/project.json` for languagePolicy.
 */
const node_fs_1 = require("node:fs");
const path = require("node:path");
const load_manifest_1 = require("./load-manifest");
const render_template_1 = require("./render-template");
function readResolvedMode() {
    const ctxPath = path.join(process.cwd(), '_bmad-output', 'runtime', 'context', 'project.json');
    if (!(0, node_fs_1.existsSync)(ctxPath))
        return 'en';
    try {
        const raw = JSON.parse((0, node_fs_1.readFileSync)(ctxPath, 'utf8'));
        const m = raw?.languagePolicy?.resolvedMode;
        if (m === 'zh' || m === 'en' || m === 'bilingual')
            return m;
    }
    catch {
        /* ignore */
    }
    return 'en';
}
function makeLanguagePolicy(resolved) {
    return {
        requestedMode: resolved === 'bilingual' ? 'bilingual' : resolved,
        resolvedMode: resolved,
        userLanguage: resolved === 'zh' ? 'zh' : resolved === 'en' ? 'en' : 'mixed',
        artifactLanguage: resolved === 'bilingual' ? 'bilingual' : resolved,
        detectionSource: 'project_default',
        allowBilingualDisplay: resolved === 'bilingual',
        preserveControlKeysInEnglish: true,
        preserveCommandsAndPaths: true,
    };
}
function main() {
    const manifestId = process.argv[2] || 'speckit.audit.spec';
    const resolved = readResolvedMode();
    const manifest = (0, load_manifest_1.loadManifest)(manifestId);
    const languagePolicy = makeLanguagePolicy(resolved);
    const result = (0, render_template_1.renderTemplate)({
        manifest,
        languagePolicy,
        placeholders: { epic: '15', story: '2' },
    });
    process.stdout.write([
        '[i18n audit template preview]',
        `manifest=${manifestId} resolvedMode=${resolved}`,
        '',
        result.content,
        '',
    ].join('\n'));
}
main();
