"use strict";
/**
 * BMAD Configuration Loader
 *
 * 跨平台配置加载器，支持 Cursor 和 Claude Code CLI 环境
 * 负责读取审计粒度配置并提供运行时决策支持
 */
/* eslint-disable jsdoc/require-description, jsdoc/require-param, jsdoc/require-param-description, jsdoc/require-param-type, jsdoc/require-returns, jsdoc/require-returns-description, jsdoc/require-returns-type */
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
exports.resolveBmadHelpRuntimePolicy = exports.resolveBmadHelpRoutingState = void 0;
exports.detectEnvironment = detectEnvironment;
exports.setEnvironment = setEnvironment;
exports.loadConfigFromFile = loadConfigFromFile;
exports.getDefaultConfig = getDefaultConfig;
exports.loadConfig = loadConfig;
exports.getCurrentMode = getCurrentMode;
exports.isAutoContinueEnabled = isAutoContinueEnabled;
exports.shouldAutoContinue = shouldAutoContinue;
exports.getStageConfig = getStageConfig;
exports.shouldAudit = shouldAudit;
exports.shouldValidate = shouldValidate;
exports.shouldGenerateDoc = shouldGenerateDoc;
exports.getStrictness = getStrictness;
exports.getValidationChecks = getValidationChecks;
exports.getAuditConvergence = getAuditConvergence;
exports.getSubagentParams = getSubagentParams;
exports.getEnvironment = getEnvironment;
exports.getI18nConfig = getI18nConfig;
exports.getReportPathTemplate = getReportPathTemplate;
exports.formatReportPath = formatReportPath;
exports.printConfigSummary = printConfigSummary;
exports.validateConfig = validateConfig;
const node_fs_1 = require("node:fs");
const yaml = __importStar(require("js-yaml"));
const runtime_governance_1 = require("./runtime-governance");
var bmad_help_routing_state_1 = require("./bmad-help-routing-state");
Object.defineProperty(exports, "resolveBmadHelpRoutingState", { enumerable: true, get: function () { return bmad_help_routing_state_1.resolveBmadHelpRoutingState; } });
Object.defineProperty(exports, "resolveBmadHelpRuntimePolicy", { enumerable: true, get: function () { return bmad_help_routing_state_1.resolveBmadHelpRuntimePolicy; } });
// =============================================================================
// Runtime Governance delegation (U-1.6)
// U-1.5c：`runtime-governance.ts` **不**再调用本文件的 `shouldAudit` 等（改用 `getStageConfig` 同源求值），故可与本文件 **静态** 互 import 而无运行期环。
// Shadow **策略 B** — 并行对比仅在 `tests/acceptance/runtime-governance-shadow.test.ts`。
// =============================================================================
function callResolveRuntimePolicy(input) {
    return (0, runtime_governance_1.resolveRuntimePolicy)(input);
}
/**
 * 仅有 `stage` 的 helper 无 `flow` 上下文时，委托 `resolveRuntimePolicy` 使用固定 `story`（Story 主路径）。
 * Epic/bugfix 等显式 flow 请直接调用 `resolveRuntimePolicy({ flow, stage, config })`。
 */
const BMAD_HELPER_GOVERNANCE_FLOW = 'story';
// =============================================================================
// Constants
// =============================================================================
/** 仓库内默认 BMAD Story 配置路径；`loadConfigFromFile` / `loadConfig` 在未传参时使用 `EnvironmentConfig.configPath`（默认等同此路径）。 */
const DEFAULT_CONFIG_PATH = 'config/bmad-story-config.yaml';
const DEFAULT_MODE = 'full';
/**
 * 阶段默认语义在 YAML / 内嵌默认中的键路径（与 `getDefaultConfig()` 结构一致；文件缺失时仅内嵌默认生效）：
 *
 * | Helper | YAML / 对象路径 | 缺省（代码回退） |
 * |--------|----------------|------------------|
 * | `shouldAudit` | `audit_granularity.modes.<full\|story\|epic>.stages.<StageName>.audit` | `true`（`getStageConfig` 未命中时） |
 * | `shouldValidate` | `...stages.<StageName>.validation` | `null` |
 * | `shouldGenerateDoc` | `...stages.<StageName>.generate_doc` | `true` |
 * | `getStrictness` | `...stages.<StageName>.strictness` | `'standard'` |
 * | `getValidationChecks` | `...stages.<StageName>.checks` | `[]` |
 *
 * 当前模式：`audit_granularity.mode`。覆盖来源：`BMAD_AUDIT_GRANULARITY`、`--audit-granularity=`（见 `parseEnvOverrides` / `parseCliFlags`）。
 */
