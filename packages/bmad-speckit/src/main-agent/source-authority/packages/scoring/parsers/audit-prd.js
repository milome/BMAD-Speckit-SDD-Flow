"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseError = exports.ReportFileNotFoundError = void 0;
exports.parsePrdReport = parsePrdReport;
/**
 * Story 3.2 T1: Layer 1 prd 审计报告解析器
 * 从 audit-prompts-prd 对应的审计报告提取 phase_score、check_items，映射环节 1
 * BUGFIX: item_id 优先从 _bmad/_config/audit-item-mapping.yaml 查找，无匹配 fallback prd-issue-N
 */
const fs = require("fs");
const path = require("path");
const weights_1 = require("../constants/weights");
const audit_generic_1 = require("./audit-generic");
const llm_fallback_1 = require("./llm-fallback");
const GRADE_TO_SCORE = {
    A: 100,
    B: 80,
    C: 60,
    D: 40,
};
/** prd 映射环节 1，权重 0.2 */
const PHASE_WEIGHT_PRD = weights_1.PHASE_WEIGHTS[0];
class ReportFileNotFoundError extends Error {
    reportPath;
    constructor(reportPath) {
        super(`Report file not found: ${reportPath}`);
        this.reportPath = reportPath;
        this.name = 'ReportFileNotFoundError';
    }
}
exports.ReportFileNotFoundError = ReportFileNotFoundError;
class ParseError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'ParseError';
    }
}
exports.ParseError = ParseError;
/**
 * Parse PRD audit report and produce RunScoreRecord.
 * Grade A/B/C/D maps to 100/80/60/40; 问题清单 → check_items.
 * @param {ParsePrdReportInput} input - content or reportPath, runId, scenario
 * @returns {Promise<RunScoreRecord>} RunScoreRecord for prd stage
 * @throws {ReportFileNotFoundError} If reportPath does not exist
 * @throws {ParseError} If content/reportPath missing or grade cannot be extracted
 */
async function parsePrdReport(input) {
    let content;
    if (input.content != null) {
        content = input.content;
    }
    else if (input.reportPath != null) {
        const absPath = path.isAbsolute(input.reportPath)
            ? input.reportPath
            : path.resolve(process.cwd(), input.reportPath);
        if (!fs.existsSync(absPath)) {
            throw new ReportFileNotFoundError(absPath);
        }
        content = fs.readFileSync(absPath, 'utf-8');
    }
    else {
        throw new ParseError('Either content or reportPath must be provided');
    }
    let grade = (0, audit_generic_1.extractOverallGrade)(content);
    let checkItems;
    if (!grade) {
        if (process.env.SCORING_LLM_API_KEY) {
            const llmResult = await (0, llm_fallback_1.llmStructuredExtract)(content, 'prd');
            grade = llmResult.grade;
            checkItems = (0, llm_fallback_1.mapLlmResultToCheckItems)(llmResult, 'prd');
        }
        else {
            throw new ParseError('Could not extract 总体评级 from PRD report');
        }
    }
    else {
        checkItems = (0, audit_generic_1.extractCheckItems)(content, 'prd');
    }
    const phaseScore = GRADE_TO_SCORE[grade] ?? 60;
    return {
        run_id: input.runId,
        scenario: input.scenario,
        stage: 'prd',
        phase_score: phaseScore,
        phase_weight: PHASE_WEIGHT_PRD,
        check_items: checkItems,
        timestamp: new Date().toISOString(),
        iteration_count: 0,
        iteration_records: [],
        first_pass: true,
    };
}
