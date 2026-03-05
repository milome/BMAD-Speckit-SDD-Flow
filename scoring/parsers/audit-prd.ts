/**
 * Story 3.2 T1: Layer 1 prd 审计报告解析器
 * 从 audit-prompts-prd 对应的审计报告提取 phase_score、check_items，映射环节 1
 * BUGFIX: item_id 优先从 config/audit-item-mapping.yaml 查找，无匹配 fallback prd-issue-N
 */
import * as fs from 'fs';
import * as path from 'path';
import type { RunScoreRecord } from '../writer/types';
import { PHASE_WEIGHTS } from '../constants/weights';
import { extractCheckItems, extractOverallGrade } from './audit-generic';
import { llmStructuredExtract, mapLlmResultToCheckItems } from './llm-fallback';

const GRADE_TO_SCORE: Record<string, number> = {
  A: 100,
  B: 80,
  C: 60,
  D: 40,
};

/** prd 映射环节 1，权重 0.2 */
const PHASE_WEIGHT_PRD = PHASE_WEIGHTS[0];

export class ReportFileNotFoundError extends Error {
  constructor(public readonly reportPath: string) {
    super(`Report file not found: ${reportPath}`);
    this.name = 'ReportFileNotFoundError';
  }
}

export class ParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ParseError';
  }
}

export interface ParsePrdReportInput {
  content?: string;
  reportPath?: string;
  runId: string;
  scenario: 'real_dev' | 'eval_question';
}

/**
 * 解析 prd 审计报告，产出 RunScoreRecord。
 * 等级 A/B/C/D → 100/80/60/40；问题清单 → check_items。
 */
export async function parsePrdReport(input: ParsePrdReportInput): Promise<RunScoreRecord> {
  let content: string;
  if (input.content != null) {
    content = input.content;
  } else if (input.reportPath != null) {
    const absPath = path.isAbsolute(input.reportPath)
      ? input.reportPath
      : path.resolve(process.cwd(), input.reportPath);
    if (!fs.existsSync(absPath)) {
      throw new ReportFileNotFoundError(absPath);
    }
    content = fs.readFileSync(absPath, 'utf-8');
  } else {
    throw new ParseError('Either content or reportPath must be provided');
  }

  let grade = extractOverallGrade(content);
  let checkItems: import('../writer/types').CheckItem[];

  if (!grade) {
    if (process.env.SCORING_LLM_API_KEY) {
      const llmResult = await llmStructuredExtract(content, 'prd');
      grade = llmResult.grade;
      checkItems = mapLlmResultToCheckItems(llmResult, 'prd');
    } else {
      throw new ParseError('Could not extract 总体评级 from PRD report');
    }
  } else {
    checkItems = extractCheckItems(content, 'prd');
  }

  const phaseScore = GRADE_TO_SCORE[grade!] ?? 60;

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
