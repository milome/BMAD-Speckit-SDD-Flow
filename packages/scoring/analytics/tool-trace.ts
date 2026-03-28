import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeStringHash } from '../utils/hash';
import { readRuntimeEvents } from '../runtime';
import type { CanonicalMessage, CanonicalTool, CanonicalToolCall } from './types';

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
