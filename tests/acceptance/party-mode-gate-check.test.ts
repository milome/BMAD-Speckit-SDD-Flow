import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { KNOWN_GATE_PROFILES } from '../../scripts/party-mode-runtime';
import { runCli } from '../../scripts/party-mode-gate-check';

interface TempSessionOptions {
  gateProfileId?: string;
  minRounds?: number;
  ratioThreshold?: number;
  tailWindow?: number;
  rounds?: number;
  challengerRounds?: number;
  trailingNoGapRounds?: number;
}

function createTempSession(options: TempSessionOptions = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-gate-'));
  const sessionKey = 'pm-test-001';
  const sessionsDir = path.join(root, '_bmad-output', 'party-mode', 'sessions');
  const snapshotsDir = path.join(root, '_bmad-output', 'party-mode', 'snapshots');
  const evidenceDir = path.join(root, '_bmad-output', 'party-mode', 'evidence');
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });

  const gateProfileId = options.gateProfileId ?? 'final_solution_task_list_100';
  const profile = KNOWN_GATE_PROFILES[gateProfileId as keyof typeof KNOWN_GATE_PROFILES];
  const minRounds = options.minRounds ?? profile?.minRounds ?? 100;
  const ratioThreshold = options.ratioThreshold ?? 0.6;
  const tailWindow = options.tailWindow ?? 3;
  const rounds = options.rounds ?? minRounds;
  const challengerRounds = options.challengerRounds ?? Math.ceil(rounds * 0.7);
  const trailingNoGapRounds = options.trailingNoGapRounds ?? tailWindow;

  const metaPath = path.join(sessionsDir, `${sessionKey}.meta.json`);
  const logPath = path.join(sessionsDir, `${sessionKey}.jsonl`);
  const snapshotPath = path.join(snapshotsDir, `${sessionKey}.latest.json`);
  const convergencePath = path.join(evidenceDir, `${sessionKey}.convergence.json`);
  const auditPath = path.join(evidenceDir, `${sessionKey}.audit.json`);

  const meta = {
    session_key: sessionKey,
    scenario_kind: gateProfileId,
    gate_profile_id: gateProfileId,
    designated_challenger_id: 'critical-auditor',
    min_rounds: minRounds,
    ratio_threshold: ratioThreshold,
    tail_window: tailWindow,
    closure_level: profile?.closureLevel ?? 'high_confidence',
    session_log_path: logPath,
    snapshot_path: snapshotPath,
    convergence_record_path: convergencePath,
    audit_verdict_path: auditPath,
    created_at: '2026-04-14T00:00:00.000Z',
    updated_at: '2026-04-14T00:00:00.000Z',
  };
  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  const turns = Array.from({ length: rounds }, (_, index) => {
    const roundIndex = index + 1;
    const isChallenger = roundIndex <= challengerRounds;
    const noGap = roundIndex > rounds - trailingNoGapRounds;
    return {
      record_type: 'agent_turn',
      session_key: sessionKey,
      round_index: roundIndex,
      speaker_id: isChallenger ? 'critical-auditor' : 'architect',
      designated_challenger_id: 'critical-auditor',
      counts_toward_ratio: true,
      has_new_gap: !noGap && roundIndex % 7 === 0,
      timestamp: `2026-04-14T00:00:${String(roundIndex).padStart(2, '0')}.000Z`,
    };
  });
  fs.writeFileSync(logPath, `${turns.map((turn) => JSON.stringify(turn)).join('\n')}\n`, 'utf8');

  return {
    root,
    metaPath,
    logPath,
    snapshotPath,
    convergencePath,
    auditPath,
  };
}

describe('party-mode-gate-check', () => {
  it('passes the 100-round final-solution profile', () => {
    const temp = createTempSession({
      gateProfileId: 'final_solution_task_list_100',
      rounds: 100,
      challengerRounds: 70,
    });

    const result = runCli(['--session-key', 'pm-test-001'], temp.root);

    expect(result.gate_profile_id).toBe('final_solution_task_list_100');
    expect(result.rounds).toBe(100);
    expect(result.challenger_ratio).toBe(0.7);
    expect(result.gate_pass).toBe(true);
    expect(result.failed_checks).toEqual([]);
  });

  it('passes the 50-round decision/root-cause profile', () => {
    const temp = createTempSession({
      gateProfileId: 'decision_root_cause_50',
      rounds: 50,
      challengerRounds: 31,
    });

    const result = runCli(['--session-key', 'pm-test-001'], temp.root);

    expect(result.gate_profile_id).toBe('decision_root_cause_50');
    expect(result.rounds).toBe(50);
    expect(result.challenger_ratio).toBeCloseTo(31 / 50, 6);
    expect(result.gate_pass).toBe(true);
  });

  it('fails on unknown gate profile ids', () => {
    const temp = createTempSession({
      gateProfileId: 'unknown_profile',
      minRounds: 100,
    });

    expect(() => runCli(['--session-key', 'pm-test-001'], temp.root)).toThrow(
      /Unknown gate_profile_id/
    );
  });

  it('fails when CLI override disagrees with .meta.json', () => {
    const temp = createTempSession();

    expect(() => runCli(['--session-key', 'pm-test-001', '--min-rounds', '50'], temp.root)).toThrow(
      /does not match \.meta\.json/
    );
  });

  it('writes snapshot, convergence, and audit evidence files', () => {
    const temp = createTempSession();

    const result = runCli(['--session-key', 'pm-test-001', '--write-all'], temp.root);

    expect(result.gate_pass).toBe(true);
    expect(fs.existsSync(temp.snapshotPath)).toBe(true);
    expect(fs.existsSync(temp.convergencePath)).toBe(true);
    expect(fs.existsSync(temp.auditPath)).toBe(true);

    const snapshot = JSON.parse(fs.readFileSync(temp.snapshotPath, 'utf8')) as {
      gate_profile_id: string;
      closure_level: string;
      derived_rounds: number;
    };
    const audit = JSON.parse(fs.readFileSync(temp.auditPath, 'utf8')) as {
      closure_level: string;
      final_result: string;
    };

    expect(snapshot.gate_profile_id).toBe('final_solution_task_list_100');
    expect(snapshot.closure_level).toBe('high_confidence');
    expect(snapshot.derived_rounds).toBe(100);
    expect(audit.closure_level).toBe('high_confidence');
    expect(audit.final_result).toBe('PASS');
  });
});