// Cache only configuration-level data derived from defaults + file/env/CLI merge.
// This module owns config loading / merge / exposure only.
// It must not cache invocation-level language decisions, recent-message detection results,
// display-mode orchestration, or any Runtime Governance decisions.
// In particular, this cache must never become a store for fields such as:
// auditRequired, validationLevel, mandatoryGate, granularityGoverned,
// skipAllowed, scoringEnabled, or triggerStage.
let cachedConfig = null;
// Build a runtime-shaped config from configuration sources only.
// This helper may apply config/env/CLI overrides that belong to config loading,
// but it must not resolve LanguagePolicy and must not derive governance-owned fields
// such as auditRequired, validationLevel, mandatoryGate, granularityGoverned,
// skipAllowed, scoringEnabled, or triggerStage.
function buildRuntimeConfig(baseConfig, env) {
    const mergedConfig = mergeConfig(baseConfig, {});
    const envOverrides = parseEnvOverrides();
    const cliFlags = parseCliFlags();
    const runtimeEnv = { ...env };
    const override = mergedConfig.environment_overrides[runtimeEnv.platform];
    if (override) {
        runtimeEnv.subagentTool = override.subagent_tool;
        runtimeEnv.subagentType = override.default_subagent_type;
    }
    if (envOverrides.auditGranularity) {
        mergedConfig.audit_granularity.mode = envOverrides.auditGranularity;
    }
    if (cliFlags.auditGranularity) {
        mergedConfig.audit_granularity.mode = cliFlags.auditGranularity;
    }
    if (typeof envOverrides.autoContinue === 'boolean') {
        mergedConfig.auto_continue.enabled = envOverrides.autoContinue;
    }
    if (typeof cliFlags.autoContinue === 'boolean') {
        mergedConfig.auto_continue.enabled = cliFlags.autoContinue;
    }
    return {
        ...mergedConfig,
        _environment: runtimeEnv,
    };
}
function parseCliFlags(argv = process.argv.slice(2)) {
    const result = {};
    for (const arg of argv) {
        if (arg === '--continue') {
            result.autoContinue = true;
            continue;
        }
        if (arg.startsWith('--audit-granularity=')) {
            const value = arg.split('=')[1];
            if (value === 'full' || value === 'story' || value === 'epic') {
                result.auditGranularity = value;
            }
        }
    }
    return result;
}
function parseEnvOverrides() {
    const result = {};
    const envMode = process.env.BMAD_AUDIT_GRANULARITY;
    if (envMode === 'full' || envMode === 'story' || envMode === 'epic') {
        result.auditGranularity = envMode;
    }
    const envContinue = process.env.BMAD_AUTO_CONTINUE?.toLowerCase();
    if (envContinue === 'true') {
        result.autoContinue = true;
    }
    if (envContinue === 'false') {
        result.autoContinue = false;
    }
    return result;
}
const ENV_CURSOR = {
    platform: 'cursor',
    subagentTool: 'mcp_task',
    subagentType: 'generalPurpose',
    skillsRoot: '.cursor/skills',
    agentsRoot: '.cursor/agents',
    configPath: DEFAULT_CONFIG_PATH,
};
const ENV_CLAUDE = {
    platform: 'claude',
    subagentTool: 'Agent',
    subagentType: 'general-purpose',
    skillsRoot: '.claude/skills',
    agentsRoot: '.claude/agents',
    configPath: DEFAULT_CONFIG_PATH,
};
// =============================================================================
// Environment Detection
// =============================================================================
/**
 * 检测当前运行环境
 * 优先级：
 * 1. 环境变量 BMAD_PLATFORM
 * 2. 配置文件位置检测
 * 3. 目录结构检测
 * 4. 默认使用 claude
 */
