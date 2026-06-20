"use strict";
/**
 * Runtime Governance — unified `RuntimePolicy` for flow/stage (production).
 *
 * ## 文档互链
 *
 * - **术语**：[`docs/reference/runtime-governance-terms.md`](../docs/reference/runtime-governance-terms.md)
 * - **母文档 policy 表**：[`docs/plans/UNIFIED_RUNTIME_2026-03-19.md`](../docs/plans/UNIFIED_RUNTIME_2026-03-19.md)
 *
 * `shouldAudit` / `shouldValidate` / `getStrictness` / `shouldGenerateDoc` 经 `bmad-config` 中 `callResolveRuntimePolicy()` 委托本模块。
 */
/* eslint-disable jsdoc/require-description, jsdoc/require-param, jsdoc/require-returns */
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
exports.deriveBmadHelpContextMaturity = deriveBmadHelpContextMaturity;
exports.deriveBmadHelpComplexity = deriveBmadHelpComplexity;
exports.deriveImplementationReadinessStatus = deriveImplementationReadinessStatus;
exports.implementationReadinessPassed = implementationReadinessPassed;
exports.resolveImplementationEntryGate = resolveImplementationEntryGate;
exports.shouldUpgradeStandaloneTasksToStory = shouldUpgradeStandaloneTasksToStory;
exports.setRuntimePolicyShadowModeForTests = setRuntimePolicyShadowModeForTests;
exports.getRuntimePolicyShadowModeForTests = getRuntimePolicyShadowModeForTests;
exports.resolveRuntimePolicy = resolveRuntimePolicy;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const yaml = __importStar(require("js-yaml"));
const bmad_config_1 = require("./bmad-config");
const trigger_loader_1 = require("../packages/scoring/trigger/trigger-loader");
const runtime_governance_template_schema_1 = require("./runtime-governance-template-schema");
const runtime_governance_registry_1 = require("./runtime-governance-registry");
const context_1 = require("../packages/runtime-context/src/context");
const DIRECT_HIGH_COMPLEXITY_REASONS = new Set([
    'shared_contract',
    'shared_types',
    'schema',
    'permission_boundary',
    'completion_semantics',
    'dependency_semantics',
    'fixture_assumptions',
    'ci',
    'root_config',
    'infra',
    'data_migration',
    'persistence_semantics',
]);
function deriveBmadHelpContextMaturity(sourceMode, evidence = {}) {
    return (0, context_1.deriveContextMaturity)(sourceMode, evidence);
}
function deriveBmadHelpComplexity(factors) {
    const score = factors.impactSurface +
        factors.sharedContract +
        factors.verificationCost +
        factors.uncertainty +
        factors.rollbackDifficulty;
    const forcedReasons = factors.forcedReasons ?? [];
    let level = 'low';
    if (score >= 7) {
        level = 'high';
    }
    else if (score >= 4) {
        level = 'medium';
    }
    if (forcedReasons.some((reason) => DIRECT_HIGH_COMPLEXITY_REASONS.has(reason))) {
        level = 'high';
    }
    else if (forcedReasons.length > 0 && level === 'low') {
        level = 'medium';
    }
    return { score, level, forcedReasons };
}
function deriveImplementationReadinessStatus(flow, evidence = {}) {
    if (evidence.staleAfterSemanticChange) {
        return 'stale_after_semantic_change';
    }
    if ((flow === 'story' || flow === 'bugfix' || flow === 'standalone_tasks') &&
        evidence.documentAuditPassed === false) {
        return 'blocked';
    }
    if (evidence.rerunGateStatus === 'pass' || evidence.remediationState === 'closed') {
        return 'repair_closed';
    }
    if (evidence.remediationState === 'in_progress') {
        return 'repair_in_progress';
    }
    if (!evidence.readinessReportPresent) {
        return 'missing';
    }
    if ((evidence.blockerCount ?? 0) > 0) {
        return 'blocked';
    }
    return 'ready_clean';
}
function implementationReadinessPassed(status) {
    return status === 'ready_clean' || status === 'repair_closed';
}
function defaultReadinessBlockerCode(status) {
    switch (status) {
        case 'missing':
            return 'missing_readiness_evidence';
        case 'blocked':
            return 'readiness_blocked';
        case 'repair_in_progress':
            return 'readiness_repair_in_progress';
        case 'stale_after_semantic_change':
            return 'stale_after_semantic_change';
        default:
            return 'implementation_entry_blocked';
    }
}
function defaultReadinessBlockerSummary(status) {
    switch (status) {
        case 'missing':
            return '缺少 implementation-readiness 所需证据';
        case 'blocked':
            return 'implementation-readiness 当前被阻断';
        case 'repair_in_progress':
            return 'implementation-readiness remediation 尚未闭环';
        case 'stale_after_semantic_change':
            return '语义基础已变化，原 implementation-readiness 结果失效';
        default:
            return '当前 implementation entry 不允许继续执行';
    }
}
function resolveImplementationEntryGate(input) {
    const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
    const blockerCodes = [...(input.blockerCodes ?? [])];
    const blockerSummary = [...(input.blockerSummary ?? [])];
    if (!implementationReadinessPassed(input.readinessStatus)) {
        if (blockerCodes.length === 0) {
            blockerCodes.push(defaultReadinessBlockerCode(input.readinessStatus));
        }
        if (blockerSummary.length === 0) {
            blockerSummary.push(defaultReadinessBlockerSummary(input.readinessStatus));
        }
        return {
            gateName: 'implementation-readiness',
            requestedFlow: input.requestedFlow,
            recommendedFlow: input.requestedFlow,
            decision: 'block',
            readinessStatus: input.readinessStatus,
            blockerCodes,
            blockerSummary,
            rerouteRequired: false,
            rerouteReason: null,
            evidenceSources: input.evidenceSources,
            semanticFingerprint: input.semanticFingerprint ?? null,
            evaluatedAt,
        };
    }
    if (input.requestedFlow === 'standalone_tasks' && input.complexity === 'high') {
        if (!blockerCodes.includes('standalone_tasks_high_complexity')) {
            blockerCodes.push('standalone_tasks_high_complexity');
        }
        if (!blockerSummary.includes('standalone_tasks 在 high complexity 下不得直接实现，必须升轨到 story')) {
            blockerSummary.push('standalone_tasks 在 high complexity 下不得直接实现，必须升轨到 story');
        }
        return {
            gateName: 'implementation-readiness',
            requestedFlow: input.requestedFlow,
            recommendedFlow: 'story',
            decision: 'reroute',
            readinessStatus: input.readinessStatus,
            blockerCodes,
            blockerSummary,
            rerouteRequired: true,
            rerouteReason: 'standalone_tasks_high_complexity',
            evidenceSources: input.evidenceSources,
            semanticFingerprint: input.semanticFingerprint ?? null,
            evaluatedAt,
        };
    }
    return {
        gateName: 'implementation-readiness',
        requestedFlow: input.requestedFlow,
        recommendedFlow: input.requestedFlow,
        decision: 'pass',
        readinessStatus: input.readinessStatus,
        blockerCodes,
        blockerSummary,
        rerouteRequired: false,
        rerouteReason: null,
        evidenceSources: input.evidenceSources,
        semanticFingerprint: input.semanticFingerprint ?? null,
        evaluatedAt,
    };
}
function shouldUpgradeStandaloneTasksToStory(flow, complexity) {
    return flow === 'standalone_tasks' && complexity === 'high';
}
let runtimePolicyShadowModeForTests = false;
/** 仅测试使用：启用 shadow compatibilitySource，不读取任何环境变量 */
function setRuntimePolicyShadowModeForTests(enabled) {
    runtimePolicyShadowModeForTests = enabled;
}
/** @internal tests only */
function getRuntimePolicyShadowModeForTests() {
    return runtimePolicyShadowModeForTests;
}
function defaultConfigDir() {
    return path.resolve(process.cwd(), '_bmad', '_config');
}
function resolvePath(override, name) {
    if (override) {
        return path.isAbsolute(override) ? override : path.resolve(process.cwd(), override);
    }
    return path.join(defaultConfigDir(), name);
}
function readYamlFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.load(content);
}
function loadMandatoryGates(filePath) {
    const raw = readYamlFile(filePath);
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.gates)) {
        throw new Error(`Invalid mandatory gates YAML: ${filePath}`);
    }
    return raw;
}
function loadGranularityStages(filePath) {
    const raw = readYamlFile(filePath);
    if (!raw ||
        typeof raw !== 'object' ||
        !Array.isArray(raw.granularity_governed_stages)) {
        throw new Error(`Invalid granularity stages YAML: ${filePath}`);
    }
    return raw;
}
function loadRuntimeStageMapping(filePath) {
    const raw = readYamlFile(filePath);
    if (!raw ||
        typeof raw !== 'object' ||
        !raw.runtime_flow_stage_to_trigger_stage ||
        typeof raw.runtime_flow_stage_to_trigger_stage !== 'object') {
        throw new Error(`stage-mapping.yaml missing runtime_flow_stage_to_trigger_stage: ${filePath}`);
    }
    return raw;
}
function readLegacyStagePolicyFields(stage, cfg) {
    const stageConfig = (0, bmad_config_1.getStageConfig)(stage, cfg);
    return {
        auditRequired: stageConfig?.audit ?? true,
        validationLevel: stageConfig?.validation ?? null,
        strictness: stageConfig?.strictness ?? 'standard',
        generateDoc: stageConfig?.generate_doc ?? true,
    };
}
function findMandatoryGateRule(flow, stage, mandatoryPath) {
    const doc = loadMandatoryGates(mandatoryPath);
    const hit = doc.gates.find((g) => g.flow === flow && g.stage === stage);
    return hit ? { id: hit.id } : null;
}
function granularityGovernedForStage(stage, granPath) {
    const doc = loadGranularityStages(granPath);
    return doc.granularity_governed_stages.includes(stage);
}
function resolveTriggerStage(flow, stage, mappingPath) {
    const doc = loadRuntimeStageMapping(mappingPath);
    const flowMap = doc.runtime_flow_stage_to_trigger_stage[flow];
    const mapped = flowMap?.[stage];
    if (mapped !== undefined && mapped !== '') {
        return { triggerStage: mapped, mappingDescriptor: `${flow}/${stage}→${mapped}` };
    }
    const unmapped = `unmapped_${stage}`;
    return { triggerStage: unmapped, mappingDescriptor: `${flow}/${stage}→${unmapped}` };
}
function mergeRuntimePolicyTemplate(base, templateId, templatesPath, cfg) {
    const content = fs.readFileSync(templatesPath, 'utf8');
    const parsed = (0, runtime_governance_template_schema_1.parseRuntimePolicyTemplatesYaml)(yaml.load(content));
    const patch = parsed.templates[templateId];
    if (!patch) {
        throw new Error(`Unknown runtime policy templateId: ${templateId}`);
    }
    const merged = { ...base };
    const mergedRec = merged;
    for (const [k, v] of Object.entries(patch)) {
        mergedRec[k] = v;
    }
    if (patch.strictness !== undefined && patch.convergence === undefined) {
        merged.convergence = (0, bmad_config_1.getAuditConvergence)(merged.strictness, cfg);
    }
    merged.reason = `${base.reason} | template:${templateId}`;
    return merged;
}
function resolveRuntimeStageForPolicy(stage) {
    if (stage === 'constitution') {
        return 'specify';
    }
    return stage;
}
/**
 * 解析当前 flow/stage 下的统一 policy（生产路径）。
 */
