import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeStringHash } from '../utils/hash';
import { readRuntimeEvents } from '../runtime';
import type { CanonicalMessage, CanonicalTool, CanonicalToolCall } from './types';

export interface ToolTraceSummary {
  tool_count: number;
  assistant_call_count: number;
  tool_result_count: number;
  has_orphan_tool_call: boolean;
  has_orphan_tool_result: boolean;
  call_result_matched: boolean;
}

export type ToolTraceCompleteness = 'complete' | 'partial' | 'missing' | 'blocked';

export interface PersistedToolTrace {
  trace_version?: number;
  messages: CanonicalMessage[];
  tools: CanonicalTool[];
}

export interface LoadedToolTrace {
  messages: CanonicalMessage[];
  tools: CanonicalTool[];
  traceRef: string;
  artifactPath: string;
}

export interface DiscoveredToolTrace extends LoadedToolTrace {
  attachedAt?: string;
}

export function summarizeToolTrace(trace: LoadedToolTrace): ToolTraceSummary {
  const assistantCalls = trace.messages
    .filter((message) => message.role === 'assistant')
    .flatMap((message) => message.tool_calls ?? []);
  const toolResults = trace.messages.filter((message) => message.role === 'tool');
  const assistantCallIds = assistantCalls.map((call) => call.id);
  const toolResultIds = toolResults
    .map((message) => message.tool_call_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const toolResultIdSet = new Set(toolResultIds);
  const assistantCallIdSet = new Set(assistantCallIds);
  const hasOrphanToolCall = assistantCallIds.some((id) => !toolResultIdSet.has(id));
  const hasOrphanToolResult = toolResultIds.some((id) => !assistantCallIdSet.has(id));

  return {
    tool_count: trace.tools.length,
    assistant_call_count: assistantCalls.length,
    tool_result_count: toolResults.length,
    has_orphan_tool_call: hasOrphanToolCall,
    has_orphan_tool_result: hasOrphanToolResult,
    call_result_matched: assistantCalls.length > 0 && !hasOrphanToolCall && !hasOrphanToolResult,
  };
}

export function computeTraceCompleteness(
  trace: LoadedToolTrace | null,
  options: { blocked?: boolean } = {}
): ToolTraceCompleteness {
  if (options.blocked) {
    return 'blocked';
  }
  if (!trace) {
    return 'missing';
  }

  const summary = summarizeToolTrace(trace);
  if (summary.assistant_call_count === 0 && summary.tool_result_count === 0) {
    return 'missing';
  }

  return summary.call_result_matched ? 'complete' : 'partial';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isContentPart(value: unknown): value is { type: 'text'; text: string } {
  return (
    isRecord(value) &&
    value.type === 'text' &&
    typeof value.text === 'string'
  );
}

function isMessageContent(value: unknown): value is CanonicalMessage['content'] {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((item) => isContentPart(item)))
  );
}

function isToolCall(value: unknown): value is CanonicalToolCall {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.type === 'function' &&
    isRecord(value.function) &&
    typeof value.function.name === 'string' &&
    typeof value.function.arguments === 'string'
  );
}

function isCanonicalMessage(value: unknown): value is CanonicalMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (!isMessageContent(value.content)) {
    return false;
  }

  if (value.role !== 'assistant' && value.role !== 'tool') {
    return false;
  }

  if (value.role === 'assistant') {
    return Array.isArray(value.tool_calls) && value.tool_calls.length > 0 && value.tool_calls.every(isToolCall);
  }

  return typeof value.tool_call_id === 'string';
}

function isCanonicalTool(value: unknown): value is CanonicalTool {
  return (
    isRecord(value) &&
    value.type === 'function' &&
    isRecord(value.function) &&
    typeof value.function.name === 'string' &&
    isRecord(value.function.parameters)
  );
}

export function resolveToolTracePath(toolTracePath: string, cwd: string): string {
  return path.isAbsolute(toolTracePath) ? toolTracePath : path.resolve(cwd, toolTracePath);
}

export function readToolTraceArtifact(
  toolTracePath: string,
  cwd: string
): LoadedToolTrace | null {
  const resolved = resolveToolTracePath(toolTracePath, cwd);
  if (!fs.existsSync(resolved)) {
    return null;
  }

  try {
    const content = fs.readFileSync(resolved, 'utf-8');
    const parsed = JSON.parse(content) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    if (!Array.isArray(parsed.tools) || parsed.tools.length === 0 || !parsed.tools.every(isCanonicalTool)) {
      return null;
    }
    if (!Array.isArray(parsed.messages) || parsed.messages.length === 0 || !parsed.messages.every(isCanonicalMessage)) {
      return null;
    }

    const toolNames = new Set(parsed.tools.map((tool) => tool.function.name));
    const calledToolNames = parsed.messages
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => (message.tool_calls ?? []).map((call) => call.function.name));

    if (calledToolNames.some((name) => !toolNames.has(name))) {
      return null;
    }

    return {
      messages: parsed.messages,
      tools: parsed.tools,
      traceRef: `sha256:${computeStringHash(content)}`,
      artifactPath: resolved,
    };
  } catch {
    return null;
  }
}

function isToolTraceArtifactEvent(
  value: unknown
): value is {
  timestamp?: string;
  stage?: string | null;
  payload: { kind: string; path: string };
} {
  return (
    isRecord(value) &&
    value.event_type === 'artifact.attached' &&
    (value.stage == null || typeof value.stage === 'string') &&
    isRecord(value.payload) &&
    value.payload.kind === 'tool_trace' &&
    typeof value.payload.path === 'string'
  );
}

export function discoverLatestToolTraceArtifact(options: {
  root: string;
  runId: string;
  stage?: string | null;
  cwd?: string;
}): DiscoveredToolTrace | null {
  const cwd = options.cwd ?? options.root;
  const events = readRuntimeEvents({ root: options.root }).filter(
    (event) => event.run_id === options.runId && isToolTraceArtifactEvent(event)
  );

  const preferredMatches = options.stage
    ? events.filter((event) => event.stage === options.stage)
    : events;
  const fallbackMatches = preferredMatches.length > 0 ? preferredMatches : events;

  for (let index = fallbackMatches.length - 1; index >= 0; index -= 1) {
    const event = fallbackMatches[index];
    if (!isToolTraceArtifactEvent(event)) {
      continue;
    }
    const loaded = readToolTraceArtifact(event.payload.path, cwd);
    if (loaded != null) {
      return {
        ...loaded,
        attachedAt: event.timestamp,
      };
    }
  }

  return null;
}