function detectEnvironment() {
    // 方法1: 检查环境变量
    const envPlatform = process.env.BMAD_PLATFORM?.toLowerCase();
    if (envPlatform === 'cursor') {
        return { ...ENV_CURSOR };
    }
    if (envPlatform === 'claude') {
        return { ...ENV_CLAUDE };
    }
    // 方法2: 检查 Cursor 目录结构
    if ((0, node_fs_1.existsSync)('.cursor')) {
        return { ...ENV_CURSOR };
    }
    // 方法3: 检查是否运行在 Claude Code CLI 环境
    if (process.env.CLAUDE_CODE_CLI === 'true') {
        return { ...ENV_CLAUDE };
    }
    // 默认假设为 Claude Code CLI
    return { ...ENV_CLAUDE };
}
/**
 * 显式设置运行环境（用于测试或强制指定）
 * @param platform
 */
function setEnvironment(platform) {
    process.env.BMAD_PLATFORM = platform;
    cachedConfig = null;
    return detectEnvironment();
}
// =============================================================================
// Configuration Loading
// =============================================================================
/**
 * 从 YAML 文件加载配置
 * @param configPath 配置文件路径（可选，默认使用 DEFAULT_CONFIG_PATH）
 * @returns 解析后的配置对象
 */
function loadConfigFromFile(configPath) {
    const path = configPath || DEFAULT_CONFIG_PATH;
    if (!(0, node_fs_1.existsSync)(path)) {
        // 如果配置文件不存在，返回空配置（使用默认值）
        return {};
    }
    try {
        const content = (0, node_fs_1.readFileSync)(path, 'utf8');
        return yaml.load(content);
    }
    catch (error) {
        console.error(`[bmad-config] 读取配置文件失败: ${path}`, error);
        return {};
    }
}
/**
 * 获取默认配置
 */
