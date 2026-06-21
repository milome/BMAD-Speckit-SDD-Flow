"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLM_SYSTEM_PROMPT = exports.LlmExtractionResult = exports.mapLlmResultToCheckItems = exports.llmStructuredExtract = exports.ParseError = exports.ReportFileNotFoundError = exports.extractStructuredDriftSignalBlock = exports.extractCheckItems = exports.extractOverallGrade = exports.parseGenericReport = exports.parseStoryReport = exports.parseArchReport = exports.parsePrdReport = void 0;
exports.parseAuditReport = parseAuditReport;
/**
 * Story 3.2 T5: parseAuditReport 统一入口
 * 根据 stage 调度 prd/arch/story/spec/plan/tasks 解析器
 */
const fs = require("fs");
const path = require("path");
const audit_prd_1 = require("./audit-prd");
const audit_arch_1 = require("./audit-arch");
const audit_story_1 = require("./audit-story");
const audit_generic_1 = require("./audit-generic");
const audit_prd_2 = require("./audit-prd");
const weights_1 = require("../constants/weights");
function getInlineContent(options) {
    if (options.content != null)
        return options.content;
    if (options.reportPath != null) {
        const absPath = path.isAbsolute(options.reportPath)
            ? options.reportPath
            : path.resolve(process.cwd(), options.reportPath);
        if (!fs.existsSync(absPath)) {
            throw new audit_prd_2.ReportFileNotFoundError(absPath);
        }
        return fs.readFileSync(absPath, 'utf-8');
    }
    throw new audit_prd_2.ParseError('Either content or reportPath must be provided');
}
/**
 * Parse audit report by stage and return RunScoreRecord.
 * Dispatches to prd/arch/story or parseGenericReport for spec/plan/tasks/implement.
 * @param {ParseAuditReportOptions} options - reportPath or content, stage, runId, scenario
 * @returns {Promise<RunScoreRecord>} Parsed RunScoreRecord
 * @throws {ReportFileNotFoundError} If reportPath does not exist
 * @throws {ParseError} If neither content nor reportPath provided or parse fails
 */
async function parseAuditReport(options) {
    const { stage, runId, scenario } = options;
    const input = {
        content: options.content,
        reportPath: options.reportPath,
        runId,
        scenario,
    };
    switch (stage) {
        case 'prd':
            return (0, audit_prd_1.parsePrdReport)(input);
        case 'arch':
            return (0, audit_arch_1.parseArchReport)(input);
        case 'story':
            return (0, audit_story_1.parseStoryReport)(input);
        case 'spec':
            return (0, audit_generic_1.parseGenericReport)({
                content: getInlineContent(options),
                stage: 'spec',
                runId,
                scenario,
                phaseWeight: weights_1.PHASE_WEIGHTS_SPEC,
            });
        case 'plan':
            return (0, audit_generic_1.parseGenericReport)({
                content: getInlineContent(options),
                stage: 'plan',
                runId,
                scenario,
                phaseWeight: weights_1.PHASE_WEIGHTS_PLAN,
            });
        case 'gaps':
            return (0, audit_generic_1.parseGenericReport)({
                content: getInlineContent(options),
                stage: 'gaps',
                runId,
                scenario,
                phaseWeight: weights_1.PHASE_WEIGHTS_PLAN,
            });
        case 'tasks':
            return (0, audit_generic_1.parseGenericReport)({
                content: getInlineContent(options),
                stage: 'tasks',
                runId,
                scenario,
                phaseWeight: weights_1.PHASE_WEIGHTS_TASKS,
            });
        case 'implement':
            return (0, audit_generic_1.parseGenericReport)({
                content: getInlineContent(options),
                stage: 'implement',
                runId,
                scenario,
                phaseWeight: weights_1.PHASE_WEIGHT_IMPLEMENT,
            });
        case 'post_impl':
            return (0, audit_generic_1.parseGenericReport)({
                content: getInlineContent(options),
                stage: 'post_impl',
                runId,
                scenario,
                phaseWeight: weights_1.PHASE_WEIGHT_IMPLEMENT,
            });
        case 'implementation_readiness':
            return (0, audit_generic_1.parseGenericReport)({
                content: getInlineContent(options),
                stage: 'implementation_readiness',
                runId,
                scenario,
                phaseWeight: weights_1.PHASE_WEIGHT_READINESS,
            });
        default: {
            const _ = stage;
            throw new Error(`Unknown audit stage: ${stage}`);
        }
    }
}
var audit_prd_3 = require("./audit-prd");
Object.defineProperty(exports, "parsePrdReport", { enumerable: true, get: function () { return audit_prd_3.parsePrdReport; } });
var audit_arch_2 = require("./audit-arch");
Object.defineProperty(exports, "parseArchReport", { enumerable: true, get: function () { return audit_arch_2.parseArchReport; } });
var audit_story_2 = require("./audit-story");
Object.defineProperty(exports, "parseStoryReport", { enumerable: true, get: function () { return audit_story_2.parseStoryReport; } });
var audit_generic_2 = require("./audit-generic");
Object.defineProperty(exports, "parseGenericReport", { enumerable: true, get: function () { return audit_generic_2.parseGenericReport; } });
Object.defineProperty(exports, "extractOverallGrade", { enumerable: true, get: function () { return audit_generic_2.extractOverallGrade; } });
Object.defineProperty(exports, "extractCheckItems", { enumerable: true, get: function () { return audit_generic_2.extractCheckItems; } });
var audit_generic_3 = require("./audit-generic");
Object.defineProperty(exports, "extractStructuredDriftSignalBlock", { enumerable: true, get: function () { return audit_generic_3.extractStructuredDriftSignalBlock; } });
var audit_prd_4 = require("./audit-prd");
Object.defineProperty(exports, "ReportFileNotFoundError", { enumerable: true, get: function () { return audit_prd_4.ReportFileNotFoundError; } });
Object.defineProperty(exports, "ParseError", { enumerable: true, get: function () { return audit_prd_4.ParseError; } });
var llm_fallback_1 = require("./llm-fallback");
Object.defineProperty(exports, "llmStructuredExtract", { enumerable: true, get: function () { return llm_fallback_1.llmStructuredExtract; } });
Object.defineProperty(exports, "mapLlmResultToCheckItems", { enumerable: true, get: function () { return llm_fallback_1.mapLlmResultToCheckItems; } });
Object.defineProperty(exports, "LlmExtractionResult", { enumerable: true, get: function () { return llm_fallback_1.LlmExtractionResult; } });
Object.defineProperty(exports, "LLM_SYSTEM_PROMPT", { enumerable: true, get: function () { return llm_fallback_1.LLM_SYSTEM_PROMPT; } });
