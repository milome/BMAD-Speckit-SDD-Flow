/**
 * Story 3.2 T2: Layer 1 arch 审计报告解析器
 * 从 audit-prompts-arch 对应的审计报告提取 phase_score、check_items
 * BUGFIX: item_id 优先从 config/audit-item-mapping.yaml 查找，无匹配 fallback arch-issue-N
 */
import * as fs from 'fs';
import * as path from 'path';
import type { RunScoreRecord, CheckItem } from '../writer/types';
import { PHASE_WEIGHTS } from '../constants/weights';
import { ReportFileNotFoundError, ParseError } from './audit-prd';
import { resolveItemId, resolveEmptyItemId } from './audit-item-mapping';

const GRADE_TO_SCORE: Record<string, number> = {
  A: 100,
  B: 80,
  C: 60,
  D: 40,
};

const PHASE_WEIGHT_ARCH = PHASE_WEIGHTS[0]; // 环节 1 补充

export interface ParseArchReportInput {
  content?: string;
  reportPath?: string;
  runId: string;
  scenario: 'real_dev' | 'eval_question';
}

export async function parseArchReport(input: ParseArchReportInput): Promise<RunScoreRecord> {
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

  const grade = content.match(/总体评级:\s*([ABCD])/)?.[1];
  if (!grade) {
    throw new ParseError('Could not extract 总体评级 from Architecture report');
  }
  const phaseScore = GRADE_TO_SCORE[grade] ?? 60;
  const checkItems = extractCheckItemsFromArch(content);

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

function extractCheckItemsFromArch(content: string): CheckItem[] {
  const items: CheckItem[] = [];
  const problemSection = content.match(/问题清单:\s*([\s\S]*?)(?=通过标准:|下一步行动:|$)/i);
  if (!problemSection) {
    items.push({
      item_id: resolveEmptyItemId('arch', 'overall', 'arch-overall'),
      passed: true,
      score_delta: 0,
      note: '从维度评分',
    });
    return items;
  }
  const lines = problemSection[1].trim().split(/\n/).filter(Boolean);
  let idx = 0;
  for (const line of lines) {
    const m = line.match(/^\d+\.\s*\[严重程度:([^\]]+)\]\s*(.+)/);
    if (m) {
      const severity = m[1].trim();
      const desc = m[2].trim();
      const scoreDelta = severity === '高' ? -10 : severity === '中' ? -5 : -2;
      const fallbackId = `arch-issue-${++idx}`;
      items.push({
        item_id: resolveItemId('arch', desc, fallbackId),
        passed: false,
        score_delta: scoreDelta,
        note: desc,
      });
    }
  }
  if (items.length === 0) {
    items.push({
      item_id: resolveEmptyItemId('arch', 'dimensions', 'arch-dimensions'),
      passed: true,
      score_delta: 0,
      note: '从维度评分提取',
    });
  }
  return items;
}