function getDefaultConfig() {
    return {
        version: '1.0',
        i18n: {
            default_language_mode: 'auto',
            default_artifact_language: 'auto',
            allow_bilingual_auto_mode: false,
            fallback_language: 'en',
            preserve_control_keys_in_english: true,
            preserve_commands_and_paths: true,
            render_bilingual_headings_with_slash: true,
        },
        audit_granularity: {
            mode: DEFAULT_MODE,
            modes: {
                full: {
                    name: '全流程审计',
                    description: '所有阶段都执行严格审计（默认模式）',
                    stages: {
                        story_create: { audit: true, strictness: 'standard' },
                        story_audit: { audit: true, strictness: 'standard' },
                        specify: { audit: true, strictness: 'standard' },
                        plan: { audit: true, strictness: 'standard' },
                        gaps: { audit: true, strictness: 'standard' },
                        tasks: { audit: true, strictness: 'standard' },
                        implement: { audit: true, strictness: 'strict' },
                        post_audit: { audit: true, strictness: 'strict' },
                        epic_create: { audit: false },
                        epic_complete: { audit: false },
                    },
                },
                story: {
                    name: 'Story级轻量审计',
                    description: '仅在Story创建和实施后执行审计，中间阶段只做验证',
                    stages: {
                        story_create: { audit: true, strictness: 'standard' },
                        story_audit: { audit: true, strictness: 'standard' },
                        specify: {
                            audit: false,
                            generate_doc: true,
                            validation: 'basic',
                            checks: ['document_exists', 'schema_valid', 'required_sections'],
                        },
                        plan: {
                            audit: false,
                            generate_doc: true,
                            validation: 'basic',
                            checks: ['document_exists', 'schema_valid', 'required_sections'],
                        },
                        gaps: {
                            audit: false,
                            generate_doc: true,
                            validation: 'basic',
                            checks: ['document_exists', 'gap_items_defined'],
                        },
                        tasks: {
                            audit: false,
                            generate_doc: true,
                            validation: 'basic',
                            checks: ['document_exists', 'task_list_complete'],
                        },
                        implement: {
                            audit: false,
                            generate_doc: true,
                            validation: 'test_only',
                            checks: ['all_tests_pass', 'lint_no_errors', 'document_exists'],
                        },
                        post_audit: {
                            audit: true,
                            strictness: 'strict',
                            checks: [
                                'tdd_evidence',
                                'ralph_method_compliance',
                                'code_quality',
                                'integration_tests',
                            ],
                        },
                        epic_create: { audit: false },
                        epic_complete: { audit: false },
                    },
                },
                epic: {
                    name: 'Epic级综合审计',
                    description: '仅在Epic创建和完成后执行审计，Story级只做文档生成',
                    stages: {
                        story_create: { audit: false, generate_doc: true, validation: null },
                        story_audit: { audit: false, generate_doc: true, validation: null },
                        specify: { audit: false, generate_doc: true, validation: null },
                        plan: { audit: false, generate_doc: true, validation: null },
                        gaps: { audit: false, generate_doc: true, validation: null },
                        tasks: { audit: false, generate_doc: true, validation: null },
                        implement: {
                            audit: false,
                            generate_doc: true,
                            validation: 'test_only',
                            checks: ['all_tests_pass', 'lint_no_errors'],
                        },
                        post_audit: { audit: false },
                        epic_create: {
                            audit: true,
                            strictness: 'standard',
                            optional: true,
                            checks: [
                                'epic_scope_clarity',
                                'story_split_reasonableness',
                                'cross_story_dependencies',
                                'epic_architecture_feasibility',
                            ],
                        },
                        epic_complete: {
                            audit: true,
                            strictness: 'strict',
                            required_rounds: 3,
                            checks: [
                                'cross_story_consistency',
                                'epic_architecture_compliance',
                                'integration_completeness',
                                'comprehensive_code_quality',
                                'comprehensive_test_coverage',
                                'documentation_completeness',
                            ],
                        },
                    },
                },
            },
        },
        auto_continue: {
            enabled: false,
            require_ready_flag: true,
            require_next_action: true,
            source_priority: ['cli', 'env', 'file', 'default'],
        },
        validation_levels: {
            basic: {
                description: '基础文档验证',
                checks: [
                    { name: 'document_exists', description: '文档存在性检查', required: true },
                    { name: 'schema_valid', description: '基本结构检查', required: true },
                    { name: 'required_sections', description: '必需章节检查', required: true },
                ],
            },
            test_only: {
                description: '仅测试验证',
                checks: [
                    { name: 'all_tests_pass', description: '所有测试通过', required: true },
                    { name: 'lint_no_errors', description: 'Lint无错误', required: true },
                    { name: 'document_exists', description: '文档存在', required: true },
                ],
            },
            full_validation: {
                description: '完整验证（不审计）',
                checks: [
                    { name: 'document_exists', required: true },
                    { name: 'schema_valid', required: true },
                    { name: 'content_completeness', required: true },
                    { name: 'cross_reference_valid', required: true },
                ],
            },
        },
        audit_convergence: {
            default: 'standard',
            strict: {
                description: '严格模式',
                rounds: 3,
                no_gap_required: true,
                critical_auditor_ratio: 0.5,
                applicable_stages: ['implement', 'post_audit', 'epic_complete'],
            },
            standard: {
                description: '标准模式',
                rounds: 1,
                no_gap_required: false,
                critical_auditor_ratio: 0.5,
                applicable_stages: ['story_audit', 'specify', 'plan', 'gaps', 'tasks', 'epic_create'],
            },
        },
        notifications: {
            when_audit_skipped: true,
            when_epic_completed: true,
            when_validation_failed: true,
        },
        report_paths: {
            story_audit: '_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_story-{epic}-{story}.md',
            specify: 'specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_spec-E{epic}-S{story}.md',
            plan: 'specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_plan-E{epic}-S{story}.md',
            gaps: 'specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_GAPS-E{epic}-S{story}.md',
            tasks: 'specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_tasks-E{epic}-S{story}.md',
            implement: 'specs/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_implement-E{epic}-S{story}.md',
            post_audit: '_bmad-output/implementation-artifacts/epic-{epic}-{epic-slug}/story-{story}-{slug}/AUDIT_Story_{epic}-{story}_stage4.md',
            epic_create: '_bmad-output/epic-{epic}-{epic-slug}/AUDIT_Epic_{epic}_create.md',
            epic_complete: '_bmad-output/epic-{epic}-{epic-slug}/AUDIT_Epic_{epic}.md',
            epic_completion_report: '_bmad-output/epic-{epic}-{epic-slug}/EPIC_COMPLETION_REPORT.md',
        },
        environment_overrides: {
            cursor: {
                subagent_tool: 'mcp_task',
                default_subagent_type: 'generalPurpose',
            },
            claude: {
                subagent_tool: 'Agent',
                default_subagent_type: 'general-purpose',
            },
        },
    };
}
/**
 * 合并配置（深度合并）
 * @param base
 * @param override
 */
