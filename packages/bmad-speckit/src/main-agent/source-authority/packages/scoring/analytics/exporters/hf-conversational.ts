import type { CanonicalSftSample } from '../types';
import {
  assessSampleForTarget,
  buildExportRowRedactionMetadata,
  createRejectedSampleReport,
  createValidationAccumulator,
  finalizeValidationReport,
  normalizeMessageContent,
  pushRowBySplit,
  type DatasetExportResult,
} from '../validation-report';

export interface HfConversationalRow {
  messages: Array<{ role: string; content: string }>;
  metadata: {
    sample_id: string;
    run_id: string;
    split: 'train' | 'validation' | 'test';
    acceptance_decision: string;
    redaction_status: CanonicalSftSample['redaction']['status'];
    redaction_applied_rules: string[];
    redaction_findings_count: number;
    redaction_finding_kinds: string[];
  };
}

export function exportHfConversationalRows(
  samples: CanonicalSftSample[]
): DatasetExportResult<HfConversationalRow> {
  const accumulator = createValidationAccumulator<HfConversationalRow>();

  for (const sample of samples) {
    accumulator.seenSamples.push(sample);
    const decision = assessSampleForTarget(sample, 'hf_conversational');
    if (!decision.exportable) {
      accumulator.rejectedSamples.push(createRejectedSampleReport(sample, decision));
      continue;
    }
    if (sample.split.assignment === 'holdout') {
      continue;
    }

    const row: HfConversationalRow = {
      messages: sample.messages.map((message) => ({
        role: message.role,
        content: normalizeMessageContent(message.content),
      })),
      metadata: {
        sample_id: sample.sample_id,
        run_id: sample.source.run_id,
        split: sample.split.assignment,
        acceptance_decision: sample.quality.acceptance_decision,
        ...buildExportRowRedactionMetadata(sample),
      },
    };

    accumulator.exportedSamples.push(sample);
    pushRowBySplit(accumulator.rowsBySplit, sample.split.assignment, row);
  }

  return {
    target: 'hf_conversational',
    rowsBySplit: accumulator.rowsBySplit,
    validationReport: finalizeValidationReport('hf_conversational', accumulator),
  };
}