function resolveRuntimePolicy(input) {
    const cfg = input.config ?? (0, bmad_config_1.loadConfig)();
    const flow = input.flow;
    const stage = resolveRuntimeStageForPolicy(input.stage);
    const scenario = input.scenario ?? 'real_dev';
    const paths = input.governanceYamlPaths ?? {};
    const identitySummaryParts = [
        input.epicId ? `epicId=${input.epicId}` : null,
        input.storyId ? `storyId=${input.storyId}` : null,
        input.storySlug ? `storySlug=${input.storySlug}` : null,
        input.runId ? `runId=${input.runId}` : null,
        input.artifactRoot ? `artifactRoot=${input.artifactRoot}` : null,
        input.contextSource ? `contextSource=${input.contextSource}` : null,
    ].filter(Boolean);
    const mandatoryPath = resolvePath(paths.mandatoryGates, 'runtime-mandatory-gates.yaml');
    const granPath = resolvePath(paths.granularityStages, 'runtime-granularity-stages.yaml');
    const mappingPath = resolvePath(paths.stageMapping, 'stage-mapping.yaml');
    const templatesPath = resolvePath(paths.policyTemplates, 'runtime-policy-templates.yaml');
    const scoringModesPath = resolvePath(paths.scoringTriggerModes, 'scoring-trigger-modes.yaml');
    const legacy = readLegacyStagePolicyFields(stage, cfg);
    const { auditRequired, validationLevel, strictness, generateDoc } = legacy;
    const convergence = (0, bmad_config_1.getAuditConvergence)(strictness, cfg);
    const stageCfg = (0, bmad_config_1.getStageConfig)(stage, cfg);
    const skipAllowed = stageCfg?.optional === true;
    const mandatoryHit = findMandatoryGateRule(flow, stage, mandatoryPath);
    const mandatoryGate = mandatoryHit !== null;
    const granularityGoverned = granularityGovernedForStage(stage, granPath);
    if (mandatoryGate && granularityGoverned) {
        throw new Error(`Illegal runtime governance: mandatoryGate and granularityGoverned both true for ${flow}/${stage}`);
    }
    const { triggerStage, mappingDescriptor } = resolveTriggerStage(flow, stage, mappingPath);
    const scoring = (0, trigger_loader_1.scoringEnabledForTriggerStage)(triggerStage, scenario, scoringModesPath);
    const mandatoryPart = mandatoryHit ? `${mandatoryPath}#${mandatoryHit.id}` : 'mandatory:none';
    const granPart = `${granPath}:granularityGoverned=${granularityGoverned}`;
    const legacyPart = `legacy:auditRequired=${auditRequired},validationLevel=${validationLevel},strictness=${strictness},generateDoc=${generateDoc}`;
    const scoringPart = `scoringEnabled=${scoring.enabled}(${scoring.reason})`;
    const identityPart = identitySummaryParts.length > 0
        ? `identity:${identitySummaryParts.join(',')}`
        : 'identity:none';
    const reason = `${legacyPart}; convergence:${strictness}; ${mandatoryPart}; ${granPart}; trigger:${mappingDescriptor}; ${scoringPart}; ${identityPart}`;
    const compatibilitySource = runtimePolicyShadowModeForTests
        ? 'shadow'
        : 'governance';
    let policy = {
        flow,
        stage,
        auditRequired,
        validationLevel,
        strictness,
        generateDoc,
        convergence,
        mandatoryGate,
        granularityGoverned,
        skipAllowed,
        scoringEnabled: scoring.enabled,
        triggerStage,
        compatibilitySource,
        reason,
        identity: {
            flow,
            stage,
            ...(input.epicId ? { epicId: input.epicId } : {}),
            ...(input.storyId ? { storyId: input.storyId } : {}),
            ...(input.storySlug ? { storySlug: input.storySlug } : {}),
            ...(input.runId ? { runId: input.runId } : {}),
            ...(input.artifactRoot ? { artifactRoot: input.artifactRoot } : {}),
            ...(input.contextSource ? { contextSource: input.contextSource } : {}),
        },
        control: {
            auditRequired,
            validationLevel,
            strictness,
            generateDoc,
            convergence,
            mandatoryGate,
            granularityGoverned,
            skipAllowed,
            scoringEnabled: scoring.enabled,
            triggerStage,
            reason,
        },
        language: {
            preserveMachineKeys: true,
            preserveParserAnchors: true,
            preserveTriggerStage: true,
        },
    };
    if (input.templateId) {
        policy = mergeRuntimePolicyTemplate(policy, input.templateId, templatesPath, cfg);
    }
    policy = (0, runtime_governance_registry_1.applyRegisteredAugmenters)(policy, input);
    return policy;
}