function mergeConfig(base, override) {
    return {
        ...base,
        ...override,
        audit_granularity: {
            ...base.audit_granularity,
            ...override.audit_granularity,
            modes: {
                ...base.audit_granularity.modes,
                ...override.audit_granularity?.modes,
            },
        },
        auto_continue: {
            ...base.auto_continue,
            ...override.auto_continue,
        },
        notifications: {
            ...base.notifications,
            ...override.notifications,
        },
        i18n: {
            ...base.i18n,
            ...override.i18n,
        },
        report_paths: {
            ...base.report_paths,
            ...override.report_paths,
        },
        environment_overrides: {
            ...base.environment_overrides,
            ...override.environment_overrides,
        },
    };
}
// =============================================================================
// Main Configuration API
// =============================================================================
/**
 * 加载完整运行时配置
 * @param configPath 配置文件路径（可选）
 * @returns 运行时配置（包含环境信息）
 */
function loadConfig(configPath) {
    const env = detectEnvironment();
    if (!configPath && cachedConfig) {
        return buildRuntimeConfig(cachedConfig, env);
    }
    const baseConfig = getDefaultConfig();
    const fileConfig = loadConfigFromFile(configPath || env.configPath);
    const mergedConfig = mergeConfig(baseConfig, fileConfig);
    const runtimeConfig = buildRuntimeConfig(mergedConfig, env);
    if (!configPath) {
        cachedConfig = {
            ...mergedConfig,
            _environment: runtimeConfig._environment,
        };
    }
    return runtimeConfig;
}
/**
 * 获取当前审计粒度模式
 * @param config
 */
function getCurrentMode(config) {
    const cfg = config || loadConfig();
    return cfg.audit_granularity.mode;
}
function isAutoContinueEnabled(config) {
    const cfg = config || loadConfig();
    return cfg.auto_continue.enabled;
}
function shouldAutoContinue(handoff, config) {
    const cfg = config || loadConfig();
    const resumeProjection = handoff?.runtimeResumeProjection;
    const projectionBacked = resumeProjection?.source === 'requirement_record';
    const effectiveNextAction = projectionBacked ? resumeProjection?.runtimeNextAction : undefined;
    const effectiveReady = projectionBacked ? resumeProjection?.ready : undefined;
    if (!cfg.auto_continue.enabled) {
        return false;
    }
    if (cfg.auto_continue.require_next_action && !effectiveNextAction) {
        return false;
    }
    if (cfg.auto_continue.require_ready_flag && effectiveReady !== true) {
        return false;
    }
    return true;
}
/**
 * 获取当前模式的阶段配置
 * @param stage
 * @param config
 */
