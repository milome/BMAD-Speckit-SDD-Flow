#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { refreshSessionArtifacts } = require('./party-mode-session-runtime.cjs');
const {
  derivePartyModeFinalSidecarPath,
  derivePartyModeProgressSidecarPath,
  derivePartyModeVisibleOutputCapturePath,
  readPartyModeCurrentSessionState,
  writePartyModeSidecar,
  writePartyModeCurrentSessionState,
} = require('./party-mode-current-session.cjs');

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

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
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

function isWriteLikeToolName(toolName) {
  const normalized = String(toolName || '').trim().toLowerCase();
  return (
    normalized === 'write' ||
    normalized === 'edit' ||
    normalized === 'multiedit' ||
    normalized === 'searchreplace' ||
    normalized === 'search_replace' ||
    normalized === 'applypatch' ||
    normalized === 'apply_patch'
  );
}

function classifyGeneratedDocumentKind(filePath) {
  const normalized = normalizeRuntimePath(filePath).toLowerCase();
  if (normalized.includes('/bugfix_')) {
    return 'bugfix';
  }
  if (normalized.includes('/tasks_bugfix_') || normalized.includes('/tasks_rca_') || normalized.includes('/tasks_')) {
    return 'tasks';
  }
  if (normalized.includes('/docs/requirements/')) {
    return 'requirement';
  }
  if (normalized.includes('/docs/plans/')) {
    return 'plan';
  }
  if (normalized.includes('/specs/')) {
    return 'spec';
  }
  if (
    normalized.includes('/_bmad-output/implementation-artifacts/') &&
    /\/story-[^/]+\/[^/]+\.md$/iu.test(normalized)
  ) {
    return 'story';
  }
  if (normalized.includes('/_bmad-output/implementation-artifacts/')) {
    return 'artifact_doc';
  }
  return 'document';
}

function resolvePartyModeGeneratedDocumentPath(projectRoot, input) {
  const toolName = typeof input?.tool_name === 'string' ? input.tool_name : '';
  if (!isWriteLikeToolName(toolName)) {
    return null;
  }

  const writtenPath = extractWrittenFilePath(input);
  if (!writtenPath) {
    return null;
  }

  const resolved = path.isAbsolute(writtenPath)
    ? path.resolve(writtenPath)
    : path.resolve(projectRoot, writtenPath);
  const normalized = normalizeRuntimePath(resolved);
  if (!/\.md$/iu.test(normalized)) {
    return null;
  }
  if (
    normalized.includes('/_bmad-output/party-mode/') ||
    normalized.includes('/_bmad-output/runtime/') ||
    normalized.includes('/.cursor/') ||
    normalized.includes('/.claude/') ||
    normalized.includes('/_bmad/')
  ) {
    return null;
  }
  if (
    normalized.includes('/_bmad-output/implementation-artifacts/') ||
    normalized.includes('/specs/') ||
    normalized.includes('/docs/requirements/') ||
    normalized.includes('/docs/plans/')
  ) {
    return normalized;
  }
  return null;
}

function recordGeneratedPartyModeDocument(root, state, input) {
  const executionMode = String(state?.execution_mode || '');
  const agentType = String(state?.agent_type || '');
  const looksLikePartyModeSession =
    Boolean(state?.session_key) &&
    (
      agentType === 'party-mode-facilitator' ||
      executionMode === 'cursor_generalPurpose_compat' ||
      executionMode === 'facilitator_direct'
    );
  if (!looksLikePartyModeSession) {
    return { recorded: false, reason: 'no_active_party_mode_session' };
  }

  const generatedPath = resolvePartyModeGeneratedDocumentPath(root, input);
  if (!generatedPath) {
    return { recorded: false, reason: 'no_generated_document_path' };
  }

  const existingPaths = Array.isArray(state.generated_document_paths)
    ? state.generated_document_paths.filter((entry) => typeof entry === 'string' && entry.trim())
    : [];
  const deduped = [...new Set([...existingPaths, generatedPath])];
  const kind = classifyGeneratedDocumentKind(generatedPath);
  writePartyModeCurrentSessionState(root, {
    ...state,
    generated_document_paths: deduped,
    generated_document_count: deduped.length,
    latest_generated_document_path: generatedPath,
    latest_generated_document_kind: kind,
    document_generation_observed_at: new Date().toISOString(),
  });
  return {
    recorded: true,
    generatedDocumentPath: generatedPath,
    kind,
  };
}

function writePartyModeProgressSidecar(root, state, payload) {
  if (!state?.session_key) {
    return null;
  }
  const filePath = state.sidecar_progress_path || derivePartyModeProgressSidecarPath(root, state.session_key);
  return writePartyModeSidecar(filePath, {
    schema_version: 'party_mode_sidecar_v1',
    sidecar_kind: 'progress',
    session_key: state.session_key,
    gate_profile_id: state.gate_profile_id || '',
    closure_level: state.closure_level || '',
    designated_challenger_id: state.designated_challenger_id || '',
    target_rounds_total: Number.isFinite(Number(state.target_rounds_total))
      ? Number(state.target_rounds_total)
      : null,
    current_batch_target_round: Number.isFinite(Number(state.current_batch_target_round))
      ? Number(state.current_batch_target_round)
      : null,
    document_generation_required: Boolean(state.document_generation_required),
    expected_document_count: Number.isFinite(Number(state.expected_document_count))
      ? Number(state.expected_document_count)
      : 0,
    expected_document_paths: Array.isArray(state.expected_document_paths)
      ? state.expected_document_paths
      : [],
    generated_document_count: Number.isFinite(Number(payload.generated_document_count))
      ? Number(payload.generated_document_count)
      : 0,
    generated_document_paths: Array.isArray(payload.generated_document_paths)
      ? payload.generated_document_paths
      : [],
    latest_generated_document_path: payload.latest_generated_document_path || '',
    latest_generated_document_kind: payload.latest_generated_document_kind || '',
    progress_current_round: Number.isFinite(Number(payload.progress_current_round))
      ? Number(payload.progress_current_round)
      : null,
    progress_target_round: Number.isFinite(Number(payload.progress_target_round))
      ? Number(payload.progress_target_round)
      : null,
    observed_visible_round_count: Number.isFinite(Number(payload.observed_visible_round_count))
      ? Number(payload.observed_visible_round_count)
      : null,
    visible_output_summary:
      payload.visible_output_summary && typeof payload.visible_output_summary === 'object'
        ? payload.visible_output_summary
        : null,
    validation_errors: Array.isArray(payload.validation_errors) ? payload.validation_errors : [],
    validation_warnings: Array.isArray(payload.validation_warnings) ? payload.validation_warnings : [],
    status: payload.status || 'in_progress',
    agent_turn_event_source_mode: payload.agent_turn_event_source_mode || state.agent_turn_event_source_mode || '',
    host_native_agent_turn_supported:
      typeof payload.host_native_agent_turn_supported === 'boolean'
        ? payload.host_native_agent_turn_supported
        : typeof state.host_native_agent_turn_supported === 'boolean'
          ? state.host_native_agent_turn_supported
          : null,
    host_native_agent_turn_reason:
      payload.host_native_agent_turn_reason || state.host_native_agent_turn_reason || '',
    written_at: new Date().toISOString(),
    written_by: payload.written_by || 'post_tool_use_visible_output_reconstruction',
  });
}

