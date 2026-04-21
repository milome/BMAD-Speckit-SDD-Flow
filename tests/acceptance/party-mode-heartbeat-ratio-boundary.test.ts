import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendControlRecord,
  appendTurn,
  createFacilitatorHeartbeat,
  evaluateGate,
  startSession,
} from '../../scripts/party-mode-runtime';

describe('party-mode heartbeat ratio boundary', () => {
  it('keeps facilitator heartbeat records out of gate statistics', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'party-mode-heartbeat-ratio-'));
    try {
      startSession(root, {
        sessionKey: 'pm-heartbeat-ratio-001',
        gateProfileId: 'decision_root_cause_50',
      });

      for (let index = 1; index <= 50; index += 1) {
        appendTurn(root, {
          session_key: 'pm-heartbeat-ratio-001',
          round_index: index,
          speaker_id: index <= 31 ? 'adversarial-reviewer' : 'architect',
          designated_challenger_id: 'adversarial-reviewer',
          counts_toward_ratio: true,
          has_new_gap: index > 47 ? false : index % 10 === 0,
        });
      }

      const before = evaluateGate(root, 'pm-heartbeat-ratio-001');
      const heartbeat = createFacilitatorHeartbeat({
        currentRoundInBatch: 12,
        batchSize: 20,
        elapsedMs: 92_000,
      });
      appendControlRecord(root, {
        session_key: 'pm-heartbeat-ratio-001',
        record_type: heartbeat.record_type,
        counts_toward_ratio: heartbeat.counts_toward_ratio,
        payload: { authority: heartbeat.authority, message: heartbeat.message },
      });
      const after = evaluateGate(root, 'pm-heartbeat-ratio-001');

      expect(after.rounds).toBe(before.rounds);
      expect(after.counted_rounds).toBe(before.counted_rounds);
      expect(after.challenger_rounds).toBe(before.challenger_rounds);
      expect(after.challenger_ratio).toBe(before.challenger_ratio);
      expect(after.failed_checks).toEqual(before.failed_checks);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
