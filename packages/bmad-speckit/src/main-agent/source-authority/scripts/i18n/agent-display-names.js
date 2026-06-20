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
exports.DEFAULT_AGENT_DISPLAY_NAMES_REGISTRY_PATH = void 0;
exports.readAgentDisplayNamesRegistry = readAgentDisplayNamesRegistry;
exports.resolveLocalizedAgentDisplayProfile = resolveLocalizedAgentDisplayProfile;
exports.buildLocalizedAgentDisplayProfile = buildLocalizedAgentDisplayProfile;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const ajv_1 = __importDefault(require("ajv"));
const yaml = __importStar(require("js-yaml"));
const agent_manifest_1 = require("./agent-manifest");
exports.DEFAULT_AGENT_DISPLAY_NAMES_REGISTRY_PATH = '_bmad/i18n/agent-display-names.yaml';
const REGISTRY_SCHEMA = {
    type: 'object',
    required: ['version', 'agents'],
    additionalProperties: false,
    properties: {
        version: { const: 1 },
        agents: {
            type: 'object',
            additionalProperties: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    displayName: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            zh: { type: 'string', minLength: 1 },
                            en: { type: 'string', minLength: 1 },
                        },
                    },
                    title: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            zh: { type: 'string', minLength: 1 },
                            en: { type: 'string', minLength: 1 },
                        },
                    },
                },
            },
        },
    },
};
const ajv = new ajv_1.default({ allErrors: true });
const validateRegistry = ajv.compile(REGISTRY_SCHEMA);
function loadRegistryDocument(projectRoot, registryPath) {
    const resolvedPath = path.join(projectRoot, registryPath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Agent display registry not found: ${resolvedPath}`);
    }
    return yaml.load(fs.readFileSync(resolvedPath, 'utf8'));
}
function normalizeLocalizedValue(value) {
    if (value == null) {
        return undefined;
    }
    const normalized = value.trim();
    return normalized === '' ? undefined : normalized;
}
function readAgentDisplayNamesRegistry(projectRoot, registryPath = exports.DEFAULT_AGENT_DISPLAY_NAMES_REGISTRY_PATH) {
    const parsed = loadRegistryDocument(projectRoot, registryPath);
    if (!validateRegistry(parsed)) {
        const detail = ajv.errorsText(validateRegistry.errors, { separator: '; ' });
        throw new Error(`Invalid agent display registry: ${detail}`);
    }
    return parsed;
}
function resolveLocalizedField(localized, fallback, resolvedMode) {
    const zhValue = normalizeLocalizedValue(localized?.zh);
    const enValue = normalizeLocalizedValue(localized?.en);
    const zh = zhValue ?? fallback;
    const en = enValue ?? fallback;
    if (resolvedMode === 'zh') {
        return { value: zh, usedFallback: zhValue == null };
    }
    if (resolvedMode === 'en') {
        return { value: en, usedFallback: enValue == null };
    }
    return {
        value: `${zh} / ${en}`,
        usedFallback: zhValue == null || enValue == null,
    };
}
function resolveSourceLabel(entryExists, displayNameUsedFallback, titleUsedFallback) {
    if (!entryExists) {
        return 'manifest-fallback';
    }
    if (displayNameUsedFallback || titleUsedFallback) {
        return 'registry+manifest-fallback';
    }
    return 'registry';
}
function resolveLocalizedAgentDisplayProfile(projectRoot, agentId, resolvedMode, options) {
    const manifestRow = (0, agent_manifest_1.readAgentManifestRow)(projectRoot, agentId, options?.manifestPath ?? agent_manifest_1.DEFAULT_AGENT_MANIFEST_RELATIVE_PATH);
    if (!manifestRow) {
        throw new Error(`Agent manifest entry not found for agentId=${agentId}`);
    }
    let entry;
    try {
        const registry = readAgentDisplayNamesRegistry(projectRoot, options?.registryPath ?? exports.DEFAULT_AGENT_DISPLAY_NAMES_REGISTRY_PATH);
        entry = registry.agents[agentId];
    }
    catch {
        entry = undefined;
    }
    return buildLocalizedAgentDisplayProfile(manifestRow, entry, resolvedMode);
}
function buildLocalizedAgentDisplayProfile(manifestRow, entry, resolvedMode) {
    const displayName = resolveLocalizedField(entry?.displayName, manifestRow.displayName, resolvedMode);
    const title = resolveLocalizedField(entry?.title, manifestRow.title, resolvedMode);
    return {
        agentId: manifestRow.name,
        icon: manifestRow.icon,
        displayName: displayName.value,
        title: title.value,
        source: resolveSourceLabel(entry != null, displayName.usedFallback, title.usedFallback),
    };
}