function writePartyModeFinalSidecar(root, state, payload) {
  if (!state?.session_key) {
    return null;
  }
  const filePath = state.sidecar_final_path || derivePartyModeFinalSidecarPath(root, state.session_key);
  return writePartyModeSidecar(filePath, {
    schema_version: 'party_mode_sidecar_v1',
    sidecar_kind: 'final',
    session_key: state.session_key,
    gate_profile_id: state.gate_profile_id || '',
    closure_level: state.closure_level || '',
    designated_challenger_id: state.designated_challenger_id || '',
    target_rounds_total: Number.isFinite(Number(state.target_rounds_total))
      ? Number(state.target_rounds_total)
      : null,
    current_batch_target_round: Number.isFinite(Number(state.current_batch_target_round))
      ? Number(state.current_batch_target_round)
      : null,
    document_generation_required: Boolean(state.document_generation_required),
    expected_document_count: Number.isFinite(Number(state.expected_document_count))
      ? Number(state.expected_document_count)
      : 0,
    expected_document_paths: Array.isArray(state.expected_document_paths)
      ? state.expected_document_paths
      : [],
    generated_document_count: Number.isFinite(Number(payload.generated_document_count))
      ? Number(payload.generated_document_count)
      : 0,
    generated_document_paths: Array.isArray(payload.generated_document_paths)
      ? payload.generated_document_paths
      : [],
    latest_generated_document_path: payload.latest_generated_document_path || '',
    latest_generated_document_kind: payload.latest_generated_document_kind || '',
    document_generation_observed_at: payload.document_generation_observed_at || '',
    observed_visible_round_count: Number.isFinite(Number(payload.observed_visible_round_count))
      ? Number(payload.observed_visible_round_count)
      : null,
    visible_fragment_record_present: Boolean(payload.visible_fragment_record_present),
    visible_output_summary:
      payload.visible_output_summary && typeof payload.visible_output_summary === 'object'
        ? payload.visible_output_summary
        : null,
    validation_status: payload.validation_status || '',
    final_result: payload.final_result || '',
    status: payload.status || 'completed',
    validation_errors: Array.isArray(payload.validation_errors) ? payload.validation_errors : [],
    validation_warnings: Array.isArray(payload.validation_warnings) ? payload.validation_warnings : [],
    agent_turn_event_source_mode: payload.agent_turn_event_source_mode || state.agent_turn_event_source_mode || '',
    host_native_agent_turn_supported:
      typeof payload.host_native_agent_turn_supported === 'boolean'
        ? payload.host_native_agent_turn_supported
        : typeof state.host_native_agent_turn_supported === 'boolean'
          ? state.host_native_agent_turn_supported
          : null,
    host_native_agent_turn_reason:
      payload.host_native_agent_turn_reason || state.host_native_agent_turn_reason || '',
    written_at: new Date().toISOString(),
    written_by: payload.written_by || 'post_tool_use_visible_output_reconstruction',
  });
}

