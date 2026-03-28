import type { CanonicalSftSample, CanonicalTool, CanonicalToolCall } from '../types';
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

export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_call_id?: string;
  tool_calls?: CanonicalToolCall[];
  weight?: 0 | 1;
}

export interface OpenAiChatRow {
  messages: OpenAiChatMessage[];
  tools?: CanonicalTool[];
  parallel_tool_calls: boolean;
  metadata: {
    sample_id: string;
    run_id: string;
    split: CanonicalSftSample['split']['assignment'];
    acceptance_decision: CanonicalSftSample['quality']['acceptance_decision'];
    redaction_status: CanonicalSftSample['redaction']['status'];
    redaction_applied_rules: string[];
    redaction_findings_count: number;
    redaction_finding_kinds: string[];
  };
}

function toOpenAiMessage(message: CanonicalSftSample['messages'][number]): OpenAiChatMessage {
  const content = normalizeMessageContent(message.content);
  const row: OpenAiChatMessage = {
    role: message.role,
  };

  if (content.length > 0) {
    row.content = content;
  }
  if (message.tool_call_id) {
    row.tool_call_id = message.tool_call_id;
  }
  if (message.tool_calls && message.tool_calls.length > 0) {
    row.tool_calls = message.tool_calls;
  }
  if (message.weight != null) {
    row.weight = message.weight;
  }

  return row;
}

export function exportOpenAiChatRows(
  samples: CanonicalSftSample[]
): DatasetExportResult<OpenAiChatRow> {
  const accumulator = createValidationAccumulator<OpenAiChatRow>();

  for (const sample of samples) {
    accumulator.seenSamples.push(sample);
    const decision = assessSampleForTarget(sample, 'openai_chat');
    if (!decision.exportable) {
      accumulator.rejectedSamples.push(createRejectedSampleReport(sample, decision));
      continue;
    }

    const row: OpenAiChatRow = {
      messages: sample.messages.map(toOpenAiMessage),
      parallel_tool_calls: false,
      metadata: {
        sample_id: sample.sample_id,
        run_id: sample.source.run_id,
        split: sample.split.assignment,
        acceptance_decision: sample.quality.acceptance_decision,
        ...buildExportRowRedactionMetadata(sample),
      },
      ...(sample.tools && sample.tools.length > 0 ? { tools: sample.tools } : {}),
    };

    accumulator.exportedSamples.push(sample);
    pushRowBySplit(accumulator.rowsBySplit, sample.split.assignment, row);
  }

  return {
    target: 'openai_chat',
    rowsBySplit: accumulator.rowsBySplit,
    validationReport: finalizeValidationReport('openai_chat', accumulator),
  };
}
