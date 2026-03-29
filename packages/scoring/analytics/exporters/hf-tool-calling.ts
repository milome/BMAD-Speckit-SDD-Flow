import type { CanonicalSftSample, CanonicalTool } from '../types';
import {
  assessSampleForTarget,
  createRejectedSampleReport,
  createValidationAccumulator,
  finalizeValidationReport,
  normalizeMessageContent,
  pushRowBySplit,
  type DatasetExportResult,
} from '../validation-report';

export interface HfToolCallingRow {
  messages: Array<{
    role: string;
    content: string;
    tool_call_id?: string;
    tool_calls?: CanonicalSftSample['messages'][number]['tool_calls'];
  }>;
  tools: CanonicalTool[];
  metadata: {
    sample_id: string;
    run_id: string;
    split: 'train' | 'validation' | 'test';
    acceptance_decision: string;
  };
}

export function exportHfToolCallingRows(
  samples: CanonicalSftSample[]
): DatasetExportResult<HfToolCallingRow> {
  const accumulator = createValidationAccumulator<HfToolCallingRow>();

  for (const sample of samples) {
    const decision = assessSampleForTarget(sample, 'hf_tool_calling');
    if (!decision.exportable) {
      accumulator.rejectedSamples.push(createRejectedSampleReport(sample, decision));
      continue;
    }
    if (sample.split.assignment === 'holdout') {
      continue;
    }

    const row: HfToolCallingRow = {
      messages: sample.messages.map((message) => ({
        role: message.role,
        content: normalizeMessageContent(message.content),
        ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
        ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
      })),
      tools: sample.tools ?? [],
      metadata: {
        sample_id: sample.sample_id,
        run_id: sample.source.run_id,
        split: sample.split.assignment,
        acceptance_decision: sample.quality.acceptance_decision,
      },
    };

    accumulator.exportedSamples.push(sample);
    pushRowBySplit(accumulator.rowsBySplit, sample.split.assignment, row);
  }

  return {
    target: 'hf_tool_calling',
    rowsBySplit: accumulator.rowsBySplit,
    validationReport: finalizeValidationReport('hf_tool_calling', accumulator),
  };
}
