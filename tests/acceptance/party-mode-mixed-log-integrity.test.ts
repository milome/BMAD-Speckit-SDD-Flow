import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendControlRecord,
  appendTurn,
  evaluateGate,
  startSession,
} from '../../scripts/party-mode-runtime';

describe('party-mode mixed log integrity', () => {
  it('rejects control records that try to masquerade as agent turns or counted ratio events', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-mixed-log-'));
    try {
      startSession(root, {
        sessionKey: 'pm-mixed-log-001',
        gateProfileId: 'decision_root_cause_50',
      });

      expect(() =>
        appendControlRecord(root, {
          session_key: 'pm-mixed-log-001',
          record_type: 'agent_turn' as never,
          counts_toward_ratio: false,
        })
      ).toThrow(/must not use record_type = "agent_turn"/);

      expect(() =>
        appendControlRecord(root, {
          session_key: 'pm-mixed-log-001',
          record_type: 'checkpoint',
          counts_toward_ratio: true as never,
        })
      ).toThrow(/must set counts_toward_ratio = false/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps a mixed session log stable when non-agent-turn records are interleaved with agent turns', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-mixed-log-stable-'));
    try {
      startSession(root, {
        sessionKey: 'pm-mixed-log-002',
        gateProfileId: 'decision_root_cause_50',
      });

      for (let index = 1; index <= 25; index += 1) {
        appendTurn(root, {
          session_key: 'pm-mixed-log-002',
          round_index: index,
          speaker_id: index <= 16 ? 'adversarial-reviewer' : 'architect',
          designated_challenger_id: 'adversarial-reviewer',
          counts_toward_ratio: true,
          has_new_gap: index > 22 ? false : index % 8 === 0,
        });
      }

      appendControlRecord(root, {
        session_key: 'pm-mixed-log-002',
        record_type: 'heartbeat',
        counts_toward_ratio: false,
        payload: { message: 'still running' },
      });
      appendControlRecord(root, {
        session_key: 'pm-mixed-log-002',
        record_type: 'checkpoint',
        counts_toward_ratio: false,
        payload: { unresolved_topics: ['fallback path'] },
      });

      for (let index = 26; index <= 50; index += 1) {
        appendTurn(root, {
          session_key: 'pm-mixed-log-002',
          round_index: index,
          speaker_id: index <= 40 ? 'adversarial-reviewer' : 'architect',
          designated_challenger_id: 'adversarial-reviewer',
          counts_toward_ratio: true,
          has_new_gap: index > 47 ? false : index % 8 === 0,
        });
      }

      const result = evaluateGate(root, 'pm-mixed-log-002');
      expect(result.rounds).toBe(50);
      expect(result.counted_rounds).toBe(50);
      expect(result.challenger_rounds).toBe(31);
      expect(result.challenger_ratio).toBeCloseTo(31 / 50, 6);
      expect(result.gate_pass).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
