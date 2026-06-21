"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSeverityDelta = normalizeSeverityDelta;
exports.extractOverallGrade = extractOverallGrade;
exports.extractStructuredDriftSignalBlock = extractStructuredDriftSignalBlock;
exports.extractCheckItems = extractCheckItems;
exports.parseGenericReport = parseGenericReport;
const audit_prd_1 = require("./audit-prd");
const llm_fallback_1 = require("./llm-fallback");
const audit_item_mapping_1 = require("./audit-item-mapping");
const GRADE_TO_SCORE = {
    A: 100,
    B: 80,
    C: 60,
    D: 40,
};
const STRUCTURED_DRIFT_SIGNAL_IDS = new Set([
    'smoke_task_chain',
    'closure_task_id',
    'journey_unlock',
    'gap_split_contract',
    'shared_path_reference',
]);
/**
 * Maps Chinese or English severity labels to score deltas (T3.2).
 * @param {string} severity - Chinese or English severity label
 * @returns {number} Score delta
 */
function normalizeSeverityDelta(severity) {
    const value = severity.trim();
    const lower = value.toLowerCase();
    if (value === '高' || lower === 'high')
        return -10;
    if (value === '中' || lower === 'medium')
        return -5;
    return -2;
}
const OVERALL_GRADE_PATTERNS = [
    /总体评级:\s*([ABCD])/,
    /Overall Grade:\s*([ABCD])/i,
    /Overall rating:\s*([ABCD])/i,
];
/**
 * Extract 总体评级 (A/B/C/D) from report content via regex.
 * @param {string} content - Full report text
 * @returns {string | null} Grade letter or null if not found
 */
function extractOverallGrade(content) {
    for (const pattern of OVERALL_GRADE_PATTERNS) {
        const match = content.match(pattern);
        if (match)
            return match[1];
    }
    return null;
}
/**
 * Extract the bilingual problem-list section (T3.2).
 * @param {string} content - Full report text
 * @returns {RegExpMatchArray | null} Matched section or null
 */
function findProblemSectionText(content) {
    return content.match(/(?:问题清单|Issue List|Problem List):\s*([\s\S]*?)(?=通过标准:|下一步行动:|Pass Criteria:|Next Actions:|$)/i);
}
function normalizeStructuredSignalStatus(status) {
    const normalized = status.trim().toLowerCase();
    if (['pass', 'passed', 'ok', 'clean', 'resolved', 'true', 'no_drift', 'none', 'clear'].includes(normalized)) {
        return false;
    }
    if ([
        'fail',
        'failed',
        'drift',
        'triggered',
        'missing',
        'blocked',
        'false',
        'major',
        'critical',
        'required_fixes',
    ].includes(normalized)) {
        return true;
    }
    return normalized.length > 0 && normalized !== 'pass';
}
function extractStructuredDriftSignalBlock(content) {
    const sectionMatch = /##\s*(?:Structured Drift Signal Block|Structured Drift Signals|结构化 Drift Signal Block|结构化 Drift Signals)\s*\n([\s\S]*?)(?=\n##\s+|\n---|\n(?:问题清单|Issue List|Problem List|通过标准|Pass Criteria|下一步行动|Next Actions)\s*:|\n$)/i.exec(content) ??
        /##\s*(?:Journey Contract Signal Block|Journey Contract Signals Block)\s*\n([\s\S]*?)(?=\n##\s+|\n---|\n(?:问题清单|Issue List|Problem List|通过标准|Pass Criteria|下一步行动|Next Actions)\s*:|\n$)/i.exec(content);
    if (!sectionMatch) {
        return { present: false, entries: [] };
    }
    const lines = sectionMatch[1]
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const entries = [];
    for (const line of lines) {
        if (!line.startsWith('|'))
            continue;
        const cells = line
            .split('|')
            .map((cell) => cell.trim())
            .filter(Boolean);
        if (cells.length < 3)
            continue;
        if (/^signal$/i.test(cells[0]) || /^[-:]+$/.test(cells[0]))
            continue;
        const signal = cells[0];
        if (!STRUCTURED_DRIFT_SIGNAL_IDS.has(signal))
            continue;
        const status = cells[1];
        const evidence = cells.slice(2).join(' | ');
        entries.push({
            signal,
            status,
            evidence,
            triggered: normalizeStructuredSignalStatus(status),
        });
    }
    return {
        present: true,
        entries,
    };
}
/**
 * Extract check_items from 问题清单 section. Uses audit-item-mapping for item_id resolution.
 * @param {string} content - Full report text
 * @param {GenericAuditStage} stage - Audit stage for mapping lookup
 * @returns {CheckItem[]} CheckItem array
 */
