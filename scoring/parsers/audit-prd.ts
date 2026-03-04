/**
 * Story 3.2 T1: Layer 1 prd 审计报告解析器
 * 从 audit-prompts-prd 对应的审计报告提取 phase_score、check_items，映射环节 1
 * BUGFIX: item_id 优先从 config/audit-item-mapping.yaml 查找，无匹配 fallback prd-issue-N
 */
import * as fs from 'fs';
import * as path from 'path';
import type { RunScoreRecord, CheckItem } from '../writer/types';
import { PHASE_WEIGHTS } from '../constants/weights';
import { resolveItemId, resolveEmptyItemId } from './audit-item-mapping';

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

  const grade = extractOverallGrade(content);
  if (!grade) {
    throw new ParseError('Could not extract 总体评级 from PRD report');
  }
  const phaseScore = GRADE_TO_SCORE[grade] ?? 60;
  const checkItems = extractCheckItemsFromPrd(content);

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

function extractOverallGrade(content: string): string | null {
  const m = content.match(/总体评级:\s*([ABCD])/);
  return m ? m[1] : null;
}

function extractCheckItemsFromPrd(content: string): CheckItem[] {
  const items: CheckItem[] = [];
  const problemSection = content.match(/问题清单:\s*([\s\S]*?)(?=通过标准:|下一步行动:|$)/i);
  if (!problemSection) return items;

  const lines = problemSection[1].trim().split(/\n/).filter(Boolean);
  let idx = 0;
  for (const line of lines) {
    const m = line.match(/^\d+\.\s*\[严重程度:([^\]]+)\]\s*(.+?)(?:\s+建议\s*|$)/);
    if (m) {
      const severity = m[1].trim();
      const desc = m[2].trim();
      const scoreDelta = severity === '高' ? -10 : severity === '中' ? -5 : -2;
      const fallbackId = `prd-issue-${++idx}`;
      items.push({
        item_id: resolveItemId('prd', desc, fallbackId),
        passed: false,
        score_delta: scoreDelta,
        note: desc,
      });
    }
  }
  if (items.length === 0 && lines.some((l) => /\(无\)|无$/.test(l))) {
    items.push({
      item_id: resolveEmptyItemId('prd', 'overall', 'prd-overall'),
      passed: true,
      score_delta: 0,
      note: '问题清单为空',
    });
  }
  if (items.length === 0) {
    items.push({
      item_id: resolveEmptyItemId('prd', 'dimensions', 'prd-dimensions'),
      passed: true,
      score_delta: 0,
      note: '从维度评分提取',
    });
  }
  return items;
}
