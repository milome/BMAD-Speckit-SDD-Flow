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
exports.ensureFacilitatorRuntimeDefinition = ensureFacilitatorRuntimeDefinition;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const CURSOR_SOURCE = '_bmad/cursor/agents/party-mode-facilitator.md';
const CLAUDE_SOURCE = '_bmad/claude/agents/party-mode-facilitator.md';
const CURSOR_TARGET = '.cursor/agents/party-mode-facilitator.md';
const CLAUDE_TARGET = '.claude/agents/party-mode-facilitator.md';
function sourceRelativePath(host) {
    return host === 'cursor' ? CURSOR_SOURCE : CLAUDE_SOURCE;
}
function targetRelativePath(host) {
    return host === 'cursor' ? CURSOR_TARGET : CLAUDE_TARGET;
}
function resolveLocalizedRelativePath(relativePath, mode) {
    if (mode === 'base') {
        return relativePath;
    }
    if (mode === 'en') {
        return relativePath.replace(/\.md$/i, '.en.md');
    }
    return relativePath.replace(/\.md$/i, '.zh.md');
}
function injectGeneratedHeader(content, metadata) {
    const separator = content.includes('\r\n') ? '\r\n' : '\n';
    const header = `<!-- RUNTIME-MATERIALIZED facilitator resolvedMode=${metadata.mode}` +
        ` source=${metadata.sourceRelativePath}` +
        ` workflow=${metadata.workflowRelativePath}` +
        ` step01=${metadata.step01RelativePath}` +
        ` step02=${metadata.step02RelativePath}` +
        ` step03=${metadata.step03RelativePath} -->`;
    if (content.startsWith(`---${separator}`)) {
        const closingMarker = `${separator}---${separator}`;
        const closingIndex = content.indexOf(closingMarker, 4);
        if (closingIndex >= 0) {
            const splitAt = closingIndex + closingMarker.length;
            return `${content.slice(0, splitAt)}${header}${separator}${content.slice(splitAt)}`;
        }
    }
    return `${header}${separator}${content}`;
}
function stripGeneratedHeader(content) {
    return content.replace(/<!-- RUNTIME-MATERIALIZED facilitator[\s\S]*? -->\r?\n?/u, '');
}
function rewriteCanonicalBindings(content, replacements) {
    return content
        .replace(/_bmad\/core\/skills\/bmad-party-mode\/workflow(?:\.(?:zh|en))?\.md/gu, replacements.workflow)
        .replace(/_bmad\/core\/skills\/bmad-party-mode\/steps\/step-01-agent-loading(?:\.(?:zh|en))?\.md/gu, replacements.step01)
        .replace(/_bmad\/core\/skills\/bmad-party-mode\/steps\/step-02-discussion-orchestration(?:\.(?:zh|en))?\.md/gu, replacements.step02)
        .replace(/_bmad\/core\/skills\/bmad-party-mode\/steps\/step-03-graceful-exit(?:\.(?:zh|en))?\.md/gu, replacements.step03);
}
function resolveRuntimeBindings(host, mode) {
    if (mode === 'base') {
        return {
            facilitator: {
                resolvedRelativePath: host === 'cursor'
                    ? '_bmad/cursor/agents/party-mode-facilitator.md'
                    : '_bmad/claude/agents/party-mode-facilitator.md',
            },
            workflow: { resolvedRelativePath: '_bmad/core/skills/bmad-party-mode/workflow.md' },
            step01: {
                resolvedRelativePath: '_bmad/core/skills/bmad-party-mode/steps/step-01-agent-loading.md',
            },
            step02: {
                resolvedRelativePath: '_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md',
            },
            step03: {
                resolvedRelativePath: '_bmad/core/skills/bmad-party-mode/steps/step-03-graceful-exit.md',
            },
        };
    }
    const workflow = resolveLocalizedRelativePath('_bmad/core/skills/bmad-party-mode/workflow.md', mode);
    const step01 = resolveLocalizedRelativePath('_bmad/core/skills/bmad-party-mode/steps/step-01-agent-loading.md', mode);
    const step02 = resolveLocalizedRelativePath('_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration.md', mode);
    const step03 = resolveLocalizedRelativePath('_bmad/core/skills/bmad-party-mode/steps/step-03-graceful-exit.md', mode);
    return {
        facilitator: { resolvedRelativePath: resolveLocalizedRelativePath(sourceRelativePath(host), mode) },
        workflow: { resolvedRelativePath: workflow },
        step01: { resolvedRelativePath: step01 },
        step02: { resolvedRelativePath: step02 },
        step03: { resolvedRelativePath: step03 },
    };
}
function detectMaterializedMode(projectRoot, explicitMode) {
    if (explicitMode) {
        return explicitMode;
    }
    const ctxPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
    if (!fs.existsSync(ctxPath)) {
        return 'base';
    }
    try {
        const raw = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
        const mode = raw?.languagePolicy?.resolvedMode;
        if (mode === 'zh' || mode === 'en' || mode === 'bilingual') {
            return mode;
        }
    }
    catch {
        /* ignore malformed context */
    }
    return 'base';
}
function ensureFacilitatorRuntimeDefinition(projectRoot, options) {
    const mode = detectMaterializedMode(projectRoot, options?.mode);
    const hosts = options?.hosts ?? ['cursor', 'claude'];
    return hosts.map((host) => {
        const bindings = resolveRuntimeBindings(host, mode);
        const targetPath = path.join(projectRoot, targetRelativePath(host));
        const runtimeDir = path.dirname(targetPath);
        if (!fs.existsSync(runtimeDir)) {
            return {
                host,
                mode,
                targetPath,
                updated: false,
                skippedReason: `runtime dir missing: ${path.relative(projectRoot, runtimeDir).replace(/\\/g, '/')}`,
            };
        }
        const sourcePath = path.join(projectRoot, bindings.facilitator.resolvedRelativePath);
        if (!fs.existsSync(sourcePath)) {
            return {
                host,
                mode,
                targetPath,
                updated: false,
                skippedReason: `source asset missing: ${bindings.facilitator.resolvedRelativePath}`,
            };
        }
        const source = fs.readFileSync(sourcePath, 'utf8');
        const rewritten = rewriteCanonicalBindings(stripGeneratedHeader(source), {
            workflow: bindings.workflow.resolvedRelativePath,
            step01: bindings.step01.resolvedRelativePath,
            step02: bindings.step02.resolvedRelativePath,
            step03: bindings.step03.resolvedRelativePath,
        });
        const materialized = mode === 'base'
            ? rewritten
            : injectGeneratedHeader(rewritten, {
                mode,
                sourceRelativePath: bindings.facilitator.resolvedRelativePath,
                workflowRelativePath: bindings.workflow.resolvedRelativePath,
                step01RelativePath: bindings.step01.resolvedRelativePath,
                step02RelativePath: bindings.step02.resolvedRelativePath,
                step03RelativePath: bindings.step03.resolvedRelativePath,
            });
        const previous = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
        if (previous === materialized) {
            return {
                host,
                mode,
                targetPath,
                sourceRelativePath: bindings.facilitator.resolvedRelativePath,
                updated: false,
            };
        }
        fs.mkdirSync(runtimeDir, { recursive: true });
        fs.writeFileSync(targetPath, materialized, 'utf8');
        return {
            host,
            mode,
            targetPath,
            sourceRelativePath: bindings.facilitator.resolvedRelativePath,
            updated: true,
        };
    });
}