function buildCarrierReturnWithoutVisibleOutputSummary(state, transcriptPath) {
  const warnings = [];
  if (transcriptPath) {
    warnings.push('transcript_path_present_but_no_extractable_visible_output');
  }
  return {
    capture_path: normalizeRuntimePath(state?.visible_output_capture_path || ''),
    visible_output_sha256: '',
    visible_output_chars: 0,
    observed_visible_round_count: 0,
    first_visible_round: null,
    last_visible_round: null,
    observed_visible_speaker_line_count: 0,
    progress_current_round: null,
    progress_target_round: Number.isFinite(Number(state?.target_rounds_total))
      ? Number(state.target_rounds_total)
      : null,
    final_gate_present: false,
    final_gate_profile: '',
    final_gate_total_rounds: null,
    observed_visible_speakers: [],
    unique_visible_speaker_count: 0,
    normalized_visible_speaker_content_count: 0,
    quality_flags: ['missing_visible_output_after_carrier_return', ...warnings],
    diagnostic_classification: 'carrier_return_without_visible_output',
    excerpt: transcriptPath
      ? 'Party-mode carrier tool returned, but neither tool output nor transcript produced extractable visible discussion output.'
      : 'Party-mode carrier tool returned without visible discussion output.',
  };
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

function extractRawToolInput(input) {
  return readPathCandidate(input, [
    ['tool_input'],
    ['toolInput'],
    ['tool', 'input'],
    ['input'],
  ]);
}

function extractPartyModeIntentText(input) {
  const raw = extractRawToolInput(input);
  const parts = [
    typeof input?.tool_name === 'string' ? input.tool_name : '',
    typeof raw?.executor === 'string' ? raw.executor : '',
    typeof raw?.subagent_type === 'string' ? raw.subagent_type : '',
    typeof raw?.subagentType === 'string' ? raw.subagentType : '',
    typeof raw?.agent_type === 'string' ? raw.agent_type : '',
    typeof raw?.agentType === 'string' ? raw.agentType : '',
    typeof raw?.description === 'string' ? raw.description : '',
    typeof raw?.prompt === 'string' ? raw.prompt : '',
    typeof raw?.task === 'string' ? raw.task : '',
    typeof raw?.message === 'string' ? raw.message : '',
    typeof input?.task === 'string' ? input.task : '',
    typeof input?.prompt === 'string' ? input.prompt : '',
  ];
  return parts.filter(Boolean).join('\n').toLowerCase();
}

function looksLikePartyModeIntent(input, currentState, rawOutput) {
  if (extractPartyModeSessionKey(input)) {
    return true;
  }
  if (rawOutput && (/^### Round \d+\s*$/mu.test(rawOutput) || /^## Final Gate Evidence$/gmu.test(rawOutput))) {
    return true;
  }
  const text = extractPartyModeIntentText(input);
  if (!text) {
    return false;
  }
  if (text.includes('party-mode-facilitator') || text.includes('party mode') || text.includes('party-mode')) {
    return true;
  }
  if (
    currentState &&
    currentState.execution_mode === 'cursor_generalPurpose_compat' &&
    (text.includes('generalpurpose') || text.includes('general-purpose'))
  ) {
    return true;
  }
  return false;
}

function extractToolExecutor(input) {
  const raw = extractRawToolInput(input);
  const value = readPathCandidate({ raw }, [
    ['raw', 'executor'],
    ['raw', 'subagent_type'],
    ['raw', 'subagentType'],
    ['raw', 'agent_type'],
    ['raw', 'agentType'],
  ]);
  return typeof value === 'string' ? value.trim() : '';
}

function extractTranscriptPath(input) {
  const value = readPathCandidate(input, [
    ['transcript_path'],
    ['transcriptPath'],
    ['payload', 'transcript_path'],
    ['payload', 'transcriptPath'],
    ['tool_result', 'transcript_path'],
    ['toolResult', 'transcript_path'],
  ]);
  return typeof value === 'string' ? value.trim() : '';
}

function isPartyModeCarrierTool(toolName) {
  return toolName === 'task' || toolName === 'mcp_task' || toolName === 'agent';
}

function extractRawToolOutput(input) {
  const rawToolOutput = readPathCandidate(input, [
    ['tool_result'],
    ['tool_result', 'text'],
    ['tool_result', 'content'],
    ['tool_result', 'message'],
    ['tool_result', 'last_assistant_message'],
    ['tool_result', 'assistant_message'],
    ['tool_result', 'output_text'],
    ['tool_result', 'stdout'],
    ['tool_result', 'output'],
    ['tool_result', 'response'],
    ['tool_result', 'result'],
    ['toolResult'],
    ['toolResult', 'text'],
    ['toolResult', 'content'],
    ['toolResult', 'message'],
    ['toolResult', 'last_assistant_message'],
    ['toolResult', 'assistant_message'],
    ['toolResult', 'output_text'],
    ['toolResult', 'stdout'],
    ['toolResult', 'output'],
    ['toolResult', 'response'],
    ['toolResult', 'result'],
    ['tool_output'],
    ['tool_output', 'text'],
    ['tool_output', 'content'],
    ['tool_output', 'message'],
    ['tool_output', 'last_assistant_message'],
    ['tool_output', 'assistant_message'],
    ['tool_output', 'output_text'],
    ['tool_output', 'stdout'],
    ['tool_output', 'output'],
    ['tool_output', 'response'],
    ['tool_output', 'result'],
    ['toolOutput'],
    ['toolOutput', 'text'],
    ['toolOutput', 'content'],
    ['toolOutput', 'message'],
    ['toolOutput', 'last_assistant_message'],
    ['toolOutput', 'assistant_message'],
    ['toolOutput', 'output_text'],
    ['toolOutput', 'stdout'],
    ['toolOutput', 'output'],
    ['toolOutput', 'response'],
    ['toolOutput', 'result'],
    ['tool_response'],
    ['tool_response', 'text'],
    ['tool_response', 'content'],
    ['tool_response', 'message'],
    ['tool_response', 'last_assistant_message'],
    ['tool_response', 'assistant_message'],
    ['tool_response', 'output_text'],
    ['tool_response', 'stdout'],
    ['tool_response', 'output'],
    ['tool_response', 'response'],
    ['tool_response', 'result'],
    ['toolResponse'],
    ['toolResponse', 'text'],
    ['toolResponse', 'content'],
    ['toolResponse', 'message'],
    ['toolResponse', 'last_assistant_message'],
    ['toolResponse', 'assistant_message'],
    ['toolResponse', 'output_text'],
    ['toolResponse', 'stdout'],
    ['toolResponse', 'output'],
    ['toolResponse', 'response'],
    ['toolResponse', 'result'],
    ['tool', 'output'],
    ['result'],
    ['result', 'text'],
    ['result', 'content'],
    ['result', 'message'],
    ['result', 'last_assistant_message'],
    ['result', 'assistant_message'],
    ['result', 'output_text'],
    ['result', 'stdout'],
    ['result', 'output'],
    ['result', 'response'],
    ['output'],
    ['output', 'text'],
    ['output', 'content'],
    ['output', 'message'],
    ['output', 'last_assistant_message'],
    ['output', 'assistant_message'],
    ['output', 'output_text'],
    ['output', 'stdout'],
    ['output', 'response'],
    ['response'],
    ['response', 'text'],
    ['response', 'content'],
    ['response', 'message'],
    ['response', 'last_assistant_message'],
    ['response', 'assistant_message'],
    ['response', 'output_text'],
    ['response', 'stdout'],
  ]);
  return toUntruncatedString(rawToolOutput);
}

function toUntruncatedString(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined || value === null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toUntruncatedString(entry)).filter(Boolean).join('\n');
  }
  if (isRecord(value)) {
    if (typeof value.text === 'string') {
      return value.text;
    }
    if (typeof value.content === 'string') {
      return value.content;
    }
    if (typeof value.message === 'string') {
      return value.message;
    }
    if (typeof value.last_assistant_message === 'string') {
      return value.last_assistant_message;
    }
    if (typeof value.assistant_message === 'string') {
      return value.assistant_message;
    }
    if (typeof value.output_text === 'string') {
      return value.output_text;
    }
    if (typeof value.stdout === 'string') {
      return value.stdout;
    }
    if (typeof value.output === 'string') {
      return value.output;
    }
    if (typeof value.response === 'string') {
      return value.response;
    }
    if (typeof value.result === 'string') {
      return value.result;
    }
    if (typeof value.value === 'string') {
      return value.value;
    }
    if (Array.isArray(value.content)) {
      return value.content.map((entry) => toUntruncatedString(entry)).filter(Boolean).join('\n');
    }
    if (Array.isArray(value.messages)) {
      return value.messages.map((entry) => toUntruncatedString(entry)).filter(Boolean).join('\n');
    }
  }
  return stableStringify(value);
}

