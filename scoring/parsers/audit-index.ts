/**
 * Story 3.2 T5: parseAuditReport 统一入口
 * 根据 stage 调度 prd/arch/story/spec/plan/tasks 解析器
 */
import * as fs from 'fs';
import * as path from 'path';
import type { RunScoreRecord } from '../writer/types';
import { parsePrdReport } from './audit-prd';
import { parseArchReport } from './audit-arch';
import { parseStoryReport } from './audit-story';
import { parseGenericReport } from './audit-generic';
import { ParseError, ReportFileNotFoundError } from './audit-prd';
import { PHASE_WEIGHTS_SPEC, PHASE_WEIGHTS_PLAN, PHASE_WEIGHTS_TASKS, PHASE_WEIGHT_IMPLEMENT } from '../constants/weights';

export type AuditStage = 'prd' | 'arch' | 'story' | 'spec' | 'plan' | 'tasks' | 'implement';

export interface ParseAuditReportOptions {
  reportPath?: string;
  content?: string;
  stage: AuditStage;
  runId: string;
  scenario: 'real_dev' | 'eval_question';
}

function getInlineContent(options: ParseAuditReportOptions): string {
  if (options.content != null) return options.content;
  if (options.reportPath != null) {
    const absPath = path.isAbsolute(options.reportPath)
      ? options.reportPath
      : path.resolve(process.cwd(), options.reportPath);
    if (!fs.existsSync(absPath)) {
      throw new ReportFileNotFoundError(absPath);
    }
    return fs.readFileSync(absPath, 'utf-8');
  }
  throw new ParseError('Either content or reportPath must be provided');
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
    case 'spec':
      return parseGenericReport({
        content: getInlineContent(options),
        stage: 'spec',
        runId,
        scenario,
        phaseWeight: PHASE_WEIGHTS_SPEC,
      });
    case 'plan':
      return parseGenericReport({
        content: getInlineContent(options),
        stage: 'plan',
        runId,
        scenario,
        phaseWeight: PHASE_WEIGHTS_PLAN,
      });
    case 'tasks':
      return parseGenericReport({
        content: getInlineContent(options),
        stage: 'tasks',
        runId,
        scenario,
        phaseWeight: PHASE_WEIGHTS_TASKS,
      });
    case 'implement':
      return parseGenericReport({
        content: getInlineContent(options),
        stage: 'implement',
        runId,
        scenario,
        phaseWeight: PHASE_WEIGHT_IMPLEMENT,
      });
    default: {
      const _: never = stage;
      throw new Error(`Unknown audit stage: ${stage}`);
    }
  }
}

export { parsePrdReport } from './audit-prd';
export { parseArchReport } from './audit-arch';
export { parseStoryReport } from './audit-story';
export { parseGenericReport, extractOverallGrade, extractCheckItems } from './audit-generic';
export { ReportFileNotFoundError, ParseError } from './audit-prd';
export {
  llmStructuredExtract,
  mapLlmResultToCheckItems,
  LlmExtractionResult,
  LLM_SYSTEM_PROMPT,
} from './llm-fallback';
