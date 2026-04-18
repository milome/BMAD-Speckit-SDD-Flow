#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const KNOWN_GATE_PROFILES = {
  quick_probe_20: {
    minRounds: 20,
    ratioThreshold: 0.6,
    tailWindow: 3,
    closureLevel: 'none',
  },
  final_solution_task_list_100: {
    minRounds: 100,
    ratioThreshold: 0.6,
    tailWindow: 3,
    closureLevel: 'high_confidence',
  },
  decision_root_cause_50: {
    minRounds: 50,
    ratioThreshold: 0.6,
    tailWindow: 3,
    closureLevel: 'standard',
  },
};

const DEFAULT_DESIGNATED_CHALLENGER_ID = 'adversarial-reviewer';
const AGENT_TURN_EVENT_SOURCE_MODE = 'explicit_event_writer_bridge';
const HOST_NATIVE_AGENT_TURN_SUPPORTED = false;
const HOST_NATIVE_AGENT_TURN_REASON =
  'Current host hook surfaces expose session/subagent/tool boundaries only; no native per-turn agent-turn event is available.';
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_CHECKPOINT_WINDOW_MS = 15_000;

const HIGH_CONFIDENCE_FINAL_OUTPUT_MARKERS = [
  '§7',
  'task list',
  '任务列表',
  '最终方案',
  'bugfix',
  'create story',
  'story 设计定稿',
  '设计定稿',
];

const QUICK_PROBE_MARKERS = [
  'quick_probe_20',
  'quick probe',
  'quick-probe',
  '快速分析',
  '快速探查',
  'probe only',
];

const PARTY_MODE_FACILITATOR_INTENT_MARKERS = [
  'party-mode-facilitator',
  'party-mode facilitator',
  'party mode facilitator',
  '@"party-mode-facilitator (agent)"',
  'party mode activated',
  'bmad-party-mode',
];

const EXPLICIT_SELECTION_PATTERNS = {
  quick_probe_20: [/\bquick_probe_20\b/iu, /\b20\s*rounds?\b/iu, /20\s*轮/iu],
  decision_root_cause_50: [/\bdecision_root_cause_50\b/iu, /\b50\s*rounds?\b/iu, /50\s*轮/iu],
  final_solution_task_list_100: [
    /\bfinal_solution_task_list_100\b/iu,
    /\b100\s*rounds?\b/iu,
    /100\s*轮/iu,
  ],
};

const CONFIRMED_SELECTION_SECTION_PATTERNS = [
  /^\s*(?:##\s*)?用户选择(?:\s|$|[:：])/imu,
  /^\s*(?:##\s*)?User Selection(?:\s|$|[:：])/imu,
  /^\s*(?:##\s*)?User Choice(?:\s|$|[:：])/imu,
];

const CONFIRMED_SELECTION_VALUE_PATTERNS = {
  quick_probe_20: [
    /强度\s*[:：]\s*20\b/iu,
    /intensity\s*[:：]?\s*20\b/iu,
    /\bquick_probe_20\b/iu,
    /\bquick[_ -]?probe\b/iu,
  ],
  decision_root_cause_50: [
    /强度\s*[:：]\s*50\b/iu,
    /intensity\s*[:：]?\s*50\b/iu,
    /\bdecision_root_cause_50\b/iu,
    /\bdecision_root_cause\b/iu,
  ],
  final_solution_task_list_100: [
    /强度\s*[:：]\s*100\b/iu,
    /intensity\s*[:：]?\s*100\b/iu,
    /\bfinal_solution_task_list_100\b/iu,
    /\bfinal_solution_task_list\b/iu,
  ],
};

const USER_SELECTION_ACK_PATTERNS = [
  /用户(?:已)?选择/iu,
  /用户明确回复/iu,
  /确认[，,:：\s]*用户选择/iu,
  /已确认(?:用户)?选择/iu,
  /user(?:\s+has|\s+already)?\s+(?:selected|chose|confirmed)/iu,
  /confirmed\s+user\s+selection/iu,
];

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJson(filePath, payload) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function includesAny(normalizedText, markers) {
  return markers.some((marker) => normalizedText.includes(marker));
}

function assertPositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
}

function sanitizeSummaryList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => String(entry ?? '').trim())
    .filter((entry) => entry.length > 0);
}

function formatCheckpointRound(round) {
  assertPositiveInteger(round, 'round');
  return String(round).padStart(3, '0');
}

function requiresHighConfidenceFinalOutputs(inputText) {
  return includesAny(String(inputText || '').toLowerCase(), HIGH_CONFIDENCE_FINAL_OUTPUT_MARKERS);
}

function requestsQuickProbe(inputText) {
  return includesAny(String(inputText || '').toLowerCase(), QUICK_PROBE_MARKERS);
}

function isPartyModeFacilitatorIntent(inputText) {
  return includesAny(String(inputText || '').toLowerCase(), PARTY_MODE_FACILITATOR_INTENT_MARKERS);
}

function deriveSessionPaths(projectRoot, sessionKey) {
  return {
    metaPath: path.join(projectRoot, '_bmad-output', 'party-mode', 'sessions', `${sessionKey}.meta.json`),
    sessionLogPath: path.join(projectRoot, '_bmad-output', 'party-mode', 'sessions', `${sessionKey}.jsonl`),
    snapshotPath: path.join(projectRoot, '_bmad-output', 'party-mode', 'snapshots', `${sessionKey}.latest.json`),
    convergenceRecordPath: path.join(
      projectRoot,
      '_bmad-output',
      'party-mode',
      'evidence',
      `${sessionKey}.convergence.json`
    ),
    auditVerdictPath: path.join(
      projectRoot,
      '_bmad-output',
      'party-mode',
      'evidence',
      `${sessionKey}.audit.json`
    ),
  };
}

