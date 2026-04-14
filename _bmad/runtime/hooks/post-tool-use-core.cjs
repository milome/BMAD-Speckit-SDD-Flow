#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { refreshSessionArtifacts } = require('./party-mode-session-runtime.cjs');

const TRACE_VERSION = 1;
const MAX_CAPTURE_CHARS = 16_000;

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      if (!data.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    process.stdin.on('error', reject);
  });
}

function sanitizePathPart(input) {
  return String(input || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function computeSha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function stableStringify(value) {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function toTrimmedString(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined) {
    return '';
  }
  return stableStringify(value);
}

function truncateText(value) {
  if (value.length <= MAX_CAPTURE_CHARS) {
    return value;
  }
  const omitted = value.length - MAX_CAPTURE_CHARS;
  return `${value.slice(0, MAX_CAPTURE_CHARS)}\n...[truncated ${omitted} chars]`;
}

function inferSchema(value, depth = 0) {
  if (depth > 3) {
    return {};
  }
  if (value == null) {
    return {};
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { type: 'array', items: {} };
    }
    return {
      type: 'array',
      items: inferSchema(value[0], depth + 1),
    };
  }
  if (typeof value === 'string') {
    return { type: 'string' };
  }
  if (typeof value === 'boolean') {
    return { type: 'boolean' };
  }
  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' };
  }
  if (!isRecord(value)) {
    return {};
  }

  const entries = Object.entries(value).slice(0, 50);
  return {
    type: 'object',
    properties: Object.fromEntries(entries.map(([key, child]) => [key, inferSchema(child, depth + 1)])),
    required: entries.map(([key]) => key),
    additionalProperties: true,
  };
}

