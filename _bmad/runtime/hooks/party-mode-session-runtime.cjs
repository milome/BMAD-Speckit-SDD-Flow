#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const KNOWN_GATE_PROFILES = {
  final_solution_task_list_100: {
    minRounds: 100,
    ratioThreshold: 0.6,
    tailWindow: 3,
  },
  decision_root_cause_50: {
    minRounds: 50,
    ratioThreshold: 0.6,
    tailWindow: 3,
  },
};

const DEFAULT_DESIGNATED_CHALLENGER_ID = 'adversarial-reviewer';
const AGENT_TURN_EVENT_SOURCE_MODE = 'explicit_event_writer_bridge';
const HOST_NATIVE_AGENT_TURN_SUPPORTED = false;
const HOST_NATIVE_AGENT_TURN_REASON =
  'Current host hook surfaces expose session/subagent/tool boundaries only; no native per-turn agent-turn event is available.';

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

function getAgentTurnCapabilityContract() {
  return {
    agent_turn_event_source_mode: AGENT_TURN_EVENT_SOURCE_MODE,
    host_native_agent_turn_supported: HOST_NATIVE_AGENT_TURN_SUPPORTED,
    host_native_agent_turn_reason: HOST_NATIVE_AGENT_TURN_REASON,
  };
}

function inferGateProfileId(inputText) {
  const text = String(inputText || '').toLowerCase();
  if (
    text.includes('§7') ||
    text.includes('task list') ||
    text.includes('任务列表') ||
    text.includes('最终方案') ||
    text.includes('bugfix') ||
    text.includes('create story')
  ) {
    return 'final_solution_task_list_100';
  }
  return 'decision_root_cause_50';
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
    raw.includes('party-mode-facilitator') ||
    raw.includes('bmad-party-mode') ||
    raw.includes('_bmad/core/skills/bmad-party-mode/steps/step-02-discussion-orchestration')
  );
}

function bootstrapSession(projectRoot, options) {
  const sessionKey =
    options.sessionKey ||
    `pm-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const gateProfileId = options.gateProfileId || inferGateProfileId(options.inputText);
  const profile = KNOWN_GATE_PROFILES[gateProfileId];
  if (!profile) {
    throw new Error(`Unknown gate profile: ${gateProfileId}`);
  }
  const paths = deriveSessionPaths(projectRoot, sessionKey);
  const now = new Date().toISOString();
  const meta = {
    session_key: sessionKey,
    scenario_kind: gateProfileId,
    gate_profile_id: gateProfileId,
    designated_challenger_id:
      options.designatedChallengerId || DEFAULT_DESIGNATED_CHALLENGER_ID,
    ...getAgentTurnCapabilityContract(),
    min_rounds: profile.minRounds,
    ratio_threshold: profile.ratioThreshold,
    tail_window: profile.tailWindow,
    session_log_path: normalizePath(paths.sessionLogPath),
    snapshot_path: normalizePath(paths.snapshotPath),
    convergence_record_path: normalizePath(paths.convergenceRecordPath),
    audit_verdict_path: normalizePath(paths.auditVerdictPath),
    created_at: now,
    updated_at: now,
  };
  writeJson(paths.metaPath, meta);
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
  return { refreshed: true, result };
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
  computeGate,
  getAgentTurnCapabilityContract,
  deriveSessionPaths,
  extractSubagentText,
  inferGateProfileId,
  isPartyModeFacilitatorStart,
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