function deriveBatchCheckpointPaths(projectRoot, sessionKey, batchTargetRound) {
  const round = formatCheckpointRound(batchTargetRound);
  const root = path.join(projectRoot, '_bmad-output', 'party-mode', 'checkpoints');
  return {
    checkpointJsonPath: path.join(root, `${sessionKey}.round-${round}.json`),
    checkpointMarkdownPath: path.join(root, `${sessionKey}.round-${round}.md`),
    receiptPath: path.join(root, `${sessionKey}.round-${round}.receipt.json`),
  };
}

function getAgentTurnCapabilityContract() {
  return {
    agent_turn_event_source_mode: AGENT_TURN_EVENT_SOURCE_MODE,
    host_native_agent_turn_supported: HOST_NATIVE_AGENT_TURN_SUPPORTED,
    host_native_agent_turn_reason: HOST_NATIVE_AGENT_TURN_REASON,
  };
}

function inferGateProfileId(inputText) {
  if (requestsQuickProbe(inputText)) {
    return 'quick_probe_20';
  }
  if (requiresHighConfidenceFinalOutputs(inputText)) {
    return 'final_solution_task_list_100';
  }
  return 'decision_root_cause_50';
}

function detectExplicitGateProfileMatches(inputText) {
  const text = String(inputText || '');
  return Object.keys(EXPLICIT_SELECTION_PATTERNS).filter((profileId) =>
    EXPLICIT_SELECTION_PATTERNS[profileId].some((pattern) => pattern.test(text))
  );
}

function detectExplicitGateProfileId(inputText) {
  const matches = detectExplicitGateProfileMatches(inputText);
  return matches.length === 1 ? matches[0] : null;
}

function hasConfirmedUserSelectionBlock(inputText) {
  const text = String(inputText || '');
  return CONFIRMED_SELECTION_SECTION_PATTERNS.some((pattern) => pattern.test(text));
}

function detectConfirmedGateProfileId(inputText) {
  const text = String(inputText || '');
  if (!hasConfirmedUserSelectionBlock(text)) {
    return null;
  }
  const matches = Object.keys(CONFIRMED_SELECTION_VALUE_PATTERNS).filter((profileId) =>
    CONFIRMED_SELECTION_VALUE_PATTERNS[profileId].some((pattern) => pattern.test(text))
  );
  return matches.length === 1 ? matches[0] : null;
}

function hasAcknowledgedUserSelection(inputText) {
  const text = String(inputText || '');
  return USER_SELECTION_ACK_PATTERNS.some((pattern) => pattern.test(text));
}

const EMBEDDED_BOOTSTRAP_LABEL_PATTERNS = [
  /Party Mode Session Bootstrap \(JSON\)/iu,
  /Session Bootstrap \(JSON\)/iu,
];

function extractBalancedJsonObject(source, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < source.length; index += 1) {
    const ch = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }
  return null;
}

function extractEmbeddedBootstrapJson(inputText) {
  const text = String(inputText || '');
  for (const pattern of EMBEDDED_BOOTSTRAP_LABEL_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) {
      continue;
    }
    const braceIndex = text.indexOf('{', match.index + match[0].length);
    if (braceIndex < 0) {
      continue;
    }
    const objectText = extractBalancedJsonObject(text, braceIndex);
    if (!objectText) {
      continue;
    }
    try {
      const parsed = JSON.parse(objectText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // ignore malformed embedded bootstrap blocks
    }
  }
  return null;
}

function describeRecommendedGateProfile(profileId) {
  switch (profileId) {
    case 'quick_probe_20':
      return '检测到 quick probe / 快速探查意图，推荐快速分析';
    case 'final_solution_task_list_100':
      return '当前请求指向最终方案 / 最终任务列表 / BUGFIX §7 / Story 定稿，推荐高置信完整方案';
    default:
      return '当前请求更像普通 RCA / 方案比较，推荐标准分析';
  }
}

function buildIntensitySelectionPreflightMessage(inputText) {
  const matches = detectExplicitGateProfileMatches(inputText);
  const recommended = inferGateProfileId(inputText);
  const ambiguityLine =
    matches.length > 1
      ? `检测到多个候选档位：${matches.join(', ')}，宿主无法判定唯一强度。`
      : '当前未检测到唯一明确的 20 / 50 / 100 强度选择。';

  return [
    'Party-Mode 启动前必须先明确选择讨论强度，当前已阻止 facilitator 启动。',
    ambiguityLine,
    '请先选择一个档位后再重试：',
    '- 20 轮 -> quick_probe_20 -> 快速分析（预计 3-6 分钟，probe-only）',
    '- 50 轮 -> decision_root_cause_50 -> 标准分析（预计 8-12 分钟，普通 RCA / 方案比较）',
    '- 100 轮 -> final_solution_task_list_100 -> 完整方案（预计 15-25 分钟，高置信定稿）',
    `推荐档位: ${recommended}。${describeRecommendedGateProfile(recommended)}`,
    '可通过以下任一方式显式提供：',
    '- 在 party-mode 启动 payload 中设置 `gateProfileId` / `gate_profile_id`',
    '- 或在启动 prompt / task 中明确写出且只写出一个档位：`20轮` / `50轮` / `100轮` 或对应 profile id',
  ].join('\n');
}

