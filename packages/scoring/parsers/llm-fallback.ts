/**
 * Story 5.3 B05: LLM 结构化提取 fallback
 * 当正则无法提取总体评级时，调用 LLM API 做结构化提取
 */
import type { CheckItem } from '../writer/types';
import { ParseError } from './audit-prd';
import { resolveItemId, type AuditStage } from './audit-item-mapping';

const VALID_GRADES = ['A', 'B', 'C', 'D'] as const;

export interface LlmExtractionResult {
  grade: 'A' | 'B' | 'C' | 'D';
  issues: Array<{ severity: '高' | '中' | '低'; description: string }>;
  veto_items: string[];
}

export const LLM_SYSTEM_PROMPT = `你是一个审计报告解析助手。请从给定的审计报告中提取以下结构化信息，以 JSON 格式返回，且仅包含 JSON，不要包含或引用输入文本中的代码片段。

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
export const LLM_SYSTEM_PROMPT_EN = `You are an audit report extraction assistant. Return ONLY a JSON object (no markdown fences, no code from the input).

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

export function getLlmSystemPrompt(): string {
  const loc = (process.env.SCORING_LLM_LOCALE ?? '').toLowerCase();
  return loc === 'en' ? LLM_SYSTEM_PROMPT_EN : LLM_SYSTEM_PROMPT;
}

/**
 * Normalize LLM JSON severity to 高|中|低 (TB.1: accept zh + en tokens).
 * @param {string} raw - Raw severity token
 * @returns {'高' | '中' | '低'} Canonical severity
 */
export function normalizeLlmSeverity(raw: string): '高' | '中' | '低' {
  const s = raw.trim();
  const lower = s.toLowerCase();
  if (s === '高' || lower === 'high' || lower === 'critical') return '高';
  if (s === '中' || lower === 'medium') return '中';
  if (s === '低' || lower === 'low') return '低';
  throw new ParseError(`Invalid severity token: ${raw}`);
}

/**
 * Parse and validate raw LLM JSON output.
 * @param {string} raw - Raw JSON string from the model
 * @param {number} attempt - Retry attempt number
 * @returns {LlmExtractionResult} Parsed extraction result
 * @throws {ParseError} If payload shape is invalid
 */
function parseAndValidate(
  raw: string,
  attempt: number
): LlmExtractionResult {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new ParseError(`LLM returned invalid JSON (attempt ${attempt})`);
  }
  if (typeof obj !== 'object' || obj === null) {
    throw new ParseError(`LLM returned non-object (attempt ${attempt})`);
  }
  const o = obj as Record<string, unknown>;
  const grade = o.grade;
  if (typeof grade !== 'string' || !VALID_GRADES.includes(grade as typeof VALID_GRADES[number])) {
    throw new ParseError(`Invalid grade: ${String(grade)} (attempt ${attempt})`);
  }
  const issuesRaw = o.issues;
  if (!Array.isArray(issuesRaw)) {
    throw new ParseError(`issues must be array (attempt ${attempt})`);
  }
  const issues: Array<{ severity: '高' | '中' | '低'; description: string }> = [];
  for (let i = 0; i < issuesRaw.length; i++) {
    const it = issuesRaw[i];
    if (typeof it !== 'object' || it === null) continue;
    const item = it as Record<string, unknown>;
    const severity = item.severity;
    const description = item.description;
    if (typeof severity !== 'string') {
      throw new ParseError(`Invalid issue severity at index ${i} (attempt ${attempt})`);
    }
    if (typeof description !== 'string') {
      throw new ParseError(`Invalid issue description at index ${i} (attempt ${attempt})`);
    }
    let canon: '高' | '中' | '低';
    try {
      canon = normalizeLlmSeverity(severity);
    } catch {
      throw new ParseError(
        `Invalid issue severity at index ${i}: ${String(severity)} (attempt ${attempt})`
      );
    }
    issues.push({ severity: canon, description });
  }
  const vetoRaw = o.veto_items;
  const veto_items = Array.isArray(vetoRaw)
    ? vetoRaw.filter((v): v is string => typeof v === 'string')
    : [];

  return { grade: grade as 'A' | 'B' | 'C' | 'D', issues, veto_items };
}

/**
 * Call LLM API to extract structured grade/issues/veto_items from report when regex fails.
 * Requires SCORING_LLM_API_KEY. Uses OpenAI-compatible chat/completions API.
 * @param {string} reportContent - Full audit report text
 * @param {string} _stage - Stage (for logging; mapping uses audit-item-mapping)
 * @returns {Promise<LlmExtractionResult>} LlmExtractionResult
 * @throws {ParseError} If API key missing, API fails, or response invalid
 */
export async function llmStructuredExtract(
  reportContent: string,
  _stage: string
): Promise<LlmExtractionResult> {
  const apiKey = process.env.SCORING_LLM_API_KEY;
  if (!apiKey) {
    throw new ParseError('SCORING_LLM_API_KEY is not set');
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
        throw new ParseError(`LLM API error: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data?.choices?.[0]?.message?.content ?? '';
      return parseAndValidate(content, attempt);
    } catch (e) {
      if (e instanceof ParseError) {
        if (attempt === 2) throw e;
        continue;
      }
      const msg = e instanceof Error ? e.message : String(e);
      throw new ParseError(`LLM API failed: ${msg}`);
    }
  }

  throw new ParseError('LLM extraction failed after retries');
}

const GRADE_TO_SCORE: Record<string, number> = {
  A: 100,
  B: 80,
  C: 60,
  D: 40,
};

function severityToDelta(severity: '高' | '中' | '低'): number {
  if (severity === '高') return -10;
  if (severity === '中') return -5;
  return -2;
}

/**
 * Map LlmExtractionResult to CheckItem[] for parser integration.
 * Uses resolveItemId for item_id; severity maps to score_delta.
 * @param {LlmExtractionResult} result - LLM extraction result
 * @param {AuditStage} stage - Audit stage for item_id resolution
 * @returns {CheckItem[]} CheckItem array
 */
export function mapLlmResultToCheckItems(
  result: LlmExtractionResult,
  stage: AuditStage
): CheckItem[] {
  const items: CheckItem[] = [];
  for (let i = 0; i < result.issues.length; i++) {
    const issue = result.issues[i];
    const fallbackId = `llm_${stage}_issue_${i + 1}`;
    items.push({
      item_id: resolveItemId(stage, issue.description, fallbackId),
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
export function llmGradeToScore(grade: LlmExtractionResult['grade']): number {
  return GRADE_TO_SCORE[grade] ?? 60;
}