function getStageConfig(stage, config) {
    const cfg = config || loadConfig();
    const mode = cfg.audit_granularity.mode;
    return cfg.audit_granularity.modes[mode]?.stages[stage];
}
// =============================================================================
// Audit & Validation Decision API
// =============================================================================
/**
 * 判断指定阶段是否需要执行审计
 * @param stage 阶段名称
 * @param config 运行时配置（可选，会自动加载）
 * @returns 是否需要审计
 */
function shouldAudit(stage, config) {
    return callResolveRuntimePolicy({
        flow: BMAD_HELPER_GOVERNANCE_FLOW,
        stage,
        config,
    }).auditRequired;
}
/**
 * 判断指定阶段是否需要验证
 * @param stage 阶段名称
 * @param config 运行时配置（可选，会自动加载）
 * @returns 验证级别，null 表示不需要验证
 */
function shouldValidate(stage, config) {
    return callResolveRuntimePolicy({
        flow: BMAD_HELPER_GOVERNANCE_FLOW,
        stage,
        config,
    }).validationLevel;
}
/**
 * 判断指定阶段是否需要生成文档
 * @param stage 阶段名称
 * @param config 运行时配置（可选，会自动加载）
 * @returns 是否需要生成文档
 */
function shouldGenerateDoc(stage, config) {
    return callResolveRuntimePolicy({
        flow: BMAD_HELPER_GOVERNANCE_FLOW,
        stage,
        config,
    }).generateDoc;
}
/**
 * 获取阶段的严格度配置
 * @param stage 阶段名称
 * @param config 运行时配置（可选，会自动加载）
 * @returns 严格度级别
 */
function getStrictness(stage, config) {
    return callResolveRuntimePolicy({
        flow: BMAD_HELPER_GOVERNANCE_FLOW,
        stage,
        config,
    }).strictness;
}
/**
 * 获取阶段的验证检查项列表
 * @param stage 阶段名称
 * @param config 运行时配置（可选，会自动加载）
 * @returns 检查项列表
 */
function getValidationChecks(stage, config) {
    const stageConfig = getStageConfig(stage, config);
    return stageConfig?.checks ?? [];
}
/**
 * 获取审计收敛配置（`audit_convergence.<strictness>`）。
 * 与 `resolveRuntimePolicy(...).convergence` **同源**：同一 `strictness` + 同一合并后的 `config` 时结果一致。
 *
 * @param strictness 严格度级别
 * @param config 运行时配置（可选，会自动加载）
 * @returns 审计收敛配置
 */
function getAuditConvergence(strictness, config) {
    const cfg = config || loadConfig();
    return cfg.audit_convergence[strictness];
}
// =============================================================================
// Subagent & Environment API
// =============================================================================
/**
 * 获取 Subagent 调用参数（适配当前环境）
 * @param config 运行时配置（可选，会自动加载）
 * @returns Subagent 调用参数
 */
function getSubagentParams(config) {
    const cfg = config || loadConfig();
    const env = cfg._environment;
    return {
        tool: env.subagentTool,
        subagent_type: env.subagentType,
    };
}
/**
 * 获取环境配置
 * @returns 当前环境配置
 */
function getEnvironment(config) {
    if (config?._environment) {
        return config._environment;
    }
    return loadConfig()._environment;
}
/**
 * 获取 i18n 配置
 * @param config 运行时配置（可选，会自动加载）
 *
 * This accessor exposes configuration only.
 * It must not resolve LanguagePolicy, must not perform request-scoped precedence resolution,
 * must not inspect recent messages, and must not orchestrate display mode at runtime.
 * It also must not expose or derive Runtime Governance-owned fields such as:
 * auditRequired, validationLevel, mandatoryGate, granularityGoverned,
 * skipAllowed, scoringEnabled, or triggerStage.
 */
