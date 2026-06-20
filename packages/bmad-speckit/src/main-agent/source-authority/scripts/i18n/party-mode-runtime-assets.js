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
exports.resolveCanonicalPartyModeAsset = resolveCanonicalPartyModeAsset;
exports.resolveCursorPartyModeAsset = resolveCursorPartyModeAsset;
exports.resolveFacilitatorSourceAsset = resolveFacilitatorSourceAsset;
exports.resolvePartyModeSpeakerProfile = resolvePartyModeSpeakerProfile;
const path = __importStar(require("node:path"));
const resolve_localized_markdown_path_1 = require("./resolve-localized-markdown-path");
const agent_display_names_1 = require("./agent-display-names");
const PARTY_MODE_CANONICAL_ROOT = '_bmad/core/skills/bmad-party-mode';
const PARTY_MODE_CURSOR_OVERRIDE_ROOT = '_bmad/cursor/skills/bmad-party-mode';
const CANONICAL_ASSET_RELATIVE_PATHS = {
    workflow: `${PARTY_MODE_CANONICAL_ROOT}/workflow.md`,
    'step-01-agent-loading': `${PARTY_MODE_CANONICAL_ROOT}/steps/step-01-agent-loading.md`,
    'step-02-discussion-orchestration': `${PARTY_MODE_CANONICAL_ROOT}/steps/step-02-discussion-orchestration.md`,
    'step-03-graceful-exit': `${PARTY_MODE_CANONICAL_ROOT}/steps/step-03-graceful-exit.md`,
};
const CURSOR_OVERRIDE_ASSET_RELATIVE_PATHS = {
    'step-02-discussion-orchestration': `${PARTY_MODE_CURSOR_OVERRIDE_ROOT}/steps/step-02-discussion-orchestration.md`,
};
const FACILITATOR_SOURCE_RELATIVE_PATHS = {
    cursor: '_bmad/cursor/agents/party-mode-facilitator.md',
    claude: '_bmad/claude/agents/party-mode-facilitator.md',
};
function toPosix(value) {
    return value.replace(/\\/g, '/');
}
function resolveRelativeMarkdownAsset(projectRoot, relativePath, resolvedMode) {
    const resolved = (0, resolve_localized_markdown_path_1.resolveLocalizedMarkdownPath)({
        basePath: path.join(projectRoot, relativePath),
        resolvedMode,
    });
    return {
        baseRelativePath: toPosix(relativePath),
        resolvedRelativePath: toPosix(path.relative(projectRoot, resolved.resolvedPath)),
        usedFallback: resolved.usedFallback,
        variant: resolved.variant,
    };
}
function resolveCanonicalPartyModeAsset(projectRoot, assetId, resolvedMode) {
    return resolveRelativeMarkdownAsset(projectRoot, CANONICAL_ASSET_RELATIVE_PATHS[assetId], resolvedMode);
}
function resolveCursorPartyModeAsset(projectRoot, assetId, resolvedMode) {
    const relativePath = CURSOR_OVERRIDE_ASSET_RELATIVE_PATHS[assetId];
    if (!relativePath) {
        return resolveCanonicalPartyModeAsset(projectRoot, assetId, resolvedMode);
    }
    return resolveRelativeMarkdownAsset(projectRoot, relativePath, resolvedMode);
}
function resolveFacilitatorSourceAsset(projectRoot, host, resolvedMode) {
    return resolveRelativeMarkdownAsset(projectRoot, FACILITATOR_SOURCE_RELATIVE_PATHS[host], resolvedMode);
}
function resolvePartyModeSpeakerProfile(projectRoot, agentId, resolvedMode) {
    return (0, agent_display_names_1.resolveLocalizedAgentDisplayProfile)(projectRoot, agentId, resolvedMode);
}
