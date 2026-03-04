/**
 * Story 3.2 T5: parseAuditReport 统一入口
 * 根据 stage 调度 prd/arch/story 解析器
 */
import type { RunScoreRecord } from '../writer/types';
import { parsePrdReport } from './audit-prd';
import { parseArchReport } from './audit-arch';
import { parseStoryReport } from './audit-story';

export type AuditStage = 'prd' | 'arch' | 'story';

export interface ParseAuditReportOptions {
  reportPath?: string;
  content?: string;
  stage: AuditStage;
  runId: string;
  scenario: 'real_dev' | 'eval_question';
}

export async function parseAuditReport(options: ParseAuditReportOptions): Promise<RunScoreRecord> {
  const { stage, runId, scenario } = options;
  const input = {
    content: options.content,
    reportPath: options.reportPath,
    runId,
    scenario,
  };

  switch (stage) {
    case 'prd':
      return parsePrdReport(input);
    case 'arch':
      return parseArchReport(input);
    case 'story':
      return parseStoryReport(input);
    default: {
      const _: never = stage;
      throw new Error(`Unknown audit stage: ${stage}`);
    }
  }
}

export { parsePrdReport } from './audit-prd';
export { parseArchReport } from './audit-arch';
export { parseStoryReport } from './audit-story';
export { ReportFileNotFoundError, ParseError } from './audit-prd';