function buildIntensitySelectionAskTemplate(inputText) {
  const recommended = inferGateProfileId(inputText);
  return [
    'Party-Mode preflight: main Agent must ask the user to choose intensity before invoking the facilitator.',
    '请直接向用户发送以下模板，不要直接启动 facilitator：',
    '',
    '请选择本次 Party-Mode 讨论强度：',
    '1. `20` 轮 -> `quick_probe_20` -> 快速分析（3-6 分钟，仅 probe，不承诺最终闭环）',
    '2. `50` 轮 -> `decision_root_cause_50` -> 标准分析（8-12 分钟，普通 RCA / 方案比较）',
    '3. `100` 轮 -> `final_solution_task_list_100` -> 完整方案（15-25 分钟，高置信最终方案 / 最终任务列表 / BUGFIX §7 / Story 定稿）',
    '',
    `推荐档位：\`${recommended}\``,
    '必须等待用户明确回复 `20` / `50` / `100` 后再继续。',
    '提问消息必须停在这里，等待下一条用户回复。',
    '禁止在同一条助手消息中追加「或按推荐档位开始」「现在启动」「我将开始多角色讨论」等自动发起表述。',
    '优先方式：将所选档位显式传入 `gateProfileId` / `gate_profile_id`。',
    '注意：`推荐档位` / `默认档位` 不是用户授权，禁止直接写成“已选择档位”。',
    '若当前 Agent tool 无法透传该字段，则必须在 prompt 中加入专用确认块，例如：',
    '## 用户选择',
    '强度: 50 (decision_root_cause_50)',
    '注意：只有这种专用“用户选择”确认块才算授权；普通 prompt 文本中的 `100轮` / `50轮` / `20轮` 只用于推荐，不算授权。',
    '若你其实已经拿到用户在上一条消息中的明确回复，请不要再次询问；应把同一档位编译进 `gateProfileId` / `gate_profile_id` 或上述确认块后立即重试一次。',
  ].join('\n');
}

function buildIntensitySelectionRetryTemplate(gateProfileId) {
  const profileLabel =
    gateProfileId === 'quick_probe_20'
      ? '20 (quick_probe_20)'
      : gateProfileId === 'final_solution_task_list_100'
        ? '100 (final_solution_task_list_100)'
        : '50 (decision_root_cause_50)';
  return [
    'Party-Mode preflight: a user-selected intensity was detected in free text, but the current Agent payload is not carrying an authoritative structured confirmation.',
    '不要再次询问用户 20 / 50 / 100。',
    '主 Agent 必须立即沿用同一档位重新发起一次 facilitator 调用。',
    '',
    '立即重试要求：',
    `- 将 \`${gateProfileId}\` 显式传入 \`gateProfileId\` / \`gate_profile_id\``,
    '- 或在 prompt 中加入专用确认块：',
    '## 用户选择',
    `强度: ${profileLabel}`,
    '',
    '然后立刻重新调用 `@"party-mode-facilitator (agent)"`。',
    '若宿主仍然拒绝本次重试，再向用户显示简短提示：`已识别到您选择的档位，我将按同一档位重试；若仍失败，请再发送一次该档位数字。`',
  ].join('\n');
}

function buildStructuredSelectionNeedsConfirmationTemplate(gateProfileId) {
  const profileLabel =
    gateProfileId === 'quick_probe_20'
      ? '20 (quick_probe_20)'
      : gateProfileId === 'final_solution_task_list_100'
        ? '100 (final_solution_task_list_100)'
        : '50 (decision_root_cause_50)';
  return [
    'Party-Mode preflight: structured gate profile was present, but there is still no authoritative proof that the user explicitly chose the intensity.',
    '当前 payload 中的 `gateProfileId` / `gate_profile_id` 只能承载“用户已确认”的结果，不能替代用户授权本身。',
    '不要把推荐档位 / 默认档位 / 自检中的“已选择档位”当作用户回复。',
    '若当前消息仍在询问用户档位，则本条助手消息必须停在问题处，禁止同条消息里继续写「现在启动」「开始多角色讨论」。',
    '',
    '请先向用户展示 20 / 50 / 100 选项并等待其明确回复；若你其实已经拿到用户回复，则必须把该回复编译进专用确认块：',
    '## 用户选择',
    `强度: ${profileLabel}`,
    '',
    '只有在当前 payload 中出现上述确认块后，才允许继续发起 facilitator。',
  ].join('\n');
}

function buildPartyModeContractViolationMessage(inputText) {
  const recommended = inferGateProfileId(inputText);
  return [
    'Party-Mode facilitator must not be launched through `subagent_type: general-purpose`.',
    'Main Agent must re-issue the call using the dedicated facilitator contract instead of a wrapper.',
    'Required route:',
    '- Claude Code CLI: `@"party-mode-facilitator (agent)"`',
    `- Then pass the user-selected structured gate field: \`${recommended}\` via \`gateProfileId\` / \`gate_profile_id\``,
    'Note: the discussion topic may be Cursor custom subagents, but the host-side facilitator route is still the dedicated party-mode contract, not general-purpose.',
  ].join('\n');
}

function resolveExplicitGateProfileSelection(providedGateProfileId, inputText) {
  const resolved = providedGateProfileId || detectExplicitGateProfileId(inputText);
  if (!resolved) {
    throw new Error(buildIntensitySelectionPreflightMessage(inputText));
  }
  assertGateProfileSelectionAllowed(resolved, inputText);
  return resolved;
}

