"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLM_SYSTEM_PROMPT_EN = exports.LLM_SYSTEM_PROMPT = void 0;
exports.getLlmSystemPrompt = getLlmSystemPrompt;
exports.normalizeLlmSeverity = normalizeLlmSeverity;
exports.llmStructuredExtract = llmStructuredExtract;
exports.mapLlmResultToCheckItems = mapLlmResultToCheckItems;
exports.llmGradeToScore = llmGradeToScore;
const audit_prd_1 = require("./audit-prd");
const audit_item_mapping_1 = require("./audit-item-mapping");
const VALID_GRADES = ['A', 'B', 'C', 'D'];
exports.LLM_SYSTEM_PROMPT = `你是一个审计报告解析助手。请从给定的审计报告中提取以下结构化信息，以 JSON 格式返回，且仅包含 JSON，不要包含或引用输入文本中的代码片段。

返回格式：
{
  "grade": "A" | "B" | "C" | "D",
  "issues": [{"severity": "高"|"中"|"低", "description": "问题描述"}],
  "veto_items": ["item_id1", ...]
}

grade: 总体评级。
issues: 问题清单，severity 仅能为 高、中、低 之一。
veto_items: 一票否决项 item_id 列表，若无则为空数组。
仅返回 JSON 结构，不要包含或引用输入文本中的代码片段。`;
/** English system prompt (TASKS TB.1 实现 α); use when SCORING_LLM_LOCALE=en */
exports.LLM_SYSTEM_PROMPT_EN = `You are an audit report extraction assistant. Return ONLY a JSON object (no markdown fences, no code from the input).

Format:
{
  "grade": "A" | "B" | "C" | "D",
  "issues": [{"severity": "high"|"medium"|"low"|"critical", "description": "string"}],
  "veto_items": ["item_id", ...]
}

grade: overall letter grade.
issues: severity must be one of high, medium, low, critical (critical maps to highest deduction).
veto_items: veto item ids, or [] if none.
Return JSON only, do not echo input code blocks.`;
function getLlmSystemPrompt() {
    const loc = (process.env.SCORING_LLM_LOCALE ?? '').toLowerCase();
    return loc === 'en' ? exports.LLM_SYSTEM_PROMPT_EN : exports.LLM_SYSTEM_PROMPT;
}
/**
 * Normalize LLM JSON severity to 高|中|低 (TB.1: accept zh + en tokens).
 * @param {string} raw - Raw severity token
 * @returns {'高' | '中' | '低'} Canonical severity
 */
function normalizeLlmSeverity(raw) {
    const s = raw.trim();
    const lower = s.toLowerCase();
    if (s === '高' || lower === 'high' || lower === 'critical')
        return '高';
    if (s === '中' || lower === 'medium')
        return '中';
    if (s === '低' || lower === 'low')
        return '低';
    throw new audit_prd_1.ParseError(`Invalid severity token: ${raw}`);
}
/**
 * Parse and validate raw LLM JSON output.
 * @param {string} raw - Raw JSON string from the model
 * @param {number} attempt - Retry attempt number
 * @returns {LlmExtractionResult} Parsed extraction result
 * @throws {ParseError} If payload shape is invalid
 */
function parseAndValidate(raw, attempt) {
    let obj;
    try {
        obj = JSON.parse(raw);
    }
    catch {
        throw new audit_prd_1.ParseError(`LLM returned invalid JSON (attempt ${attempt})`);
    }
    if (typeof obj !== 'object' || obj === null) {
        throw new audit_prd_1.ParseError(`LLM returned non-object (attempt ${attempt})`);
    }
    const o = obj;
    const grade = o.grade;
    if (typeof grade !== 'string' || !VALID_GRADES.includes(grade)) {
        throw new audit_prd_1.ParseError(`Invalid grade: ${String(grade)} (attempt ${attempt})`);
    }
    const issuesRaw = o.issues;
    if (!Array.isArray(issuesRaw)) {
        throw new audit_prd_1.ParseError(`issues must be array (attempt ${attempt})`);
    }
    const issues = [];
    for (let i = 0; i < issuesRaw.length; i++) {
        const it = issuesRaw[i];
        if (typeof it !== 'object' || it === null)
            continue;
        const item = it;
        const severity = item.severity;
        const description = item.description;
        if (typeof severity !== 'string') {
            throw new audit_prd_1.ParseError(`Invalid issue severity at index ${i} (attempt ${attempt})`);
        }
        if (typeof description !== 'string') {
            throw new audit_prd_1.ParseError(`Invalid issue description at index ${i} (attempt ${attempt})`);
        }
        let canon;
        try {
            canon = normalizeLlmSeverity(severity);
        }
        catch {
            throw new audit_prd_1.ParseError(`Invalid issue severity at index ${i}: ${String(severity)} (attempt ${attempt})`);
        }
        issues.push({ severity: canon, description });
    }
    const vetoRaw = o.veto_items;
    const veto_items = Array.isArray(vetoRaw)
        ? vetoRaw.filter((v) => typeof v === 'string')
        : [];
    return { grade: grade, issues, veto_items };
}
/**
 * Call LLM API to extract structured grade/issues/veto_items from report when regex fails.
 * Requires SCORING_LLM_API_KEY. Uses OpenAI-compatible chat/completions API.
 * @param {string} reportContent - Full audit report text
 * @param {string} _stage - Stage (for logging; mapping uses audit-item-mapping)
 * @returns {Promise<LlmExtractionResult>} LlmExtractionResult
 * @throws {ParseError} If API key missing, API fails, or response invalid
 */
