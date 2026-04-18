#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { shouldSkipRuntimePolicy } = require('./should-skip-runtime-policy.cjs');
const { buildRuntimeErrorMessage } = require('./build-runtime-error-message.cjs');
const { runEmitRuntimePolicy } = require('./run-emit-runtime-policy.cjs');
const { loadHookMessages } = require('./hook-load-messages.cjs');
const {
  resolveRuntimeStepState,
  persistRuntimeStepState,
} = require('./runtime-step-state.cjs');
const {
  bootstrapSession,
  buildPartyModeContractViolationMessage,
  buildIntensitySelectionAskTemplate,
  extractEmbeddedBootstrapJson,
  extractSubagentText,
  isPartyModeFacilitatorIntent,
  isPartyModeFacilitatorStart,
  resolveStructuredGateProfileSelection,
} = require('./party-mode-session-runtime.cjs');
const {
  derivePartyModeFinalSidecarPath,
  derivePartyModeLaunchCapturePath,
  derivePartyModeProgressSidecarPath,
  derivePartyModeStartedSidecarPath,
  derivePartyModeVisibleOutputCapturePath,
  writePartyModeSidecar,
  writePartyModeCurrentSessionState,
} = require('./party-mode-current-session.cjs');
const { writePartyModeTurnLock } = require('./party-mode-turn-lock.cjs');

const PARTY_MODE_PENDING_LAUNCH_CONTRACT_TTL_MS = 5 * 60 * 1000;
const CURSOR_PARTY_MODE_AGENT_TURN_EVENT_SOURCE_MODE =
  'cursor_visible_output_reconstruction';
const CURSOR_PARTY_MODE_AGENT_TURN_REASON =
  'Cursor generalPurpose compatibility path has no native per-turn agent-turn surface; party-mode turns are reconstructed from visible subagent output after return.';

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    process.stdin.on('error', reject);
  });
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function readInputPath(input, candidates) {
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

function parseOptionalPositiveInt(value, field) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
  return parsed;
}

function normalizePartyModeRouteToken(value) {
  const token = String(value || '').trim();
  if (!token) return '';
  const lower = token.toLowerCase();
  if (lower === 'generalpurpose' || lower === 'general-purpose') {
    return 'general-purpose';
  }
  if (lower.includes('party-mode-facilitator')) {
    return 'party-mode-facilitator';
  }
  return token;
}

function isCursorTaskLikeTool(input) {
  const toolName = typeof input?.tool_name === 'string' ? input.tool_name.trim().toLowerCase() : '';
  return toolName === 'task' || toolName === 'mcp_task';
}

function hasCursorFacilitatorRuntimeTarget(projectRoot) {
  return fs.existsSync(path.join(projectRoot, '.cursor', 'agents', 'party-mode-facilitator.md'));
}

function hasCursorPartyModeSelfCheck(inputText) {
  const text = String(inputText || '');
  return (
    text.includes('【自检完成】') ||
    text.includes('自检完成，所有检查项已通过') ||
    /self-check\s+completed/iu.test(text)
  );
}

function isCursorPartyModeGeneralPurposeExecution(input, cursorHost) {
  return (
    cursorHost &&
    getObservedPartyModeRoute(input) === 'general-purpose' &&
    (
      isPartyModeFacilitatorPreflightRequest(input) ||
      isPartyModeFacilitatorIntent(
        extractUserMessage(input, 'subagent') || extractUserMessage(input, 'pretooluse')
      )
    )
  );
}

function resolveGateProfileMinRounds(gateProfileId) {
  switch (gateProfileId) {
    case 'quick_probe_20':
      return 20;
    case 'final_solution_task_list_100':
      return 100;
    default:
      return 50;
  }
}

function partyModePendingLaunchContractPath(projectRoot) {
  return path.join(
    projectRoot,
    '_bmad-output',
    'party-mode',
    'runtime',
    'pending-launch-contract.json'
  );
}

function clearPendingPartyModeLaunchContract(projectRoot) {
  try {
    fs.unlinkSync(partyModePendingLaunchContractPath(projectRoot));
  } catch {
    // ignore
  }
}

function readActivePendingPartyModeLaunchContract(projectRoot, now = Date.now()) {
  const filePath = partyModePendingLaunchContractPath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const expiresAtMs = Date.parse(parsed?.expires_at || '');
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
      clearPendingPartyModeLaunchContract(projectRoot);
      return null;
    }
    return parsed;
  } catch {
    clearPendingPartyModeLaunchContract(projectRoot);
    return null;
  }
}

