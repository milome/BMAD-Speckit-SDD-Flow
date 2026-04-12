import type { CheckItem, JourneyContractSignals, RunScoreRecord } from '../writer/types';
import { ParseError } from './audit-prd';
import { llmStructuredExtract, mapLlmResultToCheckItems } from './llm-fallback';
import { resolveEmptyItemId, resolveItemId, type AuditStage as MappingStage } from './audit-item-mapping';

const GRADE_TO_SCORE: Record<string, number> = {
  A: 100,
  B: 80,
  C: 60,
  D: 40,
};

export type GenericAuditStage = Extract<
  MappingStage,
  'prd' | 'spec' | 'plan' | 'gaps' | 'tasks' | 'implement' | 'post_impl' | 'implementation_readiness'
>;

export interface StructuredDriftSignalEntry {
  signal: keyof JourneyContractSignals;
  status: string;
  evidence: string;
  triggered: boolean;
}

export interface StructuredDriftSignalBlock {
  present: boolean;
  entries: StructuredDriftSignalEntry[];
}

const STRUCTURED_DRIFT_SIGNAL_IDS = new Set<keyof JourneyContractSignals>([
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
export function normalizeSeverityDelta(severity: string): number {
  const value = severity.trim();
  const lower = value.toLowerCase();
  if (value === '高' || lower === 'high') return -10;
  if (value === '中' || lower === 'medium') return -5;
  return -2;
}

const OVERALL_GRADE_PATTERNS: RegExp[] = [
  /总体评级:\s*([ABCD])/,
  /Overall Grade:\s*([ABCD])/i,
  /Overall rating:\s*([ABCD])/i,
];

/**
 * Extract 总体评级 (A/B/C/D) from report content via regex.
 * @param {string} content - Full report text
 * @returns {string | null} Grade letter or null if not found
 */
export function extractOverallGrade(content: string): string | null {
  for (const pattern of OVERALL_GRADE_PATTERNS) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract the bilingual problem-list section (T3.2).
 * @param {string} content - Full report text
 * @returns {RegExpMatchArray | null} Matched section or null
 */
function findProblemSectionText(content: string): RegExpMatchArray | null {
  return content.match(
    /(?:问题清单|Issue List|Problem List):\s*([\s\S]*?)(?=通过标准:|下一步行动:|Pass Criteria:|Next Actions:|$)/i
  );
}

function normalizeStructuredSignalStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  if (
    [
      'pass',
      'passed',
      'ok',
      'clean',
      'resolved',
      'true',
      'no_drift',
      'none',
      'clear',
    ].includes(normalized)
  ) {
    return false;
  }
  if (
    [
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
    ].includes(normalized)
  ) {
    return true;
  }
  return normalized.length > 0 && normalized !== 'pass';
}

export function extractStructuredDriftSignalBlock(content: string): StructuredDriftSignalBlock {
  const sectionMatch =
    /##\s*(?:Structured Drift Signal Block|Structured Drift Signals|结构化 Drift Signal Block|结构化 Drift Signals)\s*\n([\s\S]*?)(?=\n##\s+|\n---|\n(?:问题清单|Issue List|Problem List|通过标准|Pass Criteria|下一步行动|Next Actions)\s*:|\n$)/i.exec(
      content
    ) ??
    /##\s*(?:Journey Contract Signal Block|Journey Contract Signals Block)\s*\n([\s\S]*?)(?=\n##\s+|\n---|\n(?:问题清单|Issue List|Problem List|通过标准|Pass Criteria|下一步行动|Next Actions)\s*:|\n$)/i.exec(
      content
    );

  if (!sectionMatch) {
    return { present: false, entries: [] };
  }

  const lines = sectionMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: StructuredDriftSignalEntry[] = [];
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);

    if (cells.length < 3) continue;
    if (/^signal$/i.test(cells[0]) || /^[-:]+$/.test(cells[0])) continue;

    const signal = cells[0] as keyof JourneyContractSignals;
    if (!STRUCTURED_DRIFT_SIGNAL_IDS.has(signal)) continue;

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
export function extractCheckItems(content: string, stage: GenericAuditStage): CheckItem[] {
  const items: CheckItem[] = [];
  const mappingStage = stage === 'post_impl' ? 'implement' : stage;
  const problemSection = findProblemSectionText(content);

  if (!problemSection) {
    items.push({
      item_id: resolveEmptyItemId(mappingStage, 'overall', `${stage}_overall`),
      passed: true,
      score_delta: 0,
      note: '未发现问题清单段落',
    });
    return items;
  }

  const sectionText = problemSection[1].trim();
  const emptyT = sectionText.trim();
  if (
    /\(无\)/.test(sectionText) ||
    /无$/.test(emptyT) ||
    /^\(none\)$/i.test(emptyT) ||
    /^none$/i.test(emptyT) ||
    /^n\/a$/i.test(emptyT)
  ) {
    items.push({
      item_id: resolveEmptyItemId(mappingStage, 'overall', `${stage}_overall`),
      passed: true,
      score_delta: 0,
      note: '问题清单为空',
    });
    return items;
  }

  const lines = sectionText.split(/\n/).map((line) => line.trim()).filter(Boolean);
  let idx = 0;
  for (const line of lines) {
    const match = line.match(
      /^\d+\.\s*\[(?:严重程度|Severity):([^\]]+)\]\s*(.+?)(?:\s+建议\s*|\s+Suggestion\s*:?\s*|\s+Recommendation\s*:?\s*|)$/i
    );
    if (!match) continue;
    const severity = match[1];
    const description = match[2].trim();
    const fallbackId = `${stage}-issue-${++idx}`;

    items.push({
      item_id: resolveItemId(mappingStage, description, fallbackId),
      passed: false,
      score_delta: normalizeSeverityDelta(severity),
      note: description,
    });
  }

  if (items.length === 0) {
    items.push({
      item_id: resolveEmptyItemId(mappingStage, 'dimensions', `${stage}_dimensions`),
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
export async function parseGenericReport(input: {
  content: string;
  stage: GenericAuditStage;
  runId: string;
  scenario: 'real_dev' | 'eval_question';
  phaseWeight: number;
}): Promise<RunScoreRecord> {
  let grade = extractOverallGrade(input.content);
  let checkItems: CheckItem[];

  if (!grade) {
    if (process.env.SCORING_LLM_API_KEY) {
      const llmResult = await llmStructuredExtract(input.content, input.stage);
      grade = llmResult.grade;
      checkItems = mapLlmResultToCheckItems(llmResult, input.stage);
    } else {
      throw new ParseError(`Could not extract 总体评级 from ${input.stage} report`);
    }
  } else {
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