function resolveStructuredGateProfileSelection(providedGateProfileId, inputText, options = {}) {
  const confirmed = detectConfirmedGateProfileId(inputText);
  const requireConfirmedBlock = options.requireConfirmedBlock === true;
  if (requireConfirmedBlock) {
    if (confirmed) {
      if (providedGateProfileId && providedGateProfileId !== confirmed) {
        throw new Error(
          `Structured gate profile ${providedGateProfileId} mismatches confirmed user selection ${confirmed}`
        );
      }
      assertGateProfileSelectionAllowed(confirmed, inputText);
      return confirmed;
    }
    if (providedGateProfileId) {
      throw new Error(buildStructuredSelectionNeedsConfirmationTemplate(providedGateProfileId));
    }
    const explicit = detectExplicitGateProfileId(inputText);
    if (explicit && hasAcknowledgedUserSelection(inputText)) {
      throw new Error(buildIntensitySelectionRetryTemplate(explicit));
    }
    throw new Error(buildIntensitySelectionAskTemplate(inputText));
  }
  const resolved = providedGateProfileId || confirmed;
  if (!resolved) {
    const explicit = detectExplicitGateProfileId(inputText);
    if (explicit && hasAcknowledgedUserSelection(inputText)) {
      throw new Error(buildIntensitySelectionRetryTemplate(explicit));
    }
    throw new Error(buildIntensitySelectionAskTemplate(inputText));
  }
  assertGateProfileSelectionAllowed(resolved, inputText);
  return resolved;
}

function assertGateProfileSelectionAllowed(gateProfileId, inputText) {
  const profile = KNOWN_GATE_PROFILES[gateProfileId];
  if (!profile || !requiresHighConfidenceFinalOutputs(inputText)) {
    return;
  }
  if (profile.closureLevel !== 'high_confidence') {
    throw new Error(
      `Selected gate profile ${gateProfileId} only supports ${profile.closureLevel} closure; upgrade to final_solution_task_list_100 for high-confidence final outputs`
    );
  }
}

function resolveBatchFields(options, existingMeta, gateProfileId, profile) {
  const batchSize = options.batchSize ?? existingMeta?.batch_size ?? DEFAULT_BATCH_SIZE;
  assertPositiveInteger(batchSize, 'batch_size');

  const targetRoundsTotal = options.targetRoundsTotal ?? existingMeta?.target_rounds_total ?? profile.minRounds;
  assertPositiveInteger(targetRoundsTotal, 'target_rounds_total');
  if (targetRoundsTotal !== profile.minRounds) {
    throw new Error(
      `target_rounds_total for ${gateProfileId} must match min_rounds (${profile.minRounds}), got ${targetRoundsTotal}`
    );
  }

  const batchIndex = options.batchIndex ?? existingMeta?.current_batch_index ?? 1;
  assertPositiveInteger(batchIndex, 'current_batch_index');

  const keepExistingRange =
    existingMeta &&
    options.batchIndex === undefined &&
    options.batchStartRound === undefined &&
    options.batchTargetRound === undefined &&
    existingMeta.current_batch_index === batchIndex;

  const computedBatchStartRound = (batchIndex - 1) * batchSize + 1;
  const batchStartRound =
    options.batchStartRound ??
    (keepExistingRange ? existingMeta?.current_batch_start_round : undefined) ??
    computedBatchStartRound;
  assertPositiveInteger(batchStartRound, 'current_batch_start_round');

  const defaultBatchTargetRound = Math.min(batchStartRound + batchSize - 1, targetRoundsTotal);
  const batchTargetRound =
    options.batchTargetRound ??
    (keepExistingRange ? existingMeta?.current_batch_target_round : undefined) ??
    defaultBatchTargetRound;
  assertPositiveInteger(batchTargetRound, 'current_batch_target_round');

  if (batchTargetRound < batchStartRound) {
    throw new Error(
      `Invalid batch range: current_batch_target_round (${batchTargetRound}) < current_batch_start_round (${batchStartRound})`
    );
  }
  if (batchTargetRound > targetRoundsTotal) {
    throw new Error(
      `Invalid batch range: current_batch_target_round (${batchTargetRound}) > target_rounds_total (${targetRoundsTotal})`
    );
  }

  const checkpointWindowMs =
    options.checkpointWindowMs ?? existingMeta?.checkpoint_window_ms ?? DEFAULT_CHECKPOINT_WINDOW_MS;
  assertPositiveInteger(checkpointWindowMs, 'checkpoint_window_ms');

  return {
    batch_size: batchSize,
    current_batch_index: batchIndex,
    current_batch_start_round: batchStartRound,
    current_batch_target_round: batchTargetRound,
    target_rounds_total: targetRoundsTotal,
    checkpoint_window_ms: checkpointWindowMs,
    current_batch_status: options.currentBatchStatus ?? 'pending',
  };
}

function extractSubagentText(input) {
  if (!input || typeof input !== 'object') {
    return '';
  }
  return String(input.task || input.prompt || input.user_message || input.agent_message || '').trim();
}

function isPartyModeFacilitatorStart(input) {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const raw = JSON.stringify(input);
  return (
    isPartyModeFacilitatorIntent(raw) ||
    raw.includes('_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration')
  );
}

