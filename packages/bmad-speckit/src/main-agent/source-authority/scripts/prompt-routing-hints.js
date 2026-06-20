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
exports.DEFAULT_PROMPT_ROUTING_RULES_PATH = void 0;
exports.loadPromptRoutingRules = loadPromptRoutingRules;
exports.detectPromptRoutingHints = detectPromptRoutingHints;
exports.resolvePromptRoutingHintsFromText = resolvePromptRoutingHintsFromText;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const yaml = __importStar(require("js-yaml"));
const prompt_routing_hints_schema_1 = require("./prompt-routing-hints-schema");
exports.DEFAULT_PROMPT_ROUTING_RULES_PATH = path.join('_bmad', 'bmm', 'data', 'prompt-routing-rules.yaml');
function normalizeText(value) {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
}
function resolveRulesPath(projectRoot, rulesPath = exports.DEFAULT_PROMPT_ROUTING_RULES_PATH) {
    return path.isAbsolute(rulesPath) ? rulesPath : path.join(projectRoot, rulesPath);
}
function collectAliasHits(aliasMap, normalizedInput) {
    const hits = {};
    for (const [key, aliases] of Object.entries(aliasMap)) {
        const matched = aliases.filter((alias) => normalizedInput.includes(normalizeText(alias)));
        if (matched.length > 0) {
            hits[key] = matched;
        }
    }
    return hits;
}
function pickBestKey(hits) {
    let bestKey;
    let bestCount = 0;
    for (const [key, aliases] of Object.entries(hits)) {
        if (aliases.length > bestCount) {
            bestKey = key;
            bestCount = aliases.length;
        }
    }
    return bestKey;
}
function flattenAliases(hits) {
    return Object.values(hits).flat();
}
function resolveConfidence(signalCount, thresholds) {
    if (signalCount >= thresholds.high) {
        return 'high';
    }
    if (signalCount >= thresholds.medium) {
        return 'medium';
    }
    return 'low';
}
function deriveResearchPolicy(rules, normalizedInput) {
    const hits = collectAliasHits(rules.researchPolicyAliases, normalizedInput);
    if (hits.forbidden) {
        return { value: 'forbidden', aliases: hits.forbidden };
    }
    if (hits.preferred) {
        return { value: 'preferred', aliases: hits.preferred };
    }
    return { value: rules.defaults.researchPolicy, aliases: [] };
}
function deriveDelegationPreference(rules, normalizedInput) {
    const hits = collectAliasHits(rules.delegationAliases, normalizedInput);
    if (hits['decide-for-me']) {
        return { value: 'decide-for-me', aliases: hits['decide-for-me'] };
    }
    if (hits['ask-me-first']) {
        return { value: 'ask-me-first', aliases: hits['ask-me-first'] };
    }
    return { value: rules.defaults.delegationPreference, aliases: [] };
}
function loadPromptRoutingRules(projectRoot, rulesPath = exports.DEFAULT_PROMPT_ROUTING_RULES_PATH) {
    const absolutePath = resolveRulesPath(projectRoot, rulesPath);
    const raw = fs.readFileSync(absolutePath, 'utf8');
    const parsed = yaml.load(raw);
    (0, prompt_routing_hints_schema_1.assertValidPromptRoutingRuleSet)(parsed);
    return parsed;
}
function detectPromptRoutingHints(input, rules) {
    const normalizedInput = normalizeText(input);
    const stageHits = collectAliasHits(rules.stageAliases, normalizedInput);
    const actionHits = collectAliasHits(rules.actionAliases, normalizedInput);
    const artifactHits = collectAliasHits(rules.artifactAliases, normalizedInput);
    const roleHits = collectAliasHits(rules.roleAliases, normalizedInput);
    const constraintHits = collectAliasHits(rules.constraintAliases, normalizedInput);
    const researchPolicy = deriveResearchPolicy(rules, normalizedInput);
    const delegationPreference = deriveDelegationPreference(rules, normalizedInput);
    const signalCount = (pickBestKey(stageHits) ? 1 : 0) +
        (pickBestKey(actionHits) ? 1 : 0) +
        (pickBestKey(artifactHits) ? 1 : 0) +
        Object.keys(roleHits).length +
        Object.keys(constraintHits).length +
        (researchPolicy.aliases.length > 0 ? 1 : 0) +
        (delegationPreference.aliases.length > 0 ? 1 : 0);
    const hints = {
        source: 'user-input',
        confidence: resolveConfidence(signalCount, rules.defaults.confidenceThresholds),
        ...(pickBestKey(actionHits) ? { requestedAction: pickBestKey(actionHits) } : {}),
        ...(pickBestKey(stageHits) ? { inferredStage: pickBestKey(stageHits) } : {}),
        ...(pickBestKey(artifactHits) ? { inferredArtifactTarget: pickBestKey(artifactHits) } : {}),
        explicitRolePreference: Object.keys(roleHits),
        researchPolicy: researchPolicy.value,
        delegationPreference: delegationPreference.value,
        constraints: Object.keys(constraintHits),
        overrideAllowed: false,
        debug: {
            score: signalCount,
            normalizedInput,
            matchedStageAliases: flattenAliases(stageHits),
            matchedActionAliases: flattenAliases(actionHits),
            matchedArtifactAliases: flattenAliases(artifactHits),
            matchedRoleAliases: flattenAliases(roleHits),
            matchedResearchPolicyAliases: researchPolicy.aliases,
            matchedDelegationAliases: delegationPreference.aliases,
            matchedConstraintAliases: flattenAliases(constraintHits),
        },
    };
    (0, prompt_routing_hints_schema_1.assertValidPromptRoutingHints)(hints);
    return hints;
}
function resolvePromptRoutingHintsFromText(projectRoot, input, rulesPath = exports.DEFAULT_PROMPT_ROUTING_RULES_PATH) {
    const rules = loadPromptRoutingRules(projectRoot, rulesPath);
    return detectPromptRoutingHints(input, rules);
}
