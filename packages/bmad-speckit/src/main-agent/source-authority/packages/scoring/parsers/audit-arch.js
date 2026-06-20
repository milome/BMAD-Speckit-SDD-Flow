"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArchReport = parseArchReport;
/**
 * Story 3.2 T2: Layer 1 arch 审计报告解析器
 * 从 audit-prompts-arch 对应的审计报告提取 phase_score、check_items
 * BUGFIX: item_id 优先从 _bmad/_config/audit-item-mapping.yaml 查找，无匹配 fallback arch-issue-N
 */
const fs = require("fs");
const path = require("path");
const weights_1 = require("../constants/weights");
const audit_prd_1 = require("./audit-prd");
const audit_generic_1 = require("./audit-generic");
const llm_fallback_1 = require("./llm-fallback");
const audit_item_mapping_1 = require("./audit-item-mapping");
const GRADE_TO_SCORE = {
    A: 100,
    B: 80,
    C: 60,
    D: 40,
};
const PHASE_WEIGHT_ARCH = weights_1.PHASE_WEIGHTS[0]; // 环节 1 补充
/**
 * Parse Architecture audit report and produce RunScoreRecord.
 * Grade A/B/C/D maps to 100/80/60/40.
 * @param {ParseArchReportInput} input - content or reportPath, runId, scenario
 * @returns {Promise<RunScoreRecord>} RunScoreRecord for arch stage
 * @throws {ReportFileNotFoundError} If reportPath does not exist
 * @throws {ParseError} If content/reportPath missing or grade cannot be extracted
 */
async function parseArchReport(input) {
    let content;
    if (input.content != null) {
        content = input.content;
    }
    else if (input.reportPath != null) {
        const absPath = path.isAbsolute(input.reportPath)
            ? input.reportPath
            : path.resolve(process.cwd(), input.reportPath);
        if (!fs.existsSync(absPath)) {
            throw new audit_prd_1.ReportFileNotFoundError(absPath);
        }
        content = fs.readFileSync(absPath, 'utf-8');
    }
    else {
        throw new audit_prd_1.ParseError('Either content or reportPath must be provided');
    }
    let grade = (0, audit_generic_1.extractOverallGrade)(content);
    let checkItems;
    if (!grade) {
        if (process.env.SCORING_LLM_API_KEY) {
            const llmResult = await (0, llm_fallback_1.llmStructuredExtract)(content, 'arch');
            grade = llmResult.grade;
            checkItems = (0, llm_fallback_1.mapLlmResultToCheckItems)(llmResult, 'arch');
        }
        else {
            throw new audit_prd_1.ParseError('Could not extract 总体评级 from Architecture report');
        }
    }
    else {
        checkItems = extractCheckItemsFromArch(content);
    }
    const phaseScore = GRADE_TO_SCORE[grade] ?? 60;
    return {
        run_id: input.runId,
        scenario: input.scenario,
        stage: 'arch',
        phase_score: phaseScore,
        phase_weight: PHASE_WEIGHT_ARCH,
        check_items: checkItems,
        timestamp: new Date().toISOString(),
        iteration_count: 0,
        iteration_records: [],
        first_pass: true,
    };
}
function extractCheckItemsFromArch(content) {
    const items = [];
    const problemSection = content.match(/(?:问题清单|Issue List|Problem List):\s*([\s\S]*?)(?=通过标准:|下一步行动:|Pass Criteria:|Next Actions:|$)/i);
    if (!problemSection) {
        items.push({
            item_id: (0, audit_item_mapping_1.resolveEmptyItemId)('arch', 'overall', 'arch-overall'),
            passed: true,
            score_delta: 0,
            note: '从维度评分',
        });
        return items;
    }
    const lines = problemSection[1].trim().split(/\n/).filter(Boolean);
    let idx = 0;
    for (const line of lines) {
        const m = line.match(/^\d+\.\s*\[(?:严重程度|Severity):([^\]]+)\]\s*(.+)/);
        if (m) {
            const severity = m[1].trim();
            const desc = m[2].trim();
            const scoreDelta = (0, audit_generic_1.normalizeSeverityDelta)(severity);
            const fallbackId = `arch-issue-${++idx}`;
            items.push({
                item_id: (0, audit_item_mapping_1.resolveItemId)('arch', desc, fallbackId),
                passed: false,
                score_delta: scoreDelta,
                note: desc,
            });
        }
    }
    if (items.length === 0) {
        items.push({
            item_id: (0, audit_item_mapping_1.resolveEmptyItemId)('arch', 'dimensions', 'arch-dimensions'),
            passed: true,
            score_delta: 0,
            note: '从维度评分提取',
        });
    }
    return items;
}