function bootstrapSession(projectRoot, options) {
  const sessionKey =
    options.sessionKey ||
    `pm-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const gateProfileId = options.gateProfileId || inferGateProfileId(options.inputText);
  assertGateProfileSelectionAllowed(gateProfileId, options.inputText);
  const profile = KNOWN_GATE_PROFILES[gateProfileId];
  if (!profile) {
    throw new Error(`Unknown gate profile: ${gateProfileId}`);
  }
  const paths = deriveSessionPaths(projectRoot, sessionKey);
  const now = new Date().toISOString();
  const existingMeta = fs.existsSync(paths.metaPath) ? readJson(paths.metaPath) : null;
  if (existingMeta && existingMeta.gate_profile_id !== gateProfileId) {
    throw new Error(
      `Session ${sessionKey} already exists with gate_profile_id=${existingMeta.gate_profile_id}; cannot switch to ${gateProfileId}`
    );
  }
  const batchFields = resolveBatchFields(options, existingMeta, gateProfileId, profile);
  const meta = {
    session_key: sessionKey,
    scenario_kind: options.scenarioKind || existingMeta?.scenario_kind || gateProfileId,
    gate_profile_id: gateProfileId,
    designated_challenger_id:
      options.designatedChallengerId ||
      existingMeta?.designated_challenger_id ||
      DEFAULT_DESIGNATED_CHALLENGER_ID,
    ...getAgentTurnCapabilityContract(),
    min_rounds: profile.minRounds,
    ratio_threshold: profile.ratioThreshold,
    tail_window: profile.tailWindow,
    closure_level: profile.closureLevel,
    ...batchFields,
    topic: options.topic || existingMeta?.topic || options.inputText || '',
    resolved_mode: options.resolvedMode || existingMeta?.resolved_mode,
    session_log_path: existingMeta?.session_log_path || normalizePath(paths.sessionLogPath),
    snapshot_path: existingMeta?.snapshot_path || normalizePath(paths.snapshotPath),
    convergence_record_path:
      existingMeta?.convergence_record_path || normalizePath(paths.convergenceRecordPath),
    audit_verdict_path: existingMeta?.audit_verdict_path || normalizePath(paths.auditVerdictPath),
    created_at: existingMeta?.created_at || now,
    updated_at: now,
  };
  writeJson(paths.metaPath, meta);
  const checkpointPaths = deriveBatchCheckpointPaths(
    projectRoot,
    sessionKey,
    meta.current_batch_target_round
  );
  paths.currentBatchCheckpointJsonPath = checkpointPaths.checkpointJsonPath;
  paths.currentBatchCheckpointMarkdownPath = checkpointPaths.checkpointMarkdownPath;
  paths.currentBatchReceiptPath = checkpointPaths.receiptPath;
  ensureParentDir(paths.sessionLogPath);
  if (!fs.existsSync(paths.sessionLogPath)) {
    fs.writeFileSync(paths.sessionLogPath, '', 'utf8');
  }
  return { sessionKey, meta, paths };
}

function readSessionLog(sessionLogPath) {
  const source = fs.existsSync(sessionLogPath) ? fs.readFileSync(sessionLogPath, 'utf8') : '';
  const lines = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const turns = lines.map((line) => JSON.parse(line));
  return {
    turns,
    sha256: createHash('sha256').update(source).digest('hex'),
  };
}

function computeGate(meta, turns, sourceLogSha256) {
  const profile = KNOWN_GATE_PROFILES[meta.gate_profile_id];
  if (!profile) {
    throw new Error(`Unknown gate_profile_id: ${meta.gate_profile_id}`);
  }
  if (
    meta.min_rounds !== profile.minRounds ||
    meta.ratio_threshold !== profile.ratioThreshold ||
    meta.tail_window !== profile.tailWindow ||
    (meta.closure_level !== undefined && meta.closure_level !== profile.closureLevel)
  ) {
    throw new Error(
      `Meta gate profile mismatch for ${meta.gate_profile_id}: expected ${JSON.stringify(profile)}, got ${JSON.stringify({
        minRounds: meta.min_rounds,
        ratioThreshold: meta.ratio_threshold,
        tailWindow: meta.tail_window,
        closureLevel: meta.closure_level || null,
      })}`
    );
  }
  const matchingSessionTurns = turns.filter((turn) => turn.session_key === meta.session_key);
  const agentTurns = matchingSessionTurns.filter(
    (turn) =>
      (turn.record_type || 'agent_turn') === 'agent_turn' &&
      typeof turn.speaker_id === 'string'
  );
  const countedTurns = agentTurns.filter((turn) => turn.counts_toward_ratio === true);
  const challengerTurns = countedTurns.filter(
    (turn) => turn.speaker_id === meta.designated_challenger_id
  );
  const tailTurns = countedTurns.slice(-meta.tail_window);
  const challengerRatio =
    countedTurns.length === 0 ? 0 : challengerTurns.length / countedTurns.length;
  const lastTailNoNewGap =
    tailTurns.length === meta.tail_window &&
    tailTurns.every((turn) => turn.has_new_gap === false);
  const failedChecks = [];
  if (agentTurns.length < meta.min_rounds) {
    failedChecks.push('min_rounds_check');
  }
  if (challengerRatio <= meta.ratio_threshold) {
    failedChecks.push('challenger_ratio_check');
  }
  if (!lastTailNoNewGap) {
    failedChecks.push('last_tail_no_new_gap_check');
  }
  return {
    session_key: meta.session_key,
    gate_profile_id: meta.gate_profile_id,
    designated_challenger_id: meta.designated_challenger_id,
    rounds: agentTurns.length,
    counted_rounds: countedTurns.length,
    challenger_rounds: challengerTurns.length,
    challenger_ratio: challengerRatio,
    last_tail_no_new_gap: lastTailNoNewGap,
    tail_window: profile.tailWindow,
    min_rounds: profile.minRounds,
    ratio_threshold: profile.ratioThreshold,
    closure_level: profile.closureLevel,
    gate_pass: failedChecks.length === 0,
    failed_checks: failedChecks,
    source_log_sha256: sourceLogSha256,
  };
}

function writeSnapshot(meta, result, sessionLogPath) {
  const payload = {
    session_key: result.session_key,
    source_log_path: normalizePath(sessionLogPath),
    source_log_sha256: result.source_log_sha256,
    last_completed_round_index: result.rounds,
    derived_rounds: result.rounds,
    derived_challenger_ratio: result.challenger_ratio,
    derived_last_tail_no_new_gap: result.last_tail_no_new_gap,
    tail_rounds: result.tail_window,
    gate_profile_id: result.gate_profile_id,
    closure_level: result.closure_level,
    batch_size: meta.batch_size,
    current_batch_index: meta.current_batch_index,
    current_batch_start_round: meta.current_batch_start_round,
    current_batch_target_round: meta.current_batch_target_round,
    target_rounds_total: meta.target_rounds_total,
    checkpoint_window_ms: meta.checkpoint_window_ms,
    current_batch_status: meta.current_batch_status,
    agent_turn_event_source_mode: meta.agent_turn_event_source_mode,
    host_native_agent_turn_supported: meta.host_native_agent_turn_supported,
    host_native_agent_turn_reason: meta.host_native_agent_turn_reason,
    generated_at: new Date().toISOString(),
  };
  writeJson(meta.snapshot_path, payload);
}

function writeConvergenceRecord(meta, result) {
  const payload = {
    session_key: result.session_key,
    gate_profile_id: result.gate_profile_id,
    closure_level: result.closure_level,
    round_tail_window: result.tail_window,
    challenger_ratio: result.challenger_ratio,
    agent_turn_event_source_mode: meta.agent_turn_event_source_mode,
    host_native_agent_turn_supported: meta.host_native_agent_turn_supported,
    host_native_agent_turn_reason: meta.host_native_agent_turn_reason,
    gate_result: result.gate_pass ? 'PASS' : 'FAIL',
    checker_result: result,
    source_log_sha256: result.source_log_sha256,
    generated_at: new Date().toISOString(),
  };
  writeJson(meta.convergence_record_path, payload);
}

function writeAuditVerdict(meta, result) {
  const failed = new Set(result.failed_checks);
  const payload = {
    session_key: result.session_key,
    gate_profile_id: result.gate_profile_id,
    closure_level: result.closure_level,
    agent_turn_event_source_mode: meta.agent_turn_event_source_mode,
    host_native_agent_turn_supported: meta.host_native_agent_turn_supported,
    host_native_agent_turn_reason: meta.host_native_agent_turn_reason,
    checker_result: result,
    source_log_sha256: result.source_log_sha256,
    min_rounds_check: failed.has('min_rounds_check') ? 'FAIL' : 'PASS',
    challenger_ratio_check: failed.has('challenger_ratio_check') ? 'FAIL' : 'PASS',
    last_tail_no_new_gap_check: failed.has('last_tail_no_new_gap_check') ? 'FAIL' : 'PASS',
    final_result: result.gate_pass ? 'PASS' : 'FAIL',
    generated_at: new Date().toISOString(),
  };
  writeJson(meta.audit_verdict_path, payload);
}

function refreshSessionArtifacts(projectRoot, sessionKey) {
  const paths = deriveSessionPaths(projectRoot, sessionKey);
  if (!fs.existsSync(paths.metaPath) || !fs.existsSync(paths.sessionLogPath)) {
    return { refreshed: false, reason: 'missing_party_mode_session_artifacts' };
  }
  const meta = readJson(paths.metaPath);
  const { turns, sha256 } = readSessionLog(paths.sessionLogPath);
  const result = computeGate(meta, turns, sha256);
  writeSnapshot(meta, result, paths.sessionLogPath);
  writeConvergenceRecord(meta, result);
  writeAuditVerdict(meta, result);
  maybeMaterializeCheckpointArtifacts(projectRoot, meta, result);
  return { refreshed: true, result };
}

function assertCurrentBatchState(meta) {
  const requiredFields = [
    'batch_size',
    'current_batch_index',
    'current_batch_start_round',
    'current_batch_target_round',
    'target_rounds_total',
    'checkpoint_window_ms',
    'current_batch_status',
  ];
  for (const field of requiredFields) {
    if (meta[field] === undefined || meta[field] === null) {
      throw new Error(`Missing batch state field in .meta.json: ${field}`);
    }
  }
  return {
    batch_size: meta.batch_size,
    current_batch_index: meta.current_batch_index,
    current_batch_start_round: meta.current_batch_start_round,
    current_batch_target_round: meta.current_batch_target_round,
    target_rounds_total: meta.target_rounds_total,
    checkpoint_window_ms: meta.checkpoint_window_ms,
    current_batch_status: meta.current_batch_status,
  };
}

function assertCheckpointEligible(sessionKey, batchState, result) {
  if (result.rounds < batchState.current_batch_target_round) {
    throw new Error(
      `Cannot write checkpoint for ${sessionKey} before batch target round ${batchState.current_batch_target_round} is reached`
    );
  }
}

function buildCheckpointArtifact(meta, batchState, result, summary = {}) {
  assertCheckpointEligible(meta.session_key, batchState, result);
  return {
    version: 'party_mode_checkpoint_v1',
    session_key: meta.session_key,
    gate_profile_id: result.gate_profile_id,
    closure_level: result.closure_level,
    batch_index: batchState.current_batch_index,
    batch_start_round: batchState.current_batch_start_round,
    batch_end_round: batchState.current_batch_target_round,
    deterministic_state: {
      current_round: batchState.current_batch_target_round,
      target_rounds_total: batchState.target_rounds_total,
      remaining_rounds: Math.max(batchState.target_rounds_total - batchState.current_batch_target_round, 0),
      challenger_ratio: result.challenger_ratio,
      tail_window_no_new_gap: result.last_tail_no_new_gap,
      source_log_sha256: `sha256:${result.source_log_sha256}`,
    },
    facilitator_summary: {
      resolved_topics: sanitizeSummaryList(summary.resolvedTopics),
      unresolved_topics: sanitizeSummaryList(summary.unresolvedTopics),
      deferred_risks: sanitizeSummaryList(summary.deferredRisks),
      next_focus: sanitizeSummaryList(summary.nextFocus),
    },
    generated_at: new Date().toISOString(),
  };
}

function renderCheckpointMarkdown(artifact) {
  const list = (items) => (items.length > 0 ? items.join(' | ') : '(none)');
  return [
    `# Party-Mode Checkpoint ${artifact.batch_end_round}/${artifact.deterministic_state.target_rounds_total}`,
    '',
    `- 已收敛议题: ${list(artifact.facilitator_summary.resolved_topics)}`,
    `- 未收敛议题: ${list(artifact.facilitator_summary.unresolved_topics)}`,
    `- Deferred Risks: ${list(artifact.facilitator_summary.deferred_risks)}`,
    `- Challenger Ratio: ${artifact.deterministic_state.challenger_ratio}`,
    `- 下一段 20 轮重点: ${list(artifact.facilitator_summary.next_focus)}`,
    '',
  ].join('\n');
}

