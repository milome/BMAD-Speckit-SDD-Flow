import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AGENT_TURN_EVENT_SOURCE_MODE,
  appendTurn,
  DEFAULT_DESIGNATED_CHALLENGER_ID,
  evaluateGate,
  finalizeEvidence,
  HOST_NATIVE_AGENT_TURN_REASON,
  recoverSession,
  startSession,
} from '../../scripts/party-mode-runtime';

describe('party-mode runtime owner', () => {
  it('starts a session with canonical paths and gate profile metadata', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-runtime-owner-'));
    const meta = startSession(root, {
      sessionKey: 'pm-owner-001',
      gateProfileId: 'decision_root_cause_50',
    });

    expect(meta.designated_challenger_id).toBe(DEFAULT_DESIGNATED_CHALLENGER_ID);
    expect(meta.gate_profile_id).toBe('decision_root_cause_50');
    expect(meta.min_rounds).toBe(50);
    expect(meta.closure_level).toBe('standard');
    expect(meta.agent_turn_event_source_mode).toBe(AGENT_TURN_EVENT_SOURCE_MODE);
    expect(meta.host_native_agent_turn_supported).toBe(false);
    expect(meta.host_native_agent_turn_reason).toBe(HOST_NATIVE_AGENT_TURN_REASON);
    expect(meta.session_log_path).toContain('_bmad-output/party-mode/sessions/pm-owner-001.jsonl');
    expect(
      fs.existsSync(
        path.join(root, '_bmad-output', 'party-mode', 'sessions', 'pm-owner-001.meta.json')
      )
    ).toBe(true);
  });

  it('owns append/evaluate/recover/finalize lifecycle helpers', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-runtime-owner-lifecycle-'));
    startSession(root, {
      sessionKey: 'pm-owner-002',
      gateProfileId: 'decision_root_cause_50',
      designatedChallengerId: 'critical-auditor',
    });

    for (let index = 1; index <= 50; index += 1) {
      appendTurn(root, {
        session_key: 'pm-owner-002',
        round_index: index,
        speaker_id: index <= 31 ? 'critical-auditor' : 'architect',
        designated_challenger_id: 'critical-auditor',
        counts_toward_ratio: true,
        has_new_gap: index > 47 ? false : index % 9 === 0,
      });
    }

    const result = evaluateGate(root, 'pm-owner-002');
    expect(result.gate_pass).toBe(true);
    expect(result.rounds).toBe(50);

    const recovery = recoverSession(root, 'pm-owner-002');
    expect(recovery.result.gate_pass).toBe(true);
    expect(recovery.snapshotMatchesLog).toBe(true);

    const finalized = finalizeEvidence(root, 'pm-owner-002');
    expect(finalized.gate_pass).toBe(true);
    const auditPath = path.join(
      root,
      '_bmad-output',
      'party-mode',
      'evidence',
      'pm-owner-002.audit.json'
    );
    const snapshotPath = path.join(
      root,
      '_bmad-output',
      'party-mode',
      'snapshots',
      'pm-owner-002.latest.json'
    );
    expect(fs.existsSync(auditPath)).toBe(true);
    expect(fs.existsSync(snapshotPath)).toBe(true);

    const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8')) as {
      closure_level: string;
      agent_turn_event_source_mode: string;
      host_native_agent_turn_supported: boolean;
      host_native_agent_turn_reason: string;
    };
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as {
      closure_level: string;
      agent_turn_event_source_mode: string;
      host_native_agent_turn_supported: boolean;
      host_native_agent_turn_reason: string;
    };

    for (const artifact of [audit, snapshot]) {
      expect(artifact.closure_level).toBe('standard');
      expect(artifact.agent_turn_event_source_mode).toBe(AGENT_TURN_EVENT_SOURCE_MODE);
      expect(artifact.host_native_agent_turn_supported).toBe(false);
      expect(artifact.host_native_agent_turn_reason).toBe(HOST_NATIVE_AGENT_TURN_REASON);
    }
  });
});
