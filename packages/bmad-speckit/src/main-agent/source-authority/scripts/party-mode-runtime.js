"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_GATE_PROFILES = exports.DEFAULT_CHECKPOINT_WINDOW_MS = exports.DEFAULT_BATCH_SIZE = exports.HOST_NATIVE_AGENT_TURN_REASON = exports.HOST_NATIVE_AGENT_TURN_SUPPORTED = exports.AGENT_TURN_EVENT_SOURCE_MODE = exports.DEFAULT_DESIGNATED_CHALLENGER_ID = void 0;
exports.requiresHighConfidenceFinalOutputs = requiresHighConfidenceFinalOutputs;
exports.requestsQuickProbe = requestsQuickProbe;
exports.isPartyModeFacilitatorIntent = isPartyModeFacilitatorIntent;
exports.buildPartyModeContractViolationMessage = buildPartyModeContractViolationMessage;
exports.inferGateProfileId = inferGateProfileId;
exports.detectExplicitGateProfileMatches = detectExplicitGateProfileMatches;
exports.detectExplicitGateProfileId = detectExplicitGateProfileId;
exports.hasConfirmedUserSelectionBlock = hasConfirmedUserSelectionBlock;
exports.detectConfirmedGateProfileId = detectConfirmedGateProfileId;
exports.hasAcknowledgedUserSelection = hasAcknowledgedUserSelection;
exports.extractEmbeddedBootstrapJson = extractEmbeddedBootstrapJson;
exports.buildIntensitySelectionPreflightMessage = buildIntensitySelectionPreflightMessage;
exports.buildIntensitySelectionAskTemplate = buildIntensitySelectionAskTemplate;
exports.buildIntensitySelectionRetryTemplate = buildIntensitySelectionRetryTemplate;
exports.buildStructuredSelectionNeedsConfirmationTemplate = buildStructuredSelectionNeedsConfirmationTemplate;
exports.resolveExplicitGateProfileSelection = resolveExplicitGateProfileSelection;
exports.resolveStructuredGateProfileSelection = resolveStructuredGateProfileSelection;
exports.assertGateProfileSelectionAllowed = assertGateProfileSelectionAllowed;
exports.parseArgs = parseArgs;
exports.normalizePath = normalizePath;
exports.derivePartyModeSessionPaths = derivePartyModeSessionPaths;
exports.deriveBatchCheckpointPaths = deriveBatchCheckpointPaths;
exports.getAgentTurnCapabilityContract = getAgentTurnCapabilityContract;
exports.deriveDefaultMetaPath = deriveDefaultMetaPath;
exports.readJsonFile = readJsonFile;
exports.readSessionLog = readSessionLog;
exports.assertKnownGateProfile = assertKnownGateProfile;
exports.assertOverrideMatchesMeta = assertOverrideMatchesMeta;
exports.computeGateResult = computeGateResult;
exports.writeJsonFile = writeJsonFile;
exports.writeSnapshot = writeSnapshot;
exports.writeConvergenceRecord = writeConvergenceRecord;
exports.writeAuditVerdict = writeAuditVerdict;
exports.startSession = startSession;
exports.loadMetaAndLog = loadMetaAndLog;
exports.evaluateGate = evaluateGate;
exports.appendTurn = appendTurn;
exports.appendControlRecord = appendControlRecord;
exports.recoverSession = recoverSession;
exports.writeBatchReceipt = writeBatchReceipt;
exports.writeCheckpointArtifacts = writeCheckpointArtifacts;
exports.buildCheckpointWindowState = buildCheckpointWindowState;
exports.buildContinueImmediateAcknowledgement = buildContinueImmediateAcknowledgement;
exports.resolveCheckpointWindowTimeout = resolveCheckpointWindowTimeout;
exports.evaluateCheckpointWindowInput = evaluateCheckpointWindowInput;
exports.createFacilitatorHeartbeat = createFacilitatorHeartbeat;
exports.markBatchCheckpointReady = markBatchCheckpointReady;
exports.markBatchCompleted = markBatchCompleted;
exports.recoverBatchProgress = recoverBatchProgress;
exports.finalizeEvidence = finalizeEvidence;
exports.runCli = runCli;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
exports.DEFAULT_DESIGNATED_CHALLENGER_ID = 'adversarial-reviewer';
exports.AGENT_TURN_EVENT_SOURCE_MODE = 'explicit_event_writer_bridge';
exports.HOST_NATIVE_AGENT_TURN_SUPPORTED = false;
exports.HOST_NATIVE_AGENT_TURN_REASON = 'Current host hook surfaces expose session/subagent/tool boundaries only; no native per-turn agent-turn event is available.';
exports.DEFAULT_BATCH_SIZE = 20;
exports.DEFAULT_CHECKPOINT_WINDOW_MS = 15_000;
exports.KNOWN_GATE_PROFILES = {
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
function includesAny(normalizedText, markers) {
    return markers.some((marker) => normalizedText.includes(marker));
}
function requiresHighConfidenceFinalOutputs(inputText) {
    return includesAny(String(inputText ?? '').toLowerCase(), HIGH_CONFIDENCE_FINAL_OUTPUT_MARKERS);
}
function requestsQuickProbe(inputText) {
    return includesAny(String(inputText ?? '').toLowerCase(), QUICK_PROBE_MARKERS);
}
function isPartyModeFacilitatorIntent(inputText) {
    return includesAny(String(inputText ?? '').toLowerCase(), PARTY_MODE_FACILITATOR_INTENT_MARKERS);
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
    const text = String(inputText ?? '');
    return Object.keys(EXPLICIT_SELECTION_PATTERNS).filter((profileId) => EXPLICIT_SELECTION_PATTERNS[profileId].some((pattern) => pattern.test(text)));
}
function detectExplicitGateProfileId(inputText) {
    const matches = detectExplicitGateProfileMatches(inputText);
    return matches.length === 1 ? matches[0] : null;
}
function hasConfirmedUserSelectionBlock(inputText) {
    const text = String(inputText ?? '');
    return CONFIRMED_SELECTION_SECTION_PATTERNS.some((pattern) => pattern.test(text));
}
function detectConfirmedGateProfileId(inputText) {
    const text = String(inputText ?? '');
    if (!hasConfirmedUserSelectionBlock(text)) {
        return null;
    }
    const matches = Object.keys(CONFIRMED_SELECTION_VALUE_PATTERNS).filter((profileId) => CONFIRMED_SELECTION_VALUE_PATTERNS[profileId].some((pattern) => pattern.test(text)));
    return matches.length === 1 ? matches[0] : null;
}
function hasAcknowledgedUserSelection(inputText) {
    const text = String(inputText ?? '');
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
            }
            else if (ch === '\\') {
                escaped = true;
            }
            else if (ch === '"') {
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
        }
        else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(startIndex, index + 1);
            }
        }
    }
    return null;
}
function extractEmbeddedBootstrapJson(inputText) {
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
                return parsed;
            }
        }
        catch {
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
    const ambiguityLine = matches.length > 1
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
    const profileLabel = gateProfileId === 'quick_probe_20'
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
    const profileLabel = gateProfileId === 'quick_probe_20'
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
function resolveExplicitGateProfileSelection(providedGateProfileId, inputText) {
    const resolved = providedGateProfileId ?? detectExplicitGateProfileId(inputText);
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
                throw new Error(`Structured gate profile ${providedGateProfileId} mismatches confirmed user selection ${confirmed}`);
            }
            assertGateProfileSelectionAllowed(confirmed, inputText);
            return confirmed;
        }
        if (providedGateProfileId) {
            assertGateProfileSelectionAllowed(providedGateProfileId, inputText);
        }
        const explicit = detectExplicitGateProfileId(inputText);
        if (explicit) {
            assertGateProfileSelectionAllowed(explicit, inputText);
        }
        if (providedGateProfileId) {
            throw new Error(buildStructuredSelectionNeedsConfirmationTemplate(providedGateProfileId));
        }
        if (explicit && hasAcknowledgedUserSelection(inputText)) {
            throw new Error(buildIntensitySelectionRetryTemplate(explicit));
        }
        throw new Error(buildIntensitySelectionAskTemplate(inputText));
    }
    const resolved = providedGateProfileId ?? confirmed;
    if (!resolved) {
        const explicit = detectExplicitGateProfileId(inputText);
        if (explicit) {
            assertGateProfileSelectionAllowed(explicit, inputText);
        }
        if (explicit && hasAcknowledgedUserSelection(inputText)) {
            throw new Error(buildIntensitySelectionRetryTemplate(explicit));
        }
        throw new Error(buildIntensitySelectionAskTemplate(inputText));
    }
    assertGateProfileSelectionAllowed(resolved, inputText);
    return resolved;
}
function assertGateProfileSelectionAllowed(gateProfileId, inputText) {
    const profile = exports.KNOWN_GATE_PROFILES[gateProfileId];
    if (!profile || !requiresHighConfidenceFinalOutputs(inputText)) {
        return;
    }
    if (profile.closureLevel !== 'high_confidence') {
        throw new Error(`Selected gate profile ${gateProfileId} only supports ${profile.closureLevel} closure; upgrade to final_solution_task_list_100 for high-confidence final outputs`);
    }
}
function parseNumber(value, flag) {
    if (value === undefined) {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid numeric value for ${flag}: ${value}`);
    }
    return parsed;
}
function parseArgs(argv) {
    const options = {
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
function normalizePath(targetPath) {
    return targetPath.replace(/\\/g, '/');
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
    return value.map((entry) => String(entry ?? '').trim()).filter((entry) => entry.length > 0);
}
function formatElapsedMs(elapsedMs) {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m${String(seconds).padStart(2, '0')}s`;
}
function formatCheckpointRound(round) {
    assertPositiveInteger(round, 'round');
    return String(round).padStart(3, '0');
}
function assertTargetRoundsTotalMatchesProfile(targetRoundsTotal, gateProfileId, profile) {
    if (targetRoundsTotal !== profile.minRounds) {
        throw new Error(`target_rounds_total for ${gateProfileId} must match min_rounds (${profile.minRounds}), got ${targetRoundsTotal}`);
    }
}
function resolveBatchFields(input, existingMeta, gateProfileId, profile) {
    const batchSize = input.batchSize ?? existingMeta?.batch_size ?? exports.DEFAULT_BATCH_SIZE;
    assertPositiveInteger(batchSize, 'batch_size');
    const targetRoundsTotal = input.targetRoundsTotal ?? existingMeta?.target_rounds_total ?? profile.minRounds;
    assertPositiveInteger(targetRoundsTotal, 'target_rounds_total');
    assertTargetRoundsTotalMatchesProfile(targetRoundsTotal, gateProfileId, profile);
    const batchIndex = input.batchIndex ?? existingMeta?.current_batch_index ?? 1;
    assertPositiveInteger(batchIndex, 'current_batch_index');
    const keepExistingRange = existingMeta != null &&
        input.batchIndex === undefined &&
        input.batchStartRound === undefined &&
        input.batchTargetRound === undefined &&
        existingMeta.current_batch_index === batchIndex;
    const computedBatchStartRound = (batchIndex - 1) * batchSize + 1;
    const batchStartRound = input.batchStartRound ??
        (keepExistingRange ? existingMeta?.current_batch_start_round : undefined) ??
        computedBatchStartRound;
    assertPositiveInteger(batchStartRound, 'current_batch_start_round');
    const defaultBatchTargetRound = Math.min(batchStartRound + batchSize - 1, targetRoundsTotal);
    const batchTargetRound = input.batchTargetRound ??
        (keepExistingRange ? existingMeta?.current_batch_target_round : undefined) ??
        defaultBatchTargetRound;
    assertPositiveInteger(batchTargetRound, 'current_batch_target_round');
    if (batchTargetRound < batchStartRound) {
        throw new Error(`Invalid batch range: current_batch_target_round (${batchTargetRound}) < current_batch_start_round (${batchStartRound})`);
    }
    if (batchTargetRound > targetRoundsTotal) {
        throw new Error(`Invalid batch range: current_batch_target_round (${batchTargetRound}) > target_rounds_total (${targetRoundsTotal})`);
    }
    const checkpointWindowMs = input.checkpointWindowMs ?? existingMeta?.checkpoint_window_ms ?? exports.DEFAULT_CHECKPOINT_WINDOW_MS;
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
function derivePartyModeSessionPaths(projectRoot, sessionKey) {
    return {
        sessionLogPath: path.join(projectRoot, '_bmad-output', 'party-mode', 'sessions', `${sessionKey}.jsonl`),
        metaPath: path.join(projectRoot, '_bmad-output', 'party-mode', 'sessions', `${sessionKey}.meta.json`),
        snapshotPath: path.join(projectRoot, '_bmad-output', 'party-mode', 'snapshots', `${sessionKey}.latest.json`),
        convergenceRecordPath: path.join(projectRoot, '_bmad-output', 'party-mode', 'evidence', `${sessionKey}.convergence.json`),
        auditVerdictPath: path.join(projectRoot, '_bmad-output', 'party-mode', 'evidence', `${sessionKey}.audit.json`),
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
        agent_turn_event_source_mode: exports.AGENT_TURN_EVENT_SOURCE_MODE,
        host_native_agent_turn_supported: exports.HOST_NATIVE_AGENT_TURN_SUPPORTED,
        host_native_agent_turn_reason: exports.HOST_NATIVE_AGENT_TURN_REASON,
    };
}
function deriveDefaultMetaPath(projectRoot, sessionKey) {
    return derivePartyModeSessionPaths(projectRoot, sessionKey).metaPath;
}
function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function readSessionLog(sessionLogPath) {
    const source = fs.existsSync(sessionLogPath) ? fs.readFileSync(sessionLogPath, 'utf8') : '';
    const lines = source
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    const turns = lines.map((line) => JSON.parse(line));
    const sha256 = crypto.createHash('sha256').update(source).digest('hex');
    return { turns, source, sha256 };
}
function assertKnownGateProfile(meta) {
    const profile = exports.KNOWN_GATE_PROFILES[meta.gate_profile_id];
    if (!profile) {
        throw new Error(`Unknown gate_profile_id: ${meta.gate_profile_id}`);
    }
    if (meta.min_rounds !== profile.minRounds ||
        meta.ratio_threshold !== profile.ratioThreshold ||
        meta.tail_window !== profile.tailWindow ||
        (meta.closure_level !== undefined && meta.closure_level !== profile.closureLevel)) {
        throw new Error(`Meta gate profile mismatch for ${meta.gate_profile_id}: expected ${JSON.stringify(profile)}, got ${JSON.stringify({
            minRounds: meta.min_rounds,
            ratioThreshold: meta.ratio_threshold,
            tailWindow: meta.tail_window,
            closureLevel: meta.closure_level ?? null,
        })}`);
    }
    return profile;
}
function assertOverrideMatchesMeta(overrides, meta, profile) {
    const comparisons = [
        [overrides.minRounds, meta.min_rounds, 'min_rounds'],
        [overrides.ratioThreshold, meta.ratio_threshold, 'ratio_threshold'],
        [overrides.tailWindow, meta.tail_window, 'tail_window'],
    ];
    for (const [overrideValue, metaValue, field] of comparisons) {
        if (overrideValue !== undefined && overrideValue !== metaValue) {
            throw new Error(`CLI override for ${field} does not match .meta.json (${overrideValue} !== ${metaValue})`);
        }
    }
    if (meta.min_rounds !== profile.minRounds ||
        meta.ratio_threshold !== profile.ratioThreshold ||
        meta.tail_window !== profile.tailWindow) {
        throw new Error('Gate profile contract mismatch between .meta.json and known profile table');
    }
}
function computeGateResult(meta, turns, sourceLogSha256) {
    const profile = assertKnownGateProfile(meta);
    const matchingSessionTurns = turns.filter((turn) => turn.session_key === meta.session_key);
    const agentTurns = matchingSessionTurns.filter((turn) => (turn.record_type ?? 'agent_turn') === 'agent_turn' && typeof turn.speaker_id === 'string');
    const countedTurns = agentTurns.filter((turn) => turn.counts_toward_ratio === true);
    const challengerTurns = countedTurns.filter((turn) => turn.speaker_id === meta.designated_challenger_id);
    const tailTurns = countedTurns.slice(-meta.tail_window);
    const challengerRatio = countedTurns.length === 0 ? 0 : challengerTurns.length / countedTurns.length;
    const lastTailNoNewGap = tailTurns.length === meta.tail_window && tailTurns.every((turn) => turn.has_new_gap === false);
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
function ensureParentDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}
function writeJsonFile(filePath, payload) {
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
function writeSnapshot(meta, result, sessionLogPath) {
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
function writeConvergenceRecord(meta, result) {
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
function writeAuditVerdict(meta, result) {
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
function startSession(projectRoot, input) {
    const profile = exports.KNOWN_GATE_PROFILES[input.gateProfileId];
    assertGateProfileSelectionAllowed(input.gateProfileId, input.inputText);
    const paths = derivePartyModeSessionPaths(projectRoot, input.sessionKey);
    const now = new Date().toISOString();
    const existingMeta = fs.existsSync(paths.metaPath)
        ? readJsonFile(paths.metaPath)
        : null;
    if (existingMeta && existingMeta.gate_profile_id !== input.gateProfileId) {
        throw new Error(`Session ${input.sessionKey} already exists with gate_profile_id=${existingMeta.gate_profile_id}; cannot switch to ${input.gateProfileId}`);
    }
    const batchFields = resolveBatchFields(input, existingMeta, input.gateProfileId, profile);
    const meta = {
        session_key: input.sessionKey,
        scenario_kind: input.scenarioKind ?? existingMeta?.scenario_kind ?? input.gateProfileId,
        gate_profile_id: input.gateProfileId,
        designated_challenger_id: input.designatedChallengerId ??
            existingMeta?.designated_challenger_id ??
            exports.DEFAULT_DESIGNATED_CHALLENGER_ID,
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
        convergence_record_path: existingMeta?.convergence_record_path ?? normalizePath(paths.convergenceRecordPath),
        audit_verdict_path: existingMeta?.audit_verdict_path ?? normalizePath(paths.auditVerdictPath),
        created_at: existingMeta?.created_at ?? now,
        updated_at: now,
    };
    writeJsonFile(paths.metaPath, meta);
    const checkpointPaths = deriveBatchCheckpointPaths(projectRoot, input.sessionKey, meta.current_batch_target_round);
    paths.currentBatchCheckpointJsonPath = checkpointPaths.checkpointJsonPath;
    paths.currentBatchCheckpointMarkdownPath = checkpointPaths.checkpointMarkdownPath;
    paths.currentBatchReceiptPath = checkpointPaths.receiptPath;
    ensureParentDir(paths.sessionLogPath);
    if (!fs.existsSync(paths.sessionLogPath)) {
        fs.writeFileSync(paths.sessionLogPath, '', 'utf8');
    }
    return meta;
}
function loadMetaAndLog(projectRoot, options) {
    const metaPath = options.metaPath ??
        (options.sessionKey ? deriveDefaultMetaPath(projectRoot, options.sessionKey) : undefined);
    if (!metaPath) {
        throw new Error('Missing required --session-key or --meta-path');
    }
    const meta = readJsonFile(metaPath);
    const profile = assertKnownGateProfile(meta);
    assertOverrideMatchesMeta(options.overrides, meta, profile);
    const sessionLogPath = options.sessionLogPath ??
        meta.session_log_path ??
        path.join(path.dirname(metaPath), `${meta.session_key}.jsonl`);
    if (!fs.existsSync(sessionLogPath)) {
        throw new Error(`Session log not found: ${sessionLogPath}`);
    }
    const { turns, sha256 } = readSessionLog(sessionLogPath);
    return { meta, sessionLogPath, sourceLogSha256: sha256, turns };
}
function evaluateGate(projectRoot, sessionKey) {
    const { meta, sourceLogSha256, turns } = loadMetaAndLog(projectRoot, {
        sessionKey,
        overrides: {},
    });
    return computeGateResult(meta, turns, sourceLogSha256);
}
function appendTurn(projectRoot, turn) {
    const paths = derivePartyModeSessionPaths(projectRoot, turn.session_key);
    const meta = readJsonFile(paths.metaPath);
    ensureParentDir(paths.sessionLogPath);
    fs.appendFileSync(paths.sessionLogPath, `${JSON.stringify({ record_type: 'agent_turn', ...turn })}\n`, 'utf8');
    const result = evaluateGate(projectRoot, turn.session_key);
    writeSnapshot(meta, result, paths.sessionLogPath);
    maybeMaterializeCheckpointArtifacts(projectRoot, meta, result);
    return result;
}
function appendControlRecord(projectRoot, record) {
    const recordType = String(record.record_type);
    if (recordType === 'agent_turn') {
        throw new Error('Control records must not use record_type = "agent_turn"');
    }
    if (record.counts_toward_ratio !== false) {
        throw new Error('Control records must set counts_toward_ratio = false');
    }
    const paths = derivePartyModeSessionPaths(projectRoot, record.session_key);
    ensureParentDir(paths.sessionLogPath);
    fs.appendFileSync(paths.sessionLogPath, `${JSON.stringify({
        session_key: record.session_key,
        record_type: record.record_type,
        counts_toward_ratio: false,
        timestamp: record.timestamp ?? new Date().toISOString(),
        ...(record.payload ? { payload: record.payload } : {}),
    })}\n`, 'utf8');
}
function recoverSession(projectRoot, sessionKey) {
    const paths = derivePartyModeSessionPaths(projectRoot, sessionKey);
    const meta = readJsonFile(paths.metaPath);
    const result = evaluateGate(projectRoot, sessionKey);
    let snapshotMatchesLog = false;
    if (fs.existsSync(paths.snapshotPath)) {
        const snapshot = readJsonFile(paths.snapshotPath);
        snapshotMatchesLog = snapshot.source_log_sha256 === result.source_log_sha256;
    }
    return { meta, result, snapshotMatchesLog };
}
function readSessionMeta(projectRoot, sessionKey) {
    return readJsonFile(derivePartyModeSessionPaths(projectRoot, sessionKey).metaPath);
}
function writeSessionMeta(projectRoot, sessionKey, meta) {
    const metaPath = derivePartyModeSessionPaths(projectRoot, sessionKey).metaPath;
    writeJsonFile(metaPath, meta);
    return meta;
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
        throw new Error(`Cannot write checkpoint for ${sessionKey} before batch target round ${batchState.current_batch_target_round} is reached`);
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
    const meta = readSessionMeta(projectRoot, sessionKey);
    const batchState = assertCurrentBatchState(meta);
    const checkpointPaths = deriveBatchCheckpointPaths(projectRoot, sessionKey, batchState.current_batch_target_round);
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
function writeCheckpointArtifacts(projectRoot, sessionKey, summary = {}) {
    const meta = readSessionMeta(projectRoot, sessionKey);
    const batchState = assertCurrentBatchState(meta);
    const result = evaluateGate(projectRoot, sessionKey);
    const checkpointPaths = deriveBatchCheckpointPaths(projectRoot, sessionKey, batchState.current_batch_target_round);
    const artifact = buildCheckpointArtifact(meta, batchState, result, summary);
    writeJsonFile(checkpointPaths.checkpointJsonPath, artifact);
    ensureParentDir(checkpointPaths.checkpointMarkdownPath);
    fs.writeFileSync(checkpointPaths.checkpointMarkdownPath, renderCheckpointMarkdown(artifact), 'utf8');
    return checkpointPaths;
}
function buildCheckpointWindowState(meta) {
    const batchState = assertCurrentBatchState(meta);
    return {
        checkpoint_window_ms: batchState.checkpoint_window_ms,
        default_behavior: 'auto_continue_next_batch',
        allowed_commands: ['S', 'F', 'C'],
        facilitator_owns_heartbeat: true,
        main_agent_displays_checkpoint: true,
    };
}
function buildContinueImmediateAcknowledgement() {
    return '已确认继续，立即进入下一批';
}
function resolveCheckpointWindowTimeout(meta) {
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
function evaluateCheckpointWindowInput(rawInput, inCheckpointWindow) {
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
            normalized_input: normalizedInput,
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
function createFacilitatorHeartbeat(input) {
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
function maybeMaterializeCheckpointArtifacts(projectRoot, meta, result) {
    const batchState = assertCurrentBatchState(meta);
    if (batchState.current_batch_status !== 'pending' ||
        result.rounds < batchState.current_batch_target_round) {
        return;
    }
    writeCheckpointArtifacts(projectRoot, meta.session_key);
    writeBatchReceipt(projectRoot, meta.session_key);
    markBatchCheckpointReady(projectRoot, meta.session_key);
}
function markBatchCheckpointReady(projectRoot, sessionKey) {
    const meta = readSessionMeta(projectRoot, sessionKey);
    const batchState = assertCurrentBatchState(meta);
    const checkpointPaths = deriveBatchCheckpointPaths(projectRoot, sessionKey, batchState.current_batch_target_round);
    if (!fs.existsSync(checkpointPaths.checkpointJsonPath) ||
        !fs.existsSync(checkpointPaths.checkpointMarkdownPath)) {
        throw new Error(`Cannot mark checkpoint_ready without checkpoint artifacts for batch ${batchState.current_batch_index}`);
    }
    if (!fs.existsSync(checkpointPaths.receiptPath)) {
        writeBatchReceipt(projectRoot, sessionKey);
    }
    const nextMeta = {
        ...meta,
        current_batch_status: 'checkpoint_ready',
        updated_at: new Date().toISOString(),
    };
    return writeSessionMeta(projectRoot, sessionKey, nextMeta);
}
function markBatchCompleted(projectRoot, sessionKey) {
    const meta = readSessionMeta(projectRoot, sessionKey);
    const batchState = assertCurrentBatchState(meta);
    const checkpointPaths = deriveBatchCheckpointPaths(projectRoot, sessionKey, batchState.current_batch_target_round);
    if (!fs.existsSync(checkpointPaths.checkpointJsonPath) ||
        !fs.existsSync(checkpointPaths.checkpointMarkdownPath) ||
        !fs.existsSync(checkpointPaths.receiptPath)) {
        throw new Error(`Cannot mark batch completed before checkpoint artifacts and receipt exist for batch ${batchState.current_batch_index}`);
    }
    const nextMeta = {
        ...meta,
        current_batch_status: 'completed',
        updated_at: new Date().toISOString(),
    };
    return writeSessionMeta(projectRoot, sessionKey, nextMeta);
}
function recoverBatchProgress(projectRoot, sessionKey) {
    const meta = readSessionMeta(projectRoot, sessionKey);
    const batchState = assertCurrentBatchState(meta);
    const checkpointPaths = deriveBatchCheckpointPaths(projectRoot, sessionKey, batchState.current_batch_target_round);
    const hasCheckpointArtifacts = fs.existsSync(checkpointPaths.checkpointJsonPath) &&
        fs.existsSync(checkpointPaths.checkpointMarkdownPath);
    const hasReceipt = fs.existsSync(checkpointPaths.receiptPath);
    let action;
    if (batchState.current_batch_status === 'checkpoint_ready') {
        action = 'replay_checkpoint';
    }
    else if (batchState.current_batch_status === 'completed') {
        action = 'advance_next_batch';
    }
    else {
        action = hasCheckpointArtifacts ? 'replay_checkpoint' : 'replay_current_batch';
    }
    const nextBatchStartRound = batchState.current_batch_target_round >= batchState.target_rounds_total
        ? null
        : batchState.current_batch_target_round + 1;
    const nextBatchIndex = nextBatchStartRound == null ? null : batchState.current_batch_index + 1;
    const nextBatchTargetRound = nextBatchStartRound == null
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
function finalizeEvidence(projectRoot, sessionKey) {
    const paths = derivePartyModeSessionPaths(projectRoot, sessionKey);
    const meta = readJsonFile(paths.metaPath);
    const result = evaluateGate(projectRoot, sessionKey);
    writeConvergenceRecord(meta, result);
    writeAuditVerdict(meta, result);
    return result;
}
function runCli(argv, projectRoot = process.cwd()) {
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