function writeBatchReceipt(projectRoot, sessionKey) {
  const paths = deriveSessionPaths(projectRoot, sessionKey);
  const meta = readJson(paths.metaPath);
  const batchState = assertCurrentBatchState(meta);
  const checkpointPaths = deriveBatchCheckpointPaths(
    projectRoot,
    sessionKey,
    batchState.current_batch_target_round
  );
  const payload = {
    session_key: sessionKey,
    gate_profile_id: meta.gate_profile_id,
    closure_level: meta.closure_level,
    batch_size: batchState.batch_size,
    batch_index: batchState.current_batch_index,
    batch_start_round: batchState.current_batch_start_round,
    batch_target_round: batchState.current_batch_target_round,
    target_rounds_total: batchState.target_rounds_total,
    checkpoint_window_ms: batchState.checkpoint_window_ms,
    status: 'checkpoint_ready',
    checkpoint_json_path: normalizePath(checkpointPaths.checkpointJsonPath),
    checkpoint_markdown_path: normalizePath(checkpointPaths.checkpointMarkdownPath),
    generated_at: new Date().toISOString(),
  };
  writeJson(checkpointPaths.receiptPath, payload);
  return checkpointPaths;
}

function writeCheckpointArtifacts(projectRoot, sessionKey, summary = {}) {
  const paths = deriveSessionPaths(projectRoot, sessionKey);
  const meta = readJson(paths.metaPath);
  const batchState = assertCurrentBatchState(meta);
  const { turns, sha256 } = readSessionLog(paths.sessionLogPath);
  const result = computeGate(meta, turns, sha256);
  const checkpointPaths = deriveBatchCheckpointPaths(
    projectRoot,
    sessionKey,
    batchState.current_batch_target_round
  );
  const artifact = buildCheckpointArtifact(meta, batchState, result, summary);
  writeJson(checkpointPaths.checkpointJsonPath, artifact);
  ensureParentDir(checkpointPaths.checkpointMarkdownPath);
  fs.writeFileSync(checkpointPaths.checkpointMarkdownPath, renderCheckpointMarkdown(artifact), 'utf8');
  return checkpointPaths;
}

