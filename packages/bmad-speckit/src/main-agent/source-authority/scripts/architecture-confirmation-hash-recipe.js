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
exports.stableStringify = stableStringify;
exports.sha256Text = sha256Text;
exports.normalizeArchitecturePath = normalizeArchitecturePath;
exports.resolveArchitectureConfirmationHashRecipe = resolveArchitectureConfirmationHashRecipe;
exports.architectureConfirmationHashFor = architectureConfirmationHashFor;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const yaml = __importStar(require("js-yaml"));
const EXPECTED_SCHEMA_VERSION = 'architecture-confirmation-hash-recipe.contract/v1';
const EXPECTED_RECIPE_VERSION = 'architecture-confirmation-hash/v1';
const DEFAULT_CONFIG_PATH = '_bmad/_config/architecture-confirmation-hash-recipe.contract.yaml';
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function strings(value) {
    return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    const input = value;
    return `{${Object.keys(input)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(input[key])}`)
        .join(',')}}`;
}
function sha256Text(value) {
    return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}
function normalizeArchitecturePath(value, repoRoot = process.cwd()) {
    const raw = value.replace(/\\/gu, '/').trim();
    const root = repoRoot.replace(/\\/gu, '/').replace(/\/$/u, '');
    const withoutRoot = raw.startsWith(`${root}/`) ? raw.slice(root.length + 1) : raw;
    const normalized = path.posix.normalize(withoutRoot.replace(/^[a-zA-Z]:\//u, (drive) => drive.toLowerCase()));
    return normalized.replace(/^\.\//u, '').replace(/\/$/u, '');
}
function resolveArchitectureConfirmationHashRecipe(configPath = DEFAULT_CONFIG_PATH) {
    const absoluteConfigPath = path.resolve(configPath);
    if (!fs.existsSync(absoluteConfigPath)) {
        throw new Error(`ArchitectureConfirmationHashRecipe missing: ${configPath}`);
    }
    const parsed = yaml.load(fs.readFileSync(absoluteConfigPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('ArchitectureConfirmationHashRecipe must be a YAML object');
    }
    const config = parsed;
    const schemaVersion = text(config.schemaVersion);
    const recipeVersion = text(config.recipeVersion);
    if (schemaVersion !== EXPECTED_SCHEMA_VERSION) {
        throw new Error(`ArchitectureConfirmationHashRecipe schemaVersion invalid: ${schemaVersion || '<missing>'}`);
    }
    if (recipeVersion !== EXPECTED_RECIPE_VERSION) {
        throw new Error(`ArchitectureConfirmationHashRecipe recipeVersion invalid: ${recipeVersion || '<missing>'}`);
    }
    const volatileFields = strings(config.volatileFieldsExcludedFromArtifactHash);
    const requiredStateHashFields = strings(object(config.stateTransitionHashCoverage).requiredHashFields);
    if (volatileFields.length === 0)
        throw new Error('ArchitectureConfirmationHashRecipe volatile fields missing');
    if (requiredStateHashFields.length === 0) {
        throw new Error('ArchitectureConfirmationHashRecipe stateTransition hash coverage missing');
    }
    const resolvedWithoutHash = {
        schemaVersion,
        recipeVersion,
        configPath: normalizeArchitecturePath(absoluteConfigPath),
        canonicalization: object(config.canonicalization),
        pathNormalization: object(config.pathNormalization),
        fixedCategoryOrder: object(config.fixedCategoryOrder),
        volatileFieldsExcludedFromArtifactHash: volatileFields,
        stateTransitionHashCoverage: object(config.stateTransitionHashCoverage),
        controlledIngestRules: object(config.controlledIngestRules),
    };
    return {
        ...resolvedWithoutHash,
        resolvedRecipeHash: sha256Text(stableStringify(resolvedWithoutHash)),
    };
}
function architectureConfirmationHashFor(confirmation, recipe) {
    const volatile = new Set([
        ...recipe.volatileFieldsExcludedFromArtifactHash,
        'artifactHash',
        'architectureConfirmationArtifactHash',
        'confirmationPhrase',
        'architectureConfirmationArtifactRef',
    ]);
    const semantic = {};
    for (const [key, value] of Object.entries(confirmation)) {
        if (!volatile.has(key))
            semantic[key] = value;
    }
    return sha256Text(stableStringify(semantic));
}
