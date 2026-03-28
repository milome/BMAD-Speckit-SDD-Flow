import type { CanonicalSftSample } from '../types';
import { exportHfConversationalRows, type HfConversationalRow } from './hf-conversational';
import { exportHfToolCallingRows, type HfToolCallingRow } from './hf-tool-calling';
import { exportOpenAiChatRows, type OpenAiChatRow } from './openai-chat';
import type { DatasetExportResult, DatasetExportTarget } from '../validation-report';

export type { OpenAiChatRow } from './openai-chat';
export type { HfConversationalRow } from './hf-conversational';
export type { HfToolCallingRow } from './hf-tool-calling';

export function exportCanonicalSamples(
  samples: CanonicalSftSample[],
  target: 'openai_chat'
): DatasetExportResult<OpenAiChatRow>;
export function exportCanonicalSamples(
  samples: CanonicalSftSample[],
  target: 'hf_conversational'
): DatasetExportResult<HfConversationalRow>;
export function exportCanonicalSamples(
  samples: CanonicalSftSample[],
  target: 'hf_tool_calling'
): DatasetExportResult<HfToolCallingRow>;
export function exportCanonicalSamples(
  samples: CanonicalSftSample[],
  target: DatasetExportTarget
): DatasetExportResult<OpenAiChatRow | HfConversationalRow | HfToolCallingRow>;
export function exportCanonicalSamples(
  samples: CanonicalSftSample[],
  target: DatasetExportTarget
): DatasetExportResult<OpenAiChatRow | HfConversationalRow | HfToolCallingRow> {
  if (target === 'openai_chat') {
    return exportOpenAiChatRows(samples);
  }
  if (target === 'hf_conversational') {
    return exportHfConversationalRows(samples);
  }
  return exportHfToolCallingRows(samples);
}
