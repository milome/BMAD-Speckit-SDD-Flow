import type {
  CanonicalAcceptanceDecision,
  CanonicalMessage,
  CanonicalSftSample,
  CanonicalSplitAssignment,
  DatasetBundleManifest,
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
}

export interface DatasetRedactionSummary {
  status_counts: Record<'clean' | 'redacted' | 'blocked', number>;
  applied_rules: Array<{ rule: string; count: number }>;
  finding_kinds: Array<{ kind: string; count: number }>;
}

export interface DatasetRedactionPreviewItem {
  sample_id: string;
  status: CanonicalSftSample['redaction']['status'];
  finding_kinds: string[];
  applied_rules: string[];
  rejection_reasons?: string[];
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
  };
}

export function normalizeMessageContent(content: CanonicalMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  return content.map((part) => part.text).join('\n');
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
  };
}

export function buildDatasetRedactionSummary(
  samples: CanonicalSftSample[]
): DatasetRedactionSummary {
  const status_counts = {
    clean: 0,
    redacted: 0,
    blocked: 0,
  };
  const applied_rules = new Map<string, number>();
  const finding_kinds = new Map<string, number>();

  for (const sample of samples) {
    const normalizedStatus = sample.redaction.status;
    status_counts[normalizedStatus] += 1;
    for (const rule of sample.redaction.applied_rules) {
      applied_rules.set(rule, (applied_rules.get(rule) ?? 0) + 1);
    }
    for (const finding of sample.redaction.findings) {
      finding_kinds.set(finding.kind, (finding_kinds.get(finding.kind) ?? 0) + 1);
    }
  }

  return {
    status_counts,
    applied_rules: [...applied_rules.entries()]
      .map(([rule, count]) => ({ rule, count }))
      .sort((left, right) => left.rule.localeCompare(right.rule)),
    finding_kinds: [...finding_kinds.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((left, right) => left.kind.localeCompare(right.kind)),
  };
}

export function buildDatasetRedactionPreview(
  samples: CanonicalSftSample[]
): DatasetRedactionPreviewItem[] {
  return samples.map((sample) => ({
    sample_id: sample.sample_id,
    status: sample.redaction.status,
    finding_kinds: [...new Set(sample.redaction.findings.map((finding) => finding.kind))].sort(),
    applied_rules: [...new Set(sample.redaction.applied_rules)].sort(),
    ...(sample.quality.rejection_reasons.length > 0
      ? { rejection_reasons: [...new Set(sample.quality.rejection_reasons)].sort() }
      : {}),
  }));
}

export function renderValidationReportMarkdown(report: DatasetValidationReport): string {
  const rejectedSection =
    report.rejected_samples.length === 0
      ? '- 无'
      : report.rejected_samples
          .map((sample) => `- ${sample.sample_id}: ${sample.reasons.join(', ') || 'unknown_rejection'}`)
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
    ``,
    `## Rejected Samples`,
    rejectedSection,
  ].join('\n');
}