function resolveProjectRoot(input) {
  return path.resolve(
    process.env.CLAUDE_PROJECT_DIR ||
      (input && input.cwd) ||
      process.env.CURSOR_PROJECT_ROOT ||
      process.cwd()
  );
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveRuntimeScope(root) {
  const registryPath = path.join(root, '_bmad-output', 'runtime', 'registry.json');
  if (!fs.existsSync(registryPath)) {
    return null;
  }

  let registry;
  try {
    registry = readJsonFile(registryPath);
  } catch {
    return null;
  }
  if (!isRecord(registry) || !isRecord(registry.activeScope) || registry.activeScope.scopeType !== 'run') {
    return null;
  }

  const runId = typeof registry.activeScope.runId === 'string' ? registry.activeScope.runId : '';
  if (!runId) {
    return null;
  }

  const registeredRun = isRecord(registry.runContexts) && isRecord(registry.runContexts[runId])
    ? registry.runContexts[runId]
    : null;
  const rawContextPath =
    typeof registry.activeScope.resolvedContextPath === 'string'
      ? registry.activeScope.resolvedContextPath
      : registeredRun && typeof registeredRun.path === 'string'
        ? registeredRun.path
        : null;
  if (!rawContextPath) {
    return null;
  }

  const contextPath = path.isAbsolute(rawContextPath)
    ? rawContextPath
    : path.resolve(root, rawContextPath);
  if (!fs.existsSync(contextPath)) {
    return null;
  }

  let context;
  try {
    context = readJsonFile(contextPath);
  } catch {
    return null;
  }
  if (!isRecord(context)) {
    return null;
  }

  const flow = typeof context.flow === 'string' ? context.flow : 'story';
  const stageOverride = typeof process.env.BMAD_TOOL_TRACE_STAGE === 'string' ? process.env.BMAD_TOOL_TRACE_STAGE : null;
  const stage =
    stageOverride && stageOverride.trim().length > 0
      ? stageOverride.trim()
      : typeof context.stage === 'string'
        ? context.stage
        : null;
  if (!stage) {
    return null;
  }

  return {
    runId,
    flow,
    stage,
    scope: {
      story_key: typeof registry.activeScope.storyId === 'string' ? registry.activeScope.storyId : undefined,
      epic_id: typeof registry.activeScope.epicId === 'string' ? registry.activeScope.epicId : undefined,
      story_id: typeof registry.activeScope.storyId === 'string' ? registry.activeScope.storyId : undefined,
      flow,
      artifact_root: typeof context.artifactRoot === 'string' ? context.artifactRoot : undefined,
      resolved_context_path: contextPath,
    },
  };
}

function readPathCandidate(input, candidates) {
  for (const candidate of candidates) {
    let current = input;
    let ok = true;
    for (const part of candidate) {
      if (!isRecord(current) || !(part in current)) {
        ok = false;
        break;
      }
      current = current[part];
    }
    if (ok && current !== undefined) {
      return current;
    }
  }
  return undefined;
}

function extractWrittenFilePath(input) {
  const value = readPathCandidate(input, [
    ['tool_input', 'file_path'],
    ['tool_input', 'path'],
    ['toolInput', 'file_path'],
    ['toolInput', 'path'],
    ['file_path'],
    ['path'],
  ]);
  return typeof value === 'string' ? value : '';
}

function extractShellCommand(input) {
  const value = readPathCandidate(input, [
    ['tool_input', 'command'],
    ['tool_input', 'cmd'],
    ['toolInput', 'command'],
    ['toolInput', 'cmd'],
    ['command'],
  ]);
  return typeof value === 'string' ? value : '';
}

function extractPartyModeSessionKey(input) {
  const writtenPath = extractWrittenFilePath(input);
  if (writtenPath) {
    const normalized = normalizeRuntimePath(writtenPath);
    const match = normalized.match(/_bmad-output\/party-mode\/sessions\/(.+?)\.(jsonl|meta\.json)$/u);
    if (match) {
      return match[1];
    }
  }

  const shellCommand = extractShellCommand(input);
  if (shellCommand && shellCommand.includes('party-mode-session-event.cjs')) {
    const match = shellCommand.match(/--session-key\s+["']?([^"'\s]+)["']?/u);
    if (match) {
      return match[1];
    }
  }

  return '';
}

function normalizeRuntimePath(targetPath) {
  return String(targetPath || '').replace(/\\/g, '/');
}

function extractToolInvocation(input) {
  if (!isRecord(input)) {
    return null;
  }

  const toolName = readPathCandidate(input, [
    ['tool_name'],
    ['toolName'],
    ['tool', 'name'],
    ['name'],
  ]);
  if (typeof toolName !== 'string' || toolName.trim() === '') {
    return null;
  }

  const rawToolInput = readPathCandidate(input, [
    ['tool_input'],
    ['toolInput'],
    ['tool', 'input'],
    ['input'],
  ]);
  const rawToolOutput = readPathCandidate(input, [
    ['tool_result'],
    ['toolResult'],
    ['tool_output'],
    ['toolOutput'],
    ['tool_response'],
    ['toolResponse'],
    ['tool', 'output'],
    ['result'],
    ['output'],
    ['response'],
  ]);
  const rawToolCallId = readPathCandidate(input, [
    ['tool_call_id'],
    ['toolCallId'],
    ['tool_use_id'],
    ['toolUseId'],
    ['id'],
    ['request_id'],
    ['requestId'],
  ]);

  const normalizedArguments = truncateText(
    rawToolInput === undefined ? '{}' : toTrimmedString(rawToolInput)
  );
  const normalizedOutput = truncateText(
    rawToolOutput === undefined ? '' : toTrimmedString(rawToolOutput)
  );
  const toolCallId =
    typeof rawToolCallId === 'string' && rawToolCallId.trim() !== ''
      ? rawToolCallId
      : `call_${computeSha256(`${toolName}\n${normalizedArguments}\n${normalizedOutput}`)}`;

  return {
    toolName: toolName.trim(),
    toolCallId,
    argumentsText: normalizedArguments,
    outputText: normalizedOutput,
    parameters: inferSchema(rawToolInput === undefined ? {} : rawToolInput),
  };
}

function resolveArtifactPath(root, runId, stage) {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'artifacts',
    'tool-traces',
    sanitizePathPart(runId),
    `${sanitizePathPart(stage)}.json`
  );
}

