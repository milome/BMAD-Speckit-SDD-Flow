import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type GateProfileId =
  | 'quick_probe_20'
  | 'final_solution_task_list_100'
  | 'decision_root_cause_50';
export type ClosureLevel = 'none' | 'standard' | 'high_confidence';
export type BatchCommitStatus = 'pending' | 'checkpoint_ready' | 'completed';
export type BatchRecoveryAction = 'replay_current_batch' | 'replay_checkpoint' | 'advance_next_batch';

export interface KnownGateProfile {
  minRounds: number;
  ratioThreshold: number;
  tailWindow: number;
  closureLevel: ClosureLevel;
}

export interface SessionMeta {
  session_key: string;
  scenario_kind?: string;
  gate_profile_id: string;
  designated_challenger_id: string;
  agent_turn_event_source_mode?: AgentTurnEventSourceMode;
  host_native_agent_turn_supported?: boolean;
  host_native_agent_turn_reason?: string;
  min_rounds: number;
  ratio_threshold: number;
  tail_window: number;
  closure_level?: ClosureLevel;
  batch_size?: number;
  current_batch_index?: number;
  current_batch_start_round?: number;
  current_batch_target_round?: number;
  target_rounds_total?: number;
  checkpoint_window_ms?: number;
  current_batch_status?: BatchCommitStatus;
  topic?: string;
  resolved_mode?: string;
  session_log_path?: string;
  snapshot_path?: string;
  convergence_record_path?: string;
  audit_verdict_path?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SessionTurn {
  record_type?: string;
  session_key: string;
  round_index: number;
  speaker_id?: string;
  designated_challenger_id?: string;
  counts_toward_ratio?: boolean;
  has_new_gap?: boolean;
  timestamp?: string;
}

export interface SessionControlRecord {
  record_type: 'checkpoint' | 'heartbeat';
  session_key: string;
  counts_toward_ratio: false;
  timestamp?: string;
  payload?: Record<string, unknown>;
}

export interface CheckerOverrides {
  minRounds?: number;
  ratioThreshold?: number;
  tailWindow?: number;
}

export interface GateResult {
  session_key: string;
  gate_profile_id: GateProfileId;
  designated_challenger_id: string;
  rounds: number;
  counted_rounds: number;
  challenger_rounds: number;
  challenger_ratio: number;
  last_tail_no_new_gap: boolean;
  tail_window: number;
  min_rounds: number;
  ratio_threshold: number;
  closure_level: ClosureLevel;
  gate_pass: boolean;
  failed_checks: string[];
  source_log_sha256: string;
}

export interface CliOptions {
  sessionKey?: string;
  metaPath?: string;
  sessionLogPath?: string;
  overrides: CheckerOverrides;
  writeSnapshot: boolean;
  writeConvergenceRecord: boolean;
  writeAuditVerdict: boolean;
}

export interface PartyModeSessionPaths {
  sessionLogPath: string;
  metaPath: string;
  snapshotPath: string;
  convergenceRecordPath: string;
  auditVerdictPath: string;
  currentBatchCheckpointJsonPath?: string;
  currentBatchCheckpointMarkdownPath?: string;
  currentBatchReceiptPath?: string;
}

export interface StartSessionInput {
  sessionKey: string;
  gateProfileId: GateProfileId;
  designatedChallengerId?: string;
  scenarioKind?: string;
  inputText?: string;
  batchSize?: number;
  batchIndex?: number;
  batchStartRound?: number;
  batchTargetRound?: number;
  targetRoundsTotal?: number;
  checkpointWindowMs?: number;
  currentBatchStatus?: BatchCommitStatus;
  topic?: string;
  resolvedMode?: string;
}

export interface RecoveryResult {
  meta: SessionMeta;
  result: GateResult;
  snapshotMatchesLog: boolean;
}

export interface BatchCheckpointPaths {
  checkpointJsonPath: string;
  checkpointMarkdownPath: string;
  receiptPath: string;
}

export interface BatchRecoveryResult {
  action: BatchRecoveryAction;
  meta: SessionMeta;
  checkpointPaths: BatchCheckpointPaths;
  hasCheckpointArtifacts: boolean;
  hasReceipt: boolean;
  nextBatchIndex: number | null;
  nextBatchStartRound: number | null;
  nextBatchTargetRound: number | null;
}

export interface FacilitatorCheckpointSummaryInput {
  resolvedTopics?: string[];
  unresolvedTopics?: string[];
  deferredRisks?: string[];
  nextFocus?: string[];
}

export interface CheckpointDeterministicState {
  current_round: number;
  target_rounds_total: number;
  remaining_rounds: number;
  challenger_ratio: number;
  tail_window_no_new_gap: boolean;
  source_log_sha256: string;
}

export interface FacilitatorCheckpointSummary {
  resolved_topics: string[];
  unresolved_topics: string[];
  deferred_risks: string[];
  next_focus: string[];
}

export interface BatchCheckpointArtifact {
  version: 'party_mode_checkpoint_v1';
  session_key: string;
  gate_profile_id: GateProfileId;
  closure_level: ClosureLevel;
  batch_index: number;
  batch_start_round: number;
  batch_end_round: number;
  deterministic_state: CheckpointDeterministicState;
  facilitator_summary: FacilitatorCheckpointSummary;
  generated_at: string;
}

export type CheckpointWindowResolution =
  | 'stop_and_output_current_conclusion'
  | 'finalize_current_deliverable'
  | 'continue_immediately'
  | 'replan_before_next_batch'
  | 'auto_continue_after_timeout'
  | 'reject_outside_window'
  | 'wait_for_input';

export interface CheckpointWindowState {
  checkpoint_window_ms: number;
  default_behavior: 'auto_continue_next_batch';
  allowed_commands: ['S', 'F', 'C'];
  facilitator_owns_heartbeat: true;
  main_agent_displays_checkpoint: true;
}

export interface CheckpointWindowEvaluation {
  accepted: boolean;
  resolution: CheckpointWindowResolution;
  normalized_input: string;
  closes_window: boolean;
  cancels_window_timer: boolean;
  skip_remaining_window_ms: boolean;
  stop_auto_continue: boolean;
  treat_as_business_context: boolean;
  acknowledgement: string;
}

export interface FacilitatorHeartbeatRecord {
  authority: 'facilitator';
  record_type: 'heartbeat';
  counts_toward_ratio: false;
  message: string;
  elapsed_ms: number;
}

export type AgentTurnEventSourceMode = 'explicit_event_writer_bridge';

export const DEFAULT_DESIGNATED_CHALLENGER_ID = 'adversarial-reviewer' as const;
export const AGENT_TURN_EVENT_SOURCE_MODE = 'explicit_event_writer_bridge' as const;
export const HOST_NATIVE_AGENT_TURN_SUPPORTED = false;
export const HOST_NATIVE_AGENT_TURN_REASON =
  'Current host hook surfaces expose session/subagent/tool boundaries only; no native per-turn agent-turn event is available.';
export const DEFAULT_BATCH_SIZE = 20;
export const DEFAULT_CHECKPOINT_WINDOW_MS = 15_000;

export const KNOWN_GATE_PROFILES: Record<GateProfileId, KnownGateProfile> = {
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

const HIGH_CONFIDENCE_FINAL_OUTPUT_MARKERS = [
  '§7',
  'task list',
  '任务列表',
  '最终方案',
  'bugfix',
  'create story',
  'story 设计定稿',
  '设计定稿',
] as const;

const QUICK_PROBE_MARKERS = [
  'quick_probe_20',
  'quick probe',
  'quick-probe',
  '快速分析',
  '快速探查',
  'probe only',
] as const;

const PARTY_MODE_FACILITATOR_INTENT_MARKERS = [
  'party-mode-facilitator',
  'party-mode facilitator',
  'party mode facilitator',
  '@"party-mode-facilitator (agent)"',
  'party mode activated',
  'bmad-party-mode',
] as const;

const EXPLICIT_SELECTION_PATTERNS: Record<GateProfileId, readonly RegExp[]> = {
  quick_probe_20: [/\bquick_probe_20\b/iu, /\b20\s*rounds?\b/iu, /20\s*轮/iu],
  decision_root_cause_50: [/\bdecision_root_cause_50\b/iu, /\b50\s*rounds?\b/iu, /50\s*轮/iu],
  final_solution_task_list_100: [
    /\bfinal_solution_task_list_100\b/iu,
    /\b100\s*rounds?\b/iu,
    /100\s*轮/iu,
  ],
} as const;

const CONFIRMED_SELECTION_SECTION_PATTERNS = [
  /^\s*(?:##\s*)?用户选择(?:\s|$|[:：])/imu,
  /^\s*(?:##\s*)?User Selection(?:\s|$|[:：])/imu,
  /^\s*(?:##\s*)?User Choice(?:\s|$|[:：])/imu,
] as const;

const CONFIRMED_SELECTION_VALUE_PATTERNS: Record<GateProfileId, readonly RegExp[]> = {
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
} as const;

const USER_SELECTION_ACK_PATTERNS = [
  /用户(?:已)?选择/iu,
  /用户明确回复/iu,
  /确认[，,:：\s]*用户选择/iu,
  /已确认(?:用户)?选择/iu,
  /user(?:\s+has|\s+already)?\s+(?:selected|chose|confirmed)/iu,
  /confirmed\s+user\s+selection/iu,
] as const;

function includesAny(normalizedText: string, markers: readonly string[]): boolean {
  return markers.some((marker) => normalizedText.includes(marker));
}

export function requiresHighConfidenceFinalOutputs(inputText: string | undefined): boolean {
  return includesAny(String(inputText ?? '').toLowerCase(), HIGH_CONFIDENCE_FINAL_OUTPUT_MARKERS);
}

export function requestsQuickProbe(inputText: string | undefined): boolean {
  return includesAny(String(inputText ?? '').toLowerCase(), QUICK_PROBE_MARKERS);
}

export function isPartyModeFacilitatorIntent(inputText: string | undefined): boolean {
  return includesAny(
    String(inputText ?? '').toLowerCase(),
    PARTY_MODE_FACILITATOR_INTENT_MARKERS
  );
}

export function buildPartyModeContractViolationMessage(inputText: string | undefined): string {
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

export function inferGateProfileId(inputText: string | undefined): GateProfileId {
  if (requestsQuickProbe(inputText)) {
    return 'quick_probe_20';
  }
  if (requiresHighConfidenceFinalOutputs(inputText)) {
    return 'final_solution_task_list_100';
  }
  return 'decision_root_cause_50';
}

export function detectExplicitGateProfileMatches(inputText: string | undefined): GateProfileId[] {
  const text = String(inputText ?? '');
  return (Object.keys(EXPLICIT_SELECTION_PATTERNS) as GateProfileId[]).filter((profileId) =>
    EXPLICIT_SELECTION_PATTERNS[profileId].some((pattern) => pattern.test(text))
  );
}

export function detectExplicitGateProfileId(inputText: string | undefined): GateProfileId | null {
  const matches = detectExplicitGateProfileMatches(inputText);
  return matches.length === 1 ? matches[0] : null;
}

export function hasConfirmedUserSelectionBlock(inputText: string | undefined): boolean {
  const text = String(inputText ?? '');
  return CONFIRMED_SELECTION_SECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function detectConfirmedGateProfileId(inputText: string | undefined): GateProfileId | null {
  const text = String(inputText ?? '');
  if (!hasConfirmedUserSelectionBlock(text)) {
    return null;
  }
  const matches = (Object.keys(CONFIRMED_SELECTION_VALUE_PATTERNS) as GateProfileId[]).filter(
    (profileId) =>
      CONFIRMED_SELECTION_VALUE_PATTERNS[profileId].some((pattern) => pattern.test(text))
  );
  return matches.length === 1 ? matches[0] : null;
}

export function hasAcknowledgedUserSelection(inputText: string | undefined): boolean {
  const text = String(inputText ?? '');
  return USER_SELECTION_ACK_PATTERNS.some((pattern) => pattern.test(text));
}

const EMBEDDED_BOOTSTRAP_LABEL_PATTERNS = [
  /Party Mode Session Bootstrap \(JSON\)/iu,
  /Session Bootstrap \(JSON\)/iu,
] as const;

function extractBalancedJsonObject(source: string, startIndex: number): string | null {
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

export function extractEmbeddedBootstrapJson(
  inputText: string | undefined
): Record<string, unknown> | null {
  const text = String(inputText ?? '');
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
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore malformed embedded bootstrap blocks
    }
  }
  return null;
}

function describeRecommendedGateProfile(profileId: GateProfileId): string {
  switch (profileId) {
    case 'quick_probe_20':
      return '检测到 quick probe / 快速探查意图，推荐快速分析';
    case 'final_solution_task_list_100':
      return '当前请求指向最终方案 / 最终任务列表 / BUGFIX §7 / Story 定稿，推荐高置信完整方案';
    default:
      return '当前请求更像普通 RCA / 方案比较，推荐标准分析';
  }
}

export function buildIntensitySelectionPreflightMessage(inputText: string | undefined): string {
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

export function buildIntensitySelectionAskTemplate(inputText: string | undefined): string {
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

export function buildIntensitySelectionRetryTemplate(gateProfileId: GateProfileId): string {
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

export function buildStructuredSelectionNeedsConfirmationTemplate(
  gateProfileId: GateProfileId
): string {
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

export function resolveExplicitGateProfileSelection(
  providedGateProfileId: GateProfileId | undefined,
  inputText: string | undefined
): GateProfileId {
  const resolved = providedGateProfileId ?? detectExplicitGateProfileId(inputText);
  if (!resolved) {
    throw new Error(buildIntensitySelectionPreflightMessage(inputText));
  }
  assertGateProfileSelectionAllowed(resolved, inputText);
  return resolved;
}

export function resolveStructuredGateProfileSelection(
  providedGateProfileId: GateProfileId | undefined,
  inputText: string | undefined,
  options: { requireConfirmedBlock?: boolean } = {}
): GateProfileId {
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

  const resolved = providedGateProfileId ?? confirmed;
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

export function assertGateProfileSelectionAllowed(
  gateProfileId: GateProfileId,
  inputText: string | undefined
): void {
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

function parseNumber(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${flag}: ${value}`);
  }
  return parsed;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    overrides: {},
    writeSnapshot: false,
    writeConvergenceRecord: false,
    writeAuditVerdict: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    switch (token) {
      case '--session-key':
        options.sessionKey = next;
        index += 1;
        break;
      case '--meta-path':
        options.metaPath = next;
        index += 1;
        break;
      case '--session-log-path':
        options.sessionLogPath = next;
        index += 1;
        break;
      case '--min-rounds':
        options.overrides.minRounds = parseNumber(next, token);
        index += 1;
        break;
      case '--ratio-threshold':
        options.overrides.ratioThreshold = parseNumber(next, token);
        index += 1;
        break;
      case '--tail-window':
        options.overrides.tailWindow = parseNumber(next, token);
        index += 1;
        break;
      case '--write-snapshot':
        options.writeSnapshot = true;
        break;
      case '--write-convergence-record':
        options.writeConvergenceRecord = true;
        break;
      case '--write-audit-verdict':
        options.writeAuditVerdict = true;
        break;
      case '--write-all':
        options.writeSnapshot = true;
        options.writeConvergenceRecord = true;
        options.writeAuditVerdict = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return options;
}

export function normalizePath(targetPath: string): string {
  return targetPath.replace(/\\/g, '/');
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${field}: ${value}`);
  }
}

function sanitizeSummaryList(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => String(entry ?? '').trim())
    .filter((entry) => entry.length > 0);
}

function formatElapsedMs(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m${String(seconds).padStart(2, '0')}s`;
}

function formatCheckpointRound(round: number): string {
  assertPositiveInteger(round, 'round');
  return String(round).padStart(3, '0');
}

function assertTargetRoundsTotalMatchesProfile(
  targetRoundsTotal: number,
  gateProfileId: GateProfileId,
  profile: KnownGateProfile
): void {
  if (targetRoundsTotal !== profile.minRounds) {
    throw new Error(
      `target_rounds_total for ${gateProfileId} must match min_rounds (${profile.minRounds}), got ${targetRoundsTotal}`
    );
  }
}

function resolveBatchFields(
  input: StartSessionInput,
  existingMeta: SessionMeta | null,
  gateProfileId: GateProfileId,
  profile: KnownGateProfile
): Pick<
  SessionMeta,
  | 'batch_size'
  | 'current_batch_index'
  | 'current_batch_start_round'
  | 'current_batch_target_round'
  | 'target_rounds_total'
  | 'checkpoint_window_ms'
  | 'current_batch_status'
> {
  const batchSize = input.batchSize ?? existingMeta?.batch_size ?? DEFAULT_BATCH_SIZE;
  assertPositiveInteger(batchSize, 'batch_size');

  const targetRoundsTotal = input.targetRoundsTotal ?? existingMeta?.target_rounds_total ?? profile.minRounds;
  assertPositiveInteger(targetRoundsTotal, 'target_rounds_total');
  assertTargetRoundsTotalMatchesProfile(targetRoundsTotal, gateProfileId, profile);

  const batchIndex = input.batchIndex ?? existingMeta?.current_batch_index ?? 1;
  assertPositiveInteger(batchIndex, 'current_batch_index');

  const keepExistingRange =
    existingMeta != null &&
    input.batchIndex === undefined &&
    input.batchStartRound === undefined &&
    input.batchTargetRound === undefined &&
    existingMeta.current_batch_index === batchIndex;

  const computedBatchStartRound = (batchIndex - 1) * batchSize + 1;
  const batchStartRound =
    input.batchStartRound ??
    (keepExistingRange ? existingMeta?.current_batch_start_round : undefined) ??
    computedBatchStartRound;
  assertPositiveInteger(batchStartRound, 'current_batch_start_round');

  const defaultBatchTargetRound = Math.min(batchStartRound + batchSize - 1, targetRoundsTotal);
  const batchTargetRound =
    input.batchTargetRound ??
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
    input.checkpointWindowMs ?? existingMeta?.checkpoint_window_ms ?? DEFAULT_CHECKPOINT_WINDOW_MS;
  assertPositiveInteger(checkpointWindowMs, 'checkpoint_window_ms');

  return {
    batch_size: batchSize,
    current_batch_index: batchIndex,
    current_batch_start_round: batchStartRound,
    current_batch_target_round: batchTargetRound,
    target_rounds_total: targetRoundsTotal,
    checkpoint_window_ms: checkpointWindowMs,
    current_batch_status: input.currentBatchStatus ?? 'pending',
  };
}

export function derivePartyModeSessionPaths(
  projectRoot: string,
  sessionKey: string
): PartyModeSessionPaths {
  return {
    sessionLogPath: path.join(
      projectRoot,
      '_bmad-output',
      'party-mode',
      'sessions',
      `${sessionKey}.jsonl`
    ),
    metaPath: path.join(
      projectRoot,
      '_bmad-output',
      'party-mode',
      'sessions',
      `${sessionKey}.meta.json`
    ),
    snapshotPath: path.join(
      projectRoot,
      '_bmad-output',
      'party-mode',
      'snapshots',
      `${sessionKey}.latest.json`
    ),
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

export function deriveBatchCheckpointPaths(
  projectRoot: string,
  sessionKey: string,
  batchTargetRound: number
): BatchCheckpointPaths {
  const round = formatCheckpointRound(batchTargetRound);
  const root = path.join(projectRoot, '_bmad-output', 'party-mode', 'checkpoints');
  return {
    checkpointJsonPath: path.join(root, `${sessionKey}.round-${round}.json`),
    checkpointMarkdownPath: path.join(root, `${sessionKey}.round-${round}.md`),
    receiptPath: path.join(root, `${sessionKey}.round-${round}.receipt.json`),
  };
}

export function getAgentTurnCapabilityContract(): Pick<
  SessionMeta,
  | 'agent_turn_event_source_mode'
  | 'host_native_agent_turn_supported'
  | 'host_native_agent_turn_reason'
> {
  return {
    agent_turn_event_source_mode: AGENT_TURN_EVENT_SOURCE_MODE,
    host_native_agent_turn_supported: HOST_NATIVE_AGENT_TURN_SUPPORTED,
    host_native_agent_turn_reason: HOST_NATIVE_AGENT_TURN_REASON,
  };
}

export function deriveDefaultMetaPath(projectRoot: string, sessionKey: string): string {
  return derivePartyModeSessionPaths(projectRoot, sessionKey).metaPath;
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function readSessionLog(sessionLogPath: string): {
  turns: SessionTurn[];
  source: string;
  sha256: string;
} {
  const source = fs.existsSync(sessionLogPath) ? fs.readFileSync(sessionLogPath, 'utf8') : '';
  const lines = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const turns = lines.map((line) => JSON.parse(line) as SessionTurn);
  const sha256 = crypto.createHash('sha256').update(source).digest('hex');
  return { turns, source, sha256 };
}

export function assertKnownGateProfile(meta: SessionMeta): KnownGateProfile {
  const profile = KNOWN_GATE_PROFILES[meta.gate_profile_id as GateProfileId];
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
      `Meta gate profile mismatch for ${meta.gate_profile_id}: expected ${JSON.stringify(profile)}, got ${JSON.stringify(
        {
          minRounds: meta.min_rounds,
          ratioThreshold: meta.ratio_threshold,
          tailWindow: meta.tail_window,
          closureLevel: meta.closure_level ?? null,
        }
      )}`
    );
  }
  return profile;
}

export function assertOverrideMatchesMeta(
  overrides: CheckerOverrides,
  meta: SessionMeta,
  profile: KnownGateProfile
): void {
  const comparisons: Array<[number | undefined, number, string]> = [
    [overrides.minRounds, meta.min_rounds, 'min_rounds'],
    [overrides.ratioThreshold, meta.ratio_threshold, 'ratio_threshold'],
    [overrides.tailWindow, meta.tail_window, 'tail_window'],
  ];

  for (const [overrideValue, metaValue, field] of comparisons) {
    if (overrideValue !== undefined && overrideValue !== metaValue) {
      throw new Error(
        `CLI override for ${field} does not match .meta.json (${overrideValue} !== ${metaValue})`
      );
    }
  }

  if (
    meta.min_rounds !== profile.minRounds ||
    meta.ratio_threshold !== profile.ratioThreshold ||
    meta.tail_window !== profile.tailWindow
  ) {
    throw new Error('Gate profile contract mismatch between .meta.json and known profile table');
  }
}

export function computeGateResult(
  meta: SessionMeta,
  turns: SessionTurn[],
  sourceLogSha256: string
): GateResult {
  const profile = assertKnownGateProfile(meta);
  const matchingSessionTurns = turns.filter((turn) => turn.session_key === meta.session_key);
  const agentTurns = matchingSessionTurns.filter(
    (turn) =>
      (turn.record_type ?? 'agent_turn') === 'agent_turn' && typeof turn.speaker_id === 'string'
  );
  const countedTurns = agentTurns.filter((turn) => turn.counts_toward_ratio === true);
  const challengerTurns = countedTurns.filter(
    (turn) => turn.speaker_id === meta.designated_challenger_id
  );
  const tailTurns = countedTurns.slice(-meta.tail_window);
  const challengerRatio =
    countedTurns.length === 0 ? 0 : challengerTurns.length / countedTurns.length;
  const lastTailNoNewGap =
    tailTurns.length === meta.tail_window && tailTurns.every((turn) => turn.has_new_gap === false);

  const failedChecks: string[] = [];
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
    gate_profile_id: meta.gate_profile_id as GateProfileId,
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

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function writeJsonFile(filePath: string, payload: unknown): void {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function writeSnapshot(meta: SessionMeta, result: GateResult, sessionLogPath: string): void {
  if (!meta.snapshot_path) {
    return;
  }
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
  writeJsonFile(meta.snapshot_path, payload);
}

export function writeConvergenceRecord(meta: SessionMeta, result: GateResult): void {
  if (!meta.convergence_record_path) {
    return;
  }
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
  writeJsonFile(meta.convergence_record_path, payload);
}

export function writeAuditVerdict(meta: SessionMeta, result: GateResult): void {
  if (!meta.audit_verdict_path) {
    return;
  }
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
  writeJsonFile(meta.audit_verdict_path, payload);
}

export function startSession(projectRoot: string, input: StartSessionInput): SessionMeta {
  const profile = KNOWN_GATE_PROFILES[input.gateProfileId];
  assertGateProfileSelectionAllowed(input.gateProfileId, input.inputText);
  const paths = derivePartyModeSessionPaths(projectRoot, input.sessionKey);
  const now = new Date().toISOString();
  const existingMeta = fs.existsSync(paths.metaPath) ? readJsonFile<SessionMeta>(paths.metaPath) : null;
  if (existingMeta && existingMeta.gate_profile_id !== input.gateProfileId) {
    throw new Error(
      `Session ${input.sessionKey} already exists with gate_profile_id=${existingMeta.gate_profile_id}; cannot switch to ${input.gateProfileId}`
    );
  }
  const batchFields = resolveBatchFields(input, existingMeta, input.gateProfileId, profile);
  const meta: SessionMeta = {
    session_key: input.sessionKey,
    scenario_kind: input.scenarioKind ?? existingMeta?.scenario_kind ?? input.gateProfileId,
    gate_profile_id: input.gateProfileId,
    designated_challenger_id:
      input.designatedChallengerId ??
      existingMeta?.designated_challenger_id ??
      DEFAULT_DESIGNATED_CHALLENGER_ID,
    ...getAgentTurnCapabilityContract(),
    min_rounds: profile.minRounds,
    ratio_threshold: profile.ratioThreshold,
    tail_window: profile.tailWindow,
    closure_level: profile.closureLevel,
    ...batchFields,
    topic: input.topic ?? existingMeta?.topic ?? input.inputText,
    resolved_mode: input.resolvedMode ?? existingMeta?.resolved_mode,
    session_log_path: existingMeta?.session_log_path ?? normalizePath(paths.sessionLogPath),
    snapshot_path: existingMeta?.snapshot_path ?? normalizePath(paths.snapshotPath),
    convergence_record_path:
      existingMeta?.convergence_record_path ?? normalizePath(paths.convergenceRecordPath),
    audit_verdict_path: existingMeta?.audit_verdict_path ?? normalizePath(paths.auditVerdictPath),
    created_at: existingMeta?.created_at ?? now,
    updated_at: now,
  };
  writeJsonFile(paths.metaPath, meta);
  const checkpointPaths = deriveBatchCheckpointPaths(
    projectRoot,
    input.sessionKey,
    meta.current_batch_target_round as number
  );
  paths.currentBatchCheckpointJsonPath = checkpointPaths.checkpointJsonPath;
  paths.currentBatchCheckpointMarkdownPath = checkpointPaths.checkpointMarkdownPath;
  paths.currentBatchReceiptPath = checkpointPaths.receiptPath;
  ensureParentDir(paths.sessionLogPath);
  if (!fs.existsSync(paths.sessionLogPath)) {
    fs.writeFileSync(paths.sessionLogPath, '', 'utf8');
  }
  return meta;
}

export function loadMetaAndLog(
  projectRoot: string,
  options: Pick<CliOptions, 'metaPath' | 'sessionKey' | 'sessionLogPath' | 'overrides'>
): {
  meta: SessionMeta;
  sessionLogPath: string;
  sourceLogSha256: string;
  turns: SessionTurn[];
} {
  const metaPath =
    options.metaPath ??
    (options.sessionKey ? deriveDefaultMetaPath(projectRoot, options.sessionKey) : undefined);
  if (!metaPath) {
    throw new Error('Missing required --session-key or --meta-path');
  }

  const meta = readJsonFile<SessionMeta>(metaPath);
  const profile = assertKnownGateProfile(meta);
  assertOverrideMatchesMeta(options.overrides, meta, profile);

  const sessionLogPath =
    options.sessionLogPath ??
    meta.session_log_path ??
    path.join(path.dirname(metaPath), `${meta.session_key}.jsonl`);
  if (!fs.existsSync(sessionLogPath)) {
    throw new Error(`Session log not found: ${sessionLogPath}`);
  }

  const { turns, sha256 } = readSessionLog(sessionLogPath);
  return { meta, sessionLogPath, sourceLogSha256: sha256, turns };
}

export function evaluateGate(projectRoot: string, sessionKey: string): GateResult {
  const { meta, sourceLogSha256, turns } = loadMetaAndLog(projectRoot, {
    sessionKey,
    overrides: {},
  });
  return computeGateResult(meta, turns, sourceLogSha256);
}

export function appendTurn(projectRoot: string, turn: SessionTurn): GateResult {
  const paths = derivePartyModeSessionPaths(projectRoot, turn.session_key);
  const meta = readJsonFile<SessionMeta>(paths.metaPath);
  ensureParentDir(paths.sessionLogPath);
  fs.appendFileSync(
    paths.sessionLogPath,
    `${JSON.stringify({ record_type: 'agent_turn', ...turn })}\n`,
    'utf8'
  );
  const result = evaluateGate(projectRoot, turn.session_key);
  writeSnapshot(meta, result, paths.sessionLogPath);
  maybeMaterializeCheckpointArtifacts(projectRoot, meta, result);
  return result;
}

export function appendControlRecord(projectRoot: string, record: SessionControlRecord): void {
  if (record.record_type === 'agent_turn') {
    throw new Error('Control records must not use record_type = "agent_turn"');
  }
  if (record.counts_toward_ratio !== false) {
    throw new Error('Control records must set counts_toward_ratio = false');
  }
  const paths = derivePartyModeSessionPaths(projectRoot, record.session_key);
  ensureParentDir(paths.sessionLogPath);
  fs.appendFileSync(
    paths.sessionLogPath,
    `${JSON.stringify({
      session_key: record.session_key,
      record_type: record.record_type,
      counts_toward_ratio: false,
      timestamp: record.timestamp ?? new Date().toISOString(),
      ...(record.payload ? { payload: record.payload } : {}),
    })}\n`,
    'utf8'
  );
}

export function recoverSession(projectRoot: string, sessionKey: string): RecoveryResult {
  const paths = derivePartyModeSessionPaths(projectRoot, sessionKey);
  const meta = readJsonFile<SessionMeta>(paths.metaPath);
  const result = evaluateGate(projectRoot, sessionKey);
  let snapshotMatchesLog = false;
  if (fs.existsSync(paths.snapshotPath)) {
    const snapshot = readJsonFile<{ source_log_sha256?: string }>(paths.snapshotPath);
    snapshotMatchesLog = snapshot.source_log_sha256 === result.source_log_sha256;
  }
  return { meta, result, snapshotMatchesLog };
}

function readSessionMeta(projectRoot: string, sessionKey: string): SessionMeta {
  return readJsonFile<SessionMeta>(derivePartyModeSessionPaths(projectRoot, sessionKey).metaPath);
}

function writeSessionMeta(projectRoot: string, sessionKey: string, meta: SessionMeta): SessionMeta {
  const metaPath = derivePartyModeSessionPaths(projectRoot, sessionKey).metaPath;
  writeJsonFile(metaPath, meta);
  return meta;
}

function assertCurrentBatchState(meta: SessionMeta): Required<
  Pick<
    SessionMeta,
    | 'batch_size'
    | 'current_batch_index'
    | 'current_batch_start_round'
    | 'current_batch_target_round'
    | 'target_rounds_total'
    | 'checkpoint_window_ms'
    | 'current_batch_status'
  >
> {
  const requiredFields = [
    'batch_size',
    'current_batch_index',
    'current_batch_start_round',
    'current_batch_target_round',
    'target_rounds_total',
    'checkpoint_window_ms',
    'current_batch_status',
  ] as const;

  for (const field of requiredFields) {
    if (meta[field] === undefined || meta[field] === null) {
      throw new Error(`Missing batch state field in .meta.json: ${field}`);
    }
  }

  return {
    batch_size: meta.batch_size as number,
    current_batch_index: meta.current_batch_index as number,
    current_batch_start_round: meta.current_batch_start_round as number,
    current_batch_target_round: meta.current_batch_target_round as number,
    target_rounds_total: meta.target_rounds_total as number,
    checkpoint_window_ms: meta.checkpoint_window_ms as number,
    current_batch_status: meta.current_batch_status as BatchCommitStatus,
  };
}

function assertCheckpointEligible(
  sessionKey: string,
  batchState: ReturnType<typeof assertCurrentBatchState>,
  result: GateResult
): void {
  if (result.rounds < batchState.current_batch_target_round) {
    throw new Error(
      `Cannot write checkpoint for ${sessionKey} before batch target round ${batchState.current_batch_target_round} is reached`
    );
  }
}

function buildCheckpointArtifact(
  meta: SessionMeta,
  batchState: ReturnType<typeof assertCurrentBatchState>,
  result: GateResult,
  summary: FacilitatorCheckpointSummaryInput = {}
): BatchCheckpointArtifact {
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

function renderCheckpointMarkdown(artifact: BatchCheckpointArtifact): string {
  const list = (items: string[]): string => (items.length > 0 ? items.join(' | ') : '(none)');
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

export function writeBatchReceipt(projectRoot: string, sessionKey: string): BatchCheckpointPaths {
  const meta = readSessionMeta(projectRoot, sessionKey);
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
  writeJsonFile(checkpointPaths.receiptPath, payload);
  return checkpointPaths;
}

export function writeCheckpointArtifacts(
  projectRoot: string,
  sessionKey: string,
  summary: FacilitatorCheckpointSummaryInput = {}
): BatchCheckpointPaths {
  const meta = readSessionMeta(projectRoot, sessionKey);
  const batchState = assertCurrentBatchState(meta);
  const result = evaluateGate(projectRoot, sessionKey);
  const checkpointPaths = deriveBatchCheckpointPaths(
    projectRoot,
    sessionKey,
    batchState.current_batch_target_round
  );
  const artifact = buildCheckpointArtifact(meta, batchState, result, summary);
  writeJsonFile(checkpointPaths.checkpointJsonPath, artifact);
  ensureParentDir(checkpointPaths.checkpointMarkdownPath);
  fs.writeFileSync(checkpointPaths.checkpointMarkdownPath, renderCheckpointMarkdown(artifact), 'utf8');
  return checkpointPaths;
}

export function buildCheckpointWindowState(meta: SessionMeta): CheckpointWindowState {
  const batchState = assertCurrentBatchState(meta);
  return {
    checkpoint_window_ms: batchState.checkpoint_window_ms,
    default_behavior: 'auto_continue_next_batch',
    allowed_commands: ['S', 'F', 'C'],
    facilitator_owns_heartbeat: true,
    main_agent_displays_checkpoint: true,
  };
}

export function buildContinueImmediateAcknowledgement(): string {
  return '已确认继续，立即进入下一批';
}

export function resolveCheckpointWindowTimeout(meta: SessionMeta): CheckpointWindowEvaluation {
  buildCheckpointWindowState(meta);
  return {
    accepted: true,
    resolution: 'auto_continue_after_timeout',
    normalized_input: '',
    closes_window: true,
    cancels_window_timer: false,
    skip_remaining_window_ms: false,
    stop_auto_continue: false,
    treat_as_business_context: false,
    acknowledgement: 'checkpoint 窗口无输入，自动继续下一批',
  };
}

export function evaluateCheckpointWindowInput(
  rawInput: string | undefined,
  inCheckpointWindow: boolean
): CheckpointWindowEvaluation {
  const normalizedInput = String(rawInput ?? '').trim();
  const upper = normalizedInput.toUpperCase();
  const isControl = upper === 'S' || upper === 'F' || upper === 'C';

  if (!normalizedInput) {
    return {
      accepted: false,
      resolution: 'wait_for_input',
      normalized_input: '',
      closes_window: false,
      cancels_window_timer: false,
      skip_remaining_window_ms: false,
      stop_auto_continue: false,
      treat_as_business_context: false,
      acknowledgement: '等待 checkpoint 窗口输入',
    };
  }

  if (!inCheckpointWindow) {
    if (isControl) {
      return {
        accepted: false,
        resolution: 'reject_outside_window',
        normalized_input: upper,
        closes_window: false,
        cancels_window_timer: false,
        skip_remaining_window_ms: false,
        stop_auto_continue: false,
        treat_as_business_context: false,
        acknowledgement: '当前不在 checkpoint 窗口，指令未生效',
      };
    }
    return {
      accepted: true,
      resolution: 'replan_before_next_batch',
      normalized_input,
      closes_window: true,
      cancels_window_timer: false,
      skip_remaining_window_ms: false,
      stop_auto_continue: true,
      treat_as_business_context: true,
      acknowledgement: '收到新的业务补充，将按新上下文重新编排',
    };
  }

  if (upper === 'S') {
    return {
      accepted: true,
      resolution: 'stop_and_output_current_conclusion',
      normalized_input: upper,
      closes_window: true,
      cancels_window_timer: true,
      skip_remaining_window_ms: false,
      stop_auto_continue: true,
      treat_as_business_context: false,
      acknowledgement: '已确认停止，并输出当前结论',
    };
  }
  if (upper === 'F') {
    return {
      accepted: true,
      resolution: 'finalize_current_deliverable',
      normalized_input: upper,
      closes_window: true,
      cancels_window_timer: true,
      skip_remaining_window_ms: false,
      stop_auto_continue: true,
      treat_as_business_context: false,
      acknowledgement: '已确认提前收束为当前可交付结论',
    };
  }
  if (upper === 'C') {
    return {
      accepted: true,
      resolution: 'continue_immediately',
      normalized_input: upper,
      closes_window: true,
      cancels_window_timer: true,
      skip_remaining_window_ms: true,
      stop_auto_continue: false,
      treat_as_business_context: false,
      acknowledgement: buildContinueImmediateAcknowledgement(),
    };
  }

  return {
    accepted: true,
    resolution: 'replan_before_next_batch',
    normalized_input: normalizedInput,
    closes_window: true,
    cancels_window_timer: true,
    skip_remaining_window_ms: false,
    stop_auto_continue: true,
    treat_as_business_context: true,
    acknowledgement: '收到新的业务补充，将在下一批前重新编排',
  };
}

export function createFacilitatorHeartbeat(input: {
  currentRoundInBatch: number;
  batchSize: number;
  elapsedMs: number;
}): FacilitatorHeartbeatRecord {
  assertPositiveInteger(input.currentRoundInBatch, 'currentRoundInBatch');
  assertPositiveInteger(input.batchSize, 'batchSize');
  return {
    authority: 'facilitator',
    record_type: 'heartbeat',
    counts_toward_ratio: false,
    elapsed_ms: input.elapsedMs,
    message: `Party-Mode 仍在进行中：当前批次 ${input.currentRoundInBatch}/${input.batchSize}，已运行 ${formatElapsedMs(input.elapsedMs)}`,
  };
}

function maybeMaterializeCheckpointArtifacts(
  projectRoot: string,
  meta: SessionMeta,
  result: GateResult
): void {
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

export function markBatchCheckpointReady(projectRoot: string, sessionKey: string): SessionMeta {
  const meta = readSessionMeta(projectRoot, sessionKey);
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
  const nextMeta: SessionMeta = {
    ...meta,
    current_batch_status: 'checkpoint_ready',
    updated_at: new Date().toISOString(),
  };
  return writeSessionMeta(projectRoot, sessionKey, nextMeta);
}

export function markBatchCompleted(projectRoot: string, sessionKey: string): SessionMeta {
  const meta = readSessionMeta(projectRoot, sessionKey);
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
  const nextMeta: SessionMeta = {
    ...meta,
    current_batch_status: 'completed',
    updated_at: new Date().toISOString(),
  };
  return writeSessionMeta(projectRoot, sessionKey, nextMeta);
}

export function recoverBatchProgress(projectRoot: string, sessionKey: string): BatchRecoveryResult {
  const meta = readSessionMeta(projectRoot, sessionKey);
  const batchState = assertCurrentBatchState(meta);
  const checkpointPaths = deriveBatchCheckpointPaths(
    projectRoot,
    sessionKey,
    batchState.current_batch_target_round
  );
  const hasCheckpointArtifacts =
    fs.existsSync(checkpointPaths.checkpointJsonPath) && fs.existsSync(checkpointPaths.checkpointMarkdownPath);
  const hasReceipt = fs.existsSync(checkpointPaths.receiptPath);

  let action: BatchRecoveryAction;
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
  const nextBatchIndex =
    nextBatchStartRound == null ? null : batchState.current_batch_index + 1;
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

export function finalizeEvidence(projectRoot: string, sessionKey: string): GateResult {
  const paths = derivePartyModeSessionPaths(projectRoot, sessionKey);
  const meta = readJsonFile<SessionMeta>(paths.metaPath);
  const result = evaluateGate(projectRoot, sessionKey);
  writeConvergenceRecord(meta, result);
  writeAuditVerdict(meta, result);
  return result;
}

export function runCli(argv: string[], projectRoot: string = process.cwd()): GateResult {
  const options = parseArgs(argv);
  const { meta, sessionLogPath, sourceLogSha256, turns } = loadMetaAndLog(projectRoot, options);
  const result = computeGateResult(meta, turns, sourceLogSha256);

  if (options.writeSnapshot) {
    writeSnapshot(meta, result, sessionLogPath);
  }
  if (options.writeConvergenceRecord) {
    writeConvergenceRecord(meta, result);
  }
  if (options.writeAuditVerdict) {
    writeAuditVerdict(meta, result);
  }

  return result;
}
