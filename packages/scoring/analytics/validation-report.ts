import type {
  CanonicalAcceptanceDecision,
  CanonicalMessage,
  CanonicalRedactionFinding,
  CanonicalSftSample,
  CanonicalSplitAssignment,
  DatasetBundleManifest,
  RedactionStatus,
} from './types';

export type DatasetExportTarget = DatasetBundleManifest['export_target'];

export interface ExportRowsBySplit<Row> {
  train: Row[];
  validation: Row[];
  test: Row[];
}

export interface RejectedSampleReport {
  sample_id: string;
  run_id: string;
  split: CanonicalSplitAssignment;
  reasons: string[];
  warnings: string[];
  acceptance_decision: CanonicalAcceptanceDecision;
}

export interface DatasetValidationCounts {
  accepted: number;
  rejected: number;
  downgraded: number;
  train: number;
  validation: number;
  test: number;
}

export interface DatasetValidationReport {
  export_target: DatasetExportTarget;
  generated_at: string;
  counts: DatasetValidationCounts;
  exported_sample_ids: string[];
  rejected_samples: RejectedSampleReport[];
  redaction_summary: DatasetRedactionSummary;
}

export interface DatasetExportResult<Row> {
  target: DatasetExportTarget;
  rowsBySplit: ExportRowsBySplit<Row>;
  validationReport: DatasetValidationReport;
}

export interface ExportDecision {
  exportable: boolean;
  reasons: string[];
  warnings: string[];
}

export interface ValidationAccumulator<Row> {
  rowsBySplit: ExportRowsBySplit<Row>;
  exportedSamples: CanonicalSftSample[];
  rejectedSamples: RejectedSampleReport[];
  seenSamples: CanonicalSftSample[];
}

export interface ExportRowRedactionMetadata {
  redaction_status: RedactionStatus;
  redaction_applied_rules: string[];
  redaction_findings_count: number;
  redaction_finding_kinds: string[];
}

export interface DatasetRedactionSummary {
  status_counts: Record<RedactionStatus, number>;
  applied_rules: Array<{
    rule: string;
    count: number;
  }>;
  finding_kinds: Array<{
    kind: string;
    count: number;
  }>;
}

export interface DatasetRedactionPreviewItem {
  sample_id: string;
  run_id: string;
  split: CanonicalSplitAssignment;
  status: RedactionStatus;
  applied_rules: string[];
  finding_kinds: string[];
  rejection_reasons: string[];
}

export function createEmptyRowsBySplit<Row>(): ExportRowsBySplit<Row> {
  return {
    train: [],
    validation: [],
    test: [],
  };
}

export function createValidationAccumulator<Row>(): ValidationAccumulator<Row> {
  return {
    rowsBySplit: createEmptyRowsBySplit<Row>(),
    exportedSamples: [],
    rejectedSamples: [],
    seenSamples: [],
  };
}

export function normalizeMessageContent(content: CanonicalMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  return content.map((part) => part.text).join('\n');
}

function sortCountEntries<T extends string>(
  counts: Map<T, number>,
  fieldName: 'rule' | 'kind'
): Array<{ [K in typeof fieldName]: T } & { count: number }> {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0])))
    .map(([value, count]) => ({
      [fieldName]: value,
      count,
    })) as Array<{ [K in typeof fieldName]: T } & { count: number }>;
}

export function buildExportRowRedactionMetadata(
  sample: CanonicalSftSample
): ExportRowRedactionMetadata {
  return {
    redaction_status: sample.redaction.status,
    redaction_applied_rules: [...sample.redaction.applied_rules],
    redaction_findings_count: sample.redaction.findings.length,
    redaction_finding_kinds: [...new Set(sample.redaction.findings.map((finding) => finding.kind))],
  };
}

export function buildDatasetRedactionSummary(
  samples: CanonicalSftSample[]
): DatasetRedactionSummary {
  const statusCounts: Record<RedactionStatus, number> = {
    clean: 0,
    redacted: 0,
    blocked: 0,
  };
  const ruleCounts = new Map<string, number>();
  const findingKindCounts = new Map<string, number>();

  for (const sample of samples) {
    statusCounts[sample.redaction.status] += 1;
    for (const rule of sample.redaction.applied_rules) {
      ruleCounts.set(rule, (ruleCounts.get(rule) ?? 0) + 1);
    }
    for (const finding of sample.redaction.findings) {
      findingKindCounts.set(finding.kind, (findingKindCounts.get(finding.kind) ?? 0) + 1);
    }
  }

  return {
    status_counts: statusCounts,
    applied_rules: sortCountEntries(ruleCounts, 'rule'),
    finding_kinds: sortCountEntries(findingKindCounts, 'kind'),
  };
}

export function buildDatasetRedactionPreview(
  samples: CanonicalSftSample[],
  limit = 5
): DatasetRedactionPreviewItem[] {
  return samples
    .filter((sample) => sample.redaction.status !== 'clean' || sample.redaction.findings.length > 0)
    .slice()
    .sort((left, right) => {
      const severityRank = (findings: CanonicalRedactionFinding[]): number => {
        const ranks = { critical: 4, high: 3, medium: 2, low: 1 } as const;
        return findings.reduce((max, finding) => Math.max(max, ranks[finding.severity]), 0);
      };
      const bySeverity = severityRank(right.redaction.findings) - severityRank(left.redaction.findings);
      if (bySeverity !== 0) {
        return bySeverity;
      }
      return right.redaction.findings.length - left.redaction.findings.length;
    })
    .slice(0, limit)
    .map((sample) => ({
      sample_id: sample.sample_id,
      run_id: sample.source.run_id,
      split: sample.split.assignment,
      status: sample.redaction.status,
      applied_rules: [...sample.redaction.applied_rules],
      finding_kinds: [...new Set(sample.redaction.findings.map((finding) => finding.kind))],
      rejection_reasons: [...sample.quality.rejection_reasons],
    }));
}