function loadTrace(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      trace_version: TRACE_VERSION,
      messages: [],
      tools: [],
    };
  }

  try {
    const parsed = readJsonFile(filePath);
    if (!isRecord(parsed) || !Array.isArray(parsed.messages) || !Array.isArray(parsed.tools)) {
      throw new Error('invalid persisted trace');
    }
    return parsed;
  } catch {
    return {
      trace_version: TRACE_VERSION,
      messages: [],
      tools: [],
    };
  }
}

function writeJsonAtomic(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const body = JSON.stringify(payload, null, 2) + '\n';
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, body, 'utf8');
  fs.renameSync(tmpPath, filePath);
  return body;
}

function appendTraceEntry(trace, invocation) {
  const hasTool = trace.tools.some(
    (tool) => isRecord(tool) && isRecord(tool.function) && tool.function.name === invocation.toolName
  );
  if (!hasTool) {
    trace.tools.push({
      type: 'function',
      function: {
        name: invocation.toolName,
        parameters: invocation.parameters,
      },
    });
  }

  trace.messages.push({
    role: 'assistant',
    content: '',
    tool_calls: [
      {
        id: invocation.toolCallId,
        type: 'function',
        function: {
          name: invocation.toolName,
          arguments: invocation.argumentsText,
        },
      },
    ],
  });
  trace.messages.push({
    role: 'tool',
    tool_call_id: invocation.toolCallId,
    content: invocation.outputText,
  });
}

function appendRuntimeEvent(root, scope, artifactPath, traceRef, toolName, toolCallId) {
  const eventsDir = path.join(root, '_bmad-output', 'runtime', 'events');
  fs.mkdirSync(eventsDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const event = {
    event_id: randomUUID(),
    event_type: 'artifact.attached',
    event_version: 1,
    timestamp,
    run_id: scope.runId,
    flow: scope.flow,
    stage: scope.stage,
    scope: scope.scope,
    payload: {
      kind: 'tool_trace',
      path: artifactPath,
      content_hash: traceRef,
      tool_name: toolName,
      tool_call_id: toolCallId,
    },
    source: {
      source_path: artifactPath,
      content_hash: traceRef,
    },
  };
  const filePath = path.join(
    eventsDir,
    `${sanitizePathPart(timestamp)}-${sanitizePathPart(event.event_id)}.json`
  );
  writeJsonAtomic(filePath, event);
}

function captureToolTrace(input) {
  const root = resolveProjectRoot(input);
  const scope = resolveRuntimeScope(root);
  if (!scope) {
    return { captured: false, reason: 'missing_active_run_scope' };
  }

  const invocation = extractToolInvocation(input);
  if (!invocation) {
    return { captured: false, reason: 'missing_tool_payload' };
  }

  const artifactPath = resolveArtifactPath(root, scope.runId, scope.stage);
  const trace = loadTrace(artifactPath);
  appendTraceEntry(trace, invocation);
  const body = writeJsonAtomic(artifactPath, trace);
  const traceRef = `sha256:${computeSha256(body)}`;

  appendRuntimeEvent(
    root,
    scope,
    artifactPath,
    traceRef,
    invocation.toolName,
    invocation.toolCallId
  );

  return {
    captured: true,
    runId: scope.runId,
    stage: scope.stage,
    artifactPath,
    traceRef,
  };
}

function refreshPartyModeSessionFromToolUse(input) {
  const root = resolveProjectRoot(input);
  const sessionKey = extractPartyModeSessionKey(input);
  if (!sessionKey) {
    return { refreshed: false, reason: 'no_party_mode_session_key' };
  }
  return refreshSessionArtifacts(root, sessionKey);
}

async function postToolUseCore(options = {}) {
  const host = options.host === 'cursor' ? 'cursor' : 'claude';

  try {
    const input = await readStdin();
    captureToolTrace(input);
    refreshPartyModeSessionFromToolUse(input);
    return {
      exitCode: 0,
      output: host === 'cursor' ? '{}\n' : '',
      stderr: '',
    };
  } catch (error) {
    return {
      exitCode: 0,
      output: host === 'cursor' ? '{}\n' : '',
      stderr: `[post-tool-use] ${error && error.message ? error.message : String(error)}`,
    };
  }
}

module.exports = {
  captureToolTrace,
  extractPartyModeSessionKey,
  postToolUseCore,
  refreshPartyModeSessionFromToolUse,
};