function collectDeepStrings(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (value == null) {
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectDeepStrings(entry, out);
    }
    return out;
  }
  if (typeof value === 'object') {
    for (const child of Object.values(value)) {
      collectDeepStrings(child, out);
    }
  }
  return out;
}

function readBulletField(body, label) {
  const normalizedLabel = `- ${label}:`;
  const line = String(body || '')
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(normalizedLabel));
  return line ? line.slice(normalizedLabel.length).trim() : '';
}

function parseSpeakerLine(line) {
  const match = line.match(/^\S+\s+\*\*(.+?)\*\*:\s(.+)$/u);
  if (!match) return null;
  return {
    displayName: match[1].trim(),
    content: match[2].trim(),
  };
}

function parseProgressMarker(content) {
  const match = String(content || '').match(
    /^(?:当前进度|Current progress)\s*[:：]\s*(\d+)\s*\/\s*(\d+)(?:\s*(?:轮|rounds?))?/imu
  );
  if (!match) {
    return null;
  }
  return {
    currentRound: Number(match[1]),
    targetRoundsTotal: Number(match[2]),
  };
}

function matchRoundHeader(line) {
  return String(line || '').match(
    /^(?:#{1,6}\s*)?Round\s+(\d+)(?:\s*\/\s*\d+)?(?:\s*[-:：].*)?\s*$/iu
  );
}

function parseRoundSections(content) {
  return String(content || '')
    .split(/(?=^(?:#{1,6}\s*)?Round\s+\d+(?:\s*\/\s*\d+)?(?:\s*[-:：].*)?\s*$)/gimu)
    .filter((section) => {
      const firstLine = String(section || '').split(/\r?\n/u)[0]?.trim() || '';
      return Boolean(matchRoundHeader(firstLine));
    })
    .map((section) => {
      const firstLine = String(section || '').split(/\r?\n/u)[0]?.trim() || '';
      const roundMatch = matchRoundHeader(firstLine);
      const speakerLines = section
        .split(/\r?\n/u)
        .map((line) => parseSpeakerLine(line.trim()))
        .filter(Boolean);
      return {
        round: roundMatch ? Number(roundMatch[1]) : null,
        section,
        speakerLines,
      };
    })
    .filter((entry) => Number.isInteger(entry.round) && entry.round > 0);
}

function normalizeSpeakerContentForQuality(content) {
  return String(content || '')
    .toLowerCase()
    .replace(/\d+/gu, '#')
    .replace(/第\s*#\s*轮/gu, '第N轮')
    .replace(/\s+/gu, ' ')
    .trim();
}

function analyzeVisibleOutputQuality(visibleOutput, roundSections, finalGate) {
  const parsedSpeakerLines = String(visibleOutput || '')
    .split(/\r?\n/u)
    .map((line) => parseSpeakerLine(line.trim()))
    .filter(Boolean);
  const speakerNames = [...new Set(parsedSpeakerLines.map((line) => line.displayName))];
  const normalizedSpeakerContents = parsedSpeakerLines
    .map((line) => normalizeSpeakerContentForQuality(line.content))
    .filter(Boolean);
  const uniqueNormalizedSpeakerContents = [...new Set(normalizedSpeakerContents)];
  const trimmedOutput = String(visibleOutput || '').trim();
  const stubOnlyCompletion =
    /^the subagent task has completed\.?$/iu.test(trimmedOutput) ||
    /^subagent completed\.?$/iu.test(trimmedOutput) ||
    /^任务已完成\.?$/iu.test(trimmedOutput);
  const degeneratePlaceholderCompletion =
    Boolean(finalGate) &&
    roundSections.length >= 20 &&
    speakerNames.length <= 1 &&
    uniqueNormalizedSpeakerContents.length <= 2;
  const flags = [];
  if (stubOnlyCompletion) {
    flags.push('stub_only_completion');
  }
  if (speakerNames.length === 1 && parsedSpeakerLines.length > 0) {
    flags.push('single_visible_speaker');
  }
  if (degeneratePlaceholderCompletion) {
    flags.push('degenerate_placeholder_completion');
  }
  let diagnosticClassification = 'no_visible_output';
  if (stubOnlyCompletion) {
    diagnosticClassification = 'stub_only_completion';
  } else if (degeneratePlaceholderCompletion) {
    diagnosticClassification = 'degenerate_placeholder_completion';
  } else if (finalGate) {
    diagnosticClassification = 'completed_visible_output';
  } else if (roundSections.length > 0) {
    diagnosticClassification = 'partial_visible_output';
  } else if (trimmedOutput) {
    diagnosticClassification = 'fragment_only_output';
  }
  return {
    observed_visible_speakers: speakerNames,
    unique_visible_speaker_count: speakerNames.length,
    normalized_visible_speaker_content_count: uniqueNormalizedSpeakerContents.length,
    quality_flags: flags,
    diagnostic_classification: diagnosticClassification,
  };
}

function parseFinalGateEvidence(content) {
  const blockMatch = String(content || '').match(/^## Final Gate Evidence\s*$([\s\S]*)$/mu);
  if (!blockMatch) return null;
  const body = blockMatch[1];
  return {
    gateProfile: readBulletField(body, 'Gate Profile'),
    totalRounds: Number(readBulletField(body, 'Total Rounds')),
    challengerRatioCheck: readBulletField(body, 'Challenger Ratio Check'),
    tailWindowNoNewGap: readBulletField(body, 'Tail Window No New Gap'),
    finalResult: readBulletField(body, 'Final Result'),
  };
}

function extractPartyModeResultFromTaskNotification(text) {
  const raw = String(text || '');
  const match = raw.match(/<result>([\s\S]*?)<\/result>/iu);
  if (!match) {
    return '';
  }
  return String(match[1] || '').trim();
}

function extractPartyModeVisibleOutputFromTranscript(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return '';
  }
  const lines = fs
    .readFileSync(transcriptPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    let parsed = null;
    try {
      parsed = JSON.parse(lines[index]);
    } catch {
      continue;
    }
    const strings = collectDeepStrings(parsed);
    for (const text of strings) {
      if (typeof text !== 'string') {
        continue;
      }
      const embedded = extractPartyModeResultFromTaskNotification(text);
      if (embedded && (embedded.includes('## Final Gate Evidence') || /^### Round \d+\s*$/mu.test(embedded))) {
        return embedded.trim();
      }
      if (text.includes('## Final Gate Evidence') || /^### Round \d+\s*$/mu.test(text)) {
        return text.trim();
      }
    }
  }
  return '';
}

function buildVisibleOutputSummary(capturePath, visibleOutput, roundSections, finalGate) {
  const progress = parseProgressMarker(visibleOutput);
  const speakerLineCount = String(visibleOutput || '')
    .split(/\r?\n/u)
    .map((line) => parseSpeakerLine(line.trim()))
    .filter(Boolean).length;
  const rounds = roundSections
    .map((entry) => Number(entry.round))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
  const quality = analyzeVisibleOutputQuality(visibleOutput, roundSections, finalGate);
  return {
    capture_path: normalizeRuntimePath(capturePath),
    visible_output_sha256: computeSha256(String(visibleOutput || '')),
    visible_output_chars: String(visibleOutput || '').length,
    observed_visible_round_count: roundSections.length,
    first_visible_round: rounds.length > 0 ? Math.min(...rounds) : null,
    last_visible_round: rounds.length > 0 ? Math.max(...rounds) : null,
    observed_visible_speaker_line_count: speakerLineCount,
    progress_current_round: progress?.currentRound ?? null,
    progress_target_round: progress?.targetRoundsTotal ?? null,
    final_gate_present: Boolean(finalGate),
    final_gate_profile: finalGate?.gateProfile || '',
    final_gate_total_rounds: Number.isFinite(finalGate?.totalRounds)
      ? finalGate.totalRounds
      : null,
    observed_visible_speakers: quality.observed_visible_speakers,
    unique_visible_speaker_count: quality.unique_visible_speaker_count,
    normalized_visible_speaker_content_count: quality.normalized_visible_speaker_content_count,
    quality_flags: quality.quality_flags,
    diagnostic_classification: quality.diagnostic_classification,
    excerpt: truncateText(String(visibleOutput || '')),
  };
}

function derivePartyModeRawCapturePath(projectRoot, sessionKey) {
  return path.join(
    projectRoot,
    '_bmad-output',
    'party-mode',
    'captures',
    `${sessionKey}.post-tool-use.raw.json`
  );
}

function buildVisibleOutputFragmentRecord(state, capturePath, visibleOutput, roundSections, finalGate) {
  const summary = buildVisibleOutputSummary(
    capturePath,
    visibleOutput,
    roundSections,
    finalGate
  );
  return {
    record_type: 'visible_output_fragment',
    session_key: state.session_key,
    counts_toward_ratio: false,
    timestamp: new Date().toISOString(),
    payload: {
      ...summary,
    },
  };
}

function writeVisibleFinalGateFallbackArtifacts(projectRoot, state, finalGate, visibleOutput) {
  const auditPath = path.resolve(projectRoot, normalizeRuntimePath(state.audit_verdict_path || ''));
  const snapshotPath = path.resolve(projectRoot, normalizeRuntimePath(state.snapshot_path || ''));
  ensureParentDir(auditPath);
  ensureParentDir(snapshotPath);
  const now = new Date().toISOString();
  const auditPayload = {
    session_key: state.session_key,
    gate_profile_id: state.gate_profile_id,
    closure_level: state.closure_level || 'high_confidence',
    source_mode: 'visible_final_gate_evidence',
    visible_output_capture_path:
      state.visible_output_capture_path ||
      derivePartyModeVisibleOutputCapturePath(projectRoot, state.session_key),
    checker_result: {
      session_key: state.session_key,
      gate_profile_id: state.gate_profile_id,
      reported_total_rounds: finalGate.totalRounds,
      observed_visible_round_count: parseRoundSections(visibleOutput).length,
      designated_challenger_id: state.designated_challenger_id || 'adversarial-reviewer',
      source_log_sha256: null,
    },
    min_rounds_check: 'PASS',
    challenger_ratio_check: finalGate.challengerRatioCheck || 'PASS',
    last_tail_no_new_gap_check: finalGate.tailWindowNoNewGap || 'PASS',
    final_result: finalGate.finalResult || 'PASS',
    generated_at: now,
  };
  fs.writeFileSync(auditPath, `${JSON.stringify(auditPayload, null, 2)}\n`, 'utf8');
  const snapshotPayload = {
    session_key: state.session_key,
    source_mode: 'visible_final_gate_evidence',
    last_completed_round_index: finalGate.totalRounds,
    derived_rounds: parseRoundSections(visibleOutput).length,
    reported_total_rounds: finalGate.totalRounds,
    gate_profile_id: state.gate_profile_id,
    closure_level: state.closure_level || 'high_confidence',
    target_rounds_total: state.target_rounds_total,
    generated_at: now,
  };
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshotPayload, null, 2)}\n`, 'utf8');
}

function parseAgentManifest(projectDir) {
  const manifestPath = path.join(projectDir, '_bmad', '_config', 'agent-manifest.csv');
  if (!fs.existsSync(manifestPath)) return [];
  return fs
    .readFileSync(manifestPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^"([^"]*)","([^"]*)"/u);
      return match ? { id: match[1], displayName: match[2] } : null;
    })
    .filter(Boolean);
}

function deriveChallengerDisplayNames(projectDir, designatedChallengerId) {
  const labels = new Set();
  const manifest = parseAgentManifest(projectDir);
  const matched = manifest.find((entry) => entry.id === designatedChallengerId);
  if (matched?.displayName) labels.add(matched.displayName);
  if (designatedChallengerId === 'adversarial-reviewer') {
    labels.add('批判性审计员');
    labels.add('Critical Auditor');
    labels.add('Adversarial Reviewer');
  }
  return [...labels];
}

function resolveSpeakerId(projectDir, displayName, designatedChallengerId, challengerLabels) {
  if (challengerLabels.includes(displayName)) {
    return designatedChallengerId;
  }
  const manifest = parseAgentManifest(projectDir);
  const matched = manifest.find((entry) => entry.displayName === displayName);
  return matched?.id || displayName;
}

function inferHasNewGap(round, totalRounds, sectionText, tailWindowNoNewGap) {
  if (tailWindowNoNewGap === 'PASS' && round > Math.max(totalRounds - 3, 0)) {
    return false;
  }
  return /反对|遗漏|风险|gap|risk|edge case|invalid|challenge|counter/u.test(sectionText);
}

function resolvePartyModeBatchBounds(state) {
  const batchStartRound =
    Number.isInteger(state?.current_batch_start_round) && state.current_batch_start_round > 0
      ? state.current_batch_start_round
      : 1;
  const batchTargetRound =
    Number.isInteger(state?.current_batch_target_round) && state.current_batch_target_round > 0
      ? state.current_batch_target_round
      : Number(state?.target_rounds_total);
  const targetRoundsTotal = Number(state?.target_rounds_total);
  return {
    batchStartRound,
    batchTargetRound,
    targetRoundsTotal,
    isFinalBatch: batchTargetRound >= targetRoundsTotal,
  };
}

function reconstructCurrentPartyModeSessionFromVisibleOutput(projectRoot, state, visibleOutput) {
  if (!state || !state.session_key) {
    return { reconstructed: false, reason: 'missing_current_party_mode_state' };
  }

  const capturePath =
    state.visible_output_capture_path ||
    derivePartyModeVisibleOutputCapturePath(projectRoot, state.session_key);
  ensureParentDir(capturePath);
  fs.writeFileSync(capturePath, String(visibleOutput || ''), 'utf8');

  const batch = resolvePartyModeBatchBounds(state);
  const roundSections = parseRoundSections(visibleOutput);
  const finalGate = parseFinalGateEvidence(visibleOutput);
  const progressMarker = parseProgressMarker(visibleOutput);
  const visibleOutputSummary = buildVisibleOutputSummary(
    capturePath,
    visibleOutput,
    roundSections,
    finalGate
  );
  const authoritativeFinalGatePass =
    batch.isFinalBatch &&
    finalGate &&
    finalGate.gateProfile === state.gate_profile_id &&
    Number.isFinite(finalGate.totalRounds) &&
    finalGate.totalRounds === batch.targetRoundsTotal &&
    finalGate.finalResult === 'PASS';
  const designatedChallengerId = state.designated_challenger_id || 'adversarial-reviewer';
  const challengerLabels = deriveChallengerDisplayNames(projectRoot, designatedChallengerId);
  const errors = [];
  const warnings = [];
  const expectedDocumentPaths = Array.isArray(state.expected_document_paths)
    ? state.expected_document_paths.filter((entry) => typeof entry === 'string' && entry.trim())
    : [];
  const generatedDocumentPaths = Array.isArray(state.generated_document_paths)
    ? state.generated_document_paths.filter((entry) => typeof entry === 'string' && entry.trim())
    : [];

  const expectedRoundCount = batch.batchTargetRound - batch.batchStartRound + 1;
  if (roundSections.length !== expectedRoundCount) {
    (authoritativeFinalGatePass ? warnings : errors).push(
      `visible_round_count=${roundSections.length}; expected=${expectedRoundCount}`
    );
  } else {
    const missingRounds = [];
    for (let offset = 0; offset < expectedRoundCount; offset += 1) {
      const expectedRound = batch.batchStartRound + offset;
      if (roundSections[offset].round !== expectedRound) {
        missingRounds.push(expectedRound);
      }
    }
    if (missingRounds.length > 0) {
      (authoritativeFinalGatePass ? warnings : errors).push(
        `missing_or_out_of_order_round_headers=${missingRounds.join(',')}`
      );
    }
  }

  const roundsWithoutSpeaker = roundSections
    .filter((section) => section.speakerLines.length === 0)
    .map((section) => section.round);
  if (roundsWithoutSpeaker.length > 0) {
    (authoritativeFinalGatePass ? warnings : errors).push(
      `rounds_without_visible_speaker_lines=${roundsWithoutSpeaker.join(',')}`
    );
  }

  if (batch.isFinalBatch) {
    if (!finalGate) {
      errors.push('missing_final_gate_evidence_block');
    } else {
      if (finalGate.gateProfile && finalGate.gateProfile !== state.gate_profile_id) {
        errors.push(
          `final_gate_profile_mismatch=${finalGate.gateProfile}; expected=${state.gate_profile_id}`
        );
      }
      if (
        Number.isFinite(finalGate.totalRounds) &&
        finalGate.totalRounds !== batch.targetRoundsTotal
      ) {
        (authoritativeFinalGatePass ? warnings : errors).push(
          `final_gate_total_rounds_mismatch=${finalGate.totalRounds}; expected=${batch.targetRoundsTotal}`
        );
      }
    }
    if (expectedDocumentPaths.length > 0) {
      if (generatedDocumentPaths.length === 0) {
        errors.push('missing_expected_generated_document');
      } else {
        const hasExpectedDocument = expectedDocumentPaths.some((expectedPath) =>
          generatedDocumentPaths.includes(expectedPath)
        );
        if (!hasExpectedDocument) {
          errors.push('generated_document_mismatch_with_expected_paths');
        }
      }
    }
  }

  let refresh = null;
  let fragmentRecord = null;
  if (String(visibleOutput || '').trim()) {
    const sessionLogPath = path.resolve(projectRoot, normalizeRuntimePath(state.session_log_path || ''));
    ensureParentDir(sessionLogPath);
    const preservedEntries =
      fs.existsSync(sessionLogPath)
        ? fs
            .readFileSync(sessionLogPath, 'utf8')
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              try {
                return JSON.parse(line);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
            .filter((entry) => {
              if (entry.session_key !== state.session_key) {
                return true;
              }
              return !['agent_turn', 'visible_output_fragment'].includes(
                entry.record_type || 'agent_turn'
              );
            })
        : [];

    const sessionEntries = roundSections.map((round) => {
      const selectedSpeaker =
        round.speakerLines.find((line) => challengerLabels.includes(line.displayName)) ||
        round.speakerLines[0];
      return {
        record_type: 'agent_turn',
        session_key: state.session_key,
        round_index: round.round,
        speaker_id: selectedSpeaker
          ? resolveSpeakerId(
              projectRoot,
              selectedSpeaker.displayName,
              designatedChallengerId,
              challengerLabels
            )
          : designatedChallengerId,
        designated_challenger_id: designatedChallengerId,
        counts_toward_ratio: true,
        has_new_gap: inferHasNewGap(
          round.round,
          batch.targetRoundsTotal,
          round.section,
          finalGate?.tailWindowNoNewGap
        ),
        timestamp: new Date().toISOString(),
      };
    });

    fragmentRecord =
      authoritativeFinalGatePass || (roundSections.length > 0 && errors.length === 0)
        ? null
        : buildVisibleOutputFragmentRecord(
            state,
            capturePath,
            visibleOutput,
            roundSections,
            finalGate
          );

    const mergedEntries = [
      ...preservedEntries,
      ...sessionEntries,
      ...(fragmentRecord ? [fragmentRecord] : []),
    ].sort((left, right) => {
      const leftRound = Number.isFinite(Number(left.round_index))
        ? Number(left.round_index)
        : Number.MAX_SAFE_INTEGER;
      const rightRound = Number.isFinite(Number(right.round_index))
        ? Number(right.round_index)
        : Number.MAX_SAFE_INTEGER;
      return leftRound - rightRound;
    });
    fs.writeFileSync(
      sessionLogPath,
      mergedEntries.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
      'utf8'
    );
    if (authoritativeFinalGatePass) {
      writeVisibleFinalGateFallbackArtifacts(projectRoot, state, finalGate, visibleOutput);
      refresh = {
        refreshed: true,
        result: {
          gate_pass: true,
          rounds: finalGate.totalRounds,
          failed_checks: [],
        },
      };
    } else if (roundSections.length > 0) {
      refresh = refreshSessionArtifacts(projectRoot, state.session_key);
      if (refresh?.result?.gate_pass === false) {
        errors.push(`gate_failed=${(refresh.result.failed_checks || []).join(',')}`);
      }
    }
  }

  return {
    reconstructed: roundSections.length > 0,
    sessionKey: state.session_key,
    observedRoundCount: roundSections.length,
    progressMarker,
    visibleOutputSummary,
    fragmentRecordPresent: Boolean(fragmentRecord),
    finalGate,
    errors,
    warnings,
    authoritativeFinalGatePass,
    refresh,
    visibleOutputCapturePath: capturePath,
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
  const currentState = readPartyModeCurrentSessionState(root);
  const generatedDocument = recordGeneratedPartyModeDocument(root, currentState, input);
  let rawOutput = extractRawToolOutput(input);
  const toolName = typeof input?.tool_name === 'string' ? input.tool_name.trim().toLowerCase() : '';
  const executor = extractToolExecutor(input).toLowerCase();
  const partyModeIntent = looksLikePartyModeIntent(input, currentState, rawOutput);
  const transcriptPath = extractTranscriptPath(input);

  if (
    currentState &&
    currentState.execution_mode === 'cursor_generalPurpose_compat' &&
    isPartyModeCarrierTool(toolName) &&
    (!rawOutput || !(/## Final Gate Evidence/iu.test(rawOutput) || /^### Round \d+\s*$/mu.test(rawOutput))) &&
    transcriptPath
  ) {
    const transcriptOutput = extractPartyModeVisibleOutputFromTranscript(transcriptPath);
    if (transcriptOutput) {
      rawOutput = transcriptOutput;
    }
  }

  if (partyModeIntent && currentState && currentState.session_key) {
    const rawCapturePath = derivePartyModeRawCapturePath(root, currentState.session_key);
    ensureParentDir(rawCapturePath);
    fs.writeFileSync(rawCapturePath, `${JSON.stringify(input ?? {}, null, 2)}\n`, 'utf8');
  }

  const looksLikePartyModeResult =
    currentState &&
    rawOutput &&
    partyModeIntent &&
    isPartyModeCarrierTool(toolName) &&
    (
      currentState.agent_type === 'party-mode-facilitator' ||
      currentState.execution_mode === 'cursor_generalPurpose_compat' ||
      executor === 'generalpurpose' ||
      executor === 'general-purpose' ||
      executor === 'party-mode-facilitator'
    );

  if (looksLikePartyModeResult) {
    const reconstruction = reconstructCurrentPartyModeSessionFromVisibleOutput(
      root,
      currentState,
      rawOutput
    );
    const mergedState = writePartyModeCurrentSessionState(root, {
      ...currentState,
      status: reconstruction.errors.length === 0 ? 'completed' : 'needs_retry',
      observed_visible_round_count: reconstruction.observedRoundCount,
      visible_progress_current_round: reconstruction.progressMarker?.currentRound ?? null,
      visible_progress_target_round: reconstruction.progressMarker?.targetRoundsTotal ?? null,
      visible_output_summary: reconstruction.visibleOutputSummary,
      visible_fragment_record_present: reconstruction.fragmentRecordPresent,
      final_gate_profile: reconstruction.finalGate?.gateProfile || '',
      final_gate_total_rounds: Number.isFinite(reconstruction.finalGate?.totalRounds)
        ? reconstruction.finalGate.totalRounds
        : null,
      final_gate_result: reconstruction.finalGate?.finalResult || '',
      validation_errors: reconstruction.errors,
      validation_warnings: reconstruction.warnings,
      validation_status: reconstruction.errors.length === 0 ? 'PASS' : 'FAIL',
      visible_output_capture_path: reconstruction.visibleOutputCapturePath,
      reconstructed_at: new Date().toISOString(),
    });
    const generatedDocumentPaths = Array.isArray(mergedState.generated_document_paths)
      ? mergedState.generated_document_paths.filter((entry) => typeof entry === 'string' && entry.trim())
      : [];
    const sidecarPayload = {
      generated_document_count: generatedDocumentPaths.length,
      generated_document_paths: generatedDocumentPaths,
      latest_generated_document_path: mergedState.latest_generated_document_path || '',
      latest_generated_document_kind: mergedState.latest_generated_document_kind || '',
      document_generation_observed_at: mergedState.document_generation_observed_at || '',
      observed_visible_round_count: reconstruction.observedRoundCount,
      visible_fragment_record_present: reconstruction.fragmentRecordPresent,
      visible_output_summary: reconstruction.visibleOutputSummary,
      validation_status: reconstruction.errors.length === 0 ? 'PASS' : 'FAIL',
      final_result: reconstruction.finalGate?.finalResult || '',
      status: reconstruction.finalGate ? 'completed' : 'in_progress',
      validation_errors: reconstruction.errors,
      validation_warnings: reconstruction.warnings,
      progress_current_round: reconstruction.progressMarker?.currentRound ?? null,
      progress_target_round: reconstruction.progressMarker?.targetRoundsTotal ?? null,
      written_by: 'post_tool_use_visible_output_reconstruction',
    };
    if (reconstruction.finalGate) {
      writePartyModeFinalSidecar(root, mergedState, sidecarPayload);
    } else {
      writePartyModeProgressSidecar(root, mergedState, sidecarPayload);
    }
    return {
      refreshed: Boolean(reconstruction.refresh?.refreshed),
      reason:
        reconstruction.errors.length === 0
          ? 'party_mode_visible_output_reconstructed'
          : 'party_mode_visible_output_incomplete',
      reconstruction,
    };
  }

  const looksLikeCursorPartyModeCarrierReturnWithoutVisibleOutput =
    currentState &&
    currentState.execution_mode === 'cursor_generalPurpose_compat' &&
    partyModeIntent &&
    isPartyModeCarrierTool(toolName) &&
    !String(rawOutput || '').trim();

  if (looksLikeCursorPartyModeCarrierReturnWithoutVisibleOutput) {
    const fallbackSummary = buildCarrierReturnWithoutVisibleOutputSummary(
      currentState,
      transcriptPath
    );
    const validationWarnings = transcriptPath
      ? ['transcript_path_present_but_no_extractable_visible_output']
      : [];
    const validationErrors = ['missing_visible_output_after_carrier_return'];
    const mergedState = writePartyModeCurrentSessionState(root, {
      ...currentState,
      status: 'needs_retry',
      visible_output_summary: fallbackSummary,
      visible_fragment_record_present: false,
      validation_errors: validationErrors,
      validation_warnings: validationWarnings,
      validation_status: 'FAIL',
      final_gate_profile: '',
      final_gate_total_rounds: null,
      final_gate_result: 'FAIL',
      reconstructed_at: new Date().toISOString(),
    });
    const generatedDocumentPaths = Array.isArray(mergedState.generated_document_paths)
      ? mergedState.generated_document_paths.filter((entry) => typeof entry === 'string' && entry.trim())
      : [];
    writePartyModeFinalSidecar(root, mergedState, {
      generated_document_count: generatedDocumentPaths.length,
      generated_document_paths: generatedDocumentPaths,
      latest_generated_document_path: mergedState.latest_generated_document_path || '',
      latest_generated_document_kind: mergedState.latest_generated_document_kind || '',
      document_generation_observed_at: mergedState.document_generation_observed_at || '',
      observed_visible_round_count: 0,
      visible_fragment_record_present: false,
      visible_output_summary: fallbackSummary,
      validation_status: 'FAIL',
      final_result: 'FAIL',
      status: 'needs_retry',
      validation_errors: validationErrors,
      validation_warnings: validationWarnings,
      agent_turn_event_source_mode: mergedState.agent_turn_event_source_mode || '',
      host_native_agent_turn_supported:
        typeof mergedState.host_native_agent_turn_supported === 'boolean'
          ? mergedState.host_native_agent_turn_supported
          : null,
      host_native_agent_turn_reason: mergedState.host_native_agent_turn_reason || '',
      written_by: 'post_tool_use_missing_visible_output_fallback',
    });
    return {
      refreshed: false,
      reason: 'party_mode_carrier_return_without_visible_output',
      fallback: {
        validation_errors: validationErrors,
        validation_warnings: validationWarnings,
        diagnostic_classification: 'carrier_return_without_visible_output',
      },
    };
  }

  const explicitSessionKey = extractPartyModeSessionKey(input);
  if (!explicitSessionKey) {
    if (generatedDocument.recorded) {
      return {
        refreshed: false,
        reason: 'party_mode_generated_document_recorded',
        generatedDocument,
      };
    }
    return { refreshed: false, reason: partyModeIntent ? 'party_mode_intent_without_refreshable_artifact' : 'unrelated_tool_use' };
  }
  const refreshed = refreshSessionArtifacts(root, explicitSessionKey);
  if (currentState && currentState.session_key === explicitSessionKey && refreshed?.result) {
    const mergedState = writePartyModeCurrentSessionState(root, {
      ...currentState,
      status: refreshed.result.gate_pass ? 'completed' : currentState.status || 'launched',
      validation_status: refreshed.result.gate_pass ? 'PASS' : currentState.validation_status || '',
      observed_visible_round_count: refreshed.result.rounds,
      reconstructed_at: new Date().toISOString(),
    });
    const generatedDocumentPaths = Array.isArray(mergedState.generated_document_paths)
      ? mergedState.generated_document_paths.filter((entry) => typeof entry === 'string' && entry.trim())
      : [];
    if (refreshed.result.gate_pass) {
      writePartyModeFinalSidecar(root, mergedState, {
        generated_document_count: generatedDocumentPaths.length,
        generated_document_paths: generatedDocumentPaths,
        latest_generated_document_path: mergedState.latest_generated_document_path || '',
        latest_generated_document_kind: mergedState.latest_generated_document_kind || '',
        document_generation_observed_at: mergedState.document_generation_observed_at || '',
        observed_visible_round_count: refreshed.result.rounds,
        visible_fragment_record_present: Boolean(mergedState.visible_fragment_record_present),
        visible_output_summary:
          mergedState.visible_output_summary && typeof mergedState.visible_output_summary === 'object'
            ? mergedState.visible_output_summary
            : null,
        validation_status: 'PASS',
        final_result: 'PASS',
        status: 'completed',
        validation_errors: [],
        validation_warnings: [],
        written_by: 'post_tool_use_refresh_session_artifacts',
      });
    }
  }
  return refreshed;
}

async function postToolUseCore(options = {}) {
  const host = options.host === 'cursor' ? 'cursor' : 'claude';

  try {
    const input = options.input !== undefined ? options.input : await readStdin();
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
  buildVisibleOutputSummary,
  parseFinalGateEvidence,
  parseRoundSections,
  postToolUseCore,
  reconstructCurrentPartyModeSessionFromVisibleOutput,
  refreshPartyModeSessionFromToolUse,
};