function maybeMaterializeCheckpointArtifacts(projectRoot, meta, result) {
  const batchState = assertCurrentBatchState(meta);
  if (
    batchState.current_batch_status !== 'pending' ||
    result.rounds < batchState.current_batch_target_round
  ) {
    return;
  }
  writeCheckpointArtifacts(projectRoot, meta.session_key);
  writeBatchReceipt(projectRoot, meta.session_key);
  markBatchCheckpointReady(projectRoot, meta.session_key);
}

function markBatchCheckpointReady(projectRoot, sessionKey) {
  const paths = deriveSessionPaths(projectRoot, sessionKey);
  const meta = readJson(paths.metaPath);
  const batchState = assertCurrentBatchState(meta);
  const checkpointPaths = deriveBatchCheckpointPaths(
    projectRoot,
    sessionKey,
    batchState.current_batch_target_round
  );
  if (!fs.existsSync(checkpointPaths.checkpointJsonPath) || !fs.existsSync(checkpointPaths.checkpointMarkdownPath)) {
    throw new Error(
      `Cannot mark checkpoint_ready without checkpoint artifacts for batch ${batchState.current_batch_index}`
    );
  }
  if (!fs.existsSync(checkpointPaths.receiptPath)) {
    writeBatchReceipt(projectRoot, sessionKey);
  }
  const nextMeta = {
    ...meta,
    current_batch_status: 'checkpoint_ready',
    updated_at: new Date().toISOString(),
  };
  writeJson(paths.metaPath, nextMeta);
  return nextMeta;
}

function markBatchCompleted(projectRoot, sessionKey) {
  const paths = deriveSessionPaths(projectRoot, sessionKey);
  const meta = readJson(paths.metaPath);
  const batchState = assertCurrentBatchState(meta);
  const checkpointPaths = deriveBatchCheckpointPaths(
    projectRoot,
    sessionKey,
    batchState.current_batch_target_round
  );
  if (
    !fs.existsSync(checkpointPaths.checkpointJsonPath) ||
    !fs.existsSync(checkpointPaths.checkpointMarkdownPath) ||
    !fs.existsSync(checkpointPaths.receiptPath)
  ) {
    throw new Error(
      `Cannot mark batch completed before checkpoint artifacts and receipt exist for batch ${batchState.current_batch_index}`
    );
  }
  const nextMeta = {
    ...meta,
    current_batch_status: 'completed',
    updated_at: new Date().toISOString(),
  };
  writeJson(paths.metaPath, nextMeta);
  return nextMeta;
}