function toolCallIdsMatch(sample: CanonicalSftSample): boolean {
  const assistantToolCallIds = sample.messages
    .flatMap((message) => message.role === 'assistant' ? (message.tool_calls ?? []).map((call) => call.id) : [])
    .filter((id) => id.length > 0);
  if (assistantToolCallIds.length === 0) {
    return true;
  }

  const toolResponseIds = new Set(
    sample.messages
      .filter((message) => message.role === 'tool' && typeof message.tool_call_id === 'string')
      .map((message) => String(message.tool_call_id))
  );

  return assistantToolCallIds.every((id) => toolResponseIds.has(id));
}

function baseDecision(sample: CanonicalSftSample, target: DatasetExportTarget): ExportDecision {
  const reasons: string[] = [];
  const warnings = [...sample.quality.warnings];

  if (sample.split.assignment === 'holdout') {
    reasons.push('split_holdout_excluded');
  }
  if (sample.redaction.status === 'blocked') {
    reasons.push('redaction_blocked');
  }
  if (sample.quality.acceptance_decision === 'rejected') {
    reasons.push(...sample.quality.rejection_reasons);
  }

  const compatibility = sample.export_compatibility[target];
  if (!compatibility.compatible) {
    reasons.push(...compatibility.reasons);
    warnings.push(...compatibility.warnings);
  }

  return {
    exportable: reasons.length === 0,
    reasons: [...new Set(reasons)],
    warnings: [...new Set(warnings)],
  };
}

export function assessSampleForTarget(
  sample: CanonicalSftSample,
  target: DatasetExportTarget
): ExportDecision {
  const decision = baseDecision(sample, target);
  const reasons = [...decision.reasons];
  const warnings = [...decision.warnings];

  if (target === 'hf_tool_calling') {
    if (!sample.tools || sample.tools.length === 0) {
      reasons.push('tool_schema_missing');
    }
    if (!toolCallIdsMatch(sample)) {
      reasons.push('tool_call_mismatch');
    }
  }

  return {
    exportable: reasons.length === 0,
    reasons: [...new Set(reasons)],
    warnings: [...new Set(warnings)],
  };
}

export function createRejectedSampleReport(
  sample: CanonicalSftSample,
  decision: ExportDecision
): RejectedSampleReport {
  return {
    sample_id: sample.sample_id,
    run_id: sample.source.run_id,
    split: sample.split.assignment,
    reasons: decision.reasons,
    warnings: decision.warnings,
    acceptance_decision: sample.quality.acceptance_decision,
  };
}

export function pushRowBySplit<Row>(
  rowsBySplit: ExportRowsBySplit<Row>,
  split: CanonicalSplitAssignment,
  row: Row
): void {
  if (split === 'train') {
    rowsBySplit.train.push(row);
  } else if (split === 'validation') {
    rowsBySplit.validation.push(row);
  } else if (split === 'test') {
    rowsBySplit.test.push(row);
  }
}

export function finalizeValidationReport<Row>(
  target: DatasetExportTarget,
  accumulator: ValidationAccumulator<Row>
): DatasetValidationReport {
  return {
    export_target: target,
    generated_at: new Date().toISOString(),
    counts: {
      accepted: accumulator.exportedSamples.length,
      rejected: accumulator.rejectedSamples.length,
      downgraded: accumulator.exportedSamples.filter(
        (sample) => sample.quality.acceptance_decision === 'downgraded'
      ).length,
      train: accumulator.rowsBySplit.train.length,
      validation: accumulator.rowsBySplit.validation.length,
      test: accumulator.rowsBySplit.test.length,
    },
    exported_sample_ids: accumulator.exportedSamples.map((sample) => sample.sample_id),
    rejected_samples: accumulator.rejectedSamples,
    redaction_summary: buildDatasetRedactionSummary(accumulator.seenSamples),
  };
}

export function renderValidationReportMarkdown(report: DatasetValidationReport): string {
  const rejectedSection =
    report.rejected_samples.length === 0
      ? '- 无'
      : report.rejected_samples
          .map((sample) => `- ${sample.sample_id}: ${sample.reasons.join(', ') || 'unknown_rejection'}`)
          .join('\n');
  const appliedRulesSection =
    report.redaction_summary.applied_rules.length === 0
      ? '- 无'
      : report.redaction_summary.applied_rules
          .map((entry) => `- ${entry.rule}: ${entry.count}`)
          .join('\n');
  const findingKindsSection =
    report.redaction_summary.finding_kinds.length === 0
      ? '- 无'
      : report.redaction_summary.finding_kinds
          .map((entry) => `- ${entry.kind}: ${entry.count}`)
          .join('\n');

  return [
    `# Validation Report`,
    ``,
    `- Target: \`${report.export_target}\``,
    `- Generated At: \`${report.generated_at}\``,
    `- Accepted: ${report.counts.accepted}`,
    `- Rejected: ${report.counts.rejected}`,
    `- Downgraded: ${report.counts.downgraded}`,
    `- Train: ${report.counts.train}`,
    `- Validation: ${report.counts.validation}`,
    `- Test: ${report.counts.test}`,
    `- Redaction Clean: ${report.redaction_summary.status_counts.clean}`,
    `- Redaction Redacted: ${report.redaction_summary.status_counts.redacted}`,
    `- Redaction Blocked: ${report.redaction_summary.status_counts.blocked}`,
    ``,
    `## Redaction Rules`,
    appliedRulesSection,
    ``,
    `## Redaction Finding Kinds`,
    findingKindsSection,
    ``,
    `## Rejected Samples`,
    rejectedSection,
  ].join('\n');
}