function getI18nConfig(config) {
    const cfg = config || loadConfig();
    return {
        default_language_mode: cfg.i18n.default_language_mode,
        default_artifact_language: cfg.i18n.default_artifact_language,
        allow_bilingual_auto_mode: cfg.i18n.allow_bilingual_auto_mode,
        fallback_language: cfg.i18n.fallback_language,
        preserve_control_keys_in_english: cfg.i18n.preserve_control_keys_in_english,
        preserve_commands_and_paths: cfg.i18n.preserve_commands_and_paths,
        render_bilingual_headings_with_slash: cfg.i18n.render_bilingual_headings_with_slash,
    };
}
/**
 * 获取报告路径模板
 * @param stage 阶段名称（仅限有报告路径的阶段）
 * @param config 运行时配置（可选，会自动加载）
 * @returns 路径模板（包含占位符）
 */
function getReportPathTemplate(stage, config) {
    const cfg = config || loadConfig();
    return cfg.report_paths[stage] || '';
}
/**
 * 格式化报告路径（替换占位符）
 * @param template 路径模板
 * @param params 替换参数
 * @param params.epic
 * @param params.story
 * @param params.epicSlug
 * @param params.storySlug
 * @returns 格式化后的路径
 */
function formatReportPath(template, params) {
    return template
        .replace(/\{epic\}/g, params.epic)
        .replace(/\{story\}/g, params.story || '')
        .replace(/\{epic-slug\}/g, params.epicSlug || params.epic.toLowerCase())
        .replace(/\{slug\}/g, params.storySlug || params.story?.toLowerCase() || '');
}
// =============================================================================
// Utility Functions
// =============================================================================
/**
 * 打印当前配置摘要（用于调试）
 * @param config
 */
function printConfigSummary(config) {
    const cfg = config || loadConfig();
    const env = cfg._environment;
    console.log('\n========== BMAD Configuration Summary ==========');
    console.log(`Version: ${cfg.version}`);
    console.log(`Platform: ${env.platform}`);
    console.log(`Subagent Tool: ${env.subagentTool}`);
    console.log(`Subagent Type: ${env.subagentType}`);
    console.log(`Audit Granularity Mode: ${cfg.audit_granularity.mode}`);
    console.log('\nStage Configuration:');
    const mode = cfg.audit_granularity.modes[cfg.audit_granularity.mode];
    for (const [stage, stageCfg] of Object.entries(mode.stages)) {
        const status = stageCfg?.audit ? '🔍 AUDIT' : stageCfg?.validation ? '✓ VALIDATE' : '⏭ SKIP';
        console.log(`  ${stage}: ${status}`);
    }
    console.log('================================================\n');
}
/**
 * 验证配置完整性
 * @param config 要验证的配置
 * @returns 验证结果
 */
function validateConfig(config) {
    const errors = [];
    if (!config.version) {
        errors.push('Missing version field');
    }
    if (!config.audit_granularity?.mode) {
        errors.push('Missing audit_granularity.mode');
    }
    const validModes = ['full', 'story', 'epic'];
    if (config.audit_granularity?.mode && !validModes.includes(config.audit_granularity.mode)) {
        errors.push(`Invalid mode: ${config.audit_granularity.mode}`);
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
// =============================================================================
// Export all
// =============================================================================
exports.default = {
    loadConfig,
    getCurrentMode,
    getStageConfig,
    shouldAudit,
    shouldValidate,
    shouldGenerateDoc,
    getStrictness,
    getValidationChecks,
    getAuditConvergence,
    getSubagentParams,
    getEnvironment,
    getI18nConfig,
    getReportPathTemplate,
    formatReportPath,
    printConfigSummary,
    validateConfig,
    detectEnvironment,
    setEnvironment,
    getDefaultConfig,
};