function recoverBatchProgress(projectRoot, sessionKey) {
  const paths = deriveSessionPaths(projectRoot, sessionKey);
  const meta = readJson(paths.metaPath);
  const batchState = assertCurrentBatchState(meta);
  const checkpointPaths = deriveBatchCheckpointPaths(
    projectRoot,
    sessionKey,
    batchState.current_batch_target_round
  );
  const hasCheckpointArtifacts =
    fs.existsSync(checkpointPaths.checkpointJsonPath) && fs.existsSync(checkpointPaths.checkpointMarkdownPath);
  const hasReceipt = fs.existsSync(checkpointPaths.receiptPath);
  let action;
  if (batchState.current_batch_status === 'checkpoint_ready') {
    action = 'replay_checkpoint';
  } else if (batchState.current_batch_status === 'completed') {
    action = 'advance_next_batch';
  } else {
    action = hasCheckpointArtifacts ? 'replay_checkpoint' : 'replay_current_batch';
  }
  const nextBatchStartRound =
    batchState.current_batch_target_round >= batchState.target_rounds_total
      ? null
      : batchState.current_batch_target_round + 1;
  const nextBatchIndex = nextBatchStartRound == null ? null : batchState.current_batch_index + 1;
  const nextBatchTargetRound =
    nextBatchStartRound == null
      ? null
      : Math.min(nextBatchStartRound + batchState.batch_size - 1, batchState.target_rounds_total);
  return {
    action,
    meta,
    checkpointPaths,
    hasCheckpointArtifacts,
    hasReceipt,
    nextBatchIndex,
    nextBatchStartRound,
    nextBatchTargetRound,
  };
}

function appendTurn(projectRoot, payload) {
  const paths = deriveSessionPaths(projectRoot, payload.sessionKey);
  const record = {
    record_type: 'agent_turn',
    session_key: payload.sessionKey,
    round_index: payload.roundIndex,
    speaker_id: payload.speakerId,
    designated_challenger_id:
      payload.designatedChallengerId || DEFAULT_DESIGNATED_CHALLENGER_ID,
    counts_toward_ratio: payload.countsTowardRatio,
    has_new_gap: payload.hasNewGap,
    timestamp: payload.timestamp || new Date().toISOString(),
  };
  ensureParentDir(paths.sessionLogPath);
  fs.appendFileSync(paths.sessionLogPath, `${JSON.stringify(record)}\n`, 'utf8');
  return refreshSessionArtifacts(projectRoot, payload.sessionKey);
}

function appendControlRecord(projectRoot, payload) {
  if (payload.recordType === 'agent_turn') {
    throw new Error('Control records must not use record_type = "agent_turn"');
  }
  if (payload.countsTowardRatio !== false) {
    throw new Error('Control records must set counts_toward_ratio = false');
  }
  const paths = deriveSessionPaths(projectRoot, payload.sessionKey);
  const record = {
    session_key: payload.sessionKey,
    record_type: payload.recordType,
    counts_toward_ratio: false,
    timestamp: payload.timestamp || new Date().toISOString(),
  };
  if (payload.payload && typeof payload.payload === 'object' && !Array.isArray(payload.payload)) {
    record.payload = payload.payload;
  }
  ensureParentDir(paths.sessionLogPath);
  fs.appendFileSync(paths.sessionLogPath, `${JSON.stringify(record)}\n`, 'utf8');
}

function parseBoolean(value) {
  return value === 'true' || value === true;
}

function parseCliArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case '--project-root':
        out.projectRoot = next;
        index += 1;
        break;
      case '--session-key':
        out.sessionKey = next;
        index += 1;
        break;
      case '--round-index':
        out.roundIndex = Number(next);
        index += 1;
        break;
      case '--speaker-id':
        out.speakerId = next;
        index += 1;
        break;
      case '--designated-challenger-id':
        out.designatedChallengerId = next;
        index += 1;
        break;
      case '--counts-toward-ratio':
        out.countsTowardRatio = parseBoolean(next);
        index += 1;
        break;
      case '--has-new-gap':
        out.hasNewGap = parseBoolean(next);
        index += 1;
        break;
      case '--timestamp':
        out.timestamp = next;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }
  return out;
}

module.exports = {
  DEFAULT_DESIGNATED_CHALLENGER_ID,
  bootstrapSession,
  appendTurn,
  appendControlRecord,
  computeGate,
  getAgentTurnCapabilityContract,
  deriveSessionPaths,
  deriveBatchCheckpointPaths,
  extractSubagentText,
  assertGateProfileSelectionAllowed,
  buildIntensitySelectionAskTemplate,
  buildIntensitySelectionRetryTemplate,
  buildStructuredSelectionNeedsConfirmationTemplate,
  buildPartyModeContractViolationMessage,
  buildIntensitySelectionPreflightMessage,
  detectExplicitGateProfileId,
  detectExplicitGateProfileMatches,
  hasAcknowledgedUserSelection,
  extractEmbeddedBootstrapJson,
  inferGateProfileId,
  isPartyModeFacilitatorIntent,
  isPartyModeFacilitatorStart,
  resolveExplicitGateProfileSelection,
  resolveStructuredGateProfileSelection,
  writeBatchReceipt,
  writeCheckpointArtifacts,
  markBatchCheckpointReady,
  markBatchCompleted,
  recoverBatchProgress,
  requiresHighConfidenceFinalOutputs,
  requestsQuickProbe,
  refreshSessionArtifacts,
};

if (require.main === module) {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    const root = path.resolve(args.projectRoot || process.cwd());
    if (!args.sessionKey || !Number.isFinite(args.roundIndex) || !args.speakerId) {
      throw new Error(
        'Usage: node party-mode-session-runtime.cjs --project-root <root> --session-key <key> --round-index <n> --speaker-id <id> [--designated-challenger-id <id>] [--counts-toward-ratio true|false] [--has-new-gap true|false] [--timestamp <iso>]'
      );
    }
    const result = appendTurn(root, {
      sessionKey: args.sessionKey,
      roundIndex: args.roundIndex,
      speakerId: args.speakerId,
      designatedChallengerId: args.designatedChallengerId,
      countsTowardRatio: args.countsTowardRatio !== false,
      hasNewGap: args.hasNewGap === true,
      timestamp: args.timestamp,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error && error.message ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
