import type { CheckItem, RunScoreRecord } from '../writer/types';
import { ParseError } from './audit-prd';
import { llmStructuredExtract, mapLlmResultToCheckItems } from './llm-fallback';
import { resolveEmptyItemId, resolveItemId, type AuditStage as MappingStage } from './audit-item-mapping';

const GRADE_TO_SCORE: Record<string, number> = {
  A: 100,
  B: 80,
  C: 60,
  D: 40,
};

export type GenericAuditStage = Extract<MappingStage, 'prd' | 'spec' | 'plan' | 'gaps' | 'tasks' | 'implement'>;

function normalizeSeverityDelta(severity: string): number {
  const value = severity.trim();
  if (value === '高') return -10;
  if (value === '中') return -5;
  return -2;
}

/**
 * Extract 总体评级 (A/B/C/D) from report content via regex.
 * @param {string} content - Full report text
 * @returns {string | null} Grade letter or null if not found
 */
export function extractOverallGrade(content: string): string | null {
  const match = content.match(/总体评级:\s*([ABCD])/);
  return match ? match[1] : null;
}

/**
 * Extract check_items from 问题清单 section. Uses audit-item-mapping for item_id resolution.
 * @param {string} content - Full report text
 * @param {GenericAuditStage} stage - Audit stage for mapping lookup
 * @returns {CheckItem[]} CheckItem array
 */
export function extractCheckItems(content: string, stage: GenericAuditStage): CheckItem[] {
  const items: CheckItem[] = [];
  const problemSection = content.match(/问题清单:\s*([\s\S]*?)(?=通过标准:|下一步行动:|$)/i);

  if (!problemSection) {
    items.push({
      item_id: resolveEmptyItemId(stage, 'overall', `${stage}_overall`),
      passed: true,
      score_delta: 0,
      note: '未发现问题清单段落',
    });
    return items;
  }

  const sectionText = problemSection[1].trim();
  if (/\(无\)|无$/.test(sectionText)) {
    items.push({
      item_id: resolveEmptyItemId(stage, 'overall', `${stage}_overall`),
      passed: true,
      score_delta: 0,
      note: '问题清单为空',
    });
    return items;
  }

  const lines = sectionText.split(/\n/).map((line) => line.trim()).filter(Boolean);
  let idx = 0;
  for (const line of lines) {
    const match = line.match(/^\d+\.\s*\[严重程度:([^\]]+)\]\s*(.+?)(?:\s+建议\s*|$)/);
    if (!match) continue;
    const severity = match[1];
    const description = match[2].trim();
    const fallbackId = `${stage}-issue-${++idx}`;

    items.push({
      item_id: resolveItemId(stage, description, fallbackId),
      passed: false,
      score_delta: normalizeSeverityDelta(severity),
      note: description,
    });
  }

  if (items.length === 0) {
    items.push({
      item_id: resolveEmptyItemId(stage, 'dimensions', `${stage}_dimensions`),
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
