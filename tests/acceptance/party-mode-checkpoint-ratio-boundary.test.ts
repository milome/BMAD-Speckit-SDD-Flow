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

describe('party-mode checkpoint ratio boundary', () => {
  it('keeps checkpoint control records out of challenger_ratio accounting', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-checkpoint-ratio-'));
    try {
      startSession(root, {
        sessionKey: 'pm-checkpoint-ratio-001',
        gateProfileId: 'decision_root_cause_50',
      });

      for (let index = 1; index <= 50; index += 1) {
        appendTurn(root, {
          session_key: 'pm-checkpoint-ratio-001',
          round_index: index,
          speaker_id: index <= 31 ? 'adversarial-reviewer' : 'architect',
          designated_challenger_id: 'adversarial-reviewer',
          counts_toward_ratio: true,
          has_new_gap: index > 47 ? false : index % 9 === 0,
        });
      }

      const before = evaluateGate(root, 'pm-checkpoint-ratio-001');
      appendControlRecord(root, {
        session_key: 'pm-checkpoint-ratio-001',
        record_type: 'checkpoint',
        counts_toward_ratio: false,
        payload: {
          resolved_topics: ['root cause agreed'],
          next_focus: ['batch 3'],
        },
      });
      const after = evaluateGate(root, 'pm-checkpoint-ratio-001');

      expect(after.rounds).toBe(before.rounds);
      expect(after.counted_rounds).toBe(before.counted_rounds);
      expect(after.challenger_rounds).toBe(before.challenger_rounds);
      expect(after.challenger_ratio).toBe(before.challenger_ratio);
      expect(after.gate_pass).toBe(before.gate_pass);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
