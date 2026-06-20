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
exports.materializeFacilitatorDefinition = materializeFacilitatorDefinition;
exports.ensureFacilitatorRuntimeDefinition = ensureFacilitatorRuntimeDefinition;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const reviewer_contract_1 = require("./reviewer-contract");
const facilitator_registry_1 = require("./facilitator-registry");
function runtimeTargetRelativePath(host) {
    return host === 'cursor'
        ? reviewer_contract_1.CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH
        : reviewer_contract_1.CLAUDE_FACILITATOR_TARGET_PATH;
}
function detectMaterializedMode(projectRoot, explicitMode) {
    const ctxPathRelative = path
        .relative(projectRoot, path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json'))
        .replace(/\\/g, '/');
    if (explicitMode) {
        return {
            mode: explicitMode,
            contextPathRelative: ctxPathRelative,
            fallbackReason: explicitMode === 'base' ? 'explicit_base_override' : undefined,
        };
    }
    const ctxPath = path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
    if (!fs.existsSync(ctxPath)) {
        return {
            mode: 'base',
            contextPathRelative: ctxPathRelative,
            fallbackReason: 'project_context_missing',
        };
    }
    try {
        const raw = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
        const mode = raw?.languagePolicy?.resolvedMode;
        if (mode === 'zh' || mode === 'en' || mode === 'bilingual') {
            return {
                mode,
                contextPathRelative: ctxPathRelative,
            };
        }
        if (raw?.languagePolicy == null) {
            return {
                mode: 'base',
                contextPathRelative: ctxPathRelative,
                fallbackReason: 'language_policy_missing',
            };
        }
        return {
            mode: 'base',
            contextPathRelative: ctxPathRelative,
            fallbackReason: 'language_policy_invalid',
        };
    }
    catch {
        return {
            mode: 'base',
            contextPathRelative: ctxPathRelative,
            fallbackReason: 'project_context_invalid',
        };
    }
}
function injectGeneratedHeader(content, metadata) {
    const separator = content.includes('\r\n') ? '\r\n' : '\n';
    const header = `<!-- RUNTIME-MATERIALIZED facilitator resolvedMode=${metadata.mode}` +
        ` source=${metadata.sourceRelativePath}` +
        ` workflow=${metadata.workflowRelativePath}` +
        ` step01=${metadata.step01RelativePath}` +
        ` step02=${metadata.step02RelativePath}` +
        ` step03=${metadata.step03RelativePath}` +
        ` contextPath=${metadata.contextPathRelative}` +
        (metadata.fallbackReason ? ` fallbackReason=${metadata.fallbackReason}` : '') +
        ' -->';
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
function stripExistingGeneratedHeader(content) {
    return content.replace(/<!-- RUNTIME-MATERIALIZED facilitator[\s\S]*? -->\r?\n?/u, '');
}
function rewriteCanonicalBindings(content, replacements) {
    return content
        .replace(/_bmad\/core\/skills\/bmad-party-mode\/workflow(?:\.(?:zh|en))?\.md/gu, replacements.workflow)
        .replace(/_bmad\/core\/skills\/bmad-party-mode\/steps\/step-01-agent-loading(?:\.(?:zh|en))?\.md/gu, replacements.step01)
        .replace(/_bmad\/core\/skills\/bmad-party-mode\/steps\/step-02-discussion-orchestration(?:\.(?:zh|en))?\.md/gu, replacements.step02)
        .replace(/_bmad\/core\/skills\/bmad-party-mode\/steps\/step-03-graceful-exit(?:\.(?:zh|en))?\.md/gu, replacements.step03);
}
function resolveRuntimeBindings(projectRoot, host, mode) {
    if (mode === 'base') {
        const facilitator = host === 'cursor'
            ? '_bmad/cursor/agents/party-mode-facilitator.md'
            : '_bmad/claude/agents/party-mode-facilitator.md';
        return {
            facilitator: { resolvedRelativePath: facilitator },
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
    return (0, facilitator_registry_1.resolveFacilitatorRuntimeBindings)(projectRoot, host, mode);
}
function materializeFacilitatorDefinition(projectRoot, host, mode, detectedMode = detectMaterializedMode(projectRoot, mode)) {
    const targetRelativePath = runtimeTargetRelativePath(host);
    const targetPath = path.join(projectRoot, targetRelativePath);
    const bindings = resolveRuntimeBindings(projectRoot, host, detectedMode.mode);
    const sourcePath = path.join(projectRoot, bindings.facilitator.resolvedRelativePath);
    if (!fs.existsSync(sourcePath)) {
        return {
            host,
            mode: detectedMode.mode,
            targetPath,
            fallbackReason: detectedMode.fallbackReason,
            updated: false,
            skippedReason: `source asset missing: ${bindings.facilitator.resolvedRelativePath}`,
        };
    }
    const source = fs.readFileSync(sourcePath, 'utf8');
    const rewritten = rewriteCanonicalBindings(stripExistingGeneratedHeader(source), {
        workflow: bindings.workflow.resolvedRelativePath,
        step01: bindings.step01.resolvedRelativePath,
        step02: bindings.step02.resolvedRelativePath,
        step03: bindings.step03.resolvedRelativePath,
    });
    const materialized = injectGeneratedHeader(rewritten, {
        mode: detectedMode.mode,
        sourceRelativePath: bindings.facilitator.resolvedRelativePath,
        workflowRelativePath: bindings.workflow.resolvedRelativePath,
        step01RelativePath: bindings.step01.resolvedRelativePath,
        step02RelativePath: bindings.step02.resolvedRelativePath,
        step03RelativePath: bindings.step03.resolvedRelativePath,
        contextPathRelative: detectedMode.contextPathRelative,
        fallbackReason: detectedMode.mode === 'base' ? detectedMode.fallbackReason : undefined,
    });
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const previous = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
    if (previous === materialized) {
        return {
            host,
            mode: detectedMode.mode,
            targetPath,
            sourceRelativePath: bindings.facilitator.resolvedRelativePath,
            fallbackReason: detectedMode.fallbackReason,
            updated: false,
        };
    }
    fs.writeFileSync(targetPath, materialized, 'utf8');
    return {
        host,
        mode: detectedMode.mode,
        targetPath,
        sourceRelativePath: bindings.facilitator.resolvedRelativePath,
        fallbackReason: detectedMode.fallbackReason,
        updated: true,
    };
}
function ensureFacilitatorRuntimeDefinition(projectRoot, options) {
    const detectedMode = detectMaterializedMode(projectRoot, options?.mode);
    const hosts = options?.hosts ?? ['cursor', 'claude'];
    return hosts.map((host) => {
        const runtimeDir = host === 'cursor'
            ? path.join(projectRoot, '.cursor', 'agents')
            : path.join(projectRoot, '.claude', 'agents');
        if (!fs.existsSync(runtimeDir)) {
            return {
                host,
                mode: detectedMode.mode,
                targetPath: path.join(projectRoot, runtimeTargetRelativePath(host)),
                fallbackReason: detectedMode.fallbackReason,
                updated: false,
                skippedReason: `runtime dir missing: ${path.relative(projectRoot, runtimeDir).replace(/\\/g, '/')}`,
            };
        }
        return materializeFacilitatorDefinition(projectRoot, host, detectedMode.mode, detectedMode);
    });
}