async function llmStructuredExtract(reportContent, _stage) {
    const apiKey = process.env.SCORING_LLM_API_KEY;
    if (!apiKey) {
        throw new audit_prd_1.ParseError('SCORING_LLM_API_KEY is not set');
    }
    const baseUrl = (process.env.SCORING_LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = process.env.SCORING_LLM_MODEL ?? 'gpt-4o-mini';
    const timeoutMs = parseInt(String(process.env.SCORING_LLM_TIMEOUT_MS ?? 30000), 10) || 30000;
    const url = `${baseUrl}/chat/completions`;
    const body = {
        model,
        messages: [
            { role: 'system', content: getLlmSystemPrompt() },
            { role: 'user', content: reportContent },
        ],
        temperature: 0,
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(timeoutMs),
            });
            if (!res.ok) {
                throw new audit_prd_1.ParseError(`LLM API error: ${res.status} ${res.statusText}`);
            }
            const data = (await res.json());
            const content = data?.choices?.[0]?.message?.content ?? '';
            return parseAndValidate(content, attempt);
        }
        catch (e) {
            if (e instanceof audit_prd_1.ParseError) {
                if (attempt === 2)
                    throw e;
                continue;
            }
            const msg = e instanceof Error ? e.message : String(e);
            throw new audit_prd_1.ParseError(`LLM API failed: ${msg}`);
        }
    }
    throw new audit_prd_1.ParseError('LLM extraction failed after retries');
}
const GRADE_TO_SCORE = {
    A: 100,
    B: 80,
    C: 60,
    D: 40,
};
function severityToDelta(severity) {
    if (severity === '高')
        return -10;
    if (severity === '中')
        return -5;
    return -2;
}
/**
 * Map LlmExtractionResult to CheckItem[] for parser integration.
 * Uses resolveItemId for item_id; severity maps to score_delta.
 * @param {LlmExtractionResult} result - LLM extraction result
 * @param {AuditStage} stage - Audit stage for item_id resolution
 * @returns {CheckItem[]} CheckItem array
 */
function mapLlmResultToCheckItems(result, stage) {
    const items = [];
    for (let i = 0; i < result.issues.length; i++) {
        const issue = result.issues[i];
        const fallbackId = `llm_${stage}_issue_${i + 1}`;
        items.push({
            item_id: (0, audit_item_mapping_1.resolveItemId)(stage, issue.description, fallbackId),
            passed: false,
            score_delta: severityToDelta(issue.severity),
            note: issue.description,
        });
    }
    for (const itemId of result.veto_items) {
        items.push({
            item_id: itemId,
            passed: false,
            score_delta: -10,
            note: 'veto',
        });
    }
    if (items.length === 0) {
        items.push({
            item_id: `llm_${stage}_overall`,
            passed: true,
            score_delta: 0,
            note: 'LLM 未发现问题',
        });
    }
    return items;
}
/**
 * Convert LLM grade (A/B/C/D) to numeric score.
 * @param {LlmExtractionResult['grade']} grade - Grade letter
 * @returns {number} Score (100/80/60/40, default 60)
 */
function llmGradeToScore(grade) {
    return GRADE_TO_SCORE[grade] ?? 60;
}