function writePendingPartyModeLaunchContract(projectRoot, payload) {
  const ttlMs =
    Number.isInteger(payload?.ttl_ms) && payload.ttl_ms > 0
      ? payload.ttl_ms
      : PARTY_MODE_PENDING_LAUNCH_CONTRACT_TTL_MS;
  const now = new Date();
  const filePath = partyModePendingLaunchContractPath(projectRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const record = {
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    gate_profile_id: typeof payload?.gate_profile_id === 'string' ? payload.gate_profile_id : '',
    source_tool: typeof payload?.source_tool === 'string' ? payload.source_tool : '',
    source_route: typeof payload?.source_route === 'string' ? payload.source_route : '',
    source_prompt_sha256: typeof payload?.source_prompt_sha256 === 'string' ? payload.source_prompt_sha256 : '',
    source_excerpt: typeof payload?.source_excerpt === 'string' ? payload.source_excerpt : '',
  };
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  return record;
}

function buildPendingLaunchContractMismatchMessage(expectedGateProfileId, actualGateProfileId) {
  return [
    'Party-Mode subagentStart blocked: the launch payload gate profile does not match the last confirmed preToolUse selection.',
    `Confirmed preToolUse gate profile: \`${expectedGateProfileId}\``,
    `SubagentStart gate profile: \`${actualGateProfileId}\``,
    '这通常表示主 Agent 在展示 / 确认了一个档位后，真正发起子代理时又回退到了旧的推荐档位或旧模板。',
    '不要继续使用这个错误 payload。',
    '请沿用用户刚确认的档位，重新生成一致的自检块与 subagentStart payload 后再重试。',
  ].join('\n');
}

function partyModeAgentRunStatePath(projectRoot, agentId) {
  return path.join(projectRoot, '.claude', 'state', 'milestones', `${agentId}.party-mode.json`);
}

function deriveExpectedCheckpointRounds(targetRoundsTotal, batchSize) {
  const rounds = [];
  const safeBatchSize = Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 20;
  for (let round = safeBatchSize; round < targetRoundsTotal; round += safeBatchSize) {
    rounds.push(round);
  }
  rounds.push(targetRoundsTotal);
  return rounds;
}

function persistPartyModeAgentRunState(projectRoot, input, bootstrap) {
  const agentId = typeof input?.agent_id === 'string' && input.agent_id.trim() ? input.agent_id.trim() : '';
  if (!agentId) {
    return;
  }
  const filePath = partyModeAgentRunStatePath(projectRoot, agentId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        agent_id: agentId,
        agent_type:
          typeof input?.agent_type === 'string' && input.agent_type.trim()
            ? input.agent_type.trim()
            : 'party-mode-facilitator',
        session_key: bootstrap.sessionKey,
        gate_profile_id: bootstrap.meta.gate_profile_id,
        closure_level: bootstrap.meta.closure_level,
        designated_challenger_id: bootstrap.meta.designated_challenger_id,
        current_batch_index: bootstrap.meta.current_batch_index,
        current_batch_start_round: bootstrap.meta.current_batch_start_round,
        current_batch_target_round: bootstrap.meta.current_batch_target_round,
        current_batch_status: bootstrap.meta.current_batch_status,
        target_rounds_total: bootstrap.meta.target_rounds_total,
        batch_size: bootstrap.meta.batch_size,
        checkpoint_window_ms: bootstrap.meta.checkpoint_window_ms,
        checkpoint_rounds: deriveExpectedCheckpointRounds(
          bootstrap.meta.target_rounds_total,
          bootstrap.meta.batch_size
        ),
        audit_verdict_path: bootstrap.meta.audit_verdict_path,
        convergence_record_path: bootstrap.meta.convergence_record_path,
        snapshot_path: bootstrap.meta.snapshot_path,
        session_log_path: bootstrap.meta.session_log_path,
        recorded_at: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function persistPartyModeCurrentSessionState(projectRoot, input, bootstrap, extras = {}) {
  const sidecarStartedPath = derivePartyModeStartedSidecarPath(projectRoot, bootstrap.sessionKey);
  const sidecarProgressPath = derivePartyModeProgressSidecarPath(projectRoot, bootstrap.sessionKey);
  const sidecarFinalPath = derivePartyModeFinalSidecarPath(projectRoot, bootstrap.sessionKey);
  return writePartyModeCurrentSessionState(projectRoot, {
    source: extras.source || 'subagent_start',
    host_kind: extras.hostKind || 'unknown',
    execution_mode: extras.executionMode || 'default',
    status: extras.status || 'launched',
    agent_id:
      typeof input?.agent_id === 'string' && input.agent_id.trim() ? input.agent_id.trim() : '',
    agent_type:
      typeof input?.agent_type === 'string' && input.agent_type.trim()
        ? input.agent_type.trim()
        : 'party-mode-facilitator',
    session_key: bootstrap.sessionKey,
    gate_profile_id: bootstrap.meta.gate_profile_id,
    closure_level: bootstrap.meta.closure_level,
    designated_challenger_id: bootstrap.meta.designated_challenger_id,
    current_batch_index: bootstrap.meta.current_batch_index,
    current_batch_start_round: bootstrap.meta.current_batch_start_round,
    current_batch_target_round: bootstrap.meta.current_batch_target_round,
    current_batch_status: bootstrap.meta.current_batch_status,
    target_rounds_total: bootstrap.meta.target_rounds_total,
    batch_size: bootstrap.meta.batch_size,
    checkpoint_window_ms: bootstrap.meta.checkpoint_window_ms,
    expected_document_paths: Array.isArray(extras.expected_document_paths)
      ? extras.expected_document_paths
      : [],
    expected_document_count: Number.isFinite(Number(extras.expected_document_count))
      ? Number(extras.expected_document_count)
      : 0,
    document_generation_required: Boolean(extras.document_generation_required),
    session_log_path: bootstrap.meta.session_log_path,
    snapshot_path: bootstrap.meta.snapshot_path,
    convergence_record_path: bootstrap.meta.convergence_record_path,
    audit_verdict_path: bootstrap.meta.audit_verdict_path,
    agent_turn_event_source_mode: bootstrap.meta.agent_turn_event_source_mode,
    host_native_agent_turn_supported: bootstrap.meta.host_native_agent_turn_supported,
    host_native_agent_turn_reason: bootstrap.meta.host_native_agent_turn_reason,
    visible_output_capture_path: derivePartyModeVisibleOutputCapturePath(
      projectRoot,
      bootstrap.sessionKey
    ),
    launch_payload_capture_path: derivePartyModeLaunchCapturePath(projectRoot, bootstrap.sessionKey),
    sidecar_started_path: sidecarStartedPath,
    sidecar_progress_path: sidecarProgressPath,
    sidecar_final_path: sidecarFinalPath,
  });
}

function writePartyModeStartedSidecar(projectRoot, bootstrap, extras = {}) {
  const startedPath = derivePartyModeStartedSidecarPath(projectRoot, bootstrap.sessionKey);
  return writePartyModeSidecar(startedPath, {
    schema_version: 'party_mode_sidecar_v1',
    sidecar_kind: 'started',
    session_key: bootstrap.sessionKey,
    gate_profile_id: bootstrap.meta.gate_profile_id,
    closure_level: bootstrap.meta.closure_level,
    designated_challenger_id: bootstrap.meta.designated_challenger_id,
    status: extras.status || 'launched',
    execution_mode: extras.executionMode || 'default',
    host_kind: extras.hostKind || 'unknown',
    current_batch_index: bootstrap.meta.current_batch_index,
    current_batch_start_round: bootstrap.meta.current_batch_start_round,
    current_batch_target_round: bootstrap.meta.current_batch_target_round,
    target_rounds_total: bootstrap.meta.target_rounds_total,
    session_log_path: bootstrap.meta.session_log_path,
    snapshot_path: bootstrap.meta.snapshot_path,
    convergence_record_path: bootstrap.meta.convergence_record_path,
    audit_verdict_path: bootstrap.meta.audit_verdict_path,
    agent_turn_event_source_mode: bootstrap.meta.agent_turn_event_source_mode,
    host_native_agent_turn_supported: bootstrap.meta.host_native_agent_turn_supported,
    host_native_agent_turn_reason: bootstrap.meta.host_native_agent_turn_reason,
    sidecar_progress_path: derivePartyModeProgressSidecarPath(projectRoot, bootstrap.sessionKey),
    sidecar_final_path: derivePartyModeFinalSidecarPath(projectRoot, bootstrap.sessionKey),
    document_generation_required: Boolean(extras.document_generation_required),
    expected_document_count: Number.isFinite(Number(extras.expected_document_count))
      ? Number(extras.expected_document_count)
      : 0,
    expected_document_paths: Array.isArray(extras.expected_document_paths)
      ? extras.expected_document_paths
      : [],
    created_at: new Date().toISOString(),
    written_by: 'runtime_policy_inject_subagent_start',
  });
}

function capturePartyModeLaunchPayload(projectRoot, sessionKey, input) {
  const capturePath = derivePartyModeLaunchCapturePath(projectRoot, sessionKey);
  fs.mkdirSync(path.dirname(capturePath), { recursive: true });
  fs.writeFileSync(capturePath, `${JSON.stringify(input ?? {}, null, 2)}\n`, 'utf8');
  return capturePath;
}

function computePartyModePromptHash(inputText) {
  return createHash('sha256').update(String(inputText || ''), 'utf8').digest('hex');
}

function buildPartyModePromptExcerpt(inputText) {
  return String(inputText || '').trim().slice(0, 240);
}

function applyCursorPartyModeAgentTurnCapabilityOverride(bootstrap, cursorGeneralPurposeMode) {
  if (!cursorGeneralPurposeMode) {
    return bootstrap;
  }
  bootstrap.meta.agent_turn_event_source_mode = CURSOR_PARTY_MODE_AGENT_TURN_EVENT_SOURCE_MODE;
  bootstrap.meta.host_native_agent_turn_supported = false;
  bootstrap.meta.host_native_agent_turn_reason = CURSOR_PARTY_MODE_AGENT_TURN_REASON;
  if (bootstrap.paths && bootstrap.paths.metaPath) {
    fs.writeFileSync(
      bootstrap.paths.metaPath,
      `${JSON.stringify(bootstrap.meta, null, 2)}\n`,
      'utf8'
    );
  }
  return bootstrap;
}

function extractExpectedPartyModeDocumentPaths(projectRoot, inputText) {
  const text = String(inputText || '');
  const matches = [];
  const pattern = /(?:^|[\s`"'(])([^\s`"'()]+?\.md)\b/giu;
  for (const match of text.matchAll(pattern)) {
    const candidate = String(match[1] || '').trim();
    if (!candidate) {
      continue;
    }
    const normalizedCandidate = candidate.replace(/\\/g, '/');
    const resolved = path.isAbsolute(normalizedCandidate)
      ? path.resolve(normalizedCandidate)
      : path.resolve(projectRoot, normalizedCandidate);
    const normalizedResolved = String(resolved).replace(/\\/g, '/');
    if (
      normalizedResolved.includes('/_bmad-output/implementation-artifacts/') ||
      normalizedResolved.includes('/specs/') ||
      normalizedResolved.includes('/docs/requirements/') ||
      normalizedResolved.includes('/docs/plans/')
    ) {
      matches.push(normalizedResolved);
    }
  }
  return [...new Set(matches)];
}

/**
 * Prefer package resolution from project root, then init-deployed copies next to hooks.
 * @param {string} projectRoot
 * @returns {string | null}
 */
function resolveResolveSessionCjs(projectRoot) {
  try {
    const resolved = require.resolve('@bmad-speckit/runtime-emit/dist/resolve-for-session.cjs', {
      paths: [projectRoot],
    });
    if (resolved && fs.existsSync(resolved)) return resolved;
  } catch {
    /* continue */
  }
  const direct = path.join(
    projectRoot,
    'node_modules',
    '@bmad-speckit',
    'runtime-emit',
    'dist',
    'resolve-for-session.cjs'
  );
  if (fs.existsSync(direct)) return direct;
  const nestedBundled = path.join(
    projectRoot,
    'node_modules',
    'bmad-speckit',
    'node_modules',
    '@bmad-speckit',
    'runtime-emit',
    'dist',
    'resolve-for-session.cjs'
  );
  if (fs.existsSync(nestedBundled)) return nestedBundled;
  for (const rel of ['.cursor/hooks', '.claude/hooks']) {
    const adj = path.join(projectRoot, rel, 'resolve-for-session.cjs');
    if (fs.existsSync(adj)) return adj;
  }
  return null;
}

/**
 * @param {'pretooluse' | 'subagent' | 'session'} hookMode
 */
function extractUserMessage(input, hookMode) {
  if (!input || typeof input !== 'object') return '';
  if (hookMode === 'subagent') {
    return String(input.task || input.prompt || input.user_message || '').trim();
  }
  if (hookMode === 'session') {
    return String(
      input.initial_user_message ||
        input.user_message ||
        input.message ||
        input.agent_message ||
        ''
    ).trim();
  }
  const ti = input.tool_input;
  if (ti && typeof ti === 'object') {
    const pr = ti.prompt;
    if (typeof pr === 'string' && pr.trim()) return pr.trim();
  }
  if (typeof input.agent_message === 'string' && input.agent_message.trim()) {
    return input.agent_message.trim();
  }
  return '';
}

function extractResolvedMode(langStdout) {
  try {
    const parsed = JSON.parse((langStdout || '').trim());
    const mode = parsed?.resolvedMode;
    if (mode === 'zh' || mode === 'en' || mode === 'bilingual') {
      return mode;
    }
  } catch {
    /* noop */
  }
  return undefined;
}

function extractPartyModeBootstrapOptions(input, inputText, resolvedMode) {
  const embeddedBootstrap = extractEmbeddedBootstrapJson(inputText);
  return {
    sessionKey: readInputPath(input, [
      ['sessionKey'],
      ['session_key'],
      ['tool_input', 'sessionKey'],
      ['tool_input', 'session_key'],
      ['partyModeBatch', 'sessionKey'],
      ['party_mode_batch', 'session_key'],
      ['partyModeSession', 'sessionKey'],
      ['party_mode_session', 'session_key'],
    ]) || (embeddedBootstrap && (embeddedBootstrap.session_key || embeddedBootstrap.sessionKey)),
    gateProfileId: readInputPath(input, [
      ['gateProfileId'],
      ['gate_profile_id'],
      ['tool_input', 'gateProfileId'],
      ['tool_input', 'gate_profile_id'],
      ['partyModeBatch', 'gateProfileId'],
      ['party_mode_batch', 'gate_profile_id'],
      ['partyModeSession', 'gateProfileId'],
      ['party_mode_session', 'gate_profile_id'],
    ]) || (embeddedBootstrap && (embeddedBootstrap.gate_profile_id || embeddedBootstrap.gateProfileId)),
    batchIndex: parseOptionalPositiveInt(
      readInputPath(input, [
        ['batchIndex'],
        ['batch_index'],
        ['partyModeBatch', 'batchIndex'],
        ['party_mode_batch', 'batch_index'],
      ]) || (embeddedBootstrap && (embeddedBootstrap.batch_index || embeddedBootstrap.batchIndex)),
      'batch_index'
    ),
    batchStartRound: parseOptionalPositiveInt(
      readInputPath(input, [
        ['batchStartRound'],
        ['batch_start_round'],
        ['partyModeBatch', 'batchStartRound'],
        ['party_mode_batch', 'batch_start_round'],
      ]) || (embeddedBootstrap && (embeddedBootstrap.batch_start_round || embeddedBootstrap.batchStartRound)),
      'batch_start_round'
    ),
    batchTargetRound: parseOptionalPositiveInt(
      readInputPath(input, [
        ['batchTargetRound'],
        ['batch_target_round'],
        ['partyModeBatch', 'batchTargetRound'],
        ['party_mode_batch', 'batch_target_round'],
      ]) || (embeddedBootstrap && (embeddedBootstrap.batch_target_round || embeddedBootstrap.batchTargetRound)),
      'batch_target_round'
    ),
    targetRoundsTotal: parseOptionalPositiveInt(
      readInputPath(input, [
        ['targetRoundsTotal'],
        ['target_rounds_total'],
        ['partyModeBatch', 'targetRoundsTotal'],
        ['party_mode_batch', 'target_rounds_total'],
      ]) ||
        (embeddedBootstrap &&
          (embeddedBootstrap.target_rounds_total ||
            embeddedBootstrap.targetRoundsTotal ||
            embeddedBootstrap.min_rounds)),
      'target_rounds_total'
    ),
    checkpointWindowMs: parseOptionalPositiveInt(
      readInputPath(input, [
        ['checkpointWindowMs'],
        ['checkpoint_window_ms'],
        ['partyModeBatch', 'checkpointWindowMs'],
        ['party_mode_batch', 'checkpoint_window_ms'],
      ]) ||
        (embeddedBootstrap &&
          (embeddedBootstrap.checkpoint_window_ms || embeddedBootstrap.checkpointWindowMs)),
      'checkpoint_window_ms'
    ),
    topic:
      readInputPath(input, [
        ['topic'],
        ['partyModeBatch', 'topic'],
        ['party_mode_batch', 'topic'],
      ]) || (embeddedBootstrap && embeddedBootstrap.topic) || inputText,
    resolvedMode:
      readInputPath(input, [
        ['resolvedMode'],
        ['resolved_mode'],
        ['partyModeBatch', 'resolvedMode'],
        ['party_mode_batch', 'resolved_mode'],
      ]) || (embeddedBootstrap && (embeddedBootstrap.resolved_mode || embeddedBootstrap.resolvedMode)) || resolvedMode,
  };
}

function isPartyModeFacilitatorPreflightRequest(input) {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const toolName = typeof input.tool_name === 'string' ? input.tool_name.trim() : '';
  if (toolName !== 'Agent' && !isCursorTaskLikeTool(input)) {
    return false;
  }
  const ti = input.tool_input;
  if (!ti || typeof ti !== 'object') {
    return false;
  }
  const joined = [
    ti.subagent_type,
    ti.subagentType,
    ti.subtypeOrExecutor,
    ti.executor,
    ti.executor_name,
    ti.agent_type,
    ti.agent_name,
    ti.description,
    ti.prompt,
    ti.task,
    input.task,
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .toLowerCase();
  return isPartyModeFacilitatorIntent(joined) || joined.includes('party-mode:');
}

function getObservedPartyModeRoute(input) {
  if (!input || typeof input !== 'object') {
    return 'unknown';
  }
  const direct = readInputPath(input, [
    ['tool_input', 'subagent_type'],
    ['tool_input', 'subagentType'],
    ['tool_input', 'subtypeOrExecutor'],
    ['tool_input', 'executor'],
    ['tool_input', 'executor_name'],
    ['tool_input', 'agent_type'],
    ['tool_input', 'agentType'],
    ['tool_input', 'agent_name'],
    ['tool_input', 'agentName'],
    ['subagent_type'],
    ['subagentType'],
    ['subtypeOrExecutor'],
    ['executor'],
    ['agent_type'],
    ['agent_name'],
  ]);
  const normalized = normalizePartyModeRouteToken(direct);
  if (normalized) {
    return normalized;
  }
  return 'unknown';
}

function hasAuthoritativePartyModeRoute(input) {
  return getObservedPartyModeRoute(input) === 'party-mode-facilitator';
}

function isGeneralPurposePartyModeWrapperAttempt(input) {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const subtype = getObservedPartyModeRoute(input);
  const ti = input.tool_input;
  const joined = [ti?.description, ti?.prompt, ti?.task, input.task]
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .toLowerCase();
  return subtype === 'general-purpose' && isPartyModeFacilitatorIntent(joined);
}

function buildPartyModeUnknownRouteMessage(input, cursorHost) {
  const observedRoute = getObservedPartyModeRoute(input);
  return [
    'Party-Mode facilitator launch failed closed because the Agent payload does not structurally identify the dedicated facilitator target.',
    `Observed route token: \`${observedRoute}\``,
    'Prompt-level text such as `@"party-mode-facilitator (agent)"` is not accepted as proof of correct dispatch once the Agent tool payload is already being emitted.',
    'Do not retry with different model parameters or prompt formatting.',
    'Main Agent must only continue when the host emits an authoritative facilitator route.',
    'Required route:',
    cursorHost
      ? '- Cursor Task executor: `party-mode-facilitator`'
      : '- dedicated facilitator target visible to hooks',
    cursorHost
      ? '- then pass the user-selected structured `gateProfileId` / `gate_profile_id` or dedicated confirmation block'
      : '- then pass the user-selected structured `gateProfileId` / `gate_profile_id`',
    'Note: the discussion topic may be Cursor custom subagents, but that does not change the required host-side facilitator route.',
  ].join('\n');
}

function buildCursorPartyModeFallbackForbiddenMessage(input) {
  const observedRoute = getObservedPartyModeRoute(input);
  return [
    'Party-Mode fail-closed: Cursor already has `.cursor/agents/party-mode-facilitator.md`, so routing this discussion through `mcp_task/generalPurpose` is forbidden.',
    `Observed route token: \`${observedRoute}\``,
    'Do not let the main Agent continue with a general-purpose fallback.',
    'Required recovery:',
    '- re-issue the call through Cursor Task with executor `party-mode-facilitator`',
    '- preserve the same user-selected gate profile / round-progress state',
    '- if the host cannot see the installed facilitator target, stop and tell the user to retry after re-syncing `.cursor/agents/party-mode-facilitator.md`',
    'Main Agent must not summarize, continue, or restart the discussion from round 1 after this failure.',
  ].join('\n');
}

function buildCursorGeneralPurposePartyModeMessage(gateProfileId, targetRoundsTotal) {
  const lines = [
    'Cursor Party-Mode execution mode: generalPurpose compatibility path.',
    'Current Cursor IDE sessions must stay inside one uninterrupted facilitator-compatible run.',
    'Run the full discussion inside the current subagent session until the final round target is reached.',
    `Gate profile: \`${gateProfileId}\``,
    `Target rounds total: ${targetRoundsTotal}`,
    'Cursor execution rules:',
    '- do not pause or hand control back to the main Agent before the final round target',
    '- do not restart discussion from round 1 after an intermediate progress summary',
    'Return control only after the final summary / final gate evidence has been produced.',
  ];
  if (targetRoundsTotal >= 50) {
    lines.push('Compact-mode requirements for this long run:');
    lines.push('- prefer one short substantive speaker line per round');
    lines.push('- the designated challenger may be the only speaker in a round');
    lines.push('- defer long recaps, tables, and summaries to the final section');
  }
  lines.push('Sidecar persistence contract for zero-host-evidence recovery:');
  lines.push('- the host has already written the `started` sidecar for this session');
  lines.push('- before normal return, write the `final` sidecar JSON to the exact path from the bootstrap payload');
  lines.push('- if you detect you are being forced to stop early, write the `progress` sidecar first, then exit');
  lines.push('- these hidden sidecars are not user-visible progress markers; do not stop the discussion to announce them');
  return lines.join('\n');
}

function buildCursorPartyModeSelfCheckTemplate(gateProfileId) {
  const profileLabel =
    gateProfileId === 'quick_probe_20'
      ? '20 (quick_probe_20)'
      : gateProfileId === 'final_solution_task_list_100'
        ? '100 (final_solution_task_list_100)'
        : '50 (decision_root_cause_50)';
  return [
    'Cursor party-mode preflight: main Agent must complete the pre-launch self-check before invoking the facilitator-compatible subagent.',
    '不要直接启动子代理；先严格完成以下流程：',
    '1. 展示 `20 / 50 / 100` 强度选项',
    '2. 等待用户明确回复档位',
    '3. 完成发起前自检清单',
    '4. 输出自检结果',
    '5. 由宿主在 `SubagentStart` 自动注入 `Party Mode Session Bootstrap (JSON)`',
    '',
    '自检结果最小模板：',
    '【自检完成】Cursor party-mode',
    '- 强度选项: 已展示',
    `- 用户选择: ${profileLabel}`,
    '- 执行方式: generalPurpose-compatible facilitator',
    '- Session Bootstrap: 由宿主在 SubagentStart 注入',
    '可以发起。',
    '',
    '完成以上自检后，再沿用同一档位立即重试当前 party-mode 发起。'
  ].join('\n');
}

function buildPreToolUseHardStop(errText, stopReason) {
  return {
    exitCode: 0,
    output: JSON.stringify({
      continue: false,
      stopReason,
      systemMessage: errText,
    }),
    stderr: '',
  };
}

function derivePartyModeIntensityStopReason(errText) {
  if (String(errText || '').includes('user-selected intensity was detected in free text')) {
    return 'Party-Mode 已检测到用户已选档位，但当前 payload 未结构化；请沿用同一档位立即重试一次。';
  }
  if (String(errText || '').includes('main Agent must complete the pre-launch self-check')) {
    return 'Cursor Party-Mode 发起前必须完成自检清单并输出自检结果。';
  }
  return 'Party-Mode 启动前必须先由主 Agent 询问用户选择 20/50/100 强度。';
}

function buildPartyModePreToolUseHardStop(root, input, errText, stopReason) {
  try {
    writePartyModeTurnLock(root, {
      reason: stopReason,
      system_message: errText,
      source_tool:
        typeof input?.tool_name === 'string' && input.tool_name.trim() ? input.tool_name.trim() : 'Agent',
      blocked_topic: extractUserMessage(input, 'pretooluse'),
    });
  } catch {
    // ignore lock write failures and still fail closed for the current tool call
  }
  return buildPreToolUseHardStop(errText, stopReason);
}

function runResolveLanguagePolicyCli(root, userMessage, writeContext) {
  const cjsPath = resolveResolveSessionCjs(root);
  if (!cjsPath) {
    return {
      status: 1,
      stdout: '',
      stderr:
        'runtime-policy-inject: resolve-for-session.cjs not found (node_modules/@bmad-speckit/runtime-emit/dist or .cursor/.claude hooks). Run: npm install, npm run build:runtime-emit (in BMAD monorepo), then npx bmad-speckit init to deploy hook bundles.',
    };
  }
  const payload = JSON.stringify({
    projectRoot: root,
    userMessage,
    recentMessages: [],
    writeContext: Boolean(writeContext),
  });
  return spawnSync(process.execPath, [cjsPath], {
    cwd: root,
    input: payload,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: root,
      CURSOR_PROJECT_ROOT: root,
    },
  });
}

function buildPartyModeBootstrapBlock(projectRoot, hookMode, input, resolvedMode, cursorHost) {
  if (hookMode !== 'subagent' || !isPartyModeFacilitatorStart(input)) {
    return '';
  }
  const inputText = extractSubagentText(input);
  const bootstrapOptions = extractPartyModeBootstrapOptions(input, inputText, resolvedMode);
  const gateProfileId = resolveStructuredGateProfileSelection(
    bootstrapOptions.gateProfileId,
    inputText,
    { requireConfirmedBlock: cursorHost === true }
  );
  const expectedDocumentPaths = extractExpectedPartyModeDocumentPaths(projectRoot, inputText);
  const pendingLaunchContract = readActivePendingPartyModeLaunchContract(projectRoot);
  if (
    pendingLaunchContract &&
    typeof pendingLaunchContract.gate_profile_id === 'string' &&
    pendingLaunchContract.gate_profile_id &&
    pendingLaunchContract.gate_profile_id !== gateProfileId
  ) {
    throw new Error(
      buildPendingLaunchContractMismatchMessage(
        pendingLaunchContract.gate_profile_id,
        gateProfileId
      )
    );
  }
  const cursorGeneralPurposeMode = isCursorPartyModeGeneralPurposeExecution(input, true);
  const normalizedTargetRoundsTotal =
    bootstrapOptions.targetRoundsTotal ?? resolveGateProfileMinRounds(gateProfileId);
  const finalBootstrapOptions = cursorGeneralPurposeMode
    ? {
        ...bootstrapOptions,
        targetRoundsTotal: normalizedTargetRoundsTotal,
        batchTargetRound: normalizedTargetRoundsTotal,
        batchIndex: 1,
        batchStartRound: 1,
      }
    : bootstrapOptions;
  const bootstrap = bootstrapSession(projectRoot, {
    inputText,
    ...finalBootstrapOptions,
    gateProfileId,
  });
  applyCursorPartyModeAgentTurnCapabilityOverride(bootstrap, cursorGeneralPurposeMode);
  const modeDirective = cursorGeneralPurposeMode
    ? `${buildCursorGeneralPurposePartyModeMessage(
        gateProfileId,
        bootstrap.meta.target_rounds_total
      )}\n`
    : '';
  persistPartyModeAgentRunState(projectRoot, input, bootstrap);
  persistPartyModeCurrentSessionState(projectRoot, input, bootstrap, {
    source: 'subagent_start',
    hostKind: cursorGeneralPurposeMode ? 'cursor' : 'claude',
    executionMode: cursorGeneralPurposeMode
      ? 'cursor_generalPurpose_compat'
      : 'facilitator_direct',
    status: 'launched',
    expected_document_paths: expectedDocumentPaths,
    expected_document_count: expectedDocumentPaths.length,
    document_generation_required: expectedDocumentPaths.length > 0,
  });
  writePartyModeStartedSidecar(projectRoot, bootstrap, {
    hostKind: cursorGeneralPurposeMode ? 'cursor' : 'claude',
    executionMode: cursorGeneralPurposeMode
      ? 'cursor_generalPurpose_compat'
      : 'facilitator_direct',
    status: 'launched',
    expected_document_paths: expectedDocumentPaths,
    expected_document_count: expectedDocumentPaths.length,
    document_generation_required: expectedDocumentPaths.length > 0,
  });
  capturePartyModeLaunchPayload(projectRoot, bootstrap.sessionKey, input);
  clearPendingPartyModeLaunchContract(projectRoot);
  const bootstrapPayload = cursorGeneralPurposeMode
    ? {
        session_key: bootstrap.sessionKey,
        gate_profile_id: bootstrap.meta.gate_profile_id,
        closure_level: bootstrap.meta.closure_level,
        target_rounds_total: bootstrap.meta.target_rounds_total,
        topic: bootstrap.meta.topic,
        resolved_mode: bootstrap.meta.resolved_mode,
        designated_challenger_id: bootstrap.meta.designated_challenger_id,
        agent_turn_event_source_mode: bootstrap.meta.agent_turn_event_source_mode,
        host_native_agent_turn_supported: bootstrap.meta.host_native_agent_turn_supported,
        host_native_agent_turn_reason: bootstrap.meta.host_native_agent_turn_reason,
        session_log_path: bootstrap.meta.session_log_path,
        snapshot_path: bootstrap.meta.snapshot_path,
        convergence_record_path: bootstrap.meta.convergence_record_path,
        audit_verdict_path: bootstrap.meta.audit_verdict_path,
        sidecar_started_path: derivePartyModeStartedSidecarPath(projectRoot, bootstrap.sessionKey),
        sidecar_progress_path: derivePartyModeProgressSidecarPath(projectRoot, bootstrap.sessionKey),
        sidecar_final_path: derivePartyModeFinalSidecarPath(projectRoot, bootstrap.sessionKey),
        event_writer_mode: 'host_reconstruction_from_visible_output',
      }
    : {
        session_key: bootstrap.sessionKey,
        gate_profile_id: bootstrap.meta.gate_profile_id,
        closure_level: bootstrap.meta.closure_level,
        batch_index: bootstrap.meta.current_batch_index,
        batch_start_round: bootstrap.meta.current_batch_start_round,
        batch_target_round: bootstrap.meta.current_batch_target_round,
        target_rounds_total: bootstrap.meta.target_rounds_total,
        checkpoint_window_ms: bootstrap.meta.checkpoint_window_ms,
        current_batch_status: bootstrap.meta.current_batch_status,
        topic: bootstrap.meta.topic,
        resolved_mode: bootstrap.meta.resolved_mode,
        designated_challenger_id: bootstrap.meta.designated_challenger_id,
        agent_turn_event_source_mode: bootstrap.meta.agent_turn_event_source_mode,
        host_native_agent_turn_supported: bootstrap.meta.host_native_agent_turn_supported,
        host_native_agent_turn_reason: bootstrap.meta.host_native_agent_turn_reason,
        session_log_path: bootstrap.meta.session_log_path,
        snapshot_path: bootstrap.meta.snapshot_path,
        convergence_record_path: bootstrap.meta.convergence_record_path,
        audit_verdict_path: bootstrap.meta.audit_verdict_path,
        sidecar_started_path: derivePartyModeStartedSidecarPath(projectRoot, bootstrap.sessionKey),
        sidecar_progress_path: derivePartyModeProgressSidecarPath(projectRoot, bootstrap.sessionKey),
        sidecar_final_path: derivePartyModeFinalSidecarPath(projectRoot, bootstrap.sessionKey),
        checkpoint_json_path: bootstrap.paths.currentBatchCheckpointJsonPath,
        checkpoint_markdown_path: bootstrap.paths.currentBatchCheckpointMarkdownPath,
        checkpoint_receipt_path: bootstrap.paths.currentBatchReceiptPath,
        event_writer_mode: 'host_reconstruction_from_visible_output',
      };
  return `${modeDirective}Party Mode Session Bootstrap (JSON):\n${JSON.stringify(
    bootstrapPayload,
    null,
    2
  )}\n`;
}

function mergeGovernanceWithLanguage(govJsonLine, langStdout) {
  let govObj;
  try {
    govObj = JSON.parse((govJsonLine || '').trim());
  } catch {
    return govJsonLine;
  }
  let langObj;
  try {
    langObj = JSON.parse((langStdout || '').trim());
  } catch {
    return JSON.stringify(govObj, null, 2);
  }
  if (!langObj || typeof langObj !== 'object') {
    return JSON.stringify(govObj, null, 2);
  }
  return JSON.stringify({ ...govObj, languagePolicy: langObj }, null, 2);
}

async function runtimePolicyInjectCore({ host }) {
  const sessionStart = process.argv.includes('--session-start');
  const hookMode = sessionStart
    ? 'session'
    : process.argv.includes('--subagent-start')
      ? 'subagent'
      : 'pretooluse';
  const mode = process.argv.includes('--subagent-start') ? 'subagent' : 'pretooluse';
  const cursorHost = process.argv.includes('--cursor-host') || host === 'cursor';

  const input = await readStdin();

  if (hookMode === 'pretooluse' && !cursorHost) {
    if (!input || input.tool_name !== 'Agent') {
      return { exitCode: 0, output: '', stderr: '' };
    }
  }

  const root = path.resolve(
    process.env.CLAUDE_PROJECT_DIR ||
      (input && input.cwd) ||
      process.env.CURSOR_PROJECT_ROOT ||
      process.cwd()
  );

  if (cursorHost && !fs.existsSync(path.join(root, '_bmad'))) {
    return { exitCode: 0, output: JSON.stringify({ systemMessage: '' }), stderr: '' };
  }

  if (hookMode === 'pretooluse' && isGeneralPurposePartyModeWrapperAttempt(input)) {
    if (cursorHost && hasCursorFacilitatorRuntimeTarget(root)) {
      // Cursor IDE currently executes party-mode reliably through generalPurpose-compatible routing.
      // Allow this path and rely on the subagentStart bootstrap override to keep the run inline/full-length.
    } else {
    const errText = buildPartyModeContractViolationMessage(extractUserMessage(input, hookMode));
    return buildPartyModePreToolUseHardStop(
      root,
      input,
      errText,
      'Party-Mode 必须使用正式 facilitator contract，当前 general-purpose 包装调用已被阻止。'
    );
    }
  }

  if (hookMode === 'pretooluse' && isPartyModeFacilitatorPreflightRequest(input)) {
    if (!hasAuthoritativePartyModeRoute(input) && !isCursorPartyModeGeneralPurposeExecution(input, cursorHost)) {
      const errText = buildPartyModeUnknownRouteMessage(input, cursorHost);
      return buildPartyModePreToolUseHardStop(
        root,
        input,
        errText,
        'Party-Mode 调用未提供宿主可证明的 facilitator route，当前调用已被阻止。'
      );
    }
  }

  if (hookMode === 'pretooluse' && isPartyModeFacilitatorPreflightRequest(input)) {
    const inputText = extractUserMessage(input, hookMode);
    const bootstrapOptions = extractPartyModeBootstrapOptions(input, inputText, undefined);
    try {
      const gateProfileId = resolveStructuredGateProfileSelection(
        bootstrapOptions.gateProfileId,
        inputText,
        { requireConfirmedBlock: cursorHost === true }
      );
      if (cursorHost && !hasCursorPartyModeSelfCheck(inputText)) {
        const errText = buildCursorPartyModeSelfCheckTemplate(gateProfileId);
        return buildPartyModePreToolUseHardStop(
          root,
          input,
          errText,
          derivePartyModeIntensityStopReason(errText)
        );
      }
      writePendingPartyModeLaunchContract(root, {
        gate_profile_id: gateProfileId,
        source_tool:
          typeof input?.tool_name === 'string' && input.tool_name.trim()
            ? input.tool_name.trim()
            : 'Agent',
        source_route: getObservedPartyModeRoute(input),
        source_prompt_sha256: computePartyModePromptHash(inputText),
        source_excerpt: buildPartyModePromptExcerpt(inputText),
      });
    } catch (error) {
      const errText = error && error.message ? error.message : buildIntensitySelectionAskTemplate(inputText);
      return buildPartyModePreToolUseHardStop(
        root,
        input,
        errText,
        derivePartyModeIntensityStopReason(errText)
      );
    }
  }

  let stateDiag = '';
  try {
    const resolvedState = resolveRuntimeStepState(root, {
      argv: process.argv.slice(0, 2),
      env: process.env,
      hookInput: input,
    });
    persistRuntimeStepState(root, resolvedState);
  } catch (error) {
    const hint = error && error.message ? error.message : String(error);
    if (hint && process.env.BMAD_HOOKS_QUIET !== '1') {
      stateDiag = `[runtime-policy-inject] runtime step state sync skipped: ${hint}\n`;
    }
  }

  const res = runEmitRuntimePolicy(root);
  if (res.status !== 0) {
    if (shouldSkipRuntimePolicy({ cursorHost, root, res })) {
      return { exitCode: 0, output: JSON.stringify({ systemMessage: '' }), stderr: '' };
    }

    const errText = buildRuntimeErrorMessage({ stderr: res.stderr, stdout: res.stdout });
    if (mode === 'subagent') {
      return {
        exitCode: 1,
        output: JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'SubagentStart',
            additionalContext: errText,
          },
        }),
        stderr: errText,
      };
    }
    return {
      exitCode: 1,
      output: JSON.stringify({ systemMessage: errText }),
      stderr: errText,
    };
  }

  const json = (res.stdout || '').trim();
  const userMsg = extractUserMessage(input, hookMode);
  const langRes = runResolveLanguagePolicyCli(root, userMsg, true);
  const resolvedMode = langRes.status === 0 ? extractResolvedMode(langRes.stdout) : undefined;
  let mergedJson = json;
  if (langRes.status === 0 && (langRes.stdout || '').trim()) {
    mergedJson = mergeGovernanceWithLanguage(json, langRes.stdout);
  }
  let langDiag = '';
  if (langRes.status !== 0) {
    const hint = (langRes.stderr || '').trim() || `resolve-for-session exit ${langRes.status}`;
    if (hint && process.env.BMAD_HOOKS_QUIET !== '1') {
      langDiag = `[runtime-policy-inject] languagePolicy merge skipped: ${hint}\n`;
    }
  }
  const stderr = `${stateDiag}${langDiag}`;

  const rg = loadHookMessages(__dirname).runtimeGovernance || {};
  const prefix = rg.jsonBlockPrefix || '本回合 Runtime Governance（JSON）：';
  let bootstrapBlock = '';
  try {
    bootstrapBlock = buildPartyModeBootstrapBlock(root, hookMode, input, resolvedMode, cursorHost);
  } catch (error) {
    const errText = error && error.message ? error.message : String(error);
    if (mode === 'subagent') {
      return {
        exitCode: 1,
        output: JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'SubagentStart',
            additionalContext: errText,
          },
        }),
        stderr: `${stderr}${errText}`,
      };
    }
    return {
      exitCode: 1,
      output: JSON.stringify({ systemMessage: errText }),
      stderr: `${stderr}${errText}`,
    };
  }
  const block = `${prefix}\n${mergedJson}\n${bootstrapBlock}`;
  if (mode === 'subagent') {
    return {
      exitCode: 0,
      output: JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: block },
      }),
      stderr,
    };
  }
  return { exitCode: 0, output: JSON.stringify({ systemMessage: block }), stderr };
}

module.exports = { runtimePolicyInjectCore };