function extractCheckItems(content, stage) {
    const items = [];
    const mappingStage = stage === 'post_impl' ? 'implement' : stage;
    const problemSection = findProblemSectionText(content);
    if (!problemSection) {
        items.push({
            item_id: (0, audit_item_mapping_1.resolveEmptyItemId)(mappingStage, 'overall', `${stage}_overall`),
            passed: true,
            score_delta: 0,
            note: '未发现问题清单段落',
        });
        return items;
    }
    const sectionText = problemSection[1].trim();
    const emptyT = sectionText.trim();
    if (/\(无\)/.test(sectionText) ||
        /无$/.test(emptyT) ||
        /^\(none\)$/i.test(emptyT) ||
        /^none$/i.test(emptyT) ||
        /^n\/a$/i.test(emptyT)) {
        items.push({
            item_id: (0, audit_item_mapping_1.resolveEmptyItemId)(mappingStage, 'overall', `${stage}_overall`),
            passed: true,
            score_delta: 0,
            note: '问题清单为空',
        });
        return items;
    }
    const lines = sectionText
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    let idx = 0;
    for (const line of lines) {
        const match = line.match(/^\d+\.\s*\[(?:严重程度|Severity):([^\]]+)\]\s*(.+?)(?:\s+建议\s*|\s+Suggestion\s*:?\s*|\s+Recommendation\s*:?\s*|)$/i);
        if (!match)
            continue;
        const severity = match[1];
        const description = match[2].trim();
        const fallbackId = `${stage}-issue-${++idx}`;
        items.push({
            item_id: (0, audit_item_mapping_1.resolveItemId)(mappingStage, description, fallbackId),
            passed: false,
            score_delta: normalizeSeverityDelta(severity),
            note: description,
        });
    }
    if (items.length === 0) {
        items.push({
            item_id: (0, audit_item_mapping_1.resolveEmptyItemId)(mappingStage, 'dimensions', `${stage}_dimensions`),
            passed: true,
            score_delta: 0,
            note: '从维度评分提取',
        });
    }
    return items;
}
/**
 * Parse spec/plan/tasks/implement generic report. Extracts grade and check_items.
 * Falls back to LLM if SCORING_LLM_API_KEY set and grade not found.
 * @param {Object} input - content, stage, runId, scenario, phaseWeight
 * @param {string} input.content - Report content
 * @param {GenericAuditStage} input.stage - Audit stage
 * @param {string} input.runId - Run ID
 * @param {'real_dev' | 'eval_question'} input.scenario - Scenario type
 * @param {number} input.phaseWeight - Phase weight
 * @returns {Promise<RunScoreRecord>} RunScoreRecord
 * @throws {ParseError} If grade cannot be extracted
 */
async function parseGenericReport(input) {
    let grade = extractOverallGrade(input.content);
    let checkItems;
    if (!grade) {
        if (process.env.SCORING_LLM_API_KEY) {
            const llmResult = await (0, llm_fallback_1.llmStructuredExtract)(input.content, input.stage);
            grade = llmResult.grade;
            checkItems = (0, llm_fallback_1.mapLlmResultToCheckItems)(llmResult, input.stage);
        }
        else {
            throw new audit_prd_1.ParseError(`Could not extract 总体评级 from ${input.stage} report`);
        }
    }
    else {
        checkItems = extractCheckItems(input.content, input.stage);
    }
    return {
        run_id: input.runId,
        scenario: input.scenario,
        stage: input.stage,
        phase_score: GRADE_TO_SCORE[grade] ?? 60,
        phase_weight: input.phaseWeight,
        check_items: checkItems,
        timestamp: new Date().toISOString(),
        iteration_count: 0,
        iteration_records: [],
        first_pass: true,
    };
}
