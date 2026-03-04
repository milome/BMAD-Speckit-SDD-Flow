/**
 * Story 2.1: 规则解析器导出
 * Story 3.2: 审计报告解析器导出
 */
export {
  loadPhaseScoringYaml,
  loadGapsScoringYaml,
  loadIterationTierYaml,
  resolveRef,
} from './rules';
export type { PhaseScoringYaml, GapsScoringYaml, IterationTierYaml, ResolvedItem } from './types';
export { RefResolutionError } from './types';

export {
  parseAuditReport,
  parsePrdReport,
  parseArchReport,
  parseStoryReport,
  ReportFileNotFoundError,
  ParseError,
} from './audit-index';
export type { ParseAuditReportOptions, AuditStage } from './audit-index';
