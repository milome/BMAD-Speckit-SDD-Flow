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
exports.resolveScoringPolicy = resolveScoringPolicy;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const weights_1 = require("../constants/weights");
function normalizePath(value) {
    return value.replace(/\\/gu, '/');
}
function sha256Buffer(value) {
    return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}
function sortKeysDeep(value) {
    if (value === null || typeof value !== 'object')
        return value;
    if (Array.isArray(value))
        return value.map(sortKeysDeep);
    const out = {};
    for (const key of Object.keys(value).sort()) {
        out[key] = sortKeysDeep(value[key]);
    }
    return out;
}
function stableHash(value) {
    return sha256Buffer(JSON.stringify(sortKeysDeep(value)));
}
function readYamlObject(file) {
    const parsed = js_yaml_1.default.load(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`scoring policy YAML object expected: ${file}`);
    }
    return parsed;
}
function asObject(value, field) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`scoring policy field must be object: ${field}`);
    }
    return value;
}
function asStringArray(value, field) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
        throw new Error(`scoring policy field must be string array: ${field}`);
    }
    return value.map((item) => item.trim());
}
function resolveContractPath(root, contractPath) {
    const raw = contractPath?.trim() || path.join('_bmad', '_config', 'scoring-policy.contract.yaml');
    return path.isAbsolute(raw) ? raw : path.resolve(root, raw);
}
function relativeFromRoot(root, file) {
    return normalizePath(path.relative(root, file));
}
function resolvePolicyPath(root, file) {
    if (path.isAbsolute(file))
        return file;
    return path.resolve(root, file);
}
function validateLevelRanges(value) {
    const raw = Array.isArray(value) && value.length > 0 ? value : weights_1.LEVEL_RANGES;
    return raw.map((item, index) => {
        const obj = asObject(item, `levelRanges[${index}]`);
        const level = typeof obj.level === 'string' ? obj.level.trim() : '';
        if (!level || typeof obj.min !== 'number' || typeof obj.max !== 'number') {
            throw new Error(`invalid scoring policy level range at index ${index}`);
        }
        return { level, min: obj.min, max: obj.max };
    });
}
function resolveRuleRefs(root, ruleRoot, contract) {
    const refs = Array.isArray(contract.stageRuleRefs) ? contract.stageRuleRefs : [];
    if (refs.length === 0)
        throw new Error('scoring policy stageRuleRefs missing');
    return refs.map((item, index) => {
        const ref = asObject(item, `stageRuleRefs[${index}]`);
        const stage = typeof ref.stage === 'string' ? ref.stage.trim() : '';
        const kind = typeof ref.kind === 'string' ? ref.kind.trim() : '';
        const refPath = typeof ref.path === 'string' ? ref.path.trim() : '';
        if (!stage || !kind || !refPath)
            throw new Error(`invalid scoring policy stageRuleRefs[${index}]`);
        const absolute = resolvePolicyPath(ruleRoot, refPath);
        if (!fs.existsSync(absolute))
            throw new Error(`scoring policy rule fragment missing: ${refPath}`);
        return {
            stage,
            kind,
            path: normalizePath(refPath),
            hash: sha256Buffer(fs.readFileSync(absolute)),
        };
    });
}
function resolveScoringPolicy(options) {
    const root = path.resolve(options?.root ?? process.cwd());
    const ruleRoot = path.resolve(options?.ruleRoot ?? root);
    const contractAbsolute = resolveContractPath(root, options?.contractPath);
    if (!fs.existsSync(contractAbsolute)) {
        throw new Error(`scoring policy contract missing: ${relativeFromRoot(root, contractAbsolute)}`);
    }
    const contract = readYamlObject(contractAbsolute);
    if (contract.schemaVersion !== 'scoring-policy.contract/v1') {
        throw new Error('scoring policy contract schemaVersion invalid');
    }
    const policyId = typeof contract.policyId === 'string' && contract.policyId.trim()
        ? contract.policyId.trim()
        : 'default-scoring-policy';
    const resolvedWithoutHash = {
        schemaVersion: 'resolved-scoring-policy/v1',
        policyId,
        contractPath: relativeFromRoot(root, contractAbsolute),
        contractHash: sha256Buffer(fs.readFileSync(contractAbsolute)),
        scoreMaterializationPolicy: asObject(contract.scoreMaterializationPolicy, 'scoreMaterializationPolicy'),
        scoreEvaluationPolicy: asObject(contract.scoreEvaluationPolicy, 'scoreEvaluationPolicy'),
        passThresholds: asObject(contract.passThresholds, 'passThresholds'),
        levelRanges: validateLevelRanges(contract.levelRanges),
        dimensionVetoPolicy: asObject(contract.dimensionVetoPolicy, 'dimensionVetoPolicy'),
        iterationPenaltyPolicy: asObject(contract.iterationPenaltyPolicy, 'iterationPenaltyPolicy'),
        severityOverridePolicy: asObject(contract.severityOverridePolicy, 'severityOverridePolicy'),
        stageRuleRefs: resolveRuleRefs(root, ruleRoot, contract),
        requiredScoreArtifactKinds: asStringArray(contract.requiredScoreArtifactKinds, 'requiredScoreArtifactKinds'),
    };
    return {
        ...resolvedWithoutHash,
        scoringPolicyHash: stableHash(resolvedWithoutHash),
    };
}
