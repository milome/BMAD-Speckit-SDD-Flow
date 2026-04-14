import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type GateProfileId = 'final_solution_task_list_100' | 'decision_root_cause_50';

export interface KnownGateProfile {
  minRounds: number;
  ratioThreshold: number;
  tailWindow: number;
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
}

export interface StartSessionInput {
  sessionKey: string;
  gateProfileId: GateProfileId;
  designatedChallengerId?: string;
  scenarioKind?: string;
}

export interface RecoveryResult {
  meta: SessionMeta;
  result: GateResult;
  snapshotMatchesLog: boolean;
}

export type AgentTurnEventSourceMode = 'explicit_event_writer_bridge';

export const DEFAULT_DESIGNATED_CHALLENGER_ID = 'adversarial-reviewer' as const;
export const AGENT_TURN_EVENT_SOURCE_MODE = 'explicit_event_writer_bridge' as const;
export const HOST_NATIVE_AGENT_TURN_SUPPORTED = false;
export const HOST_NATIVE_AGENT_TURN_REASON =
  'Current host hook surfaces expose session/subagent/tool boundaries only; no native per-turn agent-turn event is available.';

export const KNOWN_GATE_PROFILES: Record<GateProfileId, KnownGateProfile> = {
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
    meta.tail_window !== profile.tailWindow
  ) {
    throw new Error(
      `Meta gate profile mismatch for ${meta.gate_profile_id}: expected ${JSON.stringify(profile)}, got ${JSON.stringify(
        {
          minRounds: meta.min_rounds,
          ratioThreshold: meta.ratio_threshold,
          tailWindow: meta.tail_window,
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
  const paths = derivePartyModeSessionPaths(projectRoot, input.sessionKey);
  const now = new Date().toISOString();
  const meta: SessionMeta = {
    session_key: input.sessionKey,
    scenario_kind: input.scenarioKind ?? input.gateProfileId,
    gate_profile_id: input.gateProfileId,
    designated_challenger_id: input.designatedChallengerId ?? DEFAULT_DESIGNATED_CHALLENGER_ID,
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
  writeJsonFile(paths.metaPath, meta);
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
  return result;
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
